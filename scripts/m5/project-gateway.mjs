/** Build a derivative without changing the archived, integrity-locked upstream. */
export function projectGateway(source) {
  const start=source.indexOf('//#region src/release-update.ts');
  const end=source.indexOf('//#endregion',start);
  if(start<0||end<start||source.indexOf('//#region src/release-update.ts',start+1)>=0)throw Error('Unsupported upstream release region');
  let result=source.slice(0,start)+`// Project distribution replaces the upstream self-updater. Original retained in index.mjs.\nimport { ProjectReleaseManager as PluginReleaseManager, releaseProfileDirectory, PROJECT_PLUGIN_VERSION } from '../../../gateway/project-release.mjs';\n`+source.slice(end+'//#endregion'.length);
  const version='const DSH_MOBILE_VERSION = typeof manifest.version === "string" ? manifest.version : "unknown";';
  if(!result.includes(version))throw Error('Unsupported upstream version region');
  result=result.replace(version,'const DSH_MOBILE_VERSION = PROJECT_PLUGIN_VERSION;');
  if(/saya-ch\/dsh-mobile|registry\.npmjs\.org\/dsh-mobile/.test(result))throw Error('Legacy release reference remains in active gateway');
  return '// SPDX-License-Identifier: Apache-2.0\n// Original: dsh-mobile 0.6.3, saya-ch and contributors; original archive and license retained beside this derivative.\n// Modified by Y8n and contributors in 2026: project release metadata/updater replacement and project version.\n'+result;
}
