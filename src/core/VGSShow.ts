import {
  buildHostValidationUrl,
  buildRequest,
  invalidConfigurationError,
  isValidDataRegion,
  isValidRegionalEnvironment,
  isValidTenantId,
  mapSimulatedResponse,
  resolveCustomHostnameResult,
  type BuiltRequest,
  type SimulatedResponse,
  type VGSShowRequestInput,
  type VGSShowRequestSuccess
} from "./network.js";
import { resolveJsonPath } from "./jsonPath.js";
import { VGSShowError, type SerializedVGSShowError } from "./errors.js";
import {
  createContentStateMachine,
  type VGSContentKind,
  type VGSContentState,
  type VGSContentValue
} from "./contentState.js";
import {
  VGSAnalyticsClient,
  analyticsHeaderState,
  viewKindToAnalyticsField
} from "./analytics.js";

export const DEFAULT_VAULT_HOST = "verygoodproxy.com";

/**
 * VGS vault environment used when building the reveal host.
 *
 * Use `"sandbox"` for development, `"live"` for production vaults, and
 * `"live-<region>"` for regional live routing. You can also use `dataRegion`
 * on `VGSShowOptions` when the vault uses regional routing.
 */
export type VGSShowEnvironment = "sandbox" | "live" | `live-${string}`;

/**
 * Component family subscribed to a `VGSShow` instance.
 */
export type VGSShowViewKind = "label" | "image" | "pdf";

/**
 * Decoder selected by each subscribed view.
 *
 * Text views receive string values, while image and PDF views receive base64
 * media strings that stay inside component controllers.
 */
export type VGSShowDecodingContentMode = "text" | "imageBase64" | "pdfBase64";

/**
 * Internal decoded content passed from the orchestrator to component
 * controllers.
 */
export type VGSShowDecodedContent = VGSContentValue;

/**
 * Result of resolving a subscribed view's `contentPath` from a reveal response.
 */
export type VGSShowDecodingResult =
  | {
      kind: "success";
      content: VGSShowDecodedContent;
    }
  | {
      kind: "failure";
      error: VGSShowError;
    };

/**
 * Minimal contract a React component controller implements to receive reveal
 * lifecycle events from `VGSShow`.
 */
export type VGSShowSubscribableView = {
  readonly viewId?: string;
  readonly kind: VGSShowViewKind;
  readonly contentPath?: string;
  readonly decodingContentMode?: VGSShowDecodingContentMode;
  onLoading?: () => void;
  handleDecodingResult?: (result: VGSShowDecodingResult) => void;
};

/**
 * Safe lifecycle event captured for tests.
 *
 * Events intentionally include field metadata and status only.
 */
export type VGSShowLifecycleEvent =
  | {
      type: "FieldInit";
      viewId: string | null;
      viewKind: VGSShowViewKind;
      contentPath: string | null;
    }
  | {
      type: "BeforeSubmit";
      fields: VGSShowViewKind[];
      hasCustomHeaders: boolean;
      hasCustomHostname: boolean;
      hasPayload: boolean;
    }
  | {
      type: "Submit";
      status: "success" | "failure";
      code: number;
    }
  | {
      type: "UnsubscribeField";
      viewId: string | null;
      viewKind: VGSShowViewKind;
    };

/**
 * Per-view trace used by SDK tests.
 */
export type VGSShowViewTrace = {
  viewId: string | null;
  state: VGSContentState;
  contentPath: string | null;
  content?: VGSShowDecodedContent;
  error?: SerializedVGSShowError;
};

/**
 * Request trace returned by testing helpers to verify orchestration behavior.
 */
export type VGSShowCoreRequestTrace = {
  outcome: "success" | "failure";
  promiseState: "resolved" | "rejected";
  requestDispatched: boolean;
  requestResult?: VGSShowRequestSuccess;
  error?: SerializedVGSShowError;
  eventSequence: string[];
  warnings: string[];
  lifecycleEvents: VGSShowLifecycleEvent[];
  perView: VGSShowViewTrace[];
  unrevealedContentPaths: string[];
  builtRequest?: BuiltRequest;
};

