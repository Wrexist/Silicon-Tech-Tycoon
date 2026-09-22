import { sofaSeatSurface, robotSeatLift } from './seatAnchors.ts';
import { stepOfficeMotion, updateWalkPose, angleDelta, type WalkPose } from './officeMotion.ts';
// The team's mascot robots. Parametric-only (the rigged .glb path renders when a model is
// registered, with this parametric robot as its fallback). Extract from Garage3D so the scene file
// stays about the room, not the characters.
//
// Everything animated here is presentation: derived-hash work states, wall-clock idle motion and a
// live-pose registry the speech bubbles read. The engine is never consulted.
import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { reactionIntensity } from '../design/hqReaction.ts';
import { ROBOT_COLORS, robotModelFor } from './robotModels.ts';
import { cosmeticHash01, officeSeed, officeWeek, workTargetFor } from './officeLive.ts';
import { sharedCapsule, sharedCylinder, sharedSphere, sharedStandard, sharedTorus } from './sharedGpu.ts';
import {
  awayPlanFor,
  MAX_AWAY,
  clearPose,
  poseFor,
  publishPose,
  ROAM_BOUND,
  ROAM_OBSTACLES,
  reachableDestination,
  type AwaySpot,
  WANDER_ANGLE_SALT,
  WANDER_RADIUS_SALT,
  type Destination,
  type LivePose,
  type RoamAgent,
} from './employeeController.ts';

import { findOfficePath, type Point, type Obstacle } from './officeNavigation.ts';

/** Lighten/darken a hex colour for two-tone shading (belly highlight, visor, crown). */
export function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  if (amt >= 0) c.lerp(new THREE.Color('#ffffff'), amt);
  else c.lerp(new THREE.Color('#000000'), -amt);
  return `#${c.getHexString()}`;
}

// How high the seated robot rides above its floor pivot so its torso rests on the chair seat
// (Chair seat top ≈ 0.58; the robot's torso underside sits ≈0.18 above its pivot → ≈0.4 lift).
export const SIT_LIFT = 0.4;

