import test from 'node:test';
import assert from 'node:assert/strict';
import { MobileScheduleEngine, ScheduleFault } from '../schedule-engine.mjs';

class Table {
  map = new Map(); failAfterPut = false;
  get(key) { return this.map.get(key); }
  entries() { return this.map.entries(); }
  async put(key, value) { this.map.set(key, structuredClone(value)); if (this.failAfterPut) { this.failAfterPut = false; throw Error('lost storage acknowledgment'); } }
  async delete(key) { this.map.delete(key); }
}
function fixture() {
  const tasks = new Table(); const requests = new Table(); const controls = new Table(); const messages = [];
  let chain = Promise.resolve(); let flushed = true;
  const core = { tasks, retention: { days: 30, records: 200 },
    assertRunnable: async () => {},
    serialize: work => { const result = chain.then(work); chain = result.catch(() => {}); return result; },
    inspect: async sid => { if (sid !== 'session') throw Error('session not found'); }, changed() {},
    resolve: async () => ({}), hasMessage: (_, id) => messages.some(m => m.id === id), send: (_, message) => messages.push(message), flush: async () => flushed,
    history: async req => ({ records: [...tasks.get(req.id).deliveryHistory.records].reverse() }) };
  const helpers = {
    create: (id, d, now) => ({ id, title: d.title, prompt: d.prompt, kind: 'every', everySeconds: d.every_seconds, scheduledAt: new Date(now + d.every_seconds * 1000).toISOString() }),
    title: value => value.trim(), decode: value => value, recurring: () => true,
    occurrence: (_, now) => ({ nextScheduledAt: new Date(now + 60000).toISOString() }),
    message: record => ({ id: 'message-' + Math.random(), role: 'user', content: [{ type: 'text', text: record.prompt }], source: { kind: 'schedule' } }),
  };
  const engine = new MobileScheduleEngine(core, { requests, controls }, helpers);
  return { engine, core, tasks, requests, controls, messages, reopen: () => new MobileScheduleEngine(core, { requests, controls }, helpers), flush: value => { flushed = value; } };
}
const creation = { sessionId: 'session', requestId: 'create', definition: { title: 'owned', prompt: 'test', every_seconds: 60 } };
const command = (entry, requestId) => ({ sessionId: entry.sessionId, id: entry.id, expectedVersion: entry.version, requestId });

test('archived sessions reject new or replay-prepared work while committed receipts remain idempotent', async () => {
  const f = fixture(); const made = await f.engine.operate('create', creation);
  f.core.assertRunnable = async () => { throw new ScheduleFault('session-archived'); };
  assert.deepEqual(await f.engine.operate('create', creation), made);
  for (const operation of ['create', 'resume', 'update', 'runNow']) await assert.rejects(f.engine.operate(operation,
    operation === 'create' ? { ...creation, requestId: 'archived-create' } : command(made.entry, 'archived-' + operation)), e => e.code === 'session-archived');
  assert.equal(f.tasks.map.size, 1); assert.equal(f.messages.length, 0);
  await f.engine.operate('delete', command(made.entry, 'cleanup')); assert.equal(f.tasks.map.size, 0);
});
test('archiving during agent resolution prevents a prepared manual delivery', async () => {
  const f = fixture(); const made = await f.engine.operate('create', creation); let archived = false;
  f.core.assertRunnable = async () => { if (archived) throw new ScheduleFault('session-archived'); };
  f.core.resolve = async () => { archived = true; return {}; };
  const request = command(made.entry, 'race'); await assert.rejects(f.engine.operate('runNow', request), e => e.code === 'session-archived');
  await assert.rejects(f.reopen().operate('runNow', request), e => e.code === 'session-archived'); assert.equal(f.messages.length, 0);
});