/**
 * Configuration for one VGS Show reveal orchestrator.
 *
 * Create one instance per screen or reveal flow and pass the same instance to
 * every `VGSShowLabel`, `VGSShowImage`, and `VGSShowPdf` that should update from
 * the same reveal response.
 */
export type VGSShowOptions = {
  /** VGS vault identifier. Use synthetic IDs in examples and tests. */
  id: string;
  /** Vault environment. Defaults to `"sandbox"`. */
  environment?: VGSShowEnvironment;
  /** Optional regional suffix used for regional vault routing. */
  dataRegion?: string;
  /** Optional custom hostname. The SDK validates and falls back to the vault host. */
  hostname?: string;
};

type RuntimeFetchInit = {
  method: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: unknown;
};

type RuntimeFetchResponse = {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
};

type RuntimeFetch = (input: string, init?: RuntimeFetchInit) => Promise<RuntimeFetchResponse>;

type RuntimeAbortController = {
  readonly signal: unknown;
  abort(): void;
};

const subscribersByInstance = new WeakMap<VGSShow, VGSShowSubscribableView[]>();
const lifecycleEventsByInstance = new WeakMap<VGSShow, VGSShowLifecycleEvent[]>();
const warningsByInstance = new WeakMap<VGSShow, string[]>();

function normalizeDataRegion(dataRegion: string | undefined): string | undefined {
  if (dataRegion === undefined) {
    return undefined;
  }

  const trimmed = dataRegion.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function normalizeEnvironment(environment: string): VGSShowEnvironment {
  return environment.toLowerCase() as VGSShowEnvironment;
}

function buildEnvironmentSegment(environment: VGSShowEnvironment, dataRegion: string | undefined): string {
  if (environment.startsWith("live-")) {
    return environment;
  }

  const normalizedDataRegion = normalizeDataRegion(dataRegion);
  return normalizedDataRegion === undefined ? environment : `${environment}-${normalizedDataRegion}`;
}

function buildBaseUrlHost(options: VGSShowOptions): string {
  const hostname = options.hostname ?? DEFAULT_VAULT_HOST;
  const environment = options.environment ?? "sandbox";
  const environmentSegment = buildEnvironmentSegment(environment, options.dataRegion);
  return `${options.id}.${environmentSegment}.${hostname}`;
}

function createUuidV4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/gu, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function defaultDecodingModeForKind(kind: VGSShowViewKind): VGSShowDecodingContentMode {
  if (kind === "label") {
    return "text";
  }

  return kind === "pdf" ? "pdfBase64" : "imageBase64";
}

function isStrictBase64(value: string): boolean {
  return (
    value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]*={0,2}$/u.test(value) &&
    !/=.+[^=]/u.test(value)
  );
}

function decodeViewContent(json: unknown, view: VGSShowSubscribableView): VGSShowDecodingResult {
  const contentPath = view.contentPath ?? "";
  const value = resolveJsonPath(json, contentPath);
  const mode = view.decodingContentMode ?? defaultDecodingModeForKind(view.kind);

  if (mode === "text") {
    return typeof value === "string"
      ? {
          kind: "success",
          content: {
            kind: "text",
            text: value
          }
        }
      : {
          kind: "failure",
          error: new VGSShowError("fieldNotFound")
        };
  }

  if (typeof value !== "string") {
    return {
      kind: "failure",
      error: new VGSShowError("fieldNotFound")
    };
  }

  if (!isStrictBase64(value)) {
    return {
      kind: "failure",
      error: new VGSShowError("invalidBase64Data")
    };
  }

  return {
    kind: "success",
    content: {
      kind: "rawData",
      dataBase64: value
    }
  };
}

function contentKindForViewKind(kind: VGSShowViewKind): VGSContentKind {
  return kind === "label" ? "text" : kind;
}

function viewIdFor(view: VGSShowSubscribableView): string | null {
  return view.viewId ?? null;
}

