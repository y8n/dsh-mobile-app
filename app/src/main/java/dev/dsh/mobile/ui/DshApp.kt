package dev.dsh.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.NoteAdd
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.*
import dev.dsh.mobile.BuildConfig
import dev.dsh.mobile.R
import dev.dsh.mobile.designsystem.*
import kotlinx.coroutines.launch

private object Routes {
    const val Devices = "devices"
    const val Pair = "pair"
    const val Workspaces = "workspaces"
    const val Plugins = "plugins"
    const val Sessions = "sessions"
    const val NewWorkspace = "new-workspace"
    const val Directory = "directory"
    const val Chat = "chat"
    const val NewChat = "new-chat"
    const val Settings = "settings"
    const val Gallery = "gallery"
    const val Diff = "diff"
}

@Composable
private fun permissions() = listOf(
    PermissionOption("default", stringResource(R.string.permission_default), stringResource(R.string.permission_default_detail)),
    PermissionOption("read_only", stringResource(R.string.permission_read_only), stringResource(R.string.permission_read_only_detail)),
    PermissionOption("full", stringResource(R.string.permission_full), stringResource(R.string.permission_full_detail)),
)

@Composable
private fun models() = listOf(
    ProviderModels("OpenAI", listOf(ModelOption("openai_61", "6.1 Sol"), ModelOption("openai_astra", "6 Astra"))),
    ProviderModels("DeepSeek", listOf(ModelOption("deepseek_chat", "DeepSeek Chat"), ModelOption("deepseek_reasoner", "DeepSeek Reasoner"))),
)

@Composable
fun DshApp(initialPreviewRoute: String? = null, vm: PreviewViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    var previewRoute by rememberSaveable { mutableStateOf(initialPreviewRoute) }
    LaunchedEffect(initialPreviewRoute) { if (BuildConfig.DESIGN_PREVIEW && initialPreviewRoute != null) vm.preview(true) }
    if (BuildConfig.DESIGN_PREVIEW && state.preview) PreviewApp(previewRoute, vm)
    else LiveApp(onPreview = if (BuildConfig.DESIGN_PREVIEW) ({ route -> previewRoute = route; vm.preview(true) }) else null)
}

