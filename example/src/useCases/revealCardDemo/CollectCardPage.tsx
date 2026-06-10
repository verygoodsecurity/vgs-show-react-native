import {
  CardExpDateRule,
  VGSCardInput,
  VGSTextInput,
  type VGSTextInputState
} from "@vgs/collect-react-native";
import * as React from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActionButton,
  COLLECT_EXTRA_DATA,
  DEMO_PATH,
  describeCollectError,
  fieldStatusText,
  mapCollectResponseToRevealPayload,
  styles,
  type CardRevealPayload,
  type DemoSession
} from "./shared";

type CollectFieldStateMap = Record<string, VGSTextInputState | null>;

export function CollectCardPage(props: {
  readonly session: DemoSession;
  readonly onStoreRevealPayload: (payload: CardRevealPayload) => void;
}): React.ReactElement {
  const [fieldStates, setFieldStates] = React.useState<CollectFieldStateMap>({
    card_holder_name: null,
    card_number: null,
    card_expirationDate: null
  });
  const [status, setStatus] = React.useState(
    "Enter demo card details, then create aliases."
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const allFieldsReady = Object.values(fieldStates).every(
    (state) => state !== null && state.isValid && !state.isEmpty
  );

  function updateFieldState(fieldName: string, nextState: VGSTextInputState): void {
    setFieldStates((current) => ({
      ...current,
      [fieldName]: nextState
    }));
  }

  async function handleCollect(): Promise<void> {
    setIsSubmitting(true);
    setStatus("Collecting secure aliases...");
    setErrorMessage(null);

    try {
      // Collect returns aliases for the Show request. Keep raw input values inside Collect fields.
      const result = await props.session.collector.submit(
        DEMO_PATH,
        "POST",
        COLLECT_EXTRA_DATA
      );
      const revealPayload = await mapCollectResponseToRevealPayload(result.response);
      props.onStoreRevealPayload(revealPayload);
      setStatus("Aliases created. Open the Show tab to reveal them.");
    } catch (error) {
      setErrorMessage(describeCollectError(error));
      setStatus("Collect failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.screenContent}
          // Keep the submit button actionable while the last field is still focused.
          keyboardShouldPersistTaps="always"
        >
          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>Card Holder</Text>
            <VGSTextInput
              // fieldName must match the vault route contract that returns aliases.
              accessibilityHint="Secure card holder field"
              accessibilityLabel="Card holder name"
              collector={props.session.collector}
              containerStyle={styles.collectInputContainer}
              fieldName="card_holder_name"
              onStateChange={(state: VGSTextInputState) => {
                updateFieldState("card_holder_name", state);
              }}
              placeholder="Joe Business"
              placeholderTextColor="#7a7063"
              testID="collect-card-holder-input"
              textStyle={styles.collectInputText}
              type="cardHolderName"
            />
            <Text style={styles.supportText}>
              {fieldStatusText(fieldStates.card_holder_name)}
            </Text>

            <Text style={styles.fieldLabel}>Card Number</Text>
            <VGSCardInput
              // Card input owns raw PAN entry; app state only receives validation metadata.
              accessibilityHint="Secure card number field"
              accessibilityLabel="Card number"
              collector={props.session.collector}
              containerStyle={styles.collectInputContainer}
              fieldName="card_number"
              iconPosition="right"
              onStateChange={(state: VGSTextInputState) => {
                updateFieldState("card_number", state);
              }}
              placeholder="4111 1111 1111 1111"
              placeholderTextColor="#7a7063"
              testID="collect-card-number-input"
              textStyle={styles.collectInputText}
            />
            <Text style={styles.supportText}>
              {fieldStatusText(fieldStates.card_number)}
            </Text>

            <Text style={styles.fieldLabel}>Expiration Date</Text>
            <VGSTextInput
              // This field produces an expiration-date alias consumed by the Show tab.
              accessibilityHint="Secure card expiration date field"
              accessibilityLabel="Card expiration date"
              collector={props.session.collector}
              containerStyle={styles.collectInputContainer}
              divider="/"
              fieldName="card_expirationDate"
              keyboardType="numeric"
              mask="##/####"
              onStateChange={(state: VGSTextInputState) => {
                updateFieldState("card_expirationDate", state);
              }}
              placeholder="MM/YYYY"
              placeholderTextColor="#7a7063"
              testID="collect-card-expiration-input"
              textStyle={styles.collectInputText}
              type="expDate"
              validationRules={[
                new CardExpDateRule(
                  "mmyyyy",
                  "Use a future expiration date in MM/YYYY format."
                )
              ]}
            />
            <Text style={styles.supportText}>
              {fieldStatusText(fieldStates.card_expirationDate)}
            </Text>
            <Pressable
              accessibilityLabel="Dismiss the keyboard"
              onPress={() => {
                Keyboard.dismiss();
              }}
              style={styles.keyboardDismissTarget}
              testID="collect-dismiss-keyboard-target"
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Collect request</Text>
            <Text style={styles.supportText}>
              The Collect page generates aliases only. The Show page later uses those
              aliases to request revealed values.
            </Text>
            <ActionButton
              busy={isSubmitting}
              disabled={isSubmitting || !allFieldsReady}
              label={isSubmitting ? "Collecting..." : "Create Aliases"}
              onPress={() => {
                void handleCollect();
              }}
              testID="collect-create-aliases-button"
            />
            <Text style={styles.statusText} testID="collect-status-text">{status}</Text>
            {errorMessage === null ? null : (
              <Text style={styles.errorText} testID="collect-error-text">{errorMessage}</Text>
            )}
            {props.session.revealPayload === null ? null : (
              <View style={styles.resultBlock} testID="collect-aliases-block">
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
