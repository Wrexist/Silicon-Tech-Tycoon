// glTF furniture renderer — lazily code-split, only loaded when MODEL_ASSETS has an entry.
// Renders a clone of the loaded scene so one asset can be placed many times. Pure r3f.
// Resolves the url against Vite's BASE_URL so it works on subpaths + Capacitor.
//
// Kenney models are authored in real-world metres at scale 1, so a raw render mis-sizes and
// floats/sinks. We measure the clone's bounding box, fit its larger horizontal extent to ~92%
// of the item's grid footprint, drop it so it rests on the floor (box.min.y -> y=0), and centre
// it on the tile in x/z. Per-id scale/yaw/offset overrides apply as multipliers on top.
import { useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { ModelAsset } from "./furnitureModels.ts";
import { surfaceAnchorY } from "./furnitureModels.ts";
import { desaturatedColor } from "./palette.ts";
import { applyMaterialFamily } from "./materialFamilies.ts";

// ---- Material identity for the fitted glTF catalog --------------------------------------------------
// The Kenney models ship with baked, saturated paint. Instead of one blanket desaturation, each
// material is mapped BY NAME to a MATERIAL FAMILY (see materialFamilies.ts) that keeps the source
// hue/value at the family's saturation budget and sets its roughness/metalness — so wood, painted
// metal, fabric and foliage stay distinguishable by touch as well as tone. Shared between clones, and
// a WeakSet stops the pass compounding on models that mount more than once. No new materials.
const familyApplied = new WeakSet<THREE.Material>();

function applyFamilies(root: THREE.Object3D, tint?: ModelAsset["tint"]): void {
  const blend = tint ? new THREE.Color(tint.color) : null;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat || familyApplied.has(mat)) continue;
      familyApplied.add(mat);
      const family = applyMaterialFamily(mat as THREE.MeshStandardMaterial, desaturatedColor);
      // Optional per-asset finish: blend the family's colour toward the piece's tint. The family
      // pass is shared (a WeakSet), so a tint only ever reaches materials this asset introduced.
      const std = mat as THREE.MeshStandardMaterial;
      if (blend && std.color && (!tint!.families || tint!.families.includes(family))) {
        std.color.lerp(blend, tint!.amount);
      }
    }
  });
}

function resolveUrl(url: string): string {
  if (/^(https?:)?\/\//.test(url) || url.startsWith("data:")) return url;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  return base + url.replace(/^\//, "");
}

// Fraction of the footprint the model's larger horizontal extent should occupy.
const FIT_FRACTION = 0.92;
// Hard cap on rendered height (metres) so tall/slender pieces don't over-scale into columns.
const MAX_HEIGHT = 2.1;

export default function GltfFurniture({
  asset,
  footprintW,
  footprintD,
  children,
  dressing,
}: {
  asset: ModelAsset;
  // grid footprint of the item in metres (w*GRID.cell, d*GRID.cell)
  footprintW: number;
  footprintD: number;
  /** Rendered at the model's fitted TOP surface — for desk-top kit (monitor, keyboard) that has to
   *  sit on a model whose real height is only known once it's measured and scaled. */
  children?: ReactNode;
  /** Rendered at the model's fitted LOCAL origin with the fitted height in metres — for dressing
   *  that lives at heights INSIDE the model (books on a bookcase's shelves). */
  dressing?: (height: number) => ReactNode;
}) {
  const { scene } = useGLTF(resolveUrl(asset.url));

  // Clone + fit/centre/ground. Memoised on the source scene + footprint so it only recomputes
  // when the asset or its placement size changes.
  const object = useMemo(() => {
    const clone = scene.clone(true);
    applyFamilies(clone, asset.tint);

    // Measure the raw model.
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Uniform fit: the model's larger horizontal extent fills FIT_FRACTION of the footprint —
    // BUT clamp by height so slender, tall pieces (floor lamps, tall plants) don't explode into
    // giant columns. We cap the rendered height at MAX_HEIGHT metres and take the smaller scale.
    const horiz = Math.max(size.x, size.z);
    const footprint = Math.max(footprintW, footprintD);
    const horizScale = horiz > 1e-4 ? (footprint * FIT_FRACTION) / horiz : 1;
    const heightScale = size.y > 1e-4 ? MAX_HEIGHT / size.y : horizScale;
    // `realHeight` is the piece's true height in metres. Fitting purely by footprint inflates a
    // model in ALL THREE axes whenever it's narrower than its tile — a desk model ~1.1m wide dropped
    // on a 2-cell (1.72m) footprint came out ~1.4x oversized, standing 1.05m tall and reading as a
    // cabinet rather than a desk. Scaling to the known height instead keeps furniture in human
    // proportion; the footprint fit still caps it so nothing can overflow its tile.
    const trueScale = asset.realHeight && size.y > 1e-4 ? asset.realHeight / size.y : null;
    const baseScale = trueScale != null ? Math.min(trueScale, horizScale) : Math.min(horizScale, heightScale);

    // Wrap the clone so we can transform it without mutating shared geometry/material refs.
    const wrapper = new THREE.Group();
    wrapper.add(clone);
    wrapper.scale.setScalar(baseScale);

    // After scaling, translate the inner clone so it's centred in x/z and rests on the floor.
    // box is in the un-scaled model space, so we offset in that same space (the wrapper scale
    // then maps it correctly): centre x/z on origin, and lift so min.y -> 0.
    clone.position.set(-center.x, -box.min.y, -center.z);

    return wrapper;
  }, [scene, footprintW, footprintD]);

  // Fitted height of the piece (the model's own top), so shelf dressing can size itself.
  const topY = useMemo(() => {
    const box = new THREE.Box3().setFromObject(object);
    return box.max.y;
  }, [object]);

  // Desk-top kit rests on the declared SURFACE, not the model's bbox top (which a taller part —
  // screen, rail, shelf — would push too high). Falls back to the measured top for bare pieces.
  const anchorY = surfaceAnchorY(asset, topY);

  const [ox, oy, oz] = asset.offset ?? [0, 0, 0];
  return (
    <group position={[ox, oy, oz]} rotation-y={asset.yaw ?? 0} scale={asset.scale ?? 1}>
      <primitive object={object} />
      {dressing != null && <group>{dressing(topY)}</group>}
      {children != null && <group position={[0, anchorY, 0]}>{children}</group>}
    </group>
  );
}
