// The upstream gateway is part of this Bundle, not a second installed Bundle.
// Keep its protocol, data paths and defaults unchanged for existing pairings.
import { apply as upstreamApply } from '../vendor/dsh-mobile/lib/project-index.mjs';
export * from '../vendor/dsh-mobile/lib/project-index.mjs';

export async function apply(ctx, config) {
  if (ctx.get('mobileAccess')) {
    throw new Error('mobile-access: another gateway is active; disable the old Bundle before enabling this Bundle');
  }
  return upstreamApply(ctx, config);
}
