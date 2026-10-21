package dev.dsh.mobile

import android.os.Bundle
import android.content.Intent
import dev.dsh.mobile.notifications.NotificationNavigation
import dev.dsh.mobile.notifications.SessionNotifications
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.SystemBarStyle
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.ui.DshApp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dev.dsh.mobile.ui.LiveGraph.diagnostics(this)
        NotificationNavigation.accept(intent)
        val initialPreference = dev.dsh.mobile.ui.ThemePreference(this)
        val initialDark = initialPreference.mode.isDark(
            resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK == android.content.res.Configuration.UI_MODE_NIGHT_YES)
        val initialStyle = if (initialDark) SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
            else SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT)
        window.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(if (initialDark) 0xFF111111.toInt() else android.graphics.Color.WHITE))
        enableEdgeToEdge(statusBarStyle = initialStyle, navigationBarStyle = initialStyle)
        val previewRoute = if (BuildConfig.DESIGN_PREVIEW) intent.getStringExtra("preview_route") else null
        setContent {
            val preference = androidx.compose.runtime.remember { initialPreference }
            val dark = preference.mode.isDark(androidx.compose.foundation.isSystemInDarkTheme())
            androidx.compose.runtime.SideEffect {
                val style = if (dark) SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
                    else SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT)
                enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
            }
            androidx.compose.runtime.CompositionLocalProvider(dev.dsh.mobile.ui.LocalThemePreference provides preference) {
                DshTheme(darkTheme = dark) { DshApp(previewRoute) }
            }
        }
    }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        NotificationNavigation.accept(intent)
    }
    override fun onPause() {
        dev.dsh.mobile.protocol.ConversationVisibility.hide()
        super.onPause()
    }
    override fun onStop() {
        dev.dsh.mobile.notifications.NotificationDiagnostics.visible(false)
        super.onStop()
    }
    override fun onStart() {
        super.onStart()
        dev.dsh.mobile.notifications.NotificationDiagnostics.visible(true)
        SessionNotifications.startIfEnabled(this)
    }
}
