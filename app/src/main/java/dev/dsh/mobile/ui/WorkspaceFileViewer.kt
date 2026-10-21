package dev.dsh.mobile.ui

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.webkit.MimeTypeMap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.*
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import java.io.File

@Composable internal fun WorkspaceFileViewer(devices: DeviceRepository, target: WorkspaceFileTarget, back: () -> Unit, open: (WorkspaceFileTarget) -> Unit) {
    val context = LocalContext.current
    val device by devices.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val downloader = remember(devices) { WorkspaceFileDownloader(devices, File(context.cacheDir, "attachments")) }
    var item by remember(target) { mutableStateOf<DownloadedAttachment?>(null) }
    var text by remember(target) { mutableStateOf<String?>(null) }
    var error by remember(target) { mutableStateOf<String?>(null) }
    var notice by remember(target) { mutableStateOf<String?>(null) }
    var loading by remember(target) { mutableStateOf(true) }
    var progress by remember(target) { mutableStateOf(0f) }
    var attempt by remember(target) { mutableIntStateOf(0) }
    var exporting by remember(target) { mutableStateOf(false) }
    val name = item?.file?.name ?: target.path.replace('\\', '/').substringAfterLast('/')
    val mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substringAfterLast('.', "").lowercase()) ?: "application/octet-stream"
    val save = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        val file = item?.file
        if (uri != null && file != null) scope.launch {
            exporting = true
            try {
                if (devices.state.value.selectedId != target.deviceId) throw GatewayFailure("device-changed")
                withContext(Dispatchers.IO) { context.contentResolver.openOutputStream(uri)?.use { output -> file.inputStream().use { it.copyTo(output) } } ?: error("destination unavailable") }
                notice = "已保存到手机"
            } catch (cancel: CancellationException) { throw cancel }
            catch (_: Exception) { notice = "保存失败，请重试。" }
            finally { exporting = false }
        }
    }
    fun systemOpen() {
        val file = item?.file ?: return
        if (devices.state.value.selectedId != target.deviceId) return
        try {
            val uri = FileProvider.getUriForFile(context, context.packageName + ".attachments", file)
            val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                .apply { clipData = ClipData.newRawUri("file", uri) }
            context.startActivity(Intent.createChooser(intent, "打开文件"))
        } catch (_: Exception) { notice = "没有可打开此文件的应用，可保存到手机后查看。" }
    }
    LaunchedEffect(target, attempt, device.selectedId) {
        item = null; text = null; error = null; loading = true
        try {
            if (device.selectedId != target.deviceId) throw GatewayFailure("device-changed")
            val result = downloader.download(target) { done, total -> progress = if (total == 0L) 1f else done.toFloat() / total }
            // Decode text strictly; a binary unknown type must never be rendered as garbage.
            val type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(result.file.extension.lowercase()).orEmpty()
            if (dshTextPreview(result.file.name, type) && result.file.length() <= 1024 * 1024) {
                text = withContext(Dispatchers.IO) {
                    val bytes = result.file.readBytes()
                    if (bytes.any { it == 0.toByte() }) null else try { bytes.decodeToString(throwOnInvalidSequence = true) } catch (_: Exception) { null }
                }
            }
            item = result
        } catch (cancel: CancellationException) { throw cancel }
        catch (failure: Exception) { error = (failure as? GatewayFailure)?.code ?: "invalid-response" }
        finally { loading = false }
    }
    Column(Modifier.fillMaxSize().testTag("workspace-file-viewer")) {
        DshTopBar(name.ifBlank { "电脑文件" }, "电脑文件 · 只读预览", back)
        notice?.let { Text(it, Modifier.padding(horizontal = 20.dp), style = MaterialTheme.typography.bodySmall, color = DshColors.Muted) }
        when {
            device.selectedId != target.deviceId -> Text("设备已切换，请返回原会话。", Modifier.padding(20.dp))
            loading -> Column(Modifier.padding(20.dp)) { LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth()); Text("正在读取电脑文件…", color = DshColors.Muted) }
            error != null -> Column(Modifier.padding(20.dp)) {
                Text(when (error) {
                    "workspace-file/not-found" -> "电脑上的文件不存在，可能已移动或删除。"
                    "access-denied", "workspace-file/access-denied", "workspace-file/read-denied", "gateway/context-failed" -> "电脑未授权读取此文件。"
                    "workspace-file/not-regular-file" -> "链接指向目录或非普通文件，无法预览。"
                    "file-changed" -> "读取期间文件发生变化，请重新读取。"
                    "file-preview-limit", "workspace-file/too-large" -> "文件超过64 MiB读取限制，请在电脑端查看。"
                    "connection-required", "network-unavailable", "session-expired" -> "电脑连接已断开，请恢复连接后重试。"
                    "gateway/invocation-unavailable" -> "当前电脑版本不支持此文件读取接口。"
                    else -> "无法读取电脑文件，请检查路径、访问权限及设备连接。"
                }, color = DshColors.Red)
                TextButton({ attempt++ }, enabled = device.connected) { Text("重试") }
            }
            item != null -> {
                Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp)) {
                    TextButton({ attempt++ }, enabled = device.connected) { Text("重新读取") }
                    TextButton(::systemOpen) { Text("系统打开") }
                    TextButton({ save.launch(name) }, enabled = !exporting) { Text("保存到手机") }
                }
                if (exporting) LinearProgressIndicator(Modifier.fillMaxWidth())
                val content = text
                when {
                    mime.startsWith("image/") -> ImagePreview(item!!.file, Modifier.weight(1f).fillMaxWidth())
                    mime.startsWith("video/") -> VideoPreview(item!!.file, Modifier.weight(1f).fillMaxWidth())
                    content != null && (name.endsWith(".md", true) || name.endsWith(".markdown", true)) -> {
                        CompositionLocalProvider(LocalMarkdownFileContext provides MarkdownFileContext(target.sessionId, item!!.metadata.text("absolutePath")) { open(target.copy(path = it)) }) {
                            NativeMarkdown(content, Modifier.weight(1f).fillMaxWidth().testTag("workspace-file-markdown"))
                        }
                    }
                    content != null -> androidx.compose.foundation.lazy.LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(16.dp)) {
                        item { CodePreview(content, name.substringAfterLast('.', "")) }
                    }
                    else -> Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        DshFileIcon(name, Modifier.size(44.dp)); Text(name)
                        Text(if (item!!.file.length() > 1024 * 1024 && dshTextPreview(name, mime)) "文本超过1 MiB，可保存或用系统应用查看完整内容。" else "此格式可使用系统应用打开，或保存到手机查看。", color = DshColors.Muted)
                    }
                }
            }
        }
    }
}
