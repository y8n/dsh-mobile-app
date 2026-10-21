package dev.dsh.mobile.notifications

import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import dev.dsh.mobile.MainActivity
import dev.dsh.mobile.R
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

/** No authentication material or message bodies travel through notification intents. */
data class NotificationTarget(val deviceId: String, val sessionId: String, val requestId: String)
object NotificationNavigation {
    private val mutable = MutableStateFlow<NotificationTarget?>(null)
    val target = mutable.asStateFlow()
    fun accept(intent: Intent?) {
        if (intent?.action != "dev.dsh.mobile.OPEN_SESSION") return
        val device = intent.getStringExtra("device")?.takeIf { it.length in 1..200 } ?: return
        val session = intent.getStringExtra("session")?.takeIf { it.length in 1..200 } ?: return
        mutable.value = NotificationTarget(device, session, intent.dataString.orEmpty())
        intent.removeExtra("device"); intent.removeExtra("session")
    }
    fun consumed(target: NotificationTarget) { mutable.compareAndSet(target, null) }
}

object SessionNotifications {
    private var receiver: SessionNotificationReceiver? = null
    const val COMPLETE = "session_complete"
    const val CONFIRM = "session_confirmation"
    const val PERMISSION = "session_permission"
    fun prefs(context: Context) = context.getSharedPreferences("session_notifications", Context.MODE_PRIVATE)
    fun permitted(context: Context): Boolean = (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) && NotificationManagerCompat.from(context).areNotificationsEnabled()
    fun channels(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannels(listOf(
            NotificationChannel(COMPLETE, "AI 处理完成", NotificationManager.IMPORTANCE_DEFAULT),
            NotificationChannel(CONFIRM, "AI 提问", NotificationManager.IMPORTANCE_HIGH),
            NotificationChannel(PERMISSION, "权限申请", NotificationManager.IMPORTANCE_HIGH),
        ))
    }
    @Synchronized fun startIfEnabled(context: Context) {
        val app = context.applicationContext
        // Retire the beta.8 foreground connection on upgrade. No service is started again.
        app.stopService(Intent().setClassName(app, "dev.dsh.mobile.notifications.SessionNotificationService"))
        app.getSystemService(NotificationManager::class.java).apply {
            cancel(1)
            deleteNotificationChannel("session_connection")
        }
        channels(app)
        if (prefs(app).getBoolean("enabled", false) && permitted(app)) {
            if (receiver == null) receiver = SessionNotificationReceiver(app) else receiver?.refresh()
        } else { receiver?.stop(); receiver = null }
    }
    @Synchronized fun enable(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean("enabled", enabled).putString("status", if (enabled) "正在连接通知" else "已关闭").apply()
        startIfEnabled(context)
    }
    fun tap(context: Context, device: String, session: String, id: String): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = "dev.dsh.mobile.OPEN_SESSION"
            data = Uri.Builder().scheme("dsh-notification").authority("session").appendPath(device).appendPath(session).appendQueryParameter("event", id).build()
            putExtra("device", device); putExtra("session", session)
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    fun post(context: Context, device: DeviceCredential, event: SessionNotificationEvent): Boolean {
        if (ConversationVisibility.isVisible(device.id, event.sessionId)) {
            // Treat as consumed: returning to the background must not replay what the user already saw.
            NotificationDiagnostics.event("notification.skipped", event.id)
            return true
        }
        if (!permitted(context)) {
            NotificationDiagnostics.event("notification.skipped", event.id, code = "notification-permission-required"); return false
        }
        val channelId = when (event.kind) {
            SessionNotificationKind.COMPLETED -> COMPLETE
            SessionNotificationKind.QUESTION -> CONFIRM
            SessionNotificationKind.PERMISSION -> PERMISSION
        }
        val icon = when (event.kind) {
            SessionNotificationKind.COMPLETED -> R.drawable.ic_notification
            SessionNotificationKind.QUESTION -> R.drawable.ic_notification_question
            SessionNotificationKind.PERMISSION -> R.drawable.ic_notification_permission
        }
        val channel = context.getSystemService(NotificationManager::class.java).getNotificationChannel(channelId)
        if (channel?.importance == NotificationManager.IMPORTANCE_NONE) {
            NotificationDiagnostics.event("notification.skipped", event.id, code = "notification-channel-blocked"); throw GatewayFailure("notification-channel-blocked")
        }
        val session = event.sessionId
        val id = event.id
        val confirmation = event.confirmation
        val copy = sessionNotificationCopy(event)
        val publicTitle = when (event.kind) {
            SessionNotificationKind.COMPLETED -> "AI 已回复"
            SessionNotificationKind.QUESTION -> "AI 等待你的回答"
            SessionNotificationKind.PERMISSION -> "AI 请求操作权限"
        }
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(icon).setContentTitle(copy.title).setContentText(copy.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(copy.body))
            .setContentIntent(tap(context, device.id, session, id)).setAutoCancel(true).setOnlyAlertOnce(true)
            .setCategory(if (confirmation) NotificationCompat.CATEGORY_REMINDER else NotificationCompat.CATEGORY_STATUS)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(NotificationCompat.Builder(context, channelId).setSmallIcon(icon)
                .setContentTitle(publicTitle).setContentText("解锁后查看会话详情").build()).build()
        context.getSystemService(NotificationManager::class.java).notify("${device.id}:$id", 2, notification)
        NotificationDiagnostics.event("notification.posted", event.id)
        return true
    }

}
