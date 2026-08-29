# Silicon: Tech Tycoon — Master Roadmap

**Owner:** Wrexist · **Maintained as the single forward-looking plan.**
Supersedes scattered "next" notes in `TASK.md`, `RETENTION_ROADMAP.md`, `DLC_OS_PLATFORM.md`,
and `OFFICE_SHOP_PLAN.md` — those remain the detailed specs; **this file is the sequence and the
priorities.** When they disagree, this file wins; update it as work lands.

> **Long-horizon companion:** `EXPANSION_ROADMAP.md` is the forward *thesis* — the big depth bets
> (market segments, living rivals, era-distinct mechanics) and the readability/feel moat, grounded in
> a fresh 2024–2026 competitor research pass. This file (`ROADMAP.md`) stays the near-term sequence;
> read `EXPANSION_ROADMAP.md` for *where the game goes next* and the spec behind the Phase 7+ bullets.

> **The one rule that orders everything below:** nothing post-launch matters until the game is
> *purchasable*. Phase 0 (ship v1.0) is owner-side and is the only thing on the critical path.
> Every other phase is goodwill, depth, or revenue — all of it gated behind being live.

---

## 0. Where the project actually is (refreshed 2026-08)

| Signal | State |
|---|---|
| Version | `1.3.0` (`package.json`) — free download + **Silicon Pro** subscription |
| Typecheck | `tsc -b` — **0 errors** ✅ |
| Tests | **1,707 passing across 162 files** (vitest), determinism pin green ✅ |
| Build | `vite build` + PWA (manifest + service worker) green ✅ |
| Engine purity | `engine/` is pure TS, fully unit-tested, deterministic (pinned by `activeRun.determinism.test.ts`) ✅ |
| iOS pipeline | Capacitor shell + TestFlight CI workflow wired; RevenueCat/StoreKit 2 seam live ✅ |
| Balance harness | `npm run sim` — 40-seed optimizer baseline pinned; archetype panel + cliff probes healthy |

> **Note on older sections below:** Phases 0–4 were written before the v1.3.0 pivot from an $8.99
> paid app (+ a $2.99 Creative-Mode IAP) to **free download + Silicon Pro subscription**
> (`MONETIZATION.md` is authoritative). Items mentioning `iap.ts`, cordova-plugin-purchase, or the
> $8.99 price are historical — purchases today flow through `state/proStore.ts` over
> `storeKitBridge.ts`, and Creative Mode travels with Pro.

**Honest summary:** the game is feature-complete and heavily polished (TASK.md tracks v1 → v23:
device renderer, 3D HQ + office builder, market sim, stocks/IPO, staff identities, achievements,
NG+/prestige, scenarios, daily/weekly challenges, device museum, OS/Platform DLC). The retention
backbone the research called for is **already built**. The two things standing between this repo
and a thriving product are: **(1) shipping it**, and **(2) burning down the on-device
verification debt** that CI structurally cannot cover.

**The genre's #1 failure mode we design against (from RETENTION_ROADMAP §0):** Game Dev Tycoon's
endgame collapses to "just make more games" once cash snowballs and the recipe is solved. Two
standing tuning mandates guard this — keep bets *failable at every scale*, keep the winning recipe
*non-deterministic* via shifting trends/rivals. Every balance and content item below is filtered
through that.

---

## Phase 0 — SHIP v1.0 🔴 (owner-side, blocks everything)

The only critical-path work. Detailed steps live in `LAUNCH_CHECKLIST.md` (the older
`WHAT_YOU_NEED_TO_DO.md` is superseded); this is the gate.

- [ ] Apple Developer Program membership active; App Store Connect app record created
      (`com.wrexist.silicon`, SKU `SILICON-TECH-TYCOON-001`).
- [ ] Host `public/privacy.html` + `public/support.html` at live public URLs (Apple requires the
      privacy URL before submission). GitHub Pages `/docs` or Netlify Drop.
- [ ] Add the 3 CI secrets — `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`,
      `APP_STORE_CONNECT_API_KEY_BASE64`. Team ID `S3U8B8HH96` is already wired.
- [ ] Archive → TestFlight → on-device smoke. **NOT `npx cap add ios`** — the native project is
      committed (`ios/App/App.xcodeproj`) and carries the StoreKit/RevenueCat Swift; re-adding it
      would discard that. Use `npx cap sync ios`, or the `ios-testflight-capacitor.yml` workflow,
      which does the sync itself. Also note the project ships **universal** (`TARGETED_DEVICE_FAMILY
      = "1,2"`), not iPhone-only — see `OWNER_RELEASE_ACTIONS.md` #2. Old text: portrait-only +
      iPhone-only → archive → TestFlight →
      on-device smoke (Preferences mirror, status bar theme, haptics, splash).
