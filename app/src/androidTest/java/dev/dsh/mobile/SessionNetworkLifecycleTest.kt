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

/** Isolated parent transport loss while the child socket still appears live. */
class SessionNetworkLifecycleTest {
    private class Fake : DeviceGateway {
        var holdSnapshot = false
        var permissionFails = false
        val follows = java.util.concurrent.atomic.AtomicInteger()
        val mutations = java.util.concurrent.CopyOnWriteArrayList<String>()
        val reads = java.util.concurrent.CopyOnWriteArrayList<String>()
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow {
            emit(WireJson.parseToJsonElement("""{"type":"baseline","value":{"items":[]}}""").jsonObject)
            awaitCancellation()
        }
        override fun follow(endpoint: String, args: JsonObject) = flow {
            if (endpoint == "session/follow") {
                follows.incrementAndGet()
                if (holdSnapshot) awaitCancellation()
                val snapshot = WireJson.parseToJsonElement("""{"type":"snapshot","cursor":-1,"records":[],"hasMore":false,"projections":{"asOfSeq":-1,"values":{"imageLimits":{"mediaTypes":["image/png"],"maxImageBytes":1048576,"maxMessageImageBytes":1048576,"maxImagePixels":1000000,"maxImageDimension":1024}}}}""").jsonObject
                emit(JsonObject(snapshot + ("header" to buildJsonObject { put("id", args.getValue("request").jsonObject.getValue("address").jsonObject.getValue("sessionId")) })))
            } else emit(WireJson.parseToJsonElement("""{"type":"baseline","value":{"projections":{}}}""").jsonObject)
            awaitCancellation()
        }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            if (mutation) mutations += method else reads += method
            if (method == "permissionPresets/catalog" && permissionFails) throw GatewayFailure("http-failure")
            if (method == "permissionPresets/catalog") return buildJsonObject { put("options", JsonArray(emptyList())) }
            return buildJsonObject { put("accepted", true) }
        }
        override suspend fun upload(sessionId: String, name: String, bytes: ByteArray): JsonObject {
            mutations += "upload"
            return buildJsonObject { put("receiptId", "fixture-only") }
        }
    }

    @Test fun stalledInitialLoadStopsSpinnerAndPermissionReadDoesNotDisconnectMessages() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val storageScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = storageScope) { File(context.cacheDir, "bounded-load-${UUID.randomUUID()}.preferences_pb") })
        store.update { StoredDevices(listOf(DeviceCredential("a", "a", "https://a.example", "0".repeat(64), "a", "fixture-only", Long.MAX_VALUE))) }
        val fake = Fake().apply { holdSnapshot = true }; val devices = DeviceRepository(store) { fake }; val session = devices.conversations()
        try {
            withTimeout(5000) { devices.state.first { it.loaded } }; devices.select("a")
            withTimeout(5000) { devices.state.first { it.connected } }; session.acquireView("owned")
            withTimeout(23_000) { session.state.first { !it.loading && it.connectionError == "initial-timeout" } }
            assertFalse(session.state.value.initialLoaded); assertNull(session.state.value.error)
            fake.holdSnapshot = false; session.retry()
            withTimeout(5000) { session.state.first { it.connected } }
            fake.permissionFails = true; session.loadPermissions()
            assertTrue(session.state.value.connected); assertEquals("http-failure", session.state.value.permissionError); assertNull(session.state.value.error)
            fake.permissionFails = false; session.loadPermissions(); assertNull(session.state.value.permissionError)
            assertTrue(fake.mutations.isEmpty())
        } finally { devices.close(); storageScope.cancel() }
    }

    @Test fun parentLossDisablesWritesAndReconnectPreservesLocalDraftAndImage() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val storageScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = storageScope) {
            File(context.cacheDir, "network-lifecycle-${UUID.randomUUID()}.preferences_pb")
        })
        store.update { StoredDevices(listOf(DeviceCredential("a", "a", "https://a.example", "0".repeat(64), "a", "fixture-only", Long.MAX_VALUE))) }
        val fake = Fake(); val devices = DeviceRepository(store) { fake }; val session = devices.conversations()
        try {
            withTimeout(10_000) { devices.state.first { it.loaded } }; devices.select("a")
            withTimeout(10_000) { devices.state.first { it.connected } }; session.acquireView("owned")
            withTimeout(10_000) { session.state.first { it.connected } }; session.setDraft("keep local draft")
            val previous = fake.follows.get()
            devices.pause()
            withTimeout(1_000) { session.state.first { !it.connected } }
            assertEquals("keep local draft", session.state.value.draft)
            suspend fun blocked(action: suspend () -> Unit) {
                try { action(); fail("Offline mutation admitted") }
                catch (error: GatewayFailure) { assertEquals("connection-required", error.code) }
            }
            blocked { session.send() }; blocked { session.stop() }; blocked { session.attach("offline.txt", byteArrayOf(1)) }
            val png = java.io.ByteArrayOutputStream().apply {
                android.graphics.Bitmap.createBitmap(2, 2, android.graphics.Bitmap.Config.ARGB_8888)
                    .compress(android.graphics.Bitmap.CompressFormat.PNG, 100, this)
            }.toByteArray()
            session.attachImage("local.png", "image/png", png)
            assertEquals("image", session.state.value.attachmentPart?.text("type")); assertTrue(fake.mutations.isEmpty())
            devices.resume()
            withTimeout(10_000) { devices.state.first { it.connected } }
            withTimeout(10_000) { session.state.first { it.connected && fake.follows.get() > previous } }
            assertEquals("keep local draft", session.state.value.draft)
            assertEquals("image", session.state.value.attachmentPart?.text("type")); assertNull(session.state.value.pendingRequestId)
            assertTrue(fake.mutations.isEmpty())
        } finally { devices.close(); storageScope.cancel() }
    }

    @Test fun openingWhileParentOfflineRestoresUncertainDraftWithoutAdmission() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val storageScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = storageScope) {
            File(context.cacheDir, "network-pending-${UUID.randomUUID()}.preferences_pb")
        })
        store.update { StoredDevices(
            devices = listOf(DeviceCredential("a", "a", "https://a.example", "0".repeat(64), "a", "fixture-only", Long.MAX_VALUE)),
            drafts = listOf(ConversationDraft("a", "owned", "uncertain text", "fixture-pending", "uncertain text", 7, 7))) }
        val fake = Fake(); val devices = DeviceRepository(store) { fake }; val session = devices.conversations()
        try {
            withTimeout(10_000) { devices.state.first { it.loaded } }; devices.select("a")
            withTimeout(10_000) { devices.state.first { it.connected } }; devices.pause(); session.acquireView("owned")
            withTimeout(10_000) { session.state.first { !it.loading && it.pendingRequestId == "fixture-pending" } }
            assertFalse(session.state.value.connected); assertEquals("uncertain text", session.state.value.draft)
            assertEquals(7L, session.state.value.pendingDraftRevision); assertTrue(fake.reads.isEmpty()); assertTrue(fake.mutations.isEmpty())
            devices.resume()
            withTimeout(10_000) { session.state.first { it.connected } }
            withTimeout(5_000) { while ("mobileSearch/lookupPrompt" !in fake.reads) delay(10) }
            // The fake lookup intentionally lacks a valid target/cut, so it
            // cannot prove admission or clear the durable identity.
            assertEquals("fixture-pending", session.state.value.pendingRequestId)
            assertEquals("uncertain text", session.state.value.draft)
            assertEquals("fixture-pending", store.read().drafts.single().pendingRequestId)
            assertTrue(fake.mutations.isEmpty())
        } finally { devices.close(); storageScope.cancel() }
    }
}
