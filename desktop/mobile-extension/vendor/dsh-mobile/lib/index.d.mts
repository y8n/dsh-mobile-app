import { X509Certificate } from "node:crypto";
import z from "@deepseek-ai/schemastery";
import { ChildProcessWithoutNullStreams } from "node:child_process";
import { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { Context, Service } from "@deepseek-ai/cordis";
import { WebRoute } from "@deepseek-ai/dsh-host-webserver";
//#region src/storage.d.ts
/** Persistent record containing only a digest of the long-lived device credential. */
interface StoredDevice {
  readonly id: string;
  readonly label: string;
  readonly tokenDigest: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly lastSeenAt: number;
  /** Legacy tombstone accepted on load; AccessController removes it during initialization. */
  readonly revokedAt?: number;
}
/** Versioned device state. Raw device and Session credentials are never members. */
interface DeviceSnapshot {
  readonly version: 1;
  readonly devices: readonly StoredDevice[];
}
/** Persistence seam for device-token digests and revocation metadata. */
interface DeviceStore {
  load(): Promise<DeviceSnapshot>;
  save(snapshot: DeviceSnapshot): Promise<void>;
}
/** Validate durable data before it can authorize a device. */
export declare function parseDeviceSnapshot(value: unknown, maximumDevices?: number): DeviceSnapshot;
/** Atomic JSON implementation with symlink refusal and owner-only file creation. */
export declare class JsonDeviceStore implements DeviceStore {
  private readonly file;
  private readonly maximumDevices;
  constructor(file: string, maximumDevices?: number);
  load(): Promise<DeviceSnapshot>;
  save(snapshot: DeviceSnapshot): Promise<void>;
}
/** In-memory store useful for embedding and deterministic tests. */
export declare class MemoryDeviceStore implements DeviceStore {
  private snapshot;
  constructor(initial?: DeviceSnapshot);
  load(): Promise<DeviceSnapshot>;
  save(snapshot: DeviceSnapshot): Promise<void>;
  /** Return a defensive copy for assertions or administrative export. */
  inspect(): DeviceSnapshot;
}
//#endregion
//#region src/access.d.ts
/** Stable error categories converted to deliberately terse HTTP responses. */
export declare class AccessError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string);
}
/** Resource and lifetime controls for device authentication. */
interface AccessControllerOptions {
  readonly pairingTtlMs: number;
  readonly deviceTtlMs: number;
  readonly sessionTtlMs: number;
  readonly maxDevices: number;
  readonly maxSessions: number;
  readonly rateLimitWindowMs: number;
  readonly maxPairingAttempts: number;
  readonly maxRateLimitKeys: number;
  readonly now?: () => number;
}
/** Values issued once after pairing; only digests survive the response. */
interface PairingResult {
  readonly deviceId: string;
  readonly deviceToken: string;
  readonly deviceExpiresAt: number;
  readonly sessionToken: string;
  readonly csrfToken: string;
  readonly sessionExpiresAt: number;
}
/** Values issued after renewal with the persistent HttpOnly device Cookie. */
interface RenewalResult {
  readonly deviceId: string;
  readonly sessionToken: string;
  readonly csrfToken: string;
  readonly sessionExpiresAt: number;
}
/** Authenticated Session identity retained only inside the gateway. */
interface SessionAuthorization {
  readonly sessionKey: string;
  readonly deviceId: string;
  readonly expiresAt: number;
}
/** Result of a persistent-device reachability check without opening a Session. */
interface DeviceProbeResult {
  readonly deviceId: string;
  readonly deviceExpiresAt: number;
}
/** Why a short-lived Session ended; only device revocation is sent to clients. */
type SessionEndReason = 'logout' | 'expired' | 'evicted' | 'revoked';
/** Safe device metadata returned by the loopback administration API. */
interface DeviceSummary {
  readonly id: string;
  readonly label: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly lastSeenAt: number;
  readonly revokedAt?: number;
}
/** Fixed-window limiter whose attacker-controlled key table is itself bounded. */
export declare class BoundedRateLimiter {
  private readonly limit;
  private readonly windowMs;
  private readonly maximumKeys;
  private readonly buckets;
  constructor(limit: number, windowMs: number, maximumKeys: number);
  /** Consume one attempt; unknown keys fail closed when the bounded table is full. */
  take(key: string, now: number): boolean;
  /** Current table size, exposed for bounded-state assertions. */
  get size(): number;
}
/** Pairing, persistent-device, short-Session, revocation, and CSRF state machine. */
export declare class AccessController {
  private readonly store;
  private readonly options;
  private readonly now;
  private readonly pairLimiter;
  private devices;
  private pairingWindow;
  private readonly sessions;
  private readonly sessionEndedListeners;
  private mutation;
  private initialized;
  private closing;
  private closeTask;
  constructor(store: DeviceStore, options: AccessControllerOptions);
  /** Load and validate digest-only durable state before accepting traffic. */
  initialize(): Promise<void>;
  private requireInitialized;
  private exclusive;
  private snapshot;
  private emitSessionEnded;
  private removeSession;
  private pruneSessions;
  private createSession;
  /** Open one short pairing window and return its one-time secret to a loopback caller only. */
  openPairing(requestedTtlMs?: number): Promise<{
    token: string;
    expiresAt: number;
  }>;
  /** Consume the pairing window exactly once and persist only the device-token digest. */
  pair(sourceKey: string, token: string, label?: string): Promise<PairingResult>;
  /** Exchange a valid persistent device credential for a new short Session. */
  renew(deviceToken: string): Promise<RenewalResult>;
  /** Validate a persistent device credential without consuming a Session slot. */
  probe(deviceToken: string): Promise<DeviceProbeResult>;
  /** Validate a device credential without writing state or opening a Session. */
  authorizeDevice(deviceToken: string): DeviceProbeResult;
  private requireDevice;
  /** Resolve a short Session Cookie without revealing whether device or Session failed. */
  authorizeSession(sessionToken: string): SessionAuthorization;
  /** Require the Session-bound anti-CSRF value for an authenticated mutation. */
  assertCsrf(authorization: SessionAuthorization, csrfToken: string | undefined): void;
  /** End one short Session and notify the gateway to abort its attached work. */
  logout(authorization: SessionAuthorization): void;
  /** Durably delete the device, then end every Session owned by that device. */
  revokeDevice(deviceId: string): Promise<boolean>;
  /** Remove every persistent credential and terminate every active Session. */
  resetDevices(): Promise<void>;
  /** Safe metadata for the loopback administration surface. */
  listDevices(): readonly DeviceSummary[];
  /** Pairing status without exposing the one-time secret. */
  pairingStatus(): {
    open: boolean;
    expiresAt?: number;
  };
  /** Subscribe gateway resources to Session logout, expiry, eviction, and device revocation. */
  onSessionEnded(listener: (authorization: SessionAuthorization, reason: SessionEndReason) => void): () => void;
  /** Stop new operations, drain durable mutations, then clear volatile credentials. */
  close(): Promise<void>;
  private finishClose;
  /** Bounded volatile-state metrics for tests and local status. */
  metrics(): {
    sessions: number;
    rateLimitKeys: number;
  };
}
//#endregion
//#region src/network.d.ts
/** A parsed IP network used to authorize directly connected clients. */
interface ParsedCidr {
  readonly bits: 32 | 128;
  readonly network: bigint;
  readonly prefix: number;
  readonly source: string;
}
/** A normalized public authority. A missing port is filled from the bound listener. */
interface AuthoritySpec {
  readonly hostname: string;
  readonly port?: number;
}
/** Parse and canonicalize one IPv4 or IPv6 CIDR. */
export declare function parseCidr(source: string): ParsedCidr;
/** Whether a directly connected socket address belongs to at least one allowed CIDR. */
export declare function addressAllowed(address: string | undefined, cidrs: readonly ParsedCidr[]): boolean;
/** Whether an IP literal is loopback and therefore eligible for HTTP-only development. */
export declare function isLoopbackAddress(address: string): boolean;
/**
 * Whether a dotted-quad IPv4 literal is globally routable and therefore usable
 * as a public VPS / remote HTTPS endpoint. Rejects documentation addresses such
 * as 203.0.113.10 alongside private, shared, and reserved space.
 */
