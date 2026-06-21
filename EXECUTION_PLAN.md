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
- [ ] 🧑 Ship **without** the IAP (the `iapAvailable()` seam hides it) → submit. IAP lands in Phase 2.

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

### 2a — Wire the Creative/Sandbox IAP 🧑🤖
- [ ] 🤖 Implement the 3 `NATIVE INTEGRATION POINT` stubs in `src/state/iap.ts` against
      `cordova-plugin-purchase` v13; flip `NATIVE_IAP_WIRED`.
- [ ] 🤖 Keep `entitlements.withValidatedSandbox` boot-revalidation intact (don't unlock on imported saves).
- [ ] 🧑 `npm i cordova-plugin-purchase && npx cap sync ios`; StoreKit config file; test buy **and**
      restore on device; attach IAP to the version.

### 2b — Component sidegrades 🔒 (the GDT-determinism strike — **needs go-ahead**)
Order strictly engine-first:
1. [ ] 🔒 `engine/catalogs.ts` — add sidegrade tiers with trade-off stats (cheaper-but-lower,
       battery-vs-performance) so the recipe stops being a fixed ladder.
2. [ ] 🔒 `engine/product.ts` — ensure `computeStats` reads the trade-off cleanly; no top-tier-always-wins.
3. [ ] 🤖 `engine/*.test.ts` — pin that no single recipe dominates across a trend sweep.
4. [ ] 🤖 `screens/DesignLab.tsx` — surface the trade-off in the component picker (not a dry number).
5. [ ] ⚠️ Balance playtest the trade-off weights.

*Risk:* protected engine + balance ripple. *Mitigation:* additive tiers, property test the
non-dominance claim, gate behind tests before any UI.

### 2c — Sandbox depth (make the IAP worth $2.99) 🤖
- [ ] 🤖 `state/` + `screens/Settings.tsx` — unlimited component tiers, cosmetic-only extras, a lite
      scenario-start editor (reuse `engine/scenarios.ts` setup shape). Gate all behind the entitlement.

---

## Phase 3 — Office Shop overhaul 🤖🔒⚠️ (the big unbuilt feature)

Full spec: `OFFICE_SHOP_PLAN.md`. Build strictly in this order (engine → state → 3D → UI).

### 3a — Engine (pure, tested) 🔒
1. [ ] 🔒 `engine/furniture.ts` — add `cost: number` (required) + `attrs?: {comfort?,focus?,inspiration?}`
       + explicit `seat?: boolean` to `FurnitureDef`. One data pass over the ~70 items (cost + attrs per §2.3).
2. [ ] 🔒 Hard-cap each attribute (§5.1) — pure helpers `comfortFromLayout / focusFromLayout /
       inspirationFromLayout` with clamps so decoration can't trivialize the sim.
3. [ ] 🤖 `engine/furniture.test.ts` — cost on every item; attribute caps; seat derivation.

### 3b — State + migration 🔒
4. [ ] 🔒 `state/gameState.ts` — buy charges cash; **sell refunds 50%**; **undo restores cash**;
       remove the `buyDesktop` upgrade path; desks become the only seat source (`deskCapacity`).
5. [ ] 🔒 Persistence migration — starter room → desk + plant; existing saves keep their room and get
       a **one-way capped buff**; backfill `cost`/`attrs` defaults. Versioned, safe.
6. [ ] 🤖 Tests — buy/sell/undo cash conservation; hire-gate tied to bought desks; migration idempotence.

### 3c — Wire attributes into the sim 🤖
7. [ ] 🤖 Feed comfort→mood, focus→research, inspiration→design **additively** on top of HQ upgrades
       (the existing selectors). No upgrade line removed except `buyDesktop`.

### 3d — 3D + UI 🤖⚠️
8. [ ] 🤖 `garage3d/furniture3d.tsx` — no change to renderers; ensure new attrs don't affect visuals.
9. [ ] 🤖 `screens/HQ.tsx` + `hq.css` — Decorate panel becomes a **shop**: price tags, buy/sell,
       attribute readout; mobile-first so nothing clips.
10. [ ] ⚠️ On-device: buy/place/sell smoothness; attribute readout clarity; migration sanity on a real save.

*Risk:* touches the hire-gate + economy + save schema. *Mitigation:* land 3a–3b fully green before
any UI; treat the migration as protected; playtest the attribute caps.

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

Given Phase 0 is owner-side, here's the agent-buildable sequence I'd actually run, smallest-risk-
to-market first. **Each line is one go-ahead-able unit; I'll deliver each as a tested commit series.**

1. **Phase 1b balance pass** — no go-ahead needed; `balance.ts`-only; ships confidence for launch.
2. **Phase 5a furniture instancing** — pure perf win, no schema risk, clears the way for Phase 3.
3. **Phase 2b component sidegrades** 🔒 — highest design value (kills the solved-game endgame).
4. **Phase 3 Office Shop** 🔒 — biggest content win; engine-first, careful migration.
5. **Phase 2a/4 IAP wiring** — pairs with the owner's StoreKit/device steps.
6. **Phase 5b context split, Phase 6 reach, Phase 7 content** — by live data.

**The three 🔒 items I cannot start without your explicit go-ahead:** component sidegrades (2b),
the Office Shop engine/migration (3a/3b), and the state/actions context split (5b). Say the word on
any and I'll begin engine-first with tests.

---

_Mirror status changes into `ROADMAP.md`. Append new tasks under the right phase; don't act mid-session._
</content>
