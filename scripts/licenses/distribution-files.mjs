// SPDX-License-Identifier: Apache-2.0
import {readFile,readdir} from 'node:fs/promises';import {resolve,join} from 'node:path';
/** Include legal material in future packages; no runtime dependency changes. */
export async function pluginLegalFiles(root){
 const files={};
 for(const name of ['LICENSE','NOTICE','THIRD_PARTY_NOTICES.md','legal/ASSET-SOURCES.json','legal/dependencies/npm-runtime.json','docs/licenses/deepseek-harness-MIT.txt'])files[name]=await readFile(resolve(root,name));
 for(const name of (await readdir(resolve(root,'legal/dependencies/npm-texts'))).sort())files['legal/dependencies/npm-texts/'+name]=await readFile(resolve(root,'legal/dependencies/npm-texts',name));
 return files;
}
