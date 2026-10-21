package dev.dsh.mobile

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import dev.dsh.mobile.ui.LiveGraph
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.flow.first
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import org.json.JSONObject

/** Explicit readiness check of the normal encrypted vault and existing tunnel.
 * The dedicated runner flag keeps this out of general CI/regression runs.
 */
class PreflightConnectionTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    @Test fun existingPairedDesktopReconnectsInNativeUi() = runBlocking {
        val instrumentation = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
        assumeTrue("Only explicit preflight runs use the saved interactive pairing",
            androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("preflight") == "true")
        val context = instrumentation.targetContext
        val repo = LiveGraph.repository(context)
        withTimeout(10_000) { repo.state.first { it.loaded } }
        assertTrue("Saved interactive Desktop pairing is required", repo.state.value.devices.isNotEmpty())
        val device = repo.state.value.devices.firstOrNull { it.id == repo.state.value.defaultId } ?: repo.state.value.devices.first()
        compose.waitUntil(10_000) { compose.onAllNodesWithText(device.name).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText(device.name).performClick()
        val connected = withTimeout(90_000) { repo.state.first { it.connected && it.snapshot != null } }
        connected.snapshot!!.items.firstOrNull()?.let { workspace ->
            compose.waitUntil(10_000) { compose.onAllNodesWithText(workspace.title).fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithText(workspace.title).assertIsDisplayed()
        }
        File(context.filesDir, "preflight-connection.json").writeText(JSONObject()
            .put("savedEncryptedPairingRestored", true)
            .put("actualTunnelWorkspaceSubscription", true)
            .put("nativeUiWorkspaceListVerified", true)
            .put("workspaceCount", connected.snapshot!!.items.size).toString())
    }
}
