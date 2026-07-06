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
- **TASK.md is stale again**: last dated entry is v56 (2026-06-28), but 52 commits since then shipped
  all of DEPTH_PLAN.md Tracks A–D (v57–v69: narrative/voice, cascading events, rival story arcs,
  mentorship/poaching/morale/loans, synergy archetypes/buyer mixes/research forks/subsystems) plus
  several polish waves — none logged here. 1.0.2's App Store "What's New" was written straight from
  `git log` + `DEPTH_PLAN.md` instead. Needs a v14-style reconciliation pass to bring TASK.md current.
- **CSS bug — `src/screens/designLab.css`:** `.lab__hero-grid` is declared twice — as the Design Lab's two-column layout (~L121) AND as the dot-texture backdrop with `position:absolute;inset:0` (~L138). The absolute leaks onto the layout grid, pulling it out of flow, so at the app's 540px max width the Design Lab hero overlaps the Category selector (invisible on ≤430px phones). Fix: rename the backdrop-texture class (e.g. `.lab__hero-dots`) in the CSS + `DesignLab.tsx`. Worked around at capture-time in `shots-store.mjs`/`shots-ipad.mjs`; the real fix belongs in source.
- **[PLAN READY] Supply chain — Suppliers & Factories.** Full design + phased build plan in
  `SUPPLY_CHAIN_PLAN.md`. Turns the opaque manufacturing step into real choices (where parts come
  from / where you build), and gives the existing random `supplyCrunch` events a player-controlled
  cause. Pure-engine (`engine/suppliers.ts` + `engine/factories.ts`), optional save fields, phased
  P1→P4. Recommend building **P1 (suppliers only)** first and validating fun before P2.
- [DONE] Early-game valuation rebalanced (cubic reputation curve + $8K base + rev×4): net worth now
  starts ~$13–36K (garage ≈ cash) and grows with real revenue instead of starting at $880K.
