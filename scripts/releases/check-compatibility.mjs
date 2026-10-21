// SPDX-License-Identifier: Apache-2.0
// Read-only source/document consistency check; not a runtime compatibility probe.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const read = path => readFile(resolve(root, path), 'utf8');
const record = JSON.parse(await read('config/compatibility.json'));
const manifest = JSON.parse(await read('desktop/mobile-extension/package.json'));
const gradle = await read('app/build.gradle.kts');
assert.equal(record.schemaVersion, 1);
assert.equal(record.android.versionName, gradle.match(/versionName\s*=\s*"([^"]+)"/)[1]);
assert.equal(record.android.versionCode, Number(gradle.match(/versionCode\s*=\s*(\d+)/)[1]));
assert.equal(record.desktop.packageName, manifest.name);
assert.equal(record.desktop.version, manifest.version);
assert.equal(record.desktop.directSourcePublicationAllowed, false);
assert.equal(manifest.private, true, 'direct source publication remains disabled');
const docs = await read('docs/版本兼容说明.md');
assert.ok(docs.includes("../config/compatibility.json"), "Documentation must link the authoritative compatibility configuration");
async function kotlinFiles(dir) {
  const results = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...await kotlinFiles(path));
    else if (entry.name.endsWith('.kt')) results.push(path);
  }
  return results;
}
const files = [...await kotlinFiles(resolve(root, 'core/data/src/main')), ...await kotlinFiles(resolve(root, 'core/protocol/src/main'))];
const sources = (await Promise.all(files.map(p => readFile(p, 'utf8')))).join('\n');
for (const method of record.requiredRpcReferences) {
  assert.ok(sources.includes(method), `Stale client RPC reference: ${method}`);
  assert.ok(docs.includes(method), `Missing documented dependency: ${method}`);
}
for (const path of record.evidence) await read(path);
console.log(JSON.stringify({ passed: true, android: record.android, desktop: record.desktop, rpcReferences: record.requiredRpcReferences.length, scope: 'source-and-document-consistency-only', packagesBuilt: false }));
