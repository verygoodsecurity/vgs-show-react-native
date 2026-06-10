export const VGS_SHOW_ERROR_DOMAIN = "vgsshow.sdk";

/**
 * Stable SDK error identifiers.
 *
 * Use these keys for branching in app code when numeric codes are not enough.
 */
export type VGSErrorTypeKey =
  | "unexpectedResponseType"
  | "unexpectedResponseDataFormat"
  | "responseIsInvalidJSON"
  | "fieldNotFound"
  | "invalidJSONPayload"
  | "invalidBase64Data"
  | "invalidPDFData"
  | "invalidImageData"
  | "invalidConfigurationURL";

/**
 * Static catalog entry for one SDK error.
 */
export type VGSErrorCatalogEntry = {
  readonly code: number;
  readonly message: string;
  readonly errorKey: string;
};

/**
 * JSON-safe error representation used by tests and diagnostics.
 */
export type SerializedVGSShowError = {
  readonly code: number;
  readonly type: VGSErrorTypeKey;
  readonly message: string;
  readonly domain: typeof VGS_SHOW_ERROR_DOMAIN;
  readonly extraInfo?: Record<string, unknown>;
};

const ERROR_CATALOG = {
  unexpectedResponseType: {
    code: 1400,
    message: "Unexpected response type",
    errorKey: "VGSSDKErrorUnexpectedResponseType"
  },
  unexpectedResponseDataFormat: {
    code: 1401,
    message: "Unexpected Response Data Format",
    errorKey: "VGSSDKErrorUnexpectedResponseDataFormat"
  },
  responseIsInvalidJSON: {
    code: 1402,
    message: "Response body is not valid JSON",
    errorKey: "VGSSDKErrorResponseIsInvalidJSON"
  },
  fieldNotFound: {
    code: 1403,
    message: "Field not found in specified path",
    errorKey: "VGSSDKErrorFieldNotFound"
  },
  invalidJSONPayload: {
    code: 1404,
    message: "Payload is not valid JSON",
    errorKey: "VGSSDKErrorInvalidJSONPayload"
  },
  invalidBase64Data: {
    code: 1405,
    message: "Payload is not valid base64 data",
    errorKey: "VGSSDKErrorInvalidBase64Data"
  },
  invalidPDFData: {
    code: 1406,
    message: "Cannot render PDF with invalid data",
    errorKey: "VGSSDKErrorInvalidPDFData"
  },
  invalidImageData: {
    code: 1407,
    message: "Cannot render Image with invalid data",
    errorKey: "VGSSDKErrorInvalidImageData"
  },
  invalidConfigurationURL: {
    code: 1480,
    message: "VGS configuration URL is not valid",
    errorKey: "VGSSDKErrorInvalidConfigurationURL"
  }
} as const satisfies Record<VGSErrorTypeKey, VGSErrorCatalogEntry>;

export const VGSErrorCatalog: Readonly<Record<VGSErrorTypeKey, VGSErrorCatalogEntry>> =
  ERROR_CATALOG;

/**
 * Returns the numeric code for an SDK error type.
 */
export function codeForType(type: VGSErrorTypeKey): number {
  return ERROR_CATALOG[type].code;
}

/**
 * Returns the default message for an SDK error type.
 */
export function messageForType(type: VGSErrorTypeKey): string {
  return ERROR_CATALOG[type].message;
}

/**
 * Returns the iOS-compatible catalog key for an SDK error type.
 */
export function errorKeyForType(type: VGSErrorTypeKey): string {
  return ERROR_CATALOG[type].errorKey;
}

/**
 * Optional metadata for constructing a `VGSShowError`.
 */
export type VGSShowErrorOptions = {
  /** Safe diagnostic metadata only. */
  readonly extraInfo?: Record<string, unknown>;
  /** Optional underlying cause. */
  readonly cause?: unknown;
};

/**
 * Stable error type emitted by `VGSShow` requests and component callbacks.
 *
 * App integrations should branch on `type` or `code`.
 */
export class VGSShowError extends Error {
  /** SDK error domain shared by all `VGSShowError` instances. */
  public static readonly domain = VGS_SHOW_ERROR_DOMAIN;

  /** Numeric SDK error code. */
  public readonly code: number;
  /** Stable SDK error type key. */
  public readonly type: VGSErrorTypeKey;
  /** SDK error domain. */
  public readonly domain = VGS_SHOW_ERROR_DOMAIN;
  /** Safe diagnostic metadata. */
  public readonly extraInfo: Record<string, unknown> | undefined;

  public constructor(type: VGSErrorTypeKey, options: VGSShowErrorOptions = {}) {
    const catalogEntry = ERROR_CATALOG[type];
    super(catalogEntry.message);
    this.name = "VGSShowError";
    this.code = catalogEntry.code;
    this.type = type;

    if (options.extraInfo !== undefined || options.cause !== undefined) {
      this.extraInfo = {
        ...(options.extraInfo ?? {}),
        ...(options.cause !== undefined ? { cause: options.cause } : {})
      };
    }
  }

  /**
   * Serializes the error into a JSON-safe diagnostic object.
   */
  public toJSON(): SerializedVGSShowError {
    const serialized: SerializedVGSShowError = {
      code: this.code,
      type: this.type,
      message: this.message,
      domain: this.domain
    };

    if (this.extraInfo !== undefined) {
      return {
        ...serialized,
        extraInfo: this.extraInfo
      };
    }

    return serialized;
  }
}
