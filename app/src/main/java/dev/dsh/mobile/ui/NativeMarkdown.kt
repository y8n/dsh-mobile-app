package dev.dsh.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.ClickableText
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalUriHandler
import dev.dsh.mobile.designsystem.DshColors
import dev.dsh.mobile.protocol.MarkdownLink
import dev.dsh.mobile.protocol.markdownLink
import org.commonmark.node.*
import org.commonmark.ext.gfm.tables.*
import org.commonmark.parser.Parser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

internal data class MarkdownFileContext(val sessionId: String, val baseFile: String? = null, val open: (String) -> Unit)
internal val LocalMarkdownFileContext = staticCompositionLocalOf<MarkdownFileContext?> { null }

private fun children(node: Node): List<Node> = buildList { var n = node.firstChild; while (n != null) { add(n); n = n.next } }
private fun inline(node: Node, soft: androidx.compose.ui.graphics.Color, blue: androidx.compose.ui.graphics.Color): AnnotatedString = buildAnnotatedString {
    fun appendNode(n: Node) {
        when (n) {
            is Text -> append(n.literal)
            is Code -> withStyle(SpanStyle(fontFamily = FontFamily.Monospace, background = soft)) { append(n.literal) }
            is StrongEmphasis -> withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { children(n).forEach(::appendNode) }
            is Emphasis -> withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { children(n).forEach(::appendNode) }
            is Link -> { pushStringAnnotation("URL", n.destination); withStyle(SpanStyle(color = blue, textDecoration = TextDecoration.Underline)) { children(n).forEach(::appendNode) }; pop() }
            is Image -> { pushStringAnnotation("URL", n.destination); withStyle(SpanStyle(color = blue, textDecoration = TextDecoration.Underline)) { append("[图片："); children(n).forEach(::appendNode); append("]") }; pop() }
            is SoftLineBreak, is HardLineBreak -> append("\n")
            is HtmlInline -> append(n.literal)
            else -> children(n).forEach(::appendNode)
        }
    }
    children(node).forEach(::appendNode)
}
@Composable private fun MarkdownInline(node: Node, style: TextStyle = TextStyle(fontSize = 14.sp, lineHeight = 24.sp)) {
    val uri = LocalUriHandler.current
    val soft = DshColors.Soft; val blue = DshColors.Blue
    val text = remember(node, soft, blue) { inline(node, soft, blue) }
    val files = LocalMarkdownFileContext.current
    var error by remember { mutableStateOf<String?>(null) }
    ClickableText(text, Modifier.fillMaxWidth(), style = style.copy(color = DshColors.Ink), onClick = { offset ->
        text.getStringAnnotations("URL", offset, offset).firstOrNull()?.item?.let { destination ->
            when (val link = markdownLink(destination, files?.baseFile, files?.sessionId)) {
                is MarkdownLink.Web -> try { uri.openUri(link.url) } catch (_: Exception) { error = "无法打开网页，请检查浏览器设置。" }
                is MarkdownLink.File -> if (files != null) files.open(link.path) else error = "当前页面没有关联电脑会话，无法读取该文件。"
                is MarkdownLink.Anchor -> error = "这是当前文档内的定位链接，暂不支持自动跳转。"
                MarkdownLink.Unsupported -> error = "此链接格式暂不支持，请在电脑端查看。"
            }
        }
    })
    error?.let { message -> AlertDialog(onDismissRequest = { error = null }, title = { Text("打开链接") }, text = { Text(message) },
        confirmButton = { TextButton({ error = null }) { Text("关闭") } }) }
}
@Composable private fun MarkdownBlock(node: Node, depth: Int = 0) {
    if (depth > 40) { Text("嵌套内容过深，请使用系统应用打开。", color = DshColors.Muted); return }
    when (node) {
        is Heading -> MarkdownInline(node, if (node.level <= 2) TextStyle(fontSize = if (node.level == 1) 24.sp else 22.sp, lineHeight = 30.sp, fontWeight = FontWeight.SemiBold) else TextStyle(fontSize = 18.sp, lineHeight = 26.sp, fontWeight = FontWeight.SemiBold))
        is org.commonmark.node.Paragraph -> MarkdownInline(node)
        is FencedCodeBlock -> CodePreview(node.literal, node.info)
        is IndentedCodeBlock -> CodePreview(node.literal, "")
        is HtmlBlock -> Text(node.literal, style = MaterialTheme.typography.bodyMedium)
        is ThematicBreak -> HorizontalDivider(color = DshColors.Line)
        is BlockQuote -> Row { Text("│", color = DshColors.Muted); Column(Modifier.padding(start = 8.dp)) { children(node).forEach { MarkdownBlock(it, depth + 1) } } }
        is BulletList, is OrderedList -> Column(verticalArrangement = Arrangement.spacedBy(6.dp)) { children(node).forEachIndexed { index, item -> Row {
            Text(if (node is OrderedList) "${node.markerStartNumber + index}. " else "• ")
            Column(Modifier.weight(1f)) { children(item).forEach { MarkdownBlock(it, depth + 1) } }
        } } }
        is TableBlock -> Box(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).testTag("markdown_table")) {
            Column(Modifier.width((children(node).flatMap(::children).maxOfOrNull { children(it).size } ?: 1).times(180).dp)) {
            children(node).flatMap(::children).forEach { row ->
                Row {
                    children(row).forEach { cell -> Box(Modifier.width(180.dp).padding(vertical = 10.dp, horizontal = 8.dp)) {
                        MarkdownInline(cell, TextStyle(fontSize = 14.sp, lineHeight = 24.sp, fontWeight = if (cell is TableCell && cell.isHeader) FontWeight.SemiBold else FontWeight.Normal))
                    } }
                }
                HorizontalDivider(color = DshColors.Line, thickness = 0.5.dp)
            }
            }
        }
        else -> Column { children(node).forEach { MarkdownBlock(it, depth + 1) } }
    }
}
@Composable fun CodePreview(code: String, language: String = "") {
    var wrapped by remember { mutableStateOf(true) }
    var copied by remember { mutableStateOf(false) }
    val clipboard = LocalClipboardManager.current
    LaunchedEffect(copied) { if (copied) { kotlinx.coroutines.delay(1000); copied = false } }
    Surface(shape = RoundedCornerShape(16.dp), color = DshColors.Soft, modifier = Modifier.fillMaxWidth().testTag("markdown_code")) {
        Column {
            Row(Modifier.fillMaxWidth().padding(start = 14.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(language.substringBefore(' ').ifBlank { "代码" }, Modifier.weight(1f), color = DshColors.Muted, fontSize = 11.sp, lineHeight = 18.sp)
                IconButton({ wrapped = !wrapped }, Modifier.size(36.dp).testTag("code_wrap")) { Icon(if (wrapped) Icons.Outlined.WrapText else Icons.Outlined.SwapHoriz, if (wrapped) "取消换行" else "自动换行", Modifier.size(16.dp), tint = DshColors.Muted) }
                IconButton({ clipboard.setText(AnnotatedString(code.removeSuffix("\n"))); copied = true }, Modifier.size(36.dp).testTag("code_copy")) { Icon(if (copied) Icons.Outlined.Check else Icons.Outlined.ContentCopy, if (copied) "已复制" else "复制", Modifier.size(16.dp), tint = DshColors.Muted) }
            }
            SelectionContainer {
                Text(code.removeSuffix("\n"), Modifier.fillMaxWidth().then(if (wrapped) Modifier else Modifier.horizontalScroll(rememberScrollState())).padding(start = 14.dp, end = 14.dp, bottom = 16.dp),
                    softWrap = wrapped, fontFamily = FontFamily.Monospace, fontSize = 13.sp, lineHeight = 22.sp)
            }
        }
    }
}

/** Column variant for an existing transcript scroll owner. No nested vertical list. */
@Composable fun MarkdownContent(text: String, modifier: Modifier = Modifier) {
    var document by remember { mutableStateOf<Node?>(null) }
    LaunchedEffect(text) { document = withContext(Dispatchers.Default) { Parser.builder().extensions(listOf(TablesExtension.create())).build().parse(text) } }
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        document?.let { children(it).forEach { node -> MarkdownBlock(node) } }
    }
}

@Composable fun NativeMarkdown(text: String, modifier: Modifier = Modifier) {
    var document by remember(text) { mutableStateOf<Node?>(null) }
    LaunchedEffect(text) { withContext(Dispatchers.Main.immediate) {
        document = withContext(Dispatchers.Default) { Parser.builder().extensions(listOf(TablesExtension.create())).build().parse(text) }
    } }
    if (document == null) { CircularProgressIndicator(); return }
    LazyColumn(modifier, contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        items(children(document!!)) { node -> MarkdownBlock(node) }
    }
}
