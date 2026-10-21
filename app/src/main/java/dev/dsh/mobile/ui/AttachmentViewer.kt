package dev.dsh.mobile.ui

import android.content.Intent
import android.content.ClipData
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.FileDownload
import androidx.compose.foundation.Image
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider
import androidx.lifecycle.*
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.*
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import java.io.File

private fun viewerError(code: String) = when (code) {
    "attachment-not-referenced", "access-denied" -> "此附件不属于当前会话，无法读取。"
    "attachment-missing" -> "附件已清理或失效。"
    "attachment-integrity", "attachment-version-changed" -> "附件内容已变化，请重新读取。"
    "attachment-too-large" -> "附件超过支持的读取大小。"
    "device-changed" -> "设备已切换，请返回当前设备的会话。"
    "gateway/invocation-unavailable" -> "电脑尚未启用附件读取扩展。"
    else -> "附件读取失败，请检查连接后重试。"
}

@Composable fun AttachmentViewer(devices: DeviceRepository, target: AttachmentTarget, back: () -> Unit) {
    val context = LocalContext.current; val scope = rememberCoroutineScope { Dispatchers.Main.immediate }
    val device by devices.state.collectAsStateWithLifecycle(context = Dispatchers.Main.immediate)
    val downloader = remember(devices, context) { AttachmentDownloader(devices, File(context.cacheDir, "attachments")) }
    var loaded by remember(target) { mutableStateOf<DownloadedAttachment?>(null) }; var error by remember(target) { mutableStateOf<String?>(null) }
    var progress by remember(target) { mutableStateOf(0f) }; var attempt by remember(target) { mutableIntStateOf(0) }; var loading by remember(target) { mutableStateOf(true) }
    var cancelled by remember(target) { mutableStateOf(false) }; var job by remember { mutableStateOf<Job?>(null) }
    var exporting by remember(target) { mutableStateOf(false) }
    var exportNotice by remember(target) { mutableStateOf<String?>(null) }
    var exportSource by remember { mutableStateOf<DownloadedAttachment?>(null) }
    val save = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val source = exportSource; exportSource = null
        val uri = result.data?.data
        if (result.resultCode == android.app.Activity.RESULT_OK && source != null && uri != null) {
            scope.launch {
                exporting = true; exportNotice = null
                try {
                    if (devices.state.value.selectedId != target.deviceId) throw GatewayFailure("device-changed")
                    withContext(Dispatchers.IO) {
                        context.contentResolver.openOutputStream(uri, "wt")?.use { output -> source.file.inputStream().use { it.copyTo(output) } }
                            ?: error("Destination unavailable")
                    }
                    exportNotice = "文件已保存"
                } catch (cancel: CancellationException) { throw cancel }
                catch (_: Exception) { exportNotice = "保存失败，请重新选择保存位置。" }
                finally { exporting = false }
            }
        }
    }
    fun saveFile() {
        val item = loaded ?: return
        if (exporting || devices.state.value.selectedId != target.deviceId) return
        exportSource = item; exportNotice = null
        try { save.launch(Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
            .setType(item.metadata.text("mediaType").ifBlank { "application/octet-stream" })
            .putExtra(Intent.EXTRA_TITLE, item.file.name)) }
        catch (_: Exception) { exportSource = null; exportNotice = "无法打开保存位置，请稍后重试。" }
    }
    fun openFile(item: DownloadedAttachment) {
        if (devices.state.value.selectedId != target.deviceId) { error = "device-changed"; return }
        try {
            val uri = FileProvider.getUriForFile(context, context.packageName + ".attachments", item.file)
            val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, item.metadata.text("mediaType").ifBlank { "application/octet-stream" })
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION).apply { clipData = ClipData.newRawUri("attachment", uri) }
            context.startActivity(Intent.createChooser(intent, "打开附件"))
        } catch (_: Exception) { exportNotice = "无法打开附件，请选择其他系统应用。" }
    }
    LaunchedEffect(target, attempt, device.selectedId) {
        loaded = null; error = null; loading = true; cancelled = false
        if (device.selectedId != target.deviceId) { error = "device-changed"; loading = false; return@LaunchedEffect }
        job = scope.launch {
            try { loaded = downloader.download(target) { done, total -> scope.launch { progress = if (total == 0L) 1f else done.toFloat() / total } } }
            catch (cancel: CancellationException) { throw cancel }
            catch (e: Exception) { error = (e as? GatewayFailure)?.code ?: "attachment-unreadable" }
            finally { loading = false }
        }
        try { job?.join() } finally { job?.cancel() }
    }
    Column(Modifier.fillMaxSize().testTag("attachment-viewer")) {
        val media = loaded?.metadata?.text("mediaType").orEmpty()
        val subtitle = when { media.startsWith("image/") -> "图片预览"; media.startsWith("video/") -> "视频预览"; media.startsWith("text/") || target.name.endsWith(".md") -> "文件预览"; else -> "普通文件预览" }
        DshTopBar(loaded?.metadata?.text("name")?.ifBlank { "附件" } ?: target.name.ifBlank { "附件" }, subtitle = subtitle, onBack = back,
            actions = { IconButton(::saveFile, enabled = loaded != null && !exporting && device.selectedId == target.deviceId,
                modifier = Modifier.testTag("attachment-save")) { Icon(Icons.Outlined.FileDownload, "保存到手机") } })
        exportNotice?.let { Text(it, Modifier.padding(horizontal = 20.dp), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall) }
        if (exporting) LinearProgressIndicator(Modifier.fillMaxWidth())
        when {
            loading -> Column(Modifier.padding(20.dp)) { LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth()); Text("读取附件 ${(progress * 100).toInt()}%", color = DshColors.Muted); TextButton({ cancelled = true; job?.cancel() }) { Text("取消读取") } }
            cancelled -> Column(Modifier.padding(20.dp)) { Text("已取消读取", color = DshColors.Muted); TextButton({ attempt++ }) { Text("重新读取") } }
            error != null -> Column(Modifier.padding(20.dp)) { Text(viewerError(error!!), color = DshColors.Red); TextButton({ attempt++ }, enabled = device.selectedId == target.deviceId) { Text("重试") } }
            loaded != null -> {
                val item = loaded!!; val mime = item.metadata.text("mediaType"); val name = item.metadata.text("name")
                val textPreview = dshTextPreview(name, mime)
                if (mime.startsWith("image/") || mime.startsWith("video/") || textPreview) Row(Modifier.padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("${item.metadata.number("bytes")} 字节 · $mime", Modifier.weight(1f), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                    TextButton({ openFile(item) }, modifier = Modifier.testTag("attachment-system-open")) { Text("系统打开") }
                }
                when {
                    mime.startsWith("image/") -> ImagePreview(item.file, Modifier.weight(1f).fillMaxWidth())
                    mime.startsWith("video/") -> VideoPreview(item.file, Modifier.weight(1f).fillMaxWidth())
                    textPreview -> {
                        var text by remember(item.file) { mutableStateOf<String?>(null) }
                        LaunchedEffect(item.file) { withContext(Dispatchers.Main.immediate) { text = withContext(Dispatchers.IO) { item.file.inputStream().use { input -> val output = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192); while (output.size() < 1024 * 1024) { val n = input.read(buffer, 0, minOf(buffer.size, 1024 * 1024 - output.size())); if (n < 0) break; output.write(buffer, 0, n) }; output.toByteArray().toString(Charsets.UTF_8) } } } }
                        if (item.file.length() > 1024 * 1024) Text("仅预览前 1 MiB，完整内容可使用系统打开。", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                        if (text == null) CircularProgressIndicator() else if (dshFileType(name) == DshFileType.MARKDOWN || mime == "text/markdown") NativeMarkdown(text!!, Modifier.weight(1f).fillMaxWidth().testTag("attachment-markdown"))
                        else LazyColumn(Modifier.weight(1f).fillMaxWidth().testTag("attachment-code"), contentPadding = PaddingValues(16.dp)) { items(text!!.split('\n')) { line -> CodePreview(line) } }
                    }
                    else -> Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        DshFileIcon(name, Modifier.size(44.dp))
                        Text(item.metadata.text("name").ifBlank { item.file.name }, style = MaterialTheme.typography.titleLarge)
                        Text("${item.metadata.number("bytes")} 字节 · $mime\n来自当前会话", color = DshColors.Muted)
                        Button({ openFile(item) }, modifier = Modifier.fillMaxWidth().height(48.dp).testTag("attachment-system-open"), shape = RoundedCornerShape(12.dp)) { Text("系统打开") }
                        FilledTonalButton(::saveFile, enabled = !exporting && device.selectedId == target.deviceId,
                            modifier = Modifier.fillMaxWidth().height(48.dp).testTag("attachment-save-file"), shape = RoundedCornerShape(12.dp)) { Text("保存到手机") }
                        FilledTonalButton({
                            if (devices.state.value.selectedId != target.deviceId) return@FilledTonalButton
                            try {
                                val uri = FileProvider.getUriForFile(context, context.packageName + ".attachments", item.file)
                                val intent = Intent(Intent.ACTION_SEND).setType(mime.ifBlank { "application/octet-stream" })
                                    .putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                    .apply { clipData = ClipData.newRawUri("attachment", uri) }
                                context.startActivity(Intent.createChooser(intent, "分享文件"))
                            } catch (_: Exception) { exportNotice = "无法打开分享应用，请稍后重试。" }
                        }, modifier = Modifier.fillMaxWidth().height(48.dp).testTag("attachment-share"), shape = RoundedCornerShape(12.dp)) { Text("分享文件") }
                        Text("不支持内置预览的类型，使用系统应用打开。", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

@Composable internal fun ImagePreview(file: File, modifier: Modifier) {
    var bitmap by remember(file) { mutableStateOf<android.graphics.Bitmap?>(null) }
    LaunchedEffect(file) { withContext(Dispatchers.Main.immediate) { bitmap = withContext(Dispatchers.IO) {
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeFile(file.path, options)
        var sample = 1; while (options.outWidth.toLong() / sample * (options.outHeight / sample) > 8_000_000) sample *= 2
        BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
    } } }
    var scale by remember(file) { mutableStateOf(1f) }; var offset by remember(file) { mutableStateOf(Offset.Zero) }
    Box(modifier.testTag("attachment-image").semantics { stateDescription = if (bitmap == null) "loading" else "decoded; zoom=$scale" }.pointerInput(file) { detectTransformGestures { _, pan, zoom, _ -> scale = (scale * zoom).coerceIn(1f, 6f); offset = if (scale <= 1f) Offset.Zero else offset + pan } }
        .pointerInput(file) { detectTapGestures(onDoubleTap = { scale = if (scale == 1f) 2f else 1f; offset = Offset.Zero }) }, contentAlignment = Alignment.Center) {
        bitmap?.let { Image(it.asImageBitmap(), "图片附件", Modifier.fillMaxSize().graphicsLayer { scaleX = scale; scaleY = scale; translationX = offset.x; translationY = offset.y }) }
            ?: Text("图片正在读取；无法解码时可使用系统打开。", color = DshColors.Muted)
    }
}

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable internal fun VideoPreview(file: File, modifier: Modifier) {
    val context = LocalContext.current; val lifecycle = LocalLifecycleOwner.current.lifecycle
    val player = remember(file) { ExoPlayer.Builder(context).build().apply { setMediaItem(MediaItem.fromUri(Uri.fromFile(file))); prepare() } }
    var duration by remember(file) { mutableLongStateOf(0) }; var position by remember(file) { mutableLongStateOf(0) }; var playing by remember(file) { mutableStateOf(false) }; var failed by remember(file) { mutableStateOf(false) }
    var rendered by remember(file) { mutableStateOf(false) }
    DisposableEffect(player, lifecycle) {
        val listener = object : Player.Listener {
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) { failed = true }
            override fun onRenderedFirstFrame() { rendered = true }
        }
        player.addListener(listener)
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_STOP) player.pause() }
        lifecycle.addObserver(observer); onDispose { lifecycle.removeObserver(observer); player.removeListener(listener); player.release() }
    }
    LaunchedEffect(player) { withContext(Dispatchers.Main.immediate) { while (isActive) { duration = player.duration.coerceAtLeast(0); position = player.currentPosition; playing = player.isPlaying; delay(200) } } }
    Column(modifier.testTag("attachment-video").semantics { stateDescription = if (failed) "decode-failed" else if (rendered) "frame-rendered" else "loading" }) {
        AndroidView(factory = { PlayerView(it).apply { this.player = player; useController = false } }, modifier = Modifier.weight(1f).fillMaxWidth())
        if (failed) Text("视频无法解码，可尝试使用系统应用打开。", color = DshColors.Red)
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton({ if (player.isPlaying) player.pause() else player.play() }, modifier = Modifier.testTag("video-play")) { Text(if (playing) "暂停" else "播放") }
            Text("${position / 1000} / ${duration / 1000} 秒", Modifier.testTag("video-position"))
        }
        Slider(position.toFloat(), { player.seekTo(it.toLong()) }, valueRange = 0f..duration.coerceAtLeast(1).toFloat(), enabled = duration > 0, modifier = Modifier.testTag("video-seek"))
    }
}
