# Building Silicon for iOS

The web app (`dist/`) is wrapped as a native iOS app with **Capacitor**. Everything up to the
native build is done and committed; the steps below run on a **Mac with Xcode** (Capacitor cannot
generate or build the iOS project on Linux/CI without macOS).

Monetization: the app is a **free download** with the **Silicon Pro** subscription (monthly /
yearly, 7-day trial) and a one-time **Pro Lifetime** purchase. No ads, timers, currencies or
loot boxes — ever. Full model in `MONETIZATION.md`; App Store Connect setup in
`appstore/SUBSCRIPTION_GUIDE.md`. The legacy **Creative Mode** IAP stays live for the people who
bought it during the paid era, but is no longer offered.

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

**REQUIRED — lock orientation + ship iPhone-only** (the Capacitor template defaults to
portrait+landscape and iPhone+iPad; the UI is a portrait phone layout):
- **General → Deployment Info**: untick *Landscape Left* and *Landscape Right* (Portrait only).
  Without this, rotating the phone during App Review shows a sideways portrait layout.
- **General → Deployment Info → Supported Destinations / Device family**: **iPhone only**
  (`TARGETED_DEVICE_FAMILY = 1`). Otherwise Apple reviews the app on a 13" iPad — which would
  require iPad screenshots and shows a letterboxed 540px phone column — an avoidable rejection
  risk. Add iPad support deliberately in a later release if wanted.

Run on a simulator or a real device with the ▶ button to smoke-test.

---

## 4. In-app purchases (StoreKit 2 + RevenueCat — already wired)

`ios/App/App/SiliconStoreKit.swift` is a StoreKit 2 plugin covering products, purchase, restore,
subscription status, intro-offer eligibility, Apple's Manage Subscriptions sheet, and the original
download's build number (how paid-era buyers are recognised). `SiliconStoreKit+RevenueCat.swift` +
`RevenueCatConfig.swift` route the same bridge through RevenueCat's native iOS SDK — added via SPM,
**not** the CocoaPods-only `@revenuecat/purchases-capacitor` plugin, so the iOS target stays free of
CocoaPods deps. RevenueCat is the app's one third-party SDK, and the reason App Privacy declares
Purchase History + Device ID (see `appstore/REVENUECAT_SETUP.md`).

JS side: `src/state/proStore.ts` (Pro) and `src/state/iap.ts` (legacy Creative Mode), both through
the one shared bridge in `src/state/storeKitBridge.ts`.

**One-time Xcode setup:**

1. **Signing & Capabilities → + Capability → In-App Purchase.**
2. Optional but recommended for simulator work: add a **StoreKit Configuration File**
   (Product → Scheme → Edit Scheme → Run → Options → StoreKit Configuration) containing
   `com.wrexist.silicon.pro.monthly`, `.yearly`, `.lifetime` and `com.wrexist.silicon.sandbox`, so
   buy/restore can be exercised without App Store Connect.
3. Set `FIRST_FREE_BUILD` in `src/state/pro.ts` to the build number you ship free (**≥ 5** — paid
   builds were 1–4), then `npm run build && npx cap sync ios`.

**Everything else — creating the subscription group and SKUs, the trials, the legal URLs, the
sandbox test matrix, and the App Review notes — is in
[`appstore/SUBSCRIPTION_GUIDE.md`](appstore/SUBSCRIPTION_GUIDE.md).** Follow it rather than this
file; a product attached to the review build that can't complete is a Guideline 2.1 rejection.

To ship a build with the purchase path dark, set `NATIVE_PRO_WIRED = false` in `proStore.ts` (the
purchase UI hides itself) and don't attach the products.

---

## 5. TestFlight + App Store submission

1. Set the **Marketing Version** and **Build** number (Xcode → General).
2. **Product → Archive**, then **Distribute App → App Store Connect → Upload**.
3. In **App Store Connect**:
   - **Pricing:** app **Free**; Silicon Pro **$3.99/mo**, **$19.99/yr**, **$29.99 lifetime**
     (see `appstore/SUBSCRIPTION_GUIDE.md` — set the price to Free *with* this submission, not before).
   - **App Privacy:** the game has **no backend** — saves, settings and statistics stay on device
     (`localStorage` only) and there is no analytics, no tracking and no login. Purchases go through
     RevenueCat, so declare **Purchase History + Device ID**, both *app functionality*, both not
     linked and not used for tracking — matching `PrivacyInfo.xcprivacy` and `docs/privacy/`
     (`appstore/REVENUECAT_SETUP.md`).
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
