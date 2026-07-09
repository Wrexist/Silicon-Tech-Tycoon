// Procedural real-time 3D HQ (react-three-fiber). Zero image assets — everything is built
// from primitives + materials + real lights. Scoped to the garage only; devices stay SVG.
import { Component, Suspense, lazy, memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, RoundedBox, Html } from "@react-three/drei";
import { PartyPopper, Sparkles, Star, ThumbsUp, Rocket, Frown, CloudRain, BatteryLow, Meh, ThumbsDown } from "lucide-react";
import * as THREE from "three";
import { moodBand, type MoodBand } from "../engine/staff.ts";
import type { Staff } from "../engine/types.ts";
import type { UpgradeId } from "../engine/upgrades.ts";
import {
  canPlace,
  cellAt,
  deskItems,
  footprint,
  furnitureDef,
  GRID,
  gridN,
  gridOrigin,
  isDeskType,
  worldOf,
  type FurnitureId,
  type PlacedItem,
  type Rot,
} from "../engine/furniture.ts";
import { FurniturePiece } from "./furniture3d.tsx";
import { floorFinish, wallStyle, type FloorFinish, type WallStyle } from "../engine/roomStyle.ts";
import { roomPalette, type RoomPalette } from "./palette.ts";
import { ROBOT_COLORS, robotModelFor } from "./robotModels.ts";
import { reactionIntensity, onHqReaction, HQ_REACTION_MS, type HqReaction } from "../design/hqReaction.ts";
import { highlightIntensity } from "../design/hqHighlight.ts";

/** Wraps an upgrade's physical office object(s); when its card is tapped (hqHighlight) it does a
 *  decaying attention hop so the player can SEE what that upgrade added. Additive y-offset only. */
function Pulse({ feature, children }: { feature: UpgradeId; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((st) => {
    const k = highlightIntensity(feature);
    if (ref.current) ref.current.position.y = k > 0 ? Math.abs(Math.sin(st.clock.elapsedTime * 11)) * 0.13 * k : 0;
  });
  return <group ref={ref}>{children}</group>;
}

type Upgrades = Partial<Record<UpgradeId, number>>;
const tierOf = (u: Upgrades, id: UpgradeId) => u[id] ?? 0;

// The office footprint scales with the facility tier (bigger building = more desks + open floor).
// The room shell + its fixtures render inside a group scaled by this factor, while the furniture
// grid uses the tier-aware worldOf/gridOrigin so desks fill the larger CENTRED grid at real size.
const roomScaleFor = (facilityTier: number) => gridN(facilityTier) / GRID.n;

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

const MOOD_HEX: Record<MoodBand, string> = {
  thriving: "#10b981",
  happy: "#10b981",
  neutral: "#9aa0a6",
  tired: "#f59e0b",
  burnedout: "#ef4444",
};

// ROBOT_COLORS lives in robotModels.ts (single source — also drives the shared-model tint).

// Desk slots — every hired employee gets one workstation (desk + computer + robot). Two columns
// that fill front-to-back as the team grows, all facing the camera (+z) and clear of the vault /
// gate / kanban / whiteboard / corner plants. Founder takes slot 0 (front-left).
// Overflow (more employees than PLACED desks — e.g. a desk was removed in Decorate) — these
// employees roam the open floor with obstacle-avoidance instead of getting a workstation.
const ROAM_HOMES: [number, number][] = [
  [0.4, 1.4],
  [-0.6, -0.2],
  [0.8, -0.6],
  [-0.2, 0.6],
];

/** Roam anchor for overflow employee i. The 5th+ roamer used to land EXACTLY on an earlier one's
 *  home (i % 4) and the pair would jitter against each other (no roamer-roamer separation, only
 *  furniture repulsion) — so successive occupants of a home are fanned out around it on a small
 *  golden-angle spiral, clamped to the floor slab. */
function roamHomeFor(i: number): [number, number] {
  const base = ROAM_HOMES[i % ROAM_HOMES.length];
  const ring = Math.floor(i / ROAM_HOMES.length);
  if (ring === 0) return base;
  const a = i * 2.39996; // golden angle — no two offsets align
  const r = 0.85 * ring;
  const cl = (v: number) => Math.max(-ROAM_BOUND, Math.min(ROAM_BOUND, v));
  return [cl(base[0] + Math.cos(a) * r), cl(base[1] + Math.sin(a) * r)];
}

// Build mode lifts the camera to a higher, more overhead angle so the whole floor grid is
// readable; otherwise it's the cozy parallax view. WASD lets the player drive the view:
// A/D orbit around the room, W/S zoom in/out, Q/E (or R/F) raise/lower the eye height.
// Shared camera dolly offset (in the same units as baseR): written by both the W/S keys and the
// pinch-to-zoom handler, read by CameraRig every frame. A plain module singleton (no React state) so
// the render loop stays allocation-free and the DOM touch handler can drive it without re-renders.
// Mirrors the hqReaction event-bus pattern used elsewhere in this scene.
const CAM_ZOOM_MIN = -6;
const CAM_ZOOM_MAX = 13;
let camZoomOffset = 0;
function getCamZoom(): number { return camZoomOffset; }
function setCamZoom(v: number): void { camZoomOffset = Math.max(CAM_ZOOM_MIN, Math.min(CAM_ZOOM_MAX, v)); }

function CameraRig({ build = false, facilityTier = 1 }: { build?: boolean; facilityTier?: number }) {
  const { camera, pointer } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 1.5, 0), []);
  const keys = useRef<Set<string>>(new Set());
  const orbit = useRef({ yaw: 0, lift: 0 }); // player camera offsets (zoom lives in the shared singleton)
  const lastPointer = useRef({ x: 0, y: 0 }); // for the settle check

  // Each mode (decorate vs. normal) has its own default framing, so reset the dolly when the mode
  // flips, otherwise a big pinch-out in Decorate would leave the normal office zoomed out too.
  useEffect(() => { setCamZoom(0); }, [build]);

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
    if (ks.has("w")) setCamZoom(getCamZoom() - zoomSpd); // closer
    if (ks.has("s")) setCamZoom(getCamZoom() + zoomSpd); // farther
    if (ks.has("q") || ks.has("r")) o.lift = Math.min(7, o.lift + liftSpd); // higher
    if (ks.has("e") || ks.has("f")) o.lift = Math.max(-3, o.lift - liftSpd); // lower

    const k = Math.min(1, dt * 2.5);
    // Decorate view was framed close (baseR ≈ 10.6) for precise placement, but that cropped the
    // room's edges off-screen (and the shop panel hides the front row), so furniture near the walls
    // was unreachable. Pull back + raise the angle so the WHOLE grid sits in the visible area above
    // the panel; W/S (or a pinch, if added) still let you dolly in for fine placement.
    const px = build ? 9.5 : 15.5;
    const py = build ? 13.6 : 13.0;
    const pz = build ? 12.5 : 17.5;
    const ty = build ? 0.5 : 0.7;

    // Convert the base offset to an orbit (radius + azimuth) so A/D rotates around the room
    // and W/S dollies in/out, while pointer parallax + smoothing are preserved. The radius scales
    // with the facility so a bigger office (Studio/Campus) is framed whole, not cropped.
    const baseR = Math.hypot(px, pz) * roomScaleFor(facilityTier);
    const r = Math.max(4, baseR + getCamZoom());
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