function eventViewIdFor(view: VGSShowSubscribableView): string {
  return view.viewId ?? view.kind;
}

function getRuntimeFetch(): RuntimeFetch {
  const runtime = globalThis as { fetch?: unknown };
  if (typeof runtime.fetch !== "function") {
    throw new Error("Global fetch is not available in this runtime");
  }

  return runtime.fetch as RuntimeFetch;
}

function createRuntimeAbortController(): RuntimeAbortController | null {
  const runtime = globalThis as {
    AbortController?: new () => RuntimeAbortController;
  };

  return typeof runtime.AbortController === "function" ? new runtime.AbortController() : null;
}

function subscribersFor(vgsShow: VGSShow): VGSShowSubscribableView[] {
  const existingSubscribers = subscribersByInstance.get(vgsShow);
  if (existingSubscribers !== undefined) {
    return existingSubscribers;
  }

  const subscribers: VGSShowSubscribableView[] = [];
  subscribersByInstance.set(vgsShow, subscribers);
  return subscribers;
}

function lifecycleEventsFor(vgsShow: VGSShow): VGSShowLifecycleEvent[] {
  const existingEvents = lifecycleEventsByInstance.get(vgsShow);
  if (existingEvents !== undefined) {
    return existingEvents;
  }

  const lifecycleEvents: VGSShowLifecycleEvent[] = [];
  lifecycleEventsByInstance.set(vgsShow, lifecycleEvents);
  return lifecycleEvents;
}

function warningsFor(vgsShow: VGSShow): string[] {
  const existingWarnings = warningsByInstance.get(vgsShow);
  if (existingWarnings !== undefined) {
    return existingWarnings;
  }

  const warnings: string[] = [];
  warningsByInstance.set(vgsShow, warnings);
  return warnings;
}

export function getSubscribedVGSShowViews(vgsShow: VGSShow): readonly VGSShowSubscribableView[] {
  return [...subscribersFor(vgsShow)];
}

/**
 * Returns currently subscribed text views for tests.
 */
export function getSubscribedVGSShowLabels(vgsShow: VGSShow): readonly VGSShowSubscribableView[] {
  return subscribersFor(vgsShow).filter((view) => view.kind === "label");
}

/**
 * Returns currently subscribed PDF views for tests.
 */
export function getSubscribedVGSShowPdfViews(vgsShow: VGSShow): readonly VGSShowSubscribableView[] {
  return subscribersFor(vgsShow).filter((view) => view.kind === "pdf");
}

/**
 * Registers a component controller with a `VGSShow` instance.
 */
export function subscribeVGSShowView(vgsShow: VGSShow, view: VGSShowSubscribableView): void {
  // Contributor guidance: subscription records may include contentPath and
  // view kind, but not revealed values. Keep analytics emitted here field-level.
  const subscribers = subscribersFor(vgsShow);
  if (subscribers.includes(view)) {
    return;
  }

  subscribers.push(view);
  lifecycleEventsFor(vgsShow).push({
    type: "FieldInit",
    viewId: view.viewId ?? null,
    viewKind: view.kind,
    contentPath: view.contentPath ?? null
  });
  VGSAnalyticsClient.shared.trackFieldInit({
    contentPath: view.contentPath ?? "",
    field: viewKindToAnalyticsField(view.kind)
  });
}

/**
 * Removes one component controller from a `VGSShow` instance and records a safe
 * unsubscribe lifecycle event.
 */
export function unsubscribeVGSShowView(vgsShow: VGSShow, view: VGSShowSubscribableView): void {
  const subscribers = subscribersFor(vgsShow);
  const index = subscribers.indexOf(view);
  if (index === -1) {
    return;
  }

  const [removed] = subscribers.splice(index, 1);
  if (removed !== undefined) {
    recordUnsubscribe(vgsShow, removed);
  }
}

/**
 * Removes all component controllers from a `VGSShow` instance.
 */
