package dev.dsh.mobile.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.TrackChanges
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material.icons.outlined.Compress
import androidx.compose.material.icons.outlined.DriveFileRenameOutline
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.foundation.layout.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.activity.compose.BackHandler
import dev.dsh.mobile.designsystem.*

@Composable
fun SessionMenu(id: String, title: String, archived: Boolean, pinned: Boolean, enabled: Boolean,
                action: (String, String, String?) -> Unit, compact: (() -> Unit)? = null, automation: (() -> Unit)? = null, goal: (() -> Unit)? = null,
                running: Boolean = false, contextPercent: Int? = null, compactAvailable: Boolean? = null, compactLoading: Boolean = false, retryCommands: (() -> Unit)? = null,
                statistics: (@Composable () -> Unit)? = null, onMenuVisible: (Boolean) -> Unit = {}, onMenuHeight: (Int) -> Unit = {}) {
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    var menu by remember(id) { mutableStateOf(false) }
    var rename by remember(id) { mutableStateOf(false) }
    var archive by remember(id) { mutableStateOf(false) }
    var compress by remember(id) { mutableStateOf(false) }
    var stopActivity by remember(id) { mutableStateOf(false) }
    var name by remember(id, title) { mutableStateOf(title) }
    LaunchedEffect(menu) { onMenuVisible(menu) }
    Box {
        IconButton({ menu = true }, enabled = true, modifier = Modifier.testTag("session_menu_$id")) { Icon(Icons.Outlined.MoreHoriz, "会话菜单") }
        DropdownMenu(menu, { menu = false }, modifier = Modifier.width((androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp - 40).dp).onSizeChanged { onMenuHeight(it.height) },
            containerColor = DshColors.Overlay, shape = androidx.compose.ui.graphics.RectangleShape, tonalElevation = 0.dp, shadowElevation = 0.dp) {
            Surface(shape = RoundedCornerShape(16.dp), border = androidx.compose.foundation.BorderStroke(1.dp, DshColors.Line), color = DshColors.Overlay) {
            Column {
            DropdownMenuItem(text = { Text("复制会话 ID") }, leadingIcon = { Icon(Icons.Outlined.ContentCopy, null) },
                modifier = Modifier.testTag("session_copy_id_$id"), onClick = {
                    clipboard.setText(AnnotatedString(id)); menu = false
                    android.widget.Toast.makeText(context, "已复制会话 ID", android.widget.Toast.LENGTH_SHORT).show()
                })
            if (!archived) DropdownMenuItem(text = { Text(if (pinned) "取消置顶" else "置顶") }, leadingIcon = { Icon(Icons.Outlined.PushPin, null) }, onClick = { menu = false; action(id, if (pinned) "unpin" else "pin", null) })
            DropdownMenuItem(enabled = enabled, text = { Text(if (archived) "取消归档" else "归档") }, onClick = {
                menu = false
                if (archived) action(id, "restore", null) else { stopActivity = running; archive = true }
            }, leadingIcon = { Icon(Icons.Outlined.Archive, null) })
            if (!archived && compact != null) DropdownMenuItem(text = { Text("压缩上下文") }, leadingIcon = { Icon(Icons.Outlined.Compress, null) }, onClick = { menu = false; compress = true }, modifier = Modifier.testTag("session_compact"))
            DropdownMenuItem(enabled = enabled, text = { Text("重命名") }, leadingIcon = { Icon(Icons.Outlined.DriveFileRenameOutline, null) }, onClick = { menu = false; name = title; rename = true })
            if (!archived && goal != null) DropdownMenuItem(text = { Text("添加目标") }, leadingIcon = { Icon(androidx.compose.ui.res.painterResource(dev.dsh.mobile.R.drawable.ic_dsh_goal), null) }, onClick = { menu = false; goal() }, modifier = Modifier.testTag("goal_create"))
            if (automation != null) DropdownMenuItem(text = { Text("定时任务") }, leadingIcon = { Icon(Icons.Outlined.Schedule, null) }, onClick = { menu = false; automation() }, modifier = Modifier.testTag("session_automation_menu"))
            }
            }
            statistics?.invoke()
            if (statistics != null) HorizontalDivider(color = DshColors.Line)
        }
    }
    if (rename) SessionActionPage("重命名会话", title, { rename = false }) {
        DshFormField(name, { name = it }, "会话名称", placeholder = "输入会话名称", modifier = Modifier.testTag("session_rename_input"))
        Button({ action(id, "rename", name); rename = false }, enabled = enabled && name.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(48.dp).testTag("session_rename_confirm"), shape = RoundedCornerShape(12.dp)) { Text("保存名称") }
        FilledTonalButton({ rename = false }, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(12.dp)) { Text("取消") }
    }
    if (archive) SessionActionPage("归档会话", title, { archive = false }) {
            Text(if (running) "会话仍在运行" else "归档此会话", style = MaterialTheme.typography.headlineSmall)
            Text(if (running) "归档前可停止当前执行。已有消息与文件改动会保留。" else "已有消息与文件改动会保留，归档后可从已归档列表恢复。", color = DshColors.Muted)
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                Checkbox(stopActivity, { stopActivity = it }, modifier = Modifier.testTag("session_archive_stop_activity"))
                Text("停止正在运行的活动并归档")
            }
            Button({ action(id, if (stopActivity) "archive-stop" else "archive", null); archive = false }, enabled = enabled,
                modifier = Modifier.fillMaxWidth().height(48.dp).testTag("session_archive_confirm"), shape = RoundedCornerShape(12.dp)) { Text(if (stopActivity) "停止并归档" else "归档") }
            FilledTonalButton({ archive = false }, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(12.dp)) { Text("返回会话") }
        }
    if (compress) SessionActionPage("压缩上下文", title, { compress = false }) {
        Text(contextPercent?.let { "当前上下文 $it%" } ?: "当前上下文 —", style = MaterialTheme.typography.headlineSmall)
        Text("压缩后保留工作摘要，减少后续请求的上下文占用。原始会话历史仍可查看。", color = DshColors.Muted)
        if (running) Text("当前执行仍在进行，电脑端可能拒绝压缩。", color = DshColors.Muted)
        if (compactLoading) Text("正在读取压缩可用性…", color = DshColors.Muted)
        else if (compactAvailable == false) Text("电脑端当前没有可用的压缩命令。", color = DshColors.Muted)
        else if (compactAvailable == null) {
            Text("尚未确认压缩可用性。", color = DshColors.Muted)
            retryCommands?.let { retry -> TextButton(retry, modifier = Modifier.testTag("session_compact_retry")) { Text("重新读取") } }
        }
        Button({ compress = false; compact?.invoke() }, enabled = enabled && compactAvailable == true && !compactLoading && !running,
            modifier = Modifier.fillMaxWidth().height(48.dp).testTag("session_compact_confirm"), shape = RoundedCornerShape(12.dp)) { Text("开始压缩") }
        FilledTonalButton({ compress = false }, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(12.dp)) { Text("返回会话") }
    }
}

@Composable private fun SessionActionPage(title: String, session: String, back: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    dev.dsh.mobile.designsystem.DshDialog(back, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        BackHandler(onBack = back)
        Surface(Modifier.fillMaxSize(), color = DshColors.Background) {
            Column(Modifier.fillMaxSize().imePadding().windowInsetsPadding(WindowInsets.safeDrawing)) {
                DshTopBar(title, subtitle = session, onBack = back)
                Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp), content = content)
            }
        }
    }
}
