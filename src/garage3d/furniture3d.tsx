// Parametric 3D renderers for each placeable furniture item. Pure primitives, zero assets.
// Every piece is modelled centred on the origin, resting on the floor (y=0 up), sized to its
// grid footprint so the placement wrapper just sets position + Y-rotation.
import { Component, Suspense, lazy, memo, useRef, type ReactNode } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { FurnitureId } from "../engine/furniture.ts";
import { GRID, FURNITURE } from "../engine/furniture.ts";
import { modelFor } from "./furnitureModels.ts";
import type { RoomPalette } from "./palette.ts";

const C = GRID.cell; // ≈0.86m per cell

// fabric / accent tones (theme-stable)
const FABRIC = "#5b6573";
const FABRIC_2 = "#6f7a89";
const WOOD = "#9c6b43";
const BOOKS = ["#3b82f6", "#1eb877", "#f59e0b", "#ef4444", "#8b5cf6"];

function Desk({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.12, 0.06, C - 0.12]} radius={0.02} smoothness={2} position={[0, 0.74, 0]}>
        <meshStandardMaterial color={p.desk} roughness={0.6} />
      </RoundedBox>
      {([[-w / 2 + 0.18, -C / 2 + 0.16], [w / 2 - 0.18, -C / 2 + 0.16], [-w / 2 + 0.18, C / 2 - 0.16], [w / 2 - 0.18, C / 2 - 0.16]] as const).map((l, i) => (
        <mesh key={i} position={[l[0], 0.37, l[1]]}>
          <boxGeometry args={[0.08, 0.74, 0.08]} />
          <meshStandardMaterial color={p.deskDark} />
        </mesh>
      ))}
      {/* A real workstation: a large monitor on a stand, keyboard + mouse, and a mug — so even the
          starter desk clearly reads as "a computer", not a bare table. */}
      <group position={[0.12, 0.78, -0.18]}>
        {/* stand: neck + foot */}
        <mesh position={[0, 0.12, 0]}><boxGeometry args={[0.07, 0.24, 0.05]} /><meshStandardMaterial color={p.metalDark} metalness={0.4} /></mesh>
        <mesh position={[0, 0.02, 0.04]}><boxGeometry args={[0.24, 0.02, 0.14]} /><meshStandardMaterial color={p.metalDark} metalness={0.4} /></mesh>
        {/* screen — larger + brighter than before */}
        <mesh position={[0, 0.38, 0]}><boxGeometry args={[0.7, 0.42, 0.04]} /><meshStandardMaterial color={p.metalDark} /></mesh>
        <mesh position={[0, 0.38, 0.023]}><planeGeometry args={[0.64, 0.36]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={1.35} toneMapped={false} /></mesh>
      </group>
      {/* keyboard + mouse on the desktop */}
      <mesh position={[-0.14, 0.785, 0.12]}><boxGeometry args={[0.46, 0.03, 0.17]} /><meshStandardMaterial color="#2a2f37" roughness={0.6} /></mesh>
      <mesh position={[0.2, 0.785, 0.14]}><boxGeometry args={[0.08, 0.03, 0.11]} /><meshStandardMaterial color="#2a2f37" roughness={0.6} /></mesh>
      {/* a coffee mug for life */}
      <mesh position={[-0.44, 0.83, 0.0]}><cylinderGeometry args={[0.05, 0.045, 0.11, 12]} /><meshStandardMaterial color="#c9743a" roughness={0.7} /></mesh>
    </group>
  );
}

function DeskL({ p }: { p: RoomPalette }) {
  const a = 2 * C;
  return (
    <group>
      <RoundedBox args={[a - 0.12, 0.06, C - 0.1]} radius={0.02} position={[0, 0.74, -C / 2 + 0.04]}>
        <meshStandardMaterial color={p.desk} roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[C - 0.1, 0.06, a - 0.12]} radius={0.02} position={[-a / 2 + C / 2, 0.74, C / 2 - 0.04]}>
        <meshStandardMaterial color={p.desk} roughness={0.6} />
      </RoundedBox>
      {([[-a / 2 + 0.15, -C + 0.2], [a / 2 - 0.15, -C + 0.2], [-a / 2 + 0.15, C - 0.2]] as const).map((l, i) => (
        <mesh key={i} position={[l[0], 0.37, l[1]]}><boxGeometry args={[0.08, 0.74, 0.08]} /><meshStandardMaterial color={p.deskDark} /></mesh>
      ))}
      <group position={[0.25, 0.78, -C / 2 - 0.18]}>
        <mesh position={[0, 0.4, 0]}><boxGeometry args={[0.6, 0.36, 0.04]} /><meshStandardMaterial color={p.metalDark} /></mesh>
        <mesh position={[0, 0.4, 0.022]}><planeGeometry args={[0.54, 0.3]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={1.1} toneMapped={false} /></mesh>
        <mesh position={[0, 0.18, 0]}><boxGeometry args={[0.05, 0.3, 0.05]} /><meshStandardMaterial color={p.metalDark} /></mesh>
      </group>
    </group>
  );
}

function Chair({ p, hue = FABRIC }: { p: RoomPalette; hue?: string }) {
  return (
    <group>
      <RoundedBox args={[0.46, 0.1, 0.46]} radius={0.05} position={[0, 0.5, 0]}><meshStandardMaterial color={hue} roughness={0.7} /></RoundedBox>
      <RoundedBox args={[0.46, 0.5, 0.1]} radius={0.05} position={[0, 0.78, -0.2]}><meshStandardMaterial color={hue} roughness={0.7} /></RoundedBox>
      <mesh position={[0, 0.28, 0]}><cylinderGeometry args={[0.04, 0.04, 0.4, 8]} /><meshStandardMaterial color={p.metalDark} metalness={0.5} /></mesh>
      <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.24, 0.26, 0.05, 5]} /><meshStandardMaterial color={p.metalDark} metalness={0.5} /></mesh>
    </group>
  );
}

function Armchair({ hue = FABRIC_2 }: { hue?: string }) {
  return (
    <group>
      <RoundedBox args={[0.6, 0.26, 0.58]} radius={0.08} position={[0, 0.26, 0]}><meshStandardMaterial color={hue} roughness={0.8} /></RoundedBox>
      <RoundedBox args={[0.6, 0.5, 0.14]} radius={0.08} position={[0, 0.5, -0.24]}><meshStandardMaterial color={hue} roughness={0.8} /></RoundedBox>
      {[-0.3, 0.3].map((x, i) => (
        <RoundedBox key={i} args={[0.12, 0.32, 0.56]} radius={0.06} position={[x, 0.36, 0]}><meshStandardMaterial color={hue} roughness={0.8} /></RoundedBox>
      ))}
    </group>
  );
}

function Sofa({ hue = FABRIC }: { hue?: string }) {
  const w = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.1, 0.26, C - 0.06]} radius={0.08} position={[0, 0.26, 0.04]}><meshStandardMaterial color={hue} roughness={0.85} /></RoundedBox>
      <RoundedBox args={[w - 0.1, 0.46, 0.16]} radius={0.08} position={[0, 0.5, -C / 2 + 0.08]}><meshStandardMaterial color={hue} roughness={0.85} /></RoundedBox>
      {[-w / 2 + 0.12, w / 2 - 0.12].map((x, i) => (
        <RoundedBox key={i} args={[0.16, 0.4, C - 0.04]} radius={0.07} position={[x, 0.42, 0.04]}><meshStandardMaterial color={hue} roughness={0.85} /></RoundedBox>
      ))}
      {[-w / 4, w / 4].map((x, i) => (
        <RoundedBox key={i} args={[w / 2 - 0.24, 0.12, C - 0.18]} radius={0.05} position={[x, 0.42, 0.06]}><meshStandardMaterial color={FABRIC_2} roughness={0.8} /></RoundedBox>
      ))}
    </group>
  );
}

function CoffeeTable({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.2, 0.06, C - 0.14]} radius={0.03} position={[0, 0.36, 0]}><meshStandardMaterial color={p.desk} roughness={0.5} /></RoundedBox>
      {([[-w / 2 + 0.18, -C / 2 + 0.18], [w / 2 - 0.18, -C / 2 + 0.18], [-w / 2 + 0.18, C / 2 - 0.18], [w / 2 - 0.18, C / 2 - 0.18]] as const).map((l, i) => (
        <mesh key={i} position={[l[0], 0.18, l[1]]}><boxGeometry args={[0.06, 0.36, 0.06]} /><meshStandardMaterial color={p.deskDark} /></mesh>
      ))}
      <mesh position={[0.2, 0.42, 0]}><boxGeometry args={[0.3, 0.04, 0.22]} /><meshStandardMaterial color={BOOKS[0]} roughness={0.6} /></mesh>
      <mesh position={[-0.25, 0.46, 0.04]}><cylinderGeometry args={[0.07, 0.08, 0.16, 10]} /><meshStandardMaterial color={p.plant} roughness={0.8} /></mesh>
    </group>
  );
}

function MeetingTable({ p }: { p: RoomPalette }) {
  const w = 3 * C, d = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.3, 0.08, d - 0.5]} radius={0.06} position={[0, 0.74, 0]}><meshStandardMaterial color={p.desk} roughness={0.5} /></RoundedBox>
      <mesh position={[0, 0.36, 0]}><boxGeometry args={[0.16, 0.72, d - 0.9]} /><meshStandardMaterial color={p.deskDark} /></mesh>
      {[-w / 2 + 0.5, 0, w / 2 - 0.5].map((x) =>
        [-d / 2 + 0.2, d / 2 - 0.2].map((z, j) => (
          <group key={`${x}-${j}`} position={[x, 0, z]} rotation-y={z < 0 ? 0 : Math.PI} scale={0.85}>
            <Chair p={p} />
          </group>
        )),
      )}
    </group>
  );
}

function Bookshelf({ p }: { p: RoomPalette }) {
  return (
    <group>
      <RoundedBox args={[C - 0.1, 1.9, 0.4]} radius={0.02} position={[0, 0.95, 0]}><meshStandardMaterial color={p.deskDark} roughness={0.7} /></RoundedBox>
      {[0.35, 0.78, 1.21, 1.64].map((y, s) => (
        <group key={s} position={[0, y, 0.06]}>
          {Array.from({ length: 5 }).map((_, i) => (
            <mesh key={i} position={[-0.26 + i * 0.13, 0.13, 0]}>
              <boxGeometry args={[0.1, 0.26 - (i % 3) * 0.03, 0.26]} />
              <meshStandardMaterial color={BOOKS[(s + i) % BOOKS.length]} roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Cabinet({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.1, 0.8, C - 0.1]} radius={0.03} position={[0, 0.4, 0]}><meshStandardMaterial color={p.desk} roughness={0.6} /></RoundedBox>
      {[-w / 4, w / 4].map((x, i) => (
        <mesh key={i} position={[x, 0.4, C / 2 - 0.04]}><boxGeometry args={[w / 2 - 0.12, 0.7, 0.03]} /><meshStandardMaterial color={p.deskDark} roughness={0.5} /></mesh>
      ))}
      {[-0.06, 0.06].map((x, i) => (
        <mesh key={i} position={[x + (i ? w / 4 : -w / 4), 0.4, C / 2 - 0.01]}><sphereGeometry args={[0.03, 8, 8]} /><meshStandardMaterial color={p.metal} metalness={0.6} /></mesh>
      ))}
    </group>
  );
}

function Lockers({ p }: { p: RoomPalette }) {
  return (
    <group>
      {[-0.2, 0.2].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <RoundedBox args={[0.38, 1.7, 0.5]} radius={0.02} position={[0, 0.85, 0]}><meshStandardMaterial color={i ? "#3f6f9c" : "#4b7aa6"} roughness={0.5} metalness={0.2} /></RoundedBox>
          <mesh position={[0.12, 1.0, 0.26]}><boxGeometry args={[0.02, 0.1, 0.02]} /><meshStandardMaterial color={p.metalDark} metalness={0.6} /></mesh>
          {[0.6, 1.2].map((y, j) => <mesh key={j} position={[0, y, 0.255]}><planeGeometry args={[0.3, 0.02]} /><meshStandardMaterial color={p.metalDark} /></mesh>)}
        </group>
      ))}
    </group>
  );
}

function PlantTall({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.18, 0.22, 0.5, 12]} /><meshStandardMaterial color={p.pot} roughness={0.8} /></mesh>
      <mesh position={[0, 0.95, 0]}><coneGeometry args={[0.34, 1.0, 10]} /><meshStandardMaterial color={p.plant} roughness={0.85} /></mesh>
      <mesh position={[0, 1.35, 0]}><coneGeometry args={[0.24, 0.7, 10]} /><meshStandardMaterial color={p.plant} roughness={0.85} /></mesh>
    </group>
  );
}

function PlantPot({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.18, 0.14, 0.32, 12]} /><meshStandardMaterial color={p.pot} roughness={0.8} /></mesh>
      <mesh position={[0, 0.46, 0]}><sphereGeometry args={[0.28, 14, 14]} /><meshStandardMaterial color={p.plant} roughness={0.85} /></mesh>
    </group>
  );
}

