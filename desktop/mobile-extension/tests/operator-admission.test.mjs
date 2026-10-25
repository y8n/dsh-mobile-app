import test from 'node:test';
import assert from 'node:assert/strict';
import { isOperatorPeer } from '../operator-admission.mjs';

test('current host admits only host-created owner peers', () => {
  class Peer { constructor(principal) { this.principal = principal; } }
  const connection = { Peer };
  assert.equal(isOperatorPeer(new Peer({ kind: 'owner' }), connection), true);
  for (const peer of [undefined, {}, { principal: { kind: 'owner' } }, new Peer(), new Peer({ kind: 'agent' }), new Peer({ kind: 'unknown' })]) {
    assert.equal(isOperatorPeer(peer, connection), false);
  }
});
test('legacy host preserves OperatorPeer admission and missing exports fail closed', () => {
  class OperatorPeer {}
  assert.equal(isOperatorPeer(new OperatorPeer(), { OperatorPeer }), true);
  assert.equal(isOperatorPeer({}, { OperatorPeer }), false);
  assert.equal(isOperatorPeer({}, {}), false);
});
test('current principal restriction takes precedence over a legacy class export', () => {
  class Peer { principal = { kind: 'agent' }; }
  class OperatorPeer extends Peer {}
  assert.equal(isOperatorPeer(new OperatorPeer(), { Peer, OperatorPeer }), false);
});
