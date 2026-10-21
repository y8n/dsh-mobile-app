package dev.dsh.mobile.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Extension
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.window.DialogProperties
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.dsh.mobile.data.*
import dev.dsh.mobile.designsystem.*
import dev.dsh.mobile.protocol.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.*
import java.util.Locale

private fun pluginMeta(row: JsonObject, field: String): String {
    val value = (row["meta"] as? JsonObject)?.get(field)
    return when (value) {
        is JsonPrimitive -> value.contentOrNull.orEmpty()
        is JsonObject -> listOf(Locale.getDefault().toLanguageTag().lowercase(Locale.ROOT), Locale.getDefault().language, "en")
            .firstNotNullOfOrNull { (value[it] as? JsonPrimitive)?.contentOrNull?.takeIf { text -> text.isNotBlank() } }.orEmpty()
        else -> ""
    }
}

private fun pluginError(code: String) = when (code) {
    "plugin-protected" -> "此插件为受保护项，无法修改"
    "device-changed" -> "设备已切换，请在当前设备重新操作"
    "connection-required", "network-unavailable", "registry-network" -> "连接失败，请重试"
    "plugin-inspection-required" -> "插件信息已变化，请重新检查后安装"
    "plugin-not-bundle" -> "此软件包不是可安装的 DSH Bundle"
    "install-result-pending", "install-result-unknown", "result-unknown" -> "结果待确认，请核对原安装结果；不要重复安装"
    else -> "操作未完成，请重试或核对电脑端状态"
}

private fun applicationText(result: JsonObject): String = when (result.text("application")) {
    "applied" -> if ((result["changed"] as? JsonPrimitive)?.booleanOrNull == true) "变更已应用，列表已重新读取" else "配置已符合要求，列表已重新读取"
    "restart-required" -> "配置已保存，需要在电脑端重启后生效"
    "overridden" -> "配置已保存，但被其他配置覆盖，当前未生效"
    "cancelled" -> "安装已取消，电脑端已恢复相关文件"
    "failed" -> "变更失败，已重新读取电脑端状态"
    else -> "结果待确认，请核对电脑端状态"
}

internal fun pluginPackages(bundles: JsonArray, plugins: JsonArray): List<JsonObject> {
    val live = plugins.map { it.jsonObject }.associateBy { it.text("entryId") }
    return bundles.map { it.jsonObject }.map { bundle ->
        JsonObject(bundle + ("rows" to JsonArray((bundle["rows"] as? JsonArray).orEmpty().map { raw ->
            val row = raw.jsonObject
            val entry = live[row.text("entryId")]
            JsonObject(row + buildJsonObject {
                put("enabled", entry?.get("enabled") ?: JsonPrimitive(false))
                put("fiberPhase", entry?.get("fiberPhase") ?: JsonNull)
                entry?.get("readOnlyReason")?.let { put("readOnlyReason", it) }
                entry?.get("patchId")?.let { put("patchId", it) }
            })
        })))
    }.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.text("name").substringAfter('/') })
}

