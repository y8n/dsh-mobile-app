package dev.dsh.mobile.data

import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.*
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong

/** A session is always addressed together with the credential slot that owns it. */
data class ConversationState(
    val deviceId: String? = null, val sessionId: String? = null, val timeline: Timeline = Timeline(),
    val workspacePath: String? = null, val gitBranch: String? = null,
    val initialLoaded: Boolean = false, val connectionError: String? = null, val permissionError: String? = null,
    val connected: Boolean = false, val loading: Boolean = false, val sending: Boolean = false,
    val stopping: Boolean = false, val paging: Boolean = false, val uploading: Boolean = false,
    val draft: String = "", val pendingRequestId: String? = null, val pendingText: String? = null,
    val draftRevision: Long = 0, val pendingDraftRevision: Long? = null,
    val error: String? = null, val attachmentName: String? = null, val attachmentPart: JsonObject? = null, val localAttachment: LocalAttachmentDraft? = null,
    val projections: JsonObject = JsonObject(emptyMap()), val projectionSeq: Long = -1,
    val projectionState: SessionProjections = SessionProjections(),
    val modelCatalog: JsonObject? = null, val modelsLoading: Boolean = false, val modelChanging: Boolean = false,
    val pendingCompactAfter: Long? = null, val goalActivation: JsonObject? = null, val compactAvailable: Boolean? = null, val commandsLoading: Boolean = false, val commandsError: String? = null,
    val permissionOptions: JsonArray = JsonArray(emptyList()), val controlsBusy: Boolean = false, val commandMessage: String? = null,
    val submittedQuestions: Set<String> = emptySet(), val projectionRefreshFailed: Boolean = false,
) {
    val running get() = (projections["agentStatus"] as? JsonPrimitive)?.content == "running" || timeline.running || timeline.attemptId != null
    val model: JsonObject? get() = ((projections["modelSelection"] as? JsonObject)?.get("next") as? JsonObject) ?: (modelCatalog?.get("default") as? JsonObject)
    val lastUsedModel: JsonObject? get() = (projections["modelSelection"] as? JsonObject)?.get("lastUsed") as? JsonObject
}
class SessionRepository(private val devices: DeviceRepository, private val storage: DeviceStore) {
    val interactions = SessionInteractions(devices) { event -> refreshCatalog(event) }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mutable = MutableStateFlow(ConversationState())
    val state = mutable.asStateFlow()
    private val generation = AtomicLong()
    private val viewOwner = AtomicLong()
    private val completedGoalAttempts = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()
    private val writes = Mutex()
    private val pages = Mutex()
    private val projectionReads = Mutex()
    private var projectionReadback: Job? = null
    private suspend fun <T> writeForCurrentTarget(requireConnection: Boolean = true, block: suspend () -> T): T {
        val epoch = generation.get()
        val target = mutable.value.let { it.deviceId to it.sessionId }
        return writes.withLock {
            if (generation.get() != epoch || mutable.value.let { it.deviceId to it.sessionId } != target) throw GatewayFailure("device-changed")
            if (requireConnection && (!devices.state.value.connected || !mutable.value.connected)) throw GatewayFailure("connection-required")
            block()
        }
    }
    private var initialDeadline: Job? = null
    private var trace = UUID.randomUUID().toString()
    private var subscription: Job? = null
    private var controls: Job? = null
    private var draftSave: Job? = null
    private var gapFill: Job? = null
    private var promptLookup: Job? = null
    private var lookupAttempt: Pair<Long, String>? = null
    @Synchronized private fun resetPromptLookup() { promptLookup?.cancel(); promptLookup = null; lookupAttempt = null }
    private var viewActive = false
    private fun refreshCatalog(event: String) { scope.launch {
        try { when (event) { "permission-presets/catalog-changed" -> loadPermissions(); "commands/change" -> loadCommands(); else -> loadModels() } }
        catch (cancel: CancellationException) { throw cancel }
        catch (_: Exception) { /* Read failure is reflected by the catalog owner; no write is repeated. */ }
    } }
    private fun update(epoch: Long, change: (ConversationState) -> ConversationState) {
        mutable.update { if (generation.get() == epoch) change(it) else it }
    }
    init { scope.launch {
        devices.state.map { it.selectedId to it.connected }.distinctUntilChanged().collect { synchronizeDevice() }
    } }
    @Synchronized private fun synchronizeDevice() {
        // An emission may have waited behind work on the IO dispatcher. Re-read
        // the current selection while serialized against opening a new session.
        val parent = devices.state.value
        if (mutable.value.deviceId != null && parent.selectedId != mutable.value.deviceId) { closeSession(); return }
        if (!viewActive || mutable.value.sessionId == null) return
        if (!parent.connected) {
            // An initial draft restore must finish before a transport change
            // can replace its generation. It performs no remote mutation.
            if (mutable.value.connected || (!mutable.value.loading && (subscription?.isActive == true || controls?.isActive == true))) pause()
        } else if (!mutable.value.connected && (subscription?.isActive != true || !mutable.value.loading)) resume()
    }
    @Synchronized fun open(id: String) {
        viewActive = true
        val (device, _) = devices.selectedConnection() ?: return
        if (devices.state.value.connected && mutable.value.deviceId == device && mutable.value.sessionId == id && subscription?.isActive == true) return
        val epoch = generation.incrementAndGet(); subscription?.cancel(); controls?.cancel(); draftSave?.cancel(); gapFill?.cancel(); projectionReadback?.cancel(); initialDeadline?.cancel()
        resetPromptLookup()
        val sameTarget = mutable.value.deviceId == device && mutable.value.sessionId == id
        completedGoalAttempts.clear()
        trace = UUID.randomUUID().toString()
        Diagnostics.emit("session.open", trace, "session")
        mutable.value = if (sameTarget) mutable.value.copy(connected = false, loading = mutable.value.loading && !mutable.value.initialLoaded, sending = false, stopping = false, paging = false, uploading = false, modelsLoading = false, modelChanging = false, controlsBusy = false, commandsLoading = false, compactAvailable = null, commandsError = null)
            else ConversationState(deviceId = device, sessionId = id, loading = true)
        initialDeadline = scope.launch {
            delay(20_000)
            update(epoch) { if (!it.connected && it.loading) {
                Diagnostics.emit("session.initial-timeout", trace, "session", code = "initial-timeout")
                it.copy(loading = false, connectionError = "initial-timeout")
            } else it }
        }
        interactions.open(device, id)
        subscription = scope.launch {
            try {
                val saved = if (sameTarget) null else storage.read().drafts.find { it.deviceId == device && it.sessionId == id }
                if (!sameTarget) update(epoch) { it.copy(draft = saved?.text.orEmpty(), pendingRequestId = saved?.pendingRequestId, pendingText = saved?.pendingText, draftRevision = saved?.draftRevision ?: 0, pendingDraftRevision = saved?.pendingDraftRevision, localAttachment = saved?.localAttachment) }
            } catch (error: GatewayFailure) { update(epoch) { it.copy(error = error.code) } }
            follow(epoch, device, id)
        }
        controls = scope.launch {
            var retry = 0
            while (isActive && generation.get() == epoch) {
                try {
                    gateway(device).follow("session/control", JsonObject(emptyMap())).collect { frame ->
                        if (generation.get() != epoch) return@collect
                        when (frame.text("type")) {
                            "baseline" -> {
                                val projection = ((frame["value"] as? JsonObject)?.get("projections") as? JsonObject)?.get(id) as? JsonObject
                                if (projection != null) updateProjection(epoch, projection.getValue("values").jsonObject, projection.number("asOfSeq"))
                            }
                            "projection" -> if (frame.text("sessionId") == id) {
                                val seq = frame.number("seq")
                                update(epoch) {
                                    val merged = it.projectionState.apply(frame.string("key"), frame.getValue("value"), seq)
                                    it.copy(projections = merged.values, projectionState = merged, projectionSeq = maxOf(it.projectionSeq, seq))
                                }
                            }
                        }
                        reconcile(epoch)
                        retry = 0
                    }
                } catch (cancel: CancellationException) { throw cancel }
                catch (_: Exception) { delay((1_000L shl retry.coerceAtMost(4)).coerceAtMost(15_000)); retry++ }
            }
        }
    }
    suspend fun readChanges(device: String, sessionId: String, seq: Long, index: Int? = null): JsonObject {
        if (mutable.value.deviceId != device || mutable.value.sessionId != sessionId) throw GatewayFailure("device-changed")
        val result = gateway(device).readChanges(sessionId, seq, index)
        if (mutable.value.deviceId != device || mutable.value.sessionId != sessionId) throw GatewayFailure("device-changed")
        if (index == null) {
            val expected = (mutable.value.timeline.events[seq]?.get("data") as? JsonObject)?.get("turn")
            if (expected == null || result["turn"] != expected) throw GatewayFailure("invalid-response")
        }
        return result
    }
    private fun gateway(device: String): DeviceGateway = devices.selectedConnection()?.takeIf { it.first == device }?.second ?: throw GatewayFailure("device-changed")
    private suspend fun follow(epoch: Long, device: String, id: String) {
        var retry = 0
        var historyWindow = 12
        while (currentCoroutineContext().isActive && generation.get() == epoch) {
            try {
                gateway(device).follow("session/follow", argsRequest("address" to buildJsonObject { put("kind", "session"); put("sessionId", id) },
                    "assistantStream" to JsonPrimitive(true), "maxMessages" to JsonPrimitive(historyWindow))).collect { frame ->
                    if (generation.get() != epoch) return@collect
                    if (frame.text("type") == "snapshot" && frame.getValue("header").jsonObject.text("id") != id) throw GatewayFailure("session-mismatch")
                    update(epoch) {
                        val timeline = reduceTimeline(it.timeline, frame)
                        val baseline = if (frame.text("type") == "snapshot") frame["projections"] as? JsonObject else null
                        val merged = if (baseline != null) it.projectionState.seed(baseline.getValue("values").jsonObject, baseline.number("asOfSeq")) else it.projectionState
                        // Admission becomes ready with the exact baseline's capabilities and title.
                        it.copy(workspacePath = if (frame.text("type") == "snapshot") frame["header"]?.jsonObject?.get("cwd")?.jsonPrimitive?.contentOrNull else it.workspacePath,
                            timeline = timeline, projections = merged.values, projectionState = merged,
                            projectionSeq = maxOf(it.projectionSeq, baseline?.number("asOfSeq") ?: -1),
                            connected = devices.state.value.connected, loading = false, initialLoaded = true, connectionError = null,
                            error = if (it.error in setOf("network-unavailable", "connection-required", "stream-ended", "stream-timeout", "session-expired", "sequence-gap", "baseline-required", "invalid-response")) null else it.error)
                    }
                    if (frame.text("type") == "snapshot") {
                        initialDeadline?.cancel()
                        Diagnostics.emit("session.ready", trace, "session")
                        resetPromptLookup()
                        fillHistoryGap(epoch)
                    }
                    val eventType = (frame["event"] as? JsonObject)?.text("type")
                    if (eventType in setOf("permission/preset", "sandbox/mode", "approval/policy", "command/done") && !mutable.value.controlsBusy) {
                        projectionReadback?.cancel()
                        projectionReadback = scope.launch { delay(100); refreshProjection(epoch, device, id) }
                    }
                    reconcile(epoch); retry = 0
                }
            } catch (cancel: CancellationException) { throw cancel }
            catch (error: Exception) {
                val code = (error as? GatewayFailure)?.code ?: "invalid-response"
                Diagnostics.emit("session.retry", trace, "session", code = code, attempt = retry)
                update(epoch) { it.copy(connected = false, loading = false, connectionError = code) }
                if ((error as? GatewayFailure)?.code in listOf("device-revoked", "certificate-failed", "instance-changed", "session/not-found", "session-mismatch")) return
                if ((error as? GatewayFailure)?.code == "response-too-large" && historyWindow > 1) historyWindow = (historyWindow / 2).coerceAtLeast(1)
                delay((1_000L shl retry.coerceAtMost(4)).coerceAtMost(15_000)); retry++
            }
        }
    }
    /** A departing screen must not stop the subscription acquired by the next screen. */
    @Synchronized fun acquireView(id: String): Long { val owner = viewOwner.incrementAndGet(); open(id); return owner }
    @Synchronized fun isViewActive(): Boolean = viewActive
    @Synchronized fun releaseView(owner: Long) { if (viewOwner.get() == owner) { viewOwner.incrementAndGet(); hide() } }
    private fun updateProjection(epoch: Long, values: JsonObject, seq: Long) {
        update(epoch) {
            val merged = it.projectionState.seed(values, seq)
            it.copy(projections = merged.values, projectionState = merged, projectionSeq = maxOf(it.projectionSeq, seq))
        }
    }
    private fun queueContains(value: JsonElement?, id: String): Boolean = when (value) {
        is JsonObject -> (value["source"] as? JsonObject)?.text("rpcId") == id || value.values.any { queueContains(it, id) }
        is JsonArray -> value.any { queueContains(it, id) }
        else -> false
    }
    private fun clearCompletedGoal(epoch: Long) {
        val state = mutable.value
        val goal = (state.projections["goal"] as? JsonObject)?.get("goal") as? JsonObject ?: return
        if (!state.connected || goal.text("phase") != "complete") return
        val ref = buildJsonObject { put("id", goal["id"] ?: return); put("revision", goal["revision"] ?: return) }
        val key = "$epoch:${state.deviceId}:${state.sessionId}:$ref"
        if (!completedGoalAttempts.add(key)) return
        scope.launch {
            if (generation.get() != epoch) return@launch
            val latest = (mutable.value.projections["goal"] as? JsonObject)?.get("goal") as? JsonObject
            if (latest == null || latest["id"] != ref["id"] || latest["revision"] != ref["revision"] || latest.text("phase") != "complete") return@launch
            try { goal("clear", expectedRef = ref) }
            catch (cancel: CancellationException) { throw cancel }
            catch (_: GatewayFailure) { /* Retry only after a new generation or a new revision, never replay a write blindly. */ }
        }
    }
    private suspend fun reconcile(epoch: Long, acceptedRequest: String? = null) {
        if (generation.get() != epoch) return
        clearCompletedGoal(epoch)
        var s = mutable.value
        s.pendingCompactAfter?.let { after ->
            val result = compactSettlement(s.timeline, after)
            if (result != null) {
                update(epoch) { it.copy(pendingCompactAfter = null, error = if (result) null else "command-rejected", commandMessage = if (result) "上下文已压缩" else "上下文压缩未完成") }
                s = mutable.value
            }
        }
        val pending = s.pendingRequestId ?: return
        val found = acceptedRequest == pending || s.timeline.messages.any { it.requestId == pending } || queueContains(s.projections["inbox"], pending)
        if (found) {
            update(epoch) {
                if (it.pendingRequestId != pending) it else {
                    val clear = it.pendingDraftRevision != null && it.draftRevision == it.pendingDraftRevision
                    it.copy(pendingRequestId = null, pendingText = null, pendingDraftRevision = null, error = null,
                        draft = if (clear) "" else it.draft, draftRevision = if (clear) it.draftRevision + 1 else it.draftRevision)
                }
            }
            saveDraft(mutable.value)
        } else startPromptLookup(epoch, pending)
    }
    @Synchronized private fun startPromptLookup(epoch: Long, pending: String) {
        val s = mutable.value
        if (generation.get() != epoch || !s.connected || s.pendingRequestId != pending || lookupAttempt == (epoch to pending)) return
        val device = s.deviceId ?: return; val session = s.sessionId ?: return
        lookupAttempt = epoch to pending; promptLookup?.cancel()
        promptLookup = scope.launch {
            for (attempt in 0..3) {
            if (attempt > 0) delay((2_000L shl (attempt - 1)))
            if (generation.get() != epoch || mutable.value.pendingRequestId != pending || !mutable.value.connected) return@launch
            try {
                val result = gateway(device).rpc("mobileSearch/lookupPrompt", argsRequest("sessionId" to JsonPrimitive(session), "requestId" to JsonPrimitive(pending))).jsonObject
                val accepted = (result["accepted"] as? JsonPrimitive)?.takeUnless { it.isString }?.booleanOrNull
                val cut = (result["throughSeq"] as? JsonPrimitive)?.takeUnless { it.isString }?.longOrNull
                if (result.text("sessionId") != session || result.text("requestId") != pending || accepted == null || cut == null || cut < -1) throw GatewayFailure("invalid-response")
                if (accepted && cut >= 0 && generation.get() == epoch && mutable.value.pendingRequestId == pending) {
                    reconcile(epoch, pending)
                    Diagnostics.emit("session.ready", trace, "prompt", attempt = attempt)
                    return@launch
                }
                Diagnostics.emit("session.retry", trace, "prompt", code = "result-unknown", attempt = attempt)
                // Negative observations never authorize retransmitting a write.
            } catch (cancel: CancellationException) { throw cancel }
            catch (error: Exception) { Diagnostics.emit("session.retry", trace, "prompt", code = Diagnostics.code(error), attempt = attempt) }
            }
        }
    }
    /** Explicit user acknowledgement only; never retransmit an uncertain prompt. */
    suspend fun releasePendingPrompt(expectedRequestId: String) = writeForCurrentTarget(requireConnection = false) {
        val epoch = generation.get()
        val before = mutable.value
        if (before.sending || before.pendingRequestId != expectedRequestId) return@writeForCurrentTarget
        update(epoch) { current ->
            if (current.pendingRequestId != expectedRequestId) current else current.copy(
                pendingRequestId = null, pendingText = null, pendingDraftRevision = null, error = null)
        }
        resetPromptLookup()
        try { saveDraft(mutable.value) }
        catch (error: Exception) {
            update(epoch) { current -> if (current.pendingRequestId != null) current else current.copy(
                pendingRequestId = before.pendingRequestId, pendingText = before.pendingText,
                pendingDraftRevision = before.pendingDraftRevision, error = "storage-unavailable") }
            throw error
        }
    }
    private fun fillHistoryGap(epoch: Long) {
        if (gapFill?.isActive == true || !mutable.value.timeline.hasHistoryGap) return
        gapFill = scope.launch {
            while (isActive && generation.get() == epoch && mutable.value.connected && mutable.value.timeline.hasHistoryGap) {
                val before = mutable.value.timeline.pageBefore
                val through = mutable.value.timeline.throughSeq
                loadEarlier()
                if (mutable.value.timeline.pageBefore == before && mutable.value.timeline.throughSeq == through) break
            }
        }
    }
    fun setDraft(text: String) {
        mutable.update { it.copy(draft = text, draftRevision = it.draftRevision + 1) }
        val captured = mutable.value; draftSave?.cancel()
        draftSave = scope.launch { delay(300); try { saveDraft(captured) } catch (error: GatewayFailure) { if (mutable.value.deviceId == captured.deviceId && mutable.value.sessionId == captured.sessionId) mutable.update { it.copy(error = error.code) } } }
    }
    private suspend fun saveDraft(s: ConversationState) {
        val device = s.deviceId ?: return; val id = s.sessionId ?: return
        storage.update { prefs ->
            val latest = mutable.value.takeIf { it.deviceId == device && it.sessionId == id } ?: s
            prefs.copy(drafts = prefs.drafts.filterNot { it.deviceId == device && it.sessionId == id } +
                ConversationDraft(device, id, latest.draft, latest.pendingRequestId, latest.pendingText, latest.draftRevision, latest.pendingDraftRevision, latest.localAttachment))
        }
    }
    suspend fun send() {
        val s = mutable.value; val epoch = generation.get()
        if (s.localAttachment != null) throw GatewayFailure("attachment-not-ready")
        if (s.draft.isBlank() && s.attachmentPart == null) return
        // Reserve before waiting behind another mutation. The clicked payload
        // stays immutable, and rapid repeated clicks cannot queue duplicates.
        while (true) {
            val current = mutable.value
            if (generation.get() != epoch || current.deviceId != s.deviceId || current.sessionId != s.sessionId) throw GatewayFailure("device-changed")
            if (!current.connected || current.sending || current.pendingRequestId != null) throw GatewayFailure("connection-required")
            if (current.localAttachment != null) throw GatewayFailure("attachment-not-ready")
            if (mutable.compareAndSet(current, current.copy(sending = true))) break
        }
        try {
            writeForCurrentTarget {
                if (generation.get() != epoch) throw GatewayFailure("device-changed")
                if (mutable.value.localAttachment != null) throw GatewayFailure("attachment-not-ready")
                val device = s.deviceId ?: throw GatewayFailure("device-not-found"); val id = s.sessionId ?: throw GatewayFailure("session/not-found")
                if (!mutable.value.connected || mutable.value.pendingRequestId != null) throw GatewayFailure("connection-required")
                val requestId = UUID.randomUUID().toString()
                draftSave?.cancel()
                update(epoch) { it.copy(pendingRequestId = requestId, pendingText = s.draft, pendingDraftRevision = s.draftRevision, error = null) }
                var admitted = false
                try {
                    saveDraft(mutable.value)
                    val content = buildJsonArray {
                        if (s.draft.isNotBlank()) add(buildJsonObject { put("type", "text"); put("text", s.draft) })
                        s.attachmentPart?.let(::add)
                    }
                    val receipt = gateway(device).rpc("session/prompt", argsRequest("requestId" to JsonPrimitive(requestId), "sessionId" to JsonPrimitive(id),
                        "mode" to JsonPrimitive("queue"), "clientTimeZone" to JsonPrimitive(java.util.TimeZone.getDefault().id), "content" to content), true)
                    // A successful envelope with a missing/false receipt does not
                    // prove rejection: the write may already have been applied.
                    if ((receipt as? JsonObject)?.get("accepted")?.let { (it as? JsonPrimitive)?.takeUnless { value -> value.isString }?.booleanOrNull } != true) throw GatewayFailure("result-unknown")
                    admitted = true
                    if (generation.get() != epoch) {
                        storage.update { prefs -> prefs.copy(drafts = prefs.drafts.map { draft ->
                            if (draft.deviceId != device || draft.sessionId != id || draft.pendingRequestId != requestId) draft
                            else {
                                val clear = draft.draftRevision == s.draftRevision
                                draft.copy(text = if (clear) "" else draft.text, draftRevision = if (clear) draft.draftRevision + 1 else draft.draftRevision,
                                    pendingRequestId = null, pendingText = null, pendingDraftRevision = null)
                            }
                        }) }
                        return@writeForCurrentTarget
                    }
                    update(epoch) {
                        val clear = it.draftRevision == s.draftRevision
                        it.copy(draft = if (clear) "" else it.draft, draftRevision = if (clear) it.draftRevision + 1 else it.draftRevision,
                            pendingRequestId = null, pendingText = null, pendingDraftRevision = null, error = null,
                            attachmentName = if (it.attachmentPart == s.attachmentPart) null else it.attachmentName,
                            attachmentPart = if (it.attachmentPart == s.attachmentPart) null else it.attachmentPart)
                    }
                    saveDraft(mutable.value); reconcile(epoch)
                } catch (cancel: CancellationException) { throw cancel }
                catch (error: Exception) {
                    if (generation.get() == epoch) {
                        val failure = error as? GatewayFailure
                        val code = if (admitted) failure?.code ?: "storage-unavailable" else if (failure?.remoteDetails?.text("reason") == "MODEL_DOES_NOT_SUPPORT_IMAGES") "image-model-unsupported" else failure?.code ?: "invalid-response"
                        update(epoch) { it.copy(error = code, pendingRequestId = if (code == "result-unknown") requestId else null, pendingText = if (code == "result-unknown") s.draft else null, pendingDraftRevision = if (code == "result-unknown") s.draftRevision else null) }
                        saveDraft(mutable.value)
                        if (code == "result-unknown") reconcile(epoch)
                    }
                    throw error
                }
            }
        } finally { update(epoch) { it.copy(sending = false) } }
    }
    suspend fun stop() = writeForCurrentTarget {
        val s = mutable.value; val device = s.deviceId ?: return@writeForCurrentTarget; val id = s.sessionId ?: return@writeForCurrentTarget; val epoch = generation.get()
        update(epoch) { it.copy(stopping = true, error = null) }
        try { gateway(device).rpc("session/cancel", argsRequest("sessionId" to JsonPrimitive(id)), true) }
        catch (error: GatewayFailure) { update(epoch) { it.copy(error = error.code) }; throw error }
        finally { update(epoch) { it.copy(stopping = false) } }
    }
    suspend fun loadEarlier() {
        val captured = mutable.value; val epoch = generation.get()
        pages.withLock {
            if (generation.get() != epoch || mutable.value.deviceId != captured.deviceId || mutable.value.sessionId != captured.sessionId) return@withLock
            val s = mutable.value; val device = s.deviceId ?: return@withLock; val id = s.sessionId ?: return@withLock
            if (!s.timeline.hasMore || !s.connected) return@withLock
            update(epoch) { it.copy(paging = true) }
            try {
                val page = gateway(device).rpc("session/page", argsRequest("address" to buildJsonObject { put("kind", "session"); put("sessionId", id) },
                    "throughSeq" to JsonPrimitive(s.timeline.throughSeq), "beforeSeq" to JsonPrimitive(s.timeline.pageBefore), "maxMessages" to JsonPrimitive(12))).jsonObject
                update(epoch) { it.copy(timeline = mergeHistory(it.timeline, page, s.timeline.pageBefore, s.timeline.throughSeq)) }
                reconcile(epoch)
            } catch (error: GatewayFailure) { update(epoch) { it.copy(error = error.code) } }
            finally { update(epoch) { it.copy(paging = false) } }
        }
    }
    suspend fun retainAttachment(draft: LocalAttachmentDraft, expectedDevice: String?, expectedSession: String?) = writeForCurrentTarget(requireConnection = false) {
        val s = mutable.value; val epoch = generation.get()
        if (expectedDevice == null || expectedSession == null || s.deviceId != expectedDevice || s.sessionId != expectedSession) throw GatewayFailure("device-changed")
        if (android.net.Uri.parse(draft.uri).scheme != "content") throw GatewayFailure("attachment-read")
        if (s.sending || s.pendingRequestId != null) throw GatewayFailure("connection-required")
        update(epoch) { it.copy(localAttachment = draft, attachmentName = null, attachmentPart = null) }
        if (generation.get() != epoch) throw GatewayFailure("device-changed")
        val retained = mutable.value
        if (retained.deviceId != expectedDevice || retained.sessionId != expectedSession) throw GatewayFailure("device-changed")
        saveDraft(retained)
    }
    suspend fun attach(name: String, bytes: ByteArray, expectedDevice: String? = null, expectedSession: String? = null) =
        attachUsing(name, expectedDevice, expectedSession) { device, id -> gateway(device).upload(id, name, bytes) }
    suspend fun attachStream(name: String, length: Long, open: () -> java.io.InputStream, expectedDevice: String?, expectedSession: String?) =
        attachUsing(name, expectedDevice, expectedSession) { device, id -> gateway(device).uploadStream(id, name, length, open) }
    private suspend fun attachUsing(name: String, expectedDevice: String?, expectedSession: String?, upload: suspend (String, String) -> JsonObject) = writeForCurrentTarget {
        val s = mutable.value; val device = s.deviceId ?: throw GatewayFailure("device-not-found"); val id = s.sessionId ?: throw GatewayFailure("session/not-found"); val epoch = generation.get()
        if (expectedDevice != null && (device != expectedDevice || id != expectedSession)) throw GatewayFailure("device-changed")
        update(epoch) { it.copy(uploading = true, error = null) }
        try {
            val receipt = upload(device, id)
            update(epoch) { it.copy(attachmentName = name, attachmentPart = buildJsonObject { put("type", "file"); put("receiptId", receipt.string("receiptId")) }, localAttachment = null) }
            saveDraft(mutable.value)
        } catch (error: GatewayFailure) {
            update(epoch) { it.copy(error = error.code, localAttachment = if (error.code == "result-unknown") it.localAttachment?.copy(uploadResultUnknown = true) else it.localAttachment) }
            if (error.code == "result-unknown" && s.localAttachment != null) storage.update { prefs ->
                prefs.copy(drafts = prefs.drafts.map { draft ->
                    if (draft.deviceId == device && draft.sessionId == id && draft.localAttachment == s.localAttachment)
                        draft.copy(localAttachment = draft.localAttachment?.copy(uploadResultUnknown = true))
                    else draft
                })
            }
            throw error
        }
        finally { update(epoch) { it.copy(uploading = false) } }
    }
    suspend fun attachImage(name: String, mediaType: String, bytes: ByteArray, expectedDevice: String? = null, expectedSession: String? = null) = writeForCurrentTarget(requireConnection = false) {
        val s = mutable.value; val epoch = generation.get()
        if (expectedDevice != null && (s.deviceId != expectedDevice || s.sessionId != expectedSession)) throw GatewayFailure("device-changed")
        // Preparing an image is local draft work. Returning from the Android
        // document picker may precede the renewed WSS baseline; admission is
        // still forbidden until send() confirms a connected target.
        if (s.deviceId == null || s.sessionId == null) throw GatewayFailure("session/not-found")
        val limits = s.projections["imageLimits"] as? JsonObject ?: throw GatewayFailure("image-limits-unavailable")
        val types = limits.getValue("mediaTypes").jsonArray.map { it.jsonPrimitive.content }
        if (mediaType !in types) throw GatewayFailure("image-type")
        if (bytes.isEmpty() || bytes.size.toLong() > limits.number("maxImageBytes") || bytes.size.toLong() > limits.number("maxMessageImageBytes")) throw GatewayFailure("attachment-size")
        val bounds = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
        android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || bounds.outMimeType != mediaType) throw GatewayFailure("image-invalid")
        if (bounds.outWidth.toLong() * bounds.outHeight > limits.number("maxImagePixels") || maxOf(bounds.outWidth, bounds.outHeight) > limits.number("maxImageDimension")) throw GatewayFailure("image-dimensions")
        update(epoch) { it.copy(attachmentName = name, attachmentPart = buildJsonObject {
            put("type", "image"); put("mediaType", mediaType); put("name", name)
            put("data", java.util.Base64.getEncoder().encodeToString(bytes))
        }, error = null, localAttachment = null) }
        saveDraft(mutable.value)
    }
    suspend fun loadModels() {
        val s = mutable.value; val device = s.deviceId ?: throw GatewayFailure("device-not-found"); val epoch = generation.get()
        update(epoch) { it.copy(modelsLoading = true) }
        try {
            val catalog = gateway(device).rpc("session/modelCatalog", JsonObject(emptyMap())).jsonObject
            catalog.getValue("groups").jsonArray; catalog.getValue("default").jsonObject
            update(epoch) { it.copy(modelCatalog = catalog) }
        } catch (error: GatewayFailure) { update(epoch) { it.copy(error = error.code) }; throw error }
        finally { update(epoch) { it.copy(modelsLoading = false) } }
    }
    /** A successful command can precede (or outlive) its control-stream update.
     * Read the official per-session projection without downloading every session. */
    private suspend fun refreshProjection(epoch: Long, device: String, id: String) = projectionReads.withLock {
        if (generation.get() != epoch) return@withLock
        try {
            val projection = gateway(device).rpc("session/projections", buildJsonObject { put("request", buildJsonObject { put("sessionId", id) }) })
                .takeUnless { it is JsonNull }?.jsonObject ?: throw GatewayFailure("session/not-found")
            updateProjection(epoch, projection.getValue("values").jsonObject, projection.number("asOfSeq"))
            update(epoch) { it.copy(projectionRefreshFailed = false) }
        } catch (cancel: CancellationException) { throw cancel }
        catch (_: Exception) { update(epoch) { it.copy(projectionRefreshFailed = true) } }
    }
    suspend fun selectModel(provider: String, model: String, reasoningEffort: String? = null) = writeForCurrentTarget {
        val s = mutable.value; val device = s.deviceId ?: throw GatewayFailure("device-not-found"); val id = s.sessionId ?: throw GatewayFailure("session/not-found")
        if (!s.connected || s.sending || s.pendingRequestId != null) throw GatewayFailure("connection-required")
        val epoch = generation.get(); update(epoch) { it.copy(modelChanging = true, error = null) }
        try {
            gateway(device).rpc("session/selectModel", buildJsonObject { put("request", buildJsonObject {
                put("sessionId", id); put("provider", provider); put("model", model)
                reasoningEffort?.let { put("reasoningEffort", it) }
            }) }, true)
        } catch (error: GatewayFailure) { update(epoch) { it.copy(error = error.code) }; throw error }
        finally { refreshProjection(epoch, device, id); update(epoch) { it.copy(modelChanging = false) } }
    }
    suspend fun loadPermissions() {
        val device = mutable.value.deviceId ?: return; val epoch = generation.get()
        try {
            val result = gateway(device).rpc("permissionPresets/catalog", JsonObject(emptyMap())).jsonObject
            val options = wireValue { result.getValue("options").jsonArray }
            update(epoch) { it.copy(permissionOptions = options, permissionError = null) }
        } catch (error: GatewayFailure) { update(epoch) { it.copy(permissionError = error.code) } }
    }
    suspend fun loadCommands() {
        val device = mutable.value.deviceId ?: return
        val id = mutable.value.sessionId ?: return
        val epoch = generation.get()
        update(epoch) { it.copy(commandsLoading = true, compactAvailable = null, commandsError = null) }
        try {
            val result = gateway(device).rpc("commands/list", buildJsonObject { put("agentId", id) })
            val commands = result as? JsonArray ?: throw GatewayFailure("invalid-response")
            val names = wireValue { commands.map { it.jsonObject.string("name").takeIf(String::isNotBlank) ?: throw GatewayFailure("invalid-response") } }
            update(epoch) { it.copy(compactAvailable = "compact" in names) }
        } catch (cancel: CancellationException) { throw cancel }
        catch (error: GatewayFailure) { update(epoch) { it.copy(commandsError = error.code) } }
        finally { update(epoch) { it.copy(commandsLoading = false) } }
    }
    suspend fun loadGitBranch() {
        val epoch = generation.get()
        val current = mutable.value
        val device = current.deviceId ?: return
        val session = current.sessionId ?: return
        val cwd = current.workspacePath ?: return
        try {
            val branch = withTimeout(5_000) { WorkspaceGitReader.forSession(gateway(device), session).branch(cwd) }
            update(epoch) { it.copy(gitBranch = branch) }
        } catch (timeout: TimeoutCancellationException) { update(epoch) { it.copy(gitBranch = null) } }
        catch (cancel: CancellationException) { throw cancel }
        catch (_: Exception) { update(epoch) { it.copy(gitBranch = null) } }
    }

    suspend fun loadGoalActivation() {
        val s = mutable.value; val epoch = generation.get()
        val device = s.deviceId ?: return; val id = s.sessionId ?: return
        try {
            val view = gateway(device).rpc("goals/get", buildJsonObject { put("agentId", id) }) as? JsonObject
            update(epoch) { it.copy(goalActivation = view) }
        } catch (cancel: CancellationException) { throw cancel } catch (_: Exception) { /* Durable phase remains available. */ }
    }
    suspend fun command(line: String) = writeForCurrentTarget {
        val s = mutable.value; val device = s.deviceId ?: throw GatewayFailure("device-not-found"); val id = s.sessionId ?: throw GatewayFailure("session/not-found")
        if (!s.connected || s.pendingRequestId != null) throw GatewayFailure("connection-required")
        if (line.trim() == "/compact" && s.pendingCompactAfter != null) throw GatewayFailure("compact-pending")
        val compact = line.trim() == "/compact"
        val epoch = generation.get(); update(epoch) { it.copy(controlsBusy = true, error = null, commandMessage = null, pendingCompactAfter = if (compact) it.timeline.cursor else it.pendingCompactAfter) }
        try {
            val execution = gateway(device).rpc("commands/execute", buildJsonObject { put("agentId", id); put("line", line); put("submittedAttachments", JsonArray(emptyList())) }, true)
            if (execution is JsonNull) throw GatewayFailure("command-unavailable")
            val result = execution.jsonObject.getValue("result").jsonObject
            update(epoch) { it.copy(commandMessage = result.text("text").takeIf { text -> text.isNotBlank() }, error = if (result.text("kind") == "error") "command-rejected" else null, pendingCompactAfter = if (compact) null else it.pendingCompactAfter) }
        } catch (error: GatewayFailure) { update(epoch) {
                val settled = if (compact) compactSettlement(it.timeline, s.timeline.cursor) else null
                it.copy(error = if (settled == true) null else if (settled == false) "command-rejected" else error.code,
                    pendingCompactAfter = if (compact && (settled != null || error.code != "result-unknown")) null else it.pendingCompactAfter)
            }; throw error }
        finally { refreshProjection(epoch, device, id); update(epoch) { it.copy(controlsBusy = false) } }
    }
    suspend fun selectPermission(value: String) {
        if (mutable.value.permissionOptions.none { it.jsonObject.text("value") == value }) throw GatewayFailure("permission-unavailable")
        command("/permission $value")
    }
    suspend fun goal(action: String, objective: String? = null, expectedRef: JsonObject? = null) = writeForCurrentTarget {
        val s = mutable.value; val device = s.deviceId ?: throw GatewayFailure("device-not-found"); val id = s.sessionId ?: throw GatewayFailure("session/not-found")
        if (!s.connected || s.pendingRequestId != null) throw GatewayFailure("connection-required")
        if (action !in setOf("create", "edit", "pause", "resume", "complete", "clear")) throw GatewayFailure("unsupported-operation")
        if (action != "create") {
            val current = (s.projections["goal"] as? JsonObject)?.get("goal") as? JsonObject
            if (current == null || expectedRef == null || current["id"] != expectedRef["id"] || current["revision"] != expectedRef["revision"]) throw GatewayFailure("goal-stale")
        }
        val epoch = generation.get(); update(epoch) { it.copy(controlsBusy = true, error = null) }
        try {
            val args = buildJsonObject {
                put("agentId", id)
                if (action != "create") put("ref", expectedRef ?: throw GatewayFailure("goal-stale"))
                if (action in setOf("create", "edit")) put("request", buildJsonObject {
                    put("objective", objective?.trim()?.takeIf { it.isNotBlank() } ?: throw GatewayFailure("goal-empty"))
                })
            }
            gateway(device).rpc("goals/$action", args, true)
        } catch (error: GatewayFailure) {
            val code = if (error.code == "GOAL_STALE_REVISION" || error.remoteMessage?.contains("stale goal ref") == true) "goal-stale" else error.code
            update(epoch) { it.copy(error = code) }; throw error
        }
        finally { refreshProjection(epoch, device, id); update(epoch) { it.copy(controlsBusy = false) } }
    }
    suspend fun answerContinuedQuestion(callId: String, answer: JsonObject) = writeForCurrentTarget {
        val s = mutable.value; val device = s.deviceId ?: throw GatewayFailure("device-not-found"); val id = s.sessionId ?: throw GatewayFailure("session/not-found")
        val active = ((s.projections["userQuestions"] as? JsonObject)?.get("active") as? JsonArray).orEmpty()
        if (callId in s.submittedQuestions || active.none { it.jsonObject.text("callId") == callId && it.jsonObject.text("state") == "continued" }) throw GatewayFailure("request-withdrawn")
        val epoch = generation.get(); update(epoch) { it.copy(controlsBusy = true) }
        try {
            val accepted = gateway(device).rpc("userQuestions/answer", buildJsonObject { put("agentId", id); put("callId", callId); put("answer", answer) }, true)
            if ((accepted as? JsonPrimitive)?.booleanOrNull != true) throw GatewayFailure("request-withdrawn")
            update(epoch) { it.copy(submittedQuestions = it.submittedQuestions + callId, commandMessage = "回答已提交，等待电脑端同步", error = null) }
        } catch (error: GatewayFailure) {
            update(epoch) { it.copy(error = error.code,
                submittedQuestions = if (error.code == "result-unknown") it.submittedQuestions + callId else it.submittedQuestions) }; throw error
        } finally { update(epoch) { it.copy(controlsBusy = false) } }
    }
    fun removeAttachment() {
        mutable.update { it.copy(attachmentName = null, attachmentPart = null, localAttachment = null) }
        val captured = mutable.value; scope.launch { try { saveDraft(captured) } catch (error: GatewayFailure) {
            mutable.update { if (it.deviceId == captured.deviceId && it.sessionId == captured.sessionId) it.copy(error = error.code) else it }
        } }
    }
    @Synchronized fun retry() { val id = mutable.value.sessionId ?: return; subscription?.cancel(); subscription = null; open(id) }
    @Synchronized fun pause() {
        Diagnostics.emit("session.pause", trace, "session")
        initialDeadline?.cancel()
        val captured = mutable.value; draftSave?.cancel()
        scope.launch {
            try { saveDraft(captured) }
            catch (error: GatewayFailure) { mutable.update { if (it.deviceId == captured.deviceId && it.sessionId == captured.sessionId) it.copy(error = error.code) else it } }
        }
        generation.incrementAndGet(); subscription?.cancel(); controls?.cancel(); gapFill?.cancel(); projectionReadback?.cancel(); interactions.pause(); mutable.update { it.copy(connected = false, loading = false, sending = false, stopping = false, paging = false, uploading = false, modelsLoading = false, modelChanging = false, controlsBusy = false, commandsLoading = false, compactAvailable = null, commandsError = null) }
        resetPromptLookup()
    }
    @Synchronized fun hide() { viewActive = false; pause() }
    @Synchronized fun resume() { if (viewActive && mutable.value.sessionId != null) retry() }
    @Synchronized fun closeSession() { initialDeadline?.cancel(); viewActive = false; generation.incrementAndGet(); subscription?.cancel(); controls?.cancel(); gapFill?.cancel(); projectionReadback?.cancel(); resetPromptLookup(); interactions.pause(); mutable.value = ConversationState() }
    fun close() { interactions.close(); scope.cancel() }
}
