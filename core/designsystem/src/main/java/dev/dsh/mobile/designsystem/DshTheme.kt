package dev.dsh.mobile.designsystem

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

enum class ThemeMode { System, Light, Dark;
    companion object { fun fromStored(value: String?): ThemeMode = entries.firstOrNull { it.name == value } ?: System }
    fun isDark(systemDark: Boolean): Boolean = when (this) { System -> systemDark; Light -> false; Dark -> true }
}

private val LocalDarkTheme = androidx.compose.runtime.staticCompositionLocalOf { false }

object DshColors {
    private val dark: Boolean @Composable get() = LocalDarkTheme.current
    val Background: Color @Composable get() = if (dark) Color(0xFF111111) else Color.White
    val Ink: Color @Composable get() = if (dark) Color(0xFFE7E7E7) else Color(0xFF191919)
    val Muted: Color @Composable get() = if (dark) Color(0xFF9B9B9B) else Color(0xFF858585)
    val Line: Color @Composable get() = if (dark) Color(0xFF2D2D2D) else Color(0xFFEBEBEB)
    val Soft: Color @Composable get() = if (dark) Color(0xFF202020) else Color(0xFFF5F5F5)
    val Overlay: Color @Composable get() = if (dark) Color(0xFF282828) else Color.White
    val OnInk: Color @Composable get() = if (dark) Color(0xFF191919) else Color.White
    val Blue: Color @Composable get() = if (dark) Color(0xFF83B8F4) else Color(0xFF3976BF)
    val Tint: Color @Composable get() = if (dark) Color(0xFF1A293A) else Color(0xFFEFF5FB)
    val Green: Color @Composable get() = if (dark) Color(0xFF7AC8A2) else Color(0xFF168457)
    val Red: Color @Composable get() = if (dark) Color(0xFFF08C94) else Color(0xFFC64B52)
    val Danger: Color @Composable get() = if (dark) Color(0xFFB94B54) else Color(0xFFC64B52)
    val Added: Color @Composable get() = if (dark) Color(0xFF183327) else Color(0xFFE8F5E9)
    val Removed: Color @Composable get() = if (dark) Color(0xFF3B2125) else Color(0xFFFFEBEE)
    val Warning: Color @Composable get() = if (dark) Color(0xFF342C1D) else Color(0xFFFFF6E5)
}

private val typography = Typography(
    titleLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 20.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold),
    titleMedium = TextStyle(fontSize = 16.sp, lineHeight = 24.sp, fontWeight = FontWeight.Medium),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 26.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 22.sp),
    bodySmall = TextStyle(fontSize = 12.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.Medium),
)

/** System fonts include arbitrary Chinese and user content; design subsets are not shipped. */
@Composable
fun DshTheme(darkTheme: Boolean = androidx.compose.foundation.isSystemInDarkTheme(), content: @Composable () -> Unit) {
    androidx.compose.runtime.CompositionLocalProvider(LocalDarkTheme provides darkTheme) {
        val base = if (darkTheme) androidx.compose.material3.darkColorScheme() else lightColorScheme()
        val colors = base.copy(
            primary = DshColors.Ink, onPrimary = DshColors.OnInk,
            primaryContainer = DshColors.Soft, onPrimaryContainer = DshColors.Ink,
            secondary = DshColors.Ink, onSecondary = DshColors.OnInk,
            secondaryContainer = DshColors.Soft, onSecondaryContainer = DshColors.Ink,
            background = DshColors.Background, onBackground = DshColors.Ink,
            surface = DshColors.Background, onSurface = DshColors.Ink,
            surfaceVariant = DshColors.Soft, onSurfaceVariant = DshColors.Muted,
            outline = DshColors.Line, outlineVariant = DshColors.Line,
            error = DshColors.Red, onError = DshColors.Background,
            surfaceTint = Color.Transparent,
            surfaceContainer = DshColors.Overlay, surfaceContainerLow = DshColors.Overlay,
            surfaceContainerHigh = DshColors.Overlay, surfaceContainerHighest = DshColors.Soft,
        )
        MaterialTheme(colorScheme = colors, typography = typography, content = content)
    }
}

/** Dialogs own a separate Window; Activity system-bar appearance does not propagate. */
@Composable
fun DshDialog(
    onDismissRequest: () -> Unit,
    properties: androidx.compose.ui.window.DialogProperties = androidx.compose.ui.window.DialogProperties(),
    content: @Composable () -> Unit,
) {
    val dark = LocalDarkTheme.current
    androidx.compose.ui.window.Dialog(onDismissRequest, properties = properties) {
        val view = androidx.compose.ui.platform.LocalView.current
        androidx.compose.runtime.LaunchedEffect(view, dark) {
            // Compose updates Dialog window parameters after applying content. Apply
            // appearance on the next frame so inherited, previous-theme flags cannot win.
            androidx.compose.runtime.withFrameNanos { }
            val window = (view.parent as? androidx.compose.ui.window.DialogWindowProvider)?.window
            if (window != null) {
                androidx.core.view.WindowCompat.getInsetsController(window, view).apply {
                    isAppearanceLightStatusBars = !dark
                    isAppearanceLightNavigationBars = !dark
                }
            }
        }
        content()
    }
}
