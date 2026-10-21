import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionLineage, assertUnarchived } from '../session-admission.mjs';

test('cold subagent lineage inherits archive admission while forks remain independent', async () => {
  const headers = { child: { id: 'child', origin: 'subagent', parentSession: 'parent' }, parent: { id: 'parent', origin: 'user' }, fork: { id: 'fork', origin: 'fork', parentSession: 'parent' } };
  const inspect = async id => ({ meta: headers[id] });
  const child = await sessionLineage(inspect, 'child'); assert.deepEqual(child, ['child', 'parent']);
  assert.throws(() => assertUnarchived(child, ['parent']), e => e.code === 'session-archived');
  assertUnarchived(await sessionLineage(inspect, 'fork'), ['parent']);
});
test('cycles and unavailable headers never admit unknown lineage', async () => {
  await assert.rejects(sessionLineage(async id => ({ meta: { id, origin: 'subagent', parentSession: id } }), 'cycle'), e => e.code === 'session-unavailable');
  await assert.rejects(sessionLineage(async () => ({ meta: undefined }), 'missing'), e => e.code === 'session-unavailable');
});
