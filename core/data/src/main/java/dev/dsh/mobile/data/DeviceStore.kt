package dev.dsh.mobile.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStoreFile
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.flow.first
import kotlinx.serialization.Serializable
import java.security.KeyStore
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

private object DevicePreferences {
    @Volatile private var instance: DataStore<Preferences>? = null
    fun get(context: Context): DataStore<Preferences> = instance ?: synchronized(this) {
        instance ?: PreferenceDataStoreFactory.create(storage = AtomicVaultStorage(VaultPreferencesSerializer) {
            context.applicationContext.preferencesDataStoreFile("dsh_devices")
        }).also { instance = it }
    }
}
@Serializable data class StoredDevices(val devices: List<DeviceCredential> = emptyList(), val defaultId: String? = null,
    val recentDeviceId: String? = null, val recentWorkspaceId: String? = null,
    val pendingSessions: List<PendingSession> = emptyList(), val drafts: List<ConversationDraft> = emptyList(), val pluginInstalls: List<PendingPluginInstall> = emptyList(),
    val scheduleWrites: List<PendingScheduleWrite> = emptyList(), val pendingWorkspaces: List<PendingWorkspace> = emptyList(), val workspaceWrites: List<PendingWorkspaceMutation> = emptyList())
@Serializable data class PendingWorkspaceMutation(val deviceId: String, val workspaceId: String, val action: String, val title: String? = null)
@Serializable data class PendingWorkspace(val deviceId: String, val path: String, val workspaceId: String? = null)
@Serializable data class PendingScheduleWrite(val deviceId: String, val sessionId: String, val method: String, val request: kotlinx.serialization.json.JsonObject)
@Serializable data class PendingPluginInstall(val deviceId: String, val requestId: String, val spec: String, val registry: kotlinx.serialization.json.JsonElement? = null)
@Serializable data class ConversationDraft(val deviceId: String, val sessionId: String, val text: String = "", val pendingRequestId: String? = null, val pendingText: String? = null,
    val draftRevision: Long = 0, val pendingDraftRevision: Long? = null, val localAttachment: LocalAttachmentDraft? = null)
@Serializable data class LocalAttachmentDraft(val uri: String, val name: String = "附件", val mediaType: String = "", val uploadResultUnknown: Boolean = false)
@Serializable data class PendingSession(val deviceId: String, val workspaceId: String, val sessionId: String)

/** DataStore commits ciphertext and IV together; an unreadable vault is never overwritten. */
class DeviceStore(private val store: DataStore<Preferences>) {
    constructor(context: Context) : this(DevicePreferences.get(context.applicationContext))
    private val payload = stringPreferencesKey("encrypted_devices")
    private val iv = stringPreferencesKey("devices_iv")
    private val alias = "dsh-mobile-device-vault-v1"
    private fun key(create: Boolean): SecretKey {
        val keys = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keys.getKey(alias, null) as? SecretKey)?.let { return it }
        if (!create) throw GatewayFailure("storage-unavailable")
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    private fun decode(prefs: Preferences): StoredDevices {
        val data = prefs[payload]; val nonce = prefs[iv]
        if (data == null && nonce == null) return StoredDevices()
        if (data == null || nonce == null) throw GatewayFailure("storage-unavailable")
        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(false), GCMParameterSpec(128, Base64.getDecoder().decode(nonce))) }
            return WireJson.decodeFromString(StoredDevices.serializer(), cipher.doFinal(Base64.getDecoder().decode(data)).decodeToString())
        } catch (_: Exception) { throw GatewayFailure("storage-unavailable") }
    }
    private fun normalized(value: StoredDevices) = value.copy(devices = value.devices.map { it.manualConnections() }, defaultId = value.defaultId?.takeIf { id -> value.devices.any { it.id == id } } ?: value.devices.firstOrNull()?.id)
    suspend fun read(): StoredDevices = try { normalized(decode(store.data.first())) }
    catch (cancel: kotlinx.coroutines.CancellationException) { throw cancel }
    catch (_: Exception) { throw GatewayFailure("storage-unavailable") }
    suspend fun update(transform: (StoredDevices) -> StoredDevices): StoredDevices {
        var result: StoredDevices? = null
        try {
            store.edit { prefs ->
                val current = decode(prefs)
                val next = normalized(transform(current))
                val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key(prefs[payload] == null)) }
                val encrypted = cipher.doFinal(WireJson.encodeToString(StoredDevices.serializer(), next).encodeToByteArray())
                prefs[payload] = Base64.getEncoder().encodeToString(encrypted)
                prefs[iv] = Base64.getEncoder().encodeToString(cipher.iv)
                result = next
            }
        } catch (cancel: kotlinx.coroutines.CancellationException) { throw cancel }
        catch (failure: GatewayFailure) { throw failure }
        catch (_: Exception) { throw GatewayFailure("storage-unavailable") }
        return result ?: throw GatewayFailure("storage-unavailable")
    }
}
