// Factory Mode's 3D floor — a COHERENT production line, not a diorama: raw material enters
// at the intake hopper, rides an S-shaped conveyor through the gantry press (Tooling), twin
// robot arms (Assembly) and a glass QA tunnel (Quality), and leaves the packer as a boxed
// crate at the dock. The item VISIBLY TRANSFORMS at each machine (slab → board → device →
// crate), and the machine matching the build's real stage glows and works hardest.
// Same stack + discipline as the 3D office: r3f/drei primitives, lazy chunk, DPR cap,
// context-loss downgrade. Zero image assets.
import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  FLOOR, beltPath, formMarks, machineCenter, worldOf,
  type BeltDir, type FactoryFloor, type MachineKind,
} from "../engine/factoryFloor.ts";
import { propCenter, type PlacedProp } from "../engine/factoryProps.ts";
import { FINISH_SWATCHES } from "../render/deviceStyle.ts";
import type { CategoryId, Product } from "../engine/types.ts";

/* palette — intrinsic object colours, the garage3d precedent */
const C = {
  grass: "#1d2b22",
  pad: "#2a2f37",
  concrete: "#7c828c",      // poured-concrete factory floor
  concreteJoint: "#5c626b", // expansion joints / build grid
  wallTrim: "#3c424b",      // wall skirting / base course
  wallTop: "#aeb4bd",       // capping rail on the walls
  beltBed: "#454c57",
  beltFrame: "#3d4552",   // metal side frame of the conveyor
  beltRubber: "#20242b",  // dark rubber belt surface
  rollerHi: "#7b8592",    // polished metal roller
  rail: "#5a626e",
  roller: "#31363e",
  machine: "#3f4754",
  machineHi: "#4a5362",
  dark: "#23272e",
  accent: "#3b82f6",
  amber: "#f59e0b",
  hazard: "#e0a83c",
  crate: "#b98a3a",
  slab: "#9aa3ad",
  board: "#2f9e6e",
  device: "#1c2027",
  screen: "#66a9ff",
  glass: "#7fb2ff",
  truck: "#d7dade",
  cab: "#3b82f6",
  agv: "#5ea0f8",
  road: "#2e333b",
};

export interface Factory3DProps {
  active: boolean;
  /** Which machine kind the current build stage is working (null when idle) — only that machine
   *  animates; every other machine on the floor stays still. */
  activeKind: MachineKind | null;
  robotTier: number;
  readyCount: number;
  selling: boolean;
  overtime: boolean;
  /** The player-built layout (F2) — every belt tile and machine renders from this. */
  floor: FactoryFloor;
  /** The product currently in production — its real category + finish ride the belt. */
  product?: Product | null;
  /** The belt chain connects Intake → Packer, so the line actually runs (F3). */
  lineOk: boolean;
  /** Build mode: taps on the pad report the grid cell instead of doing nothing. */
  buildMode?: boolean;
  /** Painted wall colour + floor tint from the player's factory decor (customisable). */
  wallColor?: string;
  floorColor?: string;
  /** Decorative props the player has placed on the floor. */
  props?: PlacedProp[];
  /** Current buildable width in cells (grows east with floor expansions; default = base width). */
  floorW?: number;
  /** Bumped by the HUD's recenter button — re-frames the camera to its default. */
  resetView?: number;
  onTapCell?: (c: number, r: number) => void;
  /** Last tap's cell + validity — flashed green/red on the pad for placement feedback. */
  flash?: { c: number; r: number; ok: boolean; n: number } | null;
  onContextLost?: () => void;
}

/* ---------------- generic polyline walking (the belts define the path) ---------------- */

interface Polyline { pts: [number, number][]; lens: number[]; total: number }

function makePolyline(pts: [number, number][]): Polyline {
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    lens.push(l);
    total += l;
  }
  return { pts, lens, total };
}

function polyAt(pl: Polyline, t: number): [number, number] {
  if (pl.pts.length === 0) return [0, 0];
  let d = ((t % pl.total) + pl.total) % pl.total;
  for (let i = 0; i < pl.lens.length; i++) {
    if (d <= pl.lens[i]) {
      const f = pl.lens[i] === 0 ? 0 : d / pl.lens[i];
      const [ax, az] = pl.pts[i];
      const [bx, bz] = pl.pts[i + 1];
      return [ax + (bx - ax) * f, az + (bz - az) * f];
    }
    d -= pl.lens[i];
  }
  return pl.pts[pl.pts.length - 1];
}

/** Distance from the closest traveling item to a floor point (Infinity if the line is empty).
 *  Machines use this to react to the item passing THROUGH them, instead of a free clock. */
function nearestItemDist(pl: Polyline, itemsT: number[], cx: number, cz: number): number {
  if (pl.total === 0) return Infinity;
  let best = Infinity;
  for (const t of itemsT) {
    const [x, z] = polyAt(pl, t);
    const d = Math.hypot(x - cx, z - cz);
    if (d < best) best = d;
  }
  return best;
}

/** Closest point on the belt to (x,z) + the belt's heading there (yaw so a +Z-forward shape aims
 *  down the belt). Lets a machine sit ON the line and face along it, so the product runs THROUGH it
 *  — a gantry press straddles the belt, a QA tunnel encloses it, the packer folds around it. */
function snapToBelt(pl: Polyline, x: number, z: number): { x: number; z: number; yaw: number; nx: number; nz: number } | null {
  if (pl.pts.length < 2) return null;
  let best = Infinity, bx = x, bz = z, byaw = 0, bnx = 0, bnz = 0;
  for (let i = 0; i < pl.pts.length - 1; i++) {
    const [ax, az] = pl.pts[i];
    const [cx, cz] = pl.pts[i + 1];
    const dx = cx - ax, dz = cz - az;
    const len2 = dx * dx + dz * dz;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const px = ax + dx * t, pz = az + dz * t;
    const d = Math.hypot(px - x, pz - z);
    if (d < best) {
      best = d;
      bx = px; bz = pz;
      const len = Math.sqrt(len2);
      byaw = Math.atan2(dx, dz);        // +Z-forward shape → aims along the segment
      bnx = dz / len; bnz = -dx / len;  // in-plane normal (belt's side), for placing things beside it
    }
  }
  return { x: bx, z: bz, yaw: byaw, nx: bnx, nz: bnz };
}

type ItemsRef = React.MutableRefObject<number[]>;

/* ------------------------------- conveyor ------------------------------- */

