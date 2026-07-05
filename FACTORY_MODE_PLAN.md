# Factory Mode — full rebuild plan (top-down tile factory, from the reference guide)

Rebuilds the Factory tab as a **top-down 2D tile factory-management mode** matching the
supplied reference ("Deep Life Simulator — Factory Mode") identically in layout, information
architecture and feel: a pannable machine-and-conveyor map, Current Order + Factory Stats
panels, a right tool rail (Build / Upgrades / Research / Stats / Map), a raw-materials tray,
Boost, truck and Shop along the bottom. Supersedes FACTORY_WORLD_PLAN.md's side-view scene
(P1/P2 shipped there are salvage: the fullscreen shell, world tabs, stage strip, chips,
robots and status logic all carry over).

## 0. Reference → this codebase: what we keep, what we must translate

The reference's implementation notes assume a different product. Locked constraints
(DEV.md/LEARNINGS.md) force these translations — the LOOK survives all of them:

| Reference says | We do instead | Why |
|---|---|---|
| React Native / Expo + Redux | Existing Vite + React + `useGame` (Capacitor ships iOS) | Locked platform; a second stack is a rewrite of the whole game |
| PNG assets, 128×128 tiles | Parametric SVG machines/tiles drawn in code | LOCKED zero-image-assets rule; also themable light/dark for free |
| Firebase auth/cloud save | localStorage + native Preferences mirror (existing) | LOCKED fully-offline, no backend |
| Gems premium currency ③ | **Research Points** in that HUD slot | LOCKED no currency sales; RP is our real second currency |
| Rewarded ads / ×2-for-2h boost | **BOOST = the real overtime lever** on the active run (cash cost, real speed-up) | LOCKED no ads/boost sales; overtime already exists in the engine |
| Energy 75/100 ④ | **Line capacity meter** (weekly load vs factory capacity — already computed) | Energy has no sim meaning here; capacity is the honest equivalent |
| Player Level ① | Era badge + industry rank (existing progression) | No XP-level system exists and none is needed |
| Shop (gems) ⑭ | Machine & décor catalog bought with **cash** (furniture-shop pattern) | Premium-safe; mirrors the office Decorate shop |

Everything else in the image maps 1:1 to systems that already exist (details in §2).

## 1. Architecture & tech choices ("what to use")

- **Rendering: SVG tile map** (not canvas, not a game engine). A `<g>` world under a
  pan/zoom transform; each tile/machine a memoized component. The office Decorate builder
  already proves this interaction model (tap-to-place, drag, rotate, ghost validity) and the
  3D office proves pinch-zoom. ~13×9 visible tiles × light nodes is far below the furniture
  builder's proven budget. Canvas only if a later phase measures real jank.
- **Grid engine: generalize `engine/furniture.ts`'s PURE placement model** — footprint,
  rotation, bounds + overlap checks, world mapping, 6 tests — into a shared grid core used
  by a new **`engine/factoryFloor.ts`**: machine catalog (assembler, robot arm, press, QA
  cell, storage, charger…) + **conveyor tiles carrying a direction**, plus a pure
  `conveyorPaths(layout)` that chains directed tiles into polylines (feeds item flow + the
  animated arrows). Engine-pure, fully unit-tested, no React.
- **State**: `factoryLayout: PlacedMachine[]` + `conveyors: ConveyorTile[]` on GameState,
  reducers mirroring the furniture set (place/move/rotate/remove/reset + snapshot undo),
  persistence backfill to a hand-authored **starter factory** (the reference map's shape:
  a main loop, two machine clusters, storage corner, dock road).
- **Animation**: CSS keyframes for machines (the shipped arm/press/scan/AGV rigs port
  over); conveyor arrows = dashed-stroke offset per direction (shipped tread pattern);
  items traveling multi-segment paths = CSS `offset-path: path(...)` from
  `conveyorPaths()` polylines (pure CSS, reduced-motion killable; the one new technique —
  prototype it first in F2). Everything sim-gated exactly as today.
- **Layout shell**: the fullscreen portal from P1 becomes Factory Mode's primary surface;
  the compact card in the Office tab becomes a live **minimap preview** (same SVG, scaled,
  overlays hidden) that opens the mode. World tabs stay.
- **No new deps.** Pointer events + existing haptics/sfx/toast/Sheet primitives.

## 2. Screen spec — every numbered element in the reference, mapped

