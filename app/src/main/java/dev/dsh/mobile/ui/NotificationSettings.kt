package dev.dsh.mobile.ui

import android.Manifest
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import dev.dsh.mobile.designsystem.DshColors
import dev.dsh.mobile.notifications.SessionNotifications
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner

@Composable
fun NotificationSettings() {
    val context = LocalContext.current
    val prefs = remember(context) { SessionNotifications.prefs(context) }
    var enabled by remember { mutableStateOf(prefs.getBoolean("enabled", false)) }
    var permitted by remember { mutableStateOf(SessionNotifications.permitted(context)) }
    var status by remember { mutableStateOf(prefs.getString("status", "尚未开启").orEmpty()) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(prefs, lifecycle) {
        val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            enabled = prefs.getBoolean("enabled", false); status = prefs.getString("status", "尚未开启").orEmpty()
        }
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) {
            permitted = SessionNotifications.permitted(context)
            SessionNotifications.startIfEnabled(context)
        } }
        prefs.registerOnSharedPreferenceChangeListener(listener); lifecycle.addObserver(observer)
        onDispose { prefs.unregisterOnSharedPreferenceChangeListener(listener); lifecycle.removeObserver(observer) }
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        permitted = granted && SessionNotifications.permitted(context)
        SessionNotifications.enable(context, permitted)
    }
    HorizontalDivider(color = DshColors.Line)
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column {
            Text("会话通知", style = MaterialTheme.typography.titleMedium)

        }
        SettingsHelp("会话通知", "AI 回复完成、提问或申请权限时提醒；当前会话正在前台使用时不发送通知。通过老插件事件接收完成提醒，摘要、权限分类和补取依赖新插件，不显示常驻通知。系统结束 App、电脑离线或断网可能影响送达；华为需允许 App 后台运行。")
        Spacer(Modifier.weight(1f))
        Switch(enabled && permitted, { checked ->
            if (!checked) SessionNotifications.enable(context, false)
            else if (SessionNotifications.permitted(context)) { permitted = true; SessionNotifications.enable(context, true) }
            else if (Build.VERSION.SDK_INT >= 33) permission.launch(Manifest.permission.POST_NOTIFICATIONS)
            else context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
        })
    }
    val warning = if (enabled && !permitted) "系统通知权限未开启"
        else if (enabled && status !in setOf("正在接收会话通知", "正在连接通知", "尚未开启", "已关闭", "")) status
        else null
    warning?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = DshColors.Muted) }

}
