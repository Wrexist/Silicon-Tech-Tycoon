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
| Wiring flag | `NATIVE_IAP_WIRED` (top of `iap.ts`) — **`true`** (StoreKit wired) |
| Native plugin | `ios/App/App/SiliconStoreKit.swift` — StoreKit 2, **no third-party SDK** |
| Entitlement store | `src/state/entitlements.ts` (+ mirrored to `@capacitor/preferences`) |

### How the app behaves today (wired)
`iapAvailable()` returns `true` on native, so **Settings → Creative Mode** shows the
**Unlock · $2.99** button and **Restore purchase**. Purchases go through StoreKit 2 on
device (`SiliconStoreKit.swift`): a confirmed purchase finishes the transaction and grants
the entitlement; cancel/pending/error never unlock. The web/PWA build still simulates a
successful purchase (it is not a sales channel; this is only for testing in the browser).

> Because the IAP is wired, if you attach it to the review build it MUST be created in App
> Store Connect (Step 1) and tested (Step 3). To ship v1 **without** the IAP instead, set
> `NATIVE_IAP_WIRED = false` (the purchase UI hides itself) and don't attach it.

---

## Decision: ship WITH or WITHOUT the IAP

### Option A — Ship v1 WITHOUT the IAP (fastest, lowest risk) ✅ recommended for first submit
- Do **NOT** create the IAP in App Store Connect.
- Do **NOT** attach any IAP to the version.
- Set `NATIVE_IAP_WIRED = false` (it currently ships `true`). The app hides the purchase UI automatically.
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

## Step 2 — Wire StoreKit ✅ DONE

**This is already implemented — no plugin to install, no code to write.** StoreKit 2 is
wired directly:

- **Native:** `ios/App/App/SiliconStoreKit.swift` — a small custom Capacitor plugin using
  StoreKit 2 (`Product.products`, `product.purchase()`, `Transaction.currentEntitlements`,
  `AppStore.sync()`). Auto-registered via `CAPBridgedPlugin` (no AppDelegate wiring). It's
  already added to the App target in `App.xcodeproj`.
- **Bridge:** `src/state/iap.ts` calls it via `registerPlugin("SiliconStoreKit")` and all
  three `NATIVE INTEGRATION POINT`s are implemented. `NATIVE_IAP_WIRED = true`.
- **Live transactions:** `initIapListeners()` (called from `src/native.ts`) listens for
  Ask-to-Buy / Family-Sharing approvals and grants the entitlement the moment they clear.

> **Why a custom StoreKit 2 plugin and not `cordova-plugin-purchase` / RevenueCat?** The iOS
> target is **SPM-only** (no CocoaPods, and `Package.swift` is Capacitor-managed), and the
> app's privacy policy / App Privacy label declare **no third-party SDKs and no data
> collected**. A first-party StoreKit 2 plugin keeps that true, needs no backend, and is tiny
> for a single non-consumable.

### The only remaining setup (one-time, in Xcode)
1. Open `ios/App/App.xcodeproj`. Confirm `SiliconStoreKit.swift` is in the **App** target
   (it is, via the project edit; if you ever regenerate the project from scratch, drag the
   file into the App group and tick the **App** target).
2. **Signing & Capabilities → + Capability → In-App Purchase** on the App target. Also enable
   In-App Purchase on the App ID (developer.apple.com → Identifiers → `com.wrexist.silicon`).
3. `npm run build && npx cap sync ios` to bundle the latest web build.

> To ship v1 **without** the IAP instead, set `NATIVE_IAP_WIRED = false` in `iap.ts`
> (the Settings purchase row hides itself) and don't attach the IAP to the version.

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
- [x] StoreKit 2 wired — `SiliconStoreKit.swift` + all three `NATIVE INTEGRATION POINT`s in `iap.ts`
- [x] `NATIVE_IAP_WIRED = true`
- [ ] `npm run build && npx cap sync ios` run on your machine
- [ ] IAP created in App Store Connect (`com.wrexist.silicon.sandbox`, Non-Consumable, $2.99)
- [ ] App ID + Xcode target have the In-App Purchase capability
- [ ] Buy **and** Restore tested with a `.storekit` config file (and once with a Sandbox Apple ID)
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
after a reinstall via StoreKit's `AppStore.sync()` + `Transaction.currentEntitlements`.
