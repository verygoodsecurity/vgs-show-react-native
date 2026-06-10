import {
  DEFAULT_VGS_SHOW_SDK_VERSION,
  VGS_CLIENT_SOURCE
} from "./network.js";

/**
 * Analytics event names emitted by the SDK.
 */
export type VGSAnalyticsEventType =
  | "Init"
  | "BeforeSubmit"
  | "Submit"
  | "Copy to clipboard click"
  | "UnsubscribeField"
  | "SetSecureTextRange"
  | "ContentRendering";

/**
 * Field category allowed in analytics payloads.
 */
export type VGSAnalyticsField = "text" | "image" | "pdf";

/**
 * Analytics event status.
 */
export type VGSAnalyticsStatus = "success" | "failed";

/**
 * SDK log level.
 */
export type VGSLogLevel = "info" | "warning" | "none";

/**
 * Internal view kind accepted by analytics mapping.
 */
export type VGSTrackableViewKind = "label" | "image" | "pdf";

/**
 * Logging configuration for SDK diagnostics.
 */
export type VGSLoggingConfiguration = {
  level: VGSLogLevel;
  isNetworkDebugEnabled: boolean;
  isExtensiveDebugEnabled: boolean;
};

/**
 * Coarse user-agent metadata attached to analytics payloads.
 */
export type VGSAnalyticsUserAgent = {
  platform: string;
  device: string;
  deviceModel: string;
  osVersion: string;
  deviceLocale: string;
  dependencyManager: string;
};

/**
 * Analytics payload sent through the internal analytics client.
 */
export type VGSAnalyticsPayload = {
  type: VGSAnalyticsEventType;
  status: VGSAnalyticsStatus;
  ua: VGSAnalyticsUserAgent;
  version: string;
  source: typeof VGS_CLIENT_SOURCE;
  localTimestamp: string;
  vgsShowSessionId: string;
  extraInfo?: Record<string, unknown>;
};

/**
 * Captured log entry used by tests and diagnostics.
 */
export type VGSLogEntry = {
  level: Exclude<VGSLogLevel, "none">;
  message: string;
};

export const VGSAnalyticsEvents = {
  fieldInit: "Init",
  beforeSubmit: "BeforeSubmit",
  submit: "Submit",
  copy: "Copy to clipboard click",
  fieldUnsubscibe: "UnsubscribeField",
  setSecureTextRange: "SetSecureTextRange",
  contentRendering: "ContentRendering"
} as const satisfies Record<
  | "fieldInit"
  | "beforeSubmit"
  | "submit"
  | "copy"
  | "fieldUnsubscibe"
  | "setSecureTextRange"
  | "contentRendering",
  VGSAnalyticsEventType
>;

const DEFAULT_USER_AGENT: VGSAnalyticsUserAgent = {
  platform: "react-native",
  device: "unknown",
  deviceModel: "unknown",
  osVersion: "unknown",
  deviceLocale: "en-US",
  dependencyManager: "none"
};

const DEFAULT_LOGGING_CONFIGURATION: VGSLoggingConfiguration = {
  level: "none",
  isNetworkDebugEnabled: false,
  isExtensiveDebugEnabled: false
};

const EVENT_ALLOWED_EXTRA_INFO_KEYS: Record<VGSAnalyticsEventType, readonly string[]> = {
  Init: ["contentPath", "field"],
  BeforeSubmit: ["content", "field"],
  Submit: ["code", "message"],
  "Copy to clipboard click": ["copy_format"],
  UnsubscribeField: ["contentPath", "field"],
  SetSecureTextRange: ["contentPath"],
  ContentRendering: ["field"]
};

function createUuidV4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/gu, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sanitizeArray(value: readonly unknown[]): readonly unknown[] {
  return value.map((item) => sanitizeValue(item));
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return sanitizeArray(value);
  }

  if (isPlainRecord(value)) {
    return sanitizeExtraInfoRecord(value);
  }

  return value;
}

function sanitizeExtraInfoRecord(extraInfo: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(extraInfo).map(([key, value]) => [key, sanitizeValue(value)])
  );
}

