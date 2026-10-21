package dev.dsh.mobile.protocol

data class SessionNotificationCopy(val title: String, val body: String)

/** Short plain text only; never includes the device name or raw tool parameters. */
fun sessionNotificationCopy(event: SessionNotificationEvent): SessionNotificationCopy {
    fun clean(value: String, limit: Int): String {
        val plain = value.take(8192).replace(Regex("```[\\s\\S]*?(?:```|$)"), " ")
            .replace(Regex("!\\[[^]]*]\\([^)]*\\)"), " ")
            .replace(Regex("\\[([^]]+)]\\([^)]*\\)"), "$1")
            .replace(Regex("https?://\\S+"), "链接").replace(Regex("<[^>]*>"), "")
            .replace(Regex("[*_`~]"), "").replace(Regex("(^|\\n)\\s{0,3}(?:#{1,6}\\s+|>\\s*|[-+]\\s+)"), " ")
            .replace(Regex("[\\p{Cc}\\p{Cf}\\s]+"), " ").trim()
        val points = plain.codePoints().toArray()
        return if (points.size > limit) String(points, 0, limit - 1) + "…" else plain
    }
    val session = clean(event.sessionTitle, 60)
    val preview = clean(event.preview, if (event.confirmation) 80 else 120)
    fun body(label: String) = if (session.isBlank()) label else "$label · $session"
    return when (event.kind) {
        SessionNotificationKind.COMPLETED -> SessionNotificationCopy(session.ifBlank { "AI 已回复" },
            if (preview.isBlank()) "AI 已回复，点击查看" else "AI 已回复 · $preview")
        SessionNotificationKind.QUESTION -> SessionNotificationCopy(preview.ifBlank { "AI 等待你的回答" }, body("等待你的回答"))
        SessionNotificationKind.PERMISSION -> SessionNotificationCopy(preview.ifBlank { "AI 请求操作权限" }, body("需要你的授权"))
    }
}
