package dev.dsh.mobile.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.Canvas
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.dsh.mobile.designsystem.DshColors

@Composable internal fun ConversationWorkspaceSubtitle(workspace: String?, branch: String?) {
    var details by remember(branch) { mutableStateOf(false) }
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (workspace != null) Text(workspace, Modifier.weight(1f, fill = false), style = MaterialTheme.typography.bodySmall,
            color = DshColors.Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (branch != null) {
            if (workspace != null) Text("│", Modifier.padding(horizontal = 6.dp), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
            Row(Modifier.weight(1f, fill = false).clickable { details = true }.testTag("conversation_git_branch"), verticalAlignment = Alignment.CenterVertically) {
                val muted = DshColors.Muted
                val background = DshColors.Background
                Canvas(Modifier.size(13.dp).semantics { contentDescription = "Git 分支" }) {
                    val unit = size.width / 24f
                    val stroke = 1.8f * unit
                    fun point(x: Float, y: Float) = Offset(x * unit, y * unit)
                    drawLine(muted, point(6f, 6f), point(6f, 18f), stroke)
                    drawLine(muted, point(6f, 13f), point(18f, 9f), stroke)
                    drawLine(muted, point(18f, 9f), point(18f, 6f), stroke)
                    listOf(point(6f, 4f), point(6f, 20f), point(18f, 4f)).forEach {
                        drawCircle(background, 2.5f * unit, it)
                        drawCircle(muted, 2.5f * unit, it, style = Stroke(stroke))
                    }
                }
                Spacer(Modifier.width(4.dp))
                Text(branch, maxLines = 1, overflow = TextOverflow.Ellipsis, color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
    if (details && branch != null) AlertDialog(onDismissRequest = { details = false }, title = { Text("当前分支") },
        text = { Text(branch) }, confirmButton = { TextButton({ details = false }) { Text("关闭") } })
}
