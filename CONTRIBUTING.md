# 开发与贡献

先阅读 [AGENTS.md](AGENTS.md)、[版本兼容说明](docs/版本兼容说明.md) 和 [许可来源](CREDITS.md)。
请保留 saya-ch/dsh-mobile 与 DeepSeek Harness 的版权、许可证和修改声明。

## 环境和构建

Android：JDK 17、Android SDK 36、Build Tools 35.0.0；使用仓库 Gradle Wrapper。
Node：使用插件 package.json 的 engines 范围（推荐 Node 24）。
设置 JAVA_HOME、ANDROID_HOME，或在适用的 macOS Homebrew 环境 source scripts/android-env.sh。

```sh
./gradlew :app:testDebugUnitTest :core:data:testDebugUnitTest :core:protocol:test :app:lintDebug
node --test desktop/mobile-extension/tests/*.test.mjs scripts/releases/tests/*.test.mjs
node scripts/releases/check-compatibility.mjs
node scripts/opensource/check.mjs
```

在修改与验证完成、版本和构建输入已提交后：

```sh
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest
```

APK 位于 app/build/outputs/apk/debug/。诊断默认仅存手机；可在单个设备设置页主动上传到该电脑，使用已配对连接的 RPC，不提供外部接收地址配置。
不要为绕过权限而修改联网、证书或生产数据；模拟器测试使用独立的虚构 fixture。

截图与日志边界测试：启动专用 API 35 模拟器，在已安装 App/test APK 后运行
`adb shell am instrument -w -e class dev.dsh.mobile.PublicShowcaseTest,dev.dsh.mobile.PublicDiagnosticsDefaultsTest,dev.dsh.mobile.DiagnosticSettingsTest dev.dsh.mobile.test/androidx.test.runner.AndroidJUnitRunner`。
截图写入 App 私有 files/public-showcase，以开发设备 run-as 读出；测试不连接正常电脑。

插件源码目录保持 private，不直接 npm pack/publish。构建、CI/OIDC 和回读验证见 [分发流程](docs/development/publishing.md)。
公开包不内嵌个人 APK 下载和个人诊断服务。已发布的 npm 版本不可覆盖，插件内容变化需递增版本。

## 提交与验证

提交消息使用 Conventional Commits，如 `fix(chat): 修复进入会话的滚动定位`。
说明问题、最终行为、验证范围和限制；UI 变化附浅/深色截图，使用虚构数据，基础功能与增强功能分别说明。
不要提交真实连接配置、密钥、运行日志、工作区或个人截图。敏感问题遵循 [SECURITY.md](SECURITY.md)。

第三方代码按原许可保留署名；新增依赖须检查许可证、原文和分发收录。截图、图标及字体也需要来源记录。
实际硬件/网络/宿主验证与受控测试分开记录，不能把模拟器通过写成华为后台保证。

维护者没有授权时，不公开仓库、不创建 Release、不发布 npm 或安装到正常电脑。
公开前检查不只看 HEAD，还要评估历史、其他 refs、Actions 日志、旧产物和服务归属。
