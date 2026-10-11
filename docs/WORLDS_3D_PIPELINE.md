# Office + Factory — 3D model pipeline (Meshy + Blender + Claude)

> How the models in [`WORLDS_3D_MODEL_LIST.md`](WORLDS_3D_MODEL_LIST.md) get made: Meshy generates
> them, Claude cleans them up in Blender, a checker and the world shots prove each one before it
> ships. Steps 3–5 of [`WORLDS_3D_HANDOFF.md`](WORLDS_3D_HANDOFF.md). Written 2026-10-10.
>
> **Update 2026-10-11:** the office furniture is built without Meshy, procedurally in Blender by
> `scripts/models/build_furniture.py` (`blender --background --python scripts/models/build_furniture.py
> -- --preview .world-shots/furniture` also renders a review image per piece). Simple rounded forms
> are faster and more consistent this way; Meshy stays the route for organic or detailed models.

The popular "Claude + Blender MCP + Meshy + Unreal" recipe, changed where it doesn't fit Silicon:

| Generic step | For Silicon | Why |
|---|---|---|
| Connect Blender MCP + Meshy MCP | **Kept** (§1), plus the repo's scripts | — |
| Brainstorm 5 game ideas, pick one | **Lock the look** (§2): the robot first, from the portraits the game already ships | The game exists; style drift across ~50 models is the real risk. |
| Tell it your GPU, push graphics | **Budget for a phone browser** (§3): triangles, materials = draw calls, file size | It runs in WKWebView on iPhone through Capacitor, with up to three WebGL canvases alive. |
| Meshy makes props; Claude cleans in Blender | **Kept, made exact** (§4–§5): image-to-3D → `clean_model.py` → hand pass | Generated meshes come out wrong in size, facing, density and material names; the app re-finishes furniture by material name and tints the robot's `Main`. |
| Claude builds level, lighting, HUD in Unreal | **Drop into the app** (§6) | The worlds are React Three Fiber; level, lighting and HUD exist. Furniture and robots load by file name with code-built fallbacks — no code change. |

---

## 1. Setup (once, on the PC that runs Blender)

Run **Claude Code locally** on that PC, in this repo, so it reaches Blender's MCP server directly.

1. **Node** (repo's version) → `npm ci`, `npm run build`, `npm test` green.
2. **Blender 4.2+** (scripts tested on 5.0). Install the **blender-mcp** add-on (`addon.py`
   from the blender-mcp project), then N-panel → BlenderMCP → *Connect to Claude*. Install `uv`
   (`winget install astral-sh.uv`), then:
   ```bash
   claude mcp add blender -- uvx blender-mcp
   ```
3. **Meshy**: API key from meshy.ai (a paid plan, so the output may ship commercially). Add
   Meshy's MCP server per Meshy's docs, key in its environment; never commit the key:
   ```bash
   claude mcp add meshy --env MESHY_API_KEY=msy_... -- <command from Meshy's MCP docs>
   ```
4. **Python tools**: `py -3.11 -m pip install bpy trimesh numpy` (`bpy` needs exactly 3.11).
5. Check: `claude mcp list` shows both; `python scripts/models/check_glb.py` prints
   `23/23 models pass` (the shipped Kenney kit, reported as legacy).

## 2. Lock the look — the robot first

The concept art already exists and is approved: `public/art/redesign/robot-engineer.webp`,
`robot-designer.webp`, `robot-marketer.webp`. Use one as Meshy's **image-to-3D** input.

1. Image-to-3D from `robot-engineer.webp` (full body is not in the portrait: prompt for "full body,
   short legs, standing, same head and visor"). 2–3 variants; pick the closest.
2. `clean_model.py --model robot_shared` (static pass), then **rig** (Meshy's rigging if it
   suits, else Mixamo) with clips named exactly `Idle`, `Sitting`, `Walking`.
3. `clean_model.py --model robot_shared --materials-only --input rigged.fbx` → keeps the skeleton
   and clips, re-applies `Main`/`visor`/`eyes`/`joints`.
4. Drop at `src/garage3d/models/robot_shared.glb` → every employee uses it, tinted per slot
   (`robotModels.ts`); delete nothing — the code-built robot stays as the fallback.
5. Owner approves it in the world shots, beside the portraits. **Then** it is the style
   reference attached to every other Meshy prompt.

The style line for every prompt: *"premium stylised 3D game asset, soft rounded forms with
generous bevels, satin plastic and powder-coated metal, clean colour blocks, no text or logos,
no grime, 3/4 view, plain light background"*.

## 3. Budget for a phone browser

| Class | Triangles | Materials | File |
|---|---|---|---|
| Robot (≤ 16 on screen, skinned) | 3 000 – 8 000 | ≤ 4 | ≤ 2 MB |
| Furniture | 300 – 2 500 | ≤ 4 | ≤ 200 KB |
| Factory machine | 1 500 – 6 000 | ≤ 7 | ≤ 500 KB |
| Factory prop / small | 80 – 1 200 | ≤ 3 | ≤ 150 KB |
| Vehicle | 1 200 – 4 000 | ≤ 6 | ≤ 400 KB |

Context: today's Kenney pieces are 28–200 triangles, a dense factory measured 700 draws / 51 k
triangles in SwiftShader, and the office's DPR cap `[1, 1.75]` must not rise (Wave 7 rule). Each
material on a model is a draw call per instance, so material count matters more than triangles.
GLBs stay out of the PWA precache (`vite.config.ts` `globIgnores`) — keep new folders out too.

## 4. Generate (Meshy)

Per model, in the manifest's `priority` order:

1. **Concept**: the style line + the model's row in the model list (shape, real size, front
   direction) + *"colours: <its classify materials with hex from manifest.json palette>"*, with
   the approved robot render attached as style reference. 3–4 images; pick one.
2. **Image-to-3D** from it, low-poly / remesh near the budget top, triangles, **texture on**
   (the colours decide which material each face gets). 2 variants; keep the cleaner.
3. Save raw output in `art/models-raw/` (git-ignored) as `<key>_v<n>.glb`.

Rules that save regenerations: solid colour regions in the palette's colours (no gradients,
no dirt); no text or logos; machines with clearly separate moving parts (press ram, arm
segments, spindle) so the hand pass can split them into named nodes.

