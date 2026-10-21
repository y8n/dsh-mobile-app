package dev.dsh.mobile

import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.protocol.*
import dev.dsh.mobile.ui.LiveConversation
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.UUID

class ConversationEntryScrollTest {
    @get:Rule val compose=createComposeRule()
    @Test fun enteringAgainDiscardsRestoredHistoryPositionAndShowsEndOfTallFinalBubble() = checkEntry(false)
    @Test fun delayedHistoryLayoutStillShowsTailAndAllowsManualScroll() = checkEntry(true)
    private fun checkEntry(staged: Boolean): Unit = runBlocking {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val file=File(context.cacheDir,"entry-scroll-${UUID.randomUUID()}.preferences_pb")
        val disk=CoroutineScope(SupervisorJob()+Dispatchers.IO)
        val store=DeviceStore(PreferenceDataStoreFactory.create(scope=disk){file})
        store.update{StoredDevices(listOf(DeviceCredential("fixture","Fixture","https://fixture.example","0".repeat(64),"fixture","fixture-only",Long.MAX_VALUE)))}
        val gateway=object:DeviceGateway {
            override suspend fun probe()=Unit
            override fun close()=Unit
            override fun followWorkspaces()=flow { emit(WireJson.parseToJsonElement("""{"type":"baseline","value":{"items":[]}}""").jsonObject);awaitCancellation() }
            override fun follow(endpoint:String,args:JsonObject)=flow {
                if(endpoint=="session/follow") for (count in if (staged) listOf(10, 50) else listOf(50)) {
                if (count == 50 && staged) delay(750)
                emit(buildJsonObject {
                    put("type","snapshot");put("header",buildJsonObject{put("id","owned")});put("cursor",count - 1);put("hasMore",false)
                    put("records",buildJsonArray{repeat(count){index->add(buildJsonObject{put("event",buildJsonObject{
                        put("seq",index);put("type","user/message");put("data",buildJsonObject{
                            put("content",buildJsonArray{add(buildJsonObject{put("type","text");put("text",if(index==49)(1..60).joinToString("\n"){"最终消息第 $it 行"} else "历史消息 $index")})})
                        })
                    })})}})
                    put("projections",buildJsonObject{put("asOfSeq",count - 1);put("values",JsonObject(emptyMap()))})
                })
                }
                awaitCancellation()
            }
            override suspend fun rpc(method:String,args:JsonObject,mutation:Boolean):JsonElement {
                assertFalse(mutation)
                return when(method){"commands/list"->JsonArray(emptyList());"permissionPresets/catalog"->buildJsonObject{put("options",JsonArray(emptyList()))};else->JsonObject(emptyMap())}
            }
        }
        val devices=DeviceRepository(store){gateway};val shown=mutableStateOf(true)
        try {
            withTimeout(5000){devices.state.first{it.loaded}};devices.select("fixture");withTimeout(5000){devices.state.first{it.connected}}
            val session=devices.conversations()
            compose.setContent{DshTheme {
                val holder=rememberSaveableStateHolder()
                if(shown.value)holder.SaveableStateProvider("session"){LiveConversation("owned",session,"Fixture",{})} else Text("会话列表")
            }}
            fun assertAtEnd(){
                compose.waitUntil(10000){compose.onAllNodesWithTag("message_49").fetchSemanticsNodes().isNotEmpty()}
                compose.waitForIdle()
                compose.onNodeWithTag("message_49").assertIsDisplayed()
                val end=compose.onNodeWithTag("message_49").getUnclippedBoundsInRoot().bottom
                val composer=compose.onNodeWithTag("composer_input").getUnclippedBoundsInRoot().top
                assertTrue("Tail of final tall bubble must be above composer",end.value<=composer.value)
            }
            assertAtEnd()
            compose.onNode(hasScrollToIndexAction()).performScrollToIndex(0)
            compose.onNodeWithTag("message_0").assertIsDisplayed()
            compose.runOnIdle{shown.value=false};compose.onNodeWithText("会话列表").assertIsDisplayed()
            compose.runOnIdle{shown.value=true};assertAtEnd()
        }finally{devices.close();disk.coroutineContext[Job]?.cancelAndJoin();file.delete()}
    }
}
