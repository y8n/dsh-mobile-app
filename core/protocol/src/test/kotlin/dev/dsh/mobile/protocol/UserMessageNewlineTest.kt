package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class UserMessageNewlineTest {
    @Test fun newlinesAndEmptyLinesSurviveWireRoundtripAndTimeline() {
        val text = "第一行\n第二行\n\n第四行\n"
        val event = buildJsonObject {
            put("type", "user/message"); put("seq", 0)
            put("data", buildJsonObject { put("content", buildJsonArray { add(buildJsonObject { put("type", "text"); put("text", text) }) }) })
        }
        val snapshot = buildJsonObject {
            put("type", "snapshot"); put("header", buildJsonObject { put("id", "newline-fixture") }); put("cursor", 0)
            put("records", buildJsonArray { add(buildJsonObject { put("event", event) }) }); put("hasMore", false); put("projections", buildJsonObject {})
        }
        val decoded = WireJson.parseToJsonElement(snapshot.toString()).jsonObject
        assertEquals(text, reduceTimeline(Timeline(), decoded).messages.single().text)
        assertEquals(text, contentText(event.getValue("data").jsonObject["content"]))
    }
}
