package dev.dsh.mobile.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.dsh.mobile.data.AttachmentTarget
import dev.dsh.mobile.data.DownloadedAttachment
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import dev.dsh.mobile.designsystem.DshColors
import dev.dsh.mobile.protocol.*
import kotlinx.serialization.json.*

@Composable fun ProcessDisclosure(process: TurnProcess, expanded: Boolean, toggle: () -> Unit) {
    Column(Modifier.fillMaxWidth().testTag("turn_process_${process.id}")) {
        Row(Modifier.fillMaxWidth().heightIn(min = 28.dp).clickable(enabled = process.foldable, onClick = toggle), verticalAlignment = Alignment.CenterVertically) {
            Text(process.label, color = DshColors.Muted, fontSize = 14.sp, lineHeight = 20.sp)
            if (process.foldable) Icon(if (expanded) Icons.Outlined.KeyboardArrowUp else Icons.Outlined.KeyboardArrowDown,
                if (expanded) "收起执行过程" else "展开执行过程", Modifier.size(18.dp), tint = DshColors.Muted)
        }
        HorizontalDivider(color = DshColors.Line, thickness = 0.5.dp)
    }
}

@Composable fun ProcessGroupDisclosure(group: ProcessGroup, expanded: Boolean, toggle: () -> Unit) {
    Row(Modifier.fillMaxWidth().testTag(group.id).heightIn(min = 24.dp).clickable(onClick = toggle).padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(if (group.label.contains("文件")) Icons.Outlined.FolderOpen else Icons.Outlined.Build, null, Modifier.size(14.dp), tint = DshColors.Muted)
        Text(group.label, Modifier.weight(1f).padding(start = 8.dp), fontSize = 13.sp, lineHeight = 18.sp, color = DshColors.Muted)
        Icon(if (expanded) Icons.Outlined.KeyboardArrowUp else Icons.Outlined.KeyboardArrowDown, if (expanded) "收起过程组" else "展开过程组", Modifier.size(14.dp), tint = DshColors.Muted)
    }
}

@Composable private fun ReasoningMessage(text: String) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        Row(Modifier.fillMaxWidth().heightIn(min = 24.dp).clickable { expanded = !expanded }.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.Psychology, null, Modifier.size(14.dp), tint = DshColors.Muted)
            Text("思考过程", Modifier.padding(start = 8.dp), fontSize = 13.sp, lineHeight = 18.sp, color = DshColors.Muted)
            if (!expanded) Text(text.lineSequence().firstOrNull().orEmpty().replace("**", ""), Modifier.weight(1f).padding(start = 12.dp), maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 13.sp, lineHeight = 18.sp, color = DshColors.Muted)
            Icon(if (expanded) Icons.Outlined.KeyboardArrowUp else Icons.Outlined.KeyboardArrowDown, null, Modifier.size(14.dp), tint = DshColors.Muted)
        }
        if (expanded) MarkdownContent(text, Modifier.padding(start = 22.dp))
    }
}

@Composable private fun MessageAttachment(block: JsonObject, deviceId: String?, sessionId: String?, attachment: ((AttachmentTarget) -> Unit)?, loader: (suspend (AttachmentTarget) -> DownloadedAttachment)?, compact: Boolean) {
    val ref = block["attachment"] as? JsonObject ?: return
    val kind = block.text("type")
    val target = if (deviceId != null && sessionId != null && ref.text("attachmentId").isNotBlank()) AttachmentTarget(deviceId, sessionId, ref.text("attachmentId"), kind, ref.text("name")) else null
    var bitmap by remember(target) { mutableStateOf<android.graphics.Bitmap?>(null) }
    var failed by remember(target) { mutableStateOf(false) }
    var attempt by remember(target) { mutableIntStateOf(0) }
    val previewable = kind == "image" && target != null && loader != null && ((ref["bytes"] as? JsonPrimitive)?.longOrNull ?: Long.MAX_VALUE) <= 8L * 1024 * 1024
    LaunchedEffect(target, attempt) {
        if (previewable) try {
            val file = loader!!(target!!).file
            bitmap = withContext(Dispatchers.IO) {
                val dimensions = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
                android.graphics.BitmapFactory.decodeFile(file.path, dimensions)
                val sample = generateSequence(1) { it * 2 }.first { maxOf(dimensions.outWidth, dimensions.outHeight) / it <= 720 }
                android.graphics.BitmapFactory.decodeFile(file.path, android.graphics.BitmapFactory.Options().apply { inSampleSize = sample })
            }
            failed = bitmap == null
        } catch (cancel: kotlinx.coroutines.CancellationException) { throw cancel }
        catch (_: Exception) { failed = true }
    }
    val image = bitmap
    if (image != null) {
        Surface(Modifier.width(if (compact) 64.dp else 240.dp).testTag("open-attachment:${ref.text("attachmentId")}")
            .clickable { target?.let { attachment?.invoke(it) } }, shape = RoundedCornerShape(12.dp)) {
            Image(image.asImageBitmap(), ref.text("name").ifBlank { "图片附件" }, Modifier.fillMaxWidth().aspectRatio(if (compact) 1f else (image.width.toFloat() / image.height).coerceIn(.25f, 4f)), contentScale = if (compact) ContentScale.Crop else ContentScale.Fit)
        }
    } else Surface(Modifier.width(240.dp).heightIn(min = 64.dp).testTag("open-attachment:${ref.text("attachmentId")}")
        .clickable(enabled = target != null && attachment != null) { target?.let { attachment?.invoke(it) } }, shape = RoundedCornerShape(16.dp), color = DshColors.Soft) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            DshFileIcon(ref.text("name"), Modifier.size(28.dp), kind = if (kind == "image") DshFileType.IMAGE else null)
            Column(Modifier.padding(start = 12.dp).weight(1f)) {
                Text(ref.text("name").ifBlank { if (kind == "image") "图片" else "附件" }, maxLines = 2, overflow = TextOverflow.Ellipsis, fontSize = 14.sp)
                val bytes = (ref["bytes"] as? JsonPrimitive)?.longOrNull
                Text(listOfNotNull(dshFileExtension(ref.text("name")).uppercase().takeIf { it.isNotBlank() }, bytes?.let { if (it >= 1024) "${it / 1024} KB" else "$it B" }).joinToString(" · "), color = DshColors.Muted, fontSize = 11.sp)
                if (failed) TextButton({ failed = false; attempt++ }) { Text("重试缩略图") }
            }
        }
    }
}