export function unsubscribeAllVGSShowViews(vgsShow: VGSShow): void {
  const subscribers = subscribersFor(vgsShow);
  const removedViews = [...subscribers];
  subscribers.length = 0;

  for (const view of removedViews) {
    recordUnsubscribe(vgsShow, view);
  }
}

/**
 * Builds a request without dispatching it.
 */
export function buildVGSShowRequestForTesting(
  vgsShow: VGSShow,
  input: VGSShowRequestInput
): BuiltRequest | VGSShowError {
  // Contributor guidance: built requests can contain headers and payload body.
  // Keep them inside tests and request-dispatch code.
  const headerState = analyticsHeaderState();
  const builtRequest = buildRequest({
    baseUrl: `https://${vgsShow.baseUrlHost}`,
    request: input,
    customHeaders: vgsShow.customHeaders,
    analyticsEnabled: headerState.analyticsEnabled,
    sessionId: headerState.sessionId
  });

  return builtRequest;
}

/**
 * Returns the computed host for tests that validate environment and region
 * routing.
 */
export function getVGSShowBaseUrlHostForTesting(vgsShow: VGSShow): string {
  return vgsShow.baseUrlHost;
}

/**
 * Returns safe lifecycle events recorded for the instance.
 */
export function getVGSShowLifecycleEventsForTesting(vgsShow: VGSShow): VGSShowLifecycleEvent[] {
  return lifecycleEventsFor(vgsShow).map((event) => ({ ...event }));
}

/**
 * Returns non-sensitive warnings recorded for the instance.
 */
export function getVGSShowWarningsForTesting(vgsShow: VGSShow): string[] {
  return [...warningsFor(vgsShow)];
}

/**
 * Runs the orchestration path against a simulated response.
 */
