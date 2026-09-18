# Office Overhaul — Phase 0 Audit & Implementation Map

**Date:** 2026-09-16
**Repo:** `Silicon-Tech-Tycoon` @ branch `feat/ui2-wave-0`
**Task:** rebuild/upgrade the 3D Company office to reference quality.

---

## The headline finding, up front

**The office is not primitive cubes.** It is an ~2,000-line isometric diorama with glTF furniture, a pooled material/geometry system, seated staff, procedural character animation, speech bubbles, tap interactions and a decorative shop — all already wired to real game state. The reference brief assumes a from-scratch rebuild; the actual job is **consolidation, data-driven configuration, and polish**, plus three genuine gaps (era visuals, quality settings, and a dead character-asset path).

That reframes every phase: most of the "build this" list already exists and must be **reused and refined, not replaced**. Rewriting it would be the single largest regression risk in this task.

---

## 1. Current technology

| Layer | Reality |
|---|---|
| Build | Vite 6 + React 19 + TypeScript 5.7, `tsc -b` |
| Tests | Vitest, **Node environment — no jsdom, no Testing-Library**. Logic is unit-tested; UI is verified by a Playwright capture harness (`npm run shots:diff`, `verify:ui2`, `verify:deeplink`, `audit:screens`) |
| 3D | `three` 0.184 + `@react-three/fiber` 9 + `@react-three/drei` 10 |
| Shell | Capacitor iOS (SPM-only), universal (iPhone + iPad) |
| State | `state/gameState.ts` — a large pure-ish reducer (advanceOneWeek + actions); `state/useGame.tsx` holds the external-store context (F36 split) |
| Monetization | Free + Silicon Pro; **no engine reads an entitlement** |
| Determinism | A pinned 160-week reproducibility test. Engine is pure; salts are registered in `CLAUDE.md` |

## 2. The 3D layer as it exists

