# TechHub Checkout Customizations

This repository is a fork of `bigcommerce/checkout-js`. This document is the durable, AI-readable record of intentional differences from upstream. Keep it current whenever a TechHub-specific change is made. Do not add generated `build/` or `dist/` files to commits.

Last reviewed against repository source: 2026-10-26. Build, testing, WebDAV upload, and rollback instructions are in [TECHHUB_BUILD_GUIDE.md](TECHHUB_BUILD_GUIDE.md). These documents describe the source behavior and required store configuration; they do not establish that the latest changes or JSON have been deployed.

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
- Recipient UIN(s) or Name(s) and Recipient Account Number(s) are each limited to 250 characters for the whole field, including commas and spaces. The limits are not shown as permanent helper text and the textareas do not silently truncate input; checkout displays an inline validation error only after the entered value exceeds 250 characters. Existing required-field and allowed-character rules remain in place. These policies match fields by label so they work with different Test and production IDs.
- Department codes are validated against `https://store-jsj7fos9p1.mybigcommerce.com/content/JSON%20Files/TechhubDeptOutputBig.json`.
- A department-code lookup prompt and button appear directly below the department-code field. The button opens `https://store-jsj7fos9p1.mybigcommerce.com/content/Department%20Lookup%20Tool/index.html`.
- Delivery Location is a dependent address field: after a shopper chooses Recipient College/Unit, it becomes a required dropdown only when external location data contains valid options for that unit. It stores only its own field value and does not alter the address.
- Delivery Location choices display normal mixed-case location names first and building choices second; all-uppercase codes and building–room choices belong to the second group. Each group is alphabetized and the JSON file itself remains unchanged.
- The location data is not bundled with checkout-js. Local development reads `http://127.0.0.1:8080/checkout_address_whitelist.json`. Deployed Test checkout on `techhubtest.mybigcommerce.com` reads `https://store-jje9unvzjs.mybigcommerce.com/content/Scripts/checkout_address_whitelist.json`; production checkout on `tamu.mybigcommerce.com` reads `https://store-jsj7fos9p1.mybigcommerce.com/content/JSON%20Files/checkout_address_whitelist.json`. These must be served through browser-accessible `https://…/content/…` URLs, not `davs://` WebDAV management URLs. Unknown storefronts, unavailable files, or invalid data leave the field hidden and checkout usable.

### BigCommerce custom address field contract

These are User Defined **Address Fields**, not Account Signup Fields. Keep the labels below aligned with `TECHHUB_FIELD_LABELS` in `packages/core/src/app/techhub/techhub.ts`. Label matching collapses whitespace and trims ends, but remains case-sensitive. The IDs supplied by each store are used to submit values; `field_52` is not a portable identifier for this policy.

| Exact label used by checkout | BigCommerce field type | TechHub behavior |
| --- | --- | --- |
| `Recipient College/Unit` | Pick List | Requires a selection. The selected option's display label determines which JSON group supplies locations. |
| `Delivery Location` | Text Field, non-required in store configuration | Checkout renders a required dropdown when the selected unit has locations; otherwise hides it. Changing College/Unit clears the selected location. |
| `Recipient UIN(s) or Name(s) (comma separated)` | Multiline Text Field | Required, with an inline validation error when input exceeds the 250-character total limit. Counts commas and spaces, including leading/trailing spaces in the original input. |
| `Recipient Account Number(s) (comma separated)` | Multiline Text Field | Applies the TechHub allowed-character rule and an inline validation error when input exceeds the 250-character total limit. Required status otherwise comes from store configuration. |
| `Department Code (include system part prefix, e.g. 02-ABCD)` | Text Field | Validates against the external department-code list and offers the lookup button. |