export function simulateVGSShowRequestForTesting(
  vgsShow: VGSShow,
  input: VGSShowRequestInput,
  response: SimulatedResponse = { kind: "http", status: 200, body: "{}" }
): VGSShowCoreRequestTrace {
  // Contributor guidance: this helper can surface decoded content for tests.
  // Keep it outside the package-root export surface.
  const eventSequence: string[] = ["beforeSubmit"];
  const warnings: string[] = [];
  const perView: VGSShowViewTrace[] = [];
  const unrevealedContentPaths: string[] = [];
  const subscribersSnapshot = [...subscribersFor(vgsShow)];

  lifecycleEventsFor(vgsShow).push({
    type: "BeforeSubmit",
    fields: subscribersSnapshot.map((view) => view.kind),
    hasCustomHeaders: Object.keys(vgsShow.customHeaders).length > 0,
    hasCustomHostname: vgsShow.hostname !== undefined,
    hasPayload: input.payload !== undefined && input.payload !== null
  });
  VGSAnalyticsClient.shared.trackBeforeSubmit({
    content: [
      ...(input.payload !== undefined && input.payload !== null ? ["custom_data"] as const : []),
      ...(Object.keys(vgsShow.customHeaders).length > 0 ? ["custom_header"] as const : []),
      ...(vgsShow.hostname !== undefined ? ["custom_hostname"] as const : [])
    ],
    field: subscribersSnapshot.map((view) => viewKindToAnalyticsField(view.kind))
  });

  if (subscribersSnapshot.length === 0) {
    eventSequence.push("warningNoSubscribers");
    warnings.push("No subscribed views to reveal.");
    warningsFor(vgsShow).push("No subscribed views to reveal.");
  }

  if (!isValidTenantId(vgsShow.id) || !isValidRegionalEnvironment(vgsShow.environment)) {
    return buildRejectedTrace(vgsShow, {
      error: invalidConfigurationError(),
      eventSequence,
      warnings,
      perView,
      unrevealedContentPaths,
      requestDispatched: false
    });
  }

  eventSequence.push("buildRequest");
  const builtRequest = buildVGSShowRequestForTesting(vgsShow, input);

  if (builtRequest instanceof VGSShowError) {
    return buildRejectedTrace(vgsShow, {
      error: builtRequest,
      eventSequence,
      warnings,
      perView,
      unrevealedContentPaths,
      requestDispatched: false
    });
  }

  eventSequence.push("sendRequest");
  const requestOutcome = mapSimulatedResponse(response);
  if (requestOutcome.outcome === "reject") {
    eventSequence.push("logErrorResponse", "submitFailure", "promiseRejected");
    lifecycleEventsFor(vgsShow).push({
      type: "Submit",
      status: "failure",
      code: requestOutcome.error.code
    });
    const analyticsFailureCode = requestOutcome.error.extraInfo?.code;
    VGSAnalyticsClient.shared.trackSubmit({
      status: "failed",
      ...(typeof analyticsFailureCode === "number" ? { code: analyticsFailureCode } : {}),
      message: requestOutcome.error.message
    });
    return {
      outcome: "failure",
      promiseState: "rejected",
      requestDispatched: true,
      error: requestOutcome.error.toJSON(),
      eventSequence,
      warnings,
      lifecycleEvents: getVGSShowLifecycleEventsForTesting(vgsShow),
      perView,
      unrevealedContentPaths,
      builtRequest
    };
  }

  eventSequence.push("logSuccessResponse");
  const rawDecode = decodeRawJson(response.kind === "http" ? response.body : undefined);
  if (rawDecode.kind === "failure") {
    eventSequence.push("rawDecodeFailure", "submitFailure", "promiseRejected");
    lifecycleEventsFor(vgsShow).push({
      type: "Submit",
      status: "failure",
      code: rawDecode.error.code
    });
    VGSAnalyticsClient.shared.trackSubmit({
      status: "failed",
      code: rawDecode.error.code,
      message: rawDecode.error.message
    });
    return {
      outcome: "failure",
      promiseState: "rejected",
      requestDispatched: true,
      error: rawDecode.error.toJSON(),
      eventSequence,
      warnings,
      lifecycleEvents: getVGSShowLifecycleEventsForTesting(vgsShow),
      perView,
      unrevealedContentPaths,
      builtRequest
    };
  }

  eventSequence.push("rawDecodeSuccess");

  for (const view of subscribersSnapshot) {
    const stateMachine = createContentStateMachine(contentKindForViewKind(view.kind));
    view.onLoading?.();
    stateMachine.startLoading();
    eventSequence.push(`viewLoading:${eventViewIdFor(view)}`);

    const decodingResult = decodeViewContent(rawDecode.json, view);

    if (decodingResult.kind === "success") {
      const snapshot = stateMachine.reveal(decodingResult.content);
      view.handleDecodingResult?.(decodingResult);
      eventSequence.push(`viewDecodeSuccess:${eventViewIdFor(view)}`);
      perView.push({
        viewId: viewIdFor(view),
        state: snapshot.state,
        contentPath: view.contentPath ?? null,
        content: decodingResult.content
      });
    } else {
      const snapshot = stateMachine.fail(decodingResult.error);
      view.handleDecodingResult?.(decodingResult);
      eventSequence.push(`viewDecodeFailure:${eventViewIdFor(view)}`);
      const contentPath = view.contentPath ?? "";
      unrevealedContentPaths.push(contentPath);
      perView.push({
        viewId: viewIdFor(view),
        state: snapshot.state,
        contentPath,
        error: decodingResult.error.toJSON()
      });
    }
  }

  if (unrevealedContentPaths.length > 0) {
    eventSequence.push("warningUnrevealedContentPaths");
    const warning = `Failed to reveal content paths: ${unrevealedContentPaths.join(",")}`;
    warnings.push(warning);
    warningsFor(vgsShow).push(warning);
  }

  eventSequence.push("submitSuccess", "promiseResolved");
  lifecycleEventsFor(vgsShow).push({
    type: "Submit",
    status: "success",
    code: requestOutcome.value.code
  });
  VGSAnalyticsClient.shared.trackSubmit({
    status: "success"
  });

  return {
    outcome: "success",
    promiseState: "resolved",
    requestDispatched: true,
    requestResult: requestOutcome.value,
    eventSequence,
    warnings,
    lifecycleEvents: getVGSShowLifecycleEventsForTesting(vgsShow),
    perView,
    unrevealedContentPaths,
    builtRequest
  };
}

