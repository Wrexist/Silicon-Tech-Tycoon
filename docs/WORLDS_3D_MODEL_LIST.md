# Office + Factory — 3D model list

> Every model the two 3D worlds need to reach the target look, with the numbers the code
> expects. Machine-readable twin: [`scripts/models/manifest.json`](../scripts/models/manifest.json)
> (keep the two in sync). How to make them: [`WORLDS_3D_PIPELINE.md`](WORLDS_3D_PIPELINE.md).
> Written 2026-10-10.

## 0. Rules for every model

### The look

The target is the approved character art already in the game,
`public/art/redesign/robot-*.webp` and `research-*.webp`: **premium, approachable, stylised 3D** —
soft rounded forms with generous bevels, satin plastic and powder-coated metal, a few clean
colour blocks, no grime, no tiny noisy detail, no text. Everything in the office and the factory
should look like it came out of the same studio as those portraits.

- **Rounded.** Bevel every edge (1–3 cm on props, 3–8 cm on furniture and machines). The bevel
  catching the key light is most of the "premium" read at phone size.
- **Few materials, flat colour.** Each model uses only the named materials below; colour comes
  from the material, not a texture. The app re-finishes furniture by family and tints the robot,
  so exact albedo values matter less than putting each part in the right material.
- **Every material is a draw call** on mobile WebGL: furniture ≤ 4 materials, machines ≤ 7,
  props ≤ 3, the robot ≤ 4.
- **No textures, no baked lighting/AO, no lights or cameras** in the file.
- **No real brands**, logos or product names (repo IP rule). Signage text is drawn by the app.

### Format, axes, pivot

| | |
|---|---|
| Format | **GLB** (binary glTF 2.0). Not USDZ — this is a three.js app. |
| Units | metres |
| Up | +Y |
| Front | **+Z** for furniture, machines and props (a desk's user side; a machine's belt side); **+X** for vehicles. In Blender (Z-up) that is **−Y** for +Z, and +X stays +X. |
| Pivot | centre of the footprint, on the floor (min y = 0) |
| Fit | the app fits furniture to `height_m` and 92 % of its cells (office cell 0.86 m); the robot to 1.7 m; factory pieces to their cells (factory cell 1 m). Model at real size anyway — proportions are what survive the fit. |

### Material names

Office furniture — the names the app maps to finish families (`src/garage3d/materialFamilies.ts`):

| Name | Family / finish | Use |
|---|---|---|
| `wood` | wood → pale oak `#cbb38e` | desk tops, table tops, frames |
| `woodDark` | wood → `#9b8568` | shelving, darker timber, pots |
| `metal` | metal → aluminium | legs, frames, lamp stems |
| `metalMedium` | metal → graphite | chair bases, dark hardware |
| `carpet` / `carpetBlue` / `carpetDarker` | fabric → muted blue / lighter blue / graphite | upholstery, rugs, chair seats |
| `plant` | foliage → `#41674e` | leaves |
| `lamp` | glow (emissive) | shades, bulbs, screens on the TV stand |
| `_defaultMat` | neutral → paper | white/off-white parts |

Every `.glb` in `public/furniture`, `public/factory` and `src/garage3d/models` must be listed in
the manifest (the checker fails unlisted files; `base.glb` is ignored with a reason).

Any other name falls back to the neutral family and fails `palette.test.ts` — add it to
`MATERIAL_FAMILY_BY_NAME` and the test's list together if a new one is truly needed.

Robot: `Main` (the shell — tinted per employee: blue/orange/green/purple/yellow), `visor` (dark
navy glass face panel), `eyes` (white ovals), `joints` (matte white). Only `Main` is tinted.

Factory (the names the new factory seam will map to the `C` palette in `Factory3D.tsx`; see the
handoff, step 5): `body`, `bodyHi`, `dark`, `metal`, `rubber`, `accent` (takes the era colour),
`hazard`, `glass`, `screen`, `crate`, `white`, `led` (andon strip, emissive).


## 1. Robot (the hero)

