import { createRequire } from "node:module";
import { X509Certificate, createHash, createPrivateKey, createPublicKey, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, win32 } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import z from "@deepseek-ai/schemastery";
import { connect, createServer } from "node:net";
import { chmod, copyFile, lstat, mkdir, mkdtemp, open, opendir, readFile, readdir, realpath, rename, rm, rmdir, stat, unlink, writeFile } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { createSocket } from "node:dgram";
import { homedir, hostname, networkInterfaces, tmpdir } from "node:os";
import { createServer as createServer$1, request } from "node:http";
import { createServer as createServer$2, request as request$1 } from "node:https";
import { Readable, Transform, finished } from "node:stream";
import { finished as finished$1, pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { createGzip, gzip } from "node:zlib";
import Bonjour from "bonjour-service";
import * as QRCode from "qrcode";
import WebSocket, { WebSocketServer } from "ws";
import { Logger, Service } from "@deepseek-ai/cordis";
import { Worker } from "node:worker_threads";
import { connect as connect$1 } from "node:tls";
import { generate } from "selfsigned";
import { boundContextSummary, createUserMessage } from "@deepseek-ai/dsh-llm/message";
import { lookup } from "node:dns/promises";
import { constants } from "node:fs";
//#region src/access.ts
/** Stable error categories converted to deliberately terse HTTP responses. */
var AccessError = class extends Error {
	status;
	code;
	constructor(status, code) {
		super(code);
		this.status = status;
		this.code = code;
		this.name = "AccessError";
	}
};
/** Fixed-window limiter whose attacker-controlled key table is itself bounded. */
var BoundedRateLimiter = class {
	limit;
	windowMs;
	maximumKeys;
	buckets = /* @__PURE__ */ new Map();
	constructor(limit, windowMs, maximumKeys) {
		this.limit = limit;
		this.windowMs = windowMs;
		this.maximumKeys = maximumKeys;
	}
	/** Consume one attempt; unknown keys fail closed when the bounded table is full. */
	take(key, now) {
		for (const [candidate, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(candidate);
		const current = this.buckets.get(key);
		if (current === void 0) {
			if (this.buckets.size >= this.maximumKeys) return false;
			this.buckets.set(key, {
				count: 1,
				resetAt: now + this.windowMs
			});
			return true;
		}
		if (current.count >= this.limit) return false;
		current.count += 1;
		return true;
	}
	/** Current table size, exposed for bounded-state assertions. */
	get size() {
		return this.buckets.size;
	}
};
function opaqueToken() {
	return randomBytes(32).toString("base64url");
}
function digest$1(value) {
	return createHash("sha256").update(value, "utf8").digest();
}
function digestHex(value) {
	return digest$1(value).toString("hex");
}
function matchesDigest(value, expected) {
	return timingSafeEqual(digest$1(value), expected);
}
function normalizeLabel(value) {
	const label = (value ?? "Mobile device").normalize("NFC").trim();
	if (label.length < 1 || label.length > 64 || /[\u0000-\u001f\u007f]/u.test(label)) throw new AccessError(400, "invalid_request");
	return label;
}
function publicDevice(device) {
	return Object.freeze({
		id: device.id,
		label: device.label,
		createdAt: device.createdAt,
		expiresAt: device.expiresAt,
		lastSeenAt: device.lastSeenAt,
		...device.revokedAt === void 0 ? {} : { revokedAt: device.revokedAt }
	});
}
/** Pairing, persistent-device, short-Session, revocation, and CSRF state machine. */
var AccessController = class {
	store;
	options;
	now;
	pairLimiter;
	devices = [];
	pairingWindow;
	sessions = /* @__PURE__ */ new Map();
	sessionEndedListeners = /* @__PURE__ */ new Set();
	mutation = Promise.resolve();
	initialized = false;
	closing = false;
	closeTask;
	constructor(store, options) {
		this.store = store;
		this.options = options;
		this.now = options.now ?? Date.now;
		this.pairLimiter = new BoundedRateLimiter(options.maxPairingAttempts, options.rateLimitWindowMs, options.maxRateLimitKeys);
	}
	/** Load and validate digest-only durable state before accepting traffic. */
	async initialize() {
		if (this.initialized || this.closing) throw new Error("access controller cannot be initialized again");
		const snapshot = await this.store.load();
		const devices = snapshot.devices.filter((device) => device.revokedAt === void 0);
		if (devices.length > this.options.maxDevices) throw new Error("device state exceeds configured maxDevices");
		if (devices.length !== snapshot.devices.length) await this.store.save(this.snapshot(devices));
		this.devices = devices;
		this.initialized = true;
	}
	requireInitialized() {
		if (!this.initialized || this.closing) throw new Error("access controller is not available");
	}
	async exclusive(operation) {
		const prior = this.mutation;
		let release;
		this.mutation = new Promise((resolve) => {
			release = resolve;
		});
		await prior;
		try {
			return await operation();
		} finally {
			release();
		}
	}
	snapshot(devices) {
		return Object.freeze({
			version: 1,
			devices: Object.freeze([...devices])
		});
	}
	emitSessionEnded(session, reason) {
		const authorization = Object.freeze({
			sessionKey: session.key,
			deviceId: session.deviceId,
			expiresAt: session.expiresAt
		});
		for (const listener of this.sessionEndedListeners) listener(authorization, reason);
	}
	removeSession(key, reason) {
		const session = this.sessions.get(key);
		if (session === void 0) return;
		this.sessions.delete(key);
		this.emitSessionEnded(session, reason);
	}
	pruneSessions(now) {
		for (const [key, session] of this.sessions) if (session.expiresAt <= now) this.removeSession(key, "expired");
	}
	createSession(deviceId, now, deviceExpiresAt) {
		this.pruneSessions(now);
		if (this.sessions.size >= this.options.maxSessions) {
			const oldest = [...this.sessions.values()].sort((left, right) => left.createdAt - right.createdAt)[0];
			if (oldest !== void 0) this.removeSession(oldest.key, "evicted");
		}
		const sessionToken = opaqueToken();
		const csrfToken = opaqueToken();
		const key = digestHex(sessionToken);
		const record = Object.freeze({
			key,
			deviceId,
			csrfDigest: digest$1(csrfToken),
			createdAt: now,
			expiresAt: Math.min(now + this.options.sessionTtlMs, deviceExpiresAt)
		});
		this.sessions.set(key, record);
		return Object.freeze({
			deviceId,
			sessionToken,
			csrfToken,
			sessionExpiresAt: record.expiresAt
		});
	}
	/** Open one short pairing window and return its one-time secret to a loopback caller only. */
	async openPairing(requestedTtlMs) {
		this.requireInitialized();
		return this.exclusive(async () => {
			const ttl = requestedTtlMs ?? this.options.pairingTtlMs;
			if (!Number.isSafeInteger(ttl) || ttl < 1e4 || ttl > this.options.pairingTtlMs) throw new AccessError(400, "invalid_request");
			const token = opaqueToken();
			const expiresAt = this.now() + ttl;
			this.pairingWindow = Object.freeze({
				digest: digest$1(token),
				expiresAt
			});
			return Object.freeze({
				token,
				expiresAt
			});
		});
	}
	/** Consume the pairing window exactly once and persist only the device-token digest. */
	async pair(sourceKey, token, label) {
		this.requireInitialized();
		const now = this.now();
		if (!this.pairLimiter.take(sourceKey, now)) throw new AccessError(429, "rate_limited");
		if (token.length > 512) throw new AccessError(401, "authentication_failed");
		return this.exclusive(async () => {
			const window = this.pairingWindow;
			if (window === void 0 || window.expiresAt <= now || !matchesDigest(token, window.digest)) {
				if (window !== void 0 && window.expiresAt <= now) this.pairingWindow = void 0;
				throw new AccessError(401, "authentication_failed");
			}
			this.pairingWindow = void 0;
			if (this.devices.filter((device) => device.revokedAt === void 0 && device.expiresAt > now).length >= this.options.maxDevices) throw new AccessError(409, "device_limit");
			const deviceToken = opaqueToken();
			const device = Object.freeze({
				id: randomBytes(16).toString("hex"),
				label: normalizeLabel(label),
				tokenDigest: digestHex(deviceToken),
				createdAt: now,
				expiresAt: now + this.options.deviceTtlMs,
				lastSeenAt: now
			});
			const next = [...this.devices.filter((candidate) => candidate.revokedAt === void 0 && candidate.expiresAt > now), device];
			await this.store.save(this.snapshot(next));
			this.devices = next;
			const session = this.createSession(device.id, now, device.expiresAt);
			return Object.freeze({
				...session,
				deviceToken,
				deviceExpiresAt: device.expiresAt
			});
		});
	}
	/** Exchange a valid persistent device credential for a new short Session. */
	async renew(deviceToken) {
		this.requireInitialized();
		return this.exclusive(async () => {
			const now = this.now();
			const device = this.requireDevice(deviceToken, now);
			const index = this.devices.indexOf(device);
			const updated = Object.freeze({
				...device,
				lastSeenAt: now
			});
			const next = [...this.devices];
			next[index] = updated;
			await this.store.save(this.snapshot(next));
			this.devices = next;
			return this.createSession(device.id, now, device.expiresAt);
		});
	}
	/** Validate a persistent device credential without consuming a Session slot. */
	async probe(deviceToken) {
		this.requireInitialized();
		return this.exclusive(async () => {
			const now = this.now();
			const device = this.requireDevice(deviceToken, now);
			const index = this.devices.indexOf(device);
			const updated = Object.freeze({
				...device,
				lastSeenAt: now
			});
			const next = [...this.devices];
			next[index] = updated;
			await this.store.save(this.snapshot(next));
			this.devices = next;
			return Object.freeze({
				deviceId: device.id,
				deviceExpiresAt: device.expiresAt
			});
		});
	}
	/** Validate a device credential without writing state or opening a Session. */
	authorizeDevice(deviceToken) {
		this.requireInitialized();
		const device = this.requireDevice(deviceToken, this.now());
		return Object.freeze({
			deviceId: device.id,
			deviceExpiresAt: device.expiresAt
		});
	}
	requireDevice(deviceToken, now) {
		if (deviceToken.length > 512) throw new AccessError(401, "authentication_failed");
		const tokenDigest = digest$1(deviceToken);
		const device = this.devices.find((candidate) => timingSafeEqual(Buffer.from(candidate.tokenDigest, "hex"), tokenDigest));
		if (device === void 0) throw new AccessError(401, "authentication_failed");
		if (device.revokedAt !== void 0) throw new AccessError(401, "device_revoked");
		if (device.expiresAt <= now) throw new AccessError(401, "device_expired");
		return device;
	}
	/** Resolve a short Session Cookie without revealing whether device or Session failed. */
	authorizeSession(sessionToken) {
		this.requireInitialized();
		if (sessionToken.length > 512) throw new AccessError(401, "authentication_failed");
		const now = this.now();
		this.pruneSessions(now);
		const key = digestHex(sessionToken);
		const session = this.sessions.get(key);
		const device = session === void 0 ? void 0 : this.devices.find((candidate) => candidate.id === session.deviceId);
		if (session === void 0 || device === void 0 || device.revokedAt !== void 0 || device.expiresAt <= now) {
			if (session !== void 0) this.removeSession(session.key, "expired");
			throw new AccessError(401, "authentication_failed");
		}
		return Object.freeze({
			sessionKey: key,
			deviceId: session.deviceId,
			expiresAt: session.expiresAt
		});
	}
	/** Require the Session-bound anti-CSRF value for an authenticated mutation. */
	assertCsrf(authorization, csrfToken) {
		const session = this.sessions.get(authorization.sessionKey);
		if (session === void 0 || csrfToken === void 0 || csrfToken.length > 512 || !matchesDigest(csrfToken, session.csrfDigest)) throw new AccessError(403, "forbidden");
	}
	/** End one short Session and notify the gateway to abort its attached work. */
	logout(authorization) {
		this.removeSession(authorization.sessionKey, "logout");
	}
	/** Durably delete the device, then end every Session owned by that device. */
	async revokeDevice(deviceId) {
		this.requireInitialized();
		return this.exclusive(async () => {
			const next = this.devices.filter((device) => device.id !== deviceId);
			if (next.length === this.devices.length) return false;
			await this.store.save(this.snapshot(next));
			this.devices = next;
			for (const [key, session] of this.sessions) if (session.deviceId === deviceId) this.removeSession(key, "revoked");
			return true;
		});
	}
	/** Remove every persistent credential and terminate every active Session. */
	async resetDevices() {
		this.requireInitialized();
		await this.exclusive(async () => {
			await this.store.save(this.snapshot([]));
			this.devices = [];
			for (const key of [...this.sessions.keys()]) this.removeSession(key, "revoked");
			this.pairingWindow = void 0;
		});
	}
	/** Safe metadata for the loopback administration surface. */
	listDevices() {
		this.requireInitialized();
		return Object.freeze(this.devices.map(publicDevice));
	}
	/** Pairing status without exposing the one-time secret. */
	pairingStatus() {
		this.requireInitialized();
		const window = this.pairingWindow;
		if (window === void 0 || window.expiresAt <= this.now()) {
			this.pairingWindow = void 0;
			return Object.freeze({ open: false });
		}
		return Object.freeze({
			open: true,
			expiresAt: window.expiresAt
		});
	}
	/** Subscribe gateway resources to Session logout, expiry, eviction, and device revocation. */
	onSessionEnded(listener) {
		this.sessionEndedListeners.add(listener);
		return () => {
			this.sessionEndedListeners.delete(listener);
		};
	}
	/** Stop new operations, drain durable mutations, then clear volatile credentials. */
	close() {
		if (this.closeTask !== void 0) return this.closeTask;
		this.closing = true;
		this.closeTask = this.finishClose();
		return this.closeTask;
	}
	async finishClose() {
		await this.mutation;
		this.pairingWindow = void 0;
		for (const key of [...this.sessions.keys()]) this.removeSession(key, "expired");
		this.sessionEndedListeners.clear();
		this.initialized = false;
	}
	/** Bounded volatile-state metrics for tests and local status. */
	metrics() {
		return Object.freeze({
			sessions: this.sessions.size,
			rateLimitKeys: this.pairLimiter.size
		});
	}
};
//#endregion
//#region src/ip.ts
/**
* Browser-safe IP literal classification.
*
* `node:net` cannot be imported from the browser Client face, so the pure
* predicate lives here instead. Semantics are deliberately identical to
* `net.isIP`: strict dotted-quad IPv4 (no leading zeros, no signs, no
* whitespace), IPv6 with at most one `::`, at most four hex digits per group,
* an optional dotted-quad tail in the final position, and an optional
* non-empty zone id after a single `%`.
*
* This module is dependency-free and side-effect-free on purpose: it is the
* single classification source shared by every face of the plugin — the Node
* side (`config.ts`, `cloudflared-tunnel.ts`, `origin-proxy-config.ts`,
* `vps-deploy.ts`, `gateway.ts`, `network.ts`, `frp-config.ts`) and the browser
* Client face that cannot reach `node:net` — so both classify a given literal
* identically. Callers rely on the strict reading above and never post-process
* the literal afterwards, so changing the accept/reject boundary here changes
* it everywhere, which is the intended contract.
*/
/** Strict dotted-quad IPv4: POSIX `inet_pton` rules, so `01.1.1.1` is rejected. */
function isStrictIpv4(value) {
	const parts = value.split(".");
	if (parts.length !== 4) return false;
	for (const part of parts) {
		if (!/^(?:0|[1-9][0-9]{0,2})$/u.test(part)) return false;
		if (Number(part) > 255) return false;
	}
	return true;
}
/**
* Count the 16-bit groups one side of an IPv6 address occupies.
*
* A dotted-quad tail counts as two groups and is accepted only where the caller
* allows it — that is, only in the final label of the whole address.
*
* @returns the group count, or `-1` when any label is malformed.
*/
function countIpv6Groups(labels, allowDottedQuad) {
	let groups = 0;
	for (let index = 0; index < labels.length; index += 1) {
		const label = labels[index];
		if (label.includes(".")) {
			if (index !== labels.length - 1 || !allowDottedQuad || !isStrictIpv4(label)) return -1;
			groups += 2;
			continue;
		}
		if (!/^[\da-f]{1,4}$/iu.test(label)) return -1;
		groups += 1;
	}
	return groups;
}
/**
* Classify an IP literal.
*
* @param value - candidate address; non-strings are never an IP.
* @returns `4` for IPv4, `6` for IPv6, `0` when the value is neither.
*/
function isIP(value) {
	if (typeof value !== "string") return 0;
	if (isStrictIpv4(value)) return 4;
	let text = value;
	const zone = text.indexOf("%");
	if (zone !== -1) {
		const suffix = text.slice(zone + 1);
		if (suffix.length === 0 || suffix.includes("%")) return 0;
		text = text.slice(0, zone);
	}
	if (text.length === 0) return 0;
	const halves = text.split("::");
	if (halves.length > 2) return 0;
	if (halves.length === 1) return countIpv6Groups(text.split(":"), true) === 8 ? 6 : 0;
	const leftText = halves[0];
	const rightText = halves[1];
	const left = leftText === "" ? [] : leftText.split(":");
	const right = rightText === "" ? [] : rightText.split(":");
	const leftGroups = countIpv6Groups(left, false);
	const rightGroups = countIpv6Groups(right, right.length > 0);
	if (leftGroups < 0 || rightGroups < 0) return 0;
	return leftGroups + rightGroups >= 8 ? 0 : 6;
}
//#endregion
//#region src/network.ts
function parseIpv4$1(address) {
	const parts = address.split(".");
	if (parts.length !== 4) throw new Error(`invalid IPv4 address ${JSON.stringify(address)}`);
	let value = 0n;
	for (const part of parts) {
		if (!/^\d{1,3}$/u.test(part)) throw new Error(`invalid IPv4 address ${JSON.stringify(address)}`);
		const octet = Number(part);
		if (octet > 255) throw new Error(`invalid IPv4 address ${JSON.stringify(address)}`);
		value = value << 8n | BigInt(octet);
	}
	return value;
}
function parseIpv6Part(part, address) {
	if (part.includes(".")) {
		const ipv4 = parseIpv4$1(part);
		return [Number(ipv4 >> 16n & 65535n), Number(ipv4 & 65535n)];
	}
	if (!/^[\da-f]{1,4}$/iu.test(part)) throw new Error(`invalid IPv6 address ${JSON.stringify(address)}`);
	return [Number.parseInt(part, 16)];
}
function parseIpv6(address) {
	const withoutZone = address.split("%", 1)[0] ?? address;
	if (withoutZone.split("::").length > 2) throw new Error(`invalid IPv6 address ${JSON.stringify(address)}`);
	const [leftText, rightText] = withoutZone.split("::");
	const left = leftText === "" ? [] : leftText.split(":").flatMap((part) => parseIpv6Part(part, address));
	const right = rightText === void 0 || rightText === "" ? [] : rightText.split(":").flatMap((part) => parseIpv6Part(part, address));
	const omitted = 8 - left.length - right.length;
	if (rightText === void 0 ? omitted !== 0 : omitted < 1) throw new Error(`invalid IPv6 address ${JSON.stringify(address)}`);
	const groups = [
		...left,
		...Array.from({ length: omitted }, () => 0),
		...right
	];
	if (groups.length !== 8) throw new Error(`invalid IPv6 address ${JSON.stringify(address)}`);
	return groups.reduce((value, group) => value << 16n | BigInt(group), 0n);
}
function mappedIpv4(address) {
	return /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/iu.exec(address)?.[1];
}
function parseIp(address) {
	const unwrapped = address.startsWith("[") && address.endsWith("]") ? address.slice(1, -1) : address;
	const mapped = mappedIpv4(unwrapped);
	if (mapped !== void 0) return {
		bits: 32,
		value: parseIpv4$1(mapped)
	};
	const version = isIP(unwrapped.split("%", 1)[0] ?? unwrapped);
	if (version === 4) return {
		bits: 32,
		value: parseIpv4$1(unwrapped)
	};
	if (version === 6) return {
		bits: 128,
		value: parseIpv6(unwrapped)
	};
	throw new Error(`invalid IP address ${JSON.stringify(address)}`);
}
/** Parse and canonicalize one IPv4 or IPv6 CIDR. */
function parseCidr(source) {
	const slash = source.lastIndexOf("/");
	if (slash <= 0 || slash === source.length - 1) throw new Error(`invalid CIDR ${JSON.stringify(source)}`);
	const parsed = parseIp(source.slice(0, slash));
	const prefixText = source.slice(slash + 1);
	if (!/^\d{1,3}$/u.test(prefixText)) throw new Error(`invalid CIDR ${JSON.stringify(source)}`);
	const prefix = Number(prefixText);
	if (prefix > parsed.bits) throw new Error(`invalid CIDR ${JSON.stringify(source)}`);
	const hostBits = BigInt(parsed.bits - prefix);
	const mask = hostBits === BigInt(parsed.bits) ? 0n : (1n << BigInt(parsed.bits)) - 1n ^ (1n << hostBits) - 1n;
	const network = parsed.value & mask;
	if (network !== parsed.value) throw new Error(`CIDR ${JSON.stringify(source)} has host bits set`);
	return Object.freeze({
		bits: parsed.bits,
		network,
		prefix,
		source
	});
}
/** Whether a directly connected socket address belongs to at least one allowed CIDR. */
function addressAllowed(address, cidrs) {
	if (address === void 0) return false;
	let parsed;
	try {
		parsed = parseIp(address);
	} catch {
		return false;
	}
	return cidrs.some((cidr) => {
		if (cidr.bits !== parsed.bits) return false;
		const hostBits = BigInt(cidr.bits - cidr.prefix);
		const mask = hostBits === BigInt(cidr.bits) ? 0n : (1n << BigInt(cidr.bits)) - 1n ^ (1n << hostBits) - 1n;
		return (parsed.value & mask) === cidr.network;
	});
}
/** Whether an IP literal is loopback and therefore eligible for HTTP-only development. */
function isLoopbackAddress(address) {
	try {
		const parsed = parseIp(address);
		if (parsed.bits === 32) return parsed.value >> 24n === 127n;
		return parsed.value === 1n;
	} catch {
		return false;
	}
}
/**
* IPv4 ranges that are never a public VPS endpoint (IANA special-purpose,
* private, shared, loopback, link-local, documentation, benchmark, multicast,
* and reserved space). Kept in sync with Android `RemoteHostPolicy`.
*/
const NON_ROUTABLE_IPV4_RANGES = Object.freeze([
	[0n, 8],
	[167772160n, 8],
	[1681915904n, 10],
	[2130706432n, 8],
	[2851995648n, 16],
	[2886729728n, 12],
	[3221225472n, 24],
	[3221225984n, 24],
	[3223307264n, 24],
	[3224682752n, 24],
	[3227017984n, 24],
	[3232235520n, 16],
	[3232706560n, 24],
	[3323068416n, 15],
	[3325256704n, 24],
	[3405803776n, 24],
	[3758096384n, 4],
	[4026531840n, 4]
]);
function parseStrictIpv4Octets(address) {
	const parts = address.split(".");
	if (parts.length !== 4) return void 0;
	const octets = [];
	for (const part of parts) {
		if (!/^(?:0|[1-9][0-9]{0,2})$/u.test(part)) return void 0;
		const octet = Number(part);
		if (octet > 255) return void 0;
		octets.push(octet);
	}
	return octets;
}
/**
* Whether a dotted-quad IPv4 literal is globally routable and therefore usable
* as a public VPS / remote HTTPS endpoint. Rejects documentation addresses such
* as 203.0.113.10 alongside private, shared, and reserved space.
*/
function isGloballyRoutableIpv4(address) {
	const octets = parseStrictIpv4Octets(address);
	if (octets === void 0) return false;
	const value = BigInt(octets[0]) << 24n | BigInt(octets[1]) << 16n | BigInt(octets[2]) << 8n | BigInt(octets[3]);
	return !NON_ROUTABLE_IPV4_RANGES.some(([network, prefix]) => {
		if (prefix === 0) return true;
		const hostBits = BigInt(32 - prefix);
		const mask = (1n << 32n) - 1n ^ (1n << hostBits) - 1n;
		return (value & mask) === network;
	});
}
/** Parse a bare host or host:port authority without accepting URL components. */
function parseAuthority(source) {
	if (source.trim() !== source || source.length === 0 || /[/?#@\\]/u.test(source)) throw new Error(`invalid public authority ${JSON.stringify(source)}`);
	let url;
	try {
		url = new URL(`https://${source}`);
	} catch {
		throw new Error(`invalid public authority ${JSON.stringify(source)}`);
	}
	if (url.username !== "" || url.password !== "" || url.pathname !== "/" || url.search !== "" || url.hash !== "") throw new Error(`invalid public authority ${JSON.stringify(source)}`);
	const explicitPort = /\]:\d+$/u.test(source) || !source.startsWith("[") && /:\d+$/u.test(source);
	const hostname = url.hostname.toLowerCase();
	const port = explicitPort ? Number(url.port === "" ? 443 : url.port) : void 0;
	if (port !== void 0 && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error(`invalid public authority ${JSON.stringify(source)}`);
	return port === void 0 ? Object.freeze({ hostname }) : Object.freeze({
		hostname,
		port
	});
}
function formatHostname(hostname) {
	return hostname.includes(":") && !hostname.startsWith("[") ? `[${hostname}]` : hostname;
}
/** Resolve an authority against the actual listener port. */
function resolveAuthority(spec, listenerPort) {
	return `${formatHostname(spec.hostname)}:${String(spec.port ?? listenerPort)}`;
}
/** Exact Host/Origin/CIDR policy for the directly exposed listener. */
var RequestTrustPolicy = class {
	cidrs;
	authorities;
	origins;
	scheme;
	constructor(specs, listenerPort, cidrs, tls) {
		this.cidrs = cidrs;
		this.scheme = tls ? "https" : "http";
		this.authorities = new Set(specs.map((spec) => resolveAuthority(spec, listenerPort).toLowerCase()));
		this.origins = new Set([...this.authorities].map((authority) => new URL(`${this.scheme}://${authority}`).origin.toLowerCase()));
	}
	/** Validate the exact Host header after WHATWG authority normalization. */
	acceptsHost(header) {
		return this.canonicalHost(header) !== void 0;
	}
	/** Return the canonical accepted Host authority, otherwise undefined. */
	canonicalHost(header) {
		if (header === void 0 || /[/?#@\\]/u.test(header)) return void 0;
		let normalized;
		try {
			const parsed = new URL(`${this.scheme}://${header}`);
			if (parsed.pathname !== "/" || parsed.username !== "" || parsed.password !== "") return void 0;
			normalized = resolveAuthority({
				hostname: parsed.hostname,
				port: Number(parsed.port || (this.scheme === "https" ? "443" : "80"))
			}, 80).toLowerCase();
		} catch {
			return;
		}
		return this.authorities.has(normalized) ? normalized : void 0;
	}
	/** Validate an exact same-scheme browser Origin. */
	acceptsOrigin(header) {
		return this.canonicalOrigin(header) !== void 0;
	}
	/** Return the canonical accepted Origin, otherwise undefined. */
	canonicalOrigin(header) {
		if (header === void 0) return void 0;
		let normalized;
		for (const part of header.split(",")) {
			const trimmed = part.trim();
			if (trimmed === "undefined") continue;
			let candidate;
			try {
				const parsed = new URL(trimmed);
				if (parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== "" || parsed.username !== "" || parsed.password !== "") return;
				candidate = parsed.origin.toLowerCase();
			} catch {
				return;
			}
			if (!this.origins.has(candidate) || normalized !== void 0) return void 0;
			normalized = candidate;
		}
		return normalized;
	}
};
/**
* Open a plain TCP connection only to learn whether something is listening.
*
* Used by the on-demand self-check so the panel can tell "frps is up" from
* "frps is not listening". A transparent proxy can acknowledge any connect, so
* this result is advisory and never authorises a security decision on its own.
*/
async function probeTcpReachable(host, port, timeoutMs = 1500) {
	if (!Number.isSafeInteger(port) || port < 1 || port > 65535) return false;
	return new Promise((resolveProbe) => {
		let finished = false;
		const socket = connect({
			host,
			port
		});
		const finish = (reachable) => {
			if (finished) return;
			finished = true;
			clearTimeout(timer);
			socket.destroy();
			resolveProbe(reachable);
		};
		const timer = setTimeout(() => {
			finish(false);
		}, timeoutMs);
		timer.unref();
		socket.once("connect", () => {
			finish(true);
		});
		socket.once("error", () => {
			finish(false);
		});
		socket.once("close", () => {
			finish(false);
		});
	});
}
//#endregion
//#region src/websocket-paths.ts
/** Cap the admin-approved extra WebSocket upgrade paths (exact pathnames). */
const MAX_EXTRA_WEBSOCKET_PATHS = 16;
const MAX_WEBSOCKET_PATH_LENGTH = 256;
function fail(code) {
	throw new Error(code);
}
/**
* Validate one exact pathname for proxying. Query strings are matched at
* upgrade time, so only the pathname is stored. Rejects anything the
* gateway cannot match exactly.
*/
function validateWebSocketPath(value) {
	if (typeof value !== "string") fail("websocket_path_invalid");
	const path = value;
	if (path.length === 0 || path.length > 256) fail("websocket_path_invalid");
	if (!path.startsWith("/")) fail("websocket_path_invalid");
	if (/[\s\u0000-\u001f\u007f#?]/u.test(path)) fail("websocket_path_invalid");
	if (path.includes("..")) fail("websocket_path_invalid");
	return path;
}
/** Validate a whole replacement list all-or-nothing; duplicates collapse. */
function normalizeWebSocketPaths(value) {
	if (!Array.isArray(value)) fail("websocket_paths_invalid");
	if (value.length > 16) fail("websocket_paths_invalid");
	const seen = /* @__PURE__ */ new Set();
	for (const entry of value) {
		const path = validateWebSocketPath(entry);
		seen.add(path);
	}
	return [...seen];
}
/** Cap remembered rejected upgrade paths offered for one-click approval. */
const MAX_BLOCKED_UPGRADE_PATHS = 32;
/**
* In-memory log of rejected third-party upgrade paths, shared by every
* gateway instance so the approval UI sees attempts on any listener.
* Bounded and newest-first; a restart clears it (attempts reappear on
* the next blocked handshake).
*/
var BlockedUpgradePathLog = class {
	entries = /* @__PURE__ */ new Map();
	record(pathname) {
		const now = Date.now();
		const stats = this.entries.get(pathname);
		if (stats === void 0) {
			if (this.entries.size >= 32) {
				let oldest;
				for (const [path, entry] of this.entries) if (oldest === void 0 || entry.lastSeen < (this.entries.get(oldest)?.lastSeen ?? 0)) oldest = path;
				if (oldest !== void 0) this.entries.delete(oldest);
			}
			this.entries.set(pathname, {
				attempts: 1,
				firstSeen: now,
				lastSeen: now
			});
			return;
		}
		stats.attempts += 1;
		stats.lastSeen = now;
	}
	report() {
		return [...this.entries].map(([path, stats]) => ({
			path,
			...stats
		})).sort((a, b) => b.lastSeen - a.lastSeen);
	}
};
/** File-backed store shared by every gateway instance (LAN and remote). */
var WebSocketPathStore = class {
	file;
	paths = /* @__PURE__ */ new Set();
	loaded = false;
	constructor(file) {
		this.file = file;
	}
	/** Snapshot for the upgrade check. */
	has(pathname) {
		return this.paths.has(pathname);
	}
	list() {
		return [...this.paths];
	}
	async load() {
		if (!this.loaded) {
			try {
				const raw = JSON.parse(await readFile(this.file, "utf8"));
				this.paths = new Set(normalizeWebSocketPaths(raw.paths ?? []));
			} catch {
				this.paths = /* @__PURE__ */ new Set();
			}
			this.loaded = true;
		}
		return this.list();
	}
	/** Replace the whole list after validating; persists atomically. */
	async replace(paths) {
		const next = normalizeWebSocketPaths([...paths]);
		await mkdir(dirname(this.file), { recursive: true });
		await writeFile(this.file, `${JSON.stringify({ paths: next })}\n`, "utf8");
		this.paths = new Set(next);
		this.loaded = true;
		return this.list();
	}
};
//#endregion
//#region src/extension-worker-config.ts
function integer$1(value, name, fallback, minimum, maximum) {
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
	const streamWindowBytes = integer$1(value.streamWindowBytes, "streamWindowBytes", 262144, 1024, 4194304);
	const streamChunkBytes = integer$1(value.streamChunkBytes, "streamChunkBytes", 65536, 1024, streamWindowBytes);
	const streamAggregateBytes = integer$1(value.streamAggregateBytes, "streamAggregateBytes", 1048576, streamWindowBytes, 33554432);
	return Object.freeze({
		mode,
		extensions: value.extensions === void 0 ? void 0 : Object.freeze([...value.extensions]),
		maxWorkers: integer$1(value.maxWorkers, "maxWorkers", 8, 1, 128),
		maxRegistrations: integer$1(value.maxRegistrations, "maxRegistrations", 256, 1, 4096),
		maxOldGenerationSizeMb: integer$1(value.maxOldGenerationSizeMb, "maxOldGenerationSizeMb", 128, 16, 4096),
		maxYoungGenerationSizeMb: integer$1(value.maxYoungGenerationSizeMb, "maxYoungGenerationSizeMb", 16, 1, 512),
		stackSizeMb: integer$1(value.stackSizeMb, "stackSizeMb", 4, 1, 64),
		activationTimeoutMs: integer$1(value.activationTimeoutMs, "activationTimeoutMs", 5e3, 1, 3e5),
		operationTimeoutMs: integer$1(value.operationTimeoutMs, "operationTimeoutMs", 3e4, 1, 3e5),
		cancelGraceMs: integer$1(value.cancelGraceMs, "cancelGraceMs", 250, 1, 3e4),
		streamCancelGraceMs: integer$1(value.streamCancelGraceMs, "streamCancelGraceMs", 1e3, 1, 3e4),
		disposeGraceMs: integer$1(value.disposeGraceMs, "disposeGraceMs", 2e3, 1, 3e4),
		resultMaxBytes: integer$1(value.resultMaxBytes, "resultMaxBytes", 4194304, 1024, 4194304),
		streamWindowBytes,
		streamChunkBytes,
		streamAggregateBytes,
		logWindowMs: integer$1(value.logWindowMs, "logWindowMs", 1e3, 1, 6e4),
		logMessagesPerWindow: integer$1(value.logMessagesPerWindow, "logMessagesPerWindow", 64, 1, 1024),
		logMessageBytes: integer$1(value.logMessageBytes, "logMessageBytes", 4096, 128, 65536)
	});
}
//#endregion
//#region src/config.ts
/** Loader-facing defaults; {@link parseGatewayConfig} enforces cross-field security rules. */
const Config = z.object({
	hostExecution: z.object({
		mode: z.union([z.const("in-process"), z.const("worker")]),
		extensions: z.union([z.const(void 0), z.array(String)]),
		maxWorkers: z.natural(),
		maxRegistrations: z.natural(),
		maxOldGenerationSizeMb: z.natural(),
		maxYoungGenerationSizeMb: z.natural(),
		stackSizeMb: z.natural(),
		activationTimeoutMs: z.natural(),
		operationTimeoutMs: z.natural(),
		cancelGraceMs: z.natural(),
		streamCancelGraceMs: z.natural(),
		disposeGraceMs: z.natural(),
		resultMaxBytes: z.natural(),
		streamWindowBytes: z.natural(),
		streamChunkBytes: z.natural(),
		streamAggregateBytes: z.natural(),
		logWindowMs: z.natural(),
		logMessagesPerWindow: z.natural(),
		logMessageBytes: z.natural()
	}),
	setupFile: z.string().hidden(),
	publicOrigin: z.string(),
	listenHost: z.string(),
	listenPort: z.natural().max(65535),
	upstreamOrigin: z.string(),
	publicAuthorities: z.array(String).default(void 0),
	allowedCidrs: z.array(String).default(void 0),
	stateFile: String,
	controlFile: z.string().hidden().required(),
	customCssFile: z.string().hidden(),
	customScriptFile: z.string().hidden(),
	mobileLayoutFile: z.string().hidden(),
	mobileCompatibilityFile: z.string().hidden(),
	excludedClientModules: z.array(String).default([]),
	websocketCompression: z.object({
		paths: z.array(String).default([]),
		maxMessageBytes: z.natural(),
		maxQueuedBytes: z.natural(),
		thresholdBytes: z.natural(),
		concurrencyLimit: z.natural(),
		level: z.natural().max(9)
	}),
	instanceId: z.string().hidden(),
	pairingCaFile: z.string().hidden(),
	initiallyEnabled: z.boolean().hidden().required(),
	tls: z.object({
		mode: z.union([z.const("provided"), z.const("disabled")]),
		certFile: z.string(),
		keyFile: z.string(),
		caFile: z.string()
	}),
	pairingTtlMs: z.natural(),
	deviceTtlMs: z.natural(),
	sessionTtlMs: z.natural(),
	maxDevices: z.natural(),
	maxSessions: z.natural(),
	maxConnections: z.natural(),
	maxActiveRequests: z.natural(),
	maxWebSockets: z.natural(),
	maxBodyBytes: z.natural(),
	upstreamTimeoutMs: z.natural(),
	upstreamApiTimeoutMs: z.natural(),
	rateLimitWindowMs: z.natural(),
	maxPairingAttempts: z.natural(),
	maxRateLimitKeys: z.natural()
});
function integer(value, name, fallback, minimum, maximum) {
	const resolved = value ?? fallback;
	if (typeof resolved !== "number" || !Number.isSafeInteger(resolved) || resolved < minimum || resolved > maximum) throw new Error(`${name} must be an integer from ${String(minimum)} through ${String(maximum)}`);
	return resolved;
}
function parseWebSocketCompression(raw) {
	if (raw !== void 0 && (typeof raw !== "object" || raw === null || Array.isArray(raw))) throw new Error("websocketCompression must be an object");
	const value = raw ?? {};
	const maxMessageBytes = integer(value.maxMessageBytes, "websocketCompression.maxMessageBytes", 33554432, 1024, 268435456);
	const maxQueuedBytes = integer(value.maxQueuedBytes, "websocketCompression.maxQueuedBytes", 67108864, 1024, 268435456);
	if (maxQueuedBytes < maxMessageBytes + 14) throw new Error("websocketCompression.maxQueuedBytes must cover maxMessageBytes and the frame header");
	return Object.freeze({
		paths: Object.freeze(normalizeWebSocketPaths(value.paths ?? [])),
		maxMessageBytes,
		maxQueuedBytes,
		thresholdBytes: integer(value.thresholdBytes, "websocketCompression.thresholdBytes", 1024, 0, maxMessageBytes),
		concurrencyLimit: integer(value.concurrencyLimit, "websocketCompression.concurrencyLimit", 4, 1, 32),
		level: integer(value.level, "websocketCompression.level", 3, 0, 9)
	});
}
function stringArray(value, name) {
	if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== "string")) throw new Error(`${name} must be a non-empty string array`);
	return value;
}
function absoluteFile(value, name) {
	if (typeof value !== "string" || value.length === 0 || !isAbsolute(value)) throw new Error(`${name} must be an absolute file path`);
	return resolve(value);
}
function excludedClientModules(value) {
	if (value === void 0) return Object.freeze([]);
	if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || id.length === 0 || id.trim() !== id)) throw new Error("excludedClientModules must be an array of exact, non-empty client module ids");
	const ids = value;
	if (new Set(ids).size !== ids.length) throw new Error("excludedClientModules must not contain duplicate ids");
	return Object.freeze([...ids]);
}
/** Resolve the hidden runtime-control file independently from gateway configuration. */
function parseControlFile(value) {
	return absoluteFile(value, "controlFile");
}
function parseUpstream(value) {
	const source = value ?? "http://127.0.0.1:3080";
	if (typeof source !== "string") throw new Error("upstreamOrigin must be a string");
	let url;
	try {
		url = new URL(source);
	} catch {
		throw new Error("upstreamOrigin must be an HTTP loopback origin");
	}
	if (url.protocol !== "http:" || !isLoopbackAddress(url.hostname) || url.username !== "" || url.password !== "" || url.pathname !== "/" || url.search !== "" || url.hash !== "" || url.port === "") throw new Error("upstreamOrigin must be an HTTP loopback origin with an explicit port and no path or credentials");
	return url;
}
function parsePublicOrigin$1(value) {
	if (value === void 0) return void 0;
	if (typeof value !== "string" || value.length === 0 || value.trim() !== value) throw new Error("publicOrigin must be an HTTPS origin");
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error("publicOrigin must be an HTTPS origin");
	}
	if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.pathname !== "/" || url.search !== "" || url.hash !== "") throw new Error("publicOrigin must be an HTTPS origin with no path or credentials");
	if (url.hostname === "0.0.0.0" || url.hostname === "[::]") throw new Error("publicOrigin must name a reachable host");
	return Object.freeze({
		authority: parseAuthority(url.host),
		port: Number(url.port || "443")
	});
}
function parseTls(value, listenHost) {
	if (value !== void 0 && (value === null || typeof value !== "object" || Array.isArray(value))) throw new Error("tls must be an object");
	const mode = value?.mode ?? "provided";
	if (value?.mode === null || mode !== "provided" && mode !== "disabled") throw new Error("tls.mode must be provided or disabled");
	if (mode === "disabled") {
		if (!isLoopbackAddress(listenHost)) throw new Error("TLS may be disabled only on an IP loopback listener");
		return Object.freeze({ mode });
	}
	return Object.freeze({
		mode,
		certFile: absoluteFile(value?.certFile, "tls.certFile"),
		keyFile: absoluteFile(value?.keyFile, "tls.keyFile"),
		...value?.caFile === void 0 ? {} : { caFile: absoluteFile(value.caFile, "tls.caFile") }
	});
}
/** Parse configuration and reject unsafe topology, credential, and resource combinations. */
function parseGatewayConfig(raw) {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("mobile-access config must be an object");
	const value = raw;
	const publicOrigin = parsePublicOrigin$1(value.publicOrigin);
	if (publicOrigin !== void 0 && value.listenPort !== void 0) throw new Error("publicOrigin cannot be combined with listenPort");
	if (publicOrigin !== void 0 && value.publicAuthorities !== void 0) throw new Error("publicOrigin cannot be combined with publicAuthorities");
	const listenHost = value.listenHost ?? (publicOrigin === void 0 ? "127.0.0.1" : "0.0.0.0");
	if (isIP(listenHost) === 0) throw new Error("listenHost must be an IP literal");
	const listenPort = publicOrigin?.port ?? integer(value.listenPort, "listenPort", 3443, 0, 65535);
	const upstreamOrigin = parseUpstream(value.upstreamOrigin);
	const tls = parseTls(value.tls, listenHost);
	if (publicOrigin !== void 0 && tls.mode !== "provided") throw new Error("publicOrigin requires TLS");
	let authorities;
	if (publicOrigin !== void 0) authorities = [publicOrigin.authority];
	else {
		let authoritySources = value.publicAuthorities;
		if (authoritySources === void 0 || authoritySources.length === 0) {
			if (!isLoopbackAddress(listenHost)) throw new Error("publicAuthorities is required for a non-loopback listener");
			authoritySources = [listenHost];
		}
		authorities = authoritySources.map(parseAuthority);
	}
	for (const authority of authorities) {
		if (listenPort === 0 && authority.port !== void 0) throw new Error("explicit public authority ports require a non-zero listenPort");
		if (authority.port !== void 0 && listenPort !== 0 && authority.port !== listenPort) throw new Error("every explicit public authority port must equal listenPort");
	}
	if (new Set(authorities.map((entry) => `${entry.hostname}:${String(entry.port ?? listenPort)}`)).size !== authorities.length) throw new Error("publicAuthorities must not contain duplicates");
	const allowedCidrs = stringArray(value.allowedCidrs ?? (isLoopbackAddress(listenHost) ? ["127.0.0.0/8", "::1/128"] : void 0), "allowedCidrs").map(parseCidr);
	if (new Set(allowedCidrs.map((entry) => `${String(entry.bits)}:${entry.network.toString(16)}:${String(entry.prefix)}`)).size !== allowedCidrs.length) throw new Error("allowedCidrs must not contain duplicates");
	const deviceTtlMs = integer(value.deviceTtlMs, "deviceTtlMs", 7776e6, 6e4, 316224e5);
	const sessionTtlMs = integer(value.sessionTtlMs, "sessionTtlMs", 288e5, 3e4, 864e5);
	if (sessionTtlMs > deviceTtlMs) throw new Error("sessionTtlMs must not exceed deviceTtlMs");
	return Object.freeze({
		listenHost,
		hostExecution: resolveHostExecution(value.hostExecution),
		listenPort,
		upstreamOrigin,
		authorities: Object.freeze(authorities),
		allowedCidrs: Object.freeze(allowedCidrs),
		stateFile: absoluteFile(value.stateFile, "stateFile"),
		extensionsDir: join(dirname(absoluteFile(value.stateFile, "stateFile")), "extensions"),
		customCssFile: value.customCssFile === void 0 ? join(dirname(absoluteFile(value.stateFile, "stateFile")), "mobile.css") : absoluteFile(value.customCssFile, "customCssFile"),
		customScriptFile: value.customScriptFile === void 0 ? join(dirname(absoluteFile(value.stateFile, "stateFile")), "mobile.js") : absoluteFile(value.customScriptFile, "customScriptFile"),
		mobileLayoutFile: value.mobileLayoutFile === void 0 ? fileURLToPath(new URL("./mobile-layout.js", import.meta.url)) : absoluteFile(value.mobileLayoutFile, "mobileLayoutFile"),
		mobileCompatibilityFile: value.mobileCompatibilityFile === void 0 ? fileURLToPath(new URL("./mobile-compat.js", import.meta.url)) : absoluteFile(value.mobileCompatibilityFile, "mobileCompatibilityFile"),
		excludedClientModules: excludedClientModules(value.excludedClientModules),
		websocketCompression: parseWebSocketCompression(value.websocketCompression),
		instanceId: value.instanceId === void 0 ? createHash("sha256").update(absoluteFile(value.stateFile, "stateFile")).digest("hex") : /^[a-f\d]{64}$/u.test(value.instanceId) ? value.instanceId : (() => {
			throw new Error("instanceId must be a lowercase SHA-256 value");
		})(),
		...value.pairingCaFile === void 0 ? {} : { pairingCaFile: absoluteFile(value.pairingCaFile, "pairingCaFile") },
		tls,
		publicTls: tls.mode === "provided",
		discovery: true,
		pairingTtlMs: integer(value.pairingTtlMs, "pairingTtlMs", 12e4, 1e4, 6e5),
		deviceTtlMs,
		sessionTtlMs,
		maxDevices: integer(value.maxDevices, "maxDevices", 32, 1, 256),
		maxSessions: integer(value.maxSessions, "maxSessions", 64, 1, 1024),
		maxConnections: integer(value.maxConnections, "maxConnections", 64, 1, 1024),
		maxActiveRequests: integer(value.maxActiveRequests, "maxActiveRequests", 32, 1, 1024),
		maxWebSockets: integer(value.maxWebSockets, "maxWebSockets", 16, 1, 256),
		maxBodyBytes: integer(value.maxBodyBytes, "maxBodyBytes", 167772160, 1024, 268435456),
		upstreamTimeoutMs: integer(value.upstreamTimeoutMs, "upstreamTimeoutMs", 3e4, 1e3, 3e5),
		upstreamApiTimeoutMs: integer(value.upstreamApiTimeoutMs, "upstreamApiTimeoutMs", 0, 0, 2147483647),
		rateLimitWindowMs: integer(value.rateLimitWindowMs, "rateLimitWindowMs", 6e4, 1e3, 36e5),
		maxPairingAttempts: integer(value.maxPairingAttempts, "maxPairingAttempts", 8, 1, 100),
		maxRateLimitKeys: integer(value.maxRateLimitKeys, "maxRateLimitKeys", 256, 1, 4096)
	});
}
//#endregion
//#region src/exec-file.ts
/** Capture both output streams even when a desktop host wraps execFile without Node's promisify metadata. */
function execFileText(file, args, options = {}) {
	return new Promise((resolve, reject) => {
		execFile(file, [...args], {
			windowsHide: true,
			...options,
			encoding: "utf8"
		}, (error, stdout, stderr) => {
			if (error !== null) {
				reject(error);
				return;
			}
			if (typeof stdout !== "string" || typeof stderr !== "string") {
				reject(/* @__PURE__ */ new Error("subprocess returned invalid text output"));
				return;
			}
			resolve({
				stdout,
				stderr
			});
		});
	});
}
//#endregion
//#region src/private-file.ts
let userSidTask;
function windowsSystemTool(name) {
	const systemRoot = process.env.SystemRoot ?? process.env.WINDIR;
	if (systemRoot === void 0 || !win32.isAbsolute(systemRoot)) throw new Error("Windows system root is unavailable");
	return win32.join(systemRoot, "System32", name);
}
async function currentWindowsUserSid() {
	userSidTask ??= execFileText(windowsSystemTool("whoami.exe"), [
		"/user",
		"/fo",
		"csv",
		"/nh"
	], {
		encoding: "utf8",
		windowsHide: true,
		timeout: 1e4
	}).then(({ stdout }) => {
		const match = /,"(S-\d(?:-\d+)+)"\s*$/u.exec(stdout.trim());
		if (match?.[1] === void 0) throw new Error("unable to resolve the current Windows user SID");
		return match[1];
	}).catch((error) => {
		userSidTask = void 0;
		throw error;
	});
	return userSidTask;
}
/** Restrict a sensitive regular file to the current user and Windows administrators. */
async function restrictPrivateFile(file, mode = 384) {
	await chmod(file, mode);
	if (process.platform !== "win32") return;
	const userSid = await currentWindowsUserSid();
	await execFileText(windowsSystemTool("icacls.exe"), [
		file,
		"/inheritance:r",
		"/grant:r",
		`*${userSid}:(F)`,
		"*S-1-5-18:(F)",
		"*S-1-5-32-544:(F)",
		"/remove:g",
		"*S-1-1-0",
		"*S-1-5-11",
		"*S-1-5-32-545"
	], {
		encoding: "utf8",
		windowsHide: true,
		timeout: 1e4
	});
}
//#endregion
//#region src/client-module-preferences.ts
const MAX_RECORD_BYTES = 1048576;
/** Validate untrusted JSON selections; graph membership is checked by the Gateway. */
function parseExcludedClientModules(value) {
	if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || id.length === 0 || id.trim() !== id || /[\u0000-\u001f\u007f]/u.test(id))) throw new Error("excluded_client_modules_invalid");
	const ids = value;
	if (new Set(ids).size !== ids.length) throw new Error("excluded_client_modules_invalid");
	return Object.freeze([...ids]);
}
function deviceKey(deviceId) {
	if (!/^[a-f\d]{32}$/u.test(deviceId)) throw new Error("client_module_device_invalid");
}
function parseRecord(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("client_module_preferences_invalid");
	const record = value;
	if (record.version !== 1 || record.devices === null || typeof record.devices !== "object" || Array.isArray(record.devices) || Object.keys(record).some((key) => ![
		"version",
		"computer",
		"devices"
	].includes(key))) throw new Error("client_module_preferences_invalid");
	const devices = {};
	for (const [id, excluded] of Object.entries(record.devices)) {
		deviceKey(id);
		devices[id] = parseExcludedClientModules(excluded);
	}
	return Object.freeze({
		version: 1,
		devices: Object.freeze(devices),
		...record.computer === void 0 ? {} : { computer: parseExcludedClientModules(record.computer) }
	});
}
/** Atomic, serialized preferences shared by the LAN and remote Gateway instances. */
var ClientModulePreferenceStore = class {
	file;
	defaults;
	value = Object.freeze({
		version: 1,
		devices: Object.freeze({})
	});
	initialization;
	queue = Promise.resolve();
	constructor(file, defaults) {
		this.file = file;
		if (!isAbsolute(file)) throw new Error("client module preference path must be absolute");
		this.defaults = parseExcludedClientModules(defaults);
	}
	/** Read existing state once. Missing state is not written during initialization. */
	initialize() {
		this.initialization ??= this.load();
		return this.initialization;
	}
	async load() {
		let information;
		try {
			information = await lstat(this.file);
		} catch (error) {
			if (error.code === "ENOENT") return;
			throw error;
		}
		if (!information.isFile() || information.isSymbolicLink() || information.size > MAX_RECORD_BYTES) throw new Error("client module preferences must be a regular file no larger than 1 MiB");
		this.value = parseRecord(JSON.parse(await readFile(this.file, "utf8")));
	}
	selection(deviceId) {
		if (deviceId !== void 0) deviceKey(deviceId);
		const computer = this.value.computer ?? this.defaults;
		const device = deviceId === void 0 ? void 0 : this.value.devices[deviceId];
		return Object.freeze({
			excludedClientModules: device ?? computer,
			defaultExcludedClientModules: computer,
			source: device !== void 0 ? "device" : this.value.computer !== void 0 ? "computer" : "plugin"
		});
	}
	exclusive(action) {
		const operation = this.queue.then(action);
		this.queue = operation.then(() => void 0, () => void 0);
		return operation;
	}
	/** Resolve one device override, otherwise the computer or plugin default. */
	async read(deviceId) {
		await this.initialize();
		return this.exclusive(async () => this.selection(deviceId));
	}
	/** Revalidate against the current boot manifest inside the serialized mutation. */
	async configure(excluded, deviceId, validate) {
		const ids = parseExcludedClientModules(excluded);
		if (deviceId !== void 0) deviceKey(deviceId);
		await this.initialize();
		return this.exclusive(async () => {
			await validate(ids);
			const next = deviceId === void 0 ? {
				...this.value,
				computer: ids
			} : {
				...this.value,
				devices: {
					...this.value.devices,
					[deviceId]: ids
				}
			};
			await this.save(next);
			return this.selection(deviceId);
		});
	}
	/** Remove only the selected override; retain all other device selections. */
	async reset(deviceId, validate) {
		if (deviceId !== void 0) deviceKey(deviceId);
		await this.initialize();
		return this.exclusive(async () => {
			const devices = { ...this.value.devices };
			if (deviceId !== void 0) delete devices[deviceId];
			const next = {
				version: 1,
				devices,
				...deviceId === void 0 || this.value.computer === void 0 ? {} : { computer: this.value.computer }
			};
			await validate(deviceId === void 0 ? this.defaults : this.value.computer ?? this.defaults);
			await this.save(next);
			return this.selection(deviceId);
		});
	}
	/** Remove exactly the revoked device's record without evaluating its obsolete graph. */
	removeDevice(deviceId) {
		return this.removeDevices([deviceId]);
	}
	/** Remove an explicit set of revoked identities, not every record in the shared store. */
	async removeDevices(deviceIds) {
		for (const deviceId of deviceIds) deviceKey(deviceId);
		await this.initialize();
		await this.exclusive(async () => {
			if (!deviceIds.some((id) => this.value.devices[id] !== void 0)) return;
			const devices = { ...this.value.devices };
			for (const deviceId of deviceIds) delete devices[deviceId];
			await this.save({
				...this.value,
				devices
			});
		});
	}
	async save(record) {
		const valid = parseRecord(record);
		const body = `${JSON.stringify(valid)}\n`;
		if (Buffer.byteLength(body) > MAX_RECORD_BYTES) throw new Error("client_module_preferences_limit");
		const directory = dirname(this.file);
		if (await mkdir(directory, {
			recursive: true,
			mode: 448
		}) !== void 0) await restrictPrivateFile(directory, 448);
		try {
			const existing = await lstat(this.file);
			if (!existing.isFile() || existing.isSymbolicLink()) throw new Error("client module preference target must be a regular file");
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
		const temporary = join(directory, `.${basename(this.file)}.${randomBytes(12).toString("hex")}.tmp`);
		try {
			await writeFile(temporary, body, {
				encoding: "utf8",
				flag: "wx",
				mode: 384
			});
			await restrictPrivateFile(temporary);
			await rename(temporary, this.file);
			this.value = valid;
		} catch (error) {
			try {
				await rm(temporary, { force: true });
			} catch (cleanupError) {
				throw new AggregateError([error, cleanupError], "client module preference write and temporary cleanup failed");
			}
			throw error;
		}
	}
};
//#endregion
//#region src/control.ts
/** Keeps one runtime aligned with a changing network selection. */
var FollowingMobileAccessRuntime = class {
	select;
	onRefreshError;
	runtime;
	key;
	queue = Promise.resolve();
	closed = false;
	timer;
	constructor(select, onRefreshError) {
		this.select = select;
		this.onRefreshError = onRefreshError;
	}
	/** Start the current selection and optionally poll for later changes. */
	async initialize(refreshIntervalMs) {
		await this.refresh();
		if (refreshIntervalMs === void 0) return;
		this.beginPolling(refreshIntervalMs);
	}
	/**
	* Arm the refresh poller without requiring an initial selection.
	* Boot-degraded path: the first selection already failed (e.g. the saved
	* LAN is down), but later refreshes must still get their chance so a
	* returning network recovers without a restart. Failures keep flowing to
	* onRefreshError; close() stays the single teardown.
	*/
	beginPolling(refreshIntervalMs) {
		if (this.timer !== void 0) return;
		this.timer = setInterval(() => {
			this.refresh().catch(this.onRefreshError);
		}, refreshIntervalMs);
		this.timer.unref();
	}
	/** Reconcile the active runtime with the latest selection. */
	refresh() {
		return this.enqueue(async () => {
			if (this.closed) return;
			const selection = await this.select();
			if (this.closed || this.runtime !== void 0 && this.key === selection.key) return;
			const previous = this.runtime;
			this.runtime = void 0;
			this.key = void 0;
			if (previous !== void 0) await previous.close();
			this.runtime = await selection.start();
			this.key = selection.key;
		});
	}
	/** Stop polling and close the most recently selected runtime. */
	close() {
		if (this.closed) return this.queue;
		this.closed = true;
		if (this.timer !== void 0) clearInterval(this.timer);
		return this.enqueue(async () => {
			const runtime = this.runtime;
			this.runtime = void 0;
			this.key = void 0;
			if (runtime !== void 0) await runtime.close();
		});
	}
	enqueue(operation) {
		const run = this.queue.then(operation, operation);
		this.queue = run.then(() => {}, () => {});
		return run;
	}
};
/** Validate control state loaded across the filesystem boundary. */
function parseMobileAccessControlState(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("mobile-access control state must be an object");
	const record = value;
	if (record.version !== 1 || typeof record.enabled !== "boolean" || Reflect.ownKeys(record).some((key) => key !== "version" && key !== "enabled")) throw new Error("mobile-access control state has an unsupported format");
	return Object.freeze({
		version: 1,
		enabled: record.enabled
	});
}
/** Atomic JSON store whose absent-file state comes from the installation-time default. */
var JsonMobileAccessControlStore = class {
	file;
	initiallyEnabled;
	constructor(file, initiallyEnabled) {
		this.file = file;
		this.initiallyEnabled = initiallyEnabled;
	}
	/** Avoid writing an absent already-disabled state without changing recovery of existing files. */
	async disableIfPresent() {
		try {
			await lstat(this.file);
		} catch (error) {
			if (error.code === "ENOENT") {
				if (this.initiallyEnabled) await this.save({
					version: 1,
					enabled: false
				});
				return;
			}
			throw error;
		}
		await this.save({
			version: 1,
			enabled: false
		});
	}
	async load() {
		let stat;
		try {
			stat = await lstat(this.file);
		} catch (error) {
			if (error.code === "ENOENT") return Object.freeze({
				version: 1,
				enabled: this.initiallyEnabled
			});
			throw error;
		}
		if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw new Error("mobile-access control state must be a regular file no larger than 4 KiB");
		await restrictPrivateFile(this.file);
		let parsed;
		try {
			parsed = JSON.parse(await readFile(this.file, "utf8"));
		} catch (error) {
			throw new Error("mobile-access control state is not valid JSON", { cause: error });
		}
		return parseMobileAccessControlState(parsed);
	}
	async save(state) {
		const validated = parseMobileAccessControlState(state);
		const directory = dirname(this.file);
		await mkdir(directory, {
			recursive: true,
			mode: 448
		});
		try {
			const current = await lstat(this.file);
			if (!current.isFile() || current.isSymbolicLink()) throw new Error("mobile-access control state target must remain a regular file");
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
		const temporary = join(directory, `.${basename(this.file)}.${randomBytes(12).toString("hex")}.tmp`);
		try {
			await writeFile(temporary, `${JSON.stringify(validated)}\n`, {
				encoding: "utf8",
				flag: "wx",
				mode: 384
			});
			await rename(temporary, this.file);
			await restrictPrivateFile(this.file);
		} catch (error) {
			try {
				await rm(temporary, { force: true });
			} catch (cleanupError) {
				throw new AggregateError([error, cleanupError], "control state write and temporary cleanup both failed");
			}
			throw error;
		}
	}
};
/** Serialized persistent lifecycle for the gateway behind the always-loaded Cordis entry. */
var MobileAccessGatewayController = class {
	store;
	startRuntime;
	runtime;
	initialized = false;
	closing = false;
	queue = Promise.resolve();
	closeTask;
	constructor(store, startRuntime) {
		this.store = store;
		this.startRuntime = startRuntime;
	}
	/** Load the durable preference and start the first runtime when enabled. */
	initialize() {
		return this.enqueue(async () => {
			if (this.initialized) throw new Error("mobile-access control is already initialized");
			if (this.closing) throw new Error("mobile-access control is closing");
			if ((await this.store.load()).enabled) this.runtime = await this.startRuntime();
			this.initialized = true;
		});
	}
	/** Return the committed in-process runtime state. */
	isRunning() {
		return this.runtime !== void 0;
	}
	/** Start or stop the runtime and persist only a successfully committed transition. */
	setRunning(running) {
		if (this.closing) return Promise.reject(/* @__PURE__ */ new Error("mobile-access control is closing"));
		return this.enqueue(async () => {
			if (!this.initialized) throw new Error("mobile-access control is not initialized");
			if (this.isRunning() === running) return;
			if (running) await this.enable();
			else await this.disable();
		});
	}
	/** Stop the runtime after earlier transitions without changing the restart preference. */
	close() {
		if (this.closeTask !== void 0) return this.closeTask;
		this.closing = true;
		this.closeTask = this.enqueue(async () => {
			const runtime = this.runtime;
			if (runtime === void 0) return;
			await runtime.close();
			this.runtime = void 0;
		});
		return this.closeTask;
	}
	async enable() {
		const candidate = await this.startRuntime();
		try {
			await this.store.save({
				version: 1,
				enabled: true
			});
		} catch (error) {
			try {
				await candidate.close();
			} catch (rollbackError) {
				throw new AggregateError([error, rollbackError], "enabling mobile access failed and runtime rollback also failed");
			}
			throw error;
		}
		this.runtime = candidate;
	}
	async disable() {
		const previous = this.runtime;
		if (previous === void 0) return;
		await previous.close();
		try {
			await this.store.save({
				version: 1,
				enabled: false
			});
		} catch (error) {
			try {
				this.runtime = await this.startRuntime();
			} catch (rollbackError) {
				this.runtime = void 0;
				throw new AggregateError([error, rollbackError], "disabling mobile access failed and runtime rollback also failed");
			}
			throw error;
		}
		this.runtime = void 0;
	}
	enqueue(operation) {
		const run = this.queue.then(operation, operation);
		this.queue = run.then(() => {}, () => {});
		return run;
	}
};
//#endregion
//#region src/client-module-recovery.ts
const CLIENT_MODULE_RECOVERY_COPY = {
	zh: {
		title: "移动页面模块需要调整",
		explanation: "电脑上的插件或依赖关系已变化，之前保存的模块选择无法加载当前页面。",
		scope: "可为本设备加载全部模块并重新打开 DSH。不会修改电脑默认设置、其他设备或已安装的插件。",
		action: "为本设备加载全部模块并重试",
		working: "正在更新本设备的模块选择…",
		failed: "未能恢复。请确认电脑和远程通道仍在线，然后重试。"
	},
	en: {
		title: "Mobile page modules need attention",
		explanation: "The computer’s plugins or dependencies have changed. The saved module selection can no longer load this page.",
		scope: "Load all modules for this device and reopen DSH. Computer defaults, other devices, and installed plugins are unchanged.",
		action: "Load all modules for this device and retry",
		working: "Updating this device’s module selection…",
		failed: "Could not restore the page. Check that the computer and remote connection are online, then retry."
	},
	it: {
		title: "I moduli della pagina mobile richiedono attenzione",
		explanation: "I plugin o le dipendenze del computer sono cambiati. La selezione salvata non può più caricare questa pagina.",
		scope: "Carica tutti i moduli per questo dispositivo e riapri DSH. I predefiniti del computer, gli altri dispositivi e i plugin installati non cambiano.",
		action: "Carica tutti i moduli per questo dispositivo e riprova",
		working: "Aggiornamento dei moduli per questo dispositivo…",
		failed: "Ripristino non riuscito. Verifica che il computer e la connessione remota siano online, poi riprova."
	}
};
/** Render an explicit device-only recovery action without interpolating graph diagnostics or credentials.
* @param locale - Negotiated browser display language.
* @returns An owned HTML page which changes no selection until the user activates its button.
*/
function renderClientModuleRecoveryPage(locale) {
	const copy = CLIENT_MODULE_RECOVERY_COPY[locale];
	return `<!doctype html>
<html lang="${locale === "zh" ? "zh-CN" : locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark"><title>${copy.title}</title>
<style>
body{margin:0;background:Canvas;color:CanvasText;font:16px/1.5 system-ui,sans-serif}
main{box-sizing:border-box;max-width:640px;margin:32px auto;padding:24px max(24px,env(safe-area-inset-left)) 24px max(24px,env(safe-area-inset-right));overflow-wrap:anywhere}
h1{font-size:24px;line-height:1.3}button{min-height:48px;max-width:100%;padding:12px 20px;border:1px solid ButtonText;border-radius:12px;background:ButtonFace;color:ButtonText;font:inherit;cursor:pointer}
button:focus-visible{outline:2px solid Highlight;outline-offset:3px}button:disabled{opacity:.6;cursor:wait}#recovery-status{min-height:1.5em}
</style></head>
<body><main><h1>${copy.title}</h1><p>${copy.explanation}</p><p>${copy.scope}</p>
<button id="load-all-modules" type="button">${copy.action}</button><p id="recovery-status" role="status" aria-live="polite"></p>
</main><script>${renderClientModuleRecoveryScript(locale)}<\/script></body></html>
`;
}
/** Render the fixed same-origin action; CSRF values are read from the active browser cookie only at user activation.
* @param locale - Negotiated browser display language.
* @returns JavaScript that preserves selections on failure and reloads only after an authorized save succeeds.
*/
function renderClientModuleRecoveryScript(locale) {
	const copy = CLIENT_MODULE_RECOVERY_COPY[locale];
	return `(() => {
  const button = document.getElementById('load-all-modules')
  const status = document.getElementById('recovery-status')
  button.addEventListener('click', async () => {
    if (button.disabled) return
    button.disabled = true
    status.textContent = ${JSON.stringify(copy.working)}
    try {
      const values = document.cookie.split(';').map(value => value.trim())
      const host = values.filter(value => value.startsWith('__Host-dsh_ma_csrf='))
      const candidates = host.length === 0 ? values.filter(value => value.startsWith('dsh_ma_csrf=')) : host
      if (candidates.length !== 1) throw new Error('csrf_unavailable')
      const csrf = candidates[0].slice(candidates[0].indexOf('=') + 1)
      const response = await fetch('/mobile-access/client-modules', {
        method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
        headers: { 'content-type': 'application/json', 'x-dsh-mobile-csrf': csrf },
        body: JSON.stringify({ excludedClientModules: [] }),
      })
      if (!response.ok) throw new Error('recovery_failed')
      location.reload()
    } catch {
      status.textContent = ${JSON.stringify(copy.failed)}
      button.disabled = false
    }
  })
})()`;
}
function unwrapBrackets(hostname) {
	return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}
function parseIpv4(hostname) {
	const parts = hostname.split(".");
	if (parts.length !== 4) return void 0;
	const octets = [];
	for (const part of parts) {
		if (!/^(?:0|[1-9]\d{0,2})$/u.test(part)) return void 0;
		const value = Number(part);
		if (value > 255) return void 0;
		octets.push(value);
	}
	return octets;
}
function isLoopbackIpv4(octets) {
	return octets[0] === 127;
}
function isPrivateIpv4(octets) {
	return octets[0] === 10 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 || octets[0] === 192 && octets[1] === 168;
}
function isLinkLocalIpv4(octets) {
	return octets[0] === 169 && octets[1] === 254;
}
/**
* Hostnames that may appear on the DSH desktop admin surface.
* Loopback, RFC1918, and IPv4 link-local are accepted. Public IPs,
* CGNAT, and arbitrary DNS names stay rejected so DNS rebinding
* cannot reach `/api/mobile-access`.
*/
function isLocalAdminHostname(hostname) {
	const host = unwrapBrackets(hostname).trim().toLowerCase();
	if (host === "localhost" || host === "::1") return true;
	const octets = parseIpv4(host);
	if (octets === void 0) return false;
	return isLoopbackIpv4(octets) || isPrivateIpv4(octets) || isLinkLocalIpv4(octets);
}
//#endregion
//#region src/http-security.ts
const DEVICE_COOKIE = "dsh_ma_device";
const SESSION_COOKIE = "dsh_ma_session";
const CSRF_COOKIE = "dsh_ma_csrf";
const CSRF_HEADER = "x-dsh-mobile-csrf";
const LOCAL_ADMIN_PREFIX = "/api/mobile-access";
const AUTH_PREFIX = "/mobile-access";
const WS_PATHS = /* @__PURE__ */ new Set([
	"/api/events.mux",
	"/api/events.host",
	"/api/remote.mux",
	"/sidebar/ws/terminal"
]);
/** Terse request failure safe to expose without internal diagnostics. */
var HttpError = class extends Error {
	status;
	code;
	constructor(status, code) {
		super(code);
		this.status = status;
		this.code = code;
		this.name = "HttpError";
	}
};
/** Parse only origin-form request targets and reject ambiguous slash encodings. */
function parseRequestTarget(raw) {
	if (raw === void 0 || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f\u007f]/u.test(raw)) throw new HttpError(400, "bad_request");
	let parsed;
	let decodedPathname;
	try {
		parsed = new URL(raw, "http://gateway.invalid");
		decodedPathname = decodeURIComponent(parsed.pathname);
	} catch {
		throw new HttpError(400, "bad_request");
	}
	if (decodedPathname.includes("\\") || decodedPathname.startsWith("//") || /[\u0000-\u001f\u007f]/u.test(decodedPathname)) throw new HttpError(400, "bad_request");
	return Object.freeze({
		raw,
		pathname: parsed.pathname,
		decodedPathname,
		search: parsed.search
	});
}
/**
* The frame sources a proxied GUI document may embed: its own routes, blob:
* (the PDF viewer's object URL) and external http(s) pages (the sidebar
* browser tab). The framed document runs in the tab's existing sandbox
* (opaque origin, no same-origin privileges), so this does not hand the
* embedded page anything it did not already have.
*/
const PROXIED_FRAME_SRC = "frame-src 'self' blob: https: http:";
/**
* Set the gateway browser protections and non-cacheability.
* @param response - the response to decorate.
* @param tls - whether the connection is TLS (adds HSTS).
* @param framing - the framing policy; defaults to the strict gateway one, so
*   every existing call site keeps refusing to be framed. Only the two PROXIED
*   forwarders pass `'proxied'`.
*/
function setSecurityHeaders(response, tls, framing = "gateway") {
	const proxied = framing === "proxied";
	response.setHeader("Cache-Control", "no-store");
	response.setHeader("Content-Security-Policy", [
		"default-src 'self'",
		"base-uri 'none'",
		"object-src 'none'",
		proxied ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
		"form-action 'self'",
		"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob:",
		"font-src 'self' data:",
		"connect-src 'self'",
		"worker-src 'self' blob:",
		...proxied ? [PROXIED_FRAME_SRC] : []
	].join("; "));
	const microphone = proxied ? "microphone=(self)" : "microphone=()";
	response.setHeader("Permissions-Policy", `camera=(), ${microphone}, geolocation=(), payment=(), usb=()`);
	response.setHeader("Referrer-Policy", "no-referrer");
	response.setHeader("X-Content-Type-Options", "nosniff");
	response.setHeader("X-Frame-Options", proxied ? "SAMEORIGIN" : "DENY");
	response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
	if (tls) response.setHeader("Strict-Transport-Security", "max-age=31536000");
}
/** Send a bounded JSON response without reflecting request or upstream data. */
function sendJson(response, status, value, tls) {
	if (response.headersSent || response.destroyed) return;
	setSecurityHeaders(response, tls);
	const body = `${JSON.stringify(value)}\n`;
	response.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": Buffer.byteLength(body)
	});
	response.end(body);
}
/** Send a generic failure containing only a stable category. */
function sendFailure(response, status, code, tls) {
	sendJson(response, status, { error: code }, tls);
}
/** Read and parse one bounded JSON object. */
async function readJsonObject(request, maximumBytes) {
	if (request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") throw new HttpError(415, "unsupported_media_type");
	const declared = request.headers["content-length"];
	if (declared !== void 0) {
		if (!/^\d+$/u.test(declared) || Number(declared) > maximumBytes) throw new HttpError(413, "payload_too_large");
	}
	const chunks = [];
	let total = 0;
	for await (const chunk of request) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		total += buffer.length;
		if (total > maximumBytes) throw new HttpError(413, "payload_too_large");
		chunks.push(buffer);
	}
	let parsed;
	try {
		parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch {
		throw new HttpError(400, "bad_request");
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new HttpError(400, "bad_request");
	return parsed;
}
/** Serialize a host-only Cookie with no Domain attribute. */
function cookie(name, value, options) {
	const parts = [
		`${name}=${value}`,
		`Path=${options.path}`,
		`Max-Age=${String(Math.max(0, Math.floor(options.maxAgeSeconds)))}`,
		"SameSite=Strict",
		"Priority=High"
	];
	if (options.tls) parts.push("Secure");
	if (options.httpOnly) parts.push("HttpOnly");
	return parts.join("; ");
}
/** Enforce direct CIDR, exact Host, and browser same-origin facts. */
function assertExternalTrust(request, policy, requireOrigin) {
	if (!addressAllowed(request.socket.remoteAddress, policy.cidrs) || !policy.acceptsHost(request.headers.host)) throw new HttpError(403, "forbidden");
	const origin = request.headers.origin;
	if (origin !== void 0 && !policy.acceptsOrigin(origin)) throw new HttpError(403, "forbidden");
	const site = request.headers["sec-fetch-site"];
	if (site !== void 0 && site !== "same-origin" && site !== "same-site" && site !== "cross-site" && site !== "none") throw new HttpError(403, "forbidden");
	if (requireOrigin && !policy.acceptsOrigin(origin)) throw new HttpError(403, "forbidden");
}
function localAuthority(header) {
	if (header === void 0 || /[/?#@\\]/u.test(header)) return void 0;
	try {
		const url = new URL(`http://${header}`);
		if (url.pathname !== "/" || url.username !== "" || url.password !== "") return void 0;
		return {
			hostname: url.hostname,
			authority: url.host.toLowerCase()
		};
	} catch {
		return;
	}
}
/** Protect the inner management route from non-loopback and DNS-rebinding callers. */
function assertLocalAdminTrust(request, requireBrowserOrigin, authenticateDesktop = () => false) {
	if (request.socket.remoteAddress === void 0 || !isLoopbackAddress(request.socket.remoteAddress)) throw new HttpError(403, "forbidden");
	const host = localAuthority(request.headers.host);
	if (host === void 0 || !isLocalAdminHostname(host.hostname)) throw new HttpError(403, "forbidden");
	const site = request.headers["sec-fetch-site"];
	if (site !== void 0 && site !== "same-origin" && site !== "none") throw new HttpError(403, "forbidden");
	const origin = request.headers.origin;
	if (origin !== void 0) try {
		const parsed = new URL(origin);
		if (parsed.host.toLowerCase() !== host.authority || parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new HttpError(403, "forbidden");
	} catch (error) {
		if (error instanceof HttpError) throw error;
		throw new HttpError(403, "forbidden");
	}
	const desktopForward = site === void 0 && request.headers["x-dsh-mobile-desktop-admin"] === "dsh-app://app";
	if (requireBrowserOrigin && origin === void 0 && !(desktopForward && authenticateDesktop())) throw new HttpError(403, "forbidden");
	if (requireBrowserOrigin && site !== void 0 && site !== "same-origin") throw new HttpError(403, "forbidden");
}
//#endregion
//#region src/mobile-compat-bootstrap.ts
const MOBILE_COMPAT_PATH = `${AUTH_PREFIX}/compat.js`;
/**
* Read one attribute out of a tag body.
*
* A plain `/\snonce\s*=/` search can be fooled by a value that merely contains the
* text, and cannot tell a double-quoted attribute from a single-quoted one. Walking
* `name=value` pairs consumes each quoted value whole, so the attribute that is
* actually present is the one returned.
*/
function attributeValue(tag, name) {
	for (const match of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*')/gu)) {
		const attribute = match[1];
		const raw = match[2];
		if (attribute === void 0 || raw === void 0) continue;
		if (attribute.toLowerCase() === name) return raw.slice(1, -1);
	}
}
/** Character ranges covered by an HTML comment, where markup is inert text. */
function commentRanges(html) {
	return [...html.matchAll(/<!--[\s\S]*?-->/gu)].map((match) => [match.index, match.index + match[0].length]);
}
/**
* Load the compatibility bundle synchronously, before the first DSH script.
*
* Returns the HTML unchanged when there is no executable script to anchor to.
* The bundle supplies missing browser APIs before the page's scripts execute.
*/
function ensureMobileCompatibility(html) {
	const comments = commentRanges(html);
	const isInert = (at) => comments.some(([start, end]) => at >= start && at < end);
	const scripts = [...html.matchAll(/<script\b[^>]*>/giu)].filter((match) => !isInert(match.index));
	if (scripts.length === 0) return html;
	if (scripts.some((match) => attributeValue(match[0], "src") === MOBILE_COMPAT_PATH)) return html;
	const first = scripts[0];
	if (first === void 0) return html;
	const nonce = attributeValue(first[0], "nonce")?.replace(/["'<>\s]/gu, "") ?? "";
	const attribute = nonce === "" ? "" : ` nonce="${nonce}"`;
	const script = `<script src="${MOBILE_COMPAT_PATH}"${attribute}><\/script>`;
	return `${html.slice(0, first.index)}${script}${html.slice(first.index)}`;
}
//#endregion
//#region src/browser-auth-cookies.ts
const HOST_SESSION_COOKIE = "__Host-dsh_ma_session";
const HOST_CSRF_COOKIE = "__Host-dsh_ma_csrf";
/** Non-secret browser identity; the persistent device credential keeps its narrow renewal path. */
const HOST_DEVICE_COOKIE = "__Host-dsh_ma_device_id";
const AUTH_COOKIE_NAMES = /* @__PURE__ */ new Set([
	SESSION_COOKIE,
	DEVICE_COOKIE,
	CSRF_COOKIE,
	HOST_SESSION_COOKIE,
	HOST_CSRF_COOKIE,
	HOST_DEVICE_COOKIE
]);
/** Read only gateway authentication cookies, retaining distinct values from different scopes. */
function browserAuthCookies(header) {
	if (header === void 0) return /* @__PURE__ */ new Map();
	if (header.length > 8192) throw new HttpError(401, "authentication_failed");
	const cookies = /* @__PURE__ */ new Map();
	for (const part of header.split(";")) {
		const equals = part.indexOf("=");
		if (equals <= 0) continue;
		const name = part.slice(0, equals).trim();
		if (!AUTH_COOKIE_NAMES.has(name)) continue;
		const values = cookies.get(name) ?? [];
		cookies.set(name, values);
		const value = part.slice(equals + 1).trim();
		if (!/^[\w\-.~+/=]{1,512}$/u.test(value) || values.includes(value)) continue;
		values.push(value);
	}
	return cookies;
}
/** Select exactly one authenticated value; never let cookie order choose between valid identities. */
function authenticatedCookie(values, authenticate, accepts = () => true) {
	let selected;
	for (const value of values) {
		let result;
		try {
			result = authenticate(value);
		} catch (error) {
			if (error instanceof AccessError && error.status === 401) continue;
			throw error;
		}
		if (!accepts(result)) continue;
		if (selected !== void 0) throw new HttpError(401, "authentication_failed");
		selected = {
			value,
			result
		};
	}
	if (selected === void 0) throw new HttpError(401, "authentication_failed");
	return selected;
}
//#endregion
//#region src/websocket-compression.ts
function payloadBytes(data) {
	if (Array.isArray(data)) return data.reduce((bytes, part) => bytes + part.byteLength, 0);
	return data.byteLength;
}
function forwardableClose(code) {
	return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
}
/**
* Bridge an authorized HTTP upgrade, negotiating compression only with the client.
* Errors after acceptance close both legs. Socket destruction by the gateway also
* releases the ws wrappers, pending compression, and handshake/close timers.
* @param request - validated browser upgrade request.
* @param client - gateway-owned client socket, paused during authorization.
* @param upstream - gateway-owned loopback socket, connecting or connected.
* @param head - bytes the HTTP parser read after the client's upgrade headers.
* @param target - validated upstream URL, including the original query.
* @param upstreamCookie - gateway's signed upstream cookie; browser cookies are discarded.
* @param options - resolved message, queue, and compression limits.
* @param handshakeTimeoutMs - maximum handshake and close-handshake duration.
* @returns fulfillment after both HTTP upgrades are accepted, or rejection before acceptance.
*/
function bridgeCompressedWebSocket(request, client, upstream, head, target, upstreamCookie, options, handshakeTimeoutMs) {
	return new Promise((resolve, reject) => {
		let incoming;
		let outgoing;
		let server;
		let accepted = false;
		let stopped = false;
		let closing = false;
		let closeTimer;
		const handshakeTimer = setTimeout(() => {
			stop(/* @__PURE__ */ new Error("WebSocket bridge handshake timed out"));
		}, handshakeTimeoutMs);
		handshakeTimer.unref();
		const stop = (error) => {
			if (stopped) return;
			stopped = true;
			clearTimeout(handshakeTimer);
			clearTimeout(closeTimer);
			if (!accepted) reject(error);
			incoming?.terminate();
			outgoing?.terminate();
			client.destroy();
			upstream.destroy();
			server?.close();
		};
		const finish = () => {
			if (incoming?.readyState === WebSocket.CLOSED && outgoing?.readyState === WebSocket.CLOSED) stop(/* @__PURE__ */ new Error("WebSocket bridge closed"));
		};
		const beginClose = (code, reason) => {
			if (!accepted) {
				stop(new Error(reason));
				return;
			}
			if (stopped || closing) return;
			closing = true;
			incoming?.resume();
			outgoing?.resume();
			for (const socket of [incoming, outgoing]) if (socket?.readyState === WebSocket.OPEN) socket.close(code, reason);
			closeTimer = setTimeout(() => {
				stop(/* @__PURE__ */ new Error("WebSocket bridge close timed out"));
			}, handshakeTimeoutMs);
			closeTimer.unref();
		};
		const socketError = (error) => {
			stop(error);
		};
		const socketClosed = () => {
			if (!accepted) stop(/* @__PURE__ */ new Error("WebSocket socket closed before acceptance"));
		};
		client.on("error", socketError);
		upstream.on("error", socketError);
		client.once("close", socketClosed);
		upstream.once("close", socketClosed);
		const wsError = (error) => {
			if (!accepted) {
				stop(error);
				return;
			}
			beginClose(error.code === "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH" ? 1009 : 1011, error.code === "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH" ? "Message too large" : "WebSocket bridge failed");
		};
		const attachRelay = (source, destination) => {
			let queuedBytes = 0;
			const send = (bytes, operation) => {
				if (stopped || closing) return;
				if (destination.readyState !== WebSocket.OPEN) {
					beginClose(1011, "WebSocket peer unavailable");
					return;
				}
				const queued = bytes + 14;
				if (queued > options.maxQueuedBytes - queuedBytes) {
					beginClose(1009, "WebSocket queue limit");
					return;
				}
				queuedBytes += queued;
				source.pause();
				const complete = (error) => {
					queuedBytes -= queued;
					if (error != null) {
						wsError(error);
						return;
					}
					if (!stopped && !closing && queuedBytes === 0 && source.readyState === WebSocket.OPEN) source.resume();
				};
				try {
					operation(complete);
				} catch (error) {
					complete(error instanceof Error ? error : /* @__PURE__ */ new Error("WebSocket forwarding failed"));
				}
			};
			source.on("message", (data, binary) => {
				const bytes = payloadBytes(data);
				if (bytes > options.maxMessageBytes) {
					beginClose(1009, "Message too large");
					return;
				}
				send(bytes, (callback) => {
					destination.send(data, {
						binary,
						compress: destination === incoming
					}, callback);
				});
			});
			source.on("ping", (data) => {
				send(data.byteLength, (callback) => {
					destination.ping(data, void 0, callback);
				});
			});
			source.on("pong", (data) => {
				send(data.byteLength, (callback) => {
					destination.pong(data, void 0, callback);
				});
			});
			source.on("close", (code, reason) => {
				if (stopped) return;
				if (code === 1006 || !forwardableClose(code) && code !== 1005) {
					stop(/* @__PURE__ */ new Error("WebSocket peer closed without a valid close frame"));
					return;
				}
				closing = true;
				destination.resume();
				if (destination.readyState === WebSocket.OPEN) {
					if (code === 1005) destination.close();
					else destination.close(code, reason);
				}
				closeTimer ??= setTimeout(() => {
					stop(/* @__PURE__ */ new Error("WebSocket bridge close timed out"));
				}, handshakeTimeoutMs);
				closeTimer.unref();
				finish();
			});
		};
		try {
			if (client.destroyed || upstream.destroyed) throw new Error("WebSocket socket is already closed");
			const protocolHeader = request.headers["sec-websocket-protocol"];
			const protocols = typeof protocolHeader === "string" ? protocolHeader.split(",").map((protocol) => protocol.trim()) : [];
			const url = new URL(target);
			url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
			outgoing = new WebSocket(url, protocols, {
				createConnection: () => upstream,
				handshakeTimeout: handshakeTimeoutMs,
				perMessageDeflate: false,
				autoPong: false,
				followRedirects: false,
				maxPayload: options.maxMessageBytes,
				headers: {
					host: target.host,
					origin: target.origin,
					"sec-fetch-site": "same-origin",
					...upstreamCookie === void 0 ? {} : { cookie: upstreamCookie }
				}
			});
			outgoing.on("error", wsError);
			outgoing.once("close", () => {
				if (!accepted) stop(/* @__PURE__ */ new Error("Upstream WebSocket closed before acceptance"));
				else finish();
			});
			outgoing.once("open", () => {
				if (stopped || client.destroyed) {
					stop(/* @__PURE__ */ new Error("Client closed before WebSocket acceptance"));
					return;
				}
				upstream.setTimeout(0);
				server = new WebSocketServer({
					noServer: true,
					clientTracking: false,
					autoPong: false,
					maxPayload: options.maxMessageBytes,
					handleProtocols: () => outgoing?.protocol || false,
					perMessageDeflate: {
						clientNoContextTakeover: true,
						serverNoContextTakeover: true,
						threshold: options.thresholdBytes,
						concurrencyLimit: options.concurrencyLimit,
						zlibDeflateOptions: { level: options.level }
					}
				});
				server.on("error", wsError);
				try {
					server.handleUpgrade(request, client, head, (socket) => {
						incoming = socket;
						incoming.on("error", wsError);
						incoming.once("close", finish);
						attachRelay(incoming, outgoing);
						attachRelay(outgoing, incoming);
						accepted = true;
						clearTimeout(handshakeTimer);
						incoming.resume();
						resolve();
					});
				} catch (error) {
					stop(error instanceof Error ? error : /* @__PURE__ */ new Error("Client WebSocket upgrade failed"));
				}
			});
		} catch (error) {
			stop(error instanceof Error ? error : /* @__PURE__ */ new Error("WebSocket bridge setup failed"));
		}
	});
}
//#endregion
//#region src/version.ts
const manifest = createRequire(import.meta.url)("../package.json");
/** Version of the installed DSH Mobile plugin package. */
const DSH_MOBILE_VERSION = typeof manifest.version === "string" ? manifest.version : "unknown";
/** Oldest Android App release supported by this plugin generation. */
const MINIMUM_ANDROID_APP_VERSION = "0.2.2";
//#endregion
//#region src/computer-images.ts
const MAX_ENTRIES = 500;
const MAX_IMAGE_BYTES = 20971520;
const IMAGE_TYPES = Object.freeze({
	".gif": "image/gif",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".png": "image/png",
	".webp": "image/webp"
});
/** Normalize an optional mobile-browser path without rebasing relative input. */
function resolveComputerImagePath(path) {
	if (path === null || path === "") return homedir();
	if (!isAbsolute(path) || path.includes("\0")) throw new HttpError(400, "bad_path");
	return resolve(path);
}
/** List folders and supported image files without following symbolic links. */
async function listComputerImages(path, signal) {
	signal?.throwIfAborted();
	const target = resolveComputerImagePath(path);
	const rows = [];
	let truncated = false;
	let directory;
	try {
		directory = await opendir(target);
		for await (const entry of directory) {
			signal?.throwIfAborted();
			if (entry.isSymbolicLink()) continue;
			const kind = entry.isDirectory() ? "directory" : IMAGE_TYPES[extname(entry.name).toLowerCase()] === void 0 ? void 0 : "image";
			if (kind === void 0) continue;
			if (rows.length === MAX_ENTRIES) {
				truncated = true;
				break;
			}
			rows.push({
				kind,
				name: entry.name,
				path: resolve(target, entry.name)
			});
		}
	} catch (error) {
		if (signal?.aborted) throw signal.reason;
		throw new HttpError(404, "directory_unavailable");
	} finally {
		await directory?.close().catch(() => void 0);
	}
	rows.sort((left, right) => left.kind === right.kind ? left.name.localeCompare(right.name) : left.kind === "directory" ? -1 : 1);
	const parent = dirname(target);
	return Object.freeze({
		path: target,
		...parent === target ? {} : { parent },
		entries: Object.freeze(rows),
		truncated
	});
}
/** Read one bounded regular image file selected by an authenticated device. */
async function readComputerImage(path, signal) {
	signal?.throwIfAborted();
	const target = resolveComputerImagePath(path);
	const contentType = IMAGE_TYPES[extname(target).toLowerCase()];
	if (contentType === void 0) throw new HttpError(415, "unsupported_file_type");
	let info;
	try {
		info = await lstat(target);
	} catch {
		throw new HttpError(404, "file_unavailable");
	}
	if (!info.isFile() || info.isSymbolicLink()) throw new HttpError(404, "file_unavailable");
	if (info.size > MAX_IMAGE_BYTES) throw new HttpError(413, "file_too_large");
	try {
		return {
			body: await readFile(target, { signal }),
			contentType,
			name: basename(target)
		};
	} catch (error) {
		if (signal?.aborted) throw signal.reason;
		throw new HttpError(404, "file_unavailable");
	}
}
//#endregion
//#region src/extension-worker.ts
/** Supervise opt-in local hosts without executing extension code on the DSH thread. */
/** JSON bytes serialized and size-checked inside the worker. */
var PreparedJsonResult = class {
	bytes;
	constructor(bytes) {
		this.bytes = bytes;
	}
};
/** Identify worker results without invoking an extension serializer in the gateway. */
function isPreparedJson(value) {
	return value instanceof PreparedJsonResult;
}
/** Resolve the installed standalone entry adjacent to the plugin bundle. */
function defaultExtensionWorkerModule() {
	return new URL("./extension-worker-runtime.mjs", import.meta.url);
}
/** Every thread counts until actual exit, including activation, retirement and termination. */
var ExtensionWorkerBudget = class {
	maximum;
	count = 0;
	constructor(maximum) {
		this.maximum = maximum;
	}
	get current() {
		return this.count;
	}
	reserve() {
		if (this.count >= this.maximum) throw new MobileExtensionError("extension_worker_limit", "local extension worker limit reached", 503);
		this.count += 1;
		let released = false;
		return () => {
			if (!released) {
				released = true;
				this.count -= 1;
			}
		};
	}
};
/** Diagnostic count; production admission uses an instance-owned budget. */
const activeWorkerCount = { current: 0 };
const LIFECYCLE_ID = "lifecycle";
/** Node accepts quoted NODE_OPTIONS words; inspect option names without exposing their values. */
function nodeOptionWords(value) {
	const words = [];
	let word = "";
	let quoted = false;
	let escaped = false;
	for (const character of value) {
		if (escaped) {
			word += character;
			escaped = false;
			continue;
		}
		if (character === "\\") {
			escaped = true;
			continue;
		}
		if (character === "\"") {
			quoted = !quoted;
			continue;
		}
		if (/\s/u.test(character) && !quoted) {
			if (word !== "") {
				words.push(word);
				word = "";
			}
			continue;
		}
		word += character;
	}
	if (word !== "") words.push(word);
	return words;
}
/** Known parent V8 heap flags take precedence over Worker resourceLimits. */
function parentWorkerHeapOverrides(argv, nodeOptions) {
	const heapFlags = /* @__PURE__ */ new Set([
		"--max-old-space-size",
		"--max-semi-space-size",
		"--max-heap-size",
		"--max-old-space-size-percentage"
	]);
	const found = /* @__PURE__ */ new Set();
	for (const argument of [...argv, ...nodeOptionWords(nodeOptions ?? "")]) {
		const name = argument.split("=", 1)[0].replaceAll("_", "-");
		if (heapFlags.has(name)) found.add(name);
	}
	return Object.freeze([...found]);
}
const initialNodeOptions = process.env.NODE_OPTIONS;
var ExtensionWorkerHost = class {
	options;
	limits;
	worker;
	pending = /* @__PURE__ */ new Map();
	routePending = /* @__PURE__ */ new Map();
	streams = /* @__PURE__ */ new Map();
	detachedRoutes = /* @__PURE__ */ new Set();
	executionGrace = /* @__PURE__ */ new Map();
	exited;
	unavailableController = new AbortController();
	termination;
	activation;
	dead = false;
	disposed = false;
	maxBufferedBytes = 0;
	cancelledStreams = 0;
	logWindowStart = Date.now();
	logCount = 0;
	stdioBytes = 0;
	stdioResume;
	constructor(options) {
		this.options = options;
		this.limits = resolveHostExecution(options.limits);
		const overrides = new Set(parentWorkerHeapOverrides(process.execArgv, initialNodeOptions));
		for (const flag of parentWorkerHeapOverrides([], process.env.NODE_OPTIONS)) overrides.add(flag);
		if (overrides.size > 0) throw new MobileExtensionError("extension_worker_heap_override", `worker heap limits require launching DSH without ${[...overrides].join(", ")}`, 503);
		const release = options.budget?.reserve() ?? (() => void 0);
		try {
			this.worker = new Worker(options.workerModule, {
				workerData: { limits: this.limits },
				stdout: true,
				stderr: true,
				resourceLimits: {
					maxOldGenerationSizeMb: this.limits.maxOldGenerationSizeMb,
					maxYoungGenerationSizeMb: this.limits.maxYoungGenerationSizeMb,
					stackSizeMb: this.limits.stackSizeMb
				}
			});
		} catch (error) {
			release();
			throw error;
		}
		const drainConsole = (chunk) => {
			this.stdioBytes += chunk.byteLength;
			if (this.stdioBytes < this.limits.logMessageBytes * this.limits.logMessagesPerWindow || this.stdioResume !== void 0) return;
			this.worker.stdout?.pause();
			this.worker.stderr?.pause();
			this.stdioResume = setTimeout(() => {
				this.stdioResume = void 0;
				this.stdioBytes = 0;
				if (!this.dead) {
					this.worker.stdout?.resume();
					this.worker.stderr?.resume();
				}
			}, this.limits.logWindowMs);
			this.stdioResume.unref();
		};
		this.worker.stdout?.on("data", drainConsole);
		this.worker.stderr?.on("data", drainConsole);
		this.worker.unref();
		activeWorkerCount.current += 1;
		this.exited = new Promise((resolve) => {
			this.worker.once("exit", () => {
				this.dead = true;
				if (this.stdioResume !== void 0) clearTimeout(this.stdioResume);
				this.markUnavailable();
				release();
				activeWorkerCount.current -= 1;
				for (const timer of this.executionGrace.values()) clearTimeout(timer);
				this.executionGrace.clear();
				const error = this.unavailable();
				for (const entry of this.pending.values()) {
					entry.cleanup();
					entry.reject(error);
				}
				for (const entry of this.routePending.values()) {
					entry.cleanup();
					entry.reject(error);
				}
				this.pending.clear();
				this.routePending.clear();
				this.detachedRoutes.clear();
				for (const live of this.streams.values()) {
					if (live.cancelTimer !== void 0) clearTimeout(live.cancelTimer);
					live.bridge.destroy(error);
				}
				this.streams.clear();
				resolve();
			});
		});
		this.worker.on("message", (raw) => {
			try {
				this.handleMessage(raw);
			} catch (error) {
				this.terminate("invalid-worker-message");
			}
		});
		this.worker.on("error", () => {
			this.terminate("worker-error");
		});
	}
	/** A stopped generation never silently respawns. */
	available() {
		return !this.dead && this.termination === void 0 && !this.disposed && !this.unavailableController.signal.aborted;
	}
	/** Activate once and receive executable-free registration metadata. */
	async activate() {
		let timer;
		try {
			const reply = new Promise((resolve, reject) => {
				this.pending.set(LIFECYCLE_ID, {
					resolve,
					reject,
					cleanup: () => void 0
				});
				this.post({
					kind: "activate",
					id: LIFECYCLE_ID,
					hostFile: this.options.hostFile,
					generation: this.options.generation,
					manifest: this.options.manifest
				});
			});
			await Promise.race([reply, new Promise((_, reject) => {
				timer = setTimeout(() => reject(new MobileExtensionError("host_load_timeout", "extension worker activation timed out", 500)), this.options.activationTimeoutMs ?? this.limits.activationTimeoutMs);
			})]);
			if (this.activation === void 0) throw new MobileExtensionError("host_activation_failed", "extension worker activation failed", 500);
			return this.activation;
		} catch (error) {
			await this.terminate("activation-failed");
			throw error;
		} finally {
			if (timer !== void 0) clearTimeout(timer);
		}
	}
	actionMetadata() {
		return this.activation?.actions ?? [];
	}
	routeMetadata() {
		return this.activation?.routes ?? [];
	}
	/** Underlying action: settles only when execution completes or the thread exits. */
	invokeExecution(action, input, caller) {
		if (!this.available()) return Promise.reject(this.unavailable());
		if (caller.signal.aborted) return Promise.reject(caller.signal.reason);
		const id = randomUUID();
		return new Promise((resolve, reject) => {
			const onAbort = () => {
				this.post({
					kind: "cancel",
					id
				});
				this.armExecutionGrace(id);
			};
			caller.signal.addEventListener("abort", onAbort, { once: true });
			this.pending.set(id, {
				resolve,
				reject,
				cleanup: () => {
					caller.signal.removeEventListener("abort", onAbort);
					this.settleExecutionGrace(id);
				}
			});
			try {
				this.post({
					kind: "invoke",
					id,
					action,
					deviceId: caller.deviceId,
					input
				});
			} catch (error) {
				this.pending.get(id)?.cleanup();
				this.pending.delete(id);
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		});
	}
	/** Direct caller budget; service dispatch observes invokeExecution separately. */
	invoke(action, input, caller) {
		return this.callerBudget((signal) => this.invokeExecution(action, input, {
			...caller,
			signal
		}), caller.signal, this.actionMetadata().find((entry) => entry.name === action)?.timeoutMs ?? this.limits.operationTimeoutMs, "extension_action_timeout");
	}
	/** Underlying route: late streams are cancelled and observed to confirmed end. */
	handleRouteExecution(routeIndex, request) {
		if (!this.available()) return Promise.reject(this.unavailable());
		if (request.signal.aborted) return Promise.reject(request.signal.reason);
		const id = randomUUID();
		return new Promise((resolve, reject) => {
			const onAbort = () => {
				this.post({
					kind: "cancel",
					id
				});
				if (this.routePending.has(id)) {
					this.detachedRoutes.add(id);
					this.armExecutionGrace(id);
				}
				this.cancelStream(id);
			};
			request.signal.addEventListener("abort", onAbort, { once: true });
			this.routePending.set(id, {
				resolve,
				reject,
				cleanup: () => {
					request.signal.removeEventListener("abort", onAbort);
					this.settleExecutionGrace(id);
				}
			});
			try {
				this.post({
					kind: "route",
					id,
					routeIndex,
					method: request.method,
					path: request.pathname,
					query: [...request.query.entries()],
					headers: request.headers,
					body: new Uint8Array(request.body),
					deviceId: request.deviceId
				});
			} catch (error) {
				this.routePending.get(id)?.cleanup();
				this.routePending.delete(id);
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		});
	}
	/** Handler budget ends at stream-start; stream lifetime remains cancellation-bound. */
	handleRoute(routeIndex, request) {
		return this.callerBudget((signal) => this.handleRouteExecution(routeIndex, {
			...request,
			signal
		}), request.signal, this.routeMetadata()[routeIndex]?.timeoutMs ?? this.limits.operationTimeoutMs, "extension_route_timeout", true);
	}
	async callerBudget(start, external, timeoutMs, code, holdForStream = false) {
		const controller = new AbortController();
		let timer;
		let detach;
		const onAbort = () => {
			controller.abort(external.reason);
			detach?.(external.reason ?? new MobileExtensionError("extension_cancelled", "caller cancelled", 409));
		};
		const onUnavailable = () => {
			detach?.(this.unavailableController.signal.reason);
		};
		if (external.aborted) throw external.reason;
		if (!this.available()) throw this.unavailable();
		external.addEventListener("abort", onAbort, { once: true });
		this.unavailableController.signal.addEventListener("abort", onUnavailable, { once: true });
		const release = () => {
			external.removeEventListener("abort", onAbort);
			this.unavailableController.signal.removeEventListener("abort", onUnavailable);
			if (timer !== void 0) clearTimeout(timer);
		};
		let retained = false;
		try {
			const result = await Promise.race([start(controller.signal), new Promise((_, reject) => {
				detach = reject;
				timer = setTimeout(() => {
					const error = new MobileExtensionError(code, "extension operation timed out", 500);
					controller.abort(error);
					reject(error);
				}, timeoutMs);
			})]);
			if (holdForStream && result !== null && typeof result === "object" && "body" in result && result.body instanceof Readable) {
				retained = true;
				result.body.once("close", release);
				result.body.once("end", release);
			}
			return result;
		} finally {
			if (timer !== void 0) clearTimeout(timer);
			if (!retained) release();
		}
	}
	streamStats() {
		return {
			activeStreams: [...this.streams.values()].filter((live) => !live.ended).length,
			maxBufferedBytes: this.maxBufferedBytes,
			cancelledStreams: this.cancelledStreams,
			bufferedBytes: this.totalUnacked()
		};
	}
	/** Graceful effects cleanup followed by termination; completion requires actual exit. */
	async dispose() {
		if (!this.available()) {
			await this.terminate("dispose-unavailable");
			return;
		}
		this.disposed = true;
		let timer;
		try {
			const reply = new Promise((resolve, reject) => {
				this.pending.set(LIFECYCLE_ID, {
					resolve,
					reject,
					cleanup: () => void 0
				});
				this.post({
					kind: "dispose",
					id: LIFECYCLE_ID
				});
			});
			await Promise.race([reply, new Promise((resolve) => {
				timer = setTimeout(resolve, this.limits.disposeGraceMs);
			})]);
		} finally {
			if (timer !== void 0) clearTimeout(timer);
			await this.terminate("disposed");
		}
	}
	whenExited() {
		return this.exited;
	}
	/** Stop admission now, retain execution/budget ownership until confirmed thread exit. */
	terminate(reason) {
		this.markUnavailable();
		this.termination ??= (async () => {
			if (!this.dead) await this.worker.terminate();
			await this.exited;
		})();
		this.termination.catch(() => void 0);
		return this.termination;
	}
	unavailable() {
		return new MobileExtensionError("extension_host_unavailable", `extension ${this.options.manifest.id} worker is unavailable; explicit recovery is required`, 503);
	}
	markUnavailable() {
		if (this.unavailableController.signal.aborted) return;
		const error = this.unavailable();
		this.unavailableController.abort(error);
		try {
			this.options.onUnavailable?.(error);
		} catch (cause) {}
	}
	armExecutionGrace(id) {
		if (this.executionGrace.has(id) || !this.available()) return;
		const timer = setTimeout(() => {
			this.executionGrace.delete(id);
			if (this.pending.has(id) || this.routePending.has(id)) this.terminate("cancel-unresponsive");
		}, this.limits.cancelGraceMs);
		timer.unref();
		this.executionGrace.set(id, timer);
	}
	settleExecutionGrace(id) {
		const timer = this.executionGrace.get(id);
		if (timer !== void 0) clearTimeout(timer);
		this.executionGrace.delete(id);
	}
	post(message) {
		if (!this.dead && this.termination === void 0) this.worker.postMessage(message);
	}
	handleMessage(raw) {
		if (this.dead || raw === null || typeof raw !== "object") return;
		const message = raw;
		if (message.kind === "log") {
			if (message.level !== "debug" && message.level !== "info" && message.level !== "warn" && message.level !== "error") return;
			if (!Array.isArray(message.args) || message.args.some((arg) => typeof arg !== "string")) return;
			if (Date.now() - this.logWindowStart >= this.limits.logWindowMs) {
				this.logWindowStart = Date.now();
				this.logCount = 0;
			}
			if (++this.logCount > this.limits.logMessagesPerWindow || Buffer.byteLength(message.args.join("")) > this.limits.logMessageBytes) return;
			try {
				this.options.logger[message.level](...message.args);
			} catch (error) {}
			return;
		}
		if (typeof message.runtimeId !== "string") return;
		if (this.activation !== void 0 && message.runtimeId !== this.activation.runtimeId) return;
		if (message.kind === "activated") {
			if (this.activation !== void 0 || !Array.isArray(message.actions) || !Array.isArray(message.routes)) throw new Error("invalid activation metadata");
			const actions = message.actions;
			const routes = message.routes;
			if (actions.length + routes.length > this.limits.maxRegistrations) throw new Error("worker registration limit exceeded");
			for (const action of actions) if (typeof action?.name !== "string" || !/^[a-z][a-z0-9-]{0,63}$/u.test(action.name)) throw new Error("invalid action metadata");
			for (const route of routes) if (typeof route?.method !== "string" || typeof route.path !== "string") throw new Error("invalid route metadata");
			this.activation = Object.freeze({
				runtimeId: message.runtimeId,
				actions: Object.freeze(actions),
				routes: Object.freeze(routes)
			});
			const pending = this.pending.get(LIFECYCLE_ID);
			this.pending.delete(LIFECYCLE_ID);
			pending?.cleanup();
			pending?.resolve(new PreparedJsonResult(Buffer.alloc(0)));
			return;
		}
		if (typeof message.id !== "string") return;
		const id = message.id;
		if (message.kind === "result" || message.kind === "error") {
			const pending = this.pending.get(id);
			this.pending.delete(id);
			pending?.cleanup();
			if (message.kind === "result") {
				if (!(message.bytes instanceof Uint8Array) || message.bytes.byteLength > this.limits.resultMaxBytes) {
					pending?.reject(new MobileExtensionError("extension_failed", "invalid worker result", 500));
					return;
				}
				pending?.resolve(new PreparedJsonResult(Buffer.from(message.bytes)));
			} else {
				const error = new MobileExtensionError(typeof message.code === "string" ? message.code.slice(0, 64) : "extension_failed", typeof message.message === "string" ? message.message.slice(0, 500) : "extension failed", typeof message.status === "number" && Number.isInteger(message.status) && message.status >= 400 && message.status <= 599 ? message.status : 500);
				pending?.reject(error);
				const route = this.routePending.get(id);
				this.routePending.delete(id);
				this.detachedRoutes.delete(id);
				route?.cleanup();
				route?.reject(error);
			}
			return;
		}
		if (message.kind === "route-response" || message.kind === "stream-start") {
			const route = this.routePending.get(id);
			if (route === void 0) {
				if (message.kind === "stream-start") this.post({
					kind: "stream-cancel",
					id
				});
				return;
			}
			if (message.kind === "stream-start" && this.detachedRoutes.has(id)) {
				this.cancelledStreams += 1;
				this.post({
					kind: "stream-cancel",
					id
				});
				return;
			}
			const response = responseMetadata(message);
			this.routePending.delete(id);
			this.detachedRoutes.delete(id);
			if (message.kind === "route-response") {
				route.cleanup();
				if (!(message.bytes instanceof Uint8Array) || message.bytes.byteLength > this.limits.resultMaxBytes) {
					route.reject(new MobileExtensionError("invalid_route_response", "invalid worker route response", 500));
					return;
				}
				route.resolve({
					...response,
					body: Buffer.from(message.bytes)
				});
			} else {
				this.settleExecutionGrace(id);
				const live = this.openStream(id, route.cleanup);
				route.resolve({
					...response,
					body: live.bridge
				});
			}
			return;
		}
		if (message.kind === "stream-chunk") {
			const live = this.streams.get(id);
			if (live === void 0 || live.ended || live.bridge.destroyed) return;
			if (!(message.bytes instanceof Uint8Array) || message.bytes.byteLength > this.limits.streamChunkBytes || live.unacked + message.bytes.byteLength > this.limits.streamWindowBytes || this.totalUnacked() + message.bytes.byteLength > this.limits.streamAggregateBytes) throw new Error("worker exceeded stream credit");
			live.unacked += message.bytes.byteLength;
			this.maxBufferedBytes = Math.max(this.maxBufferedBytes, this.totalUnacked());
			live.bridge.push(Buffer.from(message.bytes));
			return;
		}
		if (message.kind === "stream-end" || message.kind === "stream-error") {
			this.settleExecutionGrace(id);
			const detached = this.routePending.get(id);
			if (this.detachedRoutes.delete(id)) {
				this.routePending.delete(id);
				detached?.cleanup();
				detached?.reject(new MobileExtensionError("extension_cancelled", "caller detached", 409));
			}
			const live = this.streams.get(id);
			if (live === void 0) return;
			live.ended = true;
			if (live.cancelTimer !== void 0) clearTimeout(live.cancelTimer);
			if (message.kind === "stream-error") live.bridge.destroy(new Error(typeof message.message === "string" ? message.message.slice(0, 500) : "worker stream failed"));
			else if (live.bridge.destroyed) this.streams.delete(id);
			else live.bridge.push(null);
		}
	}
	totalUnacked() {
		let total = 0;
		for (const live of this.streams.values()) total += live.unacked;
		return total;
	}
	openStream(id, cleanup) {
		const live = {
			bridge: new WorkerStreamBridge((bytes) => {
				live.unacked -= bytes;
				this.post({
					kind: "stream-ack",
					id,
					bytes
				});
			}),
			unacked: 0,
			ended: false
		};
		live.bridge.on("error", () => void 0);
		const settle = () => {
			cleanup();
			if (live.ended) {
				if (live.unacked > 0) this.post({
					kind: "stream-cancel",
					id
				});
				this.streams.delete(id);
			} else this.cancelStream(id);
		};
		live.bridge.once("end", settle);
		live.bridge.once("close", settle);
		this.streams.set(id, live);
		return live;
	}
	cancelStream(id) {
		const live = this.streams.get(id);
		if (live === void 0 || live.ended || live.cancelTimer !== void 0) return;
		this.cancelledStreams += 1;
		this.post({
			kind: "stream-cancel",
			id
		});
		live.cancelTimer = setTimeout(() => {
			if (!live.ended) this.terminate("stream-cancel-unresponsive");
		}, this.limits.streamCancelGraceMs);
		live.cancelTimer.unref();
		live.bridge.destroy();
	}
};
function responseMetadata(message) {
	const headers = {};
	let bytes = typeof message.contentType === "string" ? Buffer.byteLength(message.contentType) : 0;
	if (message.headers !== void 0) {
		if (message.headers === null || typeof message.headers !== "object" || Array.isArray(message.headers)) throw new Error("invalid response headers");
		const entries = Object.entries(message.headers);
		if (entries.length > 3) throw new Error("invalid response header count");
		for (const [key, value] of entries) {
			if (typeof value !== "string" || !/^(?:content-disposition|cache-control|etag)$/iu.test(key)) throw new Error("invalid response header");
			bytes += Buffer.byteLength(key) + Buffer.byteLength(value);
			if (bytes > 16384) throw new Error("invalid response header bytes");
			headers[key] = value;
		}
	}
	return {
		...typeof message.status === "number" ? { status: message.status } : {},
		...typeof message.contentType === "string" ? { contentType: message.contentType } : {},
		...message.headers === void 0 ? {} : { headers }
	};
}
/** Credit belongs to bytes actually removed by the consumer, including reads after source EOF. */
var WorkerStreamBridge = class extends Readable {
	consume;
	constructor(consume) {
		super({ highWaterMark: 16384 });
		this.consume = consume;
	}
	_read() {}
	emit(event, ...args) {
		if (event === "data" && Buffer.isBuffer(args[0])) this.consume(args[0].byteLength);
		return super.emit(event, ...args);
	}
};
//#endregion
//#region src/extensions.ts
/** Maximum sizes enforced at the local-extension filesystem boundary. */
const EXTENSION_LIMITS = Object.freeze({
	manifest: 65536,
	script: 1048576,
	css: 524288,
	asset: 8388608,
	assetFiles: 256,
	assetBytes: 33554432,
	assetDepth: 8
});
/** A misbehaving host activation must not wedge the local watcher forever. */
const HOST_ACTIVATION_TIMEOUT_MS = 5e3;
/** The previous Host outlives the hidden-page refresh interval and one timed refresh. */
const RETIRED_GENERATION_TTL_MS = 6e5;
/** Extension teardown is advisory and must never stop watcher progress. */
const HOST_TEARDOWN_TIMEOUT_MS = 2e3;
async function withActivationTimeout(promise, id, signal) {
	let timer;
	let onAbort;
	try {
		return await Promise.race([
			promise,
			new Promise((_, reject) => {
				timer = setTimeout(() => reject(new MobileExtensionError("host_load_timeout", `extension ${id} activation timed out`, 500)), HOST_ACTIVATION_TIMEOUT_MS);
			}),
			new Promise((_, reject) => {
				const abort = () => {
					reject(new MobileExtensionError("host_activation_closed", `extension ${id} activation is closed`, 409));
				};
				if (signal.aborted) abort();
				else {
					onAbort = abort;
					signal.addEventListener("abort", abort, { once: true });
				}
			})
		]);
	} finally {
		if (timer !== void 0) clearTimeout(timer);
		if (onAbort !== void 0) signal.removeEventListener("abort", onAbort);
	}
}
/** A controlled business failure returned by an extension action or route. */
var MobileExtensionError = class extends Error {
	code;
	status;
	constructor(code, message, status = 400) {
		super(message);
		this.code = code;
		this.status = status;
		this.name = "MobileExtensionError";
	}
};
/** Validate user-facing extension text without allowing control characters. */
function text(value, field, maximum, required) {
	if (value === void 0 && !required) return void 0;
	if (typeof value !== "string" || required && value.length === 0 || value.length > maximum || /[\u0000-\u001f\u007f]/u.test(value)) throw new MobileExtensionError("invalid_manifest", `${field} is invalid`);
	return value;
}
/** Validate a stable extension id. */
function assertExtensionId(value) {
	if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,63}$/u.test(value)) throw new MobileExtensionError("invalid_manifest", "extension id is invalid");
	return value;
}
/** Validate a manifest from JSON or a plugin definition. */
function parseExtensionManifest(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new MobileExtensionError("invalid_manifest", "extension.json must be an object");
	const record = value;
	if (record.schemaVersion !== 1) throw new MobileExtensionError("invalid_manifest", "unsupported extension schema");
	const id = assertExtensionId(record.id);
	const name = text(record.name, "name", 120, true);
	const version = text(record.version, "version", 64, true);
	const description = text(record.description, "description", 500, false);
	for (const key of Reflect.ownKeys(record)) if (![
		"schemaVersion",
		"id",
		"name",
		"version",
		"description"
	].includes(String(key))) throw new MobileExtensionError("invalid_manifest", "extension.json has unknown fields");
	return Object.freeze({
		schemaVersion: 1,
		id,
		name,
		version,
		...description === void 0 ? {} : { description }
	});
}
function normalizeRelativePath(value, field) {
	if (value.length === 0 || value.includes("\0") || isAbsolute(value)) throw new MobileExtensionError("invalid_extension_path", `${field} is invalid`);
	const normalized = value.replaceAll("\\", "/");
	if (normalized.split("/").some((part) => part === "" || part === "." || part === "..")) throw new MobileExtensionError("invalid_extension_path", `${field} escapes extension directory`);
	return normalized;
}
async function regularFile$3(path, maximum, field) {
	let info;
	try {
		info = await lstat(path);
	} catch (error) {
		if (error.code === "ENOENT") throw new MobileExtensionError("invalid_extension", `${field} is missing`);
		throw error;
	}
	if (!info.isFile() || info.isSymbolicLink() || info.size > maximum) throw new MobileExtensionError("invalid_extension", `${field} must be a regular file within its size limit`);
	return {
		path,
		size: info.size
	};
}
async function containedPath(root, relativePath, maximum, field) {
	const normalized = normalizeRelativePath(relativePath, field);
	const target = resolve(root, normalized);
	const rootReal = await realpath(root);
	const targetReal = await realpath(target);
	const relation = relative(rootReal, targetReal);
	if (relation === "" || relation.startsWith("..") || isAbsolute(relation)) throw new MobileExtensionError("invalid_extension_path", `${field} escapes extension directory`);
	return regularFile$3(targetReal, maximum, field);
}
async function optionalFile(root, name, maximum, field) {
	try {
		return (await containedPath(root, name, maximum, field)).path;
	} catch (error) {
		if (error.code === "ENOENT") return void 0;
		if (error instanceof MobileExtensionError && error.message.includes("is missing")) return void 0;
		throw error;
	}
}
async function optionalBytes(root, name, maximum, field) {
	const path = await optionalFile(root, name, maximum, field);
	return path === void 0 ? void 0 : readFile(path);
}
function assertRealPathWithin(rootReal, targetReal, field) {
	const relation = relative(rootReal, targetReal);
	if (relation === "" || relation.startsWith("..") || isAbsolute(relation)) throw new MobileExtensionError("invalid_extension_path", `${field} escapes extension directory`);
}
async function realExtensionRoot(directory) {
	const root = resolve(directory);
	const info = await lstat(root);
	if (!info.isDirectory() || info.isSymbolicLink()) throw new MobileExtensionError("invalid_extension", "extension directory must be real");
	return realpath(root);
}
async function assetSnapshot(extensionRootReal) {
	const assetsPath = join(extensionRootReal, "assets");
	let assetsInfo;
	try {
		assetsInfo = await lstat(assetsPath);
	} catch (error) {
		if (error.code === "ENOENT") return /* @__PURE__ */ new Map();
		throw error;
	}
	if (!assetsInfo.isDirectory() || assetsInfo.isSymbolicLink()) throw new MobileExtensionError("invalid_extension", "assets must be a real directory");
	const assetsReal = await realpath(assetsPath);
	assertRealPathWithin(extensionRootReal, assetsReal, "assets");
	const snapshots = /* @__PURE__ */ new Map();
	let totalBytes = 0;
	const visit = async (directoryReal, prefix, depth) => {
		if (depth > EXTENSION_LIMITS.assetDepth) throw new MobileExtensionError("invalid_extension", "asset tree exceeds its depth limit");
		assertRealPathWithin(extensionRootReal, directoryReal, "asset directory");
		const handle = await opendir(directoryReal);
		const entries = [];
		try {
			for await (const entry of handle) entries.push(entry);
		} finally {
			await handle.close().catch(() => void 0);
		}
		entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
		for (const entry of entries) {
			const path = join(directoryReal, entry.name);
			const info = await lstat(path);
			if (info.isSymbolicLink()) throw new MobileExtensionError("invalid_extension_path", "asset escapes extension directory");
			const targetReal = await realpath(path);
			assertRealPathWithin(extensionRootReal, targetReal, "asset");
			const key = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
			if (info.isDirectory()) {
				await visit(targetReal, key, depth + 1);
				continue;
			}
			if (!info.isFile() || info.size > EXTENSION_LIMITS.asset) throw new MobileExtensionError("invalid_extension", "asset must be a regular file within its size limit");
			const body = await readFile(targetReal);
			totalBytes += body.byteLength;
			if (snapshots.size >= EXTENSION_LIMITS.assetFiles || totalBytes > EXTENSION_LIMITS.assetBytes) throw new MobileExtensionError("invalid_extension", "asset tree exceeds its aggregate limit");
			snapshots.set(key, Object.freeze({
				body,
				digest: createHash("sha256").update(body).digest("hex"),
				name: entry.name
			}));
		}
	};
	await visit(assetsReal, "", 0);
	return snapshots;
}
async function extensionFingerprint(directory) {
	const root = await realExtensionRoot(directory);
	const manifestFile = await regularFile$3(join(root, "extension.json"), EXTENSION_LIMITS.manifest, "extension.json");
	const manifestBody = await readFile(manifestFile.path);
	const manifest = parseExtensionManifest(JSON.parse(manifestBody.toString("utf8")));
	if (manifest.id !== basename(root)) throw new MobileExtensionError("invalid_manifest", "extension id must match its directory name");
	const [host, script, style, assets] = await Promise.all([
		optionalBytes(root, "host.mjs", EXTENSION_LIMITS.script, "host.mjs"),
		optionalBytes(root, "mobile.js", EXTENSION_LIMITS.script, "mobile.js"),
		optionalBytes(root, "mobile.css", EXTENSION_LIMITS.css, "mobile.css"),
		assetSnapshot(root)
	]);
	const digest = createHash("sha256").update(`manifest:${manifestBody.byteLength}:`).update(createHash("sha256").update(manifestBody).digest());
	for (const [name, body] of [
		["host", host],
		["script", script],
		["style", style]
	]) {
		digest.update(`\0${name}:${body?.byteLength ?? -1}:`);
		if (body !== void 0) digest.update(createHash("sha256").update(body).digest());
	}
	for (const [name, asset] of assets) digest.update(`\0asset:${Buffer.byteLength(name)}:${name}:${asset.body.byteLength}:${asset.digest}`);
	return {
		manifest,
		digest: digest.digest("hex"),
		assets,
		...script === void 0 ? {} : { scriptBody: script },
		...style === void 0 ? {} : { styleBody: style }
	};
}
function routeKey(route) {
	const method = route.method.toUpperCase();
	const path = normalizeRoutePath(route.path);
	return `${method} ${route.kind ?? "exact"} ${path}`;
}
function normalizeRoutePath(value) {
	if (typeof value !== "string" || value.length === 0 || value.length > 256 || value.includes("?") || value.includes("#") || value.includes("\\") || value.includes("\0") || /[\u0000-\u001f\u007f]/u.test(value)) throw new MobileExtensionError("invalid_route", "extension route path is invalid");
	const normalizedInput = value.startsWith("/") ? value : `/${value}`;
	if (normalizedInput.split("/").some((part) => part === ".." || part === ".")) throw new MobileExtensionError("invalid_route", "extension route path is invalid");
	return normalizedInput === "/" ? "/" : normalizedInput.replace(/\/+$/u, "");
}
/** Validate and snapshot an optional per-operation timeout override. */
function operationTimeout(value, code) {
	if (value === void 0) return void 0;
	if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 3e5) throw new MobileExtensionError(code, "operation timeoutMs is invalid");
	return value;
}
function validateDefinition(definition) {
	const manifest = parseExtensionManifest({
		schemaVersion: definition.schemaVersion,
		id: definition.id,
		name: definition.name,
		version: definition.version,
		...definition.description === void 0 ? {} : { description: definition.description }
	});
	const actionNames = /* @__PURE__ */ new Set();
	const actions = {};
	for (const [name, action] of Object.entries(definition.actions ?? {})) {
		if (!/^[a-z][a-z0-9-]{0,63}$/u.test(name) || action === null || typeof action !== "object" || typeof action.run !== "function" || actionNames.has(name)) throw new MobileExtensionError("invalid_action", `invalid action ${name}`);
		actionNames.add(name);
		const actionTimeout = operationTimeout(action.timeoutMs, "invalid_action");
		const actionInput = action.input;
		actions[name] = Object.freeze({
			...actionInput === void 0 ? {} : { input: actionInput },
			run: action.run.bind(action),
			...actionTimeout === void 0 ? {} : { timeoutMs: actionTimeout }
		});
	}
	const routeNames = /* @__PURE__ */ new Set();
	const routes = (definition.routes ?? []).map((route) => {
		if (route === null || typeof route !== "object" || typeof route.handle !== "function") throw new MobileExtensionError("invalid_route", "invalid extension route");
		const method = route.method.toUpperCase();
		if (![
			"GET",
			"HEAD",
			"POST",
			"PUT",
			"PATCH",
			"DELETE"
		].includes(method)) throw new MobileExtensionError("invalid_route", "unsupported extension route method");
		const routeTimeout = operationTimeout(route.timeoutMs, "invalid_route");
		const normalized = Object.freeze({
			method,
			path: normalizeRoutePath(route.path),
			...route.kind === void 0 ? {} : { kind: route.kind },
			handle: route.handle.bind(route),
			...routeTimeout === void 0 ? {} : { timeoutMs: routeTimeout }
		});
		const key = routeKey(normalized);
		if (routeNames.has(key)) throw new MobileExtensionError("duplicate_route", `duplicate route ${key}`);
		routeNames.add(key);
		return normalized;
	});
	return Object.freeze({
		...manifest,
		...definition.actions === void 0 ? {} : { actions: Object.freeze(actions) },
		...routes.length === 0 ? {} : { routes: Object.freeze(routes) }
	});
}
function combineSignalLifetime(first, second) {
	if (first.aborted || second.aborted) {
		const aborted = new AbortController();
		aborted.abort(first.aborted ? first.reason : second.reason);
		return {
			signal: aborted.signal,
			cleanup: () => void 0
		};
	}
	const controller = new AbortController();
	const cleanup = () => {
		first.removeEventListener("abort", abortFirst);
		second.removeEventListener("abort", abortSecond);
	};
	const abortFirst = () => {
		cleanup();
		controller.abort(first.reason);
	};
	const abortSecond = () => {
		cleanup();
		controller.abort(second.reason);
	};
	first.addEventListener("abort", abortFirst, { once: true });
	second.addEventListener("abort", abortSecond, { once: true });
	return {
		signal: controller.signal,
		cleanup
	};
}
/** Validate and normalize an action input through either supported schema form. */
function parseActionInput(schema, input) {
	if (schema === void 0) return input;
	if (typeof schema === "function") return schema(input);
	return schema.parse(input) ?? input;
}
/** Host registry and service consumed by both npm plugins and local extensions. */
var MobileAccessService = class extends Service {
	registered = /* @__PURE__ */ new Map();
	local = /* @__PURE__ */ new Map();
	retired = /* @__PURE__ */ new Map();
	failures = /* @__PURE__ */ new Map();
	/** Extensions with caller-detached, still-unresolved operations. */
	abandoned = /* @__PURE__ */ new Map();
	contentListeners = /* @__PURE__ */ new Set();
	contentHash = createHash("sha256").update("").digest("hex");
	localRoot;
	localContext;
	localTimer;
	localRefreshing;
	localRefreshAbort;
	localLifecycle = 0;
	localClosed = true;
	localExecution;
	localExecutionKey;
	workerBudget;
	disposal = /* @__PURE__ */ new Set();
	recoveries = /* @__PURE__ */ new Map();
	constructor(ctx) {
		super(ctx, "mobileAccess");
	}
	/** Register a normal Cordis extension and return an idempotent disposer. */
	registerExtension(definition) {
		const validated = validateDefinition(definition);
		if (this.registered.has(validated.id) || this.local.has(validated.id)) throw new Error(`mobile extension id already registered: ${validated.id}`);
		const dispose = () => {
			if (this.registered.get(validated.id)?.dispose === dispose) {
				this.registered.delete(validated.id);
				this.updateContentHash();
			}
		};
		this.registered.set(validated.id, {
			definition: validated,
			dispose
		});
		this.updateContentHash();
		return dispose;
	}
	/** Aggregate digest covering every registered and active local extension. */
	contentDigest() {
		return this.contentHash;
	}
	/** Subscribe to committed extension generation changes. */
	onContentChanged(listener) {
		this.contentListeners.add(listener);
		return () => {
			this.contentListeners.delete(listener);
		};
	}
	updateContentHash() {
		const parts = [...[...this.registered.values()].map((entry) => entry.definition.id), ...[...this.local.values()].map((active) => `${active.manifest.id}:${active.digest}`)];
		const next = createHash("sha256").update(parts.sort().join("|")).digest("hex");
		if (next === this.contentHash) return;
		this.contentHash = next;
		for (const listener of this.contentListeners) try {
			listener();
		} catch {}
	}
	/** Return the current client-facing manifest, deterministically sorted by id. */
	manifest() {
		const entries = /* @__PURE__ */ new Map();
		for (const { definition } of this.registered.values()) entries.set(definition.id, {
			schemaVersion: 1,
			id: definition.id,
			name: definition.name,
			version: definition.version,
			...definition.description === void 0 ? {} : { description: definition.description }
		});
		for (const active of this.local.values()) entries.set(active.manifest.id, {
			...active.manifest,
			generation: active.digest,
			...active.scriptBody === void 0 ? {} : { scriptUrl: `/mobile-access/extensions/${active.manifest.id}/mobile.js?generation=${active.digest}` },
			...active.styleBody === void 0 ? {} : { styleUrl: `/mobile-access/extensions/${active.manifest.id}/mobile.css?generation=${active.digest}` },
			assetsUrl: `/mobile-access/extensions/${active.manifest.id}/assets/`
		});
		return [...entries.values()].sort((left, right) => left.id.localeCompare(right.id));
	}
	/** Return loaded and failed local extension counts without exposing host errors. */
	status() {
		const unavailable = [...this.local.values()].filter((entry) => entry.worker !== void 0 && !entry.worker.available()).length;
		return Object.freeze({
			loaded: this.registered.size + this.local.size - unavailable,
			failed: this.failures.size + unavailable
		});
	}
	/** Local Host status does not reveal filesystem paths, credentials or extension errors. */
	hostStatus() {
		const limits = resolveHostExecution(this.localExecution?.hostExecution);
		return {
			hosts: [...this.local.values()].map((entry) => ({
				id: entry.manifest.id,
				name: entry.manifest.name,
				mode: entry.worker === void 0 ? "in-process" : "worker",
				state: entry.worker === void 0 || entry.worker.available() ? "ready" : "unavailable",
				generation: entry.digest
			})),
			limits: {
				maxWorkers: limits.maxWorkers,
				workers: this.workerBudget?.current ?? 0
			}
		};
	}
	/** Explicitly replace one unavailable worker without replaying requests or changing its files. */
	recoverExtension(id) {
		assertExtensionId(id);
		const existing = this.recoveries.get(id);
		if (existing !== void 0) return existing;
		const recovering = (async () => {
			if (this.localRefreshing !== void 0) await this.localRefreshing;
			const previous = this.local.get(id);
			if (this.localClosed || previous?.worker === void 0 || this.localContext === void 0) throw new MobileExtensionError("extension_recovery_unavailable", "local worker recovery is unavailable", 409);
			if (previous.worker.available()) throw new MobileExtensionError("extension_host_running", "extension worker is already running", 409);
			await previous.worker.terminate("explicit-recovery");
			const lifecycle = this.localLifecycle;
			const fingerprint = await extensionFingerprint(previous.directory);
			const fresh = await loadLocalExtension(previous.directory, this.localContext, fingerprint, void 0, this.localExecution);
			try {
				const confirmed = await extensionFingerprint(previous.directory);
				if (this.localClosed || this.localLifecycle !== lifecycle || this.local.get(id) !== previous || confirmed.digest !== fingerprint.digest) throw new MobileExtensionError("extension_changed_during_activation", "extension changed during recovery", 409);
			} catch (error) {
				await abortAndDisposeLocal([fresh]);
				throw error;
			}
			this.local.set(id, fresh);
			this.failures.delete(id);
			this.queueDisposal([previous]);
			this.updateContentHash();
		})().finally(() => {
			if (this.recoveries.get(id) === recovering) this.recoveries.delete(id);
		});
		this.recoveries.set(id, recovering);
		return recovering;
	}
	queueDisposal(entries) {
		const pending = abortAndDisposeLocal(entries).finally(() => {
			this.disposal.delete(pending);
		});
		this.disposal.add(pending);
	}
	/** Locate one active extension. */
	extension(id, generation) {
		if (generation !== void 0) {
			const current = this.local.get(id);
			if (current?.digest === generation) return current;
			const previous = this.retired.get(id)?.active;
			return previous?.digest === generation ? previous : void 0;
		}
		return this.local.get(id) ?? this.registered.get(id)?.definition;
	}
	/** Return the active local generation signal for gateway cancellation wiring. */
	signal(id, generation) {
		const extension = this.extension(id, generation);
		return extension !== void 0 && "host" in extension ? extension.controller.signal : void 0;
	}
	/** Read a local client entry after validating that it remains inside its directory. */
	async readClientFile(id, kind, signal, generation) {
		signal?.throwIfAborted();
		const selected = this.extension(id, generation);
		const active = selected !== void 0 && "host" in selected ? selected : void 0;
		if (active === void 0) throw new MobileExtensionError("extension_generation_not_found", "extension generation not found", 404);
		const snapshot = kind === "script" ? active.scriptBody : active.styleBody;
		if (snapshot === void 0) throw new MobileExtensionError("extension_asset_not_found", "extension asset not found", 404);
		const body = Buffer.from(snapshot);
		return {
			body,
			digest: createHash("sha256").update(body).digest("hex")
		};
	}
	/** Read a generation-pinned static asset from its validated snapshot. */
	async readAsset(id, assetPath, signal, generation) {
		signal?.throwIfAborted();
		const selected = this.extension(id, generation);
		const active = selected !== void 0 && "host" in selected ? selected : void 0;
		if (active === void 0) throw new MobileExtensionError("extension_generation_not_found", "extension generation not found", 404);
		const normalized = normalizeRelativePath(assetPath, "asset");
		const asset = active.assets.get(normalized);
		if (asset === void 0) throw new MobileExtensionError("extension_asset_not_found", "extension asset not found", 404);
		return {
			body: Buffer.from(asset.body),
			digest: asset.digest,
			name: asset.name
		};
	}
	/** Reject new dispatches to an extension whose abandoned work is unresolved. */
	requireAdmission(id) {
		if ((this.abandoned.get(id) ?? 0) > 0) throw new MobileExtensionError("extension_busy", `extension ${id} has unresolved abandoned work`, 503);
	}
	/** Account for one operation until its underlying work actually settles. */
	trackOperation(id, operation) {
		operation.settled.then(() => {
			if (operation.detached()) {
				const remaining = (this.abandoned.get(id) ?? 1) - 1;
				if (remaining <= 0) this.abandoned.delete(id);
				else this.abandoned.set(id, remaining);
			}
		}).catch(() => void 0);
	}
	/** Invoke one action after parsing its input and binding the request lifetime. */
	async invoke(id, actionName, input, context, generation) {
		const extension = this.extension(id, generation);
		if (extension === void 0) throw new MobileExtensionError("extension_not_found", "extension not found", 404);
		const action = ("host" in extension ? extension.host : extension).actions?.[actionName];
		if (action === void 0) throw new MobileExtensionError("action_not_found", "action not found", 404);
		if ("host" in extension) extension.controller.signal.throwIfAborted();
		context.signal.throwIfAborted();
		this.requireAdmission(id);
		const external = "host" in extension ? combineSignalLifetime(extension.controller.signal, context.signal) : void 0;
		let operation;
		try {
			operation = startBoundedOperation((signal) => {
				let parsed;
				try {
					parsed = parseActionInput(action.input, input);
				} catch {
					throw new MobileExtensionError("invalid_action_input", "action input is invalid", 400);
				}
				return Promise.resolve(parsed).then((value) => {
					signal.throwIfAborted();
					return action.run({
						...context,
						signal
					}, value);
				}, () => {
					throw new MobileExtensionError("invalid_action_input", "action input is invalid", 400);
				});
			}, {
				external: external?.signal ?? context.signal,
				timeoutMs: action.timeoutMs ?? ("host" in extension && extension.worker !== void 0 ? resolveHostExecution(this.localExecution?.hostExecution).operationTimeoutMs : 3e4),
				timeoutError: () => new MobileExtensionError("extension_action_timeout", `extension ${id} action ${actionName} timed out`, 500),
				onDetach: () => {
					this.abandoned.set(id, (this.abandoned.get(id) ?? 0) + 1);
				}
			});
			this.trackOperation(id, operation);
			return await operation.caller;
		} catch (error) {
			if (error instanceof OperationCancelled) throw error.reason;
			if (error instanceof MobileExtensionError) throw error;
			throw new MobileExtensionError("extension_failed", "extension action failed", 500);
		} finally {
			operation?.release();
			external?.cleanup();
		}
	}
	/** Match one route and invoke it with a generation-bound abort signal. */
	async route(id, method, pathname, request, generation) {
		const extension = this.extension(id, generation);
		if (extension === void 0) throw new MobileExtensionError("extension_not_found", "extension not found", 404);
		const route = ("host" in extension ? extension.host : extension).routes?.find((candidate) => {
			if (candidate.method !== method) return false;
			return (candidate.kind ?? "exact") === "exact" ? candidate.path === pathname : pathname === candidate.path || pathname.startsWith(`${candidate.path}/`);
		});
		if (route === void 0) throw new MobileExtensionError("route_not_found", "route not found", 404);
		if ("host" in extension) extension.controller.signal.throwIfAborted();
		request.signal.throwIfAborted();
		this.requireAdmission(id);
		const external = "host" in extension ? combineSignalLifetime(extension.controller.signal, request.signal) : void 0;
		let operation;
		let holdForStream = false;
		try {
			operation = startBoundedOperation((signal) => route.handle({
				...request,
				signal
			}), {
				external: external?.signal ?? request.signal,
				timeoutMs: route.timeoutMs ?? ("host" in extension && extension.worker !== void 0 ? resolveHostExecution(this.localExecution?.hostExecution).operationTimeoutMs : 3e4),
				timeoutError: () => new MobileExtensionError("extension_route_timeout", `extension ${id} route ${method} ${pathname} timed out`, 500),
				onDetach: () => {
					this.abandoned.set(id, (this.abandoned.get(id) ?? 0) + 1);
				}
			});
			this.trackOperation(id, operation);
			operation.settled.then(() => {
				disposeLateExtensionResponse(operation?.lateValue());
			}).catch(() => void 0);
			const result = await operation.caller;
			if (result === null || typeof result !== "object" || typeof result.body !== "string" && !(result.body instanceof Uint8Array) && !isReadable(result.body)) throw new MobileExtensionError("invalid_route_response", "extension returned an invalid response", 500);
			if (isReadable(result.body)) {
				holdForStream = true;
				releaseSignalLifetimeWhenStreamSettles(result.body, () => {
					operation?.release();
					external?.cleanup();
				});
			}
			return result;
		} catch (error) {
			if (error instanceof OperationCancelled) throw error.reason;
			if (error instanceof MobileExtensionError) throw error;
			throw new MobileExtensionError("extension_failed", "extension route failed", 500);
		} finally {
			if (!holdForStream) {
				operation?.release();
				external?.cleanup();
			}
		}
	}
	/** Start the local directory watcher; an absent directory is intentionally inert. */
	async startLocal(root, context, options) {
		const targetRoot = resolve(root);
		const limits = resolveHostExecution(options?.hostExecution);
		const executionKey = JSON.stringify({
			limits,
			module: options?.hostExecution?.workerModule
		});
		if (this.localRoot !== void 0 && (resolve(this.localRoot) !== targetRoot || this.localExecutionKey !== executionKey)) await this.stopLocal();
		if (this.localTimer !== void 0) clearInterval(this.localTimer);
		const lifecycle = ++this.localLifecycle;
		this.workerBudget ??= new ExtensionWorkerBudget(limits.maxWorkers);
		this.localRoot = targetRoot;
		this.localContext = context;
		this.localExecution = {
			...options,
			workerBudget: this.workerBudget
		};
		this.localExecutionKey = executionKey;
		this.localClosed = false;
		await mkdir(this.localRoot, { recursive: true });
		if (this.localClosed || this.localLifecycle !== lifecycle || this.localRoot !== targetRoot || this.localContext !== context) return;
		await this.refreshLocal();
		if (this.localClosed || this.localLifecycle !== lifecycle || this.localRoot !== targetRoot || this.localContext !== context) return;
		this.localTimer = setInterval(() => {
			this.refreshLocal();
		}, 2e3);
		this.localTimer.unref();
	}
	/** Stop the watcher and abort every local host generation. */
	async stopLocal() {
		this.localClosed = true;
		const lifecycle = ++this.localLifecycle;
		if (this.localTimer !== void 0) clearInterval(this.localTimer);
		this.localTimer = void 0;
		const refreshing = this.localRefreshing;
		this.localRefreshAbort?.abort();
		const previous = [...this.local.values(), ...[...this.retired.values()].map((entry) => entry.active)];
		this.local.clear();
		for (const entry of this.retired.values()) clearTimeout(entry.timer);
		this.retired.clear();
		this.failures.clear();
		this.updateContentHash();
		await Promise.allSettled([abortAndDisposeLocal(previous), ...refreshing === void 0 ? [] : [refreshing]]);
		if (this.localLifecycle !== lifecycle) return;
		const late = [...this.local.values(), ...[...this.retired.values()].map((entry) => entry.active)];
		this.local.clear();
		for (const entry of this.retired.values()) clearTimeout(entry.timer);
		this.retired.clear();
		this.failures.clear();
		this.updateContentHash();
		await abortAndDisposeLocal(late);
		await Promise.allSettled([...this.disposal, ...this.recoveries.values()]);
		this.workerBudget = void 0;
		if (this.localTimer !== void 0) clearInterval(this.localTimer);
		this.localTimer = void 0;
	}
	/** Refresh all local extensions atomically; failures keep the previous snapshot. */
	refreshLocal() {
		if (this.localRefreshing !== void 0) return this.localRefreshing;
		const controller = new AbortController();
		this.localRefreshAbort = controller;
		const refreshing = this.stageAndCommit(controller.signal).finally(() => {
			if (this.localRefreshing === refreshing) this.localRefreshing = void 0;
			if (this.localRefreshAbort === controller) this.localRefreshAbort = void 0;
		});
		this.localRefreshing = refreshing;
		return refreshing;
	}
	async stageAndCommit(signal) {
		if (this.localClosed || signal.aborted || this.localRoot === void 0 || this.localContext === void 0) return;
		let names = [];
		try {
			const directory = await opendir(this.localRoot);
			try {
				for await (const entry of directory) if (entry.isDirectory() && !entry.isSymbolicLink()) names.push(entry.name);
			} finally {
				await directory.close().catch(() => void 0);
			}
		} catch {
			return;
		}
		names.sort();
		const staged = [];
		const stagedFresh = [];
		let failingName = "local";
		try {
			for (const name of names) {
				signal.throwIfAborted();
				failingName = name;
				const directory = join(this.localRoot, name);
				const fingerprint = await extensionFingerprint(directory);
				const current = this.local.get(fingerprint.manifest.id);
				const retired = this.retired.get(fingerprint.manifest.id)?.active;
				const previous = current?.digest === fingerprint.digest ? current : retired?.digest === fingerprint.digest ? retired : void 0;
				if (previous?.digest === fingerprint.digest) staged.push(previous);
				else {
					const fresh = await loadLocalExtension(directory, this.localContext, fingerprint, signal, this.localExecution);
					try {
						signal.throwIfAborted();
						if ((await extensionFingerprint(directory)).digest !== fingerprint.digest) throw new MobileExtensionError("extension_changed_during_activation", `extension ${fingerprint.manifest.id} changed during activation`, 409);
					} catch (error) {
						await abortAndDisposeLocal([fresh]);
						throw error;
					}
					staged.push(fresh);
					stagedFresh.push(fresh);
				}
			}
			if (this.localClosed || signal.aborted || this.localRoot === void 0 || this.localContext === void 0) {
				await abortAndDisposeLocal(stagedFresh);
				return;
			}
			const duplicate = /* @__PURE__ */ new Set();
			for (const entry of staged) {
				if (duplicate.has(entry.manifest.id) || this.registered.has(entry.manifest.id)) throw new MobileExtensionError("duplicate_extension", `duplicate extension id ${entry.manifest.id}`);
				duplicate.add(entry.manifest.id);
			}
			const previous = [...this.local.values()];
			for (const entry of staged) {
				const retired = this.retired.get(entry.manifest.id);
				if (retired?.active === entry) {
					clearTimeout(retired.timer);
					this.retired.delete(entry.manifest.id);
				}
			}
			const stagedIds = new Set(staged.map((entry) => entry.manifest.id));
			const removed = [];
			for (const entry of previous) {
				if (staged.includes(entry)) continue;
				if (stagedIds.has(entry.manifest.id)) {
					this.retire(entry);
					continue;
				}
				removed.push(entry);
				const retired = this.retired.get(entry.manifest.id);
				if (retired !== void 0) {
					clearTimeout(retired.timer);
					this.retired.delete(entry.manifest.id);
					removed.push(retired.active);
				}
			}
			this.local.clear();
			for (const entry of staged) this.local.set(entry.manifest.id, entry);
			for (const entry of staged) this.failures.delete(entry.manifest.id);
			for (const name of names) this.failures.delete(name);
			for (const failure of this.failures.keys()) if (failure !== "local" && !names.includes(failure)) this.failures.delete(failure);
			this.failures.delete("local");
			if (removed.length > 0) this.queueDisposal(removed);
			this.updateContentHash();
		} catch (error) {
			await abortAndDisposeLocal(stagedFresh);
			if (this.localClosed || signal.aborted) return;
			const message = error instanceof Error ? error.message : String(error);
			const changedFailure = this.failures.get(failingName) !== message;
			this.failures.set(failingName, message);
			if (changedFailure && error instanceof MobileExtensionError && error.code === "extension_worker_heap_override") this.ctx.logger.warn("local extension worker refused: %s", error.message);
			if (!(error instanceof MobileExtensionError)) this.ctx.logger.warn(error instanceof Error ? error : new Error(String(error)));
		}
	}
	retire(active) {
		const previous = this.retired.get(active.manifest.id);
		if (previous?.active === active) return;
		if (previous !== void 0) {
			clearTimeout(previous.timer);
			this.retired.delete(active.manifest.id);
			this.queueDisposal([previous.active]);
		}
		const timer = setTimeout(() => {
			if (this.retired.get(active.manifest.id)?.active !== active) return;
			this.retired.delete(active.manifest.id);
			this.queueDisposal([active]);
		}, RETIRED_GENERATION_TTL_MS);
		timer.unref();
		this.retired.set(active.manifest.id, {
			active,
			timer
		});
	}
};
function isReadable(value) {
	return value !== null && typeof value === "object" && typeof value.pipe === "function";
}
/** Destroy a route response that arrived after its caller detached; must never throw or emit unhandled stream errors. */
function disposeLateExtensionResponse(value) {
	try {
		if (value === null || typeof value !== "object") return;
		const body = value.body;
		if (!isReadable(body) || typeof body.once !== "function" || typeof body.destroy !== "function") return;
		body.once("error", () => void 0);
		body.destroy();
	} catch {}
}
function releaseSignalLifetimeWhenStreamSettles(stream, cleanup) {
	let stopObserving;
	stopObserving = finished(stream, () => {
		stopObserving?.();
		cleanup();
	});
}
function invokeCleanups(cleanups) {
	const pending = [];
	for (const cleanup of [...cleanups].reverse()) try {
		pending.push(Promise.resolve(cleanup()));
	} catch {}
	return pending;
}
async function settleBounded(pending, timeoutMs) {
	if (pending.length === 0) return;
	let timer;
	await Promise.race([Promise.allSettled(pending), new Promise((resolveTimeout) => {
		timer = setTimeout(resolveTimeout, timeoutMs);
	})]);
	if (timer !== void 0) clearTimeout(timer);
}
/** Sentinel distinguishing caller detachment (deadline or external cancel) from a host error. */
var OperationCancelled = class {
	reason;
	constructor(reason) {
		this.reason = reason;
	}
};
function startBoundedOperation(start, options) {
	const deadline = new AbortController();
	const combined = options.external === void 0 ? {
		signal: deadline.signal,
		cleanup: () => void 0
	} : combineSignalLifetime(options.external, deadline.signal);
	let detached = false;
	let workState;
	let lateFulfilled;
	let notifySettled;
	let callerTimer;
	let onExternal;
	const settled = new Promise((resolve) => {
		notifySettled = resolve;
	});
	const detach = (reject, reason) => {
		if (detached || workState !== void 0) return;
		detached = true;
		if (callerTimer !== void 0) clearTimeout(callerTimer);
		if (onExternal !== void 0) options.external?.removeEventListener("abort", onExternal);
		options.onDetach?.();
		deadline.abort(reason);
		reject(new OperationCancelled(reason));
	};
	const caller = new Promise((resolve, reject) => {
		callerTimer = setTimeout(() => detach(reject, options.timeoutError()), options.timeoutMs);
		onExternal = () => {
			detach(reject, combined.signal.reason);
		};
		options.external?.addEventListener("abort", onExternal, { once: true });
		(async () => {
			try {
				const value = await start(combined.signal);
				workState = "fulfilled";
				if (callerTimer !== void 0) clearTimeout(callerTimer);
				if (onExternal !== void 0) options.external?.removeEventListener("abort", onExternal);
				if (detached) combined.cleanup();
				if (detached) lateFulfilled = value;
				else resolve(value);
				notifySettled?.();
			} catch (error) {
				workState = "rejected";
				if (callerTimer !== void 0) clearTimeout(callerTimer);
				if (onExternal !== void 0) options.external?.removeEventListener("abort", onExternal);
				if (detached) combined.cleanup();
				if (!detached) reject(error);
				notifySettled?.();
			}
		})();
	});
	let released = false;
	return {
		caller,
		settled,
		detached: () => detached,
		lateValue: () => detached && workState === "fulfilled" ? lateFulfilled : void 0,
		release: () => {
			if (!released) {
				released = true;
				combined.cleanup();
			}
		}
	};
}
async function abortAndDisposeLocal(entries) {
	const pending = [];
	for (const entry of entries) {
		entry.controller.abort();
		pending.push(...invokeCleanups(entry.cleanups));
	}
	await settleBounded(pending, HOST_TEARDOWN_TIMEOUT_MS);
	await Promise.all(entries.flatMap((entry) => entry.worker === void 0 ? [] : [entry.worker.dispose()]));
}
async function loadLocalExtension(directory, context, known, parentSignal, execution) {
	const root = await realExtensionRoot(directory);
	const manifestFile = await regularFile$3(join(root, "extension.json"), EXTENSION_LIMITS.manifest, "extension.json");
	const manifest = known?.manifest ?? parseExtensionManifest(JSON.parse(await readFile(manifestFile.path, "utf8")));
	if (manifest.id !== basename(root)) throw new MobileExtensionError("invalid_manifest", "extension id must match its directory name");
	const scriptBody = known === void 0 ? await optionalFile(root, "mobile.js", EXTENSION_LIMITS.script, "mobile.js").then((path) => path === void 0 ? void 0 : readFile(path)) : known.scriptBody;
	const styleBody = known === void 0 ? await optionalFile(root, "mobile.css", EXTENSION_LIMITS.css, "mobile.css").then((path) => path === void 0 ? void 0 : readFile(path)) : known.styleBody;
	const assets = known?.assets ?? await assetSnapshot(root);
	const hostFile = await optionalFile(root, "host.mjs", EXTENSION_LIMITS.script, "host.mjs");
	const controller = new AbortController();
	const actions = {};
	const routes = [];
	const cleanups = [];
	const pendingEffects = [];
	let activationOpen = true;
	const onParentAbort = () => {
		controller.abort(parentSignal?.reason);
	};
	if (parentSignal?.aborted === true) onParentAbort();
	else parentSignal?.addEventListener("abort", onParentAbort, { once: true });
	const ensureActivationOpen = () => {
		if (!activationOpen || controller.signal.aborted) throw new MobileExtensionError("host_activation_closed", `extension ${manifest.id} activation is closed`, 409);
	};
	const api = {
		manifest,
		context,
		schema: z,
		signal: controller.signal,
		action(name, spec) {
			ensureActivationOpen();
			if (actions[name] !== void 0) throw new MobileExtensionError("duplicate_action", `duplicate action ${name}`);
			actions[name] = spec;
		},
		route(spec) {
			ensureActivationOpen();
			routes.push(spec);
		},
		effect(setup) {
			ensureActivationOpen();
			const result = setup();
			if (result instanceof Promise) pendingEffects.push(result.then(async (cleanup) => {
				if (typeof cleanup !== "function") return;
				if (activationOpen) cleanups.push(cleanup);
				else await cleanup();
			}));
			else if (typeof result === "function") {
				if (activationOpen) cleanups.push(result);
				else Promise.resolve(result()).catch(() => void 0);
			}
		}
	};
	try {
		const limits = resolveHostExecution(execution?.hostExecution);
		const worker = limits.mode === "worker" && (limits.extensions === void 0 || limits.extensions.includes(manifest.id)) && hostFile !== void 0 ? new ExtensionWorkerHost({
			workerModule: execution?.hostExecution?.workerModule ?? defaultExtensionWorkerModule(),
			hostFile,
			manifest,
			generation: known?.digest ?? createHash("sha256").update(manifest.id).digest("hex"),
			logger: workerLoggerAdapter(context),
			limits,
			...execution?.workerBudget === void 0 ? {} : { budget: execution.workerBudget },
			onUnavailable: (error) => {
				controller.abort(error);
			}
		}) : void 0;
		let host;
		if (worker !== void 0) {
			try {
				await withActivationTimeout(worker.activate(), manifest.id, controller.signal);
			} catch (error) {
				await worker.terminate("activation-failed");
				throw error;
			}
			const proxyActions = {};
			for (const metadata of worker.actionMetadata()) proxyActions[metadata.name] = {
				...metadata.timeoutMs === void 0 ? {} : { timeoutMs: metadata.timeoutMs },
				run: (actionContext, input) => worker.invokeExecution(metadata.name, input, actionContext)
			};
			const proxyRoutes = worker.routeMetadata().map((metadata, index) => ({
				method: metadata.method,
				path: metadata.path,
				...metadata.kind === void 0 ? {} : { kind: metadata.kind },
				...metadata.timeoutMs === void 0 ? {} : { timeoutMs: metadata.timeoutMs },
				handle: (request) => worker.handleRouteExecution(index, request)
			}));
			try {
				host = validateDefinition({
					...manifest,
					...Object.keys(proxyActions).length === 0 ? {} : { actions: proxyActions },
					...proxyRoutes.length === 0 ? {} : { routes: proxyRoutes }
				});
			} catch (error) {
				await worker.terminate("definition-invalid");
				throw error;
			}
		} else {
			const activate = async () => {
				controller.signal.throwIfAborted();
				if (hostFile !== void 0) {
					const digest = createHash("sha256").update(await readFile(hostFile)).digest("hex");
					controller.signal.throwIfAborted();
					let imported;
					try {
						imported = await import(`${pathToFileURL(hostFile).href}?dsh_generation=${digest}`);
					} catch {
						throw new MobileExtensionError("host_load_failed", `could not load ${manifest.id}/host.mjs`, 500);
					}
					controller.signal.throwIfAborted();
					if (imported.default !== void 0) await imported.default(api);
				}
				await Promise.all(pendingEffects);
			};
			await withActivationTimeout(activate(), manifest.id, controller.signal);
			host = validateDefinition({
				...manifest,
				actions,
				routes
			});
		}
		activationOpen = false;
		const digest = known?.digest ?? createHash("sha256").update(manifest.id).digest("hex");
		return Object.freeze({
			manifest,
			directory: root,
			...scriptBody === void 0 ? {} : { scriptBody },
			...styleBody === void 0 ? {} : { styleBody },
			assets,
			host,
			controller,
			cleanups: Object.freeze(cleanups),
			digest,
			...worker === void 0 ? {} : { worker }
		});
	} catch (error) {
		activationOpen = false;
		controller.abort();
		const cleanupPromises = invokeCleanups(cleanups.splice(0));
		await settleBounded([...pendingEffects, ...cleanupPromises], HOST_TEARDOWN_TIMEOUT_MS);
		throw error;
	} finally {
		parentSignal?.removeEventListener("abort", onParentAbort);
	}
}
/** Forward the worker's logger-only context adapter into the plugin logger. */
function workerLoggerAdapter(context) {
	return {
		debug: (...args) => {
			context.logger.debug(...args);
		},
		info: (...args) => {
			context.logger.info(...args);
		},
		warn: (...args) => {
			context.logger.warn(...args);
		},
		error: (...args) => {
			context.logger.error(...args);
		}
	};
}
/** Construct the service in a Cordis plugin without importing DSH internals. */
function createMobileAccessService(ctx) {
	return new MobileAccessService(ctx);
}
//#endregion
//#region src/auth-pages.ts
const COPY = {
	en: {
		lang: "en",
		pairTitle: "Pair DSH mobile access",
		pairHeading: "Pair this device",
		pairingCode: "Pairing code",
		deviceName: "Device name",
		pair: "Pair",
		pairing: "Pairing…",
		pairFailed: "Pairing failed",
		unavailable: "The computer is unavailable.",
		reconnectTitle: "Reconnect DSH mobile access",
		reconnectHeading: "Reconnect this device",
		restoring: "Restoring the secure Session…",
		noLongerPaired: "This device is no longer paired. Open pairing on the computer, then pair it again.",
		openPairing: "Open pairing"
	},
	zh: {
		lang: "zh-CN",
		pairTitle: "配对 DSH 移动访问",
		pairHeading: "配对此设备",
		pairingCode: "配对码",
		deviceName: "设备名称",
		pair: "配对",
		pairing: "正在配对…",
		pairFailed: "配对失败",
		unavailable: "电脑当前不可用。",
		reconnectTitle: "重新连接 DSH 移动访问",
		reconnectHeading: "重新连接此设备",
		restoring: "正在恢复安全会话…",
		noLongerPaired: "此设备已不在配对列表中。请在电脑端打开配对，然后重新配对。",
		openPairing: "打开配对页面"
	},
	it: {
		lang: "it-IT",
		pairTitle: "Abbina accesso mobile DSH",
		pairHeading: "Abbina questo dispositivo",
		pairingCode: "Codice di abbinamento",
		deviceName: "Nome dispositivo",
		pair: "Abbina",
		pairing: "Abbinamento…",
		pairFailed: "Abbinamento non riuscito",
		unavailable: "Il computer non è disponibile.",
		reconnectTitle: "Riconnetti accesso mobile DSH",
		reconnectHeading: "Riconnetti questo dispositivo",
		restoring: "Ripristino della sessione sicura…",
		noLongerPaired: "Questo dispositivo non è più abbinato. Apri l’abbinamento sul computer e ripeti la procedura.",
		openPairing: "Apri abbinamento"
	}
};
/** Choose Chinese, Italian, or English from an HTTP Accept-Language header. */
function resolveAuthPageLocale(header) {
	const values = header?.split(",").map((value, index) => {
		const [language, ...parameters] = value.split(";");
		const quality = parameters.find((parameter) => parameter.trim().toLowerCase().startsWith("q="));
		const parsedQuality = quality === void 0 ? 1 : Number(quality.trim().slice(2));
		return {
			language: language?.trim().toLowerCase() ?? "",
			quality: Number.isFinite(parsedQuality) ? Math.max(0, Math.min(1, parsedQuality)) : 0,
			index
		};
	}).filter((value) => value.quality > 0).sort((left, right) => right.quality - left.quality || left.index - right.index).map((value) => value.language) ?? [];
	for (const value of values) {
		if (value.startsWith("zh")) return "zh";
		if (value.startsWith("it")) return "it";
		if (value.startsWith("en")) return "en";
	}
	return "en";
}
/** Render the browser pairing form without reflecting request data into HTML. */
function renderPairPage(locale) {
	const copy = COPY[locale];
	return `<!doctype html>
<html lang="${copy.lang}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>input,textarea{font-size:16px}</style>
<title>${copy.pairTitle}</title>
<main>
  <h1>${copy.pairHeading}</h1>
  <form id="pair-form">
    <label>${copy.pairingCode} <input id="pair-token" autocomplete="one-time-code" required></label>
    <label>${copy.deviceName} <input id="device-label" maxlength="64" autocomplete="off"></label>
    <button type="submit">${copy.pair}</button>
    <output id="pair-status" aria-live="polite"></output>
  </form>
</main>
<script src="/mobile-access/pair.js" defer><\/script>
</html>
`;
}
/** Render the pairing form script with locale-owned status messages. */
function renderPairScript(locale) {
	const copy = COPY[locale];
	return `(() => {
  const form = document.getElementById('pair-form')
  const token = document.getElementById('pair-token')
  const label = document.getElementById('device-label')
  const status = document.getElementById('pair-status')
  const fragment = new URLSearchParams(location.hash.slice(1))
  const supplied = fragment.get('token')
  history.replaceState(null, '', location.pathname)
  if (supplied) token.value = supplied
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    status.value = ${JSON.stringify(copy.pairing)}
    try {
      const response = await fetch('/mobile-access/auth/pair', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: token.value, label: label.value || undefined }),
      })
      if (!response.ok) {
        status.value = ${JSON.stringify(copy.pairFailed)}
        return
      }
      location.replace('/')
    } catch {
      status.value = ${JSON.stringify(copy.unavailable)}
    }
  })
})()
`;
}
/** Render the browser reauthentication page. */
function renderLoginPage(locale) {
	const copy = COPY[locale];
	return `<!doctype html>
<html lang="${copy.lang}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${copy.reconnectTitle}</title>
<main>
  <h1>${copy.reconnectHeading}</h1>
  <p id="login-progress" aria-live="polite">${copy.restoring}</p>
  <section id="login-failed" hidden>
    <p>${copy.noLongerPaired}</p>
    <a href="/mobile-access/pair">${copy.openPairing}</a>
  </section>
</main>
<script src="/mobile-access/login.js" defer><\/script>
</html>
`;
}
/** Render the reauthentication script with locale-owned failure text. */
function renderLoginScript(locale) {
	const copy = COPY[locale];
	return `(() => {
  const candidate = new URL(location.href).searchParams.get('return')
  let returnPath = '/'
  if (candidate && candidate.startsWith('/')) {
    try {
      const resolved = new URL(candidate, location.origin)
      const pathname = decodeURIComponent(resolved.pathname)
      if (resolved.origin === location.origin && pathname !== '/mobile-access'
        && !pathname.startsWith('/mobile-access/') && !pathname.includes('\\\\')) {
        returnPath = resolved.pathname + resolved.search + resolved.hash
      }
    } catch {
      // Malformed untrusted return targets keep the safe root default.
    }
  }
  fetch('/mobile-access/auth/renew', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  }).then((response) => {
    if (response.ok) {
      location.replace(returnPath)
      return
    }
    document.getElementById('login-progress').hidden = true
    document.getElementById('login-failed').hidden = false
  }).catch(() => {
    document.getElementById('login-progress').textContent = ${JSON.stringify(copy.unavailable)}
  })
})()
`;
}
//#endregion
//#region src/gateway.ts
const MAX_CONTROL_BODY_BYTES = 16384;
const MAX_HEADER_BYTES = 16384;
const DISCOVERY_QUERY = Buffer.from("DSH_MOBILE_DISCOVER_V1", "ascii");
const DISCOVERY_PROTOCOL = 1;
const DISCOVERY_INTERVAL_MS = 3e3;
const MDNS_SERVICE_TYPE = "dsh-mobile";
const MOBILE_LAYOUT_MODULE = "@deepseek-ai/dsh-client-ui-layout";
const MOBILE_LAYOUT_PATH = `${AUTH_PREFIX}/mobile-layout.js`;
const MOBILE_BOOT_BATCH_PREFIX = `${AUTH_PREFIX}/mobile-boot/`;
const MAX_MOBILE_BOOT_BATCH_BYTES = 33554432;
const MAX_MOBILE_BOOT_ENTRY_BYTES = 8388608;
/**
* Per-merged-batch byte budget. One upstream application batch can carry dozens
* of client bundles whose combined size exceeds the hard batch cap; the layout
* batch is therefore chunked into multiple merged batches, each kept safely
* below {@link MAX_MOBILE_BOOT_BATCH_BYTES} so assembly can never reject it.
*/
const MOBILE_BOOT_CHUNK_BYTES = 16777216;
/** Bytes the assembly emits after each entry (`body` plus `\n;\n`). */
const MOBILE_BOOT_SEPARATOR_BYTES = 3;
/** Freshness window for cached upstream bundle byte sizes. */
const MOBILE_BOOT_SIZE_CACHE_TTL_MS = 3e4;
/** Marker header distinguishing size probes from ordinary proxied bundle fetches. */
const MOBILE_BOOT_SIZE_PROBE_HEADER = "x-dsh-mobile-size-probe";
const MAX_MOBILE_BOOT_BATCHES = 8;
const MOBILE_BOOT_UPSTREAM_ATTEMPTS = 4;
const MOBILE_BOOT_RETRY_DELAY_MS = 150;
function upstreamPluginBundleUrl(source, upstreamOrigin) {
	if (!source.startsWith("/plugins/") && !source.startsWith("plugins/") || source.includes("#")) return void 0;
	try {
		const target = new URL(source, new URL("/", upstreamOrigin));
		if (target.origin !== upstreamOrigin.origin || !target.pathname.startsWith("/plugins/")) return void 0;
		return target;
	} catch {
		return;
	}
}
const TRANSIENT_UPSTREAM_ERROR_CODES = /* @__PURE__ */ new Set([
	"EAI_AGAIN",
	"ECONNABORTED",
	"ECONNREFUSED",
	"ECONNRESET",
	"EPIPE",
	"EHOSTUNREACH",
	"ENETDOWN",
	"ENETRESET",
	"ENETUNREACH",
	"ETIMEDOUT",
	"ERR_STREAM_PREMATURE_CLOSE"
]);
const UPSTREAM_AUTH_REFRESH_MARGIN_MS = 6e4;
const UPSTREAM_COOKIE_PAIR = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+=[\x21-\x3A\x3C-\x7E]*$/u;
const CUSTOM_STYLE_FALLBACK = "/* Add mobile overrides in the DSH home mobile-access/mobile.css file. */\n";
const CUSTOM_SCRIPT_FALLBACK = "window.dshMobile?.register(() => undefined)\n";
const EXTENSION_CHANGE_POLL_MS = 2e3;
const EXTENSION_EVENT_HEARTBEAT_MS = 15e3;
const MOBILE_CLIENT_MODULE = "dsh-mobile";
const CONNECTION_MODULE = "@deepseek-ai/dsh-client-connection";
const RUNTIME_MODULE = "@deepseek-ai/dsh-client-runtime";
const RENDERER_MODULE = "@deepseek-ai/dsh-client-ui-renderer";
const SIDEBAR_MODULE = "@deepseek-ai/dsh-client-ui-sidebar";
const SETTINGS_MODULE = "@deepseek-ai/dsh-client-ui-settings";
const API_GATEWAY_MODULE = "@deepseek-ai/dsh-api-gateway";
const API_REMOTES_MODULE = "@deepseek-ai/dsh-api-remotes";
const MOBILE_BOOT_CORE_MODULES = /* @__PURE__ */ new Set([
	MOBILE_CLIENT_MODULE,
	MOBILE_LAYOUT_MODULE,
	CONNECTION_MODULE,
	RUNTIME_MODULE,
	RENDERER_MODULE,
	SIDEBAR_MODULE,
	SETTINGS_MODULE,
	API_GATEWAY_MODULE,
	API_REMOTES_MODULE
]);
const MOBILE_LAYOUT_DEPENDENCY_PROFILES = Object.freeze([Object.freeze({
	slots: RUNTIME_MODULE,
	dependencies: Object.freeze([RUNTIME_MODULE, "@deepseek-ai/dsh-client-ui-theme"])
}), Object.freeze({
	slots: RENDERER_MODULE,
	dependencies: Object.freeze([
		"@deepseek-ai/dsh-client-locale",
		RENDERER_MODULE,
		"@deepseek-ai/dsh-client-ui-session",
		"@deepseek-ai/dsh-client-ui-theme"
	])
})]);
function mobileCsrfFetchBootstrap(cookieName) {
	return `(()=>{const nativeFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const source=input instanceof Request?input:undefined;const method=String(init?.method??source?.method??'GET').toUpperCase();if(method==='GET'||method==='HEAD')return nativeFetch(input,init);const raw=typeof input==='string'?input:input instanceof URL?input.href:source?.url;if(raw===undefined||new URL(raw,location.href).origin!==location.origin)return nativeFetch(input,init);const headers=new Headers(init?.headers??source?.headers);if(!headers.has(${JSON.stringify(CSRF_HEADER)})){const prefix=${JSON.stringify(`${cookieName}=`)};const values=[...new Set(document.cookie.split(';').map(value=>value.trim()).filter(value=>value.startsWith(prefix)).map(value=>value.slice(prefix.length)))];if(values.length===1)headers.set(${JSON.stringify(CSRF_HEADER)},values[0])}return nativeFetch(input,{...init,headers})};})();`;
}
const MOBILE_AUTHENTICATED_TRANSPORT_BOOTSTRAP = `(()=>{if(window.__DSH_TRANSPORT__!==undefined)throw new Error('DSH Mobile cannot replace an existing transport override');window.__DSH_TRANSPORT__={fetch:(input,init)=>window.fetch(input,init),ownsHost:true},window.__DSH_FILE_UPLOAD__={fetch:(input,init)=>window.fetch(input,init)}})();`;
/** Use this page's gateway health, rather than OS internet validation, for DSH reconnects. */
const MOBILE_GATEWAY_REACHABILITY_BOOTSTRAP = `(()=>{
  const view=globalThis;
  const port=view.navigator;
  const nativeFetch=typeof view.fetch==='function'?view.fetch.bind(view):undefined;
  let reachable=true;
  let checking=false;
  let replaying=false;
  let disposed=false;
  let epoch=0;
  let retryTimer;
  let activeController;
  const clearRetry=()=>{if(retryTimer!==undefined){view.clearTimeout(retryTimer);retryTimer=undefined}};
  const scheduleRetry=()=>{if(!disposed&&!reachable&&retryTimer===undefined){retryTimer=view.setTimeout(()=>{retryTimer=undefined;check()},5000)}};
  const check=()=>{
    if(checking||disposed||nativeFetch===undefined)return;
    checking=true;
    const current=++epoch;
    const controller=new AbortController();
    activeController=controller;
    const timer=view.setTimeout(()=>controller.abort(),2000);
    void nativeFetch('/mobile-access/health',{cache:'no-store',credentials:'same-origin',signal:controller.signal})
      .then(response=>response.ok,()=>false)
      .then(ok=>{
        if(disposed||current!==epoch)return;
        if(ok){
          const wasOffline=!reachable;
          reachable=true;
          clearRetry();
          if(wasOffline)view.dispatchEvent(new Event('online'));
          return;
        }
        const wasOnline=reachable;
        reachable=false;
        if(wasOnline){
          replaying=true;
          try{view.dispatchEvent(new Event('offline'))}finally{replaying=false}
        }
        scheduleRetry();
      })
      .finally(()=>{view.clearTimeout(timer);activeController=undefined;checking=false});
  };
  if(port!==undefined&&typeof Object.defineProperty==='function'){
    try{Object.defineProperty(port,'onLine',{configurable:true,get:()=>reachable})}catch{/* A frozen navigator retains its native value. */}
  }
  if(typeof view.addEventListener==='function'){
    view.addEventListener('offline',event=>{if(replaying||nativeFetch===undefined)return;event.stopImmediatePropagation();check()},true);
    view.addEventListener('online',()=>{++epoch;reachable=true;clearRetry()},true);
    view.addEventListener('pagehide',()=>{disposed=true;++epoch;clearRetry();activeController?.abort()},true);
  }
})();`;
const gzipBuffer = promisify(gzip);
function ensureMobileViewport(html) {
	const match = /<meta\b(?=[^>]*\bname\s*=\s*["']viewport["'])[^>]*>/iu.exec(html);
	if (match === null) {
		const head = /<head\b[^>]*>/iu.exec(html);
		if (head?.index === void 0) return html;
		const position = head.index + head[0].length;
		return `${html.slice(0, position)}<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${html.slice(position)}`;
	}
	if (/\bviewport-fit\s*=\s*cover\b/iu.test(match[0])) return html;
	const content = /\bcontent\s*=\s*(["'])(.*?)\1/iu;
	const next = content.test(match[0]) ? match[0].replace(content, (_whole, quote, value) => `content=${quote}${value},viewport-fit=cover${quote}`) : match[0].replace(/\s*\/?>$/u, " content=\"width=device-width,initial-scale=1,viewport-fit=cover\">");
	return `${html.slice(0, match.index)}${next}${html.slice(match.index + match[0].length)}`;
}
function orderAuthenticatedSettings(entries, slotsProvider) {
	const mobile = entries.filter((entry) => entry !== null && typeof entry === "object" && entry.id === MOBILE_CLIENT_MODULE);
	const settings = entries.filter((entry) => entry !== null && typeof entry === "object" && entry.id === SETTINGS_MODULE);
	if (mobile.length === 0 || settings.length === 0) return false;
	if (mobile.length !== 1 || settings.length !== 1) throw new Error("upstream DSH mobile settings graph is ambiguous");
	if (!Array.isArray(mobile[0]?.inject) || !mobile[0].inject.includes(CONNECTION_MODULE) || !mobile[0].inject.includes(SIDEBAR_MODULE)) throw new Error("dsh-mobile client has unsupported dependencies");
	if (!Array.isArray(settings[0]?.inject)) throw new Error("upstream DSH settings module has unsupported dependencies");
	const remoteSettings = !settings[0].inject.includes(CONNECTION_MODULE);
	if (remoteSettings) {
		if (!settings[0].inject.includes(API_REMOTES_MODULE) || slotsProvider !== RENDERER_MODULE) throw new Error("upstream DSH settings module has unsupported dependencies");
		const remotes = entries.filter((entry) => entry !== null && typeof entry === "object" && entry.id === API_REMOTES_MODULE);
		const gateway = entries.filter((entry) => entry !== null && typeof entry === "object" && entry.id === API_GATEWAY_MODULE);
		if (remotes.length !== 1 || !Array.isArray(remotes[0]?.inject) || !remotes[0].inject.includes(API_GATEWAY_MODULE) || gateway.length !== 1 || !Array.isArray(gateway[0]?.inject) || !gateway[0].inject.includes(CONNECTION_MODULE)) throw new Error("upstream DSH settings Remote graph has unsupported dependencies");
		if (!gateway[0].inject.includes(MOBILE_CLIENT_MODULE)) gateway[0].inject = [...gateway[0].inject, MOBILE_CLIENT_MODULE];
	}
	mobile[0].inject = [CONNECTION_MODULE, slotsProvider];
	if (!settings[0].inject.includes(MOBILE_CLIENT_MODULE)) settings[0].inject = [...settings[0].inject, MOBILE_CLIENT_MODULE];
	return remoteSettings;
}
function revisionedMobileBatchPath(entries) {
	const key = createHash("sha256").update(DSH_MOBILE_VERSION).update(JSON.stringify(entries)).digest("hex");
	return {
		key,
		path: `${MOBILE_BOOT_BATCH_PREFIX}${key}.js`
	};
}
var ExcludedClientModulesError = class extends Error {
	constructor(message) {
		super(`excludedClientModules: ${message}`);
	}
};
/** A graph-selection conflict with a bounded diagnostic safe for authenticated callers. */
var ClientModuleConflictError = class extends HttpError {
	detail;
	constructor(detail) {
		super(409, "excluded_client_modules_invalid");
		this.detail = detail.replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/(?:https?:\/\/|[a-z]:[\\/])\S+/giu, "[redacted]").slice(0, 512);
	}
};
function requiredClientModule(entry, phase) {
	return MOBILE_BOOT_CORE_MODULES.has(entry.id) || entry.immediately === true || phase !== "application";
}
function clientModuleDependencies(entry) {
	const dependencies = /* @__PURE__ */ new Set();
	for (const [field, edges] of [["inject", entry.inject], ["external", entry.external]]) {
		if (edges !== void 0 && (!Array.isArray(edges) || edges.some((id) => typeof id !== "string"))) throw new ExcludedClientModulesError(`upstream module ${entry.id} has malformed ${field} dependencies`);
		for (const dependency of edges ?? []) dependencies.add(dependency.endsWith("/client") ? dependency.slice(0, -7) : dependency);
	}
	return Object.freeze([...dependencies]);
}
function clientModulePhases(entries, batches) {
	const phases = /* @__PURE__ */ new Map();
	for (const batch of batches) for (const id of batch.entries) {
		if (phases.has(id)) throw new ExcludedClientModulesError(`upstream module ${id} belongs to multiple batches`);
		phases.set(id, batch.phase);
	}
	for (const entry of entries) if (!phases.has(entry.id)) throw new ExcludedClientModulesError(`upstream module ${entry.id} belongs to no batch`);
	return phases;
}
/** Read only installed module ids and declared edges from the same boot parser used for serving. */
function describeMobileClientModules(html) {
	const plan = parseMobileBootPlan(html);
	const ids = new Set(plan.entries.map((entry) => entry.id));
	const phases = plan.batches === void 0 ? /* @__PURE__ */ new Map() : clientModulePhases(plan.entries, plan.batches);
	return Object.freeze(plan.entries.map((entry) => Object.freeze({
		id: entry.id,
		required: requiredClientModule(entry, phases.get(entry.id)),
		dependencies: Object.freeze(clientModuleDependencies(entry).filter((id) => ids.has(id)))
	})));
}
/** Validate graph edges before removing application rows from both manifest views. */
function excludeMobileBootEntries(entries, batches, excludedIds) {
	if (excludedIds.length === 0) return;
	const excluded = new Set(excludedIds);
	if (excluded.size !== excludedIds.length) throw new ExcludedClientModulesError("duplicate module ids");
	const byId = new Map(entries.map((entry) => [entry.id, entry]));
	const phases = clientModulePhases(entries, batches);
	for (const id of excluded) {
		const entry = byId.get(id);
		if (entry === void 0) throw new ExcludedClientModulesError(`module ${id} is not installed in this DSH client graph`);
		if (requiredClientModule(entry, phases.get(id))) throw new ExcludedClientModulesError(`module ${id} is required for mobile boot or belongs to a bootstrap batch`);
	}
	for (const entry of entries) {
		if (excluded.has(entry.id)) continue;
		for (const packageId of clientModuleDependencies(entry)) if (excluded.has(packageId)) throw new ExcludedClientModulesError(`module ${entry.id} still depends on excluded module ${packageId}; exclude the dependent too or keep ${packageId}`);
	}
	entries.splice(0, entries.length, ...entries.filter((entry) => !excluded.has(entry.id)));
	for (const batch of batches) batch.entries = batch.entries.filter((id) => !excluded.has(id));
	batches.splice(0, batches.length, ...batches.filter((batch) => batch.entries.length > 0));
}
/**
* Parse one upstream boot manifest and rewire the layout entry onto the
* gateway-owned layout module. Optional exclusions remove application entries
* and identify every affected batch for reassembly. The dedicated frontend is
* authenticated in the gateway, so the layout needs no upstream address.
*/
function parseMobileBootPlan(html, excludedClientModules = []) {
	const assignment = /(?:window\.__DSH_BOOT__|globalThis\["__DSH_BOOT__"\])\s*=\s*/u.exec(html);
	if (assignment?.index === void 0) throw new Error("upstream DSH index has no boot manifest");
	const replaceStart = assignment.index;
	const valueStart = replaceStart + assignment[0].length;
	const scriptEnd = html.indexOf("<\/script>", valueStart);
	if (scriptEnd < 0) throw new Error("upstream DSH boot manifest script is incomplete");
	const source = html.slice(valueStart, scriptEnd).trim().replace(/;$/u, "");
	const parsed = JSON.parse(source);
	if (typeof parsed.rev !== "string" || !Array.isArray(parsed.entries)) throw new Error("upstream DSH boot manifest is malformed");
	const entries = parsed.entries;
	const layout = entries.filter((entry) => entry !== null && typeof entry === "object" && entry.id === MOBILE_LAYOUT_MODULE);
	if (layout.length !== 1 || typeof layout[0]?.url !== "string" || typeof layout[0].rev !== "string") throw new Error("upstream DSH boot manifest has no unique layout module");
	if (!Array.isArray(layout[0].inject)) throw new Error("upstream DSH layout module has unsupported dependencies");
	const dependencyProfile = MOBILE_LAYOUT_DEPENDENCY_PROFILES.find((profile) => profile.dependencies.every((dependency) => layout[0]?.inject?.includes(dependency)));
	if (dependencyProfile === void 0) throw new Error("upstream DSH layout module has unsupported dependencies");
	layout[0].url = MOBILE_LAYOUT_PATH;
	layout[0].rev = `dsh-mobile-layout-${DSH_MOBILE_VERSION}`;
	const parsedBatches = parsed.batches;
	if (parsedBatches === void 0) {
		if (excludedClientModules.length > 0) throw new ExcludedClientModulesError("this DSH version has no batched boot manifest; disable exclusions or update DSH");
		return Object.freeze({
			parsed,
			entries,
			slotProvider: dependencyProfile.slots,
			assignment: assignment[0],
			replaceStart,
			replaceEnd: scriptEnd
		});
	}
	if (!Array.isArray(parsedBatches)) throw new Error("upstream DSH boot manifest batches are malformed");
	const batches = parsedBatches;
	const entryById = new Map(entries.map((entry) => [entry.id, entry]));
	if (entryById.size !== entries.length) throw new Error("upstream DSH boot manifest has duplicate entries");
	const layoutBatches = [];
	for (const batch of batches) {
		if (batch === null || typeof batch !== "object" || batch.phase !== "bootstrap" && batch.phase !== "application" || typeof batch.url !== "string" || typeof batch.rev !== "string" || !Array.isArray(batch.entries) || batch.entries.length === 0 || batch.entries.some((id) => typeof id !== "string" || !entryById.has(id))) throw new Error("upstream DSH boot manifest batches are malformed");
		if (batch.entries.includes(MOBILE_LAYOUT_MODULE)) layoutBatches.push(batch);
	}
	if (layoutBatches.length !== 1 || layoutBatches[0]?.phase !== "application") throw new Error("upstream DSH boot manifest has no unique application layout batch");
	const layoutBatch = layoutBatches[0];
	const originalApplicationBatches = batches.filter((batch) => batch.phase === "application").map((batch) => ({
		...batch,
		entries: [...batch.entries]
	}));
	excludeMobileBootEntries(entries, batches, excludedClientModules);
	const affectedBatchUrls = new Set(originalApplicationBatches.filter((batch) => batch.entries.some((id) => excludedClientModules.includes(id))).map((batch) => batch.url));
	const rewrittenBatchEntries = batches.filter((batch) => batch === layoutBatch || batch.phase === "application" && affectedBatchUrls.has(batch.url)).map((batch) => ({
		batch,
		entries: [...batch.entries].sort((left, right) => left < right ? -1 : left > right ? 1 : 0).map((id) => {
			const entry = entryById.get(id);
			if (entry === void 0 || typeof entry.url !== "string" || typeof entry.rev !== "string") throw new Error("upstream DSH boot manifest batches are malformed");
			return Object.freeze({
				id,
				url: entry.url,
				rev: entry.rev
			});
		})
	}));
	const planEntries = rewrittenBatchEntries.find((candidate) => candidate.batch === layoutBatch)?.entries;
	if (planEntries === void 0) throw new Error("upstream DSH boot manifest lost the application layout batch");
	return Object.freeze({
		parsed,
		entries,
		batches,
		slotProvider: dependencyProfile.slots,
		assignment: assignment[0],
		replaceStart,
		replaceEnd: scriptEnd,
		layoutBatch,
		planEntries,
		originalApplicationBatches,
		rewrittenBatchEntries
	});
}
/**
* Partition one upstream application batch into merged batches plus pass-through
* rows. Every entry whose bundle is at or above the per-entry cap keeps its own
* upstream `/plugins` row (the gateway proxies it verbatim), because a merged
* batch cannot carry it. The remaining entries are greedily packed into merged
* batches under {@link MOBILE_BOOT_CHUNK_BYTES}; the layout module always merges,
* since its body is the gateway-owned layout file, never an upstream fetch.
*/
function splitMobileBootBatch(entries, sizes, passThrough) {
	const rows = [];
	const plans = [];
	let chunk;
	const flush = () => {
		if (chunk === void 0 || chunk.entries.length === 0) return;
		const revision = revisionedMobileBatchPath(chunk.entries);
		rows.push({
			phase: "application",
			url: revision.path,
			rev: revision.key,
			entries: chunk.ids
		});
		plans.push(Object.freeze({
			key: revision.key,
			path: revision.path,
			entries: Object.freeze(chunk.entries)
		}));
		chunk = void 0;
	};
	for (const entry of entries) {
		const size = sizes.get(entry.url);
		if ((passThrough.has(entry.url) || size !== void 0 && size >= MAX_MOBILE_BOOT_ENTRY_BYTES) && entry.id !== MOBILE_LAYOUT_MODULE) {
			rows.push({
				phase: "application",
				url: entry.url,
				rev: entry.rev,
				entries: [entry.id]
			});
			continue;
		}
		const bytes = (size ?? 0) + MOBILE_BOOT_SEPARATOR_BYTES;
		if (chunk !== void 0 && chunk.entries.length > 0 && chunk.bytes + bytes > MOBILE_BOOT_CHUNK_BYTES) flush();
		chunk ??= {
			ids: [],
			entries: [],
			bytes: 0
		};
		chunk.ids.push(entry.id);
		chunk.entries.push(entry);
		chunk.bytes += bytes;
	}
	flush();
	return {
		plans,
		rows
	};
}
function escapeMobilePreloadAttribute(value) {
	return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function mobileApplicationPreload(url) {
	return `<link rel="preload" as="script" href="${escapeMobilePreloadAttribute(url)}">`;
}
function preloadAttribute(tag, name) {
	const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "iu").exec(tag);
	return match?.[1] ?? match?.[2];
}
/** Replace only DSH's application-script preloads; bootstrap and unrelated links are untouched. */
function rewriteMobileApplicationPreloads(html, replacements) {
	if (replacements.size === 0) return html;
	const escaped = new Map([...replacements].map(([url, markup]) => [escapeMobilePreloadAttribute(url), markup]));
	return html.replace(/<link\b[^>]*>/giu, (tag) => {
		if (!preloadAttribute(tag, "rel")?.split(/\s+/u).includes("preload") || preloadAttribute(tag, "as") !== "script") return tag;
		return escaped.get(preloadAttribute(tag, "href") ?? "") ?? tag;
	});
}
function rewriteMobileIndexWithBatch(html, options = {}) {
	const plan = parseMobileBootPlan(html, options.excludedClientModules);
	const remoteSettings = orderAuthenticatedSettings(plan.entries, plan.slotProvider);
	let batches = [];
	let preloadReplacements = /* @__PURE__ */ new Map();
	if (plan.batches !== void 0 && plan.rewrittenBatchEntries !== void 0) {
		const rewrites = plan.rewrittenBatchEntries.map(({ batch, entries }) => ({
			batch,
			split: splitMobileBootBatch(entries, options.sizes ?? /* @__PURE__ */ new Map(), options.passThrough ?? /* @__PURE__ */ new Set())
		}));
		if (rewrites.reduce((count, item) => count + item.split.plans.length, 0) > MAX_MOBILE_BOOT_BATCHES) throw new Error(`upstream DSH mobile boot requires more than ${String(MAX_MOBILE_BOOT_BATCHES)} merged batches`);
		for (const { batch, split } of rewrites) {
			const at = plan.batches.indexOf(batch);
			if (at < 0) throw new Error("upstream DSH boot manifest lost an application batch");
			plan.batches.splice(at, 1, ...split.rows);
			batches = [...batches, ...split.plans];
		}
		for (const original of plan.originalApplicationBatches ?? []) {
			const replacement = rewrites.find((item) => item.batch.url === original.url);
			preloadReplacements.set(original.url, replacement === void 0 ? plan.batches.some((batch) => batch.url === original.url) ? mobileApplicationPreload(original.url) : "" : replacement.split.rows.map((row) => mobileApplicationPreload(row.url)).join(""));
		}
		batches = Object.freeze(batches);
		plan.parsed.rev = createHash("sha256").update(JSON.stringify({
			entries: plan.entries,
			batches: plan.batches
		})).digest("hex").slice(0, 16);
	}
	const replacement = `${MOBILE_GATEWAY_REACHABILITY_BOOTSTRAP}${remoteSettings ? MOBILE_AUTHENTICATED_TRANSPORT_BOOTSTRAP : ""}${mobileCsrfFetchBootstrap(options.csrfCookie ?? "dsh_ma_csrf")}window.__DSH_MOBILE_FRONTEND__="dedicated";${plan.assignment}${JSON.stringify(plan.parsed)};`;
	const rewritten = `${html.slice(0, plan.replaceStart)}${replacement}${html.slice(plan.replaceEnd)}`;
	return Object.freeze({
		html: ensureMobileViewport(ensureMobileCompatibility(rewriteMobileApplicationPreloads(rewritten, preloadReplacements))),
		batches
	});
}
/** Rewrite the dedicated mobile graph; exclusions are opt-in and leave stock DSH unchanged. */
function rewriteMobileIndex(html, excludedClientModules = []) {
	return rewriteMobileIndexWithBatch(html, { excludedClientModules }).html;
}
var ByteLimitTransform = class extends Transform {
	maximum;
	total = 0;
	constructor(maximum) {
		super();
		this.maximum = maximum;
	}
	_transform(chunk, encoding, callback) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
		this.total += buffer.length;
		if (this.total > this.maximum) {
			callback(new HttpError(413, "payload_too_large"));
			return;
		}
		callback(null, buffer);
	}
};
function stripIpv6Brackets(hostname) {
	return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}
function parsePemCertificates(contents, source) {
	const text = contents.toString("utf8");
	const pattern = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/gu;
	const blocks = text.match(pattern) ?? [];
	if (blocks.length === 0 || text.replace(pattern, "").trim() !== "") throw new Error(`${source} must contain only PEM certificates`);
	return blocks.map((pem) => {
		let certificate;
		try {
			certificate = new X509Certificate(pem);
		} catch (error) {
			throw new Error(`${source} contains an invalid certificate`, { cause: error });
		}
		return Object.freeze({
			pem: `${pem}\n`,
			certificate
		});
	});
}
function validateServerChain(chain) {
	const now = Date.now();
	for (const [index, entry] of chain.entries()) {
		if (Date.parse(entry.certificate.validFrom) > now || Date.parse(entry.certificate.validTo) <= now) throw new Error("TLS certificate chain contains a certificate that is not currently valid");
		if (index === 0) continue;
		if (entry.certificate.subject === entry.certificate.issuer && entry.certificate.verify(entry.certificate.publicKey)) throw new Error("TLS server certificate chain must not include a self-signed root");
		const child = chain[index - 1].certificate;
		if (!entry.certificate.ca || !child.checkIssued(entry.certificate) || !child.verify(entry.certificate.publicKey)) throw new Error("TLS server certificate chain is not an ordered leaf-to-intermediate chain");
	}
}
async function tlsOptions(config) {
	if (config.tls.mode === "disabled") throw new Error("TLS options requested for a disabled listener");
	const [certFile, key, additionalChainFile] = await Promise.all([
		readFile(config.tls.certFile),
		readFile(config.tls.keyFile),
		config.tls.caFile === void 0 ? Promise.resolve(void 0) : readFile(config.tls.caFile)
	]);
	const chain = [...parsePemCertificates(certFile, "tls.certFile"), ...additionalChainFile === void 0 ? [] : parsePemCertificates(additionalChainFile, "tls.caFile")];
	validateServerChain(chain);
	const leaf = chain[0].certificate;
	for (const authority of config.authorities) {
		const hostname = stripIpv6Brackets(authority.hostname);
		if ((isIP(hostname) === 0 ? leaf.checkHost(hostname) : leaf.checkIP(hostname)) === void 0) throw new Error(`TLS certificate does not cover configured authority ${hostname}`);
	}
	return {
		cert: chain.map((entry) => entry.pem).join(""),
		key,
		requestCert: false,
		minVersion: "TLSv1.2",
		maxHeaderSize: MAX_HEADER_BYTES
	};
}
function websocketAccept(key) {
	return createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`, "ascii").digest("base64");
}
function headerValue(headers, name) {
	const value = headers[name];
	return Array.isArray(value) ? void 0 : value;
}
function hasToken(header, token) {
	return header?.split(",").some((value) => value.trim().toLowerCase() === token) ?? false;
}
function rejectUpgrade(socket, status, code) {
	if (socket.destroyed) return;
	const body = `${JSON.stringify({ error: code })}\n`;
	socket.end([
		`HTTP/1.1 ${String(status)} ${status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : "Bad Request"}`,
		"Connection: close",
		"Cache-Control: no-store",
		"Content-Type: application/json; charset=utf-8",
		"Referrer-Policy: no-referrer",
		"X-Content-Type-Options: nosniff",
		`Content-Length: ${String(Buffer.byteLength(body))}`,
		"",
		body
	].join("\r\n"));
}
function sanitizeRequestHeaders(request, upstream) {
	const headers = { host: upstream.host };
	if (request.headers.origin !== void 0) headers.origin = upstream.origin;
	if (request.headers["sec-fetch-site"] !== void 0) headers["sec-fetch-site"] = "same-origin";
	for (const name of [
		"accept",
		"accept-encoding",
		"accept-language",
		"content-encoding",
		"content-length",
		"content-type",
		"if-match",
		"if-modified-since",
		"if-none-match",
		"if-unmodified-since",
		"range",
		"user-agent"
	]) {
		const value = request.headers[name];
		if (value !== void 0) headers[name] = value;
	}
	return headers;
}
const BLOCKED_RESPONSE_HEADERS = /* @__PURE__ */ new Set([
	"alt-svc",
	"cache-control",
	"connection",
	"content-security-policy",
	"content-security-policy-report-only",
	"cross-origin-embedder-policy",
	"cross-origin-opener-policy",
	"cross-origin-resource-policy",
	"expires",
	"keep-alive",
	"nel",
	"permissions-policy",
	"pragma",
	"proxy-authenticate",
	"referrer-policy",
	"report-to",
	"reporting-endpoints",
	"server",
	"set-cookie",
	"strict-transport-security",
	"trailer",
	"transfer-encoding",
	"upgrade",
	"via",
	"x-content-type-options",
	"x-frame-options",
	"x-powered-by"
]);
function sanitizeResponseHeaders(headers, upstream) {
	const clean = {};
	for (const [name, value] of Object.entries(headers)) {
		const lower = name.toLowerCase();
		if (value === void 0 || BLOCKED_RESPONSE_HEADERS.has(lower) || lower.startsWith("access-control-")) continue;
		if (lower === "location" && typeof value === "string") {
			try {
				const location = new URL(value, upstream);
				clean.location = location.origin === upstream.origin ? `${location.pathname}${location.search}${location.hash}` : value;
			} catch {
				continue;
			}
			continue;
		}
		clean[lower] = value;
	}
	return clean;
}
function acceptsGzip(header) {
	if (header === void 0) return false;
	let wildcard;
	for (const entry of header.split(",")) {
		const [rawName, ...parameters] = entry.split(";");
		const name = rawName?.trim().toLowerCase();
		if (name === void 0 || name === "") continue;
		let quality = 1;
		for (const parameter of parameters) {
			const match = /^\s*q\s*=\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*$/iu.exec(parameter);
			if (match !== null) quality = Number(match[1]);
		}
		if (name === "gzip") return quality > 0;
		if (name === "*") wildcard = quality > 0;
	}
	return wildcard ?? false;
}
function isCompressibleContentType(value) {
	const contentType = Array.isArray(value) ? value[0] : value;
	if (contentType === void 0) return false;
	const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
	return mediaType.startsWith("text/") || /^(?:application\/(?:javascript|json|xml|x-javascript)|image\/svg\+xml)$/u.test(mediaType);
}
function shouldCompressResponse(request, response) {
	const pathname = request.url?.split("?", 1)[0] ?? "";
	return request.method === "GET" && (pathname.startsWith("/plugins/") || pathname.startsWith("/assets/")) && response.statusCode === 200 && request.headers.range === void 0 && response.headers["content-range"] === void 0 && response.headers["content-encoding"] === void 0 && acceptsGzip(request.headers["accept-encoding"]) && isCompressibleContentType(response.headers["content-type"]);
}
function revisionedStaticCacheControl(request, statusCode) {
	if (request.method !== "GET" && request.method !== "HEAD") return void 0;
	if (statusCode !== 200) return void 0;
	let target;
	try {
		target = new URL(request.url ?? "/", "https://dsh-mobile.invalid");
	} catch {
		return;
	}
	const revision = target.searchParams.get("rev");
	const hasRevision = revision !== null && /^[a-z0-9_-]{4,128}$/iu.test(revision);
	const hashedAsset = /^\/assets\/.*-[a-z0-9_-]{8,}\.[a-z0-9]+$/iu.test(target.pathname);
	if (!(target.pathname.startsWith("/plugins/") && hasRevision) && !(target.pathname.startsWith("/assets/") && (hasRevision || hashedAsset))) return void 0;
	return "private, max-age=31536000, immutable";
}
function addVaryAcceptEncoding(headers) {
	const existing = headers.vary;
	const values = (Array.isArray(existing) ? existing.map((value) => String(value)) : existing === void 0 ? [] : [String(existing)]).flatMap((value) => value.split(",").map((part) => part.trim()).filter(Boolean));
	if (!values.some((value) => value.toLowerCase() === "accept-encoding")) values.push("Accept-Encoding");
	headers.vary = values.join(", ");
}
function mapError(error) {
	if (error instanceof HttpError) return error;
	if (error instanceof AccessError) return new HttpError(error.status, error.code);
	if (error instanceof MobileExtensionError) return new HttpError(error.status, error.code);
	return new HttpError(500, "internal_error");
}
function requestAbortedError() {
	const error = /* @__PURE__ */ new Error("request aborted");
	error.name = "AbortError";
	return error;
}
function isTransientUpstreamError(error) {
	if (!(error instanceof Error)) return false;
	const code = error.code;
	return typeof code === "string" && TRANSIENT_UPSTREAM_ERROR_CODES.has(code);
}
function upstreamTimeoutError() {
	const error = /* @__PURE__ */ new Error("upstream timeout");
	error.code = "ETIMEDOUT";
	return error;
}
function waitForAbortableDelay(delayMs, signal) {
	if (signal.aborted) return Promise.reject(requestAbortedError());
	return new Promise((resolve, reject) => {
		const aborted = () => {
			clearTimeout(timer);
			reject(requestAbortedError());
		};
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", aborted);
			resolve();
		}, delayMs);
		signal.addEventListener("abort", aborted, { once: true });
	});
}
function waitForRequestTask(task, signal) {
	if (signal.aborted) return Promise.reject(requestAbortedError());
	return new Promise((resolve, reject) => {
		const aborted = () => {
			reject(requestAbortedError());
		};
		signal.addEventListener("abort", aborted, { once: true });
		task.then((value) => {
			signal.removeEventListener("abort", aborted);
			resolve(value);
		}, (error) => {
			signal.removeEventListener("abort", aborted);
			reject(error);
		});
	});
}
function discoveryDeviceName() {
	const value = hostname().trim().replaceAll(/[\u0000-\u001f\u007f]/gu, "");
	return (value === "" ? "DeepSeek Harness" : value).slice(0, 63);
}
function discoveryMdnsHost(instanceId) {
	const label = hostname().toLowerCase().replaceAll(/[^a-z0-9-]/gu, "-").replaceAll(/^-+|-+$/gu, "").slice(0, 40);
	return `${label === "" ? "dsh" : label}-${instanceId.slice(0, 8)}.local`;
}
function discoveryBroadcastTargets(cidrs) {
	const targets = /* @__PURE__ */ new Set(["255.255.255.255"]);
	for (const cidr of cidrs) {
		if (cidr.bits !== 32 || cidr.prefix >= 32) continue;
		const hostBits = BigInt(32 - cidr.prefix);
		const broadcast = cidr.network | (1n << hostBits) - 1n;
		targets.add([
			24n,
			16n,
			8n,
			0n
		].map((shift) => Number(broadcast >> shift & 255n)).join("."));
	}
	return [...targets];
}
/** Keep Node's upgrade-owned socket safe after the HTTP parser removes its listener. */
function guardUpgradeSocket(socket) {
	socket.on("error", () => {
		if (!socket.destroyed) socket.destroy();
	});
}
function discoveryFailure(error) {
	const code = error instanceof Error && typeof error.code === "string" ? error.code : "unknown";
	return Object.freeze({
		code,
		message: error instanceof Error ? error.message : String(error)
	});
}
function extensionTarget(pathname) {
	const prefix = `${AUTH_PREFIX}/extensions`;
	if (pathname === prefix || pathname === `${prefix}/` || pathname === `${prefix}/manifest`) return { kind: "manifest" };
	if (pathname === `${prefix}/events`) return { kind: "events" };
	if (!pathname.startsWith(`${prefix}/`)) return void 0;
	const parts = pathname.slice(prefix.length + 1).split("/");
	const id = parts.shift();
	if (id === void 0 || !/^[a-z][a-z0-9-]{0,63}$/u.test(id)) return void 0;
	const leaf = parts.shift();
	if (leaf === "mobile.js" && parts.length === 0) return {
		kind: "script",
		id
	};
	if (leaf === "mobile.css" && parts.length === 0) return {
		kind: "style",
		id
	};
	if (leaf === "assets" && parts.length > 0) return {
		kind: "asset",
		id,
		path: parts.join("/")
	};
	if (leaf === "actions" && parts.length === 1 && /^[a-z][a-z0-9-]{0,63}$/u.test(parts[0])) return {
		kind: "action",
		id,
		action: parts[0]
	};
	if (leaf === "routes") return {
		kind: "route",
		id,
		path: `/${parts.join("/")}`.replace(/\/{2,}/gu, "/")
	};
}
const EXTENSION_GENERATION_HEADER = "x-dsh-mobile-extension-generation";
function extensionGeneration(value) {
	if (value === void 0) return void 0;
	if (!/^[a-f\d]{64}$/u.test(value)) throw new HttpError(400, "invalid_extension_generation");
	return value;
}
function mobileBootBatchKey(pathname) {
	return new RegExp(`^${MOBILE_BOOT_BATCH_PREFIX.replaceAll("/", "\\/")}([a-f\\d]{64})\\.js$`, "u").exec(pathname)?.[1];
}
function assertBoundedContentLength(request, maximum) {
	const declared = request.headers["content-length"];
	if (declared !== void 0 && (!/^\d+$/u.test(declared) || Number(declared) > maximum)) throw new HttpError(413, "payload_too_large");
}
async function readBoundedBody(request, maximum) {
	assertBoundedContentLength(request, maximum);
	const chunks = [];
	let total = 0;
	for await (const chunk of request) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		total += buffer.length;
		if (total > maximum) throw new HttpError(413, "payload_too_large");
		chunks.push(buffer);
	}
	return Buffer.concat(chunks);
}
function extensionRequestHeaders(headers) {
	const allowed = /* @__PURE__ */ new Set([
		"accept",
		"content-type",
		"content-length",
		"content-range",
		"range",
		"if-none-match",
		"if-modified-since"
	]);
	const output = {};
	for (const [name, value] of Object.entries(headers)) {
		if (!allowed.has(name) || typeof value !== "string") continue;
		output[name] = value;
	}
	return Object.freeze(output);
}
function extensionContentType(path) {
	return {
		".css": "text/css; charset=utf-8",
		".csv": "text/csv; charset=utf-8",
		".gif": "image/gif",
		".html": "text/html; charset=utf-8",
		".jpeg": "image/jpeg",
		".jpg": "image/jpeg",
		".js": "text/javascript; charset=utf-8",
		".json": "application/json; charset=utf-8",
		".png": "image/png",
		".svg": "image/svg+xml",
		".webp": "image/webp"
	}[extname(path).toLowerCase()] ?? "application/octet-stream";
}
/** Authenticated TLS edge in front of the ordinary loopback-only DSH Web server. */
var MobileAccessGateway = class {
	config;
	extensions;
	upstreamAuthenticatedUrl;
	extraWebSocketPaths;
	blockedUpgradeLog;
	onDiscoveryDegraded;
	access;
	listenerTlsEnabled;
	tlsEnabled;
	policy;
	server;
	discoverySocket;
	discoveryTimer;
	/**
	* Why broadcast discovery is unavailable, if it is. Windows keeps separate TCP and
	* UDP port-exclusion tables, so the port the OS handed the TCP listener can be
	* refused for UDP. That degradation is survivable but must stay observable: without
	* it, "the phone cannot find this computer" has no diagnosable cause on the host.
	*/
	discoveryError;
	mdnsError;
	/** Names of the bundled mobile assets that could not be read, if any. */
	mobileAssetError;
	lastModuleExclusionError;
	bonjour;
	pairingCaCertificate;
	listenerPort;
	connectedSockets = /* @__PURE__ */ new Set();
	activeRequests = /* @__PURE__ */ new Map();
	activeWebSockets = /* @__PURE__ */ new Map();
	mobileBootBatches = /* @__PURE__ */ new Map();
	/** Cached upstream bundle byte sizes (HEAD probes), keyed by resource URL. */
	bootEntrySizeCache = /* @__PURE__ */ new Map();
	extensionEventListeners = /* @__PURE__ */ new Set();
	extensionEventRevision = 0;
	taskEventListeners = /* @__PURE__ */ new Set();
	deviceEventListeners = /* @__PURE__ */ new Map();
	pendingDeviceRevocations = /* @__PURE__ */ new Set();
	extensionChangeTimer;
	extensionChangeTask;
	legacyCustomDigest = "";
	upstreamCookie;
	upstreamCookieExpiresAt = 0;
	upstreamCookieTask;
	upstreamAuthRequest;
	nextOperationId = 1;
	closing = false;
	started = false;
	closeTask;
	removeSessionListener;
	removeExtensionContentListener;
	renewLimiter;
	probeLimiter;
	clientModulePreferences;
	clientModuleOperations = /* @__PURE__ */ new Set();
	clientModuleTasks = /* @__PURE__ */ new Set();
	clientModuleRevocations = /* @__PURE__ */ new Set();
	constructor(config, store, extensions, upstreamAuthenticatedUrl, extraWebSocketPaths, blockedUpgradeLog, onDiscoveryDegraded, clientModulePreferences) {
		this.config = config;
		this.extensions = extensions;
		this.upstreamAuthenticatedUrl = upstreamAuthenticatedUrl;
		this.extraWebSocketPaths = extraWebSocketPaths;
		this.blockedUpgradeLog = blockedUpgradeLog;
		this.onDiscoveryDegraded = onDiscoveryDegraded;
		this.clientModulePreferences = clientModulePreferences ?? new ClientModulePreferenceStore(join(dirname(config.stateFile), `${basename(config.stateFile)}.client-modules.json`), config.excludedClientModules);
		this.listenerTlsEnabled = config.tls.mode === "provided";
		this.tlsEnabled = config.publicTls;
		this.access = new AccessController(store, {
			pairingTtlMs: config.pairingTtlMs,
			deviceTtlMs: config.deviceTtlMs,
			sessionTtlMs: config.sessionTtlMs,
			maxDevices: config.maxDevices,
			maxSessions: config.maxSessions,
			rateLimitWindowMs: config.rateLimitWindowMs,
			maxPairingAttempts: config.maxPairingAttempts,
			maxRateLimitKeys: config.maxRateLimitKeys
		});
		this.renewLimiter = new BoundedRateLimiter(Math.min(100, config.maxPairingAttempts * 4), config.rateLimitWindowMs, config.maxRateLimitKeys);
		this.probeLimiter = new BoundedRateLimiter(Math.min(1e3, config.maxDevices * 4), config.rateLimitWindowMs, config.maxRateLimitKeys);
		this.removeSessionListener = this.access.onSessionEnded((authorization, reason) => {
			if (reason === "revoked") {
				const cleanup = this.clientModulePreferences.removeDevice(authorization.deviceId).catch(() => {
					process.emitWarning("Unable to remove revoked device client preferences", { code: "DSH_MOBILE_PREFERENCE_CLEANUP_FAILED" });
				});
				this.clientModuleRevocations.add(cleanup);
				cleanup.finally(() => this.clientModuleRevocations.delete(cleanup));
				if (!this.pendingDeviceRevocations.has(authorization.deviceId)) {
					this.pendingDeviceRevocations.add(authorization.deviceId);
					this.broadcastDeviceRevoked(authorization.deviceId);
				}
				setImmediate(() => {
					this.abortSessionResources(authorization.sessionKey);
					this.pendingDeviceRevocations.delete(authorization.deviceId);
				});
			} else this.abortSessionResources(authorization.sessionKey);
		});
		this.removeExtensionContentListener = this.extensions?.onContentChanged(() => {
			this.broadcastExtensionChange();
		}) ?? (() => void 0);
	}
	/** Initialize durable state, validate TLS, and bind the externally reachable listener. */
	async start() {
		if (this.started || this.server !== void 0) throw new Error("mobile-access gateway cannot be started twice");
		this.started = true;
		await this.access.initialize();
		try {
			await this.clientModulePreferences.initialize();
			if (this.config.pairingCaFile !== void 0) {
				const certificate = new X509Certificate(await readFile(this.config.pairingCaFile));
				const fingerprint = certificate.fingerprint256.replaceAll(":", "").toLowerCase();
				if (!certificate.ca || certificate.subject !== certificate.issuer || !certificate.verify(certificate.publicKey) || fingerprint !== this.config.instanceId) throw new Error("pairingCaFile must be the self-signed CA identified by instanceId");
				this.pairingCaCertificate = certificate.raw.toString("base64");
			}
			const missingAssets = [];
			for (const [label, file] of [["compatibility", this.config.mobileCompatibilityFile], ["layout", this.config.mobileLayoutFile]]) if (!(await lstat(file).catch(() => void 0))?.isFile()) missingAssets.push(label);
			this.mobileAssetError = missingAssets.length === 0 ? void 0 : `mobile_assets_missing_${missingAssets.join("_")}`;
			const handler = (request, response) => {
				this.handleExternalRequest(request, response).catch((error) => {
					const mapped = mapError(error);
					if (response.headersSent) response.destroy();
					else sendFailure(response, mapped.status, mapped.code, this.tlsEnabled);
				});
			};
			const server = this.listenerTlsEnabled ? createServer$2(await tlsOptions(this.config), handler) : createServer$1({ maxHeaderSize: MAX_HEADER_BYTES }, handler);
			this.server = server;
			server.maxHeadersCount = 64;
			server.maxConnections = this.config.maxConnections;
			server.headersTimeout = 1e4;
			server.requestTimeout = this.config.upstreamTimeoutMs;
			server.keepAliveTimeout = 5e3;
			server.on("connection", (socket) => {
				if (this.connectedSockets.size >= this.config.maxConnections) {
					socket.destroy();
					return;
				}
				this.connectedSockets.add(socket);
				socket.on("error", () => {
					socket.destroy();
				});
				socket.once("close", () => {
					this.connectedSockets.delete(socket);
				});
			});
			server.on("connect", (_request, socket) => {
				socket.destroy();
			});
			server.on("upgrade", (request, socket, head) => {
				const client = socket;
				guardUpgradeSocket(client);
				this.handleUpgrade(request, client, head).catch((error) => {
					const mapped = mapError(error);
					rejectUpgrade(client, mapped.status, mapped.code);
				});
			});
			server.on("clientError", (_error, socket) => {
				rejectUpgrade(socket, 400, "bad_request");
			});
			await new Promise((resolve, reject) => {
				const failed = (error) => {
					reject(error);
				};
				server.once("error", failed);
				server.listen(this.config.listenPort, this.config.listenHost, () => {
					server.off("error", failed);
					resolve();
				});
			});
			const address = server.address();
			if (address === null || typeof address === "string") throw new Error("gateway listener has no TCP address");
			this.listenerPort = address.port;
			this.policy = new RequestTrustPolicy(this.config.authorities, address.port, this.config.allowedCidrs, this.tlsEnabled);
			if (this.config.discovery) await this.startDiscovery(address.port);
			await this.pollLegacyCustomChanges();
			this.extensionChangeTimer = setInterval(() => {
				this.pollLegacyCustomChanges();
			}, EXTENSION_CHANGE_POLL_MS);
			this.extensionChangeTimer.unref();
		} catch (error) {
			await this.closeFailedStart();
			throw error;
		}
	}
	/** Install a newly signed provided leaf for future TLS handshakes without dropping sessions. */
	async refreshProvidedTls() {
		if (!this.listenerTlsEnabled || this.config.tls.mode !== "provided") throw new Error("gateway does not terminate provided TLS");
		const server = this.server;
		if (server === void 0 || !this.started || this.closing) throw new Error("gateway is not running");
		const options = await tlsOptions(this.config);
		if (this.server !== server || this.closing) throw new Error("gateway is not running");
		server.setSecureContext(options);
	}
	async startDiscovery(port) {
		const socket = createSocket("udp4");
		this.discoverySocket = socket;
		const announcement = this.discoveryAnnouncement(port);
		let binding = true;
		socket.on("error", (error) => {
			if (!binding) this.recordBroadcastFailure(error, true);
		});
		const sendAnnouncement = (targetPort, address) => {
			if (this.closing || this.discoveryError !== void 0) return;
			try {
				socket.send(announcement, targetPort, address, (error) => {
					if (error !== null) this.recordBroadcastFailure(error, true);
				});
			} catch (error) {
				this.recordBroadcastFailure(error, true);
			}
		};
		socket.on("message", (message, remote) => {
			if (this.closing || this.discoveryError !== void 0 || !message.equals(DISCOVERY_QUERY) || !addressAllowed(remote.address, this.config.allowedCidrs)) return;
			sendAnnouncement(remote.port, remote.address);
		});
		const bindHost = isIP(this.config.listenHost) === 4 && isLoopbackAddress(this.config.listenHost) ? this.config.listenHost : "0.0.0.0";
		if (await new Promise((resolve) => {
			const onBindError = (error) => {
				socket.off("error", onBindError);
				this.recordBroadcastFailure(error, false);
				resolve(false);
			};
			socket.once("error", onBindError);
			try {
				socket.bind(port, bindHost, () => {
					socket.off("error", onBindError);
					binding = false;
					try {
						socket.setBroadcast(true);
						resolve(true);
					} catch (error) {
						this.recordBroadcastFailure(error, true);
						resolve(false);
					}
				});
			} catch (error) {
				onBindError(error);
			}
		}) && this.discoveryError === void 0) {
			const announce = () => {
				for (const target of discoveryBroadcastTargets(this.config.allowedCidrs)) sendAnnouncement(port, target);
			};
			announce();
			if (this.discoveryError === void 0) {
				this.discoveryTimer = setInterval(announce, DISCOVERY_INTERVAL_MS);
				this.discoveryTimer.unref();
			}
		} else {
			this.discoverySocket = void 0;
			try {
				socket.close();
			} catch {}
		}
		const deviceName = discoveryDeviceName();
		const onMdnsError = (error) => {
			this.recordMdnsFailure(error);
		};
		const bonjour = new Bonjour({ disableIPv6: true }, onMdnsError);
		this.bonjour = bonjour;
		bonjour.server.mdns.on("error", onMdnsError);
		bonjour.publish({
			name: `${deviceName} (${this.config.instanceId.slice(0, 8)})`,
			type: MDNS_SERVICE_TYPE,
			protocol: "tcp",
			port,
			host: discoveryMdnsHost(this.config.instanceId),
			disableIPv6: true,
			txt: {
				deviceName,
				origin: this.address().origin,
				instanceId: this.config.instanceId,
				protocol: String(DISCOVERY_PROTOCOL)
			}
		});
	}
	reportDiscoveryDegraded(source, code) {
		try {
			this.onDiscoveryDegraded?.(source, code);
		} catch (error) {
			process.emitWarning(`DSH Mobile could not log ${source} discovery error: ${String(error)}`, { code: "DSH_MOBILE_DISCOVERY_LOG_FAILED" });
		}
	}
	recordBroadcastFailure(error, notify) {
		if (this.closing || this.discoveryError !== void 0) return;
		this.discoveryError = discoveryFailure(error);
		if (this.discoveryTimer !== void 0) clearInterval(this.discoveryTimer);
		this.discoveryTimer = void 0;
		if (notify) this.reportDiscoveryDegraded("broadcast", this.discoveryError.code);
	}
	recordMdnsFailure(error) {
		if (this.closing || this.mdnsError !== void 0) return;
		this.mdnsError = discoveryFailure(error);
		this.reportDiscoveryDegraded("mdns", this.mdnsError.code);
	}
	discoveryAnnouncement(port) {
		return Buffer.from(JSON.stringify({
			deviceName: discoveryDeviceName(),
			origin: this.address().origin,
			port,
			protocol: DISCOVERY_PROTOCOL,
			instanceId: this.config.instanceId
		}), "utf8");
	}
	async closeFailedStart() {
		if (this.extensionChangeTimer !== void 0) clearInterval(this.extensionChangeTimer);
		this.extensionChangeTimer = void 0;
		this.removeExtensionContentListener();
		if (this.discoveryTimer !== void 0) clearInterval(this.discoveryTimer);
		this.discoveryTimer = void 0;
		await this.closeBonjour();
		this.discoverySocket?.close();
		this.discoverySocket = void 0;
		for (const socket of this.connectedSockets) socket.destroy();
		const server = this.server;
		this.server = void 0;
		if (server?.listening === true) await new Promise((resolve) => {
			server.close(() => resolve());
		});
		await this.access.close();
	}
	async closeBonjour() {
		const bonjour = this.bonjour;
		this.bonjour = void 0;
		if (bonjour === void 0) return;
		await new Promise((resolve) => {
			bonjour.unpublishAll(() => {
				bonjour.destroy(() => resolve());
			});
		});
	}
	/** Actual bound address, available after start and safe for loopback status output. */
	address() {
		if (this.listenerPort === void 0 || this.policy === void 0) throw new Error("gateway is not listening");
		const origin = this.policy.origins.values().next().value;
		if (origin === void 0) throw new Error("gateway has no public authority");
		return Object.freeze({
			host: this.config.listenHost,
			port: this.listenerPort,
			origin
		});
	}
	/**
	* Report which discovery channels this gateway actually owns.
	*
	* Broadcast discovery degrades on its own when its UDP port cannot be bound, so
	* callers need to tell "discovery is off" from "discovery was never attempted".
	* mDNS is published independently and is unaffected by that failure.
	*/
	discoveryStatus() {
		return Object.freeze({
			broadcast: this.discoverySocket !== void 0 && this.discoveryTimer !== void 0,
			mdns: this.bonjour !== void 0 && this.mdnsError === void 0,
			...this.discoveryError === void 0 ? {} : { errorCode: `discovery_broadcast_${this.discoveryError.code}` },
			...this.mdnsError === void 0 ? {} : { mdnsErrorCode: `discovery_mdns_${this.mdnsError.code}` },
			...this.mobileAssetError === void 0 ? {} : { mobileAssetsErrorCode: this.mobileAssetError }
		});
	}
	requirePolicy() {
		if (this.policy === void 0 || this.closing) throw new HttpError(503, "unavailable");
		return this.policy;
	}
	authorize(request) {
		const cookies = browserAuthCookies(request.headers.cookie);
		const name = this.tlsEnabled && cookies.has("__Host-dsh_ma_session") ? HOST_SESSION_COOKIE : SESSION_COOKIE;
		return authenticatedCookie(cookies.get(name) ?? [], (token) => this.access.authorizeSession(token)).result;
	}
	requireCsrf(request, authorization) {
		const value = headerValue(request.headers, CSRF_HEADER);
		this.access.assertCsrf(authorization, value);
	}
	setSessionCookies(response, result, now) {
		const maxAge = (result.sessionExpiresAt - now) / 1e3;
		response.setHeader("Set-Cookie", [
			cookie(SESSION_COOKIE, result.sessionToken, {
				tls: this.tlsEnabled,
				httpOnly: true,
				path: "/",
				maxAgeSeconds: maxAge
			}),
			cookie(CSRF_COOKIE, result.csrfToken, {
				tls: this.tlsEnabled,
				httpOnly: false,
				path: "/",
				maxAgeSeconds: maxAge
			}),
			...this.tlsEnabled ? [cookie(HOST_SESSION_COOKIE, result.sessionToken, {
				tls: true,
				httpOnly: true,
				path: "/",
				maxAgeSeconds: maxAge
			}), cookie(HOST_CSRF_COOKIE, result.csrfToken, {
				tls: true,
				httpOnly: false,
				path: "/",
				maxAgeSeconds: maxAge
			})] : []
		]);
	}
	setBrowserDeviceBinding(response, deviceId, deviceExpiresAt) {
		if (!this.tlsEnabled) return;
		const existing = response.getHeader("Set-Cookie");
		response.setHeader("Set-Cookie", [...existing, cookie(HOST_DEVICE_COOKIE, deviceId, {
			tls: true,
			httpOnly: true,
			path: "/",
			maxAgeSeconds: (deviceExpiresAt - Date.now()) / 1e3
		})]);
	}
	async handlePair(request, response) {
		const body = await readJsonObject(request, MAX_CONTROL_BODY_BYTES);
		if (typeof body.token !== "string" || body.label !== void 0 && typeof body.label !== "string") throw new HttpError(400, "bad_request");
		const result = await this.access.pair(request.socket.remoteAddress ?? "unknown", body.token, body.label);
		const now = Date.now();
		this.setSessionCookies(response, result, now);
		const sessionCookies = response.getHeader("Set-Cookie");
		response.setHeader("Set-Cookie", [...sessionCookies, cookie(DEVICE_COOKIE, result.deviceToken, {
			tls: this.tlsEnabled,
			httpOnly: true,
			path: "/mobile-access/auth/renew",
			maxAgeSeconds: (result.deviceExpiresAt - now) / 1e3
		})]);
		this.setBrowserDeviceBinding(response, result.deviceId, result.deviceExpiresAt);
		sendJson(response, 201, {
			paired: true,
			deviceId: result.deviceId,
			csrfToken: result.csrfToken,
			sessionExpiresAt: result.sessionExpiresAt
		}, this.tlsEnabled);
	}
	async handleRenew(request, response) {
		if (!this.renewLimiter.take(request.socket.remoteAddress ?? "unknown", Date.now())) throw new HttpError(429, "rate_limited");
		await readJsonObject(request, MAX_CONTROL_BODY_BYTES);
		const cookies = browserAuthCookies(request.headers.cookie);
		const bindings = this.tlsEnabled ? cookies.get(HOST_DEVICE_COOKIE) : void 0;
		if (bindings !== void 0 && bindings.length !== 1) throw new HttpError(401, "authentication_failed");
		const device = authenticatedCookie(cookies.get("dsh_ma_device") ?? [], (token) => this.access.authorizeDevice(token), (candidate) => bindings === void 0 || candidate.deviceId === bindings[0]);
		const result = await this.access.renew(device.value);
		this.setSessionCookies(response, result, Date.now());
		this.setBrowserDeviceBinding(response, result.deviceId, device.result.deviceExpiresAt);
		sendJson(response, 200, {
			renewed: true,
			deviceId: result.deviceId,
			csrfToken: result.csrfToken,
			sessionExpiresAt: result.sessionExpiresAt
		}, this.tlsEnabled);
	}
	async handleNativePair(request, response) {
		const body = await readJsonObject(request, MAX_CONTROL_BODY_BYTES);
		if (typeof body.token !== "string" || body.label !== void 0 && typeof body.label !== "string") throw new HttpError(400, "bad_request");
		const result = await this.access.pair(request.socket.remoteAddress ?? "unknown", body.token, body.label);
		sendJson(response, 201, {
			instanceId: this.config.instanceId,
			deviceId: result.deviceId,
			deviceToken: result.deviceToken,
			deviceExpiresAt: result.deviceExpiresAt,
			sessionToken: result.sessionToken,
			csrfToken: result.csrfToken,
			sessionExpiresAt: result.sessionExpiresAt
		}, this.tlsEnabled);
	}
	async handleNativeRenew(request, response) {
		if (!this.renewLimiter.take(request.socket.remoteAddress ?? "unknown", Date.now())) throw new HttpError(429, "rate_limited");
		const body = await readJsonObject(request, MAX_CONTROL_BODY_BYTES);
		if (typeof body.deviceToken !== "string") throw new HttpError(400, "bad_request");
		const result = await this.access.renew(body.deviceToken);
		sendJson(response, 200, {
			instanceId: this.config.instanceId,
			deviceId: result.deviceId,
			sessionToken: result.sessionToken,
			csrfToken: result.csrfToken,
			sessionExpiresAt: result.sessionExpiresAt
		}, this.tlsEnabled);
	}
	async handleNativeProbe(request, response) {
		if (!this.probeLimiter.take(request.socket.remoteAddress ?? "unknown", Date.now())) throw new HttpError(429, "rate_limited");
		const body = await readJsonObject(request, MAX_CONTROL_BODY_BYTES);
		if (typeof body.deviceToken !== "string") throw new HttpError(400, "bad_request");
		const result = await this.access.probe(body.deviceToken);
		sendJson(response, 200, {
			instanceId: this.config.instanceId,
			deviceId: result.deviceId,
			deviceExpiresAt: result.deviceExpiresAt
		}, this.tlsEnabled);
	}
	async handleLogout(request, response) {
		await readJsonObject(request, MAX_CONTROL_BODY_BYTES);
		const authorization = this.authorize(request);
		this.requireCsrf(request, authorization);
		this.access.logout(authorization);
		response.setHeader("Set-Cookie", [
			cookie(SESSION_COOKIE, "", {
				tls: this.tlsEnabled,
				httpOnly: true,
				path: "/",
				maxAgeSeconds: 0
			}),
			cookie(CSRF_COOKIE, "", {
				tls: this.tlsEnabled,
				httpOnly: false,
				path: "/",
				maxAgeSeconds: 0
			}),
			...this.tlsEnabled ? [cookie(HOST_SESSION_COOKIE, "", {
				tls: true,
				httpOnly: true,
				path: "/",
				maxAgeSeconds: 0
			}), cookie(HOST_CSRF_COOKIE, "", {
				tls: true,
				httpOnly: false,
				path: "/",
				maxAgeSeconds: 0
			})] : []
		]);
		sendJson(response, 200, { loggedOut: true }, this.tlsEnabled);
	}
	async handleExternalRequest(request, response) {
		const target = parseRequestTarget(request.url);
		const policy = this.requirePolicy();
		const isMutation = request.method !== "GET" && request.method !== "HEAD";
		assertExternalTrust(request, policy, isMutation);
		if (target.decodedPathname === "/api/mobile-access" || target.decodedPathname.startsWith(`/api/mobile-access/`)) throw new HttpError(404, "not_found");
		if (request.method === "TRACE" || request.method === "CONNECT") throw new HttpError(405, "method_not_allowed");
		if (target.search === "" && request.method === "GET" && target.decodedPathname === `/mobile-access/health`) {
			sendJson(response, 200, { ok: true }, this.tlsEnabled);
			return;
		}
		if (target.search === "" && request.method === "GET" && target.decodedPathname === `/mobile-access/metadata`) {
			sendJson(response, 200, {
				version: 1,
				pluginVersion: DSH_MOBILE_VERSION,
				minimumAndroidAppVersion: MINIMUM_ANDROID_APP_VERSION,
				discoveryProtocol: DISCOVERY_PROTOCOL
			}, this.tlsEnabled);
			return;
		}
		if (target.search === "" && request.method === "GET" && target.decodedPathname === `/mobile-access/discovery`) {
			sendJson(response, 200, {
				deviceName: discoveryDeviceName(),
				origin: this.address().origin,
				port: this.address().port,
				protocol: DISCOVERY_PROTOCOL,
				instanceId: this.config.instanceId
			}, this.tlsEnabled);
			return;
		}
		if (target.search === "" && request.method === "GET" && target.decodedPathname === `/mobile-access/ca.cer`) {
			if (this.pairingCaCertificate === void 0) throw new HttpError(404, "not_found");
			const body = Buffer.from(this.pairingCaCertificate, "base64");
			setSecurityHeaders(response, this.tlsEnabled);
			response.writeHead(200, {
				"Content-Type": "application/pkix-cert",
				"Content-Length": body.length,
				"Cache-Control": "no-store"
			});
			response.end(body);
			return;
		}
		if (target.search === "" && request.method === "GET" && (target.decodedPathname === `/mobile-access/pair` || target.decodedPathname === `/mobile-access/pair.js`)) {
			if (!this.access.pairingStatus().open) throw new HttpError(404, "not_found");
			const languageHeader = request.headers["accept-language"];
			const locale = resolveAuthPageLocale(typeof languageHeader === "string" ? languageHeader : void 0);
			setSecurityHeaders(response, this.tlsEnabled);
			response.setHeader("Vary", "Accept-Language");
			const body = target.decodedPathname.endsWith(".js") ? renderPairScript(locale) : renderPairPage(locale);
			response.writeHead(200, {
				"Content-Type": target.decodedPathname.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8",
				"Content-Length": Buffer.byteLength(body)
			});
			response.end(body);
			return;
		}
		if (request.method === "GET" && (target.decodedPathname === `/mobile-access/login` || target.decodedPathname === `/mobile-access/login.js`)) {
			if (target.decodedPathname.endsWith(".js") && target.search !== "") throw new HttpError(400, "bad_request");
			const languageHeader = request.headers["accept-language"];
			const locale = resolveAuthPageLocale(typeof languageHeader === "string" ? languageHeader : void 0);
			setSecurityHeaders(response, this.tlsEnabled);
			response.setHeader("Vary", "Accept-Language");
			const body = target.decodedPathname.endsWith(".js") ? renderLoginScript(locale) : renderLoginPage(locale);
			response.writeHead(200, {
				"Content-Type": target.decodedPathname.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8",
				"Content-Length": Buffer.byteLength(body)
			});
			response.end(body);
			return;
		}
		if (target.search === "" && request.method === "POST" && target.decodedPathname === `/mobile-access/auth/pair`) {
			await this.handlePair(request, response);
			return;
		}
		if (target.search === "" && request.method === "POST" && target.decodedPathname === `/mobile-access/auth/renew`) {
			await this.handleRenew(request, response);
			return;
		}
		if (target.search === "" && request.method === "POST" && target.decodedPathname === `/mobile-access/auth/native-pair`) {
			await this.handleNativePair(request, response);
			return;
		}
		if (target.search === "" && request.method === "POST" && target.decodedPathname === `/mobile-access/auth/native-renew`) {
			await this.handleNativeRenew(request, response);
			return;
		}
		if (target.search === "" && request.method === "POST" && target.decodedPathname === `/mobile-access/auth/native-probe`) {
			await this.handleNativeProbe(request, response);
			return;
		}
		if (target.search === "" && request.method === "POST" && target.decodedPathname === `/mobile-access/auth/logout`) {
			await this.handleLogout(request, response);
			return;
		}
		const computerImages = request.method === "GET" && target.decodedPathname === `/mobile-access/computer-images`;
		const computerImage = request.method === "GET" && target.decodedPathname === `/mobile-access/computer-image`;
		const clientModules = target.decodedPathname === `${AUTH_PREFIX}/client-modules`;
		const requestedExtension = extensionTarget(target.decodedPathname);
		const requestedMobileBootBatch = mobileBootBatchKey(target.decodedPathname);
		const customAsset = request.method === "GET" ? target.decodedPathname === `/mobile-access/custom.css` ? {
			file: this.config.customCssFile,
			contentType: "text/css; charset=utf-8",
			fallback: CUSTOM_STYLE_FALLBACK
		} : target.decodedPathname === `/mobile-access/custom.js` ? {
			file: this.config.customScriptFile,
			contentType: "text/javascript; charset=utf-8",
			fallback: CUSTOM_SCRIPT_FALLBACK
		} : target.decodedPathname === MOBILE_LAYOUT_PATH ? {
			file: this.config.mobileLayoutFile,
			contentType: "text/javascript; charset=utf-8",
			fallback: void 0
		} : target.decodedPathname === MOBILE_COMPAT_PATH ? {
			file: this.config.mobileCompatibilityFile,
			contentType: "text/javascript; charset=utf-8",
			fallback: void 0
		} : void 0 : void 0;
		if (customAsset === void 0 && requestedMobileBootBatch === void 0 && !computerImages && !computerImage && !clientModules && extensionTarget(target.decodedPathname) === void 0 && (target.decodedPathname === "/mobile-access" || target.decodedPathname.startsWith(`/mobile-access/`))) throw new HttpError(404, "not_found");
		if (![
			"GET",
			"HEAD",
			"POST",
			"PUT",
			"PATCH",
			"DELETE"
		].includes(request.method ?? "") && requestedExtension?.kind !== "route") throw new HttpError(405, "method_not_allowed");
		let authorization;
		try {
			authorization = this.authorize(request);
		} catch (error) {
			const mapped = mapError(error);
			const acceptsHtml = request.headers.accept?.split(",").some((value) => value.trim().split(";", 1)[0] === "text/html") ?? false;
			const topLevel = request.method === "GET" && acceptsHtml && (request.headers["sec-fetch-dest"] === void 0 || request.headers["sec-fetch-dest"] === "document") && target.decodedPathname !== "/api" && !target.decodedPathname.startsWith("/api/");
			if (mapped.status === 401 && topLevel) {
				const returnPath = target.raw.length <= 2048 ? target.raw : "/";
				setSecurityHeaders(response, this.tlsEnabled);
				response.writeHead(302, {
					Location: `${AUTH_PREFIX}/login?return=${encodeURIComponent(returnPath)}`,
					"Content-Length": 0
				});
				response.end();
				return;
			}
			throw error;
		}
		if (isMutation) this.requireCsrf(request, authorization);
		if (clientModules) {
			if (target.search !== "") throw new HttpError(400, "bad_request");
			if (request.method !== "GET" && request.method !== "POST") throw new HttpError(405, "method_not_allowed");
			const operation = this.allocateRequest(authorization, response, {});
			const onClose = () => {
				operation.abort();
				operation.release();
			};
			response.once("close", onClose);
			try {
				let kind = "describe";
				let excluded;
				if (request.method === "POST") {
					const body = await readJsonObject(request, this.config.maxBodyBytes);
					const keys = Object.keys(body);
					if (keys.length !== 1) throw new HttpError(400, "bad_request");
					if (keys[0] === "reset" && body.reset === true) kind = "reset";
					else if (keys[0] === "excludedClientModules") {
						kind = "configure";
						excluded = body.excludedClientModules;
					} else throw new HttpError(400, "bad_request");
				}
				const view = await this.clientModulePreferenceOperation(kind, excluded, authorization.deviceId, operation.signal);
				operation.signal.throwIfAborted();
				sendJson(response, 200, view, this.tlsEnabled);
			} catch (error) {
				if (operation.signal.aborted) return;
				if (error instanceof ClientModuleConflictError) sendJson(response, 409, {
					error: error.code,
					detail: error.detail
				}, this.tlsEnabled);
				else throw error;
			} finally {
				response.removeListener("close", onClose);
				operation.release();
			}
			return;
		}
		const extension = requestedExtension;
		if (extension !== void 0) {
			await this.handleExtensionRequest(extension, target, request, response, authorization);
			return;
		}
		if (requestedMobileBootBatch !== void 0) {
			await this.serveMobileBootBatch(requestedMobileBootBatch, request, response, authorization);
			return;
		}
		if (customAsset !== void 0) {
			const operation = this.allocateRequest(authorization, response, {});
			try {
				let body;
				let mtime;
				try {
					body = await readFile(customAsset.file, { signal: operation.signal });
					try {
						mtime = (await stat(customAsset.file)).mtime;
					} catch {}
				} catch (error) {
					if (error.code !== "ENOENT") throw error;
					if (customAsset.fallback === void 0) throw new HttpError(503, "mobile_frontend_unavailable");
					body = Buffer.from(customAsset.fallback);
				}
				if (body.byteLength > 262144) throw new HttpError(413, "payload_too_large");
				const etag = createHash("sha256").update(body).digest("hex");
				const ifNoneMatch = headerValue(request.headers, "if-none-match");
				if (ifNoneMatch !== void 0 && ifNoneMatch === etag) {
					setSecurityHeaders(response, this.tlsEnabled);
					response.writeHead(304);
					response.end();
					return;
				}
				setSecurityHeaders(response, this.tlsEnabled);
				const responseHeaders = {
					"Content-Type": customAsset.contentType,
					"Content-Length": body.byteLength,
					"ETag": etag
				};
				if (mtime !== void 0) responseHeaders["Last-Modified"] = mtime.toUTCString();
				response.writeHead(200, responseHeaders);
				response.end(body);
				return;
			} finally {
				operation.release();
			}
		}
		if (computerImages) {
			const operation = this.allocateRequest(authorization, response, {});
			try {
				const query = new URL(target.raw, this.address().origin).searchParams;
				sendJson(response, 200, await listComputerImages(query.get("path"), operation.signal), this.tlsEnabled);
				return;
			} finally {
				operation.release();
			}
		}
		if (computerImage) {
			const operation = this.allocateRequest(authorization, response, {});
			try {
				const query = new URL(target.raw, this.address().origin).searchParams;
				const image = await readComputerImage(query.get("path"), operation.signal);
				setSecurityHeaders(response, this.tlsEnabled);
				response.writeHead(200, {
					"Content-Type": image.contentType,
					"Content-Length": image.body.byteLength,
					"Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(image.name)}`
				});
				response.end(image.body);
				return;
			} finally {
				operation.release();
			}
		}
		const stockFrontend = new URL(target.raw, this.address().origin).searchParams.get("frontend") === "stock";
		const acceptsHtml = request.headers.accept?.split(",").some((value) => value.trim().split(";", 1)[0] === "text/html") ?? false;
		const frontendDocument = target.decodedPathname === "/" || target.decodedPathname === "/index.html";
		if (request.method === "GET" && frontendDocument && acceptsHtml && !stockFrontend) {
			await this.proxyMobileIndex(request, response, authorization);
			return;
		}
		if (stockFrontend && target.decodedPathname === "/") request.url = "/";
		await this.proxyHttp(request, response, authorization);
	}
	async handleExtensionRequest(targetInfo, target, request, response, authorization) {
		const extensions = this.extensions;
		if (extensions === void 0) throw new HttpError(404, "not_found");
		if (targetInfo.kind === "events") {
			if (request.method !== "GET" || target.search !== "") throw new HttpError(request.method === "GET" ? 400 : 405, request.method === "GET" ? "bad_request" : "method_not_allowed");
			this.openExtensionEventStream(request, response, authorization);
			return;
		}
		if (targetInfo.kind === "manifest") {
			if (request.method !== "GET" && request.method !== "HEAD") throw new HttpError(405, "method_not_allowed");
			const operation = this.allocateRequest(authorization, response, {});
			try {
				operation.signal.throwIfAborted();
				const customRevision = async (file, fallback) => {
					let source;
					try {
						source = await readFile(file, { signal: operation.signal });
					} catch (error) {
						if (error.code !== "ENOENT") throw error;
						source = Buffer.from(fallback);
					}
					if (source.byteLength > 262144) throw new HttpError(413, "payload_too_large");
					return createHash("sha256").update(source).digest("hex");
				};
				const [scriptRevision, styleRevision] = await Promise.all([customRevision(this.config.customScriptFile, CUSTOM_SCRIPT_FALLBACK), customRevision(this.config.customCssFile, CUSTOM_STYLE_FALLBACK)]);
				const body = Buffer.from(JSON.stringify({
					protocol: 1,
					extensions: extensions.manifest(),
					legacy: {
						scriptRevision,
						styleRevision
					}
				}));
				const etag = createHash("sha256").update(body).update(extensions.contentDigest()).digest("hex");
				if (headerValue(request.headers, "if-none-match") === etag) {
					setSecurityHeaders(response, this.tlsEnabled);
					response.writeHead(304);
					response.end();
					return;
				}
				setSecurityHeaders(response, this.tlsEnabled);
				response.writeHead(200, {
					"Content-Type": "application/json; charset=utf-8",
					"Content-Length": body.byteLength,
					ETag: etag
				});
				if (request.method === "HEAD") response.end();
				else response.end(body);
				return;
			} finally {
				operation.release();
			}
		}
		if (targetInfo.kind === "script" || targetInfo.kind === "style" || targetInfo.kind === "asset") {
			if (request.method !== "GET" && request.method !== "HEAD") throw new HttpError(405, "method_not_allowed");
			const generation = extensionGeneration(new URLSearchParams(target.search).get("generation") ?? void 0);
			const operation = this.allocateRequest(authorization, response, {});
			try {
				const file = targetInfo.kind === "script" ? await extensions.readClientFile(targetInfo.id, "script", operation.signal, generation) : targetInfo.kind === "style" ? await extensions.readClientFile(targetInfo.id, "style", operation.signal, generation) : await extensions.readAsset(targetInfo.id, targetInfo.path ?? "", operation.signal, generation);
				if (headerValue(request.headers, "if-none-match") === file.digest) {
					setSecurityHeaders(response, this.tlsEnabled);
					response.writeHead(304);
					response.end();
					return;
				}
				const contentType = targetInfo.kind === "script" ? "text/javascript; charset=utf-8" : targetInfo.kind === "style" ? "text/css; charset=utf-8" : extensionContentType(targetInfo.path ?? "");
				setSecurityHeaders(response, this.tlsEnabled);
				response.writeHead(200, {
					"Content-Type": contentType,
					"Content-Length": file.body.byteLength,
					ETag: file.digest
				});
				if (request.method === "HEAD") response.end();
				else response.end(file.body);
				return;
			} finally {
				operation.release();
			}
		}
		if (targetInfo.kind === "action") {
			if (request.method !== "POST") throw new HttpError(405, "method_not_allowed");
			const maximum = 1048576;
			assertBoundedContentLength(request, maximum);
			const generation = extensionGeneration(headerValue(request.headers, EXTENSION_GENERATION_HEADER));
			const operation = this.allocateRequest(authorization, response, {});
			const abort = new AbortController();
			response.once("close", () => {
				operation.release();
				abort.abort();
			});
			const generationSignal = extensions.signal(targetInfo.id, generation);
			const onGenerationAbort = () => {
				abort.abort();
				if (!response.destroyed) response.destroy();
			};
			generationSignal?.addEventListener("abort", onGenerationAbort, { once: true });
			try {
				const body = await readJsonObject(request, maximum);
				const result = await extensions.invoke(targetInfo.id, targetInfo.action, body, {
					signal: abort.signal,
					deviceId: authorization.deviceId
				}, generation);
				if (isPreparedJson(result)) {
					if (result.bytes.byteLength > 4194304) throw new MobileExtensionError("extension_result_too_large", "extension result is too large", 500);
					if (!response.headersSent && !response.destroyed) {
						const body = Buffer.concat([result.bytes, Buffer.from("\n")]);
						setSecurityHeaders(response, this.tlsEnabled);
						response.writeHead(200, {
							"Content-Type": "application/json; charset=utf-8",
							"Content-Length": body.byteLength
						});
						response.end(body);
					}
				} else {
					let serialized;
					try {
						serialized = Buffer.from(JSON.stringify(result));
					} catch {
						throw new MobileExtensionError("extension_failed", "extension action failed", 500);
					}
					if (serialized.byteLength > 4194304) throw new MobileExtensionError("extension_result_too_large", "extension result is too large", 500);
					sendJson(response, 200, result, this.tlsEnabled);
				}
			} finally {
				generationSignal?.removeEventListener("abort", onGenerationAbort);
				abort.abort();
				operation.release();
			}
			return;
		}
		if (targetInfo.kind === "route") {
			const method = request.method ?? "GET";
			if (![
				"GET",
				"HEAD",
				"POST",
				"PUT",
				"PATCH",
				"DELETE"
			].includes(method)) throw new HttpError(405, "method_not_allowed");
			const hasBody = method !== "GET" && method !== "HEAD";
			if (hasBody) assertBoundedContentLength(request, this.config.maxBodyBytes);
			const generation = extensionGeneration(headerValue(request.headers, EXTENSION_GENERATION_HEADER));
			const operation = this.allocateRequest(authorization, response, {});
			const abort = new AbortController();
			response.once("close", () => {
				operation.release();
				abort.abort();
			});
			const generationSignal = extensions.signal(targetInfo.id, generation);
			const onGenerationAbort = () => {
				abort.abort();
				if (!response.destroyed) response.destroy();
			};
			generationSignal?.addEventListener("abort", onGenerationAbort, { once: true });
			try {
				const body = hasBody ? await readBoundedBody(request, this.config.maxBodyBytes) : Buffer.alloc(0);
				const parsed = new URL(target.raw, this.address().origin);
				const routeRequest = {
					method,
					pathname: targetInfo.path,
					query: parsed.searchParams,
					headers: extensionRequestHeaders(request.headers),
					body,
					signal: abort.signal,
					deviceId: authorization.deviceId
				};
				const result = await extensions.route(targetInfo.id, method, targetInfo.path, routeRequest, generation);
				await this.sendExtensionResponse(response, result, request.method === "HEAD");
			} finally {
				generationSignal?.removeEventListener("abort", onGenerationAbort);
				abort.abort();
				operation.release();
			}
		}
	}
	async sendExtensionResponse(response, result, head) {
		const status = result.status ?? 200;
		if (!Number.isSafeInteger(status) || status < 200 || status > 599) throw new MobileExtensionError("invalid_route_response", "extension returned an invalid HTTP status", 500);
		const contentType = result.contentType ?? "application/octet-stream";
		if (contentType.length > 1024 || !/^[\x20-\x7e]+$/u.test(contentType) || !/^[\w!#$&+.^-]+\/[\w!#$&+.^-]+(?:;[\x20-\x7e]*)?$/u.test(contentType)) throw new MobileExtensionError("invalid_route_response", "extension returned an invalid content type", 500);
		const safeHeaders = {};
		for (const [name, value] of Object.entries(result.headers ?? {})) {
			if (!/^(?:content-disposition|cache-control|etag)$/iu.test(name) || /[\r\n]/u.test(value)) continue;
			safeHeaders[name] = value;
		}
		setSecurityHeaders(response, this.tlsEnabled);
		if (typeof result.body === "string" || result.body instanceof Uint8Array) {
			const body = typeof result.body === "string" ? Buffer.from(result.body) : Buffer.from(result.body);
			if (body.byteLength > 4194304) throw new MobileExtensionError("extension_result_too_large", "extension response is too large", 500);
			response.writeHead(status, {
				...safeHeaders,
				"Content-Type": contentType,
				"Content-Length": body.byteLength
			});
			if (head) response.end();
			else response.end(body);
			return;
		}
		response.writeHead(status, {
			...safeHeaders,
			"Content-Type": contentType
		});
		if (head) {
			result.body.destroy();
			response.end();
			return;
		}
		await pipeline(result.body, new ByteLimitTransform(4194304), response);
	}
	/** Exchange DSH's process-local launch token for an authority-bound cookie kept inside this gateway. */
	async upstreamCookieHeader() {
		if (this.upstreamAuthenticatedUrl === void 0) return void 0;
		if (this.upstreamCookie !== void 0 && this.upstreamCookieExpiresAt > Date.now() + UPSTREAM_AUTH_REFRESH_MARGIN_MS) return this.upstreamCookie;
		if (this.upstreamCookieTask !== void 0) return this.upstreamCookieTask;
		const task = this.exchangeUpstreamCookie();
		this.upstreamCookieTask = task;
		try {
			return await task;
		} finally {
			if (this.upstreamCookieTask === task) this.upstreamCookieTask = void 0;
		}
	}
	async exchangeUpstreamCookie() {
		const authenticatedUrl = this.upstreamAuthenticatedUrl;
		if (authenticatedUrl === void 0) throw new HttpError(502, "upstream_unavailable");
		let target;
		try {
			target = new URL(authenticatedUrl);
		} catch {
			throw new HttpError(502, "upstream_unavailable");
		}
		if (target.origin !== this.config.upstreamOrigin.origin || target.pathname !== "/" || target.hash !== "" || target.search === "") throw new HttpError(502, "upstream_unavailable");
		try {
			const proxied = await new Promise((resolve, reject) => {
				const upstreamRequest = request({
					protocol: "http:",
					hostname: stripIpv6Brackets(this.config.upstreamOrigin.hostname),
					port: Number(this.config.upstreamOrigin.port),
					method: "GET",
					path: `${target.pathname}${target.search}`,
					headers: {
						host: this.config.upstreamOrigin.host,
						accept: "text/html",
						"accept-encoding": "identity"
					},
					agent: false
				});
				this.upstreamAuthRequest = upstreamRequest;
				upstreamRequest.setTimeout(this.config.upstreamTimeoutMs, () => {
					upstreamRequest.destroy(new HttpError(504, "upstream_timeout"));
				});
				upstreamRequest.once("response", resolve);
				upstreamRequest.once("error", reject);
				upstreamRequest.end();
			});
			await new Promise((resolve, reject) => {
				proxied.once("end", resolve);
				proxied.once("error", reject);
				proxied.resume();
			});
			const setCookie = proxied.headers["set-cookie"]?.[0];
			const pair = setCookie?.split(";", 1)[0];
			const maxAgeText = setCookie === void 0 ? void 0 : /(?:^|;\s*)Max-Age=(\d+)(?:;|$)/iu.exec(setCookie)?.[1];
			const maxAgeSeconds = maxAgeText === void 0 ? NaN : Number(maxAgeText);
			const expiresAt = Date.now() + maxAgeSeconds * 1e3;
			if (proxied.statusCode !== 303 || pair === void 0 || pair.length > 4096 || !UPSTREAM_COOKIE_PAIR.test(pair) || !Number.isSafeInteger(expiresAt) || maxAgeSeconds <= 0) throw new HttpError(502, "upstream_unavailable");
			this.upstreamCookie = pair;
			this.upstreamCookieExpiresAt = expiresAt;
			return pair;
		} catch (error) {
			if (error instanceof HttpError) throw error;
			throw new HttpError(502, "upstream_unavailable");
		} finally {
			this.upstreamAuthRequest?.destroy();
			this.upstreamAuthRequest = void 0;
		}
	}
	/** List installed modules and resolve the next-open selection.
	* @param deviceId - Authenticated device identity; omitted for computer defaults.
	* @param callerSignal - Cancels catalog fetching when the admin request closes.
	* @returns The installed catalog and effective module selection.
	*/
	describeClientModules(deviceId, callerSignal) {
		return this.clientModulePreferenceOperation("describe", void 0, deviceId, callerSignal);
	}
	/** Persist a validated device override or computer default.
	* @param excluded - Untrusted module IDs to validate against the current boot graph.
	* @param deviceId - Authenticated device identity; omitted for computer defaults.
	* @param callerSignal - Cancels fetching and validation, not an atomic write already started.
	* @returns The catalog and saved selection without reloading clients.
	*/
	configureClientModules(excluded, deviceId, callerSignal) {
		return this.clientModulePreferenceOperation("configure", excluded, deviceId, callerSignal);
	}
	/** Reset one override without reloading connected clients.
	* @param deviceId - Authenticated device identity; omitted to reset computer defaults.
	* @param callerSignal - Cancels fetching and validation, not an atomic write already started.
	* @returns The catalog and inherited selection.
	*/
	resetClientModules(deviceId, callerSignal) {
		return this.clientModulePreferenceOperation("reset", void 0, deviceId, callerSignal);
	}
	async clientModulePreferenceOperation(kind, excluded, deviceId, callerSignal) {
		if (this.closing || !this.started) throw new HttpError(503, "unavailable");
		const controller = new AbortController();
		const abort = () => controller.abort();
		if (callerSignal?.aborted === true) controller.abort();
		callerSignal?.addEventListener("abort", abort, { once: true });
		this.clientModuleOperations.add(controller);
		const task = (async () => {
			let html = "";
			const validate = async (selection) => {
				html = (await this.fetchAuthenticatedUpstreamIndex(controller.signal)).html;
				try {
					parseMobileBootPlan(html, selection);
				} catch (error) {
					if (error instanceof ExcludedClientModulesError) throw new ClientModuleConflictError(error.message);
					throw new HttpError(502, "upstream_unavailable");
				}
				controller.signal.throwIfAborted();
			};
			let selection;
			if (kind === "configure") {
				let ids;
				try {
					ids = parseExcludedClientModules(excluded);
				} catch {
					throw new HttpError(400, "excluded_client_modules_invalid");
				}
				selection = await this.clientModulePreferences.configure(ids, deviceId, validate);
			} else if (kind === "reset") selection = await this.clientModulePreferences.reset(deviceId, validate);
			else {
				html = (await this.fetchAuthenticatedUpstreamIndex(controller.signal)).html;
				selection = await this.clientModulePreferences.read(deviceId);
			}
			controller.signal.throwIfAborted();
			try {
				const plan = parseMobileBootPlan(html);
				return Object.freeze({
					entries: describeMobileClientModules(html),
					...selection,
					...plan.batches === void 0 ? {
						excludedClientModules: Object.freeze([]),
						defaultExcludedClientModules: Object.freeze([])
					} : {},
					reloadRequired: true
				});
			} catch (error) {
				if (error instanceof HttpError) throw error;
				throw new HttpError(502, "upstream_unavailable");
			}
		})();
		this.clientModuleTasks.add(task);
		try {
			return await task;
		} finally {
			callerSignal?.removeEventListener("abort", abort);
			this.clientModuleOperations.delete(controller);
			this.clientModuleTasks.delete(task);
		}
	}
	async fetchAuthenticatedUpstreamIndex(signal, incoming) {
		signal.throwIfAborted();
		let upstreamRequest;
		const abort = () => {
			upstreamRequest?.destroy(requestAbortedError());
		};
		signal.addEventListener("abort", abort, { once: true });
		try {
			const headers = incoming === void 0 ? {
				host: this.config.upstreamOrigin.host,
				accept: "text/html",
				"accept-encoding": "identity"
			} : sanitizeRequestHeaders(incoming, this.config.upstreamOrigin);
			const upstreamCookie = await waitForRequestTask(this.upstreamCookieHeader(), signal);
			signal.throwIfAborted();
			if (upstreamCookie !== void 0) headers.cookie = upstreamCookie;
			headers["accept-encoding"] = "identity";
			const proxied = await new Promise((resolve, reject) => {
				upstreamRequest = request({
					protocol: "http:",
					hostname: stripIpv6Brackets(this.config.upstreamOrigin.hostname),
					port: Number(this.config.upstreamOrigin.port),
					method: "GET",
					path: incoming?.url ?? "/",
					headers,
					agent: false
				});
				upstreamRequest.setTimeout(this.config.upstreamTimeoutMs, () => {
					upstreamRequest?.destroy(new HttpError(504, "upstream_timeout"));
				});
				upstreamRequest.once("response", resolve);
				upstreamRequest.once("error", reject);
				upstreamRequest.end();
			});
			if (proxied.statusCode !== 200) throw new HttpError(502, "upstream_unavailable");
			const chunks = [];
			let bytes = 0;
			for await (const chunk of proxied) {
				const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
				bytes += buffer.byteLength;
				if (bytes > 4194304) throw new HttpError(502, "upstream_unavailable");
				chunks.push(buffer);
			}
			signal.throwIfAborted();
			return {
				html: Buffer.concat(chunks).toString("utf8"),
				headers: proxied.headers
			};
		} catch (error) {
			if (signal.aborted || error instanceof HttpError) throw error;
			throw new HttpError(502, "upstream_unavailable");
		} finally {
			signal.removeEventListener("abort", abort);
			upstreamRequest?.destroy();
		}
	}
	async proxyMobileIndex(request, response, authorization) {
		const holder = {};
		const operation = this.allocateRequest(authorization, response, holder);
		const onClose = () => {
			operation.abort();
			operation.release();
		};
		response.once("close", onClose);
		try {
			const index = await this.fetchAuthenticatedUpstreamIndex(operation.signal, request);
			const preference = await this.clientModulePreferences.read(authorization.deviceId);
			const excludedClientModules = preference.excludedClientModules;
			let body;
			try {
				const html = index.html;
				const plan = parseMobileBootPlan(html, excludedClientModules);
				const options = plan.rewrittenBatchEntries === void 0 ? { excludedClientModules } : {
					...await this.resolveMobileBootSizes(plan.rewrittenBatchEntries.flatMap((batch) => batch.entries), operation.signal),
					excludedClientModules
				};
				const cookies = browserAuthCookies(request.headers.cookie);
				const csrfCookie = this.tlsEnabled && cookies.has("__Host-dsh_ma_session") ? HOST_CSRF_COOKIE : CSRF_COOKIE;
				const rewritten = rewriteMobileIndexWithBatch(html, {
					...options,
					csrfCookie
				});
				for (const batch of rewritten.batches) this.rememberMobileBootBatch(batch);
				body = Buffer.from(rewritten.html);
			} catch (error) {
				if (error instanceof ExcludedClientModulesError) {
					const detail = error.message.replace(/[\r\n]/gu, " ").slice(0, 512);
					if (detail !== this.lastModuleExclusionError) {
						this.lastModuleExclusionError = detail;
						process.emitWarning(detail, { code: "DSH_MOBILE_MODULE_EXCLUSION_INVALID" });
					}
					if (preference.source === "device" || preference.source === "computer") {
						operation.signal.throwIfAborted();
						const locale = resolveAuthPageLocale(headerValue(request.headers, "accept-language"));
						const recovery = Buffer.from(renderClientModuleRecoveryPage(locale));
						setSecurityHeaders(response, this.tlsEnabled);
						response.writeHead(200, {
							"Content-Type": "text/html; charset=utf-8",
							"Content-Length": recovery.byteLength
						});
						response.end(recovery);
						return;
					}
					sendJson(response, 409, {
						error: "excluded_client_modules_invalid",
						detail
					}, this.tlsEnabled);
					return;
				}
				throw new HttpError(502, "upstream_unavailable");
			}
			operation.signal.throwIfAborted();
			const headers = sanitizeResponseHeaders(index.headers, this.config.upstreamOrigin);
			delete headers["content-length"];
			delete headers["content-encoding"];
			delete headers.etag;
			setSecurityHeaders(response, this.tlsEnabled, "proxied");
			response.writeHead(200, {
				...headers,
				"Content-Type": "text/html; charset=utf-8",
				"Content-Length": body.byteLength
			});
			response.end(body);
		} catch (error) {
			holder.request?.destroy();
			if (error instanceof HttpError) throw error;
			if (response.headersSent) response.destroy();
			else throw new HttpError(502, "upstream_unavailable");
		} finally {
			response.removeListener("close", onClose);
			operation.release();
		}
	}
	rememberMobileBootBatch(plan) {
		const existing = this.mobileBootBatches.get(plan.key);
		this.mobileBootBatches.delete(plan.key);
		this.mobileBootBatches.set(plan.key, existing ?? { plan });
		while (this.mobileBootBatches.size > MAX_MOBILE_BOOT_BATCHES) {
			const oldest = this.mobileBootBatches.keys().next().value;
			if (oldest === void 0) break;
			this.mobileBootBatches.get(oldest)?.assembly?.controller.abort();
			this.mobileBootBatches.delete(oldest);
		}
	}
	/**
	* Determine which layout-batch entries can share a merged boot batch and which
	* must pass through. An entry at or above the per-entry cap, or one whose size
	* could not be probed, keeps its own upstream `/plugins` row: a merged batch
	* cannot carry it, and an unknown bundle must not risk the whole batch.
	*/
	async resolveMobileBootSizes(planEntries, signal) {
		const sizes = /* @__PURE__ */ new Map();
		const passThrough = /* @__PURE__ */ new Set();
		const candidates = planEntries.filter((entry) => entry.id !== MOBILE_LAYOUT_MODULE && upstreamPluginBundleUrl(entry.url, this.config.upstreamOrigin) !== void 0);
		let cursor = 0;
		const worker = async () => {
			while (cursor < candidates.length) {
				signal?.throwIfAborted();
				const index = cursor++;
				const source = candidates[index].url;
				const size = await this.upstreamBundleSize(source, signal);
				if (size === void 0 || size >= MAX_MOBILE_BOOT_ENTRY_BYTES) passThrough.add(source);
				else sizes.set(source, size);
			}
		};
		await Promise.all(Array.from({ length: Math.min(8, candidates.length) }, worker));
		return {
			sizes,
			passThrough
		};
	}
	/**
	* Measure one upstream bundle by reading its body. The upstream serves
	* `/plugins` bundles as chunked streams without a Content-Length, so a probe
	* counts bytes; it aborts instantly past the per-entry cap. Measurements are
	* cached for a short window.
	*/
	async upstreamBundleSize(source, signal) {
		signal?.throwIfAborted();
		const target = upstreamPluginBundleUrl(source, this.config.upstreamOrigin);
		if (target === void 0) return void 0;
		const cached = this.bootEntrySizeCache.get(source);
		if (cached !== void 0 && Date.now() - cached.at < MOBILE_BOOT_SIZE_CACHE_TTL_MS) return cached.size;
		let upstreamRequest;
		const abort = () => {
			upstreamRequest?.destroy(requestAbortedError());
		};
		signal?.addEventListener("abort", abort, { once: true });
		try {
			const upstreamCookie = signal === void 0 ? await this.upstreamCookieHeader() : await waitForRequestTask(this.upstreamCookieHeader(), signal);
			signal?.throwIfAborted();
			const proxied = await new Promise((resolve, reject) => {
				upstreamRequest = request({
					protocol: "http:",
					hostname: stripIpv6Brackets(this.config.upstreamOrigin.hostname),
					port: Number(this.config.upstreamOrigin.port),
					method: "GET",
					path: `${target.pathname}${target.search}`,
					headers: {
						host: this.config.upstreamOrigin.host,
						accept: "text/javascript",
						"accept-encoding": "identity",
						[MOBILE_BOOT_SIZE_PROBE_HEADER]: "1",
						...upstreamCookie === void 0 ? {} : { cookie: upstreamCookie }
					},
					agent: false
				});
				upstreamRequest.setTimeout(this.config.upstreamTimeoutMs, () => {
					upstreamRequest?.destroy(upstreamTimeoutError());
				});
				upstreamRequest.once("response", resolve);
				upstreamRequest.once("error", reject);
				upstreamRequest.end();
			});
			if (proxied.statusCode !== 200) {
				proxied.resume();
				return;
			}
			const size = await new Promise((resolve, reject) => {
				let bytes = 0;
				proxied.on("data", (chunk) => {
					bytes += chunk.length;
					if (bytes > MAX_MOBILE_BOOT_ENTRY_BYTES) {
						proxied.destroy();
						resolve(void 0);
					}
				});
				proxied.once("end", () => resolve(bytes));
				proxied.once("error", reject);
			});
			if (size === void 0) return void 0;
			this.bootEntrySizeCache.set(source, {
				size,
				at: Date.now()
			});
			return size;
		} catch (error) {
			if (signal?.aborted === true) throw error;
			return;
		} finally {
			signal?.removeEventListener("abort", abort);
			upstreamRequest?.destroy();
		}
	}
	async serveMobileBootBatch(key, request, response, authorization) {
		if (request.method !== "GET" && request.method !== "HEAD") throw new HttpError(405, "method_not_allowed");
		const stored = this.mobileBootBatches.get(key);
		if (stored === void 0) throw new HttpError(404, "not_found");
		const operation = this.allocateRequest(authorization, response, {});
		response.once("close", operation.abort);
		try {
			const layoutStat = await stat(this.config.mobileLayoutFile);
			if (stored.body === void 0 || stored.etag === void 0 || stored.layoutMtimeMs !== layoutStat.mtimeMs) {
				operation.signal.throwIfAborted();
				await waitForRequestTask((stored.assembly ?? this.startMobileBootBatchAssembly(stored, layoutStat.mtimeMs)).task, operation.signal);
			}
			const compressed = acceptsGzip(request.headers["accept-encoding"]);
			const assembled = stored.body;
			if (assembled === void 0) throw new HttpError(502, "upstream_unavailable");
			const body = compressed ? stored.gzipBody ??= await gzipBuffer(assembled) : assembled;
			const etag = compressed ? `${stored.etag}-gzip` : stored.etag;
			const headers = {
				"Content-Type": "text/javascript; charset=utf-8",
				"Content-Length": body.byteLength,
				"Cache-Control": "private, no-cache",
				ETag: etag
			};
			if (compressed) headers["Content-Encoding"] = "gzip";
			addVaryAcceptEncoding(headers);
			if (headerValue(request.headers, "if-none-match") === etag) {
				setSecurityHeaders(response, this.tlsEnabled);
				response.writeHead(304, {
					ETag: etag,
					"Cache-Control": "private, no-cache",
					Vary: String(headers.vary)
				});
				response.end();
				return;
			}
			setSecurityHeaders(response, this.tlsEnabled);
			response.writeHead(200, headers);
			if (request.method === "HEAD") response.end();
			else response.end(body);
		} catch (error) {
			if (error.code === "ENOENT") throw new HttpError(503, "mobile_frontend_unavailable");
			throw error;
		} finally {
			response.removeListener("close", operation.abort);
			operation.release();
		}
	}
	startMobileBootBatchAssembly(stored, layoutMtimeMs) {
		const controller = new AbortController();
		const task = (async () => {
			const body = await this.assembleMobileBootBatch(stored.plan, controller.signal);
			stored.body = body;
			delete stored.gzipBody;
			stored.etag = createHash("sha256").update(body).digest("hex");
			stored.layoutMtimeMs = layoutMtimeMs;
			return body;
		})();
		const assembly = Object.freeze({
			controller,
			task
		});
		stored.assembly = assembly;
		task.then(() => {
			if (stored.assembly === assembly) delete stored.assembly;
		}, () => {
			if (stored.assembly === assembly) delete stored.assembly;
		});
		return assembly;
	}
	async assembleMobileBootBatch(plan, signal) {
		const bodies = new Array(plan.entries.length);
		let cursor = 0;
		const worker = async () => {
			while (cursor < plan.entries.length) {
				const index = cursor++;
				const entry = plan.entries[index];
				bodies[index] = entry.id === MOBILE_LAYOUT_MODULE ? await readFile(this.config.mobileLayoutFile, { signal }) : await this.readUpstreamClientBundleWithRetry(entry.url, signal);
				if (bodies[index].byteLength > MAX_MOBILE_BOOT_ENTRY_BYTES) throw new HttpError(502, "upstream_unavailable");
			}
		};
		await Promise.all(Array.from({ length: Math.min(3, plan.entries.length) }, worker));
		if (bodies.reduce((bytes, body) => bytes + body.byteLength + MOBILE_BOOT_SEPARATOR_BYTES, 0) > MAX_MOBILE_BOOT_BATCH_BYTES) throw new HttpError(502, "upstream_unavailable");
		return Buffer.concat(bodies.flatMap((body) => [body, Buffer.from("\n;\n")]));
	}
	/**
	* Read one upstream bundle, retrying transient connection failures.
	*
	* Assembling a batch fans out over every client entry, and the upstream
	* resets a fraction of those connections before sending a byte
	* (`read ECONNRESET`, recv=0) — randomly, on any entry, at any concurrency.
	* A single such reset used to fail the whole batch with 502
	* `upstream_unavailable`, surfacing in the browser as "bundle script
	* /mobile-access/mobile-boot/<hash>.js failed to load". Retrying recovers
	* every observed reset; a genuine upstream error still fails.
	*/
	async readUpstreamClientBundleWithRetry(source, signal) {
		for (let attempt = 1; attempt <= MOBILE_BOOT_UPSTREAM_ATTEMPTS; attempt++) {
			signal.throwIfAborted();
			try {
				return await this.readUpstreamClientBundle(source, signal);
			} catch (error) {
				if (signal.aborted) throw error;
				if (!isTransientUpstreamError(error)) throw error;
				if (attempt === MOBILE_BOOT_UPSTREAM_ATTEMPTS) throw new HttpError(502, "upstream_unavailable");
				await waitForAbortableDelay(MOBILE_BOOT_RETRY_DELAY_MS * attempt, signal);
			}
		}
		throw new HttpError(502, "upstream_unavailable");
	}
	async readUpstreamClientBundle(source, signal) {
		signal.throwIfAborted();
		const target = upstreamPluginBundleUrl(source, this.config.upstreamOrigin);
		if (target === void 0) throw new HttpError(502, "upstream_unavailable");
		let upstreamRequest;
		const aborted = () => {
			upstreamRequest?.destroy(/* @__PURE__ */ new Error("request aborted"));
		};
		signal.addEventListener("abort", aborted, { once: true });
		try {
			const upstreamCookie = await this.upstreamCookieHeader();
			signal.throwIfAborted();
			const proxied = await new Promise((resolve, reject) => {
				upstreamRequest = request({
					protocol: "http:",
					hostname: stripIpv6Brackets(this.config.upstreamOrigin.hostname),
					port: Number(this.config.upstreamOrigin.port),
					method: "GET",
					path: `${target.pathname}${target.search}`,
					headers: {
						host: this.config.upstreamOrigin.host,
						accept: "text/javascript",
						"accept-encoding": "identity",
						...upstreamCookie === void 0 ? {} : { cookie: upstreamCookie }
					},
					agent: false
				});
				upstreamRequest.setTimeout(this.config.upstreamTimeoutMs, () => {
					upstreamRequest?.destroy(upstreamTimeoutError());
				});
				upstreamRequest.once("response", resolve);
				upstreamRequest.once("error", reject);
				upstreamRequest.end();
			});
			if ((proxied.statusCode ?? 502) !== 200) throw new HttpError(502, "upstream_unavailable");
			const chunks = [];
			let bytes = 0;
			for await (const chunk of proxied) {
				const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
				bytes += buffer.byteLength;
				if (bytes > MAX_MOBILE_BOOT_ENTRY_BYTES) throw new HttpError(502, "upstream_unavailable");
				chunks.push(buffer);
			}
			return Buffer.concat(chunks);
		} catch (error) {
			if (error instanceof HttpError) throw error;
			if (signal.aborted || isTransientUpstreamError(error)) throw error;
			throw new HttpError(502, "upstream_unavailable");
		} finally {
			signal.removeEventListener("abort", aborted);
			upstreamRequest?.destroy();
		}
	}
	allocateRequest(authorization, response, upstream) {
		if (this.closing || response.destroyed || response.writableEnded) throw requestAbortedError();
		if (this.activeRequests.size >= this.config.maxActiveRequests) throw new HttpError(429, "busy");
		const id = this.nextOperationId++;
		const controller = new AbortController();
		const abort = () => {
			controller.abort();
			upstream.request?.destroy();
			if (!response.destroyed) response.destroy();
		};
		const timer = setTimeout(abort, Math.max(1, authorization.expiresAt - Date.now()));
		timer.unref();
		this.activeRequests.set(id, Object.freeze({
			...authorization,
			abort,
			timer
		}));
		return {
			id,
			signal: controller.signal,
			abort,
			release: () => {
				const entry = this.activeRequests.get(id);
				if (entry !== void 0) clearTimeout(entry.timer);
				this.activeRequests.delete(id);
			}
		};
	}
	/**
	* Proxy one request, retrying transient failures for plugin and asset GETs.
	* Only bodyless GETs can be replayed, before response headers reach the client.
	* One request slot and cancellation signal cover attempts and backoff together.
	* API requests and requests with bodies are forwarded once.
	*/
	async proxyHttp(request, response, authorization) {
		const declared = request.headers["content-length"];
		if (declared !== void 0 && (!/^\d+$/u.test(declared) || Number(declared) > this.config.maxBodyBytes)) throw new HttpError(413, "payload_too_large");
		const replayable = request.method === "GET" && request.headers["transfer-encoding"] === void 0 && (declared === void 0 || Number(declared) === 0) && (request.url?.split("?", 1)[0]?.startsWith("/plugins/") === true || request.url?.split("?", 1)[0]?.startsWith("/assets/") === true);
		const holder = {};
		const operation = this.allocateRequest(authorization, response, holder);
		const onClose = () => {
			operation.release();
			operation.abort();
		};
		response.once("close", onClose);
		if (replayable) request.resume();
		try {
			const attempts = replayable ? MOBILE_BOOT_UPSTREAM_ATTEMPTS : 1;
			for (let attempt = 1; attempt <= attempts; attempt++) {
				operation.signal.throwIfAborted();
				try {
					await this.proxyHttpOnce(request, response, holder, operation.signal, replayable);
					return;
				} catch (error) {
					if (operation.signal.aborted || response.destroyed) return;
					if (response.headersSent) {
						response.destroy();
						return;
					}
					if (error instanceof HttpError || !isTransientUpstreamError(error)) throw error instanceof HttpError ? error : new HttpError(502, "upstream_unavailable");
					if (attempt === attempts) throw new HttpError(502, "upstream_unavailable");
					await waitForAbortableDelay(MOBILE_BOOT_RETRY_DELAY_MS * attempt, operation.signal);
				}
			}
		} catch (error) {
			if (!operation.signal.aborted) throw error;
		} finally {
			response.removeListener("close", onClose);
			operation.release();
		}
	}
	async proxyHttpOnce(request$2, response, holder, signal, replayable) {
		let bodyDone;
		try {
			const upstreamHeaders = sanitizeRequestHeaders(request$2, this.config.upstreamOrigin);
			if (request$2.headers["transfer-encoding"] !== void 0) upstreamHeaders["transfer-encoding"] = request$2.headers["transfer-encoding"];
			const upstreamCookie = await this.upstreamCookieHeader();
			signal.throwIfAborted();
			if (upstreamCookie !== void 0) upstreamHeaders.cookie = upstreamCookie;
			const proxied = await new Promise((resolve, reject) => {
				const upstreamRequest = request({
					protocol: "http:",
					hostname: stripIpv6Brackets(this.config.upstreamOrigin.hostname),
					port: Number(this.config.upstreamOrigin.port),
					method: request$2.method,
					path: request$2.url,
					headers: upstreamHeaders,
					agent: false
				});
				holder.request = upstreamRequest;
				upstreamRequest.setTimeout(this.config.upstreamTimeoutMs, () => {
					upstreamRequest.destroy(new HttpError(504, "upstream_timeout"));
				});
				const pathname = parseRequestTarget(request$2.url).decodedPathname;
				if (pathname === "/api" || pathname.startsWith("/api/")) upstreamRequest.once("finish", () => {
					upstreamRequest.setTimeout(this.config.upstreamApiTimeoutMs);
				});
				upstreamRequest.once("response", resolve);
				upstreamRequest.once("error", reject);
				if (replayable) upstreamRequest.end();
				else {
					bodyDone = pipeline(request$2, new ByteLimitTransform(this.config.maxBodyBytes), upstreamRequest);
					bodyDone.catch(reject);
				}
			});
			setSecurityHeaders(response, this.tlsEnabled, "proxied");
			const headers = sanitizeResponseHeaders(proxied.headers, this.config.upstreamOrigin);
			const statusCode = proxied.statusCode ?? 502;
			const cacheControl = revisionedStaticCacheControl(request$2, statusCode);
			if (cacheControl !== void 0) headers["cache-control"] = cacheControl;
			const compressed = shouldCompressResponse(request$2, proxied);
			if (compressed) {
				delete headers["accept-ranges"];
				delete headers["content-length"];
				delete headers.etag;
				headers["content-encoding"] = "gzip";
				addVaryAcceptEncoding(headers);
			}
			response.writeHead(statusCode, headers);
			await Promise.all([bodyDone, compressed ? pipeline(proxied, createGzip(), response) : pipeline(proxied, response)]);
		} catch (error) {
			holder.request?.destroy();
			await bodyDone?.catch(() => void 0);
			if (error instanceof HttpError) throw error;
			if (response.headersSent) response.destroy();
			throw error;
		} finally {
			delete holder.request;
		}
	}
	abortSessionResources(sessionKey) {
		for (const request of this.activeRequests.values()) if (request.sessionKey === sessionKey) request.abort();
		for (const socket of this.activeWebSockets.values()) if (socket.sessionKey === sessionKey) {
			socket.client.destroy();
			socket.upstream.destroy();
		}
	}
	broadcastExtensionChange() {
		if (this.closing) return;
		this.extensionEventRevision += 1;
		for (const listener of this.extensionEventListeners) listener(this.extensionEventRevision);
	}
	/** Fan a completed task to every phone holding this gateway's event stream. */
	broadcastTaskEvent(event) {
		if (this.closing) return;
		const payload = JSON.stringify({
			sessionId: String(event.sessionId),
			turn: Number(event.turn) || 0
		});
		for (const listener of this.taskEventListeners) listener(payload);
	}
	/** Notify only the device whose persistent credential was revoked by the Host. */
	broadcastDeviceRevoked(deviceId) {
		const listeners = this.deviceEventListeners.get(deviceId);
		if (listeners === void 0) return;
		const payload = JSON.stringify({ reason: "device_revoked" });
		for (const listener of [...listeners]) listener(payload);
	}
	pollLegacyCustomChanges() {
		if (this.extensionChangeTask !== void 0) return this.extensionChangeTask;
		const digestFile = async (path, fallback) => {
			try {
				const info = await stat(path);
				if (!info.isFile() || info.size > 262144) return `invalid:${String(info.size)}:${String(info.mtimeMs)}`;
				return createHash("sha256").update(await readFile(path)).digest("hex");
			} catch (error) {
				if (error.code === "ENOENT") return createHash("sha256").update(fallback).digest("hex");
				return `error:${String(error.code ?? "unknown")}`;
			}
		};
		const task = Promise.all([digestFile(this.config.customScriptFile, CUSTOM_SCRIPT_FALLBACK), digestFile(this.config.customCssFile, CUSTOM_STYLE_FALLBACK)]).then((parts) => {
			const next = createHash("sha256").update(parts.join("|")).digest("hex");
			if (this.legacyCustomDigest !== "" && next !== this.legacyCustomDigest) this.broadcastExtensionChange();
			this.legacyCustomDigest = next;
		}).finally(() => {
			if (this.extensionChangeTask === task) this.extensionChangeTask = void 0;
		});
		this.extensionChangeTask = task;
		return task;
	}
	openExtensionEventStream(request, response, authorization) {
		const operation = this.allocateRequest(authorization, response, {});
		let closed = false;
		let heartbeat;
		const close = () => {
			if (closed) return;
			closed = true;
			if (heartbeat !== void 0) clearInterval(heartbeat);
			this.extensionEventListeners.delete(send);
			this.taskEventListeners.delete(sendTask);
			const deviceListeners = this.deviceEventListeners.get(authorization.deviceId);
			deviceListeners?.delete(sendDevice);
			if (deviceListeners?.size === 0) this.deviceEventListeners.delete(authorization.deviceId);
			request.removeListener("aborted", close);
			response.removeListener("close", close);
			operation.release();
		};
		const send = (revision) => {
			if (closed || response.destroyed || response.writableEnded) return;
			response.write(`id: ${String(revision)}\nevent: extensions-changed\ndata: {\"revision\":${String(revision)}}\n\n`);
		};
		const sendTask = (payload) => {
			if (closed || response.destroyed || response.writableEnded) return;
			response.write(`event: task-notify\ndata: ${payload}\n\n`);
		};
		const sendDevice = (payload) => {
			if (closed || response.destroyed || response.writableEnded) return;
			response.write(`event: device-revoked\ndata: ${payload}\n\n`);
		};
		setSecurityHeaders(response, this.tlsEnabled);
		response.writeHead(200, {
			"Content-Type": "text/event-stream; charset=utf-8",
			"Cache-Control": "no-store",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no"
		});
		response.write("retry: 2000\n: ready\n\n");
		this.extensionEventListeners.add(send);
		this.taskEventListeners.add(sendTask);
		const deviceListeners = this.deviceEventListeners.get(authorization.deviceId) ?? /* @__PURE__ */ new Set();
		deviceListeners.add(sendDevice);
		this.deviceEventListeners.set(authorization.deviceId, deviceListeners);
		heartbeat = setInterval(() => {
			if (!closed && !response.destroyed && !response.writableEnded) response.write(": heartbeat\n\n");
		}, EXTENSION_EVENT_HEARTBEAT_MS);
		heartbeat.unref();
		request.once("aborted", close);
		response.once("close", close);
	}
	async readUpgradeResponse(upstream, expectedAccept) {
		return new Promise((resolve, reject) => {
			let buffer = Buffer.alloc(0);
			const failed = (error) => {
				cleanup();
				reject(error);
			};
			const closed = () => {
				cleanup();
				reject(/* @__PURE__ */ new Error("upstream closed during WebSocket handshake"));
			};
			const data = (chunk) => {
				buffer = Buffer.concat([buffer, chunk]);
				const end = buffer.indexOf("\r\n\r\n");
				if (end < 0) {
					if (buffer.length >= MAX_HEADER_BYTES) failed(/* @__PURE__ */ new Error("upstream WebSocket headers are too large"));
					return;
				}
				if (end + 4 > MAX_HEADER_BYTES) {
					failed(/* @__PURE__ */ new Error("upstream WebSocket headers are too large"));
					return;
				}
				cleanup();
				const lines = buffer.subarray(0, end).toString("latin1").split("\r\n");
				if (lines.shift() !== "HTTP/1.1 101 Switching Protocols") {
					reject(/* @__PURE__ */ new Error("upstream refused WebSocket upgrade"));
					return;
				}
				const selected = /* @__PURE__ */ new Map();
				for (const line of lines) {
					const colon = line.indexOf(":");
					if (colon <= 0) {
						reject(/* @__PURE__ */ new Error("upstream returned malformed WebSocket headers"));
						return;
					}
					const name = line.slice(0, colon).trim().toLowerCase();
					const value = line.slice(colon + 1).trim();
					if (selected.has(name)) {
						reject(/* @__PURE__ */ new Error("upstream returned duplicate WebSocket headers"));
						return;
					}
					selected.set(name, value);
				}
				if (selected.get("upgrade")?.toLowerCase() !== "websocket" || !hasToken(selected.get("connection"), "upgrade") || selected.get("sec-websocket-accept") !== expectedAccept) {
					reject(/* @__PURE__ */ new Error("upstream returned an invalid WebSocket handshake"));
					return;
				}
				const output = [
					"HTTP/1.1 101 Switching Protocols",
					"Upgrade: websocket",
					"Connection: Upgrade",
					`Sec-WebSocket-Accept: ${expectedAccept}`
				];
				const protocol = selected.get("sec-websocket-protocol");
				const extensions = selected.get("sec-websocket-extensions");
				if (protocol !== void 0) output.push(`Sec-WebSocket-Protocol: ${protocol}`);
				if (extensions !== void 0) output.push(`Sec-WebSocket-Extensions: ${extensions}`);
				output.push("Referrer-Policy: no-referrer", "X-Content-Type-Options: nosniff", "", "");
				resolve({
					header: output.join("\r\n"),
					remainder: buffer.subarray(end + 4)
				});
			};
			const cleanup = () => {
				upstream.off("data", data);
				upstream.off("error", failed);
				upstream.off("close", closed);
			};
			upstream.on("data", data);
			upstream.once("error", failed);
			upstream.once("close", closed);
		});
	}
	/** Snapshot of rejected upgrade paths for the approval UI (newest first). */
	blockedUpgradePathReport() {
		return this.blockedUpgradeLog?.report() ?? [];
	}
	async handleUpgrade(request, client, head) {
		const target = parseRequestTarget(request.url);
		const policy = this.requirePolicy();
		assertExternalTrust(request, policy, false);
		if (!policy.acceptsOrigin(request.headers.origin)) throw new HttpError(403, "forbidden");
		if (!(WS_PATHS.has(target.decodedPathname) || (this.extraWebSocketPaths?.has(target.decodedPathname) ?? false))) {
			this.blockedUpgradeLog?.record(target.decodedPathname);
			throw new HttpError(404, "not_found");
		}
		if (request.method !== "GET" || headerValue(request.headers, "upgrade")?.toLowerCase() !== "websocket" || !hasToken(headerValue(request.headers, "connection"), "upgrade")) throw new HttpError(400, "bad_request");
		const key = headerValue(request.headers, "sec-websocket-key");
		if (key === void 0 || headerValue(request.headers, "sec-websocket-version") !== "13") throw new HttpError(400, "bad_request");
		let decodedKey;
		try {
			decodedKey = Buffer.from(key, "base64");
		} catch {
			throw new HttpError(400, "bad_request");
		}
		if (decodedKey.length !== 16 || decodedKey.toString("base64") !== key) throw new HttpError(400, "bad_request");
		let authorization = this.authorize(request);
		if (this.activeWebSockets.size >= this.config.maxWebSockets) throw new HttpError(429, "busy");
		const upstreamCookie = await this.upstreamCookieHeader();
		if (client.destroyed) return;
		authorization = this.authorize(request);
		if (this.activeWebSockets.size >= this.config.maxWebSockets) throw new HttpError(429, "busy");
		const compressed = this.config.websocketCompression.paths.includes(target.decodedPathname);
		const upstream = connect({
			host: stripIpv6Brackets(this.config.upstreamOrigin.hostname),
			port: Number(this.config.upstreamOrigin.port)
		});
		client.pause();
		const id = this.nextOperationId++;
		const closeBoth = () => {
			client.destroy();
			upstream.destroy();
		};
		client.on("error", closeBoth);
		upstream.on("error", closeBoth);
		const timer = setTimeout(closeBoth, Math.max(1, authorization.expiresAt - Date.now()));
		timer.unref();
		const record = Object.freeze({
			...authorization,
			client,
			upstream,
			timer
		});
		this.activeWebSockets.set(id, record);
		const cleanup = () => {
			if (compressed && (!client.destroyed || !upstream.destroyed)) return;
			const active = this.activeWebSockets.get(id);
			if (active !== void 0) clearTimeout(active.timer);
			this.activeWebSockets.delete(id);
		};
		client.once("close", () => {
			if (!compressed) upstream.destroy();
			cleanup();
		});
		upstream.once("close", () => {
			if (!compressed) client.destroy();
			cleanup();
		});
		upstream.setTimeout(this.config.upstreamTimeoutMs, closeBoth);
		try {
			if (compressed) {
				const compressionTarget = new URL(this.config.upstreamOrigin.href);
				compressionTarget.pathname = target.pathname;
				compressionTarget.search = target.search;
				await bridgeCompressedWebSocket(request, client, upstream, head, compressionTarget, upstreamCookie, this.config.websocketCompression, this.config.upstreamTimeoutMs);
				return;
			}
			await new Promise((resolve, reject) => {
				const connected = () => {
					upstream.off("error", failed);
					resolve();
				};
				const failed = (error) => {
					upstream.off("connect", connected);
					reject(error);
				};
				upstream.once("connect", connected);
				upstream.once("error", failed);
			});
			const requestLines = [
				`GET ${target.raw} HTTP/1.1`,
				`Host: ${this.config.upstreamOrigin.host}`,
				"Upgrade: websocket",
				"Connection: Upgrade",
				`Origin: ${this.config.upstreamOrigin.origin}`,
				"Sec-Fetch-Site: same-origin",
				`Sec-WebSocket-Key: ${key}`,
				"Sec-WebSocket-Version: 13"
			];
			if (upstreamCookie !== void 0) requestLines.push(`Cookie: ${upstreamCookie}`);
			const protocol = headerValue(request.headers, "sec-websocket-protocol");
			const extensions = headerValue(request.headers, "sec-websocket-extensions");
			if (protocol !== void 0) requestLines.push(`Sec-WebSocket-Protocol: ${protocol}`);
			if (extensions !== void 0) requestLines.push(`Sec-WebSocket-Extensions: ${extensions}`);
			requestLines.push("", "");
			upstream.write(requestLines.join("\r\n"));
			if (head.length > 0) upstream.write(head);
			const handshake = await this.readUpgradeResponse(upstream, websocketAccept(key));
			upstream.setTimeout(0);
			client.write(handshake.header);
			if (handshake.remainder.length > 0) client.write(handshake.remainder);
			upstream.pipe(client);
			client.pipe(upstream);
			client.resume();
		} catch (error) {
			closeBoth();
			if (error instanceof HttpError) throw error;
			throw new HttpError(502, "upstream_unavailable");
		}
	}
	/** Loopback-only DSH WebServer route for opening pairing and managing devices. */
	localAdminRoute(prefix = LOCAL_ADMIN_PREFIX, authenticateDesktop) {
		return {
			kind: "prefix",
			path: prefix,
			handler: async (request, response) => {
				try {
					const target = parseRequestTarget(request.url);
					assertLocalAdminTrust(request, request.method === "POST", () => authenticateDesktop?.(request) === true);
					if (target.search !== "") throw new HttpError(400, "bad_request");
					if (request.method === "GET" && target.decodedPathname === `${prefix}/status`) {
						sendJson(response, 200, {
							gateway: this.address(),
							pairing: this.access.pairingStatus(),
							deviceCount: this.access.listDevices().length,
							resources: {
								connections: this.connectedSockets.size,
								activeRequests: this.activeRequests.size,
								webSockets: this.activeWebSockets.size
							},
							discovery: this.discoveryStatus()
						}, false);
						return;
					}
					if (request.method === "GET" && target.decodedPathname === `${prefix}/devices`) {
						sendJson(response, 200, { devices: this.access.listDevices() }, false);
						return;
					}
					if (request.method === "POST" && target.decodedPathname === `${prefix}/pairing/open`) {
						const body = await readJsonObject(request, MAX_CONTROL_BODY_BYTES);
						if (body.ttlMs !== void 0 && typeof body.ttlMs !== "number") throw new HttpError(400, "bad_request");
						const opened = await this.access.openPairing(body.ttlMs);
						const requiresRemoteCa = this.config.pairingCaFile !== void 0 && !this.config.discovery;
						const appKey = `dsh${requiresRemoteCa ? "2" : "1"}.${this.config.instanceId}.${opened.token}`;
						const fragment = requiresRemoteCa ? `key=${appKey}` : `instance=${this.config.instanceId}&token=${opened.token}`;
						const pairUrl = `${this.address().origin}/mobile-access/pair#${fragment}`;
						const appPairUrl = pairUrl;
						let qrSvg = "";
						try {
							qrSvg = await QRCode.toString(appPairUrl, {
								type: "svg",
								margin: 1
							});
						} catch {}
						sendJson(response, 201, {
							...opened,
							appKey,
							pairUrl,
							appPairUrl,
							qrSvg
						}, false);
						return;
					}
					if (request.method === "POST" && target.decodedPathname === `${prefix}/devices/revoke`) {
						const body = await readJsonObject(request, MAX_CONTROL_BODY_BYTES);
						if (typeof body.deviceId !== "string" || !/^[a-f\d]{32}$/u.test(body.deviceId)) throw new HttpError(400, "bad_request");
						if (!await this.access.revokeDevice(body.deviceId)) throw new HttpError(404, "not_found");
						await this.clientModulePreferences.removeDevice(body.deviceId).catch(() => {
							process.emitWarning("Unable to remove revoked device client preferences", { code: "DSH_MOBILE_PREFERENCE_CLEANUP_FAILED" });
						});
						sendJson(response, 200, { revoked: true }, false);
						return;
					}
					if (request.method === "POST" && target.decodedPathname === `${prefix}/devices/reset`) {
						if ((await readJsonObject(request, MAX_CONTROL_BODY_BYTES)).confirm !== true) throw new HttpError(400, "bad_request");
						const removed = this.access.listDevices().map((device) => device.id);
						await this.access.resetDevices();
						await this.clientModulePreferences.removeDevices(removed).catch(() => {
							process.emitWarning("Unable to remove revoked device client preferences", { code: "DSH_MOBILE_PREFERENCE_CLEANUP_FAILED" });
						});
						sendJson(response, 200, { reset: true }, false);
						return;
					}
					throw new HttpError(404, "not_found");
				} catch (error) {
					const mapped = mapError(error);
					if (response.headersSent) response.destroy();
					else sendFailure(response, mapped.status, mapped.code, false);
				}
			}
		};
	}
	/** Close listeners and abort all accepted work before resolving teardown. */
	async close() {
		if (this.closeTask !== void 0) return this.closeTask;
		this.closeTask = this.performClose();
		return this.closeTask;
	}
	async performClose() {
		this.closing = true;
		for (const controller of this.clientModuleOperations) controller.abort();
		if (this.extensionChangeTimer !== void 0) clearInterval(this.extensionChangeTimer);
		this.extensionChangeTimer = void 0;
		this.removeExtensionContentListener();
		this.upstreamAuthRequest?.destroy();
		this.upstreamAuthRequest = void 0;
		this.removeSessionListener();
		this.pendingDeviceRevocations.clear();
		const accessClose = this.access.close();
		for (const stored of this.mobileBootBatches.values()) stored.assembly?.controller.abort();
		for (const request of this.activeRequests.values()) request.abort();
		for (const websocket of this.activeWebSockets.values()) {
			websocket.client.destroy();
			websocket.upstream.destroy();
		}
		for (const socket of this.connectedSockets) socket.destroy();
		if (this.discoveryTimer !== void 0) clearInterval(this.discoveryTimer);
		this.discoveryTimer = void 0;
		await this.closeBonjour();
		const discoverySocket = this.discoverySocket;
		this.discoverySocket = void 0;
		if (discoverySocket !== void 0) await new Promise((resolve) => {
			discoverySocket.close(() => resolve());
		});
		const server = this.server;
		this.server = void 0;
		if (server !== void 0 && server.listening) {
			server.closeAllConnections();
			await new Promise((resolve) => {
				server.close(() => resolve());
			});
		}
		await accessClose;
		await Promise.allSettled(this.clientModuleTasks);
		await Promise.allSettled(this.clientModuleRevocations);
		this.activeRequests.clear();
		this.activeWebSockets.clear();
		this.connectedSockets.clear();
		this.policy = void 0;
		this.listenerPort = void 0;
	}
	/** Safe metadata helper for direct loopback integrations. */
	devices() {
		return this.access.listDevices();
	}
	/** Status shown by the loopback mobile-access control card. */
	extensionStatus() {
		return this.extensions?.status() ?? {
			loaded: 0,
			failed: 0
		};
	}
};
//#endregion
//#region src/storage.ts
function assertInteger(value, name) {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`device state ${name} must be a non-negative integer`);
}
function parseDevice(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("device state contains an invalid device");
	const record = value;
	if (typeof record.id !== "string" || !/^[a-f\d]{32}$/u.test(record.id)) throw new Error("device state contains an invalid id");
	if (typeof record.label !== "string" || record.label.length < 1 || record.label.length > 64 || /[\u0000-\u001f\u007f]/u.test(record.label)) throw new Error("device state contains an invalid label");
	if (typeof record.tokenDigest !== "string" || !/^[a-f\d]{64}$/u.test(record.tokenDigest)) throw new Error("device state contains an invalid credential digest");
	assertInteger(record.createdAt, "createdAt");
	assertInteger(record.expiresAt, "expiresAt");
	assertInteger(record.lastSeenAt, "lastSeenAt");
	if (record.revokedAt !== void 0) assertInteger(record.revokedAt, "revokedAt");
	if (record.expiresAt <= record.createdAt || record.lastSeenAt < record.createdAt) throw new Error("device state contains inconsistent timestamps");
	return Object.freeze({
		id: record.id,
		label: record.label,
		tokenDigest: record.tokenDigest,
		createdAt: record.createdAt,
		expiresAt: record.expiresAt,
		lastSeenAt: record.lastSeenAt,
		...record.revokedAt === void 0 ? {} : { revokedAt: record.revokedAt }
	});
}
/** Validate durable data before it can authorize a device. */
function parseDeviceSnapshot(value, maximumDevices = 256) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("device state must be an object");
	const snapshot = value;
	if (snapshot.version !== 1 || !Array.isArray(snapshot.devices) || snapshot.devices.length > maximumDevices) throw new Error("device state has an unsupported version or device count");
	const devices = snapshot.devices.map(parseDevice);
	if (new Set(devices.map((device) => device.id)).size !== devices.length || new Set(devices.map((device) => device.tokenDigest)).size !== devices.length) throw new Error("device state contains duplicate device identities");
	return Object.freeze({
		version: 1,
		devices: Object.freeze(devices)
	});
}
/** Atomic JSON implementation with symlink refusal and owner-only file creation. */
var JsonDeviceStore = class {
	file;
	maximumDevices;
	constructor(file, maximumDevices = 256) {
		this.file = file;
		this.maximumDevices = maximumDevices;
	}
	async load() {
		let stat;
		try {
			stat = await lstat(this.file);
		} catch (error) {
			if (error.code === "ENOENT") return Object.freeze({
				version: 1,
				devices: Object.freeze([])
			});
			throw error;
		}
		if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1048576) throw new Error("device state must be a regular file no larger than 1 MiB");
		await restrictPrivateFile(this.file);
		let parsed;
		try {
			parsed = JSON.parse(await readFile(this.file, "utf8"));
		} catch (error) {
			throw new Error("device state is not valid JSON", { cause: error });
		}
		return parseDeviceSnapshot(parsed, this.maximumDevices);
	}
	async save(snapshot) {
		const validated = parseDeviceSnapshot(snapshot, this.maximumDevices);
		const directory = dirname(this.file);
		await mkdir(directory, {
			recursive: true,
			mode: 448
		});
		try {
			const current = await lstat(this.file);
			if (!current.isFile() || current.isSymbolicLink()) throw new Error("device state target must remain a regular file");
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
		const temporary = join(directory, `.${basename(this.file)}.${randomBytes(12).toString("hex")}.tmp`);
		try {
			await writeFile(temporary, `${JSON.stringify(validated)}\n`, {
				encoding: "utf8",
				flag: "wx",
				mode: 384
			});
			await rename(temporary, this.file);
			await restrictPrivateFile(this.file);
		} catch (error) {
			try {
				await rm(temporary, { force: true });
			} catch (cleanupError) {
				throw new AggregateError([error, cleanupError], "device state write and temporary cleanup both failed");
			}
			throw error;
		}
	}
};
/** In-memory store useful for embedding and deterministic tests. */
var MemoryDeviceStore = class {
	snapshot;
	constructor(initial = {
		version: 1,
		devices: []
	}) {
		this.snapshot = parseDeviceSnapshot(initial);
	}
	async load() {
		return structuredClone(this.snapshot);
	}
	async save(snapshot) {
		this.snapshot = structuredClone(parseDeviceSnapshot(snapshot));
	}
	/** Return a defensive copy for assertions or administrative export. */
	inspect() {
		return structuredClone(this.snapshot);
	}
};
//#endregion
//#region src/managed-files.ts
/** Refuse link-shaped ancestors inside an owned state root before accessing a child. */
async function assertManagedParents(root, target, prefix) {
	const parent = resolve(root);
	const candidate = resolve(target);
	const offset = relative(parent, candidate);
	if (!isAbsolute(root) || offset !== "" && (offset.startsWith("..") || isAbsolute(offset))) throw new Error(`${prefix}_path_invalid`);
	const paths = [parent];
	let cursor = parent;
	if (offset !== "") for (const segment of relative(parent, dirname(candidate)).split(/[\\/]/u).filter(Boolean)) {
		cursor = join(cursor, segment);
		paths.push(cursor);
	}
	for (const path of paths) {
		let entry;
		try {
			entry = await lstat(path);
		} catch (error) {
			if (error.code === "ENOENT") continue;
			throw error;
		}
		if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(`${prefix}_path_invalid`);
	}
}
/** Retry Windows handle contention while checking ownership before every mutation. */
async function mutateManagedPath(validate, mutate) {
	let original;
	for (let attempt = 0;; attempt++) {
		await validate();
		try {
			await mutate();
			return;
		} catch (error) {
			const code = error.code;
			if (process.platform !== "win32" || code !== "EPERM" && code !== "EBUSY") throw error;
			if (attempt === 0) original = error;
			if (attempt === 7) throw original;
			await new Promise((resolve) => setTimeout(resolve, Math.min(50 * 2 ** attempt, 400)));
		}
	}
}
/** Move only owned paths, retaining parent checks on every Windows retry. */
async function renameManagedPath(root, source, destination, prefix) {
	if (resolve(source) === resolve(root) || resolve(destination) === resolve(root)) throw new Error(`${prefix}_path_invalid`);
	await mutateManagedPath(async () => {
		await assertManagedParents(root, source, prefix);
		await assertManagedParents(root, destination, prefix);
	}, () => rename(source, destination));
}
/** Create a real owned directory; secure new directories without changing existing child ACLs. */
async function ensureManagedDirectory(root, directory, prefix) {
	await assertManagedParents(root, directory, prefix);
	const created = await mkdir(directory, {
		recursive: true,
		mode: 448
	});
	const entry = await lstat(directory);
	if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(`${prefix}_path_invalid`);
	if (created !== void 0) await restrictPrivateFile(directory, 448);
}
/** Delete an owned child tree; remove links themselves and never delete the root. */
async function removeManagedTree(root, target, prefix) {
	if (resolve(target) === resolve(root)) throw new Error(`${prefix}_path_invalid`);
	await assertManagedParents(root, target, prefix);
	let entry;
	try {
		entry = await lstat(target);
	} catch (error) {
		if (error.code === "ENOENT") return;
		throw error;
	}
	if (entry.isSymbolicLink() || !entry.isDirectory()) {
		await mutateManagedPath(() => assertManagedParents(root, target, prefix), () => unlink(target));
		return;
	}
	for (const name of await readdir(target)) await removeManagedTree(root, join(target, name), prefix);
	await mutateManagedPath(() => assertManagedParents(root, target, prefix), () => rmdir(target));
}
/** Validate every selected child, then await all deletion work even when one fails. */
async function removeManagedPaths(root, paths, prefix) {
	for (const path of paths) {
		if (resolve(path) === resolve(root)) throw new Error(`${prefix}_path_invalid`);
		await assertManagedParents(root, path, prefix);
	}
	const errors = (await Promise.allSettled(paths.map((path) => removeManagedTree(root, path, prefix)))).filter((result) => result.status === "rejected").map((result) => result.reason);
	if (errors.length === 1) throw errors[0];
	if (errors.length > 1) throw new AggregateError(errors, `${prefix}_cleanup_failed`);
}
/** Atomically replace one sensitive file beneath real owned directories. */
async function writeManagedPrivateFile(root, file, body, prefix) {
	await ensureManagedDirectory(root, dirname(file), prefix);
	try {
		const entry = await lstat(file);
		if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`${prefix}_config_target_invalid`);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	const temporary = join(dirname(file), "." + basename(file) + "." + randomBytes(12).toString("hex") + ".tmp");
	let failed = false;
	try {
		await writeFile(temporary, body, {
			encoding: "utf8",
			flag: "wx",
			mode: 384
		});
		await restrictPrivateFile(temporary);
		await renameManagedPath(root, temporary, file, prefix);
	} catch (error) {
		failed = true;
		throw error;
	} finally {
		try {
			await removeManagedTree(root, temporary, prefix);
		} catch (error) {
			if (!failed) throw error;
		}
	}
}
/** Promote a verified directory, restoring the previous version if promotion fails. */
async function replaceManagedDirectory(root, target, candidate, prefix, operations = {}) {
	if (resolve(target) === resolve(root) || resolve(candidate) === resolve(root)) throw new Error(`${prefix}_path_invalid`);
	const move = async (source, destination) => {
		await assertManagedParents(root, source, prefix);
		await assertManagedParents(root, destination, prefix);
		if (operations.move === void 0) await renameManagedPath(root, source, destination, prefix);
		else await operations.move(source, destination);
	};
	const remove = operations.remove ?? ((path) => removeManagedTree(root, path, prefix));
	const backup = join(dirname(target), `.${basename(target)}.previous-${randomBytes(12).toString("hex")}`);
	let previous = false;
	let promoted = false;
	try {
		await assertManagedParents(root, join(candidate, "publication-check"), prefix);
		await assertManagedParents(root, target, prefix);
		try {
			const entry = await lstat(target);
			if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(`${prefix}_path_invalid`);
			await move(target, backup);
			previous = true;
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
		try {
			await move(candidate, target);
			promoted = true;
		} catch (error) {
			if (previous) try {
				await move(backup, target);
				previous = false;
			} catch (restoreError) {
				throw new AggregateError([error, restoreError], `${prefix}_component_replace_failed`);
			}
			throw error;
		}
	} finally {
		try {
			await remove(candidate);
		} catch (_error) {
			process.emitWarning(`${prefix} candidate cleanup failed`, { code: "DSH_MOBILE_COMPONENT_CLEANUP_FAILED" });
		}
		if (promoted && previous) try {
			await remove(backup);
		} catch (_error) {
			process.emitWarning(`${prefix} previous component cleanup failed`, { code: "DSH_MOBILE_COMPONENT_CLEANUP_FAILED" });
		}
	}
}
//#endregion
//#region src/frp-component.ts
const FRP_VERSION$1 = "0.70.1";
const MAX_ARCHIVE_ENTRIES$1 = 128;
const MAX_ARCHIVE_LIST_BYTES$1 = 262144;
/** Pinned official FRP release metadata for supported desktop targets. */
const FRP_COMPONENT_RELEASES = Object.freeze(Object.fromEntries([
	{
		platform: "win32",
		arch: "x64",
		archiveName: "frp.zip",
		executableName: "frpc.exe",
		downloadBytes: 13924309,
		downloadSha256: "531f3cd3cc41c0b4f077b54fe6b7dd83c0ff727e7f0bf412a4c78fa279165de5",
		downloadUrl: `https://github.com/fatedier/frp/releases/download/v${FRP_VERSION$1}/frp_${FRP_VERSION$1}_windows_amd64.zip`
	},
	{
		platform: "win32",
		arch: "arm64",
		archiveName: "frp.zip",
		executableName: "frpc.exe",
		downloadBytes: 12204751,
		downloadSha256: "74d3acaf0f03ee190dd0462f9b49861dca50b0559c5488af4b36572fc951fcca",
		downloadUrl: `https://github.com/fatedier/frp/releases/download/v${FRP_VERSION$1}/frp_${FRP_VERSION$1}_windows_arm64.zip`
	},
	{
		platform: "linux",
		arch: "x64",
		archiveName: "frp.tar.gz",
		executableName: "frpc",
		downloadBytes: 13924042,
		downloadSha256: "333da23d1b9009d7c01638e9ba38cf4600f7d37d393f854e96ee1396adefa9a6",
		downloadUrl: `https://github.com/fatedier/frp/releases/download/v${FRP_VERSION$1}/frp_${FRP_VERSION$1}_linux_amd64.tar.gz`
	},
	{
		platform: "linux",
		arch: "arm64",
		archiveName: "frp.tar.gz",
		executableName: "frpc",
		downloadBytes: 12371290,
		downloadSha256: "3990f396a9a490ee7f0e5f355287750ed41520064ed999eab443b5e9a78d773d",
		downloadUrl: `https://github.com/fatedier/frp/releases/download/v${FRP_VERSION$1}/frp_${FRP_VERSION$1}_linux_arm64.tar.gz`
	},
	{
		platform: "darwin",
		arch: "x64",
		archiveName: "frp.tar.gz",
		executableName: "frpc",
		downloadBytes: 13951979,
		downloadSha256: "cbf69cf26e5553e914e97d37f5d4367fa30f5f531d073a889465af4719281e25",
		downloadUrl: `https://github.com/fatedier/frp/releases/download/v${FRP_VERSION$1}/frp_${FRP_VERSION$1}_darwin_amd64.tar.gz`
	},
	{
		platform: "darwin",
		arch: "arm64",
		archiveName: "frp.tar.gz",
		executableName: "frpc",
		downloadBytes: 12670664,
		downloadSha256: "cfa733b5a261c1647edee3c1fc4133d2542989b28f5602e81d47fc821d25c55f",
		downloadUrl: `https://github.com/fatedier/frp/releases/download/v${FRP_VERSION$1}/frp_${FRP_VERSION$1}_darwin_arm64.tar.gz`
	}
].map((release) => [`${release.platform}-${release.arch}`, Object.freeze(release)])));
function inside$2(parent, child) {
	const candidate = relative(parent, child);
	return candidate !== "" && !candidate.startsWith("..") && !isAbsolute(candidate);
}
async function regularFile$2(file) {
	try {
		const entry = await lstat(file);
		return entry.isFile() && !entry.isSymbolicLink();
	} catch (error) {
		if (error.code === "ENOENT") return false;
		throw error;
	}
}
function sha256$2(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}
async function runCapture$1(file, args) {
	return new Promise((resolveRun, reject) => {
		execFile(file, [...args], {
			windowsHide: true,
			timeout: 12e4,
			maxBuffer: MAX_ARCHIVE_LIST_BYTES$1,
			encoding: "utf8"
		}, (error, stdout) => {
			if (error === null) resolveRun(stdout);
			else reject(error);
		});
	});
}
function validatedArchiveEntry$1(rawEntry) {
	if (rawEntry.length === 0 || rawEntry.includes("\\") || rawEntry.includes("\0") || rawEntry.startsWith("/") || /^[a-zA-Z]:/u.test(rawEntry)) throw new Error("frp_archive_path_invalid");
	const segments = rawEntry.replace(/\/$/u, "").split("/");
	if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) throw new Error("frp_archive_path_invalid");
	return segments;
}
/** Select exactly one nested frpc executable from a safe archive listing. */
function selectFrpExecutableEntry(entries, executableName) {
	if (entries.length === 0 || entries.length > MAX_ARCHIVE_ENTRIES$1) throw new Error("frp_archive_entries_invalid");
	let executableEntry;
	for (const entry of entries) {
		const segments = validatedArchiveEntry$1(entry);
		if (segments.length >= 2 && segments.at(-1) === executableName) {
			if (executableEntry !== void 0) throw new Error("frp_archive_executable_ambiguous");
			executableEntry = entry.replace(/\/$/u, "");
		}
	}
	if (executableEntry === void 0) throw new Error("frp_archive_executable_missing");
	return executableEntry;
}
async function defaultExtractArtifact$2(archive, destination, executableName) {
	const tar = process.platform === "win32" ? "tar.exe" : "tar";
	const executableEntry = selectFrpExecutableEntry((await runCapture$1(tar, ["-tf", archive])).split(/\r?\n/u).filter((entry) => entry.length > 0), executableName);
	const unpacked = join(destination, "archive");
	await mkdir(unpacked, {
		recursive: true,
		mode: 448
	});
	await runCapture$1(tar, [
		"-xf",
		archive,
		"-C",
		unpacked,
		executableEntry
	]);
	const extracted = join(unpacked, ...validatedArchiveEntry$1(executableEntry));
	if (!await regularFile$2(extracted)) throw new Error("frp_archive_executable_invalid");
	await copyFile(extracted, join(destination, executableName));
}
async function defaultFetchArtifact$2(artifact, signal) {
	const response = await fetch(artifact.downloadUrl, {
		redirect: "follow",
		signal
	});
	if (!response.ok) throw new Error(`frp_download_http_${String(response.status)}`);
	const finalUrl = new URL(response.url);
	const officialHost = finalUrl.hostname === "github.com" || finalUrl.hostname.endsWith(".githubusercontent.com");
	if (finalUrl.protocol !== "https:" || !officialHost) throw new Error("frp_download_origin_invalid");
	const lengthHeader = response.headers.get("content-length");
	const declaredLength = lengthHeader === null ? void 0 : Number(lengthHeader);
	if (declaredLength !== void 0 && (!Number.isFinite(declaredLength) || declaredLength !== artifact.downloadBytes)) throw new Error("frp_download_size_mismatch");
	if (response.body === null) throw new Error("frp_download_empty");
	const chunks = [];
	let received = 0;
	const reader = response.body.getReader();
	while (true) {
		const result = await reader.read();
		if (result.done) break;
		received += result.value.byteLength;
		if (received > artifact.downloadBytes) {
			await reader.cancel();
			throw new Error("frp_download_size_mismatch");
		}
		chunks.push(result.value);
	}
	if (received !== artifact.downloadBytes) throw new Error("frp_download_size_mismatch");
	const bytes = new Uint8Array(received);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}
async function defaultInspectExecutable(executable) {
	return (await runCapture$1(executable, ["--version"])).trim();
}
/** Owns the optional official frpc binary inside the DSH Mobile state directory. */
var FrpComponentManager = class {
	executable;
	componentRoot;
	componentStorage;
	logRoot;
	stagingRoot;
	stateDirectory;
	artifact;
	fetchArtifact;
	extractArtifact;
	inspectExecutable;
	installed = false;
	installedBytes = 0;
	errorCode;
	queue = Promise.resolve();
	constructor(options) {
		if (!isAbsolute(options.stateDirectory)) throw new Error("frp state directory must be absolute");
		const stateDirectory = resolve(options.stateDirectory);
		this.stateDirectory = stateDirectory;
		const platform = options.platform ?? process.platform;
		const arch = options.arch ?? process.arch;
		this.artifact = FRP_COMPONENT_RELEASES[`${platform}-${arch}`];
		this.componentRoot = join(stateDirectory, "components", "frp");
		this.componentStorage = join(this.componentRoot, FRP_VERSION$1);
		this.executable = join(this.componentStorage, platform === "win32" ? "frpc.exe" : "frpc");
		this.logRoot = join(stateDirectory, "logs", "frp");
		this.stagingRoot = join(stateDirectory, "staging", "frp");
		for (const child of [
			this.componentRoot,
			this.componentStorage,
			this.logRoot,
			this.stagingRoot
		]) if (!inside$2(stateDirectory, child)) throw new Error("frp component path escaped its state directory");
		this.fetchArtifact = options.fetchArtifact ?? defaultFetchArtifact$2;
		this.extractArtifact = options.extractArtifact ?? defaultExtractArtifact$2;
		this.inspectExecutable = options.inspectExecutable ?? defaultInspectExecutable;
	}
	/** Inspect the managed executable without relying on global FRP installations. */
	async initialize() {
		this.installed = false;
		this.installedBytes = 0;
		this.errorCode = void 0;
		try {
			await assertManagedParents(this.stateDirectory, this.executable, "frp");
			this.installed = await regularFile$2(this.executable);
			this.installedBytes = this.installed ? (await stat(this.executable)).size : 0;
			if (this.installed) {
				if (await this.inspectExecutable(this.executable) !== FRP_VERSION$1) throw new Error("frp_component_version_mismatch");
			}
		} catch (_error) {
			this.installed = false;
			this.installedBytes = 0;
			this.errorCode = "frp_component_invalid";
		}
	}
	/** Return component metadata without exposing configuration or credentials. */
	status() {
		return Object.freeze({
			supported: this.artifact !== void 0,
			installed: this.installed,
			version: FRP_VERSION$1,
			downloadBytes: this.artifact?.downloadBytes ?? 0,
			installedBytes: this.installedBytes,
			sourceUrl: this.artifact?.downloadUrl ?? "https://github.com/fatedier/frp/releases",
			releasePage: `https://github.com/fatedier/frp/releases/tag/v${FRP_VERSION$1}`,
			storagePath: this.componentRoot,
			...this.errorCode === void 0 ? {} : { errorCode: this.errorCode }
		});
	}
	/** Download, verify, and extract only frpc after explicit confirmation. */
	install() {
		return this.enqueue(async () => {
			const artifact = this.artifact;
			if (artifact === void 0) throw new Error("frp_component_unsupported");
			await assertManagedParents(this.stateDirectory, this.executable, "frp");
			await ensureManagedDirectory(this.stateDirectory, this.stagingRoot, "frp");
			const staging = await mkdtemp(join(this.stagingRoot, "install-"));
			try {
				const controller = new AbortController();
				const timeout = setTimeout(() => {
					controller.abort();
				}, 12e4);
				timeout.unref();
				let bytes;
				try {
					bytes = await this.fetchArtifact(artifact, controller.signal);
				} finally {
					clearTimeout(timeout);
				}
				if (bytes.byteLength !== artifact.downloadBytes) throw new Error("frp_download_size_mismatch");
				if (sha256$2(bytes) !== artifact.downloadSha256) throw new Error("frp_download_hash_mismatch");
				const archive = join(staging, artifact.archiveName);
				await writeFile(archive, bytes, {
					flag: "wx",
					mode: 384
				});
				await this.extractArtifact(archive, staging, artifact.executableName);
				const extracted = join(staging, artifact.executableName);
				if (!await regularFile$2(extracted)) throw new Error("frp_executable_missing");
				await chmod(extracted, 448);
				if (await this.inspectExecutable(extracted) !== FRP_VERSION$1) throw new Error("frp_component_version_mismatch");
				const candidate = join(this.componentRoot, `.install-${randomBytes(12).toString("hex")}`);
				await ensureManagedDirectory(this.stateDirectory, candidate, "frp");
				try {
					const candidateExecutable = join(candidate, artifact.executableName);
					await copyFile(extracted, candidateExecutable);
					await chmod(candidateExecutable, 448);
					await replaceManagedDirectory(this.stateDirectory, this.componentStorage, candidate, "frp");
				} catch (error) {
					try {
						await removeManagedTree(this.stateDirectory, candidate, "frp");
					} catch (_cleanupError) {
						process.emitWarning("FRP candidate cleanup failed", { code: "DSH_MOBILE_COMPONENT_CLEANUP_FAILED" });
					}
					throw error;
				}
				this.installed = true;
				this.installedBytes = (await stat(this.executable)).size;
				this.errorCode = void 0;
			} finally {
				await removeManagedTree(this.stateDirectory, staging, "frp");
			}
		});
	}
	/** Remove all FRP executable, staging, and log files owned by DSH Mobile. */
	purge() {
		return this.enqueue(async () => {
			await removeManagedPaths(this.stateDirectory, [
				this.componentRoot,
				this.logRoot,
				this.stagingRoot
			], "frp");
			this.installed = false;
			this.installedBytes = 0;
			this.errorCode = void 0;
		});
	}
	enqueue(operation) {
		const task = this.queue.then(operation, operation);
		this.queue = task.then(() => void 0, () => void 0);
		return task.then(() => this.status());
	}
};
//#endregion
//#region src/frp-template.ts
/** Loopback-only HTTP vhost port used between Caddy and frps. */
const FRP_VHOST_HTTP_PORT = 7080;
/** Caddy snippet owned entirely by DSH Mobile; the main Caddyfile only imports it. */
const FRP_CADDY_SNIPPET_PATH = "/etc/caddy/dsh-mobile-dsh.caddy";
/** First line of the owned snippet; also the legacy whole-file marker. */
const FRP_CADDY_SNIPPET_MARKER = "# Managed by DSH Mobile - snippet, safe to delete";
/** Exact line the main Caddyfile must contain (uncommented) for the site to load. */
const FRP_CADDY_IMPORT_LINE = `import ${FRP_CADDY_SNIPPET_PATH}`;
function publicIpv4Address(value) {
	const parts = value.split(".");
	return parts.length === 4 && parts.every((part) => /^(?:0|[1-9][0-9]{0,2})$/u.test(part) && Number(part) <= 255);
}
function publicDnsHostname(value) {
	return value.length <= 253 && value.includes(".") && !/^[0-9.]+$/u.test(value) && !value.includes(":") && value.split(".").every((label) => label.length >= 1 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label));
}
function parsePublicOrigin(publicOrigin) {
	let url;
	try {
		url = new URL(publicOrigin);
	} catch {
		throw new Error("frp_template_input_invalid");
	}
	if (url.protocol !== "https:" || url.port !== "" || url.pathname !== "/" || url.search !== "" || url.hash !== "" || url.username !== "" || url.password !== "" || !publicIpv4Address(url.hostname) && !publicDnsHostname(url.hostname)) throw new Error("frp_template_input_invalid");
	return url.hostname;
}
function resolveVhostHttpPort(options) {
	const port = options.vhostHttpPort ?? 7080;
	if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("frp_template_input_invalid");
	return port;
}
/**
* A self-signed entry deliberately never reaches Caddy: the tunnel is a raw TCP
* passthrough and the DSH gateway is the TLS endpoint. Refuse loudly instead of
* emitting a Caddy site that would need the gateway's private CA on the VPS.
*/
function rejectSelfSignedCaddySite(options) {
	if (options.entryTls === "self-signed") throw new Error("frp_entry_tls_invalid");
}
/**
* Build the Caddy site for one public host (without markers or import wiring).
*
* The second parameter accepts either a bare certificate directory (the legacy
* signature) or a full {@link CaddySiteOptions} object, so existing callers keep
* working unchanged.
*/
function createCaddySite(publicHost, options = {}) {
	const resolved = typeof options === "string" ? { certDir: options } : options;
	rejectSelfSignedCaddySite(resolved);
	const certDir = resolved.certDir ?? "/var/lib/caddy/dsh-mobile-certs";
	const vhostHttpPort = resolveVhostHttpPort(resolved);
	if (publicIpv4Address(publicHost)) return [
		"{",
		`  default_sni ${publicHost}`,
		"}",
		"",
		`http://${publicHost} {`,
		`  redir https://${publicHost}{uri} permanent`,
		"}",
		"",
		`https://${publicHost} {`,
		`  tls ${certDir}/fullchain.pem ${certDir}/privkey.pem`,
		`  reverse_proxy 127.0.0.1:${String(vhostHttpPort)}`,
		"}",
		""
	].join("\n");
	if (!publicDnsHostname(publicHost)) throw new Error("frp_template_input_invalid");
	return [
		`${publicHost} {`,
		`  reverse_proxy 127.0.0.1:${String(vhostHttpPort)}`,
		"}",
		""
	].join("\n");
}
/** Manual certbot steps for a public-IPv4 origin (Caddy cannot issue IP certificates itself). */
function manualIpCertificateGuide(publicHost) {
	return [
		"# Public-IPv4 manual HTTPS: Caddy cannot issue IP certificates by itself.",
		"# On the VPS (Ubuntu/Debian, port 80 reachable from the internet), run once as root:",
		"#   apt-get install -y python3-venv",
		"#   python3 -m venv /opt/dsh-mobile/certbot-venv",
		"#   /opt/dsh-mobile/certbot-venv/bin/pip install 'certbot==5.8.0'",
		"#   systemctl stop caddy || true",
		`#   /opt/dsh-mobile/certbot-venv/bin/certbot certonly --standalone --preferred-profile shortlived --ip-address ${publicHost} --agree-tos --register-unsafely-without-email --non-interactive --keep-until-expiring`,
		"#   install -d -m 0750 -o caddy -g caddy /var/lib/caddy/dsh-mobile-certs",
		`#   install -m 0640 -o caddy -g caddy /etc/letsencrypt/live/${publicHost}/fullchain.pem /var/lib/caddy/dsh-mobile-certs/fullchain.pem`,
		`#   install -m 0640 -o caddy -g caddy /etc/letsencrypt/live/${publicHost}/privkey.pem /var/lib/caddy/dsh-mobile-certs/privkey.pem`,
		"#   systemctl start caddy",
		"# The site below already references those paths. Certificates last about 6 days: re-run certonly before expiry.",
		"#"
	].join("\n");
}
/**
* Build the only supported frps config and Caddy snippet from validated user inputs.
*
* Default `options` reproduce the upstream artefact byte for byte; `attach` mode
* passes the user's real vhost port, and `self-signed` is rejected because that
* mode publishes a raw TCP proxy instead of an HTTP vhost.
*/
function createRestrictedFrpServerTemplate(serverPort, token, publicOrigin, options = {}) {
	if (!Number.isSafeInteger(serverPort) || serverPort < 1 || serverPort > 65535 || token.length < 16 || token.length > 512 || /[\s\u0000-\u001f\u007f]/u.test(token)) throw new Error("frp_template_input_invalid");
	rejectSelfSignedCaddySite(options);
	const vhostHttpPort = resolveVhostHttpPort(options);
	const certDir = options.certDir ?? "/var/lib/caddy/dsh-mobile-certs";
	const publicHost = parsePublicOrigin(publicOrigin);
	const lines = [
		"# frps.toml — save as /etc/dsh-mobile/frps.toml, then start the frps service.",
		`bindPort = ${String(serverPort)}`,
		"proxyBindAddr = \"127.0.0.1\"",
		`vhostHTTPPort = ${String(vhostHttpPort)}`,
		"auth.method = \"token\"",
		`auth.token = ${JSON.stringify(token)}`,
		"",
		`# Caddy — save the site below as ${FRP_CADDY_SNIPPET_PATH},`,
		"# then make sure your Caddyfile contains exactly this line at the TOP of the file",
		"# (create the file with just this line if needed; globals must precede sites):",
		`#   ${FRP_CADDY_IMPORT_LINE}`,
		"# finally run: caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy",
		"# Uninstall later removes only this snippet file and the import line; your own Caddy content is kept.",
		`${FRP_CADDY_SNIPPET_MARKER}`,
		createCaddySite(publicHost, {
			certDir,
			vhostHttpPort
		}).trimEnd(),
		""
	];
	if (publicIpv4Address(publicHost)) lines.push(manualIpCertificateGuide(publicHost), "");
	return lines.join("\n");
}
//#endregion
//#region src/frp-config.ts
const MAX_SETTINGS_BYTES$1 = 8192;
/** Public entry port used by the self-signed TCP passthrough (never 443 by requirement). */
const FRP_DEFAULT_PUBLIC_PORT = 33080;
/** Ports owned by other DSH Mobile listeners; the public entry may never reuse them. */
const FRP_RESERVED_PORTS = Object.freeze([
	3080,
	3443,
	3444
]);
/** Every key `settings.json` may contain. Unknown keys stay rejected. */
const FRP_SETTINGS_KEYS = /* @__PURE__ */ new Set([
	"version",
	"serverAddress",
	"serverPort",
	"token",
	"publicOrigin",
	"mode",
	"entryTls",
	"vhostHttpPort",
	"publicPort"
]);
function hostname$2(value) {
	if (value.length > 253 || !value.includes(".")) return false;
	return value.split(".").every((label) => label.length >= 1 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label));
}
/** Validate the FRP server hostname or IP address. */
function validateFrpServerAddress(value) {
	if (typeof value !== "string" || value !== value.trim() || value.length === 0 || value.length > 253 || /[\s\u0000-\u001f\u007f/\\@?#]/u.test(value)) throw new Error("frp_server_address_invalid");
	const normalized = value.toLowerCase().replace(/\.$/u, "");
	if (isIP(normalized) === 0 && !hostname$2(normalized)) throw new Error("frp_server_address_invalid");
	return normalized;
}
/** Validate the FRP control port. */
function validateFrpServerPort(value) {
	if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 65535) throw new Error("frp_server_port_invalid");
	return Number(value);
}
/** Validate a high-entropy FRP token before durable storage. */
function validateFrpToken(value) {
	if (typeof value !== "string" || value.length < 16 || value.length > 512 || /[\s\u0000-\u001f\u007f]/u.test(value)) throw new Error("frp_token_invalid");
	return value;
}
/** Validate the public HTTPS origin used by Caddy and Android pairing. */
function validateFrpPublicOrigin(value) {
	if (typeof value !== "string" || value.length > 512) throw new Error("frp_public_origin_invalid");
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error("frp_public_origin_invalid");
	}
	const publicHost = url.hostname;
	if (url.protocol !== "https:" || url.port !== "" || url.pathname !== "/" || url.search !== "" || url.hash !== "" || url.username !== "" || url.password !== "" || isIP(publicHost) !== 4 && !hostname$2(publicHost)) throw new Error("frp_public_origin_invalid");
	if (isIP(publicHost) === 4 && !isGloballyRoutableIpv4(publicHost)) throw new Error("frp_public_origin_invalid");
	return url.origin;
}
/** Validate the provisioning mode. */
function validateFrpMode(value) {
	if (value !== "deploy" && value !== "attach") throw new Error("frp_settings_invalid");
	return value;
}
/** Validate the entry TLS mode. */
function validateFrpEntryTls(value) {
	if (value !== "public-ip-cert" && value !== "self-signed") throw new Error("frp_entry_tls_invalid");
	return value;
}
function validatePort(value, rejectReserved) {
	if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 65535) throw new Error("frp_settings_invalid");
	const port = Number(value);
	if (rejectReserved && FRP_RESERVED_PORTS.includes(port)) throw new Error("frp_settings_invalid");
	return port;
}
/** Validate the loopback vhost port of the target frps. */
function validateFrpVhostHttpPort(value) {
	return validatePort(value, false);
}
/** Validate the public entry port of the self-signed TCP proxy. */
function validateFrpPublicPort(value) {
	return validatePort(value, true);
}
/** Effective provisioning mode; an absent field keeps the upstream behaviour. */
function resolveFrpMode(settings) {
	return settings.mode ?? "deploy";
}
/** Effective entry TLS mode; an absent field keeps the upstream behaviour. */
function resolveFrpEntryTls(settings) {
	return settings.entryTls ?? "public-ip-cert";
}
/** Effective loopback vhost port; an absent field keeps the upstream behaviour. */
function resolveFrpVhostHttpPort(settings) {
	return settings.vhostHttpPort ?? 7080;
}
/** Effective public entry port of the self-signed passthrough. */
function resolveFrpPublicPort(settings) {
	return settings.publicPort ?? 33080;
}
/** Public HTTPS endpoint the user opens, independent of the frps control address. */
function resolveFrpEntryProbe(settings) {
	const origin = new URL(frpEntryOrigin(settings));
	return {
		host: origin.hostname,
		port: origin.port === "" ? 443 : Number(origin.port)
	};
}
/** HTTPS origin users actually open; the self-signed TCP entry is not on 443. */
function frpEntryOrigin(settings) {
	if (!isFrpSelfSignedIngress(settings)) return settings.publicOrigin;
	return `https://${new URL(settings.publicOrigin).hostname}:${String(resolveFrpPublicPort(settings))}`;
}
/** True when the gateway terminates TLS itself behind a raw frps TCP proxy. */
function isFrpSelfSignedIngress(settings) {
	return resolveFrpEntryTls(settings) === "self-signed";
}
/**
* Parse FRP settings at the loopback request and filesystem boundaries.
*
* Optional keys are kept only when supplied, so a legacy `settings.json` still
* round-trips byte for byte and every default stays the upstream behaviour.
* Two cross-field rules are enforced here because neither can be recovered later:
* the self-signed entry is a TCP passthrough and therefore attach-only, and
* attach mode with a public-CA entry must state the user's real vhost port —
* silently assuming 7080 would disable the plaintext-exposure gate.
*/
function parseFrpSettings(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("frp_settings_invalid");
	const record = value;
	if (Reflect.ownKeys(record).some((key) => !FRP_SETTINGS_KEYS.has(String(key)))) throw new Error("frp_settings_invalid");
	if (record.version !== void 0 && record.version !== 1) throw new Error("frp_settings_invalid");
	const mode = record.mode === void 0 ? void 0 : validateFrpMode(record.mode);
	const entryTls = record.entryTls === void 0 ? void 0 : validateFrpEntryTls(record.entryTls);
	const vhostHttpPort = record.vhostHttpPort === void 0 ? void 0 : validateFrpVhostHttpPort(record.vhostHttpPort);
	const publicPort = record.publicPort === void 0 ? void 0 : validateFrpPublicPort(record.publicPort);
	const resolvedMode = mode ?? "deploy";
	const resolvedEntryTls = entryTls ?? "public-ip-cert";
	if (resolvedEntryTls === "self-signed" && resolvedMode !== "attach") throw new Error("frp_entry_tls_invalid");
	if (resolvedMode === "attach" && resolvedEntryTls === "public-ip-cert" && vhostHttpPort === void 0) throw new Error("frp_attach_mode_requires_vhost_port");
	const publicOrigin = validateFrpPublicOrigin(record.publicOrigin);
	if (resolvedEntryTls === "self-signed" && isIP(new URL(publicOrigin).hostname) !== 4) throw new Error("frp_self_signed_requires_public_ipv4");
	return Object.freeze({
		version: 1,
		serverAddress: validateFrpServerAddress(record.serverAddress),
		serverPort: validateFrpServerPort(record.serverPort),
		token: validateFrpToken(record.token),
		publicOrigin,
		...mode === void 0 ? {} : { mode },
		...entryTls === void 0 ? {} : { entryTls },
		...vhostHttpPort === void 0 ? {} : { vhostHttpPort },
		...publicPort === void 0 ? {} : { publicPort }
	});
}
/**
* Merge a partial VPS request body with the saved configuration so a blank
* field keeps its saved value ("已保存时可留空"). Every merged field is still
* validated; with nothing saved and nothing supplied the result reports a
* missing configuration instead of silently deploying blanks.
*/
function mergeSavedFrpSettings(partial, saved) {
	const pick = (key) => {
		const supplied = partial[key];
		if (supplied === "" || supplied === void 0) return saved?.[key];
		return supplied;
	};
	const mode = pick("mode");
	const entryTls = pick("entryTls");
	const vhostHttpPort = pick("vhostHttpPort");
	const publicPort = pick("publicPort");
	const merged = {
		serverAddress: partial.serverAddress === "" || partial.serverAddress === void 0 ? saved?.serverAddress : partial.serverAddress,
		serverPort: typeof partial.serverPort === "number" && Number.isSafeInteger(partial.serverPort) && partial.serverPort >= 1 ? partial.serverPort : saved?.serverPort,
		token: partial.token === "" || partial.token === void 0 ? saved?.token : partial.token,
		publicOrigin: partial.publicOrigin === "" || partial.publicOrigin === void 0 ? saved?.publicOrigin : partial.publicOrigin,
		...mode === "" || mode === void 0 ? {} : { mode },
		...entryTls === "" || entryTls === void 0 ? {} : { entryTls },
		...vhostHttpPort === "" || vhostHttpPort === void 0 ? {} : { vhostHttpPort },
		...publicPort === "" || publicPort === void 0 ? {} : { publicPort }
	};
	if (merged.serverAddress === void 0 && merged.serverPort === void 0 && merged.token === void 0 && merged.publicOrigin === void 0) throw new Error("frp_config_missing");
	return parseFrpSettings(merged);
}
/** Merge a VPS target (address and control port) with the saved configuration. */
function mergeSavedFrpTarget(partial, saved) {
	const serverAddress = partial.serverAddress === "" || partial.serverAddress === void 0 ? saved?.serverAddress : partial.serverAddress;
	const serverPort = typeof partial.serverPort === "number" && Number.isSafeInteger(partial.serverPort) && partial.serverPort >= 1 ? partial.serverPort : saved?.serverPort;
	if (serverAddress === void 0 || serverPort === void 0) throw new Error("frp_config_missing");
	return Object.freeze({
		serverAddress: validateFrpServerAddress(serverAddress),
		serverPort: validateFrpServerPort(serverPort)
	});
}
function tomlString(value) {
	return JSON.stringify(value);
}
/**
* Legacy proxy name, kept only as the default of {@link createFrpcToml}.
*
* A shared frps accepts one proxy per name across *all* its clients, so a fixed
* name let any other DSH installation — or a not yet reaped session of this one —
* own `dsh-mobile` first. frpc then logged `start error: proxy name [dsh-mobile]
* is already in use`, kept running without publishing the entry port, and the
* start-up self-check ended in `frp_start_timeout` ("the public endpoint did not
* become ready"). Product callers therefore pass an installation-derived name
* from {@link frpProxyName}; this constant only keeps the exported API and the
* byte-for-byte compatibility test working for legacy callers.
*/
const FRP_DEFAULT_PROXY_NAME = "dsh-mobile";
/**
* Validate a proxy name for the generated frpc configuration.
*
* frps accepts one proxy per name on the whole server, so the name must be a
* single safe token: no whitespace, no quotes, no path or bracket characters.
*/
function validateFrpProxyName(value) {
	if (typeof value !== "string" || value.length < 1 || value.length > 128 || !/^[A-Za-z0-9._-]+$/u.test(value)) throw new Error("frp_proxy_name_invalid");
	return value;
}
/**
* Proxy name for one DSH installation.
*
* Derived from the stable installation identity so two computers sharing one
* frps never register the same proxy, while a single installation keeps the
* same name across restarts (so its own stale registration is the only possible
* conflict, and that one expires with the frps heartbeat).
*/
function frpProxyName(instanceId) {
	if (typeof instanceId !== "string" || !/^[a-f0-9]{64}$/u.test(instanceId)) throw new Error("frp_instance_id_invalid");
	return `${FRP_DEFAULT_PROXY_NAME}-${instanceId.slice(0, 12)}`;
}
/**
* Build the single-purpose frpc configuration for the current loopback gateway.
*
* The default (public-CA) entry is an HTTP vhost behind Caddy and is emitted byte
* for byte as before. The self-signed entry cannot use a vhost at all: frps only
* forwards raw TCP, and the gateway terminates TLS on that connection.
*
* `proxyName` defaults to the legacy fixed name only for legacy callers; the
* provider and the attach preview always pass {@link frpProxyName}.
*/
function createFrpcToml(settings, localPort, proxyName = FRP_DEFAULT_PROXY_NAME) {
	if (!Number.isSafeInteger(localPort) || localPort < 1 || localPort > 65535) throw new Error("frp_local_port_invalid");
	const header = [
		`serverAddr = ${tomlString(settings.serverAddress)}`,
		`serverPort = ${String(settings.serverPort)}`,
		"auth.method = \"token\"",
		`auth.token = ${tomlString(settings.token)}`,
		"transport.tls.enable = true",
		"",
		"[[proxies]]",
		`name = ${tomlString(validateFrpProxyName(proxyName))}`
	];
	if (isFrpSelfSignedIngress(settings)) return [
		...header,
		"type = \"tcp\"",
		"localIP = \"127.0.0.1\"",
		`localPort = ${String(localPort)}`,
		`remotePort = ${String(resolveFrpPublicPort(settings))}`,
		"transport.useEncryption = true",
		"transport.useCompression = true",
		""
	].join("\n");
	const hostnameValue = new URL(settings.publicOrigin).hostname;
	return [
		...header,
		"type = \"http\"",
		"localIP = \"127.0.0.1\"",
		`localPort = ${String(localPort)}`,
		`customDomains = [${tomlString(hostnameValue)}]`,
		"transport.useEncryption = true",
		"transport.useCompression = true",
		""
	].join("\n");
}
/** Build the matching restricted frps and Caddy templates for one VPS. */
function createFrpServerTemplate(settings) {
	return createRestrictedFrpServerTemplate(settings.serverPort, settings.token, settings.publicOrigin, {
		vhostHttpPort: resolveFrpVhostHttpPort(settings),
		entryTls: resolveFrpEntryTls(settings)
	});
}
/** Owns private FRP settings and generation-specific frpc configuration. */
var FrpConfigStore = class {
	ownedRoot;
	stateRoot;
	settingsFile;
	runtimeConfigFile;
	/**
	* Proxy name every generated frpc.toml registers.
	*
	* Injected by the composing plugin ({@link frpProxyName}) so one frps can
	* serve several DSH installations; the legacy fixed name stays the default
	* for direct constructions in tests and for the exported API.
	*/
	proxyName;
	settingsValue;
	errorCode;
	constructor(stateDirectory, proxyName = FRP_DEFAULT_PROXY_NAME, ownedRoot = stateDirectory) {
		this.ownedRoot = ownedRoot;
		if (!isAbsolute(stateDirectory)) throw new Error("frp config state directory must be absolute");
		this.stateRoot = resolve(stateDirectory);
		this.settingsFile = join(this.stateRoot, "settings.json");
		this.runtimeConfigFile = join(this.stateRoot, "frpc.toml");
		this.proxyName = validateFrpProxyName(proxyName);
	}
	/** Load private settings while rejecting links, oversized files, and unknown fields. */
	async initialize() {
		this.settingsValue = void 0;
		this.errorCode = void 0;
		try {
			await assertManagedParents(this.ownedRoot, this.settingsFile, "frp");
		} catch (_error) {
			this.errorCode = "frp_config_invalid";
			return;
		}
		let entry;
		try {
			entry = await lstat(this.settingsFile);
		} catch (error) {
			if (error.code === "ENOENT") return;
			throw error;
		}
		if (!entry.isFile() || entry.isSymbolicLink() || entry.size > MAX_SETTINGS_BYTES$1) {
			this.errorCode = "frp_config_invalid";
			return;
		}
		await restrictPrivateFile(this.settingsFile);
		try {
			this.settingsValue = parseFrpSettings(JSON.parse(await readFile(this.settingsFile, "utf8")));
			this.errorCode = void 0;
		} catch {
			this.settingsValue = void 0;
			this.errorCode = "frp_config_invalid";
		}
	}
	/**
	* Return configuration metadata without exposing the FRP token.
	*
	* The optional keys appear only when the saved configuration departs from the
	* upstream defaults, so the pre-existing field set is unchanged for every
	* legacy configuration.
	*/
	status() {
		const settings = this.settingsValue;
		const mode = settings === void 0 ? void 0 : resolveFrpMode(settings);
		const entryTls = settings === void 0 ? void 0 : resolveFrpEntryTls(settings);
		return Object.freeze({
			configured: settings !== void 0,
			...settings === void 0 ? {} : {
				serverAddress: settings.serverAddress,
				serverPort: settings.serverPort,
				publicOrigin: settings.publicOrigin
			},
			vhostHttpPort: settings === void 0 ? FRP_VHOST_HTTP_PORT : resolveFrpVhostHttpPort(settings),
			storagePath: this.stateRoot,
			proxyName: this.proxyName,
			...this.errorCode === void 0 ? {} : { errorCode: this.errorCode },
			...mode === void 0 || mode === "deploy" ? {} : { mode },
			...entryTls === void 0 || entryTls === "public-ip-cert" ? {} : { entryTls },
			...settings?.publicPort === void 0 ? {} : { publicPort: settings.publicPort }
		});
	}
	/** Return private settings only to the provider lifecycle. */
	settings() {
		return this.settingsValue;
	}
	/** Atomically replace private FRP settings. */
	async configure(value) {
		const settings = parseFrpSettings(value);
		await writeManagedPrivateFile(this.ownedRoot, this.settingsFile, `${JSON.stringify(settings)}\n`, "frp");
		await removeManagedTree(this.ownedRoot, this.runtimeConfigFile, "frp");
		this.settingsValue = settings;
		this.errorCode = void 0;
		return this.status();
	}
	/** Materialize the private generation-specific frpc configuration. */
	async writeRuntimeConfig(localPort) {
		const settings = this.settingsValue;
		if (settings === void 0) throw new Error("frp_config_missing");
		await writeManagedPrivateFile(this.ownedRoot, this.runtimeConfigFile, createFrpcToml(settings, localPort, this.proxyName), "frp");
		return this.runtimeConfigFile;
	}
	/** Remove only configuration files owned by the FRP provider. */
	async purge() {
		await removeManagedPaths(this.ownedRoot, [this.settingsFile, this.runtimeConfigFile], "frp");
		this.settingsValue = void 0;
		this.errorCode = void 0;
		return this.status();
	}
};
//#endregion
//#region src/frp-attach.ts
/** Default proof path used to confirm the public entry answered from this computer. */
const FRP_ATTACH_DISCOVERY_PATH = "/mobile-access/discovery";
/** Declaration printed above the VPS half of an attach template. */
const FRP_ATTACH_VPS_DECLARATION = "# 本模板不安装、不改动、不重启你的 frps；只新增 Caddy 片段与证书。frps 侧需你自行确认 vhostHTTPPort=<N> 与 proxyBindAddr=\"127.0.0.1\"。";
/** Declaration printed above the local half of an attach template. */
const FRP_ATTACH_LOCAL_DECLARATION = "# 本机只写入 frpc.toml 并启动 frpc：不安装、不改动本机 frps，也不改动 DSH 自身配置。";
/** Declaration for the self-signed passthrough, which keeps its CA on this computer. */
const FRP_ATTACH_SELF_SIGNED_DECLARATION = "# 自签穿透档不使用 Caddy 或公开证书：frps 只做 TCP 透传，由本机 DSH 网关终止 TLS；服务端证书会在运行时续签，CA 到期需重新配对。";
/**
* One-line notice printed above the masked frpc.toml preview.
*
* It states both facts a reader cannot verify from the text itself: the real
* file is written with 0600 permissions, and an unmasked copy would survive in
* the system clipboard.
*/
function frpAttachTokenMaskNotice(configFile) {
	return `# 预览已打码：真正的 frpc.toml 已由插件以 0600 权限写入 ${configFile}；明文 token 不打码会随复制进入系统剪贴板，故此处只显示占位符。`;
}
/** One-line notice printed above an explicitly revealed frpc.toml preview. */
const FRP_ATTACH_TOKEN_REVEAL_NOTICE = "# 明文 token 已按你的显式操作显示：复制后即进入系统剪贴板并长期留存，请勿粘贴到公开位置。";
/** Matches the single `auth.token` assignment of a generated frpc.toml. */
const FRPC_TOKEN_ASSIGNMENT = /^auth\.token\s*=\s*"(?:[^"\\]|\\.)*"/mu;
/**
* Replace the `auth.token` value of a rendered frpc.toml with a fixed placeholder.
*
* Only the preview and clipboard paths call this: the file written to disk keeps
* the real token, because frpc has to read it. The mapping never fails open — a
* token line that cannot be masked raises instead of leaking the secret.
*/
function redactFrpcTomlToken(frpcToml) {
	if (!/(^|\n)auth\.token/u.test(frpcToml)) return frpcToml;
	const masked = frpcToml.replace(FRPC_TOKEN_ASSIGNMENT, `auth.token = "***"`);
	if (!masked.includes(`auth.token = "***"`)) throw new Error("frp_token_mask_failed");
	return masked;
}
/**
* The frpc.toml exactly as the panel displays or copies it.
*
* `options.revealToken` is the only way to obtain the plaintext variant; the
* default is the masked text. `createFrpcToml` itself is untouched, so the file
* the provider writes stays byte-for-byte identical to the upstream output.
*/
function createFrpAttachFrpcToml(settings, options = {}) {
	const frpcToml = createFrpcToml(settings, attachLocalPort(options), options.proxyName ?? "dsh-mobile");
	return options.revealToken === true ? frpcToml : redactFrpcTomlToken(frpcToml);
}
const DEFAULT_ATTACH_CONFIG_FILE = "<DSH Mobile 私有目录>/remote/frp/config/frpc.toml";
function attachConfigFile(options) {
	const file = options.configFile;
	if (file === void 0 || file === "") return DEFAULT_ATTACH_CONFIG_FILE;
	return file;
}
function attachLocalPort(options) {
	const port = options.localPort ?? 3443;
	if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("frp_local_port_invalid");
	return port;
}
/**
* Reject every attach request that could not be carried out safely before any
* artefact is produced. Attach never installs frps, so it must know the user's
* real vhost port (unless the self-signed passthrough removes the vhost entirely).
*/
function validateAttachSettings(settings, options = {}) {
	if (resolveFrpMode(settings) !== "attach") throw new Error("frp_settings_invalid");
	if (isFrpSelfSignedIngress(settings)) {
		if (settings.mode !== "attach") throw new Error("frp_entry_tls_invalid");
		resolveFrpPublicPort(settings);
		return;
	}
	const vhostHttpPort = options.vhostHttpPort ?? settings.vhostHttpPort;
	if (vhostHttpPort === void 0) throw new Error("frp_attach_mode_requires_vhost_port");
	if (!Number.isSafeInteger(vhostHttpPort) || vhostHttpPort < 1 || vhostHttpPort > 65535) throw new Error("frp_settings_invalid");
}
/** Strip the leading `# ` of a guide block so it can be pasted as runnable shell. */
function guideCommands(guide) {
	return guide.split("\n").map((line) => line.replace(/^#\s?/u, "").trimEnd()).filter((line) => line !== "");
}
/**
* Derive every VPS-side value once so the copied runbook and the panel plan can
* never drift apart.
*/
function frpAttachVpsParts(settings, options = {}) {
	validateAttachSettings(settings, options);
	const publicHost = new URL(settings.publicOrigin).hostname;
	if (isFrpSelfSignedIngress(settings)) return Object.freeze({
		publicHost,
		selfSigned: true,
		publicPort: resolveFrpPublicPort(settings),
		snippet: "",
		certGuide: Object.freeze([])
	});
	const vhostHttpPort = options.vhostHttpPort ?? resolveFrpVhostHttpPort(settings);
	const certDir = options.certDir;
	const site = createCaddySite(publicHost, {
		vhostHttpPort,
		...certDir === void 0 ? {} : { certDir }
	});
	return Object.freeze({
		publicHost,
		selfSigned: false,
		vhostHttpPort,
		snippet: `${FRP_CADDY_SNIPPET_MARKER}\n${site.trimEnd()}\n`,
		certGuide: Object.freeze(isIP(publicHost) === 4 ? guideCommands(manualIpCertificateGuide(publicHost)) : [])
	});
}
/**
* Build the attach artefact for an existing frps.
*
* The result is deliberately split in two: the VPS half contains only what the
* user's own server needs (Caddy snippet + import + certificate guidance, or a
* single firewall rule for the self-signed passthrough), and the local half
* contains the generated frpc.toml plus its `frpc verify` self-check. Neither
* half installs, rewrites, or restarts the user's frps.
*/
function createFrpAttachTemplateParts(settings, options = {}) {
	const parts = frpAttachVpsParts(settings, options);
	const configFile = attachConfigFile(options);
	const revealed = options.revealToken === true;
	const frpcToml = createFrpAttachFrpcToml(settings, options);
	const local = [
		"# ---- (b) 本机侧（在这台电脑上执行）----",
		FRP_ATTACH_LOCAL_DECLARATION,
		revealed ? FRP_ATTACH_TOKEN_REVEAL_NOTICE : frpAttachTokenMaskNotice(configFile),
		`# frpc.toml 全文（插件同样会以 0600 权限写入 ${configFile}）`,
		frpcToml.trimEnd(),
		"",
		"# 启动前自检：",
		`frpc verify -c "${configFile}"`,
		""
	].join("\n");
	if (parts.selfSigned) {
		const publicPort = parts.publicPort ?? resolveFrpPublicPort(settings);
		const vps = [
			"# ---- (a) VPS 侧（在你的服务器上执行，共 3 项）----",
			FRP_ATTACH_SELF_SIGNED_DECLARATION,
			"#",
			"# 1) 放行公网入口端口（就是这台电脑网关的 HTTPS 入口，TCP 透传不解密）：",
			`ufw allow ${String(publicPort)}/tcp`,
			`ufw status | grep ${String(publicPort)}`,
			"# 若使用 firewalld / 云厂商安全组，请放行同样的 TCP 端口。",
			"# 前提：现有 frps 的 TCP 代理已监听公网地址；若 proxyBindAddr=127.0.0.1，放行防火墙仍无法从公网访问。",
			"# 插件不会修改你现有的 frps；不满足此前提时请改选受信任证书入口。",
			"#",
			"# 2) 确认你既有的 frps 已就绪（无需修改它的配置）：",
			"systemctl is-active frps || true",
			`ss -lnt | grep -E ':(${String(settings.serverPort)}|${String(publicPort)})\\b' || true`,
			"#",
			"# 3) frpc 启动后，用 -k 检查连通性；此命令不验证身份，App 配对后会固定网关 CA：",
			`curl -k -sS -o /dev/null -w '%{http_code}\\n' https://${parts.publicHost}:${String(publicPort)}${FRP_ATTACH_DISCOVERY_PATH}`,
			"# 期望输出 200。",
			""
		].join("\n");
		return Object.freeze({
			mode: "attach",
			vps,
			local,
			text: `${vps}${local}`
		});
	}
	const vps = [
		"# ---- (a) VPS 侧（在你的服务器上执行）----",
		FRP_ATTACH_VPS_DECLARATION,
		"#",
		`# 1) 保存 Caddy 片段到 ${FRP_CADDY_SNIPPET_PATH}（只新增这一个文件）：`,
		`cat > ${FRP_CADDY_SNIPPET_PATH} <<'DSH_MOBILE_CADDY_SNIPPET'`,
		parts.snippet.trimEnd(),
		"DSH_MOBILE_CADDY_SNIPPET",
		"#",
		"# 2) 确认 Caddyfile 顶部含下面这一行（全局块必须在前；没有则加到文件最上方）：",
		`#   ${FRP_CADDY_IMPORT_LINE}`,
		"caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy",
		"#",
		...parts.certGuide.length === 0 ? ["# 3) 域名 HTTPS：确认 DNS 指向 VPS，开放 80/443；Caddy 会自动申请和续期证书。"] : [
			"# 3) 公网 IP 的 HTTPS 证书（Caddy 不能为 IP 自动签发，故用 certbot 签发）：",
			...parts.certGuide.map((line) => `#   ${line}`),
			"#",
			"# 4) 确认证书续期任务，并在续期后将新证书安装到 Caddy：",
			"systemctl list-timers certbot.timer --all || true"
		],
		"#",
		"# 端到端验证（公网入口为 443，与 frps 的 vhost 端口无关）：",
		`curl -sS -o /dev/null -w '%{http_code}\\n' https://${parts.publicHost}${FRP_ATTACH_DISCOVERY_PATH}`,
		"# 期望输出 200。",
		""
	].join("\n");
	return Object.freeze({
		mode: "attach",
		vps,
		local,
		text: `${vps}${local}`
	});
}
/** Combined attach artefact, ready for the clipboard. */
function createFrpAttachTemplate(settings, options = {}) {
	return createFrpAttachTemplateParts(settings, options).text;
}
//#endregion
//#region src/frp-attach-plan.ts
const DEFAULT_PLAN_CONFIG_FILE = "<DSH Mobile 私有目录>/remote/frp/config/frpc.toml";
function planConfigFile(options) {
	const file = options.configFile;
	return file === void 0 || file === "" ? DEFAULT_PLAN_CONFIG_FILE : file;
}
/**
* Build the copy-only attach plan. It performs no network access, no SSH, and no
* filesystem write: the caller renders or copies the steps and the local frpc
* configuration is written by the ordinary provider lifecycle.
*/
function createFrpAttachPlan(settings, options = {}) {
	const parts = frpAttachVpsParts(settings, options);
	const configFile = planConfigFile(options);
	const localPort = options.localPort ?? 3443;
	const frpcToml = createFrpAttachFrpcToml(settings, {
		...options,
		localPort
	});
	const tokenMasked = options.revealToken !== true;
	const verifyCommand = `frpc verify -c "${configFile}"`;
	const commonWarnings = ["本机探测 ≠ 公网验证：请在外部（手机流量或另一台机器）再执行一次 VPS 侧清单里的 curl 验证。", "插件不会安装、不会改动、不会重启你既有的 frps，也不会改动 Caddyfile 里的其他内容。"];
	if (isFrpSelfSignedIngress(settings)) {
		const publicPort = parts.publicPort ?? 0;
		const publicHost = parts.publicHost;
		return Object.freeze({
			mode: "attach",
			entryTls: resolveFrpEntryTls(settings),
			publicPort,
			local: Object.freeze({
				frpcToml,
				tokenMasked,
				verifyCommand,
				configFile,
				declaration: FRP_ATTACH_LOCAL_DECLARATION
			}),
			vps: Object.freeze([
				Object.freeze({
					id: "open-public-port",
					title: "frpAttachStepOpenPort",
					label: `放行公网入口端口 ${String(publicPort)}/tcp`,
					commands: Object.freeze([`ufw allow ${String(publicPort)}/tcp`, `ufw status | grep ${String(publicPort)}`]),
					optional: false,
					verifyHint: `ufw status 中应出现 ${String(publicPort)}/tcp ALLOW；云厂商安全组也需放行同一 TCP 端口。`
				}),
				Object.freeze({
					id: "verify-frps",
					title: "frpAttachStepVerifyFrps",
					label: "确认既有 frps 已就绪（不改动它的配置）",
					commands: Object.freeze(["systemctl is-active frps || true", `ss -lnt | grep -E ':(${String(settings.serverPort)}|${String(publicPort)})\\b' || true`]),
					optional: false,
					verifyHint: `frps 控制端口 ${String(settings.serverPort)} 应监听；入口 ${String(publicPort)} 的 Local Address 不应是 127.0.0.1。若仅回环监听，防火墙放行也无法公网访问。`
				}),
				Object.freeze({
					id: "verify-entry",
					title: "frpAttachStepVerifyEntry",
					label: "frpc 启动后端到端验证（自签证书需 -k）",
					commands: Object.freeze([`curl -k -sS -o /dev/null -w '%{http_code}\\n' https://${publicHost}:${String(publicPort)}${FRP_ATTACH_DISCOVERY_PATH}`]),
					optional: false,
					verifyHint: "期望输出 200；curl -k 仅验证连通性，不验证服务器身份；App 配对后会固定网关 CA。返回 000 时检查端口与转发。"
				})
			]),
			warnings: Object.freeze([
				...commonWarnings,
				FRP_ATTACH_SELF_SIGNED_DECLARATION,
				"现有 frps 的 TCP 代理必须已监听公网地址；若 proxyBindAddr=127.0.0.1，单靠开放防火墙端口无法连通，请改选公网证书 + Caddy 模式。插件不会修改你的 frps。",
				"手机浏览器访问自签入口会提示证书不受信任 —— 请用 App 扫码配对；App 已固定网关 CA，不需要公开证书。",
				"切勿把网关 listenHost 改成 0.0.0.0：公网入口由 frps 的 TCP 代理提供，网关只监听 127.0.0.1。"
			])
		});
	}
	const vhostHttpPort = parts.vhostHttpPort ?? 0;
	const publicHost = parts.publicHost;
	const certGuide = parts.certGuide;
	const certificateSteps = certGuide.length === 0 ? [] : [Object.freeze({
		id: "issue-ip-cert",
		title: "frpAttachStepIssueCert",
		label: "为公网 IP 签发受信任证书（certbot）",
		commands: Object.freeze([...certGuide]),
		optional: false,
		verifyHint: `证书应落到 /etc/letsencrypt/live/${publicHost}/ 并安装到 Caddy 证书目录。`
	}), Object.freeze({
		id: "enable-cert-timer",
		title: "frpAttachStepCertTimer",
		label: "确认 certbot 续期定时器并更新 Caddy 证书文件",
		commands: Object.freeze(["systemctl list-timers certbot.timer --all || true"]),
		optional: false,
		verifyHint: "公网 IP 证书有效期较短；续期后还须将新证书安装到 Caddy 并重载。"
	})];
	return Object.freeze({
		mode: "attach",
		entryTls: resolveFrpEntryTls(settings),
		vhostHttpPort,
		local: Object.freeze({
			frpcToml,
			tokenMasked,
			verifyCommand,
			configFile,
			declaration: FRP_ATTACH_LOCAL_DECLARATION
		}),
		vps: Object.freeze([
			Object.freeze({
				id: "write-snippet",
				title: "frpAttachStepWriteSnippet",
				label: `新增 Caddy 片段 ${FRP_CADDY_SNIPPET_PATH}`,
				commands: Object.freeze([
					`cat > ${FRP_CADDY_SNIPPET_PATH} <<'DSH_MOBILE_CADDY_SNIPPET'`,
					parts.snippet.trimEnd(),
					"DSH_MOBILE_CADDY_SNIPPET"
				]),
				optional: false,
				verifyHint: `片段内容里的反代目标是 127.0.0.1:${String(vhostHttpPort)}，即你 frps 的 vhostHTTPPort。`
			}),
			Object.freeze({
				id: "add-import",
				title: "frpAttachStepAddImport",
				label: "在 Caddyfile 顶部加入 import 行并重载",
				commands: Object.freeze([`# 确认 /etc/caddy/Caddyfile 顶部包含：${FRP_CADDY_IMPORT_LINE}`, "caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy"]),
				optional: false,
				verifyHint: "caddy validate 通过且 reload 无报错；Caddyfile 中你自己原有的站点内容保持不变。"
			}),
			...certificateSteps,
			Object.freeze({
				id: "verify-https",
				title: "frpAttachStepVerifyHttps",
				label: "端到端验证公网 HTTPS 入口",
				commands: Object.freeze([`curl -sS -o /dev/null -w '%{http_code}\\n' https://${publicHost}${FRP_ATTACH_DISCOVERY_PATH}`]),
				optional: true,
				verifyHint: certGuide.length === 0 ? "期望输出 200；证书错误时检查 DNS、80/443 端口和 Caddy 日志。" : "期望输出 200；证书错误时检查 certbot 证书是否安装并重载 Caddy。"
			})
		]),
		warnings: Object.freeze([
			...commonWarnings,
			FRP_ATTACH_VPS_DECLARATION,
			`你 frps 的明文 vhost 必须只监听 127.0.0.1（proxyBindAddr）且 vhostHTTPPort=${String(vhostHttpPort)}；插件启动前会探测该端口，若公网可达将直接拒绝启动。`
		])
	});
}
//#endregion
//#region src/cert-renewal.ts
/** Days left below which the entry certificate is reported as expiring. */
const CERT_EXPIRING_DAYS = 2;
const DAY_MS = 864e5;
/** Evaluate one `notAfter` timestamp against the current clock. */
function evaluateCertificateLifetime(notAfter, now = Date.now()) {
	if (!Number.isFinite(notAfter) || !Number.isFinite(now)) return Object.freeze({
		state: "unknown",
		errorCode: "frp_attach_cert_unknown"
	});
	const daysRemaining = Math.floor((notAfter - now) / DAY_MS);
	if (notAfter <= now) return Object.freeze({
		state: "expired",
		notAfter,
		daysRemaining
	});
	if (daysRemaining <= 2) return Object.freeze({
		state: "expiring",
		notAfter,
		daysRemaining
	});
	return Object.freeze({
		state: "ok",
		notAfter,
		daysRemaining
	});
}
function statusFromCertificate(certificate, now) {
	const lifetime = evaluateCertificateLifetime(Date.parse(certificate.validTo), now);
	return Object.freeze({
		...lifetime,
		subject: certificate.subject,
		issuer: certificate.issuer
	});
}
/**
* Read one PEM certificate from disk and report only its lifetime.
*
* A missing or unreadable file yields `unknown` with the stable
* `frp_attach_cert_unknown` code so the panel can explain how to re-issue it.
*/
async function readCertificateRenewal(file, now = Date.now()) {
	try {
		return statusFromCertificate(new X509Certificate(await readFile(file)), now);
	} catch {
		return Object.freeze({
			state: "unknown",
			errorCode: "frp_attach_cert_unknown"
		});
	}
}
/**
* Ask a live TLS endpoint for its leaf certificate and report its lifetime.
*
* Verification is intentionally skipped: this is a read-only lifetime probe for
* an endpoint whose trust anchor is already pinned elsewhere, and a self-signed
* leaf is the expected answer for the passthrough entry.
*/
async function probeOriginCertificate(host, port, timeoutMs = 5e3) {
	if (!Number.isSafeInteger(port) || port < 1 || port > 65535) return Object.freeze({
		state: "unknown",
		errorCode: "frp_attach_cert_unknown"
	});
	return new Promise((resolveProbe) => {
		let finished = false;
		const socket = connect$1({
			host,
			port,
			rejectUnauthorized: false,
			servername: void 0
		});
		const finish = (status) => {
			if (finished) return;
			finished = true;
			clearTimeout(timer);
			socket.destroy();
			resolveProbe(status);
		};
		const timer = setTimeout(() => {
			finish(Object.freeze({
				state: "unknown",
				errorCode: "frp_attach_cert_unknown"
			}));
		}, timeoutMs);
		timer.unref();
		socket.once("secureConnect", () => {
			const certificate = socket.getPeerX509Certificate();
			finish(certificate === void 0 ? Object.freeze({
				state: "unknown",
				errorCode: "frp_attach_cert_unknown"
			}) : statusFromCertificate(certificate, Date.now()));
		});
		socket.once("error", () => {
			finish(Object.freeze({
				state: "unknown",
				errorCode: "frp_attach_cert_unknown"
			}));
		});
		socket.once("close", () => {
			finish(Object.freeze({
				state: "unknown",
				errorCode: "frp_attach_cert_unknown"
			}));
		});
	});
}
//#endregion
//#region src/managed-setup.ts
const VIRTUAL_INTERFACE_MARKERS = [
	"bridge",
	"docker",
	"hyper-v",
	"mihomo",
	"radmin",
	"tailscale",
	"tap",
	"tun",
	"utun",
	"vbox",
	"veth",
	"virtual",
	"vmware",
	"vpn",
	"vethernet",
	"wsl",
	"zerotier"
];
/** Route inspection is advisory; never let a system command hold setup open indefinitely. */
const ROUTE_COMMAND_TIMEOUT_MS = 5e3;
function requiredString(value, name) {
	if (typeof value !== "string" || value.length === 0) throw new Error(`${name} must be a non-empty string`);
	return value;
}
/** Validate the durable managed setup before it controls network and filesystem operations. */
function parseManagedSetup(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("mobile setup file must be an object");
	const record = value;
	if (record.version !== 2 || Reflect.ownKeys(record).some((key) => typeof key !== "string" || ![
		"version",
		"networkInterface",
		"listenPort",
		"upstreamOrigin",
		"tls",
		"extraAllowedCidrs"
	].includes(key))) throw new Error("mobile setup file has an unsupported format");
	if (!Number.isSafeInteger(record.listenPort) || record.listenPort < 1024 || record.listenPort > 65535) throw new Error("mobile setup listenPort must be from 1024 through 65535");
	if (typeof record.tls !== "object" || record.tls === null || Array.isArray(record.tls)) throw new Error("mobile setup tls must be an object");
	const tls = record.tls;
	if (tls.mode !== "managed" || Reflect.ownKeys(tls).some((key) => typeof key !== "string" || ![
		"mode",
		"caCertFile",
		"caKeyFile",
		"certFile",
		"keyFile"
	].includes(key))) throw new Error("mobile setup tls has an unsupported format");
	return Object.freeze({
		version: 2,
		networkInterface: requiredString(record.networkInterface, "mobile setup networkInterface"),
		listenPort: record.listenPort,
		upstreamOrigin: requiredString(record.upstreamOrigin, "mobile setup upstreamOrigin"),
		...record.extraAllowedCidrs === void 0 ? {} : { extraAllowedCidrs: parseAdditionalTrustedNetworks(record.extraAllowedCidrs) },
		tls: Object.freeze({
			mode: "managed",
			caCertFile: requiredString(tls.caCertFile, "mobile setup tls.caCertFile"),
			caKeyFile: requiredString(tls.caKeyFile, "mobile setup tls.caKeyFile"),
			certFile: requiredString(tls.certFile, "mobile setup tls.certFile"),
			keyFile: requiredString(tls.keyFile, "mobile setup tls.keyFile")
		})
	});
}
/** Validate explicitly trusted networks without adding implicit VPN or private ranges.
* @param value - CIDR strings submitted by the computer administrator.
* @returns Deduplicated validated CIDRs in input order.
*/
function parseAdditionalTrustedNetworks(value) {
	if (!Array.isArray(value)) throw new Error("extraAllowedCidrs must be an array of CIDR strings");
	const sources = value.map((entry) => {
		if (typeof entry !== "string" || entry.trim() === "") throw new Error("extraAllowedCidrs must be an array of CIDR strings");
		return entry.trim();
	});
	const entries = [];
	const seen = /* @__PURE__ */ new Set();
	for (const cidr of sources) {
		const parsed = parseCidr(cidr);
		const key = `${parsed.bits}:${parsed.network}:${parsed.prefix}`;
		if (seen.has(key)) continue;
		seen.add(key);
		entries.push(cidr);
	}
	return Object.freeze(entries);
}
/** Save extra trusted networks without replacing the interface or pairing identity.
* @param setupFile - Existing managed setup file.
* @param values - Explicitly selected additional networks.
* @returns The saved managed setup.
*/
async function saveManagedTrustedNetworks(setupFile, values) {
	const extraAllowedCidrs = parseAdditionalTrustedNetworks(values);
	const setup = parseManagedSetup(JSON.parse(await readFile(setupFile, "utf8")));
	const next = Object.freeze({
		...setup,
		extraAllowedCidrs
	});
	await atomicWrite(setupFile, `${JSON.stringify(next, null, 2)}\n`);
	await restrictPrivateFile(setupFile);
	return next;
}
function privateIpv4(value) {
	const parts = value.split(".").map(Number);
	return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) && (parts[0] === 10 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 || parts[0] === 192 && parts[1] === 168);
}
function networkCidr(address, cidr) {
	const prefix = Number(cidr.slice(cidr.lastIndexOf("/") + 1));
	const network = (address.split(".").reduce((total, part) => (total << 8 | Number(part)) >>> 0, 0) & (prefix === 0 ? 0 : 4294967295 << 32 - prefix >>> 0)) >>> 0;
	return `${[
		24,
		16,
		8,
		0
	].map((shift) => network >>> shift & 255).join(".")}/${String(prefix)}`;
}
/** List current private IPv4 candidates with their interface identity. */
function availableLanNetworks(table = networkInterfaces()) {
	const candidates = Object.entries(table).flatMap(([name, entries]) => (entries ?? []).filter((entry) => entry.family === "IPv4" && !entry.internal && privateIpv4(entry.address) && entry.cidr !== null).map((entry) => ({
		name,
		address: entry.address,
		cidr: networkCidr(entry.address, entry.cidr)
	})));
	return [...new Map(candidates.map((entry) => [`${entry.name}\0${entry.address}`, entry])).values()];
}
function likelyVirtualInterface(name) {
	const normalized = name.toLowerCase().replaceAll(/[^a-z0-9]+/gu, " ");
	return VIRTUAL_INTERFACE_MARKERS.some((marker) => normalized.includes(marker.replaceAll("-", " "))) || /^(?:br|wg)\d*\b/u.test(normalized);
}
async function runRouteCommand(file, args) {
	return (await execFileText(file, [...args], {
		encoding: "utf8",
		timeout: ROUTE_COMMAND_TIMEOUT_MS
	})).stdout;
}
function uniqueLines(output) {
	return [...new Set(output.split(/\r?\n/gu).map((line) => line.trim()).filter(Boolean))];
}
/** Return operating-system default-route interfaces in routing preference order. */
async function preferredLanInterfaceNames(platform = process.platform, run = runRouteCommand) {
	try {
		if (platform === "win32") return uniqueLines(await run("powershell.exe", [
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			[
				"$routes = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop",
				"$ranked = $routes | Where-Object { $_.State -eq 'Alive' -and $_.NextHop -ne '0.0.0.0' } | ForEach-Object {",
				"  $route = $_",
				"  $adapter = Get-NetAdapter -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue",
				"  $ip = Get-NetIPInterface -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue",
				"  if ($adapter -and $ip -and $adapter.Status -eq 'Up' -and $adapter.HardwareInterface -eq $true -and $adapter.Virtual -ne $true) {",
				"    [pscustomobject]@{ Name = $route.InterfaceAlias; Metric = [int]$route.RouteMetric + [int]$ip.InterfaceMetric }",
				"  }",
				"}",
				"$ranked | Sort-Object Metric | Select-Object -ExpandProperty Name -Unique"
			].join("; ")
		]));
		if (platform === "linux") {
			const routes = uniqueLines(await run("ip", [
				"-o",
				"-4",
				"route",
				"show",
				"default"
			])).map((line) => ({
				name: /(?:^|\s)dev\s+(\S+)/u.exec(line)?.[1],
				metric: Number(/(?:^|\s)metric\s+(\d+)/u.exec(line)?.[1] ?? 0)
			})).filter((route) => route.name !== void 0 && !likelyVirtualInterface(route.name)).sort((left, right) => left.metric - right.metric);
			return [...new Set(routes.map((route) => route.name))];
		}
		if (platform === "darwin") {
			const name = /^\s*interface:\s*(\S+)\s*$/mu.exec(await run("route", [
				"-n",
				"get",
				"default"
			]))?.[1];
			return name === void 0 || likelyVirtualInterface(name) ? [] : [name];
		}
	} catch {}
	return [];
}
/** Select an active LAN, optionally by address or by a previously saved interface name. */
function selectLanNetwork(requestedAddress, requestedInterface, table, preferredInterfaces = []) {
	const candidates = availableLanNetworks(table);
	if (requestedAddress !== void 0) {
		const match = candidates.find((candidate) => candidate.address === requestedAddress);
		if (match === void 0) throw new Error(`--address ${requestedAddress} is not an active private LAN address`);
		return match;
	}
	if (requestedInterface !== void 0) {
		const matches = candidates.filter((candidate) => candidate.name === requestedInterface);
		if (matches.length === 1) return matches[0];
		if (matches.length === 0) throw new Error(`saved LAN interface ${JSON.stringify(requestedInterface)} is not connected`);
		throw new Error(`saved LAN interface ${JSON.stringify(requestedInterface)} has more than one private IPv4 address`);
	}
	if (candidates.length === 1) return candidates[0];
	if (candidates.length === 0) throw new Error("no active private LAN address was found; connect to Wi-Fi or Ethernet");
	for (const name of preferredInterfaces) {
		const matches = candidates.filter((candidate) => candidate.name === name);
		if (matches.length === 1) return matches[0];
	}
	const physicalCandidates = candidates.filter((candidate) => !likelyVirtualInterface(candidate.name));
	if (physicalCandidates.length === 1) return physicalCandidates[0];
	throw new Error(`more than one LAN address is active; rerun with --address and one of: ${candidates.map((entry) => `${entry.name}=${entry.address}`).join(", ")}`);
}
/**
* True when the failure came from LAN selection (the configured network is
* gone, nothing is up, or several are) rather than from config/TLS code.
* Callers use it to degrade (warn + stay down) instead of failing boot.
* Pinned to the selectLanNetwork message contract — keep in sync.
*/
function isNetworkSelectionError(error) {
	const message = error instanceof Error ? error.message : String(error ?? "");
	return message.includes("is not connected") || message.includes("no active private LAN address was found") || message.includes("more than one LAN address is active") || message.includes("has more than one private IPv4 address") || message.includes("is not an active private LAN address");
}
function assertMatchingCa(certPem, keyPem) {
	const certificate = new X509Certificate(certPem);
	if (!certificate.ca || certificate.subject !== certificate.issuer || !certificate.verify(certificate.publicKey)) throw new Error("managed TLS CA must be a self-signed CA certificate");
	const privatePublic = createPublicKey(createPrivateKey(keyPem)).export({
		format: "der",
		type: "spki"
	});
	const certificatePublic = certificate.publicKey.export({
		format: "der",
		type: "spki"
	});
	if (!privatePublic.equals(certificatePublic)) throw new Error("managed TLS CA certificate and key do not match");
	if (Date.parse(certificate.validFrom) > Date.now() || Date.parse(certificate.validTo) <= Date.now()) throw new Error("managed TLS CA certificate is not currently valid");
	return certificate;
}
/** Read an existing managed CA without ever generating a replacement identity. */
async function readManagedCa(setup) {
	const [certPem, keyPem] = await Promise.all([readFile(setup.caCertFile, "utf8"), readFile(setup.caKeyFile, "utf8")]);
	return assertMatchingCa(certPem, keyPem);
}
async function atomicWrite(file, contents) {
	const directory = dirname(file);
	await mkdir(directory, {
		recursive: true,
		mode: 448
	});
	const temporary = join(directory, `.${basename(file)}.${randomBytes(12).toString("hex")}.tmp`);
	try {
		await writeFile(temporary, contents, {
			mode: 384,
			flag: "wx"
		});
		await restrictPrivateFile(temporary);
		await rename(temporary, file);
		await restrictPrivateFile(file);
	} finally {
		await rm(temporary, { force: true });
	}
}
/** Create a long-lived CA or migrate the legacy self-signed server certificate as that CA. */
async function ensureManagedCa(setup, legacy) {
	let certPem;
	let keyPem;
	try {
		[certPem, keyPem] = await Promise.all([readFile(setup.caCertFile, "utf8"), readFile(setup.caKeyFile, "utf8")]);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
		let migrated = false;
		if (legacy !== void 0) try {
			[certPem, keyPem] = await Promise.all([readFile(legacy.certFile, "utf8"), readFile(legacy.keyFile, "utf8")]);
			assertMatchingCa(certPem, keyPem);
			migrated = true;
		} catch (legacyError) {
			if (legacyError.code !== "ENOENT") throw legacyError;
		}
		if (!migrated) {
			const now = /* @__PURE__ */ new Date();
			const notAfter = new Date(now);
			notAfter.setFullYear(notAfter.getFullYear() + 5);
			const generated = await generate([{
				name: "commonName",
				value: "DeepSeek Harness Mobile CA"
			}], {
				keyType: "ec",
				curve: "P-256",
				algorithm: "sha256",
				notBeforeDate: /* @__PURE__ */ new Date(now.getTime() - 3e5),
				notAfterDate: notAfter,
				extensions: [{
					name: "basicConstraints",
					cA: true,
					critical: true
				}, {
					name: "keyUsage",
					digitalSignature: true,
					keyCertSign: true,
					cRLSign: true,
					critical: true
				}]
			});
			certPem = generated.cert;
			keyPem = generated.private;
		}
		if (certPem === void 0 || keyPem === void 0) throw new Error("managed TLS CA creation did not produce key material");
		await Promise.all([atomicWrite(setup.caCertFile, certPem), atomicWrite(setup.caKeyFile, keyPem)]);
	}
	if (certPem === void 0 || keyPem === void 0) throw new Error("managed TLS CA creation did not produce key material");
	await Promise.all([restrictPrivateFile(setup.caCertFile), restrictPrivateFile(setup.caKeyFile)]);
	return assertMatchingCa(certPem, keyPem);
}
function subjectAltNames(target) {
	const names = [];
	for (const ip of target.ipAddresses ?? []) names.push({
		type: 7,
		ip
	});
	for (const dns of target.dnsNames ?? []) names.push({
		type: 2,
		value: dns
	});
	if (names.length === 0) throw new Error("managed TLS leaf needs at least one server name");
	return names;
}
/**
* Sign one server leaf with an existing self-signed CA and install it privately.
*
* Both the LAN listener and the self-signed FRP ingress use this one path, so a
* certificate can never be produced by two divergent code paths. IP entries are
* required for console addresses (`type: 7`), DNS entries (`type: 2`) cover named
* hosts; the Android client accepts either through its pinned CA.
*/
async function issueServerCertificate(authority, target, output, lifetimeDays = 397) {
	const altNames = subjectAltNames(target);
	await Promise.all([restrictPrivateFile(authority.caCertFile), restrictPrivateFile(authority.caKeyFile)]);
	const [caCert, caKey] = await Promise.all([readFile(authority.caCertFile, "utf8"), readFile(authority.caKeyFile, "utf8")]);
	assertMatchingCa(caCert, caKey);
	const now = /* @__PURE__ */ new Date();
	const notAfter = new Date(now);
	notAfter.setDate(notAfter.getDate() + lifetimeDays);
	const server = await generate([{
		name: "commonName",
		value: target.commonName
	}], {
		keyType: "ec",
		curve: "P-256",
		algorithm: "sha256",
		notBeforeDate: /* @__PURE__ */ new Date(now.getTime() - 3e5),
		notAfterDate: notAfter,
		ca: {
			cert: caCert,
			key: caKey
		},
		extensions: [
			{
				name: "basicConstraints",
				cA: false,
				critical: true
			},
			{
				name: "keyUsage",
				digitalSignature: true,
				critical: true
			},
			{
				name: "extKeyUsage",
				serverAuth: true
			},
			{
				name: "subjectAltName",
				altNames
			}
		]
	});
	await Promise.all([atomicWrite(output.certFile, server.cert), atomicWrite(output.keyFile, server.private)]);
}
/** Sign and atomically install a server leaf for the interface's current address. */
async function refreshManagedServerCertificate(setup, address) {
	await issueServerCertificate({
		caCertFile: setup.tls.caCertFile,
		caKeyFile: setup.tls.caKeyFile
	}, {
		commonName: "DeepSeek Harness Mobile",
		ipAddresses: [address]
	}, {
		certFile: setup.tls.certFile,
		keyFile: setup.tls.keyFile
	});
}
/** Resolve the saved interface to the ordinary gateway config consumed by the Host plugin. */
async function materializeManagedSetup(setup, table) {
	const network = selectLanNetwork(void 0, setup.networkInterface, table);
	await refreshManagedServerCertificate(setup, network.address);
	const ca = new X509Certificate(await readFile(setup.tls.caCertFile, "utf8"));
	return {
		publicOrigin: `https://${network.address}:${String(setup.listenPort)}`,
		listenHost: network.address,
		allowedCidrs: parseAdditionalTrustedNetworks([network.cidr, ...setup.extraAllowedCidrs ?? []]),
		instanceId: ca.fingerprint256.replaceAll(":", "").toLowerCase(),
		pairingCaFile: setup.tls.caCertFile,
		tls: {
			mode: "provided",
			certFile: setup.tls.certFile,
			keyFile: setup.tls.keyFile
		}
	};
}
//#endregion
//#region src/frp-ingress.ts
/** Private ingress directory, always a sibling of the remote device file. */
function frpIngressPaths(stateFile) {
	const directory = join(dirname(stateFile), "ingress");
	return Object.freeze({
		directory,
		caCertFile: join(directory, "ca.pem"),
		caKeyFile: join(directory, "ca-key.pem"),
		certFile: join(directory, "server.pem"),
		keyFile: join(directory, "server-key.pem"),
		statusFile: join(dirname(stateFile), "ingress-identity.json")
	});
}
async function regularFileExists(file) {
	try {
		const entry = await lstat(file);
		if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("frp_ingress_file_invalid");
		return true;
	} catch (error) {
		if (error.code === "ENOENT") return false;
		throw error;
	}
}
async function readIngressIdentity(file) {
	if (!await regularFileExists(file)) return void 0;
	try {
		const parsed = JSON.parse(await readFile(file, "utf8"));
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("invalid identity");
		const record = parsed;
		if (record.version !== 1 || typeof record.caFingerprint !== "string" || !/^[a-f0-9]{64}$/u.test(record.caFingerprint)) throw new Error("invalid identity");
		return record.caFingerprint;
	} catch (error) {
		throw new Error("frp_ingress_ca_invalid", { cause: error });
	}
}
async function writeIngressIdentity(file, fingerprint, ownedRoot) {
	await writeManagedPrivateFile(ownedRoot, file, `${JSON.stringify({
		version: 1,
		caFingerprint: fingerprint
	})}\n`, "frp_ingress");
}
function coversPublicIp(certificate, address) {
	return (certificate.subjectAltName ?? "").split(",").some((entry) => entry.trim() === `IP Address:${address}`);
}
/**
* Materialize the CA and leaf the gateway terminates TLS with.
*
* The CA remains stable for paired phones; an expired CA must be re-paired, not
* replaced silently. The leaf is re-signed when expiring or no longer valid for
* the public IPv4, and the running gateway reloads it after a renewal check.
*/
async function ensureFrpIngressCertificate(settings, stateFile, now = Date.now(), expectedCaFingerprint, ownedRoot = dirname(stateFile)) {
	if (resolveFrpMode(settings) !== "attach" || !isFrpSelfSignedIngress(settings)) throw new Error("frp_entry_tls_invalid");
	const paths = frpIngressPaths(stateFile);
	await assertManagedParents(ownedRoot, paths.statusFile, "frp_ingress");
	await assertManagedParents(ownedRoot, paths.caCertFile, "frp_ingress");
	try {
		const directory = await lstat(paths.directory);
		if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error("frp_ingress_directory_invalid");
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	const previousFingerprint = await readIngressIdentity(paths.statusFile);
	const [caCertExists, caKeyExists, leafCertExists, leafKeyExists] = await Promise.all([
		regularFileExists(paths.caCertFile),
		regularFileExists(paths.caKeyFile),
		regularFileExists(paths.certFile),
		regularFileExists(paths.keyFile)
	]);
	if (caCertExists !== caKeyExists || !caCertExists && (previousFingerprint !== void 0 || leafCertExists || leafKeyExists)) throw new Error("frp_ingress_ca_invalid");
	if (caCertExists && (await readCertificateRenewal(paths.caCertFile, now)).state === "expired") throw new Error("frp_ingress_ca_expired");
	if (previousFingerprint === void 0) {
		await ensureManagedDirectory(ownedRoot, dirname(paths.statusFile), "frp_ingress");
		try {
			await writeFile(paths.statusFile, "{\"version\":1,\"pending\":true}\n", {
				flag: "wx",
				mode: 384
			});
			await restrictPrivateFile(paths.statusFile);
		} catch (error) {
			throw new Error("frp_ingress_ca_invalid", { cause: error });
		}
	}
	const caFiles = {
		mode: "managed",
		caCertFile: paths.caCertFile,
		caKeyFile: paths.caKeyFile,
		certFile: paths.certFile,
		keyFile: paths.keyFile
	};
	let ca;
	try {
		await assertManagedParents(ownedRoot, paths.caCertFile, "frp_ingress");
		ca = expectedCaFingerprint === void 0 ? await ensureManagedCa(caFiles) : await readManagedCa(caFiles);
	} catch (error) {
		throw new Error("frp_ingress_ca_invalid", { cause: error });
	}
	const caFingerprint = ca.fingerprint256.replaceAll(":", "").toLowerCase();
	if (previousFingerprint !== void 0 && caFingerprint !== previousFingerprint) throw new Error("frp_ingress_ca_changed");
	if (expectedCaFingerprint !== void 0 && caFingerprint !== expectedCaFingerprint) throw new Error("frp_ingress_ca_changed");
	if (previousFingerprint === void 0) await writeIngressIdentity(paths.statusFile, caFingerprint, ownedRoot);
	const publicHost = new URL(settings.publicOrigin).hostname;
	let leaf;
	try {
		leaf = new X509Certificate(await readFile(paths.certFile));
	} catch {
		leaf = void 0;
	}
	if (!(leaf !== void 0 && Date.parse(leaf.validTo) > now + 864e5 && coversPublicIp(leaf, publicHost) && leaf.verify(ca.publicKey))) {
		await assertManagedParents(ownedRoot, paths.certFile, "frp_ingress");
		await issueServerCertificate({
			caCertFile: paths.caCertFile,
			caKeyFile: paths.caKeyFile
		}, {
			commonName: "DSH Mobile FRP ingress",
			ipAddresses: [publicHost]
		}, {
			certFile: paths.certFile,
			keyFile: paths.keyFile
		});
		leaf = new X509Certificate(await readFile(paths.certFile));
	}
	const signed = leaf ?? (() => {
		throw new Error("frp_attach_cert_unknown");
	})();
	return Object.freeze({
		paths,
		ca,
		leaf: signed,
		caFingerprint,
		status: await readCertificateRenewal(paths.certFile, now)
	});
}
/**
* Build the read-only self-check payload shown in the desktop panel.
*
* No secret ever leaves this function: the CA is reported by fingerprint only,
* and the token is never read.
*/
async function frpIngressSelfCheck(settings, stateFile, ownedRoot = dirname(stateFile)) {
	const paths = frpIngressPaths(stateFile);
	const base = {
		mode: resolveFrpMode(settings),
		entryTls: resolveFrpEntryTls(settings),
		vhostHttpPort: resolveFrpVhostHttpPort(settings),
		publicPort: resolveFrpPublicPort(settings),
		publicOrigin: settings.publicOrigin,
		entryOrigin: frpEntryOrigin(settings),
		serverAddress: settings.serverAddress,
		serverPort: settings.serverPort,
		inbound: {
			listenHost: "127.0.0.1",
			allowedCidrs: Object.freeze(["127.0.0.0/8"])
		}
	};
	if (!isFrpSelfSignedIngress(settings)) return Object.freeze(base);
	await assertManagedParents(ownedRoot, paths.caCertFile, "frp_ingress");
	await assertManagedParents(ownedRoot, paths.certFile, "frp_ingress");
	let caFingerprint;
	try {
		caFingerprint = new X509Certificate(await readFile(paths.caCertFile)).fingerprint256.replaceAll(":", "").toLowerCase();
	} catch {
		caFingerprint = void 0;
	}
	return Object.freeze({
		...base,
		...caFingerprint === void 0 ? {} : { caFingerprint },
		certificate: await readCertificateRenewal(paths.certFile),
		caCertificate: await readCertificateRenewal(paths.caCertFile)
	});
}
/** Remove only the five files owned by the local self-signed FRP entry. */
async function purgeFrpIngressCertificates(stateFile, ownedRoot = dirname(stateFile)) {
	const paths = frpIngressPaths(stateFile);
	await assertManagedParents(ownedRoot, paths.statusFile, "frp_ingress");
	await assertManagedParents(ownedRoot, paths.directory, "frp_ingress");
	try {
		const marker = await lstat(paths.statusFile);
		if (!marker.isFile() && !marker.isSymbolicLink()) throw new Error("frp_ingress_file_invalid");
		await unlink(paths.statusFile);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	let directory;
	try {
		directory = await lstat(paths.directory);
	} catch (error) {
		if (error.code === "ENOENT") return;
		throw error;
	}
	if (directory.isSymbolicLink()) {
		await unlink(paths.directory);
		return;
	}
	if (!directory.isDirectory()) throw new Error("frp_ingress_directory_invalid");
	for (const file of [
		paths.caCertFile,
		paths.caKeyFile,
		paths.certFile,
		paths.keyFile
	]) {
		await assertManagedParents(ownedRoot, file, "frp_ingress");
		let entry;
		try {
			entry = await lstat(file);
		} catch (error) {
			if (error.code === "ENOENT") continue;
			throw error;
		}
		if (!entry.isFile() && !entry.isSymbolicLink()) throw new Error("frp_ingress_file_invalid");
		await unlink(file);
	}
	try {
		await assertManagedParents(ownedRoot, paths.directory, "frp_ingress");
		await rmdir(paths.directory);
	} catch (error) {
		if (error.code === "ENOENT") return;
		throw error;
	}
}
//#endregion
//#region src/remote.ts
const REMOTE_PROVIDERS = Object.freeze([
	"tailscale",
	"cpolar",
	"cloudflared",
	"frp",
	"origin"
]);
function aggregateErrors(errors, message) {
	if (errors.length === 0) return void 0;
	if (errors.length === 1 && errors[0] instanceof Error) return errors[0];
	return new AggregateError(errors, message);
}
/** Settle independent remote cleanup work before reporting any collected failure. */
async function settleRemoteResources(steps, message = "remote resource cleanup failed") {
	const failure = aggregateErrors((await Promise.allSettled(steps.map(async (step) => step()))).filter((result) => result.status === "rejected").map((result) => result.reason), message);
	if (failure !== void 0) throw failure;
}
/**
* Serialize all provider mutations and preserve the single-provider invariant.
* Operations read the selected controller only after reaching the front of the queue.
*/
var RemoteProviderCoordinator = class {
	controllers;
	store;
	selectedValue;
	queue = Promise.resolve();
	constructor(selected, controllers, store) {
		this.controllers = controllers;
		this.store = store;
		this.selectedValue = selected;
	}
	/** Return the durable provider currently selected by the desktop UI. */
	get selected() {
		return this.selectedValue;
	}
	/** Return the controller selected when this method is called. */
	controller() {
		return this.controllers[this.selectedValue];
	}
	/** Run a provider-owned mutation after all earlier provider work settles. */
	mutate(operation) {
		return this.enqueue(() => operation(this.controller()));
	}
	/** Apply one operation only while its intended provider remains selected.
	* @param provider - Provider the caller explicitly chose.
	* @param operation - Configuration and activation performed in the same queue item.
	* @returns The operation result, or a rejection when another selection won the queue.
	*/
	mutateSelected(provider, operation) {
		return this.enqueue(async () => {
			if (provider !== this.selectedValue) throw new Error("remote_provider_changed");
			return operation(this.controller());
		});
	}
	/** Disable the previous provider, persist the new selection, and retain rollback on write failure. */
	select(provider) {
		return this.enqueue(async () => {
			if (provider === this.selectedValue) return;
			const previous = this.controllers[this.selectedValue];
			const restore = previous.status().enabled;
			if (restore) await previous.setEnabled(false);
			try {
				await this.store.save({
					version: 1,
					provider
				});
				this.selectedValue = provider;
			} catch (error) {
				if (restore) try {
					await previous.setEnabled(true);
				} catch (restoreError) {
					throw new AggregateError([error, restoreError], "remote provider selection rollback failed");
				}
				throw error;
			}
		});
	}
	enqueue(operation) {
		const task = this.queue.then(() => this.runAndEnforce(operation), () => this.runAndEnforce(operation));
		this.queue = task.then(() => void 0, () => void 0);
		return task;
	}
	async runAndEnforce(operation) {
		let value;
		let operationError;
		try {
			value = await operation();
		} catch (error) {
			operationError = error;
		}
		const results = await Promise.allSettled(REMOTE_PROVIDERS.filter((provider) => provider !== this.selectedValue).map((provider) => this.controllers[provider].setEnabled(false)));
		const failure = aggregateErrors([...operationError === void 0 ? [] : [operationError], ...results.filter((result) => result.status === "rejected").map((result) => result.reason)], "remote provider operation failed");
		if (failure !== void 0) throw failure;
		return value;
	}
};
/** Stop an owned provider process and do not report completion before its close event. */
async function terminateRemoteProcess(child, gracefulTimeoutMs = 1500, forcedTimeoutMs = 1500) {
	if (child.exitCode !== null || child.signalCode !== null) return;
	await new Promise((resolveClose, rejectClose) => {
		let gracefulTimer;
		let forcedTimer;
		let settled = false;
		const finish = (error) => {
			if (settled) return;
			settled = true;
			if (gracefulTimer !== void 0) clearTimeout(gracefulTimer);
			if (forcedTimer !== void 0) clearTimeout(forcedTimer);
			child.off("close", onClose);
			if (error === void 0) resolveClose();
			else rejectClose(error);
		};
		const onClose = () => {
			finish();
		};
		child.once("close", onClose);
		try {
			child.kill("SIGTERM");
		} catch (error) {
			finish(error instanceof Error ? error : new Error(String(error)));
			return;
		}
		if (settled) return;
		gracefulTimer = setTimeout(() => {
			try {
				if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
			} catch (error) {
				finish(error instanceof Error ? error : new Error(String(error)));
				return;
			}
			if (settled) return;
			forcedTimer = setTimeout(() => {
				finish(/* @__PURE__ */ new Error("remote_process_stop_timeout"));
			}, forcedTimeoutMs);
			forcedTimer.unref();
		}, gracefulTimeoutMs);
		gracefulTimer.unref();
	});
}
/** Validate the provider selection loaded across the filesystem boundary. */
function parseRemoteProviderState(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("remote provider state must be an object");
	const record = value;
	if (record.version !== 1 || record.provider !== "tailscale" && record.provider !== "cpolar" && record.provider !== "cloudflared" && record.provider !== "frp" && record.provider !== "origin" || Reflect.ownKeys(record).some((key) => key !== "version" && key !== "provider")) throw new Error("remote provider state has an unsupported format");
	return Object.freeze({
		version: 1,
		provider: record.provider
	});
}
/** Atomic selection store whose absent-file state uses the configured default. */
var JsonRemoteProviderStore = class {
	file;
	defaultProvider;
	constructor(file, defaultProvider) {
		this.file = file;
		this.defaultProvider = defaultProvider;
	}
	async load() {
		let stat;
		try {
			stat = await lstat(this.file);
		} catch (error) {
			if (error.code === "ENOENT") return Object.freeze({
				version: 1,
				provider: this.defaultProvider
			});
			throw error;
		}
		if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw new Error("remote provider state must be a regular file no larger than 4 KiB");
		await restrictPrivateFile(this.file);
		let parsed;
		try {
			parsed = JSON.parse(await readFile(this.file, "utf8"));
		} catch (error) {
			throw new Error("remote provider state is not valid JSON", { cause: error });
		}
		return parseRemoteProviderState(parsed);
	}
	async save(state) {
		const validated = parseRemoteProviderState(state);
		const directory = dirname(this.file);
		await mkdir(directory, {
			recursive: true,
			mode: 448
		});
		try {
			const current = await lstat(this.file);
			if (!current.isFile() || current.isSymbolicLink()) throw new Error("remote provider state target must remain a regular file");
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
		const temporary = join(directory, `.${basename(this.file)}.${randomBytes(12).toString("hex")}.tmp`);
		try {
			await writeFile(temporary, `${JSON.stringify(validated)}\n`, {
				encoding: "utf8",
				flag: "wx",
				mode: 384
			});
			await rename(temporary, this.file);
			await restrictPrivateFile(this.file);
		} catch (error) {
			await rm(temporary, { force: true });
			throw error;
		}
	}
};
/** Resolve the first-run provider without letting environment values bypass validation. */
function configuredRemoteProvider(environment) {
	const value = environment.DSH_MOBILE_REMOTE_PROVIDER ?? "tailscale";
	if (value !== "tailscale" && value !== "cpolar" && value !== "cloudflared" && value !== "frp" && value !== "origin") throw new Error("DSH_MOBILE_REMOTE_PROVIDER must be tailscale, cpolar, cloudflared, frp, or origin");
	return value;
}
//#endregion
//#region src/frp.ts
const START_TIMEOUT_MS$2 = 45e3;
const DISCOVERY_REQUEST_TIMEOUT_MS = 5e3;
const DISCOVERY_RETRY_MS = 1e3;
const MAX_DISCOVERY_BYTES = 16384;
const VHOST_PROBE_TIMEOUT_MS = 1500;
const INGRESS_CERT_CHECK_MS = 432e5;
/**
* frpc start-failure signatures, most specific first.
*
* frpc reports a refused proxy registration as a warning and keeps running, so
* without this mapping the controller only ever saw a healthy child process and
* an entry port nobody published: the start-up self-check burned its full 45s
* deadline and reported `frp_start_timeout` ("the public endpoint did not become
* ready"), which sent users looking at DNS, Caddy, and firewalls.
*
* The two real conflicts are a proxy name another client of the same frps holds
* and an entry port another proxy already owns. Both are reported directly.
*/
const CLIENT_FAILURE_CODES = Object.freeze([
	[/proxy name \[[^\]]*\] is already in use/iu, "frp_proxy_name_in_use"],
	[/(?:remote )?port (?:\[?[0-9]+\]? )?already (?:used|in use)/iu, "frp_remote_port_in_use"],
	[/start error:/iu, "frp_proxy_start_failed"]
]);
/**
* Stable error code for a chunk of frpc output, or undefined when it reports no
* start failure. Exported for the conflict tests.
*/
function frpcDiagnosisCode(output) {
	return CLIENT_FAILURE_CODES.find(([pattern]) => pattern.test(output))?.[1];
}
function publicStatus$3(status) {
	return Object.freeze({
		enabled: status.enabled,
		state: status.state,
		...status.origin === void 0 ? {} : { origin: status.origin },
		...status.errorCode === void 0 ? {} : { errorCode: status.errorCode }
	});
}
async function defaultVerifyConfig(executable, configFile) {
	await new Promise((resolveRun, reject) => {
		execFile(executable, [
			"verify",
			"-c",
			configFile
		], {
			windowsHide: true,
			timeout: 3e4,
			maxBuffer: 65536
		}, (error) => {
			if (error === null) resolveRun();
			else reject(error);
		});
	});
}
function defaultLaunchClient(executable, configFile) {
	return spawn(executable, ["-c", configFile], {
		shell: false,
		stdio: [
			"pipe",
			"pipe",
			"pipe"
		],
		windowsHide: true
	});
}
async function defaultProbeVhostExposure(serverAddress, port) {
	return new Promise((resolveProbe) => {
		const socket = connect({
			host: serverAddress,
			port
		});
		let finished = false;
		let received = "";
		const finish = (exposed) => {
			if (finished) return;
			finished = true;
			clearTimeout(timer);
			socket.destroy();
			resolveProbe(exposed);
		};
		const timer = setTimeout(() => {
			finish(false);
		}, VHOST_PROBE_TIMEOUT_MS);
		timer.unref();
		socket.once("connect", () => {
			socket.write("GET /dsh-mobile-exposure-probe HTTP/1.1\r\nHost: invalid.example\r\nConnection: close\r\n\r\n");
		});
		socket.on("data", (chunk) => {
			received = `${received}${chunk.toString("latin1")}`.slice(0, 32);
			if (/^HTTP\/1\.[01] [1-5][0-9]{2}/u.test(received)) finish(true);
		});
		socket.once("close", () => {
			finish(false);
		});
		socket.once("error", () => {
			finish(false);
		});
	});
}
async function boundedResponseBytes(response) {
	if (response.body === null) throw new Error("frp_discovery_invalid");
	const declaredLength = Number(response.headers.get("content-length"));
	if (Number.isFinite(declaredLength) && declaredLength > MAX_DISCOVERY_BYTES) throw new Error("frp_discovery_invalid");
	const reader = response.body.getReader();
	const chunks = [];
	let received = 0;
	while (true) {
		const result = await reader.read();
		if (result.done) break;
		received += result.value.byteLength;
		if (received > MAX_DISCOVERY_BYTES) {
			await reader.cancel();
			throw new Error("frp_discovery_invalid");
		}
		chunks.push(result.value);
	}
	const bytes = new Uint8Array(received);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}
/** Web view over an HTTPS response so the byte cap applies to both paths alike. */
function discoveryResponse(message) {
	const headers = new Headers();
	const declaredLength = message.headers["content-length"];
	if (declaredLength !== void 0) headers.set("content-length", declaredLength);
	return new Response(Readable.toWeb(message), {
		status: message.statusCode ?? 200,
		headers
	});
}
/**
* Perform one discovery request against the public entry.
*
* `node:https` carries this request instead of the global `fetch` for a single
* reason: only here can the trust anchor be stated. The self-signed entry
* presents a leaf the plugin's own ingress CA signed, so the default chain
* always fails there (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) even though the
* transport itself is healthy. The anchor is *added* to the trust store — never
* `rejectUnauthorized: false` — so the peer must still prove its identity, and
* the verified name stays the host of the origin, which is the name the app
* dials as well (Node matches IP literals against `IP Address:` SANs).
*
* A non-200 answer resolves `undefined` for retry; discovery requires a body.
* transport, TLS, and timeout failures reject so the caller keeps retrying.
* The request stays cancellable until the bounded response body has completed.
*/
function requestDiscovery(target, signal) {
	if (signal.aborted) return Promise.reject(/* @__PURE__ */ new Error("frp_discovery_aborted"));
	const url = new URL(`${target.origin}/mobile-access/discovery`);
	if (url.protocol !== "https:" || url.hostname === "") return Promise.reject(/* @__PURE__ */ new Error("frp_discovery_invalid"));
	return new Promise((resolveRequest, rejectRequest) => {
		let settled = false;
		let request;
		const release = () => {
			clearTimeout(timeout);
			signal.removeEventListener("abort", onAbort);
		};
		const fail = (error) => {
			if (settled) return;
			settled = true;
			release();
			request?.destroy();
			rejectRequest(error);
		};
		const succeed = (value) => {
			if (settled) return;
			settled = true;
			release();
			resolveRequest(value);
		};
		const onAbort = () => {
			fail(/* @__PURE__ */ new Error("frp_discovery_aborted"));
		};
		const timeout = setTimeout(() => {
			fail(/* @__PURE__ */ new Error("frp_discovery_timeout"));
		}, DISCOVERY_REQUEST_TIMEOUT_MS);
		timeout.unref();
		signal.addEventListener("abort", onAbort, { once: true });
		request = request$1({
			host: url.hostname,
			port: url.port === "" ? 443 : Number(url.port),
			path: url.pathname,
			method: "GET",
			headers: { accept: "application/json" },
			...target.trustAnchorPem === void 0 ? {} : { ca: target.trustAnchorPem },
			agent: false
		}, (message) => {
			if ((message.statusCode ?? 0) !== 200) {
				succeed(void 0);
				message.destroy();
				return;
			}
			boundedResponseBytes(discoveryResponse(message)).then(succeed, fail);
		});
		request.once("error", (error) => {
			fail(error instanceof Error ? error : /* @__PURE__ */ new Error("frp_discovery_request_failed"));
		});
		request.end();
	});
}
/**
* Read the public discovery advertisement and compare it with the expected
* identity.
*
* `frp_discovery_invalid` (malformed body) and `frp_discovery_mismatch` (the
* entry advertises another identity) stay immediate failures; transport, TLS,
* and timeout problems reject so the caller retries until its deadline.
*/
async function defaultProbeDiscovery(target, expectedInstanceId, signal) {
	const bytes = await requestDiscovery(target, signal);
	if (bytes === void 0) return false;
	let value;
	try {
		value = JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		throw new Error("frp_discovery_invalid");
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("frp_discovery_invalid");
	const actual = value.instanceId;
	if (typeof actual !== "string") throw new Error("frp_discovery_invalid");
	if (actual !== expectedInstanceId) throw new Error("frp_discovery_mismatch");
	return true;
}
/** Owns frpc, its generation-specific configuration, and the remote gateway. */
var FrpController = class {
	options;
	enabled = false;
	initialized = false;
	disposed = false;
	child;
	gatewayValue;
	generation = 0;
	latest = publicStatus$3({
		enabled: false,
		state: "off"
	});
	queue = Promise.resolve();
	startupAbort;
	ingressCertificateTimer;
	constructor(options) {
		this.options = options;
		if (!isAbsolute(options.executable)) throw new Error("frpc executable path must be absolute");
		if (!/^[a-f0-9]{64}$/u.test(options.instanceId)) throw new Error("FRP instance ID is invalid");
		if (options.ingressCertificateCheckMs !== void 0 && (!Number.isSafeInteger(options.ingressCertificateCheckMs) || options.ingressCertificateCheckMs < 1 || options.ingressCertificateCheckMs > 2147483647)) throw new Error("frp_ingress_check_interval_invalid");
	}
	/** Restore the remembered FRP switch without changing LAN or other providers. */
	async initialize() {
		const state = await this.options.store.load();
		this.enabled = state.enabled;
		this.initialized = true;
		if (this.enabled) await this.start();
		else this.publish({
			enabled: false,
			state: "off"
		});
	}
	/** Return the active FRP-backed DSH gateway. */
	gateway() {
		return this.gatewayValue;
	}
	/** Return state safe for the desktop control UI. */
	status() {
		return publicStatus$3(this.latest);
	}
	/** Enable or disable FRP without changing LAN or another provider. */
	async setEnabled(enabled) {
		if (!this.initialized || this.disposed) throw new Error("FRP controller is unavailable");
		await this.enqueue(async () => {
			if (this.enabled === enabled && (enabled === false || this.child !== void 0)) return;
			if (!enabled) await this.stop();
			this.enabled = enabled;
			await this.options.store.save({
				version: 1,
				enabled
			});
			if (enabled) await this.start();
			else this.publish({
				enabled: false,
				state: "off"
			});
		});
		return this.status();
	}
	/** Restart FRP while retaining its private server settings and devices. */
	async reconnect() {
		if (!this.initialized || this.disposed) throw new Error("FRP controller is unavailable");
		await this.enqueue(async () => {
			if (!this.enabled) {
				this.enabled = true;
				await this.options.store.save({
					version: 1,
					enabled: true
				});
			}
			await this.stop();
			await this.start();
		});
		return this.status();
	}
	/** Disable FRP without deleting its explicitly managed component or settings. */
	async reset() {
		if (!this.initialized || this.disposed) throw new Error("FRP controller is unavailable");
		await this.enqueue(async () => {
			await this.stop();
			this.enabled = false;
			await this.options.store.save({
				version: 1,
				enabled: false
			});
			this.publish({
				enabled: false,
				state: "off"
			});
		});
		return this.status();
	}
	/** Stop all FRP resources without changing the remembered switch. */
	async close() {
		if (this.disposed) return;
		this.disposed = true;
		await this.enqueue(() => this.stop());
	}
	enqueue(operation) {
		const task = this.queue.then(operation, operation);
		this.queue = task.then(() => void 0, () => void 0);
		return task;
	}
	publish(status) {
		this.latest = publicStatus$3(status);
		try {
			this.options.onStatus?.(this.status());
		} catch {}
	}
	async start() {
		const generation = ++this.generation;
		let executableEntry;
		try {
			executableEntry = await lstat(this.options.executable);
		} catch {
			this.publish({
				enabled: true,
				state: "unavailable",
				errorCode: "frp_component_missing"
			});
			return;
		}
		if (!executableEntry.isFile() || executableEntry.isSymbolicLink()) {
			this.publish({
				enabled: true,
				state: "unavailable",
				errorCode: "frp_component_invalid"
			});
			return;
		}
		const settings = this.options.config.settings();
		if (settings === void 0) {
			this.publish({
				enabled: true,
				state: "unavailable",
				errorCode: "frp_config_missing"
			});
			return;
		}
		const entryOrigin = frpEntryOrigin(settings);
		this.publish({
			enabled: true,
			state: "starting",
			origin: entryOrigin
		});
		if (!isFrpSelfSignedIngress(settings)) {
			let exposed;
			try {
				exposed = await (this.options.probeVhostExposure ?? defaultProbeVhostExposure)(settings.serverAddress, resolveFrpVhostHttpPort(settings));
			} catch {
				this.publish({
					enabled: true,
					state: "error",
					origin: entryOrigin,
					errorCode: "frp_vhost_probe_failed"
				});
				return;
			}
			if (exposed) {
				this.publish({
					enabled: true,
					state: "error",
					origin: entryOrigin,
					errorCode: "frp_vhost_publicly_reachable"
				});
				return;
			}
		}
		let gateway;
		try {
			gateway = await this.options.createGateway(settings.publicOrigin, settings);
		} catch (error) {
			const code = error instanceof Error && error.message.startsWith("frp_") ? error.message : "gateway_start_failed";
			this.publish({
				enabled: true,
				state: "error",
				origin: entryOrigin,
				errorCode: code
			});
			return;
		}
		if (generation !== this.generation || !this.enabled) {
			await gateway.close();
			return;
		}
		this.gatewayValue = gateway;
		let configFile;
		try {
			configFile = await this.options.config.writeRuntimeConfig(gateway.address().port);
			await (this.options.verifyConfig ?? defaultVerifyConfig)(this.options.executable, configFile);
		} catch {
			await this.failGeneration(generation, "frp_config_verify_failed");
			return;
		}
		if (generation !== this.generation || !this.enabled) return;
		let child;
		try {
			child = (this.options.launchClient ?? defaultLaunchClient)(this.options.executable, configFile);
		} catch {
			await this.failGeneration(generation, "frp_launch_failed");
			return;
		}
		this.child = child;
		const pending = {
			stdout: "",
			stderr: ""
		};
		let diagnosed = false;
		const inspectLine = (line) => {
			if (diagnosed) return;
			const code = frpcDiagnosisCode(line);
			if (code === void 0) return;
			diagnosed = true;
			this.enqueue(() => this.failGeneration(generation, code));
		};
		const inspect = (stream, chunk) => {
			if (diagnosed) return;
			const lines = (pending[stream] + String(chunk)).split(/\r\n|\r|\n/u);
			pending[stream] = (lines.pop() ?? "").slice(-8192);
			for (const line of lines) inspectLine(line.slice(-8192));
		};
		child.stdout.on("data", (chunk) => inspect("stdout", chunk));
		child.stderr.on("data", (chunk) => inspect("stderr", chunk));
		child.stdout.resume();
		child.stderr.resume();
		child.once("error", () => {
			this.enqueue(() => this.failGeneration(generation, "frp_launch_failed"));
		});
		child.once("close", (code) => {
			inspectLine(pending.stdout);
			inspectLine(pending.stderr);
			if (generation !== this.generation || this.child !== child) return;
			this.child = void 0;
			if (this.enabled && !diagnosed) this.enqueue(() => this.failGeneration(generation, code === 0 ? "frp_stopped" : "frp_exited"));
		});
		this.publish({
			enabled: true,
			state: "connecting",
			origin: entryOrigin
		});
		let check;
		try {
			check = await this.discoveryCheck(settings);
		} catch (error) {
			const code = error instanceof Error && error.message.startsWith("frp_") ? error.message : "frp_ingress_ca_invalid";
			await this.failGeneration(generation, code);
			return;
		}
		if (generation !== this.generation || !this.enabled) return;
		if (diagnosed) return;
		const controller = new AbortController();
		this.startupAbort = controller;
		this.waitForDiscovery(generation, check, gateway.config.instanceId, settings, gateway, controller.signal);
	}
	/**
	* Derive the self-check target and trust anchor for the effective entry.
	*
	* The public-CA entry is reached on the saved origin itself: Caddy terminates
	* TLS on 443 with a publicly trusted certificate, so the probe must keep the
	* system trust store and the origin URL untouched. The self-signed entry is a
	* raw TCP passthrough on `publicPort` whose leaf chains to the ingress CA the
	* app pins from `pairingCaFile`; probing `publicOrigin` there would knock on
	* 443 — where nothing listens — with a chain the system cannot verify. Both
	* facts used to be implicit, and together they kept the channel out of `ready`
	* until `frp_start_timeout`.
	*/
	async discoveryCheck(settings) {
		if (!isFrpSelfSignedIngress(settings)) return {
			publicOrigin: settings.publicOrigin,
			targetOrigin: settings.publicOrigin
		};
		const targetOrigin = frpEntryOrigin(settings);
		const trustAnchorPem = await this.options.resolveDiscoveryTrustAnchor?.(settings);
		if (this.options.resolveDiscoveryTrustAnchor !== void 0 && trustAnchorPem === void 0) throw new Error("frp_ingress_ca_invalid");
		return Object.freeze({
			publicOrigin: targetOrigin,
			targetOrigin,
			...trustAnchorPem === void 0 ? {} : { trustAnchorPem }
		});
	}
	async waitForDiscovery(generation, check, advertisedInstanceId, settings, gateway, signal) {
		const deadline = Date.now() + (this.options.startTimeoutMs ?? START_TIMEOUT_MS$2);
		const probe = this.options.probeDiscovery ?? defaultProbeDiscovery;
		const target = Object.freeze({
			origin: check.targetOrigin,
			...check.trustAnchorPem === void 0 ? {} : { trustAnchorPem: check.trustAnchorPem }
		});
		while (!signal.aborted && Date.now() < deadline) {
			try {
				if (await probe(target, advertisedInstanceId, signal)) {
					await this.enqueue(async () => {
						if (generation !== this.generation || signal.aborted || !this.enabled) return;
						this.startupAbort = void 0;
						this.publish({
							enabled: true,
							state: "ready",
							origin: check.publicOrigin
						});
						this.scheduleIngressCertificateCheck(generation, settings, gateway);
					});
					return;
				}
			} catch (error) {
				if (signal.aborted) return;
				if (error instanceof Error && (error.message === "frp_discovery_mismatch" || error.message === "frp_discovery_invalid")) {
					await this.enqueue(() => this.failGeneration(generation, error.message));
					return;
				}
			}
			await new Promise((resolveWait) => {
				let finished = false;
				const finish = () => {
					if (finished) return;
					finished = true;
					clearTimeout(timer);
					signal.removeEventListener("abort", finish);
					resolveWait();
				};
				const timer = setTimeout(finish, this.options.retryIntervalMs ?? DISCOVERY_RETRY_MS);
				timer.unref();
				signal.addEventListener("abort", finish, { once: true });
			});
		}
		if (!signal.aborted) await this.enqueue(() => this.failGeneration(generation, "frp_start_timeout"));
	}
	scheduleIngressCertificateCheck(generation, settings, gateway) {
		const maintain = this.options.maintainIngressCertificate;
		if (!isFrpSelfSignedIngress(settings) || maintain === void 0) return;
		const timer = setTimeout(() => {
			if (this.ingressCertificateTimer !== timer) return;
			this.ingressCertificateTimer = void 0;
			this.enqueue(async () => {
				if (generation !== this.generation || !this.enabled || this.disposed || this.gatewayValue !== gateway) return;
				try {
					await maintain(settings, gateway);
				} catch (error) {
					const code = error instanceof Error && error.message.startsWith("frp_") ? error.message : "frp_ingress_renewal_failed";
					await this.failGeneration(generation, code);
					return;
				}
				if (generation === this.generation && this.enabled && !this.disposed && this.gatewayValue === gateway) this.scheduleIngressCertificateCheck(generation, settings, gateway);
			}).catch(() => {
				if (generation === this.generation && this.enabled && !this.disposed) this.publish({
					enabled: true,
					state: "error",
					errorCode: "frp_ingress_renewal_failed"
				});
			});
		}, this.options.ingressCertificateCheckMs ?? INGRESS_CERT_CHECK_MS);
		timer.unref();
		this.ingressCertificateTimer = timer;
	}
	async failGeneration(generation, code) {
		if (generation !== this.generation) return;
		await this.stopProcessAndGateway();
		if (this.enabled) this.publish({
			enabled: true,
			state: "error",
			errorCode: code
		});
	}
	async stop() {
		++this.generation;
		await this.stopProcessAndGateway();
	}
	async stopProcessAndGateway() {
		clearTimeout(this.ingressCertificateTimer);
		this.ingressCertificateTimer = void 0;
		this.startupAbort?.abort();
		this.startupAbort = void 0;
		const child = this.child;
		this.child = void 0;
		const gateway = this.gatewayValue;
		this.gatewayValue = void 0;
		await settleRemoteResources([
			() => child !== void 0 && child.exitCode === null ? terminateRemoteProcess(child) : void 0,
			() => gateway?.close(),
			() => rm(this.options.config.runtimeConfigFile, { force: true })
		], "FRP resource cleanup failed");
	}
};
//#endregion
//#region src/origin-proxy-config.ts
const DEFAULT_ORIGIN_LISTEN_PORT = 3444;
const MAX_SETTINGS_BYTES = 8192;
/**
* Ports a user-space listener can actually hold on every supported platform. Below
* this the bind needs privileges on Linux and macOS and fails with EACCES, which
* surfaces as a generic start failure rather than a rejected choice.
*/
const MIN_ORIGIN_LISTEN_PORT = 1024;
/** The LAN gateway's HTTPS port, held for as long as DSH runs. */
const RESERVED_LAN_GATEWAY_PORT$1 = 3443;
/** DSH's own WebServer port; the plugin cannot function while it is taken. */
const RESERVED_DSH_WEB_PORT = 3080;
const PRIVATE_NETWORKS = [
	"10.0.0.0/8",
	"172.16.0.0/12",
	"192.168.0.0/16"
].map(parseCidr);
const TRUSTED_NETWORKS = [...PRIVATE_NETWORKS, parseCidr("127.0.0.0/8")];
/** Require a public HTTPS origin; custom external ports are supported. */
function validateOriginPublicOrigin(value) {
	if (typeof value !== "string" || value.length > 512 || /[\s\u0000-\u001f\u007f\\@?#]/u.test(value)) throw new Error("origin_public_origin_invalid");
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error("origin_public_origin_invalid");
	}
	const host = url.hostname;
	const validHostname = host.length <= 253 && host.includes(".") && host.split(".").every((label) => label.length >= 1 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label)) && ![
		"localhost",
		"local",
		"lan",
		"home",
		"internal",
		"home.arpa"
	].some((suffix) => host === suffix || host.endsWith("." + suffix));
	if (url.protocol !== "https:" || url.pathname !== "/" || url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "" || url.port !== "" && Number(url.port) < 1 || (isIP(host) === 4 ? !isGloballyRoutableIpv4(host) : isIP(host) !== 0 || !validHostname)) throw new Error("origin_public_origin_invalid");
	return url.origin;
}
/** Bind only one explicit loopback or RFC1918 IPv4 interface, never all interfaces. */
function validateOriginListenHost(value) {
	if (typeof value !== "string" || isIP(value) !== 4 || !isLoopbackAddress(value) && !addressAllowed(value, PRIVATE_NETWORKS)) throw new Error("origin_listen_host_invalid");
	return value;
}
function validateOriginListenPort(value) {
	if (!Number.isSafeInteger(value) || Number(value) < MIN_ORIGIN_LISTEN_PORT || Number(value) > 65535) throw new Error("origin_listen_port_invalid");
	if (value === RESERVED_LAN_GATEWAY_PORT$1 || value === RESERVED_DSH_WEB_PORT) throw new Error("origin_listen_port_reserved");
	return Number(value);
}
/** Authorize direct proxy socket peers, not untrusted forwarded client headers. */
function validateOriginAllowedCidrs(value, listenHost) {
	const input = value === void 0 && isLoopbackAddress(listenHost) ? ["127.0.0.0/8"] : value;
	if (!Array.isArray(input) || input.length === 0 || input.length > 16) throw new Error("origin_allowed_cidrs_invalid");
	const cidrs = [];
	for (const entry of input) {
		if (typeof entry !== "string" || entry.length > 64 || isIP(entry.split("/")[0] ?? "") !== 4) throw new Error("origin_allowed_cidrs_invalid");
		try {
			const cidr = parseCidr(entry);
			if (cidr.bits !== 32 || !TRUSTED_NETWORKS.some((range) => cidr.prefix >= range.prefix && addressAllowed(entry.split("/")[0], [range]))) throw new Error("untrusted CIDR");
			cidrs.push(cidr.source);
		} catch {
			throw new Error("origin_allowed_cidrs_invalid");
		}
	}
	if (!isLoopbackAddress(listenHost) && !cidrs.some((cidr) => !isLoopbackAddress(cidr.split("/")[0]))) throw new Error("origin_allowed_cidrs_invalid");
	return Object.freeze([...new Set(cidrs)]);
}
/** Validate both saved settings and local administrative requests. */
function parseOriginSettings(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("origin_settings_invalid");
	const record = value;
	if (Reflect.ownKeys(record).some((key) => ![
		"version",
		"publicOrigin",
		"listenHost",
		"listenPort",
		"allowedCidrs"
	].includes(String(key))) || record.version !== void 0 && record.version !== 1) throw new Error("origin_settings_invalid");
	const listenHost = validateOriginListenHost(record.listenHost === void 0 ? "127.0.0.1" : record.listenHost);
	return Object.freeze({
		version: 1,
		publicOrigin: validateOriginPublicOrigin(record.publicOrigin),
		listenHost,
		listenPort: validateOriginListenPort(record.listenPort === void 0 ? DEFAULT_ORIGIN_LISTEN_PORT : record.listenPort),
		allowedCidrs: validateOriginAllowedCidrs(record.allowedCidrs, listenHost)
	});
}
/** Owns only origin settings; shared paired-device storage is never removed. */
var OriginConfigStore = class {
	ownedRoot;
	stateRoot;
	settingsFile;
	settingsValue;
	errorCode;
	constructor(stateDirectory, ownedRoot = stateDirectory) {
		this.ownedRoot = ownedRoot;
		if (!isAbsolute(stateDirectory)) throw new Error("origin config state directory must be absolute");
		this.stateRoot = resolve(stateDirectory);
		this.settingsFile = join(this.stateRoot, "settings.json");
	}
	async initialize() {
		this.settingsValue = void 0;
		this.errorCode = void 0;
		try {
			await assertManagedParents(this.ownedRoot, this.settingsFile, "origin");
		} catch (_error) {
			this.errorCode = "origin_config_invalid";
			return;
		}
		let entry;
		try {
			entry = await lstat(this.settingsFile);
		} catch (error) {
			if (error.code === "ENOENT") return;
			throw error;
		}
		if (!entry.isFile() || entry.isSymbolicLink() || entry.size > MAX_SETTINGS_BYTES) {
			this.errorCode = "origin_config_invalid";
			return;
		}
		await restrictPrivateFile(this.settingsFile);
		try {
			this.settingsValue = parseOriginSettings(JSON.parse(await readFile(this.settingsFile, "utf8")));
		} catch {
			this.errorCode = "origin_config_invalid";
		}
	}
	status() {
		const settings = this.settingsValue;
		return Object.freeze({
			configured: settings !== void 0,
			...settings === void 0 ? {} : {
				publicOrigin: settings.publicOrigin,
				listenHost: settings.listenHost,
				listenPort: settings.listenPort,
				allowedCidrs: settings.allowedCidrs,
				backendOrigin: "http://" + settings.listenHost + ":" + String(settings.listenPort)
			},
			storagePath: this.stateRoot,
			...this.errorCode === void 0 ? {} : { errorCode: this.errorCode }
		});
	}
	settings() {
		return this.settingsValue;
	}
	async configure(value) {
		const settings = parseOriginSettings(value);
		await writeManagedPrivateFile(this.ownedRoot, this.settingsFile, JSON.stringify(settings) + "\n", "origin");
		this.settingsValue = settings;
		this.errorCode = void 0;
		return this.status();
	}
	async purge() {
		await removeManagedTree(this.ownedRoot, this.settingsFile, "origin");
		this.settingsValue = void 0;
		this.errorCode = void 0;
		return this.status();
	}
};
//#endregion
//#region src/origin-proxy.ts
/** Owns an authenticated HTTP gateway, with no tunnel process or public network probes. */
var OriginController = class {
	options;
	enabled = false;
	initialized = false;
	disposed = false;
	gatewayValue;
	latest = Object.freeze({
		enabled: false,
		state: "off"
	});
	queue = Promise.resolve();
	constructor(options) {
		this.options = options;
	}
	async initialize() {
		await this.enqueue(async () => {
			if (this.disposed) throw new Error("origin_controller_unavailable");
			if (this.initialized) return;
			this.enabled = (await this.options.store.load()).enabled;
			this.initialized = true;
			if (this.enabled) await this.start();
			else this.publish({
				enabled: false,
				state: "off"
			});
		});
	}
	gateway() {
		return this.gatewayValue;
	}
	status() {
		return this.latest;
	}
	async setEnabled(enabled) {
		this.assertAvailable();
		await this.enqueue(async () => {
			this.assertAvailable();
			if (this.enabled === enabled && (!enabled || this.gatewayValue !== void 0)) return;
			if (!enabled) await this.stop();
			await this.options.store.save({
				version: 1,
				enabled
			});
			this.enabled = enabled;
			if (enabled) await this.start();
			else this.publish({
				enabled: false,
				state: "off"
			});
		});
		return this.status();
	}
	async reconnect() {
		this.assertAvailable();
		await this.enqueue(async () => {
			this.assertAvailable();
			if (!this.enabled) {
				await this.options.store.save({
					version: 1,
					enabled: true
				});
				this.enabled = true;
			}
			await this.stop();
			await this.start();
		});
		return this.status();
	}
	/** Reset the switch, retaining both settings and shared remote device pairings. */
	async reset() {
		return this.setEnabled(false);
	}
	/** Stop the listener without changing the durable switch. */
	async close() {
		this.disposed = true;
		await this.enqueue(async () => {
			await this.stop();
			this.publish({
				enabled: this.enabled,
				state: "off"
			});
		});
	}
	assertAvailable() {
		if (!this.initialized || this.disposed) throw new Error("origin_controller_unavailable");
	}
	enqueue(operation) {
		const task = this.queue.then(operation, operation);
		this.queue = task.then(() => void 0, () => void 0);
		return task;
	}
	publish(status) {
		this.latest = Object.freeze({ ...status });
		try {
			this.options.onStatus?.(this.latest);
		} catch {}
	}
	async start() {
		const settings = this.options.config.settings();
		if (settings === void 0) {
			this.publish({
				enabled: true,
				state: "unavailable",
				errorCode: this.options.config.status().errorCode ?? "origin_config_missing"
			});
			return;
		}
		this.publish({
			enabled: true,
			state: "starting",
			origin: settings.publicOrigin
		});
		let gateway;
		try {
			gateway = await this.options.createGateway(settings);
		} catch (error) {
			const code = typeof error === "object" && error !== null && "code" in error ? error.code : void 0;
			this.publish({
				enabled: true,
				state: "error",
				origin: settings.publicOrigin,
				errorCode: code === "EADDRINUSE" ? "origin_listen_port_in_use" : code === "EADDRNOTAVAIL" ? "origin_listen_address_unavailable" : "origin_gateway_start_failed"
			});
			return;
		}
		this.gatewayValue = gateway;
		if (this.disposed) {
			await this.stop();
			return;
		}
		this.publish({
			enabled: true,
			state: "ready",
			origin: settings.publicOrigin,
			backendOrigin: "http://" + settings.listenHost + ":" + String(gateway.address().port)
		});
	}
	async stop() {
		const gateway = this.gatewayValue;
		if (gateway === void 0) return;
		await gateway.close();
		this.gatewayValue = void 0;
		this.publish({
			enabled: this.enabled,
			state: "off"
		});
	}
};
//#endregion
//#region src/component-download.ts
/**
* Hosts a pinned GitHub release download may redirect to.
*
* `github.com/<owner>/<repo>/releases/download/<tag>/<asset>` does not serve the bytes itself: it
* answers 302 with a signed URL on a release-asset host. A fetch configured with
* `redirect: 'error'` fails that hop as `TypeError: fetch failed` (cause: `unexpected redirect`)
* before a single byte is transferred, which is exactly how the cloudflared component could never
* install. Following one validated hop keeps the origin restriction while allowing the shape
* every GitHub release download uses.
*/
const RELEASE_ASSET_HOSTS = Object.freeze(["release-assets.githubusercontent.com", "objects.githubusercontent.com"]);
/** Follow one redirect hop after checking its scheme and host. A second hop is refused. */
async function followValidatedRedirect(response, request) {
	const location = response.headers.get("location");
	if (location === null) throw new Error(`${request.errorPrefix}_download_redirect_missing`);
	let target;
	try {
		target = new URL(location, request.url);
	} catch {
		throw new Error(`${request.errorPrefix}_download_redirect_invalid`);
	}
	const hosts = request.redirectHosts ?? RELEASE_ASSET_HOSTS;
	if (target.protocol !== "https:" || !hosts.includes(target.hostname)) throw new Error(`${request.errorPrefix}_download_redirect_rejected`);
	return fetch(target, {
		redirect: "error",
		signal: request.signal
	});
}
/** Attempts per install. A 55 MB transfer through a TUN proxy can reset mid-stream: the first
* real run in the development environment failed after 1.5 MB and succeeded on the next attempt,
* which is exactly the confusing "nothing happened" the user saw. */
const DOWNLOAD_ATTEMPTS = 2;
const RETRY_DELAY_MS = 750;
/** Whether a failure is a transport problem worth a second attempt rather than a verdict. */
function isRetryable(error) {
	if (error instanceof TypeError) return true;
	if (error instanceof Error && /_download_http_5\d\d$/u.test(error.message)) return true;
	return false;
}
function delay(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
async function attemptDownload(request) {
	const first = await fetch(request.url, {
		redirect: "manual",
		signal: request.signal
	});
	const response = first.status >= 300 && first.status < 400 ? await followValidatedRedirect(first, request) : first;
	if (!response.ok) throw new Error(`${request.errorPrefix}_download_http_${String(response.status)}`);
	const contentLength = response.headers.get("content-length");
	if (contentLength !== null && (!/^\d+$/u.test(contentLength) || Number(contentLength) !== request.expectedBytes)) throw new Error(`${request.errorPrefix}_download_size_mismatch`);
	if (response.body === null) throw new Error(`${request.errorPrefix}_download_size_mismatch`);
	const bytes = new Uint8Array(request.expectedBytes);
	const reader = response.body.getReader();
	let received = 0;
	while (true) {
		const chunk = await reader.read();
		if (chunk.done) break;
		if (chunk.value.byteLength > bytes.byteLength - received) {
			await reader.cancel();
			throw new Error(`${request.errorPrefix}_download_size_mismatch`);
		}
		bytes.set(chunk.value, received);
		received += chunk.value.byteLength;
	}
	if (received !== request.expectedBytes) throw new Error(`${request.errorPrefix}_download_size_mismatch`);
	return bytes;
}
/**
* Download a pinned artifact, following at most one validated redirect, and check its exact length.
* A transport failure is retried once; a length or redirect verdict is not. The caller still
* verifies the SHA-256 before publishing anything.
* @param request - the pinned URL, its exact byte length and the caller's error prefix.
* @returns the artifact bytes.
*/
async function downloadPinnedArtifact(request) {
	let lastError;
	for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) try {
		return await attemptDownload(request);
	} catch (error) {
		lastError = error;
		if (attempt === DOWNLOAD_ATTEMPTS || !isRetryable(error)) throw error;
		await delay(RETRY_DELAY_MS);
	}
	throw lastError;
}
//#endregion
//#region src/cloudflared-component.ts
/** Upper bound for `tar -t` output; a pinned release listing is a few lines. */
const MAX_ARCHIVE_LIST_BYTES = 1048576;
const MAX_ARCHIVE_ENTRIES = 256;
const DOWNLOAD_TIMEOUT_MS = 3e5;
const CLOUDFLARED_VERSION = "2026.9.1";
/** Pinned official cloudflared release metadata for supported desktop targets. */
const CLOUDFLARED_COMPONENT_RELEASES = Object.freeze(Object.fromEntries([
	{
		version: CLOUDFLARED_VERSION,
		platform: "win32",
		arch: "x64",
		downloadUrl: `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-windows-amd64.exe`,
		downloadBytes: 54976432,
		downloadSha256: "2837888cc0f5d58f15b6dc478376de90b4d3ba5241c7947455d1e0a0df429712",
		executableName: "cloudflared.exe",
		executableBytes: 54976432,
		executableSha256: "2837888cc0f5d58f15b6dc478376de90b4d3ba5241c7947455d1e0a0df429712"
	},
	{
		version: CLOUDFLARED_VERSION,
		platform: "linux",
		arch: "x64",
		downloadUrl: `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-amd64`,
		downloadBytes: 39838488,
		downloadSha256: "03f1f25d1cc93b9ad6c60569d44060bc4f17ed97075760ed8cfca4b12dcd68cc",
		executableName: "cloudflared",
		executableBytes: 39838488,
		executableSha256: "03f1f25d1cc93b9ad6c60569d44060bc4f17ed97075760ed8cfca4b12dcd68cc"
	},
	{
		version: CLOUDFLARED_VERSION,
		platform: "linux",
		arch: "arm64",
		downloadUrl: `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-arm64`,
		downloadBytes: 37466252,
		downloadSha256: "3d97437c71848bd8df68041e12436b484a661d95073ea1937f01a845ce88faa3",
		executableName: "cloudflared",
		executableBytes: 37466252,
		executableSha256: "3d97437c71848bd8df68041e12436b484a661d95073ea1937f01a845ce88faa3"
	},
	{
		version: CLOUDFLARED_VERSION,
		platform: "darwin",
		arch: "x64",
		downloadUrl: `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-darwin-amd64.tgz`,
		downloadBytes: 21118723,
		downloadSha256: "ff0d3b51d5ff70eceef89d6b32145fee985018a2174596a5dbe405e2766e2ac4",
		executableName: "cloudflared",
		executableBytes: 41731488,
		executableSha256: "1ea07ae775b03236bd6be18ca1848d6bdc4af2f4f3bce398823b5a36e5761b75",
		archive: {
			format: "tgz",
			member: "cloudflared"
		}
	},
	{
		version: CLOUDFLARED_VERSION,
		platform: "darwin",
		arch: "arm64",
		downloadUrl: `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-darwin-arm64.tgz`,
		downloadBytes: 19217478,
		downloadSha256: "c27ab8fd0aa489449e3d201eb02f957ef460a13b613662928b1b23394bf1bcfe",
		executableName: "cloudflared",
		executableBytes: 38893072,
		executableSha256: "9a0b19f67dc7a3011bc6b972c7ce06a5fcea8784ac6bd599ffa382ea4aeb5a6e",
		archive: {
			format: "tgz",
			member: "cloudflared"
		}
	}
].map((release) => [`${release.platform}-${release.arch}`, Object.freeze(release)])));
/**
* Canonical release metadata. New code should select from
* {@link CLOUDFLARED_COMPONENT_RELEASES} by platform and architecture; this
* alias preserves the original Windows x64 entry for existing callers.
*/
const CLOUDFLARED_COMPONENT_RELEASE = CLOUDFLARED_COMPONENT_RELEASES["win32-x64"];
const DOWNLOAD_PAGE$1 = "https://github.com/cloudflare/cloudflared/releases";
const TERMS_URL$1 = "https://www.cloudflare.com/website-terms/";
function inside$1(parent, child) {
	const candidate = relative(parent, child);
	return candidate !== "" && !candidate.startsWith("..") && !isAbsolute(candidate);
}
async function sha256$1(file) {
	return createHash("sha256").update(await readFile(file)).digest("hex");
}
async function regularFile$1(file, expectedBytes) {
	try {
		const stat = await lstat(file);
		return stat.isFile() && !stat.isSymbolicLink() && (expectedBytes === void 0 || stat.size === expectedBytes);
	} catch (error) {
		if (error.code === "ENOENT") return false;
		throw error;
	}
}
async function runCapture(file, args) {
	return new Promise((resolveRun, reject) => {
		execFile(file, [...args], {
			windowsHide: true,
			timeout: 12e4,
			maxBuffer: MAX_ARCHIVE_LIST_BYTES,
			encoding: "utf8"
		}, (error, stdout) => {
			if (error === null) resolveRun(stdout);
			else reject(error);
		});
	});
}
/** Reject absolute, traversing, or Windows-shaped archive members. */
function validatedArchiveEntry(rawEntry) {
	if (rawEntry.length === 0 || rawEntry.includes("\\") || rawEntry.includes("\0") || rawEntry.startsWith("/") || /^[a-zA-Z]:/u.test(rawEntry)) throw new Error("cloudflared_archive_path_invalid");
	const segments = rawEntry.replace(/\/$/u, "").split("/");
	if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) throw new Error("cloudflared_archive_path_invalid");
	return segments;
}
/** Select exactly one archive member named `member`, wherever it sits in the tree. */
function selectCloudflaredArchiveEntry(entries, member) {
	if (entries.length === 0 || entries.length > MAX_ARCHIVE_ENTRIES) throw new Error("cloudflared_archive_entries_invalid");
	let selected;
	for (const entry of entries) if (validatedArchiveEntry(entry).at(-1) === member) {
		if (selected !== void 0) throw new Error("cloudflared_archive_executable_ambiguous");
		selected = entry.replace(/\/$/u, "");
	}
	if (selected === void 0) throw new Error("cloudflared_archive_executable_missing");
	return selected;
}
/**
* Unpack the pinned member out of a `.tgz` using the system `tar`, which ships
* with Windows 10+, macOS, and every supported Linux base.
*/
async function defaultExtractArtifact$1(archive, destination, member) {
	const tar = process.platform === "win32" ? "tar.exe" : "tar";
	const selected = selectCloudflaredArchiveEntry((await runCapture(tar, ["-tzf", archive])).split(/\r?\n/u).filter((entry) => entry.length > 0), member);
	const unpacked = join(destination, "archive");
	await mkdir(unpacked, {
		recursive: true,
		mode: 448
	});
	await runCapture(tar, [
		"-xzf",
		archive,
		"-C",
		unpacked,
		selected
	]);
	const extracted = join(unpacked, ...validatedArchiveEntry(selected));
	if (!await regularFile$1(extracted)) throw new Error("cloudflared_archive_executable_invalid");
	await copyFile(extracted, join(destination, member));
}
async function defaultFetchArtifact$1(url, signal, expectedBytes) {
	return downloadPinnedArtifact({
		url,
		expectedBytes,
		errorPrefix: "cloudflared",
		signal
	});
}
/** Select the pinned artifact for one host, or undefined where unsupported. */
function lookupRelease(platform, arch) {
	return CLOUDFLARED_COMPONENT_RELEASES[`${platform}-${arch}`];
}
/** Owns the optional cloudflared binary inside DSH Mobile state. */
var CloudflaredComponentManager = class {
	executable;
	componentRoot;
	componentStorage;
	stateRoot;
	logRoot;
	stagingRoot;
	stateDirectory;
	platform;
	arch;
	release;
	fetchArtifact;
	extractArtifact;
	installed = false;
	errorCode;
	queue = Promise.resolve();
	constructor(options) {
		if (!isAbsolute(options.stateDirectory)) throw new Error("cloudflared state directory must be absolute");
		const stateDirectory = resolve(options.stateDirectory);
		this.stateDirectory = stateDirectory;
		this.platform = options.platform ?? process.platform;
		this.arch = options.arch ?? process.arch;
		this.release = lookupRelease(this.platform, this.arch);
		this.componentRoot = join(stateDirectory, "components", "cloudflared");
		this.componentStorage = join(this.componentRoot, this.release?.version ?? CLOUDFLARED_VERSION);
		this.executable = join(this.componentStorage, this.release?.executableName ?? "cloudflared");
		this.stateRoot = join(stateDirectory, "state", "cloudflared");
		this.logRoot = join(stateDirectory, "logs", "cloudflared");
		this.stagingRoot = join(stateDirectory, "staging", "cloudflared");
		for (const child of [
			this.componentRoot,
			this.componentStorage,
			this.stateRoot,
			this.logRoot,
			this.stagingRoot
		]) if (!inside$1(stateDirectory, child)) throw new Error("cloudflared component path escaped its state directory");
		const release = this.release;
		this.fetchArtifact = options.fetchArtifact ?? ((url, signal) => defaultFetchArtifact$1(url, signal, release?.downloadBytes ?? 0));
		this.extractArtifact = options.extractArtifact ?? defaultExtractArtifact$1;
	}
	/** Inspect the managed binary without using any global cloudflared state. */
	async initialize() {
		const release = this.release;
		this.installed = false;
		this.errorCode = void 0;
		try {
			await assertManagedParents(this.stateDirectory, this.executable, "cloudflared");
			this.installed = release !== void 0 && await regularFile$1(this.executable, release.executableBytes);
			if (this.installed && release !== void 0 && await sha256$1(this.executable) !== release.executableSha256) {
				this.installed = false;
				this.errorCode = "cloudflared_component_invalid";
			}
		} catch (_error) {
			this.installed = false;
			this.errorCode = "cloudflared_component_invalid";
		}
	}
	/** Return a safe status that never includes machine-specific account data. */
	status() {
		const release = this.release ?? CLOUDFLARED_COMPONENT_RELEASE;
		return Object.freeze({
			supported: this.release !== void 0,
			installed: this.installed,
			version: release.version,
			downloadBytes: release.downloadBytes,
			installedBytes: release.executableBytes,
			sourceUrl: release.downloadUrl,
			downloadPage: DOWNLOAD_PAGE$1,
			termsUrl: TERMS_URL$1,
			storagePath: this.componentRoot,
			...this.errorCode === void 0 ? {} : { errorCode: this.errorCode }
		});
	}
	/** Download, verify, and install the pinned cloudflared executable after explicit confirmation. */
	install() {
		return this.enqueue(async () => {
			const release = this.release;
			if (release === void 0) throw new Error("cloudflared_component_unsupported");
			await assertManagedParents(this.stateDirectory, this.executable, "cloudflared");
			await ensureManagedDirectory(this.stateDirectory, this.stagingRoot, "cloudflared");
			const staging = await mkdtemp(join(this.stagingRoot, "install-"));
			try {
				const controller = new AbortController();
				const timeout = setTimeout(() => {
					controller.abort();
				}, DOWNLOAD_TIMEOUT_MS);
				timeout.unref();
				let bytes;
				try {
					bytes = await this.fetchArtifact(release.downloadUrl, controller.signal);
				} finally {
					clearTimeout(timeout);
				}
				if (bytes.byteLength !== release.downloadBytes) throw new Error("cloudflared_download_size_mismatch");
				if (createHash("sha256").update(bytes).digest("hex") !== release.downloadSha256) throw new Error("cloudflared_download_hash_mismatch");
				const staged = join(staging, release.executableName);
				if (release.archive === void 0) await writeFile(staged, bytes, {
					flag: "wx",
					mode: 384
				});
				else {
					const downloaded = join(staging, `${release.executableName}.download`);
					await writeFile(downloaded, bytes, {
						flag: "wx",
						mode: 384
					});
					try {
						await this.extractArtifact(downloaded, staging, release.archive.member);
					} finally {
						await rm(downloaded, { force: true });
					}
				}
				await chmod(staged, 448);
				if (!await regularFile$1(staged, release.executableBytes) || await sha256$1(staged) !== release.executableSha256) throw new Error("cloudflared_executable_hash_mismatch");
				const candidate = join(this.componentRoot, `.install-${randomBytes(12).toString("hex")}`);
				await ensureManagedDirectory(this.stateDirectory, candidate, "cloudflared");
				try {
					await copyFile(staged, join(candidate, release.executableName));
					await chmod(join(candidate, release.executableName), 448);
					await replaceManagedDirectory(this.stateDirectory, this.componentStorage, candidate, "cloudflared");
				} catch (error) {
					try {
						await removeManagedTree(this.stateDirectory, candidate, "cloudflared");
					} catch (_cleanupError) {
						process.emitWarning("cloudflared candidate cleanup failed", { code: "DSH_MOBILE_COMPONENT_CLEANUP_FAILED" });
					}
					throw error;
				}
				this.installed = true;
				this.errorCode = void 0;
			} catch (error) {
				try {
					await assertManagedParents(this.stateDirectory, this.executable, "cloudflared");
					this.installed = await regularFile$1(this.executable, release.executableBytes) && await sha256$1(this.executable) === release.executableSha256;
				} catch (_inspectionError) {
					this.installed = false;
				}
				throw error;
			} finally {
				await removeManagedTree(this.stateDirectory, staging, "cloudflared");
			}
		});
	}
	/** Remove every cloudflared file owned by DSH Mobile without touching global state. */
	purge() {
		return this.enqueue(async () => {
			await removeManagedPaths(this.stateDirectory, [
				this.componentRoot,
				this.stateRoot,
				this.logRoot,
				this.stagingRoot
			], "cloudflared");
			this.installed = false;
			this.errorCode = void 0;
		});
	}
	enqueue(operation) {
		const task = this.queue.then(operation, operation);
		this.queue = task.then(() => void 0, () => void 0);
		return task.then(() => this.status());
	}
};
//#endregion
//#region src/cloudflared.ts
const MAX_LOG_BUFFER_BYTES$1 = 65536;
/**
* A quick tunnel has to be allocated and registered with the Cloudflare edge
* before the public hostname appears. That is slower than a cpolar control
* handshake but still bounded; 60 s keeps a genuinely stalled client from
* looking healthy for longer than a user will wait.
*/
const START_TIMEOUT_MS$1 = 6e4;
/**
* How many startup-timeout rounds a named tunnel may wait through while its
* connector process is still alive. A rebooted PC often autostarts DSH before
* Wi-Fi / VPN / DNS is usable; cloudflared retries the edge on its own, so
* killing it after a single 60 s window turns a slow boot into a manual
* reconnect loop. An exited connector (bad token, bad config) still fails fast
* on the first round.
*/
const NAMED_STARTUP_ROUNDS = 5;
const CLOUDFLARED_HOST_SUFFIX = ".trycloudflare.com";
/**
* Subdomains Cloudflare reserves for its own control plane.
*
* The quick-tunnel banner prints `https://api.trycloudflare.com` (the registration API) before it
* prints the tunnel's own hostname, and that address satisfies a bare suffix check. Adopting it
* would put the API host in the pairing QR code, where the phone gets `{"code":10005","message":
* "Method Not Allowed"}` instead of DSH. A quick tunnel is always one random label under the
* suffix, so the reserved single labels are refused outright.
*/
const RESERVED_CLOUDFLARED_LABELS = Object.freeze([
	"api",
	"www",
	"update",
	"login"
]);
function publicStatus$2(status) {
	return Object.freeze({
		enabled: status.enabled,
		state: status.state,
		...status.origin === void 0 ? {} : { origin: status.origin },
		...status.errorCode === void 0 ? {} : { errorCode: status.errorCode }
	});
}
/**
* Whether a hostname is a quick-tunnel host: exactly one random label under the provider suffix,
* never one of the reserved control-plane labels.
*/
function isCloudflaredHost(hostname) {
	const lower = hostname.toLowerCase();
	if (!lower.endsWith(CLOUDFLARED_HOST_SUFFIX)) return false;
	const label = lower.slice(0, -18);
	return label !== "" && !label.includes(".") && !RESERVED_CLOUDFLARED_LABELS.includes(label);
}
/**
* Extract a validated public HTTPS origin from one cloudflared output line.
*
* Quick tunnels print the public hostname inside a decorated banner, so the
* candidate is taken from the line and then re-parsed as a URL: a lookalike such
* as `https://x.trycloudflare.com.evil.test` fails the hostname check instead of
* being truncated into an accepted origin.
*/
function parseCloudflaredOrigin(line) {
	if (!line.toLowerCase().includes("trycloudflare.com")) return void 0;
	const match = /https?:\/\/[^\s"'|<>]+/u.exec(line);
	if (match === null) return void 0;
	const candidate = match[0].replace(/[),.;:]+$/u, "");
	let url;
	try {
		url = new URL(candidate);
	} catch {
		throw new Error("invalid_cloudflared_origin");
	}
	if (url.protocol !== "https:" || url.port !== "" || !isCloudflaredHost(url.hostname) || url.pathname !== "/" || url.search !== "" || url.hash !== "" || url.username !== "" || url.password !== "") throw new Error("invalid_cloudflared_origin");
	return url.origin;
}
/**
* Whether one cloudflared log line reports an established edge connection.
*
* A named tunnel prints no banner, so registration is the only signal that the
* connector reached Cloudflare and the public hostname can serve traffic. Both
* the current and the older wording are accepted; anything else is ignored so a
* chatty log line cannot be mistaken for readiness.
*/
function isCloudflaredRegistration(line) {
	return /registered tunnel connection/iu.test(line) || /connection\s+[0-9a-f][0-9a-f-]{7,}\s+registered/iu.test(line);
}
async function reserveLoopbackPort$1(requestedPort) {
	const server = createServer((socket) => {
		socket.destroy();
	});
	await new Promise((resolveListen, reject) => {
		server.once("error", reject);
		server.listen(requestedPort ?? 0, "127.0.0.1", () => {
			server.off("error", reject);
			resolveListen();
		});
	});
	const address = server.address();
	if (address === null || typeof address === "string") {
		server.close();
		throw new Error("cloudflared_port_reservation_failed");
	}
	let released = false;
	return {
		port: address.port,
		release: async () => {
			if (released) return;
			released = true;
			await new Promise((resolveClose) => {
				server.close(() => resolveClose());
			});
		}
	};
}
function spawnCloudflaredProcess(executable, args, environment) {
	return spawn(executable, [...args], {
		env: environment,
		shell: false,
		stdio: [
			"pipe",
			"pipe",
			"pipe"
		],
		windowsHide: true
	});
}
function withoutProxyEnvironment$1(environment) {
	const blocked = /* @__PURE__ */ new Set([
		"HTTP_PROXY",
		"HTTPS_PROXY",
		"ALL_PROXY",
		"NO_PROXY"
	]);
	return Object.fromEntries(Object.entries(environment).filter(([name]) => !blocked.has(name.toUpperCase())));
}
/**
* Owns an installed cloudflared client and a provider-specific DSH remote gateway.
*
* Quick tunnels allocate a random hostname and a random forward port on every
* start. Named tunnels instead read an account token and a stable public
* hostname from the tunnel store, forward to the configured loopback port, and
* learn readiness from the connector's registration line rather than a banner.
*/
var CloudflaredController = class {
	options;
	enabled = false;
	initialized = false;
	disposed = false;
	child;
	gatewayValue;
	reservation;
	generation = 0;
	buffer = "";
	mode = "quick";
	namedOrigin;
	latest = publicStatus$2({
		enabled: false,
		state: "off"
	});
	queue = Promise.resolve();
	startupTimer;
	startupRounds = 0;
	constructor(options) {
		this.options = options;
		if (!isAbsolute(options.executable)) throw new Error("cloudflared executable path must be absolute");
	}
	/** Restore the remembered cloudflared switch independently from LAN and other providers. */
	async initialize() {
		const state = await this.options.store.load();
		this.enabled = state.enabled;
		this.initialized = true;
		if (this.enabled) await this.start();
		else this.publish({
			enabled: false,
			state: "off"
		});
	}
	/** Return the active cloudflared-backed DSH gateway. */
	gateway() {
		return this.gatewayValue;
	}
	/** Return state safe for the desktop control UI. */
	status() {
		return publicStatus$2(this.latest);
	}
	/** Enable or disable cloudflared without changing LAN or other provider state. */
	async setEnabled(enabled) {
		if (!this.initialized || this.disposed) throw new Error("cloudflared controller is unavailable");
		await this.enqueue(async () => {
			if (this.enabled === enabled && (enabled === false || this.child !== void 0)) return;
			if (!enabled) await this.stop();
			this.enabled = enabled;
			await this.options.store.save({
				version: 1,
				enabled
			});
			if (enabled) await this.start();
			else this.publish({
				enabled: false,
				state: "off"
			});
		});
		return this.status();
	}
	/** Restart cloudflared and allocate a fresh quick tunnel. */
	async reconnect() {
		if (!this.initialized || this.disposed) throw new Error("cloudflared controller is unavailable");
		await this.enqueue(async () => {
			if (!this.enabled) {
				this.enabled = true;
				await this.options.store.save({
					version: 1,
					enabled: true
				});
			}
			await this.stop();
			await this.start();
		});
		return this.status();
	}
	/** Disable cloudflared without deleting the installed component. */
	async reset() {
		if (!this.initialized || this.disposed) throw new Error("cloudflared controller is unavailable");
		await this.enqueue(async () => {
			await this.stop();
			this.enabled = false;
			await this.options.store.save({
				version: 1,
				enabled: false
			});
			this.publish({
				enabled: false,
				state: "off"
			});
		});
		return this.status();
	}
	/** Stop owned resources without changing the remembered switch. */
	async close() {
		if (this.disposed) return;
		this.disposed = true;
		await this.enqueue(() => this.stop());
	}
	enqueue(operation) {
		const task = this.queue.then(operation, operation);
		this.queue = task.then(() => void 0, () => void 0);
		return task;
	}
	publish(status) {
		this.latest = publicStatus$2(status);
		try {
			this.options.onStatus?.(this.status());
		} catch {}
	}
	async start() {
		const generation = ++this.generation;
		let executableEntry;
		try {
			executableEntry = await lstat(this.options.executable);
		} catch {
			this.publish({
				enabled: true,
				state: "unavailable",
				errorCode: "cloudflared_component_missing"
			});
			return;
		}
		if (!executableEntry.isFile() || executableEntry.isSymbolicLink()) {
			this.publish({
				enabled: true,
				state: "unavailable",
				errorCode: "cloudflared_component_invalid"
			});
			return;
		}
		const settings = this.options.tunnel.settings();
		const named = settings.mode === "named" ? settings : void 0;
		this.mode = settings.mode;
		this.namedOrigin = named === void 0 ? void 0 : `https://${named.hostname}`;
		let reservation;
		try {
			reservation = await reserveLoopbackPort$1(named?.port);
		} catch (error) {
			const conflict = error?.code === "EADDRINUSE";
			this.publish({
				enabled: true,
				state: "error",
				errorCode: conflict ? named === void 0 ? "cloudflared_port_unavailable" : "cloudflared_tunnel_port_unavailable" : "cloudflared_port_reservation_failed"
			});
			return;
		}
		this.reservation = reservation;
		this.buffer = "";
		this.startupRounds = 0;
		this.publish({
			enabled: true,
			state: "starting"
		});
		if (named !== void 0) {
			const origin = this.namedOrigin;
			this.publish({
				enabled: true,
				state: "connecting",
				origin
			});
			await reservation.release();
			if (this.reservation === reservation) this.reservation = void 0;
			let gateway;
			try {
				gateway = await this.options.createGateway(origin, reservation.port);
			} catch (error) {
				const conflict = error?.code === "EADDRINUSE";
				this.publish({
					enabled: true,
					state: "error",
					errorCode: conflict ? "cloudflared_tunnel_port_unavailable" : "gateway_start_failed"
				});
				return;
			}
			if (generation !== this.generation || !this.enabled || this.disposed) {
				await gateway.close();
				return;
			}
			this.gatewayValue = gateway;
		}
		const args = named === void 0 ? [
			"tunnel",
			"--url",
			`http://127.0.0.1:${String(reservation.port)}`,
			"--no-autoupdate"
		] : [
			"tunnel",
			"--no-autoupdate",
			"run"
		];
		const environment = withoutProxyEnvironment$1(process.env);
		if (named !== void 0) environment.TUNNEL_TOKEN = named.token;
		const child = (this.options.spawnProcess ?? spawnCloudflaredProcess)(this.options.executable, args, environment);
		this.child = child;
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => {
			this.consume(generation, String(chunk));
		});
		child.stderr.on("data", (chunk) => {
			this.consume(generation, String(chunk));
		});
		child.once("error", () => {
			this.enqueue(() => this.failGeneration(generation, "cloudflared_launch_failed"));
		});
		child.once("close", (code) => {
			if (generation !== this.generation || this.child !== child) return;
			this.child = void 0;
			if (this.enabled) this.enqueue(() => this.failGeneration(generation, code === 0 ? "cloudflared_stopped" : "cloudflared_exited"));
		});
		this.armStartupTimer(generation);
	}
	armStartupTimer(generation) {
		if (this.startupTimer !== void 0) clearTimeout(this.startupTimer);
		this.startupTimer = setTimeout(() => {
			this.enqueue(() => this.checkStartupTimeout(generation));
		}, this.options.startupTimeoutMs ?? START_TIMEOUT_MS$1);
		this.startupTimer.unref();
	}
	/**
	* Give a live named connector more time instead of killing it: it retries the
	* edge on its own and usually registers once the rebooted network is usable.
	* A dead connector, or an exhausted budget, fails the generation as before.
	*/
	async checkStartupTimeout(generation) {
		if (generation !== this.generation || !this.enabled || this.disposed) return;
		if (this.latest.state === "ready") return;
		const childAlive = this.child !== void 0 && this.child.exitCode === null;
		const budget = this.options.maxStartupRounds ?? NAMED_STARTUP_ROUNDS;
		if (this.mode === "named" && childAlive && this.startupRounds + 1 < budget) {
			this.startupRounds += 1;
			this.armStartupTimer(generation);
			return;
		}
		await this.failGeneration(generation, "cloudflared_start_timeout");
	}
	consume(generation, chunk) {
		if (generation !== this.generation) return;
		this.buffer += chunk;
		if (Buffer.byteLength(this.buffer, "utf8") > MAX_LOG_BUFFER_BYTES$1 && !this.buffer.includes("\n")) {
			this.enqueue(() => this.failGeneration(generation, "cloudflared_invalid_output"));
			return;
		}
		while (true) {
			const newline = this.buffer.indexOf("\n");
			if (newline < 0) return;
			const line = this.buffer.slice(0, newline).replace(/\r$/u, "");
			this.buffer = this.buffer.slice(newline + 1);
			if (this.mode === "named") {
				if (isCloudflaredRegistration(line)) this.enqueue(() => this.confirmNamedReady(generation));
				continue;
			}
			let origin;
			try {
				origin = parseCloudflaredOrigin(line);
			} catch {
				this.enqueue(() => this.failGeneration(generation, "cloudflared_invalid_origin"));
				return;
			}
			if (origin !== void 0) this.enqueue(() => this.attachGateway(generation, origin));
		}
	}
	/** Mark a named tunnel ready once the connector has registered with the edge. */
	async confirmNamedReady(generation) {
		if (generation !== this.generation || !this.enabled || this.disposed) return;
		if (this.gatewayValue === void 0 || this.latest.state === "ready") return;
		if (this.startupTimer !== void 0) clearTimeout(this.startupTimer);
		this.startupTimer = void 0;
		this.publish({
			enabled: true,
			state: "ready",
			...this.namedOrigin === void 0 ? {} : { origin: this.namedOrigin }
		});
	}
	async attachGateway(generation, origin) {
		if (generation !== this.generation || !this.enabled || this.disposed) return;
		const current = this.gatewayValue;
		if (current !== void 0) {
			if (current.address().origin === origin) return;
			await this.rotateGateway(generation, origin, current);
			return;
		}
		const reservation = this.reservation;
		if (reservation === void 0) return;
		this.publish({
			enabled: true,
			state: "connecting",
			origin
		});
		await reservation.release();
		if (this.reservation === reservation) this.reservation = void 0;
		let gateway;
		try {
			gateway = await this.options.createGateway(origin, reservation.port);
		} catch {
			await this.failGeneration(generation, "gateway_start_failed");
			return;
		}
		if (generation !== this.generation || !this.enabled || this.disposed || this.child === void 0) {
			await gateway.close();
			return;
		}
		this.gatewayValue = gateway;
		if (this.startupTimer !== void 0) clearTimeout(this.startupTimer);
		this.startupTimer = void 0;
		this.publish({
			enabled: true,
			state: "ready",
			origin
		});
	}
	/** Replace the gateway authority when a quick tunnel restarts on a new hostname. */
	async rotateGateway(generation, origin, current) {
		const listenPort = current.address().port;
		if (this.gatewayValue === current) this.gatewayValue = void 0;
		this.publish({
			enabled: true,
			state: "connecting",
			origin
		});
		try {
			await current.close();
		} catch {
			await this.failGeneration(generation, "gateway_start_failed");
			return;
		}
		if (generation !== this.generation || !this.enabled || this.disposed || this.child === void 0) return;
		let replacement;
		try {
			replacement = await this.options.createGateway(origin, listenPort);
		} catch {
			await this.failGeneration(generation, "gateway_start_failed");
			return;
		}
		if (generation !== this.generation || !this.enabled || this.disposed || this.child === void 0) {
			await replacement.close();
			return;
		}
		this.gatewayValue = replacement;
		this.publish({
			enabled: true,
			state: "ready",
			origin
		});
	}
	async failGeneration(generation, code) {
		if (generation !== this.generation) return;
		await this.stopProcessAndGateway();
		if (this.enabled) this.publish({
			enabled: true,
			state: "error",
			errorCode: code
		});
	}
	async stop() {
		++this.generation;
		await this.stopProcessAndGateway();
	}
	async stopProcessAndGateway() {
		if (this.startupTimer !== void 0) clearTimeout(this.startupTimer);
		this.startupTimer = void 0;
		const reservation = this.reservation;
		this.reservation = void 0;
		const child = this.child;
		this.child = void 0;
		const gateway = this.gatewayValue;
		this.gatewayValue = void 0;
		await settleRemoteResources([
			() => reservation?.release(),
			() => child !== void 0 && child.exitCode === null ? terminateRemoteProcess(child) : void 0,
			() => gateway?.close()
		], "cloudflared resource cleanup failed");
	}
};
//#endregion
//#region src/cloudflared-tunnel.ts
const MAX_CONFIG_BYTES$1 = 8192;
const QUICK_TUNNEL_SUFFIX = ".trycloudflare.com";
/** Cloudflare's own tunnel-routing domain; it can never be a public hostname. */
const TUNNEL_ROUTING_SUFFIX = ".cfargotunnel.com";
/**
* The bare registrable names behind those suffixes. A suffix test alone accepts
* them, yet Cloudflare owns both apexes outright, so neither can ever be routed to
* a customer tunnel.
*/
const RESERVED_APEX_NAMES = Object.freeze([QUICK_TUNNEL_SUFFIX.slice(1), TUNNEL_ROUTING_SUFFIX.slice(1)]);
/** Ports below this need privileges on every supported platform. */
const MIN_PORT = 1024;
const MAX_PORT = 65535;
/**
* The LAN gateway's HTTPS port, held by the plugin for as long as DSH runs. It is
* never available to a tunnel, so a configuration naming it must be refused up
* front rather than failing later as a generic "port in use".
*/
const RESERVED_LAN_GATEWAY_PORT = 3443;
const MAX_TOKEN_LENGTH = 4096;
function hostname$1(value) {
	if (value.length > 253 || !value.includes(".")) return false;
	return value.split(".").every((label) => label.length >= 1 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label));
}
/**
* Validate the public hostname Cloudflare routes to this tunnel.
*
* The name must be a real DNS name, not an IP literal or a wildcard, and it
* cannot sit under Cloudflare's own control-plane suffixes: `trycloudflare.com`
* belongs to quick tunnels, and a `cfargotunnel.com` name is the routing target
* rather than a routable public address.
*/
function validateCloudflaredTunnelHostname(value) {
	if (typeof value !== "string" || value !== value.trim() || value.length === 0 || value.length > 253) throw new Error("cloudflared_tunnel_hostname_invalid");
	const normalized = value.toLowerCase().replace(/\.$/u, "");
	if (isIP(normalized) !== 0 || !hostname$1(normalized) || normalized.includes("*") || RESERVED_APEX_NAMES.includes(normalized) || normalized.endsWith(QUICK_TUNNEL_SUFFIX) || normalized.endsWith(TUNNEL_ROUTING_SUFFIX)) throw new Error("cloudflared_tunnel_hostname_invalid");
	return normalized;
}
/** Validate the stable loopback port Cloudflare's ingress forwards to. */
function validateCloudflaredTunnelPort(value) {
	if (!Number.isSafeInteger(value) || Number(value) < MIN_PORT || Number(value) > MAX_PORT) throw new Error("cloudflared_tunnel_port_invalid");
	if (value === RESERVED_LAN_GATEWAY_PORT) throw new Error("cloudflared_tunnel_port_reserved");
	return Number(value);
}
/**
* Validate a connector token before durable storage.
*
* A token is a base64url-encoded JSON blob that carries the account, tunnel id
* and tunnel secret; the provider passes it through the environment rather than
* the command line, and it is never returned to any client.
*/
function validateCloudflaredTunnelToken(value) {
	if (typeof value !== "string" || value !== value.trim() || value.length < 32 || value.length > MAX_TOKEN_LENGTH || !/^[A-Za-z0-9_=+/-]+$/u.test(value)) throw new Error("cloudflared_tunnel_token_invalid");
	return value;
}
/** Parse tunnel settings at the request and filesystem boundaries. */
function parseCloudflaredTunnelSettings(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("cloudflared_tunnel_settings_invalid");
	const record = value;
	const allowed = [
		"version",
		"mode",
		"token",
		"hostname",
		"port"
	];
	if (Reflect.ownKeys(record).some((key) => !allowed.includes(String(key)))) throw new Error("cloudflared_tunnel_settings_invalid");
	if (record.version !== void 0 && record.version !== 1) throw new Error("cloudflared_tunnel_settings_invalid");
	const mode = record.mode ?? "quick";
	if (mode === "quick") {
		if (record.token !== void 0 || record.hostname !== void 0 || record.port !== void 0) throw new Error("cloudflared_tunnel_settings_invalid");
		return Object.freeze({
			version: 1,
			mode: "quick"
		});
	}
	if (mode !== "named") throw new Error("cloudflared_tunnel_settings_invalid");
	return Object.freeze({
		version: 1,
		mode: "named",
		token: validateCloudflaredTunnelToken(record.token),
		hostname: validateCloudflaredTunnelHostname(record.hostname),
		port: validateCloudflaredTunnelPort(record.port)
	});
}
/**
* Merge a partial panel request with the saved named-tunnel settings so a blank
* field keeps its stored value. The token in particular is write-only, so the
* panel submits an empty string to mean "keep the existing connector token".
*/
function mergeSavedCloudflaredTunnelSettings(partial, saved) {
	const requested = partial.mode ?? saved?.mode ?? "quick";
	if (requested !== "quick" && requested !== "named") throw new Error("cloudflared_tunnel_settings_invalid");
	if (requested === "quick") return parseCloudflaredTunnelSettings({
		version: 1,
		mode: "quick"
	});
	const previous = saved?.mode === "named" ? saved : void 0;
	const token = partial.token === "" || partial.token === void 0 ? previous?.token : partial.token;
	const hostname = partial.hostname === "" || partial.hostname === void 0 ? previous?.hostname : partial.hostname;
	const port = partial.port === void 0 || partial.port === "" ? previous?.port : partial.port;
	if (token === void 0 || hostname === void 0 || port === void 0) throw new Error("cloudflared_tunnel_config_missing");
	return parseCloudflaredTunnelSettings({
		version: 1,
		mode: "named",
		token,
		hostname,
		port
	});
}
/** Owns the private cloudflared tunnel configuration for one DSH installation. */
var CloudflaredTunnelStore = class {
	ownedRoot;
	stateRoot;
	settingsFile;
	settingsValue = Object.freeze({
		version: 1,
		mode: "quick"
	});
	errorCode;
	constructor(stateDirectory, ownedRoot = stateDirectory) {
		this.ownedRoot = ownedRoot;
		if (!isAbsolute(stateDirectory)) throw new Error("cloudflared tunnel state directory must be absolute");
		this.stateRoot = resolve(stateDirectory);
		this.settingsFile = join(this.stateRoot, "tunnel.json");
	}
	/** Load private settings while rejecting links, oversized files and unknown fields. */
	async initialize() {
		this.settingsValue = Object.freeze({
			version: 1,
			mode: "quick"
		});
		this.errorCode = void 0;
		try {
			await assertManagedParents(this.ownedRoot, this.settingsFile, "cloudflared");
		} catch (_error) {
			this.errorCode = "cloudflared_tunnel_config_invalid";
			return;
		}
		let entry;
		try {
			entry = await lstat(this.settingsFile);
		} catch (error) {
			if (error.code === "ENOENT") return;
			throw error;
		}
		if (!entry.isFile() || entry.isSymbolicLink() || entry.size > MAX_CONFIG_BYTES$1) {
			this.errorCode = "cloudflared_tunnel_config_invalid";
			return;
		}
		await restrictPrivateFile(this.settingsFile);
		try {
			this.settingsValue = parseCloudflaredTunnelSettings(JSON.parse(await readFile(this.settingsFile, "utf8")));
			this.errorCode = void 0;
		} catch {
			this.settingsValue = Object.freeze({
				version: 1,
				mode: "quick"
			});
			this.errorCode = "cloudflared_tunnel_config_invalid";
		}
	}
	/** Return configuration metadata without exposing the connector token. */
	status() {
		const settings = this.settingsValue;
		return Object.freeze({
			mode: settings.mode,
			configured: settings.mode === "named",
			...settings.mode === "named" ? {
				hostname: settings.hostname,
				port: settings.port
			} : {},
			storagePath: this.stateRoot,
			...this.errorCode === void 0 ? {} : { errorCode: this.errorCode }
		});
	}
	/** Return private settings only to the provider lifecycle. */
	settings() {
		return this.settingsValue;
	}
	/** Atomically replace the tunnel configuration. */
	async configure(value) {
		const settings = parseCloudflaredTunnelSettings(value);
		if (settings.mode === "quick") await removeManagedTree(this.ownedRoot, this.settingsFile, "cloudflared");
		else try {
			await writeManagedPrivateFile(this.ownedRoot, this.settingsFile, `${JSON.stringify(settings)}\n`, "cloudflared");
		} catch (error) {
			if (error instanceof Error && error.message === "cloudflared_config_target_invalid") throw new Error("cloudflared_tunnel_target_invalid", { cause: error });
			throw error;
		}
		this.settingsValue = settings;
		this.errorCode = void 0;
		return this.status();
	}
	/** Forget a named tunnel and its connector token. */
	async purge() {
		await removeManagedTree(this.ownedRoot, this.settingsFile, "cloudflared");
		this.settingsValue = Object.freeze({
			version: 1,
			mode: "quick"
		});
		this.errorCode = void 0;
		return this.status();
	}
};
//#endregion
//#region src/task-events.ts
const TASK_EVENT_DEBOUNCE_MS = 1e3;
function turnNumber(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
function turnData(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return {
		turn: 0,
		completed: false
	};
	const record = value;
	const reason = record.reason;
	const completed = typeof reason === "string" ? reason === "completed" : reason !== null && typeof reason === "object" && reason.kind === "completed";
	return {
		turn: turnNumber(record.turn),
		completed
	};
}
/**
* Subscribe to completed root turns. Subagent turns are skipped so one task
* announces once, and rapid turn boundaries collapse into a single event.
* Returns a disposer that also drops pending debounces.
*/
function watchTaskCompletions(ctx, options) {
	const debounceMs = options.debounceMs ?? 1e3;
	const pending = /* @__PURE__ */ new Map();
	const disposeListener = ctx.on("session/event", (session, event) => {
		if (event.type !== "turn/end") return;
		const { turn, completed } = turnData(event.data);
		if (!completed) return;
		if (session.header?.parentSession !== void 0 && session.header?.parentSession !== null) return;
		const sessionId = String(session.id);
		options.log?.("task-completed-observed", {
			sessionId,
			turn
		});
		const previous = pending.get(sessionId);
		if (previous !== void 0) clearTimeout(previous);
		pending.set(sessionId, setTimeout(() => {
			pending.delete(sessionId);
			options.log?.("task-completed-announced", {
				sessionId,
				turn
			});
			options.onTaskCompleted(Object.freeze({
				sessionId,
				turn
			}));
		}, debounceMs));
	});
	return () => {
		disposeListener();
		for (const timer of pending.values()) clearTimeout(timer);
		pending.clear();
	};
}
/** One subscription feeding every live gateway; gateways register on start. */
var TaskEventHub = class {
	sinks = /* @__PURE__ */ new Set();
	/** Register a sink; returns its disposer. */
	add(sink) {
		this.sinks.add(sink);
		return () => {
			this.sinks.delete(sink);
		};
	}
	/** Fan out to a snapshot so a failing sink cannot break its siblings. */
	broadcast(event) {
		for (const sink of [...this.sinks]) try {
			sink.broadcastTaskEvent(event);
		} catch {}
	}
	/** Visible for tests. */
	get size() {
		return this.sinks.size;
	}
};
//#endregion
//#region src/diagnostics.ts
/** Recognize the active remote-web-ui boot hook without evaluating or modifying it. */
function hasCompetingRemoteChannelBoot(rows) {
	return rows.some((row) => row.kind === "script" && row.text?.includes("__DSH_REMOTE_CHANNEL_BOOT__") === true);
}
const REMOTE_ERROR_GUIDANCE = Object.freeze({
	component_missing: "重新安装完整插件包。",
	funnel_permission_required: "继续完成 Tailscale Funnel 授权。",
	funnel_https_required: "继续完成 Tailscale HTTPS 授权。",
	funnel_start_failed: "重新打开授权页并允许 Funnel。",
	funnel_start_timeout: "检查网络后点击“重新连接”。",
	tailscale_dns_missing: "确认 Tailscale 登录仍有效后重新连接。",
	sidecar_launch_failed: "重新安装完整插件包后重试。",
	sidecar_stopped: "点击“重新连接”。",
	sidecar_exited: "点击“重新连接”；仍失败时复制诊断报告。",
	control_channel_failed: "点击“重新连接”。",
	cpolar_component_missing: "先安装 cpolar 官方组件。",
	cpolar_component_invalid: "彻底移除 cpolar 组件后重新安装。",
	cpolar_config_missing: "保存 cpolar Authtoken 后重试。",
	cpolar_config_invalid: "重新保存 cpolar Authtoken。",
	cpolar_start_timeout: "检查网络后点击“重新连接”。",
	cpolar_stopped: "点击“重新连接”。",
	cpolar_exited: "点击“重新连接”；仍失败时复制诊断报告。",
	cloudflared_component_missing: "先安装 cloudflared 官方组件。",
	cloudflared_component_invalid: "彻底移除 cloudflared 组件后重新安装。",
	cloudflared_port_unavailable: "无法分配本机远程网关端口，请重试。",
	cloudflared_launch_failed: "重新安装 cloudflared 官方组件后重试。",
	cloudflared_start_timeout: "检查网络后点击“重新连接”。",
	cloudflared_stopped: "点击“重新连接”。",
	cloudflared_exited: "点击“重新连接”；仍失败时复制诊断报告。",
	cloudflared_invalid_output: "cloudflared 返回了无法识别的状态。",
	cloudflared_invalid_origin: "cloudflared 返回的公网地址未通过校验。",
	origin_config_missing: "先保存自有反向代理配置。",
	origin_config_invalid: "重新保存自有反向代理配置。",
	origin_listen_port_in_use: "更换 HTTP 后端端口；不要使用局域网的 3443、DSH 自身的 3080，或已被 cloudflared 隧道占用的 3444。",
	origin_listen_address_unavailable: "监听地址不属于当前电脑，请重新选择本机的私网 IPv4 地址。",
	origin_gateway_start_failed: "检查 HTTP 后端监听地址和端口后重新连接。",
	frp_component_missing: "先安装 FRP 官方组件。",
	frp_component_invalid: "彻底清理 FRP 组件后重新安装。",
	frp_config_missing: "先保存自建 FRP 连接配置。",
	frp_config_verify_failed: "检查服务器地址、端口、Token 和公开域名。",
	frp_vhost_publicly_reachable: "将 frps 的 HTTP vhost 监听限制到 127.0.0.1。",
	frp_vhost_probe_failed: "确认 VPS 地址可解析后重新连接。",
	frp_launch_failed: "重新安装 FRP 官方组件后重试。",
	frp_start_timeout: "确认 frps、Caddy 和域名解析正常后重新连接。",
	frp_proxy_name_in_use: "该 frps 上已有同名代理：在另一台 DSH 电脑上关闭自建 FRP，或在 frps 上清掉该代理后重新连接。",
	frp_remote_port_in_use: "公网入口端口被其他代理占用：改用其他入口端口后重新连接。",
	frp_proxy_start_failed: "查看 frps 日志与 allowPorts，确认它能接受该代理名和入口端口。",
	frp_discovery_mismatch: "公开域名连接到了另一台电脑，请核对 Caddy 与 frps 配置。",
	frp_discovery_invalid: "公开域名返回了非 DSH Mobile 响应。",
	frp_stopped: "点击“重新连接”。",
	frp_exited: "检查 VPS 配置后重新连接；仍失败时复制诊断报告。",
	gateway_start_failed: "确认 DSH 正在运行后重新连接。"
});
function check(id, status, reason, label, detail, action, facts) {
	return Object.freeze({
		id,
		status,
		reason,
		...facts === void 0 ? {} : { facts: Object.freeze(facts) },
		label,
		detail,
		...action === void 0 ? {} : { action }
	});
}
function maskLanOrigin(origin) {
	if (origin === void 0) return "未分配";
	try {
		const url = new URL(origin);
		const octets = url.hostname.split(".");
		const host = octets.length === 4 ? `${octets[0]}.${octets[1]}.${octets[2]}.x` : "局域网地址";
		return `${url.protocol}//${host}${url.port === "" ? "" : `:${url.port}`}`;
	} catch {
		return "地址格式无效";
	}
}
function remoteSuffix(origin) {
	if (origin === void 0) return "未分配";
	try {
		const hostname = new URL(origin).hostname;
		if (hostname.endsWith(".ts.net")) return "*.ts.net";
		if (hostname.endsWith(".trycloudflare.com")) return "*.trycloudflare.com";
		for (const suffix of [
			".cpolar.cn",
			".cpolar.io",
			".cpolar.top",
			".cpolar.com"
		]) if (hostname.endsWith(suffix)) return `*${suffix}`;
		return "公共 HTTPS 地址";
	} catch {
		return "地址格式无效";
	}
}
function defaultFirewallProbe(platform = process.platform) {
	return async (port) => {
		if (platform !== "win32") return { state: "not-applicable" };
		if (port === void 0) return { state: "unknown" };
		const script = [
			"$specs = @(@{ Name = 'DSH Mobile HTTPS'; Protocol = 'TCP' }, @{ Name = 'DSH Mobile Discovery'; Protocol = 'UDP' })",
			"$ready = $true",
			"$specs | ForEach-Object {",
			"  $spec = $_",
			"  $rule = Get-NetFirewallRule -DisplayName $spec.Name -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' -and $_.Action -eq 'Allow' } | Select-Object -First 1",
			"  if ($null -eq $rule) { $ready = $false; return }",
			"  $filters = @($rule | Get-NetFirewallPortFilter -ErrorAction SilentlyContinue)",
			`  $matching = @($filters | Where-Object { $_.Protocol -eq $spec.Protocol -and ($_.LocalPort -eq 'Any' -or $_.LocalPort -eq '${String(port)}') })`,
			"  if ($matching.Count -eq 0) { $ready = $false }",
			"}",
			"if ($ready) { 'ready' } else { 'missing' }"
		].join("; ");
		try {
			return { state: (await execFileText("powershell.exe", [
				"-NoProfile",
				"-NonInteractive",
				"-Command",
				script
			], {
				encoding: "utf8",
				timeout: 3e3,
				windowsHide: true
			})).stdout.trim() === "ready" ? "ready" : "missing" };
		} catch {
			return { state: "unknown" };
		}
	};
}
/** Reserve one six-second window per egress so the desktop's 15-second request can finish. */
function remoteDiagnosticTimeoutMs(_origin) {
	return 6e3;
}
const TUNNEL_HEADER_LIMIT_BYTES = 65536;
function proxyExcludedByNoProxy(target, raw) {
	const text = raw.trim().toLowerCase();
	if (text === "") return false;
	const hostname = target.hostname.toLowerCase();
	const host = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
	const targetPort = target.port === "" ? target.protocol === "https:" ? 443 : 80 : Number(target.port);
	for (const entry of text.split(/[\s,]+/)) {
		let value = entry;
		if (value === "") continue;
		if (value === "*") return true;
		if (value.includes("/")) continue;
		let port;
		if (value.startsWith("[")) {
			const bracket = value.indexOf("]");
			if (bracket < 0) continue;
			const tail = value.slice(bracket + 1);
			if (tail !== "") {
				if (!/^:\d+$/u.test(tail)) continue;
				port = Number(tail.slice(1));
			}
			value = value.slice(1, bracket);
		} else if ((value.match(/:/gu) ?? []).length === 1) {
			const separator = value.lastIndexOf(":");
			const suffix = value.slice(separator + 1);
			if (!/^\d+$/u.test(suffix)) continue;
			port = Number(suffix);
			value = value.slice(0, separator);
		}
		if (port !== void 0 && port !== targetPort) continue;
		if (value.startsWith("*.")) value = value.slice(2);
		else if (value.startsWith(".")) value = value.slice(1);
		if (value === "") continue;
		if (host === value || host.endsWith(`.${value}`)) return true;
	}
	return false;
}
/**
* Resolve the relay egress configured in the environment for `origin`.
*
* Honors `HTTPS_PROXY` (then `ALL_PROXY`, then the generic `HTTP_PROXY`) for an
* HTTPS target, and `http_proxy`/`HTTP_PROXY`/`ALL_PROXY` for a plain one, unless
* `NO_PROXY`/`no_proxy` covers the host. Only a plain `http://<host>:<port>`
* relay is usable: SOCKS or a TLS-to-proxy configuration would need a different
* tunnel, so absent that the probe keeps its direct semantics.
*/
function configuredProxyFor(origin, env = process.env) {
	let target;
	try {
		target = new URL(origin);
	} catch {
		return;
	}
	if (proxyExcludedByNoProxy(target, env.NO_PROXY ?? env.no_proxy ?? "")) return void 0;
	const candidates = target.protocol === "https:" ? [
		env.https_proxy ?? env.HTTPS_PROXY,
		env.all_proxy ?? env.ALL_PROXY,
		env.http_proxy ?? env.HTTP_PROXY
	] : [env.http_proxy ?? env.HTTP_PROXY, env.all_proxy ?? env.ALL_PROXY];
	for (const candidate of candidates) {
		if (typeof candidate !== "string" || candidate.trim() === "") continue;
		try {
			const proxy = new URL(candidate.trim());
			if (proxy.protocol !== "http:" || proxy.hostname === "") continue;
			return proxy;
		} catch {
			continue;
		}
	}
}
/** One reachability probe through an HTTP relay: CONNECT, TLS, then a status line. */
async function relayProbeThroughProxy(target, proxy, budgetMs = remoteDiagnosticTimeoutMs(target.origin)) {
	const started = performance.now();
	return new Promise((resolve, reject) => {
		let settled = false;
		let hopRequest;
		let rawSocket;
		let secureSocket;
		let timer;
		const finish = (outcome) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			secureSocket?.destroy();
			rawSocket?.end();
			rawSocket?.destroy();
			hopRequest?.destroy();
			if (outcome.error !== void 0) reject(outcome.error);
			else resolve(outcome.value ?? {
				status: 0,
				latencyMs: 0
			});
		};
		timer = setTimeout(() => {
			finish({ error: /* @__PURE__ */ new Error("proxy_tunnel_timeout") });
		}, Math.max(1, budgetMs));
		timer.unref();
		const hopPort = target.port === "" ? target.protocol === "https:" ? 443 : 80 : Number(target.port);
		const hopPath = `${target.hostname}:${hopPort}`;
		const headers = {
			host: hopPath,
			"proxy-connection": "keep-alive"
		};
		if (proxy.username !== "") headers["proxy-authorization"] = `Basic ${Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`, "utf8").toString("base64")}`;
		hopRequest = request({
			host: proxy.hostname,
			port: proxy.port === "" ? 80 : Number(proxy.port),
			method: "CONNECT",
			path: hopPath,
			headers,
			agent: false
		});
		hopRequest.once("connect", (response, socket) => {
			if (settled) {
				socket.destroy();
				return;
			}
			rawSocket = socket;
			if (response.statusCode !== 200) {
				finish({ error: /* @__PURE__ */ new Error(`proxy_tunnel_rejected_${response.statusCode ?? "unknown"}`) });
				return;
			}
			const secure = connect$1({
				socket,
				servername: target.hostname,
				rejectUnauthorized: true
			});
			secureSocket = secure;
			secure.once("secureConnect", () => {
				if (settled) return;
				secure.write([
					`GET ${target.pathname}${target.search} HTTP/1.1`,
					`Host: ${target.host}`,
					"User-Agent: dsh-mobile-diagnostics",
					"Accept-Encoding: identity",
					"Connection: close",
					"",
					""
				].join("\r\n"));
			});
			let buffered = Buffer.alloc(0);
			secure.on("data", (chunk) => {
				buffered = Buffer.concat([buffered, chunk]);
				if (buffered.byteLength > TUNNEL_HEADER_LIMIT_BYTES) {
					finish({ error: /* @__PURE__ */ new Error("proxy_tunnel_oversized_response") });
					return;
				}
				const end = buffered.indexOf("\r\n\r\n");
				if (end < 0) return;
				const statusLine = /^HTTP\/\d(?:\.\d)?\s+(\d{3})/u.exec(buffered.subarray(0, end).toString("latin1"))?.[1];
				const status = Number.parseInt(statusLine ?? "", 10);
				if (!Number.isSafeInteger(status) || status < 100) {
					finish({ error: /* @__PURE__ */ new Error("proxy_tunnel_invalid_response") });
					return;
				}
				finish({ value: {
					status,
					latencyMs: Math.max(0, Math.round(performance.now() - started))
				} });
			});
			secure.once("error", (error) => {
				finish({ error });
			});
			secure.once("close", () => {
				finish({ error: /* @__PURE__ */ new Error("proxy_tunnel_closed") });
			});
		});
		hopRequest.once("error", (error) => {
			finish({ error });
		});
		hopRequest.end();
	});
}
/** Bounded supplementary DNS context for a failed direct attempt. */
async function unreachableWithDnsContext(hostname, budgetMs) {
	let fakeIp = false;
	let timer;
	try {
		fakeIp = (await Promise.race([lookup(hostname, { all: true }), new Promise((_resolve, reject) => {
			timer = setTimeout(() => {
				reject(/* @__PURE__ */ new Error("dns_context_timeout"));
			}, Math.max(1, budgetMs));
			timer.unref();
		})])).some(({ address }) => {
			const [first, second] = address.split(".").map(Number);
			return first === 198 && (second === 18 || second === 19);
		});
	} catch {} finally {
		clearTimeout(timer);
	}
	return {
		state: "unreachable",
		...fakeIp ? { fakeIp: true } : {}
	};
}
async function fetchRemoteHealth(target, budgetMs) {
	const started = performance.now();
	try {
		const response = await fetch(target, {
			cache: "no-store",
			redirect: "error",
			signal: AbortSignal.timeout(Math.max(1, budgetMs - 500))
		});
		const latencyMs = Math.max(0, Math.round(performance.now() - started));
		if (response.status === 429) return {
			state: "rate-limited",
			latencyMs
		};
		return response.ok ? {
			state: "ready",
			latencyMs
		} : {
			state: "unreachable",
			latencyMs
		};
	} catch {
		return unreachableWithDnsContext(target.hostname, Math.max(1, budgetMs - (performance.now() - started)));
	}
}
/**
* Answer "is the public endpoint reachable" from the machine's own egress.
*
* A direct attempt stays authoritative first. When it fails and the environment
* configures an HTTP relay that `NO_PROXY` does not exclude, one tunnelled
* attempt runs: a self-managed Funnel origin otherwise resolves to this
* machine's tailnet address, where nothing serves the funnel port locally, so
* the direct measurement reports an outage while the relay's egress — the same
* public path a phone takes — still succeeds. When both fail, the original
* direct observation (including its Fake-IP context) stands unchanged.
*/
async function probeRemoteHealth(origin, options = {}) {
	if (origin === void 0) return { state: "not-applicable" };
	let target;
	try {
		target = new URL("/mobile-access/health", origin);
	} catch {
		return { state: "not-applicable" };
	}
	const budgetMs = remoteDiagnosticTimeoutMs(origin);
	const observation = await (options.direct ?? fetchRemoteHealth)(target, budgetMs);
	if (observation.state !== "unreachable") return observation;
	const relay = configuredProxyFor(origin, options.env ?? process.env);
	if (relay === void 0) return observation;
	const tunnel = options.tunnel ?? relayProbeThroughProxy;
	try {
		const { status, latencyMs } = await tunnel(target, relay, budgetMs);
		if (status === 429) return {
			state: "rate-limited",
			latencyMs,
			viaProxy: true
		};
		return status >= 200 && status < 300 ? {
			state: "ready",
			latencyMs,
			viaProxy: true
		} : observation;
	} catch {
		return observation;
	}
}
async function defaultRemoteProbe(origin) {
	return probeRemoteHealth(origin);
}
function reportLine(entry) {
	return `[${entry.status.toUpperCase()}] ${entry.label}: ${entry.detail}${entry.action === void 0 ? "" : ` ${entry.action}`}`;
}
/** Run bounded read-only checks and return a report safe to paste into an issue. */
async function collectConnectionDiagnostics(snapshot, probes = {}) {
	const checks = [];
	const remoteProbe = snapshot.remote.provider !== "origin" && snapshot.remote.running && snapshot.remote.state === "ready" && snapshot.remote.origin !== void 0 ? (probes.remote ?? defaultRemoteProbe)(snapshot.remote.origin) : Promise.resolve({ state: "not-applicable" });
	const [firewall, remoteObservation] = await Promise.all([(probes.firewall ?? defaultFirewallProbe())(snapshot.lan.port), remoteProbe]);
	checks.push(check("versions", "ok", "versions-current", "版本兼容", `插件 ${DSH_MOBILE_VERSION}，DSH ${snapshot.dshVersion}，Android App 最低 ${MINIMUM_ANDROID_APP_VERSION}。`));
	if (snapshot.competingRemoteChannelBoot === true) checks.push(check("remote-plugin-conflict", "warning", "competing-remote-channel", "第三方远程插件", "检测到另一套远程请求通道脚本；手机页面可能进入该插件自己的配对流程。", "在电脑端关闭 dsh-remote-web-ui 的远程访问后刷新，再使用 DSH Mobile 当前二维码配对；不要混用两种配对码。"));
	if (snapshot.lan.configured === false) checks.push(check("network", "error", "lan-setup-required", "局域网配置", "尚未完成局域网初始化。", "返回局域网页选择网卡并完成配置。"));
	else if (snapshot.lan.networkError !== void 0) checks.push(check("network", "error", "network-unavailable", "局域网网卡", "已保存的网卡当前不可用。", "重新运行 dsh-mobile setup。"));
	else if (snapshot.lan.configuredInterface !== void 0) {
		const interfaceName = snapshot.lan.interfaceName ?? snapshot.lan.configuredInterface;
		checks.push(check("network", "ok", "network-interface", "局域网网卡", `正在跟随 ${interfaceName}。`, void 0, { interfaceName }));
	} else checks.push(check("network", "info", "network-fixed", "局域网网卡", "当前使用固定网络配置。"));
	if (snapshot.lan.running && snapshot.lan.origin !== void 0) {
		const endpointSuffix = maskLanOrigin(snapshot.lan.origin);
		checks.push(check("lan", "ok", "lan-ready", "局域网网关", `已监听 ${endpointSuffix}，配对入口可用。`, void 0, { endpointSuffix }));
	} else checks.push(check("lan", "info", "lan-off", "局域网网关", "当前未开启。", "需要手机直连时开启局域网访问。"));
	if (firewall.state === "ready") checks.push(check("firewall", "ok", "firewall-ready", "Windows 防火墙", "局域网 TCP 与发现规则已启用。"));
	else if (firewall.state === "missing") checks.push(check("firewall", "warning", "firewall-missing", "Windows 防火墙", "未找到完整的局域网放行规则。", "以管理员身份重新运行 dsh-mobile setup。"));
	else if (firewall.state === "unknown") checks.push(check("firewall", "info", "firewall-unknown", "Windows 防火墙", "系统未允许插件读取防火墙状态。", "若手机找不到电脑，以管理员身份重新运行 setup。"));
	if (!snapshot.remote.running || snapshot.remote.state === "off") checks.push(check("remote", "info", "remote-off", "远程通道", "当前未启用。", void 0, { provider: snapshot.remote.provider }));
	else if (snapshot.remote.provider === "origin" && snapshot.remote.state === "ready") checks.push(check("remote", "info", "remote-origin-ready", "远程通道", "私网 HTTP 后端已就绪；未检测公网 HTTPS、证书或 WebSocket 连通性。", "在手机上经反向代理验证连接；代理须保留原始 Host（含端口）并支持 WebSocket。", { provider: "origin" }));
	else if (snapshot.remote.state === "ready" && snapshot.remote.origin !== void 0) {
		const endpointSuffix = remoteSuffix(snapshot.remote.origin);
		const facts = {
			provider: snapshot.remote.provider,
			endpointSuffix,
			...remoteObservation.latencyMs === void 0 ? {} : { latencyMs: remoteObservation.latencyMs },
			...remoteObservation.viaProxy === true ? { viaProxy: true } : {}
		};
		if (remoteObservation.state === "ready") checks.push(check("remote", remoteObservation.viaProxy === true ? "warning" : "ok", "remote-ready", "远程通道", remoteObservation.viaProxy === true ? `电脑经代理可访问 ${endpointSuffix}，但尚未验证手机能否连接。` : `${snapshot.remote.provider} 公共地址 ${endpointSuffix} 可达，往返约 ${String(remoteObservation.latencyMs ?? 0)} ms。`, remoteObservation.viaProxy === true ? "请在手机上测试远程连接。" : void 0, facts));
		else if (remoteObservation.state === "rate-limited") checks.push(check("remote", "warning", "remote-rate-limited", "远程通道", remoteObservation.viaProxy === true ? "电脑经代理访问时观察到限流，尚未验证手机能否连接。" : "公共地址可达，但本次检查观察到服务限流。", "稍后重试；旧会话会按需加载以减少流量。", facts));
		else if (snapshot.remote.provider === "tailscale" && remoteObservation.fakeIp === true) checks.push(check("remote", "error", "remote-fake-ip", "远程通道", "Tailscale 地址被当前 VPN 或 DNS 代理接管，但 TLS 链路未建立。", "切换 VPN 节点或代理模式；仍失败时改用 cpolar。", facts));
		else checks.push(check("remote", "error", "remote-unreachable", "远程通道", "提供方显示已就绪，但公共地址暂不可达。", "点击“重新连接”；仍失败时检查提供方状态。", facts));
	} else if (snapshot.remote.state === "starting" || snapshot.remote.state === "connecting" || snapshot.remote.state === "needs-login") {
		const needsLogin = snapshot.remote.state === "needs-login";
		checks.push(check("remote", "warning", needsLogin ? "remote-needs-login" : "remote-connecting", "远程通道", needsLogin ? "等待完成 Tailscale 登录。" : "仍在建立连接。", needsLogin ? "返回远程页继续登录。" : "等待片刻后重新检查。", { provider: snapshot.remote.provider }));
	} else {
		const controllerCode = snapshot.remote.errorCode ?? snapshot.remote.state;
		checks.push(check("remote", "error", "remote-controller-error", "远程通道", `连接未建立（${controllerCode}）。`, REMOTE_ERROR_GUIDANCE[controllerCode] ?? "返回远程页点击“重新连接”。", {
			provider: snapshot.remote.provider,
			controllerCode
		}));
	}
	checks.push(check("phone-network", "info", "phone-network-unknown", "手机网络", "电脑无法判断路由器是否隔离了手机。", "局域网仍失败时，确认手机与电脑在同一网络，并关闭访客网络或 AP 隔离。"));
	const overall = checks.some((entry) => entry.status === "error") ? "error" : checks.some((entry) => entry.status === "warning") ? "attention" : "ok";
	const summary = overall === "ok" ? "连接基础检查正常。" : overall === "attention" ? "发现需要留意的项目。" : "发现会影响连接的问题。";
	const report = [
		"DSH Mobile 诊断报告",
		`生成时间: ${(/* @__PURE__ */ new Date()).toISOString()}`,
		`版本: plugin=${DSH_MOBILE_VERSION}; dsh=${snapshot.dshVersion}; min-app=${MINIMUM_ANDROID_APP_VERSION}`,
		`LAN: ${snapshot.lan.running ? "on" : "off"}; endpoint=${maskLanOrigin(snapshot.lan.origin)}`,
		`Remote: provider=${snapshot.remote.provider}; state=${snapshot.remote.state}; endpoint=${remoteSuffix(snapshot.remote.origin)}`,
		...checks.map(reportLine)
	].join("\n");
	return Object.freeze({
		version: 1,
		generatedAt: Date.now(),
		overall,
		versions: Object.freeze({
			plugin: DSH_MOBILE_VERSION,
			dsh: snapshot.dshVersion,
			minimumAndroidApp: MINIMUM_ANDROID_APP_VERSION
		}),
		summary,
		checks: Object.freeze(checks),
		report
	});
}
//#endregion
//#region src/mobile-guide.ts
/** Compose the guide with the current customization state injected. */
function buildMobileGuide(state) {
	const styleLine = state.hasCustomCss ? "存在（当前生效的自定义样式）" : "不存在（使用内置默认样式）";
	const scriptLine = state.hasCustomJs ? "存在（当前生效的自定义脚本）" : "不存在（无自定义脚本）";
	const extensionLines = state.extensions.length === 0 ? "（无）" : state.extensions.map((entry) => `- ${entry.id}（${entry.name} v${entry.version}）${entry.executionMode === void 0 ? "" : ` · ${entry.executionMode}${entry.executionState === "unavailable" ? " · 当前不可用，需要显式重启扩展" : ""}`}`).join("\n");
	const failureLine = state.failedExtensionCount > 0 ? `注意：${state.failedExtensionCount} 个扩展的电脑端 host 激活失败，如改动相关扩展请先检查其 host.mjs 与 extension.json。` : "";
	return `${`## 手机端当前状态（改动前必读，避免覆盖已有定制）

- 定制目录：${state.directory}（所有改动只允许在这里进行）
- mobile.css：${styleLine}
- mobile.js：${scriptLine}
- 已安装扩展：
${extensionLines}
${failureLine}

“恢复默认”操作说明：当用户要求恢复默认 / 还原初始外观时，删除 mobile.css 与 mobile.js 两个文件（删除后手机端自动回到内置默认外观，无需创建占位文件），并按需删除 extensions/ 下的扩展目录。\n\n`}${MOBILE_CUSTOMIZATION_GUIDE_BODY}`;
}
/**
* Static body of the customization guide. Kept separate from the injected
* state snapshot so the two concerns stay easy to edit independently.
*/
const MOBILE_CUSTOMIZATION_GUIDE_BODY = `你在为用户定制 DSH Mobile 的手机端。DSH Mobile 是一个把电脑上的 DeepSeek Harness 带到手机浏览器的插件，手机端界面和能力都来自本机文件。

所有改动只允许在 $DSH_HOME/mobile-access/ 目录内进行，绝不修改 DeepSeek Harness 的源码或其他目录。$DSH_HOME 是 DeepSeek Harness 的配置目录（通常为 ~/.dsh），先确认它的实际路径再操作。

手机端的能力分两层，按用户需求选择改动目标：

1. 界面与交互 —— 只改外观和交互，不需要碰电脑的文件或程序：
   - $DSH_HOME/mobile-access/mobile.css：手机端样式
   - $DSH_HOME/mobile-access/mobile.js：手机端脚本，用 window.dshMobile.register(({ root }) => { ... }) 把内容挂载到 root，返回清理函数
   - 保存后手机端几秒内自动应用，无需重启

动手前先读已有的定制文件。若要调整 DSH 自带的输入框、侧栏或设置等现有界面，先确认当前 DSH 版本与手机页面模式（专用移动页面或 ?frontend=stock），只读核对运行页面的 DOM、属性和样式；本机有同版本前端源码时可参考相应组件，没有源码时可查看已安装的客户端产物，不必下载源码。优先使用扩展 API、插槽和稳定的 data-* 标记，不凭猜测依赖构建类名。只读查看不改变前述写入范围。

2. 电脑端能力 —— 手机需要读电脑文件、执行命令或访问硬件时，创建扩展：
   - 目录：$DSH_HOME/mobile-access/extensions/<id>/，id 用小写字母数字和连字符（如 media-remote）
   - extension.json：{"schemaVersion":1,"id":"<id>","name":"显示名","version":"0.1.0","description":"说明"}
   - host.mjs：电脑端 Node.js 代码（可信本地代码，可读写文件、执行命令）。导出默认函数 (api) => { ... }，用 api.action('名称', { input, run }) 注册动作、api.route({ method, path, handle }) 注册路由、api.effect(fn) 注册清理。input 可以直接使用 api.schema.object(...) 等 Schemastery schema，也可以传入带 parse(value) 的适配器；两种形式都会在动作执行前校验并规范化输入。
   - 执行方式见上方实际状态。默认 in-process；插件配置可按扩展选择 worker。Worker 中 api.context 只有 logger，不能调用 Cordis 服务；api.manifest、schema、action、route、effect 仍可用。不要把需要 Cordis 的扩展偷偷改成 Worker，也不要在 extension.json 中添加执行模式字段。
   - 动作与路由的执行有时间预算：默认 30 秒（输入校验也计入），可用 api.action('名称', { input, run, timeoutMs }) 或 api.route({ ..., timeoutMs }) 按操作覆盖（1–300000 的整数毫秒）。超时或调用方取消后，调用方收到 500 extension_action_timeout / extension_route_timeout（或取消原因）；这只表示调用方不再等待，底层代码可能仍在运行并已产生副作用，请在 run / handle 中响应 signal 实现协作式取消。路由的预算到 handle() 返回响应为止，不影响已返回流的存活。若某扩展存在调用方已离开（超时或取消）但仍未结束的操作，后续对该扩展的新调用会收到 503 extension_busy，直到该操作真正结束。
   - mobile.js：手机端脚本，用 window.dshMobile.define({ apiVersion:1, id:'<id>', activate(api) { ... } })，activate 返回清理函数
   - mobile.css：手机端样式（可选）
   - assets/：手机端静态资源（可选）
   - mobile.js 里用 api.host.invoke('动作名', 输入) 调 host.mjs 的 action（请求会按 application/json 发送），api.host.fetch('/路由路径') 调 route，api.host.assetUrl('相对路径') 生成与当前版本绑定的资源地址
   - DSH Web 可先用命令生成模板：dsh plugin --profile web exec dsh-mobile extension create <id> --name "<名称>"，再在模板上改；Desktop 请在上方实际定制目录创建文件，不要误改 Web profile

安全约束：
- host.mjs 拥有电脑用户的完整权限，绝不能放入不可信代码，也不要让手机端无条件执行任意命令
- in-process 的同步阻塞会卡住网关事件循环，超时不能打断；Worker 可约束 JavaScript 阻塞，但不是安全沙箱，不约束全部原生内存，也不回滚副作用。两种模式都应响应 signal，避免编写不可取消的同步循环
- Worker 终止后其他未完成调用会失败，已开始的操作不会自动重试。相同内容的停止实例需要操作者在电脑端“移动访问 → 扩展需要重启”中确认恢复；不要通过无意义改文件或自动重放原动作实现恢复
- 所有改动只限 $DSH_HOME/mobile-access/，不要动 DeepSeek Harness 源码

完成前请自检：
- 改动涉及 mobile.js 或扩展的 mobile.js / host.mjs 时，先做语法检查再保存（如 node --check <file>），确保没有语法错误
- 改动 DSH 现有界面后尽可能在实际手机页面核对效果；无法观察运行页面时，明确告诉用户尚未实测
- 创建或修改扩展后，确认 extension.json 的 schemaVersion 为 1、id 与目录名一致、且 id 只含小写字母数字和连字符
- 扩展的 host.mjs 若在完成前无法激活，先修正而不是留下损坏的扩展
- 完成后检查自己实际写入了哪些文件，向用户简要说明改了什么、手机端会有什么变化`;
//#endregion
//#region src/vps-deploy.ts
const FRP_VERSION = "0.70.1";
const SSH_TIMEOUT_MS = 3e5;
const LINUX_ARTIFACTS = Object.freeze({
	x64: Object.freeze({
		directory: `frp_${FRP_VERSION}_linux_amd64`,
		url: `https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/frp_${FRP_VERSION}_linux_amd64.tar.gz`,
		sha256: "333da23d1b9009d7c01638e9ba38cf4600f7d37d393f854e96ee1396adefa9a6"
	}),
	arm64: Object.freeze({
		directory: `frp_${FRP_VERSION}_linux_arm64`,
		url: `https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/frp_${FRP_VERSION}_linux_arm64.tar.gz`,
		sha256: "3990f396a9a490ee7f0e5f355287750ed41520064ed999eab443b5e9a78d773d"
	})
});
var VpsSshError = class extends Error {
	stdout;
	stderr;
	timedOut;
	exitCode;
	signal;
	constructor(message, stdout, stderr, options) {
		super(message, options);
		this.stdout = stdout;
		this.stderr = stderr;
		this.timedOut = options?.timedOut ?? false;
		this.exitCode = options?.exitCode;
		this.signal = options?.signal;
	}
};
function shellQuote(value) {
	return `'${value.replaceAll("'", "'\\''")}'`;
}
/**
* Reject loopback, private, and other non-routable IPv4 literals as VPS SSH
* targets. A self-hosted deployment always addresses a public server; the
* shared frpc settings stay permissive so local loopback test rigs keep working.
*/
function assertPublicSshTarget(serverAddress) {
	if (isIP(serverAddress) === 4 && !isGloballyRoutableIpv4(serverAddress)) throw new Error("vps_server_not_public");
}
/**
* Validate a VPS address for every operation that opens a network connection
* to it (scan, deploy, cleanup). IPv6 is unsupported by the SSH flow and
* loopback/private targets are never valid VPS endpoints.
*/
function validateVpsServerTarget(serverAddress) {
	const address = validateFrpServerAddress(serverAddress);
	if (isIP(address) !== 0 && address.includes(":")) throw new Error("vps_ipv6_ssh_not_supported");
	assertPublicSshTarget(address);
	return address;
}
function validSshUser(value) {
	if (typeof value !== "string" || value.length < 1 || value.length > 64 || !/^[a-z_][a-z0-9_.-]*[$]?$/iu.test(value)) throw new Error("vps_ssh_user_invalid");
	return value;
}
function validSshPort(value) {
	if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 65535) throw new Error("vps_ssh_port_invalid");
	return Number(value);
}
function validSshKeyPath(value) {
	if (value === void 0 || value === "") return void 0;
	if (typeof value !== "string" || !isAbsolute(value) || value.length > 4096 || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error("vps_ssh_key_invalid");
	return resolve(value);
}
function parseVpsDeploymentInput(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("vps_deploy_input_invalid");
	const record = value;
	if (Reflect.ownKeys(record).some((key) => ![
		"sshUser",
		"sshPort",
		"sshKeyPath",
		"hostFingerprints"
	].includes(String(key)))) throw new Error("vps_deploy_input_invalid");
	const sshKeyPath = validSshKeyPath(record.sshKeyPath);
	return Object.freeze({
		sshUser: validSshUser(record.sshUser),
		sshPort: validSshPort(record.sshPort),
		...sshKeyPath === void 0 ? {} : { sshKeyPath },
		hostFingerprints: Object.freeze(parseVpsHostFingerprints(record.hostFingerprints))
	});
}
/** Validate user-confirmed SHA256 host-key fingerprints (`SHA256:…`). */
function parseVpsHostFingerprints(value) {
	if (!Array.isArray(value) || value.length < 1 || value.length > 8) throw new Error("vps_host_key_unconfirmed");
	const fingerprints = [];
	for (const entry of value) {
		if (typeof entry !== "string" || !/^SHA256:[A-Za-z0-9+/]{40,60}={0,2}$/u.test(entry) || entry.length > 96) throw new Error("vps_host_key_unconfirmed");
		fingerprints.push(entry);
	}
	return [...new Set(fingerprints)];
}
const SUPPORTED_HOST_KEY_TYPES = /* @__PURE__ */ new Set([
	"ssh-rsa",
	"ecdsa-sha2-nistp256",
	"ecdsa-sha2-nistp384",
	"ecdsa-sha2-nistp521",
	"ssh-ed25519"
]);
/** Format a raw host public key the way OpenSSH displays it (`SHA256:…` without padding). */
function fingerprintHostPublicKey(keyType, base64Key) {
	if (!SUPPORTED_HOST_KEY_TYPES.has(keyType)) throw new Error("vps_host_key_unsupported_type");
	if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(base64Key) || base64Key.length < 24 || base64Key.length > 1024) throw new Error("vps_host_key_invalid");
	const raw = Buffer.from(base64Key, "base64");
	if (raw.length < 16 || raw.length > 768) throw new Error("vps_host_key_invalid");
	return `SHA256:${createHash("sha256").update(raw).digest("base64").replace(/=+$/u, "")}`;
}
function parseKeyscanOutput(output) {
	const keys = [];
	for (const line of output.split(/\r?\n/u)) {
		const trimmed = line.trim();
		if (trimmed === "" || trimmed.startsWith("#")) continue;
		const match = /^(?:\S+\s+)?(ssh-rsa|ecdsa-sha2-nistp\d+|ssh-ed25519)\s+([A-Za-z0-9+/]+={0,2})(\s|$)/u.exec(trimmed);
		if (match?.[1] === void 0 || match[2] === void 0) throw new Error("vps_host_key_invalid");
		keys.push({
			keyType: match[1],
			base64Key: match[2]
		});
	}
	return keys;
}
/** Base SSH options shared by long deployment sessions. Keepalives survive NAT
*  middleboxes during minute-long apt/pip phases; host identity stays pinned. */
function sshSessionOptions(knownHostsFile) {
	return [
		"-o",
		"BatchMode=yes",
		"-o",
		"ConnectTimeout=15",
		"-o",
		"ServerAliveInterval=15",
		"-o",
		"ServerAliveCountMax=8",
		"-o",
		"StrictHostKeyChecking=yes",
		`-o UserKnownHostsFile=${knownHostsFile}`
	];
}
/** Recognize usable public-key scan output without authenticating to the server. */
function tryParseKeyscanOutput(output) {
	try {
		return parseKeyscanOutput(output);
	} catch {
		return;
	}
}
async function gitBundledKeyscan() {
	if (process.platform !== "win32") return void 0;
	const programFiles = process.env["ProgramFiles"] ?? "C:\\Program Files";
	const candidate = join(programFiles, "Git", "usr", "bin", "ssh-keyscan.exe");
	try {
		if (!(await lstat(candidate)).isFile()) return void 0;
	} catch {
		return;
	}
	return candidate;
}
async function defaultRunKeyscan(input, serverAddress) {
	const keyscan = process.platform === "win32" ? "ssh-keyscan.exe" : "ssh-keyscan";
	const args = [
		"-T",
		"10",
		"-p",
		String(input.sshPort),
		"-t",
		"rsa,ecdsa,ed25519",
		serverAddress
	];
	const first = await runProcess(keyscan, args, void 0, 3e4).catch(() => void 0);
	if (first !== void 0 && tryParseKeyscanOutput(first.stdout)?.length) return first.stdout;
	const bundled = await gitBundledKeyscan();
	if (bundled !== void 0) {
		const second = await runProcess(bundled, args, void 0, 3e4).catch(() => void 0);
		if (second !== void 0 && tryParseKeyscanOutput(second.stdout)?.length) return second.stdout;
	}
	return first?.stdout ?? "";
}
/** Obtain public host keys without using a private key, agent or unverified authenticated connection. */
async function scanHostKeys(input, serverAddress, options) {
	const runKeyscan = options.runKeyscan ?? defaultRunKeyscan;
	let scanned;
	try {
		scanned = await runKeyscan({
			sshUser: input.sshUser,
			sshPort: input.sshPort
		}, serverAddress);
	} catch (error) {
		throw new Error("vps_host_key_unavailable", { cause: error });
	}
	if (parseKeyscanOutput(scanned).length === 0) throw new Error("vps_host_key_unavailable");
	return scanned;
}
/**
* Fetch the server's current host keys and return them with OpenSSH-style
* fingerprints for the user to confirm out of band (for example against the
* VPS console) before any destructive or authenticated deployment step.
*/
async function fetchVpsHostKeys(serverAddress, input, options = {}) {
	const address = validateVpsServerTarget(serverAddress);
	const keys = parseKeyscanOutput(await scanHostKeys({
		sshUser: validSshUser(input.sshUser),
		sshPort: validSshPort(input.sshPort),
		sshKeyPath: input.sshKeyPath
	}, address, options));
	if (keys.length === 0) throw new Error("vps_host_key_unavailable");
	const seen = /* @__PURE__ */ new Set();
	const hostKeys = [];
	for (const key of keys) {
		const fingerprint = fingerprintHostPublicKey(key.keyType, key.base64Key);
		if (seen.has(fingerprint)) continue;
		seen.add(fingerprint);
		hostKeys.push(Object.freeze({
			keyType: key.keyType,
			fingerprint
		}));
	}
	options.log?.("host-keys-fetched", {
		serverAddress: address,
		keyTypes: hostKeys.length
	});
	return Object.freeze(hostKeys);
}
/**
* Verify that every host key the server currently presents was confirmed by the
* user, then return a pinned known_hosts body. Fails closed on rotation,
* replacement, or unexpected extra keys.
*/
function buildPinnedKnownHosts(serverAddress, sshPort, keyscanOutput, confirmedFingerprints) {
	const address = validateFrpServerAddress(serverAddress);
	const port = validSshPort(sshPort);
	const confirmed = new Set(parseVpsHostFingerprints([...confirmedFingerprints]));
	const keys = parseKeyscanOutput(keyscanOutput);
	if (keys.length === 0) throw new Error("vps_host_key_unavailable");
	const host = port === 22 ? address : `[${address}]:${port}`;
	const lines = [];
	for (const key of keys) {
		const fingerprint = fingerprintHostPublicKey(key.keyType, key.base64Key);
		if (!confirmed.has(fingerprint)) throw new Error("vps_host_key_mismatch");
		lines.push(`${host} ${key.keyType} ${key.base64Key}`);
	}
	return `${lines.join("\n")}\n`;
}
function safeOutput(value, token) {
	return (token === "" ? value : value.replaceAll(token, "<redacted>")).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "").slice(0, 8192).trim();
}
function parseChecks(stdout, stderr, token) {
	const checks = [];
	for (const line of stdout.split(/\r?\n/u)) {
		const match = /^DSH_MOBILE_CHECK\s+([a-z0-9_-]+)\s+(ok|warning|error)\s+(.+)$/iu.exec(line);
		if (match !== null) checks.push(Object.freeze({
			id: match[1],
			status: match[2].toLowerCase(),
			detail: safeOutput(match[3], token)
		}));
	}
	if (checks.length === 0 && stderr.trim() !== "") checks.push(Object.freeze({
		id: "remote-command",
		status: "error",
		detail: safeOutput(stderr, token) || "VPS 返回了未分类错误。"
	}));
	return Object.freeze(checks);
}
/**
* One-line failure detail for transport-level failures: prefer the failed
* remote check, otherwise use the last stderr line (a `set -eu` abort has no
* check line) instead of dumping the whole transcript into the UI.
*/
function failureDetail(stdout, stderr, token) {
	const failed = parseChecks(`${stdout}\n${stderr}`, "", token).find((check) => check.status === "error");
	if (failed !== void 0) return failed.detail;
	for (const stream of [stderr, stdout]) {
		const lines = stream.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line !== "");
		const last = lines[lines.length - 1];
		if (last !== void 0) return safeOutput(last, token);
	}
	return "";
}
function deploymentScript(settings) {
	const amd64 = LINUX_ARTIFACTS.x64;
	const arm64 = LINUX_ARTIFACTS.arm64;
	const config = [
		"bindAddr = \"0.0.0.0\"",
		`bindPort = ${String(settings.serverPort)}`,
		"proxyBindAddr = \"127.0.0.1\"",
		"vhostHTTPPort = 7080",
		"auth.method = \"token\"",
		`auth.token = ${JSON.stringify(settings.token)}`,
		""
	].join("\n");
	const publicHost = new URL(settings.publicOrigin).hostname;
	const publicIp = isGloballyRoutableIpv4(publicHost);
	const caddySite = createCaddySite(publicHost);
	const caddySnippet = `${FRP_CADDY_SNIPPET_MARKER}\n${caddySite.trimEnd()}\n`;
	const ipCertificateSetup = publicIp ? `
export DEBIAN_FRONTEND=noninteractive
apt-get install -y python3-venv
if [ ! -x /opt/dsh-mobile/certbot-venv/bin/certbot ]; then
  python3 -m venv /opt/dsh-mobile/certbot-venv
  /opt/dsh-mobile/certbot-venv/bin/pip install --disable-pip-version-check 'certbot==5.8.0'
fi
systemctl stop caddy.service || true
if ! /opt/dsh-mobile/certbot-venv/bin/certbot certonly --standalone --preferred-profile shortlived --ip-address ${publicHost} --agree-tos --register-unsafely-without-email --non-interactive --keep-until-expiring; then
  systemctl start caddy.service || true
  fail "公网 IP HTTPS 证书申请失败；请确认 80/tcp 可从公网访问。"
fi
install -d -m 0750 -o caddy -g caddy /var/lib/caddy/dsh-mobile-certs
install -m 0640 -o caddy -g caddy /etc/letsencrypt/live/${publicHost}/fullchain.pem /var/lib/caddy/dsh-mobile-certs/fullchain.pem
install -m 0640 -o caddy -g caddy /etc/letsencrypt/live/${publicHost}/privkey.pem /var/lib/caddy/dsh-mobile-certs/privkey.pem
cat > /usr/local/sbin/dsh-mobile-cert-renew <<'DSH_MOBILE_CERT_RENEW'
#!/bin/sh
set -eu
systemctl stop caddy.service
trap 'systemctl start caddy.service' EXIT
/opt/dsh-mobile/certbot-venv/bin/certbot renew --cert-name ${publicHost} --preferred-profile shortlived --non-interactive
install -d -m 0750 -o caddy -g caddy /var/lib/caddy/dsh-mobile-certs
install -m 0640 -o caddy -g caddy /etc/letsencrypt/live/${publicHost}/fullchain.pem /var/lib/caddy/dsh-mobile-certs/fullchain.pem
install -m 0640 -o caddy -g caddy /etc/letsencrypt/live/${publicHost}/privkey.pem /var/lib/caddy/dsh-mobile-certs/privkey.pem
DSH_MOBILE_CERT_RENEW
chmod 0755 /usr/local/sbin/dsh-mobile-cert-renew
cat > /etc/systemd/system/dsh-mobile-cert-renew.service <<'DSH_MOBILE_CERT_SERVICE'
[Unit]
Description=Renew DSH Mobile public IP TLS certificate
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/dsh-mobile-cert-renew
DSH_MOBILE_CERT_SERVICE
cat > /etc/systemd/system/dsh-mobile-cert-renew.timer <<'DSH_MOBILE_CERT_TIMER'
[Unit]
Description=Daily DSH Mobile public IP TLS certificate renewal check

[Timer]
OnCalendar=daily
RandomizedDelaySec=2h
Persistent=true
Unit=dsh-mobile-cert-renew.service

[Install]
WantedBy=timers.target
DSH_MOBILE_CERT_TIMER
check certificate ok "Let's Encrypt 公网 IP 证书已安装并启用每日自动续期。"
` : "";
	return `#!/bin/sh
set -eu
umask 077

fail() { echo "DSH_MOBILE_CHECK remote-command error $1" >&2; exit 1; }
check() { echo "DSH_MOBILE_CHECK $1 $2 $3"; }

# Serialize concurrent deploys: two writers racing sed -i on the Caddyfile
# can duplicate the import line and break validation. Uninstall takes the
# same lock, so deploy and cleanup also exclude each other.
if command -v flock >/dev/null 2>&1; then
  exec 9>/tmp/dsh-mobile-deploy.lock
  flock -n 9 || fail "已有部署或清理正在进行，请稍后再试。"
fi

[ "$(id -u)" = "0" ] || fail "请使用 root SSH 账号。"
command -v systemctl >/dev/null 2>&1 || fail "VPS 不支持 systemd。"
command -v tar >/dev/null 2>&1 || fail "VPS 缺少 tar。"
command -v curl >/dev/null 2>&1 || fail "VPS 缺少 curl。"
command -v sha256sum >/dev/null 2>&1 || fail "VPS 缺少 sha256sum。"
command -v useradd >/dev/null 2>&1 || fail "VPS 缺少 useradd。"

if [ -r /etc/os-release ]; then . /etc/os-release; else fail "无法识别 VPS 系统。"; fi
case "\${ID:-}" in
  debian|ubuntu) ;;
  *) fail "首版 VPS 部署只支持 Debian/Ubuntu。" ;;
esac
check os ok "\${PRETTY_NAME:-Debian/Ubuntu}"

if command -v ss >/dev/null 2>&1 && ss -ltnH | awk '{print $4}' | grep -Eq '(^|:)${String(settings.serverPort)}$'; then
  systemctl is-active --quiet dsh-mobile-frps.service || fail "端口 ${String(settings.serverPort)} 已被占用。"
fi

if ! command -v caddy >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  # A previous interrupted run may have left these files unreadable because
  # the deployment uses umask 077. APT reads repositories as the _apt user.
  chmod 0644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null || true
  chmod 0644 /etc/apt/sources.list.d/caddy-stable.list 2>/dev/null || true
  apt-get update
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' -o /etc/apt/sources.list.d/caddy-stable.list
  chmod 0644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi
check caddy ok "Caddy 已安装。"

# The site lives in our own snippet file; the main Caddyfile only gains one
# import line, so existing user content is never rewritten or merged.
caddy_import='${FRP_CADDY_IMPORT_LINE}'
install -d -m 0755 /etc/caddy
caddyfile_ready=false
if [ ! -e /etc/caddy/Caddyfile ]; then
  printf '%s\n' "$caddy_import" > /etc/caddy/Caddyfile
  chmod 0644 /etc/caddy/Caddyfile
  caddyfile_ready=true
elif grep -Eq '^[[:space:]]*import[[:space:]]+/etc/caddy/dsh-mobile-dsh\.caddy([[:space:]]|$)' /etc/caddy/Caddyfile; then
  # The snippet may carry global options (IP mode default_sni), which must
  # precede all site blocks after import inlining: rebuild the file with a
  # single import on top. Removal uses grep -v with the exact gate pattern
  # above (not sed -i, whose in-place delete proved unreliable here), and the
  # result is verified to carry exactly one import before replacing the file.
  {
    printf '%s\n' "$caddy_import"
    grep -Ev '^[[:space:]]*import[[:space:]]+/etc/caddy/dsh-mobile-dsh\.caddy([[:space:]]|$)' /etc/caddy/Caddyfile || true
  } > /etc/caddy/Caddyfile.dsh-new
  [ "$(grep -Ec '^[[:space:]]*import[[:space:]]+/etc/caddy/dsh-mobile-dsh\.caddy([[:space:]]|$)' /etc/caddy/Caddyfile.dsh-new)" = 1 ] \
    || fail "Caddyfile import 整理失败，未做任何修改。"
  cat /etc/caddy/Caddyfile.dsh-new > /etc/caddy/Caddyfile
  rm -f /etc/caddy/Caddyfile.dsh-new
  chmod 0644 /etc/caddy/Caddyfile
  caddyfile_ready=true
elif [ ! -s /etc/caddy/Caddyfile ]; then
  printf '%s\n' "$caddy_import" > /etc/caddy/Caddyfile
  chmod 0644 /etc/caddy/Caddyfile
  caddyfile_ready=true
elif grep -q '^# DSH Mobile removed its site' /etc/caddy/Caddyfile; then
  # Leftover placeholder from our own uninstall: drop only that line, then
  # ensure the import exists exactly once (same grep -v + count discipline).
  grep -Ev '^# DSH Mobile removed its site.*$' /etc/caddy/Caddyfile > /etc/caddy/Caddyfile.dsh-new || true
  grep -Eq '^[[:space:]]*import[[:space:]]+/etc/caddy/dsh-mobile-dsh\.caddy([[:space:]]|$)' /etc/caddy/Caddyfile.dsh-new \
    || printf '%s\n' "$caddy_import" >> /etc/caddy/Caddyfile.dsh-new
  [ "$(grep -Ec '^[[:space:]]*import[[:space:]]+/etc/caddy/dsh-mobile-dsh\.caddy([[:space:]]|$)' /etc/caddy/Caddyfile.dsh-new)" = 1 ] \
    || fail "Caddyfile import 整理失败，未做任何修改。"
  cat /etc/caddy/Caddyfile.dsh-new > /etc/caddy/Caddyfile
  rm -f /etc/caddy/Caddyfile.dsh-new
  chmod 0644 /etc/caddy/Caddyfile
  caddyfile_ready=true
else
  caddy_hash="$(sha256sum /etc/caddy/Caddyfile | awk '{print $1}')"
  if [ "$caddy_hash" = '66177d46fa761acb07208065db9b0274cb1b12c02ac43b9bfc9857b698b1ccfe' ]; then
    printf '%s\n' "$caddy_import" > /etc/caddy/Caddyfile
    chmod 0644 /etc/caddy/Caddyfile
    caddyfile_ready=true
  elif grep -q '^# Managed by DSH Mobile$' /etc/caddy/Caddyfile; then
    # Legacy whole-file layout: the entire file is ours by construction.
    printf '%s\n' "$caddy_import" > /etc/caddy/Caddyfile
    chmod 0644 /etc/caddy/Caddyfile
    caddyfile_ready=true
  elif grep -q '^:80[[:space:]]*{' /etc/caddy/Caddyfile \
    && grep -q 'root [*] /usr/share/caddy' /etc/caddy/Caddyfile \
    && grep -q '^[[:space:]]*file_server[[:space:]]*$' /etc/caddy/Caddyfile; then
    printf '%s\n' "$caddy_import" > /etc/caddy/Caddyfile
    chmod 0644 /etc/caddy/Caddyfile
    caddyfile_ready=true
  fi
fi
if [ "$caddyfile_ready" != true ]; then
  fail "已有 Caddyfile，请先备份，然后加一行 ${FRP_CADDY_IMPORT_LINE}，或手动合并站点。"
fi

${ipCertificateSetup}

arch="$(uname -m)"
case "$arch" in
  x86_64|amd64) url=${shellQuote(amd64.url)}; expected=${shellQuote(amd64.sha256)}; directory=${shellQuote(amd64.directory)} ;;
  aarch64|arm64) url=${shellQuote(arm64.url)}; expected=${shellQuote(arm64.sha256)}; directory=${shellQuote(arm64.directory)} ;;
  *) fail "只支持 Linux x86_64 和 arm64。" ;;
esac

tmp="$(mktemp -d /tmp/dsh-mobile-frp.XXXXXX)"
cleanup() { rm -rf "$tmp"; [ -z "\${DSH_MOBILE_FRP_ARCHIVE:-}" ] || rm -f "$DSH_MOBILE_FRP_ARCHIVE"; }
trap cleanup EXIT HUP INT TERM
archive="$tmp/frp.tar.gz"
if [ -n "\${DSH_MOBILE_FRP_ARCHIVE:-}" ]; then
  [ -f "$DSH_MOBILE_FRP_ARCHIVE" ] || fail "上传的 frps 安装包不存在。"
  cp "$DSH_MOBILE_FRP_ARCHIVE" "$archive"
else
  curl --fail --location --proto '=https' --tlsv1.2 --output "$archive" "$url"
fi
actual="$(sha256sum "$archive" | awk '{print $1}')"
[ "$actual" = "$expected" ] || fail "frps 下载校验失败。"
tar -xzf "$archive" -C "$tmp" "$directory/frps"

install -d -m 0755 /usr/local/libexec/dsh-mobile/frp/${FRP_VERSION}
install -m 0755 "$tmp/$directory/frps" /usr/local/libexec/dsh-mobile/frp/${FRP_VERSION}/frps
# The account must exist before anything references its group below.
dsh_mobile_created=false
if ! id -u dsh-mobile >/dev/null 2>&1; then
  useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin --no-create-home dsh-mobile
  dsh_mobile_created=true
fi
install -d -m 0750 -o root -g dsh-mobile /etc/dsh-mobile
if [ "$dsh_mobile_created" = true ]; then
  # Ownership record: uninstall removes the account only when this deployment created it.
  touch /etc/dsh-mobile/.owns-account
  check account ok "已创建 dsh-mobile 系统用户。"
else
  check account ok "复用已有的 dsh-mobile 系统用户（卸载时将保留）。"
fi
cat > /etc/dsh-mobile/frps.toml <<'DSH_MOBILE_FRPS_CONFIG'
${config}DSH_MOBILE_FRPS_CONFIG
chown root:dsh-mobile /etc/dsh-mobile/frps.toml
chmod 0640 /etc/dsh-mobile/frps.toml

cat > /etc/systemd/system/dsh-mobile-frps.service <<'DSH_MOBILE_FRPS_UNIT'
[Unit]
Description=DSH Mobile self-hosted FRP server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=dsh-mobile
Group=dsh-mobile
ExecStart=/usr/local/libexec/dsh-mobile/frp/${FRP_VERSION}/frps -c /etc/dsh-mobile/frps.toml
Restart=on-failure
RestartSec=5s
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict

[Install]
WantedBy=multi-user.target
DSH_MOBILE_FRPS_UNIT

cat > ${FRP_CADDY_SNIPPET_PATH} <<'DSH_MOBILE_CADDY_SNIPPET'
${caddySnippet}DSH_MOBILE_CADDY_SNIPPET
chmod 0644 ${FRP_CADDY_SNIPPET_PATH}
caddy validate --config /etc/caddy/Caddyfile
systemctl daemon-reload
# Restart (not just start) so a redeploy over a running previous generation
# actually picks up the new frps token and config instead of keeping the old
# process alive with stale credentials.
systemctl enable dsh-mobile-frps.service
systemctl restart dsh-mobile-frps.service
systemctl enable --now caddy.service
${publicIp ? "systemctl enable --now dsh-mobile-cert-renew.timer" : ""}
systemctl reload caddy.service || systemctl restart caddy.service

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q '^Status: active'; then
  ufw allow ${String(settings.serverPort)}/tcp comment 'DSH Mobile FRP control' >/dev/null
  ufw allow 80/tcp comment 'DSH Mobile HTTPS redirect' >/dev/null
  ufw allow 443/tcp comment 'DSH Mobile HTTPS' >/dev/null
  check firewall ok "UFW 已放行 FRP 控制端口和 HTTPS。"
else
  check firewall warning "未修改系统防火墙；请确认 ${String(settings.serverPort)}/tcp、80/tcp、443/tcp 已放行。"
fi

systemctl is-active --quiet dsh-mobile-frps.service || fail "frps 服务启动失败。"
systemctl is-active --quiet caddy.service || fail "Caddy 服务启动失败。"
check frps ok "frps ${FRP_VERSION} 已启动，7080 仅绑定回环地址。"
check caddy ok "Caddy 已加载 ${publicHost}。"
echo DSH_MOBILE_DEPLOYMENT_OK
`;
}
/** Run one owned SSH/transfer utility; reject only after its process and stdio have closed. */
async function runVpsProcess(command, args, stdin, timeoutMs = SSH_TIMEOUT_MS) {
	return new Promise((resolveRun, rejectRun) => {
		const child = spawn(command, args, {
			windowsHide: true,
			stdio: [
				"pipe",
				"pipe",
				"pipe"
			]
		});
		let stdout = "";
		let stderr = "";
		const append = (current, chunk) => `${current}${chunk.toString("utf8")}`.slice(-98304);
		let timedOut = false;
		let failure;
		let failureCode = "vps_ssh_unavailable";
		let forceTimer;
		const terminate = () => {
			child.kill();
			forceTimer ??= setTimeout(() => {
				if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
				child.stdin.destroy();
				child.stdout.destroy();
				child.stderr.destroy();
			}, 1e3);
			forceTimer.unref();
		};
		const timer = setTimeout(() => {
			timedOut = true;
			terminate();
		}, timeoutMs);
		timer.unref();
		child.stdout.on("data", (chunk) => {
			stdout = append(stdout, Buffer.from(chunk));
		});
		child.stderr.on("data", (chunk) => {
			stderr = append(stderr, Buffer.from(chunk));
		});
		child.once("error", (error) => {
			failure = error;
		});
		child.stdin.on("error", (error) => {
			failure = error;
			failureCode = "vps_ssh_input_failed";
			terminate();
		});
		const failedOutput = (error) => {
			failure = error;
			failureCode = "vps_ssh_transport_failed";
			terminate();
		};
		child.stdout.on("error", failedOutput);
		child.stderr.on("error", failedOutput);
		child.once("close", (code, signal) => {
			clearTimeout(timer);
			if (forceTimer !== void 0) clearTimeout(forceTimer);
			const facts = {
				timedOut,
				exitCode: code,
				signal,
				...failure === void 0 ? {} : { cause: failure }
			};
			if (timedOut) rejectRun(new VpsSshError("vps_ssh_timeout", stdout, stderr, facts));
			else if (failure !== void 0) rejectRun(new VpsSshError(child.pid === void 0 ? "vps_ssh_unavailable" : failureCode, stdout, stderr, facts));
			else if (code !== 0) rejectRun(new VpsSshError(stderr.includes("Permission denied") ? "vps_ssh_auth_failed" : "vps_deploy_failed", stdout, stderr, facts));
			else resolveRun({
				stdout,
				stderr
			});
		});
		child.stdin.end(stdin, "utf8");
	});
}
const runProcess = runVpsProcess;
async function downloadArtifact(artifact, file) {
	const curl = process.platform === "win32" ? "curl.exe" : "curl";
	await runProcess(curl, [
		...process.platform === "win32" ? ["--ipv4"] : [],
		"--fail",
		"--location",
		"--silent",
		"--show-error",
		"--connect-timeout",
		"15",
		"--max-time",
		"180",
		"--proto",
		"=https",
		"--tlsv1.2",
		"--output",
		file,
		artifact.url
	], void 0, 2e5);
	const bytes = await readFile(file);
	if (createHash("sha256").update(bytes).digest("hex") !== artifact.sha256) throw new Error("vps_download_hash_mismatch");
	return bytes.byteLength;
}
async function defaultRunSsh(input, serverAddress, script, knownHostsFile, log) {
	const ssh = process.platform === "win32" ? "ssh.exe" : "ssh";
	const scp = process.platform === "win32" ? "scp.exe" : "scp";
	const common = sshSessionOptions(knownHostsFile);
	if (input.sshKeyPath !== void 0) common.push("-i", input.sshKeyPath);
	const target = `${input.sshUser}@${serverAddress}`;
	const architecture = (await runProcess(ssh, [
		...common,
		"-p",
		String(input.sshPort),
		target,
		"uname -m"
	])).stdout.trim();
	const artifact = architecture === "x86_64" || architecture === "amd64" ? LINUX_ARTIFACTS.x64 : architecture === "aarch64" || architecture === "arm64" ? LINUX_ARTIFACTS.arm64 : void 0;
	if (artifact === void 0) throw new Error("vps_arch_unsupported");
	log?.("architecture", { architecture });
	const localDirectory = await mkdtemp(join(tmpdir(), "dsh-mobile-frp-"));
	const localArchive = join(localDirectory, "frp.tar.gz");
	const remoteArchive = `/tmp/dsh-mobile-frp-${randomBytes(12).toString("hex")}.tar.gz`;
	try {
		log?.("download-start", {
			source: "local",
			architecture
		});
		const bytes = await downloadArtifact(artifact, localArchive);
		log?.("download-complete", {
			source: "local",
			bytes
		});
		const scpResult = await runProcess(scp, [
			...common,
			"-P",
			String(input.sshPort),
			localArchive,
			`${target}:${remoteArchive}`
		]);
		log?.("upload-complete", {
			bytes,
			stderrBytes: Buffer.byteLength(scpResult.stderr)
		});
		const remoteCommand = input.sshUser === "root" ? `env DSH_MOBILE_FRP_ARCHIVE=${shellQuote(remoteArchive)} sh -s` : `sudo -n env DSH_MOBILE_FRP_ARCHIVE=${shellQuote(remoteArchive)} sh -s`;
		return await runProcess(ssh, [
			...common,
			"-p",
			String(input.sshPort),
			target,
			remoteCommand
		], script);
	} finally {
		await rm(localDirectory, {
			recursive: true,
			force: true
		});
	}
}
async function deployVps(settings, input, options = {}) {
	const serverPort = validateFrpServerPort(settings.serverPort);
	const token = validateFrpToken(settings.token);
	const publicOrigin = validateFrpPublicOrigin(settings.publicOrigin);
	const serverAddress = validateVpsServerTarget(settings.serverAddress);
	const parsedInput = parseVpsDeploymentInput(input);
	if (parsedInput.sshKeyPath !== void 0) {
		const entry = await lstat(parsedInput.sshKeyPath).catch(() => void 0);
		if (entry === void 0 || !entry.isFile() || entry.isSymbolicLink()) throw new Error("vps_ssh_key_invalid");
	}
	const keyscanOutput = await scanHostKeys({
		sshUser: parsedInput.sshUser,
		sshPort: parsedInput.sshPort,
		sshKeyPath: parsedInput.sshKeyPath
	}, serverAddress, options);
	const knownHostsBody = buildPinnedKnownHosts(serverAddress, parsedInput.sshPort, keyscanOutput, parsedInput.hostFingerprints);
	options.log?.("host-keys-verified", { serverAddress });
	const runSsh = options.runSsh ?? (async (sshInput, host, scriptBody) => {
		const workDirectory = await mkdtemp(join(tmpdir(), "dsh-mobile-known-hosts-"));
		try {
			const knownHostsFile = join(workDirectory, "known_hosts");
			await writeFile(knownHostsFile, knownHostsBody, {
				encoding: "utf8",
				mode: 384
			});
			return await defaultRunSsh(sshInput, host, scriptBody, knownHostsFile, options.log);
		} finally {
			await rm(workDirectory, {
				recursive: true,
				force: true
			});
		}
	});
	options.log?.("validated", {
		serverAddress,
		serverPort,
		publicOrigin,
		sshUser: parsedInput.sshUser,
		sshPort: parsedInput.sshPort,
		keyProvided: parsedInput.sshKeyPath !== void 0
	});
	let result;
	try {
		options.log?.("ssh-start", {
			serverAddress,
			sshPort: parsedInput.sshPort
		});
		result = await runSsh(parsedInput, serverAddress, deploymentScript({
			...settings,
			serverAddress,
			serverPort,
			token,
			publicOrigin
		}));
		options.log?.("ssh-complete", {
			stdoutBytes: Buffer.byteLength(result.stdout),
			stderrBytes: Buffer.byteLength(result.stderr)
		});
	} catch (error) {
		if (error instanceof VpsSshError) {
			const detail = failureDetail(error.stdout, error.stderr, token);
			options.log?.("ssh-failed", {
				code: error.message,
				detail: detail || "no remote output"
			});
			throw new Error(detail === "" ? error.message : `${error.message}:${detail}`, { cause: error });
		}
		options.log?.("ssh-failed", { code: error instanceof Error ? error.message : "unknown" });
		throw error;
	}
	const checks = parseChecks(result.stdout, result.stderr, token);
	for (const check of checks) options.log?.("remote-check", {
		id: check.id,
		status: check.status,
		detail: check.detail
	});
	if (!result.stdout.includes("DSH_MOBILE_DEPLOYMENT_OK")) {
		if (checks.length === 0) throw new Error("vps_deploy_failed");
		throw new Error(`vps_deploy_failed:${checks.map((check) => check.detail).join(" ")}`);
	}
	return Object.freeze({
		version: 1,
		deployed: true,
		serverAddress,
		publicOrigin,
		checks
	});
}
function validCertName(value) {
	if (value === void 0 || value === "") return void 0;
	if (typeof value !== "string" || value.length > 253 || !/^[a-z0-9.-]+$/u.test(value)) throw new Error("vps_cert_name_invalid");
	return value.toLowerCase();
}
/**
* Build a reviewable uninstall script that removes only DSH Mobile-owned
* server artifacts: its systemd units, config, binaries, venv, renew helper,
* managed Caddy site, owned UFW rules, and optionally its IP certificate.
* Existing non-DSH-Mobile Caddy content and firewall rules are never touched.
*/
function createVpsUninstallScript(input) {
	const serverPort = validateFrpServerPort(input.serverPort);
	const certName = validCertName(input.certName);
	return `#!/bin/sh
# DSH Mobile VPS uninstall. Review before running: only files, services, and
# firewall rules created by the DSH Mobile deployment are removed.
set -eu
umask 077

fail() { echo "DSH_MOBILE_CHECK remote-command error $1" >&2; exit 1; }
check() { echo "DSH_MOBILE_CHECK $1 $2 $3"; }

# Same lock as the deploy script: cleanup and deployment exclude each other
# so their Caddyfile surgeries never interleave.
if command -v flock >/dev/null 2>&1; then
  exec 9>/tmp/dsh-mobile-deploy.lock
  flock -n 9 || fail "已有部署或清理正在进行，请稍后再试。"
fi

[ "$(id -u)" = "0" ] || fail "请使用 root SSH 账号。"
command -v systemctl >/dev/null 2>&1 || fail "VPS 不支持 systemd。"

# Ownership is decided before deleting anything: only an account created by a
# DSH Mobile deployment (marker written at useradd time) may be removed below.
owns_account=false
if [ -f /etc/dsh-mobile/.owns-account ]; then owns_account=true; fi

systemctl disable --now dsh-mobile-cert-renew.timer >/dev/null 2>&1 || true
systemctl disable --now dsh-mobile-frps.service >/dev/null 2>&1 || true
rm -f /etc/systemd/system/dsh-mobile-frps.service
rm -f /etc/systemd/system/dsh-mobile-cert-renew.service
rm -f /etc/systemd/system/dsh-mobile-cert-renew.timer
systemctl daemon-reload
check services ok "已停止并删除 dsh-mobile-frps 服务与证书续期定时器。"
${certName === void 0 ? "" : `
if [ -x /opt/dsh-mobile/certbot-venv/bin/certbot ]; then
  /opt/dsh-mobile/certbot-venv/bin/certbot delete --cert-name ${shellQuote(certName)} --non-interactive || true
fi
`}
rm -rf /etc/dsh-mobile
rm -rf /usr/local/libexec/dsh-mobile
rm -rf /opt/dsh-mobile/certbot-venv
rm -f /usr/local/sbin/dsh-mobile-cert-renew
rm -rf /var/lib/caddy/dsh-mobile-certs
rm -f ${FRP_CADDY_SNIPPET_PATH}
check files ok "已删除 DSH Mobile 配置、二进制与证书文件。"

if grep -Eq '^[[:space:]]*import[[:space:]]+/etc/caddy/dsh-mobile-dsh\.caddy([[:space:]]|$)' /etc/caddy/Caddyfile 2>/dev/null; then
  # Rebuild without our import line (grep -v with the gate pattern, verified
  # to remove every copy), keeping all user content byte-identical otherwise.
  grep -Ev '^[[:space:]]*import[[:space:]]+/etc/caddy/dsh-mobile-dsh\.caddy([[:space:]]|$)' /etc/caddy/Caddyfile > /etc/caddy/Caddyfile.dsh-new || true
  if grep -Eq '^[[:space:]]*import[[:space:]]+/etc/caddy/dsh-mobile-dsh\.caddy([[:space:]]|$)' /etc/caddy/Caddyfile.dsh-new; then
    rm -f /etc/caddy/Caddyfile.dsh-new
    fail "Caddyfile import 移除失败，未做任何修改。"
  fi
  cat /etc/caddy/Caddyfile.dsh-new > /etc/caddy/Caddyfile
  rm -f /etc/caddy/Caddyfile.dsh-new
  if [ ! -s /etc/caddy/Caddyfile ]; then
    printf '# DSH Mobile removed its site; the remaining Caddyfile was empty.\n' > /etc/caddy/Caddyfile
    chmod 0644 /etc/caddy/Caddyfile
  fi
  if command -v caddy >/dev/null 2>&1; then
    caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy.service || systemctl restart caddy.service || true
  fi
  check caddy ok "已移除 DSH Mobile 站点引入；其余 Caddy 配置保持原样。"
elif [ -f /etc/caddy/Caddyfile ] && grep -q '^# Managed by DSH Mobile$' /etc/caddy/Caddyfile; then
  # Legacy whole-file layout (pre-snippet releases): the entire file is ours.
  printf '# DSH Mobile removed its site. Restore your own Caddyfile or reinstall the Caddy defaults.\\n' > /etc/caddy/Caddyfile
  chmod 0644 /etc/caddy/Caddyfile
  if command -v caddy >/dev/null 2>&1; then
    caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy.service || systemctl restart caddy.service || true
  fi
  check caddy ok "已清空旧版 DSH Mobile 管理的 Caddy 站点；请按需恢复自己的配置。"
else
  check caddy ok "Caddyfile 非 DSH Mobile 管理，保持原样。"
fi

if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q '^Status: active'; then
  for rule in $(ufw status numbered 2>/dev/null | grep 'DSH Mobile' | sed -E 's/^\\[ *([0-9]+)\\].*/\\1/' | sort -rn); do
    yes | ufw delete "$rule" >/dev/null 2>&1 || true
  done
  check firewall ok "已删除带 DSH Mobile 标记的 UFW 规则（FRP 控制端口 ${String(serverPort)}、80、443）。"
else
  check firewall ok "UFW 未启用或无需调整。"
fi

if [ "$owns_account" = true ]; then
  if id dsh-mobile >/dev/null 2>&1; then
    if pgrep -u dsh-mobile >/dev/null 2>&1; then
      fail "dsh-mobile 用户仍有运行中的进程，已保留该用户；请先停止相关进程后重试。"
    fi
    userdel dsh-mobile || fail "删除 dsh-mobile 系统用户失败。"
    check account ok "已删除本次部署创建的 dsh-mobile 系统用户。"
  else
    check account ok "dsh-mobile 系统用户已不存在，无需删除。"
  fi
else
  check account ok "dsh-mobile 系统用户非本次部署创建，已保留。"
fi

echo DSH_MOBILE_UNINSTALL_OK
`;
}
async function runRemoteScript(input, serverAddress, script, environment, knownHostsFile, log) {
	const ssh = process.platform === "win32" ? "ssh.exe" : "ssh";
	const parsedInput = parseVpsDeploymentInput(input);
	const common = sshSessionOptions(knownHostsFile);
	if (parsedInput.sshKeyPath !== void 0) common.push("-i", parsedInput.sshKeyPath);
	const target = `${parsedInput.sshUser}@${serverAddress}`;
	const remoteCommand = parsedInput.sshUser === "root" ? "sh -s" : "sudo -n sh -s";
	const envPrefix = Object.entries(environment).map(([key, value]) => `${key}=${shellQuote(value)}`).join(" ");
	log?.("uninstall-ssh-start", { serverAddress });
	return await runProcess(ssh, [
		...common,
		"-p",
		String(parsedInput.sshPort),
		target,
		`${envPrefix} ${remoteCommand}`.trim()
	], script);
}
/** Remove DSH Mobile-owned server artifacts over a pinned SSH connection. */
async function uninstallVps(serverAddress, uninstall, input, options = {}) {
	const address = validateVpsServerTarget(serverAddress);
	const parsedInput = parseVpsDeploymentInput(input);
	const keyscanOutput = await scanHostKeys({
		sshUser: parsedInput.sshUser,
		sshPort: parsedInput.sshPort,
		sshKeyPath: parsedInput.sshKeyPath
	}, address, options);
	const knownHostsBody = buildPinnedKnownHosts(address, parsedInput.sshPort, keyscanOutput, parsedInput.hostFingerprints);
	options.log?.("host-keys-verified", { serverAddress: address });
	const script = createVpsUninstallScript(uninstall);
	options.log?.("uninstall-start", { serverAddress: address });
	const runRemote = options.runRemoteScript ?? (async (sshInput, host, scriptBody) => {
		const workDirectory = await mkdtemp(join(tmpdir(), "dsh-mobile-known-hosts-"));
		try {
			const knownHostsFile = join(workDirectory, "known_hosts");
			await writeFile(knownHostsFile, knownHostsBody, {
				encoding: "utf8",
				mode: 384
			});
			return await runRemoteScript(sshInput, host, scriptBody, {}, knownHostsFile, options.log);
		} finally {
			await rm(workDirectory, {
				recursive: true,
				force: true
			});
		}
	});
	let result;
	try {
		result = await runRemote(parsedInput, address, script);
	} catch (error) {
		if (error instanceof VpsSshError) {
			const detail = failureDetail(error.stdout, error.stderr, "");
			const code = error.message === "vps_deploy_failed" ? "vps_uninstall_failed" : error.message;
			options.log?.("uninstall-failed", {
				code,
				detail: detail || "no remote output"
			});
			throw new Error(detail === "" ? code : `${code}:${detail}`, { cause: error });
		}
		options.log?.("uninstall-failed", { code: error instanceof Error ? error.message : "unknown" });
		throw error;
	}
	const checks = parseChecks(result.stdout, result.stderr, "");
	for (const check of checks) options.log?.("remote-check", {
		id: check.id,
		status: check.status,
		detail: check.detail
	});
	if (!result.stdout.includes("DSH_MOBILE_UNINSTALL_OK")) {
		if (checks.length === 0) throw new Error("vps_uninstall_failed");
		throw new Error(`vps_uninstall_failed:${checks.map((check) => check.detail).join(" ")}`);
	}
	return Object.freeze({
		version: 1,
		removed: true,
		serverAddress: address,
		checks
	});
}
//#endregion
//#region src/funnel.ts
const MAX_PROTOCOL_LINE_BYTES = 16384;
const FUNNEL_START_TIMEOUT_MS = 45e3;
function publicStatus$1(status) {
	return Object.freeze({
		enabled: status.enabled,
		state: status.state,
		...status.origin === void 0 ? {} : { origin: status.origin },
		...status.loginUrl === void 0 ? {} : { loginUrl: status.loginUrl },
		...status.setupUrl === void 0 ? {} : { setupUrl: status.setupUrl },
		...status.errorCode === void 0 ? {} : { errorCode: status.errorCode }
	});
}
const FUNNEL_SETUP_URLS = /* @__PURE__ */ new Set(["https://tailscale.com/s/no-funnel", "https://tailscale.com/s/https"]);
function parseSetupUrl(value) {
	if (value === void 0) return void 0;
	if (typeof value !== "string" || value.length > 2048) throw new Error("invalid_sidecar_protocol");
	const url = new URL(value);
	const normalized = url.toString().replace(/\/$/u, "");
	const officialInteractive = url.protocol === "https:" && url.hostname === "login.tailscale.com" && url.port === "" && url.username === "" && url.password === "";
	if (!FUNNEL_SETUP_URLS.has(normalized) && !officialInteractive) throw new Error("invalid_sidecar_protocol");
	return officialInteractive ? url.toString() : normalized;
}
function parseOrigin(value) {
	if (typeof value !== "string" || value.length > 512) throw new Error("invalid_funnel_origin");
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error("invalid_funnel_origin");
	}
	if (url.protocol !== "https:" || !url.hostname.endsWith(".ts.net") || url.port !== "" || url.pathname !== "/" || url.search !== "" || url.hash !== "" || url.username !== "" || url.password !== "") throw new Error("invalid_funnel_origin");
	return url.origin;
}
/** Parse one sidecar protocol line while restricting every browser-opened URL. */
function parseFunnelEvent(line) {
	if (Buffer.byteLength(line, "utf8") === 0 || Buffer.byteLength(line, "utf8") > MAX_PROTOCOL_LINE_BYTES) throw new Error("invalid_sidecar_protocol");
	let value;
	try {
		value = JSON.parse(line);
	} catch {
		throw new Error("invalid_sidecar_protocol");
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("invalid_sidecar_protocol");
	const record = value;
	if (record.version !== 1 || typeof record.type !== "string") throw new Error("invalid_sidecar_protocol");
	if (record.type === "login") {
		if (typeof record.url !== "string" || record.url.length > 2048) throw new Error("invalid_sidecar_protocol");
		const url = new URL(record.url);
		if (url.protocol !== "https:" || url.hostname !== "login.tailscale.com") throw new Error("invalid_sidecar_protocol");
		return Object.freeze({
			version: 1,
			type: "login",
			url: url.toString()
		});
	}
	if (record.type === "ready" || record.type === "serving") return Object.freeze({
		version: 1,
		type: record.type,
		origin: parseOrigin(record.origin)
	});
	if (record.type === "error") {
		if (typeof record.code !== "string" || !/^[a-z][a-z0-9_]{0,63}$/u.test(record.code)) throw new Error("invalid_sidecar_protocol");
		const setupUrl = parseSetupUrl(record.url);
		return Object.freeze({
			version: 1,
			type: "error",
			code: record.code,
			...setupUrl === void 0 ? {} : { url: setupUrl }
		});
	}
	throw new Error("invalid_sidecar_protocol");
}
function withoutProvisioningSecrets(environment) {
	const blocked = /* @__PURE__ */ new Set([
		"TS_AUTHKEY",
		"TAILSCALE_AUTHKEY",
		"TS_OAUTH_CLIENT_SECRET"
	]);
	return Object.fromEntries(Object.entries(environment).filter(([name]) => !blocked.has(name.toUpperCase())));
}
/** Owns the source-built tsnet sidecar, remote gateway, and persisted remote switch. */
var FunnelController = class {
	options;
	enabled = false;
	initialized = false;
	disposed = false;
	child;
	gatewayValue;
	generation = 0;
	buffer = "";
	latest = publicStatus$1({
		enabled: false,
		state: "off"
	});
	queue = Promise.resolve();
	startTimer;
	ownedRoot;
	constructor(options) {
		this.options = options;
		if (!isAbsolute(options.executable) || !isAbsolute(options.stateDirectory)) throw new Error("Funnel paths must be absolute");
		this.ownedRoot = options.ownedRoot ?? dirname(resolve(options.stateDirectory));
		if (!isAbsolute(this.ownedRoot) || resolve(this.ownedRoot) === resolve(options.stateDirectory)) throw new Error("Funnel state must be a child of its owned root");
	}
	/** Restore the remote switch without coupling it to LAN availability. */
	async initialize() {
		try {
			await this.assertStateParents();
		} catch (_error) {
			this.enabled = false;
			this.initialized = true;
			this.publish({
				enabled: false,
				state: "unavailable",
				errorCode: "funnel_state_invalid"
			});
			return;
		}
		const state = await this.options.store.load();
		this.enabled = state.enabled;
		this.initialized = true;
		if (this.enabled) await this.start();
		else this.publish({
			enabled: false,
			state: "off"
		});
	}
	/** Return the currently attached authenticated remote gateway. */
	gateway() {
		return this.gatewayValue;
	}
	/** Return state safe for the local desktop control UI. */
	status() {
		return publicStatus$1(this.latest);
	}
	/** Enable or disable Funnel without changing the LAN listener. */
	async setEnabled(enabled) {
		if (!this.initialized || this.disposed) throw new Error("Funnel controller is unavailable");
		await this.enqueue(async () => {
			if (this.enabled === enabled && (enabled === false || this.child !== void 0)) return;
			if (!enabled) await this.stop();
			try {
				await this.assertStateParents();
			} catch (error) {
				this.enabled = false;
				this.publish({
					enabled: false,
					state: "unavailable",
					errorCode: "funnel_state_invalid"
				});
				throw error;
			}
			this.enabled = enabled;
			await this.options.store.save({
				version: 1,
				enabled
			});
			if (enabled) await this.start();
			else this.publish({
				enabled: false,
				state: "off"
			});
		});
		return this.status();
	}
	/** Restart a failed or interrupted Funnel session while retaining sign-in state. */
	async reconnect() {
		if (!this.initialized || this.disposed) throw new Error("Funnel controller is unavailable");
		await this.enqueue(async () => {
			await this.stop();
			try {
				await this.assertStateParents();
			} catch (error) {
				this.publish({
					enabled: this.enabled,
					state: "unavailable",
					errorCode: "funnel_state_invalid"
				});
				throw error;
			}
			if (!this.enabled) {
				this.enabled = true;
				await this.options.store.save({
					version: 1,
					enabled: true
				});
			}
			await this.start();
		});
		return this.status();
	}
	/** Disable Funnel and remove only its private Tailscale node state. */
	async reset() {
		if (!this.initialized || this.disposed) throw new Error("Funnel controller is unavailable");
		await this.enqueue(async () => {
			await this.stop();
			this.enabled = false;
			try {
				await removeManagedTree(this.ownedRoot, this.options.stateDirectory, "funnel");
				await this.assertStateParents();
				await this.options.store.save({
					version: 1,
					enabled: false
				});
			} catch (error) {
				this.publish({
					enabled: false,
					state: "off",
					errorCode: "funnel_state_invalid"
				});
				throw error;
			}
			this.publish({
				enabled: false,
				state: "off"
			});
		});
		return this.status();
	}
	/** Stop all remote resources without modifying the remembered switch. */
	async close() {
		if (this.disposed) return;
		this.disposed = true;
		await this.enqueue(() => this.stop());
	}
	enqueue(operation) {
		const task = this.queue.then(operation, operation);
		this.queue = task.then(() => void 0, () => void 0);
		return task;
	}
	publish(status) {
		this.latest = publicStatus$1(status);
		try {
			this.options.onStatus?.(this.status());
		} catch {}
	}
	async assertStateParents() {
		await assertManagedParents(this.ownedRoot, this.options.stateDirectory, "funnel");
		try {
			const entry = await lstat(this.options.stateDirectory);
			if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error("funnel_path_invalid");
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	}
	async start() {
		const generation = ++this.generation;
		let entry;
		try {
			entry = await lstat(this.options.executable);
		} catch {
			this.publish({
				enabled: true,
				state: "unavailable",
				errorCode: "component_missing"
			});
			return;
		}
		if (!entry.isFile() || entry.isSymbolicLink()) {
			this.publish({
				enabled: true,
				state: "unavailable",
				errorCode: "component_invalid"
			});
			return;
		}
		try {
			await this.assertStateParents();
			await ensureManagedDirectory(this.ownedRoot, this.options.stateDirectory, "funnel");
		} catch (_error) {
			this.publish({
				enabled: true,
				state: "unavailable",
				errorCode: "funnel_state_invalid"
			});
			return;
		}
		this.buffer = "";
		this.publish({
			enabled: true,
			state: "starting"
		});
		const child = spawn(this.options.executable, [
			"--state-dir",
			resolve(this.options.stateDirectory),
			"--hostname",
			this.options.hostname
		], {
			env: withoutProvisioningSecrets(process.env),
			shell: false,
			stdio: [
				"pipe",
				"pipe",
				"pipe"
			],
			windowsHide: true
		});
		this.child = child;
		this.clearStartTimer();
		this.startTimer = setTimeout(() => {
			this.enqueue(() => this.failGeneration(generation, "funnel_start_timeout"));
		}, FUNNEL_START_TIMEOUT_MS);
		this.startTimer.unref();
		child.stderr.resume();
		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (chunk) => {
			this.consume(generation, String(chunk));
		});
		child.once("error", () => {
			this.enqueue(() => this.failGeneration(generation, "sidecar_launch_failed"));
		});
		child.once("close", (code) => {
			if (generation !== this.generation || this.child !== child) return;
			this.child = void 0;
			if (this.enabled) this.enqueue(() => this.failGeneration(generation, code === 0 ? "sidecar_stopped" : "sidecar_exited"));
		});
	}
	consume(generation, chunk) {
		if (generation !== this.generation) return;
		this.buffer += chunk;
		if (Buffer.byteLength(this.buffer, "utf8") > MAX_PROTOCOL_LINE_BYTES && !this.buffer.includes("\n")) {
			this.enqueue(() => this.failGeneration(generation, "invalid_sidecar_protocol"));
			return;
		}
		while (true) {
			const newline = this.buffer.indexOf("\n");
			if (newline < 0) return;
			const line = this.buffer.slice(0, newline).replace(/\r$/u, "");
			this.buffer = this.buffer.slice(newline + 1);
			let event;
			try {
				event = parseFunnelEvent(line);
			} catch {
				this.enqueue(() => this.failGeneration(generation, "invalid_sidecar_protocol"));
				return;
			}
			this.enqueue(() => this.handleEvent(generation, event));
		}
	}
	async handleEvent(generation, event) {
		if (generation !== this.generation || !this.enabled) return;
		this.clearStartTimer();
		if (event.type === "login") {
			this.publish({
				enabled: true,
				state: "needs-login",
				loginUrl: event.url
			});
			return;
		}
		if (event.type === "error") {
			await this.failGeneration(generation, event.code ?? "funnel_failed", event.url);
			return;
		}
		const origin = parseOrigin(event.origin);
		if (event.type === "ready") {
			let gateway;
			try {
				await this.gatewayValue?.close();
				this.gatewayValue = void 0;
				gateway = await this.options.createGateway(origin);
			} catch {
				await this.failGeneration(generation, "gateway_start_failed");
				return;
			}
			if (generation !== this.generation || !this.enabled) {
				await gateway.close();
				return;
			}
			this.gatewayValue = gateway;
			const address = gateway.address();
			const child = this.child;
			if (child === void 0) {
				await this.failGeneration(generation, "sidecar_stopped");
				return;
			}
			child.stdin.write(`${JSON.stringify({
				version: 1,
				type: "serve",
				target: `http://${address.host}:${String(address.port)}`
			})}\n`, (error) => {
				if (error !== null && error !== void 0) this.enqueue(() => this.failGeneration(generation, "control_channel_failed"));
			});
			this.publish({
				enabled: true,
				state: "connecting",
				origin
			});
			return;
		}
		this.publish({
			enabled: true,
			state: "ready",
			origin
		});
	}
	async failGeneration(generation, code, setupUrl) {
		if (generation !== this.generation) return;
		await this.stopProcessAndGateway();
		if (this.enabled) this.publish({
			enabled: true,
			state: "error",
			errorCode: code,
			...setupUrl === void 0 ? {} : { setupUrl }
		});
	}
	async stop() {
		++this.generation;
		await this.stopProcessAndGateway();
	}
	async stopProcessAndGateway() {
		this.clearStartTimer();
		const child = this.child;
		this.child = void 0;
		const gateway = this.gatewayValue;
		this.gatewayValue = void 0;
		await settleRemoteResources([async () => {
			child?.stdin.end();
			if (child !== void 0 && child.exitCode === null) await terminateRemoteProcess(child);
		}, () => gateway?.close()], "Funnel resource cleanup failed");
	}
	clearStartTimer() {
		if (this.startTimer === void 0) return;
		clearTimeout(this.startTimer);
		this.startTimer = void 0;
	}
};
/** Locate the current platform's bundled Funnel executable, with one local development override. */
function funnelExecutable(importMetaUrl, environment = process.env) {
	const override = environment.DSH_MOBILE_FUNNEL_SIDECAR;
	if (override !== void 0) {
		if (!isAbsolute(override)) throw new Error("DSH_MOBILE_FUNNEL_SIDECAR must be an absolute path");
		return resolve(override);
	}
	const suffix = process.platform === "win32" ? ".exe" : "";
	const file = `dsh-mobile-funnel-${process.platform}-${process.arch}${suffix}`;
	return resolve(fileURLToPath(new URL(`../bin/${file}`, importMetaUrl)));
}
//#endregion
//#region src/cpolar.ts
const MAX_LOG_BUFFER_BYTES = 65536;
const START_TIMEOUT_MS = 45e3;
const CPOLAR_HOST_SUFFIXES = Object.freeze([
	".cpolar.cn",
	".cpolar.io",
	".cpolar.top",
	".cpolar.com"
]);
function publicStatus(status) {
	return Object.freeze({
		enabled: status.enabled,
		state: status.state,
		...status.origin === void 0 ? {} : { origin: status.origin },
		...status.errorCode === void 0 ? {} : { errorCode: status.errorCode }
	});
}
function isCpolarHost(hostname) {
	return CPOLAR_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}
/** Extract a validated public HTTPS origin from one cpolar log line. */
function parseCpolarOrigin(line) {
	if (!line.includes("Tunnel established at ")) return void 0;
	const match = /Tunnel established at (https:\/\/[^"\s]+)/u.exec(line);
	if (match === null) return void 0;
	let url;
	try {
		url = new URL(match[1]);
	} catch {
		throw new Error("invalid_cpolar_origin");
	}
	if (url.protocol !== "https:" || url.port !== "" || !isCpolarHost(url.hostname) || url.pathname !== "/" || url.search !== "" || url.hash !== "" || url.username !== "" || url.password !== "") throw new Error("invalid_cpolar_origin");
	return url.origin;
}
async function reserveLoopbackPort() {
	const server = createServer((socket) => {
		socket.destroy();
	});
	await new Promise((resolveListen, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			server.off("error", reject);
			resolveListen();
		});
	});
	const address = server.address();
	if (address === null || typeof address === "string") {
		server.close();
		throw new Error("cpolar_port_reservation_failed");
	}
	let released = false;
	return {
		port: address.port,
		release: async () => {
			if (released) return;
			released = true;
			await new Promise((resolveClose) => {
				server.close(() => resolveClose());
			});
		}
	};
}
function spawnCpolarProcess(executable, args, environment) {
	return spawn(executable, [...args], {
		env: environment,
		shell: false,
		stdio: [
			"pipe",
			"pipe",
			"pipe"
		],
		windowsHide: true
	});
}
function withoutProxyEnvironment(environment) {
	const blocked = /* @__PURE__ */ new Set([
		"HTTP_PROXY",
		"HTTPS_PROXY",
		"ALL_PROXY",
		"NO_PROXY"
	]);
	return Object.fromEntries(Object.entries(environment).filter(([name]) => !blocked.has(name.toUpperCase())));
}
/** Owns an installed cpolar client and a provider-specific DSH remote gateway. */
var CpolarController = class {
	options;
	enabled = false;
	initialized = false;
	disposed = false;
	child;
	gatewayValue;
	reservation;
	generation = 0;
	buffer = "";
	latest = publicStatus({
		enabled: false,
		state: "off"
	});
	queue = Promise.resolve();
	startupTimer;
	constructor(options) {
		this.options = options;
		if (!isAbsolute(options.executable) || !isAbsolute(options.configFile)) throw new Error("cpolar paths must be absolute");
		if (options.region !== void 0 && !/^[a-z][a-z0-9_]{0,31}$/u.test(options.region)) throw new Error("cpolar region is invalid");
	}
	/** Restore the remembered cpolar switch independently from LAN and Funnel state. */
	async initialize() {
		const state = await this.options.store.load();
		this.enabled = state.enabled;
		this.initialized = true;
		if (this.enabled) await this.start();
		else this.publish({
			enabled: false,
			state: "off"
		});
	}
	/** Return the active cpolar-backed DSH gateway. */
	gateway() {
		return this.gatewayValue;
	}
	/** Return state safe for the desktop control UI. */
	status() {
		return publicStatus(this.latest);
	}
	/** Enable or disable cpolar without changing LAN or Tailscale state. */
	async setEnabled(enabled) {
		if (!this.initialized || this.disposed) throw new Error("cpolar controller is unavailable");
		await this.enqueue(async () => {
			if (this.enabled === enabled && (enabled === false || this.child !== void 0)) return;
			if (!enabled) await this.stop();
			this.enabled = enabled;
			await this.options.store.save({
				version: 1,
				enabled
			});
			if (enabled) await this.start();
			else this.publish({
				enabled: false,
				state: "off"
			});
		});
		return this.status();
	}
	/** Restart cpolar while retaining its account configuration and DSH device store. */
	async reconnect() {
		if (!this.initialized || this.disposed) throw new Error("cpolar controller is unavailable");
		await this.enqueue(async () => {
			if (!this.enabled) {
				this.enabled = true;
				await this.options.store.save({
					version: 1,
					enabled: true
				});
			}
			await this.stop();
			await this.start();
		});
		return this.status();
	}
	/** Disable cpolar without modifying the user's cpolar account or global tunnels. */
	async reset() {
		if (!this.initialized || this.disposed) throw new Error("cpolar controller is unavailable");
		await this.enqueue(async () => {
			await this.stop();
			this.enabled = false;
			await this.options.store.save({
				version: 1,
				enabled: false
			});
			this.publish({
				enabled: false,
				state: "off"
			});
		});
		return this.status();
	}
	/** Stop owned resources without changing the remembered switch. */
	async close() {
		if (this.disposed) return;
		this.disposed = true;
		await this.enqueue(() => this.stop());
	}
	enqueue(operation) {
		const task = this.queue.then(operation, operation);
		this.queue = task.then(() => void 0, () => void 0);
		return task;
	}
	publish(status) {
		this.latest = publicStatus(status);
		try {
			this.options.onStatus?.(this.status());
		} catch {}
	}
	async start() {
		const generation = ++this.generation;
		let executableEntry;
		try {
			executableEntry = await lstat(this.options.executable);
		} catch {
			this.publish({
				enabled: true,
				state: "unavailable",
				errorCode: "cpolar_component_missing"
			});
			return;
		}
		if (!executableEntry.isFile() || executableEntry.isSymbolicLink()) {
			this.publish({
				enabled: true,
				state: "unavailable",
				errorCode: "cpolar_component_invalid"
			});
			return;
		}
		let configEntry;
		try {
			configEntry = await lstat(this.options.configFile);
		} catch {
			this.publish({
				enabled: true,
				state: "unavailable",
				errorCode: "cpolar_config_missing"
			});
			return;
		}
		if (!configEntry.isFile() || configEntry.isSymbolicLink()) {
			this.publish({
				enabled: true,
				state: "unavailable",
				errorCode: "cpolar_config_invalid"
			});
			return;
		}
		let reservation;
		try {
			reservation = await reserveLoopbackPort();
		} catch {
			this.publish({
				enabled: true,
				state: "error",
				errorCode: "cpolar_port_unavailable"
			});
			return;
		}
		this.reservation = reservation;
		this.buffer = "";
		this.publish({
			enabled: true,
			state: "starting"
		});
		const args = [
			"http",
			`-config=${resolve(this.options.configFile)}`,
			...this.options.region === void 0 ? [] : [`-region=${this.options.region}`],
			"-inspect-addr=false",
			"-redirect-https=true",
			"-log=stdout",
			"-log-level=INFO",
			String(reservation.port)
		];
		const child = (this.options.spawnProcess ?? spawnCpolarProcess)(this.options.executable, args, withoutProxyEnvironment(process.env));
		this.child = child;
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => {
			this.consume(generation, String(chunk));
		});
		child.stderr.on("data", (chunk) => {
			this.consume(generation, String(chunk));
		});
		child.once("error", () => {
			this.enqueue(() => this.failGeneration(generation, "cpolar_launch_failed"));
		});
		child.once("close", (code) => {
			if (generation !== this.generation || this.child !== child) return;
			this.child = void 0;
			if (this.enabled) this.enqueue(() => this.failGeneration(generation, code === 0 ? "cpolar_stopped" : "cpolar_exited"));
		});
		this.startupTimer = setTimeout(() => {
			this.enqueue(() => this.failGeneration(generation, "cpolar_start_timeout"));
		}, START_TIMEOUT_MS);
		this.startupTimer.unref();
	}
	consume(generation, chunk) {
		if (generation !== this.generation) return;
		this.buffer += chunk;
		if (Buffer.byteLength(this.buffer, "utf8") > MAX_LOG_BUFFER_BYTES && !this.buffer.includes("\n")) {
			this.enqueue(() => this.failGeneration(generation, "cpolar_invalid_output"));
			return;
		}
		while (true) {
			const newline = this.buffer.indexOf("\n");
			if (newline < 0) return;
			const line = this.buffer.slice(0, newline).replace(/\r$/u, "");
			this.buffer = this.buffer.slice(newline + 1);
			let origin;
			try {
				origin = parseCpolarOrigin(line);
			} catch {
				this.enqueue(() => this.failGeneration(generation, "cpolar_invalid_origin"));
				return;
			}
			if (origin !== void 0) this.enqueue(() => this.attachGateway(generation, origin));
		}
	}
	async attachGateway(generation, origin) {
		if (generation !== this.generation || !this.enabled || this.disposed) return;
		const current = this.gatewayValue;
		if (current !== void 0) {
			if (current.address().origin === origin) return;
			await this.rotateGateway(generation, origin, current);
			return;
		}
		const reservation = this.reservation;
		if (reservation === void 0) return;
		this.publish({
			enabled: true,
			state: "connecting",
			origin
		});
		await reservation.release();
		if (this.reservation === reservation) this.reservation = void 0;
		let gateway;
		try {
			gateway = await this.options.createGateway(origin, reservation.port);
		} catch {
			await this.failGeneration(generation, "gateway_start_failed");
			return;
		}
		if (generation !== this.generation || !this.enabled || this.disposed || this.child === void 0) {
			await gateway.close();
			return;
		}
		this.gatewayValue = gateway;
		if (this.startupTimer !== void 0) clearTimeout(this.startupTimer);
		this.startupTimer = void 0;
		this.publish({
			enabled: true,
			state: "ready",
			origin
		});
	}
	/** Replace the gateway authority when cpolar rotates a temporary public origin. */
	async rotateGateway(generation, origin, current) {
		const listenPort = current.address().port;
		if (this.gatewayValue === current) this.gatewayValue = void 0;
		this.publish({
			enabled: true,
			state: "connecting",
			origin
		});
		try {
			await current.close();
		} catch {
			await this.failGeneration(generation, "gateway_start_failed");
			return;
		}
		if (generation !== this.generation || !this.enabled || this.disposed || this.child === void 0) return;
		let replacement;
		try {
			replacement = await this.options.createGateway(origin, listenPort);
		} catch {
			await this.failGeneration(generation, "gateway_start_failed");
			return;
		}
		if (generation !== this.generation || !this.enabled || this.disposed || this.child === void 0) {
			await replacement.close();
			return;
		}
		this.gatewayValue = replacement;
		this.publish({
			enabled: true,
			state: "ready",
			origin
		});
	}
	async failGeneration(generation, code) {
		if (generation !== this.generation) return;
		await this.stopProcessAndGateway();
		if (this.enabled) this.publish({
			enabled: true,
			state: "error",
			errorCode: code
		});
	}
	async stop() {
		++this.generation;
		await this.stopProcessAndGateway();
	}
	async stopProcessAndGateway() {
		if (this.startupTimer !== void 0) clearTimeout(this.startupTimer);
		this.startupTimer = void 0;
		const reservation = this.reservation;
		this.reservation = void 0;
		const child = this.child;
		this.child = void 0;
		const gateway = this.gatewayValue;
		this.gatewayValue = void 0;
		await settleRemoteResources([
			() => reservation?.release(),
			() => child !== void 0 && child.exitCode === null ? terminateRemoteProcess(child) : void 0,
			() => gateway?.close()
		], "cpolar resource cleanup failed");
	}
};
//#endregion
//#region src/cpolar-component.ts
const CPOLAR_VERSION = "3.3.18";
/** Pinned official cpolar release metadata for supported desktop targets. */
const CPOLAR_COMPONENT_RELEASES = Object.freeze(Object.fromEntries([
	{
		version: CPOLAR_VERSION,
		platform: "win32",
		arch: "x64",
		downloadUrl: `https://www.cpolar.com/static/downloads/releases/${CPOLAR_VERSION}/cpolar-stable-windows-amd64-setup.zip`,
		downloadBytes: 7603505,
		downloadSha256: "fb8cf60289058ee26079f995d2eeea0b21768a742d90c93015afe96e83428830",
		executableName: "cpolar.exe",
		executableBytes: 19637680,
		executableSha256: "b2d865ee505e842d22ceca5493a872efa893a79b079a7a8ee2bd3aa5343a5c41",
		archiveKind: "msi-zip"
	},
	{
		version: CPOLAR_VERSION,
		platform: "linux",
		arch: "x64",
		downloadUrl: `https://www.cpolar.com/static/downloads/releases/${CPOLAR_VERSION}/cpolar-stable-linux-amd64.tar.gz`,
		downloadBytes: 7404781,
		downloadSha256: "5cd3320c4369928ccb509c4f5fa2ec3b86151ead77e1b77c1694aa64c43e32e7",
		executableName: "cpolar",
		executableBytes: 19328632,
		executableSha256: "c076e1109372a3f88031841c5989030e49b6871b54aee3260c796da9122dec05",
		archiveKind: "tar.gz"
	},
	{
		version: CPOLAR_VERSION,
		platform: "linux",
		arch: "arm64",
		downloadUrl: `https://www.cpolar.com/static/downloads/releases/${CPOLAR_VERSION}/cpolar-stable-linux-arm64.tar.gz`,
		downloadBytes: 6855666,
		downloadSha256: "8a61a97983f18ae5ffb4b8bac4c9b3d8e2399a6ee101844e7b0b30d7f326157c",
		executableName: "cpolar",
		executableBytes: 19017169,
		executableSha256: "8d76a1b7e518df45f387f107c7a428079c67ecd9b971a2915c53b947ea9b443a",
		archiveKind: "tar.gz"
	}
].map((release) => [`${release.platform}-${release.arch}`, Object.freeze(release)])));
/**
* Canonical release metadata. New code should select from
* {@link CPOLAR_COMPONENT_RELEASES} by platform and architecture; this alias
* preserves the original Windows x64 entry for existing callers.
*/
const CPOLAR_COMPONENT_RELEASE = CPOLAR_COMPONENT_RELEASES["win32-x64"];
const DOWNLOAD_PAGE = "https://www.cpolar.com/download";
const SIGNUP_URL = "https://dashboard.cpolar.com/signup";
const DASHBOARD_URL = "https://dashboard.cpolar.com/auth";
const TERMS_URL = "https://www.cpolar.com/tos";
function inside(parent, child) {
	const candidate = relative(parent, child);
	return candidate !== "" && !candidate.startsWith("..") && !isAbsolute(candidate);
}
async function sha256(file) {
	return createHash("sha256").update(await readFile(file)).digest("hex");
}
async function regularFile(file, expectedBytes) {
	try {
		const stat = await lstat(file);
		return stat.isFile() && !stat.isSymbolicLink() && (expectedBytes === void 0 || stat.size === expectedBytes);
	} catch (error) {
		if (error.code === "ENOENT") return false;
		throw error;
	}
}
async function installStep(code, operation) {
	try {
		return await operation();
	} catch (error) {
		if (error instanceof Error && error.message.startsWith("cpolar_")) throw error;
		throw new Error(code, { cause: error });
	}
}
async function pathExists(path) {
	try {
		await lstat(path);
		return true;
	} catch (error) {
		if (error.code === "ENOENT") return false;
		throw error;
	}
}
/** Replace only this version's verified binary, retaining the previous directory until promotion succeeds. */
async function publishVerifiedCpolarExecutable(extracted, componentRoot, componentStorage, executableName, operations = {}) {
	if (dirname(componentStorage) !== componentRoot || !inside(componentRoot, componentStorage) || basename(executableName) !== executableName || executableName === "." || executableName === "..") throw new Error("cpolar component storage escaped its private root");
	const move = async (from, to) => {
		await assertManagedParents(componentRoot, from, "cpolar");
		await assertManagedParents(componentRoot, to, "cpolar");
		if (operations.move === void 0) await renameManagedPath(componentRoot, from, to, "cpolar");
		else await operations.move(from, to);
	};
	const remove = operations.remove ?? ((path) => removeManagedTree(componentRoot, path, "cpolar"));
	const candidate = join(componentRoot, `.install-${randomBytes(12).toString("hex")}`);
	const backup = join(componentRoot, `.previous-${randomBytes(12).toString("hex")}`);
	let backupContainsPrevious = false;
	let replacementInstalled = false;
	try {
		await ensureManagedDirectory(componentRoot, candidate, "cpolar");
		await copyFile(extracted, join(candidate, executableName));
		await chmod(join(candidate, executableName), 448);
		if (await pathExists(componentStorage)) {
			await move(componentStorage, backup);
			backupContainsPrevious = true;
		}
		try {
			await move(candidate, componentStorage);
			replacementInstalled = true;
		} catch (error) {
			if (backupContainsPrevious) try {
				await move(backup, componentStorage);
				backupContainsPrevious = false;
			} catch (rollbackError) {
				process.emitWarning(`cpolar previous component remains at ${backup}; automatic rollback failed`, { code: "DSH_MOBILE_CPOLAR_ROLLBACK_FAILED" });
				throw new Error("cpolar_storage_failed", { cause: new AggregateError([error, rollbackError]) });
			}
			throw error;
		}
	} finally {
		try {
			await remove(candidate);
		} catch {
			process.emitWarning(`cpolar temporary component remains at ${candidate}; cleanup failed`, { code: "DSH_MOBILE_CPOLAR_CLEANUP_FAILED" });
		}
		if (replacementInstalled && backupContainsPrevious) try {
			await remove(backup);
		} catch {
			process.emitWarning(`cpolar previous component remains at ${backup}; cleanup failed`, { code: "DSH_MOBILE_CPOLAR_CLEANUP_FAILED" });
		}
	}
}
/** Remove only this install's staging directory without replacing a preceding failure. */
async function cleanupCpolarInstallStaging(staging, installFailed, remove = (path) => removeManagedTree(dirname(path), path, "cpolar")) {
	try {
		await remove(staging);
	} catch (error) {
		if (installFailed) {
			process.emitWarning(`cpolar staging directory remains at ${staging}; cleanup failed`, { code: "DSH_MOBILE_CPOLAR_CLEANUP_FAILED" });
			return;
		}
		throw new Error("cpolar_storage_failed", { cause: error });
	}
}
async function run(file, args) {
	await new Promise((resolveRun, reject) => {
		execFile(file, [...args], {
			windowsHide: true,
			timeout: 12e4
		}, (error) => {
			if (error === null) resolveRun();
			else reject(error);
		});
	});
}
async function defaultFetchArtifact(url, signal, expectedBytes) {
	return downloadPinnedArtifact({
		url,
		expectedBytes,
		errorPrefix: "cpolar",
		signal
	});
}
async function extractWindowsMsi(archive, destination, executableName) {
	if (process.platform !== "win32") throw new Error("cpolar_component_unsupported");
	const unpacked = join(destination, "archive");
	const administrative = join(destination, "administrative");
	await mkdir(unpacked, {
		recursive: true,
		mode: 448
	});
	await mkdir(administrative, {
		recursive: true,
		mode: 448
	});
	await run("tar.exe", [
		"-xf",
		archive,
		"-C",
		unpacked
	]);
	const msiRelative = (await readdir(unpacked, { recursive: true })).find((entry) => entry.toLowerCase().endsWith(".msi"));
	if (msiRelative === void 0) throw new Error("cpolar_installer_missing");
	await run("msiexec.exe", [
		"/a",
		join(unpacked, msiRelative),
		"/qn",
		`TARGETDIR=${administrative}`
	]);
	const executableRelative = (await readdir(administrative, { recursive: true })).find((entry) => basename(entry).toLowerCase() === executableName.toLowerCase());
	if (executableRelative === void 0) throw new Error("cpolar_executable_missing");
	await copyFile(join(administrative, executableRelative), join(destination, executableName));
}
async function extractLinuxTarball(archive, destination, executableName) {
	const unpacked = join(destination, "archive");
	await mkdir(unpacked, {
		recursive: true,
		mode: 448
	});
	await run(process.platform === "win32" ? "tar.exe" : "tar", [
		"-xzf",
		archive,
		"-C",
		unpacked
	]);
	const executableRelative = (await readdir(unpacked, { recursive: true })).find((entry) => basename(entry).toLowerCase() === executableName.toLowerCase());
	if (executableRelative === void 0) throw new Error("cpolar_executable_missing");
	await copyFile(join(unpacked, executableRelative), join(destination, executableName));
}
async function defaultExtractArtifact(archive, destination, release) {
	if (release.archiveKind === "tar.gz") return extractLinuxTarball(archive, destination, release.executableName);
	return extractWindowsMsi(archive, destination, release.executableName);
}
/** Validate a cpolar Authtoken before it crosses the durable-file boundary. */
function validateCpolarAuthtoken(value) {
	if (typeof value !== "string" || value.length < 20 || value.length > 512 || /[\s\u0000-\u001f\u007f]/u.test(value)) throw new Error("cpolar_authtoken_invalid");
	return value;
}
/** Owns the optional cpolar binary and account configuration inside DSH Mobile state. */
var CpolarComponentManager = class {
	executable;
	configFile;
	componentRoot;
	componentStorage;
	stateRoot;
	logRoot;
	stagingRoot;
	stateDirectory;
	platform;
	arch;
	release;
	fetchArtifact;
	extractArtifact;
	installed = false;
	configured = false;
	errorCode;
	queue = Promise.resolve();
	constructor(options) {
		if (!isAbsolute(options.stateDirectory)) throw new Error("cpolar state directory must be absolute");
		const stateDirectory = resolve(options.stateDirectory);
		this.stateDirectory = stateDirectory;
		this.platform = options.platform ?? process.platform;
		this.arch = options.arch ?? process.arch;
		this.release = CPOLAR_COMPONENT_RELEASES[`${this.platform}-${this.arch}`];
		this.componentRoot = join(stateDirectory, "components", "cpolar");
		this.componentStorage = join(this.componentRoot, this.release?.version ?? CPOLAR_VERSION);
		this.executable = join(this.componentStorage, this.release?.executableName ?? "cpolar");
		this.stateRoot = join(stateDirectory, "state", "cpolar");
		this.configFile = join(this.stateRoot, "cpolar.yml");
		this.logRoot = join(stateDirectory, "logs", "cpolar");
		this.stagingRoot = join(stateDirectory, "staging", "cpolar");
		for (const child of [
			this.componentRoot,
			this.componentStorage,
			this.stateRoot,
			this.logRoot,
			this.stagingRoot
		]) if (!inside(stateDirectory, child)) throw new Error("cpolar component path escaped its state directory");
		const release = this.release;
		this.fetchArtifact = options.fetchArtifact ?? ((url, signal) => defaultFetchArtifact(url, signal, release?.downloadBytes ?? 0));
		this.extractArtifact = options.extractArtifact ?? ((archive, destination) => {
			if (release === void 0) throw new Error("cpolar_component_unsupported");
			return defaultExtractArtifact(archive, destination, release);
		});
	}
	/** Inspect the managed binary and configuration without using global cpolar state. */
	async initialize() {
		const release = this.release;
		this.installed = false;
		this.configured = false;
		this.errorCode = void 0;
		try {
			await assertManagedParents(this.stateDirectory, this.executable, "cpolar");
			await assertManagedParents(this.stateDirectory, this.configFile, "cpolar");
			this.installed = release !== void 0 && await regularFile(this.executable, release.executableBytes);
			if (this.installed && release !== void 0 && await sha256(this.executable) !== release.executableSha256) {
				this.installed = false;
				this.errorCode = "cpolar_component_invalid";
			}
			this.configured = await regularFile(this.configFile);
			if (this.configured) await restrictPrivateFile(this.configFile);
		} catch (_error) {
			this.installed = false;
			this.configured = false;
			this.errorCode = "cpolar_component_invalid";
		}
	}
	/** Return a safe status that never includes the account token. */
	status() {
		const release = this.release ?? CPOLAR_COMPONENT_RELEASE;
		return Object.freeze({
			supported: this.release !== void 0,
			installed: this.installed,
			configured: this.configured,
			version: release.version,
			downloadBytes: release.downloadBytes,
			installedBytes: release.executableBytes,
			sourceUrl: release.downloadUrl,
			downloadPage: DOWNLOAD_PAGE,
			signupUrl: SIGNUP_URL,
			dashboardUrl: DASHBOARD_URL,
			termsUrl: TERMS_URL,
			storagePath: this.componentRoot,
			...this.errorCode === void 0 ? {} : { errorCode: this.errorCode }
		});
	}
	/** Download, verify, and administratively extract cpolar after explicit confirmation. */
	install() {
		return this.enqueue(async () => {
			const release = this.release;
			if (release === void 0) throw new Error("cpolar_component_unsupported");
			await assertManagedParents(this.stateDirectory, this.executable, "cpolar");
			const staging = await installStep("cpolar_storage_failed", async () => {
				await ensureManagedDirectory(this.stateDirectory, this.stagingRoot, "cpolar");
				return mkdtemp(join(this.stagingRoot, "install-"));
			});
			let installFailed = false;
			try {
				const controller = new AbortController();
				const timeout = setTimeout(() => {
					controller.abort();
				}, 12e4);
				timeout.unref();
				let bytes;
				try {
					bytes = await installStep("cpolar_download_failed", () => this.fetchArtifact(release.downloadUrl, controller.signal));
				} catch (error) {
					if (controller.signal.aborted) throw new Error("cpolar_download_timeout", { cause: error });
					throw error;
				} finally {
					clearTimeout(timeout);
				}
				if (createHash("sha256").update(bytes).digest("hex") !== release.downloadSha256) throw new Error("cpolar_download_hash_mismatch");
				const archive = join(staging, release.archiveKind === "tar.gz" ? "cpolar.tar.gz" : "cpolar.zip");
				await installStep("cpolar_storage_failed", () => writeFile(archive, bytes, {
					flag: "wx",
					mode: 384
				}));
				await installStep("cpolar_extract_failed", () => this.extractArtifact(archive, staging));
				const extracted = join(staging, release.executableName);
				if (!await installStep("cpolar_extract_failed", async () => await regularFile(extracted, release.executableBytes) && await sha256(extracted) === release.executableSha256)) throw new Error("cpolar_executable_hash_mismatch");
				await installStep("cpolar_storage_failed", async () => {
					await ensureManagedDirectory(this.stateDirectory, this.componentRoot, "cpolar");
					await assertManagedParents(this.stateDirectory, this.executable, "cpolar");
					await publishVerifiedCpolarExecutable(extracted, this.componentRoot, this.componentStorage, release.executableName);
				});
				this.installed = true;
				this.errorCode = void 0;
			} catch (error) {
				installFailed = true;
				try {
					await assertManagedParents(this.stateDirectory, this.executable, "cpolar");
					this.installed = await regularFile(this.executable, release.executableBytes) && await sha256(this.executable) === release.executableSha256;
				} catch (_inspectionError) {
					this.installed = false;
				}
				throw error;
			} finally {
				await cleanupCpolarInstallStaging(staging, installFailed, (path) => removeManagedTree(this.stateDirectory, path, "cpolar"));
			}
		});
	}
	/** Store only the cpolar token in a private, self-update-disabled configuration. */
	configure(authtoken) {
		return this.enqueue(async () => {
			const token = validateCpolarAuthtoken(authtoken);
			const body = `authtoken: ${JSON.stringify(token)}\nconsole_ui: false\nupdate: false\ninspect_db_size: -1\n`;
			await writeManagedPrivateFile(this.stateDirectory, this.configFile, body, "cpolar");
			this.configured = true;
			this.errorCode = void 0;
		});
	}
	/** Remove every cpolar file owned by DSH Mobile without touching global state. */
	purge() {
		return this.enqueue(async () => {
			await removeManagedPaths(this.stateDirectory, [
				this.componentRoot,
				this.stateRoot,
				this.logRoot,
				this.stagingRoot
			], "cpolar");
			this.installed = false;
			this.configured = false;
			this.errorCode = void 0;
		});
	}
	enqueue(operation) {
		const task = this.queue.then(operation, operation);
		this.queue = task.then(() => void 0, () => void 0);
		return task.then(() => this.status());
	}
};
//#endregion
//#region src/caddy-files.ts
/** Refuse link-shaped ancestors within Caddy's owned state root. */
async function assertCaddyParents(root, target) {
	await assertManagedParents(root, target, "caddy");
}
/** Move a Caddy-owned path, preserving bounded Windows retries and ownership checks. */
async function renameCaddyPath(root, source, destination) {
	await renameManagedPath(root, source, destination, "caddy");
}
/** Create a real Caddy directory, securing fresh directories and preserving existing ACLs. */
async function ensureCaddyDirectory(root, directory) {
	await ensureManagedDirectory(root, directory, "caddy");
}
/** Atomically replace one private Caddy configuration file. */
async function writeCaddyPrivateFile(root, file, body) {
	await writeManagedPrivateFile(root, file, body, "caddy");
}
/** Delete only Caddy-owned children; unlink junctions and symlinks themselves. */
async function removeCaddyTree(root, target) {
	await removeManagedTree(root, target, "caddy");
}
//#endregion
//#region src/caddy-component.ts
const CADDY_VERSION = "2.11.6";
const CADDY_DNS_PLUGIN_VERSION = "v0.4.3";
const CADDY_DOWNLOAD_PAGE = "https://caddyserver.com/download";
const CADDY_COMPONENT_RELEASES = Object.freeze({});
Object.freeze({
	version: CADDY_VERSION,
	dnsPluginVersion: CADDY_DNS_PLUGIN_VERSION
});
function isCaddyDnsProvider(value) {
	return value === "tencentcloud";
}
async function digest(file) {
	return createHash("sha256").update(await readFile(file)).digest("hex");
}
/** Minimal process environment for version/module checks, without ambient API credentials or proxy overrides. */
function caddyInspectionEnvironment(environment = process.env) {
	const result = {};
	for (const name of [
		"SystemRoot",
		"WINDIR",
		"TEMP",
		"TMP",
		"LANG",
		"LC_ALL"
	]) if (environment[name] !== void 0) result[name] = environment[name];
	return result;
}
async function inspect(executable) {
	const options = {
		env: caddyInspectionEnvironment(),
		timeout: 15e3,
		maxBuffer: 262144
	};
	return {
		version: (await execFileText(executable, ["version"], options)).stdout.trim(),
		modules: (await execFileText(executable, ["list-modules", "--versions"], options)).stdout
	};
}
/** Owns only the optional pinned executable; runtime configuration belongs to CaddyConfigStore. */
var CaddyComponentManager = class {
	executable;
	componentRoot;
	componentStorage;
	logRoot;
	stateDirectory;
	stagingRoot;
	artifact;
	fetchArtifact;
	inspectExecutable;
	promote;
	installed = false;
	errorCode;
	queue = Promise.resolve();
	constructor(options) {
		if (!isAbsolute(options.stateDirectory)) throw new Error("caddy state directory must be absolute");
		this.stateDirectory = resolve(options.stateDirectory);
		const platform = options.platform ?? process.platform;
		const arch = options.arch ?? process.arch;
		const artifact = options.artifact ?? CADDY_COMPONENT_RELEASES[`${platform}-${arch}`];
		if (artifact !== void 0 && (artifact.platform !== platform || artifact.arch !== arch || !/^https:\/\//u.test(artifact.downloadUrl) || !/^[a-f0-9]{64}$/u.test(artifact.downloadSha256) || !/^[a-f0-9]{64}$/u.test(artifact.executableSha256) || artifact.downloadBytes < 1 || artifact.executableBytes < 1 || !/^[a-z0-9.-]+$/u.test(artifact.executableName))) throw new Error("caddy_artifact_invalid");
		this.artifact = artifact;
		this.componentRoot = join(this.stateDirectory, "components", "caddy");
		this.componentStorage = join(this.componentRoot, artifact?.version ?? "2.11.6");
		this.executable = join(this.componentStorage, artifact?.executableName ?? (platform === "win32" ? "caddy.exe" : "caddy"));
		this.logRoot = join(this.stateDirectory, "caddy", "logs");
		this.stagingRoot = join(this.stateDirectory, "staging", "caddy");
		this.fetchArtifact = options.fetchArtifact ?? ((url, signal) => downloadPinnedArtifact({
			url,
			signal,
			expectedBytes: artifact?.downloadBytes ?? 0,
			errorPrefix: "caddy"
		}));
		this.inspectExecutable = options.inspectExecutable ?? inspect;
		this.promote = options.promoteDirectory ?? ((source, destination) => renameCaddyPath(this.stateDirectory, source, destination));
	}
	/** Recheck a pinned executable before launching; no unverified local binary can run. */
	async ensureExecutable() {
		const artifact = this.artifact;
		if (artifact === void 0) throw new Error("caddy_component_unavailable");
		await assertCaddyParents(this.stateDirectory, this.executable);
		const entry = await lstat(this.executable);
		if (!entry.isFile() || entry.isSymbolicLink() || entry.size !== artifact.executableBytes || await digest(this.executable) !== artifact.executableSha256) throw new Error("caddy_component_invalid");
		await this.verifyMetadata(this.executable, artifact);
	}
	async initialize() {
		this.installed = false;
		this.errorCode = void 0;
		if (this.artifact === void 0) {
			this.errorCode = "caddy_component_unavailable";
			return;
		}
		try {
			await this.ensureExecutable();
			this.installed = true;
		} catch (error) {
			if (error.code !== "ENOENT") this.errorCode = "caddy_component_invalid";
		}
	}
	status() {
		const artifact = this.artifact;
		return Object.freeze({
			supported: artifact !== void 0,
			installed: this.installed,
			version: artifact?.version ?? "2.11.6",
			downloadBytes: artifact?.downloadBytes ?? 0,
			installedBytes: this.installed ? artifact?.executableBytes ?? 0 : 0,
			sourceUrl: artifact?.downloadUrl ?? "https://caddyserver.com/download",
			downloadPage: CADDY_DOWNLOAD_PAGE,
			storagePath: this.componentRoot,
			...this.errorCode === void 0 ? {} : { errorCode: this.errorCode }
		});
	}
	/** Explicit installation verifies bytes and reported modules before preserving-old promotion. */
	install() {
		return this.enqueue(async () => {
			const artifact = this.artifact;
			if (artifact === void 0) throw new Error("caddy_component_unavailable");
			await ensureCaddyDirectory(this.stateDirectory, this.stagingRoot);
			await ensureCaddyDirectory(this.stateDirectory, this.componentRoot);
			const staging = await mkdtemp(join(this.stagingRoot, "install-"));
			const candidate = join(this.componentRoot, ".install-" + randomBytes(12).toString("hex"));
			const backup = join(this.componentRoot, ".previous-" + randomBytes(12).toString("hex"));
			let previous = false;
			let promoted = false;
			let failed = false;
			try {
				const controller = new AbortController();
				const timeout = setTimeout(() => {
					controller.abort();
				}, 6e5);
				timeout.unref();
				let bytes;
				try {
					bytes = await this.fetchArtifact(artifact.downloadUrl, controller.signal);
				} finally {
					clearTimeout(timeout);
				}
				if (bytes.byteLength !== artifact.downloadBytes) throw new Error("caddy_download_size_mismatch");
				if (createHash("sha256").update(bytes).digest("hex") !== artifact.downloadSha256) throw new Error("caddy_download_hash_mismatch");
				await ensureCaddyDirectory(this.stateDirectory, candidate);
				const executable = join(candidate, artifact.executableName);
				await writeFile(executable, bytes, {
					flag: "wx",
					mode: 448
				});
				await chmod(executable, 448);
				if (bytes.byteLength !== artifact.executableBytes || await digest(executable) !== artifact.executableSha256) throw new Error("caddy_executable_hash_mismatch");
				await this.verifyMetadata(executable, artifact);
				try {
					const entry = await lstat(this.componentStorage);
					if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error("caddy_path_invalid");
					await renameCaddyPath(this.stateDirectory, this.componentStorage, backup);
					previous = true;
				} catch (error) {
					if (error.code !== "ENOENT") throw error;
				}
				try {
					await this.promote(candidate, this.componentStorage);
					promoted = true;
				} catch (error) {
					if (previous) try {
						await renameCaddyPath(this.stateDirectory, backup, this.componentStorage);
						previous = false;
					} catch (rollbackError) {
						this.installed = false;
						this.errorCode = "caddy_component_invalid";
						throw new AggregateError([error, rollbackError], "caddy_component_rollback_failed", { cause: error });
					}
					throw error;
				}
				this.installed = true;
				this.errorCode = void 0;
			} catch (error) {
				failed = true;
				throw error;
			} finally {
				let cleanupError;
				for (const path of [
					staging,
					candidate,
					...previous && promoted ? [backup] : []
				]) try {
					await removeCaddyTree(this.stateDirectory, path);
				} catch (error) {
					cleanupError ??= error;
				}
				if (!failed && cleanupError !== void 0) throw cleanupError;
			}
		});
	}
	/** Remove optional component files; callers stop the controller and purge runtime configuration separately. */
	purge() {
		return this.enqueue(async () => {
			await removeCaddyTree(this.stateDirectory, this.componentRoot);
			await removeCaddyTree(this.stateDirectory, this.stagingRoot);
			this.installed = false;
			this.errorCode = this.artifact === void 0 ? "caddy_component_unavailable" : void 0;
		});
	}
	async verifyMetadata(executable, artifact) {
		const info = await this.inspectExecutable(executable);
		if (!info.version.startsWith("v" + artifact.version + " ")) throw new Error("caddy_executable_version_mismatch");
		const nonstandard = info.modules.split(/\r?\n/u).filter((line) => line.startsWith("dns.providers."));
		if (nonstandard.length !== 1 || nonstandard[0] !== "dns.providers.tencentcloud " + artifact.dnsPluginVersion || !info.modules.includes("Non-standard modules: 1")) throw new Error("caddy_executable_modules_mismatch");
	}
	enqueue(operation) {
		const task = this.queue.then(operation, operation);
		this.queue = task.then(() => void 0, () => void 0);
		return task.then(() => this.status());
	}
};
const MAX_CONFIG_BYTES = 16384;
/** Inject only the DNS credentials needed by the managed child. */
function caddyCredentialEnvironment(provider, credentials) {
	if (!isCaddyDnsProvider(provider)) throw new Error("caddy_dns_provider_invalid");
	return {
		TENCENTCLOUD_SECRET_ID: credentials.secretId,
		TENCENTCLOUD_SECRET_KEY: credentials.secretKey
	};
}
/** Validate saved or administrative settings, including ports reserved by DSH. */
function parseCaddySettings(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("caddy_settings_invalid");
	const record = value;
	if (Reflect.ownKeys(record).some((key) => ![
		"version",
		"publicOrigin",
		"dnsProvider",
		"listenPort"
	].includes(String(key))) || record.version !== void 0 && record.version !== 1) throw new Error("caddy_settings_invalid");
	if (!isCaddyDnsProvider(record.dnsProvider)) throw new Error("caddy_dns_provider_invalid");
	const listenPort = record.listenPort ?? 8443;
	if (!Number.isSafeInteger(listenPort) || Number(listenPort) < 1024 || Number(listenPort) > 65535) throw new Error("caddy_listen_port_invalid");
	if ([
		3444,
		3443,
		3080
	].includes(Number(listenPort))) throw new Error("caddy_listen_port_reserved");
	const publicOrigin = validateOriginPublicOrigin(record.publicOrigin);
	if (isIP(new URL(publicOrigin).hostname) !== 0) throw new Error("caddy_domain_required");
	return Object.freeze({
		version: 1,
		publicOrigin,
		dnsProvider: record.dnsProvider,
		listenPort: Number(listenPort)
	});
}
function parseCredentials(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("caddy_credentials_invalid");
	const record = value;
	if (Reflect.ownKeys(record).some((key) => key !== "secretId" && key !== "secretKey")) throw new Error("caddy_credentials_invalid");
	const { secretId, secretKey } = record;
	if (typeof secretId !== "string" || typeof secretKey !== "string" || secretId.length === 0 || secretKey.length === 0 || secretId.length > 512 || secretKey.length > 512 || /[\s\u0000-\u001f\u007f]/u.test(secretId + secretKey)) throw new Error("caddy_credentials_invalid");
	return Object.freeze({
		secretId,
		secretKey
	});
}
/** Render a single TLS site, with no admin API, config autosave, or embedded DNS secrets. */
function renderCaddyfile(settings, stateDirectory, backendPort = 3444) {
	const validated = parseCaddySettings(settings);
	if (!Number.isSafeInteger(backendPort) || backendPort < 1 || backendPort > 65535) throw new Error("caddy_backend_port_invalid");
	const root = resolve(stateDirectory, "caddy");
	const dataDirectory = join(root, "data").replaceAll("\\", "/");
	const hostname = new URL(validated.publicOrigin).hostname;
	return [
		"{",
		"	admin off",
		"	persist_config off",
		"	auto_https disable_redirects",
		`\tstorage file_system ${JSON.stringify(dataDirectory)}`,
		"	log {",
		"		output discard",
		"	}",
		"}",
		"",
		`https://${hostname}:${String(validated.listenPort)} {`,
		"	tls {",
		"		dns tencentcloud {",
		"			secret_id {env.TENCENTCLOUD_SECRET_ID}",
		"			secret_key {env.TENCENTCLOUD_SECRET_KEY}",
		"		}",
		"	}",
		`\treverse_proxy 127.0.0.1:${String(backendPort)} {`,
		"		header_up Host {http.request.hostport}",
		"		transport http {",
		"			keepalive off",
		"			dial_timeout 5s",
		"		}",
		"	}",
		"}",
		""
	].join("\n");
}
/** Owns one atomic configuration record and every Caddy-created private file. */
var CaddyConfigStore = class {
	stateDirectory;
	rootDirectory;
	settingsFile;
	envFile;
	caddyfile;
	dataDirectory;
	configDirectory;
	logsDirectory;
	settingsValue;
	credentialsValue;
	errorCodeValue;
	queue = Promise.resolve();
	constructor(stateDirectory) {
		this.stateDirectory = stateDirectory;
		if (!isAbsolute(stateDirectory)) throw new Error("caddy config state directory must be absolute");
		this.rootDirectory = resolve(stateDirectory, "caddy");
		this.settingsFile = join(this.rootDirectory, "config.json");
		this.envFile = this.settingsFile;
		this.caddyfile = join(this.rootDirectory, "Caddyfile");
		this.dataDirectory = join(this.rootDirectory, "data");
		this.configDirectory = join(this.rootDirectory, "xdg-config");
		this.logsDirectory = join(this.rootDirectory, "logs");
	}
	settings() {
		return this.settingsValue;
	}
	credentials() {
		return this.credentialsValue;
	}
	errorCode() {
		return this.errorCodeValue;
	}
	status() {
		const settings = this.settingsValue;
		return Object.freeze({
			configured: settings !== void 0 && this.credentialsValue !== void 0,
			credentialsConfigured: this.credentialsValue !== void 0,
			storagePath: this.rootDirectory,
			...settings === void 0 ? {} : {
				publicOrigin: settings.publicOrigin,
				listenPort: settings.listenPort,
				dnsProvider: settings.dnsProvider
			},
			...this.errorCodeValue === void 0 ? {} : { errorCode: this.errorCodeValue }
		});
	}
	async initialize() {
		await this.enqueue(async () => {
			this.settingsValue = void 0;
			this.credentialsValue = void 0;
			this.errorCodeValue = void 0;
			await assertCaddyParents(this.stateDirectory, this.settingsFile);
			let entry;
			try {
				entry = await lstat(this.settingsFile);
			} catch (error) {
				if (error.code === "ENOENT") return;
				throw error;
			}
			if (!entry.isFile() || entry.isSymbolicLink() || entry.size > MAX_CONFIG_BYTES) {
				this.errorCodeValue = "caddy_config_invalid";
				return;
			}
			await restrictPrivateFile(this.settingsFile);
			try {
				const record = JSON.parse(await readFile(this.settingsFile, "utf8"));
				if (typeof record !== "object" || record === null || Array.isArray(record)) throw new Error("invalid");
				const values = record;
				if (Reflect.ownKeys(values).some((key) => key !== "settings" && key !== "credentials")) throw new Error("invalid");
				const settings = parseCaddySettings(values.settings);
				const credentials = parseCredentials(values.credentials);
				this.settingsValue = settings;
				this.credentialsValue = credentials;
			} catch {
				this.errorCodeValue = "caddy_config_invalid";
			}
		});
	}
	/** Atomically save validated settings and credentials; omitted or both-blank secrets retain saved ones. */
	configure(value, credentialInput) {
		return this.enqueue(async () => {
			const settings = parseCaddySettings(value);
			const blank = typeof credentialInput === "object" && credentialInput !== null && !Array.isArray(credentialInput) && credentialInput.secretId === "" && credentialInput.secretKey === "" && Reflect.ownKeys(credentialInput).every((key) => key === "secretId" || key === "secretKey");
			const credentials = credentialInput === void 0 || blank ? this.credentialsValue : parseCredentials(credentialInput);
			if (credentials === void 0) throw new Error("caddy_credentials_missing");
			await writeCaddyPrivateFile(this.stateDirectory, this.settingsFile, JSON.stringify({
				settings,
				credentials
			}) + "\n");
			this.settingsValue = settings;
			this.credentialsValue = credentials;
			this.errorCodeValue = void 0;
		});
	}
	/** Write derived runtime files after authoritative settings are available. */
	prepareCaddyfile(backendPort) {
		return this.enqueue(async () => {
			const settings = this.settingsValue;
			if (settings === void 0 || this.credentialsValue === void 0) throw new Error("caddy_config_missing");
			for (const directory of [
				this.dataDirectory,
				this.configDirectory,
				this.logsDirectory
			]) await ensureCaddyDirectory(this.stateDirectory, directory);
			await writeCaddyPrivateFile(this.stateDirectory, this.caddyfile, renderCaddyfile(settings, this.stateDirectory, backendPort));
		});
	}
	/** Remove credentials, certificates, private keys, configuration, logs, and runtime cache. */
	purge() {
		return this.enqueue(async () => {
			await removeCaddyTree(this.stateDirectory, this.rootDirectory);
			this.settingsValue = void 0;
			this.credentialsValue = void 0;
			this.errorCodeValue = void 0;
		});
	}
	enqueue(operation) {
		const task = this.queue.then(operation, operation);
		this.queue = task.then(() => void 0, () => void 0);
		return task;
	}
};
//#endregion
//#region src/caddy.ts
/** Private directories override Caddy's platform defaults; ambient API keys and admin/proxy overrides are omitted. */
function caddyProcessEnvironment(config, settings, environment = process.env) {
	const credentials = config.credentials();
	if (credentials === void 0) throw new Error("caddy_credentials_missing");
	return {
		...caddyInspectionEnvironment(environment),
		...caddyCredentialEnvironment(settings.dnsProvider, credentials),
		HOME: config.rootDirectory,
		USERPROFILE: config.rootDirectory,
		APPDATA: config.configDirectory,
		LOCALAPPDATA: config.dataDirectory,
		XDG_DATA_HOME: config.dataDirectory,
		XDG_CONFIG_HOME: config.configDirectory
	};
}
function spawnCaddy(executable, args, environment) {
	return spawn(executable, [...args], {
		env: environment,
		shell: false,
		stdio: [
			"pipe",
			"pipe",
			"pipe"
		],
		windowsHide: true
	});
}
async function validate(executable, caddyfile, environment, signal) {
	try {
		await execFileText(executable, [
			"adapt",
			"--config",
			caddyfile,
			"--adapter",
			"caddyfile"
		], {
			env: environment,
			signal,
			timeout: 15e3,
			maxBuffer: 262144
		});
	} catch {
		throw new Error("caddy_config_validation_failed");
	}
}
/** Owns Caddy and a loopback Gateway until both have stopped; ready requires verified public TLS and instance identity. */
var CaddyController = class {
	options;
	enabled = false;
	initialized = false;
	disposed = false;
	child;
	gatewayValue;
	generation = 0;
	startupAbort;
	latest = Object.freeze({
		enabled: false,
		state: "off"
	});
	queue = Promise.resolve();
	closeTask;
	constructor(options) {
		this.options = options;
	}
	initialize() {
		return this.enqueue(async () => {
			if (this.initialized) return;
			if (this.disposed) throw new Error("caddy_controller_unavailable");
			this.enabled = (await this.options.store.load()).enabled;
			this.initialized = true;
			if (this.enabled) await this.start();
		});
	}
	gateway() {
		return this.latest.state === "ready" ? this.gatewayValue : void 0;
	}
	status() {
		return this.latest;
	}
	/** Cancel a readiness attempt before its owning coordinator waits for queued teardown. */
	cancelPendingStart() {
		this.startupAbort?.abort();
	}
	setEnabled(enabled) {
		if (!enabled) this.startupAbort?.abort();
		return this.enqueue(async () => {
			this.assertAvailable();
			if (this.enabled === enabled && (!enabled || this.latest.state === "ready")) return;
			if (!enabled) await this.stop();
			await this.options.store.save({
				version: 1,
				enabled
			});
			this.enabled = enabled;
			if (enabled) await this.start();
			else this.publish({
				enabled: false,
				state: "off"
			});
		}).then(() => this.status());
	}
	reconnect() {
		this.startupAbort?.abort();
		return this.enqueue(async () => {
			this.assertAvailable();
			await this.stop();
			await this.options.store.save({
				version: 1,
				enabled: true
			});
			this.enabled = true;
			await this.start();
		}).then(() => this.status());
	}
	reset() {
		return this.setEnabled(false);
	}
	close() {
		this.disposed = true;
		this.startupAbort?.abort();
		this.closeTask ??= this.enqueue(async () => {
			await this.stop();
			this.publish({
				enabled: this.enabled,
				state: "off"
			});
		}).catch((error) => {
			this.closeTask = void 0;
			throw error;
		});
		return this.closeTask;
	}
	assertAvailable() {
		if (!this.initialized || this.disposed) throw new Error("caddy_controller_unavailable");
	}
	enqueue(operation) {
		const task = this.queue.then(operation, operation);
		this.queue = task.then(() => void 0, () => void 0);
		return task;
	}
	publish(status) {
		this.latest = Object.freeze(status);
		try {
			this.options.onStatus?.(this.latest);
		} catch {}
	}
	async start() {
		const generation = ++this.generation;
		const startup = new AbortController();
		this.startupAbort = startup;
		const settings = this.options.config.settings();
		if (settings === void 0 || this.options.config.credentials() === void 0) {
			this.publish({
				enabled: true,
				state: "unavailable",
				errorCode: "caddy_config_missing"
			});
			this.startupAbort = void 0;
			return;
		}
		if (!this.options.component.status().supported) {
			this.publish({
				enabled: true,
				state: "unavailable",
				errorCode: "caddy_component_unavailable"
			});
			this.startupAbort = void 0;
			return;
		}
		this.publish({
			enabled: true,
			state: "starting",
			origin: settings.publicOrigin
		});
		let childFailure;
		const deadline = setTimeout(() => {
			startup.abort();
		}, this.options.startupTimeoutMs ?? 12e4);
		deadline.unref();
		try {
			await this.options.component.ensureExecutable();
			if (startup.signal.aborted || this.disposed) throw new Error("caddy_start_cancelled");
			const gateway = await this.options.createGateway(settings);
			this.gatewayValue = gateway;
			if (startup.signal.aborted || this.disposed) throw new Error("caddy_start_cancelled");
			await this.options.config.prepareCaddyfile(gateway.address().port);
			const environment = caddyProcessEnvironment(this.options.config, settings);
			await (this.options.validateConfig ?? validate)(this.options.component.executable, this.options.config.caddyfile, environment, startup.signal);
			if (startup.signal.aborted || this.disposed) throw new Error("caddy_start_cancelled");
			const child = (this.options.spawnProcess ?? spawnCaddy)(this.options.component.executable, [
				"run",
				"--config",
				this.options.config.caddyfile,
				"--adapter",
				"caddyfile"
			], environment);
			this.child = child;
			child.stdout.resume();
			child.stderr.resume();
			child.stdin.end();
			const failed = (code) => {
				if (generation !== this.generation || this.child !== child) return;
				childFailure = code;
				startup.abort();
				if (this.latest.state === "ready") this.enqueue(async () => {
					if (generation !== this.generation) return;
					await this.stop();
					if (this.enabled && !this.disposed) this.publish({
						enabled: true,
						state: "error",
						errorCode: code
					});
				}).catch(() => {
					this.publish({
						enabled: this.enabled,
						state: "error",
						errorCode: "caddy_cleanup_failed"
					});
				});
			};
			child.once("error", () => {
				failed("caddy_launch_failed");
			});
			child.once("close", () => {
				failed("caddy_exited");
			});
			const probe = this.options.probeDiscovery ?? ((origin, expected, signal) => defaultProbeDiscovery({ origin }, expected, signal));
			while (true) {
				if (startup.signal.aborted || this.disposed) throw new Error(childFailure ?? "caddy_start_timeout");
				let ready = false;
				try {
					ready = await probe(settings.publicOrigin, this.options.instanceId, startup.signal);
				} catch (error) {
					if (error instanceof Error && (error.message === "frp_discovery_mismatch" || error.message === "frp_discovery_invalid")) throw new Error("caddy_public_identity_invalid");
				}
				if (startup.signal.aborted || this.disposed || generation !== this.generation) throw new Error(childFailure ?? "caddy_start_timeout");
				if (ready) break;
				await this.waitForProbe(startup.signal);
			}
			this.publish({
				enabled: true,
				state: "ready",
				origin: settings.publicOrigin,
				backendOrigin: "http://127.0.0.1:" + String(gateway.address().port)
			});
		} catch (error) {
			++this.generation;
			await this.stopResources();
			if (!this.disposed) this.publish({
				enabled: this.enabled,
				state: "error",
				errorCode: childFailure ?? (error instanceof Error && error.message.startsWith("caddy_") ? error.message : error.code === "EADDRINUSE" ? "caddy_backend_port_in_use" : "caddy_start_failed")
			});
		} finally {
			clearTimeout(deadline);
			if (this.startupAbort === startup) this.startupAbort = void 0;
		}
	}
	waitForProbe(signal) {
		if (signal.aborted) return Promise.resolve();
		return new Promise((resolve) => {
			const done = () => {
				clearTimeout(timer);
				signal.removeEventListener("abort", done);
				resolve();
			};
			const timer = setTimeout(done, this.options.probeIntervalMs ?? 1e3);
			timer.unref();
			signal.addEventListener("abort", done, { once: true });
		});
	}
	async stop() {
		++this.generation;
		this.startupAbort?.abort();
		await this.stopResources();
	}
	async stopResources() {
		const child = this.child;
		const gateway = this.gatewayValue;
		await settleRemoteResources([async () => {
			if (child !== void 0) {
				await (this.options.terminateProcess ?? terminateRemoteProcess)(child);
				if (this.child === child) this.child = void 0;
			}
		}, async () => {
			if (gateway !== void 0) {
				await gateway.close();
				if (this.gatewayValue === gateway) this.gatewayValue = void 0;
			}
		}], "caddy cleanup failed");
	}
};
//#endregion
//#region src/managed-origin.ts
/** Children never independently restore a durable enabled switch. */
function createVolatileRemoteControlStore() {
	let value = {
		version: 1,
		enabled: false
	};
	return {
		load: async () => value,
		save: async (state) => {
			value = Object.freeze({ ...state });
		}
	};
}
function parseMode(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("origin_mode_invalid");
	const record = value;
	if (record.version !== 1 || record.mode !== "external" && record.mode !== "managed" || Reflect.ownKeys(record).some((key) => key !== "version" && key !== "mode")) throw new Error("origin_mode_invalid");
	return Object.freeze({
		version: 1,
		mode: record.mode
	});
}
/** Persist only origin's upstream mode, defaulting to the existing external-proxy behavior. */
var JsonOriginModeStore = class {
	file;
	constructor(file) {
		this.file = file;
		if (!isAbsolute(file)) throw new Error("origin mode file must be absolute");
	}
	async load() {
		await assertCaddyParents(dirname(this.file), this.file);
		let entry;
		try {
			entry = await lstat(this.file);
		} catch (error) {
			if (error.code === "ENOENT") return {
				version: 1,
				mode: "external"
			};
			throw error;
		}
		if (!entry.isFile() || entry.isSymbolicLink() || entry.size > 1024) throw new Error("origin_mode_invalid");
		await restrictPrivateFile(this.file);
		return parseMode(JSON.parse(await readFile(this.file, "utf8")));
	}
	async save(value) {
		await writeCaddyPrivateFile(dirname(this.file), this.file, JSON.stringify(parseMode(value)) + "\n");
	}
};
/** One origin-provider owner selects exactly one upstream; external settings and shared device records remain untouched. */
var ManagedOriginController = class {
	options;
	selected = "external";
	enabled = false;
	initialized = false;
	disposed = false;
	queue = Promise.resolve();
	closeTask;
	constructor(options) {
		this.options = options;
	}
	mode() {
		return this.selected;
	}
	status() {
		return Object.freeze({
			...this.controller().status(),
			enabled: this.enabled,
			mode: this.selected
		});
	}
	gateway() {
		return this.enabled ? this.controller().gateway() : void 0;
	}
	initialize() {
		return this.enqueue(async () => {
			if (this.initialized) return;
			if (this.disposed) throw new Error("origin_controller_unavailable");
			this.selected = (await this.options.modeStore.load()).mode;
			this.enabled = (await this.options.store.load()).enabled;
			await this.options.external.initialize();
			await this.options.managed.initialize();
			await this.options.external.setEnabled(false);
			await this.options.managed.setEnabled(false);
			this.initialized = true;
			if (this.enabled && !this.disposed) await this.controller().setEnabled(true);
		});
	}
	selectMode(mode) {
		if (mode !== this.selected) this.options.managed.cancelPendingStart?.();
		return this.enqueue(async () => {
			this.assertAvailable();
			if (mode !== "external" && mode !== "managed") throw new Error("origin_mode_invalid");
			if (mode === this.selected) return;
			const previous = this.controller();
			await previous.setEnabled(false);
			try {
				await this.options.modeStore.save({
					version: 1,
					mode
				});
			} catch (error) {
				if (this.enabled && !this.disposed) await previous.setEnabled(true);
				throw error;
			}
			this.selected = mode;
			if (this.enabled && !this.disposed) try {
				await this.controller().setEnabled(true);
			} catch (error) {
				await this.stopBoth();
				throw error;
			}
		}).then(() => this.status());
	}
	setEnabled(enabled) {
		if (!enabled) this.options.managed.cancelPendingStart?.();
		return this.enqueue(async () => {
			this.assertAvailable();
			if (!enabled) await this.stopBoth();
			await this.options.store.save({
				version: 1,
				enabled
			});
			this.enabled = enabled;
			if (enabled && !this.disposed) try {
				await this.controller().setEnabled(true);
			} catch (error) {
				await this.stopBoth();
				throw error;
			}
		}).then(() => this.status());
	}
	reconnect() {
		this.options.managed.cancelPendingStart?.();
		return this.enqueue(async () => {
			this.assertAvailable();
			await this.stopBoth();
			await this.options.store.save({
				version: 1,
				enabled: true
			});
			this.enabled = true;
			if (!this.disposed) try {
				await this.controller().reconnect();
			} catch (error) {
				await this.stopBoth();
				throw error;
			}
		}).then(() => this.status());
	}
	reset() {
		return this.setEnabled(false);
	}
	close() {
		this.disposed = true;
		this.closeTask ??= settleRemoteResources([() => this.options.external.close(), () => this.options.managed.close()]).then(() => this.queue).catch((error) => {
			this.closeTask = void 0;
			throw error;
		});
		return this.closeTask;
	}
	controller() {
		return this.options[this.selected];
	}
	assertAvailable() {
		if (!this.initialized || this.disposed) throw new Error("origin_controller_unavailable");
	}
	stopBoth() {
		return settleRemoteResources([async () => {
			await this.options.external.setEnabled(false);
		}, async () => {
			await this.options.managed.setEnabled(false);
		}]);
	}
	enqueue(operation) {
		const task = this.queue.then(operation, operation);
		this.queue = task.then(() => void 0, () => void 0);
		return task;
	}
};
//#endregion
//#region src/release-update.ts
const PACKAGE_NAME = "dsh-mobile";
const NPM_LATEST_URL = "https://registry.npmjs.org/dsh-mobile/latest";
const ANDROID_RELEASE_DESCRIPTOR_URL = "https://raw.githubusercontent.com/saya-ch/dsh-mobile/main/apps/mobile/release.json";
const GITHUB_RELEASE_API = "https://api.github.com/repos/saya-ch/dsh-mobile/releases/tags/";
const GITHUB_RELEASES_URL = "https://github.com/saya-ch/dsh-mobile/releases";
const RELEASE_NOTES_MAX_CHARS = 4e3;
const STATUS_CACHE_MS = 6e5;
const REQUEST_TIMEOUT_MS = 8e3;
const UPDATE_TIMEOUT_MS = 12e4;
const UPDATE_TERMINATION_GRACE_MS = 1500;
const bundledAndroidRelease = createRequire(import.meta.url)("../apps/mobile/release.json");
const NUMERIC_VERSION_IDENTIFIER = "(?:0|[1-9]\\d*)";
const WILDCARD_VERSION_IDENTIFIER = "(?:[xX*])";
const RANGE_VERSION = `(?:${`${NUMERIC_VERSION_IDENTIFIER}\\.${NUMERIC_VERSION_IDENTIFIER}\\.${NUMERIC_VERSION_IDENTIFIER}(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?`}|${`(?:${WILDCARD_VERSION_IDENTIFIER}|${NUMERIC_VERSION_IDENTIFIER}(?:\\.(?:${WILDCARD_VERSION_IDENTIFIER}|${NUMERIC_VERSION_IDENTIFIER}(?:\\.(?:${WILDCARD_VERSION_IDENTIFIER}|${NUMERIC_VERSION_IDENTIFIER}))?))?)`})`;
const COMPARATOR = new RegExp(`^(?:<=|>=|<|>|=|~|\\^)?${RANGE_VERSION}$`, "u");
const HYPHEN_RANGE = new RegExp(`^${RANGE_VERSION} +[-] +${RANGE_VERSION}$`, "u");
const DIST_TAG = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/u;
function parseSemver(value) {
	const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/u.exec(value);
	if (match === null) return void 0;
	const core = [
		Number(match[1]),
		Number(match[2]),
		Number(match[3])
	];
	if (core.some((part) => !Number.isSafeInteger(part))) return void 0;
	const prerelease = match[4] === void 0 ? [] : match[4].split(".").map((part) => /^\d+$/u.test(part) ? Number(part) : part);
	if (prerelease.some((part) => typeof part === "number" && !Number.isSafeInteger(part))) return void 0;
	return Object.freeze({
		core,
		prerelease: Object.freeze(prerelease)
	});
}
/** Compare two strict SemVer strings, including prerelease precedence. */
function comparePluginVersions(left, right) {
	const a = parseSemver(left);
	const b = parseSemver(right);
	if (a === void 0 || b === void 0) return void 0;
	for (let index = 0; index < a.core.length; index += 1) {
		const difference = a.core[index] - b.core[index];
		if (difference !== 0) return Math.sign(difference);
	}
	if (a.prerelease.length === 0 || b.prerelease.length === 0) return a.prerelease.length === b.prerelease.length ? 0 : a.prerelease.length === 0 ? 1 : -1;
	const length = Math.max(a.prerelease.length, b.prerelease.length);
	for (let index = 0; index < length; index += 1) {
		const leftPart = a.prerelease[index];
		const rightPart = b.prerelease[index];
		if (leftPart === void 0 || rightPart === void 0) return leftPart === void 0 ? -1 : 1;
		if (leftPart === rightPart) continue;
		if (typeof leftPart === "number" && typeof rightPart === "number") return Math.sign(leftPart - rightPart);
		if (typeof leftPart === "number") return -1;
		if (typeof rightPart === "number") return 1;
		return leftPart < rightPart ? -1 : 1;
	}
	return 0;
}
function isComparatorSet(value) {
	if (HYPHEN_RANGE.test(value)) return true;
	const comparators = value.replace(/(<=|>=|<|>|=|~|\^) +/gu, "$1").split(/ +/u);
	return comparators.length > 0 && comparators.every((comparator) => COMPARATOR.test(comparator));
}
function isNpmVersionRange(value) {
	if (!/^[0-9xX*<>=~^|.+\- ]+$/u.test(value)) return false;
	const alternatives = value.split(/ *\|\| */u);
	return alternatives.length > 0 && alternatives.every((alternative) => alternative !== "" && isComparatorSet(alternative));
}
/** Return whether pnpm may safely replace this profile dependency from an npm version, range, or tag. */
function isRegistryPluginSpec(value) {
	if (typeof value !== "string" || value.trim() !== value || value === "" || /[\u0000-\u001f\u007f]/u.test(value)) return false;
	if (/\.(?:tgz|tar(?:\.gz)?)$/iu.test(value)) return false;
	return parseSemver(value) !== void 0 || isNpmVersionRange(value) || DIST_TAG.test(value);
}
/** Resolve the DSH profile named by the current launcher arguments. */
function launchedProfileName(argv) {
	for (let index = 0; index < argv.length; index += 1) {
		if (argv[index] === "--profile") {
			const candidate = argv[index + 1];
			if (candidate !== void 0 && /^[\w.-]+$/u.test(candidate)) return candidate;
		}
		const match = /^--profile=([\w.-]+)$/u.exec(argv[index] ?? "");
		if (match?.[1] !== void 0) return match[1];
	}
	return "web";
}
/** Resolve the launcher-owned Desktop profile, or the CLI profile outside Desktop. */
function releaseProfileDirectory(ctx, dshHome, argv) {
	const desktopProfiles = ctx.get("desktopProfiles");
	const desktopDirectory = desktopProfiles?.current?.dir;
	if (typeof desktopDirectory === "string" && isAbsolute(desktopDirectory)) return desktopDirectory;
	if (desktopProfiles !== void 0 || ctx.get("desktopRuntime") !== void 0) return void 0;
	return join(dshHome, "profiles", launchedProfileName(argv));
}
async function profileDependencySpec(profileDirectory) {
	try {
		const value = JSON.parse(await readFile(join(profileDirectory, "package.json"), "utf8")).dependencies?.[PACKAGE_NAME];
		return typeof value === "string" ? value : void 0;
	} catch {
		return;
	}
}
async function fetchNpmVersion(fetcher) {
	const response = await fetcher(NPM_LATEST_URL, {
		headers: {
			accept: "application/json",
			"user-agent": "dsh-mobile-release-check"
		},
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
	});
	if (!response.ok) return void 0;
	const payload = await response.json();
	return typeof payload.version === "string" && parseSemver(payload.version) !== void 0 ? payload.version : void 0;
}
function androidRelease(version, tag) {
	if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(version) || parseSemver(version) === void 0 || tag !== `v${version}` && tag !== `android-v${version}`) return void 0;
	return Object.freeze({
		version,
		downloadUrl: `https://github.com/saya-ch/dsh-mobile/releases/download/${tag}/dsh-mobile-android-v${version}.apk`
	});
}
function androidReleaseDescriptor(payload) {
	if (typeof payload !== "object" || payload === null) return void 0;
	const fields = payload;
	return Number.isSafeInteger(fields.versionCode) && Number(fields.versionCode) > 0 ? androidRelease(fields.version, fields.releaseTag) : void 0;
}
async function fetchAndroidRelease(fetcher) {
	const fallback = androidReleaseDescriptor(bundledAndroidRelease);
	try {
		const response = await fetcher(ANDROID_RELEASE_DESCRIPTOR_URL, {
			redirect: "error",
			headers: {
				accept: "application/json",
				"user-agent": "dsh-mobile-release-check"
			},
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
		});
		if (response.ok) {
			const release = androidReleaseDescriptor(await response.json());
			if (release !== void 0) return fallback !== void 0 && comparePluginVersions(release.version, fallback.version) === -1 ? fallback : release;
		}
	} catch {}
	return fallback;
}
/** Best-effort body of the selected npm version's GitHub release, trimmed to a bounded size. */
async function fetchReleaseNotes(fetcher, version) {
	const response = await fetcher(`${GITHUB_RELEASE_API}${encodeURIComponent(`v${version}`)}`, {
		headers: {
			accept: "application/vnd.github+json",
			"user-agent": "dsh-mobile-release-check"
		},
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
	});
	if (!response.ok) return void 0;
	const payload = await response.json();
	if (typeof payload.body !== "string") return void 0;
	const notes = payload.body.trim();
	return notes === "" ? void 0 : notes.slice(0, RELEASE_NOTES_MAX_CHARS);
}
async function readProfileInstalledVersion(profileDirectory) {
	try {
		const manifestPath = createRequire(join(profileDirectory, "package.json")).resolve(`${PACKAGE_NAME}/package.json`);
		const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
		return typeof manifest.version === "string" ? manifest.version : void 0;
	} catch {
		return;
	}
}
function childCompletion(child) {
	return new Promise((resolveCompletion, rejectCompletion) => {
		child.once("error", rejectCompletion);
		child.once("close", (code, signal) => {
			resolveCompletion({
				code,
				signal
			});
		});
	});
}
function createDeadline(timeoutMs) {
	let timer;
	return {
		promise: new Promise((resolveTimeout) => {
			timer = setTimeout(resolveTimeout, timeoutMs);
			timer.unref();
		}),
		cancel: () => {
			if (timer !== void 0) clearTimeout(timer);
			timer = void 0;
		}
	};
}
async function taskkillProcessTree(pid) {
	if ((await childCompletion(spawn("taskkill.exe", [
		"/PID",
		String(pid),
		"/T",
		"/F"
	], {
		shell: false,
		windowsHide: true,
		stdio: "ignore"
	}))).code !== 0) throw new Error("plugin_update_tree_termination_failed");
}
async function completionWithin(completion, timeoutMs) {
	let timer;
	try {
		return await Promise.race([completion.then(() => true, () => true), new Promise((resolveTimeout) => {
			timer = setTimeout(() => {
				resolveTimeout(false);
			}, timeoutMs);
			timer.unref();
		})]);
	} finally {
		if (timer !== void 0) clearTimeout(timer);
	}
}
function processMissing(error) {
	return error.code === "ESRCH";
}
async function terminateProcessTree(child, completion, platform) {
	if (child.exitCode !== null || child.signalCode !== null) return;
	const pid = child.pid;
	if (pid === void 0) {
		child.kill("SIGKILL");
		if (!await completionWithin(completion, UPDATE_TERMINATION_GRACE_MS)) throw new Error("plugin_update_tree_termination_timeout");
		return;
	}
	if (platform === "win32") {
		try {
			await taskkillProcessTree(pid);
		} catch (error) {
			if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
			if (!await completionWithin(completion, UPDATE_TERMINATION_GRACE_MS)) throw new AggregateError([error, /* @__PURE__ */ new Error("plugin_update_tree_termination_timeout")], "plugin update tree termination failed");
			throw error;
		}
		if (!await completionWithin(completion, UPDATE_TERMINATION_GRACE_MS)) {
			if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
			if (!await completionWithin(completion, UPDATE_TERMINATION_GRACE_MS)) throw new Error("plugin_update_tree_termination_timeout");
		}
		return;
	}
	try {
		process.kill(-pid, "SIGTERM");
	} catch (error) {
		if (!processMissing(error)) throw error;
		if (!await completionWithin(completion, UPDATE_TERMINATION_GRACE_MS)) throw new Error("plugin_update_tree_termination_timeout");
		return;
	}
	if (await completionWithin(completion, UPDATE_TERMINATION_GRACE_MS)) return;
	try {
		process.kill(-pid, "SIGKILL");
	} catch (error) {
		if (!processMissing(error)) throw error;
	}
	if (!await completionWithin(completion, UPDATE_TERMINATION_GRACE_MS)) throw new Error("plugin_update_tree_termination_timeout");
}
function startUpdateProcess(request) {
	const child = spawn(request.command, [...request.args], {
		cwd: request.cwd,
		detached: request.detached,
		shell: request.shell,
		windowsHide: true,
		stdio: [
			"ignore",
			"ignore",
			"pipe"
		]
	});
	const completion = childCompletion(child);
	return {
		completion,
		...child.stderr === null ? {} : { stderr: child.stderr },
		terminateTree: async () => terminateProcessTree(child, completion, request.platform)
	};
}
function updateFailure(cause) {
	return cause === void 0 ? /* @__PURE__ */ new Error("plugin_update_failed") : new Error("plugin_update_failed", { cause });
}
async function runPnpmUpdate(profileDirectory, version, runtime = {}) {
	if (parseSemver(version) === void 0) throw new Error("plugin_update_unavailable");
	const platform = runtime.platform ?? process.platform;
	const packageSpec = `${PACKAGE_NAME}@${version}`;
	const managed = (runtime.start ?? startUpdateProcess)({
		command: platform === "win32" ? runtime.windowsCommandInterpreter ?? process.env.ComSpec ?? "cmd.exe" : "pnpm",
		args: platform === "win32" ? [
			"/d",
			"/s",
			"/c",
			"pnpm.cmd",
			"add",
			packageSpec
		] : ["add", packageSpec],
		cwd: profileDirectory,
		detached: platform !== "win32",
		platform,
		shell: false
	});
	let diagnostics = "";
	managed.stderr?.on("data", (chunk) => {
		if (diagnostics.length < 4096) diagnostics += Buffer.from(chunk).toString("utf8").slice(0, 4096 - diagnostics.length);
	});
	const completion = managed.completion.then((result) => ({
		kind: "exit",
		result
	}), (error) => ({
		kind: "error",
		error
	}));
	const deadline = (runtime.deadline ?? createDeadline)(runtime.timeoutMs ?? UPDATE_TIMEOUT_MS);
	const first = await Promise.race([completion, deadline.promise.then(() => ({ kind: "timeout" }))]);
	deadline.cancel();
	if (first.kind === "error") throw updateFailure(first.error);
	if (first.kind === "exit") {
		if (first.result.code === 0) return;
		const detail = diagnostics.trim() || `pnpm exited with ${first.result.signal ?? String(first.result.code)}`;
		throw updateFailure(new Error(detail));
	}
	let terminationError;
	try {
		await managed.terminateTree();
	} catch (error) {
		terminationError = error;
	}
	if (terminationError !== void 0) throw updateFailure(terminationError);
	const stopped = await completion;
	if (stopped.kind === "error") throw updateFailure(stopped.error);
	throw updateFailure(/* @__PURE__ */ new Error("plugin update timed out"));
}
/** Cached npm/GitHub release lookup and guarded profile-local package update. */
var PluginReleaseManager = class {
	profileDirectory;
	installedVersion;
	fetcher;
	runner;
	installedVersionReader;
	now;
	cache;
	activeUpdate;
	constructor(options) {
		this.profileDirectory = options.profileDirectory;
		this.installedVersion = options.installedVersion ?? DSH_MOBILE_VERSION;
		this.fetcher = options.fetch ?? globalThis.fetch;
		this.runner = options.runUpdate ?? ((profileDirectory, version) => runPnpmUpdate(profileDirectory, version, options.updateProcess));
		this.installedVersionReader = options.readInstalledVersion ?? readProfileInstalledVersion;
		this.now = options.now ?? Date.now;
	}
	/** Read cached release metadata and suppress external lookup failures. */
	async status(force = false) {
		if (!force && this.cache !== void 0 && this.cache.expiresAt > this.now()) return this.cache.status;
		const updateSupported = isRegistryPluginSpec(this.profileDirectory === void 0 ? void 0 : await profileDependencySpec(this.profileDirectory));
		const npmVersion = fetchNpmVersion(this.fetcher);
		const [npmResult, androidResult, notesResult] = await Promise.allSettled([
			npmVersion,
			fetchAndroidRelease(this.fetcher),
			npmVersion.then((version) => version === void 0 ? void 0 : fetchReleaseNotes(this.fetcher, version))
		]);
		const latestVersion = npmResult.status === "fulfilled" ? npmResult.value : void 0;
		const android = androidResult.status === "fulfilled" ? androidResult.value : void 0;
		const releaseNotes = notesResult.status === "fulfilled" ? notesResult.value : void 0;
		const comparison = latestVersion === void 0 ? void 0 : comparePluginVersions(latestVersion, this.installedVersion);
		const status = Object.freeze({
			installedVersion: this.installedVersion,
			...latestVersion === void 0 ? {} : { latestVersion },
			updateAvailable: updateSupported && comparison === 1,
			updateSupported,
			...android === void 0 ? {} : { androidVersion: android.version },
			androidDownloadUrl: android?.downloadUrl ?? GITHUB_RELEASES_URL,
			...releaseNotes === void 0 ? {} : { releaseNotes }
		});
		this.cache = {
			expiresAt: this.now() + STATUS_CACHE_MS,
			status
		};
		return status;
	}
	/** Install the latest npm release into the active profile, then require a DSH restart. */
	async update() {
		if (this.activeUpdate !== void 0) return this.activeUpdate;
		this.activeUpdate = this.updateOnce();
		try {
			return await this.activeUpdate;
		} finally {
			this.activeUpdate = void 0;
		}
	}
	async updateOnce() {
		const profileDirectory = this.profileDirectory;
		if (profileDirectory === void 0) throw new Error("plugin_update_unsupported");
		const status = await this.status(true);
		if (!status.updateSupported) throw new Error("plugin_update_unsupported");
		if (!status.updateAvailable || status.latestVersion === void 0) throw new Error("plugin_update_unavailable");
		await this.runner(profileDirectory, status.latestVersion);
		const installed = await this.installedVersionReader(profileDirectory);
		if (installed !== status.latestVersion) throw new Error("plugin_update_failed");
		this.cache = void 0;
		return Object.freeze({
			installedVersion: installed,
			restartRequired: true
		});
	}
};
//#endregion
//#region src/file-logger.ts
const MAX_LOG_BYTES = 5242880;
const MAX_QUEUED_BYTES = 262144;
const PATH_PREFIX = "mobile_log";
async function regularLogFile(file) {
	try {
		const entry = await lstat(file);
		if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("mobile_log_target_invalid");
		return entry;
	} catch (error) {
		if (error.code === "ENOENT") return void 0;
		throw error;
	}
}
/** Open a private append-only file before registering a safely disposable Cordis exporter. */
async function installMobileFileLogger(ctx, stateDirectory, options = {}) {
	const directory = join(stateDirectory, "logs");
	const file = join(directory, "dsh-mobile.log");
	const previous = `${file}.1`;
	await ensureManagedDirectory(stateDirectory, directory, PATH_PREFIX);
	const entry = await regularLogFile(file);
	if (entry !== void 0 && entry.size >= MAX_LOG_BYTES) {
		await regularLogFile(previous);
		await removeManagedTree(stateDirectory, previous, PATH_PREFIX);
		await renameManagedPath(stateDirectory, file, previous, PATH_PREFIX);
		await regularLogFile(previous);
		await restrictPrivateFile(previous);
	}
	await assertManagedParents(stateDirectory, file, PATH_PREFIX);
	await regularLogFile(file);
	const handle = await open(file, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | (constants.O_NOFOLLOW ?? 0), 384);
	let stream;
	try {
		const opened = await handle.stat();
		const actual = await regularLogFile(file);
		if (!opened.isFile() || actual === void 0 || actual.dev !== opened.dev || actual.ino !== opened.ino) throw new Error("mobile_log_target_invalid");
		await assertManagedParents(stateDirectory, file, PATH_PREFIX);
		await handle.chmod(384);
		await restrictPrivateFile(file);
		stream = options.createStream?.(handle) ?? handle.createWriteStream({
			encoding: "utf8",
			autoClose: true
		});
	} catch (error) {
		await handle.close();
		throw error;
	}
	let stopped = false;
	let removeExporter;
	const stopLogging = (error) => {
		if (stopped) return;
		stopped = true;
		try {
			Promise.resolve(removeExporter?.()).catch(() => void 0);
		} catch (disposeError) {}
		stream.destroy();
		const candidate = error;
		const code = candidate !== null && typeof candidate === "object" && typeof candidate.code === "string" ? candidate.code : "write_failed";
		try {
			ctx.logger("dsh-mobile").warn("file logging disabled (%s); other logging remains available", code);
		} catch (loggerError) {}
	};
	stream.on("error", stopLogging);
	const closed = finished$1(stream, { cleanup: true }).catch((error) => {
		stopLogging(error);
	});
	const exporter = {
		colors: false,
		maxLength: 16384,
		levels: {
			default: -1,
			"dsh-mobile": 3
		},
		export(message) {
			if (stopped || message.name !== "dsh-mobile") return;
			try {
				const record = {
					timestamp: new Date(message.ts).toISOString(),
					level: message.type,
					logger: message.name,
					message: Logger.format(exporter, message)
				};
				const line = `${JSON.stringify(record)}\n`;
				if (stream.writableLength + Buffer.byteLength(line) > MAX_QUEUED_BYTES) {
					stopLogging(Object.assign(/* @__PURE__ */ new Error("file log queue exhausted"), { code: "backpressure" }));
					return;
				}
				stream.write(line);
			} catch (error) {
				stopLogging(error);
			}
		}
	};
	try {
		removeExporter = ctx.logger.exporter(exporter);
		ctx.effect(() => async () => {
			stopped = true;
			await removeExporter?.();
			stream.end();
			await closed;
		}, "dsh-mobile file logger");
	} catch (error) {
		stopped = true;
		stream.destroy();
		await closed;
		await removeExporter?.();
		throw error;
	}
	return file;
}
//#endregion
//#region src/installation-id.ts
const INSTALLATION_ID_PATTERN = /^[a-f0-9]{64}\n$/u;
const INSTALLATION_ID_BYTES = 65;
async function readInstallationId(file) {
	const entry = await lstat(file);
	if (!entry.isFile() || entry.isSymbolicLink() || entry.size !== INSTALLATION_ID_BYTES) throw new Error("installation_id_invalid");
	const contents = await readFile(file, "utf8");
	if (!INSTALLATION_ID_PATTERN.test(contents)) throw new Error("installation_id_invalid");
	await restrictPrivateFile(file);
	return contents.slice(0, -1);
}
/** Keep one random plugin identity across setup changes, restarts, and FRP resets. */
async function loadOrCreateInstallationId(file) {
	if (!isAbsolute(file)) throw new Error("installation ID path must be absolute");
	const target = resolve(file);
	await mkdir(dirname(target), {
		recursive: true,
		mode: 448
	});
	try {
		await writeFile(target, `${randomBytes(32).toString("hex")}\n`, {
			flag: "wx",
			mode: 384
		});
	} catch (error) {
		if (error.code !== "EEXIST") throw error;
	}
	return readInstallationId(target);
}
//#endregion
//#region src/lan-setup.ts
const FIREWALL_TCP_RULE = "DSH Mobile HTTPS";
const FIREWALL_UDP_RULE = "DSH Mobile Discovery";
async function runElevatedPowerShell(script) {
	await execFileText("powershell.exe", [
		"-NoProfile",
		"-NonInteractive",
		"-Command",
		[
			"$ErrorActionPreference = 'Stop'; $process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -Wait -PassThru",
			`  -ArgumentList @('-NoProfile','-NonInteractive','-EncodedCommand','${Buffer.from(script, "utf16le").toString("base64")}')`,
			"; exit $process.ExitCode"
		].join(" ")
	], { windowsHide: true });
}
/** Install the two Windows inbound rules used by the managed LAN listener. */
async function configureWindowsFirewall(port) {
	if (process.platform !== "win32") return;
	await runElevatedPowerShell([
		"$ErrorActionPreference = 'Stop'",
		`Get-NetFirewallRule -DisplayName '${FIREWALL_TCP_RULE}' -ErrorAction SilentlyContinue | Remove-NetFirewallRule`,
		`Get-NetFirewallRule -DisplayName '${FIREWALL_UDP_RULE}' -ErrorAction SilentlyContinue | Remove-NetFirewallRule`,
		`New-NetFirewallRule -DisplayName '${FIREWALL_TCP_RULE}' -Direction Inbound -Action Allow -Protocol TCP -LocalPort ${String(port)} -RemoteAddress LocalSubnet -Profile Any | Out-Null`,
		`New-NetFirewallRule -DisplayName '${FIREWALL_UDP_RULE}' -Direction Inbound -Action Allow -Protocol UDP -LocalPort ${String(port)} -RemoteAddress LocalSubnet -Profile Any | Out-Null`
	].join("; "));
}
/** Generate private TLS material and persist a managed setup selected by the user. */
async function prepareManagedLanSetup(options) {
	if (!isAbsolute(options.setupFile) || !isAbsolute(options.controlFile)) throw new Error("managed LAN setup paths must be absolute");
	if (!Number.isSafeInteger(options.listenPort) || options.listenPort < 1024 || options.listenPort > 65535) throw new Error("managed LAN listenPort must be from 1024 through 65535");
	if (!Number.isSafeInteger(options.dshPort) || options.dshPort < 1024 || options.dshPort > 65535) throw new Error("managed LAN dshPort must be from 1024 through 65535");
	const directory = dirname(options.setupFile);
	const tlsDirectory = join(directory, "tls");
	await mkdir(tlsDirectory, {
		recursive: true,
		mode: 448
	});
	const managedTls = {
		mode: "managed",
		caCertFile: join(tlsDirectory, "ca.pem"),
		caKeyFile: join(tlsDirectory, "ca-key.pem"),
		certFile: join(tlsDirectory, "server-cert.pem"),
		keyFile: join(tlsDirectory, "server-key.pem")
	};
	const ca = await ensureManagedCa(managedTls, {
		certFile: join(tlsDirectory, "cert.pem"),
		keyFile: join(tlsDirectory, "key.pem")
	});
	const setup = {
		version: 2,
		networkInterface: options.network.name,
		listenPort: options.listenPort,
		upstreamOrigin: `http://127.0.0.1:${String(options.dshPort)}`,
		tls: managedTls
	};
	await refreshManagedServerCertificate(setup, options.network.address);
	const androidCertificate = join(tlsDirectory, "dsh-mobile-ca.cer");
	await writeFile(androidCertificate, ca.raw, { mode: 384 });
	await Promise.all([...Object.values(managedTls).filter((value) => value !== "managed").map((file) => restrictPrivateFile(file)), restrictPrivateFile(androidCertificate)]);
	if (options.configureFirewall) await configureWindowsFirewall(options.listenPort);
	await Promise.all([writeFile(options.setupFile, `${JSON.stringify({
		...setup,
		tls: Object.fromEntries(Object.entries(setup.tls).map(([key, value]) => [key, typeof value === "string" ? value.replaceAll("\\", "/") : value]))
	}, null, 2)}\n`, { mode: 384 }), writeFile(options.controlFile, "{\"version\":1,\"enabled\":true}\n", { mode: 384 })]);
	await Promise.all([restrictPrivateFile(options.setupFile), restrictPrivateFile(options.controlFile)]);
	return Object.freeze({
		setup: Object.freeze(setup),
		network: Object.freeze({ ...options.network }),
		origin: `https://${options.network.address}:${String(options.listenPort)}`,
		androidCertificate
	});
}
//#endregion
//#region src/plugin.ts
/** Stable Cordis plugin name. */
const name = "dsh-mobile";
/** The stock WebServer serves the control card; Connection authenticates the loopback DSH origin. */
const inject = [
	"webServer",
	"commands",
	"connection"
];
/** Run cleanup steps in ownership order and report every failure after all steps settle. */
async function settleCleanupSteps(steps) {
	const errors = [];
	for (const step of steps) try {
		await step();
	} catch (error) {
		errors.push(error);
	}
	if (errors.length === 1 && errors[0] instanceof Error) throw errors[0];
	if (errors.length > 0) throw new AggregateError(errors, "DSH Mobile cleanup failed");
}
/**
* Resolve the DSH launch-token URL the gateway exchanges for its upstream cookie.
*
* A layer that disables DSH browser authentication — dsh-lan-access with
* `noAuth: true` replaces `authenticatedUrl` with one returning the bare origin
* — produces a URL with no query string, so it cannot carry a launch token. That
* is a legitimate "this upstream needs no browser auth" signal: report no URL and
* the gateway proxies without a cookie instead of failing every route with
* `upstream_unavailable`. A token-bearing URL keeps the existing exchange, and a
* connection service that is absent or returns a malformed URL keeps failing
* closed. Only parsing is guarded: a connection service that throws still fails
* plugin activation loudly rather than silently proxying without authentication.
*/
function upstreamAuthenticatedUrl(ctx, upstreamOrigin) {
	const connection = ctx.connection;
	if (typeof connection?.authenticatedUrl !== "function") return void 0;
	const authenticatedUrl = connection.authenticatedUrl(upstreamOrigin.origin);
	try {
		return new URL(authenticatedUrl).search === "" ? void 0 : authenticatedUrl;
	} catch {
		return;
	}
}
function installedDshVersion() {
	try {
		const manifest = createRequire(import.meta.url)("@deepseek-ai/dsh-host-webserver/package.json");
		if (manifest === null || typeof manifest !== "object") return "unknown";
		const version = manifest.version;
		return typeof version === "string" && version !== "" ? version : "unknown";
	} catch {
		return "unknown";
	}
}
function mapAdminError(error) {
	if (error instanceof HttpError) return error;
	if (error instanceof MobileExtensionError) return new HttpError(error.status, error.code);
	const code = error.code;
	if (error instanceof Error && error.message.includes("spawn UNKNOWN")) return new HttpError(409, "frp_component_launch_failed");
	if (code === "EADDRNOTAVAIL") return new HttpError(409, "network_address_changed");
	if (code === "EADDRINUSE") return new HttpError(409, "listen_port_in_use");
	if (error instanceof Error && error.message.startsWith("saved LAN interface ")) return new HttpError(409, "network_interface_unavailable");
	if (error instanceof Error && error.message === "cpolar_authtoken_invalid") return new HttpError(400, "cpolar_authtoken_invalid");
	if (error instanceof Error && error.message.startsWith("cpolar_")) return new HttpError(409, error.message);
	if (error instanceof Error && error.message.startsWith("cloudflared_")) return new HttpError(409, error.message);
	if (error instanceof Error && [
		"frp_server_address_invalid",
		"frp_server_port_invalid",
		"frp_token_invalid",
		"frp_public_origin_invalid",
		"frp_settings_invalid"
	].includes(error.message)) return new HttpError(400, error.message);
	if (error instanceof Error && error.message.startsWith("frp_")) return new HttpError(409, error.message);
	if (error instanceof Error && [
		"origin_settings_invalid",
		"origin_public_origin_invalid",
		"origin_listen_host_invalid",
		"origin_listen_port_invalid",
		"origin_listen_port_reserved",
		"origin_allowed_cidrs_invalid"
	].includes(error.message)) return new HttpError(400, error.message);
	if (error instanceof Error && error.message.startsWith("origin_")) return new HttpError(409, error.message);
	if (error instanceof Error && error.message.startsWith("vps_")) return new HttpError(409, error.message);
	if (error instanceof Error && error.message === "plugin_update_failed") return new HttpError(500, error.message);
	if (error instanceof Error && error.message.startsWith("plugin_update_")) return new HttpError(409, error.message);
	if (error instanceof Error && error.message.startsWith("lan_setup_")) return new HttpError(409, error.message);
	return new HttpError(500, "internal_error");
}
const SETUP_KEYS = /* @__PURE__ */ new Set([
	"version",
	"publicOrigin",
	"listenHost",
	"listenPort",
	"upstreamOrigin",
	"publicAuthorities",
	"allowedCidrs",
	"instanceId",
	"pairingCaFile",
	"tls"
]);
/** True when path names a regular file (not a directory or symlink). */
async function existsRegularFile(path) {
	try {
		const info = await lstat(path);
		return info.isFile() && !info.isSymbolicLink();
	} catch {
		return false;
	}
}
function withoutSetupKeys(config) {
	const merged = { ...config };
	for (const key of SETUP_KEYS) if (key !== "version") delete merged[key];
	return merged;
}
async function loadSetup(config) {
	if (config.setupFile === void 0) return {
		kind: "fixed",
		config
	};
	if (!isAbsolute(config.setupFile)) throw new Error("setupFile must be an absolute file path");
	let source;
	try {
		source = await readFile(resolve(config.setupFile), "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return {
			kind: "unconfigured",
			config,
			setupFile: resolve(config.setupFile)
		};
		throw error;
	}
	let parsed;
	try {
		parsed = JSON.parse(source);
	} catch (error) {
		throw new Error("mobile setup file is not valid JSON", { cause: error });
	}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("mobile setup file must be an object");
	const record = parsed;
	if (record.version === 2) return {
		kind: "managed",
		config: withoutSetupKeys(config),
		setup: parseManagedSetup(record),
		setupFile: resolve(config.setupFile)
	};
	if (record.version !== 1 || Reflect.ownKeys(record).some((key) => typeof key !== "string" || !SETUP_KEYS.has(key))) throw new Error("mobile setup file has an unsupported format");
	const { version: _version, ...setup } = record;
	delete setup.upstreamOrigin;
	return {
		kind: "fixed",
		config: {
			...withoutSetupKeys(config),
			...setup
		}
	};
}
function loopbackTemplate(loaded, webServerPort) {
	const base = withoutSetupKeys(loaded.config);
	const activeUpstreamOrigin = `http://127.0.0.1:${String(webServerPort)}`;
	return parseGatewayConfig({
		...base,
		...loaded.kind === "managed" ? { upstreamOrigin: activeUpstreamOrigin } : { upstreamOrigin: loaded.config.upstreamOrigin ?? activeUpstreamOrigin },
		listenHost: "127.0.0.1",
		listenPort: 0,
		publicAuthorities: ["127.0.0.1"],
		allowedCidrs: ["127.0.0.0/8"],
		tls: { mode: "disabled" }
	});
}
async function stableInstanceId(loaded, template) {
	if (loaded.kind !== "managed") return loaded.config.instanceId ?? template.instanceId;
	return new X509Certificate(await readFile(loaded.setup.tls.caCertFile)).fingerprint256.replaceAll(":", "").toLowerCase();
}
function remoteGatewayConfig(template, publicOrigin, stateFile, instanceId, listenPort = 0) {
	const origin = new URL(publicOrigin);
	if (origin.protocol !== "https:" || origin.username !== "" || origin.password !== "" || origin.pathname !== "/" || origin.search !== "" || origin.hash !== "") throw new Error("remote public origin must be an HTTPS origin");
	const publicAuthority = origin.port === "" ? `${origin.hostname}:443` : origin.host;
	const { pairingCaFile: _pairingCaFile, ...shared } = template;
	return Object.freeze({
		...shared,
		listenHost: "127.0.0.1",
		listenPort,
		authorities: Object.freeze([parseAuthority(publicAuthority)]),
		allowedCidrs: Object.freeze([parseCidr("127.0.0.0/8")]),
		stateFile,
		instanceId,
		tls: Object.freeze({ mode: "disabled" }),
		publicTls: true,
		discovery: false
	});
}
/**
* Gateway config for the self-signed FRP ingress.
*
* Unlike {@link remoteGatewayConfig}, the gateway itself is the TLS endpoint:
* frps only forwards raw TCP, so the listener speaks HTTPS with the leaf that
* `pairingCaFile` signed, and the pairing CA is deliberately retained so the
* gateway can serve `GET /mobile-access/ca.cer` for the app to pin. The listener
* stays on loopback because the public entry is the frps TCP proxy, never a
* direct bind.
*/
function frpIngressGatewayConfig(template, settings, stateFile, ingress, listenPort = 0) {
	if (!isFrpSelfSignedIngress(settings)) throw new Error("frp_entry_tls_invalid");
	const publicAuthority = `${new URL(settings.publicOrigin).hostname}:${String(resolveFrpPublicPort(settings))}`;
	const { pairingCaFile: _templateCaFile, ...shared } = template;
	return Object.freeze({
		...shared,
		listenHost: "127.0.0.1",
		listenPort,
		authorities: Object.freeze([parseAuthority(publicAuthority)]),
		allowedCidrs: Object.freeze([parseCidr("127.0.0.0/8")]),
		stateFile,
		instanceId: ingress.caFingerprint,
		pairingCaFile: ingress.paths.caCertFile,
		tls: Object.freeze({
			mode: "provided",
			certFile: ingress.paths.certFile,
			keyFile: ingress.paths.keyFile
		}),
		publicTls: true,
		discovery: false
	});
}
/**
* CA the FRP start-up self-check must pin, read from the ingress directory.
*
* The self-signed entry presents a leaf signed by this CA, which is absent from
* the system trust store, so the probe must anchor it exactly as the app does
* when it pins `pairingCaFile`. The public-CA entry answers with a publicly
* trusted certificate and therefore returns `undefined` (system trust store).
* An unreadable self-signed CA fails explicitly: falling back to the system
* trust store would hide a broken pairing identity behind a start timeout.
*/
async function readFrpIngressTrustAnchor(settings, stateFile, ownedRoot = dirname(stateFile)) {
	if (!isFrpSelfSignedIngress(settings)) return void 0;
	try {
		const file = frpIngressPaths(stateFile).caCertFile;
		await assertManagedParents(ownedRoot, file, "frp_ingress");
		const entry = await lstat(file);
		if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("frp_ingress_file_invalid");
		return await readFile(file, "utf8");
	} catch (error) {
		throw new Error("frp_ingress_ca_invalid", { cause: error });
	}
}
/** Reuse remote HTTPS policy while binding a separately validated private HTTP origin. */
function originGatewayConfig(template, settings, stateFile, instanceId, listenPort = settings.listenPort) {
	const validated = parseOriginSettings(settings);
	if (listenPort !== 0) validateOriginListenPort(listenPort);
	return Object.freeze({
		...remoteGatewayConfig(template, validated.publicOrigin, stateFile, instanceId, listenPort),
		listenHost: validated.listenHost,
		allowedCidrs: Object.freeze(validated.allowedCidrs.map(parseCidr))
	});
}
function remoteControlPayload(provider, status, gateway, providerStatuses, cpolarComponent, cloudflaredComponent, cloudflaredConfiguration, frpComponent, frpConfiguration, originConfiguration, caddyComponentStatus) {
	return {
		provider,
		running: status.enabled,
		state: status.state,
		...status.origin === void 0 ? {} : { origin: status.origin },
		...status.backendOrigin === void 0 ? {} : { backendOrigin: status.backendOrigin },
		...status.loginUrl === void 0 ? {} : { loginUrl: status.loginUrl },
		...status.setupUrl === void 0 ? {} : { setupUrl: status.setupUrl },
		...status.errorCode === void 0 ? {} : { errorCode: status.errorCode },
		...gateway === void 0 ? {} : { extensions: gateway.extensionStatus() },
		providers: {
			tailscale: {
				bundled: true,
				running: providerStatuses.tailscale.enabled,
				state: providerStatuses.tailscale.state
			},
			cpolar: {
				bundled: false,
				running: providerStatuses.cpolar.enabled,
				state: providerStatuses.cpolar.state,
				component: cpolarComponent
			},
			cloudflared: {
				bundled: false,
				running: providerStatuses.cloudflared.enabled,
				state: providerStatuses.cloudflared.state,
				component: cloudflaredComponent,
				configuration: cloudflaredConfiguration
			},
			frp: {
				bundled: false,
				running: providerStatuses.frp.enabled,
				state: providerStatuses.frp.state,
				component: frpComponent,
				configuration: frpConfiguration
			},
			origin: {
				bundled: true,
				running: providerStatuses.origin.enabled,
				state: providerStatuses.origin.state,
				configuration: originConfiguration,
				component: caddyComponentStatus
			}
		}
	};
}
/** Mount the resident control route and its optional authenticated LAN gateway. */
async function apply(ctx, config) {
	const dshVersion = installedDshVersion();
	const loaded = await loadSetup(config);
	const mobileAccess = createMobileAccessService(ctx);
	const template = loopbackTemplate(loaded, ctx.webServer.port);
	const upstreamLoginUrl = upstreamAuthenticatedUrl(ctx, template.upstreamOrigin);
	const instanceId = await stableInstanceId(loaded, template);
	const stateDirectory = dirname(template.stateFile);
	const logFile = await installMobileFileLogger(ctx, stateDirectory);
	const logger = ctx.logger("dsh-mobile");
	logger.info("logging initialized file=%s", logFile);
	const taskEventHub = new TaskEventHub();
	const disposeTaskEvents = watchTaskCompletions(ctx, {
		onTaskCompleted: (event) => taskEventHub.broadcast(event),
		log(event, fields) {
			logger.info("task event=%s fields=%o", event, fields);
		}
	});
	const remoteDirectory = join(stateDirectory, "remote");
	const configuredDshHome = process.env.DSH_HOME?.trim();
	const releaseManager = new PluginReleaseManager({ profileDirectory: releaseProfileDirectory(ctx, configuredDshHome === void 0 || configuredDshHome === "" ? dirname(stateDirectory) : resolve(configuredDshHome), process.argv.slice(2)) });
	const remoteProviderStore = new JsonRemoteProviderStore(join(remoteDirectory, "provider.json"), configuredRemoteProvider(process.env));
	const initialRemoteProvider = (await remoteProviderStore.load()).provider;
	const cpolarComponent = new CpolarComponentManager({ stateDirectory });
	await cpolarComponent.initialize();
	const cloudflaredComponent = new CloudflaredComponentManager({ stateDirectory });
	await cloudflaredComponent.initialize();
	const frpComponent = new FrpComponentManager({ stateDirectory });
	await frpComponent.initialize();
	const frpIdentity = await loadOrCreateInstallationId(join(stateDirectory, "installation-id"));
	const frpConfig = new FrpConfigStore(join(remoteDirectory, "frp", "config"), frpProxyName(frpIdentity), stateDirectory);
	await frpConfig.initialize();
	const originConfig = new OriginConfigStore(join(remoteDirectory, "origin", "config"), stateDirectory);
	await originConfig.initialize();
	const caddyComponent = new CaddyComponentManager({ stateDirectory });
	await caddyComponent.initialize();
	const caddyConfig = new CaddyConfigStore(stateDirectory);
	await caddyConfig.initialize();
	const cloudflaredTunnel = new CloudflaredTunnelStore(join(remoteDirectory, "cloudflared"), stateDirectory);
	await cloudflaredTunnel.initialize();
	const unregisterBuiltin = mobileAccess.registerExtension({
		schemaVersion: 1,
		id: "computer-images",
		name: "Computer images",
		version: "1.0.0",
		description: "Authenticated computer-side image browser",
		routes: [{
			method: "GET",
			path: "list",
			async handle(request) {
				return {
					status: 200,
					contentType: "application/json; charset=utf-8",
					body: JSON.stringify(await listComputerImages(request.query.get("path")))
				};
			}
		}, {
			method: "GET",
			path: "image",
			async handle(request) {
				const image = await readComputerImage(request.query.get("path"));
				return {
					status: 200,
					contentType: image.contentType,
					headers: { "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(image.name)}` },
					body: image.body
				};
			}
		}]
	});
	const webSocketPaths = new WebSocketPathStore(join(stateDirectory, "websocket-paths.json"));
	await webSocketPaths.load();
	const blockedUpgradePaths = new BlockedUpgradePathLog();
	const clientModulePreferences = new ClientModulePreferenceStore(join(stateDirectory, "client-modules.json"), template.excludedClientModules);
	await clientModulePreferences.initialize();
	let lanGateway;
	let preparedLanSetup;
	let trustedNetworksRestartRequired = false;
	let trustedNetworksWrite = Promise.resolve();
	let adminClosing = false;
	const startGateway = async (candidateConfig) => {
		const resolved = parseGatewayConfig({
			...candidateConfig,
			upstreamOrigin: template.upstreamOrigin.origin
		});
		const candidate = new MobileAccessGateway(resolved, new JsonDeviceStore(resolved.stateFile, resolved.maxDevices), mobileAccess, upstreamLoginUrl, webSocketPaths, blockedUpgradePaths, (source, code) => {
			logger.warn("%s discovery degraded while DSH remains available: %s", source, code);
		}, clientModulePreferences);
		await candidate.start();
		lanGateway = candidate;
		const removeTaskSink = taskEventHub.add(candidate);
		return { close: async () => {
			if (lanGateway === candidate) lanGateway = void 0;
			removeTaskSink();
			await candidate.close();
		} };
	};
	const startRuntime = async () => {
		if (loaded.kind === "unconfigured") throw new Error(preparedLanSetup === void 0 ? "lan_setup_required" : "lan_setup_restart_required");
		if (loaded.kind === "fixed") return startGateway(loaded.config);
		const following = new FollowingMobileAccessRuntime(async () => {
			const network = selectLanNetwork(void 0, loaded.setup.networkInterface);
			return {
				key: `${network.name}\0${network.address}\0${network.cidr}`,
				start: async () => startGateway({
					...loaded.config,
					...await materializeManagedSetup(loaded.setup)
				})
			};
		}, (error) => {
			process.emitWarning(`DSH Mobile could not follow the current LAN address: ${error instanceof Error ? error.message : String(error)}`, { code: "DSH_MOBILE_NETWORK_REFRESH" });
		});
		try {
			await following.initialize(2e3);
		} catch (error) {
			if (!isNetworkSelectionError(error)) throw error;
			const detail = error instanceof Error ? error.message : String(error);
			process.emitWarning(`DSH Mobile: ${detail}; mobile access stays dormant until the network returns or setup is re-run — DSH itself keeps running.`, { code: "DSH_MOBILE_NETWORK_UNAVAILABLE" });
			following.beginPolling(2e3);
		}
		return following;
	};
	const lanControlFile = parseControlFile(config.controlFile);
	const lanControlStore = new JsonMobileAccessControlStore(lanControlFile, config.initiallyEnabled);
	if (loaded.kind === "unconfigured" && (await lanControlStore.load()).enabled) await lanControlStore.save({
		version: 1,
		enabled: false
	});
	const lanController = new MobileAccessGatewayController(lanControlStore, startRuntime);
	const remoteDeviceFile = join(remoteDirectory, "devices.json");
	const legacyCpolarDeviceFile = join(remoteDirectory, "cpolar", "devices.json");
	if (initialRemoteProvider === "cpolar") try {
		await lstat(remoteDeviceFile);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
		try {
			await copyFile(legacyCpolarDeviceFile, remoteDeviceFile);
		} catch (copyError) {
			if (copyError.code !== "ENOENT") throw copyError;
		}
	}
	const createRemoteGateway = async (publicOrigin, listenPort = 0) => {
		const resolved = remoteGatewayConfig(template, publicOrigin, remoteDeviceFile, instanceId, listenPort);
		const candidate = new MobileAccessGateway(resolved, new JsonDeviceStore(resolved.stateFile, resolved.maxDevices), mobileAccess, upstreamLoginUrl, webSocketPaths, blockedUpgradePaths, void 0, clientModulePreferences);
		await candidate.start();
		return candidate;
	};
	/**
	* Gateway factory for the FRP provider.
	*
	* The public-CA entry keeps the ordinary Caddy-fronted remote gateway. The
	* self-signed entry terminates TLS inside the gateway, so it first materializes
	* a leaf the pairing CA signed for the public IPv4 and then binds the ingress
	* configuration that keeps that CA pinned.
	*/
	const createFrpGateway = async (publicOrigin, settings) => {
		if (!isFrpSelfSignedIngress(settings)) return createRemoteGateway(publicOrigin);
		const ingress = await ensureFrpIngressCertificate(settings, remoteDeviceFile, Date.now(), void 0, stateDirectory);
		const resolved = frpIngressGatewayConfig(template, settings, remoteDeviceFile, ingress);
		const candidate = new MobileAccessGateway(resolved, new JsonDeviceStore(resolved.stateFile, resolved.maxDevices), mobileAccess, upstreamLoginUrl, webSocketPaths, blockedUpgradePaths, void 0, clientModulePreferences);
		try {
			await candidate.start();
		} catch (error) {
			await candidate.close();
			throw error;
		}
		return candidate;
	};
	const createOriginGateway = async (settings) => {
		const resolved = originGatewayConfig(template, settings, remoteDeviceFile, instanceId);
		const candidate = new MobileAccessGateway(resolved, new JsonDeviceStore(resolved.stateFile, resolved.maxDevices), mobileAccess, upstreamLoginUrl, webSocketPaths, blockedUpgradePaths, void 0, clientModulePreferences);
		try {
			await candidate.start();
		} catch (error) {
			await candidate.close();
			throw error;
		}
		return candidate;
	};
	const tailscaleStore = new JsonMobileAccessControlStore(join(remoteDirectory, "control.json"), false);
	const cpolarStore = new JsonMobileAccessControlStore(join(remoteDirectory, "cpolar", "control.json"), false);
	const cloudflaredStore = new JsonMobileAccessControlStore(join(remoteDirectory, "cloudflared", "control.json"), false);
	const frpStore = new JsonMobileAccessControlStore(join(remoteDirectory, "frp", "control.json"), false);
	const originStore = new JsonMobileAccessControlStore(join(remoteDirectory, "origin", "control.json"), false);
	const caddyController = new CaddyController({
		store: createVolatileRemoteControlStore(),
		component: caddyComponent,
		config: caddyConfig,
		instanceId,
		createGateway: (settings) => createRemoteGateway(settings.publicOrigin)
	});
	const originController = new ManagedOriginController({
		store: originStore,
		modeStore: new JsonOriginModeStore(join(remoteDirectory, "origin", "upstream.json")),
		external: new OriginController({
			store: createVolatileRemoteControlStore(),
			config: originConfig,
			createGateway: createOriginGateway
		}),
		managed: caddyController
	});
	const remoteControllers = {
		tailscale: new FunnelController({
			store: tailscaleStore,
			executable: funnelExecutable(import.meta.url),
			stateDirectory: join(remoteDirectory, "tailscale"),
			ownedRoot: stateDirectory,
			hostname: `dsh-${instanceId.slice(0, 12)}`,
			createGateway: createRemoteGateway
		}),
		cpolar: new CpolarController({
			store: cpolarStore,
			executable: cpolarComponent.executable,
			configFile: cpolarComponent.configFile,
			createGateway: createRemoteGateway
		}),
		cloudflared: new CloudflaredController({
			store: cloudflaredStore,
			executable: cloudflaredComponent.executable,
			tunnel: cloudflaredTunnel,
			createGateway: createRemoteGateway
		}),
		frp: new FrpController({
			store: frpStore,
			executable: frpComponent.executable,
			config: frpConfig,
			instanceId,
			createGateway: createFrpGateway,
			/**
			* Hand the start-up self-check the CA the app itself pins.
			*
			* Only this module knows where the ingress material lives, so the anchor is
			* read here from the ingress directory instead of being guessed downstream.
			*/
			resolveDiscoveryTrustAnchor: (settings) => readFrpIngressTrustAnchor(settings, remoteDeviceFile, stateDirectory),
			maintainIngressCertificate: async (settings, gateway) => {
				await ensureFrpIngressCertificate(settings, remoteDeviceFile, Date.now(), gateway.config.instanceId, stateDirectory);
				await gateway.refreshProvidedTls();
			}
		}),
		origin: originController
	};
	const remoteProviders = new RemoteProviderCoordinator(initialRemoteProvider, remoteControllers, remoteProviderStore);
	const remoteController = () => remoteProviders.controller();
	for (const provider of REMOTE_PROVIDERS) {
		const controller = remoteControllers[provider];
		taskEventHub.add({ broadcastTaskEvent: (event) => {
			controller.gateway()?.broadcastTaskEvent(event);
		} });
	}
	const remotePayload = () => ({
		...remoteControlPayload(remoteProviders.selected, remoteController().status(), remoteController().gateway(), {
			tailscale: remoteControllers.tailscale.status(),
			cpolar: remoteControllers.cpolar.status(),
			cloudflared: remoteControllers.cloudflared.status(),
			frp: remoteControllers.frp.status(),
			origin: remoteControllers.origin.status()
		}, cpolarComponent.status(), cloudflaredComponent.status(), cloudflaredTunnel.status(), frpComponent.status(), frpConfig.status(), originConfig.status(), caddyComponent.status()),
		originMode: originController.mode(),
		caddyConfiguration: caddyConfig.status(),
		caddyState: caddyController.status()
	});
	const lanPayload = () => ({
		...loaded.kind === "unconfigured" ? {
			configured: preparedLanSetup !== void 0,
			restartRequired: preparedLanSetup !== void 0
		} : {},
		running: lanController.isRunning(),
		origin: lanGateway?.address().origin,
		...preparedLanSetup === void 0 ? {} : { pendingOrigin: preparedLanSetup.origin },
		...lanGateway === void 0 ? {} : { extensions: lanGateway.extensionStatus() }
	});
	const lanSetupPayload = async () => {
		if (loaded.kind !== "unconfigured" || preparedLanSetup !== void 0) return lanPayload();
		const networks = availableLanNetworks();
		const preferred = await preferredLanInterfaceNames();
		let recommendedAddress;
		try {
			recommendedAddress = selectLanNetwork(void 0, void 0, void 0, preferred).address;
		} catch {}
		return {
			...lanPayload(),
			networks: networks.map((network) => ({
				name: network.name,
				address: network.address,
				cidr: network.cidr,
				recommended: network.address === recommendedAddress
			})),
			listenPort: 3443,
			windowsFirewall: process.platform === "win32"
		};
	};
	const trustedNetworksPayload = async () => {
		if (loaded.kind !== "managed") return { supported: false };
		return {
			supported: true,
			extraAllowedCidrs: parseManagedSetup(JSON.parse(await readFile(loaded.setupFile, "utf8"))).extraAllowedCidrs ?? [],
			restartRequired: trustedNetworksRestartRequired,
			windowsFirewall: process.platform === "win32"
		};
	};
	const diagnosticsPayload = async () => {
		let interfaceName;
		let networkError;
		if (loaded.kind === "managed") try {
			interfaceName = selectLanNetwork(void 0, loaded.setup.networkInterface).name;
		} catch {
			networkError = "network_interface_unavailable";
		}
		const remote = remoteController().status();
		const frpOrigin = remote.origin;
		const frpSettings = remoteProviders.selected === "frp" ? frpConfig.settings() : void 0;
		const frpGateway = remoteControllers.frp.gateway();
		const pinnedFrpProbe = frpSettings !== void 0 && isFrpSelfSignedIngress(frpSettings) && frpGateway !== void 0 && frpOrigin !== void 0 ? async () => {
			try {
				const trustAnchorPem = await readFrpIngressTrustAnchor(frpSettings, remoteDeviceFile, stateDirectory);
				if (trustAnchorPem === void 0) return { state: "unreachable" };
				const started = performance.now();
				return await defaultProbeDiscovery({
					origin: frpOrigin,
					trustAnchorPem
				}, frpGateway.config.instanceId, AbortSignal.timeout(5500)) ? {
					state: "ready",
					latencyMs: Math.max(0, Math.round(performance.now() - started))
				} : { state: "unreachable" };
			} catch {
				return { state: "unreachable" };
			}
		} : void 0;
		return collectConnectionDiagnostics({
			dshVersion,
			competingRemoteChannelBoot: hasCompetingRemoteChannelBoot(ctx.webServer.collectIndexInjections?.() ?? []),
			lan: {
				configured: loaded.kind !== "unconfigured" || preparedLanSetup !== void 0,
				running: lanController.isRunning(),
				...lanGateway === void 0 ? {} : {
					origin: lanGateway.address().origin,
					port: lanGateway.address().port
				},
				...loaded.kind === "managed" ? {
					configuredInterface: loaded.setup.networkInterface,
					port: loaded.setup.listenPort
				} : {},
				...interfaceName === void 0 ? {} : { interfaceName },
				...networkError === void 0 ? {} : { networkError }
			},
			remote: {
				provider: remoteProviders.selected,
				running: remote.enabled,
				state: remote.state,
				...remote.origin === void 0 ? {} : { origin: remote.origin },
				...remote.errorCode === void 0 ? {} : { errorCode: remote.errorCode }
			}
		}, pinnedFrpProbe === void 0 ? {} : { remote: pinnedFrpProbe });
	};
	const authenticateDesktopAdmin = (request) => {
		const connection = ctx.connection;
		return typeof connection?.requestRejection === "function" && connection.requestRejection(request) === void 0;
	};
	const adminRoute = {
		kind: "prefix",
		path: LOCAL_ADMIN_PREFIX,
		handler: async (request, response) => {
			try {
				const target = parseRequestTarget(request.url);
				assertLocalAdminTrust(request, request.method === "POST", () => authenticateDesktopAdmin(request));
				if (adminClosing) throw new HttpError(503, "unavailable");
				if (target.search !== "") throw new HttpError(400, "bad_request");
				const lanControl = target.decodedPathname === `/api/mobile-access/control` || target.decodedPathname === `/api/mobile-access/lan/control`;
				if (request.method === "GET" && lanControl) {
					sendJson(response, 200, lanPayload(), false);
					return;
				}
				if (request.method === "GET" && target.decodedPathname === `/api/mobile-access/lan/setup`) {
					sendJson(response, 200, await lanSetupPayload(), false);
					return;
				}
				if (target.decodedPathname === `/api/mobile-access/client-modules`) {
					const gateway = lanGateway ?? remoteController().gateway();
					if (gateway === void 0) throw new HttpError(409, "mobile_access_not_running");
					const operation = new AbortController();
					const abort = () => {
						operation.abort();
					};
					response.once("close", abort);
					try {
						if (request.method === "GET") {
							sendJson(response, 200, await gateway.describeClientModules(void 0, operation.signal), false);
							return;
						}
						if (request.method !== "POST") throw new HttpError(405, "method_not_allowed");
						const body = await readJsonObject(request, template.maxBodyBytes);
						if (Object.keys(body).length !== 1 || Object.keys(body).some((key) => key !== "reset" && key !== "excludedClientModules")) throw new HttpError(400, "bad_request");
						sendJson(response, 200, body.reset === true ? await gateway.resetClientModules(void 0, operation.signal) : await gateway.configureClientModules(body.excludedClientModules, void 0, operation.signal), false);
					} catch (error) {
						if (!(error instanceof ClientModuleConflictError)) throw error;
						sendJson(response, 409, {
							error: "excluded_client_modules_invalid",
							detail: error.detail
						}, false);
					} finally {
						response.removeListener("close", abort);
						operation.abort();
					}
					return;
				}
				if (target.decodedPathname === `/api/mobile-access/lan/trusted-networks`) {
					if (request.method === "GET") {
						sendJson(response, 200, await trustedNetworksPayload(), false);
						return;
					}
					if (request.method !== "POST") throw new HttpError(405, "method_not_allowed");
					if (loaded.kind !== "managed") throw new HttpError(409, "lan_trusted_networks_unavailable");
					const body = await readJsonObject(request, 4096);
					let values;
					try {
						values = parseAdditionalTrustedNetworks(body.extraAllowedCidrs);
					} catch {
						throw new HttpError(400, "lan_trusted_networks_invalid");
					}
					const write = trustedNetworksWrite.then(async () => {
						if (adminClosing) throw new HttpError(503, "unavailable");
						await saveManagedTrustedNetworks(loaded.setupFile, values);
						trustedNetworksRestartRequired = true;
					});
					trustedNetworksWrite = write.catch(() => void 0);
					await write;
					sendJson(response, 200, await trustedNetworksPayload(), false);
					return;
				}
				if (request.method === "GET" && target.decodedPathname === `/api/mobile-access/diagnostics`) {
					sendJson(response, 200, await diagnosticsPayload(), false);
					return;
				}
				if (request.method === "GET" && target.decodedPathname === `/api/mobile-access/release`) {
					sendJson(response, 200, await releaseManager.status(), false);
					return;
				}
				if (request.method === "GET" && target.decodedPathname === `/api/mobile-access/extensions/hosts`) {
					sendJson(response, 200, mobileAccess.hostStatus(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/extensions/recover`) {
					const body = await readJsonObject(request, 4096);
					if (typeof body.id !== "string" || body.confirm !== true) throw new HttpError(400, "bad_request");
					await mobileAccess.recoverExtension(body.id);
					sendJson(response, 200, mobileAccess.hostStatus(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/release/update`) {
					await readJsonObject(request, 4096);
					sendJson(response, 200, await releaseManager.update(), false);
					return;
				}
				if (request.method === "POST" && lanControl) {
					const body = await readJsonObject(request, 4096);
					if (typeof body.running !== "boolean") throw new HttpError(400, "bad_request");
					if (body.running && loaded.kind === "unconfigured") throw new HttpError(409, preparedLanSetup === void 0 ? "lan_setup_required" : "lan_setup_restart_required");
					await lanController.setRunning(body.running);
					sendJson(response, 200, lanPayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/lan/setup`) {
					const body = await readJsonObject(request, 4096);
					if (loaded.kind !== "unconfigured") throw new HttpError(409, "lan_setup_already_configured");
					if (preparedLanSetup !== void 0) {
						sendJson(response, 200, await lanSetupPayload(), false);
						return;
					}
					if (body.confirm !== true || typeof body.address !== "string") throw new HttpError(400, "bad_request");
					const network = availableLanNetworks().find((candidate) => candidate.address === body.address);
					if (network === void 0) throw new HttpError(409, "lan_setup_network_unavailable");
					try {
						preparedLanSetup = await prepareManagedLanSetup({
							setupFile: loaded.setupFile,
							controlFile: lanControlFile,
							network,
							listenPort: 3443,
							dshPort: ctx.webServer.port,
							configureFirewall: body.configureFirewall !== false
						});
					} catch (error) {
						logger.error("managed LAN setup failed: %s", error instanceof Error ? error.stack ?? error.message : String(error));
						throw new HttpError(409, "lan_setup_failed");
					}
					sendJson(response, 200, await lanSetupPayload(), false);
					return;
				}
				if (request.method === "GET" && target.decodedPathname === `/api/mobile-access/remote/control`) {
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/provider`) {
					const body = await readJsonObject(request, 4096);
					if (body.provider !== "tailscale" && body.provider !== "cpolar" && body.provider !== "cloudflared" && body.provider !== "frp" && body.provider !== "origin") throw new HttpError(400, "bad_request");
					await remoteProviders.select(body.provider);
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/origin/configure`) {
					const body = await readJsonObject(request, 8192);
					await remoteProviders.mutate(async () => {
						await originConfig.configure(body);
						if (remoteControllers.origin.status().enabled) await remoteControllers.origin.reconnect();
					});
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/origin/purge`) {
					if ((await readJsonObject(request, 4096)).confirm !== true) throw new HttpError(400, "bad_request");
					await remoteProviders.mutate(async () => {
						await remoteControllers.origin.setEnabled(false);
						await originConfig.purge();
					});
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/cpolar/component/install`) {
					if ((await readJsonObject(request, 4096)).confirm !== true) throw new HttpError(400, "bad_request");
					logger.info("cpolar component install started");
					try {
						await remoteProviders.mutate(async () => cpolarComponent.install());
						logger.info("cpolar component install completed");
					} catch (error) {
						const cause = error instanceof Error && error.cause instanceof Error ? error.cause : void 0;
						logger.error("cpolar component install failed: %s%s", error instanceof Error ? error.stack ?? error.message : String(error), cause === void 0 ? "" : `; cause: ${cause.message}`);
						throw error;
					}
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/cpolar/configure`) {
					const body = await readJsonObject(request, 4096);
					await remoteProviders.mutate(async () => cpolarComponent.configure(body.authtoken));
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/cpolar/component/purge`) {
					if ((await readJsonObject(request, 4096)).confirm !== true) throw new HttpError(400, "bad_request");
					await remoteProviders.mutate(async () => {
						await remoteControllers.cpolar.setEnabled(false);
						await cpolarComponent.purge();
					});
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/cloudflared/component/install`) {
					if ((await readJsonObject(request, 4096)).confirm !== true) throw new HttpError(400, "bad_request");
					logger.info("cloudflared component install started");
					try {
						await remoteProviders.mutate(async () => cloudflaredComponent.install());
						logger.info("cloudflared component install completed");
					} catch (error) {
						logger.error("cloudflared component install failed: %s", error instanceof Error ? error.stack ?? error.message : String(error));
						throw error;
					}
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/cloudflared/component/purge`) {
					if ((await readJsonObject(request, 4096)).confirm !== true) throw new HttpError(400, "bad_request");
					await remoteProviders.mutate(async () => {
						await remoteControllers.cloudflared.setEnabled(false);
						await cloudflaredComponent.purge();
					});
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/caddy/component/install`) {
					if ((await readJsonObject(request, 4096)).confirm !== true) throw new HttpError(400, "bad_request");
					logger.info("caddy component install started");
					try {
						await remoteProviders.mutate(async () => caddyComponent.install());
						logger.info("caddy component install completed");
					} catch (error) {
						logger.error("caddy component install failed: %s", error instanceof Error ? error.stack ?? error.message : String(error));
						throw error;
					}
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/caddy/settings`) {
					const body = await readJsonObject(request, 8192);
					if (body.connect !== void 0 && typeof body.connect !== "boolean") throw new HttpError(400, "bad_request");
					const configure = async () => {
						if (body.connect === true && !caddyComponent.status().installed) throw new HttpError(409, "caddy_component_unavailable");
						await caddyConfig.configure(body.settings, {
							secretId: body.secretId ?? "",
							secretKey: body.secretKey ?? ""
						});
						if (body.connect === true) {
							await originController.setEnabled(false);
							await originController.selectMode("managed");
							await originController.reconnect();
						} else if (originController.mode() === "managed" && originController.status().enabled) await originController.reconnect();
					};
					if (body.connect === true) await remoteProviders.mutateSelected("origin", configure);
					else await remoteProviders.mutate(configure);
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/origin/mode`) {
					const body = await readJsonObject(request, 4096);
					if (body.mode !== "external" && body.mode !== "managed") throw new HttpError(400, "bad_request");
					const mode = body.mode;
					if (mode === "managed" && !caddyComponent.status().installed) throw new HttpError(409, "caddy_component_unavailable");
					await remoteProviders.mutate(async () => {
						await originController.selectMode(mode);
					});
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/caddy/component/purge`) {
					if ((await readJsonObject(request, 4096)).confirm !== true) throw new HttpError(400, "bad_request");
					await remoteProviders.mutate(async () => {
						if (originController.mode() === "managed") {
							await originController.setEnabled(false);
							await originController.selectMode("external");
						}
						await caddyComponent.purge();
						await caddyConfig.purge();
					});
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/cloudflared/tunnel`) {
					const body = await readJsonObject(request, 8192);
					await remoteProviders.mutate(async () => {
						await cloudflaredTunnel.configure(mergeSavedCloudflaredTunnelSettings(body, cloudflaredTunnel.settings()));
						if (remoteControllers.cloudflared.status().enabled) await remoteControllers.cloudflared.reconnect();
					});
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/cloudflared/tunnel/purge`) {
					if ((await readJsonObject(request, 4096)).confirm !== true) throw new HttpError(400, "bad_request");
					await remoteProviders.mutate(async () => {
						await remoteControllers.cloudflared.setEnabled(false);
						await cloudflaredTunnel.purge();
					});
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/frp/component/install`) {
					if ((await readJsonObject(request, 4096)).confirm !== true) throw new HttpError(400, "bad_request");
					logger.info("frpc component install started");
					try {
						await remoteProviders.mutate(async () => frpComponent.install());
						logger.info("frpc component install completed");
					} catch (error) {
						logger.error("frpc component install failed: %s", error instanceof Error ? error.stack ?? error.message : String(error));
						throw error;
					}
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/frp/configure`) {
					const body = await readJsonObject(request, 4096);
					await remoteProviders.mutate(async () => {
						await frpConfig.configure(body);
						if (remoteControllers.frp.status().enabled) await remoteControllers.frp.reconnect();
					});
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/frp/attach-plan`) {
					const settings = mergeSavedFrpSettings(await readJsonObject(request, 8192), frpConfig.settings());
					const options = {
						configFile: frpConfig.runtimeConfigFile,
						proxyName: frpConfig.proxyName
					};
					logger.info("frp attach plan requested mode=%s entryTls=%s vhostHttpPort=%d", settings.mode ?? "deploy", settings.entryTls ?? "public-ip-cert", resolveFrpVhostHttpPort(settings));
					sendJson(response, 200, {
						...remotePayload(),
						frpAttachPlan: createFrpAttachPlan(settings, options),
						frpAttachTemplate: createFrpAttachTemplate(settings, options)
					}, false);
					return;
				}
				if (request.method === "GET" && target.decodedPathname === `/api/mobile-access/remote/frp/self-check`) {
					const settings = frpConfig.settings();
					if (settings === void 0) throw new HttpError(409, "frp_config_missing");
					const check = await frpIngressSelfCheck(settings, remoteDeviceFile, stateDirectory);
					const entry = resolveFrpEntryProbe(settings);
					const [frpsReachable, entryReachable] = await Promise.all([probeTcpReachable(settings.serverAddress, settings.serverPort), probeTcpReachable(entry.host, entry.port)]);
					sendJson(response, 200, {
						...remotePayload(),
						frpSelfCheck: {
							...check,
							frpsReachable,
							entryReachable,
							frpc: remoteController().status(),
							component: frpComponent.status()
						}
					}, false);
					return;
				}
				if (request.method === "GET" && target.decodedPathname === `/api/mobile-access/remote/websocket-paths`) {
					sendJson(response, 200, { paths: webSocketPaths.list() }, false);
					return;
				}
				if (request.method === "GET" && target.decodedPathname === `/api/mobile-access/remote/websocket-paths/blocked`) {
					sendJson(response, 200, { blocked: blockedUpgradePaths.report() }, false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/websocket-paths`) {
					const body = await readJsonObject(request, 4096);
					if (!Array.isArray(body.paths)) throw new HttpError(400, "bad_request");
					const paths = await webSocketPaths.replace(body.paths);
					logger.info("websocket upgrade paths updated count=%d paths=%o", paths.length, paths);
					sendJson(response, 200, { paths }, false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/frp/vps/host-keys`) {
					const body = await readJsonObject(request, 8192);
					const serverAddress = typeof body.serverAddress === "string" ? body.serverAddress : "";
					logger.info("vps host keys requested host=%s sshUser=%s sshPort=%d", serverAddress, String(body.sshUser), Number(body.sshPort));
					const hostKeys = await fetchVpsHostKeys(serverAddress, {
						sshUser: body.sshUser,
						sshPort: body.sshPort,
						...body.sshKeyPath === void 0 || body.sshKeyPath === "" ? {} : { sshKeyPath: body.sshKeyPath }
					}, { log(event, fields) {
						logger.info("vps host keys event=%s fields=%o", event, fields);
					} });
					for (const key of hostKeys) logger.info("vps host key host=%s type=%s fingerprint=%s", serverAddress, key.keyType, key.fingerprint);
					sendJson(response, 200, {
						...remotePayload(),
						vpsHostKeys: hostKeys
					}, false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/frp/vps/deploy`) {
					const body = await readJsonObject(request, 8192);
					if (body.confirm !== true) throw new HttpError(400, "bad_request");
					logger.info("vps deploy requested host=%s port=%d sshUser=%s sshPort=%d keyProvided=%s fingerprints=%s", String(body.serverAddress), Number(body.serverPort), String(body.sshUser), Number(body.sshPort), body.sshKeyPath === void 0 ? "false" : "true", Array.isArray(body.hostFingerprints) ? String(body.hostFingerprints.length) : "none");
					const deployment = await remoteProviders.mutate(async () => {
						const settings = mergeSavedFrpSettings(body, frpConfig.settings());
						const result = await deployVps(settings, parseVpsDeploymentInput({
							sshUser: body.sshUser,
							sshPort: body.sshPort,
							...body.sshKeyPath === void 0 ? {} : { sshKeyPath: body.sshKeyPath },
							hostFingerprints: body.hostFingerprints
						}), { log(event, fields) {
							logger.info("vps deploy event=%s fields=%o", event, fields);
						} });
						await frpConfig.configure(settings);
						logger.info("vps deploy completed host=%s origin=%s checks=%d", settings.serverAddress, settings.publicOrigin, result.checks.length);
						return result;
					});
					sendJson(response, 200, {
						...remotePayload(),
						vpsDeployment: deployment
					}, false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/frp/vps/uninstall-script`) {
					const body = await readJsonObject(request, 4096);
					const script = createVpsUninstallScript({
						serverPort: mergeSavedFrpTarget(body, frpConfig.settings()).serverPort,
						...body.certName === void 0 || body.certName === "" ? {} : { certName: body.certName }
					});
					sendJson(response, 200, {
						...remotePayload(),
						vpsUninstallScript: script
					}, false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/frp/vps/uninstall`) {
					const body = await readJsonObject(request, 8192);
					if (body.confirm !== true) throw new HttpError(400, "bad_request");
					logger.info("vps uninstall requested host=%s sshUser=%s sshPort=%d", String(body.serverAddress), String(body.sshUser), Number(body.sshPort));
					const removal = await remoteProviders.mutate(async () => {
						const savedTarget = mergeSavedFrpTarget(body, frpConfig.settings());
						const result = await uninstallVps(savedTarget.serverAddress, {
							serverPort: savedTarget.serverPort,
							...body.certName === void 0 || body.certName === "" ? {} : { certName: body.certName }
						}, parseVpsDeploymentInput({
							sshUser: body.sshUser,
							sshPort: body.sshPort,
							...body.sshKeyPath === void 0 ? {} : { sshKeyPath: body.sshKeyPath },
							hostFingerprints: body.hostFingerprints
						}), { log(event, fields) {
							logger.info("vps uninstall event=%s fields=%o", event, fields);
						} });
						logger.info("vps uninstall completed host=%s checks=%d", result.serverAddress, result.checks.length);
						return result;
					});
					sendJson(response, 200, {
						...remotePayload(),
						vpsUninstall: removal
					}, false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/frp/component/purge`) {
					if ((await readJsonObject(request, 4096)).confirm !== true) throw new HttpError(400, "bad_request");
					await remoteProviders.mutate(async () => {
						await remoteControllers.frp.setEnabled(false);
						await settleCleanupSteps([
							() => frpComponent.purge().then(() => void 0),
							() => frpConfig.purge().then(() => void 0),
							() => purgeFrpIngressCertificates(remoteDeviceFile, stateDirectory)
						]);
					});
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/control`) {
					const running = (await readJsonObject(request, 4096)).running;
					if (typeof running !== "boolean") throw new HttpError(400, "bad_request");
					await remoteProviders.mutate(async (controller) => controller.setEnabled(running));
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/reconnect`) {
					await readJsonObject(request, 4096);
					await remoteProviders.mutate(async (controller) => controller.reconnect());
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (request.method === "POST" && target.decodedPathname === `/api/mobile-access/remote/reset`) {
					if ((await readJsonObject(request, 4096)).confirm !== true) throw new HttpError(400, "bad_request");
					await remoteProviders.mutate(async (controller) => {
						await controller.reset();
						await rm(remoteDeviceFile, { force: true });
					});
					sendJson(response, 200, remotePayload(), false);
					return;
				}
				if (target.decodedPathname.startsWith(`/api/mobile-access/remote/`)) {
					const active = remoteController().gateway();
					if (active === void 0) throw new HttpError(409, "gateway_stopped");
					await active.localAdminRoute(`${LOCAL_ADMIN_PREFIX}/remote`, authenticateDesktopAdmin).handler(request, response);
					return;
				}
				if (target.decodedPathname.startsWith(`/api/mobile-access/lan/`)) {
					const active = lanGateway;
					if (active === void 0) throw new HttpError(409, "gateway_stopped");
					await active.localAdminRoute(`${LOCAL_ADMIN_PREFIX}/lan`, authenticateDesktopAdmin).handler(request, response);
					return;
				}
				const active = lanGateway;
				if (active === void 0) throw new HttpError(409, "gateway_stopped");
				await active.localAdminRoute(LOCAL_ADMIN_PREFIX, authenticateDesktopAdmin).handler(request, response);
			} catch (error) {
				const mapped = mapAdminError(error);
				if (response.headersSent) response.destroy();
				else sendFailure(response, mapped.status, mapped.code, false);
			}
		}
	};
	await ctx.effect(async () => {
		const unregister = ctx.webServer.register(adminRoute);
		const stopAdmin = () => {
			adminClosing = true;
			unregister();
		};
		const disposeMobileCommand = ctx.commands.register({
			name: "mobile",
			description: "定制手机界面或添加电脑能力",
			input: { hint: "<要做什么>" },
			handler: async ({ agent, rawInput }) => {
				const task = rawInput.trim();
				if (task === "") return {
					kind: "error",
					text: "请带上需求，例如：/mobile 把手机端改成深色主题"
				};
				const hostStates = new Map(mobileAccess.hostStatus().hosts.map((host) => [host.id, host]));
				const guide = buildMobileGuide({
					directory: stateDirectory,
					hasCustomCss: await existsRegularFile(template.customCssFile),
					hasCustomJs: await existsRegularFile(template.customScriptFile),
					extensions: mobileAccess.manifest().map((entry) => {
						const host = hostStates.get(entry.id);
						return {
							id: entry.id,
							name: entry.name,
							version: entry.version,
							...host === void 0 ? {} : {
								executionMode: host.mode,
								executionState: host.state
							}
						};
					}),
					failedExtensionCount: mobileAccess.status().failed
				});
				agent.steer(createUserMessage({
					content: [{
						type: "text",
						text: `${guide}\n\n用户需求：${task}`
					}],
					source: {
						kind: "plugin:dsh-mobile",
						form: "notice",
						summary: boundContextSummary(`/mobile ${task}`)
					}
				}));
				return {
					kind: "success",
					text: "已把需求交给 DSH 处理，改动会在手机端几秒内生效。"
				};
			}
		});
		try {
			await mobileAccess.startLocal(template.extensionsDir, ctx, { hostExecution: template.hostExecution });
			await lanController.initialize();
			const stores = {
				tailscale: tailscaleStore,
				cpolar: cpolarStore,
				cloudflared: cloudflaredStore,
				frp: frpStore,
				origin: originStore
			};
			await Promise.all(Object.keys(stores).filter((provider) => provider !== remoteProviders.selected).map((provider) => stores[provider].disableIfPresent()));
			for (const provider of REMOTE_PROVIDERS) await remoteControllers[provider].initialize();
			const lanDiscovery = lanGateway?.discoveryStatus();
			if (lanDiscovery !== void 0 && !lanDiscovery.broadcast) logger.warn("broadcast discovery is unavailable (%s); mDNS is still published, so pair manually or free the UDP port", lanDiscovery.errorCode ?? "unknown_cause");
			if (lanDiscovery?.mobileAssetsErrorCode !== void 0) logger.warn("a bundled mobile asset is missing (%s); the phone frontend will serve without it", lanDiscovery.mobileAssetsErrorCode);
		} catch (error) {
			try {
				await settleCleanupSteps([
					stopAdmin,
					() => trustedNetworksWrite,
					disposeMobileCommand,
					disposeTaskEvents,
					async () => {
						const failures = (await Promise.allSettled(Object.values(remoteControllers).map((controller) => controller.close()))).filter((result) => result.status === "rejected").map((result) => result.reason);
						if (failures.length > 0) throw new AggregateError(failures, "remote provider cleanup failed");
					},
					() => lanController.close(),
					() => mobileAccess.stopLocal(),
					unregisterBuiltin
				]);
			} catch (cleanupError) {
				throw new AggregateError([error, cleanupError], "DSH Mobile initialization and cleanup failed");
			}
			throw error;
		}
		return async () => {
			await settleCleanupSteps([
				stopAdmin,
				() => trustedNetworksWrite,
				disposeMobileCommand,
				disposeTaskEvents,
				async () => {
					const failures = (await Promise.allSettled(Object.values(remoteControllers).map((controller) => controller.close()))).filter((result) => result.status === "rejected").map((result) => result.reason);
					if (failures.length > 0) throw new AggregateError(failures, "remote provider cleanup failed");
				},
				() => lanController.close(),
				() => mobileAccess.stopLocal(),
				unregisterBuiltin
			]);
		};
	}, "dsh-mobile: independent LAN and selectable remote providers with /mobile command");
}
//#endregion
export { AUTH_PREFIX, AccessController, AccessError, BlockedUpgradePathLog, BoundedRateLimiter, CERT_EXPIRING_DAYS, CLOUDFLARED_COMPONENT_RELEASE, CLOUDFLARED_COMPONENT_RELEASES, CSRF_COOKIE, CSRF_HEADER, ClientModuleConflictError, ClientModulePreferenceStore, CloudflaredComponentManager, CloudflaredController, CloudflaredTunnelStore, Config, DEFAULT_ORIGIN_LISTEN_PORT, FRP_VHOST_HTTP_PORT as DEFAULT_VHOST_HTTP_PORT, FRP_VHOST_HTTP_PORT, DEVICE_COOKIE, EXTENSION_LIMITS, FRP_ATTACH_DISCOVERY_PATH, FRP_ATTACH_LOCAL_DECLARATION, FRP_ATTACH_SELF_SIGNED_DECLARATION, FRP_ATTACH_VPS_DECLARATION, FRP_CADDY_IMPORT_LINE, FRP_CADDY_SNIPPET_MARKER, FRP_CADDY_SNIPPET_PATH, FRP_COMPONENT_RELEASES, FRP_DEFAULT_PROXY_NAME, FRP_DEFAULT_PUBLIC_PORT, FRP_RESERVED_PORTS, FrpComponentManager, FrpConfigStore, FrpController, JsonDeviceStore, JsonMobileAccessControlStore, JsonRemoteProviderStore, LOCAL_ADMIN_PREFIX, MAX_BLOCKED_UPGRADE_PATHS, MAX_EXTRA_WEBSOCKET_PATHS, MAX_WEBSOCKET_PATH_LENGTH, MemoryDeviceStore, MobileAccessGateway, MobileAccessGatewayController, MobileAccessService, MobileExtensionError, OriginConfigStore, OriginController, REMOTE_PROVIDERS, RequestTrustPolicy, SESSION_COOKIE, TASK_EVENT_DEBOUNCE_MS, TaskEventHub, WS_PATHS, WebSocketPathStore, addressAllowed, apply, assertExtensionId, configuredRemoteProvider, createCaddySite, createFrpAttachPlan, createFrpAttachTemplate, createFrpAttachTemplateParts, createFrpServerTemplate, createFrpcToml, createMobileAccessService, createRestrictedFrpServerTemplate, ensureFrpIngressCertificate, evaluateCertificateLifetime, frpAttachVpsParts, frpIngressPaths, frpIngressSelfCheck, frpProxyName, inject, isCloudflaredRegistration, isFrpSelfSignedIngress, isGloballyRoutableIpv4, isLoopbackAddress, issueServerCertificate, mergeSavedCloudflaredTunnelSettings, mergeSavedFrpSettings, mergeSavedFrpTarget, name, normalizeWebSocketPaths, originGatewayConfig, parseAuthority, parseCidr, parseCloudflaredOrigin, parseCloudflaredTunnelSettings, parseControlFile, parseDeviceSnapshot, parseExtensionManifest, parseFrpSettings, parseGatewayConfig, parseMobileAccessControlState, parseOriginSettings, parseRemoteProviderState, probeOriginCertificate, readCertificateRenewal, resolveAuthority, resolveFrpEntryTls, resolveFrpMode, resolveFrpPublicPort, resolveFrpVhostHttpPort, resolveHostExecution, rewriteMobileIndex, validateAttachSettings, validateCloudflaredTunnelHostname, validateCloudflaredTunnelPort, validateCloudflaredTunnelToken, validateFrpEntryTls, validateFrpMode, validateFrpProxyName, validateFrpPublicOrigin, validateFrpPublicPort, validateFrpServerAddress, validateFrpServerPort, validateFrpToken, validateFrpVhostHttpPort, validateOriginAllowedCidrs, validateOriginListenHost, validateOriginListenPort, validateOriginPublicOrigin, validateWebSocketPath, watchTaskCompletions };

//# sourceMappingURL=index.mjs.map