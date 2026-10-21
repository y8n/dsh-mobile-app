package dev.dsh.mobile

import android.graphics.Color
import android.util.Base64
import dev.dsh.mobile.ui.decodePluginArtwork
import org.junit.Assert.*
import org.junit.Test

class PluginArtworkTest {
    @Test fun inlineSvgUsesNativeRendererAndInvalidArtworkFallsBack() {
        fun data(text: String) = "data:image/svg+xml;base64," + Base64.encodeToString(text.toByteArray(),Base64.NO_WRAP)
        val svg="""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="20" height="20" fill="#0000ff"/></svg>"""
        val image=decodePluginArtwork(data(svg))!!
        assertEquals(Color.BLUE,image.getPixel(72,72))
        assertNull(decodePluginArtwork("https://example.com/plugin.svg"))
        assertNull(decodePluginArtwork(data("<!DOCTYPE svg [<!ENTITY x 'x'>]>$svg")))
        assertNull(decodePluginArtwork("data:image/svg+xml;base64,not-base64!"))
        assertNull(decodePluginArtwork("x".repeat(800*1024)))
    }
}