- Built-in first/last name, address lines, city, country, state/province, and postcode remain standard address properties. Company and phone are hidden by checkout. TechHub restricts Address Line 1, Address Line 2, city, postcode, recipient UIN/name, and account numbers to letters `A-Z`/`a-z`, digits, hyphen, parentheses, `$`, comma, period, and ordinary spaces. Newlines, apostrophes, and other characters do not pass that rule.
- `AddressForm.tsx` places custom inputs under the address's `customFields`. `mapAddressFromFormValues.ts` and `mapCustomFormFieldsFromFormValues.ts` map those values to BigCommerce's `{ fieldId, fieldValue }` entries. The selected Delivery Location is **one field** containing building and room joined with an em dash, e.g. `LAAH — 425`; if room is blank, only the building/location name is stored. It does not rewrite Address Line 1, Address Line 2, city, or postcode.
- The normal single-shipping flow submits the custom address values through the Checkout SDK and copies the shipping address to billing when the payment method does not supply remote billing. No customer address-book save is requested. Inspect a Test order to verify the resulting values in BigCommerce and downstream order consumers after a deployment.
- No separate Delivery Notes custom address field or automatic mapping of JSON `notes` exists. The whitelist notes are not displayed, included in Delivery Location, or sent as an order comment. The source still supports BigCommerce's separate order-comment control when store settings enable it; that is independent of whitelist notes.
- The recipient UIN/name and account-number limits are checkout validation policies, not demonstrated BigCommerce server-side constraints. The shared limit constant lives in `techhub.ts`; original-value validation is in `getCustomFormFieldsValidationSchema.ts`. Focused tests cover both boundaries, absence of permanent helper text/input truncation, and label matching across different IDs.

### Address and checkout-session policy

- Customer saved-address selectors and save-address controls are removed.
- Address writes force `shouldSaveAddress: false`.
- On every checkout page load, the checkout session is reset before rendering: shipping consignments/method, billing address, and order comment are cleared.
- Details is reopened on every new checkout visit and cannot be skipped until the shopper presses Continue, even if BigCommerce has retained valid address information.
- Billing is always the shipping address. The customer cannot opt out, and the “My billing address is the same as my shipping address” checkbox is not displayed.

### Terms and conditions

- The terms text is customized for TechHub.
- The checkout link uses the relative path `/terms-and-conditions/`, so it automatically points to the corresponding page on test or production. Ensure that page exists at the same path in both stores.

## Delivery-location whitelist reference

- The repository reference is [`data/checkout_address_whitelist.json`](data/checkout_address_whitelist.json), converted from `checkout_address_whitelist.csv` on 2026-10-19. It contains 114 location entries grouped by the CSV's exact `college_unit` labels, matching the format consumed by `loadTechHubDeliveryLocations()`.
- Each entry preserves `building`, `room`, and `notes` as strings, including empty values and leading zeros. Checkout uses building and room for its dropdown labels; notes are retained for future use.
- The CSV has no message-request column, and the JSON has no message-request field. Notes remain available as reference data; implementing delivery instructions from them requires an explicit checkout display/submission mapping in a future change.
- The JSON format is an object keyed by College/Unit display labels, each holding an array of location entries. For example:

```json
{
  "TAMU - College of Arts and Sciences": [
    { "building": "LAAH", "room": "425", "notes": "" },
    { "building": "HELD", "room": "005", "notes": "" },
    { "building": "McAllen", "room": "", "notes": "" }
  ]
}
```

