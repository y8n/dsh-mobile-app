package dev.dsh.mobile.ui

import android.content.Context
import androidx.compose.runtime.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.KeyboardArrowRight
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import dev.dsh.mobile.designsystem.ThemeMode

class ThemePreference(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences("appearance", Context.MODE_PRIVATE)
    var mode by mutableStateOf(ThemeMode.fromStored(preferences.getString("theme", null)))
        private set
    fun select(value: ThemeMode) {
        preferences.edit().putString("theme", value.name).apply()
        mode = value
    }
}
val LocalThemePreference = staticCompositionLocalOf<ThemePreference?> { null }
private val ThemeMode.title: String get() = when (this) {
    ThemeMode.System -> "跟随系统"
    ThemeMode.Light -> "固定浅色主题"
    ThemeMode.Dark -> "固定深色主题"
}

@Composable
internal fun ThemeSettings() {
    val context = LocalContext.current
    val preference = LocalThemePreference.current ?: remember { ThemePreference(context) }
    var expanded by remember { mutableStateOf(false) }
    Text("主题", style = MaterialTheme.typography.titleMedium)
    Row(Modifier.fillMaxWidth().clickable { expanded = true }.padding(vertical = 12.dp).testTag("theme_settings"), verticalAlignment = Alignment.CenterVertically) {
        Text("外观", Modifier.weight(1f))
        Text(preference.mode.title, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Icon(Icons.Outlined.KeyboardArrowRight, null)
    }
    HorizontalDivider()
    if (expanded) AlertDialog(onDismissRequest = { expanded = false }, title = { Text("主题") }, text = {
        Column { ThemeMode.entries.forEach { mode ->
            Row(Modifier.fillMaxWidth().clickable { preference.select(mode); expanded = false }.testTag("theme_${mode.name}"), verticalAlignment = Alignment.CenterVertically) {
                RadioButton(preference.mode == mode, { preference.select(mode); expanded = false })
                Text(mode.title)
            }
        } }
    }, confirmButton = {})
}
