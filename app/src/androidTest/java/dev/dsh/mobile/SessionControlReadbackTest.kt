package dev.dsh.mobile

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.*
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.channels.Channel
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.UUID

class SessionControlReadbackTest {
    private class Fixture : DeviceGateway {
        val frames = Channel<JsonObject>(Channel.UNLIMITED)
        val writes = java.util.concurrent.CopyOnWriteArrayList<String>()
        var value = "workspace-write"; var seq = -1; var failSummary = false; var reads = 0
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow { emit(json("""{"type":"baseline","value":{"items":[]}}""")); awaitCancellation() }
        override fun follow(endpoint: String, args: JsonObject) = flow {
            if (endpoint == "session/follow") {
                emit(json("""{"type":"snapshot","header":{"id":"owned"},"cursor":-1,"records":[],"hasMore":false,"projections":{"asOfSeq":-1,"values":{"permissions":{"currentValue":"workspace-write"}}}}"""))
                for (frame in frames) emit(frame)
            } else if (endpoint == "\$events") { emit(json("""{"type":"ready","clientId":"fixture"}""")); awaitCancellation() }
            else { emit(json("""{"type":"baseline","value":{"projections":{}}}""")); awaitCancellation() }
        }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            if (mutation) writes += method
            return when (method) {
                "commands/execute" -> { value = "read-only"; seq = 6; json("""{"result":{"kind":"text","text":"preset read-only"}}""") }
                "session/projections" -> {
                    reads++; if (failSummary) throw GatewayFailure("network-unavailable")
                    assertEquals("owned", args.getValue("request").jsonObject.text("sessionId"))
                    buildJsonObject { put("asOfSeq", seq); put("values", buildJsonObject { put("permissions", buildJsonObject { put("currentValue", value) }) }) }

                }
                else -> JsonObject(emptyMap())
            }
        }
        private fun json(value: String) = WireJson.parseToJsonElement(value).jsonObject
    }
    private suspend fun exercise(block: suspend (Fixture, SessionRepository) -> Unit) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = scope) { File(context.cacheDir, "control-readback-${UUID.randomUUID()}.preferences_pb") })
        store.update { StoredDevices(listOf(DeviceCredential("a", "a", "https://a.example", "0".repeat(64), "a", "fixture-only", Long.MAX_VALUE))) }
        val gateway = Fixture(); val devices = DeviceRepository(store) { gateway }
        try {
            withTimeout(10_000) { devices.state.first { it.loaded } }; devices.select("a"); withTimeout(10_000) { devices.state.first { it.connected } }
            val session = devices.conversations(); session.open("owned"); withTimeout(10_000) { session.state.first { it.connected } }; block(gateway, session)
        } finally { devices.close(); scope.cancel() }
    }
    @Test fun acknowledgedCommandReadsOfficialSummaryWhenControlStreamIsSilent() = runBlocking { exercise { gateway, session ->
        session.command("/permission read-only")
        assertEquals("read-only", session.state.value.projections.getValue("permissions").jsonObject.text("currentValue"))
        assertEquals(6L, session.state.value.projectionSeq); assertFalse(session.state.value.projectionRefreshFailed)
        assertEquals(listOf("commands/execute"), gateway.writes.toList()); assertEquals(1, gateway.reads)
    } }
    @Test fun failedReadbackDoesNotTurnAcknowledgmentIntoUnknownOrReplay() = runBlocking { exercise { gateway, session ->
        gateway.failSummary = true; session.command("/permission read-only")
        assertEquals("preset read-only", session.state.value.commandMessage); assertNull(session.state.value.error)
        assertFalse(session.state.value.controlsBusy); assertTrue(session.state.value.projectionRefreshFailed)
        assertEquals(listOf("commands/execute"), gateway.writes.toList()); assertEquals(1, gateway.reads)
    } }
    @Test fun desktopPermissionEventRefreshesWithoutSendingAMutation() = runBlocking { exercise { gateway, session ->
        gateway.value = "read-only"; gateway.seq = 0
        gateway.frames.send(WireJson.parseToJsonElement("""{"type":"event","event":{"type":"permission/preset","seq":0,"data":{"value":"read-only"}}}""").jsonObject)
        withTimeout(10_000) { session.state.first { (it.projections["permissions"] as? JsonObject)?.text("currentValue") == "read-only" } }
        assertEquals(1, gateway.reads); assertTrue(gateway.writes.isEmpty())
    } }
}
