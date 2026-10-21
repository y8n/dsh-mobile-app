package dev.dsh.mobile.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

@Composable
fun DshTopBar(title: String, subtitle: String? = null, onBack: (() -> Unit)? = null,
              titleAction: (() -> Unit)? = null, centerTitle: Boolean = onBack != null && subtitle == null,
              subtitleContent: (@Composable () -> Unit)? = null, actions: @Composable RowScope.() -> Unit = {}) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        if (onBack != null) IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Outlined.KeyboardArrowLeft, stringResource(R.string.back), Modifier.size(22.dp))
        }
        Column(Modifier.weight(1f).then(if (titleAction != null) Modifier.clickable(onClick = titleAction) else Modifier).padding(8.dp),
            horizontalAlignment = if (centerTitle) Alignment.CenterHorizontally else Alignment.Start) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.then(if (centerTitle) Modifier.wrapContentWidth() else Modifier)) {
                Text(title, Modifier.weight(1f, fill = false), style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (titleAction != null) Icon(Icons.Outlined.KeyboardArrowDown, null, Modifier.size(20.dp))
            }
            if (subtitleContent != null) subtitleContent() else if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = DshColors.Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (centerTitle) Row(Modifier.widthIn(min = 48.dp), horizontalArrangement = Arrangement.End) { actions() } else actions()
    }
}

data class PermissionOption(val id: String, val title: String, val description: String)
data class ModelOption(val id: String, val title: String, val providerId: String? = null, val modelId: String = id, val reasoningEffort: String? = null)
data class ProviderModels(val title: String, val models: List<ModelOption>)

