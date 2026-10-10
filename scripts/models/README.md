# 3D model tools (office + factory)

See [docs/WORLDS_3D_PIPELINE.md](../../docs/WORLDS_3D_PIPELINE.md).

- `manifest.json` — spec per model (file, size, triangle budget, material names, facing, clips); mirrors docs/WORLDS_3D_MODEL_LIST.md
- `clean_model.py` — generated GLB/FBX → game-ready GLB (Blender, or `pip install bpy` on Python 3.11)
- `check_glb.py` — validator (`pip install trimesh numpy`); CI: `.github/workflows/models-check.yml`
