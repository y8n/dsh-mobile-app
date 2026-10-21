export class WorkspaceSearchFault extends Error { constructor(code) { super(code); this.code = code; } }
export async function searchWorkspace(registry, engine, request, signal) {
  if (!request || typeof request.workspaceId !== 'string' || !request.workspaceId || request.workspaceId.length > 128
      || typeof request.query !== 'string' || !request.query.trim() || request.query.trim().length > 500 || request.query.includes('\0')
      || typeof request.archived !== 'boolean' || Object.keys(request).some(k => !['workspaceId', 'query', 'archived'].includes(k))) throw new WorkspaceSearchFault('invalid-request');
  const scope = () => {
    const workspace = registry.get(request.workspaceId);
    if (!workspace) throw new WorkspaceSearchFault('workspace/not-found');
    if (!Array.isArray(workspace.sessionIds) || !Array.isArray(registry.archivedSessionIds)) throw new WorkspaceSearchFault('search-unavailable');
    const archived = new Set(registry.archivedSessionIds);
    return [...new Set(workspace.sessionIds)].filter(id => archived.has(id) === request.archived).sort();
  };
  const ids = scope(); const limit = Math.min(20, engine.config.maxLimit);
  if (!Number.isSafeInteger(limit) || limit < 1) throw new WorkspaceSearchFault('search-unavailable');
  if (ids.length > 30_000) throw new WorkspaceSearchFault('search-scope-limit');
  signal?.throwIfAborted();
  if (!ids.length) return { items: [], hasMore: false, limit, workspaceId: request.workspaceId, archived: request.archived };
  const page = await engine.searchSessions({ query: request.query.trim(), sessionFilters: [{ kind: 'id', values: ids }],
    eventFilters: [{ kind: 'type', values: ['user/message', 'assistant/message'] }, { kind: 'surface', values: ['current'] }], limit }, { signal });
  signal?.throwIfAborted();
  if (JSON.stringify(scope()) !== JSON.stringify(ids)) throw new WorkspaceSearchFault('search-scope-changed');
  if (!Array.isArray(page.items) || page.items.length > limit) throw new WorkspaceSearchFault('invalid-search-response');
  const allowed = new Set(ids), seen = new Set();
  const items = page.items.map(hit => {
    const id = hit.header?.id, match = hit.bestMatch;
    if (!allowed.has(id) || seen.has(id) || match?.sessionId !== id || match.surface !== 'current'
        || !['user/message', 'assistant/message'].includes(match.type) || typeof match.snippet !== 'string') throw new WorkspaceSearchFault('invalid-search-response');
    seen.add(id); return { sessionId: id, snippet: [...match.snippet].slice(0, 240).join('') };
  });
  return { items, hasMore: page.nextCursor !== undefined, limit, workspaceId: request.workspaceId, archived: request.archived };
}
