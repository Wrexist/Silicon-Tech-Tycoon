# Silicon: Tech Tycoon — Owner Release Actions

Everything between this branch and App Store submission that **only you can do**.
Evidence for every claim: **`RELEASE_EVIDENCE.md`**. Purchase model: `MONETIZATION.md`. Submission path: `LAUNCH_CHECKLIST.md`.

Verified identifiers used below (read from the repo — none invented):

| Thing | Value | Source |
|---|---|---|
| Bundle ID | `com.wrexist.silicon` | `capacitor.config.ts:7`, `project.pbxproj:337,359` |
| Team ID | `S3U8B8HH96` | `project.pbxproj:328`, `ios/ExportOptions.plist:12` |
| Subscription group | `silicon_pro` | `src/state/pro.ts:27` |
| Yearly SKU | `com.wrexist.silicon.pro.yearly` — $19.99, 7-day free trial | `pro.ts:68`, `Configuration.storekit:66` |
| Monthly SKU | `com.wrexist.silicon.pro.monthly` — $3.99, 7-day free trial | `pro.ts:92`, `Configuration.storekit:91` |
| Lifetime SKU | `com.wrexist.silicon.pro.lifetime` — $29.99, non-consumable, **not** in the group | `pro.ts:80`, `Configuration.storekit:31` |
| Legacy SKU | `com.wrexist.silicon.sandbox` — **keep live, never re-sell** | `src/state/iap.ts:28` |
| RevenueCat entitlement | `pro` | `RevenueCatConfig.swift:42` |
| Marketing / build version | `1.3.0` / `5` **(see DO NOW #1)** | `project.pbxproj:327,335` |

---

## DO NOW — hard blockers

### 1. Resolve the build-number conflict before any upload
`project.pbxproj` carries `MARKETING_VERSION = 1.3.0` with `CURRENT_PROJECT_VERSION = 5`, but the repo records **1.3.0 already uploaded as build 70** (`appstore/REJECTION_3.1.2_EULA.md:27`, `appstore/APP_STORE_METADATA.md:118`). App Store Connect rejects a build number less than or equal to one already uploaded for the same version train, so an upload at build 5 fails at upload time.

Do one of:
- **Ship as 1.3.1** (recommended): run the TestFlight workflow with `marketing_version = 1.3.1`. CI stamps the build number from `GITHUB_RUN_NUMBER`, so the collision disappears. Also bump `package.json` `version` to `1.3.1` so the in-app Settings string matches.
- **Stay on 1.3.0**: dispatch with `build_number` ≥ 71.

Do **not** lower `FIRST_FREE_BUILD` (`src/state/pro.ts:394`, currently `5`). It is the paid-era grandfathering line: builds below it grant Founding Pro. Build 70 and 71 are correctly *not* founding.

### 2. Decide iPad: ship universal, or set iPhone-only
The project **ships universal** — `TARGETED_DEVICE_FAMILY = "1,2"` (`project.pbxproj:341,363`) with iPad orientations declared (`Info.plist:44-49`). `ROADMAP.md:219` confirms iPad support was enabled deliberately. But `SHIP_READINESS.md:37`, `BUILD_IOS.md:67-73` and `app-store-screenshots/README.md:50` all still say iPhone-only.

- **Ship universal** → App Store Connect **requires** an iPad 13" screenshot set, and App Review will run the app on an iPad. The committed set at `app-store-screenshots/ipad/` (10 PNGs) is self-declared stale — regenerate with `npm run shots:ipad`. Verify iPad portrait *and* landscape by hand (see ON PHYSICAL DEVICE #6).
- **Ship iPhone-only** → set `TARGETED_DEVICE_FAMILY = "1"` in both configs and remove `UISupportedInterfaceOrientations~ipad`. Cheaper, and it matches the three docs.

Either way, correct the three stale docs so the next person isn't misled.

### 3. Replace or drop the app preview video
The preview is WebM, which App Store Connect does not accept; the committed `.mp4` is the stale 1.1.0 cut (`RELEASE_CANDIDATE_READINESS.md`). Re-render an accepted `.mp4` at a required size, or omit the preview — screenshots alone are sufficient.

### 4. Decide the `challengeArchive` claim
`FREE_TIER` (`src/state/proGates.ts:59`) and the paywall copy (`:177`) both tell the player the cross-run challenge archive is a Pro feature. **It is not gated** — `Challenges.tsx` renders it to everyone; the `ProFeature` has zero call sites. Either wire the gate or remove the claim from the copy. Advertising a purchase benefit the app does not enforce is a Guideline 3.1.2 surface. (Left unfixed deliberately: closing it means *adding* a gate, which is a product decision.)

---

## BEFORE TESTFLIGHT

5. **Add `npm test` to the release workflow.** `.github/workflows/ios-testflight-capacitor.yml` runs `npm ci` → `npm run build` → `cap sync` → `xcodebuild`. It never runs the test suite, so a `workflow_dispatch` from a red ref will build and upload. Add a step after `npm ci`:
   ```yaml
   - name: Test
     run: npm test
   ```
6. **Set the three CI secrets** (exact names, from the workflow): `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_BASE64`. The key **must** carry the **Admin** role — a Developer or App-Manager key archives fine and then fails `-exportArchive` with a cloud-signing permission error. Team ID is already in the workflow, not a secret.
7. **Run `.github/workflows/ios-build-check.yml` once on this branch.** It needs no secrets and runs a real `xcodebuild ... build` on macOS. This is the only proof that the Swift compiles and that `canImport(RevenueCat)` resolves — `npm test` never touches `ios/**`, and the repo notes three past releases were burned by exactly that gap.
8. **Deploy or accept the refund-verify function.** `POST https://silicon-refund-verify.vercel.app/api/verify-app-transaction` returns **HTTP 404** (probed 2026-08-29). It fails open by design, so no legitimate owner is at risk — but a refunded paid-era buyer currently keeps Founding Pro. Deploy it, or accept knowingly.

---

## IN APP STORE CONNECT

9. **App record**: Bundle ID `com.wrexist.silicon`. Pricing → **Free**.
10. **Subscription group**: Monetization → Subscriptions → group must be named exactly **`silicon_pro`**.
    - `com.wrexist.silicon.pro.yearly` — $19.99/year, **7-day free trial** introductory offer
    - `com.wrexist.silicon.pro.monthly` — $3.99/month, **7-day free trial**
    - Localized display name + description for each (required, or the group is not reviewable)
11. **Non-consumable**: `com.wrexist.silicon.pro.lifetime` — $29.99. **Not** inside the subscription group.
12. **Leave `com.wrexist.silicon.sandbox` live.** Deleting it breaks restores for paid-era owners.
13. **Billing Grace Period → ON** (Subscriptions → group settings). The app already honours `inGracePeriod`.
14. **Small Business Program** — enrol if eligible (15% rate).
15. **EULA**: the descriptions point at Apple's standard EULA while the paywall links `/terms/`. Both satisfy 3.1.2 — pick one and make all 39 locales agree. This exact inconsistency caused the previous 1.3.0 rejection.
16. **App Privacy**: answer from `PRIVACY_DISCLOSURE_INPUTS.md`. The short version, all code-verified: **Purchases → collected, not linked, not for tracking** (RevenueCat + the refund-verify endpoint); **Identifiers → RevenueCat's anonymous app-user ID only**, no IDFA, no ATT, no SKAdNetwork; no analytics, no ads, no accounts; game data never leaves the device. Four items are marked NEEDS OWNER / LEGAL in that document — chiefly that the refund endpoint's no-retention behaviour cannot be proven from this repository.
17. **Screenshots**: 6.7"/6.5" iPhone required; **iPad 13" required if you ship universal** (see #2). Capture plan in `RELEASE_CANDIDATE_READINESS.md`. Note frames 05 and 10 are currently the same screen.
18. **Age rating, category, keywords, promo text**: use `appstore/APP_STORE_METADATA.md`. **Ignore `STORE_LISTING.md`** — it is superseded, carries different promo/keyword text, and still describes the app as premium, contradicting the free-to-download model.

---

## ON PHYSICAL DEVICE — QA script

Nothing below can be verified in a repository. Work top to bottom; the purchase block is the highest-risk.

**Purchases (StoreKit sandbox account, fresh install each time)**
1. Buy monthly → Pro unlocks immediately; kill and relaunch → still Pro.
2. Buy yearly with the free trial → copy says trial; check the renewal date.
3. Cancel mid-purchase → **no error banner, nothing granted** (silent by design).
4. Ask to Buy / deferred → neutral toast, paywall stays open, nothing granted; approve out-of-band → Pro appears.
5. **Restore on a fresh install** → paywall pinned bar → Restore Purchases → Pro returns. Then the same from Settings → Silicon Pro.
6. Airplane mode **while owning Pro** → Pro still works. Airplane mode **on the paywall** → honest retry card, no dead buy button.
7. Buy lifetime → non-expiring; relaunch confirms.
8. Crossgrade monthly → yearly.

**Layout and interaction** (small iPhone, standard, Pro Max, Dynamic Island; iPad if shipping universal)
9. Safe areas top and bottom; no clipping in HUD, sheets, or the tab bar. iPad **landscape** if universal.
10. Largest Dynamic Type on HQ, Design Lab, Market, Company — check long numbers and buttons.
11. Bottom sheets: grab-handle dismiss (the "sheets felt trapped" bug, IMG_0140), modal stacking, keyboard open during onboarding.
12. Every tap target reachable one-handed; the 3D office taps (staff robot, bank vault) fire haptics.

**Lifecycle and performance**
13. Cold launch → time it. Background → resume → the clock must **not** jump or double-advance (structurally prevented and test-pinned, but confirm on device).
14. Lock the screen mid-play; take a call; resume. Audio recovers, no duplicate weeks.
15. Force-quit while playing → relaunch → progress intact (save-on-background).
16. **Thermals**: 20+ minutes with the 3D HQ open. Watch for heat, frame drops, battery drain.
17. Leave it running an hour → check for memory growth or degraded rendering.
18. **WebGL**: does the 3D→2D fallback happen at launch, and is it every launch or intermittent? If it trips, does "Try 3D again" recover it? (Open question in `ROADMAP.md` Phase 1.)
19. Silent mode, headphones, audio interruption.
20. **VoiceOver**: navigate HQ → Design Lab → launch a product. Focus order, dialog announcements, tab semantics. Source semantics are verified; the lived experience is not.

---

## BEFORE SUBMISSION

21. Green `ci.yml` **and** `ios-build-check.yml` on the submitted commit.
22. `npm run audit:screens` → **CLEAN** (it walks new game, late game, and a real previous-release save).
23. Build number strictly greater than any previously uploaded build for that version train (#1).
24. Screenshots match the shipped build — not a previous release.
25. Terms, Privacy and Support URLs load (all four verified HTTP 200 on 2026-08-29).
26. Purchase flow tested on a real device with a sandbox account (#1–8 above).

---

## AFTER TESTFLIGHT

27. Confirm one **non-sandbox** purchase end to end.
28. Confirm a paid-era owner is granted **Founding Owner** on a real device.
29. Watch App Store Connect crash reports for the first week. The app ships **no** crash SDK and no analytics by design; ASC crash reports and TestFlight feedback are your only signal, and that is a deliberate privacy trade-off — do not add an SDK reflexively.
30. Add **win-back offers** once subscriptions are live.
31. Only then start balance tuning. `ROADMAP.md` and this pass both deliberately defer live balance changes until real player data exists — the 40-seed simulation says the curve is healthy (0/40 bankruptcies, no dead-weight systems), which is evidence about the *model*, not about players.

---

## TestFlight plan

**Internal technical (2–4 people, ~3 days)** — crashes, purchases, saves, performance.
Ask: Did the app ever freeze on the splash or stop advancing weeks? Did a purchase or restore fail, and what exactly did the screen say? Did progress survive a force-quit? Did the device get hot?

**Gameplay (8–15 people, ~1 week)** — balance, confusion, retention.
Ask: At what point did you stop knowing what to do? Did you understand *why* your product succeeded or failed? Did any rival feel like a real opponent? Was there a moment you felt cheated by something you couldn't have predicted? When did you stop playing, and why?

**Fresh players (5–10, never seen it, ~1 week)** — onboarding, discoverability.
Ask: What did you think the game was about after one minute? What was the first thing you tapped that did nothing you expected? At what point did you understand how to make money? What did you never find?

Feedback rules: avoid "what do you think?". Ask what *confused* them and *when*. Collect device model + iOS version with every report — thermal and WebGL issues are device-specific. Ask fresh players to narrate their first ten minutes aloud.

---

## The post-launch loop

Release → TestFlight → real player feedback → bug triage → qualitative insight → **balance adjustment** → retention improvement → new content.

The discipline that matters: **balance numbers change on evidence, not on intuition.** The repo has a 40-seed simulation harness (`npm run sim`) that reports the curve, an interrupt census and reachability — use it to check that a proposed change does what you think, but let *player* behaviour decide which change to make. Deferred content ideas (a new era, category expansion, deeper rival AI) are listed in `ROADMAP.md` Phase 7 and should stay deferred until live data says which one players actually want.
