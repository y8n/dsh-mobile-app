import { createHash } from 'node:crypto';
export class WorkspaceListFault extends Error { constructor(code) { super(code); this.code = code; } }
/** Summaries only: page within the current workspace before reading projections. */
export async function listWorkspace(registry, engine, sessions, summaries, request, signal) {
  if (!request || typeof request.workspaceId !== 'string' || !request.workspaceId || request.workspaceId.length > 128
      || (request.cursor !== undefined && (typeof request.cursor !== 'string' || request.cursor.length > 256))
      || Object.keys(request).some(k => !['workspaceId', 'cursor'].includes(k))) throw new WorkspaceListFault('invalid-request');
  const scope = () => {
    const workspace = registry.get(request.workspaceId);
    if (!workspace) throw new WorkspaceListFault('workspace/not-found');
    if (!Array.isArray(workspace.sessionIds)) throw new WorkspaceListFault('list-unavailable');
    const ids = [...new Set(workspace.sessionIds)].sort();
    if (ids.length > 30_000 || ids.some(id => typeof id !== 'string' || id.length > 128)) throw new WorkspaceListFault('list-scope-limit');
    return ids;
  };
  const ids = scope(); const fingerprint = createHash('sha256').update(JSON.stringify([request.workspaceId, ids])).digest('hex');
  let offset = 0;
  if (request.cursor !== undefined) {
    let cursor; try { cursor = JSON.parse(Buffer.from(request.cursor, 'base64url').toString('utf8')); } catch { throw new WorkspaceListFault('invalid-cursor'); }
    if (cursor?.scope !== fingerprint) throw new WorkspaceListFault('list-scope-changed');
    if (!Number.isSafeInteger(cursor.offset) || cursor.offset <= 0 || cursor.offset >= ids.length || cursor.offset % 100 !== 0) throw new WorkspaceListFault('invalid-cursor');
    offset = cursor.offset;
  }
  signal?.throwIfAborted();
  const allowed = new Set(ids.slice(offset, offset + 100));
  const records = allowed.size ? await engine.listSessions(signal) : [];
  const items = [];
  for (const record of records) {
    const id = record.header?.id;
    if (!allowed.has(id)) continue;
    allowed.delete(id);
    const live = sessions.get(id);
    if (!live && record.header.cwd === undefined) continue;
    const summary = live ? summaries.summaryFor(live) : summaries.summarizeCold(record);
    const title = summary.title ?? summary.projections?.values?.title;
    items.push({ sessionId: id, title: typeof title === 'string' ? [...title].slice(0, 512).join('') : null,
      running: summary.running === true, blank: summary.blank === true,
      updatedAt: Number.isSafeInteger(summary.updatedAt) ? summary.updatedAt : 0 });
  }
  signal?.throwIfAborted();
  if (JSON.stringify(scope()) !== JSON.stringify(ids)) throw new WorkspaceListFault('list-scope-changed');
  const next = offset + 100;
  return { workspaceId: request.workspaceId, items, nextCursor: next < ids.length ? Buffer.from(JSON.stringify({ scope: fingerprint, offset: next })).toString('base64url') : null };
}
