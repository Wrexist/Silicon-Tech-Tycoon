"""Turn a generated model (Meshy GLB/FBX/OBJ) into a game-ready GLB for the office or factory.

Runs inside Blender (tested with the `bpy` 5.0 module on Python 3.11). Three ways to call it:

    blender --background --python scripts/models/clean_model.py -- --input raw/desk_v2.glb --model furniture_desk
    py -3.11 scripts/models/clean_model.py --input raw/desk_v2.glb --model furniture_desk     # pip install bpy
    # from the Blender MCP: run this file with sys.argv set the same way

Static models (furniture, machines, props, vehicles), in order:
 1. import into an empty scene, join every mesh, turn it (`--yaw`, degrees about up) so the front
    faces the manifest's `facing` axis, apply transforms;
 2. give every face the nearest ALLOWED material for this model (manifest.json `materials`),
    sampling the generator's texture, smoothed over neighbouring faces;
 3. decimate to the triangle budget;
 4. scale to the real size (height_m, else the footprint) and put the pivot at the centre of the
    footprint on the floor;
 5. drop every texture; one flat material per slot, named exactly as the app expects (`wood`,
    `metalMedium`, `Main`, `accent`, ...);
 6. smooth-shade by angle and export the GLB (+Y up, metres) to the manifest's `file`.

Rigged characters (the robot): run the static pass BEFORE rigging, rig in Mixamo, then
`--materials-only --input rigged.fbx` re-applies the material names and exports the GLB with its
skeleton and clips (Idle / Sitting / Walking) untouched.

A `.blend` input (a hand-fixed file saved with --save-blend) is exported as is.
Then run check_glb.py on the result.
"""
import argparse
import json
import math
import os
import sys
from collections import Counter

import bpy  # must come first: bmesh only exists once bpy is loaded
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))

