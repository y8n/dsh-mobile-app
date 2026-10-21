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

class InteractionLifecycleTest {
    private class Fake : DeviceGateway {
        val frames = MutableSharedFlow<JsonObject>(extraBufferCapacity = 16)
        val active = java.util.concurrent.ConcurrentHashMap<String, JsonObject>()
        val replies = java.util.concurrent.CopyOnWriteArrayList<JsonObject>()
        var clients = 0; var loseAcknowledgement = false
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow { emit(buildJsonObject { put("type", "baseline"); put("value", buildJsonObject { put("items", JsonArray(emptyList())) }) }); awaitCancellation() }
        override fun follow(endpoint: String, args: JsonObject) = flow {
            emit(buildJsonObject { put("type", "ready"); put("clientId", "client-${++clients}") })
            active.values.toList().forEach { emit(it) }
            frames.collect { emit(it) }
        }
        suspend fun request(id: String, owner: String = "session") {
            // Ready reaches the controller before the fake flow necessarily
            // subscribes. A zero-replay SharedFlow drops an earlier injection.
            withTimeout(5_000) { frames.subscriptionCount.first { it > 0 } }
            val frame = buildJsonObject { put("type", "waterfall"); put("event", "approval/request"); put("eventId", id); put("agentId", owner); put("request", buildJsonObject { put("toolName", "bash"); put("reason", "test") }) }
            active[id] = frame; frames.emit(frame)
        }
        suspend fun cancel(id: String) { active.remove(id); frames.emit(buildJsonObject { put("type", "cancel"); put("eventId", id) }) }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            if (method == "\$events/result") {
                replies += args
                if (args.getValue("outcome").jsonObject.text("kind") == "result") {
                    active.remove(args.text("eventId"))
                    if (loseAcknowledgement) { loseAcknowledgement = false; throw GatewayFailure("result-unknown") }
                }
            }
            return JsonNull
        }
    }
    private suspend fun fixture(body: suspend (SessionInteractions, Fake) -> Unit) {
        val storageScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = storageScope) { File(context.cacheDir, "events-${UUID.randomUUID()}.preferences_pb") })
        store.update { StoredDevices(listOf(DeviceCredential("device", "test", "https://test.example", "0".repeat(64), "device", "test-only", Long.MAX_VALUE))) }
        val fake = Fake(); val devices = DeviceRepository(store) { fake }; val interactions = SessionInteractions(devices)
        try {
            withTimeout(5_000) { devices.state.first { it.loaded } }; devices.select("device")
            withTimeout(5_000) { devices.state.first { it.connected } }; interactions.open("device", "session")
            withTimeout(5_000) { interactions.state.first { it.clientId != null } }
            body(interactions, fake)
        } finally { interactions.close(); devices.close(); storageScope.cancel() }
    }
    @Test fun otherSessionsAreDelegatedAndCancelledApprovalCannotBeAnswered() = runBlocking {
        fixture { controller, fake ->
            fake.request("other", "another-session")
            withTimeout(5_000) { while (fake.replies.none { it.text("eventId") == "other" }) delay(10) }
            assertEquals("next", fake.replies.single().getValue("outcome").jsonObject.text("kind"))
            assertTrue(controller.state.value.pending.isEmpty())
            fake.cancel("other"); delay(50); assertNull(controller.state.value.status)
            fake.request("own"); withTimeout(5_000) { controller.state.first { "own" in it.pending } }
            fake.cancel("own"); withTimeout(5_000) { controller.state.first { "own" !in it.pending } }
            try { controller.answer("own", JsonPrimitive("allowed-once")); fail("withdrawn request") }
            catch (error: GatewayFailure) { assertEquals("request-withdrawn", error.code) }
            assertEquals(1, fake.replies.size)
        }
    }
    @Test fun lostDecisionAcknowledgementReconcilesPendingRequestsWithoutReplayingDecision() = runBlocking {
        fixture { controller, fake ->
            fake.request("own"); withTimeout(5_000) { controller.state.first { "own" in it.pending } }
            val oldClient = controller.state.value.clientId; fake.loseAcknowledgement = true
            try { controller.answer("own", JsonPrimitive("allowed-once")); fail("unknown result") }
            catch (error: GatewayFailure) { assertEquals("result-unknown", error.code) }
            withTimeout(5_000) { controller.state.first { it.clientId != null && it.clientId != oldClient } }
            assertTrue(controller.state.value.pending.isEmpty()); assertEquals(1, fake.replies.size)
        }
    }
}
