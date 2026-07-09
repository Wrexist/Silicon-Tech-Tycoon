// Parametric 3D renderers for each placeable furniture item. Pure primitives, zero assets.
// Every piece is modelled centred on the origin, resting on the floor (y=0 up), sized to its
// grid footprint so the placement wrapper just sets position + Y-rotation.
import { Component, Suspense, lazy, memo, type ReactNode } from "react";
import { RoundedBox } from "@react-three/drei";
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
