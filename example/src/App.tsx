import {
  DefaultTheme,
  NavigationContainer
} from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import * as Clipboard from "expo-clipboard";
import { StatusBar } from "expo-status-bar";
import * as React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  DEMO_DEFAULT_VAULT_ID,
  REVEAL_CARD_DEMO_TITLE,
  RevealCardDemoScreen,
  buildSession,
  type CardRevealPayload,
  type DemoSession
} from "./useCases/revealCardDemo";
import {
  SHOW_IMAGE_DEMO_TITLE,
  ShowImageDemoScreen
} from "./useCases/showImageDemo";
import {
  SHOW_PDF_DEMO_TITLE,
  ShowPdfDemoScreen
} from "./useCases/showPdfDemo";

const NAVIGATION_THEME = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#f3ede2",
    card: "#fffaf2",
    text: "#18212f",
    border: "#dccfb8",
    primary: "#9c5a1c"
  }
};

type RootStackParamList = {
  DemoList: undefined;
  RevealCardDemo: undefined;
  ShowImageDemo: undefined;
  ShowPdfDemo: undefined;
};

type DemoEntry = {
  readonly description: string;
  readonly onPress: () => void;
  readonly title: string;
};

type RuntimeNavigatorClipboard = {
  writeText(text: string): void | Promise<void>;
};

type RuntimeNavigator = {
  clipboard?: RuntimeNavigatorClipboard;
};

const RootStack = createStackNavigator<RootStackParamList>();

function demoEntryTestId(title: string): string {
  return `demo-entry-${title.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "")}`;
}

function installClipboardBridge(): void {
  const runtime = globalThis as {
    navigator?: RuntimeNavigator;
  };
  const nextNavigator = runtime.navigator ?? {};
  // The SDK writes through navigator.clipboard. Expo apps can bridge that API
  // without exposing copied values to React callbacks.
  nextNavigator.clipboard = {
    writeText(text: string) {
      void Clipboard.setStringAsync(text);
    }
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: nextNavigator
  });
}

