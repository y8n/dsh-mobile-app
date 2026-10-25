/** Source graph and patch relocation shared by packaging and source-only checks. */
export const runtimeModules = ['operator-admission.mjs', 'diagnostics.mjs', 'diagnostic-schema.mjs', 'diagnostic-event-schema.mjs', 'index.mjs', 'notification-feed.mjs', 'notification-copy.mjs', 'schedule-engine.mjs', 'session-admission.mjs', 'attachments.mjs', 'attachment-engine.mjs', 'search.mjs', 'search-policy.mjs', 'prompt-lookup.mjs', 'workspace-search.mjs', 'workspace-list.mjs', 'account-summary.mjs'];
export function relocateExtensionPatch(source, relative) {
  return source.replace(/name: '@dsh-mobile-app\/desktop-extension(?:\/([^']+))?'/g, (_, module) => {
    const file = module || 'index.mjs';
    if (!runtimeModules.includes(file) && !['gateway/index.mjs', 'vendor/dsh-mobile/packages/question-fixes/lib/index.mjs'].includes(file)) throw new Error('Unknown extension runtime module');
    return `name: './${relative}/${file}'`;
  });
}
