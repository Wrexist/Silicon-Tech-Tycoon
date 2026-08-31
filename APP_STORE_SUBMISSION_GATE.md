# Silicon: Tech Tycoon — App Store Submission Gate

**The final operational checklist.** Work it top to bottom. Nothing here is aspirational: every
VERIFIED line names the evidence that makes it true, and everything else names who must close it.

Companion documents: `RELEASE_EVIDENCE.md` (what is proven and how) · `OWNER_RELEASE_ACTIONS.md`
(step-by-step owner work) · `RELEASE_VERSION_PLAN.md` (version/build) ·
`DEVICE_SUPPORT_DECISION.md` (iPad) · `MONETIZATION_CONTRACT.md` (free/Pro line) ·
`APP_PREVIEW_DELIVERY.md` (preview asset) · `PRIVACY_DISCLOSURE_INPUTS.md` (privacy answers).

Blocking levels: **HARD** = cannot submit · **RISK** = can submit, knowingly · **CHECK** = confirm and tick.

---

## 1. CODE

| # | Requirement | Owner | Evidence | Status | Blocking |
|---|---|---|---|---|---|
| C1 | Full suite green | repo | `npm test` → **177 files / 1,930 tests passed** | VERIFIED | HARD |
| C2 | TypeScript clean | repo | `npx tsc -b` → exit 0 | VERIFIED | HARD |
| C3 | Production build + PWA green | repo | `npm run build` → built, `precache 74 entries` | VERIFIED | HARD |
| C4 | 160-week determinism pin unchanged | repo | `src/state/activeRun.determinism.test.ts` green | VERIFIED | HARD |
| C5 | Engine purity (no entitlement in sim) | repo | `grep -rE "isPro\|proGates\|entitlements" src/engine/` → zero matches | VERIFIED | HARD |
| C6 | Screen audit genuinely covers screens | repo | `npm run audit:screens` → CLEAN **with coverage floors met**; six guards proven to fail when broken | VERIFIED | HARD |
| C7 | Previous-release save loads and renders | repo | `scripts/fixtures/save-1.1.0.json` (written by the 1.1.0-era build, commit `b90edc1`); audit confirms load + 3 migrated fields | VERIFIED | HARD |
| C8 | Crash-recovery fixes pinned | repo | `interruptRecovery.test.ts`, `main.bootRecovery.test.ts`, `tickCrash.test.ts`, `lazyBoundaries.test.ts`, `main.chunkReload.test.ts` — each proven red on revert | VERIFIED | HARD |
| C9 | Swift compiles | owner | `.github/workflows/ios-build-check.yml` (macOS, no secrets). **Not runnable here** | NEEDS OWNER | HARD |
| C10 | `npm test` gates the TestFlight workflow | owner | Workflow runs `npm ci → build → cap sync → xcodebuild`; no test step | NOT DONE | RISK |
| C11 | Screen audit runs in CI | owner | No workflow invokes it; now portable via `SHOTS_CHROME`, needs a browser install step | NOT DONE | RISK |

## 2. MONETIZATION

| # | Requirement | Owner | Evidence | Status | Blocking |
|---|---|---|---|---|---|
| M1 | Every advertised Pro benefit is enforced | repo | `proGates.enforcement.test.ts` — every `ProFeature` must have a real gate **and** its own copy; proven non-vacuous | VERIFIED | HARD |
| M2 | No free feature is described as Pro | repo | Challenge Archive removed as a gate and recorded FREE (`MONETIZATION_CONTRACT.md`) | VERIFIED | HARD |
| M3 | Paywall copy is factually true | repo | Museum (60-cap, Pro gates viewing), Mastery (perks apply free; Pro opens the board), Founder Legend (record accrues free) all reworded against the code | VERIFIED | HARD |
| M4 | No pay-to-win | repo | Engine reads no entitlement (C5); Mastery perks apply without Pro — the old copy implied otherwise and was wrong | VERIFIED | HARD |
| M5 | Exactly one purchase surface | repo | Only consumer of `openPaywall` is `<Paywall/>`; all raise-sites route through it | VERIFIED | HARD |
| M6 | Restore Purchases exists + discoverable | repo | Paywall pinned bar (visible at any scroll) + Settings → Silicon Pro; distinct loading/success/none-found/error states | VERIFIED | HARD |
| M7 | Cancellation is harmless | repo | Cancel path returns silently, grants nothing, leaves state valid | VERIFIED | HARD |
| M8 | Failure is understandable + recoverable | repo | Error toast + automatic catalog re-probe; dead probe now degrades to the retry card | VERIFIED | HARD |
| M9 | Free experience stays functional | repo | Era wall is an honest content gate ("Unlock" + Pro chip → paywall → resumes); free player keeps company and all systems. New-game audit pass walks clean at free tier | VERIFIED | HARD |
| M10 | No dark patterns / pressure / artificial degradation | repo | No timers, energy, countdowns or manufactured scarcity in copy; nothing degrades a free run | VERIFIED | HARD |
| M11 | Real purchase, cancel, Ask-to-Buy, restore, crossgrade | owner | Requires StoreKit sandbox on device | NEEDS DEVICE | HARD |
| M12 | ASC SKUs live with matching intro offers | owner | 3 SKUs + legacy; see `OWNER_RELEASE_ACTIONS.md` §9–12 | NEEDS OWNER | HARD |
| M13 | RevenueCat `pro` entitlement configured | owner | Code pins entitlement id `pro`; dashboard unverifiable here | NEEDS OWNER | HARD |
| M14 | Refund-verify endpoint deployed | owner | `POST .../verify-app-transaction` → **404** (probed). Fails open, so no owner is harmed | NEEDS OWNER | RISK |