function DemoListScreen(props: {
  readonly entries: readonly DemoEntry[];
}): React.ReactElement {
  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.screenContent}>
        {props.entries.map((entry) => (
          <Pressable
            accessibilityRole="button"
            key={entry.title}
            onPress={entry.onPress}
            style={({ pressed }) => [
              styles.demoCard,
              pressed ? styles.pressedDemoCard : null
            ]}
            testID={demoEntryTestId(entry.title)}
          >
            <Text style={styles.demoCardText}>{entry.title}</Text>
            <Text style={styles.demoCardDescription}>{entry.description}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function VaultIdModal(props: {
  readonly draftVaultId: string;
  readonly errorMessage: string | null;
  readonly isVisible: boolean;
  readonly onChangeDraftVaultId: (value: string) => void;
  readonly onClose: () => void;
  readonly onSave: () => void;
}): React.ReactElement {
  return (
    <Modal
      animationType="fade"
      onRequestClose={props.onClose}
      transparent
      visible={props.isVisible}
    >
      <View style={styles.modalBackdrop}>
        <Pressable
          accessibilityLabel="Close vault ID editor"
          onPress={props.onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Set Vault ID</Text>
          <Text style={styles.fieldLabel}>Vault ID</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={props.onChangeDraftVaultId}
            placeholder={DEMO_DEFAULT_VAULT_ID}
            placeholderTextColor="#8d8577"
            style={styles.textInput}
            testID="vault-id-input"
            value={props.draftVaultId}
          />
          {props.errorMessage === null ? null : (
            <Text style={styles.errorText}>{props.errorMessage}</Text>
          )}
          <View style={styles.buttonRow}>
            <SecondaryButton
              label="Cancel"
              onPress={props.onClose}
              testID="vault-id-cancel-button"
            />
            <SecondaryButton
              label="Save"
              onPress={props.onSave}
              testID="vault-id-save-button"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SecondaryButton(props: {
  readonly label: string;
  readonly onPress: () => void;
  readonly testID?: string;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed ? styles.pressedSecondaryButton : null
      ]}
      testID={props.testID}
    >
      <Text style={styles.secondaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

function HeaderLinkButton(props: {
  readonly label: string;
  readonly onPress: () => void;
  readonly testID?: string;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={styles.headerButton}
      testID={props.testID}
    >
      <Text style={styles.headerButtonText}>{props.label}</Text>
    </Pressable>
  );
}

export default function App(): React.ReactElement {
  // Keep one shared demo session so Collect can hand aliases directly to Show.
  // Rebuilding the session on vault changes also resets subscribed reveal state.
  const [session, setSession] = React.useState<DemoSession>(() =>
    buildSession(DEMO_DEFAULT_VAULT_ID)
  );
  const [draftVaultId, setDraftVaultId] = React.useState(DEMO_DEFAULT_VAULT_ID);
  const [isVaultIdModalVisible, setIsVaultIdModalVisible] = React.useState(false);
  const [vaultIdErrorMessage, setVaultIdErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    installClipboardBridge();
  }, []);

  function handleStoreRevealPayload(payload: CardRevealPayload): void {
    setSession((current) => ({
      ...current,
      revealPayload: payload
    }));
  }

  function handleOpenVaultIdModal(): void {
    setDraftVaultId(session.vaultId);
    setVaultIdErrorMessage(null);
    setIsVaultIdModalVisible(true);
  }

  function handleCloseVaultIdModal(): void {
    setVaultIdErrorMessage(null);
    setDraftVaultId(session.vaultId);
    setIsVaultIdModalVisible(false);
  }

  function handleSaveVaultId(): void {
    const trimmedVaultId = draftVaultId.trim();
    if (trimmedVaultId.length === 0) {
      setVaultIdErrorMessage("vaultId cannot be empty.");
      return;
    }

    if (trimmedVaultId !== session.vaultId) {
      setSession(buildSession(trimmedVaultId));
    }

    setDraftVaultId(trimmedVaultId);
    setVaultIdErrorMessage(null);
    setIsVaultIdModalVisible(false);
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <NavigationContainer theme={NAVIGATION_THEME}>
          <RootStack.Navigator
            initialRouteName="DemoList"
            screenOptions={{
              headerStyle: {
                backgroundColor: "#fffaf2"
              },
              headerRight: () => (
                <HeaderLinkButton
                  label="Vault ID"
                  onPress={handleOpenVaultIdModal}
                  testID="vault-id-open-button"
                />
              ),
              headerTintColor: "#18212f",
              headerTitleStyle: {
                fontWeight: "700"
              }
            }}
          >
            <RootStack.Screen name="DemoList" options={{ title: "Demos" }}>
              {({ navigation }) => {
                const entries: readonly DemoEntry[] = [
                  {
                    title: REVEAL_CARD_DEMO_TITLE,
                    description: "Collect card data, create aliases, then reveal text fields.",
                    onPress: () => {
                      // Each demo stays isolated in its own route to keep the example app easy to scan.
                      navigation.navigate("RevealCardDemo");
                    }
                  },
                  {
                    title: SHOW_IMAGE_DEMO_TITLE,
                    description: "Reveal base64 image content from a developer-supplied alias.",
                    onPress: () => {
                      navigation.navigate("ShowImageDemo");
                    }
                  },
                  {
                    title: SHOW_PDF_DEMO_TITLE,
                    description: "Reveal PDF content from a developer-supplied alias.",
                    onPress: () => {
                      navigation.navigate("ShowPdfDemo");
                    }
                  }
                ];

                return (
                  <DemoListScreen
                    entries={entries}
                  />
                );
              }}
            </RootStack.Screen>
            <RootStack.Screen
              name="RevealCardDemo"
              options={{ title: REVEAL_CARD_DEMO_TITLE }}
            >
              {() => (
                <RevealCardDemoScreen
                  onStoreRevealPayload={handleStoreRevealPayload}
                  session={session}
                />
              )}
            </RootStack.Screen>
            <RootStack.Screen
              name="ShowImageDemo"
              options={{ title: SHOW_IMAGE_DEMO_TITLE }}
            >
              {() => <ShowImageDemoScreen vgsShow={session.show} />}
            </RootStack.Screen>
            <RootStack.Screen
              name="ShowPdfDemo"
              options={{ title: SHOW_PDF_DEMO_TITLE }}
            >
              {() => <ShowPdfDemoScreen vgsShow={session.show} />}
            </RootStack.Screen>
          </RootStack.Navigator>
        </NavigationContainer>
        <VaultIdModal
          draftVaultId={draftVaultId}
          errorMessage={vaultIdErrorMessage}
          isVisible={isVaultIdModalVisible}
          onChangeDraftVaultId={setDraftVaultId}
          onClose={handleCloseVaultIdModal}
          onSave={handleSaveVaultId}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#f3ede2"
  },
  screenContent: {
    gap: 18,
    padding: 20
  },
  demoCard: {
    backgroundColor: "#fffaf2",
    borderColor: "#dccfb8",
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowColor: "#6e6457",
    shadowOffset: {
      width: 0,
      height: 6
    },
    shadowOpacity: 0.08,
    shadowRadius: 18
  },
  pressedDemoCard: {
    opacity: 0.88
  },
  demoCardText: {
    color: "#18212f",
    fontSize: 22,
    fontWeight: "700"
  },
  demoCardDescription: {
    color: "#5f6673",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(24, 33, 47, 0.38)",
    flex: 1,
    justifyContent: "center",
    padding: 20
  },
  modalCard: {
    backgroundColor: "#fffaf2",
    borderColor: "#dccfb8",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    maxWidth: 460,
    padding: 20,
    width: "100%"
  },
  modalTitle: {
    color: "#18212f",
    fontSize: 22,
    fontWeight: "700"
  },
  fieldLabel: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  textInput: {
    backgroundColor: "#f6efe2",
    borderColor: "#d5c5aa",
    borderRadius: 16,
    borderWidth: 1,
    color: "#18212f",
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  errorText: {
    color: "#b42318",
    fontSize: 14,
    lineHeight: 20
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#f6efe2",
    borderColor: "#ccb995",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 14
  },
  secondaryButtonText: {
    color: "#4b5563",
    fontSize: 14,
    fontWeight: "700"
  },
  pressedSecondaryButton: {
    backgroundColor: "#ebe1d0"
  },
  headerButton: {
    marginRight: 12,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  headerButtonText: {
    color: "#9c5a1c",
    fontSize: 14,
    fontWeight: "700"
  }
});
