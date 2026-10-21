window.__ModuleLoader__.load({
	id: "dsh-mobile-question-fixes",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region packages/question-fixes/src/client.ts
		/** Local, reversible layout and touch-keyboard fixes for DSH question cards. */
		const QUESTION_FIX_CSS = `
[data-question-key] > section:has(> [data-question-scroll]) {
  overflow-x: hidden !important;
  overflow-y: auto !important;
  overscroll-behavior: contain;
}

[data-question-key] > section > [data-question-scroll] {
  flex: 0 0 auto !important;
  max-height: none !important;
  overflow: visible !important;
}

[data-question-key] > section:has(> header button[aria-expanded="false"]) > header h2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
`;
		/**
		* Whether an editable question answer should keep the browser's Enter newline.
		* @param event - the keyboard event received before DSH's submit handler.
		* @param context - the App keyboard state or browser touch hint.
		* @returns True for an unmodified Enter outside IME composition on touch devices.
		*/
		function questionEnterUsesNewline(event, context) {
			return (context.nativeBridge ? context.nativeState?.imeVisible === true && context.nativeState.noHardwareKeyboard === true : context.touchPrimary) && event.key === "Enter" && !event.defaultPrevented && !event.isComposing && event.keyCode !== 229 && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
		}
		/**
		* Add scoped card styles and preserve touch Enter's native editing action.
		* Card height, typography, composer placement and draft ownership remain in DSH.
		* @returns A disposer that restores the existing card without reloading it.
		*/
		function installQuestionFixes() {
			const style = document.createElement("style");
			style.dataset.plugin = "dsh-mobile-question-fixes";
			style.textContent = QUESTION_FIX_CSS;
			document.head.append(style);
			const touchPrimary = window.matchMedia("(hover: none), (pointer: coarse)");
			const onKeyDown = (event) => {
				if (!questionEnterUsesNewline(event, {
					touchPrimary: touchPrimary.matches,
					nativeBridge: window.__DSH_MOBILE_NATIVE__ !== void 0,
					nativeState: window.__DSH_MOBILE_KEYBOARD_STATE__ ?? null
				})) return;
				const answer = event.target;
				if (!(answer instanceof HTMLTextAreaElement) || answer.disabled || answer.readOnly || answer.closest("[data-question-key]") === null) return;
				event.stopPropagation();
			};
			document.addEventListener("keydown", onKeyDown, true);
			return () => {
				document.removeEventListener("keydown", onKeyDown, true);
				style.remove();
			};
		}
		/** Register the browser effect controlled by the bundle component's switch. */
		function apply(ctx) {
			ctx.effect(() => installQuestionFixes());
		}
		//#endregion
		exports.QUESTION_FIX_CSS = QUESTION_FIX_CSS;
		exports.apply = apply;
		exports.installQuestionFixes = installQuestionFixes;
		exports.questionEnterUsesNewline = questionEnterUsesNewline;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map