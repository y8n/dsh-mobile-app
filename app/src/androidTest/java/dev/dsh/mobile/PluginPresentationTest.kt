package dev.dsh.mobile

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.protocol.*
import dev.dsh.mobile.ui.LivePlugins
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.UUID

/** The real plugin screen must show packages, while joining live module state only in details. */
class PluginPresentationTest {
    @get:Rule val compose = createComposeRule()
    private class Gateway : DeviceGateway {
        val writes = java.util.concurrent.CopyOnWriteArrayList<Pair<String, JsonObject>>()
        override fun close() = Unit
        override suspend fun probe() = Unit
        override fun followWorkspaces() = flow { emit(WireJson.parseToJsonElement("""{"type":"baseline","value":{"items":[]}}""").jsonObject); awaitCancellation() }
        override fun follow(endpoint: String, args: JsonObject) = flow { emit(buildJsonObject { put("type","ready") }); awaitCancellation() }
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
            if (mutation) writes += method to args
            return when (method) {
                "pluginManager/listBundles" -> WireJson.parseToJsonElement("""[
                    {"name":"@fixture/zeta","installed":true,"enabled":true,"meta":{"title":"插件包 Z"},"rows":[]},
                    {"name":"@fixture/alpha","optional":true,"enabled":true,"meta":{"title":"插件包 A"},"rows":[{"rowId":"r1","entryId":"module-a","moduleName":"internal-a","meta":{"title":"模块 A"}},{"rowId":"r2","moduleName":"missing-module"}]}
                ]""")
                "pluginManager/listPlugins" -> WireJson.parseToJsonElement("""[
                    {"entryId":"module-a","moduleName":"internal-a","enabled":true,"patchId":"patch-a","fiberPhase":"active"},
                    {"entryId":"builtin","moduleName":"内部运行组件","enabled":true,"readOnlyReason":"protected"}
                ]""")
                "pluginManager/setBundleEnabled", "pluginManager/setPluginEnabled" -> buildJsonObject { put("application","applied"); put("changed",true) }
                else -> JsonObject(emptyMap())
            }
        }
    }
    @Test fun packagesOnlyAndModuleDetailsUseLiveState() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val scope = CoroutineScope(SupervisorJob()+Dispatchers.IO)
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope=scope) { File(context.cacheDir,"plugin-presentation-${UUID.randomUUID()}.preferences_pb") })
        store.update { StoredDevices(listOf(DeviceCredential("a","fixture","https://fixture.example","0".repeat(64),"a","test-only",Long.MAX_VALUE))) }
        val gateway = Gateway(); val devices = DeviceRepository(store) { gateway }
        try {
            withTimeout(5000) { devices.state.first { it.loaded } }; devices.select("a")
            withTimeout(5000) { devices.state.first { it.connected } }
            compose.setContent { val state by devices.state.collectAsState(); DshTheme { Surface(Modifier.fillMaxSize()) { LivePlugins(devices.plugins(),state,{}) } } }
            compose.waitUntil(5000) { compose.onAllNodesWithText("插件包 A").fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithText("内部运行组件").assertDoesNotExist(); compose.onNodeWithText("模块 A").assertDoesNotExist()
            assertTrue(compose.onNodeWithText("插件包 A").fetchSemanticsNode().boundsInRoot.top < compose.onNodeWithText("插件包 Z").fetchSemanticsNode().boundsInRoot.top)
            compose.onNodeWithTag("plugin-toggle:@fixture/alpha").assertIsOn().performClick()
            compose.waitUntil(5000) { gateway.writes.isNotEmpty() }
            assertEquals("pluginManager/setBundleEnabled",gateway.writes.first().first)
            assertEquals("@fixture/alpha",gateway.writes.first().second.text("name"))
            shot("plugin-packages")
            compose.onNodeWithText("插件包 A").performClick()
            compose.onNodeWithText("包含的模块").assertIsDisplayed()
            compose.onNodeWithTag("plugin-toggle:module-a").assertIsOn().performClick()
            compose.waitUntil(5000) { gateway.writes.size == 2 }
            assertEquals("pluginManager/setPluginEnabled",gateway.writes.last().first)
            compose.onNodeWithTag("plugin-toggle:").assertDoesNotExist()
            compose.onNodeWithText("内部运行组件").assertDoesNotExist()
            shot("plugin-modules")
        } finally { devices.close(); scope.cancel() }
        Unit
    }
    private fun shot(name: String) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        File(context.filesDir,"$name.png").outputStream().use { InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot().compress(android.graphics.Bitmap.CompressFormat.PNG,100,it) }
    }
}
