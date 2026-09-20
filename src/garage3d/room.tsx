// The office room shell: floor slab, walls, window, garage door, string lights, the low-wall
// diorama (light theme) and the brand wall. Extracted from Garage3D so the architecture can grow
// without growing the scene file; every surface colour comes from the room palette.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { FloorFinish, WallStyle } from "../engine/roomStyle.ts";
import { reactionIntensity } from "../design/hqReaction.ts";
import { BrandWall } from "./brandWall.tsx";
import { sharedStandard } from "./sharedGpu.ts";
import type { RoomPalette } from "./palette.ts";
import { GRID } from "../engine/furniture.ts";

// The room's floor footprint. Sized to the walls (which sit at ±4.2) so the floor ends AT the
// room instead of sprawling far past it — an oversized 18×18 floor was why furniture/desks near
// the edges read as standing "outside the garage". Everything placeable lives within ±3.87 (the
// 9×9 grid) and the fixed props within ±4.0, so 8.6 contains the whole room with a small margin.
const FLOOR_SIZE = 8.6;
const FLOOR_SLAB_THICKNESS = 0.4; // slab depth — gives the open dollhouse sides a finished plate edge
const FLOOR_EDGE_RADIUS = 0.12;   // rounded slab corners
// Low curbs that frame the two OPEN edges (front +z, right +x), derived from FLOOR_SIZE so they
// track the floor: they sit just inside the rounded slab edge; the front curb spans the floor minus
// its rounded corners; the right curb stops short so it doesn't double the front curb's corner.
const CURB_H = 0.24;
const CURB_T = 0.12;
const CURB_EDGE = FLOOR_SIZE / 2 - 0.05; // ±4.25 — just inside the slab edge
const CURB_LONG = FLOOR_SIZE - 0.1;      // 8.5 — front curb (minus the rounded corners)
const CURB_SHORT = FLOOR_SIZE - 0.5;     // 8.1 — right curb (short of the front curb's corner)

// Lower-wall band + chair rail: the horizontal break that stops a wall reading as one flat plane.
const RAIL_Y = 1.06;
const BAND_TOP = 0.98;
// Shared ship-day celebration target (the positive green, matching CHEER_TINT / the Bank dot). One
// module-level THREE.Color reused by the string lights — and by the desk monitors in Garage3D — so
// the cheer light-beat allocates nothing per frame. STRING_WARM is the bulbs' resting emissive.
export const CHEER_GREEN = new THREE.Color("#34c759");
const STRING_WARM = new THREE.Color("#ffce74");

/** Dollhouse wall culling: any wall sitting between the camera and the room interior hides, so
 *  the player always looks INTO the room — in the default view AND while WASD-orbiting. A small
 *  hysteresis band stops flicker when the camera crosses an axis; state only changes on a flip. */
export interface WallCull { a: boolean; b: boolean; r: boolean } // a = back (−z), b = left (−x), r = right (+x)

export function useWallCull(): WallCull {
  // Default camera sits at +x/+z → the right wall starts hidden (it was boxing the view in).
  const [cull, setCull] = useState<WallCull>({ a: false, b: false, r: true });
  useFrame(({ camera }) => {
    setCull((prev) => {
      const a = camera.position.z < -0.6 ? true : camera.position.z > 0.6 ? false : prev.a;
      const b = camera.position.x < -0.6 ? true : camera.position.x > 0.6 ? false : prev.b;
      const r = camera.position.x > 0.6 ? true : camera.position.x < -0.6 ? false : prev.r;
      return a === prev.a && b === prev.b && r === prev.r ? prev : { a, b, r };
    });
  });
  return cull;
}

/** Wall band + rail for one wall run. `axis` picks which way the run faces: "-z" is the back wall,
 *  "-x" / "+x" the side walls; `face` is the wall's inner surface, and the band sits just proud of
 *  it so the two never z-fight. */
