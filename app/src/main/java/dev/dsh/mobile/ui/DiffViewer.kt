package dev.dsh.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.ui.Alignment
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.*
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*

@Composable fun DiffViewer(devices: DeviceRepository, sessionId: String, deviceId: String, back: () -> Unit) {
    val repo = remember(devices) { devices.conversations() }
    val device by devices.state.collectAsStateWithLifecycle(context = Dispatchers.Main.immediate)
    val state by repo.state.collectAsStateWithLifecycle(context = Dispatchers.Main.immediate)
    val scope = rememberCoroutineScope { Dispatchers.Main.immediate }
    val clipboard = LocalClipboardManager.current
    var selected by rememberSaveable(sessionId, deviceId) { mutableStateOf<String?>(null) }
    var currentFile by remember(sessionId, deviceId) { mutableStateOf<WorkspaceFileTarget?>(null) }
    DisposableEffect(repo, sessionId, device.selectedId) { val owner = if (device.selectedId == deviceId) repo.acquireView(sessionId) else null; onDispose { owner?.let(repo::releaseView) } }
    val changes = remember(state.timeline.events) { sessionChanges(state.timeline) }
    val fileCount = changes.filter { it.pathKnown }.map { it.path }.distinct().size
    val fileSummary = if (changes.any { !it.pathKnown }) "$fileCount 个已知文件 · ${changes.size} 条改动记录" else "$fileCount 个文件 · ${changes.size} 条改动记录"
    val change = changes.firstOrNull { it.key == selected }
    var lines by remember(change) { mutableStateOf<List<DiffLine>?>(null) }; var computing by remember(change) { mutableStateOf(change != null) }
    LaunchedEffect(change) { withContext(Dispatchers.Main.immediate) { lines = withContext(Dispatchers.Default) { change?.let(::diffLines) }; computing = false } }
    currentFile?.let { target -> CurrentFileViewer(devices, target) { currentFile = null }; return }
    Column(Modifier.fillMaxSize().testTag("live-diff")) {
        DshTopBar(if (selected == null) "文件改动" else "文件 Diff", subtitle = if (selected == null) fileSummary else change?.path?.substringAfterLast('/'), onBack = { if (selected != null) selected = null else back() })
        when {
            device.selectedId != deviceId || state.deviceId != deviceId || state.sessionId != sessionId -> Text("设备已切换，请返回当前设备会话。", Modifier.padding(20.dp), color = DshColors.Muted)
            selected == null -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp)) {
                if (state.loading) item { CircularProgressIndicator() }
                if (changes.isEmpty() && !state.loading) item { Text("已加载的消息中没有可查看的文件改动。", color = DshColors.Muted) }
                if (state.timeline.hasMore) item { TextButton({ scope.launch { repo.loadEarlier() } }, enabled = !state.paging) { Text("加载更早的改动") } }
                items(changes, key = { it.key }) { item -> DiffFileRow(item) { selected = item.key } }
                item { Text("来源：本次会话已加载的文件工具记录。", Modifier.padding(top = 20.dp), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall) }
            }
            change == null -> Text("改动记录尚未加载，请返回列表。", Modifier.padding(20.dp))
            computing -> CircularProgressIndicator()
            lines == null -> {
                Text(change.unavailable ?: "改动行数过大，无法预览；请在电脑端查看。", Modifier.padding(20.dp), color = DshColors.Muted)
                if (change.pathKnown) TextButton({ currentFile = WorkspaceFileTarget(deviceId, sessionId, change.path) }, enabled = device.connected, modifier = Modifier.testTag("diff-open-file")) { Text("打开完整文件") }
            }
            else -> {
                Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
                    Text("+${lines!!.count { it.kind == '+' }} / −${lines!!.count { it.kind == '-' }}", Modifier.weight(1f).padding(vertical = 16.dp), color = DshColors.Green, style = MaterialTheme.typography.bodySmall)
                    TextButton({ clipboard.setText(AnnotatedString(lines!!.joinToString("\n") { "${it.kind}${it.text}" })) }, Modifier.testTag("diff-copy")) { Text("复制改动") }
                }
                val horizontal = rememberScrollState()
                BoxWithConstraints(Modifier.weight(1f, fill = false).fillMaxWidth().padding(horizontal = 20.dp).clip(RoundedCornerShape(12.dp)).background(DshColors.Soft)) {
                    val viewport = maxWidth
                    LazyColumn(Modifier.fillMaxWidth().horizontalScroll(horizontal).testTag("diff-lines"), contentPadding = PaddingValues(vertical = 12.dp)) {
                        items(lines!!) { line -> Text("${line.kind} ${line.text}", Modifier.widthIn(min = viewport).background(when (line.kind) { '+' -> DshColors.Added; '-' -> DshColors.Removed; else -> DshColors.Soft }).padding(horizontal = 12.dp, vertical = 6.dp), color = when(line.kind) { '+' -> DshColors.Green; '-' -> DshColors.Red; else -> DshColors.Ink }, fontFamily = FontFamily.Monospace, softWrap = false, style = MaterialTheme.typography.bodySmall) }
                    }
                }
                if (change.pathKnown) Button({ currentFile = WorkspaceFileTarget(deviceId, sessionId, change.path) }, enabled = device.connected, modifier = Modifier.fillMaxWidth().padding(20.dp).heightIn(min = 48.dp).testTag("diff-open-file"), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = DshColors.Soft, contentColor = DshColors.Ink)) { Text("打开完整文件") }
            }
        }
    }
}

@Composable private fun DiffFileRow(change: FileChange, open: () -> Unit) {
    var counts by remember(change) { mutableStateOf<String?>(null) }
    LaunchedEffect(change) { withContext(Dispatchers.Main.immediate) {
        counts = withContext(Dispatchers.Default) { diffLines(change)?.let { rows -> "+${rows.count { it.kind == '+' }} / −${rows.count { it.kind == '-' }}" } }
    } }
    val description = if (change.unavailable != null) "无法恢复比较" else counts ?: "查看本次改动"
    Row(Modifier.fillMaxWidth().testTag("diff-file:${change.key}").clickable(onClick = open).padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        DshFileIcon(change.path, Modifier.size(28.dp))
        Column(Modifier.padding(start = 12.dp).weight(1f)) {
            Text(dshFileBasename(change.path), style = MaterialTheme.typography.titleSmall)
            Text("${change.path} · $description", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
        }
    }
    HorizontalDivider(color = DshColors.Line)
}