function assertAllowedExtraInfoKeys(
  type: VGSAnalyticsEventType,
  extraInfo: Record<string, unknown> | undefined
): void {
  if (extraInfo === undefined) {
    return;
  }

  const allowedKeys = new Set(EVENT_ALLOWED_EXTRA_INFO_KEYS[type]);
  for (const key of Object.keys(extraInfo)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Analytics extraInfo key "${key}" is not allowed for event ${type}`);
    }
  }
}

function containsSensitiveValue(value: unknown): boolean {
  if (typeof value === "string") {
    if (/authorization|bearer/iu.test(value)) {
      return true;
    }

    if (/[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+/u.test(value)) {
      return true;
    }

    if (/\d{6,}/u.test(value)) {
      return true;
    }

    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsSensitiveValue(item));
  }

  if (isPlainRecord(value)) {
    return Object.entries(value).some(([key, nestedValue]) => {
      if (key === "contentPath" || key === "field" || key === "copy_format") {
        return false;
      }

      if (/authorization|token|jwt|payload|body|pan|bin|card/u.test(key)) {
        return true;
      }

      return containsSensitiveValue(nestedValue);
    });
  }

  return false;
}

function assertNoSensitiveValues(extraInfo: Record<string, unknown> | undefined): void {
  if (extraInfo === undefined) {
    return;
  }

  if (containsSensitiveValue(extraInfo)) {
    throw new Error("Analytics payload contains sensitive data");
  }
}

function createBasePayload(
  type: VGSAnalyticsEventType,
  status: VGSAnalyticsStatus,
  sessionId: string,
  extraInfo?: Record<string, unknown>
): VGSAnalyticsPayload {
  const sanitizedExtraInfo = extraInfo === undefined ? undefined : sanitizeExtraInfoRecord(extraInfo);
  assertAllowedExtraInfoKeys(type, sanitizedExtraInfo);
  assertNoSensitiveValues(sanitizedExtraInfo);

  return {
    type,
    status,
    ua: { ...DEFAULT_USER_AGENT },
    version: DEFAULT_VGS_SHOW_SDK_VERSION,
    source: VGS_CLIENT_SOURCE,
    localTimestamp: new Date().toISOString(),
    vgsShowSessionId: sessionId,
    ...(sanitizedExtraInfo === undefined ? {} : { extraInfo: sanitizedExtraInfo })
  };
}

/**
 * Converts component view kind names into analytics field names.
 */
export function viewKindToAnalyticsField(kind: VGSTrackableViewKind): VGSAnalyticsField {
  return kind === "label" ? "text" : kind;
}

/**
 * Process-wide analytics session.
 */
export class VGSShowAnalyticsSession {
  public static readonly shared = new VGSShowAnalyticsSession();

  private readonly runtimeSessionId = createUuidV4();

  /** Non-sensitive runtime identifier used for analytics correlation. */
  public get sessionId(): string {
    return this.runtimeSessionId;
  }
}

/**
 * SDK logger used for safe warnings and optional diagnostics.
 */
export class VGSLogger {
  public static readonly shared = new VGSLogger();

  /** Runtime logging configuration. Defaults to logging nothing. */
  public configuration: VGSLoggingConfiguration = { ...DEFAULT_LOGGING_CONFIGURATION };
  private entries: VGSLogEntry[] = [];

  public info(message: string): void {
    this.record("info", message);
  }

  public warning(message: string): void {
    this.record("warning", message);
  }

  /**
   * Records network debug output when explicitly enabled.
   */
  public logNetworkDebug(prefix: string, body: string): void {
    // Contributor guidance: callers must treat body as sensitive and avoid
    // including headers or payload values in the prefix.
    if (!this.configuration.isNetworkDebugEnabled) {
      return;
    }

    const truncatedBody = body.length > 70000 ? body.slice(0, 70000) : body;
    this.record("info", `${prefix}: ${truncatedBody}`);
  }

  public __unstable__getEntriesForTesting(): readonly VGSLogEntry[] {
    return [...this.entries];
  }

  public __unstable__resetForTesting(): void {
    this.configuration = { ...DEFAULT_LOGGING_CONFIGURATION };
    this.entries = [];
  }

  private record(level: Exclude<VGSLogLevel, "none">, message: string): void {
    if (this.configuration.level === "none") {
      return;
    }

    if (this.configuration.level === "warning" && level === "info") {
      return;
    }

    this.entries = [...this.entries, { level, message }];
  }
}

/**
 * Internal analytics client with field-level payload validation.
 */
export class VGSAnalyticsClient {
  public static readonly shared = new VGSAnalyticsClient();

  /** Controls whether analytics events are collected for the current runtime. */
  public shouldCollectAnalytics = true;
  private sentPayloads: VGSAnalyticsPayload[] = [];

  public trackFieldInit(input: { contentPath: string; field: VGSAnalyticsField }): VGSAnalyticsPayload | null {
    return this.dispatch(
      createBasePayload(
        VGSAnalyticsEvents.fieldInit,
        "success",
        VGSShowAnalyticsSession.shared.sessionId,
        {
          contentPath: input.contentPath,
          field: input.field
        }
      )
    );
  }

  public trackFieldUnsubscibe(input: { contentPath: string; field: VGSAnalyticsField }): VGSAnalyticsPayload | null {
    return this.dispatch(
      createBasePayload(
        VGSAnalyticsEvents.fieldUnsubscibe,
        "success",
        VGSShowAnalyticsSession.shared.sessionId,
        {
          contentPath: input.contentPath,
          field: input.field
        }
      )
    );
  }

  public trackSetSecureTextRange(input: { contentPath: string }): VGSAnalyticsPayload | null {
    return this.dispatch(
      createBasePayload(
        VGSAnalyticsEvents.setSecureTextRange,
        "success",
        VGSShowAnalyticsSession.shared.sessionId,
        {
          contentPath: input.contentPath
        }
      )
    );
  }

  public trackCopy(input: { format: "raw" | "transformed" }): VGSAnalyticsPayload | null {
    return this.dispatch(
      createBasePayload(
        VGSAnalyticsEvents.copy,
        "success",
        VGSShowAnalyticsSession.shared.sessionId,
        {
          copy_format: input.format
        }
      )
    );
  }

  public trackContentRendering(input: {
    field: Exclude<VGSAnalyticsField, "text">;
    status: VGSAnalyticsStatus;
  }): VGSAnalyticsPayload | null {
    return this.dispatch(
      createBasePayload(
        VGSAnalyticsEvents.contentRendering,
        input.status,
        VGSShowAnalyticsSession.shared.sessionId,
        {
          field: input.field
        }
      )
    );
  }

  public trackBeforeSubmit(input: {
    content: readonly ("custom_data" | "custom_header" | "custom_hostname")[];
    field: readonly VGSAnalyticsField[];
  }): VGSAnalyticsPayload | null {
    return this.dispatch(
      createBasePayload(
        VGSAnalyticsEvents.beforeSubmit,
        "success",
        VGSShowAnalyticsSession.shared.sessionId,
        {
          ...(input.content.length === 0 ? {} : { content: [...input.content] }),
          field: [...input.field]
        }
      )
    );
  }

  public trackSubmit(input: {
    status: VGSAnalyticsStatus;
    code?: number;
    message?: string;
  }): VGSAnalyticsPayload | null {
    const extraInfo =
      input.status === "failed"
        ? {
            ...(input.code === undefined ? {} : { code: input.code }),
            ...(input.message === undefined ? {} : { message: input.message })
          }
        : undefined;

    return this.dispatch(
      createBasePayload(
        VGSAnalyticsEvents.submit,
        input.status,
        VGSShowAnalyticsSession.shared.sessionId,
        extraInfo
      )
    );
  }

  /**
   * Builds an analytics payload without dispatching it.
   *
   * Tests use this to verify allowlists and sensitive-data guards.
   */
  public buildPayloadForTesting(input: {
    type: VGSAnalyticsEventType;
    status: VGSAnalyticsStatus;
    extraInfo?: Record<string, unknown>;
  }): VGSAnalyticsPayload {
    return createBasePayload(
      input.type,
      input.status,
      VGSShowAnalyticsSession.shared.sessionId,
      input.extraInfo
    );
  }

  public __unstable__getSentPayloadsForTesting(): readonly VGSAnalyticsPayload[] {
    return [...this.sentPayloads];
  }

  public __unstable__resetForTesting(): void {
    this.shouldCollectAnalytics = true;
    this.sentPayloads = [];
  }

  private dispatch(payload: VGSAnalyticsPayload): VGSAnalyticsPayload | null {
    if (!this.shouldCollectAnalytics) {
      return null;
    }

    this.sentPayloads = [...this.sentPayloads, payload];
    return payload;
  }
}

/**
 * Returns the analytics state that should be encoded into request headers.
 */
export function analyticsHeaderState(): { analyticsEnabled: boolean; sessionId: string } {
  return {
    analyticsEnabled: VGSAnalyticsClient.shared.shouldCollectAnalytics,
    sessionId: VGSShowAnalyticsSession.shared.sessionId
  };
}
