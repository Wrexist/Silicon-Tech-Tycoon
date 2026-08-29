# Silicon: Tech Tycoon — Release Evidence Matrix

**Branch:** `claude/silicon-tech-tycoon-excellence-4twr18` · **App version:** 1.3.0 (`package.json:4`)
**Compiled:** 2026-08-29, by a repository-only release audit (no macOS, no simulator, no device, no App Store Connect access).

## How to read this

Four categories, never blurred:

| Cat | Meaning |
|---|---|
| **A** | Provable inside this repository — tests, builds, static analysis, deterministic simulation, headless-Chromium runtime |
| **B** | Needs a browser/simulator/Capacitor runtime beyond what ran here |
| **C** | Needs a physical iPhone/iPad — real haptics, real StoreKit, real thermals, real safe areas |
| **D** | Needs the owner in App Store Connect, RevenueCat, or Apple agreements |

Statuses: **VERIFIED** (evidence present), **NOT VERIFIED**, **NEEDS SIMULATOR**, **NEEDS DEVICE**, **NEEDS OWNER**, **BLOCKED**, **N/A**.
"Should work", "looks correct" and "probably fine" do not appear in this document by policy.

---

## 1. Build, test and determinism

| Requirement | Cat | Evidence | Status | Owner |
|---|---|---|---|---|
| Unit + integration suite green | A | `npm test` → **173 files / 1,889 tests passed** | VERIFIED | — |
| TypeScript clean | A | `npx tsc -b` → exit 0 | VERIFIED | — |
| Production build green | A | `npm run build` → `✓ built`, PWA `precache 74 entries (3,487 KiB)` | VERIFIED | — |
| 160-week determinism pin | A | `src/state/activeRun.determinism.test.ts` green in the run above | VERIFIED | — |
| Balance simulation healthy | A | `npm run sim`, 40 seeds × 520 wk: 0/40 bankruptcies; era medians wk 26/61/116/265; no dead-weight interrupt; 1 card / 3.6 wk vs a 1/4 wk budget | VERIFIED | — |
| Engine purity | A | `grep -rE "isPro\|proGates\|entitlements\|openPaywall" src/engine/` → **zero matches** | VERIFIED | — |
| Release build ≠ dev build | A | Clean `rm -rf dist && npm run build`; artefacts measured below | VERIFIED | — |
| **`npm test` does NOT gate the TestFlight workflow** | A | `.github/workflows/ios-testflight-capacitor.yml` runs `npm ci` → `npm run build` → `cap sync` → `xcodebuild`. No `npm test` step. `tsc` gates only transitively via `build` | **NOT VERIFIED (gap)** | Owner |

### Measured release artefacts

| Metric | Value |
|---|---|
| `dist/` total | 4.0 MB |
| Initial critical path (html + entry + react + icons + main css), gzipped | **349.3 KiB** |
| Entry chunk `index-*.js` | 786.5 KB raw / 247.2 KB gzip |
| `three` chunk | 732.7 KB raw / 189.9 KB gzip — **lazy, zero references in `index.html`** |
| Service worker | `dist/sw.js` + `workbox-*.js`, `skipWaiting` + `clientsClaim` + `NavigationRoute` |
| PWA icons | `icon.svg`, `icon-192`, `icon-512`, `icon-512-maskable`, `apple-touch-icon-180` all present at declared sizes |

---

## 2. Runtime verification actually performed (headless Chromium, production build)

`npm run audit:screens` serves the real `dist/` and walks every screen, failing on any console error, page error, transport failure or HTTP ≥ 400.

| Pass | What it covers | Result |
|---|---|---|
| New game | First-run path: onboarding → game, every revealed screen + sub-tab | **CLEAN** |
| Late game (Pro seeded) | Showcase save; every screen incl. the four Pro-gated ones | **CLEAN** |
| Previous-release save | `scripts/fixtures/save-1.1.0.json` — a save **written by the 1.1.0-era build** (commit `b90edc1`), loaded by this build | **CLEAN** |

Status: **VERIFIED (Category A/B)** for "no screen throws, no chunk fails to resolve, no asset 404s, an old save still renders".

