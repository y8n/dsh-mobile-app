package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*

data class FileChange(val seq: Long, val index: Int, val path: String, val oldText: String?, val newText: String?, val unavailable: String? = null, val pathKnown: Boolean = true) {
    val key get() = "$seq:$index"
}
data class DiffLine(val kind: Char, val text: String)

/** Only applied root filesystem tool results confer comparisons. Arguments
 * provide a display path for unavailable results, never a fabricated diff. */
fun sessionChanges(timeline: Timeline): List<FileChange> {
    val calls = mutableMapOf<String, JsonObject>(); val result = mutableListOf<FileChange>()
    for ((seq, event) in timeline.events.toSortedMap()) {
        val data = event["data"] as? JsonObject ?: continue
        if (event.text("type") == "tool/call") { if (data.text("callId").isNotBlank()) calls[data.text("callId")] = data; continue }
        if (event.text("type") != "tool/result") continue
        val message = data["message"] as? JsonObject ?: continue
        val source = message["source"] as? JsonObject ?: continue
        val call = calls[source.text("callId")] ?: continue
        if (source.text("kind") != "tool" || call.text("name") !in setOf("write", "edit", "str_replace_editor")) continue
        val args = runCatching { WireJson.parseToJsonElement(call.text("arguments")) as? JsonObject }.getOrNull()
        val rawPath = args?.text("file_path")?.ifBlank { args.text("path") }.orEmpty()
        val path = rawPath.ifBlank { "文件改动" }; val known = rawPath.isNotBlank()
        if (message["isError"]?.jsonPrimitive?.booleanOrNull == true) { result += FileChange(seq, 0, path, null, null, "工具执行失败，未确认改动。", known); continue }
        val diffs = (data["meta"] as? JsonObject)?.get("diffs") as? JsonArray
        if (diffs == null || diffs.size > 64) { result += FileChange(seq, 0, path, null, null, "缺少可靠的改动元数据，无法恢复比较。", known); continue }
        if (diffs.isEmpty()) { result += FileChange(seq, 0, path, null, null, "工具未报告可比较的改动。", known); continue }
        val parsed = diffs.mapIndexed { index, value ->
            val h = value as? JsonObject
            val old = h?.get("oldText"); val new = h?.get("newText") as? JsonPrimitive; val p = h?.get("path") as? JsonPrimitive
            if (h == null || p?.isString != true || p.content.isBlank() || new?.isString != true || (old != JsonNull && (old !is JsonPrimitive || !old.isString))) null
            else if ((old as? JsonPrimitive)?.content.orEmpty().length + new.content.length > 256 * 1024)
                FileChange(seq, index, p.content, null, null, "改动内容过大，无法预览；请在电脑端查看。")
            else FileChange(seq, index, p.content, (old as? JsonPrimitive)?.content, new.content)
        }
        if (parsed.any { it == null }) result += FileChange(seq, 0, path, null, null, "改动元数据格式无效，无法恢复比较。", known)
        else result += parsed.filterNotNull()
    }
    return result
}

/** Bounded LCS over result-time context, without reading current host files. */
fun diffLines(change: FileChange): List<DiffLine>? {
    if (change.unavailable != null || change.newText == null) return null
    val old = change.oldText?.split('\n').orEmpty(); val new = change.newText.split('\n')
    if (old.size > 3000 || new.size > 3000 || (old.size + 1L) * (new.size + 1L) > 2_000_000) return null
    val width = new.size + 1; val matrix = IntArray((old.size + 1) * width)
    for (i in old.indices.reversed()) for (j in new.indices.reversed()) matrix[i * width + j] =
        if (old[i] == new[j]) matrix[(i + 1) * width + j + 1] + 1 else maxOf(matrix[(i + 1) * width + j], matrix[i * width + j + 1])
    val lines = mutableListOf<DiffLine>(); var i = 0; var j = 0
    while (i < old.size || j < new.size) {
        when {
            i < old.size && j < new.size && old[i] == new[j] -> { lines += DiffLine(' ', old[i]); i++; j++ }
            i < old.size && (j == new.size || matrix[(i + 1) * width + j] >= matrix[i * width + j + 1]) -> { lines += DiffLine('-', old[i]); i++ }
            else -> { lines += DiffLine('+', new[j]); j++ }
        }
    }
    return lines
}
