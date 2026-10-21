package dev.dsh.mobile.protocol

import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Serialize SSE and durable catch-up for one device, using the same event IDs.
 * The platform post must use a stable tag so a retry replaces an existing item. */
class NotificationDelivery(
    private val seen: () -> Set<String>,
    private val remember: (Set<String>) -> Boolean,
    private val post: (SessionNotificationEvent) -> Boolean,
    private val duplicate: (SessionNotificationEvent) -> Unit = {},
) {
    private val mutex = Mutex()
    suspend fun deliver(event: SessionNotificationEvent) = mutex.withLock {
        currentCoroutineContext().ensureActive()
        val previous = seen()
        if (event.id in previous) { duplicate(event); return@withLock }
        // Do not lose an event when permission is unavailable or posting throws.
        if (!post(event)) throw GatewayFailure("notification-permission-required")
        if (!remember((previous.toList() + event.id).takeLast(1024).toSet())) throw GatewayFailure("storage-unavailable")
    }
}
