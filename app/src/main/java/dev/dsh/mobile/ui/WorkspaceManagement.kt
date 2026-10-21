package dev.dsh.mobile.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import dev.dsh.mobile.data.DeviceState
import dev.dsh.mobile.designsystem.DshColors
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

internal data class WorkspaceActionTarget(val deviceId: String, val workspace: Workspace, val action: String)

@Composable internal fun WorkspaceRowMenu(workspace: Workspace, state: DeviceState, choose: (String) -> Unit) {
    var expanded by remember(workspace.workspaceId) { mutableStateOf(false) }
    val pending = state.workspaceWrites.any { it.deviceId == state.selectedId && it.workspaceId == workspace.workspaceId }
    Box {
        IconButton({ expanded = true }, enabled = state.connected && !state.busy, modifier = Modifier.testTag("workspace_menu_${workspace.workspaceId}")) {
            Icon(Icons.Outlined.MoreHoriz, "工作区操作", tint = DshColors.Muted)
        }
        DropdownMenu(expanded, { expanded = false }, containerColor = DshColors.Overlay) {
            if (pending) DropdownMenuItem(text = { Text("同步操作结果") }, leadingIcon = { Icon(Icons.Outlined.Sync, null) },
                onClick = { expanded = false; choose("sync") })
            else {
                DropdownMenuItem(text = { Text("重命名") }, leadingIcon = { Icon(Icons.Outlined.Edit, null) },
                    onClick = { expanded = false; choose("rename") })
                DropdownMenuItem(text = { Text("删除工作区", color = DshColors.Red) }, leadingIcon = { Icon(Icons.Outlined.DeleteOutline, null, tint = DshColors.Red) },
                    onClick = { expanded = false; choose("delete") })
            }
        }
    }
}

@Composable internal fun WorkspaceActionDialog(target: WorkspaceActionTarget, state: DeviceState, dismiss: () -> Unit,
                                               manage: suspend (String, String, String, String?) -> Unit) {
    var title by remember(target) { mutableStateOf(target.workspace.title) }
    var error by remember(target) { mutableStateOf<String?>(null) }
    var working by remember(target) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val syncing = target.action == "sync" || error == "workspace-result-unknown"
    val duplicate = target.action == "rename" && state.snapshot?.items?.any { it.workspaceId != target.workspace.workspaceId && it.title == title.trim() } == true
    val allowed = !working && !state.busy && state.connected && state.selectedId == target.deviceId && (syncing || target.action == "delete" || (title.isNotBlank() && !duplicate))
    AlertDialog(onDismissRequest = { if (!working) dismiss() },
        title = { Text(if (syncing) "同步工作区操作" else if (target.action == "rename") "重命名工作区" else "删除工作区") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (syncing) Text("正在核对“${target.workspace.title}”的操作结果，不会重复提交。")
                else if (target.action == "rename") {
                    OutlinedTextField(title, { title = it; error = null }, enabled = !working, singleLine = true,
                        modifier = Modifier.fillMaxWidth().testTag("workspace_rename_input"))
                    Text("仅修改名称，不改变目录路径。", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                } else Text("确定删除工作区“${target.workspace.title}”？\n\n将从 App 和电脑端的工作区列表中移除，目录、文件和历史会话都会保留。")
                if (duplicate) Text("工作区名称已存在", color = DshColors.Red, style = MaterialTheme.typography.bodySmall)
                error?.let { code -> Text(when (code) {
                    "invalid-title" -> "请输入工作区名称。"
                    "workspace/name-conflict" -> "工作区名称已存在。"
                    "workspace/not-found" -> "该工作区已在电脑端移除，请刷新列表。"
                    "workspace-result-unknown", "result-unknown" -> "操作结果尚未确认，请同步结果后再继续。"
                    "device-changed" -> "设备已切换，请返回原设备操作。"
                    "connection-required", "network-unavailable" -> "连接已断开，请恢复连接后重试。"
                    "access-denied" -> "当前连接没有修改工作区的权限。"
                    "storage-unavailable" -> "无法保存操作状态，请检查本地存储。"
                    else -> "操作未完成，请同步列表后重试。"
                }, color = DshColors.Red, style = MaterialTheme.typography.bodySmall) }
            }
        },
        confirmButton = {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(dismiss, enabled = !working, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) { Text("取消") }
                Button({
                    working = true; error = null
                    scope.launch {
                        try {
                            manage(target.deviceId, target.workspace.workspaceId, if (syncing) "sync" else target.action, title.trim())
                            dismiss()
                        } catch (cancel: CancellationException) { throw cancel }
                        catch (failure: Exception) { error = (failure as? GatewayFailure)?.code ?: "result-unknown" }
                        finally { working = false }
                    }
                }, enabled = allowed, modifier = Modifier.weight(1f).testTag("workspace_confirm_action"), shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = if (target.action == "delete" && !syncing) DshColors.Red else DshColors.Ink)) {
                    Text(if (working) "处理中…" else if (syncing) "同步结果" else if (target.action == "rename") "保存" else "删除")
                }
            }
        })
}
