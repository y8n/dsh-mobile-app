package dev.dsh.mobile.protocol

import java.util.concurrent.atomic.AtomicReference

data class VisibleConversation(val deviceId: String, val sessionId: String)
object ConversationVisibility {
    private val target = AtomicReference<VisibleConversation?>(null)
    fun show(deviceId: String, sessionId: String) { target.set(VisibleConversation(deviceId, sessionId)) }
    fun hide() { target.set(null) }
    fun isVisible(deviceId: String, sessionId: String) = target.get() == VisibleConversation(deviceId, sessionId)
}
