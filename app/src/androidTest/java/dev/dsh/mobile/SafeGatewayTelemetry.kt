package dev.dsh.mobile

import android.content.Context
import dev.dsh.mobile.protocol.GatewayClient
import kotlinx.serialization.json.*
import okhttp3.*
import java.io.File
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger

/** Test-only timing, endpoint categories and failure classes. No bodies, URLs or credentials. */
internal class SafeGatewayTelemetry(private val context: Context) {
    private val events = CopyOnWriteArrayList<JsonObject>()
    private val calls = ConcurrentHashMap<Call, Int>()
    private val next = AtomicInteger()
    fun attach(gateway: GatewayClient, scope: String) {
        val field = GatewayClient::class.java.getDeclaredField("client").apply { isAccessible = true }
        val client = field.get(gateway) as OkHttpClient
        fun record(call: Call, stage: String, extra: JsonObject = JsonObject(emptyMap())) {
            if (events.size >= 500) return
            val path = call.request().url.encodedPath
            val category = when {
                path == "/api/remote.mux" -> "mux"
                path == "/api/session/list" -> "session-list"
                path == "/api/session/prompt" -> "prompt"
                path.startsWith("/api/workspace/") -> "workspace-rpc"
                path.startsWith("/mobile-access/auth/") -> "native-auth"
                else -> "other-rpc"
            }
            events += buildJsonObject {
                put("scope", scope); put("call", calls.computeIfAbsent(call) { next.incrementAndGet() })
                put("atEpochMs", System.currentTimeMillis()); put("endpoint", category); put("stage", stage)
                put("callIsCanceled", call.isCanceled()); put("cancellationSource", "not-observed")
                extra.forEach { (key, value) -> put(key, value) }
            }
        }
        field.set(gateway, client.newBuilder().eventListener(object : EventListener() {
            override fun callStart(call: Call) = record(call, "start")
            override fun requestBodyEnd(call: Call, byteCount: Long) = record(call, "request-body-end")
            override fun responseHeadersEnd(call: Call, response: Response) = record(call, "headers", buildJsonObject {
                put("status", response.code); put("protocol", response.protocol.toString())
            })
            override fun responseBodyEnd(call: Call, byteCount: Long) = record(call, "body-end", buildJsonObject { put("bytes", byteCount) })
            override fun callFailed(call: Call, ioe: IOException) = record(call, "failed", buildJsonObject {
                val message = ioe.message.orEmpty().lowercase()
                put("exceptionType", ioe.javaClass.simpleName)
                put("category", when {
                    "timeout" in message || "timed out" in message -> "timeout"
                    "protocol_error" in message -> "http2-protocol-error"
                    "refused_stream" in message -> "http2-refused-stream"
                    "stream was reset: cancel" in message -> "http2-stream-cancel"
                    "unexpected end of stream" in message -> "unexpected-eof"
                    "connection reset" in message -> "connection-reset"
                    "cancel" in message -> "cancelled"
                    else -> "other-io"
                })
            })
        }).build())
    }
    fun save(filename: String = "m3-transport-telemetry.json") = File(context.filesDir, filename).writeText(buildJsonObject {
        put("events", JsonArray(events)); put("boundedAt500", events.size >= 500)
        put("scope", "Observed SDK and selected native GatewayClient only. Timing does not prove server cause; cancellation is explicitly distinguished.")
    }.toString())
}
