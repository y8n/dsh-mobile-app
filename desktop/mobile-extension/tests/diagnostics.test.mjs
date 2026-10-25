import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile,utimes,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {ComputerDiagnostics,registerDiagnostics,diagnosticsRoot} from '../diagnostics.mjs';
const report=()=>({schema:2,reportId:randomUUID(),appVersion:'test',versionCode:1,sdk:35,journalId:randomUUID(),hour:0,part:0,events:[{at:1,seq:1,stage:'socket.failure',trace:randomUUID(),endpoint:'mux',durationMs:1,status:0,code:'reset',attempt:0,network:'wifi',build:1}]});
async function fixture(t){const temp=await mkdtemp(join(tmpdir(),'dsh-diagnostics-test-'));t.after(()=>rm(temp,{recursive:true,force:true}));return new ComputerDiagnostics({root:join(temp,'logs'),profile:'test'});}
test('fixed temporary root is discoverable and hourly uploads survive restart idempotently',async t=>{
 assert.ok(diagnosticsRoot().includes('dsh-mobile-app-diagnostics-'));const store=await fixture(t),r=report();
 const a=await store.upload(r);assert.equal(a.accepted,1);assert.ok(a.localPath.startsWith(store.directory));
 assert.deepEqual(await new ComputerDiagnostics({root:store.root,profile:'test'}).upload(r),a);
 const next={...r,reportId:randomUUID(),events:[{...r.events[0],seq:2}]};await store.upload(next);
 const archive=JSON.parse(await readFile(a.localPath));assert.equal(archive.events.length,2);assert.equal(archive.reports.length,2);
});
test('concurrent batches merge and conflicting report IDs or sensitive fields fail',async t=>{
 const store=await fixture(t),r=report();const a=await store.upload(r);
 await Promise.all([2,3].map(seq=>store.upload({...r,reportId:randomUUID(),events:[{...r.events[0],seq}]})));
 assert.equal(JSON.parse(await readFile(a.localPath)).events.length,3);
 await assert.rejects(store.upload({...r,sdk:36}),/conflict/);
 await assert.rejects(store.upload({...r,reportId:randomUUID(),events:[{...r.events[0],body:'secret'}]}));
});
test('old archives are pruned and symlinked archives never escape the root',async t=>{
 const store=await fixture(t),r=report(),a=await store.upload(r);await utimes(a.localPath,new Date(0),new Date(0));
 const next={...r,journalId:randomUUID(),reportId:randomUUID()};await store.upload(next);await assert.rejects(readFile(a.localPath));
 await symlink('/tmp/outside-diagnostics',a.localPath);await assert.rejects(store.upload(r));
});
test('all remote operations require an authenticated operator',async()=>{
 let writes=0;class Peer{};class RemoteError extends Error{};
 const ctx={invocation:{peer:{}}};const service=registerDiagnostics(ctx,{connection:{OperatorPeer:Peer},protocol:{RemoteError,Remote:()=>{},TypertRemoteService:class{constructor(ctx){this.ctx=ctx;}}}},{upload:async()=>{writes++;return {accepted:1};}});
 await assert.rejects(service.upload(report()),/access-denied/);await assert.rejects(service.capabilities(),/access-denied/);assert.equal(writes,0);
 ctx.invocation.peer=new Peer();assert.equal((await service.capabilities()).localOnly,true);await service.upload(report());assert.equal(writes,1);
});

test('current Peer owner can upload while restricted principals cannot write', async () => {
 let writes=0;class Peer { constructor(kind) { this.principal={kind}; } }class RemoteError extends Error {}
 const ctx={invocation:{peer:new Peer('agent')}};
 const service=registerDiagnostics(ctx,{connection:{Peer},protocol:{RemoteError,Remote:()=>{},TypertRemoteService:class{constructor(ctx){this.ctx=ctx;}}}},{upload:async()=>{writes++;return {accepted:1};}});
 await assert.rejects(service.upload(report()),/access-denied/);assert.equal(writes,0);
 ctx.invocation.peer=new Peer('owner');await service.upload(report());assert.equal(writes,1);
});
