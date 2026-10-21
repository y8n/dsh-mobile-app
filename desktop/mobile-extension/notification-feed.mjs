import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sessionTitle, finalPreview, questionPreview, permissionPreview } from './notification-copy.mjs';
const implementation = Object.freeze({ entrySha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), packageVersion: JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version });

/** Durable state is metadata only. Display previews remain bounded in memory. */
export class NotificationFeed {
  constructor(saved, persist = async () => {}, clock = Date.now) {
    this.clock = clock; this.persist = persist;
    this.epoch = saved?.epoch ?? randomUUID(); this.sequence = saved?.sequence ?? 0;
    this.events = saved?.events ?? []; this.pending = new Map(); this.previews = new Map(); this.queue = Promise.resolve();
  }
  save() {
    const state = { epoch: this.epoch, sequence: this.sequence, events: [...this.events] };
    this.queue = this.queue.catch(() => {}).then(() => this.persist(state));
    // A storage fault must not reject the host event dispatch or approval waterfall.
    this.queue.catch(() => {});
  }
  completed(sessionId, turn, preview = {}) {
    const id = `${sessionId}:turn:${turn}`;
    if (this.events.some(e => e.id === id)) return;
    this.previews.set(id, preview);
    while (this.previews.size > 512) this.previews.delete(this.previews.keys().next().value);
    this.events.push({ id, sequence: ++this.sequence, sessionId, kind: 'completed', at: this.clock() });
    this.events = this.events.filter(e => e.at >= this.clock() - 86400000).slice(-512); this.save();
  }
  ask(sessionId, id, preview = {}) {
    const key = `${sessionId}:${preview.noticeType === 'permission' ? 'permission' : 'confirm'}:${id}`;
    if (!this.pending.has(key)) this.pending.set(key, { id: key, sessionId, kind: 'confirmation', at: this.clock(), ...preview });
    while (this.pending.size > 256) this.pending.delete(this.pending.keys().next().value);
    return key;
  }
  settle(key) { this.pending.delete(key); }
  details(id, sessionId) {
    const event = this.events.find(e => e.id === id && e.sessionId === sessionId) ?? [...this.pending.values()].find(e => e.id === id && e.sessionId === sessionId);
    if (!event) return null;
    return { ...event, ...(this.previews.get(id) ?? {}) };
  }
  read(request = {}) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('invalid-request');
    if (request.epoch !== undefined && typeof request.epoch !== 'string' || request.after !== undefined && (!Number.isSafeInteger(request.after) || request.after < 0)) throw new Error('invalid-request');
    const replay = request.epoch === this.epoch && Number.isSafeInteger(request.after) && request.after <= this.sequence;
    return { version: 1, epoch: this.epoch, cursor: this.sequence, now: this.clock(),
      events: replay ? this.events.filter(e => e.sequence > request.after && e.at >= this.clock() - 900000).map(e => this.details(e.id, e.sessionId)) : [],
      pending: [...this.pending.values()].slice(-256) };
  }
}

