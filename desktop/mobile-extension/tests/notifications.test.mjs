import test from 'node:test';
import assert from 'node:assert/strict';
import { NotificationFeed, observeNotifications } from '../notification-feed.mjs';

function fixture() {
  const handlers = new Map(); const options = new Map(); let now = 1000000;
  const feed = new NotificationFeed(null, async () => {}, () => now);
  observeNotifications({ on: (event, fn, opts) => { handlers.set(event, fn); options.set(event, opts); } }, feed);
  const session = { id: 'session-root', header: {} };
  return { feed, handlers, options, session, event: (type, data, target = session) => handlers.get('session/event')(target, { type, data }), clock: time => { now = time; } };
}
test('first subscription baselines completions; reconnect replays bounded recent completions exactly once', async () => {
  let saved; const feed = new NotificationFeed(null, async value => { saved = value; }, () => 1000000);
  feed.completed('root', 1);
  const baseline = feed.read(); assert.deepEqual(baseline.events, []);
  feed.completed('root', 2); feed.completed('root', 2);
  const result = feed.read({ epoch: baseline.epoch, after: baseline.cursor });
  assert.equal(result.events.length, 1); assert.equal(result.events[0].id, 'root:turn:2');
  assert.equal(feed.read({ epoch: result.epoch, after: result.cursor }).events.length, 0);
  await feed.queue;
  const restored = new NotificationFeed(saved, async () => {}, () => 1000001);
  assert.equal(restored.read({ epoch: baseline.epoch, after: baseline.cursor }).events.length, 1);
  assert.deepEqual(restored.read({ epoch: 'old-host', after: 0 }).events, []);
  assert.deepEqual(restored.read({ epoch: result.epoch, after: 999 }).events, []);
});
test('only successful root turn completion notifies; child, aborted and failed turns do not', () => {
  const f = fixture(); const baseline = f.feed.read();
  f.event('turn/end', { turn: 1, reason: { kind: 'aborted' } });
  f.event('turn/end', { turn: 2, reason: { kind: 'failed' } });
  f.event('turn/end', { turn: 1, reason: { kind: 'completed' } }, { id: 'child', header: { parentSession: 'session-root', origin: 'subagent' } });
  f.event('turn/end', { turn: 3, reason: { kind: 'completed' } });
  assert.equal(f.feed.read({ epoch: baseline.epoch, after: 0 }).events.length, 1);
});
test('approval observer delegates immediately, preserves downstream decision and removes resolved request', async () => {
  const f = fixture(); let answer; let forwarded = false;
  const wait = new Promise(resolve => { answer = resolve; });
  const task = f.handlers.get('approval/request')({ agent: { session: f.session }, reason: 'secret', toolName: 'secret-tool' }, () => { forwarded = true; return wait; });
  assert.equal(forwarded, true); assert.equal(f.feed.read().pending.length, 1);
  assert.equal(JSON.stringify(f.feed.read()).includes('secret'), false);
  assert.equal(f.feed.read().pending[0].noticeType, 'permission');
  answer('rejected'); assert.equal(await task, 'rejected'); assert.equal(f.feed.read().pending.length, 0);
  assert.equal(f.options.get('approval/request').prepend, true);
});
test('request cancellation withdraws notification even before downstream settles; rejection is unchanged', async () => {
  const f = fixture(); const controller = new AbortController(); let reject;
  const task = f.handlers.get('user-questions/request')({ agent: { session: f.session }, signal: controller.signal }, () => new Promise((_, r) => { reject = r; }));
  controller.abort(); assert.equal(f.feed.read().pending.length, 0);
  reject(new Error('downstream')); await assert.rejects(task, /downstream/);
  assert.equal(f.feed.read().pending.length, 0);
});
test('continued timed question remains until late human answer; arbitrary tool payload cannot create a prompt', () => {
  const f = fixture();
  const result = id => ({ message: { toolCallId: id, content: [{ type: 'text', text: '{"pending":true}' }] } });
  f.event('tool/result', result('arbitrary')); assert.equal(f.feed.read().pending.length, 0);
  f.event('tool/call', { name: 'ask_user_question', callId: 'question' });
  f.event('tool/result', result('question')); f.event('turn/end', { turn: 1, reason: { kind: 'completed' } });
  assert.equal(f.feed.read().pending.length, 1);
  f.event('user/message', { source: { kind: 'user-question-reply', callId: 'question' } });
  assert.equal(f.feed.read().pending.length, 0);
});
test('retention, invalid cursors, bounded replay and persistence failure are contained', async () => {
  const f = fixture(); const first = f.feed.read();
  for (let i = 0; i < 600; i++) f.feed.completed('session-root', i);
  assert.equal(f.feed.events.length, 512);
  assert.equal(f.feed.read({ epoch: first.epoch, after: 0 }).events.length, 512);
  assert.throws(() => f.feed.read({ after: -1 }), /invalid-request/);
  assert.throws(() => f.feed.read({ after: 1.5 }), /invalid-request/);
  f.clock(1000000 + 900001); assert.equal(f.feed.read({ epoch: first.epoch, after: 0 }).events.length, 0);
  const failed = new NotificationFeed(null, async () => { throw new Error('disk'); });
  failed.completed('session', 1); await assert.rejects(failed.queue, /disk/);
  failed.persist = async () => {}; failed.completed('session', 2); await failed.queue;
});

