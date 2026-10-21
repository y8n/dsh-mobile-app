package dev.dsh.mobile

import android.content.ClipboardManager
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Surface
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.ui.SessionMenu
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class SessionMenuCopyTest {
    @get:Rule val compose = createComposeRule()
    @Test fun listAndDetailMenusCopyFullIdWithoutRemoteActions() {
        val ids = listOf("session-list-123456789", "session-detail-987654321")
        compose.setContent { DshTheme { Surface { Column { ids.forEach { id ->
            SessionMenu(id, "同名会话", false, false, true, { _, _, _ -> error("Copy must not call the desktop") })
        } } } } }
        for (id in ids) {
            compose.onNodeWithTag("session_menu_$id").performClick()
            compose.onNodeWithTag("session_copy_id_$id").performClick()
            compose.runOnIdle {
                val clipboard = InstrumentationRegistry.getInstrumentation().targetContext.getSystemService(ClipboardManager::class.java)
                assertEquals(id, clipboard.primaryClip!!.getItemAt(0).text.toString())
            }
            compose.onNodeWithTag("session_copy_id_$id").assertDoesNotExist()
        }
    }
}
