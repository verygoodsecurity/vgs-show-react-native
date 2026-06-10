# AGENTS.md

Contributor guidance for `vgs-show-react-native`.

This repository contains a TypeScript React Native SDK for revealing sensitive
data through VGS Show. The PDF component uses the `react-native-pdf` native
renderer dependency. Treat security and customer API stability as the primary
constraints for every change.

## Session Startup

- Read this file before changing code.
- Read any nested `AGENTS.md` that applies to files you will touch, except
  files under `docs/` and
  `skills/vgs-show-react-native-guide/references/AGENTS.md`. Those files are
  TypeDoc-generated output or public integrator-facing artifacts, not
  contributor guidance.
- Use the relevant Codex skills when a task touches SDK internals, tests,
  release work, React Native, iOS, Android, or security/privacy behavior.
- Inspect the current implementation, package scripts, and tests before making
  assumptions. Use `rg` first for searches.
- Start from the files relevant to the current task.

## SDK Mental Model

- `VGSShow` is the orchestrator. It owns vault configuration, request building,
  request/reveal lifecycle, subscribed views, custom headers, hostname handling,
  analytics state, and lifecycle traces used by tests.
- Components subscribe to one `VGSShow` instance with a `contentPath`.
  `VGSShow.request()` fetches the reveal payload, resolves each subscribed
  `contentPath`, and pushes decoded content into each component controller.
- `VGSShowLabel` displays revealed text and supports masking, formatting,
  copy-to-clipboard, and `clearText()`.
- `VGSShowImage` displays image content from base64 and exposes only
  `hasImage` plus `clear()`.
- `VGSShowPdf` displays PDF content from base64 and exposes only `hasDocument`
  plus `clear()`.
- Public refs and callbacks must expose actions, errors, and logical state only.
  They must not expose revealed values, media bytes/base64, response bodies,
  hashes, lengths, or other sensitive metadata.

## Core Areas

- `src/core/VGSShow.ts`: public `VGSShow` class, subscription lifecycle, reveal
  coordination, runtime fetch path, and test traces.
- `src/core/network.ts`: request normalization, headers, JSON payload encoding,
  timeout handling, hostname validation, and response/error mapping.
- `src/core/jsonPath.ts`: dotted `contentPath` resolution.
- `src/core/errors.ts`: `VGSShowError`, error codes, domains, and serialization.
- `src/core/contentState.ts`: shared idle/loading/revealed/failed/cleared state.
- `src/core/textPipeline.ts`: secure text ranges, masking, copy formats, and
  transformation regexes.
- `src/core/analytics.ts`: analytics payload construction, logging, and
  sensitive-data guards.
- `src/components/VGSShowLabel.tsx`,
  `src/components/VGSShowImage.tsx`, and `src/components/VGSShowPdf.tsx`:
  React bindings plus controller logic used by components and tests.

## Repository Shape

- This repository may be checked out inside a larger workspace, but the repo
  root is the npm package boundary. Treat root `package.json` and
  `package-lock.json` as the source of truth for SDK commands and dependencies.
- Do not assume sibling repositories are available unless the task explicitly
  points to them.
- Root package: npm package source of truth, TypeScript config, Jest config,
  package lock, and build/test scripts.
- `.github/AGENTS.md`: contributor guidance for SDK maintainers and agents.
- `skills/vgs-show-react-native-guide/`: public integrator-facing AI skill
  bundle. It is not contributor guidance for this repository.
- `src/`: SDK source exported through `src/index.ts`.
- `tests/`: all Jest coverage, grouped by SDK behavior area with fixtures in
  `tests/fixtures/` and shared helpers in `tests/helpers/`.
- `docs/`: TypeDoc-generated output. Never hand-edit, delete, or curate files
  under `docs/`. If the reference output must change, update source comments or
  TypeDoc inputs and regenerate with `npm run docs` only when the task
  explicitly requires a docs refresh.
- `example/`: minimal Expo example workspace that installs the local package via
  `file:..`.
- `example/src/App.tsx`: reference screen showing one `VGSShow` instance wired
  to text, image, PDF, and `request()`.

This repo does not currently contain a bootstrapped standalone React Native
example workspace. Build and test the SDK from the repository root. Use
`example/src/App.tsx` as source reference or as a seed for a future app.

## Security Rules

