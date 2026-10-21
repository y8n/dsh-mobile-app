package dev.dsh.mobile.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.sp
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import dev.dsh.mobile.data.ConversationState
import dev.dsh.mobile.designsystem.DshColors
import dev.dsh.mobile.designsystem.DshTopBar
import dev.dsh.mobile.protocol.text
import kotlinx.serialization.json.*

@Composable fun ConnectionLostScreen(deviceName: String?, back: () -> Unit, reconnect: () -> Unit, settings: () -> Unit, reason: String? = null) {
    Column(Modifier.fillMaxSize().testTag("connection_lost_screen")) {
        DshTopBar("连接已断开", subtitle = deviceName, onBack = back)
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Icon(Icons.Outlined.WifiOff, null, Modifier.size(36.dp), tint = DshColors.Muted)
            Text(if (reason in setOf("initial-timeout", "stream-timeout")) "连接等待超时，正在后台重试" else "暂时无法连接电脑", style = MaterialTheme.typography.titleLarge)
            Text("检查网络和电脑端 DSH 是否运行。草稿已保留，恢复后同步最新状态。", color = DshColors.Muted, style = MaterialTheme.typography.bodyMedium)
            Button(reconnect, Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("connection_reconnect"), shape = RoundedCornerShape(12.dp)) { Text("重新连接") }
            FilledTonalButton(settings, Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("connection_settings"), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.filledTonalButtonColors(containerColor = DshColors.Soft, contentColor = DshColors.Ink)) { Text("连接设置") }
        }
    }
}

fun contextPercent(state: ConversationState): Int? {
    val context = state.projections["contextPressure"] as? JsonObject ?: return null
    val used = (context["projectedTokens"] as? JsonPrimitive)?.doubleOrNull ?: (context["pressureTokens"] as? JsonPrimitive)?.doubleOrNull ?: return null
    val window = (context["contextWindow"] as? JsonPrimitive)?.doubleOrNull ?: return null
    return if (used.isFinite() && used >= 0 && window.isFinite() && window > 0) (100 * used / window).takeIf { it.isFinite() && it <= Int.MAX_VALUE }?.toInt() else null
}

fun formatTokenCount(value: Long): String = when {
    value >= 100_000_000 -> String.format(java.util.Locale.ROOT, "%.2f亿", value / 100_000_000.0)
    value > 10_000 -> String.format(java.util.Locale.ROOT, "%.2f万", value / 10_000.0)
    else -> value.toString()
}

fun permissionLabel(value: String, fallback: String): String = when (value) {
    "read-only", "readonly" -> "仅可查看"
    "workspace-write", "default" -> "工作区内修改"
    "danger-full-access", "full-access", "full" -> "完全权限"
    else -> fallback
}

fun permissionDescription(value: String, fallback: String): String = when (value) {
    "read-only", "readonly" -> "查看文件和内容，不修改工作区。"
    "workspace-write", "default" -> "允许修改工作区内的文件。"
    "danger-full-access", "full-access", "full" -> "允许访问和修改全部文件。"
    else -> fallback
}

