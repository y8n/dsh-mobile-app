package dev.dsh.mobile

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.text.TextLayoutResult
import dev.dsh.mobile.designsystem.*
import dev.dsh.mobile.protocol.*
import dev.dsh.mobile.ui.TranscriptMessage
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class UserMessageNewlineTest {
    @get:Rule val compose = createComposeRule()
    @Test fun composerNewlinesBecomeFourVisibleBubbleLines() {
        val input = "第一行\n第二行\n\n第四行"
        compose.setContent { DshTheme { Surface {
            var draft by remember { mutableStateOf("") }
            var sent by remember { mutableStateOf<MessageRow?>(null) }
            Column {
                sent?.let { TranscriptMessage(it, null, null, null) }
                MessageComposer(draft, { draft = it }, false, "Model", emptyList(), "", {}, {}, {}, {
                    sent = MessageRow(1, "user", draft, buildJsonArray { add(buildJsonObject { put("type", "text"); put("text", draft) }) })
                    draft = ""
                }, {})
            }
        } } }
        compose.onNodeWithTag("composer_input").performTextInput(input)
        compose.onNodeWithTag("composer_send").performClick()
        compose.onNodeWithText(input, useUnmergedTree = true).assertTextEquals(input)
        val layouts = mutableListOf<TextLayoutResult>()
        compose.onNodeWithText(input, useUnmergedTree = true).performSemanticsAction(androidx.compose.ui.semantics.SemanticsActions.GetTextLayoutResult) { it(layouts) }
        assertEquals(4, layouts.single().lineCount)
    }
}
