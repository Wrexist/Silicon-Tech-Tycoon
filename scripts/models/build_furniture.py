"""Build the office furniture GLBs procedurally in Blender (Step 4 of docs/WORLDS_3D_HANDOFF.md).

usage (headless):
  blender --background --python scripts/models/build_furniture.py -- [--out public/furniture]
          [--only desk,chair] [--preview .world-shots/furniture]

Every piece is modelled at real size in the house style (docs/WORLDS_3D_MODEL_LIST.md §0): soft
rounded forms with generous bevels, flat-colour named materials the app re-finishes by family
(materialFamilies.ts), front +Z (Blender -Y), pivot at the footprint centre on the floor. The
numbers the app relies on are kept exact: desk surfaces at 0.74 m, the chair seat at 0.575 m
(seatAnchors.ts), the sofa cushion at half its height (seatSurfaceFraction), shelf tops at the
fractions furnitureModels.ts stocks with books. Deterministic: no randomness, so a rebuild is
byte-stable apart from the exporter's own metadata. Check the output with check_glb.py.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default


ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(ROOT, arg("--out", "public/furniture"))
ONLY = set(filter(None, (arg("--only", "") or "").split(",")))
PREVIEW = arg("--preview")

# Flat colours per material name. The app re-finishes by family anyway; these keep the file
# readable on its own (and in the previews).
MATS = {
    "wood": ((0.80, 0.70, 0.56), 0.55, 0.0),
    "woodDark": ((0.61, 0.52, 0.41), 0.6, 0.0),
    "metal": ((0.75, 0.77, 0.80), 0.32, 0.65),
    "metalMedium": ((0.23, 0.25, 0.28), 0.4, 0.5),
    "carpet": ((0.38, 0.49, 0.60), 0.85, 0.0),
    "carpetBlue": ((0.44, 0.54, 0.63), 0.85, 0.0),
    "carpetDarker": ((0.23, 0.25, 0.28), 0.8, 0.0),
    "plant": ((0.25, 0.40, 0.31), 0.7, 0.0),
    "lamp": ((1.0, 0.95, 0.80), 0.4, 0.0),
    "_defaultMat": ((0.91, 0.89, 0.84), 0.5, 0.0),
}


def material(name):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    col, rough, metal = MATS[name]
    bsdf.inputs["Base Color"].default_value = (*col, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    m.diffuse_color = (*col, 1.0)  # what the Workbench previews show
    if name == "lamp":
        bsdf.inputs["Emission Color"].default_value = (1.0, 0.94, 0.78, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 1.5
    return m


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _finish(obj, mat, bevel, segments=2):
    obj.data.materials.append(material(mat))
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.harden_normals = True
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def box(size, loc, mat, bevel=0.01, segments=2, rot=(0, 0, 0)):
    """size/loc in model space: x right, y = up, z = front (converted to Blender's Z-up, -Y front)."""
    sx, sy, sz = size
    bpy.ops.mesh.primitive_cube_add(size=1, location=(loc[0], -loc[2], loc[1]), rotation=rot)
    o = bpy.context.active_object
    o.scale = (sx, sz, sy)
    bpy.ops.object.transform_apply(scale=True, rotation=True, location=False)
    return _finish(o, mat, min(bevel, min(size) * 0.45), segments)


def cyl(r, h, loc, mat, verts=20, bevel=0.006, axis="y", r2=None):
    """A cylinder of height h standing on `loc` (centre) along model `axis`."""
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=(loc[0], -loc[2], loc[1]))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=h, location=(loc[0], -loc[2], loc[1]))
    o = bpy.context.active_object
    if axis == "x":
        o.rotation_euler = (0, math.pi / 2, 0)
    elif axis == "z":
        o.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    return _finish(o, mat, bevel, 2)


def sphere(r, loc, mat, subdiv=2, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=r, location=(loc[0], -loc[2], loc[1]))
    o = bpy.context.active_object
    o.scale = (scale[0], scale[2], scale[1])
    bpy.ops.object.transform_apply(scale=True)
    return _finish(o, mat, 0)


def tube_between(a, b, r, mat, verts=12):
    """A round tube from model-space point a to b."""
    a, b = Vector((a[0], -a[2], a[1])), Vector((b[0], -b[2], b[1]))
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    bpy.ops.object.transform_apply(rotation=True)
    return _finish(o, mat, 0)


