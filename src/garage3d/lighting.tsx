// The office light rig: procedural studio IBL (no HDR assets) plus the room's architectural key,
// fill, rim and the four zone lights. Two ideas carry the room:
//
//   1. CONTRAST, not brightness. A soft low ambient plus a warm key and a cool counterpoint gives
//      every surface a light side and a dark side, which is what makes the primitives read as
//      materials instead of flat fills.
//   2. POOLS instead of more lights. Floor light pools are additive radial decals (see FloorPools),
//      so the focal hierarchy costs a transparent quad per zone rather than another per-pixel light
//      term on every lit material in the scene — the only way this stays inside a mobile budget.
import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { glowTexture } from "./glow.ts";
import { sharedBasic } from "./sharedGpu.ts";
import type { RoomPalette } from "./palette.ts";

// Turns on cast/receive shadows for every mesh in the scene so the key light grounds objects
// with soft contact shadows (the floor slab receives them). Re-runs on a short delay to catch
// lazily-mounted pieces. Cheap one-shot traversal.
//
// Transparent meshes are excluded from CASTING: the depth pass has no alpha, so an additive light
// pool, a steam puff or a glass pane would otherwise stamp a solid black disc/quad into the shadow
// map — the exact opposite of what it is meant to do. They still RECEIVE.
export function EnableShadows() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const apply = () =>
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!(m as THREE.Mesh).isMesh) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        m.castShadow = !mats.some((mat) => mat?.transparent);
        m.receiveShadow = true;
      });
    apply();
    const t = setTimeout(apply, 600);
    return () => clearTimeout(t);
  }, [scene]);
  return null;
}

// ---- Zone pools ---------------------------------------------------------------------------------
// One quad per focal ZONE — never per prop. Three pools carry the hierarchy: the warm key over the
// work banks (primary), the brand wall's wash (secondary), the lounge nook (tertiary). The culture
// and server pools were removed with the hierarchy pass: a floor glow under every small prop made
// each of them look important, and a server's own status LEDs already say "tech" better than a
// light disc on the floor. Positions/radii are in room units and scale with the facility.
interface Pool { x: number; z: number; r: number; tone: "warm" | "cool"; strength: number }
const POOLS: Pool[] = [
  { x: 0, z: -2.35, r: 1.95, tone: "warm", strength: 1 },    // the desk bank / pod field — the key pool
  { x: 0.3, z: -3.05, r: 1.35, tone: "warm", strength: 0.75 },// the entrance + brand wall wash
  { x: -3.15, z: 0.5, r: 1.35, tone: "warm", strength: 0.9 }, // the lounge / coffee nook
];

