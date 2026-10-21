package dev.dsh.mobile.ui

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import dev.dsh.mobile.protocol.NetworkRecovery
import dev.dsh.mobile.data.DeviceRepository
import dev.dsh.mobile.data.uploadDiagnosticReport
import dev.dsh.mobile.data.DeviceStore
import dev.dsh.mobile.data.LocalDeviceDataRepository
import dev.dsh.mobile.data.DiagnosticRepository
import dev.dsh.mobile.protocol.Diagnostics
import dev.dsh.mobile.BuildConfig

object LiveGraph {
    @Volatile private var instance: DeviceRepository? = null
    @Volatile private var diagnostics: DiagnosticRepository? = null
    @Volatile private var localData: LocalDeviceDataRepository? = null
    @Synchronized fun localData(context: Context): LocalDeviceDataRepository = localData ?: LocalDeviceDataRepository(java.io.File(context.applicationContext.filesDir, "local-device-data")).also { localData = it }
    @Synchronized fun diagnostics(context: Context): DiagnosticRepository = diagnostics ?: DiagnosticRepository(context.applicationContext, BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE,
        computerUploader = { deviceId, report ->
            val devices = instance ?: throw dev.dsh.mobile.protocol.GatewayFailure("connection-required")
            devices.uploadDiagnosticReport(deviceId, report)
        }).also {
        diagnostics = it; Diagnostics.sink = it::record
        dev.dsh.mobile.notifications.NotificationDiagnostics.install(context)
    }
    @Synchronized fun repository(context: Context): DeviceRepository { diagnostics(context); return instance ?: DeviceRepository(DeviceStore(context), localData = localData(context)).also { instance = it } }
}
class DeviceViewModel(application: Application) : AndroidViewModel(application) {
    val repository = LiveGraph.repository(application)
    val state = repository.state
    private val connectivity = application.getSystemService(ConnectivityManager::class.java)
    private val recovery = NetworkRecovery(viewModelScope, connectivity.activeNetwork) { repository.reconnect() }
    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) { recovery.available(connectivity.activeNetwork ?: network) }
        override fun onLost(network: Network) {
            val current = connectivity.activeNetwork
            if (current != null && current != network) recovery.available(current) else recovery.lost(network)
        }
    }
    init { connectivity.registerDefaultNetworkCallback(callback) }
    override fun onCleared() { recovery.close(); connectivity.unregisterNetworkCallback(callback); super.onCleared() }
}
