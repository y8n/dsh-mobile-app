# 手机诊断日志：上传到自己的电脑

日志默认只保存在手机本地，自动上传默认关闭。需要排查问题时，将日志上传到已配对电脑；无需云端存储、额外账号、上传 URL 或令牌。

## 使用步骤

1. 电脑安装包含诊断接口的新插件，保持 DeepSeek Harness 运行。
2. 手机通过已有局域网或隧道连接这台电脑。
3. 打开这台设备的工作区列表，点击右上角设置，在“诊断日志”点击“上传到电脑”；接收端固定为当前设备，无需再次选择。
4. 成功后复制报告编号或“日志位置”，开发者或 AI 可在接收电脑本地读取。

仅浏览设备设置不会切换上传目标或上传；自动上传需单独开启。日志为 App 级诊断记录，本地条数是手机上的总条数。切换接收电脑会关闭自动上传并清空旧回执，未上传事件保留。自动上传固定使用已选电脑，不会因为切到另一台设备就把日志发送给它；请先连接接收电脑。

电脑离线、插件未升级、权限不满足或回执不完整时，日志留在手机，稍后重试。清理本地日志会关闭自动上传，保留接收电脑选择；手机清理不会删除电脑上已经收到的日志。

## 电脑上的固定临时目录

根目录由 **Node.js 的系统临时目录 + 固定名称 + 当前用户 ID** 组成：

```text
<os.tmpdir()>/dsh-mobile-app-diagnostics-<uid或user>/<profile-hash>/hours/YYYY-MM-DD/HH/<journalId>/part-XXXXXXXX.json
```

- macOS：通常位于 `$TMPDIR/dsh-mobile-app-diagnostics-<uid>/`，不要硬编码 `/var/folders/…`，每台电脑的系统临时目录不同。
- Linux：通常位于 `/tmp/dsh-mobile-app-diagnostics-<uid>/`。
- Windows：通常位于 `%TEMP%\dsh-mobile-app-diagnostics-user\`。
- `profile-hash` 隔离不同 DeepSeek Harness 配置，`HH` 使用 UTC。App 回执给出具体文件的绝对路径。

**开发者和 AI 在接收电脑上执行以下命令，即可获得准确根目录：**

```sh
node -e 'const os=require("node:os"),p=require("node:path");console.log(p.join(os.tmpdir(),"dsh-mobile-app-diagnostics-"+(process.getuid?.()??"user")))'
```

PowerShell 可使用双引号包裹 `node -e` 的脚本，并将脚本中的字符串改为单引号。应以接收端的运行环境为准；若 DSH 在容器或其他用户下运行，宿主终端的临时目录可能不同，优先使用 App 返回的绝对路径。

文件权限在支持的平台上为目录 0700、文件 0600。临时目录可能被系统清空，需长期保留的报告请自行复制；这里不是永久备份。

## 给开发者与 AI 的排查方法

1. 先从手机取得报告编号、实际文件位置和问题发生的大概时间。
2. 读取该文件的 `reports`，确认对应 `reportId`；`events` 是该小时合并去重后的日志。
3. 按 `seq` 和 `at` 看先后关系，用 `trace` 串联同一操作，重点检查 `*.failure` 的错误分类、状态码、耗时和网络类型。
4. 通知问题结合 `notification.received`、`notification.posted` 与 `runtime` 中的前后台、后台限制和通知权限状态分析；不要把“有常驻进程”当成连接一定正常。
5. 不在接收电脑上的分析者，需要用户导出报告并授权提供；配对上传不会将报告自动发送给项目维护者。

日志不包含会话正文、附件内容、配对密钥、认证头或完整业务 URL。分享前仍请检查内容，不要上传整个 App 数据目录。

## 插件接口

使用现有配对鉴权后的 RPC 通道，不另开 HTTP 上传端口：

- `mobileDiagnostics/capabilities`：返回接口版本、schema、最大批次及本地保存能力。
- `mobileDiagnostics/upload`：参数为 `{ "report": <批次对象> }`，只允许已通过宿主 OperatorPeer 鉴权的调用。

批次包含 `schema: 2`、`reportId`、`journalId`、客户端版本信息、UTC 小时、part 和 events。单批最多 500 条、512 KiB，字段及枚举由 [diagnostic-schema.mjs](../../desktop/mobile-extension/diagnostic-schema.mjs) 校验；不接受任意正文或客户端指定的文件路径。

成功回执示例：

```json
{
  "reportId": "11111111-1111-4111-8111-111111111111",
  "accepted": 10,
  "archiveKey": "hours/2026-01-01/00/22222222-2222-4222-8222-222222222222/part-00000000.json",
  "directory": "<电脑上的实际临时目录与配置子目录>",
  "localPath": "<实际归档文件的绝对路径>"
}
```

报告编号与条数必须完整匹配，手机才删除对应本地事件。电脑在写入、fsync 和原子替换完成后才返回成功；重复编号与相同内容返回已有回执，不重复追加，编号或事件序号冲突则拒绝。

本地仍按 UTC 小时、journalId 与每 10,000 个事件序号的 part 归档；同小时主动上传追加同一文件，而不是每条事件建文件。每个配置最多 64 MiB，单归档最多 8 MiB，超限时拒绝新批次，手机保留日志。每次接收时清理超过 7 天未更新的归档；未运行时也可能由系统提前清理临时目录。

存储被占用会返回可重试失败。若电脑进程崩溃遗留 `.write-lock`，应先确认对应 DSH 配置的进程已停止，再删除该配置目录下的锁文件；不要在上传过程中手动删除锁或修改归档。

实现见 [diagnostics.mjs](../../desktop/mobile-extension/diagnostics.mjs)，测试使用隔离临时目录，不操作普通工作区、配对或用户日志。
