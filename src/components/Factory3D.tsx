// Factory Mode's 3D floor — the top-down tile factory rendered with the same three.js/r3f
// stack, perf discipline and parametric-primitives approach as the 3D office (garage3d):
// lazy-loaded so three stays in its own chunk, DPR capped, context-loss downgrade to the SVG
// map. Camera is a high, tilted tycoon view over a tile pad; machines are primitive rigs
// animated in useFrame, gated on the live sim (active/stage/overtime), zero image assets.
import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

/* palette — intrinsic object colours, the garage3d precedent */
const C = {
  grass: "#1d2b22",
  pad: "#2a2f37",
  belt: "#4a515c",
  beltTop: "#383e47",
  lane: "#e0a83c",
  machine: "#3f4754",
  machineTop: "#4a5362",
  accent: "#3b82f6",
  amber: "#f59e0b",
  crate: "#b98a3a",
  truck: "#d7dade",
  cab: "#3b82f6",
  agv: "#5ea0f8",
  road: "#2e333b",
};

export interface Factory3DProps {
  active: boolean;
  stageIdx: number;   // -1 none · 1 tooling · 2 assembly · 3 qa · 4 packaging
  robotTier: number;
  readyCount: number;
  selling: boolean;
  overtime: boolean;
  onContextLost?: () => void;
}

/* The conveyor loop in plan coordinates (a rectangle), used by belts, items and AGVs. */
const LOOP: [number, number][] = [[-4.5, -2], [4.5, -2], [4.5, 2], [-4.5, 2]];
const SEGMENTS = LOOP.map((p, i) => {
  const q = LOOP[(i + 1) % LOOP.length];
  return { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) };
});
const LOOP_LEN = SEGMENTS.reduce((a, s) => a + s.len, 0);

/** Point on the loop at arc-length t (wraps). */
function loopAt(t: number): [number, number] {
  let d = ((t % LOOP_LEN) + LOOP_LEN) % LOOP_LEN;
  for (const s of SEGMENTS) {
    if (d <= s.len) {
      const f = d / s.len;
      return [s.p[0] + (s.q[0] - s.p[0]) * f, s.p[1] + (s.q[1] - s.p[1]) * f];
    }
    d -= s.len;
  }
  return LOOP[0];
}

