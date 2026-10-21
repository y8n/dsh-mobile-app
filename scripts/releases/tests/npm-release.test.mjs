// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {validateInputs,verifyDigest} from '../npm-release.mjs';
const valid={version:'0.2.0-beta.2',sha:'a'.repeat(40),mode:'publish'};
test('reject mutable refs, malformed versions and shell input',()=>{
 assert.deepEqual(validateInputs(valid),valid);
 for(const version of ['latest','01.2.0','0.2.0-beta.01','0.2.0-beta.2; echo bad'])assert.throws(()=>validateInputs({...valid,version}));
 for(const sha of ['main','abc123','a'.repeat(40)+';'])assert.throws(()=>validateInputs({...valid,sha}));
 assert.throws(()=>validateInputs({...valid,mode:'push'}));
});
test('detect changed remote bytes or tampered registry integrity',()=>{
 const bytes=Buffer.from('reviewed artifact');const sha=createHash('sha256').update(bytes).digest('hex');const integrity='sha512-'+createHash('sha512').update(bytes).digest('base64');
 verifyDigest(bytes,sha,integrity);
 assert.throws(()=>verifyDigest(Buffer.from('other artifact'),sha,integrity));
 assert.throws(()=>verifyDigest(bytes,sha,'sha512-wrong'));
});

import {releaseTag} from '../version-policy.mjs';
test('supports stable and arbitrary prerelease channels without promoting prereleases',()=>{
 for(const [version,tag] of [['0.2.0','latest'],['1.0.0+build.7','latest'],['0.2.0-alpha.0','alpha'],['0.2.0-beta.0','beta'],['0.2.0-rc.1','rc'],['1.0.0-preview.3','preview'],['1.0.0-0','next'],['1.0.0-latest.1','next']]){assert.equal(releaseTag(version),tag);validateInputs({...valid,version});}
});
