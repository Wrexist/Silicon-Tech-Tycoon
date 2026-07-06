# Factory World — the 2.5D manufacturing floor

A second living world beside the office: an isometric factory floor that VISUALIZES the
manufacturing simulation the game already runs (factories, capacity, build jobs, overtime,
the ready shelf, trucks to market) — and, in later phases, grows into a factory-tycoon layer
of its own. Swapped from a tab beside the company name on the Office screen; can go
fullscreen for full immersion.

**Why this earns its place:** manufacturing is the game's most opaque system — you pay
tooling, a progress ring fills, a shelf appears. Every number already exists in state
(`building[]` with per-week progress, `factories.ts` capacity/overtime, `ready[]`,
`launched[]` selling curves, `ownedFactories` upkeep). The factory world makes the player's
production decisions *visible and felt*, the same trick the 3D office pulled for staff.

**Locked constraints (inherited, non-negotiable):** zero image assets — the whole world is
parametric SVG drawn in code (the IsoScene discipline, depth-sorted, `prefers-reduced-motion`
safe); DesignSystem tokens only; premium restraint; PROTECTED engine untouched until a phase
explicitly needs it (P4) and then only with measured balance passes.

---

## P1 — The living floor (read-only visualization) ✅ built this pass
- `src/components/FactoryScene.tsx` + `factoryScene.css`: isometric SVG factory —
  floor grid, back walls + windows, roof trusses, pendant industrial lights, a full
  **conveyor line** (rails, legs, animated tread) running through three stations
  (**robotic assembly arm** with idle articulation, **press stamper** with spark flash,
  **QA scan arch** with a sweeping beam), crates traveling the belt while a run is live,
  a **shipping dock** (pallet stacks sized by the ready shelf, a truck that idles while
  products are selling), steam vent, control panel with blinking LEDs, safety striping.
- Everything animates ONLY while the sim says so: belt + crates + arm run while
  `building.length > 0`; the truck bobs while anything is selling; idle floor dims the
  lights and shows a quiet "lines idle" hint. All keyframes disabled under reduced motion.
- **World tabs** beside the company name on the Office screen: `Office | Factory`
  (function-coloured, aria-pressed). The 3D office stays MOUNTED (hidden) when the factory
  is shown so its WebGL context survives, exactly like the cross-tab rule.
- **Fullscreen immersion**: an expand control opens the scene in a body-portal overlay —
  scene scaled to the viewport, close ✕ top-right (44px, safe-area aware), Escape closes.
- Status chips over the scene: factory name + contract/owned, runs in production,
  capacity utilisation (or "no ceiling"), ready-to-ship count.

## P2 — Deep detail & aliveness (presentational, no engine)
- **Per-stage choreography**: the belt's stations mirror the real `BuildProgress` stages
  (Sourcing → Tooling → Assembly → QA → Packaging) — the active stage's station lights up
  and works harder; crates accumulate at the packaging end as the run nears completion.
- **The product IS the toy, here too**: the device being built rides the belt — a small
  `DeviceRenderer` (foreignObject) on the lead crate, so a gold titanium flagship visibly
  rolls off ITS line.
- **Workers on the floor**: 1–2 figures from the same staff identity system (engineering
  assignees) at stations — one source of truth for looks, like IsoScene/3D.
- **Owned-factory pride**: owning lines (`ownedFactories`) adds a second belt / bigger
  building / signage per factory id; contract runs show the contractor's branding plate.
- **Overtime drama**: a run over capacity turns the floor amber — warning beacons spin,
  belt speeds up, steam doubles (the overtime surcharge made visceral).
- **Truck departures**: each weekly sales tick while fullscreen, the truck pulls out and a
  fresh one docks (loop tied to the week counter, not wall time).

## P3 — Interactivity (UI wiring, no engine)
- Tap a line → that build's detail (progress, run size, strategy, cancel-safety copy).
- Tap the dock/truck → the selling product's Market detail (reuses the launch-reveal
  deep-link hand-off pattern).
- Tap the signage → Company's Manufacturing lines section (buy/upgrade factories).
- Fullscreen HUD: a slim overlay strip with week + cash + speed controls so the player can
  Fast/Skip WITHOUT leaving immersion (SpeedDial already portal-friendly).
- Decorate-style camera nudge: subtle parallax on pointer, matching the office scene.

## P4 — Factory tycoon depth (ENGINE — needs go-ahead + measured balance passes)
The "simulate everything with the factory" ambition, phased so each slice is testable:
- **P4a Line scheduling**: multiple concurrent builds already exist; add per-factory line
  ASSIGNMENT (which owned factory runs which job) instead of per-product only — capacity
  becomes a real allocation puzzle. (`balance.factories`, harness-measured.)
- **P4b Maintenance & breakdowns**: owned lines accrue wear; a worn line slows or halts a
  run until serviced (cash sink + the supply-crunch event system gains a player-caused
  cousin). Event-driven, bounded, never bricks a run.
- **P4c Upgrade modules**: per-factory purchasable modules (robot arms −build time,
  QA cell +quality, solar roof −upkeep) rendered as physical additions to the floor —
  the office-upgrades pattern, factory-side.
- **P4d Contract manufacturing** (IDEAS.md #4): B2B orders consume line capacity for flat
  cash — the factory world is where offers dock (a client truck waits at the door).
- Each P4 slice: engine-first + tests + `npm run sim` measurement before UI, per v52+.

## Constant-improvement backlog (append here; do not act mid-session)
- Sound: a low conveyor hum + press thunk layered under the existing cue system (F-audio
  session, needs ears on device).
- Night shift: after era 3, the floor gets a second (visual) shift — lights change, pace
  reads faster (pure theming on era).
- Weather/window light matching the market climate season (climate.ts finally visible).
- Museum hook: a retired hit product's line plaque on the factory wall.
- Photo mode: fullscreen + hide chrome → screenshot-worthy result-card sibling.

## Verification discipline
P1–P3 are presentational: typecheck + full vitest + build gates, plus eyes-on-device for
animation timing (log NOT-verified flags in TASK.md, as always). P4 slices are engine work:
pure modules + tests + harness measurement, one slice per session.