// Pinch-to-zoom: a two-finger gesture on the canvas dollies the camera in/out via the shared zoom
// offset. Single-finger gestures are untouched (they still pan / drag furniture). Listeners are
// non-passive so the pinch can preventDefault the browser's native page zoom; only acts on exactly
// two active touches, so it never fights a one-finger drag.
function PinchZoom() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    let active = false;
    let startDist = 0;
    let startZoom = 0;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        active = true;
        startDist = dist(e.touches);
        startZoom = getCamZoom();
      }
    };
    const move = (e: TouchEvent) => {
      if (!active || e.touches.length !== 2) return;
      e.preventDefault(); // own the pinch, stop the page's native zoom/scroll under it
      const d = dist(e.touches);
      // Spreading the fingers (d > startDist) reduces the offset → camera dollies closer (zoom in);
      // pinching together pushes it farther (zoom out). 0.04 maps finger travel to a comfortable range.
      setCamZoom(startZoom + (startDist - d) * 0.04);
    };
    const end = (e: TouchEvent) => { if (e.touches.length < 2) active = false; };
    el.addEventListener("touchstart", start, { passive: false });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [gl]);
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
      {/* Room floor as a finished slab sized to the walls. (Was an 18×18 plane that ran ~4.8m past
          the ±4.2 walls on every side, so anything near the edge looked stranded outside the room.)
          The slab's thickness gives the open dollhouse sides — front (+z) and the culled right (+x)
          — a clean, premium plate edge instead of a hard cut. */}
      <RoundedBox args={[FLOOR_SIZE, FLOOR_SLAB_THICKNESS, FLOOR_SIZE]} radius={FLOOR_EDGE_RADIUS} smoothness={3} position={[0, -FLOOR_SLAB_THICKNESS / 2, 0]}>
        <meshStandardMaterial color={color} roughness={finish.roughness} metalness={finish.metalness} />
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

/** Dollhouse wall culling: any wall sitting between the camera and the room interior hides, so
 *  the player always looks INTO the room — in the default view AND while WASD-orbiting. A small
 *  hysteresis band stops flicker when the camera crosses an axis; state only changes on a flip. */
export interface WallCull { a: boolean; b: boolean; r: boolean } // a = back (−z), b = left (−x), r = right (+x)

function useWallCull(): WallCull {
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

function Room({ p, dark, finish, wall, cull, showWhiteboard = true }: { p: RoomPalette; dark: boolean; finish: FloorFinish; wall: WallStyle; cull: WallCull; showWhiteboard?: boolean }) {
  const wzA = -4.2;
  const isBrick = wall.kind === "brick";
  const wallColor = dark ? wall.dark : wall.light;

  // LIGHT MODE = open "floating diorama": a rounded white floor slab sitting in the white void,
  // with two low L-shaped back walls (no ceiling, no front/right walls) — like the reference.
  if (!dark) {
    return (
      <group>
        {/* floating rounded floor slab (the diorama plate) */}
        <RoundedBox args={[9.4, 0.5, 9.4]} radius={0.22} smoothness={4} position={[0, -0.25, 0]}>
          <meshStandardMaterial color="#fbfcfe" roughness={0.92} />
        </RoundedBox>
        {/* faint top inlay so the floor reads as a surface, not a blank slab */}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]}>
          <planeGeometry args={[9.0, 9.0]} />
          <meshStandardMaterial color="#f4f5f8" roughness={0.95} />
        </mesh>
        {/* low back wall (−z) cluster — hides when the camera swings behind it. Both back walls were
            centred + 8.8 long, so each ran 0.4 past their shared corner and the two overshoots crossed
            into a "+" poking up above the join. Trim the −x end to stop AT the side wall (x = −4.0) so
            they meet as a clean right-angle corner instead. (The open +x/+z ends stay put.) */}
        <group visible={!cull.a}>
          <mesh position={[0.2, 1.25, -4.0]}>
            <boxGeometry args={[8.4, 2.7, 0.16]} />
            <meshStandardMaterial color="#eef0f3" roughness={0.96} />
          </mesh>
          <mesh position={[0.2, 0.07, -3.95]}>
            <boxGeometry args={[8.4, 0.14, 0.06]} />
            <meshStandardMaterial color="#dfe2e7" roughness={0.95} />
          </mesh>
          {/* whiteboard on the low back wall (−z), facing the room — gated (an earned upgrade) */}
          {showWhiteboard && <Whiteboard p={p} pos={[-1.2, 1.55, -3.88]} rotY={0} />}
        </group>
        {/* low side wall (−x) cluster — its −z end likewise stops at the back wall (z = −4.0). */}
        <group visible={!cull.b}>
          <mesh position={[-4.0, 1.25, 0.2]}>
            <boxGeometry args={[0.16, 2.7, 8.4]} />
            <meshStandardMaterial color="#e8eaee" roughness={0.96} />
          </mesh>
          <mesh position={[-3.95, 0.07, 0.2]}>
            <boxGeometry args={[0.06, 0.14, 8.4]} />
            <meshStandardMaterial color="#dfe2e7" roughness={0.95} />
          </mesh>
        </group>
      </group>
    );
  }

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
        {dark && <GarageDoor p={p} z={wzA + 0.24} />}
      </group>

      {/* ── wall B cluster (left, −x: brick/finish + window + pegboard) — dollhouse-culled ── */}
      <group visible={!cull.b}>
        <mesh position={[-4.2, 2.6, 0]}>
          <boxGeometry args={[0.3, 5.2, 8.4]} />
          <meshStandardMaterial color={isBrick ? p.brickEdge : wallColor} roughness={wall.kind === "concrete" ? 0.95 : 0.8} metalness={wall.kind === "panel" ? 0.05 : 0} />
        </mesh>
        {isBrick && <BrickWall p={p} backZ={-4.1} />}
        {wall.kind === "panel" && [-3.0, -1.5, 0, 1.5, 3.0].map((z, i) => (
          <mesh key={i} position={[-4.04, 2.6, z]}><boxGeometry args={[0.02, 5.0, 0.04]} /><meshStandardMaterial color={dark ? "#2a1f15" : "#8a6843"} roughness={0.7} /></mesh>
        ))}
      </group>

      {dark && <StringLights />}
      {/* clean-mode ceiling (light mode): flush white soffit instead of beams */}
      {!dark && (
        <mesh position={[0, 5.2, 0]}>
          <boxGeometry args={[8.4, 0.2, 8.6]} />
          <meshStandardMaterial color="#f0f1f4" roughness={0.9} />
        </mesh>
      )}
      {/* ── right wall (+x) — hidden in the default view (it boxed the room in); appears only
            when the camera orbits to the other side and it becomes the far wall ── */}
      <mesh visible={!cull.r} position={[4.2, 2.6, 0]}>
        <boxGeometry args={[0.3, 5.2, 8.4]} />
        <meshStandardMaterial color={dark ? "#272d37" : "#e8e9ec"} roughness={0.85} />
      </mesh>
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

// Lighten/darken a hex colour for two-tone shading (belly highlight, dark visor, etc.).
function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  if (amt >= 0) c.lerp(new THREE.Color("#ffffff"), amt);
  else c.lerp(new THREE.Color("#000000"), -amt);
  return `#${c.getHexString()}`;
}

// How high the seated robot rides above its floor pivot so its torso rests on the chair seat
// (Chair seat top ≈ 0.58; the robot's torso underside sits ≈0.18 above its pivot → ≈0.4 lift).
const SIT_LIFT = 0.4;

