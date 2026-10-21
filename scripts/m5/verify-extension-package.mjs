import assert from 'node:assert/strict';
import { readFile, mkdtemp, stat, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
const fixture = JSON.parse(await readFile(resolve(root, '.local/m5-fixed-bundle-fixture.json')));
const directory = await mkdtemp(join(tmpdir(), 'dsh-single-bundle-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  assert.equal(hash(await readFile(fixture.path)), fixture.sha256);
  execFileSync('tar', ['-xzf', fixture.path, '-C', directory]);
  const base = join(directory, 'package');
  const runtime = join(base, fixture.runtimePath);
  const manifest = JSON.parse(await readFile(join(base, 'package.json')));
  assert.equal(manifest.version, fixture.packageVersion);
  for (const name of ['LICENSE','NOTICE','THIRD_PARTY_NOTICES.md']) assert.ok((await readFile(join(base,name))).length > 100);
  assert.ok((await readFile(join(runtime,'distribution-notices/legal/dependencies/npm-runtime.json'))).length > 100);
  assert.equal(manifest.name, fixture.packageName ?? '@dsh-mobile-app/desktop-extension');
  if(fixture.publicBeta){
    assert.equal(manifest.private,false);
    assert.equal(manifest.publishConfig.tag,'beta');
    assert.equal(manifest.publishConfig.access,'public');
    const distribution=JSON.parse(await readFile(join(runtime,'gateway/project-distribution.json')));
    assert.equal(distribution.androidDownloadAvailable,false);
    assert.equal(distribution.androidDownloadUrl,undefined);
    assert.ok(!JSON.stringify(distribution).includes('r2.dev'));
  }
  assert.equal(manifest.dependencies['dsh-mobile'], undefined);
  assert.equal(manifest.dsh.client, undefined);
  assert.ok(manifest.dsh.bundle.patch);
  const runtimeManifest = JSON.parse(await readFile(join(runtime, 'package.json')));
  assert.equal(runtimeManifest.dsh?.client, undefined);
  const gateway = JSON.parse(await readFile(join(runtime, 'gateway/package.json')));
  assert.ok(gateway.dsh.client);
  assert.equal(gateway.dsh.bundle, undefined);
  for (const [name, expected] of Object.entries(fixture.implementation)) assert.equal(hash(await readFile(join(runtime, name))), expected, name);
  const lock = JSON.parse(await readFile(join(runtime, 'upstream-lock.json')));
  for (const [name, expected] of Object.entries(lock.binaries)) {
    const path = join(runtime, 'vendor/dsh-mobile', name);
    assert.equal(hash(await readFile(path)), expected.sha256);
    assert.ok((await stat(path)).mode & 0o111, name + ' is executable');
  }
  assert.ok((await stat(resolve(base, manifest.bin['dsh-mobile']))).mode & 0o111);
  const patch = await readFile(join(base, 'cordis.patch.yml'), 'utf8');
  assert.ok(patch.includes(`name: './${fixture.runtimePath}/gateway/index.mjs'`));
  console.log(JSON.stringify({ verified: true, packageVersion: manifest.version, sourceCommit: fixture.sourceCommit,
    sha256: fixture.sha256, verifiedImplementationFiles: Object.keys(fixture.implementation).length,
    binaries: Object.keys(lock.binaries).length, independentlyInstalledOldPluginRequired: false }));
} finally { await rm(directory, { recursive: true, force: true }); }
