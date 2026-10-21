package dev.dsh.mobile

import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.DiagnosticRepository
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.UUID

class PublicDiagnosticsDefaultsTest {
    @Test fun publicBuildRetainsLogsAndCannotUploadEvenAfterOldOptIn() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val directory = File(context.cacheDir, "public-logs-${UUID.randomUUID()}")
        var repo = DiagnosticRepository(context, "0.2.0-beta.1", 35, directory) { report ->
            buildJsonObject { put("reportId", report.text("reportId")); put("accepted", report.getValue("events").jsonArray.size) }
        }
        try {
            repo.record(buildJsonObject {
                put("at", System.currentTimeMillis()); put("stage", "socket.failure"); put("trace", UUID.randomUUID().toString())
                put("endpoint", "mux"); put("durationMs", 1); put("status", 0); put("code", "reset"); put("attempt", 0)
            })
            repo.automatic(true); repo.flush(); assertTrue(repo.state.value.automatic); repo.close()
            repo = DiagnosticRepository(context, "0.2.0-beta.1", 35, directory)
            repo.flush()
            assertFalse(repo.uploadAvailable); assertFalse(repo.state.value.automatic)
            repo.automatic(true); repo.uploadAll(force = true)
            assertFalse(repo.state.value.automatic); assertEquals(1, repo.state.value.queued)
            assertNull(repo.state.value.lastReportId); assertNotNull(repo.state.value.error)
            repo.clear(); assertEquals(0, repo.state.value.queued)
        } finally { repo.close(); directory.deleteRecursively() }
    }
}
