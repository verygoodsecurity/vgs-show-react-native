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
  VGSShowImage,
  type VGSShowImageRef
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

export const SHOW_IMAGE_DEMO_TITLE = "Reveal Image";

// Update this default in code when you want the example to open with a known alias.
export const DEMO_DEFAULT_IMAGE_ALIAS = "image-alias";

// Payload field and contentPath are the integration contract with the vault route.
const IMAGE_ALIAS_PAYLOAD_FIELD = "secure_image";
const IMAGE_CONTENT_PATH = "json.secure_image";

export function ShowImageDemoScreen(props: {
  readonly vgsShow: VGSShow;
}): React.ReactElement {
  const imageRef = React.useRef<VGSShowImageRef | null>(null);
  const [draftAlias, setDraftAlias] = React.useState(DEMO_DEFAULT_IMAGE_ALIAS);
  const [status, setStatus] = React.useState(
    "Set an alias below, then reveal the image."
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasImage, setHasImage] = React.useState(false);

  async function handleReveal(): Promise<void> {
    const trimmedAlias = draftAlias.trim();
    if (trimmedAlias.length === 0) {
      setErrorMessage("Alias cannot be empty.");
      setStatus("Reveal blocked.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setHasImage(false);
    setStatus("Revealing image...");

    try {
      // Send the alias field expected by the demo vault route.
      const result = await props.vgsShow.request({
        path: DEMO_PATH,
        payload: {
          [IMAGE_ALIAS_PAYLOAD_FIELD]: trimmedAlias
        }
      });
      setStatus(
        imageRef.current?.hasImage === true
          ? `Reveal completed with HTTP ${result.code}.`
          : "Reveal completed, but no renderable image content was returned."
      );
    } catch (error) {
      setErrorMessage(describeShowError(error));
      setStatus("Reveal failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear(): void {
    imageRef.current?.clear();
    setHasImage(false);
    setErrorMessage(null);
    setStatus("Cleared the current image view state.");
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.screenContent}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Alias configuration</Text>
          <Text style={styles.supportText}>
            This demo skips Collect. Use the default alias from code or replace it
            here before sending the reveal request.
          </Text>
          <Text style={styles.fieldLabel}>Image Alias</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setDraftAlias}
            placeholder={DEMO_DEFAULT_IMAGE_ALIAS}
            placeholderTextColor="#8d8577"
            style={styles.textInput}
            value={draftAlias}
          />
          <View style={styles.resultBlock}>
            <Text style={styles.resultTitle}>Demo contract</Text>
            <Text style={styles.contractCopy}>
              request payload: {IMAGE_ALIAS_PAYLOAD_FIELD}: current alias
            </Text>
            <Text style={styles.contractCopy}>
              reveal contentPath: {IMAGE_CONTENT_PATH}
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Image reveal</Text>
          <View style={styles.mediaFrame}>
            {!hasImage ? (
              <Text style={styles.placeholderText}>
                Reveal an alias to render image content.
              </Text>
            ) : null}
            <VGSShowImage
              contentMode="scaleAspectFit"
              // Match this path to the base64 image field returned by your route.
              contentPath={IMAGE_CONTENT_PATH}
              onImageChange={() => {
                setHasImage(true);
                setStatus("Image view updated.");
              }}
              onImageError={(error: VGSShowError) => {
                setErrorMessage(`${error.code}: ${error.message}`);
                setHasImage(false);
              }}
              ref={imageRef}
              style={styles.revealedImage}
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
              disabled={!hasImage}
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
