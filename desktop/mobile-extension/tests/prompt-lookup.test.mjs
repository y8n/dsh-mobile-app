import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupPrompt } from '../prompt-lookup.mjs';
const request = { sessionId: 'owned', requestId: 'nonce' };
const view = events => ({ meta: { id: 'owned' }, inheritedEventCount: 0, events });
const user = source => ({ type: 'user/message', data: { source } });
test('scoped lookup finds an accepted user request outside any client tail', async () => {
  const events = [user({ kind: 'user', rpcId: 'nonce' }), ...Array.from({ length: 100 }, () => ({ type: 'test' }))];
  let called; const result = await lookupPrompt(async sid => { called = sid; return view(events); }, request);
  assert.equal(called, 'owned'); assert.deepEqual(result, { ...request, accepted: true, throughSeq: 100 });
});
test('spliced queued user identity is accepted but unrelated metadata is not', async () => {
  const events = [{ type: 'agent/inbox/spliced', data: { inserted: [{ source: { kind: 'user', rpcId: 'nonce' } }] } }];
  assert.equal((await lookupPrompt(async () => view(events), request)).accepted, true);
  assert.equal((await lookupPrompt(async () => view([user({ kind: 'schedule', rpcId: 'nonce' }), { type: 'tool/result', data: { source: { kind: 'user', rpcId: 'nonce' } } }]), request)).accepted, false);
});
test('inherited parent request cannot confirm submission to its fork', async () => {
  const value = view([user({ kind: 'user', rpcId: 'nonce' })]); value.inheritedEventCount = 1;
  assert.equal((await lookupPrompt(async () => value, request)).accepted, false);
});
test('wrong session, path-like input and exhausted budget fail closed', async () => {
  await assert.rejects(lookupPrompt(async () => ({ ...view([]), meta: { id: 'other' } }), request), /invalid-inspection/);
  await assert.rejects(lookupPrompt(async () => assert.fail('must not inspect'), { ...request, sessionId: '../other' }), /invalid-request/);
  await assert.rejects(lookupPrompt(async () => view([{ type: 'test' }, { type: 'test' }]), request, undefined, 1), /lookup-limit/);
});
test('caller cancellation prevents reads and stops an in-flight result', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(lookupPrompt(async () => assert.fail('must not inspect'), request, controller.signal));
  const during = new AbortController(); await assert.rejects(lookupPrompt(async () => { during.abort(); return view([]); }, request, during.signal));
});