function Rug({ color }: { color: string }) {
  const w = 3 * C, d = 2 * C;
  return (
    <group position={[0, 0.02, 0]}>
      <mesh rotation-x={-Math.PI / 2}><planeGeometry args={[w - 0.1, d - 0.1]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]}><planeGeometry args={[w - 0.4, d - 0.4]} /><meshStandardMaterial color={FABRIC_2} roughness={0.95} /></mesh>
    </group>
  );
}

function RugRound({ color }: { color: string }) {
  const r = C;
  return (
    <group position={[0, 0.02, 0]}>
      <mesh rotation-x={-Math.PI / 2}><circleGeometry args={[r - 0.06, 36]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]}><circleGeometry args={[r - 0.22, 36]} /><meshStandardMaterial color={FABRIC} roughness={0.95} /></mesh>
    </group>
  );
}

function FloorLamp({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.16, 0.18, 0.06, 16]} /><meshStandardMaterial color={p.metalDark} metalness={0.5} /></mesh>
      <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.02, 0.02, 1.6, 8]} /><meshStandardMaterial color={p.metalDark} metalness={0.5} /></mesh>
      <mesh position={[0, 1.62, 0]}><coneGeometry args={[0.22, 0.26, 18, 1, true]} /><meshStandardMaterial color={p.lamp} emissive={p.lamp} emissiveIntensity={0.5} side={2} /></mesh>
      <mesh position={[0, 1.55, 0]}><sphereGeometry args={[0.08, 10, 10]} /><meshStandardMaterial color="#fff2cc" emissive="#fff2cc" emissiveIntensity={1.4} toneMapped={false} /></mesh>
    </group>
  );
}

function TvStand({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.1, 0.4, C - 0.2]} radius={0.03} position={[0, 0.2, 0]}><meshStandardMaterial color={p.deskDark} roughness={0.6} /></RoundedBox>
      <mesh position={[0, 0.85, -0.05]}><boxGeometry args={[w - 0.3, 0.74, 0.05]} /><meshStandardMaterial color="#0a0d13" metalness={0.4} roughness={0.4} /></mesh>
      <mesh position={[0, 0.85, -0.02]}><planeGeometry args={[w - 0.4, 0.64]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={0.9} toneMapped={false} /></mesh>
    </group>
  );
}

function Easel({ p }: { p: RoomPalette }) {
  return (
    <group>
      {[[-0.28, 0.18], [0.28, 0.18], [0, -0.26]].map((l, i) => (
        <mesh key={i} position={[l[0], 0.5, l[1]]} rotation-x={l[1] < 0 ? 0.16 : -0.1}><cylinderGeometry args={[0.025, 0.025, 1.1, 8]} /><meshStandardMaterial color={p.deskDark} /></mesh>
      ))}
      <group position={[0, 1.0, 0.05]} rotation-x={-0.38}>
        <RoundedBox args={[0.8, 0.62, 0.04]} radius={0.02} position={[0, 0, 0]}><meshStandardMaterial color={p.metal} metalness={0.3} /></RoundedBox>
        <mesh position={[0, 0, 0.025]}><planeGeometry args={[0.72, 0.54]} /><meshStandardMaterial color={p.board} /></mesh>
        <mesh position={[-0.05, 0.08, 0.03]}><planeGeometry args={[0.5, 0.01]} /><meshBasicMaterial color="#3b82f6" /></mesh>
        <mesh position={[0.1, -0.08, 0.03]} rotation-z={0.1}><planeGeometry args={[0.4, 0.01]} /><meshBasicMaterial color="#1eb877" /></mesh>
      </group>
    </group>
  );
}

function Arcade({ p }: { p: RoomPalette }) {
  return (
    <group>
      <RoundedBox args={[0.5, 1.5, 0.5]} radius={0.04} position={[0, 0.75, 0]}><meshStandardMaterial color="#5b2bd0" roughness={0.5} /></RoundedBox>
      <mesh position={[0, 1.12, 0.22]} rotation-x={-0.25}><planeGeometry args={[0.4, 0.34]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={1.2} toneMapped={false} /></mesh>
      <mesh position={[0, 0.82, 0.26]} rotation-x={0.5}><boxGeometry args={[0.42, 0.18, 0.04]} /><meshStandardMaterial color="#2a1d40" /></mesh>
      <mesh position={[-0.1, 0.86, 0.27]}><sphereGeometry args={[0.03, 8, 8]} /><meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} toneMapped={false} /></mesh>
      <mesh position={[0.08, 0.86, 0.27]}><sphereGeometry args={[0.03, 8, 8]} /><meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.8} toneMapped={false} /></mesh>
      <mesh position={[0, 1.46, 0]}><boxGeometry args={[0.5, 0.12, 0.5]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={0.5} /></mesh>
    </group>
  );
}

function PingPong({ p }: { p: RoomPalette }) {
  const w = 3 * C, d = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.3, 0.05, d - 0.4]} radius={0.01} position={[0, 0.74, 0]}><meshStandardMaterial color="#1c6b4a" roughness={0.7} /></RoundedBox>
      <mesh position={[0, 0.77, 0]}><boxGeometry args={[w - 0.3, 0.005, 0.01]} /><meshBasicMaterial color="#ffffff" /></mesh>
      <mesh position={[0, 0.86, 0]}><boxGeometry args={[0.02, 0.18, d - 0.4]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.7} /></mesh>
      {([[-w / 2 + 0.2, -d / 2 + 0.2], [w / 2 - 0.2, -d / 2 + 0.2], [-w / 2 + 0.2, d / 2 - 0.2], [w / 2 - 0.2, d / 2 - 0.2]] as const).map((l, i) => (
        <mesh key={i} position={[l[0], 0.37, l[1]]}><boxGeometry args={[0.06, 0.74, 0.06]} /><meshStandardMaterial color={p.metalDark} /></mesh>
      ))}
    </group>
  );
}

function WaterCooler(_: { p: RoomPalette }) {
  return (
    <group>
      <RoundedBox args={[0.4, 0.9, 0.4]} radius={0.03} position={[0, 0.45, 0]}><meshStandardMaterial color="#e9edf2" roughness={0.4} /></RoundedBox>
      <mesh position={[0, 1.12, 0]}><cylinderGeometry args={[0.16, 0.18, 0.4, 14]} /><meshStandardMaterial color="#7fb6f0" transparent opacity={0.5} roughness={0.1} /></mesh>
      <mesh position={[0, 0.55, 0.21]}><boxGeometry args={[0.12, 0.08, 0.04]} /><meshStandardMaterial color="#3b82f6" /></mesh>
      <mesh position={[0, 0.62, 0.21]}><boxGeometry args={[0.12, 0.05, 0.04]} /><meshStandardMaterial color="#ef4444" /></mesh>
    </group>
  );
}

function ServerRack({ p }: { p: RoomPalette }) {
  return (
    <group>
      <RoundedBox args={[0.5, 1.7, 0.55]} radius={0.02} position={[0, 0.85, 0]}><meshStandardMaterial color="#1a1d23" roughness={0.5} metalness={0.3} /></RoundedBox>
      {Array.from({ length: 7 }).map((_, i) => (
        <group key={i} position={[0, 0.3 + i * 0.2, 0.28]}>
          <mesh><boxGeometry args={[0.42, 0.16, 0.02]} /><meshStandardMaterial color="#2a2f37" /></mesh>
          <mesh position={[-0.15, 0, 0.02]}><sphereGeometry args={[0.018, 6, 6]} /><meshStandardMaterial color={i % 2 ? "#10b981" : p.screen} emissive={i % 2 ? "#10b981" : p.screen} emissiveIntensity={1.1} toneMapped={false} /></mesh>
          <mesh position={[-0.1, 0, 0.02]}><sphereGeometry args={[0.018, 6, 6]} /><meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.9} toneMapped={false} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Printer({ p }: { p: RoomPalette }) {
  return (
    <group>
      <RoundedBox args={[0.55, 0.55, 0.55]} radius={0.03} position={[0, 0.3, 0]}><meshStandardMaterial color={p.metalDark} roughness={0.5} metalness={0.2} /></RoundedBox>
      <mesh position={[0, 0.62, 0]}><boxGeometry args={[0.5, 0.05, 0.5]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={0.7} toneMapped={false} /></mesh>
      <mesh position={[0, 0.32, 0.28]}><planeGeometry args={[0.16, 0.1]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={1.0} toneMapped={false} /></mesh>
    </group>
  );
}

// ---------------- Modern office + garage additions ----------------
function StandingDesk({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.12, 0.06, C - 0.12]} radius={0.02} position={[0, 1.02, 0]}><meshStandardMaterial color={p.desk} roughness={0.6} /></RoundedBox>
      {[-w / 2 + 0.2, w / 2 - 0.2].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[0, 0.51, 0]}><boxGeometry args={[0.1, 1.0, 0.1]} /><meshStandardMaterial color={p.metalDark} metalness={0.4} /></mesh>
          <mesh position={[0, 0.03, 0]}><boxGeometry args={[0.5, 0.06, 0.5]} /><meshStandardMaterial color={p.metalDark} metalness={0.4} /></mesh>
        </group>
      ))}
      <group position={[0.1, 1.06, -0.18]}>
        <mesh position={[0, 0.34, 0]}><boxGeometry args={[0.6, 0.36, 0.04]} /><meshStandardMaterial color={p.metalDark} /></mesh>
        <mesh position={[0, 0.34, 0.022]}><planeGeometry args={[0.54, 0.3]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={1.1} toneMapped={false} /></mesh>
        <mesh position={[0, 0.12, 0]}><boxGeometry args={[0.04, 0.22, 0.04]} /><meshStandardMaterial color={p.metalDark} /></mesh>
      </group>
    </group>
  );
}

function DualDesk({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.12, 0.06, C - 0.12]} radius={0.02} position={[0, 0.74, 0]}><meshStandardMaterial color={p.desk} roughness={0.6} /></RoundedBox>
      {([[-w / 2 + 0.18, -C / 2 + 0.16], [w / 2 - 0.18, -C / 2 + 0.16], [-w / 2 + 0.18, C / 2 - 0.16], [w / 2 - 0.18, C / 2 - 0.16]] as const).map((l, i) => (
        <mesh key={i} position={[l[0], 0.37, l[1]]}><boxGeometry args={[0.07, 0.74, 0.07]} /><meshStandardMaterial color={p.deskDark} /></mesh>
      ))}
      {[-0.34, 0.34].map((x, i) => (
        <group key={i} position={[x, 0.78, -0.2]} rotation-y={i ? -0.12 : 0.12}>
          <mesh position={[0, 0.32, 0]}><boxGeometry args={[0.56, 0.34, 0.04]} /><meshStandardMaterial color={p.metalDark} /></mesh>
          {/* single-sided screen — it faces the worker (a real monitor: lit front, solid back). */}
          <mesh position={[0, 0.32, 0.022]}><planeGeometry args={[0.5, 0.28]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={1.2} toneMapped={false} /></mesh>
          <mesh position={[0, 0.1, 0]}><boxGeometry args={[0.04, 0.2, 0.04]} /><meshStandardMaterial color={p.metalDark} /></mesh>
        </group>
      ))}
      <mesh position={[0, 0.79, 0.16]}><boxGeometry args={[0.5, 0.02, 0.16]} /><meshStandardMaterial color="#15181d" /></mesh>
    </group>
  );
}

function Reception({ p }: { p: RoomPalette }) {
  const w = 3 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.1, 0.9, C - 0.2]} radius={0.05} position={[0, 0.45, -0.1]}><meshStandardMaterial color={p.desk} roughness={0.6} /></RoundedBox>
      <RoundedBox args={[w + 0.1, 0.24, 0.18]} radius={0.06} position={[0, 1.0, C / 2 - 0.16]}><meshStandardMaterial color={p.deskDark} roughness={0.5} /></RoundedBox>
      <mesh position={[0, 0.5, C / 2 - 0.02]}><planeGeometry args={[w - 0.4, 0.6]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={0.25} roughness={0.4} /></mesh>
    </group>
  );
}

function Stool({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.74, 0]}><cylinderGeometry args={[0.18, 0.18, 0.07, 16]} /><meshStandardMaterial color={FABRIC_2} roughness={0.7} /></mesh>
      <mesh position={[0, 0.37, 0]}><cylinderGeometry args={[0.04, 0.04, 0.74, 8]} /><meshStandardMaterial color={p.metal} metalness={0.6} /></mesh>
      <mesh position={[0, 0.28, 0]}><torusGeometry args={[0.16, 0.02, 6, 18]} /><meshStandardMaterial color={p.metalDark} metalness={0.5} /></mesh>
      <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.22, 0.24, 0.04, 16]} /><meshStandardMaterial color={p.metalDark} metalness={0.5} /></mesh>
    </group>
  );
}

