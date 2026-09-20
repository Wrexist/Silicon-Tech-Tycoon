// Procedural real-time 3D HQ (react-three-fiber). Zero image assets — everything is built
// from primitives + materials + real lights. Scoped to the garage only; devices stay SVG.
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  planSeats,
  worldOf,
  type FurnitureId,
  type PlacedItem,
  type Rot,
} from "../engine/furniture.ts";
import { FurniturePiece, Monitor } from "./furniture3d.tsx";
import { sharedBox, sharedCylinder, sharedRounded, sharedSphere, sharedStandard } from "./sharedGpu.ts";
import { CATALOG, roomPalette, type RoomPalette } from "./palette.ts";
import { ROBOT_COLORS } from "./robotModels.ts";
import { reactionIntensity, onHqReaction, HQ_REACTION_MS, type HqReaction } from "../design/hqReaction.ts";
import { highlightIntensity } from "../design/hqHighlight.ts";
import { officeDestinations, ROAM_BOUND, scaledObstacles, type Destination, type RoamAgent } from "./employeeController.ts";
import { OfficeRobot, RoamingRobot } from "./robotCharacter.tsx";
import SpeechBubbles, { type Speaker } from "./speechBubbles.tsx";
import { CameraRig, PinchZoom, CAM_REST_POSITION } from "./cameraRig.tsx";
import { Lighting, EnableShadows } from "./lighting.tsx";
import { Room, useWallCull, CHEER_GREEN, Props, Plant, BallBin } from "./room.tsx";
import { useHqInteractions } from "./interactions.ts";
import { TargetPrompt } from "./interactionPrompt.tsx";
import { officeConfigFor } from "./officeConfig.ts";
import { workstationModuleFor, type WorkstationProp } from "./workstationModule.ts";
import { officeSeed } from "./officeLive.ts";
import { derivedYawFor } from "./officeArrangement.ts";
import { OfficeDressing } from "./officeDressing.tsx";
import { skylinePlacement, SKYLINE_COLOR } from "./skyline.ts";

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

export interface BuildProps {
  build: boolean;
  layout: PlacedItem[];
  placingType: FurnitureId | null;
  placeRot: Rot;
  selectedIid: string | null;
  /** iids of the desks + amenities currently EARNING the office zone bonus (engine `deskZones`), so
   *  the builder can show the pairing instead of leaving it to be inferred from a moving buff bar.
   *  Absent/empty = no highlight (and the bonus is 0 anyway). */
  zonedIids?: ReadonlySet<string>;
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

/** A proper task chair, in the Herman Miller idiom: a slim raked back inside a polished frame, a
 *  contoured seat floating on a thin plate, cantilevered armpads, a gas lift and a five-star base.
 *
 *  The old chair was a pair of thick slabs with no base at all — it hovered, and the deep winged
 *  backrest existed only to hide the seated robot's shell from behind. Two hard constraints kept
 *  from that version, because the robot is positioned against them:
 *    • the seat surface stays at y≈0.58 (SIT_LIFT is measured from it),
 *    • the back's REAR face stays behind the robot's torso (~z −0.43) so nothing pokes through it.
 *  The frame is deep enough to swallow the torso while looking half the thickness it used to.
 *
 *  The five-star base is one 5-sided cylinder rather than five modelled spokes — at this camera the
 *  pentagon's corners read as the spokes, for a fifth of the draw calls. `hue` (the occupant's
 *  colour) moves to the armpads, so a row of chairs still reads as individual people's seats. */
function Chair({ p, hue }: { p: RoomPalette; hue: string }) {
  const frame = p.metal;      // polished aluminium — frame, lift and base
  const fabric = p.metalDark; // graphite mesh/fabric — seat pad and back panel
  // Shared GPU objects: a full desk bank is up to ~16 of these; every geometry + the three frame/
  // fabric materials are identical across chairs (only the arm-pad hue varies), so they all come
  // from the sharedGpu caches. Rounded boxes via sharedRounded (same args as <RoundedBox>).
  const mFrameA = sharedStandard({ color: frame, metalness: 0.62, roughness: 0.32 });
  const mLift = sharedStandard({ color: frame, metalness: 0.68, roughness: 0.26 });
  const mFrameB = sharedStandard({ color: frame, metalness: 0.6, roughness: 0.3 });
  const mFrameBack = sharedStandard({ color: frame, metalness: 0.58, roughness: 0.3 });
  const mFabricSeat = sharedStandard({ color: fabric, roughness: 0.88, metalness: 0.04 });
  const mFabricBack = sharedStandard({ color: fabric, roughness: 0.9, metalness: 0.03 });
  const mPad = sharedStandard({ color: hue, roughness: 0.75, metalness: 0.05 });
  return (
    <group>
      {/* five-star base + gas lift */}
      <mesh position={[0, 0.045, 0]} geometry={sharedCylinder(0.13, 0.4, 0.05, 5)} material={mFrameA} />
      <mesh position={[0, 0.26, 0]} geometry={sharedCylinder(0.048, 0.06, 0.4, 12)} material={mLift} />

      {/* seat: one contoured pad, top surface held at 0.58 (SIT_LIFT is measured from it) */}
      <mesh position={[0, 0.5225, -0.02]} geometry={sharedRounded(0.62, 0.115, 0.58, 4, 0.05)} material={mFabricSeat} />

      {/* The spine: the back is carried on a stalk rising behind the seat, leaving daylight between
          seat and back. That gap is the single most recognisable cue of a modern task chair — an
          office chair whose back grows straight out of the seat cushion reads as a dining chair. */}
      <mesh position={[0, 0.63, -0.4]} rotation-x={-0.1} geometry={sharedRounded(0.16, 0.3, 0.07, 3, 0.034)} material={mFrameB} />

      {/* back: raked ~6°, a slim polished frame with the panel set into it, floating above the seat */}
      {/* Taller than it is wide — a square back reads as a dining chair; a task chair rises past the
          shoulders. 0.72 is the floor on width: the seated robot's shell spans ±0.35 and the back has
          to cover it. */}
      <group position={[0, 1.07, -0.43]} rotation-x={-0.1}>
        <mesh geometry={sharedRounded(0.72, 0.88, 0.075, 4, 0.1)} material={mFrameBack} />
        <mesh position={[0, 0.015, 0.006]} geometry={sharedRounded(0.58, 0.73, 0.085, 4, 0.075)} material={mFabricBack} />
      </group>

      {/* cantilevered arms, pads in the occupant's colour */}
      {[-0.365, 0.365].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[0, 0.63, -0.2]} geometry={sharedRounded(0.045, 0.22, 0.055, 2, 0.02)} material={mFrameB} />
          <mesh position={[0, 0.75, -0.08]} geometry={sharedRounded(0.075, 0.042, 0.3, 3, 0.021)} material={mPad} />
        </group>
      ))}
    </group>
  );
}

