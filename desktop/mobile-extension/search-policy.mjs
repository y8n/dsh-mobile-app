// Configuration is observed by every full-text call in the pinned SQLite
// engine. Changing only its readiness policy avoids re-providing sessionQuery
// and therefore does not tear down the dependent Session controller.
const key = Symbol.for('dsh-mobile-app.search-policy-leases.v1');
const leases = globalThis[key] ??= new WeakMap();
export function acquireSearchPolicy(engine, actualHash, expectedHash) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash ?? '') || actualHash !== expectedHash) throw Error('mobile-search: unsupported query module hash');
  const config = engine?.config;
  if (!config || !['never', 'first-search', 'startup'].includes(config.openAt) || typeof engine.searchSessions !== 'function'
      || Object.isFrozen(config)) throw Error('mobile-search: incompatible search policy');
  let lease = leases.get(config);
  if (!lease) {
    lease = { count: 0, original: config.openAt };
    if (config.openAt === 'never') config.openAt = 'first-search';
    leases.set(config, lease);
  }
  lease.count++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--lease.count !== 0) return;
    leases.delete(config);
    if (lease.original === 'never' && engine.config === config && config.openAt === 'first-search') config.openAt = 'never';
  };
}
