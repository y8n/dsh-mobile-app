package dev.dsh.mobile

import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.*
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.io.IOException
import java.util.UUID

class DiagnosticJournalTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private fun event(seq: Int) = buildJsonObject {
        put("at", System.currentTimeMillis()); put("stage", "socket.failure"); put("trace", UUID.randomUUID().toString())
        put("endpoint", "mux"); put("durationMs", seq); put("status", 0); put("code", "reset"); put("attempt", 0)
    }
    @Test fun explicitUploadDrainsExistingBacklogInBatches() = runBlocking {
        val directory = File(context.cacheDir, "diagnostic-${UUID.randomUUID()}")
        val batches = mutableListOf<Int>()
        val repo = DiagnosticRepository(context, "0.1.1-alpha.1", 15, directory) { report ->
            batches += report.getValue("events").jsonArray.size
            buildJsonObject { put("reportId", report.text("reportId")); put("accepted", report.getValue("events").jsonArray.size) }
        }
        try {
            repeat(3) { repeat(100) { repo.record(event(it)) }; repo.flush() }
            repo.automatic(false)
            repo.uploadAll(force = true)
            assertEquals(listOf(300), batches)
            assertEquals(0, repo.state.value.queued)
        } finally { repo.close(); directory.deleteRecursively() }
    }
    @Test fun manualUploadContinuesSameHourAfterRestartAndSplitsNextHour() = runBlocking {
        val directory = File(context.cacheDir, "diagnostic-${UUID.randomUUID()}")
        val reports = mutableListOf<JsonObject>()
        val uploader: suspend (JsonObject) -> JsonObject = { report ->
            reports += report
            buildJsonObject { put("reportId", report.text("reportId")); put("accepted", report.getValue("events").jsonArray.size) }
        }
        val hour = System.currentTimeMillis() / 3600000 * 3600000
        fun at(time: Long) = JsonObject(event(0) + ("at" to JsonPrimitive(time)))
        var repo = DiagnosticRepository(context, "0.1.1-alpha.2", 16, directory, uploader = uploader)
        try {
            repo.record(at(hour + 1)); repo.uploadAll(force = true)
            val key = repo.state.value.lastArchiveKey
            assertNotNull(key)
            repo.flush(); repo.close()
            repo = DiagnosticRepository(context, "0.1.1-alpha.2", 16, directory, uploader = uploader)
            repo.record(at(hour + 2)); repo.uploadAll(force = true)
            assertEquals(key, repo.state.value.lastArchiveKey)
            assertEquals(reports[0].text("journalId"), reports[1].text("journalId"))
            assertNotEquals(reports[0].text("reportId"), reports[1].text("reportId"))
            repo.record(at(hour + 3600000)); repo.uploadAll(force = true)
            assertNotEquals(key, repo.state.value.lastArchiveKey)
            assertEquals(3, reports.size)
            assertEquals(0, repo.state.value.queued)
        } finally { repo.close(); directory.deleteRecursively() }
    }
    @Test fun uploadDrainStopsOnFailureAndFlushPersistsBackgroundRuntime() = runBlocking {
        val directory = File(context.cacheDir, "diagnostic-${UUID.randomUUID()}")
        var calls = 0
        val repo = DiagnosticRepository(context, "0.1.1-alpha.1", 15, directory) { calls++; throw IOException("not a log field") }
        try {
            val runtime = buildJsonObject {
                put("run", UUID.randomUUID().toString()); put("importance", 400)
                for (flag in Diagnostics.runtimeKeys - setOf("run", "importance")) put(flag, false)
            }
            repo.record(JsonObject(event(0) + mapOf("stage" to JsonPrimitive("app.visibility"), "runtime" to runtime)))
            // Barrier must include the immediately preceding event, without waiting for a debounce.
            repo.flush()
            val saved = WireJson.parseToJsonElement(File(directory, "journal.json").readText()).jsonObject
            assertEquals(runtime, saved.getValue("events").jsonArray.single().jsonObject["runtime"])
            repo.uploadAll(force = true)
            assertEquals(1, calls); assertEquals(1, repo.state.value.queued)
            assertNotNull(repo.state.value.error)
        } finally { repo.close(); directory.deleteRecursively() }
    }
    @Test fun failedUploadSurvivesRestartAndAcknowledgementRemovesOnlyItsBatch() = runBlocking {
        val directory = File(context.cacheDir, "diagnostic-${UUID.randomUUID()}")
        var first: JsonObject? = null
        var repo = DiagnosticRepository(context, "0.1.0-beta.4", 10, directory) { report -> first = report; throw IOException("private failure text") }
        try {
            repeat(3) { repo.record(event(it)) }
            withTimeout(5000) { repo.state.first { it.queued == 3 } }
            repo.upload(force = true); repo.flush()
            assertNotNull(repo.state.value.error); assertEquals(3, repo.state.value.queued)
            repo.close()
            repo = DiagnosticRepository(context, "0.1.0-beta.4", 10, directory) { report ->
                assertEquals(first, report)
                repo.record(event(5))
                delay(100)
                buildJsonObject { put("reportId", report.text("reportId")); put("accepted", report.getValue("events").jsonArray.size) }
            }
            repo.upload(force = true)
            assertEquals(first!!.text("reportId"), repo.state.value.lastReportId)
            assertEquals(1, repo.state.value.queued)
            assertFalse(File(directory, "journal.json").readText().contains("private failure text"))
        } finally { repo.close(); directory.deleteRecursively() }
    }
    @Test fun rejectsExtraSensitiveFieldsAndDisablingAutomaticStillAllowsExplicitUpload() = runBlocking {
        val directory = File(context.cacheDir, "diagnostic-${UUID.randomUUID()}")
        var calls = 0
        val repo = DiagnosticRepository(context, "0.1.0-beta.4", 10, directory) { report ->
            calls++; assertFalse(report.toString().contains("SENSITIVE"))
            buildJsonObject { put("reportId", report.text("reportId")); put("accepted", report.getValue("events").jsonArray.size) }
        }
        try {
            repo.record(JsonObject(event(0) + ("message" to JsonPrimitive("SENSITIVE message and token"))))
            repo.record(JsonObject(event(0) + ("code" to JsonPrimitive("SENSITIVE token"))))
            repo.record(event(1))
            withTimeout(5000) { repo.state.first { it.queued == 1 } }
            repo.automatic(false); repo.upload(); assertEquals(0, calls)
            repo.upload(force = true); assertEquals(1, calls); assertEquals(0, repo.state.value.queued)
            assertFalse(File(directory, "journal.json").readText().contains("SENSITIVE"))
        } finally { repo.close(); directory.deleteRecursively() }
    }
    @Test fun cacheIsBoundedAndInvalidReceiptCannotLoseQueuedEvents() = runBlocking {
        val directory = File(context.cacheDir, "diagnostic-${UUID.randomUUID()}")
        val repo = DiagnosticRepository(context, "0.1.0-beta.4", 10, directory) { buildJsonObject { put("reportId", UUID.randomUUID().toString()); put("accepted", 100) } }
        try {
            repeat(6) { batch ->
                repeat(100) { repo.record(event(it)) }
                withTimeout(5000) { repo.state.first { it.queued == ((batch + 1) * 100).coerceAtMost(500) } }
                repo.flush()
            }
            repo.upload(force = true)
            assertEquals(500, repo.state.value.queued); assertNotNull(repo.state.value.error)
            repo.flush()
            assertEquals(500, WireJson.parseToJsonElement(File(directory,"journal.json").readText()).jsonObject.getValue("events").jsonArray.size)
        } finally { repo.close(); directory.deleteRecursively() }
    }
}
