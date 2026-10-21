package dev.dsh.mobile.ui

import androidx.lifecycle.SavedStateHandle
import org.junit.Assert.*
import org.junit.Test

class PreviewViewModelTest {
    @Test fun blankDraftDoesNotEnterRunningState() {
        val vm = PreviewViewModel(SavedStateHandle())
        vm.draft("   ")
        vm.send("preview.png")
        assertFalse(vm.state.value.running)
        assertNull(vm.state.value.lastMessage)
    }
    @Test fun sendConsumesDraftAndStopKeepsTheMessage() {
        val vm = PreviewViewModel(SavedStateHandle())
        vm.draft("hello")
        vm.send("preview.png")
        assertEquals("", vm.state.value.draft)
        assertEquals("hello", vm.state.value.lastMessage)
        assertTrue(vm.state.value.running)
        vm.stop()
        assertFalse(vm.state.value.running)
        assertEquals("hello", vm.state.value.lastMessage)
    }
    @Test fun attachmentCanBeSentWithoutText() {
        val vm = PreviewViewModel(SavedStateHandle())
        vm.attachment(true)
        vm.send("preview.png")
        assertEquals("preview.png", vm.state.value.lastMessage)
        assertFalse(vm.state.value.attachment)
    }
    @Test fun savedStateRestoresDraftAndSelections() {
        val handle = SavedStateHandle()
        val vm = PreviewViewModel(handle)
        vm.preview(true); vm.draft("draft"); vm.permission("read_only"); vm.model("deepseek_chat")
        val restored = PreviewViewModel(handle).state.value
        assertEquals("draft", restored.draft)
        assertEquals("read_only", restored.permission)
        assertEquals("deepseek_chat", restored.modelId)
        assertTrue(restored.preview)
    }
    @Test fun newConversationDoesNotReusePreviousMessagesOrPendingAttachments() {
        val vm = PreviewViewModel(SavedStateHandle())
        vm.draft("previous message"); vm.send("preview.png"); vm.attachment(true); vm.pin()
        vm.newConversation()
        assertNull(vm.state.value.lastMessage)
        assertFalse(vm.state.value.running)
        assertFalse(vm.state.value.attachment)
        assertFalse(vm.state.value.pinned)
    }
}
