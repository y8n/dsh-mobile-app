import test from 'node:test';
import assert from 'node:assert/strict';
import { listWorkspace } from '../workspace-list.mjs';
function fixture(count = 205) {
  const ids = Array.from({ length: count }, (_, i) => `session-${String(i).padStart(4, '0')}`);
  const workspace = { sessionIds: ids }; const read = [];
  const registry = { get: id => id === 'own' ? workspace : undefined };
  const engine = { listSessions: async () => [...ids, 'foreign'].map(id => ({ header: { id, cwd: '/owned' } })) };
  const summaries = { summarizeCold: ({ header }) => { read.push(header.id); return { sessionId: header.id, running: false, blank: false, updatedAt: 1, projections: { values: { title: header.id, body: 'x'.repeat(3 * 1024 * 1024) } } }; } };
  return { ids, workspace, read, registry, engine, summaries, sessions: new Map() };
}
const list = (f, request, signal) => listWorkspace(f.registry, f.engine, f.sessions, f.summaries, request, signal);
test('205 workspace summaries paginate exactly once and never read foreign projections or return bodies', async () => {
  const f = fixture(); const rows = []; let cursor;
  do { const page = await list(f, { workspaceId: 'own', ...(cursor ? { cursor } : {}) }); assert.ok(Buffer.byteLength(JSON.stringify(page)) < 32_000); assert.ok(page.items.length <= 100); rows.push(...page.items); cursor = page.nextCursor; } while (cursor);
  assert.deepEqual(rows.map(r => r.sessionId), f.ids); assert.deepEqual(f.read, f.ids);
  assert.ok(rows.every(r => !('projections' in r))); assert.equal(new Set(f.read).size, 205);
});
test('membership changes invalidate an earlier cursor rather than silently skipping or mixing pages', async () => {
  const f = fixture(); const first = await list(f, { workspaceId: 'own' }); f.workspace.sessionIds = f.ids.slice(1);
  await assert.rejects(list(f, { workspaceId: 'own', cursor: first.nextCursor }), { code: 'list-scope-changed' });
});
test('membership changes during a read invalidate the entire page', async () => {
  const f = fixture(); const original = f.engine.listSessions;
  f.engine.listSessions = async () => { const rows = await original(); f.workspace.sessionIds = []; return rows; };
  await assert.rejects(list(f, { workspaceId: 'own' }), { code: 'list-scope-changed' });
});
test('malformed requests, foreign workspace and out-of-range cursor fail closed', async () => {
  const f = fixture();
  await assert.rejects(list(f, { workspaceId: 'other' }), { code: 'workspace/not-found' });
  await assert.rejects(list(f, { workspaceId: 'own', extra: true }), { code: 'invalid-request' });
  await assert.rejects(list(f, { workspaceId: 'own', cursor: '{' }), { code: 'invalid-cursor' });
  const first = await list(f, { workspaceId: 'own' }); const cursor = JSON.parse(Buffer.from(first.nextCursor, 'base64url'));
  cursor.offset = -1;
  await assert.rejects(list(f, { workspaceId: 'own', cursor: Buffer.from(JSON.stringify(cursor)).toString('base64url') }), { code: 'invalid-cursor' });
});
test('empty scope avoids a global query and cancellation reads no projections', async () => {
  const f = fixture(0); f.engine.listSessions = () => { throw Error('unexpected global read'); };
  assert.deepEqual((await list(f, { workspaceId: 'own' })).items, []);
  const cancel = new AbortController(); cancel.abort(); const g = fixture();
  await assert.rejects(list(g, { workspaceId: 'own' }, cancel.signal)); assert.equal(g.read.length, 0);
});