- [ ] **Purchases — Silicon Pro is WIRED** (superseding the old paid-era text here, which told you
      to create/attach the `com.wrexist.silicon.sandbox` IAP at $2.99 and flip `NATIVE_IAP_WIRED` —
      that contradicts the locked constraints above and `LAUNCH_CHECKLIST.md`/`MONETIZATION.md`).
      Current reality: purchases flow through `storeKitBridge.ts` → `SiliconStoreKit.swift`
      (RevenueCat / StoreKit 2). The owner **creates + attaches the three Pro SKUs**
      (`com.wrexist.silicon.pro.monthly` / `.yearly` / `.lifetime`) per `LAUNCH_CHECKLIST.md` and
      `appstore/SUBSCRIPTION_GUIDE.md`. The legacy `com.wrexist.silicon.sandbox` SKU is
      **legacy-restore-only**: keep it live in App Store Connect, never re-sell, never attach it to
      the new submission's offering.
- [ ] Submit for review. **Get the first real crash/retention data from live players** — it
      re-prioritizes everything below.

**Definition of done:** the app is live on the App Store and a fresh install boots, plays a full
design→build→launch→reinvest loop, and saves/restores across a cold kill.

---

## Phase 1 — Launch hardening (the on-device debt burn-down) 🟠

CI cannot see layout, touch hit-testing, 3D context behaviour, or "does this *feel* right." TASK.md
carries **22 explicit `NOT verified on-device` / `needs a playtest`** flags. These are the highest
real risk to a 1.0 reputation — a review-bomb comes from a sheet that won't close on a real phone,
not from a failing unit test. Work this as a single focused TestFlight pass with a device in hand.

**1a — Interaction & layout (must-fix before/right after submit)**
- [ ] **3D tap hit-testing** (v19.1): tap-seated-employee → roster, tap-vault → Bank. Reuses the
      proven BuildLayer raycast but the wiring is new and unverifiable in CI — confirm taps register
      under the parallax camera and the vault wrap-group catches child-mesh taps.
- [ ] **Sheet dismiss** (v19.5): grab-handle tap/drag-down dismissal across every popup — confirm on
      a real phone (the original "sheets felt trapped" bug, IMG_0140).
- [ ] **Design step-nav px tune** (v19.5): the sticky Back/Next bar's fixed-position offset over the
      tab bar needs an on-device pixel pass.
- [ ] **WebGL context-loss** (v19.5, open question): is the 3D→2D fallback every launch or
      intermittent? Did "Try 3D again" recover it? Root-cause vs. the in-session remount mitigation.
- [ ] HUD wrap / runway warning, onboarding keyboard, Bank layout, masked-upgrade contrast, Rest
      thresholds, scenario/challenge card + tracker layouts, Result Card as an actual screenshot,
      `navigator.share` on iOS, Museum gallery at thumbnail size, Platform sheet layout.

**1b — Balance playtest (knobs are flagged, mechanisms are tested)**
- [ ] Validate the tuned magnitudes a full playthrough at a time: `selfPenalty` 0.22 /
      `rivalEntrySalesHaircut` 0.10 (v16); RP unlock costs (lenses 14/30, finishes 12/26; v18/v19.2);
      Rest cost/boost (1wk / +30; v19); Marketing Push 30%/35% (v19.4); OS license fee + uplift
      (v22.1); scenario objective thresholds + Underdog's wk-78 deadline (v20); challenge score
      windows + mutators (v21); Founder-perk magnitudes (v23.2). **Tune `balance.ts` only.**
- [ ] Confirm the "solved game" guards hold late-game: do trend/rival shifts still force recipe
      changes after IPO, and can a late bet still fail? (Tuning check on `market.ts` trendDrift +
      `competitors.ts`, not necessarily a code change.)

**Definition of done:** a 30-minute device session with no layout clip, no dead tap, no trapped
sheet, no balance cliff — and the balance knobs above either confirmed or adjusted in `balance.ts`.

---

## Phase 2 — Free update 1.1 "Goals & Bragging Rights" 🟢 (SUPERSEDED by the Silicon Pro pivot)

