package dev.dsh.mobile

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import dev.dsh.mobile.data.ConversationState
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.ui.ConversationStats
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class ConversationStatsLayoutTest {
    @get:Rule val compose = createComposeRule()
    @Test fun tokensLeftContextRightAndBothInsetFromComposerEdges() {
        val state = ConversationState(projections = buildJsonObject {
            put("sessionStats", buildJsonObject { put("turns", 999) })
            put("tokenUsage", buildJsonObject { put("uncachedInputTokens", 12000); put("outputTokens", 3000); put("cacheReadTokens", 0); put("cacheWriteTokens", 0) })
            put("contextPressure", buildJsonObject { put("projectedTokens", 1500); put("contextWindow", 10000) })
        })
        compose.setContent { DshTheme { Surface { Column(Modifier.width(320.dp)) {
            Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(40.dp).testTag("composer_bounds"))
            ConversationStats(state)
        } } } }
        val token = compose.onNodeWithTag("conversation_stats_tokens", useUnmergedTree = true).assertTextEquals("1.50万 tokens").fetchSemanticsNode().boundsInRoot
        val context = compose.onNodeWithTag("conversation_stats_context", useUnmergedTree = true).assertTextEquals("上下文 15%").fetchSemanticsNode().boundsInRoot
        val input = compose.onNodeWithTag("composer_bounds").fetchSemanticsNode().boundsInRoot
        assertTrue(token.left > input.left); assertTrue(context.right < input.right)
        assertTrue(token.right < context.left)
        assertEquals(token.left - input.left, input.right - context.right, 1.5f)
        compose.onNodeWithText("999 轮", substring = true).assertDoesNotExist()
    }
}
