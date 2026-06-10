import * as React from "react";
import { Text } from "react-native";
import {
  VGSAnalyticsClient,
  VGSLogger,
  VGSShow,
  VGSShowError,
  createContentStateMachine,
  createTextPipeline,
  type VGSContentStateMachine,
  type VGSShowTextCopyFormat,
  type VGSShowTextPipeline,
  type VGSTextRange,
  type VGSTransformationRegex
} from "../core/index.js";
import {
  subscribeVGSShowView,
  unsubscribeVGSShowView,
  type VGSShowDecodingResult,
  type VGSShowSubscribableView
} from "../core/VGSShow.js";

/**
 * React Native style object applied while a label is showing placeholder text.
 */
export type VGSShowPlaceholderStyle = Record<string, unknown>;

/**
 * Props for `VGSShowLabel`, the text reveal component.
 */
export type VGSShowLabelProps = {
  /** Shared reveal orchestrator. Use the same instance for fields revealed by one request. */
  readonly vgsShow: VGSShow;
  /** Dot-separated path to the text field in the reveal response. */
  readonly contentPath: string;
  /** Text rendered before reveal, after clear, or when no text is available. */
  readonly placeholder?: string;
  /** React Native style applied only to placeholder text. */
  readonly placeholderStyle?: VGSShowPlaceholderStyle;
  /** Masks the displayed text while preserving internal copy behavior. */
  readonly isSecureText?: boolean;
  /** Single-character mask symbol. Longer symbols are accepted but can shift layout. */
  readonly secureTextSymbol?: string;
  /** Called when displayed text changes. The revealed value is not passed to this callback. */
  readonly onTextChange?: () => void;
  /** Called after a copy action completes. Only the selected copy format is exposed. */
  readonly onCopyTextFinish?: (format: VGSShowTextCopyFormat) => void;
  /** Called when this label cannot resolve or render its subscribed field. */
  readonly onRevealError?: (error: VGSShowError) => void;
};

/**
 * Imperative actions exposed by `VGSShowLabel`.
 *
 * The ref intentionally does not expose the revealed string. Use it for display
 * actions such as masking, formatting, copying, and clearing.
 */
export type VGSShowLabelRef = {
  /** Clears the current text from the component state. */
  clearText(): void;
  /** Copies either raw or transformed text through the runtime clipboard bridge. */
  copyToClipboard(input: { readonly format: VGSShowTextCopyFormat }): void;
  /** Enables secure display masking for one range or several ranges. */
  setSecureText(input: VGSTextRange | { readonly ranges: readonly VGSTextRange[] }): void;
  /** Adds a display/copy formatter that runs after reveal. */
  addTransformationRegex(formatter: VGSTransformationRegex): void;
  /** Removes all display/copy formatters. */
  resetAllFormatters(): void;
};

/**
 * Controller snapshot used by tests and component rendering.
 */
export type VGSShowLabelSnapshot = {
  readonly contentPath: string;
  readonly displayText: string | null;
  readonly placeholderVisible: boolean;
  readonly accessibilityLabel: string | null;
  readonly isMounted: boolean;
};

type ClipboardAdapter = {
  writeText(text: string): void;
};

type VGSShowLabelControllerOptions = VGSShowLabelProps & {
  readonly viewId?: string;
  readonly clipboardAdapter?: ClipboardAdapter;
  readonly autoMount?: boolean;
};

type RuntimeNavigatorClipboard = {
  writeText(text: string): void | Promise<void>;
};

function getRuntimeClipboard(): RuntimeNavigatorClipboard | null {
  const runtime = globalThis as {
    navigator?: {
      clipboard?: RuntimeNavigatorClipboard;
    };
  };

  const clipboard = runtime.navigator?.clipboard;
  if (clipboard === undefined || typeof clipboard.writeText !== "function") {
    return null;
  }

  return clipboard;
}

const DEFAULT_CLIPBOARD_ADAPTER: ClipboardAdapter = {
  writeText(text) {
    const clipboard = getRuntimeClipboard();
    if (clipboard === null) {
      return;
    }

    void clipboard.writeText(text);
  }
};

function normalizeSecureTextInput(input: VGSTextRange | { readonly ranges: readonly VGSTextRange[] }): readonly VGSTextRange[] {
  return "ranges" in input ? input.ranges : [input];
}

