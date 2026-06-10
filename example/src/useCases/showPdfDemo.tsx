import * as React from "react";
import {
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  VGSShow,
  VGSShowError,
  VGSShowPdf,
  type VGSShowPdfRef
} from "@vgs/show-react-native";
import {
  ActionButton,
  SecondaryButton,
  styles
} from "./shared/demoUi";
import {
  DEMO_PATH,
  describeShowError
} from "./shared/showDemo";

export const SHOW_PDF_DEMO_TITLE = "Reveal PDF";

// Update this default in code when you want the example to open with a known alias.
export const DEMO_DEFAULT_PDF_ALIAS = "pdf-alias";

// Payload field and contentPath are the integration contract with the vault route.
const PDF_ALIAS_PAYLOAD_FIELD = "pdf_alias";
const PDF_CONTENT_PATH = "json.secure_pdf";

export function ShowPdfDemoScreen(props: {
  readonly vgsShow: VGSShow;
}): React.ReactElement {
  const pdfRef = React.useRef<VGSShowPdfRef | null>(null);
  const [draftAlias, setDraftAlias] = React.useState(DEMO_DEFAULT_PDF_ALIAS);
  const [status, setStatus] = React.useState(
    "Set an alias below, then reveal the PDF."
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasDocument, setHasDocument] = React.useState(false);

  async function handleReveal(): Promise<void> {
    const trimmedAlias = draftAlias.trim();
    if (trimmedAlias.length === 0) {
      setErrorMessage("Alias cannot be empty.");
      setStatus("Reveal blocked.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setStatus("Revealing PDF...");

    try {
      // Send the alias field expected by the demo vault route.
      const result = await props.vgsShow.request({
        path: DEMO_PATH,
        payload: {
          [PDF_ALIAS_PAYLOAD_FIELD]: trimmedAlias
        }
      });
      setStatus(`Reveal completed with HTTP ${result.code}.`);
    } catch (error) {
      setErrorMessage(describeShowError(error));
      setStatus("Reveal failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear(): void {
    pdfRef.current?.clear();
    setHasDocument(false);
    setErrorMessage(null);
    setStatus("Cleared the current PDF view state.");
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.screenContent}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Alias configuration</Text>
          <Text style={styles.supportText}>
            This demo reveals a PDF directly from an alias. Keep the default value
            in code or change it here before revealing.
          </Text>
          <Text style={styles.fieldLabel}>PDF Alias</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setDraftAlias}
            placeholder={DEMO_DEFAULT_PDF_ALIAS}
            placeholderTextColor="#8d8577"
            style={styles.textInput}
            value={draftAlias}
          />
          <View style={styles.resultBlock}>
            <Text style={styles.resultTitle}>Demo contract</Text>
            <Text style={styles.contractCopy}>
              request payload: {PDF_ALIAS_PAYLOAD_FIELD}: current alias
            </Text>
            <Text style={styles.contractCopy}>
              reveal contentPath: {PDF_CONTENT_PATH}
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>PDF reveal</Text>
          <View style={styles.mediaFrame}>
            <Text style={styles.supportText}>
              {hasDocument
                ? "The PDF alias resolved and the document view subscribed successfully."
                : "Reveal an alias to load PDF content into VGSShowPdf."}
            </Text>
            <VGSShowPdf
              // Match this path to the base64 PDF field returned by your route.
              contentPath={PDF_CONTENT_PATH}
              onDocumentChange={() => {
                setHasDocument(true);
                setStatus("PDF view updated.");
              }}
              onDocumentError={(error: VGSShowError) => {
                setErrorMessage(`${error.code}: ${error.message}`);
              }}
              pdfAutoScales={true}
              pdfDisplayDirection="vertical"
              pdfDisplayMode="singlePageContinuous"
              ref={pdfRef}
              style={styles.revealedPdf}
              vgsShow={props.vgsShow}
            />
          </View>
          <View style={styles.buttonRow}>
            <ActionButton
              busy={isLoading}
              disabled={isLoading}
              label={isLoading ? "Revealing..." : "Reveal"}
              onPress={() => {
                void handleReveal();
              }}
            />
            <SecondaryButton
              disabled={!hasDocument}
              label="Clear"
              onPress={handleClear}
            />
          </View>
          <Text style={styles.statusText}>{status}</Text>
          {errorMessage === null ? null : (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
