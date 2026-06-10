import * as React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

export function FieldShell(props: {
  readonly children: React.ReactNode;
  readonly testID?: string;
}): React.ReactElement {
  return (
    <View accessible={false} style={styles.fieldShell} testID={props.testID}>
      {props.children}
    </View>
  );
}

export function ActionButton(props: {
  readonly busy?: boolean;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly testID?: string;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        props.disabled ? styles.disabledButton : null,
        pressed && !props.disabled ? styles.pressedButton : null
      ]}
      testID={props.testID}
    >
      {props.busy ? (
        <ActivityIndicator color="#fffaf2" />
      ) : (
        <Text style={styles.primaryButtonText}>{props.label}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton(props: {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly testID?: string;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        props.disabled ? styles.disabledSecondaryButton : null,
        pressed && !props.disabled ? styles.pressedSecondaryButton : null
      ]}
      testID={props.testID}
    >
      <Text style={styles.secondaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
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
  sectionCard: {
    backgroundColor: "#fffaf2",
    borderColor: "#dccfb8",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 20,
    shadowColor: "#6e6457",
    shadowOffset: {
      width: 0,
      height: 6
    },
    shadowOpacity: 0.08,
    shadowRadius: 18
  },
  sectionTitle: {
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
  collectInputContainer: {
    backgroundColor: "#f6efe2",
    borderColor: "#d5c5aa",
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 54,
    paddingHorizontal: 12
  },
  collectInputText: {
    color: "#18212f",
    fontSize: 16
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
  fieldShell: {
    backgroundColor: "#f6efe2",
    borderColor: "#d5c5aa",
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 58,
    paddingHorizontal: 16
  },
  mediaFrame: {
    alignItems: "center",
    backgroundColor: "#f6efe2",
    borderColor: "#d5c5aa",
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 220,
    overflow: "hidden",
    padding: 16
  },
  revealedImage: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  revealedPdf: {
    alignSelf: "stretch",
    height: 360,
    marginTop: 12
  },
  placeholderText: {
    color: "#8d8577"
  },
  supportText: {
    color: "#5f6673",
    fontSize: 13,
    lineHeight: 18
  },
  keyboardDismissTarget: {
    minHeight: 20
  },
  contractCopy: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 19
  },
  resultBlock: {
    borderTopColor: "#e6dccb",
    borderTopWidth: 1,
    gap: 6,
    marginTop: 4,
    paddingTop: 12
  },
  resultTitle: {
    color: "#18212f",
    fontSize: 14,
    fontWeight: "700"
  },
  statusText: {
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 20
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
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#9c5a1c",
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 18
  },
  primaryButtonText: {
    color: "#fffaf2",
    fontSize: 15,
    fontWeight: "700"
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
  disabledButton: {
    backgroundColor: "#bea788"
  },
  disabledSecondaryButton: {
    opacity: 0.55
  },
  pressedButton: {
    opacity: 0.88
  },
  pressedSecondaryButton: {
    backgroundColor: "#ebe1d0"
  }
});
