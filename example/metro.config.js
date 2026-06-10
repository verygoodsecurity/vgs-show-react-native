const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const appNodeModules = path.resolve(projectRoot, "node_modules");
const sdkNodeModules = path.resolve(workspaceRoot, "node_modules");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [appNodeModules, sdkNodeModules];
config.resolver.extraNodeModules = {
  react: path.resolve(appNodeModules, "react"),
  "react/jsx-runtime": path.resolve(appNodeModules, "react/jsx-runtime"),
  "react/jsx-dev-runtime": path.resolve(appNodeModules, "react/jsx-dev-runtime"),
  "react-native": path.resolve(appNodeModules, "react-native")
};

module.exports = config;
