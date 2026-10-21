package dev.dsh.mobile.ui

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

data class PreviewState(
    val preview: Boolean = false, val draft: String = "", val running: Boolean = false,
    val modelId: String = "openai_61", val permission: String = "default",
    val workspaceName: String = "dsh-mobile-app", val directory: String = "",
    val lastMessage: String? = null, val attachment: Boolean = false,
    val pinned: Boolean = false, val secondDevice: Boolean = false,
)

/** Only local design-preview state lives here. M2 repositories will own connected devices. */
class PreviewViewModel(private val saved: SavedStateHandle) : ViewModel() {
    private val mutableState = MutableStateFlow(PreviewState(
        preview = saved["preview"] ?: false, draft = saved["draft"] ?: "", running = saved["running"] ?: false,
        modelId = saved["model"] ?: "openai_61", permission = saved["permission"] ?: "default",
        workspaceName = saved["workspace"] ?: "dsh-mobile-app", directory = saved["directory"] ?: "",
        lastMessage = saved["message"], attachment = saved["attachment"] ?: false,
        pinned = saved["pinned"] ?: false,
        secondDevice = saved["secondDevice"] ?: false,
    ))
    val state = mutableState.asStateFlow()
    private fun update(next: PreviewState) {
        mutableState.value = next
        saved["preview"] = next.preview; saved["draft"] = next.draft; saved["running"] = next.running
        saved["model"] = next.modelId; saved["permission"] = next.permission
        saved["workspace"] = next.workspaceName; saved["directory"] = next.directory
        saved["message"] = next.lastMessage; saved["attachment"] = next.attachment
        saved["pinned"] = next.pinned; saved["secondDevice"] = next.secondDevice
    }
    fun preview(value: Boolean) = update(mutableState.value.copy(preview = value))
    fun draft(value: String) = update(mutableState.value.copy(draft = value))
    fun permission(value: String) = update(mutableState.value.copy(permission = value))
    fun model(value: String) = update(mutableState.value.copy(modelId = value))
    fun directory(value: String) = update(mutableState.value.copy(directory = value))
    fun workspace(value: String) = update(mutableState.value.copy(workspaceName = value))
    fun attachment(value: Boolean) = update(mutableState.value.copy(attachment = value))
    fun toggleRunning() = update(mutableState.value.copy(running = !mutableState.value.running))
    fun stop() = update(mutableState.value.copy(running = false))
    fun pin() = update(mutableState.value.copy(pinned = !mutableState.value.pinned))
    fun device(value: Boolean) = update(mutableState.value.copy(secondDevice = value))
    fun newConversation() = update(mutableState.value.copy(draft = "", running = false,
        lastMessage = null, attachment = false, pinned = false))
    fun send(attachmentLabel: String) {
        val current = mutableState.value
        if (current.draft.isBlank() && !current.attachment) return
        update(current.copy(lastMessage = current.draft.takeIf { it.isNotBlank() } ?: attachmentLabel,
            draft = "", attachment = false, running = true))
    }
}