export declare function isGloballyRoutableIpv4(address: string): boolean;
/** Parse a bare host or host:port authority without accepting URL components. */
export declare function parseAuthority(source: string): AuthoritySpec;
/** Resolve an authority against the actual listener port. */
export declare function resolveAuthority(spec: AuthoritySpec, listenerPort: number): string;
/** Exact Host/Origin/CIDR policy for the directly exposed listener. */
export declare class RequestTrustPolicy {
  readonly cidrs: readonly ParsedCidr[];
  readonly authorities: ReadonlySet<string>;
  readonly origins: ReadonlySet<string>;
  private readonly scheme;
  constructor(specs: readonly AuthoritySpec[], listenerPort: number, cidrs: readonly ParsedCidr[], tls: boolean);
  /** Validate the exact Host header after WHATWG authority normalization. */
  acceptsHost(header: string | undefined): boolean;
  /** Return the canonical accepted Host authority, otherwise undefined. */
  canonicalHost(header: string | undefined): string | undefined;
  /** Validate an exact same-scheme browser Origin. */
  acceptsOrigin(header: string | undefined): boolean;
  /** Return the canonical accepted Origin, otherwise undefined. */
  canonicalOrigin(header: string | undefined): string | undefined;
}
//#endregion
//#region src/extension-worker-config.d.ts
/** Operator-owned limits for opt-in local extension worker execution. */
interface HostExecutionConfig {
  readonly mode?: 'in-process' | 'worker';
  /** Apply worker mode only to these exact local ids; omitted selects every local host. */
  readonly extensions?: readonly string[] | undefined;
  readonly maxWorkers?: number;
  readonly maxRegistrations?: number;
  readonly maxOldGenerationSizeMb?: number;
  readonly maxYoungGenerationSizeMb?: number;
  readonly stackSizeMb?: number;
  readonly activationTimeoutMs?: number;
  readonly operationTimeoutMs?: number;
  readonly cancelGraceMs?: number;
  readonly streamCancelGraceMs?: number;
  readonly disposeGraceMs?: number;
  readonly resultMaxBytes?: number;
  readonly streamWindowBytes?: number;
  readonly streamChunkBytes?: number;
  readonly streamAggregateBytes?: number;
  readonly logWindowMs?: number;
  readonly logMessagesPerWindow?: number;
  readonly logMessageBytes?: number;
}
/** Complete settings passed to each owned worker; Node limits do not isolate filesystem access. */
interface ResolvedHostExecutionConfig extends Required<Omit<HostExecutionConfig, 'extensions'>> {
  readonly extensions: readonly string[] | undefined;
}
/** Resolve configuration once; reject malformed modes, ids and incoherent stream windows. */
export declare function resolveHostExecution(raw: unknown): ResolvedHostExecutionConfig;
//#endregion
//#region src/config.d.ts
/** Optional compression for exact, already authorized WebSocket paths. */
interface WebSocketCompressionConfig {
  paths?: string[];
  maxMessageBytes?: number;
  maxQueuedBytes?: number;
  thresholdBytes?: number;
  concurrencyLimit?: number;
  level?: number;
}
/** Validated compression settings; an empty path list keeps the raw transport. */
interface ResolvedWebSocketCompressionConfig {
  readonly paths: readonly string[];
  readonly maxMessageBytes: number;
  readonly maxQueuedBytes: number;
  readonly thresholdBytes: number;
  readonly concurrencyLimit: number;
  readonly level: number;
}
/** TLS source accepted by the LAN listener. */
interface ProvidedTlsConfig {
  readonly mode: 'provided';
  /** PEM server leaf followed by any intermediate certificate chain. */
  readonly certFile: string;
  readonly keyFile: string;
  /** Optional PEM intermediates appended after the chain in `certFile`; roots are rejected. */
  readonly caFile?: string;
}
/** HTTP is available only for an explicitly loopback-bound listener. */
interface DisabledTlsConfig {
  readonly mode: 'disabled';
}
type TlsConfig = ProvidedTlsConfig | DisabledTlsConfig;
/** Operator-facing plugin configuration. */
interface PluginConfig {
  /** Local host execution mode and owned worker budgets; defaults to in-process. */
  hostExecution?: HostExecutionConfig;
  /** Optional setup JSON written by the packaged CLI. */
  setupFile?: string;
  /** Preferred HTTPS origin used to derive the public authority and listener port. */
  publicOrigin?: string;
  listenHost?: string;
  listenPort?: number;
  upstreamOrigin?: string;
  publicAuthorities?: string[];
  allowedCidrs?: string[];
  stateFile: string;
  /** Internal persisted on/off preference managed by the DSH plugin card. */
  controlFile: string;
  /** Optional user stylesheet served to the authenticated mobile UI. */
  customCssFile?: string;
  /** Optional user script that mounts authenticated mobile-only Web features. */
  customScriptFile?: string;
  /** Internal dedicated mobile layout browser bundle. */
  mobileLayoutFile?: string;
  /** Standalone browser compatibility bundle used before DSH boot. */
  mobileCompatibilityFile?: string;
  /** Optional application-phase client package ids omitted only from the mobile boot graph. */
  excludedClientModules?: string[];
  /** Compression is opt-in; it does not authorize additional WebSocket paths. */
  websocketCompression?: WebSocketCompressionConfig;
  /** Stable public discovery identifier; it is not an authentication secret. */
  instanceId?: string;
  /** Managed CA certificate offered to the Android installer after fingerprint binding. */
  pairingCaFile?: string;
  /** First-run state used only while the control file does not exist. */
  initiallyEnabled: boolean;
  tls?: {
    mode?: 'provided' | 'disabled';
    certFile?: string;
    keyFile?: string;
    caFile?: string;
  };
  pairingTtlMs?: number;
  deviceTtlMs?: number;
  sessionTtlMs?: number;
  maxDevices?: number;
  maxSessions?: number;
  maxConnections?: number;
  maxActiveRequests?: number;
  maxWebSockets?: number;
  maxBodyBytes?: number;
  /** Transport, upload, static-response and WebSocket-handshake idle timeout. */
  upstreamTimeoutMs?: number;
  /** Authenticated /api response idle timeout after upload; zero disables it. */
  upstreamApiTimeoutMs?: number;
  rateLimitWindowMs?: number;
  maxPairingAttempts?: number;
  maxRateLimitKeys?: number;
}
/** Resolved, validated security and resource limits. */
interface ResolvedGatewayConfig {
  readonly hostExecution: ResolvedHostExecutionConfig;
  readonly listenHost: string;
  readonly listenPort: number;
  readonly upstreamOrigin: URL;
  readonly authorities: readonly AuthoritySpec[];
  readonly allowedCidrs: readonly ParsedCidr[];
  readonly stateFile: string;
  /** Local extension root adjacent to the mobile-access state file. */
  readonly extensionsDir: string;
  readonly customCssFile: string;
  readonly customScriptFile: string;
  readonly mobileLayoutFile: string;
  readonly mobileCompatibilityFile: string;
  readonly excludedClientModules: readonly string[];
  readonly websocketCompression: ResolvedWebSocketCompressionConfig;
  readonly instanceId: string;
  readonly pairingCaFile?: string;
  readonly tls: TlsConfig;
  /** Whether the public hop is HTTPS, even when a trusted loopback proxy terminates TLS. */
  readonly publicTls: boolean;
  /** LAN discovery is disabled for private proxy listeners such as Funnel ingress. */
  readonly discovery: boolean;
  readonly pairingTtlMs: number;
  readonly deviceTtlMs: number;
  readonly sessionTtlMs: number;
  readonly maxDevices: number;
  readonly maxSessions: number;
  readonly maxConnections: number;
  readonly maxActiveRequests: number;
  readonly maxWebSockets: number;
  readonly maxBodyBytes: number;
  readonly upstreamTimeoutMs: number;
  readonly upstreamApiTimeoutMs: number;
  readonly rateLimitWindowMs: number;
  readonly maxPairingAttempts: number;
  readonly maxRateLimitKeys: number;
}
/** Loader-facing defaults; {@link parseGatewayConfig} enforces cross-field security rules. */
export declare const Config: z<PluginConfig>;
/** Resolve the hidden runtime-control file independently from gateway configuration. */
export declare function parseControlFile(value: unknown): string;
/** Parse configuration and reject unsafe topology, credential, and resource combinations. */
export declare function parseGatewayConfig(raw: unknown): ResolvedGatewayConfig;
//#endregion
//#region src/client-module-preferences.d.ts
/** Installed client module metadata, without upstream URLs or host paths. */
interface ClientModuleEntry {
  readonly id: string;
  readonly required: boolean;
  readonly dependencies: readonly string[];
}
/** Selection returned to the computer administrator or the authenticated device. */
interface ClientModulePreferenceView {
  readonly entries: readonly ClientModuleEntry[];
  readonly excludedClientModules: readonly string[];
  readonly defaultExcludedClientModules: readonly string[];
  readonly source: 'device' | 'computer' | 'plugin';
  readonly reloadRequired: true;
}
/** Effective exclusion selection and the current computer default. */
interface ClientModulePreferenceSelection {
  readonly excludedClientModules: readonly string[];
  readonly defaultExcludedClientModules: readonly string[];
  readonly source: ClientModulePreferenceView['source'];
}
/** Atomic, serialized preferences shared by the LAN and remote Gateway instances. */
export declare class ClientModulePreferenceStore {
  readonly file: string;
  private readonly defaults;
  private value;
  private initialization;
  private queue;
  constructor(file: string, defaults: readonly string[]);
  /** Read existing state once. Missing state is not written during initialization. */
  initialize(): Promise<void>;
  private load;
  private selection;
  private exclusive;
  /** Resolve one device override, otherwise the computer or plugin default. */
  read(deviceId?: string): Promise<ClientModulePreferenceSelection>;
  /** Revalidate against the current boot manifest inside the serialized mutation. */
  configure(excluded: unknown, deviceId: string | undefined, validate: (selection: readonly string[]) => Promise<void>): Promise<ClientModulePreferenceSelection>;
  /** Remove only the selected override; retain all other device selections. */
  reset(deviceId: string | undefined, validate: (selection: readonly string[]) => Promise<void>): Promise<ClientModulePreferenceSelection>;
  /** Remove exactly the revoked device's record without evaluating its obsolete graph. */
  removeDevice(deviceId: string): Promise<void>;
  /** Remove an explicit set of revoked identities, not every record in the shared store. */
  removeDevices(deviceIds: readonly string[]): Promise<void>;
  private save;
}
//#endregion
//#region src/control.d.ts
/** Versioned durable preference for the resident mobile-access runtime. */
interface MobileAccessControlState {
  readonly version: 1;
  readonly enabled: boolean;
}
/** Persistence seam for the runtime preference. */
interface MobileAccessControlStore {
  load(): Promise<MobileAccessControlState>;
  save(state: MobileAccessControlState): Promise<void>;
}
/** One started gateway runtime owned by the controller. */
interface MobileAccessRuntime {
  close(): Promise<void>;
}
/** Validate control state loaded across the filesystem boundary. */
export declare function parseMobileAccessControlState(value: unknown): MobileAccessControlState;
/** Atomic JSON store whose absent-file state comes from the installation-time default. */
export declare class JsonMobileAccessControlStore implements MobileAccessControlStore {
  private readonly file;
  private readonly initiallyEnabled;
  constructor(file: string, initiallyEnabled: boolean);
  /** Avoid writing an absent already-disabled state without changing recovery of existing files. */
  disableIfPresent(): Promise<void>;
  load(): Promise<MobileAccessControlState>;
  save(state: MobileAccessControlState): Promise<void>;
}
/** Serialized persistent lifecycle for the gateway behind the always-loaded Cordis entry. */
export declare class MobileAccessGatewayController {
  private readonly store;
  private readonly startRuntime;
  private runtime;
  private initialized;
  private closing;
  private queue;
  private closeTask;
  constructor(store: MobileAccessControlStore, startRuntime: () => Promise<MobileAccessRuntime>);
  /** Load the durable preference and start the first runtime when enabled. */
  initialize(): Promise<void>;
  /** Return the committed in-process runtime state. */
  isRunning(): boolean;
  /** Start or stop the runtime and persist only a successfully committed transition. */
  setRunning(running: boolean): Promise<void>;
  /** Stop the runtime after earlier transitions without changing the restart preference. */
  close(): Promise<void>;
  private enable;
  private disable;
  private enqueue;
}
//#endregion
//#region src/http-security.d.ts
export declare const DEVICE_COOKIE = "dsh_ma_device";
export declare const SESSION_COOKIE = "dsh_ma_session";
export declare const CSRF_COOKIE = "dsh_ma_csrf";
export declare const CSRF_HEADER = "x-dsh-mobile-csrf";
export declare const LOCAL_ADMIN_PREFIX = "/api/mobile-access";
export declare const AUTH_PREFIX = "/mobile-access";
export declare const WS_PATHS: Set<string>;
/** Terse request failure safe to expose without internal diagnostics. */
declare class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string);
}
//#endregion
//#region src/websocket-paths.d.ts
/** Cap the admin-approved extra WebSocket upgrade paths (exact pathnames). */
export declare const MAX_EXTRA_WEBSOCKET_PATHS = 16;
export declare const MAX_WEBSOCKET_PATH_LENGTH = 256;
/**
 * Validate one exact pathname for proxying. Query strings are matched at
 * upgrade time, so only the pathname is stored. Rejects anything the
 * gateway cannot match exactly.
 */
export declare function validateWebSocketPath(value: unknown): string;
/** Validate a whole replacement list all-or-nothing; duplicates collapse. */
export declare function normalizeWebSocketPaths(value: unknown): string[];
/** Cap remembered rejected upgrade paths offered for one-click approval. */
export declare const MAX_BLOCKED_UPGRADE_PATHS = 32;
interface BlockedUpgradePathEntry {
  readonly path: string;
  readonly attempts: number;
  readonly firstSeen: number;
  readonly lastSeen: number;
}
/**
 * In-memory log of rejected third-party upgrade paths, shared by every
 * gateway instance so the approval UI sees attempts on any listener.
 * Bounded and newest-first; a restart clears it (attempts reappear on
 * the next blocked handshake).
 */