function Beanbag({ hue = "#e0843c" }: { hue?: string }) {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} scale={[1, 0.55, 1]}><sphereGeometry args={[0.4, 18, 16]} /><meshStandardMaterial color={hue} roughness={0.9} /></mesh>
      <mesh position={[0, 0.34, -0.12]} scale={[0.8, 0.5, 0.6]}><sphereGeometry args={[0.32, 16, 14]} /><meshStandardMaterial color={hue} roughness={0.9} /></mesh>
    </group>
  );
}

function GamingChair({ p }: { p: RoomPalette }) {
  const hue = "#e23b3b";
  return (
    <group>
      <RoundedBox args={[0.5, 0.12, 0.5]} radius={0.06} position={[0, 0.5, 0]}><meshStandardMaterial color="#15181d" roughness={0.6} /></RoundedBox>
      <RoundedBox args={[0.5, 0.74, 0.12]} radius={0.08} position={[0, 0.92, -0.22]}><meshStandardMaterial color="#15181d" roughness={0.6} /></RoundedBox>
      {[-0.2, 0.2].map((x, i) => <RoundedBox key={i} args={[0.1, 0.62, 0.14]} radius={0.05} position={[x, 0.92, -0.18]}><meshStandardMaterial color={hue} roughness={0.6} /></RoundedBox>)}
      {[-0.26, 0.26].map((x, i) => <RoundedBox key={i} args={[0.08, 0.16, 0.34]} radius={0.03} position={[x, 0.62, 0]}><meshStandardMaterial color="#15181d" /></RoundedBox>)}
      <mesh position={[0, 0.28, 0]}><cylinderGeometry args={[0.05, 0.05, 0.4, 8]} /><meshStandardMaterial color={p.metalDark} metalness={0.6} /></mesh>
      <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.26, 0.28, 0.04, 5]} /><meshStandardMaterial color={p.metalDark} metalness={0.6} /></mesh>
    </group>
  );
}

function Bench({ hue = FABRIC }: { hue?: string }) {
  const w = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.1, 0.16, C - 0.3]} radius={0.05} position={[0, 0.44, 0]}><meshStandardMaterial color={hue} roughness={0.85} /></RoundedBox>
      {[-w / 2 + 0.18, w / 2 - 0.18].map((x, i) => <mesh key={i} position={[x, 0.18, 0]}><boxGeometry args={[0.08, 0.36, C - 0.34]} /><meshStandardMaterial color="#3a3f48" metalness={0.3} /></mesh>)}
    </group>
  );
}

function RoundTable({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.74, 0]}><cylinderGeometry args={[C - 0.16, C - 0.16, 0.06, 36]} /><meshStandardMaterial color={p.desk} roughness={0.5} /></mesh>
      <mesh position={[0, 0.37, 0]}><cylinderGeometry args={[0.07, 0.07, 0.72, 12]} /><meshStandardMaterial color={p.deskDark} /></mesh>
      <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.34, 0.36, 0.05, 24]} /><meshStandardMaterial color={p.deskDark} /></mesh>
    </group>
  );
}

function SideTable({ p }: { p: RoomPalette }) {
  return (
    <group>
      <RoundedBox args={[0.5, 0.05, 0.5]} radius={0.03} position={[0, 0.5, 0]}><meshStandardMaterial color={p.desk} roughness={0.5} /></RoundedBox>
      {([[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]] as const).map((l, i) => <mesh key={i} position={[l[0], 0.25, l[1]]}><boxGeometry args={[0.04, 0.5, 0.04]} /><meshStandardMaterial color={p.deskDark} /></mesh>)}
      <mesh position={[0, 0.58, 0]}><cylinderGeometry args={[0.06, 0.07, 0.16, 10]} /><meshStandardMaterial color={p.plant} /></mesh>
    </group>
  );
}

function FilingCabinet({ p }: { p: RoomPalette }) {
  return (
    <group>
      <RoundedBox args={[0.5, 1.0, 0.55]} radius={0.02} position={[0, 0.5, 0]}><meshStandardMaterial color={p.metal} metalness={0.3} roughness={0.5} /></RoundedBox>
      {[0.24, 0.5, 0.76].map((y, i) => (
        <group key={i} position={[0, y, 0.28]}>
          <mesh><boxGeometry args={[0.44, 0.22, 0.02]} /><meshStandardMaterial color={p.metalDark} roughness={0.5} /></mesh>
          <mesh position={[0, 0, 0.02]}><boxGeometry args={[0.14, 0.03, 0.02]} /><meshStandardMaterial color={p.metalDark} metalness={0.6} /></mesh>
        </group>
      ))}
    </group>
  );
}

function ShelfUnit({ p }: { p: RoomPalette }) {
  return (
    <group>
      {[-0.24, 0.24].map((x, i) => <mesh key={i} position={[x, 0.85, -0.2]}><boxGeometry args={[0.05, 1.7, 0.05]} /><meshStandardMaterial color={p.deskDark} /></mesh>)}
      {[-0.24, 0.24].map((x, i) => <mesh key={`f${i}`} position={[x, 0.85, 0.2]}><boxGeometry args={[0.05, 1.7, 0.05]} /><meshStandardMaterial color={p.deskDark} /></mesh>)}
      {[0.2, 0.7, 1.2, 1.65].map((y, s) => (
        <group key={s}>
          <mesh position={[0, y, 0]}><boxGeometry args={[0.56, 0.04, 0.5]} /><meshStandardMaterial color={p.desk} roughness={0.6} /></mesh>
          {s < 3 && <mesh position={[-0.1 + (s % 2) * 0.2, y + 0.16, 0]}><boxGeometry args={[0.2, 0.26, 0.3]} /><meshStandardMaterial color={BOOKS[(s + 1) % BOOKS.length]} roughness={0.7} /></mesh>}
        </group>
      ))}
    </group>
  );
}

function Crates({ p }: { p: RoomPalette }) {
  return (
    <group>
      <RoundedBox args={[0.5, 0.46, 0.5]} radius={0.02} position={[0, 0.23, 0]}><meshStandardMaterial color={p.box} roughness={0.85} /></RoundedBox>
      <RoundedBox args={[0.42, 0.4, 0.42]} radius={0.02} position={[0.05, 0.66, -0.04]} rotation-y={0.3}><meshStandardMaterial color={WOOD} roughness={0.85} /></RoundedBox>
      <mesh position={[0, 0.23, 0.255]}><boxGeometry args={[0.5, 0.05, 0.01]} /><meshStandardMaterial color={WOOD} /></mesh>
    </group>
  );
}

function Cactus({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.16, 0.13, 0.32, 12]} /><meshStandardMaterial color="#d98a4a" roughness={0.8} /></mesh>
      <mesh position={[0, 0.6, 0]}><capsuleGeometry args={[0.1, 0.5, 4, 10]} /><meshStandardMaterial color={p.plant} roughness={0.8} /></mesh>
      <mesh position={[0.13, 0.66, 0]} rotation-z={-0.5}><capsuleGeometry args={[0.05, 0.22, 4, 8]} /><meshStandardMaterial color={p.plant} roughness={0.8} /></mesh>
      <mesh position={[-0.13, 0.74, 0]} rotation-z={0.5}><capsuleGeometry args={[0.05, 0.2, 4, 8]} /><meshStandardMaterial color={p.plant} roughness={0.8} /></mesh>
    </group>
  );
}

function PlanterBox({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.2, 0.3, C - 0.3]} radius={0.03} position={[0, 0.15, 0]}><meshStandardMaterial color={p.pot} roughness={0.8} /></RoundedBox>
      {[-w / 3, 0, w / 3].map((x, i) => <mesh key={i} position={[x, 0.5, 0]}><sphereGeometry args={[0.22, 12, 12]} /><meshStandardMaterial color={p.plant} roughness={0.85} /></mesh>)}
    </group>
  );
}

function NeonSign({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.03, 0.03, 1.2, 8]} /><meshStandardMaterial color={p.metalDark} /></mesh>
      <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.16, 0.18, 0.06, 12]} /><meshStandardMaterial color={p.metalDark} /></mesh>
      <mesh position={[0, 1.2, 0]}><torusGeometry args={[0.26, 0.04, 10, 28]} /><meshStandardMaterial color="#ff4fd8" emissive="#ff4fd8" emissiveIntensity={1.6} toneMapped={false} /></mesh>
      <mesh position={[0, 1.2, 0.01]}><boxGeometry args={[0.04, 0.34, 0.04]} /><meshStandardMaterial color="#54e0ff" emissive="#54e0ff" emissiveIntensity={1.6} toneMapped={false} /></mesh>
    </group>
  );
}

function ArtStand(_: { p: RoomPalette }) {
  return (
    <group>
      {[[-0.2, 0.14], [0.2, 0.14], [0, -0.2]].map((l, i) => <mesh key={i} position={[l[0], 0.5, l[1]]} rotation-x={l[1] < 0 ? 0.14 : -0.1}><cylinderGeometry args={[0.022, 0.022, 1.0, 8]} /><meshStandardMaterial color={WOOD} /></mesh>)}
      <group position={[0, 0.92, 0.04]} rotation-x={-0.32}>
        <RoundedBox args={[0.66, 0.5, 0.04]} radius={0.01} position={[0, 0, 0]}><meshStandardMaterial color="#2a2623" /></RoundedBox>
        <mesh position={[0, 0, 0.025]}><planeGeometry args={[0.58, 0.42]} /><meshStandardMaterial color="#e8e2d6" /></mesh>
        <mesh position={[-0.1, 0.05, 0.03]}><planeGeometry args={[0.2, 0.2]} /><meshBasicMaterial color="#f59e0b" /></mesh>
        <mesh position={[0.12, -0.06, 0.03]}><circleGeometry args={[0.1, 16]} /><meshBasicMaterial color="#3b82f6" /></mesh>
      </group>
    </group>
  );
}

function Globe({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.04, 0.16, 0.32, 4]} /><meshStandardMaterial color={WOOD} /></mesh>
      <mesh position={[0, 0.62, 0]} rotation-z={0.4}><torusGeometry args={[0.26, 0.018, 8, 28]} /><meshStandardMaterial color={p.metal} metalness={0.6} /></mesh>
      <mesh position={[0, 0.62, 0]} rotation-z={0.4}><sphereGeometry args={[0.24, 20, 16]} /><meshStandardMaterial color="#2f6f9e" roughness={0.6} /></mesh>
    </group>
  );
}

function FloorClock({ p }: { p: RoomPalette }) {
  return (
    <group>
      <RoundedBox args={[0.4, 1.7, 0.28]} radius={0.03} position={[0, 0.85, 0]}><meshStandardMaterial color={WOOD} roughness={0.6} /></RoundedBox>
      <mesh position={[0, 1.45, 0.15]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.15, 0.15, 0.03, 24]} /><meshStandardMaterial color="#f4efe6" /></mesh>
      <mesh position={[0, 1.49, 0.18]}><boxGeometry args={[0.015, 0.08, 0.01]} /><meshStandardMaterial color="#1a1d23" /></mesh>
      <mesh position={[0.04, 1.45, 0.18]}><boxGeometry args={[0.06, 0.015, 0.01]} /><meshStandardMaterial color="#1a1d23" /></mesh>
      <mesh position={[0, 0.9, 0.16]}><sphereGeometry args={[0.05, 12, 12]} /><meshStandardMaterial color={p.lamp} emissive={p.lamp} emissiveIntensity={0.5} /></mesh>
    </group>
  );
}

function Sculpture({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.2, 0.22, 0.2, 16]} /><meshStandardMaterial color={p.metalDark} roughness={0.4} /></mesh>
      <mesh position={[0, 0.5, 0]} rotation-x={0.5} rotation-z={0.4}><torusGeometry args={[0.22, 0.07, 12, 28]} /><meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} /></mesh>
      <mesh position={[0, 0.85, 0]}><coneGeometry args={[0.12, 0.3, 4]} /><meshStandardMaterial color="#c0c5cc" metalness={0.6} roughness={0.3} /></mesh>
    </group>
  );
}

function Divider({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      {[-1, 0, 1].map((s, i) => (
        <group key={i} position={[s * (w / 3.2), 0, s * 0.12]} rotation-y={s * 0.3}>
          <RoundedBox args={[w / 3, 1.5, 0.05]} radius={0.02} position={[0, 0.78, 0]}><meshStandardMaterial color={i % 2 ? p.deskDark : p.desk} roughness={0.7} /></RoundedBox>
        </group>
      ))}
    </group>
  );
}

function ArcLamp({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.2, 0.22, 0.06, 20]} /><meshStandardMaterial color={p.metalDark} metalness={0.5} /></mesh>
      <mesh position={[0, 1.0, -0.1]}><cylinderGeometry args={[0.025, 0.025, 1.9, 8]} /><meshStandardMaterial color={p.metalDark} metalness={0.5} /></mesh>
      <mesh position={[0.18, 1.9, 0.1]} rotation-z={-0.9}><cylinderGeometry args={[0.025, 0.025, 0.7, 8]} /><meshStandardMaterial color={p.metalDark} metalness={0.5} /></mesh>
      <mesh position={[0.42, 1.78, 0.18]}><sphereGeometry args={[0.12, 14, 12]} /><meshStandardMaterial color="#fff2cc" emissive="#fff2cc" emissiveIntensity={1.5} toneMapped={false} /></mesh>
    </group>
  );
}

