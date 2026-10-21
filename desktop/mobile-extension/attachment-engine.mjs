import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
export const attachmentEngineSha256 = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');

export const RANGE_LIMIT = 256 * 1024;
export const OBJECT_LIMIT = 512 * 1024 * 1024;
export class AttachmentFault extends Error { constructor(code) { super(code); this.code = code; } }
const fail = code => { throw new AttachmentFault(code); };
const hash = value => createHash('sha256').update(value).digest('hex');
const aborted = signal => signal?.throwIfAborted();

/** Only first-party declared message content fields confer reachability.
 * Unknown events and arbitrary nested metadata never authorize an object.
 */
export function eventContent(event, chunks = () => []) {
  const d = event.data ?? {};
  const stream = Array.isArray(d.stream) ? d.stream : [];
  switch (event.type) {
    case 'user/message': case 'tool/ptc-dispatch': return [d.content];
    case 'system/message': case 'developer/message': case 'tool/result': case 'team/message/queued': return [d.message?.content];
    case 'agent/inbox/spliced': return Array.isArray(d.inserted) ? d.inserted.map(m => m?.content) : [];
    case 'compaction/summary': return [d.summary, d.rawOutput];
    case 'assistant/message': return [d.message?.content, ...[...chunks(stream, 'block-end')].map(c => [c.block])];
    case 'assistant/attempt': return [...chunks(stream, 'block-end')].map(c => [c.block]);
    default: return [];
  }
}
export function findReference(events, request, chunks) {
  for (const event of events) for (const content of eventContent(event, chunks)) {
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || !['image', 'file'].includes(part.type) || !part.attachment || typeof part.attachment !== 'object') continue;
      const ref = part.attachment;
      if (ref.attachmentId === request.attachmentId && (!request.kind || request.kind === part.type) && (!request.name || request.name === ref.name)) return { kind: part.type, ref };
    }
  }
  fail('attachment-not-referenced');
}
function validate(request, range) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) fail('invalid-request');
  const keys = range ? ['sessionId', 'attachmentId', 'kind', 'name', 'version', 'offset', 'length'] : ['sessionId', 'attachmentId', 'kind', 'name'];
  if (Object.keys(request).some(k => !keys.includes(k))) fail('invalid-request');
  if (typeof request.sessionId !== 'string' || !request.sessionId.trim() || request.sessionId.length > 160 || request.sessionId.includes('\0')) fail('invalid-request');
  if (!/^sha256:[a-f0-9]{64}$/.test(request.attachmentId ?? '')) fail('invalid-attachment-id');
  if (request.kind !== undefined && !['image', 'file'].includes(request.kind)) fail('invalid-request');
  if (request.name !== undefined && (typeof request.name !== 'string' || request.name.length > 512 || /[\0/\\]/.test(request.name))) fail('invalid-request');
  if (range && (!/^[a-f0-9]{64}$/.test(request.version ?? '') || !Number.isSafeInteger(request.offset) || request.offset < 0 || !Number.isSafeInteger(request.length) || request.length < 1 || request.length > RANGE_LIMIT)) fail('invalid-range');
}
function fingerprint(path, ref, stat) {
  return hash(JSON.stringify([path, ref.attachmentId, ref.bytes, String(stat.dev), String(stat.ino), String(stat.size), String(stat.mtimeNs), String(stat.ctimeNs)]));
}

/** Bounded reads from a provider-selected immutable object. A full digest is
 * verified before returning any range; subsequent reads reuse only the exact
 * inode/size/mtime/ctime fingerprint. Every read rechecks reachability and fstat.
 */
export class AttachmentReader {
  verified = new Map();
  constructor({ inspect, provider, chunks, mime }) { this.inspect = inspect; this.provider = provider; this.chunks = chunks; this.mime = mime; }
  async object(request, signal) {
    aborted(signal);
    let source;
    try { source = await this.inspect(request.sessionId, signal); } catch { aborted(signal); fail('session-unavailable'); }
    const { kind, ref } = findReference(source.events, request, this.chunks);
    if (!Number.isSafeInteger(ref.bytes) || ref.bytes < 0 || (kind === 'image' && !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(ref.mediaType))) fail('invalid-attachment-ref');
    const path = kind === 'image' ? this.provider.imageHostPath(ref) : this.provider.fileHostPath(ref);
    if (typeof path !== 'string' || !isAbsolute(path)) fail('attachment-storage-unsupported');
    let file;
    try { file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0)); }
    catch (error) { if (error.code === 'ENOENT') fail('attachment-missing'); fail('attachment-unreadable'); }
    try {
      const stat = await file.stat({ bigint: true });
      if (!stat.isFile() || stat.size !== BigInt(ref.bytes)) fail('attachment-integrity');
      if (ref.bytes > OBJECT_LIMIT) fail('attachment-too-large');
      const version = fingerprint(path, ref, stat);
      if (!this.verified.has(version)) {
        const digest = createHash('sha256'); const buffer = Buffer.alloc(RANGE_LIMIT); let offset = 0;
        while (offset < ref.bytes) {
          aborted(signal); const got = await file.read(buffer, 0, Math.min(buffer.length, ref.bytes - offset), offset);
          if (!got.bytesRead) fail('attachment-integrity'); digest.update(buffer.subarray(0, got.bytesRead)); offset += got.bytesRead;
        }
        if ('sha256:' + digest.digest('hex') !== ref.attachmentId || fingerprint(path, ref, await file.stat({ bigint: true })) !== version) fail('attachment-integrity');
        this.verified.set(version, true); if (this.verified.size > 64) this.verified.delete(this.verified.keys().next().value);
      }
      aborted(signal);
      return { file, path, ref, kind, version };
    } catch (error) { await file.close(); throw error; }
  }
  metadata(object) {
    return { attachmentId: object.ref.attachmentId, kind: object.kind, name: object.ref.name ?? 'image', bytes: object.ref.bytes,
      mediaType: object.kind === 'image' ? object.ref.mediaType : this.mime(object.ref.name) || 'application/octet-stream', version: object.version, maxRangeBytes: RANGE_LIMIT };
  }
  async stat(request, signal) {
    validate(request, false); const object = await this.object(request, signal);
    try { return this.metadata(object); } finally { await object.file.close(); }
  }
  async readRange(request, signal) {
    validate(request, true); const object = await this.object(request, signal);
    try {
      if (object.version !== request.version) fail('attachment-version-changed');
      if (request.offset > object.ref.bytes) fail('invalid-range');
      const length = Math.min(request.length, object.ref.bytes - request.offset); const buffer = Buffer.alloc(length); let got = 0;
      while (got < length) { aborted(signal); const next = await object.file.read(buffer, got, length - got, request.offset + got); if (!next.bytesRead) fail('attachment-integrity'); got += next.bytesRead; }
      if (fingerprint(object.path, object.ref, await object.file.stat({ bigint: true })) !== object.version) fail('attachment-version-changed');
      aborted(signal);
      return { version: object.version, offset: request.offset, bytes: got, eof: request.offset + got === object.ref.bytes, data: buffer.toString('base64') };
    } finally { await object.file.close(); }
  }
}
