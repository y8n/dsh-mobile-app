package dev.dsh.mobile

import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.*
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.security.MessageDigest
import java.util.UUID

/** Explicit host-kill stress of only one journaled local draft in the normal
 * encrypted vault. No Desktop requests, credential changes, or ordinary drafts. */
class VaultProcessStressTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private fun enabled() = assumeTrue(InstrumentationRegistry.getArguments().getString("m6VaultStress") == "true")
    private fun fingerprint(v: StoredDevices, sid: String) = MessageDigest.getInstance("SHA-256")
        .digest(WireJson.encodeToString(v.copy(drafts = v.drafts.filterNot { it.sessionId == sid })).toByteArray())
        .joinToString("") { "%02x".format(it) }
    @Test fun writeOwnedLocalDraftUntilHostKillsProcess() = runBlocking {
        enabled(); val seed = File(context.filesDir, "m6-vault-stress-seed.json")
        assertFalse("Outstanding owned stress seed must be resolved first", seed.exists())
        val store = DeviceStore(context); val before = store.read()
        val device = before.devices.single { it.id == before.defaultId }
        val sid = "session-m6-vault-stress-" + UUID.randomUUID()
        val marker = UUID.randomUUID().toString()
        seed.writeText(buildJsonObject {
            put("sessionId", sid); put("deviceId", device.id); put("marker", marker)
            put("beforeFingerprint", fingerprint(before, sid)); put("stagePid", android.os.Process.myPid())
        }.toString())
        var version = 0
        while (true) {
            store.update { v -> v.copy(drafts = v.drafts.filterNot { it.sessionId == sid } + ConversationDraft(device.id, sid, "$marker:$version")) }
            if (version == 0) File(context.filesDir, "m6-vault-stress-phase.json").writeText(buildJsonObject {
                put("phase", "writing"); put("marker", marker); put("stagePid", android.os.Process.myPid())
            }.toString())
            version++
            yield()
        }
    }
    @Test fun freshProcessRestoresCommittedVaultAndRemovesOnlyOwnedDraft() = runBlocking {
        enabled(); val seedFile = File(context.filesDir, "m6-vault-stress-seed.json"); assumeTrue(seedFile.isFile)
        val seed = WireJson.parseToJsonElement(seedFile.readText()).jsonObject
        val sid = seed.string("sessionId"); assertTrue(sid.startsWith("session-m6-vault-stress-"))
        val store = DeviceStore(context); val restored = store.read()
        val oldPid = seed.getValue("stagePid").jsonPrimitive.int
        assertTrue(android.os.Process.myPid() != oldPid)
        assertEquals(seed.string("beforeFingerprint"), fingerprint(restored, sid))
        val draft = restored.drafts.single { it.sessionId == sid && it.deviceId == seed.string("deviceId") }
        val prefix = seed.string("marker") + ":"; assertTrue(draft.text.startsWith(prefix))
        val counter = draft.text.removePrefix(prefix).toInt(); assertTrue(counter >= 0)
        assertTrue(restored.devices.any { it.id == restored.defaultId })
        store.update { it.copy(drafts = it.drafts.filterNot { draft -> draft.sessionId == sid && draft.deviceId == seed.string("deviceId") }) }
        assertEquals(seed.string("beforeFingerprint"), fingerprint(store.read(), sid)); seedFile.delete()
        File(context.filesDir, "m6-vault-stress-report.json").writeText(buildJsonObject {
            put("passed", true); put("stagePid", oldPid); put("verifyPid", android.os.Process.myPid())
            put("lastCommittedCounter", counter); put("unrelatedVaultFieldsPreserved", true)
            put("originalPairingPreserved", true); put("ownedDraftRemoved", true)
            put("scope", "Host stops App during repeated writes to one owned local draft in normal encrypted vault; no server writes or power-loss claim")
        }.toString())
    }
}
