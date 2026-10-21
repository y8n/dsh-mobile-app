import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountSummaryReader,platformWallets} from '../account-summary.mjs';
const payload={normal_wallets:[{currency:'CNY',balance:'65.2030683600000000'}],bonus_wallets:[{currency:'CNY',balance:'54.3489456000000000'}],total_costs:[{currency:'CNY',amount:'259.3641177600000000'}]};
const grant=(token='fixture-token',issuer='https://platform.example')=>({kind:'grant',payload:{version:1,token,issuer}});
function setup({record=grant(),key='fixture-key',fetch,now=()=>1000}={}) {
 const box={record,key,calls:[]};
 box.reader=new AccountSummaryReader({credentials:{readRecord:async()=>box.record,resolve:async()=>box.key?{value:box.key}:undefined},now,fetch:async(url,options)=>{box.calls.push({url:String(url),options});return fetch?fetch(url,options):Response.json({code:0,data:{biz_code:0,biz_data:payload}})}});
 return box;
}
test('exact decimals, exponent grammar and missing costs never invent zero',()=>{
 assert.deepEqual(platformWallets(payload),[{currency:'CNY',balance:'119.55201396',toppedUpBalance:'65.20306836',grantedBalance:'54.3489456',totalCosts:'259.36411776'}]);
 const {total_costs,...without}=payload;assert.equal(platformWallets(without)[0].totalCosts,undefined);
 assert.equal(platformWallets({normal_wallets:[{currency:'CNY',balance:'1e3'}],bonus_wallets:[{currency:'CNY',balance:'0E-16'}]})[0].balance,'1000');
 assert.throws(()=>platformWallets({...payload,total_costs:[{currency:'CNY',amount:'NaN'}]}));
});
test('only fixed GET path, issuer headers, one read per day and no credential fields',async()=>{
 let now=1000;const x=setup({now:()=>now});
 const [a,b]=await Promise.all([x.reader.read(),x.reader.read()]);assert.deepEqual(a,b);assert.equal(x.calls.length,1);
 assert.equal(a.wallets[0].totalCosts,'259.36411776');assert.equal(x.calls[0].url,'https://platform.example/api/v0/users/get_user_summary');
 assert.equal(x.calls[0].options.method,'GET');assert.equal(x.calls[0].options.headers['x-dsh-auth-token'],'fixture-token');assert.equal(x.calls[0].options.headers.Authorization,undefined);assert.equal(x.calls[0].options.redirect,'error');
 assert.ok(!JSON.stringify(a).includes('fixture-token'));assert.ok(!JSON.stringify(a).includes('fixture-key'));
 await x.reader.read();assert.equal(x.calls.length,1);now+=86_400_000;await x.reader.read();assert.equal(x.calls.length,2);
});
test('API key fallback preserves is_available and does not invent cumulative costs',async()=>{
 const x=setup({record:undefined,fetch:async()=>Response.json({is_available:false,balance_infos:[{currency:'CNY',total_balance:'0',granted_balance:'0',topped_up_balance:'0'}]})});x.record=undefined;
 const a=await x.reader.read();assert.equal(a.source,'api-key');assert.equal(a.isAvailable,false);assert.equal(a.costStatus,'account-login-required');assert.equal(a.wallets[0].totalCosts,undefined);assert.equal(x.calls[0].url,'https://api.deepseek.com/user/balance');
});
test('expired platform token falls back without clearing stored grant or forwarding token to API',async()=>{
 const x=setup({fetch:async(url)=>String(url).includes('get_user_summary')?Response.json({code:40003}):Response.json({is_available:true,balance_infos:[{currency:'CNY',total_balance:'1',granted_balance:'0',topped_up_balance:'1'}]})});
 const a=await x.reader.read();assert.equal(a.costStatus,'expired');assert.equal(a.source,'api-key');assert.equal(x.calls.length,2);assert.equal(x.record.payload.token,'fixture-token');assert.equal(x.calls[1].options.headers['x-dsh-auth-token'],undefined);
});
test('credential change invalidates daily cache and in-flight old account result',async()=>{
 const x=setup();await x.reader.read();x.record=grant('another');await x.reader.read();assert.equal(x.calls.length,2);
 let release;const gate=new Promise(r=>release=r);const y=setup({fetch:async()=>{await gate;return Response.json({code:0,data:{biz_code:0,biz_data:payload}})}});
 const pending=y.reader.read();const joined=y.reader.read();await new Promise(r=>setImmediate(r));y.record=grant('new-account');release();assert.equal((await pending).error,'account-changed');assert.equal((await joined).error,'account-changed');
});
test('bad issuer, HTML, oversized body and no credentials fail safely without response text',async()=>{
 const invalid=setup({record:grant('fixture-token','http://insecure.example'),key:null});assert.equal((await invalid.reader.read()).status,'failed');assert.equal(invalid.calls.length,0);
 const html=setup({key:null,fetch:async()=>new Response('fixture-token secret html',{status:429})});const a=await html.reader.read();assert.equal(a.error,'rate-limited');assert.ok(!JSON.stringify(a).includes('secret'));
 const large=setup({key:null,fetch:async()=>new Response('x'.repeat(262145))});assert.equal((await large.reader.read()).error,'invalid-response');
 const empty=setup({key:null});empty.record=undefined;assert.equal((await empty.reader.read()).status,'unconfigured');assert.equal(empty.calls.length,0);
});