The retention backbone. **Most of this already shipped** (scenarios v20, share cards v20.1,
challenges v21, museum v23, founder perks + AI-era content v23.2). The IAP items below were
overtaken by events: there is no standalone Creative/Sandbox purchase any more — **Creative Mode
travels with Silicon Pro** (`proGates.ts`), purchases run through `proStore.ts`/`storeKitBridge.ts`
(RevenueCat or StoreKit 2 direct), and the legacy `iap.ts` restore path exists only so past buyers
keep their entitlement.

- [x] ~~**Wire + ship the Creative/Sandbox IAP**~~ — superseded: the stubs WERE implemented (against
      `SiliconStoreKit.swift`, not cordova-plugin-purchase), then the whole model was replaced by the
      subscription. Legacy SKU remains restorable.
- [x] **Component sidegrades** (Wave 1c) — DONE 2026-06-21. The perf↔battery trade already shipped
      (`tuningShift`); this session added the **value↔premium margin axis** (`tuningCostMultiplier`
      + `marginShift`) so the optimal recipe depends on cost strategy too, and pinned both with
      `tuning.test.ts` + the `balanceGuards.test.ts` no-universal-recipe property — the direct strike
      at the GDT determinism failure. *Optional follow-up:* per-component (not per-product) variants.
- [ ] **Sandbox depth so Pro earns its keep** (flagged thin): beyond the cash floor — unlimited
      component tiers, a lite scenario-start editor, cosmetic-only extras.
- [ ] **Polish carry-overs from Phase 1 device pass** that turned out to be real changes.

**Definition of done:** 1.1 submitted; the IAP is buyable + restorable on device; at least one
recipe-determinism guard (sidegrades) is live and tested.

---

## Phase 3 — The Office Shop overhaul ✅ (ALREADY BUILT — verified against source 2026-06-21)

**Correction:** `OFFICE_SHOP_PLAN.md`'s header still says "awaiting go-ahead," but the feature is
**shipped in the code** (the plan doc is stale, same pattern as the retention roadmap). Verified in
`engine/furniture.ts`, `engine/balance.ts`, `state/gameState.ts`, `screens/HQ.tsx`,
`state/officeShop.test.ts`:

- [x] **Engine:** `FurnitureDef` carries required `cost` + optional `attrs`
      (comfort/focus/inspiration), populated with the locked §2.3 table across the catalog.
      `BALANCE.shop` caps every attribute (`comfortCap` 15, `focusCap` 0.15, `inspCap`).
- [x] **State:** `placeFurniture` charges cash (can't-afford = no-op); `removeFurniture` refunds
      `resaleRate` (50%); `applyLayoutSnapshot` restores layout **and** cash (undo = true reversal);
      `duplicateFurniture` charges. Hiring is desk-gated — `deskCapacity = desks + desktops`.
- [x] **Attributes wired additively:** `officeComfortMoodBonus` → weekly mood target,
      `officeFocusMult` → `weeklyRpGen`, `officeInspoBonus` → `productStats.design`.
- [x] **UI:** HQ "Decorate" shop with live office-buff bars (Mood/Research/Design vs. cap),
      place/sell/duplicate, "Need $X", + a `DecorateTutorial`. 7 `officeShop.test.ts` cases.

**Remaining (small):**
- [x] Remove the now-**dead `buyDesktop` action** — ✅ shipped in commit `a5bd165`; zero references
      remain in `src/`. Old-save `desktops` still count as seats through `deskCapacity`.
- [ ] ⚠️ On-device polish pass of the Decorate UI (smoothness, no clipping) — device-only.

---

## Phase 4 — Paid DLC #1 "OS / Platform Division" 💵 (built — needs the live wrapper)

`DLC_OS_PLATFORM.md` Phases A+B+C are **already built** (v22/v22.1): `engine/platform.ts`, state,
`screens/Platform.tsx`. The "DLC purchase" wrapper below was superseded by the pivot: Platform
Division is now gated by the **Silicon Pro entitlement** (`proGates.ts` → `platformDivision`) plus
the earned in-game founding (`foundPlatform` — cash + reputation + shipped track record). No
separate IAP exists to create.

- [x] ~~Create the Platform Division IAP~~ — superseded: Pro entitlement + earned founding.
- [ ] On-device verification of the Platform sheet + the license-to-rivals trade-off reading
      clearly; playtest the licensing fee + strength-uplift magnitudes.
- [ ] Marketing beat: this is the endgame "what now?" fix after IPO — position it as a Pro highlight.

**Definition of done:** Platform Division reads clearly on device, with its two new levers (version
releases, rival licensing) balance-confirmed.

---

## Phase 5 — Performance & architecture hardening 🟠 (do alongside, not last)

Logged across v9/v16/v17 audits; refreshed against source 2026-08.

- [x] **State/actions context split (F36):** DONE — external-store context split landed
      (`refactor(state): external-store context split (F36)`).
- [x] **Shared geometry/material cache (F13, evolved):** `garage3d/sharedGpu.ts` pools
      geometries/materials by full args. The per-employee cluster was converted first
      (`RobotCharacter` + `Chair` + `HeadAccessory` + `DeskClutter`), then the ENTIRE parametric
      furniture catalog in `furniture3d.tsx` (all ~86 items, 365 mesh sites — none left declarative).
      `sharedRounded` now builds drei's exact extrude-with-creased-normals geometry (the earlier
      three-stdlib RoundedBoxGeometry was a lookalike, not the same mesh), material pools strip
      undefined params (three warns per undefined key per construction), and `sharedBasic`/
      `sharedPhysical`/plane/cone/ring pools were added. Pinned by `sharedGpu.test.ts`; verified
      pixel-equivalent in the shots harness on both the default staged room and a 26-item
      "exotic catalog" staged layout. Still open (smaller): only `BrickWall` + dust are instanced;
      light-mode VSM doubles shadow cost.