function Lantern({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.02, 0.02, 1.0, 6]} /><meshStandardMaterial color={p.metalDark} /></mesh>
      <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.14, 0.16, 0.05, 12]} /><meshStandardMaterial color={p.metalDark} /></mesh>
      <mesh position={[0, 1.1, 0]}><sphereGeometry args={[0.22, 16, 14]} /><meshStandardMaterial color="#ffd98a" emissive="#ffcf72" emissiveIntensity={1.1} toneMapped={false} transparent opacity={0.92} /></mesh>
    </group>
  );
}

function Foosball({ p }: { p: RoomPalette }) {
  const w = 3 * C, d = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.3, 0.18, d - 0.4]} radius={0.03} position={[0, 0.74, 0]}><meshStandardMaterial color="#1c6b4a" roughness={0.7} /></RoundedBox>
      <RoundedBox args={[w - 0.2, 0.2, 0.12]} radius={0.03} position={[0, 0.84, -d / 2 + 0.18]}><meshStandardMaterial color={p.deskDark} /></RoundedBox>
      <RoundedBox args={[w - 0.2, 0.2, 0.12]} radius={0.03} position={[0, 0.84, d / 2 - 0.18]}><meshStandardMaterial color={p.deskDark} /></RoundedBox>
      {[-0.7, -0.2, 0.3, 0.8].map((x, i) => <mesh key={i} position={[x, 0.95, 0]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.025, 0.025, d + 0.2, 8]} /><meshStandardMaterial color={i % 2 ? "#e23b3b" : "#3b82f6"} metalness={0.4} /></mesh>)}
      {([[-0.78, -0.2], [0.88, 0.2]] as const).map((l, i) => <mesh key={i} position={[l[0], 0.74, l[1]]}><boxGeometry args={[0.1, 0.74, 0.1]} /><meshStandardMaterial color={p.metalDark} /></mesh>)}
    </group>
  );
}

function Vending({ p }: { p: RoomPalette }) {
  return (
    <group>
      <RoundedBox args={[0.56, 1.7, 0.5]} radius={0.03} position={[0, 0.85, 0]}><meshStandardMaterial color="#b83232" roughness={0.5} /></RoundedBox>
      <mesh position={[0.08, 1.05, 0.255]}><boxGeometry args={[0.34, 0.9, 0.02]} /><meshStandardMaterial color="#0a0d13" /></mesh>
      <mesh position={[0.08, 1.05, 0.27]}><planeGeometry args={[0.3, 0.86]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={0.5} /></mesh>
      {[0, 1, 2].map((r) => [0, 1].map((c) => <mesh key={`${r}-${c}`} position={[-0.02 + c * 0.12, 0.78 + r * 0.24, 0.275]}><boxGeometry args={[0.07, 0.12, 0.02]} /><meshStandardMaterial color={BOOKS[(r + c) % BOOKS.length]} emissive={BOOKS[(r + c) % BOOKS.length]} emissiveIntensity={0.3} /></mesh>))}
      <mesh position={[-0.16, 0.45, 0.255]}><boxGeometry args={[0.18, 0.16, 0.04]} /><meshStandardMaterial color="#15181d" /></mesh>
    </group>
  );
}

function PoolTable(_: { p: RoomPalette }) {
  const w = 3 * C, d = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.2, 0.16, d - 0.2]} radius={0.04} position={[0, 0.66, 0]}><meshStandardMaterial color="#7a3b1e" roughness={0.6} /></RoundedBox>
      <mesh position={[0, 0.75, 0]}><boxGeometry args={[w - 0.5, 0.04, d - 0.5]} /><meshStandardMaterial color="#1c6b4a" roughness={0.8} /></mesh>
      {([[-w / 2 + 0.25, -d / 2 + 0.25], [0, -d / 2 + 0.22], [w / 2 - 0.25, -d / 2 + 0.25], [-w / 2 + 0.25, d / 2 - 0.25], [0, d / 2 - 0.22], [w / 2 - 0.25, d / 2 - 0.25]] as const).map((l, i) => <mesh key={i} position={[l[0], 0.78, l[1]]}><cylinderGeometry args={[0.06, 0.06, 0.04, 12]} /><meshStandardMaterial color="#0a0d13" /></mesh>)}
      {[["#f59e0b", -0.3], ["#ef4444", -0.15], ["#3b82f6", 0], ["#ffffff", 0.4]].map((b, i) => <mesh key={i} position={[b[1] as number, 0.81, 0]}><sphereGeometry args={[0.05, 12, 12]} /><meshStandardMaterial color={b[0] as string} roughness={0.3} /></mesh>)}
      {([[-w / 2 + 0.2, -d / 2 + 0.2], [w / 2 - 0.2, -d / 2 + 0.2], [-w / 2 + 0.2, d / 2 - 0.2], [w / 2 - 0.2, d / 2 - 0.2]] as const).map((l, i) => <mesh key={`leg${i}`} position={[l[0], 0.33, l[1]]}><boxGeometry args={[0.12, 0.66, 0.12]} /><meshStandardMaterial color="#5a2c16" /></mesh>)}
    </group>
  );
}

function Treadmill({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.3, 0.12, C - 0.2]} radius={0.03} position={[0, 0.18, 0.06]}><meshStandardMaterial color="#15181d" roughness={0.7} /></RoundedBox>
      <mesh position={[0, 0.25, 0.06]}><boxGeometry args={[w - 0.5, 0.02, C - 0.36]} /><meshStandardMaterial color="#2a2f37" roughness={0.85} /></mesh>
      {[-w / 2 + 0.18, w / 2 - 0.18].map((x, i) => <mesh key={i} position={[x, 0.7, -C / 2 + 0.2]}><boxGeometry args={[0.06, 1.0, 0.06]} /><meshStandardMaterial color={p.metal} metalness={0.5} /></mesh>)}
      <mesh position={[0, 1.2, -C / 2 + 0.22]}><boxGeometry args={[w - 0.4, 0.3, 0.06]} /><meshStandardMaterial color="#1a1d23" /></mesh>
      <mesh position={[0, 1.2, -C / 2 + 0.26]}><planeGeometry args={[0.3, 0.2]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={0.9} toneMapped={false} /></mesh>
    </group>
  );
}

function Guitar({ p }: { p: RoomPalette }) {
  return (
    <group rotation-z={0.12}>
      <mesh position={[0, 0.3, 0]} scale={[1, 1, 0.4]}><sphereGeometry args={[0.18, 16, 14]} /><meshStandardMaterial color="#c0392b" roughness={0.4} /></mesh>
      <mesh position={[0, 0.85, 0]}><boxGeometry args={[0.07, 0.9, 0.04]} /><meshStandardMaterial color={WOOD} roughness={0.5} /></mesh>
      <mesh position={[0, 1.34, 0]}><boxGeometry args={[0.1, 0.16, 0.05]} /><meshStandardMaterial color="#1a1d23" /></mesh>
      <mesh position={[0.16, 0.28, 0.08]} rotation-z={-0.4}><cylinderGeometry args={[0.02, 0.02, 0.7, 6]} /><meshStandardMaterial color={p.metalDark} /></mesh>
    </group>
  );
}

function RobotArm({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.18, 0.22, 0.2, 16]} /><meshStandardMaterial color="#f97316" roughness={0.4} metalness={0.2} /></mesh>
      <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[0.1, 0.12, 0.4, 12]} /><meshStandardMaterial color={p.metal} metalness={0.5} /></mesh>
      <mesh position={[0.0, 0.72, 0.16]} rotation-x={0.7}><boxGeometry args={[0.08, 0.5, 0.08]} /><meshStandardMaterial color="#f97316" metalness={0.3} /></mesh>
      <mesh position={[0.0, 0.95, 0.42]} rotation-x={-0.5}><boxGeometry args={[0.07, 0.36, 0.07]} /><meshStandardMaterial color={p.metal} metalness={0.5} /></mesh>
      <mesh position={[0, 0.86, 0.56]}><sphereGeometry args={[0.06, 10, 10]} /><meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.8} toneMapped={false} /></mesh>
    </group>
  );
}

function TowerPC({ p }: { p: RoomPalette }) {
  return (
    <group>
      <RoundedBox args={[0.3, 0.7, 0.55]} radius={0.02} position={[-0.18, 0.35, 0]}><meshStandardMaterial color="#15181d" roughness={0.4} metalness={0.2} /></RoundedBox>
      <mesh position={[-0.04, 0.45, 0]}><boxGeometry args={[0.01, 0.5, 0.4]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={0.9} toneMapped={false} /></mesh>
      <group position={[0.2, 0, 0]}>
        <mesh position={[0, 0.55, 0]}><boxGeometry args={[0.5, 0.32, 0.04]} /><meshStandardMaterial color="#0a0d13" /></mesh>
        <mesh position={[0, 0.55, 0.022]}><planeGeometry args={[0.44, 0.26]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={1.1} toneMapped={false} /></mesh>
        <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.04, 0.36, 0.04]} /><meshStandardMaterial color={p.metalDark} /></mesh>
        <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.12, 0.14, 0.03, 16]} /><meshStandardMaterial color={p.metalDark} /></mesh>
      </group>
    </group>
  );
}

function Workbench({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.1, 0.1, C - 0.1]} radius={0.02} position={[0, 0.86, 0]}><meshStandardMaterial color={WOOD} roughness={0.7} /></RoundedBox>
      {([[-w / 2 + 0.16, -C / 2 + 0.16], [w / 2 - 0.16, -C / 2 + 0.16], [-w / 2 + 0.16, C / 2 - 0.16], [w / 2 - 0.16, C / 2 - 0.16]] as const).map((l, i) => <mesh key={i} position={[l[0], 0.43, l[1]]}><boxGeometry args={[0.1, 0.86, 0.1]} /><meshStandardMaterial color="#3a3026" /></mesh>)}
      {/* pegboard back with tools */}
      <mesh position={[0, 1.4, -C / 2 + 0.06]}><boxGeometry args={[w - 0.2, 0.9, 0.04]} /><meshStandardMaterial color="#caa15a" roughness={0.8} /></mesh>
      <mesh position={[-0.3, 1.4, -C / 2 + 0.1]}><boxGeometry args={[0.04, 0.4, 0.06]} /><meshStandardMaterial color={p.metalDark} metalness={0.5} /></mesh>
      <mesh position={[0.0, 1.3, -C / 2 + 0.1]} rotation-z={0.3}><cylinderGeometry args={[0.03, 0.03, 0.4, 8]} /><meshStandardMaterial color={p.metal} metalness={0.5} /></mesh>
      {/* vise */}
      <mesh position={[w / 2 - 0.3, 0.96, 0.1]}><boxGeometry args={[0.18, 0.14, 0.16]} /><meshStandardMaterial color="#4b7aa6" metalness={0.4} /></mesh>
    </group>
  );
}

function ToolCabinet({ p }: { p: RoomPalette }) {
  return (
    <group>
      <RoundedBox args={[0.6, 1.0, 0.5]} radius={0.03} position={[0, 0.55, 0]}><meshStandardMaterial color="#c0392b" roughness={0.4} metalness={0.2} /></RoundedBox>
      {[0.3, 0.55, 0.8].map((y, i) => (
        <group key={i} position={[0, y, 0.26]}>
          <mesh><boxGeometry args={[0.52, 0.2, 0.02]} /><meshStandardMaterial color="#a52f24" /></mesh>
          <mesh position={[0, 0, 0.02]}><boxGeometry args={[0.3, 0.03, 0.02]} /><meshStandardMaterial color={p.metalDark} metalness={0.6} /></mesh>
        </group>
      ))}
      {[-0.22, 0.22].map((x, i) => <mesh key={i} position={[x, 0.06, 0]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.07, 0.07, 0.06, 14]} /><meshStandardMaterial color="#15181d" /></mesh>)}
    </group>
  );
}

function TireStack({ p }: { p: RoomPalette }) {
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[(i % 2) * 0.04, 0.14 + i * 0.22, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.26, 0.12, 12, 24]} />
          <meshStandardMaterial color="#1a1d23" roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0.04, 0.58, 0]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.16, 0.16, 0.06, 18]} /><meshStandardMaterial color={p.metal} metalness={0.5} /></mesh>
    </group>
  );
}

