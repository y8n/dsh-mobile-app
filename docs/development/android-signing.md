# Android 发布签名

发布 APK 使用本项目独立的 RSA 发布密钥。私钥、口令及其备份不得放入源码、日志或构建产物；仓库只保留公开证书指纹和签名轮换证明，见 `config/android-signing/`。

## 从旧包覆盖升级

最早的发布包使用维护者本机的调试证书。签名流程同时提供旧、新签名密钥，通过 `apksigner --lineage --rotation-min-sdk-version 28` 生成轮换签名：

- Android 9 / API 28 及以上使用新发布证书，并携带旧证书授权的签名历史。
- Android 8 / API 26–27 不支持签名轮换，使用旧证书生成兼容签名，因此旧密钥也必须长期保管。
- Release 构建关闭调试能力；“旧证书兼容签名”不表示 APK 是 Debug 构建。
- 仅与指定旧证书签署的版本兼容。其他电脑或普通 CI 随机生成的 debug 签名不是同一身份，不能承诺覆盖安装。
- 不直接用新证书单独签名替换旧包，不覆盖同版本已发布产物；迁移后不保证可以降级安装旧包。

官方机制说明：[Android apksigner](https://developer.android.com/tools/apksigner)。平台签名验证与实际设备的数据保留测试须分别记录。

## 本地构建与签名

先递增 Android 版本、完成检查并提交构建输入。准备 JDK 17、Android SDK 36 和 Build Tools 35.0.0。

```sh
./gradlew :app:testReleaseUnitTest :app:lintRelease :app:assembleRelease
python3 scripts/releases/sign-android.py \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  /your/output/dsh-mobile-app-VERSION.apk
```

签名脚本从环境变量读取 `ANDROID_HOME`、`DSH_ANDROID_RELEASE_KEYSTORE`、`DSH_ANDROID_RELEASE_PASSWORD`、`DSH_ANDROID_LEGACY_KEYSTORE`、`DSH_ANDROID_LEGACY_PASSWORD`。通过受保护的本机凭据存储注入；不要在终端命令或 shell 历史直接写入口令。

新密钥别名为 `dsh-release`，兼容密钥别名为 `legacy`。脚本检查固定证书指纹、轮换证明、包名、不可调试属性与许可证，并分别验证 API 26–27、28–32、33–36 的签名及 APK 对齐。已有输出文件会被拒绝覆盖。旁边的 JSON 仅含公开产物身份，不包含私钥或口令。

## GitHub Actions

`Signed Android` 工作流仅允许在本仓库 main 上手动运行，要求传入已经推送的完整 `expected_sha`。普通推送和 PR 不接触签名密钥。配置四个 repository Secrets：

- `DSH_ANDROID_RELEASE_KEYSTORE_BASE64`
- `DSH_ANDROID_RELEASE_PASSWORD`
- `DSH_ANDROID_LEGACY_KEYSTORE_BASE64`
- `DSH_ANDROID_LEGACY_PASSWORD`

密钥只在签名步骤解码到 runner 临时目录，完成或失败后删除；仅上传签名 APK 与公开身份 JSON，保留七天。工作流不会自动打标签、创建 Release 或覆盖已有版本；正式分发需按发布约定另行授权。

## 保管与恢复

密钥和口令应有离线或异地备份，备份后核对哈希和证书指纹。GitHub Secrets 不能作为唯一备份：无法从界面取回原值。维护者本地存放位置记录在私有项目文档中，不写入公开仓库。
