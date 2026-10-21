package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*

data class TurnChangedFile(val path: String, val display: String, val added: Long, val deleted: Long, val binary: Boolean, val oversized: Boolean)
data class TurnChangeSummary(val turn: Long, val files: List<TurnChangedFile>, val total: Long, val added: Long, val deleted: Long)

/** Join by durable turn identity, never by whichever tool happens to be nearby. */
fun closingChangesSequence(timeline: Timeline, closingSeq: Long): Long? {
    val turn = (timeline.events[closingSeq]?.get("data") as? JsonObject)?.get("turn") ?: return null
    return timeline.events.entries.filter { (_, e) -> e.text("type") == "workspace/changes" && (e["data"] as? JsonObject)?.get("turn") == turn }.maxOfOrNull { it.key }
}
fun turnChangeSummary(value: JsonObject): TurnChangeSummary = wireValue {
    fun JsonObject.count(name: String): Long = getValue(name).jsonPrimitive.long.also { require(it >= 0) }
    val files = value.getValue("files").jsonArray.also { require(it.size <= 2000) }.map { raw ->
        val f = raw.jsonObject
        TurnChangedFile(f.string("path").also { require(it.isNotBlank()) }, f.string("display").also { require(it.isNotBlank()) },
            f.count("added"), f.count("deleted"), f["binary"]?.jsonPrimitive?.booleanOrNull == true, f["oversized"]?.jsonPrimitive?.booleanOrNull == true)
    }
    TurnChangeSummary(value.count("turn").also { require(it > 0) }, files, value.count("total").also { require(it >= files.size.toLong()) }, value.count("added"), value.count("deleted"))
}
/** Only the Host's recorded hunk lines; current file contents cannot substitute for this snapshot. */
fun turnDiffLines(value: JsonObject): List<DiffLine>? = wireValue {
    when (value.text("kind")) {
        "binary", "oversized" -> null
        "text" -> value.getValue("hunks").jsonArray.flatMap { hunk ->
            hunk.jsonObject.getValue("lines").jsonArray.map { line ->
                val text = line.jsonPrimitive.content
                require(text.isNotEmpty() && text.first() in setOf('+', '-', ' '))
                DiffLine(text.first(), text.drop(1))
            }
        }.also { require(it.size <= 20000) }
        else -> throw GatewayFailure("invalid-response")
    }
}
