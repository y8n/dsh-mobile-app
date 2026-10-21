package dev.dsh.mobile

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.*
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.UUID

class ScheduleSafetyTest {
    private class Fake : DeviceGateway {
        val started = CompletableDeferred<Unit>(); val release = CompletableDeferred<Unit>()
        val mutations = java.util.concurrent.CopyOnWriteArrayList<Pair<String, JsonObject>>()
        val results = mutableMapOf<String, JsonObject>(); var effects = 0
        var hold = false; var loseAck = false; var malformed = false; var supported = true
        fun entry(session: String, id: String = "task-$session") = buildJsonObject { put("id", id); put("sessionId", session); put("title", "owned"); put("prompt", "test"); put("kind", "every"); put("everySeconds", 60); put("scheduledAt", "2030-01-01T00:00:00.000Z"); put("status", "active"); put("version", "0".repeat(64)) }
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow { emit(buildJsonObject { put("type", "baseline"); put("value", buildJsonObject { put("items", JsonArray(emptyList())) }) }); awaitCancellation() }
        override fun follow(endpoint: String, args: JsonObject) = flow { emit(buildJsonObject { put("type", "ready"); put("clientId", "test") }); awaitCancellation() }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            if (method == "mobileSchedule/capabilities") {
                if (!supported) throw GatewayFailure("gateway/invocation-unavailable")
                return buildJsonObject { put("version", 1); put("lifecycle", true); put("durableRequestIdentity", true) }
            }
            if (method.endsWith("/catalog")) return buildJsonArray { add(entry("old")); add(entry("new")) }
            if (!mutation) throw GatewayFailure("unexpected-method")
            mutations += method to args
            if (hold) { started.complete(Unit); withContext(NonCancellable) { release.await() } }
            val request = args.getValue("request").jsonObject; val id = request.string("requestId")
            val result = results.getOrPut(id) { effects++; buildJsonObject { put("entry", entry(request.string("sessionId"), request.text("id").ifBlank { "created-$effects" })) } }
            if (loseAck) { loseAck = false; throw GatewayFailure("result-unknown") }
            if (malformed) { malformed = false; return buildJsonObject { put("entry", JsonNull) } }
            return result
        }
    }
    private suspend fun setup(block: suspend CoroutineScope.(DeviceStore, DeviceRepository, ScheduleRepository, Fake, Fake) -> Unit) = coroutineScope {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO); val context = InstrumentationRegistry.getInstrumentation().targetContext
        val file = File(context.cacheDir, "schedule-${UUID.randomUUID()}.preferences_pb")
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = scope) { file })
        store.update { StoredDevices(listOf("a", "b").map { DeviceCredential(it, it, "https://$it.example", "0".repeat(64), it, "test-only", Long.MAX_VALUE) }) }
        val a = Fake(); val b = Fake(); val devices = DeviceRepository(store) { if (it.id == "a") a else b }; val repo = devices.schedules()
        try {
            withTimeout(5_000) { devices.state.first { it.loaded } }; devices.select("a"); withTimeout(5_000) { devices.state.first { it.connected } }; repo.show("old")
            withTimeout(5_000) { repo.state.first { it.supported && !it.loading && it.entries.isNotEmpty() } }
            block(store, devices, repo, a, b)
        } finally { a.release.complete(Unit); b.release.complete(Unit); devices.close(); scope.cancel() }
    }
    private val definition = buildJsonObject { put("title", "owned"); put("prompt", "test"); put("every_seconds", 60) }
    private suspend fun boundary(switchDevice: Boolean) = setup { _, devices, repo, a, b ->
        val observed = repo.state.value.entries.single(); a.hold = true
        val first = async { repo.create(definition) }; withTimeout(5_000) { a.started.await() }
        val queued = async(start = CoroutineStart.UNDISPATCHED) { try { repo.change("pause", observed); "executed" } catch (e: GatewayFailure) { e.code } }
        if (switchDevice) { devices.select("b"); withTimeout(5_000) { devices.state.first { it.connected && it.selectedId == "b" } } }
        repo.show("new"); withTimeout(5_000) { repo.state.first { it.sessionId == "new" && it.supported && !it.loading } }
        a.release.complete(Unit); first.await(); assertEquals("device-changed", queued.await()); assertEquals(1, a.mutations.size); assertTrue(b.mutations.isEmpty()); assertNull(repo.state.value.error)
    }
    @Test fun queuedWriteCannotCrossDevice() = runBlocking { boundary(true) }
    @Test fun queuedWriteCannotCrossSession() = runBlocking { boundary(false) }
    @Test fun uncertaintyIsRestoredWithoutAutoReplayAndExplicitRetryKeepsOriginalIdentity() = runBlocking { setup { store, _, repo, a, _ ->
        a.loseAck = true
        try { repo.create(definition); fail("lost acknowledgement accepted") } catch (e: GatewayFailure) { assertEquals("result-unknown", e.code) }
        val pending = store.read().scheduleWrites.single(); repo.hide(); repo.show("old")
        withTimeout(5_000) { repo.state.first { it.pending != null && !it.loading } }; assertEquals(1, a.mutations.size)
        repo.reconcile(); assertEquals(2, a.mutations.size); assertEquals(a.mutations[0].second, a.mutations[1].second); assertEquals(pending.request, a.mutations[1].second.getValue("request")); assertEquals(1, a.effects); assertTrue(store.read().scheduleWrites.isEmpty())
    } }
    @Test fun malformedAcknowledgementDoesNotDiscardPendingIdentity() = runBlocking { setup { store, _, repo, a, _ ->
        a.malformed = true
        try { repo.create(definition); fail("invalid response accepted") } catch (e: GatewayFailure) { assertEquals("schedule-result-unknown", e.code) }
        assertEquals(1, store.read().scheduleWrites.size); repo.reconcile(); assertEquals(1, a.effects); assertTrue(store.read().scheduleWrites.isEmpty())
    } }
    @Test fun absentExtensionPermitsReadOnlyCatalogButNeverMutation() = runBlocking { setup { _, _, repo, a, _ ->
        a.supported = false; repo.hide(); repo.show("old"); withTimeout(5_000) { repo.state.first { !it.loading && !it.supported && it.entries.isNotEmpty() } }
        try { repo.create(definition); fail("unsupported write admitted") } catch (e: GatewayFailure) { assertEquals("schedule-extension-required", e.code) }; assertTrue(a.mutations.isEmpty())
    } }
    @Test fun staleDisplayedRowCannotCrossDeviceEvenWithIdenticalSessionAndTaskIds() = runBlocking { setup { _, devices, repo, a, b ->
        val old = repo.state.value.entries.single()
        devices.select("b"); withTimeout(5_000) { devices.state.first { it.connected && it.selectedId == "b" } }; repo.show("old")
        withTimeout(5_000) { repo.state.first { it.deviceId == "b" && it.supported && !it.loading } }
        assertEquals(old.string("id"), repo.state.value.entries.single().string("id"))
        try { repo.change("pause", old); fail("stale displayed action admitted") } catch (e: GatewayFailure) { assertEquals("device-changed", e.code) }
        try { repo.create(definition, "a", "old"); fail("stale create callback admitted") } catch (e: GatewayFailure) { assertEquals("device-changed", e.code) }
        assertTrue(a.mutations.isEmpty()); assertTrue(b.mutations.isEmpty())
    } }
}