function HazardBase({ w, d }: { w: number; d: number }) {
  return (
    <group>
      {[-w / 2 + 0.15, w / 2 - 0.15].map((x, i) => (
        <mesh key={i} position={[x, 0.09, 0]}>
          <boxGeometry args={[0.12, 0.04, d]} />
          <meshStandardMaterial color={C.hazard} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

const DIR_STEP: Record<BeltDir, [number, number]> = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] };
const OPP: Record<BeltDir, BeltDir> = { e: "w", w: "e", s: "n", n: "s" };
/** Yaw so a shape whose "forward" is +Z aims down the belt direction. */
const DIR_YAW: Record<BeltDir, number> = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };

// One consistent bed so every tile sits flush and the line reads as one smooth conveyor.
const BED = 1.06;          // bed footprint (slightly over 1 cell → seamless joins)
const RUBBER_W = 0.78;     // dark belt-surface width; frame shows on either side as the rails
const SURF_Y = 0.35;       // belt surface height

/** Painted directional chevron lying flush on the belt, pointing +Z (canonical flow). Two thin
 *  angled bars — a tasteful "›", not a chunky cone — brighter on the live chain. */
function FlowArrow({ live, z = 0 }: { live: boolean; z?: number }) {
  const col = live ? C.hazard : "#5c636d";
  return (
    <group position={[0, SURF_Y + 0.012, z]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.09, 0, 0.03]} rotation={[0, -s * 0.7, 0]}>
          <boxGeometry args={[0.05, 0.014, 0.24]} />
          <meshStandardMaterial color={col} emissive={live ? C.hazard : "#000"} emissiveIntensity={live ? 0.5 : 0} roughness={0.6} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

/** A polished metal cross-roller lying across the flow (canonical: along X). */
function Roller({ z = 0, len = RUBBER_W + 0.03 }: { z?: number; len?: number }) {
  return (
    <mesh position={[0, SURF_Y + 0.004, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.042, 0.042, len, 16]} />
      <meshStandardMaterial color={C.rollerHi} roughness={0.3} metalness={0.7} />
    </mesh>
  );
}

/** Belt tiles rendered from the layout with SMART CORNERS. Every tile shares one bed footprint so
 *  the line joins flush and symmetric; straight tiles are authored flow-forward (+Z) then rotated,
 *  a framed rubber belt with seam rollers and subtle painted chevrons. Corners keep the same bed +
 *  frame and curve the flow arrows around the turn. */
function BeltTiles({ floor, lineOk }: { floor: FactoryFloor; lineOk: boolean }) {
  const at = useMemo(() => new Map(floor.belts.map((b) => [`${b.c},${b.r}`, b])), [floor.belts]);
  /** The direction of the neighbour that flows INTO this tile (null if it's a head). */
  const inflowDir = (b: FactoryFloor["belts"][number]): BeltDir | null => {
    for (const dir of ["e", "w", "s", "n"] as BeltDir[]) {
      const nb = at.get(`${b.c - DIR_STEP[dir][0]},${b.r - DIR_STEP[dir][1]}`);
      if (nb && nb.dir === dir) return dir;
    }
    return null;
  };

  return (
    <group>
      {floor.belts.map((b) => {
        const [x, z] = worldOf(b.c, b.r);
        const inDir = inflowDir(b);
        const isCorner = inDir != null && inDir !== b.dir && inDir !== OPP[b.dir];
        const live = lineOk;

        if (isCorner && inDir) {
          const [ix, iz] = DIR_STEP[inDir]; // item enters travelling this way
          const [ox, oz] = DIR_STEP[b.dir]; // and leaves this way
          return (
            <group key={`${b.c},${b.r}`} position={[x, 0, z]}>
              {/* same bed + frame as a straight tile → flush, symmetric join */}
              <RoundedBox args={[BED, 0.3, BED]} radius={0.05} position={[0, 0.2, 0]} receiveShadow>
                <meshStandardMaterial color={C.beltFrame} roughness={0.5} metalness={0.45} />
              </RoundedBox>
              {/* rubber turn pad */}
              <mesh position={[0, SURF_Y - 0.01, 0]} receiveShadow>
                <boxGeometry args={[0.84, 0.04, 0.84]} />
                <meshStandardMaterial color={C.beltRubber} roughness={0.9} metalness={0.05} />
              </mesh>
              {/* outer rails: the two edges that are NOT entry or exit */}
              {(["e", "w", "s", "n"] as BeltDir[])
                .filter((d) => d !== inDir && d !== OPP[b.dir])
                .map((d) => {
                  const [nx, nz] = DIR_STEP[d];
                  const vert = nx !== 0;
                  return (
                    <mesh key={d} position={[nx * 0.5, 0.4, nz * 0.5]} castShadow>
                      <boxGeometry args={vert ? [0.08, 0.16, BED] : [BED, 0.16, 0.08]} />
                      <meshStandardMaterial color={C.beltFrame} roughness={0.45} metalness={0.5} />
                    </mesh>
                  );
                })}
              {/* curved flow: entry arrow → corner roller → exit arrow */}
              <group position={[-ix * 0.3, 0, -iz * 0.3]} rotation={[0, DIR_YAW[inDir], 0]}><FlowArrow live={live} /></group>
              <mesh position={[0, SURF_Y + 0.01, 0]}><cylinderGeometry args={[0.06, 0.06, 0.1, 16]} /><meshStandardMaterial color={C.rollerHi} roughness={0.3} metalness={0.7} /></mesh>
              <group position={[ox * 0.3, 0, oz * 0.3]} rotation={[0, DIR_YAW[b.dir], 0]}><FlowArrow live={live} /></group>
            </group>
          );
        }

        // straight tile — authored flow-forward (+Z), rotated into place
        return (
          <group key={`${b.c},${b.r}`} position={[x, 0, z]} rotation={[0, DIR_YAW[b.dir], 0]}>
            {/* metal frame bed */}
            <RoundedBox args={[BED, 0.3, BED]} radius={0.05} position={[0, 0.2, 0]} receiveShadow>
              <meshStandardMaterial color={C.beltFrame} roughness={0.5} metalness={0.45} />
            </RoundedBox>
            {/* dark rubber belt surface, full length → seamless between tiles; the frame either
                side reads as the rails */}
            <mesh position={[0, SURF_Y - 0.01, 0]} receiveShadow>
              <boxGeometry args={[RUBBER_W, 0.05, BED]} />
              <meshStandardMaterial color={C.beltRubber} roughness={0.9} metalness={0.05} />
            </mesh>
            {/* polished seam rollers — pair up at each tile join */}
            <Roller z={-0.45} />
            <Roller z={0.45} />
            {/* subtle painted chevrons */}
            <FlowArrow live={live} z={-0.18} />
            <FlowArrow live={live} z={0.18} />
          </group>
        );
      })}
    </group>
  );
}

/* The device the player designed, as a small 3D model: silhouette by category, body colour by
   finish swatch, glowing screen. The "product IS the toy" pillar, on the belt (pillar #2). */
interface DeviceLook { body: string; accent: string; metallic: boolean; category: CategoryId | string }

export function productLook(product?: Product | null): DeviceLook {
  const finish = product?.finish ?? "aluminium";
  const sw = FINISH_SWATCHES[finish] ?? FINISH_SWATCHES.aluminium;
  const s = sw[(product?.colorIndex ?? 0) % sw.length] ?? sw[0];
  return { body: s.body, accent: s.accent, metallic: finish !== "plastic", category: product?.category ?? "phone" };
}

function DeviceForm({ look }: { look: DeviceLook }) {
  const bodyMat = (
    <meshStandardMaterial color={look.body} roughness={look.metallic ? 0.3 : 0.5} metalness={look.metallic ? 0.72 : 0.08} />
  );
  const Screen = ({ w, d, y = 0.045 }: { w: number; d: number; y?: number }) => (
    <mesh position={[0, y, 0]}>
      <boxGeometry args={[w, 0.008, d]} />
      <meshStandardMaterial color={C.screen} emissive={C.screen} emissiveIntensity={0.9} roughness={0.25} />
    </mesh>
  );
  switch (look.category) {
    case "tablet":
      return (<group><RoundedBox args={[0.46, 0.06, 0.62]} radius={0.03} castShadow>{bodyMat}</RoundedBox><Screen w={0.38} d={0.54} /></group>);
    case "laptop":
      return (
        <group>
          <RoundedBox args={[0.6, 0.05, 0.42]} radius={0.03} position={[0, 0, 0.1]} castShadow>{bodyMat}</RoundedBox>
          <group position={[0, 0.02, -0.11]} rotation={[-1.15, 0, 0]}>
            <RoundedBox args={[0.6, 0.04, 0.4]} radius={0.03} position={[0, 0, -0.2]} castShadow>{bodyMat}</RoundedBox>
            <mesh position={[0, 0.025, -0.2]}><boxGeometry args={[0.5, 0.008, 0.32]} /><meshStandardMaterial color={C.screen} emissive={C.screen} emissiveIntensity={0.8} /></mesh>
          </group>
        </group>
      );
    case "wearable":
      return (
        <group>
          <RoundedBox args={[0.28, 0.09, 0.32]} radius={0.06} castShadow>{bodyMat}</RoundedBox>
          <Screen w={0.2} d={0.22} y={0.05} />
          {[-0.22, 0.22].map((dz) => (<mesh key={dz} position={[0, -0.01, dz]}><boxGeometry args={[0.22, 0.05, 0.16]} /><meshStandardMaterial color={look.accent} roughness={0.6} /></mesh>))}
        </group>
      );
    case "console":
      return (<group><RoundedBox args={[0.6, 0.12, 0.4]} radius={0.04} castShadow>{bodyMat}</RoundedBox><mesh position={[0, 0.07, 0.1]}><boxGeometry args={[0.3, 0.01, 0.02]} /><meshStandardMaterial color={look.accent} emissive={look.accent} emissiveIntensity={0.8} /></mesh></group>);
    case "desktop":
      return (<group><RoundedBox args={[0.28, 0.5, 0.42]} radius={0.03} position={[0, 0.2, 0]} castShadow>{bodyMat}</RoundedBox><mesh position={[0.145, 0.28, 0]}><boxGeometry args={[0.01, 0.16, 0.1]} /><meshStandardMaterial color={look.accent} emissive={look.accent} emissiveIntensity={0.7} /></mesh></group>);
    case "monitor":
      return (<group><RoundedBox args={[0.62, 0.36, 0.05]} radius={0.02} position={[0, 0.28, 0]} castShadow>{bodyMat}</RoundedBox><mesh position={[0, 0.28, 0.03]}><boxGeometry args={[0.54, 0.28, 0.006]} /><meshStandardMaterial color={C.screen} emissive={C.screen} emissiveIntensity={0.8} /></mesh><mesh position={[0, 0.06, 0]}><boxGeometry args={[0.18, 0.12, 0.08]} />{bodyMat}</mesh></group>);
    case "experimental": // AR glasses
      return (<group><mesh position={[0, 0.08, 0]}><boxGeometry args={[0.6, 0.04, 0.06]} />{bodyMat}</mesh>{[-0.16, 0.16].map((dx) => (<mesh key={dx} position={[dx, 0.08, 0.04]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 0.02, 16]} /><meshStandardMaterial color={look.accent} transparent opacity={0.55} emissive={look.accent} emissiveIntensity={0.5} /></mesh>))}</group>);
    default: // phone
      return (<group><RoundedBox args={[0.3, 0.07, 0.58]} radius={0.04} castShadow>{bodyMat}</RoundedBox><Screen w={0.24} d={0.5} /></group>);
  }
}

/* One traveling item, four forms — slab → board → THE DEVICE (real product) → crate — toggled
   by arc position against the machine-derived transform marks. */
function TravelingItem({ index, itemsT, pl, marks, look }: {
  index: number; itemsT: ItemsRef; pl: Polyline; marks: [number, number, number]; look: DeviceLook;
}) {
  const grp = useRef<THREE.Group>(null);
  const forms = useRef<THREE.Group[]>([]);
  useFrame(() => {
    const t = itemsT.current[index];
    if (t == null || !grp.current || pl.total === 0) return;
    const [x, z] = polyAt(pl, t);
    grp.current.position.set(x, 0.46, z);
    const frac = (t % pl.total) / pl.total;
    const f = frac < marks[0] ? 0 : frac < marks[1] ? 1 : frac < marks[2] ? 2 : 3;
    forms.current.forEach((g, i) => { if (g) g.visible = i === f; });
  });
  return (
    <group ref={grp}>
      {/* 0 — raw slab */}
      <group ref={(g) => { if (g) forms.current[0] = g; }}>
        <mesh castShadow><boxGeometry args={[0.5, 0.1, 0.4]} /><meshStandardMaterial color={C.slab} roughness={0.4} metalness={0.6} /></mesh>
      </group>
      {/* 1 — logic board */}
      <group ref={(g) => { if (g) forms.current[1] = g; }}>
        <mesh castShadow><boxGeometry args={[0.44, 0.06, 0.34]} /><meshStandardMaterial color={C.board} roughness={0.6} /></mesh>
        <mesh position={[0.08, 0.05, 0]}><boxGeometry args={[0.12, 0.05, 0.12]} /><meshStandardMaterial color={C.dark} roughness={0.5} /></mesh>
      </group>
      {/* 2 — THE DEVICE the player designed */}
      <group ref={(g) => { if (g) forms.current[2] = g; }}>
        <DeviceForm look={look} />
      </group>
      {/* 3 — boxed crate (band tinted by the product accent for continuity) */}
      <group ref={(g) => { if (g) forms.current[3] = g; }}>
        <RoundedBox args={[0.44, 0.36, 0.44]} radius={0.04} castShadow>
          <meshStandardMaterial color={C.crate} roughness={0.8} />
        </RoundedBox>
        <mesh position={[0, 0, 0]}><boxGeometry args={[0.46, 0.07, 0.46]} /><meshStandardMaterial color={look.accent} roughness={0.7} /></mesh>
      </group>
    </group>
  );
}

/* ------------------------------- machines ------------------------------- */

function HotLight({ on, y = 2.4 }: { on: boolean; y?: number }) {
  return on ? <pointLight position={[0, y, 0]} intensity={9} distance={4.2} color={C.accent} /> : null;
}

/** Intake hopper — raw material funnels onto the line (Sourcing). */
function Intake({ active, hot, position, yaw = 0 }: { active: boolean; hot: boolean; position: [number, number, number]; yaw?: number }) {
  const puff = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!puff.current) return;
    const f = (clock.elapsedTime % 1.4) / 1.4;
    puff.current.position.y = 1.7 - f * 0.9;
    // Material puffs only while sourcing (its own stage) is the active step — otherwise the hopper is still.
    (puff.current.material as THREE.MeshStandardMaterial).opacity = active && hot ? 0.75 * (1 - f) : 0;
  });
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* frame */}
      {[-0.55, 0.55].map((dx) => (
        <mesh key={dx} position={[dx, 1.1, 0]} castShadow>
          <boxGeometry args={[0.12, 2.2, 0.12]} />
          <meshStandardMaterial color={C.machine} roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
      {/* inverted funnel */}
      <mesh position={[0, 1.9, 0]} castShadow>
        <cylinderGeometry args={[0.75, 0.3, 0.8, 4, 1, false, Math.PI / 4]} />
        <meshStandardMaterial color={C.machineHi} roughness={0.55} metalness={0.35} emissive={hot ? C.accent : "#000"} emissiveIntensity={hot ? 0.2 : 0} />
      </mesh>
      <mesh ref={puff} position={[0, 1.4, 0]}>
        <boxGeometry args={[0.34, 0.1, 0.3]} />
        <meshStandardMaterial color={C.slab} transparent opacity={0.6} roughness={0.4} />
      </mesh>
      <HazardBase w={1.6} d={1.6} />
      <HotLight on={hot} />
    </group>
  );
}

/** Gantry press straddling the line — dual pistons stamp passing boards (Tooling). */
function GantryPress({ active, hot, position, yaw = 0, pl, itemsT }: { active: boolean; hot: boolean; position: [number, number, number]; yaw?: number; pl?: Polyline; itemsT?: ItemsRef }) {
  const ram = useRef<THREE.Group>(null);
  const eng = useRef(0);
  useFrame(() => {
    if (!ram.current) return;
    // Only the machine working the current stage moves; it slams DOWN as the item reaches the ram.
    const d = pl && itemsT ? nearestItemDist(pl, itemsT.current, position[0], position[2]) : Infinity;
    const target = active && hot ? Math.max(0, 1 - d / 0.95) : 0;
    eng.current += (target - eng.current) * 0.5;
    ram.current.position.y = 1.55 - (eng.current ** 1.4) * 0.82;
  });
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {[-0.9, 0.9].map((dx) => (
        <mesh key={dx} position={[dx, 1.0, 0]} castShadow>
          <boxGeometry args={[0.28, 2.0, 0.5]} />
          <meshStandardMaterial color={C.machine} roughness={0.6} metalness={0.3} emissive={hot ? C.accent : "#000"} emissiveIntensity={hot ? 0.22 : 0} />
        </mesh>
      ))}
      <RoundedBox args={[2.15, 0.5, 0.8]} radius={0.08} position={[0, 2.15, 0]} castShadow>
        <meshStandardMaterial color={C.machineHi} roughness={0.5} metalness={0.4} />
      </RoundedBox>
      {/* status strip */}
      <mesh position={[0, 2.15, 0.42]}>
        <boxGeometry args={[1.6, 0.1, 0.02]} />
        <meshStandardMaterial color={hot ? C.accent : C.amber} emissive={hot ? C.accent : C.amber} emissiveIntensity={1.2} />
      </mesh>
      <group ref={ram} position={[0, 1.55, 0]}>
        {[-0.45, 0.45].map((dx) => (
          <mesh key={dx} position={[dx, 0, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.9, 12]} />
            <meshStandardMaterial color={C.rail} roughness={0.35} metalness={0.6} />
          </mesh>
        ))}
        <RoundedBox args={[1.3, 0.32, 0.6]} radius={0.06} position={[0, -0.55, 0]} castShadow>
          <meshStandardMaterial color={C.accent} roughness={0.45} />
        </RoundedBox>
      </group>
      <HazardBase w={2.4} d={1.7} />
      <HotLight on={hot} y={2.9} />
    </group>
  );
}

