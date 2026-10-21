import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const hash = (value, algorithm = 'sha256', encoding = 'hex') => createHash(algorithm).update(value).digest(encoding);

/** Fixed upstream release; no install hooks or executable code runs here. */
export async function upstreamArtifacts(source, cache) {
  const lock = JSON.parse(await readFile(resolve(source, 'upstream-lock.json'), 'utf8'));
  const files = {};
  for (const [name, expected] of Object.entries(lock.files)) {
    if (name.startsWith('/') || name.split('/').includes('..')) throw Error('Unsafe upstream path');
    const path = 'vendor/dsh-mobile/' + name;
    const bytes = await readFile(resolve(source, path));
    if (hash(bytes) !== expected) throw Error('Upstream source mismatch: ' + name);
    files[path] = bytes;
  }
  await mkdir(cache, { recursive: true });
  const archive = join(cache, `dsh-mobile-${lock.version}.tgz`);
  let bytes;
  try { bytes = await readFile(archive); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const valid = value => value && 'sha512-' + hash(value, 'sha512', 'base64') === lock.integrity;
  if (!valid(bytes)) {
    if (lock.tarball !== `https://registry.npmjs.org/dsh-mobile/-/dsh-mobile-${lock.version}.tgz`) throw Error('Unexpected upstream archive URL');
    const response = await fetch(lock.tarball, { signal: AbortSignal.timeout(120000), redirect: 'error' });
    if (!response.ok) throw Error('Upstream download failed: ' + response.status);
    bytes = Buffer.from(await response.arrayBuffer());
    if (!valid(bytes)) throw Error('Upstream archive integrity mismatch');
    await writeFile(archive, bytes);
  }
  const directory = await mkdtemp(join(tmpdir(), 'dsh-upstream-'));
  try {
    // Extract only the explicit, digest-locked binaries from the verified tar.
    for (const [name, expected] of Object.entries(lock.binaries)) {
      if (!/^bin\/dsh-mobile-funnel-(linux-(arm64|x64)|win32-x64\.exe)$/.test(name)) throw Error('Unexpected upstream binary');
      execFileSync('tar', ['-xzf', archive, '-C', directory, 'package/' + name]);
      const data = await readFile(join(directory, 'package', name));
      if (data.length !== expected.size || hash(data) !== expected.sha256) throw Error('Upstream binary mismatch: ' + name);
      files['vendor/dsh-mobile/' + name] = data;
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
  return files;
}
