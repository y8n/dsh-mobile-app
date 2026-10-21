package dev.dsh.mobile.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.*
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import dev.dsh.mobile.notifications.NotificationNavigation
import dev.dsh.mobile.R
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.*
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.serialization.json.JsonObject

@Composable private fun failureText(code: String): String = stringResource(when (code) {
    "certificate-failed" -> R.string.error_certificate
    "device-revoked" -> R.string.error_revoked
    "instance-changed" -> R.string.error_instance
    "storage-unavailable" -> R.string.error_storage
    "recent-workspace-unavailable" -> R.string.error_recent_workspace
    "invalid-address", "invalid-pairing-key" -> R.string.error_pairing
    "result-unknown" -> R.string.error_unknown_result
    "workspace/already-registered" -> R.string.error_workspace_exists
    "directory-picker/unavailable", "unsupported-gateway", "gateway/invocation-unavailable" -> R.string.error_unsupported
    "device-changed" -> R.string.error_device_changed
    "access-denied" -> R.string.error_access
    "network-unavailable", "connection-required", "stream-ended", "stream-timeout", "session-expired" -> R.string.error_network
    else -> R.string.error_remote
})
@Composable private fun Problem(state: DeviceState, retry: (() -> Unit)? = null) {
    state.error?.let { error ->
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp)) {
            Text(when (error) { "connection-instance-mismatch" -> "此连接不属于同一个 DSH 实例，请使用这台设备的配对信息"; "device-already-paired" -> "设备已存在，请在设备设置中添加连接方式"; "connection-limit" -> "每台设备最多添加 8 种连接方式"; else -> failureText(error) }, color = DshColors.Red, style = MaterialTheme.typography.bodyMedium)
            if (retry != null) TextButton(retry) { Text(stringResource(R.string.retry)) }
        }
    }
}

