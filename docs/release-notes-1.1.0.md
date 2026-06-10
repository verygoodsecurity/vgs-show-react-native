# Release Notes: 1.1.0

## Scope

Release 1.1 adds the approved media component surface:

- `VGSShowImage` with base64 image reveal, `hasImage`, `clear()`, and image
  callbacks
- `VGSShowPdf` with base64 PDF reveal rendered through `react-native-pdf`,
  logical display settings, `hasDocument`, `clear()`, and document callbacks
- pure TypeScript render validation for invalid image data (1407) and invalid
  PDF data (1406)
- media `ContentRendering` analytics with field-only metadata

PDF rendering uses native renderer dependencies bundled by the SDK, so apps
must rebuild native targets after installing the SDK.

## Verification

- `npm run build` passed on 2026-04-24
- `npm run typecheck` passed on 2026-04-24
- Focused Release 1.1 media Jest behavior cases passed on 2026-04-24.

## Security and privacy review

- Image and PDF refs expose only logical booleans plus `clear()`.
- Media change callbacks carry no media bytes, base64 strings, lengths, hashes,
  or derived values.
- Content-rendering analytics emits only `{ field: "image" }` or
  `{ field: "pdf" }`.
- Dotted `contentPath` values remain allowed in analytics because they are
  field names, not revealed values.
