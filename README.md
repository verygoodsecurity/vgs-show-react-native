<p align="center">
  <a href="https://www.verygoodsecurity.com/" rel="nofollow">
    <img src="https://avatars0.githubusercontent.com/u/17788525" width="128" alt="VGS Logo">
  </a>
  <h3 align="center">VGS Show React Native Package</h3>

  <p align="center">
    Securely reveal protected text, image, and PDF data in your React Native applications.
    <br />
    <a href="https://docs.verygoodsecurity.com/vault/developer-tools/vgs-show"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://www.npmjs.com/package/@vgs/show-react-native">NPM (@vgs/show-react-native)</a>
    ·
    <a href="./skills/vgs-show-react-native-guide/SKILL.md">AI Agents Ready</a>
  </p>
</p>

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [AI Agent Integration](#ai-agent-integration)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Vault Configuration](#vault-configuration)
- [Reveal Requests](#reveal-requests)
- [Components](#components)
  - [Text Reveal](#text-reveal)
  - [Image Reveal](#image-reveal)
  - [PDF Reveal](#pdf-reveal)
- [Refs](#refs)
- [Error Handling](#error-handling)
- [Security Guidance](#security-guidance)
- [Example App](#example-app)
- [Documentation](#documentation)
- [Releases](#releases)
- [License](#license)

## Introduction

The `@vgs/show-react-native` package by Very Good Security (VGS) enables React
Native applications to reveal previously tokenized or aliased data from a VGS
vault without exposing raw values through your application API surface.

Use it when your app needs to display protected text, image, or PDF content
while keeping revealed values inside SDK-managed components.

## Features

- **Secure Data Reveal:** Display sensitive vault data without returning raw
  text, media bytes, base64 payloads, or response bodies to application code.
- **Text Display Controls:** Mask revealed text, apply transformations, copy
  allowed formats, and clear displayed values.
- **Media Components:** Render protected image and PDF content from configured
  response fields.
- **Safe Error Surface:** Handle stable `VGSShowError` codes and types without
  logging sensitive payloads.
- **AI Agent Ready:** Includes a public integration skill for compatible agents
  working with this SDK.

## Installation

Install the `@vgs/show-react-native` package using npm:

```bash
npm install @vgs/show-react-native
```

Peer dependencies:

- `react >= 19.1.0`
- `react-native >= 0.81.4`

PDF reveal uses native renderer dependencies bundled by the SDK.

Supported platforms:

- iOS
- Android

## AI Agent Integration

This repository ships a public AI skill at
[`skills/vgs-show-react-native-guide/SKILL.md`](./skills/vgs-show-react-native-guide/SKILL.md)
for teams integrating `@vgs/show-react-native` into an app.

Recommended: install the skill with `skills.sh`. This is the easiest way to
give a compatible AI agent the repository-specific guidance it needs for
`@vgs/show-react-native` integrations.

Use the skill entrypoint as the public integration guide for AI-assisted
`@vgs/show-react-native` adoption.

Install the skill with `skills.sh`:

```bash
npx skills add https://github.com/verygoodsecurity/vgs-show-react-native --skill vgs-show-react-native-guide
```

If your AI tool does not support skills yet, load
[AGENTS.md](skills/vgs-show-react-native-guide/references/AGENTS.md) file.

Minimal System Prompt Example:

```text
You are an autonomous engineering agent integrating the VGS Show React Native SDK into an existing React Native app.
Use the AGENTS.md as the authoritative integration policy.
Constraints:
- Only package-root public APIs from @vgs/show-react-native.
- No raw sensitive data in logs, tests, callbacks, analytics, or app state.
- All reveal components must have non-empty contentPath values before requests.
- Secure masking applied where required before user-visible actions.
Goals:
1. Add a screen revealing a user's card number, expiration date, image, and PDF statement using a single batched request.
2. Implement secure display for the card number and expiration date.
3. Provide tests for a missing contentPath response field.
Return: Modified React Native source files only, no secrets.
```

Developer Prompt Example:

```text
Task: Add secure display of card number and expiration date with transformed copy behavior.
Follow the AGENTS.md.
Do not log raw card data; add tests for masking and a missing response path.
```

## Prerequisites

You should have an organization registered in the
<a href="https://dashboard.verygoodsecurity.com/dashboard/" target="_blank">VGS Dashboard</a>.
A Sandbox vault is pre-created for you. Configure a reveal route in your vault,
then use your vault ID, environment, route path, and response field paths in the
SDK.

Use environment-specific vault IDs and routes from your VGS account. Keep
production vault IDs, tokens, customer records, and payment data out of sample
code, logs, and screenshots.

## Quick Start

Import the package components:

```tsx
import * as React from "react";
import { Button, SafeAreaView, Text, View } from "react-native";
import {
  VGSShow,
  VGSShowError,
  VGSShowImage,
  VGSShowLabel,
  VGSShowPdf
} from "@vgs/show-react-native";
```

Create one `VGSShow` instance for the screen, render subscribed components with
explicit `contentPath` values, then call `request()`:

```tsx
export function RevealScreen() {
  const showRef = React.useRef<VGSShow | null>(null);
  const [status, setStatus] = React.useState("Idle");

  if (showRef.current === null) {
    showRef.current = new VGSShow({
      id: "your-vault-id",
      environment: "sandbox"
    });
  }

  const vgsShow = showRef.current;

  async function reveal() {
    setStatus("Loading");

    try {
      const result = await vgsShow.request({
        path: "/post",
        method: "POST",
        payload: {
          customerId: "synthetic-customer-id"
        }
      });

      setStatus(`Reveal complete (${result.code})`);
    } catch (error) {
      if (error instanceof VGSShowError) {
        setStatus(`Reveal failed (${error.code})`);
        return;
      }

      setStatus("Reveal failed");
    }
  }

  return (
    <SafeAreaView>
      <View>
        <VGSShowLabel
          vgsShow={vgsShow}
          contentPath="card.number"
          placeholder="**** **** **** ****"
          isSecureText={true}
          onRevealError={(error) => {
            setStatus(`Card number failed (${error.code})`);
          }}
        />

        <VGSShowLabel
          vgsShow={vgsShow}
          contentPath="card.expirationDate"
          placeholder="**/**"
          isSecureText={true}
          onRevealError={(error) => {
            setStatus(`Expiration date failed (${error.code})`);
          }}
        />

        <VGSShowImage
          vgsShow={vgsShow}
          contentPath="card.image"
          onImageError={(error) => {
            setStatus(`Image failed (${error.code})`);
          }}
        />

        <VGSShowPdf
          vgsShow={vgsShow}
          contentPath="card.statement"
          style={{ width: "100%", height: 360 }}
          onDocumentError={(error) => {
            setStatus(`PDF failed (${error.code})`);
          }}
        />

        <Button title="Reveal" onPress={reveal} />
        <Text>{status}</Text>
      </View>
    </SafeAreaView>
  );
}
```

## Vault Configuration

Create one `VGSShow` instance for the screen or flow that reveals data:

```ts
const vgsShow = new VGSShow({
  id: "your-vault-id",
  environment: "sandbox"
});
```

Supported options:

- `id`: your VGS vault ID.
- `environment`: `sandbox`, `live`, or a regional live environment such as
  `live-eu1`.
- `dataRegion`: optional region suffix for regional vault routing when using
  `environment: "sandbox"` or `environment: "live"`.
- `hostname`: optional custom hostname.

## Reveal Requests

`request()` sends a reveal request and resolves when the HTTP request succeeds:

```ts
await vgsShow.request({
  path: "/post",
  method: "POST",
  payload: {
    customerId: "synthetic-customer-id"
  },
});
```

Request options:

- `path`: request path on the configured vault host.
- `method`: `GET`, `POST`, `PUT`, `PATCH`, or `DELETE`. Defaults to `POST`.
- `payload`: JSON object sent as the request body.

Subscribed components receive their content from the response field selected by
their `contentPath`.

## Components

The package provides React Native components for revealing sensitive text,
image, and PDF content. Each component must receive the same `VGSShow` instance
for the flow and a non-empty `contentPath` that maps to a response field.

### Text Reveal

`VGSShowLabel` subscribes to text content and supports placeholders, secure text
masking, copy behavior, transformations, and clearing.

```tsx
<>
  <VGSShowLabel
    vgsShow={vgsShow}
    contentPath="card.number"
    placeholder="**** **** **** ****"
    isSecureText={true}
  />

  <VGSShowLabel
    vgsShow={vgsShow}
    contentPath="card.expirationDate"
    placeholder="**/**"
    isSecureText={true}
  />
</>
```

### Image Reveal

`VGSShowImage` subscribes to base64 JPEG and PNG image content and exposes only
logical state through refs and callbacks.

```tsx
<VGSShowImage
  vgsShow={vgsShow}
  contentPath="card.image"
  contentMode="scaleAspectFit"
/>
```

### PDF Reveal

`VGSShowPdf` subscribes to base64 PDF content, renders it through
`react-native-pdf`, and supports PDF display options. Provide a sized `style`
so the native PDF renderer has dimensions or flex layout.

```tsx
<VGSShowPdf
  vgsShow={vgsShow}
  contentPath="card.statement"
  style={{ width: "100%", height: 360 }}
  pdfDisplayMode="singlePageContinuous"
  pdfDisplayDirection="vertical"
/>
```

## Refs

Use refs for component actions and logical state:

```tsx
import * as React from "react";
import type {
  VGSShowImageRef,
  VGSShowLabelRef,
  VGSShowPdfRef
} from "@vgs/show-react-native";

const labelRef = React.useRef<VGSShowLabelRef | null>(null);
const imageRef = React.useRef<VGSShowImageRef | null>(null);
const pdfRef = React.useRef<VGSShowPdfRef | null>(null);
```

- `VGSShowLabelRef`: `clearText()`, `copyToClipboard()`, `setSecureText()`,
  `addTransformationRegex()`, and `resetAllFormatters()`.
- `VGSShowImageRef`: `hasImage` and `clear()`.
- `VGSShowPdfRef`: `hasDocument` and `clear()`.

Image and PDF refs intentionally report only logical booleans, not media data.

## Error Handling

SDK failures reject with `VGSShowError` or invoke component error callbacks with
`VGSShowError`:

```ts
try {
  await vgsShow.request({ path: "/post" });
} catch (error) {
  if (error instanceof VGSShowError) {
    setStatus(`Reveal failed (${error.code})`);
  }
}
```

Use `code` or `type` for app logic. Do not log request payloads, response bodies,
headers, or revealed component content while handling errors.

## Security Guidance

- Keep revealed values inside the VGS Show components.
- Do not mirror revealed text or media data into app state, analytics, logs,
  crash reports, screenshots, or custom callbacks.
- Do not enable network debug logging in production.
- Do not log custom headers, request payloads, response bodies, tokens, or
  authorization values.
- Keep example values synthetic.
- Treat `contentPath` as field metadata. It should identify the response field,
  not contain sensitive values.

## Example App

You can check the example application at `example/src/App.tsx`.
It contains a small Expo demo app with separate card, image, and PDF reveal use
cases that share one runtime vault configuration.

To run the example application:

```bash
# 1. Install package dependencies from the package root.
npm install

# 2. Navigate to the example folder.
cd example

# 3. Install example dependencies.
npm install

# 4. Install a native dev build once when needed.
npx expo run:ios

# 5. Start Metro for the Expo dev client.
npx expo start --clear
```

## Documentation

- Package Documentation:
  https://docs.verygoodsecurity.com/vault/developer-tools/vgs-show

## Releases

To follow `@vgs/show-react-native` updates and changes, check the
<a href="https://github.com/verygoodsecurity/vgs-show-react-native/releases">releases page</a>.

## License

The VGS Show React Native package is released under the MIT license.
