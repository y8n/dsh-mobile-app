package dev.dsh.mobile.protocol

import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class NetworkRecoveryTest {
    @Test fun vpnHandoverAndLateOldLossReconnectOnlyOnce() = runBlocking {
        var count = 0
        val recovery = NetworkRecovery(this,"wifi",30) { count++ }
        recovery.available("wifi")
        recovery.lost("wifi"); recovery.available("vpn"); recovery.lost("wifi")
        delay(80); assertEquals(1,count)
        recovery.available("vpn"); delay(60); assertEquals(1,count)
        recovery.close()
    }
    @Test fun offlineTransitionReconnectsButDisposalCancelsPendingWork() = runBlocking {
        var count = 0
        val recovery = NetworkRecovery(this,"vpn",30) { count++ }
        recovery.lost("old-wifi"); delay(60); assertEquals(0,count)
        recovery.lost("vpn"); delay(60); assertEquals(1,count)
        recovery.available("cellular"); recovery.close(); delay(60); assertEquals(1,count)
    }
}
