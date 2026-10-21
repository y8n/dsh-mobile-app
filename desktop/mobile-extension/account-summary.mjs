// Display-only account data. Credentials remain inside the DSH Host credential service.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const DAY = 86_400_000;
class SummaryFault extends Error { constructor(code) { super(code); this.code = code; } }
const decimalPattern = /^(-?)(\d+(?:\.\d*)?|\.\d+)(?:e([+-]?\d+))?$/i;
function decimal(value) {
  if (typeof value !== 'string' || value.length > 128) throw new SummaryFault('invalid-response');
  const match = decimalPattern.exec(value);
  if (!match || Math.abs(Number(match[3] || 0)) > 60) throw new SummaryFault('invalid-response');
  const fraction = match[2].split('.')[1]?.length || 0;
  let units = BigInt(match[1] + match[2].replace('.', ''));
  let scale = fraction - Number(match[3] || 0);
  if (scale < 0) { units *= 10n ** BigInt(-scale); scale = 0; }
  return { units, scale };
}
function render({ units, scale }) {
  const negative = units < 0n; const digits = (negative ? -units : units).toString().padStart(scale + 1, '0');
  const value = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, '') : digits;
  return (negative && units !== 0n ? '-' : '') + value;
}
function add(a, b) {
  const x = decimal(a), y = decimal(b), scale = Math.max(x.scale, y.scale);
  return render({ units: x.units * 10n ** BigInt(scale - x.scale) + y.units * 10n ** BigInt(scale - y.scale), scale });
}
function amounts(rows, field) {
  if (!Array.isArray(rows) || rows.length > 64) throw new SummaryFault('invalid-response');
  const result = new Map();
  for (const row of rows) {
    if (!row || !['CNY', 'USD'].includes(row.currency)) throw new SummaryFault('invalid-response');
    const amount = render(decimal(row[field]));
    result.set(row.currency, add(result.get(row.currency) ?? '0', amount));
  }
  return result;
}
export function platformWallets(data) {
  const normal = amounts(data?.normal_wallets, 'balance'), bonus = amounts(data?.bonus_wallets, 'balance');
  const costs = data?.total_costs == null ? new Map() : amounts(data.total_costs, 'amount');
  if ([...costs.values()].some(x => decimal(x).units < 0n)) throw new SummaryFault('invalid-response');
  const currencies = new Set([...normal.keys(), ...bonus.keys(), ...costs.keys()]);
  if (!currencies.size) throw new SummaryFault('invalid-response');
  return [...currencies].sort().map(currency => ({ currency,
    ...(normal.has(currency) || bonus.has(currency) ? { balance: add(normal.get(currency) ?? '0', bonus.get(currency) ?? '0'), toppedUpBalance: normal.get(currency) ?? '0', grantedBalance: bonus.get(currency) ?? '0' } : {}),
    ...(costs.has(currency) ? { totalCosts: costs.get(currency) } : {}),
  }));
}
function apiWallets(data) {
  if (typeof data?.is_available !== 'boolean' || !Array.isArray(data.balance_infos) || !data.balance_infos.length || data.balance_infos.length > 8) throw new SummaryFault('invalid-response');
  const currencies = new Set();
  return data.balance_infos.map(row => {
    if (!['CNY', 'USD'].includes(row?.currency) || currencies.has(row.currency)) throw new SummaryFault('invalid-response');
    currencies.add(row.currency);
    return { currency: row.currency, balance: render(decimal(row.total_balance)), toppedUpBalance: render(decimal(row.topped_up_balance)), grantedBalance: render(decimal(row.granted_balance)) };
  });
}
async function boundedJson(response) {
  if (!response.ok) throw new SummaryFault(response.status === 401 ? 'expired' : response.status === 429 ? 'rate-limited' : 'unavailable');
  const reader = response.body?.getReader(); if (!reader) throw new SummaryFault('invalid-response');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const {done,value} = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 262_144) throw new SummaryFault('invalid-response'); chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new SummaryFault('invalid-response'); }
}

