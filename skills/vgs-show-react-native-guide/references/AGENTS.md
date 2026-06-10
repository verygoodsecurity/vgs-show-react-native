# AGENTS.md

**SDK Version: 1.0.0**

Authoritative integration guide for autonomous engineering agents adding **VGS Show React Native SDK (`@vgs/show-react-native`)** to downstream React Native apps to reveal previously tokenized or aliased data (text, images, PDFs) securely.

Documentation Source of Truth Across Versions
- The canonical durable instruction source for this public integration skill lives at `skills/vgs-show-react-native-guide/references/AGENTS.md`.
- The single public AI skill entrypoint lives at `skills/vgs-show-react-native-guide/SKILL.md`. It routes task type and version selection, then defers SDK rules and invariants to this file.
- The installed skill bundle must ship `skills/vgs-show-react-native-guide/references/AGENTS.md` so standalone skill installs receive this policy file automatically.
- For the public skill and public documentation workflows, the canonical repository for tags and versioned docs is `https://github.com/verygoodsecurity/vgs-show-react-native`.
- When the SDK version used by the target project can be determined, agents MUST prefer the durable guidance snapshot from the matching Git tag in the public `verygoodsecurity/vgs-show-react-native` repository before giving version-sensitive guidance.
- If an exact tag is unavailable, agents MUST use the nearest compatible tag and clearly disclose the mismatch before giving version-sensitive guidance.
- Private forks or internal mirrors do not override the public repository as the source of truth for public skill guidance.
- If the SDK is not installed or its version cannot be determined, agents SHOULD use the default-branch copy of this file and say that latest guidance is being used.

Scope & Constraints
- ONLY covers public, non-deprecated APIs verified in current sources.
- Focus: deterministic, auditable steps for installation, reveal flow setup, masking, copy behavior, image/PDF rendering, error handling, logging hygiene, testing, hardening, and upgrades.
- Excludes VGS Collect guidance. This file is for the VGS Show display pipeline only.

Success Criteria (Every Task Must Honor)
1. No sensitive raw revealed data persisted outside SDK-managed components or copied to logs, analytics, crash reports, screenshots, or app callbacks.
2. All reveal components have a non-empty `contentPath` before requests.
3. Reveal requests are not executed with zero subscribed components unless intentionally validated.
4. Error handling maps SDK/network errors to safe user messages.
5. Custom headers are intentional and never logged with their values.
6. Only documented package-root exports from `@vgs/show-react-native` are used.
7. Text masking and copy behavior are explicitly selected for sensitive fields.
8. Tests cover successful multi-component reveal, missing path handling, invalid media handling, secure masking, copy behavior when used, and request failure paths.
9. Build and tests are reproducible; vault ID, environment, route, and request shape come from configuration, not end-user input.
10. Example values are synthetic and never use real customer data, payment data, tokens, or production secrets.

---
## 1. Core Mental Model

`VGSShow` is a reveal orchestrator bound to one vault ID and environment. React components (`VGSShowLabel`, `VGSShowImage`, `VGSShowPdf`) subscribe to one `VGSShow` instance through their `vgsShow` prop. Each component declares a `contentPath`, a dot-separated response path used to extract one field from the reveal response.

A single `vgsShow.request(...)` fetches JSON once, decodes each subscribed component's `contentPath`, and pushes content into SDK-managed component state. The request promise resolves with HTTP status only; revealed text, media bytes, response bodies, hashes, and lengths are not returned.

Data Flow
1. Configure one `VGSShow` instance for the screen or reveal flow.
2. Render `VGSShowLabel`, `VGSShowImage`, and/or `VGSShowPdf` with explicit `contentPath` values.
3. Call `vgsShow.request(...)`.
4. SDK fetches JSON, decodes fields, and updates subscribed components.
5. Use refs only for documented actions and logical state.
6. Clear component state when the screen no longer needs displayed data.

Security Boundary: Only SDK-managed components and controllers hold raw revealed values. Application code must avoid storing or logging them.

---
## 2. Public API Surface

Package-root exports:
- Core: `VGSShow`
- Components: `VGSShowLabel`, `VGSShowImage`, `VGSShowPdf`
- Errors: `VGSShowError`, `VGS_SHOW_ERROR_DOMAIN`, `VGSErrorCatalog`, `codeForType`, `errorKeyForType`, `messageForType`
- Logging: `VGSLogger`
- Public types: `VGSShowOptions`, `VGSShowEnvironment`, `VGSShowRequestInput`, `VGSShowRequestOptions`, `VGSShowRequestSuccess`, `VGSShowLabelProps`, `VGSShowLabelRef`, `VGSShowImageProps`, `VGSShowImageRef`, `VGSShowPdfProps`, `VGSShowPdfRef`, text formatter/range types, image/PDF display option types, and error/logging types

