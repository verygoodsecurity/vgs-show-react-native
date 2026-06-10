export default {
  testEnvironment: "node",
  moduleNameMapper: {
    "^react-native$": "<rootDir>/tests/mocks/react-native.mjs",
    "^react-native-pdf$": "<rootDir>/tests/mocks/react-native-pdf.mjs"
  },
  testMatch: ["<rootDir>/tests/**/*.test.mjs"],
  transform: {},
  verbose: false
};
