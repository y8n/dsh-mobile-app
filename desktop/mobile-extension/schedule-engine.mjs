import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
export const engineSha256 = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');

export class ScheduleFault extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const fail = code => { throw new ScheduleFault(code); };
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 160 && value.trim() === value;

/** The adapter shares the real Schedule FIFO and authoritative task table.
 * Journal entries land before writes. A replay never creates another task/message.
 * Pausing changes the actual task status consumed by ScheduleRuntime, preserving its row.
 */
export class MobileScheduleEngine {
  constructor(core, ledger, helpers) { this.core = core; this.ledger = ledger; this.helpers = helpers; }
  control(task) { return this.ledger.controls.get(task.record.id); }
  view(task) {
    const control = this.control(task);
    const paused = control?.paused === true && control.recordHash === digest(task.record) && task.status === 'inactive';
    return { ...task.record, sessionId: task.sessionId, status: paused ? 'paused' : task.status,
      version: digest({ task, control: control ?? null }), nextTrigger: !paused && task.status === 'active' ? task.record.scheduledAt : null,
      ...(task.lastDelivery ? { lastDelivery: task.lastDelivery } : {}) };
  }
  async catalog() { return this.core.serialize(async () => [...this.core.tasks.entries()].map(([, task]) => this.view(task))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id))); }
  current(request) {
    const task = this.core.tasks.get(request.id);
    if (!task || task.sessionId !== request.sessionId) fail('schedule-not-found');
    if (request.expectedVersion !== this.view(task).version) fail('schedule-conflict');
    return task;
  }
  async operate(operation, request) {
    if (!request || !id(request.sessionId) || !id(request.requestId) || (operation !== 'create' && !id(request.id))) fail('invalid-request');
    if (Buffer.byteLength(canonical(request)) > 65536) fail('request-too-large');
    return this.core.serialize(async () => {
      const key = digest({ sessionId: request.sessionId, requestId: request.requestId });
      const fingerprint = digest({ operation, request });
      let entry = this.ledger.requests.get(key);
      if (entry && entry.digest !== fingerprint) fail('request-identity-conflict');
      if (entry?.phase === 'committed') return entry.result;
      if (['create', 'update', 'resume', 'runNow'].includes(operation)) await this.core.assertRunnable(request.sessionId);
      if (!entry) {
        await this.core.inspect(request.sessionId);
        const prepared = this.prepare(operation, request);
        entry = { operation, digest: fingerprint, sessionId: request.sessionId, phase: 'prepared', ...prepared };
        await this.ledger.requests.put(key, entry);
      }
      const result = await this.apply(key, entry);
      await this.ledger.requests.put(key, { ...this.ledger.requests.get(key), phase: 'committed', result });
      this.core.changed();
      return result;
    });
  }
  prepare(operation, request) {
    const now = Date.now();
    if (operation === 'create') {
      const record = this.helpers.create('schedule-' + randomUUID(), request.definition, now);
      return { id: record.id, after: { sessionId: request.sessionId, record, status: 'active', deliveryHistory: { records: [], earlierRecordsUnavailable: false } } };
    }
    const before = this.current(request); const view = this.view(before);
    if (operation === 'delete') return { id: request.id, before };
    if (operation === 'runNow') {
      if (view.status === 'inactive') fail('schedule-ended');
      return { id: request.id, before, deliveryId: 'delivery-' + randomUUID(), requestedAt: new Date(now).toISOString(),
        message: this.helpers.message(before.record), prompt: before.record.prompt };
    }
    let after = structuredClone(before); let paused = view.status === 'paused';
    if (operation === 'pause') {
      if (view.status !== 'active') fail('schedule-not-active');
      after.status = 'inactive'; paused = true;
    } else if (operation === 'resume') {
      if (!paused) fail('schedule-not-paused');
      if (Date.parse(after.record.scheduledAt) <= now) {
        if (!this.helpers.recurring(after.record)) fail('not-future');
        const future = this.helpers.occurrence(after.record, now).nextScheduledAt;
        if (!future || Date.parse(future) <= now) fail('not-future');
        after.record.scheduledAt = future;
      }
      after.status = 'active'; paused = false;
    } else if (operation === 'update') {
      if (view.status === 'inactive') fail('schedule-ended');
      const definition = request.definition;
      if (!definition || typeof definition !== 'object') fail('invalid-request');
      after.record = definition.timing
        ? this.helpers.create(before.record.id, { ...definition.timing, title: definition.title ?? before.record.title, prompt: definition.prompt ?? before.record.prompt }, now)
        : this.helpers.decode({ ...before.record, title: this.helpers.title(definition.title ?? before.record.title), prompt: (definition.prompt ?? before.record.prompt).trim() });
    } else fail('unsupported-operation');
    return { id: request.id, before, after, control: { paused, recordHash: digest(after.record) } };
  }
  async apply(key, entry) {
    let current = this.core.tasks.get(entry.id);
    if (entry.operation === 'create') {
      if (!current) { await this.core.tasks.put(entry.id, entry.after); current = this.core.tasks.get(entry.id); }
      if (current.sessionId !== entry.sessionId) fail('schedule-conflict');
      return { entry: this.view(current) };
    }
    if (entry.operation === 'delete') {
      if (current) {
        if (digest(current) !== digest(entry.before)) fail('schedule-conflict');
        await this.core.tasks.delete(entry.id);
      }
      await this.ledger.controls.delete(entry.id);
      return { id: entry.id, deleted: true };
    }
    if (!current || current.sessionId !== entry.sessionId) fail('schedule-not-found');
    if (entry.operation === 'runNow') return this.deliver(key, entry, current);
    if (digest(current) === digest(entry.before)) { await this.core.tasks.put(entry.id, entry.after); current = this.core.tasks.get(entry.id); }
    else if (digest(current) !== digest(entry.after)) fail('schedule-conflict');
    await this.ledger.controls.put(entry.id, entry.control);
    return { entry: this.view(current) };
  }
  async deliver(key, entry, task) {
    if (entry.phase !== 'delivered') {
      const agent = await this.core.resolve(entry.sessionId);
      if (!this.core.hasMessage(agent, entry.message.id)) {
        if (digest(task) !== digest(entry.before)) fail('schedule-conflict');
        await this.core.assertRunnable(entry.sessionId);
        this.core.send(agent, entry.message);
      }
      if (!await this.core.flush(agent)) fail('delivery-result-unknown');
      entry = { ...entry, phase: 'delivered', receipt: { scheduledAt: entry.requestedAt, deliveredAt: new Date().toISOString(), messageId: entry.message.id } };
      await this.ledger.requests.put(key, entry);
    }
    // Preserve the plan and current status; manual delivery cannot unpause or re-anchor it.
    task = this.core.tasks.get(entry.id);
    if (!task || task.sessionId !== entry.sessionId) fail('schedule-not-found');
    const history = task.deliveryHistory ?? { records: task.lastDelivery ? [task.lastDelivery] : [], earlierRecordsUnavailable: true };
    if (!history.records.some(r => r.messageId === entry.message.id)) {
      const added = [...history.records, { ...entry.receipt, prompt: entry.prompt }];
      const bounds = this.core.retention;
      const records = added.filter(r => Date.parse(r.deliveredAt) >= Date.parse(entry.receipt.deliveredAt) - bounds.days * 86400000).slice(-bounds.records);
      await this.core.tasks.put(entry.id, { ...task, lastDelivery: entry.receipt, deliveryHistory: {
        records, earlierRecordsUnavailable: history.earlierRecordsUnavailable || records.length !== added.length,
        earlierRecordsPruned: history.earlierRecordsPruned === true || records.length !== added.length } });
    }
    return { id: entry.id, sessionId: entry.sessionId, deliveryId: entry.deliveryId, messageId: entry.message.id,
      deliveredAt: entry.receipt.deliveredAt, deliveryStatus: 'delivered', executionStatus: 'not-observed', entry: this.view(this.core.tasks.get(entry.id)) };
  }
  async history(request) {
    const page = await this.core.history(request);
    if (!page.records) return page;
    const manual = new Map([...this.ledger.requests.entries()].map(([, e]) => e).filter(e => e.operation === 'runNow' && e.sessionId === request.sessionId && e.id === request.id && e.receipt)
      .map(e => [e.receipt.messageId, e.deliveryId]));
    return { ...page, records: page.records.map(r => manual.has(r.messageId) ? { ...r, source: 'manual', deliveryId: manual.get(r.messageId) } : { ...r, source: 'scheduled' }) };
  }
}
