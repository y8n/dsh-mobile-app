package dev.dsh.mobile.protocol
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
class DiagnosticHourTest {
    private fun event(at:Long, seq:Long)=buildJsonObject{put("at",at);put("seq",seq)}
    @Test fun manualFlushAndLaterEventsShareArchiveButNextHourDoesNot(){
        val first=event(3600001,1);val later=event(7199999,2);val next=event(7200000,3)
        assertEquals(listOf(first,later),hourlyDiagnosticBatch(listOf(first,later,next)))
        val key=diagnosticArchiveKey("journal",diagnosticHour(first),diagnosticPart(first))
        assertEquals(key,diagnosticArchiveKey("journal",diagnosticHour(later),diagnosticPart(later)))
        assertEquals("hours/1970-01-01/01/journal/part-00000000.json",key)
        assertNotEquals(key,diagnosticArchiveKey("journal",diagnosticHour(next),diagnosticPart(next)))
    }
    @Test fun transportSizeAndLargeHourRolloverAreBounded(){
        assertEquals(500,hourlyDiagnosticBatch(List(501){event(1,it.toLong())}).size)
        assertEquals(1,hourlyDiagnosticBatch(listOf(event(1,9999),event(1,10000))).size)
    }
}
