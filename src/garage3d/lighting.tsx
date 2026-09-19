// The office light rig: procedural studio IBL (no HDR assets) plus the ambient / sky / key / rim /
// fill lights. Positions, intensities and colours are verbatim from the inline scene.
import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { RoomPalette } from "./palette.ts";

// Turns on cast/receive shadows for every mesh in the scene so the key light grounds objects
// with soft contact shadows (the floor slab receives them). Re-runs on a short delay to catch
// lazily-mounted pieces. Cheap one-shot traversal.
export function EnableShadows() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const apply = () =>
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if ((m as THREE.Mesh).isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
    apply();
    const t = setTimeout(apply, 600);
    return () => clearTimeout(t);
  }, [scene]);
  return null;
}

export function Lighting({ p, dark }: { p: RoomPalette; dark: boolean }) {
  // Procedural studio IBL (no HDR assets): a few soft area-light rects baked into an environment map
  // so every metalness surface (vault, coffee machine, robot neck rings, printer) reflects a real
  // soft-box rig instead of a flat colour. Memoized with a stable element identity + frames={1} so the
  // PMREM bakes ONCE and never re-bakes on a Scene re-render (the house battery/GPU rule). Kept
  // theme-independent — the ambient/directional lights already carry the dark-vs-light mood — so a
  // theme flip never dirties it. Each Lightformer defaults to looking at the origin, so I only place them.
  const studioEnv = useMemo(() => (
    <Environment resolution={64} frames={1}>
      <Lightformer form="rect" intensity={1.1} color="#ffffff" position={[0, 6, 1]} scale={[9, 4, 1]} />
      <Lightformer form="rect" intensity={0.7} color="#cfe0ff" position={[-6, 3, -2]} scale={[3, 5, 1]} />
      <Lightformer form="rect" intensity={0.6} color="#ffe6c2" position={[6, 3, 2]} scale={[3, 5, 1]} />
      <Lightformer form="rect" intensity={0.5} color="#ffffff" position={[0, 2, -6]} scale={[6, 3, 1]} />
    </Environment>
  ), []);
  return (
    <>
      {studioEnv}
      <ambientLight intensity={dark ? 0.55 : 0.62} color={dark ? "#ffffff" : "#f6f8ff"} />
      {/* soft sky/ground fill — gives the clean diorama an ambient-occlusion-like gradient */}
      {!dark && <hemisphereLight args={["#ffffff", "#dfe4ec", 0.85]} />}
      {/* key light — casts soft shadows in the open diorama for that premium grounded look */}
      <directionalLight
        position={[8, 13, 7]}
        intensity={dark ? 0.7 : 1.15}
        color={dark ? "#fff4e0" : "#ffffff"}
        castShadow={!dark}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-radius={5}
        shadow-bias={-0.0006}
      />
      <directionalLight position={[-5, 8, 4]} intensity={dark ? 0.15 : 0.4} color={dark ? "#c0d4ff" : "#e8f0ff"} />
      {/* cool rim from behind-above the desk bank — the third point of a three-point rig, so the
          seated robots read as separated silhouettes against the back wall instead of flat cutouts.
          No shadows (rim/accent only). */}
      <directionalLight position={[-4, 7, -6]} intensity={dark ? 0.35 : 0.5} color="#bcd4ff" />
      <pointLight position={[0, 3.4, 0]} intensity={dark ? 14 : 4} distance={12} decay={2} color={p.lamp} />
      <pointLight position={[0, 1.3, 0.5]} intensity={dark ? 3 : 1.2} distance={7} decay={2} color={p.screen} />
    </>
  );
}
