package dev.dsh.mobile.notifications

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import android.os.PowerManager
import dev.dsh.mobile.protocol.Diagnostics
import kotlinx.serialization.json.*
import java.util.UUID

/** Fixed flags only. No device/session identifiers, messages, addresses or credentials. */
object NotificationDiagnostics {
    private val run = UUID.randomUUID().toString()
    @Volatile private var context: Context? = null
    @Volatile private var foreground = false
    @Synchronized fun install(context: Context) {
        if (this.context != null) return
        this.context = context.applicationContext
        emit("app.process-start", trace = run)
        if (Build.VERSION.SDK_INT >= 30) runCatching {
            val exit = context.getSystemService(ActivityManager::class.java).getHistoricalProcessExitReasons(null, 0, 1).firstOrNull() ?: return@runCatching
            val code = when (exit.reason) {
                ApplicationExitInfo.REASON_LOW_MEMORY -> "process-low-memory"
                ApplicationExitInfo.REASON_CRASH, ApplicationExitInfo.REASON_CRASH_NATIVE, ApplicationExitInfo.REASON_ANR -> "process-crash"
                ApplicationExitInfo.REASON_USER_REQUESTED, ApplicationExitInfo.REASON_USER_STOPPED -> "process-user-requested"
                ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "process-resource-limit"
                else -> "process-other"
            }
            emit("app.previous-exit", trace = run, code = code, durationMs = (System.currentTimeMillis() - exit.timestamp).coerceAtLeast(0))
        }
    }
    fun visible(value: Boolean) { foreground = value; emit("app.visibility", trace = run) }
    fun snapshot(): JsonObject? = runCatching {
        val app = context ?: return null
        val power = app.getSystemService(PowerManager::class.java)
        val info = ActivityManager.RunningAppProcessInfo().also(ActivityManager::getMyMemoryState)
        buildJsonObject {
            put("run", run); put("foreground", foreground); put("interactive", power.isInteractive)
            put("idle", power.isDeviceIdleMode); put("powerSave", power.isPowerSaveMode)
            put("batteryExempt", power.isIgnoringBatteryOptimizations(app.packageName))
            put("restricted", Build.VERSION.SDK_INT >= 28 && app.getSystemService(ActivityManager::class.java).isBackgroundRestricted)
            put("notifications", SessionNotifications.permitted(app)); put("importance", info.importance.coerceIn(0, 1000))
        }
    }.getOrNull()
    fun emit(stage: String, trace: String = UUID.randomUUID().toString(), endpoint: String = "notifications", code: String = "none", attempt: Int = 0, durationMs: Long = 0) {
        Diagnostics.emit(stage, trace, endpoint, durationMs = durationMs, code = code, attempt = attempt, runtime = snapshot())
    }
    private val events = linkedMapOf<String, String>()
    private val recorded = linkedSetOf<String>()
    @Synchronized fun event(stage: String, id: String, endpoint: String = "notifications", code: String = "none") {
        val trace = events.getOrPut(id) { UUID.randomUUID().toString() }
        val key = "$trace:$stage:$endpoint:$code"
        if (!recorded.add(key)) return
        while (events.size > 1024) events.remove(events.keys.first())
        while (recorded.size > 4096) recorded.remove(recorded.first())
        emit(stage, trace, endpoint, code = code)
    }
}