test('concurrent duplicate creation and different payload identity conflict', async () => {
  const f = fixture(); const [a, b] = await Promise.all([f.engine.operate('create', creation), f.engine.operate('create', structuredClone(creation))]);
  assert.deepEqual(a, b); assert.equal(f.tasks.map.size, 1);
  await assert.rejects(f.engine.operate('create', { ...creation, definition: { ...creation.definition, prompt: 'different' } }), e => e.code === 'request-identity-conflict');
});
test('create committed before response loss is recovered after engine restart without another task', async () => {
  const f = fixture(); f.tasks.failAfterPut = true;
  await assert.rejects(f.engine.operate('create', creation)); assert.equal(f.tasks.map.size, 1);
  const recovered = await f.reopen().operate('create', creation); assert.equal(recovered.entry.id, [...f.tasks.map.keys()][0]); assert.equal(f.tasks.map.size, 1);
});
test('pause changes the actual runtime input and resume skips missed occurrences without losing history', async () => {
  const f = fixture(); const made = await f.engine.operate('create', creation);
  const paused = await f.engine.operate('pause', command(made.entry, 'pause'));
  assert.equal(f.tasks.get(made.entry.id).status, 'inactive'); assert.equal(paused.entry.status, 'paused');
  assert.equal((await f.reopen().catalog())[0].status, 'paused');
  const before = f.tasks.get(made.entry.id);
  before.record.scheduledAt = new Date(Date.now() - 300000).toISOString();
  // Simulate a task read at an older scheduled instant before pausing, with consistent control metadata.
  const { digest } = await import('../schedule-engine.mjs');
  await f.controls.put(before.record.id, { paused: true, recordHash: digest(before.record) });
  const view = (await f.engine.catalog())[0];
  const resumed = await f.engine.operate('resume', command(view, 'resume'));
  assert.equal(resumed.entry.status, 'active'); assert.ok(Date.parse(resumed.entry.nextTrigger) > Date.now()); assert.deepEqual(f.tasks.get(view.id).deliveryHistory.records, []);
});
test('stale version and wrong session never overwrite a task', async () => {
  const f = fixture(); const made = await f.engine.operate('create', creation);
  await f.engine.operate('update', { ...command(made.entry, 'edit'), definition: { title: 'updated' } });
  await assert.rejects(f.engine.operate('pause', command(made.entry, 'stale')), e => e.code === 'schedule-conflict');
  await assert.rejects(f.engine.operate('pause', { ...command(made.entry, 'wrong'), sessionId: 'other' }));
  assert.equal(f.tasks.get(made.entry.id).record.title, 'updated'); assert.equal(f.tasks.get(made.entry.id).status, 'active');
});
test('manual delivery while paused remains paused, preserves next plan and records source without claiming execution', async () => {
  const f = fixture(); const made = await f.engine.operate('create', creation);
  const paused = await f.engine.operate('pause', command(made.entry, 'pause'));
  const request = command(paused.entry, 'manual');
  const delivered = await f.engine.operate('runNow', request);
  assert.equal(delivered.entry.status, 'paused'); assert.equal(delivered.entry.scheduledAt, paused.entry.scheduledAt);
  assert.equal(delivered.executionStatus, 'not-observed'); assert.equal(f.messages.length, 1);
  assert.deepEqual(await f.reopen().operate('runNow', request), delivered); assert.equal(f.messages.length, 1);
  const history = await f.engine.history({ id: paused.entry.id, sessionId: 'session' });
  assert.equal(history.records[0].source, 'manual'); assert.equal(history.records[0].deliveryId, delivered.deliveryId);
});
test('lost delivery flush acknowledgment is coordinated by original message ID after restart', async () => {
  const f = fixture(); const made = await f.engine.operate('create', creation); const request = command(made.entry, 'manual'); f.flush(false);
  await assert.rejects(f.engine.operate('runNow', request), e => e.code === 'delivery-result-unknown'); assert.equal(f.messages.length, 1);
  f.flush(true); await f.reopen().operate('runNow', request); assert.equal(f.messages.length, 1); assert.equal(f.tasks.get(made.entry.id).deliveryHistory.records.length, 1);
});

test('pause written before acknowledgement loss can restore its marker without reviving the timer input', async () => {
  const f = fixture(); const made = await f.engine.operate('create', creation); const request = command(made.entry, 'pause');
  f.tasks.failAfterPut = true; await assert.rejects(f.engine.operate('pause', request));
  assert.equal(f.tasks.get(made.entry.id).status, 'inactive');
  const recovered = await f.reopen().operate('pause', request); assert.equal(recovered.entry.status, 'paused');
});
test('receipt written before acknowledgment loss is not appended twice', async () => {
  const f = fixture(); const made = await f.engine.operate('create', creation); const request = command(made.entry, 'manual');
  f.tasks.failAfterPut = true; await assert.rejects(f.engine.operate('runNow', request));
  assert.equal(f.messages.length, 1); assert.equal(f.tasks.get(made.entry.id).deliveryHistory.records.length, 1);
  await f.reopen().operate('runNow', request); assert.equal(f.messages.length, 1); assert.equal(f.tasks.get(made.entry.id).deliveryHistory.records.length, 1);
});
test('recovery cannot overwrite a later external edit', async () => {
  const f = fixture(); const made = await f.engine.operate('create', creation); const request = command(made.entry, 'pause');
  f.tasks.failAfterPut = true; await assert.rejects(f.engine.operate('pause', request));
  const changed = structuredClone(f.tasks.get(made.entry.id)); changed.record.title = 'external edit'; await f.tasks.put(made.entry.id, changed);
  await assert.rejects(f.reopen().operate('pause', request), e => e.code === 'schedule-conflict'); assert.equal(f.tasks.get(made.entry.id).record.title, 'external edit');
});

test('an unsent prepared manual delivery cannot use a stale prompt after external edit', async () => {
  const f = fixture(); const made = await f.engine.operate('create', creation); const request = command(made.entry, 'manual');
  f.core.resolve = async () => { throw Error('temporarily unavailable'); };
  await assert.rejects(f.engine.operate('runNow', request)); assert.equal(f.messages.length, 0);
  const changed = structuredClone(f.tasks.get(made.entry.id)); changed.record.prompt = 'newer instruction'; await f.tasks.put(made.entry.id, changed);
  f.core.resolve = async () => ({});
  await assert.rejects(f.reopen().operate('runNow', request), e => e.code === 'schedule-conflict'); assert.equal(f.messages.length, 0);
});
