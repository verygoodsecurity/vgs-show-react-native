import { loadSdkBehaviorCases } from "./helpers/sdkBehaviorCases.mjs";
import { executeSdkBehaviorCase } from "./helpers/sdkBehaviorRunner.mjs";

const cases = loadSdkBehaviorCases("network");

/**
 * Covers request construction, URL handling, payload encoding, and response mapping.
 * Each case description states the SDK behavior being protected.
 */
describe("network behavior", () => {
  test("has documented behavior cases", () => {
    expect(cases.length).toBeGreaterThan(0);
    expect(cases.every((testCase) => typeof testCase.description === "string" && testCase.description.length > 0)).toBe(true);
  });

  test.each(cases)("$id: $description", (testCase) => {
    const result = executeSdkBehaviorCase(testCase);

    expect(result.errorCode).not.toBe("OPERATION_NOT_IMPLEMENTED");
    expect(result.error).toBeNull();
    expect(result.diff.verdict).toBe("PASS");
  });
});
