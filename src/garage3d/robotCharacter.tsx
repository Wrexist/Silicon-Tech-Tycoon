// The team's mascot robots. Parametric-only (the rigged .glb path renders when a model is
// registered, with this parametric robot as its fallback). Extract from Garage3D so the scene file
// stays about the room, not the characters.
//
// Everything animated here is presentation: derived-hash work states, wall-clock idle motion and a
// live-pose registry the speech bubbles read. The engine is never consulted.
import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { reactionIntensity } from "../design/hqReaction.ts";
import { ROBOT_COLORS, robotModelFor } from "./robotModels.ts";
import { cosmeticHash01, officeSeed, officeWeek, workTargetFor } from "./officeLive.ts";
import { sharedCapsule, sharedCylinder, sharedSphere, sharedStandard } from "./sharedGpu.ts";
import {
  awayPlanFor,
  clearPose,
  poseFor,
  publishPose,
  ROAM_BOUND,
  ROAM_OBSTACLES,
  WANDER_ANGLE_SALT,
  WANDER_RADIUS_SALT,
  type Destination,
  type LivePose,
  type RoamAgent,
} from "./employeeController.ts";

/** Lighten/darken a hex colour for two-tone shading (belly highlight, visor, crown). */
export function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  if (amt >= 0) c.lerp(new THREE.Color("#ffffff"), amt);
  else c.lerp(new THREE.Color("#000000"), -amt);
  return `#${c.getHexString()}`;
}

// How high the seated robot rides above its floor pivot so its torso rests on the chair seat
// (Chair seat top ≈ 0.58; the robot's torso underside sits ≈0.18 above its pivot → ≈0.4 lift).
export const SIT_LIFT = 0.4;

