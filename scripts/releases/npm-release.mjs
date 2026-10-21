// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { releaseTag } from './version-policy.mjs';
export const packageName = '@dsh-mobile-app/desktop-extension';
const root = resolve(import.meta.dirname, '../..');
const registry = 'https://registry.npmjs.org/';
const hash = data => createHash('sha256').update(data).digest('hex');
const json = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const run = (args, options = {}) => execFileSync('npm', args, { cwd: root, stdio: 'inherit', ...options });
export function validateInputs({version, sha, mode}) {
  releaseTag(version);
  assert.match(sha ?? '', /^[a-f0-9]{40}$/, 'A full committed source SHA is required');
  assert.ok(['validate', 'publish'].includes(mode), 'Invalid release mode');
  return {version, sha, mode};
}
export function verifyDigest(data, expected, integrity) {
  assert.equal(hash(data), expected, 'Registry tarball differs from reviewed artifact');
  assert.equal('sha512-'+createHash('sha512').update(data).digest('base64'), integrity, 'Registry integrity mismatch');
}
const inputs = () => validateInputs({version:process.env.RELEASE_VERSION,sha:process.env.EXPECTED_SHA,mode:process.env.RELEASE_MODE});
const reportDir = resolve(root, '.local/npm-release');
async function save(name, value) {await mkdir(reportDir,{recursive:true});await writeFile(join(reportDir,name),JSON.stringify(value,null,2)+'\n');}
async function versionMetadata(version) {
  const response=await fetch(registry+encodeURIComponent(packageName)+'/'+version,{signal:AbortSignal.timeout(30000)});
  if(response.status===404)return null;
  assert.ok(response.ok,'Registry lookup failed: '+response.status);
  return response.json();
}
async function preflight() {
  const {version,sha,mode}=inputs();
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sha,'Source SHA mismatch');
  assert.equal(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),'','Uncommitted source changes');
  const p=await json('desktop/mobile-extension/package.json');assert.equal(p.name,packageName);assert.equal(p.version,version);assert.equal(p.private,true);
  if(process.env.GITHUB_ACTIONS==='true'){
    assert.equal(process.env.GITHUB_REPOSITORY,'y8n/dsh-mobile-app');
    assert.equal(process.env.GITHUB_REF,'refs/heads/main','Dispatch the workflow from main');
  }
  const existing=await versionMetadata(version);
  if(mode==='publish')assert.equal(existing,null,'Version already exists; never overwrite or silently republish');
  else assert.ok(existing,'Validation needs an existing published version');
  await save('preflight.json',{version,sourceCommit:sha,mode,publishedVersionExists:!!existing});
}
async function checkOidc() {
  assert.equal(process.env.GITHUB_ACTIONS,'true','OIDC is only checked on the actual hosted runner');
  const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);url.searchParams.set('audience','npm:registry.npmjs.org');
  const response=await fetch(url,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(30000)});
  assert.ok(response.ok,'GitHub OIDC request failed: '+response.status);
  const {value}=await response.json();assert.ok(value,'GitHub did not return an identity token');
  // Tokens stay in memory. Never log response bodies, write .npmrc, or upload tokens.
  const exchanged=await fetch(registry+'-/npm/v1/oidc/token/exchange/package/'+encodeURIComponent(packageName),{method:'POST',headers:{Authorization:'Bearer '+value},signal:AbortSignal.timeout(30000)});
  assert.equal(exchanged.status,201,'npm trusted publisher exchange failed: '+exchanged.status);
  const token=await exchanged.json();assert.ok(token.token);assert.equal(token.token_type,'oidc');
  await save('oidc.json',{packageName,exchangeStatus:201,expires:token.expires,tokenStored:false,tokenLogged:false,published:false});
  console.log('GitHub OIDC to package-scoped npm token exchange verified; no package published.');
}
async function publish() {
  const {version,mode}=inputs();assert.equal(mode,'publish');
  assert.equal(await versionMetadata(version),null,'Version already exists');
  const fixture=await json('.local/m5-fixed-bundle-fixture.json');assert.equal(fixture.packageVersion,version);assert.equal(fixture.packageName,packageName);assert.equal(fixture.publicBeta,true);assert.equal(fixture.sourceCommit,process.env.EXPECTED_SHA);
  assert.equal(hash(await readFile(fixture.path)),fixture.sha256);
  assert.equal(process.env.GITHUB_ACTIONS,'true');
  assert.ok(!process.env.NODE_AUTH_TOKEN&&!process.env.NPM_TOKEN,'Use OIDC, not a long-lived npm token');
  run(['publish',fixture.path,'--tag',releaseTag(version),'--access','public','--registry='+registry,'--provenance=false'],{env:{...process.env,NPM_CONFIG_PROVENANCE:'false'}});
  await save('publish.json',{version,sourceCommit:fixture.sourceCommit,sha256:fixture.sha256,tag:releaseTag(version),commandSucceeded:true});
}
async function verify() {
  const {version,sha,mode}=inputs();
  const identity=mode==='publish'?await json('.local/m5-fixed-bundle-fixture.json'):await json(`config/releases/npm/${version}.json`);
  assert.equal(identity.packageVersion??identity.version,version);
  let metadata;
  for(let n=0;n<45;n++){
    metadata=await versionMetadata(version);
    const full=await fetch(registry+encodeURIComponent(packageName),{headers:{accept:'application/json'},signal:AbortSignal.timeout(30000)});
    if(metadata&&full.ok)break;
    metadata=null;await new Promise(r=>setTimeout(r,15000));
  }
  assert.ok(metadata,'Registry processing did not finish; rerun validation, do not republish');
  assert.equal(metadata.name,packageName);assert.equal(metadata.version,version);
  assert.ok(metadata.dist.tarball.startsWith(registry+'@dsh-mobile-app/desktop-extension/-/'),'Unexpected tarball host/path');
  const response=await fetch(metadata.dist.tarball,{signal:AbortSignal.timeout(120000)});assert.ok(response.ok);
  const bytes=Buffer.from(await response.arrayBuffer());verifyDigest(bytes,identity.sha256,metadata.dist.integrity);
  const tarball=join(reportDir,'registry-download.tgz');await writeFile(tarball,bytes);
  const unpacked=await mkdtemp(join(tmpdir(),'npm-beta-unpack-'));execFileSync('tar',['-xzf',tarball,'-C',unpacked]);
  const manifest=JSON.parse(await readFile(join(unpacked,'package/package.json')));
  assert.equal(manifest.name,packageName);assert.equal(manifest.version,version);assert.equal(manifest.private,false);assert.equal(manifest.publishConfig.tag,releaseTag(version));
  const runtime=dirname(manifest.main);assert.match(runtime,/^(?:\.\/)?runtime\/[a-f0-9]{64}$/);
  const dist=JSON.parse(await readFile(join(unpacked,'package',runtime,'gateway/project-distribution.json')));
  assert.equal(dist.androidDownloadAvailable,false);assert.equal(dist.androidDownloadUrl,undefined);
  for(const name of ['LICENSE','NOTICE','THIRD_PARTY_NOTICES.md','README.md'])assert.ok((await stat(join(unpacked,'package',name))).size>100);
  const installs=[];
  for(const selector of [version,releaseTag(version)]){
    const target=await mkdtemp(join(tmpdir(),'npm-beta-install-'));
    await writeFile(join(target,'package.json'),JSON.stringify({private:true,name:'npm-beta-install-check',version:'1.0.0'}));
    run(['install','--prefix',target,'--package-lock=false','--no-audit','--no-fund',packageName+'@'+selector,'--registry='+registry]);
    const installed=JSON.parse(await readFile(join(target,'node_modules',packageName,'package.json')));assert.equal(installed.version,version,'Tag or installed version mismatch');
    const base=join(target,'node_modules',packageName);
    const originals=execFileSync('tar',['-tzf',tarball],{encoding:'utf8'}).trim().split('\n').filter(p=>!p.endsWith('/'));
    let compared=0;
    for(const path of originals){assert.ok(path.startsWith('package/')&&!path.includes('..'),'Unsafe package entry');const relative=path.slice(8);assert.equal(hash(await readFile(join(base,relative))),hash(await readFile(join(unpacked,'package',relative))),relative);compared++;}
    assert.ok((await stat(resolve(base,manifest.bin['dsh-mobile']))).mode&0o111);
    const {ProjectReleaseManager}=await import(pathToFileURL(join(base,runtime,'gateway/project-release.mjs')));assert.equal((await new ProjectReleaseManager().status()).installedVersion,version);
    installs.push({selector,version,filesCompared:compared,cliExecutable:true,gatewayMetadataLoaded:true});
  }
  const tagsResponse=await fetch(registry+'-/package/'+encodeURIComponent(packageName)+'/dist-tags',{signal:AbortSignal.timeout(30000)});assert.ok(tagsResponse.ok);const tags=await tagsResponse.json();assert.equal(tags[releaseTag(version)],version);
  await save('registry-verification.json',{packageName,version,checkedSourceCommit:sha,artifactSourceCommit:identity.sourceCommit,sha256:identity.sha256,integrity:metadata.dist.integrity,tarball:metadata.dist.tarball,installs,distTags:tags,normalDesktopUpdated:false,androidBuilt:false,fullHostAndHuaweiTested:false,verifiedAt:new Date().toISOString()});
}
const main=process.argv[2];
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  try {await mkdir(reportDir,{recursive:true});assert.ok(['preflight','oidc-check','publish','verify'].includes(main),'Unknown command');await ({preflight,'oidc-check':checkOidc,publish,verify})[main]();}
  catch(error){console.error(error.message);process.exitCode=1;}
}