> This check had gone blind in three ways and was repaired as part of this pass (commit `ad9b26a`): onboarding grew to three steps so the harness bailed and the new-game sweep silently walked nothing; the four Pro-gated Progress rows open the paywall for a free player so those screens were never render-checked; and the previous-release pass was skipped unless someone hand-built a fixture. Before the repair this harness reported "clean" while measuring almost nothing.

**Not covered by this harness:** real touch, real haptics, real StoreKit, iOS Safari/WKWebView quirks, thermals, memory over hours, VoiceOver.

---

## 3. Crash surface

Eight genuine risks were found and fixed this pass (commit `6122a13`). Two were unrecoverable-by-the-player.

| Finding | Cat | Evidence | Status |
|---|---|---|---|
| Lazy interrupt overlays could brick a save permanently | A | 13 overlays were `React.lazy` under `Suspense` with no boundary; `lazy` re-throws its rejection **during render**, so a chunk missing after a deploy replaced the whole app — and the `pendingX` that raises the card lives in the **save**, so every reload reproduced it. Now bounded per overlay + regression test `src/components/lazyBoundaries.test.ts` | **VERIFIED FIXED** |
| A boot throw left the splash frozen forever | A | `boot()` was a discarded promise; nothing ran `removeBootSplash()`. Now a dependency-free failure screen with Reload + guarded Reset | **VERIFIED FIXED** |
| A sim-tick throw stopped the clock silently and forever | A | Tick runs in `setInterval`, which error boundaries never cover; it re-threw every tick with no UI. Now re-thrown during render into the crash card | **VERIFIED FIXED** |
| Web Audio could take the sim down with it | A | `new AudioContext()` throws on real browsers (per-page context cap); `sfx()` is called *from inside the weekly tick*. Now degrades to silence, failure latched | **VERIFIED FIXED** |
| Factory 3D + 3 lazy sheets unbounded | A | Both `Factory3D` mounts and Settings/Progress/Scenarios were `Suspense`-only while HQ's office already had the degrade contract. Settings is where the save is exported — the last screen that should crash | **VERIFIED FIXED** |
| Two render-path throws | A | `getContext("2d")!` returns null under WKWebView memory pressure; `SEGMENTS.find(...)!.name` on a retired segment id from an old save | **VERIFIED FIXED** |
| Stale chunk now *recovers*, not just degrades | A | `vite:preloadError` → one-shot session-flagged reload (`src/main.tsx`), pinned by `src/main.chunkReload.test.ts`; never loops, never reloads when storage is blocked | **VERIFIED FIXED** |
| Root ErrorBoundary is a real recovery path | A | Wraps `GameProvider` (`src/App.tsx:80-84`); offers copyable report, Reload, two-tap Reset — not a dead end | VERIFIED |
| Listeners / timers / rAF leak-free | A | All 46 `addEventListener` sites matched to cleanup; every `setInterval`/rAF has a clear/cancel | VERIFIED |
| All 18 non-persistence `JSON.parse` sites safe | A | Each in try/catch **and** shape-validated before use | VERIFIED |
| Behaviour under real memory pressure over hours | C | — | **NEEDS DEVICE** |

---

## 4. Lifecycle, offline and saves

