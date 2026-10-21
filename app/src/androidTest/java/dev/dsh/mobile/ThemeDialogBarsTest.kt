package dev.dsh.mobile

import android.view.Window
import androidx.compose.runtime.*
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.SystemBarStyle
import androidx.compose.ui.window.DialogWindowProvider
import androidx.core.view.WindowCompat
import dev.dsh.mobile.designsystem.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class ThemeDialogBarsTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    @Test fun dialogOwnWindowTracksEffectiveTheme() {
        val dark = mutableStateOf(true)
        var window: Window? = null
        compose.activity.runOnUiThread { compose.activity.setContent {
            SideEffect {
                val style = if (dark.value) SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
                    else SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT)
                compose.activity.enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
            }
            DshTheme(dark.value) { DshDialog({}) {
                val view = LocalView.current
                SideEffect { window = (view.parent as DialogWindowProvider).window }
                Surface { Text("全屏弹窗主题") }
            } }
        }
        }
        compose.mainClock.advanceTimeByFrame()
        compose.waitForIdle()
        compose.runOnIdle {
            val w = window!!
            assertFalse(WindowCompat.getInsetsController(w, w.decorView).isAppearanceLightStatusBars)
            assertFalse(WindowCompat.getInsetsController(w, w.decorView).isAppearanceLightNavigationBars)
            dark.value = false
        }
        compose.mainClock.advanceTimeByFrame()
        compose.waitForIdle()
        compose.runOnIdle {
            val w = window!!
            assertTrue(WindowCompat.getInsetsController(w, w.decorView).isAppearanceLightStatusBars)
            assertTrue(WindowCompat.getInsetsController(w, w.decorView).isAppearanceLightNavigationBars)
        }
    }
}
