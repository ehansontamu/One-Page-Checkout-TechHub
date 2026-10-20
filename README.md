# TechHub One-Page Checkout

This repository is TechHub's custom BigCommerce checkout, maintained on `main` in `ehansontamu/One-Page-Checkout-TechHub`. It is a fork of [bigcommerce/checkout-js](https://github.com/bigcommerce/checkout-js), the browser application behind Optimized One-Page Checkout.

Last reviewed against repository source: 2026-10-20. This README describes the current source and workflow; it does not confirm that the latest source or whitelist has been deployed.

## Start here

- [TECHHUB_BUILD_GUIDE.md](TECHHUB_BUILD_GUIDE.md): Linux setup, source checks, tests, production build, WebDAV upload, Test/production verification, and rollback.
- [TECHHUB_CUSTOMIZATIONS.md](TECHHUB_CUSTOMIZATIONS.md): Intentional changes from upstream, exact custom-field labels, address submission behavior, external data contracts, and source-file references.
- [data/checkout_address_whitelist.json](data/checkout_address_whitelist.json): Repository reference for College/Unit delivery locations.

Future AI assistants should read both TechHub documents before helping with a build, checkout change, deployment, or upstream merge.

## Requirements

- Linux Bash shell, either native Linux or WSL. The repository scripts use Unix shell commands.
- Node major **22**; `.nvmrc` pins **22.13.0**.
- npm major **10**, as specified by `package.json`.
- Dependencies installed in the Linux environment from the committed `package-lock.json`.

With [NVM](https://github.com/nvm-sh/nvm#installation-and-update) already installed and loaded, run these commands from the repository root:

```bash
nvm install
nvm use
node --version
npm --version
npm ci
```

If Linux uses the same working tree as Windows, saved source changes are already present. A separate Linux clone needs those commits transferred or pulled. Reinstall dependencies when changing operating systems rather than reusing Windows `node_modules`.

## Build and test

Generate core exports before running Jest or TypeScript directly:

```bash
npm run generate
```

Run the relevant focused checks from the build guide. For wider core coverage:

```bash
npm run test:core
```

Build fresh production assets with Nx cache reuse disabled:

```bash
NX_DAEMON=false NX_SKIP_NX_CACHE=true npm run build
```

The build clears `dist/` and the test-framework report directory, then generates source and builds the required packages and checkout bundle. Save any previous local artifacts needed for rollback before rebuilding. Output includes loaders, manifests, hashed JavaScript/CSS chunks, translations, and supporting assets in `dist/`. Read the fresh manifest for the generated version; existing checked-in distribution files may be older than the current source.

The Webpack application build uses transpile-only TypeScript handling. A successful bundle does not establish that tests or `npm run typecheck` pass. Run checks appropriate to the change and report their actual results. `npm run lint` can modify source because the core lint target enables fixes.

`npm run e2e` performs another build, installs Playwright browsers, and runs HAR/replay tests. These complement manual TechHub checkout testing on the Test store. Use `npm run regenerate-har` only when intentionally updating recorded test fixtures.

Do not include generated `build/` or `dist/` files in TechHub source commits. Some upstream distribution files are already tracked, so inspect `git status` after building and stage source/documentation explicitly.

## Local development

In one Linux terminal:

```bash
npm run dev
```

After the first successful compilation, in another terminal:

```bash
cp data/checkout_address_whitelist.json build/checkout_address_whitelist.json
npm run dev:server
```

For an intended Test session, the custom checkout can load `http://127.0.0.1:8080/auto-loader-dev.js`. Development mode fetches the whitelist from localhost even when the checkout page is hosted by Test. Verify browser access to the local server, recopy the JSON when changing it, and restore the Test store's previous script URL afterward. See the build guide for details.

## Deployment and external data

Deploy to Test first, then promote the verified bundle to production. Upload the matching checkout assets through WebDAV and configure the store's Custom Checkout script setting with the HTTPS URL of the uploaded `auto-loader.js` or its versioned counterpart. Inspect each store's existing loader URL and asset folder before uploading; those current settings are not recorded in this repository.

| Environment | Storefront | Delivery-location JSON URL |
| --- | --- | --- |
| Test | `techhubtest.mybigcommerce.com` | `https://store-jje9unvzjs.mybigcommerce.com/content/Scripts/checkout_address_whitelist.json` |
| Production | `tamu.mybigcommerce.com` | `https://store-jsj7fos9p1.mybigcommerce.com/content/JSON%20Files/checkout_address_whitelist.json` |

The delivery-location whitelist is fetched at runtime and is **not bundled or uploaded by the build**. Upload the reference JSON separately to the configured content path. Updating that deployed JSON can change choices without rebuilding checkout; preserve its structure and matching College/Unit labels, keep the repository reference synchronized, and verify a fresh checkout load for caching effects.

Delivery Location is one custom address field containing building and room together. JSON `notes` are retained for future use and are not currently sent to BigCommerce. Department-code validation uses the separate production-hosted `TechhubDeptOutputBig.json`; see the customizations document for its URL and the lookup tool dependency.

`npm run build` does not publish to WebDAV or change store settings. The upstream release scripts (`release:alpha`, `release:version`) are not the routine TechHub deployment process: they perform version/release actions and can stage generated distribution files. The inherited CircleCI configuration does not establish that a TechHub `main` commit deploys to either store. Follow the build guide for verification and rollback.

## Maintaining this fork

Preserve the customizations record during upgrades, including the dependent delivery dropdown, 250-character UIN/name limit, fixed-billing policy, checkout-session reset, Details confirmation gate, runtime-safe extension constants, and stylesheet load order. Match custom fields by their display labels rather than hardcoded store-specific IDs.

Update the TechHub documents when source behavior, build steps, or store dependencies change. Record actual build/test/deployment results separately from intended behavior.

The inherited [CONTRIBUTING.md](CONTRIBUTING.md) describes upstream contribution and branch workflows; adapt those instructions to TechHub's `main` branch and customization policy. See also the [code of conduct](CODE_OF_CONDUCT.md), [license](LICENSE.md), and [BigCommerce custom checkout installation documentation](https://developer.bigcommerce.com/stencil-docs/customizing-checkout/installing-custom-checkouts).

Copyright (C) 2019-Present BigCommerce Inc. All rights reserved.