@Composable
fun LiveApp(onPreview: ((String) -> Unit)?, repo: DeviceRepository = viewModel<DeviceViewModel>().repository) {
    val state by repo.state.collectAsStateWithLifecycle(context = Dispatchers.Main.immediate)
    val nav = rememberNavController()
    val scope = rememberCoroutineScope { Dispatchers.Main.immediate }
    fun openWorkspaceFile(target: WorkspaceFileTarget) {
        nav.navigate("workspace-file/${android.net.Uri.encode(target.sessionId)}?path=${android.net.Uri.encode(target.path)}&device=${android.net.Uri.encode(target.deviceId)}")
    }
    val appContext = androidx.compose.ui.platform.LocalContext.current
    val attachmentDownloader = remember(repo, appContext) { AttachmentDownloader(repo, java.io.File(appContext.cacheDir, "attachments")) }
    val diagnostics = remember(appContext) { LiveGraph.diagnostics(appContext) }
    val localData = remember(appContext) { LiveGraph.localData(appContext) }
    val account = remember(repo) { DeepSeekAccountReader(repo) }
    val conversation = remember(repo) { repo.conversations() }
    val schedules = remember(repo) { repo.schedules() }
    val scheduleState by schedules.state.collectAsStateWithLifecycle(context = Dispatchers.Main.immediate)
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle, repo) {
        val observer = LifecycleEventObserver { _, event -> when (event) {
            Lifecycle.Event.ON_START -> { diagnostics.resume(); Diagnostics.emit("app.start"); repo.resume(); conversation.resume(); schedules.resume() }
            Lifecycle.Event.ON_STOP -> { Diagnostics.emit("app.pause"); diagnostics.pause(); schedules.pause(); conversation.pause(); repo.pause() }
            else -> Unit
        } }
        lifecycle.addObserver(observer)
        if (lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) { diagnostics.resume(); Diagnostics.emit("app.start"); repo.resume(); conversation.resume() }
        onDispose { localData.foreground(null); ConversationVisibility.hide(); diagnostics.pause(); lifecycle.removeObserver(observer); schedules.hide(); conversation.pause(); repo.pause() }
    }
    val notificationTarget by NotificationNavigation.target.collectAsStateWithLifecycle()
    var notificationError by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(notificationTarget, state.loaded, state.selectedId, state.snapshot, state.connected) {
        val target = notificationTarget ?: return@LaunchedEffect
        if (!state.loaded) return@LaunchedEffect
        if (state.devices.none { it.id == target.deviceId }) {
            notificationError = "通知对应的设备已移除，请重新添加设备"
            NotificationNavigation.consumed(target)
            return@LaunchedEffect
        }
        if (state.selectedId != target.deviceId) { ConversationVisibility.hide(); repo.clearStartup(); repo.select(target.deviceId); nav.navigate("workspaces") { popUpTo("devices"); launchSingleTop = true }; return@LaunchedEffect }
        val snapshot = state.snapshot ?: return@LaunchedEffect
        if (!state.connected) return@LaunchedEffect
        val workspace = snapshot.items.firstOrNull { target.sessionId in it.sessionIds }
        if (workspace == null) {
            notificationError = "通知对应的会话已移除或不在当前工作区中"
        } else {
            repo.clearStartup()
            if (state.selectedWorkspace?.workspaceId != workspace.workspaceId) repo.openWorkspace(workspace)
            repo.openSession(target.sessionId)
            nav.navigate("session/${android.net.Uri.encode(target.sessionId)}") {
                popUpTo("devices")
                launchSingleTop = true
            }
        }
        NotificationNavigation.consumed(target)
    }
    if (notificationError != null) AlertDialog(onDismissRequest = { notificationError = null },
        title = { Text("无法打开会话") }, text = { Text(notificationError.orEmpty()) },
        confirmButton = { TextButton({ notificationError = null }) { Text("知道了") } })
    LaunchedEffect(state.startupReady, notificationTarget) {
        if (state.startupReady && notificationTarget == null) {
            nav.navigate("workspaces") { launchSingleTop = true }
            repo.clearStartup()
        }
    }
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route
    val routeSession = entry?.arguments?.getString("sessionId")
    val displayedConversation by remember(conversation) { conversation.state.map { it.deviceId to it.sessionId }.distinctUntilChanged() }.collectAsStateWithLifecycle(initialValue = null to null)
    DisposableEffect(lifecycle, route, routeSession, state.selectedId, displayedConversation) {
        val deviceRoutes = setOf("workspace-file/{sessionId}?path={path}&device={device}", "workspaces", "sessions", "plugins", "device-settings", "pair-connection", "new-workspace", "directory", "session/{sessionId}", "automation/{sessionId}", "turn-changes/{sessionId}/{seq}/{index}?device={device}", "changes/{sessionId}?device={device}", "attachment/{sessionId}/{attachmentId}?kind={kind}&name={name}&device={device}")
        fun update() {
            val foreground = lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
            localData.foreground(state.selectedId?.takeIf { foreground && route in deviceRoutes })
            if (foreground && route == "session/{sessionId}" && routeSession != null && state.selectedId != null && displayedConversation == (state.selectedId to routeSession)) ConversationVisibility.show(state.selectedId!!, routeSession) else ConversationVisibility.hide()
        }
        val observer = LifecycleEventObserver { _, _ -> update() }
        lifecycle.addObserver(observer); update()
        onDispose { lifecycle.removeObserver(observer); localData.foreground(null); ConversationVisibility.hide() }
    }
    LaunchedEffect(localData) { while (true) { kotlinx.coroutines.delay(15_000); try { localData.checkpoint() } catch (cancel: kotlinx.coroutines.CancellationException) { throw cancel } catch (_: Exception) { } } }
    LaunchedEffect(state.loaded, state.devices.isEmpty(), route) {
        if (state.loaded && state.devices.isEmpty() && route != "pair") nav.navigate("pair") { popUpTo("devices"); launchSingleTop = true }
    }
    LaunchedEffect(route, routeSession, state.snapshot, state.connected, state.selectedWorkspace) {
        if (!state.connected || state.snapshot == null || notificationTarget != null) return@LaunchedEffect
        if (route in setOf("sessions", "session/{sessionId}", "automation/{sessionId}") && state.selectedWorkspace == null) {
            conversation.closeSession()
            nav.navigate("workspaces") { popUpTo("devices"); launchSingleTop = true }
        } else if (route in setOf("session/{sessionId}", "automation/{sessionId}") && routeSession !in state.selectedWorkspace?.sessionIds.orEmpty() && routeSession !in state.snapshot?.archivedSessionIds.orEmpty()) {
            conversation.closeSession()
            nav.navigate("sessions") { popUpTo("workspaces"); launchSingleTop = true }
        }
    }
    LaunchedEffect(route, routeSession, state.selectedId) {
        if (route in setOf("session/{sessionId}", "automation/{sessionId}") && routeSession != null) schedules.show(routeSession) else schedules.hide()
    }
    Scaffold(modifier = Modifier.fillMaxSize().imePadding(), contentWindowInsets = WindowInsets.safeDrawing,
        bottomBar = {
            if (route in listOf("workspaces", "plugins")) NavigationBar(Modifier.windowInsetsPadding(WindowInsets.navigationBars.only(WindowInsetsSides.Bottom)).height(68.dp),
                windowInsets = WindowInsets(0, 0, 0, 0), containerColor = DshColors.Background, tonalElevation = 0.dp) {
                NavigationBarItem(route == "workspaces", { nav.navigate("workspaces") { popUpTo("workspaces") { inclusive = true }; launchSingleTop = true } },
                    colors = NavigationBarItemDefaults.colors(selectedIconColor = DshColors.Ink, selectedTextColor = DshColors.Ink, unselectedIconColor = DshColors.Muted, unselectedTextColor = DshColors.Muted, indicatorColor = Color.Transparent),
                    icon = { Icon(Icons.Outlined.FolderCopy, null, Modifier.size(21.dp)) }, label = { Text(stringResource(R.string.workspaces), style = MaterialTheme.typography.labelSmall) })
                NavigationBarItem(route == "plugins", { nav.navigate("plugins") { launchSingleTop = true } },
                    colors = NavigationBarItemDefaults.colors(selectedIconColor = DshColors.Ink, selectedTextColor = DshColors.Ink, unselectedIconColor = DshColors.Muted, unselectedTextColor = DshColors.Muted, indicatorColor = Color.Transparent),
                    icon = { Icon(Icons.Outlined.Extension, null, Modifier.size(21.dp)) }, label = { Text(stringResource(R.string.plugins), style = MaterialTheme.typography.labelSmall) })
            }
        }) { padding ->
        Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
            NavHost(nav, "devices", Modifier.widthIn(max = 840.dp).fillMaxSize()) {
                composable("devices") { LiveDevices(state, { nav.navigate("pair") }, { nav.navigate("settings") },
                    { id -> repo.select(id); nav.navigate("workspaces") { popUpTo("devices"); launchSingleTop = true } },
                    onPreview) }
                composable("pair") { LivePair(state, { nav.popBackStack() }) { address, key, name, lan ->
                    scope.launch { try { repo.pair(address, key, name, lan); nav.navigate("workspaces") { popUpTo("pair") { inclusive = true } } } catch (_: GatewayFailure) { } }
                } }
                composable("workspaces") { LiveWorkspaces(state, { nav.popBackStack() }, repo::select, repo::reconnect,
                    { workspace -> repo.openWorkspace(workspace); nav.navigate("sessions") }, { nav.navigate("new-workspace") }, settings = { nav.navigate("device-settings") }, manage = repo::manageWorkspace) }
                composable("sessions") { LiveSessions(state, { nav.popBackStack() },
                    { session -> repo.openSession(session.sessionId); nav.navigate("session/${session.sessionId}") },
                    { scope.launch { try { val id = repo.createSession(); nav.navigate("session/$id") } catch (_: GatewayFailure) { } } },
                    { state.selectedWorkspace?.let { repo.openWorkspace(it) } }, repo::searchSessions,
                    { id, action, title -> scope.launch { try { repo.manageSession(id, action, title) } catch (_: GatewayFailure) { } } }) }
                composable("new-workspace") { entry ->
                    val chosen by entry.savedStateHandle.getStateFlow("chosen_directory", "").collectAsStateWithLifecycle(context = Dispatchers.Main.immediate)
                    LiveNewWorkspace(state, chosen, { nav.popBackStack() }, { repo.browse(); nav.navigate("directory") }) { name, path ->
                    scope.launch { try { val id = repo.createWorkspace(name, path); nav.navigate("sessions") { popUpTo("new-workspace") { inclusive = true } }; nav.navigate("session/$id") } catch (_: GatewayFailure) { } }
                } }
                composable("directory") { LiveDirectory(state, { nav.popBackStack() }, repo::browse) { path ->
                    nav.previousBackStackEntry?.savedStateHandle?.set("chosen_directory", path)
                    nav.popBackStack()
                } }
                composable("session/{sessionId}") { entry ->
                    val sessionId = entry.arguments?.getString("sessionId")!!
                    var menuVisible by remember(sessionId) { mutableStateOf(false) }
                    var menuHeight by remember(sessionId) { mutableIntStateOf(0) }
                    val current by conversation.state.collectAsStateWithLifecycle(context = Dispatchers.Main.immediate)
                    val archived = sessionId in state.snapshot?.archivedSessionIds.orEmpty()
                    CompositionLocalProvider(LocalMarkdownFileContext provides MarkdownFileContext(sessionId) { path ->
                        current.deviceId?.let { openWorkspaceFile(WorkspaceFileTarget(it, sessionId, path)) }
                    }) {
                    LiveConversation(sessionId, conversation, state.selectedWorkspace?.title,
                        { nav.popBackStack() }, readOnly = archived,
                        attachmentLoader = { target -> attachmentDownloader.download(target) },
                        initialTitle = state.sessions.firstOrNull { it.sessionId == sessionId }?.displayTitle,
                        deviceName = state.devices.firstOrNull { it.id == state.selectedId }?.name,
                        menuHeight = if (menuVisible) with(androidx.compose.ui.platform.LocalDensity.current) { menuHeight.toDp() } else 0.dp,
                        reconnect = repo::reconnect,
                        connectionSettings = { nav.navigate("devices") { launchSingleTop = true } },
                        changes = { device, id, seq, index -> nav.navigate("turn-changes/${android.net.Uri.encode(id)}/$seq/$index?device=${android.net.Uri.encode(device)}") },
                        attachment = { target -> nav.navigate("attachment/${android.net.Uri.encode(target.sessionId)}/${android.net.Uri.encode(target.id)}?kind=${target.kind}&name=${android.net.Uri.encode(target.name)}&device=${android.net.Uri.encode(target.deviceId)}") },
                        automation = if (scheduleState.deviceId == state.selectedId && scheduleState.sessionId == sessionId && scheduleState.activeEntries.isNotEmpty()) ({ nav.navigate("automation/$sessionId") }) else null, menu = { createGoal ->
                            SessionMenu(sessionId, current.projections.text("title").ifBlank { "新会话" }, archived,
                                sessionId in state.localPinnedSessionIds, state.connected && !state.busy,
                                { id, action, title -> scope.launch { try { repo.manageSession(id, action, title) } catch (_: GatewayFailure) { } } },
                                compact = { scope.launch { try { conversation.command("/compact") } catch (_: Exception) { } } },
                                automation = { nav.navigate("automation/$sessionId") }, goal = if ((current.projections["goal"] as? JsonObject)?.get("goal") is JsonObject) null else createGoal,
                                running = current.running, contextPercent = contextPercent(current),
                                compactAvailable = current.compactAvailable, compactLoading = current.commandsLoading,
                                retryCommands = { scope.launch { conversation.loadCommands() } }, statistics = {},
                                onMenuVisible = { menuVisible = it }, onMenuHeight = { menuHeight = it })
                        })
                    }
                }
                composable("settings") { LiveSettings(state, { nav.popBackStack() }, repo::setDefault, onPreview, diagnostics, localData) }
                composable("device-settings") { LiveDeviceSettings(state, repo, localData, { nav.popBackStack() }, { nav.navigate("pair-connection") },
                    { nav.navigate("devices") { popUpTo("devices") { inclusive = true }; launchSingleTop = true } },
                    { dev.dsh.mobile.notifications.SessionNotifications.startIfEnabled(appContext) }, diagnosticInfo = { state.selectedId?.let { DiagnosticSettings(diagnostics, it) } }, usageInfo = { DeepSeekUsageInfo(state.selectedId, state.connected, account::read) }) }
                composable("pair-connection") { LivePair(state, { nav.popBackStack() }, heading = "添加连接方式", nameLabel = "连接名称") { address, key, name, lan ->
                    val id = state.selectedId ?: return@LivePair
                    scope.launch { try { repo.pairConnection(id, address, key, name, lan); dev.dsh.mobile.notifications.SessionNotifications.startIfEnabled(appContext); nav.popBackStack() } catch (cancel: kotlinx.coroutines.CancellationException) { throw cancel } catch (_: Exception) { repo.reportConnectionFailure() } }
                } }
                composable("plugins") {
                    LivePlugins(repo.plugins(), state, { nav.popBackStack() })
                }
                composable("automation/{sessionId}") { automationEntry ->
                    val current by conversation.state.collectAsStateWithLifecycle(context = Dispatchers.Main.immediate)
                    LiveSchedules(schedules, state.connected, { nav.popBackStack() }, current.projections.text("title").ifBlank { "新会话" }, automationEntry.arguments?.getString("sessionId") in state.snapshot?.archivedSessionIds.orEmpty())
                }
                composable("turn-changes/{sessionId}/{seq}/{index}?device={device}") { current ->
                    val args = current.arguments!!
                    TurnChangesViewer(repo, args.getString("sessionId")!!, args.getString("device")!!,
                        args.getString("seq")!!.toLong(), args.getString("index")!!.toInt()) { nav.popBackStack() }
                }
                composable("changes/{sessionId}?device={device}") { current ->
                    DiffViewer(repo, current.arguments!!.getString("sessionId")!!, current.arguments!!.getString("device")!!, { nav.popBackStack() })
                }
                composable("workspace-file/{sessionId}?path={path}&device={device}") { current ->
                    val args = current.arguments!!
                    WorkspaceFileViewer(repo, WorkspaceFileTarget(args.getString("device")!!, args.getString("sessionId")!!, args.getString("path")!!),
                        { nav.popBackStack() }, ::openWorkspaceFile)
                }
                composable("attachment/{sessionId}/{attachmentId}?kind={kind}&name={name}&device={device}") { current ->
                    val args = current.arguments!!
                    AttachmentViewer(repo, AttachmentTarget(args.getString("device")!!, args.getString("sessionId")!!, args.getString("attachmentId")!!, args.getString("kind")!!, args.getString("name").orEmpty()), { nav.popBackStack() })
                }
            }
        }
    }
}

