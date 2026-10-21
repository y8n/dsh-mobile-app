package dev.dsh.mobile.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.*
import dev.dsh.mobile.protocol.GatewayFailure
import kotlinx.coroutines.*
import kotlinx.serialization.json.JsonElement

@Composable fun CurrentFileViewer(devices: DeviceRepository, target: WorkspaceFileTarget, back: () -> Unit) {
    val device by devices.state.collectAsStateWithLifecycle(context = Dispatchers.Main.immediate)
    val reader = remember(devices) { WorkspaceTextReader(devices) }
    val scope = rememberCoroutineScope { Dispatchers.Main.immediate }; val clipboard = LocalClipboardManager.current
    var text by remember(target) { mutableStateOf("") }; var version by remember(target) { mutableStateOf<JsonElement?>(null) }
    var offset by remember(target) { mutableLongStateOf(1) }; var eof by remember(target) { mutableStateOf(false) }
    var loading by remember(target) { mutableStateOf(false) }; var loaded by remember(target) { mutableStateOf(false) }
    var error by remember(target) { mutableStateOf<String?>(null) }
    suspend fun load(reset: Boolean) {
        if (loading) return
        loading = true; error = null
        if (reset) { text = ""; version = null; offset = 1; eof = false; loaded = false }
        try {
            val page = reader.read(target, offset, version)
            val combined = if (!loaded) page.text else text + "\n" + page.text
            if (combined.toByteArray(Charsets.UTF_8).size > 1024 * 1024) throw GatewayFailure("file-preview-limit")
            text = combined; version = page.version; offset += page.lines; eof = page.eof; loaded = true
        } catch (cancel: CancellationException) { throw cancel }
        catch (failure: Exception) {
            error = (failure as? GatewayFailure)?.code ?: "invalid-response"
            if (error == "file-changed" || error == "device-changed") { text = ""; loaded = false; version = null }
        } finally { loading = false }
    }
    BackHandler { back() }
    LaunchedEffect(target, device.selectedId) { if (device.selectedId == target.deviceId) load(true) }
    Column(Modifier.fillMaxSize().testTag("current-file-viewer")) {
        DshTopBar("文件内容", target.path.substringAfterLast('/').substringAfterLast('\\'), back)
        Text("已读取的电脑文件文本，可能已不同于本次改动；可重新读取查看最新内容。", Modifier.padding(horizontal = 20.dp, vertical = 12.dp), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
        if (device.selectedId != target.deviceId) Text("设备已切换，请返回当前设备会话。", Modifier.padding(20.dp), color = DshColors.Muted)
        else {
            if (!device.connected && loaded) Text("设备已断开，当前仅展示已读取内容。", Modifier.padding(horizontal = 20.dp), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
            if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
            error?.let { code ->
                Text(when (code) {
                    "file-changed" -> "文件已变化，已清除旧版本，请重新读取。"
                    "file-preview-limit", "workspace-file/too-large" -> "内容超过预览限制，请在电脑端查看。"
                    "workspace-file/not-text" -> "此文件不支持文本预览，请在电脑端打开。"
                    "connection-required", "network-unavailable" -> "设备已断开，请恢复连接后重新读取。"
                    else -> "文件读取失败，可能已移动或无法访问。"
                }, Modifier.padding(horizontal = 20.dp), color = DshColors.Red, style = MaterialTheme.typography.bodySmall)
            }
            Row(Modifier.padding(horizontal = 12.dp)) {
                TextButton({ scope.launch { load(true) } }, enabled = !loading && device.connected) { Text("重新读取") }
                TextButton({ clipboard.setText(AnnotatedString(text)) }, enabled = loaded, modifier = Modifier.testTag("current-file-copy")) { Text("复制已加载内容") }
            }
            val horizontal = rememberScrollState()
            LazyColumn(Modifier.weight(1f).fillMaxWidth().horizontalScroll(horizontal).testTag("current-file-text"), contentPadding = PaddingValues(20.dp)) {
                if (loaded && text.isEmpty()) item { Text("没有可显示的文本", color = DshColors.Muted) }
                items(if (loaded) text.split('\n') else emptyList()) { line -> SelectionContainer {
                    Text(line, fontFamily = FontFamily.Monospace, softWrap = false, style = MaterialTheme.typography.bodyMedium)
                } }
            }
            if (loaded && !eof) TextButton({ scope.launch { load(false) } }, enabled = !loading && device.connected && error != "file-preview-limit", modifier = Modifier.testTag("current-file-more")) { Text("加载更多文件内容") }
            if (loaded && eof) Text("已读取全部文本行", Modifier.padding(horizontal = 20.dp, vertical = 8.dp), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
        }
    }
}