- The source loader trims/collapses whitespace in unit and location labels, removes duplicate location labels, and sorts them for display. Preserve string values and the reference's data when editing; a CSV-style flat array or a metadata wrapper around the object will not match the current loader.
- The JSON is the source for Delivery Location choices, while BigCommerce's Recipient College/Unit pick list supplies the available units. Match the labels in both; adding a JSON group alone does not create a new College/Unit option in the store.
- This is the College/Unit delivery-location whitelist. Department-code validation uses the separate `TechhubDeptOutputBig.json` file.
- The reference file is not automatically copied into `build/` or `dist/` or uploaded by a checkout build. For production, upload it separately through WebDAV to `/content/JSON Files/checkout_address_whitelist.json`. Checkout fetches it at `https://store-jsj7fos9p1.mybigcommerce.com/content/JSON%20Files/checkout_address_whitelist.json`.
- For Test, upload the same file to `/content/Scripts/checkout_address_whitelist.json` on the Test store. For local development, serve it at `http://127.0.0.1:8080/checkout_address_whitelist.json`. Keep the repository reference and deployed copies in sync when updating the whitelist, and verify the HTTPS endpoint returns the JSON before release.
- Editing the deployed JSON updates choices without rebuilding checkout. Loaded locations are cached for the life of the page, and browser/server HTTP caching can delay updates; verify changes on a fresh checkout load using the actual network response. Changing the configured hostname or URL, adding notes handling, or changing dropdown behavior requires a source change and rebuild.

## Maintenance notes

- Source map for future maintenance:

| Area | Primary source |
| --- | --- |
| Field labels, allowed characters, recipient-field limit constant, JSON URLs, location formatting/sorting | `packages/core/src/app/techhub/techhub.ts` |
| Custom-field display, dependent dropdown, and lookup button | `packages/core/src/app/address/AddressForm.tsx`, `AddressForm.scss` |
| Custom and built-in field validation | `packages/core/src/app/formFields/getCustomFormFieldsValidationSchema.ts`, `getFormFieldsValidationSchema.ts` |
| Address submission format and disabling address-book saves | `packages/core/src/app/address/mapAddressFromFormValues.ts`, `packages/core/src/app/formFields/mapCustomFormFieldsFromFormValues.ts` |
| Checkout session reset before rendering | `packages/core/src/app/checkout/hooks/useLoadCheckout.ts` |
| Details confirmation gate, guest-group redirect, fixed-billing navigation | `packages/core/src/app/checkout/CheckoutPage.tsx` |
| Shipping submission and billing synchronization | `packages/core/src/app/shipping/Shipping.tsx`, `SingleShippingForm.tsx` |
| Heading and terms copy/link | `packages/locale/src/translations/en.json`, `packages/core/src/app/termsConditions/TermsConditionsField.tsx` |
| Checkout stylesheet load order | `packages/core/src/app/loader.ts` |
| Runtime-safe extension values | `packages/checkout-extension/src/` |
| Production build, generated loaders/manifests, build version selection | `webpack.config.js`, `packages/core/project.json`, `scripts/webpack/get-next-version.js` |

- Before upgrading from upstream, compare this document and reapply each item deliberately rather than blindly copying files.
- Add the date, purpose, affected source files, and any store-configuration dependency for every new customization.
- The production build uses transpile-only TypeScript handling. SDK `declare const enum` values are not present at runtime, so checkout extension regions and messages must use the local runtime-safe constants in `packages/checkout-extension/src/`.
- Production checkout styles load after the store theme styles. This preserves the checkout header’s centered inner container when the theme targets `.checkoutHeader-content`.

## Change log

