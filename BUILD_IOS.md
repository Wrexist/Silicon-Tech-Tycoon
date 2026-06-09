# Building Silicon for iOS

The web app (`dist/`) is wrapped as a native iOS app with **Capacitor**. Everything up to the
native build is done and committed; the steps below run on a **Mac with Xcode** (Capacitor cannot
generate or build the iOS project on Linux/CI without macOS).

Monetization is **LOCKED**: a single paid **$8.99 premium** download + one optional non-consumable
IAP — **Creative Mode** (the Sandbox unlock). No other purchases, ads, or gates. Ever.

---

## 0. Prerequisites (once)

- macOS + **Xcode** (latest), with the Command Line Tools installed.
- An **Apple Developer Program** membership (for signing, TestFlight, and App Store Connect).
- **Node 20+** and the repo cloned. Run `npm ci`.
- CocoaPods: `sudo gem install cocoapods` (Capacitor uses it for native deps).

---

## 1. Build the web bundle + add the iOS project

```bash
npm ci
npm run build                 # tsc -b && vite build → dist/
npx cap add ios               # creates ios/ (first time only)
npx cap sync ios              # copies dist/ + native config into the iOS project
```

`capacitor.config.ts` already sets the app id **`com.wrexist.silicon`**, name **Silicon**,
dark background, splash, and status-bar style. `ios/` is generated, not committed — re-running
`cap add ios` is safe.

> After **any** web change, re-bundle and re-sync: `npm run build && npx cap sync ios`.

---

## 2. App icon + splash (generated, zero image assets)

The master icon is generated parametrically from the chip mark (`public/icon.svg`):

```bash
npm run assets:icons          # writes resources/icon.png (1024², opaque — App Store compliant)
npx @capacitor/assets generate --ios   # emits the full AppIcon set + splash into ios/
```

`resources/icon.png` is 1024×1024, **opaque, no rounded corners** (iOS applies the mask) — exactly
what the App Store requires. To restyle the icon, edit `public/icon.svg` and re-run both commands.

---

## 3. Open in Xcode + signing

```bash
npx cap open ios              # opens ios/App/App.xcworkspace
```

In Xcode → **App** target → **Signing & Capabilities**:
- Select your **Team**; let Xcode manage signing.
- Confirm the **Bundle Identifier** is `com.wrexist.silicon`.
- Add the **In-App Purchase** capability.

Run on a simulator or a real device with the ▶ button to smoke-test.

---

## 4. Wire StoreKit for the Creative Mode IAP

The purchase UI and entitlement flow are built; the native StoreKit calls are stubbed in
`src/state/iap.ts` (search for `NATIVE INTEGRATION POINT`). **While unwired, the app hides the
Creative Mode purchase UI on iOS** (`iapAvailable()` returns false), so you have two valid paths:

- **Ship v1 without the IAP** — do NOT create or attach the IAP in App Store Connect; submit the
  base game; wire StoreKit in a 1.x update. Nothing else to do in this section.
- **Ship v1 with the IAP** — complete ALL steps below **before submitting**. If the IAP is
  attached to the review version, App Review will test the purchase; a dead or hidden buy button
  with an attached IAP is a Guideline 2.1 rejection.

1. **App Store Connect** → your app → **In-App Purchases** → create a **Non-Consumable**:
   - Product ID: **`com.wrexist.silicon.sandbox`** (must match `SANDBOX_PRODUCT_ID`).
   - Reference name: "Creative Mode", price tier ≈ **$2.99**, with a localized display name +
     description and a review screenshot.

2. **Install a purchases plugin:**
   ```bash
   npm i cordova-plugin-purchase   # v13+, works with Capacitor
   npx cap sync ios
   ```
   > ⚠️ Older versions of this doc referenced `@capacitor-community/in-app-purchases` — that
   > package **does not exist on npm**. Alternative: `@revenuecat/purchases-capacitor` (requires a
   > free RevenueCat account + API-key configure step; check its compatibility table for the major
   > that supports this project's Capacitor version before installing).

3. **Complete `src/state/iap.ts`** — implement the three `NATIVE INTEGRATION POINT` stubs
   (`getSandboxProduct`, `purchaseSandbox`, `restoreSandbox`) against the installed plugin's real
   API, calling `grantSandboxEntitlement()` on a verified transaction. The commented sketches in
   each stub follow cordova-plugin-purchase v13 — verify them against the plugin docs. Then flip
   **`NATIVE_IAP_WIRED` to `true`** (top of iap.ts) so the purchase UI shows on device, and
   `npm run build && npx cap sync ios`.

4. **Local testing:** add a **StoreKit Configuration File** in Xcode (Product → Scheme → Edit
   Scheme → Run → Options → StoreKit Configuration) with the same product id, so you can test
   buy/restore in the simulator without App Store Connect. Verify both **Unlock** and
   **Restore purchase** complete on a device before submitting.

The entitlement persists on-device (`silicon.iap.sandbox`), survives new games/restarts, and
**Restore purchase** re-grants it after reinstall once StoreKit is wired. Settings shows the
price + Unlock when unowned, and a free on/off toggle once owned.

---

## 5. TestFlight + App Store submission

1. Set the **Marketing Version** and **Build** number (Xcode → General).
2. **Product → Archive**, then **Distribute App → App Store Connect → Upload**.
3. In **App Store Connect**:
   - **Pricing:** app **$8.99** (paid up front); IAP **$2.99**.
   - **App Privacy:** the app collects **no data** and has **no backend** — it's fully offline
     (`localStorage` only). Declare "Data Not Collected".
   - **Metadata + screenshots:** use `STORE_LISTING.md` (name, subtitle, keywords, description).
     Capture screenshots with the helper: `node scripts/shots.mjs` (see §6).
   - Attach the IAP to the version for review.
4. Submit for review.

---

## 6. Marketing screenshots

A finished, branded set already lives in **`app-store-screenshots/6.7/`** (1290×2796) — headline +
live capture + wordmark on the brand background. To regenerate (it auto-stages a rich late-game
save, so the numbers always look good):

```bash
npm run dev &                 # serve the app
node scripts/shots.mjs        # rewrites app-store-screenshots/6.7/*.png
```

Needs Playwright once: `npm i -D playwright && npx playwright install chromium`. Change `SIZE` at
the top of `scripts/shots.mjs` for other device sizes (6.9" 1320×2868, 6.5" 1242×2688).

---

## Gotchas

- **IP rule:** no real brand/product/chip names anywhere — ship-blocker. All content is fictional.
- **Re-sync after web changes:** `npm run build && npx cap sync ios` — the iOS project serves the
  bundled `dist/`, not the dev server.
- **`ios/` is not committed** (it's regenerated). Commit only `capacitor.config.ts`, `resources/`,
  and source.
- **Safe areas** are already handled (`viewport-fit=cover` + `env(safe-area-inset-*)` throughout),
  so the notch/Dynamic Island and home indicator are respected with no extra work.
