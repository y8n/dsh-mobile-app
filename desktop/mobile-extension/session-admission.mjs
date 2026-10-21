import { ScheduleFault } from './schedule-engine.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
export const admissionSha256 = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');

/** Only subagent parentage inherits archive admission; forks are independent. */
export async function sessionLineage(inspect, sessionId) {
  const lineage = []; const seen = new Set(); let id = sessionId;
  while (id) {
    if (seen.has(id) || lineage.length >= 128) throw new ScheduleFault('session-unavailable');
    seen.add(id); lineage.push(id);
    let header;
    try { header = (await inspect(id)).meta; } catch { throw new ScheduleFault('session-unavailable'); }
    if (!header || header.id !== id) throw new ScheduleFault('session-unavailable');
    if (header.origin !== 'subagent' || !header.parentSession) return lineage;
    id = header.parentSession;
  }
  return lineage;
}
export function assertUnarchived(lineage, archived) {
  if (lineage.some(id => archived.includes(id))) throw new ScheduleFault('session-archived');
}
