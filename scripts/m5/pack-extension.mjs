// Release modules use a content-derived path, so an existing ESM module cache
// cannot resurrect an earlier implementation after an owned Bundle upgrade.
import { readFile, writeFile, mkdir, chmod, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runtimeModules, relocateExtensionPatch } from './extension-layout.mjs';
import { pluginLegalFiles } from '../licenses/distribution-files.mjs';
import { projectGateway } from './project-gateway.mjs';
import { projectDistribution } from './project-distribution.mjs';
import { upstreamArtifacts } from './upstream-artifacts.mjs';
const root = resolve(import.meta.dirname, '../..');
const source = resolve(root, 'desktop/mobile-extension');
const manifest = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'));
import { releaseTag } from '../releases/version-policy.mjs';
// --public-beta remains an alias for existing automation; it no longer limits versions.
const publicBeta = process.argv.includes('--public') || process.argv.includes('--public-beta');
const publishName = process.argv.find(arg => arg.startsWith('--publish-name='))?.slice('--publish-name='.length);
if (publicBeta && (!/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(publishName ?? ''))) throw Error('Public package requires explicit scoped publish name');
if (!publicBeta && publishName) throw Error('Publish name only applies to public packages');
if (publicBeta) releaseTag(manifest.version);
const ownNames = [...runtimeModules, 'gateway/index.mjs', 'gateway/client.js', 'gateway/package.json', 'gateway/project-release.mjs', 'upstream-lock.json', 'THIRD_PARTY_NOTICES.md'];
const content = { ...await upstreamArtifacts(source, resolve(root, '.local/single-plugin/upstream')),
  ...Object.fromEntries(await Promise.all(ownNames.map(async name => [name, await readFile(resolve(source, name))]))) };
content['vendor/dsh-mobile/lib/project-index.mjs'] = Buffer.from(projectGateway(content['vendor/dsh-mobile/lib/index.mjs'].toString('utf8')));
content['gateway/project-distribution.json'] = await projectDistribution(root, { audience: 'public-beta' });
const legalFiles = await pluginLegalFiles(root);
for (const [name, bytes] of Object.entries(legalFiles)) content['distribution-notices/' + name] = bytes;
const names = Object.keys(content).sort();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourcePatch = await readFile(resolve(source, 'cordis.patch.yml'), 'utf8');
const identity = sha(Buffer.concat([Buffer.from(JSON.stringify({manifest,publicBeta,publishName})), Buffer.from(sourcePatch), ...names.flatMap(name => [Buffer.from(name), content[name]])]));
const stage = resolve(root, '.local/extension-builds', identity);
const relative = 'runtime/' + identity;
await mkdir(resolve(stage, relative), { recursive: true });
for (const name of names) {
  await mkdir(dirname(resolve(stage, relative, name)), { recursive: true });
  await writeFile(resolve(stage, relative, name), content[name], { mode: name.includes('/bin/') || name === 'vendor/dsh-mobile/lib/cli.js' ? 0o755 : 0o644 });
}
await writeFile(resolve(stage, relative, 'package.json'), JSON.stringify({ private: true, type: 'module', version: manifest.version }));
// A live Node process may retain the canonical target of the previous linked
// package after pnpm replaces that link. Keep the same immutable graph at that
// former target for this hot migration; a fresh process uses the installed tar.
const compatibility = resolve(source, relative);
await mkdir(compatibility, { recursive: true });
if ((await lstat(compatibility)).isSymbolicLink()) throw Error('Refuse a symlinked runtime snapshot');
for (const name of [...names, 'package.json']) {
  const bytes = await readFile(resolve(stage, relative, name));
  await mkdir(dirname(resolve(compatibility, name)), { recursive: true });
  try { await writeFile(resolve(compatibility, name), bytes, { flag: 'wx', mode: name.includes('/bin/') || name === 'vendor/dsh-mobile/lib/cli.js' ? 0o555 : 0o444 }); }
  catch (error) { if (error.code !== 'EEXIST' || !bytes.equals(await readFile(resolve(compatibility, name)))) throw error; }
}
await chmod(compatibility, 0o555);
for (const name of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md']) await writeFile(resolve(stage, name), legalFiles[name]);
await writeFile(resolve(stage, 'package.json'), JSON.stringify({ ...manifest, ...(publicBeta ? { name: publishName, private: false, publishConfig: { registry: 'https://registry.npmjs.org/', access: 'public', tag: releaseTag(manifest.version) } } : {}), main: './' + relative + '/index.mjs',
  bin: Object.fromEntries(Object.entries(manifest.bin ?? {}).map(([name, path]) => [name, './' + relative + '/' + path.replace(/^\.\//, '')])),
  exports: { '.': './' + relative + '/index.mjs', './package.json': './package.json',
    './*.mjs': './' + relative + '/*.mjs', './vendor/*': './' + relative + '/vendor/*' },
  files: [relative, 'cordis.patch.yml', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md'], scripts: {} }, null, 2));
await writeFile(resolve(stage, 'cordis.patch.yml'), relocateExtensionPatch(sourcePatch, relative));
await writeFile(resolve(stage, 'README.md'), (await readFile(resolve(source, 'NPM_README.md'), 'utf8')).replaceAll('PUBLISH_PACKAGE_NAME', publishName ?? manifest.name));
const destination = resolve(root, '.local/extension-packages'); await mkdir(destination, { recursive: true });
const expectedTar = (publishName ?? manifest.name).replace('@', '').replace('/', '-') + '-' + manifest.version + '.tgz';
try { await lstat(resolve(destination, expectedTar)); throw Error('Refuse to overwrite existing version tarball'); } catch(error) { if(error.code !== 'ENOENT') throw error; }
const packed = JSON.parse(execFileSync('npm', ['pack', stage, '--pack-destination', destination, '--json'], { encoding: 'utf8' }))[0];
const path = resolve(destination, packed.filename);
const fixture = { path, sha256: sha(await readFile(path)), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), packageVersion: manifest.version, packageName: publishName ?? manifest.name, publicBeta, runtimePath: relative,
  implementation: Object.fromEntries(names.map(name => [name, sha(content[name])])) };
await writeFile(resolve(root, '.local/m5-fixed-bundle-fixture.json'), JSON.stringify(fixture));
console.log(JSON.stringify({ packed: true, version: manifest.version, runtimeIdentity: identity, files: packed.files.length }));
