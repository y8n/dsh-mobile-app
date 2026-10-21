package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class TurnChangesTest {
    @Test fun closingCardsUseTurnIdentityAcrossInterleavedAndPagedRecords() {
        fun event(seq: Long, type: String, turn: Int) = seq to buildJsonObject { put("type", type); put("data", buildJsonObject { put("turn",turn) }) }
        val t = Timeline(events = mapOf(event(2,"workspace/changes",1),event(3,"workspace/changes",2),event(4,"assistant/message",1),event(5,"assistant/message",2),event(6,"workspace/changes",1)))
        assertEquals(6L,closingChangesSequence(t,4)); assertEquals(3L,closingChangesSequence(t,5)); assertNull(closingChangesSequence(t,99))
    }
    @Test fun countsAreOnlyHostFactsAndMalformedSummaryIsRejected() {
        val good = WireJson.parseToJsonElement("""{"turn":1,"total":1,"added":145,"deleted":0,"files":[{"path":"/notes/report.md","display":"report.md","added":145,"deleted":0}]}""").jsonObject
        assertEquals(145L,turnChangeSummary(good).added)
        assertEquals(2L,turnChangeSummary(JsonObject(good + ("total" to JsonPrimitive(2)))).total)
        for (bad in listOf(good + ("total" to JsonPrimitive(0)),good + ("added" to JsonPrimitive(-1)))) {
            try { turnChangeSummary(JsonObject(bad)); fail("Invalid summary admitted") } catch (_: GatewayFailure) { }
        }
    }
    @Test fun snapshotDiffUsesRecordedHunksAndHandlesBinaryAndOversized() {
        val text=WireJson.parseToJsonElement("""{"kind":"text","hunks":[{"lines":[" same","-old","+new"]}]}""").jsonObject
        assertEquals(listOf(' ','-','+'),turnDiffLines(text)!!.map { it.kind })
        assertNull(turnDiffLines(buildJsonObject { put("kind","binary") }))
        assertNull(turnDiffLines(buildJsonObject { put("kind","oversized") }))
        try { turnDiffLines(WireJson.parseToJsonElement("""{"kind":"text","hunks":[{"lines":["invalid"]}]}""").jsonObject); fail("Invalid diff admitted") } catch (_: GatewayFailure) { }
    }
}
