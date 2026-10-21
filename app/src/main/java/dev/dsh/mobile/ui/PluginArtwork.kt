// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Y8n and contributors. Displays upstream MIT artwork; provenance and modifications: legal/ASSET-SOURCES.json.
package dev.dsh.mobile.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.util.Base64
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.caverock.androidsvg.SVG
import dev.dsh.mobile.R
import dev.dsh.mobile.designsystem.DshColors
import kotlinx.coroutines.*

/** Manifest artwork is a bounded inline data URL; it never sends requests or uses a WebView. */
internal fun decodePluginArtwork(source: String): Bitmap? = runCatching {
    require(source.length <= 768 * 1024 && source.startsWith("data:image/"))
    val comma = source.indexOf(','); require(comma in 1..100)
    val header = source.substring(0, comma); require(header.endsWith(";base64"))
    val bytes = Base64.decode(source.substring(comma + 1), Base64.DEFAULT); require(bytes.size <= 512 * 1024)
    if (header.startsWith("data:image/svg+xml")) {
        val text = bytes.toString(Charsets.UTF_8)
        require(!text.contains("<!DOCTYPE", true) && !text.contains("<!ENTITY", true))
        SVG.setInternalEntitiesEnabled(false)
        val svg = SVG.getFromString(text)
        val bitmap = Bitmap.createBitmap(144, 144, Bitmap.Config.ARGB_8888)
        svg.setDocumentWidth(144f); svg.setDocumentHeight(144f)
        svg.renderToCanvas(Canvas(bitmap)); bitmap
    } else {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        require(bounds.outWidth in 1..8192 && bounds.outHeight in 1..8192)
        val sample = generateSequence(1) { it * 2 }.first { maxOf(bounds.outWidth, bounds.outHeight) / it <= 256 }
        BitmapFactory.decodeByteArray(bytes,0,bytes.size,BitmapFactory.Options().apply { inSampleSize = sample })
    }
}.getOrNull()

@Composable fun PluginArtwork(name: String, modifier: Modifier = Modifier, source: String = "") {
    var image by remember(source) { mutableStateOf<Bitmap?>(null) }
    LaunchedEffect(source) { image = if (source.isBlank()) null else withContext(Dispatchers.Default) { decodePluginArtwork(source) } }
    val fallback = when(name) {
        "@deepseek-ai/dsh-experimental-schedule-bundle" -> R.drawable.dsh_plugin_schedule
        "@deepseek-ai/dsh-experimental-voice-input-bundle" -> R.drawable.dsh_plugin_voice
        "@deepseek-ai/dsh-experimental-auto-review" -> R.drawable.dsh_plugin_review
        "@deepseek-ai/dsh-experimental-agent-team-profile" -> R.drawable.dsh_plugin_team
        else -> R.drawable.dsh_plugin_default
    }
    Surface(modifier, shape = RoundedCornerShape(14.dp), border = BorderStroke(.5.dp, DshColors.Line), color = DshColors.Background) {
        Box(contentAlignment = Alignment.Center) {
            val decoded = image
            if (decoded != null) Image(decoded.asImageBitmap(), null, Modifier.size(36.dp))
            else Image(painterResource(fallback), null, Modifier.size(36.dp))
        }
    }
}
