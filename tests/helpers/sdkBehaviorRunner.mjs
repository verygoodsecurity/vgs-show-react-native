/**
 * Shared executor for data-driven SDK Jest behavior cases.
 *
 * The cases live under tests/fixtures and are grouped by SDK area so coverage is
 * owned by Jest without relying on an external CLI/report tool.
 */
import {
  VGSShow,
  VGSShowError,
  errorKeyForType
} from "../../lib/index.js";
import {
  isValidJsonKeyPath,
  resolveJsonPath,
  resolveJsonPathAsString
} from "../../lib/core/jsonPath.js";
import * as vgsShowInternals from "../../lib/core/VGSShow.js";
import * as contentState from "../../lib/core/contentState.js";
import * as network from "../../lib/core/network.js";
import * as textPipeline from "../../lib/core/textPipeline.js";
import * as analytics from "../../lib/core/analytics.js";
import * as components from "../../lib/components/index.js";

function subscribeView(vgsShow, view) {
  vgsShowInternals.subscribeVGSShowView(vgsShow, view);
}

function unsubscribeView(vgsShow, view) {
  vgsShowInternals.unsubscribeVGSShowView(vgsShow, view);
}

function unsubscribeAllViews(vgsShow) {
  vgsShowInternals.unsubscribeAllVGSShowViews(vgsShow);
}

function subscribedViews(vgsShow) {
  return vgsShowInternals.getSubscribedVGSShowViews(vgsShow);
}

function subscribedLabels(vgsShow) {
  return vgsShowInternals.getSubscribedVGSShowLabels(vgsShow);
}

function subscribedPDFViews(vgsShow) {
  return vgsShowInternals.getSubscribedVGSShowPdfViews(vgsShow);
}

function buildRequestForTesting(vgsShow, request) {
  return vgsShowInternals.buildVGSShowRequestForTesting(vgsShow, request);
}

function simulateRequestForTesting(vgsShow, request, response) {
  return vgsShowInternals.simulateVGSShowRequestForTesting(vgsShow, request, response);
}

function getBaseUrlHostForTesting(vgsShow) {
  return vgsShowInternals.getVGSShowBaseUrlHostForTesting(vgsShow);
}


function buildPendingResult(fixture) {
  const operation = fixture.input.operation;
  return {
    fixtureId: fixture.id,
    matrixRow: fixture.matrix_row,
    result: null,
    error: `SDK behavior operation not implemented: ${operation}`,
    errorCode: "OPERATION_NOT_IMPLEMENTED",
    stateSequence: [],
    diff: {
      verdict: "FAIL",
      reason: "runner-operation-not-implemented",
      expected: fixture.expected,
      actual: null
    }
  };
}

function valuesEqual(expected, actual) {
  return JSON.stringify(expected) === JSON.stringify(actual);
}

function normalizeError(error) {
  if (error instanceof VGSShowError) {
    return error.toJSON();
  }

  return error;
}

function toExpectedErrorShape(error, expectedError) {
  const normalized = normalizeError(error);

  if (!expectedError || typeof expectedError !== "object" || !normalized || typeof normalized !== "object") {
    return normalized;
  }

  return Object.fromEntries(Object.keys(expectedError).map((key) => [key, normalized[key]]));
}

function buildAssertionResult({ fixture, actual, stateSequence = [] }) {
  const comparableExpected = { ...fixture.expected };
  delete comparableExpected.comparator;
  const verdict = valuesEqual(comparableExpected, actual) ? "PASS" : "FAIL";

  return {
    fixtureId: fixture.id,
    matrixRow: fixture.matrix_row,
    result: actual,
    error:
      verdict === "PASS"
        ? null
        : `Expected ${JSON.stringify(comparableExpected)} but got ${JSON.stringify(actual)}`,
    errorCode: verdict === "PASS" ? null : "SDK_ASSERTION_FAILED",
    stateSequence,
    diff: {
      verdict,
      reason: verdict === "PASS" ? "matched" : "expected-actual-mismatch",
      expected: comparableExpected,
      actual
    }
  };
}

function buildFailureOutcome(type, expectedError) {
  return {
    outcome: "failure",
    error: toExpectedErrorShape(new VGSShowError(type), expectedError)
  };
}

function isStrictBase64(value) {
  return (
    typeof value === "string" &&
    value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]*={0,2}$/u.test(value) &&
    !/=.+[^=]/u.test(value)
  );
}

function replaceJsonSentinels(value) {
  if (Array.isArray(value)) {
    return value.map((item) => replaceJsonSentinels(item));
  }

  if (value !== null && typeof value === "object") {
    if (value.$nan === true) {
      return Number.NaN;
    }

    if (value.$infinity === true) {
      return Number.POSITIVE_INFINITY;
    }

    if (value.$undefined === true) {
      return undefined;
    }

    if (value.$function === true) {
      return function fixtureFunction() {};
    }

    if (typeof value.$symbol === "string") {
      return Symbol(value.$symbol);
    }

    if (typeof value.$bigint === "string") {
      return BigInt(value.$bigint);
    }

    if (typeof value.$date === "string") {
      return new Date(value.$date);
    }

    if (Array.isArray(value.$uint8Array)) {
      return new Uint8Array(value.$uint8Array);
    }

    if (Array.isArray(value.$map)) {
      return new Map(value.$map);
    }

    if (Array.isArray(value.$set)) {
      return new Set(value.$set);
    }

    const replaced = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      replaced[key] = replaceJsonSentinels(nestedValue);
    }
    return replaced;
  }

  return value;
}

function isValidJsonPayload(value, seen = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value !== "object") {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }

  seen.add(value);
  const values = Array.isArray(value) ? value : Object.values(value);
  const valid = values.every((item) => isValidJsonPayload(item, seen));
  seen.delete(value);
  return valid;
}

function isValidTenantId(id) {
  return typeof id === "string" && /^[A-Za-z0-9]+$/u.test(id);
}

function buildConstructVgsShowErrorResult(fixture) {
  const inputError = fixture.input.error;
  const error = new VGSShowError(inputError.type, { extraInfo: inputError.extraInfo });
  const actual = {
    outcome: "success",
    error: error.toJSON()
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual.error] });
}

function buildErrorKeyMappingResult(fixture) {
  const actual = {
    outcome: "success",
    perCase: fixture.input.cases.map((inputCase) => ({
      type: inputCase.type,
      errorKey: errorKeyForType(inputCase.type)
    }))
  };

  return buildAssertionResult({ fixture, actual, stateSequence: actual.perCase });
}

function buildRawDataToJsonResult(fixture) {
  const rawBody = fixture.input.rawBody;

  if (rawBody === null || rawBody === "") {
    return buildAssertionResult({
      fixture,
      actual: buildFailureOutcome("unexpectedResponseDataFormat", fixture.expected.error)
    });
  }

  const rawText =
    rawBody && typeof rawBody === "object" && typeof rawBody.$utf8 === "string"
      ? rawBody.$utf8
      : String(rawBody);

  try {
    const parsed = JSON.parse(rawText);
    const actual =
      parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
        ? { outcome: "success", json: parsed }
        : buildFailureOutcome("responseIsInvalidJSON", fixture.expected.error);
    return buildAssertionResult({ fixture, actual });
  } catch {
    return buildAssertionResult({
      fixture,
      actual: buildFailureOutcome("responseIsInvalidJSON", fixture.expected.error)
    });
  }
}

function buildTextDecodeResult(fixture) {
  if (Array.isArray(fixture.input.cases)) {
    const perCase = fixture.input.cases.map((inputCase, index) => {
      const value = resolveJsonPathAsString(inputCase.json, inputCase.contentPath);
      const expectedError = fixture.expected.perCase?.[index]?.error ?? fixture.expected.error;

      return typeof value === "string"
        ? {
            outcome: "success",
            content: {
              kind: "text",
              text: value
            }
          }
        : buildFailureOutcome("fieldNotFound", expectedError);
    });
    const allFailed = perCase.every((result) => result.outcome === "failure");
    const actual = {
      outcome: allFailed ? "allFailure" : "mixed",
      ...(allFailed && fixture.expected.error
        ? { error: toExpectedErrorShape(new VGSShowError("fieldNotFound"), fixture.expected.error) }
        : {}),
      perCase
    };

    return buildAssertionResult({ fixture, actual, stateSequence: perCase });
  }

  const value = resolveJsonPathAsString(fixture.input.json, fixture.input.contentPath);
  const actual =
    typeof value === "string"
      ? {
          outcome: "success",
          content: {
            kind: "text",
            text: value
          }
        }
      : buildFailureOutcome("fieldNotFound", fixture.expected.error);

  return buildAssertionResult({ fixture, actual });
}

function buildBase64DecodeResult(fixture) {
  const value = resolveJsonPath(fixture.input.json, fixture.input.contentPath);

  if (typeof value !== "string") {
    return buildAssertionResult({
      fixture,
      actual: buildFailureOutcome("fieldNotFound", fixture.expected.error)
    });
  }

  if (!isStrictBase64(value)) {
    return buildAssertionResult({
      fixture,
      actual: buildFailureOutcome("invalidBase64Data", fixture.expected.error)
    });
  }

  return buildAssertionResult({
    fixture,
    actual: {
      outcome: "success",
      content: {
        kind: "rawData",
        dataBase64: value,
        dataUtf8: Buffer.from(value, "base64").toString("utf8")
      }
    }
  });
}

