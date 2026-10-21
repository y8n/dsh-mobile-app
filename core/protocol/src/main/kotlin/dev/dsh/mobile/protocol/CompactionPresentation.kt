package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*

internal fun JsonObject.compactCheckpoint(): JsonObject? = (get("data") as? JsonObject)?.get("source")?.let { it as? JsonObject }
    ?.takeIf { text("type") == "user/message" && (get("surfaceOp") as? JsonObject)?.text("op") == "replace" && it.text("kind") == "compact-checkpoint" }

/** DSH correlates a checkpoint and summary by compactionId, and manual commands by commandId. */
fun compactionRows(events: Map<Long, JsonObject>): List<MessageRow> {
    val ordered = events.toSortedMap()
    val checkpoints = ordered.mapNotNull { (seq, event) -> event.compactCheckpoint()?.let { Triple(seq, event, it) } }
    val rows = checkpoints.map { (seq, _, source) ->
        val summary = ordered.values.lastOrNull { it.text("type") == "compaction/summary" &&
            (it["data"] as? JsonObject)?.text("compactionId") == source.text("compactionId") }?.get("data") as? JsonObject
        val count = (summary?.get("shadowedSeqs") as? JsonArray)?.takeIf { values -> values.all { (it as? JsonPrimitive)?.longOrNull?.let { n -> n >= 0 } == true } }?.size
        val tokens = (summary?.get("shadowedTokenCount") as? JsonPrimitive)?.longOrNull?.takeIf { it >= 0 }
        MessageRow(seq, "compact", if (count != null && tokens != null) "compact · 已压缩 $count 条历史记录（约 $tokens tokens）" else "compact · 上下文已压缩",
            detail = contentText(summary?.get("summary")))
    }.toMutableList()
    ordered.forEach { (seq, event) ->
        val data = event["data"] as? JsonObject ?: return@forEach
        if (event.text("type") != "command/run" || data.text("name") != "compact") return@forEach
        val command = data.text("commandId")
        if (checkpoints.any { it.third.text("sourceCommandId") == command }) return@forEach
        val done = ordered.values.lastOrNull { it.text("type") == "command/done" && (it["data"] as? JsonObject)?.text("commandId") == command }?.get("data") as? JsonObject
        rows += MessageRow(seq, "compact", when (done?.text("kind")) { "error" -> "compact · 压缩失败"; "success" -> "compact · ${done.text("text").ifBlank { "压缩指令已完成" }}"; else -> "compact · 正在压缩上下文…" }, detail = done?.text("text").orEmpty())
    }
    return rows.sortedBy { it.seq }
}

/** No guessing from ordinary replies: only this command's settlement or a landed checkpoint. */
fun compactSettlement(timeline: Timeline, after: Long): Boolean? {
    val events = timeline.events.filterKeys { it > after }
    val run = events.values.singleOrNull { it.text("type") == "command/run" && (it["data"] as? JsonObject)?.text("name") == "compact" }
    val commandId = (run?.get("data") as? JsonObject)?.text("commandId")
    if (!commandId.isNullOrBlank()) {
        val done = events.values.firstOrNull { it.text("type") == "command/done" && (it["data"] as? JsonObject)?.text("commandId") == commandId }
        if (done != null) return (done["data"] as? JsonObject)?.text("kind") == "success"
        if (events.values.any { it.compactCheckpoint()?.text("sourceCommandId") == commandId }) return true
    }
    // A paged snapshot may retain the checkpoint and omit command/run.
    return if (events.values.mapNotNull { it.compactCheckpoint()?.text("sourceCommandId")?.takeIf(String::isNotBlank) }.distinct().size == 1 && events.values.none { it.text("type") == "command/run" }) true else null
}
