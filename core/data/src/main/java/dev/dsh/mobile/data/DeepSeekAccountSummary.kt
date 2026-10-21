package dev.dsh.mobile.data

import dev.dsh.mobile.protocol.*
import kotlinx.serialization.json.*
import java.math.BigDecimal

/** Display-safe amounts only. No credential or raw response is retained by the mobile client. */
data class DeepSeekWallet(val currency: String, val balance: BigDecimal?, val toppedUp: BigDecimal?, val granted: BigDecimal?, val totalCosts: BigDecimal?)
data class DeepSeekAccountSummary(val status: String, val wallets: List<DeepSeekWallet>, val costStatus: String,
    val fetchedAt: Long, val isAvailable: Boolean?, val error: String?) {
    val preferred: DeepSeekWallet? get() = wallets.firstOrNull { it.currency == "CNY" } ?: wallets.firstOrNull()
}

fun parseDeepSeekAccountSummary(value: JsonElement): DeepSeekAccountSummary {
    val row = value as? JsonObject ?: throw GatewayFailure("invalid-response")
    if (row.number("version") != 1L) throw GatewayFailure("unsupported-gateway")
    val status = row.text("status").takeIf { it in setOf("ready", "failed", "unconfigured") } ?: throw GatewayFailure("invalid-response")
    fun amount(wallet: JsonObject, key: String): BigDecimal? {
        val raw = wallet[key] ?: return null
        if (raw is JsonNull) return null
        val text = (raw as? JsonPrimitive)?.takeIf { it.isString }?.content ?: throw GatewayFailure("invalid-response")
        if (text.length > 128) throw GatewayFailure("invalid-response")
        val decimal = text.toBigDecimalOrNull() ?: throw GatewayFailure("invalid-response")
        if (decimal.scale() !in -60..128 || decimal.precision() > 128 || (key == "totalCosts" && decimal.signum() < 0)) throw GatewayFailure("invalid-response")
        return decimal
    }
    val rawWallets = row["wallets"] as? JsonArray ?: throw GatewayFailure("invalid-response")
    if (rawWallets.size > 8) throw GatewayFailure("invalid-response")
    val wallets = rawWallets.map { raw ->
        val wallet = raw as? JsonObject ?: throw GatewayFailure("invalid-response")
        val currency = wallet.text("currency").takeIf { it in setOf("CNY", "USD") } ?: throw GatewayFailure("invalid-response")
        DeepSeekWallet(currency, amount(wallet,"balance"), amount(wallet,"toppedUpBalance"), amount(wallet,"grantedBalance"), amount(wallet,"totalCosts"))
    }
    if (wallets.map { it.currency }.distinct().size != wallets.size || (status == "ready" && wallets.none { it.balance != null || it.totalCosts != null })) throw GatewayFailure("invalid-response")
    val costStatus = row.text("costStatus").takeIf { it in setOf("ready", "unavailable", "account-login-required", "expired", "failed") } ?: "unavailable"
    val safeError = row.text("error").takeIf { it in setOf("expired", "rate-limited", "unavailable", "invalid-response", "invalid-issuer", "storage-unavailable", "account-login-required", "account-changed") }
    return DeepSeekAccountSummary(status, wallets, costStatus, row.number("fetchedAt").coerceAtLeast(0), (row["isAvailable"] as? JsonPrimitive)?.booleanOrNull, safeError)
}

class DeepSeekAccountReader(private val devices: DeviceRepository) {
    suspend fun read(deviceId: String): DeepSeekAccountSummary {
        val connection = devices.selectedConnection()?.takeIf { it.first == deviceId && devices.state.value.connected } ?: throw GatewayFailure("device-changed")
        val result = connection.second.rpc("mobileAccount/summary", JsonObject(emptyMap()))
        if (devices.selectedConnection() != connection || !devices.state.value.connected) throw GatewayFailure("device-changed")
        return parseDeepSeekAccountSummary(result)
    }
}
