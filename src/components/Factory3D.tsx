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

/* palette — intrinsic object colours, the garage3d precedent */
const C = {
  grass: "#1d2b22",
  pad: "#2a2f37",
  beltBed: "#454c57",
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
  onContextLost?: () => void;
}

/* ------------------------- the production path (S-line) ------------------------- */
/* A(-6.5,-3) →E B(5.5,-3) →S C(5.5,0) →W D(-5.5,0) →S E(-5.5,3) →E F(6.5,3) */
const PATH: [number, number][] = [[-6.5, -3], [5.5, -3], [5.5, 0], [-5.5, 0], [-5.5, 3], [6.5, 3]];
const SEGS = PATH.slice(0, -1).map((p, i) => {
  const q = PATH[i + 1];
  return { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) };
});
const PATH_LEN = SEGS.reduce((a, s) => a + s.len, 0); // 41

function pathAt(t: number): [number, number] {
  let d = ((t % PATH_LEN) + PATH_LEN) % PATH_LEN;
  for (const s of SEGS) {
    if (d <= s.len) {
      const f = d / s.len;
      return [s.p[0] + (s.q[0] - s.p[0]) * f, s.p[1] + (s.q[1] - s.p[1]) * f];
    }
    d -= s.len;
  }
  return PATH[0];
}

/* Arc positions of the stations along the line (measured on the path above). */
const S_PRESS = 6.5;   // (0,-3)
const S_ARMS = 20.5;   // (0, 0)
const S_QA = 32.5;     // (-2, 3)
/* Item form by progress along the line: slab → board → device → crate. */
function formAt(t: number): 0 | 1 | 2 | 3 {
  if (t < S_PRESS) return 0;
  if (t < S_ARMS) return 1;
  if (t < S_QA) return 2;
  return 3;
}

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

