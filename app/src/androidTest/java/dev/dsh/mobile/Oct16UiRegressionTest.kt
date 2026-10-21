package dev.dsh.mobile

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.protocol.*
import dev.dsh.mobile.ui.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class Oct16UiRegressionTest {
    @get:Rule val compose=createComposeRule()
    private fun goal(phase:String)=buildJsonObject { put("goal",buildJsonObject{put("id","g");put("revision",3);put("objective","检查文档");put("phase",phase)}) }
    @Test fun goalDockTracksPhaseAndCompleteHidesWithoutManualCleanup() {
        val state=mutableStateOf(ConversationState(deviceId="d",sessionId="s",connected=true,projections=buildJsonObject{put("goal",goal("active"))}))
        var action:String?=null;var reference:JsonObject?=null
        compose.setContent { DshTheme { Surface { Column { GoalControls(state.value,false,showCreateEntry=false){a,_,ref->action=a;reference=ref} } } } }
        compose.onNodeWithText("[进行中的目标] 检查文档").assertExists()
        compose.onNodeWithTag("goal_dock_pause").performClick();assertEquals("pause",action);assertEquals(JsonPrimitive(3),reference?.get("revision"))
        compose.runOnIdle {state.value=state.value.copy(projections=buildJsonObject{put("goal",goal("blocked"))})}
        compose.onNodeWithText("[受阻的目标] 检查文档").assertExists()
        compose.onNodeWithTag("goal_edit").performClick()
        compose.onNodeWithText("目标 token 预算：不可用").assertDoesNotExist()
        compose.runOnIdle {state.value=state.value.copy(projections=buildJsonObject{put("goal",goal("complete"))})}
        compose.onNodeWithTag("goal_dock").assertDoesNotExist();compose.onNodeWithTag("goal_page").assertDoesNotExist()
    }
    @Test fun workspaceCountAndAllSessionsUseSameArchiveFilter() {
        val ids=(1..11).map{"s$it"}
        val workspace=Workspace("w","/fixture","Fixture workspace",ids)
        val state=DeviceState(loaded=true,connected=true,selectedId="d",snapshot=WorkspaceSnapshot(listOf(workspace),ids.take(5)),selectedWorkspace=workspace,sessions=ids.map{SessionSummary(it,title=it)})
        val opened=mutableStateOf(false)
        compose.setContent { DshTheme { Surface {
            if(opened.value)LiveSessions(state,{}, {}, {}, {}, {_,_->}, {_,_,_->})
            else LiveWorkspaces(state,{}, {}, {}, {opened.value=true}, {})
        } } }
        compose.onNodeWithText("6 个会话").assertExists();compose.onNodeWithText("Fixture workspace").performClick()
        compose.onNodeWithTag("session_row_s1").assertDoesNotExist()
        compose.onNodeWithTag("session_row_s6").assertExists()
        compose.onNodeWithTag("session_filter_all").assertIsSelected()
    }
}
