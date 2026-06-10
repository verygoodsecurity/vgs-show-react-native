import { Platform } from "react-native";
import { VGS_SHOW_UNSUPPORTED_PLATFORM_MESSAGE } from "./platformMessages.js";

export const VGS_SHOW_SUPPORTED_PLATFORMS = ["ios", "android"] as const;

export type VGSShowSupportedPlatform = (typeof VGS_SHOW_SUPPORTED_PLATFORMS)[number];

export { VGS_SHOW_UNSUPPORTED_PLATFORM_MESSAGE };

export function isSupportedNativePlatform(
  platformOS: string | undefined
): platformOS is VGSShowSupportedPlatform {
  return platformOS === "ios" || platformOS === "android";
}

export function assertSupportedNativePlatform(platformOS: string | undefined = Platform.OS): void {
  if (!isSupportedNativePlatform(platformOS)) {
    throw new Error(VGS_SHOW_UNSUPPORTED_PLATFORM_MESSAGE);
  }
}
