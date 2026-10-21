export class PromptLookupFault extends Error { constructor(code) { super(code); this.code = code; } }
export function validatePromptLookup(request) {
  const identity = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
  if (!request || typeof request !== 'object' || Array.isArray(request) || Object.keys(request).some(k => !['sessionId', 'requestId'].includes(k))
      || typeof request.sessionId !== 'string' || !identity.test(request.sessionId)
      || typeof request.requestId !== 'string' || !identity.test(request.requestId)) throw new PromptLookupFault('invalid-request');
}
/** Inspect only the addressed Session, without resolving or starting an Agent.
 * A negative observation is never permission to resubmit a write. */
export async function lookupPrompt(inspect, request, signal, maxEntries = 100_000) {
  validatePromptLookup(request); signal?.throwIfAborted();
  const view = await inspect(request.sessionId, signal); signal?.throwIfAborted();
  const events = view?.events;
  const inherited = view?.inheritedEventCount;
  if (view?.meta?.id !== request.sessionId || !Array.isArray(events) || !Number.isSafeInteger(inherited) || inherited < 0 || inherited > events.length)
    throw new PromptLookupFault('invalid-inspection');
  let scanned = 0, accepted = false;
  const matches = source => source?.kind === 'user' && source.rpcId === request.requestId;
  const budget = async () => {
    if (++scanned > maxEntries) throw new PromptLookupFault('lookup-limit');
    if (scanned % 1024 === 0) await new Promise(resolve => setImmediate(resolve));
    signal?.throwIfAborted();
  };
  for (let i = inherited; i < events.length; i++) {
    await budget(); const event = events[i];
    if (event.type === 'user/message' && matches(event.data?.source)) { accepted = true; break; }
    if (event.type === 'agent/inbox/spliced') {
      for (const message of event.data?.inserted ?? []) { await budget(); if (matches(message.source)) { accepted = true; break; } }
      if (accepted) break;
    }
  }
  return { sessionId: request.sessionId, requestId: request.requestId, accepted, throughSeq: events.length - 1 };
}
