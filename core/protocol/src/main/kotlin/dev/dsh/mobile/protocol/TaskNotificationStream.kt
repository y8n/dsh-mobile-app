package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*

/** The old dsh-mobile gateway's authenticated extension event stream. */
sealed interface TaskNotificationSignal {
    data object Ready : TaskNotificationSignal
    data object Heartbeat : TaskNotificationSignal
    data class Completed(val event: SessionNotificationEvent) : TaskNotificationSignal
}

/** Bounded SSE framing; unknown events and malformed task payloads never become notifications. */
internal class TaskNotificationDecoder(private val now: () -> Long = System::currentTimeMillis) {
    private var event = ""
    private val data = StringBuilder()
    fun line(line: String): SessionNotificationEvent? {
        if (line.length > 65_536) throw GatewayFailure("response-too-large")
        if (line.isEmpty()) {
            val type = event; val payload = data.toString()
            event = ""; data.clear()
            if (type == "device-revoked") throw GatewayFailure("device-revoked")
            if (type != "task-notify") return null
            return try {
                val value = WireJson.parseToJsonElement(payload).jsonObject
                val session = value["sessionId"]?.jsonPrimitive?.takeIf { it.isString }?.content
                    ?.takeIf { it.isNotBlank() && it.length <= 512 } ?: return null
                val turn = value["turn"]?.jsonPrimitive?.takeIf { !it.isString }?.longOrNull
                    ?.takeIf { it in 0..9_007_199_254_740_991L } ?: return null
                SessionNotificationEvent("$session:turn:$turn", session, false, now())
            } catch (_: Exception) { null }
        }
        if (line.startsWith(":")) return null
        val field = line.substringBefore(':')
        val value = line.substringAfter(':', "").removePrefix(" ")
        when (field) {
            "event" -> event = value
            "data" -> {
                if (data.length + value.length + 1 > 65_536) throw GatewayFailure("response-too-large")
                if (data.isNotEmpty()) data.append('\n')
                data.append(value)
            }
        }
        return null
    }
}
