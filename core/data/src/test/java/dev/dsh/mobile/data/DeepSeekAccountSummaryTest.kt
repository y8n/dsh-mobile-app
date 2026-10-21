package dev.dsh.mobile.data

import dev.dsh.mobile.protocol.*
import org.junit.Assert.*
import org.junit.Test
import java.math.BigDecimal

class DeepSeekAccountSummaryTest {
    private fun read(wallets: String, status: String = "ready", extra: String = "") = parseDeepSeekAccountSummary(WireJson.parseToJsonElement("""{"version":1,"status":"$status","wallets":$wallets,"fetchedAt":1000$extra}"""))
    @Test fun preservesExactAmountsAndKeepsMissingCostUnknown() {
        val value = read("""[{"currency":"CNY","balance":"119.55201396","toppedUpBalance":"65.20306836","grantedBalance":"54.3489456","totalCosts":"259.36411776"}]""")
        assertEquals(BigDecimal("119.55201396"), value.preferred!!.balance)
        assertEquals(BigDecimal("259.36411776"), value.preferred!!.totalCosts)
        assertNull(read("""[{"currency":"CNY","balance":"1"}]""").preferred!!.totalCosts)
    }
    @Test fun explicitInsufficientBalanceIsNotAnAbsentValue() {
        val value = read("""[{"currency":"CNY","balance":"0"}]""", extra = """, "isAvailable":false,"costStatus":"account-login-required"""")
        assertEquals(false,value.isAvailable);assertEquals(BigDecimal.ZERO,value.preferred!!.balance);assertEquals("account-login-required",value.costStatus)
    }
    @Test fun currenciesRemainSeparateAndCnyIsPreferred() {
        val value = read("""[{"currency":"USD","balance":"2"},{"currency":"CNY","balance":"10"}]""")
        assertEquals(2,value.wallets.size);assertEquals("CNY",value.preferred!!.currency)
    }
    @Test fun errorsCannotPassArbitraryRemoteTextToUi() {
        val value = read("[]", "failed", """, "error":"secret arbitrary response"""")
        assertNull(value.error);assertNull(value.preferred)
    }
    @Test fun malformedAmountsDuplicatesAndUnsupportedVersionsAreRejected() {
        for (wallets in listOf("""[{"currency":"CNY","balance":"NaN"}]""", """[{"currency":"CNY","totalCosts":"-1"}]""", """[{"currency":"CNY","balance":"1e999999"}]""", """[{"currency":"CNY","balance":"1"},{"currency":"CNY","balance":"2"}]""", "[]")) {
            try { read(wallets);fail("Invalid summary accepted") } catch (_: GatewayFailure) { }
        }
        try { parseDeepSeekAccountSummary(WireJson.parseToJsonElement("""{"version":2}"""));fail() } catch (e: GatewayFailure) { assertEquals("unsupported-gateway",e.code) }
    }
}