**Top bar** — ① era badge (level slot) · ② cash + `$/wk` flow (green, AnimatedMoney; the
reference's "+184K/min" becomes our real weekly flow) · ③ RP chip in the gems slot ·
④ capacity meter `75/100`-style bar (weekly load / line capacity; amber ≥100% = overtime),
its “+” opens the factory/capacity upgrade sheet · ⚙ settings.

**Left panels** (collapsible cards over the map, exactly as pictured):
- ⑤ **CURRENT ORDER**: lead BuildJob — DeviceRenderer thumb (the product IS the toy),
  name, units, progress bar, "Nd Nh left" (from weeks left × tick pace). Falls back to the
  next queued build, then a "plan production" CTA.
- ⑥ **FACTORY STATS**: Units/wk (active sales curves), Revenue/wk (`nextWeekRevenue`),
  Expenses/wk (`burn`), Profit/wk (green/red) — all existing selectors, per-week because
  that's the sim's real truth (no fake per-minute numbers).

**Right tool rail** (⑦–⑪, vertical icon buttons):
- ⑦ **Build** → placement mode: bottom machine palette (catalog tiles w/ cost), tap-to-place
  with green/red ghost, drag to move, rotate/remove toolbar — the Decorate UX verbatim.
- ⑧ **Upgrades** (red-dot badge when affordable) → the existing upgrade lines + factory
  modules sheet (Robotics chip from P2 moves in here).
- ⑨ **Research** → deep-link to the Research tab (one R&D hub rule — no duplicate tree).
- ⑪ **Stats** → factory charts sheet (existing Sparkline/StatBars).
- ⑪b **Map** → zoom-to-fit toggle + pan reset.

**Bottom strip**:
- ⑫ **RAW MATERIALS tray**: the six component kinds (chip/display/battery/materials/
  software/camera) with live counts = parts committed to active runs (plannedUnits ×
  remaining fraction). Read-only in F1–F3; becomes a real inventory only in F4.
- ⑬ **BOOST** (primary blue): applies the real **overtime capacity strategy** to the active
  run — costs cash, genuinely speeds the build, floor goes amber. Disabled when idle. The
  ×2/truck chips beside it: truck = ship-ready count (tap → launch), no timed boosts ever.
- ⑭ **SHOP**: machine + décor catalog (cash), search, categories — furniture-shop pattern.

**The map itself**: road-gray tile field with grass fringe (the reference's palette maps to
our tokens: Primary Blue→`--accent`, Success Green→`--positive`, Warning→`--warning`,
Danger→`--negative`, Dark BG→`--bg` dark theme; the mode is dark-first like the reference
but stays theme-correct), directional conveyor arrows, machines with soft shadows + status
LEDs, robot arms working the active stage (stage strip logic carries over), AGVs + a truck
driving the dock road, pallet stacks at storage. 16px paddings, 16px radii, Inter-stack
bold headers — already our design system.

## 3. Build phases (each = its own session, gates green, screenshot-verified)

- **F1 — Mode shell + HUD parity (M)**: fullscreen Factory Mode layout with top bar, left
  panels, right rail (Build disabled "soon"), bottom strip wired to real data (order,
  stats, capacity, materials, BOOST=overtime, truck, shop sheet listing-only); static
  starter map rendered read-only from the authored layout. Compact card → minimap.
- **F2 — Tile engine + Build mode (L)**: `engine/factoryFloor.ts` (+tests) generalized from
  furniture.ts; place/move/rotate/remove machines & conveyor tiles with ghost validity;
  pan/zoom; persistence + starter-layout backfill; `offset-path` item-flow prototype.
- **F3 — The living factory (M/L)**: items flow along player-built conveyor paths between
  machines per the real build stage; arms/press/QA rigs animate at their machines; AGVs
  patrol; truck departs on weekly sell ticks; overtime mood; idle state.
- **F4 — It PLAYS (engine, needs go-ahead + `npm run sim` measurement)**: placed machines
  grant bounded real capacity/speed (`balance.factoryFloor`, feeds the existing
  capacityPlan), machine costs + weekly upkeep as real cash sinks, materials tray becomes a
  true parts inventory fed by suppliers. One measured slice at a time, per v52 discipline.
- **F5 — Polish**: conveyor hum + machine thunks (on-device audio session), night shift,
  photo mode, minimap ping when the order completes.

## 4. Risks & honest calls
- `offset-path` on SVG children in WKWebView needs the F2 prototype spike FIRST; fallback
  is per-segment CSS like today's crates (visually near-identical for loop layouts).
- The reference's per-minute economics would be fake here; per-week keeps pillar #5
  (readable sim). Same reason BOOST is overtime, not a purchased multiplier.
- Full identical parity including gems/ads/energy is deliberately impossible under the
  locked monetization rules — the substitutions above keep the exact layout with honest
  mechanics. Flagged rather than smuggled in.
