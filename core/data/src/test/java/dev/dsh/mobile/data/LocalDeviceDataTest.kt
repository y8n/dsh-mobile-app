package dev.dsh.mobile.data

import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test
import java.nio.file.Files
import java.time.Instant

class LocalDeviceDataTest {
    @Test fun pinsAreScopedPersistentAndPrunedOnlyByKnownMembership() = runBlocking {
        val dir = Files.createTempDirectory("device-local").toFile()
        var repo = LocalDeviceDataRepository(dir)
        try {
            repo.pin("a", "same", true); repo.pin("b", "same", true); repo.pin("a", "other", true)
            assertEquals(listOf("other", "same"), repo.state.value.pins["a"])
            repo.close(); repo = LocalDeviceDataRepository(dir); repo.flush()
            assertEquals(listOf("same"), repo.state.value.pins["b"])
            repo.prune("a", setOf("other")); assertEquals(listOf("other"), repo.state.value.pins["a"])
            repo.remove("a"); assertFalse(repo.state.value.pins.containsKey("a")); assertEquals(listOf("same"), repo.state.value.pins["b"])
        } finally { repo.close(); dir.deleteRecursively() }
    }
    @Test fun foregroundOnlyClearDoesNotResurrectTimeAndPinsCanBeClearedSeparately() = runBlocking {
        val dir = Files.createTempDirectory("device-local").toFile()
        var wall = Instant.parse("2026-10-15T04:00:00Z").toEpochMilli(); var mono = 0L
        val repo = LocalDeviceDataRepository(dir, { wall }, { mono })
        fun advance(ms: Long) { wall += ms; mono += ms }
        fun total() = repo.state.value.usage["a"].orEmpty().values.sum()
        try {
            repo.focus("a"); advance(1500); repo.checkpoint(); repo.focus(null)
            advance(100000); repo.focus("a"); advance(500); repo.checkpoint(); assertEquals(2000L, total())
            repo.pin("a", "s", true); repo.clear(usage = true, pins = false); assertEquals(0L, total()); assertEquals(listOf("s"), repo.state.value.pins["a"])
            advance(250); repo.checkpoint(); assertEquals(250L, total())
            repo.clear(usage = false, pins = true); assertEquals(250L, total()); assertTrue(repo.state.value.pins.isEmpty())
        } finally { repo.close(); dir.deleteRecursively() }
    }
    @Test fun deletedDevicesCannotReceiveStaleForegroundOrPinWrites() = runBlocking {
        val dir = Files.createTempDirectory("device-local").toFile(); var wall = System.currentTimeMillis(); var mono = 0L
        val repo = LocalDeviceDataRepository(dir, { wall }, { mono })
        try {
            repo.retainDevices(setOf("a", "b")); repo.pin("a", "s", true)
            repo.retainDevices(setOf("b")); repo.foreground("a"); repo.flush(); mono += 1000; wall += 1000; repo.checkpoint()
            assertFalse(repo.state.value.usage.containsKey("a")); assertFalse(repo.state.value.pins.containsKey("a"))
            try { repo.pin("a", "late", true); fail("stale write") } catch (_: dev.dsh.mobile.protocol.GatewayFailure) { }
        } finally { repo.close(); dir.deleteRecursively() }
    }
    @Test fun staleWorkspaceSnapshotCannotPruneNewerPins() = runBlocking {
        val dir = Files.createTempDirectory("device-local").toFile(); val repo = LocalDeviceDataRepository(dir)
        try {
            repo.pin("a", "new", true)
            repo.prune("a", emptySet()) { false }; assertEquals(listOf("new"), repo.state.value.pins["a"])
            repo.prune("a", emptySet()) { true }; assertTrue(repo.state.value.pins["a"].orEmpty().isEmpty())
        } finally { repo.close(); dir.deleteRecursively() }
    }
    @Test fun concurrentUpdatesAreSerializedAndCacheDirectoryHasNoCredentialFiles() = runBlocking {
        val dir = Files.createTempDirectory("device-local").toFile(); val repo = LocalDeviceDataRepository(dir)
        try {
            coroutineScope { repeat(50) { i -> launch { repo.pin("a", "s$i", true) } } }
            assertEquals(50, repo.state.value.pins["a"]!!.size)
            repo.clear(); assertTrue(repo.state.value.pins.isEmpty())
            assertEquals(listOf("device-data.json"), dir.list()!!.toList())
        } finally { repo.close(); dir.deleteRecursively() }
    }
}