// Premium mascot robot: soft two-tone shell, dark eye-visor with generous glowing eyes that blink,
// antenna with a lit mood tip, little arms + hands, rounded feet, metallic neck ring. `walking`
// toggles a stride swing; `sitting` folds it onto a chair; otherwise a gentle idle with a slow
// breath. `personKey` publishes the character's live activity for the office chatter.
export function RobotCharacter({ colorIdx, seed, moodColor, walking = false, sitting = false, still = false }: { colorIdx: number; seed: number; moodColor?: string; walking?: boolean; sitting?: boolean; still?: boolean }) {
  const color = ROBOT_COLORS[colorIdx % ROBOT_COLORS.length];
  const belly = useMemo(() => shade(color, 0.34), [color]);
  const crown = useMemo(() => shade(color, 0.12), [color]);
  const dark = useMemo(() => shade(color, -0.5), [color]);
  const metal = "#c7cdd6";
  const root = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const antRef = useRef<THREE.Group>(null);
  const eyeRef = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Group>(null);
  const armRRef = useRef<THREE.Group>(null);
  const legLRef = useRef<THREE.Group>(null);
  const legRRef = useRef<THREE.Group>(null);
  // Work state (Wave 7): a derived hash of (seed, week, character) picks idle vs working, eased so
  // the pose never snaps. Only re-hashed when the sim week changes, never per frame. `still`
  // (Reduce Motion) pins it to idle so no NEW always-on motion runs.
  const work = useRef(0);
  const workWeek = useRef(-1);
  const workTo = useRef(0);

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime + seed;
    const wk = officeWeek();
    if (workWeek.current !== wk) {
      workWeek.current = wk;
      workTo.current = still ? 0 : workTargetFor(officeSeed(), wk, Math.round(seed * 1000));
    }
    work.current += (workTo.current - work.current) * Math.min(1, dt * 1.6);
    const w = work.current;
    // Living-office reactions: a bouncy hop + raised arms on a win (cheer), or a head-down droop on
    // a flop (slump). Both decay over the reaction window (hqReaction).
    const cheer = reactionIntensity("cheer");
    const slump = reactionIntensity("slump");
    // Seated robots idly "type": a small forearm oscillation (left/right thrown out of phase) plus a
    // subtle head dip toward the screen sharing the same phase, so a bank of desks reads as busy
    // rather than frozen. Seeded so no two robots tap in lockstep.
    const type = sitting ? Math.sin(t * 7 + seed * 3) * (0.02 + w * 0.08) : 0;
    // Slow breath: a whisper of vertical bob + scale so the shell feels alive between gestures.
    const breath = still ? 0 : Math.sin(t * 1.15) * 0.5 + 0.5;
    // Seated robots are lifted onto the seat (SIT_LIFT above the floor pivot) and stay planted — no
    // standing bob — with a cheer reduced to a small in-seat bounce. SIT_LIFT lives here (not on the
    // parent) so a rigged .glb playing its own grounded "Sitting" clip isn't pushed off the chair.
    const baseY = sitting
      ? SIT_LIFT
      : walking ? Math.abs(Math.sin(t * 6)) * 0.05 : Math.sin(t * 1.5) * 0.035;
    const hop = cheer > 0 ? Math.abs(Math.sin(t * 9)) * (sitting ? 0.05 : 0.14) * cheer : 0; // seeded t → each robot hops out of phase
    if (root.current) {
      root.current.position.y = baseY + hop - slump * 0.05 + breath * 0.008;
      root.current.scale.setScalar(1.25 * (1 + breath * 0.007));
    }
    if (headRef.current) {
      const calm = 1 - slump;
      // Working robots keep their head down on the screen; idle robots sit back and slowly look
      // around the room (the derived work state w cross-fades the two — visible across the team).
      const lookAround = sitting && !still ? (1 - w) * Math.sin(t * 0.45 + seed * 1.7) * 0.26 : 0;
      headRef.current.rotation.y =
        Math.sin(t * 0.6) * (walking ? 0.08 : 0.22) * calm * (sitting ? 0.35 + 0.65 * (1 - w) : 1) + lookAround;
      headRef.current.rotation.z = Math.sin(t * 0.95) * 0.04 * calm;
      // hangs down on a flop; when seated, a forward nod toward the screen that deepens with work
      headRef.current.rotation.x =
        slump * 0.55 +
        (sitting ? w * (0.1 + 0.03 * (0.5 + 0.5 * Math.sin(t * 7 + seed * 3))) : 0);
    }
    // Blink: a short lid close on a per-character cycle. Derived from the clock + seed, so it is
    // deterministic per character and suppressed under Reduce Motion.
    if (eyeRef.current) {
      const cycle = 3.2 + (seed % 1) * 1.4;
      const phase = ((t + seed * 0.63) % cycle + cycle) % cycle;
      const close = still ? 0 : phase < 0.13 ? Math.sin((phase / 0.13) * Math.PI) : 0;
      eyeRef.current.scale.y = 1 - close * 0.86;
      eyeRef.current.scale.x = 1 + close * 0.14;
    }
    if (antRef.current) {
      antRef.current.rotation.z = Math.sin(t * 2.2) * (0.18 + cheer * 0.6) * (1 - slump);
      antRef.current.rotation.x = slump * 0.9; // antenna droops forward
    }
    // arms: brisk swing while walking, soft sway when idle, drawn forward to rest at the desk when
    // seated — and thrown overhead on a cheer.
    const arm = walking ? Math.sin(t * 6) * 0.7 : Math.sin(t * 1.6) * 0.12;
    const cheerArm = -2.0 * cheer; // raise both arms up
    const sitArm = sitting ? -0.45 - w * 0.25 : 0; // working leans the hands further onto the desk
    if (armLRef.current) armLRef.current.rotation.x = -0.1 + arm + cheerArm + sitArm + type;
    if (armRRef.current) armRRef.current.rotation.x = -0.1 - arm + cheerArm + sitArm - type;
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
      {/* legs + rounded feet — geometries/materials come from the shared GPU cache (sharedGpu.ts) */}
      <group ref={legLRef} position={[-0.13, 0.3, 0]}>
        <mesh position={[0, -0.13, 0]} geometry={sharedCapsule(0.08, 0.16, 6, 10)} material={sharedStandard({ color: dark, roughness: 0.5 })} />
        <mesh position={[0, -0.26, 0.05]} geometry={sharedSphere(0.115, 14, 12)} material={sharedStandard({ color: dark, roughness: 0.45 })} />
      </group>
      <group ref={legRRef} position={[0.13, 0.3, 0]}>
        <mesh position={[0, -0.13, 0]} geometry={sharedCapsule(0.08, 0.16, 6, 10)} material={sharedStandard({ color: dark, roughness: 0.5 })} />
        <mesh position={[0, -0.26, 0.05]} geometry={sharedSphere(0.115, 14, 12)} material={sharedStandard({ color: dark, roughness: 0.45 })} />
      </group>

      {/* body — a rounder shell with a lighter belly panel (soft two-tone) */}
      <mesh position={[0, 0.6, 0]} geometry={sharedCapsule(0.3, 0.32, 10, 20)} material={sharedStandard({ color, roughness: 0.34, metalness: 0.05 })} />
      <mesh position={[0, 0.54, 0.21]} scale={[0.72, 0.82, 0.42]} geometry={sharedSphere(0.28, 18, 18)} material={sharedStandard({ color: belly, roughness: 0.42 })} />
      {/* metallic neck ring */}
      <mesh position={[0, 0.9, 0]} geometry={sharedCylinder(0.17, 0.19, 0.07, 18)} material={sharedStandard({ color: metal, metalness: 0.7, roughness: 0.3 })} />

      {/* arms with rounded hands */}
      <group ref={armLRef} position={[-0.34, 0.72, 0]}>
        <mesh position={[0, -0.16, 0]} geometry={sharedCapsule(0.09, 0.24, 6, 12)} material={sharedStandard({ color, roughness: 0.34 })} />
        <mesh position={[0, -0.32, 0]} geometry={sharedSphere(0.105, 14, 12)} material={sharedStandard({ color: belly, roughness: 0.42 })} />
      </group>
      <group ref={armRRef} position={[0.34, 0.72, 0]}>
        <mesh position={[0, -0.16, 0]} geometry={sharedCapsule(0.09, 0.24, 6, 12)} material={sharedStandard({ color, roughness: 0.34 })} />
        <mesh position={[0, -0.32, 0]} geometry={sharedSphere(0.105, 14, 12)} material={sharedStandard({ color: belly, roughness: 0.42 })} />
      </group>

      {/* head — a bigger, rounder shell with a lighter crown */}
      <group ref={headRef} position={[0, 1.22, 0]}>
        <mesh geometry={sharedSphere(0.36, 26, 26)} material={sharedStandard({ color: crown, roughness: 0.32, metalness: 0.05 })} />
        {/* dark wrap-around visor */}
        <mesh position={[0, 0.03, 0.05]} scale={[1.03, 0.6, 1.03]} geometry={sharedSphere(0.35, 24, 24, 0, Math.PI * 2, Math.PI * 0.18, Math.PI * 0.4)} material={sharedStandard({ color: dark, roughness: 0.25, metalness: 0.2 })} />
        {/* glowing eyes — bigger and brighter, on a group so they can blink */}
        <group ref={eyeRef}>
          <mesh position={[-0.13, 0.04, 0.33]} geometry={sharedSphere(0.068, 14, 14)} material={sharedStandard({ color: "#ffffff", emissive: "#d6efff", emissiveIntensity: 2.7, toneMapped: false })} />
          <mesh position={[0.13, 0.04, 0.33]} geometry={sharedSphere(0.068, 14, 14)} material={sharedStandard({ color: "#ffffff", emissive: "#d6efff", emissiveIntensity: 2.7, toneMapped: false })} />
        </group>
        {/* antenna with a lit tip */}
        <group ref={antRef} position={[0, 0.32, 0]}>
          <mesh position={[0, 0.1, 0]} geometry={sharedCylinder(0.018, 0.018, 0.22, 8)} material={sharedStandard({ color: metal, metalness: 0.6, roughness: 0.3 })} />
          <mesh position={[0, 0.24, 0]} geometry={sharedSphere(0.055, 12, 12)} material={sharedStandard({ color: moodColor ?? "#ff5a5a", emissive: moodColor ?? "#ff5a5a", emissiveIntensity: 1.4, toneMapped: false })} />
        </group>
      </group>

      {/* blob shadow — grounds a standing robot; skipped when seated (it would float at seat
          height, and the chair already grounds the figure). */}
      {!sitting && (
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.005, 0.03]}>
          <circleGeometry args={[0.34, 20]} />
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

/** Owns the SEATED character's live presence: hides it while its walker is away owning the pose,
 *  and publishes the work state the speech bubbles read. Wraps both the parametric robot and the
 *  .glb model path, so a dropped-in model can never render a second copy beside its walker. */
function CharacterPresence({ personKey, seed, walking = false, still = false, children }: { personKey?: string; seed: number; walking?: boolean; still?: boolean; children: ReactNode }) {
  const grp = useRef<THREE.Group>(null);
  const work = useRef(0);
  const workWeek = useRef(-1);
  const workTo = useRef(0);
  const pose = useRef<LivePose>({ activity: "thinking", roaming: false });
  useEffect(() => () => { if (personKey) clearPose(personKey); }, [personKey]);
  useFrame((_st, dt) => {
    if (!personKey) return;
    const roaming = poseFor(personKey)?.roaming === true;
    if (grp.current) grp.current.visible = !roaming;
    if (roaming || walking || still) return;
    const wk = officeWeek();
    if (workWeek.current !== wk) {
      workWeek.current = wk;
      workTo.current = workTargetFor(officeSeed(), wk, Math.round(seed * 1000));
    }
    work.current += (workTo.current - work.current) * Math.min(1, dt * 1.6);
    pose.current.activity = work.current > 0.5 ? "working" : "thinking";
    pose.current.roaming = false;
    publishPose(personKey, pose.current);
  });
  return <group ref={grp}>{children}</group>;
}

/** A robot by colour index: uses a dropped-in .glb model when one exists (see robotModels.ts),
 *  otherwise the hand-built parametric robot. `clip` requests an animation by name (e.g. "Idle",
 *  "Sitting") — ignored if the model doesn't ship that clip. A blob shadow grounds the model. */
export function OfficeRobot({ colorIdx, seed, moodColor, clip, walking = false, sitting = false, still = false, personKey }: { colorIdx: number; seed: number; moodColor?: string; clip?: string; walking?: boolean; sitting?: boolean; still?: boolean; personKey?: string }) {
  const parametric = <RobotCharacter colorIdx={colorIdx} seed={seed} moodColor={moodColor} walking={walking} sitting={sitting} still={still} />;
  const model = robotModelFor(colorIdx);
  const body = !model ? (
    parametric
  ) : (
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
  return (
    <CharacterPresence personKey={personKey} seed={seed} walking={walking} still={still}>
      {body}
    </CharacterPresence>
  );
}

type Phase = "seated" | "outbound" | "hanging" | "returning";

const WALK_SPEED = 0.62;
const ARRIVE = 0.04;

/**
 * A robot out on the floor. With a `destinations` plan it is a commuter: the derived weekly away
 * plan sends it from its desk to an unoccupied destination spot, it hangs out there, and it walks
 * back when the plan releases it — never two roamers at the same spot, never a desk left occupied.
 * Without a plan (`wander > 0`) it drifts around its home on a derived schedule (overflow hires).
 * `obstacles`/`bound` come from the Scene in world units so both scale with the facility.
 */
export function RoamingRobot({ agent, agents = [], destinations, wander = 0, still = false, obstacles, bound }: { agent: RoamAgent; agents?: readonly RoamAgent[]; destinations?: readonly Destination[]; wander?: number; still?: boolean; obstacles?: readonly { x: number; z: number; r: number }[]; bound?: number }) {
  const grp = useRef<THREE.Group>(null);
  const st = useRef({
    x: agent.x,
    z: agent.z,
    face: agent.face,
    faceTo: agent.face,
    tx: agent.x,
    tz: agent.z,
    phase: (wander > 0 ? "outbound" : "seated") as Phase,
    kind: null as null | Destination["kind"],
    week: -1,
    step: -1,
  });
  const [shown, setShown] = useState(false);
  const [walking, setWalking] = useState(false);
  const live = useRef<LivePose>({ activity: "walking", x: agent.x, z: agent.z, roaming: true });
  // Drifters are the only characters with no desk to sit at — they stay visible, still under
  // Reduce Motion (no motion, but the person is still in the room).
  const alwaysShown = wander > 0;
  useEffect(() => () => clearPose(agent.key), [agent.key]);

  useFrame((f, dt) => {
    const s = st.current;
    const show = (v: boolean) => { if (shown !== v) setShown(v); };
    const stride = (v: boolean) => { if (walking !== v) setWalking(v); };
    if (still) {
      if (!alwaysShown) { show(false); clearPose(agent.key); return; }
      if (grp.current) { grp.current.position.set(s.x, 0, s.z); grp.current.rotation.y = s.faceTo; }
      show(true);
      stride(false);
      return;
    }
    const t = f.clock.elapsedTime + agent.seed;
    const wk = officeWeek();
    if (alwaysShown) {
      // Deterministic drift: a new target every ~7s, hashed from (seed, week, step) — stable for a
      // capture at a given moment of media time, never Math.random.
      const step = Math.floor(t / 7);
      if (step !== s.step) {
        s.step = step;
        const hs = (officeSeed() ^ Math.imul(Math.round(agent.seed * 1000) + 1, 0x9e3779b1)) >>> 0;
        const k = officeWeek() * 64 + step;
        const a = cosmeticHash01(hs, k, WANDER_ANGLE_SALT) * Math.PI * 2;
        const r = Math.sqrt(cosmeticHash01(hs, k, WANDER_RADIUS_SALT)) * wander;
        s.tx = agent.x + Math.cos(a) * r;
        s.tz = agent.z + Math.sin(a) * r;
      }
    } else if (wk !== s.week) {
      s.week = wk;
      const plan = destinations && destinations.length ? awayPlanFor(agents, officeSeed(), wk, destinations) : null;
      const spot = plan?.get(agent.key) ?? null;
      s.tx = spot ? spot.x : agent.x;
      s.tz = spot ? spot.z : agent.z;
      s.kind = spot?.kind ?? null;
      s.faceTo = spot?.face ?? agent.face;
      // A spot always (re)starts an outbound walk — whether from the desk, an aborted return, or a
      // different hang-out spot — so a released character can never flip straight back to the desk.
      if (spot) s.phase = "outbound";
      else if (s.phase !== "seated") s.phase = "returning";
    }

    const dx = s.tx - s.x;
    const dz = s.tz - s.z;
    const d = Math.hypot(dx, dz);
    if (s.phase !== "seated" && d > ARRIVE) {
      const step = Math.min(d, WALK_SPEED * dt);
      s.x += (dx / d) * step;
      s.z += (dz / d) * step;
      s.faceTo = Math.atan2(dx, dz);
      show(true);
      stride(true);
    } else if (s.phase === "outbound") {
      s.phase = "hanging";
      stride(false);
    } else if (s.phase === "returning") {
      s.phase = "seated";
      show(false);
    } else if (s.phase === "hanging") {
      stride(false);
    }
    if (alwaysShown) show(true);

    // Keep clear of the fixed props and of the other desks (own desk excluded — that is the target
    // when walking home). Straight-line steering, no pathfinding.
    if (s.phase !== "seated") {
      const push = (ox: number, oz: number, r: number) => {
        const px = s.x - ox;
        const pz = s.z - oz;
        const pd = Math.hypot(px, pz);
        if (pd < r && pd > 1e-3) {
          s.x += (px / pd) * (r - pd);
          s.z += (pz / pd) * (r - pd);
        }
      };
      for (const o of obstacles ?? ROAM_OBSTACLES) push(o.x, o.z, o.r);
      for (const a of agents) {
        if (a.key !== agent.key) push(a.x, a.z, 0.62);
      }
      const lim = bound ?? ROAM_BOUND;
      s.x = Math.max(-lim, Math.min(lim, s.x));
      s.z = Math.max(-lim, Math.min(lim, s.z));
    }

    if (grp.current) {
      grp.current.position.set(s.x, 0, s.z);
      const diff = ((s.faceTo - grp.current.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      grp.current.rotation.y += diff * Math.min(1, dt * 6);
    }

    if (!alwaysShown) {
      if (s.phase === "seated") clearPose(agent.key);
      else {
        // At the spot → the destination's own line; still moving (out or back) → the walking line.
        live.current.activity = s.phase === "hanging" && s.kind ? s.kind : "walking";
        live.current.x = s.x;
        live.current.z = s.z;
        publishPose(agent.key, live.current);
      }
    }
  });

  return (
    <group ref={grp}>
      {shown && <OfficeRobot colorIdx={agent.colorIdx} seed={agent.seed} clip={walking ? "Walking" : "Idle"} walking={walking} still={still} />}
    </group>
  );
}
