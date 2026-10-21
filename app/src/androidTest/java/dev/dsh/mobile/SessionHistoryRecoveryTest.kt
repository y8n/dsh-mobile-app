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

class SessionHistoryRecoveryTest {
    private class Gateway(val requestId: String, val hold: Boolean) : DeviceGateway {
        val frames = Channel<JsonObject>(Channel.UNLIMITED); val pageStarted = CompletableDeferred<Unit>(); val release = CompletableDeferred<Unit>()
        val reads = java.util.concurrent.CopyOnWriteArrayList<JsonObject>(); var prompts = 0
        fun event(seq: Int) = buildJsonObject { put("type", "event"); put("event", buildJsonObject {
            put("seq", seq); put("type", if (seq == 4) "user/message" else "test/history"); put("ignorable", true)
            put("data", if (seq == 4) buildJsonObject { put("content", buildJsonArray { add(buildJsonObject { put("type", "text"); put("text", "uncertain draft") }) }); put("source", buildJsonObject { put("rpcId", requestId) }) } else JsonObject(emptyMap()))
        }) }
        fun snapshot(start: Int, end: Int) = buildJsonObject { put("type", "snapshot"); put("header", buildJsonObject { put("id", "owned") }); put("cursor", end); put("records", JsonArray((start..end).map(::event))); put("hasMore", start > 0); put("projections", buildJsonObject { put("asOfSeq", end); put("values", JsonObject(emptyMap())) }) }
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow { emit(WireJson.parseToJsonElement("""{"type":"baseline","value":{"items":[]}}""").jsonObject); awaitCancellation() }
        override fun follow(endpoint: String, args: JsonObject) = flow {
            if (endpoint == "session/follow") { emit(snapshot(0, 2)); for (frame in frames) emit(frame) }
            else { emit(WireJson.parseToJsonElement("""{"type":"baseline","value":{"projections":{}}}""").jsonObject); awaitCancellation() }
        }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            if (method == "session/prompt") prompts++
            if (method != "session/page") return JsonObject(emptyMap())
            reads += args.getValue("request").jsonObject; pageStarted.complete(Unit)
            if (hold && reads.size == 1) release.await()
            return buildJsonObject { put("records", JsonArray((3..7).map(::event))); put("hasMore", true) }
        }
    }
    private suspend fun exercise(hold: Boolean) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext; val storageScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val file = File(context.cacheDir, "history-recovery-${UUID.randomUUID()}.preferences_pb"); val store = DeviceStore(PreferenceDataStoreFactory.create(scope = storageScope) { file }); val requestId = UUID.randomUUID().toString()
        store.update { StoredDevices(listOf(DeviceCredential("a", "a", "https://a.example", "0".repeat(64), "a", "fixture-only", Long.MAX_VALUE)), drafts = listOf(ConversationDraft("a", "owned", "uncertain draft", requestId, "uncertain draft", 1, 1))) }
        val gateway = Gateway(requestId, hold); val devices = DeviceRepository(store) { gateway }; val session = devices.conversations()
        try {
            withTimeout(10_000) { devices.state.first { it.loaded } }; devices.select("a"); withTimeout(10_000) { devices.state.first { it.connected } }; session.open("owned"); withTimeout(10_000) { session.state.first { it.connected } }
            assertEquals(requestId, session.state.value.pendingRequestId)
            gateway.frames.send(gateway.snapshot(8, 10))
            if (hold) {
                withTimeout(10_000) { gateway.pageStarted.await() }; gateway.frames.send(gateway.snapshot(8, 12)); withTimeout(10_000) { session.state.first { it.timeline.cursor == 12L } }; gateway.release.complete(Unit)
            }
            withTimeout(10_000) { session.state.first { !it.timeline.hasHistoryGap && it.pendingRequestId == null } }
            assertEquals((0L..if (hold) 12L else 10L).toSet(), session.state.value.timeline.events.keys)
            assertEquals("", session.state.value.draft); assertEquals(0, gateway.prompts)
            assertTrue(gateway.reads.all { it.number("beforeSeq") == 8L }); assertEquals(if (hold) listOf(10L, 12L) else listOf(10L), gateway.reads.map { it.number("throughSeq") })
            withTimeout(10_000) { while (store.read().drafts.single().pendingRequestId != null) delay(20) }
        } finally { gateway.release.complete(Unit); devices.close(); storageScope.cancel() }
    }
    @Test fun reconnectGapBackfillFindsTheUncertainSendWithoutReplayingIt() = runBlocking { exercise(false) }
    @Test fun newSnapshotAtTheSameBoundaryRetriesWithTheNewCutInsteadOfAcceptingStalePage() = runBlocking { exercise(true) }
}
