import * as React from "react";
import {
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import Pdf from "react-native-pdf";
import {
  VGSAnalyticsClient,
  VGSLogger,
  VGSShow,
  VGSShowError,
  createContentStateMachine,
  type VGSContentState,
  type VGSContentStateMachine
} from "../core/index.js";
import {
  subscribeVGSShowView,
  unsubscribeVGSShowView,
  type VGSShowDecodingResult,
  type VGSShowSubscribableView
} from "../core/VGSShow.js";
import { isRenderablePdfBase64 } from "./mediaValidation.js";

/**
 * PDF page layout mode requested by the React Native PDF renderer.
 */
export type VGSShowPdfDisplayMode =
  | "singlePage"
  | "singlePageContinuous"
  | "twoUp"
  | "twoUpContinuous";

/**
 * PDF scroll direction requested by the React Native PDF renderer.
 */
export type VGSShowPdfDisplayDirection = "vertical" | "horizontal";

/**
 * Props for `VGSShowPdf`, the base64 PDF reveal component.
 */
export type VGSShowPdfProps = {
  /** Shared reveal orchestrator. Use the same instance for fields revealed by one request. */
  readonly vgsShow: VGSShow;
  /** Dot-separated path to the base64 PDF field in the reveal response. */
  readonly contentPath: string;
  /** Page display mode. Defaults to `"singlePageContinuous"`. */
  readonly pdfDisplayMode?: VGSShowPdfDisplayMode;
  /** Page scroll direction. Defaults to `"vertical"`. */
  readonly pdfDisplayDirection?: VGSShowPdfDisplayDirection;
  /** Enables automatic scaling in native PDF renderers. Defaults to `true`. */
  readonly pdfAutoScales?: boolean;
  /** Requests book-style page presentation when the renderer supports it. */
  readonly displayAsBook?: boolean;
  /** Enables page shadows when the renderer supports them. Defaults to `true`. */
  readonly pageShadowsEnabled?: boolean;
  /** React Native style applied to the underlying PDF renderer container. Define dimensions or flex. */
  readonly style?: StyleProp<ViewStyle>;
  /** Optional renderer background color. */
  readonly pdfBackgroundColor?: string | null;
  /** Called when document state changes. The base64 payload is not passed out. */
  readonly onDocumentChange?: () => void;
  /** Called when the PDF field is missing, invalid, or not renderable. */
  readonly onDocumentError?: (error: VGSShowError) => void;
};

/**
 * Imperative actions and logical state exposed by `VGSShowPdf`.
 */
export type VGSShowPdfRef = {
  /** True when the component currently holds renderable PDF content. */
  readonly hasDocument: boolean;
  /** Clears the current document from component state. */
  clear(): void;
};

/**
 * Controller snapshot used by tests and rendering.
 */
export type VGSShowPdfSnapshot = {
  readonly contentPath: string;
  readonly state: VGSContentState;
  readonly hasDocument: boolean;
  readonly displayMode: VGSShowPdfDisplayMode;
  readonly displayDirection: VGSShowPdfDisplayDirection;
  readonly autoScales: boolean;
  readonly displayAsBook: boolean;
  readonly pageShadowsEnabled: boolean;
  readonly pdfBackgroundColor: string | null;
  readonly isMounted: boolean;
};

type VGSShowPdfControllerOptions = VGSShowPdfProps & {
  readonly viewId?: string;
  readonly renderValidator?: (dataBase64: string) => boolean;
  readonly autoMount?: boolean;
  readonly onStateChange?: () => void;
};

const DEFAULT_PDF_DISPLAY_MODE: VGSShowPdfDisplayMode = "singlePageContinuous";
const DEFAULT_PDF_DISPLAY_DIRECTION: VGSShowPdfDisplayDirection = "vertical";

function warnIfContentPathEmpty(contentPath: string): void {
  if (contentPath.length === 0) {
    VGSLogger.shared.warning("VGSShowPdf contentPath is empty.");
  }
}

/**
 * React-independent controller behind `VGSShowPdf`.
 */
export class VGSShowPdfController {
  private props: VGSShowPdfProps;
  private readonly viewId: string | undefined;
  private readonly renderValidator: (dataBase64: string) => boolean;
  private readonly onStateChange: () => void;
  private readonly stateMachine: VGSContentStateMachine = createContentStateMachine("pdf");
  private readonly subscribableView: VGSShowSubscribableView;
  private documentDataBase64: string | null = null;
  private mounted = false;

  public readonly ref: VGSShowPdfRef;

  public constructor(options: VGSShowPdfControllerOptions) {
    // Contributor guidance: base64 PDF content stays private to this
    // controller. React refs and callbacks should expose logical state only.
    this.props = options;
    this.viewId = options.viewId;
    this.renderValidator = options.renderValidator ?? isRenderablePdfBase64;
    this.onStateChange = options.onStateChange ?? (() => undefined);

    const controller = this;
    this.ref = {
      get hasDocument() {
        return controller.stateMachine.snapshot.hasDocument;
      },
      clear() {
        controller.clear();
      }
    };

    this.subscribableView = {
      get viewId() {
        return controller.viewId ?? "pdf";
      },
      kind: "pdf",
      get contentPath() {
        return controller.props.contentPath;
      },
      decodingContentMode: "pdfBase64",
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

  public get snapshot(): VGSShowPdfSnapshot {
    const snapshot = this.stateMachine.snapshot;
    return {
      contentPath: this.props.contentPath,
      state: snapshot.state,
      hasDocument: snapshot.hasDocument,
      displayMode: this.props.pdfDisplayMode ?? DEFAULT_PDF_DISPLAY_MODE,
      displayDirection: this.props.pdfDisplayDirection ?? DEFAULT_PDF_DISPLAY_DIRECTION,
      autoScales: this.props.pdfAutoScales ?? true,
      displayAsBook: this.props.displayAsBook ?? false,
      pageShadowsEnabled: this.props.pageShadowsEnabled ?? true,
      pdfBackgroundColor: this.props.pdfBackgroundColor ?? null,
      isMounted: this.mounted
    };
  }

  public updateProps(nextProps: VGSShowPdfProps): void {
    const previousProps = this.props;
    this.props = nextProps;

    warnIfContentPathEmpty(nextProps.contentPath);

    if (previousProps.vgsShow !== nextProps.vgsShow) {
      if (this.mounted) {
        unsubscribeVGSShowView(previousProps.vgsShow, this.subscribableView);
        this.mounted = false;
        this.mount();
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
    this.documentDataBase64 = null;
    this.stateMachine.startLoading();
    this.onStateChange();
  }

  public handleDecodingResult(result: VGSShowDecodingResult): void {
    if (result.kind === "failure") {
      this.fail(result.error);
      return;
    }

    if (result.content.kind !== "rawData") {
      this.fail(new VGSShowError("fieldNotFound"));
      return;
    }

    if (!this.renderValidator(result.content.dataBase64)) {
      this.fail(new VGSShowError("invalidPDFData"));
      return;
    }

    this.documentDataBase64 = result.content.dataBase64;
    this.stateMachine.reveal(result.content);
    this.props.onDocumentChange?.();
    VGSAnalyticsClient.shared.trackContentRendering({
      field: "pdf",
      status: "success"
    });
    this.onStateChange();
  }

  public clear(): void {
    this.documentDataBase64 = null;
    this.stateMachine.clear();
    this.onStateChange();
  }

  public renderElement(): unknown {
    const snapshot = this.snapshot;
    const style = this.rendererStyle(snapshot.pdfBackgroundColor);
    const rendererProps = {
      accessibilityLabel: snapshot.hasDocument ? "VGSShowPdf" : undefined,
      displayMode: snapshot.displayMode,
      displayDirection: snapshot.displayDirection,
      autoScales: snapshot.autoScales,
      displayAsBook: snapshot.displayAsBook,
      pageShadowsEnabled: snapshot.pageShadowsEnabled,
      pdfBackgroundColor: snapshot.pdfBackgroundColor,
      hasDocument: snapshot.hasDocument,
      style
    };

    if (this.documentDataBase64 === null) {
      return React.createElement(View, rendererProps);
    }

    return React.createElement(Pdf, {
      source: {
        uri: `data:application/pdf;base64,${this.documentDataBase64}`
      },
      horizontal: snapshot.displayDirection === "horizontal",
      singlePage: snapshot.displayMode === "singlePage",
      enablePaging: snapshot.displayMode === "singlePage" || snapshot.displayMode === "twoUp",
      fitPolicy: snapshot.autoScales ? 2 : 0,
      onError: () => {
        this.handleRendererError();
      },
      style,
      trustAllCerts: false
    });
  }

  private rendererStyle(pdfBackgroundColor: string | null): StyleProp<ViewStyle> {
    if (pdfBackgroundColor === null) {
      return this.props.style;
    }

    return [{ backgroundColor: pdfBackgroundColor }, this.props.style];
  }

  private handleRendererError(): void {
    if (!this.mounted || this.documentDataBase64 === null) {
      return;
    }

    this.fail(new VGSShowError("invalidPDFData"));
  }

  private fail(error: VGSShowError): void {
    this.documentDataBase64 = null;
    this.stateMachine.fail(error);
    this.props.onDocumentError?.(error);
    VGSAnalyticsClient.shared.trackContentRendering({
      field: "pdf",
      status: "failed"
    });
    this.onStateChange();
  }
}

export function __unstable__createVGSShowPdfControllerForTesting(
  options: VGSShowPdfControllerOptions
): VGSShowPdfController {
  return new VGSShowPdfController(options);
}

/**
 * Reveals and renders a base64 PDF field from a `VGSShow.request()` response
 * through the `react-native-pdf` native renderer.
 */
export const VGSShowPdf = React.forwardRef<VGSShowPdfRef, VGSShowPdfProps>(
  (props, ref) => {
    const [, setVersion] = React.useState(0);
    const controllerRef = React.useRef<VGSShowPdfController | null>(null);

    if (controllerRef.current === null) {
      controllerRef.current = new VGSShowPdfController({
        ...props,
        autoMount: false,
        onDocumentChange: () => {
          props.onDocumentChange?.();
        },
        onDocumentError: (error) => {
          props.onDocumentError?.(error);
        },
        onStateChange: () => {
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
        onDocumentChange: () => {
          props.onDocumentChange?.();
        },
        onDocumentError: (error) => {
          props.onDocumentError?.(error);
        }
      });
    });

    React.useImperativeHandle(ref, () => {
      if (controllerRef.current === null) {
        throw new Error("VGSShowPdf controller is not initialized");
      }

      return controllerRef.current.ref;
    });

    return controllerRef.current.renderElement();
  }
);
