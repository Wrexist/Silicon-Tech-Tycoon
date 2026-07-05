// Factory Mode's 3D floor — a COHERENT production line, not a diorama: raw material enters
// at the intake hopper, rides an S-shaped conveyor through the gantry press (Tooling), twin
// robot arms (Assembly) and a glass QA tunnel (Quality), and leaves the packer as a boxed
// crate at the dock. The item VISIBLY TRANSFORMS at each machine (slab → board → device →
// crate), and the machine matching the build's real stage glows and works hardest.
// Same stack + discipline as the 3D office: r3f/drei primitives, lazy chunk, DPR cap,
// context-loss downgrade. Zero image assets.
import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  FLOOR, beltPath, formMarks, machineCenter, worldOf,
  type BeltDir, type FactoryFloor,
} from "../engine/factoryFloor.ts";
import { FINISH_SWATCHES } from "../render/deviceStyle.ts";
import type { CategoryId, Product } from "../engine/types.ts";

/* palette — intrinsic object colours, the garage3d precedent */
const C = {
  grass: "#1d2b22",
  pad: "#2a2f37",
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
  stageIdx: number;   // -1 none · 0 sourcing · 1 tooling · 2 assembly · 3 qa · 4 packaging
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

/* ------------------------------ dock & extras ------------------------------ */

function CrateStacks({ count }: { count: number }) {
  const stacks = Math.max(0, Math.min(4, count));
  return (
    <group position={[6.6, 0, -2.6]}>
      {Array.from({ length: Math.max(1, stacks) }, (_, i) => (
        <group key={i} position={[(i % 2) * 0.8, 0, Math.floor(i / 2) * 0.8]}>
          {[0, 1].map((lvl) => (
            <RoundedBox key={lvl} args={[0.62, 0.44, 0.62]} radius={0.05} position={[0, 0.26 + lvl * 0.48, 0]} castShadow receiveShadow>
              <meshStandardMaterial color={C.crate} roughness={0.8} transparent={stacks === 0} opacity={stacks === 0 ? 0.25 : 1} />
            </RoundedBox>
          ))}
        </group>
      ))}
    </group>
  );
}

function Truck({ selling }: { selling: boolean }) {
  const grp = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (grp.current && selling) grp.current.position.x = 8.6 + Math.sin(clock.elapsedTime * 3) * 0.02;
  });
  return (
    <group ref={grp} position={[8.6, 0, 1.6]}>
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

function FitCamera() {
  const { camera, size } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const portrait = size.height > size.width;
  cam.fov = portrait ? 54 : 30;
  if (portrait) cam.position.set(12.2, 16.6, 13.4);
  else cam.position.set(10.6, 13.1, 11.6);
  cam.lookAt(0, -0.3, 0);
  cam.updateProjectionMatrix();
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

function MachineAt({ m, active, stageIdx, pl, itemsT }: {
  m: FactoryFloor["machines"][number]; active: boolean; stageIdx: number; pl: Polyline; itemsT: ItemsRef;
}) {
  const [cx, cz] = machineCenter(m);
  // Snap the machine ONTO the belt so the product runs through it. Straddlers (press / QA / packer /
  // intake) sit centred on the line and face along it; the robot arm stands beside the belt and
  // reaches over. If there's no line yet, fall back to the raw cell centre so it still shows.
  const snap = snapToBelt(pl, cx, cz);
  const onBelt: [number, number, number] = snap ? [snap.x, 0, snap.z] : [cx, 0, cz];
  const yaw = snap ? snap.yaw : 0;
  switch (m.kind) {
    case "intake": return <Intake active={active} hot={stageIdx === 0} position={onBelt} yaw={yaw} />;
    case "press": return <GantryPress active={active} hot={stageIdx === 1} position={onBelt} yaw={yaw} pl={pl} itemsT={itemsT} />;
    case "qa": return <QaTunnel active={active} hot={stageIdx === 3} position={onBelt} yaw={yaw} pl={pl} itemsT={itemsT} />;
    case "packer": return <Packer active={active} hot={stageIdx === 4} position={onBelt} yaw={yaw} pl={pl} itemsT={itemsT} />;
    case "arm": {
      // beside the belt on the side it was placed, reaching over the line
      const side = snap ? Math.sign((cx - snap.x) * snap.nx + (cz - snap.z) * snap.nz) || 1 : 1;
      const armPos: [number, number, number] = snap ? [snap.x + snap.nx * side * 0.95, 0, snap.z + snap.nz * side * 0.95] : [cx, 0, cz];
      return <RobotArm active={active} hot={stageIdx === 2} position={armPos} pl={pl} itemsT={itemsT} />;
    }
  }
}

function Scene(p: Factory3DProps) {
  const { size } = useThree();
  const portrait = size.height > size.width;
  const world = useRef<THREE.Group>(null);

  // The belts ARE the path: chain them, then derive where the item transforms.
  const pl = useMemo(() => makePolyline(beltPath(p.floor.belts)), [p.floor.belts]);
  const marks = useMemo(() => formMarks(p.floor, pl.pts), [p.floor, pl.pts]);

  const look = useMemo(() => productLook(p.product), [p.product]);
  const itemsT = useRef<number[]>([0, 0.25, 0.5, 0.75].map((f) => f * Math.max(1, pl.total)));
  useFrame((_, dt) => {
    if (!p.active || pl.total === 0) return;
    const v = (p.overtime ? 2.1 : 1.25) * dt;
    itemsT.current = itemsT.current.map((t) => (t + v) % pl.total);
  });

  // Build mode: taps on the pad plane report the grid cell (in the WORLD group's local space,
  // so the portrait rotation can't skew the mapping).
  const onTapPad = (e: { point: THREE.Vector3; stopPropagation: () => void }) => {
    if (!p.buildMode || !p.onTapCell || !world.current) return;
    e.stopPropagation();
    const local = world.current.worldToLocal(e.point.clone());
    const c = Math.round(local.x + (FLOOR.w - 1) / 2);
    const r = Math.round(local.z + (FLOOR.h - 1) / 2);
    if (c >= 0 && c < FLOOR.w && r >= 0 && r < FLOOR.h) p.onTapCell(c, r);
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
      <RoundedBox args={[16.4, 0.14, 10.4]} radius={0.15} position={[0, 0.02, 0]} receiveShadow>
        <meshStandardMaterial color={C.pad} roughness={0.95} />
      </RoundedBox>
      <gridHelper args={[16, 16, "#3a4048", "#343a42"]} position={[0, 0.1, 0]} />
      {/* tap-catcher for build mode (invisible, above the pad) */}
      {/* raycast skips visible={false}, so the tap-catcher is transparent instead of hidden */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} onPointerDown={onTapPad}>
        <planeGeometry args={[FLOOR.w, FLOOR.h]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* dock road along the east edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8.6, 0.001, 0]} receiveShadow>
        <planeGeometry args={[1.9, 30]} />
        <meshStandardMaterial color={C.road} roughness={0.95} />
      </mesh>

      <BeltTiles floor={p.floor} lineOk={p.lineOk} />
      {p.lineOk && pl.total > 0 && [0, 1, 2, 3].map((i) => <TravelingItem key={i} index={i} itemsT={itemsT} pl={pl} marks={marks} look={look} />)}
      {p.flash && <TapFlash flash={p.flash} />}

      {p.floor.machines.map((m) => <MachineAt key={m.id} m={m} active={p.active && p.lineOk} stageIdx={p.stageIdx} pl={pl} itemsT={itemsT} />)}

      <CrateStacks count={p.readyCount} />
      <Truck selling={p.selling} />
      <Agvs tier={p.robotTier} overtime={p.overtime} />

      <ContactShadows position={[0, 0.11, 0]} opacity={0.5} scale={26} blur={2.2} far={4} frames={60} />
    </group>
  );
}

export default function Factory3D(p: Factory3DProps) {
  return (
    <Canvas
      role="img"
      aria-label="Factory floor, 3D view"
      frameloop="always"
      dpr={[1, 1.75]}
      shadows
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [10, 12.5, 11], fov: 28 }}
      onCreated={({ gl, camera }) => {
        camera.lookAt(0, 0, 0);
        gl.domElement.addEventListener(
          "webglcontextlost",
          (e) => { e.preventDefault(); p.onContextLost?.(); },
          { once: true },
        );
      }}
    >
      <FitCamera />
      <Scene {...p} />
    </Canvas>
  );
}