export class AccountSummaryReader {
  constructor({ credentials, fetch: request = globalThis.fetch, now = Date.now }) {
    this.credentials = credentials; this.request = request; this.now = now;
    this.lifetime = new AbortController();
  }
  close() { this.lifetime.abort(); this.cached = null; this.pending = null; }
  async read() {
    if (this.lifetime.signal.aborted) return {version:1,status:'failed',error:'unavailable',wallets:[],fetchedAt:this.now()};
    // Use DSH's credential provider: no direct YAML parsing or credential RPC to the phone.
    let record, resolved;
    try { record = await this.credentials.readRecord('deepseek-account-platform/default'); resolved = await this.credentials.resolve('DEEPSEEK_API_KEY'); }
    catch { return { version: 1, status: 'failed', error: 'storage-unavailable', wallets: [], fetchedAt: this.now() }; }
    const grant = record?.kind === 'grant' && record.payload?.version === 1 ? record.payload : null;
    const token = typeof grant?.token === 'string' && /^[\x21-\x7e]+$/.test(grant.token) ? grant.token : null;
    const key = typeof resolved?.value === 'string' && /^[\x21-\x7e]+$/.test(resolved.value) ? resolved.value : null;
    const identity = createHash('sha256').update(JSON.stringify([record,key])).digest('hex');
    const time = this.now();
    if (this.cached?.identity === identity && time >= this.cached.at && time - this.cached.at < this.cached.ttl) return this.cached.value;
    if (this.pending?.identity === identity) return this.pending.promise;
    const promise = (async () => {
      let value;
      try { value = await this.query(grant?.issuer, token, key, record !== undefined || resolved !== undefined); }
      catch { value = {version:1,status:'failed',error:'unavailable',wallets:[],fetchedAt:this.now()}; }
      try {
        const currentRecord = await this.credentials.readRecord('deepseek-account-platform/default');
        const resolvedKey = await this.credentials.resolve('DEEPSEEK_API_KEY');
        const currentKey = typeof resolvedKey?.value === 'string' && /^[\x21-\x7e]+$/.test(resolvedKey.value) ? resolvedKey.value : null;
        const currentIdentity = createHash('sha256').update(JSON.stringify([currentRecord, currentKey])).digest('hex');
        if (identity !== currentIdentity) value = {version:1,status:'failed',error:'account-changed',wallets:[],fetchedAt:this.now()};
      } catch { value = {version:1,status:'failed',error:'storage-unavailable',wallets:[],fetchedAt:this.now()}; }
      return value;
    })();
    this.pending = {identity,promise};
    const value = await promise;
    // A changed credential's in-flight read may not overwrite the current cache.
    if (this.pending?.promise === promise) { this.cached = {identity,at:this.now(),ttl:value.status === 'ready' && value.costStatus !== 'failed' && value.costStatus !== 'expired' ? DAY : 60_000,value}; this.pending = null; }
    return value;
  }
  async query(issuer, token, key, configured) {
    let costStatus = token ? 'failed' : 'account-login-required';
    let reason;
    if (token) {
      try {
        const origin = new URL(issuer);
        if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new SummaryFault('invalid-issuer');
        const response = await this.request(new URL('/api/v0/users/get_user_summary', origin), {
          method:'GET',redirect:'error',signal:AbortSignal.any([this.lifetime.signal,AbortSignal.timeout(10_000)]), headers:{'x-dsh-auth-token':token,Origin:origin.origin,Referer:origin.origin+'/', 'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'},
        });
        const envelope = await boundedJson(response);
        if (envelope?.code === 40003 || envelope?.data?.biz_code === 40003) throw new SummaryFault('expired');
        if (envelope?.code !== 0 || envelope?.data?.biz_code !== 0) throw new SummaryFault('invalid-response');
        let wallets, costStatus;
        try { wallets = platformWallets(envelope.data.biz_data); costStatus = wallets.some(x=>x.totalCosts != null)?'ready':'unavailable'; }
        catch {
          // An unstable cost field must not discard otherwise valid wallet balances.
          wallets = platformWallets({...envelope.data.biz_data,total_costs:undefined}); costStatus = 'failed';
        }
        return { version:1,status:'ready',source:'platform',wallets,costStatus,fetchedAt:this.now() };
      } catch (error) { reason = error instanceof SummaryFault ? error.code : 'unavailable'; costStatus = reason === 'expired' ? 'expired' : 'failed'; }
    }
    if (key) {
      try {
        const response = await this.request('https://api.deepseek.com/user/balance', {method:'GET',redirect:'error',signal:AbortSignal.any([this.lifetime.signal,AbortSignal.timeout(10_000)]),headers:{Authorization:'Bearer '+key}});
        const result = await boundedJson(response);
        return {version:1,status:'ready',source:'api-key',wallets:apiWallets(result),isAvailable:result.is_available,costStatus,fetchedAt:this.now()};
      } catch (error) { reason = error instanceof SummaryFault ? error.code : 'unavailable'; }
    }
    return { version:1,status: configured ? 'failed' : 'unconfigured', wallets:[],error:reason || 'account-login-required',costStatus,fetchedAt:this.now() };
  }
}

export const name = 'mobile-account-summary';
export const inject = ['credentials','profileContext'];
export async function apply(ctx) {
  const require = createRequire(ctx.profileContext.installAnchor); const load = name => import(pathToFileURL(require.resolve(name)).href);
  const [protocol,connection] = await Promise.all([load('@deepseek-ai/dsh-typert-protocol'),load('@deepseek-ai/dsh-client-connection')]);
  const reader = new AccountSummaryReader({credentials:ctx.credentials});
  ctx.effect(() => () => reader.close());
  const initializers = [];
  class MobileAccount extends protocol.TypertRemoteService {
    constructor() { super(ctx,'mobileAccount'); for(const initialize of initializers) initialize.call(this); }
    async summary() {
      if (!(this.ctx.invocation?.peer instanceof connection.OperatorPeer)) throw new protocol.RemoteError('access-denied','access-denied',{});
      return reader.read();
    }
  }
  protocol.Remote(MobileAccount.prototype.summary,{kind:'method',name:'summary',static:false,private:false,addInitializer:initialize=>initializers.push(initialize)});
  new MobileAccount();
}
