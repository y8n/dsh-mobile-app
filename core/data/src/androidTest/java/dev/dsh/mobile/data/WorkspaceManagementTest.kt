package dev.dsh.mobile.data

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.UUID

class WorkspaceManagementTest {
    private class Gateway : DeviceGateway {
        var snapshot = WorkspaceSnapshot(listOf(Workspace("one", "/repo/one", "One", listOf("session")), Workspace("two", "/repo/two", "Two")))
        val writes = mutableListOf<String>()
        var uncertain = false
        var applyWrite = true
        var reject: String? = null
        var onWrite: (() -> Unit)? = null
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow {
            emit(buildJsonObject { put("type", "baseline"); put("value", WireJson.encodeToJsonElement(snapshot)) }); awaitCancellation()
        }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            if (!mutation) return JsonObject(emptyMap())
            assertTrue(method in setOf("workspace/rename", "workspace/delete"))
            writes += method
            reject?.let { throw GatewayFailure(it) }
            val request = args.getValue("request").jsonObject
            assertEquals("one", request.text("workspaceId"))
            if (applyWrite) snapshot = snapshot.copy(items = if (method.endsWith("rename")) snapshot.items.map { if (it.workspaceId == "one") it.copy(title = request.text("title")) else it } else snapshot.items.filterNot { it.workspaceId == "one" })
            onWrite?.invoke()
            if (uncertain) throw GatewayFailure("result-unknown")
            return if (method.endsWith("rename")) buildJsonObject { put("workspace", WireJson.encodeToJsonElement(snapshot.items.first { it.workspaceId == "one" })) }
                else buildJsonObject { put("deleted", true) }
        }
    }
    private suspend fun fixture(block: suspend (DeviceRepository, DeviceStore, Gateway) -> Unit) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val directory = File(context.cacheDir, "workspace-management-${UUID.randomUUID()}").apply { mkdirs() }
        val disk = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = disk) { File(directory, "vault.preferences_pb") })
        store.update { StoredDevices(devices = listOf(DeviceCredential("device", "Fixture", "https://fixture.example", "0".repeat(64), "fixture", "fixture-only", Long.MAX_VALUE)),
            recentDeviceId = "device", recentWorkspaceId = "one", drafts = listOf(ConversationDraft("device", "session", "保留草稿")),
            pendingSessions = listOf(PendingSession("device", "one", "unused"))) }
        val gateway = Gateway()
        val repo = DeviceRepository(store) { gateway }
        try {
            withTimeout(5000) { repo.state.first { it.loaded } }; repo.select("device"); withTimeout(5000) { repo.state.first { it.connected } }
            block(repo, store, gateway)
        } finally { repo.close(); disk.coroutineContext[Job]?.cancelAndJoin(); directory.deleteRecursively() }
    }
    @Test fun renamePublishesTitleAndPreservesPathAndDraft(): Unit = runBlocking {
        fixture { repo, store, gateway ->
            repo.manageWorkspace("device", "one", "rename", "  新名称  ")
            withTimeout(5000) { repo.state.first { it.connected } }
            val actual = repo.state.value.snapshot!!.items.first { it.workspaceId == "one" }
            assertEquals("新名称", actual.title); assertEquals("/repo/one", actual.path)
            assertEquals(listOf("session"), actual.sessionIds)
            assertEquals(listOf("workspace/rename"), gateway.writes)
            assertEquals("保留草稿", store.read().drafts.single().text)
            assertTrue(store.read().workspaceWrites.isEmpty())
        }
    }
    @Test fun deletionRemovesRegistrationAndRecentReferenceWithoutSessionOrFileWrites(): Unit = runBlocking {
        fixture { repo, store, gateway ->
            repo.openWorkspace(gateway.snapshot.items.first())
            withTimeout(5000) { repo.state.first { it.selectedWorkspace?.workspaceId == "one" } }
            repo.manageWorkspace("device", "one", "delete")
            withTimeout(5000) { repo.state.first { it.connected } }
            assertEquals(listOf("two"), repo.state.value.snapshot!!.items.map { it.workspaceId })
            assertNull(repo.state.value.selectedWorkspace); assertNull(repo.state.value.activeSessionId)
            assertEquals(listOf("workspace/delete"), gateway.writes)
            assertNull(store.read().recentWorkspaceId)
            assertEquals("保留草稿", store.read().drafts.single().text)
            assertTrue(store.read().pendingSessions.isEmpty())
        }
    }
    @Test fun lostDeleteResponseIsReconciledWithoutReplayingMutation(): Unit = runBlocking {
        fixture { repo, store, gateway ->
            gateway.uncertain = true
            repo.manageWorkspace("device", "one", "delete")
            assertEquals(listOf("workspace/delete"), gateway.writes)
            assertTrue(store.read().workspaceWrites.isEmpty())
            assertTrue(repo.state.value.snapshot!!.items.none { it.workspaceId == "one" })
        }
    }
    @Test fun unknownOutcomePersistsAndSyncOnlyReadsUntilConfirmed(): Unit = runBlocking {
        fixture { repo, store, gateway ->
            gateway.uncertain = true; gateway.applyWrite = false
            try { repo.manageWorkspace("device", "one", "rename", "新名称"); fail("unknown") }
            catch (failure: GatewayFailure) { assertEquals("workspace-result-unknown", failure.code) }
            assertEquals("新名称", store.read().workspaceWrites.single().title)
            try { repo.manageWorkspace("device", "one", "sync"); fail("still unknown") }
            catch (failure: GatewayFailure) { assertEquals("workspace-result-unknown", failure.code) }
            assertEquals(listOf("workspace/rename"), gateway.writes)
            gateway.snapshot = gateway.snapshot.copy(items = gateway.snapshot.items.map { if (it.workspaceId == "one") it.copy(title = "新名称") else it })
            repo.manageWorkspace("device", "one", "sync")
            assertTrue(store.read().workspaceWrites.isEmpty())
            assertEquals(listOf("workspace/rename"), gateway.writes)
        }
    }
    @Test fun duplicateBlankAndWrongDeviceAreRejectedBeforeWriting(): Unit = runBlocking {
        fixture { repo, store, gateway ->
            for ((device, name, expected) in listOf(Triple("device", "Two", "workspace/name-conflict"), Triple("device", " ", "invalid-title"), Triple("other", "New", "device-changed"))) {
                try { repo.manageWorkspace(device, "one", "rename", name); fail("must reject") }
                catch (failure: GatewayFailure) { assertEquals(expected, failure.code) }
            }
            assertTrue(gateway.writes.isEmpty()); assertTrue(store.read().workspaceWrites.isEmpty())
        }
    }
    @Test fun definiteRejectionClearsPendingIntentAndAllowsCorrection(): Unit = runBlocking {
        fixture { repo, store, gateway ->
            gateway.reject = "workspace/name-conflict"
            try { repo.manageWorkspace("device", "one", "rename", "新名称"); fail("conflict") }
            catch (failure: GatewayFailure) { assertEquals("workspace/name-conflict", failure.code) }
            assertTrue(store.read().workspaceWrites.isEmpty())
            assertFalse(repo.state.value.busy)
            gateway.reject = null
            repo.manageWorkspace("device", "one", "rename", "另一个名称")
            assertEquals("另一个名称", repo.state.value.snapshot!!.items.first { it.workspaceId == "one" }.title)
        }
    }
    @Test fun transportGenerationChangeRetainsIntentAndDoesNotPublishOldResult(): Unit = runBlocking {
        fixture { repo, store, gateway ->
            gateway.onWrite = { repo.pause() }
            try { repo.manageWorkspace("device", "one", "rename", "新名称"); fail("generation changed") }
            catch (failure: GatewayFailure) { assertEquals("device-changed", failure.code) }
            assertEquals("One", repo.state.value.snapshot!!.items.first { it.workspaceId == "one" }.title)
            assertEquals(1, store.read().workspaceWrites.size)
            gateway.onWrite = null
            repo.select("device"); withTimeout(5000) { repo.state.first { it.connected } }
            repo.manageWorkspace("device", "one", "sync")
            assertEquals(listOf("workspace/rename"), gateway.writes)
            assertTrue(store.read().workspaceWrites.isEmpty())
        }
    }
    @Test fun deletingDeviceAlsoRemovesItsPendingWorkspaceIntents(): Unit = runBlocking {
        fixture { repo, store, gateway ->
            gateway.uncertain = true; gateway.applyWrite = false
            try { repo.manageWorkspace("device", "one", "delete") } catch (_: GatewayFailure) { }
            assertEquals(1, store.read().workspaceWrites.size)
            repo.removeLocal("device")
            assertTrue(store.read().workspaceWrites.isEmpty())
            assertTrue(repo.state.value.workspaceWrites.isEmpty())
        }
    }

}