// Premium mascot robot: rounded two-tone shell, dark eye-visor with glowing eyes, antenna with a
// lit tip, little arms + hands, rounded feet, metallic neck ring. ~1.45m tall, grounded at y=0.
// `walking` toggles a stride swing; `sitting` folds it onto a chair; otherwise a gentle idle.
function RobotCharacter({ colorIdx, seed, moodColor, walking = false, sitting = false }: { colorIdx: number; seed: number; moodColor?: string; walking?: boolean; sitting?: boolean }) {
  const color = ROBOT_COLORS[colorIdx % ROBOT_COLORS.length];
  const belly = useMemo(() => shade(color, 0.32), [color]);
  const dark = useMemo(() => shade(color, -0.5), [color]);
  const metal = "#c7cdd6";
  const root = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const antRef = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Group>(null);
  const armRRef = useRef<THREE.Group>(null);
  const legLRef = useRef<THREE.Group>(null);
  const legRRef = useRef<THREE.Group>(null);

  useFrame((st) => {
    const t = st.clock.elapsedTime + seed;
    // Living-office reactions: a bouncy hop + raised arms on a win (cheer), or a head-down droop on
    // a flop (slump). Both decay over the reaction window (hqReaction).
    const cheer = reactionIntensity("cheer");
    const slump = reactionIntensity("slump");
    // Seated robots are lifted onto the seat (SIT_LIFT above the floor pivot) and stay planted — no
    // standing bob — with a cheer reduced to a small in-seat bounce. SIT_LIFT lives here (not on the
    // parent) so a rigged .glb playing its own grounded "Sitting" clip isn't pushed off the chair.
    const baseY = sitting
      ? SIT_LIFT
      : walking ? Math.abs(Math.sin(t * 6)) * 0.05 : Math.sin(t * 1.5) * 0.035;
    const hop = cheer > 0 ? Math.abs(Math.sin(t * 9)) * (sitting ? 0.05 : 0.14) * cheer : 0; // seeded t → each robot hops out of phase
    if (root.current) root.current.position.y = baseY + hop - slump * 0.05; // sag a little on a flop
    if (headRef.current) {
      const calm = 1 - slump;
      headRef.current.rotation.y = Math.sin(t * 0.6) * (walking ? 0.08 : 0.22) * calm;
      headRef.current.rotation.z = Math.sin(t * 0.95) * 0.04 * calm;
      headRef.current.rotation.x = slump * 0.55; // head hangs down
    }
    if (antRef.current) {
      antRef.current.rotation.z = Math.sin(t * 2.2) * (0.18 + cheer * 0.6) * (1 - slump);
      antRef.current.rotation.x = slump * 0.9; // antenna droops forward
    }
    // arms: brisk swing while walking, soft sway when idle, drawn forward to rest at the desk when
    // seated — and thrown overhead on a cheer.
    const arm = walking ? Math.sin(t * 6) * 0.7 : Math.sin(t * 1.6) * 0.12;
    const cheerArm = -2.0 * cheer; // raise both arms up
    const sitArm = sitting ? -0.55 : 0; // bring hands forward onto the desk/lap
    if (armLRef.current) armLRef.current.rotation.x = -0.1 + arm + cheerArm + sitArm;
    if (armRRef.current) armRRef.current.rotation.x = -0.1 - arm + cheerArm + sitArm;
    // legs: brisk stride while walking, still when idle, folded forward at the hip when seated so
    // the thighs run forward over the seat and tuck under the desk (the seated "L" silhouette).
    if (sitting) {
      if (legLRef.current) legLRef.current.rotation.x = -1.5;
      if (legRRef.current) legRRef.current.rotation.x = -1.5;
    } else {
      const leg = walking ? Math.sin(t * 6) * 0.5 : 0;
      if (legLRef.current) legLRef.current.rotation.x = -leg;
      if (legRRef.current) legRRef.current.rotation.x = leg;
    }
  });

  return (
    <group ref={root} scale={1.25}>
      {/* legs + rounded feet */}
      <group ref={legLRef} position={[-0.13, 0.3, 0]}>
        <mesh position={[0, -0.13, 0]}><capsuleGeometry args={[0.075, 0.16, 6, 10]} /><meshStandardMaterial color={dark} roughness={0.5} /></mesh>
        <mesh position={[0, -0.26, 0.05]}><sphereGeometry args={[0.11, 14, 12]} /><meshStandardMaterial color={dark} roughness={0.45} /></mesh>
      </group>
      <group ref={legRRef} position={[0.13, 0.3, 0]}>
        <mesh position={[0, -0.13, 0]}><capsuleGeometry args={[0.075, 0.16, 6, 10]} /><meshStandardMaterial color={dark} roughness={0.5} /></mesh>
        <mesh position={[0, -0.26, 0.05]}><sphereGeometry args={[0.11, 14, 12]} /><meshStandardMaterial color={dark} roughness={0.45} /></mesh>
      </group>

      {/* body — rounded shell with a lighter belly panel */}
      <mesh position={[0, 0.6, 0]}><capsuleGeometry args={[0.28, 0.36, 10, 20]} /><meshStandardMaterial color={color} roughness={0.32} metalness={0.05} /></mesh>
      <mesh position={[0, 0.55, 0.2]} scale={[0.7, 0.85, 0.45]}><sphereGeometry args={[0.26, 18, 18]} /><meshStandardMaterial color={belly} roughness={0.4} /></mesh>
      {/* metallic neck ring */}
      <mesh position={[0, 0.92, 0]}><cylinderGeometry args={[0.16, 0.18, 0.07, 18]} /><meshStandardMaterial color={metal} metalness={0.7} roughness={0.3} /></mesh>

      {/* arms with rounded hands */}
      <group ref={armLRef} position={[-0.32, 0.72, 0]}>
        <mesh position={[0, -0.16, 0]}><capsuleGeometry args={[0.085, 0.24, 6, 12]} /><meshStandardMaterial color={color} roughness={0.32} /></mesh>
        <mesh position={[0, -0.32, 0]}><sphereGeometry args={[0.1, 14, 12]} /><meshStandardMaterial color={belly} roughness={0.4} /></mesh>
      </group>
      <group ref={armRRef} position={[0.32, 0.72, 0]}>
        <mesh position={[0, -0.16, 0]}><capsuleGeometry args={[0.085, 0.24, 6, 12]} /><meshStandardMaterial color={color} roughness={0.32} /></mesh>
        <mesh position={[0, -0.32, 0]}><sphereGeometry args={[0.1, 14, 12]} /><meshStandardMaterial color={belly} roughness={0.4} /></mesh>
      </group>

      {/* head */}
      <group ref={headRef} position={[0, 1.2, 0]}>
        <mesh><sphereGeometry args={[0.33, 26, 26]} /><meshStandardMaterial color={color} roughness={0.3} metalness={0.05} /></mesh>
        {/* dark wrap-around visor */}
        <mesh position={[0, 0.04, 0.04]} scale={[1.02, 0.62, 1.02]}><sphereGeometry args={[0.32, 24, 24, 0, Math.PI * 2, Math.PI * 0.18, Math.PI * 0.4]} /><meshStandardMaterial color={dark} roughness={0.25} metalness={0.2} /></mesh>
        {/* glowing eyes */}
        <mesh position={[-0.12, 0.05, 0.3]}><sphereGeometry args={[0.055, 14, 14]} /><meshStandardMaterial color="#ffffff" emissive="#cfeaff" emissiveIntensity={2.2} toneMapped={false} /></mesh>
        <mesh position={[0.12, 0.05, 0.3]}><sphereGeometry args={[0.055, 14, 14]} /><meshStandardMaterial color="#ffffff" emissive="#cfeaff" emissiveIntensity={2.2} toneMapped={false} /></mesh>
        {/* antenna with a lit tip */}
        <group ref={antRef} position={[0, 0.3, 0]}>
          <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.018, 0.018, 0.22, 8]} /><meshStandardMaterial color={metal} metalness={0.6} roughness={0.3} /></mesh>
          <mesh position={[0, 0.24, 0]}><sphereGeometry args={[0.05, 12, 12]} /><meshStandardMaterial color={moodColor ?? "#ff5a5a"} emissive={moodColor ?? "#ff5a5a"} emissiveIntensity={1.4} toneMapped={false} /></mesh>
        </group>
      </group>

      {/* blob shadow — grounds a standing robot; skipped when seated (it would float at seat
          height, and the chair already grounds the figure). */}
      {!sitting && (
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.005, 0.03]}>
          <circleGeometry args={[0.32, 20]} />
          <meshBasicMaterial color="#8090a8" transparent opacity={0.26} depthWrite={false} />
        </mesh>
      )}
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
function OfficeRobot({ colorIdx, seed, moodColor, clip, walking = false, sitting = false }: { colorIdx: number; seed: number; moodColor?: string; clip?: string; walking?: boolean; sitting?: boolean }) {
  const parametric = <RobotCharacter colorIdx={colorIdx} seed={seed} moodColor={moodColor} walking={walking} sitting={sitting} />;
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

// Furniture/fixture keep-out circles (x,z,radius) so roaming robots never walk into the desk,
// vault, gate, kanban, or corner plants. Kept in module scope — shared by every roamer.
const ROAM_OBSTACLES: { x: number; z: number; r: number }[] = [
  { x: -1.3, z: 2.3, r: 1.2 }, // founder desk
  { x: -3.5, z: 1.6, r: 0.95 }, // vault
  { x: 0.8, z: 3.55, r: 1.05 }, // security gate
  { x: 2.5, z: -3.55, r: 1.1 }, // kanban wall
  { x: -3.44, z: -3.44, r: 0.7 }, // corner plant
  { x: 3.44, z: -3.44, r: 0.7 }, // corner plant
];
const ROAM_BOUND = 3.4; // stay on the floor slab

// A robot that gently wanders within `radius` of its home, steering around furniture (simple
// repulsion — the "physics" that keeps it out of the table) and facing its direction of travel.
function RoamingRobot({ colorIdx, seed, home, radius = 1.1 }: { colorIdx: number; seed: number; home: [number, number]; radius?: number }) {
  const grp = useRef<THREE.Group>(null);
  const s = useRef({ x: home[0], z: home[1], tx: home[0], tz: home[1], next: 0, face: 0 });
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime + seed;
    const cur = s.current;
    if (t > cur.next) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      cur.tx = home[0] + Math.cos(a) * r;
      cur.tz = home[1] + Math.sin(a) * r;
      cur.next = t + 2.5 + Math.random() * 3.5;
    }
    const dx = cur.tx - cur.x;
    const dz = cur.tz - cur.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.03) {
      const step = Math.min(d, 0.55 * dt);
      cur.x += (dx / d) * step;
      cur.z += (dz / d) * step;
      cur.face = Math.atan2(dx, dz);
    }
    // repel out of furniture footprints
    for (const o of ROAM_OBSTACLES) {
      const ox = cur.x - o.x;
      const oz = cur.z - o.z;
      const od = Math.hypot(ox, oz);
      if (od < o.r && od > 1e-3) {
        cur.x += (ox / od) * (o.r - od);
        cur.z += (oz / od) * (o.r - od);
      }
    }
    cur.x = Math.max(-ROAM_BOUND, Math.min(ROAM_BOUND, cur.x));
    cur.z = Math.max(-ROAM_BOUND, Math.min(ROAM_BOUND, cur.z));
    if (grp.current) {
      grp.current.position.set(cur.x, 0, cur.z);
      grp.current.rotation.y += ((cur.face - grp.current.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 6);
    }
  });
  return (
    <group ref={grp}>
      <OfficeRobot colorIdx={colorIdx} seed={seed} clip="Walking" walking />
    </group>
  );
}

