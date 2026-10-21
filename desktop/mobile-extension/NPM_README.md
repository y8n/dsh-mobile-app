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

## Scope and limits

This beta validates npm distribution. It does not imply full regression on all host platforms or Huawei phones.
The GitHub repository remains private, so source/help/issue URLs require repository access.
Updating this plugin does not install or update the Android app. Keep the previous plugin version for rollback;
do not delete pairing files, certificates, workspaces or conversations during upgrade.

## License

Original project code and modifications: Apache-2.0. See LICENSE and NOTICE.
Original dsh-mobile authors and Apache-2.0 license are retained under the runtime vendor directory.
Third-party code retains its own terms; see THIRD_PARTY_NOTICES.md and runtime/distribution-notices.
Upstream DeepSeek Harness artwork/code credits and MIT license are retained. No trademark endorsement is claimed.
