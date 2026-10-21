package dev.dsh.mobile.data

import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.*
import java.util.concurrent.ConcurrentHashMap

/** Retains compatibility with the standard list, but never raises its byte cap.
 * Once a device exceeds that cap, subsequent lists use bounded workspace pages. */
internal class WorkspaceSessionReader {
    private val scopedDevices = ConcurrentHashMap.newKeySet<String>()
    suspend fun read(device: String, gateway: DeviceGateway, workspace: Workspace): List<SessionSummary> {
        if (device !in scopedDevices) {
            try {
                val result = gateway.rpc("session/list", buildJsonObject { put("_request", JsonObject(emptyMap())) }).jsonObject
                return wireValue { WireJson.decodeFromJsonElement<List<SessionSummary>>(result.getValue("items")) }
                    .filter { it.sessionId in workspace.sessionIds }
            } catch (cancel: CancellationException) { throw cancel }
            catch (error: GatewayFailure) {
                if (error.code != "response-too-large") throw error
                scopedDevices.add(device)
            }
        }
        val items = mutableListOf<SessionSummary>(); val seen = mutableSetOf<String>(); val cursors = mutableSetOf<String>()
        var cursor: String? = null
        repeat(300) {
            val page = gateway.rpc("mobileSearch/listWorkspace", buildJsonObject {
                put("request", buildJsonObject { put("workspaceId", workspace.workspaceId); cursor?.let { put("cursor", it) } })
            }).jsonObject
            if (page["workspaceId"]?.jsonPrimitive?.content != workspace.workspaceId) throw GatewayFailure("invalid-response")
            val rows = wireValue { WireJson.decodeFromJsonElement<List<SessionSummary>>(page.getValue("items")) }
            if (rows.size > 100 || rows.any { it.sessionId !in workspace.sessionIds || !seen.add(it.sessionId) }) throw GatewayFailure("invalid-response")
            items += rows
            val next = page["nextCursor"]
            if (next == null || next is JsonNull) return items.sortedByDescending { it.updatedAt }
            cursor = (next as? JsonPrimitive)?.takeIf { it.isString }?.content ?: throw GatewayFailure("invalid-response")
            if (cursor!!.length > 256 || !cursors.add(cursor!!)) throw GatewayFailure("invalid-response")
        }
        throw GatewayFailure("list-scope-limit")
    }
}
