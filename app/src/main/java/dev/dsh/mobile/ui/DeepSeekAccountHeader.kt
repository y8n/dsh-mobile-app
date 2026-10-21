package dev.dsh.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Info
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.DshColors
import dev.dsh.mobile.protocol.GatewayFailure
import kotlinx.coroutines.*
import java.math.BigDecimal
import java.math.RoundingMode

internal fun money(amount: BigDecimal?, currency: String): String = amount?.let {
    val symbol = if (currency == "CNY") "¥" else "$"
    val rounded = it.setScale(2, RoundingMode.HALF_UP)
    if (it.signum() > 0 && rounded.signum() == 0) "<${symbol}0.01" else symbol + rounded.toPlainString()
} ?: "—"

private data class AccountDisplay(val deviceId: String, val summary: DeepSeekAccountSummary? = null, val error: String? = null)

@Composable internal fun DeepSeekUsageInfo(deviceId: String?, connected: Boolean, read: suspend (String) -> DeepSeekAccountSummary) {
    if (deviceId == null) return
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var attempt by remember(deviceId) { mutableIntStateOf(0) }
    var explanation by remember(deviceId) { mutableStateOf<String?>(null) }
    val currentRead by rememberUpdatedState(read)
    val display by produceState<AccountDisplay?>(null, deviceId, connected, attempt, lifecycle) {
        value = null
        if (connected) lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (isActive) {
                val next = try { AccountDisplay(deviceId, currentRead(deviceId)) }
                catch (cancel: CancellationException) { throw cancel }
                catch (error: Exception) { AccountDisplay(deviceId, error = (error as? GatewayFailure)?.code ?: "unavailable") }
                currentCoroutineContext().ensureActive()
                value = next
                // The Host deduplicates and caches successful Platform reads for a day.
                // Failed reads only retry after a minute; no polling while the page is backgrounded.
                delay(if (value?.summary?.status == "ready" && value?.summary?.costStatus !in setOf("failed", "expired")) 86_400_000 else 60_000)
            }
        }
    }
    val observed = display?.takeIf { it.deviceId == deviceId }
    val summary = observed?.summary.takeIf { connected }
    val loading = connected && observed == null
    val wallet = summary?.takeIf { it.status == "ready" }?.preferred
    Column(Modifier.fillMaxWidth().testTag("deepseek_usage_info"), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("用量信息", style = MaterialTheme.typography.titleMedium, modifier = Modifier.widthIn(min = 64.dp))
            Text("通过 API 获取，可能与官网数据有偏差，实际以官方平台数据为准。",
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 10.sp, lineHeight = 15.sp), color = DshColors.Muted,
                modifier = Modifier.weight(1f))
        }
        Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(12.dp)) {
            Row(Modifier.fillMaxWidth().padding(vertical = 18.dp)) {
                listOf("充值余额" to wallet?.toppedUp, "赠送余额" to wallet?.granted, "累计消费" to wallet?.totalCosts).forEachIndexed { index, (title, amount) ->
                    if (index > 0) VerticalDivider(Modifier.height(62.dp), color = DshColors.Line)
                    Column(Modifier.weight(1f).padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(title, style = MaterialTheme.typography.bodySmall, color = DshColors.Muted, maxLines = 1)
                        Box(Modifier.fillMaxWidth().height(32.dp), contentAlignment = Alignment.Center) {
                            if (loading) Box(Modifier.width(70.dp).height(22.dp).background(DshColors.Line, RoundedCornerShape(4.dp)).testTag("usage_loading_$index"))
                            else if (amount != null) Text(money(amount, wallet?.currency ?: "CNY"), style = MaterialTheme.typography.titleLarge.copy(fontSize = 21.sp, lineHeight = 28.sp, platformStyle = androidx.compose.ui.text.PlatformTextStyle(includeFontPadding = false)), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.testTag("usage_amount_$index"))
                            else Row(Modifier.offset(y = (-1).dp), verticalAlignment = Alignment.CenterVertically) {
                                Text("未知", style = MaterialTheme.typography.titleLarge.copy(fontSize = 21.sp, lineHeight = 28.sp, platformStyle = androidx.compose.ui.text.PlatformTextStyle(includeFontPadding = false)), modifier = Modifier.testTag("usage_unknown_$index"))
                                IconButton({ explanation = title }, Modifier.size(30.dp).testTag("usage_help_$index")) {
                                    Icon(Icons.Outlined.Info, "$title 未知原因", Modifier.size(16.dp), tint = DshColors.Muted)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    explanation?.let { title ->
        val text = when {
            !connected -> "设备离线，连接电脑后可读取用量信息。"
            observed?.error in setOf("unsupported-gateway", "gateway/invocation-unavailable") -> "请更新现有新插件，以支持用量信息查询。"
            summary?.error == "expired" || (title == "累计消费" && summary?.costStatus == "expired") -> "账号授权已失效，请在 DeepSeek Harness 桌面端重新登录 DeepSeek 账号后重试。"
            summary?.error == "rate-limited" -> "查询受到限流，请稍后重试。"
            title == "累计消费" && summary?.status == "ready" && summary.costStatus in setOf("account-login-required", "unavailable") -> "累计消费需要在 DeepSeek Harness 桌面端登录 DeepSeek 账号后读取。仅使用 WebUI 或 API Key 无法获取这项数据。请在桌面端登录账号后重试。"
            summary?.status == "unconfigured" -> "请在电脑端配置 DeepSeek API Key 或登录 DeepSeek 账号后重试。"
            else -> "暂时无法获取$title，请检查电脑端连接和账号状态后重试。未获取到的数据不会按零金额显示。"
        }
        AlertDialog(onDismissRequest = { explanation = null }, title = { Text("为什么${title}未知？") }, text = { Text(text) },
            confirmButton = { TextButton({ explanation = null }) { Text("知道了") } },
            dismissButton = { if (connected) TextButton({ attempt++; explanation = null }) { Text("重试") } })
    }
}
