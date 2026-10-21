package dev.dsh.mobile.protocol

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.channels.trySendBlocking
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream
import java.io.ByteArrayInputStream
import java.io.IOException
import java.security.KeyStore
import java.security.SecureRandom
import java.security.MessageDigest
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.util.Base64
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.net.ssl.*
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

private data class WireResponse(val status: Int, val bytes: ByteArray, val contentType: String?)
private fun failure(error: Throwable) = GatewayFailure(if (error is SSLPeerUnverifiedException ||
    generateSequence(error) { it.cause }.take(8).any { it is java.security.cert.CertificateException || it is java.security.cert.CertPathValidatorException }) "certificate-failed" else "network-unavailable")

/** Cancellable, bounded response reads. No request/response bodies are logged. */
private suspend fun OkHttpClient.exchange(request: Request, limit: Int = 2 * 1024 * 1024): WireResponse = suspendCancellableCoroutine { continuation ->
    val call = newCall(request)
    continuation.invokeOnCancellation { call.cancel() }
    call.enqueue(object : Callback {
        override fun onFailure(call: Call, e: IOException) { if (continuation.isActive) continuation.resumeWithException(failure(e)) }
        override fun onResponse(call: Call, response: Response) {
            response.use {
                try {
                    val output = ByteArrayOutputStream()
                    val buffer = ByteArray(8192)
                    response.body?.byteStream()?.use { input ->
                        while (true) {
                            val count = input.read(buffer); if (count < 0) break
                            if (output.size() + count > limit) throw GatewayFailure("response-too-large")
                            output.write(buffer, 0, count)
                        }
                    }
                    if (continuation.isActive) continuation.resume(WireResponse(response.code, output.toByteArray(), response.header("Content-Type")))
                } catch (error: Exception) { if (continuation.isActive) continuation.resumeWithException(if (error is GatewayFailure) error else failure(error)) }
            }
        }
    })
}

fun validateCa(bytes: ByteArray, instanceId: String): X509Certificate {
    try {
        val certificate = CertificateFactory.getInstance("X.509").generateCertificate(ByteArrayInputStream(bytes)) as X509Certificate
        certificate.checkValidity(); certificate.verify(certificate.publicKey)
        if (certificate.basicConstraints < 0) throw GatewayFailure("certificate-failed")
        val hash = MessageDigest.getInstance("SHA-256").digest(certificate.encoded).joinToString("") { "%02x".format(it) }
        if (hash != instanceId) throw GatewayFailure("instance-changed")
        return certificate
    } catch (error: GatewayFailure) { throw error }
    catch (_: Exception) { throw GatewayFailure("certificate-failed") }
}
private fun httpClient(ca: X509Certificate? = null): OkHttpClient {
    val builder = OkHttpClient.Builder().connectTimeout(8, TimeUnit.SECONDS).readTimeout(15, TimeUnit.SECONDS)
        .callTimeout(25, TimeUnit.SECONDS).eventListenerFactory { Diagnostics.listener() }.pingInterval(20, TimeUnit.SECONDS).followRedirects(false).followSslRedirects(false)
    if (ca != null) {
        val store = KeyStore.getInstance(KeyStore.getDefaultType()).apply { load(null); setCertificateEntry("paired-ca", ca) }
        val factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm()).apply { init(store) }
        val manager = factory.trustManagers.filterIsInstance<X509TrustManager>().single()
        val ssl = SSLContext.getInstance("TLS").apply { init(null, arrayOf(manager), SecureRandom()) }
        builder.sslSocketFactory(ssl.socketFactory, manager)
    }
    return builder.build()
}
private fun oneShot(body: RequestBody): RequestBody = object : RequestBody() {
    override fun contentType() = body.contentType()
    override fun contentLength() = body.contentLength()
    override fun isOneShot() = true
    override fun writeTo(sink: okio.BufferedSink) = body.writeTo(sink)
}
private fun request(origin: String, path: String, body: JsonObject? = null): Request.Builder = Request.Builder()
    .url(origin + path).header("Origin", origin).header("User-Agent", "DSHMobileNative/0.2")
    .apply { if (body != null) post(oneShot(body.toString().toRequestBody("application/json".toMediaType()))) }
private fun WireResponse.objectValue(): JsonObject {
    if (status != 200 && status != 201) throw GatewayFailure(when (status) { 401 -> "device-revoked"; 403 -> "access-denied"; 429 -> "rate-limited"; else -> "http-failure" })
    return try { if (contentType?.substringBefore(';')?.trim()?.equals("multipart/form-data", true) == true) workspaceBinaryResponse(bytes, contentType) else WireJson.parseToJsonElement(bytes.decodeToString()).jsonObject } catch (_: Exception) { throw GatewayFailure("invalid-response") }
}

