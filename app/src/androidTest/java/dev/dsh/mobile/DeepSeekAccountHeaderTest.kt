package dev.dsh.mobile
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.ui.DeepSeekUsageInfo
import kotlinx.coroutines.*
import org.junit.Rule
import org.junit.Test
import java.math.BigDecimal
class DeepSeekAccountHeaderTest {
 @get:Rule val compose = createComposeRule()
 private fun summary(cost: String? = null) = DeepSeekAccountSummary("ready",listOf(DeepSeekWallet("CNY",BigDecimal("119.55"),BigDecimal("65.20"),BigDecimal.ZERO,cost?.let(::BigDecimal))),if(cost==null) "account-login-required" else "ready",1000,true,null)
 @Test fun unknownCostKeepsColumnAndExplainsDesktopRequirement() {
  compose.setContent { DshTheme { Surface { Column { DeepSeekUsageInfo("a",true) { summary() } } } } }
  compose.waitUntil(5000) { compose.onAllNodesWithTag("usage_unknown_2").fetchSemanticsNodes().isNotEmpty() }
  compose.onNodeWithText("累计消费").assertExists()
  compose.onNodeWithTag("usage_help_2").performClick()
  compose.onNodeWithText("累计消费需要在 DeepSeek Harness 桌面端登录 DeepSeek 账号后读取。仅使用 WebUI 或 API Key 无法获取这项数据。请在桌面端登录账号后重试。").assertExists()
 }
 @Test fun zeroGiftAndKnownCostDisplayWithoutCurrencySuffix() {
  compose.setContent { DshTheme { Surface { Column { DeepSeekUsageInfo("a",true) { summary("259.36") } } } } }
  compose.waitUntil(5000) { compose.onAllNodesWithText("¥259.36").fetchSemanticsNodes().isNotEmpty() }
  compose.onNodeWithText("¥0.00").assertIsDisplayed();compose.onNodeWithText("CNY").assertDoesNotExist()
 }
 @Test fun loadingHasSkeletonsAndLateOldDeviceCannotOverwriteCurrentDevice() {
  val device=mutableStateOf("a");val pending=CompletableDeferred<DeepSeekAccountSummary>()
  compose.setContent { DshTheme { Surface { Column { DeepSeekUsageInfo(device.value,true) { id -> if(id=="a") withContext(NonCancellable) { pending.await() } else summary("50") } } } } }
  try {
   compose.onNodeWithTag("usage_loading_0").assertExists();compose.onNodeWithTag("usage_loading_1").assertExists();compose.onNodeWithTag("usage_loading_2").assertExists()
   compose.onNodeWithText("未知").assertDoesNotExist()
   compose.runOnIdle { device.value="b" }
   compose.waitUntil(5000) { compose.onAllNodesWithText("¥50.00").fetchSemanticsNodes().isNotEmpty() }
   pending.complete(summary("999"));compose.waitForIdle();compose.onNodeWithText("¥999.00").assertDoesNotExist()
  } finally { pending.complete(summary()) }
 }
}