function Belts() {
  return (
    <group>
      {SEGMENTS.map((s, i) => {
        const cx = (s.p[0] + s.q[0]) / 2;
        const cz = (s.p[1] + s.q[1]) / 2;
        const horiz = s.p[1] === s.q[1];
        return (
          <group key={i} position={[cx, 0.14, cz]}>
            <RoundedBox args={[horiz ? s.len + 0.7 : 0.7, 0.22, horiz ? 0.7 : s.len + 0.7]} radius={0.08} castShadow receiveShadow>
              <meshStandardMaterial color={C.belt} roughness={0.85} />
            </RoundedBox>
            <mesh position={[0, 0.12, 0]}>
              <boxGeometry args={[horiz ? s.len + 0.55 : 0.5, 0.02, horiz ? 0.5 : s.len + 0.55]} />
              <meshStandardMaterial color={C.beltTop} roughness={0.95} />
            </mesh>
            <mesh position={[0, 0.14, 0]}>
              <boxGeometry args={[horiz ? s.len + 0.4 : 0.08, 0.015, horiz ? 0.08 : s.len + 0.4]} />
              <meshStandardMaterial color={C.lane} emissive={C.lane} emissiveIntensity={0.5} roughness={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Crates riding the loop while a run is live (speed doubles-ish on overtime). */
function BeltItems({ active, overtime }: { active: boolean; overtime: boolean }) {
  const refs = useRef<THREE.Group[]>([]);
  const t0 = useRef(0);
  useFrame((_, dt) => {
    if (!active) return;
    t0.current += dt * (overtime ? 2.2 : 1.3);
    refs.current.forEach((g, i) => {
      if (!g) return;
      const [x, z] = loopAt(t0.current + (i * LOOP_LEN) / 3);
      g.position.set(x, 0.38, z);
    });
  });
  if (!active) return null;
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <group key={i} ref={(g) => { if (g) refs.current[i] = g; }}>
          <RoundedBox args={[0.42, 0.3, 0.42]} radius={0.05} castShadow>
            <meshStandardMaterial color={C.crate} roughness={0.8} />
          </RoundedBox>
        </group>
      ))}
    </group>
  );
}

/** Shared machine chassis: rounded body on a plinth; hot = accent emissive + point light. */
function Chassis({ hot, w = 1.5, h = 1.0, children }: { hot: boolean; w?: number; h?: number; children?: React.ReactNode }) {
  return (
    <group>
      <RoundedBox args={[w, h, w]} radius={0.12} position={[0, h / 2 + 0.05, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={C.machine} roughness={0.7} emissive={hot ? C.accent : "#000000"} emissiveIntensity={hot ? 0.25 : 0} />
      </RoundedBox>
      <mesh position={[0, h + 0.08, 0]}>
        <boxGeometry args={[w * 0.86, 0.06, w * 0.86]} />
        <meshStandardMaterial color={C.machineTop} roughness={0.6} />
      </mesh>
      {hot && <pointLight position={[0, h + 0.7, 0]} intensity={6} distance={3.2} color={C.accent} />}
      {children}
    </group>
  );
}

function Assembler({ active, hot, position }: { active: boolean; hot: boolean; position: [number, number, number] }) {
  const piston = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (piston.current) piston.current.position.y = 1.35 + (active ? Math.abs(Math.sin(clock.elapsedTime * 2.2)) * -0.28 : 0);
  });
  return (
    <group position={position}>
      <Chassis hot={hot}>
        <mesh ref={piston} position={[0, 1.35, 0]} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color={C.accent} roughness={0.5} />
        </mesh>
      </Chassis>
    </group>
  );
}

function RobotArm({ active, hot, position }: { active: boolean; hot: boolean; position: [number, number, number] }) {
  const shoulder = useRef<THREE.Group>(null);
  const elbow = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (shoulder.current) shoulder.current.rotation.y = active ? Math.sin(t * 0.9) * 1.1 : 0.4;
    if (elbow.current) elbow.current.rotation.z = active ? -0.7 + Math.sin(t * 1.8) * 0.35 : -0.55;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.65, 0.4, 24]} />
        <meshStandardMaterial color={C.machine} roughness={0.7} emissive={hot ? C.accent : "#000000"} emissiveIntensity={hot ? 0.25 : 0} />
      </mesh>
      <group ref={shoulder} position={[0, 0.4, 0]}>
        <group ref={elbow}>
          <mesh position={[0, 0.7, 0]} castShadow>
            <boxGeometry args={[0.22, 1.4, 0.22]} />
            <meshStandardMaterial color={C.amber} roughness={0.55} />
          </mesh>
          <mesh position={[0.35, 1.35, 0]} rotation={[0, 0, -1.1]} castShadow>
            <boxGeometry args={[0.18, 0.9, 0.18]} />
            <meshStandardMaterial color={C.amber} roughness={0.55} />
          </mesh>
          <mesh position={[0.62, 1.62, 0]} castShadow>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial color={C.machineTop} roughness={0.4} />
          </mesh>
        </group>
      </group>
      {hot && <pointLight position={[0, 2.2, 0]} intensity={6} distance={3.2} color={C.accent} />}
    </group>
  );
}

function QaGate({ active, hot, position }: { active: boolean; hot: boolean; position: [number, number, number] }) {
  const beam = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (beam.current) {
      beam.current.position.y = 0.55 + (active ? (Math.sin(clock.elapsedTime * 2.4) * 0.3 + 0.3) : 0.3);
      (beam.current.material as THREE.MeshStandardMaterial).opacity = active ? 0.55 : 0.2;
    }
  });
  return (
    <group position={position}>
      {[-0.55, 0.55].map((dx) => (
        <mesh key={dx} position={[dx, 0.7, 0]} castShadow>
          <boxGeometry args={[0.22, 1.4, 0.22]} />
          <meshStandardMaterial color={C.machine} roughness={0.7} emissive={hot ? C.accent : "#000000"} emissiveIntensity={hot ? 0.3 : 0} />
        </mesh>
      ))}
      <mesh position={[0, 1.45, 0]} castShadow>
        <boxGeometry args={[1.35, 0.22, 0.3]} />
        <meshStandardMaterial color={C.machineTop} roughness={0.6} />
      </mesh>
      <mesh ref={beam} position={[0, 0.85, 0]}>
        <boxGeometry args={[1.1, 0.04, 0.5]} />
        <meshStandardMaterial color={C.accent} transparent opacity={0.4} emissive={C.accent} emissiveIntensity={1.4} />
      </mesh>
      {hot && <pointLight position={[0, 2, 0]} intensity={6} distance={3.2} color={C.accent} />}
    </group>
  );
}

