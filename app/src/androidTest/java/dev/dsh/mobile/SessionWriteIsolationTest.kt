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

/** Fault injection uses isolated encrypted vaults and records every mutation.
 * It does not substitute for the separately recorded actual Desktop tests. */
class SessionWriteIsolationTest {
    private class Fake : DeviceGateway {
        val started = CompletableDeferred<Unit>(); val release = CompletableDeferred<Unit>()
        val mutations = java.util.concurrent.CopyOnWriteArrayList<String>()
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow { emit(buildJsonObject {
            put("type", "baseline"); put("value", buildJsonObject { put("items", JsonArray(emptyList())) })
        }); awaitCancellation() }
        override fun follow(endpoint: String, args: JsonObject) = flow {
            emit(if (endpoint == "session/follow") buildJsonObject {
                put("type", "snapshot"); put("header", buildJsonObject { put("id", args.getValue("request").jsonObject.getValue("address").jsonObject.string("sessionId")) })
                put("cursor", -1); put("records", JsonArray(emptyList())); put("hasMore", false)
                put("projections", buildJsonObject { put("asOfSeq", -1); put("values", JsonObject(emptyMap())) })
            } else buildJsonObject { put("type", "baseline"); put("value", buildJsonObject { put("projections", JsonObject(emptyMap())) }) })
            awaitCancellation()
        }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            if (mutation) mutations += method
            if (method == "session/selectModel") { started.complete(Unit); withContext(NonCancellable) { release.await() } }
            return buildJsonObject { put("items", JsonArray(emptyList())); put("result", buildJsonObject { put("kind", "success") }) }
        }
    }
    private suspend fun exercise(switchDevice: Boolean) = coroutineScope {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val storageScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val file = File(context.cacheDir, "write-isolation-${UUID.randomUUID()}.preferences_pb")
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = storageScope) { file })
        store.update { StoredDevices(listOf("a", "b").map { DeviceCredential(it, it, "https://$it.example", "0".repeat(64), it, "test-only", Long.MAX_VALUE) }) }
        val a = Fake(); val b = Fake(); val devices = DeviceRepository(store) { if (it.id == "a") a else b }
        val session = devices.conversations()
        try {
            withTimeout(5_000) { devices.state.first { it.loaded } }; devices.select("a")
            withTimeout(5_000) { devices.state.first { it.connected } }; session.open("old-session")
            withTimeout(5_000) { session.state.first { it.connected } }
            val first = async { session.selectModel("provider", "model") }
            withTimeout(5_000) { a.started.await() }
            val queued = async(start = CoroutineStart.UNDISPATCHED) {
                try { session.goal("create", "must stay with old target"); "executed" }
                catch (error: GatewayFailure) { error.code }
            }
            if (switchDevice) {
                devices.select("b"); withTimeout(5_000) { devices.state.first { it.connected && it.selectedId == "b" } }
            }
            session.open("new-session")
            withTimeout(5_000) { session.state.first { it.connected && it.sessionId == "new-session" } }
            a.release.complete(Unit); first.await()
            assertEquals("device-changed", queued.await())
            assertEquals(listOf("session/selectModel"), a.mutations.toList()); assertTrue(b.mutations.isEmpty())
            assertEquals("new-session", session.state.value.sessionId); assertNull(session.state.value.error)
        } finally { a.release.complete(Unit); devices.close(); storageScope.cancel() }
    }
    @Test fun queuedGoalDoesNotCrossDeviceBoundary() = runBlocking { exercise(true) }
    @Test fun queuedGoalDoesNotCrossSessionBoundaryOnSameDevice() = runBlocking { exercise(false) }
    @Test fun departingConversationDoesNotDisconnectTheNewDiffScreen() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val storageScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val file = File(context.cacheDir, "view-isolation-${UUID.randomUUID()}.preferences_pb")
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = storageScope) { file })
        store.update { StoredDevices(listOf(DeviceCredential("a", "a", "https://a.example", "0".repeat(64), "a", "test-only", Long.MAX_VALUE)), defaultId = "a") }
        val fake = Fake(); val devices = DeviceRepository(store, gatewayFactory = { fake }); val session = devices.conversations()
        try {
            withTimeout(10_000) { devices.state.first { it.loaded } }; devices.select("a")
            withTimeout(10_000) { devices.state.first { it.connected } }
            val departing = session.acquireView("owned-session")
            withTimeout(10_000) { session.state.first { it.connected } }
            val incoming = session.acquireView("owned-session")
            session.releaseView(departing); assertTrue(session.state.value.connected)
            session.releaseView(incoming); assertFalse(session.state.value.connected)
        } finally { devices.close(); storageScope.cancel() }
    }
}
