package dev.dsh.mobile

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.*
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.UUID

/** Independent stream ordering is injected through the real repository and
 * encrypted device store. This is controlled evidence, not a Desktop run. */
class SessionProjectionOrderTest {
    private class Gateway : DeviceGateway {
        val history = Channel<JsonObject>(Channel.UNLIMITED); val control = Channel<JsonObject>(Channel.UNLIMITED)
        override suspend fun probe() = Unit
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement = JsonObject(emptyMap())
        override fun close() { history.close(); control.close() }
        override fun followWorkspaces() = flow { emit(WireJson.parseToJsonElement("""{"type":"baseline","value":{"items":[]}}""").jsonObject); awaitCancellation() }
        override fun follow(endpoint: String, args: JsonObject) = flow {
            val channel = when (endpoint) { "session/follow" -> history; "session/control" -> control; else -> null }
            if (channel == null) awaitCancellation() else for (frame in channel) emit(frame)
        }
    }
    private fun snapshot(seq: Int, values: String) = WireJson.parseToJsonElement("""{"type":"snapshot","header":{"id":"owned"},"cursor":$seq,"records":[],"hasMore":false,"projections":{"asOfSeq":$seq,"values":$values}}""").jsonObject
    private fun field(key: String, value: String, seq: Int) = buildJsonObject { put("type", "projection"); put("sessionId", "owned"); put("key", key); put("value", value); put("seq", seq) }
    @Test fun crossingStreamsPreserveNewTitleAndStillUpdatePermissionsAndStatistics() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext; val storageScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val file = File(context.cacheDir, "projection-order-${UUID.randomUUID()}.preferences_pb")
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = storageScope) { file })
        store.update { StoredDevices(listOf(DeviceCredential("owned", "owned", "https://owned.example", "0".repeat(64), "owned", "fixture-only", Long.MAX_VALUE))) }
        val gateway = Gateway(); val devices = DeviceRepository(store) { gateway }; val session = devices.conversations()
        suspend fun awaitState(test: (ConversationState) -> Boolean) = withTimeout(10_000) { session.state.first(test) }
        try {
            withTimeout(10_000) { devices.state.first { it.loaded } }; devices.select("owned"); withTimeout(10_000) { devices.state.first { it.connected } }; session.open("owned")
            gateway.history.send(snapshot(10, """{"title":"initial","permissions":"old","stats":"old"}""")); awaitState { it.connected }
            gateway.control.send(field("title", "new title", 30)); awaitState { it.projections.text("title") == "new title" }
            gateway.control.send(field("permissions", "read-only", 20)); awaitState { it.projections.text("permissions") == "read-only" }
            gateway.history.send(snapshot(20, """{"title":"stale title","permissions":"read-only","stats":"updated"}""")); awaitState { it.projections.text("stats") == "updated" }
            assertEquals("new title", session.state.value.projections.text("title"))
            gateway.control.send(field("permissions", "stale", 19)); gateway.control.send(field("title", "replayed", 30)); gateway.control.send(field("barrier", "processed", 31)); awaitState { it.projections.text("barrier") == "processed" }
            assertEquals("new title", session.state.value.projections.text("title")); assertEquals("read-only", session.state.value.projections.text("permissions"))
            gateway.control.send(WireJson.parseToJsonElement("""{"type":"baseline","value":{"projections":{"owned":{"asOfSeq":25,"values":{"title":"stale","permissions":"current"}}}}}""").jsonObject)
            awaitState { it.projections["stats"] == null && it.projections.text("permissions") == "current" }
            assertEquals("new title", session.state.value.projections.text("title")); assertEquals("processed", session.state.value.projections.text("barrier")); assertNull(session.state.value.error)
        } finally { devices.close(); storageScope.cancel() }
    }
}
