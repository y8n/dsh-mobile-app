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
import java.util.Base64
import java.util.UUID

class WorkspaceFileDownloaderTest {
    private suspend fun fixture(changed: Boolean = false, content: ByteArray? = null, block: suspend (DeviceRepository, File, MutableList<String>) -> Unit) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val root = File(context.cacheDir, "file-link-${UUID.randomUUID()}").apply { mkdirs() }
        val disk = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val vault = DeviceStore(PreferenceDataStoreFactory.create(scope = disk) { File(root, "vault.preferences_pb") })
        vault.update { StoredDevices(listOf(DeviceCredential("fixture", "Fixture", "https://fixture.example", "0".repeat(64), "fixture", "fixture-only", Long.MAX_VALUE))) }
        val calls = mutableListOf<String>(); var stats = 0
        val bytes = content ?: "# 电脑文档\n[下一份](../next.md)\n".toByteArray()
        val gateway = object : DeviceGateway {
            override suspend fun probe() = Unit
            override fun close() = Unit
            override fun followWorkspaces() = flow { emit(buildJsonObject { put("type", "baseline"); put("value", WireJson.encodeToJsonElement(WorkspaceSnapshot(emptyList()))) }); awaitCancellation() }
            override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
                assertFalse(mutation); calls.add(method)
                assertEquals("session", args.text("workspaceFileScopeId"))
                assertEquals("docs/说明.md", args.text("path"))
                val meta = buildJsonObject { put("version", if (changed && method == "workspaceFiles/stat" && stats >= 1) "new" else "v1"); put("absolutePath", "/repo/docs/说明.md"); put("bytes", bytes.size) }
                return when (method) {
                    "workspaceFiles/stat" -> { stats++; meta }
                    "workspaceFiles/readBytes" -> {
                        val range = args.getValue("options").jsonObject.getValue("range").jsonObject
                        val start = range.number("offset").toInt(); val end = start + range.number("length").toInt()
                        JsonObject(meta + mapOf("offset" to JsonPrimitive(start), "eof" to JsonPrimitive(end == bytes.size), "data" to JsonPrimitive(Base64.getEncoder().encodeToString(bytes.copyOfRange(start, end)))))
                    }
                    else -> error("unexpected method")
                }
            }
        }
        val devices = DeviceRepository(vault) { gateway }
        try {
            withTimeout(5000) { devices.state.first { it.loaded } }; devices.select("fixture"); withTimeout(5000) { devices.state.first { it.connected } }
            block(devices, File(root, "attachments"), calls)
        } finally { devices.close(); disk.coroutineContext[Job]?.cancelAndJoin(); root.deleteRecursively() }
    }
    @Test fun readsRemoteFileWithoutMutationsAndRetainsCanonicalBaseForLinks(): Unit = runBlocking {
        fixture { devices, cache, calls ->
            val item = WorkspaceFileDownloader(devices, cache).download(WorkspaceFileTarget("fixture", "session", "docs/说明.md"))
            assertEquals("/repo/docs/说明.md", item.metadata.text("absolutePath"))
            assertTrue(item.file.readText().startsWith("# 电脑文档"))
            assertEquals(listOf("workspaceFiles/stat", "workspaceFiles/readBytes", "workspaceFiles/stat"), calls)
        }
    }
    @Test fun changingFileIsRejectedAndTemporaryContentRemoved(): Unit = runBlocking {
        fixture(changed = true) { devices, cache, _ ->
            try { WorkspaceFileDownloader(devices, cache).download(WorkspaceFileTarget("fixture", "session", "docs/说明.md")); fail("changed file must fail") }
            catch (error: GatewayFailure) { assertEquals("file-changed", error.code) }
            assertTrue(cache.walkTopDown().none { it.isFile })
        }
    }
    @Test fun differentDeviceCannotReadAndDoesNotReachGateway(): Unit = runBlocking {
        fixture { devices, cache, calls ->
            try { WorkspaceFileDownloader(devices, cache).download(WorkspaceFileTarget("another-device", "session", "docs/说明.md")); fail("device mismatch") }
            catch (error: GatewayFailure) { assertEquals("device-changed", error.code) }
            assertTrue(calls.isEmpty())
        }
    }
    @Test fun multipleBinaryWindowsAreReassembledExactly(): Unit = runBlocking {
        val content = ByteArray(600_000) { (it % 256).toByte() }
        fixture(content = content) { devices, cache, calls ->
            val item = WorkspaceFileDownloader(devices, cache).download(WorkspaceFileTarget("fixture", "session", "docs/说明.md"))
            assertArrayEquals(content, item.file.readBytes())
            assertEquals(3, calls.count { it == "workspaceFiles/readBytes" })
        }
    }
    @Test fun emptyFileNeedsOnlyVersionChecks(): Unit = runBlocking {
        fixture(content = byteArrayOf()) { devices, cache, calls ->
            val item = WorkspaceFileDownloader(devices, cache).download(WorkspaceFileTarget("fixture", "session", "docs/说明.md"))
            assertEquals(0L, item.file.length())
            assertEquals(listOf("workspaceFiles/stat", "workspaceFiles/stat"), calls)
        }
    }

}