@Composable private fun LiveDevices(state: DeviceState, add: () -> Unit, settings: () -> Unit,
                                    select: (String) -> Unit, preview: ((String) -> Unit)?) {
    Column(Modifier.fillMaxSize()) {
        DshTopBar(stringResource(R.string.devices), actions = {
            if (state.devices.isNotEmpty()) IconButton(settings) { Icon(Icons.Outlined.Tune, stringResource(R.string.settings)) }
            IconButton(add) { Icon(Icons.Outlined.Add, stringResource(R.string.add_device)) }
        })
        Problem(state)
        if (!state.loaded) Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        else if (state.devices.isEmpty()) Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            EmptyState(stringResource(R.string.no_devices), stringResource(R.string.no_devices_detail), stringResource(R.string.add_device), add)
        } else LazyColumn(Modifier.weight(1f).padding(horizontal = 20.dp), contentPadding = PaddingValues(top = 16.dp, bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
            items(state.devices, key = { it.id }) { device ->
                Row(Modifier.fillMaxWidth().heightIn(min = 80.dp).clickable { select(device.id) }.padding(vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Computer, null, Modifier.size(23.dp), tint = DshColors.Muted)
                    Column(Modifier.weight(1f).padding(start = 12.dp)) {
                        Text(device.name, style = MaterialTheme.typography.titleMedium)
                        val status = when (device.status) { "online" -> stringResource(R.string.online); "checking" -> stringResource(R.string.checking); else -> stringResource(R.string.offline) }
                        Text(status + if (device.id == state.defaultId) " · " + stringResource(R.string.default_device) else "",
                            color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                        if (device.status !in listOf("online", "checking", "network-unavailable")) Text(failureText(device.status), color = DshColors.Red, style = MaterialTheme.typography.bodySmall)
                    }
                }
                HorizontalDivider(color = DshColors.Line)
            }
            item {
                Column(Modifier.fillMaxWidth().background(DshColors.Tint, RoundedCornerShape(12.dp)).padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("已连接的设备保留独立工作区", color = DshColors.Blue, style = MaterialTheme.typography.titleMedium.copy(fontSize = 14.sp, lineHeight = 23.sp))
                    Text("选择设备后继续最近的工作。", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        if (preview != null && state.devices.isNotEmpty()) TextButton({ preview("devices") }, Modifier.align(Alignment.CenterHorizontally).testTag("enter_preview")) { Text(stringResource(R.string.preview)) }
    }

}

@Composable private fun LivePair(state: DeviceState, back: () -> Unit, heading: String? = null, nameLabel: String? = null, pair: (String, String, String, Boolean) -> Unit) {
    var name by rememberSaveable { mutableStateOf("") }
    var address by rememberSaveable { mutableStateOf("") }
    var key by remember { mutableStateOf("") }
    var lan by rememberSaveable { mutableStateOf(false) }
    val keyboard = LocalSoftwareKeyboardController.current
    val scanPrompt = stringResource(R.string.scan_pairing)
    val scanner = rememberLauncherForActivityResult(ScanContract()) { result -> result.contents?.let { content ->
        if (content.startsWith("https://")) { address = content.substringBefore('#'); key = content } else key = content
    } }
    Column(Modifier.fillMaxSize()) {
        DshTopBar(heading ?: stringResource(R.string.add_device), onBack = back, centerTitle = false)
        Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            DshFormField(name, { name = it }, nameLabel ?: stringResource(R.string.device_name), Modifier.testTag("pair_name"), enabled = !state.busy)
            DshFormField(address, { value -> if ('#' in value) { address = value.substringBefore('#'); key = value } else address = value }, stringResource(R.string.gateway_address), Modifier.testTag("pair_address"), enabled = !state.busy)
            DshFormField(key, { key = it }, stringResource(R.string.pairing_key), Modifier.testTag("pair_key"), visualTransformation = PasswordVisualTransformation(), enabled = !state.busy)
            Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(lan, { lan = it }, enabled = !state.busy); Text(stringResource(R.string.lan_connection), style = MaterialTheme.typography.bodyMedium) }
            Button({ keyboard?.hide(); pair(address, key, name, lan) }, Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("pair_connect"), shape = RoundedCornerShape(12.dp), enabled = !state.busy && address.isNotBlank() && key.isNotBlank()) {
                Text(stringResource(if (state.busy) R.string.connecting else R.string.connect))
            }
            OutlinedButton({ scanner.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt(scanPrompt).setBeepEnabled(false)) }, Modifier.fillMaxWidth().heightIn(min = 48.dp), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.outlinedButtonColors(containerColor = DshColors.Soft, contentColor = DshColors.Ink), enabled = !state.busy) {
                Icon(Icons.Outlined.QrCodeScanner, null); Spacer(Modifier.width(8.dp)); Text(scanPrompt)
            }
            Problem(state)
            Text(stringResource(R.string.pairing_help), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable internal fun LiveWorkspaces(state: DeviceState, back: () -> Unit, select: (String) -> Unit, refresh: () -> Unit,
                                      open: (Workspace) -> Unit, add: () -> Unit, settings: () -> Unit = {},
                                      manage: (suspend (String, String, String, String?) -> Unit)? = null) {
    var switch by remember { mutableStateOf(false) }
    var workspaceAction by remember(state.selectedId) { mutableStateOf<WorkspaceActionTarget?>(null) }
    workspaceAction?.let { target ->
        if (manage != null) WorkspaceActionDialog(target, state, { workspaceAction = null }, manage)
    }
    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().testTag("device_switch_anchor"), contentAlignment = Alignment.TopCenter) {
            DshTopBar(state.devices.find { it.id == state.selectedId }?.name ?: stringResource(R.string.workspaces), onBack = back, titleAction = { switch = true }, actions = {
                IconButton(settings, modifier = Modifier.testTag("device_settings")) { Icon(Icons.Outlined.Settings, "设备设置") }
            })
            if (switch) androidx.compose.ui.window.Popup(alignment = Alignment.TopCenter, offset = androidx.compose.ui.unit.IntOffset(0, with(androidx.compose.ui.platform.LocalDensity.current) { 56.dp.roundToPx() }), onDismissRequest = { switch = false }, properties = androidx.compose.ui.window.PopupProperties(focusable = true)) {
                Surface(Modifier.widthIn(min = 220.dp, max = 320.dp).testTag("device_switch_popover"), shape = RoundedCornerShape(12.dp), shadowElevation = 6.dp, color = DshColors.Overlay) { Column { state.devices.forEach { device ->
                DropdownMenuItem(text = { Column {
                    Text(device.name)
                    Text(when {
                        device.id == state.selectedId && state.connected -> "在线"
                        device.status == "online" -> "在线"
                        device.status == "checking" -> "检测中…"
                        else -> "未连接"
                    }, style = MaterialTheme.typography.bodySmall, color = DshColors.Muted)
                } }, trailingIcon = { if (device.id == state.selectedId) Icon(Icons.Outlined.Check, "当前设备") }, onClick = { select(device.id); switch = false })
            } } }
            }
        }
        Problem(state, refresh)
        Text((if (state.connected) stringResource(R.string.online) else stringResource(R.string.offline)) + " · ${state.snapshot?.items?.size ?: 0} 个工作区",
            Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 16.dp, bottom = 4.dp), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
        state.workspaceWrites.filter { it.deviceId == state.selectedId && state.snapshot?.items?.none { workspace -> workspace.workspaceId == it.workspaceId } == true }.forEach { pending ->
            TextButton({ workspaceAction = WorkspaceActionTarget(pending.deviceId, Workspace(pending.workspaceId, "", pending.title ?: "已移除的工作区"), "sync") }, enabled = state.connected && !state.busy) {
                Icon(Icons.Outlined.Sync, null, Modifier.size(16.dp)); Spacer(Modifier.width(6.dp)); Text("同步待确认的工作区操作")
            }
        }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (state.snapshot == null && state.error == null) CircularProgressIndicator(Modifier.align(Alignment.Center))
            LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp), contentPadding = PaddingValues(bottom = 96.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
                items(state.snapshot?.items.orEmpty(), key = { it.workspaceId }) { workspace ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.weight(1f)) {
                            ToolSummary(workspace.title, "${workspace.sessionIds.count { it !in state.snapshot?.archivedSessionIds.orEmpty() }} 个会话", Icons.Outlined.FolderOpen) { if (state.connected && !state.busy) open(workspace) }
                        }
                        state.selectedId?.let { deviceId ->
                            if (manage != null) WorkspaceRowMenu(workspace, state) { action ->
                                workspaceAction = WorkspaceActionTarget(deviceId, workspace, action)
                            }
                        }
                    }
                    HorizontalDivider(color = DshColors.Line)
                }
                if (state.snapshot?.items?.isEmpty() == true) item { Text(stringResource(R.string.no_workspaces), Modifier.padding(vertical = 20.dp), color = DshColors.Muted) }
            }
            FloatingActionButton({ if (state.connected && !state.busy) add() }, Modifier.align(Alignment.BottomEnd).padding(20.dp).size(52.dp).testTag("live_add_workspace"), shape = RoundedCornerShape(18.dp), containerColor = if (state.connected) DshColors.Ink else DshColors.Line, contentColor = DshColors.Background) {
                Icon(Icons.Outlined.Add, stringResource(R.string.add_workspace))
            }
        }
    }
}

