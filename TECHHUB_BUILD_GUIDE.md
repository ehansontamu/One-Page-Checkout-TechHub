# TechHub Checkout Build and Deployment Guide

Last reviewed against repository source: 2026-10-20.

Use this guide when helping build this fork of `bigcommerce/checkout-js`. Read [TECHHUB_CUSTOMIZATIONS.md](TECHHUB_CUSTOMIZATIONS.md) first to understand the behavior that must survive a build or upstream upgrade. The commands below run from the repository root in a Linux Bash shell, including native Linux or WSL. They are based on this repository's scripts, not a completed production deployment.

## 1. Confirm the checkout and source changes

The TechHub repository is `ehansontamu/One-Page-Checkout-TechHub`; its custom branch is `main`. Inspect the current checkout before changing branches or fetching updates:

```bash
pwd
git remote -v
git branch --show-current
git status --short
git log -5 --oneline
```

On Windows the working directory used for these changes is `C:\github\One-Page-Checkout-TechHub`. WSL usually sees it as `/mnt/c/github/One-Page-Checkout-TechHub`. Native Linux may mount that drive elsewhere, or use a separate clone: locate the actual repository instead of assuming a Linux path. Changes saved in the same working tree are already present; a separate clone needs the relevant commits transferred or pulled. Uncommitted Windows edits do not appear in a separate clone.

At the time this guide was written, the whitelist reference and UIN limit had been committed as `1220b446d` and `080560570`. Those commits are useful history references, not commits to check out for every future build. Confirm the intended source is present in the current revision.

Preserve user changes. Do not use `git reset --hard`, `git clean`, or replace this fork with upstream to prepare a build. If the user wants a separate clone updated, fetch and inspect the branch before integrating remote changes.

## 2. Set up the Linux build environment

Use the versions specified by the repository:

- `.nvmrc`: Node `22.13.0`.
- `package.json` engines: Node major `22`, npm major `10`.
- Linux shell: scripts use commands such as `rm -rf` and shell-style environment assignments. Windows PowerShell is not the build workflow documented here.

If NVM is already installed and loaded:

```bash
nvm install
nvm use
node --version
npm --version
npm ci
```

Otherwise use an existing Linux Node installation matching those requirements and run `npm ci`. Install from the committed `package-lock.json`; do not substitute a dependency upgrade for a normal build. `npm ci` replaces `node_modules`, so reinstall after switching between Windows and Linux or after a lockfile change. Do not reuse dependencies installed for a different operating system.

A production bundle does not require WebDAV credentials or a `.env` file. `.env-example` is for the test framework (`PORT`, `MODE`, `STOREURL`), not a checkout deployment configuration. Network access is needed to install dependencies.

## 3. Generate source and run relevant checks

Before invoking Jest or TypeScript directly, generate the core exports and polyfill:

```bash
npm run generate
```

The normal Nx build also depends on this generation step. Generated files under `packages/**/generated` are ignored and must not be maintained by hand.

For the recipient UIN/name limit, run the focused tests:

```bash
npx jest --config=packages/core/jest.config.js --runInBand --runTestsByPath \
  packages/core/src/app/address/AddressForm.test.tsx \
  packages/core/src/app/formFields/getCustomFormFieldsValidationSchema.test.tsx
```

These cover the rendered textarea maximum, different field IDs, exactly 250 characters, oversized input including leading/trailing spaces, and the existing required/allowed-character rules. The UIN change's tests were added on Windows but could not be executed there because repository dependencies were not installed. Run them in Linux and report the actual result; do not treat their existence as a passing test run.

Choose additional checks for the changed area:

| Change | Relevant checks |
| --- | --- |
| Address fields or validation | Focused address/validation suites; `npm run test:core` for wider core coverage |
| Checkout session reset or Details confirmation | Core checkout/hook suites and manual revisit testing |
| Extension runtime constants | `npm run test:extension` and browser runtime checks |
| Styles or loader behavior | Test checkout on desktop/mobile; header alignment and console/network checks |
| Broad upstream merge or dependency update | `npm test`, `npm run lint`, `npm run typecheck`, and appropriate E2E coverage |

`npm run test:core` uses the repository's Jest wrapper and does not perform core generation itself. `npm run lint` can modify files because the core lint target enables fixes; inspect its diff afterward.

