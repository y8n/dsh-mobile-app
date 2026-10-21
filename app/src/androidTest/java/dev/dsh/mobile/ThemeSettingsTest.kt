package dev.dsh.mobile

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.designsystem.ThemeMode
import dev.dsh.mobile.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class ThemeSettingsTest {
    @get:Rule val compose = createComposeRule()
    @Test fun selectPersistsAndRecomposesPalette() {
        lateinit var preference: ThemePreference
        var background = Color.Unspecified
        compose.setContent {
            val context = LocalContext.current
            preference = androidx.compose.runtime.remember { ThemePreference(context) }
            CompositionLocalProvider(LocalThemePreference provides preference) {
                DshTheme(darkTheme = preference.mode.isDark(false)) {
                    background = MaterialTheme.colorScheme.background
                    Column { ThemeSettings() }
                }
            }
        }
        val original = preference.mode
        try {
            compose.onNodeWithTag("theme_settings").performClick()
            compose.onNodeWithTag("theme_Dark").performClick()
            compose.runOnIdle { assertEquals(Color(0xFF111111), background) }
            compose.onNodeWithTag("theme_settings").performClick()
            compose.onNodeWithTag("theme_Light").performClick()
            compose.runOnIdle { assertEquals(Color.White, background) }
        } finally { compose.runOnIdle { preference.select(original) } }
    }
}