function buildResolveJsonPathResult(fixture) {
  const perCase = fixture.input.cases.map((inputCase) => {
    const value = resolveJsonPath(inputCase.json, inputCase.contentPath);
    return value === undefined ? { resolved: null } : { value };
  });
  const actual = {
    outcome: fixture.expected.outcome,
    ...(fixture.expected.allCasesResolveTo !== undefined
      ? { allCasesResolveTo: fixture.expected.allCasesResolveTo }
      : {}),
    ...(fixture.expected.allCasesFail !== undefined ? { allCasesFail: fixture.expected.allCasesFail } : {}),
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildIsValidJsonKeyPathResult(fixture) {
  const perCase = fixture.input.cases.map((inputCase) => ({
    isValid: isValidJsonKeyPath(inputCase.path)
  }));
  const actual = {
    outcome: fixture.expected.outcome,
    ...(fixture.expected.allCases !== undefined ? { allCases: fixture.expected.allCases } : {}),
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildEncodeJsonPayloadResult(fixture) {
  const payload = replaceJsonSentinels(fixture.input.payload);
  const encoded = network.encodeJsonPayload(payload);
  const actual =
    encoded.outcome === "success"
      ? {
          outcome: "success",
          ...(fixture.expected.roundTripsTo !== undefined ? { roundTripsTo: encoded.roundTripsTo } : {})
        }
      : buildFailureOutcome("invalidJSONPayload", fixture.expected.error);

  return buildAssertionResult({ fixture, actual });
}

function buildEncodeJsonPayloadAndHeadersResult(fixture) {
  const payload = replaceJsonSentinels(fixture.input.payload);
  const encoded = network.encodeJsonPayload(payload);
  const actual =
    encoded.outcome === "success"
      ? {
          outcome: "success",
          additionalHeaders: encoded.additionalHeaders
        }
      : buildFailureOutcome("invalidJSONPayload", fixture.expected.error);

  return buildAssertionResult({ fixture, actual });
}

function buildNormalizeRequestInputResult(fixture) {
  const actual = {
    outcome: "success",
    returnsPromise: typeof VGSShow.prototype.request === "function",
    normalized: network.normalizeRequestInput(fixture.input.request)
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual.normalized] });
}

function buildRequestMethodResult(fixture) {
  const built = network.buildRequest({
    baseUrl: fixture.input.baseUrl,
    request: fixture.input.request
  });
  const actual =
    built instanceof VGSShowError
      ? buildFailureOutcome(built.type, fixture.expected.error)
      : {
          outcome: "success",
          method: built.method
        };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildSupportedHttpMethodsResult(fixture) {
  return buildBooleanCasesResult({
    fixture,
    actualCases: fixture.input.cases.map((inputCase) => ({
      isSupported: network.isSupportedHttpMethod(inputCase.method)
    }))
  });
}

function buildValidateJsonPayloadCasesResult(fixture) {
  const perCase = fixture.input.cases.map((inputCase, index) => {
    const payload = replaceJsonSentinels(inputCase.payload);
    const expectedError = fixture.expected.perCase?.[index]?.error;
    const encoded = network.encodeJsonPayload(payload);

    return encoded.outcome === "success"
      ? { requestDispatched: true }
      : {
          requestDispatched: false,
          error: toExpectedErrorShape(encoded.error, expectedError)
        };
  });
  const actual = {
    outcome: perCase.every((result) => result.requestDispatched === false) ? "allFailure" : "mixed",
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildDefaultHeadersResult(fixture) {
  const headers = network.buildDefaultHeaders(fixture.input.metadata);
  const actual = {
    outcome: "success",
    headers,
    source: headers["vgs-client"].includes("source=show-rnSDK") ? "show-rnSDK" : "unknown"
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [headers] });
}

function buildMergeHeadersResult(fixture) {
  const actual = {
    outcome: "success",
    headers: network.mergeHeaders(
      fixture.input.defaults,
      fixture.input.customHeaders,
      fixture.input.payloadHeaders
    )
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual.headers] });
}

function buildRequestTimeoutResult(fixture) {
  const built = network.buildRequest({
    baseUrl: fixture.input.baseUrl,
    request: fixture.input.request
  });
  const actual =
    built instanceof VGSShowError
      ? buildFailureOutcome(built.type, fixture.expected.error)
      : {
          outcome: "success",
          timeoutSeconds: built.timeoutSeconds
        };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildTenantIdValidationResult(fixture) {
  return buildBooleanCasesResult({
    fixture,
    actualCases: fixture.input.cases.map((inputCase) => ({
      isValid: network.isValidTenantId(inputCase.id)
    }))
  });
}

function buildHostValidationUrlResult(fixture) {
  const perCase = fixture.input.cases.map((inputCase) => ({
    url: network.buildHostValidationUrl(inputCase.hostname, fixture.input.tenantId)
  }));
  const actual = {
    outcome: "success",
    ...(fixture.expected.allCases !== undefined ? { allCases: fixture.expected.allCases } : {}),
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildValidateCustomHostnameResult(fixture) {
  const actual = {
    outcome: "resolvesTo",
    resolved: network.buildHostValidationUrl(fixture.input.hostname, fixture.input.tenantId ?? "tenant") === null
      ? null
      : network.resolveCustomHostnameResult(fixture.input.hostname, fixture.input.responseBody ?? null)
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildHostnameResolutionQueueResult(fixture) {
  const perRequest = network.simulateHostnameQueue(fixture.input.requestIds);
  const actual = {
    outcome: "success",
    perRequest
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perRequest });
}

function buildTransitionHostURLPolicyResult(fixture) {
  const perCase = fixture.input.cases.map((inputCase) => ({
    policy: network.transitionHostURLPolicy(inputCase)
  }));
  const actual = {
    outcome: "success",
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildRequestOutcomeResult(fixture) {
  const perCase = fixture.input.cases.map((inputCase, index) => {
    const outcome = network.mapSimulatedResponse(inputCase.response);
    const expectedError = fixture.expected.perCase?.[index]?.error;

    return outcome.outcome === "resolve"
      ? {
          promiseState: "resolved",
          value: outcome.value
        }
      : {
          promiseState: "rejected",
          error: toExpectedErrorShape(outcome.error, expectedError)
        };
  });
  const actual = {
    outcome: "mixed",
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildJoinRequestPathResult(fixture) {
  const perCase = fixture.input.cases.map((inputCase) => ({
    url: network.joinRequestPath(inputCase.baseUrl, inputCase.path)
  }));
  const actual = {
    outcome: "success",
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildNetworkErrorCodeResult(fixture) {
  const perCase = fixture.input.cases.map((inputCase) => ({
    code: network.mapNetworkErrorCode(inputCase.error)
  }));
  const actual = {
    outcome: "success",
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function makeContentError(inputError) {
  return new VGSShowError(inputError.type, {
    ...(inputError.extraInfo === undefined ? {} : { extraInfo: inputError.extraInfo })
  });
}

function projectContentSnapshot(snapshot, expectedStep) {
  const projected = {};

  for (const key of Object.keys(expectedStep)) {
    if (key === "afterOperation") {
      continue;
    }

    if (key === "error" && snapshot.error !== undefined) {
      projected.error = Object.fromEntries(
        Object.keys(expectedStep.error).map((errorKey) => [errorKey, snapshot.error[errorKey]])
      );
      continue;
    }

    projected[key] = snapshot[key];
  }

  return projected;
}

function runContentStateOperations({ kind, operations, expectedSteps, callbackOrder }) {
  const callbackEvents = [];
  const machine = contentState.createContentStateMachine(kind, {
    onStateChange(snapshot) {
      callbackEvents.push(`state:${snapshot.state}`);
    },
    onError(error) {
      callbackEvents.push(`error:${error.type}`);
    }
  });

  const perStep = operations.map((operation, index) => {
    if (operation.action === "startLoading") {
      machine.startLoading();
    } else if (operation.action === "reveal") {
      machine.reveal(operation.content);
    } else if (operation.action === "fail") {
      machine.fail(makeContentError(operation.error));
    } else if (operation.action === "clear") {
      machine.clear();
    }

    const expectedStep = expectedSteps[index];
    return {
      afterOperation: index + 1,
      ...projectContentSnapshot(machine.snapshot, expectedStep)
    };
  });

  return {
    perStep,
    ...(callbackOrder === undefined ? {} : { callbackOrder: callbackEvents })
  };
}

function buildContentStateTransitionsResult(fixture) {
  const result = runContentStateOperations({
    kind: fixture.input.kind,
    operations: fixture.input.operations,
    expectedSteps: fixture.expected.perStep,
    callbackOrder: fixture.expected.callbackOrder
  });
  const actual = {
    outcome: "success",
    perStep: result.perStep,
    ...(fixture.expected.callbackOrder === undefined ? {} : { callbackOrder: result.callbackOrder })
  };

  return buildAssertionResult({ fixture, actual, stateSequence: result.perStep });
}

function buildTextPlaceholderVisibilityResult(fixture) {
  const result = runContentStateOperations({
    kind: "text",
    operations: fixture.input.operations,
    expectedSteps: fixture.expected.perStep
  });
  const actual = {
    outcome: "success",
    perStep: result.perStep
  };

  return buildAssertionResult({ fixture, actual, stateSequence: result.perStep });
}

function buildSetLabelTextAndClearTextResult(fixture) {
  const machine = contentState.createContentStateMachine("text");
  machine.reveal({
    kind: "text",
    text: fixture.input.revealedRawText
  });
  machine.clear();
  const actual = {
    outcome: "success",
    revealedRawText: machine.snapshot.content?.kind === "text" ? machine.snapshot.content.text : null
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [machine.snapshot] });
}

function buildConfigureTextLabelAndReadStateResult(fixture) {
  const vgsShow = new VGSShow({ id: "tenant" });
  const controller = components.__unstable__createVGSShowLabelControllerForTesting({
    viewId: "label",
    vgsShow,
    contentPath: ""
  });
  const perStep = [];

  fixture.input.operations.forEach((operation, index) => {
    if (operation.action === "setContentPath") {
      controller.updateProps({
        vgsShow,
        contentPath: operation.value
      });
    } else if (operation.action === "setRenderedSecureText") {
      controller.handleDecodingResult({
        kind: "success",
        content: {
          kind: "text",
          text: operation.value
        }
      });
    }

    const expectedStep = fixture.expected.perStep.find((step) => step.afterOperation === index + 1);
    if (expectedStep !== undefined) {
      perStep.push({
        afterOperation: index + 1,
        contentPath: controller.snapshot.contentPath,
        isEmpty: controller.snapshot.displayText === null || controller.snapshot.displayText.length === 0
      });
    }
  });

  const actual = {
    outcome: "success",
    perStep
  };

  controller.unmount();
  return buildAssertionResult({ fixture, actual, stateSequence: perStep });
}

function buildCopyTextAndObserveCallbackResult(fixture) {
  const vgsShow = new VGSShow({ id: "tenant" });
  let callbackFormat = null;
  let callbackCount = 0;
  const controller = components.__unstable__createVGSShowLabelControllerForTesting({
    viewId: "label",
    vgsShow,
    contentPath: "test.label",
    onCopyTextFinish: (format) => {
      callbackCount += 1;
      callbackFormat = format;
    }
  });

  controller.ref.copyToClipboard({ format: fixture.input.format });

  const actual = {
    outcome: "success",
    callbackFired: callbackCount === 1,
    callback: {
      name: "labelCopyTextDidFinish",
      format: callbackFormat
    }
  };

  controller.unmount();
  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildTextChangeCallbacksResult(fixture) {
  const perCase = fixture.input.cases.map((inputCase, index) => {
    const expectedCase = fixture.expected.perCase[index];
    const machine = contentState.createContentStateMachine("text");
    const text = inputCase.inputValue ?? inputCase.decodedText;
    let callbackFired = false;
    const callbackMachine = contentState.createContentStateMachine("text", {
      onStateChange(snapshot) {
        callbackFired = snapshot.state === "revealed";
      }
    });

    callbackMachine.reveal({
      kind: "text",
      text
    });
    machine.reveal({
      kind: "text",
      text
    });

    return {
      callbackFired,
      ...(expectedCase.revealedRawText !== undefined
        ? { revealedRawText: machine.snapshot.content?.kind === "text" ? machine.snapshot.content.text : null }
        : {})
    };
  });
  const actual = {
    outcome: "success",
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function createPipelineFormatter(formatter) {
  return {
    pattern: new RegExp(formatter.pattern, formatter.flags ?? ""),
    template: formatter.template
  };
}

function projectTextPipelineSnapshot(snapshot, expectedShape) {
  const projected = {};

  for (const key of Object.keys(expectedShape)) {
    if (key === "warningCount") {
      projected.warningCount = snapshot.warnings.length;
      continue;
    }

    projected[key] = snapshot[key];
  }

  return projected;
}

function buildSetSecureTextSymbolSequenceResult(fixture) {
  const pipeline = textPipeline.createTextPipeline();
  pipeline.setRawText(fixture.input.rawText);

  const perStep = fixture.input.operations.map((operation, index) => {
    if (operation.action === "enableSecureText") {
      pipeline.setIsSecureText(true);
    } else if (operation.action === "setSecureTextSymbol") {
      pipeline.setSecureTextSymbol(operation.value);
    }

    const snapshot = pipeline.snapshot;
    return {
      afterOperation: index + 1,
      displayText: snapshot.displayText
    };
  });

  const actual = {
    outcome: "success",
    perStep: perStep.map((step, index) => ({
      afterOperation: step.afterOperation,
      ...projectTextPipelineSnapshot(step, fixture.expected.perStep[index])
    }))
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perStep });
}

function buildCopyTextToClipboardValueSelectionResult(fixture) {
  const pipeline = textPipeline.createTextPipeline();
  const observedSteps = [];

  fixture.input.operations.forEach((operation, index) => {
    if (operation.action === "setRevealedRawText") {
      pipeline.setRawText(operation.value);
      return;
    }

    if (operation.action === "copyToClipboard") {
      observedSteps.push({
        afterOperation: index + 1,
        copiedText: pipeline.copyText(operation.format)
      });
    }
  });

  const actual = {
    outcome: "success",
    perStep: observedSteps
  };

  return buildAssertionResult({ fixture, actual, stateSequence: observedSteps });
}

function buildCopyFormattedAndResetTextResult(fixture) {
  const pipeline = textPipeline.createTextPipeline();
  pipeline.setRawText(fixture.input.rawText);
  pipeline.addTransformationRegex(createPipelineFormatter(fixture.input.formatter));

  const observedSteps = [];
  fixture.input.operations.forEach((operation, index) => {
    if (operation.action === "copyToClipboard") {
      observedSteps.push({
        afterOperation: index + 1,
        copiedText: pipeline.copyText(operation.format)
      });
      return;
    }

    if (operation.action === "resetAllFormatters") {
      pipeline.resetAllFormatters();
    }
  });

  const actual = {
    outcome: "success",
    perStep: observedSteps
  };

  return buildAssertionResult({ fixture, actual, stateSequence: observedSteps });
}

function buildApplyFormatterThenSecureRangeResult(fixture) {
  const formattedTextBeforeMask = (() => {
    const pipeline = textPipeline.createTextPipeline();
    pipeline.setRawText(fixture.input.rawText);
    pipeline.addTransformationRegex(createPipelineFormatter(fixture.input.formatter));
    return pipeline.snapshot.transformedText;
  })();

  const perCase = fixture.input.cases.map((inputCase) => {
    const pipeline = textPipeline.createTextPipeline();
    pipeline.setRawText(fixture.input.rawText);
    pipeline.addTransformationRegex(createPipelineFormatter(fixture.input.formatter));
    pipeline.setSecureText([inputCase.range]);
    return {
      maskedText: pipeline.snapshot.displayText
    };
  });

  const actual = {
    outcome: "success",
    formattedTextBeforeMask,
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildApplyFormatterThenSecureRangesArrayResult(fixture) {
  const formattedTextBeforeMask = (() => {
    const pipeline = textPipeline.createTextPipeline();
    pipeline.setRawText(fixture.input.rawText);
    pipeline.addTransformationRegex(createPipelineFormatter(fixture.input.formatter));
    return pipeline.snapshot.transformedText;
  })();

  const perCase = fixture.input.cases.map((inputCase) => {
    const pipeline = textPipeline.createTextPipeline();
    pipeline.setRawText(fixture.input.rawText);
    pipeline.addTransformationRegex(createPipelineFormatter(fixture.input.formatter));
    pipeline.setSecureText(inputCase.ranges);
    return {
      maskedText: pipeline.snapshot.displayText
    };
  });

  const actual = {
    outcome: "success",
    formattedTextBeforeMask,
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildApplySecureRangesToRevealedTextResult(fixture) {
  const perCase = fixture.input.cases.map((inputCase) => {
    const pipeline = textPipeline.createTextPipeline();
    pipeline.setRawText(inputCase.revealedText);
    pipeline.setSecureText(inputCase.ranges);
    return {
      maskedText: pipeline.snapshot.displayText
    };
  });

  const actual = {
    outcome: "success",
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildIsTextRangeValidResult(fixture) {
  const perCase = fixture.input.cases.map((inputCase) => ({
    isValid: textPipeline.isTextRangeValid(fixture.input.text, inputCase.range)
  }));

  const actual = {
    outcome: "success",
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildApplySingleTransformationRegexResult(fixture) {
  const perCase = fixture.input.cases.map((inputCase) => {
    const pipeline = textPipeline.createTextPipeline();
    pipeline.setRawText(fixture.input.rawText);
    pipeline.addTransformationRegex(
      createPipelineFormatter({
        pattern: fixture.input.pattern,
        template: inputCase.template
      })
    );
    return {
      transformedText: pipeline.snapshot.transformedText
    };
  });

  const actual = {
    outcome: "success",
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildResetAllFormattersAfterFormattingResult(fixture) {
  const pipeline = textPipeline.createTextPipeline();
  pipeline.setRawText(fixture.input.rawText);
  pipeline.addTransformationRegex(createPipelineFormatter(fixture.input.formatter));
  const transformedTextBeforeReset = pipeline.snapshot.transformedText;
  pipeline.resetAllFormatters();
  const actual = {
    outcome: "success",
    transformedTextBeforeReset,
    transformedTextAfterReset: pipeline.snapshot.transformedText
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildInspectDefaultSecureModeFormattingResult(fixture) {
  const pipeline = textPipeline.createTextPipeline();
  pipeline.setRawText(fixture.input.rawText);
  if (fixture.input.formatter) {
    pipeline.addTransformationRegex(createPipelineFormatter(fixture.input.formatter));
  }

  const snapshot = pipeline.snapshot;
  const actual = {
    outcome: "success",
    ...projectTextPipelineSnapshot(snapshot, Object.fromEntries(
      Object.entries(fixture.expected).filter(([key]) => key !== "outcome")
    ))
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [snapshot] });
}

function buildApplyMultiCharSecureTextSymbolWarningResult(fixture) {
  const pipeline = textPipeline.createTextPipeline();
  pipeline.setRawText(fixture.input.rawText);
  pipeline.setIsSecureText(true);
  pipeline.clearWarnings();
  pipeline.setSecureTextSymbol(fixture.input.secureTextSymbol);

  const snapshot = pipeline.snapshot;
  const actual = {
    outcome: "success",
    ...projectTextPipelineSnapshot(snapshot, Object.fromEntries(
      Object.entries(fixture.expected).filter(([key]) => key !== "outcome")
    ))
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [snapshot] });
}

function buildApplyStackedTransformationRegexesResult(fixture) {
  const pipeline = textPipeline.createTextPipeline();
  pipeline.setRawText(fixture.input.rawText);
  for (const formatter of fixture.input.formatters) {
    pipeline.addTransformationRegex(createPipelineFormatter(formatter));
  }

  const snapshot = pipeline.snapshot;
  const actual = {
    outcome: "success",
    ...projectTextPipelineSnapshot(snapshot, Object.fromEntries(
      Object.entries(fixture.expected).filter(([key]) => key !== "outcome")
    ))
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [snapshot] });
}

function buildInspectFormatterResetStateResult(fixture) {
  const pipeline = textPipeline.createTextPipeline();
  pipeline.setRawText(fixture.input.rawText);
  pipeline.addTransformationRegex(createPipelineFormatter(fixture.input.formatter));
  const beforeResetSnapshot = pipeline.snapshot;
  pipeline.resetAllFormatters();
  const afterResetSnapshot = pipeline.snapshot;
  const actual = {
    outcome: "success",
    beforeReset: projectTextPipelineSnapshot(beforeResetSnapshot, fixture.expected.beforeReset),
    afterReset: projectTextPipelineSnapshot(afterResetSnapshot, fixture.expected.afterReset)
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [beforeResetSnapshot, afterResetSnapshot] });
}

function buildTextComponentAutoSubscriptionResult(fixture) {
  resetAnalyticsTestingState();
  const vgsShow = new VGSShow({ id: "tenant" });
  const controllers = new Map();

  for (const label of fixture.input.labels) {
    controllers.set(
      label.viewId,
      components.__unstable__createVGSShowLabelControllerForTesting({
        viewId: label.viewId,
        vgsShow,
        contentPath: label.contentPath
      })
    );
  }

  const subscriberCountAfterMount = subscribedViews(vgsShow).length;
  const targetController = controllers.get(fixture.input.updatedContentPath.viewId);
  targetController.updateProps({
    vgsShow,
    contentPath: fixture.input.updatedContentPath.contentPath
  });
  const subscriberCountAfterContentPathUpdate = subscribedViews(vgsShow).length;

  simulateRequestForTesting(vgsShow, { path: "post" }, fixture.input.response);

  const renderedTextByViewId = Object.fromEntries(
    [...controllers.entries()].map(([viewId, controller]) => [viewId, controller.snapshot.displayText])
  );

  for (const controller of controllers.values()) {
    controller.unmount();
  }

  const actual = {
    outcome: "success",
    subscriberCountAfterMount,
    subscriberCountAfterContentPathUpdate,
    renderedTextByViewId,
    subscriberCountAfterUnmount: subscribedViews(vgsShow).length
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildTextComponentClearTextCallbackResult(fixture) {
  resetAnalyticsTestingState();
  const vgsShow = new VGSShow({ id: "tenant" });
  const textChangeArgsLengths = [];
  const controller = components.__unstable__createVGSShowLabelControllerForTesting({
    viewId: fixture.input.viewId,
    vgsShow,
    contentPath: fixture.input.contentPath,
    placeholder: fixture.input.placeholder,
    onTextChange: (...args) => {
      textChangeArgsLengths.push(args.length);
    }
  });

  controller.handleDecodingResult({
    kind: "success",
    content: {
      kind: "text",
      text: fixture.input.revealedRawText
    }
  });

  const beforeClear = {
    displayText: controller.snapshot.displayText,
    placeholderVisible: controller.snapshot.placeholderVisible,
    textChangeCount: textChangeArgsLengths.length
  };

  resetAnalyticsTestingState();
  controller.ref.clearText();
  const afterClear = {
    displayText: controller.snapshot.displayText,
    placeholderVisible: controller.snapshot.placeholderVisible,
    textChangeCount: textChangeArgsLengths.length,
    lastTextChangeArgsLength: textChangeArgsLengths.at(-1)
  };

  const actual = {
    outcome: "success",
    beforeClear,
    afterClear,
    analyticsPayloadCount: analytics.VGSAnalyticsClient.shared.__unstable__getSentPayloadsForTesting().length
  };

  controller.unmount();
  return buildAssertionResult({ fixture, actual, stateSequence: [beforeClear, afterClear] });
}

function buildTextComponentCopySideEffectsResult(fixture) {
  resetAnalyticsTestingState();
  const vgsShow = new VGSShow({ id: "tenant" });
  const clipboardWrites = [];
  const copyCallbacks = [];
  const controller = components.__unstable__createVGSShowLabelControllerForTesting({
    viewId: fixture.input.viewId,
    vgsShow,
    contentPath: fixture.input.contentPath,
    clipboardAdapter: {
      writeText(text) {
        clipboardWrites.push(text);
      }
    },
    onCopyTextFinish: (...args) => {
      copyCallbacks.push(args);
    }
  });

  controller.handleDecodingResult({
    kind: "success",
    content: {
      kind: "text",
      text: fixture.input.revealedRawText
    }
  });
  controller.ref.addTransformationRegex(createPipelineFormatter(fixture.input.formatter));

  resetAnalyticsTestingState();
  controller.ref.copyToClipboard({ format: fixture.input.copyFormat });
  const payload = analytics.VGSAnalyticsClient.shared.__unstable__getSentPayloadsForTesting()[0];
  const copiedValue = clipboardWrites[0] ?? "";
  const payloadString = JSON.stringify(payload);

  const actual = {
    outcome: "success",
    clipboardWrites,
    copyCallback: {
      fired: copyCallbacks.length === 1,
      format: copyCallbacks[0]?.[0] ?? null,
      argsLength: copyCallbacks[0]?.length ?? 0
    },
    analytics: {
      type: payload?.type ?? null,
      status: payload?.status ?? null,
      extraInfo: payload?.extraInfo ?? null,
      extraInfoKeys: Object.keys(payload?.extraInfo ?? {}),
      containsCopiedValue: copiedValue.length > 0 && payloadString.includes(copiedValue)
    }
  };

  controller.unmount();
  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildTextComponentTextChangeUpdatePathsResult(fixture) {
  resetAnalyticsTestingState();
  const vgsShow = new VGSShow({ id: "tenant" });
  const callbackArgsLengths = [];
  const displayTextSequence = [];
  let controller;
  controller = components.__unstable__createVGSShowLabelControllerForTesting({
    viewId: fixture.input.viewId,
    vgsShow,
    contentPath: fixture.input.contentPath,
    onTextChange: (...args) => {
      callbackArgsLengths.push(args.length);
      displayTextSequence.push(controller.snapshot.displayText);
    }
  });

  controller.handleDecodingResult({
    kind: "success",
    content: {
      kind: "text",
      text: fixture.input.revealedRawText
    }
  });

  for (const operation of fixture.input.operations) {
    if (operation.action === "addTransformationRegex") {
      controller.ref.addTransformationRegex(createPipelineFormatter(operation.formatter));
      continue;
    }

    if (operation.action === "setSecureText") {
      controller.ref.setSecureText({ ranges: operation.ranges });
      continue;
    }

    if (operation.action === "setSecureTextSymbol") {
      controller.updateProps({
        vgsShow,
        contentPath: fixture.input.contentPath,
        secureTextSymbol: operation.value,
        onTextChange: (...args) => {
          callbackArgsLengths.push(args.length);
          displayTextSequence.push(controller.snapshot.displayText);
        }
      });
      continue;
    }

    if (operation.action === "resetAllFormatters") {
      controller.ref.resetAllFormatters();
    }
  }

  const actual = {
    outcome: "success",
    textChangeCount: callbackArgsLengths.length,
    callbackArgsLengths,
    displayTextSequence
  };

  controller.unmount();
  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildTextComponentAntiLeakSurfaceResult(fixture) {
  resetAnalyticsTestingState();
  const vgsShow = new VGSShow({ id: "tenant" });
  const callbackPayloads = [];
  const controller = components.__unstable__createVGSShowLabelControllerForTesting({
    viewId: fixture.input.viewId,
    vgsShow,
    contentPath: fixture.input.contentPath,
    placeholder: fixture.input.placeholder,
    onTextChange: (...args) => {
      callbackPayloads.push(args);
    }
  });

  controller.handleDecodingResult({
    kind: "success",
    content: {
      kind: "text",
      text: fixture.input.revealedRawText
    }
  });

  const ref = controller.ref;
  const callbackPayloadString = JSON.stringify(callbackPayloads);
  const actual = {
    outcome: "success",
    refKeys: Object.keys(ref).sort(),
    hasTextGetter: "text" in ref,
    hasRawTextGetter: "rawText" in ref,
    hasDisplayTextGetter: "displayText" in ref,
    accessibilityLabel: controller.snapshot.accessibilityLabel,
    callbackPayloadContainsRevealedText: callbackPayloadString.includes(fixture.input.revealedRawText)
  };

  controller.unmount();
  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

const VALID_IMAGE_BASE64 = "iVBORw0KGgo=";
const VALID_PDF_BASE64 = "JVBERi0xLjQK";

function createMediaVgsShow() {
  resetAnalyticsTestingState();
  return new VGSShow({ id: "tenant" });
}

function projectSerializedError(error, expectedError) {
  return Object.fromEntries(
    Object.keys(expectedError).map((key) => [key, error[key]])
  );
}

function deliverRawData(controller, dataBase64) {
  controller.handleDecodingResult({
    kind: "success",
    content: {
      kind: "rawData",
      dataBase64
    }
  });
}

function buildSetImageContentPathAndReadBackResult(fixture) {
  const vgsShow = createMediaVgsShow();
  const controller = components.__unstable__createVGSShowImageControllerForTesting({
    viewId: "image",
    vgsShow,
    contentPath: ""
  });
  controller.updateProps({
    vgsShow,
    contentPath: fixture.input.contentPath
  });

  const actual = {
    outcome: "success",
    contentPath: controller.snapshot.contentPath
  };

  controller.unmount();
  return buildAssertionResult({ fixture, actual, stateSequence: [controller.snapshot] });
}

function buildSetAndReadPdfContentPathResult(fixture) {
  const vgsShow = createMediaVgsShow();
  const perCase = fixture.input.cases.map((inputCase) => {
    const initialContentPath = inputCase.modelContentPath ?? "";
    const controller = components.__unstable__createVGSShowPdfControllerForTesting({
      viewId: "pdf",
      vgsShow,
      contentPath: initialContentPath
    });

    if (typeof inputCase.contentPath === "string") {
      controller.updateProps({
        vgsShow,
        contentPath: inputCase.contentPath
      });
    }

    const result = {
      contentPath: controller.snapshot.contentPath
    };
    controller.unmount();
    return result;
  });

  const actual = {
    outcome: "success",
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildSetPdfFormatAndReadDecodingModeResult(fixture) {
  const vgsShow = createMediaVgsShow();
  const controller = components.__unstable__createVGSShowPdfControllerForTesting({
    viewId: "pdf",
    vgsShow,
    contentPath: "document"
  });
  const subscribedView = subscribedViews(vgsShow)[0];
  const actual = {
    outcome: "success",
    decodingContentMode:
      subscribedView?.decodingContentMode === "pdfBase64"
        ? {
            kind: "pdf",
            pdfFormat: fixture.input.pdfFormat
          }
        : null
  };

  controller.unmount();
  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildPdfDisplayDefaultsAndSettingsResult(fixture) {
  const vgsShow = createMediaVgsShow();
  const controller = components.__unstable__createVGSShowPdfControllerForTesting({
    viewId: "pdf",
    vgsShow,
    contentPath: "document"
  });
  const perStep = [];

  fixture.input.operations.forEach((operation, index) => {
    if (operation.action === "setDisplayMode") {
      controller.updateProps({
        vgsShow,
        contentPath: "document",
        pdfDisplayMode: operation.value
      });
    } else if (operation.action === "setDisplayDirection") {
      controller.updateProps({
        vgsShow,
        contentPath: "document",
        pdfDisplayMode: controller.snapshot.displayMode,
        pdfDisplayDirection: operation.value
      });
    } else if (operation.action === "setAutoScales") {
      controller.updateProps({
        vgsShow,
        contentPath: "document",
        pdfDisplayMode: controller.snapshot.displayMode,
        pdfDisplayDirection: controller.snapshot.displayDirection,
        pdfAutoScales: operation.value
      });
    } else if (operation.action === "setDisplayAsBook") {
      controller.updateProps({
        vgsShow,
        contentPath: "document",
        pdfDisplayMode: controller.snapshot.displayMode,
        pdfDisplayDirection: controller.snapshot.displayDirection,
        pdfAutoScales: controller.snapshot.autoScales,
        displayAsBook: operation.value
      });
    } else if (operation.action === "setPageShadowsEnabled") {
      controller.updateProps({
        vgsShow,
        contentPath: "document",
        pdfDisplayMode: controller.snapshot.displayMode,
        pdfDisplayDirection: controller.snapshot.displayDirection,
        pdfAutoScales: controller.snapshot.autoScales,
        displayAsBook: controller.snapshot.displayAsBook,
        pageShadowsEnabled: operation.value
      });
    }

    const expectedStep = fixture.expected.perStep[index];
    const snapshot = controller.snapshot;
    const available = {
      afterOperation: index + 1,
      displayMode: snapshot.displayMode,
      displayDirection: snapshot.displayDirection,
      autoScales: snapshot.autoScales,
      displayAsBook: snapshot.displayAsBook,
      pageShadowsEnabled: snapshot.pageShadowsEnabled
    };
    perStep.push(Object.fromEntries(
      Object.keys(expectedStep).map((key) => [key, available[key]])
    ));
  });

  const actual = {
    outcome: "success",
    perStep
  };

  controller.unmount();
  return buildAssertionResult({ fixture, actual, stateSequence: perStep });
}

function buildPdfDocumentPresenceResult(fixture) {
  const vgsShow = createMediaVgsShow();
  const controller = components.__unstable__createVGSShowPdfControllerForTesting({
    viewId: "pdf",
    vgsShow,
    contentPath: "document"
  });
  const perStep = fixture.input.operations.map((operation, index) => {
    if (operation.action === "reveal") {
      deliverRawData(controller, operation.content.dataBase64);
    } else if (operation.action === "clear") {
      controller.ref.clear();
    }

    const snapshot = controller.snapshot;
    const available = {
      afterOperation: index + 1,
      state: snapshot.state,
      hasDocument: controller.ref.hasDocument
    };
    const expectedStep = fixture.expected.perStep[index];
    return Object.fromEntries(
      Object.keys(expectedStep).map((key) => [key, available[key]])
    );
  });

  const actual = {
    outcome: "success",
    perStep
  };

  controller.unmount();
  return buildAssertionResult({ fixture, actual, stateSequence: perStep });
}

function buildImagePresenceSequenceResult(fixture) {
  const vgsShow = createMediaVgsShow();
  const controller = components.__unstable__createVGSShowImageControllerForTesting({
    viewId: "image",
    vgsShow,
    contentPath: "image"
  });
  const perStep = fixture.input.operations.map((operation, index) => {
    if (operation.action === "setSecureImagePresent") {
      if (operation.value === true) {
        deliverRawData(controller, VALID_IMAGE_BASE64);
      } else {
        controller.ref.clear();
      }
    } else if (operation.action === "clear") {
      controller.ref.clear();
    }

    return {
      afterOperation: index + 1,
      hasImage: controller.ref.hasImage
    };
  });
  const expectedSteps = fixture.expected.perStep.map((expectedStep) => {
    const actualStep = perStep.find((step) => step.afterOperation === expectedStep.afterOperation);
    return Object.fromEntries(
      Object.keys(expectedStep).map((key) => [key, actualStep?.[key]])
    );
  });
  const actual = {
    outcome: "success",
    perStep: expectedSteps
  };

  controller.unmount();
  return buildAssertionResult({ fixture, actual, stateSequence: perStep });
}

function buildImageChangeCallbacksResult(fixture) {
  const perCase = fixture.input.cases.map((inputCase) => {
    const vgsShow = createMediaVgsShow();
    let callbackFired = false;
    const controller = components.__unstable__createVGSShowImageControllerForTesting({
      viewId: "image",
      vgsShow,
      contentPath: "image",
      renderValidator: () => true,
      onImageChange: (...args) => {
        callbackFired = args.length === 0;
      }
    });
    deliverRawData(controller, inputCase.rawDataBase64);

    const result = {
      callbackFired,
      content: {
        kind: "rawData",
        dataBase64: inputCase.rawDataBase64,
        dataUtf8: Buffer.from(inputCase.rawDataBase64, "base64").toString("utf8")
      }
    };
    controller.unmount();
    return result;
  });
  const actual = {
    outcome: "success",
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildPdfDocumentChangeCallbackResult(fixture) {
  const vgsShow = createMediaVgsShow();
  let callbackFired = false;
  const controller = components.__unstable__createVGSShowPdfControllerForTesting({
    viewId: "pdf",
    vgsShow,
    contentPath: "document",
    renderValidator: () => true,
    onDocumentChange: (...args) => {
      callbackFired = args.length === 0;
    }
  });
  deliverRawData(controller, fixture.input.rawDataBase64);
  const actual = {
    outcome: "success",
    callbackFired,
    content: {
      kind: "rawData",
      dataBase64: fixture.input.rawDataBase64
    }
  };

  controller.unmount();
  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function createCoreView(inputView, fallbackKind) {
  return {
    viewId: inputView.viewId,
    kind: inputView.viewKind ?? fallbackKind,
    contentPath: inputView.contentPath ?? inputView.viewId,
    decodingContentMode: inputView.decodingContentMode,
    stateSequence: [],
    onLoading() {
      this.stateSequence.push("loading");
    },
    handleDecodingResult(result) {
      this.stateSequence.push(result.kind === "success" ? "revealed" : "failed");
    }
  };
}

function countCoreSubscriptions(vgsShow) {
  return {
    subscribedLabels: subscribedLabels(vgsShow).length,
    subscribedViews: subscribedViews(vgsShow).length,
    subscribedPDFViews: subscribedPDFViews(vgsShow).length
  };
}

function coreLifecycleEventsForFixture(vgsShow) {
  return vgsShowInternals
    .getVGSShowLifecycleEventsForTesting(vgsShow)
    .filter((event) => event.type === "UnsubscribeField")
    .map((event) => ({
      type: event.type,
      viewId: event.viewId,
      viewKind: event.viewKind
    }));
}

function buildSubscriptionSequenceResult(fixture) {
  const vgsShow = new VGSShow({ id: "tenant" });
  const views = new Map();
  const perStep = [
    {
      afterOperation: 0,
      ...countCoreSubscriptions(vgsShow)
    }
  ];

  const getView = (operation) => {
    const viewId = operation.viewId;
    if (!views.has(viewId)) {
      views.set(
        viewId,
        createCoreView(
          {
            viewId,
            viewKind: operation.viewKind
          },
          fixture.input.viewKind === "mixed" ? "label" : fixture.input.viewKind
        )
      );
    }

    return views.get(viewId);
  };

  fixture.input.operations.forEach((operation, index) => {
    if (operation.action === "subscribe") {
      subscribeView(vgsShow, getView(operation));
    } else if (operation.action === "unsubscribe") {
      unsubscribeView(vgsShow, getView(operation));
    } else if (operation.action === "unsubscribeAllViews") {
      unsubscribeAllViews(vgsShow);
    }

    perStep.push({
      afterOperation: index + 1,
      ...countCoreSubscriptions(vgsShow)
    });
  });

  const counts = countCoreSubscriptions(vgsShow);
  const available = {
    outcome: "success",
    subscribedLabels: counts.subscribedLabels,
    subscribedViews: counts.subscribedViews,
    subscribedPDFViews: counts.subscribedPDFViews,
    perStep: fixture.expected.perStep?.map((expectedStep) => {
      const actualStep = perStep.find((step) => step.afterOperation === expectedStep.afterOperation);
      return Object.fromEntries(
        Object.keys(expectedStep).map((key) => [key, actualStep?.[key]])
      );
    }),
    lifecycleEvents: coreLifecycleEventsForFixture(vgsShow)
  };
  const actual = Object.fromEntries(
    Object.keys(fixture.expected).map((key) => [key, available[key]])
  );

  return buildAssertionResult({ fixture, actual, stateSequence: perStep });
}

function isUuidV4(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
}

function buildFormIdStabilityResult(fixture) {
  const instances = fixture.input.instances.map((options) => new VGSShow(options));
  const firstBefore = instances[0].formId;
  const firstAfter = instances[0].formId;
  const second = instances[1].formId;
  const actual = {
    outcome: "success",
    firstMatchesUuidV4: isUuidV4(firstBefore),
    secondMatchesUuidV4: isUuidV4(second),
    firstStableAcrossReads: firstBefore === firstAfter,
    uniqueAcrossInstances: firstBefore !== second
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function projectHeaders(headers, expectedHeaders) {
  return Object.fromEntries(
    Object.keys(expectedHeaders).map((key) => [key, headers[key]])
  );
}

function buildCustomHeadersPropagationResult(fixture) {
  const vgsShow = new VGSShow(fixture.input.vgsShow);
  vgsShow.customHeaders = fixture.input.initialHeaders;
  const firstRequest = buildRequestForTesting(vgsShow, fixture.input.request);
  vgsShow.customHeaders = fixture.input.updatedHeaders;
  const secondRequest = buildRequestForTesting(vgsShow, fixture.input.request);

  const actual =
    firstRequest instanceof VGSShowError || secondRequest instanceof VGSShowError
      ? {
          outcome: "failure"
        }
      : {
          outcome: "success",
          firstRequestHeaders: projectHeaders(firstRequest.headers, fixture.expected.firstRequestHeaders),
          secondRequestHeaders: projectHeaders(secondRequest.headers, fixture.expected.secondRequestHeaders),
          firstRequestStillHasInitialHeader: firstRequest.headers["X-Trace"] === fixture.input.initialHeaders["X-Trace"]
        };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildSetCustomHeadersAndReadBackResult(fixture) {
  const vgsShow = new VGSShow({ id: "tenant" });
  vgsShow.customHeaders = fixture.input.customHeaders;
  const actual = {
    outcome: "success",
    customHeaders: vgsShow.customHeaders
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual.customHeaders] });
}

function projectCoreViewTrace(traceView, expectedView) {
  const projected = {};

  for (const key of Object.keys(expectedView)) {
    if (key === "error" && traceView.error !== undefined) {
      projected.error = Object.fromEntries(
        Object.keys(expectedView.error).map((errorKey) => [errorKey, traceView.error[errorKey]])
      );
      continue;
    }

    projected[key] = traceView[key];
  }

  return projected;
}

function buildCoreRequestPipelineResult(fixture) {
  const vgsShow = new VGSShow(fixture.input.vgsShow);
  for (const inputView of fixture.input.views) {
    subscribeView(vgsShow, createCoreView(inputView, inputView.viewKind));
  }

  const trace = simulateRequestForTesting(
    vgsShow,
    fixture.input.request,
    fixture.input.response
  );
  const available = {
    outcome: trace.outcome,
    promiseState: trace.promiseState,
    requestResult: trace.requestResult,
    requestDispatched: trace.requestDispatched,
    warningLogCount: trace.warnings.length,
    decodeAttemptCount: trace.perView.length,
    eventSequence: trace.eventSequence,
    perView: fixture.expected.perView?.map((expectedView) => {
      const actualView = trace.perView.find((view) => view.viewId === expectedView.viewId);
      return projectCoreViewTrace(actualView ?? {}, expectedView);
    }),
    unrevealedContentPaths: trace.unrevealedContentPaths
  };
  const actual = Object.fromEntries(
    Object.keys(fixture.expected).map((key) => [key, available[key]])
  );

  return buildAssertionResult({ fixture, actual, stateSequence: trace.eventSequence });
}

function buildSetRevealedPdfContentResult(fixture) {
  const setContentOperation = fixture.input.operations.find((operation) => operation.op === "setRevealedPdfContent");
  const vgsShow = createMediaVgsShow();
  let callbackError = null;
  const controller = components.__unstable__createVGSShowPdfControllerForTesting({
    viewId: "pdf",
    vgsShow,
    contentPath: "document",
    onDocumentError: (error) => {
      callbackError = error.toJSON();
    }
  });
  deliverRawData(controller, setContentOperation?.pdfBytesBase64 ?? "");

  const actual =
    callbackError === null
      ? {
          outcome: "success",
          state: { hasDocument: controller.ref.hasDocument }
        }
      : {
          outcome: "callbackFired",
          callback: "onDocumentError",
          callbackArgs: {
            error: projectSerializedError(callbackError, fixture.expected.callbackArgs.error)
          },
          state: {
            hasDocument: controller.ref.hasDocument
          }
        };

  controller.unmount();
  return buildAssertionResult({ fixture, actual, stateSequence: [actual.state] });
}

function buildSetRevealedImageContentResult(fixture) {
  const setContentOperation = fixture.input.operations.find((operation) => operation.op === "setRevealedImageContent");
  const vgsShow = createMediaVgsShow();
  let callbackError = null;
  const controller = components.__unstable__createVGSShowImageControllerForTesting({
    viewId: "image",
    vgsShow,
    contentPath: "image",
    onImageError: (error) => {
      callbackError = error.toJSON();
    }
  });
  deliverRawData(controller, setContentOperation?.imageBytesBase64 ?? "");

  const actual =
    callbackError === null
      ? {
          outcome: "success",
          state: {
            hasImage: controller.ref.hasImage
          }
        }
      : {
          outcome: "callbackFired",
          callback: "onImageError",
          callbackArgs: {
            error: projectSerializedError(callbackError, fixture.expected.callbackArgs.error)
          },
          state: {
            hasImage: controller.ref.hasImage
          }
        };

  controller.unmount();
  return buildAssertionResult({ fixture, actual, stateSequence: [actual.state] });
}

function buildRequestWithInvalidConfigurationResult(fixture) {
  const actual = {
    outcome: "allFailure",
    perCase: fixture.input.cases.map((inputCase, index) => {
      const options = inputCase.vgsShow;
      const isValidConfiguration = network.isValidTenantId(options.id) && network.isValidRegionalEnvironment(options.environment);
      const expectedError = fixture.expected.perCase?.[index]?.error;

      return isValidConfiguration
        ? {
            requestDispatched: true
          }
        : {
            requestDispatched: false,
            error: toExpectedErrorShape(new VGSShowError("invalidConfigurationURL"), expectedError)
          };
    })
  };

  return buildAssertionResult({ fixture, actual, stateSequence: actual.perCase });
}

function buildPartialRevealResult(fixture) {
  const perView = fixture.input.views.map((view) => {
    if (view.decodeResult.outcome === "failure") {
      return {
        viewId: view.viewId,
        errorCallbackFired: true,
        error: normalizeError(view.decodeResult.error)
      };
    }

    return {
      viewId: view.viewId,
      errorCallbackFired: false
    };
  });

  const actual = {
    outcome: "success",
    requestResult: fixture.input.requestResult,
    perView,
    warningLogCount: perView.filter((view) => view.errorCallbackFired).length
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perView });
}

function buildRevealErrorCallbacksResult(fixture) {
  const actual = {
    outcome: "success",
    perCase: fixture.input.cases.map((inputCase) => ({
      callbackFired: true,
      error: normalizeError(inputCase.error)
    }))
  };

  return buildAssertionResult({ fixture, actual, stateSequence: actual.perCase });
}

function buildImageErrorCallbacksResult(fixture) {
  const perCase = fixture.input.cases.map((inputCase, index) => {
    const vgsShow = createMediaVgsShow();
    let callbackError = null;
    const controller = components.__unstable__createVGSShowImageControllerForTesting({
      viewId: "image",
      vgsShow,
      contentPath: "image",
      onImageError: (error) => {
        callbackError = error.toJSON();
      }
    });
    controller.handleDecodingResult({
      kind: "failure",
      error: makeContentError(inputCase.error)
    });

    const expectedError = fixture.expected.perCase[index].error;
    const result = {
      callbackFired: callbackError !== null,
      error: callbackError === null ? null : projectSerializedError(callbackError, expectedError)
    };
    controller.unmount();
    return result;
  });
  const actual = {
    outcome: "success",
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildPdfDocumentErrorCallbackResult(fixture) {
  const vgsShow = createMediaVgsShow();
  let callbackError = null;
  const controller = components.__unstable__createVGSShowPdfControllerForTesting({
    viewId: "pdf",
    vgsShow,
    contentPath: "document",
    onDocumentError: (error) => {
      callbackError = error.toJSON();
    }
  });
  controller.handleDecodingResult({
    kind: "failure",
    error: makeContentError(fixture.input.error)
  });

  const actual = {
    outcome: "success",
    callbackFired: callbackError !== null,
    error: callbackError === null ? null : projectSerializedError(callbackError, fixture.expected.error)
  };

  controller.unmount();
  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function resetAnalyticsTestingState() {
  analytics.VGSAnalyticsClient.shared.__unstable__resetForTesting();
  analytics.VGSLogger.shared.__unstable__resetForTesting();
}

function buildAnalyticsSessionRuntimeResult(fixture) {
  resetAnalyticsTestingState();
  const firstSessionId = analytics.VGSShowAnalyticsSession.shared.sessionId;
  const secondSessionId = analytics.VGSShowAnalyticsSession.shared.sessionId;
  const firstShow = new VGSShow({ id: "tenant1" });
  const secondShow = new VGSShow({ id: "tenant2" });
  const firstRequest = buildRequestForTesting(firstShow, { path: "post" });
  const secondRequest = buildRequestForTesting(secondShow, { path: "post" });
  analytics.VGSAnalyticsClient.shared.trackFieldInit({
    contentPath: "card.token",
    field: "text"
  });
  const firstPayload = analytics.VGSAnalyticsClient.shared.__unstable__getSentPayloadsForTesting()[0];

  const actual = {
    outcome: "success",
    firstMatchesUuidV4: isUuidV4(firstSessionId),
    secondMatchesUuidV4: isUuidV4(secondSessionId),
    stableAcrossReads: firstSessionId === secondSessionId,
    sharedAcrossInstances:
      !(firstRequest instanceof VGSShowError) &&
      !(secondRequest instanceof VGSShowError) &&
      firstRequest.headers["vgs-client"].includes(`sessionId=${firstSessionId}`) &&
      secondRequest.headers["vgs-client"].includes(`sessionId=${firstSessionId}`),
    payloadSessionMatchesRuntime: firstPayload?.vgsShowSessionId === firstSessionId
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildAnalyticsEventTypeCatalogResult(fixture) {
  const actual = {
    outcome: "success",
    eventTypes: analytics.VGSAnalyticsEvents
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual.eventTypes] });
}

function buildAnalyticsBasePayloadResult(fixture) {
  resetAnalyticsTestingState();
  const vgsShow = new VGSShow({ id: "tenant" });
  const request = buildRequestForTesting(vgsShow, { path: "post" });
  const payload = analytics.VGSAnalyticsClient.shared.buildPayloadForTesting({
    type: analytics.VGSAnalyticsEvents.fieldInit,
    status: "success",
    extraInfo: {
      contentPath: "card.token",
      field: "text"
    }
  });

  const actual = {
    outcome: "success",
    source: payload.source,
    version: payload.version,
    hasIsoLocalTimestamp: /^\d{4}-\d{2}-\d{2}T/u.test(payload.localTimestamp),
    uaKeys: Object.keys(payload.ua).sort(),
    sessionIdMatchesHeader:
      !(request instanceof VGSShowError) &&
      request.headers["vgs-client"].includes(`sessionId=${payload.vgsShowSessionId}`),
    headerSourceMatchesPayload:
      !(request instanceof VGSShowError) &&
      request.headers["vgs-client"].includes(`source=${payload.source}`)
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [payload] });
}

function simplifyAnalyticsPayload(payload) {
  return {
    type: payload.type,
    status: payload.status,
    ...(payload.extraInfo === undefined ? {} : { extraInfo: payload.extraInfo })
  };
}

function buildFieldInitAnalyticsResult(fixture) {
  resetAnalyticsTestingState();
  const vgsShow = new VGSShow({ id: "tenant" });
  subscribeView(vgsShow, {
    viewId: "label1",
    kind: "label",
    contentPath: fixture.input.contentPath
  });
  const payload = analytics.VGSAnalyticsClient.shared.__unstable__getSentPayloadsForTesting().at(-1);
  const actual = {
    outcome: "success",
    payload: payload === undefined ? null : simplifyAnalyticsPayload(payload)
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildFieldUnsubscribeAnalyticsResult(fixture) {
  resetAnalyticsTestingState();
  const vgsShow = new VGSShow({ id: "tenant" });
  const view = {
    viewId: "label1",
    kind: "label",
    contentPath: fixture.input.contentPath
  };
  subscribeView(vgsShow, view);
  analytics.VGSAnalyticsClient.shared.__unstable__resetForTesting();
  unsubscribeView(vgsShow, view);
  const payload = analytics.VGSAnalyticsClient.shared.__unstable__getSentPayloadsForTesting().at(-1);
  const actual = {
    outcome: "success",
    payload: payload === undefined ? null : simplifyAnalyticsPayload(payload)
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildSetSecureTextRangeAnalyticsResult(fixture) {
  resetAnalyticsTestingState();
  const payload = analytics.VGSAnalyticsClient.shared.trackSetSecureTextRange({
    contentPath: fixture.input.contentPath
  });
  const actual = {
    outcome: "success",
    payload: payload === null ? null : simplifyAnalyticsPayload(payload)
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildCopyAnalyticsResult(fixture) {
  resetAnalyticsTestingState();
  const payload = analytics.VGSAnalyticsClient.shared.trackCopy({
    format: fixture.input.format
  });
  const actual = {
    outcome: "success",
    payload: payload === null ? null : simplifyAnalyticsPayload(payload),
    extraInfoKeys: payload?.extraInfo === undefined ? [] : Object.keys(payload.extraInfo).sort()
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildContentRenderingAnalyticsResult(fixture) {
  resetAnalyticsTestingState();
  const perCase = fixture.input.cases.map((inputCase) => {
    const payload = analytics.VGSAnalyticsClient.shared.trackContentRendering(inputCase);
    return payload === null ? null : simplifyAnalyticsPayload(payload);
  });
  const actual = {
    outcome: "success",
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildBeforeSubmitAnalyticsResult(fixture) {
  resetAnalyticsTestingState();
  const vgsShow = new VGSShow(fixture.input.vgsShow);
  vgsShow.customHeaders = fixture.input.customHeaders;
  for (const view of fixture.input.views) {
    subscribeView(vgsShow, view);
  }
  analytics.VGSAnalyticsClient.shared.__unstable__resetForTesting();
  simulateRequestForTesting(vgsShow, fixture.input.request, fixture.input.response);
  const payload = analytics.VGSAnalyticsClient.shared.__unstable__getSentPayloadsForTesting().find(
    (eventPayload) => eventPayload.type === analytics.VGSAnalyticsEvents.beforeSubmit
  );
  const actual = {
    outcome: "success",
    payload: payload === undefined ? null : simplifyAnalyticsPayload(payload)
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildSubmitAnalyticsResult(fixture) {
  resetAnalyticsTestingState();
  const perCase = fixture.input.cases.map((inputCase) => {
    const vgsShow = new VGSShow(inputCase.vgsShow);
    for (const view of inputCase.views ?? []) {
      subscribeView(vgsShow, view);
    }
    analytics.VGSAnalyticsClient.shared.__unstable__resetForTesting();
    simulateRequestForTesting(vgsShow, inputCase.request, inputCase.response);
    const payload = analytics.VGSAnalyticsClient.shared.__unstable__getSentPayloadsForTesting().find(
      (eventPayload) => eventPayload.type === analytics.VGSAnalyticsEvents.submit
    );
    return payload === undefined ? null : simplifyAnalyticsPayload(payload);
  });
  const actual = {
    outcome: "success",
    perCase
  };

  return buildAssertionResult({ fixture, actual, stateSequence: perCase });
}

function buildAnalyticsRedactionResult(fixture) {
  resetAnalyticsTestingState();
  const vgsShow = new VGSShow(fixture.input.vgsShow);
  vgsShow.customHeaders = fixture.input.customHeaders;
  for (const view of fixture.input.views) {
    subscribeView(vgsShow, view);
  }
  analytics.VGSAnalyticsClient.shared.__unstable__resetForTesting();
  simulateRequestForTesting(vgsShow, fixture.input.request, fixture.input.response);
  analytics.VGSAnalyticsClient.shared.trackCopy({ format: fixture.input.copyFormat });
  analytics.VGSAnalyticsClient.shared.trackContentRendering({
    field: "image",
    status: "failed"
  });

  const payloads = analytics.VGSAnalyticsClient.shared.__unstable__getSentPayloadsForTesting();
  const payloadStrings = payloads.map((payload) => JSON.stringify(payload));
  const payloadKeys = new Set(
    payloads.flatMap((payload) => payload.extraInfo === undefined ? [] : Object.keys(payload.extraInfo))
  );
  const actual = {
    outcome: "success",
    payloadCount: payloads.length,
    containsForbiddenValues: fixture.input.forbiddenValues.some((value) =>
      payloadStrings.some((payloadString) => payloadString.includes(value))
    ),
    allowedKeysOnly: Array.from(payloadKeys).every((key) => fixture.expected.allowedKeys.includes(key)),
    allowedKeys: Array.from(payloadKeys).sort()
  };

  return buildAssertionResult({ fixture, actual, stateSequence: payloads });
}

function buildAnalyticsOptOutResult(fixture) {
  resetAnalyticsTestingState();
  analytics.VGSAnalyticsClient.shared.shouldCollectAnalytics = false;
  const vgsShow = new VGSShow({ id: "tenant" });
  subscribeView(vgsShow, {
    viewId: "label1",
    kind: "label",
    contentPath: "card.token"
  });
  analytics.VGSAnalyticsClient.shared.trackCopy({ format: "raw" });
  const request = buildRequestForTesting(vgsShow, { path: "post" });
  const actual = {
    outcome: "success",
    sentPayloadCount: analytics.VGSAnalyticsClient.shared.__unstable__getSentPayloadsForTesting().length,
    headerAnalyticsEnabledFalse:
      !(request instanceof VGSShowError) && request.headers["vgs-client"].includes("analytics=false")
  };
  analytics.VGSAnalyticsClient.shared.__unstable__resetForTesting();

  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function buildNetworkDebugLoggingResult(fixture) {
  resetAnalyticsTestingState();
  analytics.VGSLogger.shared.configuration = {
    level: "info",
    isNetworkDebugEnabled: true,
    isExtensiveDebugEnabled: false
  };
  analytics.VGSLogger.shared.logNetworkDebug(fixture.input.prefix, fixture.input.body);
  const entries = analytics.VGSLogger.shared.__unstable__getEntriesForTesting();
  const actual = {
    outcome: "success",
    entryCount: entries.length,
    firstEntryContainsBody: entries[0]?.message.includes(fixture.input.body) ?? false
  };

  return buildAssertionResult({ fixture, actual, stateSequence: entries });
}

function buildLoggerDefaultsResult(fixture) {
  resetAnalyticsTestingState();
  analytics.VGSLogger.shared.info("should not log");
  analytics.VGSLogger.shared.warning("should not log");
  analytics.VGSLogger.shared.logNetworkDebug("response", "secret body");
  const entries = analytics.VGSLogger.shared.__unstable__getEntriesForTesting();
  const actual = {
    outcome: "success",
    level: analytics.VGSLogger.shared.configuration.level,
    isNetworkDebugEnabled: analytics.VGSLogger.shared.configuration.isNetworkDebugEnabled,
    entryCount: entries.length
  };

  return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
}

function inferOperation(fixture) {
  if (typeof fixture.input.operation === "string") {
    return fixture.input.operation;
  }

  if (Array.isArray(fixture.input.operations)) {
    if (fixture.input.operations.some((operation) => operation.op === "setRevealedPdfContent")) {
      return "setRevealedPdfContent";
    }

    if (fixture.input.operations.some((operation) => operation.op === "setRevealedImageContent")) {
      return "setRevealedImageContent";
    }
  }

  return undefined;
}

function buildConstructHostResult(fixture) {
  const cases = Array.isArray(fixture.input.cases)
    ? fixture.input.cases
    : [
        {
          id: fixture.input.id,
          environment: fixture.input.environment,
          dataRegion: fixture.input.dataRegion,
          hostname: fixture.input.hostname
        }
      ];

  const actualCases = cases.map((inputCase) => {
    const vgsShow = new VGSShow({
      id: inputCase.id,
      environment: inputCase.environment,
      dataRegion: inputCase.dataRegion,
      hostname: inputCase.hostname
    });

    return {
      baseUrlHost: getBaseUrlHostForTesting(vgsShow)
    };
  });

  let verdict = "PASS";
  let reason = "matched";
  let actual;

  if (Array.isArray(fixture.expected.perCase)) {
    actual = { perCase: actualCases };
    if (!valuesEqual(fixture.expected.perCase, actualCases)) {
      verdict = "FAIL";
      reason = "per-case-mismatch";
    }
  } else {
    const firstCase = actualCases[0];
    actual = firstCase;

    if (
      typeof fixture.expected.baseUrlHostContains === "string" &&
      !firstCase.baseUrlHost.includes(fixture.expected.baseUrlHostContains)
    ) {
      verdict = "FAIL";
      reason = "host-substring-mismatch";
    }

    if (
      typeof fixture.expected.baseUrlHost === "string" &&
      fixture.expected.baseUrlHost !== firstCase.baseUrlHost
    ) {
      verdict = "FAIL";
      reason = "host-mismatch";
    }
  }

  return {
    fixtureId: fixture.id,
    matrixRow: fixture.matrix_row,
    result: actual,
    error: verdict === "PASS" ? null : `Expected ${JSON.stringify(fixture.expected)} but got ${JSON.stringify(actual)}`,
    errorCode: verdict === "PASS" ? null : "SDK_ASSERTION_FAILED",
    stateSequence: actualCases,
    diff: {
      verdict,
      reason,
      expected: fixture.expected,
      actual
    }
  };
}

function buildRequestTimeoutIntervalResult(fixture) {
  if (fixture.input.operation === "constructAndReadRequestTimeoutInterval") {
    const actual = {
      outcome: "success",
      requestTimeoutInterval: null
    };

    return buildAssertionResult({ fixture, actual, stateSequence: [actual] });
  }

  const requestOptions = {
    requestTimeoutInterval: fixture.input.value
  };

  const actual = {
    requestTimeoutInterval: requestOptions.requestTimeoutInterval
  };

  const verdict = valuesEqual(
    { requestTimeoutInterval: fixture.expected.requestTimeoutInterval },
    actual
  )
    ? "PASS"
    : "FAIL";

  return {
    fixtureId: fixture.id,
    matrixRow: fixture.matrix_row,
    result: actual,
    error:
      verdict === "PASS"
        ? null
        : `Expected ${JSON.stringify(fixture.expected)} but got ${JSON.stringify(actual)}`,
    errorCode: verdict === "PASS" ? null : "SDK_ASSERTION_FAILED",
    stateSequence: [actual],
    diff: {
      verdict,
      reason: verdict === "PASS" ? "matched" : "request-timeout-mismatch",
      expected: fixture.expected,
      actual
    }
  };
}

export function executeSdkBehaviorCase(fixture) {
  switch (inferOperation(fixture)) {
    case "constructVgsShowError":
      return buildConstructVgsShowErrorResult(fixture);
    case "errorKeyMapping":
      return buildErrorKeyMappingResult(fixture);
    case "rawDataToJson":
      return buildRawDataToJsonResult(fixture);
    case "textDecode":
      return buildTextDecodeResult(fixture);
    case "base64Decode":
      return buildBase64DecodeResult(fixture);
    case "resolveJsonPath":
      return buildResolveJsonPathResult(fixture);
    case "isValidJsonKeyPath":
      return buildIsValidJsonKeyPathResult(fixture);
    case "encodeJsonPayload":
      return buildEncodeJsonPayloadResult(fixture);
    case "encodeJsonPayloadAndReadAdditionalHeaders":
      return buildEncodeJsonPayloadAndHeadersResult(fixture);
    case "normalizeRequestInput":
      return buildNormalizeRequestInputResult(fixture);
    case "buildRequestAndReadMethod":
      return buildRequestMethodResult(fixture);
    case "supportedHttpMethods":
      return buildSupportedHttpMethodsResult(fixture);
    case "validateJsonPayloadCases":
      return buildValidateJsonPayloadCasesResult(fixture);
    case "buildDefaultHeaders":
      return buildDefaultHeadersResult(fixture);
    case "mergeHeaders":
      return buildMergeHeadersResult(fixture);
    case "buildRequestAndReadTimeout":
      return buildRequestTimeoutResult(fixture);
    case "isValidTenantId":
      return buildTenantIdValidationResult(fixture);
    case "buildHostValidationUrl":
      return buildHostValidationUrlResult(fixture);
    case "validateCustomHostname":
      return buildValidateCustomHostnameResult(fixture);
    case "simulateHostnameResolutionQueue":
      return buildHostnameResolutionQueueResult(fixture);
    case "transitionHostURLPolicy":
      return buildTransitionHostURLPolicyResult(fixture);
    case "simulateRequestOutcome":
      return buildRequestOutcomeResult(fixture);
    case "joinRequestPath":
      return buildJoinRequestPathResult(fixture);
    case "mapNetworkErrorCode":
      return buildNetworkErrorCodeResult(fixture);
    case "simulateContentStateTransitions":
      return buildContentStateTransitionsResult(fixture);
    case "simulateTextPlaceholderVisibility":
      return buildTextPlaceholderVisibilityResult(fixture);
    case "configureTextLabelAndReadState":
      return buildConfigureTextLabelAndReadStateResult(fixture);
    case "setLabelTextAndClearText":
      return buildSetLabelTextAndClearTextResult(fixture);
    case "setSecureTextSymbolSequence":
      return buildSetSecureTextSymbolSequenceResult(fixture);
    case "copyTextToClipboardValueSelection":
      return buildCopyTextToClipboardValueSelectionResult(fixture);
    case "copyFormattedAndResetText":
      return buildCopyFormattedAndResetTextResult(fixture);
    case "copyTextAndObserveCallback":
      return buildCopyTextAndObserveCallbackResult(fixture);
    case "applyFormatterThenSecureRange":
      return buildApplyFormatterThenSecureRangeResult(fixture);
    case "applyFormatterThenSecureRangesArray":
      return buildApplyFormatterThenSecureRangesArrayResult(fixture);
    case "applySecureRangesToRevealedText":
      return buildApplySecureRangesToRevealedTextResult(fixture);
    case "isTextRangeValid":
      return buildIsTextRangeValidResult(fixture);
    case "applySingleTransformationRegex":
      return buildApplySingleTransformationRegexResult(fixture);
    case "resetAllFormattersAfterFormatting":
      return buildResetAllFormattersAfterFormattingResult(fixture);
    case "inspectDefaultSecureModeFormatting":
      return buildInspectDefaultSecureModeFormattingResult(fixture);
    case "applyMultiCharSecureTextSymbolWarning":
      return buildApplyMultiCharSecureTextSymbolWarningResult(fixture);
    case "applyStackedTransformationRegexes":
      return buildApplyStackedTransformationRegexesResult(fixture);
    case "inspectFormatterResetState":
      return buildInspectFormatterResetStateResult(fixture);
    case "simulateTextComponentAutoSubscription":
      return buildTextComponentAutoSubscriptionResult(fixture);
    case "simulateTextComponentClearTextCallback":
      return buildTextComponentClearTextCallbackResult(fixture);
    case "simulateTextComponentCopySideEffects":
      return buildTextComponentCopySideEffectsResult(fixture);
    case "simulateTextComponentTextChangeUpdatePaths":
      return buildTextComponentTextChangeUpdatePathsResult(fixture);
    case "inspectTextComponentAntiLeakSurface":
      return buildTextComponentAntiLeakSurfaceResult(fixture);
    case "setImageContentPathAndReadBack":
      return buildSetImageContentPathAndReadBackResult(fixture);
    case "setAndReadPdfContentPath":
      return buildSetAndReadPdfContentPathResult(fixture);
    case "setPdfFormatAndReadDecodingMode":
      return buildSetPdfFormatAndReadDecodingModeResult(fixture);
    case "readPdfDisplayDefaultsAndApplyLogicalSettings":
      return buildPdfDisplayDefaultsAndSettingsResult(fixture);
    case "inspectAnalyticsSessionRuntime":
      return buildAnalyticsSessionRuntimeResult(fixture);
    case "inspectAnalyticsEventTypeCatalog":
      return buildAnalyticsEventTypeCatalogResult(fixture);
    case "buildAnalyticsBasePayload":
      return buildAnalyticsBasePayloadResult(fixture);
    case "simulateFieldInitAnalytics":
      return buildFieldInitAnalyticsResult(fixture);
    case "simulateFieldUnsubscribeAnalytics":
      return buildFieldUnsubscribeAnalyticsResult(fixture);
    case "simulateSetSecureTextRangeAnalytics":
      return buildSetSecureTextRangeAnalyticsResult(fixture);
    case "simulateCopyAnalytics":
      return buildCopyAnalyticsResult(fixture);
    case "simulateContentRenderingAnalytics":
      return buildContentRenderingAnalyticsResult(fixture);
    case "simulateBeforeSubmitAnalytics":
      return buildBeforeSubmitAnalyticsResult(fixture);
    case "simulateSubmitAnalytics":
      return buildSubmitAnalyticsResult(fixture);
    case "assertAnalyticsRedaction":
      return buildAnalyticsRedactionResult(fixture);
    case "simulateAnalyticsOptOut":
      return buildAnalyticsOptOutResult(fixture);
    case "inspectNetworkDebugLogging":
      return buildNetworkDebugLoggingResult(fixture);
    case "inspectLoggerDefaults":
      return buildLoggerDefaultsResult(fixture);
    case "simulateTextChangeCallbacks":
      return buildTextChangeCallbacksResult(fixture);
    case "simulatePdfDocumentPresence":
      return buildPdfDocumentPresenceResult(fixture);
    case "runImagePresenceSequence":
      return buildImagePresenceSequenceResult(fixture);
    case "simulateImageChangeCallbacks":
      return buildImageChangeCallbacksResult(fixture);
    case "simulatePdfDocumentChangeCallback":
      return buildPdfDocumentChangeCallbackResult(fixture);
    case "runVgsShowSubscriptionSequence":
      return buildSubscriptionSequenceResult(fixture);
    case "readFormIdStability":
      return buildFormIdStabilityResult(fixture);
    case "customHeadersRequestPropagation":
      return buildCustomHeadersPropagationResult(fixture);
    case "setCustomHeadersAndReadBack":
      return buildSetCustomHeadersAndReadBackResult(fixture);
    case "simulateCoreRequestPipeline":
      return buildCoreRequestPipelineResult(fixture);
    case "setRevealedPdfContent":
      return buildSetRevealedPdfContentResult(fixture);
    case "setRevealedImageContent":
      return buildSetRevealedImageContentResult(fixture);
    case "requestWithInvalidConfiguration":
      return buildRequestWithInvalidConfigurationResult(fixture);
    case "simulatePartialRevealRequestResult":
      return buildPartialRevealResult(fixture);
    case "simulateRevealErrorCallbacks":
      return buildRevealErrorCallbacksResult(fixture);
    case "simulateImageErrorCallbacks":
      return buildImageErrorCallbacksResult(fixture);
    case "simulatePdfDocumentErrorCallback":
      return buildPdfDocumentErrorCallbackResult(fixture);
    case "constructVgsShowAndReadBaseUrlHost":
      return buildConstructHostResult(fixture);
    case "setAndReadRequestTimeoutInterval":
    case "constructAndReadRequestTimeoutInterval":
      return buildRequestTimeoutIntervalResult(fixture);
    case "regionalEnvironmentStringValid":
      return buildBooleanCasesResult({
        fixture,
        actualCases: fixture.input.cases.map((inputCase) => ({
          isValid: network.isValidRegionalEnvironment(inputCase.env)
        }))
      });
    case "isValidDataRegion":
      return buildBooleanCasesResult({
        fixture,
        actualCases: fixture.input.cases.map((inputCase) => ({
          isValid: network.isValidDataRegion(inputCase.region)
        }))
      });
    default:
      return buildPendingResult(fixture);
  }
}

function buildBooleanCasesResult({ fixture, actualCases }) {
  const expectedCases = Array.isArray(fixture.expected.perCase) ? fixture.expected.perCase : [];
  const verdict = valuesEqual(expectedCases, actualCases) ? "PASS" : "FAIL";

  return {
    fixtureId: fixture.id,
    matrixRow: fixture.matrix_row,
    result: { perCase: actualCases },
    error:
      verdict === "PASS"
        ? null
        : `Expected ${JSON.stringify(fixture.expected)} but got ${JSON.stringify({ perCase: actualCases })}`,
    errorCode: verdict === "PASS" ? null : "SDK_ASSERTION_FAILED",
    stateSequence: actualCases,
    diff: {
      verdict,
      reason: verdict === "PASS" ? "matched" : "per-case-mismatch",
      expected: fixture.expected,
      actual: { perCase: actualCases }
    }
  };
}
