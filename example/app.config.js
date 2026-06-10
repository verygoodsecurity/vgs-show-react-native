const defaultVaultId = process.env.EXPO_PUBLIC_VAULT_ID ?? "vaultId";
const isLegacyArchitectureEnabled = process.env.EXPO_PUBLIC_LEGACY_ARCH === "1";

export default {
  expo: {
    name: "vgs-show-react-native-example",
    slug: "vgs-show-react-native-example",
    version: "1.0.0",
    extra: {
      defaultVaultId
    },
    newArchEnabled: !isLegacyArchitectureEnabled,
    plugins: ["expo-dev-client", "expo-status-bar"],
    ios: {
      bundleIdentifier: "com.verygoodsecurity.vgsshowreactnative.example"
    },
    android: {
      package: "com.verygoodsecurity.vgsshowreactnative.example"
    }
  }
};