function Ladder({ p }: { p: RoomPalette }) {
  return (
    <group>
      {[-0.18, 0.18].map((x, i) => (
        <group key={i}>
          <mesh position={[x, 0.55, -0.18]} rotation-x={-0.18}><boxGeometry args={[0.05, 1.15, 0.05]} /><meshStandardMaterial color="#d8a23a" metalness={0.3} /></mesh>
          <mesh position={[x, 0.55, 0.18]} rotation-x={0.18}><boxGeometry args={[0.05, 1.15, 0.05]} /><meshStandardMaterial color="#d8a23a" metalness={0.3} /></mesh>
        </group>
      ))}
      {[0.28, 0.56, 0.84].map((y, i) => <mesh key={i} position={[0, y, -0.18 + (y - 0.28) * 0.32]}><boxGeometry args={[0.42, 0.04, 0.12]} /><meshStandardMaterial color="#b9842a" metalness={0.3} /></mesh>)}
      <mesh position={[0, 1.06, 0]}><boxGeometry args={[0.46, 0.06, 0.3]} /><meshStandardMaterial color={p.metalDark} metalness={0.3} /></mesh>
    </group>
  );
}

function OilDrum() {
  return (
    <group>
      <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.26, 0.26, 0.9, 24]} /><meshStandardMaterial color="#2f6f4f" roughness={0.5} metalness={0.3} /></mesh>
      {[0.25, 0.65].map((y, i) => <mesh key={i} position={[0, y, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.265, 0.02, 8, 24]} /><meshStandardMaterial color="#244f3a" metalness={0.3} /></mesh>)}
      <mesh position={[0.1, 0.9, 0.1]}><cylinderGeometry args={[0.04, 0.04, 0.04, 10]} /><meshStandardMaterial color="#1a1d23" /></mesh>
    </group>
  );
}

// ---------------- Premium catalog expansion ----------------
function ExecutiveDesk({ p }: { p: RoomPalette }) {
  const w = 3 * C, d = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.2, 0.08, d - 0.4]} radius={0.04} smoothness={3} position={[0, 0.76, 0]}><meshStandardMaterial color={WOOD} roughness={0.4} /></RoundedBox>
      {/* solid plinth bases instead of legs — reads premium */}
      {[-w / 2 + 0.4, w / 2 - 0.4].map((x, i) => (
        <RoundedBox key={i} args={[0.3, 0.72, d - 0.7]} radius={0.04} position={[x, 0.38, 0]}><meshStandardMaterial color={p.deskDark} roughness={0.5} /></RoundedBox>
      ))}
      <mesh position={[0, 0.805, -0.25]}><boxGeometry args={[0.62, 0.02, 0.4]} /><meshStandardMaterial color="#15181d" /></mesh>
      <group position={[0.55, 0.81, -0.35]}>
        <mesh position={[0, 0.34, 0]}><boxGeometry args={[0.62, 0.36, 0.04]} /><meshStandardMaterial color={p.metalDark} /></mesh>
        <mesh position={[0, 0.34, 0.022]}><planeGeometry args={[0.56, 0.3]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={1.1} toneMapped={false} /></mesh>
        <mesh position={[0, 0.12, 0]}><boxGeometry args={[0.05, 0.22, 0.05]} /><meshStandardMaterial color={p.metalDark} /></mesh>
      </group>
    </group>
  );
}

function LoungeChair({ hue = FABRIC_2 }: { hue?: string }) {
  return (
    <group>
      <RoundedBox args={[0.62, 0.22, 0.6]} radius={0.1} position={[0, 0.32, 0.04]}><meshStandardMaterial color={hue} roughness={0.85} /></RoundedBox>
      <RoundedBox args={[0.62, 0.5, 0.16]} radius={0.12} position={[0, 0.55, -0.24]} rotation-x={-0.18}><meshStandardMaterial color={hue} roughness={0.85} /></RoundedBox>
      {[-0.32, 0.32].map((x, i) => <RoundedBox key={i} args={[0.1, 0.26, 0.5]} radius={0.05} position={[x, 0.42, 0.04]}><meshStandardMaterial color={hue} roughness={0.85} /></RoundedBox>)}
      {/* splayed wooden legs */}
      {([[-0.24, -0.22], [0.24, -0.22], [-0.24, 0.24], [0.24, 0.24]] as const).map((l, i) => <mesh key={i} position={[l[0], 0.1, l[1]]} rotation-z={l[0] < 0 ? 0.12 : -0.12}><cylinderGeometry args={[0.03, 0.025, 0.24, 8]} /><meshStandardMaterial color={WOOD} /></mesh>)}
    </group>
  );
}

function SofaL({ hue = FABRIC }: { hue?: string }) {
  const a = 2 * C;
  return (
    <group>
      {/* main run */}
      <RoundedBox args={[a - 0.1, 0.26, C - 0.06]} radius={0.08} position={[0, 0.26, C / 2 - 0.02]}><meshStandardMaterial color={hue} roughness={0.85} /></RoundedBox>
      <RoundedBox args={[a - 0.1, 0.44, 0.16]} radius={0.08} position={[0, 0.48, C - 0.06]}><meshStandardMaterial color={hue} roughness={0.85} /></RoundedBox>
      {/* return leg (forms the L) */}
      <RoundedBox args={[C - 0.06, 0.26, a - 0.5]} radius={0.08} position={[-a / 2 + C / 2, 0.26, -0.1]}><meshStandardMaterial color={hue} roughness={0.85} /></RoundedBox>
      <RoundedBox args={[0.16, 0.44, a - 0.5]} radius={0.08} position={[-a / 2 + 0.08, 0.48, -0.1]}><meshStandardMaterial color={hue} roughness={0.85} /></RoundedBox>
      {/* seat cushions */}
      {[-a / 4, a / 4].map((x, i) => <RoundedBox key={i} args={[a / 2 - 0.2, 0.12, C - 0.2]} radius={0.05} position={[x, 0.42, C / 2 - 0.02]}><meshStandardMaterial color={FABRIC_2} roughness={0.8} /></RoundedBox>)}
    </group>
  );
}

function BarTable({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 1.04, 0]}><cylinderGeometry args={[0.28, 0.28, 0.05, 28]} /><meshStandardMaterial color={p.desk} roughness={0.4} /></mesh>
      <mesh position={[0, 0.52, 0]}><cylinderGeometry args={[0.04, 0.04, 1.0, 12]} /><meshStandardMaterial color={p.metalDark} metalness={0.6} roughness={0.3} /></mesh>
      <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.26, 0.28, 0.05, 24]} /><meshStandardMaterial color={p.metalDark} metalness={0.6} /></mesh>
    </group>
  );
}

function Wardrobe({ p }: { p: RoomPalette }) {
  return (
    <group>
      <RoundedBox args={[0.6, 1.9, 0.55]} radius={0.03} position={[0, 0.95, 0]}><meshStandardMaterial color={p.desk} roughness={0.6} /></RoundedBox>
      <mesh position={[-0.001, 0.95, 0.28]}><boxGeometry args={[0.02, 1.8, 0.02]} /><meshStandardMaterial color={p.deskDark} /></mesh>
      {[-0.15, 0.15].map((x, i) => <mesh key={i} position={[x, 0.95, 0.29]}><boxGeometry args={[0.02, 0.3, 0.02]} /><meshStandardMaterial color={p.metal} metalness={0.6} /></mesh>)}
    </group>
  );
}

function Monstera({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.17, 0.14, 0.4, 14]} /><meshStandardMaterial color="#e8e2d6" roughness={0.7} /></mesh>
      {[[0.18, 0.7, 0.3], [-0.16, 0.85, -0.2], [0.05, 1.05, 0.1], [-0.2, 1.0, 0.25], [0.22, 1.15, -0.15]].map((l, i) => (
        <mesh key={i} position={[l[0], l[1], l[2]]} rotation-z={l[0] * 0.8} rotation-x={l[2] * 0.6} scale={[1, 1, 0.4]}>
          <sphereGeometry args={[0.22, 10, 10]} /><meshStandardMaterial color={p.plant} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function Bonsai({ p }: { p: RoomPalette }) {
  return (
    <group>
      <RoundedBox args={[0.4, 0.16, 0.28]} radius={0.03} position={[0, 0.16, 0]}><meshStandardMaterial color={p.pot} roughness={0.8} /></RoundedBox>
      <mesh position={[0.02, 0.4, 0]} rotation-z={-0.2}><cylinderGeometry args={[0.03, 0.05, 0.4, 8]} /><meshStandardMaterial color={WOOD} roughness={0.8} /></mesh>
      {[[-0.12, 0.6], [0.14, 0.58], [0.02, 0.7]].map((l, i) => <mesh key={i} position={[l[0], l[1], 0]} scale={[1.4, 0.6, 1.4]}><sphereGeometry args={[0.14, 10, 10]} /><meshStandardMaterial color={p.plant} roughness={0.85} /></mesh>)}
    </group>
  );
}

function FloorVase({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.12, 0.18, 0.8, 18]} /><meshStandardMaterial color="#c08a5a" roughness={0.35} metalness={0.1} /></mesh>
      <mesh position={[0, 0.82, 0]}><cylinderGeometry args={[0.1, 0.12, 0.12, 18]} /><meshStandardMaterial color="#b07a48" roughness={0.4} /></mesh>
      {[[-0.05, 1.1], [0.06, 1.15], [0, 1.05]].map((l, i) => <mesh key={i} position={[l[0], l[1], 0]} rotation-z={l[0] * 3}><cylinderGeometry args={[0.01, 0.01, 0.5, 5]} /><meshStandardMaterial color={p.plant} roughness={0.8} /></mesh>)}
    </group>
  );
}

function CubeLamp({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.28, 0]}><boxGeometry args={[0.34, 0.56, 0.34]} /><meshStandardMaterial color="#fff2cc" emissive="#ffe9b0" emissiveIntensity={0.9} toneMapped={false} transparent opacity={0.92} /></mesh>
      <mesh position={[0, 0.01, 0]}><boxGeometry args={[0.36, 0.04, 0.36]} /><meshStandardMaterial color={p.metalDark} metalness={0.5} /></mesh>
    </group>
  );
}

function CoffeeBar({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <RoundedBox args={[w - 0.1, 0.92, C - 0.2]} radius={0.04} position={[0, 0.46, 0]}><meshStandardMaterial color={p.deskDark} roughness={0.6} /></RoundedBox>
      <RoundedBox args={[w, 0.06, C - 0.12]} radius={0.02} position={[0, 0.95, 0]}><meshStandardMaterial color={p.desk} roughness={0.4} /></RoundedBox>
      {/* espresso machine */}
      <RoundedBox args={[0.42, 0.4, 0.34]} radius={0.05} position={[-w / 4, 1.18, -0.04]}><meshStandardMaterial color={p.metal} metalness={0.6} roughness={0.3} /></RoundedBox>
      <mesh position={[-w / 4, 1.0, 0.16]}><cylinderGeometry args={[0.04, 0.05, 0.1, 12]} /><meshStandardMaterial color={p.metalDark} metalness={0.7} /></mesh>
      <mesh position={[-w / 4 + 0.16, 1.26, 0.12]}><sphereGeometry args={[0.022, 8, 8]} /><meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.2} toneMapped={false} /></mesh>
      {/* cups + a mug */}
      {[0.1, 0.24, 0.38].map((x, i) => <mesh key={i} position={[x, 1.04, -0.08]}><cylinderGeometry args={[0.05, 0.045, 0.1, 12]} /><meshStandardMaterial color="#efeae0" roughness={0.5} /></mesh>)}
      <mesh position={[w / 4, 1.04, 0.16]}><cylinderGeometry args={[0.055, 0.05, 0.11, 14]} /><meshStandardMaterial color="#d98a4a" roughness={0.5} /></mesh>
    </group>
  );
}

// ---------------- Furniture catalog expansion (premium office + tech) ----------------
function Aquarium() {
  const w = 3 * C;
  return (
    <group>
      {/* dark-wood cabinet */}
      <RoundedBox args={[w - 0.1, 0.72, C - 0.1]} radius={0.03} position={[0, 0.36, 0]}><meshStandardMaterial color="#2e2016" roughness={0.6} /></RoundedBox>
      {/* faint blue emissive backlight */}
      <mesh position={[0, 1.02, -C / 2 + 0.07]}><planeGeometry args={[w - 0.24, 0.5]} /><meshStandardMaterial color="#2a6fae" emissive="#2f7fd0" emissiveIntensity={0.6} toneMapped={false} /></mesh>
      {/* water body — transparent bluish glass */}
      <mesh position={[0, 1.02, 0]}><boxGeometry args={[w - 0.22, 0.5, C - 0.24]} /><meshPhysicalMaterial color="#7fc4e8" transparent opacity={0.32} roughness={0.08} transmission={0.6} thickness={0.4} /></mesh>
      {/* glass tank shell */}
      <mesh position={[0, 1.02, 0]}><boxGeometry args={[w - 0.2, 0.52, C - 0.22]} /><meshStandardMaterial color="#9fb4c4" transparent opacity={0.12} roughness={0.05} metalness={0.3} /></mesh>
      {/* emissive coral cones */}
      {([[-0.9, "#ff7043"], [-0.2, "#ffb74d"], [0.7, "#ef5a8a"]] as const).map((c, i) => (
        <mesh key={i} position={[c[0], 0.86, 0.05]}><coneGeometry args={[0.06, 0.28, 8]} /><meshStandardMaterial color={c[1]} emissive={c[1]} emissiveIntensity={0.5} roughness={0.6} /></mesh>
      ))}
      {/* tiny fish */}
      {([[-0.5, 1.12, 0.18], [0.3, 1.0, -0.14], [0.9, 1.15, 0.1]] as const).map((f, i) => (
        <mesh key={`f${i}`} position={[f[0], f[1], f[2]]} rotation-y={i * 0.6}><boxGeometry args={[0.09, 0.05, 0.03]} /><meshStandardMaterial color={i % 2 ? "#ffd54f" : "#ff8a65"} emissive={i % 2 ? "#ffd54f" : "#ff8a65"} emissiveIntensity={0.3} /></mesh>
      ))}
    </group>
  );
}

