//#region packages/question-fixes/src/index.ts
/**
* Question-card fixes, node half.
*
* A pure UI plugin: this empty apply exists so the plugin appears in the Loader
* and gets its own component row with its own toggle. The browser half ships as
* `exports["./client"]`, discovered through the `dsh.client` declaration in this
* package's manifest. All behaviour lives in `src/client.ts`.
*/
function apply() {}
//#endregion
export { apply };

//# sourceMappingURL=index.mjs.map