function recordUnsubscribe(vgsShow: VGSShow, view: VGSShowSubscribableView): void {
  lifecycleEventsFor(vgsShow).push({
    type: "UnsubscribeField",
    viewId: view.viewId ?? null,
    viewKind: view.kind
  });
  VGSAnalyticsClient.shared.trackFieldUnsubscibe({
    contentPath: view.contentPath ?? "",
    field: viewKindToAnalyticsField(view.kind)
  });
}

function decodeRawJson(rawBody: string | undefined): { kind: "success"; json: unknown } | { kind: "failure"; error: VGSShowError } {
  if (rawBody === undefined || rawBody.length === 0) {
    return {
      kind: "failure",
      error: new VGSShowError("unexpectedResponseDataFormat")
    };
  }

  try {
    const json = JSON.parse(rawBody) as unknown;
    return json !== null && typeof json === "object" && !Array.isArray(json)
      ? {
          kind: "success",
          json
        }
      : {
          kind: "failure",
          error: new VGSShowError("responseIsInvalidJSON")
        };
  } catch {
    return {
      kind: "failure",
      error: new VGSShowError("responseIsInvalidJSON")
    };
  }
}

function buildRejectedTrace(
  vgsShow: VGSShow,
  input: {
    error: VGSShowError;
    eventSequence: string[];
    warnings: string[];
    perView: VGSShowViewTrace[];
    unrevealedContentPaths: string[];
    requestDispatched: boolean;
  }
): VGSShowCoreRequestTrace {
  input.eventSequence.push("submitFailure", "promiseRejected");
  lifecycleEventsFor(vgsShow).push({
    type: "Submit",
    status: "failure",
    code: input.error.code
  });
  VGSAnalyticsClient.shared.trackSubmit({
    status: "failed",
    code: input.error.code,
    message: input.error.message
  });

  return {
    outcome: "failure",
    promiseState: "rejected",
    requestDispatched: input.requestDispatched,
    error: input.error.toJSON(),
    eventSequence: input.eventSequence,
    warnings: input.warnings,
    lifecycleEvents: getVGSShowLifecycleEventsForTesting(vgsShow),
    perView: input.perView,
    unrevealedContentPaths: input.unrevealedContentPaths
  };
}

function recordSubmitFailure(vgsShow: VGSShow, error: VGSShowError): void {
  lifecycleEventsFor(vgsShow).push({
    type: "Submit",
    status: "failure",
    code: error.code
  });
  VGSAnalyticsClient.shared.trackSubmit({
    status: "failed",
    code: error.code,
    message: error.message
  });
}

function recordTransportFailure(vgsShow: VGSShow, error: VGSShowError): void {
  lifecycleEventsFor(vgsShow).push({
    type: "Submit",
    status: "failure",
    code: error.code
  });

  const analyticsFailureCode = error.extraInfo?.code;
  VGSAnalyticsClient.shared.trackSubmit({
    status: "failed",
    ...(typeof analyticsFailureCode === "number" ? { code: analyticsFailureCode } : {}),
    message: error.message
  });
}

/**
 * Reveal orchestrator for VGS Show React Native components.
 *
 * `VGSShow` owns vault routing, request building, custom headers, reveal
 * dispatch, and subscription fan-out. Subscribed components receive decoded
 * content internally after `request()` succeeds.
 *
 * @remarks
 * Public callbacks and refs intentionally expose only status, errors, actions,
 * and logical booleans.
 */