| Requirement | Cat | Evidence | Status |
|---|---|---|---|
| **The game cannot double-advance weeks** | A | `advanceOneWeek` has exactly ONE production call site (`src/state/useGame.tsx:840`), called with no `rate`/`offline` argument; offline catch-up was removed; `lastActive` is a "saved at" stamp with no arithmetic anywhere. Pinned by source-invariant tests in `src/state/lifecycle.audit.test.ts` | VERIFIED |
| Offline / clock-abuse matrix | A | 9 cases tested — no elapsed time, 5 s, 6 h, 30 d, 10 y, clock backward 1 d and 10 y, year-10000 stamp, non-finite `lastActive`. All resume identically; no negative or NaN week | VERIFIED |
| Save/restore matrix | A | New, valid, old-version, corrupted JSON, **truncated**, empty/`{`/`null`/`[]`, non-finite numerics, **negative week** (fixed), newer-than-build, quota-exceeded, multi-tab | VERIFIED |
| No data-loss path on failed load | A | `loadResult` distinguishes `absent` from `unreadable` and copies raw bytes to `silicon.save.v1.bak` **before** anything can overwrite | VERIFIED |
| Save on background | A | `visibilitychange` → `persistNow()` before `hidden`; `pagehide` → `persistNow()` | VERIFIED (code+test) / **NEEDS DEVICE** for the WKWebView guarantee |
| Save churn | A | Debounce 800 ms, dirty-only net every 10 s ⇒ steady state **one write per game week**; payload 6.4 KB @ wk 0 → 57.4 KB @ wk 800, realistic ceiling ~100 KB | VERIFIED |
| First launch **offline** | A | Does not boot — no SW, no cached shell. Unavoidable for any web app; N/A on iOS where assets are bundled | VERIFIED (documented limitation) |
| Existing player offline / restart offline | A | All 74 entries precached incl. every lazy screen; uncached `.glb` degrades to procedural furniture via `ModelBoundary` | VERIFIED |
| Player cannot be stranded on a stale build | A | `registerType: "autoUpdate"` → reload on activation; `pagehide` saves first | VERIFIED |
| PWA auto-update reloads mid-play with no prompt | A | Progress is safe; the player loses their current screen/modal without explanation | **NOT VERIFIED as acceptable** — product decision, see Owner actions |
| `.bak` save is preserved but unreachable | A | Nothing reads `silicon.save.v1.bak`, and it is not in `MIRROR_KEYS`, so on iOS it lives only in evictable WKWebView storage | **NOT VERIFIED (gap)** — recovery UI is a feature decision |
| Quota fallback trims `launched` to 12 | A | `launched` is game state (franchise equity, achievement facts), not just history — a quota-trimmed save is a small permanent regression | **NOT VERIFIED (gap)** — last-resort path only |
| Notifications cannot accumulate | A | Deterministic per-day ids (`YYYYMMDD`); 25 consecutive refreshes leave the id set unchanged | VERIFIED |
| Reminder window survives a warm resume | A | Was cold-boot only; iOS suspends rather than terminates, so reminders silently ran dry after 7 days. Fixed + pinned | **VERIFIED FIXED** |
| Real iOS suspend/terminate/resume behaviour | C | — | **NEEDS DEVICE** |

---

## 5. Purchases — Silicon Pro

**No real Apple purchase can be verified in this environment.** Everything below marked VERIFIED is verified by reading code and running the TypeScript suite.