Do not import from `@vgs/show-react-native/src/...`, `lib/...`, controller testing helpers, or internal modules. Do not rely on `__unstable__` exports.

---
## 3. Installation

Install the package with the customer's package manager:

```bash
npm install @vgs/show-react-native
```

Peer dependency floor for SDK 1.0.0:
- `react >= 19.1.0`
- `react-native >= 0.81.4`

PDF reveal uses native renderer dependencies bundled by the SDK. Rebuild the
native app after installation so React Native can link them.

Supported platforms:
- iOS
- Android

Web is intentionally unsupported. Do not add web fallbacks unless a future SDK version documents them.

---
## 4. Environment & Initialization

Inputs:
- `id`: VGS vault identifier
- `environment`: `"sandbox"`, `"live"`, or a regional live environment such as `"live-eu1"`
- `dataRegion`: optional regional suffix for regional vault routing when using `"sandbox"` or `"live"`
- `hostname`: optional custom hostname

Use one `VGSShow` instance per screen or reveal flow:

```tsx
const showRef = React.useRef<VGSShow | null>(null);

if (showRef.current === null) {
  showRef.current = new VGSShow({
    id: config.vaultId,
    environment: "sandbox"
  });
}

const vgsShow = showRef.current;
```

Hardening:
- Use build-time or secure runtime configuration for vault ID, environment, data region, hostname, and route.
- Do not derive vault routing from end-user input.
- Keep production vault IDs, route details, tokens, and customer records out of examples, logs, screenshots, and test fixtures.

---
## 5. Component Subscription Lifecycle

React components subscribe when mounted and unsubscribe when unmounted. Application code should pass the same `VGSShow` instance to every component that should update from one reveal response.

Sequence:
1. Create or reuse the screen's `VGSShow` instance.
2. Render components with non-empty `contentPath` values.
3. Configure masking, placeholders, refs, callbacks, and media display props.
4. Execute `vgsShow.request(...)`.
5. Use component callbacks for logical state changes only.
6. Use `clearText()` or `clear()` when displayed content should be removed.

Validation hooks:
- Before request, ensure at least one component is mounted for the target flow.
- Ensure every component has a non-empty `contentPath`.
- Avoid changing `contentPath` while a request is in flight unless the UI explicitly coordinates that state change.

---
## 6. VGSShowLabel (Text Reveal)

Capabilities:
- `contentPath`: required dot-separated response path.
- `placeholder` and `placeholderStyle`: displayed before reveal, after clear, or when no text is available.
- `isSecureText`: masks displayed text.
- `secureTextSymbol`: mask symbol.
- `onTextChange`: notification only; revealed text is not passed out.
- `onCopyTextFinish`: reports copy format only.
- `onRevealError`: receives `VGSShowError`.
- Ref actions: `clearText()`, `copyToClipboard({ format })`, `setSecureText(...)`, `addTransformationRegex(...)`, `resetAllFormatters()`.

Example:

```tsx
const labelRef = React.useRef<VGSShowLabelRef | null>(null);

<>
  <VGSShowLabel
    ref={labelRef}
    vgsShow={vgsShow}
    contentPath="card.number"
    placeholder="**** **** **** ****"
    isSecureText={true}
    onRevealError={(error) => {
      setStatus(error.type === "fieldNotFound" ? "Card number unavailable" : "Card number reveal failed");
    }}
  />

  <VGSShowLabel
    vgsShow={vgsShow}
    contentPath="card.expirationDate"
    placeholder="**/**"
    isSecureText={true}
    onRevealError={(error) => {
      setStatus(error.type === "fieldNotFound" ? "Expiration date unavailable" : "Expiration date reveal failed");
    }}
  />
</>;
```

Masking and transformation:
- Use `isSecureText={true}` for full masking.
- Use `setSecureText({ start, end })` or `setSecureText({ ranges })` for ranges.
- Masking follows iOS parity: invalid secure ranges are ignored, an empty
  explicit ranges array masks nothing, and an empty `secureTextSymbol` leaves
  the transformed display text unmasked.
- Use `addTransformationRegex(...)` only for display/copy formatting. Do not use it to move revealed text into app state.
- `copyToClipboard({ format: "raw" })` intentionally copies raw revealed text. Use only when the product requirement and compliance review allow it. Prefer `"transformed"` when possible.

---
## 7. VGSShowImage (Image Reveal)

`VGSShowImage` renders base64 JPEG and PNG image content selected by `contentPath`.

Capabilities:
- `contentPath`: required dot-separated response path.
- `contentMode`: `"scaleToFill"`, `"scaleAspectFit"`, `"scaleAspectFill"`, or `"center"`.
- `style`: React Native image style applied to the underlying `Image`.
- `onImageChange`: notification only; base64 is not passed out.
- `onImageError`: receives `VGSShowError`.
- Ref state/action: `hasImage`, `clear()`.

