package dev.dsh.mobile.data

import android.os.Looper
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
import java.util.concurrent.atomic.AtomicInteger

/** Separate test-package vault, production serializer/storage, no actual paired devices. */
class DeviceMutationTest {
    private val instance = "0".repeat(64)
    private fun device(id: String) = DeviceCredential(id,id,"https://$id.example",instance,id,"fixture-$id",Long.MAX_VALUE)
    private suspend fun fixture(block: suspend (DeviceRepository, DeviceStore, AtomicInteger) -> Unit) {
        val root=File(InstrumentationRegistry.getInstrumentation().targetContext.cacheDir,"mutation-${UUID.randomUUID()}").apply { mkdirs() }
        val disk=CoroutineScope(SupervisorJob()+Dispatchers.IO)
        val vault=DeviceStore(PreferenceDataStoreFactory.create(storage=AtomicVaultStorage(VaultPreferencesSerializer){File(root,"vault.preferences_pb")},scope=disk))
        val local=LocalDeviceDataRepository(File(root,"local"))
        val closes=AtomicInteger()
        vault.update { StoredDevices(listOf(device("a"),device("b")),"a") }
        val repo=DeviceRepository(vault,local,pairer={ input,name,_,_ -> device("paired").copy(origin=input.origin,name=name,deviceToken="fixture-${input.origin}") }) {
            object:DeviceGateway {
                override suspend fun probe()=Unit
                override suspend fun rpc(method:String,args:JsonObject,mutation:Boolean):JsonElement=JsonNull
                override fun followWorkspaces():Flow<JsonObject> = flow {
                    emit(buildJsonObject { put("type","baseline");put("value",WireJson.encodeToJsonElement(WorkspaceSnapshot(emptyList()))) }); awaitCancellation()
                }
                override fun close() {
                    check(Looper.myLooper() != Looper.getMainLooper()) { "TLS closed on main thread" }
                    closes.incrementAndGet()
                    throw IllegalStateException("Fixture connection cleanup failure")
                }
            }
        }
        try {
            withTimeout(5000){repo.state.first{it.loaded}}
            repo.select("a");withTimeout(5000){repo.state.first{it.connected}}
            block(repo,vault,closes)
        } finally { repo.close();local.close();disk.coroutineContext[Job]?.cancelAndJoin();root.deleteRecursively() }
    }
    @Test fun repeatedConnectionSavesRenameAndDeleteSurviveCleanupFailure(): Unit = runBlocking {
        fixture { repo,vault,closes ->
            val credentials=vault.read().devices.first()
            withContext(Dispatchers.Main) { repo.configureConnections("a","primary") }
            withTimeout(5000){repo.state.first{it.connected}}
            withContext(Dispatchers.Main) { repo.configureConnections("a","primary") }
            withTimeout(5000){repo.state.first{it.connected}}
            withContext(Dispatchers.Main) { repo.renameDevice("a","  家里的电脑  ") }
            val renamed=vault.read().devices.first()
            assertEquals("家里的电脑",renamed.name)
            assertEquals(credentials.deviceToken,renamed.deviceToken)
            assertEquals(credentials.id,renamed.id)
            assertEquals("家里的电脑",repo.state.value.devices.first().name)
            withContext(Dispatchers.Main) { repo.removeLocal("a") }
            assertEquals(listOf("b"),repo.state.value.devices.map{it.id})
            assertEquals(listOf("b"),vault.read().devices.map{it.id})
            assertEquals("b",vault.read().defaultId)
            assertTrue(closes.get() >= 3)
            withContext(Dispatchers.Main) { repo.removeLocal("b") }
            assertTrue(repo.state.value.devices.isEmpty());assertTrue(vault.read().devices.isEmpty())
        }
    }
    @Test fun secondAddedConnectionPersistsAndNeverPropagatesOldSocketFailure(): Unit = runBlocking {
        fixture { repo,vault,closes ->
            val key="dsh1.$instance.${"A".repeat(43)}"
            withContext(Dispatchers.Main) { repo.pairConnection("a","https://lan.example",key,"局域网",false) }
            withTimeout(5000){repo.state.first{it.connected}}
            withContext(Dispatchers.Main) { repo.pairConnection("a","https://tunnel.example",key,"隧道",false) }
            val saved=vault.read().devices.first()
            assertEquals(3,saved.connections.size)
            assertEquals(setOf("https://a.example","https://lan.example","https://tunnel.example"),saved.connections.map{it.origin}.toSet())
            assertEquals(3,repo.state.value.devices.first().connections.size)
            assertTrue(closes.get() >= 2)
            assertNull(repo.state.value.error)
        }
    }
    @Test fun rejectedSettingsKeepCredentialsAndReportValidationError(): Unit = runBlocking {
        fixture { repo,vault,_ ->
            val before=vault.read()
            try { repo.configureConnections("a",remove="primary"); fail("last connection must remain") }
            catch (failure:GatewayFailure) { assertEquals("last-connection",failure.code) }
            assertEquals(before,vault.read())
            try { repo.configureConnections("a","missing"); fail("stale order must fail") }
            catch (failure:GatewayFailure) { assertEquals("invalid-connection-settings",failure.code) }
            assertEquals(before,vault.read())
            try { repo.renameDevice("a","   "); fail("blank name must fail") }
            catch (failure:GatewayFailure) { assertEquals("invalid-device-name",failure.code) }
            assertEquals(before,vault.read())
        }
    }
    @Test fun manualSelectionSurvivesRemovingAnotherRouteAndLegacyModeIsNormalized(): Unit = runBlocking {
        fixture { repo,vault,_ ->
            val key="dsh1.$instance.${"A".repeat(43)}"
            repo.pairConnection("a","https://lan.example",key,"LAN",false)
            repo.pairConnection("a","https://tunnel.example",key,"Tunnel",false)
            val selected=vault.read().devices.first().connections.single { it.origin=="https://tunnel.example" }
            repo.configureConnections("a",selected.id)
            repo.configureConnections("a",remove="primary")
            val saved=vault.read().devices.first()
            assertEquals(selected.id,saved.preferredConnectionId)
            assertEquals(selected.id,repo.state.value.devices.first().preferredConnectionId)
            assertEquals("fixed",saved.connectionMode)
            vault.update { prefs -> prefs.copy(devices=prefs.devices.map { if(it.id=="a")it.copy(connectionMode="priority") else it }) }
            val migrated=vault.read().devices.first()
            assertEquals("fixed",migrated.connectionMode)
            assertEquals(saved.preferredConnectionId,migrated.preferredConnectionId)
            assertEquals(saved.connections,migrated.connections)
        }
    }
}
