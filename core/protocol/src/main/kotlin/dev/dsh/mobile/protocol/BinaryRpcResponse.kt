package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*
import okhttp3.MultipartReader
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import java.util.Base64

/** Official workspaceFiles/readBytes wire format: JSON metadata + one bytes part.
 * The outer HTTP reader has already enforced its 2 MiB bound. Keep the returned
 * JSON shape stable for DeviceGateway, encoding only this binary field as base64. */
internal fun workspaceBinaryResponse(bytes: ByteArray, contentType: String): JsonObject {
    try {
        val parts = linkedMapOf<String, ByteArray>()
        MultipartReader(bytes.toResponseBody(contentType.toMediaType())).use { reader ->
            while (true) {
                val part = reader.nextPart() ?: break
                val name = Regex("(?:^|;)\\s*name=\"([^\"]+)\"").find(part.headers["Content-Disposition"].orEmpty())?.groupValues?.get(1)
                    ?: throw GatewayFailure("invalid-response")
                if (parts.size >= 2 || parts.containsKey(name)) throw GatewayFailure("invalid-response")
                parts[name] = part.body.readByteArray()
            }
        }
        val metadata = parts.remove("metadata") ?: throw GatewayFailure("invalid-response")
        val envelope = WireJson.parseToJsonElement(metadata.decodeToString()).jsonObject
        val descriptor = envelope.getValue("attachments").jsonArray.single().jsonObject
        if (descriptor["codec"] != JsonPrimitive("bytes") || descriptor["path"] != buildJsonArray { add("data") }) throw GatewayFailure("invalid-response")
        val binary = parts.remove(descriptor.string("part")) ?: throw GatewayFailure("invalid-response")
        val result = envelope.getValue("result").jsonObject
        val value = result.getValue("value").jsonObject
        if (parts.isNotEmpty() || result["ok"] != JsonPrimitive(true) || value["data"] != JsonNull) throw GatewayFailure("invalid-response")
        return JsonObject(envelope - "attachments" + ("result" to JsonObject(result + ("value" to JsonObject(value + ("data" to JsonPrimitive(Base64.getEncoder().encodeToString(binary))))))))
    } catch (error: GatewayFailure) { throw error }
    catch (_: Exception) { throw GatewayFailure("invalid-response") }
}
