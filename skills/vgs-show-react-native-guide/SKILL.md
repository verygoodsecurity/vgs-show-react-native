---
name: vgs-show-react-native-guide
description: Routes AI agents through VGS Show React Native SDK work across integration, implementation, migration, troubleshooting, and code review. Use when guidance may depend on the installed @vgs/show-react-native version.
metadata:
  author: verygoodsecurity
  version: '1.0.0'
---

# VGS Show React Native Guide

Single public skill entrypoint for `@vgs/show-react-native` work in customer React Native apps.

## When to use

- First-time `@vgs/show-react-native` integration
- Feature work touching `VGSShow`, `VGSShowLabel`, `VGSShowImage`, `VGSShowPdf`, reveal requests, masking, copy behavior, logging, or analytics
- Version migrations or replacement of deprecated usage
- Troubleshooting integration bugs or version-specific regressions
- Code review of app code that uses `@vgs/show-react-native`

## References

| Topic | File |
|-------|------|
| SDK policy, security rules, reveal lifecycle, versioned guidance | `references/AGENTS.md` |

## Snapshot resolution

`references/AGENTS.md` carries an `**SDK Version: x.y.z**` header. It is the authoritative policy file for this skill. Treat any customer-owned `AGENTS.md` in the user's app repo as unrelated.

**Step 1 - locate AGENTS.md, in order:**
1. bundled `references/AGENTS.md` shipped with this skill (load first for standalone installs, before any network call)
2. matching tag in the canonical public repo `https://github.com/verygoodsecurity/vgs-show-react-native`
3. default branch of that repo

Private forks or internal mirrors do not override the public repo.

**Step 2 - resolve the installed SDK version, in order:**
1. dependency lockfiles (`package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock`, `pnpm-lock.yaml`)
2. package manifests with exact pins (`package.json`, workspace manifests)
3. Expo or React Native build logs that include the installed package version
4. user-provided dependency snippets, stated version, or lockfile excerpts

Do not block the task on version detection. If unknown, use default-branch guidance and disclose it.

**Step 3 - match tag to version:**
- exact match (`1.0.0` or `v1.0.0`)
- nearest compatible tag with same `major.minor` and highest patch not newer than installed
- highest tag satisfying a version range
- exact git SHA or branch when the dependency points to one

**Step 4 - refresh when mismatched:**

Reload the resolved tag's `AGENTS.md` snapshot when any of these is true:
- the `SDK Version` header differs from the installed version
- the resolved docs ref changed (default branch -> tag, tag -> tag, tag -> SHA)
- the task is a migration requiring target-version docs
- version detection upgraded from inferred to exact
- canonical public repo snapshot became available after a fallback

## Retrieval policy

Start with `AGENTS.md`. Retrieve additional evidence only when the task needs exact TypeScript signatures, version-specific behavior, concrete error or log detail, or integration-style examples.

Follow-up sources, in order: resolved-tag repo files (`README.md`, `docs/`, `example/`, source comments) -> release notes -> official VGS docs -> user-provided code, logs, manifests, lockfiles.

Retrieval fills implementation detail. It never overrides `AGENTS.md` invariants and never justifies private or undocumented API use.

## Clarifying questions

Ask only when the missing info materially changes the recommendation:
- installed `@vgs/show-react-native` version or dependency snippet
- task type (integration, feature change, migration, troubleshooting, review)
- target platform (`iOS`, `Android`, or both) when relevant
- reveal content type (`text`, `image`, or `pdf`)
- masking, transformation, or copy behavior requirements
- relevant error, log, or code snippet for troubleshooting

## Routing

Choose one primary mode. In every mode: apply the reveal-flow rules from `AGENTS.md` before generating output, prefer the smallest documented public API surface, and include tests or checks required by `AGENTS.md`.

### `integrate`
First-time SDK adoption.
- confirm SDK is not already present
- install with the customer's package manager
- establish baseline `VGSShow` setup, component subscription through props, and request prerequisites

### `implement`
Add or change supported functionality.
- implement in the customer's app context, not a generic snippet
- generate code with explicit `contentPath`, batched requests, secure masking, and safe error handling
- use placeholders only for secrets, identifiers, endpoints, and environment values the user has not supplied

### `migrate`
Move between versions or replace deprecated behavior.
- load both current-version and target-version snapshots
- target-version `AGENTS.md` is the authoritative destination rule set
- use release notes and current repo docs to capture version-to-version changes
- call out behavior changes that cannot be preserved exactly

### `troubleshoot`
Failing or unexpected behavior.
- localize the failure before changing code
- prefer evidence from logs, tests, dependency state, or a minimal repro
- if logs are needed, request or temporarily enable only redacted diagnostic logging allowed by `AGENTS.md`; do not add raw sensitive-value logging, and keep production logging minimal
- distinguish confirmed cause from likely cause and workaround

### `review`
Patch, PR, or design review.
- review against the resolved version's `AGENTS.md` and public APIs
- prioritize correctness, safety, compatibility, and missing tests
- flag private, deprecated, insecure, or version-incompatible behavior
- say explicitly when reviewed code appears to target a different version

A task may have a secondary mode, but the primary mode controls planning and output.

## Output contract

Begin every response by stating which version the guidance is based on, using one of:
- `Using @vgs/show-react-native 1.0.0.`
- `Detected @vgs/show-react-native 1.0.0 from package-lock.json.`
- `Could not determine the installed @vgs/show-react-native version; using latest guidance from the default branch.`
- `Exact tag 1.0.1 was not found; using nearest compatible tag 1.0.0.`

Then proceed using the active version-matched snapshot.