function Wainscot({ p, axis, len, offset = 0, face }: { p: RoomPalette; axis: "-z" | "-x" | "+x"; len: number; offset?: number; face: number }) {
  const band = sharedStandard({ color: p.wainscot, roughness: 0.92, metalness: 0 });
  const rail = sharedStandard({ color: p.rail, roughness: 0.7, metalness: 0.06 });
  const dir = axis === "+x" ? -1 : 1;
  const h = BAND_TOP - 0.24;
  const y = 0.24 + h / 2;
  const b = face + dir * 0.021;
  const r = face + dir * 0.03;
  const back = axis === "-z" ? [offset, y, b] : [b, y, offset];
  const cap = axis === "-z" ? [offset, RAIL_Y, r] : [r, RAIL_Y, offset];
  return (
    <group>
      <mesh position={back as [number, number, number]} material={band}>
        <boxGeometry args={axis === "-z" ? [len, h, 0.04] : [0.04, h, len]} />
      </mesh>
      <mesh position={cap as [number, number, number]} material={rail}>
        <boxGeometry args={axis === "-z" ? [len, 0.06, 0.1] : [0.1, 0.06, len]} />
      </mesh>
    </group>
  );
}

// Floor with a player-chosen finish (concrete/wood/tile/carpet/polished). The seam pattern +
// material change with the finish; concrete keeps the painted garage work-zone. The slab carries a
// raised env-map response so polished finishes catch the studio reflections instead of reading matte.
function Floor({ p, finish, dark }: { p: RoomPalette; finish: FloorFinish; dark: boolean }) {
  const color = dark ? finish.dark : finish.light;
  const line = dark ? finish.lineDark : finish.lineLight;
  // seam axes depend on the pattern
  let xs: number[] = [];
  let zs: number[] = [];
  if (finish.pattern === "grid") {
    xs = [-4, -2, 0, 2, 4];
    zs = [-4, -2, 0, 2, 4];
  } else if (finish.pattern === "tile") {
    for (let v = -4; v <= 4; v += 1) { xs.push(v); zs.push(v); }
  } else if (finish.pattern === "plank") {
    for (let z = -3.87; z <= 3.87; z += GRID.cell) zs.push(z); // planks run along x
  }
  return (
    <group>
      {/* Room floor as a finished slab sized to the walls. (Was an 18×18 plane that ran ~4.8m past
          the ±4.2 walls on every side, so anything near the edge looked stranded outside the room.)
          The slab's thickness gives the open dollhouse sides — front (+z) and the culled right (+x)
          — a clean, premium plate edge instead of a hard cut. */}
      <RoundedBox args={[FLOOR_SIZE, FLOOR_SLAB_THICKNESS, FLOOR_SIZE]} radius={FLOOR_EDGE_RADIUS} smoothness={3} position={[0, -FLOOR_SLAB_THICKNESS / 2, 0]}>
        <meshStandardMaterial color={color} roughness={finish.roughness} metalness={finish.metalness} envMapIntensity={finish.metalness > 0.15 ? 1.5 : 1.15} />
      </RoundedBox>
      {zs.map((z, i) => (
        <mesh key={`sz${i}`} rotation-x={-Math.PI / 2} position={[0, 0.012, z]}>
          <planeGeometry args={[8.2, 0.03]} />
          <meshStandardMaterial color={line} roughness={0.9} />
        </mesh>
      ))}
      {xs.map((x, i) => (
        <mesh key={`sx${i}`} rotation-x={-Math.PI / 2} position={[x, 0.012, 0]}>
          <planeGeometry args={[0.03, 8.2]} />
          <meshStandardMaterial color={line} roughness={0.9} />
        </mesh>
      ))}
      {/* painted work-zone outline (concrete garage look only) */}
      {finish.id === "concrete" && ([[0, 2.9, 6.2, 0.06], [0, -2.3, 6.2, 0.06], [3.0, 0.3, 0.06, 5.2], [-3.0, 0.3, 0.06, 5.2]] as const).map((r, i) => (
        <mesh key={`paint${i}`} rotation-x={-Math.PI / 2} position={[r[0], 0.014, r[1]]}>
          <planeGeometry args={[r[2], r[3]]} />
          <meshStandardMaterial color={p.floorPaint} roughness={0.8} transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// Exposed-brick accent wall (wall B, −x) built from instanced bricks in a running bond.
// `backZ` lets the brick run extend as the factory bay deepens.
function BrickWall({ p, backZ = -4.1 }: { p: RoomPalette; backZ?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const bw = 0.62, bh = 0.2, gap = 0.025;
  const rows = 25;
  const cols = Math.ceil((4.1 - backZ) / (bw + gap)) + 1;
  const max = rows * cols;
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    const base = new THREE.Color(p.brick);
    let i = 0;
    for (let r = 0; r < rows; r++) {
      const y = 0.1 + r * (bh + gap);
      const off = (r % 2) * (bw / 2);
      for (let c = 0; c < cols; c++) {
        const z = backZ + off + c * (bw + gap);
        if (z > 4.1) continue;
        d.position.set(-4.0, y, z);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
        // Deterministic per-brick tint hashed from (row,col) — stays stable across re-renders so
        // bricks don't re-randomise / flicker on every paint.
        const hash = ((r * 73856093) ^ (c * 19349663)) >>> 0;
        const t = 0.82 + (hash % 1000) / 1000 * 0.3;
        col.setRGB(base.r * t, base.g * t, base.b * t);
        mesh.setColorAt(i, col);
        i++;
      }
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [p.brick, backZ, cols]);
  return (
    <instancedMesh key={cols} ref={ref} args={[undefined, undefined, max]}>
      <boxGeometry args={[0.06, bh, bw]} />
      <meshStandardMaterial color={p.brick} roughness={0.95} />
    </instancedMesh>
  );
}

// A detailed sectional garage door (wall A) — panels with insets, a window row, side tracks.
// `big` widens it into a loading-bay door as the factory grows; `z` follows the back wall.
function GarageDoor({ p, z = -3.96, big = 0 }: { p: RoomPalette; z?: number; big?: number }) {
  const W = 5.4 + big, panels = 4 + (big > 1 ? 1 : 0), panelH = 0.82, baseY = 0.34;
  const topY = baseY + panels * panelH;
  return (
    <group position={[0, 0, z]}>
      {/* concrete threshold */}
      <mesh position={[0, 0.07, 0.04]}>
        <boxGeometry args={[W + 0.5, 0.14, 0.34]} />
        <meshStandardMaterial color={p.baseboard} roughness={0.9} />
      </mesh>
      {/* side tracks */}
      {[-W / 2 - 0.13, W / 2 + 0.13].map((x, i) => (
        <mesh key={i} position={[x, baseY + (topY - baseY) / 2, 0]}>
          <boxGeometry args={[0.12, topY - baseY + 0.3, 0.16]} />
          <meshStandardMaterial color={p.doorRail} metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {/* top rail + curved track hint */}
      <mesh position={[0, topY + 0.16, 0]}>
        <boxGeometry args={[W + 0.5, 0.16, 0.18]} />
        <meshStandardMaterial color={p.doorRail} metalness={0.5} roughness={0.5} />
      </mesh>
      {/* panels */}
      {Array.from({ length: panels }).map((_, r) => {
        const y = baseY + panelH / 2 + r * panelH;
        const windowRow = r === panels - 1;
        return (
          <group key={r} position={[0, y, 0]}>
            <RoundedBox args={[W, panelH - 0.04, 0.08]} radius={0.012} smoothness={2}>
              <meshStandardMaterial color={p.door} metalness={0.2} roughness={0.55} />
            </RoundedBox>
            {[-W / 3, 0, W / 3].map((cx, ci) =>
              windowRow ? (
                <mesh key={ci} position={[cx, 0, 0.05]}>
                  <boxGeometry args={[W / 3 - 0.18, panelH - 0.3, 0.02]} />
                  <meshStandardMaterial color="#bfe0ff" emissive="#bfe0ff" emissiveIntensity={0.55} roughness={0.25} toneMapped={false} />
                </mesh>
              ) : (
                <mesh key={ci} position={[cx, 0, 0.045]}>
                  <boxGeometry args={[W / 3 - 0.2, panelH - 0.26, 0.015]} />
                  <meshStandardMaterial color={p.door} metalness={0.15} roughness={0.7} />
                </mesh>
              ),
            )}
          </group>
        );
      })}
      {/* lift handle */}
      <mesh position={[0, baseY + 0.46, 0.09]}>
        <boxGeometry args={[0.42, 0.1, 0.06]} />
        <meshStandardMaterial color={p.metalDark} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

// Warm festoon string lights strung in a catenary near the ceiling. Each bulb twinkles on a slow
// seeded phase (per-bulb `i` offset) so the strand shimmers instead of glowing dead-flat, and a
// ship-day cheer pulses the whole run toward the positive green (item 7). One tiny useFrame drives
// all 13 bulbs.
function StringLights() {
  const a = [-3.8, 4.5, -3.6];
  const b = [3.6, 4.5, 2.9];
  const n = 13;
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const scratch = useMemo(() => new THREE.Color(), []); // reused so the cheer lerp allocates nothing
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const cheer = reactionIntensity("cheer");
    scratch.copy(STRING_WARM);
    if (cheer > 0) scratch.lerp(CHEER_GREEN, cheer * 0.7);
    for (let i = 0; i < n; i++) {
      const m = mats.current[i];
      if (!m) continue;
      m.emissiveIntensity = 1.5 + Math.sin(t * 0.7 + i) * 0.2 + cheer * 0.8;
      m.emissive.copy(scratch);
    }
  });
  return (
    <group>
      {Array.from({ length: n }).map((_, i) => {
        const t = i / (n - 1);
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[2] + (b[2] - a[2]) * t;
        const yy = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 0.7;
        return (
          <mesh key={i} position={[x, yy, z]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial ref={(el) => { mats.current[i] = el; }} color="#ffe6b0" emissive="#ffce74" emissiveIntensity={1.7} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

// A whiteboard with a scrappy product-roadmap sketch. Default mount = brick wall B (garage);
// callers can override placement for the open diorama (lower back wall).
function Whiteboard({ p, pos = [-3.92, 2.6, 3.0], rotY = Math.PI / 2 }: { p: RoomPalette; pos?: [number, number, number]; rotY?: number }) {
  return (
    <group position={pos} rotation-y={rotY}>
      <RoundedBox args={[1.25, 0.95, 0.05]} radius={0.02} smoothness={2}>
        <meshStandardMaterial color={p.metal} metalness={0.3} roughness={0.45} />
      </RoundedBox>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[1.14, 0.84]} />
        <meshStandardMaterial color={p.board} roughness={0.5} />
      </mesh>
      <group position={[0, 0, 0.04]}>
        <mesh position={[0, 0.12, 0]}>
          <planeGeometry args={[0.92, 0.012]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
        {["#f97316", "#1eb877", "#3b82f6"].map((c, i) => (
          <mesh key={i} position={[-0.36 + i * 0.36, 0.12, 0.001]}>
            <planeGeometry args={[0.16, 0.1]} />
            <meshBasicMaterial color={c} />
          </mesh>
        ))}
        <mesh position={[-0.2, -0.16, 0]} rotation-z={0.15}>
          <planeGeometry args={[0.66, 0.01]} />
          <meshBasicMaterial color="#9aa6b8" />
        </mesh>
        <mesh position={[-0.1, -0.28, 0]} rotation-z={-0.08}>
          <planeGeometry args={[0.8, 0.01]} />
          <meshBasicMaterial color="#9aa6b8" />
        </mesh>
      </group>
    </group>
  );
}

/** The open "floating diorama" room (light theme): a rounded slab in the white void with two low
 *  L-shaped back walls, no ceiling and no front/right walls. Reads as a deliberate surface via a
 *  defined floor field + a lower wall band rather than one continuous white plane. */
function DioramaRoom({ p, cull, showWhiteboard, name }: { p: RoomPalette; cull: WallCull; showWhiteboard: boolean; name: string }) {
  const slab = sharedStandard({ color: p.floor, roughness: 0.92, metalness: 0 });
  const wall = sharedStandard({ color: p.wallA, roughness: 0.96, metalness: 0 });
  const side = sharedStandard({ color: p.wallB, roughness: 0.96, metalness: 0 });
  const skirting = sharedStandard({ color: p.baseboard, roughness: 0.95, metalness: 0 });
  const inlay = sharedStandard({ color: p.floorField, roughness: 0.95, metalness: 0 });
  return (
    <group>
      {/* floating rounded floor slab (the diorama plate) */}
      <RoundedBox args={[9.4, 0.5, 9.4]} radius={0.22} smoothness={4} position={[0, -0.25, 0]} material={slab} />
      {/* top inlay: a defined floor field, so the slab reads as a laid surface with an edge line */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]} material={inlay}>
        <planeGeometry args={[9.0, 9.0]} />
      </mesh>
      {/* low back wall (−z) cluster — hides when the camera swings behind it. Both back walls were
          centred + 8.8 long, so each ran 0.4 past their shared corner and the two overshoots crossed
          into a "+" poking up above the join. Trim the −x end to stop AT the side wall (x = −4.0) so
          they meet as a clean right-angle corner instead. (The open +x/+z ends stay put.) */}
      <group visible={!cull.a}>
        <mesh position={[0.2, 1.25, -4.0]} material={wall}>
          <boxGeometry args={[8.4, 2.7, 0.16]} />
        </mesh>
        <mesh position={[0.2, 0.07, -3.95]} material={skirting}>
          <boxGeometry args={[8.4, 0.14, 0.06]} />
        </mesh>
        <Wainscot p={p} axis="-z" len={8.3} offset={0.2} face={-3.92} />
        {/* the brand wall — the diorama's one focal point */}
        <BrandWall name={name} p={p} mode="lowWall" />
        {/* whiteboard on the low back wall (−z), facing the room — gated (an earned upgrade) */}
        {showWhiteboard && <Whiteboard p={p} pos={[-1.2, 1.55, -3.88]} rotY={0} />}
      </group>
      {/* low side wall (−x) cluster — its −z end likewise stops at the back wall (z = −4.0). */}
      <group visible={!cull.b}>
        <mesh position={[-4.0, 1.25, 0.2]} material={side}>
          <boxGeometry args={[0.16, 2.7, 8.4]} />
        </mesh>
        <mesh position={[-3.95, 0.07, 0.2]} material={skirting}>
          <boxGeometry args={[0.06, 0.14, 8.4]} />
        </mesh>
        <Wainscot p={p} axis="-x" len={8.3} offset={0.2} face={-3.92} />
      </group>
    </group>
  );
}

function Room({ p, dark, finish, wall, cull, showWhiteboard = true, name = "Silicon" }: { p: RoomPalette; dark: boolean; finish: FloorFinish; wall: WallStyle; cull: WallCull; showWhiteboard?: boolean; name?: string }) {
  const wzA = -4.2;
  const isBrick = wall.kind === "brick";
  const wallColor = dark ? wall.dark : wall.light;

  if (!dark) return <DioramaRoom p={p} cull={cull} showWhiteboard={showWhiteboard} name={name} />;

  return (
    <group>
      <Floor p={p} finish={finish} dark={dark} />

      {/* ── wall A cluster (back, −z: drywall + garage door + trim) — dollhouse-culled ── */}
      <group visible={!cull.a}>
        <mesh position={[0, 2.6, wzA]}>
          <boxGeometry args={[8.4, 5.2, 0.3]} />
          <meshStandardMaterial color={p.wallA} roughness={0.95} />
        </mesh>
        {/* baseboard along wall A */}
        <mesh position={[0, 0.12, wzA + 0.18]}>
          <boxGeometry args={[8.4, 0.24, 0.06]} />
          <meshStandardMaterial color={p.baseboard} roughness={0.85} />
        </mesh>
        {/* crown trim where wall meets ceiling */}
        <mesh position={[0, 5.1, wzA]}>
          <boxGeometry args={[8.4, 0.2, 0.4]} />
          <meshStandardMaterial color={p.trim} roughness={0.9} />
        </mesh>
        <Wainscot p={p} axis="-z" len={8.4} face={-4.05} />
        <GarageDoor p={p} z={wzA + 0.24} />
        {/* the brand installation: the room identifies itself on the wall you face */}
        <BrandWall name={name} p={p} mode="overDoor" />
      </group>

      {/* ── wall B cluster (left, −x: brick/finish + window + pegboard) — dollhouse-culled ── */}
      <group visible={!cull.b}>
        <mesh position={[-4.2, 2.6, 0]}>
          <boxGeometry args={[0.3, 5.2, 8.4]} />
          <meshStandardMaterial color={isBrick ? p.brickEdge : wallColor} roughness={wall.kind === "concrete" ? 0.95 : 0.8} metalness={wall.kind === "panel" ? 0.05 : 0} />
        </mesh>
        {isBrick && <BrickWall p={p} backZ={-4.1} />}
        {!isBrick && <Wainscot p={p} axis="-x" len={8.4} face={-4.05} />}
        {wall.kind === "panel" && [-3.0, -1.5, 0, 1.5, 3.0].map((z, i) => (
          <mesh key={i} position={[-4.04, 2.6, z]}><boxGeometry args={[0.02, 5.0, 0.04]} /><meshStandardMaterial color={dark ? "#2a1f15" : "#8a6843"} roughness={0.7} /></mesh>
        ))}
      </group>

      <StringLights />
      {/* ── right wall (+x) — hidden in the default view (it boxed the room in); appears only
            when the camera orbits to the other side and it becomes the far wall ── */}
      <mesh visible={!cull.r} position={[4.2, 2.6, 0]}>
        <boxGeometry args={[0.3, 5.2, 8.4]} />
        <meshStandardMaterial color={p.wallB} roughness={0.85} />
      </mesh>
      <group visible={!cull.r}>
        <Wainscot p={p} axis="+x" len={8.4} face={4.05} />
      </group>
      {/* Low curbs frame the two OPEN dollhouse edges (front +z, right +x) so the room footprint
          reads as a deliberate space on all four sides — the back/left already have wall baseboards. */}
      <mesh position={[0, CURB_H / 2, CURB_EDGE]}>
        <boxGeometry args={[CURB_LONG, CURB_H, CURB_T]} />
        <meshStandardMaterial color={p.baseboard} roughness={0.85} />
      </mesh>
      <mesh position={[CURB_EDGE, CURB_H / 2, 0.2]}>
        <boxGeometry args={[CURB_T, CURB_H, CURB_SHORT]} />
        <meshStandardMaterial color={p.baseboard} roughness={0.85} />
      </mesh>
      {showWhiteboard && (
        <group visible={!cull.b}>
          <Whiteboard p={p} />
        </group>
      )}

      {/* daylight window (wall B), framed */}
      <group visible={!cull.b} position={[-3.97, 3.1, -1.1]}>
        <mesh>
          <boxGeometry args={[0.05, 1.7, 2.3]} />
          <meshStandardMaterial color={p.metalDark} roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh position={[0.02, 0, 0]}>
          <boxGeometry args={[0.04, 1.5, 2.1]} />
          <meshStandardMaterial color="#bfe0ff" emissive="#9fc8f5" emissiveIntensity={0.7} toneMapped={false} />
        </mesh>
        {/* muntin bars */}
        <mesh position={[0.04, 0, 0]}>
          <boxGeometry args={[0.03, 1.5, 0.04]} />
          <meshStandardMaterial color={p.metalDark} roughness={0.6} />
        </mesh>
        <mesh position={[0.04, 0, 0]}>
          <boxGeometry args={[0.03, 0.04, 2.1]} />
          <meshStandardMaterial color={p.metalDark} roughness={0.6} />
        </mesh>
      </group>

      {/* pegboard with tools (wall B) */}
      <group visible={!cull.b} position={[-3.95, 2.5, 2.2]}>
        <mesh>
          <boxGeometry args={[0.04, 1.5, 1.9]} />
          <meshStandardMaterial color={p.pot} roughness={0.85} />
        </mesh>
        {/* a few hung tools (silhouettes) */}
        <mesh position={[0.05, 0.2, -0.5]}>
          <boxGeometry args={[0.03, 0.5, 0.1]} />
          <meshStandardMaterial color={p.metalDark} metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0.05, 0.1, 0]} rotation-x={0.4}>
          <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
          <meshStandardMaterial color={p.metal} metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0.05, 0.0, 0.55]}>
          <torusGeometry args={[0.16, 0.03, 6, 18]} />
          <meshStandardMaterial color={p.metalDark} metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

export { Room };
