package dev.dsh.mobile.ui
import org.junit.Assert.*
import org.junit.Test
import java.math.BigDecimal
class DeepSeekAccountTextTest {
    @Test fun actualZeroIsShown() { assertEquals("¥0.00",money(BigDecimal.ZERO,"CNY")) }
    @Test fun cnyHasSymbolWithoutCurrencySuffix() { assertEquals("¥54.35",money(BigDecimal("54.3489456"),"CNY")) }
    @Test fun usdUsesOwnSymbol() { assertEquals("$65.20",money(BigDecimal("65.20306836"),"USD")) }
    @Test fun positiveSubCentAmountsAreNotRenderedAsZero() { assertEquals("<¥0.01",money(BigDecimal("0.000001"),"CNY")) }
}