| Key | File | Footprint m (x × z) | Height m | Triangles | Front | Materials | Notes |
|---|---|---|---|---|---|---|---|
| `robot_shared` | `src/garage3d/models/robot_shared.glb` | — | 1.7 | 3,000–8,000 | +Z | `Main`, `visor`, `eyes`, `joints` | THE hero model: the robot in public/art/redesign/robot-*.webp. Material `Main` is the shell and is tinted per employee; everything else keeps its authored colour. Rig + clips Idle/Sitting/Walking (Mixamo-style). Sits on a 0.58 m seat. |
| `robot_<colour>` | `src/garage3d/models/robot_{blue,orange,green,purple,yellow}.glb` | — | 1.7 | 3,000–8,000 | +Z | `Main`, `visor`, `eyes`, `joints` | Optional per-colour variants that keep their own colours (no tint) and override `robot_shared` for that slot. Only if one shared model cannot carry the look. |

## 2. Office furniture

| Key | File | Footprint m (x × z) | Height m | Triangles | Front | Materials | Notes |
|---|---|---|---|---|---|---|---|
| `furniture_desk` | `public/furniture/desk.glb` | 1.58 × 0.79 | 0.74 | 300–2,500 | +Z | `wood`, `metal`, `_defaultMat` | Work surface 0.74 m; user side +Z, the monitor rests on the back edge (−Z). Must leave the top clear: the app adds monitor/keyboard/mug. |
| `furniture_deskL` | `public/furniture/deskL.glb` | 1.58 × 1.58 | 0.74 | 300–2,500 | +Z | `wood`, `metal`, `_defaultMat` | Corner desk, user side +Z. |
| `furniture_chair` | `public/furniture/chair.glb` | 0.79 × 0.79 | 0.95 | 300–2,500 | +Z | `metalMedium`, `carpetDarker`, `metal` | Office chair, seat top 0.58 m (robots sit on it), faces +Z. |
| `furniture_armchair` | `public/furniture/armchair.glb` | 0.79 × 0.79 | 0.78 | 300–2,500 | +Z | `carpet`, `wood`, `metal` | Faces +Z. |
| `furniture_loungeChair` | `public/furniture/loungeChair.glb` | 0.79 × 0.79 | 0.8 | 300–2,500 | +Z | `carpet`, `wood`, `metal` | Faces +Z. |
| `furniture_sofa` | `public/furniture/sofa.glb` | 1.58 × 0.79 | 0.82 | 300–2,500 | +Z | `carpet`, `carpetBlue`, `wood`, `metal` | Two-seat sofa facing +Z; cushion top = 0.5 of height (seatSurfaceFraction). |
| `furniture_sofaL` | `public/furniture/sofaL.glb` | 1.58 × 1.58 | 0.82 | 300–2,500 | +Z | `carpet`, `carpetBlue`, `wood`, `metal` | Sectional, faces +Z. |
| `furniture_stool` | `public/furniture/stool.glb` | 0.79 × 0.79 | 0.55 | 300–2,500 | +Z | `wood`, `metal` |  |
| `furniture_coffeeTable` | `public/furniture/coffeeTable.glb` | 1.58 × 0.79 | 0.42 | 300–2,500 | +Z | `wood`, `metal` |  |
| `furniture_meetingTable` | `public/furniture/meetingTable.glb` | 2.37 × 1.58 | 0.74 | 300–2,500 | +Z | `wood`, `metal` |  |
| `furniture_sideTable` | `public/furniture/sideTable.glb` | 0.79 × 0.79 | 0.55 | 300–2,500 | +Z | `wood`, `metal` |  |
| `furniture_bookshelf` | `public/furniture/bookshelf.glb` | 0.79 × 0.79 | 1.8 | 300–2,500 | +Z | `wood`, `woodDark` | Open shelf; shelf tops at 0.15/0.425/0.7 of height (app stocks them with books). Back against −Z. |
| `furniture_cabinet` | `public/furniture/cabinet.glb` | 1.58 × 0.79 | 0.9 | 300–2,500 | +Z | `wood`, `woodDark`, `metal` | Closed storage, doors face +Z. |
| `furniture_shelfUnit` | `public/furniture/shelfUnit.glb` | 0.79 × 0.79 | 1.8 | 300–2,500 | +Z | `wood`, `woodDark` | Open shelf; one shelf top at 0.325 of height. |
| `furniture_crates` | `public/furniture/crates.glb` | 0.79 × 0.79 | 0.6 | 300–2,500 | +Z | `woodDark`, `_defaultMat` |  |
| `furniture_plantTall` | `public/furniture/plantTall.glb` | 0.79 × 0.79 | 1.45 | 300–2,500 | +Z | `plant`, `woodDark`, `_defaultMat` | Pot in a warm grey (wood on plant pots is re-finished warmGrey). |
| `furniture_plantPot` | `public/furniture/plantPot.glb` | 0.79 × 0.79 | 0.5 | 300–2,500 | +Z | `plant`, `woodDark`, `_defaultMat` |  |
| `furniture_rug` | `public/furniture/rug.glb` | 2.37 × 1.58 | — | 24–800 | +Z | `carpet`, `carpetBlue` | Flat, ≤ 2 cm tall. |
| `furniture_rugRound` | `public/furniture/rugRound.glb` | 1.58 × 1.58 | — | 24–800 | +Z | `carpet`, `carpetBlue` | Flat, ≤ 2 cm tall. |
| `furniture_tvStand` | `public/furniture/tvStand.glb` | 1.58 × 0.79 | 0.5 | 300–2,500 | +Z | `wood`, `metalMedium`, `lamp` | Low stand; screen faces +Z. |
| `furniture_floorLamp` | `public/furniture/floorLamp.glb` | 0.79 × 0.79 | 1.6 | 300–2,500 | +Z | `metal`, `metalMedium`, `lamp` | Shade material `lamp` glows. |
| `furniture_arcLamp` | `public/furniture/arcLamp.glb` | 0.79 × 0.79 | 1.9 | 300–2,500 | +Z | `metal`, `metalMedium`, `lamp` |  |
| `furniture_lantern` | `public/furniture/lantern.glb` | 0.79 × 0.79 | 0.4 | 300–2,500 | +Z | `metal`, `lamp` |  |

