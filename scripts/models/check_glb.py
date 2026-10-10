"""Check office/factory GLB models against scripts/models/manifest.json before they ship.

usage: python scripts/models/check_glb.py [model keys | .glb paths | key=path ...]   (default:
       every manifest entry whose file exists; key=path checks a file before it is put in place)
needs: pip install trimesh numpy

Per model: material names are exactly the allowed slots (and include the required ones); the
triangle count is inside the budget; it sits on the floor (min y ~ 0) and is centred on its
footprint; height / footprint are within tolerance of the spec; long pieces are oriented the way
the app places them; the robot ships its clips; no textures above 512 px; file size is sane.
Exit 1 on any failure so CI can gate on it.
"""
import json
import os
import struct
import sys

import numpy as np
import trimesh

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
MAX_KB = {"furniture": 200, "robot": 2000, "machine": 500, "factoryProp": 150, "vehicle": 400, "small": 100}


def glb_json(path):
    with open(path, "rb") as f:
        head = f.read(12)
        if len(head) < 12 or head[:4] != b"glTF":
            raise ValueError("not a binary glTF (.glb)")
        length, ctype = struct.unpack("<I4s", f.read(8))
        if ctype != b"JSON":
            raise ValueError("first chunk is not JSON")
        return json.loads(f.read(length))


def sha256(path):
    import hashlib
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def check(key, spec, manifest, path=None):
    errors, warnings = [], []
    path = path or os.path.join(ROOT, spec["file"])
    if manifest.get("legacy_sha256", {}).get(spec["file"]) == sha256(path):
        tris = sum(len(g.faces) for g in trimesh.load(path, force="scene").geometry.values())
        return [], ["legacy Kenney file (runtime-fitted); replace it to raise detail"], {"tris": tris, "legacy": True}
    try:
        doc = glb_json(path)
        scene = trimesh.load(path, force="scene")
    except Exception as e:  # unreadable file
        return [f"cannot read: {e}"], [], {}

    mats = sorted({m.get("name", "") for m in doc.get("materials", [])})
    allowed = set(spec["materials"])
    unknown = [m for m in mats if m.split("#")[0] not in allowed]
    if unknown:
        errors.append(f"materials not allowed for this model: {unknown} (allowed: {sorted(allowed)})")
    missing = [m for m in spec.get("required_materials", []) if m not in mats]
    if missing:
        errors.append(f"missing required materials: {missing}")

    tris = sum(len(g.faces) for g in scene.geometry.values())
    lo_t, hi_t = spec["triangles"]
    if tris > hi_t:
        errors.append(f"{tris} triangles, budget {lo_t}-{hi_t}")
    elif tris < lo_t * 0.5:
        warnings.append(f"only {tris} triangles (budget {lo_t}-{hi_t}); check detail")

    (x0, y0, z0), (x1, y1, z1) = scene.bounds
    size = np.array([x1 - x0, y1 - y0, z1 - z0])
    if doc.get("skins"):
        # Skinned bounds from the bind pose are not trustworthy (trimesh does not pose the rig);
        # the app fits the character to 1.7 m and grounds it anyway, so only report.
        warnings.append(f"skinned model: bind-pose bounds {size.round(2).tolist()} not checked; look at it in the viewer")
        size = np.array([0.0, 0.0, 0.0])
        y0 = cx = cz = 0.0
        spec = {**spec, "height_m": None, "footprint_m": None}
    if abs(y0) > max(0.02, size[1] * 0.02):
        errors.append(f"not on the floor: min y = {y0:.3f}")
    if not doc.get("skins"):
        cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    if abs(cx) > max(0.03, size[0] * 0.05) or abs(cz) > max(0.03, size[2] * 0.05):
        errors.append(f"pivot not centred on the footprint (centre x {cx:.2f}, z {cz:.2f})")

    tol = manifest.get("tolerance", 0.2)
    if spec.get("height_m"):
        h = spec["height_m"]
        if abs(size[1] - h) > h * tol:
            warnings.append(f"height {size[1]:.2f} m vs spec {h} m (the app refits, but proportions will be off)")
    if spec.get("footprint_m"):
        fw, fd = spec["footprint_m"]
        if size[0] > fw * (1 + tol) or size[2] > fd * (1 + tol):
            warnings.append(f"footprint {size[0]:.2f} x {size[2]:.2f} m exceeds {fw} x {fd} m (the app will shrink it)")
        # Orientation: a long piece must be long along x the way the app lays it on its cells.
        if fw > fd * 1.3 and size[0] < size[2]:
            errors.append(f"long side runs along z; it must run along x (footprint {fw} x {fd})")
    if spec.get("facing") == "+X" and size[0] < size[2]:
        errors.append("vehicle is shorter along x than z: its front must face +X")

    if spec.get("animations"):
        clips = [a.get("name", "") for a in doc.get("animations", [])]
        lacking = [c for c in spec["animations"] if c not in clips]
        if lacking:
            warnings.append(f"missing clips {lacking} (has {clips}); the app falls back to a procedural bob")

    images = doc.get("images", [])
    if images:
        warnings.append(f"{len(images)} embedded textures; flat-colour materials are the target")
    kb = os.path.getsize(path) / 1024
    if kb > MAX_KB.get(spec["class"], 500):
        errors.append(f"file is {kb:.0f} KB, max {MAX_KB.get(spec['class'], 500)} KB for a {spec['class']}")

    facts = {"tris": tris, "size_m": [round(float(v), 2) for v in size], "materials": mats, "kb": round(kb)}
    return errors, warnings, facts


def main():
    manifest = json.load(open(os.path.join(HERE, "manifest.json")))
    models = manifest["models"]
    picks = sys.argv[1:]
    overrides = {}
    for p in [p for p in picks if "=" in p]:  # key=path: check a file that is not in place yet
        k, v = p.split("=", 1)
        overrides[k] = os.path.abspath(v)
    picks = [p.split("=", 1)[0] for p in picks]
    if picks:
        by_file = {os.path.normpath(os.path.join(ROOT, s["file"])): k for k, s in models.items()}
        keys = [p if p in models else by_file.get(os.path.normpath(os.path.abspath(p))) for p in picks]
        bad = [p for p, k in zip(picks, keys) if k is None]
        if bad:
            print(f"not in manifest.json: {bad}")
            return 1
    else:
        keys = [k for k, s in models.items() if os.path.exists(os.path.join(ROOT, s["file"]))]
    if not keys:
        print("no manifest models present")
        return 0
    failed = 0
    for k in keys:
        errors, warnings, facts = check(k, models[k], manifest, overrides.get(k))
        print(f"{'FAIL' if errors else 'ok':4} {k} {json.dumps(facts)}")
        for e in errors:
            print(f"     error: {e}")
        for w in warnings:
            print(f"     warn:  {w}")
        failed += bool(errors)
    print(f"{len(keys) - failed}/{len(keys)} models pass")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
