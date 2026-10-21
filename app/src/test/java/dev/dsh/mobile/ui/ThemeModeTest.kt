package dev.dsh.mobile.ui

import dev.dsh.mobile.designsystem.ThemeMode
import org.junit.Assert.*
import org.junit.Test

class ThemeModeTest {
    @Test fun freshOrUnknownPreferenceFollowsSystem() {
        assertEquals(ThemeMode.System, ThemeMode.fromStored(null))
        assertEquals(ThemeMode.System, ThemeMode.fromStored("obsolete"))
        assertFalse(ThemeMode.System.isDark(false))
        assertTrue(ThemeMode.System.isDark(true))
    }
    @Test fun fixedChoiceOverridesSystemAndSurvivesSerialization() {
        for (systemDark in listOf(false, true)) {
            assertFalse(ThemeMode.fromStored(ThemeMode.Light.name).isDark(systemDark))
            assertTrue(ThemeMode.fromStored(ThemeMode.Dark.name).isDark(systemDark))
        }
    }
}
