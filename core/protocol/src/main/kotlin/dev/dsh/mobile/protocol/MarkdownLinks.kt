package dev.dsh.mobile.protocol

import java.net.URI
import java.net.URLDecoder

sealed interface MarkdownLink {
    data class Web(val url: String) : MarkdownLink
    data class File(val path: String) : MarkdownLink
    data class Anchor(val name: String) : MarkdownLink
    data object Unsupported : MarkdownLink
}

/** Interpret on click; never rewrite the Markdown stored on the computer. */
fun markdownLink(destination: String, baseFile: String? = null, sessionId: String? = null): MarkdownLink {
    val input = destination.trim()
    val raw = if (Regex("^https?://", RegexOption.IGNORE_CASE).containsMatchIn(input)) input else input.replace(Regex(":\\d+(?::\\d+)?(?=#|$)"), "")
    if (raw.isEmpty() || raw.any { it.isISOControl() }) return MarkdownLink.Unsupported
    if (Regex("^https?://", RegexOption.IGNORE_CASE).containsMatchIn(raw)) return MarkdownLink.Web(raw)
    if (raw.startsWith('#')) return MarkdownLink.Anchor(raw.drop(1))
    fun decode(value: String) = URLDecoder.decode(value.replace("+", "%2B"), "UTF-8")
    return try {
        val path = when {
            raw.startsWith("file:", true) -> {
                val uri = URI(raw)
                if (!uri.rawAuthority.isNullOrEmpty() && uri.rawAuthority != "localhost") return MarkdownLink.Unsupported
                decode(uri.rawPath ?: return MarkdownLink.Unsupported).let { if (Regex("^/[A-Za-z]:/").containsMatchIn(it)) it.drop(1) else it }
            }
            raw.startsWith("dsh-resource://file/session/") -> {
                val resource = raw.removePrefix("dsh-resource://file/session/")
                if (decode(resource.substringBefore('/')) != sessionId || '/' !in resource) return MarkdownLink.Unsupported
                "/" + decode(resource.substringAfter('/').substringBefore('#'))
            }
            raw.startsWith("dsh-resource://file/absolute/") -> "/" + decode(raw.removePrefix("dsh-resource://file/absolute/").substringBefore('#'))
            Regex("^[A-Za-z]:[/\\\\]").containsMatchIn(raw) -> decode(raw.substringBefore('#'))
            Regex("^[A-Za-z][A-Za-z0-9+.-]*:").containsMatchIn(raw) || raw.startsWith("//") -> return MarkdownLink.Unsupported
            else -> decode(raw.substringBefore('#').substringBefore('?'))
        }.replace('\\', '/').let { if (Regex("^/[A-Za-z]:/").containsMatchIn(it)) it.drop(1) else it }
        if (path.isBlank() || path.any { it.isISOControl() } || path.startsWith("//") || path.startsWith("~/")) return MarkdownLink.Unsupported
        val absolute = path.startsWith('/') || Regex("^[A-Za-z]:/").containsMatchIn(path)
        val joined = if (!absolute && baseFile != null) baseFile.replace('\\', '/').substringBeforeLast('/', "").let { if (it.isEmpty()) (if (baseFile.startsWith('/')) "/$path" else path) else "$it/$path" } else path
        MarkdownLink.File(joined)
    } catch (_: Exception) { MarkdownLink.Unsupported }
}
