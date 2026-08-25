export const VGS_ANALYTICS_ENDPOINT =
  "https://vgs-collect-keeper.apps.verygood.systems/vgs";

type AnalyticsRequestInit = {
  method: "POST";
  headers: Record<string, string>;
  body: string;
};

export type VGSAnalyticsFetch = (
  url: string,
  init: AnalyticsRequestInit
) => PromiseLike<unknown>;

let testingFetch: VGSAnalyticsFetch | null | undefined;

function utf8Bytes(value: string): number[] {
  const bytes: number[] = [];

  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6));
      bytes.push(0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >> 12));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
      bytes.push(0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(0xf0 | (codePoint >> 18));
      bytes.push(0x80 | ((codePoint >> 12) & 0x3f));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
      bytes.push(0x80 | (codePoint & 0x3f));
    }
  }

  return bytes;
}

/** Encodes analytics JSON without relying on Node-only `Buffer`. */
export function encodeAnalyticsBody(payload: Record<string, unknown>): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes = utf8Bytes(JSON.stringify(payload));
  let encoded = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const combined =
      (first << 16) | ((second ?? 0) << 8) | (third ?? 0);

    encoded += alphabet[(combined >> 18) & 0x3f] ?? "";
    encoded += alphabet[(combined >> 12) & 0x3f] ?? "";
    encoded +=
      second === undefined ? "=" : (alphabet[(combined >> 6) & 0x3f] ?? "");
    encoded += third === undefined ? "=" : (alphabet[combined & 0x3f] ?? "");
  }

  return encoded;
}

function runtimeFetch(): VGSAnalyticsFetch | null {
  if (testingFetch !== undefined) {
    return testingFetch;
  }

  const runtime = globalThis as { fetch?: unknown };
  return typeof runtime.fetch === "function"
    ? (runtime.fetch as VGSAnalyticsFetch)
    : null;
}

/** Sends one best-effort analytics event without blocking reveal behavior. */
export function dispatchAnalyticsRequest(
  payload: Record<string, unknown>,
  sessionId: string
): void {
  const fetchFn = runtimeFetch();
  if (fetchFn === null) {
    return;
  }

  let body: string;
  try {
    body = encodeAnalyticsBody(payload);
  } catch {
    return;
  }

  const init: AnalyticsRequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      vgsShowSessionId: sessionId
    },
    body
  };

  try {
    void Promise.resolve(fetchFn(VGS_ANALYTICS_ENDPOINT, init)).catch(
      () => undefined
    );
  } catch {
    return;
  }
}

/** Replaces or disables the runtime fetch only for deterministic tests. */
export function __unstable__setAnalyticsFetchForTesting(
  fetchFn: VGSAnalyticsFetch | null | undefined
): void {
  testingFetch = fetchFn;
}
