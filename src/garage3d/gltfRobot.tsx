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
const TARGET_HEIGHT = 1.7;

export default function GltfRobot({ asset, clip, seed = 0 }: { asset: RobotAsset; clip?: string; seed?: number }) {
  const { scene, animations } = useGLTF(asset.url);

  // Per-instance deep clone (skeleton-aware) so multiple placements don't share one rig. When a
  // tint is set (shared base model), recolour ONLY the "Main" body material — cloning it per
  // instance first so other robots keep their own colour, and leaving Grey/Black (face, joints).
  const cloned = useMemo(() => {
    const c = SkeletonUtils.clone(scene) as THREE.Object3D;
    if (asset.tint) {
      const tintMat = (m: THREE.Material): THREE.Material => {
        if (m.name === "Main") {
          const mm = m.clone() as THREE.MeshStandardMaterial;
          mm.color?.set(asset.tint!);
          return mm;
        }
        return m;
      };
      c.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tintMat) : tintMat(mesh.material);
        }
      });
    }
    return c;
  }, [scene, asset.tint]);

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

  // Per-instance idle jitter, hashed from `seed` (stable — never RNG), so several copies of the SAME
  // un-rigged model don't breathe in lockstep: each gets a slightly different bob/sway amplitude and
  // frequency. `h`/`g` are two decorrelated 0..1 values from the seed.
  const jitter = useMemo(() => {
    const h = Math.abs(Math.sin(seed * 91.7)) % 1;       // 0..1
    const g = Math.abs(Math.sin(seed * 57.3 + 2.1)) % 1; // 0..1, decorrelated from h
    return {
      bobFreq: 1.4 * (0.85 + h * 0.3),  // ±15% frequency spread
      bobAmp: 0.04 * (0.8 + g * 0.4),   // ±20% amplitude spread
      swayFreq: 0.6 * (0.85 + g * 0.3),
      swayAmp: 0.025 * (0.8 + h * 0.4),
    };
  }, [seed]);

  // If the model ships no animation clip (e.g. an un-rigged Meshy export), apply a gentle
  // procedural idle — breathing bob + slow sway — so static models still feel alive without Mixamo.
  useFrame((st) => {
    if (hasClip.current || !ref.current) return;
    const t = st.clock.elapsedTime + seed;
    ref.current.position.y = Math.sin(t * jitter.bobFreq) * jitter.bobAmp;
    ref.current.rotation.z = Math.sin(t * jitter.swayFreq) * jitter.swayAmp;
  });

  return (
    <group ref={ref}>
      <primitive object={fitted} />
    </group>
  );
}
