package dev.dsh.mobile.protocol

import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

class NotificationDeliveryTest {
    private val event = SessionNotificationEvent("s:turn:7", "s", false, 1000)
    @Test fun concurrentSseAndCatchupAnnounceTheSameTurnOnce() = runBlocking {
        var seen = emptySet<String>()
        val posts = AtomicInteger()
        val delivery = NotificationDelivery({ seen }, { seen = it; true }, { posts.incrementAndGet(); true })
        withContext(Dispatchers.Default) { List(50) { launch { delivery.deliver(event) } }.joinAll() }
        assertEquals(1, posts.get())
        assertEquals(setOf(event.id), seen)
        // A recreated process reads the persisted IDs, not a fresh in-memory set.
        NotificationDelivery({ seen }, { seen = it; true }, { fail("duplicate"); true }).deliver(event)
    }
    @Test fun deniedOrFailedPostNeverMarksAnEventSeen() = runBlocking {
        var seen = emptySet<String>()
        var allowed = false
        val delivery = NotificationDelivery({ seen }, { seen = it; true }, { allowed })
        try { delivery.deliver(event); fail("permission") } catch (error: GatewayFailure) { assertEquals("notification-permission-required", error.code) }
        assertTrue(seen.isEmpty())
        allowed = true; delivery.deliver(event)
        assertEquals(setOf(event.id), seen)
    }
    @Test fun storageFailureCanRetryWithTheSamePlatformNotificationTag() = runBlocking {
        var seen = emptySet<String>()
        var persist = false
        val platformItems = mutableSetOf<String>()
        val delivery = NotificationDelivery({ seen }, { if (persist) seen = it; persist }, { platformItems += it.id; true })
        try { delivery.deliver(event); fail("storage") } catch (error: GatewayFailure) { assertEquals("storage-unavailable", error.code) }
        assertTrue(seen.isEmpty())
        persist = true; delivery.deliver(event)
        assertEquals(1, platformItems.size)
        assertEquals(setOf(event.id), seen)
    }
}
