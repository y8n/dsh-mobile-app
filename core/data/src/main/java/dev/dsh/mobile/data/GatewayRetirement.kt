package dev.dsh.mobile.data

import dev.dsh.mobile.protocol.DeviceGateway
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext

/** TLS socket close can perform network I/O. Cleanup cannot invalidate an already committed save. */
internal suspend fun retireGateway(gateway: DeviceGateway?): Boolean = withContext(NonCancellable + Dispatchers.IO) {
    try { gateway?.close(); true } catch (_: Exception) { false }
}