export declare class BlockedUpgradePathLog {
  private readonly entries;
  record(pathname: string): void;
  report(): BlockedUpgradePathEntry[];
}
/** File-backed store shared by every gateway instance (LAN and remote). */
export declare class WebSocketPathStore {
  private readonly file;
  private paths;
  private loaded;
  constructor(file: string);
  /** Snapshot for the upgrade check. */
  has(pathname: string): boolean;
  list(): string[];
  load(): Promise<string[]>;
  /** Replace the whole list after validating; persists atomically. */
  replace(paths: readonly string[]): Promise<string[]>;
}
//#endregion
//#region src/extension-worker-protocol.d.ts
/** Metadata for one action, crossing the boundary without its functions. */
interface WorkerActionMetadata {
  readonly name: string;
  readonly timeoutMs?: number;
}
/** Metadata for one route, crossing the boundary without its functions. */
interface WorkerRouteMetadata {
  readonly method: string;
  readonly path: string;
  readonly kind?: 'exact' | 'prefix';
  readonly timeoutMs?: number;
}
//#endregion
//#region src/extension-worker.d.ts
/** JSON bytes serialized and size-checked inside the worker. */
declare class PreparedJsonResult {
  readonly bytes: Buffer;
  constructor(bytes: Buffer);
}
/** Worker context is logger-only, never a Cordis Context or service proxy. */
type WorkerParentLogger = Record<'debug' | 'info' | 'warn' | 'error', (...args: unknown[]) => void>;
/** Every thread counts until actual exit, including activation, retirement and termination. */
declare class ExtensionWorkerBudget {
  readonly maximum: number;
  private count;
  constructor(maximum: number);
  get current(): number;
  reserve(): () => void;
}
interface ExtensionWorkerHostOptions {
  readonly workerModule: string | URL;
  readonly hostFile: string;
  readonly manifest: LocalExtensionManifest;
  readonly generation: string;
  readonly logger: WorkerParentLogger;
  readonly activationTimeoutMs?: number;
  readonly limits?: HostExecutionConfig;
  readonly budget?: ExtensionWorkerBudget;
  readonly onUnavailable?: (error: MobileExtensionError) => void;
}
interface ExtensionWorkerActivation {
  readonly runtimeId: string;
  readonly actions: readonly WorkerActionMetadata[];
  readonly routes: readonly WorkerRouteMetadata[];
}
declare class ExtensionWorkerHost {
  private readonly options;
  private readonly limits;
  private readonly worker;
  private readonly pending;
  private readonly routePending;
  private readonly streams;
  private readonly detachedRoutes;
  private readonly executionGrace;
  private readonly exited;
  private readonly unavailableController;
  private termination;
  private activation;
  private dead;
  private disposed;
  private maxBufferedBytes;
  private cancelledStreams;
  private logWindowStart;
  private logCount;
  private stdioBytes;
  private stdioResume;
  constructor(options: ExtensionWorkerHostOptions);
  /** A stopped generation never silently respawns. */
  available(): boolean;
  /** Activate once and receive executable-free registration metadata. */
  activate(): Promise<ExtensionWorkerActivation>;
  actionMetadata(): readonly WorkerActionMetadata[];
  routeMetadata(): readonly WorkerRouteMetadata[];
  /** Underlying action: settles only when execution completes or the thread exits. */
  invokeExecution(action: string, input: unknown, caller: {
    readonly signal: AbortSignal;
    readonly deviceId: string;
  }): Promise<PreparedJsonResult>;
  /** Direct caller budget; service dispatch observes invokeExecution separately. */
  invoke(action: string, input: unknown, caller: {
    readonly signal: AbortSignal;
    readonly deviceId: string;
  }): Promise<PreparedJsonResult>;
  /** Underlying route: late streams are cancelled and observed to confirmed end. */
  handleRouteExecution(routeIndex: number, request: MobileRouteRequest): Promise<MobileRouteResponse>;
  /** Handler budget ends at stream-start; stream lifetime remains cancellation-bound. */
  handleRoute(routeIndex: number, request: MobileRouteRequest): Promise<MobileRouteResponse>;
  private callerBudget;
  streamStats(): {
    readonly activeStreams: number;
    readonly maxBufferedBytes: number;
    readonly cancelledStreams: number;
    readonly bufferedBytes: number;
  };
  /** Graceful effects cleanup followed by termination; completion requires actual exit. */
  dispose(): Promise<void>;
  whenExited(): Promise<void>;
  /** Stop admission now, retain execution/budget ownership until confirmed thread exit. */
  terminate(reason: string): Promise<void>;
  private unavailable;
  private markUnavailable;
  private armExecutionGrace;
  private settleExecutionGrace;
  private post;
  private handleMessage;
  private totalUnacked;
  private openStream;
  private cancelStream;
}
//#endregion
//#region src/extensions.d.ts
/** Maximum sizes enforced at the local-extension filesystem boundary. */
export declare const EXTENSION_LIMITS: Readonly<{
  manifest: number;
  script: number;
  css: number;
  asset: number;
  assetFiles: 256;
  assetBytes: number;
  assetDepth: 8;
}>;
/** A controlled business failure returned by an extension action or route. */
export declare class MobileExtensionError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status?: number);
}
/** One host-side action exposed by an extension. */
type CallableActionInput = (value?: never, options?: never) => unknown;
interface MobileHostAction {
  /** A callable Schemastery schema or an adapter exposing parse(). */
  readonly input?: CallableActionInput | {
    parse(value: unknown): unknown;
  };
  /** Optional per-action budget override; validated and snapshotted at registration. */
  readonly timeoutMs?: number;
  readonly run: (context: MobileActionContext, input: unknown) => unknown | Promise<unknown>;
}
/** Context supplied to a host action. */
interface MobileActionContext {
  readonly signal: AbortSignal;
  readonly deviceId: string;
}
/** Safe request values supplied to a host route. */
interface MobileRouteRequest {
  readonly method: string;
  readonly pathname: string;
  readonly query: Readonly<URLSearchParams>;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
  readonly signal: AbortSignal;
  readonly deviceId: string;
}
/** Values an extension route may return; status is a final HTTP code from 200 through 599. */
interface MobileRouteResponse {
  readonly status?: number;
  readonly contentType?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body: string | Uint8Array | Readable;
}
/** One host-side route exposed by an extension. */
interface MobileHostRoute {
  readonly method: string;
  readonly path: string;
  readonly kind?: 'exact' | 'prefix';
  /** Optional per-route handler budget override; validated and snapshotted at registration. */
  readonly timeoutMs?: number;
  readonly handle: (request: MobileRouteRequest) => MobileRouteResponse | Promise<MobileRouteResponse>;
}
/** Metadata shared by local and npm-provided extensions. */
interface MobileExtensionManifest {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
}
/** Definition registered by a normal Cordis plugin. */
interface MobileExtensionDefinition extends MobileExtensionManifest {
  readonly actions?: Readonly<Record<string, MobileHostAction>>;
  readonly routes?: readonly MobileHostRoute[];
}
declare module '@deepseek-ai/cordis' {
  interface Context {
    mobileAccess: MobileAccessService;
  }
}
/** A local extension manifest read from extension.json. */
interface LocalExtensionManifest extends MobileExtensionManifest {}
/** Public snapshot sent to the mobile browser. */
interface MobileExtensionClientEntry extends MobileExtensionManifest {
  readonly generation?: string;
  readonly scriptUrl?: string;
  readonly styleUrl?: string;
  readonly assetsUrl?: string;
}
interface LocalAssetSnapshot {
  readonly body: Buffer;
  readonly digest: string;
  readonly name: string;
}
/** Small status summary used by the desktop mobile-access card. */
interface MobileExtensionStatus {
  readonly loaded: number;
  readonly failed: number;
}
interface ActiveLocalExtension {
  readonly manifest: LocalExtensionManifest;
  readonly directory: string;
  readonly scriptBody?: Buffer;
  readonly styleBody?: Buffer;
  readonly assets: ReadonlyMap<string, LocalAssetSnapshot>;
  readonly host: MobileExtensionDefinition;
  readonly controller: AbortController;
  readonly cleanups: readonly (() => void | Promise<void>)[];
  readonly digest: string;
  readonly worker?: ExtensionWorkerHost;
}
/** Local execution options; the packaged worker entry is used unless a test supplies an override. */
interface LocalExecutionOptions {
  readonly hostExecution?: HostExecutionConfig & {
    readonly workerModule?: string;
  };
  readonly workerBudget?: ExtensionWorkerBudget;
}
/** Worker-host API: logger-only context, with no Cordis services or registrations crossing threads. */
interface MobileWorkerHostApi {
  readonly manifest: LocalExtensionManifest;
  readonly context: {
    readonly logger: WorkerParentLogger;
  };
  readonly schema: typeof z;
  readonly signal: AbortSignal;
  action(name: string, spec: MobileHostAction): void;
  route(spec: MobileHostRoute): void;
  effect(setup: () => void | (() => void | Promise<void>) | Promise<void | (() => void | Promise<void>)>): void;
}
/** Validate a stable extension id. */
export declare function assertExtensionId(value: unknown): string;
/** Validate a manifest from JSON or a plugin definition. */
export declare function parseExtensionManifest(value: unknown): LocalExtensionManifest;
/** Host registry and service consumed by both npm plugins and local extensions. */
export declare class MobileAccessService extends Service {
  private readonly registered;
  private readonly local;
  private readonly retired;
  private readonly failures;
  /** Extensions with caller-detached, still-unresolved operations. */
  private readonly abandoned;
  private readonly contentListeners;
  private contentHash;
  private localRoot;
  private localContext;
  private localTimer;
  private localRefreshing;
  private localRefreshAbort;
  private localLifecycle;
  private localClosed;
  private localExecution;
  private localExecutionKey;
  private workerBudget;
  private readonly disposal;
  private readonly recoveries;
  constructor(ctx: Context);
  /** Register a normal Cordis extension and return an idempotent disposer. */
  registerExtension(definition: MobileExtensionDefinition): () => void;
  /** Aggregate digest covering every registered and active local extension. */
  contentDigest(): string;
  /** Subscribe to committed extension generation changes. */
  onContentChanged(listener: () => void): () => void;
  private updateContentHash;
  /** Return the current client-facing manifest, deterministically sorted by id. */
  manifest(): readonly MobileExtensionClientEntry[];
  /** Return loaded and failed local extension counts without exposing host errors. */
  status(): MobileExtensionStatus;
  /** Local Host status does not reveal filesystem paths, credentials or extension errors. */
  hostStatus(): {
    readonly hosts: readonly {
      readonly id: string;
      readonly name: string;
      readonly mode: 'worker' | 'in-process';
      readonly state: 'ready' | 'unavailable';
      readonly generation: string;
    }[];
    readonly limits: {
      readonly maxWorkers: number;
      readonly workers: number;
    };
  };
  /** Explicitly replace one unavailable worker without replaying requests or changing its files. */
  recoverExtension(id: string): Promise<void>;
  private queueDisposal;
  /** Locate one active extension. */
  extension(id: string, generation?: string): MobileExtensionDefinition | ActiveLocalExtension | undefined;
  /** Return the active local generation signal for gateway cancellation wiring. */
  signal(id: string, generation?: string): AbortSignal | undefined;
  /** Read a local client entry after validating that it remains inside its directory. */
  readClientFile(id: string, kind: 'script' | 'style', signal?: AbortSignal, generation?: string): Promise<{
    readonly body: Buffer;
    readonly digest: string;
  }>;
  /** Read a generation-pinned static asset from its validated snapshot. */
  readAsset(id: string, assetPath: string, signal?: AbortSignal, generation?: string): Promise<{
    readonly body: Buffer;
    readonly digest: string;
    readonly name: string;
  }>;
  /** Reject new dispatches to an extension whose abandoned work is unresolved. */
  private requireAdmission;
  /** Account for one operation until its underlying work actually settles. */
  private trackOperation;
  /** Invoke one action after parsing its input and binding the request lifetime. */
  invoke(id: string, actionName: string, input: unknown, context: MobileActionContext, generation?: string): Promise<unknown>;
  /** Match one route and invoke it with a generation-bound abort signal. */
  route(id: string, method: string, pathname: string, request: MobileRouteRequest, generation?: string): Promise<MobileRouteResponse>;
  /** Start the local directory watcher; an absent directory is intentionally inert. */
  startLocal(root: string, context: Context, options?: LocalExecutionOptions): Promise<void>;
  /** Stop the watcher and abort every local host generation. */
  stopLocal(): Promise<void>;
  /** Refresh all local extensions atomically; failures keep the previous snapshot. */
  refreshLocal(): Promise<void>;
  private stageAndCommit;
  private retire;
}
/** Construct the service in a Cordis plugin without importing DSH internals. */
export declare function createMobileAccessService(ctx: Context): MobileAccessService;
//#endregion
//#region src/gateway.d.ts
/** A graph-selection conflict with a bounded diagnostic safe for authenticated callers. */
export declare class ClientModuleConflictError extends HttpError {
  readonly detail: string;
  constructor(detail: string);
}
/** Rewrite the dedicated mobile graph; exclusions are opt-in and leave stock DSH unchanged. */
export declare function rewriteMobileIndex(html: string, excludedClientModules?: readonly string[]): string;
/** Authenticated TLS edge in front of the ordinary loopback-only DSH Web server. */
export declare class MobileAccessGateway {
  readonly config: ResolvedGatewayConfig;
  private readonly extensions?;
  private readonly upstreamAuthenticatedUrl?;
  private readonly extraWebSocketPaths?;
  private readonly blockedUpgradeLog?;
  private readonly onDiscoveryDegraded?;
  readonly access: AccessController;
  private readonly listenerTlsEnabled;
  private readonly tlsEnabled;
  private policy;
  private server;
  private discoverySocket;
  private discoveryTimer;
  /**
   * Why broadcast discovery is unavailable, if it is. Windows keeps separate TCP and
   * UDP port-exclusion tables, so the port the OS handed the TCP listener can be
   * refused for UDP. That degradation is survivable but must stay observable: without
   * it, "the phone cannot find this computer" has no diagnosable cause on the host.
   */
  private discoveryError;
  private mdnsError;
  /** Names of the bundled mobile assets that could not be read, if any. */
  private mobileAssetError;
  private lastModuleExclusionError;
  private bonjour;
  private pairingCaCertificate;
  private listenerPort;
  private readonly connectedSockets;
  private readonly activeRequests;
  private readonly activeWebSockets;
  private readonly mobileBootBatches;
  /** Cached upstream bundle byte sizes (HEAD probes), keyed by resource URL. */
  private readonly bootEntrySizeCache;
  private readonly extensionEventListeners;
  private extensionEventRevision;
  private readonly taskEventListeners;
  private readonly deviceEventListeners;
  private readonly pendingDeviceRevocations;
  private extensionChangeTimer;
  private extensionChangeTask;
  private legacyCustomDigest;
  private upstreamCookie;
  private upstreamCookieExpiresAt;
  private upstreamCookieTask;
  private upstreamAuthRequest;
  private nextOperationId;
  private closing;
  private started;
  private closeTask;
  private readonly removeSessionListener;
  private readonly removeExtensionContentListener;
  private readonly renewLimiter;
  private readonly probeLimiter;
  private readonly clientModulePreferences;
  private readonly clientModuleOperations;
  private readonly clientModuleTasks;
  private readonly clientModuleRevocations;
  constructor(config: ResolvedGatewayConfig, store: DeviceStore, extensions?: MobileAccessService | undefined, upstreamAuthenticatedUrl?: string | undefined, extraWebSocketPaths?: {
    has(pathname: string): boolean;
  } | undefined, blockedUpgradeLog?: BlockedUpgradePathLog | undefined, onDiscoveryDegraded?: ((source: 'broadcast' | 'mdns', code: string) => void) | undefined, clientModulePreferences?: ClientModulePreferenceStore);
  /** Initialize durable state, validate TLS, and bind the externally reachable listener. */
  start(): Promise<void>;
  /** Install a newly signed provided leaf for future TLS handshakes without dropping sessions. */
  refreshProvidedTls(): Promise<void>;
  private startDiscovery;
  private reportDiscoveryDegraded;
  private recordBroadcastFailure;
  private recordMdnsFailure;
  private discoveryAnnouncement;
  private closeFailedStart;
  private closeBonjour;
  /** Actual bound address, available after start and safe for loopback status output. */
  address(): {
    host: string;
    port: number;
    origin: string;
  };
  /**
   * Report which discovery channels this gateway actually owns.
   *
   * Broadcast discovery degrades on its own when its UDP port cannot be bound, so
   * callers need to tell "discovery is off" from "discovery was never attempted".
   * mDNS is published independently and is unaffected by that failure.
   */
  discoveryStatus(): {
    readonly broadcast: boolean;
    readonly mdns: boolean;
    readonly errorCode?: string;
    readonly mdnsErrorCode?: string;
    readonly mobileAssetsErrorCode?: string;
  };
  private requirePolicy;
  private authorize;
  private requireCsrf;
  private setSessionCookies;
  private setBrowserDeviceBinding;
  private handlePair;
  private handleRenew;
  private handleNativePair;
  private handleNativeRenew;
  private handleNativeProbe;
  private handleLogout;
  private handleExternalRequest;
  private handleExtensionRequest;
  private sendExtensionResponse;
  /** Exchange DSH's process-local launch token for an authority-bound cookie kept inside this gateway. */
  private upstreamCookieHeader;
  private exchangeUpstreamCookie;
  /** List installed modules and resolve the next-open selection.
   * @param deviceId - Authenticated device identity; omitted for computer defaults.
   * @param callerSignal - Cancels catalog fetching when the admin request closes.
   * @returns The installed catalog and effective module selection.
   */
  describeClientModules(deviceId?: string, callerSignal?: AbortSignal): Promise<ClientModulePreferenceView>;
  /** Persist a validated device override or computer default.
   * @param excluded - Untrusted module IDs to validate against the current boot graph.
   * @param deviceId - Authenticated device identity; omitted for computer defaults.
   * @param callerSignal - Cancels fetching and validation, not an atomic write already started.
   * @returns The catalog and saved selection without reloading clients.
   */
  configureClientModules(excluded: unknown, deviceId?: string, callerSignal?: AbortSignal): Promise<ClientModulePreferenceView>;
  /** Reset one override without reloading connected clients.
   * @param deviceId - Authenticated device identity; omitted to reset computer defaults.
   * @param callerSignal - Cancels fetching and validation, not an atomic write already started.
   * @returns The catalog and inherited selection.
   */
  resetClientModules(deviceId?: string, callerSignal?: AbortSignal): Promise<ClientModulePreferenceView>;
  private clientModulePreferenceOperation;
  private fetchAuthenticatedUpstreamIndex;
  private proxyMobileIndex;
  private rememberMobileBootBatch;
  /**
   * Determine which layout-batch entries can share a merged boot batch and which
   * must pass through. An entry at or above the per-entry cap, or one whose size
   * could not be probed, keeps its own upstream `/plugins` row: a merged batch
   * cannot carry it, and an unknown bundle must not risk the whole batch.
   */
  private resolveMobileBootSizes;
  /**
   * Measure one upstream bundle by reading its body. The upstream serves
   * `/plugins` bundles as chunked streams without a Content-Length, so a probe
   * counts bytes; it aborts instantly past the per-entry cap. Measurements are
   * cached for a short window.
   */
  private upstreamBundleSize;
  private serveMobileBootBatch;
  private startMobileBootBatchAssembly;
  private assembleMobileBootBatch;
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
  private readUpstreamClientBundleWithRetry;
  private readUpstreamClientBundle;
  private allocateRequest;
  /**
   * Proxy one request, retrying transient failures for plugin and asset GETs.
   * Only bodyless GETs can be replayed, before response headers reach the client.
   * One request slot and cancellation signal cover attempts and backoff together.
   * API requests and requests with bodies are forwarded once.
   */
  private proxyHttp;
  private proxyHttpOnce;
  private abortSessionResources;
  private broadcastExtensionChange;
  /** Fan a completed task to every phone holding this gateway's event stream. */
  broadcastTaskEvent(event: {
    readonly sessionId: string;
    readonly turn: number;
  }): void;
  /** Notify only the device whose persistent credential was revoked by the Host. */
  private broadcastDeviceRevoked;
  private pollLegacyCustomChanges;
  private openExtensionEventStream;
  private readUpgradeResponse;
  /** Snapshot of rejected upgrade paths for the approval UI (newest first). */
  blockedUpgradePathReport(): BlockedUpgradePathEntry[];
  private handleUpgrade;
  /** Loopback-only DSH WebServer route for opening pairing and managing devices. */
  localAdminRoute(prefix?: string, authenticateDesktop?: (request: IncomingMessage) => boolean): WebRoute;
  /** Close listeners and abort all accepted work before resolving teardown. */
  close(): Promise<void>;
  private performClose;
  /** Safe metadata helper for direct loopback integrations. */
  devices(): readonly DeviceSummary[];
  /** Status shown by the loopback mobile-access control card. */
  extensionStatus(): {
    readonly loaded: number;
    readonly failed: number;
  };
}
//#endregion
//#region src/frp-component.d.ts
interface FrpArtifact {
  readonly platform: NodeJS.Platform;
  readonly arch: string;
  readonly downloadUrl: string;
  readonly downloadBytes: number;
  readonly downloadSha256: string;
  readonly archiveName: string;
  readonly executableName: string;
}
/** Pinned official FRP release metadata for supported desktop targets. */
export declare const FRP_COMPONENT_RELEASES: Readonly<Record<string, FrpArtifact>>;
/** Public, credential-free description of the managed FRP client. */
interface FrpComponentStatus {
  readonly supported: boolean;
  readonly installed: boolean;
  readonly version: string;
  readonly downloadBytes: number;
  readonly installedBytes: number;
  readonly sourceUrl: string;
  readonly releasePage: string;
  readonly storagePath: string;
  readonly errorCode?: string;
}
interface FrpComponentManagerOptions {
  readonly stateDirectory: string;
  readonly platform?: NodeJS.Platform;
  readonly arch?: string;
  readonly fetchArtifact?: (artifact: FrpArtifact, signal: AbortSignal) => Promise<Uint8Array>;
  readonly extractArtifact?: (archive: string, destination: string, executableName: string) => Promise<void>;
  readonly inspectExecutable?: (executable: string) => Promise<string>;
}
/** Owns the optional official frpc binary inside the DSH Mobile state directory. */
export declare class FrpComponentManager {
  readonly executable: string;
  readonly componentRoot: string;
  readonly componentStorage: string;
  readonly logRoot: string;
  private readonly stagingRoot;
  private readonly stateDirectory;
  private readonly artifact;
  private readonly fetchArtifact;
  private readonly extractArtifact;
  private readonly inspectExecutable;
  private installed;
  private installedBytes;
  private errorCode;
  private queue;
  constructor(options: FrpComponentManagerOptions);
  /** Inspect the managed executable without relying on global FRP installations. */
  initialize(): Promise<void>;
  /** Return component metadata without exposing configuration or credentials. */
  status(): FrpComponentStatus;
  /** Download, verify, and extract only frpc after explicit confirmation. */
  install(): Promise<FrpComponentStatus>;
  /** Remove all FRP executable, staging, and log files owned by DSH Mobile. */
  purge(): Promise<FrpComponentStatus>;
  private enqueue;
}
//#endregion
//#region src/frp-template.d.ts
/** Loopback-only HTTP vhost port used between Caddy and frps. */
export declare const FRP_VHOST_HTTP_PORT = 7080;
/** Caddy snippet owned entirely by DSH Mobile; the main Caddyfile only imports it. */
export declare const FRP_CADDY_SNIPPET_PATH = "/etc/caddy/dsh-mobile-dsh.caddy";
/** First line of the owned snippet; also the legacy whole-file marker. */
export declare const FRP_CADDY_SNIPPET_MARKER = "# Managed by DSH Mobile - snippet, safe to delete";
/** Exact line the main Caddyfile must contain (uncommented) for the site to load. */
export declare const FRP_CADDY_IMPORT_LINE = "import /etc/caddy/dsh-mobile-dsh.caddy";
/**
 * Entry TLS mode for the FRP channel.
 *
 * - `public-ip-cert` (default): the VPS Caddy terminates TLS with a public-CA
 *   certificate and reverse-proxies the plaintext vhost to frps.
 * - `self-signed`: no Caddy and no public certificate at all. frps publishes a
 *   raw TCP proxy and the DSH gateway terminates TLS itself with a leaf signed
 *   by its own pairing CA, which the Android app pins through `ca.cer`.
 */