- [DONE — verified + pinned v15.2] Engine (PROTECTED): `makeSkills` doesn't guarantee the role's headline discipline is the *highest* — FIXED by the "role-true skills" pass (off-disciplines roll at 35–85% of the primary, strictly below it); now pinned by `engine/staff.test.ts` property tests so it can't regress.
- [DONE — resolved by design in V5/v8] Balance: first-launch flop can yield 0 units sold — the sales volume floor (`floorUnits`, now 70) guarantees any shipped product sells *some* units; flops still lose money on tooling+run (teachable, not brutal, but a real bet).
- Renderer: laptop/desktop/monitor/console/wearable currently reuse the phone "slab" silhouette via the ASPECT map — give them distinct parametric silhouettes (hinge, stand, strap) in the post-core renderer pass (plan Prompt 9).
- Design Lab: gate higher tiers visibly with a "Research in R&D" hint when a component is maxed at current research.
- Multi-tab: localStorage races across tabs (only matters on web, not the Capacitor app) — consider a single-writer guard if shipping a web build.
- Settings screen: theme toggle (data-theme), sound/haptics mute, restart-with-confirm.
- Website (docs/) duplicates the legal/support copy in public/privacy.html + public/support.html; when the policy text changes, update both (or make the in-app copies redirect to the Pages site once it's live).
- [DONE] Vitest 4 `test.poolOptions` deprecation — migrated vitest.config.ts to the top-level
  `fileParallelism: false` (same sequential, flake-free behaviour as the old `singleFork`);
  warning gone, 251 tests pass.
- **POST-LAUNCH DLC candidate #1 — first-class "OS / Platform" division.** The OS economy ALREADY exists in the engine: the `software` component line (BasicOS → Unified OS, catalogs.ts), the `ecosystem` stat, and recurring ecosystem-service revenue (balance.ts `ecosystem.weeklyServiceRate` = unitsSold × ecosystemStat/wk). Today the OS is an invisible *ingredient* inside hardware. The DLC = surface it as a visible feature: a Platform screen showing your released OS, its install base across all your shipped devices, and the licensing $/wk it already earns; plus new levers (license your OS to rivals for a revenue line; OS version releases that lift the whole installed base). This is a framing/UX layer over existing mechanics, NOT a new economy — lower risk than it sounds, but still out of v1 scope (ship first).

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

## v19.1 — roster polish + 3D taps wired (DONE 2026-06-11)
- [x] **Roster-card premium pass** (user-requested audit): verdict = already premium (token-driven,
      soft surface-2 + hairline, smooth mood/skill/xp bars, 12px rhythm). Fixed the two real flaws —
      the Rest button crammed a sub-label inside the pill (wrapped/broke the pill on narrow phones →
      now clean "Rest · $X", explanation in a title) and a pre-existing DUPLICATE `.co__member-contrib`
      rule (consolidated to one).
- [x] **3D taps wired** (the deferred follow-up): tap a seated employee → Company roster (invisible
      transparent hitbox over desk+robot); tap the Vault → Bank popup. `onTapStaff`/`onTapBank` through
      Garage3D→Scene, `onNavigate`/`onOpenBank` through HQ→OfficeScene. Gated to non-Decorate mode.
      **NOT CI-verifiable — 3D tap hit-testing needs an on-device check** (does the tap register over
      the parallax camera? does the vault wrap-group catch child-mesh taps?). Reuses the BuildLayer
      raycast pattern, so the approach is proven; the wiring is new.
- Still nice-to-have: tapping an employee navigates to Company but doesn't yet scroll/highlight THAT
  person's card (just opens the roster). Add a focus-id hand-off if the tap lands well on-device.

## v19.2 — premium finishes are earned (RP-unlocked + meaningful) (DONE 2026-06-11)
Continues the user's "device upgrades with research points" vision (lenses → finishes). 216 tests
(+2), tsc 0, build+PWA green.
- [x] **titanium / gold finishes RP-unlocked** (12 / 26 RP); plastic + aluminium stay free. Design
      Lab Style tab masks locked finishes (lock + dim) with an inline "Unlock {Finish} · N RP" buy
      that unlocks + selects + plays the upgrade fanfare. `finishLimit` + `unlockFinish` /
      `finishUnlockCost` mirror the lens seam; `FINISH_ORDER` is the canonical ladder.
- [x] **They DO something** (not just cosmetic): premium finishes add a small Design-appeal bonus
      (titanium +2, gold +4) in the STATE layer (`productStats`), NOT the protected engine
      computeStats — so launched products keep their snapshot stats; zero retroactive balance ripple.
- [x] Old saves backfill `finishLimit` to the highest finish their products already use.
- NOT verified on-device: the locked-chip look + unlock-button placement. Bonus magnitudes
  (+2/+4) and costs (12/26) need a playtest.
- Backlog seed (unchanged): notch styles / camera module shapes could follow the same seam, but
  they're purely cosmetic — only worth gating if the finish gate feels good first.

## v19.3 — one R&D hub: device unlocks surfaced on Research (DONE 2026-06-11)
The progression spine (lenses / finishes / projects / component tiers) had drifted across 3 screens.
- [x] **Research leads with a "Design unlocks" card** showing both device tracks (camera lenses +
      premium finishes): what each does + a buy button (or Maxed ✓), reusing unlockLens/unlockFinish
      + the upgrade fanfare. Hides once both maxed. Design Lab keeps its point-of-use inline buys.
      Now RP reads as ONE economy (assign R&D → earn RP → unlock device tech / component tiers /
      projects, all in one place). UI-only; engine actions already tested. 216 tests, tsc 0, build ok.
- NOT verified on-device: the card's look + placement among the other Research cards.

## v19.4 — Marketing Push: a 2nd mid-life lever (cash vs margin) (DONE 2026-06-11)
Found the price-cut/refresh mechanic already existed (well-built, one cut per product, caps at the
production run). Added its missing sibling so the post-launch decision has a real trade-off.
- [x] **Marketing Push** (`marketingPush` + pure `marketingPushQuote`): spend cash to lift a live
      product's remaining weekly demand (capped at plannedUnits → clears genuine surplus only),
      KEEPING price. Cost = 35% of the extra revenue unlocked; +30% demand boost. One per product.
      Price cut (no cash, lower margin) vs Push (full price, cash now) = a real cash-vs-margin call.
- [x] Surfaced in the product detail sheet beside the price cut (reuses the `.pd__pricecut` visual
      language, Megaphone icon). Only shown when surplus exists. Cash-spend FX wired. +3 tests (218).
- NOT verified on-device: the two intervention blocks stacked in the sheet — check they read
  clearly as distinct options. Boost/costPct (30% / 35%) need a playtest.

## v19.5 — on-device fixes from the first TestFlight playthrough (DONE 2026-06-11)
Four issues reported live from PR #6's build; all fixed, 218 tests, tsc 0, build+PWA green.
- [x] **Sheets wouldn't close (IMG_0140)**: the grab handle was decorative; only the thin scrim
      strip closed a sheet → felt trapped. Handle is now a real control — **tap or drag-down to
      dismiss** (snaps back under threshold). In the shared `Sheet` primitive → every popup gets it.
- [x] **Locked components showed "T2" (IMG_0139)**: the Components picker now names the **next
      tier** you'd unlock + its stat gain ("🔒 TurboCore A2 · +24 Perf · research in R&D"), accent
      name — aspiration, not a dry number.
- [x] **Design flow unclear (IMG_0142)**: added a **sticky Back / Next step bar** above the tab nav
      (gray Back left, green "Next: <step>" right); click-through except the buttons; Next hides on
      Launch (its own Build CTA). Fixed-position offset clears the tab bar — **needs an on-device px tune**.
- [x] **3D fell back to 2D permanently (IMG_0138)**: `webglcontextlost` → sticky `glLost` stranded
      the player in 2D until app relaunch. Added a **"Try 3D again"** pill on the fallback that
      remounts the Canvas. Likely a device GPU context-loss (recent work *reduces* 3D load, so
      unlikely my regression) — this makes it recoverable in-session rather than fixing a root cause
      I can't repro. **Open question for the user: is it every launch or intermittent? did relaunch fix it?**

## v19.6 — exploit/bug audit + smoothness (DONE 2026-06-11)
"Make it clean & smooth; look for exploits and bugs." Audited the money/economy surfaces.
- [x] **Exploit fixed — free Rest**: founder (s0) has $0 salary, so Rest cost $0 → unlimited free
      morale (≈ permanent free output). `restCost = max(salary, BALANCE.churn.restMinCost=$1000)`.
      Rest is now always a real spend. +1 test.
- [x] **Bug fixed — Coach/step-nav overlap**: the new Design step nav (fixed, z29/bottom60) sat in
      the same band as the first-build Coach card (z28/bottom72), buttons rendering over it. Nav now
      gated on `state.tutorialDone` (they never coexist; Coach guides during the tutorial).
- [x] **Audited clean (no action needed):** offline catch-up (week-capped, clock-backward = no-op);
      stock trades (two-sided fee → no same-week round-trip; oversell/insufficient-cash clamped);
      builds (cash-guarded, no cancel/refund path); giveRaise (founder-excluded + no-op at market →
      no mood farm); prestige (gated behind IPO win, full reset → legacy can't be farmed); bankruptcy
      (post-mortem + restart, no soft-lock). 219 tests, tsc 0, build+PWA green.

## v19.7 — money-flicker fix + UI polish (DONE 2026-06-12)
On-device screenshots: cash flickered negative↔positive every tick; floating gains sat on the
speed controls; finishing a design had no closure; the boosts list scrolled forever.
- [x] **Bug fixed — headline cash flickering negative**: `AnimatedMoney` tweened with a bitwise
      `| 0`, which coerces to a signed 32-bit int. Cash is integer **cents**, so any balance above
      ~$21.47M (cents > 2^31) overflowed mid-count-up and wrapped negative — the headline visibly
      flipped −/+ on every weekly tick. Switched to `Math.trunc`; interrupted tweens now resume from
      the on-screen value (no backward jump). The ONLY money-bitwise in the app (grep-verified).
- [x] **Floating gain tokens off the controls**: `+$ / +RP` tokens were pinned top-right over the
      pause/fast-forward/settings buttons. Anchored under the cash headline on the left.
- [x] **Design-complete sheet**: finishing a build only flashed a toast + silently reset the draft.
      Now a celebratory sheet shows the finished device + forecast, a "manufacturing → launch from
      HQ" next-steps panel, and a "Track in HQ" CTA that navigates there.
- [x] **Active boosts compacted**: ~19 completed projects rendered as two-line rows = endless
      scroll. Now a wrapped chip cloud (effect on `title`) with a "Details" expander.
- [x] tsc 0, 219 tests green, build + PWA green.

## v20 — Scenario mode (retention Wave 1a) (DONE 2026-06-19)
The retention backbone from RETENTION_ROADMAP.md (competitor research: RollerCoaster Tycoon +
Two Point Hospital — scenarios with tiered 1–3★ win conditions are what carry tycoon replayability,
and they're fully offline/server-free). Built engine-first across 3 commits; 291 tests, tsc 0, build+PWA green.
- [x] **Engine** (`engine/scenarios.ts`, PURE + 13 tests): `Scenario` = authored start overrides
      (era/cash/reputation/fans) + `[1★,2★,3★]` tiers, each an AND of `Objective`s that read ONLY
      data the engine already tracks (cumulativeRevenue/netWorth/reputation/fans/productsShipped/
      hits/era). Pure evaluators + a `deriveScenarioFacts(state)` adapter (mirrors achievements.ts).
      6-scenario catalog spanning the curve (First Light → Bootstrapped → Head Start → Underdog →
      The Long Game → Empire). A tier-monotonicity property test pins that a higher star can never
      be easier than a lower one.
- [x] **State** (`state/gameState.ts` + `scenarioProgress.ts`, +9 tests): `activeScenario` per-run
      tag (+persistence backfill → null for old saves); `newScenarioGame(id)` applies the setup over
      `newGame` and skips onboarding/coach; `scenarioResultFor(state)` selector. Best-stars-per-
      scenario live in a PROFILE store (separate localStorage key, mirrored to native Preferences +
      added to MIRROR_KEYS for durability) so mastery survives restarts/NG+. The tick records a new
      best + one celebratory toast in the same once-per-week gate as achievements (idempotent write).
- [x] **UI**: `ScenariosSheet` (premium card list — difficulty chip, the three tiers, earned stars,
      confirm-before-overwrite Play) reached from a Scenarios row in Company (mirrors Achievements);
      `ScenarioTracker` on HQ shows the next unmet tier's objectives with live progress bars + a
      closure banner on 3★ mastery / failed deadline. `useGame.startScenario(id)` (does NOT inherit
      prestige legacy — scenarios are a level playing field). Tokens + 8pt grid (RULE #1).
- **NOT verified on-device**: card/tracker layout + the confirm overlay; scenario target balance
      (the objective thresholds + Underdog's wk-78 deadline) needs a playtest — flag anything off.
- [x] **Onboarding entry** (follow-up done): "Or take on a scenario" link on the first-run screen.
- **Deferred (follow-up, logged)**: scenario setup overrides for rivals/trends/forced-category
      (would touch protected competitor/trend init — a separate pass).

## v20.1 — Wave 1b: shareable result cards (DONE 2026-06-19)
The only "community surface" available without a backend (per RETENTION_ROADMAP §6/Wave 1b);
also delivers the deferred celebratory win moment. tsc 0, 291 tests, build+PWA green.
- [x] `components/ResultCard.tsx` — a premium, screenshot-worthy SVG/token card (zero image assets:
      parametric CircuitBoard brand glyph): company name, scenario name + stars (or "{Era} empire"),
      4 headline stats (lifetime revenue / net worth / products / fans), wordmark + week. Offers a
      `navigator.share` TEXT summary where supported (progressive enhancement — deliberately NOT a
      canvas→PNG rasterizer, which would be fragile + need on-device verification; the universal
      share is the OS screenshot, and a "Screenshot this card" hint says so).
- [x] Surfaced from the HQ `ScenarioTracker`: a "View result card" button appears once the player
      has earned any star; mastery (3★) and failed-deadline closure banners cleaned up alongside.
- NOT verified on-device: card layout as an actual screenshot; navigator.share behaviour on iOS.

## v20.2 — Wave 1c (partial): choice-event variety (DONE 2026-06-19)
- [x] `engine/events.ts` CHOICE_EVENTS 13 → 22 (purely additive content; no logic change). 3 era-1
      (public beta / founder burnout / viral meme), 3 era-2 (green pledge / retailer ultimatum /
      counterfeit surge), 3 era-3 (privacy reckoning / moonshot lab / talent raid). Reuses existing
      EventEffect kinds + era-consistent magnitudes → resolveChoice + balance untouched; the picker
      already avoids repeats within a run, so more events = more run-to-run variety (attacks the
      GDT "solved/verbatim replay" failure mode). events pool-drain test now covers all 22.
- **Wave 1c remaining — NEEDS A GO-AHEAD**: component sidegrades (cheaper-but-lower / battery-vs-
      perf tiers so the optimal recipe isn't a fixed ladder) touch PROTECTED engine (product.ts /
      catalogs.ts / balance) + need a balance pass — not done without explicit instruction.
## v22 — Wave 3: Platform / OS division DLC (Phase A+B) (DONE 2026-06-19)
DLC #1 per DLC_OS_PLATFORM.md — surfaces the OS economy that already runs invisibly (software line
+ ecosystem stat + recurring ecosystem-service revenue) as a first-class, gated division. Engine→
state→UI; 325 tests, tsc 0, build+PWA green.
- [x] **Engine** (`engine/platform.ts`, PURE + 6 tests): `installedBase`, `osTier` (software level →
      tier name), `canReleaseVersion`, `osReleaseReward` (bounded, hard-capped fan bonus — the
      "no free faucet" guard from spec §5). `BALANCE.platform` constants.
- [x] **State** (+5 tests): `platformUnlocked` (DLC gate), `osName`, `osVersion` (+persistence
      backfill + newGame defaults). Selectors `platformInstalledBase` / `osTierInfo` / `osDisplayName`
      / `canReleaseOsVersion`; actions `unlockPlatform` / `setOsName` / `releaseOsVersion`. Licensing
      revenue is the EXISTING `weeklyEcosystemRevenue`, reframed (no formula duplication → no drift).
- [x] **UI**: `PlatformSheet` (name your OS, tier, installed base, licensing $/wk, version + a
      release-version "launch day" button) — gated, reached from a Platform row in Company (shown
      only when unlocked). Settings → Expansions → a "Platform Division" unlock switch (entitlement
      gate; real IAP purchase wiring deferred like the existing sandbox stub).
- **Phase B** (version release) is a one-time, BOUNDED rep/fan moment tied to advancing the Software
      research tier — deliberately NOT a recurring rate change, so the tuned economy is undisturbed.
- **NOT verified on-device**: Platform sheet layout; release reward magnitudes (4 rep / 2k+capped
      fans) need a playtest.

## v22.1 — Wave 3 Phase C: license your OS to rivals (DONE 2026-06-19)
The platform trade-off — reach & revenue vs. a sharper competitor. 329 tests, tsc 0, build+PWA green.
- [x] **Engine** (+2 tests): `rivalLicenseFee(rivalRep, osTier)` — bounded, hard-capped weekly fee;
      `licenseeStrengthUplift()`. `rivalStrengthsFor` gains an optional `{licenseeIds, uplift}` so a
      licensee competes harder in shared categories (backward-compatible — plain reads unchanged).
- [x] **State** (+2 tests): `osLicensees` field (+backfill); `weeklyLicenseFees` selector;
      `licenseOsToRival` / `revokeOsLicense` actions (gated on unlock + a real rival, idempotent).
      Fees collected weekly in the tick (rate-scaled, next to ecosystem revenue); the licensee uplift
      is applied in `planProduction` (the single competition point) — so the fee genuinely makes
      that rival tougher on your launches. Balance: fee `$1.5k + rep×tier×$40`, capped `$250k/wk`;
      uplift +8 strength. **Magnitudes need a playtest** (flagged).
- [x] **UI**: PlatformSheet "License your OS" section — every rival with its weekly fee + a
      License/Revoke button + the explicit reach-vs-rivalry warning.

## v21 — Wave 2: daily/weekly challenges (DONE 2026-06-19)
The offline Mini Motorways model (date-seeded, no backend/leaderboard). Built engine→state→UI; 310 tests, tsc 0, build+PWA green.
- [x] **Engine** (`engine/challenges.ts`, PURE + 13 tests): a challenge = freeform start + date-seeded
      MUTATORS + a scored "best <metric> by week N" goal. MUTATORS catalog (start-condition twists
      expressible via the existing newGame path — cash mult / reputation / fans); UTC date helpers
      (dateKeyOf, mondayOf), FNV-1a hashSeed, dailyChallenge / weeklyChallenge (Monday-anchored,
      2–3 distinct mutators, longer run); formatScore / scoreMetricLabel. Same date → identical
      challenge for every offline player.
- [x] **State** (+8 tests): `activeChallenge` + `challengeScore` (+persistence backfill); `newChallengeGame`
      applies mutators as start overrides; `withChallengeScore` locks the score snapshot at scoreWeek
      (pure, idempotent; folded into the tick + boot/offline like evaluateAndUnlock); `challengeViewFor`
      selector; per-date personal-best store (`challengeProgress.ts`, native-mirrored) — the offline
      "beat your own history" substitute for the server leaderboard. `useGame.startChallenge(kind)`;
      tick records best + one toast on the score-lock transition.
- [x] **UI**: `ChallengesSheet` (today's daily + this week's weekly, mutators, personal best,
      confirm-before-overwrite) from a Challenges row in Company; `ChallengeTracker` on HQ (goal,
      live score, weeks left, locked final + best banner). Reuses the scenarios card language.
- **NOT verified on-device**: card/tracker layout; mutator balance + the 52/104-week score windows
      need a playtest. **Deferred**: deeper sim-level mutators (no-marketing / fixed-price / recession)
      need BALANCE-override plumbing (a larger change); a one-attempt-per-day LOCK (today you can
      replay a date's challenge — single-player, no leaderboard to protect, so low priority).
- **Next**: Wave 3 OS/Platform DLC (DLC_OS_PLATFORM.md); Wave 1c component sidegrades (PROTECTED
      engine — needs a go-ahead); the NG+/mastery + content-cadence items in RETENTION_ROADMAP Wave 4.

## v23.2 — Wave 4: Founder Perks + AI-Era content (DONE 2026-06-19)
- [x] **Founder Perks** (`engine/perks.ts`, PURE +tests): NG+ "beyond bigger numbers" — a 6-perk
      ladder unlocked one-per-prestige, derived purely from the persisted `legacy` level (no new
      store). Bounded effects (design ceiling / launch hype / weekly RP) applied via the existing
      STATE-layer selectors (designTierCeiling / hypeBonus / weeklyRpGen) — protected engine
      untouched. NG+ win overlay previews the next perk.
- [x] **AI-Era (era 4) content**: 7 era-4 market events + 3 era-4 choice dilemmas (AI ethics, the
      moonshot race, training-data consent) — the endgame had NO era-specific events/decisions before
      (it reused the era-1–3 pool). Additive content, era-appropriate magnitudes.
- **Era-distinct *mechanics* (different RULES per era) remains a deliberately-deferred large item**:
      it would reshape the tuned per-era economy and needs a playtest. The event/choice flavour above
      is the safe slice; true mechanic divergence is flagged, not built.
- **Wave 4 remaining (open, low priority)**: run-history "this week in tech" recap (the live feed
      already serves this — likely redundant); deeper era mechanics (above).

## v23 — Wave 4: Device Museum (cross-run collection meta-progression) (DONE 2026-06-19)
The "new thinking" headline from RETENTION_ROADMAP §3 — leans into the pillars (devices are
parametric SVG, "the product is the toy"): every device you ship is enshrined in a permanent,
browsable museum that PERSISTS across New Game+ and restarts. Retention via collection, not
engagement-farming. 333 tests, tsc 0, build+PWA green.
- [x] **Profile store** (`state/museum.ts`, +1 test file): newest-first, capped at 60, de-duped by
      key, corruption-tolerant, native-mirrored (added to MIRROR_KEYS). Stores the renderable
      Product + name/category/era/company/week/verdict.
- [x] **Recorded on launch** (useGame.launchReadyCb) — each shipped device is enshrined the moment
      it launches (keyed by seed+productId+week, so re-runs don't collide).
- [x] **UI** (`screens/Museum.tsx`): a 2-col gallery re-rendering each device via DeviceRenderer
      (zero assets) with name/category/era/company/verdict; premium empty state. Reached from a
      Device Museum row in Company (always available).
- **NOT verified on-device**: gallery layout + DeviceRenderer at 120px thumb size.
- **Wave 4 remaining (open)**: NG+/mastery depth beyond bigger numbers; era-distinct mechanics;
      run-history "this week in tech" headlines; bankruptcy post-mortem share card. RETENTION_ROADMAP
      Wave 4 + the "new thinking" list track these.

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

## v24 — post-launch depth: market segments + living rivals (Epic A + B1) (DONE 2026-06-22)
The first post-launch feature chapter (v1.0 is live). Built from `EXPANSION_ROADMAP.md` (a fresh
2024–2026 competitor research pass). Owner authorized Epics A + B. Engine-first, backward-compatible,
405 tests green, tsc 0, build+PWA ok.

### Epic A — Market Segments (the demand-model second axis) — COMPLETE end-to-end
The market is split into five buyer segments, each weighting the five stats AND price differently;
a launch wins a SHARE OF EACH segment, summed — so "who is this for?" is a real positioning decision
(the strike at the genre's solved-recipe failure: GDT/Mad Games Tycoon).
- [x] **Engine** (`engine/segments.ts`, PURE +9 tests): `SEGMENTS` (Budget/Mainstream/Pro/Style/
      Enterprise); `segmentEffectiveWeights` (segment taste × category emphasis × global-trend tilt —
      trend-drift still matters); `segmentFit`; `segmentPriceFit` (per-segment elasticity); `segmentDemand`
      → per-segment breakdown + `demandIndex` + `effectivePriceFit` (drop-in analogs) + dominant/weakest.
      `balance.ts` gains an additive `market.segments` block (trendInfluence, minPriceTolerance).
- [x] **Integration** (`market.ts` PROTECTED, additive: optional `demandOverride`/`priceFitOverride` on
      scoreLaunch — omitted = identical pre-segments behaviour; `gameState.planProduction` feeds the two
      aggregates; `ProductionPlan.segments`; `launchReady` records dominant/weakest/per-segment in the
      launch insight). Balance preserved: a balanced product's demandIndex averages back to the old
      single-trend demand, so era thresholds / verdict bands / maiden-launch fairness are unchanged
      (full suite green). Lopsided products diverge — that IS the new depth. `types.ts` SegmentId +
      LaunchInsight optional fields. +3 production integration tests.
- [x] **UI**: DesignLab wizard "Who it's for" bars (which segment each design wins, best-fit accented);
      Market post-launch "Audience" driver ("strongest with Pro; weakest with Budget — priced out").
- NOT verified on-device: segment-bar layout; live economic FEEL of lopsided builds needs a playtest
      (mechanism pinned by tests; segment weights/sizes in segments.ts are the tuning knobs).

### Epic B — Living Rivals (phase B1: rivals ship real products) — visibility layer COMPLETE
Rivals were invisible "strength" emitters; now each launch is a real, renderable device you can see
and learn from (fix for Computer Tycoon's "rivals are just a color on the map").
- [x] **Engine** (`engine/rivalAI.ts`, PURE +7 tests): `generateRivalProduct` builds a full Product
      (era-gated tiers, finish, camera, price, original name) whose quality tracks launch strength and
      whose style/margin follow the rival's tone (premium/value/balanced from competitors.ts identity).
- [x] **State** (`gameState.rivalReleases`, capped 24, newest-first; persistence backfill): the tick
      converts each rival launch into a RivalRelease via a DERIVED rng (seeded from save+week+index) so
      the MAIN sim rng stream stays byte-identical — determinism pin + all seed tests unchanged. Feed
      lines name the device. +2 integration tests.
- [x] **UI**: Market "Rival releases" card — each rival device via DeviceRenderer (zero assets) with
      name/category/price/tone tag.
- NOT verified on-device: Rival releases card layout.
### Epic B — Living Rivals (phases B2 + B3) — COMPLETE (v25, 2026-06-23)
- [x] **B2 — reactive doctrines** (`competitors.ts`): RivalDef.isLead → `doctrine`
      (defender/trendChaser/undercutter/generalist) + `rivalDoctrine()`. A trend-chaser piles
      category-selection weight onto the player's hot cats; a defender adds strength + cadence (the old
      lead numbers, unchanged); an undercutter ships an aggressively cheap product (`contested` flag on
      CompetitorLaunch + a visible price slash via rivalAI) and presses cadence — never raw strength,
      so the contested ceiling + winnability are preserved (300-week cap guard test). Feed reads
      "Pandacore X undercuts your Phone"; Market shows an "undercut" badge. +6 tests.
- [x] **B3 — M&A + new entrants** (`competitors.ts` CHALLENGER_POOL + spawnChallenger; `gameState`
      acquireRival/canAcquire/acquisitionCost; `state.acquiredRivals`). Buy out a rival (cost = market
      cap × premium − your existing stake), removing it + absorbing its brand (+rep) and customers
      (+fans, capped); gated on established + a field floor. The tick refills a thinned field with a
      fresh challenger — rng drawn ONLY on that branch, so a normal game's determinism is byte-identical.
      UI: Market TradeSheet "Acquire" action (two-tap confirm, self-explaining gate). +5 tests.
- NOT verified on-device: Acquire control + undercut badge layout.
- **Epic B fully shipped** (B1 visible products → B2 doctrines → B3 M&A). 416 tests, tsc 0, build+PWA.

### Epics A + B — next possible chapters (open)
- Segment playtest-tuning pass (weights/sizes/trendInfluence) once felt on device.
- Per-segment SIZES could drift over time / by era (a Pro-heavy AI era), making positioning dynamic.
- Rival mortality (organic exits via a rival-fortune signal) — deferred; B3's player-driven removal +
      entrants already keeps the field churning.
- Acquired-rival synergies (inherit their preferred categories as a launch bonus); M&A achievements.

## v26 — Epic C: the Verdict Layer (readability moat) (DONE 2026-06-23)
The H1 "make it legible" bet from EXPANSION_ROADMAP §4 — cheapest, lowest-risk, most review-quotable,
and it amplifies the Epic A segments. Engine-first, additive. 428 tests, tsc 0, build+PWA.
- [x] **C2 — converging pre-launch forecast** (`engine/forecast.ts`, pure +6 tests): forecastConfidence
      (marketer skill + Demand Sensing, capped) → forecastBand (base→floor, monotone, never above the
      no-knowledge band). The wizard band uses it AND the realized launch variance is remapped into the
      same band (gameState.launchReady), so a tighter forecast is HONEST. Wizard shows a
      "Forecast confidence: Low/Med/High" row. baseBand mirrors demandVariance (no-knowledge = old ±12%).
- [x] **C1 — first-class ranked post-mortem** (`engine/postmortem.ts`, pure +6 tests): scores how
      decisive each factor was (demand/price/competition/hype/audience), ranks them, writes a synthesized
      headline (segment-aware via Epic A's perSegment). Market ProductDetailSheet orders drivers by
      impact, flags the 2–3 "key factor"s, dims the rest, and leads with the headline. Falls back to the
      plain list for pre-insight saves.
- NOT verified on-device: post-mortem headline + forecast row layout.
- **Remaining:** C3 — plain-language explainers ("what it does and who wants it") for every
      stat/component/segment (Two Point "almost nothing is confusing"). Lower leverage; open.

### Roadmap status after v26
Shipped: A (segments), B (living rivals), C1+C2 (verdict layer). Open H1/H2/H3 epics:
C3 (explainers), D (era-distinct mechanics — PROTECTED, needs playtest), E (delegation/ops),
F (reactive audio + a11y), G1 (form→demand, needs A — now unblocked), G2 (surface synergy),
G3 (new categories/era DLC). Next-best by leverage: G2 (cheap, UI over existing synergy math) or
F (premium feel/a11y); G1 is now unblocked by segments.

## v27 — Epic G: deepen the design toy (G1 + G2) (DONE 2026-06-23)
- [x] **G2 — surface component synergy** (DesignLab, pure UI over existing componentSynergy): the live
      view now shows a two-sided "Build" readout — "Flagship +6%" / "Balanced" / "Weak: Battery" — with
      a one-line explanation that names the bottleneck OR celebrates the coherent-build bonus (the
      Kairosoft combo "aha", pillar #5). No engine change.
- [x] **G1 — form affects demand** (`engine/aesthetics.ts`, pure +5 tests): styleAppeal(product) turns
      the previously-inert render choices (notch, camera module/layout coherence, flash) into a bounded
      0..8 bonus that lifts the Style segment's fit ONLY (segmentDemand optional param, default 0 →
      backward compatible; +2 segment tests). finish/designTier/refresh are NOT re-counted (already in
      the design stat). planProduction passes it; the DesignLab live breakdown now runs through the SAME
      segment model as the wizard/launch (fixes a post-Epic-A inconsistency where live "Fit" was the old
      single-trend score) and shows a "Design language: Striking/Clean/Plain/Dated" readout.
- NOT verified on-device: design-language readout + the live feel of the style weighting (playtest).
- **Remaining:** G3 — new categories / a new era past AI as content drops (renderer already supports
      the silhouettes; gameplay-gated). Data in catalogs.ts; S each.

### Roadmap status after v27
Shipped: A (segments), B (living rivals), C1+C2 (verdict layer), G1+G2 (design toy). Open:
C3 (plain-language explainers), D (era-distinct mechanics — PROTECTED, playtest-heavy),
E (delegation/ops), F (reactive audio + a11y), G3 (new categories/era DLC).
Next-best by leverage: F (premium feel/a11y — earns the price, dodges "rip-off" reviews) or
E (delegation — touch-critical for late-game scale). D is highest playtest cost; G3 is content cadence.

## v28 — Epic F: premium feel — accessibility slice (DONE 2026-06-23)
- [x] **High-contrast mode** (`state/settings.ts` highContrast pref + applyContrast; `design/tokens.css`
      [data-contrast="high"] overrides for light AND dark — near-ink muted text, visible hairlines/strokes,
      --focus-width 2→3px; `index.css` focus ring reads the token; Settings "High contrast" toggle).
      Purely additive — off by default, scoped to the root attribute, default experience byte-identical.
      Base theme already clears WCAG AA (text variants, reduced-motion, focus rings); this serves
      low-vision users beyond AA. 435 tests, tsc 0, build+PWA.
- **DEFERRED (need on-device/audio session):** F reactive-audio palette + per-action microinteractions
      (can't be heard/felt headless; RULE #1 = don't ship polish rough). Colorblind-safe palette swap
      also deferred (the app already pairs tone with icons/labels; a full red/green remap risks the
      function-colour identity — do it with eyes on device).

### Roadmap status after v28
Shipped: A (segments), B (living rivals), C1+C2 (verdict layer), G1+G2 (design toy), F-a11y (high contrast).
Open: C3 (explainers), D (era-distinct mechanics — PROTECTED, playtest-heavy), E (delegation/ops),
F-audio + F-microinteractions (on-device), G3 (new categories/era DLC).
STRONG RECOMMENDATION: an on-device playtest of the A→B→C→G stack before more balance-sensitive work —
a lot has landed engine-side (segments reshape demand, rivals, forecast, style→demand) without on-device
validation of FEEL. Next buildable-blind epic: E (delegation, low-risk, touch-critical) or C3 (explainers).

## v29 — Epic E: delegation & ops (DONE 2026-06-23)
- [x] **Delegation** (`gameState.ts` pure policies +7 tests `state/ops.test.ts`): canAutoAssign /
      canAutoResearch (gated on a senior staffer / senior engineer, BALANCE.ops.leadSkill=5);
      autoAssignIdle (idle → role discipline via ROLE_ASSIGNMENT); autoClaimResearch (cheapest
      affordable in-era project via buyProject — can't exceed player capability); applyWeeklyAutomation
      runs the enabled+capable ones at the top of advanceOneWeek. setAutomation action; state.automation
      persisted + backfilled. OFF by default → determinism byte-identical (all prior tests unaffected).
      Company "Delegation" card: two gated toggles with self-explaining lock states. useGame wired.
- NOT verified on-device: delegation card layout.
- **Future (bigger, deferred):** auto-reorder production runs + a design-lead spec drafter — both touch
      cash/launch decisions, so they need their own balance pass + on-device validation.

### Roadmap status after v29
Shipped: A, B, C1+C2, G1+G2, F-a11y, E (delegation). Open: C3 (explainers), D (era-distinct mechanics —
PROTECTED, playtest-heavy), F-audio + F-microinteractions (on-device), G3 (new categories/era DLC),
E-future (auto-reorder / design lead). Next blind-buildable: C3 (explainers, low-risk UI) or G3 (content).
STILL STRONGLY RECOMMEND an on-device playtest of the A→B→C→G→E stack before the balance-heavy D.

## v30 — Epic C3: plain-language explainers → Epic C complete (DONE 2026-06-23)
- [x] **Glossary** (`engine/glossary.ts`, pure +4 tests): STAT_INFO (plain-language for all 5 stats);
      segmentTopStats / segmentPriceLabel / segmentWants(ById) — DERIVED from live SEGMENTS weights, so
      copy can't drift from the sim. "Who it's for" rows now show a "what this buyer wants" line
      ("Performance + Quality · price-insensitive"). 446 tests, tsc 0, build+PWA.
- **Epic C COMPLETE**: C1 (ranked post-mortem) + C2 (converging forecast) + C3 (explainers).

### Roadmap status after v30
Shipped: A, B, C (full), E, G1+G2, F-a11y. Open: D (era-distinct mechanics — PROTECTED, playtest-heavy),
F-audio + F-microinteractions (on-device), G3 (new categories/era DLC), E-future (auto-reorder/design lead).
Most remaining work either needs on-device validation (D feel, F audio/feel) or is content cadence (G3).

## v31 — Epic D: era-distinct mechanics (first slice) (DONE 2026-06-23)
- [x] **eraModifiers** (`balance.ts` table + `engine/eras.ts` eraModifier/eraRuleSummary, +4 tests):
      marketingHype / ecosystemRate / demandVariance per era, routed through EXISTING selectors (no new
      system). Eras 1-2 = 1.0 baseline → early game byte-identical (all prior tests pass). Era 3 Platform
      = ecosystem lock-in (services + marketing up); Era 4 AI = hype-driven + volatile (variance up).
      Wired: weeklyEcosystemRevenue (both sites), planProduction marketing hype, launchReady variance
      band; DesignLab live + wizard previews scale identically (honest forecast per era). advanceEra
      announces the shift in the feed. +2 production tests (Platform eco rev > Garage; late-era hype up).
- ⚠️ **WIRING tested + safe; late-era MAGNITUDES need a playtest** (isolated in balance.eraModifiers).
- **Future D:** a genuinely new axis/mechanic per era (a new stat in the AI era; retail/supply in Growth)
      rather than multipliers — bigger, needs design + playtest.

### Roadmap status after v31
Shipped: A, B, C (full), D (first slice), E, G1+G2, F-a11y. Open: F-audio + F-microinteractions
(on-device only), G3 (new categories/era content), E-future, D-future. The blind-buildable roadmap is
essentially DONE — what remains needs on-device validation (audio/feel, balance magnitudes) or is content.
STRONGLY RECOMMEND a playtest now: the late-era D magnitudes + the whole A→B→C→G→E→D stack want real eyes.

## v32 — OS legibility tweak + Franchises (bigger feature) (DONE 2026-06-23)
- [x] **OS income total** (Platform.tsx): the headline stat now sums BOTH recurring streams (ecosystem
      services + rival licensing) instead of showing services alone — with a breakdown hint. Fixes the
      under-read of the division's worth + the "Licensing income"/"License your OS" word overlap.
- [x] **Product Franchises / Brand Equity** (NEW bigger feature — `engine/franchise.ts` pure +7 tests):
      a product LINE (sequels sharing a name, built on naming.ts) accrues brand equity from its track
      record (verdict-weighted, recency-decayed, capped). A proven line launches with loyal pre-orders
      (×up to +40%) + anticipation hype (≤+0.15); a flop tarnishes it. First-in-line → equity 0 → zero
      bonus (additive; all prior tests pass). planProduction.brand exposed; DesignLab wizard shows a
      brand-equity readout ("Aurora line · Established"); live preview adds the same hype for consistency.
      +2 production tests (a hit line beats a fresh name; a different name doesn't inherit equity).
      ⚠️ preorder/hype caps are a launch-economy lever — flagged for playtest.
- Emoji audit: confirmed the app is emoji-free (Lucide icons throughout); only typographic ★/→ in
  star-ratings + comments. The preview HTML now uses inline SVG icons (no emoji).
- 463 tests green, typecheck 0, build+PWA.

### Backlog (logged, not acted — outside task scope)
- OS feature: a per-licensee fee tooltip; an installed-base trend sparkline. Minor legibility.
- Franchises: an explicit "name this line" affordance + a Franchises overview (lines + their equity)
  in Market/Company; brand-equity decay on a long lapse (currently only recency-weighted by entry).

## v33 — Franchises overview + rival company profiles (DONE 2026-06-23)
- [x] **Rivals build real series** (`rivalAI.ts`): a stable flagship line per rival+category
      (rivalLineName, deterministic) + a series number from prior releases → "Pomelo Lumen" → "… 2" → …
      generateRivalProduct takes seriesIndex; gameState derives it. Determinism + rival stat tests hold.
- [x] **Franchise aggregation** (`franchise.ts`, +2 tests): playerFranchises (group launches into lines
      with equity, deepest first) + rivalLines (group a rival's releases + avg quality) + franchiseDisplayName.
- [x] **UI** (Market.tsx): "Your franchises" card (per line: brand-equity tag + units + latest + equity
      bar). Rival releases are now TAPPABLE → RivalProfileSheet: company card (reputation, market cap,
      share, strategy/doctrine) + their product lines + recent releases + a Trade-shares jump.
- 465 tests, tsc 0, build+PWA. preview.html updated (franchises + rival profile).
- Backlog: an explicit "name this line" affordance in DesignLab; franchise revenue totals; surface
      a rival's licensee/acquisition status in the profile.

## v34 — Continue-a-line sequels + rival-profile sparkline/acquire (DONE 2026-06-23)
- [x] **Continue a line** (DesignLab "Name & build"): one-tap chips that name the draft as the next
      entry in an existing line (suggestNextName of the latest) + inherit its brand equity; same-category
      lines first; equity tag on each chip. Surfaces the franchise loop where you name a product.
- [x] **Rival profile depth** (Market RivalProfileSheet): a share-price Sparkline + change %, and an
      Acquire action (two-tap confirm + self-explaining gate) right in the company card. Reuses
      canAcquire/acquisitionCost/acquireRival (tested).
- UI-only over tested engine fns. 465 tests, tsc 0, build+PWA. preview.html updated.

## v35 — Franchise revenue + rival relationship status (DONE 2026-06-23)
- [x] **Franchise revenue** (`franchise.ts` FranchiseSummary.revenue = sum of revenueToDate; shown in
      "Your franchises"). Test updated.
- [x] **Rival relationship status** (RivalProfileSheet): "Licenses <YourOS> · $X/wk" badge when the
      rival licenses your OS, and "You own N shares · X%" when you hold their stock (the buyout-discount
      stake). Reuses rivalLicenseFee/osTierInfo/holdings.
- 465 tests, tsc 0, build+PWA. preview.html updated. Franchise chapter complete.

## v36 — OS division deepened: feature modules + device coupling (DONE 2026-06-23)
- [x] **Sheet bug fix**: bottom sheets now portal to `<body>` (primitives.tsx) so the trailing action
      (e.g. Platform → "Done") clears the fixed tab bar instead of being trapped beneath it. Also drops
      the unintended screen card-stagger fade the scrim was inheriting.
- [x] **OS feature modules** (`engine/platform.ts` OS_FEATURES): 6 researchable capabilities (App
      Marketplace, Cloud Sync, On-Device Assistant, Privacy Suite, Health Hub, Cross-Device Continuity),
      each gated behind an OS version + an RP cost. `osEcosystemBonus` + `osServicesMultiplier` (both
      bounded; caps + per-version step in `balance.platform.features`).
- [x] **Real lever** (user's call): a built module lifts the ecosystem stat of every device you launch
      (via `productStats`, state layer — `product.ts` untouched) AND multiplies recurring services income
      (selector + tick). Exactly 1.0× / +0 when the division is off → base economy byte-identical.
- [x] **State**: `osFeatures: string[]` (+persistence backfill, resets on NG+ like research, entitlement
      carries); `installOsFeature` gated on entitlement+version+RP; `osFeatureList`/`osEcoBonus`/
      `canInstallFeature` selectors; exposed via useGame.
- [x] **UI**: Platform "OS features" card (build/locked/built/unaffordable states, effect readout);
      Design Lab review note "Runs <OS> vN · +X ecosystem from N modules".
- 477 tests, tsc 0, build+PWA green. preview-os-features.html sent.
- ⚠️ Balance magnitudes (module RP costs, ecoBonus/servicesMult, caps) NOT playtested on device — all
      isolated in `balance.platform.features` + the OS_FEATURES catalog for a one-file tuning pass.

## v37 — OS division: more modules, achievements, completion celebration (DONE 2026-06-23)
- [x] **Two more modules → 8 total**: Wallet & Pay (v2), Media Studio (v3). `ecoBonusCap` 20→26 so a
      FULL build (+25 ecosystem) pays in full — the completion reward — while still bounding the sum.
- [x] **Achievements**: "Platform Pioneer" (first module) + "Walled Garden" (every module). New pure
      facts `osFeaturesBuilt`/`osComplete` (0/false until the division is unlocked). `installOsFeature`
      routed through `withLiveAchievements` + the RP-spend FX so they fire the instant you build.
- [x] **Dopamine**: live build-progress bar on the OS features card (N/total → "Complete"); sound +
      haptic + RP-spend FX per build; and a bespoke portal "Platform complete" celebration on the final
      build — spring-in emblem, radiating ray burst, sealing check, global confetti, the platform totals.
      Pure vector; ray/spring choreography fully disabled under reduced motion.
- 481 tests, tsc 0, build+PWA green. preview sent.
- ⚠️ Still NOT playtested on device: a fully-built OS adds +25 ecosystem to every launch (intentional
      late-game power, gated behind all 8 modules + OS v4 + ~408 RP). Tunable in one file if too strong.

## v38 — Celebration system + OS depth (DONE 2026-06-23)
- [x] **Reusable `Celebration` overlay** (design/Celebration.tsx + celebration.css): generalized the
      OS-complete moment — portal, ray-burst emblem, sealing check, stat chips, confetti + sound on
      mount, accent/positive tone. Reduced-motion safe. OS-complete refactored onto it.
- [x] **(b) OS version release celebration**: launch-day beat (new version, +fans, +reputation, devices
      updated); reward captured at click so it survives the card swap.
- [x] **(a) New Game+ legacy celebration**: confirming prestige opens a positive-tone "Legacy N forged"
      moment (crown emblem, the inherited cash/rep/fans/RP + founder perk); its confirm founds the next
      run. The reset reads as a reward, not a wipe.
- [x] **OS reach sparkline**: tick samples installed base weekly while unlocked (capped 40, backfilled);
      Platform shows an "OS reach" Sparkline + "+N this period" trend.
- [x] **3 OS achievements**: Going Mainstream (100k base), Ubiquitous (1M), Kingmaker (3 licensees).
- 485 tests, tsc 0, build+PWA green. preview-os-celebrations.html sent.
- Backlog (logged from the v38 survey, not acted): franchise line-naming + gallery UI; Research RP-sink
      feedback card; Challenge weekly recap + milestones; per-licensee relationship/churn; OS module
      synergies; Market feed empty state; Museum device-story blurbs.

## v39 — Content drop: events, franchise detail, OS synergies (DONE 2026-06-23)
- Survey finding: several "backlog" items were ALREADY built — Design Lab "Continue a line" chips,
  Market "Your franchises" card (revenue/equity/entries), and the Market feed empty state all exist.
  So this drop added the genuinely-missing pieces instead of rebuilding them.
- [x] **+9 market events, +4 choice dilemmas** across all eras (engine/events.ts) — additive flavour
      using existing effect kinds, no state-layer changes; invariant tests cover them.
- [x] **Franchise detail sheet**: tapping a line in Market opens its "chapters" — every product newest
      first with a parametric device thumbnail, verdict, units + revenue, and the line's lifetime totals.
- [x] **OS module synergies**: pair complementary modules for an extra services bonus (One-Tap Commerce,
      Seamless Handoff, Proactive Wellbeing). Folds into osServicesMultiplier (still capped); surfaced as
      a "Synergies" subsection (active vs locked). 4 new engine specs.
- 489 tests, tsc 0, build+PWA green.
- ⚠️ Synergy + module + version services bonuses now reach ~2.56× at a full v5 build (cap 2.6) — close
      to the rail; if more is added later, raise servicesMultCap. NOT playtested on device.

## v40 — Research income legibility + OS customization & licensee churn (DONE 2026-06-23)
- [x] **Research income card** (lowest-risk pick): read-only breakdown of weekly RP by source (founder
      trickle + each R&D staffer) with mini bars. Pure rpSources(staff,era) engine helper (sum pinned to
      weeklyRp by test) + weeklyRpSources(s) selector (sum == weeklyRpGen). No balance/persistence change.
- [x] **OS philosophy** (customizable + unique): pick one lasting identity that tilts every launch +
      services — Curated Garden (+eco), Open Platform (+services), Performance-First (+perf), Privacy-First
      (+quality). Bounded via productStats + osServicesMult (re-capped). osPhilosophy state (backfilled
      null; resets on NG+), setOsPhilosophy (gated, tap-to-clear), 2-up picker card.
- [x] **Licensee relationships + churn**: per-licensee satisfaction (osLicenseeHealth) that decays with
      your reputation lead and can churn (they drop the license) once low. Pure updateLicenseeRelations +
      licenseeMood (balance platform.licenseeChurn). Tick advances it live-only (never offline). Platform
      shows a relationship bar + mood per licensee. Seeded on license, pruned on revoke + acquisition.
- 505 tests, tsc 0, build+PWA green.
- ⚠️ Churn magnitudes (dominanceFreeGap 12, decay 0.7/pt, threshold 28, churn 14%/wk) NOT playtested —
      all in balance.platform.licenseeChurn. Philosophy +5 stat / +20% services likewise untuned on device.
- Note: the signing server returned intermittent 503s this session; commits succeeded on retry.

## v41 — Found the OS division as an earned milestone (DONE 2026-06-23)
- [x] **Founding cost**: the Platform division is now a major in-game reinvestment you save up for
      (balance.platform.foundingCost = $250k), not a free Settings toggle. Discoverable "Found the
      Platform division — $X" card on Company with an affordability state; founding deducts cash, brings
      the division live, and fires the shared Celebration. foundPlatform reducer + canFoundPlatform /
      platformFoundingCost selectors; useGame value-call path (spend FX + achievements).
- [x] The free unlock moved to Creative-mode overrides in Settings (only shown while Sandbox is on),
      so normal play earns it; Sandbox's cash floor keeps creative experimentation free. Existing
      founded saves untouched (no retroactive charge).
- 506 tests, tsc 0, build+PWA green.
- ⚠️ $250k founding cost NOT playtested on device — tune in balance.platform.foundingCost. It's a
      base-game cash gate now (not the old DLC-toggle scaffold); flag if you'd rather keep it DLC-gated.

## v42 — progressive-disclosure gating: a day-one garage isn't buried (DONE 2026-06-24)
Kicked off by a "take it to the next level — smoothness, clarity, players understand what to do"
ask + 4 parallel research audits (3 competitor sweeps: Game Dev Tycoon / Mad Games Tycoon 2 /
Software Inc / Computer Tycoon / Startup Company / Capitalism Lab / Two Point / Kairosoft / FM
Mobile / Egg Inc; + 1 code-grounded internal clarity audit). **Unanimous finding: the game is
unusually legible PER-SCREEN; the gap is STRUCTURAL DISCLOSURE — advanced systems are present
from day one instead of introduced when relevant.** The codebase already gates well in places
(Platform $250k, IPO/mergers $750k, Delegation by lead) — this pass applies the same idea to the
three worst day-one dumps. Pure presentation gating, no engine/economy/persistence change.
- [x] **Company meta-layer gated behind first ship** (`hasShipped = launched ≥ 1 || legacy > 0`):
      Achievements, Scenarios, Challenges, Device Museum, the Near-milestones card, and the
      $250k Platform-founding GOAL no longer appear on an empty garage. An already-FOUNDED Platform
      entry still always shows; returning prestige founders (legacy > 0) keep the whole layer.
- [x] **Stock Exchange gated** (`showStocks = hasShipped || holds shares`): the Market tab no
      longer opens onto a wall of tradeable rivals + sparklines in week 1. Holdings/portfolio still
      show if somehow held; reappears the moment you ship.
- [x] **Research roadmap de-walled**: project groups render only for eras you've reached (the
      EraRoadmap above already previews what's ahead) instead of stacking every locked future-era
      project card; a single muted "More research projects unlock as you advance eras" hint
      (`.rd__roadmap-hint`, tokenised) replaces them. Component-tech lines were already era-filtered.
- 511 tests, tsc 0, build+PWA green. No new tests (presentation-only gating; behaviour covered by
      existing screen render). NOT verified on device: exact thresholds feel — first-ship may be a
      touch early/late for stocks; flag after a playtest (one-line change to the `showStocks` rule).
- Next slices from the audit (not done this pass): the persistent "Next Move" objective spine
      (Tier 0 — biggest "what do I do next" lever), pre-commit synergy/market-fit hints in Design
      Lab, glossary in the launch post-mortem + dedupe the drifting STAT_LABEL maps, build-wait
      clarity, Design-Lab Back/Next during the tutorial.

## v43 — Tier 0: the "Next Move" objective spine (DONE 2026-06-24)
The audit's #1 lever: the first-build Coach hands off at first launch (`tutorialDone`) and the
player falls off a cliff — they know the loop but not what to chase next. This adds a persistent,
ordered ladder of ONE concrete next step at a time, shown high on HQ. Mirrors the achievements
architecture exactly (pure catalog + predicates + "newly satisfied" diff the state layer announces).
- [x] **`engine/objectives.ts`** (pure, +12 tests): a 10-rung ordered ladder — launch → hire →
      second launch → first research project → first hit → reach Era 2 → buy an office upgrade →
      found the Platform division → IPO → reach the pinnacle. Each rung has an imperative label, a
      one-line "why", a deep-link `tab`, a CTA, a Lucide icon name, and a `done(state)` predicate
      that reads only already-tracked state. `currentObjective` returns the first rung that's neither
      latched-complete NOR live-satisfied (so the card advances INSTANTLY after an action, before the
      latch is even written); `satisfiedObjectiveIds` / `newlyCompletedObjectives` for the state diff.
      Engine purity kept — declares its own `ObjectiveTab` union instead of importing the UI `Tab`.
- [x] **State** (`gameState.ts`): `completedObjectives: string[]` (monotonic, resets per company so
      each run re-walks the ladder) + `evaluateObjectives(state)` mirroring `evaluateAndUnlock`.
      Persistence backfills the field AND silently seeds it from the live-satisfied set for old/mid-
      game saves (no toast burst on first load — same pattern as the achievement backfill).
- [x] **Wiring** (`useGame.tsx`): folded into the once-per-week tick announce gate (a gentle
      `confirm` cue + one collapsed "Goal complete — …" toast, deferred so the action's own toast
      lands first); folded SILENTLY into both offline-catch-up paths so a returning player isn't
      toast-spammed for goals cleared while away.
- [x] **HQ `NextMoveCard`**: a premium accent card (glyph chip + "Next move · N of M" eyebrow +
      label + why + deep-link button) shown directly under the era-goal once `tutorialDone`, so the
      first-build Coach owns the very first session and the ladder takes over after. Tokenised CSS
      (`.hq__next*`), hidden when the whole ladder is complete (the StrategicInsightsCard then carries
      ongoing guidance). No double-guidance with the Coach (gated on tutorialDone).
- 523 tests (+12), tsc 0, build+PWA green. NOT verified on device: the card's exact placement feel
      and whether the 10 rungs pace well across a full playthrough (rung set + copy live in one file).

## v44 — Tier 2: readability earlier — glossary in the post-mortem + STAT_LABEL dedupe (DONE 2026-06-24)
Audit finding #7: a player who flops opens the launch post-mortem first and hits undefined jargon;
and the "glossary never drifts" promise was already undercut by THREE copies of the stat-label map
(glossary STAT_INFO, Market.tsx, reviews.ts) that had diverged ("Quality" vs "build quality").
- [x] **Glossary owns both registers** (`engine/glossary.ts`): STAT_INFO gains a `prose` field
      (lowercase sentence form: "build quality", "battery life", …) alongside the Title-Case `label`.
      Single source of truth for stat copy in BOTH registers — they can't drift again.
- [x] **Dedupe**: `engine/reviews.ts` and `screens/Market.tsx` now derive their local STAT_LABEL maps
      from STAT_INFO (`.prose` for review sentences, `.label` for UI) instead of hand-maintained
      literals. Review output is byte-identical (prose values unchanged) — all review tests pass as-is.
- [x] **Shared `StatGlossary`** (`components/StatGlossary.tsx` + `statGlossary.css`): extracted the
      Design Lab's collapsible "what the stats mean" guide into a reusable component (neutral `sg__*`
      classes), and surfaced it in the **launch post-mortem** ("Why it performed") so the five stat
      terms are one tap from a plain-language definition exactly where the player reads why a product
      won or flopped. Design Lab now uses the shared component; its dead `lab__glossary*` CSS removed.
- **Piece B (pre-commit market-fit hint) NOT done — already shipped.** Verified in source: the Design
      Lab live hero already gives the pre-commit signal — a live `Fit /100` pill (`DesignLab.tsx:516`),
      a projected verdict that uses the real launch gate (522), synergy/weak-link notes (524–530),
      competition-drag explanation (539–545), and the wizard shows each segment's "wants" via
      `segmentWantsById` (97). Adding more would clutter the best-disclosed screen for no gain.
- 523 tests, tsc 0, build+PWA green. Pure readability/refactor — no engine/economy/balance change.
- Tier 2 remaining: none material. Tier 3 (first-session smoothness) is next — build-wait clarity +
      Design-Lab Back/Next during the tutorial.

## v45 — Tier 3: first-session smoothness (DONE 2026-06-24)
The last audit tier. Two small first-run friction points where the new player lacks a sense of
time/place during their first build.
- [x] **Build-wait clarity** (audit #5): the HQ "In production" card showed the absolute target week
      ("· wk 34") — opaque to a first-timer. Now shows "· N wk left" (`HQ.tsx`). And the Coach's
      manufacturing step, which only said "time advances automatically", now teaches the speed
      controls: "tap the Fast-forward button in the top bar to speed through the wait, or Pause to
      hold." (Named, not an emoji — LOCKED no-emoji rule.) So a player who reads "automatically"
      isn't left watching ~8s/week pass with no way to skip it.
- [x] **Coach points at the tab strip** (audit #6): the Design Lab's Back/Next pager is suppressed
      during the tutorial (the Coach owns that fixed bottom band — showing both would collide, RULE #1).
      The audit's safer alternative: the Coach now names the flow — "Work left to right through the
      tabs up top — Components, Style, Camera, then Launch" — so the first-timer knows the 4 tabs exist
      and the order to move through them. (Copy matches the static LAB_TABS strip exactly.)
- 523 tests, tsc 0, build+PWA green. Copy + one render change; no engine/balance/persistence touch.
- **All four audit tiers now shipped** (v42 gating, v43 objective spine, v44 readability, v45
      smoothness). Remaining audit-adjacent work is on-device feel only (objective-ladder pacing,
      coach copy length on a real phone) — nothing blind-buildable left from this audit.

## v46 — clarity follow-ups: tap-to-define, spine polish, Quick Start (DONE 2026-06-24)
Four follow-ups requested after the audit tiers shipped (PR on `claude/clarity-followups-tap-defs`).
- [x] **Tap-to-define economic terms** (`engine/glossary.ts` `TERM_INFO`): Cash, Runway, Burn, Net
      worth, Research points, Reputation, Fans — surfaced as a collapsible "What these terms mean"
      guide in the Bank popup. The shared `StatGlossary` was generalized into a `Glossary` component
      (any term/def list); `StatGlossary` is now a thin wrapper. Single-source copy.
- [x] **Objective spine finished**: a slim step/total progress bar on the Next Move card; each new
      rung's content animates in (reduced-motion safe); when the ladder completes the card retires to
      a quiet positive "you're running the show now" beat (only while still new — gone after >3 ships)
      instead of vanishing abruptly. +1 test (fresh company re-walks the ladder).
- [x] **Quick Start checklist**: the "Get started" card (empty garage only) is now a 3-step
      Design → Build → Launch checklist that tracks the player's position. Deliberately NOT a new
      floating overlay — the Coach gives turn-by-turn, this gives the map — to avoid three competing
      guidance systems (RULE #1).
- [x] **Empty-state sweep — verified already comprehensive, no change made.** Market has context-aware
      empty states with CTAs (launched===0 + feed), Research has first-open hints ("assign staff to
      R&D…"), Decorate has a first-run tutorial + a "How Decorate works" button. No blank screens found
      — declined to fabricate work for a solved problem.
- 524 tests (+1), tsc 0, build+PWA green. Presentation/readability only; no engine/balance change.

## v50 — "make it alive": launch reveal + milestone juice + first-launch + Research match (DONE 2026-06-27)
User: match Research to the Design Lab, and "make the game flow fun, interactive and alive" (picked all
four directions). Sequenced biggest-impact first.
- [x] **Research matched to the Design Lab language**: global HUD (v49) + component-tech de-walled into
      one card of icon-tile rows (was 6 stacked cards) + a header strip (subtitle + era badge).
- [x] **Launch reveal moment** (`design/launchReveal.ts` bus + `components/LaunchReveal.tsx`): launching
      plays a keynote — device on a verdict-tinted glow → critics' aggregate counts in → fictional outlet
      scores + pull-quote → verdict banner + projected units count-up → confetti on a hit. Reuses the
      deterministic `criticReviews` engine (scores match the detail screen); reduced-motion jumps to the
      result; timers cleaned up on unmount. Both launch handlers emit it (computed from the pre-launch
      plan + recorded verdict); the old toast/inline-confetti removed. VERIFIED via a driven
      build→launch capture (reviews + "Steady seller" verdict rendered cleanly).
- [x] **Milestone juice**: era advance (was a silent toast), go-public/IPO, and rival buyouts now fire
      confetti + sound — button-path only, no fragile tick changes.
- [x] **First launch is special**: a "Your first product is live!" banner + always-on confetti on the
      debut (reuses the reveal rather than adding a competing first-run system — Coach/Quick Start/Next-
      Move already guide).
- 535 tests, tsc 0, build+PWA green across all commits.
- [x] **Living HQ reactions** (built for on-device review, user's call): `design/hqReaction.ts` bus +
      pollable decaying intensity. On a launch result (fired as the reveal closes, so the office is
      visible) the team cheers (hit/solid/debut) or slumps (flop) — 2D IsoScene figures bounce/dip via
      CSS (reduced-motion safe, staggered), 3D Garage3D RobotCharacter overlays a decaying hop +
      arms-overhead + livelier antenna (additive offsets, zero change when no reaction). Plus the global
      confetti. **NEEDS ON-DEVICE TUNING** — cheer pose/bounce amplitudes (Garage3D / garage.css) can't
      be verified in CI; that was the agreed plan (build it, review/iterate on a real phone).
- Animation polish: the reveal now reads as a choreographed sequence (pulsing glow, score scale-in,
      staged rise-in for outlets/quote/units) — all reduced-motion safe.

## v49 — Design Lab + HUD reconstruction to the new mockup (DONE 2026-06-27)
User supplied a polished Design Lab mockup ("make all the design look like this"). Confirmed ZERO new
image assets needed — locked rule (everything is Lucide glyphs + CSS); verified every icon exists in
lucide-react 1.17.0. Green = the existing `--fn-design` function color, so no token-system violation.
- [x] **HUD restyle (global)**: deep-green brand badge (parametric CircuitBoard) over the cash readout;
      cash reads green when healthy (keeps red low-runway); RP/Rep/Week chips keep pills (week gains a
      Calendar icon); pause/fast/settings become larger circular buttons. New `--brand-deep(/shadow)`.
- [x] **Design Lab header**: subtitle + live projected-verdict badge ("Steady Seller", ShieldCheck).
- [x] **Hero → 2-column card**: parametric device on a green radial glow + Phone/Tablet quick-toggle
      (left); live read-out (right) — name + Concept tag, Fit with progress bar, Build (synergy),
      Design Language. "View back" is a divided footer button. DeviceRenderer reused untouched (protected).
- [x] **Components → icon tiles**: `ComponentIcon` map (Cpu/Monitor/BatteryCharging/Layers3/CodeXml/
      Camera); each row = dark charcoal tile + category + green tier pips + bold name + price + meta.
      New `--tile-dark` token (all 3 theme blocks).
- [x] **Build summary card**: Est. Cost / Est. Score /100 / Market Fit.
- 535 tests, tsc 0, build+PWA green. NOT verified on-device — sending a screenshot for sign-off.
- Deferred to keep scope: the component-row expand chevron (omitted — no detail view exists yet); the
  summary is a bottom card, not a sticky footer (the existing Back/Next step-nav owns the sticky band).
  Same language to roll to Research + other screens next.

## v48 — global expansion: regions (DONE 2026-06-27)
New gameplay chapter (user pick). Geography as the growth axis — "garage → global empire" was only
thematic before; now you expand into real markets. Additive + non-invasive: ONE multiplicative hook
on marketSize in planProduction; a home-only launch = ×1.0, so old saves / domestic play are
bit-for-bit unchanged and market.ts / scoreLaunch / salesCurve are untouched (protected engine safe).
- [x] **engine/regions.ts** (PURE): 5 regions (Home + North America / Europe / Asia / Emerging), each
      with a size share, distinct stat taste, and unlock cost. `regionTasteFit` (era-independent stat
      ratio, bounded [0.6,1.2], Home pinned 1.0), `shippableRegions` (chosen ∩ unlocked, Home floor),
      `regionReach` (Σ share×fit). `balance.market.regions` holds the knobs.
- [x] **State**: `Product.regions?` + `GameState.unlockedRegions`; `unlockRegion` cash reducer;
      newGame seeds ["home"]; persistence backfills old saves to home-only; useGame exposes the action.
- [x] **UI**: build-wizard **Markets step** (appears only after expanding — early game stays 3-step;
      live per-region taste-fit + demand readout, threads into the built product); **Market screen
      "Global markets" card** to unlock regions for cash. Premium tokens/patterns, no cramped states.
- [x] Tests: regions.test.ts + planProduction integration (more regions → more demand; home-only
      unchanged; can't ship to a locked region). **535 tests (+9)**, tsc 0, build+PWA green.
- NOT verified: on-device feel of the picker; knob values (shares $40–150k unlock costs, tasteSpread
      1.0, fit bounds) need a playtest. Prestige resets regions per company (expansion is per-run).

## v47 — depth + tech debt (DONE 2026-06-27)
User asked for "post-launch depth AND tech debt." First verified the backlog against source —
two of the four candidates were stale: **component sidegrades are already shipped** (`ProductTuning`
balanced/performance/efficiency/value/premium, fully wired) and the **choice-event catalog is deep**
(29 dilemmas across all four eras, incl. era-4 AI ethics/AGI/data-consent), not "only 4". So neither
"add sidegrades" nor "add events" was real work. Did the two genuinely-open things instead:
- [x] **Depth — New Game+ surfaces FRESH dilemmas** (the one real gap: choices reset on prestige and
      replayed verbatim). `GameState.seenChoices` is a lifetime set carried through prestige like the
      legacy bonus; `pickChoiceEvent(rng, era, resolvedThisRun, seenLifetime)` prefers never-seen
      dilemmas and only recycles once the eligible pool is exhausted (events never dry up on a veteran
      profile). rng advanced identically (one next + one int) → determinism pin unaffected. +3 new
      dilemmas (repairability / direct-to-consumer / on-device-vs-cloud AI) to deepen the NG+ pool.
      Old saves seed `seenChoices` from this run's resolved set. +2 events.test.ts cases.
- [x] **Tech debt — stable actions object + fixed drifted memo deps** (NOT the F36 perf split — that
      was debunked: every `useGame()` consumer reads `state` so all re-render on tick regardless, and
      v16 already `React.memo`'d the costly 3D child, so a context split buys nothing here). The real
      smell: the context `value` was memoized over a hand-maintained 60-entry dep array that had
      drifted — 4 ref-stable callbacks (unlockLens/unlockFinish/marketingPush/rest) were missing.
      Split the type into `GameStateValue` + `GameActionsValue`; the action list now lives in one
      `actions` memo (complete deps), and the hot `value` depends on just the data slice + stable
      actions. Latent stale-closure bug closed; list can't drift again. Correctness/maintainability,
      not perf — said so plainly.
- **Declined as low-value (logged honestly, not done):** F13 furniture instancing — the 56 pieces are
      heterogeneous multi-mesh singletons, so true `InstancedMesh` rarely applies; the only real win is
      geometry/material sharing across 981 lines of hand-tuned 3D, modest gain + visual-regression risk
      that CI can't verify. Not worth it blind.
- 526 tests (+2), tsc 0, build+PWA green. Branch `claude/app-phase-step-next-uj1uix`.

## v51 — four-audit pass: correctness + save-resilience + tech-debt + a11y (DONE 2026-06-28)
Ran four parallel read-only audits (balance/exploit, engine correctness, UI/a11y/premium-polish,
dead-code/tech-debt) against the shipped repo, then implemented only the BLIND-SAFE, test-gated
findings — and deliberately did NOT touch the heavily, intentionally-tuned balance constants
(comments show several were reasoned the *opposite* way, e.g. garage rent lowered 200→120, flop
floor lowered to 10; the project's own discipline flags balance as needing on-device playtests CI
can't run). Branch `claude/app-roadmap-game-audits-d1m06w`. Each item below is one commit.
- [x] **Engine correctness** (`gameState.ts`): `rngState || seed` → `??` at both sites — a mulberry32
      state of exactly 0 is valid (`rng.state()` returns `a >>> 0`) but `||` silently re-seeded from
      `seed`, voiding the determinism contract. AND `trainStaff` now syncs the `skills` map: all
      discipline OUTPUT reads `s.skills` via `disciplineOutput`, not the headline `skill`, so a paid
      training previously raised salary/burn for ZERO mechanical gain. +3 tests.
- [x] **Save-resilience** (`persistence.ts` launched[] backfill): drop entries missing `product`
      (the sales tick deref's `lp.product.*` unconditionally → first-tick crash on a truncated save)
      and backfill `launchedWeek` (a required field; missing → NaN through franchise/hype math). +2.
- [x] **Tech-debt — dead exports removed**: `lt`, `isNegative`, `totalSkill`, `isPerfectionist`,
      `HAS_ROBOT_MODELS`, `TrendBars`, and a pointless `export { STAT_KEYS }` re-export. Verified
      zero references (strict + noUnusedLocals don't catch unused *exports*).
- [x] **Tech-debt — STAT label drift killed**: stat names were hand-maintained in 6 places with 3
      different abbreviation schemes that had drifted ("Ecosys"/"Eco", "quality"/"build quality").
      `glossary.ts STAT_INFO` gains an `abbr` register; charts/Research/HQ/events now derive from it
      (byte-identical or a small copy improvement). The two genuinely-distinct local registers
      (DesignLab ultra-compact chips; "Battery life" sentence form) are now ANNOTATED, not silent.
- [x] **A11y — LaunchReveal** (shown on EVERY launch): added the shared `useDialogFocus` trap +
      Escape-to-close; close target 36px → 44px. It was a hand-built `role="dialog"` that skipped the
      Sheet's keyboard/focus machinery.
- 540 tests (+5), tsc 0, build+PWA green across all commits.

### Balance review — LOGGED, needs on-device playtest, NOT applied (v51 audit)
The balance audit flagged the early game as low-pressure, but several of its headline exploits are
already guarded in source (the audit underweighted them): fan PRE-ORDERS are capped to a fraction of
*market* demand (`gameState.ts` preOrderCap → `1.5×marketDemand`), and the unit floor is
`priceFit`-scaled so overpricing collapses it. The defensible, still-open tuning questions — change
ONE at a time, with a fast-forward harness / device in hand, in `balance.ts`:
- **Early-game runway is long** (~166wk at $20k start, free founder, $120/wk rent). If first-ship
  pressure feels absent on device, the lever is BURN not cash (e.g. garage rent 120→~200) — but note
  rent was *deliberately* lowered 200→120 because thin-margin early cycles went net-negative. Verify
  before touching.
- **Paid training is linear** (`trainCostPerSkill 1800 × skill`) while research/content costs aren't;
  a free founder can buy maxed output cheaply. Candidate: steepen training cost. Needs a playtest.
- **Late-era hit bars** (`hitThresholdByEra [70,88,112,145]`) may sit below a maxed product's
  achievable score, flattening the endgame contest. Candidate: raise the top two bars. Playtest.
- **Self-relaunch** (`selfPenalty 0.22`) may under-penalise spamming one proven design. Playtest.
- **`idealMarkup: 2.2` is a DEAD constant** — referenced nowhere; the real fair-price anchor is
  `valueToPrice` (perceived value), not unit cost. Either wire a cost term into priceFit or delete
  the constant. (Left as-is this pass — touching priceFit is a balance change.)

### Remaining audit backlog — deferred (lower value or needs device/design call)
- **Correctness (Low):** debounced-save can clobber a fresh resume save (add the dirty-check guard
  the 10s safety net already has, `useGame.tsx`); 4 actions call `withLiveAchievements` inside the
  setState updater → StrictMode double-toast in dev (precompute like `foundPlatformCb`); completed
  build jobs push an un-`fixProduct`'d product onto `ready` (latent — all readers have `??` defaults).
- **A11y (Medium/Low):** `StatBars` (charts) signals the "hot" stat by FILL COLOR only — add a
  non-color cue (DesignLab + Market); focus traps on `DecorateTutorial` + the `Challenges`/`Scenarios`
  confirm dialogs; `Challenges` code input needs `aria-invalid` + `aria-describedby`; sub-44px targets
  (`coach__skip`, `hqb__icon`, `co__stats-x`, `scn__hist-share`, `set__switch`).
- **Polish (Low):** add a `--scrim` token (3 hand-rolled scrims) + an `--on-accent` token for the
  `#fff`-on-fill labels; migrate stray `font-size` literals onto the type scale (raise the two `9px`
  cases off sub-`--fs-nano`); `Market.tsx CATEGORY_LABEL` should derive from `CATEGORIES[id].displayName`
  (keep the AR/VR override) instead of a hand-kept copy; empty-state guards on a few rarely-empty `.map`s.
- **Dead type exports (Low):** ~20 unused `export type`/`interface`s across `platform.ts`,
  `gameState.ts`, `types.ts`, etc. — drop the `export` keyword (tsc will catch any real use). Mechanical.

## v52 — measured balance pass: verdict-band recalibration + fast-forward harness (DONE 2026-06-28)
"Balance now the game." Did it the disciplined way — MEASURED, not guessed. Built a headless
fast-forward harness (`scripts/balance-sim.mjs`, `npm run sim`) that drives the real pure engine with
a competent auto-player across 40 seeds × 520 weeks and reports the actual balance curve. The data
exposed one dominant problem and one structural one:
- **Verdict monolith:** 83.5% of 9,015 launches landed "solid"; just 3.6% hit, 0.5% flop. The
  effectiveScore landscape vs the bands showed why — a maxed competent product scores ~112–130 in the
  AI era, but the hit bar was 145 (UNREACHABLE) and the solid floor 92 (far below the achievable
  minimum), so every late launch collapsed onto "solid." Era 3 had the same shape.
- **No downside / solved outcome:** 0/40 bankruptcies, ~167-wk starting runway, final net worth in a
  ±5% band, reputation pinned to 100 for every seed (logged, not fixed this pass — see below).
- [x] **Recalibrated `reputation.{hit,solid,flop}ThresholdByEra` to the measured landscape.** Bands now
      sit INSIDE each era's real score range: hit `[70,88,112,145]→[70,80,116,128]`, solid
      `[45,56,72,92]→[45,56,98,115]` (flop unchanged — flops are for genuine mistakes). Result, by the
      harness: **28.9% hit / 35.9% solid / 34.7% steady / 0.5% flop** — a textured, skill-discriminating
      spread. A competent player now gets a real mix; a sloppier one shifts toward steady/flop. Era
      pacing (E2 wk72 / E3 wk118 / E4 wk175) and zero-bankruptcy survival are UNCHANGED — progression
      didn't stall. Early eras (1–2) were already well-spread and were left essentially as-is.
- [x] **Guard D** (`balanceGuards.test.ts`): pins band invariants (flop<solid<hit per era; bands
      non-decreasing era-over-era) so the recalibration can't silently regress. +2 tests.
- [x] **`scripts/balance-sim.mjs` + `npm run sim`**: a reusable measurement tool (the project has
      repeatedly asked for a fast-forward harness). esbuild-bundled like `shots:stage`; artifact
      gitignored. Reports bankruptcies, runway, era arrival, verdict mix, net-worth percentiles, and
      the per-era effectiveScore landscape vs the bands — so the NEXT balance change is also measured.
- 542 tests (+2), tsc 0, build+PWA green.
- **Deliberately NOT touched (needs design call / would regress reasoned tuning):** the long early
  runway + the ±5%/rep-100 "solved outcome." The early economy was tuned the other way ON PURPOSE
  (rent lowered 200→120; safety reserve prevents unfair bricking — and the auto-player only avoids
  bankruptcy because it uses the safe `recommendedRun`). The flat late-game net worth is a deeper
  fix (outcome variance / failable bets at scale) that wants its own measured pass — the harness now
  makes that tractable. Flagged here rather than churned blind.

## v52.1 — late-game variance investigation via the harness (measured; no blind change shipped)
Follow-up to v52: used `npm run sim` (now with outcome-variance diagnostics — net-worth CV, per-run
hit-rate spread, reputation-low-after-Era-2) to probe the "solved macro outcome" the v52 data hinted
at. Findings, all MEASURED:
- **Journey variance is now healthy** (the v52 win): per-run hit-rate spans p10 19% → p50 30% → p90
  42%. Runs genuinely differ moment-to-moment.
- **Macro outcome is structurally deterministic**: final net-worth CV ≈ 2.4% (p90/p10 = 1.06×), and
  reputation only ever CLIMBS to 100 (no dip/setback once past the Garage era). Every run ends a
  multi-billion-dollar empire within ±2.5%.
- **Two experiments REFUTED the easy levers** (reverted, not shipped):
  · AI-era `demandVariance` 1.4 → 3.0 moved net-worth CV 2.4% → 2.5% (≈nothing). Per-launch volatility
    averages out over the ~230 launches a 10-year run produces — law of large numbers.
  · `competition.factorK` 0.025 → 0.10 changed NOTHING (identical verdict mix + CV). Root cause: the
    launch path passes `competitorStrength: 0` to `scoreLaunch` and models competition via match/beat
    COUNTS (gameState.ts:798–844), so **`factorK` is a vestigial constant** (like `idealMarkup`) —
    only `market.ts:166` reads it, always against a 0 strength. Logged, not removed (touches the
    protected market.ts; the param may be kept for flexibility).
- **Conclusion:** macro determinism is a function of late-game SHAPE — many high-volume,
  near-guaranteed-profit launches + a monotonic reputation climb with no failure mode — NOT of any
  single tunable constant. Making the late game divergent/failable is a DESIGN decision, not a tweak.
  Three options, each its own measured pass (not shipped blind):
  (a) Reputation maintenance/decay — rep slowly erodes without sustained hits, so a top brand is held,
      not banked once (adds ongoing tension + setback risk).
  (b) Fewer/bigger bets late-game — pace or cost changes so a flagship flop actually hurts (reduces the
      averaging that flattens outcomes).
  (c) Durable competition — make rivals able to take and HOLD share (revive the dead factorK path or
      strengthen the count model), so contested runs diverge from uncontested ones.
  Recommendation: the journey-level balance is good now; pursue (a) or (c) only if a more dramatic,
  failable late-game is wanted — I can implement + measure whichever you pick.

## v53 — Living Late Game, Phase 1: fewer, bigger, costlier late bets (DONE 2026-06-28)
Acting on v52.1 option (b). MEASURED via `npm run sim` each step (40 seeds × 520wk), not guessed.
- [x] **Era-scaled build economics** (`balance.eraModifiers` += `toolingMult` + `leadWeeks`; wired
      through the existing `toolingCost` + `buildWeeksFor`). Eras 1–2 neutral (1.0 / 0) so the early
      game is byte-identical; Platform era ×1.7 tooling / +2 wk, AI era ×2.6 / +3 wk. The endgame
      becomes fewer, weightier launches instead of a ~2-week relaunch conveyor. `eraModifier()` return
      type + `eraRuleSummary()` extended; `eras.test.ts` clamp/equality tests still hold.
- [x] **Verdict bands RE-RAISED for the new landscape** (`hit/solidThresholdByEra` E3/E4
      `116/128`→`156/192`, `98/115`→`135/175`). Fewer launches → each built by a more-developed
      company → measured effectiveScore shifted UP (E3 p50 106→153, E4 124→189), so the old bars sat
      far below achievable and ~70% of late launches collapsed onto "hit". Re-raised INSIDE the new
      per-era range (same method as v52). Guard D (flop<solid<hit, non-decreasing) still passes.
- **Measured result** (baseline → v53): launches/run 231 → **117**; verdict mix 23/40/37/0.5 →
      **27/32/41/1.0** (hit/solid/steady/flop — texture restored); net-worth CV 2.5% → **3.9%**,
      p90/p10 1.07× → **1.11×** (variance up, the goal direction); **0/40 bankruptcies** preserved;
      early game byte-identical. Cost: Era-4 arrival drifted wk 171 → **202** (still 40/40 reach it +
      win; ~27 min of ticks). `lateGame.test.ts` (+3) pins the era-scaling contract. 598 tests, tsc 0.
- **Honest finding carried to Phase 2:** reputation STILL pins at 99 (decay is final-era-only, floor
      78, outpaced by a constant-shipping player) — Phase 1 reshapes pace/stakes but is NOT itself the
      variance silver bullet. Reputation-as-a-defended-asset (option a) is next; durable competition
      (option c, PROTECTED market.ts/competitors.ts) is the deepest lever and needs its own go-ahead.
- ⚠️ Magnitudes (toolingMult/leadWeeks, the new bands) are harness-tuned, NOT device-playtested —
      flag if the late game's slower cadence reads as a drag on a real phone.

## v54 — Living Late Game, Phase 2: reputation is a DEFENDED asset (DONE 2026-06-28)
Acting on v52.1 option (a), on top of v53. The maintenance mechanic existed but was inert (final-era
only, floor 78, 0.5/wk — outpaced by any constant shipper). Gave it teeth without touching progression.
- [x] **`reputation.decayFloor` 78 → 62, `decayPerWeekLate` 0.5 → 0.9** (kept `decayFromEra: 4` —
      era-4 `repToAdvance` is Infinity, so decay can NEVER softlock an era gate). The floor now sits
      well below the rep-85 IPO-win gate and the slope matches the post-Phase-1 launch cadence (~1
      launch / 3–4 wk earns ~0.9 rep/wk), so hits hold the line with visible dips between them while a
      coasting or middling run erodes toward the floor. Reputation becomes earned-and-kept, not banked.
- [x] **Mechanic test** (`gameState.test.ts`): ~20 wk of not shipping in the final era drops a rep-100
      brand below 85 — win-eligibility is actually lost until it performs again. (The existing
      floor/no-early-decay tests reference the constant, so they held.)
- **Measured (npm run sim, cumulative baseline → v53 → v54):** net-worth CV 2.5% → 3.9% → **4.6%**
      (+84% vs baseline); p90/p10 1.07× → 1.11× → **1.13×**; final reputation 99 → 99 → **97** (decay
      now bites even a perfect auto-player); verdict mix stays textured (23/31/46/1); **0/40
      bankruptcies** and **40/40 IPO-win reached** preserved; era pacing unchanged from v53. 599 tests
      (+1), tsc 0, full suite green.
- **Honest limit of Phases 1–2:** macro CV is up 84% but still ~4.6% in absolute terms, because the
      harness auto-player plays competently and constantly — it smooths most variance by construction.
      No flat reputation/cost knob can fully break that. The deepest remaining lever is **option (c)
      durable competition** (rivals that TAKE and HOLD share → contested vs uncontested runs genuinely
      diverge), which touches PROTECTED `market.ts` + `competitors.ts` and needs its own go-ahead +
      balance pass. The other true arbiter is an on-device playtest: real players make the mistakes the
      auto-player never does, and Phases 1–2 are what make those mistakes cost something.

## v55 — Living Late Game, Phase 3: durable competition (DONE 2026-06-28)
Acting on v52.1 option (c) — the deepest lever. Rivals now CONTEST and HOLD share in the late eras,
so demand is a contested resource and runs diverge by how rivals crowd you. PROTECTED `competitors.ts`
touched WITH go-ahead; `market.ts` deliberately NOT touched (the launch path already models competition
via the count model in `gameState.ts`, passing `competitorStrength: 0` to scoreLaunch).
- [x] **Root cause found by reading + measuring:** late competition was cosmetic for THREE compounding
      reasons — (1) the winnability cap was era-flat (95), (2) rival strength decayed fast (0.88/wk), and
      (3) the launch-strength FORMULA naturally tops out ~92, BELOW the cap, so raising the cap alone was
      inert. Fixed all three, era-scaled, eras 1–2 untouched (byte-identical early game):
      `strengthDecayByEra [0.88,0.88,0.90,0.93]` (rivals entrench, not blip), `reactMaxStrengthByEra
      [95,95,105,118]` (room to contest), `lateStrengthByEra [0,0,8,18]` (the formula now REACHES
      contesting range — a strong rival can match or beat a maxed player). The existing era-pressure
      term (`[0.25,1,1.2,1.45]`) and count model then apply the bite — no new systems.
- [x] **Tests** (`competitors.test.ts` +2): late ceilings/decay are monotonic and eras 1–2 untouched;
      an AI-era rival now reaches strength > the old flat-95 wall (proving late competition bites). The
      existing ceiling test re-pointed at the era-4 cap.
- **Measured (npm run sim, cumulative baseline → v55):** net-worth CV 2.5% → **5.6%** (+124%); p90/p10
      1.07× → **1.15×**; Era-4 effectiveScore spread widened to **135–197** (competition now varies it
      per launch/seed — the divergence the auto-player can't smooth); verdict mix 23/40/37/.5 →
      **17/27/55/1** (hits are now EARNED against rivals); net worth median $4167M → **$2101M** (still a
      vast empire); **0/40 bankruptcies + 40/40 IPO-win preserved** — contested, not unfair. 601 tests
      (+2), tsc 0, full suite green.
- ⚠️ Knobs (decay/cap/lateStrength byEra) are harness-tuned, NOT device-played. The contest pulled the
      hit rate to ~17% (you now fight for hits); if that reads as too harsh on a phone, soften
      `lateStrengthByEra` first (it is the bite). Living Late Game P1–P3 complete; remaining headroom is
      an on-device playtest of the new cadence + contest.

## v56 — market fatigue / novelty: you can't spam near-identical devices (DONE 2026-06-28)
Direct user ask: shipping the same type of device with minimal changes again and again should feel
repetitive and the market shouldn't buy a too-similar product released not long ago. Engine-first,
no PROTECTED refactor (new pure module + balance data + demand wiring + a "why" readout).
- [x] **`engine/novelty.ts` (NEW, pure):** `productSimilarity(a,b)` (0..1, dominated by component
      tiers + a little design tier; different category → 0) and `noveltyFor(product, history, week)`
      → an organic-demand multiplier. A follow-up too SIMILAR to a recent same-category launch loses
      demand; the most-similar recent product drives the cut, faded linearly over a fatigue window.
- [x] **`balance.novelty`:** `fatigueWeeks 30`, `maxPenalty 0.55` (identical same-week re-release →
      −55% organic), `similarityFloor 0.78` (below it a product reads as "new enough" → no penalty),
      `tierSpan 4`. Harness-tuned; ⚠️ want a device playtest.
- [x] **Wired into `planProduction` (gameState.ts):** novelty multiplies ONLY organic market demand;
      the fan pre-order ceiling is computed from the un-fatigued (competition-adjusted) organic, so a
      loyal base still pre-orders the sequel while the broad market shrugs at a rehash. New plan
      fields `noveltyMult / similarTo / similarWeeksAgo`.
- [x] **Readability (Epic C):** the build-wizard review shows a red "Market fatigue · −X% demand —
      too similar to <product> (<n> wk ago) — change more components or wait" Stat, mirroring the
      Cannibalization line. Verified live: a maxed rehash of "Aurora X" shows −27% and flips projected
      profit negative (the spam tax is legible).
- [x] **Tests:** `novelty.test.ts` (+6: identical/upgrade/time-heals/different-category/floor) and a
      `production.test.ts` integration case (a same-spec follow-up loses open-market demand vs a real
      upgrade / vs no history). 608 tests, tsc 0, full suite green.
- **Measured (npm run sim):** the spam-happy auto-player's net worth drops ~19% ($2.10B → $1.69B) —
      the fatigue bites a player who relaunches similar designs, while a player who diversifies avoids
      it entirely. **0/40 bankruptcies + 40/40 IPO-win preserved**; early game byte-identical. (Macro
      CV dipped 5.6%→4.0% because the auto-player spams uniformly across seeds — a measurement
      artifact, not a design regression; real players vary.)

## v70 — codebase health pass (DONE 2026-07-04)
Full gate sweep + dead-code audit (knip 5 + per-symbol grep verification, engine touched only
mechanically per the v51 precedent). Branch `claude/game-design-ux-review-22ojj9`.
- [x] **Gates verified clean at start AND end**: `tsc -b` 0 errors; vitest **707/707**; `npm run build`
      + PWA green. No ESLint config exists in the repo (nothing to lint — flagging, not adding one blind).
      The only build warning is Rollup's >500KB chunk advisory (the known AUDIT 0.5 main-chunk item).
- [x] **`three-stdlib` declared as a direct dependency** (^2.36.1): `garage3d/gltfRobot.tsx` imports it
      directly but it was only present transitively via drei — a drei upgrade could have silently broken
      the build.
- [x] **27 internal-only exports un-exported** (Hud.weekLabel, robotKit.ROBOT_TRIM, hqHighlight.HQ_HIGHLIGHT_MS,
      engine: competitors/franchise/furniture/market/product/rivalAI/segments/staff×8/stocks/suppliers×2,
      state: gameState×5, settings.applyContrast) — each verified used ONLY inside its own module. That
      exposed **`competitorStrengthFor` as fully dead** (superseded by `rivalStrengthsFor`) — deleted.
- **Needs manual repro (none confirmed)**: no runtime bugs were verified by code-path reading this pass.
- **Flagged, deliberately NOT deleted (knip false positives / manual tools)**:
      `docs/assets/site.js` (referenced from docs/index.html — knip doesn't parse HTML);
      `@capacitor/ios` devDependency (used by `cap sync`, not imported);
      `scripts/shots.mjs` + `scripts/capture-tabs.mjs` (manually-run capture tools, documented in
      stage-save.mjs's usage header, maintained as recently as PR #37);
      `@resvg/resvg-js` is imported by `scripts/gen-icons.mjs` but UNLISTED in package.json — the script
      fails on a fresh `npm ci`; add it as a devDependency next time icons are regenerated.
- **Backlog carried (larger, verified-real but deferred)**: knip reports **67 unused exported types**
      (drop the `export` keyword; some will then be fully dead — let tsc decide) and a handful of
      ambiguous value exports needing per-call-site reads (`dollars` ×2, `demandScore`, `staff.output`,
      `MODEL_ASSETS`, `gameState.counts`, `designerSkill`, `applyTheme`) — knip flags them, but the
      names collide with common words/test usage, so each needs an eyes-on check before acting.

## v71 — Factory World P1: the living 2.5D manufacturing floor (DONE 2026-07-04)
User ask: a second 2.5D world beside the company name showing the factory — conveyor belts,
immersive, fullscreen-able — growing into a factory-tycoon layer. Full phased plan in
`FACTORY_WORLD_PLAN.md` (P1 visualization → P2 detail/aliveness → P3 interactivity → P4
engine-touching tycoon depth, each P4 slice harness-measured). P1 shipped this pass:
- [x] **`components/FactoryWorld.tsx` + `factoryWorld.css`**: parametric SVG factory floor
      (zero assets) — wall/windows/trusses, pendant lights (dim when idle), factory signage,
      steam vent, LED control panel, an elevated conveyor with plumb legs + animated tread,
      three stations (robotic arm w/ two-joint articulation, press stamper w/ spark, QA scan
      arch w/ sweeping beam; the "hot" station follows real build progress), crates traveling
      the belt, pallet stacks sized by the ready shelf, a SHIP truck that idles while products
      sell, amber OVERTIME mood (faster belt/crates, warning LEDs) when the run exceeds the
      line's weekly capacity. Idle state stops everything + quiet hint. All animation gated on
      sim state and disabled under reduced motion.
- [x] **World tabs** beside the company name on the Office screen (Office | Factory,
      aria-pressed, haptic). The 3D office stays MOUNTED (hidden, active=false) during the
      swap so its WebGL context survives — same rule as cross-tab.
- [x] **Fullscreen immersion**: body-portal overlay (dodges the screen-enter transform that
      would break position:fixed), close ✕ 44px top-right safe-area aware, Escape closes.
- [x] **Status chips**: factory name + contract/owned, runs in production w/ lead product +
      week, capacity utilisation (overtime flagged), ready-to-ship count.
- [x] **Verified in a real browser** (vite + playwright-core/chromium): idle scene renders,
      world tabs swap, fullscreen opens/closes, zero console errors; screenshots reviewed
      (first pass leaned the legs/stations with the belt tilt — counter-rotated to plumb).
- [x] **Review pass (same session)**: drove the RUNNING + OVERTIME state live (staged save +
      injected mid-progress build on a capacity-limited line, dark theme) — amber mood, 4 crates,
      real signage/chips, zero console errors. Fixed 6 findings: fullscreen backdrop inverted in
      dark theme (ink-based mix → hand-rolled near-black scrim); crates piled at the belt start
      during their stagger delay (fill-mode: both); fullscreen lacked the house dialog machinery
      (useDialogFocus trap + body scroll lock added, focus-inside verified); long company names
      could crowd the world tabs (title ellipsis); dead lamp animationDelay removed; idle hint
      collided with the chips row (moved to the wall band, em dash scrubbed per house style).
- NOT verified on-device: animation FEEL/timing (belt/arm/press cadence) wants real eyes.

## v72 — Factory World P2: every step visible + buyable robotics (DONE 2026-07-04)
User ask (with the In-production card as the design reference): show every manufacturing step
in the factory with that card's language, add purchasable robots that make the factory faster,
more 2.5D furniture. All presentational over EXISTING mechanics — zero engine change.
- [x] **Stage strip on the floor**: BuildProgress's STAGES/stageFor are now exported (single
      source of truth) and the factory shows all 5 steps as icon dots with the active stage
      carried in the card's exact language (icon in a soft circle + label + sub + "N wk left ·
      M units"). Stations now work their REAL stage: press=Tooling, arm=Assembly, arch=QA,
      and Packaging pulses the dock (the old progress-threshold mapping had the order wrong).
- [x] **Robotics = the Assembly upgrade line made physical + buyable in-world**: AGV robots
      (body/beacon/wheels, floor patrol loop, beacon goes amber on overtime) appear one per
      Assembly tier (cap 3); a chip-button buys the next tier from the floor via the existing
      buyUpgrade("assembly") (which already cuts build weeks/cost) with the upgrade fanfare;
      research-locked tiers name the blocking project (Lock chip); maxed hides the control.
- [x] **More parametric furniture**: shelving rack w/ stocked boxes, barrel pair, forklift.
- [x] **Layout fix caught on screenshot review**: overlays were burying the compact scene —
      chips now flow BELOW the art in card mode and only overlay in fullscreen.
- [x] **Verified live** (vite + chromium, staged save w/ mid-Assembly overtime build, tier 2):
      strip reads "Assembly · 2 wk left · 20,000 units", 2 robots patrol, tapping the buy chip
      REALLY purchases tier 3 (third robot appeared), zero console errors. 710 tests, tsc 0,
      build+PWA green.
- NOT verified on-device: AGV patrol path/speed feel; stage-strip width on the smallest phones.

## v73 — Factory Mode F1: the top-down tile factory (DONE 2026-07-04)
FACTORY_MODE_PLAN.md F1 shipped: the reference guide's layout, wired to the real sim.
- [x] **rushBuild** (state layer, +3 tests): the reference's paid time boost translated
      honestly — pay rushCostPct (0.08 ⚠ playtest) of the run's production cost, one week of
      the lead build completes instantly; cash-gated, refuses past completion, spend FX.
- [x] **`components/FactoryMode.tsx` + css** (supersedes FactoryWorld side-view, deleted):
      top-down SVG tile map (grass fringe, asphalt pad + grid, conveyor loop w/ animated
      lanes + chevrons, top-view machines — assembler/arm/QA/charger — whose HOT machine
      follows the real build stage, storage pallets = ready shelf, dock road + truck, AGVs
      per Robotics tier, overtime mood). Fullscreen shell: top bar (era badge, cash + real
      $/wk flow, RP chip in the gems slot, capacity meter w/ amber overtime), CURRENT ORDER
      (device thumb/progress/stage/wk left) + FACTORY STATS (per-week truth) panels, right
      rail (Build="soon", Upgrades sheet w/ Robotics buy + affordable-dot, Research deep-link,
      Stats sheet), bottom strip (6-kind materials tray from committed parts, BOOST=rushBuild,
      ready-truck badge, machine Shop sheet). Dialog focus trap + scroll lock + Escape.
      Compact card in the Office tab = live minimap that opens the mode.
- [x] **Verified live** (chromium, staged overtime build, dark): BOOST advanced the build a
      real week (Assembly→QA on screen), close/reopen clean, zero console errors. Screenshot
      review caught 2: backdrop ghosting (scrim 0.99) and slice-fill over-zooming portrait
      (reverted to meet — F2's pan/zoom owns filling). 713 tests, tsc 0, build+PWA green.
- NOT verified on-device: portrait dead-space feel below the map (F2 pan/zoom addresses);
      panel widths on small phones; light-theme map contrast.

## v74 — Factory Mode goes three.js (DONE 2026-07-04)
User verdict on the flat SVG map: looks bad — use three.js. Correct call: the 3D office
already proves the stack. `components/Factory3D.tsx` (r3f + drei, lazy chunk SHARING the
office's three bundle — Factory3D itself is 8.8KB):
- [x] Tycoon-tilt 3D floor: grass field, asphalt pad + grid, conveyor loop (RoundedBox belts
      w/ emissive amber lanes), crates riding the loop via useFrame arc-length param, machine
      rigs (assembler piston, two-joint robot arm, QA gate w/ sweeping beam plane) where the
      HOT machine follows the real build stage (emissive + point light), crate stacks =
      ready shelf w/ packing bounce, dock road + wheeled truck (bobs while selling), AGVs
      per Robotics tier patrolling outside the loop, overtime = amber key light + 2× speeds.
- [x] House perf discipline: lazy import (three stays chunked), dpr [1,1.75], context-lost →
      SVG fallback; gated on garage3d setting + webglSupported + !reduced-motion (SVG map
      kept as the fallback + the Office-tab minimap).
- [x] **Portrait framing solved by rotating the WORLD 90°** (long axis into screen depth) +
      fov 46 on portrait / 27 landscape (FitCamera) — a fixed camera simply cannot frame a
      wide pad on a narrow phone (measured through 3 screenshot iterations).
- [x] Verified live (chromium+ANGLE): canvas mounts, stage-hot machine correct (QA glowing
      during the staged run's QA week), zero console errors; 4 screenshot iterations drove
      the camera/lighting/lane fixes. 713 tests, tsc 0, build+PWA green.
- NOT verified on-device: real-phone GPU feel, light-theme contrast (scene is dark-first by
      design), and whether two canvases (office + factory mode) coexist happily on old iPhones
      — the office canvas stays mounted while the mode is open; if memory bites, unmount the
      office scene while fmode is up (one-line follow-up).

## v75 — Factory 3D: a production line that makes sense (DONE 2026-07-04)
User: "make the three.js make sense, add conveyor belts / robot arms / machines that look
good and cool." Rebuilt the scene as ONE coherent S-shaped production line:
- [x] **The story on the floor**: intake hopper (Sourcing, falling material puffs) → gantry
      press straddling the belt (Tooling, dual-cylinder sharp-stamp ram + emissive status
      strip) → TWO industrial robot arms (Assembly, turntable/shoulder/elbow/wrist/two-finger
      gripper rigs, mirrored + phase-offset) → glass QA scan tunnel (Quality, translucent
      housing + sweeping scan sheet) → packer (Packaging, folding plates) → crate stacks +
      dock truck. The REAL build stage's machine glows + gets its point light.
- [x] **The item visibly transforms as it travels**: raw metal slab → green logic board →
      the dark device with an emissive screen → banded shipping crate, switched by arc
      position along the path (4 items riding the line, 2× on overtime).
- [x] **Belt quality**: beds + metal side rails + support legs + ~40 rollers along the whole
      path; hazard-striped safety bases under every machine; AGVs now carry a crate and orbit
      the line with heading; 6-wheel truck with windshield.
- [x] Camera pull-back tuned via screenshot (portrait fov 50) so the WHOLE line frames on a
      phone. Verified live (chromium+ANGLE): zero console errors, QA tunnel correctly hot
      during the staged run's QA week. 713 tests, tsc 0, build+PWA green.
- NOT verified on-device: GPU cost of ~130 meshes + 6 useFrame rigs on old iPhones (drop
      roller count / shadow map first if it stutters); light-theme is intentionally dark.

## v76 — Factory Mode F2: the floor is player-built (DONE 2026-07-04)
Build mode ships: machines and conveyors are now DATA the player lays down, and the 3D
scene + item flow render from it.
- [x] **`engine/factoryFloor.ts`** (PURE, +7 tests): 16×10 grid, 5-machine catalog
      (intake/press/arm/qa/packer w/ footprints + costs + stage mapping), directed belt
      tiles, placement validation (bounds/overlap/no-belt-under-machine, re-aim replaces),
      `beltPath` (chains directed tiles from the unfed start into the longest path + run-off),
      `formMarks` (item transform points derived from where press/arm/qa actually sit along
      the PLAYER's path), authored `starterFloor()` (the S-line, validated by test).
- [x] **State**: `GameState.factoryFloor` (+newGame default, persistence backfill);
      `buyFloorMachine` (cash-gated) / `buyFloorBelt` ($400/tile, re-aim free) /
      `clearFloorCell` (demolition, no refund); useGame cbs w/ spend FX. Determinism pin +
      all 206 state tests unaffected (the floor is inert to the tick). 720 tests total.
- [x] **Factory3D is layout-driven**: belts render per-tile (bed/rails/roller), items ride
      the CHAINED player path (generic polyline walker) and transform at the machine-derived
      marks; machines render at their placed positions (multiple arms supported, phase-offset
      by cell). Tap-to-build: a transparent raycast plane maps taps to grid cells IN THE
      WORLD GROUP'S LOCAL SPACE (portrait rotation can't skew it).
- [x] **Build UI**: the rail's Build button arms a toolbar (Belt+direction cycler, the 5
      machines w/ costs, Erase, Done) replacing the bottom strip; invalid placements toast
      the engine's reason.
- [x] **Verified live end-to-end** (chromium+ANGLE): a tap-sweep BOUGHT AND PLACED 5 arms
      (persisted 10 machines / starter 5), cash deducted, scene re-rendered them; occupied
      cells correctly refused. Found + fixed: r3f raycast skips visible={false} — the tap
      plane is transparent-visible instead.
- Known gaps (logged): SVG fallback map still draws the hardcoded starter line (fallback
      only); no pan/zoom yet; no sell-refund on demolition; ghost preview (tap commits
      directly, engine validates). NOT verified on-device: tap precision on a real phone.

## v77 — Factory Mode F3: the line must actually connect (DONE 2026-07-04)
The factory-tycoon rule that makes layouts meaningful, plus F2's UX gaps.
- [x] **`lineComplete(floor)`** (pure, +3 tests): the longest belt chain must START beside an
      Intake Hopper and END beside a Packing Station; `beltChain` extracted from beltPath so
      completeness reasons about tiles. Items only ride the belts while the line is complete;
      breaking it mid-chain stops production visuals and raises an amber "Line stopped" panel
      naming the fix ("connect the Intake to the Packing Station in Build").
- [x] **Demolition refunds half** (`demolitionRefund`, engine + clearFloorCell wiring) — erase
      is no longer a pure loss, so experimenting with layouts is safe.
- [x] **Tap flash**: every build-mode tap pulses its CELL green (accepted) or red (refused) on
      the pad — placement feedback you can aim by on a phone.
- [x] **Verified live** (chromium): starter line = no warning; erasing a mid-chain tile via
      tap → warning appears + items halt; zero console errors. 723 tests, tsc 0, build+PWA.
- Still open for F3+: pan/zoom, machines requiring belt adjacency to animate, and the F4
      engine slice (placed machines grant real capacity — needs the sim-harness pass).

## v78 — Factory Mode polish pass: truthful minimap, foldable chrome, taught rules (DONE 2026-07-04)
"Look through it, improve it, make it make sense, premium UX." Critical review found and fixed:
- [x] **The stale hand-drawn SVG map is GONE** — the compact card and the no-WebGL fallback
      showed a hardcoded line regardless of the player's layout (actively false after F2).
      New `FloorMinimap`: a layout-driven SVG rendering the REAL floor — belts coloured by
      chain membership (amber = live chain w/ gentle pulse while producing, red = broken,
      gray = orphan tiles), machines tinted by kind. ~150 lines of dead map code + its whole
      CSS block deleted.
- [x] **Regression caught by screenshot review**: the Office|Factory world-tab styles were
      orphaned when factoryWorld.css was superseded in F1 — the tabs had been rendering as
      unstyled text since. Re-homed in App.css (their proper app-chrome home).
- [x] **Panels fold** so the floor stays the star on portrait: Current Order and Factory
      Stats get chevron headers (stats collapsed by default); aria-expanded, 28px+ targets.
- [x] **Build mode teaches its rule**: a micro hint line in the toolbar ("Belts carry the
      line from the Intake Hopper to the Packing Station… Erase refunds half"). **Escape now
      exits Build first**, then closes the mode on the second press.
- [x] Verified live: card minimap truthful, fold/hint/Escape-order all exercised, zero
      console errors. 723 tests, tsc 0, build+PWA green.

## v79 — Factory 3D: machines react to items + real product on the belt + arrow belts (DONE 2026-07-04)
User: "Do machines move realistically? Put the produced product on the belt. Make belts arrows,
smart corners, more detail." All three, one pass.
- [x] **Machines now ACT ON the passing item** (was: free-clock motion decoupled from items).
      Each machine reads `nearestItemDist` to the traveling items and drives its rig by proximity:
      the gantry press SLAMS DOWN onto the slab beneath it, the robot arm turns TOWARD the nearest
      item and reaches to the belt (slow home-sway when idle), the QA scan BRIGHTENS while a device
      is inside the tunnel, the packer folds its plates shut as the device arrives, the intake puffs
      only while producing. Smoothed engage refs; idle when the line is stopped.
- [x] **The real product rides the belt** (pillar #2, "the product IS the toy"): the device form is
      now `DeviceForm` — a parametric 3D model whose SILHOUETTE follows the product category (phone/
      tablet/laptop-with-lid/wearable-with-straps/console/desktop/monitor/AR-glasses) and whose BODY
      COLOUR + metalness come from the real finish swatch (`productLook` reads FINISH_SWATCHES). A gold
      flagship literally rides as a gold device; the crate band tints to the product accent.
- [x] **Belts are directional + smart-cornered**: bright emissive chevron **arrows** on every tile
      show flow direction at a glance; a tile whose inflow direction differs from its own renders as
      an **L-bend** (square bed that connects flush to both neighbours, rails on the two OUTER edges,
      a turning enter→exit arrow) so corners auto-sync. Straight tiles gain cross-slats + end rollers.
- [x] Verified live (chromium+ANGLE, gold phone staged): arrows flow + turn at corners, arm reaching,
      QA glass lit, gold device on the belt, zero console errors. Factory3D chunk 8.8→21KB (still lazy,
      shares the three bundle). 723 tests, tsc 0, build+PWA green.
- NOT verified on-device: the reactive timing FEEL (press/arm sync to item) + GPU cost of the extra
      chevron/slat meshes on old iPhones (drop chevrons to 1/tile or slats first if it stutters).

## v80 — Factory Mode: declutter the HUD + integrate with production (DONE 2026-07-04)
User: "clean navigation/UI/buttons, nothing noisy; integrate into the game well."
- [x] **Removed the noisiest chrome**: the 6-chip raw-materials tray (moved to a quiet "parts
      committed" row inside the Stats sheet), and the top-bar capacity meter that shouted "333%".
      Capacity is now a calm slim bar + a word ("On schedule" / "Overtime") inside the order card.
- [x] **One left card, not three**: dropped the separate collapsible Factory Stats panel (it
      duplicated the rail's Stats sheet); the left is just Current Order (+ the warn card when
      the line is broken). Bottom strip is now centred on BOOST with two quiet side buttons.
- [x] **Integration**: the HQ "In production" card gets a quiet "Watch it on the line ›" link
      that switches to the Factory world — so the factory is reachable from the core production
      loop, not just the world toggle. (onViewFactory threaded App→HQ.)
- [x] Verified live: materials tray + top capacity meter gone, floor unobstructed, zero console
      errors. 723 tests, tsc 0, build+PWA green.

## v81 — Factory Mode: final noise cut, one button system, calm Build palette (DONE 2026-07-05)
Executed `FACTORY_POLISH_PROMPT.md` (Fable-5 handoff) as the polish pass. 3D scene untouched
(signed off v79); only the 2D HUD/nav/buttons changed.
- [x] **#1 Noise cut**: dropped the top-bar RP chip (RP isn't spent in this mode, so it was
      dead weight next to cash/flow). Top bar is now era badge + cash/flow + close only.
- [x] **#2 One button system**: introduced `--fmode-btn-bg` / `--fmode-btn-line` tokens on
      `.fmode` and pointed every surface (close, rail `.fmode__tool`, side buttons) at them, so
      all quiet buttons share one radius/fill/border. Active rail state calmed to a soft
      accent-mix instead of a hand-rolled `rgba()`; the affordable-dot now whispers in accent.
- [x] **#4 Build palette redesign**: replaced the text-chip toolbar (hint paragraph + belt/dir +
      5 machine chips + erase + Done) with a compact scrollable icon palette — `.fmode__palette`
      of `.fmode__ptile` tiles (icon + short name + cost): Belt (rotating ArrowUp shows
      direction), Turn (RotateCw), Intake/Press/Arm/QA/Packer (Lucide glyphs), Erase (Eraser).
      Selected tile highlights; a one-line rule ("Connect the Intake to the Packer. Erase
      refunds half.") + a clear Done exit replace the paragraph.
- [x] **#5 Gentle states**: the red "Line stopped" warn panel is now a calm "Line paused" card
      (Wrench glyph, neutral surface) with a direct "Fix in Build" button that arms the belt tool
      — guidance, not an alarm.
- [x] Removed dead `.fmode__buildhint` / `.fmode__chip` CSS.
- [x] Verified live over a running line (staged save, Chromium): RP chip gone, palette renders 8
      clean tiles, zero console errors. 723 tests, tsc 0, build+PWA green.
- Left for on-device tuning: rail label/badge micro-copy pass (#3), FactoryCard chip tidy (#6),
      and a motion-timing audit (#7) — all cosmetic, none blocking.

## v82 — Device-specific manufacturing lines + a "nice to follow" stage stepper (DONE 2026-07-05)
User: "Add machines needed for specific devices — iPhone & iPad are the same machines but iPhone
and laptop are completely different. Also add a progress visual that's nice to follow like [the
In-production ring]."
- [x] **`engine/assemblyLine.ts` (PURE, +6 tests)** — per-category build recipes. `FAMILY_OF` maps
      each `CategoryId` to a `LineFamily`: phone+tablet share `slab`; laptop is `clamshell`;
      desktop+console `tower`; monitor `display`; wearable `wearable`; experimental falls back to
      slab. Each recipe is an ordered list of `LineStage`s (label/sub/icon-key + a `machineStage`
      0..4 that maps the step to the physical floor machine that lights up, so a recipe can name
      more sub-steps than there are machines without touching the 3D scene). A laptop's line
      (Sourcing → Chassis milling → Board & hinge → Keyboard & deck → Burn-in QA → Pack) is
      genuinely different from a phone's (Sourcing → Board press → Screen bond → QA → Pack).
- [x] **`StageTrail` stepper (BuildProgress.tsx + buildProgress.css)** — the whole pipeline as a
      row of icon nodes that fill left→right as the run progresses: done = quiet accent tint,
      active = accent-filled + soft pulse, todo = outlined. Device-specific (laptop shows 6 nodes,
      phone 5). Reduced-motion safe, `aria-label`/`aria-current`. Shown in the HQ "In production"
      card (under the ring) and in Factory Mode's Current Order card (scoped to read on the dark
      panel). Ring stage label + sub are now recipe-driven too.
- [x] **Generalised the stage logic off the universal 5-STAGE list** — `BuildProgress` and
      `FactoryMode` now call `stageForLine(category, frac)`; Factory3D's `stageIdx` comes from the
      active step's `machineStage`, so the correct machine still lights for any recipe length.
- [x] Verified live over two running runs (staged save, Chromium 430×900 dark): HQ card renders
      laptop=6 / phone=5 node trails with correct device-specific stage names ("Board & hinge" vs
      "Board press"); Factory Mode order card shows the same trail on the dark panel; 3D scene
      untouched; zero app errors. 728 tests (+5), tsc 0, build+PWA green.
- Note: literal per-category 3D machine *geometry* (a distinct chassis mill / keyboard station on
      the floor) stays out of scope — that's the gated F4 on-floor pass. This slice makes the build
      *process* device-specific and legible; the floor machines remain the shared 5.

## v83 — Factory 3D realism: machines on the belt, calm motion, smooth conveyor (DONE 2026-07-05)
User: machines should sit over/between the belts and move realistically; only animate when used;
belts should look symmetrical, smooth and higher-quality.
- [x] **Machines snap onto the belt** (`snapToBelt`): the press/QA/screen/mill straddle the line and
      the product runs through them; the packer folds around it; the intake feeds the head; the arm
      stands beside and reaches over. Each orients to the belt's heading.
- [x] **Starter floor** redesigned as a clean horseshoe with machines placed in stage order.
- [x] **Motion discipline**: a machine only animates while its own stage is the one being worked
      (`active && hot`); removed ambient idle sway/sweep so unused machines are perfectly still.
- [x] **Conveyor rebuilt**: one consistent bed (flush, symmetric joins), dark rubber surface framed
      by metal rails, polished seam rollers, and small painted chevrons pointing along the flow
      (replacing the chunky cones). Corners share the bed and curve the arrows.
- [x] Widened the portrait camera so the whole line frames.

## v84 — Per-device machines + the line ships from a dock pallet (DONE 2026-07-05)
User: "add machines needed for each device — assembly arm, screen machine, test machine and more";
"the conveyor must end at a pallet beside the truck".
- [x] **New machine kinds** `mill` (CNC Mill) + `screen` (Screen Bonder) added to MACHINE_DEFS (7
      kinds total: intake · mill · press · screen · arm · qa · packer), each with its own 3D rig —
      the mill's spindle traverses/plunges/spins; the screen bonder lowers a glowing panel and cures.
- [x] **Recipes route to machine kinds** (`LineStage.kind` replaces `machineStage`): a phone bonds a
      screen, a laptop mills a chassis, a monitor laminates a panel, etc. A machine lights + animates
      only when the current stage uses its kind — so for a phone the mill sits idle, for a laptop the
      screen bonder sits idle. Starter floor now seeds all seven machines in build order.
- [x] **The line ends at a dock**: a wooden pallet just past the belt tail (finished crates stack on
      it with the ready count) with the delivery truck behind it, both aimed along the tail's flow —
      so wherever the player routes the line, it ships from its end.
- [x] Build palette + minimap gained mill/screen tiles + tints. Verified live (phone → screen bonder
      glows; laptop → mill glows; others still). tsc 0, 729 tests, build+PWA green.

## v85 — Factory touch camera + build affordability (DONE 2026-07-05)
- [x] **Touch camera** (drei OrbitControls): one-finger drag orbits, pinch zooms; pan off, polar
      clamped above the floor, distance 8–32. Build placement now fires on a TAP (down+up, little
      movement) so drag-to-orbit never drops a machine. Recenter button in the top bar (CameraReset
      watches a bumped signal) + a one-time auto-fading "drag to look around · pinch to zoom" hint.
- [x] **Build palette**: tiles dim (warning-tinted price) when cash is short; machine tiles carry
      their blurb as a tooltip.

## v86 — Whole-game UX sweep (DONE 2026-07-05)
Audit-driven cosmetic pass over onboarding, HQ, Design Lab, Market (no gameplay changes).
- [x] **Touch targets → 44px**: Office/Factory world tabs, HQ Shop FAB + editor icon buttons,
      Design Lab tab strip + segmented options, onboarding scenario link.
- [x] **Token consistency**: hardcoded `#fff` → `var(--accent-ink)` on the world tab, HQ upgrade
      glyph, Design Lab category/region checks, Market open-region icon.
- [x] **Affordances/clarity**: Market valuation/share use Lucide TrendingUp/Down (not ▲/▼); #1
      rank shows a Crown; region-unlock reads "Unlock · $X" with a Globe; live product rows get a
      ChevronRight. Design Lab summary Market Fit shows the number (word moved to the label). HQ
      "Ready to launch" accessory shows a count; the first-run GetStartedCard is hidden while the
      Coach tutorial runs (was a duplicate checklist). Onboarding scenario link joins the stagger.

## v87 — Deeper industry + a real factory building you can repaint (DONE 2026-07-05)
- [x] **12 competitors** (was 6): added Zenith, Bytewave, Meridian, Corsa, Voltix, Nimbus with
      distinct bios/doctrines/caps so a fresh company starts dead last at #13. `bestIndustryRank`
      derives from `RIVALS.length`. Fixed the offline-catch-up test's rival freeze (it let the
      "refill the field" branch respawn challengers) — pure test isolation, no gameplay change.
- [x] **Factory building shell** (Factory3D): a poured-concrete floor with expansion joints and a
      painted safety border, inside low perimeter walls (skirting + capping rail) with the dock
      corner left open so the line ships to the truck. Machines rise above the walls; the camera
      sees in.
- [x] **Repaint / customise**: `factoryDecor { wall, floor }` state (+ setter, persistence backfill)
      drives the wall paint and floor finish from palettes. A new "Style" rail button opens a sheet
      of 6 wall + 5 floor swatches; picking one repaints the building live and saves. Escape now
      peels back one layer (sheet → build tool → mode) instead of closing everything.
- Left for a follow-up: placeable factory furniture/props (full decorate) and a floor-size expansion
      — larger features; the repaint is the first customisation slice.

## v88 — Factory decorate + floor expansion + richer office palette (A/B/C) (DONE 2026-07-05)
- [x] **A — placeable factory props**: `engine/factoryProps.ts` (PURE, +4 tests) catalog of 8 props
      (crates, barrels, pallet, planter, workbench, shelving, safety cone, hazard sign) with grid
      placement (empty cells only, half refund). State `factoryProps` + buyFactoryProp; Erase removes
      props. Factory3D renders each with parametric geometry. Build mode gained a Machines | Decor
      toggle; the Decor palette places props.
- [x] **B — buildable floor expansion**: `floorWidth(expansion)` widens the grid east (4 cols/bay,
      max 3 bays) with the origin fixed so existing layouts don't move; bound-checks take the width.
      State `factoryExpansion` + buyFloorExpansion (50k/150k/400k, capped). The concrete floor, walls,
      grid, tap-plane + camera framing all follow the wider building. "Expand the floor" row in the
      Style sheet. +test.
- [x] **C — richer office repaint**: doubled the office palettes — `WALL_STYLES` 5→10 (Sky, Sage,
      Blush, Ocean, Charcoal) and `FLOOR_FINISHES` 5→9 (Walnut, Slate, Marble, Moss), all reusing
      existing render kinds/patterns. (The office already carries 60+ placeable furniture pieces.)
- Verified live: props render + palette; floor widens with props placeable in the new bay + camera
      reframes; office renders new Walnut/Sage finish. tsc 0, 734 tests, build+PWA green.

## v89 — Make the factory matter + the line advances with your era (DONE 2026-07-06)
Four-part follow-up the player picked, in order. #1 + #2 landed:
- [x] **#1 — the factory matters** (commit 443a038): `factoryFloor.lineSpeedMult(floor)` — a pure,
      bounded build-time multiplier anchored so the starter (complete, single-arm) is exactly neutral
      (×1). A disconnected line costs time (×1.15); each extra assembly Arm parallelises the build
      (−5% each, −25% floor). `gameState.buildWeeksFor` multiplies assembly time by it. Factory HUD
      surfaces it — order-card chip + a Stats "Line build speed" row + teaching note. No RNG (pin holds). +test.
- [x] **#2 — more content on the line**: the working-machine glow now advances with the company's
      era, so the line visibly levels up as you grow — blue upstart → cyan → violet → gold titan.
      `Factory3D` threads a single `eraAccent(era)` through an `AccentContext` so every machine's
      hot-glow, status strip, press ram + QA scan sheet track the same era colour; `FactoryMode`
      passes `era={state.era}`. Verified live at Era 4 (violet accent renders on the line).
- Left: #3 office glow-up, #4 factory juice & progression. tsc 0, 735 tests, build+PWA green.

## v90 — Office glow-up: the team reads cleanly (#3) (DONE 2026-07-06)
- [x] **Non-overlapping staff labels**: a full team's floating name pills used to pile into an
      unreadable stack. Root cause: the de-clutter collided in raw world x/z, which missed same-row
      neighbours (desk pitch 1.95 > the old 1.7 threshold) and front/back labels sharing a screen
      column. Now collision is measured in PROJECTED screen-x (`labelU = 0.75·x − 0.66·z`, derived
      from the fixed office camera's right axis), so any two pills sharing a screen column ladder up
      one height level — a clean staircase. The Bank pill seeds the stack so names clear it too.
- [x] **Compact label pills**: single-line `dot · Name · role` chips (was a two-line badge) — narrower
      and shorter, so a full roster stays inside the card and pills clear one another with room to spare.
- Verified live: staged 7-person team renders as a readable ladder with no pile-up (was a solid
      overlap before). tsc 0, 735 tests, build+PWA green.

## v91 — Factory progression: build-milestone achievements (#4) (DONE 2026-07-06)
- [x] **Five factory achievements** wired into the existing PURE achievements engine — the hand-built
      line finally earns milestones: *Second Shift* (a 2nd assembly arm → parallel builds), *Breaking
      Ground* (first floor expansion), *Shop Floor Style* (5+ decor props), *Production Powerhouse*
      (a dozen machines), *Megafactory* (max floor). New `AchievementFacts` read the floor from
      GameState (expansion, props, machine + arm counts), tolerant of legacy saves.
- [x] All keyed ABOVE the starter defaults (complete single-arm 7-machine line, 0 props/expansions)
      so none auto-unlock at new-game — proven by a new deriveFacts test. They show as locked
      placeholders in the Progress hub and unlock on the weekly tick like every other milestone.
- +6 tests (5 predicate cases + a starter-floor guard). tsc 0, 741 tests, build+PWA green.

## v92 — First-run Factory tutorial (#4) (DONE 2026-07-06)
- [x] **FactoryTutorial**: a 4-step first-run coach shown the first time the player opens Factory mode
      — *Your production line* (material → machines → shipped flow), *Build the floor* (tap to place +
      touch camera), *A good line ships faster* (keep the belt connected, add arms → faster builds,
      ties to the v89 line-speed mechanic), *Make it yours* (Upgrades / Style / Expand). Mirrors the
      Decorate coach exactly — same `.dtut*` card styling, portal, step dots, Escape-to-close — so the
      two first-run coaches read as one system. Pure-vector visuals, no assets.
- [x] Gated on a new `settings.factoryTutorialSeen` (a UI pref, survives a new company). Auto-shows
      once; a **?** button in the Factory header replays it any time. The one-time camera hint is
      suppressed on that first open (the coach already teaches the gesture), and the mode's
      Escape-peel defers to the coach while it's open.
- Verified live: coach renders + dismisses to the floor, replay button works. tsc 0, 741 tests, build+PWA green.

## v93 — Save / name / switch factory layouts (#4) (DONE 2026-07-06)
- [x] **factoryLayout.ts** (PURE, +7 tests): the `FactoryLayout` snapshot type + `layoutApplyCost` —
      a fair, EXPLOIT-FREE diff cost to apply one layout over another. You pay full catalog price for
      whatever a layout adds and get the standard 50% demolition refund for whatever it drops; matching
      machines/props and belt cells (re-aiming is free) cost nothing. So there's no "save → tear down
      for the refund → re-apply free" loop — re-adding always costs full price (proven by a round-trip test).
- [x] **State** (+6 tests): `factoryLayouts` on GameState (persisted, backfilled). Reducers
      `saveFactoryLayout` (free, trims/defaults the name, capped at MAX_LAYOUTS=6), `applyFactoryLayout`
      (charges/refunds the diff + any new permanent expansions; cash-gated; floor only ever GROWS,
      never shrinks), `deleteFactoryLayout`, and `factoryLayoutCost`. Wired through useGame.
- [x] **UI**: a "Saved layouts" section in the Factory Style sheet — each row shows the name, machine
      count + saved week, an Apply button that surfaces the exact cost (or a "+refund" / free ✓ Apply),
      and a delete. A name field + "Save current" snapshots the floor.
- Verified: sheet opens, rows render with correct cost/refund (free apply for the identical layout,
      +$10.5K refund for a leaner one). tsc 0, 754 tests, build+PWA green.

## v94 — Audit sweep: fix factory + UX bugs found by a 3-agent review (DONE 2026-07-06)
A parallel audit (factory / economy / hooks) confirmed no crashes, save-corruption, softlocks, or
money exploits (the 40-seed sim agreed: 0 bankruptcies, no NaN). It surfaced these real defects, now fixed:
- [x] **Duplicate saved-layout ids (data corruption)**: ids derived from array length, so save A / save B /
      delete A / save C gave C the SAME id as B — delete removed both, apply resolved the wrong one, and
      React threw a duplicate-key warning. Now a monotonic `factoryLayoutCounter` (persisted + backfilled)
      sources ids. +regression test.
- [x] **Minimap clipped the expanded floor**: `FloorMinimap` hardcoded a 320×200 (16-col) viewBox, so any
      machine/belt in an expansion bay (cols ≥16) rendered off-canvas and vanished. The viewBox + grid now
      track the buildable width; all 3 call sites pass `floorW`. Verified: an arm placed at col 18 now shows.
- [x] **Build silently no-op'd without 3D**: placement is wired only to the 3D pad, so a no-WebGL /
      reduced-motion / 3D-off player could arm a Build tool that did nothing. The Build button now explains
      it needs the 3D view instead of arming a dead tool.
- [x] **Stacked Escape closed the factory under an overlay**: the offline/era/IPO overlays and Factory mode
      each listened on `window` for Escape, so one press over an open factory dismissed the overlay AND
      slammed the factory shut. A tiny `overlayGuard` lets the frontmost app overlay own Escape.
- [x] **Defensive hardening**: backfill clamps `factoryExpansion` to [0, MAX_EXPANSION] and coerces
      `bankrupt`; `expansionDeltaCost` clamps its loop bounds — so a corrupt/tampered save can't NaN or hang.
- Not changed (verified non-issues): layout apply-cost vs expansion nets out identically to the manual
      demolish+expand path (agent's "imprecision" flag was a false positive); offline bankruptcy is by design.
- tsc 0, 755 tests (+1), build+PWA green.

## v95 — Confirm step when applying a factory layout (#improvement) (DONE 2026-07-06)
- [x] Applying a saved layout replaces the WHOLE floor and can cost a fortune, but was a single blind
      tap. Now the first tap ARMS the row (accent ring) and shows the exact diff — "+N added · −M
      removed" (or "No changes") — with the button becoming "Confirm · $X" (or "· +refund"); only a
      second tap commits. Cancel (✕) or closing the sheet disarms it.
- [x] `factoryLayout.layoutDiff` (PURE, +1 test) counts added/removed pieces (machines+belts+props),
      ignoring matching cells — the same identity rule as the cost diff.
- Verified live: arming "Compact" showed "−2 removed" + "Confirm · +$10.5K". tsc 0, 756 tests, build+PWA green.

## v96 — Per-machine upgrades: tune the floor into a spend sink (#improvement 1/3) (DONE 2026-07-06)
- [x] **Engine** (`factoryFloor.ts`, +test): machines carry a `level` (1..`MACHINE_MAX_LEVEL`=3).
      `machineUpgradeStepCost` (0.75× then 1.25× base), `machineInvested`, `machineUpgradeCostAt`,
      `upgradeMachineAt`. `lineSpeedMult` now shaves ~2%/level (floor −45%); the starter is all level 1
      so it stays exactly ×1 — the 40-seed balance sim is byte-identical. `demolitionRefund` pays back
      half of TOTAL invested (base + upgrades).
- [x] **Layout economy** (`factoryLayout.ts`, +test): `layoutApplyCost` now prices upgrade-level deltas
      on matched machines (full for tune-ups, 50% back when less tuned; full invested for new machines)
      — so no layout can mint free upgrades.
- [x] **State + UI**: `upgradeFloorMachine` reducer (cash-gated, capped) + useGame wiring; an "Upgrade"
      build tool — tap a machine to tune it up. 3D floor shows **tier pips** (era-accent dots) over each
      upgraded machine, so investment is visible at a glance.
- Verified live: press→3 pips, arm/qa→2 pips; sim unchanged (0 bankruptcies). tsc 0, 759 tests (+3), build+PWA green.

## v97 — Line topology matters: cover the recipe or build slower (#improvement 2/3) (DONE 2026-07-06)
- [x] The device-specific machines were visual only. Now a product's recipe decides which machine
      KINDS the floor should have: `assemblyLine.requiredKindsFor(category)` + `lineSpeedMult(floor,
      requiredKinds)` — each required kind MISSING costs ~10% build time (capped +60%). A phone wants a
      screen bonder, a laptop a mill; the starter has every kind so it stays ×1 (sim byte-identical).
      `missingMachineKinds` + `buildWeeksFor` passes the current product's kinds.
- [x] **HUD** is product-aware: the order-card line chip now reads "Add Screen Bonder · N% slower" when
      the floor lacks a machine the current order needs (vs "Line broken" only when disconnected), and
      the Stats note names the missing machines. +topology tests.
- tsc 0, 760 tests (+1), balance sim unchanged, build+PWA green.
