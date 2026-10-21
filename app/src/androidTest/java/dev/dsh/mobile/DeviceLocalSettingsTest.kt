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

class DeviceLocalSettingsTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private fun credential(id: String) = DeviceCredential(id,id,"https://$id.example","same",id,"test-only",Long.MAX_VALUE)
    @Test fun defaultDeviceDeletionLocalPinAndCacheIsolation() = runBlocking {
        val directory=File(context.cacheDir,"device-settings-${UUID.randomUUID()}").apply { mkdirs() }
        val storageScope=CoroutineScope(SupervisorJob()+Dispatchers.IO)
        val file=File(directory,"vault.preferences_pb")
        val store=DeviceStore(PreferenceDataStoreFactory.create(scope=storageScope) { file })
        val local=LocalDeviceDataRepository(File(directory,"local"))
        val calls=mutableListOf<String>()
        val workspace=Workspace("w","/w","Work",listOf("s"))
        val gateway=object:DeviceGateway {
            override fun close()=Unit
            override suspend fun probe()=Unit
            override fun followWorkspaces():Flow<JsonObject> = flow { emit(buildJsonObject { put("type","baseline");put("value",WireJson.encodeToJsonElement(WorkspaceSnapshot(listOf(workspace),pinnedSessionIds=listOf("desktop-only")))) });awaitCancellation() }
            override suspend fun rpc(method:String,args:JsonObject,mutation:Boolean):JsonElement { calls+=method;return buildJsonObject { put("items",JsonArray(emptyList())) } }
        }
        var repo:DeviceRepository?=null
        try {
            assertNull(store.read().defaultId)
            store.update { StoredDevices(listOf(credential("a"),credential("b"))) }
            assertEquals("a",store.read().defaultId)
            store.update { it.copy(defaultId="missing") };assertEquals("a",store.read().defaultId)
            repo=DeviceRepository(store,local) { gateway };withTimeout(5000){repo.state.first{it.loaded}}
            repo.resume();withTimeout(5000){repo.state.first{it.connected}}
            assertEquals("a",repo.state.value.selectedId);assertNull(repo.state.value.selectedWorkspace)
            repo.clearStartup();repo.openWorkspace(workspace)
            withTimeout(5000){repo.state.first{!it.sessionsLoading && it.selectedWorkspace != null}}
            repo.manageSession("s","pin");assertEquals(listOf("s"),local.state.value.pins["a"])
            assertFalse(calls.any{it.contains("pinSession",ignoreCase=true)})
            val before=store.read();val bytes=file.readBytes();local.clear();assertEquals(before,store.read());assertArrayEquals(bytes,file.readBytes())
            repo.removeLocal("a");assertEquals("b",store.read().defaultId);assertEquals("b",repo.state.value.selectedId)
            repo.removeLocal("b");assertTrue(store.read().devices.isEmpty());assertNull(store.read().defaultId);assertNull(repo.state.value.selectedId)
        } finally { repo?.close();local.close();storageScope.coroutineContext[Job]?.cancelAndJoin();directory.deleteRecursively() }
    }
    @Test fun diagnosticsDefaultsToLocalAndClearPreservesNoPendingUpload() = runBlocking {
        val directory=File(context.cacheDir,"diagnostic-default-${UUID.randomUUID()}")
        var uploaded=0
        val repo=DiagnosticRepository(context,"0.1.1-alpha.3",17,directory){ report -> uploaded++;buildJsonObject{put("reportId",report.text("reportId"));put("accepted",report.getValue("events").jsonArray.size)} }
        try {
            repo.record(buildJsonObject { put("at",System.currentTimeMillis());put("stage","socket.failure");put("trace",UUID.randomUUID().toString());put("endpoint","mux");put("durationMs",0);put("status",0);put("code","reset");put("attempt",0) })
            repo.flush();assertFalse(repo.state.value.automatic);repo.upload();assertEquals(0,uploaded);assertEquals(1,repo.state.value.queued)
            repo.clear();assertEquals(0,repo.state.value.queued);assertNull(repo.state.value.lastReportId);assertFalse(repo.state.value.automatic)
        }finally{repo.close();directory.deleteRecursively()}
    }
}
