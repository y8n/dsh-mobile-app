package dev.dsh.mobile.data

import dev.dsh.mobile.protocol.*
import kotlinx.serialization.Serializable
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption.*
import java.time.LocalDate

@Serializable data class LocalDeviceData(val pins: Map<String, List<String>> = emptyMap(), val usage: Map<String, Map<String, Long>> = emptyMap())
/** Separate disposable data file; this class has no reference to the credential vault. */
class LocalDeviceDataRepository(private val directory: File, private val wall: () -> Long = System::currentTimeMillis,
    private val elapsed: () -> Long = { System.nanoTime() / 1_000_000 }) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val queue = Channel<suspend () -> Unit>(Channel.UNLIMITED)
    private val file = File(directory, "device-data.json")
    private val clock = DeviceUsageClock()
    private var focus: String? = null
    private var allowed: Set<String>? = null
    private val mutable = MutableStateFlow(LocalDeviceData())
    val state = mutable.asStateFlow()
    init { scope.launch {
        if (file.isFile) runCatching { WireJson.decodeFromString(LocalDeviceData.serializer(), file.readText()) }.onSuccess { mutable.value = it }
        for (work in queue) try { work() } catch (cancel: CancellationException) { throw cancel } catch (_: Exception) { /* Disposable data failures must not terminate connection/UI work. */ }
    } }
    private suspend fun <T> command(block: () -> T): T {
        val done = CompletableDeferred<T>()
        queue.send { try { done.complete(block()) } catch (error: Exception) { done.completeExceptionally(error) } }
        return done.await()
    }
    private fun save(next: LocalDeviceData) {
        directory.mkdirs(); val temp = File(directory, "device-data.tmp")
        FileOutputStream(temp).use { it.write(WireJson.encodeToString(LocalDeviceData.serializer(), next).toByteArray()); it.fd.sync() }
        Files.move(temp.toPath(), file.toPath(), ATOMIC_MOVE, REPLACE_EXISTING)
        mutable.value = next
    }
    private fun tick(next: String?, now: Long, mono: Long) {
        val rows = clock.checkpoint(next, now, mono); focus = clock.currentDevice
        if (rows.isEmpty()) return
        val usage = mutable.value.usage.mapValues { it.value.toMutableMap() }.toMutableMap()
        rows.forEach { row -> val days = usage.getOrPut(row.deviceId) { mutableMapOf() }; days[row.date] = (days[row.date] ?: 0) + row.milliseconds }
        val cutoff = LocalDate.now().minusDays(365).toString()
        save(mutable.value.copy(usage = usage.mapValues { (_, days) -> days.filterKeys { it >= cutoff } }))
    }
    fun foreground(device: String?) { val now = wall(); val mono = elapsed(); queue.trySend { tick(device?.takeIf { allowed?.contains(it) != false }, now, mono) } }
    fun retainDevices(ids: Set<String>) { queue.trySend { allowed = ids; if (focus !in ids) { focus = null; clock.checkpoint(null, wall(), elapsed()) }; val next = mutable.value.copy(pins = mutable.value.pins.filterKeys { it in ids }, usage = mutable.value.usage.filterKeys { it in ids }); if (next != mutable.value) save(next) } }
    suspend fun focus(device: String?) { val now = wall(); val mono = elapsed(); command { tick(device?.takeIf { allowed?.contains(it) != false }, now, mono) } }
    suspend fun checkpoint() { val now = wall(); val mono = elapsed(); command { tick(focus, now, mono) } }
    suspend fun pin(device: String, session: String, pinned: Boolean) = command {
        if (allowed?.contains(device) == false) throw GatewayFailure("device-not-found")
        val current = mutable.value.pins[device].orEmpty().filterNot { it == session }
        save(mutable.value.copy(pins = mutable.value.pins + (device to if (pinned) listOf(session) + current else current)))
    }
    suspend fun prune(device: String, sessions: Set<String>, stillCurrent: () -> Boolean = { true }) = command {
        if (!stillCurrent()) return@command
        val current = mutable.value.pins[device] ?: return@command
        val kept = current.filter { it in sessions }
        if (kept != current) save(mutable.value.copy(pins = mutable.value.pins + (device to kept)))
    }
    suspend fun remove(device: String) = command {
        if (focus == device) { focus = null; clock.checkpoint(null, wall(), elapsed()) }
        save(mutable.value.copy(pins = mutable.value.pins - device, usage = mutable.value.usage - device))
    }
    suspend fun clear(usage: Boolean = true, pins: Boolean = true) = command {
        if (usage) clock.reset(elapsed())
        save(mutable.value.copy(usage = if (usage) emptyMap() else mutable.value.usage, pins = if (pins) emptyMap() else mutable.value.pins))
    }
    suspend fun flush() = command { Unit }
    fun close() { scope.cancel() }
}