/** Industrial robot arm — turntable, shoulder, elbow, wrist, two-finger gripper. */
function RobotArm({ active, hot, position, pl, itemsT }: {
  active: boolean; hot: boolean; position: [number, number, number]; pl?: Polyline; itemsT?: ItemsRef;
}) {
  const yaw = useRef<THREE.Group>(null);
  const shoulder = useRef<THREE.Group>(null);
  const elbow = useRef<THREE.Group>(null);
  const wrist = useRef<THREE.Group>(null);
  const eng = useRef(0);
  useFrame(({ clock }) => {
    // Find the nearest item + its offset, so the arm can turn TOWARD it and reach down as it arrives.
    let d = Infinity, ix = position[0], iz = position[2];
    if (pl && itemsT) {
      for (const t of itemsT.current) {
        const [x, z] = polyAt(pl, t);
        const dd = Math.hypot(x - position[0], z - position[2]);
        if (dd < d) { d = dd; ix = x; iz = z; }
      }
    }
    // Only works during its own (assembly) stage; otherwise it rests, perfectly still.
    const target = active && hot ? Math.max(0, 1 - d / 1.7) : 0;
    eng.current += (target - eng.current) * 0.22;
    const reach = eng.current;
    const face = Math.atan2(ix - position[0], iz - position[2]); // yaw toward the item, only while reaching
    if (yaw.current) yaw.current.rotation.y = face * reach;
    if (shoulder.current) shoulder.current.rotation.x = -0.3 - reach * 0.7 + Math.sin(clock.elapsedTime * 4) * 0.06 * reach; // dip to the belt + work jitter (only while reaching)
    if (elbow.current) elbow.current.rotation.x = 0.85 + reach * 0.55;
    if (wrist.current) wrist.current.rotation.x = -0.45 - reach * 0.35;
  });
  return (
    <group position={position}>
      {/* plinth + turntable */}
      <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.6, 0.28, 24]} />
        <meshStandardMaterial color={C.dark} roughness={0.7} />
      </mesh>
      <group ref={yaw} position={[0, 0.28, 0]}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.42, 0.26, 20]} />
          <meshStandardMaterial color={C.amber} roughness={0.5} emissive={hot ? C.accent : "#000"} emissiveIntensity={hot ? 0.18 : 0} />
        </mesh>
        {/* shoulder joint + upper arm */}
        <group ref={shoulder} position={[0, 0.3, 0]}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[0.24, 1.1, 0.3]} />
            <meshStandardMaterial color={C.amber} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.17, 0.17, 0.4, 16]} />
            <meshStandardMaterial color={C.machine} roughness={0.4} metalness={0.4} />
          </mesh>
          {/* elbow + forearm */}
          <group ref={elbow} position={[0, 1.1, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.14, 0.14, 0.36, 16]} />
              <meshStandardMaterial color={C.machine} roughness={0.4} metalness={0.4} />
            </mesh>
            <mesh position={[0, 0.42, 0]} castShadow>
              <boxGeometry args={[0.18, 0.84, 0.22]} />
              <meshStandardMaterial color={C.amber} roughness={0.5} />
            </mesh>
            {/* wrist + gripper */}
            <group ref={wrist} position={[0, 0.86, 0]}>
              <mesh><sphereGeometry args={[0.12, 14, 14]} /><meshStandardMaterial color={C.machineHi} roughness={0.35} metalness={0.5} /></mesh>
              {[-0.07, 0.07].map((dx) => (
                <mesh key={dx} position={[dx, 0.16, 0]} castShadow>
                  <boxGeometry args={[0.045, 0.22, 0.1]} />
                  <meshStandardMaterial color={C.dark} roughness={0.5} />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      </group>
      <HazardBase w={1.3} d={1.3} />
      <HotLight on={hot} y={2.1} />
    </group>
  );
}

/** QA tunnel — a glass scanner the finished device passes through (Quality). */
function QaTunnel({ active, hot, position, yaw = 0, pl, itemsT }: { active: boolean; hot: boolean; position: [number, number, number]; yaw?: number; pl?: Polyline; itemsT?: ItemsRef }) {
  const beam = useRef<THREE.Mesh>(null);
  const eng = useRef(0);
  useFrame(({ clock }) => {
    if (!beam.current) return;
    const d = pl && itemsT ? nearestItemDist(pl, itemsT.current, position[0], position[2]) : Infinity;
    const target = active && hot ? Math.max(0, 1 - d / 1.1) : 0;   // only scans during its own (QA) stage
    eng.current += (target - eng.current) * 0.3;
    beam.current.position.x = Math.sin(clock.elapsedTime * 3) * 0.55 * eng.current; // sweeps only while a unit is inside
    const mat = beam.current.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.08 + eng.current * 0.62;        // the scan lights up while a device is inside, dark otherwise
    mat.emissiveIntensity = eng.current * 2.1;
  });
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <RoundedBox args={[2.0, 1.15, 1.25]} radius={0.1} position={[0, 0.85, 0]} castShadow>
        <meshStandardMaterial color={C.glass} transparent opacity={0.22} roughness={0.15} metalness={0.1} />
      </RoundedBox>
      {/* frame ribs */}
      {[-0.85, 0.85].map((dx) => (
        <mesh key={dx} position={[dx, 0.85, 0]} castShadow>
          <boxGeometry args={[0.16, 1.2, 1.3]} />
          <meshStandardMaterial color={C.machine} roughness={0.55} metalness={0.3} emissive={hot ? C.accent : "#000"} emissiveIntensity={hot ? 0.25 : 0} />
        </mesh>
      ))}
      {/* sweeping scan sheet */}
      <mesh ref={beam} position={[0, 0.85, 0]}>
        <boxGeometry args={[0.03, 1.0, 1.1]} />
        <meshStandardMaterial color={C.accent} emissive={C.accent} emissiveIntensity={1.6} transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[1.7, 0.08, 0.02]} />
        <meshStandardMaterial color={hot ? C.accent : C.amber} emissive={hot ? C.accent : C.amber} emissiveIntensity={1.1} />
      </mesh>
      <HazardBase w={2.3} d={1.8} />
      <HotLight on={hot} y={2.2} />
    </group>
  );
}

