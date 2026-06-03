# Silicon — Learnings & Locked Decisions

Seed these so no future session re-litigates them.

## LOCKED: Zero image assets for hero content
Devices, UI, icons are **parametric SVG / vector / glyphs drawn in code** — never raster
images, never AI-generated art. This guarantees consistency, kills AI-art stigma, removes
licensing risk, and turns the asset problem into a coding problem.
- Original native plan used SwiftUI `Shape`/`Canvas`. The web port uses **SVG** (and `<canvas>`
  only if an animation outgrows SVG). Same philosophy, same rules.
- If a future session proposes generating image assets, that violates this locked strategy.

## LOCKED: Platform reality — web stack, not native iOS
The original plan specified native SwiftUI/iOS 26/Xcode. Development happens on **Windows**,
where Swift/Xcode cannot run. We build on the owner's proven web stack (Vite + React + TS,
shipped to iOS via Capacitor — same approach as the "Goobler" project). The game design,
pillars, market sim, and monetization model are all preserved unchanged.

## LOCKED: Design system (build to these exact tokens)
Light theme: bg `#F4F5F7`, surface `#FFFFFF`, ink `#1A1D23`, ink-2 `#6B7280`,
hairline `#E5E7EB`, accent `#3B82F6`, positive `#10B981`, negative `#EF4444`,
warning `#F59E0B`.
Dark theme: bg `#0F1115`, surface `#1A1D23`, text `#F4F5F7`, same accents.
Device materials: plastic `#9CA3AF`; aluminium `#D1D5DB→#9CA3AF`; titanium `#A8A29E→#78716C`;
gold `#D4AF37`.
- 8-pt spacing scale: 4, 8, 12, 16, 24, 32, 48. Screen edge margin 20. Nothing arbitrary.
- Radius: button 12, card 16, sheet 24. Device bezels parametric (8–28 by era/tier).
- Type: system font stack (`-apple-system`/SF Pro). Tabular figures on ALL money/stats.
- Motion: spring-ish (response ~0.35, damping ~0.8). Count-up tweens on money/stats. Nothing snaps.
- Curated device colors only (8–10 harmonious swatches per finish) — NO freeform color wheel.

## LOCKED: DeviceStyle input→visual mapping (the make-or-break)
Materials tier → bodyFinish (matte→aluminium gradient→brushed titanium→gold glow) + edgeHighlight.
Display tier → bezelThickness (28pt→6pt, biggest "wow" lever) + screenInset + squircle radius +
screen glow. Camera count → 1–4 lens modules. Era → eraDetailLevel (chunky retro → sleek modern).
Squircle corners (continuous curvature), soft layered shadow (light top-left), subtle material
gradients (never flat dead metal), faint screen sheen. Crisp at hero AND thumbnail size.

## Money math
Money is integer **cents** (a branded number), never float dollars. Exact rounding, big-number
formatting ($1.23K / $4.56M / $7.89B / $1.2T). Avoids float drift across long sessions.

## Monetization (LOCKED)
$8.99 premium, complete & winnable with zero purchases. v1 IAP = Sandbox unlock only. DLC +
cosmetics scaffolded, content ships later. No gates/currency/boosts/ads. Enroll in Apple Small
Business Program (15% cut).