@Composable fun LivePlugins(repo: PluginRepository, devices: DeviceState, back: () -> Unit) {
    val state by repo.state.collectAsStateWithLifecycle(context = Dispatchers.Main.immediate)
    val displayedDevice = state.deviceId ?: devices.selectedId
    val scope = rememberCoroutineScope { Dispatchers.Main.immediate }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var adding by rememberSaveable(devices.selectedId) { mutableStateOf(false) }
    var detail by remember(devices.selectedId) { mutableStateOf<String?>(null) }
    var localError by remember(devices.selectedId) { mutableStateOf<String?>(null) }
    val action: (suspend () -> Unit) -> Unit = { block -> val target = state.deviceId; scope.launch {
        localError = null
        try { block() } catch (cancel: CancellationException) { throw cancel }
        catch (error: Exception) { if (repo.state.value.deviceId == target) localError = (error as? GatewayFailure)?.code ?: "invalid-response" }
    }; Unit }
    DisposableEffect(repo, lifecycle, devices.selectedId) {
        val observer = LifecycleEventObserver { _, event -> when (event) {
            Lifecycle.Event.ON_START -> repo.open()
            Lifecycle.Event.ON_STOP -> repo.pause()
            else -> Unit
        } }
        lifecycle.addObserver(observer)
        if (lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) repo.open()
        onDispose { lifecycle.removeObserver(observer); repo.pause() }
    }
    val groups = pluginGroups(pluginPackages(state.bundles, state.plugins))
    LaunchedEffect(adding, displayedDevice) { if (adding) repo.loadRegistries() }
    Column(Modifier.fillMaxSize().testTag("live-plugins")) {
        DshTopBar("插件", devices.devices.firstOrNull { it.id == devices.selectedId }?.name, onBack = back, actions = {
            IconButton(repo::refresh, enabled = devices.connected && !state.loading) { Icon(Icons.Outlined.Refresh, "刷新插件") }
            FilledTonalButton({ adding = true }, enabled = devices.connected && !state.busy && state.install == null,
                colors = ButtonDefaults.filledTonalButtonColors(containerColor = DshColors.Ink, contentColor = DshColors.Background), contentPadding = PaddingValues(horizontal = 12.dp)) {
                Icon(Icons.Outlined.Add, "添加插件", Modifier.size(16.dp)); Text("添加插件", fontSize = 12.sp)
            }
        })
        LazyColumn(Modifier.weight(1f, fill = false).fillMaxWidth().testTag("plugin-list"), contentPadding = PaddingValues(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            item {
                Text("安装、启用和配置插件", color = DshColors.Muted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 12.dp))
                if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth().padding(vertical = 8.dp))
                if (!devices.connected) Text("设备连接中或已断开，配置操作暂不可用", color = DshColors.Muted)
                (localError ?: state.error)?.let { Text(pluginError(it), color = DshColors.Red, modifier = Modifier.testTag("plugin-error").padding(vertical = 8.dp)) }
                if (localError != null || state.error != null) TextButton(repo::refresh) { Text("刷新") }
                state.result?.let { result -> Text(applicationText(result), Modifier.testTag("plugin-result"), color = if (result.text("application") == "failed") DshColors.Red else DshColors.Muted)
                    if ((result["pendingBuilds"] as? JsonArray)?.isNotEmpty() == true) Text("安装需要脚本授权，请在电脑端核查后处理。", color = DshColors.Muted)
                }
                state.install?.let { pending ->
                    Text("安装：${pending.spec}", style = MaterialTheme.typography.bodyMedium)
                    Text(when (state.installPhase) { "installing" -> "正在安装"; "applying" -> "正在应用配置"; "cancelling" -> "正在取消，等待电脑端恢复"; "cancelled" -> "取消请求已确认，等待核对最终结果"; "too-late" -> "已无法取消，请核对最终结果"; else -> "安装结果待确认" }, color = DshColors.Muted)
                    Row { TextButton({ action { repo.reconcileInstall(displayedDevice) } }, enabled = !state.busy && devices.connected) { Text("核对安装结果") }
                        TextButton({ action { repo.cancelInstall(displayedDevice) } }, enabled = devices.connected && state.installPhase != "cancelling") { Text("取消安装") } }
                }
            }
            listOf("官方" to groups.official, "已安装" to groups.installed).forEach { (label, packages) ->
                if (packages.isNotEmpty()) item {
                    Row(Modifier.padding(top = 24.dp, bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(label, style = MaterialTheme.typography.titleSmall)
                        Text(packages.size.toString(), fontSize = 12.sp, color = DshColors.Muted)
                    }
                }
                items(packages, key = { "bundle:${it.text("name")}" }) { row ->
                    PluginRow(row, true, devices.connected && !state.busy && state.install == null,
                        { detail = row.text("name") }, { enabled -> action { repo.enable(row.string("name"), enabled, true, displayedDevice) } })
                }
            }
            if (!state.loading && groups.official.isEmpty() && groups.installed.isEmpty() && state.error == null) item { Text("没有可管理的插件", color = DshColors.Muted) }
        }
        Text("修改会影响这台电脑上的其他会话。", Modifier.padding(horizontal = 20.dp, vertical = 16.dp), style = MaterialTheme.typography.bodySmall, color = DshColors.Muted)
    }
    if (adding) AddPluginDialog(state, devices.connected, { adding = false }, repo::invalidateInspection) { spec, enabled, registry ->
        action {
            repo.inspect(spec, displayedDevice, registry)
            val inspected = repo.state.value
            val inspection = inspected.inspection
            if (inspection?.text("status") == "accepted" && (inspection["bundle"] as? JsonPrimitive)?.booleanOrNull != false) {
                repo.install(spec, enabled, displayedDevice, registry)
                adding = false
            }
        }
    }
    (groups.official + groups.installed).firstOrNull { it.text("name") == detail }?.let { row -> AlertDialog(onDismissRequest = { detail = null }, title = { Text(pluginMeta(row, "title").ifBlank { row.text("name") }) },
        text = { Column(Modifier.verticalScroll(rememberScrollState())) {
            Text(pluginMeta(row, "description").ifBlank { row.text("description").ifBlank { "电脑端未提供描述" } })
            row.text("version").takeIf { it.isNotBlank() }?.let { Text("版本：$it") }
            row.text("fiberPhase").takeIf { it.isNotBlank() }?.let { Text("运行状态：$it") }
            if (row.text("readOnlyReason").isNotBlank()) Text("受保护或无法定位的配置项，无法修改")
            val modules = (row["rows"] as? JsonArray).orEmpty().map { it.jsonObject }
            if (modules.isNotEmpty()) Text("包含的模块", Modifier.padding(top = 12.dp), style = MaterialTheme.typography.titleSmall)
            modules.filter { it.text("readOnlyReason").isBlank() && it.text("patchId").isNotBlank() }.forEach { module ->
                PluginRow(module, false, devices.connected && !state.busy && state.install == null && module.text("entryId").isNotBlank(),
                    {}, { enabled -> action { repo.enable(module.string("entryId"), enabled, false, displayedDevice) } })
                module.text("fiberPhase").takeIf { it.isNotBlank() }?.let { Text("运行状态：$it", style = MaterialTheme.typography.bodySmall, color = DshColors.Muted) }
            }
        } }, confirmButton = { TextButton({ detail = null }) { Text("关闭") } }) }
}

