# Development and distribution rules

These rules apply to the entire repository. Preserve third-party attribution, licenses and modification notices.

- Work and verify in the current session. Do not invoke other agents or models for reviews.
- Use Conventional Commits: `<type>(<scope>): <subject>`. Do not mix unrelated changes into a commit.
- Before building, check git status and differences, verify changes, increment the relevant version and commit all build inputs. Record the source SHA. Changed build inputs require a new commit and rebuild.
- Android and desktop plugin are independent components in one repository. Do not force their version numbers to match.
- Every different Android APK needs a higher versionName and versionCode before building. Never overwrite a different artifact under the same version.
- After a successful build, explain changes since the last successful build, include actionable acceptance steps, and distinguish local, emulator and real-device coverage. Store build identity and evidence; do not inherit old verification results.
- Never publish a GitHub Release, change repository visibility, rewrite Git history or force push without explicit authorization. Current work is private open-source preparation.
- npm releases use the manual GitHub Actions + npm Trusted Publishing workflow. Ordinary pushes must not publish packages. Follow docs/development/publishing.md; push and verify the source SHA before dispatching. A request to commit alone does not authorize packaging or publishing.
- Do not directly publish desktop/mobile-extension: its private manifest protects the source directory. Publish only the assembled and verified tarball; never overwrite a version already present on npm.
- Install and maintain one desktop plugin only. Reuse the original dsh-mobile gateway/auth/event capabilities; preserve enhanced attachment, search, recovery, schedules, notifications and account APIs. Do not remove an existing service before validating its replacement.
- Do not restart the normal Desktop, clear pairing/certificates, or modify ordinary workspaces and conversations during tests. Use synthetic fixtures and isolated installations.
- Notifications must not rely on an unwanted permanent notification. Huawei phones without Google Play need explicit background permission testing; emulator/foreground checks do not prove locked-screen delivery. Separate server event, phone receipt, display and navigation verification.
- Public builds must have no developer-owned diagnostic endpoint or automatic upload default. Manual upload requires a user-selected paired computer; do not send without that selection. Diagnostic upload uses only the paired computer RPC mobileDiagnostics/upload; do not reintroduce custom HTTP/Cloudflare upload or embedded URLs/tokens. Selecting another computer disables automatic upload. Do not deploy or modify personal Cloudflare resources as part of preparation.
- Before public distribution, inspect source AND resulting APK/package for endpoints, credentials, personal data and license materials. Private historical evidence is archived locally; removing files from HEAD does not sanitize Git history, branches, tags, Actions logs or old artifacts.
- Do not remove attribution to saya-ch/dsh-mobile or DeepSeek Harness. Show the original author prominently in README; distinguish inherited features from enhancements and show basic features as well as UI changes using documented synthetic screenshots.
- Do not assert brand/trademark authorization based only on a source-code license. Keep internal rights/history decisions and development evidence in the maintainer’s Obsidian project documentation; keep public licensing facts in legal/README.md.
- First intended open-source series: 0.2.0; first prerelease: 0.2.0-beta.1. The npm beta.1 is already immutable; changed plugin packages must use a new version. Preparation does not authorize another npm release.

- Keep docs/ focused on public usage, contribution guides, screenshots and licenses. Development diaries, design iterations, diagnostics, build evidence and release receipts belong in the maintainer’s Obsidian vault under 项目文档/dsh-mobile-app, not in the source repository. Preserve attachments and verify hashes when migrating.

## Finding phone diagnostics on the receiving computer

- Reports are stored only on the paired computer in `path.join(os.tmpdir(), "dsh-mobile-app-diagnostics-" + (process.getuid?.() ?? "user"))`, then a profile hash and `hours/YYYY-MM-DD/HH/<journalId>/part-XXXXXXXX.json` (UTC). App receipts include the actual absolute localPath.
- To discover the root on that computer, run: `node -e 'const os=require("node:os"),p=require("node:path");console.log(p.join(os.tmpdir(),"dsh-mobile-app-diagnostics-"+(process.getuid?.()??"user")))'`.
- macOS uses the per-user system temp directory (often $TMPDIR), Linux usually /tmp, Windows usually %TEMP%. Never hardcode a maintainer-specific /var/folders path. A container/service may have a different temp environment: prefer the receipt's actual path.
- Ask for a report ID/path and incident time before reading diagnostic records; inspect the matching archive and trace IDs, not unrelated profiles or credentials. User-authorized local analysis does not authorize external sharing.
- Per-profile limit: 64 MiB, archive limit: 8 MiB, retention: seven days since last archive update (pruned on upload). System temp cleanup may remove files earlier. Copy needed evidence into private Obsidian project documentation; do not commit real logs.
- Do not remove .write-lock while a receiving profile is running. If a crash leaves a stale lock, stop/confirm the profile is stopped before removing the lock. See docs/guide/diagnostics.md.
