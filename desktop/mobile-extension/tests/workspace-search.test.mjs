import test from 'node:test';
import assert from 'node:assert/strict';
import { searchWorkspace } from '../workspace-search.mjs';
const request = { workspaceId: 'w', query: ' word ', archived: false };
const registry = () => ({ get: id => id === 'w' ? { sessionIds: ['active', 'archived'] } : undefined, archivedSessionIds: ['archived'] });
const hit = id => ({ header: { id }, bestMatch: { sessionId: id, surface: 'current', type: 'user/message', snippet: 'word' } });
test('workspace and archive filtering occurs before relevance ranking and result cap', async () => {
  let sent; const engine = { config: { maxLimit: 100 }, searchSessions: async query => { sent = query; return { items: [hit(query.sessionFilters[0].values[0])], nextCursor: 'more' }; } };
  const result = await searchWorkspace(registry(), engine, request); assert.deepEqual(sent.sessionFilters, [{ kind: 'id', values: ['active'] }]); assert.equal(sent.query, 'word'); assert.equal(sent.limit, 20); assert.equal(result.hasMore, true);
  await searchWorkspace(registry(), engine, { ...request, archived: true }); assert.deepEqual(sent.sessionFilters[0].values, ['archived']);
});
test('configured lower cap and Unicode snippet boundary are preserved', async () => {
  const value = hit('active'); value.bestMatch.snippet = '😀'.repeat(300);
  const result = await searchWorkspace(registry(), { config: { maxLimit: 5 }, searchSessions: async query => { assert.equal(query.limit, 5); return { items: [value] }; } }, request);
  assert.equal(result.limit, 5); assert.equal([...result.items[0].snippet].length, 240); assert.equal(result.hasMore, false);
});
test('empty scope never performs an unfiltered global search', async () => {
  const r = registry(); r.get = () => ({ sessionIds: [] });
  const result = await searchWorkspace(r, { config: { maxLimit: 100 }, searchSessions: () => assert.fail('global search') }, request); assert.deepEqual(result.items, []);
});
test('membership change during search rejects the stale observation', async () => {
  const r = registry(); await assert.rejects(searchWorkspace(r, { config: { maxLimit: 100 }, searchSessions: async () => { r.archivedSessionIds.push('active'); return { items: [hit('active')] }; } }, request), /search-scope-changed/);
});
test('foreign hits, duplicates and cancellation fail closed', async () => {
  for (const items of [[hit('other')], [hit('active'), hit('active')]]) await assert.rejects(searchWorkspace(registry(), { config: { maxLimit: 100 }, searchSessions: async () => ({ items }) }, request), /invalid-search-response/);
  const cancel = new AbortController(); cancel.abort(); await assert.rejects(searchWorkspace(registry(), { config: { maxLimit: 100 }, searchSessions: () => assert.fail('must not search') }, request, cancel.signal));
});