## 3. VERSIONING

| # | Requirement | Owner | Evidence | Status | Blocking |
|---|---|---|---|---|---|
| V1 | Next build number **> 70** | owner | 1.3.0 already uploaded as build 70; repo carries `CURRENT_PROJECT_VERSION = 5` | NEEDS OWNER | HARD |
| V2 | CI supplies a valid build number | repo | TestFlight workflow's newest run is **#70**, contiguous, no reset ⇒ next dispatch stamps **71** with no override | VERIFIED | HARD |
| V3 | `FIRST_FREE_BUILD = 5` NOT changed | repo/owner | Paid-era grandfathering line; raising it grants Founding Pro to every existing downloader, and no test guards that direction | CHECK | HARD |
| V4 | Marketing version agrees across sources | owner | `package.json` 1.3.0, pbxproj 1.3.0, CI input typed by hand. Nothing checks agreement — and it has already failed once (a binary stamped 1.3.2 against ASC version 1.3.0) | NEEDS OWNER | RISK |

## 4. DEVICE SUPPORT

| # | Requirement | Owner | Evidence | Status | Blocking |
|---|---|---|---|---|---|
| D1 | Decide universal vs iPhone-only | owner | Project ships `TARGETED_DEVICE_FAMILY = "1,2"`; support is **INTENTIONAL** (commit `827b707` reversed an explicit `"1"`) | **OWNER DECISION** | HARD |
| D2 | If universal: iPad screenshots are real | owner | Committed iPad frames are captured at a **540×720** viewport and scaled full-bleed; the app really renders a **centered 540px column** on iPad | NOT DONE | HARD (if universal) |
| D3 | If universal: 540px Design Lab layout bug | owner | `IDEAS.md:28` — hero overlaps the Category selector at exactly 540px, the width a reviewer sees | NOT DONE | RISK (if universal) |
| D4 | Docs match the shipped device family | repo | 3 actively-false docs corrected this pass; remaining stale ones listed in `DEVICE_SUPPORT_DECISION.md` | VERIFIED (the false ones) | CHECK |

## 5. DEVICE QA — none of this can be done in a repository

| # | Requirement | Status | Blocking |
|---|---|---|---|
| Q1 | Purchases: buy / cancel / Ask-to-Buy / restore on fresh install / offline-owned / crossgrade | NEEDS DEVICE | HARD |
| Q2 | Safe areas, no clipping — small/standard/Max iPhone, Dynamic Island | NEEDS DEVICE | HARD |
| Q3 | iPad portrait **and** landscape (if universal) | NEEDS DEVICE | HARD (if universal) |
| Q4 | Largest Dynamic Type across HQ / Design Lab / Market / Company | NEEDS DEVICE | RISK |
| Q5 | Sheet grab-handle dismiss, modal stacking, keyboard during onboarding | NEEDS DEVICE | RISK |
| Q6 | Cold launch time; background → resume must not double-advance | NEEDS DEVICE | HARD |
| Q7 | Force-quit mid-play → progress intact | NEEDS DEVICE | HARD |
| Q8 | Thermals/battery: 20+ min with 3D HQ open | NEEDS DEVICE | RISK |
| Q9 | WebGL: does the 3D→2D fallback trip, and does "Try 3D again" recover? | NEEDS DEVICE | RISK |
| Q10 | VoiceOver through HQ → Design Lab → launch | NEEDS DEVICE | RISK |
| Q11 | Silent mode, headphones, audio interruption | NEEDS DEVICE | RISK |