- [ ] **`frameloop="demand"` + `invalidate()`** retrofit for battery — measured HIGH-RISK: 36
      always-on animation sites across Garage3D/Factory3D would each need invalidation or they
      silently freeze. The cheap wins already shipped (off-screen `"never"`, hidden-tab pause,
      throttled cosmetic loops, camera settle).
- [x] `ContactShadows frames` re-bake audit — office already `frames={1}` + remount-keyed;
      factory bakes 60 frames then freezes (deliberate). DPR caps confirmed ([1,1.75] HQ,
      [1,1.4] preview). Disposal/listener sweep clean. BrickWall clamp moot (~350 max instances).

**Definition of done:** a long late-game save with a fully decorated office holds frame rate on a
mid-tier device and the 3D scene idles without redundant redraws.

---

## Phase 6 — Reach & accessibility 🟢 (largely DONE)

- [x] **iPad layout** — DONE (`feat(ios): enable iPad`, wide-screen chrome centering).
- [x] **rem-based type + iOS Dynamic Type** — DONE (`feat(a11y): rem-based type scale + Text Size setting`).
- [ ] Round the deliberate intrinsic object colours in `furniture3d.tsx`/`Garage3D.tsx` through
      `RoomPalette` for light-theme harmony; broader hardcoded-px → token sweep on screen CSS.

---

## Phase 7+ — Content cadence & deeper mastery (the sustaining layer) 🟢💵

Our data-driven `catalogs.ts` makes most of this cheap. Mix free drops (goodwill) with paid DLC
(revenue). Sequence by live data once players exist.

**Free drops (goodwill, low cost):**
- [~] **NG+ / mastery beyond bigger numbers** — DEEPENED 2026-06-21. Extended the founder-perk
      ladder 6→10 and added a genuinely new *qualitative* axis: build-cost reduction (Supply Chain
      Master −10%, Industrialist −15%, hard-capped −40% so manufacturing is never free) — a
      veteran founder plays a different margin game, not just a richer one. Wired into
      `toolingCost`/`effectiveUnitCost`; +tests. *Still open:* harder-mode mutators carried into
      replays, scenario-only unlocks.
- [ ] **New component tiers + a new device category** (renderer already supports
      laptop/desktop/monitor/console/wearable/AR silhouettes — gameplay-gated today). Each new
      category is content the engine already renders.
- [ ] **More device-renderer finishes/cosmetics as research unlocks** — the v18/v19.2 lens/finish
      seam generalizes to notch styles and module shapes.
- [ ] **Deeper challenge mutators** (no-marketing / fixed-price / recession) — needs `balance.ts`
      override plumbing (a larger change than the v21 start-override mutators).
- [x] **Achievements expansion** tied to scenarios/challenges — DONE 2026-06-21. Added a mastery
      tier reading cross-run profile data (Flawless Run = 3★ a scenario; Triple Threat = 3★ three;
      Campaign Complete = win all; Grand Master = 3★ all; Daily Devotee = 10 challenges). Engine stays
      pure via a `MasteryInput` the state layer supplies from the profile stores. +tests.

**Paid DLC #2 candidates (pick by live data):**
- [ ] **A new era past the AI Era** — fresh components, scenarios, and the "new toy" reach moment.
- [ ] **Category-themed expansion** (e.g. automotive / robotics) with its own components + scenarios.
- [ ] **"Rival CEO" expansion** — make competitors *reactive* (flagged in v9). The biggest depth
      lever: rivals that respond to your moves instead of evolving on rails.