# Material looks for the exported preview. The app re-finishes furniture by family and tints the
# robot's `Main`, so these mainly matter for what the GLB looks like in a viewer and for machines.
LOOK = {
    "glass": (0.1, 0.0, 0.5), "visor": (0.15, 0.0, 1.0), "screen": (0.3, 0.0, 1.0),
    "Main": (0.35, 0.0, 1.0), "eyes": (0.4, 0.0, 1.0), "joints": (0.5, 0.0, 1.0),
    "metal": (0.35, 0.6, 1.0), "metalMedium": (0.4, 0.5, 1.0),
}
DEFAULT_LOOK = (0.7, 0.0, 1.0)  # roughness, metallic, alpha


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--input", required=True, help="GLB/GLTF/FBX/OBJ from the generator, or a hand-fixed .blend")
    p.add_argument("--model", required=True, help="manifest key, e.g. furniture_desk, robot_shared, machine_press")
    p.add_argument("--out", help="output .glb (default: the manifest's file, inside the repo)")
    p.add_argument("--yaw", type=float, default=0.0, help="degrees to turn about up so the front faces the manifest axis")
    p.add_argument("--target-tris", type=int, help="override the budget midpoint")
    p.add_argument("--smooth-passes", type=int, default=2)
    p.add_argument("--materials-only", action="store_true", help="rigged input: rename materials, keep rig and clips")
    p.add_argument("--manifest", default=os.path.join(HERE, "manifest.json"))
    p.add_argument("--save-blend", help="also save the cleaned .blend here, for the hand pass")
    return p.parse_args(argv)


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c):
    c = max(0.0, min(1.0, c))
    return c * 12.92 if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def import_any(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    else:
        sys.exit(f"unsupported input {ext}")
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        sys.exit("no mesh in the input")
    return meshes


def join_static(meshes):
    for o in bpy.context.scene.objects:
        o.select_set(o in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    for o in list(bpy.context.scene.objects):
        if o is not obj:
            bpy.data.objects.remove(o, do_unlink=True)
    return obj


class TextureSampler:
    """Base colour of a material at a UV: its image texture, else its flat colour (sRGB)."""

    def __init__(self, mat):
        self.flat, self.pixels = (0.8, 0.8, 0.8), None
        if mat is None or mat.node_tree is None:
            if mat is not None:
                self.flat = tuple(mat.diffuse_color[:3])
            return
        bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf is None:
            return
        socket = bsdf.inputs["Base Color"]
        self.flat = tuple(linear_to_srgb(c) for c in socket.default_value[:3])
        img = self._find_image(socket)
        if img is not None and img.size[0] > 0:
            self.w, self.h = img.size
            self.pixels = list(img.pixels[:])

    @staticmethod
    def _find_image(socket, depth=0):
        if depth > 6 or not socket.is_linked:
            return None
        node = socket.links[0].from_node
        if node.type == "TEX_IMAGE":
            return node.image
        for inp in node.inputs:
            found = TextureSampler._find_image(inp, depth + 1)
            if found is not None:
                return found
        return None

    def at(self, uv):
        if self.pixels is None:
            return self.flat
        x = int((uv[0] % 1.0) * (self.w - 1))
        y = int((uv[1] % 1.0) * (self.h - 1))
        i = (y * self.w + x) * 4
        return tuple(self.pixels[i:i + 3])


def classify(obj, slots, palette, passes):
    """Index of the nearest allowed material slot for every face, neighbour-smoothed."""
    targets = [hex_rgb(palette[s]) for s in slots]
    samplers = [TextureSampler(m) for m in obj.data.materials] or [TextureSampler(None)]
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    uv = bm.loops.layers.uv.active
    bm.faces.ensure_lookup_table()

    def nearest(rgb):
        return min(range(len(targets)), key=lambda k: sum((a - b) ** 2 for a, b in zip(rgb, targets[k])))

    label = []
    for f in bm.faces:
        sampler = samplers[min(f.material_index, len(samplers) - 1)]
        if sampler.pixels is not None and uv is not None:
            uvs = [l[uv].uv for l in f.loops]
            c = sum((Vector(u) for u in uvs), Vector((0, 0))) / len(uvs)
            picks = [c] + [c.lerp(Vector(u), 0.6) for u in uvs[:2]]
            rgb = [sum(ch) / len(picks) for ch in zip(*(sampler.at(p) for p in picks))]
        else:
            rgb = sampler.flat
        label.append(nearest(rgb))
    for _ in range(passes):
        nxt = list(label)
        for f in bm.faces:
            votes = Counter([label[f.index]] * 2)
            for e in f.edges:
                for g in e.link_faces:
                    if g is not f:
                        votes[label[g.index]] += 1
            nxt[f.index] = votes.most_common(1)[0][0]
        label = nxt
    bm.free()
    return label


def slot_material(name, palette):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    for link in list(bsdf.inputs["Base Color"].links):
        mat.node_tree.links.remove(link)
    rough, metal, alpha = LOOK.get(name, DEFAULT_LOOK)
    bsdf.inputs["Base Color"].default_value = (*[srgb_to_linear(c) for c in hex_rgb(palette[name])], 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Alpha"].default_value = alpha
    return mat


def paint(obj, slots, palette, label):
    """Replace the object's materials with one per slot (only slots actually used are kept)."""
    used = sorted(set(label))
    remap = {k: i for i, k in enumerate(used)}
    obj.data.materials.clear()
    for k in used:
        obj.data.materials.append(slot_material(slots[k], palette))
    for poly, k in zip(obj.data.polygons, label):
        poly.material_index = remap[k]


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def decimate(obj, target):
    tris = triangles(obj)
    if tris <= target:
        return tris
    mod = obj.modifiers.new("decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = target / tris
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return triangles(obj)


def fit_and_pivot(obj, spec):
    """Uniform scale to height_m (else to fit the footprint); pivot at footprint centre, on the floor.

    Blender is Z-up; the glTF export maps Blender (x, y, z) -> glTF (x, z, -y), so glTF width (x) is
    Blender x, height (y) is Blender z, depth (z) is Blender -y.
    """
    co = [v.co for v in obj.data.vertices]
    lo = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
    hi = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
    ext = hi - lo
    s = 1.0
    if spec.get("height_m") and ext.z > 1e-6:
        s = spec["height_m"] / ext.z
    elif spec.get("footprint_m"):
        fw, fd = spec["footprint_m"]
        s = min(fw / max(ext.x, 1e-6), fd / max(ext.y, 1e-6))
    centre = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    obj.data.transform(Matrix.Scale(s, 4) @ Matrix.Translation(-centre))
    obj.data.update()
    return s


def finish(obj, name):
    obj.name = obj.data.name = name
    bpy.context.view_layer.objects.active = obj
    for p in bpy.context.scene.objects:
        p.select_set(p is obj)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    except (AttributeError, RuntimeError):
        bpy.ops.object.shade_smooth()
    for img in list(bpy.data.images):
        bpy.data.images.remove(img)


def export(path, animations=False):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(path), export_format="GLB", export_yup=True,
                              export_apply=True, export_texcoords=False, export_materials="EXPORT",
                              export_animations=animations, export_cameras=False, export_lights=False)


def main():
    a = args()
    manifest = json.load(open(a.manifest))
    if a.model not in manifest["models"]:
        sys.exit(f"{a.model} is not in {a.manifest}")
    spec = manifest["models"][a.model]
    slots, palette = spec.get("classify", spec["materials"]), manifest["palette"]
    out = a.out or os.path.join(ROOT, spec["file"])

    if a.input.lower().endswith(".blend"):
        bpy.ops.wm.open_mainfile(filepath=os.path.abspath(a.input))
        export(out, animations=bool(spec.get("animations")))
        print(f"{a.model}: re-exported {a.input}\nwrote {os.path.abspath(out)}")
        return

    meshes = import_any(a.input)
    if a.materials_only:
        for m in meshes:
            label = classify(m, slots, palette, a.smooth_passes)
            paint(m, slots, palette, label)
        for img in list(bpy.data.images):
            bpy.data.images.remove(img)
        export(out, animations=True)
        print(f"{a.model}: materials renamed on {len(meshes)} rigged meshes\nwrote {os.path.abspath(out)}")
        return

    obj = join_static(meshes)
    if a.yaw:
        obj.matrix_world = Matrix.Rotation(math.radians(a.yaw), 4, "Z") @ obj.matrix_world
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    raw = triangles(obj)
    label = classify(obj, slots, palette, a.smooth_passes)
    paint(obj, slots, palette, label)
    lo, hi = spec["triangles"]
    tris = decimate(obj, a.target_tris or (lo + hi) // 2)
    scale = fit_and_pivot(obj, spec)
    finish(obj, a.model)
    if a.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a.save_blend))
    export(out)
    used = Counter(obj.data.materials[p.material_index].name for p in obj.data.polygons)
    print(f"{a.model}: {raw} -> {tris} triangles, scale x{scale:.3f}, materials {dict(used)}")
    print(f"wrote {os.path.abspath(out)}")


if __name__ == "__main__":
    main()