test('invalid optional cost field preserves valid balance and retries after error backoff',async()=>{
 let now=1000;const x=setup({now:()=>now,fetch:async()=>Response.json({code:0,data:{biz_code:0,biz_data:{...payload,total_costs:[{currency:'CNY',amount:'broken'}]}}})});
 const a=await x.reader.read();assert.equal(a.status,'ready');assert.equal(a.wallets[0].balance,'119.55201396');assert.equal(a.wallets[0].totalCosts,undefined);assert.equal(a.costStatus,'failed');
 await x.reader.read();assert.equal(x.calls.length,1);now+=60_000;await x.reader.read();assert.equal(x.calls.length,2);
 x.reader.close();assert.equal((await x.reader.read()).status,'failed');assert.equal(x.calls.length,2);
});

test('source-only package graph relocates every service including the account module',async()=>{
 const {readFile}=await import('node:fs/promises');const {runtimeModules,relocateExtensionPatch}=await import('../../../scripts/m5/extension-layout.mjs');
 const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 const patch=await readFile(new URL('../cordis.patch.yml',import.meta.url),'utf8');
 const relocated=relocateExtensionPatch(patch,'runtime/fixture');
 assert.ok(!relocated.includes("name: '@dsh-mobile-app/desktop-extension"));
 assert.ok(relocated.includes("name: './runtime/fixture/account-summary.mjs'"));
 for(const module of runtimeModules){assert.ok(manifest.files.includes(module));await readFile(new URL('../'+module,import.meta.url));}
});

test('Remote account access requires an OperatorPeer before reading credentials',async()=>{
 const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {pathToFileURL}=await import('node:url');const {apply}=await import('../account-summary.mjs');
 const root=await mkdtemp(join(tmpdir(),'account-adapter-'));
 try {
  await writeFile(join(root,'package.json'),'{"private":true}');
  for(const [name,source] of [
   ['dsh-typert-protocol',`export class TypertRemoteService {constructor(ctx){this.ctx=ctx;ctx.service=this;}} export class RemoteError extends Error {constructor(code){super(code);this.code=code;}} export function Remote(){}`],
   ['dsh-client-connection','export class OperatorPeer {}'],
  ]){const directory=join(root,'node_modules/@deepseek-ai',name);await mkdir(directory,{recursive:true});await writeFile(join(directory,'package.json'),JSON.stringify({type:'module',main:'index.js'}));await writeFile(join(directory,'index.js'),source);}
  let reads=0;const ctx={profileContext:{installAnchor:join(root,'package.json')},credentials:{readRecord:async()=>{reads++;},resolve:async()=>{reads++;}},effect:()=>{},invocation:{peer:{}}};
  await apply(ctx);await assert.rejects(ctx.service.summary(),error=>error.code==='access-denied');assert.equal(reads,0);
  const {OperatorPeer}=await import(pathToFileURL(join(root,'node_modules/@deepseek-ai/dsh-client-connection/index.js')).href);ctx.invocation.peer=new OperatorPeer();assert.equal((await ctx.service.summary()).status,'unconfigured');assert.ok(reads>0);
 } finally {await rm(root,{recursive:true,force:true});}
});