@Composable
private fun PreviewApp(initialPreviewRoute: String? = null, vm: PreviewViewModel) {
    val nav = rememberNavController()
    val state by vm.state.collectAsStateWithLifecycle()
    val preview = BuildConfig.DESIGN_PREVIEW && state.preview
    val allowedPreviews = setOf(Routes.Chat, Routes.NewChat, Routes.Gallery, Routes.Workspaces, Routes.Devices)
    val start = initialPreviewRoute?.takeIf { BuildConfig.DESIGN_PREVIEW && it in allowedPreviews } ?: Routes.Devices
    LaunchedEffect(initialPreviewRoute) { if (start != Routes.Devices || initialPreviewRoute == Routes.Devices) vm.preview(BuildConfig.DESIGN_PREVIEW) }
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val demoAction = stringResource(R.string.preview_only_action)
    val showAction: () -> Unit = { scope.launch { snackbar.showSnackbar(demoAction) } }
    val back: () -> Unit = { nav.popBackStack() }
    Scaffold(modifier = Modifier.fillMaxSize().imePadding(), contentWindowInsets = WindowInsets.safeDrawing,
        containerColor = DshColors.Background, snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            if (preview && route in listOf(Routes.Workspaces, Routes.Plugins)) NavigationBar(containerColor = DshColors.Background, tonalElevation = 0.dp) {
                NavigationBarItem(route == Routes.Workspaces, onClick = {
                    nav.navigate(Routes.Workspaces) { popUpTo(Routes.Workspaces) { inclusive = true }; launchSingleTop = true }
                }, icon = { Icon(Icons.Outlined.FolderOpen, null) }, label = { Text(stringResource(R.string.workspaces)) })
                NavigationBarItem(route == Routes.Plugins, onClick = {
                    nav.navigate(Routes.Plugins) { launchSingleTop = true }
                }, icon = { Icon(Icons.Outlined.Extension, null) }, label = { Text(stringResource(R.string.plugins)) })
            }
        }) { insets ->
        Box(Modifier.fillMaxSize().padding(insets), contentAlignment = Alignment.TopCenter) {
            Column(Modifier.widthIn(max = 840.dp).fillMaxSize()) {
                if (preview) Row(Modifier.fillMaxWidth().background(DshColors.Tint).padding(start = 20.dp, end = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(stringResource(R.string.preview_banner), Modifier.weight(1f), style = MaterialTheme.typography.bodySmall, color = DshColors.Blue)
                    TextButton(onClick = {
                        vm.preview(false)
                        nav.navigate(Routes.Devices) { popUpTo(nav.graph.startDestinationId) { inclusive = true } }
                    }) { Text(stringResource(R.string.exit_preview), style = MaterialTheme.typography.bodySmall) }
                }
                NavHost(nav, startDestination = start, modifier = Modifier.weight(1f)) {
                    composable(Routes.Devices) {
                        DevicesScreen(preview, onSettings = { nav.navigate(Routes.Settings) },
                            onAdd = { nav.navigate(Routes.Pair) }, onDevice = { second -> vm.device(second); nav.navigate(Routes.Workspaces) },
                            onPreview = { vm.preview(true) })
                    }
                    composable(Routes.Pair) { PairScreen(back) }
                    composable(Routes.Workspaces) {
                        WorkspacesScreen(state, back,
                            onSelect = { nav.navigate(Routes.Sessions) }, onAdd = { vm.directory(""); nav.navigate(Routes.NewWorkspace) }, onDevice = vm::device)
                    }
                    composable(Routes.Plugins) { PluginsScreen(back, showAction) }
                    composable(Routes.Sessions) {
                        SessionsScreen(state.workspaceName, back, { nav.navigate(Routes.Chat) }, { vm.newConversation(); nav.navigate(Routes.NewChat) })
                    }
                    composable(Routes.NewWorkspace) { NewWorkspaceScreen(state, vm, back, { nav.navigate(Routes.Directory) }, {
                        vm.newConversation(); nav.navigate(Routes.NewChat) { popUpTo(Routes.NewWorkspace) { inclusive = true } }
                    }) }
                    composable(Routes.Directory) { DirectoryScreen(back) { vm.directory(it); nav.popBackStack() } }
                    composable(Routes.Chat) { ChatScreen(state, vm, false, back, { nav.navigate(Routes.Diff) }, showAction) }
                    composable(Routes.NewChat) { ChatScreen(state, vm, true, back, { nav.navigate(Routes.Diff) }, showAction) }
                    composable(Routes.Settings) { SettingsScreen(state, vm, back, if (BuildConfig.DESIGN_PREVIEW) ({ vm.preview(true); nav.navigate(Routes.Gallery) }) else null) }
                    composable(Routes.Gallery) { GalleryScreen(state, vm, back) }
                    composable(Routes.Diff) { DiffScreen(back) }
                }
            }
        }
    }
}

@Composable
private fun DevicesScreen(preview: Boolean, onSettings: () -> Unit, onAdd: () -> Unit,
                          onDevice: (Boolean) -> Unit, onPreview: () -> Unit) {
    Column(Modifier.fillMaxSize()) {
        DshTopBar(stringResource(R.string.devices), actions = {
            IconButton(onSettings) { Icon(Icons.Outlined.Tune, stringResource(R.string.settings)) }
            IconButton(onAdd) { Icon(Icons.Outlined.Add, stringResource(R.string.add_device)) }
        })
        if (preview) {
            LazyColumn(Modifier.weight(1f).padding(horizontal = 20.dp)) {
                item { DeviceRow(stringResource(R.string.sample_device), true, true) { onDevice(false) } }
                item { DeviceRow(stringResource(R.string.sample_device_two), false, false) { onDevice(true) } }
            }
        } else Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            EmptyState(stringResource(R.string.no_devices), stringResource(R.string.no_devices_detail), stringResource(R.string.add_device), onAdd)
        }
        if (BuildConfig.DESIGN_PREVIEW && !preview) TextButton(onPreview, Modifier.align(Alignment.CenterHorizontally).padding(bottom = 16.dp).testTag("enter_preview")) {
            Text(stringResource(R.string.preview))
        }
    }
}

@Composable
private fun DeviceRow(title: String, online: Boolean, default: Boolean, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 20.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Outlined.Computer, null, Modifier.size(28.dp), tint = DshColors.Muted)
        Column(Modifier.weight(1f).padding(start = 16.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(stringResource(if (online) R.string.online else R.string.offline), color = if (online) DshColors.Green else DshColors.Muted, style = MaterialTheme.typography.bodySmall)
        }
        if (default) Text(stringResource(R.string.default_device), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
    }
    HorizontalDivider(color = DshColors.Line)
}

