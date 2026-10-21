package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*
import kotlinx.coroutines.*

enum class SessionNotificationKind { COMPLETED, QUESTION, PERMISSION }
data class SessionNotificationEvent(val id: String, val sessionId: String, val confirmation: Boolean, val at: Long,
    val permission: Boolean = false, val sessionTitle: String = "", val preview: String = "") {
    val kind get() = if (permission) SessionNotificationKind.PERMISSION else if (confirmation) SessionNotificationKind.QUESTION else SessionNotificationKind.COMPLETED
}

internal fun notificationEvent(event: JsonObject, confirmation: Boolean): SessionNotificationEvent {
    fun identifier(key: String) = event.getValue(key).jsonPrimitive.also { require(it.isString) }.content.also { require(it.length in 1..512) }
    fun text(key: String): String = event[key]?.let { value ->
        if (value is JsonNull) return@let ""
        value.jsonPrimitive.also { require(it.isString) }.content.also { require(it.length <= 1024) }
    }.orEmpty()
    require(event.text("kind") == if (confirmation) "confirmation" else "completed")
    val type = text("noticeType")
    require(if (confirmation) type in setOf("", "question", "permission") else type in setOf("", "completed"))
    return SessionNotificationEvent(identifier("id"), identifier("sessionId"), confirmation,
        event.getValue("at").jsonPrimitive.long.also { require(it >= 0) }, type == "permission", text("sessionTitle"), text("preview"))
}
data class SessionNotificationBatch(val epoch: String, val cursor: Long, val now: Long,
                                    val events: List<SessionNotificationEvent>, val pending: List<SessionNotificationEvent>) {
    fun unseen(seen: Set<String>): List<SessionNotificationEvent> = (events + pending)
        .filter { it.id !in seen && (it.confirmation || now - it.at in 0..900_000) }.distinctBy { it.id }
    companion object {
        fun parse(frame: JsonObject): SessionNotificationBatch = try {
            require(frame.getValue("version").jsonPrimitive.int == 1)
            fun identifier(value: JsonElement?): String = value!!.jsonPrimitive.also { require(it.isString) }.content.also { require(it.length in 1..512) }
            fun events(key: String, confirmation: Boolean): List<SessionNotificationEvent> {
                val list = frame.getValue(key).jsonArray
                require(list.size <= if (confirmation) 256 else 512)
                return list.map { raw ->
                    notificationEvent(raw.jsonObject, confirmation)
                }.also { require(it.map { e -> e.id }.toSet().size == it.size) }
            }
            SessionNotificationBatch(identifier(frame["epoch"]), frame.getValue("cursor").jsonPrimitive.long.also { require(it >= 0) },
                frame.getValue("now").jsonPrimitive.long.also { require(it >= 0) }, events("events", false), events("pending", true))
        } catch (_: Exception) { throw GatewayFailure("invalid-response") }
    }
}

/** DSH unary RPC uses named business parameters, so poll(request) must be wrapped. */
suspend fun DeviceGateway.readSessionNotifications(epoch: String?, cursor: Long): SessionNotificationBatch {
    val request = buildJsonObject {
        if (epoch != null) { put("epoch", epoch); put("after", cursor) }
    }
    return SessionNotificationBatch.parse(rpc("mobileNotifications/poll", buildJsonObject { put("request", request) }).jsonObject)
}

/** Optional enrichment uses the same authenticated RPC; legacy/missing extension falls back to the event. */
suspend fun DeviceGateway.readNotificationDetails(event: SessionNotificationEvent): SessionNotificationEvent {
    val raw = rpc("mobileNotifications/details", buildJsonObject {
        put("request", buildJsonObject { put("id", event.id); put("sessionId", event.sessionId) })
    }).jsonObject
    val detail = try { notificationEvent(raw, event.confirmation) } catch (_: Exception) { throw GatewayFailure("invalid-response") }
    if (detail.id != event.id || detail.sessionId != event.sessionId) throw GatewayFailure("invalid-response")
    return detail
}

/** Missing/slow optional previews cannot take down the existing completion stream. */
suspend fun DeviceGateway.notificationForDisplay(event: SessionNotificationEvent, timeoutMs: Long = 1500): SessionNotificationEvent =
    withTimeoutOrNull(timeoutMs) {
        try { readNotificationDetails(event) }
        catch (cancel: CancellationException) { throw cancel }
        catch (_: Exception) { event }
    } ?: event
