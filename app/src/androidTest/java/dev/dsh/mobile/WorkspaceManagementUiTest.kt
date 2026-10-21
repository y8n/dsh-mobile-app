package dev.dsh.mobile

import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import dev.dsh.mobile.data.DeviceState
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.protocol.*
import dev.dsh.mobile.ui.LiveWorkspaces
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class WorkspaceManagementUiTest {
    @get:Rule val compose = createComposeRule()
    @Test fun menusRenameAndDeleteRequireExplicitConfirmation() {
        var state by mutableStateOf(DeviceState(selectedId = "device", connected = true, snapshot = WorkspaceSnapshot(listOf(Workspace("one", "/repo", "One")))))
        val actions = mutableListOf<String>()
        compose.setContent { DshTheme {
            LiveWorkspaces(state, {}, {}, {}, {}, {}, manage = { device, id, action, name ->
                assertEquals("device", device); assertEquals("one", id); actions += action
                state = state.copy(snapshot = WorkspaceSnapshot(if (action == "delete") emptyList() else listOf(Workspace("one", "/repo", name!!))))
            })
        } }
        compose.onNodeWithTag("workspace_menu_one").performClick()
        compose.onNodeWithText("重命名").performClick()
        compose.onNodeWithTag("workspace_rename_input").performTextReplacement("新名称")
        compose.onNodeWithTag("workspace_confirm_action").performClick()
        compose.onNodeWithText("新名称").assertIsDisplayed()
        compose.onNodeWithTag("workspace_menu_one").performClick()
        compose.onNodeWithText("删除工作区").performClick()
        compose.runOnIdle { assertEquals(listOf("rename"), actions) }
        compose.onNodeWithText("取消").performClick()
        compose.onNodeWithText("新名称").assertIsDisplayed()
        compose.onNodeWithTag("workspace_menu_one").performClick()
        compose.onNodeWithText("删除工作区").performClick()
        compose.onNodeWithTag("workspace_confirm_action").performClick()
        compose.runOnIdle { assertEquals(listOf("rename", "delete"), actions) }
        compose.onNodeWithTag("workspace_menu_one").assertDoesNotExist()
    }
}
