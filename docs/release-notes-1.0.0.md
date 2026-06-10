# Release Notes: 1.0.0

## Scope

Release 1.0 publishes the first usable React Native reveal surface:

- `VGSShow` core orchestration and request API
- JSON-path resolution and error mapping
- analytics and logging behavior already implemented in-repo
- `VGSShowLabel` text reveal, masking, formatting, and copy callbacks

## Verification

- `npm run build` passed on 2026-04-24
- `npm run typecheck` passed on 2026-04-24
- Jest behavior coverage passed on 2026-04-24 for the Release 1.0 scope.

## Platform gaps and non-goals

- Image and PDF behavior is not part of Release 1.0.
- PDF pixel-identical rendering is out of scope; only logical behavior is a
  test target.
- `pageShadowsEnabled` may be a no-op in React Native even though the prop is
  accepted for API compatibility.
- UIKit/SwiftUI-specific styling and anti-inspection internals are replaced by
  React Native API-surface constraints.

## Example flow

Release 1.0 includes a text-only example flow in `example/src/App.tsx`. The
example demonstrates:

- constructing `VGSShow`
- binding `VGSShowLabel`
- issuing `request({ path })`
- handling request and reveal errors without exposing revealed values

## Security and privacy review

- Analytics, text anti-leak, and header/privacy Jest behavior cases remain
  green.
- Network debug logging is opt-in and should stay disabled in production.
