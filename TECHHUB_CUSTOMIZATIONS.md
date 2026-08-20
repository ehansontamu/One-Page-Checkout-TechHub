# TechHub Checkout Customizations

This repository is a fork of `bigcommerce/checkout-js`. This document is the durable, AI-readable record of intentional differences from upstream. Keep it current whenever a TechHub-specific change is made. Do not add generated `build/` or `dist/` files to commits.

## Operating rules

- The active custom branch is `main` in `ehansontamu/One-Page-Checkout-TechHub`.
- Current production behavior is the source of truth when reproducing an existing feature.
- Use display labels, not BigCommerce custom-field IDs, when identifying TechHub fields. Test and production IDs can differ.
- Do not restore the retired external checkout scripts or the former digital-product / Google Shared Drive custom logic unless explicitly requested.

## Intentional deviations from upstream

### Checkout presentation and navigation

- The cart heading reads `Order Summary`.
- The shipping section is labeled `Details`; its address heading is `Shipping and Billing Info`.
- Company and phone address fields are hidden.
- Customers in customer group `10` are redirected to the cart.

### TechHub address fields

- The recipient College/Unit, recipient UIN/name, recipient account number, and department-code fields are recognized by their labels.
- Department codes are validated against `https://store-jsj7fos9p1.mybigcommerce.com/content/JSON%20Files/TechhubDeptOutputBig.json`.
- A department-code lookup prompt and button appear directly below the department-code field. The button opens `https://store-jsj7fos9p1.mybigcommerce.com/content/Department%20Lookup%20Tool/index.html`.

### Address and checkout-session policy

- Customer saved-address selectors and save-address controls are removed.
- Address writes force `shouldSaveAddress: false`.
- On every checkout page load, the checkout session is reset before rendering: shipping consignments/method, billing address, and order comment are cleared.
- Details is reopened on every new checkout visit and cannot be skipped until the shopper presses Continue, even if BigCommerce has retained valid address information.
- Billing is always the shipping address. The customer cannot opt out, and the “My billing address is the same as my shipping address” checkbox is not displayed.

### Terms and conditions

- The terms text is customized for TechHub.
- The checkout link uses the relative path `/terms-and-conditions/`, so it automatically points to the corresponding page on test or production. Ensure that page exists at the same path in both stores.

## Maintenance notes

- Before upgrading from upstream, compare this document and reapply each item deliberately rather than blindly copying files.
- Add the date, purpose, affected source files, and any store-configuration dependency for every new customization.
- The production build uses transpile-only TypeScript handling. SDK `declare const enum` values are not present at runtime, so checkout extension regions and messages must use the local runtime-safe constants in `packages/checkout-extension/src/`.

## Change log

| Date | Purpose | Affected source | Store dependency |
| --- | --- | --- | --- |
| 2026-08-19 | Established the TechHub-native baseline: labels-based custom-field handling, department-code validation, guest redirect, heading/terms copy, address-book removal, and checkout-session reset. | `packages/core/src/app/techhub/`, address, shipping, billing, payment, checkout, locale, and terms components | Customer group `10`; recipient-field labels must match in both stores; production WebDAV department-code JSON must remain reachable. |
| 2026-08-20 | Made billing permanently match shipping and added the department-code lookup control. | `AddressForm.tsx`, `CheckoutPage.tsx`, shipping forms, payment billing form | The Department Lookup Tool must remain available at the hardcoded production WebDAV URL. |
| 2026-08-20 | Restored the normal Order Summary heading and added a per-visit Details confirmation gate. | `en.json`, `CheckoutPage.tsx` | None. |
| 2026-08-20 | Enabled transpile-only handling in the production Webpack build so the deployable checkout bundle can be generated despite upstream declaration-file loading errors. | `webpack.config.js` | Run focused tests separately; `npm run build` now produces the WebDAV upload in `dist/`. |
| 2026-08-20 | Merged upstream `bigcommerce/checkout-js` `1.872.0` while preserving TechHub’s fixed-billing and per-visit Details-confirmation policies. | Upstream checkout, payment, customer, order-summary, dependency, and generated distribution files; TechHub `CheckoutPage.tsx` conflict resolution | Revalidate the custom checkout against both stores after each future upstream merge. |
| 2026-08-20 | Fixed the upstream SDK extension-region runtime error after the `1.872.0` merge. | Checkout extension runtime constants and extension insertion points | Required because transpile-only builds do not emit SDK `declare const enum` values. |
