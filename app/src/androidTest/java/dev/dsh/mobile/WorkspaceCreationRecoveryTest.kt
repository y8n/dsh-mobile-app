package dev.dsh.mobile

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
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

class WorkspaceCreationRecoveryTest {
    private class Gateway(var loseCreate: Boolean = false, var commitCreate: Boolean = true, var failRename: Boolean = false) : DeviceGateway {
        var workspace: Workspace? = null
        @Volatile var baselineBlocked = false
        var creates = 0; var renames = 0; var sessions = 0
        private val frames = MutableSharedFlow<JsonObject>(extraBufferCapacity = 8)
        private fun baseline() = buildJsonObject { put("type", "baseline"); put("value", WireJson.encodeToJsonElement(WorkspaceSnapshot(listOfNotNull(workspace)))) }
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow { if (baselineBlocked) awaitCancellation(); emit(baseline()); emitAll(frames) }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            if (method == "session/list") return buildJsonObject { put("items", JsonArray(emptyList())) }
            assertTrue(mutation)
            val request = args.getValue("request").jsonObject
            return when (method) {
                "workspace/create" -> {
                    creates++
                    if (commitCreate) workspace = Workspace("owned", request.string("path"), "initial")
                    if (loseCreate) { loseCreate = false; throw GatewayFailure("result-unknown") }
                    buildJsonObject { put("created", true); put("workspace", WireJson.encodeToJsonElement(workspace!!)) }
                }
                "workspace/rename" -> {
                    renames++
                    if (failRename) { failRename = false; throw GatewayFailure("remote-failure") }
                    workspace = workspace!!.copy(title = request.string("title")); frames.emit(baseline())
                    buildJsonObject { put("workspace", WireJson.encodeToJsonElement(workspace!!)) }
                }
                "session/create" -> {
                    sessions++; val id = request.string("sessionId")
                    workspace = workspace!!.copy(sessionIds = (workspace!!.sessionIds + id).distinct()); frames.emit(baseline())
                    buildJsonObject { put("sessionId", id) }
                }
                else -> throw AssertionError(method)
            }
        }
    }
    private suspend fun fixture(block: suspend (DeviceStore, Gateway) -> Unit) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = scope) { File(context.cacheDir, "workspace-recovery-${UUID.randomUUID()}.preferences_pb") })
        store.update { StoredDevices(listOf(DeviceCredential("a", "fixture", "https://a.example", "0".repeat(64), "a", "fixture-only", Long.MAX_VALUE))) }
        try { block(store, Gateway()) } finally { scope.cancel() }
    }
    private suspend fun repository(store: DeviceStore, gateway: Gateway): DeviceRepository {
        val repo = DeviceRepository(store) { gateway }
        withTimeout(10_000) { repo.state.first { it.loaded } }; repo.select("a")
        withTimeout(10_000) { repo.state.first { it.connected } }; return repo
    }
    private suspend fun fails(code: String, action: suspend () -> Unit) {
        try { action(); fail("Expected $code") } catch (error: GatewayFailure) { assertEquals(code, error.code) }
    }
    @Test fun lostCreateResponseSurvivesRepositoryRestartAndReconcilesWithoutReplay() = runBlocking {
        fixture { store, gateway ->
            gateway.loseCreate = true
            val first = repository(store, gateway)
            try { fails("result-unknown") { first.createWorkspace("Recovered", "/owned") } } finally { first.close() }
            assertEquals("/owned", store.read().pendingWorkspaces.single().path)
            val second = repository(store, gateway)
            try {
                val id = second.createWorkspace("Recovered", "/owned")
                assertEquals(id, second.state.value.activeSessionId)
                assertEquals("Recovered", second.state.value.selectedWorkspace?.title)
                assertEquals(1, gateway.creates); assertEquals(1, gateway.sessions)
                assertTrue(store.read().pendingWorkspaces.isEmpty()); assertTrue(store.read().pendingSessions.isEmpty())
            } finally { second.close() }
        }
    }
    @Test fun absentResultAfterLostResponseNeverRepeatsCreate() = runBlocking {
        fixture { store, gateway ->
            gateway.loseCreate = true; gateway.commitCreate = false
            val first = repository(store, gateway)
            try { fails("result-unknown") { first.createWorkspace("Unknown", "/owned") } } finally { first.close() }
            val second = repository(store, gateway)
            try { fails("result-unknown") { second.createWorkspace("Unknown", "/owned") }; assertEquals(1, gateway.creates); assertEquals(0, gateway.sessions) }
            finally { second.close() }
        }
    }
    @Test fun confirmedWorkspaceSurvivesRenameFailureAndRepositoryRestart() = runBlocking {
        fixture { store, gateway ->
            gateway.failRename = true
            val first = repository(store, gateway)
            try { fails("remote-failure") { first.createWorkspace("Recovered", "/owned") } } finally { first.close() }
            assertEquals("owned", store.read().pendingWorkspaces.single().workspaceId)
            val second = repository(store, gateway)
            try { second.createWorkspace("Recovered", "/owned"); assertEquals(1, gateway.creates); assertEquals(2, gateway.renames); assertEquals(1, gateway.sessions) }
            finally { second.close() }
        }
    }
    @Test fun preexistingWorkspaceIsNotRenamedOrAdoptedAsOwned() = runBlocking {
        fixture { store, gateway ->
            gateway.workspace = Workspace("unowned", "/owned", "Existing")
            val repo = repository(store, gateway)
            try { fails("workspace/already-registered") { repo.createWorkspace("Replacement", "/owned") }; assertEquals(0, gateway.creates); assertEquals(0, gateway.renames); assertTrue(store.read().pendingWorkspaces.isEmpty()) }
            finally { repo.close() }
        }
    }
    @Test fun workspaceBaselineTimeoutShowsRetryableErrorWithoutRegisteringIntent() = runBlocking {
        fixture { store, gateway ->
            val repo = repository(store, gateway)
            try {
                gateway.baselineBlocked = true
                withTimeout(65_000) { fails("network-unavailable") { repo.createWorkspace("No baseline", "/owned") } }
                assertEquals("network-unavailable", repo.state.value.error)
                assertFalse(repo.state.value.busy); assertEquals(0, gateway.creates)
                assertTrue(store.read().pendingWorkspaces.isEmpty())
            } finally { repo.close() }
        }
    }
    @Test fun deviceSwitchDuringConfirmationStorageCannotPublishOldSession() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val delegate = PreferenceDataStoreFactory.create(scope = scope) { File(context.cacheDir, "workspace-switch-${UUID.randomUUID()}.preferences_pb") }
        var afterWrite: (() -> Unit)? = null
        val store = DeviceStore(object : DataStore<Preferences> {
            override val data = delegate.data
            override suspend fun updateData(transform: suspend (Preferences) -> Preferences): Preferences = delegate.updateData(transform).also { afterWrite?.invoke() }
        })
        store.update { StoredDevices(listOf("a", "b").map { DeviceCredential(it, it, "https://$it.example", "0".repeat(64), it, "fixture-only", Long.MAX_VALUE) }) }
        val a = Gateway().apply { workspace = Workspace("owned", "/owned", "one") }
        val b = Gateway().apply { workspace = Workspace("second", "/second", "two") }
        val repo = DeviceRepository(store) { if (it.id == "a") a else b }
        try {
            withTimeout(10_000) { repo.state.first { it.loaded } }; repo.select("a"); withTimeout(10_000) { repo.state.first { it.connected } }
            repo.openWorkspace(a.workspace!!)
            withTimeout(10_000) { while (store.read().recentWorkspaceId != "owned") delay(20) }
            var writes = 0
            afterWrite = { writes++; if (writes == 2) repo.select("b") }
            fails("device-changed") { repo.createSession() }
            assertEquals("Switch must happen after the remote creation and during confirmation storage", 1, a.sessions)
            withTimeout(10_000) { repo.state.first { it.connected && it.selectedId == "b" } }
            assertNull(repo.state.value.activeSessionId); assertNull(repo.state.value.selectedWorkspace)
        } finally { afterWrite = null; repo.close(); scope.cancel() }
    }
}
