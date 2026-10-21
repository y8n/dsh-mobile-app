// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Y8n and contributors. MIT artwork credits: legal/ASSET-SOURCES.json.
// Generated mapping for original DSH artwork; no remote image requests.
package dev.dsh.mobile.ui

import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.platform.testTag
import dev.dsh.mobile.R
import dev.dsh.mobile.protocol.*

@Composable fun DshFileIcon(path: String = "", modifier: Modifier = Modifier, kind: DshFileType? = null, projectFiles: Map<String, String?>? = null) {
    val type = kind ?: dshFileType(path, projectFiles)
    val drawable = when(type) {
        DshFileType.ANGULAR -> R.drawable.dsh_file_angular
        DshFileType.C -> R.drawable.dsh_file_c
        DshFileType.CLOJURE -> R.drawable.dsh_file_clojure
        DshFileType.CMAKE -> R.drawable.dsh_file_cmake
        DshFileType.CPP -> R.drawable.dsh_file_cpp
        DshFileType.CSHARP -> R.drawable.dsh_file_csharp
        DshFileType.CSS -> R.drawable.dsh_file_css
        DshFileType.DART -> R.drawable.dsh_file_dart
        DshFileType.DOCKER -> R.drawable.dsh_file_docker
        DshFileType.ELIXIR -> R.drawable.dsh_file_elixir
        DshFileType.ENV -> R.drawable.dsh_file_env
        DshFileType.ERLANG -> R.drawable.dsh_file_erlang
        DshFileType.FLUTTER -> R.drawable.dsh_file_flutter
        DshFileType.GIT -> R.drawable.dsh_file_git
        DshFileType.GO -> R.drawable.dsh_file_go
        DshFileType.GRAPHQL -> R.drawable.dsh_file_graphql
        DshFileType.HASKELL -> R.drawable.dsh_file_haskell
        DshFileType.INI -> R.drawable.dsh_file_ini
        DshFileType.JAVA -> R.drawable.dsh_file_java
        DshFileType.JAVASCRIPT -> R.drawable.dsh_file_javascript
        DshFileType.JSON -> R.drawable.dsh_file_json
        DshFileType.KOTLIN -> R.drawable.dsh_file_kotlin
        DshFileType.LUA -> R.drawable.dsh_file_lua
        DshFileType.MAKEFILE -> R.drawable.dsh_file_makefile
        DshFileType.NODE -> R.drawable.dsh_file_node
        DshFileType.OBJECTIVE_C -> R.drawable.dsh_file_objective_c
        DshFileType.PERL -> R.drawable.dsh_file_perl
        DshFileType.PHP -> R.drawable.dsh_file_php
        DshFileType.POWERSHELL -> R.drawable.dsh_file_powershell
        DshFileType.PROTOBUF -> R.drawable.dsh_file_protobuf
        DshFileType.PYTHON -> R.drawable.dsh_file_python
        DshFileType.R -> R.drawable.dsh_file_r
        DshFileType.REACT -> R.drawable.dsh_file_react
        DshFileType.RUBY -> R.drawable.dsh_file_ruby
        DshFileType.RUST -> R.drawable.dsh_file_rust
        DshFileType.SCALA -> R.drawable.dsh_file_scala
        DshFileType.SHELL -> R.drawable.dsh_file_shell
        DshFileType.SOLIDITY -> R.drawable.dsh_file_solidity
        DshFileType.SQL -> R.drawable.dsh_file_sql
        DshFileType.SVELTE -> R.drawable.dsh_file_svelte
        DshFileType.SWIFT -> R.drawable.dsh_file_swift
        DshFileType.TOML -> R.drawable.dsh_file_toml
        DshFileType.TYPESCRIPT -> R.drawable.dsh_file_typescript
        DshFileType.VUE -> R.drawable.dsh_file_vue
        DshFileType.WASM -> R.drawable.dsh_file_wasm
        DshFileType.XML -> R.drawable.dsh_file_xml
        DshFileType.YAML -> R.drawable.dsh_file_yaml
        DshFileType.ZIG -> R.drawable.dsh_file_zig
        DshFileType.CODE -> R.drawable.dsh_file_code
        DshFileType.EXCEL -> R.drawable.dsh_file_excel
        DshFileType.FOLDER -> R.drawable.dsh_file_folder
        DshFileType.HTML -> R.drawable.dsh_file_html
        DshFileType.IMAGE -> R.drawable.dsh_file_image
        DshFileType.MARKDOWN -> R.drawable.dsh_file_markdown
        DshFileType.OTHER -> R.drawable.dsh_file_other
        DshFileType.PDF -> R.drawable.dsh_file_pdf
        DshFileType.PPT -> R.drawable.dsh_file_ppt
        DshFileType.VIDEO -> R.drawable.dsh_file_video
        DshFileType.WORD -> R.drawable.dsh_file_word
    }
    Image(painterResource(drawable), null, modifier.testTag("file_icon_${type.name.lowercase()}"))
}