## 6. APP PREVIEW

| # | Requirement | Owner | Evidence | Status | Blocking |
|---|---|---|---|---|---|
| P1 | Preview is optional | — | Screenshots satisfy the media requirement | VERIFIED | — |
| P2 | Current asset unusable | repo | WebM/VP8 1080×2340 25fps; ASC rejects WebM. Committed MP4 is the 1.1.0 cut | VERIFIED | RISK |
| P3 | If shipping a preview: transcode + validate | owner | Exact commands in `APP_PREVIEW_DELIVERY.md`; cannot be done here (no H.264 encoder) | NEEDS OWNER | RISK |

## 7. APP STORE CONNECT

| # | Requirement | Owner | Status | Blocking |
|---|---|---|---|---|
| A1 | App record, Bundle ID `com.wrexist.silicon`, Pricing **Free** | owner | NEEDS OWNER | HARD |
| A2 | Subscription group `silicon_pro` + yearly/monthly with 7-day trials | owner | NEEDS OWNER | HARD |
| A3 | Non-consumable `…pro.lifetime`, outside the group | owner | NEEDS OWNER | HARD |
| A4 | Legacy `…sandbox` left LIVE (deleting breaks restores) | owner | NEEDS OWNER | HARD |
| A5 | Billing Grace Period ON | owner | NEEDS OWNER | RISK |
| A6 | EULA pointer consistent across all 39 locales | owner | NEEDS OWNER | HARD — this exact inconsistency caused the previous 1.3.0 rejection |
| A7 | App Privacy answered from `PRIVACY_DISCLOSURE_INPUTS.md` | owner | NEEDS OWNER | HARD |
| A8 | Screenshots: upload `app-store-screenshots/store/` (10 × 1284×2778, in order) | owner | NEEDS OWNER | HARD |
| A9 | Use `appstore/APP_STORE_METADATA.md`; **ignore `STORE_LISTING.md`** (superseded, still says premium) | owner | NEEDS OWNER | HARD |
| A10 | Legal/support URLs live | repo | VERIFIED — `/`, `/privacy/`, `/support/`, `/terms/` all HTTP 200 | CHECK |

## 8. TESTFLIGHT

| # | Requirement | Owner | Status | Blocking |
|---|---|---|---|---|
| T1 | Three CI secrets set; API key has **Admin** role | owner | NEEDS OWNER | HARD |
| T2 | `ios-build-check.yml` green on the submitted commit | owner | NEEDS OWNER | HARD |
| T3 | Internal technical pass (crashes, purchases, saves, performance) | owner | NEEDS OWNER | HARD |
| T4 | Gameplay + fresh-player passes (see the plan in `OWNER_RELEASE_ACTIONS.md`) | owner | NEEDS OWNER | RISK |

## 9. SUBMISSION

| # | Final gate | Status |
|---|---|---|
| S1 | `ci.yml` **and** `ios-build-check.yml` green on the submitted commit | NEEDS OWNER |
| S2 | `npm test`, `tsc -b`, `npm run build`, `npm run audit:screens` all green locally | VERIFIED |
| S3 | Build number > 70 (V1/V2) | NEEDS OWNER |
| S4 | iPad decision made and its consequences closed (D1–D3) | **OWNER DECISION** |
| S5 | Screenshots match the shipped build | NEEDS OWNER |
| S6 | Purchase flow tested on a real device with a sandbox account | NEEDS DEVICE |
| S7 | Privacy answers submitted and consistent with `PrivacyInfo.xcprivacy` | NEEDS OWNER |

---

## Where this leaves the repository

**Zero repository-side release ambiguity remains.** Every HARD row above is either VERIFIED with
evidence, or explicitly owned by the owner / a physical device / App Store Connect.

**Repository-side blockers: none.**
**Owner-side hard blockers: two** — the build number must exceed 70 (mechanically satisfied by the
next CI dispatch), and the iPad decision must be made, because if universal ships then the committed
iPad screenshots depict a layout the app does not produce.

The app preview is **not** a blocker: previews are optional.
