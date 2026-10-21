package dev.dsh.mobile

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Surface
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.protocol.*
import dev.dsh.mobile.ui.DiagnosticSettings
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.UUID

/** Opt-in real gateway test. Only creates a dedicated test pairing and synthetic diagnostic report. */
class ComputerDiagnosticsLiveTest {
    @get:Rule val compose=createComposeRule()
    @Test fun uploadFromSettingsToPairedDesktop()=runBlocking<Unit> {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val fixture=File(context.filesDir,"computer-diagnostics-live-fixture.json")
        assumeTrue("Explicit host fixture required",fixture.exists())
        val input=WireJson.parseToJsonElement(fixture.readText()).jsonObject
        fixture.delete()
        val before=DeviceStore(context).read()
        val directory=File(context.cacheDir,"computer-live-${UUID.randomUUID()}")
        val output=File(context.filesDir,"computer-diagnostics-live-report.json")
        val credential=GatewayClient.pair(PairingInput.parse(input.text("origin"),input.text("key")),"诊断上传验收",true)
        output.writeText(buildJsonObject{put("testDeviceId",credential.deviceId);put("passed",false)}.toString())
        val gateway=GatewayClient(credential)
        var report:JsonObject?=null
        val diagnostics=DiagnosticRepository(context,BuildConfig.VERSION_NAME,BuildConfig.VERSION_CODE,directory,
            computerUploader={id,value->assertEquals(credential.id,id);report=value;gateway.rpc("mobileDiagnostics/upload",buildJsonObject{put("report",value)}).jsonObject})
        try {
            val capabilities=gateway.rpc("mobileDiagnostics/capabilities").jsonObject
            assertTrue(capabilities.getValue("localOnly").jsonPrimitive.boolean)
            val trace=UUID.randomUUID().toString()
            diagnostics.record(buildJsonObject{put("at",System.currentTimeMillis());put("stage","socket.failure");put("trace",trace);put("endpoint","mux");put("durationMs",3);put("status",0);put("code","reset");put("attempt",0)})
            diagnostics.flush()
            compose.setContent{DshTheme{Surface{Column{DiagnosticSettings(diagnostics,credential.id)}}}}
            assertFalse(diagnostics.state.value.automatic)
            compose.onNodeWithTag("diagnostics_upload").assertIsEnabled().performClick()
            compose.waitUntil(60000){diagnostics.state.value.lastReportId!=null || diagnostics.state.value.error!=null}
            assertNull(diagnostics.state.value.error);assertEquals(0,diagnostics.state.value.queued)
            val receipt=gateway.rpc("mobileDiagnostics/upload",buildJsonObject{put("report",report!!)}).jsonObject
            assertEquals(diagnostics.state.value.lastReportId,receipt.text("reportId"));assertEquals(1,receipt.number("accepted").toInt())
            compose.onNodeWithTag("diagnostics_copy_location").assertIsEnabled().performClick()
            File(context.filesDir,"computer-diagnostics-live.png").outputStream().use{compose.onRoot().captureToImage().asAndroidBitmap().compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)}
            assertEquals(before,DeviceStore(context).read())
            output.writeText(buildJsonObject{put("testDeviceId",credential.deviceId);put("passed",true);put("normalVaultPreserved",true);put("trace",trace);put("reportId",receipt.text("reportId"));put("localPath",receipt.text("localPath"));put("accepted",1);put("duplicateReceiptMatched",true)}.toString())
        }finally{diagnostics.close();gateway.close();directory.deleteRecursively()}
    }
}
