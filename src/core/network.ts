import { VGSShowError } from "./errors.js";

export const DEFAULT_REQUEST_TIMEOUT_SECONDS = 60;
export const DEFAULT_VGS_SHOW_SDK_VERSION = "1.0.0";
export const VGS_CLIENT_SOURCE = "show-rnSDK";
export const HOST_VALIDATION_BASE_URL = "https://js.verygoodvault.com/collect-configs";
export const DEFAULT_NETWORK_ERROR_CODE = -1;

/**
 * HTTP methods accepted by `VGSShow.request()`.
 */
export type VGSHTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Per-request network options.
 */
export type VGSShowRequestOptions = {
  /** Timeout in seconds. Defaults to 60. */
  requestTimeoutInterval?: number;
};

/**
 * Input passed to `VGSShow.request()`.
 */
export type VGSShowRequestInput = {
  /** Path appended to the configured vault base URL. */
  path: string;
  /** HTTP method. Defaults to `"POST"`. */
  method?: VGSHTTPMethod;
  /** JSON body sent to the reveal endpoint. */
  payload?: Record<string, unknown> | null;
  /** Optional request-level timeout configuration. */
  requestOptions?: VGSShowRequestOptions | null;
};

/**
 * Successful reveal request result.
 *
 * The SDK returns status only. Revealed values are pushed directly to
 * subscribed components and are not returned from `request()`.
 */
export type VGSShowRequestSuccess = {
  /** HTTP status code from the reveal response. */
  code: number;
};

/**
 * Case-preserving request header map.
 */
export type HeaderMap = Record<string, string>;

/**
 * JSON encoding result used by request construction.
 */
export type EncodedJsonPayload =
  | {
      outcome: "success";
      body: string;
      additionalHeaders: HeaderMap;
      roundTripsTo: Record<string, unknown>;
    }
  | {
      outcome: "failure";
      error: VGSShowError;
    };

/**
 * Request input after SDK defaults are applied.
 */
export type NormalizedRequestInput = {
  path: string;
  method: VGSHTTPMethod;
  payload: Record<string, unknown> | null;
  requestOptions: VGSShowRequestOptions | null;
};

/**
 * Full input required to build a dispatchable request.
 */
export type RequestBuildInput = {
  baseUrl: string;
  request: VGSShowRequestInput;
  customHeaders?: HeaderMap;
  analyticsEnabled?: boolean;
  sessionId?: string;
  sdkVersion?: string;
  platform?: string;
};

/**
 * Dispatchable request produced by `buildRequest`.
 */
export type BuiltRequest = {
  url: string;
  method: VGSHTTPMethod;
  headers: HeaderMap;
  timeoutSeconds: number;
  body: string | null;
};

/**
 * Synthetic response used by unit tests.
 */
export type SimulatedResponse =
  | {
      kind: "http";
      status: number;
      body?: string;
    }
  | {
      kind: "networkError";
      code?: number;
      message?: string;
    };

/**
 * Logical request outcome after response mapping.
 */
export type RequestOutcome =
  | {
      outcome: "resolve";
      value: VGSShowRequestSuccess;
    }
  | {
      outcome: "reject";
      error: VGSShowError;
    };

/**
 * Custom-host resolution state used by unit tests.
 */
export type HostURLPolicy =
  | "vault"
  | "customResolving"
  | "customResolved"
  | "customFallbackVault"
  | "invalid";

type VgsClientHeaderOptions = {
  sdkVersion?: string;
  platform?: string;
  analyticsEnabled?: boolean;
  sessionId?: string;
};

