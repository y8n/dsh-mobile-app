package dev.dsh.mobile

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.protocol.*
import dev.dsh.mobile.ui.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.UUID

class TurnFileCardTest {
    @get:Rule val compose = createComposeRule()
    private class Gateway(val missing: Boolean) : DeviceGateway {
        val reads = java.util.concurrent.CopyOnWriteArrayList<Triple<String,Long,Int?>>()
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow { emit(WireJson.parseToJsonElement("""{"type":"baseline","value":{"items":[]}}""").jsonObject); awaitCancellation() }
        override fun follow(endpoint: String, args: JsonObject) = flow {
            when(endpoint) {
                "session/follow" -> emit(buildJsonObject {
                    put("type","snapshot"); put("header",buildJsonObject { put("id","owned") }); put("cursor",14); put("hasMore",false)
                    put("records",buildJsonArray {
                        fun event(seq: Int, type: String, turn: Int, text: String? = null) { add(buildJsonObject {
                            put("event",buildJsonObject { put("seq",seq); put("type",type); put("data",buildJsonObject {
                                put("turn",turn)
                                if (type=="assistant/message") { put("step",1); put("message",buildJsonObject { put("content",buildJsonArray { add(buildJsonObject { put("type","text"); put("text",text!!) }) }) }) }
                                if (type=="turn/end") put("reason",buildJsonObject { put("kind","completed") })
                            }) })
                        }) }
                        event(0,"turn/start",1); event(5,"workspace/changes",1); event(6,"assistant/message",1,"日报已完成。"); event(8,"turn/end",1)
                        event(9,"turn/start",2); event(11,"workspace/changes",2); event(12,"assistant/message",2,"第二轮已完成。"); event(14,"turn/end",2)
                    })
                })
                "session/control" -> emit(WireJson.parseToJsonElement("""{"type":"baseline","value":{"projections":{}}}""").jsonObject)
                else -> emit(buildJsonObject { put("type","ready"); put("clientId","fixture") })
            }
            awaitCancellation()
        }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement = if (method=="permissionPresets/catalog") buildJsonObject { put("options",buildJsonArray {}) } else JsonObject(emptyMap())
        override suspend fun readChanges(sessionId: String, seq: Long, index: Int?): JsonObject {
            reads += Triple(sessionId,seq,index)
            if (missing) throw GatewayFailure("changes-unavailable")
            if (index != null) return WireJson.parseToJsonElement("""{"kind":"text","path":"/notes/second.md","display":"second.md","before":true,"after":true,"coarse":false,"hunks":[{"oldStart":1,"oldLines":1,"newStart":1,"newLines":1,"lines":["-before snapshot","+after snapshot"]}]}""").jsonObject
            val name=if(seq==5L) "2026-10-15.md" else "second.md"
            return WireJson.parseToJsonElement("""{"turn":${if(seq==5L)1 else 2},"total":1,"added":145,"deleted":0,"files":[{"path":"/notes/$name","display":"$name","added":145,"deleted":0}]}""").jsonObject
        }
    }
    private fun runScreen(missing: Boolean = false, verify: (Gateway) -> Unit) = runBlocking {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val scope=CoroutineScope(SupervisorJob()+Dispatchers.IO)
        val store=DeviceStore(PreferenceDataStoreFactory.create(scope=scope) { File(context.cacheDir,"turn-card-${UUID.randomUUID()}.preferences_pb") })
        store.update { StoredDevices(listOf(DeviceCredential("a","fixture","https://fixture.example","0".repeat(64),"a","test-only",Long.MAX_VALUE))) }
        val gateway=Gateway(missing); val devices=DeviceRepository(store) { gateway }
        try {
            withTimeout(5000) { devices.state.first { it.loaded } }; devices.select("a"); withTimeout(5000) { devices.state.first { it.connected } }
            compose.setContent {
                var selection by remember { mutableStateOf<Pair<Long,Int>?>(null) }
                DshTheme { Surface(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
                    if (selection==null) LiveConversation("owned",devices.conversations(),"workspace",{},changes={ _, _, seq, index -> selection=seq to index })
                    else TurnChangesViewer(devices,"owned","a",selection!!.first,selection!!.second) { selection=null }
                } }
            }
            compose.waitUntil(5000) { gateway.reads.count { it.third==null }>=2 }
            compose.waitForIdle(); verify(gateway)
        } finally { devices.close(); scope.cancel() }
    }
    @Test fun cardsBelongToTheirClosingRepliesAndOpenExactSnapshot() = runScreen { gateway ->
        compose.onNodeWithText("查看文件改动").assertDoesNotExist()
        compose.onNodeWithText("已编辑 2026-10-15.md").assertIsDisplayed()
        val reply=compose.onNodeWithTag("message_6").fetchSemanticsNode().boundsInRoot
        val card=compose.onNodeWithTag("changed_files_5").fetchSemanticsNode().boundsInRoot
        val copy=compose.onNodeWithTag("copy_message_6").fetchSemanticsNode().boundsInRoot
        assertTrue(card.top>=reply.bottom && copy.top>=card.bottom)
        shot("turn-file-cards")
        compose.onNodeWithTag("changed_files_11").performScrollTo().performClick()
        compose.waitUntil(5000) { compose.onAllNodesWithText("+ after snapshot").fetchSemanticsNodes().isNotEmpty() }
        assertEquals(Triple("owned",11L,0),gateway.reads.last())
        compose.onNodeWithText("- before snapshot").assertIsDisplayed()
        shot("turn-file-diff")
    }
    @Test fun unavailableHostSummaryDoesNotCreateAPlaceholderCard() = runScreen(true) {
        compose.onNodeWithTag("changed_files_5").assertDoesNotExist()
        compose.onNodeWithTag("changed_files_11").assertDoesNotExist()
        compose.onNodeWithText("查看文件改动").assertDoesNotExist()
        compose.onNodeWithText("日报已完成。").assertIsDisplayed()
    }
    @Test fun multipleFilesFoldAtFourAndKeepOriginalIndices() {
        var selected = -1
        val files = (0..5).map { TurnChangedFile("/notes/report$it.md", "report$it.md", 3, 1, false, false) }
        compose.setContent { DshTheme { Surface { ChangedFilesCard(TurnChangeSummary(1, files, 6, 18, 6), 20) { selected=it } } } }
        compose.onNodeWithText("已编辑 6 个文件").assertIsDisplayed()
        compose.onNodeWithText("report5.md").assertDoesNotExist()
        compose.onNodeWithTag("changed_files_expand_20").performClick()
        compose.onNodeWithText("report5.md").performClick()
        assertEquals(5, selected)
        shot("turn-multiple-files")
    }
    private fun shot(name: String) {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        File(context.filesDir,"$name.png").outputStream().use { InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot().compress(android.graphics.Bitmap.CompressFormat.PNG,100,it) }
    }
}
