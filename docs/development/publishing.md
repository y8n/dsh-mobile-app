# 构建与发布

Android 与电脑插件同仓库、分别发布。本文介绍可复用的发布约定；具体运行日志、验收截图和分发收据在维护者项目文档中管理，不写入源码仓库。

## 版本与构建输入

Android 版本在 `app/build.gradle.kts`，插件版本在 `desktop/mobile-extension/package.json`，兼容配置在 [config/compatibility.json](../../config/compatibility.json)。修改版本后运行：

```sh
node scripts/releases/check-compatibility.mjs
```

完成相关测试并提交所有构建输入，再从该提交构建。不同内容的 APK 必须递增 versionName 和 versionCode；npm 已发布版本不可覆盖。保留源码 SHA、版本、SHA-256 和验证范围，以便回读与回滚。完整开发环境见 [CONTRIBUTING](../../CONTRIBUTING.md)。

## Android

正式分发使用 [Android 发布签名流程](android-signing.md)。下面的 Debug 命令仅用于开发验证；签名工作流手动触发，默认不创建 Release。

```sh
./gradlew :app:assembleDebug
```

产物位于 `app/build/outputs/apk/debug/`。分发前核对 APK 实际版本、签名和许可 assets；诊断日志默认只存手机，上传仅通过已配对电脑的鉴权 RPC，不配置外部接收地址。电脑端临时目录及接口见[诊断日志指南](../guide/diagnostics.md)。

## 电脑插件

源码目录保持 `private: true`。使用固定上游和项目组装器，不直接对源码目录执行 npm publish：

```sh
node scripts/m5/pack-extension.mjs --public --publish-name=@YOUR_SCOPE/YOUR_PACKAGE
node scripts/m5/verify-extension-package.mjs
```

请将示例包名替换为有权发布的包名。组装器会收录网关、平台资源和第三方许可证。安装验证先在隔离目录进行；升级正常 Desktop 前保留配对、证书和配置，只启用一个移动访问插件。

## GitHub Actions 与 npm

`.github/workflows/npm-publish.yml` 仅手动触发，普通推送不发布 npm。使用 npm Trusted Publishing 的 GitHub OIDC 身份，不提交长期发布 Token。

维护者授权发布后，先提交并推送目标源码，回读确认完整 SHA，再从默认分支触发工作流，传入 `mode=publish`、`source_ref`、`expected_sha`、`version`。工作流检查版本、测试、组装和验包，再发布并下载回读；精确版本与目标分发标签都须在隔离目录安装验证。

`mode=validate` 不构建或发布，读取 `config/releases/npm/<version>.json` 的公开产物身份，验证已有包。新版本成功发布后添加其包名、版本、源码提交、哈希和 registry integrity；详细执行记录不放入该配置。

工作流支持公开和私有仓库；仅允许本仓库从 main 手动触发，fork 仍需自行配置仓库校验与可信发布绑定。正式版使用 latest 标签，预发布使用版本前缀（如 alpha、beta、rc）；纯数字前缀或 latest 预发布前缀使用 next，避免误推到正式通道。安装成功只证明包可安装，不代替真实宿主功能及手机后台通知测试。发布失败后先核对 registry 是否已接收该版本，不重复发布或改写同版本产物。

发布不自动创建 GitHub Release，也不改变仓库可见性。

## 首次公开与正式版准备

公开前逐项核对：

- 默认分支应包含准备公开的源码和文档；仅推送功能分支不会更新仓库首页。
- 检查所有拟公开历史、分支、标签、Release 资产及 Actions 日志/产物。旧测试包、评审压缩包和个人联调记录必须单独审查；HEAD 检查不覆盖这些内容。
- 在 Release 提供已核验的配套 APK、插件要求、校验值及验收范围；确认 README 下载入口指向的实际资产与当前说明一致。
- 确定 Android 分发签名及密钥保管方式，验证后续版本可覆盖安装。assembleDebug 仅生成调试签名包，不等于稳定分发签名方案。
- 检查 npm 标签和所需能力是否匹配；新 App 的日志上传需要包含 mobileDiagnostics/upload 的插件。
- npm 工作流接受精确 SemVer，不限制仓库可见性；发布前仍需验证分发标签与 Trusted Publishing 绑定。SHA、包名、来源分支和禁止覆盖已有版本等保护始终保留。
- 确认安全漏洞的私密报告入口可用，重采发生变化的 UI 截图，并对新产物重新检查隐私和许可证。

上述检查不自动授权公开仓库、删除旧资产或发布新版本。
