package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*
import org.junit.Assert.*
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.flow.Flow
import org.junit.Test

class SessionNotificationBatchTest {
    private fun event(id: String, at: Long = 1_000_000, kind: String = "completed") = buildJsonObject {
        put("id", id); put("sessionId", "会话/一"); put("kind", kind); put("at", at)
    }
    private fun batch(events: List<JsonObject> = emptyList(), pending: List<JsonObject> = emptyList()) = buildJsonObject {
        put("version", 1); put("epoch", "host-generation"); put("cursor", 5); put("now", 1_000_000)
        put("events", JsonArray(events)); put("pending", JsonArray(pending))
    }
    @Test fun completionAndConfirmationKeepTheirSessionAndDoNotRepeatOnReplay() {
        val parsed = SessionNotificationBatch.parse(batch(listOf(event("finish")), listOf(event("ask", kind = "confirmation"))))
        assertEquals(2, parsed.unseen(emptySet()).size)
        assertEquals("会话/一", parsed.unseen(emptySet()).first().sessionId)
        assertTrue(parsed.unseen(setOf("finish", "ask")).isEmpty())
        assertTrue(parsed.unseen(setOf("finish")).single().confirmation)
    }
    @Test fun oldCompletionsAreNotDeliveredButOutstandingConfirmationRemainsActionable() {
        val parsed = SessionNotificationBatch.parse(batch(listOf(event("old", 1), event("future", 2_000_000), event("recent", 999_999)), listOf(event("ask", 1, "confirmation"))))
        assertEquals(listOf("recent", "ask"), parsed.unseen(emptySet()).map { it.id })
    }
    @Test fun malformedGenerationAndCursorAndUnexpectedEventsFailClosed() {
        val invalid = listOf(batch() + ("version" to JsonPrimitive(2)), batch() + ("cursor" to JsonPrimitive(-1)),
            batch() + ("epoch" to JsonPrimitive("")), batch(listOf(event("same"), event("same"))),
            batch(listOf(event("wrong", kind = "confirmation"))), batch(pending = List(257) { event("ask$it", kind = "confirmation") }))
        invalid.forEach { value -> try { SessionNotificationBatch.parse(JsonObject(value)); fail("accepted invalid batch") } catch (error: GatewayFailure) { assertEquals("invalid-response", error.code) } }
    }
    @Test fun pollTransportsNamedRequestAndRetainsCursorForCompletionReplay() = runBlocking {
        val calls = mutableListOf<JsonObject>()
        val gateway = object : DeviceGateway {
            override suspend fun probe() = Unit
            override fun close() = Unit
            override fun followWorkspaces(): Flow<JsonObject> = error("not used")
            override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
                assertEquals("mobileNotifications/poll", method); assertFalse(mutation)
                assertEquals(setOf("request"), args.keys)
                val request = args.getValue("request").jsonObject; calls += request
                return if (calls.size == 1) batch() else {
                    assertEquals("host-generation", request.getValue("epoch").jsonPrimitive.content)
                    assertEquals(5L, request.getValue("after").jsonPrimitive.long)
                    batch(listOf(event("completion-after-baseline")))
                }
            }
        }
        val first = gateway.readSessionNotifications(null, 99)
        assertTrue(calls.first().isEmpty())
        val second = gateway.readSessionNotifications(first.epoch, first.cursor)
        assertEquals("completion-after-baseline", second.unseen(emptySet()).single().id)
    }

}
