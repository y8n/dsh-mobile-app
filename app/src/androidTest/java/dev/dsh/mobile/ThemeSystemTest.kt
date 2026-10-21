package dev.dsh.mobile

import androidx.activity.compose.setContent
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.designsystem.*
import dev.dsh.mobile.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class ThemeSystemTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    @Test fun systemSwitchPreservesActivityDraftAndFixedChoice() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = compose.activity.applicationContext
        val preference = ThemePreference(context)
        val original = preference.mode
        val originalNight = context.resources.configuration.uiMode and 48 == 32
        var background = Color.Unspecified
        val activity = compose.activity
        fun system(dark: Boolean) {
            instrumentation.uiAutomation.executeShellCommand("cmd uimode night ${if(dark) "yes" else "no"}").use { descriptor -> java.io.FileInputStream(descriptor.fileDescriptor).readBytes() }
        }
        try {
            compose.runOnIdle { preference.select(ThemeMode.System) }
            compose.activity.runOnUiThread { compose.activity.setContent {
                CompositionLocalProvider(LocalThemePreference provides preference) {
                    DshTheme(preference.mode.isDark(isSystemInDarkTheme())) {
                        background = MaterialTheme.colorScheme.background
                        var draft by remember { mutableStateOf("保留草稿") }
                        Column { ThemeSettings(); TextField(draft, { draft = it }) }
                    }
                }
            } }
            system(true); compose.waitUntil(12_000) { background == Color(0xFF111111) }
            compose.onNodeWithText("保留草稿").assertExists()
            system(false); compose.waitUntil(12_000) { background == Color.White }
            assertSame(activity, compose.activity)
            compose.onNodeWithText("保留草稿").assertExists()
            compose.runOnIdle { preference.select(ThemeMode.Dark) }
            system(false); compose.waitUntil(12_000) { background == Color(0xFF111111) }
            assertEquals(ThemeMode.Dark, ThemePreference(context).mode)
            compose.runOnIdle { preference.select(ThemeMode.Light) }
            system(true); compose.waitUntil(12_000) { background == Color.White }
            assertEquals(ThemeMode.Light, ThemePreference(context).mode)
        } finally { compose.runOnIdle { preference.select(original) }; system(originalNight) }
    }
}