// A desk hard against a wall has no room behind it for the chair — the seated robot would sink
// into the wall (and an empty chair poke through it). When the seat spot lands inside the walls,
// flip the seat to the desk's FRONT instead: the figure works facing the wall, exactly like a
// wall-facing desk in a real office. Checked in world space so every rotation is covered.
// Which side each desk's occupant sits on now comes from the ENGINE (`planSeats`), not from a
// world-space wall test done per desk in isolation. That isolation was the bug: two desks each
// picked a side independently and both landed their chair in the same aisle cell. The engine plan
// resolves every desk together — and it's the same function `canPlace` validates against, so the
// room can never draw a seating arrangement the grid considers illegal. It also repairs rooms saved
// BEFORE the rule: a desk whose preferred side is already taken is moved to its far side here.
function seatSides(layout: PlacedItem[], facilityTier: number): Record<string, boolean> {
  return planSeats(layout, facilityTier).flipped;
}

// A workstation = the player's placed desk model (which carries its own monitor) + the employee's
// robot, rendered at the local origin facing +z. Callers position/rotate it (via the SAME worldOf
// transform the Decorate editor uses), so an occupied desk is identical in the office and the editor.
// Each hired employee gets exactly one.
// The workstation module's small prop (papers / desk plant / books), so a row of desks reads as
// lived-in and individual, not identical. Cosmetic; sits on the right of the desktop, clear of the
// monitor + keyboard. Which prop it is comes from the module spec, not a second local hash.
function DeskClutter({ prop, p }: { prop: WorkstationProp; p: RoomPalette }) {
  return (
    <group position={[0.44, 0.785, 0.08]}>
      {prop === "papers" && (
        <>
          <mesh position={[0, 0.012, 0]} rotation-y={0.22} geometry={sharedBox(0.16, 0.02, 0.2)} material={sharedStandard({ color: "#e8e6df", roughness: 0.9 })} />
          <mesh position={[0.02, 0.032, 0.01]} rotation-y={-0.16} geometry={sharedBox(0.16, 0.02, 0.2)} material={sharedStandard({ color: "#f3f1ea", roughness: 0.9 })} />
        </>
      )}
      {prop === "plant" && (
        <>
          <mesh position={[0, 0.05, 0]} geometry={sharedCylinder(0.052, 0.046, 0.1, 10)} material={sharedStandard({ color: "#8a6b4a", roughness: 0.8 })} />
          <mesh position={[0, 0.14, 0]} geometry={sharedSphere(0.08, 10, 10)} material={sharedStandard({ color: p.plant, roughness: 0.85 })} />
        </>
      )}
      {prop === "books" && (
        <>
          <mesh position={[0, 0.03, 0]} geometry={sharedBox(0.1, 0.06, 0.16)} material={sharedStandard({ color: CATALOG.fabric2, roughness: 0.7 })} />
          <mesh position={[0.005, 0.085, 0.01]} geometry={sharedBox(0.1, 0.05, 0.15)} material={sharedStandard({ color: CATALOG.tan, roughness: 0.7 })} />
        </>
      )}
    </group>
  );
}

