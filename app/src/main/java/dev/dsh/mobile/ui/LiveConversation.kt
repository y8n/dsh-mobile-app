package dev.dsh.mobile.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import android.provider.OpenableColumns
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.*
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.*

@Composable
fun LiveConversation(sessionId: String, repo: SessionRepository, workspace: String?, back: () -> Unit,
                     readOnly: Boolean = false, automation: (() -> Unit)? = null, attachment: ((AttachmentTarget) -> Unit)? = null, changes: ((String, String, Long, Int) -> Unit)? = null, menu: @Composable (() -> Unit) -> Unit = {},
                     deviceName: String? = null, reconnect: (() -> Unit)? = null, connectionSettings: (() -> Unit)? = null,
                     menuHeight: androidx.compose.ui.unit.Dp = 0.dp, initialTitle: String? = null, attachmentLoader: (suspend (AttachmentTarget) -> DownloadedAttachment)? = null) {
    val state by repo.state.collectAsStateWithLifecycle(context = Dispatchers.Main.immediate)
    val interactions by repo.interactions.state.collectAsStateWithLifecycle(context = Dispatchers.Main.immediate)
    val scope = rememberCoroutineScope { Dispatchers.Main.immediate }
    val context = LocalContext.current
    val keyboard = LocalSoftwareKeyboardController.current
    var releasePending by remember(sessionId, state.deviceId) { mutableStateOf<String?>(null) }
    val list = rememberLazyListState()
    var positionedOnEntry by remember(sessionId, state.deviceId) { mutableStateOf(false) }
    var followLatest by remember(sessionId, state.deviceId) { mutableStateOf(true) }
    var positioningLatest by remember(sessionId, state.deviceId) { mutableStateOf(false) }
    suspend fun scrollToLatest() {
        positioningLatest = true
        try {
            // Wait for the item provider to be measured; out-of-range indices discard the offset.
            withFrameNanos { }
            list.scrollToItem((list.layoutInfo.totalItemsCount - 1).coerceAtLeast(0), Int.MAX_VALUE)
        } finally { positioningLatest = false }
    }
    val messages = remember(state.timeline.events) { state.timeline.messages }
    val transcript = remember(state.timeline.events) { sessionTranscript(state.timeline) }
    var expandedGroups by androidx.compose.runtime.saveable.rememberSaveable(sessionId, state.deviceId) { mutableStateOf(emptyList<String>()) }
    var expandedProcesses by androidx.compose.runtime.saveable.rememberSaveable(sessionId, state.deviceId) { mutableStateOf(emptyList<Long>()) }
    val displayedTarget = state.deviceId to state.sessionId
    val continuedQuestions = ((state.projections["userQuestions"] as? JsonObject)?.get("active") as? JsonArray).orEmpty().filter { it.jsonObject.text("state") == "continued" }
    val awaitingInteraction = interactions.pending.isNotEmpty() || continuedQuestions.isNotEmpty()
    var attachmentError by remember(sessionId, state.deviceId) { mutableStateOf<String?>(null) }
    var attachmentReading by remember(sessionId, state.deviceId) { mutableStateOf(false) }
    var createGoalRequest by remember(sessionId, state.deviceId) { mutableIntStateOf(0) }
    var showModels by remember(sessionId) { mutableStateOf(false) }
    var pickerTarget by remember { mutableStateOf<Pair<String?, String?>?>(null) }
    fun readAttachment(uri: android.net.Uri, target: Pair<String?, String?>) {
        if (attachmentReading || state.uploading) return
        attachmentReading = true
        scope.launch {
            try {
                val retained = repo.state.value.localAttachment?.takeIf { it.uri == uri.toString() } ?: LocalAttachmentDraft(uri.toString())
                repo.retainAttachment(retained, target.first, target.second)
                val mediaType = context.contentResolver.getType(uri)?.substringBefore(';')?.lowercase().orEmpty()
                val image = mediaType.startsWith("image/")
                val maxBytes = if (image) (repo.state.value.projections["imageLimits"] as? JsonObject)?.number("maxImageBytes")
                    ?: throw GatewayFailure("image-limits-unavailable") else Long.MAX_VALUE
                val (name, length) = withContext(Dispatchers.IO) {
                    var name = "attachment"
                    var length = -1L
                    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
                        if (c.moveToFirst()) {
                            name = c.getString(0).orEmpty().ifBlank { "attachment" }
                            if (!c.isNull(1)) length = c.getLong(1)
                            if (image && length > maxBytes) throw GatewayFailure("attachment-size")
                        }
                    }
                    name to length
                }
                repo.retainAttachment(LocalAttachmentDraft(uri.toString(), name, mediaType), target.first, target.second)
                if (image) {
                    val bytes = withContext(Dispatchers.IO) {
                        context.contentResolver.openInputStream(uri)?.use { input ->
                            val out = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192)
                            while (true) { val n = input.read(buffer); if (n < 0) break; if (out.size().toLong() + n > maxBytes) throw GatewayFailure("attachment-size"); out.write(buffer, 0, n) }
                            out.toByteArray()
                        } ?: throw GatewayFailure("attachment-read")
                    }
                    repo.attachImage(name, mediaType, bytes, target.first, target.second)
                } else repo.attachStream(name, length, {
                    context.contentResolver.openInputStream(uri) ?: throw java.io.IOException("attachment-read")
                }, target.first, target.second)
                if (repo.state.value.let { it.deviceId to it.sessionId } == target) attachmentError = null
            } catch (cancel: CancellationException) { throw cancel }
            catch (error: Exception) { if (repo.state.value.let { it.deviceId to it.sessionId } == target) attachmentError = when ((error as? GatewayFailure)?.code) {
                "image-type" -> "电脑不支持此图片格式，请选择 PNG、JPEG、WebP 或 GIF。"
                "image-invalid" -> "图片无法读取，或格式与内容不一致。"
                "image-dimensions" -> "图片尺寸超过电脑允许的限制。"
                "attachment-size" -> "附件超过允许的大小限制：图片受电脑图片配置限制，普通文件受电脑或隧道上传限制。"
                "attachment-read" -> "附件已无法读取，请重新选择附件。"
                "device-changed" -> "会话已切换，请在当前会话重新选择附件。"
                "result-unknown" -> "上传结果尚未确认，文件可能已保存到电脑。再次上传可能产生重复文件。"
                else -> "附件读取或上传失败，请重试。"
            } }
            finally { attachmentReading = false }
        }
    }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            try { context.contentResolver.takePersistableUriPermission(uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (_: SecurityException) { }
            pickerTarget?.let { readAttachment(uri, it) }
        }
    }
    DisposableEffect(repo, sessionId) { val owner = repo.acquireView(sessionId); onDispose { repo.releaseView(owner) } }
    LaunchedEffect(state.connected, sessionId) { withContext(Dispatchers.Main.immediate) { if (state.connected) {
        launch { repo.loadPermissions() }; launch { repo.loadCommands() }
    } } }
    LaunchedEffect(sessionId, state.deviceId, state.initialLoaded, state.loading, messages.size, transcript.size) {
        if (!positionedOnEntry && state.sessionId == sessionId && state.initialLoaded && !state.loading) {
            withContext(Dispatchers.Main.immediate) {
                snapshotFlow { list.layoutInfo.totalItemsCount }.first { it > 0 }
                scrollToLatest()
                positionedOnEntry = true
                followLatest = true
            }
        }
    }
    val branchLifecycle = androidx.lifecycle.compose.LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(state.deviceId, sessionId, state.workspacePath, state.connected, branchLifecycle) {
        if (state.connected && state.sessionId == sessionId && state.workspacePath != null) branchLifecycle.repeatOnLifecycle(androidx.lifecycle.Lifecycle.State.STARTED) {
            while (true) { repo.loadGitBranch(); delay(30_000) }
        }
    }
    val goal = (state.projections["goal"] as? JsonObject)?.get("goal") as? JsonObject
    LaunchedEffect(state.deviceId, sessionId, goal?.get("id"), goal?.get("revision"), state.connected) {
        if (goal != null && state.connected && state.sessionId == sessionId) {
            if (goal.text("phase") != "complete") while (true) { repo.loadGoalActivation(); kotlinx.coroutines.delay(5_000) }
        }
    }
    val nearBottom by remember { derivedStateOf { !list.canScrollForward } }
    // New rows change the visible-item distance before this effect runs. Only a
    // user's scroll changes their decision to follow the newest output.
    LaunchedEffect(list) {
        withContext(Dispatchers.Main.immediate) { snapshotFlow { if (list.isScrollInProgress && !positioningLatest) nearBottom else null }.filterNotNull().collect { followLatest = it } }
    }
    LaunchedEffect(messages.lastOrNull()?.seq, state.timeline.nextChunk, state.timeline.liveText) {
        withContext(Dispatchers.Main.immediate) {
        if (followLatest && interactions.pending.isEmpty() && continuedQuestions.isEmpty() && list.layoutInfo.totalItemsCount > 0) {
            scrollToLatest()
            followLatest = true
        }
        }
    }
    // History, Markdown and file cards can finish measuring after the data effect.
    // Keep the tail pinned across those layout passes until the user scrolls away.
    LaunchedEffect(list, positionedOnEntry, awaitingInteraction) {
        if (positionedOnEntry && !awaitingInteraction) snapshotFlow {
            val layout = list.layoutInfo
            Triple(layout.totalItemsCount, layout.viewportEndOffset,
                layout.visibleItemsInfo.lastOrNull()?.let { it.index to it.size })
        }.collect {
            if (followLatest && !list.isScrollInProgress && list.canScrollForward) scrollToLatest()
        }
    }
    LaunchedEffect(interactions.pending.keys.toList(), continuedQuestions.map { it.jsonObject.text("callId") }) {
        withContext(Dispatchers.Main.immediate) { if (positionedOnEntry && (interactions.pending.isNotEmpty() || continuedQuestions.isNotEmpty())) list.scrollToItem(0) }
    }
    if (repo.isViewActive() && state.sessionId == sessionId && !state.connected && !state.loading && !state.initialLoaded) {
        ConnectionLostScreen(deviceName, back, reconnect ?: repo::retry, connectionSettings ?: back, state.connectionError)
        return
    }
    Column(Modifier.fillMaxSize()) {
        val title = (state.projections["title"] as? kotlinx.serialization.json.JsonPrimitive)?.contentOrNull.takeIf { state.sessionId == sessionId }.orEmpty().ifBlank { initialTitle ?: "新会话" }
        val pageTitle = if (!awaitingInteraction) title else if (interactions.pending.values.firstOrNull()?.event == "approval/request") "需要你的批准" else "需要你回答"
        DshTopBar(pageTitle, workspace, back, subtitleContent = { ConversationWorkspaceSubtitle(workspace, state.gitBranch.takeIf { state.sessionId == sessionId }) }, actions = {
            if (automation != null) IconButton(automation, modifier = Modifier.testTag("session_automation")) { Icon(Icons.Outlined.Alarm, "定时任务") }
            menu { createGoalRequest++ }
        })
        if (menuHeight > 0.dp) Spacer(Modifier.height(menuHeight))
        if (state.projectionRefreshFailed) Row(Modifier.padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("状态同步失败，请刷新状态。", Modifier.weight(1f), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
            TextButton(repo::retry) { Text("刷新状态") }
        }
        state.commandMessage?.let { Text(it, Modifier.padding(horizontal = 20.dp), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall) }
        if (readOnly) Text("已归档；恢复后可继续发送。", Modifier.padding(horizontal = 20.dp), color = DshColors.Muted)
        state.localAttachment?.let { local ->
            val canRetry = !readOnly && state.connected && !state.sending && state.pendingRequestId == null && !attachmentReading && !state.uploading
            val failed = state.error != null || attachmentError != null
            Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(Modifier.fillMaxWidth().heightIn(min = 80.dp).testTag("attachment-upload-draft")
                    .clickable(enabled = canRetry) { readAttachment(android.net.Uri.parse(local.uri), state.deviceId to state.sessionId) }, verticalAlignment = Alignment.CenterVertically) {
                    val image = local.mediaType.startsWith("image/")
                    Box(Modifier.size(72.dp).then(if (image) Modifier.background(DshColors.Tint, RoundedCornerShape(12.dp)) else Modifier), contentAlignment = Alignment.Center) {
                        Icon(if (image) Icons.Outlined.Image else Icons.Outlined.Description, null, Modifier.size(32.dp), tint = if (image) DshColors.Blue else DshColors.Muted)
                    }
                    Column(Modifier.padding(start = 12.dp).weight(1f)) {
                        Text(local.name, style = MaterialTheme.typography.titleMedium)
                        Text(if (attachmentReading) "正在读取附件…" else if (state.uploading) "正在上传附件…" else if (local.uploadResultUnknown || state.error == "result-unknown") "上传结果待确认" else if (failed) "上传失败 · 点击重试" else "附件草稿 · 尚未上传",
                            color = if (failed && canRetry) DshColors.Red else DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                    }
                }
                if (!attachmentReading && !state.uploading) {
                    (attachmentError ?: if (local.uploadResultUnknown || state.error == "result-unknown") "上传结果尚未确认，文件可能已保存到电脑。再次上传可能产生重复文件。" else null)?.let { Text(it, color = DshColors.Red, style = MaterialTheme.typography.bodySmall) }
                    FilledTonalButton({ readAttachment(android.net.Uri.parse(local.uri), state.deviceId to state.sessionId) },
                        enabled = canRetry, shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth().height(48.dp).testTag("attachment-upload-retry")) { Text(if (local.uploadResultUnknown || state.error == "result-unknown") "再次上传" else "重试上传") }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("文字和附件草稿会保留。", Modifier.weight(1f), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                        TextButton({ repo.removeAttachment(); attachmentError = null }, modifier = Modifier.testTag("attachment-upload-remove")) { Text("移除附件") }
                    }
                }
            }
        }
        if ((state.error != null || attachmentError != null) && state.localAttachment == null) {
            Text(attachmentError ?: when (state.error) {
                "compact-pending" -> "压缩操作仍在核对中，请勿重复提交。"
                "result-unknown" -> if (state.pendingCompactAfter != null) "压缩结果待确认，正在同步压缩记录，请勿重复提交。" else "发送结果待确认，正在通过真实会话核对，请勿重复发送。"
                "image-model-unsupported" -> "当前模型不支持图片。请选择支持图片的模型，或移除图片后发送。"
                "goal-stale" -> "目标已在电脑端更新，请重新打开编辑后再提交。"
                "connection-required", "network-unavailable", "stream-ended", "stream-timeout" -> "操作未完成，连接正在恢复；同步后再操作。"
                "access-denied" -> "当前设备没有执行此操作的权限。"
                "rate-limited" -> "操作过于频繁，请稍后再试。"
                else -> "操作未完成，请同步会话后核对电脑端状态。"
            },
                Modifier.padding(horizontal = 20.dp, vertical = 8.dp), color = DshColors.Red, style = MaterialTheme.typography.bodySmall)
            TextButton(repo::retry) { Text("同步会话") }
        }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            LazyColumn(state = list, modifier = Modifier.fillMaxSize().testTag("live_messages"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!awaitingInteraction) interactions.status?.let { status -> item { Text(status, color = DshColors.Muted, style = MaterialTheme.typography.bodySmall) } }
                if (interactions.error != null) item { Text("请求连接或响应失败，正在恢复；请等待同步后重试。", color = DshColors.Red, style = MaterialTheme.typography.bodySmall) }
                items(interactions.pending.values.toList(), key = { "interaction_${it.id}" }) { request ->
                    val enabled = !readOnly && state.connected && interactions.clientId != null
                    if (request.event == "approval/request") {
                        val details = state.timeline.events.values.firstOrNull { event -> event.text("type") == "tool/call" && (event["data"] as? JsonObject)?.text("callId") == request.request.text("callId") }
                            ?.get("data")?.jsonObject?.text("arguments")
                        ApprovalInteraction(request, enabled, details) { value -> scope.launch { try { repo.interactions.answer(request.id, value) } catch (_: Exception) { } } }
                    }
                    else QuestionInteraction(request.id, request.request.getValue("questions").jsonArray, enabled, request.sending) { value -> scope.launch { try { repo.interactions.answer(request.id, value) } catch (_: Exception) { } } }
                }
                items(continuedQuestions, key = { "continued_${it.jsonObject.text("callId")}" }) { row ->
                    val question = row.jsonObject; val callId = question.text("callId")
                    QuestionInteraction(callId, question.getValue("questions").jsonArray, !readOnly && state.connected && !state.controlsBusy,
                        callId in state.submittedQuestions) { value -> scope.launch { try { repo.answerContinuedQuestion(callId, value) } catch (_: Exception) { } } }
                }
                if (!awaitingInteraction) {
                if (state.timeline.hasMore) item {
                    Box(Modifier.fillMaxWidth().padding(vertical = 4.dp), contentAlignment = Alignment.Center) {
                        TextButton({ scope.launch { repo.loadEarlier() } }, enabled = !state.paging,
                            modifier = Modifier.testTag("load-earlier-messages"), shape = androidx.compose.foundation.shape.RoundedCornerShape(20.dp),
                            colors = ButtonDefaults.textButtonColors(containerColor = DshColors.Soft, contentColor = DshColors.Muted, disabledContainerColor = DshColors.Soft),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp)) {
                            Text(if (state.paging) "正在加载…" else "加载更早的消息", fontSize = 12.sp)
                        }
                    }
                }

                if (!state.loading && messages.isEmpty() && state.localAttachment == null && state.attachmentName == null) item {
                    Text("从一个任务开始", Modifier.testTag("live_empty_session"), style = MaterialTheme.typography.headlineSmall, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
                    Text("描述你想完成的工作。执行将在电脑上进行。", Modifier.padding(top = 16.dp), color = DshColors.Muted, style = MaterialTheme.typography.bodyMedium)
                }
                items(transcript.filter { entry ->
                    val processVisible = entry.owner == null || entry.owner in expandedProcesses || transcript.firstOrNull { it.process?.id == entry.owner }?.process?.foldable == false
                    processVisible && (entry.groupOwner == null || entry.groupOwner in expandedGroups)
                }, key = { it.key }) { entry ->
                    entry.group?.let { group -> ProcessGroupDisclosure(group, group.id in expandedGroups) { expandedGroups = if (group.id in expandedGroups) expandedGroups - group.id else expandedGroups + group.id } }
                    entry.process?.let { process ->
                        ProcessDisclosure(process, process.id in expandedProcesses) {
                            if (process.id in expandedProcesses) {
                                expandedGroups = expandedGroups - transcript.filter { it.owner == process.id }.mapNotNull { it.group?.id }.toSet()
                                expandedProcesses = expandedProcesses - process.id
                            } else expandedProcesses = expandedProcesses + process.id
                        }
                    }
                    entry.message?.let { row ->
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            TranscriptMessage(row, displayedTarget.first, displayedTarget.second, attachment, copyEnabled = false, loader = attachmentLoader)
                            if (entry.finalReply && changes != null && displayedTarget.first != null && displayedTarget.second != null) {
                                val seq = closingChangesSequence(state.timeline, row.seq)
                                if (seq != null) TurnFileChanges(repo, displayedTarget.first!!, displayedTarget.second!!, seq, state.connected) { index ->
                                    changes(displayedTarget.first!!, displayedTarget.second!!, seq, index)
                                }
                            }
                            if (entry.finalReply) ReplyCopyAction(row)
                        }
                    }
                }
                if (state.timeline.liveParts.isNotEmpty()) item { TranscriptMessage(MessageRow(Long.MIN_VALUE, "assistant", state.timeline.liveText, state.timeline.liveParts), displayedTarget.first, displayedTarget.second, attachment, copyEnabled = false, loader = attachmentLoader) }
                else if (state.running) item { Text("正在思考…", color = DshColors.Muted) }
                state.pendingRequestId?.let { pending -> item {
                    Column(Modifier.fillMaxWidth().testTag("pending_prompt_recovery")) {
                        Text("待确认：${state.pendingText.orEmpty()}", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                        Text("上一条消息的发送结果尚未确认，暂时无法发送新消息。", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                        Row {
                            TextButton(repo::retry, enabled = !state.sending) { Text("核对发送结果") }
                            TextButton({ releasePending = pending }, enabled = !state.sending) { Text("解除待确认") }
                        }
                    }
                } }
                }
            }
            if (state.loading) CircularProgressIndicator(Modifier.align(Alignment.Center).testTag("conversation_initial_loading"))
            if (!nearBottom) SmallFloatingActionButton({ scope.launch { scrollToLatest(); followLatest = true } },
                Modifier.align(Alignment.BottomEnd).padding(16.dp), containerColor = DshColors.Soft) { Icon(Icons.Outlined.ArrowDownward, "回到最新") }
        }
        if (!state.connected && !state.loading) Row(Modifier.padding(horizontal = 20.dp).testTag("conversation_reconnecting"), verticalAlignment = Alignment.CenterVertically) {
            Text("连接正在恢复，已加载的内容和草稿会保留。", Modifier.weight(1f), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
            TextButton(reconnect ?: repo::retry) { Text("重新连接") }
        }
        if (state.permissionError != null) Row(Modifier.padding(horizontal = 20.dp).testTag("permission_catalog_error"), verticalAlignment = Alignment.CenterVertically) {
            Text("权限选项暂未同步，不影响查看消息。", Modifier.weight(1f), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
            TextButton({ scope.launch { repo.loadPermissions() } }, enabled = state.connected) { Text("重试同步") }
        }
        if (state.uploading || state.sending || state.stopping || state.modelChanging) LinearProgressIndicator(Modifier.fillMaxWidth())
        if (!awaitingInteraction) GoalControls(state, readOnly, createRequest = createGoalRequest, showCreateEntry = false) { action, objective, ref -> scope.launch { try { repo.goal(action, objective, ref) } catch (_: Exception) { } } }
        // Disable submission while admission is unresolved; typing remains available as a local draft.
        CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides DshColors.Ink) {
            MessageComposer(state.draft, { text ->
                // The editor can deliver a final IME callback as the connection
                // page removes it. A departed editor must not overwrite the
                // retained draft, including after selection changes.
                val current = repo.state.value
                if (repo.isViewActive() && (current.connected || current.loading || current.initialLoaded) &&
                    current.deviceId == state.deviceId && current.sessionId == sessionId)
                    repo.setDraft(text)
            }, state.running, state.model?.text("model")?.ifBlank { "模型" } ?: "模型",
                state.permissionOptions.map { option -> option.jsonObject.let { PermissionOption(it.text("value"), permissionLabel(it.text("value"), it.text("name")), permissionDescription(it.text("value"), it.text("description"))) } },
                (state.projections["permissions"] as? JsonObject)?.text("currentValue").orEmpty(),
                { value -> scope.launch { try { repo.selectPermission(value) } catch (_: Exception) { } } }, { showModels = true; scope.launch { try { repo.loadModels() } catch (_: Exception) { } } },
                { if (!state.uploading && !attachmentReading) { pickerTarget = state.deviceId to state.sessionId; picker.launch(arrayOf("*/*")) } },
                { if (state.connected && !state.sending && state.pendingRequestId == null && !state.uploading) scope.launch { try { keyboard?.hide(); repo.send() } catch (_: Exception) { } } },
                { if (!state.stopping) scope.launch { try { repo.stop() } catch (_: Exception) { } } },
                state.attachmentName, repo::removeAttachment, Modifier.padding(start = 16.dp, end = 16.dp, bottom = 0.dp),
                submissionEnabled = !readOnly && state.connected && !state.sending && !state.stopping && !state.uploading && !attachmentReading && state.localAttachment == null && !state.modelChanging && state.pendingRequestId == null,
                controlsEnabled = !readOnly && state.connected && !state.controlsBusy && state.permissionOptions.isNotEmpty(), attachmentEnabled = !readOnly && state.connected && !state.uploading && !attachmentReading && !state.sending,
                modelEnabled = !readOnly && state.connected && !state.modelChanging && !state.sending && state.pendingRequestId == null)
        }
        ConversationStats(state)
    }
    releasePending?.let { pending ->
        AlertDialog(onDismissRequest = { releasePending = null }, title = { Text("解除待确认？") },
            text = { Text("原消息可能已经到达电脑。解除后会保留当前草稿并恢复发送，但不会撤回或自动重发原消息。再次发送前请先核对会话，避免重复。") },
            confirmButton = { TextButton({ releasePending = null; scope.launch { try { repo.releasePendingPrompt(pending) } catch (_: Exception) { } } }) { Text("保留草稿并解除") } },
            dismissButton = { TextButton({ releasePending = null }) { Text("取消") } })
    }
    if (showModels) {
        val groups = (state.modelCatalog?.get("groups") as? JsonArray).orEmpty().map { row ->
            val provider = row.jsonObject
            ProviderModels(provider.text("name"), provider.getValue("models").jsonArray.map { entry ->
                val model = entry.jsonObject; val providerId = provider.text("id"); val modelId = model.text("id")
                ModelOption("$providerId:$modelId", model.text("name"), providerId, modelId,
                    (model["reasoning"] as? JsonObject)?.text("defaultEffort")?.takeIf { it.isNotBlank() })
            })
        }
        if (state.modelCatalog == null) AlertDialog(onDismissRequest = { showModels = false }, title = { Text("选择模型") },
            text = { if (state.modelsLoading) CircularProgressIndicator() else Text("模型列表读取失败，请重试。") }, confirmButton = { TextButton({ showModels = false }) { Text("关闭") } })
        else ModelPicker("选择下次模型 · 同时更新电脑默认模型", groups, "${state.model?.text("provider")}:${state.model?.text("model")}",
            onSelect = { option -> showModels = false; scope.launch { try { repo.selectModel(option.providerId!!, option.modelId, option.reasoningEffort) } catch (_: Exception) { } } },
            onDismiss = { showModels = false },
            lastUsed = state.lastUsedModel?.let { used -> "${used.text("provider")} / ${used.text("model")}" } ?: "暂无记录")
    }
}
