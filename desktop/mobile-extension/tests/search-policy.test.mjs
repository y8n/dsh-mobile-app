import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireSearchPolicy } from '../search-policy.mjs';
const hash = 'a'.repeat(64);
const engine = policy => ({ config: { openAt: policy }, searchSessions() {} });
test('unsupported build leaves readiness unchanged', () => {
  const value = engine('never'); assert.throws(() => acquireSearchPolicy(value, 'b'.repeat(64), hash)); assert.equal(value.config.openAt, 'never');
});
test('overlapping versions release only their own policy lease', async () => {
  const value = engine('never'); const first = acquireSearchPolicy(value, hash, hash);
  const other = await import('../search-policy.mjs?other-runtime'); const second = other.acquireSearchPolicy(value, hash, hash);
  first(); first(); assert.equal(value.config.openAt, 'first-search'); second(); assert.equal(value.config.openAt, 'never');
});
test('already-enabled deployment policy is preserved', () => {
  for (const policy of ['first-search', 'startup']) { const value = engine(policy); acquireSearchPolicy(value, hash, hash)(); assert.equal(value.config.openAt, policy); }
});
test('external policy change is not reverted by disposal', () => {
  const value = engine('never'); const stop = acquireSearchPolicy(value, hash, hash); value.config.openAt = 'startup'; stop(); assert.equal(value.config.openAt, 'startup');
});
test('immutable or invalid engine fails before mutation', () => {
  const value = engine('never'); Object.freeze(value.config); assert.throws(() => acquireSearchPolicy(value, hash, hash));
  assert.throws(() => acquireSearchPolicy(engine('unknown'), hash, hash)); assert.equal(value.config.openAt, 'never');
});
