package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class SessionTimelineTest {
    private fun json(text: String) = WireJson.parseToJsonElement(text).jsonObject
    private fun snapshot(records: String = "", cursor: Int = 0) = json("""{"type":"snapshot","header":{"id":"session-a"},"cursor":$cursor,"records":[$records],"hasMore":false,"projections":{"asOfSeq":$cursor,"values":{}}}""")
    private fun event(seq: Int, text: String = "hello") = """{"type":"event","event":{"type":"user/message","seq":$seq,"data":{"content":[{"type":"text","text":"$text"}],"source":{"rpcId":"request-a"}}}}"""
    @Test fun reasoningAndImageBlocksSurviveLiveAndSnapshotAndRetireAtSettlement() {
        var state = reduceTimeline(Timeline(), snapshot("", -1))
        state = reduceTimeline(state, json("""{"type":"assistant-stream","frame":{"type":"start","attemptId":"a","revision":1}}"""))
        state = reduceTimeline(state, json("""{"type":"assistant-stream","frame":{"type":"chunk","attemptId":"a","revision":2,"index":0,"chunk":{"type":"reasoning-delta","index":0,"text":"think"}}}"""))
        state = reduceTimeline(state, json("""{"type":"assistant-stream","frame":{"type":"chunk","attemptId":"a","revision":3,"index":1,"chunk":{"type":"block-end","index":1,"block":{"type":"image","attachment":{"attachmentId":"sha256:test"}}}}}"""))
        assertEquals(listOf("reasoning", "image"), state.liveParts.map { it.jsonObject.text("type") })
        assertEquals("think", state.liveParts.first().jsonObject.text("text")); assertEquals("", state.liveText)
        state = reduceTimeline(state, json("""{"type":"assistant-stream","frame":{"type":"end","attemptId":"a","revision":4,"index":2,"outcome":{"kind":"abandoned"}}}"""))
        assertTrue(state.liveParts.isEmpty())
        val opening = json("""{"type":"snapshot","header":{"id":"session-a"},"cursor":-1,"records":[],"hasMore":false,"projections":{},"assistantStream":{"revision":4,"activeAttempt":{"attemptId":"a","nextIndex":2,"stream":[{"type":"reasoning-chunks","index":0,"texts":["first"," second"]},{"type":"text-chunks","index":1,"texts":["answer"]}]}}}""")
        val restored = reduceTimeline(Timeline(), opening)
        assertEquals("first second", restored.liveParts.first().jsonObject.text("text")); assertEquals("answer", restored.liveText)
    }

    @Test fun snapshotAndRepeatedEventProduceOnlyOneMessage() {
        val state = reduceTimeline(Timeline(), snapshot(event(0)))
        val same = reduceTimeline(state, json(event(0)))
        assertEquals(1, same.messages.size); assertEquals("request-a", same.messages.single().requestId)
        assertEquals("hello", same.messages.single().text)
    }
    @Test fun gapRequiresNewSnapshotRatherThanSilentlySkippingMessages() {
        val state = reduceTimeline(Timeline(), snapshot(event(0)))
        try { reduceTimeline(state, json(event(2))); fail("gap must fail") }
        catch (error: GatewayFailure) { assertEquals("sequence-gap", error.code) }
    }
    @Test fun injectedContextRetainsItsContentWithoutImpersonatingHumanInput() {
        val context = event(0).replace("\"rpcId\":\"request-a\"", "\"kind\":\"agent-instructions\",\"form\":\"instructions\"")
        val row = reduceTimeline(Timeline(), snapshot(context)).messages.single()
        assertEquals("context", row.kind); assertEquals("hello", row.text)
        assertNull(row.requestId)
    }
    @Test fun reconnectRestoresStreamAndRejectsRepeatedChunkWithoutDuplicatingText() {
        val opening = json("""{"type":"snapshot","header":{"id":"session-a"},"cursor":-1,"records":[],"hasMore":false,"projections":{},"assistantStream":{"revision":4,"activeAttempt":{"attemptId":"a","nextIndex":1,"stream":[{"type":"text-chunks","index":0,"texts":["Hel"]}]}}}""")
        val state = reduceTimeline(Timeline(), opening)
        val frame = json("""{"type":"assistant-stream","frame":{"type":"chunk","attemptId":"a","revision":5,"index":1,"chunk":{"type":"text-delta","index":0,"text":"lo"}}}""")
        val next = reduceTimeline(state, frame)
        assertEquals("Hello", reduceTimeline(next, frame).liveText)
    }
    @Test fun durableSettlementRetiresTransientText() {
        var state = reduceTimeline(Timeline(), snapshot("", -1))
        state = reduceTimeline(state, json("""{"type":"assistant-stream","frame":{"type":"start","attemptId":"a","revision":1}}"""))
        state = reduceTimeline(state, json("""{"type":"assistant-stream","frame":{"type":"chunk","attemptId":"a","revision":2,"index":0,"chunk":{"type":"text-delta","index":0,"text":"Hello"}}}"""))
        state = reduceTimeline(state, json("""{"type":"event","event":{"type":"assistant/message","seq":0,"data":{"message":{"content":[{"type":"text","text":"Hello"}]}}}}"""))
        state = reduceTimeline(state, json("""{"type":"assistant-stream","frame":{"type":"end","attemptId":"a","revision":3,"index":1,"outcome":{"kind":"committed","seq":0}}}"""))
        assertEquals(1, state.messages.size); assertEquals("", state.liveText)
    }
    @Test fun pageMustStayBeforeLoadedRangeAndKeepOldRowsAcrossReconnect() {
        var state = reduceTimeline(Timeline(), snapshot(event(5), 5))
        state = mergeHistory(state, json("""{"records":[${event(1)}],"hasMore":false}"""))
        assertEquals(listOf(1L, 5L), state.messages.map { it.seq })
        state = reduceTimeline(state, snapshot(event(5), 5))
        assertEquals(listOf(1L, 5L), state.messages.map { it.seq })
        try { mergeHistory(state, json("""{"records":[${event(5)}],"hasMore":true}""")); fail("overlap must fail") }
        catch (error: GatewayFailure) { assertEquals("invalid-page", error.code) }
    }
    @Test fun replacingSurfaceRemovesSupersededVisibleMessage() {
        val replacement = """{"type":"event","event":{"type":"assistant/message","seq":1,"surfaceOp":{"op":"replace","startSeq":0,"endSeq":0},"data":{"message":{"content":[{"type":"text","text":"New"}]}}}}"""
        val state = reduceTimeline(Timeline(), snapshot(event(0) + "," + replacement, 1))
        assertEquals("New", state.messages.single().text)
    }
    @Test fun reconnectGapPaginatesFromTheNewTailInsteadOfTheOldCachedFloor() {
        val old = reduceTimeline(Timeline(), snapshot((0..4).joinToString(",") { event(it) }, 4))
        val fresh = snapshot((10..14).joinToString(",") { event(it) }, 14).let { JsonObject(it + ("hasMore" to JsonPrimitive(true))) }
        val reconnected = reduceTimeline(old, fresh)
        assertEquals(10L, reconnected.pageBefore); assertTrue(reconnected.hasHistoryGap)
        val page = json("""{"records":[${(4..9).joinToString(",") { event(it) }}],"hasMore":true}""")
        val complete = mergeHistory(reconnected, page)
        assertEquals((0L..14L).toList(), complete.events.keys.sorted()); assertEquals(0L, complete.pageBefore); assertFalse(complete.hasHistoryGap); assertFalse(complete.hasMore)
    }
    @Test fun latePageFromAnOldSnapshotCannotChangeTheNewHistoryBoundary() {
        val first = reduceTimeline(Timeline(), snapshot(event(5), 5))
        val latest = reduceTimeline(first, snapshot(event(10), 10))
        assertEquals(latest, mergeHistory(latest, json("""{"records":[${event(4)}],"hasMore":true}"""), first.pageBefore, first.throughSeq))
    }
    @Test fun emptyPageThatClaimsMoreHistoryIsNotAcceptedAsProgress() {
        val current = reduceTimeline(Timeline(), snapshot(event(5), 5))
        try { mergeHistory(current, json("""{"records":[],"hasMore":true}""")); fail("Non-progressing page accepted") }
        catch (e: GatewayFailure) { assertEquals("invalid-page", e.code) }
    }
    @Test fun duplicateHistoricalSequenceCannotOverwriteAnEarlierRecordSilently() {
        try { reduceTimeline(Timeline(), snapshot(event(0, "first") + "," + event(0, "different"))); fail("Duplicate sequence accepted") }
        catch (e: GatewayFailure) { assertEquals("invalid-response", e.code) }
    }
}
