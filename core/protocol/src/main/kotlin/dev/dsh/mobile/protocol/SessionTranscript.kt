package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*

/** DSH chat: completed turns fold process, keeping the last step's reply visible.
 * Stops, failures and interleaved input keep their chronology visible. */
data class TranscriptEntry(val key: String, val message: MessageRow? = null, val process: TurnProcess? = null, val owner: Long? = null, val group: ProcessGroup? = null, val groupOwner: String? = null, val finalReply: Boolean = false)
data class ProcessGroup(val id: String, val label: String)
data class TurnProcess(val id: Long, val label: String, val foldable: Boolean)

fun sessionTranscript(timeline: Timeline): List<TranscriptEntry> {
    val triggers = turnTriggerSequences(timeline)
    val messages = timeline.messages.mapNotNull { row ->
        if (row.kind != "context") row
        else if (row.seq in triggers) row.copy(kind = "trigger", detail = ((timeline.events[row.seq]?.get("data") as? JsonObject)?.get("source") as? JsonObject)?.text("kind").orEmpty())
        else row.takeIf { it.parts.any { part -> (part as? JsonObject)?.text("type") in setOf("image", "file") } }
    }
    val events = timeline.events.toSortedMap()
    val ends = events.values.filter { it.text("type") == "turn/end" }
    val processBySeq = mutableMapOf<Long, TurnProcess>()
    val finalSeqs = mutableSetOf<Long>()
    val headerAt = mutableMapOf<Long, TurnProcess>()
    ends.forEach { end ->
        val data = end["data"] as? JsonObject ?: return@forEach
        val turn = data["turn"] ?: return@forEach
        val start = events.values.firstOrNull { it.text("type") == "turn/start" && (it["data"] as? JsonObject)?.get("turn") == turn }
        val endSeq = end.number("seq")
        val rows = messages.filter { row -> row.kind != "compact" && (events[row.seq]?.get("data") as? JsonObject)?.get("turn") == turn }
        if (rows.isEmpty()) return@forEach
        val lastStep = events.values.filter { (it["data"] as? JsonObject)?.get("turn") == turn }
            .mapNotNull { ((it["data"] as? JsonObject)?.get("step") as? JsonPrimitive)?.longOrNull }.maxOrNull()
        val answer = rows.lastOrNull { row -> row.kind == "assistant" &&
            ((events[row.seq]?.get("data") as? JsonObject)?.get("step") as? JsonPrimitive)?.longOrNull == lastStep &&
            row.parts.none { (it as? JsonObject)?.text("type") == "tool-call" } &&
            (row.text.isNotBlank() || row.parts.any { (it as? JsonObject)?.text("type") in setOf("image", "file") }) }
        val firstProcess = rows.first().seq
        val interleaved = messages.any { it.seq > firstProcess && it.seq < endSeq && it.kind in setOf("user", "trigger", "context") }
        val reason = (data["reason"] as? JsonObject)?.text("kind")
        val foldable = reason !in setOf("aborted", "error") && !interleaved
        val duration = if (start == null) null else {
            val from = (start["time"] as? JsonPrimitive)?.longOrNull
            val to = (end["time"] as? JsonPrimitive)?.longOrNull
            if (from != null && to != null) ((to - from).coerceAtLeast(1000) / 1000) else null
        }
        val label = when (reason) {
            "aborted" -> "已停止"
            "error" -> "执行失败"
            else -> if (duration == null) "已完成" else "已完成，用时" + (if (duration >= 3600) "${duration / 3600}小时" else "") + (if (duration >= 60) "${duration / 60 % 60}分" else "") + "${duration % 60}秒"
        }
        val process = TurnProcess(endSeq, label, foldable)
        val processRows = rows.filter { it != answer || it.parts.any { part -> (part as? JsonObject)?.text("type") == "reasoning" } }
        if (processRows.isNotEmpty()) {
            headerAt[firstProcess] = process
            processRows.forEach { processBySeq[it.seq] = process }
        }
        answer?.let { finalSeqs += it.seq }
    }
    val flat = buildList {
        messages.forEach { row ->
            headerAt[row.seq]?.let { add(TranscriptEntry("process_${it.id}", process = it)) }
            val owner = processBySeq[row.seq]?.id
            if (row.seq in finalSeqs && owner != null) {
                val reasoning = JsonArray(row.parts.filter { (it as? JsonObject)?.text("type") == "reasoning" })
                add(TranscriptEntry("reasoning_${row.seq}", row.copy(text = "", parts = reasoning), owner = owner))
            }
            val reasoning = JsonArray(row.parts.filter { (it as? JsonObject)?.text("type") == "reasoning" })
            if (row.kind == "assistant" && reasoning.isNotEmpty() && row.seq !in finalSeqs) {
                add(TranscriptEntry("reasoning_${row.seq}", row.copy(text = "", parts = reasoning), owner = owner))
            }
            val visible = if (row.kind == "assistant") row.copy(parts = JsonArray(row.parts.filter { (it as? JsonObject)?.text("type") != "reasoning" })) else row
            if (visible.kind != "assistant" || visible.text.isNotBlank() || visible.parts.any { (it as? JsonObject)?.text("type") in setOf("image", "file") })
                add(TranscriptEntry("message_${row.seq}", visible, owner = if (row.seq in finalSeqs) null else owner, finalReply = row.seq in finalSeqs))
        }
    }
    return buildList {
        val pending = mutableListOf<TranscriptEntry>()
        fun flush() {
            if (pending.isEmpty()) return
            val id = "group_${pending.last().key}"
            val categories = pending.mapNotNull { it.message?.takeIf { row -> row.kind == "tool" }?.text?.let(::toolCategory) }
                .groupingBy { it }.eachCount().entries.sortedByDescending { it.value }.take(3).map { it.key }
            add(TranscriptEntry(id, owner = pending.first().owner, group = ProcessGroup(id, categories.joinToString("、").ifBlank { "已完成分析" })))
            pending.forEach { add(it.copy(groupOwner = id)) }
            pending.clear()
        }
        flat.forEach { entry ->
            val message = entry.message
            val inGroup = entry.owner != null && message != null && (message.kind == "tool" ||
                message.kind == "assistant" && message.text.isBlank() && message.parts.any { (it as? JsonObject)?.text("type") == "reasoning" })
            if (!inGroup || pending.lastOrNull()?.owner?.let { it != entry.owner } == true) flush()
            if (inGroup) pending += entry else add(entry)
        }
        flush()
    }
}

