package dev.dsh.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.*
import dev.dsh.mobile.protocol.GatewayFailure
import kotlinx.coroutines.*
import java.time.LocalDate

private fun deviceSettingsError(error: Exception): String = when ((error as? GatewayFailure)?.code) {
    "storage-unavailable" -> "本地设备数据保存失败，请重试"
    "device-not-found" -> "设备已被删除，请返回设备列表"
    "last-connection" -> "至少保留一种连接方式"
    "invalid-connection-settings" -> "连接列表已变化，请重新选择"
    "invalid-device-name" -> "设备名称需为 1 至 100 个字符"
    else -> "操作未完成，请重试"
}

@Composable internal fun SettingsHelp(title: String, text: String) {
    var open by remember { mutableStateOf(false) }
    IconButton({ open = true }, Modifier.size(40.dp)) { Icon(Icons.Outlined.Info, "$title 说明", Modifier.size(18.dp), tint = DshColors.Muted) }
    if (open) AlertDialog(onDismissRequest = { open = false }, title = { Text(title) }, text = { Text(text) },
        confirmButton = { TextButton({ open = false }) { Text("知道了") } })
}
private fun usageLabel(ms: Long): String {
    val seconds = ms / 1000
    return when { seconds >= 3600 -> "${seconds / 3600}时${seconds / 60 % 60}分"; seconds >= 60 -> "${seconds / 60}分${seconds % 60}秒"; else -> "${seconds}秒" }
}
@Composable internal fun DeviceUsageChart(device: String, local: LocalDeviceDataRepository) {
    val data by local.state.collectAsStateWithLifecycle()
    val today = LocalDate.now()
    val rows = (6L downTo 0L).map { today.minusDays(it) }.map { it to (data.usage[device]?.get(it.toString()) ?: 0L) }
    val max = (rows.maxOfOrNull { it.second } ?: 0).coerceAtLeast(60_000)
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("使用时长", style = MaterialTheme.typography.titleMedium)
        SettingsHelp("使用时长", "仅统计此设备所属页面在前台使用的时间，切到后台、设备列表或全局设置时停止计时。按手机当前时区分天，数据仅保存在本机。")
    }
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Column { Text("今天", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall); Text(usageLabel(rows.last().second), style = MaterialTheme.typography.headlineSmall, modifier = Modifier.testTag("device_usage_today")) }
        Column(horizontalAlignment = Alignment.End) { Text("近 7 天", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall); Text(usageLabel(rows.sumOf { it.second }), style = MaterialTheme.typography.titleLarge) }
    }
    Row(Modifier.fillMaxWidth().height(174.dp).testTag("device_usage_chart"), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.Bottom) {
        rows.forEach { (date, duration) -> Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
            Text(if (duration < 60_000) "${duration / 1000}秒" else "${duration / 60_000}分", fontSize = 10.sp, color = DshColors.Muted, maxLines = 1)
            Spacer(Modifier.height(5.dp))
            Box(Modifier.width(18.dp).height(if (duration == 0L) 1.dp else (duration.toFloat() / max * 112).coerceAtLeast(3f).dp).background(if (date == today) DshColors.Ink else DshColors.Line, RoundedCornerShape(4.dp)))
            Spacer(Modifier.height(8.dp)); Text(if (date == today) "今天" else "${date.monthValue}/${date.dayOfMonth}", fontSize = 11.sp, color = DshColors.Muted)
        } }
    }
}

