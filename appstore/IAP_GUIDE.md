# Silicon: Tech Tycoon — Complete IAP Guide

The **only** in-app purchase in v1 is **Creative Mode** — a one-time, non-consumable
"Sandbox" unlock ($2.99) that gives an unlimited cash floor so you can never go bankrupt.
The base game is a complete, winnable **paid** download ($8.99). No other purchases, ever.

> **You have two valid launch paths.** Read "Decision: ship with or without the IAP" first.
> Picking wrong is the one thing that causes an App Store rejection here.

---

## Key facts (don't change these without reason)

| Thing | Value |
|---|---|
| Product ID | `com.wrexist.silicon.sandbox` |
| Type | **Non-Consumable** |
| Price | **$2.99** (Tier 3) |
| Reference name | `Creative Mode` |
| Display name | `Creative Mode` |
| Family Sharing | **On** (it's non-consumable) |
| Code seam | `src/state/iap.ts` |
| Wiring flag | `NATIVE_IAP_WIRED` (top of `iap.ts`) — currently `false` |
| Entitlement store | `src/state/entitlements.ts` (+ mirrored to `@capacitor/preferences`) |

### How the app behaves today (unwired)
`iapAvailable()` returns `false` on a native build while `NATIVE_IAP_WIRED === false`.
The Settings screen then **hides the entire Creative Mode purchase row** — so there is
**no dead "Buy" button** for App Review to fail. The web/PWA build always simulates a
successful purchase (it is not a sales channel; this is only for testing in the browser).

---

## Decision: ship WITH or WITHOUT the IAP

### Option A — Ship v1 WITHOUT the IAP (fastest, lowest risk) ✅ recommended for first submit
- Do **NOT** create the IAP in App Store Connect.
- Do **NOT** attach any IAP to the version.
- Leave `NATIVE_IAP_WIRED = false`. The app hides the purchase UI automatically.
- Submit. Add Creative Mode in a **1.1 update** once the base app is live.
- **Why:** zero StoreKit work, zero rejection risk from an untested purchase. The base
  game is whole on its own.

### Option B — Ship v1 WITH the IAP
- Create the IAP (Step 1), **wire StoreKit** (Step 2), test it (Step 3), then attach it
  to the version at submission.
- **Rule:** if the IAP is *attached to the review build*, it MUST be fully working. App
  Review tests every visible purchase. An IAP that can't complete = **Guideline 2.1
  rejection**. Never create/attach the IAP without doing Step 2.

---

## Step 1 — Create the IAP in App Store Connect

1. **appstoreconnect.apple.com** → your app → **Monetization → In-App Purchases → +**
2. Fill in:
   | Field | Value |
   |---|---|
   | Type | **Non-Consumable** |
   | Reference Name | `Creative Mode` |
   | Product ID | `com.wrexist.silicon.sandbox` |
3. **Pricing:** $2.99 (price point Tier 3).
4. **App Store Localization** (English U.S.):
   - Display Name: `Creative Mode`
   - Description: `Unlocks Creative Mode — a Sandbox with unlimited funds so you can design and launch any product without financial pressure. The base game is complete without this purchase. Permanent and restores across devices.`
5. **Review screenshot (required):** a screenshot of the **Settings** screen showing the
   Creative Mode row. (Capture it from a build where `NATIVE_IAP_WIRED = true`, or from the
   web build where the row is always visible.)
6. **Availability:** all countries. **Family Sharing:** On.
7. Save. The IAP will sit in "Ready to Submit" — it gets reviewed *with* your version.

> Also make sure the App ID has the **In-App Purchase** capability enabled
> (developer.apple.com → Identifiers → `com.wrexist.silicon`), and add the
> **In-App Purchase** capability to the App target in Xcode (Signing & Capabilities → +).

---

## Step 2 — Wire StoreKit (only for Option B)

Everything routes through **`src/state/iap.ts`**. There are exactly **three**
`NATIVE INTEGRATION POINT` markers to implement, then one flag to flip.

### 2.1 Install a purchases plugin
```bash
npm i cordova-plugin-purchase      # v13+ — works with Capacitor
npx cap sync ios
```
> ⚠️ Do **not** use `@capacitor-community/in-app-purchases` — that package does not exist
> on npm (verified). Alternative: `@revenuecat/purchases-capacitor` (needs a free
> RevenueCat account + an API key + a `configure()` call; check its compatibility table
> against this project's Capacitor major **before** installing).

### 2.2 Implement the three integration points
Open `src/state/iap.ts`. Each marker has a commented `cordova-plugin-purchase v13` sketch
right above it — verify each call against the plugin's current docs, then implement:

- **POINT 1/3 — `getSandboxProduct()`**: return the live localized product (title,
  description, price) from the store; fall back to `SANDBOX_FALLBACK` if not loaded yet.
- **POINT 2/3 — `purchaseSandbox()`**: register the product as `NON_CONSUMABLE` on the
  Apple App Store platform, initialize the store once, wire `approved → verify → verified
  → finish + grantSandboxEntitlement()`, then `order()` the offer. Map a cancelled payment
  to `{ status: "cancelled" }`.
- **POINT 3/3 — `restoreSandbox()`**: call `store.restorePurchases()`; the verified
  handler re-grants the entitlement; return `{ restored: hasSandboxEntitlement() }`.

Keep the contract intact: **never throw**, and always grant via
`grantSandboxEntitlement()` (from `entitlements.ts`) so the existing UI + the
`@capacitor/preferences` mirror + cross-device restore keep working.

### 2.3 Flip the flag and rebuild
At the top of `iap.ts`:
```ts
const NATIVE_IAP_WIRED = true;
```
```bash
npm run build && npx cap sync ios
```
Flipping it to `true` makes `iapAvailable()` return `true` on native, so Settings shows the
Buy + Restore buttons again.

---

## Step 3 — Test the purchase (Option B)

Test locally with a **StoreKit Configuration file** (no real money, no sandbox Apple ID needed):

1. Xcode → **Product → Scheme → Edit Scheme → Run → Options → StoreKit Configuration**.
2. Click **+** to create a `.storekit` file.
3. Add a **Non-Consumable** product:
   - Product ID: `com.wrexist.silicon.sandbox`
   - Price: `$2.99`
   - Display name / description: as above.
4. Run on a simulator or device and verify, in **Settings → Creative Mode**:
   - **Buy** completes → the Sandbox toggle appears, and the cash floor activates in play.
   - **Restore purchase** re-grants it (delete + reinstall the app, then Restore → it
     comes back).
   - **Cancel** mid-purchase leaves the buy button intact (no error toast loop).

For a final check before submission, also test once with a **Sandbox Apple ID**
(App Store Connect → Users and Access → Sandbox Testers) on a real device.

---

## Step 4 — Attach to the version (Option B only)

App Store Connect → your version → **In-App Purchases** section → **+** → add
`Creative Mode`. (Skip this entirely for Option A.)

---

## Acceptance checklist

**Option A (no IAP):**
- [ ] `NATIVE_IAP_WIRED` is `false`
- [ ] No IAP created / none attached to the version
- [ ] On device, Settings shows **no** Creative Mode purchase row

**Option B (with IAP):**
- [ ] IAP created in App Store Connect (`com.wrexist.silicon.sandbox`, Non-Consumable, $2.99)
- [ ] App ID + Xcode target have the In-App Purchase capability
- [ ] All three `NATIVE INTEGRATION POINT`s implemented in `iap.ts`
- [ ] `NATIVE_IAP_WIRED = true`, `npm run build && npx cap sync ios` run
- [ ] Buy **and** Restore tested with a StoreKit config file (and once with a Sandbox Apple ID)
- [ ] IAP attached to the submitted version
- [ ] Review note explains how to reach + test the purchase (see APP_STORE_METADATA.md)

---

## FAQ

**Do I need the IAP to launch?** No. The base game is complete and winnable. Option A ships
today; add Creative Mode later.

**Will Option A get rejected for a "hidden" purchase?** No — there is no purchase UI at all
when unwired, so there's nothing to test or fail.

**What does Creative Mode actually do?** It sets an unlimited cash floor (you can't go
bankrupt) for pressure-free designing. It's not a progression gate and grants no content the
base game withholds — purely a sandbox convenience. (This is important for review: it's not
"pay to win/progress.")

**Where is the entitlement stored?** `localStorage` via `entitlements.ts`, mirrored to
`@capacitor/preferences` so it survives WKWebView eviction; `restoreSandbox()` recovers it
after a reinstall once StoreKit is wired.