@Composable
private fun PairScreen(back: () -> Unit) {
    var name by rememberSaveable { mutableStateOf("") }
    var address by rememberSaveable { mutableStateOf("") }
    var key by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize()) {
        DshTopBar(stringResource(R.string.add_device), onBack = back)
        Column(Modifier.padding(20.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            OutlinedTextField(name, { name = it }, Modifier.fillMaxWidth(), label = { Text(stringResource(R.string.device_name)) }, singleLine = true)
            OutlinedTextField(address, { address = it }, Modifier.fillMaxWidth(), label = { Text(stringResource(R.string.gateway_address)) }, placeholder = { Text("https://") }, singleLine = true)
            OutlinedTextField(key, { key = it }, Modifier.fillMaxWidth(), label = { Text(stringResource(R.string.pairing_key)) }, singleLine = true,
                visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Password, autoCorrectEnabled = false))
            Text(stringResource(R.string.pairing_unavailable), color = DshColors.Muted, style = MaterialTheme.typography.bodyMedium)
            Button(onClick = {}, enabled = false, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.connect)) }
        }
    }
}

@Composable
private fun WorkspacesScreen(state: PreviewState, back: () -> Unit, onSelect: () -> Unit, onAdd: () -> Unit, onDevice: (Boolean) -> Unit) {
    var switching by remember { mutableStateOf(false) }
    var searching by rememberSaveable { mutableStateOf(false) }
    var query by rememberSaveable { mutableStateOf("") }
    val first = stringResource(R.string.sample_device)
    val second = stringResource(R.string.sample_device_two)
    Column(Modifier.fillMaxSize()) {
        Box {
            DshTopBar(if (state.secondDevice) second else first, onBack = back, titleAction = { switching = true }, actions = {
                IconButton({ searching = !searching }) { Icon(Icons.Outlined.Search, stringResource(R.string.search)) }
            })
            DropdownMenu(switching, { switching = false }) {
                DropdownMenuItem(text = { Text(first) }, onClick = { onDevice(false); switching = false })
                DropdownMenuItem(text = { Text(second) }, onClick = { onDevice(true); switching = false })
            }
        }
        if (searching) OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth().padding(horizontal = 20.dp), label = { Text(stringResource(R.string.search)) }, singleLine = true)
        Box(Modifier.weight(1f).fillMaxWidth()) {
            LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp), contentPadding = PaddingValues(bottom = 88.dp)) {
                if (state.workspaceName.contains(query, ignoreCase = true)) item {
                    ToolSummary(state.workspaceName, stringResource(R.string.workspace_count, 3), Icons.Outlined.FolderOpen, onClick = onSelect)
                    HorizontalDivider(color = DshColors.Line)
                }
                if ("us-business-service".contains(query, ignoreCase = true)) item {
                    ToolSummary("us-business-service", stringResource(R.string.workspace_count, 12), Icons.Outlined.FolderOpen, onClick = onSelect)
                }
            }
            FloatingActionButton(onAdd, Modifier.align(Alignment.BottomEnd).padding(20.dp).testTag("add_workspace"), containerColor = DshColors.Ink, contentColor = DshColors.OnInk) {
                Icon(Icons.Outlined.Add, stringResource(R.string.add_workspace))
            }
        }
    }
}

@Composable
private fun SessionsScreen(workspace: String, back: () -> Unit, onChat: () -> Unit, onNew: () -> Unit) {
    var searching by rememberSaveable { mutableStateOf(false) }
    var query by rememberSaveable { mutableStateOf("") }
    val titles = listOf(stringResource(R.string.sample_session), stringResource(R.string.sample_session_two))
    Column(Modifier.fillMaxSize()) {
        DshTopBar(workspace, onBack = back, actions = { IconButton({ searching = !searching }) { Icon(Icons.Outlined.Search, stringResource(R.string.search)) } })
        if (searching) OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth().padding(horizontal = 20.dp), label = { Text(stringResource(R.string.search)) }, singleLine = true)
        Box(Modifier.weight(1f).fillMaxWidth()) {
            LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp), contentPadding = PaddingValues(bottom = 88.dp)) {
                items(titles.filter { it.contains(query, ignoreCase = true) }) { title ->
                    ToolSummary(title, stringResource(R.string.sample_session_detail), Icons.Outlined.ChatBubbleOutline, onClick = onChat)
                    HorizontalDivider(color = DshColors.Line)
                }
            }
            FloatingActionButton(onNew, Modifier.align(Alignment.BottomEnd).padding(20.dp), containerColor = DshColors.Ink, contentColor = DshColors.OnInk) {
                Icon(Icons.Outlined.Add, stringResource(R.string.add_session))
            }
        }
    }
}

