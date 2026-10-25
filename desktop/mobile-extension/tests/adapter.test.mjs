import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { apply } from '../index.mjs';

for (const config of [undefined, { expectedScheduleHash: '0'.repeat(64) }, { expectedScheduleHashes: [] }, { expectedScheduleHashes: ['0'.repeat(64)] }, { expectedScheduleHashes: ['invalid'] }]) {
  test(config ? 'unknown Schedule build is refused before touching core services' : 'missing Schedule pin is refused before touching core services', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-mobile-pin-test-'));
    try {
      await writeFile(join(root, 'package.json'), '{"name":"owned-adapter-test","private":true}');
      const module = join(root, 'node_modules/@deepseek-ai/dsh-schedule'); await mkdir(module, { recursive: true });
      await writeFile(join(module, 'package.json'), '{"name":"@deepseek-ai/dsh-schedule","main":"index.js"}');
      await writeFile(join(module, 'index.js'), '// deliberately unrecognized installed build\n');
      let touched = false;
      const ctx = { profileContext: { installAnchor: join(root, 'package.json') }, get schedule() { touched = true; throw Error('core touched'); } };
      await assert.rejects(apply(ctx, config), /unsupported schedule module hash/); assert.equal(touched, false);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}