@Composable fun ConversationStats(state: ConversationState) {
    var details by remember(state.deviceId, state.sessionId) { mutableStateOf(false) }
    val usage = state.projections["tokenUsage"] as? JsonObject
    val buckets = listOf("uncachedInputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens").map { (usage?.get(it) as? JsonPrimitive)?.longOrNull }
    val tokens = if (buckets.all { it != null }) formatTokenCount(buckets.filterNotNull().sum()) else "—"
    val context = state.projections["contextPressure"] as? JsonObject
    val used = ((context?.get("projectedTokens") as? JsonPrimitive)?.takeIf { it.doubleOrNull != null }
        ?: (context?.get("pressureTokens") as? JsonPrimitive))?.takeIf { it.doubleOrNull?.let { value -> value.isFinite() && value >= 0 } == true }
    val window = (context?.get("contextWindow") as? JsonPrimitive)?.takeIf { it.doubleOrNull?.let { value -> value.isFinite() && value > 0 } == true }
    val pressure = contextPercent(state)?.let { if (it == 0 && (used?.doubleOrNull ?: 0.0) > 0) "<1%" else "$it%" } ?: "—"
    Row(Modifier.fillMaxWidth().padding(horizontal = 32.dp).clickable { details = true }
        .padding(vertical = 4.dp).testTag("conversation_stats"),
        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
        Text("$tokens tokens", Modifier.testTag("conversation_stats_tokens"), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
        Text("上下文 $pressure", Modifier.testTag("conversation_stats_context"), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
    }
    if (details) AlertDialog(onDismissRequest = { details = false }, title = { Text("会话统计") }, text = {
        Text("请求侧估算 ${used?.content ?: "—"} / ${window?.content ?: "—"} token", Modifier.testTag("conversation_context_window"), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
    }, confirmButton = { TextButton({ details = false }) { Text("关闭") } })
}

@Composable fun GoalControls(state: ConversationState, readOnly: Boolean, createRequest: Int = 0, showCreateEntry: Boolean = true, action: (String, String?, JsonObject?) -> Unit) {
    val goal = (state.projections["goal"] as? JsonObject)?.get("goal") as? JsonObject
    var form by remember(state.deviceId, state.sessionId) { mutableStateOf(false) }
    var clear by remember(state.deviceId, state.sessionId) { mutableStateOf(false) }
    var objective by remember(state.deviceId, state.sessionId) { mutableStateOf("") }
    var capturedRef by remember(state.deviceId, state.sessionId) { mutableStateOf<JsonObject?>(null) }
    fun ref(): JsonObject? = goal?.let { buildJsonObject { put("id", it.getValue("id")); put("revision", it.getValue("revision")) } }
    fun open() { capturedRef = ref(); objective = goal?.text("objective").orEmpty(); form = true }
    LaunchedEffect(createRequest) { if (createRequest > 0) { capturedRef = null; objective = ""; form = true } }
    val enabled = !readOnly && state.connected && !state.controlsBusy
    val phase = goal?.text("phase")
    val activation = state.goalActivation?.takeIf { it["id"] == goal?.get("id") && it["revision"] == goal?.get("revision") }?.text("activation")
    val label = when (phase) { "active" -> if (activation == "disarmed") "未运行的目标" else "进行中的目标"; "paused" -> "已暂停的目标"; "blocked" -> "受阻的目标"; "complete" -> "已完成"; null -> "未设置"; else -> "状态未知" }
    LaunchedEffect(goal?.get("id"), phase == "complete") { form = false; clear = false }
    Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 4.dp)) {
        if (goal == null && showCreateEntry) TextButton({ capturedRef = null; objective = ""; form = true }, enabled = enabled, modifier = Modifier.testTag("goal_create")) { Text("添加目标") }
        else if (goal != null && phase != "complete") Surface(shape = RoundedCornerShape(12.dp), color = DshColors.Soft, shadowElevation = 2.dp, modifier = Modifier.fillMaxWidth().testTag("goal_dock")) {
            Row(Modifier.padding(start = 10.dp, end = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(androidx.compose.ui.res.painterResource(dev.dsh.mobile.R.drawable.ic_dsh_goal), null, Modifier.size(16.dp), tint = DshColors.Muted)
                Text("[$label] ${goal.text("objective")}", Modifier.weight(1f).padding(start = 8.dp).testTag("goal_objective"), maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis, fontSize = 12.sp)
                if (phase == "active" && activation != "disarmed") IconButton({ action("pause", null, ref()) }, enabled = enabled, modifier = Modifier.size(40.dp).testTag("goal_dock_pause")) { Icon(Icons.Outlined.PauseCircleOutline, "暂停目标", Modifier.size(18.dp)) }
                if (phase == "paused" || phase == "active" && activation == "disarmed") IconButton({ action("resume", null, ref()) }, enabled = enabled, modifier = Modifier.size(40.dp).testTag("goal_dock_resume")) { Icon(Icons.Outlined.PlayCircleOutline, "恢复目标", Modifier.size(18.dp)) }
                IconButton(::open, enabled = enabled, modifier = Modifier.size(40.dp).testTag("goal_edit")) { Icon(Icons.Outlined.Edit, "编辑目标", Modifier.size(18.dp)) }
                IconButton({ capturedRef = ref(); clear = true }, enabled = enabled, modifier = Modifier.size(40.dp).testTag("goal_dock_clear")) { Icon(Icons.Outlined.DeleteOutline, "删除目标", Modifier.size(18.dp)) }
            }
        }
    }
    if (form) dev.dsh.mobile.designsystem.DshDialog({ form = false }, properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        androidx.activity.compose.BackHandler { form = false }
        Surface(Modifier.fillMaxSize().imePadding(), color = DshColors.Background) {
            Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).testTag("goal_page")) {
                DshTopBar("目标模式", subtitle = "当前会话", onBack = { form = false })
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Surface(shape = RoundedCornerShape(20.dp), color = DshColors.Soft) {
                        Text(label, Modifier.padding(horizontal = 12.dp, vertical = 6.dp), color = if (phase == "active") DshColors.Green else DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                    }
                    dev.dsh.mobile.designsystem.DshFormField(objective, { objective = it }, "目标内容", Modifier.testTag("goal_input"), enabled = enabled, singleLine = false)

                    Button({ action(if (capturedRef == null) "create" else "edit", objective, capturedRef); form = false },
                        enabled = enabled && objective.isNotBlank(), modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("goal_save"), shape = RoundedCornerShape(12.dp)) { Text("保存目标") }
                    if (capturedRef != null) {
                        if (phase == "active") FilledTonalButton({ action("pause", null, capturedRef); form = false }, enabled = enabled,
                            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("goal_pause"), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.filledTonalButtonColors(containerColor = DshColors.Soft, contentColor = DshColors.Ink)) { Text("暂停目标") }
                        if (phase in setOf("paused", "blocked")) FilledTonalButton({ action("resume", null, capturedRef); form = false }, enabled = enabled,
                            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("goal_resume"), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.filledTonalButtonColors(containerColor = DshColors.Soft, contentColor = DshColors.Ink)) { Text("恢复目标") }
                        if (phase != "complete") FilledTonalButton({ action("complete", null, capturedRef); form = false }, enabled = enabled,
                            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("goal_complete"), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.filledTonalButtonColors(containerColor = DshColors.Soft, contentColor = DshColors.Ink)) { Text("标记完成") }
                        Spacer(Modifier.height(12.dp))
                        TextButton({ form = false; clear = true }, enabled = enabled, modifier = Modifier.fillMaxWidth().testTag("goal_clear")) {
                            Column(Modifier.fillMaxWidth()) {
                                Text("清除目标", color = DshColors.Ink, style = MaterialTheme.typography.titleMedium)
                                Text("移除目标及其激活状态", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                        HorizontalDivider(color = DshColors.Line)
                    } else TextButton({ form = false }, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("取消") }
                }
            }
        }
    }
    if (clear) AlertDialog(onDismissRequest = { clear = false }, title = { Text("清除当前目标？") }, text = { Text("保留电脑端历史记录。") },
        confirmButton = { TextButton({ action("clear", null, capturedRef); clear = false }, enabled = enabled, modifier = Modifier.testTag("goal_clear_confirm")) { Text("清除") } },
        dismissButton = { TextButton({ clear = false }) { Text("取消") } })
}
