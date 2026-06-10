import * as React from "react";
import {
  Image,
  type ImageStyle,
  type StyleProp
} from "react-native";
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
import {
  imageMimeTypeForBase64,
  type RenderableImageMimeType
} from "./mediaValidation.js";

/**
 * React Native resize behavior used when rendering revealed image content.
 */
export type VGSShowImageContentMode =
  | "scaleToFill"
  | "scaleAspectFit"
  | "scaleAspectFill"
  | "center";

/**
 * Props for `VGSShowImage`, the base64 image reveal component.
 */
export type VGSShowImageProps = {
  /** Shared reveal orchestrator. Use the same instance for fields revealed by one request. */
  readonly vgsShow: VGSShow;
  /** Dot-separated path to the base64 image field in the reveal response. */
  readonly contentPath: string;
  /** Image resize behavior. Defaults to `"scaleAspectFit"`. */
  readonly contentMode?: VGSShowImageContentMode;
  /** React Native style applied to the underlying Image. */
  readonly style?: StyleProp<ImageStyle>;
  /** Called when image state changes. The base64 payload is not passed out. */
  readonly onImageChange?: () => void;
  /** Called when the image field is missing, invalid, or not renderable. */
  readonly onImageError?: (error: VGSShowError) => void;
};

/**
 * Imperative actions and logical state exposed by `VGSShowImage`.
 */
export type VGSShowImageRef = {
  /** True when the component currently holds renderable image content. */
  readonly hasImage: boolean;
  /** Clears the current image from component state. */
  clear(): void;
};

/**
 * Controller snapshot used by tests and rendering.
 */
export type VGSShowImageSnapshot = {
  readonly contentPath: string;
  readonly contentMode: VGSShowImageContentMode;
  readonly state: VGSContentState;
  readonly hasImage: boolean;
  readonly isMounted: boolean;
};

type VGSShowImageControllerOptions = VGSShowImageProps & {
  readonly viewId?: string;
  readonly renderValidator?: (dataBase64: string) => boolean;
  readonly autoMount?: boolean;
  readonly onStateChange?: () => void;
};

const DEFAULT_IMAGE_CONTENT_MODE: VGSShowImageContentMode = "scaleAspectFit";
type VGSShowImageSourceMimeType = RenderableImageMimeType | "image/*";

function warnIfContentPathEmpty(contentPath: string): void {
  if (contentPath.length === 0) {
    VGSLogger.shared.warning("VGSShowImage contentPath is empty.");
  }
}

/**
 * React-independent controller behind `VGSShowImage`.
 */
export class VGSShowImageController {
  private props: VGSShowImageProps;
  private readonly viewId: string | undefined;
  private readonly renderValidator: ((dataBase64: string) => boolean) | undefined;
  private readonly onStateChange: () => void;
  private readonly stateMachine: VGSContentStateMachine = createContentStateMachine("image");
  private readonly subscribableView: VGSShowSubscribableView;
  private imageDataBase64: string | null = null;
  private imageMimeType: VGSShowImageSourceMimeType | null = null;
  private mounted = false;

  public readonly ref: VGSShowImageRef;

  public constructor(options: VGSShowImageControllerOptions) {
    // Contributor guidance: base64 media stays private to this controller.
    // React refs and callbacks should expose logical state only.
    this.props = options;
    this.viewId = options.viewId;
    this.renderValidator = options.renderValidator;
    this.onStateChange = options.onStateChange ?? (() => undefined);

    const controller = this;
    this.ref = {
      get hasImage() {
        return controller.stateMachine.snapshot.hasImage;
      },
      clear() {
        controller.clear();
      }
    };

    this.subscribableView = {
      get viewId() {
        return controller.viewId ?? "image";
      },
      kind: "image",
      get contentPath() {
        return controller.props.contentPath;
      },
      decodingContentMode: "imageBase64",
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

  public get snapshot(): VGSShowImageSnapshot {
    const snapshot = this.stateMachine.snapshot;
    return {
      contentPath: this.props.contentPath,
      contentMode: this.props.contentMode ?? DEFAULT_IMAGE_CONTENT_MODE,
      state: snapshot.state,
      hasImage: snapshot.hasImage,
      isMounted: this.mounted
    };
  }

  public updateProps(nextProps: VGSShowImageProps): void {
    const previousProps = this.props;
    this.props = nextProps;

    warnIfContentPathEmpty(nextProps.contentPath);

    if (previousProps.vgsShow !== nextProps.vgsShow) {
      unsubscribeVGSShowView(previousProps.vgsShow, this.subscribableView);
      this.mount();
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
    this.imageDataBase64 = null;
    this.imageMimeType = null;
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

    const detectedMimeType = imageMimeTypeForBase64(result.content.dataBase64);
    const isRenderable = this.renderValidator?.(result.content.dataBase64) ?? detectedMimeType !== null;

    if (!isRenderable) {
      this.fail(new VGSShowError("invalidImageData"));
      return;
    }

    this.imageDataBase64 = result.content.dataBase64;
    this.imageMimeType = detectedMimeType ?? "image/*";
    this.stateMachine.reveal(result.content);
    this.props.onImageChange?.();
    VGSAnalyticsClient.shared.trackContentRendering({
      field: "image",
      status: "success"
    });
    this.onStateChange();
  }

  public clear(): void {
    this.imageDataBase64 = null;
    this.imageMimeType = null;
    this.stateMachine.clear();
    this.onStateChange();
  }

  public renderElement(): unknown {
    const source =
      this.imageDataBase64 === null
        ? undefined
        : {
            uri: `data:${this.imageMimeType ?? "image/*"};base64,${this.imageDataBase64}`
          };

    return React.createElement(Image, {
      resizeMode: this.snapshot.contentMode,
      source,
      style: this.props.style
    });
  }

  private fail(error: VGSShowError): void {
    this.imageDataBase64 = null;
    this.imageMimeType = null;
    this.stateMachine.fail(error);
    this.props.onImageError?.(error);
    VGSAnalyticsClient.shared.trackContentRendering({
      field: "image",
      status: "failed"
    });
    this.onStateChange();
  }
}

export function __unstable__createVGSShowImageControllerForTesting(
  options: VGSShowImageControllerOptions
): VGSShowImageController {
  return new VGSShowImageController(options);
}

/**
 * Reveals and renders a base64 image field from a `VGSShow.request()` response.
 */
export const VGSShowImage = React.forwardRef<VGSShowImageRef, VGSShowImageProps>(
  (props, ref) => {
    const [, setVersion] = React.useState(0);
    const controllerRef = React.useRef<VGSShowImageController | null>(null);

    if (controllerRef.current === null) {
      controllerRef.current = new VGSShowImageController({
        ...props,
        autoMount: false,
        onImageChange: () => {
          props.onImageChange?.();
        },
        onImageError: (error) => {
          props.onImageError?.(error);
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
        onImageChange: () => {
          props.onImageChange?.();
        },
        onImageError: (error) => {
          props.onImageError?.(error);
        }
      });
    });

    React.useImperativeHandle(ref, () => {
      if (controllerRef.current === null) {
        throw new Error("VGSShowImage controller is not initialized");
      }

      return controllerRef.current.ref;
    });

    return controllerRef.current.renderElement();
  }
);
