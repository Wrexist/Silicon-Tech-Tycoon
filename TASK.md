# Silicon: Tech Tycoon — Build Plan & Progress

Web-stack port of `TECH_TYCOON_PLAN.md` (native SwiftUI → Vite/React/TS + Capacitor).
The game design is unchanged; only the rendering/persistence technology is adapted.

## Phases
- [x] **P0 — Scaffold + handoff docs** (Vite/React/TS, configs, CLAUDE/TASK/LEARNINGS)
- [x] **P1 — Design system** (tokens light/dark + primitives + haptics + toast)
- [x] **P2 — Pure engine** (money, balance, catalogs, product/stats, market, salesCurve,
      economy, competitors, eras) — 38 vitest tests green
- [x] **P3 — Game store** (useGame: compose engine, sim tick, localStorage + offline catch-up)
- [x] **P4 — Parametric device renderer** (deviceStyle, squircle, SVG slab; phone + tablet
      focus, all categories render-ready)
- [x] **P5 — Screens + playable loop** (HQ + iso scene + HUD + nav, Design Lab w/ live preview,
      Research, Market, Company: staff/facilities/financials) + onboarding-lite + bankruptcy
- [ ] **P6 — Balancing pass** (fast-forward harness, tune balance.ts only) — NEXT: early game
      is currently too punishing (low-tier launches can sell ~0 units; reputation drops fast)
- [ ] **P7 — Polish pass** (microinteractions, empty/loading states, hero device idle float)
- [ ] **P8 — PWA manifest + Capacitor iOS scaffold**
- [ ] **P9 — StoreKit/IAP plumbing (Sandbox unlock) — deferred until iOS build**
- [ ] **P10 — Accessibility, perf, store listing**

## v1 scope (keep tight — must feel COMPLETE)
Phone + Tablet playable end-to-end: design → launch → market → reinvest, market sim, staff,
one facility upgrade, financials. Remaining categories are render-ready but gameplay-gated.

