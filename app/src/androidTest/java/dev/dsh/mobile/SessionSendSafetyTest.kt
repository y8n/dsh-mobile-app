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

class SessionSendSafetyTest {
    private class Gateway : DeviceGateway {
        val modelStarted = CompletableDeferred<Unit>(); val modelRelease = CompletableDeferred<Unit>()
        val promptStarted = CompletableDeferred<Unit>(); val promptRelease = CompletableDeferred<Unit>()
        val prompts = java.util.concurrent.CopyOnWriteArrayList<JsonObject>(); val history = Channel<JsonObject>(Channel.UNLIMITED)
        var holdPrompt = false; var unknown = false; var malformedReceipt = false
        var uploads = 0
        override suspend fun upload(sessionId: String, name: String, bytes: ByteArray): JsonObject {
            uploads++; throw GatewayFailure("result-unknown")
        }
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow { emit(WireJson.parseToJsonElement("""{"type":"baseline","value":{"items":[]}}""").jsonObject); awaitCancellation() }
        override fun follow(endpoint: String, args: JsonObject) = flow {
            if (endpoint == "session/follow") {
                val baseline = WireJson.parseToJsonElement("""{"type":"snapshot","cursor":-1,"records":[],"hasMore":false,"projections":{"asOfSeq":-1,"values":{}}}""").jsonObject
                emit(JsonObject(baseline + ("header" to buildJsonObject { put("id", args.getValue("request").jsonObject.getValue("address").jsonObject.getValue("sessionId")) })))
                for (frame in history) emit(frame)
            } else { emit(WireJson.parseToJsonElement("""{"type":"baseline","value":{"projections":{}}}""").jsonObject); awaitCancellation() }
        }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            if (method == "session/selectModel") { modelStarted.complete(Unit); modelRelease.await() }
            if (method == "session/prompt") {
                prompts += args.getValue("request").jsonObject; promptStarted.complete(Unit); if (holdPrompt) promptRelease.await(); if (unknown) throw GatewayFailure("result-unknown")
                return if (malformedReceipt) JsonObject(emptyMap()) else buildJsonObject { put("accepted", true) }
            }
            return JsonObject(emptyMap())
        }
        suspend fun admission() {
            val request = prompts.single()
            history.send(buildJsonObject { put("type", "event"); put("event", buildJsonObject {
                put("type", "user/message"); put("seq", 0); put("data", buildJsonObject { put("content", request.getValue("content")); put("source", buildJsonObject { put("rpcId", request.getValue("requestId")) }) })
            })
            })
        }
    }
    private suspend fun exercise(block: suspend CoroutineScope.(DeviceStore, Gateway, DeviceRepository) -> Unit) = coroutineScope {
        val context = InstrumentationRegistry.getInstrumentation().targetContext; val storageScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val file = File(context.cacheDir, "send-safety-${UUID.randomUUID()}.preferences_pb"); val store = DeviceStore(PreferenceDataStoreFactory.create(scope = storageScope) { file })
        store.update { StoredDevices(listOf(DeviceCredential("a", "a", "https://a.example", "0".repeat(64), "a", "fixture-only", Long.MAX_VALUE))) }
        val gateway = Gateway(); val devices = DeviceRepository(store) { gateway }
        try {
            withTimeout(10_000) { devices.state.first { it.loaded } }; devices.select("a"); withTimeout(10_000) { devices.state.first { it.connected } }; devices.conversations().open("owned")
            withTimeout(10_000) { devices.conversations().state.first { it.connected } }; block(store, gateway, devices)
        } finally { gateway.modelRelease.complete(Unit); gateway.promptRelease.complete(Unit); devices.close(); storageScope.cancel() }
    }
    @Test fun queuedSendKeepsClickedContentAndRapidSecondSendDoesNotDuplicate() = runBlocking { exercise { store, gateway, devices ->
        val session = devices.conversations(); val model = async { session.selectModel("p", "m") }; withTimeout(10_000) { gateway.modelStarted.await() }
        session.setDraft("clicked"); val send = async(start = CoroutineStart.UNDISPATCHED) { session.send() }; assertTrue(session.state.value.sending)
        session.setDraft("later draft"); try { session.send(); fail("Duplicate queued") } catch (e: GatewayFailure) { assertEquals("connection-required", e.code) }
        gateway.modelRelease.complete(Unit); model.await(); send.await()
        assertEquals("clicked", contentText(gateway.prompts.single().getValue("content"))); assertEquals("later draft", session.state.value.draft)
        gateway.admission(); withTimeout(10_000) { session.state.first { it.pendingRequestId == null } }; assertEquals("later draft", session.state.value.draft)
        withTimeout(10_000) { while (store.read().drafts.single().pendingRequestId != null) delay(20) }; assertEquals("later draft", store.read().drafts.single().text)
    } }
    @Test fun retypedIdenticalTextAfterClickSurvivesAcknowledgmentAndReconciliation() = runBlocking { exercise { _, gateway, devices ->
        val session = devices.conversations(); gateway.holdPrompt = true; session.setDraft("clicked"); val send = async { session.send() }
        withTimeout(10_000) { gateway.promptStarted.await() }; session.setDraft("different"); session.setDraft("clicked"); gateway.promptRelease.complete(Unit); send.await()
        gateway.admission(); withTimeout(10_000) { session.state.first { it.pendingRequestId == null } }; assertEquals("clicked", session.state.value.draft); assertEquals(1, gateway.prompts.size)
    } }
    @Test fun unknownSendRestoresEncryptedIdentityWithoutReplayAndClearsOnlyAdmittedDraft() = runBlocking { exercise { store, gateway, devices ->
        val session = devices.conversations(); gateway.unknown = true; session.setDraft("clicked")
        try { session.send(); fail("Unknown result expected") } catch (e: GatewayFailure) { assertEquals("result-unknown", e.code) }
        val id = session.state.value.pendingRequestId; assertNotNull(id); assertNotNull(store.read().drafts.single().pendingDraftRevision); devices.close()
        val restored = DeviceRepository(store) { gateway }
        try {
            withTimeout(10_000) { restored.state.first { it.loaded } }; restored.select("a"); withTimeout(10_000) { restored.state.first { it.connected } }; restored.conversations().open("owned")
            withTimeout(10_000) { restored.conversations().state.first { it.connected } }; assertEquals(id, restored.conversations().state.value.pendingRequestId); assertEquals(1, gateway.prompts.size)
            gateway.admission(); withTimeout(10_000) { restored.conversations().state.first { it.pendingRequestId == null } }; assertEquals("", restored.conversations().state.value.draft); assertEquals(1, gateway.prompts.size)
        } finally { restored.close() }
    } }
    @Test fun unknownUploadSurvivesEncryptedDraftRestoreWithoutAutomaticReplay() = runBlocking { exercise { store, gateway, devices ->
        val session = devices.conversations()
        session.retainAttachment(LocalAttachmentDraft("content://owned/fixture", "fixture.bin", "application/octet-stream"), "a", "owned")
        try { session.attach("fixture.bin", byteArrayOf(1), "a", "owned"); fail("Upload result must remain unknown") }
        catch (error: GatewayFailure) { assertEquals("result-unknown", error.code) }
        assertTrue(store.read().drafts.single().localAttachment!!.uploadResultUnknown)
        assertEquals(1, gateway.uploads); devices.close()
        val restored = DeviceRepository(store) { gateway }
        try {
            withTimeout(10_000) { restored.state.first { it.loaded } }; restored.select("a")
            withTimeout(10_000) { restored.state.first { it.connected } }; restored.conversations().open("owned")
            withTimeout(10_000) { restored.conversations().state.first { it.connected } }
            assertTrue(restored.conversations().state.value.localAttachment!!.uploadResultUnknown)
            assertEquals(1, gateway.uploads)
            try { restored.conversations().send(); fail("Unprepared attachment cannot be sent") }
            catch (error: GatewayFailure) { assertEquals("attachment-not-ready", error.code) }
            assertTrue(gateway.prompts.isEmpty()); assertEquals(1, gateway.uploads)
        } finally { restored.close() }
    } }
    @Test fun cancelledQueuedSendKeepsDraftAndNeverCallsPrompt() = runBlocking { exercise { _, gateway, devices ->
        val session = devices.conversations(); val model = async { session.selectModel("p", "m") }; withTimeout(10_000) { gateway.modelStarted.await() }
        session.setDraft("clicked"); val send = async(start = CoroutineStart.UNDISPATCHED) { session.send() }; send.cancelAndJoin()
        assertFalse(session.state.value.sending); assertNull(session.state.value.pendingRequestId); assertEquals("clicked", session.state.value.draft); assertTrue(gateway.prompts.isEmpty())
        gateway.modelRelease.complete(Unit); model.await()
    } }
    @Test fun acceptedReceiptClearsPendingWithoutWaitingForHistory() = runBlocking { exercise { store, gateway, devices ->
        val session = devices.conversations(); session.setDraft("accepted"); session.send()
        assertNull(session.state.value.pendingRequestId); assertEquals("", session.state.value.draft)
        val saved = store.read().drafts.single(); assertNull(saved.pendingRequestId); assertEquals("", saved.text)
        assertEquals(1, gateway.prompts.size); assertTrue(session.state.value.timeline.messages.isEmpty())
    } }
    @Test fun malformedSuccessReceiptPreservesUnknownIdentityWithoutReplay() = runBlocking { exercise { store, gateway, devices ->
        val session = devices.conversations(); gateway.malformedReceipt = true; session.setDraft("uncertain")
        try { session.send(); fail("Unknown receipt expected") } catch (e: GatewayFailure) { assertEquals("result-unknown", e.code) }
        assertNotNull(session.state.value.pendingRequestId); assertEquals("uncertain", session.state.value.draft)
        assertEquals(session.state.value.pendingRequestId, store.read().drafts.single().pendingRequestId)
        try { session.send(); fail("Replay forbidden") } catch (e: GatewayFailure) { assertEquals("connection-required", e.code) }
        assertEquals(1, gateway.prompts.size)
        gateway.admission(); withTimeout(10_000) { session.state.first { it.pendingRequestId == null } }
        assertEquals("", session.state.value.draft)
    } }
    @Test fun acceptedReceiptAfterLeavingSessionOnlyUpdatesItsStoredDraft() = runBlocking { exercise { store, gateway, devices ->
        val session = devices.conversations(); gateway.holdPrompt = true; session.setDraft("old target"); val send = async { session.send() }
        withTimeout(10_000) { gateway.promptStarted.await() }; session.open("new-session")
        withTimeout(10_000) { session.state.first { it.connected && it.sessionId == "new-session" } }; session.setDraft("new target")
        gateway.promptRelease.complete(Unit); send.await()
        val old = store.read().drafts.single { it.sessionId == "owned" }; assertNull(old.pendingRequestId); assertEquals("", old.text)
        assertEquals("new target", session.state.value.draft); assertNull(session.state.value.pendingRequestId); assertEquals("new-session", session.state.value.sessionId)
        assertEquals("owned", gateway.prompts.single().getValue("sessionId").jsonPrimitive.content)
    } }
    @Test fun queuedSendNeverMovesToTheNewSessionOnTheSameDevice() = runBlocking { exercise { _, gateway, devices ->
        val session = devices.conversations(); val model = async { session.selectModel("p", "m") }; withTimeout(10_000) { gateway.modelStarted.await() }
        session.setDraft("old target"); val send = async(start = CoroutineStart.UNDISPATCHED) { try { session.send(); "sent" } catch (e: GatewayFailure) { e.code } }
        session.open("new-session"); withTimeout(10_000) { session.state.first { it.connected && it.sessionId == "new-session" } }
        gateway.modelRelease.complete(Unit); model.await(); assertEquals("device-changed", send.await())
        assertTrue(gateway.prompts.isEmpty()); assertEquals("new-session", session.state.value.sessionId); assertFalse(session.state.value.sending); assertNull(session.state.value.error)
    } }
}