type FrpEntryTls = 'public-ip-cert' | 'self-signed';
/** Optional overrides for the generated Caddy site; every field defaults to the upstream value. */
interface CaddySiteOptions {
  readonly certDir?: string;
  /**
   * The user's real `vhostHTTPPort`. `attach` mode must never assume the
   * upstream 7080: a wrong port silently disables the plaintext-exposure gate.
   */
  readonly vhostHttpPort?: number;
  /** `self-signed` is a TCP passthrough and never produces a Caddy site. */
  readonly entryTls?: FrpEntryTls;
}
/**
 * Build the Caddy site for one public host (without markers or import wiring).
 *
 * The second parameter accepts either a bare certificate directory (the legacy
 * signature) or a full {@link CaddySiteOptions} object, so existing callers keep
 * working unchanged.
 */
export declare function createCaddySite(publicHost: string, options?: CaddySiteOptions | string): string;
/**
 * Build the only supported frps config and Caddy snippet from validated user inputs.
 *
 * Default `options` reproduce the upstream artefact byte for byte; `attach` mode
 * passes the user's real vhost port, and `self-signed` is rejected because that
 * mode publishes a raw TCP proxy instead of an HTTP vhost.
 */
export declare function createRestrictedFrpServerTemplate(serverPort: number, token: string, publicOrigin: string, options?: CaddySiteOptions): string;
//#endregion
//#region src/frp-config.d.ts
/** How the restricted FRP channel is provisioned on the VPS. */
type FrpMode = 'deploy' | 'attach';
/** Public entry port used by the self-signed TCP passthrough (never 443 by requirement). */
export declare const FRP_DEFAULT_PUBLIC_PORT = 33080;
/** Ports owned by other DSH Mobile listeners; the public entry may never reuse them. */
export declare const FRP_RESERVED_PORTS: readonly number[];
/** Credentials and endpoints required by the restricted FRP provider. */
interface FrpSettings {
  readonly version: 1;
  readonly serverAddress: string;
  readonly serverPort: number;
  readonly token: string;
  readonly publicOrigin: string;
  /**
   * `deploy` (default) installs the plugin's own frps on the VPS.
   * `attach` reuses an frps that already runs there and never touches it.
   */
  readonly mode?: FrpMode;
  /** `public-ip-cert` (default) or the gateway-terminated `self-signed` passthrough. */
  readonly entryTls?: FrpEntryTls;
  /** The real `vhostHTTPPort` of the user's frps; defaults to the upstream 7080. */
  readonly vhostHttpPort?: number;
  /** Public entry port of the self-signed TCP proxy; defaults to 33080. */
  readonly publicPort?: number;
}
/** Safe FRP configuration fields returned to the desktop UI. */
interface FrpConfigurationStatus {
  readonly configured: boolean;
  readonly serverAddress?: string;
  readonly serverPort?: number;
  readonly publicOrigin?: string;
  readonly vhostHttpPort: number;
  readonly storagePath: string;
  /** Proxy name frpc registers on the shared frps; unique per DSH installation. */
  readonly proxyName: string;
  readonly errorCode?: string;
  /** Present only when the saved configuration leaves the upstream `deploy` default. */
  readonly mode?: FrpMode;
  /** Present only when the saved configuration uses the self-signed entry. */
  readonly entryTls?: FrpEntryTls;
  /** Present only when a non-default public entry port is saved. */
  readonly publicPort?: number;
}
/** Validate the FRP server hostname or IP address. */
export declare function validateFrpServerAddress(value: unknown): string;
/** Validate the FRP control port. */
export declare function validateFrpServerPort(value: unknown): number;
/** Validate a high-entropy FRP token before durable storage. */
export declare function validateFrpToken(value: unknown): string;
/** Validate the public HTTPS origin used by Caddy and Android pairing. */
export declare function validateFrpPublicOrigin(value: unknown): string;
/** Validate the provisioning mode. */
export declare function validateFrpMode(value: unknown): FrpMode;
/** Validate the entry TLS mode. */
export declare function validateFrpEntryTls(value: unknown): FrpEntryTls;
/** Validate the loopback vhost port of the target frps. */
export declare function validateFrpVhostHttpPort(value: unknown): number;
/** Validate the public entry port of the self-signed TCP proxy. */
export declare function validateFrpPublicPort(value: unknown): number;
/** Effective provisioning mode; an absent field keeps the upstream behaviour. */
export declare function resolveFrpMode(settings: FrpSettings): FrpMode;
/** Effective entry TLS mode; an absent field keeps the upstream behaviour. */
export declare function resolveFrpEntryTls(settings: FrpSettings): FrpEntryTls;
/** Effective loopback vhost port; an absent field keeps the upstream behaviour. */
export declare function resolveFrpVhostHttpPort(settings: FrpSettings): number;
/** Effective public entry port of the self-signed passthrough. */
export declare function resolveFrpPublicPort(settings: FrpSettings): number;
/** True when the gateway terminates TLS itself behind a raw frps TCP proxy. */
export declare function isFrpSelfSignedIngress(settings: FrpSettings): boolean;
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
export declare function parseFrpSettings(value: unknown): FrpSettings;
/**
 * Merge a partial VPS request body with the saved configuration so a blank
 * field keeps its saved value ("已保存时可留空"). Every merged field is still
 * validated; with nothing saved and nothing supplied the result reports a
 * missing configuration instead of silently deploying blanks.
 */
