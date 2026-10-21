package dev.dsh.mobile.protocol

import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.HttpUrl.Companion.toHttpUrl
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class RegistryPackage(val name: String, val version: String, val description: String)
data class RegistryResults(val packages: List<RegistryPackage>, val hasMore: Boolean)

/** Package addresses belong to the Desktop inspector. Never forward local
 * paths, repository URLs or their query credentials to public discovery. */
fun isPublicRegistryQuery(query: String): Boolean {
    val q = query.trim()
    if (q.isEmpty() || q.length > 200 || q.any { it.isISOControl() || it in "\\:?#" }) return false
    if (q.startsWith("~") || q.endsWith(".tgz", true) || q.endsWith(".tar.gz", true)) return false
    if ('/' in q && !Regex("^@[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]*(@[A-Za-z0-9.*^~+\\-]+)?$").matches(q)) return false
    return true
}

/** Public npm discovery has its own credential-free client. Computer cookies,
 * CSRF and paired CA trust never leave the selected Desktop gateway. */
class PublicRegistrySearch internal constructor(private val client: OkHttpClient) {
    constructor() : this(OkHttpClient.Builder().connectTimeout(10, TimeUnit.SECONDS).readTimeout(15, TimeUnit.SECONDS)
        .callTimeout(20, TimeUnit.SECONDS).followRedirects(false).followSslRedirects(false).build())
    suspend fun search(query: String): RegistryResults {
        if (!isPublicRegistryQuery(query)) return RegistryResults(emptyList(), false)
        return suspendCancellableCoroutine { continuation ->
        val url = "https://registry.npmjs.org/-/v1/search".toHttpUrl().newBuilder().addQueryParameter("text", query.trim()).addQueryParameter("size", "20").build()
        val call = client.newCall(Request.Builder().url(url).header("Accept", "application/json").build())
        continuation.invokeOnCancellation { call.cancel() }
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) { if (continuation.isActive) continuation.resumeWithException(GatewayFailure("registry-network")) }
            override fun onResponse(call: Call, response: Response) {
                response.use {
                    try {
                        if (!response.isSuccessful) throw GatewayFailure("registry-network")
                        val bytes = java.io.ByteArrayOutputStream()
                        response.body?.byteStream()?.use { input ->
                            val buffer = ByteArray(8192)
                            while (true) { val n = input.read(buffer); if (n < 0) break; if (bytes.size() + n > 1024 * 1024) throw GatewayFailure("response-too-large"); bytes.write(buffer, 0, n) }
                        }
                        val result = wireValue {
                            val json = WireJson.parseToJsonElement(bytes.toString("UTF-8")).jsonObject
                            val items = json.getValue("objects").jsonArray.map { row -> row.jsonObject.getValue("package").jsonObject.let {
                                RegistryPackage(it.string("name"), it.string("version"), it.text("description"))
                            } }
                            RegistryResults(items, json.number("total") > items.size)
                        }
                        if (continuation.isActive) continuation.resume(result)
                    } catch (error: Exception) { if (continuation.isActive) continuation.resumeWithException(error) }
                }
            }
        })
        }
    }
}