## 5. Clean (Blender, Claude via MCP)

**Automatic pass** — `scripts/models/clean_model.py` (run through the Blender MCP, or headless):

```bash
py -3.11 scripts/models/clean_model.py --input art/models-raw/furniture_desk_v2.glb \
    --model furniture_desk --yaw 90 --save-blend art/models-raw/furniture_desk.blend
```

Joins meshes, turns the front to the manifest axis (`--yaw`), applies transforms, gives every
face the nearest allowed material by sampling Meshy's texture, decimates to budget, scales to
`height_m` (else the footprint), pivots to the floor centre, drops textures, names the materials
exactly as the app expects, smooth-shades, and writes the manifest's `file`.

Find `--yaw` by importing once: in Blender (Z-up) the front must face **−Y** (glTF +Z); for
vehicles **+X**.

**Hand pass** — Claude through the Blender MCP, on the saved `.blend`:

- move faces the colour match got wrong to the right material (seat cushions to `carpet`,
  desk legs to `metal`, robot visor to `visor`);
- machines: split moving parts into **named nodes** the seam animates (`press-ram`,
  `mill-spindle`, `screen-head`, `qa-beam`, `packer-left`, `arm-yaw` → `arm-shoulder` →
  `arm-elbow` → `arm-wrist`), pivots at their hinge;
- keep desk tops clear (the app adds monitor/keyboard/mug at `surfaceHeight` 0.74 m) and open
  shelves open at the manifest's shelf heights (the app stocks them);
- bevel any edge that reads sharp; viewport screenshot (MCP) beside the concept;
- re-export: `clean_model.py --input <fixed>.blend --model <key>`.

## 6. Validate and drop in

```bash
py -3.11 scripts/models/check_glb.py              # every manifest model present in the repo
py -3.11 scripts/models/check_glb.py furniture_desk=art/models-raw/desk.glb   # before placing
```

Fails on any `.glb` in the model folders that the manifest doesn't list, wrong material names,
missing required materials, triangles outside the budget (either way), file size, pivot
off the floor centre, a long piece rotated the wrong way, a vehicle not facing +X; warns on size,
missing clips and textures. The **3D models** workflow runs it on PRs touching models.

Then:

```bash
npm run build && npm run shots:worlds -- after     # office + factory, light + dark
npm test                                           # palette/finish tests read the shipped GLBs
```

A model is done when:

- [ ] `check_glb.py` passes and `npm test` is green (`palette.test.ts`, `furnitureFinish.test.ts`
      read the shipped furniture GLBs: material names, sofa seat surface);
- [ ] it shows in the world shots at the right size and facing, **in both themes**;
- [ ] it reads as the same studio as the robot portraits;
- [ ] sitting still works (robots on chairs and sofas) and desk-top kit lands on the desk;
- [ ] draw calls stay in budget (`node scripts/probe-scenes.mjs` before/after).

Batch by world so each PR visibly moves one row of the world shots: robot → office hero
furniture → factory machines (after the seam) → truck and remaining furniture → props.

## 7. Files

| File | Role |
|---|---|
| `scripts/models/manifest.json` | Spec per model: file, class, footprint, height, triangle budget, allowed and classify materials, facing, clips, priority, palette; hashes of the shipped Kenney files. |
| `scripts/models/clean_model.py` | Blender cleanup + GLB export (static, `--materials-only` for rigged, `.blend` re-export). |
| `scripts/models/check_glb.py` | Validator (`pip install trimesh numpy`). |
| `.github/workflows/models-check.yml` | Runs the validator on model PRs. |
| `scripts/world-shots.mjs` (`npm run shots:worlds`) | Office + factory captures, both themes, compare page. |
| `public/furniture/<id>.glb` | Office furniture (registry `src/garage3d/furnitureModels.ts`). |
| `src/garage3d/models/robot_shared.glb` | The robot (`robotModels.ts`). |
| `public/factory/*.glb` | Factory models — **needs the seam** (handoff step 5). |

Tested end to end here on synthetic inputs: a generator-style textured desk (wrong axis, scale and
offset) came out as a passing `furniture_desk` (1 400 triangles, `wood` + `metal`, 1.11 × 0.74 ×
0.52 m); the rigged `base.glb` kept its skeleton and all 14 clips through `--materials-only`.
Not yet tested: a real Meshy export, and the results inside the running game.
