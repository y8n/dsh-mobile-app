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

class WorkspaceTextReaderTest {
    private class Fixture : DeviceGateway {
        val calls = java.util.concurrent.CopyOnWriteArrayList<Pair<String, JsonObject>>()
        val started = CompletableDeferred<Unit>(); val release = CompletableDeferred<Unit>()
        var holdStat = false; var changedDuringRead = false; var changedAfterRead = false; var oversized = false
        var statCount = 0; var version = "v1"
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow { emit(buildJsonObject { put("type", "baseline"); put("value", buildJsonObject { put("items", JsonArray(emptyList())) }) }); awaitCancellation() }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            assertFalse("File reader mutated backend", mutation); calls += method to args
            if (method == "workspaceFiles/stat") {
                statCount++; if (holdStat) { started.complete(Unit); withContext(NonCancellable) { release.await() } }
                return buildJsonObject { put("absolutePath", "/fixture/code.txt"); put("version", if (changedAfterRead && statCount > 1) "v2" else version); put("bytes", 4) }
            }
            assertEquals("workspaceFiles/read", method)
            return buildJsonObject { put("absolutePath", "/fixture/code.txt"); put("version", if (changedDuringRead) "v2" else version); put("bytes", 4)
                put("offset", args.getValue("range").jsonObject.getValue("offset")); put("lines", 1); put("text", if (oversized) "x".repeat(600 * 1024) else "code"); put("eof", true) }
        }
    }
    private suspend fun exercise(block: suspend CoroutineScope.(DeviceRepository, Fixture) -> Unit) = coroutineScope {
        val context = InstrumentationRegistry.getInstrumentation().targetContext; val storageScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = storageScope) { File(context.cacheDir, "file-reader-${UUID.randomUUID()}.preferences_pb") })
        store.update { StoredDevices(listOf("a", "b").map { DeviceCredential(it, it, "https://$it.example", "0".repeat(64), it, "fixture-only", Long.MAX_VALUE) }) }
        val a = Fixture(); val b = Fixture(); val devices = DeviceRepository(store) { if (it.id == "a") a else b }
        try { withTimeout(10_000) { devices.state.first { it.loaded } }; devices.select("a"); withTimeout(10_000) { devices.state.first { it.connected } }; block(devices, a) }
        finally { a.release.complete(Unit); devices.close(); storageScope.cancel() }
    }
    private suspend fun failure(code: String, action: suspend () -> Unit) {
        try { action(); fail("Expected $code") } catch (failure: GatewayFailure) { assertEquals(code, failure.code) }
    }
    @Test fun readsOneBasedPageAtOneVersionWithNoMutation() = runBlocking { exercise { devices, fixture ->
        val page = WorkspaceTextReader(devices).read(WorkspaceFileTarget("a", "owned", "code.txt"))
        assertEquals("code", page.text); assertEquals(1L, page.offset); assertTrue(page.eof)
        assertEquals(listOf("workspaceFiles/stat", "workspaceFiles/read", "workspaceFiles/stat"), fixture.calls.map { it.first })
        fixture.calls.forEach { assertEquals("owned", it.second.text("workspaceFileScopeId")) }
    } }
    @Test fun rejectsAChangeBetweenStatAndRead() = runBlocking { exercise { devices, fixture ->
        fixture.changedDuringRead = true
        failure("file-changed") { WorkspaceTextReader(devices).read(WorkspaceFileTarget("a", "owned", "code.txt")) }
    } }
    @Test fun rejectsAChangeAfterReadingAndBeforeFinalStat() = runBlocking { exercise { devices, fixture ->
        fixture.changedAfterRead = true
        failure("file-changed") { WorkspaceTextReader(devices).read(WorkspaceFileTarget("a", "owned", "code.txt")) }
    } }
    @Test fun rejectsNewVersionBeforeRequestingTheNextPage() = runBlocking { exercise { devices, fixture ->
        fixture.version = "v2"
        failure("file-changed") { WorkspaceTextReader(devices).read(WorkspaceFileTarget("a", "owned", "code.txt"), 501, JsonPrimitive("v1")) }
        assertEquals(listOf("workspaceFiles/stat"), fixture.calls.map { it.first })
    } }
    @Test fun oldDeviceResponseCannotContinueOnNewDevice() = runBlocking { exercise { devices, fixture ->
        fixture.holdStat = true
        val read = async { failure("device-changed") { WorkspaceTextReader(devices).read(WorkspaceFileTarget("a", "owned", "code.txt")) } }
        withTimeout(10_000) { fixture.started.await() }; devices.select("b"); withTimeout(10_000) { devices.state.first { it.connected && it.selectedId == "b" } }
        fixture.release.complete(Unit); read.await(); assertEquals(listOf("workspaceFiles/stat"), fixture.calls.map { it.first })
    } }
    @Test fun rejectsOversizedPageInsteadOfDisplayingIt() = runBlocking { exercise { devices, fixture ->
        fixture.oversized = true
        failure("file-preview-limit") { WorkspaceTextReader(devices).read(WorkspaceFileTarget("a", "owned", "code.txt")) }
    } }
}
