import { VGSShowError } from "./errors.js";

const JSON_KEY_PATH_PATTERN = /^[A-Za-z0-9._-]+$/u;

function isObjectLike(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === "object";
}

/**
 * Resolves a dot-separated `contentPath` from a reveal response object.
 */
export function resolveJsonPath(json: unknown, contentPath: string): unknown | undefined {
  // Contributor guidance: support object keys only, not arbitrary JSONPath
  // expressions. This keeps field subscription behavior deterministic.
  let current: unknown = json;

  for (const segment of contentPath.split(".")) {
    if (!isObjectLike(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

/**
 * Resolves a `contentPath` and returns a string or the stable field-not-found
 * SDK error.
 */
export function resolveJsonPathAsString(json: unknown, contentPath: string): string | VGSShowError {
  const value = resolveJsonPath(json, contentPath);
  return typeof value === "string" ? value : new VGSShowError("fieldNotFound");
}

/**
 * Validates the supported dot-key path syntax.
 */
export function isValidJsonKeyPath(contentPath: string): boolean {
  return JSON_KEY_PATH_PATTERN.test(contentPath);
}
