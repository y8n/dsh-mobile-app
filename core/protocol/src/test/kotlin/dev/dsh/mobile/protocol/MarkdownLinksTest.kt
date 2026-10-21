package dev.dsh.mobile.protocol

import org.junit.Assert.*
import org.junit.Test

class MarkdownLinksTest {
    @Test fun relativeLinksKeepSessionBaseAndNestedDocumentsUseTheirOwnDirectory() {
        assertEquals(MarkdownLink.File("docs/builds.json"), markdownLink("docs/builds.json"))
        assertEquals(MarkdownLink.File("/repo/docs/../assets/a.png"), markdownLink("../assets/a.png", "/repo/docs/readme.md"))
        assertEquals(MarkdownLink.File("/next.md"), markdownLink("next.md", "/readme.md"))
        assertEquals(MarkdownLink.File("/repo/docs/read me+1.md"), markdownLink("read%20me+1.md", "/repo/docs/index.md"))
    }
    @Test fun absoluteFileUrisWindowsAndLineSuffixes() {
        assertEquals(MarkdownLink.File("/Users/me/a.md"), markdownLink("file:///Users/me/a.md#L30"))
        assertEquals(MarkdownLink.File("/Users/me/a.md"), markdownLink("/Users/me/a.md#L30"))
        assertEquals(MarkdownLink.File("C:/repo/a.md"), markdownLink("file:///C:/repo/a.md"))
        assertEquals(MarkdownLink.File("C:/repo/a.md"), markdownLink("C:\\repo\\a.md"))
        assertEquals(MarkdownLink.File("C:/repo/sub/x.md"), markdownLink("x.md", "C:\\repo\\sub\\index.md"))
        assertEquals(MarkdownLink.File("/repo/a#b.md"), markdownLink("/repo/a%23b.md"))
    }
    @Test fun sourceLineSuffixDoesNotBecomePartOfFilename() {
        assertEquals(MarkdownLink.File("/repo/a.kt"), markdownLink("/repo/a.kt:12:5"))
        assertEquals(MarkdownLink.File("docs/a.md"), markdownLink("docs/a.md:12"))
        assertEquals(MarkdownLink.File("/repo/a:12"), markdownLink("/repo/a%3A12"))
    }
    @Test fun websitesAndAnchorsAreNeverMistakenForFiles() {
        assertEquals(MarkdownLink.Web("https://example.com/x?q=1#hi"), markdownLink("https://example.com/x?q=1#hi"))
        assertEquals(MarkdownLink.Anchor("heading"), markdownLink("#heading"))
        listOf("javascript:alert(1)", "content://local/a", "file://another-host/a", "//another-host/a", "~/secret", "a%00b", "bad%zz").forEach { assertEquals(it, MarkdownLink.Unsupported, markdownLink(it)) }
    }
    @Test fun officialResourcesRemainBoundToCurrentSession() {
        assertEquals(MarkdownLink.File("/repo/a.md"), markdownLink("dsh-resource://file/session/s/repo/a.md", sessionId = "s"))
        assertEquals(MarkdownLink.Unsupported, markdownLink("dsh-resource://file/session/other/repo/a.md", sessionId = "s"))
        assertEquals(MarkdownLink.File("/repo/a.md"), markdownLink("dsh-resource://file/absolute/repo/a.md"))
    }
}