@Composable internal fun LiveSessions(state: DeviceState, back: () -> Unit, open: (SessionSummary) -> Unit, create: () -> Unit, refresh: () -> Unit,
                                    queryChanged: (String, Boolean) -> Unit, manage: (String, String, String?) -> Unit) {
    var search by rememberSaveable { mutableStateOf(false) }
    var statusFilter by rememberSaveable { mutableStateOf("all") }
    val archived = false
    Column(Modifier.fillMaxSize()) {
        DshTopBar(if (search) "搜索" else state.selectedWorkspace?.title ?: stringResource(R.string.sessions), subtitle = if (search) state.selectedWorkspace?.title else null, onBack = back, actions = {
            IconButton({ search = !search; statusFilter = "all"; if (!search) queryChanged("", archived) }) { Icon(Icons.Outlined.Search, stringResource(R.string.search)) }
        })
        Problem(state, refresh)
        if (search) Box(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp)) {
            DshFormField(state.searchQuery, { queryChanged(it, archived) }, if (archived) "搜索已归档会话或消息" else "搜索会话或消息",
                Modifier.fillMaxWidth().testTag("session_search_input"), trailingIcon = Icons.Outlined.Search)
        }
        if (state.error == "session/search-disabled") Text("电脑端尚未开启消息全文搜索。", Modifier.padding(horizontal = 20.dp), color = DshColors.Muted)
        if (!search) Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("all" to "全部", "running" to "进行中", "completed" to "已完成").forEach { (value, label) ->
                FilterChip(selected = statusFilter == value, onClick = { statusFilter = value }, label = { Text(label) }, modifier = Modifier.testTag("session_filter_$value"))
            }
        }
        if (state.searching || state.sessionsLoading) LinearProgressIndicator(Modifier.fillMaxWidth().testTag("sessions_loading"))
        if (state.searchHasMore) Text("电脑端最多返回 ${state.searchResultLimit} 个匹配会话，请缩小搜索范围。", Modifier.padding(horizontal = 20.dp), color = DshColors.Muted)
        val visible = state.sessions.filter {
            it.sessionId !in state.snapshot?.archivedSessionIds.orEmpty() && (statusFilter == "all" || (if (statusFilter == "running") it.running else !it.running)) && state.searchMatches?.containsKey(it.sessionId) != false
        }.sortedWith(compareBy<SessionSummary> { state.localPinnedSessionIds.indexOf(it.sessionId).takeIf { index -> index >= 0 } ?: Int.MAX_VALUE }.thenByDescending { it.updatedAt })
        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (state.sessionsLoading && visible.isEmpty()) Column(Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                CircularProgressIndicator(Modifier.size(28.dp))
                Text("正在加载会话…", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
            }
            LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp), contentPadding = PaddingValues(bottom = 88.dp)) {
                itemsIndexed(visible, key = { _, session -> session.sessionId }) { index, session ->
                    val zone = java.time.ZoneId.systemDefault()
                    val date = session.updatedAt.takeIf { it > 0 }?.let { java.time.Instant.ofEpochMilli(it).atZone(zone).toLocalDate() }
                    val previousDate = visible.getOrNull(index - 1)?.updatedAt?.takeIf { it > 0 }?.let { java.time.Instant.ofEpochMilli(it).atZone(zone).toLocalDate() }
                    if (!search && (index == 0 || date != previousDate)) {
                        val today = java.time.LocalDate.now(zone)
                        val label = when (date) {
                            null -> "其他会话"
                            today -> "今天"
                            today.minusDays(1) -> "昨天"
                            else -> date.toString()
                        }
                        Text(label, Modifier.padding(top = 12.dp, bottom = 4.dp), color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                    }
                    val time = session.updatedAt.takeIf { it > 0 }?.let {
                        java.time.Instant.ofEpochMilli(it).atZone(zone).format(java.time.format.DateTimeFormatter.ofPattern("HH:mm", java.util.Locale.ROOT))
                    }
                    val pinned = session.sessionId in state.localPinnedSessionIds
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        ToolSummary(session.displayTitle ?: stringResource(R.string.new_session), state.searchMatches?.get(session.sessionId) ?: listOfNotNull(if (session.running) stringResource(R.string.session_running) else "已完成", time).joinToString(" · ").ifBlank { null },
                            if (pinned) Icons.Outlined.PushPin else Icons.Outlined.ChatBubbleOutline, Modifier.weight(1f).testTag("session_row_${session.sessionId}")) { open(session) }
                        SessionMenu(session.sessionId, session.displayTitle ?: "新会话", archived, pinned, state.connected && !state.busy, manage, running = session.running)
                    }
                    if (search) HorizontalDivider(color = DshColors.Line)
                }
                if (visible.isEmpty() && !state.searching && !state.sessionsLoading && state.error == null) item { Text(if (state.searchMatches != null) "未找到匹配消息" else stringResource(R.string.no_sessions), Modifier.padding(vertical = 20.dp), color = DshColors.Muted) }
            }
            if (!search) FloatingActionButton({ if (state.connected && !state.busy) create() }, Modifier.align(Alignment.BottomEnd).padding(20.dp).size(52.dp), shape = RoundedCornerShape(18.dp), containerColor = DshColors.Ink, contentColor = DshColors.Background) { Icon(Icons.Outlined.Add, stringResource(R.string.add_session)) }
        }
    }
}

