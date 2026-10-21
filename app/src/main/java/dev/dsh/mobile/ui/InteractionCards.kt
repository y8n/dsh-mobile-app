package dev.dsh.mobile.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import dev.dsh.mobile.data.PendingInteraction
import dev.dsh.mobile.designsystem.DshColors
import dev.dsh.mobile.protocol.text
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircleOutline
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import kotlinx.serialization.json.*

@Composable fun ApprovalInteraction(request: PendingInteraction, enabled: Boolean, details: String? = null, answer: (JsonElement) -> Unit) {
    Surface(color = DshColors.Background, modifier = Modifier.fillMaxWidth().testTag("approval_${request.id}")) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            val localized = (request.request["displayReason"] as? JsonObject)?.text("zh").orEmpty()
            Text(localized.ifBlank { request.request.text("reason") }.ifBlank { "电脑端请求执行此操作。" }, style = MaterialTheme.typography.headlineSmall)
            Text("工具执行暂停，等待你的决定。", color = DshColors.Muted)
            if (details != null) Surface(color = DshColors.Soft, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                val arguments = runCatching { dev.dsh.mobile.protocol.WireJson.parseToJsonElement(details).jsonObject }.getOrNull()
                val command = arguments?.text("command").orEmpty()
                val readable = if (command.isNotBlank() && arguments!!.keys.all { it in setOf("command", "cwd") }) {
                    command + arguments.text("cwd").takeIf { it.isNotBlank() }?.let { "\n目录：$it" }.orEmpty()
                } else details
                Text(readable, Modifier.padding(16.dp), style = MaterialTheme.typography.bodyMedium)
            }
            else if (request.request.text("callId").isNotBlank()) Text("操作详情加载中…", color = DshColors.Muted)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button({ answer(JsonPrimitive("allowed-once")) }, enabled = enabled && !request.sending && (request.request.text("callId").isBlank() || details != null), modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("approval_allow_${request.id}"), shape = RoundedCornerShape(12.dp)) { Text(if (request.sending) "提交中…" else "允许本次") }
                FilledTonalButton({ answer(JsonPrimitive("rejected")) }, enabled = enabled && !request.sending, modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("approval_reject_${request.id}"), shape = RoundedCornerShape(12.dp)) { Text("拒绝") }
            }
        }
    }
}

@Composable fun QuestionInteraction(key: String, questions: JsonArray, enabled: Boolean, submitting: Boolean, answer: (JsonObject) -> Unit) {
    var selected by remember(key) { mutableStateOf<Map<String, Set<String>>>(emptyMap()) }
    var custom by remember(key) { mutableStateOf<Map<String, String>>(emptyMap()) }
    val complete = questions.isNotEmpty() && questions.all { q -> val id = q.jsonObject.text("id"); !selected[id].isNullOrEmpty() || !custom[id].isNullOrBlank() }
    Surface(color = DshColors.Background, modifier = Modifier.fillMaxWidth().testTag("question_$key")) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            questions.forEach { item ->
                val question = item.jsonObject; val id = question.text("id")
                Text(question.text("question"), style = MaterialTheme.typography.headlineSmall)
                question.text("detail").takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                (question["options"] as? JsonArray).orEmpty().forEach { entry ->
                    val option = entry.jsonObject; val label = option.text("label")
                    val checked = label in selected[id].orEmpty()
                    val multi = (question["multiSelect"] as? JsonPrimitive)?.booleanOrNull == true
                    val change: (Boolean) -> Unit = { value ->
                            val next = if (!value) selected[id].orEmpty() - label else if (multi) selected[id].orEmpty() + label else setOf(label)
                            selected = selected + (id to next)
                            if (!multi && value) custom = custom + (id to "")
                    }
                    Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        val optionTag = Modifier.testTag("question_option_${key}_${id}_$label")
                        if (multi) Checkbox(checked, change, enabled = enabled && !submitting, modifier = optionTag)
                        else IconToggleButton(checked, change, enabled = enabled && !submitting, modifier = optionTag) {
                            Icon(if (checked) Icons.Outlined.CheckCircleOutline else Icons.Outlined.RadioButtonUnchecked, null, tint = DshColors.Muted)
                        }
                        Column(Modifier.weight(1f).padding(vertical = 12.dp)) { Text(label, style = MaterialTheme.typography.titleMedium); option.text("description").takeIf { it.isNotBlank() }?.let { Text(it, color = DshColors.Muted, style = MaterialTheme.typography.bodySmall) } }
                    }
                    HorizontalDivider(color = DshColors.Line)
                }
                val freeform = (question["options"] as? JsonArray).isNullOrEmpty()
                Text(if (freeform) "你的回答" else "补充说明（可选）", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                TextField(custom[id].orEmpty(), { value ->
                    custom = custom + (id to value)
                    if ((question["multiSelect"] as? JsonPrimitive)?.booleanOrNull != true && value.isNotBlank()) selected = selected + (id to emptySet())
                }, placeholder = { Text(if (freeform) "输入你的回答" else "输入你的补充说明") }, enabled = enabled && !submitting, modifier = Modifier.fillMaxWidth().testTag("question_custom_${key}_$id"), maxLines = 4, shape = RoundedCornerShape(12.dp),
                    colors = TextFieldDefaults.colors(focusedContainerColor = DshColors.Soft, unfocusedContainerColor = DshColors.Soft, focusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent, unfocusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent))
            }
            Button({ answer(buildJsonObject { put("answers", buildJsonArray {
                questions.forEach { q -> val id = q.jsonObject.text("id"); add(buildJsonObject {
                    put("id", id); put("selected", JsonArray(selected[id].orEmpty().map(::JsonPrimitive)))
                    custom[id]?.trim()?.takeIf { it.isNotBlank() }?.let { put("custom", it) }
                }) }
            }) }) }, enabled = enabled && complete && !submitting, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("question_submit_$key"), shape = RoundedCornerShape(12.dp)) { Text(if (submitting) "提交中…" else "提交回答") }
        }
    }
}
