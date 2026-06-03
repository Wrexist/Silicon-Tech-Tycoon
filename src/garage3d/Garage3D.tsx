// Procedural real-time 3D HQ (react-three-fiber). Zero image assets — everything is built
// from primitives + materials + real lights. Scoped to the garage only; devices stay SVG.
import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, RoundedBox, Html } from "@react-three/drei";
import * as THREE from "three";
import { moodBand, type MoodBand } from "../engine/staff.ts";
import type { Staff } from "../engine/types.ts";
import type { UpgradeId } from "../engine/upgrades.ts";
import {
  canPlace,
  cellAt,
  footprint,
  furnitureDef,
  GRID,
  worldOf,
  type FurnitureId,
  type PlacedItem,
  type Rot,
} from "../engine/furniture.ts";
import { FurniturePiece } from "./furniture3d.tsx";
import { floorFinish, wallStyle, type FloorFinish, type WallStyle } from "../engine/roomStyle.ts";
import { roomPalette, type RoomPalette } from "./palette.ts";
import { robotModelFor } from "./robotModels.ts";

type Upgrades = Partial<Record<UpgradeId, number>>;
const tierOf = (u: Upgrades, id: UpgradeId) => u[id] ?? 0;

const GRID_ORIGIN = -(GRID.n * GRID.cell) / 2;

export interface BuildProps {
  build: boolean;
  layout: PlacedItem[];
  placingType: FurnitureId | null;
  placeRot: Rot;
  selectedIid: string | null;
  onPlaceCell: (c: number, r: number) => void;
  onMoveItem: (iid: string, c: number, r: number) => void;
  onSelectItem: (iid: string | null) => void;
}

/** Desk pod positions for `n` workstations — fills a front row (closest to camera) then a
 *  back row, spread evenly. Starts with a single centered desk and grows as the team hires. */
function deskPositions(n: number): [number, number][] {
  const cap = Math.max(1, Math.min(6, n));
  const front = Math.min(cap, 3);
  const back = cap - front;
  const out: [number, number][] = [];
  const row = (k: number, z: number) => {
    for (let i = 0; i < k; i++) {
      const x = k === 1 ? 0 : -2.6 + 5.2 * (i / (k - 1));
      out.push([x, z]);
    }
  };
  row(front, 1.7);
  row(back, -1.1);
  return out;
}

const MOOD_HEX: Record<MoodBand, string> = {
  thriving: "#10b981",
  happy: "#10b981",
  neutral: "#9aa0a6",
  tired: "#f59e0b",
  burnedout: "#ef4444",
};

const ROBOT_COLORS = ["#4a9af5", "#ff7a35", "#40c870", "#9060e8", "#f5c840"];