function SuperCluster() {
  return (
    <group>
      {[-0.42, 0.42].map((x, r) => (
        <group key={r} position={[x, 0, 0]}>
          <RoundedBox args={[0.72, 1.8, 0.6]} radius={0.02} position={[0, 0.9, 0]}><meshStandardMaterial color="#0e1116" roughness={0.5} metalness={0.35} /></RoundedBox>
          {/* glass front */}
          <mesh position={[0, 0.9, 0.31]}><planeGeometry args={[0.6, 1.6]} /><meshPhysicalMaterial color="#0a0d13" transparent opacity={0.35} roughness={0.05} transmission={0.4} metalness={0.2} /></mesh>
          {/* dense status LEDs */}
          {Array.from({ length: 8 }).map((_, i) => [-0.18, -0.06, 0.06, 0.18].map((lx, j) => (
            <mesh key={`${i}-${j}`} position={[lx, 0.28 + i * 0.18, 0.315]}><sphereGeometry args={[0.014, 6, 6]} /><meshStandardMaterial color={(i + j) % 3 ? "#10b981" : "#f59e0b"} emissive={(i + j) % 3 ? "#10b981" : "#f59e0b"} emissiveIntensity={1.2} toneMapped={false} /></mesh>
          )))}
        </group>
      ))}
      {/* cable bundles on top */}
      {[-0.3, 0, 0.3].map((x, i) => (
        <mesh key={i} position={[x, 1.84, -0.1]} rotation-x={Math.PI / 2}><torusGeometry args={[0.1, 0.03, 8, 16, Math.PI]} /><meshStandardMaterial color={i % 2 ? "#3a3f48" : "#c0392b"} roughness={0.7} /></mesh>
      ))}
    </group>
  );
}

function HoloGlobe() {
  const R = 0.34;
  return (
    <group>
      {/* dark metal ring base */}
      <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.24, 0.26, 0.06, 24]} /><meshStandardMaterial color="#1a1d23" roughness={0.4} metalness={0.5} /></mesh>
      <mesh position={[0, 0.12, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.22, 0.03, 12, 32]} /><meshStandardMaterial color="#2a2f37" metalness={0.6} roughness={0.3} /></mesh>
      {/* floating cyan wireframe sphere */}
      <mesh position={[0, 0.78, 0]}><sphereGeometry args={[R, 16, 12]} /><meshBasicMaterial color="#38e6ff" wireframe transparent opacity={0.55} toneMapped={false} /></mesh>
      <mesh position={[0, 0.78, 0]}><sphereGeometry args={[R - 0.01, 20, 16]} /><meshStandardMaterial color="#0aa0c0" emissive="#22cfe6" emissiveIntensity={0.5} transparent opacity={0.12} toneMapped={false} /></mesh>
      {/* thin latitude rings */}
      {[-0.18, 0, 0.18].map((yo, i) => {
        const rr = Math.sqrt(Math.max(0, R * R - yo * yo));
        return <mesh key={i} position={[0, 0.78 + yo, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[rr, 0.006, 6, 32]} /><meshBasicMaterial color="#38e6ff" transparent opacity={0.7} toneMapped={false} /></mesh>;
      })}
    </group>
  );
}

function QuantumRig() {
  const plates = [[1.15, 0.32], [0.95, 0.27], [0.75, 0.22], [0.55, 0.17], [0.35, 0.12]] as const;
  return (
    <group>
      {/* dark pedestal */}
      <RoundedBox args={[0.5, 0.3, 0.5]} radius={0.03} position={[0, 0.15, 0]}><meshStandardMaterial color="#15181d" roughness={0.5} metalness={0.3} /></RoundedBox>
      {/* faint cyan base glow */}
      <mesh position={[0, 0.32, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.3, 24]} /><meshBasicMaterial color="#22cfe6" transparent opacity={0.35} toneMapped={false} /></mesh>
      {/* thin rods */}
      {([[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]] as const).map((l, i) => (
        <mesh key={i} position={[l[0], 0.75, l[1]]}><cylinderGeometry args={[0.012, 0.012, 0.9, 8]} /><meshStandardMaterial color="#c9a24a" metalness={0.7} roughness={0.3} /></mesh>
      ))}
      {/* stacked descending gold torus plates */}
      {plates.map((pl, i) => (
        <mesh key={i} position={[0, pl[0], 0]} rotation-x={Math.PI / 2}><torusGeometry args={[pl[1], 0.03, 10, 32]} /><meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.25} /></mesh>
      ))}
    </group>
  );
}

function EspressoRobot() {
  return (
    <group>
      {/* chrome cylinder body */}
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.22, 0.24, 1.0, 24]} /><meshStandardMaterial color="#c7ccd4" metalness={0.85} roughness={0.18} /></mesh>
      <mesh position={[0, 1.0, 0]}><cylinderGeometry args={[0.2, 0.22, 0.12, 24]} /><meshStandardMaterial color="#9aa1ab" metalness={0.7} roughness={0.3} /></mesh>
      {/* green status LED */}
      <mesh position={[0, 0.72, 0.23]}><sphereGeometry args={[0.03, 10, 10]} /><meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.3} toneMapped={false} /></mesh>
      {/* articulated arm holding a cup */}
      <mesh position={[0.18, 0.62, 0.16]} rotation-z={-0.5}><boxGeometry args={[0.28, 0.05, 0.05]} /><meshStandardMaterial color="#8a9099" metalness={0.6} /></mesh>
      <mesh position={[0.32, 0.5, 0.26]}><cylinderGeometry args={[0.03, 0.03, 0.16, 10]} /><meshStandardMaterial color="#8a9099" metalness={0.6} /></mesh>
      <mesh position={[0.32, 0.4, 0.26]}><cylinderGeometry args={[0.05, 0.04, 0.09, 14]} /><meshStandardMaterial color="#efeae0" roughness={0.5} /></mesh>
      {/* drip tray */}
      <mesh position={[0.32, 0.33, 0.26]}><boxGeometry args={[0.16, 0.03, 0.16]} /><meshStandardMaterial color="#4a505a" metalness={0.5} /></mesh>
      {/* steam wand */}
      <mesh position={[-0.16, 0.7, 0.18]} rotation-z={0.4}><cylinderGeometry args={[0.012, 0.012, 0.24, 8]} /><meshStandardMaterial color="#9aa1ab" metalness={0.7} /></mesh>
    </group>
  );
}

function DronePad() {
  const drone = useRef<Group>(null);
  // Gentle idle bob — deterministic (fixed phase, driven by clock.elapsedTime; never Math.random).
  useFrame((st) => {
    if (drone.current) drone.current.position.y = 0.85 + Math.sin(st.clock.elapsedTime * 1.5) * 0.05;
  });
  return (
    <group>
      {/* flat hex landing pad */}
      <mesh position={[0, 0.03, 0]} rotation-y={Math.PI / 6}><cylinderGeometry args={[0.8, 0.8, 0.06, 6]} /><meshStandardMaterial color="#2a2f37" roughness={0.7} /></mesh>
      {/* emissive-yellow perimeter */}
      <mesh position={[0, 0.065, 0]} rotation-x={-Math.PI / 2} rotation-z={Math.PI / 6}><ringGeometry args={[0.66, 0.74, 6]} /><meshBasicMaterial color="#f5c542" transparent opacity={0.9} toneMapped={false} side={2} /></mesh>
      {/* painted "H" */}
      <group position={[0, 0.062, 0]} rotation-x={-Math.PI / 2}>
        {[-0.14, 0.14].map((x, i) => <mesh key={i} position={[x, 0, 0]}><planeGeometry args={[0.06, 0.4]} /><meshBasicMaterial color="#e8ecf2" /></mesh>)}
        <mesh><planeGeometry args={[0.28, 0.06]} /><meshBasicMaterial color="#e8ecf2" /></mesh>
      </group>
      {/* hovering quadcopter */}
      <group ref={drone} position={[0, 0.85, 0]}>
        <RoundedBox args={[0.22, 0.1, 0.22]} radius={0.03} position={[0, 0, 0]}><meshStandardMaterial color="#1a1d23" roughness={0.5} metalness={0.3} /></RoundedBox>
        <mesh position={[0, -0.03, 0]}><sphereGeometry args={[0.05, 10, 10]} /><meshStandardMaterial color="#22cfe6" emissive="#22cfe6" emissiveIntensity={0.9} toneMapped={false} /></mesh>
        {/* crossed arms */}
        {[Math.PI / 4, -Math.PI / 4].map((a, i) => (
          <mesh key={i} rotation-y={a}><boxGeometry args={[0.56, 0.02, 0.02]} /><meshStandardMaterial color="#3a3f48" metalness={0.4} /></mesh>
        ))}
        {/* rotor discs */}
        {([[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] as const).map((l, i) => (
          <mesh key={`rot${i}`} position={[l[0], 0.03, l[1]]}><cylinderGeometry args={[0.1, 0.1, 0.008, 16]} /><meshStandardMaterial color="#5b9dff" transparent opacity={0.35} /></mesh>
        ))}
      </group>
    </group>
  );
}

function ZenFountain() {
  return (
    <group>
      {/* circular stone basin */}
      <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.62, 0.66, 0.2, 32]} /><meshStandardMaterial color="#8a8f96" roughness={0.85} /></mesh>
      <mesh position={[0, 0.19, 0]}><cylinderGeometry args={[0.56, 0.56, 0.04, 32]} /><meshStandardMaterial color="#5a9db8" transparent opacity={0.5} roughness={0.1} metalness={0.2} /></mesh>
      {/* stacked slate discs */}
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.34, 0.38, 0.14, 24]} /><meshStandardMaterial color="#4a5058" roughness={0.7} /></mesh>
      <mesh position={[0, 0.44, 0]}><cylinderGeometry args={[0.22, 0.26, 0.12, 24]} /><meshStandardMaterial color="#565c64" roughness={0.7} /></mesh>
      {/* thin transparent emissive-blue water column */}
      <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.03, 0.04, 0.5, 12]} /><meshStandardMaterial color="#7fd4f0" emissive="#4fbfe8" emissiveIntensity={0.7} transparent opacity={0.6} toneMapped={false} /></mesh>
      {/* ring of pebbles */}
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <mesh key={i} position={[Math.cos(a) * 0.5, 0.22, Math.sin(a) * 0.5]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color={i % 2 ? "#6b7078" : "#565c64"} roughness={0.8} /></mesh>;
      })}
    </group>
  );
}

function TrophyCase({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      {/* cabinet body */}
      <RoundedBox args={[w - 0.1, 1.8, 0.4]} radius={0.03} position={[0, 0.9, 0]}><meshStandardMaterial color={p.deskDark} roughness={0.6} /></RoundedBox>
      {/* warm backlit interior */}
      <mesh position={[0, 0.9, -0.16]}><planeGeometry args={[w - 0.24, 1.6]} /><meshStandardMaterial color="#ffdca0" emissive="#ffcf86" emissiveIntensity={0.5} toneMapped={false} /></mesh>
      {/* glass front */}
      <mesh position={[0, 0.9, 0.2]}><planeGeometry args={[w - 0.18, 1.66]} /><meshPhysicalMaterial color="#cfe0ee" transparent opacity={0.14} roughness={0.05} transmission={0.6} /></mesh>
      {/* shelves with gold trophies + medals */}
      {[0.45, 0.95, 1.45].map((y, s) => (
        <group key={s} position={[0, y, 0]}>
          <mesh position={[0, -0.02, 0]}><boxGeometry args={[w - 0.16, 0.03, 0.34]} /><meshStandardMaterial color={p.desk} roughness={0.6} /></mesh>
          {/* trophy cup: base + stem + bowl */}
          <mesh position={[-0.2, 0.04, 0]}><cylinderGeometry args={[0.05, 0.06, 0.03, 12]} /><meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.3} /></mesh>
          <mesh position={[-0.2, 0.09, 0]}><cylinderGeometry args={[0.012, 0.012, 0.07, 8]} /><meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.3} /></mesh>
          <mesh position={[-0.2, 0.15, 0]}><sphereGeometry args={[0.055, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /><meshStandardMaterial color="#e6c34a" metalness={0.8} roughness={0.3} side={2} /></mesh>
          {/* medal disc */}
          <mesh position={[0.18, 0.08, 0.02]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.06, 0.06, 0.015, 20]} /><meshStandardMaterial color={s % 2 ? "#c0c5cc" : "#d4af37"} metalness={0.7} roughness={0.3} /></mesh>
        </group>
      ))}
    </group>
  );
}

