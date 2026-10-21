import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

test('loaded engine identity remains frozen when its disk source later changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-runtime-identity-'));
  const path = join(root, 'engine.mjs'); const source = await readFile(new URL('../schedule-engine.mjs', import.meta.url));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  try {
    await writeFile(path, source); const loaded = await import(pathToFileURL(path).href);
    assert.equal(loaded.engineSha256, hash(source));
    const changed = Buffer.concat([source, Buffer.from('\n// independently changed disk source\n')]); await writeFile(path, changed);
    assert.equal(loaded.engineSha256, hash(source));
    const fresh = await import(pathToFileURL(path).href + '?fresh=1');
    assert.equal(fresh.engineSha256, hash(changed)); assert.notEqual(fresh.engineSha256, loaded.engineSha256);
  } finally { await rm(root, { recursive: true, force: true }); }
});