| Requirement | Cat | Evidence | Status |
|---|---|---|---|
| Full chain traced | A | paywall → `openPaywall` → `proStore.purchasePro` → `storeKitBridge` → `SiliconStoreKit.swift` (SK2) / `+RevenueCat.swift` → `syncPro` → `setProRecord` → `isPro()` → `proGates` | VERIFIED |
| Product identifiers agree across all three sources | A | `pro.ts` ↔ `ios/App/Configuration.storekit` ↔ `appstore/SUBSCRIPTION_GUIDE.md`: `com.wrexist.silicon.pro.{yearly,monthly,lifetime}` + legacy `com.wrexist.silicon.sandbox`. Prices and the `P1W` intro offers match `FREE_TRIAL_DAYS = 7` | VERIFIED |
| Active backend | A | `RevenueCatConfig.forceStoreKit2 = false`, non-empty key, SPM package linked to the App target ⇒ backend resolves to **RevenueCat**; entitlement id `"pro"` | VERIFIED (code) |
| 11 purchase states have a defined outcome | A | success, cancel, failure, pending/Ask-to-Buy, already-owned, offline (paywall), offline (owned), StoreKit unavailable, RC init failure, RC stale/no entitlement, timeout — each traced to file:line | VERIFIED |
| Every ambiguous check fails OPEN | A | Revocation needs two independent definitive noes; Founding records exempt even then; the SK2 group resolver rejects rather than answering "no subscription" | VERIFIED |
| No stuck-UI state | A | `busy` cleared in `finally` on both flows; the catalog probe now degrades to the retry card instead of pinning on "Contacting the App Store…" (fixed this pass) | **VERIFIED FIXED** |
| Restore exists and is discoverable | A | Paywall pinned bar (always visible at any scroll) + Settings → Silicon Pro; loading/success/nothing-found/error all distinct; always re-syncs even if restore threw | VERIFIED |
| Entitlement survives restart | A | localStorage + Capacitor Preferences mirror; hydration raced against a 1.2s cap; corrupt record ⇒ not-Pro, no crash, rewritten on next sync | VERIFIED |
| Slow bridge no longer hides Pro | A | Late hydration now emits `silicon:pro-changed` so a paying subscriber stops seeing lock chips (fixed this pass) | **VERIFIED FIXED** |
| One paywall surface | A | Only consumer of `openPaywall` is `<Paywall/>`; all 9 raise-sites route through it | VERIFIED |
| 12 gates each have ProFeature + COPY + test | A | `FEATURE_SET` in `proGates.test.ts` is `Record<ProFeature, true>` — a missing member is a compile error | VERIFIED |
| **`challengeArchive` gate is declared but never enforced** | A | Zero call sites in `src/`; `Challenges.tsx` renders the cross-run archive to free players unconditionally, while `FREE_TIER` and the paywall copy both claim it is Pro | **NOT VERIFIED — declared-but-unenforced** |
| Legacy paid-era owners get Founding | A | Checked *before* any subscription read; keys off `AppTransaction.originalAppVersion` vs `FIRST_FREE_BUILD = 5`; production-environment-only so TestFlight testers don't all read as owners | VERIFIED (code) |
| **Refund-verify endpoint is not deployed** | A/D | `POST https://silicon-refund-verify.vercel.app/api/verify-app-transaction` → **HTTP 404** (probed 2026-08-29). Fails open by design, so no legitimate owner is at risk, but a refunded paid-era buyer is currently granted Founding Pro | **NEEDS OWNER** |
| Real purchase / cancel / Ask-to-Buy / restore-on-fresh-install / crossgrade | C | — | **NEEDS DEVICE** (StoreKit sandbox) |
| ASC SKUs exist, approved, same intro offers; RC entitlement + offering configured; group literally `silicon_pro` | D | — | **NEEDS OWNER** |

---

## 6. Capacitor and iOS configuration

| Requirement | Cat | Evidence | Status |
|---|---|---|---|
| Bundle id consistent across 6 surfaces | A | `com.wrexist.silicon` in `capacitor.config.ts:7`, `project.pbxproj:337,359`, `Info.plist:13`, `app.json:4`, docs | VERIFIED |
| All 5 Capacitor plugins guarded | A | haptics, local-notifications, preferences, splash-screen, status-bar: **0 unguarded call sites**. Capacitor 6 surfaces an unregistered plugin as a *rejected promise*, and every call has `.catch`/try-catch. Boot hydration additionally time-boxed at 1.2 s | VERIFIED |
| Permission denial handled | A | Notifications: `display !== "granted"` ⇒ pref never set true, neutral toast, switch stays off; later revocation stops rescheduling silently | VERIFIED |
| Splash cannot strand the app | A | `launchAutoHide: true` + `launchShowDuration: 2000` as an OS-level net behind the JS hide | VERIFIED |
| Version wiring | A | `Info.plist` uses `$(MARKETING_VERSION)`/`$(CURRENT_PROJECT_VERSION)`; pbxproj has `1.3.0` / `5`; CI overrides both at archive time and **fails** (never clamps) if the build number is below `FIRST_FREE_BUILD` | VERIFIED |
| **No automated check that package.json, pbxproj and the CI input agree** | A | Three independently-typed values; a mismatch silently ships a wrong in-app version string | **NOT VERIFIED (gap)** |
| **Project ships UNIVERSAL (iPad enabled)** | A | `TARGETED_DEVICE_FAMILY = "1,2"` at `project.pbxproj:341,363`, iPad orientations at `Info.plist:44-49` — while `SHIP_READINESS.md:37`, `BUILD_IOS.md:67-73` and `app-store-screenshots/README.md:50` all assert **iPhone-only**. `ROADMAP.md:219` confirms iPad was enabled deliberately | **VERIFIED (docs contradict the project)** |
| App icon valid | A | 1024×1024, `8-bit/color RGB` — **no alpha** (Apple rejects RGBA icons) | VERIFIED |
| Launch storyboard wired | A | `Splash.imageset` 1x/2x/3x at 2732×2732; `UILaunchStoryboardName = LaunchScreen` | VERIFIED |
| No missing usage-description strings | A | The only permission-gated API is local notifications, which needs none. No camera/photos/location/mic/ATT API anywhere | VERIFIED |
| `ITSAppUsesNonExemptEncryption = false` | A | `Info.plist:25` — no per-upload export prompt | VERIFIED |
| Swift compiles | A/D | `.github/workflows/ios-build-check.yml` runs a real `xcodebuild ... build` on `macos-26` for any `ios/**` change, no secrets needed. **That it passes on this branch is unverified here** (no macOS) | **NEEDS OWNER** (run the workflow) |
| `canImport(RevenueCat)` resolves in CI | C/D | Whole RC backend is `#if`-gated | **NEEDS OWNER** |
| `CFBundleName` resolves to `"App"` | A | `Info.plist:17` → `$(PRODUCT_NAME)` → `App`. `CFBundleDisplayName = Silicon` wins on the Home screen; cosmetic fallback only | VERIFIED (impact **NEEDS DEVICE**) |