@Composable internal fun LiveDeviceSettings(state: DeviceState, repo: DeviceRepository, local: LocalDeviceDataRepository,
    back: () -> Unit, addConnection: () -> Unit, deleted: () -> Unit, connectionsChanged: () -> Unit, diagnosticInfo: @Composable () -> Unit = {}, usageInfo: @Composable () -> Unit = {}) {
    val device = state.devices.firstOrNull { it.id == state.selectedId }
    val scope = rememberCoroutineScope()
    var removeDevice by remember { mutableStateOf(false) }
    var removingConnection by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var renaming by remember(device?.id) { mutableStateOf(false) }
    var deviceName by remember(device?.id) { mutableStateOf("") }
    fun configure(preferred: String? = device?.preferredConnectionId, remove: String? = null) {
        if (device == null || working) return
        working = true; error = null
        scope.launch { try { repo.configureConnections(device.id, preferred, remove); connectionsChanged() }
            catch (cancel: CancellationException) { throw cancel }
            catch (failure: Exception) { error = deviceSettingsError(failure) }
            finally { working = false } }
    }
    Column(Modifier.fillMaxSize()) {
        DshTopBar("设备设置", subtitle = device?.name, onBack = back, subtitleContent = {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (device != null && state.defaultId == device.id) Surface(color = androidx.compose.ui.graphics.Color(0xFF191919), shape = RoundedCornerShape(4.dp)) {
                    Text("默认", Modifier.padding(horizontal = 4.dp, vertical = 1.dp), color = androidx.compose.ui.graphics.Color.White,
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 10.sp, lineHeight = 12.sp, platformStyle = androidx.compose.ui.text.PlatformTextStyle(includeFontPadding = false)))
                }
                Text(device?.name.orEmpty(), style = MaterialTheme.typography.bodySmall, color = DshColors.Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        })
        if (device != null) Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) { Text("设备名称", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall); Text(device.name) }
                IconButton({ deviceName = device.name; renaming = true }, enabled = !working, modifier = Modifier.testTag("device_rename")) { Icon(Icons.Outlined.Edit, "重命名设备") }
            }
            HorizontalDivider(color = DshColors.Line)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("连接方式", style = MaterialTheme.typography.titleMedium)
                SettingsHelp("连接方式", "每个地址需独立配对，且必须属于同一 DSH 实例。点击左侧选项手动切换；连接不可用时请手动选择其他地址，App 不会自动切换。")
                Spacer(Modifier.weight(1f))
                IconButton(addConnection, enabled = !working) { Icon(Icons.Outlined.Add, "添加连接") }
            }
            device.connections.forEach { row ->
                Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton((device.preferredConnectionId ?: device.connections.first().id) == row.id, { configure(preferred = row.id) }, enabled = !working)
                        Column(Modifier.weight(1f)) {
                            Text(row.name, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(row.origin, style = MaterialTheme.typography.bodySmall, color = DshColors.Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        IconButton({ removingConnection = row.id }, enabled = device.connections.size > 1 && !working, modifier = Modifier.size(40.dp)) { Icon(Icons.Outlined.Close, "移除此连接") }
                    }
                    HorizontalDivider(color = DshColors.Line)
                }
            }
            if (working) LinearProgressIndicator(Modifier.fillMaxWidth())
            error?.let { Text(it, color = DshColors.Red) }
            Spacer(Modifier.height(8.dp))
            usageInfo()
            HorizontalDivider(color = DshColors.Line)
            DeviceUsageChart(device.id, local)
            diagnosticInfo()
            HorizontalDivider(color = DshColors.Line)
            Button({ removeDevice = true }, enabled = !working, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("device_remove"), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = DshColors.Danger, contentColor = androidx.compose.ui.graphics.Color.White)) { Text("删除设备") }
        }
    }
    if (renaming && device != null) AlertDialog(onDismissRequest = { if (!working) renaming = false }, title = { Text("重命名设备") },
        text = { Column {
            OutlinedTextField(deviceName, { deviceName = it }, label = { Text("设备名称") }, singleLine = true, enabled = !working, modifier = Modifier.testTag("device_rename_input"))
            error?.let { Text(it, color = DshColors.Red) }
        } },
        confirmButton = { TextButton({ working = true; error = null; scope.launch {
            try { repo.renameDevice(device.id, deviceName); renaming = false }
            catch (cancel: CancellationException) { throw cancel }
            catch (failure: Exception) { error = deviceSettingsError(failure) }
            finally { working = false }
        } }, enabled = !working && deviceName.trim().length in 1..100, modifier = Modifier.testTag("device_rename_save")) { Text("保存") } },
        dismissButton = { TextButton({ renaming = false }, enabled = !working) { Text("取消") } })
    if (removingConnection != null) AlertDialog(onDismissRequest = { removingConnection = null }, title = { Text("移除连接方式？") }, text = { Text("其他连接方式和此设备的本地数据会保留。") },
        confirmButton = { TextButton({ val id = removingConnection; removingConnection = null; configure(remove = id) }) { Text("移除") } }, dismissButton = { TextButton({ removingConnection = null }) { Text("取消") } })
    if (removeDevice && device != null) AlertDialog(onDismissRequest = { removeDevice = false }, title = { Text("删除 ${device.name}？") }, text = { Text("从本 App 移除此设备的全部连接、置顶和使用记录。电脑上的工作区和会话不受影响。") },
        confirmButton = { TextButton({ removeDevice = false; working = true; scope.launch {
            try { repo.removeLocal(device.id); connectionsChanged(); deleted() }
            catch (cancel: CancellationException) { throw cancel }
            catch (failure: Exception) { error = deviceSettingsError(failure) } finally { working = false }
        } }) { Text("删除", color = DshColors.Red) } }, dismissButton = { TextButton({ removeDevice = false }) { Text("取消") } })
}