The application Webpack build uses `ts-loader` with `transpileOnly: true`. A successful bundle does not prove the full TypeScript check passes. Run `npm run typecheck` when the change warrants it and distinguish existing errors from new ones. Diagnose failures and report unresolved errors rather than changing validation or restoring retired behavior merely to make checks green.

`npm run e2e` performs another build, installs Playwright browsers, and runs the upstream HAR/replay tests. It can take additional setup and is not a substitute for testing TechHub fields against the Test store.

## 4. Build the production assets

For a fresh deployable build, bypass Nx cache reuse:

```bash
NX_DAEMON=false NX_SKIP_NX_CACHE=true npm run build
```

This runs `prebuild`, which removes the repository's `dist/` and test-framework report directory, then runs the Nx core build, its dependencies, and Webpack in production mode. Save any previous local build needed for rollback outside `dist/` before running it. Do not point cleanup commands at store content or other directories.

`npm run build` compiles local source; it does not upload to WebDAV, change store settings, create a Git release, or publish the whitelist. Do not use `release:alpha` or `release:version` as a routine TechHub build command: those scripts perform upstream version/release actions and can stage `dist/`.

If a build fails, use the first meaningful error to choose the next step. Check Node/npm versions, dependency installation, generated exports, and available disk/memory. If the workspace-tools generator cannot be resolved, inspect its build target and run `npx nx build workspace-tools` before retrying generation if needed. For stale Nx state, `npx nx reset` is available after diagnosis. Do not repeatedly rebuild without addressing the cause.

Keep the local runtime extension constants in `packages/checkout-extension/src/`; SDK `declare const enum` exports are not runtime values under the transpile-only build. Preserve the loader's `prepend: false` stylesheet behavior so checkout styles load after theme styles.

## 5. Check the fresh output

```bash
test -s dist/auto-loader.js
test -s dist/loader.js
test -s dist/manifest.json
node -e 'const m = require("./dist/manifest.json"); if (!m.appVersion) process.exit(1); console.log("Built appVersion:", m.appVersion);'
git diff --check
git status --short
```

Expected output includes `auto-loader.js`, `loader.js`, their versioned counterparts, manifests, hashed JavaScript/CSS chunks, translations, and other emitted assets. Upload a consistent set from this successful build. The loader embeds its asset list and integrity hashes; editing generated JavaScript or CSS afterward, or combining files from different builds, can break loading.

Do not hardcode the output version from `package.json`: `scripts/webpack/get-next-version.js` derives it using Git history and the package version. Read the fresh manifest and filenames. The checked-in `dist/` observed when this guide was written reported `1.868.2` while `package.json` reported `1.872.0`; existing files are not evidence that the current source has been built.

Some upstream distribution files are tracked in Git even though TechHub's policy is to keep generated output out of custom source commits. After building they may appear as modifications or new files. Stage intended source/documentation changes explicitly; do not use `git add .` to sweep build output into the commit. Preserve needed deployment artifacts before removing any local output.

## 6. Upload and configure the Test checkout

Use Test first: `techhubtest.mybigcommerce.com`, with content hosted at `store-jje9unvzjs.mybigcommerce.com`.

1. Inspect the Test store's currently configured custom checkout script URL and WebDAV directory. Save the previous URL and deployment files so rollback is possible.
2. Upload the fresh checkout assets to that store's intended checkout asset directory, preserving relative filenames and directories. A separate release directory can keep the previous bundle available; if reusing a directory, upload chunks and supporting files before the loader that references them and retain files needed by older cached loaders.
3. Point the store's Custom Checkout script setting at the browser-accessible HTTPS URL of the freshly uploaded `auto-loader.js` or its versioned counterpart. The loader derives the asset base path from its own URL unless an explicit public path is supplied, so referenced assets must be reachable beside it.
4. Upload `data/checkout_address_whitelist.json` separately to the fixed Test whitelist path listed below. The whitelist URL is independent of the checkout bundle's directory.
5. Confirm the endpoint returns JSON and the browser can fetch it without CORS errors. Verify the whitelist labels match the store's Recipient College/Unit option labels.

The exact current checkout bundle folder and configured Test/production script URLs have not been recorded in this repository. Future assistants must inspect the current store settings or obtain those details from the user; do not assume the whitelist's folder is also the bundle folder. Use WebDAV management credentials for uploads, and HTTPS `/content/...` URLs for browser loading. The upstream README links BigCommerce's custom checkout installation documentation if UI setting names have changed.

