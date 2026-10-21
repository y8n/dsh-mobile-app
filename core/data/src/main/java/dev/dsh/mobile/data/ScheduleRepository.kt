package dev.dsh.mobile.data

import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.*
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong

data class ScheduleState(val deviceId: String? = null, val sessionId: String? = null, val loading: Boolean = false,
    val busy: Boolean = false, val supported: Boolean = false, val entries: List<JsonObject> = emptyList(),
    val error: String? = null, val notice: String? = null, val pending: PendingScheduleWrite? = null,
    val historyId: String? = null, val history: List<JsonObject> = emptyList(), val nextBefore: String? = null,
    val earlierUnavailable: Boolean = false, val historyLoading: Boolean = false) {
    val activeEntries get() = entries.filter { it.text("status") == "active" }
}

/** One visible device/session target; persisted uncertain writes are never automatically replayed. */
class ScheduleRepository(private val devices: DeviceRepository, private val storage: DeviceStore) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val epoch = AtomicLong(); private val historyEpoch = AtomicLong(); private val writes = Mutex(); private val reads = Mutex()
    private val mutable = MutableStateFlow(ScheduleState()); val state = mutable.asStateFlow()
    private var events: Job? = null; private var load: Job? = null; private var visible = false
    init { scope.launch { devices.state.map { it.selectedId }.distinctUntilChanged().collect { changedDevice() } } }
    @Synchronized private fun changedDevice() {
        if (mutable.value.deviceId != null && mutable.value.deviceId != devices.state.value.selectedId) { hide(); mutable.value = ScheduleState() }
    }
    private fun gateway(device: String) = devices.selectedConnection()?.takeIf { it.first == device }?.second ?: throw GatewayFailure("device-changed")
    private fun update(g: Long, transform: (ScheduleState) -> ScheduleState) { mutable.update { if (epoch.get() == g) transform(it) else it } }
    @Synchronized fun show(session: String) {
        val device = devices.state.value.selectedId ?: return
        visible = true
        if (mutable.value.deviceId == device && mutable.value.sessionId == session && events?.isActive == true) return
        start(device, session)
    }
    private fun start(device: String, session: String) {
        pause(); val g = epoch.incrementAndGet(); mutable.value = ScheduleState(deviceId = device, sessionId = session, loading = true)
        load = scope.launch {
            try { val pending = storage.read().scheduleWrites.firstOrNull { it.deviceId == device && it.sessionId == session }; update(g) { it.copy(pending = pending) }; refresh(g, device, session) }
            catch (cancel: CancellationException) { throw cancel }
            catch (e: Exception) { update(g) { it.copy(loading = false, error = code(e)) } }
        }
        events = scope.launch {
            var attempt = 0
            while (isActive && epoch.get() == g) {
                try {
                    var client: String? = null
                    gateway(device).follow("\$events", JsonObject(emptyMap())).collect { frame ->
                        if (epoch.get() != g) return@collect
                        when (frame.text("type")) {
                            "ready" -> { client = frame.string("clientId"); refresh() }
                            "waterfall" -> gateway(device).rpc("\$events/result", buildJsonObject {
                                put("clientId", client ?: throw GatewayFailure("baseline-required")); put("eventId", frame.string("eventId")); put("outcome", buildJsonObject { put("kind", "next") })
                            }, true)
                            "emit" -> if (frame.text("event") in setOf("schedule/changed", "plugin-manager/changed")) refresh()
                        }
                        attempt = 0
                    }
                } catch (cancel: CancellationException) { throw cancel }
                catch (_: Exception) { delay((1_000L shl attempt.coerceAtMost(4)).coerceAtMost(15_000)); attempt++ }
            }
        }
    }
    private suspend fun refresh(g: Long, device: String, session: String) = reads.withLock {
        if (epoch.get() != g) return@withLock
        update(g) { it.copy(loading = true) }
        try {
            val supported = try { gateway(device).rpc("mobileSchedule/capabilities", JsonObject(emptyMap())).jsonObject.let { it.number("version") == 1L && (it["lifecycle"] as? JsonPrimitive)?.booleanOrNull == true && (it["durableRequestIdentity"] as? JsonPrimitive)?.booleanOrNull == true } }
            catch (e: GatewayFailure) { if (e.code in setOf("gateway/invocation-unavailable", "gateway/definition-unavailable", "unsupported-gateway")) false else throw e }
            val entries = gateway(device).rpc(if (supported) "mobileSchedule/catalog" else "schedule/catalog", JsonObject(emptyMap())).jsonArray.map { it.jsonObject }.filter { it.text("sessionId") == session }
                .map { JsonObject(it + ("__device" to JsonPrimitive(device))) }
            update(g) { it.copy(loading = false, supported = supported, entries = entries,
                error = it.error?.takeIf { error -> error.startsWith("schedule-") || error.startsWith("invalid_") || error == "not-future" || error == "request-identity-conflict" }) }
        } catch (cancel: CancellationException) { throw cancel }
        catch (e: Exception) { update(g) { it.copy(loading = false, error = code(e)) }; throw e }
    }
    fun refresh() {
        val s = mutable.value; val device = s.deviceId ?: return; val session = s.sessionId ?: return; val g = epoch.get()
        scope.launch { try { refresh(g, device, session) } catch (_: Exception) { } }
    }
    private suspend fun <T> write(expectedDevice: String? = null, expectedSession: String? = null, block: suspend (Long, String, String) -> T): T {
        val s = mutable.value; val device = s.deviceId ?: throw GatewayFailure("device-not-found"); val session = s.sessionId ?: throw GatewayFailure("session-not-found"); val g = epoch.get()
        if ((expectedDevice != null && expectedDevice != device) || (expectedSession != null && expectedSession != session)) throw GatewayFailure("device-changed")
        return writes.withLock {
            if (epoch.get() != g || devices.state.value.selectedId != device || mutable.value.sessionId != session) throw GatewayFailure("device-changed")
            if (!devices.state.value.connected) throw GatewayFailure("connection-required")
            if (!mutable.value.supported) throw GatewayFailure("schedule-extension-required")
            update(g) { it.copy(busy = true, error = null, notice = null) }
            try { block(g, device, session) }
            catch (cancel: CancellationException) { throw cancel }
            catch (e: Exception) { update(g) { it.copy(error = code(e)) }; throw e }
            finally { update(g) { it.copy(busy = false) } }
        }
    }
    suspend fun create(definition: JsonObject, expectedDevice: String? = null, expectedSession: String? = null) = change("create", null, definition, expectedDevice, expectedSession)
    private fun assertAdmission(session: String, operation: String) {
        if (operation in setOf("create", "update", "resume", "runNow") && session in devices.state.value.snapshot?.archivedSessionIds.orEmpty()) throw GatewayFailure("session-archived")
    }
    suspend fun change(operation: String, observed: JsonObject?, definition: JsonObject? = null,
                       expectedDevice: String? = observed?.text("__device")?.takeIf(String::isNotBlank), expectedSession: String? = observed?.text("sessionId")) = write(expectedDevice, expectedSession) { g, device, session ->
        if (mutable.value.pending != null) throw GatewayFailure("schedule-result-pending")
        if (operation !in setOf("create", "update", "delete", "pause", "resume", "runNow")) throw GatewayFailure("invalid-request")
        assertAdmission(session, operation)
        val request = buildJsonObject {
            put("sessionId", session); put("requestId", UUID.randomUUID().toString())
            if (operation != "create") {
                val row = observed ?: throw GatewayFailure("invalid-request")
                if (row.text("sessionId") != session) throw GatewayFailure("device-changed")
                put("id", row.string("id")); put("expectedVersion", row.string("version"))
            }
            if (definition != null) put("definition", definition)
        }
        val pending = PendingScheduleWrite(device, session, "mobileSchedule/$operation", request)
        storage.update { it.copy(scheduleWrites = it.scheduleWrites + pending) }; update(g) { it.copy(pending = pending) }
        perform(g, pending)
    }
    /** Only an explicit user action retries the immutable original request and identity. */
    suspend fun reconcile(expectedDevice: String? = null, expectedSession: String? = null) = write(expectedDevice, expectedSession) { g, _, _ -> mutable.value.pending?.let { perform(g, it) } }
    private suspend fun perform(g: Long, pending: PendingScheduleWrite) {
        try {
            assertAdmission(pending.sessionId, pending.method.substringAfterLast('/'))
            val result = gateway(pending.deviceId).rpc(pending.method, buildJsonObject { put("request", pending.request) }, true).jsonObject
            val entry = result["entry"] as? JsonObject
            val validEntry = entry?.text("sessionId") == pending.sessionId && entry.text("id").isNotBlank() && entry.text("version").matches(Regex("[a-f0-9]{64}")) && entry.text("status") in setOf("active", "paused", "inactive") && (pending.method.endsWith("/create") || entry.text("id") == pending.request.text("id"))
            val valid = when {
                pending.method.endsWith("/delete") -> (result["deleted"] as? JsonPrimitive)?.booleanOrNull == true && result.text("id") == pending.request.text("id")
                pending.method.endsWith("/runNow") -> validEntry && result.text("sessionId") == pending.sessionId && result.text("id") == pending.request.text("id") && result.text("deliveryStatus") == "delivered" && result.text("messageId").isNotBlank() && result.text("deliveryId").isNotBlank()
                else -> validEntry
            }
            if (!valid) throw GatewayFailure("schedule-result-unknown")
            clear(pending); update(g) { it.copy(pending = null, notice = if (result.text("deliveryStatus") == "delivered") "已投递；模型执行结果尚未确认。" else "操作已提交，已重新读取任务。") }
            if (epoch.get() == g) refresh(g, pending.deviceId, pending.sessionId)
        } catch (cancel: CancellationException) { throw cancel }
        catch (e: Exception) {
            val code = code(e)
            if (code in setOf("schedule-conflict", "schedule-not-found", "schedule-ended", "schedule-not-active", "schedule-not-paused", "not-future", "invalid-request", "invalid_prompt", "invalid_selector", "invalid_rule", "invalid_time_zone", "not_future", "time_out_of_range", "frequency_too_high", "request-identity-conflict")) {
                clear(pending); update(g) { it.copy(pending = null) }
                if (epoch.get() == g) try { refresh(g, pending.deviceId, pending.sessionId) } catch (_: Exception) { }
            }
            throw e
        }
    }
    private suspend fun clear(p: PendingScheduleWrite) { storage.update { it.copy(scheduleWrites = it.scheduleWrites.filterNot { old -> old.deviceId == p.deviceId && old.sessionId == p.sessionId && old.request.text("requestId") == p.request.text("requestId") }) } }
    suspend fun history(observed: JsonObject, more: Boolean = false) {
        val s = mutable.value; val device = s.deviceId ?: return; val session = s.sessionId ?: return; val g = epoch.get()
        if (observed.text("sessionId") != session) throw GatewayFailure("device-changed")
        if (observed.text("__device").isNotBlank() && observed.text("__device") != device) throw GatewayFailure("device-changed")
        val request = historyEpoch.incrementAndGet(); val id = observed.string("id")
        val before = if (more && s.historyId == id) s.nextBefore ?: return else null
        update(g) { it.copy(historyId = id, historyLoading = true, history = if (before == null) emptyList() else it.history) }
        try {
            val result = gateway(device).rpc(if (s.supported) "mobileSchedule/history" else "schedule/history", buildJsonObject { put("request", buildJsonObject {
                put("sessionId", session); put("id", id); put("limit", 20); if (before != null) put("before", before)
            }) }).jsonObject
            if (result["code"] != null) throw GatewayFailure(result.string("code"))
            val records = result.getValue("records").jsonArray.map { it.jsonObject }
            update(g) { if (historyEpoch.get() == request) it.copy(historyLoading = false, history = (it.history + records).distinctBy { item -> item.string("messageId") }, nextBefore = result.text("nextBefore").takeIf(String::isNotBlank), earlierUnavailable = (result["earlierRecordsUnavailable"] as? JsonPrimitive)?.booleanOrNull == true) else it }
        } catch (cancel: CancellationException) { throw cancel }
        catch (e: Exception) { update(g) { if (historyEpoch.get() == request) it.copy(historyLoading = false, error = code(e)) else it }; throw e }
    }
    @Synchronized fun pause() { epoch.incrementAndGet(); historyEpoch.incrementAndGet(); events?.cancel(); events = null; load?.cancel(); load = null; mutable.update { it.copy(loading = false, historyLoading = false) } }
    @Synchronized fun resume() { val s = mutable.value; if (visible && s.deviceId == devices.state.value.selectedId && s.sessionId != null) start(s.deviceId ?: return, s.sessionId) }
    @Synchronized fun hide() { visible = false; pause() }
    fun close() { hide(); scope.cancel() }
    private fun code(e: Exception) = (e as? GatewayFailure)?.code ?: "invalid-response"
}
