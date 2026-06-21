# Ship Readiness — v1.0 pre-flight (audited 2026-06-21)

A source-level audit of everything that blocks an App Store submission, so the owner hits **zero
surprises** in Xcode / App Store Connect. This is the agent-verifiable half of Phase 0; the rest is
owner-side (Apple account, Mac, on-device smoke). Detailed steps live in `WHAT_YOU_NEED_TO_DO.md` —
this file is the *verified state* of the repo against that checklist.

## Verdict
**The repo is fully ship-ready, including the Creative-Mode IAP.** No code blockers found. The only
remaining work is owner-side App Store Connect setup + a TestFlight device smoke.

---

## Verified green (read from source this audit)

| Area | Checked | State |
|---|---|---|
| Build gate | `tsc -b` + 384 vitest tests + `vite build` (+PWA) | ✅ all green |
| CI | `.github/workflows/ci.yml` — typecheck/test/build on PR + main | ✅ sound |
| TestFlight CI | `ios-testflight-capacitor.yml` — ASC API-key cloud signing, archive→export→altool upload, secret preflight, team `S3U8B8HH96` | ✅ wired (corrupt legacy workflow already removed) |
| Bundle ID | `com.wrexist.silicon` — `capacitor.config.ts`, `project.pbxproj`, IAP, listing all agree | ✅ consistent |
| Orientation/device | `Info.plist` portrait-only; `TARGETED_DEVICE_FAMILY = "1"` (iPhone-only) | ✅ matches the locked ship target |
| Export compliance | `ITSAppUsesNonExemptEncryption = false` | ✅ no encryption prompt |
| Version | `MARKETING_VERSION 1.0` / `CURRENT_PROJECT_VERSION 1` / `package.json 1.0.0` | ✅ consistent |
| Icon + splash | `AppIcon.appiconset` (opaque 1024), `Splash.imageset`, `resources/` masters, `npm run assets:icons` | ✅ present |
| Native durability | `@capacitor/preferences` mirror (save/entitlement/prestige), status-bar theme, SW skipped on native | ✅ per TASK v16/v17 |
| Privacy/support | `public/privacy.html` + `public/support.html` | ✅ present (must be **hosted** at a live URL — owner) |
| Store listing | `STORE_LISTING.md` (name/subtitle/keywords/description/review notes) | ✅ complete, IP-clean |

---

## ⚠️ The one thing that changed the plan: the IAP is WIRED, not deferred

Earlier roadmap notes said "ship v1.0 without the IAP / hide it." **That is now stale.** The
Creative-Mode IAP is fully implemented end-to-end:

- `src/state/iap.ts` — `NATIVE_IAP_WIRED = true`; `getSandboxProduct` / `purchaseSandbox` /
  `restoreSandbox` call the native plugin via `registerPlugin("SiliconStoreKit")`, handling every
  StoreKit status with a revenue guard (entitlement granted ONLY on confirmed `purchased`).
- `ios/App/App/SiliconStoreKit.swift` — a real StoreKit 2 bridge (139 lines: product fetch,
  purchase, restore, transaction listener for Ask-to-Buy / Family Sharing / re-downloads).
- `ios/App/Configuration.storekit` — the product `com.wrexist.silicon.sandbox`, "Creative Mode",
  $2.99, for simulator testing.

**Because the purchase UI is shown on device, the owner MUST do BOTH:**
1. **Create the IAP** in App Store Connect — Non-Consumable, product ID
   `com.wrexist.silicon.sandbox`, $2.99, "Creative Mode" (WHAT_YOU_NEED_TO_DO Step 4).
2. **Attach it to the 1.0 version** at submission (Step 9).

An IAP that's shown but not purchasable / not attached = a guaranteed **Guideline 2.1 rejection**.
*Alternative if you'd rather defer it:* flip `NATIVE_IAP_WIRED` to `false` in `src/state/iap.ts`
(the `iapAvailable()` seam then hides the purchase UI) and skip Steps 4 + IAP attach — ship the IAP
in a 1.x update. **Recommendation: ship WITH it — it's done and tested in code; just create + attach
it in ASC and test buy+restore once on device via the StoreKit config.**

---

## Owner-side remaining (the actual critical path)

1. [ ] Host `privacy.html` + `support.html` at live URLs (GitHub Pages `/docs` or Netlify Drop).
2. [ ] App Store Connect: create the app record (`com.wrexist.silicon`), fill the listing from
       `STORE_LISTING.md`, set $8.99 / 4+ / all countries.
3. [ ] Add the 3 CI secrets (`APP_STORE_CONNECT_KEY_ID` / `_ISSUER_ID` / `_API_KEY_BASE64`) **or**
       archive locally in Xcode.
4. [ ] Create + (at submission) attach the `com.wrexist.silicon.sandbox` IAP — see the ⚠️ above.
5. [ ] On a Mac: `npm ci && npm run build && npx cap sync ios`, open Xcode, confirm signing (team
       `S3U8B8HH96`), archive → TestFlight.
6. [ ] On device: full design→build→launch loop; **test IAP buy + restore** (StoreKit config or
       sandbox account); confirm Preferences mirror survives a cold kill; status-bar theme; haptics.
7. [ ] App Privacy → "Data Not Collected". Submit.

---

_When any of the above lands, tick it here and in `ROADMAP.md` Phase 0._
</content>