function shouldNotifyForSnapshot(snapshot: { readonly displayText: string | null }): boolean {
  return snapshot.displayText !== null;
}

function warnIfContentPathEmpty(contentPath: string): void {
  if (contentPath.length === 0) {
    VGSLogger.shared.warning("VGSShowLabel contentPath is empty.");
  }
}

/**
 * React-independent controller behind `VGSShowLabel`.
 */
export class VGSShowLabelController {
  private props: VGSShowLabelProps;
  private readonly viewId: string | undefined;
  private readonly clipboardAdapter: ClipboardAdapter;
  private readonly pipeline: VGSShowTextPipeline = createTextPipeline();
  private readonly stateMachine: VGSContentStateMachine = createContentStateMachine("text");
  private readonly subscribableView: VGSShowSubscribableView;
  private mounted = false;

  public readonly ref: VGSShowLabelRef = {
    clearText: () => {
      this.clearText();
    },
    copyToClipboard: (input) => {
      this.copyToClipboard(input);
    },
    setSecureText: (input) => {
      this.setSecureText(input);
    },
    addTransformationRegex: (formatter) => {
      this.addTransformationRegex(formatter);
    },
    resetAllFormatters: () => {
      this.resetAllFormatters();
    }
  };

  public constructor(options: VGSShowLabelControllerOptions) {
    // Contributor guidance: this controller owns revealed text while mounted.
    // Public React callbacks should remain notification-only.
    this.props = options;
    this.viewId = options.viewId;
    this.clipboardAdapter = options.clipboardAdapter ?? DEFAULT_CLIPBOARD_ADAPTER;
    this.pipeline.setIsSecureText(options.isSecureText ?? false);
    if (options.secureTextSymbol !== undefined) {
      this.pipeline.setSecureTextSymbol(options.secureTextSymbol);
    }

    const controller = this;
    this.subscribableView = {
      get viewId() {
        return controller.viewId ?? "label";
      },
      kind: "label",
      get contentPath() {
        return controller.props.contentPath;
      },
      decodingContentMode: "text",
      onLoading() {
        controller.handleLoading();
      },
      handleDecodingResult(result) {
        controller.handleDecodingResult(result);
      }
    };

    warnIfContentPathEmpty(options.contentPath);
    if (options.autoMount ?? true) {
      this.mount();
    }
  }

  public get snapshot(): VGSShowLabelSnapshot {
    const displayText = this.pipeline.snapshot.displayText;
    return {
      contentPath: this.props.contentPath,
      displayText,
      placeholderVisible: this.stateMachine.snapshot.placeholderVisible,
      accessibilityLabel: displayText === null ? this.props.placeholder ?? null : null,
      isMounted: this.mounted
    };
  }

  public updateProps(nextProps: VGSShowLabelProps): void {
    const previousProps = this.props;
    this.props = nextProps;

    warnIfContentPathEmpty(nextProps.contentPath);

    if (previousProps.vgsShow !== nextProps.vgsShow) {
      unsubscribeVGSShowView(previousProps.vgsShow, this.subscribableView);
      this.mount();
    }

    if ((previousProps.isSecureText ?? false) !== (nextProps.isSecureText ?? false)) {
      const snapshot = this.pipeline.setIsSecureText(nextProps.isSecureText ?? false);
      if (shouldNotifyForSnapshot(snapshot)) {
        this.notifyTextChange();
      }
    }

    if (previousProps.secureTextSymbol !== nextProps.secureTextSymbol) {
      const snapshot = this.pipeline.setSecureTextSymbol(nextProps.secureTextSymbol ?? "*");
      if (shouldNotifyForSnapshot(snapshot)) {
        this.notifyTextChange();
      }
    }
  }

  public unmount(): void {
    if (!this.mounted) {
      return;
    }

    unsubscribeVGSShowView(this.props.vgsShow, this.subscribableView);
    this.mounted = false;
  }

  public mount(): void {
    if (this.mounted) {
      return;
    }

    subscribeVGSShowView(this.props.vgsShow, this.subscribableView);
    this.mounted = true;
  }

  public handleLoading(): void {
    this.stateMachine.startLoading();
    this.pipeline.setRawText(null);
  }

