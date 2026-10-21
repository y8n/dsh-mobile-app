package dev.dsh.mobile.data

import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.*
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

data class DeviceConnectionRow(val id: String, val name: String, val origin: String)
data class DeviceRow(val id: String, val name: String, val origin: String, val status: String = "checking",
    val connections: List<DeviceConnectionRow> = emptyList(), val connectionMode: String = "fixed", val preferredConnectionId: String? = null)
data class DeviceState(val loaded: Boolean = false, val devices: List<DeviceRow> = emptyList(), val defaultId: String? = null,
    val selectedId: String? = null, val snapshot: WorkspaceSnapshot? = null, val selectedWorkspace: Workspace? = null,
    val sessions: List<SessionSummary> = emptyList(), val directory: DirectoryListing? = null,
    val busy: Boolean = false, val connected: Boolean = false, val error: String? = null,
    val activeSessionId: String? = null, val startupReady: Boolean = false,
    val workspaceWrites: List<PendingWorkspaceMutation> = emptyList(),
    val sessionsLoading: Boolean = false, val localPinnedSessionIds: List<String> = emptyList(),
    val searchQuery: String = "", val searchMatches: Map<String, String>? = null, val searchHasMore: Boolean = false, val searching: Boolean = false,
    val searchResultLimit: Int = 20, val searchArchived: Boolean = false)

