// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import { releaseTag } from './version-policy.mjs';
const root=resolve(import.meta.dirname,'../..');
const fixture=JSON.parse(await readFile(resolve(root,'.local/m5-fixed-bundle-fixture.json')));
assert.equal(fixture.publicBeta,true);
assert.equal(createHash('sha256').update(await readFile(fixture.path)).digest('hex'),fixture.sha256);
const names=execFileSync('tar',['-tzf',fixture.path],{encoding:'utf8'}).trim().split('\n');
for(const name of names){
 assert.ok(name.startsWith('package/')&&!name.split('/').includes('..'),'Unsafe package path');
 assert.ok(!/(^|\/)(\.npmrc|\.env(?:\..*)?|devices\.json|setup\.json|control\.json|.*\.(pem|key|apk))$/i.test(name),'Personal state or key-like file included');
}
const target=await mkdtemp(join(tmpdir(),'public-plugin-check-'));
try{
 execFileSync('tar',['-xzf',fixture.path,'-C',target]);
 const manifest=JSON.parse(await readFile(join(target,'package/package.json')));
 assert.equal(manifest.publishConfig.tag,releaseTag(manifest.version));
 for(const path of names.filter(p=>!p.endsWith('/'))){
  const data=await readFile(join(target,path));
  assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|npm_[A-Za-z0-9]{36}/.test(data.toString()),'Private credential pattern included');
 }
 const dist=JSON.parse(await readFile(join(target,'package',fixture.runtimePath,'gateway/project-distribution.json')));
 assert.equal(dist.audience,'public-beta');assert.equal(dist.androidDownloadAvailable,false);assert.equal(dist.androidDownloadUrl,undefined);
 const {pluginLegalFiles}=await import('../licenses/distribution-files.mjs');
 for(const [path,expected] of Object.entries(await pluginLegalFiles(root)))assert.ok(expected.equals(await readFile(join(target,'package',fixture.runtimePath,'distribution-notices',path))),path);
 console.log(JSON.stringify({publicPackageVerified:true,files:names.length,licenseFilesVerified:true,credentialPatternFindings:0,personalApkIncluded:false}));
}finally{await rm(target,{recursive:true,force:true});}
