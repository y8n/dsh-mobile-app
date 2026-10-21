package dev.dsh.mobile.data

import android.system.Os
import androidx.datastore.core.*
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File
import java.io.FileOutputStream
import java.io.FileInputStream
import java.io.IOException
import java.util.concurrent.atomic.AtomicBoolean

/** Single-process DataStore storage with a synced, atomic file replacement.
 * Keep the committed file in place until rename(2); Files.move(REPLACE_EXISTING)
 * on Android can remove the destination before renaming the staging file.
 * This protects process interruption, not a claim of power-loss durability.
 */
class AtomicVaultStorage<T>(private val serializer: Serializer<T>, private val produceFile: () -> File) : Storage<T> {
    override fun createConnection(): StorageConnection<T> {
        val file = produceFile().canonicalFile
        fun checkLegacyCommit() {
            if (!file.exists() && File(file.path + ".tmp").exists())
                throw IOException("Interrupted vault commit requires recovery")
        }
        checkLegacyCommit()
        // Retain DataStore's canonical-path ownership and coordinator. Reads
        // use its serializer/error handling; both scopes share our mutex.
        val delegate = FileStorage(serializer, produceFile = { file }).createConnection()
        val mutex = Mutex()
        val closed = AtomicBoolean()
        return object : StorageConnection<T> {
            override val coordinator get() = delegate.coordinator
            override suspend fun <R> readScope(block: suspend ReadScope<T>.(locked: Boolean) -> R): R = mutex.withLock {
                check(!closed.get()); checkLegacyCommit()
                delegate.readScope(block)
            }
            override suspend fun writeScope(block: suspend WriteScope<T>.() -> Unit) = mutex.withLock {
                check(!closed.get()); checkLegacyCommit()
                var active = true
                var staged: File? = null
                val view = object : WriteScope<T> {
                    override suspend fun readData(): T {
                        check(active && !closed.get())
                        val pending = staged
                        return if (pending != null) FileInputStream(pending).use { serializer.readFrom(it) }
                            else delegate.readScope { readData() }
                    }
                    override suspend fun writeData(value: T) {
                        check(active && !closed.get())
                        val parent = file.parentFile ?: throw IOException("Vault directory unavailable")
                        if (!parent.isDirectory && !parent.mkdirs()) throw IOException("Vault directory unavailable")
                        val staging = File.createTempFile(file.name + ".atomic-", ".tmp", parent)
                        try {
                            FileOutputStream(staging).use { stream ->
                                serializer.writeTo(value, stream)
                                stream.flush(); stream.fd.sync()
                            }
                            currentCoroutineContext().ensureActive()
                            staged?.delete(); staged = staging
                        } catch (failure: Throwable) { staging.delete(); throw failure }
                    }
                    override fun close() { active = false }
                }
                try {
                    view.block()
                    currentCoroutineContext().ensureActive()
                    // Commit only after the entire write scope succeeds.
                    // POSIX rename has no unlink-then-rename interruption gap.
                    staged?.let { Os.rename(it.path, file.path) }
                } finally { view.close(); staged?.delete() }
                Unit
            }
            override fun close() { if (closed.compareAndSet(false, true)) delegate.close() }
        }
    }
}
