package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class SessionTranscriptTest {
    @Test fun onlyFinalAnswerReceivesCopyAction() {
        val completed = sessionTranscript(timeline())
        assertEquals(listOf("## Final"), completed.filter { it.finalReply }.map { it.message!!.text })
        assertTrue(completed.filter { it.owner != null }.none { it.finalReply })
        val running = timeline().let { it.copy(events = it.events.filterValues { event -> event.text("type") != "turn/end" }) }
        assertTrue(sessionTranscript(running).none { it.finalReply })
    }
    private fun event(seq: Long, type: String, data: String) = WireJson.parseToJsonElement("""{"seq":$seq,"time":${seq * 1000},"type":"$type","data":$data}""").jsonObject
    private fun assistant(seq: Long, step: Int, parts: String) = event(seq, "assistant/message", """{"turn":1,"step":$step,"message":{"content":[$parts]}}""")
    private fun timeline(reason: String = "completed", steering: Boolean = false, start: Boolean = true, answer: Boolean = true) = Timeline(events = buildList {
        if (start) add(event(0, "turn/start", """{"turn":1}"""))
        add(assistant(1, 1, """{"type":"reasoning","text":"private process"},{"type":"text","text":"progress"},{"type":"tool-call","name":"read"}"""))
        add(event(2, "tool/call", """{"turn":1,"step":1,"callId":"c1","name":"read","arguments":"file.txt"}"""))
        add(event(3, "tool/result", """{"turn":1,"step":1,"message":{"toolCallId":"c1","content":[{"type":"image","attachment":{"attachmentId":"sha256:abc","name":"result.png","bytes":4}}]}}"""))
        if (steering) add(event(4, "user/message", """{"content":[{"type":"text","text":"new input"}],"source":{"kind":"user"}}"""))
        if (answer) add(assistant(5, 2, """{"type":"reasoning","text":"final reasoning"},{"type":"text","text":"## Final"}"""))
        add(event(6, "turn/end", """{"turn":1,"reason":{"kind":"$reason"}}"""))
    }.associateBy { it.number("seq") })
    @Test fun completedTurnHidesProcessButPreservesFinalAnswerAndOwnReasoning() {
        val rows = sessionTranscript(timeline())
        val process = rows.single { it.process != null }.process!!
        assertTrue(process.foldable)
        val collapsed = rows.filter { it.owner == null }
        assertTrue(collapsed.any { it.message?.text == "## Final" })
        assertFalse(collapsed.any { it.message?.text == "progress" })
        assertTrue(rows.any { it.owner == process.id && it.message?.parts?.any { part -> (part as JsonObject).text("type") == "reasoning" } == true })
        assertEquals(1, rows.count { it.message?.text == "## Final" })
    }
    @Test fun ordinaryInjectedContextDoesNotPreventCompletedTurnFolding() {
        val t = timeline().let { it.copy(events = it.events + (4L to event(4, "user/message", """{"id":"context","source":{"kind":"runtime-context"},"content":[{"type":"text","text":"internal context"}]}"""))) }
        val rows = sessionTranscript(t)
        assertTrue(rows.single { it.process != null }.process!!.foldable)
        assertFalse(rows.any { it.message?.text == "internal context" })
    }
    @Test fun claimedScheduleIsVisibleButUnclaimedContextIsHidden() {
        val t = Timeline(events = listOf(
            event(0, "agent/inbox/spliced", """{"target":"next-turn","start":0,"inserted":[{"id":"schedule","source":{"kind":"schedule"}}]}"""),
            event(1, "agent/inbox/spliced", """{"target":"next-turn","start":0,"removedCount":1,"inserted":[]}"""),
            event(2, "user/message", """{"id":"schedule","source":{"kind":"schedule"},"content":[{"type":"text","text":"scheduled input"}]}"""),
        ).associateBy { it.number("seq") })
        assertEquals("trigger", sessionTranscript(t).single().message!!.kind)
    }
    @Test fun stoppedAndFailedTurnsCannotCollapse() {
        listOf("aborted", "error").forEach { reason -> assertFalse(sessionTranscript(timeline(reason)).single { it.process != null }.process!!.foldable) }
    }
    @Test fun steeringKeepsChronologyAndProcessVisible() {
        val rows = sessionTranscript(timeline(steering = true))
        assertFalse(rows.single { it.process != null }.process!!.foldable)
        assertTrue(rows.indexOfFirst { it.message?.text == "new input" } < rows.indexOfFirst { it.message?.text == "## Final" })
    }
    @Test fun partialHistoryCanCollapseWithoutFabricatedDuration() {
        val process = sessionTranscript(timeline(start = false)).single { it.process != null }.process!!
        assertTrue(process.foldable); assertEquals("已完成", process.label)
    }
    @Test fun missingFinalAnswerDoesNotPromoteAToolCallingStepToFinal() {
        val rows = sessionTranscript(timeline(answer = false))
        assertFalse(rows.any { it.owner == null && it.message?.kind == "assistant" })
    }
    @Test fun toolResultMergesIntoItsCallAndRetainsAttachment() {
        val rows = timeline().messages.filter { it.kind == "tool" }
        assertEquals(1, rows.size); assertEquals("result.png", rows.single().parts.single().jsonObject["attachment"]!!.jsonObject.text("name"))
    }
    @Test fun liveTurnNeverAutoCollapses() {
        val t = timeline().let { it.copy(events = it.events.filterKeys { seq -> seq != 6L }) }
        assertTrue(sessionTranscript(t).all { it.owner == null && it.process == null })
    }
    @Test fun pagingKeepsProcessIdentity() {
        val partial = sessionTranscript(timeline(start = false)).single { it.process != null }.key
        assertEquals(partial, sessionTranscript(timeline()).single { it.process != null }.key)
    }
}
