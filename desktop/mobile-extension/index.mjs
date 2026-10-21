import { registerNotifications } from './notification-feed.mjs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MobileScheduleEngine, ScheduleFault, engineSha256 } from './schedule-engine.mjs';
import { sessionLineage, assertUnarchived, admissionSha256 } from './session-admission.mjs';
const implementation = Object.freeze({ entrySha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), engineSha256, admissionSha256,
  packageVersion: JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version });
export const name = 'mobile-schedule';
export const inject = ['schedule', 'storageDomain', 'sessionController', 'sessions', 'workspaceRegistry', 'profileContext'];

/** Version-pinned adapter: the existing Schedule service has no public lifecycle
 * transaction API. Private bridge access is explicitly guarded by the installed
 * module SHA and runtime shape; unknown builds fail closed instead of guessing.
 * No normal profile is changed by importing this package.
 */
export async function apply(ctx, config) {
  const require = createRequire(ctx.profileContext.installAnchor);
  const schedulePath = require.resolve('@deepseek-ai/dsh-schedule');
  const actualHash = createHash('sha256').update(await readFile(schedulePath)).digest('hex');
  if (!/^[a-f0-9]{64}$/.test(config?.expectedScheduleHash ?? '') || config.expectedScheduleHash !== actualHash) throw new Error('mobile-schedule: unsupported schedule module hash');
  const load = spec => import(pathToFileURL(require.resolve(spec)).href);
  const [protocol, storage, schedule, llm, schema, connection] = await Promise.all([
    load('@deepseek-ai/dsh-typert-protocol'), load('@deepseek-ai/dsh-storage-domain'), load('@deepseek-ai/dsh-schedule'),
    load('@deepseek-ai/dsh-llm'), load('zod'), load('@deepseek-ai/dsh-client-connection')]);
  const original = ctx.schedule;
  for (const method of ['serialize', 'getDomain', 'emitChanged', 'history']) if (typeof original[method] !== 'function') throw new Error('mobile-schedule: incompatible schedule bridge');
  const domain = await original.getDomain();
  const z = schema.z;
  const entrySchema = z.object({ operation: z.enum(['create', 'update', 'delete', 'pause', 'resume', 'runNow']), digest: z.string().regex(/^[a-f0-9]{64}$/), sessionId: z.string().min(1), phase: z.enum(['prepared', 'delivered', 'committed']), id: z.string().min(1), before: z.unknown().optional(), after: z.unknown().optional(), control: z.unknown().optional(), message: z.unknown().optional(), prompt: z.string().optional(), requestedAt: z.string().optional(), deliveryId: z.string().optional(), receipt: z.unknown().optional(), result: z.unknown().optional() }).strict();
  const ledger = await ctx.storageDomain.open(storage.defineDomain({ name: 'mobile_schedule', version: 1, tables: {
    requests: storage.domainTable(entrySchema), controls: storage.domainTable(z.object({ paused: z.boolean(), recordHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict()) } }));
  const active = new Set(); let stopping = false;
  ctx.effect(() => async () => { stopping = true; await Promise.allSettled([...active]); await ledger.close(); });
  async function track(work) {
    if (stopping) throw new protocol.RemoteError('service-stopping', 'service-stopping', {});
    const pending = Promise.resolve().then(work); active.add(pending);
    try { return await pending; } finally { active.delete(pending); }
  }
  function remoteFault(error) {
    if (error instanceof ScheduleFault) return new protocol.RemoteError(error.code, error.code, {});
    if (['invalid_prompt', 'invalid_selector', 'invalid_rule', 'invalid_time_zone', 'not_future', 'time_out_of_range', 'frequency_too_high'].includes(error?.code)) return new protocol.RemoteError(error.code, error.code, {});
    return error;
  }
  const lineages = new WeakMap();
  const lineage = sid => sessionLineage(id => ctx.sessionController.inspect(id), sid);
  const core = {
    tasks: domain.table('tasks'), retention: original.retention,
    serialize: work => original.serialize(work), inspect: sid => ctx.sessionController.inspect(sid),
    changed: () => { original.emitChanged(); original.runtime?.requestDrive(); },
    assertRunnable: async sid => assertUnarchived(await lineage(sid), ctx.workspaceRegistry.archivedSessionIds),
    resolve: async sid => { const result = await ctx.sessionController.resolveAgent(sid); if ('error' in result) throw new ScheduleFault('session-unavailable'); lineages.set(result.agent, await lineage(sid)); return result.agent; },
    hasMessage: (agent, mid) => agent.session.snapshotEvents().some(e => e.type === 'agent/inbox/spliced' && e.data.inserted.some(m => m.id === mid)),
    send: (agent, message) => { const chain = lineages.get(agent); if (!chain) throw new ScheduleFault('session-unavailable'); assertUnarchived(chain, ctx.workspaceRegistry.archivedSessionIds); agent.followup(message); }, flush: agent => ctx.sessions.flush(agent.session),
    history: request => original.history(request),
  };
  const helpers = {
    title: schedule.scheduleTitle, decode: schedule.decodeScheduleRecord, recurring: schedule.isRecurringScheduleRecord, occurrence: schedule.resolveRecurringOccurrence,
    message: record => llm.createUserMessage({ content: [{ type: 'text', text: '[手动立即投递 · ' + record.id + ']\n' + schedule.renderReminderFraming(record) }], source: { kind: 'schedule' } }),
    create: (id, definition, now) => {
      if (!definition || typeof definition !== 'object') throw new ScheduleFault('invalid-request');
      const title = schedule.scheduleTitle(definition.title);
      const fields = ['after_seconds', 'at', 'every_seconds', 'daily', 'weekly', 'cron'].filter(k => definition[k] !== undefined);
      if (fields.length !== 1) throw new ScheduleFault('invalid-selector');
      const names = { after_seconds: 'createAfterScheduleRecord', at: 'createAtScheduleRecord', every_seconds: 'createEveryScheduleRecord', daily: 'createDailyScheduleRecord', weekly: 'createWeeklyScheduleRecord', cron: 'createCronScheduleRecord' };
      return schedule[names[fields[0]]](id, definition.prompt, definition[fields[0]], now, title);
    },
  };
  const engine = new MobileScheduleEngine(core, { requests: ledger.table('requests'), controls: ledger.table('controls') }, helpers);
  const initializers = [];
  class MobileScheduleService extends protocol.TypertRemoteService {
    constructor() { super(ctx, 'mobileSchedule'); for (const initialize of initializers) initialize.call(this); }
    operator() { if (!(this.ctx.invocation?.peer instanceof connection.OperatorPeer)) throw new protocol.RemoteError('access-denied', 'Operator admission is required', {}); }
    async call(operation, request) { this.operator(); return track(async () => { try { return await engine.operate(operation, request); } catch (error) { throw remoteFault(error); } }); }
    async capabilities() { this.operator(); return { version: 1, scheduleModuleSha256: actualHash, lifecycle: true, durableRequestIdentity: true, archiveAdmission: true, implementation }; }
    async catalog() { this.operator(); return track(() => engine.catalog()); }
    async create(request) { return this.call('create', request); }
    async update(request) { return this.call('update', request); }
    async delete(request) { return this.call('delete', request); }
    async pause(request) { return this.call('pause', request); }
    async resume(request) { return this.call('resume', request); }
    async runNow(request) { return this.call('runNow', request); }
    async history(request) { this.operator(); return track(async () => { try { return await engine.history(request); } catch (error) { throw remoteFault(error); } }); }
  }
  // Use the exported standard-decorator API without a runtime compiler.
  for (const method of ['capabilities', 'catalog', 'create', 'update', 'delete', 'pause', 'resume', 'runNow', 'history']) {
    protocol.Remote(MobileScheduleService.prototype[method], { kind: 'method', name: method, static: false, private: false,
      addInitializer: initialize => initializers.push(initialize) });
  }
  new MobileScheduleService();
  await registerNotifications(ctx, { protocol, connection, storage, schema });
}
