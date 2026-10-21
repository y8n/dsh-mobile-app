import {readFileSync} from 'node:fs';
export const PROJECT_PLUGIN_VERSION=JSON.parse(readFileSync(new URL('../package.json',import.meta.url))).version;
export const PROJECT_URL='https://github.com/y8n/dsh-mobile-app';
export const PROJECT_LINKS=Object.freeze({home:PROJECT_URL,downloads:PROJECT_URL,updates:PROJECT_URL+'/commits/main',help:PROJECT_URL+'/blob/main/docs/README.md',feedback:PROJECT_URL+'/issues'});
export function validDistribution(value){
 if(value?.audience!=='public-beta'||value.androidDownloadAvailable!==false||value.androidDownloadUrl||typeof value.releaseNotes!=='string')throw Error('Invalid public distribution');
 return Object.freeze({audience:'public-beta',androidDownloadAvailable:false,releaseNotes:value.releaseNotes.slice(0,4000),metadataSource:'bundled-public-beta'});
}
// No pnpm self-update, registry query, old Android release API, or credential access.
export const releaseProfileDirectory=()=>undefined;
export class ProjectReleaseManager {
 constructor({distribution}={}){this.distribution=validDistribution(distribution??JSON.parse(readFileSync(new URL('./project-distribution.json',import.meta.url),'utf8')));}
 async status(){return {installedVersion:PROJECT_PLUGIN_VERSION,latestVersion:PROJECT_PLUGIN_VERSION,updateAvailable:false,updateSupported:false,updateMode:'project-plugin-manager',...this.distribution,...PROJECT_LINKS};}
 async update(){throw new Error('project_update_via_plugin_manager');}
}
