package dev.dsh.mobile

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.*
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.UUID

/** Controlled fault tests complement actual Desktop tests; no real profile is modified. */
class PluginSafetyTest {
    private class Fake : DeviceGateway {
        val writes = java.util.concurrent.CopyOnWriteArrayList<Pair<String, JsonObject>>()
        val started = CompletableDeferred<Unit>(); val release = CompletableDeferred<Unit>()
        var holdToggle = false; var loseInstallResult = false
        @Volatile var ownedEnabled = true
        val eventStarts = java.util.concurrent.atomic.AtomicInteger()
        val eventDisconnect = kotlinx.coroutines.channels.Channel<Unit>(kotlinx.coroutines.channels.Channel.UNLIMITED)
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow { emit(buildJsonObject { put("type", "baseline"); put("value", buildJsonObject { put("items", JsonArray(emptyList())) }) }); awaitCancellation() }
        override fun follow(endpoint: String, args: JsonObject) = flow {
            eventStarts.incrementAndGet(); emit(buildJsonObject { put("type", "ready"); put("clientId", "fake-client") })
            eventDisconnect.receive(); throw GatewayFailure("controlled-events-disconnect")
        }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            if (mutation) writes += method to args
            return when (method) {
                "pluginManager/listPlugins" -> buildJsonArray {
                    add(buildJsonObject { put("entryId", "protected"); put("moduleName", "core"); put("enabled", true); put("readOnlyReason", "management-required") })
                    add(buildJsonObject { put("entryId", "owned"); put("moduleName", "owned-fixture"); put("enabled", ownedEnabled); put("patchId", "owned-patch") })
                }
                "pluginManager/listBundles" -> JsonArray(emptyList())
                "pluginManager/setPluginEnabled" -> {
                    if (holdToggle) { started.complete(Unit); withContext(NonCancellable) { release.await() } }
                    buildJsonObject { put("application", "restart-required"); put("changed", true) }
                }
                "pluginManager/inspect" -> buildJsonObject { put("status", "accepted"); put("bundle", true); put("name", "owned-bundle") }
                "pluginManager/installBundle" -> {
                    if (loseInstallResult) throw GatewayFailure("result-unknown")
                    buildJsonObject { put("application", "applied"); put("changed", true) }
                }
                "pluginManager/waitForInstall" -> JsonNull
                "pluginManager/cancelInstall" -> buildJsonObject { put("status", "cancelled") }
                else -> throw GatewayFailure("unexpected-method")
            }
        }
    }
    private suspend fun setup(block: suspend CoroutineScope.(DeviceStore, DeviceRepository, PluginRepository, Fake, Fake) -> Unit) = coroutineScope {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val storageScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val file = File(context.cacheDir, "plugin-safety-${UUID.randomUUID()}.preferences_pb")
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = storageScope) { file })
        store.update { StoredDevices(listOf("a", "b").map { DeviceCredential(it, it, "https://$it.example", "0".repeat(64), it, "test-only", Long.MAX_VALUE) }) }
        val a = Fake(); val b = Fake(); val devices = DeviceRepository(store) { if (it.id == "a") a else b }; val plugins = devices.plugins()
        try {
            withTimeout(5_000) { devices.state.first { it.loaded } }; devices.select("a")
            withTimeout(5_000) { devices.state.first { it.connected } }; plugins.open()
            withTimeout(5_000) { plugins.state.first { !it.loading && it.plugins.size == 2 } }
            block(store, devices, plugins, a, b)
        } finally { a.release.complete(Unit); b.release.complete(Unit); devices.close(); storageScope.cancel() }
    }
    @Test fun reconnectRefreshesPluginChangesMissedDuringEventsOutage() = runBlocking { setup { _, _, plugins, a, _ ->
        withTimeout(5_000) { while (a.eventStarts.get() < 1) delay(10) }
        assertTrue(plugins.state.value.plugins.first { it.jsonObject.text("entryId") == "owned" }.jsonObject.getValue("enabled").jsonPrimitive.boolean)
        val previous = a.eventStarts.get()
        a.ownedEnabled = false
        a.eventDisconnect.send(Unit)
        withTimeout(10_000) { while (a.eventStarts.get() <= previous) delay(10) }
        withTimeout(5_000) { plugins.state.first { state -> state.plugins.any { it.jsonObject.text("entryId") == "owned" && it.jsonObject["enabled"]?.jsonPrimitive?.booleanOrNull == false } } }
        assertTrue(a.writes.isEmpty())
    } }
    @Test fun protectedRowsNeverMutateAndRestartRequiredIsPreserved() = runBlocking { setup { _, _, plugins, a, _ ->
        try { plugins.enable("protected", false, false); fail("protected mutation admitted") } catch (e: GatewayFailure) { assertEquals("plugin-protected", e.code) }
        assertTrue(a.writes.isEmpty()); plugins.enable("owned", false, false)
        assertEquals("restart-required", plugins.state.value.result?.text("application"))
        assertEquals("owned", a.writes.single().second.string("id"))
    } }
    @Test fun queuedToggleStaysBoundToOriginalDevice() = runBlocking { setup { _, devices, plugins, a, b ->
        a.holdToggle = true
        val first = async { plugins.enable("owned", false, false) }; withTimeout(5_000) { a.started.await() }
        val queued = async(start = CoroutineStart.UNDISPATCHED) { try { plugins.enable("owned", true, false); "executed" } catch (e: GatewayFailure) { e.code } }
        devices.select("b"); withTimeout(5_000) { devices.state.first { it.connected && it.selectedId == "b" } }
        plugins.open(); withTimeout(5_000) { plugins.state.first { it.deviceId == "b" && !it.loading && it.plugins.size == 2 } }
        a.release.complete(Unit); first.await()
        assertEquals("device-changed", queued.await()); assertEquals(1, a.writes.size); assertTrue(b.writes.isEmpty()); assertNull(plugins.state.value.result)
    } }
    @Test fun lostInstallResultSurvivesReopenAndIsNeverReplayed() = runBlocking { setup { store, _, plugins, a, _ ->
        a.loseInstallResult = true; plugins.inspect("owned-bundle@1")
        try { plugins.install("owned-bundle@1", false); fail("missing result accepted") } catch (e: GatewayFailure) { assertEquals("result-unknown", e.code) }
        val pending = store.read().pluginInstalls.single(); assertEquals("a", pending.deviceId)
        plugins.pause(); plugins.open(); withTimeout(5_000) { plugins.state.first { it.install?.requestId == pending.requestId && !it.loading } }
        try { plugins.reconcileInstall(); fail("null result treated as success") } catch (e: GatewayFailure) { assertEquals("install-result-unknown", e.code) }
        assertEquals(pending, store.read().pluginInstalls.single())
        assertEquals(1, a.writes.count { it.first == "pluginManager/installBundle" })
        plugins.cancelInstall(); assertTrue(store.read().pluginInstalls.isEmpty()); assertEquals("cancelled", plugins.state.value.result?.text("application"))
    } }
    @Test fun switchingRegistryRequiresReinspectionAndPendingWriteRetainsSource() = runBlocking { setup { store, _, plugins, a, _ ->
        val npm = JsonPrimitive(PLUGIN_NPM); val mirror = JsonPrimitive(PLUGIN_MIRROR)
        plugins.inspect("owned-bundle@1", source = npm)
        try { plugins.install("owned-bundle@1", true, source = mirror); fail("Inspection reused across sources") }
        catch (error: GatewayFailure) { assertEquals("plugin-inspection-required", error.code) }
        assertTrue(a.writes.isEmpty())
        a.loseInstallResult = true
        try { plugins.install("owned-bundle@1", true, source = npm); fail("Missing result accepted") }
        catch (error: GatewayFailure) { assertEquals("result-unknown", error.code) }
        val pending = store.read().pluginInstalls.single()
        assertEquals(npm, pending.registry)
        assertEquals(npm, a.writes.single().second["options"]!!.jsonObject["registry"])
        plugins.pause(); plugins.open()
        withTimeout(5000) { plugins.state.first { !it.loading && it.install?.requestId == pending.requestId } }
        assertEquals(npm, plugins.state.value.install!!.registry)
        assertEquals(1, a.writes.size)
        plugins.invalidateInspection()
        assertNull(plugins.state.value.inspection)
    } }
    @Test fun staleToggleCallbackCannotAffectNewDeviceWithSamePluginEntryId() = runBlocking { setup { _, devices, plugins, a, b ->
        devices.select("b"); withTimeout(5_000) { devices.state.first { it.connected && it.selectedId == "b" } }; plugins.open()
        withTimeout(5_000) { plugins.state.first { it.deviceId == "b" && !it.loading && it.plugins.size == 2 } }
        try { plugins.enable("owned", false, false, "a"); fail("stale UI callback admitted") } catch (e: GatewayFailure) { assertEquals("device-changed", e.code) }
        assertTrue(a.writes.isEmpty()); assertTrue(b.writes.isEmpty())
    } }
}
