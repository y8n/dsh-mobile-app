package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class SessionDiffTest {
    private fun timeline(meta: String, name: String = "edit", error: Boolean = false): Timeline {
        val call = WireJson.parseToJsonElement("""{"type":"tool/call","data":{"callId":"c","name":"$name","arguments":"{\"file_path\":\"owned.kt\"}"}}""").jsonObject
        val result = WireJson.parseToJsonElement("""{"type":"tool/result","data":{"message":{"source":{"kind":"tool","callId":"c"},"isError":$error},"meta":$meta}}""").jsonObject
        return Timeline(events = mapOf(1L to call, 2L to result))
    }
    @Test fun successfulMetadataRetainsOnlyAppliedContextAndReconstructsBothSides() {
        val changes = sessionChanges(timeline("""{"diffs":[{"path":"owned.kt","oldText":"a\nb\nc","newText":"a\nd\nc"}]}"""))
        val lines = diffLines(changes.single())!!
        assertEquals(listOf(' ', '-', '+', ' '), lines.map { it.kind })
        assertEquals("a\nb\nc", lines.filter { it.kind != '+' }.joinToString("\n") { it.text })
        assertEquals("a\nd\nc", lines.filter { it.kind != '-' }.joinToString("\n") { it.text })
    }
    @Test fun missingMalformedAndFailedResultsNeverInventAppliedChanges() {
        for (meta in listOf("null", "{}", "{\"diffs\":[{\"path\":\"x\",\"oldText\":7,\"newText\":\"y\"}]}")) assertNull(diffLines(sessionChanges(timeline(meta)).single()))
        assertNull(diffLines(sessionChanges(timeline("{\"diffs\":[]}", error = true)).single()))
        assertTrue(sessionChanges(timeline("{\"diffs\":[]}", name = "unknown_tool")).isEmpty())
    }
    @Test fun createAndLargeComparisonRespectBoundedWork() {
        assertEquals(listOf(DiffLine('+', "new")), diffLines(FileChange(1, 0, "x", null, "new")))
        assertNull(diffLines(FileChange(1, 0, "x", (1..2000).joinToString("\n"), (1..2000).joinToString("\n"))))
    }
    @Test fun missingPathCannotTurnADisplayLabelIntoAReadableFile() {
        val current = timeline("{\"diffs\":[]}")
        val call = current.events.getValue(1).let { event -> JsonObject(event + ("data" to JsonObject(event.getValue("data").jsonObject + ("arguments" to JsonPrimitive("{}"))))) }
        val missing = sessionChanges(current.copy(events = current.events + (1L to call))).single()
        assertFalse(missing.pathKnown); assertEquals("文件改动", missing.path); assertNull(diffLines(missing))
        assertTrue(sessionChanges(current).single().pathKnown)
    }
}
