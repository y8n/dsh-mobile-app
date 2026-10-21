package dev.dsh.mobile.data

import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.*
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong

data class PluginState(val deviceId: String? = null, val loading: Boolean = false, val busy: Boolean = false,
    val plugins: JsonArray = JsonArray(emptyList()), val bundles: JsonArray = JsonArray(emptyList()),
    val error: String? = null, val result: JsonObject? = null, val inspection: JsonObject? = null, val inspectedSpec: String? = null,
    val inspectedRegistry: JsonElement? = null, val registries: JsonObject? = null, val registriesLoading: Boolean = false, val registriesError: Boolean = false,
    val install: PendingPluginInstall? = null, val installPhase: String? = null, val searchQuery: String = "", val searching: Boolean = false,
    val searchResults: List<RegistryPackage> = emptyList(), val searchHasMore: Boolean = false)

class PluginRepository(private val devices: DeviceRepository, private val storage: DeviceStore) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val generation = AtomicLong(); private val searchGeneration = AtomicLong(); private val inspectionGeneration = AtomicLong()
    private val writes = Mutex(); private val reads = Mutex(); private val mutable = MutableStateFlow(PluginState()); val state = mutable.asStateFlow()
    private var events: Job? = null; private var search: Job? = null
    private val registry = PublicRegistrySearch()
    init { scope.launch { devices.state.map { it.selectedId }.distinctUntilChanged().collect { changedDevice() } } }
    @Synchronized private fun changedDevice() { if (mutable.value.deviceId != null && mutable.value.deviceId != devices.state.value.selectedId) pause() }
    private fun gateway(device: String) = devices.selectedConnection()?.takeIf { it.first == device }?.second ?: throw GatewayFailure("device-changed")
    private fun update(epoch: Long, f: (PluginState) -> PluginState) { mutable.update { if (generation.get() == epoch) f(it) else it } }
    @Synchronized fun open() {
        val device = devices.state.value.selectedId ?: return
        if (mutable.value.deviceId == device && events?.isActive == true) return
        pause(); val epoch = generation.incrementAndGet(); mutable.value = PluginState(deviceId = device, loading = true)
        scope.launch { try { val pending = storage.read().pluginInstalls.firstOrNull { it.deviceId == device }; update(epoch) { it.copy(install = pending) }; load(epoch, device) }
            catch (error: Exception) { update(epoch) { it.copy(loading = false, error = (error as? GatewayFailure)?.code ?: "invalid-response") } } }
        events = scope.launch {
            var attempt = 0
            while (isActive && generation.get() == epoch) {
                try {
                    var client: String? = null
                    gateway(device).follow("\$events", JsonObject(emptyMap())).collect { frame ->
                        if (generation.get() != epoch) return@collect
                        when (frame.text("type")) {
                            "ready" -> { client = frame.string("clientId"); load(epoch, device) }
                            "waterfall" -> gateway(device).rpc("\$events/result", buildJsonObject { put("clientId", client ?: throw GatewayFailure("baseline-required")); put("eventId", frame.string("eventId")); put("outcome", buildJsonObject { put("kind", "next") }) }, true)
                            "emit" -> when (frame.text("event")) {
                                "plugin-manager/changed" -> load(epoch, device)
                                "plugin-manager/install-state" -> {
                                    val progress = (frame["args"] as? JsonArray)?.firstOrNull() as? JsonObject
                                    if (progress?.text("requestId") == mutable.value.install?.requestId) update(epoch) { it.copy(installPhase = progress?.text("phase")) }
                                }
                            }
                        }
                        attempt = 0
                    }
                } catch (cancel: CancellationException) { throw cancel }
                catch (_: Exception) { delay((1_000L shl attempt.coerceAtMost(4)).coerceAtMost(15_000)); attempt++ }
            }
        }
    }
    private suspend fun load(epoch: Long, device: String) = reads.withLock {
        if (generation.get() != epoch) return@withLock
        update(epoch) { it.copy(loading = true) }
        try {
            val plugins = gateway(device).rpc("pluginManager/listPlugins", JsonObject(emptyMap())).jsonArray
            val bundles = gateway(device).rpc("pluginManager/listBundles", JsonObject(emptyMap())).jsonArray
            update(epoch) { it.copy(plugins = plugins, bundles = bundles, loading = false, error = null) }
        } catch (error: Exception) { update(epoch) { it.copy(loading = false, error = (error as? GatewayFailure)?.code ?: "invalid-response") }; throw error }
    }
    fun refresh() { val device = mutable.value.deviceId ?: return; val epoch = generation.get(); scope.launch { try { load(epoch, device) } catch (_: Exception) { } } }
    private suspend fun <T> write(expectedDevice: String? = null, block: suspend (Long, String) -> T): T {
        val epoch = generation.get(); val device = mutable.value.deviceId ?: throw GatewayFailure("device-not-found")
        if (expectedDevice != null && expectedDevice != device) throw GatewayFailure("device-changed")
        return writes.withLock {
            if (generation.get() != epoch || devices.state.value.selectedId != device) throw GatewayFailure("device-changed")
            if (!devices.state.value.connected) throw GatewayFailure("connection-required")
            update(epoch) { it.copy(busy = true, error = null, result = null) }
            try { block(epoch, device) }
            catch (error: Exception) { update(epoch) { it.copy(error = (error as? GatewayFailure)?.code ?: "invalid-response") }; throw error }
            finally { update(epoch) { it.copy(busy = false) } }
        }
    }
    suspend fun enable(target: String, enabled: Boolean, bundle: Boolean, expectedDevice: String? = null) = write(expectedDevice) { epoch, device ->
        val item = (if (bundle) mutable.value.bundles else mutable.value.plugins).firstOrNull { it.jsonObject.text(if (bundle) "name" else "entryId") == target }?.jsonObject ?: throw GatewayFailure("plugin-not-found")
        if (item.text("readOnlyReason").isNotBlank() || (!bundle && item.text("patchId").isBlank())) throw GatewayFailure("plugin-protected")
        val result = gateway(device).rpc(if (bundle) "pluginManager/setBundleEnabled" else "pluginManager/setPluginEnabled", buildJsonObject { put(if (bundle) "name" else "id", target); put("enabled", enabled) }, true).jsonObject
        update(epoch) { it.copy(result = result) }
        if (generation.get() == epoch && devices.state.value.selectedId == device) load(epoch, device)
    }
    fun loadRegistries() {
        val device = mutable.value.deviceId ?: return; val epoch = generation.get()
        update(epoch) { it.copy(registriesLoading = true, registriesError = false) }
        scope.launch {
            try {
                val config = gateway(device).rpc("pluginManager/registries", JsonObject(emptyMap())).jsonObject
                update(epoch) { it.copy(registries = config, registriesLoading = false) }
            } catch (cancel: CancellationException) { throw cancel }
            catch (_: Exception) { update(epoch) { it.copy(registriesLoading = false, registriesError = true) } }
        }
    }
    fun invalidateInspection() {
        inspectionGeneration.incrementAndGet()
        mutable.update { it.copy(inspection = null, inspectedSpec = null, inspectedRegistry = null, loading = false) }
    }
    suspend fun inspect(spec: String, expectedDevice: String? = null, source: JsonElement? = null) {
        val device = mutable.value.deviceId ?: throw GatewayFailure("device-not-found"); val epoch = generation.get(); val request = inspectionGeneration.incrementAndGet()
        if (expectedDevice != null && expectedDevice != device) throw GatewayFailure("device-changed")
        val sourceRegistry = normalizedPluginRegistry(source)
        update(epoch) { it.copy(inspection = null, inspectedSpec = spec, inspectedRegistry = sourceRegistry, loading = true, error = null) }
        try {
            val result = gateway(device).rpc("pluginManager/inspect", buildJsonObject { put("spec", spec); put("options", buildJsonObject { sourceRegistry?.let { put("registry",it) } }) }).jsonObject
            update(epoch) { if (inspectionGeneration.get() == request) it.copy(inspection = result, loading = false) else it }
        } catch (error: Exception) { update(epoch) { if (inspectionGeneration.get() == request) it.copy(loading = false, error = (error as? GatewayFailure)?.code ?: "invalid-response") else it }; throw error }
    }
    suspend fun install(spec: String, enabled: Boolean, expectedDevice: String? = null, source: JsonElement? = null) = write(expectedDevice) { epoch, device ->
        val s = mutable.value; if (s.install != null) throw GatewayFailure("install-result-pending")
        if (s.inspection?.text("status") != "accepted") throw GatewayFailure("plugin-inspection-required")
        if (s.inspectedSpec != spec || s.inspectedRegistry != normalizedPluginRegistry(source)) throw GatewayFailure("plugin-inspection-required")
        if ((s.inspection["bundle"] as? JsonPrimitive)?.booleanOrNull == false) throw GatewayFailure("plugin-not-bundle")
        val pending = PendingPluginInstall(device, UUID.randomUUID().toString(), s.inspectedSpec ?: throw GatewayFailure("invalid-spec"), normalizedPluginRegistry(s.inspection["registry"] ?: s.inspectedRegistry))
        storage.update { it.copy(pluginInstalls = it.pluginInstalls + pending) }; update(epoch) { it.copy(install = pending, installPhase = "installing") }
        val result = gateway(device).rpc("pluginManager/installBundle", buildJsonObject { put("spec", pending.spec); put("options", buildJsonObject { put("enabled", enabled); put("requestId", pending.requestId); pending.registry?.let { put("registry",it) } }) }, true).jsonObject
        complete(epoch, device, pending.requestId, result)
    }
    private suspend fun complete(epoch: Long, device: String, id: String, result: JsonObject) {
        if (result.text("application") !in setOf("applied", "restart-required", "overridden", "failed", "cancelled")) throw GatewayFailure("install-result-unknown")
        storage.update { it.copy(pluginInstalls = it.pluginInstalls.filterNot { p -> p.deviceId == device && p.requestId == id }) }
        update(epoch) { it.copy(install = null, installPhase = null, result = result) }
        if (generation.get() == epoch && devices.state.value.selectedId == device) load(epoch, device)
    }
    suspend fun reconcileInstall(expectedDevice: String? = null) = write(expectedDevice) { epoch, device ->
        val pending = mutable.value.install ?: return@write
        val result = gateway(device).rpc("pluginManager/waitForInstall", buildJsonObject { put("requestId", pending.requestId) })
        if (result is JsonNull) throw GatewayFailure("install-result-unknown")
        complete(epoch, device, pending.requestId, result.jsonObject)
    }
    suspend fun cancelInstall(expectedDevice: String? = null) {
        val pending = mutable.value.install ?: return; val epoch = generation.get()
        if (expectedDevice != null && expectedDevice != pending.deviceId) throw GatewayFailure("device-changed")
        if (!devices.state.value.connected) throw GatewayFailure("connection-required")
        val result = gateway(pending.deviceId).rpc("pluginManager/cancelInstall", buildJsonObject { put("requestId", pending.requestId) }, true).jsonObject
        if (result.text("status") == "cancelled") {
            // This response specifically guarantees process exit and restored files.
            complete(epoch, pending.deviceId, pending.requestId, buildJsonObject { put("application", "cancelled"); put("changed", false) })
        } else update(epoch) { it.copy(installPhase = result.text("status")) }
    }
    fun searchRegistry(query: String) {
        search?.cancel(); val request = searchGeneration.incrementAndGet(); val epoch = generation.get()
        val discover = isPublicRegistryQuery(query)
        update(epoch) { it.copy(searchQuery = query, searching = discover, searchResults = emptyList(), searchHasMore = false, error = null) }
        if (!discover) return
        search = scope.launch {
            delay(350)
            try { val result = registry.search(query); update(epoch) { if (searchGeneration.get() == request) it.copy(searching = false, searchResults = result.packages, searchHasMore = result.hasMore) else it } }
            catch (cancel: CancellationException) { throw cancel }
            catch (error: Exception) { update(epoch) { if (searchGeneration.get() == request) it.copy(searching = false, error = (error as? GatewayFailure)?.code ?: "registry-network") else it } }
        }
    }
    @Synchronized fun pause() { generation.incrementAndGet(); events?.cancel(); events = null; search?.cancel(); mutable.value = PluginState() }
    fun close() { pause(); scope.cancel() }
}
