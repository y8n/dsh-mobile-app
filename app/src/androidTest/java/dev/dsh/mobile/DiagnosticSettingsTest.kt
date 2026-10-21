package dev.dsh.mobile

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.DiagnosticRepository
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.protocol.*
import dev.dsh.mobile.ui.DiagnosticSettings
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.UUID

class DiagnosticSettingsTest {
    @get:Rule val compose = createComposeRule()
    @Test fun choosePairedComputerDoesNotUploadOrEnableAutomatically() = runBlocking<Unit> {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val directory=File(context.cacheDir,"computer-settings-${UUID.randomUUID()}")
        var calls=0
        val repo=DiagnosticRepository(context,"test",1,directory,computerUploader={_,r->calls++;buildJsonObject{put("reportId",r.text("reportId"));put("accepted",1)}})
        try {
            repo.flush()
            repo.configureComputer("a"); repo.automatic(true)
            compose.setContent { DshTheme { androidx.compose.material3.Surface { Column { DiagnosticSettings(repo,"b") } } } }
            compose.onNodeWithTag("diagnostics_computer_select").assertDoesNotExist()
            compose.onNodeWithTag("diagnostics_automatic").assertIsOff()
            assertEquals("a",repo.state.value.computerId)
            assertTrue(repo.state.value.automatic);assertEquals(0,calls)
            compose.onNodeWithTag("diagnostics_automatic").performClick()
            compose.waitUntil(5000){repo.state.value.computerId=="b" && repo.state.value.automatic}
            assertEquals(0,calls)
        } finally {repo.close();directory.deleteRecursively()}
    }
    @Test fun toggleAndManualUploadShowPersistedReportId() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val directory = File(context.cacheDir,"diagnostic-settings-${UUID.randomUUID()}")
        val repo = DiagnosticRepository(context,BuildConfig.VERSION_NAME,BuildConfig.VERSION_CODE,directory) { report ->
            buildJsonObject { put("reportId",report.text("reportId")); put("accepted",report.getValue("events").jsonArray.size) }
        }
        try {
            repo.record(buildJsonObject {
                put("at",System.currentTimeMillis()); put("stage","socket.failure"); put("trace",UUID.randomUUID().toString())
                put("endpoint","mux"); put("durationMs",100); put("status",0); put("code","reset"); put("attempt",0)
            })
            withTimeout(5000) { repo.state.first { it.queued == 1 } }
            compose.setContent { DshTheme { androidx.compose.material3.Surface { Column(Modifier.padding(20.dp)) { DiagnosticSettings(repo) } } } }
            assertFalse(repo.state.value.automatic)
            repo.automatic(true)
            compose.waitUntil(5000) { repo.state.value.automatic }
            compose.onNodeWithTag("diagnostics_automatic").performClick()
            compose.waitUntil(5000) { !repo.state.value.automatic }
            compose.onNodeWithTag("diagnostics_upload").performClick()
            compose.waitUntil(5000) { repo.state.value.lastReportId != null }
            compose.onNodeWithTag("diagnostics_report_id").assertHasClickAction()
            compose.onNodeWithTag("diagnostics_copy_report").assertIsEnabled()
            compose.onNodeWithTag("diagnostics_local_count", useUnmergedTree = true).assertTextEquals("本地0条日志")
            assertEquals(0,repo.state.value.queued)
            File(context.filesDir,"diagnostic-settings.png").outputStream().use {
                compose.onRoot().captureToImage().asAndroidBitmap().compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)
                Unit
            }
        } finally { repo.close(); directory.deleteRecursively() }
    }
}
