package dev.dsh.mobile.protocol

import java.time.*
import org.junit.Assert.*
import org.junit.Test

class DeviceUsageTest {
    @Test fun localMidnightSplitsAndBackgroundDoesNotAccumulate() {
        val zone = ZoneId.of("Asia/Shanghai"); val clock = DeviceUsageClock { zone }
        val start = ZonedDateTime.of(2026, 10, 15, 23, 59, 59, 0, zone).toInstant().toEpochMilli()
        assertTrue(clock.checkpoint("a", start, 0).isEmpty())
        val slices = clock.checkpoint(null, start + 2000, 2000)
        assertEquals(listOf("2026-10-15", "2026-10-16"), slices.map { it.date }); assertEquals(listOf(1000L, 1000L), slices.map { it.milliseconds })
        assertTrue(clock.checkpoint("b", start + 102000, 102000).isEmpty())
        assertEquals("b", clock.checkpoint(null, start + 103000, 103000).single().deviceId)
    }
    @Test fun repeatedOrStaleClockUpdatesCannotDoubleCount() {
        val clock = DeviceUsageClock(); val wall = System.currentTimeMillis()
        clock.checkpoint("a", wall, 1000)
        assertTrue(clock.checkpoint("a", wall, 900).isEmpty())
        assertEquals(500, clock.checkpoint(null, wall + 500, 1500).sumOf { it.milliseconds }.toInt())
    }
    @Test fun dstDayUsesActualElapsedHours() {
        val zone = ZoneId.of("America/New_York"); val clock = DeviceUsageClock { zone }
        val start = LocalDate.of(2026, 3, 8).atStartOfDay(zone).toInstant()
        val end = LocalDate.of(2026, 3, 9).atStartOfDay(zone).toInstant()
        val ms = Duration.between(start, end).toMillis()
        clock.checkpoint("a", start.toEpochMilli(), 0)
        assertEquals(23 * 3600000L, clock.checkpoint(null, end.toEpochMilli(), ms).single().milliseconds)
    }
    @Test fun conversationVisibilityMatchesDeviceAndSessionAndClearsOnBackground() {
        try {
            ConversationVisibility.show("a", "s")
            assertTrue(ConversationVisibility.isVisible("a", "s")); assertFalse(ConversationVisibility.isVisible("b", "s")); assertFalse(ConversationVisibility.isVisible("a", "other"))
            ConversationVisibility.hide(); assertFalse(ConversationVisibility.isVisible("a", "s"))
        } finally { ConversationVisibility.hide() }
    }
}