---

## 7. Privacy

| Requirement | Cat | Evidence | Status |
|---|---|---|---|
| No undisclosed data flow | A | `fetch`/XHR/WebSocket/beacon across `src/**` → **zero matches**. One third-party SDK (RevenueCat). One outbound native request (refund-verify). No IDFA/`identifierForVendor`/ATT/SKAdNetwork/APNs anywhere | VERIFIED |
| RevenueCat identity is anonymous | A | `Purchases.configure` called with no `appUserID`; `logIn` never called | VERIFIED |
| Three-way privacy sync | A | `PrivacyInfo.xcprivacy` ↔ `docs/privacy/` ↔ `public/privacy.html` agree with code; manifest is in the build (`project.pbxproj:22,40,170`) | VERIFIED |
| `CA92.1` UserDefaults reason is load-bearing | A | `@capacitor/preferences` ships **no** privacy manifest, so the app-level declaration is the only coverage — must not be removed | VERIFIED |
| Privacy questionnaire inputs | A | `PRIVACY_DISCLOSURE_INPUTS.md`, per Apple category with file:line evidence; 4 items marked NEEDS OWNER / LEGAL | VERIFIED (document delivered) |
| Refund endpoint's no-retention claim | D | Source lives in a separate project — unprovable from this repo | **NEEDS OWNER / LEGAL** |
| Legal + support pages live | A | Probed 2026-08-29: `/`, `/privacy/`, `/support/`, `/terms/` all **HTTP 200**. The `LAUNCH_CHECKLIST` warning that the Terms link 404s (a documented 3.1.2 rejection cause) is **stale — resolved** | VERIFIED |
| EULA pointer is consistent | D | Descriptions point at Apple's standard EULA while the paywall points at `/terms/`. Both satisfy 3.1.2; they should agree across 39 locales | **NEEDS OWNER** |

---

## 8. Accessibility

| Requirement | Cat | Evidence | Status |
|---|---|---|---|
| Tabs expose real tabpanels | A | All five `role=tab` strips wired with id/`aria-controls`/`aria-labelledby` (commit `acf21b7`) | VERIFIED (semantics) |
| Touch targets ≥ 44 px | A | 8 sub-44 px controls given invisible vertical hit-area expansion, zero layout movement | VERIFIED (CSS) |
| Dialogs trap focus + Escape | A | `useDialogFocus` + `role="dialog" aria-modal` on nested confirms | VERIFIED |
| Icon-only buttons labelled | A | Zero unlabelled icon-only buttons | VERIFIED |
| Reduced motion honoured | A | Global `prefers-reduced-motion` neutralisation in `src/index.css:94-102` | VERIFIED |
| **Actual VoiceOver experience** | C | Source semantics are not the lived experience | **NEEDS DEVICE** |
| Dynamic Type at extreme sizes | C | rem-based type shipped; real clipping unverified | **NEEDS DEVICE** |
| Contrast measured against WCAG | B | — | **NEEDS SIMULATOR** |

---

## 9. Performance budget

