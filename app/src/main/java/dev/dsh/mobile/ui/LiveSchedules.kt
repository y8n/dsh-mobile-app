package dev.dsh.mobile.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.*
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import java.time.*
import java.time.format.DateTimeFormatter

private fun scheduleFailure(code: String) = when (code) {
    "schedule-conflict" -> "任务已在电脑端更新，请关闭编辑后重新打开。"
    "schedule-ended", "schedule-not-found", "schedule_not_found" -> "任务已结束或删除，请刷新列表。"
    "not-future", "not_future" -> "请选择未来时间；错过的一次性计划需要先编辑时间。"
    "invalid_prompt", "invalid-request" -> "请填写任务名称和执行内容。"
    "invalid_selector", "invalid_rule", "invalid_time_zone", "frequency_too_high", "time_out_of_range" -> "时间规则无效，请检查时间、间隔和时区。"
    "schedule-extension-required" -> "当前电脑尚未启用自动化扩展，请在电脑端安装后刷新。"
    "schedule-result-pending", "schedule-result-unknown", "result-unknown" -> "操作结果待确认，请核对原操作，避免再次创建或投递。"
    "device-changed" -> "设备或会话已切换，请在当前页面重新操作。"
    "session-archived" -> "会话已归档；恢复会话后才能创建、恢复或投递任务。"
    else -> "操作未完成，请检查连接后重试。"
}
private fun timeLabel(value: String): String = try { Instant.parse(value).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("MM-dd HH:mm")) } catch (_: Exception) { value }
private fun scheduleStatus(row: JsonObject) = when (row.text("status")) { "paused" -> "已暂停"; "inactive" -> "已结束"; else -> "计划生效" }
private fun timingLabel(row: JsonObject) = when (row.text("kind")) {
    "every" -> "每 ${row.number("everySeconds") / 60} 分钟"
    "daily" -> "每天 ${row.text("time").take(5)} · ${row.text("timeZone")}"
    "weekly" -> "每周 ${(row["weekdays"] as? JsonArray)?.joinToString("、") { it.jsonPrimitive.content }} · ${row.text("time").take(5)} · ${row.text("timeZone")}"
    "cron" -> "${row.text("expression")} · ${row.text("timeZone")}"
    else -> "${timeLabel(row.text("scheduledAt"))} · 一次"
}

