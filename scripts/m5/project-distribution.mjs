import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
/** Public-safe metadata: never bundle private APK URLs or personal diagnostics services. */
export async function projectDistribution(root,{audience='public-beta'}={}){
 if(audience!=='public-beta')throw Error('Only public-safe distribution metadata is supported');
 const releaseNotes=await readFile(resolve(root,'desktop/mobile-extension/CHANGELOG.md'),'utf8');
 return Buffer.from(JSON.stringify({audience,androidDownloadAvailable:false,releaseNotes},null,2));
}