@Composable fun TranscriptMessage(row: MessageRow, deviceId: String?, sessionId: String?, attachment: ((AttachmentTarget) -> Unit)?, copyEnabled: Boolean = true, loader: (suspend (AttachmentTarget) -> DownloadedAttachment)? = null) {
    val isUser = row.kind == "user"
    val attachments = row.parts.mapNotNull { it as? JsonObject }.filter { it.text("type") in setOf("image", "file") }
    Column(Modifier.fillMaxWidth().testTag("message_${row.seq}"), horizontalAlignment = if (isUser) Alignment.End else Alignment.Start, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (row.kind in setOf("user", "context", "trigger")) attachments.forEach { MessageAttachment(it, deviceId, sessionId, attachment, loader, attachments.size > 1) }
        when (row.kind) {
            "compact" -> {
                var expanded by remember(row.seq) { mutableStateOf(false) }
                Column(Modifier.fillMaxWidth().background(DshColors.Soft, RoundedCornerShape(8.dp)).testTag("compaction_${row.seq}")) {
                    Row(Modifier.fillMaxWidth().clickable(enabled = row.detail.isNotBlank()) { expanded = !expanded }.padding(horizontal = 10.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(if (expanded) Icons.Outlined.KeyboardArrowDown else Icons.Outlined.KeyboardArrowRight, if (expanded) "收起摘要" else "展开摘要", Modifier.size(14.dp), tint = DshColors.Muted)
                        Text(row.text, Modifier.padding(start = 6.dp), fontSize = 12.sp, color = DshColors.Muted)
                    }
                    if (expanded) Box(Modifier.padding(12.dp)) { MarkdownContent(row.detail) }
                }
            }
            "user" -> if (row.text.isNotBlank()) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                Surface(Modifier.widthIn(max = 600.dp).widthIn(max = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.dp * .82f), shape = RoundedCornerShape(20.dp), color = DshColors.Soft) {
                    SelectionContainer { Text(row.text, Modifier.padding(horizontal = 16.dp, vertical = 10.dp), fontSize = 14.sp, lineHeight = 22.sp) }
                }
            }
            "assistant" -> {
                row.parts.forEach { part ->
                    val block = part as? JsonObject ?: return@forEach
                    when (block.text("type")) {
                        "reasoning" -> if (block.text("text").isNotBlank()) ReasoningMessage(block.text("text"))
                        "text" -> if (block.text("text").isNotBlank()) MarkdownContent(block.text("text"))
                        "image", "file" -> MessageAttachment(block, deviceId, sessionId, attachment, loader, attachments.size > 1)
                    }
                }
                if (row.parts.isEmpty() && row.text.isNotBlank()) MarkdownContent(row.text)
                if (copyEnabled) ReplyCopyAction(row)
            }
            "tool", "context", "trigger" -> {
                var expanded by remember { mutableStateOf(false) }
                Row(Modifier.fillMaxWidth().heightIn(min = 24.dp).clickable { expanded = !expanded }.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(if (row.kind == "tool") Icons.Outlined.Build else if (row.kind == "trigger" && row.detail == "schedule") Icons.Outlined.Alarm else Icons.Outlined.Info, null, Modifier.size(14.dp), tint = DshColors.Muted)
                    Text(if (row.kind == "tool") row.text else if (row.kind == "trigger") (if (row.detail == "schedule") "定时任务" else "执行请求") else "会话上下文", Modifier.weight(1f).padding(start = 8.dp), color = DshColors.Muted, fontSize = 13.sp, lineHeight = 18.sp)
                    Icon(if (expanded) Icons.Outlined.KeyboardArrowUp else Icons.Outlined.KeyboardArrowDown, if (expanded) "收起详情" else "展开详情", Modifier.size(14.dp), tint = DshColors.Muted)
                }
                if (expanded) {
                    MarkdownContent(if (row.kind == "tool") row.detail else row.text)
                    if (row.kind == "tool") attachments.forEach { MessageAttachment(it, deviceId, sessionId, attachment, loader, attachments.size > 1) }
                }
            }
            else -> Text(row.text, color = DshColors.Muted)
        }
    }
}

@Composable fun ReplyCopyAction(row: MessageRow) {
    if (row.text.isBlank()) return
    val clipboard = LocalClipboardManager.current
    var copied by remember(row.seq) { mutableStateOf(false) }
    LaunchedEffect(copied) { if (copied) { kotlinx.coroutines.delay(1000); copied = false } }
    IconButton({ clipboard.setText(AnnotatedString(row.text)); copied = true }, Modifier.size(36.dp).testTag("copy_message_${row.seq}")) {
        Icon(if (copied) Icons.Outlined.Check else Icons.Outlined.ContentCopy, if (copied) "已复制" else "复制回复", Modifier.size(16.dp), tint = DshColors.Muted)
    }
}