export class VGSShow {
  /** VGS vault identifier used to build the reveal host. */
  public readonly id: string;
  /** Target environment used to build the reveal host. */
  public readonly environment: VGSShowEnvironment;
  /** Optional regional suffix when the vault uses regional routing. */
  public readonly dataRegion: string | undefined;
  /** Optional custom hostname. Requests fall back to the vault host if validation fails. */
  public readonly hostname: string | undefined;
  /** Per-instance identifier used for lifecycle correlation. It is not customer data. */
  public readonly formId: string;
  /**
   * Additional request headers merged into reveal requests.
   */
  public customHeaders: Record<string, string> = {};
  private resolvedBaseUrl: string | null = null;
  private baseUrlResolutionPromise: Promise<string> | null = null;

  /**
   * Creates a reveal orchestrator for one vault-backed screen or flow.
   */
  public constructor(options: VGSShowOptions) {
    this.id = options.id;
    this.environment = normalizeEnvironment(options.environment ?? "sandbox");
    const normalizedDataRegion = normalizeDataRegion(options.dataRegion);
    this.dataRegion =
      normalizedDataRegion !== undefined && isValidDataRegion(normalizedDataRegion)
        ? normalizedDataRegion
        : undefined;
    this.hostname = options.hostname;
    this.formId = createUuidV4();
    subscribersByInstance.set(this, []);
    lifecycleEventsByInstance.set(this, []);
    warningsByInstance.set(this, []);
  }

  /**
   * Hostname currently used for vault routing before custom-host validation.
   */
  public get baseUrlHost(): string {
    const options: VGSShowOptions = {
      id: this.id,
      environment: this.environment
    };

    if (this.dataRegion !== undefined) {
      options.dataRegion = this.dataRegion;
    }

    if (this.hostname !== undefined) {
      options.hostname = this.hostname;
    }

    return buildBaseUrlHost(options);
  }

  /**
   * Sends a reveal request and updates every subscribed component from the
   * response fields selected by their `contentPath`.
   *
   * The resolved value includes only the HTTP status code. Revealed values stay
   * inside SDK-managed component controllers and are not returned here.
   */
  public request(input: VGSShowRequestInput): Promise<VGSShowRequestSuccess> {
    return this.performRequest(input);
  }

  private get vaultBaseUrl(): string {
    const options: VGSShowOptions = {
      id: this.id,
      environment: this.environment,
      hostname: DEFAULT_VAULT_HOST
    };

    if (this.dataRegion !== undefined) {
      options.dataRegion = this.dataRegion;
    }

    return `https://${buildBaseUrlHost(options)}`;
  }

  private async performRequest(input: VGSShowRequestInput): Promise<VGSShowRequestSuccess> {
    const subscribersSnapshot = [...subscribersFor(this)];

    lifecycleEventsFor(this).push({
      type: "BeforeSubmit",
      fields: subscribersSnapshot.map((view) => view.kind),
      hasCustomHeaders: Object.keys(this.customHeaders).length > 0,
      hasCustomHostname: this.hostname !== undefined,
      hasPayload: input.payload !== undefined && input.payload !== null
    });
    VGSAnalyticsClient.shared.trackBeforeSubmit({
      content: [
        ...(input.payload !== undefined && input.payload !== null ? ["custom_data"] as const : []),
        ...(Object.keys(this.customHeaders).length > 0 ? ["custom_header"] as const : []),
        ...(this.hostname !== undefined ? ["custom_hostname"] as const : [])
      ],
      field: subscribersSnapshot.map((view) => viewKindToAnalyticsField(view.kind))
    });

    if (subscribersSnapshot.length === 0) {
      warningsFor(this).push("No subscribed views to reveal.");
    }

    if (!isValidTenantId(this.id) || !isValidRegionalEnvironment(this.environment)) {
      const error = invalidConfigurationError();
      recordSubmitFailure(this, error);
      throw error;
    }

    const baseUrl = await this.resolveRequestBaseUrl();
    const headerState = analyticsHeaderState();
    const builtRequest = buildRequest({
      baseUrl,
      request: input,
      customHeaders: this.customHeaders,
      analyticsEnabled: headerState.analyticsEnabled,
      sessionId: headerState.sessionId
    });

    if (builtRequest instanceof VGSShowError) {
      recordSubmitFailure(this, builtRequest);
      throw builtRequest;
    }

    let response: { status: number; ok: boolean; body: string };
    try {
      response = await this.dispatchRequest(builtRequest);
    } catch (error) {
      const requestError = this.createTransportError(error);
      recordTransportFailure(this, requestError);
      throw requestError;
    }

    if (!response.ok) {
      const requestError = new VGSShowError("unexpectedResponseType", {
        extraInfo: {
          code: response.status
        }
      });
      recordTransportFailure(this, requestError);
      throw requestError;
    }

    const rawDecode = decodeRawJson(response.body);
    if (rawDecode.kind === "failure") {
      recordSubmitFailure(this, rawDecode.error);
      throw rawDecode.error;
    }

    const unrevealedContentPaths: string[] = [];

    for (const view of subscribersSnapshot) {
      view.onLoading?.();

      const decodingResult = decodeViewContent(rawDecode.json, view);
      if (decodingResult.kind === "success") {
        view.handleDecodingResult?.(decodingResult);
        continue;
      }

      view.handleDecodingResult?.(decodingResult);
      unrevealedContentPaths.push(view.contentPath ?? "");
    }

    if (unrevealedContentPaths.length > 0) {
      warningsFor(this).push(`Failed to reveal content paths: ${unrevealedContentPaths.join(",")}`);
    }

    lifecycleEventsFor(this).push({
      type: "Submit",
      status: "success",
      code: response.status
    });
    VGSAnalyticsClient.shared.trackSubmit({
      status: "success"
    });

    return {
      code: response.status
    };
  }