| File | Size | Role |
|---|---|---|
| `src/garage3d/Garage3D.tsx` | 120 KB | The office scene: camera rig, room shell, characters, staff seating, vault/arcade, tap targets, celebration reactions |
| `src/garage3d/furniture3d.tsx` | 92 KB | The parametric furniture catalog (~86 items) |
| `src/garage3d/sharedGpu.ts` | 9.7 KB | **Pooled geometries + materials by full args** (the instancing/cache layer the brief asks for) |
| `src/garage3d/palette.ts` | 2.4 KB | **The material palette** (the brief's `MAT_*` families already exist here) |
| `src/garage3d/speechBubbles.tsx` | 8.2 KB | Deterministic, opt-out chatter (added recently) |
| `src/garage3d/officeLive.ts` | 2.6 KB | Derived-hash helpers: work-target pick, cosmetic rolls |
| `src/garage3d/gltfFurniture.tsx` / `furnitureModels.ts` | 8.3 KB | Lazy glTF furniture + the id→model registry, with parametric fallback |
| `src/garage3d/gltfRobot.tsx` / `robotModels.ts` | 7.5 KB | Rigged-robot renderer + a registry that **currently matches nothing** |
| `src/garage3d/support.ts` | 1.9 KB | WebGL capability, Reduced Motion, theme |
| `src/garage3d/IsoScene.tsx` | 20 KB | The **2D fallback** for no-WebGL / context loss |
| `src/components/Factory3D.tsx` | 114 KB | The separate factory scene (out of scope here) |

## 3. What already satisfies the brief

- **Room, walls, windows, floor, desks, chairs, monitors, plants, lounge, arcade, vault, server-ish props** — rendered today (see the captured frames).
- **Material families** — `palette.ts`; **geometry/material pooling** — `sharedGpu.ts`, pinned by `sharedGpu.test.ts`.
- **Characters** — parametric robots, seated at desks, with procedural idle/working/cheer on a derived schedule.
- **Zones** — the room already reads as work area + lounge + culture (arcade) + storage.
- **Interactions** — tapping staff opens the roster; the vault opens the Bank; the Bank chip is already a physical-anchored label, not a screen overlay.
- **Progression** — `facilityTier` grows the room and the rent; the player **places their own furniture** (`layout`, `PlacedItem[]`, persisted).
- **Camera** — an existing rig with idle drift, `still` (Reduce Motion) and a settle path.
- **Perf infrastructure** — DPR caps, pooled GPU objects, lazy chunks, a `demand`-capable frameloop, `visibilitychange` pause.
- **Save compatibility** — `layout`, `facilityTier`, `upgrades`, `roomStyle`, `desktops`, `furnitureCounter` are already persisted with backfills.

## 4. The genuine gaps (this is the real work)

1. **No data-driven visual configuration.** Era has *mechanics* (`engine/eras.ts`: `eraModifier`, `eraContext`) but **no visual config**; there is no `EraVisualConfig`, `OfficeTierConfig`, or equivalent. Appearance rules are scattered conditionals, which is exactly what the brief asks to end.
2. **No quality setting.** Nothing in `state/settings.ts` or `garage3d/support.ts` exposes LOW/HIGH. DPR caps are hardcoded (`[1,1.75]` HQ). The brief's LOW/HIGH requirement is unimplemented.
3. **The rigged-robot asset path is dead.** `robotModels.ts` globs `./models/robot_*.glb`; the directory holds only `base.glb`, so every character is parametric. There is no code fix — it needs a **robot asset pack**.
4. **The starter room is deliberately bare**, and it cannot be furnished freely because office furniture carries **simulation** effects (`attrs` → mood/RP/design; `officeZoneBonus` → category adjacency). One chair moved the pinned run's `researchPoints` 95 → 103. **Furnishing the starter is a simulation change, not an art change.**
5. **Interaction coverage is partial.** Bank/staff/vault exist; the brief's whiteboard→goals, server→research, prototype→products, entrance→expansion do not.
6. **No performance instrument.** The brief asks for a "measurable performance budget"; today there is a capture harness but no frame-rate probe in the app, and headless SwiftShader measures a software floor (23.8 fps), not a device figure.
7. **`Garage3D.tsx` at 120 KB** is the maintainability problem. Any serious work here should **extract** the controllers the brief names rather than grow it.

## 5. Architecture map — brief name → this repo

| Brief asks for | Where it belongs here |
|---|---|
| `OfficeScene` / renderer | `garage3d/Garage3D.tsx` (keep; **extract** from it) |
| `OfficeConfig` / `OfficeTierConfig` | **New** `garage3d/officeConfig.ts` — derive from `facilityTier` + `upgrades` + wealth |
| `EraVisualConfig` | **New** `garage3d/eraVisual.ts`, keyed off `eraContext(era)`; do **not** touch `engine/eras.ts` |
| `OfficeEmployeeController` | **New** `garage3d/employeeController.ts`; replace the inline seat/state logic in `Garage3D.tsx`, keeping `officeLive.ts`'s derived hashes |
| `OfficeInteractionController` | **New** `garage3d/interactions.ts`; generalise the existing tap targets |
| `OfficeCameraController` | Extract the existing camera rig from `Garage3D.tsx` |
| `OfficeLightingController` | **New** `garage3d/lighting.ts`; today lighting is inline |
| Material system | **Exists** — `palette.ts` + `sharedGpu.ts`; extend, do not replace |
| Quality settings | **New** `state/settings.ts` field + branch in `support.ts` |

**Hard rules for this work:** no `engine/` change (determinism is pinned), no new dependency, every new module pure or presentation-only, and the flag/classic paths must not regress.

## 6. Phase plan mapped to real files

| Phase | Files | Exit check |
|---|---|---|
| **0 Audit** | — | this document |
| **1 Foundation** | `officeConfig.ts`, `lighting.ts`, `palette.ts`, `Garage3D.tsx` | scene renders; captures unchanged in structure |
| **2 Hero environment** | `Garage3D.tsx` (room shell), `palette.ts` | composition reads; branding wall present |
| **3 Furniture** | `furniture3d.tsx`, `furnitureModels.ts`, `officeConfig.ts` | tier config selects pieces; no dropped catalog id |
| **4 Culture** | `furniture3d.tsx`, `officeConfig.ts` | lounge/coffee/arcade present |
| **5 Characters** | `employeeController.ts`, `officeLive.ts`, `Garage3D.tsx` | states deterministic; no overlap; capped count |
| **6 Progression** | `officeConfig.ts`, `eraVisual.ts` | every era × tier renders without error |
| **7 Interactions** | `interactions.ts`, `Garage3D.tsx` | each target routes to an existing screen; no duplicate nav |
| **8 UI** | `screens/Company.tsx`, `HeroFrame.tsx` | panels read real state only |
| **9 Performance** | `support.ts`, `settings.ts`, `Garage3D.tsx` | a measurable probe + LOW/HIGH |
| **10 Polish** | all of the above | no placeholder, no inconsistency |
| **11 Validation** | tests, harness, device | the definition-of-done list |

## 7. Definition of done — honest delta

Already true today: premium isometric office exists · real state drives it · employees inhabit it · workstations look intentional · lounge + arcade + storage exist · branding is integrated · interactions work (partially) · mobile layout works · saves work · tests/build pass.

**Genuinely missing, and therefore the work:** era → appearance · tier → configuration · LOW/HIGH quality · the character asset pack · full interaction coverage · a performance instrument · extraction of the four controllers from a 120 KB file.

## 8. Risks and the order that manages them

1. **Rewriting what exists** is the biggest risk. The correct method is extract-and-refine; a from-scratch scene would discard pooled GPU work, save-compatible layout data, and the determinism-safe derived hashes.
2. **Furnishing the starter moves the pinned simulation.** Treat as a deliberate, separate, reviewed change — never a side effect of an art pass.
3. **Lighting and shadows are the mobile budget.** `light-mode VSM` already doubles shadow cost (a known note in the repo). Any lighting phase must be measured on a device.
4. **The 120 KB file is the maintainability gate.** Phase 1's first real work should be extraction, or every later phase worsens it.

## 9. What I recommend doing first

**Phase 1 is an extraction, not a build:** pull the camera rig, lighting and interaction handlers out of `Garage3D.tsx` into the four controllers, prove the captures are unchanged, and *then* start the data-driven config. That gives every later phase a place to live and makes the safety property (nothing visual moved) easy to prove.
