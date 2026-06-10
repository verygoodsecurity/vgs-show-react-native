import { assertSupportedNativePlatform } from "./platformSupport.js";

assertSupportedNativePlatform();

export {
  DEFAULT_VAULT_HOST,
  VGSShow,
  type VGSShowEnvironment,
  type VGSShowOptions
} from "./core/VGSShow.js";
export {
  VGS_SHOW_ERROR_DOMAIN,
  VGSErrorCatalog,
  VGSShowError,
  codeForType,
  errorKeyForType,
  messageForType,
  type SerializedVGSShowError,
  type VGSErrorCatalogEntry,
  type VGSErrorTypeKey,
  type VGSShowErrorOptions
} from "./core/errors.js";
export {
  VGSLogger,
  type VGSLogEntry,
  type VGSLogLevel,
  type VGSLoggingConfiguration
} from "./core/analytics.js";
export type {
  VGSShowTextCopyFormat,
  VGSTextRange,
  VGSTransformationRegex
} from "./core/textPipeline.js";
export type {
  VGSHTTPMethod,
  VGSShowRequestInput,
  VGSShowRequestOptions,
  VGSShowRequestSuccess
} from "./core/network.js";
export {
  VGSShowLabel,
  type VGSShowLabelProps,
  type VGSShowLabelRef,
  type VGSShowPlaceholderStyle
} from "./components/VGSShowLabel.js";
export {
  VGSShowImage,
  type VGSShowImageContentMode,
  type VGSShowImageProps,
  type VGSShowImageRef
} from "./components/VGSShowImage.js";
export {
  VGSShowPdf,
  type VGSShowPdfDisplayDirection,
  type VGSShowPdfDisplayMode,
  type VGSShowPdfProps,
  type VGSShowPdfRef
} from "./components/VGSShowPdf.js";