## 7. Manage the separate whitelist

| Environment | WebDAV content path | Runtime URL |
| --- | --- | --- |
| Local development | Served at the local server root | `http://127.0.0.1:8080/checkout_address_whitelist.json` |
| Test | `/content/Scripts/checkout_address_whitelist.json` | `https://store-jje9unvzjs.mybigcommerce.com/content/Scripts/checkout_address_whitelist.json` |
| Production (`tamu.mybigcommerce.com`) | `/content/JSON Files/checkout_address_whitelist.json` | `https://store-jsj7fos9p1.mybigcommerce.com/content/JSON%20Files/checkout_address_whitelist.json` |

The source reference is [data/checkout_address_whitelist.json](data/checkout_address_whitelist.json). It contains College/Unit keys with arrays of string-valued `building`, `room`, and `notes` entries. Checkout submits one Delivery Location value combining building and room; notes are currently retained in the JSON only. See the customizations document for the full field contract.

Replacing a deployed whitelist with the same structure and matching labels changes location choices without rebuilding checkout. Update the repository reference as well. A page caches loaded locations in memory, and HTTP caches may retain the file; check a fresh checkout load and browser network response when verifying updates. Adding a College/Unit to the JSON does not add a matching pick-list option in BigCommerce.

The department-code file `TechhubDeptOutputBig.json` and Department Lookup Tool are separate production-hosted dependencies used by both stores. Preserve them; uploading the delivery-location whitelist does not replace either one.

## 8. Test the store and promote to production

On a fresh Test checkout, verify:

- `Order Summary`, `Details`, and `Shipping and Billing Info` labels; centered header on desktop and mobile; company/phone fields hidden.
- Recipient College/Unit selection produces the expected locations. Building and room are stored in one custom address field; units with no valid locations leave Delivery Location hidden. Changing College/Unit clears the prior selection. Valid location choices make the field required.
- The UIN/name field shows the 250-character helper text. Typing/pasting cannot exceed 250; validation rejects oversized values introduced programmatically. Required-field and allowed-character checks still work.
- Department-code validation and the lookup button work, and all JSON requests use the correct environment URLs.
- Saved-address selectors/save controls stay absent, billing follows shipping in the normal flow, and a fresh checkout visit resets previous checkout details and requires Continue in Details.
- The terms link opens the corresponding store's `/terms-and-conditions/` page.
- The console has no missing extension-runtime errors; loader/chunk requests have no 404, CORS, or integrity failures.
- With a Test order when appropriate, BigCommerce receives the expected custom address values. JSON notes are not expected in the order. This confirms actual submission, beyond what source inspection can prove.

After Test validation and the user's release authorization, upload the verified production-mode bundle to the production store's intended checkout asset directory and configure its HTTPS loader URL. The same production-mode bundle selects the whitelist endpoint by storefront hostname; a new bundle is unnecessary solely to switch from Test to production. Upload/verify the production whitelist separately and repeat the relevant smoke checks on `tamu.mybigcommerce.com`.

If rollback is needed, restore the previous configured loader URL and its matching assets. If the whitelist changed, restore its previous copy too. Reload to check caching. Record the source commit, manifest appVersion, checks and results, target store, deployed loader URL, asset folder, and whitelist update in the release notes. A local build alone is not a deployed or validated release.

## Optional: local development preview

For watch-mode work, use separate Linux terminals:

```bash
npm run dev
```

After the first successful compilation, copy the reference JSON into the development server root:

```bash
cp data/checkout_address_whitelist.json build/checkout_address_whitelist.json
npm run dev:server
```

The Test store can load `http://127.0.0.1:8080/auto-loader-dev.js` for this workflow, as described in the upstream README. Configure that only for the intended Test session, verify the browser permits local loading, and restore the previous Test loader URL afterward. Development mode always requests the localhost whitelist, even though the checkout page is hosted by Test. Recopy the JSON after changing the reference. Stop the watch/server processes with Ctrl+C when finished.

For future AI sessions, a useful starting prompt is: "Read TECHHUB_BUILD_GUIDE.md and TECHHUB_CUSTOMIZATIONS.md. Help me build the current TechHub source in Linux, run the relevant checks, and prepare the files for Test. Report any failures and the generated loader version before deployment."
