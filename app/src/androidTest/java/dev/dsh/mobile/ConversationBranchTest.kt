package dev.dsh.mobile

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.ui.ConversationWorkspaceSubtitle
import org.junit.Rule
import org.junit.Test

class ConversationBranchTest {
    @get:Rule val compose = createComposeRule()
    @Test fun branchAppearsUpdatesOpensFullNameAndHidesForNonGit() {
        val branch = mutableStateOf<String?>(null)
        compose.setContent { DshTheme { ConversationWorkspaceSubtitle("示例工作区", branch.value) } }
        compose.onNodeWithText("示例工作区").assertIsDisplayed()
        compose.onNodeWithTag("conversation_git_branch").assertDoesNotExist()
        compose.runOnIdle { branch.value = "feature/" + "long-name/".repeat(12) }
        compose.onNodeWithTag("conversation_git_branch").assertIsDisplayed().performClick()
        compose.onNodeWithText("当前分支").assertIsDisplayed()
        compose.onNodeWithText("关闭").performClick()
        compose.runOnIdle { branch.value = "main" }
        compose.onNodeWithText("main").assertIsDisplayed()
        compose.runOnIdle { branch.value = null }
        compose.onNodeWithTag("conversation_git_branch").assertDoesNotExist()
        compose.onNodeWithText("│").assertDoesNotExist()
    }
}
