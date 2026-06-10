import { VGSShowError, type SerializedVGSShowError } from "./errors.js";

/**
 * Logical lifecycle state for content owned by a component controller.
 */
export type VGSContentState = "idle" | "loading" | "revealed" | "failed" | "cleared";

/**
 * Content family managed by a controller.
 */
export type VGSContentKind = "text" | "image" | "pdf";

/**
 * Revealed content held inside SDK internals.
 */
export type VGSContentValue =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "rawData";
      dataBase64: string;
    };

/**
 * Snapshot of component content state.
 */
export type VGSContentStateSnapshot = {
  readonly kind: VGSContentKind;
  readonly state: VGSContentState;
  readonly content?: VGSContentValue;
  readonly error?: SerializedVGSShowError;
  readonly hasContent: boolean;
  readonly hasImage: boolean;
  readonly hasDocument: boolean;
  readonly placeholderVisible: boolean;
};

/**
 * State-machine callbacks used by controllers and tests.
 */
export type VGSContentStateCallbacks = {
  readonly onStateChange?: (snapshot: VGSContentStateSnapshot) => void;
  readonly onError?: (error: VGSShowError, snapshot: VGSContentStateSnapshot) => void;
};

function hasRevealedContent(kind: VGSContentKind, state: VGSContentState, content: VGSContentValue | undefined): boolean {
  if (state !== "revealed" || content === undefined) {
    return false;
  }

  if (kind === "text") {
    return content.kind === "text";
  }

  return content.kind === "rawData";
}

/**
 * Small state machine shared by text, image, and PDF controllers.
 */
export class VGSContentStateMachine {
  public readonly kind: VGSContentKind;
  private stateValue: VGSContentState = "idle";
  private contentValue: VGSContentValue | undefined;
  private errorValue: VGSShowError | undefined;
  private readonly callbacks: VGSContentStateCallbacks;

  public constructor(kind: VGSContentKind, callbacks: VGSContentStateCallbacks = {}) {
    // Contributor guidance: this state machine may hold revealed content while
    // the component is in the revealed state. Prefer derived logical flags for
    // public surfaces.
    this.kind = kind;
    this.callbacks = callbacks;
  }

  /**
   * Returns the current logical state and safe derived flags.
   */
  public get snapshot(): VGSContentStateSnapshot {
    const hasContent = hasRevealedContent(this.kind, this.stateValue, this.contentValue);
    const snapshot: VGSContentStateSnapshot = {
      kind: this.kind,
      state: this.stateValue,
      hasContent,
      hasImage: this.kind === "image" && hasContent,
      hasDocument: this.kind === "pdf" && hasContent,
      placeholderVisible: this.kind === "text" && !hasContent
    };

    return {
      ...snapshot,
      ...(this.contentValue === undefined ? {} : { content: this.contentValue }),
      ...(this.errorValue === undefined ? {} : { error: this.errorValue.toJSON() })
    };
  }

  /** Moves the controller into loading state and clears previous content. */
  public startLoading(): VGSContentStateSnapshot {
    this.stateValue = "loading";
    this.contentValue = undefined;
    this.errorValue = undefined;
    return this.emitStateChange();
  }

  /** Stores revealed content internally and moves the controller to revealed. */
  public reveal(content: VGSContentValue): VGSContentStateSnapshot {
    this.stateValue = "revealed";
    this.contentValue = content;
    this.errorValue = undefined;
    return this.emitStateChange();
  }

  /** Stores a safe error and clears any previous content. */
  public fail(error: VGSShowError): VGSContentStateSnapshot {
    this.stateValue = "failed";
    this.contentValue = undefined;
    this.errorValue = error;
    const snapshot = this.emitStateChange();
    this.callbacks.onError?.(error, snapshot);
    return snapshot;
  }

  /** Clears content and moves the controller to cleared state. */
  public clear(): VGSContentStateSnapshot {
    this.stateValue = "cleared";
    this.contentValue = undefined;
    this.errorValue = undefined;
    return this.emitStateChange();
  }

  private emitStateChange(): VGSContentStateSnapshot {
    const snapshot = this.snapshot;
    this.callbacks.onStateChange?.(snapshot);
    return snapshot;
  }
}

/**
 * Creates a content state machine for one component controller.
 */
export function createContentStateMachine(
  kind: VGSContentKind,
  callbacks: VGSContentStateCallbacks = {}
): VGSContentStateMachine {
  return new VGSContentStateMachine(kind, callbacks);
}
