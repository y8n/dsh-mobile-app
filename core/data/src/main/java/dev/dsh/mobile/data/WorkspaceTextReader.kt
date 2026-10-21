package dev.dsh.mobile.data

import dev.dsh.mobile.protocol.*
import kotlinx.serialization.json.*

data class WorkspaceFileTarget(val deviceId: String, val sessionId: String, val path: String)
data class WorkspaceTextPage(val absolutePath: String, val version: JsonElement, val bytes: Long?,
    val offset: Long, val lines: Long, val text: String, val eof: Boolean)

/** Official session-derived filesystem read. A page is admitted only at one version. */
class WorkspaceTextReader(private val devices: DeviceRepository) {
    suspend fun read(target: WorkspaceFileTarget, offset: Long = 1, expectedVersion: JsonElement? = null, limit: Int = 500): WorkspaceTextPage {
        if (target.path.isBlank() || target.sessionId.isBlank() || offset < 1 || limit !in 1..500) throw GatewayFailure("file-invalid-request")
        val connection = devices.selectedConnection()?.takeIf { it.first == target.deviceId } ?: throw GatewayFailure("device-changed")
        fun checkTarget() {
            if (devices.selectedConnection()?.let { it.first == target.deviceId && it.second === connection.second } != true) throw GatewayFailure("device-changed")
            if (!devices.state.value.connected) throw GatewayFailure("connection-required")
        }
        checkTarget()
        val address = buildJsonObject { put("workspaceFileScopeId", target.sessionId); put("path", target.path) }
        val before = connection.second.rpc("workspaceFiles/stat", address).jsonObject
        checkTarget()
        val version = before["version"]?.takeUnless { it is JsonNull } ?: throw GatewayFailure("file-version-unavailable")
        if (expectedVersion != null && version != expectedVersion) throw GatewayFailure("file-changed")
        val page = connection.second.rpc("workspaceFiles/read", JsonObject(address + ("range" to buildJsonObject { put("offset", offset); put("limit", limit) }))).jsonObject
        checkTarget()
        val after = connection.second.rpc("workspaceFiles/stat", address).jsonObject
        checkTarget()
        if (page["version"] != version || after["version"] != version || page["absolutePath"] != before["absolutePath"] || after["absolutePath"] != before["absolutePath"]) throw GatewayFailure("file-changed")
        val path = before.string("absolutePath"); val text = page.string("text"); val count = page.number("lines")
        val eof = (page["eof"] as? JsonPrimitive)?.takeUnless { it.isString }?.booleanOrNull ?: throw GatewayFailure("invalid-response")
        if (page.number("offset") != offset || count !in 0..limit.toLong() || (count == 0L && !eof) || text.toByteArray(Charsets.UTF_8).size > 512 * 1024) throw GatewayFailure("file-preview-limit")
        val bytes = (before["bytes"] as? JsonPrimitive)?.takeUnless { it.isString }?.longOrNull
        if (bytes != null && bytes < 0) throw GatewayFailure("invalid-response")
        return WorkspaceTextPage(path, version, bytes, offset, count, text, eof)
    }
}
