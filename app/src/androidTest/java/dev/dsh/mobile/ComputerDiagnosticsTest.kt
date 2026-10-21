package dev.dsh.mobile

import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.DiagnosticRepository
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.UUID

class ComputerDiagnosticsTest {
    private fun event()=buildJsonObject {put("at",System.currentTimeMillis());put("stage","socket.failure");put("trace",UUID.randomUUID().toString());put("endpoint","mux");put("durationMs",1);put("status",0);put("code","reset");put("attempt",0)}
    @Test fun localDefaultComputerSelectionPersistenceAndReceipt()=runBlocking {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val dir=File(context.cacheDir,"computer-logs-${UUID.randomUUID()}")
        var calls=0;var destination=""
        val upload:suspend(String,JsonObject)->JsonObject={id,report->calls++;destination=id;buildJsonObject{put("reportId",report.text("reportId"));put("accepted",report.getValue("events").jsonArray.size);put("localPath","/tmp/dsh-mobile-app-diagnostics-test/hours/test.json")}}
        var repo=DiagnosticRepository(context,"test",1,dir,computerUploader=upload)
        try {
            repo.record(event());repo.flush();assertFalse(repo.uploadAvailable);assertFalse(repo.state.value.automatic)
            repo.uploadAll(force=true);assertEquals(0,calls);assertEquals(1,repo.state.value.queued)
            repo.configureComputer("computer-a");assertEquals(0,calls);assertFalse(repo.state.value.automatic)
            repo.automatic(true);repo.flush();repo.close()
            repo=DiagnosticRepository(context,"test",1,dir,computerUploader=upload);repo.flush()
            assertEquals("computer-a",repo.state.value.computerId);assertTrue(repo.state.value.automatic)
            repo.uploadAll(force=true);assertEquals("computer-a",destination);assertEquals(0,repo.state.value.queued);assertTrue(repo.state.value.lastArchiveKey!!.startsWith("/tmp/"))
            repo.configureComputer("computer-b");assertFalse(repo.state.value.automatic);assertNull(repo.state.value.lastReportId)
            repo.clear();assertEquals("computer-b",repo.state.value.computerId)
        }finally{repo.close();dir.deleteRecursively()}
    }
    @Test fun offlineRetryKeepsReportIdentityAndRetiredCredentialsAreDeleted()=runBlocking {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val dir=File(context.cacheDir,"computer-retry-${UUID.randomUUID()}").apply{mkdirs()}
        File(dir,"receiver.enc").writeText("retired HTTP configuration")
        val ids=mutableListOf<String>()
        val upload:suspend(String,JsonObject)->JsonObject={_,r->ids+=r.text("reportId");throw java.io.IOException()}
        var repo=DiagnosticRepository(context,"test",1,dir,computerUploader=upload)
        try {
            repo.flush();assertFalse(File(dir,"receiver.enc").exists());repo.configureComputer("computer-a")
            repo.record(event());repo.uploadAll(force=true);assertEquals(1,repo.state.value.queued)
            repo.flush();repo.close();repo=DiagnosticRepository(context,"test",1,dir,computerUploader=upload)
            repo.uploadAll(force=true);assertEquals(1,repo.state.value.queued);assertEquals(2,ids.size);assertEquals(ids[0],ids[1])
        }finally{repo.close();dir.deleteRecursively()}
    }
}
