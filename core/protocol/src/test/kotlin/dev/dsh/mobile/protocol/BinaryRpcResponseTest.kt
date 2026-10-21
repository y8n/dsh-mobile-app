package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import okio.Buffer
import java.util.Base64
import org.junit.Assert.*
import org.junit.Test

class BinaryRpcResponseTest {
    private fun multipart(path: JsonArray = buildJsonArray { add("data") }, placeholder: JsonElement = JsonNull, extra: Boolean = false): Pair<ByteArray, String> {
        val metadata = buildJsonObject {
            put("type", "server-response"); put("rpcId", "id")
            put("result", buildJsonObject { put("ok", true); put("value", buildJsonObject { put("data", placeholder); put("version", "v1") }) })
            put("attachments", buildJsonArray { add(buildJsonObject { put("codec", "bytes"); put("part", "bytes-0"); put("path", path) }) })
        }
        val body = MultipartBody.Builder("test-boundary").setType(MultipartBody.FORM)
            .addFormDataPart("bytes-0", "blob", byteArrayOf(0, 1, 13, 10, -1).toRequestBody())
            .addFormDataPart("metadata", metadata.toString()).apply { if (extra) addFormDataPart("unused", "bad") }.build()
        val bytes = Buffer().also { body.writeTo(it) }.readByteArray()
        return bytes to body.contentType().toString()
    }
    @Test fun officialMultipartPreservesEnvelopeAndAllBinaryBytes() {
        val (bytes, type) = multipart()
        val result = workspaceBinaryResponse(bytes, type)
        assertEquals("id", result.text("rpcId"))
        val value = result.getValue("result").jsonObject.getValue("value").jsonObject
        assertArrayEquals(byteArrayOf(0, 1, 13, 10, -1), Base64.getDecoder().decode(value.text("data")))
        assertEquals("v1", value.text("version"))
    }
    @Test fun unexpectedPathsPlaceholdersAndPartsAreRejected() {
        for ((bytes, type) in listOf(multipart(buildJsonArray { add("other") }), multipart(placeholder = JsonPrimitive("replace-me")), multipart(extra = true))) {
            try { workspaceBinaryResponse(bytes, type); fail("must reject malformed payload") } catch (error: GatewayFailure) { assertEquals("invalid-response", error.code) }
        }
    }
}
