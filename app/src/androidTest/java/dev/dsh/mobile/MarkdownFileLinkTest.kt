package dev.dsh.mobile

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.semantics.SemanticsActions
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class MarkdownFileLinkTest {
    @get:Rule val compose = createComposeRule()
    @Test fun renderedMarkdownClickResolvesAgainstRemoteDocumentWithoutRewritingSource() {
        val source = "[项目交接](../项目交接.md)"
        var selected: String? = null
        compose.setContent { DshTheme {
            CompositionLocalProvider(LocalMarkdownFileContext provides MarkdownFileContext("session", "/repo/docs/index.md") { selected = it }) {
                MarkdownContent(source)
            }
        } }
        compose.waitUntil { compose.onAllNodesWithText("项目交接").fetchSemanticsNodes().isNotEmpty() }
        val node = compose.onNodeWithText("项目交接")
        val layouts = mutableListOf<TextLayoutResult>()
        node.performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
        val box = layouts.single().getBoundingBox(1)
        node.performTouchInput { click(Offset(box.center.x, box.center.y)) }
        compose.runOnIdle { assertEquals("/repo/docs/../项目交接.md", selected); assertEquals("[项目交接](../项目交接.md)", source) }
    }
}
