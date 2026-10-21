#!/usr/bin/env node
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir, networkInterfaces } from "node:os";
import { basename, dirname, isAbsolute, join, resolve, win32 } from "node:path";
import { X509Certificate, createPrivateKey, createPublicKey, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { generate } from "selfsigned";
import "@deepseek-ai/cordis";
import "@deepseek-ai/schemastery";
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
Object.freeze([
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
/** Remove only the two Windows firewall rules owned by DSH Mobile. */
async function removeWindowsFirewall() {
	if (process.platform !== "win32") return;
	await runElevatedPowerShell([
		"$ErrorActionPreference = 'Stop'",
		`Get-NetFirewallRule -DisplayName '${FIREWALL_TCP_RULE}' -ErrorAction SilentlyContinue | Remove-NetFirewallRule`,
		`Get-NetFirewallRule -DisplayName '${FIREWALL_UDP_RULE}' -ErrorAction SilentlyContinue | Remove-NetFirewallRule`
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
process.env.NODE_OPTIONS;
Object.freeze({
	manifest: 65536,
	script: 1048576,
	css: 524288,
	asset: 8388608,
	assetFiles: 256,
	assetBytes: 33554432,
	assetDepth: 8
});
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
/** Validate a stable extension id. */
function assertExtensionId(value) {
	if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,63}$/u.test(value)) throw new MobileExtensionError("invalid_manifest", "extension id is invalid");
	return value;
}
//#endregion
//#region src/cli.ts
function parseOptions(args) {
	let address;
	let port = 3443;
	let dshPort = 3080;
	let configureFirewall = true;
	for (let index = 0; index < args.length; index += 1) {
		const name = args[index];
		const value = args[index + 1];
		if (name === "--address" && value !== void 0) {
			address = value;
			index += 1;
			continue;
		}
		if (name === "--port" && value !== void 0) {
			port = Number(value);
			index += 1;
			continue;
		}
		if (name === "--dsh-port" && value !== void 0) {
			dshPort = Number(value);
			index += 1;
			continue;
		}
		if (name === "--no-firewall") {
			configureFirewall = false;
			continue;
		}
		throw new Error(`unknown setup option: ${name ?? ""}`);
	}
	if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error("--port must be from 1024 through 65535");
	if (!Number.isSafeInteger(dshPort) || dshPort < 1024 || dshPort > 65535) throw new Error("--dsh-port must be from 1024 through 65535");
	return {
		...address === void 0 ? {} : { address },
		port,
		dshPort,
		configureFirewall
	};
}
function dshHome() {
	return resolve(process.env.DSH_HOME ?? join(homedir(), ".dsh"));
}
async function setup(args) {
	const options = parseOptions(args);
	const preferredInterfaces = options.address === void 0 ? await preferredLanInterfaceNames() : [];
	const network = selectLanNetwork(options.address, void 0, void 0, preferredInterfaces);
	const home = dshHome();
	const directory = join(home, "mobile-access");
	await mkdir(directory, {
		recursive: true,
		mode: 448
	});
	const customCss = join(directory, "mobile.css");
	try {
		await readFile(customCss);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
		await writeFile(customCss, [
			"/* Safe mobile overrides. DSH Mobile applies saved changes on the phone automatically. */",
			":root {",
			"  --dsh-mobile-accent: #2563eb;",
			"  --dsh-mobile-font-scale: 1;",
			"  --dsh-mobile-radius: 14px;",
			"}",
			""
		].join("\n"), { mode: 384 });
	}
	const customScript = join(directory, "mobile.js");
	try {
		await readFile(customScript);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
		await writeFile(customScript, [
			"/* Mount mobile-only Web features here. Saved changes are applied automatically. */",
			"window.dshMobile.register(({ root }) => {",
			"  root.replaceChildren()",
			"  return () => root.replaceChildren()",
			"})",
			""
		].join("\n"), { mode: 384 });
	}
	const extensions = join(directory, "extensions");
	await mkdir(extensions, {
		recursive: true,
		mode: 448
	});
	await createExtensionScaffold(extensions, "custom", "自定义移动扩展", false);
	if (options.configureFirewall && process.platform === "win32") console.log("Windows will request administrator approval for two LAN-only firewall rules.");
	const result = await prepareManagedLanSetup({
		setupFile: join(directory, "setup.json"),
		controlFile: join(directory, "control.json"),
		network,
		listenPort: options.port,
		dshPort: options.dshPort,
		configureFirewall: options.configureFirewall
	});
	console.log(`DSH Mobile follows ${network.name} and is currently configured for ${result.origin}`);
	console.log(`Install this CA certificate on Android once: ${result.androidCertificate}`);
	console.log(`Ask DSH to customize the mobile Web UI and features in: ${customCss} and ${customScript}`);
	console.log(`Additional extensions live in: ${extensions}`);
	console.log("Start DSH with: dsh --profile web");
	console.log("Then open the Mobile card in the lower-left corner and create a pairing key.");
}
async function createExtensionScaffold(root, id, name, refuseExisting = true) {
	assertExtensionId(id);
	await mkdir(root, {
		recursive: true,
		mode: 448
	});
	const directory = join(root, id);
	try {
		await mkdir(directory, {
			recursive: false,
			mode: 448
		});
	} catch (error) {
		if (error.code === "EEXIST" && !refuseExisting) return;
		if (error.code === "EEXIST") throw new Error(`extension directory already exists: ${id}`);
		throw error;
	}
	const files = {
		"extension.json": `${JSON.stringify({
			schemaVersion: 1,
			id,
			name,
			version: "0.1.0",
			description: "在手机端扩展 DSH"
		}, null, 2)}\n`,
		"host.mjs": `export default async function activate(api) {\n  api.action('hello', {\n    input: api.schema.object({ name: api.schema.string().max(80) }),\n    async run({ signal, deviceId }, input) {\n      void signal; void deviceId\n      return { message: \`Hello, \${input.name}\` }\n    },\n  })\n}\n`,
		"mobile.js": `window.dshMobile?.define?.({\n  apiVersion: 1,\n  id: '${id}',\n  activate(api) {\n    return api.ui.registerSurface({\n      id: '${id}-page', placement: 'page', label: ${JSON.stringify(name)},\n      mount(container) {\n        container.textContent = ${JSON.stringify(`这是 ${name} 的移动页面。`)}\n        return () => container.replaceChildren()\n      },\n    })\n  },\n})\n`,
		"mobile.css": `/* ${name.replaceAll("*/", "* /")} 的移动端样式。保存后通常会在几秒内刷新。 */\n`
	};
	try {
		for (const [file, contents] of Object.entries(files)) await writeFile(join(directory, file), contents, {
			encoding: "utf8",
			flag: "wx",
			mode: 384
		});
	} catch (error) {
		await rm(directory, {
			recursive: true,
			force: true
		});
		throw error;
	}
	console.log(`Created extension: ${directory}`);
}
async function extensionCommand(args) {
	const [subcommand, id, ...rest] = args;
	if (subcommand !== "create" || id === void 0) throw new Error("usage: extension create <id> [--name <name>]");
	let name = id;
	for (let index = 0; index < rest.length; index += 1) {
		if (rest[index] === "--name" && rest[index + 1] !== void 0) {
			name = rest[index + 1];
			index += 1;
			continue;
		}
		throw new Error(`unknown extension option: ${rest[index] ?? ""}`);
	}
	if (name.length === 0 || name.length > 120 || /[\u0000-\u001f\u007f]/u.test(name)) throw new Error("--name is invalid");
	await createExtensionScaffold(join(dshHome(), "mobile-access", "extensions"), id, name);
}
async function purge(args) {
	if (args.length !== 1 || args[0] !== "--yes") throw new Error("purge requires --yes");
	const home = dshHome();
	await rm(join(home, "mobile-access"), {
		recursive: true,
		force: true
	});
	await removeWindowsFirewall();
	console.log("Removed DSH Mobile certificates, devices, preferences, and custom Web files.");
}
function help() {
	console.log([
		"dsh-mobile setup [--address 192.168.x.x] [--port 3443] [--dsh-port 3080] [--no-firewall]",
		"dsh-mobile extension create <id> [--name <name>]",
		"dsh-mobile purge --yes",
		"",
		"Run through the DSH profile:",
		"  dsh plugin --profile web exec dsh-mobile setup"
	].join("\n"));
}
async function main() {
	const [command = "help", ...args] = process.argv.slice(2);
	if (command === "setup") await setup(args);
	else if (command === "extension") await extensionCommand(args);
	else if (command === "purge") await purge(args);
	else if (command === "help" || command === "--help" || command === "-h") help();
	else throw new Error(`unknown command: ${command}`);
}
main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
//#endregion
export {};

//# sourceMappingURL=cli.js.map