// Premium mascot robot: soft two-tone shell, dark eye-visor with generous glowing eyes that blink,
// antenna with a lit mood tip, little arms + hands, rounded feet, metallic neck ring. `walking`
// toggles a stride swing; `sitting` folds it onto a chair; otherwise a gentle idle with a slow
// breath. `personKey` publishes the character's live activity for the office chatter.
export function RobotCharacter({
  colorIdx,
  seed,
  moodColor,
  walking = false,
  sitting = false,
  still = false,
  relaxing = false,
  watering = false,
  sitProgress,
  walkPose,
}: {
  colorIdx: number;
  seed: number;
  moodColor?: string;
  walking?: boolean;
  sitting?: boolean;
  still?: boolean;
  relaxing?: boolean;
  watering?: boolean;
  sitProgress?: { current: number };
  walkPose?: { current: WalkPose };
}) {
  const waterRef = useRef<THREE.Group>(null);
  const color = ROBOT_COLORS[colorIdx % ROBOT_COLORS.length];
  const belly = useMemo(() => shade(color, 0.34), [color]);
  const crown = useMemo(() => shade(color, 0.12), [color]);
  const dark = useMemo(() => shade(color, -0.5), [color]);
  const metal = '#c7cdd6';
  const root = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const antRef = useRef<THREE.Group>(null);
  const eyeRef = useRef<THREE.Group>(null);
  const gazeRef = useRef<THREE.Group>(null);
  const smileRef = useRef<THREE.Mesh>(null);
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
    const t = (still ? 0 : st.clock.elapsedTime) + seed;
    const wk = officeWeek();
    if (workWeek.current !== wk) {
      workWeek.current = wk;
      workTo.current = still ? 0 : workTargetFor(officeSeed(), wk, Math.round(seed * 1000));
    }
    work.current = still ? 0 : work.current + (workTo.current - work.current) * Math.min(1, dt * 1.6);
    const gait = still ? 0 : (walkPose?.current.weight ?? (walking ? 1 : 0));
    const stridePhase = walkPose?.current.phase ?? t * 6;
    const w = relaxing ? 0 : work.current;
    const sit = sitProgress?.current ?? (sitting ? 1 : 0);
    // Living-office reactions: a bouncy hop + raised arms on a win (cheer), or a head-down droop on
    // a flop (slump). Both decay over the reaction window (hqReaction).
    const cheer = still ? 0 : reactionIntensity('cheer');
    const slump = still ? 0 : reactionIntensity('slump');
    // Seated robots idly "type": a small forearm oscillation (left/right thrown out of phase) plus a
    // subtle head dip toward the screen sharing the same phase, so a bank of desks reads as busy
    // rather than frozen. Seeded so no two robots tap in lockstep.
    const type = sitting && !relaxing ? Math.sin(t * 7 + seed * 3) * (0.02 + w * 0.08) : 0;
    // Slow breath: a whisper of vertical bob + scale so the shell feels alive between gestures.
    const breath = still ? 0 : Math.sin(t * 1.15) * 0.5 + 0.5;
    // Seated robots are lifted onto the seat (SIT_LIFT above the floor pivot) and stay planted — no
    // standing bob — with a cheer reduced to a small in-seat bounce. SIT_LIFT lives here (not on the
    // parent) so a rigged .glb playing its own grounded "Sitting" clip isn't pushed off the chair.
    const baseY =
      SIT_LIFT * sit +
      (1 - sit) * (Math.abs(Math.sin(stridePhase)) * 0.05 * gait + Math.sin(t * 1.5) * 0.035 * (1-gait));
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
        Math.sin(t * 0.6) * (walking ? 0.08 : 0.22) * calm * (sitting ? 0.35 + 0.65 * (1 - w) : 1) +
        lookAround;
      headRef.current.rotation.z = Math.sin(t * 0.95) * 0.04 * calm;
      // hangs down on a flop; when seated, a forward nod toward the screen that deepens with work
      headRef.current.rotation.x =
        slump * 0.55 + (sitting ? w * (0.1 + 0.03 * (0.5 + 0.5 * Math.sin(t * 7 + seed * 3))) : 0);
    }
    // Blink: a short lid close on a per-character cycle. Derived from the clock + seed, so it is
    // deterministic per character and suppressed under Reduce Motion.
    if (eyeRef.current) {
      const cycle = 3.2 + (seed % 1) * 1.4;
      const phase = (((t + seed * 0.63) % cycle) + cycle) % cycle;
      const close = still ? 0 : phase < 0.13 ? Math.sin((phase / 0.13) * Math.PI) : 0;
      eyeRef.current.scale.y = 1 - close * 0.86;
      eyeRef.current.scale.x = 1 + close * 0.14;
    }
    // Small shared eye movements give the face a readable focus without changing navigation.
    if (gazeRef.current) {
      gazeRef.current.position.x = still ? 0 : Math.sin(t * 0.45 + seed * 1.7) * 0.012 * (1 - w);
      gazeRef.current.position.y = sitting && !relaxing ? -0.009 * w : 0;
    }
    if (smileRef.current) smileRef.current.scale.y = 0.55 * (1 - slump * 0.85) + cheer * 0.15;
    if (antRef.current) {
      antRef.current.rotation.z = Math.sin(t * 2.2) * (0.18 + cheer * 0.6) * (1 - slump);
      antRef.current.rotation.x = slump * 0.9; // antenna droops forward
    }
    // arms: brisk swing while walking, soft sway when idle, drawn forward to rest at the desk when
    // seated — and thrown overhead on a cheer.
    const arm = Math.sin(stridePhase) * 0.7 * gait + Math.sin(t * 1.6) * 0.12 * (1-gait);
    const cheerArm = -2.0 * cheer; // raise both arms up
    const sitArm = (-0.45 - w * 0.25) * sit; // working leans the hands further onto the desk
    if (armLRef.current) armLRef.current.rotation.x = -0.1 + arm + cheerArm + sitArm + type;
    if (armRRef.current) armRRef.current.rotation.x = -0.1 - arm + cheerArm + sitArm - type;
    if (waterRef.current) {
      waterRef.current.rotation.x = 0.35 + Math.sin(t * 1.5) * 0.1;
      for(let i=2;i<waterRef.current.children.length;i++) {
        const drop=waterRef.current.children[i],progress=(t*1.8+(i-2)/3)%1;
        drop.position.y=-0.10-progress*0.32;
        drop.scale.setScalar(Math.sin(progress*Math.PI)*0.7+0.3);
      }
    }
    if (watering) {
      if (armLRef.current) armLRef.current.rotation.x = -0.85;
      if (armRRef.current) armRRef.current.rotation.x = -1.1 + Math.sin(t * 1.5) * 0.08;
      if (headRef.current) headRef.current.rotation.x = 0.22;
    }
    // legs: brisk stride while walking, still when idle, folded forward at the hip when seated so
    // the thighs run forward over the seat and tuck under the desk (the seated "L" silhouette).
    if (sit > 0) {
      if (legLRef.current) legLRef.current.rotation.x = -1.5 * sit;
      if (legRRef.current) legRRef.current.rotation.x = -1.5 * sit;
    } else {
      const leg = Math.sin(stridePhase) * 0.5 * gait;
      if (legLRef.current) legLRef.current.rotation.x = -leg;
      if (legRRef.current) legRRef.current.rotation.x = leg;
    }
  });

  return (
    <group ref={root} name="office-robot-body" scale={1.25}>
      {/* legs + rounded feet — geometries/materials come from the shared GPU cache (sharedGpu.ts) */}
      <group ref={legLRef} position={[-0.13, 0.3, 0]}>
        <mesh
          position={[0, -0.13, 0]}
          geometry={sharedCapsule(0.08, 0.16, 6, 10)}
          material={sharedStandard({ color: dark, roughness: 0.5 })}
        />
        <mesh
          position={[0, -0.26, 0.05]}
          geometry={sharedSphere(0.115, 14, 12)}
          material={sharedStandard({ color: dark, roughness: 0.45 })}
        />
      </group>
      <group ref={legRRef} position={[0.13, 0.3, 0]}>
        <mesh
          position={[0, -0.13, 0]}
          geometry={sharedCapsule(0.08, 0.16, 6, 10)}
          material={sharedStandard({ color: dark, roughness: 0.5 })}
        />
        <mesh
          position={[0, -0.26, 0.05]}
          geometry={sharedSphere(0.115, 14, 12)}
          material={sharedStandard({ color: dark, roughness: 0.45 })}
        />
      </group>

      {watering && (
        <group ref={waterRef} position={[0.22, 0.65, 0.42]} rotation-x={0.35}>
          <mesh
            geometry={sharedCylinder(0.11, 0.1, 0.19, 10)}
            material={sharedStandard({ color: metal, roughness: 0.65 })}
          />
          <mesh
            position={[0, 0.02, 0.17]}
            rotation-x={Math.PI / 3}
            geometry={sharedCylinder(0.025, 0.035, 0.3, 8)}
            material={sharedStandard({ color: metal, roughness: 0.65 })}
          />
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              position={[0, -0.1 - i * 0.08, 0.3 + i * 0.025]}
              geometry={sharedSphere(0.018, 6, 6)}
              material={sharedStandard({ color: ROBOT_COLORS[0], roughness: 0.3 })}
            />
          ))}
        </group>
      )}
      {/* body — a rounder shell with a lighter belly panel (soft two-tone) */}
      <mesh
        position={[0, 0.6, 0]}
        geometry={sharedCapsule(0.3, 0.32, 10, 20)}
        material={sharedStandard({ color, roughness: 0.34, metalness: 0.05 })}
      />
      <mesh
        position={[0, 0.54, 0.21]}
        scale={[0.72, 0.82, 0.42]}
        geometry={sharedSphere(0.28, 18, 18)}
        material={sharedStandard({ color: belly, roughness: 0.42 })}
      />
      {/* metallic neck ring */}
      <mesh
        position={[0, 0.9, 0]}
        geometry={sharedCylinder(0.17, 0.19, 0.07, 18)}
        material={sharedStandard({ color: metal, metalness: 0.7, roughness: 0.3 })}
      />

      {/* arms with rounded hands */}
      <group ref={armLRef} position={[-0.34, 0.72, 0]}>
        <mesh
          position={[0, -0.16, 0]}
          geometry={sharedCapsule(0.09, 0.24, 6, 12)}
          material={sharedStandard({ color, roughness: 0.34 })}
        />
        <mesh
          position={[0, -0.32, 0]}
          geometry={sharedSphere(0.105, 14, 12)}
          material={sharedStandard({ color: belly, roughness: 0.42 })}
        />
      </group>
      <group ref={armRRef} position={[0.34, 0.72, 0]}>
        <mesh
          position={[0, -0.16, 0]}
          geometry={sharedCapsule(0.09, 0.24, 6, 12)}
          material={sharedStandard({ color, roughness: 0.34 })}
        />
        <mesh
          position={[0, -0.32, 0]}
          geometry={sharedSphere(0.105, 14, 12)}
          material={sharedStandard({ color: belly, roughness: 0.42 })}
        />
      </group>

      {/* head — a bigger, rounder shell with a lighter crown */}
      <group ref={headRef} position={[0, 1.22, 0]} scale={[1.06, 1.02, 1.04]}>
        <mesh
          geometry={sharedSphere(0.36, 26, 26)}
          material={sharedStandard({ color: crown, roughness: 0.48, metalness: 0.05 })}
        />
        {/* dark wrap-around visor */}
        <mesh
          position={[0, 0.03, 0.05]}
          scale={[1.03, 0.6, 1.03]}
          geometry={sharedSphere(0.35, 24, 24, 0, Math.PI * 2, Math.PI * 0.18, Math.PI * 0.4)}
          material={sharedStandard({ color: dark, roughness: 0.25, metalness: 0.2 })}
        />
        {/* Soft eye whites and dark pupils read as a face instead of two status lights. */}
        <group ref={eyeRef}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.125, 0.045, 0.405]} scale={[0.92, 1.2, 0.48]}
              geometry={sharedSphere(0.077, 14, 14)}
              material={sharedStandard({ color: metal, emissive: metal, emissiveIntensity: 0.35, roughness: 0.5 })} />
          ))}
          <group ref={gazeRef}>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.125, 0.04, 0.445]} scale={[0.8, 1.2, 0.4]}
                geometry={sharedSphere(0.039, 12, 12)}
                material={sharedStandard({ color: dark, roughness: 0.4 })} />
            ))}
          </group>
        </group>
        {/* A modest smile, flattened on a slump; no extra lights or post processing. */}
        <mesh ref={smileRef} position={[0, -0.055, 0.35]} rotation-z={Math.PI} scale={[1, 0.55, 1]}
          geometry={sharedTorus(0.075, 0.013, 6, 16, Math.PI)}
          material={sharedStandard({ color: dark, roughness: 0.5 })} />
        {/* antenna with a lit tip */}
        <group ref={antRef} position={[0, 0.32, 0]}>
          <mesh
            position={[0, 0.1, 0]}
            geometry={sharedCylinder(0.018, 0.018, 0.22, 8)}
            material={sharedStandard({ color: metal, metalness: 0.6, roughness: 0.3 })}
          />
          <mesh
            position={[0, 0.24, 0]}
            geometry={sharedSphere(0.055, 12, 12)}
            material={sharedStandard({
              color: moodColor ?? '#ff5a5a',
              emissive: moodColor ?? '#ff5a5a',
              emissiveIntensity: 1.4,
              toneMapped: false,
            })}
          />
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
const LazyGltfRobot = lazy(() => import('./gltfRobot.tsx'));

