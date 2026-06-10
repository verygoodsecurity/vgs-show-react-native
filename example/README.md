# VGS Show React Native Example

This Expo app demonstrates common VGS Show integration flows:

- collect card aliases, then reveal text fields
- reveal image content from an alias
- reveal PDF content from an alias

The app uses one runtime vault configuration and shares the same `VGSShow`
instance across reveal screens. The PDF flow uses native modules, so run it in
the Expo dev client rather than Expo Go.

## Run

Install the SDK dependencies from the package root, then install the example
dependencies:

```bash
npm install
cd example
npm install
```

The example uses an Expo dev build because the card flow includes native VGS
Collect inputs. Install the native dev client once before opening the app, and
again after native dependency or configuration changes:

```bash
npx expo run:ios
```

Use `npx expo run:android` for Android.

After the dev client is installed on a simulator or device, start Metro with:

```bash
npx expo start --clear
```

The npm scripts mirror the same Expo commands:

```bash
npm run start -- --clear
```

## Vault Setup

The demo defaults to:

- environment: `sandbox`
- collect path: `/post`
- reveal path: `/post`

Use the Vault ID button in the app header to set the current vault ID at
runtime.

## Card Flow

The Collect tab creates aliases from secure card inputs. The Show tab sends
those aliases to the reveal route and binds `VGSShowLabel` components to the
response fields.

Collect field names:

- `card_holder_name`
- `card_number`
- `card_expirationDate`

Reveal payload keys:

- `payment_card_holder_name`
- `payment_card_number`
- `payment_card_expiration_date`

Reveal content paths:

- `json.payment_card_holder_name`
- `json.payment_card_number`
- `json.payment_card_expiration_date`

## Image and PDF Flows

The image and PDF screens accept aliases directly and send them to the reveal
route.

Image contract:

- request payload key: `image_alias`
- reveal content path: `json.secure_image`

PDF contract:

- request payload key: `pdf_alias`
- reveal content path: `json.secure_pdf`