function NapPod() {
  return (
    <group>
      {/* egg-shaped shell, opening facing +z */}
      <mesh position={[0, 0.55, -0.1]} scale={[1, 1.15, 1]}><sphereGeometry args={[0.6, 24, 20]} /><meshStandardMaterial color="#dfe3e8" roughness={0.5} metalness={0.1} /></mesh>
      {/* interior recess */}
      <mesh position={[0, 0.5, 0.05]} scale={[0.8, 0.95, 0.8]}><sphereGeometry args={[0.5, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.7]} /><meshStandardMaterial color="#2f353d" roughness={0.8} side={2} /></mesh>
      {/* privacy hood lip */}
      <mesh position={[0, 0.95, 0.12]} rotation-x={-0.5}><torusGeometry args={[0.42, 0.05, 12, 24, Math.PI]} /><meshStandardMaterial color="#c5cad0" roughness={0.5} /></mesh>
      {/* soft cushion + back pillow */}
      <RoundedBox args={[0.7, 0.16, 0.5]} radius={0.07} position={[0, 0.28, 0.12]}><meshStandardMaterial color={FABRIC_2} roughness={0.85} /></RoundedBox>
      <RoundedBox args={[0.6, 0.3, 0.14]} radius={0.06} position={[0, 0.45, -0.22]}><meshStandardMaterial color={FABRIC} roughness={0.85} /></RoundedBox>
      {/* subtle interior LED */}
      <mesh position={[0, 0.9, -0.3]}><sphereGeometry args={[0.03, 8, 8]} /><meshStandardMaterial color="#8ecbff" emissive="#8ecbff" emissiveIntensity={0.8} toneMapped={false} /></mesh>
    </group>
  );
}

function MicroKitchen({ p }: { p: RoomPalette }) {
  const w = 3 * C;
  return (
    <group>
      {/* lower counter run */}
      <RoundedBox args={[w - 0.1, 0.9, C - 0.15]} radius={0.03} position={[0, 0.45, 0]}><meshStandardMaterial color={p.desk} roughness={0.6} /></RoundedBox>
      <RoundedBox args={[w, 0.06, C - 0.08]} radius={0.02} position={[0, 0.93, 0]}><meshStandardMaterial color="#d9dde4" roughness={0.4} metalness={0.1} /></RoundedBox>
      {/* upper cabinets */}
      <RoundedBox args={[w - 1.0, 0.5, 0.28]} radius={0.03} position={[-0.35, 1.7, -C / 2 + 0.18]}><meshStandardMaterial color={p.deskDark} roughness={0.6} /></RoundedBox>
      {/* sink basin + faucet */}
      <mesh position={[-w / 4, 0.92, 0.02]}><boxGeometry args={[0.3, 0.06, 0.34]} /><meshStandardMaterial color="#8a9099" metalness={0.6} roughness={0.3} /></mesh>
      <mesh position={[-w / 4, 1.02, -0.14]} rotation-x={0.3}><cylinderGeometry args={[0.015, 0.015, 0.14, 8]} /><meshStandardMaterial color="#9aa1ab" metalness={0.7} /></mesh>
      {/* colored mini-fridge */}
      <RoundedBox args={[0.5, 0.86, C - 0.2]} radius={0.03} position={[w / 2 - 0.3, 0.45, 0]}><meshStandardMaterial color="#3f7fbf" roughness={0.5} metalness={0.15} /></RoundedBox>
      <mesh position={[w / 2 - 0.48, 0.55, 0.28]}><boxGeometry args={[0.03, 0.2, 0.02]} /><meshStandardMaterial color="#c0c5cc" metalness={0.5} /></mesh>
      {/* fruit bowl */}
      <mesh position={[0.2, 0.99, 0]}><cylinderGeometry args={[0.11, 0.08, 0.06, 16]} /><meshStandardMaterial color="#c98b5a" roughness={0.5} /></mesh>
      {([["#e2452f", -0.05, -0.03], ["#f0a63a", 0.05, -0.03], ["#7cb342", 0, 0.04]] as const).map((f, i) => (
        <mesh key={i} position={[0.2 + f[1], 1.06, f[2]]}><sphereGeometry args={[0.045, 10, 10]} /><meshStandardMaterial color={f[0]} roughness={0.6} /></mesh>
      ))}
      {/* coffee carafe */}
      <mesh position={[-0.1, 1.02, 0.02]}><cylinderGeometry args={[0.05, 0.055, 0.14, 14]} /><meshStandardMaterial color="#2a2f37" roughness={0.4} /></mesh>
    </group>
  );
}

function FocusPod({ p }: { p: RoomPalette }) {
  return (
    <group>
      {/* corner frame */}
      {([[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]] as const).map((l, i) => (
        <mesh key={i} position={[l[0], 1.0, l[1]]}><boxGeometry args={[0.04, 2.0, 0.04]} /><meshStandardMaterial color={p.metalDark} metalness={0.5} /></mesh>
      ))}
      {/* frosted glass walls */}
      {([[0, -0.4, 0.8, 0], [0, 0.4, 0.8, 0], [-0.4, 0, 0.8, Math.PI / 2], [0.4, 0, 0.8, Math.PI / 2]] as const).map((wl, i) => (
        <mesh key={`g${i}`} position={[wl[0], 1.0, wl[1]]} rotation-y={wl[3]}><planeGeometry args={[wl[2], 1.9]} /><meshPhysicalMaterial color="#e6ecf2" transparent opacity={0.22} roughness={0.4} transmission={0.5} side={2} /></mesh>
      ))}
      {/* roof */}
      <RoundedBox args={[0.86, 0.06, 0.86]} radius={0.02} position={[0, 2.0, 0]}><meshStandardMaterial color={p.deskDark} roughness={0.6} /></RoundedBox>
      {/* door seam */}
      <mesh position={[0.0, 1.0, 0.41]}><boxGeometry args={[0.015, 1.8, 0.01]} /><meshStandardMaterial color={p.metalDark} metalness={0.4} /></mesh>
      {/* interior stool */}
      <mesh position={[0, 0.5, 0.05]}><cylinderGeometry args={[0.14, 0.14, 0.06, 16]} /><meshStandardMaterial color={FABRIC_2} roughness={0.7} /></mesh>
      <mesh position={[0, 0.25, 0.05]}><cylinderGeometry args={[0.03, 0.03, 0.5, 8]} /><meshStandardMaterial color={p.metal} metalness={0.6} /></mesh>
      {/* tiny screen glow */}
      <mesh position={[0, 1.0, -0.36]}><planeGeometry args={[0.3, 0.2]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={0.8} toneMapped={false} /></mesh>
    </group>
  );
}

function IdeaWall({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  const notes = ["#f6c945", "#4e9d6b", "#5b9dff", "#e2452f", "#c77dff", "#f0883a"];
  return (
    <group>
      {/* stand legs + foot */}
      {[-w / 2 + 0.2, w / 2 - 0.2].map((x, i) => <mesh key={i} position={[x, 0.55, 0.06]}><boxGeometry args={[0.05, 1.1, 0.05]} /><meshStandardMaterial color={p.metalDark} metalness={0.4} /></mesh>)}
      <mesh position={[0, 0.06, 0.06]}><boxGeometry args={[w - 0.3, 0.04, 0.4]} /><meshStandardMaterial color={p.metalDark} /></mesh>
      {/* whiteboard */}
      <RoundedBox args={[w - 0.1, 0.9, 0.05]} radius={0.02} position={[0, 1.15, 0]}><meshStandardMaterial color={p.board} roughness={0.5} /></RoundedBox>
      {/* colorful sticky notes */}
      {notes.map((c, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        return <mesh key={i} position={[-0.4 + col * 0.4, 1.32 - row * 0.34, 0.03]} rotation-z={(i % 2 ? 1 : -1) * 0.08}><planeGeometry args={[0.16, 0.16]} /><meshStandardMaterial color={c} roughness={0.7} /></mesh>;
      })}
      {/* marker scribble */}
      <mesh position={[0.44, 1.0, 0.03]} rotation-z={0.2}><planeGeometry args={[0.28, 0.012]} /><meshBasicMaterial color="#e2452f" /></mesh>
      <mesh position={[0.4, 0.92, 0.03]} rotation-z={-0.15}><planeGeometry args={[0.22, 0.012]} /><meshBasicMaterial color="#5b9dff" /></mesh>
    </group>
  );
}

function IndoorTree({ p }: { p: RoomPalette }) {
  return (
    <group>
      {/* planter */}
      <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.32, 0.26, 0.5, 20]} /><meshStandardMaterial color={p.pot} roughness={0.8} /></mesh>
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.32, 0.32, 0.04, 20]} /><meshStandardMaterial color="#3a2a1c" roughness={0.9} /></mesh>
      {/* thick trunk */}
      <mesh position={[0, 0.95, 0]}><cylinderGeometry args={[0.09, 0.13, 0.9, 12]} /><meshStandardMaterial color={WOOD} roughness={0.85} /></mesh>
      {/* broad multi-sphere canopy */}
      {([[0, 1.6, 0, 0.5], [-0.32, 1.45, 0.1, 0.34], [0.3, 1.5, -0.1, 0.36], [0.05, 1.35, 0.3, 0.3], [-0.15, 1.75, -0.15, 0.3]] as const).map((s, i) => (
        <mesh key={i} position={[s[0], s[1], s[2]]}><sphereGeometry args={[s[3], 14, 14]} /><meshStandardMaterial color={i % 2 ? p.plant : "#3c7e54"} roughness={0.85} /></mesh>
      ))}
    </group>
  );
}

function KombuchaTap() {
  return (
    <group>
      {/* stainless keg body */}
      <RoundedBox args={[0.5, 1.1, 0.44]} radius={0.04} position={[0, 0.55, 0]}><meshStandardMaterial color="#b8bec7" metalness={0.7} roughness={0.25} /></RoundedBox>
      {/* chalkboard label */}
      <mesh position={[0, 0.78, 0.225]}><planeGeometry args={[0.38, 0.28]} /><meshStandardMaterial color="#1e2228" roughness={0.8} /></mesh>
      <mesh position={[0, 0.82, 0.23]}><planeGeometry args={[0.24, 0.03]} /><meshBasicMaterial color="#e8ecf2" /></mesh>
      <mesh position={[0, 0.74, 0.23]}><planeGeometry args={[0.16, 0.02]} /><meshBasicMaterial color="#8ecbff" /></mesh>
      {/* tap handles */}
      {[-0.13, 0, 0.13].map((x, i) => (
        <group key={i} position={[x, 0.42, 0.22]}>
          <mesh position={[0, 0, 0.04]}><boxGeometry args={[0.03, 0.08, 0.08]} /><meshStandardMaterial color="#4a505a" metalness={0.6} /></mesh>
          <mesh position={[0, 0.08, 0.02]}><cylinderGeometry args={[0.015, 0.015, 0.12, 8]} /><meshStandardMaterial color={i % 2 ? "#c0392b" : "#2f6f4f"} roughness={0.5} /></mesh>
        </group>
      ))}
      {/* drip tray */}
      <mesh position={[0, 0.32, 0.24]}><boxGeometry args={[0.42, 0.03, 0.12]} /><meshStandardMaterial color="#6b7178" metalness={0.5} /></mesh>
    </group>
  );
}

function RocketModel({ p }: { p: RoomPalette }) {
  return (
    <group>
      {/* stand ring + legs */}
      <mesh position={[0, 0.14, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.16, 0.02, 10, 24]} /><meshStandardMaterial color={p.metalDark} metalness={0.6} /></mesh>
      {([[0.13, -0.13], [0.13, 0.13], [-0.15, 0]] as const).map((l, i) => <mesh key={i} position={[l[0], 0.08, l[1]]}><cylinderGeometry args={[0.012, 0.012, 0.16, 6]} /><meshStandardMaterial color={p.metalDark} metalness={0.6} /></mesh>)}
      {/* white body */}
      <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.11, 0.11, 0.9, 20]} /><meshStandardMaterial color="#eef1f5" roughness={0.4} metalness={0.1} /></mesh>
      {/* cone nose */}
      <mesh position={[0, 1.28, 0]}><coneGeometry args={[0.11, 0.32, 20]} /><meshStandardMaterial color="#d05a51" roughness={0.4} /></mesh>
      {/* window */}
      <mesh position={[0, 0.95, 0.11]}><circleGeometry args={[0.03, 12]} /><meshStandardMaterial color={p.screen} emissive={p.screen} emissiveIntensity={0.5} toneMapped={false} /></mesh>
      {/* dark engine bell */}
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.12, 0.08, 0.14, 16]} /><meshStandardMaterial color="#2a2f37" metalness={0.6} roughness={0.4} /></mesh>
      {/* 4 fins */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.13, 0.34, Math.sin(a) * 0.13]} rotation-y={-a}><boxGeometry args={[0.02, 0.24, 0.14]} /><meshStandardMaterial color="#c0c5cc" metalness={0.3} /></mesh>
      ))}
    </group>
  );
}