/** All UI results are guarded by the active device generation and operation identity. */
class DeviceRepository(private val storage: DeviceStore, private val localData: LocalDeviceDataRepository? = null,
    private val pairer: suspend (PairingInput, String, Boolean, String?) -> DeviceCredential = { input, name, lan, ca -> GatewayClient.pair(input, name, lan, ca) },
    private val gatewayFactory: (DeviceCredential) -> DeviceGateway = { deviceGateway(it) }) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mutable = MutableStateFlow(DeviceState())
    val state = mutable.asStateFlow()
    private var searchJob: Job? = null
    private val searchGeneration = AtomicLong()
    @Volatile private var stored = StoredDevices()
    private val clients = ConcurrentHashMap<String, DeviceGateway>()
    private val generation = AtomicLong()
    private val directoryGeneration = AtomicLong()
    private val sessionGeneration = AtomicLong()
    private val sessionReader = WorkspaceSessionReader()
    private val operations = Mutex()
    private val storageUpdates = Mutex()
    private suspend fun updateStored(transform: (StoredDevices) -> StoredDevices): StoredDevices = storageUpdates.withLock {
        storage.update(transform).also { stored = it }
    }
    private var workspaceJob: Job? = null
    private var probeJob: Job? = null
    @Volatile private var foreground = false
    private var startupChecked = false
    init { localData?.let { local -> scope.launch { local.state.collect { data -> mutable.update { it.copy(localPinnedSessionIds = data.pins[it.selectedId].orEmpty()) } } } }; scope.launch {
        try {
            stored = storage.read()
            publishStored()
            mutable.update { it.copy(loaded = true) }
            if (foreground) resume()
        } catch (error: GatewayFailure) { mutable.update { it.copy(loaded = true, error = error.code) } }
    } }
    private fun publishStored() {
        localData?.retainDevices(stored.devices.map { it.id }.toSet())
        mutable.update { old -> old.copy(devices = stored.devices.map { credential ->
            DeviceRow(credential.id, credential.name, credential.origin, old.devices.find { it.id == credential.id }?.status ?: "checking",
                credential.connectionOptions().map { DeviceConnectionRow(it.id, it.name, it.origin) }, credential.connectionMode, credential.preferredConnectionId)
        }, defaultId = stored.defaultId, workspaceWrites = stored.workspaceWrites) }
    }
    private fun client(id: String): DeviceGateway = clients.getOrPut(id) {
        gatewayFactory(stored.devices.find { it.id == id } ?: throw GatewayFailure("device-not-found"))
    }
    @Synchronized fun resume() {
        foreground = true
        if (!mutable.value.loaded) return
        probeJob?.cancel()
        probeJob = scope.launch { while (isActive) { refreshDevices(); delay(30_000) } }
        if (!startupChecked) {
            startupChecked = true
            stored.defaultId?.let { select(it); mutable.update { current -> current.copy(startupReady = true) } }
            return
        }
        mutable.value.selectedId?.let { select(it) }
    }
    @Synchronized fun pause() { foreground = false; probeJob?.cancel(); workspaceJob?.cancel(); generation.incrementAndGet(); mutable.update { it.copy(connected = false) } }
    @Synchronized fun reconnect() { if (foreground) mutable.value.selectedId?.let { select(it) } }
    private suspend fun refreshDevices() = coroutineScope {
        stored.devices.forEach { device -> launch {
            val status = try { client(device.id).probe(); "online" } catch (error: GatewayFailure) { error.code }
            mutable.update { it.copy(devices = it.devices.map { row -> if (row.id == device.id) row.copy(status = status) else row }) }
        } }
    }
    suspend fun pair(address: String, key: String, name: String, lan: Boolean): String = operations.withLock {
        if (mutable.value.error == "storage-unavailable") throw GatewayFailure("storage-unavailable")
        mutable.update { it.copy(busy = true, error = null) }
        try {
            val input = PairingInput.parse(address, key)
            val old = stored.devices.find { it.origin == input.origin }
            if (old != null && old.instanceId != input.instanceId) throw GatewayFailure("instance-changed")
            if (old == null && stored.devices.any { it.instanceId == input.instanceId }) throw GatewayFailure("device-already-paired")
            val credential = pairer(input, name, lan, old?.caDer).let { if (old == null) it else it.copy(id = old.id) }
            updateStored { prefs -> prefs.copy(devices = if (old == null) prefs.devices + credential else prefs.devices.map { if (it.id == credential.id) credential.copy(connections = old.connections.map { route -> if (route.origin == credential.origin) route.copy(deviceId = credential.deviceId, deviceToken = credential.deviceToken, deviceExpiresAt = credential.deviceExpiresAt, caDer = credential.caDer) else route }, connectionMode = old.connectionMode, preferredConnectionId = old.preferredConnectionId) else it }, defaultId = prefs.defaultId ?: credential.id) }
            publishStored(); retireGateway(clients.remove(credential.id)); select(credential.id)
            return@withLock credential.id
        } catch (error: GatewayFailure) { mutable.update { it.copy(error = error.code) }; throw error }
        finally { mutable.update { it.copy(busy = false) } }
    }
    @Synchronized fun select(id: String) { selectWithSnapshot(id, null) }
    @Synchronized private fun selectWithSnapshot(id: String, confirmed: WorkspaceSnapshot?) {
        if (stored.devices.none { it.id == id }) return
        sessionGeneration.incrementAndGet()
        searchJob?.cancel(); searchGeneration.incrementAndGet()
        val epoch = generation.incrementAndGet()
        workspaceJob?.cancel()
        val sameDevice = mutable.value.selectedId == id
        mutable.update { it.copy(selectedId = id, snapshot = confirmed.takeIf { sameDevice }, selectedWorkspace = if (sameDevice) it.selectedWorkspace else null,
            sessions = if (sameDevice) it.sessions else emptyList(), directory = null, activeSessionId = if (sameDevice) it.activeSessionId else null,
            connected = confirmed != null && sameDevice, error = null, busy = false, searchQuery = "", searchMatches = null, searchHasMore = false, searching = false, sessionsLoading = false, localPinnedSessionIds = localData?.state?.value?.pins?.get(id).orEmpty()) }
        workspaceJob = scope.launch {
            var retry = 0
            while (isActive && generation.get() == epoch) {
                try {
                    var baseline: WorkspaceSnapshot? = null
                    client(id).followWorkspaces().collect { frame ->
                        baseline = reduceWorkspaces(baseline, frame)
                        if (generation.get() == epoch) {
                            val snap = baseline!!
                            val previousState = mutable.value
                            val previous = previousState.selectedWorkspace
                            mutable.update { current ->
                                if (generation.get() != epoch || current.selectedId != id) return@update current
                                val selected = current.selectedWorkspace?.let { selected -> snap.items.find { it.workspaceId == selected.workspaceId } }
                                current.copy(snapshot = snap, connected = true, error = null, selectedWorkspace = selected, sessionsLoading = if (selected == null) false else current.sessionsLoading,
                                    sessions = if (selected == null) emptyList() else current.sessions.filter { it.sessionId in selected.sessionIds },
                                    activeSessionId = current.activeSessionId?.takeIf { active -> selected != null && active in selected.sessionIds && active !in snap.archivedSessionIds })
                            }
                            val selected = mutable.value.selectedWorkspace
                            if (selected != null && (frame.string("type") == "baseline" || selected.sessionIds != previous?.sessionIds)) loadSessions(id, epoch, selected)
                            refreshSearchAfterSnapshot(epoch, previousState, frame.string("type") == "baseline")
                            scope.launch { localData?.prune(id, snap.items.flatMap { it.sessionIds }.toSet() - snap.archivedSessionIds.toSet()) { generation.get() == epoch && mutable.value.snapshot === snap } }
                            retry = 0
                        }
                    }
                } catch (cancel: CancellationException) { throw cancel }
                catch (error: Exception) {
                    if (generation.get() == epoch) mutable.update { it.copy(connected = false, error = (error as? GatewayFailure)?.code ?: "invalid-response", startupReady = it.startupReady) }
                    if ((error as? GatewayFailure)?.code in listOf("device-revoked", "certificate-failed", "instance-changed")) break
                    delay((1_000L shl retry.coerceAtMost(4)).coerceAtMost(15_000)); retry++
                }
            }
        }
    }
    private val conversationRepository = lazy { SessionRepository(this, storage) }
    fun conversations(): SessionRepository = conversationRepository.value
    private val pluginRepository = lazy { PluginRepository(this, storage) }
    fun plugins(): PluginRepository = pluginRepository.value
    private val scheduleRepository = lazy { ScheduleRepository(this, storage) }
    fun schedules(): ScheduleRepository = scheduleRepository.value
    fun selectedConnection(): Pair<String, DeviceGateway>? = mutable.value.selectedId?.let { it to client(it) }
    fun clearStartup() { mutable.update { it.copy(startupReady = false) } }
    @Synchronized fun openWorkspace(workspace: Workspace) {
        searchJob?.cancel(); searchGeneration.incrementAndGet()
        val epoch = generation.get(); val id = mutable.value.selectedId ?: return
        mutable.update { it.copy(selectedWorkspace = workspace, sessions = emptyList(), sessionsLoading = true, error = null, activeSessionId = null, searchQuery = "", searchMatches = null, searchHasMore = false, searching = false) }
        scope.launch {
            try {
                updateStored { it.copy(recentDeviceId = id, recentWorkspaceId = workspace.workspaceId) }
                loadSessions(id, epoch, workspace)
            } catch (error: GatewayFailure) { if (generation.get() == epoch && mutable.value.selectedWorkspace?.workspaceId == workspace.workspaceId) mutable.update { it.copy(sessionsLoading = false, error = error.code) } }
        }
    }
    @Synchronized private fun loadSessions(id: String, epoch: Long, workspace: Workspace) {
        if (generation.get() != epoch || mutable.value.selectedId != id || mutable.value.selectedWorkspace?.workspaceId != workspace.workspaceId) return
        val request = sessionGeneration.incrementAndGet()
        mutable.update { if (generation.get() == epoch && it.selectedWorkspace?.workspaceId == workspace.workspaceId) it.copy(sessionsLoading = true) else it }
        scope.launch {
        try {
            val sessions = sessionReader.read(id, client(id), workspace)
            if (generation.get() == epoch && sessionGeneration.get() == request && mutable.value.selectedWorkspace?.workspaceId == workspace.workspaceId) mutable.update { current ->
                current.copy(sessionsLoading = false, sessions = sessions.filter { it.sessionId in current.selectedWorkspace?.sessionIds.orEmpty() })
            }
        } catch (cancel: CancellationException) { throw cancel }
        catch (error: Exception) { if (generation.get() == epoch && sessionGeneration.get() == request && mutable.value.selectedWorkspace?.workspaceId == workspace.workspaceId) mutable.update { it.copy(sessionsLoading = false, error = (error as? GatewayFailure)?.code ?: "invalid-response") } }
        }
    }
    private suspend fun pendingSession(id: String, workspaceId: String): String {
        stored.pendingSessions.find { it.deviceId == id && it.workspaceId == workspaceId }?.let { return it.sessionId }
        val pending = PendingSession(id, workspaceId, "session-${UUID.randomUUID()}")
        updateStored { it.copy(pendingSessions = it.pendingSessions.filterNot { p -> p.deviceId == id && p.workspaceId == workspaceId } + pending) }
        return pending.sessionId
    }
    private suspend fun sessionConfirmed(id: String, workspaceId: String) {
        updateStored { it.copy(pendingSessions = it.pendingSessions.filterNot { p -> p.deviceId == id && p.workspaceId == workspaceId }) }
    }
    private suspend fun workspaceBaseline(api: DeviceGateway): WorkspaceSnapshot = withTimeoutOrNull(60_000) {
        val frame = api.followWorkspaces().first { it.string("type") == "baseline" }
        wireValue { WireJson.decodeFromJsonElement<WorkspaceSnapshot>(frame.getValue("value")) }
    } ?: throw GatewayFailure("network-unavailable")
    @Synchronized private fun publishCreatedSession(id: String, epoch: Long, sessionId: String, workspace: Workspace? = null) {
        if (generation.get() != epoch || mutable.value.selectedId != id) throw GatewayFailure("device-changed")
        mutable.update { it.copy(selectedWorkspace = workspace ?: it.selectedWorkspace, activeSessionId = sessionId) }
    }
    fun browse(path: String? = null) {
        val epoch = generation.get(); val request = directoryGeneration.incrementAndGet(); val id = mutable.value.selectedId ?: return
        mutable.update { it.copy(directory = null, error = null) }
        scope.launch {
            try {
                val args = buildJsonObject { path?.let { put("path", it) } }
                val listing = WireJson.decodeFromJsonElement<DirectoryListing>(client(id).rpc("directoryPicker/list", args))
                if (generation.get() == epoch && directoryGeneration.get() == request) mutable.update { it.copy(directory = listing) }
            } catch (cancel: CancellationException) { throw cancel }
            catch (error: Exception) { if (generation.get() == epoch && directoryGeneration.get() == request) mutable.update { it.copy(error = (error as? GatewayFailure)?.code ?: "invalid-response") } }
        }
    }
    suspend fun createWorkspace(name: String, path: String): String = operations.withLock {
        val epoch = generation.get(); val id = mutable.value.selectedId ?: throw GatewayFailure("device-not-found")
        if (!mutable.value.connected) throw GatewayFailure("connection-required")
        mutable.update { it.copy(busy = true, error = null) }
        try {
            val api = client(id)
            val pending = stored.pendingWorkspaces.find { it.deviceId == id && it.path == path }
            val baseline = workspaceBaseline(api)
            if (generation.get() != epoch) throw GatewayFailure("device-changed")
            var workspace = if (pending != null) {
                // An earlier request may have committed despite a lost response or process death.
                // Reconcile by its reserved path/confirmed identity; absence does not permit replay.
                baseline.items.find { it.path == path && (pending.workspaceId == null || it.workspaceId == pending.workspaceId) }
                    ?: throw GatewayFailure("result-unknown")
            } else {
                if (baseline.items.any { it.path == path }) throw GatewayFailure("workspace/already-registered")
                updateStored { it.copy(pendingWorkspaces = it.pendingWorkspaces + PendingWorkspace(id, path)) }
                val result = try {
                    wireValue { api.rpc("workspace/create", argsRequest("path" to JsonPrimitive(path)), mutation = true).jsonObject }
                } catch (error: GatewayFailure) {
                    if (error.code !in listOf("result-unknown", "network-unavailable", "invalid-response")) {
                        updateStored { it.copy(pendingWorkspaces = it.pendingWorkspaces.filterNot { p -> p.deviceId == id && p.path == path }) }
                    }
                    throw error
                }
                val created = wireValue { WireJson.decodeFromJsonElement<Workspace>(result.getValue("workspace")) }
                if (!wireValue { result.getValue("created").jsonPrimitive.boolean }) {
                    // A concurrent registration is not permission to rename somebody else's workspace.
                    updateStored { it.copy(pendingWorkspaces = it.pendingWorkspaces.filterNot { p -> p.deviceId == id && p.path == path }) }
                    throw GatewayFailure("workspace/already-registered")
                }
                if (created.path != path) throw GatewayFailure("invalid-response")
                created
            }
            updateStored { it.copy(pendingWorkspaces = it.pendingWorkspaces.map { p -> if (p.deviceId == id && p.path == path) p.copy(workspaceId = workspace.workspaceId) else p }) }
            if (generation.get() != epoch) throw GatewayFailure("device-changed")
            if (workspace.title != name.trim()) workspace = WireJson.decodeFromJsonElement<Workspace>(api.rpc("workspace/rename", argsRequest("workspaceId" to JsonPrimitive(workspace.workspaceId), "title" to JsonPrimitive(name.trim())), mutation = true).jsonObject.getValue("workspace"))
            if (generation.get() != epoch) throw GatewayFailure("device-changed")
            val sessionId = pendingSession(id, workspace.workspaceId)
            val result = api.rpc("session/create", argsRequest("workspaceId" to JsonPrimitive(workspace.workspaceId), "sessionId" to JsonPrimitive(sessionId)), mutation = true).jsonObject
            if (generation.get() != epoch) throw GatewayFailure("device-changed")
            updateStored { it.copy(recentDeviceId = id, recentWorkspaceId = workspace.workspaceId,
                pendingSessions = it.pendingSessions.filterNot { p -> p.deviceId == id && p.workspaceId == workspace.workspaceId },
                pendingWorkspaces = it.pendingWorkspaces.filterNot { p -> p.deviceId == id && p.path == path }) }
            workspace = mutable.value.snapshot?.items?.find { it.workspaceId == workspace.workspaceId } ?: workspace.copy(sessionIds = (workspace.sessionIds + sessionId).distinct())
            publishCreatedSession(id, epoch, result.string("sessionId"), workspace)
            loadSessions(id, epoch, workspace)
            return@withLock result.string("sessionId")
        } catch (cancel: CancellationException) { throw cancel }
        catch (error: Exception) { val failure = error as? GatewayFailure ?: GatewayFailure("invalid-response"); if (generation.get() == epoch) mutable.update { it.copy(error = failure.code) }; throw failure }
        finally { if (generation.get() == epoch) mutable.update { it.copy(busy = false) } }
    }
    suspend fun createSession(): String = operations.withLock {
        val epoch = generation.get(); val id = mutable.value.selectedId ?: throw GatewayFailure("device-not-found")
        val workspace = mutable.value.selectedWorkspace ?: throw GatewayFailure("workspace/not-found")
        if (!mutable.value.connected) throw GatewayFailure("connection-required")
        mutable.update { it.copy(busy = true, error = null) }
        try {
            val sessionId = pendingSession(id, workspace.workspaceId)
            val result = client(id).rpc("session/create", argsRequest("workspaceId" to JsonPrimitive(workspace.workspaceId), "sessionId" to JsonPrimitive(sessionId)), true).jsonObject
            if (generation.get() != epoch) throw GatewayFailure("device-changed")
            sessionConfirmed(id, workspace.workspaceId)
            publishCreatedSession(id, epoch, result.string("sessionId")); result.string("sessionId")
        } catch (cancel: CancellationException) { throw cancel }
        catch (error: Exception) { val failure = error as? GatewayFailure ?: GatewayFailure("invalid-response"); if (generation.get() == epoch) mutable.update { it.copy(error = failure.code) }; throw failure }
        finally { if (generation.get() == epoch) mutable.update { it.copy(busy = false) } }
    }
    fun openSession(sessionId: String) { mutable.update { it.copy(activeSessionId = sessionId) } }
    @Synchronized private fun refreshSearchAfterSnapshot(epoch: Long, previous: DeviceState, baseline: Boolean) {
        val current = mutable.value; val selected = current.selectedWorkspace ?: return; val old = previous.selectedWorkspace ?: return
        if (generation.get() != epoch || selected.workspaceId != old.workspaceId || current.searchQuery.isBlank()
            || current.searchQuery != previous.searchQuery || current.searchArchived != previous.searchArchived) return
        fun ids(workspace: Workspace, archivedIds: List<String>) = workspace.sessionIds.filter { (it in archivedIds) == current.searchArchived }.toSet()
        if (baseline || ids(selected, current.snapshot?.archivedSessionIds.orEmpty()) != ids(old, previous.snapshot?.archivedSessionIds.orEmpty())) searchSessions(current.searchQuery, current.searchArchived)
    }
    @Synchronized fun searchSessions(query: String, archived: Boolean = false) {
        searchJob?.cancel(); val request = searchGeneration.incrementAndGet()
        val epoch = generation.get(); val device = mutable.value.selectedId ?: return
        val workspace = mutable.value.selectedWorkspace?.workspaceId
        val normalized = query.trim()
        mutable.update { it.copy(searchQuery = query, searchMatches = if (normalized.isEmpty()) null else emptyMap(), searching = normalized.isNotEmpty(), searchHasMore = false, searchArchived = archived, error = null) }
        if (normalized.isEmpty()) return
        if (workspace == null) { mutable.update { it.copy(searching = false, error = "workspace/not-found") }; return }
        searchJob = scope.launch {
            delay(300)
            try {
                val result = client(device).rpc("mobileSearch/searchWorkspace", argsRequest("query" to JsonPrimitive(normalized), "workspaceId" to JsonPrimitive(workspace), "archived" to JsonPrimitive(archived))).jsonObject
                val limit = (result["limit"] as? JsonPrimitive)?.takeUnless { it.isString }?.intOrNull
                val hasMore = (result["hasMore"] as? JsonPrimitive)?.takeUnless { it.isString }?.booleanOrNull
                val resultArchived = (result["archived"] as? JsonPrimitive)?.takeUnless { it.isString }?.booleanOrNull
                if (result.text("workspaceId") != workspace || resultArchived != archived || limit == null || limit !in 1..20 || hasMore == null) throw GatewayFailure("invalid-response")
                val matches = result.getValue("items").jsonArray.associate { row -> row.jsonObject.string("sessionId") to row.jsonObject.string("snippet") }
                if (matches.size != result.getValue("items").jsonArray.size || matches.size > limit) throw GatewayFailure("invalid-response")
                mutable.update { if (generation.get() == epoch && searchGeneration.get() == request && it.selectedWorkspace?.workspaceId == workspace) it.copy(searchMatches = matches, searchHasMore = hasMore, searchResultLimit = limit, searching = false) else it }
            } catch (cancel: CancellationException) { throw cancel }
            catch (error: Exception) {
                val failure = error as? GatewayFailure
                val code = if (failure?.remoteMessage?.contains("openAt \"never\"") == true) "session/search-disabled" else failure?.code ?: "invalid-response"
                mutable.update { if (generation.get() == epoch && searchGeneration.get() == request) it.copy(searching = false, error = code) else it }
            }
        }
    }
    /** One durable intent; unknown results can only be reconciled by a read. */
    suspend fun manageWorkspace(deviceId: String, workspaceId: String, action: String, title: String? = null) = operations.withLock {
        val epoch = generation.get()
        fun checkTarget() {
            if (mutable.value.selectedId != deviceId || generation.get() != epoch) throw GatewayFailure("device-changed")
            if (!mutable.value.connected) throw GatewayFailure("connection-required")
        }
        checkTarget()
        val previous = stored.workspaceWrites.firstOrNull { it.deviceId == deviceId && it.workspaceId == workspaceId }
        if (previous != null && action != "sync") throw GatewayFailure("workspace-result-unknown")
        if (previous == null && action == "sync") return@withLock
        val intent = previous ?: run {
            if (action !in setOf("rename", "delete")) throw GatewayFailure("unsupported-operation")
            val workspace = mutable.value.snapshot?.items?.firstOrNull { it.workspaceId == workspaceId } ?: throw GatewayFailure("workspace/not-found")
            val trimmed = if (action == "rename") title?.trim()?.takeIf { it.isNotEmpty() } ?: throw GatewayFailure("invalid-title") else null
            if (trimmed != null && mutable.value.snapshot?.items?.any { it.workspaceId != workspaceId && it.title == trimmed } == true) throw GatewayFailure("workspace/name-conflict")
            if (action == "rename" && trimmed == workspace.title) return@withLock
            PendingWorkspaceMutation(deviceId, workspaceId, action, trimmed)
        }
        val api = client(deviceId)
        mutable.update { it.copy(busy = true, error = null) }
        try {
            if (previous == null) {
                updateStored { it.copy(workspaceWrites = it.workspaceWrites + intent) }; publishStored()
            }
            checkTarget()
            var acknowledged = false
            if (previous == null) {
                try {
                    val response = api.rpc("workspace/${intent.action}", argsRequest("workspaceId" to JsonPrimitive(workspaceId),
                        *if (intent.action == "rename") arrayOf("title" to JsonPrimitive(intent.title!!)) else emptyArray()), true).jsonObject
                    checkTarget()
                    if (intent.action == "delete") {
                        if (response["deleted"] != JsonPrimitive(true)) throw GatewayFailure("result-unknown")
                    } else {
                        val result = WireJson.decodeFromJsonElement<Workspace>(response.getValue("workspace"))
                        val original = mutable.value.snapshot?.items?.find { it.workspaceId == workspaceId }
                        if (result.workspaceId != workspaceId || result.title != intent.title || (original != null && result.path != original.path)) throw GatewayFailure("result-unknown")
                    }
                    acknowledged = true
                } catch (cancel: CancellationException) { throw cancel }
                catch (failure: Exception) {
                    val code = (failure as? GatewayFailure)?.code ?: "result-unknown"
                    if (code !in setOf("result-unknown", "network-unavailable", "invalid-response", "response-too-large", "session-expired", "connection-required", "device-changed")) {
                        updateStored { prefs -> prefs.copy(workspaceWrites = prefs.workspaceWrites - intent) }; publishStored()
                        throw failure
                    }
                }
            }
            checkTarget()
            val snapshot = try { withTimeout(8_000) { workspaceBaseline(api) } }
                catch (cancel: TimeoutCancellationException) { throw GatewayFailure("workspace-result-unknown") }
                catch (cancel: CancellationException) { throw cancel }
                catch (_: Exception) { throw GatewayFailure("workspace-result-unknown") }
            checkTarget()
            val actual = snapshot.items.firstOrNull { it.workspaceId == workspaceId }
            val matches = if (intent.action == "delete") actual == null else actual?.title == intent.title
            if (!matches && (!acknowledged || intent.action == "delete")) throw GatewayFailure("workspace-result-unknown")
            updateStored { prefs -> prefs.copy(workspaceWrites = prefs.workspaceWrites - intent,
                recentWorkspaceId = if (actual == null && prefs.recentDeviceId == deviceId && prefs.recentWorkspaceId == workspaceId) null else prefs.recentWorkspaceId,
                pendingSessions = if (actual == null) prefs.pendingSessions.filterNot { it.deviceId == deviceId && it.workspaceId == workspaceId } else prefs.pendingSessions,
                pendingWorkspaces = if (actual == null) prefs.pendingWorkspaces.filterNot { it.deviceId == deviceId && it.workspaceId == workspaceId } else prefs.pendingWorkspaces) }
            checkTarget(); publishStored()
            if (actual == null) { searchJob?.cancel(); searchGeneration.incrementAndGet(); sessionGeneration.incrementAndGet() }
            mutable.update { current ->
                val selected = current.selectedWorkspace?.let { old -> snapshot.items.find { it.workspaceId == old.workspaceId } }
                current.copy(snapshot = snapshot, selectedWorkspace = selected,
                    sessions = if (selected == null) emptyList() else current.sessions.filter { it.sessionId in selected.sessionIds },
                    sessionsLoading = if (selected == null) false else current.sessionsLoading,
                    activeSessionId = current.activeSessionId?.takeIf { it in selected?.sessionIds.orEmpty() },
                    searchMatches = if (selected == null) null else current.searchMatches, searching = false, searchHasMore = false)
            }
            // Discard queued pre-write frames while retaining the just-verified list.
            selectWithSnapshot(deviceId, snapshot)
        } finally { mutable.update { if (generation.get() == epoch) it.copy(busy = false) else it } }
    }

    suspend fun manageSession(sessionId: String, action: String, title: String? = null) = operations.withLock {
        val epoch = generation.get(); val device = mutable.value.selectedId ?: throw GatewayFailure("device-not-found")
        if (action in setOf("pin", "unpin")) {
            if (sessionId !in mutable.value.selectedWorkspace?.sessionIds.orEmpty()) throw GatewayFailure("session/not-found")
            val local = localData ?: throw GatewayFailure("storage-unavailable")
            local.pin(device, sessionId, action == "pin")
            if (generation.get() == epoch) mutable.update { it.copy(localPinnedSessionIds = local.state.value.pins[device].orEmpty()) }
            return@withLock
        }
        if (!mutable.value.connected) throw GatewayFailure("connection-required")
        if (sessionId !in mutable.value.selectedWorkspace?.sessionIds.orEmpty()) throw GatewayFailure("session/not-found")
        val method = when (action) {
            "rename" -> "session/rename"
            "archive", "archive-stop" -> "workspace/archiveSession"
            "restore" -> "workspace/unarchiveSession"
            else -> throw GatewayFailure("unsupported-operation")
        }
        mutable.update { if (generation.get() == epoch) it.copy(busy = true, error = null) else it }
        try {
            val request = buildJsonObject {
                put("sessionId", sessionId)
                if (action == "rename") put("title", title?.trim()?.takeIf { it.isNotEmpty() } ?: throw GatewayFailure("invalid-title"))
                if (action == "archive-stop") put("stopActivity", true)
            }
            client(device).rpc(method, buildJsonObject { put("request", request) }, true)
            if (generation.get() != epoch) throw GatewayFailure("device-changed")
            mutable.value.selectedWorkspace?.let { loadSessions(device, epoch, it) }
        } catch (error: GatewayFailure) { mutable.update { if (generation.get() == epoch) it.copy(error = error.code) else it }; throw error }
        finally { mutable.update { if (generation.get() == epoch) it.copy(busy = false) else it } }
    }
    fun setDefault(id: String) { scope.launch { try { updateStored { prefs -> if (prefs.devices.any { it.id == id }) prefs.copy(defaultId = id) else throw GatewayFailure("device-not-found") }; publishStored() } catch (error: GatewayFailure) { mutable.update { it.copy(error = error.code) } } } }
    suspend fun renameDevice(id: String, name: String) = operations.withLock {
        val title = name.trim().takeIf { it.isNotEmpty() && it.length <= 100 } ?: throw GatewayFailure("invalid-device-name")
        updateStored { prefs ->
            if (prefs.devices.none { it.id == id }) throw GatewayFailure("device-not-found")
            prefs.copy(devices = prefs.devices.map { if (it.id == id) it.copy(name = title) else it })
        }
        publishStored()
    }
    fun reportConnectionFailure() { mutable.update { if (it.error == null) it.copy(error = "connection-update-failed") else it } }
    suspend fun removeLocal(id: String) = operations.withLock {
        val selected = mutable.value.selectedId == id
        try {
            updateStored { current -> current.copy(devices = current.devices.filterNot { it.id == id }, defaultId = current.defaultId?.takeUnless { it == id },
                recentDeviceId = current.recentDeviceId?.takeUnless { it == id }, recentWorkspaceId = if (current.recentDeviceId == id) null else current.recentWorkspaceId,
                pendingSessions = current.pendingSessions.filterNot { it.deviceId == id }, drafts = current.drafts.filterNot { it.deviceId == id },
                pluginInstalls = current.pluginInstalls.filterNot { it.deviceId == id }, scheduleWrites = current.scheduleWrites.filterNot { it.deviceId == id },
                pendingWorkspaces = current.pendingWorkspaces.filterNot { it.deviceId == id }, workspaceWrites = current.workspaceWrites.filterNot { it.deviceId == id }) }
            if (selected) {
                generation.incrementAndGet(); workspaceJob?.cancel(); sessionGeneration.incrementAndGet()
                mutable.update { it.copy(selectedId = null, snapshot = null, selectedWorkspace = null, activeSessionId = null, sessions = emptyList(), sessionsLoading = false, localPinnedSessionIds = emptyList(), directory = null, connected = false) }
            }
            publishStored(); retireGateway(clients.remove(id))
            try { localData?.remove(id) } catch (_: Exception) { /* Credential removal is authoritative; queued retainDevices also prunes local data. */ }
            if (selected) stored.defaultId?.let { select(it) }
        } catch (error: GatewayFailure) { mutable.update { it.copy(error = error.code) }; throw error }
    }
    suspend fun configureConnections(id: String, preferred: String? = null, remove: String? = null) = operations.withLock {
        updateStored { prefs ->
            if (prefs.devices.none { it.id == id }) throw GatewayFailure("device-not-found")
            prefs.copy(devices = prefs.devices.map { device ->
            if (device.id != id) device else {
                val rows = device.connectionOptions().filterNot { it.id == remove }
                if (rows.isEmpty()) throw GatewayFailure("last-connection")
                if (preferred != null && rows.none { it.id == preferred } && preferred != remove) throw GatewayFailure("invalid-connection-settings")
                val first = rows.first()
                device.copy(origin = first.origin, deviceId = first.deviceId, deviceToken = first.deviceToken, deviceExpiresAt = first.deviceExpiresAt,
                    caDer = first.caDer, connections = rows, connectionMode = "fixed", preferredConnectionId = (preferred ?: device.preferredConnectionId)?.takeIf { key -> rows.any { it.id == key } } ?: first.id)
            }
        }) }
        publishStored(); retireGateway(clients.remove(id)); if (mutable.value.selectedId == id) select(id)
    }
    suspend fun pairConnection(id: String, address: String, key: String, name: String, lan: Boolean) = operations.withLock {
        mutable.update { it.copy(busy = true, error = null) }
        try {
            val device = stored.devices.singleOrNull { it.id == id } ?: throw GatewayFailure("device-not-found")
            val input = PairingInput.parse(address, key)
            if (input.instanceId != device.instanceId) throw GatewayFailure("connection-instance-mismatch")
            if (device.connectionOptions().size >= 8 && device.connectionOptions().none { it.origin == input.origin }) throw GatewayFailure("connection-limit")
            val old = device.connectionOptions().firstOrNull { it.origin == input.origin }
            val paired = pairer(input, name, lan, old?.caDer)
            if (paired.instanceId != device.instanceId) throw GatewayFailure("connection-instance-mismatch")
            val connection = DeviceConnection(old?.id ?: UUID.randomUUID().toString(), name.trim().ifBlank { if (lan) "局域网" else "隧道" }, paired.origin, paired.instanceId, paired.deviceId, paired.deviceToken, paired.deviceExpiresAt, paired.caDer)
            updateStored { prefs -> prefs.copy(devices = prefs.devices.map { current -> if (current.id != id) current else current.copy(connections = current.connectionOptions().map { if (it.id == connection.id) connection else it }.let { if (old == null) it + connection else it }) }) }
            publishStored(); retireGateway(clients.remove(id)); if (mutable.value.selectedId == id) select(id)
        } catch (cancel: CancellationException) { throw cancel }
        catch (error: Exception) {
            val failure = error as? GatewayFailure ?: GatewayFailure("connection-update-failed")
            mutable.update { it.copy(error = failure.code) }; throw failure
        }
        finally { mutable.update { it.copy(busy = false) } }
    }
    fun close() {
        if (conversationRepository.isInitialized()) conversationRepository.value.close()
        if (pluginRepository.isInitialized()) pluginRepository.value.close()
        if (scheduleRepository.isInitialized()) scheduleRepository.value.close()
        scope.cancel()
        val retired = clients.values.toList(); clients.clear()
        // Shutdown can be requested by ViewModel.onCleared on the main thread.
        scope.launch(NonCancellable + Dispatchers.IO) { retired.forEach { retireGateway(it) } }
    }
}
