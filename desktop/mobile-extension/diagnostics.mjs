import { isOperatorPeer } from './operator-admission.mjs';
// SPDX-License-Identifier: Apache-2.0
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { mkdir, chmod, lstat, readFile, open, rename, unlink, readdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { validateReport } from './diagnostic-schema.mjs';
export const name='mobile-diagnostics';
export const inject=['profileContext'];
export const diagnosticsRoot=()=>join(tmpdir(),`dsh-mobile-app-diagnostics-${process.getuid?.()??'user'}`);
const queues=new Map();
export class ComputerDiagnostics {
  constructor({root=diagnosticsRoot(),profile='default',now=()=>Date.now()}={}) {
    this.directory=join(root,createHash('sha256').update(profile).digest('hex').slice(0,16));this.root=root;this.now=now;
  }
  async safeDirectory(path) {
    await mkdir(path,{recursive:true,mode:0o700});
    const info=await lstat(path);
    if(!info.isDirectory()||info.isSymbolicLink()||(process.getuid&&info.uid!==process.getuid()))throw Error('diagnostics-storage-unavailable');
    await chmod(path,0o700);
  }
  async upload(report) {
    const key=validateReport(report);
    if(Buffer.byteLength(JSON.stringify(report))>512*1024)throw Error('diagnostics-report-too-large');
    const previous=queues.get(this.directory)??Promise.resolve();
    const next=previous.catch(()=>{}).then(()=>this.write(key,report));queues.set(this.directory,next);
    try{return await next;}finally{if(queues.get(this.directory)===next)queues.delete(this.directory);}
  }
  async write(key,report) {
    await this.safeDirectory(this.root);await this.safeDirectory(this.directory);
    const lockPath=join(this.directory,'.write-lock');
    let lock;
    try{lock=await open(lockPath,'wx',0o600);}catch{throw Error('diagnostics-storage-busy');}
    let temporary;
    try{
      await lock.writeFile(String(process.pid));
      await this.prune();
      const path=join(this.directory,key);
      // Validate every directory component; never follow symlinks in the private archive.
      let dir=this.directory;for(const part of dirname(key).split('/')){dir=join(dir,part);await this.safeDirectory(dir);}
      let archive={schema:2,journalId:report.journalId,hour:report.hour,part:report.part,events:[],reports:[]};
      try{const info=await lstat(path);if(!info.isFile()||info.isSymbolicLink()||info.size>8*1024*1024)throw Error('invalid-archive');archive=JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
      const digest=createHash('sha256').update(JSON.stringify(report)).digest('hex');
      const known=archive.reports.find(r=>r.reportId===report.reportId);
      if(known){if(known.sha256!==digest)throw Error('diagnostics-report-conflict');return this.receipt(report,path,key);}
      const rows=new Map(archive.events.map(e=>[e.seq,e]));
      for(const row of report.events){if(rows.has(row.seq)&&JSON.stringify(rows.get(row.seq))!==JSON.stringify(row))throw Error('diagnostics-sequence-conflict');rows.set(row.seq,row);}
      archive.events=[...rows.values()].sort((a,b)=>a.seq-b.seq);
      archive.reports.push({reportId:report.reportId,sha256:digest,accepted:report.events.length,receivedAt:this.now(),appVersion:report.appVersion,versionCode:report.versionCode,sdk:report.sdk});
      const data=JSON.stringify(archive);
      if(Buffer.byteLength(data)>8*1024*1024||archive.events.length>10000||archive.reports.length>10000)throw Error('diagnostics-report-too-large');
      const archives=await this.files();const size=archives.reduce((n,f)=>n+f.size,0);
      const existing=archives.find(f=>f.path===path)?.size??0;
      if(size-existing+Buffer.byteLength(data)>64*1024*1024)throw Error('diagnostics-storage-full');
      temporary=path+'.'+randomUUID()+'.tmp';const output=await open(temporary,'wx',0o600);
      try{await output.writeFile(data);await output.sync();}finally{await output.close();}
      await rename(temporary,path);temporary=null;
      return this.receipt(report,path,key);
    }finally{if(temporary)await unlink(temporary).catch(()=>{});await lock.close();await unlink(lockPath);}
  }
  receipt(report,path,key){return {reportId:report.reportId,accepted:report.events.length,archiveKey:key,localPath:path,directory:this.directory};}
  async files(dir=this.directory){
    const result=[];
    for(const e of await readdir(dir,{withFileTypes:true})){
      if(e.isSymbolicLink())continue;
      const path=join(dir,e.name);
      if(e.isDirectory()){result.push(...await this.files(path));}
      else if(e.isFile()&&e.name.endsWith('.json')){const stat=await lstat(path);result.push({path,size:stat.size,mtime:stat.mtimeMs});}
    }
    return result;
  }
  async prune(){for(const file of await this.files())if(file.mtime<this.now()-7*86400000)await unlink(file.path);}
}
export function registerDiagnostics(ctx,{protocol,connection},store) {
  const initializers=[];
  class MobileDiagnostics extends protocol.TypertRemoteService {
    constructor(){super(ctx,'mobileDiagnostics');for(const init of initializers)init.call(this);}
    operator(){if(!(isOperatorPeer(this.ctx.invocation?.peer, connection)))throw new protocol.RemoteError('access-denied','access-denied',{});}
    async capabilities(){this.operator();return {version:1,schema:2,maxEvents:500,localOnly:true};}
    async upload(report){this.operator();try{return await store.upload(report);}catch(error){const code=/^diagnostics-[a-z-]+$/.test(error.message)?error.message:'diagnostics-storage-unavailable';throw new protocol.RemoteError(code,code,{});}}
  }
  for(const method of ['capabilities','upload'])protocol.Remote(MobileDiagnostics.prototype[method],{kind:'method',name:method,static:false,private:false,addInitializer:fn=>initializers.push(fn)});
  return new MobileDiagnostics();
}
export async function apply(ctx){
  const require=createRequire(ctx.profileContext.installAnchor);const load=name=>import(pathToFileURL(require.resolve(name)).href);
  const [protocol,connection]=await Promise.all([load('@deepseek-ai/dsh-typert-protocol'),load('@deepseek-ai/dsh-client-connection')]);
  registerDiagnostics(ctx,{protocol,connection},new ComputerDiagnostics({profile:resolve(ctx.profileContext.installAnchor)}));
}