/** Each instance has one exact origin, CA and independent ephemeral session credentials. */
interface DeviceGateway {
    suspend fun probe()
    suspend fun rpc(method: String, args: JsonObject = JsonObject(emptyMap()), mutation: Boolean = false): JsonElement
    fun followWorkspaces(): Flow<JsonObject>
    fun followTaskNotifications(): Flow<TaskNotificationSignal> = throw GatewayFailure("unsupported-gateway")
    fun follow(endpoint: String, args: JsonObject): Flow<JsonObject> = throw GatewayFailure("unsupported-gateway")
    suspend fun upload(sessionId: String, name: String, bytes: ByteArray): JsonObject = throw GatewayFailure("unsupported-gateway")
    suspend fun uploadStream(sessionId: String, name: String, length: Long, open: () -> java.io.InputStream): JsonObject = throw GatewayFailure("unsupported-gateway")
    suspend fun readChanges(sessionId: String, seq: Long, index: Int? = null): JsonObject = throw GatewayFailure("unsupported-gateway")
    fun close()
}
class GatewayClient(val credential: DeviceCredential, private val onTransportFailure: ((Throwable) -> Unit)? = null) : DeviceGateway {
    private val client = httpClient(credential.caDer?.let { validateCa(Base64.getDecoder().decode(it), credential.instanceId) })
    private val renewal = Mutex()
    private val readFallback by lazy { client.newBuilder().protocols(listOf(Protocol.HTTP_1_1)).build() }
    @Volatile private var preferFallbackReads = false
    @Volatile private var session: NativeSession? = null
    private suspend fun auth(): NativeSession = renewal.withLock {
        session?.takeIf { it.expiresAt > System.currentTimeMillis() + 15_000 }?.let { return@withLock it }
        val value = client.exchange(request(credential.origin, "/mobile-access/auth/native-renew", buildJsonObject { put("deviceToken", credential.deviceToken) }).build()).objectValue()
        if (value.string("instanceId") != credential.instanceId || value.string("deviceId") != credential.deviceId) throw GatewayFailure("instance-changed")
        NativeSession(value.string("sessionToken"), value.string("csrfToken"), wireValue { value.getValue("sessionExpiresAt").jsonPrimitive.long }).also { session = it }
    }
    override suspend fun probe() {
        val value = client.exchange(request(credential.origin, "/mobile-access/auth/native-probe", buildJsonObject { put("deviceToken", credential.deviceToken) }).build()).objectValue()
        if (value.string("instanceId") != credential.instanceId || value.string("deviceId") != credential.deviceId) throw GatewayFailure("instance-changed")
    }
    override suspend fun readChanges(sessionId: String, seq: Long, index: Int?): JsonObject {
        require(seq >= 0 && (index == null || index >= 0))
        val auth = auth()
        val path = if (index == null) "/api/changes.summary" else "/api/changes.diff"
        val url = (credential.origin + path).toHttpUrl().newBuilder()
            .addQueryParameter("sessionId", sessionId).addQueryParameter("seq", seq.toString())
            .apply { index?.let { addQueryParameter("index", it.toString()) } }.build()
        val response = client.exchange(request(credential.origin, path).url(url)
            .header("Cookie", "dsh_ma_session=${auth.sessionToken}").build())
        if (response.status == 401) { session = null; throw GatewayFailure("session-expired") }
        if (response.status !in 200..299) throw GatewayFailure("changes-unavailable")
        return response.objectValue()
    }
    override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
        val auth = auth(); val id = UUID.randomUUID().toString()
        val body = buildJsonObject { put("type", "client-request"); put("rpcId", id); put("method", method); put("payload", buildJsonObject { put("args", args) }) }
        val rpcRequest = request(credential.origin, "/api/$method", body)
            .header("Cookie", "dsh_ma_session=${auth.sessionToken}").header("x-dsh-mobile-csrf", auth.csrfToken).build()
        // Compact can await a complete model summarization. It is never replayed on timeout.
        val transport = if (method == "commands/execute" && args.text("line").trim() == "/compact")
            client.newBuilder().readTimeout(180, TimeUnit.SECONDS).callTimeout(180, TimeUnit.SECONDS).build()
        else if (!mutation && preferFallbackReads) readFallback else client
        val response = try { transport.exchange(rpcRequest) }
        catch (error: GatewayFailure) {
            if (mutation && error.code in setOf("network-unavailable", "response-too-large")) throw GatewayFailure("result-unknown")
            if (!mutation && !preferFallbackReads && error.code == "network-unavailable") {
                // Retry only a read, once, through the same trusted origin and
                // credentials. Never replay a mutation or relax TLS validation.
                readFallback.exchange(rpcRequest).also { preferFallbackReads = true }
            } else throw error
        }
        if (response.status == 401) { session = null; throw GatewayFailure("session-expired") }
        // An unreadable or mismatched response cannot prove that a submitted
        // write was rejected. Keep this distinct from a valid remote rejection.
        val (result, ok) = try {
            val value = response.objectValue()
            if (value.string("type") != "server-response" || value.string("rpcId") != id) throw GatewayFailure("invalid-response")
            val result = wireValue { value.getValue("result").jsonObject }
            result to wireValue { result.getValue("ok").jsonPrimitive.boolean }
        } catch (error: GatewayFailure) {
            if (mutation && (error.code == "invalid-response" || response.status == 408 || response.status in 500..599)) throw GatewayFailure("result-unknown")
            throw error
        }
        if (!ok) {
            val error = result["error"] as? JsonObject
            throw GatewayFailure(error?.text("code")?.ifBlank { "remote-failure" } ?: "remote-failure", error?.text("message"), error?.get("details") as? JsonObject)
        }
        return result["value"] ?: JsonNull
    }
    /** Reuse dsh-mobile SSE, with the same paired trust and renewable session cookie as RPC.
     * A 45s idle timeout detects lost connections; gateway heartbeats arrive every 15s.
     * The caller reconnects and runs durable catch-up separately. */
    override fun followTaskNotifications(): Flow<TaskNotificationSignal> = callbackFlow {
        val auth = auth()
        val streamClient = readFallback.newBuilder().callTimeout(0, TimeUnit.MILLISECONDS)
            .readTimeout(45, TimeUnit.SECONDS).build()
        val call = streamClient.newCall(request(credential.origin, "/mobile-access/extensions/events")
            .header("Cookie", "dsh_ma_session=${auth.sessionToken}")
            .header("Accept", "text/event-stream").build())
        val reader = launch(Dispatchers.IO) {
            try {
                call.execute().use { response ->
                    if (response.code == 401) { session = null; throw GatewayFailure("session-expired") }
                    if (response.code != 200) throw GatewayFailure(if (response.code == 403) "access-denied" else "http-failure")
                    if (response.header("Content-Type")?.substringBefore(';')?.trim() != "text/event-stream") throw GatewayFailure("invalid-response")
                    send(TaskNotificationSignal.Ready)
                    val source = response.body?.source() ?: throw GatewayFailure("invalid-response")
                    val decoder = TaskNotificationDecoder()
                    while (!source.exhausted()) {
                        // readUtf8LineStrict bounds allocation even if a broken server never sends a newline.
                        val line = try { source.readUtf8LineStrict(65_536) }
                            catch (_: java.io.EOFException) { throw GatewayFailure("invalid-response") }
                        if (line == ": heartbeat") send(TaskNotificationSignal.Heartbeat)
                        decoder.line(line)?.let { send(TaskNotificationSignal.Completed(it)) }
                    }
                    throw GatewayFailure("stream-ended")
                }
            } catch (cancel: kotlinx.coroutines.CancellationException) { throw cancel }
            catch (error: Exception) { close(if (error is GatewayFailure) error else failure(error)) }
        }
        awaitClose { call.cancel(); reader.cancel() }
    }
    override fun followWorkspaces(): Flow<JsonObject> = follow("workspace/follow", JsonObject(emptyMap()))
    private val muxLock = Any()
    private var mux: Multiplex? = null
    private data class StreamSink(val args: JsonObject, val endpoint: String, val deliver: (JsonObject) -> Unit, val end: (GatewayFailure) -> Unit)

    /** One authenticated socket per device, matching DSH's remote.mux transport.
     * Workspace, transcript, control and interaction subscriptions share its handshake. */
    private inner class Multiplex(val auth: NativeSession) : WebSocketListener() {
        val trace = UUID.randomUUID().toString()
        val streams = linkedMapOf<String, StreamSink>()
        var ready = false
        var failed = false
        lateinit var socket: WebSocket
        fun open(id: String, sink: StreamSink) {
            streams[id] = sink
            if (ready) sendOpen(id, sink)
        }
        private fun sendOpen(id: String, sink: StreamSink) {
            socket.send(buildJsonObject {
                put("type", "open"); put("streamId", id); put("endpoint", sink.endpoint)
                put("payload", buildJsonObject { put("args", sink.args) })
            }.toString())
        }
        override fun onOpen(webSocket: WebSocket, response: Response) = synchronized(muxLock) {
            if (failed) { webSocket.cancel(); return@synchronized }
            socket = webSocket; ready = true
            Diagnostics.emit("socket.open", trace, "mux", status = response.code)
            streams.forEach { (id, sink) -> sendOpen(id, sink) }
        }
        override fun onMessage(webSocket: WebSocket, text: String) {
            try {
                if (text.length > 2 * 1024 * 1024) {
                    val id = Regex("\"streamId\"\\s*:\\s*\"([A-Za-z0-9-]{1,64})\"").find(text.take(256))?.groupValues?.get(1)
                    val sink = synchronized(muxLock) { streams[id] }
                    if (sink != null) { sink.end(GatewayFailure("response-too-large")); return }
                    throw GatewayFailure("response-too-large")
                }
                val frame = WireJson.parseToJsonElement(text).jsonObject
                // A late frame for a canceled stream has no current owner.
                val id = frame.string("streamId")
                val sink = synchronized(muxLock) { streams[id] } ?: return
                when (frame.string("type")) {
                    "item" -> sink.deliver(frame.getValue("value").jsonObject)
                    "error" -> sink.end(GatewayFailure(frame.getValue("error").jsonObject.string("code")))
                    "end" -> sink.end(GatewayFailure("stream-ended"))
                    else -> sink.end(GatewayFailure("invalid-response"))
                }
            } catch (error: Exception) { fail(error as? GatewayFailure ?: GatewayFailure("invalid-response")) }
        }
        fun fail(error: GatewayFailure) {
            val sinks = synchronized(muxLock) {
                if (failed) return
                failed = true; ready = false
                if (mux === this) mux = null
                streams.values.toList().also { streams.clear() }
            }
            sinks.forEach { it.end(error) }
            if (::socket.isInitialized) socket.cancel()
        }
        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            if (failed) return // A retired socket cannot invalidate the next generation.
            Diagnostics.emit("socket.failure", trace, "mux", code = Diagnostics.code(t))
            runCatching { onTransportFailure?.invoke(t) }
            if (response?.code == 401) session = null
            fail(when (response?.code) { 401 -> GatewayFailure("session-expired"); 403 -> GatewayFailure("access-denied"); 429 -> GatewayFailure("rate-limited"); else -> failure(t) })
        }
        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) { webSocket.close(code, "") }
        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) { Diagnostics.emit("socket.closed", trace, "mux"); fail(GatewayFailure("stream-ended")) }
    }
    override fun follow(endpoint: String, args: JsonObject): Flow<JsonObject> = callbackFlow {
        val streamId = UUID.randomUUID().toString()
        val started = System.nanoTime()
        Diagnostics.emit("stream.start", streamId, Diagnostics.endpoint(endpoint))
        val auth = auth()
        var first = true
        val firstFrameTimeout = launch { delay(20_000); close(GatewayFailure("stream-timeout")) }
        val owner = synchronized(muxLock) {
            val owner = mux?.takeUnless { it.failed } ?: Multiplex(auth).also { next ->
                mux = next
                next.socket = client.newWebSocket(request(credential.origin, "/api/remote.mux")
                    .header("Cookie", "dsh_ma_session=${auth.sessionToken}").build(), next)
            }
            owner.open(streamId, StreamSink(args, endpoint, { value ->
                firstFrameTimeout.cancel()
                if (first) { first = false; Diagnostics.emit("stream.ready", streamId, Diagnostics.endpoint(endpoint), (System.nanoTime() - started) / 1_000_000) }
                // Bounded backpressure, without dropping ordered events during replay.
                trySendBlocking(value)
            }, { error -> Diagnostics.emit("stream.failure", streamId, Diagnostics.endpoint(endpoint), code = error.code); close(error) }))
            owner
        }
        awaitClose {
            Diagnostics.emit("stream.cancel", streamId, Diagnostics.endpoint(endpoint))
            firstFrameTimeout.cancel()
            synchronized(muxLock) {
                owner.streams.remove(streamId)
                if (!owner.failed) {
                    owner.socket.send(buildJsonObject { put("type", "cancel"); put("streamId", streamId) }.toString())
                    if (owner.streams.isEmpty()) {
                        owner.failed = true; owner.ready = false
                        if (mux === owner) mux = null
                        owner.socket.close(1000, "")
                    }
                }
            }
        }
    }
    override suspend fun upload(sessionId: String, name: String, bytes: ByteArray): JsonObject =
        uploadStream(sessionId, name, bytes.size.toLong()) { ByteArrayInputStream(bytes) }
    override suspend fun uploadStream(sessionId: String, name: String, length: Long, open: () -> java.io.InputStream): JsonObject {
        val body = object : RequestBody() {
            override fun contentType() = "application/octet-stream".toMediaType()
            override fun contentLength() = length.takeIf { it >= 0 } ?: -1L
            override fun writeTo(sink: okio.BufferedSink) {
                open().use { input ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        sink.write(buffer, 0, count)
                    }
                }
            }
        }
        val auth = auth()
        val url = credential.origin.toHttpUrl().newBuilder().addPathSegments("api/session/uploadFileBinary")
            .addQueryParameter("sessionId", sessionId).addQueryParameter("name", name).build()
        val response = try { client.exchange(request(credential.origin, "/api/session/uploadFileBinary").url(url)
            .header("Cookie", "dsh_ma_session=${auth.sessionToken}").header("x-dsh-mobile-csrf", auth.csrfToken)
            .post(oneShot(body)).build()) }
        catch (error: GatewayFailure) { if (error.code in setOf("network-unavailable", "response-too-large")) throw GatewayFailure("result-unknown") else throw error }
        if (response.status == 401) { session = null; throw GatewayFailure("session-expired") }
        if (response.status == 413) throw GatewayFailure("attachment-size")
        val (value, ok) = try {
            val value = response.objectValue()
            value to wireValue { value.getValue("ok").jsonPrimitive.boolean }
        } catch (error: GatewayFailure) {
            if (error.code == "invalid-response" || response.status == 408 || response.status in 500..599) throw GatewayFailure("result-unknown")
            throw error
        }
        if (!ok) {
            val error = value["error"] as? JsonObject
            throw GatewayFailure(error?.text("code")?.ifBlank { "remote-failure" } ?: "remote-failure")
        }
        return try { wireValue {
            value.getValue("value").jsonObject.also { receipt ->
                val id = receipt["receiptId"] as? JsonPrimitive
                if (id == null || !id.isString || id.content.isBlank()) throw GatewayFailure("invalid-response")
            }
        } }
        catch (error: GatewayFailure) { if (error.code == "invalid-response") throw GatewayFailure("result-unknown") else throw error }
    }
    override fun close() { synchronized(muxLock) { mux }?.fail(GatewayFailure("stream-ended")); client.dispatcher.cancelAll(); client.connectionPool.evictAll() }

    companion object {
        suspend fun pair(input: PairingInput, name: String, lan: Boolean, savedCa: String? = null): DeviceCredential = withContext(Dispatchers.IO) {
            var caDer = savedCa
            if (input.requiresCa || lan || savedCa != null) {
                if (savedCa == null) {
                    // Only this unauthenticated CA GET uses bootstrap trust; hostname checks remain active.
                    val manager = object : X509TrustManager {
                        override fun getAcceptedIssuers() = emptyArray<X509Certificate>()
                        override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) = Unit
                        override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) = Unit
                    }
                    val ssl = SSLContext.getInstance("TLS").apply { init(null, arrayOf(manager), SecureRandom()) }
                    val bootstrap = httpClient().newBuilder().sslSocketFactory(ssl.socketFactory, manager).build()
                    val ca = try { bootstrap.exchange(request(input.origin, "/mobile-access/ca.cer").build(), 16 * 1024) }
                    finally { bootstrap.connectionPool.evictAll(); bootstrap.dispatcher.cancelAll() }
                    if (ca.status != 200) throw GatewayFailure("certificate-failed")
                    validateCa(ca.bytes, input.instanceId)
                    caDer = Base64.getEncoder().encodeToString(ca.bytes)
                } else validateCa(Base64.getDecoder().decode(savedCa), input.instanceId)
            }
            val trusted = httpClient(caDer?.let { validateCa(Base64.getDecoder().decode(it), input.instanceId) })
            try {
                val metadata = trusted.exchange(request(input.origin, "/mobile-access/metadata").build()).objectValue()
                if (wireValue { metadata["version"]?.jsonPrimitive?.int } != 1) throw GatewayFailure("unsupported-gateway")
                val value = trusted.exchange(request(input.origin, "/mobile-access/auth/native-pair", buildJsonObject { put("token", input.token); put("label", "DSH Native Android") }).build()).objectValue()
                if (value.string("instanceId") != input.instanceId) throw GatewayFailure("instance-changed")
                return@withContext DeviceCredential(UUID.randomUUID().toString(), name.ifBlank { input.origin }, input.origin, input.instanceId,
                    value.string("deviceId"), value.string("deviceToken"), wireValue { value.getValue("deviceExpiresAt").jsonPrimitive.long }, caDer)
            } finally { trusted.connectionPool.evictAll(); trusted.dispatcher.cancelAll() }
        }
    }
}