/** Packer at the end of the line — folding plates box the device (Packaging). */
function Packer({ active, hot, position, yaw = 0, pl, itemsT }: { active: boolean; hot: boolean; position: [number, number, number]; yaw?: number; pl?: Polyline; itemsT?: ItemsRef }) {
  const l = useRef<THREE.Mesh>(null);
  const r = useRef<THREE.Mesh>(null);
  const eng = useRef(0);
  useFrame(() => {
    const d = pl && itemsT ? nearestItemDist(pl, itemsT.current, position[0], position[2]) : Infinity;
    const target = active && hot ? Math.max(0, 1 - d / 0.95) : 0;   // only folds during its own (packaging) stage
    eng.current += (target - eng.current) * 0.4;
    const c = eng.current; // plates fold shut around the device as it reaches the packer
    if (l.current) l.current.rotation.z = -0.2 - c * 0.95;
    if (r.current) r.current.rotation.z = 0.2 + c * 0.95;
  });
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <RoundedBox args={[1.5, 0.5, 1.2]} radius={0.07} position={[0, 0.55, 0]} castShadow>
        <meshStandardMaterial color={C.machine} roughness={0.6} emissive={hot ? C.accent : "#000"} emissiveIntensity={hot ? 0.22 : 0} />
      </RoundedBox>
      <mesh ref={l} position={[-0.6, 0.95, 0]} castShadow>
        <boxGeometry args={[0.08, 0.7, 1.0]} />
        <meshStandardMaterial color={C.hazard} roughness={0.6} />
      </mesh>
      <mesh ref={r} position={[0.6, 0.95, 0]} castShadow>
        <boxGeometry args={[0.08, 0.7, 1.0]} />
        <meshStandardMaterial color={C.hazard} roughness={0.6} />
      </mesh>
      <HazardBase w={1.9} d={1.6} />
      <HotLight on={hot} y={1.9} />
    </group>
  );
}

