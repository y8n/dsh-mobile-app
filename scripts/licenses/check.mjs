// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';import {pluginLegalFiles} from './distribution-files.mjs';
const root=resolve(import.meta.dirname,'../..');const read=p=>readFile(resolve(root,p));const json=async p=>JSON.parse(await read(p));const hash=b=>createHash('sha256').update(b).digest('hex');
assert.ok((await read('LICENSE')).toString().includes('Version 2.0, January 2004'));assert.ok((await read('NOTICE')).toString().includes('saya-ch and contributors'));assert.ok((await read('NOTICE')).toString().includes('2026 DeepSeek'));
const lock=await json('desktop/mobile-extension/upstream-lock.json');for(const [p,sha] of Object.entries(lock.files))assert.equal(hash(await read('desktop/mobile-extension/vendor/dsh-mobile/'+p)),sha,p);
const npm=await json('legal/dependencies/npm-runtime.json');assert.deepEqual(npm.rootDependencies,(await json('desktop/mobile-extension/package.json')).dependencies);
for(const p of npm.packages){assert.ok(p.license&&p.licenseFiles.length,p.name);for(const t of p.licenseFiles)assert.equal(hash(await read(t.text)),t.sha256);}
const android=await json('legal/dependencies/android-runtime.json');for(const m of android.modules){assert.ok(m.licenses.length&&m.license);for(const t of [...m.licenseTexts,...m.embeddedNotices])assert.equal(hash(await read(t.text)),t.sha256);}
const graph=await json('build/reports/licenses/android-runtime.json');const ids=xs=>xs.map(m=>m.group+':'+m.name+':'+m.version).sort();assert.deepEqual(ids(graph),ids(android.modules),'Regenerate Android license inventory');
for(const report of await json('legal/dependencies/development.json'))assert.ok(report.packages.every(p=>p.license));
const assets=await json('legal/ASSET-SOURCES.json');for(const a of assets.assets)assert.equal(hash(await read(a.path)),a.sha256,a.path);
const client=(await read('desktop/mobile-extension/gateway/client.js')).toString();assert.ok(client.slice(0,600).includes('Modifications: Copyright 2026 Y8n'));
const {projectGateway}=await import('../m5/project-gateway.mjs');const derived=projectGateway((await read('desktop/mobile-extension/vendor/dsh-mobile/lib/index.mjs')).toString());assert.ok(derived.slice(0,600).includes('Modified by Y8n'));
const packaged=await pluginLegalFiles(root);for(const p of ['LICENSE','NOTICE','THIRD_PARTY_NOTICES.md','legal/dependencies/npm-runtime.json'])assert.ok(packaged[p]?.length>100,p);
for(const p of ['LICENSE','NOTICE','THIRD_PARTY_NOTICES.md'])assert.equal(hash(await read('app/build/generated/legal-assets/licenses/'+p)),hash(await read(p)),p);
assert.ok((await readdir(resolve(root,'app/build/generated/legal-assets/licenses/dependencies'))).length>0);
console.log(JSON.stringify({passed:true,originalUpstreamFiles:Object.keys(lock.files).length,androidModules:android.modules.length,npmRuntimePackages:npm.packages.length,developmentLockEntries:(await json('legal/dependencies/development.json')).reduce((n,x)=>n+x.packages.length,0),assets:assets.assets.length,pluginLegalFiles:Object.keys(packaged).length,apkLegalAssetsPrepared:true,noPackagesBuilt:true}));
