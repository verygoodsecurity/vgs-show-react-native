import {
  __unstable__createVGSShowLabelControllerForTesting
} from "../lib/components/index.js";
import { VGSShow } from "../lib/index.js";

function defineNavigator(value) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value
  });
}

describe("VGSShowLabel clipboard bridge", () => {
  test("writes transformed text through navigator.clipboard when available", () => {
    const previousNavigator = globalThis.navigator;
    let copiedText = null;

    defineNavigator({
      clipboard: {
        writeText(text) {
          copiedText = text;
        }
      }
    });

    const vgsShow = new VGSShow({ id: "vaultId" });
    const controller = __unstable__createVGSShowLabelControllerForTesting({
      vgsShow,
      contentPath: "json.payment_card_number"
    });

    controller.handleDecodingResult({
      kind: "success",
      content: {
        kind: "text",
        text: "4111111111111111"
      }
    });
    controller.addTransformationRegex({
      pattern: /(\d{4})(\d{4})(\d{4})(\d{4})/u,
      template: "$1 $2 $3 $4"
    });
    controller.ref.copyToClipboard({ format: "transformed" });

    expect(copiedText).toBe("4111 1111 1111 1111");

    controller.unmount();

    if (previousNavigator === undefined) {
      delete globalThis.navigator;
    } else {
      defineNavigator(previousNavigator);
    }
  });
});
