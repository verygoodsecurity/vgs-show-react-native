import {
  VGSCollect,
  VGSError,
  VGSErrorCode,
  type VGSTextInputState
} from "@vgs/collect-react-native";
import { VGSShow } from "@vgs/show-react-native";
import {
  ActionButton,
  FieldShell,
  SecondaryButton,
  styles
} from "../shared/demoUi";
import {
  DEMO_ENVIRONMENT,
  DEMO_PATH,
  describeShowError
} from "../shared/showDemo";

export const DEMO_DEFAULT_VAULT_ID = process.env.EXPO_PUBLIC_VAULT_ID ?? "vaultId";
export const REVEAL_CARD_DEMO_TITLE = "Reveal Card Details";
export const COLLECT_EXTRA_DATA = {
  customKey: "Custom Value"
} as const;
// Display-only formatter used after reveal; it never changes the alias payload sent to VGS.
export const CARD_FORMATTER = {
  pattern: /(\d{4})(\d{4})(\d{4})(\d{4})/u,
  template: "$1 $2 $3 $4"
} as const;
// Mask the middle groups in the transformed card-number display.
export const CARD_SECURE_RANGES = {
  ranges: [
    { start: 5, end: 8 },
    { start: 10, end: 13 }
  ]
} as const;

/**
 * Alias payload returned by Collect and later sent to Show.
 *
 * Replace the demo field names only to match your vault route contract.
 */
export type CardRevealPayload = {
  payment_card_holder_name: string;
  payment_card_number: string;
  payment_card_expiration_date: string;
};

/**
 * Shared state for the card demo flow.
 *
 * One `VGSCollect` instance owns secure data collection and one `VGSShow`
 * instance owns reveal subscriptions. Recreate both when the vault ID changes.
 */
export type DemoSession = {
  vaultId: string;
  collector: VGSCollect;
  show: VGSShow;
  revealPayload: CardRevealPayload | null;
};

/**
 * Creates a clean Collect/Show pair for one vault.
 */
export function buildSession(vaultId: string): DemoSession {
  return {
    vaultId,
    collector: new VGSCollect(vaultId, DEMO_ENVIRONMENT),
    show: new VGSShow({
      id: vaultId,
      environment: DEMO_ENVIRONMENT
    }),
    revealPayload: null
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === "string");
}

export async function mapCollectResponseToRevealPayload(
  response: unknown
): Promise<CardRevealPayload> {
  if (
    response === null ||
    typeof response !== "object" ||
    !("json" in response) ||
    typeof (response as { json?: unknown }).json !== "function"
  ) {
    throw new Error("Collect response did not include a readable JSON body.");
  }

  const responseBody = await (response as { json(): Promise<unknown> }).json();
  if (
    responseBody === null ||
    typeof responseBody !== "object" ||
    !("json" in responseBody) ||
    !isStringRecord((responseBody as { json?: unknown }).json)
  ) {
    throw new Error("Collect response did not include the expected json.* aliases.");
  }

  const aliases = (responseBody as { json: Record<string, string> }).json;
  const cardHolderName = aliases.card_holder_name;
  const cardNumber = aliases.card_number;
  const expDate = aliases.card_expirationDate;

  if (
    typeof cardHolderName !== "string" ||
    typeof cardNumber !== "string" ||
    typeof expDate !== "string"
  ) {
    throw new Error("Collect response was missing one or more required card aliases.");
  }

  return {
    payment_card_holder_name: cardHolderName,
    payment_card_number: cardNumber,
    payment_card_expiration_date: expDate
  };
}

function isCollectErrorWithCode(error: unknown): error is {
  code: number;
  message: string;
} {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "number" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

export function describeCollectError(error: unknown): string {
  if (error instanceof VGSError || isCollectErrorWithCode(error)) {
    switch (error.code) {
      case VGSErrorCode.InputDataIsNotValid:
        return "Card data is not valid yet. Review the highlighted fields and try again.";
      case VGSErrorCode.InvalidVaultConfiguration:
        return "Vault configuration is invalid. Check the current vaultId and route setup.";
      default:
        return `Collect failed with code ${error.code}.`;
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Collect request failed.";
}

export function fieldStatusText(state: VGSTextInputState | null): string {
  if (state === null) {
    return "Waiting for input.";
  }

  if (state.isEmpty) {
    return "Required field is empty.";
  }

  if (state.isValid) {
    return "Ready.";
  }

  if (state.validationErrors.length > 0) {
    return state.validationErrors[0] ?? "Field is not valid yet.";
  }

  return "Field is not valid yet.";
}

export { ActionButton, DEMO_PATH, FieldShell, SecondaryButton, describeShowError, styles };
