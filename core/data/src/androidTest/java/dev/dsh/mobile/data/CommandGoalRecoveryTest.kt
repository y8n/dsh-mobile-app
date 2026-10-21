package dev.dsh.mobile.data

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.test.platform.app.InstrumentationRegistry
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger

class CommandGoalRecoveryTest {
    private class Gateway : DeviceGateway {
        val frames=Channel<JsonObject>(Channel.UNLIMITED)
        val commands=AtomicInteger();val clears=AtomicInteger()
        val prompts=AtomicInteger();val lookups=AtomicInteger();var acceptedLookup=false
        val entered=CompletableDeferred<Unit>();val response=CompletableDeferred<Unit>()
        var values=JsonObject(emptyMap())
        override suspend fun probe()=Unit
        override fun close(){frames.close()}
        override fun followWorkspaces()=flow { emit(buildJsonObject{put("type","baseline");put("value",buildJsonObject{put("items",JsonArray(emptyList()))})});awaitCancellation() }
        override fun follow(endpoint:String,args:JsonObject)=flow {
            if(endpoint=="session/follow") for(frame in frames)emit(frame) else awaitCancellation()
        }
        override suspend fun rpc(method:String,args:JsonObject,mutation:Boolean):JsonElement = when(method) {
            "session/prompt" -> { prompts.incrementAndGet(); throw GatewayFailure("result-unknown") }
            "mobileSearch/lookupPrompt" -> { lookups.incrementAndGet(); val request=args["request"]!!.jsonObject; buildJsonObject { put("sessionId",request["sessionId"]!!);put("requestId",request["requestId"]!!);put("accepted",acceptedLookup);put("throughSeq",0) } }
            "commands/execute" -> {commands.incrementAndGet();entered.complete(Unit);response.await();throw GatewayFailure("result-unknown")}
            "session/projections" -> buildJsonObject{put("asOfSeq",5);put("values",values)}
            "goals/clear" -> {assertEquals(JsonPrimitive("g"),args["ref"]!!.jsonObject["id"]);assertEquals(JsonPrimitive(3),args["ref"]!!.jsonObject["revision"]);clears.incrementAndGet();values=JsonObject(emptyMap());JsonNull}
            "goals/get" -> buildJsonObject{put("id","g");put("revision",3);put("activation","disarmed")}
            else -> JsonObject(emptyMap())
        }
    }
    private fun snapshot(values:JsonObject=JsonObject(emptyMap()), seq:Int=0)=buildJsonObject {
        put("type","snapshot");put("header",buildJsonObject{put("id","s")});put("cursor",seq);put("records",JsonArray(emptyList()));put("hasMore",false)
        put("projections",buildJsonObject{put("asOfSeq",seq);put("values",values)})
    }
    private fun event(seq:Int,type:String,data:JsonObject)=buildJsonObject{put("type","event");put("event",buildJsonObject{put("seq",seq);put("type",type);put("data",data)})}
    private suspend fun fixture(block:suspend (SessionRepository,Gateway)->Unit) {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val root=File(context.cacheDir,"command-recovery-${UUID.randomUUID()}").apply{mkdirs()}
        val disk=CoroutineScope(SupervisorJob()+Dispatchers.IO)
        val store=DeviceStore(PreferenceDataStoreFactory.create(storage=AtomicVaultStorage(VaultPreferencesSerializer){File(root,"vault.preferences_pb")},scope=disk))
        store.update{StoredDevices(listOf(DeviceCredential("d","Fixture","https://fixture.example","0".repeat(64),"d","fixture-only",Long.MAX_VALUE)))}
        val gateway=Gateway();val devices=DeviceRepository(store){gateway}
        try {
            withTimeout(5000){devices.state.first{it.loaded}};devices.select("d");withTimeout(5000){devices.state.first{it.connected}}
            val session=devices.conversations();session.open("s");gateway.frames.send(snapshot());withTimeout(5000){session.state.first{it.connected}}
            block(session,gateway)
        }finally{devices.close();disk.coroutineContext[Job]?.cancelAndJoin();root.deleteRecursively()}
    }
    @Test fun uncertainCompactIsReconciledByCommandDoneWithoutReplay():Unit=runBlocking {
        fixture { session,gateway ->
            val request=launch {try{session.command("/compact");fail("fixture must have uncertain response")}catch(e:GatewayFailure){assertEquals("result-unknown",e.code)}}
            gateway.entered.await();gateway.response.complete(Unit);request.join()
            assertNotNull(session.state.value.pendingCompactAfter);assertNull(session.state.value.pendingRequestId)
            try { session.command("/compact");fail("must not replay an uncertain command") }
            catch(e:GatewayFailure){assertEquals("compact-pending",e.code)}
            gateway.frames.send(event(1,"command/run",buildJsonObject{put("name","compact");put("commandId","c")}))
            gateway.frames.send(event(2,"command/done",buildJsonObject{put("commandId","c");put("kind","success");put("text","done")}))
            withTimeout(5000){session.state.first{it.pendingCompactAfter==null}}
            assertNull(session.state.value.error);assertEquals(1,gateway.commands.get())
        }
    }
    @Test fun completedGoalClearsOnceWithExactRevisionAndActivationReadsRemainSeparate():Unit=runBlocking {
        fixture { session,gateway ->
            session.loadGoalActivation();assertEquals("disarmed",session.state.value.goalActivation?.text("activation"))
            val completed=buildJsonObject{put("goal",buildJsonObject{put("id","g");put("revision",3);put("phase","complete");put("objective","fixture")})}
            gateway.values=buildJsonObject{put("goal",completed)}
            gateway.frames.send(snapshot(gateway.values))
            withTimeout(5000){while(gateway.clears.get()!=1)delay(10)}
            withTimeout(5000){session.state.first{!it.controlsBusy}}
            assertEquals(1,gateway.clears.get());assertNull(session.state.value.projections["goal"])
        }
    }
    @Test fun lateUncertainHttpResponseCannotRestoreErrorAfterDurableCompletion():Unit=runBlocking {
        fixture { session,gateway ->
            val request=launch {try{session.command("/compact")}catch(_:GatewayFailure){}}
            gateway.entered.await()
            gateway.frames.send(event(1,"command/run",buildJsonObject{put("name","compact");put("commandId","c")}))
            gateway.frames.send(event(2,"command/done",buildJsonObject{put("commandId","c");put("kind","success")}))
            withTimeout(5000){session.state.first{it.timeline.cursor==2L}}
            gateway.response.complete(Unit);request.join()
            assertNull(session.state.value.error);assertNull(session.state.value.pendingCompactAfter)
            assertEquals(1,gateway.commands.get())
        }
    }
    @Test fun queuedCleanupCannotDeleteGoalEditedAtNewRevision():Unit=runBlocking {
        fixture { session,gateway ->
            val request=launch {try{session.command("/compact")}catch(_:GatewayFailure){}}
            gateway.entered.await()
            fun goal(revision:Int,phase:String)=buildJsonObject{put("goal",buildJsonObject{put("goal",buildJsonObject{put("id","g");put("revision",revision);put("phase",phase);put("objective","fixture")})})}
            gateway.frames.send(snapshot(goal(3,"complete")))
            withTimeout(5000){session.state.first{((it.projections["goal"] as? JsonObject)?.get("goal") as? JsonObject)?.text("phase")=="complete"}}
            gateway.values=goal(4,"active");gateway.frames.send(snapshot(gateway.values,4))
            withTimeout(5000){session.state.first{((it.projections["goal"] as? JsonObject)?.get("goal") as? JsonObject)?.get("revision")==JsonPrimitive(4)}}
            gateway.response.complete(Unit);request.join();delay(100)
            assertEquals(0,gateway.clears.get())
        }
    }
    @Test fun pendingPromptCanBeReleasedWithoutResendOrLosingEditedDraft():Unit=runBlocking {
        fixture { session,gateway ->
            session.setDraft("original")
            try { session.send(); fail("uncertain send expected") } catch(e:GatewayFailure) { assertEquals("result-unknown",e.code) }
            val pending=session.state.value.pendingRequestId!!
            withTimeout(5000){while(gateway.lookups.get()<1)delay(10)}
            session.setDraft("new draft")
            session.releasePendingPrompt("different-request")
            assertEquals(pending,session.state.value.pendingRequestId)
            session.releasePendingPrompt(pending)
            assertNull(session.state.value.pendingRequestId);assertEquals("new draft",session.state.value.draft)
            assertEquals(1,gateway.prompts.get())
            session.closeSession();session.open("s");gateway.frames.send(snapshot())
            withTimeout(5000){session.state.first{it.connected}}
            assertNull(session.state.value.pendingRequestId);assertEquals("new draft",session.state.value.draft)
        }
    }
    @Test fun delayedPositiveLookupSettlesPendingWithoutReplayingPrompt():Unit=runBlocking {
        fixture { session,gateway ->
            session.setDraft("original")
            try { session.send();fail("uncertain send expected") } catch(e:GatewayFailure) { assertEquals("result-unknown",e.code) }
            withTimeout(5000){while(gateway.lookups.get()<1)delay(10)}
            assertNotNull(session.state.value.pendingRequestId)
            gateway.acceptedLookup=true
            withTimeout(7000){session.state.first{it.pendingRequestId==null}}
            assertEquals(1,gateway.prompts.get());assertEquals("",session.state.value.draft)
        }
    }
}
