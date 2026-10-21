// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
const numeric = '(?:0|[1-9][0-9]*)';
const identifier = '(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)';
const versionPattern = new RegExp(`^${numeric}\\.${numeric}\\.${numeric}(?:-(${identifier}(?:\\.${identifier})*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`);
export function releaseTag(version) {
  const match = typeof version === 'string' && version.match(versionPattern);
  assert.ok(match, 'An exact valid SemVer version is required');
  if (!match[1]) return 'latest';
  const channel = match[1].split('.')[0].toLowerCase();
  // A numeric prerelease cannot be used as an npm tag. Never promote a prerelease to latest.
  return /^[a-z][a-z0-9-]*$/.test(channel) && channel !== 'latest' ? channel : 'next';
}