@Composable
private fun NewWorkspaceScreen(state: PreviewState, vm: PreviewViewModel, back: () -> Unit, select: () -> Unit, create: () -> Unit) {
    val keyboard = LocalSoftwareKeyboardController.current
    Column(Modifier.fillMaxSize()) {
        DshTopBar(stringResource(R.string.add_workspace), onBack = back)
        Column(Modifier.padding(20.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            OutlinedTextField(state.workspaceName, vm::workspace, Modifier.fillMaxWidth().testTag("workspace_name"), label = { Text(stringResource(R.string.workspace_name)) }, singleLine = true)
            Text(stringResource(R.string.work_directory), style = MaterialTheme.typography.titleMedium)
            OutlinedButton({ keyboard?.hide(); select() }, Modifier.fillMaxWidth().testTag("select_directory")) {
                Icon(Icons.Outlined.FolderOpen, null, Modifier.size(20.dp)); Spacer(Modifier.width(8.dp))
                Text(state.directory.ifBlank { stringResource(R.string.select_directory) })
            }
            Button(create, Modifier.fillMaxWidth().testTag("create_workspace"), enabled = state.workspaceName.isNotBlank() && state.directory.isNotBlank()) {
                Text(stringResource(R.string.create_and_chat))
            }
        }
    }
}

@Composable
private fun DirectoryScreen(back: () -> Unit, selected: (String) -> Unit) {
    var path by rememberSaveable { mutableStateOf("/Users/demo") }
    Column(Modifier.fillMaxSize()) {
        DshTopBar(stringResource(R.string.select_directory), onBack = back)
        Text(path, Modifier.padding(20.dp), style = MaterialTheme.typography.bodySmall, color = DshColors.Muted)
        LazyColumn(Modifier.weight(1f).padding(horizontal = 20.dp)) {
            items(listOf("workspace", "Documents", "Projects")) { dir -> ToolSummary(dir, null, Icons.Outlined.FolderOpen) { path += "/$dir" } }
        }
        Button({ selected(path) }, Modifier.fillMaxWidth().padding(20.dp).testTag("use_directory")) { Text(stringResource(R.string.use_directory)) }
    }
}

@Composable
private fun ChatScreen(state: PreviewState, vm: PreviewViewModel, fresh: Boolean, back: () -> Unit, diff: () -> Unit, demoAction: () -> Unit) {
    var modelPicker by remember { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    var attachments by remember { mutableStateOf(false) }
    val groups = models()
    val selected = groups.flatMap { it.models }.firstOrNull { it.id == state.modelId } ?: groups.first().models.first()
    val options = permissions()
    val file = stringResource(R.string.draft_file)
    val keyboard = LocalSoftwareKeyboardController.current
    Column(Modifier.fillMaxSize()) {
        DshTopBar(stringResource(if (fresh) R.string.new_session else R.string.sample_session), state.workspaceName, back, actions = {
            if (!fresh) IconButton(demoAction) { Icon(Icons.Outlined.Alarm, stringResource(R.string.automation)) }
            Box {
                IconButton({ menu = true }) { Icon(Icons.Outlined.MoreVert, stringResource(R.string.more)) }
                DropdownMenu(menu, { menu = false }, containerColor = DshColors.Overlay) {
                    DropdownMenuItem(text = { Text(stringResource(if (state.pinned) R.string.unpin else R.string.pin)) }, onClick = { vm.pin(); menu = false })
                    listOf(R.string.archive, R.string.compact, R.string.rename, R.string.goal).forEach { label ->
                        DropdownMenuItem(text = { Text(stringResource(label)) }, onClick = { menu = false; demoAction() })
                    }
                    HorizontalDivider(color = DshColors.Line)
                    Text(stringResource(R.string.stats), Modifier.padding(16.dp), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                }
            }
        })
        LazyColumn(Modifier.weight(1f).fillMaxWidth().testTag("message_list"), contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
            if (!fresh) {
                item { UserMessage(stringResource(R.string.sample_prompt)) }
                item { AssistantMessage(stringResource(R.string.sample_answer)) }
                item { Text(stringResource(R.string.sample_heading), style = MaterialTheme.typography.titleLarge) }
                item { AssistantMessage(stringResource(R.string.sample_chain)) }
                item {
                    ToolSummary(stringResource(R.string.sample_tools), null, Icons.Outlined.Check)
                    HorizontalDivider(color = DshColors.Line)
                    ToolSummary(stringResource(R.string.sample_changes), stringResource(R.string.sample_change_detail), Icons.AutoMirrored.Outlined.NoteAdd, onClick = diff)
                }
            }
            state.lastMessage?.let { message -> item { UserMessage(message) }; item { AssistantMessage(stringResource(R.string.demo_answer)) } }
        }
        Box(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp)) {
            MessageComposer(state.draft, vm::draft, state.running, selected.title, options, state.permission, vm::permission,
                onModel = { modelPicker = true }, onAttachment = { attachments = true },
                onSend = { vm.send(file); keyboard?.hide() }, onStop = vm::stop,
                attachmentName = if (state.attachment) file else null, onRemoveAttachment = { vm.attachment(false) })
            DropdownMenu(attachments, { attachments = false }) {
                listOf(R.string.photo_attachment, R.string.file_attachment).forEach { label ->
                    DropdownMenuItem(text = { Text(stringResource(label)) }, onClick = { vm.attachment(true); attachments = false })
                }
            }
        }
    }
    if (modelPicker) ModelPicker(stringResource(R.string.model_title), groups, selected.id, { vm.model(it.id); modelPicker = false }, { modelPicker = false })
}

@Composable
private fun PluginsScreen(back: () -> Unit, onAdd: () -> Unit) {
    var enabled by rememberSaveable { mutableStateOf(true) }
    Column(Modifier.fillMaxSize()) {
        DshTopBar(stringResource(R.string.plugins), onBack = back, actions = { IconButton(onAdd) { Icon(Icons.Outlined.Add, stringResource(R.string.search_plugins)) } })
        Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text(stringResource(R.string.plugin_sample), style = MaterialTheme.typography.titleMedium); Text(stringResource(R.string.plugin_sample_detail), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall) }
            Switch(enabled, { enabled = it })
        }
    }
}

