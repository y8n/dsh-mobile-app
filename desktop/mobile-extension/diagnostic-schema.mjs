// SPDX-License-Identifier: Apache-2.0
import schema from './diagnostic-event-schema.mjs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HOUR = 3_600_000, PART = 10_000, MAX_BODY = 512 * 1024;
const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
const keysAre = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
const fail = (status, code) => { throw Object.assign(new Error(code), { status, code }); };
export function validateReport(report) {
  if (!keysAre(report, ['schema','reportId','appVersion','versionCode','sdk','journalId','hour','part','events']) || report.schema !== 2 || !UUID.test(report.reportId) || !UUID.test(report.journalId) ||
      typeof report.appVersion !== 'string' || !/^[0-9A-Za-z.+-]{1,64}$/.test(report.appVersion) || !integer(report.versionCode,1,1_000_000) || !integer(report.sdk,26,1000) ||
      !integer(report.hour,0,4_102_444_800_000) || report.hour % HOUR || !integer(report.part,0,Number.MAX_SAFE_INTEGER / PART - 1) ||
      !Array.isArray(report.events) || report.events.length < 1 || report.events.length > 500) fail(400,'invalid-report');
  let previous = -1;
  for (const event of report.events) {
    const keys = ['at','stage','trace','endpoint','durationMs','status','code','attempt','seq','network','build'];
    if (Object.hasOwn(event ?? {},'runtime')) keys.push('runtime');
    if (!keysAre(event,keys) || !integer(event.at,0,4_102_444_800_000) || Math.floor(event.at/HOUR)*HOUR !== report.hour ||
        !integer(event.seq,0,Number.MAX_SAFE_INTEGER) || event.seq <= previous || Math.floor(event.seq/PART) !== report.part ||
        !schema.stages.includes(event.stage) || !schema.codes.includes(event.code) || !schema.endpoints.includes(event.endpoint) || !UUID.test(event.trace) ||
        !integer(event.durationMs,0,HOUR) || !integer(event.status,0,599) || !integer(event.attempt,0,1000) || !integer(event.build,1,1_000_000) ||
        !['unknown','wifi','cellular','ethernet','vpn','offline'].includes(event.network)) fail(400,'invalid-event');
    previous=event.seq;
    if (Object.hasOwn(event,'runtime') && (!keysAre(event.runtime,schema.runtimeKeys) || !UUID.test(event.runtime.run) || !integer(event.runtime.importance,0,1000) ||
        schema.runtimeKeys.filter(k=>!['run','importance'].includes(k)).some(k=>typeof event.runtime[k] !== 'boolean'))) fail(400,'invalid-runtime');
  }
  const date = new Date(report.hour).toISOString();
  return `hours/${date.slice(0,10)}/${date.slice(11,13)}/${report.journalId}/part-${String(report.part).padStart(8,'0')}.json`;
}
