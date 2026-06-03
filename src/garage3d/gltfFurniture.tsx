// glTF furniture renderer — lazily code-split, only loaded when MODEL_ASSETS has an entry.
// Renders a clone of the loaded scene so one asset can be placed many times. Pure r3f.
// Resolves the url against Vite's BASE_URL so it works on subpaths + Capacitor.
//
// Kenney models are authored in real-world metres at scale 1, so a raw render mis-sizes and
// floats/sinks. We measure the clone's bounding box, fit its larger horizontal extent to ~92%
// of the item's grid footprint, drop it so it rests on the floor (box.min.y -> y=0), and centre
// it on the tile in x/z. Per-id scale/yaw/offset overrides apply as multipliers on top.
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { ModelAsset } from "./furnitureModels.ts";

function resolveUrl(url: string): string {
  if (/^(https?:)?\/\//.test(url) || url.startsWith("data:")) return url;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  return base + url.replace(/^\//, "");
}

// Fraction of the footprint the model's larger horizontal extent should occupy.
const FIT_FRACTION = 0.92;

export default function GltfFurniture({
  asset,
  footprintW,
  footprintD,
}: {
  asset: ModelAsset;
  // grid footprint of the item in metres (w*GRID.cell, d*GRID.cell)
  footprintW: number;
  footprintD: number;
}) {
  const { scene } = useGLTF(resolveUrl(asset.url));

  // Clone + fit/centre/ground. Memoised on the source scene + footprint so it only recomputes
  // when the asset or its placement size changes.
  const object = useMemo(() => {
    const clone = scene.clone(true);

    // Measure the raw model.
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Uniform fit: the model's larger horizontal extent fills FIT_FRACTION of the footprint.
    const horiz = Math.max(size.x, size.z);
    const footprint = Math.max(footprintW, footprintD);
    const baseScale = horiz > 1e-4 ? (footprint * FIT_FRACTION) / horiz : 1;

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

  const [ox, oy, oz] = asset.offset ?? [0, 0, 0];
  return (
    <group position={[ox, oy, oz]} rotation-y={asset.yaw ?? 0} scale={asset.scale ?? 1}>
      <primitive object={object} />
    </group>
  );
}
