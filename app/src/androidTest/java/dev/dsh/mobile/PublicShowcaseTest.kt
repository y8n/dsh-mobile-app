package dev.dsh.mobile

import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.*
import dev.dsh.mobile.protocol.*
import dev.dsh.mobile.ui.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.UUID

/** README screenshots of production composables with synthetic data; never connects to a real desktop. */
class PublicShowcaseTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = compose.activity.applicationContext
    private val lightOnly get() = InstrumentationRegistry.getArguments().getString("showcaseTheme") == "light"
    private fun capture(name: String) {
        compose.waitForIdle(); Thread.sleep(350); compose.waitForIdle()
        val bitmap = instrumentation.uiAutomation.takeScreenshot() ?: error("screenshot unavailable")
        File(context.filesDir, "public-showcase").apply { mkdirs() }.resolve("${if (lightOnly) name.replace("-dark", "-light") else name}.png").outputStream().use {
            assertTrue(bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it))
        }
        bitmap.recycle()
    }
    private fun awaitTag(tag: String) { compose.waitUntil(12_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() } }
    private fun back() { compose.onNodeWithContentDescription("返回").performClick() }
    private class Fixture : DeviceGateway {
        val writes = mutableListOf<String>()
        override suspend fun probe() = Unit
        override fun close() = Unit
        val workspace = Workspace("w", "/fixture/project", "示例项目", listOf("s"))
        override fun followWorkspaces() = flow {
            emit(buildJsonObject { put("type", "baseline"); put("value", WireJson.encodeToJsonElement(WorkspaceSnapshot(listOf(workspace)))) }); awaitCancellation()
        }
        override fun follow(endpoint: String, args: JsonObject): Flow<JsonObject> = flow {
            emit(when(endpoint) {
                "session/follow" -> json("""{"type":"snapshot","header":{"id":"s","cwd":"/fixture/project"},"cursor":5,"hasMore":false,"records":[{"event":{"seq":0,"type":"user/message","data":{"content":[{"type":"text","text":"整理发布检查清单\n请保留清晰的步骤"}]}}},{"event":{"seq":1,"type":"turn/start","data":{"turn":1}}},{"event":{"seq":2,"type":"tool/call","data":{"name":"edit","callId":"c","arguments":"{\"file_path\":\"/fixture/Theme.kt\"}","turn":1}}},{"event":{"seq":3,"type":"tool/result","data":{"message":{"source":{"kind":"tool","callId":"c"},"content":[]},"meta":{"diffs":[{"path":"/fixture/Theme.kt","oldText":"val theme = light","newText":"val theme = dark"}]},"turn":1}}},{"event":{"seq":4,"type":"assistant/message","data":{"turn":1,"message":{"content":[{"type":"text","text":"## 发布清单\n\n已整理 **发布检查项**，可点击 [文件链接](Theme.kt) 查看修改。\n\n|项目|状态|\n|---|---|\n|主题|完成|\n|文件预览|完成|\n\n```kotlin\nval theme = dark\n```"}]}}}},{"event":{"seq":5,"type":"turn/end","data":{"turn":1,"reason":{"kind":"completed"}}}}],"projections":{"asOfSeq":4,"values":{"title":"发布准备","agentStatus":"idle","modelSelection":{"next":{"provider":"deepseek","model":"deepseek-flash"}},"tokenUsage":{"uncachedInputTokens":1200,"outputTokens":800},"contextPressure":{"projectedTokens":2000,"contextWindow":100000}}}}""")
                "\$events" -> json("""{"type":"ready","clientId":"theme-fixture"}""")
                else -> json("""{"type":"baseline","value":{"projections":{}}}""")
            }); awaitCancellation()
        }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            if (mutation) { writes += method; throw GatewayFailure("fixture-write-forbidden") }
            return when(method) {
                "session/list" -> buildJsonObject { put("items", WireJson.encodeToJsonElement(listOf(SessionSummary("s", "发布准备")))) }
                "directoryPicker/list" -> WireJson.encodeToJsonElement(DirectoryListing("/fixture", "/", emptyList(), listOf(DirectoryEntry("project", "/fixture/project"))))
                "workspaceFiles/stat" -> json("""{"absolutePath":"/fixture/Theme.kt","version":"v1","bytes":16}""")
                "workspaceFiles/read" -> if (args["path"]?.jsonPrimitive?.content?.endsWith("/.git/HEAD") == true) json("""{"text":"ref: refs/heads/main","eof":true}""") else json("""{"absolutePath":"/fixture/Theme.kt","version":"v1","bytes":16,"offset":1,"lines":1,"text":"val theme = dark","eof":true}""")
                "pluginManager/listPlugins" -> WireJson.parseToJsonElement("""[{"entryId":"official:web-search","moduleName":"web-search","enabled":true,"meta":{"title":"网页搜索","description":"配置搜索提供方"}},{"entryId":"plugin:example","moduleName":"example","patchId":"fixture","enabled":true,"meta":{"title":"示例插件","description":"原生图标保留颜色"}}]""")
                "pluginManager/listBundles" -> WireJson.parseToJsonElement("""[{"name":"@fixture/example","installed":true,"enabled":true,"meta":{"title":"示例插件","description":"文件与插件图标保留原色"},"rows":[{"entryId":"plugin:example","rowId":"example","moduleName":"example"}]}]""")
                "pluginManager/registries" -> json("""{"registry":"https://registry.npmjs.org/"}""")
                "mobileAccount/summary" -> json("""{"version":1,"status":"ready","costStatus":"ready","wallets":[{"currency":"CNY","balance":"88.50","toppedUpBalance":"68.50","grantedBalance":"20.00","totalCosts":"123.45"}],"fetchedAt":0,"isAvailable":true}""")
                "mobileSchedule/capabilities" -> json("""{"version":1,"lifecycle":true,"durableRequestIdentity":true}""")
                "mobileSchedule/catalog" -> WireJson.parseToJsonElement("""[{"id":"task","sessionId":"s","version":"v1","title":"每日检查","prompt":"检查页面颜色","kind":"daily","time":"09:00:00.000","timeZone":"Asia/Shanghai","status":"active","scheduledAt":"2099-10-17T01:00:00Z"}]""")
                "commands/list" -> JsonArray(emptyList())
                "session/modelCatalog" -> json("""{"default":{"provider":"deepseek","model":"deepseek-flash"},"groups":[{"id":"deepseek","name":"DeepSeek","models":[{"id":"deepseek-flash","name":"deepseek-flash"}]}]}""")
                "permissionPresets/catalog" -> json("""{"options":[{"value":"read-only","name":"仅可查看","description":"查看文件"}]}""")
                else -> throw GatewayFailure("fixture-unsupported")
            }
        }
        private fun json(value: String) = WireJson.parseToJsonElement(value).jsonObject
    }
    @Test fun syntheticNotificationsForReadme() {
        val notifications = dev.dsh.mobile.notifications.SessionNotifications
        notifications.channels(context)
        val device = DeviceCredential("showcase-notifications", "演示电脑", "https://fixture.invalid", "0".repeat(64), "visual", "fixture", Long.MAX_VALUE)
        val events = listOf(
            SessionNotificationEvent("showcase-complete", "s", false, System.currentTimeMillis(), sessionTitle = "发布准备", preview = "发布清单已整理完成，可以查看结果。"),
            SessionNotificationEvent("showcase-question", "s", true, System.currentTimeMillis(), sessionTitle = "发布准备", preview = "是否继续整理使用文档？"),
            SessionNotificationEvent("showcase-permission", "s", true, System.currentTimeMillis(), permission = true, sessionTitle = "发布准备", preview = "允许修改当前工作区的说明文件？")
        )
        try {
            events.forEach { assertTrue(notifications.post(context, device, it)) }
            instrumentation.uiAutomation.executeShellCommand("cmd statusbar expand-notifications").close()
            Thread.sleep(1500)
            capture("40-notifications-light")
        } finally {
            instrumentation.uiAutomation.executeShellCommand("cmd statusbar collapse").close()
            val manager = context.getSystemService(android.app.NotificationManager::class.java)
            events.forEach { manager.cancel("${device.id}:${it.id}", 2) }
        }
    }
    @Test fun syntheticShowcaseForReadme(): Unit = runBlocking {
        val originalVault = DeviceStore(context).read()
        val root = File(context.cacheDir, "theme-${UUID.randomUUID()}").apply { mkdirs() }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = scope) { File(root, "devices.preferences_pb") })
        store.update { StoredDevices(listOf(DeviceCredential("visual", "演示电脑", "https://fixture.invalid", "0".repeat(64), "visual", "fixture", Long.MAX_VALUE, connections = listOf(
            DeviceConnection("lan", "家中局域网", "https://lan.example.invalid", "0".repeat(64), "visual", "fixture", Long.MAX_VALUE),
            DeviceConnection("tunnel", "外出隧道", "https://remote.example.invalid", "0".repeat(64), "visual", "fixture", Long.MAX_VALUE)
        ), preferredConnectionId = "lan")), defaultId = "visual") }
        val fixture = Fixture(); val repo = DeviceRepository(store) { fixture }
        val demoDirectory = File(root, "local").apply { mkdirs() }
        val demoUsage = (0..6).associate { days -> java.time.LocalDate.now().minusDays(days.toLong()).toString() to ((days + 1L) * 7 * 60_000) }
        File(demoDirectory, "device-data.json").writeText(WireJson.encodeToString(LocalDeviceData.serializer(), LocalDeviceData(usage = mapOf("visual" to demoUsage))))
        val local = LocalDeviceDataRepository(demoDirectory)
        val diagnostics = DiagnosticRepository(context, "theme-fixture", 0, File(root,"logs"))
        val dark = mutableStateOf(true); val page = mutableStateOf("app")
        val preference = ThemePreference(context); val originalTheme = preference.mode
        try {
            compose.activity.runOnUiThread { compose.activity.setContent {
                CompositionLocalProvider(LocalThemePreference provides preference) {
                    LaunchedEffect(page.value) { if (page.value != "app") repo.resume() }
                    SideEffect {
                        val style = if (dark.value && !lightOnly) androidx.activity.SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
                            else androidx.activity.SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT)
                        compose.activity.enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
                    }
                    DshTheme(darkTheme = dark.value && !lightOnly) {
                        Scaffold(contentWindowInsets = WindowInsets.safeDrawing) { padding -> Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
                            key(page.value) { when(page.value) {
                                "app" -> LiveApp(null, repo)
                                "usage" -> { val state by repo.state.collectAsState(); LiveDeviceSettings(state, repo, local, {}, {}, {}, {}, diagnosticInfo = { DiagnosticSettings(diagnostics, "visual") }, usageInfo = { DeepSeekUsageInfo(state.selectedId, state.connected, DeepSeekAccountReader(repo)::read) }) }
                                "plugins" -> { val state by repo.state.collectAsState(); LivePlugins(repo.plugins(), state, {}) }
                                "schedules" -> LiveSchedules(repo.schedules(), true, {}, "发布准备")
                                "diff" -> DiffViewer(repo,"s","visual",{})
                                "settings" -> Column(Modifier.padding(20.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) { DshTopBar("启动与设备管理"); ThemeSettings(); LocalCacheSettings(local,diagnostics) }
                                "models" -> ModelPicker("选择模型", listOf(ProviderModels("DeepSeek", listOf(ModelOption("flash", "deepseek-flash")))), "flash", {}, {})
                                "session-action" -> Column { DshTopBar("发布准备", actions = { SessionMenu("visual", "发布准备", false, false, true, { _,_,_ -> }) }) }
                                "media" -> Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    DshTopBar("文件类型与图片")
                                    listOf("Theme.kt", "说明.md", "报告.pdf", "图片.png", "演示.mp4", "文档.docx").forEach { name -> Row { DshFileIcon(name, Modifier.size(32.dp)); Text(name, Modifier.padding(start = 12.dp)) } }
                                    val file = remember { File(root, "native-icon.png").apply { outputStream().use { output -> android.graphics.BitmapFactory.decodeResource(context.resources, R.drawable.dsh_file_markdown).compress(android.graphics.Bitmap.CompressFormat.PNG, 100, output) } } }
                                    ImagePreview(file, Modifier.fillMaxWidth().height(200.dp))
                                }
                                "question" -> Column(Modifier.padding(20.dp)) { DshTopBar("需要你的确认"); QuestionInteraction("visual", WireJson.parseToJsonElement("""[{"id":"q","question":"要立即应用深色主题吗？","options":[{"label":"立即应用","description":"保留当前页面"},{"label":"稍后处理"}]}]""").jsonArray, true, false, {}) }
                                "approval" -> Column(Modifier.padding(20.dp)) { DshTopBar("需要权限批准"); ApprovalInteraction(PendingInteraction("visual", "approval", WireJson.parseToJsonElement("""{"reason":"允许修改当前工作区的主题配置？"}""").jsonObject), true, "val theme = dark", {}) }
                                "goal" -> Column(Modifier.fillMaxSize().padding(20.dp)) { DshTopBar("目标模式"); Spacer(Modifier.weight(1f)); GoalControls(ConversationState(connected = true, projections = WireJson.parseToJsonElement("""{"goal":{"goal":{"id":"g","revision":1,"objective":"完成项目发布准备","phase":"active"}}}""").jsonObject), false) { _,_,_ -> }; MessageComposer("", {}, false, "deepseek-flash", listOf(PermissionOption("read-only", "仅可查看", "查看文件")), "read-only", {}, {}, {}, {}, {}) }
                                "offline" -> ConnectionLostScreen("演示电脑", {}, {}, {})
                                "content" -> Column(Modifier.padding(20.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    DshTopBar("消息与文件样式")
                                    MarkdownContent("## 发布准备\n\n正文 **加粗** 与 [链接](https://example.com) 和 `行内代码`。\n\n|文件|状态|\n|---|---|\n|Theme.kt|已完成|\n\n```kotlin\nval theme = dark\n```")
                                    ApprovalCard("权限申请", "允许修改当前工作区文件？", "允许本次", "拒绝", {}, {})
                                    MessageComposer("草稿内容", {}, false, "deepseek-flash", listOf(PermissionOption("read-only", "仅可查看", "查看文件")), "read-only", {}, {}, {}, {}, {})
                                }
                            } }
                        } }
                    }
                }
            } }
            awaitTag("device_settings"); capture("01-workspaces-dark")
            compose.runOnIdle { dark.value = false }; capture("01b-workspaces-light")
            compose.runOnIdle { dark.value = true }
            compose.onNodeWithText("演示电脑").performClick(); awaitTag("device_switch_popover"); capture("02-device-switch-dark")
            compose.onAllNodesWithText("演示电脑").onLast().performClick()
            compose.onNodeWithTag("device_settings").performClick(); awaitTag("device_rename"); capture("03-device-settings-dark")
            compose.onNodeWithTag("device_rename").performClick(); awaitTag("device_rename_input"); capture("04-device-rename-dark"); compose.onNodeWithText("取消").performClick()
            compose.onNodeWithTag("device_remove").performScrollTo(); capture("03b-device-usage-dark"); compose.onNodeWithTag("device_remove").performClick(); compose.onNodeWithText("取消").assertExists(); capture("05-device-delete-dark"); compose.onNodeWithText("取消").performClick()
            compose.onNodeWithContentDescription("添加连接").performScrollTo().performClick(); awaitTag("pair_name"); capture("06-connection-dark"); back(); back()
            compose.onNodeWithTag("live_add_workspace").performClick(); awaitTag("live_workspace_name"); capture("07-new-workspace-dark")
            compose.onNodeWithTag("live_select_directory").performClick(); awaitTag("live_use_directory"); capture("08-directory-dark"); back(); back()
            compose.onNodeWithText("示例项目").performClick(); awaitTag("session_row_s"); capture("09-sessions-dark")
            compose.onNodeWithTag("session_menu_s").performClick(); compose.onNodeWithText("复制会话 ID").assertExists(); capture("10-session-menu-dark"); androidx.test.espresso.Espresso.pressBack()
            compose.onNodeWithTag("session_row_s").performClick(); awaitTag("composer_input"); awaitTag("conversation_git_branch"); capture("11-conversation-dark")
            compose.runOnIdle { dark.value = false }; capture("11b-conversation-light")
            compose.runOnIdle { dark.value = true }
            compose.onNodeWithTag("composer_permission").performClick(); capture("12-permission-menu-dark"); androidx.test.espresso.Espresso.pressBack()
            compose.runOnIdle { page.value = "plugins" }; awaitTag("live-plugins"); compose.waitUntil(10_000) { repo.state.value.connected && !repo.plugins().state.value.loading && repo.plugins().state.value.plugins.isNotEmpty() }; compose.onNodeWithText("示例插件").assertIsDisplayed(); capture("13-plugins-dark")
            compose.onNodeWithText("添加插件").performClick(); capture("14-plugin-install-dark"); compose.onNodeWithTag("plugin-registry-menu").performClick(); capture("14b-plugin-registry-dark"); compose.onNodeWithText("npm 官方源").performClick(); compose.onNodeWithContentDescription("关闭添加插件").performClick()
            repo.schedules().show("s"); compose.runOnIdle { page.value = "schedules" }; compose.waitUntil(10_000) { repo.schedules().state.value.supported }; capture("15-schedules-dark")
            compose.onNodeWithText("每日检查").performClick(); capture("16-schedule-editor-dark")
            compose.runOnIdle { page.value = "diff" }; awaitTag("diff-file:3:0"); capture("17-files-dark")
            compose.onNodeWithTag("diff-file:3:0").performClick(); awaitTag("diff-lines"); capture("18-diff-dark")
            compose.runOnIdle { page.value = "settings" }; awaitTag("theme_settings"); capture("19-settings-dark")
            compose.onNodeWithTag("theme_settings").performClick(); capture("20-theme-dialog-dark"); compose.onNodeWithTag("theme_Dark").performClick()
            compose.onNodeWithTag("clear_local_cache").performScrollTo().performClick(); capture("21-clear-confirm-dark"); compose.onNodeWithText("取消").performClick()
            compose.runOnIdle { page.value = "content" }; awaitTag("markdown_code"); capture("22-markdown-controls-dark")
            compose.runOnIdle { dark.value = false }; capture("23-markdown-controls-light")
            compose.runOnIdle { page.value = "settings"; preference.select(dev.dsh.mobile.designsystem.ThemeMode.Light) }; awaitTag("theme_settings"); capture("24-settings-light")
            compose.runOnIdle { dark.value = true; page.value = "question" }; awaitTag("question_visual"); capture("25-question-dark")
            compose.onNodeWithTag("question_option_visual_q_立即应用").performClick(); capture("26-question-selected-dark")
            compose.runOnIdle { page.value = "approval" }; awaitTag("approval_visual"); capture("27-approval-dark")
            compose.runOnIdle { page.value = "goal" }; awaitTag("goal_dock"); capture("28-goal-dark")
            compose.onNodeWithTag("goal_edit").performClick(); awaitTag("goal_page"); capture("29-goal-editor-dark")
            compose.runOnIdle { page.value = "offline" }; awaitTag("connection_lost_screen"); capture("30-offline-dark")
            compose.runOnIdle { page.value = "media" }; awaitTag("file_icon_markdown"); capture("31-file-types-image-dark")
            compose.runOnIdle { dark.value = false }; capture("32-file-types-image-light")
            compose.runOnIdle { dark.value = true; page.value = "models" }; compose.onNodeWithText("选择模型").assertExists(); capture("34-model-dialog-dark")
            compose.runOnIdle { dark.value = false }; capture("35-model-dialog-light")
            compose.runOnIdle { dark.value = true; page.value = "session-action" }; compose.onNodeWithTag("session_menu_visual").performClick(); compose.onNodeWithText("重命名").performClick(); awaitTag("session_rename_input"); capture("36-session-action-dark")
            compose.runOnIdle { dark.value = false }; capture("37-session-action-light")
            compose.runOnIdle { dark.value = true; page.value = "usage" }; awaitTag("device_usage_chart")
            compose.waitUntil(5000) { local.state.value.usage["visual"]?.isNotEmpty() == true }
            compose.onNodeWithTag("device_usage_chart").performScrollTo(); capture("38-device-usage-dark")
            compose.onNodeWithTag("diagnostics_upload").performScrollTo(); capture("39-device-diagnostics-dark")
            assertTrue("No Desktop mutations", fixture.writes.isEmpty()); assertEquals(originalVault, DeviceStore(context).read())
        } finally {
            compose.runOnIdle { preference.select(originalTheme) }
            repo.close(); local.close(); diagnostics.close(); scope.cancel(); root.deleteRecursively()
        }
    }
}
