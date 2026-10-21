package dev.dsh.mobile.protocol

import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.take
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.mockwebserver.*
import okhttp3.tls.HandshakeCertificates
import okhttp3.tls.HeldCertificate
import okio.Buffer
import org.junit.Assert.*
import org.junit.Test
import java.security.MessageDigest

class GatewayClientTest {
    private class Fixture(private val marker: String) : AutoCloseable {
        val ca = HeldCertificate.Builder().commonName("M2 test CA $marker").certificateAuthority(1).build()
        private val leaf = HeldCertificate.Builder().commonName("localhost").addSubjectAlternativeName("localhost")
            .addSubjectAlternativeName("127.0.0.1").signedBy(ca).build()
        val instance = MessageDigest.getInstance("SHA-256").digest(ca.certificate.encoded).joinToString("") { "%02x".format(it) }
        val server = MockWebServer()
        var renewals = 0
        var burstFrames = 1
        var cookie: String? = null
        var uploadResponse: (() -> MockResponse)? = null
        var receivedUploads = 0
        var uploadedBytes = 0L
        var uploadedDigest = ""
        var binaryResponse: ((String) -> MockResponse)? = null
        var renewalResponse: (() -> MockResponse)? = null
        var taskStreamResponse: (() -> MockResponse)? = null
        val taskCookies = java.util.concurrent.CopyOnWriteArrayList<String>()
        val bodyLossRequests = java.util.concurrent.ConcurrentHashMap<String, Int>()
        val timedOutWrites = java.util.concurrent.ConcurrentHashMap<String, Int>()
        init {
            server.useHttps(HandshakeCertificates.Builder().heldCertificate(leaf, ca.certificate).build().sslSocketFactory(), false)
            server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
                override fun dispatch(request: RecordedRequest): MockResponse = when {
                    request.path == "/mobile-access/ca.cer" -> MockResponse().setBody(Buffer().write(ca.certificate.encoded))
                    request.path == "/mobile-access/metadata" -> MockResponse().setBody("{\"version\":1}")
                    request.path == "/mobile-access/auth/native-pair" -> MockResponse().setResponseCode(201).setBody("""{"instanceId":"$instance","deviceId":"device-$marker","deviceToken":"secret-$marker","deviceExpiresAt":9999999999999}""")
                    request.path == "/mobile-access/auth/native-renew" -> {
                        renewals++; renewalResponse?.invoke() ?: MockResponse().setBody("""{"instanceId":"$instance","deviceId":"device-$marker","sessionToken":"session-$marker","csrfToken":"csrf-$marker","sessionExpiresAt":9999999999999}""")
                    }
                    request.path == "/mobile-access/extensions/events" -> {
                        taskCookies += request.getHeader("Cookie").orEmpty()
                        taskStreamResponse?.invoke() ?: MockResponse().setHeader("Content-Type", "text/event-stream").setBody(": heartbeat\n\nevent: task-notify\ndata: {\"sessionId\":\"s\",\"turn\":7}\n\n")
                    }
                    request.path == "/api/remote.mux" -> MockResponse().withWebSocketUpgrade(object : WebSocketListener() {
                        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) { webSocket.close(code, reason) }
                        override fun onMessage(webSocket: WebSocket, text: String) {
                            val frame = WireJson.parseToJsonElement(text).jsonObject
                            if (frame.string("type") == "open") {
                                if (frame.text("endpoint") == "fixture/large") webSocket.send("""{"type":"item","streamId":"${frame.string("streamId")}","value":{"large":"${"x".repeat(2 * 1024 * 1024)}"}}""")
                                else repeat(burstFrames) { index -> webSocket.send("""{"type":"item","streamId":"${frame.string("streamId")}","value":{"type":"baseline","index":$index,"value":{"items":[]}}}""") }
                            }
                        }
                    })
                    request.path?.startsWith("/api/changes.") == true -> MockResponse().setBody("""{"kind":"fixture","cookie":"${request.getHeader("Cookie")}","method":"${request.method}","query":"${request.requestUrl!!.query}"}""")
                    request.path == "/api/proxy-failure" -> MockResponse().setResponseCode(502).setBody("upstream response unavailable")
                    request.path in setOf("/api/request-timeout", "/api/retry-after-zero") -> {
                        val count = timedOutWrites.merge(request.path!!, 1, Int::plus)!!
                        val body = WireJson.parseToJsonElement(request.body.readUtf8()).jsonObject
                        if (count == 1) MockResponse().setResponseCode(if (request.path == "/api/request-timeout") 408 else 503).setHeader("Retry-After", "0")
                        else MockResponse().setBody("""{"type":"server-response","rpcId":"${body.string("rpcId")}","result":{"ok":true,"value":{"accepted":true}}}""")
                    }
                    request.path?.startsWith("/api/session/uploadFileBinary") == true -> {
                        receivedUploads++
                        uploadedBytes = request.body.size
                        uploadedDigest = request.body.snapshot().sha256().hex()
                        uploadResponse?.invoke() ?: MockResponse().setBody("""{"ok":true,"value":{"receiptId":"owned-receipt"}}""")
                    }
                    request.path == "/api/workspaceFiles/readBytes" -> {
                        cookie = request.getHeader("Cookie")
                        val body = WireJson.parseToJsonElement(request.body.readUtf8()).jsonObject
                        binaryResponse!!.invoke(body.string("rpcId"))
                    }
                    else -> {
                        cookie = request.getHeader("Cookie")
                        val body = WireJson.parseToJsonElement(request.body.readUtf8()).jsonObject
                        val loseBody = request.path in setOf("/api/lost-read-body", "/api/lost-write-body") &&
                            bodyLossRequests.merge(request.path!!, 1, Int::plus) == 1
                        val result = when (request.path) {
                            "/api/bad" -> """{"ok":false,"error":{"code":"workspace/not-found"}}"""
                            "/api/remote-invalid" -> """{"ok":false,"error":{"code":"invalid-response"}}"""
                            else -> """{"ok":true,"value":{"owner":"$marker"}}"""
                        }
                        MockResponse().setBody(if (loseBody) "x".repeat(64 * 1024) else when (request.path) {
                            "/api/malformed-json" -> "{broken"
                            "/api/oversized-result" -> "x".repeat(2 * 1024 * 1024 + 1)
                            "/api/wrong-rpc-id" -> """{"type":"server-response","rpcId":"other-write","result":{"ok":true,"value":{}}}"""
                            "/api/malformed-result" -> """{"type":"server-response","rpcId":"${body.string("rpcId")}","result":{"ok":"not-a-boolean"}}"""
                            else -> """{"type":"server-response","rpcId":"${body.string("rpcId")}","result":$result}"""
                        }).apply { if (loseBody) setSocketPolicy(SocketPolicy.DISCONNECT_DURING_RESPONSE_BODY) }
                    }
                }
            }
            server.start()
        }
        suspend fun client(): GatewayClient = GatewayClient(GatewayClient.pair(
            PairingInput.parse(server.url("/").toString(), "dsh2.$instance.${"A".repeat(43)}"), marker, true))
        override fun close() { server.shutdown() }
    }
    @Test fun recordedChangesUseAuthenticatedGetAndEncodedCoordinates() = runBlocking {
        Fixture("changes").use { fixture ->
            val client = fixture.client()
            try {
                val summary = client.readChanges("session with & space", 42)
                assertEquals("GET",summary.text("method")); assertEquals("dsh_ma_session=session-changes",summary.text("cookie"))
                assertTrue(summary.text("query").contains("sessionId=session with & space"))
                val diff = client.readChanges("session",42,3)
                assertEquals("sessionId=session&seq=42&index=3",diff.text("query"))
            } finally { client.close() }
        }
    }
    @Test fun authenticatedBinaryRpcDecodesOfficialMultipartAndChecksRpcIdentity() = runBlocking {
        Fixture("binary").use { fixture ->
            var wrongId = false
            fixture.binaryResponse = { rpcId ->
                val metadata = buildJsonObject {
                    put("type", "server-response"); put("rpcId", if (wrongId) "wrong" else rpcId)
                    put("result", buildJsonObject { put("ok", true); put("value", buildJsonObject { put("data", JsonNull) }) })
                    put("attachments", buildJsonArray { add(buildJsonObject { put("path", buildJsonArray { add("data") }); put("codec", "bytes"); put("part", "bytes-0") }) })
                }
                val multipart = MultipartBody.Builder().setType(MultipartBody.FORM)
                    .addFormDataPart("bytes-0", "blob", byteArrayOf(0, -1, 13, 10).toRequestBody())
                    .addFormDataPart("metadata", metadata.toString()).build()
                MockResponse().setHeader("Content-Type", multipart.contentType().toString()).setBody(Buffer().also { multipart.writeTo(it) })
            }
            val client = fixture.client()
            try {
                assertArrayEquals(byteArrayOf(0, -1, 13, 10), java.util.Base64.getDecoder().decode(client.rpc("workspaceFiles/readBytes").jsonObject.text("data")))
                assertEquals("dsh_ma_session=session-binary", fixture.cookie)
                wrongId = true
                try { client.rpc("workspaceFiles/readBytes"); fail("wrong identity must fail") }
                catch (error: GatewayFailure) { assertEquals("invalid-response", error.code) }
            } finally { client.close() }
        }
    }

    @Test fun subscriptionsShareOneSocketAndCancellationLeavesOtherStreamsUsable() = runBlocking {
        Fixture("mux").use { fixture ->
            val client = fixture.client()
            try {
                val baseline = CompletableDeferred<Unit>()
                val anchor = launch { client.followWorkspaces().collect { baseline.complete(Unit) } }
                withTimeout(5_000) { baseline.await() }
                assertEquals("baseline", withTimeout(5_000) { client.follow("session/control", JsonObject(emptyMap())).first() }.text("type"))
                assertEquals("baseline", withTimeout(5_000) { client.followWorkspaces().first() }.text("type"))
                try { withTimeout(5_000) { client.follow("fixture/large", JsonObject(emptyMap())).first() }; fail("Large frame admitted") }
                catch (error: GatewayFailure) { assertEquals("response-too-large", error.code) }
                assertEquals("baseline", withTimeout(5_000) { client.followWorkspaces().first() }.text("type"))
                val requests = buildList { while (true) { val request = fixture.server.takeRequest(100, java.util.concurrent.TimeUnit.MILLISECONDS) ?: break; add(request) } }
                assertEquals(1, requests.count { it.path == "/api/remote.mux" })
                anchor.cancelAndJoin()
            } finally { client.close() }
        }
    }

    @Test fun burstReplayBackpressuresWithoutDisconnectOrLostFrames() = runBlocking {
        Fixture("burst").use { fixture ->
            fixture.burstFrames = 400
            val client = fixture.client()
            try {
                val frames = withTimeout(15_000) { client.followWorkspaces().onEach { delay(2) }.take(400).toList() }
                assertEquals((0L..399L).toList(), frames.map { it.number("index") })
            } finally { client.close() }
        }
    }

    @Test fun oldPluginSseUsesPairedCookieAndCanReconnectAfterRenewalExpires() = runBlocking {
        Fixture("sse").use { fixture ->
            val client = fixture.client()
            try {
                fixture.taskStreamResponse = { MockResponse().setResponseCode(401) }
                try { withTimeout(5000) { client.followTaskNotifications().toList() }; fail("expired") }
                catch (error: GatewayFailure) { assertEquals("session-expired", error.code) }
                fixture.taskStreamResponse = null
                val frames = withTimeout(5000) { client.followTaskNotifications().take(3).toList() }
                assertEquals(TaskNotificationSignal.Ready, frames[0])
                assertEquals(TaskNotificationSignal.Heartbeat, frames[1])
                assertEquals("s:turn:7", (frames[2] as TaskNotificationSignal.Completed).event.id)
                assertEquals(2, fixture.renewals)
                assertEquals(listOf("dsh_ma_session=session-sse", "dsh_ma_session=session-sse"), fixture.taskCookies)
            } finally { client.close() }
        }
    }
    @Test fun notificationSseRejectsHtmlAndCancellationClosesIdleConnection() = runBlocking {
        Fixture("sse-cancel").use { fixture ->
            val client = fixture.client()
            try {
                fixture.taskStreamResponse = { MockResponse().setHeader("Content-Type", "text/html").setBody("login") }
                try { withTimeout(5000) { client.followTaskNotifications().toList() }; fail("html") }
                catch (error: GatewayFailure) { assertEquals("invalid-response", error.code) }
                fixture.taskStreamResponse = { MockResponse().setHeader("Content-Type", "text/event-stream")
                    .setBody(": ready\n\n").setHeader("Content-Length", "100000") }
                val ready = CompletableDeferred<Unit>()
                val reader = launch { client.followTaskNotifications().collect { if (it == TaskNotificationSignal.Ready) ready.complete(Unit) } }
                withTimeout(5000) { ready.await() }
                delay(50) // Reader is now blocked awaiting the rest of the advertised response body.
                withTimeout(1500) { reader.cancelAndJoin() }
                // A subsequent authenticated RPC succeeds after cancelling the reader.
                assertEquals("sse-cancel", client.rpc("list").jsonObject.string("owner"))
            } finally { client.close() }
        }
    }
    @Test fun securePairingAndRpcKeepCookiesIsolatedByDevice() = runBlocking {
        Fixture("a").use { a -> Fixture("b").use { b ->
            val first = a.client(); val second = b.client()
            try {
                assertEquals("a", first.rpc("list").jsonObject.string("owner"))
                assertEquals("b", second.rpc("list").jsonObject.string("owner"))
                assertEquals("dsh_ma_session=session-a", a.cookie)
                assertEquals("dsh_ma_session=session-b", b.cookie)
                first.rpc("list"); assertEquals(1, a.renewals)
            } finally { first.close(); second.close() }
        } }
    }
    @Test fun wrongCaFingerprintFailsBeforePairingCredentialsAreSent() = runBlocking {
        Fixture("a").use { fixture ->
            try { GatewayClient.pair(PairingInput.parse(fixture.server.url("/").toString(), "dsh2.${"0".repeat(64)}.${"A".repeat(43)}"), "test", true); fail("must reject") }
            catch (error: GatewayFailure) { assertEquals("instance-changed", error.code) }
            assertEquals(1, fixture.server.requestCount)
        }
    }
    @Test fun revokedRenewalCannotReachMutationAdmission() = runBlocking {
        Fixture("revoked").use { fixture ->
            val client = fixture.client()
            try {
                fixture.renewalResponse = { MockResponse().setResponseCode(401) }
                val before = fixture.server.requestCount
                try { client.rpc("must-not-mutate", mutation = true); fail("Revoked credential admitted") }
                catch (error: GatewayFailure) { assertEquals("device-revoked", error.code) }
                assertEquals(1, fixture.server.requestCount - before)
            } finally { client.close() }
        }
    }
    @Test fun changedRenewalInstanceOrDeviceCannotReachMutationAdmission() = runBlocking {
        for (foreignInstance in listOf(true, false)) Fixture("binding").use { fixture ->
            val client = fixture.client()
            try {
                fixture.renewalResponse = { MockResponse().setBody(buildJsonObject {
                    put("instanceId", if (foreignInstance) "0".repeat(64) else fixture.instance)
                    put("deviceId", if (foreignInstance) "device-binding" else "foreign-device")
                    put("sessionToken", "fixture-only"); put("csrfToken", "fixture-only")
                    put("sessionExpiresAt", 9999999999999L)
                }.toString()) }
                val before = fixture.server.requestCount
                try { client.rpc("must-not-mutate", mutation = true); fail("Foreign renewal admitted") }
                catch (error: GatewayFailure) { assertEquals("instance-changed", error.code) }
                assertEquals(1, fixture.server.requestCount - before)
            } finally { client.close() }
        }
    }
    @Test fun persistedPinnedCredentialRejectsIndependentGatewayCertificateBeforeHttp() = runBlocking {
        Fixture("trusted").use { trusted -> Fixture("other").use { other ->
            val original = trusted.client()
            val redirected = GatewayClient(original.credential.copy(origin = other.server.url("/").toString().trimEnd('/')))
            try {
                try { redirected.rpc("must-not-mutate", mutation = true); fail("Foreign certificate admitted") }
                catch (error: GatewayFailure) { assertEquals("certificate-failed", error.code) }
                assertEquals(0, other.server.requestCount)
            } finally { redirected.close(); original.close() }
        } }
    }
    @Test fun http200BusinessFailureIsNotTreatedAsSuccess() = runBlocking {
        Fixture("a").use { fixture -> val client = fixture.client()
            try { client.rpc("bad"); fail("must reject") }
            catch (error: GatewayFailure) { assertEquals("workspace/not-found", error.code) }
            finally { client.close() }
        }
    }
    @Test fun workspaceStreamReceivesBaselineAndIsCancellable() = runBlocking {
        Fixture("a").use { fixture -> val client = fixture.client()
            try { assertEquals("baseline", withTimeout(5000) { client.followWorkspaces().first() }.string("type")) }
            finally { client.close() }
        }
    }
    @Test fun malformedWriteResponsesCannotProveRejectionAndMustRemainUnknown() = runBlocking {
        Fixture("uncertain-write").use { fixture -> val client = fixture.client()
            try {
                for (method in listOf("malformed-json", "wrong-rpc-id", "malformed-result", "oversized-result", "proxy-failure")) {
                    try { client.rpc(method, mutation = true); fail("An unverified write response cannot establish rejection") }
                    catch (error: GatewayFailure) { assertEquals(method, "result-unknown", error.code) }
                }
            } finally { client.close() }
        }
    }
    @Test fun malformedReadStillReportsInvalidResponseAndDefiniteWriteRejectionIsPreserved() = runBlocking {
        Fixture("definite-result").use { fixture -> val client = fixture.client()
            try {
                try { client.rpc("malformed-json"); fail("Malformed read must fail") }
                catch (error: GatewayFailure) { assertEquals("invalid-response", error.code) }
                try { client.rpc("proxy-failure"); fail("Read failure remains an HTTP error") }
                catch (error: GatewayFailure) { assertEquals("http-failure", error.code) }
                try { client.rpc("bad", mutation = true); fail("Definite remote rejection must fail") }
                catch (error: GatewayFailure) { assertEquals("workspace/not-found", error.code) }
                try { client.rpc("remote-invalid", mutation = true); fail("Valid remote error must remain definite") }
                catch (error: GatewayFailure) { assertEquals("invalid-response", error.code) }
            } finally { client.close() }
        }
    }
    @Test fun streamsFilesAboveEightMiBWithKnownAndUnknownLength() = runBlocking {
        Fixture("large-file-stream").use { fixture ->
            val client = fixture.client()
            val bytes = ByteArray(9 * 1024 * 1024 + 17) { (it % 251).toByte() }
            val digest = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
            try {
                for (length in listOf(bytes.size.toLong(), -1L)) {
                    var opens = 0; var closed = false
                    val receipt = client.uploadStream("owned-session", "large.bin", length) {
                        opens++
                        object : java.io.ByteArrayInputStream(bytes) {
                            override fun read(buffer: ByteArray, offset: Int, count: Int): Int {
                                assertTrue("Reads must stay bounded", count <= 64 * 1024)
                                return super.read(buffer, offset, count)
                            }
                            override fun close() { closed = true; super.close() }
                        }
                    }
                    assertEquals("owned-receipt", receipt.text("receiptId"))
                    assertEquals(bytes.size.toLong(), fixture.uploadedBytes)
                    assertEquals(digest, fixture.uploadedDigest)
                    assertEquals(1, opens); assertTrue(closed)
                }
                fixture.uploadResponse = { MockResponse().setResponseCode(413).setBody("too large") }
                try { client.uploadStream("owned-session", "file.bin", 1) { java.io.ByteArrayInputStream(byteArrayOf(1)) }; fail("Must expose server size rejection") }
                catch (error: GatewayFailure) { assertEquals("attachment-size", error.code) }
            } finally { client.close() }
        }
    }
    @Test fun uploadResponseLossAfterReceiptNeverProvesRejectionOrTriggersReplay() = runBlocking {
        Fixture("owned-upload").use { fixture -> val client = fixture.client()
            try {
                val responses = listOf<() -> MockResponse>(
                    { MockResponse().setBody("{broken") },
                    { MockResponse().setBody("{}") },
                    { MockResponse().setBody("""{"ok":"wrong-type"}""") },
                    { MockResponse().setBody("""{"ok":true}""") },
                    { MockResponse().setBody("""{"ok":true,"value":{}}""") },
                    { MockResponse().setBody("""{"ok":true,"value":{"receiptId":42}}""") },
                    { MockResponse().setBody("""{"ok":true,"value":{"receiptId":""}}""") },
                    { MockResponse().setBody("x".repeat(2 * 1024 * 1024 + 1)) },
                    { MockResponse().setResponseCode(502) }
                )
                for (response in responses) {
                    fixture.uploadResponse = response
                    val before = fixture.receivedUploads
                    try { client.upload("owned-session", "fixture.bin", byteArrayOf(1, 2, 3)); fail("Cannot prove submitted upload was rejected") }
                    catch (error: GatewayFailure) { assertEquals("result-unknown", error.code) }
                    assertEquals("No automatic upload replay", before + 1, fixture.receivedUploads)
                }
                fixture.uploadResponse = { MockResponse().setBody("""{"ok":false,"error":{"code":"attachment-size"}}""") }
                try { client.upload("owned-session", "fixture.bin", byteArrayOf(1)); fail("Explicit rejection must fail") }
                catch (error: GatewayFailure) { assertEquals("attachment-size", error.code) }
                fixture.uploadResponse = { MockResponse().setResponseCode(403) }
                try { client.upload("owned-session", "fixture.bin", byteArrayOf(1)); fail("Access denial must remain definite") }
                catch (error: GatewayFailure) { assertEquals("access-denied", error.code) }
            } finally { client.close() }
        }
    }
    @Test fun incompleteReadBodyGetsOneTrustedFallbackButMutationIsNeverReplayed() = runBlocking {
        Fixture("trusted-read-fallback").use { fixture -> val client = fixture.client()
            try {
                assertEquals("trusted-read-fallback", client.rpc("lost-read-body").jsonObject.string("owner"))
                assertEquals(2, fixture.bodyLossRequests["/api/lost-read-body"])
                assertEquals("dsh_ma_session=session-trusted-read-fallback", fixture.cookie)
                try { client.rpc("lost-write-body", mutation = true); fail("Unknown write must not be replayed") }
                catch (error: GatewayFailure) { assertEquals("result-unknown", error.code) }
                assertEquals(1, fixture.bodyLossRequests["/api/lost-write-body"])
            } finally { client.close() }
        }
    }
    @Test fun transportTimeoutAndRetryAfterCannotAutomaticallyResubmitAWrite() = runBlocking {
        Fixture("no-http-replay").use { fixture -> val client = fixture.client()
            try {
                for (method in listOf("request-timeout", "retry-after-zero")) {
                    try { client.rpc(method, mutation = true); fail("Transport must not resubmit an ambiguous write") }
                    catch (error: GatewayFailure) { assertEquals("result-unknown", error.code) }
                    assertEquals(1, fixture.timedOutWrites["/api/$method"])
                }
            } finally { client.close() }
        }
    }
    @Test fun deltaBeforeBaselineAndCredentialsInHttpUrlAreRejected() {
        try { reduceWorkspaces(null, buildJsonObject { put("type", "remove"); put("workspaceId", "x") }); fail("must reject") }
        catch (error: GatewayFailure) { assertEquals("baseline-required", error.code) }
        try { PairingInput.parse("https://user:password@localhost", "dsh1.${"0".repeat(64)}.${"A".repeat(43)}"); fail("must reject") }
        catch (error: GatewayFailure) { assertEquals("invalid-address", error.code) }
    }
}
