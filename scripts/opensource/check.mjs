// SPDX-License-Identifier: Apache-2.0
// Current-file checks only. Does not inspect/clean Git history, refs or remote artifacts.
import assert from 'node:assert/strict';
import {readFile,stat,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'../..');
const pending=process.argv.includes('--allow-pending-screenshots');
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const missing=[],findings=[],active=[];
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /npm_[A-Za-z0-9]{36}/, /(?:ghp|gho|github_pat)_[A-Za-z0-9_]{30,}/];
for(const file of new Set(files)){
 const path=resolve(root,file);try{if(!(await stat(path)).isFile())continue;}catch{continue;}
 active.push(file);
 if(file.startsWith('desktop/mobile-extension/vendor/'))continue; // Integrity-locked upstream has its own license/docs checks.
 if(!['.md','.kt','.kts','.mjs','.js','.json','.yml','.yaml','.xml','.sh','.py','.txt',''].includes(extname(file)))continue;
 const text=await readFile(path,'utf8');
 if(patterns.some(p=>p.test(text)))findings.push({file,kind:'credential-pattern'});
 if(file.endsWith('.md')){
  const links=[...text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]);
  links.push(...[...text.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]));
  for(let link of links){
   link=link.trim().replace(/^<|>$/g,'');if(/^(https?:|mailto:|#)/.test(link))continue;
   link=decodeURIComponent(link.split('#')[0]);if(!link)continue;
   if(pending&&link.includes('screenshots/'))continue;
   try{await stat(resolve(dirname(path),link));}catch{missing.push({file,target:link});}
  }
 }
}
const read=p=>readFile(resolve(root,p),'utf8');
const readme=await read('README.md');assert.ok(readme.indexOf('saya-ch')>=0&&readme.indexOf('saya-ch')<1000);
for(const file of ['LICENSE','NOTICE','CREDITS.md','THIRD_PARTY_NOTICES.md','PRIVACY.md','SECURITY.md','CONTRIBUTING.md','docs/guide/getting-started.md'])assert.ok((await read(file)).length>100,file);
const gradle=await read('core/data/build.gradle.kts');assert.ok(!gradle.includes('gradleProperty("diagnosticsUploadUrl")'));assert.ok(!gradle.includes('https://'));
const data=await read('core/data/src/main/java/dev/dsh/mobile/data/DiagnosticRepository.kt');assert.ok(data.includes('if (!uploadAvailable)'));assert.ok(data.includes('automatic = uploadAvailable &&'));assert.ok(data.includes('computerUploader'));assert.ok(!data.includes('Request.Builder')); assert.ok(!data.includes('https://'));
let screenshots=0;
try{const manifest=JSON.parse(await read('docs/screenshots/manifest.json'));for(const row of manifest.images){assert.equal(createHash('sha256').update(await readFile(resolve(root,row.path))).digest('hex'),row.sha256);screenshots++;}}catch(error){if(!pending)throw error;}
if(missing.length)console.error(JSON.stringify({brokenLocalLinks:missing},null,2));
if(findings.length)console.error(JSON.stringify({findings},null,2));
assert.equal(missing.length,0,'Broken local documentation links');assert.equal(findings.length,0,'Potential credentials require review');
await mkdir(resolve(root,'.local/opensource'),{recursive:true});
const report={currentFileChecksPassed:true,files:active.length,screenshots,linksPassed:true,credentialPatternFindings:0,diagnosticsDefault:'local-only; paired-computer RPC only; automatic opt-in guarded',historyScanned:false,historySanitized:false,brandRightsResolved:false};
await writeFile(resolve(root,'.local/opensource/source-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