// A desk hard against a wall has no room behind it for the chair — the seated robot would sink
// into the wall (and an empty chair poke through it). When the seat spot lands inside the walls,
// flip the seat to the desk's FRONT instead: the figure works facing the wall, exactly like a
// wall-facing desk in a real office. Checked in world space so every rotation is covered.
const SEAT_BACK = 0.86; // chair (0.78) + seated-robot pullback (0.08) behind the desk origin
const SEAT_LIMIT = 3.8; // beyond this the chair/robot visibly enters the walls (scaled by facility)
// Employees sit on the desk's BACK edge facing +z — toward the camera — so the office reads as a row
// of faces and glowing screens (the standard iso-diorama look). Only when that seat would clip a wall
// (a desk pushed right against the wall it BACKS ONTO) do we flip them to the front, facing the room.
function seatFlipped(item: PlacedItem, facilityTier = 1): boolean {
  const w = worldOf(item, facilityTier);
  const limit = SEAT_LIMIT * roomScaleFor(facilityTier); // walls scale out with the facility
  // The chair sits SEAT_BACK behind the desk ALONG ITS FACING AXIS, and a flip moves it to the front
  // along that SAME axis. So only the wall the seat actually backs onto can be escaped by flipping —
  // the cross-axis position is fixed by the desk and no flip can change it. The old check tested BOTH
  // axes (|cx| OR |cz|), so a desk merely sitting near a SIDE wall got needlessly flipped, parking its
  // chair on the wrong side of the table. Test only the along-axis coordinate, in the seat's direction.
  const backX = w.x - Math.sin(w.rotY) * SEAT_BACK;
  const backZ = w.z - Math.cos(w.rotY) * SEAT_BACK;
  return Math.abs(Math.cos(w.rotY)) > 0.5
    ? (Math.cos(w.rotY) > 0 ? backZ < -limit : backZ > limit) // desk faces ±z → seat moves along z
    : (Math.sin(w.rotY) > 0 ? backX < -limit : backX > limit); // desk faces ±x → seat moves along x
}

