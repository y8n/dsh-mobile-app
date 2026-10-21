package dev.dsh.mobile.protocol

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

val WireJson = Json { ignoreUnknownKeys = true; encodeDefaults = true }
class GatewayFailure(val code: String, val remoteMessage: String? = null, val remoteDetails: JsonObject? = null) : Exception(code)

@Serializable
data class DeviceCredential(val id: String, val name: String, val origin: String, val instanceId: String,
    val deviceId: String, val deviceToken: String, val deviceExpiresAt: Long, val caDer: String? = null,
    val connections: List<DeviceConnection> = emptyList(), val connectionMode: String = "fixed", val preferredConnectionId: String? = null) {
    override fun toString() = "DeviceCredential(id=$id, credentials=redacted)"
}
data class NativeSession(val sessionToken: String, val csrfToken: String, val expiresAt: Long) {
    override fun toString() = "NativeSession(redacted)"
}
data class PairingInput(val origin: String, val instanceId: String, val token: String, val requiresCa: Boolean) {
    override fun toString() = "PairingInput(redacted)"
    companion object {
        fun parse(address: String, key: String): PairingInput {
            val link = (if (key.startsWith("https://")) key else address).trim().toHttpUrlOrNull() ?: throw GatewayFailure("invalid-address")
            if (link.scheme != "https" || link.username.isNotEmpty() || link.password.isNotEmpty()) throw GatewayFailure("invalid-address")
            val fragment = link.fragment.orEmpty().split('&').associate { it.substringBefore('=') to it.substringAfter('=', "") }
            val supplied = fragment["key"] ?: key.trim().takeIf { it.isNotBlank() && !it.startsWith("https://") }
                ?: "dsh1.${fragment["instance"]}.${fragment["token"]}"
            val match = Regex("^dsh([12])\\.([a-f0-9]{64})\\.([A-Za-z0-9_-]{43})$").matchEntire(supplied)
                ?: throw GatewayFailure("invalid-pairing-key")
            val origin = link.newBuilder().encodedPath("/").query(null).fragment(null).build().toString().removeSuffix("/")
            return PairingInput(origin, match.groupValues[2], match.groupValues[3], match.groupValues[1] == "2")
        }
    }
}
@Serializable data class Workspace(val workspaceId: String, val path: String, val title: String, val sessionIds: List<String> = emptyList())
@Serializable data class WorkspaceSnapshot(val items: List<Workspace>, val archivedSessionIds: List<String> = emptyList(), val pinnedSessionIds: List<String> = emptyList())
@Serializable data class DirectoryEntry(val name: String, val path: String, val hidden: Boolean = false)
@Serializable data class DirectoryListing(val path: String, val home: String, val crumbs: List<DirectoryEntry>, val entries: List<DirectoryEntry>, val truncated: Boolean = false)
@Serializable data class SessionSummary(val sessionId: String, val title: String? = null, val running: Boolean = false, val blank: Boolean = false, val projections: JsonObject? = null, val updatedAt: Long = 0) {
    val displayTitle: String? get() = title ?: ((projections?.get("values") as? JsonObject)?.get("title") as? JsonPrimitive)?.contentOrNull?.takeIf { it.isNotBlank() }
}

/** A delta may only be applied after a baseline from the same physical generation. */
fun reduceWorkspaces(current: WorkspaceSnapshot?, frame: JsonObject): WorkspaceSnapshot {
    if (frame.string("type") == "baseline") return WireJson.decodeFromJsonElement(frame.getValue("value"))
    val state = current ?: throw GatewayFailure("baseline-required")
    return when (frame.string("type")) {
        "upsert" -> {
            val row = WireJson.decodeFromJsonElement<Workspace>(frame.getValue("workspace"))
            val existing = state.items.indexOfFirst { it.workspaceId == row.workspaceId }
            state.copy(items = if (existing < 0) state.items + row else state.items.map { if (it.workspaceId == row.workspaceId) row else it })
        }
        "remove" -> state.copy(items = state.items.filterNot { it.workspaceId == frame.string("workspaceId") })
        "order" -> state.copy(items = frame.getValue("workspaceIds").jsonArray.mapNotNull { id -> state.items.find { it.workspaceId == id.jsonPrimitive.content } })
        "archived" -> state.copy(archivedSessionIds = frame.getValue("archivedSessionIds").jsonArray.map { it.jsonPrimitive.content })
        "pinned" -> state.copy(pinnedSessionIds = frame.getValue("pinnedSessionIds").jsonArray.map { it.jsonPrimitive.content })
        else -> throw GatewayFailure("unsupported-frame")
    }
}
inline fun <T> wireValue(block: () -> T): T = try { block() }
catch (error: GatewayFailure) { throw error }
catch (error: kotlinx.coroutines.CancellationException) { throw error }
catch (_: Exception) { throw GatewayFailure("invalid-response") }
fun JsonObject.string(key: String): String = wireValue {
    get(key)?.jsonPrimitive?.takeUnless { it is JsonNull }?.content ?: throw GatewayFailure("invalid-response")
}
fun argsRequest(vararg values: Pair<String, JsonElement>) = buildJsonObject { put("request", JsonObject(values.toMap())) }