/** CNC mill — a milling cell the chassis passes through; the spindle traverses + plunges + spins
 *  to cut the unibody (used for laptop / desktop chassis). */
function CncMill({ active, hot, position, yaw = 0, pl, itemsT }: { active: boolean; hot: boolean; position: [number, number, number]; yaw?: number; pl?: Polyline; itemsT?: ItemsRef }) {
  const spindle = useRef<THREE.Group>(null);
  const bit = useRef<THREE.Mesh>(null);
  const eng = useRef(0);
  useFrame(({ clock }) => {
    const d = pl && itemsT ? nearestItemDist(pl, itemsT.current, position[0], position[2]) : Infinity;
    const target = active && hot ? Math.max(0, 1 - d / 1.0) : 0;   // only cuts during its own (milling) stage
    eng.current += (target - eng.current) * 0.3;
    const c = eng.current;
    if (spindle.current) {
      spindle.current.position.x = Math.sin(clock.elapsedTime * 2.2) * 0.45 * c; // traverses across the work
      spindle.current.position.y = 1.15 - c * 0.33;                              // plunges onto it
    }
    if (bit.current) bit.current.rotation.y += 0.6 * c;                          // tool spins while cutting
  });
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* side walls form a cell the belt runs through */}
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} position={[x, 0.85, 0]} castShadow>
          <boxGeometry args={[0.22, 1.7, 1.2]} />
          <meshStandardMaterial color={C.machine} roughness={0.55} metalness={0.4} emissive={hot ? C.accent : "#000"} emissiveIntensity={hot ? 0.2 : 0} />
        </mesh>
      ))}
      {/* top gantry beam + status strip */}
      <RoundedBox args={[2.0, 0.28, 0.5]} radius={0.06} position={[0, 1.75, 0]} castShadow>
        <meshStandardMaterial color={C.machineHi} roughness={0.5} metalness={0.45} />
      </RoundedBox>
      <mesh position={[0, 1.75, 0.27]}><boxGeometry args={[1.5, 0.08, 0.02]} /><meshStandardMaterial color={hot ? C.accent : C.amber} emissive={hot ? C.accent : C.amber} emissiveIntensity={1.0} /></mesh>
      {/* spindle head — traverses + plunges; the bit spins */}
      <group ref={spindle} position={[0, 1.15, 0]}>
        <mesh castShadow><boxGeometry args={[0.3, 0.42, 0.32]} /><meshStandardMaterial color={C.rail} roughness={0.4} metalness={0.55} /></mesh>
        <mesh ref={bit} position={[0, -0.34, 0]}><cylinderGeometry args={[0.05, 0.018, 0.3, 12]} /><meshStandardMaterial color="#c9ced6" roughness={0.25} metalness={0.85} /></mesh>
      </group>
      <HazardBase w={2.2} d={1.5} />
      <HotLight on={hot} y={2.2} />
    </group>
  );
}

/** Screen bonder — a laminating head lowers a display panel onto the device and cures it (used for
 *  phone / tablet screen bonding + monitor panel lamination). */
function ScreenBonder({ active, hot, position, yaw = 0, pl, itemsT }: { active: boolean; hot: boolean; position: [number, number, number]; yaw?: number; pl?: Polyline; itemsT?: ItemsRef }) {
  const head = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const eng = useRef(0);
  useFrame(() => {
    const d = pl && itemsT ? nearestItemDist(pl, itemsT.current, position[0], position[2]) : Infinity;
    const target = active && hot ? Math.max(0, 1 - d / 0.9) : 0;   // only bonds during its own (screen) stage
    eng.current += (target - eng.current) * 0.35;
    const c = eng.current;
    if (head.current) head.current.position.y = 1.5 - c * 0.92;                                  // lowers the panel
    if (glow.current) (glow.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25 + c * 1.7; // cure glow
  });
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* uprights + crossbeam */}
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} position={[x, 0.9, 0]} castShadow>
          <boxGeometry args={[0.18, 1.8, 0.3]} />
          <meshStandardMaterial color={C.machine} roughness={0.55} metalness={0.4} emissive={hot ? C.accent : "#000"} emissiveIntensity={hot ? 0.2 : 0} />
        </mesh>
      ))}
      <RoundedBox args={[1.9, 0.26, 0.55]} radius={0.06} position={[0, 1.85, 0]} castShadow>
        <meshStandardMaterial color={C.machineHi} roughness={0.5} metalness={0.4} />
      </RoundedBox>
      <mesh position={[0, 1.85, 0.29]}><boxGeometry args={[1.4, 0.08, 0.02]} /><meshStandardMaterial color={hot ? C.accent : C.amber} emissive={hot ? C.accent : C.amber} emissiveIntensity={1.0} /></mesh>
      {/* descending laminator head holding a glass panel */}
      <group ref={head} position={[0, 1.5, 0]}>
        <RoundedBox args={[1.1, 0.16, 0.7]} radius={0.04} castShadow><meshStandardMaterial color={C.rail} roughness={0.4} metalness={0.5} /></RoundedBox>
        <mesh ref={glow} position={[0, -0.1, 0]}><boxGeometry args={[0.9, 0.04, 0.6]} /><meshStandardMaterial color={C.screen} emissive={C.screen} emissiveIntensity={0.25} transparent opacity={0.85} roughness={0.15} metalness={0.1} /></mesh>
      </group>
      <HazardBase w={2.0} d={1.3} />
      <HotLight on={hot} y={2.2} />
    </group>
  );
}

/* --------------------------------- props ---------------------------------- */

const PROP_WOOD = "#7d6743";
const PROP_GREEN = "#3f8f5a";

