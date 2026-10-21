package dev.dsh.mobile.notifications

import android.content.Intent
import android.net.Uri
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NotificationNavigationTest {
    private fun tap(device: String, session: String) = Intent("dev.dsh.mobile.OPEN_SESSION").apply {
        data = Uri.parse("dsh-notification://session/$device/$session")
        putExtra("device", device); putExtra("session", session)
    }
    @Test fun coldAndWarmTargetsKeepDeviceAndSessionAndConsumedIntentsDoNotReplay() {
        val first = tap("computer-a", "session-a")
        NotificationNavigation.accept(first)
        val target = NotificationNavigation.target.value!!
        assertEquals("computer-a", target.deviceId); assertEquals("session-a", target.sessionId)
        NotificationNavigation.consumed(target)
        NotificationNavigation.accept(first)
        assertNull(NotificationNavigation.target.value)
        NotificationNavigation.accept(tap("computer-b", "session-b"))
        val second = NotificationNavigation.target.value!!
        NotificationNavigation.consumed(target)
        assertEquals(second, NotificationNavigation.target.value)
        NotificationNavigation.consumed(second)
    }
    @Test fun unrelatedOrIncompleteIntentsDoNotNavigate() {
        NotificationNavigation.target.value?.let(NotificationNavigation::consumed)
        NotificationNavigation.accept(tap("computer", "session").setAction(Intent.ACTION_VIEW))
        NotificationNavigation.accept(Intent("dev.dsh.mobile.OPEN_SESSION").putExtra("device", "computer"))
        assertNull(NotificationNavigation.target.value)
    }
}
