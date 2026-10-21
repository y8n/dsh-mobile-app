# 致谢与来源

## 首先感谢原作者 saya-ch

本项目基于 **[saya-ch/dsh-mobile](https://github.com/saya-ch/dsh-mobile)**。
原作者 **saya-ch 及其贡献者**提供了移动访问、HTTPS/证书与设备配对、局域网/远程通道、网页触屏适配、CLI 和扩展基础。
本项目不是从零实现这些能力，也不将其归为本项目原创。

整合基线为 dsh-mobile **0.6.3**，源码修订 `696dae1ee4ad8010ee9e9551af954fde49463078`，Apache-2.0。
固定 npm 归档、原始源码映射、原始 LICENSE、第三方与 Funnel 许可仍保存在 `desktop/mobile-extension/vendor/dsh-mobile/`；
三个平台二进制由构建器从锁定归档提取并逐文件验证。本项目修改的衍生文件保留了显著来源与修改声明。

## 感谢 DeepSeek Harness

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 是本项目依赖的电脑宿主，
同时提供协议、组件参考、文件类型分类和图标资源。相关来源基线为 `639ed015397290b3745d163aafe02ffee4aa3f84`，MIT。
版权原文与资源清单见 [MIT 许可](docs/licenses/deepseek-harness-MIT.txt)、[资源来源](legal/ASSET-SOURCES.json)。

本项目没有参与或代表官方产品发布。品牌标记的权利独立于源代码许可；相关标记不属于本项目原创。

## 本项目贡献与其他依赖

Y8n 与项目贡献者负责原生 Android 客户端、增强服务整合、移动阅读/文件交互、设备本地状态、通知与恢复、测试和文档。
基础功能与增强差异见 [功能对照](docs/guide/enhancements.md)。不把原项目已有的业务能力重复宣称为新增。

感谢 Kotlin、Jetpack Compose、AndroidX、OkHttp、kotlinx、Node.js 及 npm 依赖的维护者。
运行依赖许可与原始版权文本见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 和 [legal/](legal/README.md)。
MIT/BSD/ISC/0BSD/CC0 等第三方许可不会因根目录 Apache-2.0 而被替换。
README 截图为本项目真实原生界面的虚构数据演示，来源见 [截图说明](docs/screenshots/README.md)。