/** A cosmetic prop placed on the floor. Static (decor); positioned at its cell centre. */
function PropAt({ prop }: { prop: PlacedProp }) {
  const [x, z] = propCenter(prop);
  const pos: [number, number, number] = [x, 0.09, z];
  switch (prop.kind) {
    case "crates":
      return (
        <group position={pos}>
          {[[-0.16, 0.24, -0.12, 0.44], [0.18, 0.22, 0.14, 0.42], [0.0, 0.66, 0.0, 0.4]].map(([dx, y, dz, s], i) => (
            <RoundedBox key={i} args={[s as number, 0.4, s as number]} radius={0.04} position={[dx as number, y as number, dz as number]} rotation={[0, i * 0.4, 0]} castShadow receiveShadow>
              <meshStandardMaterial color={C.crate} roughness={0.85} />
            </RoundedBox>
          ))}
        </group>
      );
    case "barrel":
      return (
        <group position={pos}>
          {[[-0.2, 0], [0.2, 0.05], [0.0, -0.22]].map(([dx, dz], i) => (
            <mesh key={i} position={[dx, 0.34, dz]} castShadow receiveShadow>
              <cylinderGeometry args={[0.19, 0.19, 0.62, 18]} />
              <meshStandardMaterial color={i === 1 ? C.accent : "#c9722f"} roughness={0.5} metalness={0.3} />
            </mesh>
          ))}
        </group>
      );
    case "pallet":
      return (
        <group position={pos}>
          <mesh position={[0, 0.07, 0]} castShadow receiveShadow><boxGeometry args={[0.9, 0.1, 0.9]} /><meshStandardMaterial color={PROP_WOOD} roughness={0.9} /></mesh>
          {[-0.32, 0, 0.32].map((z2) => (<mesh key={z2} position={[0, 0.15, z2]}><boxGeometry args={[0.9, 0.05, 0.2]} /><meshStandardMaterial color="#8f7850" roughness={0.9} /></mesh>))}
        </group>
      );
    case "plant":
      return (
        <group position={pos}>
          <mesh position={[0, 0.22, 0]} castShadow><cylinderGeometry args={[0.24, 0.19, 0.44, 16]} /><meshStandardMaterial color="#4a4f57" roughness={0.7} /></mesh>
          {[[0, 0.62, 0, 0.3], [-0.14, 0.72, 0.06, 0.2], [0.14, 0.7, -0.05, 0.22]].map(([dx, y, dz, r], i) => (
            <mesh key={i} position={[dx as number, y as number, dz as number]} castShadow><sphereGeometry args={[r as number, 12, 12]} /><meshStandardMaterial color={PROP_GREEN} roughness={0.8} /></mesh>
          ))}
        </group>
      );
    case "bench":
      return (
        <group position={pos}>
          <RoundedBox args={[1.7, 0.12, 0.7]} radius={0.03} position={[0, 0.62, 0]} castShadow receiveShadow><meshStandardMaterial color={C.machineHi} roughness={0.5} metalness={0.3} /></RoundedBox>
          {[[-0.75, -0.28], [0.75, -0.28], [-0.75, 0.28], [0.75, 0.28]].map(([lx, lz], i) => (<mesh key={i} position={[lx, 0.3, lz]}><boxGeometry args={[0.09, 0.6, 0.09]} /><meshStandardMaterial color={C.machine} roughness={0.6} metalness={0.3} /></mesh>))}
          <mesh position={[0.35, 0.74, 0]}><boxGeometry args={[0.3, 0.06, 0.2]} /><meshStandardMaterial color={C.accent} roughness={0.5} /></mesh>
          <mesh position={[-0.4, 0.75, 0.1]}><boxGeometry args={[0.24, 0.08, 0.16]} /><meshStandardMaterial color={C.amber} roughness={0.6} /></mesh>
        </group>
      );
    case "rack":
      return (
        <group position={pos}>
          {[-0.82, 0.82].map((lx) => [-0.3, 0.3].map((lz) => (<mesh key={`${lx},${lz}`} position={[lx, 0.8, lz]}><boxGeometry args={[0.08, 1.6, 0.08]} /><meshStandardMaterial color={C.rail} roughness={0.5} metalness={0.5} /></mesh>)))}
          {[0.5, 1.05, 1.55].map((y) => (
            <group key={y}>
              <mesh position={[0, y, 0]}><boxGeometry args={[1.72, 0.06, 0.66]} /><meshStandardMaterial color={C.machine} roughness={0.6} metalness={0.3} /></mesh>
              {y < 1.5 && [-0.45, 0.1, 0.5].map((bx, i) => (<RoundedBox key={i} args={[0.34, 0.34, 0.4]} radius={0.03} position={[bx, y + 0.23, 0]} castShadow><meshStandardMaterial color={i % 2 ? C.crate : "#8f7850"} roughness={0.85} /></RoundedBox>))}
            </group>
          ))}
        </group>
      );
    case "cone":
      return (
        <group position={pos}>
          <mesh position={[0, 0.06, 0]}><boxGeometry args={[0.34, 0.06, 0.34]} /><meshStandardMaterial color="#e0842f" roughness={0.7} /></mesh>
          <mesh position={[0, 0.32, 0]} castShadow><coneGeometry args={[0.14, 0.5, 20]} /><meshStandardMaterial color="#f28a2e" roughness={0.55} emissive="#f28a2e" emissiveIntensity={0.15} /></mesh>
          <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[0.11, 0.13, 0.1, 20]} /><meshStandardMaterial color="#f5f5f5" roughness={0.5} /></mesh>
        </group>
      );
    case "sign":
      return (
        <group position={pos}>
          <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.04, 0.04, 1.0, 10]} /><meshStandardMaterial color={C.machine} roughness={0.5} metalness={0.4} /></mesh>
          <mesh position={[0, 1.05, 0]} rotation={[0, 0, Math.PI / 4]} castShadow><boxGeometry args={[0.34, 0.34, 0.03]} /><meshStandardMaterial color={C.hazard} emissive={C.hazard} emissiveIntensity={0.5} roughness={0.5} /></mesh>
          <mesh position={[0, 1.05, 0.02]}><boxGeometry args={[0.04, 0.2, 0.01]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
        </group>
      );
  }
}

/* ------------------------------ building shell ------------------------------ */

const SHELL = { d: 10.6, wallH: 1.35, t: 0.24 };

/** The factory building: a poured-concrete floor inside painted perimeter walls with a capping
 *  rail and a dark skirting. Walls are kept low so machines rise above them and the camera sees in;
 *  the front-left corner (the dock) is left open so the line ships out to the truck. Grows EAST with
 *  floor expansions (origin fixed). The wall colour and floor tint are player-customisable (decor). */
function FactoryShell({ wallColor, floorColor, floorW }: { wallColor: string; floorColor: string; floorW: number }) {
  const { d, wallH, t } = SHELL;
  const w = floorW + 0.6;              // slab a touch wider than the cells
  const cx = (floorW - FLOOR.w) / 2;   // east shift as the grid widens (base = 0)
  const wall = (key: string, args: [number, number, number], pos: [number, number, number]) => (
    <group key={key} position={pos}>
      <mesh position={[0, wallH / 2 + 0.14, 0]} castShadow receiveShadow>
        <boxGeometry args={args} />
        <meshStandardMaterial color={wallColor} roughness={0.92} metalness={0.02} />
      </mesh>
      {/* dark skirting along the base */}
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[args[0] + 0.02, 0.34, args[2] + 0.02]} />
        <meshStandardMaterial color={C.wallTrim} roughness={0.85} />
      </mesh>
      {/* pale capping rail along the top */}
      <mesh position={[0, wallH + 0.16, 0]}>
        <boxGeometry args={[args[0] + 0.05, 0.1, args[2] + 0.05]} />
        <meshStandardMaterial color={C.wallTop} roughness={0.6} metalness={0.1} />
      </mesh>
    </group>
  );
  return (
    <group position={[cx, 0, 0]}>
      {/* concrete floor slab */}
      <RoundedBox args={[w, 0.16, d]} radius={0.1} position={[0, 0.02, 0]} receiveShadow>
        <meshStandardMaterial color={floorColor} roughness={0.97} metalness={0.02} />
      </RoundedBox>
      {/* painted safety border just inside the walls */}
      {[d / 2 - 0.55, -(d / 2 - 0.55)].map((bz, i) => (
        <mesh key={`bx${i}`} position={[0, 0.11, bz]}><boxGeometry args={[w - 1.0, 0.02, 0.08]} /><meshStandardMaterial color={C.hazard} roughness={0.7} emissive={C.hazard} emissiveIntensity={0.12} /></mesh>
      ))}
      {[w / 2 - 0.55, -(w / 2 - 0.55)].map((bx, i) => (
        <mesh key={`bz${i}`} position={[bx, 0.11, 0]}><boxGeometry args={[0.08, 0.02, d - 1.1]} /><meshStandardMaterial color={C.hazard} roughness={0.7} emissive={C.hazard} emissiveIntensity={0.12} /></mesh>
      ))}
      {/* three walls; the front-left (dock corner) stays open */}
      {wall("back", [w + t, wallH, t], [0, 0, -d / 2])}
      {wall("right", [t, wallH, d + t], [w / 2, 0, 0])}
      {wall("front", [w + t, wallH, t], [0, 0, d / 2])}
    </group>
  );
}

