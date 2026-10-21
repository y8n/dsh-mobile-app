package dev.dsh.mobile.notifications

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import dev.dsh.mobile.data.DeviceStore
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.collect

/** Like the old App's WebView connection, lives with the process, not a conversation page.
 * No foreground service, ongoing notification, or claim of delivery after process termination.
 * SSE supplies completions; the existing extension adds confirmation state and durable catch-up. */
internal class SessionNotificationReceiver(private val context: Context) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val prefs = SessionNotifications.prefs(context)
    private val manager = context.getSystemService(android.app.NotificationManager::class.java)
    private val connectivity = context.getSystemService(ConnectivityManager::class.java)
    private val wake = Channel<Unit>(Channel.CONFLATED)
    private val monitors = mutableMapOf<String, Pair<DeviceCredential, Job>>()
    @Volatile private var networkGeneration = 0
    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) { NotificationDiagnostics.emit("network.available", endpoint = "notifications"); refresh() }
        override fun onLost(network: Network) { NotificationDiagnostics.emit("network.lost", endpoint = "notifications"); refresh() }
    }
    private var registered = false
    init {
        NotificationDiagnostics.emit("notification.receiver-start")
        scope.launch {
            var last = android.os.SystemClock.elapsedRealtime()
            while (isActive) {
                delay(30_000)
                val now = android.os.SystemClock.elapsedRealtime()
                NotificationDiagnostics.emit("notification.tick", durationMs = now - last); last = now
            }
        }
        try { connectivity.registerDefaultNetworkCallback(callback); registered = true }
        catch (_: Exception) { /* Timed reconnect remains available without callback registration. */ }
        scope.launch {
            var generation = networkGeneration
            while (isActive) {
                try {
                    if (generation != networkGeneration) {
                        generation = networkGeneration
                        monitors.values.forEach { it.second.cancelAndJoin() }; monitors.clear()
                    }
                    val devices = DeviceStore(context).read().devices.associateBy { it.id }
                    monitors.keys.toList().forEach { id ->
                        if (devices[id] != monitors[id]?.first) { monitors.remove(id)?.second?.cancelAndJoin(); clearPending(id) }
                    }
                    devices.values.forEach { device ->
                        if (monitors[device.id]?.second?.isActive != true) monitors[device.id] = device to scope.launch {
                            try { monitor(device) }
                            catch (cancel: CancellationException) { throw cancel }
                            catch (error: Exception) {
                                NotificationDiagnostics.emit("stream.failure", endpoint = "notifications", code = (error as? GatewayFailure)?.code ?: "invalid-response")
                                status("通知连接中断，正在重试")
                            }
                        }
                    }
                    if (devices.isEmpty()) status("添加设备后开始接收会话通知")
                } catch (cancel: CancellationException) { throw cancel }
                catch (_: Exception) { status("无法读取设备，请检查设备连接") }
                withTimeoutOrNull(10_000) { wake.receive() }
            }
        }
    }
    fun refresh() { networkGeneration++; wake.trySend(Unit) }
    private fun status(value: String) { prefs.edit().putString("status", value).apply() }
    private fun clearPending(device: String) {
        prefs.getStringSet("pending:$device", emptySet()).orEmpty().forEach { manager.cancel("$device:$it", 2) }
        prefs.edit().remove("pending:$device").apply()
    }
    private suspend fun monitor(device: DeviceCredential) = supervisorScope {
        val client = deviceGateway(device)
        val catchUp = Channel<Unit>(Channel.CONFLATED)
        val streamReady = java.util.concurrent.atomic.AtomicBoolean(false)
        val delivery = NotificationDelivery(
            seen = { prefs.getStringSet("seen:${device.id}", emptySet()).orEmpty() },
            remember = { prefs.edit().putStringSet("seen:${device.id}", it).commit() },
            post = {
                if (!prefs.getBoolean("enabled", false)) {
                    NotificationDiagnostics.event("notification.skipped", it.id, code = "notification-disabled"); false
                } else SessionNotifications.post(context, device, it)
            },
            duplicate = { NotificationDiagnostics.event("notification.duplicate", it.id) },
        )
        try {
            val stream = launch {
                var failures = 0
                while (isActive) {
                    val trace = java.util.UUID.randomUUID().toString()
                    NotificationDiagnostics.emit("stream.start", trace = trace, endpoint = "notifications", attempt = failures)
                    try {
                        client.followTaskNotifications().collect { signal ->
                            when (signal) {
                                TaskNotificationSignal.Ready -> {
                                    streamReady.set(true); failures = 0
                                    status("正在接收会话通知")
                                    NotificationDiagnostics.emit("stream.ready", trace = trace, endpoint = "notifications")
                                    catchUp.trySend(Unit)
                                }
                                TaskNotificationSignal.Heartbeat -> NotificationDiagnostics.emit("notification.heartbeat", trace = trace)
                                is TaskNotificationSignal.Completed -> {
                                    NotificationDiagnostics.event("notification.received", signal.event.id)
                                    // Best-effort bounded enrichment; never make missing enhancement block completion delivery.
                                    val detail = if (signal.event.id in prefs.getStringSet("seen:${device.id}", emptySet()).orEmpty()) signal.event else {
                                        client.notificationForDisplay(signal.event)
                                    }
                                    delivery.deliver(detail)
                                }
                            }
                        }
                    } catch (cancel: CancellationException) {
                        NotificationDiagnostics.emit("stream.cancel", trace = trace, code = "cancelled"); throw cancel
                    }
                    catch (error: Exception) {
                        currentCoroutineContext().ensureActive()
                        streamReady.set(false)
                        val code = (error as? GatewayFailure)?.code ?: "invalid-response"
                        NotificationDiagnostics.emit("stream.failure", trace = trace, endpoint = "notifications", code = code, attempt = failures)
                        status(when (code) {
                            "device-revoked", "access-denied", "instance-changed" -> "设备授权失效，请检查配对"
                            "notification-permission-required" -> "系统通知权限已关闭"
                            "notification-channel-blocked" -> "通知频道已关闭，请检查系统通知设置"
                            else -> "通知连接中断，正在重试"
                        })
                        if (code in setOf("device-revoked", "instance-changed", "access-denied")) break
                    }
                    delay((1_000L shl failures.coerceAtMost(5)).coerceAtMost(30_000)); failures++
                }
            }
            try {
                var failures = 0
                while (isActive) {
                    var waitMs = 5_000L
                    try {
                        val batch = client.readSessionNotifications(prefs.getString("epoch:${device.id}", null), prefs.getLong("cursor:${device.id}", 0))
                        val pending = batch.pending.map { it.id }.toSet()
                        val old = prefs.getStringSet("pending:${device.id}", emptySet()).orEmpty()
                        (old - pending).forEach { manager.cancel("${device.id}:$it", 2) }
                        // SSE and catch-up share the exact session:turn ID and delivery mutex.
                        batch.unseen(emptySet()).forEach {
                            NotificationDiagnostics.event("notification.received", it.id, endpoint = "notification-catchup")
                            delivery.deliver(it)
                        }
                        prefs.edit().putString("epoch:${device.id}", batch.epoch).putLong("cursor:${device.id}", batch.cursor)
                            .putStringSet("pending:${device.id}", pending).apply()
                        status("正在接收会话通知"); failures = 0
                    } catch (cancel: CancellationException) { throw cancel }
                    catch (error: Exception) {
                        val code = (error as? GatewayFailure)?.code ?: "invalid-response"
                        NotificationDiagnostics.emit("stream.failure", endpoint = "notification-catchup", code = code, attempt = failures)
                        // Failure of the optional enhancement must never disable the old plugin SSE.
                        if (code == "notification-permission-required") status("系统通知权限已关闭")
                        else if (code == "notification-channel-blocked") status("通知频道已关闭，请检查系统通知设置")
                        else if (code in setOf("device-revoked", "instance-changed", "access-denied")) status("设备授权失效，请检查配对")
                        else if (streamReady.get()) status("正在接收完成通知；人工确认及补取暂不可用")
                        else status("通知连接中断，正在重试")
                        waitMs = (5_000L shl failures.coerceAtMost(4)).coerceAtMost(60_000); failures++
                    }
                    withTimeoutOrNull(waitMs) { catchUp.receive() }
                }
            } finally { stream.cancelAndJoin() }
        } finally { client.close(); catchUp.close() }
    }
    fun stop() {
        NotificationDiagnostics.emit("notification.receiver-stop")
        if (registered) connectivity.unregisterNetworkCallback(callback)
        scope.cancel(); wake.close()
    }
}