const METHOD_SET = new Set<VGSHTTPMethod>(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const TENANT_ID_PATTERN = /^[A-Za-z0-9]+$/u;
const ENVIRONMENT_PATTERN = /^(sandbox|live|live-[a-z0-9]+(?:-[a-z0-9]+)*)$/u;
const DATA_REGION_PATTERN = /^[A-Za-z0-9-]+$/u;

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateJsonValue(value: unknown, seen: Set<object>): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return false;
    }

    seen.add(value);
    const valid = value.every((item) => validateJsonValue(item, seen));
    seen.delete(value);
    return valid;
  }

  if (!isPlainRecord(value)) {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }

  seen.add(value);
  try {
    for (const nestedValue of Object.values(value)) {
      if (!validateJsonValue(nestedValue, seen)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  } finally {
    seen.delete(value);
  }
}

export function isSupportedHttpMethod(method: string): method is VGSHTTPMethod {
  return METHOD_SET.has(method as VGSHTTPMethod);
}

/**
 * Applies public request defaults without mutating caller input.
 */
export function normalizeRequestInput(input: VGSShowRequestInput): NormalizedRequestInput {
  return {
    path: input.path,
    method: input.method ?? "POST",
    payload: input.payload ?? null,
    requestOptions: input.requestOptions ?? null
  };
}

/**
 * Validates the tenant ID characters accepted by vault host construction.
 */
export function isValidTenantId(id: string): boolean {
  return TENANT_ID_PATTERN.test(id);
}

/**
 * Validates the supported vault environments and live regional suffixes.
 */
export function isValidRegionalEnvironment(environment: string): boolean {
  return ENVIRONMENT_PATTERN.test(environment.toLowerCase());
}

/**
 * Validates the optional regional suffix used in vault host construction.
 */
export function isValidDataRegion(region: string): boolean {
  return region.length > 0 && DATA_REGION_PATTERN.test(region);
}

/**
 * Returns true when a payload can be safely encoded as JSON.
 */
export function isValidJsonPayload(payload: unknown): payload is Record<string, unknown> {
  return isPlainRecord(payload) && validateJsonValue(payload, new Set<object>());
}

/**
 * Encodes a plain JSON payload and returns headers needed for dispatch.
 */
export function encodeJsonPayload(payload: unknown): EncodedJsonPayload {
  if (!isValidJsonPayload(payload)) {
    return {
      outcome: "failure",
      error: new VGSShowError("invalidJSONPayload")
    };
  }

  return {
    outcome: "success",
    body: JSON.stringify(payload),
    additionalHeaders: {
      "Content-Type": "application/json"
    },
    roundTripsTo: JSON.parse(JSON.stringify(payload))
  };
}

/**
 * Resolves the request timeout in seconds.
 */
export function getRequestTimeoutSeconds(requestOptions?: VGSShowRequestOptions | null): number {
  return requestOptions?.requestTimeoutInterval ?? DEFAULT_REQUEST_TIMEOUT_SECONDS;
}

/**
 * Normalizes a customer-provided hostname for validation.
 */
export function normalizeHostname(hostname: string): string | null {
  const trimmed = hostname.trim();
  if (trimmed.length === 0 || /\s/u.test(trimmed)) {
    return null;
  }

  const withScheme = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//u.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    return parsed.hostname.length > 0 ? parsed.hostname : null;
  } catch {
    return null;
  }
}

/**
 * Builds the public validation URL used before routing requests to a custom
 * hostname.
 */
export function buildHostValidationUrl(hostname: string, tenantId: string): string | null {
  const normalizedHostname = normalizeHostname(hostname);
  if (normalizedHostname === null) {
    return null;
  }

  return `${HOST_VALIDATION_BASE_URL}/${normalizedHostname}__${tenantId}.txt`;
}

/**
 * Resolves the custom hostname validation response into an absolute base URL.
 */
