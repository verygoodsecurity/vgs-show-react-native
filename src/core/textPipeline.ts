/**
 * Inclusive character range used for display masking.
 *
 * `start` and `end` are based on Unicode code points after formatting has been
 * applied. Missing bounds mean the beginning or end of the string.
 */
export type VGSTextRange = {
  readonly start?: number | null;
  readonly end?: number | null;
};

/**
 * Regex transformation applied to revealed text before display or transformed
 * copy.
 */
export type VGSTransformationRegex = {
  readonly pattern: RegExp;
  readonly template: string;
};

/**
 * Copy mode supported by `VGSShowLabelRef.copyToClipboard`.
 */
export type VGSShowTextCopyFormat = "raw" | "transformed";

/**
 * Non-fatal text-pipeline warning identifiers.
 */
export type VGSTextPipelineWarning = "secureTextSymbolLengthGreaterThanOne";

/**
 * Snapshot of text transformation and masking state.
 */
export type VGSShowTextPipelineSnapshot = {
  readonly rawText: string | null;
  readonly transformedText: string | null;
  readonly displayText: string | null;
  readonly isSecureText: boolean;
  readonly secureTextSymbol: string;
  readonly secureTextRanges: readonly VGSTextRange[];
  readonly transformationRegexes: readonly VGSTransformationRegex[];
  readonly hasFormatting: boolean;
  readonly warnings: readonly VGSTextPipelineWarning[];
};

const DEFAULT_SECURE_TEXT_SYMBOL = "*";
const DEFAULT_SECURE_RANGE: VGSTextRange = {
  start: null,
  end: null
};

function cloneRange(range: VGSTextRange): VGSTextRange {
  return {
    ...(range.start === undefined ? {} : { start: range.start }),
    ...(range.end === undefined ? {} : { end: range.end })
  };
}

function cloneFormatter(formatter: VGSTransformationRegex): VGSTransformationRegex {
  return {
    pattern: formatter.pattern,
    template: formatter.template
  };
}

function normalizeRangeStart(range: VGSTextRange): number | null {
  return range.start ?? null;
}

function normalizeRangeEnd(range: VGSTextRange): number | null {
  return range.end ?? null;
}

function isRangeStartValid(start: number | null, textLength: number): boolean {
  return start === null || (start >= 0 && start < textLength);
}

function isRangeEndValid(end: number | null): boolean {
  return end === null || end >= 0;
}

function normalizeIndexRange(range: VGSTextRange, textLength: number): { start: number; end: number } | null {
  if (textLength === 0) {
    return null;
  }

  const start = normalizeRangeStart(range);
  const end = normalizeRangeEnd(range);

  if (!isRangeStartValid(start, textLength) || !isRangeEndValid(end)) {
    return null;
  }

  const normalizedStart = start ?? 0;
  const normalizedEnd = Math.min(end ?? textLength - 1, textLength - 1);

  if (normalizedStart > normalizedEnd) {
    return null;
  }

  return {
    start: normalizedStart,
    end: normalizedEnd
  };
}

function applyFormatterSequence(text: string, formatters: readonly VGSTransformationRegex[]): string {
  return formatters.reduce(
    (current, formatter) => current.replace(formatter.pattern, formatter.template),
    text
  );
}

function applySecureRanges(
  text: string,
  ranges: readonly VGSTextRange[],
  secureTextSymbol: string
): string {
  if (secureTextSymbol.length === 0) {
    return text;
  }

  const characters = Array.from(text);

  for (const range of ranges) {
    const normalized = normalizeIndexRange(range, characters.length);
    if (normalized === null) {
      continue;
    }

    for (let index = normalized.start; index <= normalized.end; index += 1) {
      characters[index] = secureTextSymbol;
    }
  }

  return characters.join("");
}

/**
 * Validates that a range can be applied to a specific text value.
 */
export function isTextRangeValid(text: string, range: VGSTextRange): boolean {
  const characters = Array.from(text);
  if (characters.length === 0) {
    return false;
  }

  return normalizeIndexRange(range, characters.length) !== null;
}

/**
 * Text transformation and masking pipeline used by `VGSShowLabelController`.
 *
 * Formatting runs before secure masking. Copy operations can request the raw
 * revealed text or the transformed text, but public callbacks still receive
 * only the selected copy format.
 */
export class VGSShowTextPipeline {
  private rawTextValue: string | null = null;
  private isSecureTextValue = false;
  private secureTextSymbolValue = DEFAULT_SECURE_TEXT_SYMBOL;
  private secureTextRangesValue: VGSTextRange[] = [];
  private hasExplicitSecureTextRanges = false;
  private transformationRegexesValue: VGSTransformationRegex[] = [];
  private warningLog: VGSTextPipelineWarning[] = [];