// The living monitor on an OCCUPIED plain desk: a breathing emissive quad overlaid exactly on the
// "desk" model's screen (its group sits at [0.12,0.78,-0.18] and the screen plane at [0,0.38,0.023]
// → [0.12,1.16,-0.157], facing +z). Rendered INSIDE the Workstation's flip-rotated desk group, so it
// inherits the flip and always lands on the real screen. Slow emissive breathing; a warmer/busier
// tint while the company is shipping units; an occasional seeded "notification" blip; and a ship-day
// cheer pulse toward positive green. Throttled to ~15fps like Dust/Mug — it's pure flavour.
// Scoped to deskType "desk" (the one screen whose local position is known) like DeskClutter, so a
// fancier desk's own detailing is never overlaid at the wrong spot.
function LivingMonitor({ seed, hasProduction, p }: { seed: number; hasProduction: boolean; p: RoomPalette }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  // Resting screen tint, nudged warmer/busier while production runs (a "compiling/shipping" glow).
  const base = useMemo(() => {
    const c = new THREE.Color(p.screen);
    if (hasProduction) c.lerp(new THREE.Color("#ffb060"), 0.22);
    return c;
  }, [p.screen, hasProduction]);
  const scratch = useMemo(() => new THREE.Color(), []);
  const acc = useRef(0);
  useFrame((st, delta) => {
    const m = mat.current;
    if (!m) return;
    acc.current += delta;
    if (acc.current < 1 / 15) return; // ~15fps like Dust/Mug
    acc.current = 0;
    const et = st.clock.elapsedTime;
    // Notification blip: chop time into 6s windows; a stable hash of (window, seed) decides whether
    // THIS desk pings this window, then a short half-second cosine bump lights it. Deterministic —
    // derived from the clock + the per-desk seed, never Math.random in the frame path.
    const period = 6;
    const win = Math.floor(et / period);
    let spike = 0;
    if (Math.abs(Math.sin((win + seed) * 91.7)) > 0.6) {
      const into = et - win * period;
      if (into < 0.6) spike = Math.sin((into / 0.6) * Math.PI) * 0.9;
    }
    const cheer = reactionIntensity("cheer");
    scratch.copy(base);
    if (cheer > 0) scratch.lerp(CHEER_GREEN, cheer * 0.7); // ship-day green pulse (item 7)
    m.color.copy(scratch);
    m.emissive.copy(scratch);
    m.emissiveIntensity = 0.9 + Math.sin(et * 1.3 + seed) * 0.12 + spike + cheer * 0.5;
  });
  return (
    <mesh position={[0.12, 1.16, -0.153]}>
      <planeGeometry args={[0.62, 0.35]} />
      <meshStandardMaterial ref={mat} color={p.screen} emissive={p.screen} emissiveIntensity={0.95} toneMapped={false} />
    </mesh>
  );
}

