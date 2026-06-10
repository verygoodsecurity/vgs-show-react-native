import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as sdk from "../lib/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

describe("public SDK API", () => {
  test("does not export internal reveal or request helpers from the package root", () => {
    expect(Object.keys(sdk)).not.toEqual(
      expect.arrayContaining([
        "buildRequest",
        "buildVGSShowRequestForTesting",
        "simulateVGSShowRequestForTesting",
        "subscribeVGSShowView",
        "unsubscribeVGSShowView",
        "getSubscribedVGSShowViews",
        "VGSShowLabelController",
        "VGSShowImageController",
        "VGSShowPdfController",
        "__unstable__createVGSShowLabelControllerForTesting",
        "__unstable__createVGSShowImageControllerForTesting",
        "__unstable__createVGSShowPdfControllerForTesting"
      ])
    );
  });

  test("VGSShow instances do not expose subscription or request-builder hooks", () => {
    const vgsShow = new sdk.VGSShow({ id: "tenant" });

    expect("subscribe" in vgsShow).toBe(false);
    expect("unsubscribe" in vgsShow).toBe(false);
    expect("unsubscribeAllViews" in vgsShow).toBe(false);
    expect("subscribedViews" in vgsShow).toBe(false);
    expect("subscribedLabels" in vgsShow).toBe(false);
    expect("subscribedPDFViews" in vgsShow).toBe(false);
    expect("__unstable__buildRequestForTesting" in vgsShow).toBe(false);
    expect("__unstable__simulateRequestForTesting" in vgsShow).toBe(false);
  });

  test("root declarations omit sensitive internal types and helpers", () => {
    const rootDeclarations = readFileSync(path.join(repoRoot, "lib/index.d.ts"), "utf8");

    expect(rootDeclarations).not.toMatch(/VGSShowSubscribableView/u);
    expect(rootDeclarations).not.toMatch(/VGSShowDecodingResult/u);
    expect(rootDeclarations).not.toMatch(/BuiltRequest/u);
    expect(rootDeclarations).not.toMatch(/buildRequest/u);
    expect(rootDeclarations).not.toMatch(/VGSShowLabelController/u);
    expect(rootDeclarations).not.toMatch(/__unstable__/u);
  });

  test("public docs are generated from the package root only", () => {
    const typedocConfig = JSON.parse(readFileSync(path.join(repoRoot, "typedoc.json"), "utf8"));

    expect(typedocConfig.entryPoints).toEqual(["src/index.ts"]);
    expect(typedocConfig.entryPoints).not.toEqual(
      expect.arrayContaining([
        "src/core/index.ts",
        "src/components/index.ts",
        "src/types/index.ts"
      ])
    );
  });

  test("rendered components use React Native primitives instead of string host names", () => {
    const labelBundle = readFileSync(path.join(repoRoot, "lib/components/VGSShowLabel.js"), "utf8");
    const imageBundle = readFileSync(path.join(repoRoot, "lib/components/VGSShowImage.js"), "utf8");
    const pdfBundle = readFileSync(path.join(repoRoot, "lib/components/VGSShowPdf.js"), "utf8");

    expect(labelBundle).toMatch(/import \{ Text \} from "react-native";/u);
    expect(labelBundle).not.toMatch(/createElement\("Text"/u);
    expect(imageBundle).toMatch(/import \{ Image \} from "react-native";/u);
    expect(imageBundle).not.toMatch(/createElement\("Image"/u);
    expect(pdfBundle).toMatch(/import \{ View \} from "react-native";/u);
    expect(pdfBundle).toMatch(/import Pdf from "react-native-pdf";/u);
    expect(pdfBundle).not.toMatch(/createElement\("View"/u);
  });
});
