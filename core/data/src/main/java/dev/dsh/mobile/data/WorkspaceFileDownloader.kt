package dev.dsh.mobile.data

import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import java.io.File
import java.security.MessageDigest
import java.util.Base64
import java.util.UUID

/** Version-checked, bounded read through the existing authenticated gateway. */
class WorkspaceFileDownloader(private val devices: DeviceRepository, private val cache: File) {
    suspend fun download(target: WorkspaceFileTarget, progress: (Long, Long) -> Unit = { _, _ -> }): DownloadedAttachment = withContext(Dispatchers.IO) {
        val connection = devices.selectedConnection()?.takeIf { it.first == target.deviceId } ?: throw GatewayFailure("device-changed")
        fun check() {
            if (devices.selectedConnection()?.let { it.first == target.deviceId && it.second === connection.second } != true) throw GatewayFailure("device-changed")
            if (!devices.state.value.connected) throw GatewayFailure("connection-required")
        }
        suspend fun rpc(method: String, args: JsonObject): JsonObject { check(); val result = connection.second.rpc(method, args).jsonObject; check(); return result }
        val address = buildJsonObject { put("workspaceFileScopeId", target.sessionId); put("path", target.path) }
        val before = rpc("workspaceFiles/stat", address)
        val version = before.getValue("version").takeUnless { it is JsonNull } ?: throw GatewayFailure("invalid-response")
        val path = before.string("absolutePath")
        val size = before.number("bytes")
        if (size !in 0..64L * 1024 * 1024) throw GatewayFailure("file-preview-limit")
        val key = MessageDigest.getInstance("SHA-256").digest("${target.deviceId}\u0000${target.sessionId}\u0000$path\u0000$version".toByteArray()).joinToString("") { "%02x".format(it) }
        val directory = File(cache, key).apply { mkdirs() }
        val name = path.replace('\\', '/').substringAfterLast('/').take(180).replace(Regex("[\\p{Cntrl}/\\\\]"), "_").takeUnless { it in setOf("", ".", "..") } ?: "file"
        val part = File(directory, "${UUID.randomUUID()}.part")
        try {
            part.outputStream().use { output ->
                var offset = 0L
                while (offset < size) {
                    ensureActive()
                    val count = minOf(256L * 1024, size - offset).toInt()
                    val range = rpc("workspaceFiles/readBytes", JsonObject(address + ("options" to buildJsonObject {
                        put("range", buildJsonObject { put("offset", offset); put("length", count) })
                    })))
                    if (range["version"] != version || range["absolutePath"] != before["absolutePath"] || range.number("bytes") != size || range.number("offset") != offset) throw GatewayFailure("file-changed")
                    val data = try { Base64.getDecoder().decode(range.string("data")) } catch (_: Exception) { throw GatewayFailure("invalid-response") }
                    if (data.size != count || range["eof"] != JsonPrimitive(offset + count == size)) throw GatewayFailure("invalid-response")
                    output.write(data); offset += data.size; progress(offset, size)
                }
            }
            val after = rpc("workspaceFiles/stat", address)
            if (after["version"] != version || after["absolutePath"] != before["absolutePath"] || after.number("bytes") != size) throw GatewayFailure("file-changed")
            ensureActive(); check()
            val file = File(directory, name)
            if (!part.renameTo(file)) throw GatewayFailure("attachment-cache-failed")
            // Same cache as attachments: clearing local files removes these too.
            var total = cache.walkTopDown().filter { it.isFile }.sumOf { it.length() }
            cache.listFiles().orEmpty().filter { it.isDirectory && it != directory && it.name.matches(Regex("[a-f0-9]{64}")) }.sortedBy { it.lastModified() }.forEach {
                if (total > 512L * 1024 * 1024) { val length = it.walkTopDown().filter(File::isFile).sumOf(File::length); if (it.deleteRecursively()) total -= length }
            }
            DownloadedAttachment(file, buildJsonObject { put("name", name); put("absolutePath", path); put("bytes", size); put("version", version) })
        } finally { part.delete() }
    }
}