| Metric | Measurement | Status |
|---|---|---|
| Initial payload (gzip) | **349.3 KiB** | VERIFIED — acceptable |
| `three` deferred off the critical path | Zero references in `index.html` | VERIFIED |
| Precache | 74 entries / 3,487 KiB | VERIFIED |
| Save write cost | ~1 write/game week, ≤ ~100 KB payload | VERIFIED — acceptable |
| Hidden-tab cost | r3f `frameloop → "never"` on `visibilitychange` in both 3D scenes; sim interval cleared | VERIFIED |
| Cold-launch time on device | — | **NEEDS DEVICE** |
| Memory over a long session | — | **NEEDS DEVICE** |
| Thermals / battery during 3D HQ | — | **NEEDS DEVICE** |
| Low-end device 3D framerate | — | **NEEDS DEVICE** |

---

## 10. Ship blockers

### HARD BLOCKERS — cannot safely ship
| # | Item | Cat | Why it blocks |
|---|---|---|---|
| H1 | **Build-number conflict.** `CURRENT_PROJECT_VERSION = 5` with `MARKETING_VERSION = 1.3.0`, but `appstore/REJECTION_3.1.2_EULA.md:27` and `APP_STORE_METADATA.md:118` record **1.3.0 already uploaded as build 70**. ASC refuses a build number ≤ one already uploaded for the same version train | D | The upload is rejected at upload time. Entitlements are unaffected (`FIRST_FREE_BUILD = 5` still grandfathers correctly, `isFoundingBuild(70)` is correctly false) |
| H2 | **iPad reality vs documentation.** Project ships `"1,2"`; three docs instruct/assert iPhone-only | D + C | App Review runs on a 13" iPad, and ASC **requires** an iPad screenshot set. The committed iPad set is self-declared stale. Decide: ship universal (refresh screenshots, verify iPad layout) or set `"1"` |
| H3 | **App preview video is WebM.** ASC does not accept WebM; the committed `.mp4` is the stale 1.1.0 cut | D | Either re-render as accepted `.mp4` or omit the preview |

### HIGH RISK — shippable, but knowingly
| # | Item | Cat | Note |
|---|---|---|---|
| R1 | `npm test` does not gate the TestFlight workflow | D | A dispatch from a red ref builds and uploads. One `npm test` step closes it |
| R2 | Refund-verify endpoint returns 404 | D | Fails open, so no legitimate owner is harmed; a refunded paid-era buyer keeps Founding Pro |
| R3 | `challengeArchive` gate declared but never enforced | A | Paywall copy claims the archive is Pro; it is free. Wire the gate **or** drop the claim before submission — an unfulfilled purchase claim is a 3.1.2 surface |
| R4 | No automated version-agreement check | A | package.json / pbxproj / CI input can silently diverge |
| R5 | PWA auto-update reloads mid-play unannounced | A | Progress is safe; the screen is lost without explanation |
| R6 | `.bak` save unreachable + not mirrored on iOS | A | A corrupted save is preserved but the player has no way to recover it |

### POLISH — do not block
`CFBundleName` resolves to `"App"`; quota fallback trims `launched` (game state, not just history); FactoryMode's 3D fallback doesn't explain itself the way HQ's does; a suppressed interrupt stays pending until reload; `app.json` is a dead Expo leftover.

### OWNER ACTIONS
See **`OWNER_RELEASE_ACTIONS.md`**.

---

## 11. What this pass changed

| Commit | Change |
|---|---|
| `6122a13` | 8 crash risks fixed, incl. 2 that could brick a save or freeze the splash forever; one-shot stale-chunk recovery |
| `e0ca5ee` | Reminder starvation, backward-clock snapshot eviction, negative week on load; offline/clock + save-corruption matrices; double-advance pins |
| `3cb6d1d` | Paywall dead-probe strand; late native hydration hiding Pro from a paying subscriber |
| `ad9b26a` | Screen audit repaired — it had been reporting clean while walking almost nothing; previous-release fixture committed |
| `c00e600` | `PRIVACY_DISCLOSURE_INPUTS.md`, `RELEASE_CANDIDATE_READINESS.md`; three stale doc claims corrected |

**Suite: 1,845 → 1,889 tests / 169 → 173 files.** Determinism pin, engine purity and the monetization boundary unchanged throughout.
