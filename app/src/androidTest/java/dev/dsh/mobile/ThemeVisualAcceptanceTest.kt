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

/** Actual production composables, isolated fixture data, native Android screenshots. */
class ThemeVisualAcceptanceTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = compose.activity.applicationContext
    private fun capture(name: String) {
        compose.waitForIdle(); Thread.sleep(350); compose.waitForIdle()
        val bitmap = instrumentation.uiAutomation.takeScreenshot() ?: error("screenshot unavailable")
        File(context.filesDir, "theme-acceptance").apply { mkdirs() }.resolve("$name.png").outputStream().use {
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
        val workspace = Workspace("w", "/fixture/project", "主题验收工作区", listOf("s"))
        override fun followWorkspaces() = flow {
            emit(buildJsonObject { put("type", "baseline"); put("value", WireJson.encodeToJsonElement(WorkspaceSnapshot(listOf(workspace)))) }); awaitCancellation()
        }
        override fun follow(endpoint: String, args: JsonObject): Flow<JsonObject> = flow {
            emit(when(endpoint) {
                "session/follow" -> json("""{"type":"snapshot","header":{"id":"s"},"cursor":5,"hasMore":false,"records":[{"event":{"seq":0,"type":"user/message","data":{"content":[{"type":"text","text":"检查深色主题\n保留消息换行"}],"turn":1}}},{"event":{"seq":1,"type":"turn/start","data":{"turn":1}}},{"event":{"seq":2,"type":"tool/call","data":{"name":"edit","callId":"c","arguments":"{\"file_path\":\"/fixture/Theme.kt\"}","turn":1}}},{"event":{"seq":3,"type":"tool/result","data":{"message":{"source":{"kind":"tool","callId":"c"},"content":[]},"meta":{"diffs":[{"path":"/fixture/Theme.kt","oldText":"val theme = light","newText":"val theme = dark"}]},"turn":1}}},{"event":{"seq":4,"type":"assistant/message","data":{"turn":1,"message":{"content":[{"type":"text","text":"## 主题验证\n\n正文与 **加粗**、[文件链接](Theme.kt)。\n\n|项目|状态|\n|---|---|\n|主题|完成|\n\n```kotlin\nval theme = dark\n```"}]}}}},{"event":{"seq":5,"type":"turn/end","data":{"turn":1,"reason":{"kind":"completed"}}}}],"projections":{"asOfSeq":4,"values":{"title":"深色主题验收","agentStatus":"idle","modelSelection":{"next":{"provider":"deepseek","model":"deepseek-flash"}},"tokenUsage":{"uncachedInputTokens":1200,"outputTokens":800},"contextPressure":{"projectedTokens":2000,"contextWindow":100000}}}}""")
                "\$events" -> json("""{"type":"ready","clientId":"theme-fixture"}""")
                else -> json("""{"type":"baseline","value":{"projections":{}}}""")
            }); awaitCancellation()
        }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            if (mutation) { writes += method; throw GatewayFailure("fixture-write-forbidden") }
            return when(method) {
                "session/list" -> buildJsonObject { put("items", WireJson.encodeToJsonElement(listOf(SessionSummary("s", "深色主题验收")))) }
                "directoryPicker/list" -> WireJson.encodeToJsonElement(DirectoryListing("/fixture", "/", emptyList(), listOf(DirectoryEntry("project", "/fixture/project"))))
                "workspaceFiles/stat" -> json("""{"absolutePath":"/fixture/Theme.kt","version":"v1","bytes":16}""")
                "workspaceFiles/read" -> json("""{"absolutePath":"/fixture/Theme.kt","version":"v1","bytes":16,"offset":1,"lines":1,"text":"val theme = dark","eof":true}""")
                "pluginManager/listPlugins" -> WireJson.parseToJsonElement("""[{"entryId":"official:web-search","moduleName":"web-search","enabled":true,"meta":{"title":"网页搜索","description":"配置搜索提供方"}},{"entryId":"plugin:example","moduleName":"example","patchId":"fixture","enabled":true,"meta":{"title":"示例插件","description":"原生图标保留颜色"}}]""")
                "pluginManager/listBundles" -> WireJson.parseToJsonElement("""[{"name":"@fixture/example","installed":true,"enabled":true,"meta":{"title":"示例插件","description":"文件与插件图标保留原色"},"rows":[{"entryId":"plugin:example","rowId":"example","moduleName":"example"}]}]""")
                "pluginManager/registries" -> json("""{"registry":"https://registry.npmjs.org/"}""")
                "mobileSchedule/capabilities" -> json("""{"version":1,"lifecycle":true,"durableRequestIdentity":true}""")
                "mobileSchedule/catalog" -> WireJson.parseToJsonElement("""[{"id":"task","sessionId":"s","version":"v1","title":"主题验收提醒","prompt":"检查页面颜色","kind":"daily","time":"09:00:00.000","timeZone":"Asia/Shanghai","status":"active","scheduledAt":"2099-10-17T01:00:00Z"}]""")
                "commands/list" -> JsonArray(emptyList())
                "session/modelCatalog" -> json("""{"default":{"provider":"deepseek","model":"deepseek-flash"},"groups":[{"id":"deepseek","name":"DeepSeek","models":[{"id":"deepseek-flash","name":"deepseek-flash"}]}]}""")
                "permissionPresets/catalog" -> json("""{"options":[{"value":"read-only","name":"仅可查看","description":"查看文件"}]}""")
                else -> throw GatewayFailure("fixture-unsupported")
            }
        }
        private fun json(value: String) = WireJson.parseToJsonElement(value).jsonObject
    }
    @Test fun productionPagesAndDialogsInDarkAndLight(): Unit = runBlocking {
        val originalVault = DeviceStore(context).read()
        val root = File(context.cacheDir, "theme-${UUID.randomUUID()}").apply { mkdirs() }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = scope) { File(root, "devices.preferences_pb") })
        store.update { StoredDevices(listOf(DeviceCredential("visual", "MacMini", "https://fixture.invalid", "0".repeat(64), "visual", "fixture", Long.MAX_VALUE)), defaultId = "visual") }
        val fixture = Fixture(); val repo = DeviceRepository(store) { fixture }
        val local = LocalDeviceDataRepository(File(root, "local"))
        val diagnostics = DiagnosticRepository(context, "theme-fixture", 0, File(root,"logs"))
        val dark = mutableStateOf(true); val page = mutableStateOf("app")
        val preference = ThemePreference(context); val originalTheme = preference.mode
        try {
            compose.activity.runOnUiThread { compose.activity.setContent {
                CompositionLocalProvider(LocalThemePreference provides preference) {
                    LaunchedEffect(page.value) { if (page.value != "app") repo.resume() }
                    SideEffect {
                        val style = if (dark.value) androidx.activity.SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
                            else androidx.activity.SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT)
                        compose.activity.enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
                    }
                    DshTheme(darkTheme = dark.value) {
                        Scaffold(contentWindowInsets = WindowInsets.safeDrawing) { padding -> Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
                            key(page.value) { when(page.value) {
                                "app" -> LiveApp(null, repo)
                                "plugins" -> { val state by repo.state.collectAsState(); LivePlugins(repo.plugins(), state, {}) }
                                "schedules" -> LiveSchedules(repo.schedules(), true, {}, "深色主题验收")
                                "diff" -> DiffViewer(repo,"s","visual",{})
                                "settings" -> Column(Modifier.padding(20.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) { DshTopBar("启动与设备管理"); ThemeSettings(); LocalCacheSettings(local,diagnostics) }
                                "models" -> ModelPicker("选择模型", listOf(ProviderModels("DeepSeek", listOf(ModelOption("flash", "deepseek-flash")))), "flash", {}, {})
                                "session-action" -> Column { DshTopBar("深色主题验收", actions = { SessionMenu("visual", "深色主题验收", false, false, true, { _,_,_ -> }) }) }
                                "media" -> Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    DshTopBar("文件类型与图片")
                                    listOf("Theme.kt", "说明.md", "报告.pdf", "图片.png", "演示.mp4", "文档.docx").forEach { name -> Row { DshFileIcon(name, Modifier.size(32.dp)); Text(name, Modifier.padding(start = 12.dp)) } }
                                    val file = remember { File(root, "native-icon.png").apply { outputStream().use { output -> android.graphics.BitmapFactory.decodeResource(context.resources, R.drawable.dsh_file_markdown).compress(android.graphics.Bitmap.CompressFormat.PNG, 100, output) } } }
                                    ImagePreview(file, Modifier.fillMaxWidth().height(200.dp))
                                }
                                "question" -> Column(Modifier.padding(20.dp)) { DshTopBar("需要你的确认"); QuestionInteraction("visual", WireJson.parseToJsonElement("""[{"id":"q","question":"要立即应用深色主题吗？","options":[{"label":"立即应用","description":"保留当前页面"},{"label":"稍后处理"}]}]""").jsonArray, true, false, {}) }
                                "approval" -> Column(Modifier.padding(20.dp)) { DshTopBar("需要权限批准"); ApprovalInteraction(PendingInteraction("visual", "approval", WireJson.parseToJsonElement("""{"reason":"允许修改当前工作区的主题配置？"}""").jsonObject), true, "val theme = dark", {}) }
                                "goal" -> Column(Modifier.padding(20.dp)) { DshTopBar("目标模式"); GoalControls(ConversationState(connected = true, projections = WireJson.parseToJsonElement("""{"goal":{"goal":{"id":"g","revision":1,"objective":"完成深色主题适配","phase":"active"}}}""").jsonObject), false) { _,_,_ -> } }
                                "offline" -> ConnectionLostScreen("MacMini", {}, {}, {})
                                "content" -> Column(Modifier.padding(20.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    DshTopBar("消息与文件样式")
                                    MarkdownContent("## 主题验收\n\n正文 **加粗** 与 [链接](https://example.com) 和 `行内代码`。\n\n|文件|状态|\n|---|---|\n|Theme.kt|已完成|\n\n```kotlin\nval theme = dark\n```")
                                    ApprovalCard("权限申请", "允许修改当前工作区文件？", "允许本次", "拒绝", {}, {})
                                    MessageComposer("草稿内容", {}, false, "deepseek-flash", listOf(PermissionOption("read-only", "仅可查看", "查看文件")), "read-only", {}, {}, {}, {}, {})
                                }
                            } }
                        } }
                    }
                }
            } }
            awaitTag("device_settings"); capture("01-workspaces-dark")
            compose.onNodeWithText("MacMini").performClick(); awaitTag("device_switch_popover"); capture("02-device-switch-dark")
            compose.onAllNodesWithText("MacMini").onLast().performClick()
            compose.onNodeWithTag("device_settings").performClick(); awaitTag("device_rename"); capture("03-device-settings-dark")
            compose.onNodeWithTag("device_rename").performClick(); awaitTag("device_rename_input"); capture("04-device-rename-dark"); compose.onNodeWithText("取消").performClick()
            compose.onNodeWithTag("device_remove").performScrollTo().performClick(); compose.onNodeWithText("取消").assertExists(); capture("05-device-delete-dark"); compose.onNodeWithText("取消").performClick()
            compose.onNodeWithContentDescription("添加连接").performScrollTo().performClick(); awaitTag("pair_name"); capture("06-connection-dark"); back(); back()
            compose.onNodeWithTag("live_add_workspace").performClick(); awaitTag("live_workspace_name"); capture("07-new-workspace-dark")
            compose.onNodeWithTag("live_select_directory").performClick(); awaitTag("live_use_directory"); capture("08-directory-dark"); back(); back()
            compose.onNodeWithText("主题验收工作区").performClick(); awaitTag("session_row_s"); capture("09-sessions-dark")
            compose.onNodeWithTag("session_menu_s").performClick(); compose.onNodeWithText("复制会话 ID").assertExists(); capture("10-session-menu-dark"); androidx.test.espresso.Espresso.pressBack()
            compose.onNodeWithTag("session_row_s").performClick(); awaitTag("composer_input"); capture("11-conversation-dark")
            compose.onNodeWithTag("composer_permission").performClick(); capture("12-permission-menu-dark"); androidx.test.espresso.Espresso.pressBack()
            compose.runOnIdle { page.value = "plugins" }; awaitTag("live-plugins"); compose.waitUntil(10_000) { repo.state.value.connected && !repo.plugins().state.value.loading && repo.plugins().state.value.plugins.isNotEmpty() }; compose.onNodeWithText("示例插件").assertIsDisplayed(); capture("13-plugins-dark")
            compose.onNodeWithText("添加插件").performClick(); capture("14-plugin-install-dark"); compose.onNodeWithTag("plugin-registry-menu").performClick(); capture("14b-plugin-registry-dark"); compose.onNodeWithText("npm 官方源").performClick(); compose.onNodeWithContentDescription("关闭添加插件").performClick()
            repo.schedules().show("s"); compose.runOnIdle { page.value = "schedules" }; compose.waitUntil(10_000) { repo.schedules().state.value.supported }; capture("15-schedules-dark")
            compose.onNodeWithText("主题验收提醒").performClick(); capture("16-schedule-editor-dark")
            compose.runOnIdle { page.value = "diff" }; awaitTag("diff-file:3:0"); capture("17-files-dark")
            compose.onNodeWithTag("diff-file:3:0").performClick(); awaitTag("diff-lines"); capture("18-diff-dark")
            compose.runOnIdle { page.value = "settings" }; awaitTag("theme_settings"); capture("19-settings-dark")
            compose.onNodeWithTag("theme_settings").performClick(); capture("20-theme-dialog-dark"); compose.onNodeWithTag("theme_Dark").performClick()
            compose.onNodeWithTag("clear_local_cache").performScrollTo().performClick(); capture("21-clear-confirm-dark"); compose.onNodeWithText("取消").performClick()
            compose.runOnIdle { page.value = "content" }; awaitTag("markdown_code"); capture("22-markdown-controls-dark")
            compose.runOnIdle { dark.value = false }; capture("23-markdown-controls-light")
            compose.runOnIdle { page.value = "settings" }; awaitTag("theme_settings"); capture("24-settings-light")
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
            assertTrue("No Desktop mutations", fixture.writes.isEmpty()); assertEquals(originalVault, DeviceStore(context).read())
        } finally {
            compose.runOnIdle { preference.select(originalTheme) }
            repo.close(); local.close(); diagnostics.close(); scope.cancel(); root.deleteRecursively()
        }
    }
}
