import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
import {projectGateway} from '../../../scripts/m5/project-gateway.mjs';
import {projectDistribution} from '../../../scripts/m5/project-distribution.mjs';
import {ProjectReleaseManager,PROJECT_PLUGIN_VERSION,PROJECT_LINKS,validDistribution} from '../gateway/project-release.mjs';
const root=new URL('../../../',import.meta.url).pathname;
test('active gateway removes old release fetcher and installer; original attribution remains intact',async()=>{
 const original=await readFile(new URL('../vendor/dsh-mobile/lib/index.mjs',import.meta.url),'utf8');const active=projectGateway(original);
 assert.ok(original.includes('github.com/saya-ch/dsh-mobile'));assert.ok(!active.includes('github.com/saya-ch/dsh-mobile'));assert.ok(!active.includes('registry.npmjs.org/dsh-mobile'));assert.ok(!active.includes('runPnpmUpdate'));assert.ok(!active.includes('class PluginReleaseManager'));assert.ok(active.includes('PROJECT_PLUGIN_VERSION'));
 assert.throws(()=>projectGateway('unexpected upstream source'));
 for(const file of ['LICENSE','THIRD_PARTY_NOTICES.md','FUNNEL_THIRD_PARTY_LICENSES.txt'])assert.ok((await readFile(new URL('../vendor/dsh-mobile/'+file,import.meta.url))).length>100);
});
test('project metadata has no personal APK URL and never installs an old npm package',async()=>{
 const distribution=JSON.parse(await projectDistribution(root));
 const status=await new ProjectReleaseManager({distribution}).status();
 assert.equal(status.installedVersion,PROJECT_PLUGIN_VERSION);assert.equal(status.updateSupported,false);assert.equal(status.updateAvailable,false);
 assert.equal(status.androidDownloadAvailable,false);assert.equal(status.androidDownloadUrl,undefined);
 assert.ok(status.releaseNotes.includes("电脑插件功能说明"));await assert.rejects(new ProjectReleaseManager({distribution}).update(),/project_update_via_plugin_manager/);
 for(const link of Object.values(PROJECT_LINKS))assert.ok(link.startsWith('https://github.com/y8n/dsh-mobile-app'));
 assert.throws(()=>validDistribution({...distribution,androidDownloadUrl:'https://example.invalid/private.apk'}));
});
test('browser cannot re-enable downloads or update actions from untrusted metadata',async()=>{
 const source=await readFile(new URL('../gateway/client.js',import.meta.url),'utf8');assert.ok(!source.includes('github.com/saya-ch/dsh-mobile'));
 const version=source.match(/function releaseVersion\(value\) \{([\s\S]*?)\n\t\t\}/)[0];
 const body=source.match(/function clientReleaseInfo\(data\) \{([\s\S]*?)\n\t\t\}/)[0];
 const info=vm.runInNewContext('const GITHUB_RELEASES_URL='+JSON.stringify(PROJECT_LINKS.downloads)+';'+version+body+';clientReleaseInfo');
 for(const url of ['javascript:alert(1)','https://example.invalid/private.apk']){
  const data=info({androidDownloadUrl:url,androidDownloadAvailable:true,updateAvailable:true,latestVersion:'99.0.0'});
  assert.equal(data.androidDownloadUrl,PROJECT_LINKS.downloads);assert.equal(data.androidDownloadAvailable,false);assert.equal(data.updateAvailable,false);
 }
 assert.ok(source.includes('style.dataset.plugin = "@dsh-mobile-app/gateway"'));assert.ok(source.includes('projectNotesBody.textContent'));
});
test('public npm beta excludes personal APK distribution and hides the browser download action',async()=>{
 const distribution=JSON.parse(await projectDistribution(root,{audience:'public-beta'}));
 const status=await new ProjectReleaseManager({distribution}).status();
 assert.equal(status.androidDownloadAvailable,false);
 assert.equal(status.androidDownloadUrl,undefined);
 assert.ok(!JSON.stringify(distribution).includes('r2.dev'));
 assert.ok(!JSON.stringify(distribution).includes('workers.dev'));
 assert.throws(()=>validDistribution({...distribution,androidDownloadUrl:'https://example.invalid/personal.apk'}));
 const source=await readFile(new URL('../gateway/client.js',import.meta.url),'utf8');
 assert.ok(source.includes('appDownload.hidden = !release.androidDownloadAvailable'));
});