export function resolveCustomHostnameResult(hostname: string, responseBody: string | null): string | null {
  const normalizedHostname = normalizeHostname(hostname);
  if (normalizedHostname === null || responseBody === null || !responseBody.includes(normalizedHostname)) {
    return null;
  }

  const withScheme = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//u.test(responseBody)
    ? responseBody
    : `https://${responseBody}`;

  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

/**
 * Builds the `vgs-client` header value.
 */
export function buildVgsClientHeader(options: VgsClientHeaderOptions = {}): string {
  const sdkVersion = options.sdkVersion ?? DEFAULT_VGS_SHOW_SDK_VERSION;
  const platform = options.platform ?? "react-native";
  const analyticsEnabled = options.analyticsEnabled ?? true;
  const sessionId = options.sessionId ?? "session";

  return [
    `source=${VGS_CLIENT_SOURCE}`,
    `sdkVersion=${sdkVersion}`,
    `platform=${platform}`,
    `analytics=${analyticsEnabled}`,
    `sessionId=${sessionId}`
  ].join("; ");
}

/**
 * Builds SDK-managed default request headers.
 */
export function buildDefaultHeaders(options: VgsClientHeaderOptions = {}): HeaderMap {
  return {
    "vgs-client": buildVgsClientHeader(options)
  };
}

/**
 * Merges header maps case-insensitively while preserving the latest casing.
 */
export function mergeHeaders(...headerSets: Array<HeaderMap | undefined>): HeaderMap {
  const merged = new Map<string, { name: string; value: string }>();

  for (const headers of headerSets) {
    if (headers === undefined) {
      continue;
    }

    for (const [name, value] of Object.entries(headers)) {
      merged.set(name.toLowerCase(), { name, value });
    }
  }

  return Object.fromEntries(Array.from(merged.values()).map(({ name, value }) => [name, value]));
}

/**
 * Joins the configured base URL and request path without duplicating slashes.
 */
export function joinRequestPath(baseUrl: string, requestPath: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = requestPath.replace(/^\/+/u, "");
  return `${normalizedBase}/${normalizedPath}`;
}

/**
 * Builds a dispatchable request from public request input.
 */
export function buildRequest(input: RequestBuildInput): BuiltRequest | VGSShowError {
  // Contributor guidance: the returned request can contain custom headers and
  // payload body. Keep it confined to dispatch and tests.
  const normalized = normalizeRequestInput(input.request);
  const encodedPayload = normalized.payload === null ? null : encodeJsonPayload(normalized.payload);

  if (encodedPayload?.outcome === "failure") {
    return encodedPayload.error;
  }

  const payloadHeaders = encodedPayload?.additionalHeaders;
  const headerOptions: VgsClientHeaderOptions = {};
  if (input.analyticsEnabled !== undefined) {
    headerOptions.analyticsEnabled = input.analyticsEnabled;
  }
  if (input.sessionId !== undefined) {
    headerOptions.sessionId = input.sessionId;
  }
  if (input.sdkVersion !== undefined) {
    headerOptions.sdkVersion = input.sdkVersion;
  }
  if (input.platform !== undefined) {
    headerOptions.platform = input.platform;
  }

  const headers = mergeHeaders(
    buildDefaultHeaders(headerOptions),
    input.customHeaders,
    payloadHeaders
  );

  return {
    url: joinRequestPath(input.baseUrl, normalized.path),
    method: normalized.method,
    headers,
    timeoutSeconds: getRequestTimeoutSeconds(normalized.requestOptions),
    body: encodedPayload?.body ?? null
  };
}

/**
 * Maps platform/network error metadata to a stable SDK numeric code.
 */
export function mapNetworkErrorCode(error: { code?: number } | undefined): number {
  return typeof error?.code === "number" && Number.isFinite(error.code)
    ? error.code
    : DEFAULT_NETWORK_ERROR_CODE;
}

/**
 * Maps a simulated network response to the public request success/error shape.
 */
export function mapSimulatedResponse(response: SimulatedResponse): RequestOutcome {
  if (response.kind === "networkError") {
    return {
      outcome: "reject",
      error: new VGSShowError("unexpectedResponseType", {
        extraInfo: {
          code: mapNetworkErrorCode(response),
          cause: response.message ?? "Network request failed"
        }
      })
    };
  }

  if (response.status >= 200 && response.status < 300) {
    return {
      outcome: "resolve",
      value: {
        code: response.status
      }
    };
  }

  return {
    outcome: "reject",
    error: new VGSShowError("unexpectedResponseType", {
      extraInfo: {
        code: response.status
      }
    })
  };
}

/**
 * Models queued custom-host requests for unit tests.
 */
export function simulateHostnameQueue(requestIds: readonly string[]): Array<{ requestId: string; dispatchedAfterResolution: boolean }> {
  return requestIds.map((requestId) => ({
    requestId,
    dispatchedAfterResolution: true
  }));
}

/**
 * Computes the next custom-host routing policy after validation completes.
 */
export function transitionHostURLPolicy(input: {
  initial: HostURLPolicy;
  resolvedUrl: string | null;
}): HostURLPolicy {
  if (input.initial !== "customResolving") {
    return input.initial;
  }

  return input.resolvedUrl === null ? "customFallbackVault" : "customResolved";
}

/**
 * Creates the stable invalid-configuration error used by vault routing checks.
 */
export function invalidConfigurationError(): VGSShowError {
  return new VGSShowError("invalidConfigurationURL");
}
