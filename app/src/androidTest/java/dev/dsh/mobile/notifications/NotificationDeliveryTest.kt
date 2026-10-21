package dev.dsh.mobile.notifications

import android.Manifest
import android.app.Activity
import dev.dsh.mobile.MainActivity
import dev.dsh.mobile.R
import dev.dsh.mobile.protocol.sessionNotificationCopy
import dev.dsh.mobile.protocol.ConversationVisibility
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry
import androidx.test.runner.lifecycle.Stage
import android.app.NotificationManager
import android.app.NotificationChannel
import android.app.Notification
import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.protocol.DeviceCredential
import dev.dsh.mobile.protocol.SessionNotificationEvent
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

/** Real Android notification manager; no credentials, pairing or remote sessions are changed. */
class NotificationDeliveryTest {
    @Test fun visibleConversationSuppressesAllThreeNotificationTypes() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val manager = context.getSystemService(NotificationManager::class.java)
        val device = DeviceCredential("visible-${UUID.randomUUID()}", "Device", "https://fixture.example", "same", "fixture", "test-only", Long.MAX_VALUE)
        try {
            ConversationVisibility.show(device.id, "s")
            listOf(SessionNotificationEvent("done", "s", false, 1), SessionNotificationEvent("ask", "s", true, 1), SessionNotificationEvent("permission", "s", true, 1, permission = true)).forEach { event ->
                assertTrue(SessionNotifications.post(context, device, event))
                assertFalse(manager.activeNotifications.any { it.tag == "${device.id}:${event.id}" })
            }
        } finally { ConversationVisibility.hide() }
    }
    @Test fun oldConnectionChannelIsRetiredAndNoForegroundServiceIsDeclared() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val preferencesName = "notification-migration-test-${UUID.randomUUID()}"
        val isolated = object : ContextWrapper(context) {
            override fun getApplicationContext(): Context = this
            override fun getSharedPreferences(name: String, mode: Int): SharedPreferences =
                context.getSharedPreferences(if (name == "session_notifications") preferencesName else name, mode)
        }
        val manager = context.getSystemService(NotificationManager::class.java)
        val originalChannel = manager.getNotificationChannel("session_connection")
        try {
            manager.createNotificationChannel(NotificationChannel("session_connection", "Legacy connection", NotificationManager.IMPORTANCE_LOW))
            assertNotNull(manager.getNotificationChannel("session_connection"))
            SessionNotifications.startIfEnabled(isolated)
            assertNull(manager.getNotificationChannel("session_connection"))
            assertFalse(manager.activeNotifications.any { it.id == 1 && it.notification.flags and Notification.FLAG_ONGOING_EVENT != 0 })
            val pkg = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_SERVICES or PackageManager.GET_PERMISSIONS)
            assertFalse(pkg.services.orEmpty().any { it.name.endsWith("SessionNotificationService") })
            assertFalse(pkg.requestedPermissions.orEmpty().any { it.startsWith("android.permission.FOREGROUND_SERVICE") })
        } finally {
            context.deleteSharedPreferences(preferencesName)
            if (originalChannel != null) manager.createNotificationChannel(originalChannel)
        }
    }

    @Test fun realCompletionAndConfirmationNotificationsUseCorrectChannelsAndNavigate() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val wasGranted = Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        val manager = context.getSystemService(NotificationManager::class.java)
        val device = DeviceCredential("notification-test-${UUID.randomUUID()}", "测试电脑", "https://fixture.example", "fixture", "fixture", "test-only", Long.MAX_VALUE)
        val events = listOf(SessionNotificationEvent("complete", "session-a", false, System.currentTimeMillis()), SessionNotificationEvent("confirm", "session-b", true, System.currentTimeMillis(), sessionTitle = "确认会话", preview = "保留音频吗？"),
            SessionNotificationEvent("permission", "session-c", true, System.currentTimeMillis(), permission = true, sessionTitle = "修改项目", preview = "允许 AI 修改工作区内的文件？"))
        try {
            if (!wasGranted && Build.VERSION.SDK_INT >= 33) instrumentation.uiAutomation.grantRuntimePermission(context.packageName, Manifest.permission.POST_NOTIFICATIONS)
            SessionNotifications.channels(context)
            assertTrue(SessionNotifications.permitted(context))
            for (event in events) {
                SessionNotifications.post(context, device, event)
                val deadline = System.currentTimeMillis() + 5000
                var posted = manager.activeNotifications.firstOrNull { it.tag == "${device.id}:${event.id}" }
                while (posted == null && System.currentTimeMillis() < deadline) { Thread.sleep(50); posted = manager.activeNotifications.firstOrNull { it.tag == "${device.id}:${event.id}" } }
                assertNotNull("Android did not receive notification", posted)
                val notification = posted!!.notification
                assertEquals(if (event.permission) SessionNotifications.PERMISSION else if (event.confirmation) SessionNotifications.CONFIRM else SessionNotifications.COMPLETE, notification.channelId)
                assertEquals(if (event.permission) R.drawable.ic_notification_permission else if (event.confirmation) R.drawable.ic_notification_question else R.drawable.ic_notification, notification.smallIcon.resId)
                val copy = sessionNotificationCopy(event)
                assertEquals(copy.title, notification.extras.getString("android.title"))
                assertEquals(copy.body, notification.extras.getString("android.text"))
                assertFalse(notification.extras.toString().contains(device.name))
                assertFalse(notification.publicVersion.extras.toString().contains(event.sessionTitle.takeIf { it.isNotBlank() } ?: "fixture"))
                assertEquals(if (event.permission) "AI 请求操作权限" else if (event.confirmation) "AI 等待你的回答" else "AI 已回复", notification.publicVersion.extras.getString("android.title"))
                assertEquals(0, notification.flags and Notification.FLAG_ONGOING_EVENT)
                SessionNotifications.post(context, device, event)
                assertEquals(1, manager.activeNotifications.count { it.tag == "${device.id}:${event.id}" })
                assertNotNull(notification.contentIntent)
                if (Build.VERSION.SDK_INT >= 31) assertTrue(notification.contentIntent.isImmutable)
                notification.contentIntent.send()
                val targetDeadline = System.currentTimeMillis() + 5000
                var launched: Activity? = null
                var matches = false
                while (!matches && System.currentTimeMillis() < targetDeadline) {
                    instrumentation.runOnMainSync {
                        launched = ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED).firstOrNull { it is MainActivity }
                        val uri = launched?.intent?.data
                        matches = uri?.pathSegments == listOf(device.id, event.sessionId) && uri.getQueryParameter("event") == event.id
                    }
                    if (!matches) Thread.sleep(50)
                }
                assertTrue("Notification tap did not launch the matching MainActivity target", matches)

            }
        } finally {
            events.forEach { manager.cancel("${device.id}:${it.id}", 2) }
            NotificationNavigation.target.value?.let(NotificationNavigation::consumed)
            if (!wasGranted && Build.VERSION.SDK_INT >= 33) instrumentation.uiAutomation.revokeRuntimePermission(context.packageName, Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}