/* ------------------------------ dock & extras ------------------------------ */

/** The loading pallet at the line's end — a wooden pallet the packed crates stack onto (growing
 *  with the ready count), sitting right where the belt tail runs off, beside the delivery truck. */
function Pallet({ position, yaw = 0, count }: { position: [number, number, number]; yaw?: number; count: number }) {
  const stacks = Math.max(0, Math.min(6, count));
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* wooden pallet base + top slats */}
      <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.3, 0.12, 1.3]} />
        <meshStandardMaterial color="#5f4c2f" roughness={0.92} />
      </mesh>
      {[-0.45, 0, 0.45].map((z) => (
        <mesh key={z} position={[0, 0.15, z]} receiveShadow>
          <boxGeometry args={[1.3, 0.05, 0.3]} />
          <meshStandardMaterial color="#7d6743" roughness={0.9} />
        </mesh>
      ))}
      {/* finished-goods crates stack up with the ready count */}
      {Array.from({ length: Math.max(1, stacks) }, (_, i) => (
        <RoundedBox key={i} args={[0.5, 0.4, 0.5]} radius={0.04}
          position={[((i % 2) - 0.5) * 0.56, 0.38 + Math.floor(i / 4) * 0.42, (Math.floor(i / 2) % 2 - 0.5) * 0.56]}
          castShadow receiveShadow>
          <meshStandardMaterial color={C.crate} roughness={0.8} transparent={stacks === 0} opacity={stacks === 0 ? 0.22 : 1} />
        </RoundedBox>
      ))}
    </group>
  );
}

