package dev.dsh.mobile.data

import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import java.util.concurrent.atomic.AtomicLong

data class PendingInteraction(val id: String, val event: String, val request: JsonObject, val sending: Boolean = false)
data class InteractionState(val deviceId: String? = null, val sessionId: String? = null, val clientId: String? = null,
    val pending: Map<String, PendingInteraction> = emptyMap(), val status: String? = null, val error: String? = null)

/** Event identities belong to one authenticated stream generation, never to a
 * saved draft. A replaced stream withdraws every old answer button. */
class SessionInteractions(private val devices: DeviceRepository, private val catalogChanged: (String) -> Unit = {}) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val generation = AtomicLong()
    private val mutable = MutableStateFlow(InteractionState())
    val state = mutable.asStateFlow()
    private var stream: Job? = null
    private val claims = java.util.concurrent.ConcurrentHashMap<String, Job>()
    private fun supported(event: String, request: JsonObject): Boolean {
        fun string(value: JsonElement?) = value is JsonPrimitive && value.isString && value.content.isNotBlank()
        if (event == "approval/request") return string(request["toolName"]) && (request["callId"] == null || string(request["callId"]))
        val questions = request["questions"] as? JsonArray ?: return false
        return questions.isNotEmpty() && questions.all { row ->
            val q = row as? JsonObject
            q != null && string(q["id"]) && string(q["question"]) &&
                (q["options"] == null || (q["options"] is JsonArray && q["options"]!!.jsonArray.all { option -> option is JsonObject && string(option["label"]) }))
        }
    }
    private fun gateway(device: String) = devices.selectedConnection()?.takeIf { it.first == device }?.second ?: throw GatewayFailure("device-changed")
    private fun update(epoch: Long, f: (InteractionState) -> InteractionState) { mutable.update { if (generation.get() == epoch) f(it) else it } }
    fun open(device: String, session: String, status: String? = null) {
        if (mutable.value.deviceId == device && mutable.value.sessionId == session && stream?.isActive == true) return
        pause(); val epoch = generation.incrementAndGet()
        mutable.value = InteractionState(deviceId = device, sessionId = session, status = status)
        stream = scope.launch {
            var retry = 0
            while (isActive && generation.get() == epoch) {
                try {
                    coroutineScope {
                        gateway(device).follow("\$events", JsonObject(emptyMap())).collect { frame ->
                            if (generation.get() != epoch) return@collect
                            when (frame.text("type")) {
                                "ready" -> update(epoch) { it.copy(clientId = frame.string("clientId"), pending = emptyMap(), error = null) }
                                "cancel" -> {
                                    val id = frame.string("eventId"); claims.remove("$epoch:$id")?.cancel()
                                    update(epoch) { if (id in it.pending) it.copy(pending = it.pending - id, status = "请求已处理或撤回") else it }
                                }
                                "waterfall" -> {
                                    val client = mutable.value.clientId ?: throw GatewayFailure("baseline-required")
                                    val id = frame.string("eventId"); val event = frame.string("event")
                                    if (frame.text("agentId") != session || event !in setOf("approval/request", "user-questions/request")) {
                                        // Do not claim or expose requests belonging to other sessions.
                                        launch { post(device, client, id, buildJsonObject { put("kind", "next") }) }
                                    } else {
                                        val request = frame.getValue("request").jsonObject
                                        if (!supported(event, request)) {
                                            update(epoch) { it.copy(status = "请求格式暂不支持，请在电脑端处理") }
                                            launch { post(device, client, id, buildJsonObject { put("kind", "next") }) }
                                            return@collect
                                        }
                                        update(epoch) { it.copy(pending = it.pending + (id to PendingInteraction(id, event, request))) }
                                        val wait = request["wait"] as? JsonObject
                                        if (event == "user-questions/request" && wait?.get("timed")?.jsonPrimitive?.booleanOrNull == true) {
                                            claims["$epoch:$id"]?.cancel()
                                            claims["$epoch:$id"] = launch {
                                                try { gateway(device).follow("userQuestions/attachWait", buildJsonObject { put("agentId", session); put("callId", wait.string("callId")) }).collect { } }
                                                catch (cancel: CancellationException) { throw cancel }
                                                catch (_: Exception) { /* The Host cancel/projection decides whether a question remains answerable. */ }
                                            }
                                        }
                                    }
                                }
                                "emit" -> if (frame.text("event") in setOf("permission-presets/catalog-changed", "llm/adapters-updated", "commands/change")) catalogChanged(frame.text("event"))
                                else -> throw GatewayFailure("invalid-response")
                            }
                            retry = 0
                        }
                    }
                } catch (cancel: CancellationException) { throw cancel }
                catch (error: Exception) {
                    claims.values.forEach { it.cancel() }; claims.clear()
                    update(epoch) { it.copy(clientId = null, pending = emptyMap(), error = (error as? GatewayFailure)?.code ?: "invalid-response") }
                    delay((1_000L shl retry.coerceAtMost(4)).coerceAtMost(15_000)); retry++
                }
            }
        }
    }
    private suspend fun post(device: String, client: String, event: String, outcome: JsonObject) = gateway(device).rpc("\$events/result",
        buildJsonObject { put("clientId", client); put("eventId", event); put("outcome", outcome) }, true)
    suspend fun answer(id: String, value: JsonElement) {
        val before = mutable.value; val epoch = generation.get()
        val device = before.deviceId ?: throw GatewayFailure("device-not-found")
        val client = before.clientId ?: throw GatewayFailure("connection-required")
        val request = before.pending[id] ?: throw GatewayFailure("request-withdrawn")
        if (request.event == "approval/request" && (value as? JsonPrimitive)?.content !in setOf("allowed-once", "rejected")) throw GatewayFailure("invalid-answer")
        var admitted = false
        update(epoch) { s ->
            val live = s.pending[id]
            if (s.clientId == client && live != null && !live.sending) { admitted = true; s.copy(pending = s.pending + (id to live.copy(sending = true))) } else { admitted = false; s }
        }
        if (!admitted) throw GatewayFailure("request-withdrawn")
        try {
            if (generation.get() != epoch) throw GatewayFailure("device-changed")
            if (mutable.value.pending[id]?.sending != true || mutable.value.clientId != client) throw GatewayFailure("request-withdrawn")
            post(device, client, id, buildJsonObject { put("kind", "result"); put("value", value) })
            update(epoch) { it.copy(pending = it.pending - id, status = "响应已提交，等待电脑端同步") }
            claims.remove("$epoch:$id")?.cancel()
        } catch (cancel: CancellationException) { throw cancel }
        catch (error: GatewayFailure) {
            if (error.code == "result-unknown" && generation.get() == epoch) {
                // A new event generation replays only requests still pending on
                // the Host. Never replay the decision itself after an unknown result.
                pause(); open(device, before.sessionId!!, "响应结果待确认，正在重新同步请求")
            } else update(epoch) { s -> s.copy(error = error.code, pending = s.pending[id]?.let { s.pending + (id to it.copy(sending = false)) } ?: s.pending) }
            throw error
        }
    }
    fun pause() { generation.incrementAndGet(); stream?.cancel(); stream = null; claims.values.forEach { it.cancel() }; claims.clear(); mutable.value = InteractionState() }
    fun close() { pause(); scope.cancel() }
}
