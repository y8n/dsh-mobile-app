package dev.dsh.mobile

import androidx.datastore.core.Serializer
import androidx.datastore.preferences.core.*
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.*
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test
import java.io.*
import java.util.UUID

class AtomicVaultStorageTest {
    private fun file() = File(InstrumentationRegistry.getInstrumentation().targetContext.cacheDir, "atomic-vault-${UUID.randomUUID()}.preferences_pb")
    private fun state() = StoredDevices(listOf(DeviceCredential("owned", "Owned", "https://owned.example", "0".repeat(64), "owned", "fixture-only", Long.MAX_VALUE)), "owned")
    private suspend fun withVault(file: File, atomic: Boolean = true, codec: Serializer<Preferences> = VaultPreferencesSerializer, action: suspend (DeviceStore) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val data = if (atomic) PreferenceDataStoreFactory.create(storage = AtomicVaultStorage(codec) { file }, scope = scope)
            else PreferenceDataStoreFactory.create(scope = scope) { file }
        try { action(DeviceStore(data)) } finally { scope.coroutineContext[Job]?.cancelAndJoin() }
    }
    @Test fun existingEncryptedPreferencesRemainReadableInBothDirections() = runBlocking {
        val file = file()
        try {
            withVault(file, atomic = false) { it.update { state() } }
            withVault(file) { store ->
                assertTrue(store.read() == state())
                store.update { it.copy(recentWorkspaceId = "atomic-update") }
            }
            withVault(file, atomic = false) { assertTrue(it.read() == state().copy(recentWorkspaceId = "atomic-update")) }
        } finally { file.delete() }
    }
    @Test fun serializerFailurePreservesLastCommittedEncryptedBytes() = runBlocking {
        val file = file(); var fail = false
        val codec = object : Serializer<Preferences> by VaultPreferencesSerializer {
            override suspend fun writeTo(t: Preferences, output: OutputStream) {
                if (fail) { output.write("partial fixture".toByteArray()); throw IOException("Injected fixture failure") }
                VaultPreferencesSerializer.writeTo(t, output)
            }
        }
        try {
            withVault(file, codec = codec) { store ->
                store.update { state() }; val before = file.readBytes(); fail = true
                try { store.update { it.copy(recentWorkspaceId = "atomic-update") }; fail("Injected write must fail") }
                catch (error: GatewayFailure) { assertEquals("storage-unavailable", error.code) }
                assertArrayEquals(before, file.readBytes())
            }
            withVault(file) { assertTrue(it.read() == state()) }
        } finally { file.delete() }
    }
    @Test fun cancelledPartialWriteLeavesCommittedFileReadable() = runBlocking {
        val file = file(); val started = CompletableDeferred<Unit>()
        val codec = object : Serializer<String> {
            override val defaultValue = ""
            override suspend fun readFrom(input: InputStream) = input.readBytes().decodeToString()
            override suspend fun writeTo(t: String, output: OutputStream) {
                output.write(t.toByteArray())
                if (t == "unfinished") { started.complete(Unit); awaitCancellation() }
            }
        }
        val connection = AtomicVaultStorage(codec) { file }.createConnection()
        try {
            connection.writeScope { writeData("committed") }
            val writer = launch(Dispatchers.IO) { connection.writeScope { writeData("unfinished") } }
            withTimeout(5_000) { started.await() }; writer.cancelAndJoin()
            assertEquals("committed", connection.readScope { readData() })
            assertEquals("committed", file.readText())
        } finally { connection.close(); file.delete() }
    }
    @Test fun scopeFailureAfterSuccessfulStagingRollsBackAndReadSeesStagedValue() = runBlocking {
        val file = file()
        val codec = object : Serializer<String> {
            override val defaultValue = ""
            override suspend fun readFrom(input: InputStream) = input.readBytes().decodeToString()
            override suspend fun writeTo(t: String, output: OutputStream) { output.write(t.toByteArray()) }
        }
        val connection = AtomicVaultStorage(codec) { file }.createConnection()
        try {
            connection.writeScope { writeData("committed") }
            try {
                connection.writeScope {
                    writeData("staged"); assertEquals("staged", readData())
                    throw IOException("Injected scope failure after serialization")
                }
                fail("Scope must fail")
            } catch (_: IOException) { }
            assertEquals("committed", connection.readScope { readData() })
        } finally { connection.close(); file.delete() }
    }
    @Test fun missingMainWithLegacyStagingNeverBecomesAnEmptyVault() = runBlocking {
        val file = file(); val legacy = File(file.path + ".tmp")
        try {
            withVault(file, atomic = false) { it.update { state() } }
            assertTrue(file.renameTo(legacy)); val original = legacy.readBytes()
            withVault(file) { store ->
                try { store.read(); fail("Legacy interrupted commit must require recovery") }
                catch (error: GatewayFailure) { assertEquals("storage-unavailable", error.code) }
                try { store.update { state().copy(recentWorkspaceId = "atomic-update") }; fail("Must not overwrite unresolved legacy state") }
                catch (error: GatewayFailure) { assertEquals("storage-unavailable", error.code) }
            }
            assertFalse(file.exists()); assertArrayEquals(original, legacy.readBytes())
        } finally { file.delete(); legacy.delete() }
    }
    @Test fun foreignPreferenceTypesAreRejectedWithoutRewrite() = runBlocking {
        val file = file(); val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        try {
            val old = PreferenceDataStoreFactory.create(scope = scope) { file }
            old.edit { it[booleanPreferencesKey("foreign-type")] = true }
            scope.coroutineContext[Job]?.cancelAndJoin(); val original = file.readBytes()
            withVault(file) { store ->
                try { store.update { state() }; fail("Foreign preference must not be silently dropped") }
                catch (error: GatewayFailure) { assertEquals("storage-unavailable", error.code) }
            }
            assertArrayEquals(original, file.readBytes())
        } finally { scope.coroutineContext[Job]?.cancelAndJoin(); file.delete() }
    }
}