@Composable internal fun LocalCacheSettings(local: LocalDeviceDataRepository, diagnostics: DiagnosticRepository, attachmentCache: java.io.File? = null) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var confirm by remember { mutableStateOf(false) }
    var usage by remember { mutableStateOf(true) }; var pins by remember { mutableStateOf(true) }; var logs by remember { mutableStateOf(true) }; var files by remember { mutableStateOf(true) }
    var clearing by remember { mutableStateOf(false) }; var result by remember { mutableStateOf<String?>(null) }
    HorizontalDivider(color = DshColors.Line)
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("本地数据", style = MaterialTheme.typography.titleMedium)
        SettingsHelp("清除本地数据", "可以清除使用时长、App 内置顶、诊断日志和附件缓存。设备连接、认证资料、默认设备、草稿及待确认操作会保留。清理不会删除电脑上的内容；新产生的日志仍在本机记录。")
    }
    OutlinedButton({ confirm = true }, enabled = !clearing, modifier = Modifier.testTag("clear_local_cache")) { Text(if (clearing) "正在清除…" else "清除缓存数据") }
    result?.let { Text(it, color = DshColors.Muted, style = MaterialTheme.typography.bodySmall) }
    if (confirm) AlertDialog(onDismissRequest = { confirm = false }, title = { Text("清除所选本地数据？") }, text = { Column {
        Text("设备连接和未发送内容将保留。")
        listOf(Triple("使用时长", usage) { value: Boolean -> usage = value }, Triple("App 内置顶", pins) { value: Boolean -> pins = value }, Triple("诊断日志", logs) { value: Boolean -> logs = value }, Triple("附件缓存", files) { value: Boolean -> files = value }).forEach { (name, value, update) ->
            Row(Modifier.fillMaxWidth().clickable { update(!value) }, verticalAlignment = Alignment.CenterVertically) { Checkbox(value, update); Text(name) }
        }
    } }, confirmButton = { TextButton({ confirm = false; clearing = true; result = null; scope.launch {
        try {
            if (usage || pins) local.clear(usage, pins)
            if (logs) diagnostics.clear()
            if (files) withContext(Dispatchers.IO) { val cache = attachmentCache ?: java.io.File(context.cacheDir, "attachments"); if (cache.exists() && !cache.deleteRecursively()) throw GatewayFailure("cache-clear-failed") }
            result = "已清除所选数据"
        } catch (_: Exception) { result = "部分数据未能清除，请重试" }
        finally { clearing = false }
    } }, enabled = usage || pins || logs || files, modifier = Modifier.testTag("confirm_clear_local_cache")) { Text("确认清除") } }, dismissButton = { TextButton({ confirm = false }) { Text("取消") } })
}