Example:

```tsx
const imageRef = React.useRef<VGSShowImageRef | null>(null);

<VGSShowImage
  ref={imageRef}
  vgsShow={vgsShow}
  contentPath="card.image"
  contentMode="scaleAspectFit"
  style={{ width: "100%", height: 240 }}
  onImageError={() => {
    setStatus("Image unavailable");
  }}
/>;
```

Only JPEG and PNG image bytes are supported. Other image formats fail with
`invalidImageData`. Do not expose, log, hash, cache, or forward image base64
from app code.

---
## 8. VGSShowPdf (PDF Reveal)

`VGSShowPdf` renders base64 PDF content selected by `contentPath` through the
`react-native-pdf` native renderer.

Capabilities:
- `contentPath`: required dot-separated response path.
- `style`: React Native view style applied to the underlying PDF renderer. Provide dimensions or flex layout.
- `pdfDisplayMode`: `"singlePage"`, `"singlePageContinuous"`, `"twoUp"`, or `"twoUpContinuous"`.
- `pdfDisplayDirection`: `"vertical"` or `"horizontal"`.
- `pdfAutoScales`, `displayAsBook`, `pageShadowsEnabled`, `pdfBackgroundColor`.
- `onDocumentChange`: notification only; base64 is not passed out.
- `onDocumentError`: receives `VGSShowError`.
- Ref state/action: `hasDocument`, `clear()`.

Example:

```tsx
const pdfRef = React.useRef<VGSShowPdfRef | null>(null);

<VGSShowPdf
  ref={pdfRef}
  vgsShow={vgsShow}
  contentPath="card.statement"
  style={{ width: "100%", height: 360 }}
  pdfDisplayMode="singlePageContinuous"
  pdfDisplayDirection="vertical"
  onDocumentError={() => {
    setStatus("Document unavailable");
  }}
/>;
```

Native renderer failures are reported through `onDocumentError` as
`invalidPDFData`. Do not expose, log, hash, cache, or forward PDF base64 from
app code.

---
## 9. Making a Reveal Request

API:

```ts
const result = await vgsShow.request({
  path: "/reveal",
  method: "POST",
  payload: {
    customerId: config.syntheticCustomerId
  },
  requestOptions: {
    requestTimeoutInterval: 15
  }
});

setStatus(`Reveal complete (${result.code})`);
```

Request options:
- `path`: route path on the configured vault host.
- `method`: `"GET"`, `"POST"`, `"PUT"`, `"PATCH"`, or `"DELETE"`. Defaults to `"POST"`.
- `payload`: plain JSON object or `null`.
- `requestOptions.requestTimeoutInterval`: timeout in seconds. Defaults to 60.

Notes:
- Payload shape is tenant specific. Request only necessary aliases or identifiers.
- The response must be a JSON object.
- Subscribed components receive content from response fields selected by `contentPath`.
- Request success means HTTP success and JSON decode success; individual component path failures are reported through component error callbacks.

---
## 10. Custom Headers

Assign headers before invoking `request`:

```ts
vgsShow.customHeaders = {
  "X-Correlation-ID": correlationId
};
```

Rules:
- Never include secrets, bearer tokens, payment data, or PII unless the route contract explicitly requires it and logs/crash reporting are proven safe.
- Never log header values.
- Treat header presence as metadata; values are sensitive.

---
## 11. Error Model & Handling

SDK failures reject with `VGSShowError` or invoke component callbacks with `VGSShowError`.

Stable error types:
- `unexpectedResponseType (1400)`
- `unexpectedResponseDataFormat (1401)`
- `responseIsInvalidJSON (1402)`
- `fieldNotFound (1403)`
- `invalidJSONPayload (1404)`
- `invalidBase64Data (1405)`
- `invalidPDFData (1406)`
- `invalidImageData (1407)`
- `invalidConfigurationURL (1480)`

Mapping strategy:

```ts
function userMessageFor(error: unknown): string {
  if (!(error instanceof VGSShowError)) {
    return "Reveal failed";
  }

  switch (error.type) {
    case "fieldNotFound":
      return "Requested data unavailable";
    case "invalidImageData":
    case "invalidPDFData":
      return "Cannot display content";
    case "invalidBase64Data":
      return "Content unavailable";
    default:
      return "Reveal failed";
  }
}
```

Use `type` or `code` for app branching. Do not show raw SDK messages, raw `extraInfo`, request payloads, response bodies, headers, or revealed content to end users.

---
## 12. Logging

Default logging is disabled:

```ts
VGSLogger.shared.configuration = {
  level: "none",
  isNetworkDebugEnabled: false,
  isExtensiveDebugEnabled: false
};
```

