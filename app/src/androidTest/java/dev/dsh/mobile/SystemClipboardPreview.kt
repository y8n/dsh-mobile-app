package dev.dsh.mobile

import android.accessibilityservice.AccessibilityServiceInfo
import android.app.Instrumentation
import android.content.ClipboardManager
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo

/** Dismiss only the SystemUI clipboard card created by this test's own file-copy action. */
object SystemClipboardPreview {
    fun dismissOwnedFileCopy(instrumentation: Instrumentation) {
        val automation = instrumentation.uiAutomation
        val previous = automation.serviceInfo
        val flags = previous.flags
        previous.flags = flags or AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS or AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
        automation.serviceInfo = previous
        fun nodes(root: AccessibilityNodeInfo): List<AccessibilityNodeInfo> = buildList {
            add(root)
            for (index in 0 until root.childCount) root.getChild(index)?.let { addAll(nodes(it)) }
        }
        try {
            val clipboard = instrumentation.targetContext.getSystemService(ClipboardManager::class.java)
            val deadline = SystemClock.uptimeMillis() + 3_000
            while (SystemClock.uptimeMillis() < deadline) {
                // SystemUI can expose a bitmap/truncated preview rather than the
                // original text. Verify ownership against the actual clipboard.
                val ownClip = clipboard.primaryClip?.let { clip ->
                    clip.itemCount > 0 && clip.getItemAt(0).coerceToText(instrumentation.targetContext).toString().startsWith("FILE_CURRENT_0")
                } == true
                for (window in automation.windows) {
                    val root = window.root ?: continue
                    if (root.packageName?.toString() != "com.android.systemui") continue
                    val all = nodes(root)
                    if (!ownClip && all.none { it.text?.toString()?.contains("FILE_CURRENT_") == true }) continue
                    val dismiss = all.firstOrNull { it.viewIdResourceName?.endsWith(":id/dismiss_button") == true } ?: continue
                    check(dismiss.performAction(AccessibilityNodeInfo.ACTION_CLICK)) { "Owned clipboard preview could not be dismissed" }
                    SystemClock.sleep(150)
                }
                SystemClock.sleep(100)
            }
        } finally {
            previous.flags = flags; automation.serviceInfo = previous
        }
    }
}
