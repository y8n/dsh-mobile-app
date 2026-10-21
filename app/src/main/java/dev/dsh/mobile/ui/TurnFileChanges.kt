package dev.dsh.mobile.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.dsh.mobile.data.SessionRepository
import dev.dsh.mobile.designsystem.DshColors
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.CancellationException

/** Same Host summary and compact turn-tail structure as DSH ChangedFiles. */
@Composable fun TurnFileChanges(repo: SessionRepository, device: String, session: String, seq: Long, connected: Boolean, open: (Int) -> Unit) {
    var summary by remember(device, session, seq) { mutableStateOf<TurnChangeSummary?>(null) }
    LaunchedEffect(repo, device, session, seq, connected) {
        if (connected) try { summary = turnChangeSummary(repo.readChanges(device, session, seq)) }
        catch (cancel: CancellationException) { throw cancel }
        catch (_: Exception) { summary = null }
    }
    summary?.takeIf { it.files.isNotEmpty() }?.let { ChangedFilesCard(it, seq, open) }
}

@Composable fun ChangedFilesCard(summary: TurnChangeSummary, seq: Long, open: (Int) -> Unit) {
    var expanded by remember(seq) { mutableStateOf(false) }
    val single = if (summary.total == 1L) summary.files.singleOrNull() else null
    Surface(Modifier.fillMaxWidth().padding(top = 4.dp).testTag("changed_files_$seq"), shape = RoundedCornerShape(14.dp), color = DshColors.Background, border = BorderStroke(0.5.dp, DshColors.Line)) {
        Column {
            Row(Modifier.fillMaxWidth().height(60.dp).background(DshColors.Soft).clickable { open(0) }.padding(horizontal = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Surface(Modifier.size(40.dp), shape = RoundedCornerShape(10.dp), color = DshColors.Background) {
                    Box(contentAlignment = Alignment.Center) {
                        DshFileIcon(single?.path.orEmpty(), Modifier.size(20.dp), kind = if (single == null) DshFileType.CODE else null)
                    }
                }
                Column(Modifier.padding(start = 10.dp).weight(1f)) {
                    Text(if (single != null) "已编辑 ${dshFileBasename(single.path)}" else "已编辑 ${summary.total} 个文件", fontSize = 13.sp, lineHeight = 20.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    ChangeCounts(summary.added, summary.deleted, single?.binary == true, single?.oversized == true)
                }
            }
            if (single == null) {
                summary.files.take(if (expanded) summary.files.size else 4).forEachIndexed { index, file ->
                    Row(Modifier.fillMaxWidth().clickable { open(index) }.padding(horizontal = 14.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(file.display, Modifier.weight(1f).padding(end = 8.dp), fontSize = 12.sp, lineHeight = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        ChangeCounts(file.added, file.deleted, file.binary, file.oversized)
                    }
                }
                if (summary.files.size > 4) TextButton({ expanded = !expanded }, Modifier.align(Alignment.CenterHorizontally).testTag("changed_files_expand_$seq")) {
                    Text(if (expanded) "收起" else "显示全部 ${summary.files.size} 个文件")
                }
            }
        }
    }
}

@Composable private fun ChangeCounts(added: Long, deleted: Long, binary: Boolean, oversized: Boolean) {
    if (binary || oversized) Text(if (binary) "二进制文件" else "文件过大", fontSize = 10.sp, lineHeight = 16.sp, color = DshColors.Muted)
    else Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("+$added", color = DshColors.Green, fontFamily = FontFamily.Monospace, fontSize = 10.sp, lineHeight = 16.sp)
        Text("−$deleted", color = DshColors.Red, fontFamily = FontFamily.Monospace, fontSize = 10.sp, lineHeight = 16.sp)
    }
}