/** Send and stop are distinct actions: only a running, empty composer shows stop. */
@Composable
fun MessageComposer(text: String, onTextChange: (String) -> Unit, running: Boolean,
                    modelName: String, permissions: List<PermissionOption>, selectedPermission: String,
                    onPermission: (String) -> Unit, onModel: () -> Unit, onAttachment: () -> Unit,
                    onSend: () -> Unit, onStop: () -> Unit, attachmentName: String? = null,
                    onRemoveAttachment: () -> Unit = {}, modifier: Modifier = Modifier, submissionEnabled: Boolean = true, controlsEnabled: Boolean = true, attachmentEnabled: Boolean = true, modelEnabled: Boolean = controlsEnabled) {
    var permissionExpanded by remember { mutableStateOf(false) }
    val canSend = text.isNotBlank() || attachmentName != null
    val stopping = running && !canSend
    Surface(modifier.fillMaxWidth(), shape = RoundedCornerShape(28.dp), color = DshColors.Soft) {
        Column(Modifier.padding(horizontal = 12.dp, vertical = 12.dp)) {
            if (attachmentName != null) Row(Modifier.padding(start = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Description, null, Modifier.size(18.dp), tint = DshColors.Muted)
                Text(attachmentName, Modifier.weight(1f).padding(start = 6.dp), style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                IconButton(onClick = onRemoveAttachment) { Icon(Icons.Outlined.Close, stringResource(R.string.remove_attachment), Modifier.size(18.dp)) }
            }
            val inputDescription = stringResource(R.string.composer_hint)
            BasicTextField(text, onTextChange,
                Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp).heightIn(min = 40.dp)
                    .testTag("composer_input").semantics { contentDescription = inputDescription },
                textStyle = MaterialTheme.typography.bodyLarge.copy(color = DshColors.Ink), maxLines = 5,
                decorationBox = { field -> Box { if (text.isEmpty()) Text(inputDescription, color = DshColors.Muted, style = MaterialTheme.typography.bodyLarge); field() } })
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onAttachment, enabled = attachmentEnabled) { Icon(Icons.Outlined.Add, stringResource(R.string.attachment), tint = DshColors.Muted) }
                Box {
                    IconButton(onClick = { permissionExpanded = true }, enabled = controlsEnabled, modifier = Modifier.testTag("composer_permission")) {
                        Icon(Icons.Outlined.Shield, stringResource(R.string.permission), tint = DshColors.Muted)
                    }
                    DropdownMenu(expanded = permissionExpanded, onDismissRequest = { permissionExpanded = false }, containerColor = DshColors.Overlay) {
                        permissions.forEach { option ->
                            DropdownMenuItem(
                                text = { Column(Modifier.widthIn(max = 230.dp)) { Text(option.title); Text(option.description, style = MaterialTheme.typography.bodySmall, color = DshColors.Muted) } },
                                leadingIcon = { Icon(if (selectedPermission == option.id) Icons.Outlined.CheckCircle else Icons.Outlined.RadioButtonUnchecked, null) },
                                onClick = { onPermission(option.id); permissionExpanded = false },
                                modifier = Modifier.testTag("permission_${option.id}").semantics { selected = selectedPermission == option.id })
                        }
                    }
                }
                TextButton(onClick = onModel, enabled = modelEnabled, modifier = Modifier.weight(1f).testTag("composer_model"), contentPadding = PaddingValues(horizontal = 6.dp)) {
                    Text(modelName, Modifier.weight(1f, fill = false), maxLines = 1, overflow = TextOverflow.Ellipsis, color = DshColors.Ink)
                    Icon(Icons.Outlined.KeyboardArrowDown, stringResource(R.string.model), Modifier.size(18.dp), tint = DshColors.Muted)
                }
                IconButton(onClick = if (stopping) onStop else onSend, enabled = (canSend || stopping) && submissionEnabled,
                    modifier = Modifier.size(48.dp).clip(CircleShape).background(if (canSend || stopping) DshColors.Ink else DshColors.Line)
                        .testTag(if (stopping) "composer_stop" else "composer_send")) {
                    Icon(if (stopping) Icons.Outlined.Stop else Icons.AutoMirrored.Outlined.Send,
                        stringResource(if (stopping) R.string.stop else R.string.send), tint = if (canSend || stopping) DshColors.OnInk else DshColors.Muted, modifier = Modifier.size(24.dp))
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModelPicker(title: String, groups: List<ProviderModels>, selected: String, onSelect: (ModelOption) -> Unit, onDismiss: () -> Unit, lastUsed: String? = null) {
    var query by remember { mutableStateOf("") }
    val visible = groups.map { group -> group.copy(models = group.models.filter { group.title.contains(query, true) || it.title.contains(query, true) }) }.filter { it.models.isNotEmpty() }
    DshDialog(onDismissRequest = onDismiss,
        properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        Surface(Modifier.fillMaxSize(), color = DshColors.Background) {
            Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
                DshTopBar("选择模型", subtitle = "当前会话", onBack = onDismiss)
                Box(Modifier.padding(horizontal = 20.dp, vertical = 16.dp)) {
                    DshFormField(query, { query = it }, "搜索模型", Modifier.testTag("model_search_input"), placeholder = "搜索可用模型", trailingIcon = Icons.Outlined.Search)
                }
                androidx.compose.foundation.lazy.LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 20.dp).testTag("model_picker_list")) {
                    lastUsed?.let { history -> item { Text("历史实际使用：$history", Modifier.padding(bottom = 8.dp).testTag("model_last_used"), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall) } }
                    visible.forEach { provider ->
                        item { Text(provider.title, color = DshColors.Muted, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp, bottom = 8.dp)) }
                        items(provider.models.size) { index ->
                            val model = provider.models[index]
                            Row(Modifier.fillMaxWidth().clickable { onSelect(model) }.heightIn(min = 80.dp).testTag("model_${model.id}")
                                .semantics { this.selected = selected == model.id }, verticalAlignment = Alignment.CenterVertically) {
                                Icon(if (selected == model.id) Icons.Outlined.Check else Icons.Outlined.RadioButtonUnchecked, null, Modifier.size(22.dp), tint = DshColors.Muted)
                                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                                    Text(model.title, style = MaterialTheme.typography.bodyLarge)
                                    Text(if (selected == model.id) "当前选择" else "可用", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                                }
                            }
                            HorizontalDivider(color = DshColors.Line)
                        }
                    }
                    if (visible.isEmpty()) item { Text("未找到匹配模型", Modifier.padding(vertical = 20.dp), color = DshColors.Muted) }
                    item {
                        Text("切换后用于下一次回复，历史消息保持原模型。", Modifier.padding(top = 20.dp), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                        if (title != "选择模型") Text(title, Modifier.padding(top = 8.dp), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                        Spacer(Modifier.height(24.dp))
                    }
                }
            }
        }
    }
}

@Composable
fun UserMessage(text: String) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        Surface(Modifier.align(Alignment.CenterEnd).widthIn(max = maxWidth * .85f), shape = RoundedCornerShape(24.dp), color = DshColors.Soft) {
            SelectionContainer { Text(text, Modifier.padding(horizontal = 18.dp, vertical = 14.dp), color = DshColors.Ink, style = MaterialTheme.typography.bodyLarge) }
        }
    }
}

