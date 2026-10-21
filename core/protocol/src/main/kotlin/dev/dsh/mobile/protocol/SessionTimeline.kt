package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*

/** Durable seq space and cursorless attempt space are never conflated. */
data class Timeline(
    val sessionId: String? = null, val cursor: Long = -1, val throughSeq: Long = -1,
    val events: Map<Long, JsonObject> = emptyMap(), val projections: JsonObject = JsonObject(emptyMap()),
    val hasMore: Boolean = false, val attemptId: String? = null, val nextChunk: Long = 0,
    val blocks: Map<Long, JsonObject> = emptyMap(), val streamRevision: Long = -1,
    val waitingSettlement: Long? = null,
    val historyBefore: Long? = null,
) {
    val pageBefore get() = historyBefore ?: events.keys.minOrNull() ?: throughSeq + 1
    val hasHistoryGap get() = events.keys.minOrNull()?.let { pageBefore > it } == true
    val liveParts get() = JsonArray(blocks.toSortedMap().values.toList())
    val liveText get() = contentText(liveParts)
    val messages: List<MessageRow> get() {
        val surface = linkedMapOf<Long, MessageRow>()
        events.toSortedMap().forEach { (seq, event) ->
            val data = event["data"] as? JsonObject ?: JsonObject(emptyMap())
            val op = event["surfaceOp"] as? JsonObject
            if (op?.text("op") == "replace" && event.compactCheckpoint() == null) {
                val start = op.number("startSeq"); val end = op.number("endSeq")
                surface.keys.filter { it in start..end }.forEach(surface::remove)
            }
            when (event.text("type")) {
                "user/message" -> {
                    if (event.compactCheckpoint() != null) return@forEach
                    val source = data["source"] as? JsonObject
                    val kind = if (source?.text("kind").orEmpty() in listOf("", "user")) "user" else "context"
                    surface[seq] = MessageRow(seq, kind, contentText(data["content"]), data["content"] as? JsonArray ?: JsonArray(emptyList()), source?.text("rpcId")?.takeIf { it.isNotBlank() })
                }
                "assistant/message" -> {
                    val message = data["message"] as? JsonObject ?: JsonObject(emptyMap())
                    surface[seq] = MessageRow(seq, "assistant", contentText(message["content"]), message["content"] as? JsonArray ?: JsonArray(emptyList()))
                }
                "assistant/attempt" -> {
                    val parts = JsonArray(unpackAssistantStream(data["stream"] as? JsonArray).toSortedMap().values.toList())
                    if (parts.isNotEmpty()) surface[seq] = MessageRow(seq, "assistant", contentText(parts), parts)
                }
                "tool/call" -> surface[seq] = MessageRow(seq, "tool", data.text("name").ifBlank { "工具执行" }, detail = data.text("arguments"))
                "tool/result" -> {
                    val message = data["message"] as? JsonObject
                    val callId = message?.text("toolCallId")?.ifBlank { message.text("callId") }
                    val call = surface.values.lastOrNull { row -> row.kind == "tool" &&
                        (events[row.seq]?.get("data") as? JsonObject)?.text("callId") == callId && !callId.isNullOrBlank() }
                    val parts = message?.get("content") as? JsonArray ?: JsonArray(emptyList())
                    val result = contentText(parts)
                    if (call != null) surface[call.seq] = call.copy(parts = parts, detail = listOf(call.detail, result).filter(String::isNotBlank).joinToString("\n\n"))
                    else surface[seq] = MessageRow(seq, "tool", "工具执行结果", parts, detail = result)
                }
                else -> if (event["ignorable"]?.jsonPrimitive?.booleanOrNull != true && event.text("type").startsWith("unknown/"))
                    surface[seq] = MessageRow(seq, "unknown", "暂不支持的消息：${event.text("type")}")
            }
        }
        return (surface.values + compactionRows(events)).sortedBy { it.seq }
    }
    val running: Boolean get() = events.toSortedMap().values.lastOrNull { it.text("type") in listOf("turn/start", "turn/end") }?.text("type") == "turn/start"
}
data class MessageRow(val seq: Long, val kind: String, val text: String, val parts: JsonArray = JsonArray(emptyList()), val requestId: String? = null, val detail: String = "")
fun JsonObject.text(key: String): String = (get(key) as? JsonPrimitive)?.contentOrNull.orEmpty()
fun JsonObject.number(key: String): Long = (get(key) as? JsonPrimitive)?.longOrNull ?: throw GatewayFailure("invalid-response")
fun contentText(content: JsonElement?): String = (content as? JsonArray)?.mapNotNull { part ->
    (part as? JsonObject)?.takeIf { it.text("type") == "text" }?.text("text")
}?.joinToString("\n").orEmpty()
private fun records(value: JsonElement?): Map<Long, JsonObject> = wireValue {
    val result = linkedMapOf<Long, JsonObject>()
    (value as? JsonArray ?: throw GatewayFailure("invalid-response")).forEach { row ->
        val event = row.jsonObject.getValue("event").jsonObject; val seq = event.number("seq")
        if (seq < 0 || result.put(seq, event) != null) throw GatewayFailure("invalid-response")
    }
    result
}
fun reduceTimeline(current: Timeline, frame: JsonObject): Timeline = wireValue {
    when (frame.string("type")) {
        "snapshot" -> {
            val header = frame.getValue("header").jsonObject
            val id = header.string("id"); val cursor = frame.number("cursor")
            val loaded = records(frame["records"])
            val floor = loaded.keys.minOrNull() ?: 0
            val older = if (current.sessionId == id) current.events.filterKeys { it < floor } else emptyMap()
            val combined = older + loaded
            var before = floor
            while (before > 0 && before - 1 in combined) before--
            var result = Timeline(id, cursor, cursor, combined, frame["projections"]?.jsonObject ?: JsonObject(emptyMap()),
                frame.getValue("hasMore").jsonPrimitive.boolean && before > 0, historyBefore = before)
            val baseline = frame["assistantStream"] as? JsonObject
            val attempt = baseline?.get("activeAttempt") as? JsonObject
            if (attempt != null) {
                val blocks = unpackAssistantStream(attempt["stream"] as? JsonArray)
                result = result.copy(attemptId = attempt.string("attemptId"), nextChunk = attempt.number("nextIndex"), blocks = blocks, streamRevision = baseline.number("revision"))
            }
            result
        }
        "event" -> {
            if (current.sessionId == null) throw GatewayFailure("baseline-required")
            val event = frame.getValue("event").jsonObject; val seq = event.number("seq")
            if (seq <= current.cursor) current
            else {
                if (seq != current.cursor + 1) throw GatewayFailure("sequence-gap")
                val settled = current.waitingSettlement == seq
                current.copy(cursor = seq, events = current.events + (seq to event),
                    blocks = if (settled) emptyMap() else current.blocks, attemptId = if (settled) null else current.attemptId,
                    waitingSettlement = if (settled) null else current.waitingSettlement)
            }
        }
        "assistant-stream" -> {
            if (current.sessionId == null) throw GatewayFailure("baseline-required")
            val f = frame.getValue("frame").jsonObject; val revision = f.number("revision")
            if (revision <= current.streamRevision) current
            else when (f.string("type")) {
                "start" -> current.copy(attemptId = f.string("attemptId"), nextChunk = 0, blocks = emptyMap(), streamRevision = revision, waitingSettlement = null)
                "chunk" -> {
                    if (f.string("attemptId") != current.attemptId) throw GatewayFailure("sequence-gap")
                    if (f.number("index") != current.nextChunk) throw GatewayFailure("sequence-gap")
                    val blocks = current.blocks.toMutableMap(); appendChunk(blocks, f.getValue("chunk").jsonObject)
                    current.copy(blocks = blocks, nextChunk = current.nextChunk + 1, streamRevision = revision)
                }
                "end" -> {
                    if (f.string("attemptId") != current.attemptId || f.number("index") != current.nextChunk) throw GatewayFailure("sequence-gap")
                    val outcome = f.getValue("outcome").jsonObject
                    val seq = if (outcome.text("kind") == "committed") outcome.number("seq") else null
                    if (seq != null && seq !in current.events) current.copy(waitingSettlement = seq, streamRevision = revision)
                    else current.copy(attemptId = null, blocks = emptyMap(), waitingSettlement = null, streamRevision = revision)
                }
                else -> throw GatewayFailure("unsupported-frame")
            }
        }
        else -> throw GatewayFailure("unsupported-frame")
    }
}
private fun appendChunk(blocks: MutableMap<Long, JsonObject>, chunk: JsonObject) {
    when (chunk.text("type")) {
        "text-start" -> blocks.putIfAbsent(chunk.number("index"), buildJsonObject { put("type", "text"); put("text", "") })
        "block-start" -> {
            val type = chunk.text("blockType")
            if (type in setOf("text", "reasoning")) blocks.putIfAbsent(chunk.number("index"), buildJsonObject { put("type", type); put("text", "") })
        }
        "text-delta", "reasoning-delta" -> {
            val index = chunk.number("index")
            val type = if (chunk.text("type") == "reasoning-delta") "reasoning" else "text"
            blocks[index] = buildJsonObject { put("type", type); put("text", blocks[index]?.text("text").orEmpty() + chunk.text("text")) }
        }
        "block-end" -> blocks[chunk.number("index")] = chunk.getValue("block").jsonObject
    }
}
private fun unpackAssistantStream(stream: JsonArray?): MutableMap<Long, JsonObject> = mutableMapOf<Long, JsonObject>().apply {
    stream.orEmpty().forEach { item ->
        val packed = item.jsonObject
        when (packed.text("type")) {
            "text-chunks", "reasoning-chunks" -> {
                val index = packed.number("index")
                val kind = if (packed.text("type") == "text-chunks") "text" else "reasoning"
                this[index] = buildJsonObject { put("type", kind); put("text", this@apply[index]?.text("text").orEmpty() + packed.getValue("texts").jsonArray.joinToString("") { it.jsonPrimitive.content }) }
            }
            "chunk" -> appendChunk(this, packed.getValue("chunk").jsonObject)
        }
    }
}
fun mergeHistory(current: Timeline, page: JsonObject, requestedBefore: Long = current.pageBefore, requestedThrough: Long = current.throughSeq): Timeline = wireValue {
    // A new snapshot may have replaced the read's cut while RPC was in flight.
    if (requestedBefore != current.pageBefore || requestedThrough != current.throughSeq) return@wireValue current
    val older = records(page["records"])
    if (older.keys.any { it < 0 || it >= requestedBefore || it > requestedThrough }) throw GatewayFailure("invalid-page")
    val more = page.getValue("hasMore").jsonPrimitive.boolean
    if (older.isEmpty() && (more || requestedBefore > 0)) throw GatewayFailure("invalid-page")
    val combined = current.events + older
    var before = older.keys.minOrNull() ?: requestedBefore
    while (before > 0 && before - 1 in combined) before--
    current.copy(events = combined, hasMore = more && before > 0, historyBefore = before)
}