private fun toolCategory(name: String): String = when {
    name in setOf("read", "read_file") -> "已读取文件"
    name in setOf("edit", "apply_patch") -> "修改了文件"
    name in setOf("write", "write_file") -> "已写入文件"
    name in setOf("bash", "shell", "exec_command") -> "执行了命令"
    name == "run_code" -> "运行了代码"
    name.contains("search") || name in setOf("grep", "glob") -> "已搜索代码"
    else -> "已调用工具"
}

/** Same durable claim boundary as DSH inbox.ts; ordinary model context stays in
 * Timeline for protocol reconciliation, but does not occupy the chat transcript. */
private fun turnTriggerSequences(timeline: Timeline): Set<Long> {
    data class Inbox(val pending: MutableList<JsonObject> = mutableListOf(), var ids: Set<String> = emptySet(), var seq: Long = -1, var human: Boolean = false)
    val nextTurn = Inbox(); val nextStep = Inbox()
    var start: Long? = null; var step: Long? = null
    return buildSet {
        timeline.events.toSortedMap().forEach { (seq, event) ->
            val data = event["data"] as? JsonObject ?: return@forEach
            when (event.text("type")) {
                "turn/start" -> { start = seq; step = null }
                "step/start" -> step = (data["step"] as? JsonPrimitive)?.longOrNull
                "agent/inbox/spliced" -> {
                    val inbox = when (data.text("target")) { "next-turn" -> nextTurn; "next-step" -> nextStep; else -> return@forEach }
                    val index = ((data["start"] as? JsonPrimitive)?.intOrNull ?: 0).coerceIn(0, inbox.pending.size)
                    val count = ((data["removedCount"] as? JsonPrimitive)?.intOrNull ?: 0).coerceIn(0, inbox.pending.size - index)
                    val inserted = (data["inserted"] as? JsonArray).orEmpty().mapNotNull { it as? JsonObject }
                    val removed = inbox.pending.subList(index, index + count).toList()
                    repeat(count) { inbox.pending.removeAt(index) }
                    inbox.pending.addAll(index, inserted)
                    if (((data["removedCount"] as? JsonPrimitive)?.intOrNull ?: 0) > 0 && data.text("outcome") != "canceled") {
                        inbox.ids = removed.map { it.text("id") }.toSet(); inbox.seq = seq
                        inbox.human = removed.any { (it["source"] as? JsonObject)?.text("kind") == "user" }
                    } else inbox.ids = inbox.ids - inserted.map { it.text("id") }.toSet()
                }
                "user/message" -> {
                    val id = data.text("id")
                    val idleSteer = step == 1L && start != null && nextStep.seq > start!! && nextTurn.seq < start!! && !nextStep.human && id in nextStep.ids
                    if (id.isNotBlank() && (id in nextTurn.ids || idleSteer)) add(seq)
                }
            }
        }
    }
}
