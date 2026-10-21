package dev.dsh.mobile

import androidx.compose.material3.Surface
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.protocol.*
import dev.dsh.mobile.ui.*
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.UUID

class DeviceSettingsUiTest {
    @get:Rule val compose = createComposeRule()
    @Test fun loadingDoesNotRenderFalseEmptyStateAndMenuPinWorksOffline() {
        val state=mutableStateOf(DeviceState(loaded=true,selectedWorkspace=Workspace("w","/w","Work"),sessionsLoading=true))
        compose.setContent { DshTheme { Surface { LiveSessions(state.value,{}, {}, {}, {}, {_,_->}, {_,_,_->}) } } }
        compose.onNodeWithTag("sessions_loading").assertExists();compose.onNodeWithText("正在加载会话…").assertExists()
        val empty=InstrumentationRegistry.getInstrumentation().targetContext.getString(R.string.no_sessions)
        compose.onNodeWithText(empty).assertDoesNotExist()
        compose.runOnIdle { state.value=state.value.copy(sessionsLoading=false) }
        compose.onNodeWithTag("sessions_loading").assertDoesNotExist();compose.onNodeWithText(empty).assertExists()
    }
    @Test fun localPinActionIsAvailableWhenDisconnected() {
        var action:String?=null
        compose.setContent { DshTheme { Surface { SessionMenu("s","Session",false,false,false,{_,value,_->action=value}) } } }
        compose.onNodeWithTag("session_menu_s").performClick();compose.onNodeWithText("置顶").performClick()
        assertEquals("pin",action)
    }
    @Test fun clearRequiresConfirmationAndCancellationPreservesLocalData(): Unit = runBlocking {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val root=File(context.cacheDir,"settings-ui-${UUID.randomUUID()}")
        val local=LocalDeviceDataRepository(File(root,"local"))
        val diagnostics=DiagnosticRepository(context,"0.1.1-alpha.3",17,File(root,"logs"))
        val files=File(root,"files").apply{mkdirs()};File(files,"owned").writeText("cache")
        try {
            local.pin("device","session",true)
            compose.setContent { DshTheme { Surface { androidx.compose.foundation.layout.Column { LocalCacheSettings(local,diagnostics,files) } } } }
            compose.onNodeWithTag("clear_local_cache").performClick()
            compose.onNodeWithText("设备连接和未发送内容将保留。").assertExists()
            compose.onNodeWithText("取消").performClick()
            assertEquals(listOf("session"),local.state.value.pins["device"]);assertTrue(File(files,"owned").exists())
            compose.onNodeWithTag("clear_local_cache").performClick();compose.onNodeWithTag("confirm_clear_local_cache").performClick()
            compose.waitUntil(5000){local.state.value.pins.isEmpty() && !files.exists()}
            compose.onNodeWithText("已清除所选数据").assertExists()
        } finally { local.close();diagnostics.close();root.deleteRecursively() }
    }
}