function Belts() {
  const rollers = useMemo(() => {
    const out: { x: number; z: number; horiz: boolean }[] = [];
    for (let t = 0.5; t < PATH_LEN; t += 1.0) {
      const [x, z] = pathAt(t);
      const [x2] = pathAt(Math.min(t + 0.01, PATH_LEN - 0.01));
      out.push({ x, z, horiz: Math.abs(x2 - x) > 0.001 });
    }
    return out;
  }, []);
  return (
    <group>
      {SEGS.map((s, i) => {
        const cx = (s.p[0] + s.q[0]) / 2;
        const cz = (s.p[1] + s.q[1]) / 2;
        const horiz = s.p[1] === s.q[1];
        const L = s.len + 0.8;
        return (
          <group key={i} position={[cx, 0, cz]}>
            {/* bed */}
            <RoundedBox args={[horiz ? L : 0.9, 0.3, horiz ? 0.9 : L]} radius={0.06} position={[0, 0.2, 0]} castShadow receiveShadow>
              <meshStandardMaterial color={C.beltBed} roughness={0.8} metalness={0.15} />
            </RoundedBox>
            {/* side rails */}
            {[-0.42, 0.42].map((off) => (
              <mesh key={off} position={horiz ? [0, 0.42, off] : [off, 0.42, 0]} castShadow>
                <boxGeometry args={horiz ? [L, 0.1, 0.06] : [0.06, 0.1, L]} />
                <meshStandardMaterial color={C.rail} roughness={0.5} metalness={0.4} />
              </mesh>
            ))}
            {/* legs */}
            {Array.from({ length: Math.max(2, Math.round(s.len / 3)) }, (_, k) => {
              const f = (k + 0.5) / Math.max(2, Math.round(s.len / 3));
              const lx = s.p[0] + (s.q[0] - s.p[0]) * f;
              const lz = s.p[1] + (s.q[1] - s.p[1]) * f;
              return (
                <mesh key={k} position={[lx - cx, 0.08, lz - cz]}>
                  <boxGeometry args={[0.14, 0.16, 0.14]} />
                  <meshStandardMaterial color={C.dark} roughness={0.9} />
                </mesh>
              );
            })}
          </group>
        );
      })}
      {/* rollers along the whole line */}
      {rollers.map((r, i) => (
        <mesh key={i} position={[r.x, 0.37, r.z]} rotation={r.horiz ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.72, 10]} />
          <meshStandardMaterial color={C.roller} roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/* The product, in its four forms — one group per traveling item, form toggled by visibility. */
function TravelingItem({ index, itemsT }: { index: number; itemsT: React.MutableRefObject<number[]> }) {
  const grp = useRef<THREE.Group>(null);
  const forms = useRef<THREE.Group[]>([]);
  useFrame(() => {
    const t = itemsT.current[index];
    if (t == null || !grp.current) return;
    const [x, z] = pathAt(t);
    grp.current.position.set(x, 0.46, z);
    const f = formAt(t);
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
      {/* 2 — the device (emissive screen) */}
      <group ref={(g) => { if (g) forms.current[2] = g; }}>
        <RoundedBox args={[0.3, 0.07, 0.56]} radius={0.03} castShadow>
          <meshStandardMaterial color={C.device} roughness={0.35} metalness={0.4} />
        </RoundedBox>
        <mesh position={[0, 0.045, 0]}>
          <boxGeometry args={[0.24, 0.01, 0.48]} />
          <meshStandardMaterial color={C.screen} emissive={C.screen} emissiveIntensity={0.9} roughness={0.3} />
        </mesh>
      </group>
      {/* 3 — boxed crate */}
      <group ref={(g) => { if (g) forms.current[3] = g; }}>
        <RoundedBox args={[0.44, 0.36, 0.44]} radius={0.04} castShadow>
          <meshStandardMaterial color={C.crate} roughness={0.8} />
        </RoundedBox>
        <mesh position={[0, 0, 0]}><boxGeometry args={[0.46, 0.07, 0.46]} /><meshStandardMaterial color={C.hazard} roughness={0.7} /></mesh>
      </group>
    </group>
  );
}

/* ------------------------------- machines ------------------------------- */

function HotLight({ on, y = 2.4 }: { on: boolean; y?: number }) {
  return on ? <pointLight position={[0, y, 0]} intensity={9} distance={4.2} color={C.accent} /> : null;
}

/** Intake hopper — raw material funnels onto the line (Sourcing). */
function Intake({ hot }: { hot: boolean }) {
  const puff = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!puff.current) return;
    const f = (clock.elapsedTime % 1.4) / 1.4;
    puff.current.position.y = 1.7 - f * 0.9;
    (puff.current.material as THREE.MeshStandardMaterial).opacity = 0.75 * (1 - f);
  });
  return (
    <group position={[-6.5, 0, -3]}>
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
function GantryPress({ active, hot }: { active: boolean; hot: boolean }) {
  const ram = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ram.current) return;
    const t = clock.elapsedTime * (active ? 2.0 : 0);
    const cycle = Math.max(0, Math.sin(t)) ** 6; // sharp stamp, long dwell
    ram.current.position.y = 1.55 - cycle * 0.75;
  });
  return (
    <group position={[0, 0, -3]}>
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
function RobotArm({ active, hot, position, mirror = false, phase = 0 }: {
  active: boolean; hot: boolean; position: [number, number, number]; mirror?: boolean; phase?: number;
}) {
  const yaw = useRef<THREE.Group>(null);
  const shoulder = useRef<THREE.Group>(null);
  const elbow = useRef<THREE.Group>(null);
  const wrist = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * (active ? 1 : 0.15) + phase;
    if (yaw.current) yaw.current.rotation.y = (mirror ? -1 : 1) * (Math.sin(t * 0.8) * 0.7);
    if (shoulder.current) shoulder.current.rotation.x = -0.5 + Math.sin(t * 1.6) * 0.28;
    if (elbow.current) elbow.current.rotation.x = 1.15 + Math.sin(t * 1.6 + 1.2) * 0.35;
    if (wrist.current) wrist.current.rotation.x = -0.6 + Math.sin(t * 3.2) * 0.2;
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
function QaTunnel({ active, hot }: { active: boolean; hot: boolean }) {
  const beam = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!beam.current) return;
    beam.current.position.x = Math.sin(clock.elapsedTime * (active ? 2.6 : 0.4)) * 0.55;
  });
  return (
    <group position={[-2, 0, 3]}>
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
function Packer({ active, hot }: { active: boolean; hot: boolean }) {
  const l = useRef<THREE.Mesh>(null);
  const r = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const c = active ? (Math.sin(clock.elapsedTime * 2.4) + 1) / 2 : 0.15;
    if (l.current) l.current.rotation.z = -0.2 - c * 0.9;
    if (r.current) r.current.rotation.z = 0.2 + c * 0.9;
  });
  return (
    <group position={[4.6, 0, 3]}>
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
  cam.fov = portrait ? 50 : 28;
  if (portrait) cam.position.set(11.2, 15.6, 12.4);
  else cam.position.set(10.0, 12.5, 11.0);
  cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix();
  return null;
}

function Scene(p: Factory3DProps) {
  const { size } = useThree();
  const portrait = size.height > size.width;
  const itemsT = useRef<number[]>([0, PATH_LEN * 0.25, PATH_LEN * 0.5, PATH_LEN * 0.75]);
  useFrame((_, dt) => {
    if (!p.active) return;
    const v = (p.overtime ? 2.1 : 1.25) * dt;
    itemsT.current = itemsT.current.map((t) => (t + v) % PATH_LEN);
  });
  return (
    <group rotation={[0, portrait ? Math.PI / 2 : 0, 0]}>
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
      {/* dock road along the east edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8.6, 0.001, 0]} receiveShadow>
        <planeGeometry args={[1.9, 30]} />
        <meshStandardMaterial color={C.road} roughness={0.95} />
      </mesh>

      <Belts />
      {[0, 1, 2, 3].map((i) => <TravelingItem key={i} index={i} itemsT={itemsT} />)}

      {/* the line, in real stage order */}
      <Intake hot={p.stageIdx === 0} />
      <GantryPress active={p.active} hot={p.stageIdx === 1} />
      <RobotArm active={p.active} hot={p.stageIdx === 2} position={[-0.2, 0, -1.2]} phase={0} />
      <RobotArm active={p.active} hot={p.stageIdx === 2} position={[0.6, 0, 1.15]} mirror phase={1.7} />
      <QaTunnel active={p.active} hot={p.stageIdx === 3} />
      <Packer active={p.active} hot={p.stageIdx === 4} />

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