  private async resolveRequestBaseUrl(): Promise<string> {
    if (this.hostname === undefined) {
      return this.vaultBaseUrl;
    }

    if (this.resolvedBaseUrl !== null) {
      return this.resolvedBaseUrl;
    }

    if (this.baseUrlResolutionPromise !== null) {
      return this.baseUrlResolutionPromise;
    }

    this.baseUrlResolutionPromise = this.resolveCustomBaseUrl();
    try {
      const baseUrl = await this.baseUrlResolutionPromise;
      this.resolvedBaseUrl = baseUrl;
      return baseUrl;
    } finally {
      this.baseUrlResolutionPromise = null;
    }
  }

  private async resolveCustomBaseUrl(): Promise<string> {
    const validationUrl = buildHostValidationUrl(this.hostname ?? "", this.id);
    if (validationUrl === null) {
      return this.vaultBaseUrl;
    }

    try {
      const response = await this.dispatchRequest({
        url: validationUrl,
        method: "GET",
        headers: {},
        timeoutSeconds: 60,
        body: null
      });

      if (!response.ok) {
        return this.vaultBaseUrl;
      }

      return resolveCustomHostnameResult(this.hostname ?? "", response.body) ?? this.vaultBaseUrl;
    } catch {
      return this.vaultBaseUrl;
    }
  }

  private async dispatchRequest(input: BuiltRequest): Promise<{ status: number; ok: boolean; body: string }> {
    const fetchFn = getRuntimeFetch();
    const abortController = createRuntimeAbortController();
    const timeoutHandle =
      abortController === null
        ? null
        : setTimeout(() => {
            abortController.abort();
          }, input.timeoutSeconds * 1000);

    try {
      const response = await fetchFn(input.url, {
        method: input.method,
        headers: input.headers,
        ...(input.body === null ? {} : { body: input.body }),
        ...(abortController === null ? {} : { signal: abortController.signal })
      });

      return {
        status: response.status,
        ok: response.ok,
        body: await response.text()
      };
    } finally {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private createTransportError(error: unknown): VGSShowError {
    const cause =
      error instanceof Error && error.message.length > 0 ? error.message : "Network request failed";
    const maybeCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "number"
        ? (error as { code: number }).code
        : undefined;

    return new VGSShowError("unexpectedResponseType", {
      extraInfo: {
        ...(maybeCode === undefined ? {} : { code: maybeCode }),
        cause
      }
    });
  }

}
