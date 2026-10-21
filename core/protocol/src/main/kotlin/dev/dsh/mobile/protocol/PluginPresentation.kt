package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*
import java.net.URI

private val builtinProfileBundles = setOf("@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "@deepseek-ai/dsh-headless", "@deepseek-ai/dsh-sdk-app", "@deepseek-ai/dsh-acp-app", "@deepseek-ai/dsh-sdk-minimal")
data class PluginGroups(val official: List<JsonObject>, val installed: List<JsonObject>)
/** DSH package visibility plus the mobile page's explicit hide-protected requirement. */
fun pluginGroups(packages: List<JsonObject>): PluginGroups {
    fun JsonObject.flag(name: String) = this[name]?.jsonPrimitive?.booleanOrNull == true
    val listed = packages.filter { it.text("name") !in builtinProfileBundles && it.text("readOnlyReason").isBlank() &&
        (it.flag("installed") || it.flag("optional") || it["error"] is JsonObject) }
    return PluginGroups(listed.filter { it.flag("optional") && !it.flag("installed") }, listed.filter { it.flag("installed") || !it.flag("optional") })
}

const val PLUGIN_NPM = "https://registry.npmjs.org/"
const val PLUGIN_MIRROR = "https://registry.npmmirror.com/"
/** Null means the Host's pnpm configuration; absent Kotlin null means the Host's manager default. */
fun normalizedPluginRegistry(value: JsonElement?): JsonElement? {
    if (value == null || value is JsonNull) return value
    return wireValue {
        val text = value.jsonPrimitive.also { require(it.isString) }.content.trim()
        require(text.none { it.isWhitespace() })
        val url = URI(text)
        require(url.scheme?.lowercase() in setOf("http", "https") && !url.host.isNullOrBlank())
        val path = url.rawPath.orEmpty().let { if (it.endsWith('/')) it else "$it/" }
        val port = if ((url.scheme.equals("https", true) && url.port == 443) || (url.scheme.equals("http", true) && url.port == 80)) -1 else url.port
        val authority = (url.rawUserInfo?.let { "$it@" } ?: "") + url.host.lowercase() + (if (port >= 0) ":$port" else "")
        JsonPrimitive(URI(url.scheme.lowercase() + "://" + authority + path + (url.rawQuery?.let { "?$it" } ?: "") + (url.rawFragment?.let { "#$it" } ?: "")).toASCIIString())
    }
}
fun offeredPluginRegistries(config: JsonObject?): List<JsonElement> {
    val offered = listOfNotNull(config?.get("registry")) + (config?.get("fallbackRegistries") as? JsonArray).orEmpty() + listOf(JsonPrimitive(PLUGIN_NPM),JsonPrimitive(PLUGIN_MIRROR),JsonNull)
    val resolved = runCatching { normalizedPluginRegistry(config?.get("resolved")) }.getOrNull()
    return offered.mapNotNull { runCatching { normalizedPluginRegistry(it) }.getOrNull() }.distinctBy { if (it is JsonNull) resolved ?: JsonNull else it }
}
fun pluginRegistryTitle(value: JsonElement?): String = when(value) {
    null -> "电脑默认安装源"
    JsonNull -> "电脑 npm 配置"
    JsonPrimitive(PLUGIN_NPM) -> "npm 官方源"
    JsonPrimitive(PLUGIN_MIRROR) -> "中国大陆镜像源"
    else -> (value as? JsonPrimitive)?.content.orEmpty()
}