- Never expose real or sensitive revealed text, response bodies, media
  base64/bytes, PAN, BIN, card data, tokens, auth headers, payload bodies,
  hashes, lengths, or equivalent sensitive metadata through public APIs,
  callbacks, refs, logs, analytics, errors, tests, fixtures, examples, or docs.
- Public APIs, callbacks, and refs must not expose revealed values at all, even
  when those values are synthetic in tests.
- Never add console logging of request/response bodies, custom headers, payloads,
  or revealed component content.
- Keep analytics field-level only. `contentPath` and logical field names are
  allowed; values and payload bodies are not.
- Treat network debug logging as unsafe for production. Do not broaden it, enable
  it by default, or document it as safe for customer apps.
- Error objects may include codes, types, domains, and safe diagnostic context.
  Do not attach raw server responses, payloads, headers, or revealed values.
- Test fixtures must use synthetic values only. Do not add real customer data,
  real vault IDs, real tokens, or real payment data.

## Development Workflow

- Keep changes small and aligned with existing patterns.
- Do not add native bridges or platform dependencies without explicit approval.
  Keep required native dependencies documented in `README.md`, `package.json`,
  and the public skill snapshot.
- Preserve public API compatibility unless the task explicitly requests a
  breaking change.
- When behavior changes, update the relevant Jest tests in the same change.
- When public behavior changes, update `README.md` and the public skill snapshot
  under `skills/vgs-show-react-native-guide/` when customer guidance changes.
  Do not patch generated files under `docs/`.
- Keep TypeDoc comments current when touching public APIs, public component
  props/refs, request/error types, and contributor-facing internals. Comments
  should explain integration contracts, lifecycle expectations, and security
  constraints without exposing sensitive values or private implementation
  details.
- Keep example app code comments useful for integrating developers and agents.
  Comments should call out vault route contracts, alias-only payloads, safe
  callback/ref usage, and places that must remain synthetic.
- Keep contributor-only instructions out of public TypeDoc comments whenever
  possible. Put implementation guardrails inside function bodies or controller
  constructors as regular `// Contributor guidance:` comments, and keep public
  JSDoc focused on integrator-facing behavior.
- Do not repeat policy reminders such as "do not commit customer identifiers" in
  public API or example source comments. Keep those rules in this file unless a
  short integration comment is necessary to prevent misuse.
- When adding or renaming exported symbols, update comments in the same change.
  Do not hand-edit, delete, or manually modify generated files under `docs/`.
- Keep public-facing READMEs concise and user-task oriented. Include only the
  information a user needs to understand, run, or adopt the feature. Omit
  internal implementation details, generated identifiers, or platform config
  trivia unless the user must read or edit them directly.
- When contributor workflow, repo layout, architecture guidance, or public
  skill maintenance requirements change, update this `.github/AGENTS.md` in the
  same change.
- Keep contributor-only instructions in `.github/AGENTS.md`. Do not place
  contributor workflow rules in `README.md`, `docs/`, or the public skill files.
- Do not rewrite generated `lib/` output by hand.

## Public Skill Maintenance

- Keep `skills/vgs-show-react-native-guide/SKILL.md` and
  `skills/vgs-show-react-native-guide/references/AGENTS.md` customer-facing.
  They are guidance for AI agents working in downstream apps, not contributor
  instructions for this repository.
- Contributors may edit public skill files only when public integration
  behavior or customer-facing guidance changes. Do not add contributor workflow,
  release process, or repository maintenance instructions to the public skill.
- Update the skill snapshot when public SDK behavior, public exports,
  integration steps, peer dependency floors, platform support, logging,
  analytics, error handling, or security guidance changes.
- Keep the `SDK Version` header in the skill reference aligned with the package
  behavior being released.
- Run `skills-ref validate skills/vgs-show-react-native-guide` after changing
  skill files.

## Commands

Run from the repository root:

```bash
npm run build
npm run typecheck
npm test -- --ci
```

For README, public skill, or TypeDoc source-comment changes, run the relevant
focused checks plus a targeted `rg` check for stale references or accidental
sensitive/private metadata in source files. Leave generated `docs/` output
untouched unless the task explicitly asks for a TypeDoc refresh.

To validate the example screen, use the Expo workspace in `example/`:

```bash
cd example
npm install
npm run start
```

## Git

- Check `git status --short --branch` before editing, before staging, and before
  committing.
- Do not revert unrelated user changes.
- Stage only intended files.
- All commits must be signed:

```bash
git commit -S -m "<message>"
```

- Push the current working branch only after verification passes.
