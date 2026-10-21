package dev.dsh.mobile.data

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class WorkspaceGitReaderTest {
    @Test fun branchesAndDetachedHeadAreValidated() {
        assertEquals("feature/mobile", WorkspaceGitReader.parseHead("ref: refs/heads/feature/mobile\n"))
        assertEquals("main", WorkspaceGitReader.parseHead("ref: refs/heads/main\n")) // unborn branch
        assertEquals("分离 HEAD · aaaaaaa", WorkspaceGitReader.parseHead("a".repeat(40)))
        listOf("", "ref: refs/tags/v1", "ref: refs/heads/", "ref: refs/heads/a\nb", "broken").forEach { assertNull(WorkspaceGitReader.parseHead(it)) }
    }
    @Test fun nestedDirectoryFindsNearestRepositoryAndRefreshReadsNewHead(): Unit = runBlocking {
        var head = "ref: refs/heads/main"
        val reader = WorkspaceGitReader { if (it == "/repo/.git/HEAD") head else null }
        assertEquals("main", reader.branch("/repo/sub"))
        head = "ref: refs/heads/feature/new"
        assertEquals("feature/new", reader.branch("/repo/sub"))
    }
    @Test fun worktreeResolvesGitdirRelativeToDotGitFile(): Unit = runBlocking {
        val files = mapOf("/trees/one/.git" to "gitdir: ../../repo/.git/worktrees/one\n", "/trees/one/../../repo/.git/worktrees/one/HEAD" to "ref: refs/heads/worktree")
        assertEquals("worktree", WorkspaceGitReader { files[it] }.branch("/trees/one"))
    }
    @Test fun absentAndCorruptRepositoriesStayHiddenAndRequestsAreBounded(): Unit = runBlocking {
        var reads = 0
        assertNull(WorkspaceGitReader { reads++; null }.branch("/plain/folder"))
        assertTrue(reads <= 6)
        assertNull(WorkspaceGitReader { if (it == "/plain/.git") "bad pointer" else null }.branch("/plain"))
        assertNull(WorkspaceGitReader { "bad HEAD" }.branch("/plain"))
        assertNull(WorkspaceGitReader { error("must not read") }.branch("relative/path"))
    }
    @Test fun windowsWorktreeAndAbsoluteGitdir(): Unit = runBlocking {
        val files = mapOf("C:/work/.git" to "gitdir: D:/meta/work", "D:/meta/work/HEAD" to "ref: refs/heads/windows")
        assertEquals("windows", WorkspaceGitReader { files[it] }.branch("C:\\work"))
    }
}
