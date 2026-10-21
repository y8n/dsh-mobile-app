package dev.dsh.mobile.protocol

import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class DiagnosticsTest {
    @Test fun runtimeFlagsAreStrictAndNeverAcceptContentOrStringBooleans() {
        val runtime = buildJsonObject {
            put("run", java.util.UUID.randomUUID().toString()); put("importance", 400)
            for (flag in Diagnostics.runtimeKeys - setOf("run", "importance")) put(flag, false)
        }
        assertTrue(Diagnostics.validRuntime(runtime))
        assertFalse(Diagnostics.validRuntime(JsonObject(runtime + ("message" to JsonPrimitive("SENSITIVE")))))
        assertFalse(Diagnostics.validRuntime(JsonObject(runtime + ("foreground" to JsonPrimitive("false")))))
        assertFalse(Diagnostics.validRuntime(JsonObject(runtime + ("importance" to JsonPrimitive(2000)))))
        val previous = Diagnostics.sink
        val recorded = mutableListOf<JsonObject>()
        try {
            Diagnostics.sink = { recorded += it }
            Diagnostics.emit("notification.tick", runtime = runtime, durationMs = 180_000)
            assertEquals(runtime, recorded.single()["runtime"])
            Diagnostics.emit("notification.tick", runtime = JsonObject(runtime + ("token" to JsonPrimitive("SENSITIVE"))))
            assertEquals(1, recorded.size)
        } finally { Diagnostics.sink = previous }
    }
    @Test fun networkTelemetryNeverIncludesBodiesHeadersQueriesOrExceptionMessages() {
        val previous = Diagnostics.sink
        val events = mutableListOf<JsonObject>()
        Diagnostics.sink = { synchronized(events) { events += it } }
        try {
            MockWebServer().use { server ->
                server.enqueue(MockResponse().setBody("SENSITIVE response")); server.start()
                val client = OkHttpClient.Builder().eventListenerFactory { Diagnostics.listener() }.build()
                client.newCall(Request.Builder().url(server.url("/api/session/prompt?token=SENSITIVE"))
                    .header("Cookie", "SENSITIVE credential").post("SENSITIVE message".toRequestBody("application/json".toMediaType())).build()).execute().use { it.body!!.string() }
                assertTrue(events.any { it.text("stage") == "http.headers" && it.number("status") == 200L })
                assertTrue(events.all { it.text("endpoint") == "prompt" })
            }
            Diagnostics.emit("socket.failure", code = "SENSITIVE error message")
            Diagnostics.emit("SENSITIVE event name")
            assertFalse(events.toString().contains("SENSITIVE"))
            assertFalse(events.toString().contains("localhost"))
            assertEquals("other", events.last().text("code"))
        } finally { Diagnostics.sink = previous }
    }
}
