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

class WorkspaceSearchIsolationTest {
    private class Gateway(val holdFirst: Boolean = false, val wrongScope: Boolean = false) : DeviceGateway {
        val started = CompletableDeferred<Unit>(); val release = CompletableDeferred<Unit>()
        val reads = java.util.concurrent.CopyOnWriteArrayList<JsonObject>()
        val frames = Channel<JsonObject>(Channel.UNLIMITED); var archivedNow = false
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow {
            emit(buildJsonObject { put("type", "baseline"); put("value", WireJson.encodeToJsonElement(WorkspaceSnapshot(listOf(Workspace("w1", "/w1", "one", listOf("result-word", "result-old", "result-new")), Workspace("w2", "/w2", "two"))))) }); for (frame in frames) emit(frame)
        }
        override fun follow(endpoint: String, args: JsonObject) = emptyFlow<JsonObject>()
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            if (method == "session/list") return buildJsonObject { put("items", JsonArray(emptyList())) }
            assertEquals("mobileSearch/searchWorkspace", method); assertFalse(mutation)
            val request = args.getValue("request").jsonObject; reads += request; started.complete(Unit)
            if (holdFirst && reads.size == 1) withContext(NonCancellable) { release.await() }
            val empty = archivedNow && request.text("query") == "word" && !request.getValue("archived").jsonPrimitive.boolean
            return buildJsonObject {
                put("workspaceId", if (wrongScope) JsonPrimitive("foreign") else request.getValue("workspaceId")); put("archived", request.getValue("archived"))
                put("limit", 5); put("hasMore", !empty); put("items", buildJsonArray { if (!empty) add(buildJsonObject { put("sessionId", "result-${request.text("query")}"); put("snippet", "matched body") }) })
            }
        }
    }
    private suspend fun exercise(gateway: Gateway, open: Boolean = true, block: suspend (DeviceRepository) -> Unit) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext; val storageScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = storageScope) { File(context.cacheDir, "search-${UUID.randomUUID()}.preferences_pb") })
        store.update { StoredDevices(listOf(DeviceCredential("a", "a", "https://a.example", "0".repeat(64), "a", "fixture-only", Long.MAX_VALUE))) }
        val repo = DeviceRepository(store) { gateway }
        try {
            withTimeout(10_000) { repo.state.first { it.loaded } }; repo.select("a"); withTimeout(10_000) { repo.state.first { it.connected } }
            if (open) repo.openWorkspace(repo.state.value.snapshot!!.items.first())
            block(repo)
        } finally { gateway.release.complete(Unit); repo.close(); storageScope.cancel() }
    }
    @Test fun requestCarriesWorkspaceAndArchiveScopeAndPublishesActualCap() = runBlocking {
        val gateway = Gateway(); exercise(gateway) { repo ->
            repo.searchSessions(" word ", true); withTimeout(10_000) { repo.state.first { !it.searching && it.searchMatches?.isNotEmpty() == true } }
            val request = gateway.reads.single(); assertEquals("w1", request.text("workspaceId")); assertEquals("word", request.text("query")); assertTrue(request.getValue("archived").jsonPrimitive.boolean)
            assertEquals(5, repo.state.value.searchResultLimit); assertTrue(repo.state.value.searchHasMore)
        }
    }
    @Test fun laterQueryWinsOverCancelledOldRead() = runBlocking {
        val gateway = Gateway(holdFirst = true); exercise(gateway) { repo ->
            repo.searchSessions("old"); withTimeout(10_000) { gateway.started.await() }; repo.searchSessions("new")
            withTimeout(10_000) { repo.state.first { it.searchMatches?.containsKey("result-new") == true } }; gateway.release.complete(Unit); delay(300)
            assertEquals(setOf("result-new"), repo.state.value.searchMatches!!.keys)
        }
    }
    @Test fun workspaceChangeIsolatesLateReadOnSameDevice() = runBlocking {
        val gateway = Gateway(holdFirst = true); exercise(gateway) { repo ->
            repo.searchSessions("old"); withTimeout(10_000) { gateway.started.await() }
            repo.openWorkspace(repo.state.value.snapshot!!.items.last()); repo.searchSessions("new", true)
            withTimeout(10_000) { repo.state.first { it.searchMatches?.containsKey("result-new") == true } }; gateway.release.complete(Unit); delay(300)
            assertEquals("w2", repo.state.value.selectedWorkspace!!.workspaceId); assertEquals(setOf("result-new"), repo.state.value.searchMatches!!.keys)
            assertEquals("w2", gateway.reads.last().text("workspaceId")); assertTrue(gateway.reads.last().getValue("archived").jsonPrimitive.boolean)
        }
    }
    @Test fun clearingSearchDiscardsLateResponse() = runBlocking {
        val gateway = Gateway(holdFirst = true); exercise(gateway) { repo ->
            repo.searchSessions("old"); withTimeout(10_000) { gateway.started.await() }; repo.searchSessions(""); gateway.release.complete(Unit); delay(300)
            assertNull(repo.state.value.searchMatches); assertFalse(repo.state.value.searching); assertFalse(repo.state.value.searchHasMore)
        }
    }
    @Test fun foreignScopeFailsInsteadOfPublishingMatches() = runBlocking {
        exercise(Gateway(wrongScope = true)) { repo -> repo.searchSessions("word"); withTimeout(10_000) { repo.state.first { !it.searching } }; assertEquals("invalid-response", repo.state.value.error); assertTrue(repo.state.value.searchMatches!!.isEmpty()) }
    }
    @Test fun missingWorkspaceNeverFallsBackToGlobalSearch() = runBlocking {
        val gateway = Gateway(); exercise(gateway, open = false) { repo -> repo.searchSessions("word"); assertEquals("workspace/not-found", repo.state.value.error); assertTrue(gateway.reads.isEmpty()) }
    }
    @Test fun remoteArchiveDeltaRefreshesCurrentQueryWithoutRetyping() = runBlocking {
        val gateway = Gateway(); exercise(gateway) { repo ->
            repo.searchSessions("word"); withTimeout(10_000) { repo.state.first { !it.searching && it.searchMatches?.containsKey("result-word") == true } }
            gateway.archivedNow = true; gateway.frames.send(buildJsonObject { put("type", "archived"); put("archivedSessionIds", buildJsonArray { add("result-word") }) })
            withTimeout(10_000) { repo.state.first { !it.searching && it.searchMatches?.isEmpty() == true && gateway.reads.size == 2 } }
            assertEquals("word", repo.state.value.searchQuery); assertFalse(repo.state.value.searchHasMore)
            assertEquals("word", gateway.reads.last().text("query")); assertFalse(gateway.reads.last().getValue("archived").jsonPrimitive.boolean)
        }
    }
}
