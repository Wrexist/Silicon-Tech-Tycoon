# Silicon: Tech Tycoon — Execution Plan (the detailed TODO)

Granular, ordered breakdown of every `ROADMAP.md` phase into executable engineering tasks. Each
task lists **files touched · order · tests · risk**. This is the working checklist; tick items as
they land and mirror status into `ROADMAP.md`.

**Legend:** 🧑 owner-only (Mac/Apple/network) · 🤖 agent-buildable in this repo ·
🔒 touches PROTECTED engine/persistence → needs explicit go-ahead first · ⚠️ needs an on-device
playtest to confirm magnitudes.

> **Discipline (CLAUDE.md):** engine-first — pure tested logic before any UI. One logical change
> per commit. `engine/` imports nothing from React/DOM. Don't start a 🔒 item without a go-ahead.
> **Do not start Phase 3+ before Phase 0 is live** — shipping is the nearest-to-market work.

---

## Phase 0 — Ship v1.0 🧑 (owner-side, blocks everything)

Pure checklist; full steps in `WHAT_YOU_NEED_TO_DO.md`. No agent code here.

- [ ] 🧑 Apple Developer Program active.
- [ ] 🧑 Host `public/privacy.html` + `public/support.html` live (GitHub Pages `/docs` or Netlify Drop).
- [ ] 🧑 App Store Connect record: `com.wrexist.silicon`, SKU `SILICON-TECH-TYCOON-001`, $8.99, 4+, all countries.
- [ ] 🧑 Add 3 CI secrets: `APP_STORE_CONNECT_KEY_ID`, `_ISSUER_ID`, `_API_KEY_BASE64`. (Team `S3U8B8HH96` wired.)
- [ ] 🧑 `npx cap add ios` → portrait-only + iPhone-only → archive → TestFlight.
- [ ] 🧑 On-device smoke: Preferences mirror, status-bar theme, haptics, splash, full design→launch loop.
- [ ] 🧑 Ship **WITH** the Creative-Mode IAP — it's already wired (`NATIVE_IAP_WIRED = true`,
      `SiliconStoreKit.swift`), so create + attach it in App Store Connect and test buy+restore (see
      `SHIP_READINESS.md`). *To defer instead:* flip `NATIVE_IAP_WIRED = false` in `src/state/iap.ts`
      (the `iapAvailable()` seam then hides the purchase UI) and ship it in a 1.x update. → submit.

**Agent support available now:** I can pre-stage anything code-side the owner needs (verify
`ExportOptions.plist`, the TestFlight workflow, `Info.plist` flags, icon/splash generation) — ask
and I'll audit each before the owner touches Xcode.

---

## Phase 1 — Launch hardening 🤖⚠️ (on-device debt + balance)

Two workstreams. 1a needs a device; the agent's job is to prepare instrumented fixes and land them
the moment a report comes back. 1b is `balance.ts`-only tuning behind tests.

### 1a — Interaction & layout fixes (driven by a TestFlight report)
For each, the pattern is: reproduce from the report → fix → note the on-device re-check needed.

- [ ] ⚠️ **3D tap hit-testing** — `garage3d/Garage3D.tsx`, `furniture3d.tsx`. Confirm seated-employee
      and vault taps register under the parallax camera. *Risk:* raycast vs. camera offset.
- [ ] ⚠️ **Sheet dismiss** — `design/primitives.tsx` (`Sheet`). Tap/drag-down handle on every popup.
- [ ] ⚠️ **Design step-nav offset** — `screens/DesignLab.tsx`, `designLab.css`. Pixel-tune the sticky
      Back/Next bar above the tab bar.
- [ ] ⚠️ **WebGL context-loss root-cause** — `garage3d/Garage3D.tsx` + `components/ErrorBoundary.tsx`.
      Determine every-launch vs. intermittent; keep the "Try 3D again" remount as the floor.
- [ ] ⚠️ HUD wrap/runway (`components/Hud.tsx`), onboarding keyboard (`App.tsx`), Bank
      (`components/Bank.tsx`), masked-upgrade contrast (`screens/HQ.tsx`), Rest thresholds
      (`screens/Company.tsx`), scenario/challenge trackers, Result Card screenshot,
      `navigator.share` iOS, Museum thumbnails, Platform sheet.

### 1b — Balance playtest pass (🤖, `engine/balance.ts` only)
Mechanisms are already tested; only magnitudes move. One commit per knob group; re-run tests each.

- [ ] ⚠️ Competition: `selfPenalty` 0.22, `rivalEntrySalesHaircut` 0.10.
- [ ] ⚠️ RP costs: lens 14/30, finish 12/26.
- [ ] ⚠️ Interventions: Rest 1wk/+30, Marketing Push 30%/35%.
- [ ] ⚠️ Platform: OS license fee + strength uplift.
- [ ] ⚠️ Scenario thresholds + Underdog wk-78 deadline; challenge score windows + mutators.
- [ ] ⚠️ Founder-perk magnitudes.
- [ ] 🤖 **Late-game determinism check** — confirm trend/rival shifts still force recipe changes
      post-IPO and a late bet can still fail (`market.ts` trendDrift, `competitors.ts`). Tuning only.

