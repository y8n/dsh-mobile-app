package dev.dsh.mobile.protocol

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class SessionNotificationCopyTest {
    private fun event(confirmation: Boolean = false, permission: Boolean = false, preview: String = "", title: String = "") =
        SessionNotificationEvent("s:turn:1", "s", confirmation, 1000, permission, title, preview)
    @Test fun completedQuestionAndPermissionHaveDistinctCopyAndNoDeviceName() {
        assertEquals(SessionNotificationCopy("日报", "AI 已回复 · 已整理完成"), sessionNotificationCopy(event(preview = "**已整理完成**", title = "日报")))
        assertEquals(SessionNotificationCopy("保留音频吗？", "等待你的回答 · 日报"), sessionNotificationCopy(event(true, preview = "保留音频吗？", title = "日报")))
        assertEquals(SessionNotificationCopy("允许 AI 执行终端命令？", "需要你的授权 · 修复项目"), sessionNotificationCopy(event(true, true, "允许 AI 执行终端命令？", "修复项目")))
        assertEquals(SessionNotificationCopy("AI 已回复", "AI 已回复，点击查看"), sessionNotificationCopy(event()))
        assertEquals(SessionNotificationCopy("AI 等待你的回答", "等待你的回答"), sessionNotificationCopy(event(true)))
        assertEquals(SessionNotificationCopy("AI 请求操作权限", "需要你的授权"), sessionNotificationCopy(event(true, true)))
    }
    @Test fun copyStripsCodeMarkdownAndBidiAndTruncatesUnicodeWithoutBrokenSurrogates() {
        val copy = sessionNotificationCopy(event(preview = "```sh\nsecret\n```\n# **结果**\u202e\n[日报](https://secret.example/token)"))
        assertEquals("AI 已回复 · 结果 日报", copy.body)
        val long = sessionNotificationCopy(event(true, preview = "😀".repeat(100)))
        assertEquals(80, long.title.codePointCount(0, long.title.length))
        assertTrue(long.title.endsWith("…"))
    }
    private fun raw() = buildJsonObject {
        put("id", "s:turn:1"); put("sessionId", "s"); put("kind", "confirmation"); put("at", 1000)
        put("noticeType", "permission"); put("preview", "允许 AI 修改文件？"); put("sessionTitle", "项目")
    }
    @Test fun optionalFieldsRetainOldVersionAndValidateKindsAndBounds() {
        val permission = notificationEvent(raw(), true)
        assertEquals(SessionNotificationKind.PERMISSION, permission.kind); assertEquals("项目", permission.sessionTitle)
        val old = JsonObject(raw() - setOf("noticeType", "preview", "sessionTitle"))
        assertEquals(SessionNotificationKind.QUESTION, notificationEvent(old, true).kind)
        for (bad in listOf(raw() + ("preview" to JsonPrimitive("x".repeat(1025))), raw() + ("noticeType" to JsonPrimitive("unknown")), raw() + ("kind" to JsonPrimitive("completed")))) {
            try { notificationEvent(JsonObject(bad), true); fail("invalid preview admitted") } catch (_: IllegalArgumentException) { }
        }
    }
    @Test fun optionalEnrichmentKeepsNamedArgumentsAndFallsBackOnMissingSlowOrWrongSession() = runBlocking {
        val original = event()
        var mode = "good"
        val gateway = object : DeviceGateway {
            override fun close() = Unit
            override suspend fun probe() = Unit
            override fun followWorkspaces(): Flow<JsonObject> = error("unused")
            override suspend fun rpc(method: String, args: JsonObject, mutation: Boolean): JsonElement {
                assertEquals("mobileNotifications/details", method); assertFalse(mutation)
                assertEquals(setOf("request"), args.keys); assertEquals(original.id, args.getValue("request").jsonObject.text("id"))
                if (mode == "missing") throw GatewayFailure("method-not-found")
                if (mode == "slow") delay(1000)
                return buildJsonObject {
                    put("id", original.id); put("sessionId", if (mode == "foreign") "foreign" else "s"); put("kind", "completed"); put("at", 1000)
                    put("preview", "完成"); put("sessionTitle", "日报")
                }
            }
        }
        assertEquals("日报", gateway.notificationForDisplay(original).sessionTitle)
        for (value in listOf("missing", "slow", "foreign")) { mode = value; assertEquals(original, gateway.notificationForDisplay(original, 30)) }
        mode = "slow"
        val cancelled = async { gateway.notificationForDisplay(original) }
        yield(); cancelled.cancel()
        try { cancelled.await(); fail("parent cancellation swallowed") } catch (_: CancellationException) { }
    }
}
