package dev.dsh.mobile.protocol

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class DeviceConnectionsTest {
    private fun route(id: String) = DeviceConnection(id,id,"https://$id.example","same",id,"token-$id",Long.MAX_VALUE)
    private fun device() = DeviceCredential("device","Computer","https://lan.example","same","lan","token-lan",Long.MAX_VALUE,
        connections=listOf(route("lan"),route("tunnel")),connectionMode="priority",preferredConnectionId="lan")
    private class Fake(val id:String):DeviceGateway {
        var available=true;var failure="network-unavailable";var failRead=false;var writes=0;var reads=0;var uploads=0
        override suspend fun probe(){if(!available)throw GatewayFailure(failure)}
        override suspend fun rpc(method:String,args:JsonObject,mutation:Boolean):JsonElement {
            if(mutation){writes++;throw GatewayFailure("result-unknown")}
            reads++;if(failRead)throw GatewayFailure("network-unavailable");return JsonPrimitive(id)
        }
        override fun followWorkspaces()=flow { emit(buildJsonObject{put("route",id)});throw GatewayFailure("network-unavailable") }
        override suspend fun upload(sessionId:String,name:String,bytes:ByteArray):JsonObject{uploads++;throw GatewayFailure("result-unknown")}
        override fun close()=Unit
    }
    @Test fun manualSelectionKeepsIndependentCredentialAndNormalizesLegacyPreference():Unit=runBlocking {
        val old=device().copy(preferredConnectionId="tunnel")
        val normalized=old.manualConnections()
        assertEquals("fixed",normalized.connectionMode);assertEquals("tunnel",normalized.preferredConnectionId)
        assertEquals(old.connections,normalized.connections)
        val created=mutableListOf<String>()
        val gateway=RoutedDeviceGateway(old,{c->created+=c.deviceId;assertEquals("token-tunnel",c.deviceToken);assertEquals("https://tunnel.example",c.origin);Fake(c.deviceId)})
        assertEquals("tunnel",gateway.rpc("read").jsonPrimitive.content)
        gateway.probe();assertEquals(listOf("tunnel"),created)
        assertEquals("lan",old.copy(preferredConnectionId="missing").manualConnections().preferredConnectionId)
        val legacy=old.copy(connections=emptyList(),connectionMode="fixed",preferredConnectionId=null)
        assertEquals(legacy,legacy.manualConnections())
    }
    @Test fun legacyPriorityCannotEnableFallbackOrHideSecurityErrors():Unit=runBlocking {
        val lan=Fake("lan").apply{available=false};var tunnelCreated=false
        val gateway=RoutedDeviceGateway(device(),{if(it.deviceId=="lan")lan else Fake("tunnel").also{tunnelCreated=true}})
        try{gateway.probe();fail("must not fall back")}catch(e:GatewayFailure){assertEquals("network-unavailable",e.code)}
        lan.failure="certificate-failed"
        try{gateway.probe();fail("must expose trust failure")}catch(e:GatewayFailure){assertEquals("certificate-failed",e.code)}
        assertFalse(tunnelCreated)
        try{RoutedDeviceGateway(device().copy(connections=listOf(route("lan").copy(instanceId="foreign"))));fail("foreign identity")}catch(_:IllegalArgumentException){}
    }
    @Test fun readsWritesAndUploadsNeverSwitchOrReplay():Unit=runBlocking {
        val lan=Fake("lan");var tunnelCreated=false
        val gateway=RoutedDeviceGateway(device(),{if(it.deviceId=="lan")lan else Fake("tunnel").also{tunnelCreated=true}})
        gateway.probe();lan.failRead=true
        try{gateway.rpc("read");fail("read failure")}catch(_:GatewayFailure){}
        try{gateway.rpc("write",mutation=true);fail("unknown write")}catch(e:GatewayFailure){assertEquals("result-unknown",e.code)}
        try{gateway.upload("s","file",byteArrayOf(1));fail("unknown upload")}catch(_:GatewayFailure){}
        assertEquals(1,lan.reads);assertEquals(1,lan.writes);assertEquals(1,lan.uploads);assertFalse(tunnelCreated)
    }
    @Test fun subscriptionFailurePropagatesWithoutCreatingAnotherOrigin():Unit=runBlocking {
        var tunnelCreated=false;val rows=mutableListOf<String>()
        val gateway=RoutedDeviceGateway(device(),{Fake(it.deviceId).also{_->if(it.deviceId=="tunnel")tunnelCreated=true}})
        try{gateway.followWorkspaces().collect{rows+=it.text("route")};fail("stream failure")}catch(e:GatewayFailure){assertEquals("network-unavailable",e.code)}
        assertEquals(listOf("lan"),rows);assertFalse(tunnelCreated)
    }
}