@Composable fun LiveSchedules(repo: ScheduleRepository, connected: Boolean, back: () -> Unit, sessionTitle: String = "关联此会话", readOnly: Boolean = false) {
    val state by repo.state.collectAsStateWithLifecycle(context = Dispatchers.Main.immediate)
    val scope = rememberCoroutineScope { Dispatchers.Main.immediate }
    var editor by remember(state.deviceId, state.sessionId) { mutableStateOf<JsonObject?>(null) }
    var creating by rememberSaveable(state.deviceId, state.sessionId) { mutableStateOf(false) }
    var deleting by remember(state.deviceId, state.sessionId) { mutableStateOf<JsonObject?>(null) }
    var history by remember(state.deviceId, state.sessionId) { mutableStateOf<JsonObject?>(null) }
    var operations by remember(state.deviceId, state.sessionId) { mutableStateOf<JsonObject?>(null) }
    BackHandler(creating || editor != null || operations != null) { creating = false; editor = null; operations = null }
    val available = connected && state.supported && !state.busy && state.pending == null && !readOnly
    val displayedTarget = state.deviceId to state.sessionId
    val act: (suspend () -> Unit) -> Unit = { block -> scope.launch { try { block() } catch (cancel: CancellationException) { throw cancel } catch (_: Exception) { } }; Unit }
    val closeEditor = { creating = false; editor = null }
    when {
        creating || editor != null -> ScheduleEditor(editor, state, available, sessionTitle, closeEditor,
            more = { operations = editor; editor = null }, runNow = { row -> act { repo.change("runNow", row) } }) { definition ->
            val observed = editor
            act { if (observed == null) repo.create(definition, displayedTarget.first, displayedTarget.second) else repo.change("update", observed, definition); closeEditor() }
        }
        operations != null -> {
            val row = operations!!
            Column(Modifier.fillMaxSize().testTag("schedule-operations")) {
                DshTopBar("任务操作", row.text("title"), { operations = null })
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    OutlinedCard(shape = RoundedCornerShape(16.dp), colors = CardDefaults.outlinedCardColors(containerColor = DshColors.Background)) {
                        Column(Modifier.padding(12.dp)) {
                            TextButton({ editor = row; operations = null }, Modifier.fillMaxWidth()) { Icon(Icons.Outlined.Edit, null, tint = DshColors.Muted); Spacer(Modifier.width(12.dp)); Text("编辑计划", Modifier.weight(1f), color = DshColors.Ink) }
                            TextButton({ act { repo.change("runNow", row); operations = null } }, Modifier.fillMaxWidth().testTag("schedule-run:${row.string("id")}"), enabled = available && row.text("status") != "inactive") { Icon(Icons.Outlined.PlayArrow, null, tint = DshColors.Muted); Spacer(Modifier.width(12.dp)); Text("立即运行", Modifier.weight(1f), color = DshColors.Ink) }
                            if (row.text("status") == "active") {
                                TextButton({ act { repo.change("pause", row); operations = null } }, Modifier.fillMaxWidth().testTag(if (row.text("status") == "active") "schedule-toggle:${row.string("id")}" else "schedule-pause:${row.string("id")}"), enabled = available && row.text("status") == "active") { Icon(Icons.Outlined.Pause, null, tint = DshColors.Muted); Spacer(Modifier.width(12.dp)); Text("暂停计划", Modifier.weight(1f), color = if (row.text("status") == "active") DshColors.Ink else DshColors.Muted) }
                            }
                            if (row.text("status") == "paused") {
                                TextButton({ act { repo.change("resume", row); operations = null } }, Modifier.fillMaxWidth().testTag(if (row.text("status") == "paused") "schedule-toggle:${row.string("id")}" else "schedule-resume:${row.string("id")}"), enabled = available && row.text("status") == "paused") { Icon(Icons.Outlined.PlayArrow, null, tint = DshColors.Muted); Spacer(Modifier.width(12.dp)); Text("恢复计划", Modifier.weight(1f), color = if (row.text("status") == "paused") DshColors.Ink else DshColors.Muted) }
                            }
                            TextButton({ deleting = row }, Modifier.fillMaxWidth().testTag("schedule-delete:${row.string("id")}"), enabled = available) { Icon(Icons.Outlined.Delete, null, tint = DshColors.Muted); Spacer(Modifier.width(12.dp)); Text("删除计划", Modifier.weight(1f), color = DshColors.Ink) }
                        }
                    }
                    Text("暂停时保留历史；恢复后按实际计划继续。", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                    TextButton({ history = row; act { repo.history(row) } }, Modifier.fillMaxWidth().testTag("schedule-history:${row.string("id")}")) { Icon(Icons.Outlined.History, null, tint = DshColors.Muted); Spacer(Modifier.width(12.dp)); Text("投递历史", Modifier.weight(1f), color = DshColors.Ink) }
                    state.error?.let { Text(scheduleFailure(it), color = DshColors.Red) }
                }
            }
        }
        else -> Column(Modifier.fillMaxSize().testTag("live-schedules")) {
            DshTopBar("定时任务", sessionTitle, back)
            LazyColumn(Modifier.weight(1f).fillMaxWidth().testTag("schedule-list"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text("关联此会话", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                    if (readOnly) Text("会话已归档，定时任务仅可查看。", color = DshColors.Muted)
                    if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
                    if (!state.supported && !state.loading) Text("当前电脑未启用自动化扩展，可以读取已有任务。", color = DshColors.Muted)
                    state.error?.let { Text(scheduleFailure(it), Modifier.testTag("schedule-error"), color = DshColors.Red); TextButton(repo::refresh) { Text("刷新任务") } }
                    state.notice?.let { Text(it, Modifier.testTag("schedule-notice"), color = DshColors.Muted) }
                    if (state.pending != null) Column {
                        Text("操作结果待确认。核对并重试会继续原操作，避免重复创建或投递。", color = DshColors.Muted)
                        TextButton({ act { repo.reconcile(displayedTarget.first, displayedTarget.second) } }, enabled = connected && state.supported && !state.busy, modifier = Modifier.testTag("schedule-reconcile")) { Text("核对并重试原操作") }
                    }
                }
                items(state.activeEntries, key = { it.string("id") }) { row ->
                    Column(Modifier.fillMaxWidth().testTag("schedule:${row.string("id")}")) {
                        Row(Modifier.fillMaxWidth().padding(vertical = 18.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(if (row.text("status") == "inactive") Icons.Outlined.HelpOutline else Icons.Outlined.Alarm, null, Modifier.size(24.dp), tint = DshColors.Muted)
                            Column(Modifier.weight(1f).clickable { editor = row }.padding(start = 12.dp).testTag("schedule-edit:${row.string("id")}")) {
                                Text(row.text("title"), style = MaterialTheme.typography.titleMedium)
                                Text("${timingLabel(row)} · ${scheduleStatus(row)}", style = MaterialTheme.typography.bodySmall, color = DshColors.Muted)
                            }
                            IconButton({ operations = row }, Modifier.testTag("schedule-more:${row.string("id")}")) { Icon(Icons.Outlined.MoreHoriz, "任务操作", tint = DshColors.Muted) }
                        }
                        HorizontalDivider(color = DshColors.Line)
                    }
                }
                item { Text(if (state.activeEntries.isEmpty() && !state.loading) "当前会话还没有定时任务" else "任务投递后继续在此会话执行。", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall) }
            }
        }
    }
    deleting?.let { row -> AlertDialog(onDismissRequest = { deleting = null }, title = { Text("删除任务？") }, text = { Text("删除“${row.text("title") }”及其投递历史。已进入会话的消息不会被撤回。") },
        confirmButton = { TextButton({ act { repo.change("delete", row); deleting = null; operations = null } }, enabled = available, modifier = Modifier.testTag("schedule-delete-confirm")) { Text("删除") } }, dismissButton = { TextButton({ deleting = null }) { Text("取消") } }) }
    history?.let { row -> AlertDialog(onDismissRequest = { history = null }, title = { Text("投递历史") }, text = {
        Column(Modifier.heightIn(max = 400.dp).verticalScroll(rememberScrollState())) {
            Text("已投递不代表模型执行成功。", color = DshColors.Muted)
            if (state.historyLoading) LinearProgressIndicator(Modifier.fillMaxWidth())
            state.history.forEach { record -> Column(Modifier.padding(vertical = 8.dp)) {
                Text("${if (record.text("source") == "manual") "手动" else "计划"} · ${timeLabel(record.text("deliveredAt"))} · 已投递")
                record.text("prompt").takeIf { it.isNotBlank() }?.let { Text(it, color = DshColors.Muted, style = MaterialTheme.typography.bodySmall) }
            } }
            if (!state.historyLoading && state.history.isEmpty()) Text("没有保存的投递记录", color = DshColors.Muted)
            if (state.earlierUnavailable) Text("更早记录可能已不可用", color = DshColors.Muted)
            if (state.nextBefore != null) TextButton({ act { repo.history(row, true) } }, enabled = !state.historyLoading) { Text("加载更早记录") }
        }
    }, confirmButton = { TextButton({ history = null }) { Text("关闭") } }) }
}

@Composable private fun ScheduleEditor(observed: JsonObject?, state: ScheduleState, available: Boolean, sessionTitle: String, close: () -> Unit, more: () -> Unit, runNow: (JsonObject) -> Unit, save: (JsonObject) -> Unit) {
    val keyboard = LocalSoftwareKeyboardController.current
    val zone = remember { ZoneId.systemDefault() }
    val initial = remember(observed) { try { Instant.parse(observed?.text("scheduledAt")).atZone(zone) } catch (_: Exception) { ZonedDateTime.now(zone).plusHours(1) } }
    var title by rememberSaveable(observed?.text("id")) { mutableStateOf(observed?.text("title").orEmpty()) }
    var prompt by rememberSaveable(observed?.text("id")) { mutableStateOf(observed?.text("prompt").orEmpty()) }
    var kind by rememberSaveable(observed?.text("id")) { mutableStateOf(observed?.text("kind") ?: "every") }
    val initialKind = remember(observed) { kind }
    var amount by rememberSaveable(observed?.text("id")) { mutableStateOf(if (kind == "after") observed?.text("afterSeconds") ?: "60" else ((observed?.get("everySeconds") as? JsonPrimitive)?.longOrNull?.div(60) ?: 60).toString()) }
    var date by rememberSaveable(observed?.text("id")) { mutableStateOf(initial.toLocalDate().toString()) }
    var time by rememberSaveable(observed?.text("id")) { mutableStateOf(observed?.text("time")?.takeIf { it.isNotBlank() } ?: initial.toLocalTime().withSecond(0).withNano(0).toString()) }
    var timeZone by rememberSaveable(observed?.text("id")) { mutableStateOf(observed?.text("timeZone")?.takeIf { it.isNotBlank() } ?: zone.id) }
    var weekdays by rememberSaveable(observed?.text("id")) { mutableStateOf((observed?.get("weekdays") as? JsonArray)?.joinToString(",") { it.jsonPrimitive.content } ?: "1,2,3,4,5") }
    var cron by rememberSaveable(observed?.text("id")) { mutableStateOf(observed?.text("expression").orEmpty()) }
    var timingChanged by rememberSaveable(observed?.text("id")) { mutableStateOf(false) }
    var timingExpanded by rememberSaveable(observed?.text("id")) { mutableStateOf(observed == null) }
    var kinds by remember { mutableStateOf(false) }; var localError by remember { mutableStateOf<String?>(null) }
    fun definition(): JsonObject {
        // Native minute precision must include seconds for the strict Desktop
        // calendar selectors. Preserve explicit seconds/milliseconds on edits.
        val wireTime = if (kind in setOf("at", "daily", "weekly")) {
            if (!Regex("\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,3})?)?").matches(time)) throw GatewayFailure("invalid_rule")
            java.time.LocalTime.parse(time).format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss.SSS", java.util.Locale.ROOT))
        } else time
        val timing = buildJsonObject { when (kind) {
            "after" -> put("after_seconds", amount.toLongOrNull()?.takeIf { it > 0 } ?: throw GatewayFailure("invalid_rule"))
            "every" -> put("every_seconds", Math.multiplyExact(amount.toLongOrNull()?.takeIf { it >= 1 } ?: throw GatewayFailure("invalid_rule"), 60))
            "at" -> put("at", buildJsonObject { put("date", date); put("time", wireTime); put("time_zone", timeZone) })
            "daily" -> put("daily", buildJsonObject { put("time", wireTime); put("time_zone", timeZone) })
            "weekly" -> put("weekly", buildJsonObject { put("time", wireTime); put("time_zone", timeZone); put("weekdays", JsonArray(weekdays.split(',').map { JsonPrimitive(it.trim().toIntOrNull() ?: throw GatewayFailure("invalid_rule")) })) })
            "cron" -> put("cron", buildJsonObject { put("expression", cron); put("time_zone", timeZone) })
        } }
        return buildJsonObject { put("title", title.trim()); put("prompt", prompt.trim()); if (observed == null) timing.forEach { (k, v) -> put(k, v) } else if (timingChanged || kind != initialKind) put("timing", timing) }
    }
    Column(Modifier.fillMaxSize().testTag("schedule-editor")) {
        DshTopBar(observed?.text("title") ?: "新建任务", "定时任务", close, actions = { if (observed != null) IconButton(more) { Icon(Icons.Outlined.MoreHoriz, "任务操作") } })
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            observed?.let { Surface(shape = RoundedCornerShape(20.dp), color = DshColors.Soft) { Text(scheduleStatus(it), Modifier.padding(horizontal = 12.dp, vertical = 6.dp), color = if (it.text("status") == "active") DshColors.Green else DshColors.Muted) } }
            Text("任务名称", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
            ScheduleField(title, { title = it }, "schedule-title", true)
            Text("执行内容", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
            ScheduleField(prompt, { prompt = it }, "schedule-prompt", false)
            if (!timingExpanded && observed != null) {
                val summary = if (!timingChanged && kind == initialKind) timingLabel(observed).substringBefore(" · ") else when (kind) {
                    "every" -> "每 $amount 分钟"
                    "daily" -> "每天 ${time.take(5)}"
                    "weekly" -> "每周 $weekdays · ${time.take(5)}"
                    "cron" -> cron
                    "at" -> "$date ${time.take(5)}"
                    else -> "延时 $amount 秒"
                }
                ToolSummary(summary, timeZone.takeIf { kind in setOf("at", "daily", "weekly", "cron") }, Icons.Outlined.HelpOutline, Modifier.testTag("schedule-timing")) { timingExpanded = true }
            } else {
                Box { TextButton({ kinds = true }, modifier = Modifier.testTag("schedule-rule")) { Text(when (kind) { "every" -> "固定间隔"; "daily" -> "每天"; "weekly" -> "每周"; "cron" -> "Cron 规则"; "at" -> "指定时间"; "after" -> "延时一次"; else -> "规则未知" }) }
                    DropdownMenu(kinds, { kinds = false }) { listOf("every" to "固定间隔", "daily" to "每天", "weekly" to "每周", "at" to "指定时间", "after" to "延时一次", "cron" to "Cron 规则").forEach { (id, label) -> DropdownMenuItem(text = { Text(label) }, onClick = { kind = id; timingChanged = true; kinds = false }) } }
                }
                if (kind in setOf("after", "every")) OutlinedTextField(amount, { amount = it; timingChanged = true }, label = { Text(if (kind == "every") "间隔（分钟）" else "延时（秒）") }, singleLine = true, modifier = Modifier.fillMaxWidth().testTag("schedule-amount"))
                if (kind == "at") OutlinedTextField(date, { date = it; timingChanged = true }, label = { Text("日期 YYYY-MM-DD") }, singleLine = true)
                if (kind in setOf("at", "daily", "weekly")) OutlinedTextField(time, { time = it; timingChanged = true }, label = { Text("时间 HH:mm") }, singleLine = true)
                if (kind == "weekly") OutlinedTextField(weekdays, { weekdays = it; timingChanged = true }, label = { Text("星期 1–7，逗号分隔") }, singleLine = true)
                if (kind == "cron") OutlinedTextField(cron, { cron = it; timingChanged = true }, label = { Text("五项 Cron 规则") }, singleLine = true)
                if (kind in setOf("at", "daily", "weekly", "cron")) OutlinedTextField(timeZone, { timeZone = it; timingChanged = true }, label = { Text("时区") }, singleLine = true)
                if (observed != null) TextButton({ timingExpanded = false }) { Text("收起时间规则") }
            }
            (localError ?: state.error)?.let { Text(scheduleFailure(it), Modifier.testTag("schedule-editor-error"), color = DshColors.Red) }
            HorizontalDivider(color = DshColors.Line)
            Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Outlined.ChatBubbleOutline, null, tint = DshColors.Muted); Spacer(Modifier.width(12.dp)); Column { Text(sessionTitle); Text("关联会话", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall) } }
            HorizontalDivider(color = DshColors.Line)
            Button({ try { localError = null; val value = definition(); keyboard?.hide(); save(value) } catch (_: Exception) { localError = "invalid_rule" } }, enabled = available && title.isNotBlank() && prompt.isNotBlank(), modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("schedule-save"), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = DshColors.Ink, contentColor = DshColors.OnInk)) { Text("保存计划") }
            if (observed != null) Button({ runNow(observed) }, enabled = available && observed.text("status") != "inactive", modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = DshColors.Soft, contentColor = DshColors.Ink)) { Text("立即运行") }
            Text("投递记录不代表模型执行成功。", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
            TextButton(close) { Text("取消") }
        }
    }
}

@Composable private fun ScheduleField(value: String, change: (String) -> Unit, tag: String, single: Boolean) {
    BasicTextField(value, change, Modifier.fillMaxWidth().testTag(tag), singleLine = single, maxLines = if (single) 1 else 5,
        textStyle = MaterialTheme.typography.bodyLarge.copy(color = DshColors.Ink), decorationBox = { input ->
            Box(Modifier.fillMaxWidth().heightIn(min = 52.dp).background(DshColors.Soft, RoundedCornerShape(12.dp)).padding(horizontal = 14.dp, vertical = 14.dp), contentAlignment = Alignment.CenterStart) { input() }
        })
}