def export(name):
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for o in objs:
        bpy.context.view_layer.objects.active = o
        for mod in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    # pivot: footprint centre on the floor
    vs = [o.matrix_world @ v.co for v in o.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    shift = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    for v in o.data.vertices:
        v.co -= shift
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(o.data)
    bm.free()
    tris = len(o.data.polygons)
    path = os.path.join(OUT, f"{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
        export_texcoords=False, export_normals=True, export_materials="EXPORT", export_cameras=False,
        export_lights=False, export_extras=False,
    )
    print(f"built {name}: {tris} tris -> {os.path.relpath(path, ROOT)}")
    if PREVIEW:
        preview(name, mx - mn)


def preview(name, size):
    """A quick studio render of the piece (Workbench) for review without the app."""
    os.makedirs(os.path.join(ROOT, PREVIEW), exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_cavity = True
    scene.render.resolution_x, scene.render.resolution_y = 520, 420
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("w") if not scene.world else scene.world
    scene.world = world
    span = max(size.x, size.y, size.z)
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    target = Vector((0, 0, size.z * 0.45))
    cam.location = target + Vector((span * 1.6, -span * 2.1, span * 1.25))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.filepath = os.path.join(ROOT, PREVIEW, f"{name}.png")
    bpy.ops.render.render(write_still=True)


# ---- the pieces -------------------------------------------------------------------------------
# Model space: x right, y up, z towards the user (front). Sizes in metres.

def desk():
    W, D, H, T = 1.58, 0.79, 0.74, 0.035
    box((W, T, D), (0, H - T / 2, 0), "wood", 0.012, 3)                      # top
    for x in (-W / 2 + 0.06, W / 2 - 0.06):                                    # sled frames
        for z in (-D / 2 + 0.07, D / 2 - 0.07):
            box((0.04, H - T, 0.04), (x, (H - T) / 2, z), "metal", 0.012)
        box((0.04, 0.035, D - 0.1), (x, 0.0175, 0), "metal", 0.012)          # floor runner
        box((0.04, 0.03, D - 0.1), (x, H - T - 0.015, 0), "metal", 0.01)     # top rail
    box((W - 0.2, 0.18, 0.02), (0, H - T - 0.11, -D / 2 + 0.06), "_defaultMat", 0.008)  # modesty panel
    box((0.4, 0.5, D - 0.16), (W / 2 - 0.32, 0.36, 0), "_defaultMat", 0.02, 3)  # drawer pedestal
    for y in (0.24, 0.42):
        box((0.14, 0.018, 0.012), (W / 2 - 0.32, y, D / 2 - 0.07), "metal", 0.005)  # pulls


def deskL():
    S, H, T, A = 1.58, 0.74, 0.035, 0.72
    box((S, T, A), (0, H - T / 2, -S / 2 + A / 2), "wood", 0.012, 3)          # back run
    box((A, T, S - A), (-S / 2 + A / 2, H - T / 2, A / 2), "wood", 0.012, 3)  # return
    for x, z in ((-S / 2 + 0.06, -S / 2 + 0.06), (S / 2 - 0.06, -S / 2 + 0.06), (-S / 2 + 0.06, S / 2 - 0.06),
                 (S / 2 - 0.06, -S / 2 + A - 0.06), (-S / 2 + A - 0.06, S / 2 - 0.06)):
        box((0.045, H - T, 0.045), (x, (H - T) / 2, z), "metal", 0.012)
    box((0.42, 0.5, 0.6), (S / 2 - 0.3, 0.36, -S / 2 + 0.38), "_defaultMat", 0.02, 3)


def chair():
    SEAT = 0.575
    cyl(0.03, 0.26, (0, 0.2, 0), "metal", 16, 0.004)                           # gas column
    cyl(0.05, 0.06, (0, 0.08, 0), "metalMedium", 16, 0.008)                   # hub
    for i in range(5):                                                          # star base
        a = i * 2 * math.pi / 5 + math.pi / 2
        tip = (math.cos(a) * 0.32, 0.07, math.sin(a) * 0.32)
        tube_between((0, 0.08, 0), tip, 0.024, "metalMedium", 10)
        sphere(0.035, (tip[0], 0.035, tip[2]), "metalMedium", 1)              # casters
    box((0.52, 0.09, 0.5), (0, SEAT - 0.045, 0.02), "carpetDarker", 0.035, 3)  # seat cushion
    box((0.3, 0.04, 0.3), (0, SEAT - 0.11, 0), "metalMedium", 0.01)            # seat plate
    # backrest: its tilted top lands at exactly 0.95 m, the chair's realHeight, so the fit is a scale of
    # 1 and the seat stays at the 0.575 m every seat anchor assumes
    box((0.5, 0.4, 0.075), (0, 0.746, -0.25), "carpetDarker", 0.035, 3, rot=(math.radians(-8), 0, 0))
    box((0.06, 0.24, 0.04), (0, 0.57, -0.27), "metalMedium", 0.012)           # back stem
    for x in (-0.28, 0.28):                                                     # armrests
        box((0.04, 0.16, 0.04), (x, SEAT + 0.02, -0.02), "metalMedium", 0.012)
        box((0.07, 0.03, 0.26), (x, SEAT + 0.11, 0.0), "metalMedium", 0.012)


def _lounge(width, height, arms=True, mats=("carpet", "carpetBlue")):
    # The cushion top sits at exactly half the height (furnitureModels.ts seatSurfaceFraction) and the
    # back cushion tops out at exactly the height, so the app's fit-to-realHeight is a scale of 1.
    seat_top = height * 0.5
    back_h = height - seat_top + 0.04
    D = 0.79
    box((width, 0.16, D - 0.04), (0, 0.19, 0), mats[0], 0.04, 3)               # base
    for x in (-width / 2 + 0.08, width / 2 - 0.08):                             # wood feet
        for z in (-D / 2 + 0.1, D / 2 - 0.1):
            cyl(0.018, 0.11, (x, 0.055, z), "wood", 12, 0.006, r2=0.025)
    inner = width - (0.3 if arms else 0.06)
    n = 2 if width > 1.2 else 1
    cw = inner / n
    for i in range(n):                                                          # seat cushions
        x = -inner / 2 + cw / 2 + i * cw
        box((cw - 0.02, seat_top - 0.27, D - 0.24), (x, 0.27 + (seat_top - 0.27) / 2, 0.06), mats[1], 0.05, 3)
        box((cw - 0.02, back_h, 0.2), (x, seat_top + back_h / 2 - 0.04, -D / 2 + 0.16), mats[0], 0.06, 3)  # back cushion
    if arms:
        for x in (-width / 2 + 0.07, width / 2 - 0.07):
            box((0.14, seat_top + 0.12 - 0.11, D - 0.04), (x, 0.11 + (seat_top + 0.12 - 0.11) / 2, 0), mats[0], 0.05, 3)


def sofa():
    _lounge(1.58, 0.82)


def sofaL():
    S, H = 1.58, 0.82
    seat_top = H * 0.5
    box((S, 0.16, 0.75), (0, 0.19, -S / 2 + 0.375), "carpet", 0.04, 3)       # back run base
    box((0.75, 0.16, S - 0.75), (-S / 2 + 0.375, 0.19, 0.375), "carpet", 0.04, 3)  # chaise base
    box((S - 0.2, seat_top - 0.27, 0.52), (0.1, 0.27 + (seat_top - 0.27) / 2, -S / 2 + 0.47), "carpetBlue", 0.05, 3)
    box((0.52, seat_top - 0.27, S - 0.78), (-S / 2 + 0.47, 0.27 + (seat_top - 0.27) / 2, 0.38), "carpetBlue", 0.05, 3)
    box((S - 0.05, 0.4, 0.2), (0.0, seat_top + 0.16, -S / 2 + 0.12), "carpet", 0.06, 3)   # back cushions
    box((0.2, 0.4, S - 0.3), (-S / 2 + 0.12, seat_top + 0.16, 0.12), "carpet", 0.06, 3)
    box((0.14, seat_top + 0.01, 0.75), (S / 2 - 0.07, 0.11 + seat_top / 2, -S / 2 + 0.375), "carpet", 0.05, 3)  # arm
    for x, z in ((-S / 2 + 0.08, -S / 2 + 0.08), (S / 2 - 0.08, -S / 2 + 0.08), (-S / 2 + 0.08, S / 2 - 0.08),
                 (S / 2 - 0.08, -S / 2 + 0.68), (-S / 2 + 0.68, S / 2 - 0.08)):
        cyl(0.018, 0.11, (x, 0.055, z), "wood", 12, 0.006, r2=0.025)


def armchair():
    _lounge(0.79, 0.78, mats=("carpet", "carpet"))


def loungeChair():
    _lounge(0.79, 0.8, arms=False, mats=("carpet", "carpet"))


def stool():
    cyl(0.2, 0.05, (0, 0.525, 0), "wood", 28, 0.015)
    for i in range(3):
        a = i * 2 * math.pi / 3
        tube_between((math.cos(a) * 0.14, 0.5, math.sin(a) * 0.14), (math.cos(a) * 0.2, 0.0, math.sin(a) * 0.2), 0.018, "metal", 10)
    cyl(0.13, 0.02, (0, 0.2, 0), "metal", 20, 0.004)  # foot ring


def _table(W, D, H, T=0.04, inset=0.08, mat_top="wood"):
    box((W, T, D), (0, H - T / 2, 0), mat_top, 0.014, 3)
    for x in (-W / 2 + inset, W / 2 - inset):
        for z in (-D / 2 + inset, D / 2 - inset):
            cyl(0.024, H - T, (x, (H - T) / 2, z), "metal", 14, 0.004)


def coffeeTable():
    _table(1.4, 0.68, 0.42, 0.05, 0.1)
    box((1.25, 0.025, 0.55), (0, 0.13, 0), "wood", 0.008)          # lower shelf


def meetingTable():
    W, D, H, T = 2.37, 1.3, 0.74, 0.045
    box((W, T, D), (0, H - T / 2, 0), "wood", 0.02, 3)
    for x in (-W / 2 + 0.38, W / 2 - 0.38):                         # two pedestal frames
        box((0.08, H - T, 0.08), (x, (H - T) / 2, 0), "metal", 0.02)
        box((0.08, 0.04, D - 0.3), (x, 0.02, 0), "metal", 0.015)
        box((0.07, 0.035, D - 0.4), (x, H - T - 0.02, 0), "metal", 0.012)
    box((W - 0.9, 0.05, 0.06), (0, H - T - 0.09, 0), "metal", 0.015)  # spine


def sideTable():
    cyl(0.24, 0.035, (0, 0.53, 0), "wood", 32, 0.012)
    cyl(0.03, 0.5, (0, 0.27, 0), "metal", 16, 0.004)
    cyl(0.17, 0.025, (0, 0.0125, 0), "metal", 28, 0.008)


def _shelf(H, rows, depth=0.36, W=0.79):
    t = 0.028
    for x in (-W / 2 + t / 2, W / 2 - t / 2):
        box((t, H, depth), (x, H / 2, 0), "woodDark", 0.008)                    # sides
    box((W, 0.014, depth), (0, H - 0.007, 0), "woodDark", 0.006)                 # top cap
    box((W - 2 * t, H - 0.06, 0.012), (0, H / 2, -depth / 2 + 0.006), "woodDark", 0.003)  # back panel
    box((W - 2 * t, 0.06, depth - 0.02), (0, 0.03, 0.01), "woodDark", 0.008)    # plinth
    for f in rows:
        y = H * f
        box((W - 2 * t, 0.022, depth - 0.02), (0, y - 0.011, 0.005), "wood", 0.006)  # shelf top at y


def bookshelf():
    _shelf(1.8, [0.15, 0.425, 0.7, 0.92])


def shelfUnit():
    _shelf(1.8, [0.325, 0.62, 0.9], depth=0.42)


def cabinet():
    W, D, H = 1.58, 0.5, 0.9
    box((W, H - 0.08, D), (0, 0.08 + (H - 0.08) / 2, 0), "woodDark", 0.02, 3)
    for x in (-W / 2 + 0.1, W / 2 - 0.1):
        for z in (-D / 2 + 0.08, D / 2 - 0.08):
            cyl(0.02, 0.08, (x, 0.04, z), "metal", 12, 0.004)
    for i in range(3):                                                          # door fronts
        x = -W / 2 + W / 6 + i * W / 3
        box((W / 3 - 0.03, H - 0.16, 0.02), (x, 0.08 + (H - 0.08) / 2, D / 2 + 0.006), "wood", 0.008)
        box((0.012, 0.16, 0.02), (x + W / 6 - 0.08, 0.08 + (H - 0.08) / 2, D / 2 + 0.03), "metal", 0.004)


def crates():
    box((0.62, 0.3, 0.5), (0, 0.15, 0), "woodDark", 0.02, 3)
    box((0.5, 0.28, 0.42), (0.03, 0.44, 0.02), "_defaultMat", 0.02, 3)
    box((0.62, 0.03, 0.02), (0, 0.24, 0.255), "woodDark", 0.006)
    box((0.62, 0.03, 0.02), (0, 0.08, 0.255), "woodDark", 0.006)


def _plant(H, pot_h, pot_r, foliage):
    cyl(pot_r * 0.8, pot_h, (0, pot_h / 2, 0), "_defaultMat", 28, 0.015, r2=pot_r)  # tapers to the floor
    cyl(pot_r * 0.92, 0.02, (0, pot_h - 0.005, 0), "woodDark", 24, 0.004)       # soil
    for (x, y, z, r, s) in foliage:
        sphere(r, (x, y, z), "plant", 2, s)


def plantTall():
    _plant(1.45, 0.42, 0.2, [
        (0.0, 0.95, 0.0, 0.26, (1, 1.35, 1)),
        (0.13, 1.18, 0.05, 0.2, (1, 1.2, 1)),
        (-0.12, 1.12, -0.06, 0.2, (1, 1.25, 1)),
        (0.02, 1.32, -0.03, 0.15, (1, 0.9, 1)),
    ])
    cyl(0.018, 0.4, (0, 0.6, 0), "woodDark", 8, 0.0)                            # stem


def plantPot():
    _plant(0.5, 0.24, 0.17, [(0.0, 0.34, 0.0, 0.16, (1.15, 0.85, 1.15)), (0.07, 0.42, 0.02, 0.1, (1, 0.9, 1))])


def _rug(W, D, rnd=False):
    if rnd:
        cyl(W / 2, 0.012, (0, 0.006, 0), "carpet", 40, 0.0)          # flat discs: a rug's budget is 800
        cyl(W / 2 - 0.08, 0.014, (0, 0.007, 0), "carpetBlue", 40, 0.0)
    else:
        box((W, 0.012, D), (0, 0.006, 0), "carpet", 0.004)
        box((W - 0.16, 0.014, D - 0.16), (0, 0.007, 0), "carpetBlue", 0.003)


def rug():
    _rug(2.37, 1.58)


def rugRound():
    _rug(1.58, 1.58, True)


def tvStand():
    W, D, H = 1.5, 0.42, 0.5
    box((W, H - 0.1, D), (0, 0.1 + (H - 0.1) / 2, 0), "wood", 0.02, 3)
    for x in (-W / 2 + 0.1, W / 2 - 0.1):
        for z in (-D / 2 + 0.07, D / 2 - 0.07):
            cyl(0.018, 0.1, (x, 0.05, z), "metalMedium", 12, 0.004)
    box((W - 0.12, 0.12, 0.02), (0, 0.32, D / 2 + 0.006), "metalMedium", 0.006)  # media slot
    box((0.5, 0.025, 0.012), (0, 0.32, D / 2 + 0.018), "lamp", 0.003)            # status strip


def floorLamp():
    cyl(0.16, 0.025, (0, 0.0125, 0), "metalMedium", 28, 0.008)
    cyl(0.014, 1.3, (0, 0.67, 0), "metal", 10, 0.0)
    cyl(0.2, 0.3, (0, 1.42, 0), "lamp", 28, 0.006, r2=0.14)


def arcLamp():
    box((0.28, 0.05, 0.28), (-0.22, 0.025, 0), "metalMedium", 0.015, 3)
    pts = [(-0.22, 0.05), (-0.22, 1.2), (-0.12, 1.62), (0.08, 1.82), (0.26, 1.78)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        tube_between((x0, y0, 0), (x1, y1, 0), 0.016, "metal", 10)
    sphere(0.1, (0.28, 1.68, 0), "lamp", 2, (1, 0.8, 1))


def lantern():
    cyl(0.12, 0.035, (0, 0.0175, 0), "metal", 24, 0.008)                          # base
    cyl(0.095, 0.24, (0, 0.155, 0), "lamp", 20, 0.004)                            # glowing glass
    cyl(0.11, 0.03, (0, 0.29, 0), "metal", 24, 0.006, r2=0.07)                    # cap
    for i in range(4):                                                              # cage posts
        a = i * math.pi / 2 + math.pi / 4
        cyl(0.008, 0.24, (math.cos(a) * 0.1, 0.155, math.sin(a) * 0.1), "metal", 6, 0.0)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.05, minor_radius=0.009, major_segments=20, minor_segments=6,
                                     location=(0, 0, 0.35), rotation=(math.pi / 2, 0, 0))  # ring handle
    _finish(bpy.context.active_object, "metal", 0)


PIECES = {f.__name__: f for f in (
    desk, deskL, chair, armchair, loungeChair, sofa, sofaL, stool, coffeeTable, meetingTable,
    sideTable, bookshelf, cabinet, shelfUnit, crates, plantTall, plantPot, rug, rugRound, tvStand,
    floorLamp, arcLamp, lantern,
)}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for key, build in PIECES.items():
        if ONLY and key not in ONLY:
            continue
        reset()
        build()
        export(key)