## LOCKED: Premium icons, never emojis
All UI glyphs use **Lucide** (`lucide-react`) vector icons — never emoji characters. Central
maps live in `src/design/icons.tsx` (`CategoryIcon`, `RoleIcon`); nav/HUD/buttons import Lucide
components directly. Owner preference ("always use lucide icons or something premium instead of
emojis"). Toast + EmptyState `glyph` props accept a `ReactNode` so icons pass through.

## HQ garage scene
`src/components/IsoScene.tsx` renders a detailed isometric **vector garage** (sectional door,
pegboard + tools, glowing monitors, 3D printer that animates while products sell, tool chest,
boxes, plant, pendant lamp) + a **4-desk startup workspace**. Grows with staff + facility tier.
Pure SVG.
- **Depth sorting:** all floor-standing objects (props + desk/chair/person sub-parts) are pushed
  into one `ents[]` array, each tagged with an isometric depth key `c + r`, then sorted
  back-to-front and rendered in order so nearer objects correctly occlude farther ones. Each
  desk is 3 depth layers (chair → person → desk+monitor) so people "tuck under" their desks.
  Walls/door/window/pegboard/light-pool draw first (background); the pendant lamp draws last
  (ceiling). Keep new floor objects in the sorted array, not as ad-hoc trailing JSX.
- **People:** seated figures (head/torso/arms) with subtle staggered CSS loops (typing/sway/
  head-turn) — all disabled under `prefers-reduced-motion` via the keyframes in `garage.css`.
  Progressive occupancy: founder always at desk 1; empty desks still render (chair + dark
  monitor) so the space never looks broken. Colors are all `--g-*` tokens (incl. `--g-p1..p4`).
- **Custom art hook:** set `HQ_CUSTOM_ASSET` (top of IsoScene.tsx) to a path in `public/hq/`
  (e.g. `/hq/garage.png`) to render the owner's own artwork in place of the vector scene.
  Default `null` = pure vector (no 404 noise). This is the sanctioned way to drop in a
  hand-made asset for the HQ backdrop without violating the zero-image rule for hero devices.

## Research Points economy + employees (v2)
- **RP** is the tech currency (`engine/research.ts`): generated weekly by staff assigned to R&D
  (engineers count more) + a founder trickle, scaled by an era multiplier. Tech tiers AND the 6
  company Research Projects cost RP. Cash stays for building/hiring/marketing/training.
- **Staff** have an `assignment` (rnd/design/marketing/idle) that determines what they contribute
  (`assignedSkill` = full if role matches the function, half otherwise — flexible redeploying).
  They earn weekly XP and auto-level `skill` (raising salary). Paid training = instant +1.
- **Manufacturing**: Design → `startBuild` (BuildJob, weeks set by rnd skill + Assembly Line) →
  `ready` shelf → `launchReady` (scoring happens at launch, so market timing matters).

## Staff are characters (identity system)
Each employee has a deterministic **identity** (`engine/staff.ts`): `appearance`
(skin/hair/hairColor/shirt/accessory), a `specialty` (a StatKey → flavor title like "Battery
Guru"), a `trait` (perfectionist/fastLearner/hustler/visionary/veteran/teamPlayer), and a
dynamic `mood` (0-100, drifts weekly + swings on hit/flop launches). Generated on hire/founder
from the seeded rng; old saves backfilled in `persistence.migrate` (seeded by id hash).
- **Effects** flow through one helper, `output(s) = skill × moodMult(mood) × traitOutputMult` —
  used by `assignedSkill` (economy) and `weeklyRp` (research). Plus: fastLearner → XP×1.5;
  perfectionist (on Design) → +1 design ceiling; visionary (on Marketing) → +hype; veteran →
  +1 skill at hire; teamPlayer → lifts others' mood; design specialists → build-time stat bonus
  (`productStats` in gameState, used by Design Lab preview AND launch).
- **One source of truth for looks:** the isometric figure (`IsoScene` Person) and the roster
  `Avatar` both read the same `appearance` + `mood`, so a person looks the same everywhere.
- Garage laptops face the seated person (we see the lid back + glow spill), not the viewer —
  if re-touching desks, keep the person at the desk's back edge facing out, laptop at the front.

## 3D HQ (react-three-fiber) — physics & perf decisions
`src/garage3d/` renders the HQ in real-time 3D (R3F + drei), lazy-loaded so three.js stays out
of the initial bundle; SVG `IsoScene` is the fallback (no-WebGL / reduce-motion / toggle off).
- **Laptops:** hinge at the FAR edge (camera side), lid near-vertical (slight recline), screen
  on the −z face toward the seated person, keyboard/trackpad on the deck. They always open
  toward the chair. If re-touching, keep the lid rotation small (~−0.28 rad), not reclined flat.
- **Physics:** I tried `@react-three/rapier` but its WASM init hung the (multi-instance) preview
  and is heavy for a tiny always-on background diorama. **Replaced with a hand-written ball-bin
  sim** (gravity + wall/ball collisions + damping integrated in `useFrame`, periodic nudge) —
  real physics, zero WASM, tiny cost, no hang. Rapier was uninstalled. Prefer this for small 3D
  toys; only reach for rapier if a scene genuinely needs a rigid-body engine.
- **Aliveness:** roaming robot vacuum, drifting instanced dust motes, swaying pendant lamp,
  breathing/idle characters, steaming mugs, animated printer. All `useFrame`, low-poly.
- **Perf:** DPR capped 1.75, no shadow maps (drei `ContactShadows` instead), render paused on
  `visibilitychange`, scene only mounts on the HQ tab.
- **Preview caveat:** the screenshot/eval tooling intermittently stalls on a continuously
  animating WebGL canvas — verify via `canvas` presence + console-error checks, not only shots.

## Balance: competition is a multiplier, not a subtraction (important)
`scoreLaunch` competition was a flat penalty that could drive a viable product's score to 0
(→ 0 sales), which made the early game feel broken. It's now a **share multiplier**
`1/(1 + competitorStrength*factorK)` so rivals reduce your share but never erase you, and the
sales `floorUnits` guarantees any shipped product sells something. If retuning competition,
keep it multiplicative.

## Tuned balance numbers
_(first pass — revisit with a fast-forward harness)_
- sales.scoreToVolume 36, floorUnits 140; reputation hit/flop 76/22, gain/loss 6/3;
  hype.base 0.9; competition.factorK 0.012; build.baseWeeks 3.
