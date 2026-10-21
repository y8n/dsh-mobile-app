#!/usr/bin/env python3
"""Port DSH classification tables without hand-maintained extension lists."""
from pathlib import Path
import re,json
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'.reference/deepseek-harness/packages/client/ui-primitives/src'
code=(SOURCE/'code-file-types.ts').read_text(); traditional=(SOURCE/'FileTypeIcon.tsx').read_text()
def section(src,name):
    return re.search(r'const '+name+r'[^=]*=\s*([\[{].*?[\]}])(?:\s+as const)?\s*\n',src,re.S)[1]
def pairs(src,name): return re.findall(r"['\"]?([\w.+-]+)['\"]?\s*:\s*'([^']+)'",section(src,name))
def listpairs(src,name): return re.findall(r"\['([^']+)', '([^']+)'\]",section(src,name))
codes=re.findall(r"'([^']+)'",section(code,'CODE_FILE_TYPES'))
# CODE_FILE_TYPES is exported, section still finds its const declaration.
traditionals=['code','excel','folder','html','image','markdown','other','pdf','ppt','video','word']
types=codes+traditionals
assert len(types)==59 and len(set(types))==59
ident=lambda x:x.replace('-','_').upper()
q=lambda s:json.dumps(s,ensure_ascii=False)
lines=['// SPDX-License-Identifier: Apache-2.0 AND MIT', '// Original classification: Copyright (c) 2026 DeepSeek, MIT; docs/licenses/deepseek-harness-MIT.txt.', '// Ported and modified by Y8n and contributors in 2026: native Kotlin classification, bounded path handling and Android integration.', '// Generated from DSH 639ed015397290b3745d163aafe02ffee4aa3f84; run scripts/files/sync-dsh-file-types.py.',
'package dev.dsh.mobile.protocol','', 'import java.util.Locale','',
'enum class DshFileType { '+', '.join(map(ident,types))+' }','',
'fun dshFileBasename(path: String): String = path.substringAfterLast(\'/\').substringAfterLast(\'\\\\\')',
'fun dshFileExtension(path: String): String = dshFileBasename(path).substringAfterLast(\'.\', "")','']
def table(name,values):
    lines.append('private val '+name+' = mapOf(')
    lines.extend('    '+q(k)+' to DshFileType.'+ident(v)+',' for k,v in values)
    lines.append(')\n')
table('codeNames',pairs(code,'FILE_NAME_TYPES')); table('codePrefixes',listpairs(code,'FILE_NAME_PREFIX_TYPES')); table('codeSuffixes',listpairs(code,'FILE_NAME_SUFFIX_TYPES')); table('codeExtensions',pairs(code,'EXTENSION_TYPES')); table('traditionalNames',pairs(traditional,'NAME_TYPES')); table('traditionalExtensions',pairs(traditional,'EXTENSION_TYPES'))
links=re.findall(r"'([^']+)'",re.search(r'const LINK_CODE_EXTENSIONS = new Set\(\[(.*?)\]\)',code,re.S)[1])
lines+=['private val linkCodeExtensions = setOf('+', '.join(map(q,links))+')',
'fun isDshLinkCodeExtension(extension: String): Boolean = extension.lowercase(Locale.ROOT) in linkCodeExtensions','',
'/** Same precedence and optional project snapshot as DSH classifyFileType; never reads host files. */',
'fun dshFileType(path: String, projectFiles: Map<String, String?>? = null): DshFileType {',
'    val name = dshFileBasename(path).lowercase(Locale.ROOT)',
'    val extension = dshFileExtension(name)',
'    codeNames[name]?.let { return it }',
'    codePrefixes.entries.firstOrNull { name.startsWith(it.key) }?.let { return it.value }',
'    codeSuffixes.entries.firstOrNull { name.endsWith(it.key) }?.let { return it.value }',
'    if (extension == "dart" && projectFiles?.entries?.firstOrNull { dshFileBasename(it.key).lowercase(Locale.ROOT) == "pubspec.yaml" }?.value?.contains("flutter:") == true) return DshFileType.FLUTTER',
'    return codeExtensions[extension] ?: traditionalNames[name] ?: traditionalExtensions[extension] ?: DshFileType.OTHER',
'}','']
(ROOT/'core/protocol/src/main/kotlin/dev/dsh/mobile/protocol/DshFileTypes.kt').write_text('\n'.join(lines))
ui=['// SPDX-License-Identifier: Apache-2.0', '// Copyright 2026 Y8n and contributors. MIT artwork credits: legal/ASSET-SOURCES.json.', '// Generated mapping for original DSH artwork; no remote image requests.', 'package dev.dsh.mobile.ui','',
'import androidx.compose.foundation.Image','import androidx.compose.runtime.Composable','import androidx.compose.ui.Modifier','import androidx.compose.ui.res.painterResource','import androidx.compose.ui.platform.testTag','import dev.dsh.mobile.R','import dev.dsh.mobile.protocol.*','',
'@Composable fun DshFileIcon(path: String = "", modifier: Modifier = Modifier, kind: DshFileType? = null, projectFiles: Map<String, String?>? = null) {',
'    val type = kind ?: dshFileType(path, projectFiles)',
'    val drawable = when(type) {']
ui+=['        DshFileType.'+ident(t)+' -> R.drawable.dsh_file_'+t.replace('-','_') for t in types]
ui+=['    }','    Image(painterResource(drawable), null, modifier.testTag("file_icon_${type.name.lowercase()}"))','}','']
(ROOT/'app/src/main/java/dev/dsh/mobile/ui/DshFileIcon.kt').write_text('\n'.join(ui))
(ROOT/'scripts/oct15/reference-ui/file-types.json').write_text(json.dumps(types,indent=2)+'\n')
# Cases sent to the ORIGINAL browser classifier for an independent differential check.
cases=list(dict.fromkeys([k for k,v in pairs(code,'FILE_NAME_TYPES')]+['Dockerfile.dev','.env.production','app.component.ts','app.component.html','app.directive.ts','app.service.ts','app.module.ts','app.pipe.ts','app.guard.ts','app.interceptor.ts','prod.dockerfile']+['sample.'+k for k,v in pairs(code,'EXTENSION_TYPES')]+[k for k,v in pairs(traditional,'NAME_TYPES')]+['sample.'+k for k,v in pairs(traditional,'EXTENSION_TYPES')]+['unknown.bin','noextension','.unknown','file.','C:\\notes\\README','/a/UPPER.TSX']))
(ROOT/'scripts/oct15/reference-ui/file-type-cases.json').write_text(json.dumps(cases,indent=2)+'\n')
print('Synced',len(types),'file types;',len(cases),'classification cases.')