/** Falls back to the parametric robot if a registered .glb fails to load. */
class RobotBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
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
function CharacterPresence({
  personKey,
  seed,
  walking = false,
  still = false,
  children,
}: {
  personKey?: string;
  seed: number;
  walking?: boolean;
  still?: boolean;
  children: ReactNode;
}) {
  const grp = useRef<THREE.Group>(null);
  const work = useRef(0);
  const workWeek = useRef(-1);
  const workTo = useRef(0);
  const pose = useRef<LivePose>({ activity: 'thinking', roaming: false });
  useEffect(
    () => () => {
      if (personKey) clearPose(personKey);
    },
    [personKey],
  );
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
    work.current = still ? 0 : work.current + (workTo.current - work.current) * Math.min(1, dt * 1.6);

    pose.current.activity = work.current > 0.5 ? 'working' : 'thinking';
    pose.current.roaming = false;
    publishPose(personKey, pose.current);
  });
  return <group ref={grp}>{children}</group>;
}

/** A robot by colour index: uses a dropped-in .glb model when one exists (see robotModels.ts),
 *  otherwise the hand-built parametric robot. `clip` requests an animation by name (e.g. "Idle",
 *  "Sitting") — ignored if the model doesn't ship that clip. A blob shadow grounds the model. */
export function OfficeRobot({
  colorIdx,
  seed,
  moodColor,
  clip,
  walking = false,
  sitting = false,
  still = false,
  personKey,
  relaxing = false,
  watering = false,
  sitProgress,
  walkPose,
}: {
  colorIdx: number;
  seed: number;
  moodColor?: string;
  clip?: string;
  walking?: boolean;
  sitting?: boolean;
  still?: boolean;
  personKey?: string;
  relaxing?: boolean;
  watering?: boolean;
  sitProgress?: { current: number };
  walkPose?: { current: WalkPose };
}) {
  const parametric = (
    <RobotCharacter
      colorIdx={colorIdx}
      seed={seed}
      moodColor={moodColor}
      walking={walking}
      sitting={sitting}
      still={still}
      relaxing={relaxing}
      watering={watering}
      sitProgress={sitProgress}
      walkPose={walkPose}
    />
  );
  const model = robotModelFor(colorIdx);
  const body =
    !model || watering || relaxing ? (
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

type Phase = 'seated' | 'outbound' | 'hanging' | 'returning';

const WATER_SECONDS = 6;
const BREAK_SECONDS = 12;
const ARRIVE = 0.04;

/**
 * A robot out on the floor. With a `destinations` plan it is a commuter: the derived weekly away
 * plan sends it from its desk to an unoccupied destination spot, it hangs out there, and it walks
 * back after a timed activity — never two roamers at the same spot, never a desk left occupied.
 * Without a plan (`wander > 0`) it drifts around its home on a derived schedule (overflow hires).
 * `obstacles`/`bound` come from the Scene in world units so both scale with the facility.
 */
export function RoamingRobot({
  agent,
  agents = [],
  destinations,
  wander = 0,
  still = false,
  obstacles = ROAM_OBSTACLES,
  bound = ROAM_BOUND,
  onTap,
}: {
  agent: RoamAgent;
  agents?: readonly RoamAgent[];
  destinations?: readonly Destination[];
  wander?: number;
  still?: boolean;
  obstacles?: readonly Obstacle[];
  bound?: number;
  onTap?: () => void;
}) {
  const grp = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const sitProgress = useRef(0);
  const walkPose = useRef<WalkPose>({phase:0,weight:0});
  const nav = useMemo(
    () => [
      ...obstacles,
      ...agents.filter((a) => a.key !== agent.key).map((a) => ({ x: a.x, z: a.z, r: 0.25 })),
    ],
    [obstacles, agents, agent.key],
  );
  const st = useRef({
    x: agent.x,
    z: agent.z,
    face: agent.face,
    speed: 0,
    phase: 'seated' as Phase,
    week: -1,
    step: -1,
    route: [] as Point[],
    spot: null as AwaySpot | null,
    hang: 0,
    seatBlend: 0,
    scene: nav,
    retry: 0,
    blocked: 0,
  });
  const [shown, setShown] = useState(wander > 0);
  const [walking, setWalking] = useState(false);
  const [activity, setActivity] = useState<Destination['kind'] | null>(null);
  const live = useRef<LivePose>({ activity: 'walking', x: agent.x, z: agent.z, roaming: true });
  useEffect(() => () => clearPose(agent.key), [agent.key]);
  useFrame((f, delta) => {
    const s = st.current,
      dt = Math.min(delta, 0.05);
    const visibility = (v: boolean) => {
      if (shown !== v) setShown(v);
    };
    const stride = (v: boolean) => {
      if (walking !== v) setWalking(v);
    };
    const act = (v: Destination['kind'] | null) => {
      if (activity !== v) setActivity(v);
    };
    if (still) {
      if (!wander) {
        visibility(false);
        clearPose(agent.key);
        s.phase = 'seated';
        s.x = agent.x;
        s.z = agent.z;
        s.route = [];
        s.spot = null;
        s.seatBlend = 0;
        sitProgress.current = 0;
        act(null);
      }
      s.speed=0;walkPose.current.weight=0;
      stride(false);
      return;
    }
    const routeTo = (target: Point) => findOfficePath(s, target, nav, bound);
    // Editing unmounts commuters. A changed obstacle map in play invalidates the route; never
    // continue following stale waypoints through a newly placed object.
    if (s.scene !== nav) {
      s.scene = nav;
      if (s.phase === 'seated') {
        s.x=agent.x;s.z=agent.z;s.face=agent.face;s.speed=0;
      }
      if (s.phase !== 'seated') {
        const target = s.phase === 'returning' ? agent : s.spot;
        if (target) {
          const path = routeTo(target);
          s.route = path ?? [];
          if (!path) s.phase = 'returning';
        }
      }
    }
    const wk = officeWeek();
    if (s.phase === 'seated' && !wander && wk !== s.week) {
      s.week = wk;
      const plan = awayPlanFor(agents, officeSeed(), wk, destinations ?? [], (a, spot) =>
        reachableDestination(
          a,
          spot,
          [
            ...obstacles,
            ...agents
              .filter((other) => other.key !== a.key)
              .map((other) => ({ x: other.x, z: other.z, r: 0.25 })),
          ],
          bound,
        ),
      );
      const spot = plan.get(agent.key);
      // Reserve the actual resource, including a colleague still finishing last week's break.
      const occupied =
        spot?.resource &&
        agents.some((a) => a.key !== agent.key && poseFor(a.key)?.resource === spot.resource);
      if (
        spot &&
        !occupied &&
        agents.filter((a) => a.key !== agent.key && poseFor(a.key)?.roaming).length < MAX_AWAY
      ) {
        const path = routeTo(spot);
        if (path) {
          s.spot = spot;
          s.route = path;
          s.phase = 'outbound';
          s.hang = 0;
        }
      }
    }
    if (wander && !s.route.length) {
      const step = Math.floor((f.clock.elapsedTime + agent.seed) / 7);
      if (step !== s.step) {
        s.step = step;
        const hs = (officeSeed() ^ Math.imul(Math.round(agent.seed * 1000) + 1, 0x9e3779b1)) >>> 0,
          k = wk * 64 + step;
        const a = cosmeticHash01(hs, k, WANDER_ANGLE_SALT) * Math.PI * 2,
          r = Math.sqrt(cosmeticHash01(hs, k, WANDER_RADIUS_SALT)) * wander;
        s.route = routeTo({ x: agent.x + Math.cos(a) * r, z: agent.z + Math.sin(a) * r }) ?? [];
        s.phase = 'outbound';
      }
    }
    const facingActivity = !s.spot || Math.abs(angleDelta(grp.current?.rotation.y ?? s.face,s.spot.face)) < 0.12;
    if (s.phase === 'hanging') {
      if(facingActivity && (!s.spot?.seat || s.seatBlend===1))s.hang += dt;
      if (s.hang >= (s.spot?.kind === 'watering' ? WATER_SECONDS : BREAK_SECONDS)) {
        s.phase = 'returning';
        act(null);
      }
    }
    const seated = s.phase === 'hanging' && facingActivity && !!s.spot?.seat;
    s.seatBlend = Math.max(0, Math.min(1, s.seatBlend + (seated ? dt : -dt) * 1.5));
    sitProgress.current = s.seatBlend;
    s.retry = Math.max(0, s.retry - dt);
    if (s.phase === 'returning' && s.seatBlend === 0 && !s.route.length && s.retry === 0) {
      s.route = routeTo(agent) ?? [];
      s.retry = 1;
    }
    let moving = false;
    let travelled = 0;
    if (s.route.length && s.seatBlend === 0) {
      const next = s.route[0],
        dx = next.x - s.x,
        dz = next.z - s.z,
        d = Math.hypot(dx, dz);
      const motion=stepOfficeMotion(s,next,dt), nx=motion.x,nz=motion.z;
      // Yield to occupied space. No push-out displacement and no interpenetrating overtakes.
      const blocked = agents.some((a) => {
        if (a.key === agent.key) return false;
        const p = poseFor(a.key);
        return (
          p?.roaming &&
          p.x !== undefined &&
          p.z !== undefined &&
          Math.hypot(nx - p.x, nz - p.z) < 0.62
        );
      });
      if (blocked) {
        s.speed=0;
        s.blocked += dt;
        if (s.blocked >= 1) {
          s.blocked = 0;
          const peers = agents.flatMap((a) => {
            const p = a.key !== agent.key ? poseFor(a.key) : undefined;
            return p?.roaming && p.x !== undefined && p.z !== undefined
              ? [{ x: p.x, z: p.z, r: 0.34 }]
              : [];
          });
          const target = s.phase === 'returning' ? agent : s.spot;
          const detour = target ? findOfficePath(s, target, [...nav, ...peers], bound) : null;
          if (detour) s.route = detour;
          else if (
            s.phase === 'outbound' &&
            agents.some((a) => a.key < agent.key && poseFor(a.key)?.roaming)
          ) {
            const back = findOfficePath(s, agent, [...nav, ...peers], bound);
            if (back) {
              s.phase = 'returning';
              s.route = back;
            }
          }
        }
      } else {
        s.blocked = 0;
        s.x = nx;
        s.z = nz;
        s.face = motion.face;
        s.speed = motion.speed;
        travelled=motion.distance;
        moving = travelled > 1e-7;
        if (d <= travelled + 1e-6) s.route.shift();
      }
    }
    if (!s.route.length && s.seatBlend === 0) {
      if (s.phase === 'outbound' && s.spot && Math.hypot(s.x - s.spot.x, s.z - s.spot.z) < ARRIVE) {
        s.phase = 'hanging';
        s.face = s.spot.face;
        s.hang = 0;
      }
      if (s.phase === 'returning' && Math.hypot(s.x - agent.x, s.z - agent.z) < ARRIVE) {
        s.phase = 'seated';
        s.spot = null;
      }
    }
    if(!moving)s.speed=0;
    updateWalkPose(walkPose.current,travelled,dt);
    visibility(!!wander || s.phase !== 'seated');
    stride(moving);
    act(s.phase === 'hanging' && facingActivity ? (s.spot?.kind ?? null) : null);
    if (grp.current) {
      grp.current.userData.activity = s.phase === 'hanging' ? s.spot?.kind : s.phase;
      grp.current.userData.resource = s.spot?.resource;
      grp.current.position.set(s.x, 0, s.z);
      const diff = ((s.face - grp.current.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      grp.current.rotation.y += diff * (s.route.length ? 1 : 1-Math.exp(-6*dt));
    }
    if (body.current) {
      const seat = s.spot?.seat,
        b = s.seatBlend;
      // Local displacement into/out of the reserved cushion; never used as a navigation shortcut.
      const dx = seat ? seat.x - s.x : 0,
        dz = seat ? seat.z - s.z : 0,
        yaw = grp.current?.rotation.y ?? 0;
      body.current.position.set(
        (Math.cos(yaw) * dx - Math.sin(yaw) * dz) * b,
        seat ? (robotSeatLift(sofaSeatSurface()) - SIT_LIFT) * b : 0,
        (Math.sin(yaw) * dx + Math.cos(yaw) * dz) * b,
      );
    }
    if (s.phase === 'seated' && !wander) clearPose(agent.key);
    else {
      live.current.activity =
        s.phase === 'hanging' && facingActivity && s.spot ? s.spot.kind : moving ? 'walking' : 'thinking';
      live.current.x = s.x + (s.spot?.seat ? (s.spot.seat.x - s.x) * s.seatBlend : 0);
      live.current.z = s.z + (s.spot?.seat ? (s.spot.seat.z - s.z) * s.seatBlend : 0);
      live.current.resource = s.spot?.resource;
      publishPose(agent.key, live.current);
    }
  });
  return (
    <group ref={grp} name={`employee-${agent.key}`} onClick={onTap ? (event) => { event.stopPropagation(); onTap(); } : undefined}>
      <group ref={body}>
        {shown && (
          <OfficeRobot
            colorIdx={agent.colorIdx}
            seed={agent.seed}
            clip={walking ? 'Walking' : activity === 'relaxing' ? 'Sitting' : 'Idle'}
            walking={walking}
            sitting={activity === 'relaxing'}
            relaxing={activity === 'relaxing'}
            watering={activity === 'watering'}
            sitProgress={sitProgress}
            walkPose={walkPose}
            still={still}
          />
        )}
      </group>
    </group>
  );
}