**Output of Phase 1:** a "device session checklist" doc + whatever fixes the report demands, plus a
balance commit series.

---

## Phase 2 — Free 1.1: IAP + sidegrades + sandbox depth 🤖🔒

### 2a — Creative/Sandbox IAP ✅ ALREADY WIRED (audited 2026-06-21, see SHIP_READINESS.md)
Not cordova-plugin-purchase — a native StoreKit 2 plugin. The "3 NATIVE INTEGRATION POINT" labels
sit above real implementations.
- [x] 🤖 `src/state/iap.ts` — `registerPlugin("SiliconStoreKit")`, `NATIVE_IAP_WIRED = true`, all
      StoreKit statuses handled with the revenue guard (grant only on confirmed `purchased`).
- [x] 🤖 `ios/App/App/SiliconStoreKit.swift` — StoreKit 2 product/purchase/restore + txn listener;
      `ios/App/Configuration.storekit` product for simulator testing.
- [x] 🤖 `entitlements.withValidatedSandbox` boot-revalidation intact (imported saves can't unlock).
- [ ] 🧑 Create + attach the IAP in App Store Connect; test buy **and** restore on device. (Or flip
      `NATIVE_IAP_WIRED=false` to hide it and ship in 1.x.)

### 2b — Component sidegrades ✅ DONE 2026-06-21
Discovered the perf↔battery axis already shipped; added the missing margin axis + guards.
1. [x] 🤖 `balanceGuards.test.ts` — pins "no universal recipe" + "gouging fails" + "power matters".
2. [x] 🤖 `tuning.test.ts` — pins the perf↔battery trade is trend-dependent (not a no-op).
3. [x] 🔒 `types.ts` / `balance.ts` / `product.ts` — added `value`/`premium` to `ProductTuning`;
       pure `tuningCostMultiplier`; `marginShift` + `tuningCostMult` constants.
4. [x] 🔒 `state/gameState.ts` — value/premium appeal shift in `productStats`; cost multiplier in
       `toolingCost` + `effectiveUnitCost`. Persistence already backfills `tuning → "balanced"`.
5. [x] 🤖 `screens/DesignLab.tsx` — two chips in the existing wrapping Tuning picker.
6. [ ] ⚠️ Playtest magnitudes (0.85 / 1.18 / 6) + the 5-chip row layout on device.
*Optional follow-up:* per-component (not per-product) sidegrade variants.

### 2c — Sandbox depth (make the IAP worth $2.99) 🤖
- [ ] 🤖 `state/` + `screens/Settings.tsx` — unlimited component tiers, cosmetic-only extras, a lite
      scenario-start editor (reuse `engine/scenarios.ts` setup shape). Gate all behind the entitlement.

---

## Phase 3 — Office Shop overhaul ✅ ALREADY BUILT (verified against source 2026-06-21)

`OFFICE_SHOP_PLAN.md`'s "awaiting go-ahead" header is **stale** — the feature ships in the code.
Verified, all DONE:
- [x] 🔒 `engine/furniture.ts` — `FurnitureDef.cost` (required) + `attrs` (comfort/focus/inspiration),
      §2.3 table across the catalog. `engine/furniture.test.ts` covers it.
- [x] 🔒 `engine/balance.ts` — `BALANCE.shop` caps (`comfortCap`/`focusCap`/`inspCap`, `resaleRate`).
- [x] 🔒 `state/gameState.ts` — `placeFurniture` charges (no-op if broke); `removeFurniture` refunds
      50%; `applyLayoutSnapshot` restores layout + cash (undo = true reversal); `deskCapacity`
      desk-gates hiring. `state/officeShop.test.ts` (7 cases).
- [x] 🤖 Attributes wired additively: `officeComfortMoodBonus` (mood target), `officeFocusMult`
      (`weeklyRpGen`), `officeInspoBonus` (`productStats.design`).
- [x] 🤖 UI: HQ Decorate **shop** with live buff bars vs. cap, place/sell/duplicate, "Need $X",
      `DecorateTutorial`.

**Remaining (small):**
- [ ] 🤖 Remove the dead `buyDesktop` action (exposed via `useGame`, no UI caller) — low-priority
      cleanup; keep old-save `desktops` counting through `deskCapacity`.
- [ ] ⚠️ On-device polish of the Decorate shop (smoothness / no clipping).

---

## Phase 4 — DLC #1 OS/Platform wrapper 🤖🧑⚠️

Engine + UI already built (`engine/platform.ts`, `screens/Platform.tsx`). Remaining = make it a product.
- [ ] 🧑 Create the Platform Division IAP in App Store Connect.
- [ ] 🤖 Wire its purchase/restore through the same `src/state/iap.ts` seam as Creative Mode (second product id).
- [ ] ⚠️ On-device: Platform sheet layout; license-to-rivals trade-off reads clearly; fee/uplift magnitudes.

---

## Phase 5 — Perf & architecture hardening 🤖

Do 5a before Phase 3's UI ships (item counts rise); the rest alongside.
- [ ] 🤖 **5a Furniture instancing (F13)** — `garage3d/furniture3d.tsx`. Instance repeated meshes
      (only `BrickWall` is today). Verify draw-call drop.
- [ ] 🔒 **5b State/actions context split (F36)** — split the monolithic game context so the 1s tick
      stops re-rendering 3D. Largest perf lever; touches `state/` wiring broadly → go-ahead + careful diff.
- [ ] 🤖 **5c `frameloop="demand"` + `invalidate()`** — `garage3d/Garage3D.tsx`. Battery. Do with eyes
      on the scene (wrong conversion silently freezes it).
- [ ] 🤖 **5d** GPU-tier quality scaling; share Character geometries; clamp `BrickWall` instances;
      `ContactShadows frames` re-bake audit.

---

## Phase 6 — Reach & accessibility 🤖⚠️

- [ ] 🤖⚠️ **iPad layout** — adapt HUD + screens to the larger canvas; re-enable
      `TARGETED_DEVICE_FAMILY` "1,2" in `Info.plist`/pbxproj; iPad screenshots for ASC. On-device check.
- [ ] 🤖 **rem-based type + iOS Dynamic Type** — `design/tokens.css` + screen CSS; respect system text size.
- [ ] 🤖 Route intrinsic object colours in `furniture3d.tsx`/`Garage3D.tsx` through `RoomPalette`;
      broader hardcoded-px → token sweep.

---

## Phase 7+ — Content cadence & DLC #2 🤖🔒💵

Sequence by live data once players exist. All content lands in `catalogs.ts`/data tables.

**Free drops:**
- [ ] 🤖 NG+/mastery depth — extend `engine/perks.ts`: prestige modifiers, mutators carried into
      replays, scenario-only unlocks.
- [ ] 🔒 New component tiers + a new device category (renderer already supports the silhouettes;
      gameplay-gate is the work). Engine-first + balance.
- [ ] 🤖 More finishes/cosmetics as research unlocks — generalize the v18/v19.2 lens/finish seam
      (notch styles, module shapes).
- [ ] 🔒 Deeper challenge mutators (no-marketing / fixed-price / recession) — needs `balance.ts`
      override plumbing in `engine/challenges.ts`.
- [ ] 🤖 Achievements expansion tied to scenarios/challenges — `engine/achievements.ts`.

**Paid DLC #2 (pick one by data):**
- [ ] 🔒💵 New era past the AI Era — `engine/eras.ts` + `catalogs.ts` + scenarios.
- [ ] 🔒💵 Category-themed expansion (automotive/robotics) — components + scenarios.
- [ ] 🔒💵 "Rival CEO" expansion — reactive competitors in `engine/competitors.ts` (biggest depth lever).

**"New thinking" bets (ideas, not committed):**
- [ ] 🔒 Era-distinct mechanics (the big one — reshapes per-era economy; full playtest).
- [ ] 🤖 "This week in tech" headlines from run state (verify the live feed doesn't already cover it).
- [ ] 🤖 Scenario authoring from a finished run → offline challenge codes.
- [ ] 🤖 Bankruptcy post-mortem share card — reuse `components/ResultCard.tsx`.

---

## Suggested execution waves (what I'd build, in order)

**Done this session (2026-06-21):** `balanceGuards.test.ts` (Phase 1b guard), `tuning.test.ts`
(sidegrade guard), the value/premium margin axis (Phase 2b). **Audit correction:** Phase 2b was
mostly already shipped and **Phase 3 Office Shop is fully shipped** — both plan docs were stale; the
roadmap/this file now reflect verified source.

What genuinely remains, agent-buildable, in order:
1. **Phase 5a furniture instancing** ⚠️ — perf win, but the spec says "do with eyes on the scene";
   safest *after* a device is available, not blind.
2. **Phase 5b state/actions context split** 🔒 — biggest perf lever; broad `state/` change.
3. **Phase 6 iPad layout + Dynamic Type** ⚠️ — reach; needs device verification.
4. **Phase 7 content** — NG+ depth (`perks.ts`), new tiers/categories (`catalogs.ts`), achievements
   expansion, "this week in tech" headlines. [x] bankruptcy post-mortem card DONE 2026-06-21
   (`ResultCard variant="postmortem"`, surfaced from the bankruptcy overlay).
5. ~~Phase 2a IAP wiring~~ — ✅ already wired (native StoreKit 2); only owner-side ASC create+attach
   remains. Phase 4 (Platform DLC) IAP is a separate product, still entitlement-stubbed.

**Honest status:** the high-value *engine* work the roadmap imagined is largely already in the repo.
What's left is dominated by (a) owner-side shipping, (b) device-needing UI/perf, and (c) content
drops best prioritized by live player data. The cleanest remaining pure-logic wins are Phase 7
content items; the rest wants a device or a go-ahead on the 🔒 context split.

---

_Mirror status changes into `ROADMAP.md`. Append new tasks under the right phase; don't act mid-session._
</content>