export function observeNotifications(ctx, feed) {
  const root = session => session?.header?.origin !== 'subagent' && typeof session?.id === 'string';
  const questionCalls = new Map();
  ctx.on('session/event', (session, event) => {
    if (!root(session)) return;
    if (event.type === 'turn/end') questionCalls.delete(session.id);
    if (event.type === 'turn/end' && event.data.reason?.kind === 'completed') feed.completed(session.id, event.data.turn, { sessionTitle: sessionTitle(ctx, session), preview: finalPreview(session, event.data.turn) });
    if (event.type === 'user/message' && event.data.source?.kind === 'user-question-reply') feed.settle(`${session.id}:confirm:${event.data.source.callId}`);
    if (event.type === 'tool/call' && event.data.name === 'ask_user_question') {
      const calls = questionCalls.get(session.id) ?? new Map();
      let args = event.data.arguments;
      if (typeof args === 'string' && args.length <= 65536) { try { args = JSON.parse(args); } catch { args = null; } }
      calls.set(event.data.callId, { sessionTitle: sessionTitle(ctx, session), preview: questionPreview(args), noticeType: 'question' }); questionCalls.set(session.id, calls);
    }
    if (event.type === 'tool/result') {
      const id = event.data.message?.toolCallId;
      const content = event.data.message?.content ?? [];
      let pending = false;
      for (const block of content) if (block.type === 'text') { try { pending ||= JSON.parse(block.text)?.pending === true; } catch {} }
      if (pending && questionCalls.get(session.id)?.has(id)) feed.ask(session.id, id, questionCalls.get(session.id).get(id)); else feed.settle(`${session.id}:confirm:${id}`);
    }
  });
  for (const event of ['approval/request', 'user-questions/request']) ctx.on(event, async (request, next) => {
    let owner = request.agent;
    const seen = new Set();
    while (owner?.session?.header?.origin === 'subagent' && owner.parentAgent && !seen.has(owner) && seen.size < 128) {
      seen.add(owner); owner = owner.parentAgent;
    }
    if (!root(owner?.session) || request.signal?.aborted) return next();
    const permission = event === 'approval/request';
    const key = feed.ask(owner.session.id, request.wait?.callId ?? request.callId ?? randomUUID(), {
      noticeType: permission ? 'permission' : 'question', sessionTitle: sessionTitle(ctx, owner.session),
      preview: permission ? permissionPreview(request) : questionPreview(request),
    });
    const cancel = () => feed.settle(key);
    request.signal?.addEventListener('abort', cancel, { once: true });
    try { return await next(); }
    finally { cancel(); request.signal?.removeEventListener('abort', cancel); }
  }, { prepend: true });
}

export async function registerNotifications(ctx, { protocol, connection, storage, schema }) {
  const z = schema.z;
  const event = z.object({ id: z.string(), sequence: z.number(), sessionId: z.string(), kind: z.literal('completed'), at: z.number() });
  const domain = await ctx.storageDomain.open(storage.defineDomain({ name: 'mobile_notifications', version: 1, tables: {
    state: storage.domainTable(z.object({ epoch: z.string(), sequence: z.number(), events: z.array(event).max(512) })) } }));
  const table = domain.table('state');
  const feed = new NotificationFeed(table.get('feed'), state => table.put('feed', state));
  observeNotifications(ctx, feed);
  ctx.effect(() => async () => { await feed.queue.catch(() => {}); await domain.close(); });
  const initializers = [];
  class Notifications extends protocol.TypertRemoteService {
    constructor() { super(ctx, 'mobileNotifications'); for (const init of initializers) init.call(this); }
    async details(request) {
      if (!(this.ctx.invocation?.peer instanceof connection.OperatorPeer)) throw new protocol.RemoteError('access-denied', 'access-denied', {});
      if (!request || Object.keys(request).some(k => !['id', 'sessionId'].includes(k)) || ![request.id, request.sessionId].every(v => typeof v === 'string' && v.length > 0 && v.length <= 512)) throw new protocol.RemoteError('invalid-request', 'invalid-request', {});
      const value = feed.details(request.id, request.sessionId);
      if (!value) throw new protocol.RemoteError('notification-not-found', 'notification-not-found', {});
      return value;
    }
    async poll(request) {
      if (!(this.ctx.invocation?.peer instanceof connection.OperatorPeer)) throw new protocol.RemoteError('access-denied', 'access-denied', {});
      try { return { ...feed.read(request), implementation }; } catch { throw new protocol.RemoteError('invalid-request', 'invalid-request', {}); }
    }
  }
  protocol.Remote(Notifications.prototype.poll, { kind: 'method', name: 'poll', static: false, private: false, addInitializer: init => initializers.push(init) });
  protocol.Remote(Notifications.prototype.details, { kind: 'method', name: 'details', static: false, private: false, addInitializer: init => initializers.push(init) });
  new Notifications();
}