export declare function mergeSavedFrpSettings(partial: Readonly<Record<string, unknown>>, saved: FrpSettings | undefined): FrpSettings;
/** Merge a VPS target (address and control port) with the saved configuration. */
export declare function mergeSavedFrpTarget(partial: Readonly<Record<string, unknown>>, saved: FrpSettings | undefined): {
  readonly serverAddress: string;
  readonly serverPort: number;
};
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
export declare const FRP_DEFAULT_PROXY_NAME = "dsh-mobile";
/**
 * Validate a proxy name for the generated frpc configuration.
 *
 * frps accepts one proxy per name on the whole server, so the name must be a
 * single safe token: no whitespace, no quotes, no path or bracket characters.
 */
export declare function validateFrpProxyName(value: unknown): string;
/**
 * Proxy name for one DSH installation.
 *
 * Derived from the stable installation identity so two computers sharing one
 * frps never register the same proxy, while a single installation keeps the
 * same name across restarts (so its own stale registration is the only possible
 * conflict, and that one expires with the frps heartbeat).
 */
export declare function frpProxyName(instanceId: string): string;
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
export declare function createFrpcToml(settings: FrpSettings, localPort: number, proxyName?: string): string;
/** Build the matching restricted frps and Caddy templates for one VPS. */
export declare function createFrpServerTemplate(settings: FrpSettings): string;
/** Owns private FRP settings and generation-specific frpc configuration. */
export declare class FrpConfigStore {
  private readonly ownedRoot;
  readonly stateRoot: string;
  readonly settingsFile: string;
  readonly runtimeConfigFile: string;
  /**
   * Proxy name every generated frpc.toml registers.
   *
   * Injected by the composing plugin ({@link frpProxyName}) so one frps can
   * serve several DSH installations; the legacy fixed name stays the default
   * for direct constructions in tests and for the exported API.
   */
  readonly proxyName: string;
  private settingsValue;
  private errorCode;
  constructor(stateDirectory: string, proxyName?: string, ownedRoot?: string);
  /** Load private settings while rejecting links, oversized files, and unknown fields. */
  initialize(): Promise<void>;
  /**
   * Return configuration metadata without exposing the FRP token.
   *
   * The optional keys appear only when the saved configuration departs from the
   * upstream defaults, so the pre-existing field set is unchanged for every
   * legacy configuration.
   */
  status(): FrpConfigurationStatus;
  /** Return private settings only to the provider lifecycle. */
  settings(): FrpSettings | undefined;
  /** Atomically replace private FRP settings. */
  configure(value: unknown): Promise<FrpConfigurationStatus>;
  /** Materialize the private generation-specific frpc configuration. */
  writeRuntimeConfig(localPort: number): Promise<string>;
  /** Remove only configuration files owned by the FRP provider. */
  purge(): Promise<FrpConfigurationStatus>;
}
//#endregion
//#region src/frp-attach.d.ts
/** Default proof path used to confirm the public entry answered from this computer. */
export declare const FRP_ATTACH_DISCOVERY_PATH = "/mobile-access/discovery";
/** Declaration printed above the VPS half of an attach template. */
export declare const FRP_ATTACH_VPS_DECLARATION: string;
/** Declaration printed above the local half of an attach template. */
export declare const FRP_ATTACH_LOCAL_DECLARATION = "# 本机只写入 frpc.toml 并启动 frpc：不安装、不改动本机 frps，也不改动 DSH 自身配置。";
/** Declaration for the self-signed passthrough, which keeps its CA on this computer. */
export declare const FRP_ATTACH_SELF_SIGNED_DECLARATION: string;
/** Optional inputs for attach artefacts; every field falls back to the validated settings. */
interface FrpAttachOptions {
  readonly vhostHttpPort?: number;
  readonly publicPort?: number;
  readonly certDir?: string;
  /** Absolute path of the plugin-written frpc.toml, used for the `frpc verify` self-check. */
  readonly configFile?: string;
  /**
   * Proxy name the previewed frpc.toml registers.
   *
   * Defaults to the legacy fixed name; the panel and the provider pass the
   * installation-derived {@link frpProxyName} so a preview never describes a
   * registration that would collide on a shared frps.
   */
  readonly proxyName?: string;
  /** Loopback port the gateway will listen on; only a placeholder inside the copied runbook. */
  readonly localPort?: number;
  /**
   * Explicit reveal of the shared token inside previews and clipboard copies.
   *
   * Defaults to `false`: every artefact the panel produces on its own stays
   * masked, because the copied text lands in the system clipboard. Only the
   * panel's dedicated "copy the frpc.toml with its token" action sets this, and
   * the result never reaches a stored state, a log, or localStorage.
   */
  readonly revealToken?: boolean;
}
/** The two separated halves of the attach artefact, plus their combined text. */
interface FrpAttachTemplate {
  readonly mode: 'attach';
  readonly vps: string;
  readonly local: string;
  readonly text: string;
}
/**
 * Reject every attach request that could not be carried out safely before any
 * artefact is produced. Attach never installs frps, so it must know the user's
 * real vhost port (unless the self-signed passthrough removes the vhost entirely).
 */
export declare function validateAttachSettings(settings: FrpSettings, options?: FrpAttachOptions): void;
/** Shared VPS-side inputs of both the copied runbook and the panel plan. */
interface FrpAttachVpsParts {
  readonly publicHost: string;
  readonly selfSigned: boolean;
  readonly vhostHttpPort?: number;
  readonly publicPort?: number;
  readonly snippet: string;
  readonly certGuide: readonly string[];
}
/**
 * Derive every VPS-side value once so the copied runbook and the panel plan can
 * never drift apart.
 */
