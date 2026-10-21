import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, symlink, utimes, truncate } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { AttachmentReader, findReference, RANGE_LIMIT, OBJECT_LIMIT } from '../attachment-engine.mjs';

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-attachment-test-'));
  const bytes = Buffer.alloc(RANGE_LIMIT * 2 + 47, 73); const id = 'sha256:' + createHash('sha256').update(bytes).digest('hex');
  const ref = { attachmentId: id, bytes: bytes.length, name: 'owned.md' }; const path = join(root, 'object'); await writeFile(path, bytes);
  const events = [{ type: 'agent/inbox/spliced', data: { inserted: [{ content: [{ type: 'file', attachment: ref }] }] } }];
  const reader = new AttachmentReader({ inspect: async sid => ({ events: sid === 'owner' ? events : [] }), provider: { fileHostPath: () => path }, chunks: () => [], mime: () => 'text/markdown' });
  const request = { sessionId: 'owner', attachmentId: id, kind: 'file', name: 'owned.md' };
  try { await run({ root, path, bytes, ref, events, reader, request }); } finally { await rm(root, { recursive: true, force: true }); }
}
test('authorized bounded ranges reconstruct original bytes; metadata never exposes host paths', async () => fixture(async ({ bytes, reader, request }) => {
  const metadata = await reader.stat(request); assert.equal(metadata.bytes, bytes.length); assert.equal(metadata.mediaType, 'text/markdown'); assert.equal(metadata.path, undefined);
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += RANGE_LIMIT) {
    const value = await reader.readRange({ ...request, version: metadata.version, offset, length: RANGE_LIMIT }); chunks.push(Buffer.from(value.data, 'base64')); assert.ok(value.bytes <= RANGE_LIMIT);
  }
  assert.deepEqual(Buffer.concat(chunks), bytes);
  const eof = await reader.readRange({ ...request, version: metadata.version, offset: bytes.length, length: 1 }); assert.equal(eof.data, ''); assert.equal(eof.eof, true);
}));
test('another session, invented metadata and client-specified paths never authorize a stored object', async () => fixture(async ({ reader, request, ref }) => {
  await assert.rejects(reader.stat({ ...request, sessionId: 'other' }), e => e.code === 'attachment-not-referenced');
  await assert.rejects(reader.stat({ ...request, path: '/private/file' }), e => e.code === 'invalid-request');
  assert.throws(() => findReference([{ type: 'unknown/plugin', data: { nested: { content: [{ type: 'file', attachment: ref }] } } }], request), e => e.code === 'attachment-not-referenced');
}));
test('corruption cannot be returned even with the old claimed digest', async () => fixture(async ({ reader, request, bytes, path }) => {
  await reader.stat(request); const corrupted = Buffer.from(bytes); corrupted[0] = 74; await writeFile(path, corrupted);
  await assert.rejects(reader.stat(request), e => e.code === 'attachment-integrity');
}));
test('changed object fingerprint refuses an old version before range delivery', async () => fixture(async ({ reader, request, path }) => {
  const metadata = await reader.stat(request); await utimes(path, new Date('2020-01-01'), new Date('2020-01-01'));
  await assert.rejects(reader.readRange({ ...request, version: metadata.version, offset: 0, length: 8 }), e => e.code === 'attachment-version-changed');
}));
test('invalid boundaries and cancelled requests are rejected', async () => fixture(async ({ reader, request }) => {
  const metadata = await reader.stat(request);
  for (const change of [{ offset: -1, length: 8 }, { offset: 0, length: RANGE_LIMIT + 1 }, { offset: metadata.bytes + 1, length: 8 }]) await assert.rejects(reader.readRange({ ...request, version: metadata.version, ...change }), e => e.code === 'invalid-range');
  const controller = new AbortController(); controller.abort(Error('owned cancellation'));
  await assert.rejects(reader.stat(request, controller.signal), /owned cancellation/);
}));
test('a file symlink is not followed', async () => fixture(async ({ reader, request, path, root }) => {
  await rm(path); await writeFile(join(root, 'other'), 'private'); await symlink(join(root, 'other'), path);
  await assert.rejects(reader.stat(request), e => e.code === 'attachment-unreadable');
}));
test('image content uses the image provider and cannot be read as a file', async () => fixture(async ({ path, bytes, ref }) => {
  const image = { ...ref, name: undefined, mediaType: 'image/png' };
  let imagePaths = 0;
  const reader = new AttachmentReader({ inspect: async () => ({ events: [{ type: 'user/message', data: { content: [{ type: 'image', attachment: image }] } }] }),
    provider: { imageHostPath: () => { imagePaths++; return path; }, fileHostPath: () => { throw Error('wrong provider'); } }, mime: () => 'application/octet-stream' });
  const selector = { sessionId: 'owner', attachmentId: ref.attachmentId, kind: 'image' };
  const stat = await reader.stat(selector); assert.equal(stat.mediaType, 'image/png'); assert.equal(stat.name, 'image');
  const range = await reader.readRange({ ...selector, version: stat.version, offset: 0, length: 32 }); assert.deepEqual(Buffer.from(range.data, 'base64'), bytes.subarray(0, 32)); assert.equal(imagePaths, 2);
  await assert.rejects(reader.stat({ ...selector, kind: 'file' }), e => e.code === 'attachment-not-referenced');
}));
test('oversized stored objects are refused before hashing or returning bytes', async () => fixture(async ({ reader, request, ref, path }) => {
  await truncate(path, OBJECT_LIMIT + 1); ref.bytes = OBJECT_LIMIT + 1;
  await assert.rejects(reader.stat(request), e => e.code === 'attachment-too-large'); assert.equal(reader.verified.size, 0);
}));
test('cancellation after authorization does not populate the verified cache', async () => fixture(async ({ reader, request, path }) => {
  const controller = new AbortController(); reader.provider.fileHostPath = () => { controller.abort(Error('cancel after authorization')); return path; };
  await assert.rejects(reader.stat(request, controller.signal), /cancel after authorization/); assert.equal(reader.verified.size, 0);
}));
test('an assistant message without packed stream does not hide a later authorized reference', async () => fixture(async ({ reader, request, events }) => {
  events.unshift({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'earlier reply' }] } } });
  reader.chunks = records => records.filter(record => record.type === 'block-end');
  const stat = await reader.stat(request); assert.equal(stat.attachmentId, request.attachmentId);
}));
