package dev.dsh.mobile.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.dsh.mobile.data.DiagnosticRepository
import dev.dsh.mobile.designsystem.DshColors
import kotlinx.coroutines.launch

@Composable fun DiagnosticSettings(repo: DiagnosticRepository, deviceId: String? = null) {
    val state by repo.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    val belongsToDevice = deviceId == null || state.computerId == deviceId
    val receipt = state.takeIf { belongsToDevice }
    val available = deviceId != null || repo.uploadAvailable
    HorizontalDivider(color = DshColors.Line)
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("诊断日志", style = MaterialTheme.typography.titleMedium)
        SettingsHelp("诊断日志", "默认仅本地记录，不自动上传。在当前设备设置中可上传到这台电脑，复用设备连接与鉴权，无需额外服务。电脑离线时日志保留。日志为 App 级诊断记录。向另一台电脑上传会关闭原来的自动上传。仅浏览设置不会更换上传目标。电脑日志存放在系统临时目录，可能被系统清理。")
    }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
        Text("自动上传诊断日志")
        Switch(belongsToDevice && state.automatic, { enabled -> scope.launch { if (deviceId != null) repo.automaticForComputer(deviceId, enabled) else repo.automatic(enabled) } }, Modifier.testTag("diagnostics_automatic"), enabled = available)
    }
    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Button({ scope.launch { repo.uploadAll(force = true, computerId = deviceId) } }, enabled = available && !state.uploading && state.queued > 0,
            modifier = Modifier.weight(1f).fillMaxHeight().testTag("diagnostics_upload"), shape = RoundedCornerShape(12.dp)) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(if (!available) "仅本地记录" else if (state.uploading) "正在上传…" else "上传到电脑")
                Text("本地${state.queued}条日志", fontSize = 9.sp, lineHeight = 11.sp, color = LocalContentColor.current.copy(alpha = 0.8f), modifier = Modifier.testTag("diagnostics_local_count"))
            }
        }
        OutlinedButton({ receipt?.lastArchiveKey?.let { clipboard.setText(AnnotatedString(it)) } }, enabled = receipt?.lastArchiveKey != null,
            modifier = Modifier.weight(1f).fillMaxHeight().testTag("diagnostics_copy_location"), shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, DshColors.Ink),
            colors = ButtonDefaults.outlinedButtonColors(containerColor = DshColors.Background, contentColor = DshColors.Ink)) { Text("复制日志位置") }
    }
    receipt?.error?.let { Text(it, color = DshColors.Red, style = MaterialTheme.typography.bodySmall) }
    val copyReport = { receipt?.lastReportId?.let { clipboard.setText(AnnotatedString(it)) }; Unit }
    Row(Modifier.wrapContentWidth().clickable(enabled = receipt?.lastReportId != null, onClick = copyReport).testTag("diagnostics_report_id"), verticalAlignment = Alignment.CenterVertically) {
        Text("最近上传：" + if (receipt != null && receipt.lastUploadedAt > 0) java.text.DateFormat.getDateTimeInstance().format(java.util.Date(receipt.lastUploadedAt)) else "暂无",
            Modifier.weight(1f, fill = false), style = MaterialTheme.typography.bodySmall, color = DshColors.Muted)
        IconButton(copyReport, enabled = receipt?.lastReportId != null, modifier = Modifier.size(32.dp).testTag("diagnostics_copy_report")) {
            Icon(Icons.Outlined.ContentCopy, "复制报告编号", Modifier.size(16.dp), tint = DshColors.Muted)
        }
    }
}
