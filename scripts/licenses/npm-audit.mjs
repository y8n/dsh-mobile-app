// SPDX-License-Identifier: Apache-2.0
import {readFile,readdir,mkdir,writeFile,realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';import {resolve,dirname,join} from 'node:path';import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'../..');
const installed=resolve(process.argv[2]??join(root,'.local/single-plugin/home/profiles/web/node_modules/@dsh-mobile-app/desktop-extension'));
const queue=[installed],seen=new Set(),rows=[];const out=resolve(root,'legal/dependencies/npm-texts');await mkdir(out,{recursive:true});
async function locate(parent,name){const require=createRequire(join(parent,'package.json'));let entry;try{return dirname(require.resolve(name+'/package.json'));}catch{entry=require.resolve(name);}let current=dirname(entry);for(;;){try{const p=JSON.parse(await readFile(join(current,'package.json')));if(p.name===name)return current;}catch{}const next=dirname(current);if(next===current)throw Error('Cannot locate package '+name);current=next;}}
while(queue.length){const base=await realpath(queue.shift());if(seen.has(base))continue;seen.add(base);const pkg=JSON.parse(await readFile(join(base,'package.json')));const own=pkg.name==='@dsh-mobile-app/desktop-extension';
 if(!own){const files=[];for(const name of (await readdir(base)).filter(n=>/^(licen[cs]e|notice|copying)([.-]|$)/i.test(n)).sort()){const data=await readFile(join(base,name));const sha=createHash('sha256').update(data).digest('hex');const target=sha+'.txt';await writeFile(join(out,target),data);files.push({originalName:name,text:'legal/dependencies/npm-texts/'+target,sha256:sha});}
  rows.push({name:pkg.name,version:pkg.version,license:pkg.license??pkg.licenses??null,repository:pkg.repository??null,licenseFiles:files,dependencies:pkg.dependencies??{}});
 }
 for(const [name] of Object.entries(pkg.dependencies??{}))queue.push(await locate(base,name));
}
rows.sort((a,b)=>(a.name+'@'+a.version).localeCompare(b.name+'@'+b.version));await writeFile(resolve(root,'legal/dependencies/npm-runtime.json'),JSON.stringify({scope:'Exact installed dependency closure of the integrated plugin; excludes host-provided peers',rootDependencies:JSON.parse(await readFile(join(installed,'package.json'))).dependencies,packages:rows},null,2)+'\n');
console.log(JSON.stringify({packages:rows.length,withoutLicenseFiles:rows.filter(x=>!x.licenseFiles.length).map(x=>x.name+'@'+x.version),licenseTypes:[...new Set(rows.map(x=>JSON.stringify(x.license)))]}));