## 3. Factory machines

| Key | File | Footprint m (x × z) | Height m | Triangles | Front | Materials | Notes |
|---|---|---|---|---|---|---|---|
| `machine_intake` | `public/factory/machine_intake.glb` | 1.92 × 1.92 | — | 1,500–6,000 | +Z | `body`, `bodyHi`, `dark`, `metal`, `accent`, `glass`, `screen`, `hazard`, `led`, `rubber` | Hopper; the feed chute ends over the adjacent belt cell. Belt side is +Z. Moving parts are separate named nodes (the app animates them); `accent` takes the era colour, `led` is the andon strip. |
| `machine_mill` | `public/factory/machine_mill.glb` | 1.92 × 1.92 | — | 1,500–6,000 | +Z | `body`, `bodyHi`, `dark`, `metal`, `accent`, `glass`, `screen`, `hazard`, `led`, `rubber` | Service cabinet + mast + boom stay on the footprint; the spindle head (node `mill-spindle`) travels over the belt. Belt side is +Z. Moving parts are separate named nodes (the app animates them); `accent` takes the era colour, `led` is the andon strip. |
| `machine_press` | `public/factory/machine_press.glb` | 2.88 × 1.92 | — | 1,500–6,000 | +Z | `body`, `bodyHi`, `dark`, `metal`, `accent`, `glass`, `screen`, `hazard`, `led`, `rubber` | Gantry press, 3×2; the ram (node `press-ram`) moves down onto the belt. Belt side is +Z. Moving parts are separate named nodes (the app animates them); `accent` takes the era colour, `led` is the andon strip. |
| `machine_screen` | `public/factory/machine_screen.glb` | 1.92 × 1.92 | — | 1,500–6,000 | +Z | `body`, `bodyHi`, `dark`, `metal`, `accent`, `glass`, `screen`, `hazard`, `led`, `rubber` | Screen bonder; head node `screen-head` over the belt. Belt side is +Z. Moving parts are separate named nodes (the app animates them); `accent` takes the era colour, `led` is the andon strip. |
| `machine_arm` | `public/factory/machine_arm.glb` | 1.92 × 1.92 | — | 1,500–6,000 | +Z | `body`, `bodyHi`, `dark`, `metal`, `accent`, `glass`, `screen`, `hazard`, `led`, `rubber` | Robot cell; base yaw node `arm-yaw`; shoulder/elbow/wrist as child nodes `arm-shoulder`, `arm-elbow`, `arm-wrist` (new names the seam will animate). Offset 0.55 towards its belt mount. Belt side is +Z. Moving parts are separate named nodes (the app animates them); `accent` takes the era colour, `led` is the andon strip. |
| `machine_qa` | `public/factory/machine_qa.glb` | 1.92 × 1.92 | — | 1,500–6,000 | +Z | `body`, `bodyHi`, `dark`, `metal`, `accent`, `glass`, `screen`, `hazard`, `led`, `rubber` | Test tunnel arch over the belt; scanning beam node `qa-beam`. Belt side is +Z. Moving parts are separate named nodes (the app animates them); `accent` takes the era colour, `led` is the andon strip. |
| `machine_packer` | `public/factory/machine_packer.glb` | 1.92 × 1.92 | — | 1,500–6,000 | +Z | `body`, `bodyHi`, `dark`, `metal`, `accent`, `glass`, `screen`, `hazard`, `led`, `rubber` | Packing station; flap node `packer-left` (and a mirrored `packer-right` if the model has two flaps). Belt side is +Z. Moving parts are separate named nodes (the app animates them); `accent` takes the era colour, `led` is the andon strip. |

