import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { relocateExtensionPatch } from '../../../scripts/m5/extension-layout.mjs';

const source = new URL('../', import.meta.url);
test('upstream runtime, sources, licenses and browser assets match the fixed release', async () => {
  const lock = JSON.parse(await readFile(new URL('upstream-lock.json', source)));
  assert.equal(lock.version, '0.6.3');
  assert.equal(Object.keys(lock.binaries).length, 3);
  for (const [name, sha] of Object.entries(lock.files)) {
    const bytes = await readFile(new URL('vendor/dsh-mobile/' + name, source));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha, name);
  }
  for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'FUNNEL_THIRD_PARTY_LICENSES.txt', 'lib/extension-worker-runtime.mjs', 'lib/mobile-layout.js', 'lib/mobile-compat.js']) assert.ok(lock.files[name]);
});
test('one Bundle owns the gateway, directory picker, question fixes and all enhanced services', async () => {
  const manifest = JSON.parse(await readFile(new URL('package.json', source)));
  const patch = await readFile(new URL('cordis.patch.yml', source), 'utf8');
  const packaged = relocateExtensionPatch(patch, 'runtime/test');
  assert.equal(manifest.dependencies['dsh-mobile'], undefined);
  assert.equal(manifest.bin['dsh-mobile'], './vendor/dsh-mobile/lib/cli.js');
  assert.equal(manifest.dsh.client, undefined, 'Multiple service entries must not each register a browser module');
  const gateway = JSON.parse(await readFile(new URL('gateway/package.json', source)));
  assert.equal(gateway.dsh.bundle, undefined, 'Gateway is an internal component, not another installed Bundle');
  assert.equal(gateway.name, '@dsh-mobile-app/gateway');
  assert.equal(gateway.exports['./client'], './client.js');
  assert.equal((packaged.match(/id: mobile-access\n/g) ?? []).length, 1);
  for (const name of ['gateway/index.mjs', 'search.mjs', 'index.mjs', 'attachments.mjs', 'account-summary.mjs', 'vendor/dsh-mobile/packages/question-fixes/lib/index.mjs']) assert.ok(packaged.includes(`name: './runtime/test/${name}'`), name);
  for (const file of ['setup.json', 'devices.json', 'control.json', 'mobile.css', 'mobile.js']) assert.ok(packaged.includes('mobile-access/' + file));
  assert.ok(packaged.includes("platform === 'win32'"));
  assert.ok(!packaged.includes('name: dsh-mobile\n'));
});
test('browser entry registers the owning package ID and preserves upstream factory', async () => {
  const original = await readFile(new URL('vendor/dsh-mobile/lib/client.js', source), 'utf8');
  const merged = await readFile(new URL('gateway/client.js', source), 'utf8');
  let entry;
  vm.runInNewContext(merged, { window: { __ModuleLoader__: { load: value => { entry = value; } } } });
  assert.equal(entry.id, '@dsh-mobile-app/gateway');
  assert.equal(typeof entry.factory, 'function');
  assert.ok(!merged.includes('github.com/saya-ch/dsh-mobile'));
  assert.ok(merged.includes('github.com/y8n/dsh-mobile-app'));
  assert.ok(original.includes('github.com/saya-ch/dsh-mobile')); // archived source remains intact
});
test('second gateway is rejected before touching existing listeners or files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gateway-owner-'));
  try {
    await writeFile(join(directory, 'upstream.mjs'), 'export let calls=0; export function apply(ctx,config){calls++;return config;}');
    const gateway = (await readFile(new URL('gateway/index.mjs', source), 'utf8')).replaceAll('../vendor/dsh-mobile/lib/project-index.mjs', './upstream.mjs');
    await writeFile(join(directory, 'gateway.mjs'), gateway);
    const module = await import(pathToFileURL(join(directory, 'gateway.mjs')));
    await assert.rejects(module.apply({ get: () => ({}) }, {}), /another gateway is active/);
    assert.equal(module.calls, 0);
    assert.deepEqual(await module.apply({ get: () => undefined }, { stateFile: 'existing-devices.json' }), { stateFile: 'existing-devices.json' });
    assert.equal(module.calls, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