// A workstation = the player's placed desk model (which carries its own monitor) + the employee's
// robot, rendered at the local origin facing +z. Callers position/rotate it (via the SAME worldOf
// transform the Decorate editor uses), so an occupied desk is identical in the office and the editor.
// Each hired employee gets exactly one.
// Per-worker desk clutter — a small seed-varied prop (papers / a desk plant / books, or a tidy desk)
// so a row of occupied desks reads as lived-in and individual, not identical. Cosmetic; sits on the
// right of the desktop, clear of the monitor + keyboard.
function DeskClutter({ seed, p }: { seed: number; p: RoomPalette }) {
  // A sin-hash decorrelates adjacent desks (seed = i * 2.1); a plain floor/mod produced long runs
  // of the same clutter type, the opposite of the lived-in variety we want.
  const h = Math.sin(seed * 78.233) * 43758.5453;
  const k = Math.floor((h - Math.floor(h)) * 4);
  if (k === 3) return null; // some folks keep a clean desk
  return (
    <group position={[0.44, 0.785, 0.08]}>
      {k === 0 && (
        <>
          <mesh position={[0, 0.012, 0]} rotation-y={0.22}><boxGeometry args={[0.16, 0.02, 0.2]} /><meshStandardMaterial color="#e8e6df" roughness={0.9} /></mesh>
          <mesh position={[0.02, 0.032, 0.01]} rotation-y={-0.16}><boxGeometry args={[0.16, 0.02, 0.2]} /><meshStandardMaterial color="#f3f1ea" roughness={0.9} /></mesh>
        </>
      )}
      {k === 1 && (
        <>
          <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.052, 0.046, 0.1, 10]} /><meshStandardMaterial color="#8a6b4a" roughness={0.8} /></mesh>
          <mesh position={[0, 0.14, 0]}><sphereGeometry args={[0.08, 10, 10]} /><meshStandardMaterial color={p.plant} roughness={0.85} /></mesh>
        </>
      )}
      {k === 2 && (
        <>
          <mesh position={[0, 0.03, 0]}><boxGeometry args={[0.1, 0.06, 0.16]} /><meshStandardMaterial color="#3b6ea5" roughness={0.7} /></mesh>
          <mesh position={[0.005, 0.085, 0.01]}><boxGeometry args={[0.1, 0.05, 0.15]} /><meshStandardMaterial color="#b4694a" roughness={0.7} /></mesh>
        </>
      )}
    </group>
  );
}

function Workstation({ p, staff, seed, colorIdx, deskType = "desk", flip = false }: { p: RoomPalette; staff?: Staff; seed: number; monitors: number; colorIdx: number; powered?: boolean; deskType?: FurnitureId; flip?: boolean }) {
  const hue = ROBOT_COLORS[colorIdx % ROBOT_COLORS.length];
  const moodColor = staff ? MOOD_HEX[moodBand(staff.mood ?? 60)] : undefined;
  return (
    <group>
      {/* The player's ACTUAL placed desk model (each desk model carries its own monitor). The desk
          model seats its user on the +z side (screen faces +z, keyboard at the front), so we rotate
          it to FACE the seated employee: when they sit on the back edge (facing the camera) the desk
          turns 180° so the monitor faces them and the keyboard is nearest them — a correctly-oriented
          workstation, not one facing backwards. Matches whichever side the employee occupies. */}
      <group rotation-y={flip ? 0 : Math.PI}>
        <FurniturePiece type={deskType} p={p} />
        {/* lived-in touch: a small, per-worker prop on an occupied plain desk (fancier desks carry
            their own detailing, so clutter is scoped to the common "desk" to avoid overlaps). */}
        {staff && deskType === "desk" && <DeskClutter seed={seed} p={p} />}
      </group>
      {/* chair + robot SEATED on it: the figure is lifted onto the seat (≈0.58 high) and pulled
          back so it rests against the backrest, facing the desk (+z, toward the camera). The
          parametric robot folds into a sitting pose; a rigged .glb plays its "Sitting" clip instead. */}
      <group position={[0, 0, flip ? 0.78 : -0.78]} rotation-y={flip ? Math.PI : 0}>
        <Chair p={p} hue={hue} />
        {staff && (
          <group position={[0, 0, -0.08]}>
            <OfficeRobot colorIdx={colorIdx} seed={seed} moodColor={moodColor} clip="Sitting" sitting />
          </group>
        )}
      </group>
    </group>
  );
}

