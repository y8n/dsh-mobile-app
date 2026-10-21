package dev.dsh.mobile

import androidx.activity.compose.setContent
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.DshTheme
import dev.dsh.mobile.protocol.*
import dev.dsh.mobile.ui.LiveApp
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.UUID
import java.security.MessageDigest
import okhttp3.mockwebserver.*
import okhttp3.tls.HandshakeCertificates
import okhttp3.tls.HeldCertificate
import okio.Buffer
import kotlinx.coroutines.flow.*

/** An empty, isolated vault, production form and actual Main dispatcher; normal pairing preserved. */
class PairingFormRegressionTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    @Test fun externalFirstDeviceForm() = runBlocking {
        val context = compose.activity.applicationContext
        val fixture = File(context.filesDir, "pairing-form-fixture.json")
        assumeTrue("Explicit host-owned endpoint required", fixture.isFile)
        try { exercise(WireJson.parseToJsonElement(fixture.readText()).jsonObject) }
        finally { fixture.delete() }
    }
    @Test fun tlsPairingSuccessFromEmptyDeviceForm() = localForm(true)
    @Test fun tlsPairingRejectionFromEmptyDeviceForm() = localForm(false)
    private fun localForm(success: Boolean) = runBlocking {
        val ca = HeldCertificate.Builder().commonName("Pairing form fixture CA").certificateAuthority(1).build()
        val leaf = HeldCertificate.Builder().commonName("localhost").addSubjectAlternativeName("localhost").signedBy(ca).build()
        val instance = MessageDigest.getInstance("SHA-256").digest(ca.certificate.encoded).joinToString("") { "%02x".format(it) }
        val server = MockWebServer()
        server.useHttps(HandshakeCertificates.Builder().heldCertificate(leaf, ca.certificate).build().sslSocketFactory(), false)
        server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse = when (request.path) {
                "/mobile-access/ca.cer" -> MockResponse().setBody(Buffer().write(ca.certificate.encoded))
                "/mobile-access/metadata" -> MockResponse().setBody("{\"version\":1}")
                "/mobile-access/auth/native-pair" -> if (success) MockResponse().setResponseCode(201).setBody(buildJsonObject {
                    put("instanceId", instance); put("deviceId", "owned-pair-form")
                    put("deviceToken", "fixture-only"); put("deviceExpiresAt", 9999999999999L)
                }.toString()) else MockResponse().setResponseCode(403)
                else -> MockResponse().setResponseCode(404)
            }
        }
        server.start()
        try {
            exercise(buildJsonObject {
                put("origin", server.url("/").toString()); put("key", "dsh2.$instance.${"A".repeat(43)}")
                put("expectSuccess", success)
            })
            assertEquals("Exactly CA, metadata and one pairing request; no retry", 3, server.requestCount)
        } finally { server.shutdown() }
    }
    private suspend fun exercise(input: JsonObject) {
        val context = compose.activity.applicationContext
        val before = DeviceStore(context).read()
        val storageScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val vault = File(context.cacheDir, "pair-form-${UUID.randomUUID()}.preferences_pb")
        val store = DeviceStore(PreferenceDataStoreFactory.create(scope = storageScope) { vault })
        val repo = DeviceRepository(store) { object : DeviceGateway {
            override suspend fun probe() = Unit
            override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement = throw GatewayFailure("unsupported-gateway")
            override fun followWorkspaces() = flow { emit(buildJsonObject { put("type", "baseline"); put("value", buildJsonObject { put("items", JsonArray(emptyList())) }) }); awaitCancellation() }
            override fun close() = Unit
        } }
        try {
            compose.activity.runOnUiThread { compose.activity.setContent { DshTheme { LiveApp(null, repo) } } }
            compose.waitUntil(10_000) { repo.state.value.loaded }
            compose.onNodeWithContentDescription(context.getString(R.string.add_device)).performClick()
            compose.onNodeWithTag("pair_name").performTextInput("Pairing regression fixture")
            compose.onNodeWithTag("pair_address").performScrollTo().performTextInput(input.string("origin"))
            compose.onNodeWithTag("pair_key").performScrollTo().performTextInput(input.string("key"))
            compose.onNodeWithTag("pair_connect").performScrollTo().performClick()
            compose.waitUntil(80_000) { !repo.state.value.busy && (repo.state.value.error != null || repo.state.value.devices.isNotEmpty()) }
            val paired = store.read().devices.singleOrNull()
            if (input["expectSuccess"]?.jsonPrimitive?.boolean == true) {
                assertNotNull("Valid pairing must succeed", paired)
                assertEquals(paired!!.id, store.read().defaultId)
            } else {
                compose.onNodeWithTag("pair_connect").assertIsDisplayed().assertIsEnabled()
                assertNull(paired)
            }
            assertEquals(before, DeviceStore(context).read())
            File(context.filesDir, if (input["expectSuccess"]?.jsonPrimitive?.boolean == true) "pairing-form-success-report.json" else "pairing-form-failure-report.json").writeText(buildJsonObject {
                put("passed", true); put("errorCode", repo.state.value.error)
                put("createdDeviceId", paired?.deviceId)
                put("normalVaultPreserved", true); put("mainDispatcherProductionForm", true)
            }.toString())
        } finally {
            repo.pause(); storageScope.coroutineContext[Job]?.cancelAndJoin(); vault.delete()
        }
    }
}
