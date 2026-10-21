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

class PromptLookupRecoveryTest {
    private class Gateway(val accepted: JsonElement = JsonPrimitive(true), val hold: Boolean = false, val foreign: Boolean = false) : DeviceGateway {
        val started = CompletableDeferred<Unit>(); val release = CompletableDeferred<Unit>()
        var lookups = 0; var prompts = 0; var pages = 0
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow { emit(buildJsonObject { put("type", "baseline"); put("value", buildJsonObject { put("items", JsonArray(emptyList())) }) }); awaitCancellation() }
        override fun follow(endpoint: String, args: JsonObject) = flow {
            if (endpoint == "session/follow") emit(buildJsonObject {
                put("type", "snapshot"); put("header", buildJsonObject { put("id", args.getValue("request").jsonObject.getValue("address").jsonObject.getValue("sessionId")) }); put("cursor", 105)
                put("hasMore", true); put("records", JsonArray((100..105).map { seq -> buildJsonObject { put("type", "event"); put("event", buildJsonObject { put("seq", seq); put("type", "test/history"); put("ignorable", true); put("data", JsonObject(emptyMap())) }) } }))
                put("projections", buildJsonObject { put("asOfSeq", 105); put("values", JsonObject(emptyMap())) })
            }) else emit(buildJsonObject { put("type", "baseline"); put("value", buildJsonObject { put("projections", JsonObject(emptyMap())) }) })
            awaitCancellation()
        }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            if (method == "session/prompt") prompts++
            if (method == "session/page") pages++
            if (method != "mobileSearch/lookupPrompt") return JsonObject(emptyMap())
            assertFalse(mutation); lookups++; started.complete(Unit)
            if (hold) withContext(NonCancellable) { release.await() }
            val request = args.getValue("request").jsonObject
            return buildJsonObject { put("sessionId", if (foreign) JsonPrimitive("foreign") else request.getValue("sessionId")); put("requestId", request.getValue("requestId")); put("accepted", accepted); put("throughSeq", 105) }
        }
    }
    private suspend fun exercise(gateway: Gateway, block: suspend (DeviceStore, SessionRepository, String) -> Unit) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val storageScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val file = File(context.cacheDir, "lookup-${UUID.randomUUID()}.preferences_pb")
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = storageScope) { file }); val nonce = UUID.randomUUID().toString()
        store.update { StoredDevices(listOf(DeviceCredential("a", "a", "https://a.example", "0".repeat(64), "a", "fixture-only", Long.MAX_VALUE)), drafts = listOf(ConversationDraft("a", "owned", "old draft", nonce, "old draft", 1, 1))) }
        val devices = DeviceRepository(store) { gateway }; val session = devices.conversations()
        try {
            withTimeout(10_000) { devices.state.first { it.loaded } }; devices.select("a"); withTimeout(10_000) { devices.state.first { it.connected } }; session.open("owned")
            withTimeout(10_000) { gateway.started.await() }; block(store, session, nonce)
            assertEquals(0, gateway.prompts); assertEquals(0, gateway.pages)
        } finally { gateway.release.complete(Unit); devices.close(); storageScope.cancel() }
    }
    @Test fun coldEncryptedIdentityIsConfirmedWithoutDownloadingOldHistoryOrResending() = runBlocking { exercise(Gateway()) { store, session, _ ->
        withTimeout(10_000) { session.state.first { it.connected && it.pendingRequestId == null } }
        assertEquals("", session.state.value.draft); assertTrue(session.state.value.timeline.hasMore); assertFalse(session.state.value.timeline.hasHistoryGap)
        assertEquals(6, session.state.value.timeline.events.size)
        withTimeout(10_000) { while (store.read().drafts.single().pendingRequestId != null) delay(20) }
    } }
    @Test fun newerDraftSurvivesDelayedLookupConfirmation() = runBlocking {
        val gateway = Gateway(hold = true); exercise(gateway) { store, session, _ ->
            session.setDraft("newer draft"); gateway.release.complete(Unit)
            withTimeout(10_000) { session.state.first { it.pendingRequestId == null } }; assertEquals("newer draft", session.state.value.draft)
            withTimeout(10_000) { while (store.read().drafts.single().pendingRequestId != null) delay(20) }; assertEquals("newer draft", store.read().drafts.single().text)
        }
    }
    @Test fun negativeObservationRetainsIdentityAndDoesNotPollOrReplay() = runBlocking {
        val gateway = Gateway(JsonPrimitive(false)); exercise(gateway) { store, session, nonce ->
            delay(500); assertEquals(nonce, session.state.value.pendingRequestId); assertEquals(nonce, store.read().drafts.single().pendingRequestId); assertEquals(1, gateway.lookups)
        }
    }
    @Test fun foreignSessionReceiptCannotClearPending() = runBlocking { exercise(Gateway(foreign = true)) { _, session, nonce -> delay(500); assertEquals(nonce, session.state.value.pendingRequestId) } }
    @Test fun stringBooleanCannotConfirmSubmission() = runBlocking { exercise(Gateway(JsonPrimitive("true"))) { _, session, nonce -> delay(500); assertEquals(nonce, session.state.value.pendingRequestId) } }
    @Test fun lateLookupDoesNotClearNewTargetDraft() = runBlocking {
        val gateway = Gateway(hold = true); exercise(gateway) { store, session, nonce ->
            session.open("new-session"); withTimeout(10_000) { session.state.first { it.connected && it.sessionId == "new-session" } }; session.setDraft("new target")
            gateway.release.complete(Unit); delay(500); assertEquals("new target", session.state.value.draft); assertNull(session.state.value.pendingRequestId)
            assertEquals(nonce, store.read().drafts.single { it.sessionId == "owned" }.pendingRequestId)
        }
    }
}