| Date | Purpose | Affected source | Store dependency |
| --- | --- | --- | --- |
| 2026-10-26 | Changed the Recipient UIN/name character-limit UX and applied the same 250-character rule to Recipient Account Number(s): no permanent helper line or browser `maxlength`, with an inline validation error when either input exceeds 250 characters. | `techhub.ts`, `AddressForm.tsx`, `AddressForm.scss`, custom-field validation, focused tests, and documentation | Rebuild and deploy checkout; recipient field labels must match, but no store configuration change is needed. |
| 2026-10-20 | Added an AI-readable Linux build/deployment guide, updated the README for TechHub's workflow, and expanded the address-field and whitelist data contracts, including current notes behavior and verification requirements. | `README.md`, `TECHHUB_BUILD_GUIDE.md`, `TECHHUB_CUSTOMIZATIONS.md` | Inspect actual store loader URLs and WebDAV asset folders before deployment; the guide does not record a completed release. |
| 2026-10-20 | Limited Recipient UIN(s) or Name(s) to 250 characters with input enforcement, form validation, and helper text. | `techhub.ts`, `AddressForm.tsx`, `AddressForm.scss`, `getCustomFormFieldsValidationSchema.ts`, focused address and validation tests | Rebuild and deploy checkout; the Recipient UIN/name label must match in both stores. No BigCommerce field-ID change is needed. |
| 2026-10-19 | Stored the supplied CSV as a reusable delivery-location whitelist reference, preserving all rows and values in the existing runtime format. | `data/checkout_address_whitelist.json`, `TECHHUB_CUSTOMIZATIONS.md` | Upload the JSON separately to the configured Test and production WebDAV content paths; adding the reference does not deploy it. |
| 2026-08-19 | Established the TechHub-native baseline: labels-based custom-field handling, department-code validation, guest redirect, heading/terms copy, address-book removal, and checkout-session reset. | `packages/core/src/app/techhub/`, address, shipping, billing, payment, checkout, locale, and terms components | Customer group `10`; recipient-field labels must match in both stores; production WebDAV department-code JSON must remain reachable. |
| 2026-08-20 | Made billing permanently match shipping and added the department-code lookup control. | `AddressForm.tsx`, `CheckoutPage.tsx`, shipping forms, payment billing form | The Department Lookup Tool must remain available at the hardcoded production WebDAV URL. |
| 2026-08-20 | Restored the normal Order Summary heading and added a per-visit Details confirmation gate. | `en.json`, `CheckoutPage.tsx` | None. |
| 2026-08-20 | Enabled transpile-only handling in the production Webpack build so the deployable checkout bundle can be generated despite upstream declaration-file loading errors. | `webpack.config.js` | Run focused tests separately; `npm run build` now produces the WebDAV upload in `dist/`. |
| 2026-08-20 | Merged upstream `bigcommerce/checkout-js` `1.872.0` while preserving TechHub’s fixed-billing and per-visit Details-confirmation policies. | Upstream checkout, payment, customer, order-summary, dependency, and generated distribution files; TechHub `CheckoutPage.tsx` conflict resolution | Revalidate the custom checkout against both stores after each future upstream merge. |
| 2026-08-20 | Fixed the upstream SDK extension-region runtime error after the `1.872.0` merge. | Checkout extension runtime constants and extension insertion points | Required because transpile-only builds do not emit SDK `declare const enum` values. |
| 2026-08-20 | Made production checkout styles load after theme styles to prevent the theme’s `.checkoutHeader-content` rule from overriding the checkout header layout. | `loader.ts` | Theme CSS may target shared checkout markup; verify header alignment after future loader changes. |
| 2026-08-24 | Added an externally sourced, dependent Delivery Location dropdown beneath Recipient College/Unit, with code-enforced conditional requirement. | `techhub.ts`, `AddressForm.tsx`, shipping form, custom-field validation | Add a non-required Text Field labeled exactly `Delivery Location` to test and production. Local development loads `http://127.0.0.1:8080/checkout_address_whitelist.json`; that JSON is not yet on Test or production WebDAV. Configure and deploy the production WebDAV URL before enabling it outside local development. The JSON is optional at runtime. |
| 2026-08-31 | Sorted Delivery Location choices for usability. | `techhub.ts` | Normal mixed-case location names appear first; all-uppercase codes and building–room choices follow. Both groups sort alphabetically without changing the external JSON. |
| 2026-08-31 | Configured separate delivery-location JSON endpoints by storefront hostname. | `techhub.ts` | Local development retains its localhost JSON. Deployed Test uses the `store-jje9unvzjs` Scripts URL; production `tamu.mybigcommerce.com` uses the `store-jsj7fos9p1` checkout-address whitelist URL. |