test('notification RPC requires an Operator peer and isolates storage in its own domain', async () => {
  const { registerNotifications } = await import('../notification-feed.mjs');
  const registrations = []; const state = new Map(); let instance; let dispose;
  class OperatorPeer {}
  class RemoteError extends Error { constructor(code) { super(code); this.code = code; } }
  const schema = { z: null };
  const validator = new Proxy(() => validator, { get: () => validator, apply: () => validator });
  schema.z = validator;
  const ctx = { invocation: { peer: {} }, on() {}, effect(fn) { dispose = fn(); }, storageDomain: { async open(definition) {
    assert.equal(definition.name, 'mobile_notifications');
    return { table: () => ({ get: key => state.get(key), put: async (key, value) => { state.set(key, value); } }), close: async () => {} };
  } } };
  const protocol = { RemoteError, TypertRemoteService: class { constructor(context, name) { this.ctx = context; instance = this; assert.equal(name, 'mobileNotifications'); } },
    Remote(fn, options) { registrations.push(options.name); } };
  await registerNotifications(ctx, { protocol, connection: { OperatorPeer }, schema, storage: { defineDomain: x => x, domainTable: x => x } });
  assert.deepEqual(registrations, ['poll', 'details']);
  await assert.rejects(instance.poll({}), error => error.code === 'access-denied');
  ctx.invocation.peer = new OperatorPeer();
  assert.equal((await instance.poll({})).version, 1);
  await assert.rejects(instance.poll({ after: -2 }), error => error.code === 'invalid-request');
  await dispose();
});


test('forked conversations notify independently and child approval routes to its owning conversation', async () => {
  const f = fixture(); const baseline = f.feed.read();
  f.event('turn/end', { turn: 9, reason: { kind: 'completed' } }, { id: 'fork', header: { parentSession: 'session-root', isSeeded: true } });
  assert.equal(f.feed.read({ epoch: baseline.epoch, after: 0 }).events[0].sessionId, 'fork');
  let resolve;
  const task = f.handlers.get('approval/request')({ agent: { session: { id: 'child', header: { origin: 'subagent', parentSession: 'session-root' } }, parentAgent: { session: f.session } } }, () => new Promise(done => { resolve = done; }));
  assert.equal(f.feed.read().pending[0].sessionId, 'session-root');
  resolve('allowed-once'); assert.equal(await task, 'allowed-once');
});