function CrateStacks({ count, packing }: { count: number; packing: boolean }) {
  const grp = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (grp.current) grp.current.position.y = packing ? Math.abs(Math.sin(clock.elapsedTime * 2.5)) * 0.08 : 0;
  });
  const stacks = Math.max(0, Math.min(4, count));
  return (
    <group ref={grp} position={[-4.6, 0, 3.6]}>
      {Array.from({ length: Math.max(1, stacks) }, (_, i) => (
        <group key={i} position={[(i % 2) * 0.85, 0, Math.floor(i / 2) * 0.85]}>
          {[0, 1].slice(0, stacks > 0 ? 2 : 1).map((lvl) => (
            <RoundedBox key={lvl} args={[0.7, 0.5, 0.7]} radius={0.06} position={[0, 0.3 + lvl * 0.55, 0]} castShadow receiveShadow>
              <meshStandardMaterial color={C.crate} roughness={0.8} transparent={stacks === 0} opacity={stacks === 0 ? 0.3 : 1} />
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
    if (grp.current && selling) grp.current.position.y = Math.sin(clock.elapsedTime * 3) * 0.03;
  });
  return (
    <group ref={grp} position={[6.4, 0, 1.2]} rotation={[0, Math.PI / 2, 0]}>
      <RoundedBox args={[2.2, 1.05, 0.95]} radius={0.08} position={[-0.4, 0.75, 0]} castShadow>
        <meshStandardMaterial color={C.truck} roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[0.75, 0.8, 0.9]} radius={0.1} position={[1.25, 0.62, 0]} castShadow>
        <meshStandardMaterial color={C.cab} roughness={0.5} />
      </RoundedBox>
      {[[-1.1, 0], [0.25, 0], [1.25, 0]].map(([wx], i) => (
        <group key={i}>
          <mesh position={[wx, 0.26, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.26, 0.26, 0.16, 20]} />
            <meshStandardMaterial color="#15181d" roughness={0.9} />
          </mesh>
          <mesh position={[wx, 0.26, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.26, 0.26, 0.16, 20]} />
            <meshStandardMaterial color="#15181d" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Agvs({ tier, overtime }: { tier: number; overtime: boolean }) {
  const refs = useRef<THREE.Group[]>([]);
  const t0 = useRef(LOOP_LEN / 2);
  useFrame((_, dt) => {
    t0.current += dt * 0.85;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const [x, z] = loopAt(-(t0.current + (i * LOOP_LEN) / 3));
      g.position.set(x * 1.24, 0.16, z * 1.45); // patrol just outside the loop
    });
  });
  const n = Math.max(0, Math.min(3, tier));
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} ref={(g) => { if (g) refs.current[i] = g; }}>
          <RoundedBox args={[0.5, 0.24, 0.36]} radius={0.08} castShadow>
            <meshStandardMaterial color={C.agv} roughness={0.5} />
          </RoundedBox>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshStandardMaterial color={overtime ? C.amber : "#34d399"} emissive={overtime ? C.amber : "#34d399"} emissiveIntensity={1.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Portrait phones can't frame a wide pad at a cinematic fov — so on portrait the WORLD
 *  rotates 90° (long axis into the screen depth) and the camera opens up + pulls back. */
function FitCamera() {
  const { camera, size } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const portrait = size.height > size.width;
  cam.fov = portrait ? 46 : 27;
  if (portrait) cam.position.set(9.6, 13.5, 10.8);
  else cam.position.set(9.5, 12.0, 10.5);
  cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix();
  return null;
}

function Scene(p: Factory3DProps) {
  const grid = useMemo(() => new THREE.Color("#3a4048"), []);
  const { size } = useThree();
  const portrait = size.height > size.width;
  return (
    <group rotation={[0, portrait ? Math.PI / 2 : 0, 0]}>
      <ambientLight intensity={0.85} />
      <directionalLight position={[7, 12, 5]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 6, 0]} intensity={p.overtime ? 30 : 18} distance={16} color={p.overtime ? C.amber : "#ffffff"} />

      {/* grounds */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[40, 30]} />
        <meshStandardMaterial color={C.grass} roughness={1} />
      </mesh>
      <RoundedBox args={[14.6, 0.14, 9.6]} radius={0.15} position={[0, 0.02, 0]} receiveShadow>
        <meshStandardMaterial color={C.pad} roughness={0.95} />
      </RoundedBox>
      <gridHelper args={[14, 14, grid, grid]} position={[0, 0.1, 0]} />
      {/* dock road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6.6, 0.1, 0]} receiveShadow>
        <planeGeometry args={[1.6, 9.6]} />
        <meshStandardMaterial color={C.road} roughness={0.95} />
      </mesh>

      <Belts />
      <BeltItems active={p.active} overtime={p.overtime} />

      <Assembler active={p.active} hot={p.stageIdx === 1} position={[-2.6, 0, 0]} />
      <RobotArm active={p.active} hot={p.stageIdx === 2} position={[0, 0, 0]} />
      <QaGate active={p.active} hot={p.stageIdx === 3} position={[2.6, 0, 0]} />
      <CrateStacks count={p.readyCount} packing={p.active && p.stageIdx === 4} />
      <Truck selling={p.selling} />
      <Agvs tier={p.robotTier} overtime={p.overtime} />

      <ContactShadows position={[0, 0.11, 0]} opacity={0.5} scale={22} blur={2.2} far={4} frames={60} />
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
      camera={{ position: [8.5, 11.5, 9.5], fov: 26 }}
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
