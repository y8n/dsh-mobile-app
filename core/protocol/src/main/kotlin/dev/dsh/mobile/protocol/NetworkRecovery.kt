package dev.dsh.mobile.protocol

import kotlinx.coroutines.*

/** Coalesce default-network handovers, including VPN replacement and late old-network loss. */
class NetworkRecovery(private val scope: CoroutineScope, initialNetwork: Any?, private val settleMs: Long = 500,
    private val reconnect: () -> Unit) {
    private var active = initialNetwork
    private var pending: Job? = null
    @Synchronized fun available(network: Any) {
        if (network == active) return
        active = network; changed(true)
    }
    @Synchronized fun lost(network: Any) {
        if (network != active) return
        active = null; changed(false)
    }
    private fun changed(available: Boolean) {
        Diagnostics.emit(if (available) "network.available" else "network.lost")
        pending?.cancel()
        pending = scope.launch { delay(settleMs); reconnect() }
    }
    @Synchronized fun close() { pending?.cancel() }
}