export declare function frpAttachVpsParts(settings: FrpSettings, options?: FrpAttachOptions): FrpAttachVpsParts;
/**
 * Build the attach artefact for an existing frps.
 *
 * The result is deliberately split in two: the VPS half contains only what the
 * user's own server needs (Caddy snippet + import + certificate guidance, or a
 * single firewall rule for the self-signed passthrough), and the local half
 * contains the generated frpc.toml plus its `frpc verify` self-check. Neither
 * half installs, rewrites, or restarts the user's frps.
 */
export declare function createFrpAttachTemplateParts(settings: FrpSettings, options?: FrpAttachOptions): FrpAttachTemplate;
/** Combined attach artefact, ready for the clipboard. */
export declare function createFrpAttachTemplate(settings: FrpSettings, options?: FrpAttachOptions): string;
//#endregion
//#region src/frp-attach-plan.d.ts
/** Stable step identifiers; the panel maps each one to a translated title. */
type FrpAttachStepId = 'write-snippet' | 'add-import' | 'issue-ip-cert' | 'enable-cert-timer' | 'verify-https' | 'open-public-port' | 'verify-frps' | 'verify-entry';
/** One actionable VPS-side step; `title` is a message key, `label` the copied text. */
interface FrpAttachPlanStep {
  readonly id: FrpAttachStepId;
  readonly title: string;
  readonly label: string;
  readonly commands: readonly string[];
  readonly optional: boolean;
  readonly verifyHint: string;
}
/** The local half of the plan: the exact frpc.toml plus its self-check command. */
interface FrpAttachPlanLocal {
  /** The frpc.toml as previewed: masked unless the caller explicitly revealed the token. */
  readonly frpcToml: string;
  /** True when `frpcToml` carries the fixed placeholder instead of the shared token. */
  readonly tokenMasked: boolean;
  readonly verifyCommand: string;
  readonly configFile: string;
  readonly declaration: string;
}
/** Zero-SSH plan for attaching to an frps the user already runs. */
interface FrpAttachPlan {
  readonly mode: 'attach';
  readonly entryTls: FrpEntryTls;
  readonly vhostHttpPort?: number;
  readonly publicPort?: number;
  readonly local: FrpAttachPlanLocal;
  readonly vps: readonly FrpAttachPlanStep[];
  readonly warnings: readonly string[];
}
/**
 * Build the copy-only attach plan. It performs no network access, no SSH, and no
 * filesystem write: the caller renders or copies the steps and the local frpc
 * configuration is written by the ordinary provider lifecycle.
 */
export declare function createFrpAttachPlan(settings: FrpSettings, options?: FrpAttachOptions): FrpAttachPlan;
//#endregion
//#region src/cert-renewal.d.ts
/** Days left below which the entry certificate is reported as expiring. */
export declare const CERT_EXPIRING_DAYS = 2;
/** Read-only lifetime verdict for one certificate; never mutates or renews anything. */
interface CertRenewalStatus {
  readonly state: 'ok' | 'expiring' | 'expired' | 'unknown';
  /** Unix milliseconds of `notAfter`. */
  readonly notAfter?: number;
  readonly daysRemaining?: number;
  readonly subject?: string;
  readonly issuer?: string;
  readonly errorCode?: string;
}
/** Evaluate one `notAfter` timestamp against the current clock. */
export declare function evaluateCertificateLifetime(notAfter: number, now?: number): CertRenewalStatus;
/**
 * Read one PEM certificate from disk and report only its lifetime.
 *
 * A missing or unreadable file yields `unknown` with the stable
 * `frp_attach_cert_unknown` code so the panel can explain how to re-issue it.
 */
export declare function readCertificateRenewal(file: string, now?: number): Promise<CertRenewalStatus>;
/**
 * Ask a live TLS endpoint for its leaf certificate and report its lifetime.
 *
 * Verification is intentionally skipped: this is a read-only lifetime probe for
 * an endpoint whose trust anchor is already pinned elsewhere, and a self-signed
 * leaf is the expected answer for the passthrough entry.
 */
export declare function probeOriginCertificate(host: string, port: number, timeoutMs?: number): Promise<CertRenewalStatus>;
//#endregion
//#region src/frp-ingress.d.ts
/** Private files owned by the self-signed FRP ingress. */
interface FrpIngressPaths {
  readonly directory: string;
  readonly caCertFile: string;
  readonly caKeyFile: string;
  readonly certFile: string;
  readonly keyFile: string;
  readonly statusFile: string;
}
/** Signed ingress material plus the fingerprint the app must pin. */
interface FrpIngressCertificate {
  readonly paths: FrpIngressPaths;
  readonly ca: X509Certificate;
  readonly leaf: X509Certificate;
  readonly caFingerprint: string;
  readonly status: CertRenewalStatus;
}
/** Everything the panel needs for the on-demand self-check. */
interface FrpIngressSelfCheck {
  readonly mode: 'deploy' | 'attach';
  readonly entryTls: 'public-ip-cert' | 'self-signed';
  readonly vhostHttpPort: number;
  readonly publicPort: number;
  readonly publicOrigin: string;
  /** Reachable HTTPS entry; includes the TCP proxy port in self-signed mode. */
  readonly entryOrigin: string;
  readonly serverAddress: string;
  readonly serverPort: number;
  readonly caFingerprint?: string;
  readonly certificate?: CertRenewalStatus;
  readonly caCertificate?: CertRenewalStatus;
  readonly inbound: {
    readonly listenHost: '127.0.0.1';
    readonly allowedCidrs: readonly string[];
  };
}
/** Private ingress directory, always a sibling of the remote device file. */
export declare function frpIngressPaths(stateFile: string): FrpIngressPaths;
/**
 * Materialize the CA and leaf the gateway terminates TLS with.
 *
 * The CA remains stable for paired phones; an expired CA must be re-paired, not
 * replaced silently. The leaf is re-signed when expiring or no longer valid for
 * the public IPv4, and the running gateway reloads it after a renewal check.
 */
export declare function ensureFrpIngressCertificate(settings: FrpSettings, stateFile: string, now?: number, expectedCaFingerprint?: string, ownedRoot?: string): Promise<FrpIngressCertificate>;
/**
 * Build the read-only self-check payload shown in the desktop panel.
 *
 * No secret ever leaves this function: the CA is reported by fingerprint only,
 * and the token is never read.
 */
export declare function frpIngressSelfCheck(settings: FrpSettings, stateFile: string, ownedRoot?: string): Promise<FrpIngressSelfCheck>;
//#endregion
//#region src/managed-setup.d.ts
/** One host a server leaf must be valid for: an IP literal, a DNS name, or both. */
interface ServerCertificateTarget {
  readonly commonName: string;
  readonly ipAddresses?: readonly string[];
  readonly dnsNames?: readonly string[];
}
/** Where a freshly signed server leaf is installed. */
interface ServerCertificateFiles {
  readonly certFile: string;
  readonly keyFile: string;
}
/** CA material a leaf is signed with. */
interface ServerCertificateAuthority {
  readonly caCertFile: string;
  readonly caKeyFile: string;
}
/**
 * Sign one server leaf with an existing self-signed CA and install it privately.
 *
 * Both the LAN listener and the self-signed FRP ingress use this one path, so a
 * certificate can never be produced by two divergent code paths. IP entries are
 * required for console addresses (`type: 7`), DNS entries (`type: 2`) cover named
 * hosts; the Android client accepts either through its pinned CA.
 */
export declare function issueServerCertificate(authority: ServerCertificateAuthority, target: ServerCertificateTarget, output: ServerCertificateFiles, lifetimeDays?: number): Promise<void>;
//#endregion
//#region src/remote.d.ts
/** Remote transports supported by the desktop plugin and Android client. */
type RemoteProvider = 'tailscale' | 'cpolar' | 'cloudflared' | 'frp' | 'origin';
/** Common safe status returned by every remote provider controller. */
interface RemoteProviderStatus {
  readonly enabled: boolean;
  readonly state: string;
  readonly origin?: string;
  readonly backendOrigin?: string;
  readonly loginUrl?: string;
  readonly setupUrl?: string;
  readonly errorCode?: string;
}
/** Lifecycle shared by selectable remote providers. */
interface RemoteProviderController {
  initialize(): Promise<void>;
  gateway(): MobileAccessGateway | undefined;
  status(): RemoteProviderStatus;
  setEnabled(enabled: boolean): Promise<RemoteProviderStatus>;
  reconnect(): Promise<RemoteProviderStatus>;
  reset(): Promise<RemoteProviderStatus>;
  close(): Promise<void>;
}
/** Durable selection for the single active remote transport. */
interface RemoteProviderState {
  readonly version: 1;
  readonly provider: RemoteProvider;
}
export declare const REMOTE_PROVIDERS: readonly RemoteProvider[];
/** Validate the provider selection loaded across the filesystem boundary. */
export declare function parseRemoteProviderState(value: unknown): RemoteProviderState;
/** Atomic selection store whose absent-file state uses the configured default. */
export declare class JsonRemoteProviderStore {
  private readonly file;
  private readonly defaultProvider;
  constructor(file: string, defaultProvider: RemoteProvider);
  load(): Promise<RemoteProviderState>;
  save(state: RemoteProviderState): Promise<void>;
}
/** Resolve the first-run provider without letting environment values bypass validation. */
export declare function configuredRemoteProvider(environment: NodeJS.ProcessEnv): RemoteProvider;
//#endregion
//#region src/frp.d.ts
/** Product-facing states for the restricted self-hosted FRP transport. */
type FrpState = 'off' | 'unavailable' | 'starting' | 'connecting' | 'ready' | 'error';
/** Safe FRP state returned only through the loopback DSH control route. */
interface FrpStatus {
  readonly enabled: boolean;
  readonly state: FrpState;
  readonly origin?: string;
  readonly errorCode?: string;
}
/**
 * Explicit target of the start-up discovery self-check.
 *
 * The target is derived from the effective entry, never assumed: the public-CA
 * entry answers on the saved origin (443 behind Caddy, publicly trusted chain),
 * while the self-signed entry is a raw TCP passthrough on `publicPort` whose
 * leaf chains to the plugin's own ingress CA.
 */