@Composable
private fun SettingsScreen(state: PreviewState, vm: PreviewViewModel, back: () -> Unit, gallery: (() -> Unit)?) {
    Column(Modifier.fillMaxSize()) {
        DshTopBar(stringResource(R.string.settings), onBack = back)
        Column(Modifier.padding(20.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            ThemeSettings()
            Text(stringResource(R.string.default_device), style = MaterialTheme.typography.titleMedium)
            Text(stringResource(R.string.no_devices_detail), color = DshColors.Muted, style = MaterialTheme.typography.bodyMedium)
            if (gallery != null) TextButton(gallery, Modifier.testTag("open_gallery")) { Text(stringResource(R.string.component_gallery)) }
        }
    }
}

@Composable
private fun GalleryScreen(state: PreviewState, vm: PreviewViewModel, back: () -> Unit) {
    var resolved by rememberSaveable { mutableStateOf<String?>(null) }
    val allowed = stringResource(R.string.approved_demo)
    val denied = stringResource(R.string.denied_demo)
    Column(Modifier.fillMaxSize()) {
        DshTopBar(stringResource(R.string.component_gallery), onBack = back)
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Text(stringResource(R.string.messages), style = MaterialTheme.typography.titleLarge)
            UserMessage(stringResource(R.string.sample_prompt)); AssistantMessage(stringResource(R.string.sample_answer))
            ApprovalCard(stringResource(R.string.approval), stringResource(R.string.approval_detail), stringResource(R.string.allow), stringResource(R.string.deny), { resolved = allowed }, { resolved = denied }, resolved)
            Text(stringResource(R.string.connection_lost), color = DshColors.Red, style = MaterialTheme.typography.titleMedium)
            Text(stringResource(R.string.connection_lost_detail), color = DshColors.Muted)
            Text(stringResource(R.string.composer_states), style = MaterialTheme.typography.titleLarge)
            Row(verticalAlignment = Alignment.CenterVertically) { Text(stringResource(R.string.running_state), Modifier.weight(1f)); Switch(state.running, { vm.toggleRunning() }) }
        }
        val file = stringResource(R.string.draft_file)
        MessageComposer(state.draft, vm::draft, state.running, "6.1 Sol", permissions(), state.permission, vm::permission,
            {}, { vm.attachment(true) }, { vm.send(file) }, vm::stop, modifier = Modifier.padding(20.dp))
    }
}

@Composable
private fun DiffScreen(back: () -> Unit) {
    Column(Modifier.fillMaxSize()) {
        DshTopBar(stringResource(R.string.file_changes), onBack = back)
        Text("src/service.ts", Modifier.padding(20.dp), style = MaterialTheme.typography.titleMedium)
        Text(stringResource(R.string.sample_diff), Modifier.fillMaxWidth().background(DshColors.Tint).padding(20.dp), fontFamily = FontFamily.Monospace, color = DshColors.Green)
    }
}
