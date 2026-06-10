import { loadSdkBehaviorCases } from "./helpers/sdkBehaviorCases.mjs";
import { executeSdkBehaviorCase } from "./helpers/sdkBehaviorRunner.mjs";

const cases = loadSdkBehaviorCases("core");

/**
 * Covers VGSShow subscription, request, headers, and lifecycle behavior.
 * Each case description states the SDK behavior being protected.
 */
describe("core orchestration behavior", () => {
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
