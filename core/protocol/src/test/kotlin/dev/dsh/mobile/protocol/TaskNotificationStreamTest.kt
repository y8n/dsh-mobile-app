package dev.dsh.mobile.protocol

import org.junit.Assert.*
import org.junit.Test

class TaskNotificationStreamTest {
    @Test fun oldPluginWirePayloadUsesTheSameIdAsDurableCatchup() {
        val decoder = TaskNotificationDecoder { 1000 }
        assertNull(decoder.line(": heartbeat"))
        decoder.line("event: task-notify")
        decoder.line("data: {\"sessionId\":\"会话/a\",\"turn\":7}")
        assertEquals(SessionNotificationEvent("会话/a:turn:7", "会话/a", false, 1000), decoder.line(""))
        assertNull(decoder.line(""))
    }
    @Test fun multipleDataLinesAreJoinedAndUnknownEventsDoNotLeakIntoNextFrame() {
        val decoder = TaskNotificationDecoder { 1 }
        decoder.line("event: extensions-changed"); decoder.line("data: {}"); assertNull(decoder.line(""))
        decoder.line("event: task-notify"); decoder.line("data: {\"sessionId\":\"s\","); decoder.line("data: \"turn\":2}")
        assertEquals("s:turn:2", decoder.line("")?.id)
    }
    @Test fun malformedTasksAreIgnoredAndRevocationTerminatesConnection() {
        val decoder = TaskNotificationDecoder()
        for (payload in listOf("{}", "[]", "invalid", "{\"sessionId\":\"\",\"turn\":0}", "{\"sessionId\":\"s\",\"turn\":-1}", "{\"sessionId\":\"s\",\"turn\":\"1\"}")) {
            decoder.line("event: task-notify"); decoder.line("data: $payload"); assertNull(decoder.line(""))
        }
        decoder.line("event: device-revoked"); decoder.line("data: {\"reason\":\"device_revoked\"}")
        try { decoder.line(""); fail("revoked") } catch (error: GatewayFailure) { assertEquals("device-revoked", error.code) }
    }
    @Test fun frameAndLineSizesAreBounded() {
        for (lines in listOf(listOf("x".repeat(65_537)), List(3) { "data: ${"x".repeat(30_000)}" })) {
            val decoder = TaskNotificationDecoder()
            try { lines.forEach { decoder.line(it) }; fail("unbounded") } catch (error: GatewayFailure) { assertEquals("response-too-large", error.code) }
        }
    }
}
