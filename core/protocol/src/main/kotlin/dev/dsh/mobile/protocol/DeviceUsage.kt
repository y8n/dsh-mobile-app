package dev.dsh.mobile.protocol

import java.time.*

data class UsageSlice(val deviceId: String, val date: String, val milliseconds: Long)
/** Monotonic durations, split at local midnight (including DST). No background interval is retained. */
class DeviceUsageClock(private val zone: () -> ZoneId = ZoneId::systemDefault) {
    private var device: String? = null
    private var elapsed = 0L
    val currentDevice get() = device
    fun checkpoint(nextDevice: String?, wallMs: Long, elapsedMs: Long): List<UsageSlice> {
        if (elapsedMs < elapsed) return emptyList()
        val previous = device
        val delta = (elapsedMs - elapsed).coerceAtLeast(0)
        device = nextDevice; elapsed = maxOf(elapsed, elapsedMs)
        if (previous == null || delta == 0L) return emptyList()
        var at = Instant.ofEpochMilli(wallMs - delta)
        val end = Instant.ofEpochMilli(wallMs)
        val result = mutableListOf<UsageSlice>()
        while (at < end) {
            val date = at.atZone(zone()).toLocalDate()
            val next = minOf(end, date.plusDays(1).atStartOfDay(zone()).toInstant())
            result += UsageSlice(previous, date.toString(), Duration.between(at, next).toMillis())
            at = next
        }
        return result
    }
    fun reset(elapsedMs: Long) { elapsed = maxOf(elapsed, elapsedMs) }
}
