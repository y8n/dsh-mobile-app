package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class SessionProjectionsTest {
    private fun obj(vararg pairs: Pair<String, String>) = JsonObject(pairs.associate { it.first to JsonPrimitive(it.second) })
    @Test fun independentUnitsDoNotUseAnUnrelatedGlobalWatermark() {
        var p = SessionProjections().seed(obj("title" to "initial", "permissions" to "old"), 10)
        p = p.apply("title", JsonPrimitive("new title"), 30).apply("permissions", JsonPrimitive("read-only"), 20)
        assertEquals("new title", p.values.text("title")); assertEquals("read-only", p.values.text("permissions"))
        assertEquals(p, p.apply("permissions", JsonPrimitive("stale"), 19)); assertEquals(p, p.apply("permissions", JsonPrimitive("replayed"), 20))
    }
    @Test fun staleBaselineFillsOlderKeysWithoutOverwritingNewerKeys() {
        val p = SessionProjections().seed(obj("title" to "old", "permissions" to "old"), 10)
            .apply("title", JsonPrimitive("new"), 30).seed(obj("title" to "stale", "permissions" to "updated"), 20)
        assertEquals("new", p.values.text("title")); assertEquals("updated", p.values.text("permissions"))
    }
    @Test fun baselineOmissionsClearOldCapabilitiesButPreserveNewerFields() {
        var p = SessionProjections().seed(obj("goal" to "active", "stats" to "new"), 10).apply("stats", JsonPrimitive("latest"), 30)
        p = p.seed(obj("title" to "current"), 20)
        assertNull(p.values["goal"]); assertEquals("latest", p.values.text("stats"))
        p = p.seed(obj("goal" to "re-enabled", "stats" to "stale"), 20)
        assertEquals("re-enabled", p.values.text("goal")); assertEquals("latest", p.values.text("stats"))
        p = p.apply("goal", JsonPrimitive("fresh"), 21); assertEquals("fresh", p.values.text("goal"))
    }
}
