package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*
import okhttp3.*
import java.io.IOException
import java.util.UUID

/** Fixed schema only: never accept a URL, exception message, request body or header. */
object Diagnostics {
    @Volatile var sink: ((JsonObject) -> Unit)? = null
    val stages = setOf("http.start", "dns.start", "dns.end", "tls.start", "tls.end", "http.headers", "http.end", "http.failure",
        "socket.open", "socket.failure", "socket.closed", "stream.start", "stream.ready", "stream.failure", "stream.cancel",
        "session.open", "session.ready", "session.retry", "session.pause", "session.initial-timeout", "network.available", "network.lost", "app.start", "app.pause", "notification.posted", "notification.received", "notification.duplicate", "notification.tick", "notification.heartbeat", "notification.skipped", "notification.receiver-start", "notification.receiver-stop", "app.process-start", "app.previous-exit", "app.visibility")
    val codes = setOf("none", "network-unavailable", "connection-required", "stream-ended", "stream-timeout", "session-expired", "certificate-failed",
        "instance-changed", "device-revoked", "access-denied", "rate-limited", "response-too-large", "invalid-response", "sequence-gap", "baseline-required",
        "initial-timeout", "result-unknown", "http-failure", "timeout", "reset", "eof", "dns", "connect", "tls", "cancelled", "other", "storage-unavailable", "notification-permission-required", "notification-channel-blocked", "notification-disabled", "process-low-memory", "process-crash", "process-user-requested", "process-resource-limit", "process-other")
    val endpoints = setOf("auth", "mux", "workspace", "session", "control", "events", "permissions", "commands", "prompt", "upload", "other", "notifications", "notification-catchup")
    fun endpoint(method: String): String = when {
        method.contains("mobileNotifications/") -> "notification-catchup"
        method.endsWith("/extensions/events") -> "notifications"
        method.contains("native-") -> "auth"
        method.endsWith("remote.mux") -> "mux"
        method.contains("session/control") -> "control"
        method.contains("session/prompt") || method.contains("mobileSearch/lookupPrompt") -> "prompt"
        method.contains("uploadFileBinary") -> "upload"
        method.contains("permissionPresets/") -> "permissions"
        method.contains("commands/") -> "commands"
        method.contains("\$events") -> "events"
        method.contains("workspace/") -> "workspace"
        method.contains("session/") -> "session"
        else -> "other"
    }
    fun code(error: Throwable): String = when {
        error is GatewayFailure -> error.code.takeIf { it in codes } ?: "other"
        error is java.net.SocketTimeoutException || error is java.io.InterruptedIOException -> "timeout"
        error is java.io.EOFException -> "eof"
        error is java.net.UnknownHostException -> "dns"
        error is java.net.ConnectException -> "connect"
        error is javax.net.ssl.SSLException -> "tls"
        error is java.net.SocketException && error.message.orEmpty().contains("reset", true) -> "reset"
        else -> "other"
    }
    val runtimeKeys = setOf("run", "foreground", "interactive", "idle", "powerSave", "batteryExempt", "restricted", "notifications", "importance")
    fun validRuntime(runtime: JsonObject): Boolean = runCatching {
        runtime.keys == runtimeKeys && runtime.getValue("run").jsonPrimitive.let { it.isString && it.content.matches(Regex("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")) } &&
            runtimeKeys.minus(setOf("run", "importance")).all { key -> runtime.getValue(key).jsonPrimitive.let { !it.isString && it.booleanOrNull != null } } &&
            runtime.getValue("importance").jsonPrimitive.let { !it.isString && it.intOrNull in 0..1000 }
    }.getOrDefault(false)
    fun emit(stage: String, trace: String = UUID.randomUUID().toString(), endpoint: String = "other", durationMs: Long = 0, status: Int = 0, code: String = "none", attempt: Int = 0, runtime: JsonObject? = null) {
        if (stage !in stages || endpoint !in endpoints || !trace.matches(Regex("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"))) return
        if (runtime != null && !validRuntime(runtime)) return
        runCatching { sink?.invoke(buildJsonObject {
            put("at", System.currentTimeMillis()); put("stage", stage); put("trace", trace)
            put("endpoint", endpoint); put("durationMs", durationMs.coerceIn(0, 3_600_000)); put("status", status.coerceIn(0, 599))
            put("code", code.takeIf { it in codes } ?: "other"); put("attempt", attempt.coerceIn(0, 1000))
            runtime?.let { put("runtime", it) }
        }) }
    }
    fun listener() = object : EventListener() {
        private val trace = UUID.randomUUID().toString()
        private val started = System.nanoTime()
        private fun record(call: Call, stage: String, status: Int = 0, code: String = "none") =
            emit(stage, trace, endpoint(call.request().url.encodedPath), (System.nanoTime() - started) / 1_000_000, status, code)
        override fun callStart(call: Call) = record(call, "http.start")
        override fun dnsStart(call: Call, domainName: String) = record(call, "dns.start")
        override fun dnsEnd(call: Call, domainName: String, inetAddressList: List<java.net.InetAddress>) = record(call, "dns.end")
        override fun secureConnectStart(call: Call) = record(call, "tls.start")
        override fun secureConnectEnd(call: Call, handshake: Handshake?) = record(call, "tls.end")
        override fun responseHeadersEnd(call: Call, response: Response) = record(call, "http.headers", response.code)
        override fun callEnd(call: Call) = record(call, "http.end")
        override fun callFailed(call: Call, ioe: IOException) = record(call, "http.failure", code = code(ioe))
    }
}