## 4. Factory vehicles and dock

| Key | File | Footprint m (x × z) | Height m | Triangles | Front | Materials | Notes |
|---|---|---|---|---|---|---|---|
| `vehicle_truck` | `public/factory/vehicle_truck.glb` | 5.6 × 2.2 | 2.6 | 1,200–4,000 | +X | `white`, `accent`, `dark`, `glass`, `rubber`, `metal` | Box truck at the dock (app places it yaw −π/2). Cab front +X like a vehicle; cab in `accent`. |
| `vehicle_agv` | `public/factory/vehicle_agv.glb` | 0.9 × 0.6 | 0.35 | 1,200–4,000 | +X | `accent`, `dark`, `rubber`, `led` |  |
| `prop_dockPallet` | `public/factory/prop_dockPallet.glb` | 1.1 × 1.1 | 0.15 | 80–600 | +Z | `crate` |  |

## 5. Factory decor props

| Key | File | Footprint m (x × z) | Height m | Triangles | Front | Materials | Notes |
|---|---|---|---|---|---|---|---|
| `prop_crates` | `public/factory/prop_crates.glb` | 0.92 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_barrel` | `public/factory/prop_barrel.glb` | 0.92 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_pallet` | `public/factory/prop_pallet.glb` | 0.92 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_plant` | `public/factory/prop_plant.glb` | 0.92 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_bench` | `public/factory/prop_bench.glb` | 1.84 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_rack` | `public/factory/prop_rack.glb` | 1.84 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_cone` | `public/factory/prop_cone.glb` | 0.92 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_sign` | `public/factory/prop_sign.glb` | 0.92 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_hazardStripe` | `public/factory/prop_hazardStripe.glb` | 0.92 × 0.92 | — | 12–400 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_extinguisher` | `public/factory/prop_extinguisher.glb` | 0.92 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_bollards` | `public/factory/prop_bollards.glb` | 0.92 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_fan` | `public/factory/prop_fan.glb` | 0.92 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_workLight` | `public/factory/prop_workLight.glb` | 0.92 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_tote` | `public/factory/prop_tote.glb` | 0.92 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_compressor` | `public/factory/prop_compressor.glb` | 0.92 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_toolWall` | `public/factory/prop_toolWall.glb` | 1.84 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_qcStation` | `public/factory/prop_qcStation.glb` | 1.84 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |
| `prop_gantry` | `public/factory/prop_gantry.glb` | 2.7600000000000002 × 0.92 | — | 100–1,200 | +Z | `body`, `dark`, `metal`, `hazard`, `crate`, `rubber`, `glass`, `led`, `white`, `accent` |  |

## 6. Priority order

Biggest visible difference first:

1. `robot_shared` — on screen in every office frame and soon the factory floor; the portraits
   already define it.
2. Office hero furniture: `furniture_desk`, `furniture_chair`, `furniture_sofa`,
   `furniture_bookshelf`, `furniture_plantTall`, `furniture_meetingTable`.
3. Factory machines (needs the factory GLB seam first): `machine_arm`, `machine_press`,
   `machine_qa`, `machine_mill`, `machine_screen`, `machine_packer`, `machine_intake`.
4. `vehicle_truck`, the rest of the office furniture.
5. Factory decor props, `vehicle_agv`, `prop_dockPallet`.

## 7. Keep code-built

Room shells and walls (`room.tsx`, `FactoryShell`), belts and rollers (instanced — a GLB per tile
would cost hundreds of draw calls), floor grids and decals, desk-top kit (monitor, keyboard, mug),
the shelf books, glow pools, speech bubbles, the brand wall and every canvas-texture sign.
