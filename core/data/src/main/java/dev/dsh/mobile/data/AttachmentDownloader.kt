package dev.dsh.mobile.data

import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import java.io.File
import java.security.MessageDigest
import java.util.Base64

data class AttachmentTarget(val deviceId: String, val sessionId: String, val id: String, val kind: String, val name: String = "")
data class DownloadedAttachment(val file: File, val metadata: JsonObject)

/** Cache keys include device, session and backend version. No gateway cookies
 * or backend URLs are handed to image loaders, players or external apps. */
class AttachmentDownloader(private val devices: DeviceRepository, private val cache: File) {
    private fun client(target: AttachmentTarget) = devices.selectedConnection()?.takeIf { it.first == target.deviceId }?.second ?: throw GatewayFailure("device-changed")
    private fun selector(target: AttachmentTarget) = buildJsonObject {
        put("sessionId", target.sessionId); put("attachmentId", target.id); put("kind", target.kind)
        if (target.name.isNotBlank()) put("name", target.name)
    }
    suspend fun download(target: AttachmentTarget, progress: (Long, Long) -> Unit = { _, _ -> }): DownloadedAttachment = withContext(Dispatchers.IO) {
        val fields = selector(target)
        val metadata = client(target).rpc("mobileAttachments/stat", buildJsonObject { put("request", fields) }).jsonObject
        val size = metadata.number("bytes"); val version = metadata.string("version")
        if (metadata.text("attachmentId") != target.id || metadata.text("kind") != target.kind || size !in 0..512L * 1024 * 1024 || !version.matches(Regex("[a-f0-9]{64}"))) throw GatewayFailure("invalid-response")
        val expected = target.id.removePrefix("sha256:")
        if (!expected.matches(Regex("[a-f0-9]{64}"))) throw GatewayFailure("invalid-response")
        val key = sha((target.deviceId + "\u0000" + target.sessionId + "\u0000" + target.id + "\u0000" + version).toByteArray())
        val folder = File(cache, key).apply { mkdirs() }
        val name = metadata.text("name").substringAfterLast('/').substringAfterLast('\\').filter { it >= ' ' && it != '\u007f' }.take(120).takeUnless { it.isBlank() || it == "." || it == ".." } ?: "attachment"
        val file = File(folder, name); val part = File(folder, ".${java.util.UUID.randomUUID()}.part")
        if (file.isFile && file.length() == size && digest(file) == expected) { client(target); return@withContext DownloadedAttachment(file, metadata) }
        if (cache.usableSpace < size + 8L * 1024 * 1024) throw GatewayFailure("attachment-cache-full")
        trim(folder, size)
        try {
            val hash = MessageDigest.getInstance("SHA-256"); var offset = 0L
            part.outputStream().use { output -> while (offset < size) {
                ensureActive(); val length = minOf(256L * 1024, size - offset).toInt()
                val result = client(target).rpc("mobileAttachments/readRange", buildJsonObject { put("request", JsonObject(fields + mapOf("version" to JsonPrimitive(version), "offset" to JsonPrimitive(offset), "length" to JsonPrimitive(length)))) }).jsonObject
                if (result.text("version") != version || result.number("offset") != offset || result.number("bytes") != length.toLong()) throw GatewayFailure("invalid-response")
                val bytes = try { Base64.getDecoder().decode(result.string("data")) } catch (_: Exception) { throw GatewayFailure("invalid-response") }
                if (bytes.size != length) throw GatewayFailure("invalid-response")
                output.write(bytes); hash.update(bytes); offset += bytes.size; progress(offset, size)
            } }
            ensureActive(); client(target)
            if (hex(hash.digest()) != expected) throw GatewayFailure("attachment-integrity")
            if (file.exists()) file.delete()
            if (!part.renameTo(file)) throw GatewayFailure("attachment-cache-failed")
            DownloadedAttachment(file, metadata)
        } finally { part.delete() }
    }
    private fun sha(bytes: ByteArray) = hex(MessageDigest.getInstance("SHA-256").digest(bytes))
    private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it) }
    private fun digest(file: File): String { val hash = MessageDigest.getInstance("SHA-256"); file.inputStream().use { input -> val buffer = ByteArray(65536); while (true) { val n = input.read(buffer); if (n < 0) break; hash.update(buffer, 0, n) } }; return hex(hash.digest()) }
    private fun trim(current: File, incoming: Long) {
        val folders = cache.listFiles().orEmpty().filter { it.isDirectory && !java.nio.file.Files.isSymbolicLink(it.toPath()) && it.name.matches(Regex("[a-f0-9]{64}")) }
        val sizes = folders.associateWith { folder -> folder.listFiles().orEmpty().filter { it.isFile && !java.nio.file.Files.isSymbolicLink(it.toPath()) }.sumOf(File::length) }
        var total = sizes.values.sum()
        for (folder in folders.sortedBy(File::lastModified)) {
            if (total + incoming <= 512L * 1024 * 1024) break
            if (folder == current) continue
            folder.listFiles().orEmpty().filter { !it.isDirectory }.forEach(File::delete)
            if (folder.delete()) total -= sizes[folder] ?: 0
        }
    }
}