**"New thinking" bets (RETENTION_ROADMAP §3 — ideas, not committed scope):**
- [ ] **Era-distinct mechanics** — each era should *play* differently, not just scale numbers
      (deliberately deferred large item: it reshapes the per-era economy and needs a full playtest).
      The v23.2 era-specific events/choices are the safe slice; true mechanic divergence is the big bet.
- [ ] **Deterministic "this week in tech" headlines** seeded from run state — VERIFIED against
      source 2026-08-24: *partially covered, deliberately not built further*. What exists: the feed's
      reactive lines; two genuine world-context beats (trend-retarget line, `engine/climate.ts`
      narration — both deterministic, but transition-weeks only); and `engine/buzz.ts` (BuzzTicker),
      which IS the described headline style (rank/OS/rival/era context, pure fold over state, zero
      RNG) but is render-only — never persisted to the feed, rotated by wall clock. What's missing:
      a week-seeded ambient line on QUIET weeks (a `hash01(seed, week, freshSalt)` pool). The build
      is small and the salt pattern is established, but the 2026-08 noise audit's verdict ("adding:
      nothing — surface what exists more calmly") argues against a new ambient stream. Decide
      against live-player feedback, not in the repo.
- [ ] **Scenario authoring from a finished run** → shareable offline "challenge codes" (a pasteable
      string, our server-free substitute for sharing leaderboard runs).
- [x] **Bankruptcy post-mortem share card** — DONE 2026-06-21. `ResultCard variant="postmortem"`
      (calm "memoriam" styling, self-deprecating share line) surfaced from the bankruptcy overlay via
      a "View shareable card" toggle. Failure made shareable, pillar #6. ⚠️ layout wants a device check.

---

## Locked constraints every phase is filtered through (do not violate)

1. **Free to download; revenue = the ONE Silicon Pro subscription, ZERO dark-pattern monetization.**
   (Pivot 2026-07 from the original $8.99-premium constraint.) Pro sells content and modes, never an
   in-run advantage; every gate sits on a player action or UI surface, never in `engine/`. No login
   streaks, FOMO timers, currency, boosts, loot boxes, or ads. **Ever.**
2. **No backend. Fully offline.** No accounts, cloud saves, global leaderboards, or live events.
   Substitute for the social layer: personal-best history + local achievements + parametric share cards.
3. **Zero image assets for hero content** — devices/UI/icons are parametric SVG/vector drawn in code.
4. **Engine-first discipline** — every new mechanic lands as pure, unit-tested `engine/` logic before
   any UI. New content ships as data in `catalogs.ts`.
5. **RULE #1 — premium through restraint.** DesignSystem tokens, 8pt grid, no cramped/blank screens.
   A smaller game that looks impeccable beats a bigger one that looks cheap.
6. **Protected (no refactor without explicit instruction):** `engine/`, persistence schema +
   migrations in `state/`, `render/DeviceRenderer.tsx` + category shapes.

---

## Definition of "retention" (the through-line)

A returning player always has **(a)** a new goal to chase (scenario star / today's challenge),
**(b)** a reason the next run differs (sidegrades, varied events, mutators, era mechanics), and
**(c)** something to show for it (share card / museum lineage) — all offline, all free of dark
patterns. **Revenue grows via content (paid DLC), never via nags.**

---

## At-a-glance sequence

| Phase | What | Type | Gate |
|---|---|---|---|
| **0** | Ship v1.0 to the App Store | owner-side | **blocks everything** |
| **1** | On-device debt burn-down + balance playtest | quality | right after submit |
| **2** | Free 1.1 retention backbone — mostly shipped; IAP items SUPERSEDED by the Silicon Pro pivot | free (IAP part superseded) | post-launch |
| **3** | Office Shop (priced, attributed furniture) — ✅ built; `buyDesktop` cleanup shipped (a5bd165) | free content | done |
| **4** | DLC #1: OS/Platform Division (built — needs live wrapper) | paid DLC | post-launch |
| **5** | Perf: context split, instancing, demand frameloop | hardening | alongside |
| **6** | iPad layout + Dynamic Type | reach/a11y | post-launch |
| **7+** | NG+ depth, content drops, DLC #2, era mechanics | free + paid | by live data |

_Append new ideas as one-liners to the relevant phase; don't act mid-session (CLAUDE.md discipline)._
</content>
</invoke>
