// SPDX-License-Identifier: Apache-2.0
// Retired HTTP/Cloudflare tooling is not part of the source tree or runtime.
import {writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
await writeFile(resolve(import.meta.dirname,'../../legal/dependencies/development.json'),'[]\n');
console.log('No independent development-tool dependency graph.');
