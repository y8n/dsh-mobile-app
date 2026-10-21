package dev.dsh.mobile.data

import dev.dsh.mobile.protocol.*
import kotlinx.serialization.json.*

suspend fun DeviceRepository.uploadDiagnosticReport(deviceId: String, report: JsonObject): JsonObject {
    val connection = selectedConnection()?.takeIf { it.first == deviceId && state.value.connected }
        ?: throw GatewayFailure("connection-required")
    val result = connection.second.rpc("mobileDiagnostics/upload", buildJsonObject { put("report", report) }).jsonObject
    if (selectedConnection() != connection || !state.value.connected) throw GatewayFailure("device-changed")
    return result
}
