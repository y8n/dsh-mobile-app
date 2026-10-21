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

class WorkspaceListOverflowTest {
    private class Gateway(val mode: String = "valid") : DeviceGateway {
        val methods = java.util.concurrent.CopyOnWriteArrayList<String>()
        val workspace = Workspace("owned", "/owned", "own", (0..100).map { "session-$it" })
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow { emit(buildJsonObject { put("type", "baseline"); put("value", WireJson.encodeToJsonElement(WorkspaceSnapshot(listOf(workspace)))) }); awaitCancellation() }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            assertFalse(mutation); methods += method
            if (method == "session/list") throw GatewayFailure(if (mode == "network") "network-unavailable" else "response-too-large")
            assertEquals("mobileSearch/listWorkspace", method)
            val request = args.getValue("request").jsonObject; assertEquals("owned", request.text("workspaceId"))
            val second = request.containsKey("cursor")
            val ids = if (second) listOf("session-100") else (0..99).map { "session-$it" }
            return buildJsonObject {
                put("workspaceId", if (mode == "foreign-workspace") "foreign" else "owned")
                put("items", WireJson.encodeToJsonElement(ids.mapIndexed { i, id -> SessionSummary(if (mode == "foreign-row" && i == 0) "foreign" else id, updatedAt = i.toLong()) }))
                put("nextCursor", if (!second || mode == "repeated-cursor") JsonPrimitive("next") else JsonNull)
            }
        }
    }
    private suspend fun exercise(mode: String, block: suspend (DeviceRepository, Gateway) -> Unit) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = scope) { File(context.cacheDir, "list-overflow-${UUID.randomUUID()}.preferences_pb") })
        store.update { StoredDevices(listOf(DeviceCredential("fixture", "fixture", "https://fixture.example", "0".repeat(64), "fixture", "fixture-only", Long.MAX_VALUE))) }
        val gateway = Gateway(mode); val repository = DeviceRepository(store) { gateway }
        try {
            withTimeout(10_000) { repository.state.first { it.loaded } }; repository.select("fixture")
            withTimeout(10_000) { repository.state.first { it.connected } }; repository.openWorkspace(gateway.workspace)
            block(repository, gateway)
        } finally { repository.close(); scope.cancel() }
    }
    @Test fun oversizedGlobalListUsesCompleteScopedPagesAndRemembersDevice() = runBlocking { exercise("valid") { repo, gateway ->
        withTimeout(10_000) { repo.state.first { it.sessions.size == 101 } }
        assertEquals(gateway.workspace.sessionIds.toSet(), repo.state.value.sessions.map { it.sessionId }.toSet())
        assertEquals(1, gateway.methods.count { it == "session/list" })
        repo.openWorkspace(gateway.workspace)
        withTimeout(10_000) { repo.state.first { it.sessions.size == 101 } }
        assertEquals(1, gateway.methods.count { it == "session/list" }); assertEquals(4, gateway.methods.count { it == "mobileSearch/listWorkspace" })
    } }
    @Test fun foreignWorkspaceNeverPublishesPartialPages() = runBlocking { rejects("foreign-workspace", "invalid-response") }
    @Test fun foreignSessionNeverPublishesPartialPages() = runBlocking { rejects("foreign-row", "invalid-response") }
    @Test fun repeatedCursorDoesNotLoopOrPublishPartialPages() = runBlocking { rejects("repeated-cursor", "invalid-response") }
    @Test fun networkFailureIsNotMisclassifiedAsOverflow() = runBlocking { exercise("network") { repo, gateway ->
        withTimeout(10_000) { repo.state.first { it.error != null } }
        assertEquals("network-unavailable", repo.state.value.error); assertEquals(listOf("session/list"), gateway.methods.toList())
    } }
    private suspend fun rejects(mode: String, code: String) { exercise(mode) { repo, _ ->
        withTimeout(10_000) { repo.state.first { it.error != null } }; assertEquals(code, repo.state.value.error); assertTrue(repo.state.value.sessions.isEmpty())
    } }
}
