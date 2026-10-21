package dev.dsh.mobile.protocol

/** Icon categories do not grant preview capabilities: .node and .wasm are binary. */
fun dshTextPreview(path: String, mediaType: String): Boolean {
    if (mediaType.startsWith("text/")) return true
    if (dshFileExtension(path).lowercase(java.util.Locale.ROOT) in setOf("wasm", "node")) return false
    return dshFileType(path) !in setOf(DshFileType.EXCEL, DshFileType.FOLDER, DshFileType.IMAGE,
        DshFileType.OTHER, DshFileType.PDF, DshFileType.PPT, DshFileType.VIDEO, DshFileType.WORD)
}
