package dev.dsh.mobile.protocol

import kotlinx.coroutines.runBlocking
import okhttp3.*
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CopyOnWriteArrayList

class RegistrySearchTest {
    private fun client(requests: MutableList<Request>) = OkHttpClient.Builder().addInterceptor { chain ->
        requests.add(chain.request())
        Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
            .body("{\"objects\":[],\"total\":0}".toResponseBody()).build()
    }.build()
    @Test fun pathsAndPackageAddressesNeverStartPublicRequests() = runBlocking {
        val requests = CopyOnWriteArrayList<Request>(); val registry = PublicRegistrySearch(client(requests))
        for (q in listOf("/Users/owner/private/project", "./private-plugin", "../private-plugin", "~/private-plugin", "C:\\private\\plugin",
            "https://host/plugin.tgz?token=secret", "git@host:private/plugin.git", "github:private/plugin", "file:private-plugin", "bundle.tgz", "bundle.tar.gz", "private/path", "", "x".repeat(201))) {
            assertFalse(q, isPublicRegistryQuery(q)); assertEquals(RegistryResults(emptyList(), false), registry.search(q))
        }
        assertTrue(requests.isEmpty())
    }
    @Test fun keywordsAndScopedPackagesRetainPublicDiscovery() = runBlocking {
        val requests = CopyOnWriteArrayList<Request>(); val registry = PublicRegistrySearch(client(requests))
        for (q in listOf("is-number", "is-number@7.0.0", "@scope/plugin", "@scope/plugin@^2.0.0", "editor tools", "编辑器")) {
            assertTrue(q, isPublicRegistryQuery(q)); registry.search(q)
            assertEquals(q, requests.last().url.queryParameter("text")); assertEquals("registry.npmjs.org", requests.last().url.host)
            assertNull(requests.last().header("Cookie")); assertNull(requests.last().header("Authorization"))
        }
        assertEquals(6, requests.size)
    }
}
