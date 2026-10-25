/** Require a host-created privileged peer; never trust request-supplied principal data. */
export function isOperatorPeer(peer, connection) {
  // Current hosts use one Peer class and distinguish owners from restricted principals.
  if (typeof connection.Peer === 'function') {
    return peer instanceof connection.Peer && peer.principal?.kind === 'owner';
  }
  // Older hosts represented owner admission with a dedicated class.
  return typeof connection.OperatorPeer === 'function' && peer instanceof connection.OperatorPeer;
}