interface FrpDiscoveryProbeTarget {
  /** Absolute HTTPS origin to dial, including the public entry port. */
  readonly origin: string;
  /**
   * PEM bundle that anchors the entry leaf in place of the system trust store.
   * Absent keeps the default chain, which is correct for a publicly trusted
   * certificate; it is never a way to skip verification.
   */
  readonly trustAnchorPem?: string;
}
/** Inputs for one FRP client process and authenticated DSH gateway. */
interface FrpControllerOptions {
  readonly store: MobileAccessControlStore;
  readonly executable: string;
  readonly config: FrpConfigStore;
  /**
   * Plugin-wide installation identity (the LAN pairing CA fingerprint).
   *
   * Retained for backward compatibility and constructor validation only. It no
   * longer takes part in the start-up self-check: that check compares against the
   * identity of the gateway this controller created and advertises, because the
   * self-signed FRP ingress gateway is pinned to the ingress CA fingerprint by
   * design, and that value deliberately differs from this one.
   */
  readonly instanceId: string;
  readonly createGateway: (origin: string, settings: FrpSettings) => Promise<MobileAccessGateway>;
  readonly onStatus?: (status: FrpStatus) => void;
  readonly verifyConfig?: (executable: string, configFile: string) => Promise<void>;
  readonly launchClient?: (executable: string, configFile: string) => ChildProcessWithoutNullStreams;
  readonly probeVhostExposure?: (serverAddress: string, port: number) => Promise<boolean>;
  readonly probeDiscovery?: (target: FrpDiscoveryProbeTarget, expectedInstanceId: string, signal: AbortSignal) => Promise<boolean>;
  /**
   * Resolve the CA the self-check must pin for the self-signed entry.
   *
   * Only the composing plugin knows where the ingress material lives, so the
   * trust anchor is injected instead of guessed here. Consulted solely for the
   * self-signed passthrough; the public-CA entry always keeps the system trust
   * store. A configured resolver that cannot provide the CA fails startup with
   * `frp_ingress_ca_invalid`; the system trust store must not mask that failure.
   */
  readonly resolveDiscoveryTrustAnchor?: (settings: FrpSettings) => Promise<string | undefined>;
  /** Re-issue an expiring leaf and reload the live TLS listener without changing its CA. */
  readonly maintainIngressCertificate?: (settings: FrpSettings, gateway: MobileAccessGateway) => Promise<void>;
  /** Test seam for the maintenance timer; the product uses a twelve-hour interval. */
  readonly ingressCertificateCheckMs?: number;
  readonly startTimeoutMs?: number;
  readonly retryIntervalMs?: number;
}
/** Owns frpc, its generation-specific configuration, and the remote gateway. */
export declare class FrpController implements RemoteProviderController {
  private readonly options;
  private enabled;
  private initialized;
  private disposed;
  private child;
  private gatewayValue;
  private generation;
  private latest;
  private queue;
  private startupAbort;
  private ingressCertificateTimer;
  constructor(options: FrpControllerOptions);
  /** Restore the remembered FRP switch without changing LAN or other providers. */
  initialize(): Promise<void>;
  /** Return the active FRP-backed DSH gateway. */
  gateway(): MobileAccessGateway | undefined;
  /** Return state safe for the desktop control UI. */
  status(): FrpStatus;
  /** Enable or disable FRP without changing LAN or another provider. */
  setEnabled(enabled: boolean): Promise<FrpStatus>;
  /** Restart FRP while retaining its private server settings and devices. */
  reconnect(): Promise<FrpStatus>;
  /** Disable FRP without deleting its explicitly managed component or settings. */
  reset(): Promise<FrpStatus>;
  /** Stop all FRP resources without changing the remembered switch. */
  close(): Promise<void>;
  private enqueue;
  private publish;
  private start;
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
  private discoveryCheck;
  private waitForDiscovery;
  private scheduleIngressCertificateCheck;
  private failGeneration;
  private stop;
  private stopProcessAndGateway;
}
//#endregion
//#region src/origin-proxy-config.d.ts
export declare const DEFAULT_ORIGIN_LISTEN_PORT = 3444;
/** A private HTTP listener behind a user-managed HTTPS reverse proxy. */
interface OriginSettings {
  readonly version: 1;
  readonly publicOrigin: string;
  readonly listenHost: string;
  readonly listenPort: number;
  readonly allowedCidrs: readonly string[];
}
/** Configuration metadata returned only to the local desktop control UI. */
interface OriginConfigurationStatus {
  readonly configured: boolean;
  readonly publicOrigin?: string;
  readonly listenHost?: string;
  readonly listenPort?: number;
  readonly allowedCidrs?: readonly string[];
  readonly backendOrigin?: string;
  readonly storagePath: string;
  readonly errorCode?: string;
}
/** Require a public HTTPS origin; custom external ports are supported. */
export declare function validateOriginPublicOrigin(value: unknown): string;
/** Bind only one explicit loopback or RFC1918 IPv4 interface, never all interfaces. */
export declare function validateOriginListenHost(value: unknown): string;
export declare function validateOriginListenPort(value: unknown): number;
/** Authorize direct proxy socket peers, not untrusted forwarded client headers. */
export declare function validateOriginAllowedCidrs(value: unknown, listenHost: string): readonly string[];
/** Validate both saved settings and local administrative requests. */
export declare function parseOriginSettings(value: unknown): OriginSettings;
/** Owns only origin settings; shared paired-device storage is never removed. */
export declare class OriginConfigStore {
  private readonly ownedRoot;
  readonly stateRoot: string;
  readonly settingsFile: string;
  private settingsValue;
  private errorCode;
  constructor(stateDirectory: string, ownedRoot?: string);
  initialize(): Promise<void>;
  status(): OriginConfigurationStatus;
  settings(): OriginSettings | undefined;
  configure(value: unknown): Promise<OriginConfigurationStatus>;
  purge(): Promise<OriginConfigurationStatus>;
}
//#endregion
//#region src/origin-proxy.d.ts
type OriginState = 'off' | 'unavailable' | 'starting' | 'ready' | 'error';
/** Ready means the private listener is ready, not that public ingress was tested. */
interface OriginStatus {
  readonly enabled: boolean;
  readonly state: OriginState;
  readonly origin?: string;
  readonly backendOrigin?: string;
  readonly errorCode?: string;
}
interface OriginControllerOptions {
  readonly store: MobileAccessControlStore;
  readonly config: OriginConfigStore;
  readonly createGateway: (settings: OriginSettings) => Promise<MobileAccessGateway>;
  readonly onStatus?: (status: OriginStatus) => void;
}
/** Owns an authenticated HTTP gateway, with no tunnel process or public network probes. */
export declare class OriginController implements RemoteProviderController {
  private readonly options;
  private enabled;
  private initialized;
  private disposed;
  private gatewayValue;
  private latest;
  private queue;
  constructor(options: OriginControllerOptions);
  initialize(): Promise<void>;
  gateway(): MobileAccessGateway | undefined;
  status(): OriginStatus;
  setEnabled(enabled: boolean): Promise<OriginStatus>;
  reconnect(): Promise<OriginStatus>;
  /** Reset the switch, retaining both settings and shared remote device pairings. */
  reset(): Promise<OriginStatus>;
  /** Stop the listener without changing the durable switch. */
  close(): Promise<void>;
  private assertAvailable;
  private enqueue;
  private publish;
  private start;
  private stop;
}
//#endregion
//#region src/cloudflared-component.d.ts
/**
 * Pinned cloudflared components fetched only after an explicit user action.
 *
 * Cloudflare ships bare executables for Windows and Linux but a `.tgz` for
 * macOS, so an artifact carries two digests: the bytes on the wire
 * (`downloadBytes`/`downloadSha256`) and the executable that ends up installed
 * (`executableBytes`/`executableSha256`). For bare artifacts the two pairs are
 * identical. `--no-autoupdate` is passed at runtime as well, so the pinned
 * bytes stay the bytes that were verified.
 */
interface CloudflaredArtifact {
  readonly version: string;
  readonly platform: NodeJS.Platform;
  readonly arch: string;
  readonly downloadUrl: string;
  readonly downloadBytes: number;
  readonly downloadSha256: string;
  readonly executableName: string;
  /** Bytes of the installed executable; equals `downloadBytes` for bare artifacts. */
  readonly executableBytes: number;
  readonly executableSha256: string;
  /** Set when the download is an archive rather than the executable itself. */
  readonly archive?: CloudflaredArchive;
}
interface CloudflaredArchive {
  readonly format: 'tgz';
  /** Member basename to install, e.g. `cloudflared`. */
  readonly member: string;
}
/** Pinned official cloudflared release metadata for supported desktop targets. */
export declare const CLOUDFLARED_COMPONENT_RELEASES: Readonly<Record<string, CloudflaredArtifact>>;
/**
 * Canonical release metadata. New code should select from
 * {@link CLOUDFLARED_COMPONENT_RELEASES} by platform and architecture; this
 * alias preserves the original Windows x64 entry for existing callers.
 */
export declare const CLOUDFLARED_COMPONENT_RELEASE: CloudflaredArtifact;
/**
 * Public, credential-free description of the managed cloudflared component.
 *
 * There is deliberately no `configured` flag: a quick tunnel needs no account,
 * token, or DNS record, so installation is the only precondition.
 */
interface CloudflaredComponentStatus {
  readonly supported: boolean;
  readonly installed: boolean;
  readonly version: string;
  readonly downloadBytes: number;
  readonly installedBytes: number;
  readonly sourceUrl: string;
  readonly downloadPage: string;
  readonly termsUrl: string;
  readonly storagePath: string;
  readonly errorCode?: string;
}
interface CloudflaredComponentManagerOptions {
  readonly stateDirectory: string;
  readonly platform?: NodeJS.Platform;
  readonly arch?: string;
  readonly fetchArtifact?: (url: string, signal: AbortSignal) => Promise<Uint8Array>;
  readonly extractArtifact?: (archive: string, destination: string, member: string) => Promise<void>;
}
/** Owns the optional cloudflared binary inside DSH Mobile state. */
export declare class CloudflaredComponentManager {
  readonly executable: string;
  readonly componentRoot: string;
  readonly componentStorage: string;
  readonly stateRoot: string;
  readonly logRoot: string;
  private readonly stagingRoot;
  private readonly stateDirectory;
  private readonly platform;
  private readonly arch;
  private readonly release;
  private readonly fetchArtifact;
  private readonly extractArtifact;
  private installed;
  private errorCode;
  private queue;
  constructor(options: CloudflaredComponentManagerOptions);
  /** Inspect the managed binary without using any global cloudflared state. */
  initialize(): Promise<void>;
  /** Return a safe status that never includes machine-specific account data. */
  status(): CloudflaredComponentStatus;
  /** Download, verify, and install the pinned cloudflared executable after explicit confirmation. */
  install(): Promise<CloudflaredComponentStatus>;
  /** Remove every cloudflared file owned by DSH Mobile without touching global state. */
  purge(): Promise<CloudflaredComponentStatus>;
  private enqueue;
}
//#endregion
//#region src/cloudflared-tunnel.d.ts
/** Which tunnel flavour the cloudflared provider runs. */
type CloudflaredTunnelMode = 'quick' | 'named';
/**
 * Cloudflared provider configuration.
 *
 * A quick tunnel owns nothing durable: cloudflared allocates a random hostname
 * and a random forward port every start. A named tunnel instead runs with an
 * account token, and its public hostname is routed by Cloudflare to the local
 * port recorded here, so that port must stay stable across restarts.
 */
type CloudflaredTunnelSettings = {
  readonly version: 1;
  readonly mode: 'quick';
} | {
  readonly version: 1;
  readonly mode: 'named';
  readonly token: string;
  readonly hostname: string;
  readonly port: number;
};
/** Configuration metadata safe to hand to the desktop panel; never the token. */
interface CloudflaredTunnelStatus {
  readonly mode: CloudflaredTunnelMode;
  readonly configured: boolean;
  readonly hostname?: string;
  readonly port?: number;
  readonly storagePath: string;
  readonly errorCode?: string;
}
/**
 * Validate the public hostname Cloudflare routes to this tunnel.
 *
 * The name must be a real DNS name, not an IP literal or a wildcard, and it
 * cannot sit under Cloudflare's own control-plane suffixes: `trycloudflare.com`
 * belongs to quick tunnels, and a `cfargotunnel.com` name is the routing target
 * rather than a routable public address.
 */
export declare function validateCloudflaredTunnelHostname(value: unknown): string;
/** Validate the stable loopback port Cloudflare's ingress forwards to. */
export declare function validateCloudflaredTunnelPort(value: unknown): number;
/**
 * Validate a connector token before durable storage.
 *
 * A token is a base64url-encoded JSON blob that carries the account, tunnel id
 * and tunnel secret; the provider passes it through the environment rather than
 * the command line, and it is never returned to any client.
 */