@Composable private fun PluginRow(row: JsonObject, bundle: Boolean, available: Boolean, detail: () -> Unit, toggle: (Boolean) -> Unit) {
    val id = row.text(if (bundle) "name" else "entryId")
    val name = pluginMeta(row, "title").ifBlank { row.text(if (bundle) "name" else "moduleName") }
    val protected = row.text("readOnlyReason").isNotBlank() || (!bundle && row.text("patchId").isBlank())
    Row(Modifier.fillMaxWidth().heightIn(min = 64.dp).clickable(onClick = detail).padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        PluginArtwork(row.text("name"), Modifier.size(48.dp), source = (row["meta"] as? JsonObject)?.text("icon").orEmpty())
        Column(Modifier.weight(1f).padding(start = 14.dp, end = 10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(name, Modifier.weight(1f, fill = false), fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (row.text("name").startsWith("@deepseek-ai/dsh-experimental-")) Surface(Modifier.padding(start = 6.dp), shape = RoundedCornerShape(4.dp), color = DshColors.Blue.copy(alpha = .08f)) {
                    Text("实验性", Modifier.padding(horizontal = 4.dp), color = DshColors.Blue, fontSize = 9.sp, lineHeight = 14.sp)
                }
            }
            Text(pluginMeta(row, "description").ifBlank { row.text("description").ifBlank { row.text("fiberPhase").ifBlank { "电脑配置" } } }, fontSize = 12.sp, lineHeight = 18.sp, color = DshColors.Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        DshSwitch((row["enabled"] as? JsonPrimitive)?.booleanOrNull == true, toggle, enabled = available && !protected && !(bundle && row["error"] is JsonObject && row["enabled"] == JsonPrimitive(false)),
            modifier = Modifier.testTag("plugin-toggle:$id"))
    }
}

@Composable private fun AddPluginDialog(state: PluginState, connected: Boolean, dismiss: () -> Unit, invalidate: () -> Unit,
    install: (String, Boolean, JsonElement?) -> Unit) {
    var spec by rememberSaveable { mutableStateOf("") }
    var enabled by rememberSaveable { mutableStateOf(true) }
    var guide by rememberSaveable { mutableStateOf(false) }
    var registryOpen by remember { mutableStateOf(false) }
    var sourceMode by rememberSaveable { mutableStateOf("host") }
    var sourceUrl by rememberSaveable { mutableStateOf("") }
    var customUrl by rememberSaveable { mutableStateOf("") }
    var sourceTouched by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(state.registries) {
        if (!sourceTouched) state.registries?.get("registry")?.let {
            if (it is JsonNull) sourceMode = "own" else { sourceMode = "url"; sourceUrl = it.jsonPrimitive.content }
        }
    }
    val source = when (sourceMode) { "own" -> JsonNull; "url" -> JsonPrimitive(sourceUrl); "custom" -> JsonPrimitive(customUrl); else -> null }
    val normalized = runCatching { normalizedPluginRegistry(source) }
    fun sourceTitle(value: JsonElement?): String = pluginRegistryTitle(if (value is JsonNull) state.registries?.get("resolved") ?: JsonNull else value)
    val ready = connected && !state.loading && !state.busy && state.install == null && !state.registriesLoading
    AlertDialog(onDismissRequest = dismiss, modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp), properties = DialogProperties(usePlatformDefaultWidth = false), containerColor = DshColors.Overlay, shape = RoundedCornerShape(24.dp), title = {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("添加插件", Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
            IconButton(dismiss, Modifier.size(32.dp)) { Icon(Icons.Outlined.Close, "关闭添加插件", Modifier.size(18.dp), tint = DshColors.Muted) }
        }
    }, text = {
        Column(Modifier.heightIn(max = 520.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("输入插件的包名、GitHub 仓库地址或电脑上的本地目录路径。", style = MaterialTheme.typography.bodyMedium)
            DshFormField(spec, { spec = it; invalidate() }, "插件包名或地址", Modifier.testTag("plugin-spec"), placeholder = "例如 dsh-plugin-whale-pet")
            TextButton({ guide = !guide }, contentPadding = PaddingValues(0.dp)) { Text(if (guide) "收起插件安装引导和示例" else "插件安装引导和示例", color = DshColors.Muted, fontSize = 12.sp) }
            if (guide) Text("npm 包：dsh-plugin-whale-pet\nGitHub：github:owner/repository\n本地目录：/path/on/computer/plugin\n压缩包：https://example.com/plugin.tgz\n本地目录指连接电脑上的目录，不是手机目录。", fontSize = 12.sp, lineHeight = 20.sp)
            Box {
                OutlinedButton({ registryOpen = true }, enabled = ready, contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp), modifier = Modifier.testTag("plugin-registry-menu")) {
                    Text("安装源  " + if (sourceMode == "custom") "自定义地址" else sourceTitle(source), fontSize = 12.sp)
                    Icon(Icons.Outlined.KeyboardArrowDown, null, Modifier.size(16.dp))
                }
                DropdownMenu(registryOpen, { registryOpen = false }, modifier = Modifier.widthIn(max = 340.dp), containerColor = DshColors.Overlay) {
                    offeredPluginRegistries(state.registries).forEach { candidate ->
                        DropdownMenuItem(text = { Column { Text(sourceTitle(candidate), fontSize = 13.sp); if (candidate is JsonPrimitive && candidate !is JsonNull) Text(candidate.content, fontSize = 11.sp, color = DshColors.Muted) } },
                            leadingIcon = { RadioButton(sourceMode != "custom" && normalized.getOrNull() == candidate, null) },
                            onClick = { sourceTouched = true; if (candidate is JsonNull) sourceMode = "own" else { sourceMode = "url"; sourceUrl = candidate.jsonPrimitive.content }; invalidate(); registryOpen = false })
                    }
                    DropdownMenuItem(text = { Text("自定义地址", fontSize = 13.sp) }, leadingIcon = { RadioButton(sourceMode == "custom", null) },
                        onClick = { sourceTouched = true; sourceMode = "custom"; invalidate(); registryOpen = false })
                }
            }
            if (sourceMode == "custom") {
                OutlinedTextField(customUrl, { customUrl = it; invalidate() }, label = { Text("自定义 npm 安装源") }, placeholder = { Text("https://npm.example.com/") }, modifier = Modifier.fillMaxWidth().testTag("plugin-custom-registry"), singleLine = true, isError = customUrl.isNotBlank() && normalized.isFailure)
                Text("填写以 http:// 或 https:// 开头的 npm 源地址。需要登录的源，请在电脑的 ~/.npmrc 中配置凭据。", fontSize = 11.sp, lineHeight = 17.sp, color = DshColors.Muted)
            }
            if (state.registriesError) Text("电脑安装源暂未读取，可使用明确选择的安装源；电脑默认配置仍由电脑处理。", fontSize = 11.sp, color = DshColors.Muted)
            if (state.loading || state.busy || state.registriesLoading) LinearProgressIndicator(Modifier.fillMaxWidth())
            state.error?.let { Text(pluginError(it), color = DshColors.Red) }
            if (state.inspectedSpec == spec.trim()) state.inspection?.let { checked ->
                if (checked.text("status") != "accepted" || checked["bundle"] == JsonPrimitive(false)) Text(when (checked.text("problem")) { "not-a-bundle" -> "此软件包不是 DSH 插件包"; "already-installed" -> "此插件已经安装"; "network" -> "电脑端访问安装来源失败，请重试"; else -> "电脑端未接受此插件，请检查地址和来源" }, color = DshColors.Red)
            }
            Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(enabled, { enabled = it }, enabled = ready); Text("安装后启用", fontSize = 12.sp) }
            Surface(shape = RoundedCornerShape(14.dp), color = DshColors.Warning) {
                Text("请确认插件来源可信。插件在电脑上以你的权限运行，来源不明的插件可能破坏 DSH，或读取和泄露你的数据。\n\n安装后暂不支持自动更新，升级请在电脑端处理。", Modifier.padding(12.dp), fontSize = 12.sp, lineHeight = 19.sp, color = DshColors.Muted)
            }
        }
    }, confirmButton = {
        Button({ install(spec.trim(), enabled, normalized.getOrNull()) }, enabled = ready && spec.isNotBlank() && normalized.isSuccess,
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("plugin-inspect-install"), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = DshColors.Ink, contentColor = DshColors.Background)) { Text(if (state.loading || state.busy) "正在处理…" else "安装") }
    })
}