function FloorPools({ p, dark, roomScale }: { p: RoomPalette; dark: boolean; roomScale: number }) {
  const tex = useMemo(() => glowTexture(), []);
  // Additive on a dark floor is the look; on the light diorama's near-white slab it would bleach, so
  // the same pools run far weaker there — they warm the floor rather than light it.
  const strength = dark ? 0.85 : 0.16;
  // Circular geometry, not a quad: the falloff texture is round, so a square would shade four
  // transparent corners per pool for nothing. Overdraw is the whole cost of this technique.
  const disc = useMemo(() => new THREE.CircleGeometry(1, 24), []);
  const pool = (color: string, op: number) =>
    sharedBasic({ color, map: tex, transparent: true, opacity: strength * op, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
  // `cool` stays available to the pool map (a future zone may want it) even though no pool uses it now.
  const tint: Record<Pool["tone"], string> = { warm: p.poolWarm, cool: p.poolCool };
  return (
    <group scale={roomScale}>
      {POOLS.map((z, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[z.x, 0.024, z.z]} scale={z.r} renderOrder={2} geometry={disc} material={pool(tint[z.tone], z.strength)} />
      ))}
    </group>
  );
}

export function Lighting({ p, dark, roomScale = 1 }: { p: RoomPalette; dark: boolean; roomScale?: number }) {
  // Procedural studio IBL (no HDR assets): a few soft area-light rects baked into an environment map
  // so every metalness surface (vault, coffee machine, robot neck rings, printer) reflects a real
  // soft-box rig instead of a flat colour. Memoized with a stable element identity + frames={1} so the
  // PMREM bakes ONCE and never re-bakes on a Scene re-render (the house battery/GPU rule). Kept
  // theme-independent — the ambient/directional lights already carry the dark-vs-light mood — so a
  // theme flip never dirties it. Each Lightformer defaults to looking at the origin, so I only place them.
  const studioEnv = useMemo(() => (
    <Environment resolution={64} frames={1}>
      <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[0, 6, 1]} scale={[9, 4, 1]} />
      <Lightformer form="rect" intensity={0.75} color="#cfe0ff" position={[-6, 3, -2]} scale={[3, 5, 1]} />
      <Lightformer form="rect" intensity={0.7} color="#ffe6c2" position={[6, 3, 2]} scale={[3, 5, 1]} />
      <Lightformer form="rect" intensity={0.55} color="#ffffff" position={[0, 2, -6]} scale={[6, 3, 1]} />
      {/* a narrow warm rect on the brand-wall side keeps the edge highlights from reading uniformly cool */}
      <Lightformer form="rect" intensity={0.5} color="#ffd9a8" position={[2.5, 4.5, -4]} scale={[3, 1.6, 1]} />
    </Environment>
  ), []);
  return (
    <>
      {studioEnv}
      {/* Deliberately dim: this is the fill that keeps shadow-side faces readable, not the room's
          light. It used to sit at 0.55–0.62 and flattened every surface in the scene. */}
      <ambientLight intensity={dark ? 0.3 : 0.44} color={dark ? "#cbd2e4" : "#ffffff"} />
      {/* soft sky/ground fill — gives the clean diorama an ambient-occlusion-like gradient */}
      {!dark && <hemisphereLight args={["#ffffff", "#dfe4ec", 0.66]} />}
      {/* key light — the warm interior sun: casts soft shadows in the open diorama and shapes the
          dark room's floor/walls. Shadow cost is unchanged (light mode only). */}
      <directionalLight
        position={[8, 13, 7]}
        intensity={dark ? 1.25 : 1.15}
        color={dark ? "#ffdfae" : "#fff4e4"}
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
      <directionalLight position={[-5, 8, 4]} intensity={dark ? 0.18 : 0.34} color={dark ? "#c0d4ff" : "#e8f0ff"} />
      {/* cool rim from behind-above the desk bank — the third point of a three-point rig, so the
          seated robots read as separated silhouettes against the back wall instead of flat cutouts.
          No shadows (rim/accent only). */}
      <directionalLight position={[-4, 7, -6]} intensity={dark ? 0.45 : 0.36} color="#bcd4ff" />
      {/* Zone lights (4 total, up from 2 — each one is a per-pixel term, so the count is fixed and
          the pools above carry the rest of the hierarchy). Scaled with the room like the walls. */}
      <group scale={roomScale}>
        {/* warm overhead key over the desks */}
        <pointLight position={[0, 3.3, -1.6]} intensity={dark ? 30 : 6} distance={8.5} decay={2} color={p.lamp} />
        {/* cool monitor counterpoint, low and in front of the desks */}
        <pointLight position={[0, 1.3, -1.9]} intensity={dark ? 5 : 1.4} distance={5} decay={2} color={p.screen} />
        {/* warm wash on the brand wall so the installation lights its own corner */}
        <pointLight position={[0.4, 2.9, -3.1]} intensity={dark ? 9 : 2} distance={3.8} decay={2} color={p.signGlow} />
        {/* the lounge / coffee nook reads warm and separate from the work floor */}
        <pointLight position={[-3.2, 2.0, 0.5]} intensity={dark ? 9 : 2.4} distance={3.6} decay={2} color={p.lamp} />
      </group>
      <FloorPools p={p} dark={dark} roomScale={roomScale} />
    </>
  );
}