function Workstation({ p, staff, seed, monitors, colorIdx, deskType = "desk", flip = false, hasProduction = false, still = false }: { p: RoomPalette; staff?: Staff; seed: number; monitors: number; colorIdx: number; powered?: boolean; deskType?: FurnitureId; flip?: boolean; hasProduction?: boolean; still?: boolean }) {
  // Item 5: the workstation module. The desk's own transform is the anchor — the unit mounts on it
  // and nothing about the placement changes. One definition (`workstationModuleFor`) also drives the
  // arranger's work pieces, so a band of desks reads authored rather than assembled.
  const module = workstationModuleFor(Math.round(seed * 1000), officeSeed(), monitors);
  // The seated robot is the EMPLOYEE: its shell colour comes from their Appearance (stable per
  // person, not per seat), so the office shows your actual, distinct team.
  const personColor = staff ? staff.appearance.shirt % ROBOT_COLORS.length : colorIdx;
  const hue = ROBOT_COLORS[personColor % ROBOT_COLORS.length];
  const moodColor = staff ? MOOD_HEX[moodBand(staff.mood ?? 60)] : undefined;
  // Occasional chair swivel: an occupied seat rotates a few degrees on a slow seeded cadence so a row
  // of workers isn't dead-still. Additive over the seat's base facing (the flip). Empty pod desks
  // (no staff) stay put. One cheap sine per occupied station; the slow frequency is its own smoothing.
  const seatRef = useRef<THREE.Group>(null);
  const seatBase = flip ? Math.PI : 0;
  useFrame((st) => {
    if (staff && seatRef.current) seatRef.current.rotation.y = seatBase + Math.sin(st.clock.elapsedTime * 0.4 + seed) * 0.06;
  });
  // Every desk model is authored with its user on the +z side (monitor at the back edge with its lit
  // face pointing +z, keyboard at the front), so the desk turns to put that side against the chair —
  // ALWAYS, whether or not anyone is sitting there yet. An empty desk used to do the opposite so its
  // glowing screen pointed at the camera, which meant the monitor faced away from its own chair and
  // then spun 180° the moment a hire sat down. A screen that doesn't face the seat reads as broken
  // furniture; consistency wins over the glow.
  const deskRotY = flip ? 0 : Math.PI;
  return (
    <group>
      {/* The player's ACTUAL placed desk model (each desk model carries its own monitor). The desk
          model seats its user on the +z side (screen faces +z, keyboard at the front), so we rotate
          it to FACE the seated employee: when they sit on the back edge (facing the camera) the desk
          turns 180° so the monitor faces them and the keyboard is nearest them — a correctly-oriented
          workstation, not one facing backwards. Matches whichever side the employee occupies. */}
      <group rotation-y={deskRotY}>
        <FurniturePiece type={deskType} p={p} />
        {/* the module's second panel, toed in beside the desk's own screen (computers upgrade) */}
        {deskType === "desk" && module.screenLayout !== "single" && (
          <group position={[module.screenLayout === "duo-left" ? -0.44 : 0.5, 0.78, -0.16]} rotation-y={module.screenLayout === "duo-left" ? 0.24 : -0.24}>
            <Monitor p={p} w={0.5} h={0.3} y={0.32} />
          </group>
        )}
        {/* the module's one small prop (papers / desk plant / books) — always present, never the same
            on every desk. Fancier desks carry their own detailing, so it is scoped to the plain desk. */}
        {deskType === "desk" && <DeskClutter prop={module.prop} p={p} />}
        {/* the screen comes alive on an occupied plain desk (breathing / notifications / ship-day pulse) */}
        {staff && deskType === "desk" && <LivingMonitor seed={seed} hasProduction={hasProduction} p={p} />}
      </group>
      {/* chair + robot SEATED on it: the figure is lifted onto the seat (≈0.58 high) and pulled
          back so it rests against the backrest, facing the desk (+z, toward the camera). The
          parametric robot folds into a sitting pose; a rigged .glb plays its "Sitting" clip instead.
          The group ref lets the slow chair-swivel above rotate the whole seat (chair + robot). */}
      <group ref={seatRef} position={[0, 0, flip ? 0.78 : -0.78]} rotation-y={flip ? Math.PI : 0}>
        <Chair p={p} hue={hue} />
        {staff && (
          <group position={[0, 0, -0.08]}>
            <OfficeRobot colorIdx={personColor} seed={seed} moodColor={moodColor} clip="Sitting" sitting personKey={staff.id} still={still} />
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
function DesktopPod({ p, worlds, staff, monitors, hasProduction = false, onTapStaff, startColorIdx, still = false }: { p: RoomPalette; worlds: { x: number; z: number; rotY: number }[]; staff: Staff[]; monitors: number; hasProduction?: boolean; onTapStaff?: (id: string) => void; startColorIdx: number; still?: boolean }) {
  const { staffTap, hoverProps, activeId, selectedId } = useHqInteractions({ onTapStaff });
  return (
    <group>
      {worlds.map((w, i) => {
        const s = staff[i];
        return (
          <group key={i} position={[w.x, 0, w.z]} rotation-y={w.rotY}>
            <Workstation p={p} staff={s} seed={(startColorIdx + i) * 2.1} monitors={monitors} colorIdx={(startColorIdx + i) % ROBOT_COLORS.length} hasProduction={hasProduction} powered still={still} />
            {/* invisible tap target → opens this employee's roster card (matches the placed desks) */}
            {onTapStaff && s?.id && (
              <mesh position={[0, 0.95, 0]} onClick={staffTap(s.id!)} {...hoverProps(s.id!)}>
                <boxGeometry args={[1.3, 1.9, 1.3]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            )}
            {onTapStaff && s?.id && (
              <TargetPrompt pos={[0, 1.6, 0]} target={{ id: s.id, title: s.name, actionLabel: "Tap for roster" }} activeId={activeId} selectedId={selectedId} r={0.72} />
            )}
          </group>
        );
      })}
    </group>
  );
}

// Floating label overlay — white pill badge with a coloured dot indicator.
// Scene-constant colours (like RoomPalette's intrinsic object colours): the pill must stay
// dark-on-white over the 3D room in BOTH app themes, so it can't ride the theme ink tokens.
const LABEL_BG = "rgba(255,255,255,0.94)";
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

// Pause the render loop when the tab/page is hidden to save battery. It also re-asserts the
// caller's `paused` flag: `frameloop` is a Canvas prop that only re-applies when it CHANGES, so an
// imperative resume here would otherwise un-pause a scene that is paused for being off-screen (the
// Factory world showing over it, another bottom tab) the instant the browser tab regains focus.
function VisibilityPause({ paused = false }: { paused?: boolean }) {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const apply = () => {
      const idle = paused || document.hidden;
      // "demand" rather than "never": a paused scene must still draw ONCE, or a caller that mounts it
      // already-paused (the Company hero) shows a blank canvas - "never" from first mount never runs
      // the initial draw. An explicit invalidate guarantees that single frame.
      setFrameloop(idle ? "demand" : "always");
      if (idle) invalidate();
    };
    apply();
    document.addEventListener("visibilitychange", apply);
    return () => document.removeEventListener("visibilitychange", apply);
  }, [setFrameloop, invalidate, paused]);
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

// Draw the company brand onto a canvas → texture (asset-free, offline-safe). Shown on the TV.
function brandTexture(name: string, accent: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 288;
  // A 2D context is not guaranteed: WKWebView hands back null when the canvas budget is exhausted
  // (a real condition on memory-pressured iPhones, where a WebGL context is already live alongside
  // this one). This runs inside a useMemo during WallTV's render, so a null here would throw MID-
  // RENDER and drop the player out of the whole 3D office into the 2D fallback over one wall poster.
  // An empty texture keeps the office — the TV just shows a dark screen.
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(c);
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

// Espresso machine + counter that appears with the Amenities upgrade. The scene owns this corner,
// so it stages its own nook: a rug anchoring the counter and a warm pendant over it, which is what
// makes the break corner read as a distinct, cozy zone rather than a machine against a wall.
function CoffeeStation({ p }: { p: RoomPalette }) {
  return (
    <group position={[-3.6, 0, 0.5]}>
      {/* the nook rug: a bordered flat slab extending toward the room, clear of the vault's footprint */}
      <RoundedBox args={[2.1, 0.02, 1.5]} radius={0.03} smoothness={2} position={[0.7, 0.011, 0.12]}>
        <meshStandardMaterial color={p.rugTrim} roughness={1} />
      </RoundedBox>
      <RoundedBox args={[1.85, 0.02, 1.28]} radius={0.03} smoothness={2} position={[0.7, 0.016, 0.12]}>
        <meshStandardMaterial color={p.rug} roughness={1} />
      </RoundedBox>
      {/* pendant: a warm cone over the counter (the light pool comes from the rig's lounge light) */}
      <mesh position={[0, 2.42, 0.05]}>
        <cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
        <meshStandardMaterial color={p.metalDark} />
      </mesh>
      <mesh position={[0, 2.02, 0.05]}>
        <coneGeometry args={[0.24, 0.26, 18, 1, true]} />
        <meshStandardMaterial color={p.lamp} emissive={p.lamp} emissiveIntensity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.93, 0.05]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshStandardMaterial color="#fff6df" emissive="#fff2cc" emissiveIntensity={1.3} toneMapped={false} />
      </mesh>
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
        <meshStandardMaterial color={CATALOG.ledOk} emissive={CATALOG.ledOk} emissiveIntensity={1.2} toneMapped={false} />
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
          <meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={0.55} toneMapped={false} />
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
        <meshBasicMaterial color={p.screen} transparent opacity={0.28} depthWrite={false} />
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

  // Seat sides for the whole room at once, from the DRAG-ADJUSTED layout so a desk being dragged
  // toward a wall previews the side its chair will actually end up on.
  const seatPlan = seatSides(
    dragIid && dragCell ? b.layout.map((it) => (it.iid === dragIid ? { ...it, c: dragCell.c, r: dragCell.r } : it)) : b.layout,
    facilityTier,
  );

  return (
    <group>
      {/* placed furniture (the dragged one follows the cursor, lifted slightly) */}
      {b.layout.map((it) => {
        if (hideIids?.has(it.iid)) return null; // occupied desk → live workstation renders instead
        const isDrag = it.iid === dragIid;
        const cell = isDrag && dragCell ? dragCell : { c: it.c, r: it.r };
        const renderItem = { ...it, c: cell.c, r: cell.r };
        const { x, z, rotY } = worldOf(renderItem, facilityTier);
        const def = furnitureDef(it.type);
        const selected = b.build && b.selectedIid === it.iid;
        // Facing is DERIVED for the pieces where the relationship is unambiguous (a chair to its
        // table, a wall unit flat to its wall). Desks keep the engine's seat plan: their model is
        // turned inside the group so the monitor faces the chair planSeats chose for them.
        const yaw = isDeskType(it.type) ? rotY : derivedYawFor(renderItem, b.layout, facilityTier);
        // Which side this desk's occupant sits on, from the whole-room plan (drag-adjusted, so both
        // the chair AND the desk's facing preview correctly while it's dragged toward a wall).
        const deskFlip = isDeskType(it.type) && (seatPlan[it.iid] ?? false);
        return (
          <group
            key={it.iid}
            position={[x, isDrag ? 0.2 : 0, z]}
            rotation-y={yaw}
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
            {/* A desk always reads as a workstation: its chair at the same offset the seated
                Workstation uses, and the desk turned so the MONITOR FACES THAT CHAIR (occupied desks
                are swapped for the live Workstation, which provides its own chair + robot, so no
                double-up). This path used to render the desk model unrotated, so on every seat side
                but one the screen pointed away from its own chair — and the desk then snapped round
                when someone finally sat at it. The 180° is footprint-safe: a half-turn about the
                footprint's centre always maps w×d back onto itself. */}
            {isDeskType(it.type) ? (
              <>
                <group rotation-y={deskFlip ? 0 : Math.PI}>
                  <FurniturePiece type={it.type} p={p} />
                </group>
                <group position={[0, 0, deskFlip ? 0.78 : -0.78]} rotation-y={deskFlip ? Math.PI : 0}>
                  <Chair p={p} hue={p.metalDark} />
                </group>
              </>
            ) : (
              <FurniturePiece type={it.type} p={p} />
            )}
            {selected && (
              <mesh rotation-x={-Math.PI / 2} position={[0, 0.035, 0]}>
                <planeGeometry args={[def.w * GRID.cell, def.d * GRID.cell]} />
                <meshBasicMaterial color="#3b82f6" transparent opacity={0.4} depthWrite={false} />
              </mesh>
            )}
            {/* Zone pad: this piece is part of a desk↔amenity pairing that's paying comfort/focus/
                inspiration right now. Green, and a touch fainter than the blue selection, so the two
                never read as the same thing. */}
            {b.build && !selected && b.zonedIids?.has(it.iid) && (
              <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
                <planeGeometry args={[def.w * GRID.cell, def.d * GRID.cell]} />
                <meshBasicMaterial color="#1eb877" transparent opacity={0.26} depthWrite={false} />
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

function Scene({ staff, facilityTier, hasProduction, upgrades, companyName, dark, builder, roomStyle, desktops = 0, paused = false, still = false, officeChatter = true, simPaused = false, onTapStaff, onTapBank }: { staff: Staff[]; facilityTier: number; hasProduction: boolean; upgrades: Upgrades; companyName: string; dark: boolean; builder?: BuildProps; roomStyle: { floor: number; wall: number }; desktops?: number; paused?: boolean; still?: boolean; officeChatter?: boolean; simPaused?: boolean; onTapStaff?: (id: string) => void; onTapBank?: () => void }) {
  const p = useMemo(() => roomPalette(dark), [dark]);
  const cfg = officeConfigFor({ facilityTier, upgrades, roomStyle, desktops });
  const { staffTap, bankTap, hoverProps, activeId, selectedId } = useHqInteractions({ onTapStaff, onTapBank });
  const monitors = cfg.monitors;
  const amenityTier = cfg.amenityTier;
  const finish = cfg.finish;
  const wall = cfg.wall;
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
  // The same whole-room seat plan the editable pieces use, so a desk doesn't change which side its
  // chair is on the moment someone is hired into it.
  const occupiedSeatSides = seatSides(builder?.layout ?? [], facilityTier);
  const overflow = staff.slice(seats.length);
  const podCount = cfg.podCount;
  const podWorlds = desktopWorlds(podCount);
  const podStaff = overflow.slice(0, podCount);
  const roaming = overflow.slice(podCount, cfg.staffCap);
  // Break destinations available this week: the coffee station, the planning board and any placed
  // arcade. Built from upgrades + the player's layout, so a break only targets a prop that exists.
  const destinations = useMemo<Destination[]>(
    () => officeDestinations({ amenityTier, showWhiteboard: cfg.showWhiteboard, dark, layout: builder?.layout ?? [], facilityTier, roomScale: cfg.roomScale }),
    [amenityTier, cfg.showWhiteboard, dark, builder?.layout, facilityTier, cfg.roomScale],
  );
  // Walkers steer and clamp in world units, so the keep-outs scale with the room shell.
  const roamObstacles = useMemo(() => scaledObstacles(cfg.roomScale), [cfg.roomScale]);
  const roamBound = ROAM_BOUND * cfg.roomScale;
  // Desk-owning employees as walkable agents: their seat world position + facing, colour and robot
  // seed. The walkers schedule from these SAME records, so the animation and the schedule agree.
  const agents = useMemo<RoamAgent[]>(() => {
    const out: RoamAgent[] = [];
    seated.forEach((s, i) => {
      const w = worldOf(seats[i], facilityTier);
      const flip = occupiedSeatSides[seats[i].iid] ?? false;
      const off = flip ? 0.86 : -0.86;
      out.push({
        key: s.id ?? `seat${i}`,
        seed: i * 2.1,
        colorIdx: s.appearance.shirt % ROBOT_COLORS.length,
        x: w.x + Math.sin(w.rotY) * off,
        z: w.z + Math.cos(w.rotY) * off,
        face: w.rotY + (flip ? Math.PI : 0),
      });
    });
    podStaff.forEach((s, i) => {
      const w = podWorlds[i];
      out.push({ key: s.id ?? `pod${i}`, seed: (seats.length + i) * 2.1, colorIdx: s.appearance.shirt % ROBOT_COLORS.length, x: w.x, z: w.z - 0.86, face: 0 });
    });
    return out;
  }, [staff, builder?.layout, facilityTier, podCount, occupiedSeatSides, podWorlds]);
  // Chatter speakers: every seated worker (placed desks + bought desktops) with their world spot, so
  // a bubble can sit above whoever is talking. y=2.4 clears the seated robot's raised head (~1.9).
  const speakers: Speaker[] = [
    ...seated.map((s, i) => { const w = worldOf(seats[i], facilityTier); return { key: s.id ?? `seat${i}`, seed: i * 2.1, x: w.x, z: w.z, y: 2.4 }; }),
    ...podStaff.map((s, i) => ({ key: s.id ?? `pod${i}`, seed: (seats.length + i) * 2.1, x: podWorlds[i].x, z: podWorlds[i].z, y: 2.4 })),
  ];
  // Occupied desks render as full live workstations, so hide their plain furniture models
  // (cozy view only — in Decorate mode the editable furniture pieces must stay visible).
  const occupiedIids = new Set(seated.map((_, i) => seats[i].iid));
  // Facility footprint: the room shell + its wall-anchored fixtures render inside a group scaled by
  // `sc`, so a bigger building (Studio/Campus) grows the walls, floor and props together, while the
  // furniture grid below fills the larger CENTRED grid at real desk size (tier-aware worldOf).
  const roomK = cfg.roomScale;
  const sc: [number, number, number] = [roomK, 1, roomK];
  // Exterior scenery shares the room's x/z space but NOT its scale: positions scale with `roomK`,
  // mesh sizes do not. Kept out of the scaled group above so a bigger building can't inflate it.
  const skyline = skylinePlacement(roomK);
  return (
    <>
      <VisibilityPause paused={paused} />
      {!dark && <EnableShadows />}
      <CameraRig build={!!builder?.build} facilityTier={facilityTier} still={still} />
      <PinchZoom />
      <Lighting p={p} dark={dark} roomScale={cfg.roomScale} />

      {/* Whiteboard is earned: it appears once the team has real Workstations (computers ≥ 1),
          so a fresh garage starts bare and upgrading visibly adds the planning board. The room shell
          scales with the facility so Studio/Campus give a visibly bigger floor to fill. */}
      <group scale={sc}>
        <Room p={p} dark={dark} finish={finish} wall={wall} cull={cull} showWhiteboard={cfg.showWhiteboard} name={companyName} tier={facilityTier} />
      </group>
      {/* distant skyline behind the windows — garage (dark) only; the light diorama floats in
          a clean white void, so no exterior scenery. */}
      {dark && (
        <group>
          {/* outside wall B (−x), seen past the left wall when the dollhouse culls it */}
          {skyline.wallB.map((b) => (
            <mesh key={b.key} position={b.position}>
              <boxGeometry args={b.size} />
              <meshStandardMaterial color={SKYLINE_COLOR} roughness={0.9} />
            </mesh>
          ))}
          {/* outside wall A (−z), seen past the back wall when the dollhouse culls it */}
          {skyline.wallA.map((b) => (
            <mesh key={b.key} position={b.position}>
              <boxGeometry args={b.size} />
              <meshStandardMaterial color={SKYLINE_COLOR} roughness={0.9} />
            </mesh>
          ))}
        </group>
      )}
      {/* The team — each employee's full workstation (desk + computer + robot) renders AT the
          placed desk they occupy, so buying a desk and hiring puts the new robot exactly where
          the player put the furniture. Hidden in Decorate mode (the editable desk pieces show
          instead); employees beyond the desk count roam the floor. */}
      {!inBuild && seated.map((s, i) => {
        const w = worldOf(seats[i], facilityTier);
        const flip = occupiedSeatSides[seats[i].iid] ?? false;
        return (
          <group key={s.id ?? i} position={[w.x, 0, w.z]} rotation-y={w.rotY}>
            <Workstation p={p} staff={s} seed={i * 2.1} monitors={monitors} colorIdx={i % ROBOT_COLORS.length} deskType={seats[i].type} flip={flip} hasProduction={hasProduction} still={still} />
            {/* invisible tap target over the desk+robot → opens this person's roster card. A
                transparent (not visible:false) mesh so the raycaster still hits it. */}
            {onTapStaff && s.id && (
              <mesh position={[0, 0.95, 0]} onClick={staffTap(s.id)} {...hoverProps(s.id)}>
                <boxGeometry args={[1.3, 1.9, 1.3]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            )}
            {onTapStaff && s.id && (
              <TargetPrompt pos={[0, 1.7, 0]} target={{ id: s.id, title: s.name, actionLabel: "Tap for roster" }} activeId={activeId} selectedId={selectedId} r={0.72} />
            )}
          </group>
        );
      })}
      {!inBuild && roaming.map((s, i) => {
        const home = roamHomeFor(i);
        return (
          <RoamingRobot
            key={s.id ?? `roam${i}`}
            agent={{ key: s.id ?? `roam${i}`, seed: (seats.length + podCount + i) * 3.7, colorIdx: s.appearance.shirt % ROBOT_COLORS.length, x: home[0], z: home[1], face: 0 }}
            wander={1.1}
            obstacles={roamObstacles}
            bound={roamBound}
            still={still}
          />
        );
      })}
      {/* Desk-owning employees walk to the break destination the weekly plan hands them; the same
          walker covers both directions (out and back) so a week change never teleports anyone. */}
      {!inBuild && agents.map((a) => (
        <RoamingRobot key={`walk-${a.key}`} agent={a} agents={agents} destinations={destinations} obstacles={roamObstacles} bound={roamBound} still={still} />
      ))}
      {/* Player-bought desktops — a tidy symmetric row that overflow employees sit at (so new
          hires get a desk like the founder). Hidden in Decorate mode like the live workstations. */}
      {!inBuild && <DesktopPod p={p} worlds={podWorlds} staff={podStaff} monitors={monitors} hasProduction={hasProduction} onTapStaff={onTapStaff} startColorIdx={seats.length} still={still} />}
      {/* wall-anchored fixtures scale with the room so they stay in the corners as the floor grows */}
      <group scale={sc}>
        <Props p={p} hasProduction={hasProduction} dark={dark} />
        <Dust />
        {dark && <BallBin p={p} pos={[3.1, 1.31, -3.0]} />}
      </group>

      {/* player-arranged furniture + the drag-to-move builder. Occupied desks are rendered as
          live workstations above, so their plain models are suppressed outside Decorate mode. */}
      {builder && <BuildLayer p={p} b={builder} hideIids={inBuild ? undefined : occupiedIids} facilityTier={facilityTier} />}
      {/* The room's own dressing — arranged around the player's furniture, never written to it. */}
      <OfficeDressing p={p} cfg={cfg} dark={dark} headcount={staff.length} layout={builder?.layout} />

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
      <group onClick={onTapBank && !inBuild ? bankTap : undefined} {...(onTapBank && !inBuild ? hoverProps("bank") : {})}>
        <Vault />
        {!inBuild && <TargetPrompt pos={[BANK_LABEL_POS[0] * roomK, BANK_LABEL_POS[1], BANK_LABEL_POS[2] * roomK]} target={{ id: "bank", title: "Bank", actionLabel: "Tap for finances" }} activeId={activeId} selectedId={selectedId} r={0.62} />}
      </group>
      </group>

      {/* The office's floating chips are player-triggered only: interaction prompts (hover/tap) and
          the team's reaction emotes. The old always-on Bank pill and per-employee name pills were
          removed — the robots are directly tappable (→ the Company roster, which lists every name). */}
      {!builder?.build && (
        <>
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
          {/* Office chatter (Wave 7) — deterministic, opt-out, and never under Reduce Motion. */}
          {!still && officeChatter && speakers.length > 0 && <SpeechBubbles speakers={speakers} paused={paused || simPaused} />}
        </>
      )}

      {/* Bake the shadow pass once (frames={1}) — the scene is mostly static, so re-rendering the
          depth pass every frame is wasted GPU. The key re-bakes on anything that moves geometry:
          item count alone missed moves/rotations (a dragged sofa kept its shadow at the old spot),
          plus desks (staff) and upgrade fixtures. The plane is sized to the room + a small margin
          (it used to be 16× the room scale, which spread 1024 px of shadow over a 23 m plane and
          smeared the whole floor into one soft grey blot). */}
      <ContactShadows
        key={`${(builder?.layout ?? []).map((it) => `${it.iid}${it.c},${it.r},${it.rot}`).join("|")}·${staff.length}·${facilityTier}·${Object.values(upgrades).join("")}`}
        position={[0, 0.02, 0]} scale={9.8 * roomK} blur={2.5} far={6} opacity={dark ? 0.62 : 0.42} color={p.shadow} resolution={1024} frames={1} />
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
  still = false,
  officeChatter = true,
  simPaused = false,
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
  /** Honour prefers-reduced-motion WITHOUT dropping the renderer: stills the idle camera drift, the
   *  one animation here that moves the whole viewport. Reduce Motion used to route players to the 2D
   *  scene instead, which silently hid every piece of furniture they had bought. */
  still?: boolean;
  /** Show the team's small deterministic speech bubbles in the office (Settings → Office chatter).
   *  Reduce Motion suppresses them regardless of this flag. */
  officeChatter?: boolean;
  /** The SIM's pause state (the HUD Pause button). The office render loop keeps running while the
   *  sim is paused, so the chatter scheduler gates on this too: a paused game shows no new bubbles,
   *  and any bubble up at the moment of pausing is cleared rather than frozen mid-air. */
  simPaused?: boolean;
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
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        camera={{ position: CAM_REST_POSITION, fov: 25 }}
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
        <Scene staff={staff} facilityTier={facilityTier} hasProduction={hasProduction} upgrades={upgrades} companyName={companyName} dark={dark} builder={builder} roomStyle={roomStyle} desktops={desktops} paused={paused} still={still} officeChatter={officeChatter} simPaused={simPaused} onTapStaff={onTapStaff} onTapBank={onTapBank} />
      </Canvas>
    </div>
  );
});
