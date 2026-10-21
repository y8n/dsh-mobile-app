package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.util.Locale

class DshFileTypesTest {
    @Test fun allOriginalBrowserClassifierCasesMatch() {
        val source=javaClass.getResourceAsStream("/dsh-file-type-reference.json")!!.bufferedReader().use { it.readText() }
        val cases=WireJson.parseToJsonElement(source).jsonObject
        assertEquals(836,cases.size)
        cases.forEach { (path,expected) -> assertEquals(path,expected.jsonPrimitive.content.uppercase(Locale.ROOT).replace('-','_'),dshFileType(path).name) }
    }
    @Test fun contextAndFilenamePrecedenceMatchOriginal() {
        assertEquals(DshFileType.DART,dshFileType("lib/main.dart"))
        assertEquals(DshFileType.FLUTTER,dshFileType("lib/main.dart",mapOf("nested/PUBSPEC.YAML" to "dependencies:\n  flutter:\n    sdk: flutter")))
        assertEquals(DshFileType.DART,dshFileType("lib/main.dart",mapOf("pubspec.yaml" to "name: ordinary_dart")))
        assertEquals(DshFileType.ANGULAR,dshFileType("APP.COMPONENT.HTML"))
        assertEquals(DshFileType.HTML,dshFileType("APP.HTML"))
        assertEquals(DshFileType.ENV,dshFileType(".env.json"))
        assertEquals(DshFileType.NODE,dshFileType("package.json"))
        assertEquals("MD",dshFileExtension("C:\\notes\\UPPER.MD"))
        assertEquals("",dshFileExtension("file."))
        assertTrue(isDshLinkCodeExtension("SCSS")); assertFalse(isDshLinkCodeExtension("PDF"))
    }
    @Test fun previewRemainsNativeAndDoesNotConfuseIconsWithBinaryContent() {
        listOf("README","REPORT.MDX","Dockerfile","main.java","script.sh","settings.yaml","module.wat",".env").forEach { assertTrue(it,dshTextPreview(it,"application/octet-stream")) }
        listOf("photo.png","report.pdf","slides.pptx","book.xlsx","addon.node","module.wasm","movie.mp4").forEach { assertFalse(it,dshTextPreview(it,"application/octet-stream")) }
        assertTrue(dshTextPreview("unknown.data","text/plain"))
    }
}
