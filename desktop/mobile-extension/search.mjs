import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { acquireSearchPolicy } from './search-policy.mjs';
import { lookupPrompt, PromptLookupFault } from './prompt-lookup.mjs';
import { searchWorkspace, WorkspaceSearchFault } from './workspace-search.mjs';
import { listWorkspace, WorkspaceListFault } from './workspace-list.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const implementation = Object.freeze({ entrySha256: sha(readFileSync(new URL(import.meta.url))),
  policySha256: sha(readFileSync(new URL('./search-policy.mjs', import.meta.url))), lookupSha256: sha(readFileSync(new URL('./prompt-lookup.mjs', import.meta.url))), workspaceSearchSha256: sha(readFileSync(new URL('./workspace-search.mjs', import.meta.url))), workspaceListSha256: sha(readFileSync(new URL('./workspace-list.mjs', import.meta.url))),
  packageVersion: JSON.parse(readFileSync(new URL('./package.json', import.meta.url))).version });
const controllerToken = Symbol.for('dsh-mobile-app.session-controller-continuity.v1');
export const name = 'mobile-search';
export const inject = ['sessionQuery', 'sessionController', 'workspaceRegistry', 'sessions', 'profileContext'];
export async function apply(ctx, config) {
  const require = createRequire(ctx.profileContext.installAnchor);
  const path = require.resolve('@deepseek-ai/dsh-session-query-sqlite');
  const queryModuleSha256 = sha(readFileSync(path));
  const load = spec => import(pathToFileURL(require.resolve(spec)).href);
  const [query, protocol, connection] = await Promise.all([import(pathToFileURL(path).href), load('@deepseek-ai/dsh-typert-protocol'), load('@deepseek-ai/dsh-client-connection')]);
  const engine = ctx.sessionQuery;
  if (!(engine instanceof query.default)) throw Error('mobile-search: incompatible query engine');
  const release = acquireSearchPolicy(engine, queryModuleSha256, config.expectedQueryHash);
  ctx.effect(() => release);
  const stop = new AbortController(); const active = new Set();
  ctx.effect(() => async () => { stop.abort(); await Promise.allSettled([...active]); });
  const controller = ctx.sessionController;
  if (!controller[controllerToken]) Object.defineProperty(controller, controllerToken, { value: randomUUID() });
  const initializers = [];
  class MobileSearch extends protocol.TypertRemoteService {
    constructor() { super(ctx, 'mobileSearch'); for (const init of initializers) init.call(this); }
    async capabilities() {
      if (!(this.ctx.invocation?.peer instanceof connection.OperatorPeer)) throw new protocol.RemoteError('access-denied', 'access-denied', {});
      return { version: 1, fullText: engine.config.openAt !== 'never', promptLookup: true, workspaceSearch: true, workspaceList: true, queryModuleSha256,
        readiness: engine.config.openAt, controllerContinuityToken: controller[controllerToken], implementation };
    }
    async lookupPrompt(request, signal) {
      if (!(this.ctx.invocation?.peer instanceof connection.OperatorPeer)) throw new protocol.RemoteError('access-denied', 'access-denied', {});
      if (stop.signal.aborted) throw new protocol.RemoteError('service-stopping', 'service-stopping', {});
      if (active.size >= 4) throw new protocol.RemoteError('lookup-busy', 'lookup-busy', {});
      const combined = AbortSignal.any([stop.signal, AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]);
      const pending = lookupPrompt((sid, cancel) => ctx.sessionController.inspect(sid, cancel), request, combined); active.add(pending);
      try { return await pending; }
      catch (error) {
        if (error instanceof PromptLookupFault) throw new protocol.RemoteError(error.code, error.code, {});
        if (combined.aborted) throw new protocol.RemoteError('lookup-cancelled', 'lookup-cancelled', {});
        throw new protocol.RemoteError('lookup-unavailable', 'lookup-unavailable', {});
      } finally { active.delete(pending); }
    }
    async listWorkspace(request, signal) {
      if (!(this.ctx.invocation?.peer instanceof connection.OperatorPeer)) throw new protocol.RemoteError('access-denied', 'access-denied', {});
      if (stop.signal.aborted) throw new protocol.RemoteError('service-stopping', 'service-stopping', {});
      if (active.size >= 4) throw new protocol.RemoteError('list-busy', 'list-busy', {});
      if (typeof controller.listState?.summaryFor !== 'function' || typeof controller.listState?.summarizeCold !== 'function') throw new protocol.RemoteError('list-unavailable', 'list-unavailable', {});
      const combined = AbortSignal.any([stop.signal, AbortSignal.timeout(30_000), ...(signal ? [signal] : [])]);
      const pending = listWorkspace(ctx.workspaceRegistry, engine, ctx.sessions, controller.listState, request, combined); active.add(pending);
      try { return await pending; }
      catch (error) { if (error instanceof WorkspaceListFault) throw new protocol.RemoteError(error.code, error.code, {}); if (combined.aborted) throw new protocol.RemoteError('list-cancelled', 'list-cancelled', {}); throw new protocol.RemoteError('list-unavailable', 'list-unavailable', {}); }
      finally { active.delete(pending); }
    }
    async searchWorkspace(request, signal) {
      if (!(this.ctx.invocation?.peer instanceof connection.OperatorPeer)) throw new protocol.RemoteError('access-denied', 'access-denied', {});
      if (stop.signal.aborted) throw new protocol.RemoteError('service-stopping', 'service-stopping', {});
      if (active.size >= 4) throw new protocol.RemoteError('search-busy', 'search-busy', {});
      const combined = AbortSignal.any([stop.signal, AbortSignal.timeout(30_000), ...(signal ? [signal] : [])]);
      const pending = searchWorkspace(ctx.workspaceRegistry, engine, request, combined); active.add(pending);
      try { return await pending; }
      catch (error) { if (error instanceof WorkspaceSearchFault) throw new protocol.RemoteError(error.code, error.code, {}); if (combined.aborted) throw new protocol.RemoteError('search-cancelled', 'search-cancelled', {}); throw new protocol.RemoteError('search-unavailable', 'search-unavailable', {}); }
      finally { active.delete(pending); }
    }
  }
  for (const method of ['capabilities', 'lookupPrompt', 'searchWorkspace', 'listWorkspace']) protocol.Remote(MobileSearch.prototype[method], { kind: 'method', name: method, static: false, private: false, addInitializer: init => initializers.push(init) });
  new MobileSearch();
}
