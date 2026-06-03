// glTF robot renderer — lazily code-split, only imported when a robot .glb is registered.
// Loads the model, clones it per-instance (SkeletonUtils handles rigged/skinned meshes safely so
// the same colour can appear at several desks), fits it to the procedural robot's height, grounds
// it on the floor, and plays an idle/looping animation clip if the model ships one. Pure R3F.
//
// If the .glb has no animations (e.g. an un-rigged Meshy export), it renders as a static model —
// still fine; rig it in Mixamo later to bring it to life. Any load failure is caught upstream by
// the boundary in Garage3D.tsx, which falls back to the parametric robot.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import type { RobotAsset } from "./robotModels.ts";

// Overall height in metres — matches the parametric robot (~1.5m: body + head) so swapping a
// model in doesn't change its scale relative to desks/labels.
const TARGET_HEIGHT = 1.5;

export default function GltfRobot({ asset, clip, seed = 0 }: { asset: RobotAsset; clip?: string; seed?: number }) {
  const { scene, animations } = useGLTF(asset.url);

  // Per-instance deep clone (skeleton-aware) so multiple placements don't share one rig.
  const cloned = useMemo(() => SkeletonUtils.clone(scene) as THREE.Object3D, [scene]);

  // Uniform fit to TARGET_HEIGHT + ground so min.y rests at y=0, centred in x/z.
  const fitted = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const s = size.y > 1e-4 ? TARGET_HEIGHT / size.y : 1;
    const wrapper = new THREE.Group();
    wrapper.add(cloned);
    wrapper.scale.setScalar(s);
    cloned.position.set(-center.x, -box.min.y, -center.z);
    return wrapper;
  }, [cloned]);

  // Animation: play the requested clip by name, else the first available clip, looping.
  const ref = useRef<THREE.Group>(null);
  const { actions, names } = useAnimations(animations, ref);
  const hasClip = useRef(false);
  useEffect(() => {
    const chosen = (clip && actions[clip]) || (names.length ? actions[names[0]] : null);
    hasClip.current = !!chosen;
    chosen?.reset().fadeIn(0.3).play();
    return () => {
      chosen?.fadeOut(0.2);
    };
  }, [actions, names, clip]);

  // If the model ships no animation clip (e.g. an un-rigged Meshy export), apply a gentle
  // procedural idle — breathing bob + slow sway — so static models still feel alive without Mixamo.
  useFrame((st) => {
    if (hasClip.current || !ref.current) return;
    const t = st.clock.elapsedTime + seed;
    ref.current.position.y = Math.sin(t * 1.4) * 0.04;
    ref.current.rotation.z = Math.sin(t * 0.6) * 0.025;
  });

  return (
    <group ref={ref}>
      <primitive object={fitted} />
    </group>
  );
}
