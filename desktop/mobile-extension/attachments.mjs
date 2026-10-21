import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { AttachmentReader, AttachmentFault, RANGE_LIMIT, OBJECT_LIMIT, attachmentEngineSha256 } from './attachment-engine.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const implementation = Object.freeze({ entrySha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), engineSha256: attachmentEngineSha256,
  packageVersion: JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version });
export const name = 'mobile-attachments';
export const inject = ['attachments', 'sessionController', 'profileContext'];

export async function apply(ctx) {
  const require = createRequire(ctx.profileContext.installAnchor); const load = spec => import(pathToFileURL(require.resolve(spec)).href);
  const [protocol, connection, llm, mime] = await Promise.all([load('@deepseek-ai/dsh-typert-protocol'), load('@deepseek-ai/dsh-client-connection'), load('@deepseek-ai/dsh-llm'), load('mime-types')]);
  const reader = new AttachmentReader({ inspect: (sid, signal) => ctx.sessionController.inspect(sid, signal), provider: ctx.attachments, chunks: llm.assistantStreamChunks, mime: name => mime.default.lookup(name ?? '') });
  const active = new Set(); let stopping = false;
  ctx.effect(() => async () => { stopping = true; await Promise.allSettled([...active]); reader.verified.clear(); });
  const initializers = [];
  class MobileAttachments extends protocol.TypertRemoteService {
    constructor() { super(ctx, 'mobileAttachments'); for (const init of initializers) init.call(this); }
    operator() { if (!(this.ctx.invocation?.peer instanceof connection.OperatorPeer)) throw new protocol.RemoteError('access-denied', 'access-denied', {}); }
    async capabilities() { this.operator(); return { version: 1, sessionBound: true, maxRangeBytes: RANGE_LIMIT, maxObjectBytes: OBJECT_LIMIT, implementation }; }
    async read(method, request, signal) {
      this.operator(); if (stopping) throw new protocol.RemoteError('service-stopping', 'service-stopping', {});
      const pending = reader[method](request, signal); active.add(pending);
      try { return await pending; } catch (error) { if (error instanceof AttachmentFault) throw new protocol.RemoteError(error.code, error.code, {}); if (signal?.aborted) throw new protocol.RemoteError('gateway/cancelled', 'gateway/cancelled', {}); throw new protocol.RemoteError('attachment-unreadable', 'attachment-unreadable', {}); }
      finally { active.delete(pending); }
    }
    async stat(request, signal) { return this.read('stat', request, signal); }
    async readRange(request, signal) { return this.read('readRange', request, signal); }
  }
  for (const method of ['capabilities', 'stat', 'readRange']) protocol.Remote(MobileAttachments.prototype[method], { kind: 'method', name: method, static: false, private: false, addInitializer: init => initializers.push(init) });
  new MobileAttachments();
}
