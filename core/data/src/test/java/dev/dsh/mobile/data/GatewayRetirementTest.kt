package dev.dsh.mobile.data

import dev.dsh.mobile.protocol.DeviceGateway
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicReference

class GatewayRetirementTest {
    private fun gateway(close: () -> Unit) = object : DeviceGateway {
        override fun close() = close.invoke()
        override suspend fun probe() = Unit
        override fun followWorkspaces() = emptyFlow<JsonObject>()
        override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement = JsonNull
    }

    @Test fun callerThreadNeverClosesTlsAndCleanupFailureDoesNotEscape(): Unit = runBlocking {
        val caller = Executors.newSingleThreadExecutor { Thread(it, "ui-fixture") }.asCoroutineDispatcher()
        val closeThread = AtomicReference<Thread>()
        try {
            withContext(caller) {
                val ui = Thread.currentThread()
                assertTrue(retireGateway(gateway { closeThread.set(Thread.currentThread()) }))
                assertNotSame(ui, closeThread.get())
                assertFalse(retireGateway(gateway { throw IllegalStateException("simulated socket close failure") }))
                assertTrue(retireGateway(null))
            }
        } finally { caller.close() }
    }

    @Test fun cancelledCallerStillDisposesOldConnection(): Unit = runBlocking {
        val closed = CompletableDeferred<Unit>()
        val job = launch(start = CoroutineStart.LAZY) {
            try { awaitCancellation() }
            finally { retireGateway(gateway { closed.complete(Unit) }) }
        }
        job.start(); yield(); job.cancelAndJoin()
        assertTrue(closed.isCompleted)
    }
}
