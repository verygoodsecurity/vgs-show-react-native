import { VGSShowError } from "@vgs/show-react-native";

export const DEMO_ENVIRONMENT = "sandbox";
export const DEMO_PATH = "/post";

/**
 * Maps SDK errors to safe UI text for the example app.
 */
export function describeShowError(error: unknown): string {
  if (error instanceof VGSShowError) {
    return `${error.code}: ${error.message}`;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Reveal request failed.";
}
