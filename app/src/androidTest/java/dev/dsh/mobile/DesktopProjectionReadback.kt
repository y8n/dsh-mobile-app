package dev.dsh.mobile

import dev.dsh.mobile.protocol.*
import kotlinx.serialization.json.*

/** Independent Desktop RPC readback for one owned Session; avoids global payload size. */
suspend fun desktopProjectionSummary(gateway: DeviceGateway, sessionId: String): JsonObject {
    val projection = gateway.rpc("session/projections", buildJsonObject { put("request", buildJsonObject { put("sessionId", sessionId) }) })
    if (projection is JsonNull) throw GatewayFailure("session/not-found")
    projection.jsonObject.getValue("values").jsonObject
    return buildJsonObject { put("sessionId", sessionId); put("projections", projection) }
}