  public handleDecodingResult(result: VGSShowDecodingResult): void {
    if (result.kind === "failure") {
      this.pipeline.setRawText(null);
      this.stateMachine.fail(result.error);
      this.props.onRevealError?.(result.error);
      return;
    }

    if (result.content.kind !== "text") {
      const error = new VGSShowError("fieldNotFound");
      this.pipeline.setRawText(null);
      this.stateMachine.fail(error);
      this.props.onRevealError?.(error);
      return;
    }

    this.pipeline.setRawText(result.content.text);
    this.stateMachine.reveal(result.content);
    this.notifyTextChange();
  }

  public clearText(): void {
    this.pipeline.setRawText(null);
    this.stateMachine.clear();
    this.notifyTextChange();
  }

  public copyToClipboard(input: { readonly format: VGSShowTextCopyFormat }): void {
    const selectedText = this.pipeline.copyText(input.format);
    if (selectedText !== null) {
      this.clipboardAdapter.writeText(selectedText);
    }

    this.props.onCopyTextFinish?.(input.format);
    VGSAnalyticsClient.shared.trackCopy({ format: input.format });
  }

  public setSecureText(input: VGSTextRange | { readonly ranges: readonly VGSTextRange[] }): void {
    const snapshot = this.pipeline.setSecureText(normalizeSecureTextInput(input));
    VGSAnalyticsClient.shared.trackSetSecureTextRange({
      contentPath: this.props.contentPath
    });
    if (shouldNotifyForSnapshot(snapshot)) {
      this.notifyTextChange();
    }
  }

  public addTransformationRegex(formatter: VGSTransformationRegex): void {
    const snapshot = this.pipeline.addTransformationRegex(formatter);
    if (shouldNotifyForSnapshot(snapshot)) {
      this.notifyTextChange();
    }
  }

  public resetAllFormatters(): void {
    const snapshot = this.pipeline.resetAllFormatters();
    if (shouldNotifyForSnapshot(snapshot)) {
      this.notifyTextChange();
    }
  }

  private notifyTextChange(): void {
    this.props.onTextChange?.();
  }
}

export function __unstable__createVGSShowLabelControllerForTesting(
  options: VGSShowLabelControllerOptions
): VGSShowLabelController {
  return new VGSShowLabelController(options);
}

/**
 * Reveals and displays a text field from a `VGSShow.request()` response.
 *
 * The component subscribes to `vgsShow` on mount. When a reveal request
 * succeeds, it resolves `contentPath`, applies optional transformations and
 * secure masking, then renders the result inside a React Native `Text`.
 */
export const VGSShowLabel = React.forwardRef<VGSShowLabelRef, VGSShowLabelProps>(
  (props, ref) => {
    const [, setVersion] = React.useState(0);
    const controllerRef = React.useRef<VGSShowLabelController | null>(null);

    if (controllerRef.current === null) {
      controllerRef.current = new VGSShowLabelController({
        ...props,
        autoMount: false,
        onTextChange: () => {
          props.onTextChange?.();
          setVersion((value) => value + 1);
        },
        onRevealError: (error) => {
          props.onRevealError?.(error);
          setVersion((value) => value + 1);
        }
      });
    }

    React.useEffect(() => {
      const controller = controllerRef.current;
      controller?.mount();
      return () => {
        controller?.unmount();
      };
    }, []);

    React.useEffect(() => {
      const controller = controllerRef.current;
      if (controller === null) {
        return;
      }

      controller.updateProps({
        ...props,
        onTextChange: () => {
          props.onTextChange?.();
          setVersion((value) => value + 1);
        },
        onRevealError: (error) => {
          props.onRevealError?.(error);
          setVersion((value) => value + 1);
        }
      });
    });

    React.useImperativeHandle(ref, () => {
      if (controllerRef.current === null) {
        throw new Error("VGSShowLabel controller is not initialized");
      }

      return controllerRef.current.ref;
    });

    const snapshot = controllerRef.current.snapshot;
    const renderedText = snapshot.displayText ?? (snapshot.placeholderVisible ? props.placeholder ?? null : null);
    return React.createElement(
      Text,
      {
        accessibilityLabel: snapshot.accessibilityLabel,
        style: snapshot.displayText === null ? props.placeholderStyle : undefined
      },
      renderedText
    );
  }
);
