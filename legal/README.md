# 许可证、署名与依赖检查

项目原创代码及本项目修改采用 Apache-2.0。第三方部分按自身许可保留；
根 LICENSE 不改变 MIT、BSD、ISC、0BSD、CC0 或开发工具链的 LGPL/MPL 条款。
版权主体写为 Y8n 与项目贡献者；上游作者、版权行及完整许可不替换为项目名。

## 清单覆盖范围

- 老插件 dsh-mobile 0.6.3：固定 npm 归档的 53 个非二进制文件保持原字节，
  原始许可证、贡献者、第三方说明和 question-fixes 许可保留。
- 实际修改的网关浏览器文件和构建生成的服务器衍生文件，文件头新增来源与修改声明。
  固定原档不修改；不能以 Git 日志代替修改文件本身的声明。
- DeepSeek Harness MIT 来源、导出的文件/插件图标以及鲸鱼矢量资源，按文件 SHA-256
  记录于 ASSET-SOURCES.json。Kotlin 分类移植和原生图标包装注明来源与修改，
  分类生成器也保留这些声明，避免下次生成丢失。二进制资源使用邻近清单而非伪造文件头。
- Android：解析当前 debugRuntimeClasspath、releaseRuntimeClasspath 中实际模块，
  共 100 个。POM 无直接 license 时递归继承父 POM，保留 JAR/AAR/classes.jar
  内的 LICENSE/NOTICE/COPYING。许可声明均已解析，为 Apache-2.0、BSD-2-Clause、
  BSD-3-Clause。记录是许可元数据/文本审查，不是对每行依赖源码的权属鉴定。
- AndroidX 的 shaded protobuf 模块 POM 为 BSD-3-Clause，发布 sources.jar 为空；
  已附官方 protobuf BSD 原文与 Google 版权行。元数据未证明精确嵌入源码修订，
  清单明确记录这一边界，不把文本补充说成已完成嵌入版本核验。
- 插件：当前安装的 62 个 npm 运行依赖全部找到原始许可文件；逐文件 SHA-256
  保存到 npm-texts，含原版权及 NOTICE，不用无作者的通用 MIT 模板替代。
  许可为 MIT、BSD-3-Clause、ISC、Apache-2.0、0BSD。此清单是当前解析快照，
  并不冻结 npm 的未来传递依赖。宿主提供的 DeepSeek/Cordis 等 peer 不随本插件重新打包。
- Funnel：三平台二进制保持上游完整 36 个 Go 模块及 Go 工具链许可声明。
  这些声明与 npm 依赖是不同闭包，不相互替代。可选远程组件沿用自身许可证/服务条款。
- 旧个人 Cloudflare/Vite 工具的历史记录已迁至维护者的 Obsidian 项目文档。日志上传仅使用已配对电脑的插件接口，没有独立云端工具依赖。
  当前公开源码没有这些工具链锁文件或二进制，development.json 为空；不把旧清单当成当前 App 依赖。
  若重新引入工具或发布开发环境，需要重新核对其许可与源代码义务。
- Gradle wrapper 属构建工具，原版权/Apache 头不动。Gradle 下载到忽略目录，
  其发行包自己的 LICENSE/NOTICE 随原发行包保留，不并入 App 原创许可。

## 分发路径

APK：prepareLegalAssets 在 preBuild 前将 LICENSE、NOTICE、第三方说明、
Android 清单、全文及图标来源写到 assets/licenses。这个任务本身不创建 APK。
每个待分发 APK 都需要检查实际 assets，不能用源码或预生成目录检查代替产物核验。

插件：打包器把根 LICENSE/NOTICE/THIRD_PARTY_NOTICES 放入包根，并在内容地址
runtime/distribution-notices 中包含完整 npm 许可清单及全文。原始上游目录照常保留。
验包器检查缺失许可。源码检查、已安装包与待发布包属于不同输入，必须分别核验。
下次正式打包应先更新版本并提交源码，不能覆盖已有同名版本产物。

## 复核命令

```sh
source scripts/android-env.sh
./gradlew -I scripts/licenses/android.init.gradle :app:collectLicenseCoordinates
python3 scripts/licenses/android-audit.py
node scripts/licenses/npm-audit.mjs /path/to/installed/desktop-extension
node scripts/licenses/development-audit.mjs
./gradlew :app:prepareLegalAssets :core:protocol:test
node scripts/licenses/check.mjs
node --test desktop/mobile-extension/tests/*.test.mjs
```

npm 审查只读取指定安装包及其 dependencies，不扫描其他用户插件、凭据或配对文件。
默认路径为本项目的隔离测试安装目录；显式指定路径时，只审查该路径对应的安装包。
check 脚本验证许可文件、哈希、归档、源声明及预生成资源；不能替代人工处理新许可。
清单中不保存本机 Gradle cache 路径、密钥、Cookie 或诊断正文。

## 持续分发要求

1. **品牌与图标**：源码 MIT/Apache 不自动授权 DeepSeek 黑鲸鱼或其他品牌标记。
   保留出处，按各资源和名称允许的用途使用；内部确认记录由维护者独立保存。
2. **诊断数据边界**：当前仅通过已配对电脑的鉴权接口上传，默认只保存在手机；
   每次分发仍需检查实际 APK 与插件包，确认没有旧个人接收地址或凭据。
   旧测试产物与历史提交不因当前源码修正而自动安全；公开前应单独审查。
3. **发布时重新解析**：更新依赖、图标、预构建 JS 或二进制后重新生成清单，
   对新增/改变的许可逐项审查。当前结果不是未来版本的自动许可担保。
4. **protobuf 来源细化**：如果后续向外分发需要精确源码追溯，补齐 AndroidX shaded
   protobuf 对应源码修订；现有声明和官方 BSD 文本保持保留。

许可检查仅覆盖当次输入，不自动继承为后续版本的验证结果。
