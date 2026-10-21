# DeepSeek Harness mobile desktop extension (beta)

> Based on **[saya-ch/dsh-mobile](https://github.com/saya-ch/dsh-mobile)** by **saya-ch and contributors**. Thank you for the gateway, pairing and mobile-access foundation. DeepSeek Harness provides the host and UI/artwork references. Original licenses and notices are retained. This is an unofficial project.

Package: `PUBLISH_PACKAGE_NAME`. This is the single desktop plugin for the project's native Android app,
combining dsh-mobile 0.6.3 access gateway with enhanced file, search, recovery, schedule, notification and account services.
Do not run a second dsh-mobile gateway alongside this bundle.

## Install

In DeepSeek Harness plugin management, add `PUBLISH_PACKAGE_NAME@beta` using the npm official registry.
For reproducible installation, replace beta with the exact published version. Refresh the plugin UI after upgrade.
Enable mobile access and configure your own LAN or remote connection in the plugin panel, then pair your phone.
No account keys, certificates, device pairing or personal tunnel settings are included in this package.

The recorded host baseline is DeepSeek Harness Desktop 0.2.0-rc.2, Node ^22.19.0 or >=24.
Schedule/query modules are hash checked; other host versions are not automatically supported.
The existing Android baseline is 0.1.1-alpha.20, but this npm beta does not distribute the personal test APK.
Phone background notifications still depend on Android/OEM background permission; this is not a system push guarantee.

## Connection setup guides

Use LAN at home and a remote tunnel away from home. The desktop network setup is inherited from **saya-ch/dsh-mobile**; see the original author’s [connection tutorial](https://github.com/saya-ch/dsh-mobile#连接教程).

| Connection | Detailed upstream guide |
| --- | --- |
| LAN / same Wi-Fi or hotspot | [LAN setup](https://github.com/saya-ch/dsh-mobile#局域网访问) |
| cpolar | [Remote access setup](https://github.com/saya-ch/dsh-mobile#远程访问) |
| Cloudflare quick / named tunnel | [Cloudflare Tunnel](https://github.com/saya-ch/dsh-mobile/blob/main/docs/CLOUDFLARE_TUNNEL.md) |
| Tailscale Funnel | [Remote access setup](https://github.com/saya-ch/dsh-mobile#远程访问) |
| Self-hosted FRP | [Deploy FRP](https://github.com/saya-ch/dsh-mobile/blob/main/docs/SELF_HOSTED_FRP.md) |
| Existing frps | [Attach an existing server](https://github.com/saya-ch/dsh-mobile/blob/main/docs/ATTACH_EXISTING_FRPS.md) |
| Your own HTTPS reverse proxy | [Reverse proxy setup](https://github.com/saya-ch/dsh-mobile/blob/main/docs/SELF_HOSTED_ORIGIN.md) |

Follow the upstream **desktop network configuration**, while continuing to use this package and this project’s Android app. Do not install a second gateway. Upstream documentation may describe newer capabilities; use the options available in your installed plugin and consult [compatibility](https://github.com/y8n/dsh-mobile-app/blob/main/docs/版本兼容说明.md).

Pair this app using the selected endpoint’s HTTPS address and pairing key. Add another route under the existing computer’s **Device settings → Connections → +**, then select the route manually. Follow [this app’s pairing and switching guide](https://github.com/y8n/dsh-mobile-app/blob/main/docs/guide/getting-started.md#建立手机与电脑的连接); upstream app discovery, scanning and automatic-connection instructions do not directly apply.

For repeated reconnects, see the upstream [slow-connection guide](https://github.com/saya-ch/dsh-mobile/blob/main/docs/SLOW_CONNECTIONS.md) and this project’s [phone diagnostics guide](https://github.com/y8n/dsh-mobile-app/blob/main/docs/guide/diagnostics.md).

## Scope and limits

This beta validates npm distribution. It does not imply full regression on all host platforms or Huawei phones.
The GitHub repository remains private, so source/help/issue URLs require repository access.
Updating this plugin does not install or update the Android app. Keep the previous plugin version for rollback;
do not delete pairing files, certificates, workspaces or conversations during upgrade.

## Enhancements over the original project

The original **saya-ch/dsh-mobile** provides the gateway, pairing, remote access and web-based functionality. The following describes this project’s native implementation and enhancements, not capabilities invented by this project. Screenshots use synthetic data. [Download the Android app](https://github.com/y8n/dsh-mobile-app/releases); installing this npm package does not install the app.

### 1. Native interface and interaction

Kotlin / Jetpack Compose replaces the original WebView container with native workspace, conversation and device settings pages. Compact execution rows and collapsed completed steps keep answers readable. The combined screenshot shows these three key pages.

<p align="center"><img src="https://raw.githubusercontent.com/y8n/dsh-mobile-app/main/docs/screenshots/native-pages-light.png" width="900" alt="Native interface and interaction"></p>

### 2. Native files and viewers

Open files on the paired computer, inspect diffs and preview images in native viewers. Markdown file links are resolved by the app without rewriting the original document. Code blocks support copying and line wrapping. The combined screenshot shows file changes, a diff, and the file-type/image component fixture.

<p align="center"><img src="https://raw.githubusercontent.com/y8n/dsh-mobile-app/main/docs/screenshots/file-viewers-light.png" width="900" alt="Native files and viewers"></p>

### 3. Multiple connection channels

Save LAN and tunnel connections for one computer: use LAN at home and a tunnel away from home, switching manually without adding the computer again. Gateway capabilities are inherited from the original project.

<p align="center"><img src="https://raw.githubusercontent.com/y8n/dsh-mobile-app/main/docs/screenshots/device-settings-light.png" width="300" alt="Multiple connection channels"></p>

### 4. Per-device usage time

View today and the last seven days of foreground use for each computer. Background time is excluded; usage records remain on the phone and can be cleared.

<p align="center"><img src="https://raw.githubusercontent.com/y8n/dsh-mobile-app/main/docs/screenshots/device-usage-light.png" width="300" alt="Per-device usage time"></p>

### 5. Account balances

View topped-up balance, bonus balance and cumulative spending. API values may differ from the official platform, which remains authoritative. Cumulative spending requires desktop account credentials; missing data is shown as unknown.

<p align="center"><img src="https://raw.githubusercontent.com/y8n/dsh-mobile-app/main/docs/screenshots/device-settings-light.png" width="300" alt="Account balances"></p>

### 6. Session notifications

Distinct icons and messages for completed answers, questions and permission requests. Tap to open the matching conversation; the currently visible conversation does not notify again. The screenshot uses synthetic events on an emulator and does not prove background delivery on physical phones. Android/OEM background permissions still apply.

<p align="center"><img src="https://raw.githubusercontent.com/y8n/dsh-mobile-app/main/docs/screenshots/notifications-light.png" width="300" alt="Session notifications"></p>

### 7. Git branch and uncertain-send recovery

Git workspaces show the current branch under the conversation title. When delivery is uncertain, the app retains the pending message and supports checking the real conversation or releasing the pending state. This screenshot shows the branch in a normal conversation, not an uncertain-send state.

<p align="center"><img src="https://raw.githubusercontent.com/y8n/dsh-mobile-app/main/docs/screenshots/conversation-branch-light.png" width="300" alt="Git branch and uncertain-send recovery"></p>

### 8. Diagnostic upload for troubleshooting

Logs stay on the phone by default. Upload from the selected computer’s device settings using the paired connection; reports are saved to that computer’s temporary directory, without cloud storage. Report IDs and local paths help developers and AI investigate. Automatic upload requires a separate opt-in.

<p align="center"><img src="https://raw.githubusercontent.com/y8n/dsh-mobile-app/main/docs/screenshots/device-diagnostics-light.png" width="300" alt="Diagnostic upload for troubleshooting"></p>

### Light and dark themes

The Android app follows the system theme by default, with fixed light and dark options.
The same conversation is shown below for comparison.

<p align="center">
  <img src="https://raw.githubusercontent.com/y8n/dsh-mobile-app/main/docs/screenshots/conversation-light.png" width="240" alt="Same conversation in light theme">
  <img src="https://raw.githubusercontent.com/y8n/dsh-mobile-app/main/docs/screenshots/conversation-dark.png" width="240" alt="Same conversation in dark theme">
</p>

## License

Original project code and modifications: Apache-2.0. See LICENSE and NOTICE.
Original dsh-mobile authors and Apache-2.0 license are retained under the runtime vendor directory.
Third-party code retains its own terms; see THIRD_PARTY_NOTICES.md and runtime/distribution-notices.
Upstream DeepSeek Harness artwork/code credits and MIT license are retained. No trademark endorsement is claimed.