@Composable private fun LiveNewWorkspace(state: DeviceState, chosenPath: String, back: () -> Unit, browse: () -> Unit, create: (String, String) -> Unit) {
    var name by rememberSaveable { mutableStateOf("") }
    LaunchedEffect(chosenPath) {
        if (name.isBlank() && chosenPath.isNotBlank()) {
            val directoryName = chosenPath.replace('\\', '/').trimEnd('/').substringAfterLast('/')
            if (!Regex("^[A-Za-z]:$").matches(directoryName)) name = directoryName
        }
    }
    val keyboard = LocalSoftwareKeyboardController.current
    Column(Modifier.fillMaxSize()) {
        DshTopBar(stringResource(R.string.add_workspace), subtitle = state.devices.firstOrNull { it.id == state.selectedId }?.name, onBack = back)
        Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            DshFormField(name, { name = it }, stringResource(R.string.workspace_name), Modifier.testTag("live_workspace_name"), enabled = !state.busy)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("工作目录", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                OutlinedButton({ keyboard?.hide(); browse() }, Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("live_select_directory"), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.outlinedButtonColors(containerColor = DshColors.Soft, contentColor = DshColors.Ink), enabled = !state.busy && state.connected) {
                    Text(chosenPath.ifBlank { stringResource(R.string.select_directory) }, Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Icon(Icons.Outlined.FolderOpen, null, Modifier.size(20.dp), tint = DshColors.Muted)
                }
                Text("从这台电脑的目录中选择工作位置。", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
            }
            Problem(state)
            Button({ keyboard?.hide(); create(name, chosenPath) }, Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("live_create_workspace"), shape = RoundedCornerShape(12.dp), enabled = !state.busy && state.connected && name.isNotBlank() && chosenPath.isNotBlank()) {
                Text(stringResource(if (state.busy) R.string.loading else R.string.create_and_chat))
            }
        }
    }
}

@Composable private fun LiveDirectory(state: DeviceState, back: () -> Unit, browse: (String?) -> Unit, choose: (String) -> Unit) {
    var hidden by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.fillMaxSize()) {
        DshTopBar(stringResource(R.string.select_directory), subtitle = state.devices.firstOrNull { it.id == state.selectedId }?.name, onBack = back)
        Problem(state)
        val listing = state.directory
        if (listing == null) Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { if (state.error == null) CircularProgressIndicator() }
        else {
            var locations by remember { mutableStateOf(false) }
            Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("当前位置", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall)
                Box {
                    Row(Modifier.fillMaxWidth().background(DshColors.Soft, RoundedCornerShape(12.dp)).clickable { locations = true }.padding(horizontal = 14.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(listing.path, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Icon(Icons.Outlined.KeyboardArrowDown, "选择上级目录", Modifier.size(20.dp), tint = DshColors.Muted)
                    }
                    DropdownMenu(locations, { locations = false }) {
                        listing.crumbs.forEach { crumb -> DropdownMenuItem(text = { Text(crumb.name) }, onClick = { locations = false; browse(crumb.path) }) }
                    }
                }
            }
            LazyColumn(Modifier.weight(1f, fill = false).padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
                listing.crumbs.dropLast(1).lastOrNull()?.let { parent -> item {
                    ToolSummary(stringResource(R.string.parent_directory), null, Icons.Outlined.SubdirectoryArrowLeft) { browse(parent.path) }
                    HorizontalDivider(color = DshColors.Line)
                } }
                items(listing.entries.filter { hidden || !it.hidden }, key = { it.path }) { entry ->
                    ToolSummary(entry.name, "目录", Icons.Outlined.FolderOpen) { browse(entry.path) }
                    HorizontalDivider(color = DshColors.Line)
                }
                if (listing.entries.isEmpty()) item { Text(stringResource(R.string.empty_directory), color = DshColors.Muted) }
                if (listing.truncated) item { Text(stringResource(R.string.directory_truncated), color = DshColors.Muted) }
            }
            Button({ choose(listing.path) }, Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp).heightIn(min = 48.dp).testTag("live_use_directory"), shape = RoundedCornerShape(12.dp)) { Text(stringResource(R.string.use_directory)) }
            Row(Modifier.padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Checkbox(hidden, { hidden = it }); Text(stringResource(R.string.show_hidden), style = MaterialTheme.typography.bodySmall, color = DshColors.Muted)
            }
        }
    }
}

@Composable private fun LiveSettings(state: DeviceState, back: () -> Unit, setDefault: (String) -> Unit, preview: ((String) -> Unit)?, diagnostics: DiagnosticRepository, localData: LocalDeviceDataRepository) {
    Column(Modifier.fillMaxSize()) {
        DshTopBar(stringResource(R.string.settings), onBack = back)
        Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            ThemeSettings()
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.default_device), style = MaterialTheme.typography.titleMedium)
                SettingsHelp("默认设备", "打开 App 后进入默认设备的工作区。第一个添加的设备自动设为默认；删除默认设备后，改用设备列表中的第一台。")
            }
            state.devices.forEach { device -> Row(Modifier.fillMaxWidth().clickable { setDefault(device.id) }, verticalAlignment = Alignment.CenterVertically) { RadioButton(state.defaultId == device.id, { setDefault(device.id) }); Text(device.name) } }
            NotificationSettings()
            LocalCacheSettings(localData, diagnostics)
            if (preview != null) TextButton({ preview("gallery") }, Modifier.testTag("open_gallery")) { Text(stringResource(R.string.component_gallery)) }
        }
    }
}
