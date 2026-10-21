package dev.dsh.mobile.data

import androidx.datastore.core.CorruptionException
import androidx.datastore.core.Serializer
import androidx.datastore.preferences.PreferencesProto
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.protobuf.InvalidProtocolBufferException
import java.io.InputStream
import java.io.OutputStream
import java.io.IOException

/** Wire-compatible codec for this private vault's encrypted payload/IV strings.
 * Reject foreign value types rather than dropping unknown preferences on save.
 * It does not replace or change DeviceStore's AES-GCM envelope or key alias.
 */
object VaultPreferencesSerializer : Serializer<Preferences> {
    override val defaultValue: Preferences get() = emptyPreferences()
    override suspend fun readFrom(input: InputStream): Preferences {
        val encoded = try { PreferencesProto.PreferenceMap.parseFrom(input) }
        catch (error: InvalidProtocolBufferException) { throw CorruptionException("Unreadable vault preferences", error) }
        val result = mutablePreferencesOf()
        for ((name, value) in encoded.preferencesMap) {
            if (value.valueCase != PreferencesProto.Value.ValueCase.STRING)
                throw CorruptionException("Unexpected vault preference type")
            result[stringPreferencesKey(name)] = value.string
        }
        return result.toPreferences()
    }
    override suspend fun writeTo(t: Preferences, output: OutputStream) {
        val encoded = PreferencesProto.PreferenceMap.newBuilder()
        for ((key, value) in t.asMap()) {
            if (value !is String) throw IOException("Unexpected vault preference type")
            encoded.putPreferences(key.name, PreferencesProto.Value.newBuilder().setString(value).build())
        }
        encoded.build().writeTo(output)
    }
}
