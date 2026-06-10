import * as React from "react";
import {
  ScrollView,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  VGSShowError,
  VGSShowLabel,
  type VGSShowLabelRef
} from "@vgs/show-react-native";
import {
  ActionButton,
  CARD_FORMATTER,
  CARD_SECURE_RANGES,
  DEMO_PATH,
  FieldShell,
  SecondaryButton,
  describeShowError,
  styles,
  type DemoSession
} from "./shared";

export function ShowCardPage(props: {
  readonly session: DemoSession;
}): React.ReactElement {
  const holderLabelRef = React.useRef<VGSShowLabelRef | null>(null);
  const numberLabelRef = React.useRef<VGSShowLabelRef | null>(null);
  const expLabelRef = React.useRef<VGSShowLabelRef | null>(null);
  const [status, setStatus] = React.useState(
    "Reveal waits for aliases from the Collect tab."
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasRevealedContent, setHasRevealedContent] = React.useState(false);

  React.useEffect(() => {
    const numberLabel = numberLabelRef.current;
    if (numberLabel === null) {
      return;
    }

    // Apply display-only formatting and masking after the label ref is ready.
    // Apply the formatter and mask through the label ref.
    numberLabel.resetAllFormatters();
    numberLabel.addTransformationRegex(CARD_FORMATTER);
    numberLabel.setSecureText(CARD_SECURE_RANGES);
  }, []);

  async function handleReveal(): Promise<void> {
    if (props.session.revealPayload === null) {
      setErrorMessage("Collect aliases first. The reveal payload is empty for this session.");
      setStatus("Reveal blocked.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setStatus("Revealing card data...");

    try {
      // Send aliases produced by Collect to the demo reveal route.
      await props.session.show.request({
        path: DEMO_PATH,
        payload: props.session.revealPayload
      });
      setStatus("Reveal completed.");
    } catch (error) {
      setErrorMessage(describeShowError(error));
      setStatus("Reveal failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear(): void {
    holderLabelRef.current?.clearText();
    numberLabelRef.current?.clearText();
    expLabelRef.current?.clearText();
    setHasRevealedContent(false);
    setErrorMessage(null);
    setStatus("Cleared the current reveal view state.");
  }

  function handleCopy(format: "raw" | "transformed"): void {
    numberLabelRef.current?.copyToClipboard({ format });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.screenContent}>
        <View style={styles.sectionCard}>
          <Text style={styles.fieldLabel}>Card Holder</Text>
          <FieldShell testID="show-card-holder-field">
            <VGSShowLabel
              // contentPath must match the reveal response field for this label.
              contentPath="json.payment_card_holder_name"
              onRevealError={(error: VGSShowError) => {
                setErrorMessage(`${error.code}: ${error.message}`);
              }}
              onTextChange={() => {
                setHasRevealedContent(true);
              }}
              placeholder="XXXXXXXXXXXXXXXXXXX"
              placeholderStyle={styles.placeholderText}
              ref={holderLabelRef}
              vgsShow={props.session.show}
            />
          </FieldShell>

          <Text style={styles.fieldLabel}>Card Number</Text>
          <FieldShell testID="show-card-number-field">
            <VGSShowLabel
              // This label renders formatted/masked text, while copy actions stay ref-driven.
              contentPath="json.payment_card_number"
              onCopyTextFinish={(format: "raw" | "transformed") => {
                setStatus(
                  format === "raw"
                    ? "Copied the raw card number to the clipboard."
                    : "Copied the transformed card number to the clipboard."
                );
              }}
              onRevealError={(error: VGSShowError) => {
                setErrorMessage(`${error.code}: ${error.message}`);
              }}
              onTextChange={() => {
                setHasRevealedContent(true);
              }}
              placeholder="XXXX XXXX XXXX XXXX"
              placeholderStyle={styles.placeholderText}
              ref={numberLabelRef}
              vgsShow={props.session.show}
            />
          </FieldShell>

          <Text style={styles.fieldLabel}>Expiration Date</Text>
          <FieldShell testID="show-card-expiration-field">
            <VGSShowLabel
              // Use the same contentPath key returned by the demo route.
              contentPath="json.payment_card_expiration_date"
              onRevealError={(error: VGSShowError) => {
                setErrorMessage(`${error.code}: ${error.message}`);
              }}
              onTextChange={() => {
                setHasRevealedContent(true);
              }}
              placeholder="XX/XX"
              placeholderStyle={styles.placeholderText}
              ref={expLabelRef}
              vgsShow={props.session.show}
            />
          </FieldShell>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Reveal request</Text>
          <Text style={styles.supportText}>
            This page keeps the reveal request isolated so users can focus on how
            `VGSShow` fields subscribe and update.
          </Text>
          <View style={styles.buttonRow}>
            <ActionButton
              busy={isLoading}
              disabled={isLoading}
              label={isLoading ? "Revealing..." : "Reveal"}
              onPress={() => {
                void handleReveal();
              }}
              testID="show-reveal-button"
            />
            <SecondaryButton
              disabled={!hasRevealedContent}
              label="Clear"
              onPress={handleClear}
              testID="show-clear-button"
            />
          </View>
          <View style={styles.buttonRow}>
            <SecondaryButton
              disabled={!hasRevealedContent}
              label="Copy Display"
              onPress={() => {
                handleCopy("transformed");
              }}
              testID="show-copy-display-button"
            />
            <SecondaryButton
              disabled={!hasRevealedContent}
              label="Copy Raw"
              onPress={() => {
                handleCopy("raw");
              }}
              testID="show-copy-raw-button"
            />
          </View>
          <Text style={styles.statusText} testID="show-status-text">{status}</Text>
          {errorMessage === null ? null : (
            <Text style={styles.errorText} testID="show-error-text">{errorMessage}</Text>
          )}
          {props.session.revealPayload === null ? null : (
            <View style={styles.resultBlock} testID="show-aliases-block">
              <Text style={styles.resultTitle}>Aliases</Text>
              <Text style={styles.contractCopy}>
                payment_card_holder_name: {props.session.revealPayload.payment_card_holder_name}
              </Text>
              <Text style={styles.contractCopy}>
                payment_card_number: {props.session.revealPayload.payment_card_number}
              </Text>
              <Text style={styles.contractCopy}>
                payment_card_expiration_date: {props.session.revealPayload.payment_card_expiration_date}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