// The player-bought desks: 1–4 standalone computer desks laid out in a single centred row so the
// set always reads symmetric (auto-centres for any count). Oriented like the founder's desk — the
// seated robot faces the camera — so a hired employee sits here exactly as the first one does. The
// row sits in the open back-centre, a clear gap behind the founder's desk (and well clear of the
// front lounge), so a full team reads as founder-in-front + a tidy desk bank behind, never a pile-up.
// Empty (unstaffed) desks still render powered-on, so the office looks set up before it's filled.
const DESKTOP_ROW_Z = -2.2;
const DESKTOP_SPACING = 1.95;
// Height for the floating hint pill + the team's celebration emotes — clearly above the robots' heads.
const LABEL_Y = 2.85;
// The Bank pill's fixed world position.
const BANK_LABEL_POS: [number, number, number] = [-2.7, 2.75, 1.6];
function desktopWorlds(count: number): { x: number; z: number; rotY: number }[] {
  const n = Math.max(0, Math.min(4, count));
  return Array.from({ length: n }, (_, i) => ({ x: (i - (n - 1) / 2) * DESKTOP_SPACING, z: DESKTOP_ROW_Z, rotY: 0 }));
}
function DesktopPod({ p, worlds, staff, monitors, onTapStaff, startColorIdx }: { p: RoomPalette; worlds: { x: number; z: number; rotY: number }[]; staff: Staff[]; monitors: number; onTapStaff?: (id: string) => void; startColorIdx: number }) {
  return (
    <group>
      {worlds.map((w, i) => {
        const s = staff[i];
        return (
          <group key={i} position={[w.x, 0, w.z]} rotation-y={w.rotY}>
            <Workstation p={p} staff={s} seed={(startColorIdx + i) * 2.1} monitors={monitors} colorIdx={(startColorIdx + i) % ROBOT_COLORS.length} powered />
            {/* invisible tap target → opens this employee's roster card (matches the placed desks) */}
            {onTapStaff && s?.id && (
              <mesh
                position={[0, 0.95, 0]}
                onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onTapStaff(s.id!); }}
              >
                <boxGeometry args={[1.3, 1.9, 1.3]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            )}
          </group>
        );
      })}
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
// Scene-constant colours (like RoomPalette's intrinsic object colours): the pill must stay
// dark-on-white over the 3D room in BOTH app themes, so it can't ride the theme ink tokens.
const LABEL_BG = "rgba(255,255,255,0.94)";
const LABEL_INK = "#1a1d23";
const LABEL_INK_SOFT = "#6b7280";
// Team reaction emotes that pop over a worker's head — a burst on a win, a sigh on a flop. Premium,
// Lucide-only (the app forbids emoji): a small white chip with a tinted glyph, matching the OfficeLabel
// pill aesthetic. Colours are scene-constant (like the label pill) so they read in both app themes.
const CHEER_ICONS = [PartyPopper, Sparkles, Star, ThumbsUp, Rocket];
const SLUMP_ICONS = [Frown, CloudRain, BatteryLow, Meh, ThumbsDown];
const CHEER_TINT = "#34c759"; // positive green (matches the Bank dot)
const SLUMP_TINT = "#64748b"; // muted slate — a quiet sigh, never alarming
function CheerEmote({ pos, Icon, tone, delay = 0 }: { pos: [number, number, number]; Icon: typeof PartyPopper; tone: "cheer" | "slump"; delay?: number }) {
  return (
    <Html position={pos} center zIndexRange={[30, 0]} style={{ pointerEvents: "none", userSelect: "none" }}>
      <div style={{
        display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 999,
        background: LABEL_BG, color: tone === "cheer" ? CHEER_TINT : SLUMP_TINT,
        boxShadow: "0 2px 8px rgba(40,60,90,0.28)",
        transform: "translateY(-150%)",   // base spot (used when reduced-motion neutralizes the pop)
        animation: `hq-emote-pop 2s ${delay}ms ease-out both`,
      }}>
        <Icon size={17} strokeWidth={2.5} aria-hidden />
      </div>
    </Html>
  );
}

function OfficeLabel({ pos, label, sub, dot }: { pos: [number, number, number]; label: string; sub: string; dot: string }) {
  // Fixed screen-size UI chip (no distanceFactor → constant size), always rendered on top. Kept to
  // ONE compact line — dot · Name · role — so a full team of pills stays narrow and short, laddering
  // cleanly instead of piling into tall two-line badges that clip the card and each other.
  return (
    <Html position={pos} center zIndexRange={[20, 0]} style={{ pointerEvents: "none", userSelect: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", background: LABEL_BG, borderRadius: 999, boxShadow: "0 1px 6px rgba(40,60,90,0.18)", whiteSpace: "nowrap", backdropFilter: "blur(4px)", transform: "translateY(-140%)", fontFamily: "system-ui,-apple-system,sans-serif" }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />
        <span style={{ fontSize: "var(--fs-micro)", fontWeight: 700, color: LABEL_INK, lineHeight: 1.2 }}>{label}</span>
        <span style={{ fontSize: "var(--fs-nano)", fontWeight: 600, color: LABEL_INK_SOFT, lineHeight: 1.2 }}>{sub}</span>
      </div>
    </Html>
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

function Props({ p, hasProduction, back = 0, dark = true }: { p: RoomPalette; hasProduction: boolean; back?: number; dark?: boolean }) {
  return (
    <group>
      {/* garage clutter (boxes + tool chest) — dark/garage mode only; the clean diorama stays tidy */}
      {dark && (
        <>
          <RoundedBox args={[0.9, 0.9, 0.9]} radius={0.04} smoothness={2} position={[-3.2, 0.45, -3.0 - back]}>
            <meshStandardMaterial color={p.box} roughness={0.85} />
          </RoundedBox>
          <RoundedBox args={[0.7, 0.7, 0.7]} radius={0.04} smoothness={2} position={[-3.2, 1.25, -3.0 - back]}>
            <meshStandardMaterial color={p.box} roughness={0.85} />
          </RoundedBox>
          <RoundedBox args={[1.0, 1.3, 0.9]} radius={0.05} smoothness={3} position={[3.1, 0.65, -3.0 - back]}>
            <meshStandardMaterial color={p.chest} roughness={0.5} metalness={0.1} />
          </RoundedBox>
        </>
      )}
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
      {/* pendant lamp hangs from the ceiling — only in the enclosed garage (dark), not the open diorama */}
      {dark && <PendantLamp p={p} />}
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

// Turns on cast/receive shadows for every mesh in the scene so the key light grounds objects
// with soft contact shadows (the floor slab receives them). Re-runs on a short delay to catch
// lazily-mounted pieces. Cheap one-shot traversal.
function EnableShadows() {
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
function BuildLayer({ p, b, hideIids, facilityTier = 1 }: { p: RoomPalette; b: BuildProps; hideIids?: ReadonlySet<string>; facilityTier?: number }) {
  const [dragIid, setDragIid] = useState<string | null>(null);
  const [dragCell, setDragCell] = useState<{ c: number; r: number } | null>(null);
  const [hover, setHover] = useState<{ c: number; r: number } | null>(null);
  const n = gridN(facilityTier);
  const origin = gridOrigin(facilityTier);
  const size = n * GRID.cell;
  const placeDef = b.placingType ? furnitureDef(b.placingType) : null;
  const placeFp = placeDef ? footprint(placeDef, b.placeRot) : null;

  const dragItem = dragIid ? b.layout.find((x) => x.iid === dragIid) ?? null : null;
  const dragFp = dragItem ? footprint(furnitureDef(dragItem.type), dragItem.rot) : null;

  // Commit the drop wherever the pointer is released (even off the grid → snaps back).
  const live = useRef<{ iid: string | null; cell: { c: number; r: number } | null; ok: boolean; move: BuildProps["onMoveItem"] }>({ iid: null, cell: null, ok: false, move: b.onMoveItem });
  useEffect(() => {
    const up = () => {
      const { iid, cell, ok, move } = live.current;
      if (iid) {
        // Hard gate: only drop onto a VALID cell. A blocked target (red ghost) snaps the piece home
        // instead of firing a no-op reducer call — so decor can never land under/over another piece.
        if (cell && ok) move(iid, cell.c, cell.r);
        setDragIid(null);
        setDragCell(null);
      }
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const placeOk = hover && b.placingType ? canPlace(b.layout, b.placingType, hover.c, hover.r, b.placeRot, undefined, facilityTier) : false;
  const dragOk = dragCell && dragItem ? canPlace(b.layout, dragItem.type, dragCell.c, dragCell.r, dragItem.rot, dragItem.iid, facilityTier) : false;
  // Feed the live drag target + validity to the window pointer-up handler (which fires outside React's
  // event system), so a blocked drop snaps home instead of committing.
  live.current = { iid: dragIid, cell: dragCell, ok: dragOk, move: b.onMoveItem };

  return (
    <group>
      {/* placed furniture (the dragged one follows the cursor, lifted slightly) */}
      {b.layout.map((it) => {
        if (hideIids?.has(it.iid)) return null; // occupied desk → live workstation renders instead
        const isDrag = it.iid === dragIid;
        const cell = isDrag && dragCell ? dragCell : { c: it.c, r: it.r };
        const { x, z, rotY } = worldOf({ ...it, c: cell.c, r: cell.r }, facilityTier);
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
            {/* A desk always reads as a workstation: render its chair at the same offset the seated
                Workstation uses, so an EMPTY desk shows a chair too (occupied desks are swapped for
                the live Workstation, which provides its own chair + robot, so no double-up). */}
            {isDeskType(it.type) && (() => {
              // Use the live (drag-adjusted) cell so the chair previews on the correct side while
              // the desk is being dragged toward a wall, not only after it drops.
              const flip = seatFlipped({ ...it, c: cell.c, r: cell.r }, facilityTier);
              return (
                <group position={[0, 0, flip ? 0.78 : -0.78]} rotation-y={flip ? Math.PI : 0}>
                  <Chair p={p} hue={p.metalDark} />
                </group>
              );
            })()}
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
          <gridHelper args={[size, n, "#7fa8ff", "#465065"]} position={[0, 0.02, 0]} />
          {/* invisible floor — drives drag tracking, placement + deselect */}
          <mesh
            rotation-x={-Math.PI / 2}
            position={[0, 0.015, 0]}
            onPointerMove={(e: ThreeEvent<PointerEvent>) => {
              if (dragIid && dragFp) {
                const c = cellAt(e.point.x, e.point.z, dragFp.w, dragFp.d, facilityTier);
                setDragCell((p) => (p && p.c === c.c && p.r === c.r ? p : c)); // skip redundant re-renders
              } else if (b.placingType && placeFp) {
                const c = cellAt(e.point.x, e.point.z, placeFp.w, placeFp.d, facilityTier);
                setHover((p) => (p && p.c === c.c && p.r === c.r ? p : c));
              }
            }}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              if (b.placingType && placeFp) {
                const c = cellAt(e.point.x, e.point.z, placeFp.w, placeFp.d, facilityTier);
                // Hard gate: place only where it actually fits (green ghost). Tapping a blocked cell
                // does nothing instead of relying on a silent reducer no-op — cleaner, "smarter" feel.
                if (canPlace(b.layout, b.placingType, c.c, c.r, b.placeRot, undefined, facilityTier)) b.onPlaceCell(c.c, c.r);
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
            <mesh position={[origin + (hover.c + placeFp.w / 2) * GRID.cell, 0.07, origin + (hover.r + placeFp.d / 2) * GRID.cell]}>
              <boxGeometry args={[placeFp.w * GRID.cell - 0.06, 0.12, placeFp.d * GRID.cell - 0.06]} />
              <meshBasicMaterial color={placeOk ? "#1eb877" : "#ef4444"} transparent opacity={0.42} depthWrite={false} />
            </mesh>
          )}
          {/* ghost target while dragging */}
          {dragIid && dragFp && dragCell && (
            <mesh position={[origin + (dragCell.c + dragFp.w / 2) * GRID.cell, 0.045, origin + (dragCell.r + dragFp.d / 2) * GRID.cell]}>
              <boxGeometry args={[dragFp.w * GRID.cell - 0.05, 0.06, dragFp.d * GRID.cell - 0.05]} />
              <meshBasicMaterial color={dragOk ? "#1eb877" : "#ef4444"} transparent opacity={0.4} depthWrite={false} />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}

function Scene({ staff, facilityTier, hasProduction, upgrades, companyName, dark, builder, roomStyle, desktops = 0, onTapStaff, onTapBank }: { staff: Staff[]; facilityTier: number; hasProduction: boolean; upgrades: Upgrades; companyName: string; dark: boolean; builder?: BuildProps; roomStyle: { floor: number; wall: number }; desktops?: number; onTapStaff?: (id: string) => void; onTapBank?: () => void }) {
  const p = useMemo(() => roomPalette(dark), [dark]);
  const monitors = tierOf(upgrades, "computers") >= 2 ? 2 : 1;
  const amenityTier = tierOf(upgrades, "amenities");
  const finish = floorFinish(roomStyle.floor);
  const wall = wallStyle(roomStyle.wall);
  const cull = useWallCull();
  // Desks ARE the seats: each employee works at a desk (placed furniture desks first, then the
  // player-bought desktops), so a new hire's robot sits at a real desk instead of milling around.
  // Only when every desk is taken do extra employees roam the floor.
  const inBuild = !!builder?.build;
  // Team reaction emotes: a win (cheer) or a flop (slump) pops emotes over the workers for the
  // reaction window (the robots' hop/droop is driven separately in useFrame). React state so the
  // emote layer mounts/unmounts; the timer matches the animation so they end together.
  const [reaction, setReaction] = useState<HqReaction | null>(null);
  const reactTimer = useRef(0);
  useEffect(() => onHqReaction((k) => {
    setReaction(k);
    window.clearTimeout(reactTimer.current);
    reactTimer.current = window.setTimeout(() => setReaction(null), HQ_REACTION_MS);
  }), []);
  useEffect(() => () => window.clearTimeout(reactTimer.current), []);
  const seats = deskItems(builder?.layout ?? []);
  const seated = staff.slice(0, seats.length);
  const overflow = staff.slice(seats.length);
  const podCount = Math.max(0, Math.min(4, desktops));
  const podWorlds = desktopWorlds(podCount);
  const podStaff = overflow.slice(0, podCount);
  const roaming = overflow.slice(podCount, 16);
  // Occupied desks render as full live workstations, so hide their plain furniture models
  // (cozy view only — in Decorate mode the editable furniture pieces must stay visible).
  const occupiedIids = new Set(seated.map((_, i) => seats[i].iid));
  // Facility footprint: the room shell + its wall-anchored fixtures render inside a group scaled by
  // `sc`, so a bigger building (Studio/Campus) grows the walls, floor and props together, while the
  // furniture grid below fills the larger CENTRED grid at real desk size (tier-aware worldOf).
  const roomK = roomScaleFor(facilityTier);
  const sc: [number, number, number] = [roomK, 1, roomK];
  return (
    <>
      <VisibilityPause />
      {!dark && <EnableShadows />}
      <CameraRig build={!!builder?.build} facilityTier={facilityTier} />
      <PinchZoom />
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
      <pointLight position={[0, 3.4, 0]} intensity={dark ? 14 : 4} distance={12} decay={2} color={p.lamp} />
      <pointLight position={[0, 1.3, 0.5]} intensity={dark ? 3 : 1.2} distance={7} decay={2} color={p.screen} />

      {/* Whiteboard is earned: it appears once the team has real Workstations (computers ≥ 1),
          so a fresh garage starts bare and upgrading visibly adds the planning board. The room shell
          scales with the facility so Studio/Campus give a visibly bigger floor to fill. */}
      <group scale={sc}>
        <Room p={p} dark={dark} finish={finish} wall={wall} cull={cull} showWhiteboard={tierOf(upgrades, "computers") >= 1} />
      </group>
      {/* distant skyline behind the windows — garage (dark) only; the light diorama floats in
          a clean white void, so no exterior scenery. */}
      {dark && (
        <group>
          {/* outside wall B (−x), seen through the side window */}
          {[[-1.8, 2.6], [-0.9, 4.0], [0.0, 2.0], [0.9, 3.2]].map((b, i) => (
            <mesh key={`bx${i}`} position={[-5.3, b[1] / 2, b[0]]}>
              <boxGeometry args={[0.7, b[1], 0.9]} />
              <meshStandardMaterial color="#2a3550" roughness={0.9} />
            </mesh>
          ))}
          {/* outside wall A (−z), seen through the door windows */}
          {[[-1.6, 3.0], [0.2, 4.4], [1.8, 2.4], [3.0, 3.6]].map((b, i) => (
            <mesh key={`bz${i}`} position={[b[0], b[1] / 2, -5.3]}>
              <boxGeometry args={[0.9, b[1], 0.7]} />
              <meshStandardMaterial color="#2a3550" roughness={0.9} />
            </mesh>
          ))}
        </group>
      )}
      {/* rug under the pod — scales with the room so it stays proportional to the floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0.3 * roomK]} scale={[roomK, roomK, 1]}>
        <circleGeometry args={[3.2, 40]} />
        <meshStandardMaterial color={p.screen} transparent opacity={facilityTier > 1 ? 0.1 : 0.05} roughness={1} />
      </mesh>

      {/* The team — each employee's full workstation (desk + computer + robot) renders AT the
          placed desk they occupy, so buying a desk and hiring puts the new robot exactly where
          the player put the furniture. Hidden in Decorate mode (the editable desk pieces show
          instead); employees beyond the desk count roam the floor. */}
      {!inBuild && seated.map((s, i) => {
        const w = worldOf(seats[i], facilityTier);
        return (
          <group key={s.id ?? i} position={[w.x, 0, w.z]} rotation-y={w.rotY}>
            <Workstation p={p} staff={s} seed={i * 2.1} monitors={monitors} colorIdx={i % ROBOT_COLORS.length} deskType={seats[i].type} flip={seatFlipped(seats[i], facilityTier)} />
            {/* invisible tap target over the desk+robot → opens this person's roster card. A
                transparent (not visible:false) mesh so the raycaster still hits it. */}
            {onTapStaff && s.id && (
              <mesh
                position={[0, 0.95, 0]}
                onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onTapStaff(s.id!); }}
              >
                <boxGeometry args={[1.3, 1.9, 1.3]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            )}
          </group>
        );
      })}
      {!inBuild && roaming.map((s, i) => (
        <RoamingRobot key={s.id ?? `roam${i}`} colorIdx={(seats.length + podCount + i) % ROBOT_COLORS.length} seed={(seats.length + podCount + i) * 3.7} home={roamHomeFor(i)} />
      ))}
      {/* Player-bought desktops — a tidy symmetric row that overflow employees sit at (so new
          hires get a desk like the founder). Hidden in Decorate mode like the live workstations. */}
      {!inBuild && <DesktopPod p={p} worlds={podWorlds} staff={podStaff} monitors={monitors} onTapStaff={onTapStaff} startColorIdx={seats.length} />}
      {/* wall-anchored fixtures scale with the room so they stay in the corners as the floor grows */}
      <group scale={sc}>
        <Props p={p} hasProduction={hasProduction} dark={dark} />
        <Dust />
        {dark && <BallBin p={p} pos={[3.1, 1.31, -3.0]} />}
      </group>

      {/* player-arranged furniture + the drag-to-move builder. Occupied desks are rendered as
          live workstations above, so their plain models are suppressed outside Decorate mode. */}
      {builder && <BuildLayer p={p} b={builder} hideIids={inBuild ? undefined : occupiedIids} facilityTier={facilityTier} />}

      {/* ---- Upgrades made physical: each company upgrade adds real furniture. Wall-anchored, so
             they scale with the room to stay against the walls as the facility grows. ---- */}
      <group scale={sc}>
      {/* Marketing Suite → a branded wall screen */}
      {tierOf(upgrades, "marketing") >= 1 && (
        <Pulse feature="marketing">
          <group visible={!cull.b}>
            <WallTV name={companyName} tier={tierOf(upgrades, "marketing")} accent="#3b82f6" />
          </group>
        </Pulse>
      )}
      {/* Amenities → a coffee station + greenery that grows with the tier */}
      {amenityTier >= 1 && (
        <Pulse feature="amenities">
          <CoffeeStation p={p} />
          {amenityTier >= 2 && <Plant p={p} pos={[-3.3, 0, 3.1]} scale={0.85} />}
          {amenityTier >= 3 && <Plant p={p} pos={[3.4, 0, 1.4]} scale={0.75} />}
          {amenityTier >= 4 && <Plant p={p} pos={[3.5, 0, 0.0]} scale={0.7} />}
        </Pulse>
      )}
      {/* Design Suite → a drafting easel */}
      {tierOf(upgrades, "designSuite") >= 1 && <Pulse feature="designSuite"><DesignEasel p={p} /></Pulse>}
      {/* Test Lab → a glass test chamber */}
      {tierOf(upgrades, "testLab") >= 1 && <Pulse feature="testLab"><TestChamber p={p} /></Pulse>}

      {/* The Vault is the company BANK — your money lives here; tapping it opens the finances
          popup. Kept from the start; the Kanban wall + security gate were starter clutter and
          were removed so a fresh garage reads as a real, empty garage. */}
      <group onClick={onTapBank && !inBuild ? (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onTapBank(); } : undefined}>
        <Vault />
      </group>
      </group>

      {/* The office keeps ONE floating hint — the interactive Bank pill (your money; tap for
          finances). The old per-employee name pills were removed: a full team piled 7+ overlapping
          white bubbles over the scene. The robots are directly tappable (→ the Company team roster,
          which already lists every name, role and skill), so the labels were pure clutter. */}
      {!builder?.build && (
        <>
          <OfficeLabel pos={[BANK_LABEL_POS[0] * roomK, BANK_LABEL_POS[1], BANK_LABEL_POS[2] * roomK]} label="Bank" sub="Tap for finances" dot="#34c759" />
          {/* Team reaction — an emote pops right over every worker's head: a burst on a win, a sigh on a flop. */}
          {reaction && [
            ...seated.map((s, i) => ({ w: worldOf(seats[i], facilityTier), key: s.id ?? `react-seat${i}`, i })),
            ...podStaff.map((s, i) => ({ w: podWorlds[i], key: s.id ?? `react-pod${i}`, i: seats.length + i })),
          ].map((e) => {
            const set = reaction === "slump" ? SLUMP_ICONS : CHEER_ICONS;
            // Stagger the pops so the reaction ripples across the team, not all at once — capped so
            // even the last emote's 2s pop still finishes inside the ~2.6s reaction window.
            return <CheerEmote key={e.key} pos={[e.w.x, LABEL_Y, e.w.z]} Icon={set[e.i % set.length]} tone={reaction === "slump" ? "slump" : "cheer"} delay={Math.min(e.i * 70, 520)} />;
          })}
        </>
      )}

      {/* Bake the shadow pass once (frames={1}) — the scene is mostly static, so re-rendering the
          depth pass every frame is wasted GPU. The key re-bakes on anything that moves geometry:
          item count alone missed moves/rotations (a dragged sofa kept its shadow at the old spot),
          plus desks (staff) and upgrade fixtures. */}
      <ContactShadows
        key={`${(builder?.layout ?? []).map((it) => `${it.iid}${it.c},${it.r},${it.rot}`).join("|")}·${staff.length}·${Object.values(upgrades).join("")}`}
        position={[0, 0.02, 0]} scale={16 * roomK} blur={3.0} far={6} opacity={dark ? 0.5 : 0.45} color={p.shadow} resolution={1024} frames={1} />
    </>
  );
}

// memo: the host (HQ) re-renders on every sim tick; with the narrowed staff snapshot + memoized
// builder it passes, this skips re-reconciling the whole R3F tree (incl. drei <Html> labels)
// when nothing visible changed — the v9-flagged "biggest perf win", narrow version.
export const Garage3D = memo(function Garage3D({
  staff = [],
  facilityTier,
  hasProduction,
  upgrades = {},
  companyName = "Silicon",
  height = 250,
  dark,
  builder,
  roomStyle = { floor: 0, wall: 0 },
  desktops = 0,
  paused = false,
  onContextLost,
  onTapStaff,
  onTapBank,
}: {
  staff?: Staff[];
  staffCount: number;
  facilityTier: number;
  hasProduction: boolean;
  upgrades?: Upgrades;
  companyName?: string;
  height?: number | string;
  dark: boolean;
  builder?: BuildProps;
  roomStyle?: { floor: number; wall: number };
  /** How many player-bought desktops to show in the garage (0–4). */
  desktops?: number;
  /** Pause the render loop while the office is off-screen (e.g. another tab is active). The
   *  WebGL context stays alive — only frames stop — so returning to HQ never re-creates the
   *  context (that churn is what made the 3D office fail on memory-constrained mobile browsers). */
  paused?: boolean;
  /** Called when the WebGL context is lost so the host can downgrade to the 2D fallback. */
  onContextLost?: () => void;
  /** Tap an employee → open their roster card (host navigates to Company). */
  onTapStaff?: (id: string) => void;
  /** Tap the office Bank/vault → open the finances popup. */
  onTapBank?: () => void;
}) {
  return (
    <div style={{ height, width: "100%" }}>
      <Canvas
        role="img"
        aria-label="Company office, 3D view"
        frameloop={paused ? "never" : "always"}
        dpr={[1, 1.75]}
        shadows={dark ? false : { type: THREE.VSMShadowMap }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [15.5, 13.0, 17.5], fov: 25 }}
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
        <Scene staff={staff} facilityTier={facilityTier} hasProduction={hasProduction} upgrades={upgrades} companyName={companyName} dark={dark} builder={builder} roomStyle={roomStyle} desktops={desktops} onTapStaff={onTapStaff} onTapBank={onTapBank} />
      </Canvas>
    </div>
  );
});