@Composable
fun AssistantMessage(text: String) {
    SelectionContainer { Text(text, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.fillMaxWidth()) }
}

@Composable
fun ToolSummary(title: String, detail: String?, icon: ImageVector = Icons.Outlined.Description, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null) {
    Row(modifier.fillMaxWidth().heightIn(min = 80.dp).then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
        .padding(vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, Modifier.size(23.dp), tint = DshColors.Muted)
        Column(Modifier.padding(start = 12.dp).weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            if (detail != null) Text(detail, color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
        }
    }
}

/** Design-sized track inside a full native touch and accessibility target. */
@Composable
fun DshSwitch(checked: Boolean, change: (Boolean) -> Unit, enabled: Boolean = true, modifier: Modifier = Modifier) {
    Box(modifier.size(width = 52.dp, height = 48.dp).toggleable(checked, enabled = enabled,
        role = androidx.compose.ui.semantics.Role.Switch, onValueChange = change), contentAlignment = Alignment.CenterEnd) {
        Box(Modifier.size(width = 40.dp, height = 24.dp).background(
            (if (checked) DshColors.Ink else DshColors.Line).copy(alpha = if (enabled) 1f else .38f), CircleShape).padding(2.dp)) {
            Box(Modifier.align(if (checked) Alignment.CenterEnd else Alignment.CenterStart).size(20.dp).background(DshColors.Background, CircleShape))
        }
    }
}

@Composable
fun ApprovalCard(title: String, description: String, approveLabel: String, rejectLabel: String,
                 onApprove: () -> Unit, onReject: () -> Unit, resolved: String? = null) {
    OutlinedCard(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), colors = CardDefaults.outlinedCardColors(containerColor = DshColors.Background)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(description, style = MaterialTheme.typography.bodyMedium)
            if (resolved == null) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onReject, modifier = Modifier.weight(1f)) { Text(rejectLabel) }
                Button(onClick = onApprove, modifier = Modifier.weight(1f).testTag("approve_action")) { Text(approveLabel) }
            } else Text(resolved, color = DshColors.Muted, modifier = Modifier.testTag("approval_resolved"))
        }
    }
}

@Composable
fun EmptyState(title: String, description: String, action: String, onAction: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(title, style = MaterialTheme.typography.titleLarge)
        Text(description, style = MaterialTheme.typography.bodyMedium, color = DshColors.Muted)
        Button(onClick = onAction) { Text(action) }
    }
}

/** Label above the softly filled input, as specified by the supplied form design. */
@Composable
fun DshFormField(value: String, onValueChange: (String) -> Unit, label: String,
                 modifier: Modifier = Modifier, enabled: Boolean = true,
                 visualTransformation: androidx.compose.ui.text.input.VisualTransformation = androidx.compose.ui.text.input.VisualTransformation.None, placeholder: String? = null, trailingIcon: ImageVector? = null, singleLine: Boolean = true) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(label, color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
        BasicTextField(value, onValueChange,
            modifier.fillMaxWidth().semantics { contentDescription = label }, enabled = enabled,
            singleLine = singleLine, visualTransformation = visualTransformation,
            // Visual masking alone leaves the IME treating a secret as ordinary text.
            keyboardOptions = if (visualTransformation is androidx.compose.ui.text.input.PasswordVisualTransformation)
                androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Password, autoCorrectEnabled = false)
            else androidx.compose.foundation.text.KeyboardOptions.Default,
            textStyle = MaterialTheme.typography.bodyLarge.copy(color = DshColors.Ink),
            decorationBox = { field ->
                Row(Modifier.fillMaxWidth().heightIn(min = 52.dp).background(DshColors.Soft, RoundedCornerShape(12.dp)).padding(horizontal = 14.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f)) {
                        if (value.isEmpty() && placeholder != null) Text(placeholder, color = DshColors.Muted, style = MaterialTheme.typography.bodyLarge)
                        field()
                    }
                    if (trailingIcon != null) Icon(trailingIcon, null, Modifier.size(20.dp), tint = DshColors.Muted)
                }
            })
    }
}