## v2 — "Company Evolution" expansion (DONE)
- [x] **V1 — Device overhaul** (#7): front+back 3D flip, realistic thin-bezel front
      (notch/punch/island/none), premium back camera module (concentric-ring lenses + coating
      tint + specular, flash, LiDAR), brand mark, materials sheen. New Product design fields
      (camera count/layout/position/module/flash, notch). Design Lab pickers + live redraw + flip.
- [x] **V2 — Floating gain animations** (#8): rising +$ / +RP tokens (`design/GainFX.tsx`),
      count-up HUD, build progress bars.
- [x] **V3 — Research Points + employees + projects** (#9): RP generated weekly (scaled by era);
      tech unlocks + 6 research projects cost RP; staff assignment (rnd/design/marketing/idle)
      drives function output; weekly XP auto-levels skill; paid training. Project effects wired
      (assembly line / lean supply / qa lab / talent network / brand studio / global dist).
- [x] **V4 — Manufacturing phase** (#10): Design → Build (timed by rnd skill + Assembly Line) →
      Ready shelf → Launch (scored at launch so timing matters). HQ shows In-production progress
      + Ready-to-launch. Garage animates while building/selling.
- [x] **V5 — Balancing** (#11): competition is now a *share multiplier* (never erases a viable
      product); volume floor so shipped products sell something; hype base up; reputation softer.

## v2.1 — staff identities (DONE)
- [x] Each employee has appearance + specialty + trait + mood; effects wired; garage figures +
      roster avatars share one identity; Company roster shows specialty/trait/mood.

## v3 — depth, polish & shipping (DONE this pass)
- [x] **Sound system** (`design/sound.ts`): synthesized Web Audio cues, mutable, wired to taps/
      launch/hit/build/level-up/era/bankrupt + event toasts.
- [x] **Settings** (`screens/Settings.tsx`): theme (System/Light/Dark, persisted via
      `state/settings.ts`), sound + haptics toggles (gated everywhere), Creative/Sandbox unlock
      (unlimited cash), restart-with-confirm, version. Gear in the HUD.
- [x] **Market events** (`engine/events.ts`): periodic viral trends / press / scandal / talent /
      supply crunch / burnout / RP breakthrough — feed + toast + sound.
- [x] **Distinct device silhouettes**: laptop (hinge+deck), tower, monitor+stand, console,
      smartwatch+straps, AR glasses — flip is phone/tablet-only now.
- [x] **IPO win + New Game+ prestige** (`state/legacy.ts`): Go Public at final era + high rep →
      celebration w/ valuation → prestige restart carrying a permanent legacy bonus.

## v3.1 — real-time 3D HQ (DONE)
- [x] **Procedural 3D garage** (`src/garage3d/`, react-three-fiber + drei): lit room, soft
      contact shadows, warm pendant point light, emissive laptops, parallax camera, props +
      animated printer, and **characters built from the same identity** (skin/hair/shirt/
      accessory/mood) with idle typing/head-turn. Zero image assets (all primitives).
- [x] **Safe & optional:** lazy-loaded (three.js stays out of the 103KB initial bundle — it's a
      244KB-gzip chunk loaded only when the 3D HQ shows), SVG `IsoScene` fallback for no-WebGL /
      reduce-motion / toggle-off, **"3D headquarters" Settings toggle**, DPR cap, render paused
      when the page is hidden. Verified premium in light + dark themes.

## v3.2 — office upgrades + hardening (DONE)
- [x] **Office Upgrades** (`engine/upgrades.ts`): 6 cash-bought tiered lines — Workstations
      (+research), Design Suite (+design ceiling & stat), Test Lab (+quality), Marketing Suite
      (+hype), Amenities (+team mood), Assembly (−build time & cost). Wired into every relevant
      selector; Company "Office upgrades" section (pip progress + cost); 3D office gains plants
      as Amenities rise. 42 tests (4 new) green.
- [x] **Audit fixes** (two full-codebase audits): money.format non-finite guard; weeklyRp era
      clamp; persistence try/sanity-fallback + full field backfill; IPO re-show after New Game+;
      no false "level-up" sound on hire; GainFX timeout cleanup; defensive `appearance` default +
      occupants clamp; product-name input aria-label; debounced save (~4s, off the per-tick path).
- NOTE: heavy iterative HMR (50+ hot-updates) can corrupt the dev-server module graph and throw
      a transient `<AppShell>` error — a full reload / `preview_start` fixes it; the build is clean.

## v4 — features, packaging, a11y & tutorial (DONE)
- [x] **Smart auto-naming** (`engine/naming.ts`): `suggestNextName` increments a trailing digit
      run, recognizes number-words (One→Two…twenty, case-preserving) and Roman numerals (IV→V),
      else appends " 2". Design Lab seeds the next draft from the newest product name. 4 tests.
- [x] **Premium price slider** (`design/primitives.tsx` `Slider`): native range, fill track,
      function-accent colour, haptic on change. Replaces +/- price steppers in the Design Lab.
- [x] **Function colour-coding**: engineering=orange, design=green, marketing=blue tokens
      (`tokens.css` `--fn-*`), applied to bottom nav active item, screen titles, Company role/
      assignment chips, the price slider, and the tutorial coach accent.
- [x] **Marketing channels** (`engine/marketing.ts`): launch a built product via a campaign —
      None / Social / Search / Billboards / Influencer / TV / Launch Event — each adds launch hype
      (+ reputation) for a cash cost, gated by affordability. HQ "Market" sheet picks the channel.
- [x] **Office upgrades dual-monitor 3D**: Workstations tier 3+ adds a second laptop; Amenities
      add plants (already shipped in v3.2, reflected in HQ scene).
- [x] **PWA**: `manifest.webmanifest` + parametric `public/icon.svg`, `index.html` meta (installable,
      theme-colour, apple-touch-icon). `capacitor.config.ts` wraps `dist/` for the iOS shell.
- [x] **Guided first-build tutorial** (`components/Coach.tsx`): progress-driven coach card floating
      above the nav — Design → Build → (manufacturing) → Market & launch → done. Reads game state
      (no fragile DOM anchoring), function-coloured per step, dismissible, auto-finishes on first
      launch. Persisted via `tutorialDone`; skipped for New Game+ and backfilled-true for old saves.
- [x] **Accessibility pass**: global `:focus-visible` ring; app-wide `prefers-reduced-motion`
      catch-all (neutralizes coach/gain/shimmer keyframes); `aria-pressed` on all selection chips
      (category/finish/colour/segmented/marketing); `role="dialog"`/`aria-modal` on the Sheet;
      device & iso scenes already expose `role="img"` + descriptive labels.
- [x] **Store listing** (`STORE_LISTING.md`): ASO draft — name/subtitle/keywords, description,
      screenshot plan, pricing + privacy notes. (No real brand/product names — IP rule.)

## v5 — office builder + room polish (DONE)
- [x] **Real garage-startup room** (`garage3d/`): polished-concrete floor with expansion-joint
      seams + painted work-zone, instanced **brick accent wall**, detailed **sectional garage
      door** (panels/insets/window-row/tracks), exposed **ceiling beams** + festoon string lights,
      baseboards, framed window, pegboard w/ tools, whiteboard. New palette materials.
- [x] **Sim speed**: base pace slowed (4s/week) + a **Fast** button (≈6×) beside Pause; HUD shows
      the week number ("Wk 34 · Y1 Q2").
- [x] **Upgrades made physical** in 3D: computers→desk monitors (dual at T2+), marketing→branded
      **wall TV** w/ canvas-drawn company name, amenities→coffee station + plants, design→easel,
      testLab→test chamber. Desks grow from 1 with the team. Company name added (onboarding rename).
- [x] **Interactive office builder** ("Decorate" mode) — the Sims-style ask:
  - `engine/furniture.ts`: 22-item catalog across 9 categories + a **pure grid placement model**
    (footprint, rotation, bounds + overlap checks, world mapping). 6 unit tests.
  - `state`: `layout: PlacedItem[]` + reducers (place/move/rotate/remove/reset) + persistence
    backfill + a tasteful **default furnished room**.
  - `garage3d/furniture3d.tsx`: parametric 3D renderer for every item (zero assets).
  - 3D build mode: overhead camera, **floor grid**, raycast **tap-to-place with snap**, green/red
    **ghost** footprint, tap-to-select → **move/rotate/delete**; furniture always rendered in the
    cozy view too.
  - HQ UI: **Decorate** button, categorized **furniture palette**, edit toolbar, reset.
- [x] **Factory/assembly room-expansion scrapped** (per direction) — office only.
- [x] **Comprehensive catalog + search** — expanded to **56 items across 10 categories**
      (Desks, Seating, Tables, Storage, Lighting, Plants, Decor, Fun, Tech, **Garage**). Modern
      office (standing/dual desks, reception, gaming chair, bean bag, neon sign, art canvas,
      globe, floor clock, sculpture, partition, arc lamp, vending, pool table, foosball,
      treadmill, robot arm, tower PC) + garage (workbench, tool cabinet, tire stack, step ladder,
      oil drum). Each has a hand-modelled parametric renderer. Added a **search bar**
      (`searchFurniture`) that filters across all categories by name/category.

## v6 — builder depth (DONE)
- [x] **Room theming** (`engine/roomStyle.ts`): pick a **floor finish** (Concrete / Wood / Tile /
      Carpet / Polished — each changes colour, seam pattern + sheen) and a **wall style** (Brick /
      Painted / Warm / Concrete / Wood Panel). Theme-aware (dark+light colours). New "Room" tab in
      the builder with live swatch pickers; persisted in `roomStyle`.
- [x] **Builder workflow**: **Duplicate** (drops a copy in the nearest free cell), **Undo** (40-deep
      layout-snapshot history), and a dedicated Reset. New `duplicateFurniture`/`setLayout` reducers.
- [x] **Drag-to-move** (`BuildLayer`): press any piece and drag — it lifts + follows your finger,
      snaps to the grid, with a green/red ghost at the landing cell; release to drop (blocked/off-grid
      → snaps back). Standard r3f pattern (item pointerdown → floor-plane move tracking via event
      propagation → window pointerup commit). Tap = select for the rotate/duplicate/remove toolbar;
      pick from the catalog → tap to place. Replaces the old tap-to-select-then-tap-to-move.

## v7 — comprehensive audit + hardening (DONE)
6-agent parallel audit (engine / state / 3D / UI / balance / code-health). Fixed:
- [x] **Robustness**: top-level **ErrorBoundary** (+ 3D→2D fallback boundary) so nothing white-screens;
      `money.format` extreme-value fallback; `canAdvanceEra` false at final era; `pickEvent` empty-pool
      fallback; `furnitureDef` fallback; `salesCurve` peak-week divide-by-zero guard; `staff.output`
      finite-skill guard (immunizes the whole sim from one corrupt value). +5 robustness tests.
- [x] **Persistence**: backfilled every previously-unguarded field (cash, reputation, cumulativeRevenue,
      week, seed/rngState, facilityTier, researched, launched, lastActive, roomStyle.wall) — old/truncated
      saves can no longer crash the first tick.
- [x] **Save correctness**: fixed-interval save now actually fires during play (was a never-firing debounce);
      `lastActive` stamped on save not per tick (pure reducer + correct offline time); visibility save only
      when hidden; single load+catch-up (no double-load/flash).
- [x] **Sim correctness**: RP/week now applies the Workstations multiplier in the tick (matched the UI).
- [x] **Perf**: `React.memo(FurniturePiece)` + skip-redundant-cell updates (layout no longer re-renders every
      drag-move); **three.js split into its own cacheable chunk** (Garage3D chunk 900KB→234KB).
- [x] **Builder UX**: place-mode taps fall through to the floor (correct cell, no offset); drag snaps back
      when released off-grid.
- [x] **A11y/polish**: `aria-pressed`+labels on assignment chips, furniture tiles, room swatches, theme
      segs; touch targets bumped (HUD 34→40, builder icons 34→40, clear 24→30); live Undo disabled-state;
      `Image` icon aliased; removed dead `.co__upg` CSS.

## v8 — economy + stock market + IPO (DONE)
- [x] **Tighter early economy**: starting cash $50k→$24k; **upfront tooling cost** charged when a build
      starts (`buildCost × 42`, Assembly cuts it) so building is a real bet and a flop loses the tooling;
      sales `floorUnits` 140→70 so flops can't recoup. Engine tests still green (still winnable).
- [x] **Fictional public rivals** (`competitors.ts` roster, IP-safe parodies): **Pomelo** (Apple),
      **Tristar** (Samsung/"three stars"), **Googol** (Google), **NovaPlus** (OnePlus), **Pandacore**
      (Huawei/Xiaomi), **Quantyx** (challenger) — each with a personality blurb, reputation, and a **live
      share price** that evolves weekly (drift + reputation momentum + launch pops + volatility).
- [x] **Stock market** (`engine/stocks.ts` + Market tab): buy/sell rival shares with a 0.8% brokerage,
      per-share price + sparkline + daily % change, your holdings value, and **weekly dividends** from
      held rivals. Trade sheet with quantity stepper + presets + Max + Sell-all.
- [x] **Company IPO + ownership**: live **valuation** (baseline + revenue + reputation), **Go Public**
      once established ($750k lifetime revenue) — sell a 5–49% stake via a slider for a cash infusion and
      keep the rest; **sell more shares** post-IPO (dilution, keeps ≥5%); founder **stake value** + a
      **Net worth** banner (cash + portfolio + stake). New `stocks` unit tests. 61 tests green.
      Verified live: fresh game shows the 6 brands; bought 5 Pomelo @ $940; IPO sold 20% for $2.48M
      → company "publicly traded", 80% owned, "Sell more shares" available. Old saves keep their
      rivals (backfilled with share prices). The ErrorBoundary caught a missing-import mid-build and
      degraded gracefully instead of white-screening — fixed the import.

## v9 — remaining backlog (audit findings not yet actioned)
**Robustness/perf (recommended next):** multi-tab localStorage write-guard (BroadcastChannel) — the only
  real save-loss path on web; split the monolithic game context into state+actions (the 1s tick re-renders
  the whole tree incl. 3D — biggest perf win); `ContactShadows frames={…}` to stop per-frame shadow re-bake;
  share Character geometries; clamp `BrickWall` instance count.
**Balance (need playtesting — flagged, not changed):** early game has no failure pressure ($50k = ~250wk
  runway, founder free, 140-unit floor guarantees profit) → tighten start; flops barely sting → scale floor
  down; era `revToAdvance` is dead (OR with easy rep) → reconsider; RP & training outpace content/cost →
  add sinks; competition is cosmetic (factorK 0.012) → make rivals bite; amenities/veteran-trait under/over-
  powered; launchScore caps flatten late game.
**Depth/content ideas:** recurring revenue/services layer tied to the under-used `ecosystem` stat; production
  capacity tied to assembly; reactive competitors; staff churn/quitting + raises; per-era distinct mechanics;
  mid-life price cuts / product refreshes; more events with player choices; 2D builder entry (currently
  hidden when WebGL is off).
**Polish:** add `--fs-micro`/`--sp-2/6` tokens for the sub-caption sizes + off-grid paddings the audit found;
  Market/feed empty state; Decorate-mode discoverability hint.

## (old) remaining backlog
- Multi-tab localStorage write guard (BroadcastChannel) — surfaces in the preview as the layout
      reverting; harmless in the shipped single-context app.
- Per-item colour/material variants (sofa fabrics, desk wood tones) for finer customization.
- Wall-mounted décor (posters, shelves, neon) with wall snapping.
- Multi-tab localStorage write guard (BroadcastChannel/storage event) — web-only race; surfaces
      in the preview as spurious bankruptcies when two contexts tick the same save.
- Floating gains on *spend* (−$ / −RP) + a celebratory particle burst on a hit launch.
- Animated on-device assembly preview during manufacturing.
- More device customization: button/port placement, two-tone backs, engraving.
- StoreKit/IAP plumbing (Sandbox unlock) — deferred until the iOS build (P9).

## Audit checkpoints
Run the AUDIT PROMPT (see plan §12) after P3 (engine+state) and after P5 (all screens).

## Backlog
_(append out-of-scope improvements here as one-liners; do not act mid-session)_
- [DONE] Early-game valuation rebalanced (cubic reputation curve + $8K base + rev×4): net worth now
  starts ~$13–36K (garage ≈ cash) and grows with real revenue instead of starting at $880K.
- [DONE — verified + pinned v15.2] Engine (PROTECTED): `makeSkills` doesn't guarantee the role's headline discipline is the *highest* — FIXED by the "role-true skills" pass (off-disciplines roll at 35–85% of the primary, strictly below it); now pinned by `engine/staff.test.ts` property tests so it can't regress.
- [DONE — resolved by design in V5/v8] Balance: first-launch flop can yield 0 units sold — the sales volume floor (`floorUnits`, now 70) guarantees any shipped product sells *some* units; flops still lose money on tooling+run (teachable, not brutal, but a real bet).
- Renderer: laptop/desktop/monitor/console/wearable currently reuse the phone "slab" silhouette via the ASPECT map — give them distinct parametric silhouettes (hinge, stand, strap) in the post-core renderer pass (plan Prompt 9).
- Design Lab: gate higher tiers visibly with a "Research in R&D" hint when a component is maxed at current research.
- Multi-tab: localStorage races across tabs (only matters on web, not the Capacitor app) — consider a single-writer guard if shipping a web build.
- Settings screen: theme toggle (data-theme), sound/haptics mute, restart-with-confirm.

## v9 — slower economy + production wizard + smart demand + fanbase (DONE)
- [x] **Much slower base pace**: secondsPerTick 4→8 (Fast button still lets you catch up).
- [x] **Multi-step build wizard** (DesignLab → "Plan production"): Step 1 choose the **production run
      size** (slider + Fans-only / Recommended / Max presets, live pre-order + demand readout);
      Step 2 pick a **marketing campaign**; Step 3 **review** (demand fit, competition, projected
      sales/profit, total upfront). You pay tooling + the WHOLE run + the campaign upfront, so
      over/under-producing is a real bet. HQ "Ready" now just Launches (campaign chosen at build).
- [x] **Fanbase** (`state.fans`): loyal customers who **pre-order** in proportion to how well the
      product fits current demand (`fans × conversion × demandFit`). Hits grow fans (more for big
      sellers + sellouts), flops lose them, gentle weekly decay.
- [x] **Smart demand model** (`planProduction`, pure + 6 tests): total demand = fan pre-orders +
      organic market demand, where organic is cut by a **competition factor** based on how many
      rivals currently ship a product that MATCHES (±12 of your overall) or BEATS you. Sales are
      **capped to the production run** → sellouts (grow fans) vs unsold overstock (write-off).
- [x] Per-unit production cost now paid at build, so launched sales bring full price into cash.
- [x] Tightened competition penalties in balance (match 0.18 / beat 0.42). Vitest single-fork
      config to kill parallel-worker flakiness. **73 tests pass** (incl. new production.test.ts: fans→pre-orders, demand-fit, rival match/beat, run-capping, upfront cost). Fixed a missing balance.competition.matchPenalty/beatPenalty that NaN-cascaded the demand calc. Typecheck clean, build green.

## v10 — premium polish pass (DONE)
- [x] Removed the hard colored `border-left` on HQ upgrade cards (it clipped the rounded corner —
      the reported artifact). Accent now reads via a whisper-thin tinted top border + the glyph +
      level chip + buy button; cards `overflow: hidden` for clean radii.
- [x] Removed cheap neon glows (`box-shadow: 0 0 …`) from upgrade pips + the company-power bar.
- [x] Dropped the coach's clipping `border-left` (accent already carried by its colored glyph + CTA).
- [x] Market feed accent rail → soft rounded `::before` bar (rounded ends, never clips).
- [x] Verified via computed styles: borderLeft 0, soft top accent, no neon. Build + 67 tests green.

## v12 — WASD camera control (DONE)
- [x] The 3D office camera is now drivable: **A/D orbit** around the room, **W/S zoom** in/out,
      **Q/E (or R/F) raise/lower** the eye height — all eased smoothly on top of the existing
      pointer parallax. Keys are ignored while typing in any input, and cleared on window blur.
      A subtle "WASD to look around" hint sits in the scene corner. Typecheck + build green.

## v13 — Kenney CC0 furniture models + catalog expansion (DONE)
- [x] Parametric catalog +10 premium items (executive desk, lounge chair, sectional sofa,
      bar table, wardrobe, monstera, bonsai, floor vase, cube lamp, coffee bar).
- [x] glTF drop-in seam: `src/garage3d/furnitureModels.ts` (registry) + `gltfFurniture.tsx`
      (lazy, BASE_URL-aware). Per-item ErrorBoundary + Suspense fall back to the parametric
      piece if a model is missing/broken — never a blank tile.
- [x] `npm run furniture:fetch` (scripts/fetch-furniture.mjs): self-discovers the current
      Kenney Furniture Kit (CC0) download, extracts, copies 23 matched models to
      public/furniture/<id>.glb. Re-runnable. Synty/paid packs intentionally excluded (license).
- [x] Kenney models are real-world metres → scale:1 correct. 14 load in the default room.
- [x] Fixed corrupted furniture3d import (lazy/Component/Suspense/ReactNode) + dup RoomPalette.
- [x] Fixed vite.config defineConfig import (vite → vitest/config) so `tsc -b` accepts `test`.
- Build green (tsc -b && vite build, 22.1s), scene renders, no console errors.
- TODO (visual tuning, needs eyes-on): per-item yaw/offset for a few Kenney pieces if any face
  the wrong way or sit off-centre — adjust in furnitureModels.ts (scale/yaw/offset fields).

## Backlog — PRE-EXISTING strict-build breakage **[RESOLVED — verified in v14]**
`npm run build` / `npm run typecheck` (= `tsc -b`) was already red before this session — the old
check only ran a no-op stub. `npx vite build` (esbuild) is GREEN, so the shipped bundle is fine;
only the strict TS gate fails. Fixes are additive + mechanical but touch PROTECTED engine/ types,
so they need an explicit go-ahead. Exact errors:
- engine/types.ts `CompetitorState` missing: `sharePrice: number`, `priceHistory: number[]`, `blurb: string`
  → fixes competitors.ts, stocks.ts, Market.tsx, gameState.ts (buy/sellShares), persistence.ts (~16 errs)
- engine/types.ts `Product` missing `plannedUnits?: number`, `channelId?: ChannelId|string`
  `LaunchedProduct` + `BuildJob` missing `plannedUnits?: number`
  → fixes gameState.ts(657,690,692,705), HQ.tsx(148), production.test.ts(67)
- Unused imports to remove: DesignLab `Rocket`; HQ `Sheet`, the all-unused import on line 15,
  `Product`, dead `CHANNEL_ICONS`
- furniture3d.tsx unused `p` param in 3 pre-existing components (lines ~286/509/614) — prefix `_p` or drop
- vite.config.ts `test` key — FIXED this session (defineConfig now imported from "vitest/config")

## v13.1 — Strict-build repair progress **[the "remaining 10" below are RESOLVED — verified in v14]**
Fixed the real PRE-EXISTING engine type bugs that broke `tsc -b` (was ~40 errors → now 10):
- [x] engine/types.ts: `CompetitorState` += `blurb`, `sharePrice`, `priceHistory`;
      `Product`/`BuildJob` += `plannedUnits?`, `channelId?`; `LaunchedProduct` += `plannedUnits?`
- [x] furniture3d.tsx: 3 unused `p` params (WaterCooler/ArtStand/PoolTable) → `_`
Remaining 10 (pre-existing, screen-level — left for a focused, low-risk pass with eyes-on):
- Market.tsx ×4: `format(c.sharePrice)` — sharePrice is cents-as-number, format() wants branded
  Money. Fix: wrap with `cents(...)` (import from engine/money) or type sharePrice as Money.
- HQ.tsx ×4: unused imports — `Sheet`, the line-15 `UPGRADE_LINES` import, `Product`,
  dead `CHANNEL_ICONS` (removing CHANNEL_ICONS may orphan Ban/Share2/Search/Megaphone/Users —
  needs an iterative tsc pass to converge, hence deferred).
- DesignLab.tsx ×1: unused `Rocket` import (one-line removal).
- vite.config.ts ×1: `defineConfig` from "vitest/config" trips a duplicate-vite Plugin type
  clash; needs `dedupe`/cast or moving test cfg to vitest.config.ts.
NOTE: `npx vite build` (the shipped esbuild bundle) is GREEN — these only block the strict
`tsc -b` gate, which was already red before this session (old check ran a no-op stub).

## v14 — reality sync: TASK.md reconciled with the shipped repo (DONE 2026-06-09)
TASK.md had gone stale: ~45 commits landed after v13.1 (merged via PR #1) without doc updates,
including the fixes for everything v13.1 listed as "remaining". Reconciled against the actual
repo state, with every claim below re-verified in a fresh container (`npm ci`):
- [x] **All gates GREEN (verified)**: `tsc -b --noEmit --force` 0 errors (clean, no stale
      tsbuildinfo); vitest **177/177** (14 files); `npm run build` green incl. PWA (sw.js +
      28-entry precache); static smoke of `dist/` via `vite preview` — shell HTML, entry JS/CSS,
      sw.js, manifest all 200. NOT verified here: an in-browser runtime smoke (container has no
      chromium and the playwright CDN is blocked by the network policy) — last recorded live
      smoke is in AUDIT.md Sweep 3/4; unit tests + module-graph-resolving build mitigate.
- **What the undocumented commits delivered** (see `git log` between v13.1 and the PR #1
      merge `c38e327`, plus AUDIT.md):
      audit Sweeps 1–4 (~43 fixes: data-loss/persistence, hype caps, a11y AA, PWA/SW, safe-areas);
      ~30 premium-depth batches (insights, forecasts, lifecycle, achievements, stats, product
      detail w/ "why it won/flopped"); balance passes (Garage-era protection, sharper rivals,
      punishing flops); the late-game arc (Industry Leaderboard #7→#1, era-scaled hit bar,
      escalating prestige/win); Design Lab 4-tab nav; ecosystem revenue + staff churn/raises +
      choice events + rival specialization/price cuts; **IAP plumbing** (`state/iap.ts`,
      simulated on web, 3 marked StoreKit stubs); the full **App Store package** (icon,
      6.7" screenshots, STORE_LISTING.md, BUILD_IOS.md, WHAT_YOU_NEED_TO_DO.md); spend FX.
- **Previously-open items verified as shipped**: v13.1's 10 strict-TS errors; B3 era gating
      (era 2+ now needs rep AND revenue — `eras.ts`); demand-variance forecast **range** in the
      build wizard (no longer a point estimate); spend −$/−RP FX (old backlog line).
- **Still open (verified against source, carried forward)**:
      B5 one-button Suggest price → show a range (deferred design change);
      B6 stock baseline drift still +EV — **FIXED in v15 below**;
      F13 furniture not instanced (only BrickWall is — draw calls scale with decoration);
      AUDIT 0.5 bundle audit (main chunk 541KB / 163KB gzip; three.js correctly split + lazy).

## v15 — B6: mean-reverting stock market (DONE 2026-06-09)
The stock market was a passive income printer: baseline drift (+0.16%/wk) + a CONSTANT
reputation momentum (rival rep never changes after init → pure compounding, up to +0.16%/wk)
+ always-positive launch pops (~+6% every ~7-10wk) + dividends ≈ 40-70%/yr EV for buy-and-hold.
- [x] `competitors.ts`: new exported `fairSharePrice(c)` — the rival's calibrated starting price
      shifted by current-vs-calibrated reputation (`repFairWeight`). Quality is priced into the
      LEVEL (Pomelo $188 vs Quantyx $11), never into a weekly return.
- [x] `evolveShare`: weekly change = `log(fair/price) × meanReversion (0.06)` + launch pop +
      noise. Drift + momentum terms REMOVED. Pops/dips decay (half-life ≈ 12wk) → the Market tab
      becomes a timing game (buy dips / sell pops); buy-and-hold EV ≈ dividends (~5.9%/yr) − fees.
      Corrupt persisted price heals to fair (v7 hardening pattern). −0.95 clamp + 50¢ floor kept.
- [x] `rivalMarketCap` [0.4×, 2.5×] clamp kept as a safety band (comment updated — prices can no
      longer compound out of reach, leaderboard #1 stays seizable).
- [x] 5 new tests (`competitors.test.ts`): fair-value anchoring; 3-seed 400-week zero-EV bound
      (|mean weekly log-return| < 0.002 ≈ ±11%/yr, old printer ≥ +40%/yr); deflation from 3×fair;
      recovery from ⅓×fair; NaN/negative price healing. **182 tests green**, tsc 0, build + PWA ok.
- NOT verified: live-play feel of the Market tab (sparklines now oscillate around fair instead of
      grinding up — flag if it reads "dead"; `meanReversion`/`volatility` are the tuning knobs).

## v15.1 — B5 price band + multi-tab single-writer guard (DONE 2026-06-09)
- [x] **B5 — pricing is a decision again**: new engine `priceGuidance(stats, category)` returns the
      band where priceFit ≥ `guidanceFitFloor` (0.9); the Design Lab shows "Buyers expect $lo–$hi"
      and the one-click **Suggest setter is removed** (the exact peak is never spoiled). The band is
      asymmetric via `overpriceHarshness` (1.45, hoisted from a priceFit literal) so the UI itself
      teaches that overpricing hurts more. Old suggest's hardcoded $9/pt deleted; draft auto-price
      now sources the same helper. Zone pills/slider accent unchanged (relative feedback). 1 test.
- [x] **Multi-tab save guard** (v9 audit "only real save-loss path on web"): `state/tabGuard.ts` —
      every context broadcasts a claim on `silicon.tab.v1` (BroadcastChannel); any OTHER context
      hearing a claim freezes: tick stops AND all 3 save paths (4s autosave, visibility, pagehide)
      check `tabBlockedRef`. Takeover semantics (newest tab plays); frozen tab shows a premium
      `.tabswap` overlay (dialog semantics + focus trap, safe-area, tokens) with "Play here
      instead" → reload → boots from freshest save + claims back. Handoff is near-lossless (the
      old tab saved on visibilitychange). Per-CONTEXT id so StrictMode can't self-freeze; no
      BroadcastChannel → exact pre-guard behaviour (no regression); native single-webview → idle.
      5 tests (Node BC, in-process two-tab sim). **188 tests green**, tsc 0, build + PWA ok.

## v15.2 — engine hardening: determinism pinned + role-true skills pinned (DONE 2026-06-09)
- [x] **AUDIT 1.10 determinism test**: a 160-week cash-boosted run (events, rival launches, trend
      retargets, share prices all exercised) is **bit-for-bit reproducible** from a cloned start —
      full-state deep equality, with only feed ids normalized (they embed the module feedSeq
      counter across in-process runs by design; their per-run uniqueness is asserted instead).
      Guards the whole sim against future Math.random/Date.now leaks. Verified the only wall-clock
      uses in sim paths are intentional (newGame default seed, offline catch-up elapsed time).
- [x] **`engine/staff.test.ts`**: property tests pinning the role-true skills guarantee (40 seeds ×
      3 roles × 10 levels: off-disciplines ≤ primary, strictly below it beyond the tiny-level
      rounding zone; `levelFromSkills` round-trips within ±1). Closes the old PROTECTED-engine
      backlog item as verified-fixed. **191 tests green**, tsc 0, build + PWA ok.
- **Ship status**: repo-side work is DONE per WHAT_YOU_NEED_TO_DO.md — remaining steps are
      owner-side (Apple Developer account, Mac/Xcode build, optional StoreKit wiring at the 3
      `NATIVE INTEGRATION POINT` stubs in `src/state/iap.ts`).
      *(Superseded by the v16 audit below — "repo-side done" was false in several ways.)*

## v16 — ship-readiness audit + fix pass (DONE 2026-06-10)
39-agent verified audit (8 domains, every blocker/major adversarially re-checked against source)
+ a live play-through. 7 commits on `claude/ship-readiness-fixes`:
- [x] **IAP safety (was a guaranteed 2.1 rejection)**: `iapAvailable()`/`NATIVE_IAP_WIRED` seam —
      unwired native builds HIDE the Creative Mode purchase UI, so v1 can submit with or without
      the IAP. Docs fixed: `@capacitor-community/in-app-purchases` does NOT exist on npm (404,
      verified) → cordova-plugin-purchase v13 instructions; "(Optional)" removed from the
      checklist; native-gate regression tests added.
- [x] **Sim no longer ticks during onboarding** (burned ~$390/wk on the name screen; ~13 idle
      min = bankruptcy before founding). Tick + offline catch-up gated on `onboarded`.
- [x] **First-session readability**: coach launch step described a removed flow (campaign moved
      to the wizard); era goal card said "Either threshold" at every era (era 2+ is AND) and
      vanished when ONE bar filled; flop verdict now carries its cause and a flop+sellout launch
      no longer celebrates + punishes in adjacent feed lines.
- [x] **Balance (engine, tested, 197 green incl. determinism pin)**: supply-crunch events capped
      at 35% of cash (RNG can't bankrupt); ecosystem rate 0.0008→0.05 (dead mechanic → real
      annuity); self-cannibalization (`selfPenalty` 0.22 + wizard "Cannibalization" line) kills
      the relaunch-spam dominant strategy; rival entries now dent active products' remaining
      sales curve 10% (`rivalEntrySalesHaircut`) so the threat feed line is mechanically true.
      Knob-tuning (0.22/0.10) needs a playtest; the mechanisms are pinned by tests.
- [x] **Native durability**: save + paid entitlement + prestige mirrored to
      @capacitor/preferences with boot-time restore (WKWebView eviction = the review-bomb risk);
      status bar follows the resolved theme; SW registration actually skips the native shell;
      splash masters generated (resources/splash[-dark].png); v1.0.0.
- [x] **A11y/polish**: `--warning-text` token (closed ~12 hardcoded ambers + AA failures);
      Sparkline per-instance gradient id (red stocks rendered green fills) + chart aria-labels;
      Settings switch names; 40px small-button/coach-skip targets; field user-select + 16px
      import textarea (iOS zoom); crash-screen Reset now confirms; STORE_LISTING no longer
      claims "3D" device renders; Xcode docs REQUIRE portrait-only + iPhone-only.
- [x] **Perf (narrow)**: `React.memo(Garage3D)` + memoized HQ builder + narrowed staff snapshot
      (per-tick R3F re-reconcile gone when nothing visible changed); ContactShadows re-bake key
      includes positions/rotations/desks (moved furniture kept stale shadows); WebGL2 probe
      (three r163+ dropped WebGL1 — old check crashed into the ErrorBoundary); AudioContext
      pointerdown warm-up + resumes from iOS "interrupted".

### v16 — deferred (logged, not done)
- Full state/actions context split (the complete F36) — the memo pass above captures most of the
  win; the split is still right long-term.
- Furniture instancing (F13), GPU-tier quality scaling, keep-HQ-mounted canvas reuse.
- rem-based type / iOS Dynamic Type; iPad layout (v1 ships iPhone-only, documented).
- More choice events (only 4, one-shot, replay verbatim in NG+) + era-4-only decisions; NG+
  variety beyond bigger numbers; component sidegrades (always-top-tier is still dominant);
  Creative Mode content beyond the cash floor (thin for $2.99).
- Owner-side (Mac): `npx cap add ios`, Xcode portrait/iPhone-only settings, StoreKit wiring if
  the IAP ships in v1, on-device smoke (Preferences mirror, status bar, haptics).

## v17 — full audit + iOS/CI pipeline made shippable (DONE 2026-06-10)
4 parallel domain agents + a CI/native deep-dive on a green tree (tsc 0, vitest 199→**201**, build+PWA ok).
- [x] **iOS TestFlight workflow rewritten to actually work.** It was archive-only (never uploaded) and its
      `DEVELOPMENT_TEAM` injection was a no-op (the `grep -q` guard matched the team already in the *Debug*
      config, so the `sed` was skipped and *Release* — what `archive` uses — had no team → signing failed).
      Now: build → cap sync → archive (ASC API-key cloud signing) → export `app-store-connect` IPA → upload
      via altool, team/signing passed as `xcodebuild` args, secret preflight, run-number build number.
- [x] **Removed the corrupt `ios-testflight.yml`** (invalid YAML — no indentation + literal markdown fences).
- [x] **Added the missing shared `App.xcscheme`** (Windows-generated project never had one;
      `xcodebuild -scheme App` would have failed) + `ios/ExportOptions.plist`.
- [x] **Capacitor stack aligned** `@capacitor/cli` 8.4.0→6.2.1 (was a major skew vs core/ios/plugins 6.2.1).
- [x] **`Package.swift` fixed**: Windows `\` paths → POSIX, and the **missing `CapacitorPreferences`** plugin
      (used by `nativeStore.ts`) added. (`cap sync` self-heals it on the runner; the committed file is now
      correct for a manual Xcode open too.)
- [x] **`Info.plist`/pbxproj match the locked ship target**: `armv7`→`arm64`; portrait-only; iPad orientation
      block dropped; `TARGETED_DEVICE_FAMILY` `"1,2"`→`"1"`; Release `DEVELOPMENT_TEAM` set;
      `CODE_SIGN_IDENTITY` "iPhone Developer"→"Apple Development".
- [x] **Engine**: offline catch-up was **silently skipping ~half of every selling product's revenue** (the
      one untested code path) — fixed to half-speed time; `startBuild` maxRun clamp; `migrate` launched-field
      guards; `deviceStyle` blank-render fallback. +2 tests.
- [x] **UI**: defined the missing `--sp-5/10/14` spacing tokens (app-wide spacing was silently collapsing —
      RULE #1); replaced glyphs `◎ ★ › → ✓` with Lucide.
- **Owner action for the workflow:** add three repo secrets — `APP_STORE_CONNECT_KEY_ID`,
  `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_BASE64` (base64 of the `.p8`). The team ID is
  already wired (S3U8B8HH96). Without them the run fails fast with a clear message.

### v17.1 — offline & import correctness (DONE 2026-06-10)
- [x] **Sandbox entitlement re-validated on load** (`entitlements.withValidatedSandbox`, wired into
      useGame boot + import): an imported/older save with `sandboxUnlocked:true` no longer unlocks the
      unlimited-cash floor on a device that doesn't own the IAP. +1 test.
- [x] **Staff no longer quit during offline catch-up** (gated the churn roll on `!offline`, `!offline`
      first so the active-path RNG stream is unchanged) — an irreversible loss you couldn't react to;
      at-risk staff can still quit on the next online tick. +1 multi-seed test (offline never drops an
      at-risk member; online does — proving the contrast).
- [x] **Stale event reschedule**: catch-up pushes `nextEventWeek` forward if it slipped into the past,
      so an event no longer fires the instant you return. +1 test. (204 tests; tsc 0; build+PWA ok.)

## v17.2 — cosmetic polish sweep (DONE 2026-06-10)
Verified each flagged site against source first (several audit findings were stale/wrong — see below).
- [x] **Rank-1 leaderboard medal dark-mode contrast**: was a translucent amber tint + `#b8860b` text →
      dark-on-dark in dark theme. Now a solid `--mat-gold` chip + new `--gold-ink` token (opaque, reads
      in both themes), mirroring the `--me` rank chip's solid treatment.
- [x] **Removed dead `.lab__price-btn`** (the old +/- price stepper; price is a Slider now).
- [x] **`.co__proj-wk` 8px → `--fs-nano` (10px)** — was below the legible floor on-device.
- [x] **HQ insights keyed by `ins.text`, not array index** — the set is recomputed/sliced per tick, so
      index keys caused stale DOM/animation. (Fixed-position pip + forecast-bar lists keep index keys.)
- [x] **Tokenized coach.css exact-match literals** (`13px`→`--fs-caption`, `8px 12px`→`--sp-8/--sp-12`,
      `2px`→`--sp-2`) — appearance-preserving RULE-#1 cleanup.
- Stale findings (already correct — left untouched): the "WASD" hint is **already** gated off touch
  (`hq.css`: `display:none` + `@media (hover:hover) and (pointer:fine)`); `.lab__price-display` is **in
  use** (the live price readout), not dead; EmptyState passes only Lucide glyphs so `.ds-empty__glyph`
  `font-size` is inert (harmless, left).
- Deliberately NOT changed (reflow/appearance risk without on-device eyes): 9px micro-badges
  (`lab__chip-gen`, market) — acceptable micro-type; `coach__title` 14px / `gainfx__tok` 15px (no
  matching token); the soft `→` arrows in `App.tsx`/`HQ.tsx` labels (typographic, low value).

## v17.3 — backlog cleared: state robustness + 3D correctness + engine nits (DONE 2026-06-11)
Worked the remaining v17 audit backlog. 206 tests (+2), tsc 0, build+PWA green.
- [x] **Tick announcements fire once per simulated week** (`announcedWeekRef` gate): toasts +
      achievement announces ran inside the `setState` updater, which React invokes twice under
      StrictMode → double toasts in dev. Unlocks still fold into state on every invocation; only the
      announce is gated. `withLiveAchievements` (launch path) documented as value-call-only.
- [x] **Frozen tabs can recover** (`tabGuard` release protocol): the PLAYING context broadcasts
      `release` on pagehide (frozen tabs never do — closing a stale tab can't steal play); a frozen
      tab that's currently visible reloads into the freshest save, a hidden one keeps the overlay
      CTA. `releaseNow()` test seam (+2 node BC tests incl. the 3-tab no-steal case).
- [x] **One `persistNow()`** replaces the three drifting copies of the save call (interval /
      visibility / pagehide).
- [x] **Engine:** `nextWeekRevenue` now sums full price (production prepaid at build — runway/forecast
      read low while selling); ecosystem revenue reads the freshly-updated `launched` (was 1-wk lag);
      `newGame`/`migrate` seeds unsigned (`>>>0`; migrate's Date-based fallback collapsed toward few
      values from float overflow).
- [x] **3D:** robot model seam made truthful + the dead `tint` path is now LIVE — `robot_shared.glb`
      (rename the committed inactive sample) is tinted per ROBOT_COLORS slot, per-colour files keep
      native colours; parametric robot stays the shipped default (zero visual change today).
      ROBOT_COLORS single-sourced in robotModels.ts. Roamer #5+ fan out on a golden-angle spiral
      around the 4 homes (no more stacked/jittering pairs). Context loss now toasts + exits Decorate
      cleanly (was a silent swap that stranded editor state). `prefers-reduced-motion` is live —
      flipping it mid-session downgrades 3D→IsoScene without a reload (was mount-time only).
- [x] **Micro-type on-scale:** 9px badges → `--fs-nano` (designLab chip-gen, market stage badges);
      `coach__title` → `--fs-caption`; `gainfx__tok` → new `--fs-fx` token (15px, deliberate).
- **Stale audit findings verified NOT bugs** (documented, untouched): competitors decay/presence
  thresholds agree in practice (entries ≤1 are deleted the tick they decay — sub-1 strength never
  persists); staff #17+ "invisible" — the render cap (16) equals the Campus staffCapacity cap (16);
  CameraRig's settle comment claims only what it does (skips camera writes, not whole-scene battery).

## v17.4 — first REAL on-device pass (TestFlight screenshots) (DONE 2026-06-11)
The TestFlight pipeline went live this session (Admin ASC key + tolerant .p8 decode + app record);
build 11 reached a real iPhone. Four on-device screenshots drove this pass — all four findings were
invisible in the container and real on the phone. 206 tests, tsc 0, build+PWA green.
- [x] **Branded icon + splash shipped** (was the stock Capacitor logo on device): gen-icons.mjs now
      writes the native AppIcon (opaque) + Splash imageset directly — no forgettable second step.
- [x] **Splash can't strand the app**: launchAutoHide:true (2s cap) as the OS-level net + boot's
      native-restore raced against 1.2s so a stalled bridge can't block first paint.
- [x] **Onboarding keyboard**: own scroll layer + top safe-area fade (content jammed into the
      Dynamic Island when the keyboard opened); brand-name field drops autocorrect/QuickType,
      Enter founds.
- [x] **HUD**: chips/buttons wrap as groups (was an arbitrary mid-group split on iPhone width);
      cash + label turn negative with "Nwk left" under 4 weeks of runway (the below-fold pills
      were the only warning — a player at $1.2K/8 staff saw a calm HUD).
- [x] **3D office**: Kanban label re-anchored over its board (collided with the Whiteboard pill);
      OfficeLabel type onto --fs-micro/--fs-nano, scene-constant colours lifted to named consts.
- [x] **Research**: "Battery · +16 Battery" → "Battery · +16" (single-stat dedupe).
- Flagged, not changed (design call): the 4 always-on fixture labels (Whiteboard/Kanban/Vault/
  Gate) label static objects forever — restraint says fade them after first view or show on tap;
  staff labels carry live data and should stay. Needs the owner's eyes on-device.

## v18 — upgrades feel like SOMETHING + lens counts are earned (DONE 2026-06-11)
Direct user ask: "upgrades should be exciting / feel like you're actually doing something; device
features like lens count should be RP unlocks." 210 tests (+4), tsc 0, build+PWA green.
- [x] **Upgrade celebration**: new `upgrade` sfx (mechanical thunk → rising sparkle → chord);
      bought card blooms (accent ring + radial wash), the new tier pip ignites (overshoot pop),
      the effect line rises out of the card; facility moves celebrate too. Research component/
      project buys (previously DEAD silent) share the cue + success haptic. Reduced-motion safe.
- [x] **The feed says what appeared in the 3D room** per tier (coffee station, wall screen,
      easel, test chamber, second monitors) — purchases visibly change the world they own.
- [x] **RP-gated lens counts** (`state.lensLimit`, `unlockLens`, `lensUnlockCosts {3:14, 4:30}`):
      stepper caps at the unlocked count; an inline "Unlock triple-lens module · 14 RP" buy in the
      Camera tab steps straight onto the new lens (live render payoff). Old saves backfilled to the
      highest count they actually used. Counts 1–2 free; grandfathered drafts never downgraded.
- NOT verified on-device: sound character + animation timing need ears/eyes (tuning knobs:
  sound.ts upgrade case, hq.css keyframes). Knob costs (14/30 RP) need a playtest.
- Backlog seed: the unlock seam generalizes — notch styles / module shapes / finishes as
  research unlocks if the lens gate lands well.

## v19 — garage declutter, Bank popup, gated upgrades, Rest (DONE 2026-06-11)
User ask: bare-garage start, whiteboard/TV as upgrades, tap-employee menu, research-masked
upgrades, vault→bank money popup, "extremely easy to understand." Decisions locked via
AskUserQuestion: **foundation first** (3D taps deferred to an on-device follow-up), tap **opens
the roster card**, **Rest is a real mechanic**. 214 tests (+8), tsc 0, build+PWA green.
- [x] **Bare-garage start**: removed Kanban wall + security gate (starter clutter) + labels;
      **Whiteboard now appears only with Workstations (computers ≥ 1)** — earned, not pre-placed.
      TV was already Marketing-gated (confirmed). Down to Bank + (earned) Whiteboard + live staff labels.
- [x] **Bank popup** (`components/Bank.tsx`): tap the HUD cash → a clean, bold finances screen —
      hero cash + weekly in/out + runway, Net Worth broken into cash + your-company stake + rival
      shares, Research points as the 2nd currency, lifetime earned. The vault is relabelled "Bank";
      the 3D vault-tap entry point is the deferred follow-up (HUD entry ships + is testable now).
- [x] **Research-gated masked upgrades**: Marketing (Brand Agency+) and Assembly (Robotic Line+)
      top tiers LOCK behind Brand Studio / Vertical Integration research — rendered masked-grey with
      a lock + "Research X to unlock Y". Engine enforces the gate too. `UpgradeLine.requires` +
      `upgradeLockedBy` — extensible to more lines.
- [x] **Rest mechanic**: paid time off (one week's salary) → +30 mood + clears the burnout counter;
      distinct from Raise (permanent). In the roster only when useful (mood<50 / danger), urgent red
      when about to quit. Free for the unpaid founder.
- **Deferred (on-device follow-up — chosen "foundation first"):** the 3D taps — tap employee →
      open their roster card (Train/Assign/Raise/Rest live there now); tap the office Vault → open
      the Bank. Both reuse the proven furniture tap-select raycast; unverifiable in CI.
- NOT verified on-device: Bank layout polish, masked-card contrast, Rest button thresholds —
      flag anything off. Gate mapping (which tiers/projects) + Rest cost/boost (1wk / +30) need a playtest.

### v17 Backlog — still open (need on-device eyes / a design call)
**3D/perf:** `frameloop="demand"` + `invalidate()` retrofit (battery; a wrong conversion silently
  freezes the scene — do with eyes on the office); furniture instancing (F13, draw calls scale with
  decoration); route the deliberate "intrinsic object colours" in `furniture3d.tsx`/`Garage3D.tsx`
  through `RoomPalette` for light-theme harmony (visual tuning); context-loss auto-RESTORE (current:
  clean fallback + toast; no path back to 3D without remount).
**Screens (cosmetic, low value):** inert icon-container `font-size`s on now-SVG glyphs; broader
  hardcoded-px tokenization across screen CSS; soft `→` arrows in `App.tsx`/`HQ.tsx` labels
  (typographic — debatable vs the Lucide rule).
**Larger projects (logged earlier, unchanged):** full state/actions context split (F36); rem-based
  type / Dynamic Type; iPad layout; more choice events / NG+ variety / component sidegrades.