export declare function validateCloudflaredTunnelToken(value: unknown): string;
/** Parse tunnel settings at the request and filesystem boundaries. */
export declare function parseCloudflaredTunnelSettings(value: unknown): CloudflaredTunnelSettings;
/**
 * Merge a partial panel request with the saved named-tunnel settings so a blank
 * field keeps its stored value. The token in particular is write-only, so the
 * panel submits an empty string to mean "keep the existing connector token".
 */
export declare function mergeSavedCloudflaredTunnelSettings(partial: Readonly<Record<string, unknown>>, saved: CloudflaredTunnelSettings | undefined): CloudflaredTunnelSettings;
/** Owns the private cloudflared tunnel configuration for one DSH installation. */
export declare class CloudflaredTunnelStore {
  private readonly ownedRoot;
  readonly stateRoot: string;
  readonly settingsFile: string;
  private settingsValue;
  private errorCode;
  constructor(stateDirectory: string, ownedRoot?: string);
  /** Load private settings while rejecting links, oversized files and unknown fields. */
  initialize(): Promise<void>;
  /** Return configuration metadata without exposing the connector token. */
  status(): CloudflaredTunnelStatus;
  /** Return private settings only to the provider lifecycle. */
  settings(): CloudflaredTunnelSettings;
  /** Atomically replace the tunnel configuration. */
  configure(value: unknown): Promise<CloudflaredTunnelStatus>;
  /** Forget a named tunnel and its connector token. */
  purge(): Promise<CloudflaredTunnelStatus>;
}
//#endregion
//#region src/cloudflared.d.ts
/** Product-facing states for the optional cloudflared remote transport. */
type CloudflaredState = 'off' | 'unavailable' | 'starting' | 'connecting' | 'ready' | 'error';
/** Safe cloudflared state returned only through the loopback DSH control route. */
interface CloudflaredStatus {
  readonly enabled: boolean;
  readonly state: CloudflaredState;
  readonly origin?: string;
  readonly errorCode?: string;
}
/** Inputs for one cloudflared process and its authenticated DSH gateway. */
interface CloudflaredControllerOptions {
  readonly store: MobileAccessControlStore;
  readonly executable: string;
  /** Named-tunnel configuration; quick tunnels are used when it reports quick mode. */
  readonly tunnel: {
    settings(): CloudflaredTunnelSettings;
  };
  readonly createGateway: (origin: string, listenPort: number) => Promise<MobileAccessGateway>;
  readonly onStatus?: (status: CloudflaredStatus) => void;
  /** Liveness bound for one startup-timeout round; defaults to the product timeout. */
  readonly startupTimeoutMs?: number;
  /**
   * Total startup-timeout rounds before a live named connector is given up on;
   * defaults to NAMED_STARTUP_ROUNDS. Quick tunnels always use a single round.
   */
  readonly maxStartupRounds?: number;
  readonly spawnProcess?: (executable: string, args: readonly string[], environment: NodeJS.ProcessEnv) => ChildProcessWithoutNullStreams;
}
/**
 * Extract a validated public HTTPS origin from one cloudflared output line.
 *
 * Quick tunnels print the public hostname inside a decorated banner, so the
 * candidate is taken from the line and then re-parsed as a URL: a lookalike such
 * as `https://x.trycloudflare.com.evil.test` fails the hostname check instead of
 * being truncated into an accepted origin.
 */
export declare function parseCloudflaredOrigin(line: string): string | undefined;
/**
 * Whether one cloudflared log line reports an established edge connection.
 *
 * A named tunnel prints no banner, so registration is the only signal that the
 * connector reached Cloudflare and the public hostname can serve traffic. Both
 * the current and the older wording are accepted; anything else is ignored so a
 * chatty log line cannot be mistaken for readiness.
 */
export declare function isCloudflaredRegistration(line: string): boolean;
/**
 * Owns an installed cloudflared client and a provider-specific DSH remote gateway.
 *
 * Quick tunnels allocate a random hostname and a random forward port on every
 * start. Named tunnels instead read an account token and a stable public
 * hostname from the tunnel store, forward to the configured loopback port, and
 * learn readiness from the connector's registration line rather than a banner.
 */
export declare class CloudflaredController implements RemoteProviderController {
  private readonly options;
  private enabled;
  private initialized;
  private disposed;
  private child;
  private gatewayValue;
  private reservation;
  private generation;
  private buffer;
  private mode;
  private namedOrigin;
  private latest;
  private queue;
  private startupTimer;
  private startupRounds;
  constructor(options: CloudflaredControllerOptions);
  /** Restore the remembered cloudflared switch independently from LAN and other providers. */
  initialize(): Promise<void>;
  /** Return the active cloudflared-backed DSH gateway. */
  gateway(): MobileAccessGateway | undefined;
  /** Return state safe for the desktop control UI. */
  status(): CloudflaredStatus;
  /** Enable or disable cloudflared without changing LAN or other provider state. */
  setEnabled(enabled: boolean): Promise<CloudflaredStatus>;
  /** Restart cloudflared and allocate a fresh quick tunnel. */
  reconnect(): Promise<CloudflaredStatus>;
  /** Disable cloudflared without deleting the installed component. */
  reset(): Promise<CloudflaredStatus>;
  /** Stop owned resources without changing the remembered switch. */
  close(): Promise<void>;
  private enqueue;
  private publish;
  private start;
  private armStartupTimer;
  /**
   * Give a live named connector more time instead of killing it: it retries the
   * edge on its own and usually registers once the rebooted network is usable.
   * A dead connector, or an exhausted budget, fails the generation as before.
   */
  private checkStartupTimeout;
  private consume;
  /** Mark a named tunnel ready once the connector has registered with the edge. */
  private confirmNamedReady;
  private attachGateway;
  /** Replace the gateway authority when a quick tunnel restarts on a new hostname. */
  private rotateGateway;
  private failGeneration;
  private stop;
  private stopProcessAndGateway;
}
//#endregion
//#region src/task-events.d.ts
/**
 * Host-side task-completion fan-out for phone notifications.
 *
 * The exact moment a run ends is known only on the Host (the phone page can
 * merely infer it from UI state), so this module watches the public
 * `session/event` bus for completed root turns and hands them to a hub that
 * fans out to every live mobile gateway. Phones render the text locally, so
 * no user content crosses this boundary — only opaque session and turn ids.
 */
/** A completed root turn worth announcing on paired phones. */
interface TaskCompletionEvent {
  readonly sessionId: string;
  readonly turn: number;
}
/** Minimal session shape read off the `session/event` bus. */
interface TaskEventSession {
  readonly id: unknown;
  readonly header?: {
    readonly parentSession?: unknown;
  } | null | undefined;
}
/**
 * Minimal turn event shape read off the `session/event` bus. Fields stay
 * unknown here and are validated at runtime below so this module never
 * depends on the harness session packages.
 */
interface TaskTurnEvent {
  readonly type: string;
  readonly data?: unknown;
}
/** Structural slice of the Host context this module needs (keeps tests cordis-free). */
interface TaskEventContext {
  on(event: 'session/event', handler: (session: TaskEventSession, event: TaskTurnEvent) => void): () => void;
}
interface TaskEventWatcherOptions {
  /** Trailing debounce per session that merges turn-boundary bursts. */
  readonly debounceMs?: number;
  readonly onTaskCompleted: (event: TaskCompletionEvent) => void;
  readonly log?: (event: string, fields: Readonly<Record<string, string | number | boolean>>) => void;
}
export declare const TASK_EVENT_DEBOUNCE_MS = 1000;
/**
 * Subscribe to completed root turns. Subagent turns are skipped so one task
 * announces once, and rapid turn boundaries collapse into a single event.
 * Returns a disposer that also drops pending debounces.
 */
export declare function watchTaskCompletions(ctx: TaskEventContext, options: TaskEventWatcherOptions): () => void;
/** Receives fanned-out completion events (normally a mobile gateway). */
interface TaskEventSink {
  broadcastTaskEvent(event: TaskCompletionEvent): void;
}
/** One subscription feeding every live gateway; gateways register on start. */
export declare class TaskEventHub {
  private readonly sinks;
  /** Register a sink; returns its disposer. */
  add(sink: TaskEventSink): () => void;
  /** Fan out to a snapshot so a failing sink cannot break its siblings. */
  broadcast(event: TaskCompletionEvent): void;
  /** Visible for tests. */
  get size(): number;
}
//#endregion
//#region src/plugin.d.ts
declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'plugin:dsh-mobile': {
      kind: 'plugin:dsh-mobile';
      form: 'notice';
      summary: string;
    };
  }
}
/** Stable Cordis plugin name. */
export declare const name = "dsh-mobile";
/** The stock WebServer serves the control card; Connection authenticates the loopback DSH origin. */
export declare const inject: string[];
/** Reuse remote HTTPS policy while binding a separately validated private HTTP origin. */
export declare function originGatewayConfig(template: ResolvedGatewayConfig, settings: OriginSettings, stateFile: string, instanceId: string, listenPort?: number): ResolvedGatewayConfig;
/** Mount the resident control route and its optional authenticated LAN gateway. */
export declare function apply(ctx: Context, config: PluginConfig): Promise<void>;
//#endregion
export { type AccessControllerOptions, type AuthoritySpec, type BlockedUpgradePathEntry, type CaddySiteOptions, type CertRenewalStatus, type ClientModuleEntry, type ClientModulePreferenceSelection, type ClientModulePreferenceView, type CloudflaredComponentStatus, type CloudflaredControllerOptions, type CloudflaredState, type CloudflaredStatus, type CloudflaredTunnelMode, type CloudflaredTunnelSettings, type CloudflaredTunnelStatus, FRP_VHOST_HTTP_PORT as DEFAULT_VHOST_HTTP_PORT, type DeviceProbeResult, type DeviceSnapshot, type DeviceStore, type DeviceSummary, type DisabledTlsConfig, type FrpAttachOptions, type FrpAttachPlan, type FrpAttachPlanLocal, type FrpAttachPlanStep, type FrpAttachStepId, type FrpAttachTemplate, type FrpAttachVpsParts, type FrpComponentStatus, type FrpConfigurationStatus, type FrpControllerOptions, type FrpEntryTls, type FrpIngressCertificate, type FrpIngressPaths, type FrpIngressSelfCheck, type FrpSettings, type FrpState, type FrpStatus, type HostExecutionConfig, type LocalExtensionManifest, type MobileAccessControlState, type MobileAccessControlStore, type MobileAccessService as MobileAccessRegistry, type MobileAccessRuntime, type MobileActionContext, type MobileExtensionClientEntry, type MobileExtensionDefinition, type MobileExtensionManifest, type MobileExtensionStatus, type MobileHostAction, type MobileHostRoute, type MobileRouteRequest, type MobileRouteResponse, type MobileWorkerHostApi, type OriginConfigurationStatus, type OriginControllerOptions, type OriginSettings, type OriginState, type OriginStatus, type PairingResult, type ParsedCidr, type PluginConfig, type ProvidedTlsConfig, type RemoteProvider, type RemoteProviderController, type RemoteProviderState, type RemoteProviderStatus, type RenewalResult, type ResolvedGatewayConfig, type ResolvedHostExecutionConfig, type ServerCertificateAuthority, type ServerCertificateFiles, type ServerCertificateTarget, type SessionAuthorization, type SessionEndReason, type StoredDevice, type TaskCompletionEvent, type TaskEventContext, type TaskEventSession, type TaskEventSink, type TaskEventWatcherOptions, type TaskTurnEvent, type TlsConfig };
//# sourceMappingURL=index.d.mts.map