function TreeLamp({ p }: { p: RoomPalette }) {
  const arms = [[1.5, 0.35, 0.2], [1.1, -0.3, -0.25], [0.8, 0.25, 0.3]] as const;
  return (
    <group>
      <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.14, 0.16, 0.06, 18]} /><meshStandardMaterial color={p.metalDark} metalness={0.5} /></mesh>
      <mesh position={[0, 0.85, 0]}><cylinderGeometry args={[0.02, 0.02, 1.7, 8]} /><meshStandardMaterial color={p.metalDark} metalness={0.5} /></mesh>
      {arms.map((a, i) => (
        <group key={i}>
          {/* horizontal arm from pole to globe */}
          <mesh position={[a[1] * 0.5, a[0], a[2] * 0.5]} rotation-y={Math.atan2(a[2], a[1])}><boxGeometry args={[Math.hypot(a[1], a[2]), 0.02, 0.02]} /><meshStandardMaterial color={p.metalDark} metalness={0.5} /></mesh>
          {/* warm emissive glass globe */}
          <mesh position={[a[1], a[0], a[2]]}><sphereGeometry args={[0.08, 14, 12]} /><meshStandardMaterial color="#fff2cc" emissive="#ffcf86" emissiveIntensity={1.3} toneMapped={false} transparent opacity={0.92} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Uplight({ p }: { p: RoomPalette }) {
  const hue = "#8b5cf6";
  return (
    <group>
      {/* backing panel */}
      <RoundedBox args={[0.7, 1.2, 0.05]} radius={0.02} position={[0, 0.6, -0.2]}><meshStandardMaterial color={p.deskDark} roughness={0.7} /></RoundedBox>
      {/* colored wash on the panel */}
      <mesh position={[0, 0.6, -0.17]}><planeGeometry args={[0.6, 1.1]} /><meshBasicMaterial color={hue} transparent opacity={0.4} toneMapped={false} /></mesh>
      {/* low floor bar */}
      <RoundedBox args={[0.66, 0.08, 0.14]} radius={0.03} position={[0, 0.05, -0.1]}><meshStandardMaterial color="#1a1d23" roughness={0.5} /></RoundedBox>
      {/* emissive strip */}
      <mesh position={[0, 0.1, -0.05]} rotation-x={-0.5}><planeGeometry args={[0.56, 0.05]} /><meshStandardMaterial color={hue} emissive={hue} emissiveIntensity={1.6} toneMapped={false} /></mesh>
    </group>
  );
}

function PizzaStack() {
  const boxes = [[0.06, 0.04], [0.18, -0.05], [0.3, 0.03], [0.42, -0.02]] as const;
  return (
    <group>
      {boxes.map((b, i) => (
        <RoundedBox key={i} args={[0.44, 0.06, 0.44]} radius={0.015} position={[0, b[0] + 0.03, 0]} rotation-y={b[1]}><meshStandardMaterial color={i % 2 ? "#c9a274" : "#b08a52"} roughness={0.8} /></RoundedBox>
      ))}
      {/* top box lid ajar */}
      <mesh position={[0, 0.5, -0.16]} rotation-x={-0.5}><boxGeometry args={[0.44, 0.02, 0.44]} /><meshStandardMaterial color="#c9a274" roughness={0.8} /></mesh>
      {/* grease-spot label */}
      <mesh position={[0, 0.46, 0.221]}><planeGeometry args={[0.14, 0.08]} /><meshBasicMaterial color="#c0392b" /></mesh>
    </group>
  );
}

function CableSpool() {
  const R = 0.3;
  return (
    <group position={[0, R, 0]} rotation-z={Math.PI / 2}>
      {/* two disc ends */}
      {[-0.22, 0.22].map((y, i) => <mesh key={i} position={[0, y, 0]}><cylinderGeometry args={[R, R, 0.04, 24]} /><meshStandardMaterial color={WOOD} roughness={0.8} /></mesh>)}
      {/* central drum */}
      <mesh position={[0, 0, 0]}><cylinderGeometry args={[0.16, 0.16, 0.42, 20]} /><meshStandardMaterial color="#6b5236" roughness={0.85} /></mesh>
      {/* coiled cable */}
      {[-0.08, 0, 0.08].map((y, i) => <mesh key={`c${i}`} position={[0, y, 0]}><cylinderGeometry args={[0.2, 0.2, 0.06, 20]} /><meshStandardMaterial color="#2a2f37" roughness={0.7} /></mesh>)}
      {/* hub holes */}
      {[-0.24, 0.24].map((y, i) => <mesh key={`h${i}`} position={[0, y, 0]}><cylinderGeometry args={[0.05, 0.05, 0.06, 12]} /><meshStandardMaterial color="#3a3026" /></mesh>)}
    </group>
  );
}

function MascotStandee({ p }: { p: RoomPalette }) {
  const hue = "#4f7bd8";
  return (
    <group>
      {/* easel foot */}
      {[-0.16, 0.16].map((x, i) => <mesh key={i} position={[x, 0.32, 0.14]} rotation-x={0.3}><boxGeometry args={[0.04, 0.64, 0.04]} /><meshStandardMaterial color={p.metalDark} metalness={0.4} /></mesh>)}
      <mesh position={[0, 0.06, 0.16]}><boxGeometry args={[0.42, 0.04, 0.3]} /><meshStandardMaterial color={p.metalDark} /></mesh>
      {/* flat robot-mascot cutout — colored silhouette planes */}
      <group position={[0, 0, -0.02]}>
        <mesh position={[0, 0.62, 0]}><boxGeometry args={[0.5, 0.5, 0.03]} /><meshStandardMaterial color={hue} roughness={0.6} /></mesh>
        <mesh position={[0, 1.0, 0]}><boxGeometry args={[0.42, 0.34, 0.03]} /><meshStandardMaterial color={hue} roughness={0.6} /></mesh>
        {/* antenna */}
        <mesh position={[0, 1.24, 0]}><cylinderGeometry args={[0.012, 0.012, 0.12, 6]} /><meshStandardMaterial color={p.metalDark} /></mesh>
        <mesh position={[0, 1.32, 0]}><sphereGeometry args={[0.03, 8, 8]} /><meshStandardMaterial color="#f5c542" emissive="#f5c542" emissiveIntensity={0.6} toneMapped={false} /></mesh>
        {/* eyes + smile */}
        {[-0.1, 0.1].map((x, i) => <mesh key={i} position={[x, 1.02, 0.02]}><circleGeometry args={[0.05, 14]} /><meshBasicMaterial color="#eef1f5" /></mesh>)}
        {[-0.1, 0.1].map((x, i) => <mesh key={`p${i}`} position={[x, 1.02, 0.025]}><circleGeometry args={[0.02, 10]} /><meshBasicMaterial color="#1a1d23" /></mesh>)}
        <mesh position={[0, 0.66, 0.02]}><boxGeometry args={[0.24, 0.05, 0.01]} /><meshBasicMaterial color="#eef1f5" /></mesh>
      </group>
    </group>
  );
}

/** Render a furniture item by id, centred on the origin. Memoized so the whole layout doesn't
 *  re-render on every drag move / sim tick — only when its type or the palette changes. */
function renderParametric(type: FurnitureId, p: RoomPalette) {
  switch (type) {
    case "desk": return <Desk p={p} />;
    case "deskL": return <DeskL p={p} />;
    case "chair": return <Chair p={p} />;
    case "armchair": return <Armchair />;
    case "sofa": return <Sofa />;
    case "coffeeTable": return <CoffeeTable p={p} />;
    case "meetingTable": return <MeetingTable p={p} />;
    case "bookshelf": return <Bookshelf p={p} />;
    case "cabinet": return <Cabinet p={p} />;
    case "lockers": return <Lockers p={p} />;
    case "plantTall": return <PlantTall p={p} />;
    case "plantPot": return <PlantPot p={p} />;
    case "rug": return <Rug color="#3b4252" />;
    case "rugRound": return <RugRound color="#6b5b95" />;
    case "floorLamp": return <FloorLamp p={p} />;
    case "tvStand": return <TvStand p={p} />;
    case "easel": return <Easel p={p} />;
    case "arcade": return <Arcade p={p} />;
    case "pingpong": return <PingPong p={p} />;
    case "watercooler": return <WaterCooler p={p} />;
    case "serverRack": return <ServerRack p={p} />;
    case "printer": return <Printer p={p} />;
    case "standingDesk": return <StandingDesk p={p} />;
    case "dualDesk": return <DualDesk p={p} />;
    case "reception": return <Reception p={p} />;
    case "stool": return <Stool p={p} />;
    case "beanbag": return <Beanbag />;
    case "gamingChair": return <GamingChair p={p} />;
    case "bench": return <Bench />;
    case "roundTable": return <RoundTable p={p} />;
    case "sideTable": return <SideTable p={p} />;
    case "filingCabinet": return <FilingCabinet p={p} />;
    case "shelfUnit": return <ShelfUnit p={p} />;
    case "crates": return <Crates p={p} />;
    case "cactus": return <Cactus p={p} />;
    case "planterBox": return <PlanterBox p={p} />;
    case "neonSign": return <NeonSign p={p} />;
    case "artStand": return <ArtStand p={p} />;
    case "globe": return <Globe p={p} />;
    case "floorClock": return <FloorClock p={p} />;
    case "sculpture": return <Sculpture p={p} />;
    case "divider": return <Divider p={p} />;
    case "arcLamp": return <ArcLamp p={p} />;
    case "lantern": return <Lantern p={p} />;
    case "foosball": return <Foosball p={p} />;
    case "vending": return <Vending p={p} />;
    case "poolTable": return <PoolTable p={p} />;
    case "treadmill": return <Treadmill p={p} />;
    case "guitar": return <Guitar p={p} />;
    case "robotArm": return <RobotArm p={p} />;
    case "towerPC": return <TowerPC p={p} />;
    case "workbench": return <Workbench p={p} />;
    case "toolCabinet": return <ToolCabinet p={p} />;
    case "tireStack": return <TireStack p={p} />;
    case "ladder": return <Ladder p={p} />;
    case "oilDrum": return <OilDrum />;
    case "executiveDesk": return <ExecutiveDesk p={p} />;
    case "loungeChair": return <LoungeChair />;
    case "sofaL": return <SofaL />;
    case "barTable": return <BarTable p={p} />;
    case "wardrobe": return <Wardrobe p={p} />;
    case "monstera": return <Monstera p={p} />;
    case "bonsai": return <Bonsai p={p} />;
    case "floorVase": return <FloorVase p={p} />;
    case "cubeLamp": return <CubeLamp p={p} />;
    case "coffeeBar": return <CoffeeBar p={p} />;
    // ---- catalog expansion ----
    case "aquarium": return <Aquarium />;
    case "superCluster": return <SuperCluster />;
    case "holoGlobe": return <HoloGlobe />;
    case "quantumRig": return <QuantumRig />;
    case "espressoRobot": return <EspressoRobot />;
    case "dronePad": return <DronePad />;
    case "zenFountain": return <ZenFountain />;
    case "trophyCase": return <TrophyCase p={p} />;
    case "napPod": return <NapPod />;
    case "microKitchen": return <MicroKitchen p={p} />;
    case "focusPod": return <FocusPod p={p} />;
    case "ideaWall": return <IdeaWall p={p} />;
    case "indoorTree": return <IndoorTree p={p} />;
    case "kombuchaTap": return <KombuchaTap />;
    case "rocketModel": return <RocketModel p={p} />;
    case "treeLamp": return <TreeLamp p={p} />;
    case "uplight": return <Uplight p={p} />;
    case "pizzaStack": return <PizzaStack />;
    case "cableSpool": return <CableSpool />;
    case "mascotStandee": return <MascotStandee p={p} />;
    default: return null;
  }
}

const LazyGltf = lazy(() => import("./gltfFurniture.tsx"));

/** Falls back to the parametric piece if a registered glTF model fails to load. Tiny + asset-only. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Render a furniture item by id, centred on the origin. Uses a registered glTF model when one
 *  exists (see furnitureModels.ts), otherwise the premium parametric renderer. Memoized so the
 *  whole layout doesn't re-render on every drag move / sim tick. */
export const FurniturePiece = memo(function FurniturePiece({ type, p }: { type: FurnitureId; p: RoomPalette }) {
  const parametric = renderParametric(type, p);
  const model = modelFor(type);
  if (!model) return parametric;
  const def = FURNITURE.find((f) => f.id === type);
  return (
    <ModelBoundary fallback={parametric}>
      <Suspense fallback={parametric}>
        <LazyGltf
          asset={model}
          footprintW={(def?.w ?? 1) * C}
          footprintD={(def?.d ?? 1) * C}
        />
      </Suspense>
    </ModelBoundary>
  );
});