  /**
   * Returns the current raw, transformed, and display text state.
   */
  public get snapshot(): VGSShowTextPipelineSnapshot {
    const transformedText = this.rawTextValue === null
      ? null
      : applyFormatterSequence(this.rawTextValue, this.transformationRegexesValue);

    const displayText =
      transformedText === null
        ? null
        : this.isSecureTextValue
          ? applySecureRanges(transformedText, this.getEffectiveSecureTextRanges(), this.secureTextSymbolValue)
          : transformedText;

    return {
      rawText: this.rawTextValue,
      transformedText,
      displayText,
      isSecureText: this.isSecureTextValue,
      secureTextSymbol: this.secureTextSymbolValue,
      secureTextRanges: this.secureTextRangesValue.map(cloneRange),
      transformationRegexes: this.transformationRegexesValue.map(cloneFormatter),
      hasFormatting: this.transformationRegexesValue.length > 0,
      warnings: [...this.warningLog]
    };
  }

  /** Sets the revealed text held by the pipeline. */
  public setRawText(rawText: string | null): VGSShowTextPipelineSnapshot {
    this.rawTextValue = rawText;
    this.maybeEmitSecureTextSymbolWarning();
    return this.snapshot;
  }

  /** Enables or disables secure display masking. */
  public setIsSecureText(isSecureText: boolean): VGSShowTextPipelineSnapshot {
    this.isSecureTextValue = isSecureText;
    if (!isSecureText) {
      return this.snapshot;
    }

    this.maybeEmitSecureTextSymbolWarning();
    return this.snapshot;
  }

  /** Enables secure display masking for explicit ranges. */
  public setSecureText(ranges: readonly VGSTextRange[]): VGSShowTextPipelineSnapshot {
    this.isSecureTextValue = true;
    this.hasExplicitSecureTextRanges = true;
    this.secureTextRangesValue = ranges.map(cloneRange);
    this.maybeEmitSecureTextSymbolWarning();
    return this.snapshot;
  }

  /** Sets the mask symbol used for secure display text. */
  public setSecureTextSymbol(secureTextSymbol: string): VGSShowTextPipelineSnapshot {
    this.secureTextSymbolValue = secureTextSymbol;
    this.maybeEmitSecureTextSymbolWarning();
    return this.snapshot;
  }

  /** Adds a regex formatter to the end of the formatter sequence. */
  public addTransformationRegex(formatter: VGSTransformationRegex): VGSShowTextPipelineSnapshot {
    this.transformationRegexesValue = [
      ...this.transformationRegexesValue,
      cloneFormatter(formatter)
    ];
    this.maybeEmitSecureTextSymbolWarning();
    return this.snapshot;
  }

  /** Removes all regex formatters. */
  public resetAllFormatters(): VGSShowTextPipelineSnapshot {
    this.transformationRegexesValue = [];
    this.maybeEmitSecureTextSymbolWarning();
    return this.snapshot;
  }

  /**
   * Returns text for a copy action.
   */
  public copyText(format: VGSShowTextCopyFormat): string | null {
    // Contributor guidance: keep the returned value inside the clipboard flow.
    const snapshot = this.snapshot;
    return format === "raw" ? snapshot.rawText : snapshot.transformedText;
  }

  /** Clears non-fatal warning history. */
  public clearWarnings(): VGSShowTextPipelineSnapshot {
    this.warningLog = [];
    return this.snapshot;
  }

  private getEffectiveSecureTextRanges(): readonly VGSTextRange[] {
    if (!this.isSecureTextValue) {
      return [];
    }

    if (this.hasExplicitSecureTextRanges) {
      return this.secureTextRangesValue;
    }

    return [DEFAULT_SECURE_RANGE];
  }

  private maybeEmitSecureTextSymbolWarning(): void {
    const snapshot = {
      rawText: this.rawTextValue,
      isSecureText: this.isSecureTextValue,
      secureTextSymbol: this.secureTextSymbolValue,
      effectiveRanges: this.getEffectiveSecureTextRanges()
    };

    if (
      snapshot.rawText !== null &&
      snapshot.isSecureText &&
      snapshot.secureTextSymbol.length > 1 &&
      snapshot.effectiveRanges.length > 0
    ) {
      this.warningLog = [
        ...this.warningLog,
        "secureTextSymbolLengthGreaterThanOne"
      ];
    }
  }
}

/**
 * Creates a text pipeline for one label controller.
 */
export function createTextPipeline(): VGSShowTextPipeline {
  return new VGSShowTextPipeline();
}
