package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class PluginPresentationTest {
    @Test fun officialInstalledAndProtectedMatchPageRules() {
        val rows=WireJson.parseToJsonElement("""[
            {"name":"@deepseek-ai/dsh-base","installed":true},
            {"name":"protected","installed":true,"readOnlyReason":"management-required"},
            {"name":"unselected-internal","installed":false,"optional":false},
            {"name":"optional-official","optional":true,"installed":false},
            {"name":"installed","installed":true,"optional":true},
            {"name":"broken","error":{"code":"operation-error"}}
        ]""").jsonArray.map { it.jsonObject }
        val groups=pluginGroups(rows)
        assertEquals(listOf("optional-official"),groups.official.map { it.text("name") })
        assertEquals(listOf("installed","broken"),groups.installed.map { it.text("name") })
    }
    @Test fun customRegistriesKeepScopeAndEscapingWhileNormalizingOriginAndSlash() {
        assertEquals(JsonPrimitive("https://private.example/scope%2Fname/"),normalizedPluginRegistry(JsonPrimitive("HTTPS://PRIVATE.EXAMPLE/scope%2Fname")))
        assertEquals(JsonPrimitive("http://127.0.0.1:4873/"),normalizedPluginRegistry(JsonPrimitive("http://127.0.0.1:4873")))
        for (value in listOf("file:///tmp/npm","javascript:alert(1)","https://", "https://npm.example/a b")) {
            try { normalizedPluginRegistry(JsonPrimitive(value)); fail(value) } catch (_: GatewayFailure) { }
        }
        assertEquals(JsonPrimitive(PLUGIN_NPM),normalizedPluginRegistry(JsonPrimitive("https://registry.npmjs.org:443")))
        assertNull(normalizedPluginRegistry(null)); assertEquals(JsonNull,normalizedPluginRegistry(JsonNull))
    }
    @Test fun hostRegistriesLeadAndOwnPublicSourceIsDeduplicated() {
        val config=WireJson.parseToJsonElement("""{"registry":"https://private.example/","fallbackRegistries":["https://registry.npmmirror.com/"],"resolved":"https://registry.npmjs.org/"}""").jsonObject
        val sources=offeredPluginRegistries(config)
        assertEquals(JsonPrimitive("https://private.example/"),sources.first())
        assertEquals(1,sources.count { it==JsonPrimitive(PLUGIN_NPM) || it is JsonNull })
        assertTrue(sources.contains(JsonPrimitive(PLUGIN_MIRROR)))
    }
}
