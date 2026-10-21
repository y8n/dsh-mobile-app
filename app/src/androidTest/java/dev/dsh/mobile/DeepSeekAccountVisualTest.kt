package dev.dsh.mobile

import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.SystemBarStyle
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.protocol.*
import dev.dsh.mobile.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.math.BigDecimal
import kotlinx.coroutines.awaitCancellation

/** Actual production workspace/header renderers with explicit account fixtures. */
class DeepSeekAccountVisualTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    @Test fun captureAccountRowAndDetailsInBothThemes() {
        val dark = mutableStateOf(true)
        val device = mutableStateOf("gift")
        val connected = mutableStateOf(true)
        val workspacePage = mutableStateOf(false)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val repo = DeviceRepository(DeviceStore(context))
        val local = LocalDeviceDataRepository(File(context.cacheDir, "usage-visual-${System.nanoTime()}"))
        val base = DeepSeekAccountSummary("ready",listOf(DeepSeekWallet("CNY",BigDecimal("119.55201396"),BigDecimal("65.20306836"),BigDecimal("54.3489456"),BigDecimal("259.36411776"))),"ready",1000,true,null)
        compose.activity.runOnUiThread { compose.activity.setContent {
            SideEffect {
                val style = if(dark.value) SystemBarStyle.dark(android.graphics.Color.TRANSPARENT) else SystemBarStyle.light(android.graphics.Color.TRANSPARENT,android.graphics.Color.TRANSPARENT)
                compose.activity.enableEdgeToEdge(statusBarStyle=style,navigationBarStyle=style)
            }
            DshTheme(dark.value) {
                Scaffold(contentWindowInsets=WindowInsets.safeDrawing) { padding ->
                    Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
                        val state = DeviceState(loaded=true, devices=listOf(DeviceRow(device.value,"MacMini","https://fixture.invalid",connections=listOf(DeviceConnectionRow("c","CF 隧道","https://fixture.invalid")))), selectedId=device.value, defaultId=device.value, connected=connected.value,
                            snapshot=WorkspaceSnapshot(listOf(Workspace("w","/fixture/project","验收工作区",emptyList()))))
                        if (workspacePage.value) LiveWorkspaces(state,{}, {}, {}, {}, {})
                        else LiveDeviceSettings(state,repo,local,{}, {}, {}, {}, usageInfo = {
                            DeepSeekUsageInfo(device.value,connected.value) { id -> when(id) {
                                "loading" -> awaitCancellation()
                                "no-cost" -> base.copy(wallets=base.wallets.map { it.copy(totalCosts=null) },costStatus="account-login-required")
                                "no-gift" -> base.copy(wallets=base.wallets.map { it.copy(granted=BigDecimal.ZERO) })
                                else -> base
                            } }
                        })
                    }
                }
            }
        } }
        val root = File(compose.activity.filesDir,"deepseek-account-visual").apply { mkdirs() }
        fun capture(name:String) {
            compose.waitForIdle();Thread.sleep(350);compose.waitForIdle()
            val bitmap=InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()!!
            root.resolve("$name.png").outputStream().use { assertTrue(bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)) };bitmap.recycle()
        }
        fun await(text:String) { compose.waitUntil(5000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() } }
        await("¥259.36");capture("01-complete-dark")
        compose.runOnIdle { dark.value=false };capture("02-complete-light")
        compose.runOnIdle { device.value="no-cost" };await("未知");capture("03-unknown-light")
        compose.onNodeWithTag("usage_help_2").performClick();compose.onNodeWithText("为什么累计消费未知？").assertExists();capture("04-unknown-explanation");compose.onNodeWithText("知道了").performClick()
        compose.runOnIdle { device.value="no-gift" };await("¥0.00");capture("05-zero-gift-light")
        compose.runOnIdle { device.value="loading" };compose.onNodeWithTag("usage_loading_0").assertExists();capture("06-loading-light")
        compose.runOnIdle { workspacePage.value=true };compose.onNodeWithTag("deepseek_usage_info").assertDoesNotExist();compose.onNodeWithText("验收工作区").assertExists();capture("07-workspaces-no-balance")
        compose.runOnIdle { workspacePage.value=false;connected.value=false;dark.value=true };compose.waitForIdle();capture("08-offline-dark")
    }
}
