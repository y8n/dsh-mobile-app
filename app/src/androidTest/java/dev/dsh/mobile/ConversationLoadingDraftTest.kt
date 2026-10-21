package dev.dsh.mobile

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.protocol.*
import dev.dsh.mobile.ui.LiveConversation
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.UUID

/** Controlled slow reconnect through the production editor and encrypted store. */
class ConversationLoadingDraftTest {
    @get:Rule val compose = createComposeRule()
    private class SlowGateway : DeviceGateway {
        var hold = false
        val release = CompletableDeferred<Unit>()
        override suspend fun probe() = Unit
        override fun close() = Unit
        override fun followWorkspaces() = flow {
            emit(WireJson.parseToJsonElement("""{"type":"baseline","value":{"items":[]}}""").jsonObject)
            awaitCancellation()
        }
        override fun follow(endpoint: String, args: JsonObject) = flow {
            if (endpoint == "session/follow") {
                if (hold) release.await()
                emit(WireJson.parseToJsonElement("""{"type":"snapshot","header":{"id":"owned"},"cursor":-1,"records":[],"hasMore":false,"projections":{"asOfSeq":-1,"values":{}}}""").jsonObject)
            } else emit(WireJson.parseToJsonElement("""{"type":"baseline","value":{"projections":{}}}""").jsonObject)
            awaitCancellation()
        }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            assertFalse("Typing must never submit a mutation", mutation)
            return when (method) {
                "commands/list" -> JsonArray(emptyList())
                "permissionPresets/catalog" -> buildJsonObject { put("options", JsonArray(emptyList())) }
                else -> JsonObject(emptyMap())
            }
        }
    }
    @Test fun visibleLoadingEditorPersistsTypingWithoutLosingPreDisconnectDraft() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val normal = DeviceStore(context).read()
        val storageScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val file = File(context.cacheDir, "loading-draft-${UUID.randomUUID()}.preferences_pb")
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = storageScope) { file })
        store.update { StoredDevices(listOf(DeviceCredential("owned", "Owned", "https://owned.example", "0".repeat(64), "fixture", "fixture", Long.MAX_VALUE))) }
        val gateway = SlowGateway(); val devices = DeviceRepository(store) { gateway }; val session = devices.conversations()
        try {
            withTimeout(10_000) { devices.state.first { it.loaded } }; devices.select("owned")
            withTimeout(10_000) { devices.state.first { it.connected } }
            compose.setContent { DshTheme { LiveConversation("owned", session, "Owned", {}) } }
            compose.waitUntil(10_000) { session.state.value.connected }
            compose.onNodeWithTag("composer_input").performTextInput("retained before disconnect")
            gateway.hold = true; devices.pause()
            compose.waitUntil(10_000) { compose.onAllNodesWithTag("conversation_reconnecting").fetchSemanticsNodes().isNotEmpty() }
            assertEquals("retained before disconnect", session.state.value.draft)
            assertTrue(session.state.value.initialLoaded)
            compose.onNodeWithTag("conversation_initial_loading").assertDoesNotExist()
            devices.resume()
            compose.waitUntil(10_000) { !session.state.value.loading && !session.state.value.connected }
            compose.onNodeWithTag("composer_input").assertIsDisplayed().performTextReplacement("local draft typed while reconnecting")
            withTimeout(10_000) { while (store.read().drafts.singleOrNull()?.text != "local draft typed while reconnecting") delay(25) }
            assertFalse(session.state.value.connected)
            gateway.release.complete(Unit)
            compose.waitUntil(10_000) { session.state.value.connected }
            compose.onNodeWithTag("composer_input").assertTextContains("local draft typed while reconnecting")
            assertEquals(normal, DeviceStore(context).read())
        } finally {
            gateway.release.complete(Unit); devices.close()
            storageScope.coroutineContext[Job]?.cancelAndJoin(); file.delete()
        }
    }
}
