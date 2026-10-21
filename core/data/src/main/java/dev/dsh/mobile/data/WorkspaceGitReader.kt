package dev.dsh.mobile.data

import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.*

/** Reads only Git metadata through the official session-scoped, read-only file API. */
class WorkspaceGitReader(private val read: suspend (String) -> String?) {
    suspend fun branch(cwd: String): String? {
        var directory = cwd.replace('\\', '/').trimEnd('/')
        if (!directory.startsWith('/') && !Regex("^[A-Za-z]:/").containsMatchIn(directory)) return null
        repeat(64) {
            val dotGit = "$directory/.git"
            var head = read("$dotGit/HEAD")
            if (head == null) {
                val pointer = read(dotGit)
                if (pointer != null) {
                    val target = pointer.trim().takeIf { it.startsWith("gitdir: ") }?.removePrefix("gitdir: ")?.trim()?.takeIf { it.isNotEmpty() } ?: return null
                    val gitDir = if (target.startsWith('/') || Regex("^[A-Za-z]:[/\\\\]").containsMatchIn(target)) target else "$directory/$target"
                    head = read("$gitDir/HEAD") ?: return null
                }
            }
            if (head != null) return parseHead(head)
            val parent = directory.substringBeforeLast('/', "")
            if (parent == directory || directory.isEmpty() || Regex("^[A-Za-z]:$").matches(directory)) return null
            directory = parent
        }
        return null
    }
    companion object {
        fun parseHead(text: String): String? {
            val value = text.trim()
            if (Regex("^[0-9a-fA-F]{40}([0-9a-fA-F]{24})?$").matches(value)) return "分离 HEAD · ${value.take(7)}"
            return value.takeIf { it.startsWith("ref: refs/heads/") }?.removePrefix("ref: refs/heads/")
                ?.takeIf { it.isNotBlank() && it.length <= 1024 && it.none { ch -> ch.isWhitespace() || ch.isISOControl() } }
        }
        fun forSession(gateway: DeviceGateway, session: String) = WorkspaceGitReader { path ->
            try {
                val page = gateway.rpc("workspaceFiles/read", buildJsonObject {
                    put("workspaceFileScopeId", session); put("path", path)
                    put("range", buildJsonObject { put("offset", 1); put("limit", 2) })
                }).jsonObject
                val text = page["text"] as? JsonPrimitive
                if (page["eof"] != JsonPrimitive(true) || text?.isString != true || text.content.length > 4096) null else text.content
            } catch (cancel: CancellationException) { throw cancel }
            catch (error: GatewayFailure) {
                if (error.code in setOf("workspace-file/not-found", "workspace-file/not-regular-file", "workspace-file/not-text")) null else throw error
            }
        }
    }
}