Rules:
- Production: keep `level: "none"` unless an approved incident process requires warnings.
- `isNetworkDebugEnabled` can record response bodies and must remain disabled in production.
- Forbidden log content: raw revealed strings, media base64, request payloads, response bodies, custom header values, tokens, vault secrets, payment data, and customer identifiers.
- If temporary diagnostic logging is added during troubleshooting, remove it before shipping.

---
## 13. Analytics

SDK analytics are field-level. Allowed metadata includes event type, status, field category (`text`, `image`, `pdf`), `contentPath`, copy format, and failure codes/messages.

Do not add analytics that include revealed values, payload bodies, headers, tokens, hashes, lengths, or base64 content.

---
## 14. Performance & Concurrency

- Use one `VGSShow` instance per logical screen or reveal flow.
- Batch multiple text/image/PDF fields in one request when they come from one route.
- Avoid overlapping requests against the same view set unless the UI explicitly handles stale responses.
- Clear image/PDF/text state when moving away from the screen or when a new entity is selected.
- Ask the backend to enforce size limits for image and PDF fields.

---
## 15. Testing Strategy (Minimum Set)

1. Happy path multi-component reveal: text + image + PDF with stub JSON; request resolves and components report logical success.
2. Missing path: one component path absent; component error callback receives `fieldNotFound`.
3. Invalid image: invalid or non-renderable base64 produces `invalidBase64Data` or `invalidImageData`.
4. Invalid PDF: invalid or non-renderable base64 produces `invalidBase64Data` or `invalidPDFData`.
5. Secure masking: displayed text is masked according to requirements without moving raw text into app state.
6. Copy operation: when copy is enabled, verify selected format and callback behavior without logging clipboard content.
7. Request failure: invalid configuration, invalid JSON response, non-2xx HTTP response, and timeout/network failure map to safe UI state.

All tests must use synthetic values only and must not snapshot raw secrets, real payment data, tokens, or production identifiers.

---
## 16. Upgrade Workflow

1. Resolve the current installed version from lockfiles.
2. Read the target version's `skills/vgs-show-react-native-guide/references/AGENTS.md`.
3. Review release notes and public docs for changed APIs, peer dependency floors, and behavior changes.
4. Update package manager lockfiles deterministically.
5. Rebuild the app and run unit/integration tests that cover text, image, PDF, masking, and request errors.
6. Scan app code for internal imports, deprecated usage, and unsafe logging.
7. Confirm production logging and analytics settings remain safe.

---
## 17. Security Checklist (Per PR)

[ ] Vault/environment initialization validated and not controlled by end-user input.
[ ] No raw revealed values, media base64, payload bodies, headers, tokens, or customer data logged or persisted.
[ ] All reveal components have non-empty `contentPath`.
[ ] Partial reveal failures are handled with safe UI.
[ ] Masking/copy behavior is explicit for sensitive text.
[ ] Custom headers are sanitized and never logged.
[ ] Logging is production-safe.
[ ] Only package-root public exports are used.
[ ] Tests updated or green for the touched reveal behavior.

---
## 18. Common Failure Modes & Mitigations

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Component remains placeholder | `contentPath` is empty or not present in response | Align backend response contract and add path tests |
| Request resolves but one component fails | HTTP and JSON succeeded, but that component could not decode its path | Handle component callback and verify field type |
| Image/PDF invalid error | Wrong base64, corrupt media, or wrong content type at path | Validate media server-side and ensure path points to base64 content |
| Mask not applied | `isSecureText` or ranges not configured before display requirement | Configure masking in props or immediately after reveal before user action |
| Copy exposes raw text | `copyToClipboard({ format: "raw" })` used without product approval | Prefer transformed copy or disable copy |
| Web bundling fails | SDK supports iOS and Android only | Gate imports to native app entrypoints |

---
## 19. Quick Reference Snippets

Initialize:
```ts
const vgsShow = new VGSShow({ id: config.vaultId, environment: "sandbox" });
```

Text reveal:
```tsx
<VGSShowLabel vgsShow={vgsShow} contentPath="user.name" placeholder="Loading" />;
```

Image reveal:
```tsx
<VGSShowImage vgsShow={vgsShow} contentPath="user.avatar" />;
```

PDF reveal:
```tsx
import { VGSShowPdf } from "@vgs/show-react-native";

<VGSShowPdf vgsShow={vgsShow} contentPath="docs.statement" style={{ width: "100%", height: 360 }} />;
```

Request:
```ts
await vgsShow.request({ path: "/reveal", method: "POST", payload: { id: recordId } });
```

Clear:
```ts
labelRef.current?.clearText();
imageRef.current?.clear();
pdfRef.current?.clear();
```

Disable logging:
```ts
VGSLogger.shared.configuration = {
  level: "none",
  isNetworkDebugEnabled: false,
  isExtensiveDebugEnabled: false
};
```
