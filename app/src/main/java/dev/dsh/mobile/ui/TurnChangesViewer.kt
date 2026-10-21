package dev.dsh.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.*
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.JsonObject

/** Opens exactly the snapshot coordinates selected on a turn card. */
@Composable fun TurnChangesViewer(devices: DeviceRepository, sessionId: String, deviceId: String, seq: Long, index: Int, back: () -> Unit) {
    val repo = remember(devices) { devices.conversations() }
    val device by devices.state.collectAsStateWithLifecycle()
    var diff by remember(deviceId, sessionId, seq, index) { mutableStateOf<JsonObject?>(null) }
    var lines by remember(deviceId, sessionId, seq, index) { mutableStateOf<List<DiffLine>?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf(false) }
    var attempt by remember { mutableIntStateOf(0) }
    var currentFile by remember { mutableStateOf<WorkspaceFileTarget?>(null) }
    DisposableEffect(repo, sessionId, device.selectedId) {
        val owner = if (device.selectedId == deviceId) repo.acquireView(sessionId) else null
        onDispose { owner?.let(repo::releaseView) }
    }
    LaunchedEffect(device.selectedId, sessionId, seq, index, attempt) {
        loading = true; error = false; diff = null; lines = null
        try {
            val value = repo.readChanges(deviceId, sessionId, seq, index)
            val parsed = withContext(Dispatchers.Default) { turnDiffLines(value) }
            require(value.text("path").isNotBlank())
            diff = value; lines = parsed
        } catch (cancel: CancellationException) { throw cancel }
        catch (_: Exception) { error = true }
        finally { loading = false }
    }
    currentFile?.let { CurrentFileViewer(devices, it) { currentFile = null }; return }
    Column(Modifier.fillMaxSize().testTag("turn_changes_viewer")) {
        DshTopBar("文件改动", diff?.text("display"), onBack = back)
        when {
            device.selectedId != deviceId -> Text("设备已切换，请返回当前设备会话。", Modifier.padding(20.dp))
            loading -> CircularProgressIndicator(Modifier.padding(20.dp))
            error -> Column(Modifier.padding(20.dp)) {
                Text("这份历史改动暂时无法读取，请重试或在电脑端查看。")
                TextButton({ attempt++ }) { Text("重试") }
            }
            lines == null -> Text(if (diff?.text("kind") == "binary") "二进制文件，无法显示文本比较。" else "文件过大，请在电脑端查看。", Modifier.padding(20.dp))
            else -> {
                Text("本轮记录的文件改动", Modifier.padding(horizontal = 20.dp, vertical = 12.dp), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 20.dp)) {
                    val viewport = maxWidth
                    LazyColumn(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).testTag("turn_diff_lines")) {
                        itemsIndexed(lines!!) { _, line ->
                            Text("${line.kind} ${line.text}", Modifier.widthIn(min = viewport).background(when(line.kind) { '+' -> DshColors.Added; '-' -> DshColors.Removed; else -> DshColors.Soft }).padding(horizontal = 12.dp, vertical = 4.dp), color = when(line.kind) { '+' -> DshColors.Green; '-' -> DshColors.Red; else -> DshColors.Ink }, fontFamily = FontFamily.Monospace, softWrap = false, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
        if (!loading && !error && diff != null && device.selectedId == deviceId) TextButton({ currentFile = WorkspaceFileTarget(deviceId, sessionId, diff!!.text("path")) }, enabled = device.connected, modifier = Modifier.padding(12.dp)) { Text("打开当前完整文件") }
    }
}
