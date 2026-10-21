import { parentPort, workerData } from "node:worker_threads";
import { inspect } from "node:util";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
//#region src/extension-worker-config.ts
function integer(value, name, fallback, minimum, maximum) {
	const resolved = value ?? fallback;
	if (typeof resolved !== "number" || !Number.isSafeInteger(resolved) || resolved < minimum || resolved > maximum) throw new Error(`hostExecution.${name} must be an integer from ${minimum} through ${maximum}`);
	return resolved;
}
/** Resolve configuration once; reject malformed modes, ids and incoherent stream windows. */
function resolveHostExecution(raw) {
	if (raw !== void 0 && (raw === null || typeof raw !== "object" || Array.isArray(raw))) throw new Error("hostExecution must be an object");
	const value = raw ?? {};
	const mode = value.mode ?? "in-process";
	if (mode !== "worker" && mode !== "in-process") throw new Error("hostExecution.mode is invalid");
	if (value.extensions !== void 0 && (!Array.isArray(value.extensions) || value.extensions.some((id) => typeof id !== "string" || !/^[a-z][a-z0-9-]{0,63}$/u.test(id)) || new Set(value.extensions).size !== value.extensions.length)) throw new Error("hostExecution.extensions must contain unique local extension ids");
	const streamWindowBytes = integer(value.streamWindowBytes, "streamWindowBytes", 262144, 1024, 4194304);
	const streamChunkBytes = integer(value.streamChunkBytes, "streamChunkBytes", 65536, 1024, streamWindowBytes);
	const streamAggregateBytes = integer(value.streamAggregateBytes, "streamAggregateBytes", 1048576, streamWindowBytes, 33554432);
	return Object.freeze({
		mode,
		extensions: value.extensions === void 0 ? void 0 : Object.freeze([...value.extensions]),
		maxWorkers: integer(value.maxWorkers, "maxWorkers", 8, 1, 128),
		maxRegistrations: integer(value.maxRegistrations, "maxRegistrations", 256, 1, 4096),
		maxOldGenerationSizeMb: integer(value.maxOldGenerationSizeMb, "maxOldGenerationSizeMb", 128, 16, 4096),
		maxYoungGenerationSizeMb: integer(value.maxYoungGenerationSizeMb, "maxYoungGenerationSizeMb", 16, 1, 512),
		stackSizeMb: integer(value.stackSizeMb, "stackSizeMb", 4, 1, 64),
		activationTimeoutMs: integer(value.activationTimeoutMs, "activationTimeoutMs", 5e3, 1, 3e5),
		operationTimeoutMs: integer(value.operationTimeoutMs, "operationTimeoutMs", 3e4, 1, 3e5),
		cancelGraceMs: integer(value.cancelGraceMs, "cancelGraceMs", 250, 1, 3e4),
		streamCancelGraceMs: integer(value.streamCancelGraceMs, "streamCancelGraceMs", 1e3, 1, 3e4),
		disposeGraceMs: integer(value.disposeGraceMs, "disposeGraceMs", 2e3, 1, 3e4),
		resultMaxBytes: integer(value.resultMaxBytes, "resultMaxBytes", 4194304, 1024, 4194304),
		streamWindowBytes,
		streamChunkBytes,
		streamAggregateBytes,
		logWindowMs: integer(value.logWindowMs, "logWindowMs", 1e3, 1, 6e4),
		logMessagesPerWindow: integer(value.logMessagesPerWindow, "logMessagesPerWindow", 64, 1, 1024),
		logMessageBytes: integer(value.logMessageBytes, "logMessageBytes", 4096, 128, 65536)
	});
}
//#endregion
//#region node_modules/@deepseek-ai/cosmokit/lib/index.js
/** Return true when a value is `null` or `undefined`. */
function isNullable(value) {
	return value === null || value === void 0;
}
/** Return true for non-array object values. */
function isPlainObject(data) {
	return data && typeof data === "object" && !Array.isArray(data);
}
/** Filter object entries and return a new object. */
function filterKeys(object, filter) {
	return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
/** Map object values while preserving the original key set. */
function mapValues(object, transform) {
	return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
/** Pick selected keys from an object, optionally including `undefined` values. */
function pick(source, keys, forced) {
	if (!keys) return { ...source };
	const result = {};
	for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
	return result;
}
/** Shared config references used by schema validators and plugin runtimes. */
const write = Symbol.for("cosmokit.volatile.write");
function snapshot(value, ancestors = /* @__PURE__ */ new Set()) {
	if (typeof value === "function") throw new TypeError("volatile config cannot contain functions");
	if (value === null || typeof value !== "object") return value;
	if (ancestors.has(value)) throw new TypeError("volatile config cannot contain cycles");
	ancestors.add(value);
	try {
		if (Array.isArray(value)) return Object.freeze(value.map((item) => snapshot(item, ancestors)));
		if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new TypeError("volatile config objects must be plain objects or arrays");
		return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshot(item, ancestors)])));
	} finally {
		ancestors.delete(value);
	}
}
/**
* Create a detached reference containing an immutable copy of the supplied data.
* @param value - validated config data; class instances and functions are unsupported.
* @returns a reference whose value is updated only by its owning runtime.
*/
function createVolatile(value) {
	let current = snapshot(value);
	return Object.freeze({
		get: () => current,
		[write]: (value) => {
			current = value;
		}
	});
}
/**
* Identify references across ESM/CJS copies of the shared library.
* @param value - a parsed config value.
* @returns whether the value implements the shared reference protocol.
*/
function isVolatile(value) {
	return typeof value === "object" && value !== null && write in value;
}
/** Test values using `instanceof` with a `toStringTag` fallback. */
function is(type, value) {
	if (arguments.length === 1) return (value) => is(type, value);
	return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
	return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
	return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
/** Binary source detection and base64/hex conversion helpers. */
var Binary;
(function(Binary) {
	Binary.is = isArrayBufferLike;
	Binary.isSource = isArrayBufferSource;
	function fromSource(source) {
		if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
		else return source;
	}
	Binary.fromSource = fromSource;
	function toBase64(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
		let binary = "";
		const bytes = new Uint8Array(source);
		for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
		return btoa(binary);
	}
	Binary.toBase64 = toBase64;
	function fromBase64(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
		return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
	}
	Binary.fromBase64 = fromBase64;
	function toHex(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
		return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
	}
	Binary.toHex = toHex;
	function fromHex(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
		const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
		const buffer = [];
		for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
		return Uint8Array.from(buffer).buffer;
	}
	Binary.fromHex = fromHex;
})(Binary || (Binary = {}));
Binary.fromBase64;
Binary.toBase64;
Binary.fromHex;
Binary.toHex;
/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
function clone(source, refs = /* @__PURE__ */ new Map()) {
	if (!source || typeof source !== "object") return source;
	if (is("Date", source)) return new Date(source.valueOf());
	if (is("RegExp", source)) return new RegExp(source.source, source.flags);
	if (isArrayBufferLike(source)) return source.slice(0);
	if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
	const cached = refs.get(source);
	if (cached) return cached;
	if (Array.isArray(source)) {
		const result = [];
		refs.set(source, result);
		source.forEach((value, index) => {
			result[index] = Reflect.apply(clone, null, [value, refs]);
		});
		return result;
	}
	const result = Object.create(Object.getPrototypeOf(source));
	refs.set(source, result);
	for (const key of Reflect.ownKeys(source)) {
		const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
		if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
		Reflect.defineProperty(result, key, descriptor);
	}
	return result;
}
/**
* Compare values recursively, treating two volatile references as equal regardless of value.
* Strict comparison distinguishes null/undefined, treats opaque objects by identity,
* compares URLs by normalized href, treats array holes as undefined, and considers distinct cyclic structures unequal.
* @param a - first value.
* @param b - second value.
* @param strict - whether to require strict data equality outside volatile references.
* @returns whether the values compare equal.
*/
function deepEqual(a, b, strict) {
	const ancestors = /* @__PURE__ */ new Set();
	function compare(a, b) {
		if (a === b) return true;
		if (isVolatile(a) || isVolatile(b)) return isVolatile(a) && isVolatile(b);
		if (!strict && isNullable(a) && isNullable(b)) return true;
		if (typeof a !== typeof b || typeof a !== "object" || !a || !b) return false;
		if (ancestors.has(a)) return false;
		function check(test, then) {
			return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
		}
		ancestors.add(a);
		try {
			return check(Array.isArray, (a, b) => {
				if (a.length !== b.length) return false;
				for (let index = 0; index < a.length; index++) if (!compare(a[index], b[index])) return false;
				return true;
			}) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("URL"), (a, b) => a.href === b.href) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
				if (a.byteLength !== b.byteLength) return false;
				const viewA = new Uint8Array(a);
				const viewB = new Uint8Array(b);
				for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
				return true;
			}) ?? ((!strict || [a, b].every((value) => Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) && Object.keys({
				...a,
				...b
			}).every((key) => compare(a[key], b[key])));
		} finally {
			ancestors.delete(a);
		}
	}
	return compare(a, b);
}
/** Time constants plus parsing and formatting helpers. */
var Time;
(function(Time) {
	Time.millisecond = 1;
	Time.second = 1e3;
	Time.minute = Time.second * 60;
	Time.hour = Time.minute * 60;
	Time.day = Time.hour * 24;
	Time.week = Time.day * 7;
	let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
	function setTimezoneOffset(offset) {
		timezoneOffset = offset;
	}
	Time.setTimezoneOffset = setTimezoneOffset;
	function getTimezoneOffset() {
		return timezoneOffset;
	}
	Time.getTimezoneOffset = getTimezoneOffset;
	function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
		if (typeof date === "number") date = new Date(date);
		if (offset === void 0) offset = timezoneOffset;
		return Math.floor((date.valueOf() / Time.minute - offset) / 1440);
	}
	Time.getDateNumber = getDateNumber;
	function fromDateNumber(value, offset) {
		const date = new Date(value * Time.day);
		if (offset === void 0) offset = timezoneOffset;
		return new Date(+date + offset * Time.minute);
	}
	Time.fromDateNumber = fromDateNumber;
	const numeric = /\d+(?:\.\d+)?/.source;
	const timeRegExp = new RegExp(`^${[
		"w(?:eek(?:s)?)?",
		"d(?:ay(?:s)?)?",
		"h(?:our(?:s)?)?",
		"m(?:in(?:ute)?(?:s)?)?",
		"s(?:ec(?:ond)?(?:s)?)?"
	].map((unit) => `(${numeric}${unit})?`).join("")}$`);
	function parseTime(source) {
		const capture = timeRegExp.exec(source);
		if (!capture) return 0;
		return (parseFloat(capture[1]) * Time.week || 0) + (parseFloat(capture[2]) * Time.day || 0) + (parseFloat(capture[3]) * Time.hour || 0) + (parseFloat(capture[4]) * Time.minute || 0) + (parseFloat(capture[5]) * Time.second || 0);
	}
	Time.parseTime = parseTime;
	function parseDate(date) {
		const parsed = parseTime(date);
		if (parsed) date = Date.now() + parsed;
		else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
		else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
		return date ? new Date(date) : /* @__PURE__ */ new Date();
	}
	Time.parseDate = parseDate;
	function format(ms) {
		const abs = Math.abs(ms);
		if (abs >= Time.day - Time.hour / 2) return Math.round(ms / Time.day) + "d";
		else if (abs >= Time.hour - Time.minute / 2) return Math.round(ms / Time.hour) + "h";
		else if (abs >= Time.minute - Time.second / 2) return Math.round(ms / Time.minute) + "m";
		else if (abs >= Time.second) return Math.round(ms / Time.second) + "s";
		return ms + "ms";
	}
	Time.format = format;
	function toDigits(source, length = 2) {
		return source.toString().padStart(length, "0");
	}
	Time.toDigits = toDigits;
	function template(template, time = /* @__PURE__ */ new Date()) {
		return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
	}
	Time.template = template;
})(Time || (Time = {}));
//#endregion
//#region node_modules/@deepseek-ai/schemastery/lib/index.mjs
const kSchema = Symbol.for("schemastery");
const kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
	options;
	name = "ValidationError";
	constructor(message, options) {
		let prefix = "$";
		for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
		else if (typeof segment === "number") prefix += "[" + segment + "]";
		else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
		if (prefix.startsWith(".")) prefix = prefix.slice(1);
		super((prefix === "$" ? "" : `${prefix} `) + message);
		this.options = options;
	}
	static is(error) {
		return !!error?.[kValidationError];
	}
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
const Schema = function(options) {
	const schema = function(data, options = {}) {
		return Schema.resolve(data, schema, options)[0];
	};
	if (options.refs) {
		const refs = mapValues(options.refs, (options) => new Schema(options));
		const getRef = (uid) => refs[uid];
		for (const key in refs) {
			const options = refs[key];
			options.sKey = getRef(options.sKey);
			options.inner = getRef(options.inner);
			options.list = options.list && options.list.map(getRef);
			options.dict = options.dict && mapValues(options.dict, getRef);
		}
		return refs[options.uid];
	}
	Object.assign(schema, options);
	if (typeof schema.callback === "string") try {
		schema.callback = new Function("return " + schema.callback)();
	} catch {}
	Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
	Object.setPrototypeOf(schema, Schema.prototype);
	schema.meta ||= {};
	schema.toString = schema.toString.bind(schema);
	return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
	return {
		version: 1,
		vendor: "schemastery",
		validate: (value) => {
			try {
				return { value: Schema.resolve(value, this, {})[0] };
			} catch (error) {
				if (ValidationError.is(error)) return { issues: [{
					message: error.message,
					path: error.options.path
				}] };
				throw error;
			}
		}
	};
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
	if (globalThis.__schemastery_refs__) {
		globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
		return this.uid;
	}
	globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
	globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
	const result = {
		uid: this.uid,
		refs: globalThis.__schemastery_refs__
	};
	globalThis.__schemastery_refs__ = void 0;
	return result;
};
Schema.prototype.set = function set(key, value) {
	this.dict[key] = value;
	return this;
};
Schema.prototype.push = function push(value) {
	this.list.push(value);
	return this;
};
function mergeDesc(original, messages) {
	const result = typeof original === "string" ? { "": original } : { ...original };
	for (const locale in messages) {
		const value = messages[locale];
		if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
		else if (typeof value === "string") result[locale] = value;
	}
	return result;
}
function getInner(value) {
	return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
	return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
	const schema = Schema(this);
	const desc = mergeDesc(schema.meta.description, messages);
	if (Object.keys(desc).length) schema.meta.description = desc;
	if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
		return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
	});
	if (schema.list) schema.list = schema.list.map((inner, index) => {
		return inner.i18n(mapValues(messages, (data = {}) => {
			if (Array.isArray(getInner(data))) return getInner(data)[index];
			if (Array.isArray(data)) return data[index];
			return extractKeys(data);
		}));
	});
	if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
		if (getInner(data)) return getInner(data);
		return extractKeys(data);
	}));
	if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
	return schema;
};
Schema.prototype.extra = function extra(key, value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
};
for (const key of [
	"required",
	"disabled",
	"collapse",
	"hidden",
	"loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
Schema.prototype.deprecated = function deprecated() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "deprecated",
		type: "danger"
	});
	return schema;
};
Schema.prototype.experimental = function experimental() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "experimental",
		type: "warning"
	});
	return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
	const schema = Schema(this);
	const pattern = pick(regexp, ["source", "flags"]);
	schema.meta = {
		...schema.meta,
		pattern
	};
	return schema;
};
Schema.prototype.simplify = function simplify(value) {
	if (isVolatile(value)) value = value.get();
	if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
	if (isNullable(value)) return value;
	if (this.type === "object" || this.type === "dict") {
		const result = {};
		for (const key in value) {
			const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
			if (this.type === "dict" || !isNullable(item)) result[key] = item;
		}
		if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
		return result;
	} else if (this.type === "array" || this.type === "tuple") {
		const result = [];
		value.forEach((value, index) => {
			const schema = this.type === "array" ? this.inner : this.list[index];
			const item = schema ? schema.simplify(value) : value;
			result.push(item);
		});
		return result;
	} else if (this.type === "intersect") {
		const result = {};
		for (const item of this.list) Object.assign(result, item.simplify(value));
		return result;
	} else if (this.type === "union") for (const schema of this.list) try {
		Schema.resolve(value, schema, {});
		return schema.simplify(value);
	} catch {}
	return value;
};
Schema.prototype.toString = function toString(inline) {
	return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		role,
		extra
	};
	return schema;
};
for (const key of [
	"default",
	"link",
	"comment",
	"description",
	"max",
	"min",
	"step"
]) Object.assign(Schema.prototype, { [key](value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
Schema.prototype.volatile = function volatile() {
	if (this.meta.volatile) throw new TypeError("volatile schema is already wrapped");
	return this.extra("volatile", true);
};
const resolvers = {};
const checkedVolatile = Symbol("checked-volatile-schema");
function validateVolatileSchema(schema, path = [], blocked = false, seen = /* @__PURE__ */ new Map()) {
	const states = seen.get(schema) ?? /* @__PURE__ */ new Set();
	if (states.has(blocked)) return;
	states.add(blocked);
	seen.set(schema, states);
	if (schema.meta?.volatile && blocked) throw new ValidationError("volatile fields require a fixed object path without an enclosing volatile field", { path });
	const nested = blocked || !!schema.meta?.volatile;
	if (schema.dict) for (const [key, child] of Object.entries(schema.dict)) validateVolatileSchema(child, [...path, key], nested, seen);
	if (schema.sKey) validateVolatileSchema(schema.sKey, [...path, "<key>"], true, seen);
	if (schema.inner && (schema.type !== "lazy" || schema.inner[kSchema])) validateVolatileSchema(schema.inner, [...path, "*"], true, seen);
	if (schema.list) for (let index = 0; index < schema.list.length; index++) validateVolatileSchema(schema.list[index], [...path, String(index)], true, seen);
}
Schema.extend = function extend(type, resolve) {
	resolvers[type] = resolve;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
	if (!schema) return [data];
	if (!options[checkedVolatile]) {
		validateVolatileSchema(schema, options.path);
		options = {
			...options,
			[checkedVolatile]: true
		};
	}
	if (schema.meta?.volatile) {
		const inner = Schema(schema);
		inner.meta = {
			...schema.meta,
			volatile: false
		};
		const [value, adapted] = Schema.resolve(data, inner, options, strict);
		try {
			return [createVolatile(value), adapted];
		} catch (error) {
			throw new ValidationError(error instanceof Error ? error.message : String(error), options);
		}
	}
	if (options.ignore?.(data, schema)) return [data];
	if (isNullable(data) && schema.type !== "lazy") {
		if (schema.meta.required) throw new ValidationError(`missing required value`, options);
		let current = schema;
		let fallback = schema.meta.default;
		while (current?.type === "intersect" && isNullable(fallback)) {
			current = current.list[0];
			fallback = current?.meta.default;
		}
		if (isNullable(fallback)) return [data];
		data = clone(fallback);
	}
	const callback = resolvers[schema.type];
	if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
	try {
		return callback(data, schema, options, strict);
	} catch (error) {
		if (!schema.meta.loose) throw error;
		return [schema.meta.default];
	}
};
Schema.from = function from(source) {
	if (isNullable(source)) return Schema.any();
	else if ([
		"string",
		"number",
		"boolean"
	].includes(typeof source)) return Schema.const(source).required();
	else if (source[kSchema]) return source;
	else if (typeof source === "function") switch (source) {
		case String: return Schema.string().required();
		case Number: return Schema.number().required();
		case Boolean: return Schema.boolean().required();
		case Function: return Schema.function().required();
		default: return Schema.is(source).required();
	}
	else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
	const toJSON = () => {
		if (!schema.inner[kSchema]) {
			schema.inner = schema.builder();
			schema.inner.meta = {
				...schema.meta,
				...schema.inner.meta
			};
		}
		return schema.inner.toJSON();
	};
	const schema = new Schema({
		type: "lazy",
		builder,
		inner: { toJSON }
	});
	return schema;
};
Schema.natural = function natural() {
	return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
	return Schema.number().step(.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
	return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
		const date = new Date(value);
		if (isNaN(+date)) throw new ValidationError(`invalid date "${value}"`, options);
		return date;
	}, true)]);
};
Schema.regExp = function regExp(flag = "") {
	return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
		try {
			return new RegExp(value, flag);
		} catch (e) {
			throw new ValidationError(e.message, options);
		}
	}, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
	return Schema.union([
		Schema.is(ArrayBuffer),
		Schema.is(SharedArrayBuffer),
		Schema.transform(Schema.any(), (value, options) => {
			if (Binary.isSource(value)) return Binary.fromSource(value);
			throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
		}, true),
		...encoding ? [Schema.transform(Schema.string(), (value, options) => {
			try {
				return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
			} catch (e) {
				throw new ValidationError(e.message, options);
			}
		}, true)] : []
	]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
	if (!schema.inner[kSchema]) {
		schema.inner = schema.builder();
		schema.inner.meta = {
			...schema.meta,
			...schema.inner.meta
		};
		validateVolatileSchema(schema.inner, options.path, true);
	}
	return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
	return [data];
});
Schema.extend("never", (data, _, options) => {
	throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
	if (deepEqual(data, value)) return [value];
	throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
	const { max = Infinity, min = -Infinity } = meta;
	if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
	if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
	if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
	if (meta.pattern) {
		const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
		if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
	}
	checkWithinRange(data.length, meta, "string length", options);
	return [data];
});
function decimalShift(data, digits) {
	const str = data.toString();
	if (str.includes("e")) return data * Math.pow(10, digits);
	const index = str.indexOf(".");
	if (index === -1) return data * Math.pow(10, digits);
	const frac = str.slice(index + 1);
	const integer = str.slice(0, index);
	if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
	return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
	step = Math.abs(step);
	if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
	const index = step.toString().indexOf(".");
	const digits = step.toString().slice(index + 1).length;
	return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
	if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
	checkWithinRange(data, meta, "number", options);
	const { step } = meta;
	if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
	return [data];
});
Schema.extend("boolean", (data, _, options) => {
	if (typeof data === "boolean") return [data];
	throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
	let value = 0, keys = [];
	if (typeof data === "number") {
		value = data;
		for (const key in bits) if (data & bits[key]) keys.push(key);
	} else if (Array.isArray(data)) {
		keys = data;
		for (const key of keys) {
			if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
			if (key in bits) value |= bits[key];
		}
	} else throw new ValidationError(`expected number or array but got ${data}`, options);
	if (value === meta.default) return [value];
	return [value, keys];
});
Schema.extend("function", (data, _, options) => {
	if (typeof data === "function") return [data];
	throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
	if (typeof constructor === "function") {
		if (data instanceof constructor) return [data];
		throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
	} else {
		if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
		let prototype = Object.getPrototypeOf(data);
		while (prototype) {
			if (prototype.constructor?.name === constructor) return [data];
			prototype = Object.getPrototypeOf(prototype);
		}
		throw new ValidationError(`expected ${constructor} but got ${data}`, options);
	}
});
function property(data, key, schema, options) {
	try {
		const [value, adapted] = Schema.resolve(data[key], schema, {
			...options,
			path: [...options.path || [], key]
		});
		if (adapted !== void 0) data[key] = adapted;
		return value;
	} catch (e) {
		if (!options?.autofix) throw e;
		delete data[key];
		return schema.meta.volatile ? createVolatile(schema.meta.default) : schema.meta.default;
	}
}
Schema.extend("array", (data, { inner, meta }, options) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
	return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in data) {
		let rKey;
		try {
			rKey = Schema.resolve(key, sKey, options)[0];
		} catch (error) {
			if (strict) continue;
			throw error;
		}
		result[rKey] = property(data, key, inner, options);
		data[rKey] = data[key];
		if (key !== rKey) delete data[key];
	}
	return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	const result = list.map((inner, index) => property(data, index, inner, options));
	if (strict) return [result];
	result.push(...data.slice(list.length));
	return [result];
});
function merge(result, data) {
	for (const key in data) {
		if (key in result) continue;
		result[key] = data[key];
	}
}
Schema.extend("object", (data, { dict }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in dict) {
		const value = property(data, key, dict[key], options);
		if (!isNullable(value) || key in data) result[key] = value;
	}
	if (!strict) merge(result, data);
	return [result];
});
Schema.extend("union", (data, { list, toString }, options, strict) => {
	const messages = [];
	for (const inner of list) try {
		return Schema.resolve(data, inner, options, strict);
	} catch (error) {
		messages.push(error);
	}
	throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString }, options, strict) => {
	if (!list.length) return [data];
	let result;
	for (const inner of list) {
		const value = Schema.resolve(data, inner, options, true)[0];
		if (isNullable(value)) continue;
		if (isNullable(result)) result = value;
		else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		else if (typeof value === "object") merge(result ??= {}, value);
		else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
	}
	if (!strict && isPlainObject(data)) merge(result, data);
	return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
	const [result, adapted = data] = Schema.resolve(data, inner, options, true);
	if (preserve) return [callback(result)];
	else return [callback(result), callback(adapted)];
});
const formatters = {};
function defineMethod(name, keys, format) {
	formatters[name] = format;
	Object.assign(Schema, { [name](...args) {
		const schema = new Schema({ type: name });
		keys.forEach((key, index) => {
			switch (key) {
				case "sKey":
					schema.sKey = args[index] ?? Schema.string();
					break;
				case "inner":
					schema.inner = Schema.from(args[index]);
					break;
				case "list":
					schema.list = args[index].map(Schema.from);
					break;
				case "dict":
					schema.dict = mapValues(args[index], Schema.from);
					break;
				case "bits":
					schema.bits = {};
					for (const key in args[index]) {
						if (typeof args[index][key] !== "number") continue;
						schema.bits[key] = args[index][key];
					}
					break;
				case "callback": {
					const callback = schema.callback = args[index];
					callback["toJSON"] ||= () => callback.toString();
					break;
				}
				case "constructor": {
					const constructor = schema.constructor = args[index];
					if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
					break;
				}
				default: schema[key] = args[index];
			}
		});
		if (name === "object" || name === "dict") schema.meta.default = {};
		else if (name === "array" || name === "tuple") schema.meta.default = [];
		else if (name === "bitset") schema.meta.default = 0;
		return schema;
	} });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
	if (typeof constructor === "function") return constructor.name;
	else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
	if (Object.keys(dict).length === 0) return "{}";
	return `{ ${Object.entries(dict).map(([key, inner]) => {
		return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
	}).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
	const result = list.map(({ toString: format }) => format()).join(" | ");
	return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
	return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
	"inner",
	"callback",
	"preserve"
], ({ inner }, isInner) => inner.toString(isInner));
/** Validate an optional per-operation timeout override against the same bounds as in-process. */
function validOperationTimeout(value) {
	if (value === void 0) return void 0;
	if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 3e5) return void 0;
	return value;
}
/** Normalize an extension route path exactly like the in-process registry. */
function normalizeWorkerRoutePath(value) {
	if (typeof value !== "string" || value.length === 0 || value.length > 256 || value.includes("?") || value.includes("#") || value.includes("\\") || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error("invalid route path");
	const normalizedInput = value.startsWith("/") ? value : `/${value}`;
	if (normalizedInput.split("/").some((part) => part === ".." || part === ".")) throw new Error("invalid route path");
	return normalizedInput === "/" ? "/" : normalizedInput.replace(/\/+$/u, "");
}
/**
* Recognize a controlled business error (MobileExtensionError shape) thrown by
* host code so its code/status survive the boundary instead of collapsing to
* a generic 500. Pure duck-typing keeps the runtime Cordis-free.
*/
function businessErrorShape(error) {
	if (error === null || typeof error !== "object") return void 0;
	const candidate = error;
	if (typeof candidate.code !== "string" || candidate.code.length === 0 || candidate.code.length > 64) return void 0;
	if (typeof candidate.message !== "string" || candidate.message.length > 500) return void 0;
	if (typeof candidate.status !== "number" || !Number.isInteger(candidate.status) || candidate.status < 400 || candidate.status > 599) return void 0;
	return {
		code: candidate.code,
		message: candidate.message,
		status: candidate.status
	};
}
/**
* Serialize an action result to JSON bytes worker-side.
*
* Plain JSON.stringify, matching the in-process gateway contract exactly:
* non-JSON-serializable values (e.g. BigInt) throw and surface as
* `extension_failed`, same as in-process mode today.
*/
function serializeWorkerResult(value) {
	const serialized = JSON.stringify(value);
	if (serialized === void 0) throw new Error("extension result is not JSON serializable");
	return new TextEncoder().encode(serialized);
}
//#endregion
//#region src/extension-worker-runtime.ts
/**
* Worker-side runtime for opt-in local extension hosts.
*
* This file is a standalone tsdown entry (lib/extension-worker-runtime.mjs).
* It executes ALL host behavior inside the worker thread — module import,
* activation, input validation, actions, effects and cleanup — and answers the
* parent with metadata and pre-serialized bytes only. It must never import
* Cordis or any DSH service.
*/
const parentChannel = parentPort;
if (parentChannel === null) throw new Error("extension-worker-runtime must run inside a Worker");
const port = parentChannel;
const limits = resolveHostExecution(workerData?.limits);
/** Logger-adapter burst budget per time window; the budget resets each window. */
const LOG_QUEUE_LIMIT = limits.logMessagesPerWindow;
const runtimeId = randomUUID();
const generationController = new AbortController();
const actions = /* @__PURE__ */ new Map();
const routes = [];
const cleanups = [];
let logWindowCount = 0;
let logWindowStartedAt = Date.now();
function send(message) {
	port.postMessage(message);
}
/** Upper bound for one stringified log argument forwarded to the parent. */
const LOG_ARG_MAX_CHARS = limits.logMessageBytes;
/** Render a log argument that structured cloning cannot carry (or that is huge). */
function sanitizeLogArg(value) {
	return (typeof value === "string" ? value : inspect(value, {
		depth: 2,
		maxArrayLength: 16,
		maxStringLength: 256,
		customInspect: false,
		getters: false
	})).slice(0, LOG_ARG_MAX_CHARS);
}
function log(level, args) {
	const now = Date.now();
	if (now - logWindowStartedAt >= limits.logWindowMs) {
		logWindowStartedAt = now;
		logWindowCount = 0;
	}
	if (logWindowCount >= LOG_QUEUE_LIMIT) return;
	logWindowCount += 1;
	try {
		let remaining = limits.logMessageBytes;
		const rendered = [];
		for (const arg of args) {
			if (remaining <= 0) break;
			const text = Buffer.from(sanitizeLogArg(arg)).subarray(0, remaining).toString("utf8").replace(/\uFFFD$/u, "");
			rendered.push(text);
			remaining -= Buffer.byteLength(text);
		}
		send({
			kind: "log",
			level,
			args: rendered
		});
	} catch (error) {}
}
/** Bound a forwarded error message so it cannot carry unbounded text. */
function boundedMessage(error) {
	const text = error instanceof Error ? error.message : String(error);
	return text.length > 500 ? text.slice(0, 500) : text;
}
const loggerAdapter = {
	debug: (...args) => {
		log("debug", args);
	},
	info: (...args) => {
		log("info", args);
	},
	warn: (...args) => {
		log("warn", args);
	},
	error: (...args) => {
		log("error", args);
	}
};
/** The lifecycle RPC id currently in flight, for outer-catch replies. */
let lifecycleReplyId = "lifecycle";
port.on("message", (message) => {
	handleMessage(message).catch((error) => {
		send({
			kind: "error",
			runtimeId,
			id: lifecycleReplyId,
			code: "extension_failed",
			message: boundedMessage(error),
			status: 500
		});
	});
});
/** Live per-request controllers, so parent cancel messages abort running work. */
const requestControllers = /* @__PURE__ */ new Map();
function abortRequest(id) {
	requestControllers.get(id)?.abort(/* @__PURE__ */ new Error("request cancelled"));
}
/** Live stream sources by request id, so generation abort can destroy them. */
const activeSources = /* @__PURE__ */ new Map();
/** Credit per stream id; the worker pauses a source when its window is exhausted. */
const streamCredit = /* @__PURE__ */ new Map();
/** Sent and acknowledged bytes per stream; their difference is in-flight load. */
const streamSent = /* @__PURE__ */ new Map();
const streamAcked = /* @__PURE__ */ new Map();
/** FIFO demands reserve aggregate bytes before waking a source pump. */
const sendBudgetWaiters = [];
const finishedStreams = /* @__PURE__ */ new Set();
let drainingBudget = false;
/** Bytes sent but not yet acknowledged, across all live streams. */
function inFlightTotal() {
	let total = 0;
	for (const [id, sent] of streamSent) total += sent - (streamAcked.get(id) ?? 0);
	return total;
}
function wakeSendBudgetWaiters() {
	if (drainingBudget) return;
	drainingBudget = true;
	try {
		for (let index = 0; index < sendBudgetWaiters.length;) {
			const waiter = sendBudgetWaiters[index];
			if (waiter.bail()) {
				sendBudgetWaiters.splice(index, 1);
				waiter.resolve(false);
				continue;
			}
			if ((streamCredit.get(waiter.id) ?? 0) < waiter.length) {
				index += 1;
				continue;
			}
			if (inFlightTotal() + waiter.length > limits.streamAggregateBytes) break;
			if (!tryReserve(waiter.id, waiter.length)) throw new Error("worker stream reservation failed");
			sendBudgetWaiters.splice(index, 1);
			waiter.resolve(true);
		}
	} finally {
		drainingBudget = false;
	}
}
/**
* Atomically check and debit send budget for one piece: the per-stream window
* must hold it AND the per-worker aggregate in-flight bound must hold. Check
* and debit are one synchronous step, so concurrently awakened pumps can never
* double-reserve the same freed capacity.
*/
function tryReserve(id, length) {
	const credit = streamCredit.get(id) ?? 0;
	if (credit < length) return false;
	if (inFlightTotal() + length > limits.streamAggregateBytes) return false;
	streamCredit.set(id, credit - length);
	streamSent.set(id, (streamSent.get(id) ?? 0) + length);
	return true;
}
/** Wait until a piece may be sent; resolves false when the caller bailed. */
async function acquireSendBudget(id, length, bail) {
	if (bail()) return false;
	return new Promise((resolve) => {
		sendBudgetWaiters.push({
			id,
			length,
			bail,
			resolve
		});
		wakeSendBudgetWaiters();
	});
}
async function handleMessage(message) {
	if (message.kind === "activate") {
		lifecycleReplyId = message.id;
		await activate(message.id, message.hostFile, message.generation, message.manifest);
		return;
	}
	if (message.kind === "invoke") {
		await runAction(message.id, message.action, message.deviceId, message.input);
		return;
	}
	if (message.kind === "route") {
		await runRoute(message);
		return;
	}
	if (message.kind === "stream-ack") {
		if (!streamSent.has(message.id) || !Number.isInteger(message.bytes) || message.bytes < 0 || message.bytes > (streamSent.get(message.id) ?? 0) - (streamAcked.get(message.id) ?? 0)) return;
		streamAcked.set(message.id, (streamAcked.get(message.id) ?? 0) + message.bytes);
		if (!finishedStreams.has(message.id)) streamCredit.set(message.id, (streamCredit.get(message.id) ?? 0) + message.bytes);
		if (finishedStreams.has(message.id) && streamSent.get(message.id) === streamAcked.get(message.id)) releaseStreamAccounting(message.id);
		wakeSendBudgetWaiters();
		return;
	}
	if (message.kind === "stream-cancel") {
		activeSources.get(message.id)?.destroy();
		if (finishedStreams.has(message.id)) releaseStreamAccounting(message.id);
		wakeSendBudgetWaiters();
		return;
	}
	if (message.kind === "cancel") {
		abortRequest(message.id);
		return;
	}
	if (message.kind === "dispose") {
		lifecycleReplyId = message.id;
		generationController.abort();
		for (const source of activeSources.values()) source.destroy();
		const pending = [];
		for (const cleanup of [...cleanups].reverse()) try {
			pending.push(Promise.resolve(cleanup()));
		} catch {}
		await Promise.allSettled(pending);
		send({
			kind: "result",
			runtimeId,
			id: message.id,
			bytes: /* @__PURE__ */ new Uint8Array()
		});
		return;
	}
}
async function runRoute(message) {
	const spec = routes[message.routeIndex];
	if (spec === void 0) {
		send({
			kind: "error",
			runtimeId,
			id: message.id,
			code: "route_not_found",
			message: "route not found",
			status: 404
		});
		return;
	}
	const controller = new AbortController();
	requestControllers.set(message.id, controller);
	const onGenerationAbort = () => {
		controller.abort(generationController.signal.reason);
	};
	if (generationController.signal.aborted) controller.abort();
	else generationController.signal.addEventListener("abort", onGenerationAbort, { once: true });
	try {
		const response = await spec.handle({
			method: message.method,
			pathname: message.path,
			query: new URLSearchParams([...message.query].map(([key, value]) => [key, value])),
			headers: message.headers,
			body: Buffer.from(message.body),
			signal: controller.signal,
			deviceId: message.deviceId
		});
		if (response === null || typeof response !== "object") {
			send({
				kind: "error",
				runtimeId,
				id: message.id,
				code: "invalid_route_response",
				message: "extension returned an invalid response",
				status: 500
			});
			return;
		}
		const body = response.body;
		if (typeof body !== "string" && !(body instanceof Uint8Array) && !isStream(body)) throw Object.assign(/* @__PURE__ */ new Error("extension returned an invalid response"), {
			code: "invalid_route_response",
			status: 500
		});
		let wireMeta;
		try {
			wireMeta = snapshotResponseMetadata(response);
		} catch (error) {
			if (isStream(body)) {
				body.once("error", () => void 0);
				body.destroy();
			}
			throw error;
		}
		if (isStream(body)) {
			await pumpStream(message.id, body, wireMeta);
			return;
		}
		const bytes = typeof body === "string" ? new TextEncoder().encode(body) : new Uint8Array(body);
		if (bytes.byteLength > limits.resultMaxBytes) {
			send({
				kind: "error",
				runtimeId,
				id: message.id,
				code: "extension_result_too_large",
				message: "extension response is too large",
				status: 500
			});
			return;
		}
		send({
			kind: "route-response",
			runtimeId,
			id: message.id,
			...wireMeta,
			bytes
		});
	} catch (error) {
		const business = businessErrorShape(error);
		if (business !== void 0) {
			send({
				kind: "error",
				runtimeId,
				id: message.id,
				code: business.code,
				message: business.message,
				status: business.status
			});
			return;
		}
		send({
			kind: "error",
			runtimeId,
			id: message.id,
			code: "extension_failed",
			message: boundedMessage(error),
			status: 500
		});
	} finally {
		requestControllers.delete(message.id);
		generationController.signal.removeEventListener("abort", onGenerationAbort);
	}
}
function isStream(value) {
	return value !== null && typeof value === "object" && typeof value.pipe === "function";
}
async function pumpStream(id, source, meta) {
	activeSources.set(id, source);
	streamCredit.set(id, limits.streamWindowBytes);
	streamSent.set(id, 0);
	streamAcked.set(id, 0);
	send({
		kind: "stream-start",
		runtimeId,
		id,
		...meta.status === void 0 ? {} : { status: meta.status },
		...meta.contentType === void 0 ? {} : { contentType: meta.contentType },
		...meta.headers === void 0 ? {} : { headers: meta.headers }
	});
	let ended = false;
	const finish = () => {
		if (ended) return;
		ended = true;
		activeSources.delete(id);
		streamCredit.delete(id);
		finishedStreams.add(id);
		if (source.destroyed && !source.readableEnded || streamSent.get(id) === streamAcked.get(id)) releaseStreamAccounting(id);
		wakeSendBudgetWaiters();
	};
	source.once("error", (error) => {
		if (ended) return;
		finish();
		send({
			kind: "stream-error",
			runtimeId,
			id,
			message: boundedMessage(error)
		});
	});
	try {
		for await (const chunk of source) {
			const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			if (ended) return;
			for (let offset = 0; offset < bytes.byteLength;) {
				const piece = bytes.subarray(offset, Math.min(offset + limits.streamChunkBytes, bytes.byteLength));
				if (!await acquireSendBudget(id, piece.byteLength, () => source.destroyed || ended)) {
					finish();
					send({
						kind: "stream-end",
						runtimeId,
						id
					});
					source.destroy();
					return;
				}
				send({
					kind: "stream-chunk",
					runtimeId,
					id,
					bytes: new Uint8Array(piece)
				});
				offset += piece.byteLength;
			}
		}
		finish();
		send({
			kind: "stream-end",
			runtimeId,
			id
		});
	} catch (error) {
		if (ended) return;
		finish();
		send({
			kind: "stream-error",
			runtimeId,
			id,
			message: boundedMessage(error)
		});
	}
}
/** Evaluate extension metadata only in the worker and forward the Gateway's existing safe headers. */
function snapshotResponseMetadata(response) {
	const status = response.status;
	const contentType = response.contentType;
	if (status !== void 0 && (!Number.isSafeInteger(status) || status < 200 || status > 599)) throw Object.assign(/* @__PURE__ */ new Error("invalid HTTP status"), {
		code: "invalid_route_response",
		status: 500
	});
	if (contentType !== void 0 && (typeof contentType !== "string" || contentType.length > 1024 || !/^[\x20-\x7e]+$/u.test(contentType) || !/^[\w!#$&+.^-]+\/[\w!#$&+.^-]+(?:;[\x20-\x7e]*)?$/u.test(contentType))) throw Object.assign(/* @__PURE__ */ new Error("invalid content type"), {
		code: "invalid_route_response",
		status: 500
	});
	const headers = {};
	const source = response.headers;
	let bytes = Buffer.byteLength(contentType ?? "");
	if (source !== void 0) {
		if (source === null || typeof source !== "object" || Array.isArray(source)) throw Object.assign(/* @__PURE__ */ new Error("invalid response headers"), {
			code: "invalid_route_response",
			status: 500
		});
		for (const name of Object.keys(source)) {
			if (!/^(?:content-disposition|cache-control|etag)$/iu.test(name)) continue;
			const value = source[name];
			if (typeof value !== "string") throw Object.assign(/* @__PURE__ */ new Error("invalid response header"), {
				code: "invalid_route_response",
				status: 500
			});
			if (/[\r\n]/u.test(value)) continue;
			bytes += Buffer.byteLength(name) + Buffer.byteLength(value);
			if (bytes > 16384) throw Object.assign(/* @__PURE__ */ new Error("response headers are too large"), {
				code: "invalid_route_response",
				status: 500
			});
			headers[name.toLowerCase()] = value;
		}
	}
	return {
		...status === void 0 ? {} : { status },
		...contentType === void 0 ? {} : { contentType },
		...source === void 0 ? {} : { headers }
	};
}
function releaseStreamAccounting(id) {
	finishedStreams.delete(id);
	streamCredit.delete(id);
	streamSent.delete(id);
	streamAcked.delete(id);
	wakeSendBudgetWaiters();
}
async function activate(replyId, hostFile, generation, manifest) {
	const pendingEffects = [];
	let activationOpen = true;
	const ensureOpen = () => {
		if (!activationOpen || generationController.signal.aborted) throw new Error("host activation is closed");
	};
	const api = {
		manifest: Object.freeze(manifest),
		context: Object.freeze({ logger: Object.freeze(loggerAdapter) }),
		schema: Schema,
		signal: generationController.signal,
		action(name, spec) {
			ensureOpen();
			if (!/^[a-z][a-z0-9-]{0,63}$/u.test(name) || typeof spec?.run !== "function") throw runtimeError("invalid_action", `invalid action ${name}`);
			if (actions.has(name)) throw runtimeError("duplicate_action", `duplicate action ${name}`);
			if (actions.size + routes.length >= limits.maxRegistrations) throw runtimeError("extension_registration_limit", "local worker registration limit reached");
			const timeoutMs = checkedTimeout(spec.timeoutMs, "invalid_action");
			const input = spec.input;
			actions.set(name, Object.freeze({
				run: spec.run.bind(spec),
				...input === void 0 ? {} : { input: typeof input === "function" ? input : Object.freeze({ parse: input.parse.bind(input) }) },
				...timeoutMs === void 0 ? {} : { timeoutMs }
			}));
		},
		route(spec) {
			ensureOpen();
			if (typeof spec?.handle !== "function") throw runtimeError("invalid_route", "invalid route");
			if (actions.size + routes.length >= limits.maxRegistrations) throw runtimeError("extension_registration_limit", "local worker registration limit reached");
			const method = spec.method.toUpperCase();
			if (![
				"GET",
				"HEAD",
				"POST",
				"PUT",
				"PATCH",
				"DELETE"
			].includes(method) || spec.kind !== void 0 && spec.kind !== "exact" && spec.kind !== "prefix") throw new Error("invalid route");
			const path = normalizeWorkerRoutePath(spec.path);
			const kind = spec.kind ?? "exact";
			if (routes.some((route) => route.method === method && route.path === path && (route.kind ?? "exact") === kind)) throw new Error("duplicate route");
			const timeoutMs = checkedTimeout(spec.timeoutMs, "invalid_route");
			routes.push(Object.freeze({
				method,
				path,
				kind,
				handle: spec.handle.bind(spec),
				...timeoutMs === void 0 ? {} : { timeoutMs }
			}));
		},
		effect(setup) {
			ensureOpen();
			const result = setup();
			if (result instanceof Promise) {
				const pending = result.then(async (cleanup) => {
					if (typeof cleanup !== "function") return;
					if (activationOpen && !generationController.signal.aborted) cleanups.push(cleanup);
					else await cleanup();
				});
				pendingEffects.push(pending);
				pending.catch(() => void 0);
			} else if (typeof result === "function") cleanups.push(result);
		}
	};
	let imported;
	try {
		imported = await import(`${pathToFileURL(hostFile).href}?dsh_generation=${generation}`);
	} catch {
		send({
			kind: "error",
			runtimeId,
			id: replyId,
			code: "host_load_failed",
			message: "could not load host.mjs",
			status: 500
		});
		return;
	}
	if (generationController.signal.aborted) return;
	try {
		if (imported.default !== void 0) await imported.default(api);
		await Promise.all(pendingEffects);
	} catch (error) {
		activationOpen = false;
		const business = businessErrorShape(error);
		send({
			kind: "error",
			runtimeId,
			id: replyId,
			code: business?.code ?? "host_activation_failed",
			message: boundedMessage(error),
			status: business?.status ?? 500
		});
		return;
	}
	activationOpen = false;
	const actionMetadata = [...actions.entries()].map(([name, spec]) => {
		const timeoutMs = validOperationTimeout(spec.timeoutMs);
		return {
			name,
			...timeoutMs === void 0 ? {} : { timeoutMs }
		};
	});
	const routeMetadata = routes.map((route) => {
		const timeoutMs = validOperationTimeout(route.timeoutMs);
		return {
			method: String(route.method).toUpperCase(),
			path: normalizeWorkerRoutePath(route.path),
			kind: route.kind ?? "exact",
			...timeoutMs === void 0 ? {} : { timeoutMs }
		};
	});
	send({
		kind: "activated",
		runtimeId,
		actions: actionMetadata,
		routes: routeMetadata
	});
}
function checkedTimeout(value, code) {
	if (value === void 0) return void 0;
	const timeout = validOperationTimeout(value);
	if (timeout === void 0) throw Object.assign(/* @__PURE__ */ new Error("operation timeoutMs is invalid"), {
		code,
		status: 400
	});
	return timeout;
}
function runtimeError(code, message) {
	return Object.assign(new Error(message), {
		code,
		status: 400
	});
}
async function runAction(id, name, deviceId, input) {
	const spec = actions.get(name);
	if (spec === void 0) {
		send({
			kind: "error",
			runtimeId,
			id,
			code: "action_not_found",
			message: `action ${name} not found`,
			status: 404
		});
		return;
	}
	const controller = new AbortController();
	requestControllers.set(id, controller);
	const onGenerationAbort = () => {
		controller.abort(generationController.signal.reason);
	};
	if (generationController.signal.aborted) controller.abort();
	else generationController.signal.addEventListener("abort", onGenerationAbort, { once: true });
	const errorReply = (error) => {
		const business = businessErrorShape(error);
		if (business !== void 0) {
			send({
				kind: "error",
				runtimeId,
				id,
				code: business.code,
				message: business.message,
				status: business.status
			});
			return;
		}
		send({
			kind: "error",
			runtimeId,
			id,
			code: "extension_failed",
			message: boundedMessage(error),
			status: 500
		});
	};
	try {
		let parsed = input;
		if (spec.input !== void 0) try {
			parsed = typeof spec.input === "function" ? spec.input(input) : spec.input.parse(input) ?? input;
			parsed = await parsed;
		} catch {
			send({
				kind: "error",
				runtimeId,
				id,
				code: "invalid_action_input",
				message: "action input is invalid",
				status: 400
			});
			return;
		}
		controller.signal.throwIfAborted();
		const bytes = serializeWorkerResult(await spec.run({
			signal: controller.signal,
			deviceId
		}, parsed));
		if (bytes.byteLength > limits.resultMaxBytes) {
			send({
				kind: "error",
				runtimeId,
				id,
				code: "extension_result_too_large",
				message: "extension result is too large",
				status: 500
			});
			return;
		}
		send({
			kind: "result",
			runtimeId,
			id,
			bytes
		});
	} catch (error) {
		errorReply(error);
	} finally {
		requestControllers.delete(id);
		generationController.signal.removeEventListener("abort", onGenerationAbort);
	}
}
//#endregion
export {};

//# sourceMappingURL=extension-worker-runtime.mjs.map