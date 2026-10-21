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

class CommandAvailabilityTest {
    private class Gateway : DeviceGateway {
        var compact = true; var failRead = false; var hold = false
        val started = CompletableDeferred<Unit>(); val release = CompletableDeferred<Unit>()
        val events = MutableSharedFlow<JsonObject>(extraBufferCapacity = 8)
        val requests = java.util.concurrent.CopyOnWriteArrayList<JsonObject>()
        var writes = 0
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow {
            emit(WireJson.parseToJsonElement("""{"type":"baseline","value":{"items":[]}}""").jsonObject); awaitCancellation()
        }
        override fun follow(endpoint: String, args: JsonObject) = flow {
            when (endpoint) {
                "session/follow" -> emit(buildJsonObject {
                    put("type", "snapshot"); put("cursor", -1); put("records", JsonArray(emptyList())); put("hasMore", false)
                    put("header", buildJsonObject { put("id", args.getValue("request").jsonObject.getValue("address").jsonObject.getValue("sessionId")) })
                    put("projections", buildJsonObject { put("asOfSeq", -1); put("values", JsonObject(emptyMap())) })
                })
                "session/control" -> emit(WireJson.parseToJsonElement("""{"type":"baseline","value":{"projections":{}}}""").jsonObject)
                "\$events" -> { emit(WireJson.parseToJsonElement("""{"type":"ready","clientId":"commands-fixture"}""").jsonObject); emitAll(events) }
                else -> error(endpoint)
            }
            awaitCancellation()
        }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            if (mutation) { writes++; error("Unexpected fixture write") }
            assertEquals("commands/list", method); requests += args
            if (hold) { started.complete(Unit); withContext(NonCancellable) { release.await() } }
            if (failRead) throw GatewayFailure("network-unavailable")
            return buildJsonArray { if (compact) add(buildJsonObject { put("name", "compact"); put("description", "Compact context") }) }
        }
    }
    private suspend fun fixture(block: suspend (DeviceRepository, Gateway, Gateway) -> Unit) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = scope) { File(context.cacheDir, "commands-${UUID.randomUUID()}.preferences_pb") })
        store.update { StoredDevices(listOf("a", "b").map { DeviceCredential(it, it, "https://$it.example", "0".repeat(64), it, "fixture-only", Long.MAX_VALUE) }) }
        val a = Gateway(); val b = Gateway(); val repo = DeviceRepository(store) { if (it.id == "a") a else b }
        try {
            withTimeout(10_000) { repo.state.first { it.loaded } }; repo.select("a"); withTimeout(10_000) { repo.state.first { it.connected } }
            repo.conversations().acquireView("owned-a"); withTimeout(10_000) { repo.conversations().state.first { it.connected } }
            block(repo, a, b)
        } finally { a.release.complete(Unit); b.release.complete(Unit); repo.close(); scope.cancel() }
    }
    @Test fun catalogReadUsesExactAgentAndDistinguishesAvailableUnavailableAndReadFailure() = runBlocking {
        fixture { repo, a, _ ->
            val session = repo.conversations(); session.loadCommands()
            assertTrue(session.state.value.compactAvailable == true); assertEquals("owned-a", a.requests.single().string("agentId"))
            a.compact = false; session.loadCommands(); assertFalse(session.state.value.compactAvailable!!)
            a.failRead = true; session.loadCommands(); assertNull(session.state.value.compactAvailable)
            assertEquals("network-unavailable", session.state.value.commandsError); assertFalse(session.state.value.commandsLoading)
            a.failRead = false; session.loadCommands(); assertFalse(session.state.value.compactAvailable!!); assertNull(session.state.value.commandsError); assertEquals(0, a.writes)
        }
    }
    @Test fun lateCatalogFromPreviousDeviceCannotEnableNewDeviceCompaction() = runBlocking {
        fixture { repo, a, b ->
            val session = repo.conversations(); a.hold = true
            val old = async { session.loadCommands() }; withTimeout(10_000) { a.started.await() }
            repo.select("b"); withTimeout(10_000) { repo.state.first { it.connected && it.selectedId == "b" } }
            session.acquireView("owned-b"); withTimeout(10_000) { session.state.first { it.connected && it.sessionId == "owned-b" } }
            b.compact = false; session.loadCommands(); a.release.complete(Unit); old.await()
            assertEquals("owned-b", session.state.value.sessionId); assertFalse(session.state.value.compactAvailable!!)
            assertEquals(0, a.writes); assertEquals(0, b.writes)
        }
    }
}
