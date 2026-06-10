type BufferConstructorLike = {
  from(input: string, encoding: "base64"): {
    readonly length: number;
    readonly [index: number]: number;
  };
};

type Base64Runtime = {
  readonly atob?: (input: string) => string;
  readonly Buffer?: BufferConstructorLike;
};

export type RenderableImageMimeType =
  | "image/jpeg"
  | "image/png";

function decodeBase64ToBytes(dataBase64: string): readonly number[] {
  const runtime = globalThis as Base64Runtime;

  if (typeof runtime.atob === "function") {
    const binary = runtime.atob(dataBase64);
    return Array.from(binary, (char) => char.charCodeAt(0));
  }

  if (runtime.Buffer !== undefined) {
    const buffer = runtime.Buffer.from(dataBase64, "base64");
    return Array.from({ length: buffer.length }, (_, index) => buffer[index] ?? 0);
  }

  throw new Error("No base64 decoder is available in this runtime");
}

function startsWithBytes(bytes: readonly number[], prefix: readonly number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

function startsWithAscii(bytes: readonly number[], prefix: string): boolean {
  return Array.from(prefix).every((char, index) => bytes[index] === char.charCodeAt(0));
}

/**
 * Returns a concrete MIME type when decoded media bytes match a supported
 * image format.
 */
export function imageMimeTypeForBase64(dataBase64: string): RenderableImageMimeType | null {
  // Contributor guidance: callers pass revealed base64 media. Keep validation
  // pure and do not log or emit diagnostics derived from the input.
  const bytes = decodeBase64ToBytes(dataBase64);
  if (bytes.length === 0) {
    return null;
  }

  const isPng = startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isJpeg = startsWithBytes(bytes, [0xff, 0xd8, 0xff]);

  if (isPng) {
    return "image/png";
  }

  if (isJpeg) {
    return "image/jpeg";
  }

  return null;
}

/**
 * Checks whether decoded media bytes match a supported image format.
 */
export function isRenderableImageBase64(dataBase64: string): boolean {
  return imageMimeTypeForBase64(dataBase64) !== null;
}

/**
 * Checks whether decoded media bytes look like a PDF document.
 */
export function isRenderablePdfBase64(dataBase64: string): boolean {
  // Contributor guidance: callers pass revealed base64 media. Keep validation
  // pure and do not log or emit diagnostics derived from the input.
  const bytes = decodeBase64ToBytes(dataBase64);
  return bytes.length > 0 && startsWithAscii(bytes, "%PDF-");
}
