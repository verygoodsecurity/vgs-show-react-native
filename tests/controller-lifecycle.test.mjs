import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  __unstable__createVGSShowImageControllerForTesting,
  __unstable__createVGSShowLabelControllerForTesting,
  __unstable__createVGSShowPdfControllerForTesting
} from "../lib/components/index.js";
import {
  VGSShow,
  getSubscribedVGSShowViews
} from "../lib/core/VGSShow.js";
import { VGSShowError } from "../lib/core/errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

describe("component controller lifecycle", () => {
  test("controllers can defer VGSShow subscriptions until mount", () => {
    const vgsShow = new VGSShow({ id: "tenant" });
    const label = __unstable__createVGSShowLabelControllerForTesting({
      vgsShow,
      contentPath: "card.number",
      autoMount: false
    });
    const image = __unstable__createVGSShowImageControllerForTesting({
      vgsShow,
      contentPath: "card.image",
      autoMount: false
    });
    const pdf = __unstable__createVGSShowPdfControllerForTesting({
      vgsShow,
      contentPath: "card.statement",
      autoMount: false
    });

    expect(getSubscribedVGSShowViews(vgsShow)).toHaveLength(0);
    expect(label.snapshot.isMounted).toBe(false);
    expect(image.snapshot.isMounted).toBe(false);
    expect(pdf.snapshot.isMounted).toBe(false);

    label.mount();
    image.mount();
    pdf.mount();

    expect(getSubscribedVGSShowViews(vgsShow).map((view) => view.kind)).toEqual([
      "label",
      "image",
      "pdf"
    ]);

    label.mount();
    image.mount();
    pdf.mount();

    expect(getSubscribedVGSShowViews(vgsShow)).toHaveLength(3);

    label.unmount();
    image.unmount();
    pdf.unmount();

    expect(getSubscribedVGSShowViews(vgsShow)).toHaveLength(0);
  });

  test("React wrappers construct controllers with deferred mount", () => {
    const componentSources = [
      "src/components/VGSShowLabel.tsx",
      "src/components/VGSShowImage.tsx",
      "src/components/VGSShowPdf.tsx"
    ].map((sourcePath) => readFileSync(path.join(repoRoot, sourcePath), "utf8"));

    for (const source of componentSources) {
      expect(source).toMatch(/autoMount: false/u);
      expect(source).toMatch(/controller\?\.mount\(\)/u);
    }

    expect(componentSources[1]).toMatch(/onStateChange: \(\) => \{\s*setVersion\(\(value\) => value \+ 1\);/u);
    expect(componentSources[2]).toMatch(/onStateChange: \(\) => \{\s*setVersion\(\(value\) => value \+ 1\);/u);
  });

  test("Image controller notifies React wrapper state updates for loading, reveal, clear, and failure", () => {
    const vgsShow = new VGSShow({ id: "tenant" });
    const stateChanges = [];
    const controller = __unstable__createVGSShowImageControllerForTesting({
      vgsShow,
      contentPath: "card.image",
      renderValidator: () => true,
      onStateChange: () => {
        stateChanges.push(controller.snapshot.state);
      }
    });

    controller.handleLoading();
    controller.handleDecodingResult({
      kind: "success",
      content: {
        kind: "rawData",
        dataBase64: "aW1hZ2VEYXRh"
      }
    });
    controller.ref.clear();
    controller.handleDecodingResult({
      kind: "failure",
      error: new VGSShowError("invalidImageData")
    });

    expect(stateChanges).toEqual(["loading", "revealed", "cleared", "failed"]);

    controller.unmount();
  });

  test("Image controller renders revealed bytes with concrete MIME type and caller style", () => {
    const vgsShow = new VGSShow({ id: "tenant" });
    const imageStyle = {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0
    };
    const imageBase64 = "iVBORw0KGgo=";
    const controller = __unstable__createVGSShowImageControllerForTesting({
      vgsShow,
      contentPath: "card.image",
      style: imageStyle
    });

    controller.handleDecodingResult({
      kind: "success",
      content: {
        kind: "rawData",
        dataBase64: imageBase64
      }
    });

    const renderedImage = controller.renderElement();
    expect(renderedImage.props.source).toEqual({
      uri: `data:image/png;base64,${imageBase64}`
    });
    expect(renderedImage.props.resizeMode).toBe("scaleAspectFit");
    expect(renderedImage.props.style).toBe(imageStyle);

    controller.ref.clear();

    const clearedImage = controller.renderElement();
    expect(clearedImage.props.source).toBeUndefined();
    expect(clearedImage.props.style).toBe(imageStyle);

    controller.unmount();
  });

  test("Image controller rejects unsupported image formats", () => {
    const vgsShow = new VGSShow({ id: "tenant" });
    const unsupportedImages = [
      {
        label: "gif",
        base64: "R0lGODlh"
      },
      {
        label: "webp",
        base64: "UklGRjAwMDBXRUJQ"
      }
    ];

    for (const unsupportedImage of unsupportedImages) {
      let callbackError = null;
      const controller = __unstable__createVGSShowImageControllerForTesting({
        vgsShow,
        contentPath: `card.${unsupportedImage.label}`,
        onImageError: (error) => {
          callbackError = error.toJSON();
        }
      });

      controller.handleDecodingResult({
        kind: "success",
        content: {
          kind: "rawData",
          dataBase64: unsupportedImage.base64
        }
      });

      expect(callbackError).toMatchObject({
        code: 1407,
        type: "invalidImageData"
      });
      expect(controller.ref.hasImage).toBe(false);

      controller.unmount();
    }
  });

  test("PDF controller notifies React wrapper state updates for loading, reveal, clear, and failure", () => {
    const vgsShow = new VGSShow({ id: "tenant" });
    const stateChanges = [];
    const controller = __unstable__createVGSShowPdfControllerForTesting({
      vgsShow,
      contentPath: "card.statement",
      renderValidator: () => true,
      onStateChange: () => {
        stateChanges.push(controller.snapshot.state);
      }
    });

    controller.handleLoading();
    controller.handleDecodingResult({
      kind: "success",
      content: {
        kind: "rawData",
        dataBase64: "JVBERi0xLjQK"
      }
    });
    controller.ref.clear();
    controller.handleDecodingResult({
      kind: "failure",
      error: new VGSShowError("invalidPDFData")
    });

    expect(stateChanges).toEqual(["loading", "revealed", "cleared", "failed"]);

    controller.unmount();
  });

  test("PDF controller resubscribes to a changed VGSShow instance", () => {
    const firstShow = new VGSShow({ id: "tenant" });
    const nextShow = new VGSShow({ id: "tenant" });
    const controller = __unstable__createVGSShowPdfControllerForTesting({
      vgsShow: firstShow,
      contentPath: "card.statement"
    });

    expect(getSubscribedVGSShowViews(firstShow).map((view) => view.kind)).toEqual(["pdf"]);
    expect(getSubscribedVGSShowViews(nextShow)).toHaveLength(0);

    controller.updateProps({
      vgsShow: nextShow,
      contentPath: "card.statement"
    });

    expect(getSubscribedVGSShowViews(firstShow)).toHaveLength(0);
    expect(getSubscribedVGSShowViews(nextShow).map((view) => view.kind)).toEqual(["pdf"]);

    controller.updateProps({
      vgsShow: nextShow,
      contentPath: "card.statement"
    });

    expect(getSubscribedVGSShowViews(nextShow)).toHaveLength(1);

    controller.unmount();
    expect(getSubscribedVGSShowViews(nextShow)).toHaveLength(0);
  });

  test("PDF controller keeps deferred mount when VGSShow changes before mount", () => {
    const firstShow = new VGSShow({ id: "tenant" });
    const nextShow = new VGSShow({ id: "tenant" });
    const controller = __unstable__createVGSShowPdfControllerForTesting({
      vgsShow: firstShow,
      contentPath: "card.statement",
      autoMount: false
    });

    controller.updateProps({
      vgsShow: nextShow,
      contentPath: "card.statement"
    });

    expect(getSubscribedVGSShowViews(firstShow)).toHaveLength(0);
    expect(getSubscribedVGSShowViews(nextShow)).toHaveLength(0);

    controller.mount();

    expect(getSubscribedVGSShowViews(firstShow)).toHaveLength(0);
    expect(getSubscribedVGSShowViews(nextShow).map((view) => view.kind)).toEqual(["pdf"]);

    controller.unmount();
  });

  test("PDF controller renders placeholder and document with caller style", () => {
    const vgsShow = new VGSShow({ id: "tenant" });
    const pdfStyle = {
      height: 360,
      width: "100%"
    };
    const controller = __unstable__createVGSShowPdfControllerForTesting({
      vgsShow,
      contentPath: "card.statement",
      pdfBackgroundColor: "#ffffff",
      style: pdfStyle,
      renderValidator: () => true
    });

    const placeholder = controller.renderElement();
    expect(placeholder.props.style).toEqual([{ backgroundColor: "#ffffff" }, pdfStyle]);
    expect(placeholder.props.hasDocument).toBe(false);

    controller.handleDecodingResult({
      kind: "success",
      content: {
        kind: "rawData",
        dataBase64: "JVBERi0xLjQK"
      }
    });

    const renderedDocument = controller.renderElement();
    expect(renderedDocument.props.source).toEqual({
      uri: "data:application/pdf;base64,JVBERi0xLjQK"
    });
    expect(renderedDocument.props.horizontal).toBe(false);
    expect(renderedDocument.props.trustAllCerts).toBe(false);
    expect(renderedDocument.props.style).toEqual([{ backgroundColor: "#ffffff" }, pdfStyle]);

    controller.ref.clear();

    const clearedDocument = controller.renderElement();
    expect(clearedDocument.props.source).toBeUndefined();
    expect(clearedDocument.props.hasDocument).toBe(false);
    expect(clearedDocument.props.style).toEqual([{ backgroundColor: "#ffffff" }, pdfStyle]);

    controller.unmount();
  });

  test("PDF renderer errors clear document state and emit safe invalidPDFData", () => {
    const vgsShow = new VGSShow({ id: "tenant" });
    let callbackError = null;
    const controller = __unstable__createVGSShowPdfControllerForTesting({
      vgsShow,
      contentPath: "card.statement",
      renderValidator: () => true,
      onDocumentError: (error) => {
        callbackError = error.toJSON();
      }
    });

    controller.handleDecodingResult({
      kind: "success",
      content: {
        kind: "rawData",
        dataBase64: "JVBERi0xLjQK"
      }
    });

    expect(controller.ref.hasDocument).toBe(true);

    const renderedDocument = controller.renderElement();
    renderedDocument.props.onError(new Error("native renderer failed at /private/tmp/document.pdf"));

    expect(controller.ref.hasDocument).toBe(false);
    expect(controller.snapshot.state).toBe("failed");
    expect(callbackError).toEqual({
      code: 1406,
      type: "invalidPDFData",
      message: "Cannot render PDF with invalid data",
      domain: "vgsshow.sdk"
    });

    const failedDocument = controller.renderElement();
    expect(failedDocument.props.source).toBeUndefined();
    expect(failedDocument.props.hasDocument).toBe(false);

    controller.unmount();
  });
});
