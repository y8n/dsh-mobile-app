# Third-party notices

This project's original code and its own modifications are Apache-2.0.
This does not relicense third-party material. Read LICENSE and NOTICE together
with each dependency's retained license. Copies of source, documents, executable
helpers and generated browser code have different scopes below.

- **dsh-mobile 0.6.3** — Apache-2.0, saya-ch and contributors. The original
  release files, source maps, authors, THIRD_PARTY_NOTICES, question-fixes license,
  and complete FUNNEL_THIRD_PARTY_LICENSES are preserved under
  `desktop/mobile-extension/vendor/dsh-mobile/`. Active derivatives and their
  changes are described by `desktop/mobile-extension/THIRD_PARTY_NOTICES.md`.
- **DeepSeek Harness** — MIT, Copyright (c) 2026 DeepSeek. The MIT text is in
  `docs/licenses/deepseek-harness-MIT.txt`. Source revisions and exported artwork
  are recorded in `legal/ASSET-SOURCES.json`; original files are not relabeled
  as solely authored by this project.
- **Android runtime** — exact resolved debug/release modules, declared/inherited
  POM licenses and embedded notices are in `legal/dependencies/android-runtime.json`
  and `android-texts/`. The generated APK assets include their readable notices.
- **Integrated plugin npm runtime** — the actual 62-package closure from the
  installation audited on 2026-10-17 is in `legal/dependencies/npm-runtime.json`;
  original license and NOTICE bytes are in `npm-texts/`. Host-provided peers are
  not copied into our plugin; the host retains its own terms and distribution.
- **Funnel executables** — complete embedded Go dependency notices and toolchain
  terms are in the retained `FUNNEL_THIRD_PARTY_LICENSES.txt`. npm's package
  license field does not replace these notices. Other optional remote-provider
  executables are downloaded separately only through their existing verified
  installers; their original licenses and service terms continue to apply.
- **Former development/reference tools** — personal Cloudflare/Vite tooling and
  deployment assets have been removed from the public source tree and preserved
  privately. Their earlier LGPL/MPL declarations do not apply to unrelated App
  code and do not authorize redistributing their binaries. Reintroducing any
  such toolchain requires a new license inventory.
- **Simple Icons** — reference-tool dependency, CC0-1.0; the original CC0 text
  is retained in `docs/licenses/simple-icons-CC0.txt`. CC0 does not grant
  trademark rights. Exported DeepSeek artwork has a separate provenance record;
  do not assume every exported SVG was sourced from Simple Icons.

DeepSeek and other technology names/logos identify their respective owners.
The black whale launcher artwork and branded file icons still require a brand
and artwork provenance review before public distribution; Apache-2.0 is not
an official-brand endorsement or a blanket permission to use those marks.

These inventories are snapshots, not a promise that future dependency updates
use identical licenses. Regenerate and review them before public distribution.
See `legal/README.md` for commands, coverage and remaining publication blockers.
