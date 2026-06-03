# Robot character models — drop `.glb` files here

This folder is the **drop-in seam** for AI-generated 3D robot characters. The scene
auto-discovers any `.glb` you put here (via `import.meta.glob` in `../robotModels.ts`) —
**no code edits needed**. Until a file exists for a colour, that robot renders with the
hand-built parametric look (`RobotCharacter` in `../Garage3D.tsx`) as an automatic fallback.

## Naming convention (required)

Name each file `robot_<colour>.glb`, lowercase. The colour maps to the scene's `ROBOT_COLORS`:

| File | Used for |
|------|----------|
| `robot_blue.glb`   | colour index 0 (founder / desk 01) |
| `robot_orange.glb` | colour index 1 (near whiteboard) |
| `robot_green.glb`  | colour index 2 (centre of room) |
| `robot_purple.glb` | colour index 3 (near kanban wall) |
| `robot_yellow.glb` | colour index 4 (near security gate) |

## How to make them (on your Mac — the build env can't run these)

1. **Meshy.ai** → *Image-to-3D* (upload the reference) or *Text-to-3D*. Prompt:
   > Cute rounded robot, solid `<colour>` body, small glowing eyes, stubby arms,
   > smooth matte plastic, standing pose, isometric game character style
   Export as **`.glb`** (NOT `.usdz` — this is a web/Three.js app, not SceneKit).
2. **Mixamo** *(optional, for animation)* → auto-rig the model, bake an **`Idle`**,
   **`Sitting`**, and/or **`Walking`** clip, re-export as **glTF Binary (`.glb`)**.
   The scene plays a clip named `Idle` on roaming robots and `Sitting` at desks if present;
   otherwise it plays the first clip, or stays static if the model has none.
3. Drop the file here with the right name. Done — it appears on the next dev reload / build.

## Keep it simple

- **Single solid colour per robot, no texture maps.** Matches the reference aesthetic and
  sidesteps ~80% of conversion gotchas.
- Models are auto-scaled to ~1.5 m tall and grounded on the floor, so exact source scale
  doesn't matter. Fine-tune orientation in `../Garage3D.tsx` (the `rotation-y` on each robot).
- Only ship CC0 / permissively-licensed or self-generated assets in a shipping app.