function Truck({ selling, position, yaw = 0 }: { selling: boolean; position: [number, number, number]; yaw?: number }) {
  const grp = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (grp.current) grp.current.position.y = selling ? Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.012 : 0; // subtle idle rumble while shipping
  });
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <group ref={grp}>
        {/* box body (rear, toward the pallet) + cab (front) */}
        <RoundedBox args={[1.0, 1.1, 2.3]} radius={0.08} position={[0, 0.78, -0.35]} castShadow>
          <meshStandardMaterial color={C.truck} roughness={0.55} />
        </RoundedBox>
        <RoundedBox args={[0.95, 0.85, 0.8]} radius={0.1} position={[0, 0.65, 1.25]} castShadow>
          <meshStandardMaterial color={C.cab} roughness={0.5} />
        </RoundedBox>
        <mesh position={[0, 0.72, 1.66]}>
          <boxGeometry args={[0.8, 0.3, 0.02]} />
          <meshStandardMaterial color={C.screen} roughness={0.2} metalness={0.3} />
        </mesh>
        {[[-0.55, -1.0], [0.55, -1.0], [-0.55, 0.2], [0.55, 0.2], [-0.55, 1.15], [0.55, 1.15]].map(([wx, wz], i) => (
          <mesh key={i} position={[wx, 0.28, wz]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.28, 0.28, 0.18, 18]} />
            <meshStandardMaterial color="#15181d" roughness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Agvs({ tier, overtime }: { tier: number; overtime: boolean }) {
  const refs = useRef<THREE.Group[]>([]);
  const t0 = useRef(0);
  useFrame((_, dt) => {
    t0.current += dt * 0.8;
    refs.current.forEach((g, i) => {
      if (!g) return;
      // patrol a wide oval around the whole line
      const a = t0.current * 0.35 + (i * Math.PI * 2) / 3;
      g.position.set(Math.cos(a) * 7.4, 0.16, Math.sin(a) * 4.4);
      g.rotation.y = -a;
    });
  });
  const n = Math.max(0, Math.min(3, tier));
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} ref={(g) => { if (g) refs.current[i] = g; }}>
          <RoundedBox args={[0.55, 0.22, 0.4]} radius={0.08} castShadow>
            <meshStandardMaterial color={C.agv} roughness={0.5} />
          </RoundedBox>
          <mesh position={[0, 0.18, 0]}>
            <boxGeometry args={[0.3, 0.14, 0.3]} />
            <meshStandardMaterial color={C.crate} roughness={0.8} />
          </mesh>
          <mesh position={[0.2, 0.24, 0]}>
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshStandardMaterial color={overtime ? C.amber : "#34d399"} emissive={overtime ? C.amber : "#34d399"} emissiveIntensity={1.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* --------------------------------- scene --------------------------------- */

/** Default framing for the floor — set ONCE at creation by aspect, then OrbitControls owns the
 *  camera so the player can orbit/zoom with touch. */
/** Frame the floor. `cx` is the building's east-shift from expansions, so the view follows the
 *  wider building (shifts + widens as bays are added). */
function frameCamera(cam: THREE.PerspectiveCamera, portrait: boolean, cx = 0) {
  cam.fov = (portrait ? 54 : 30) + cx * 0.9;
  if (portrait) cam.position.set(12.2 + cx, 16.6, 13.4);
  else cam.position.set(10.6 + cx, 13.1, 11.6);
  cam.lookAt(cx, -0.3, 0);
  cam.updateProjectionMatrix();
}

/** Re-frames the camera to its default when the HUD's recenter button bumps `signal`. */
function CameraReset({ signal, cx }: { signal: number; cx: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void } | null;
  const size = useThree((s) => s.size);
  const seen = useRef(signal);
  useFrame(() => {
    if (seen.current === signal) return;
    seen.current = signal;
    frameCamera(camera as THREE.PerspectiveCamera, size.height > size.width, cx);
    if (controls) { controls.target.set(cx, -0.3, 0); controls.update(); }
  });
  return null;
}

/** Brief green/red pulse on the last-tapped cell — placement feedback you can aim by. */
function TapFlash({ flash }: { flash: { c: number; r: number; ok: boolean; n: number } }) {
  const mesh = useRef<THREE.Mesh>(null);
  const born = useRef(0);
  const seen = useRef(-1);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    if (seen.current !== flash.n) { seen.current = flash.n; born.current = clock.elapsedTime; }
    const age = clock.elapsedTime - born.current;
    const a = Math.max(0, 0.75 - age * 1.6);
    (mesh.current.material as THREE.MeshBasicMaterial).opacity = a;
    mesh.current.visible = a > 0.01;
  });
  const [x, z] = worldOf(flash.c, flash.r);
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.13, z]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color={flash.ok ? "#34d399" : "#ef4444"} transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function MachineAt({ m, active, activeKind, pl, itemsT }: {
  m: FactoryFloor["machines"][number]; active: boolean; activeKind: MachineKind | null; pl: Polyline; itemsT: ItemsRef;
}) {
  const [cx, cz] = machineCenter(m);
  // Snap the machine ONTO the belt so the product runs through it. Straddlers (mill / press / screen
  // / QA / packer / intake) sit centred on the line and face along it; the robot arm stands beside
  // the belt and reaches over. If there's no line yet, fall back to the raw cell centre.
  const snap = snapToBelt(pl, cx, cz);
  const onBelt: [number, number, number] = snap ? [snap.x, 0, snap.z] : [cx, 0, cz];
  const yaw = snap ? snap.yaw : 0;
  const hot = active && activeKind === m.kind; // only the machine working the current step animates
  switch (m.kind) {
    case "intake": return <Intake active={active} hot={hot} position={onBelt} yaw={yaw} />;
    case "mill": return <CncMill active={active} hot={hot} position={onBelt} yaw={yaw} pl={pl} itemsT={itemsT} />;
    case "press": return <GantryPress active={active} hot={hot} position={onBelt} yaw={yaw} pl={pl} itemsT={itemsT} />;
    case "screen": return <ScreenBonder active={active} hot={hot} position={onBelt} yaw={yaw} pl={pl} itemsT={itemsT} />;
    case "qa": return <QaTunnel active={active} hot={hot} position={onBelt} yaw={yaw} pl={pl} itemsT={itemsT} />;
    case "packer": return <Packer active={active} hot={hot} position={onBelt} yaw={yaw} pl={pl} itemsT={itemsT} />;
    case "arm": {
      // beside the belt on the side it was placed, reaching over the line
      const side = snap ? Math.sign((cx - snap.x) * snap.nx + (cz - snap.z) * snap.nz) || 1 : 1;
      const armPos: [number, number, number] = snap ? [snap.x + snap.nx * side * 0.95, 0, snap.z + snap.nz * side * 0.95] : [cx, 0, cz];
      return <RobotArm active={active} hot={hot} position={armPos} pl={pl} itemsT={itemsT} />;
    }
  }
}

function Scene(p: Factory3DProps) {
  const { size } = useThree();
  const portrait = size.height > size.width;
  const world = useRef<THREE.Group>(null);
  const floorW = p.floorW ?? FLOOR.w;      // buildable width in cells (grows east with expansions)
  const cx = (floorW - FLOOR.w) / 2;       // east shift of the building centre (origin fixed)

  // The belts ARE the path: chain them, then derive where the item transforms.
  const pl = useMemo(() => makePolyline(beltPath(p.floor.belts)), [p.floor.belts]);
  const marks = useMemo(() => formMarks(p.floor, pl.pts), [p.floor, pl.pts]);

  // The line ENDS at a dock: a pallet just past the belt tail with the delivery truck behind it,
  // both aimed along the tail's flow — so wherever the player routes the line, it ships from its end.
  const dock = useMemo(() => {
    const n = pl.pts.length;
    if (n < 2) return null;
    const [tx, tz] = pl.pts[n - 1];
    const [px, pz] = pl.pts[n - 2];
    let dx = tx - px, dz = tz - pz;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    return {
      yaw: Math.atan2(dx, dz),
      pallet: [tx + dx * 1.15, 0, tz + dz * 1.15] as [number, number, number],
      truck: [tx + dx * 3.1, 0, tz + dz * 3.1] as [number, number, number],
      road: [tx + dx * 2.4, 0, tz + dz * 2.4] as [number, number, number],
    };
  }, [pl]);

  const look = useMemo(() => productLook(p.product), [p.product]);
  const itemsT = useRef<number[]>([0, 0.25, 0.5, 0.75].map((f) => f * Math.max(1, pl.total)));
  useFrame((_, dt) => {
    if (!p.active || pl.total === 0) return;
    const v = (p.overtime ? 2.1 : 1.25) * dt;
    itemsT.current = itemsT.current.map((t) => (t + v) % pl.total);
  });

  // Build mode: a TAP on the pad places (a drag orbits the camera instead). Record the pointer-down
  // screen position; on release, only place if the pointer barely moved — so drag-to-rotate never
  // drops a machine. Cell is read in the WORLD group's local space, so the framing can't skew it.
  const padDown = useRef<{ x: number; y: number } | null>(null);
  const onPadDown = (e: { nativeEvent: PointerEvent }) => {
    padDown.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
  };
  const onPadUp = (e: { point: THREE.Vector3; nativeEvent: PointerEvent }) => {
    const start = padDown.current;
    padDown.current = null;
    if (!p.buildMode || !p.onTapCell || !world.current || !start) return;
    if (Math.hypot(e.nativeEvent.clientX - start.x, e.nativeEvent.clientY - start.y) > 10) return; // a drag, not a tap
    const local = world.current.worldToLocal(e.point.clone());
    const c = Math.round(local.x + (FLOOR.w - 1) / 2);
    const r = Math.round(local.z + (FLOOR.h - 1) / 2);
    if (c >= 0 && c < floorW && r >= 0 && r < FLOOR.h) p.onTapCell(c, r);
  };

  return (
    <group ref={world} rotation={[0, portrait ? Math.PI / 2 : 0, 0]}>
      <ambientLight intensity={0.85} />
      <directionalLight position={[7, 12, 5]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 7, 0]} intensity={p.overtime ? 34 : 20} distance={18} color={p.overtime ? C.amber : "#ffffff"} />

      {/* grounds */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[44, 32]} />
        <meshStandardMaterial color={C.grass} roughness={1} />
      </mesh>
      {/* the building: concrete floor + painted walls (player-customisable), grows east with expansions */}
      <FactoryShell wallColor={p.wallColor ?? "#8a9099"} floorColor={p.floorColor ?? C.concrete} floorW={floorW} />
      {/* expansion joints double as the build grid, subtle on the concrete */}
      <gridHelper args={[floorW, floorW, C.concreteJoint, C.concreteJoint]} position={[cx, 0.11, 0]} />
      {/* tap-catcher for build mode (invisible, above the pad) */}
      {/* raycast skips visible={false}, so the tap-catcher is transparent instead of hidden */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.12, 0]} onPointerDown={onPadDown} onPointerUp={onPadUp}>
        <planeGeometry args={[floorW, FLOOR.h]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* dock apron under the truck, at the line's end */}
      {dock && (
        <mesh rotation={[-Math.PI / 2, 0, dock.yaw]} position={[dock.road[0], 0.001, dock.road[2]]} receiveShadow>
          <planeGeometry args={[3.0, 5.2]} />
          <meshStandardMaterial color={C.road} roughness={0.95} />
        </mesh>
      )}

      <BeltTiles floor={p.floor} lineOk={p.lineOk} />
      {p.lineOk && pl.total > 0 && [0, 1, 2, 3].map((i) => <TravelingItem key={i} index={i} itemsT={itemsT} pl={pl} marks={marks} look={look} />)}
      {p.flash && <TapFlash flash={p.flash} />}

      {p.floor.machines.map((m) => <MachineAt key={m.id} m={m} active={p.active && p.lineOk} activeKind={p.activeKind} pl={pl} itemsT={itemsT} />)}
      {p.props?.map((pr) => <PropAt key={pr.id} prop={pr} />)}

      {/* the belt ends at a pallet beside the delivery truck (the dock) */}
      {dock && <Pallet position={dock.pallet} yaw={dock.yaw} count={p.readyCount} />}
      {dock && <Truck selling={p.selling} position={dock.truck} yaw={dock.yaw} />}
      <Agvs tier={p.robotTier} overtime={p.overtime} />

      <ContactShadows position={[0, 0.11, 0]} opacity={0.5} scale={26} blur={2.2} far={4} frames={60} />
    </group>
  );
}

export default function Factory3D(p: Factory3DProps) {
  const cx = ((p.floorW ?? FLOOR.w) - FLOOR.w) / 2; // building east-shift from expansions
  return (
    <Canvas
      role="img"
      aria-label="Factory floor, 3D view"
      frameloop="always"
      dpr={[1, 1.75]}
      shadows
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [10, 12.5, 11], fov: 28 }}
      onCreated={({ gl, camera, size }) => {
        frameCamera(camera as THREE.PerspectiveCamera, size.height > size.width, cx);
        gl.domElement.addEventListener(
          "webglcontextlost",
          (e) => { e.preventDefault(); p.onContextLost?.(); },
          { once: true },
        );
      }}
    >
      <Scene {...p} />
      <CameraReset signal={p.resetView ?? 0} cx={cx} />
      {/* touch/drag to orbit, pinch to zoom — pan disabled, kept above the floor */}
      <OrbitControls
        makeDefault
        target={[cx, -0.3, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={0.55}
        zoomSpeed={0.8}
        minDistance={8}
        maxDistance={32}
        minPolarAngle={0.18}
        maxPolarAngle={Math.PI / 2 - 0.06}
      />
    </Canvas>
  );
}
