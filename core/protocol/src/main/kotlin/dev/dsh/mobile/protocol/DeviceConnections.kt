package dev.dsh.mobile.protocol

import kotlinx.serialization.Serializable
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

@Serializable data class DeviceConnection(val id: String, val name: String, val origin: String, val instanceId: String,
    val deviceId: String, val deviceToken: String, val deviceExpiresAt: Long, val caDer: String? = null) {
    override fun toString() = "DeviceConnection(id=$id, credentials=redacted)"
    fun credential(device: DeviceCredential) = DeviceCredential(device.id, device.name, origin, instanceId, deviceId, deviceToken, deviceExpiresAt, caDer)
}
fun DeviceCredential.connectionOptions(): List<DeviceConnection> = connections.ifEmpty {
    listOf(DeviceConnection("primary", "主要连接", origin, instanceId, deviceId, deviceToken, deviceExpiresAt, caDer))
}
/** Legacy priority metadata is accepted, but never enables automatic switching. */
fun DeviceCredential.manualConnections(): DeviceCredential = copy(connectionMode = "fixed",
    preferredConnectionId = if (connections.isEmpty()) null else preferredConnectionId?.takeIf { id -> connectionOptions().any { it.id == id } } ?: connectionOptions().first().id)
fun deviceGateway(device: DeviceCredential): DeviceGateway = if (device.connections.isEmpty()) GatewayClient(device) else RoutedDeviceGateway(device)

/** Uses exactly the manually selected origin for probes, reads, writes and subscriptions. */
class RoutedDeviceGateway(device: DeviceCredential,
    factory: (DeviceCredential) -> DeviceGateway = { GatewayClient(it) }, private val probeTimeoutMs: Long = 3000) : DeviceGateway {
    private val routes = device.connectionOptions().also {
        require(it.isNotEmpty() && it.size <= 8 && it.map { c -> c.id }.distinct().size == it.size)
        require(it.all { c -> c.instanceId == device.instanceId })
    }
    private val selected = routes.firstOrNull { it.id == device.preferredConnectionId } ?: routes.first()
    private val connection = lazy { factory(selected.credential(device)) }
    private val starting = Mutex()
    @Volatile private var ready = false
    private suspend fun probeSelected() {
        withTimeoutOrNull(probeTimeoutMs) { connection.value.probe(); true } ?: throw GatewayFailure("network-unavailable")
        ready = true
    }
    override suspend fun probe() = starting.withLock { probeSelected() }
    private suspend fun ensureReady() { if (!ready) starting.withLock { if (!ready) probeSelected() } }
    override suspend fun rpc(method: String, args: kotlinx.serialization.json.JsonObject, mutation: Boolean): kotlinx.serialization.json.JsonElement {
        ensureReady()
        return connection.value.rpc(method, args, mutation)
    }
    private fun <T> stream(block: (DeviceGateway) -> Flow<T>): Flow<T> = flow {
        ensureReady(); emitAll(block(connection.value)); throw GatewayFailure("stream-ended")
    }
    override fun followWorkspaces() = stream { it.followWorkspaces() }
    override fun followTaskNotifications() = stream { it.followTaskNotifications() }
    override fun follow(endpoint: String, args: kotlinx.serialization.json.JsonObject) = stream { it.follow(endpoint, args) }
    override suspend fun readChanges(sessionId: String, seq: Long, index: Int?): kotlinx.serialization.json.JsonObject { ensureReady(); return connection.value.readChanges(sessionId, seq, index) }
    override suspend fun upload(sessionId: String, name: String, bytes: ByteArray): kotlinx.serialization.json.JsonObject { ensureReady(); return connection.value.upload(sessionId, name, bytes) }
    override fun close() { if (connection.isInitialized()) connection.value.close() }
}