// Build mode lifts the camera to a higher, more overhead angle so the whole floor grid is
// readable; otherwise it's the cozy parallax view. WASD lets the player drive the view:
// A/D orbit around the room, W/S zoom in/out, Q/E (or R/F) raise/lower the eye height.
function CameraRig({ build = false }: { build?: boolean }) {
  const { camera, pointer } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 1.5, 0), []);
  const keys = useRef<Set<string>>(new Set());
  const orbit = useRef({ yaw: 0, zoom: 0, lift: 0 }); // player camera offsets
  const lastPointer = useRef({ x: 0, y: 0 }); // for the settle check

  useEffect(() => {
    const MOVE = new Set(["w", "a", "s", "d", "q", "e", "r", "f"]);
    const typing = () => {
      const el = document.activeElement;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);
    };
    const down = (ev: KeyboardEvent) => {
      const key = ev.key.toLowerCase();
      if (!MOVE.has(key) || typing()) return;
      keys.current.add(key);
    };
    const up = (ev: KeyboardEvent) => keys.current.delete(ev.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useFrame((_, dt) => {
    // Apply held keys to the orbit offsets (frame-rate independent).
    const ks = keys.current;
    const o = orbit.current;
    const rotSpd = dt * 1.5;
    const zoomSpd = dt * 6;
    const liftSpd = dt * 5;
    if (ks.has("a")) o.yaw -= rotSpd;
    if (ks.has("d")) o.yaw += rotSpd;
    if (ks.has("w")) o.zoom = Math.max(-5, o.zoom - zoomSpd); // closer
    if (ks.has("s")) o.zoom = Math.min(9, o.zoom + zoomSpd); // farther
    if (ks.has("q") || ks.has("r")) o.lift = Math.min(7, o.lift + liftSpd); // higher
    if (ks.has("e") || ks.has("f")) o.lift = Math.max(-3, o.lift - liftSpd); // lower

    const k = Math.min(1, dt * 2.5);
    const px = build ? 6.4 : 11.5;
    const py = build ? 10.6 : 9.0;
    const pz = build ? 8.4 : 12.5;
    const ty = build ? 0.4 : 1.5;

    // Convert the base offset to an orbit (radius + azimuth) so A/D rotates around the room
    // and W/S dollies in/out, while pointer parallax + smoothing are preserved.
    const baseR = Math.hypot(px, pz);
    const r = Math.max(4, baseR + o.zoom);
    const ang = Math.atan2(px, pz) + o.yaw;
    const desiredX = Math.sin(ang) * r + pointer.x * (build ? 0.5 : 1.3);
    const desiredZ = Math.cos(ang) * r;
    const desiredY = Math.max(1.2, py + o.lift - pointer.y * (build ? 0.3 : 0.9));

    // Settle: if no movement key is held, the pointer hasn't moved, and we're already within
    // epsilon of where we want to be, stop writing camera.position/lookAt to save battery.
    const keyHeld = ks.size > 0;
    const pointerStill =
      Math.abs(pointer.x - lastPointer.current.x) < 1e-4 && Math.abs(pointer.y - lastPointer.current.y) < 1e-4;
    lastPointer.current.x = pointer.x;
    lastPointer.current.y = pointer.y;
    const dx = desiredX - camera.position.x;
    const dy = desiredY - camera.position.y;
    const dz = desiredZ - camera.position.z;
    const settled = dx * dx + dy * dy + dz * dz < 1e-6 && Math.abs(ty - target.y) < 1e-3;
    if (!keyHeld && pointerStill && settled) return;

    camera.position.x += dx * k;
    camera.position.y += dy * k;
    camera.position.z += dz * k;
    target.y += (ty - target.y) * k;
    camera.lookAt(target);
  });
  return null;
}

// Floor with a player-chosen finish (concrete/wood/tile/carpet/polished). The seam pattern +
// material change with the finish; concrete keeps the painted garage work-zone.
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
      <mesh rotation-x={-Math.PI / 2} position-y={0}>
        <planeGeometry args={[18, 18]} />
        <meshStandardMaterial color={color} roughness={finish.roughness} metalness={finish.metalness} />
      </mesh>
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

// Exposed wood ceiling beams (rafters) running across the room; extends as the bay deepens.
function Beams({ p, backZ = -3.2 }: { p: RoomPalette; backZ?: number }) {
  const y = 4.7;
  const zs: number[] = [];
  for (let z = 3.2; z >= backZ - 0.01; z -= 1.6) zs.push(z);
  const span = 3.2 - (zs[zs.length - 1] ?? -3.2);
  const cz = (3.2 + (zs[zs.length - 1] ?? -3.2)) / 2;
  return (
    <group>
      {zs.map((z, i) => (
        <mesh key={`b${i}`} position={[0, y, z]}>
          <boxGeometry args={[8.2, 0.24, 0.16]} />
          <meshStandardMaterial color={p.beam} roughness={0.85} />
        </mesh>
      ))}
      {[-2.6, 2.6].map((x, i) => (
        <mesh key={`c${i}`} position={[x, y + 0.13, cz]}>
          <boxGeometry args={[0.16, 0.2, span + 0.4]} />
          <meshStandardMaterial color={p.beam} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// Warm festoon string lights strung in a catenary near the ceiling.
function StringLights() {
  const a = [-3.8, 4.5, -3.6];
  const b = [3.6, 4.5, 2.9];
  const n = 13;
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
            <meshStandardMaterial color="#ffe6b0" emissive="#ffce74" emissiveIntensity={1.7} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

// A whiteboard with a scrappy product-roadmap sketch (mounted on the brick wall B).
function Whiteboard({ p }: { p: RoomPalette }) {
  return (
    <group position={[-3.92, 2.6, 3.0]} rotation-y={Math.PI / 2}>
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

function Room({ p, dark, finish, wall }: { p: RoomPalette; dark: boolean; finish: FloorFinish; wall: WallStyle }) {
  const wzA = -4.2;
  const isBrick = wall.kind === "brick";
  const wallColor = dark ? wall.dark : wall.light;
  return (
    <group>
      <Floor p={p} finish={finish} dark={dark} />
      {/* wall A (the garage-door wall, drywall) */}
      <mesh position={[0, 2.6, wzA]}>
        <boxGeometry args={[8.4, 5.2, 0.3]} />
        <meshStandardMaterial color={p.wallA} roughness={0.95} />
      </mesh>
      {/* wall B — brick uses instanced bricks; other styles a flat finished wall */}
      <mesh position={[-4.2, 2.6, 0]}>
        <boxGeometry args={[0.3, 5.2, 8.4]} />
        <meshStandardMaterial color={isBrick ? p.brickEdge : wallColor} roughness={wall.kind === "concrete" ? 0.95 : 0.8} metalness={wall.kind === "panel" ? 0.05 : 0} />
      </mesh>
      {isBrick && <BrickWall p={p} backZ={-4.1} />}
      {wall.kind === "panel" && [-3.0, -1.5, 0, 1.5, 3.0].map((z, i) => (
        <mesh key={i} position={[-4.04, 2.6, z]}><boxGeometry args={[0.02, 5.0, 0.04]} /><meshStandardMaterial color={dark ? "#2a1f15" : "#8a6843"} roughness={0.7} /></mesh>
      ))}

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

      {dark && <GarageDoor p={p} z={wzA + 0.24} />}
      {dark && <Beams p={p} backZ={-3.2} />}
      {dark && <StringLights />}
      {/* clean-mode ceiling (light mode): flush white soffit instead of beams */}
      {!dark && (
        <mesh position={[0, 5.2, 0]}>
          <boxGeometry args={[8.4, 0.2, 8.6]} />
          <meshStandardMaterial color="#f0f1f4" roughness={0.9} />
        </mesh>
      )}
      {/* right-side wall for KanbanWall mount */}
      <mesh position={[4.2, 2.6, 0]}>
        <boxGeometry args={[0.3, 5.2, 8.4]} />
        <meshStandardMaterial color={dark ? "#272d37" : "#e8e9ec"} roughness={0.85} />
      </mesh>
      <Whiteboard p={p} />

      {/* daylight window (wall B), framed */}
      <group position={[-3.97, 3.1, -1.1]}>
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
      <group position={[-3.95, 2.5, 2.2]}>
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

function Chair({ p, hue }: { p: RoomPalette; hue: string }) {
  return (
    <group>
      <RoundedBox args={[0.7, 0.12, 0.6]} radius={0.05} smoothness={2} position={[0, 0.52, 0]}>
        <meshStandardMaterial color={p.metal} roughness={0.7} />
      </RoundedBox>
      <RoundedBox args={[0.7, 0.7, 0.12]} radius={0.06} smoothness={2} position={[0, 0.9, -0.28]}>
        <meshStandardMaterial color={p.metalDark} roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, 0.9, -0.21]}>
        <planeGeometry args={[0.62, 0.18]} />
        <meshStandardMaterial color={hue} roughness={0.6} />
      </mesh>
    </group>
  );
}

function RobotCharacter({ colorIdx, seed, moodColor }: { colorIdx: number; seed: number; moodColor?: string }) {
  const color = ROBOT_COLORS[colorIdx % ROBOT_COLORS.length];
  const root = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Mesh>(null);
  const armRRef = useRef<THREE.Mesh>(null);

  useFrame((st) => {
    const t = st.clock.elapsedTime + seed;
    if (root.current) root.current.position.y = Math.sin(t * 1.4) * 0.04;
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.7) * 0.18;
      headRef.current.rotation.z = Math.sin(t * 1.0) * 0.04;
    }
    if (armLRef.current) armLRef.current.rotation.x = -0.3 + Math.sin(t * 4.5) * 0.18;
    if (armRRef.current) armRRef.current.rotation.x = -0.3 - Math.sin(t * 4.5) * 0.18;
  });

  return (
    <group ref={root}>
      {/* body — rounded capsule */}
      <mesh position={[0, 0.54, 0]}>
        <capsuleGeometry args={[0.27, 0.44, 8, 18]} />
        <meshStandardMaterial color={color} roughness={0.38} />
      </mesh>
      {/* left arm */}
      <mesh ref={armLRef} position={[-0.37, 0.62, 0.1]}>
        <capsuleGeometry args={[0.115, 0.34, 6, 12]} />
        <meshStandardMaterial color={color} roughness={0.38} />
      </mesh>
      {/* right arm */}
      <mesh ref={armRRef} position={[0.37, 0.62, 0.1]}>
        <capsuleGeometry args={[0.115, 0.34, 6, 12]} />
        <meshStandardMaterial color={color} roughness={0.38} />
      </mesh>
      {/* head — large sphere */}
      <group ref={headRef} position={[0, 1.16, 0]}>
        <mesh>
          <sphereGeometry args={[0.34, 24, 24]} />
          <meshStandardMaterial color={color} roughness={0.38} />
        </mesh>
        {/* eyes — glowing white dots */}
        <mesh position={[-0.13, 0.07, 0.3]}>
          <sphereGeometry args={[0.065, 12, 12]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.8} toneMapped={false} />
        </mesh>
        <mesh position={[0.13, 0.07, 0.3]}>
          <sphereGeometry args={[0.065, 12, 12]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.8} toneMapped={false} />
        </mesh>
        {/* mood dot */}
        {moodColor && (
          <mesh position={[0.29, 0.28, 0.14]}>
            <sphereGeometry args={[0.075, 10, 10]} />
            <meshStandardMaterial color={moodColor} emissive={moodColor} emissiveIntensity={0.7} toneMapped={false} />
          </mesh>
        )}
      </group>
      {/* blob shadow */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
        <circleGeometry args={[0.3, 18]} />
        <meshBasicMaterial color="#8090a8" transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ---- AI-model robot pipeline: render a registered .glb (Meshy/Mixamo export) when present,
// otherwise fall back to the parametric RobotCharacter above. Mirrors the furniture pattern. ----
const LazyGltfRobot = lazy(() => import("./gltfRobot.tsx"));

/** Falls back to the parametric robot if a registered .glb fails to load. */
class RobotBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** A robot by colour index: uses a dropped-in .glb model when one exists (see robotModels.ts),
 *  otherwise the hand-built parametric robot. `clip` requests an animation by name (e.g. "Idle",
 *  "Sitting") — ignored if the model doesn't ship that clip. A blob shadow grounds the model. */
function OfficeRobot({ colorIdx, seed, moodColor, clip }: { colorIdx: number; seed: number; moodColor?: string; clip?: string }) {
  const parametric = <RobotCharacter colorIdx={colorIdx} seed={seed} moodColor={moodColor} />;
  const model = robotModelFor(colorIdx);
  if (!model) return parametric;
  return (
    <RobotBoundary fallback={parametric}>
      <Suspense fallback={parametric}>
        <LazyGltfRobot asset={model} clip={clip} seed={seed} />
        {/* blob shadow under the loaded model */}
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
          <circleGeometry args={[0.3, 18]} />
          <meshBasicMaterial color="#8090a8" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      </Suspense>
    </RobotBoundary>
  );
}

// A desktop monitor on a stand. The panel's screen faces the person (−z); we see the back.
// `bright` (high Workstation tiers) gives crisper, more saturated screens.
function Monitor({ p, on, bright }: { p: RoomPalette; on: boolean; bright: boolean }) {
  return (
    <group>
      {/* foot + neck */}
      <mesh position={[0, 0.01, 0.04]}>
        <cylinderGeometry args={[0.12, 0.14, 0.02, 18]} />
        <meshStandardMaterial color={p.metalDark} roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.18, 0.04]}>
        <boxGeometry args={[0.05, 0.34, 0.05]} />
        <meshStandardMaterial color={p.metalDark} roughness={0.4} metalness={0.5} />
      </mesh>
      {/* panel — back toward camera (+z) */}
      <RoundedBox args={[0.66, 0.42, 0.04]} radius={0.02} smoothness={2} position={[0, 0.45, 0]}>
        <meshStandardMaterial color={p.metalDark} roughness={0.45} metalness={0.4} />
      </RoundedBox>
      {/* glowing screen facing the person (−z) */}
      <mesh position={[0, 0.45, -0.022]} rotation-y={Math.PI}>
        <planeGeometry args={[0.6, 0.36]} />
        <meshStandardMaterial
          color={on ? p.screen : p.screenOff}
          emissive={on ? p.screen : "#0a0d12"}
          emissiveIntensity={on ? (bright ? 1.5 : 1.1) : 0}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Workstation({ p, pos, staff, seed, monitors }: { p: RoomPalette; pos: [number, number]; staff?: Staff; seed: number; monitors: number }) {
  const [x, z] = pos;
  const colorIdx = Math.round(seed / 2.1) % ROBOT_COLORS.length;
  const hue = ROBOT_COLORS[colorIdx];
  const on = !!staff;
  const bright = monitors >= 2;
  const moodColor = staff ? MOOD_HEX[moodBand(staff.mood ?? 60)] : undefined;
  // 1 or 2 monitors clustered on the RIGHT side of the desk, angled toward the person.
  const monX = monitors >= 2 ? [0.2, 0.64] : [0.42];
  return (
    <group position={[x, 0, z]}>
      {/* desk */}
      <RoundedBox args={[1.7, 0.12, 1.0]} radius={0.05} smoothness={3} position={[0, 0.9, 0]}>
        <meshStandardMaterial color={p.desk} roughness={0.7} />
      </RoundedBox>
      {[[-0.75, -0.4], [0.75, -0.4], [-0.75, 0.4], [0.75, 0.4]].map((l, i) => (
        <mesh key={i} position={[l[0], 0.45, l[1]]}>
          <boxGeometry args={[0.1, 0.9, 0.1]} />
          <meshStandardMaterial color={p.deskDark} />
        </mesh>
      ))}
      {/* desktop monitor(s) on the right, facing the person */}
      {monX.map((mx, i) => (
        <group key={i} position={[mx, 0.96, -0.06]} rotation-y={-0.18 * (i - (monX.length - 1) / 2)}>
          <Monitor p={p} on={on} bright={bright} />
        </group>
      ))}
      {/* keyboard in front of the person (left-of-centre, under the monitors) */}
      <RoundedBox args={[0.5, 0.02, 0.18]} radius={0.01} smoothness={2} position={[-0.05, 0.965, 0.2]}>
        <meshStandardMaterial color={p.metalDark} roughness={0.5} metalness={0.3} />
      </RoundedBox>
      <mesh position={[-0.05, 0.978, 0.2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.46, 0.14]} />
        <meshStandardMaterial color="#14171c" roughness={0.8} />
      </mesh>
      {/* mouse */}
      <mesh position={[0.28, 0.972, 0.22]}>
        <capsuleGeometry args={[0.03, 0.04, 3, 8]} />
        <meshStandardMaterial color={p.metal} roughness={0.4} />
      </mesh>
      {/* mug on the left */}
      {staff && (
        <group position={[-0.62, 0.96, 0.1]}>
          <Mug hue={hue} />
        </group>
      )}
      {/* chair + robot leaning toward desk */}
      <group position={[0, 0, -0.5]}>
        <Chair p={p} hue={hue} />
        {staff && (
          <group position={[0, -0.05, 0.18]} rotation-x={-0.12}>
            <OfficeRobot colorIdx={colorIdx} seed={seed} moodColor={moodColor} clip="Sitting" />
          </group>
        )}
      </group>
    </group>
  );
}

function Printer({ p, active }: { p: RoomPalette; active: boolean }) {
  const head = useRef<THREE.Mesh>(null);
  useFrame((st) => {
    if (head.current && active) head.current.position.x = Math.sin(st.clock.elapsedTime * 2.2) * 0.18;
  });
  return (
    <group position={[-3.0, 0, 2.9]}>
      <RoundedBox args={[0.9, 1.0, 0.9]} radius={0.06} smoothness={3} position={[0, 0.5, 0]}>
        <meshStandardMaterial color={p.metal} roughness={0.6} metalness={0.2} />
      </RoundedBox>
      {active && (
        <mesh ref={head} position={[0, 0.85, 0]}>
          <boxGeometry args={[0.18, 0.06, 0.5]} />
          <meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

// Floating label overlay — white pill badge with a coloured dot indicator.
function OfficeLabel({ pos, label, sub, dot }: { pos: [number, number, number]; label: string; sub: string; dot: string }) {
  return (
    <Html position={pos} distanceFactor={9} occlude style={{ pointerEvents: "none", userSelect: "none" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "7px 11px", background: "rgba(255,255,255,0.96)", borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.10)", minWidth: 110, backdropFilter: "blur(6px)" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, marginTop: 3, flexShrink: 0 }} />
        <div>
          <div style={{ fontFamily: "system-ui,-apple-system,sans-serif", fontSize: 12, fontWeight: 700, color: "#1a1d23", lineHeight: 1.3 }}>{label}</div>
          <div style={{ fontFamily: "system-ui,-apple-system,sans-serif", fontSize: 11, color: "#6b7280", lineHeight: 1.3 }}>{sub}</div>
        </div>
      </div>
    </Html>
  );
}

// Kanban board with three swim-lane columns and coloured sticky cards.
function KanbanWall() {
  const W = 3.2, H = 2.4;
  const colW = (W - 0.16) / 3;
  const cols: { label: string; hdr: string; cards: string[] }[] = [
    { label: "Backlog", hdr: "#9aa0a8", cards: ["#f0f1f4", "#e8e9ec", "#f0f1f4"] },
    { label: "In Progress", hdr: "#f97316", cards: ["#fff0e6", "#ffe8d0"] },
    { label: "Done", hdr: "#10b981", cards: ["#e6f5ef", "#d0eddf", "#e6f5ef"] },
  ];
  return (
    <group position={[4.06, 2.6, 0.2]} rotation-y={-Math.PI / 2}>
      {/* frame */}
      <RoundedBox args={[W + 0.14, H + 0.14, 0.06]} radius={0.03} smoothness={2}>
        <meshStandardMaterial color="#1a1d23" roughness={0.5} metalness={0.3} />
      </RoundedBox>
      {/* surface */}
      <mesh position={[0, 0, 0.036]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color="#f4f5f7" roughness={0.7} />
      </mesh>
      {/* columns */}
      {cols.map((col, ci) => {
        const cx = -W / 2 + colW / 2 + ci * (colW + 0.04) + 0.04;
        return (
          <group key={ci} position={[cx, 0, 0.042]}>
            {/* column header stripe */}
            <mesh position={[0, H / 2 - 0.18, 0]}>
              <planeGeometry args={[colW - 0.04, 0.24]} />
              <meshBasicMaterial color={col.hdr} />
            </mesh>
            {/* cards */}
            {col.cards.map((c, ki) => (
              <mesh key={ki} position={[0, H / 2 - 0.52 - ki * 0.34, 0.002]}>
                <planeGeometry args={[colW - 0.06, 0.26]} />
                <meshBasicMaterial color={c} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* active-column blue glow */}
      <mesh position={[colW / 2, 0, 0.058]}>
        <planeGeometry args={[colW + 0.02, H + 0.04]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.07} depthWrite={false} />
      </mesh>
    </group>
  );
}

// Glass-panel security gate — two posts + retractable panels + card reader.
function SecurityGate() {
  return (
    <group position={[0.8, 0, 3.55]}>
      {/* upright posts */}
      {([-0.52, 0.52] as const).map((x, i) => (
        <mesh key={i} position={[x, 0.9, 0]}>
          <boxGeometry args={[0.13, 1.8, 0.13]} />
          <meshStandardMaterial color="#b8bdc4" metalness={0.65} roughness={0.25} />
        </mesh>
      ))}
      {/* glass panels */}
      {([-0.26, 0.26] as const).map((x, i) => (
        <mesh key={i} position={[x, 0.58, 0]}>
          <boxGeometry args={[0.04, 0.96, 0.78]} />
          <meshStandardMaterial color="#a8d8f8" transparent opacity={0.38} roughness={0.04} />
        </mesh>
      ))}
      {/* card reader on right post */}
      <group position={[0.6, 1.02, 0]}>
        <RoundedBox args={[0.1, 0.22, 0.14]} radius={0.02} smoothness={2}>
          <meshStandardMaterial color="#1e2128" roughness={0.4} />
        </RoundedBox>
        <mesh position={[0.06, 0.04, 0]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

// Steel vault / document safe — heavy door with dial and bar handle.
function Vault() {
  return (
    <group position={[-3.5, 0, 1.6]}>
      <RoundedBox args={[0.95, 1.45, 0.65]} radius={0.04} smoothness={3} position={[0, 0.72, 0]}>
        <meshStandardMaterial color="#b4b9c0" metalness={0.62} roughness={0.28} />
      </RoundedBox>
      {/* door seam */}
      <mesh position={[0, 0.72, 0.335]}>
        <boxGeometry args={[0.74, 1.12, 0.01]} />
        <meshStandardMaterial color="#9298a0" metalness={0.5} roughness={0.38} />
      </mesh>
      {/* bar handle */}
      <mesh position={[0.28, 0.72, 0.345]} rotation-z={Math.PI / 2}>
        <capsuleGeometry args={[0.04, 0.22, 6, 12]} />
        <meshStandardMaterial color="#7c8290" metalness={0.82} roughness={0.14} />
      </mesh>
      {/* combination dial */}
      <mesh position={[-0.17, 0.95, 0.345]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.085, 0.085, 0.04, 22]} />
        <meshStandardMaterial color="#7c8290" metalness={0.8} roughness={0.12} />
      </mesh>
      <mesh position={[-0.17, 0.95, 0.375]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.01, 0.09]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

function Props({ p, hasProduction, back = 0 }: { p: RoomPalette; hasProduction: boolean; back?: number }) {
  return (
    <group>
      {/* boxes (back-left corner — follow the back wall as the bay deepens) */}
      <RoundedBox args={[0.9, 0.9, 0.9]} radius={0.04} smoothness={2} position={[-3.2, 0.45, -3.0 - back]}>
        <meshStandardMaterial color={p.box} roughness={0.85} />
      </RoundedBox>
      <RoundedBox args={[0.7, 0.7, 0.7]} radius={0.04} smoothness={2} position={[-3.2, 1.25, -3.0 - back]}>
        <meshStandardMaterial color={p.box} roughness={0.85} />
      </RoundedBox>
      {/* tool chest (back-right) */}
      <RoundedBox args={[1.0, 1.3, 0.9]} radius={0.05} smoothness={3} position={[3.1, 0.65, -3.0 - back]}>
        <meshStandardMaterial color={p.chest} roughness={0.5} metalness={0.1} />
      </RoundedBox>
      {/* plant (front-right) */}
      <group position={[3.1, 0, 3.0]}>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.28, 0.34, 0.5, 12]} />
          <meshStandardMaterial color={p.pot} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.75, 0]}>
          <sphereGeometry args={[0.5, 14, 14]} />
          <meshStandardMaterial color={p.plant} roughness={0.85} />
        </mesh>
      </group>
      <Printer p={p} active={hasProduction} />
      <PendantLamp p={p} />
    </group>
  );
}

// Pendant lamp that gently swings (pivot at the ceiling).
function PendantLamp({ p }: { p: RoomPalette }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((st) => {
    if (!ref.current) return;
    const t = st.clock.elapsedTime;
    ref.current.rotation.z = Math.sin(t * 0.8) * 0.05;
    ref.current.rotation.x = Math.cos(t * 0.62) * 0.04;
  });
  return (
    <group ref={ref} position={[0, 5, 0]}>
      <mesh position={[0, -0.7, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.4, 6]} />
        <meshStandardMaterial color={p.metalDark} />
      </mesh>
      <mesh position={[0, -1.45, 0]}>
        <coneGeometry args={[0.45, 0.5, 18, 1, true]} />
        <meshStandardMaterial color={p.lamp} emissive={p.lamp} emissiveIntensity={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -1.6, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial color="#fff6df" emissive="#fff2cc" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
    </group>
  );
}

// Pause the render loop when the tab/page is hidden to save battery.
function VisibilityPause() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => {
    const onVis = () => setFrameloop(document.hidden ? "never" : "always");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [setFrameloop]);
  return null;
}

// Drifting dust motes catching the light (instanced, cheap).
function Dust() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 44;
  const data = useMemo(
    () => Array.from({ length: N }, () => ({ x: (Math.random() - 0.5) * 8, y: Math.random() * 4, z: (Math.random() - 0.5) * 8, spd: 0.04 + Math.random() * 0.07, ph: Math.random() * 6.28 })),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  // Throttle this purely-cosmetic drift to ~20fps to cut sustained battery drain.
  const acc = useRef(0);
  useFrame((st, delta) => {
    if (!ref.current) return;
    acc.current += delta;
    if (acc.current < 1 / 20) return;
    acc.current = 0;
    const t = st.clock.elapsedTime;
    data.forEach((d, i) => {
      const y = ((d.y + t * d.spd) % 4.2) + 0.4;
      dummy.position.set(d.x + Math.sin(t * 0.3 + d.ph) * 0.25, y, d.z + Math.cos(t * 0.2 + d.ph) * 0.25);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
      <sphereGeometry args={[0.014, 6, 6]} />
      <meshBasicMaterial color="#fff3d6" transparent opacity={0.45} depthWrite={false} />
    </instancedMesh>
  );
}

// A little robot vacuum roaming the open floor.
function Robot({ p }: { p: RoomPalette }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((st) => {
    if (!ref.current) return;
    const t = st.clock.elapsedTime * 0.4;
    const x = Math.sin(t) * 2.1;
    const z = 2.7 + Math.cos(t * 1.3) * 0.75;
    const dx = Math.cos(t) * 2.1;
    const dz = -Math.sin(t * 1.3) * 1.3 * 0.75;
    ref.current.position.set(x, 0.09, z);
    ref.current.rotation.y = Math.atan2(dx, dz);
  });
  return (
    <group ref={ref}>
      <mesh castShadow>
        <cylinderGeometry args={[0.27, 0.29, 0.13, 22]} />
        <meshStandardMaterial color={p.metal} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.09, 0]}>
        <sphereGeometry args={[0.15, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color={p.metalDark} roughness={0.5} />
      </mesh>
      <mesh position={[0.04, 0.11, 0.13]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={1.1} toneMapped={false} />
      </mesh>
    </group>
  );
}

// Coffee mug with rising steam.
function Mug({ hue }: { hue: string }) {
  const steam = useRef<THREE.Group>(null);
  // Throttle the steam to ~20fps — ambient flavour, not gameplay-critical motion.
  const acc = useRef(0);
  useFrame((st, delta) => {
    if (!steam.current) return;
    acc.current += delta;
    if (acc.current < 1 / 20) return;
    acc.current = 0;
    const t = st.clock.elapsedTime;
    steam.current.children.forEach((c, i) => {
      const y = ((t * 0.4 + i * 0.33) % 1);
      c.position.y = 0.18 + y * 0.32;
      c.position.x = Math.sin(t * 1.5 + i) * 0.03;
      (c as THREE.Mesh).scale.setScalar(1 - y * 0.6);
      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - y) * 0.28;
    });
  });
  return (
    <group>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.07, 0.06, 0.16, 14]} />
        <meshStandardMaterial color={hue} roughness={0.5} />
      </mesh>
      <mesh position={[0.09, 0.08, 0]}>
        <torusGeometry args={[0.045, 0.014, 8, 16, Math.PI]} />
        <meshStandardMaterial color={hue} roughness={0.5} />
      </mesh>
      <group ref={steam}>
        {[0, 1, 2].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.2} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// A real-physics desk toy — a glass bin of balls with gravity, wall + ball collisions and
// damping, integrated each frame (no WASM, tiny cost). Nudged now and then to stay lively.
const BIN_R = 0.072;
const BIN_HALF = 0.22;
function BallBin({ p, pos }: { p: RoomPalette; pos: [number, number, number] }) {
  const N = 5;
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const balls = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        p: new THREE.Vector3((i - 2) * 0.085, 0.45 + i * 0.06, Math.sin(i) * 0.06),
        v: new THREE.Vector3(),
      })),
    [],
  );
  useEffect(() => {
    const id = setInterval(() => {
      const b = balls[Math.floor(Math.random() * N)];
      b.v.y += 0.7;
      b.v.x += (Math.random() - 0.5) * 0.5;
      b.v.z += (Math.random() - 0.5) * 0.5;
    }, 3000);
    return () => clearInterval(id);
  }, [balls]);
  useFrame((_, delta) => {
    // Pause physics when the tab/canvas is hidden — no point integrating an unseen scene.
    if (typeof document !== "undefined" && document.hidden) return;
    const dt = Math.min(delta, 0.033);
    for (const b of balls) {
      b.v.y -= 2.4 * dt; // gravity
      b.p.addScaledVector(b.v, dt);
      (["x", "z"] as const).forEach((ax) => {
        if (b.p[ax] > BIN_HALF - BIN_R) { b.p[ax] = BIN_HALF - BIN_R; b.v[ax] *= -0.5; }
        if (b.p[ax] < -BIN_HALF + BIN_R) { b.p[ax] = -BIN_HALF + BIN_R; b.v[ax] *= -0.5; }
      });
      if (b.p.y < BIN_R) { b.p.y = BIN_R; b.v.y *= -0.45; b.v.x *= 0.9; b.v.z *= 0.9; }
      b.v.multiplyScalar(0.992);
    }
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++) {
        const a = balls[i].p, c = balls[j].p;
        const dx = a.x - c.x, dy = a.y - c.y, dz = a.z - c.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist > 0.0001 && dist < BIN_R * 2) {
          const push = (BIN_R * 2 - dist) / dist * 0.5;
          a.x += dx * push; a.y += dy * push; a.z += dz * push;
          c.x -= dx * push; c.y -= dy * push; c.z -= dz * push;
          balls[i].v.x += dx * push * 3; balls[j].v.x -= dx * push * 3;
          balls[i].v.z += dz * push * 3; balls[j].v.z -= dz * push * 3;
        }
      }
    balls.forEach((b, i) => refs.current[i]?.position.copy(b.p));
  });
  const colors = [p.screen, "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  return (
    <group position={pos}>
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.5, 0.36, 0.5]} />
        <meshStandardMaterial color="#cfe6ff" transparent opacity={0.12} roughness={0.05} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[0.5, 0.04, 0.5]} />
        <meshStandardMaterial color={p.metalDark} />
      </mesh>
      {colors.map((c, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }} castShadow>
          <sphereGeometry args={[BIN_R, 16, 16]} />
          <meshStandardMaterial color={c} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function Plant({ p, pos, scale = 1 }: { p: RoomPalette; pos: [number, number, number]; scale?: number }) {
  return (
    <group position={pos} scale={scale}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.28, 0.34, 0.5, 12]} />
        <meshStandardMaterial color={p.pot} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.5, 14, 14]} />
        <meshStandardMaterial color={p.plant} roughness={0.85} />
      </mesh>
    </group>
  );
}

// Draw the company brand onto a canvas → texture (asset-free, offline-safe). Shown on the TV.
function brandTexture(name: string, accent: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 288;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#06080c";
  ctx.fillRect(0, 0, 512, 288);
  // diamond brand mark
  ctx.strokeStyle = accent;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(256, 40);
  ctx.lineTo(320, 96);
  ctx.lineTo(256, 152);
  ctx.lineTo(192, 96);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(256, 96, 16, 0, Math.PI * 2);
  ctx.fill();
  // company name
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 60px -apple-system, 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name.toUpperCase().slice(0, 14), 256, 212);
  // accent underline
  ctx.fillStyle = accent;
  ctx.fillRect(120, 252, 272, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

// Wall-mounted marketing screen showing the company brand. Mounted on wall B, facing the room.
function WallTV({ name, tier, accent }: { name: string; tier: number; accent: string }) {
  const tex = useMemo(() => brandTexture(name, accent), [name, accent]);
  useEffect(() => () => tex.dispose(), [tex]);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((st) => {
    if (mat.current) mat.current.emissiveIntensity = 0.85 + Math.sin(st.clock.elapsedTime * 1.6) * 0.1;
  });
  const w = 1.7 + Math.min(tier, 5) * 0.12;
  const h = w * 0.56;
  return (
    <group position={[-3.95, 2.95, -2.7]} rotation-y={Math.PI / 2}>
      {/* bezel */}
      <RoundedBox args={[w + 0.12, h + 0.12, 0.08]} radius={0.03} smoothness={3}>
        <meshStandardMaterial color="#0a0d13" roughness={0.4} metalness={0.5} />
      </RoundedBox>
      {/* screen */}
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial ref={mat} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
    </group>
  );
}

// Espresso machine + counter that appears with the Amenities upgrade.
function CoffeeStation({ p }: { p: RoomPalette }) {
  return (
    <group position={[-3.6, 0, 0.5]}>
      {/* counter */}
      <RoundedBox args={[0.95, 0.9, 0.55]} radius={0.04} smoothness={3} position={[0, 0.45, 0]}>
        <meshStandardMaterial color={p.deskDark} roughness={0.6} />
      </RoundedBox>
      {/* machine body */}
      <RoundedBox args={[0.5, 0.42, 0.36]} radius={0.05} smoothness={3} position={[0, 1.12, -0.04]}>
        <meshStandardMaterial color={p.metal} metalness={0.6} roughness={0.3} />
      </RoundedBox>
      {/* group head */}
      <mesh position={[0, 0.94, 0.16]}>
        <cylinderGeometry args={[0.04, 0.055, 0.12, 12]} />
        <meshStandardMaterial color={p.metalDark} metalness={0.7} roughness={0.2} />
      </mesh>
      {/* power light */}
      <mesh position={[0.16, 1.22, 0.14]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      {/* cup with steam */}
      <group position={[0, 0.92, 0.18]} scale={0.7}>
        <Mug hue="#efeae0" />
      </group>
    </group>
  );
}

// Drafting easel with a glowing design canvas — appears with the Design Suite upgrade.
function DesignEasel({ p }: { p: RoomPalette }) {
  return (
    <group position={[3.5, 0, 0.9]} rotation-y={-0.6}>
      {/* legs */}
      {[[-0.35, 0.3], [0.35, 0.3], [0, -0.3]].map((l, i) => (
        <mesh key={i} position={[l[0], 0.55, l[1]]} rotation-x={l[1] < 0 ? 0.2 : -0.12} rotation-z={l[0] === 0 ? 0 : l[0] < 0 ? 0.12 : -0.12}>
          <cylinderGeometry args={[0.03, 0.03, 1.2, 8]} />
          <meshStandardMaterial color={p.deskDark} roughness={0.6} />
        </mesh>
      ))}
      {/* angled board with a green design surface */}
      <group position={[0, 1.15, 0.06]} rotation-x={-0.42}>
        <RoundedBox args={[0.92, 1.2, 0.05]} radius={0.02} smoothness={2}>
          <meshStandardMaterial color={p.metalDark} roughness={0.5} />
        </RoundedBox>
        <mesh position={[0, 0, 0.03]}>
          <planeGeometry args={[0.82, 1.08]} />
          <meshStandardMaterial color="#1eb877" emissive="#1eb877" emissiveIntensity={0.55} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

// Glass test chamber with a device under a sweeping scan beam — appears with the Test Lab upgrade.
function TestChamber({ p }: { p: RoomPalette }) {
  const scan = useRef<THREE.Mesh>(null);
  useFrame((st) => {
    if (scan.current) scan.current.position.y = 1.02 + (Math.sin(st.clock.elapsedTime * 1.4) * 0.5 + 0.5) * 0.42;
  });
  return (
    <group position={[3.6, 0, -1.5]}>
      <RoundedBox args={[0.9, 0.9, 0.7]} radius={0.04} smoothness={3} position={[0, 0.45, 0]}>
        <meshStandardMaterial color={p.deskDark} roughness={0.6} />
      </RoundedBox>
      {/* glass cube */}
      <mesh position={[0, 1.22, 0]}>
        <boxGeometry args={[0.62, 0.62, 0.62]} />
        <meshStandardMaterial color="#cfe6ff" transparent opacity={0.12} roughness={0.05} metalness={0.1} />
      </mesh>
      {/* device under test */}
      <mesh position={[0, 1.0, 0]} rotation-y={0.5}>
        <boxGeometry args={[0.14, 0.27, 0.02]} />
        <meshStandardMaterial color={p.metal} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* sweeping scan plane */}
      <mesh ref={scan} position={[0, 1.2, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.58, 0.58]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ---- Office builder: furniture + drag-to-move interaction ----
// Press a piece and drag it across the floor; it follows your finger, snaps to the grid, and
// drops where you release (green ghost = valid, red = blocked). Tap the palette → tap to place.
function BuildLayer({ p, b }: { p: RoomPalette; b: BuildProps }) {
  const [dragIid, setDragIid] = useState<string | null>(null);
  const [dragCell, setDragCell] = useState<{ c: number; r: number } | null>(null);
  const [hover, setHover] = useState<{ c: number; r: number } | null>(null);
  const size = GRID.n * GRID.cell;
  const placeDef = b.placingType ? furnitureDef(b.placingType) : null;
  const placeFp = placeDef ? footprint(placeDef, b.placeRot) : null;

  const dragItem = dragIid ? b.layout.find((x) => x.iid === dragIid) ?? null : null;
  const dragFp = dragItem ? footprint(furnitureDef(dragItem.type), dragItem.rot) : null;

  // Commit the drop wherever the pointer is released (even off the grid → snaps back).
  const live = useRef<{ iid: string | null; cell: { c: number; r: number } | null; move: BuildProps["onMoveItem"] }>({ iid: null, cell: null, move: b.onMoveItem });
  live.current = { iid: dragIid, cell: dragCell, move: b.onMoveItem };
  useEffect(() => {
    const up = () => {
      const { iid, cell, move } = live.current;
      if (iid) {
        if (cell) move(iid, cell.c, cell.r);
        setDragIid(null);
        setDragCell(null);
      }
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const placeOk = hover && b.placingType ? canPlace(b.layout, b.placingType, hover.c, hover.r, b.placeRot) : false;
  const dragOk = dragCell && dragItem ? canPlace(b.layout, dragItem.type, dragCell.c, dragCell.r, dragItem.rot, dragItem.iid) : false;

  return (
    <group>
      {/* placed furniture (the dragged one follows the cursor, lifted slightly) */}
      {b.layout.map((it) => {
        const isDrag = it.iid === dragIid;
        const cell = isDrag && dragCell ? dragCell : { c: it.c, r: it.r };
        const { x, z, rotY } = worldOf({ ...it, c: cell.c, r: cell.r });
        const def = furnitureDef(it.type);
        const selected = b.build && b.selectedIid === it.iid;
        return (
          <group
            key={it.iid}
            position={[x, isDrag ? 0.2 : 0, z]}
            rotation-y={rotY}
            onPointerDown={
              b.build
                ? (e: ThreeEvent<PointerEvent>) => {
                    // While placing a new piece, let the tap fall through to the floor so it lands
                    // on the cell the player aimed at (not the offset top-of-furniture hit point).
                    if (b.placingType) return;
                    e.stopPropagation();
                    b.onSelectItem(it.iid);
                    setDragIid(it.iid);
                    setDragCell({ c: it.c, r: it.r });
                  }
                : undefined
            }
          >
            <FurniturePiece type={it.type} p={p} />
            {selected && (
              <mesh rotation-x={-Math.PI / 2} position={[0, 0.035, 0]}>
                <planeGeometry args={[def.w * GRID.cell, def.d * GRID.cell]} />
                <meshBasicMaterial color="#3b82f6" transparent opacity={0.4} depthWrite={false} />
              </mesh>
            )}
          </group>
        );
      })}

      {b.build && (
        <>
          <gridHelper args={[size, GRID.n, "#7fa8ff", "#465065"]} position={[0, 0.02, 0]} />
          {/* invisible floor — drives drag tracking, placement + deselect */}
          <mesh
            rotation-x={-Math.PI / 2}
            position={[0, 0.015, 0]}
            onPointerMove={(e: ThreeEvent<PointerEvent>) => {
              if (dragIid && dragFp) {
                const c = cellAt(e.point.x, e.point.z, dragFp.w, dragFp.d);
                setDragCell((p) => (p && p.c === c.c && p.r === c.r ? p : c)); // skip redundant re-renders
              } else if (b.placingType && placeFp) {
                const c = cellAt(e.point.x, e.point.z, placeFp.w, placeFp.d);
                setHover((p) => (p && p.c === c.c && p.r === c.r ? p : c));
              }
            }}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              if (b.placingType && placeFp) {
                const c = cellAt(e.point.x, e.point.z, placeFp.w, placeFp.d);
                b.onPlaceCell(c.c, c.r);
              } else {
                b.onSelectItem(null);
              }
            }}
            onPointerLeave={() => { setHover(null); if (dragIid) setDragCell(null); }}
          >
            <planeGeometry args={[size, size]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {/* ghost while placing a new item */}
          {b.placingType && placeFp && hover && !dragIid && (
            <mesh position={[GRID_ORIGIN + (hover.c + placeFp.w / 2) * GRID.cell, 0.07, GRID_ORIGIN + (hover.r + placeFp.d / 2) * GRID.cell]}>
              <boxGeometry args={[placeFp.w * GRID.cell - 0.06, 0.12, placeFp.d * GRID.cell - 0.06]} />
              <meshBasicMaterial color={placeOk ? "#1eb877" : "#ef4444"} transparent opacity={0.42} depthWrite={false} />
            </mesh>
          )}
          {/* ghost target while dragging */}
          {dragIid && dragFp && dragCell && (
            <mesh position={[GRID_ORIGIN + (dragCell.c + dragFp.w / 2) * GRID.cell, 0.045, GRID_ORIGIN + (dragCell.r + dragFp.d / 2) * GRID.cell]}>
              <boxGeometry args={[dragFp.w * GRID.cell - 0.05, 0.06, dragFp.d * GRID.cell - 0.05]} />
              <meshBasicMaterial color={dragOk ? "#1eb877" : "#ef4444"} transparent opacity={0.4} depthWrite={false} />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}

function Scene({ staff, staffCount, facilityTier, hasProduction, upgrades, companyName, dark, builder, roomStyle }: { staff: Staff[]; staffCount: number; facilityTier: number; hasProduction: boolean; upgrades: Upgrades; companyName: string; dark: boolean; builder?: BuildProps; roomStyle: { floor: number; wall: number } }) {
  const p = useMemo(() => roomPalette(dark), [dark]);
  const occupants = Math.max(1, Math.min(6, staffCount, staff.length));
  const desks = useMemo(() => deskPositions(occupants), [occupants]);
  const monitors = tierOf(upgrades, "computers") >= 2 ? 2 : 1;
  const amenityTier = tierOf(upgrades, "amenities");
  const finish = floorFinish(roomStyle.floor);
  const wall = wallStyle(roomStyle.wall);
  return (
    <>
      <VisibilityPause />
      <CameraRig build={!!builder?.build} />
      <ambientLight intensity={dark ? 0.55 : 1.05} color={dark ? "#ffffff" : "#f8f9ff"} />
      <directionalLight position={[7, 10, 6]} intensity={dark ? 0.7 : 1.1} color={dark ? "#fff4e0" : "#ffffff"} castShadow={false} />
      <directionalLight position={[-5, 8, 4]} intensity={dark ? 0.15 : 0.45} color={dark ? "#c0d4ff" : "#e8f0ff"} />
      <pointLight position={[0, 3.4, 0]} intensity={dark ? 14 : 6} distance={12} decay={2} color={p.lamp} />
      <pointLight position={[0, 1.3, 0.5]} intensity={dark ? 3 : 1.5} distance={7} decay={2} color={p.screen} />

      <Room p={p} dark={dark} finish={finish} wall={wall} />
      {/* distant skyline behind the windows (boxes outside each wall) */}
      <group>
        {/* outside wall B (−x), seen through the side window */}
        {[[-1.8, 2.6], [-0.9, 4.0], [0.0, 2.0], [0.9, 3.2]].map((b, i) => (
          <mesh key={`bx${i}`} position={[-5.3, b[1] / 2, b[0]]}>
            <boxGeometry args={[0.7, b[1], 0.9]} />
            <meshStandardMaterial color={dark ? "#2a3550" : "#9fb6d6"} roughness={0.9} />
          </mesh>
        ))}
        {/* outside wall A (−z), seen through the door windows */}
        {[[-1.6, 3.0], [0.2, 4.4], [1.8, 2.4], [3.0, 3.6]].map((b, i) => (
          <mesh key={`bz${i}`} position={[b[0], b[1] / 2, -5.3]}>
            <boxGeometry args={[0.9, b[1], 0.7]} />
            <meshStandardMaterial color={dark ? "#2a3550" : "#9fb6d6"} roughness={0.9} />
          </mesh>
        ))}
      </group>
      {/* rug under the pod */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0.3]}>
        <circleGeometry args={[3.5, 40]} />
        <meshStandardMaterial color={p.screen} transparent opacity={facilityTier > 1 ? 0.12 : 0.06} roughness={1} />
      </mesh>

      {/* desks grow with the team — one per person, starting from a single desk */}
      {desks.map((pos, i) => (
        <Workstation key={i} p={p} pos={pos} staff={staff[i]} seed={i * 2.1} monitors={monitors} />
      ))}
      <Props p={p} hasProduction={hasProduction} />
      {!builder?.build && <Robot p={p} />}
      <Dust />
      <BallBin p={p} pos={[3.1, 1.31, -3.0]} />

      {/* player-arranged furniture + the drag-to-move builder */}
      {builder && <BuildLayer p={p} b={builder} />}

      {/* ---- Upgrades made physical: each company upgrade adds real furniture ---- */}
      {/* Marketing Suite → a branded wall screen */}
      {tierOf(upgrades, "marketing") >= 1 && <WallTV name={companyName} tier={tierOf(upgrades, "marketing")} accent="#3b82f6" />}
      {/* Amenities → a coffee station + greenery that grows with the tier */}
      {amenityTier >= 1 && <CoffeeStation p={p} />}
      {amenityTier >= 2 && <Plant p={p} pos={[-3.3, 0, 3.1]} scale={0.85} />}
      {amenityTier >= 3 && <Plant p={p} pos={[3.4, 0, 1.4]} scale={0.75} />}
      {amenityTier >= 4 && <Plant p={p} pos={[3.5, 0, 0.0]} scale={0.7} />}
      {/* Design Suite → a drafting easel */}
      {tierOf(upgrades, "designSuite") >= 1 && <DesignEasel p={p} />}
      {/* Test Lab → a glass test chamber */}
      {tierOf(upgrades, "testLab") >= 1 && <TestChamber p={p} />}

      {/* Always-present office fixtures: kanban board, vault, security gate */}
      <KanbanWall />
      <Vault />
      <SecurityGate />

      {/* Ambient robots — positions match reference image layout */}
      {/* orange: near whiteboard on left wall */}
      <group position={[-1.8, 0, 0.4]} rotation-y={0.5}>
        <OfficeRobot colorIdx={1} seed={7.3} clip="Idle" />
      </group>
      {/* green: center of room */}
      <group position={[0.2, 0, 0.6]} rotation-y={-0.3}>
        <OfficeRobot colorIdx={2} seed={9.7} clip="Idle" />
      </group>
      {/* purple: facing kanban wall on right side */}
      <group position={[2.8, 0, -0.4]} rotation-y={-1.4}>
        <OfficeRobot colorIdx={3} seed={11.1} clip="Idle" />
      </group>
      {/* yellow: near security gate at front */}
      <group position={[2.4, 0, 2.8]} rotation-y={-2.0}>
        <OfficeRobot colorIdx={4} seed={15.6} clip="Idle" />
      </group>

      {/* Floating zone labels */}
      {!builder?.build && (
        <>
          <OfficeLabel pos={[-3.1, 3.55, 2.9]} label="Whiteboard" sub="Ideas & Planning" dot="#f97316" />
          <OfficeLabel pos={[3.4, 3.9, 0.2]} label="Kanban Wall" sub="Work Items · Active" dot="#3b82f6" />
          <OfficeLabel pos={[-2.8, 2.1, 1.6]} label="Vault" sub="Secure Storage" dot="#9095a0" />
          <OfficeLabel pos={[1.6, 1.7, 3.55]} label="Security Gate" sub="Access Control" dot="#10b981" />
          {staff[0] && <OfficeLabel pos={[-1.2, 2.05, 2.2]} label={`Desk 01`} sub={staff[0].name ?? "Engineer"} dot={ROBOT_COLORS[0]} />}
        </>
      )}

      {/* Bake the shadow pass once (frames={1}) — the scene is mostly static, so re-rendering the
          depth pass every frame is wasted GPU. Re-bakes when the layout key below changes. */}
      <ContactShadows key={builder?.layout.length ?? 0} position={[0, 0.02, 0]} scale={16} blur={2.6} far={6} opacity={dark ? 0.5 : 0.35} color={p.shadow} resolution={512} frames={1} />
    </>
  );
}

export function Garage3D({
  staff = [],
  staffCount,
  facilityTier,
  hasProduction,
  upgrades = {},
  companyName = "Silicon",
  height = 250,
  dark,
  builder,
  roomStyle = { floor: 0, wall: 0 },
  onContextLost,
}: {
  staff?: Staff[];
  staffCount: number;
  facilityTier: number;
  hasProduction: boolean;
  upgrades?: Upgrades;
  companyName?: string;
  height?: number;
  dark: boolean;
  builder?: BuildProps;
  roomStyle?: { floor: number; wall: number };
  /** Called when the WebGL context is lost so the host can downgrade to the 2D fallback. */
  onContextLost?: () => void;
}) {
  return (
    <div style={{ height, width: "100%" }}>
      <Canvas
        role="img"
        aria-label="Company office, 3D view"
        dpr={[1, 1.75]}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [11.5, 9.0, 12.5], fov: 28 }}
        style={{ touchAction: builder?.build ? "none" : "pan-y" }}
        onCreated={({ gl }) => {
          // Context-loss recovery: downgrade to the 2D IsoScene instead of going black.
          gl.domElement.addEventListener(
            "webglcontextlost",
            (e) => {
              e.preventDefault();
              onContextLost?.();
            },
            { once: true },
          );
        }}
      >
        <Scene staff={staff} staffCount={staffCount} facilityTier={facilityTier} hasProduction={hasProduction} upgrades={upgrades} companyName={companyName} dark={dark} builder={builder} roomStyle={roomStyle} />
      </Canvas>
    </div>
  );
}
