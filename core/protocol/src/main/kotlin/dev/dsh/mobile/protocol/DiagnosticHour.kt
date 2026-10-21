package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

const val DIAGNOSTIC_HOUR_MS = 3_600_000L
const val DIAGNOSTIC_PART_EVENTS = 10_000L
fun diagnosticHour(event: JsonObject): Long = event.number("at") / DIAGNOSTIC_HOUR_MS * DIAGNOSTIC_HOUR_MS
fun diagnosticPart(event: JsonObject): Long = event.number("seq") / DIAGNOSTIC_PART_EVENTS
/** A request touches just one UTC hour/part; manual flushes append to the same archive. */
fun hourlyDiagnosticBatch(events: List<JsonObject>): List<JsonObject> {
    val first = events.firstOrNull() ?: return emptyList()
    return events.take(500).takeWhile { diagnosticHour(it) == diagnosticHour(first) && diagnosticPart(it) == diagnosticPart(first) }
}
fun diagnosticArchiveKey(journalId: String, hour: Long, part: Long): String {
    val date = DateTimeFormatter.ofPattern("yyyy-MM-dd/HH").withZone(ZoneOffset.UTC).format(Instant.ofEpochMilli(hour))
    return "hours/$date/$journalId/part-${part.toString().padStart(8, '0')}.json"
}
