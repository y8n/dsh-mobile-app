package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class CompactionPresentationTest {
    private fun event(seq:Long,type:String,data:JsonObject,replace:Boolean=false)=buildJsonObject {
        put("seq",seq);put("type",type);put("data",data)
        if(replace)put("surfaceOp",buildJsonObject { put("op","replace");put("startSeq",0);put("endSeq",1) })
    }
    private fun checkpoint(seq:Long=4,summary:Boolean=true):Map<Long,JsonObject> {
        val rows=linkedMapOf<Long,JsonObject>(
            0L to event(0,"user/message",buildJsonObject { put("content",buildJsonArray{add(buildJsonObject{put("type","text");put("text","原始问题")})}) }),
            2L to event(2,"command/run",buildJsonObject{put("name","compact");put("commandId","cmd")}),
            seq to event(seq,"user/message",buildJsonObject {
                put("source",buildJsonObject{put("kind","compact-checkpoint");put("compactionId","c");put("sourceCommandId","cmd")})
                put("content",buildJsonArray{add(buildJsonObject{put("type","text");put("text","压缩后的模型上下文")})})
            },true)
        )
        if(summary)rows[3]=event(3,"compaction/summary",buildJsonObject{put("compactionId","c");put("shadowedSeqs",JsonArray(listOf(JsonPrimitive(0),JsonPrimitive(1))));put("shadowedTokenCount",60334);put("summary",buildJsonArray{add(buildJsonObject{put("type","text");put("text","摘要正文")})})})
        return rows
    }
    @Test fun manualCheckpointUsesSummaryAndRetainsChatHistory() {
        val timeline=Timeline(events=checkpoint())
        assertEquals(1,timeline.messages.count{it.kind=="compact"})
        assertTrue(timeline.messages.any{it.kind=="user"&&it.text=="原始问题"})
        assertFalse(timeline.messages.any{it.text=="压缩后的模型上下文"})
        val marker=timeline.messages.single{it.kind=="compact"}
        assertEquals("compact · 已压缩 2 条历史记录（约 60334 tokens）",marker.text)
        assertEquals("摘要正文",marker.detail)
        assertTrue(sessionTranscript(timeline).any{it.message?.kind=="compact"&&it.owner==null})
    }
    @Test fun pagedCheckpointWithoutSummaryDoesNotInventCounts() {
        val marker=compactionRows(checkpoint(summary=false).filterKeys{it>=4}).single()
        assertEquals("compact · 上下文已压缩",marker.text);assertTrue(marker.detail.isEmpty())
    }
    @Test fun runningAndRejectedCommandsHaveTheirOwnMarker() {
        val run=checkpoint().filterKeys{it==2L}
        assertEquals("compact · 正在压缩上下文…",compactionRows(run).single().text)
        val error=event(5,"command/done",buildJsonObject{put("commandId","cmd");put("kind","error");put("text","模型暂不可用")})
        assertEquals("compact · 压缩失败",compactionRows(run+(5L to error)).single().text)
        assertEquals(false,compactSettlement(Timeline(events=run+(5L to error)),1))
    }
    @Test fun settlementIgnoresNormalRepliesOldCheckpointsAndAmbiguousCommands() {
        assertEquals(true,compactSettlement(Timeline(events=checkpoint()),1))
        assertNull(compactSettlement(Timeline(events=checkpoint()),4))
        assertNull(compactSettlement(Timeline(events=checkpoint().filterKeys{it==0L}),-1))
        val other=event(6,"command/run",buildJsonObject{put("name","compact");put("commandId","other")})
        assertNull(compactSettlement(Timeline(events=checkpoint()+(6L to other)),1))
    }
}
