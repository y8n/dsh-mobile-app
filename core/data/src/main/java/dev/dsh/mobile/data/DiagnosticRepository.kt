package dev.dsh.mobile.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.util.AtomicFile
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.*
import java.io.File
import java.io.IOException
import java.util.UUID

data class DiagnosticState(val automatic: Boolean = false, val queued: Int = 0, val uploading: Boolean = false,
    val computerId: String = "",
    val lastReportId: String? = null, val lastArchiveKey: String? = null, val lastUploadedAt: Long = 0, val error: String? = null)

/** Bounded private journal. Upload retries retain the exact report ID and body across process death. */
class DiagnosticRepository(context: Context, private val appVersion: String, private val versionCode: Int,
    private val directory: File = File(context.filesDir, "diagnostics"),
    private val computerUploader: (suspend (String, JsonObject) -> JsonObject)? = null,
    private val uploader: (suspend (JsonObject) -> JsonObject)? = null) {
    val uploadAvailable: Boolean get() = uploader != null || (computerUploader != null && mutable.value.computerId.isNotBlank())
    private val connectivity = context.getSystemService(ConnectivityManager::class.java)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val journal = Mutex()
    private val uploads = Mutex()
    private val draining = Mutex()
    private data class JournalInput(val event: JsonObject? = null, val barrier: CompletableDeferred<Unit>? = null)
    private val ready = CompletableDeferred<Unit>()
    private val input = Channel<JournalInput>(256)
    private val file = AtomicFile(File(directory.apply { mkdirs() }, "journal.json"))
    private val events = mutableListOf<JsonObject>()
    private var sequence = 0L
    private var journalId = UUID.randomUUID().toString()
    private var pending: JsonObject? = null
    private var automaticJob: Job? = null
    private var persistJob: Job? = null
    private val mutable = MutableStateFlow(DiagnosticState())
    val state = mutable.asStateFlow()
    init { scope.launch {
        journal.withLock {
            // Discard credentials from the retired HTTP receiver; never migrate them into computer uploads.
            AtomicFile(File(directory, "receiver.enc")).delete()
            try {
                val raw = file.openRead().use { stream -> readBounded(stream, 512 * 1024) }
                if (raw.size > 512 * 1024) throw IOException()
                val saved = WireJson.parseToJsonElement(raw.decodeToString()).jsonObject
                val computerId = saved.text("computerId").takeIf { it.length <= 200 }.orEmpty()
                mutable.update { it.copy(computerId = computerId) }
                val receiverMatches = saved.number("uploadPolicyVersion") == 4L
                sequence = saved.number("sequence")
                journalId = saved["journalId"]?.jsonPrimitive?.contentOrNull?.takeIf { it.matches(UUID_PATTERN) } ?: journalId
                events += saved.getValue("events").jsonArray.map { it.jsonObject }.filter { valid(it) }.takeLast(500)
                pending = (saved["pending"] as? JsonObject)?.takeIf { receiverMatches }?.takeIf { report ->
                    report.text("reportId").matches(UUID_PATTERN) && (report["events"] as? JsonArray)?.let { rows -> rows.size in 1..500 && rows.all { valid(it.jsonObject) } } == true
                }
                mutable.value = mutable.value.copy(automatic = uploadAvailable && receiverMatches && (saved["automatic"]?.jsonPrimitive?.booleanOrNull ?: false),
                    queued = events.size, lastArchiveKey = saved["lastArchiveKey"]?.jsonPrimitive?.contentOrNull?.takeIf { it.length in 1..2048 && it.none { c -> c.isISOControl() } }, lastReportId = saved["lastReportId"]?.jsonPrimitive?.contentOrNull?.takeIf { it.matches(UUID_PATTERN) }, lastUploadedAt = saved["lastUploadedAt"]?.jsonPrimitive?.longOrNull ?: 0)
                if (!receiverMatches) { pending = null; journalId = UUID.randomUUID().toString(); mutable.update { it.copy(lastReportId = null, lastArchiveKey = null, lastUploadedAt = 0) } }
            } catch (_: java.io.FileNotFoundException) { /* First launch. */ }
            catch (_: Exception) { mutable.value = mutable.value.copy(error = "日志缓存读取失败，已重新开始记录") }
            if (mutable.value.computerId.isEmpty() && uploader == null) mutable.update { it.copy(lastReportId = null, lastArchiveKey = null, lastUploadedAt = 0) }
            ready.complete(Unit)
        }
        for (entry in input) journal.withLock {
            entry.barrier?.let { persist(); it.complete(Unit); return@withLock }
            val event = entry.event ?: return@withLock
            if (!valid(event, stored = false)) return@withLock
            val now = System.currentTimeMillis()
            val cutoff = now - 7 * 86400_000L
            events.removeAll { (it["at"]?.jsonPrimitive?.longOrNull ?: 0) < cutoff }
            if (pending?.get("events")?.jsonArray?.any { it.jsonObject.number("at") < cutoff } == true) pending = null
            events += JsonObject(event + mapOf("seq" to JsonPrimitive(++sequence), "network" to JsonPrimitive(network()), "build" to JsonPrimitive(versionCode)))
            while (events.size > 500) {
                val protectedEnd = pending?.get("events")?.jsonArray?.lastOrNull()?.jsonObject?.number("seq") ?: -1
                events.removeAt(events.indexOfFirst { it.number("seq") > protectedEnd }.coerceAtLeast(0))
            }
            mutable.update { it.copy(queued = events.size) }
            persistJob?.cancel()
            if (event.text("stage").endsWith("failure") || event.text("stage") == "session.retry") persist()
            else persistJob = scope.launch { delay(500); journal.withLock { persist() } }
        }
    } }
    private fun valid(event: JsonObject, stored: Boolean = true): Boolean = runCatching {
        event.keys == setOf("at", "stage", "trace", "endpoint", "durationMs", "status", "code", "attempt") + (if (stored) setOf("seq", "network", "build") else emptySet()) + (if ("runtime" in event) setOf("runtime") else emptySet()) &&
            (!("runtime" in event) || (event["runtime"] as? JsonObject)?.let(Diagnostics::validRuntime) == true) &&
            event.text("stage") in Diagnostics.stages && event.text("endpoint") in Diagnostics.endpoints && event.text("code") in Diagnostics.codes &&
            event.text("trace").matches(UUID_PATTERN) && event.number("at") in 0..4102444800000 && event.number("durationMs") in 0..3600000 &&
            event.number("status") in 0..599 && event.number("attempt") in 0..1000 && (!stored || event.number("seq") >= 0 && event.text("network") in NETWORKS && event.number("build") in 1..1000000)
    }.getOrDefault(false)
    private fun network(): String = runCatching {
        val caps = connectivity.getNetworkCapabilities(connectivity.activeNetwork) ?: return "offline"
        when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "vpn"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            else -> "unknown"
        }
    }.getOrDefault("unknown")
    fun record(event: JsonObject) { input.trySend(JournalInput(event = event)) }
    fun resume() {
        if (automaticJob?.isActive == true) return
        automaticJob = scope.launch {
            ready.await(); var backoff = 3_000L
            while (isActive) {
                delay(backoff)
                if (mutable.value.automatic && mutable.value.queued > 0) {
                    uploadAll()
                    backoff = if (mutable.value.error == null) 60_000L else (backoff * 2).coerceAtMost(15 * 60_000L)
                }
            }
        }
    }
    fun pause() { automaticJob?.cancel(); scope.launch { flush() } }
    suspend fun configureComputer(deviceId: String): Boolean = draining.withLock { uploads.withLock {
        ready.await()
        if (deviceId.isBlank() || deviceId.length > 200) return@withLock false
        configureComputerLocked(deviceId)
    } }
    private suspend fun configureComputerLocked(deviceId: String): Boolean = journal.withLock {
            if (deviceId == mutable.value.computerId) return@withLock true
            pending = null; journalId = UUID.randomUUID().toString()
            mutable.update { it.copy(computerId = deviceId, automatic = false, lastReportId = null, lastArchiveKey = null, lastUploadedAt = 0, error = null) }
            persist()
    }
    suspend fun automaticForComputer(deviceId: String, enabled: Boolean) = draining.withLock { uploads.withLock {
        ready.await()
        if (deviceId.isBlank() || deviceId.length > 200) return@withLock
        if (enabled) configureComputerLocked(deviceId)
        if (mutable.value.computerId == deviceId) automatic(enabled)
    } }
    suspend fun automatic(enabled: Boolean) {
        ready.await()
        journal.withLock {
            mutable.update { it.copy(automatic = enabled && uploadAvailable,
                error = if (enabled && !uploadAvailable) "请先选择已配对电脑，日志仍保存在本机" else it.error) }
            persist()
        }
    }
    suspend fun upload(force: Boolean = false) = uploads.withLock {
        ready.await()
        if (!uploadAvailable) {
            mutable.update { it.copy(error = "请先选择已配对电脑，日志仍保存在本机") }
            return@withLock
        }
        val report = journal.withLock {
            if (!force && !mutable.value.automatic) return@withLock null
            if (pending == null) {
                if (events.isEmpty()) return@withLock null
                pending = buildJsonObject {
                    val batch = hourlyDiagnosticBatch(events)
                    put("schema", 2); put("reportId", UUID.randomUUID().toString()); put("appVersion", appVersion); put("versionCode", versionCode)
                    put("sdk", Build.VERSION.SDK_INT); put("journalId", journalId)
                    put("hour", diagnosticHour(batch.first())); put("part", diagnosticPart(batch.first()))
                    put("events", JsonArray(batch))
                }
                if (!persist()) { pending = null; return@withLock null }
            }
            pending
        } ?: return@withLock
        mutable.update { it.copy(uploading = true, error = null) }
        try {
            val receipt = uploader?.invoke(report) ?: computerUploader?.invoke(mutable.value.computerId, report) ?: throw IOException()
            if (receipt.text("reportId") != report.text("reportId") || receipt.number("accepted") != report.getValue("events").jsonArray.size.toLong()) throw IOException("receipt")
            journal.withLock {
                val end = report.getValue("events").jsonArray.last().jsonObject.number("seq")
                events.removeAll { it.number("seq") <= end }; pending = null
                val archiveKey = if (report["schema"]?.jsonPrimitive?.intOrNull == 2) diagnosticArchiveKey(report.text("journalId"), report.number("hour"), report.number("part")) else null
                mutable.update { it.copy(lastReportId = receipt.text("reportId"), lastArchiveKey = receipt["localPath"]?.jsonPrimitive?.contentOrNull?.takeIf { it.length in 1..2048 && it.none { c -> c.isISOControl() } } ?: archiveKey, lastUploadedAt = System.currentTimeMillis(), queued = events.size) }
                persist()
            }
        } catch (cancel: CancellationException) { throw cancel }
        catch (_: Exception) { mutable.update { it.copy(error = "上传未完成，日志已保留，请确认接收电脑在线、已连接并安装兼容插件后重试") } }
        finally { mutable.update { it.copy(uploading = false) } }
    }
    /** Drain the queue as it existed at the button tap/resume, at most five hour/part requests of up to 500 events.
     * Transport batches append to the receiving computer’s hour archive.
     * New network log events cannot turn this into an endless upload loop. */
    suspend fun uploadAll(force: Boolean = false, computerId: String? = null) = draining.withLock {
        ready.await()
        if (computerId != null) {
            if (computerId.isBlank() || computerId.length > 200) return@withLock
            uploads.withLock { configureComputerLocked(computerId) }
        }
        flush()
        val target = journal.withLock { events.lastOrNull()?.number("seq") } ?: return@withLock
        repeat(5) {
            if (!journal.withLock { events.any { it.number("seq") <= target } }) return@withLock
            upload(force)
            if (mutable.value.error != null || (!force && !mutable.value.automatic)) return@withLock
        }
    }
    suspend fun clear() = draining.withLock { uploads.withLock {
        flush()
        journal.withLock {
            persistJob?.cancel(); events.clear(); pending = null; sequence = 0
            journalId = UUID.randomUUID().toString(); mutable.value = DiagnosticState(computerId = mutable.value.computerId)
            if (!persist()) throw GatewayFailure("storage-unavailable")
        }
    } }
    private fun readBounded(input: java.io.InputStream, limit: Int): ByteArray {
        val output = java.io.ByteArrayOutputStream(); val buffer = ByteArray(4096)
        while (true) { val count = input.read(buffer); if (count < 0) break; if (output.size() + count > limit) throw IOException(); output.write(buffer, 0, count) }
        return output.toByteArray()
    }
    private fun persist(): Boolean {
        var stream: java.io.FileOutputStream? = null
        return try {
            stream = file.startWrite()
            stream.write(buildJsonObject {
                put("uploadPolicyVersion", 4); put("computerId", mutable.value.computerId); put("sequence", sequence); put("journalId", journalId); put("automatic", mutable.value.automatic); put("events", JsonArray(events))
                put("lastArchiveKey", mutable.value.lastArchiveKey?.let(::JsonPrimitive) ?: JsonNull)
                put("pending", pending ?: JsonNull); put("lastReportId", mutable.value.lastReportId?.let(::JsonPrimitive) ?: JsonNull); put("lastUploadedAt", mutable.value.lastUploadedAt)
            }.toString().toByteArray())
            file.finishWrite(stream); true
        } catch (_: Exception) { file.failWrite(stream); mutable.update { it.copy(error = "日志缓存保存失败") }; false }
    }
    suspend fun flush() {
        ready.await()
        val barrier = CompletableDeferred<Unit>()
        input.send(JournalInput(barrier = barrier)); barrier.await()
    }
    fun close() { automaticJob?.cancel(); scope.cancel() }
    companion object {
        private val UUID_PATTERN = Regex("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")
        private val NETWORKS = setOf("unknown", "wifi", "cellular", "ethernet", "vpn", "offline")
    }
}
