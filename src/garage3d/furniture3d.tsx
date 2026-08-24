// Parametric 3D renderers for each placeable furniture item. Pure primitives, zero assets.
// Every piece is modelled centred on the origin, resting on the floor (y=0 up), sized to its
// grid footprint so the placement wrapper just sets position + Y-rotation.
//
// Geometries and materials come from the shared GPU caches (sharedGpu.ts) — passed as mesh
// PROPS, never as JSX children (R3F disposes declarative children on unmount, which would kill
// the shared instance for everyone else). A decorated office renders dozens of pieces; before
// this, every piece allocated its own copy of every geometry/material on every mount. New pieces
// must follow suit — the one exception is a material something mutates per frame, which must stay
// per-instance (none in this file today; DronePad only animates a group transform).
import { Component, Suspense, lazy, memo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide } from "three";
import type { Group } from "three";
import { sharedBasic, sharedBox, sharedCapsule, sharedCircle, sharedCone, sharedCylinder, sharedPhysical, sharedPlane, sharedRing, sharedRounded, sharedSphere, sharedStandard, sharedTorus } from "./sharedGpu.ts";
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

/** What sits ON a desk: the monitor, a keyboard and a mug. The Kenney desk models are bare boards —
 *  they ship with no computer at all, which is why the most common desk in the office read as an
 *  empty table. Rendered as `children` of the GLB so it lands on the model's MEASURED top surface
 *  rather than a guessed height, and authored on the +z (user) side like every parametric desk, so
 *  the desk-facing rotation aims it at the chair. */
function DeskTopKit({ p, w }: { p: RoomPalette; w: number }) {
  const half = (w * C) / 2;
  return (
    <group>
      <group position={[Math.min(0.12, half - 0.42), 0, -0.16]}>
        <Monitor p={p} w={0.6} h={0.36} y={0.32} />
      </group>
      <mesh position={[-0.12, 0.012, 0.13]} rotation-x={-0.04} geometry={sharedBox(0.42, 0.016, 0.15)} material={sharedStandard({ color: "#2a2f37", roughness: 0.6 })} />
      <mesh position={[Math.min(0.5, half - 0.14), 0.045, 0.02]} geometry={sharedCylinder(0.045, 0.04, 0.1, 12)} material={sharedStandard({ color: "#c9743a", roughness: 0.7 })} />
    </group>
  );
}

/** A monitor, modelled the way a real one reads at this camera.
 *
 *  The occupant sits on the far side of the desk facing the camera, so a screen that correctly faces
 *  THEM is pointed away from us — there is no swivel that fixes that (break-even is 48° off-axis, by
 *  which point the panel no longer faces the person at all). Which is fine, because that isn't how
 *  you tell a monitor is on when you're standing behind someone: you see the LIGHT IT THROWS. So this
 *  models the light rather than cheating the panel:
 *
 *    • `bleed`  — the halo escaping around the panel's edges, the classic backlight glow you see from
 *                 behind any lit screen. Slightly larger than the panel, sitting just behind it.
 *    • `pool`   — the patch of screen-light thrown forward onto the desktop, on the user's side.
 *    • `spill`  — a soft upward wash in front of the panel, which catches the seated robot's face.
 *
 *  The panel itself is a thin bezelled slab tilted back ~8°, on a slim neck and a weighted base —
 *  the silhouette of a real monitor rather than a slab on a stick. */
function Monitor({
  p, w = 0.66, h = 0.38, y = 0.4, tilt = 0.14, pool = true,
}: { p: RoomPalette; w?: number; h?: number; y?: number; tilt?: number; pool?: boolean }) {
  const bezel = 0.028;
  return (
    <group>
      {/* neck + weighted base */}
      <mesh position={[0, y - h / 2 - 0.07, 0.01]} geometry={sharedBox(0.05, 0.16, 0.035)} material={sharedStandard({ color: p.metalDark, metalness: 0.55, roughness: 0.35 })} />
      <mesh position={[0, y - h / 2 - 0.15, 0.045]} geometry={sharedBox(0.2, 0.016, 0.13)} material={sharedStandard({ color: p.metalDark, metalness: 0.55, roughness: 0.35 })} />

      <group position={[0, y, 0]} rotation-x={-tilt}>
        {/* thin bezelled panel */}
        <mesh geometry={sharedRounded(w, h, 0.016, 2, 0.006)} material={sharedStandard({ color: p.metalDark, metalness: 0.35, roughness: 0.45 })} />
        {/* the lit face — toward the person */}
        <mesh position={[0, 0, 0.0095]} geometry={sharedPlane(w - bezel * 2, h - bezel * 2)} material={sharedStandard({ color: p.screen, emissive: p.screen, emissiveIntensity: 1.4, toneMapped: false })} />
        {/* Backlight bleed — the fringe of light escaping around a lit panel, which is what you
            actually see of a monitor from behind. These sit on the USER's side (+z) and are wider
            than the panel, so the opaque slab masks their middle and only the halo around the
            silhouette reaches the camera. Putting them on the camera side instead just paints the
            whole monitor pale blue — it stops reading as a monitor at all. DoubleSide because the
            face pointing at the camera is their back. */}
        <mesh position={[0, 0, 0.013]} geometry={sharedPlane(w + 0.11, h + 0.11)} material={sharedBasic({ color: p.screen, transparent: true, opacity: 0.62, depthWrite: false, side: DoubleSide })} />
      </group>

      {/* the light the screen throws forward: a pool on the desktop and a soft wash that catches
          whoever is sitting in it */}
      {pool && (
        <>
          <mesh rotation-x={-Math.PI / 2} position={[0, y - h / 2 - 0.153, 0.22]} geometry={sharedPlane(w + 0.18, 0.36)} material={sharedBasic({ color: p.screen, transparent: true, opacity: 0.3, depthWrite: false, side: DoubleSide })} />
        </>
      )}
    </group>
  );
}

function Desk({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <mesh position={[0, 0.74, 0]} geometry={sharedRounded(w - 0.12, 0.06, C - 0.12, 2, 0.02)} material={sharedStandard({ color: p.desk, roughness: 0.6 })} />
      {([[-w / 2 + 0.18, -C / 2 + 0.16], [w / 2 - 0.18, -C / 2 + 0.16], [-w / 2 + 0.18, C / 2 - 0.16], [w / 2 - 0.18, C / 2 - 0.16]] as const).map((l, i) => (
        <mesh key={i} position={[l[0], 0.37, l[1]]} geometry={sharedBox(0.08, 0.74, 0.08)} material={sharedStandard({ color: p.deskDark })} />
      ))}
      {/* A real workstation: a large monitor on a stand, keyboard + mouse, and a mug — so even the
          starter desk clearly reads as "a computer", not a bare table. */}
      <group position={[0.12, 0.78, -0.18]}>
        <Monitor p={p} w={0.66} h={0.4} y={0.36} />
      </group>
      {/* keyboard + mouse on the desktop */}
      <mesh position={[-0.14, 0.785, 0.12]} geometry={sharedBox(0.46, 0.03, 0.17)} material={sharedStandard({ color: "#2a2f37", roughness: 0.6 })} />
      <mesh position={[0.2, 0.785, 0.14]} geometry={sharedBox(0.08, 0.03, 0.11)} material={sharedStandard({ color: "#2a2f37", roughness: 0.6 })} />
      {/* a coffee mug for life */}
      <mesh position={[-0.44, 0.83, 0.0]} geometry={sharedCylinder(0.05, 0.045, 0.11, 12)} material={sharedStandard({ color: "#c9743a", roughness: 0.7 })} />
    </group>
  );
}

function DeskL({ p }: { p: RoomPalette }) {
  const a = 2 * C;
  return (
    <group>
      <mesh position={[0, 0.74, -C / 2 + 0.04]} geometry={sharedRounded(a - 0.12, 0.06, C - 0.1, 4, 0.02)} material={sharedStandard({ color: p.desk, roughness: 0.6 })} />
      <mesh position={[-a / 2 + C / 2, 0.74, C / 2 - 0.04]} geometry={sharedRounded(C - 0.1, 0.06, a - 0.12, 4, 0.02)} material={sharedStandard({ color: p.desk, roughness: 0.6 })} />
      {([[-a / 2 + 0.15, -C + 0.2], [a / 2 - 0.15, -C + 0.2], [-a / 2 + 0.15, C - 0.2]] as const).map((l, i) => (
        <mesh key={i} position={[l[0], 0.37, l[1]]} geometry={sharedBox(0.08, 0.74, 0.08)} material={sharedStandard({ color: p.deskDark })} />
      ))}
      <group position={[0.25, 0.78, -C / 2 - 0.18]}>
        <Monitor p={p} w={0.6} h={0.36} y={0.4} />
      </group>
    </group>
  );
}

function Chair({ p, hue = FABRIC }: { p: RoomPalette; hue?: string }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} geometry={sharedRounded(0.46, 0.1, 0.46, 4, 0.05)} material={sharedStandard({ color: hue, roughness: 0.7 })} />
      <mesh position={[0, 0.78, -0.2]} geometry={sharedRounded(0.46, 0.5, 0.1, 4, 0.05)} material={sharedStandard({ color: hue, roughness: 0.7 })} />
      <mesh position={[0, 0.28, 0]} geometry={sharedCylinder(0.04, 0.04, 0.4, 8)} material={sharedStandard({ color: p.metalDark, metalness: 0.5 })} />
      <mesh position={[0, 0.08, 0]} geometry={sharedCylinder(0.24, 0.26, 0.05, 5)} material={sharedStandard({ color: p.metalDark, metalness: 0.5 })} />
    </group>
  );
}

function Armchair({ hue = FABRIC_2 }: { hue?: string }) {
  return (
    <group>
      <mesh position={[0, 0.26, 0]} geometry={sharedRounded(0.6, 0.26, 0.58, 4, 0.08)} material={sharedStandard({ color: hue, roughness: 0.8 })} />
      <mesh position={[0, 0.5, -0.24]} geometry={sharedRounded(0.6, 0.5, 0.14, 4, 0.08)} material={sharedStandard({ color: hue, roughness: 0.8 })} />
      {[-0.3, 0.3].map((x, i) => (
        <mesh key={i} position={[x, 0.36, 0]} geometry={sharedRounded(0.12, 0.32, 0.56, 4, 0.06)} material={sharedStandard({ color: hue, roughness: 0.8 })} />
      ))}
    </group>
  );
}

function Sofa({ hue = FABRIC }: { hue?: string }) {
  const w = 2 * C;
  return (
    <group>
      <mesh position={[0, 0.26, 0.04]} geometry={sharedRounded(w - 0.1, 0.26, C - 0.06, 4, 0.08)} material={sharedStandard({ color: hue, roughness: 0.85 })} />
      <mesh position={[0, 0.5, -C / 2 + 0.08]} geometry={sharedRounded(w - 0.1, 0.46, 0.16, 4, 0.08)} material={sharedStandard({ color: hue, roughness: 0.85 })} />
      {[-w / 2 + 0.12, w / 2 - 0.12].map((x, i) => (
        <mesh key={i} position={[x, 0.42, 0.04]} geometry={sharedRounded(0.16, 0.4, C - 0.04, 4, 0.07)} material={sharedStandard({ color: hue, roughness: 0.85 })} />
      ))}
      {[-w / 4, w / 4].map((x, i) => (
        <mesh key={i} position={[x, 0.42, 0.06]} geometry={sharedRounded(w / 2 - 0.24, 0.12, C - 0.18, 4, 0.05)} material={sharedStandard({ color: FABRIC_2, roughness: 0.8 })} />
      ))}
    </group>
  );
}

function CoffeeTable({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <mesh position={[0, 0.36, 0]} geometry={sharedRounded(w - 0.2, 0.06, C - 0.14, 4, 0.03)} material={sharedStandard({ color: p.desk, roughness: 0.5 })} />
      {([[-w / 2 + 0.18, -C / 2 + 0.18], [w / 2 - 0.18, -C / 2 + 0.18], [-w / 2 + 0.18, C / 2 - 0.18], [w / 2 - 0.18, C / 2 - 0.18]] as const).map((l, i) => (
        <mesh key={i} position={[l[0], 0.18, l[1]]} geometry={sharedBox(0.06, 0.36, 0.06)} material={sharedStandard({ color: p.deskDark })} />
      ))}
      <mesh position={[0.2, 0.42, 0]} geometry={sharedBox(0.3, 0.04, 0.22)} material={sharedStandard({ color: BOOKS[0], roughness: 0.6 })} />
      <mesh position={[-0.25, 0.46, 0.04]} geometry={sharedCylinder(0.07, 0.08, 0.16, 10)} material={sharedStandard({ color: p.plant, roughness: 0.8 })} />
    </group>
  );
}

function MeetingTable({ p }: { p: RoomPalette }) {
  const w = 3 * C, d = 2 * C;
  return (
    <group>
      <mesh position={[0, 0.74, 0]} geometry={sharedRounded(w - 0.3, 0.08, d - 0.5, 4, 0.06)} material={sharedStandard({ color: p.desk, roughness: 0.5 })} />
      <mesh position={[0, 0.36, 0]} geometry={sharedBox(0.16, 0.72, d - 0.9)} material={sharedStandard({ color: p.deskDark })} />
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
      <mesh position={[0, 0.95, 0]} geometry={sharedRounded(C - 0.1, 1.9, 0.4, 4, 0.02)} material={sharedStandard({ color: p.deskDark, roughness: 0.7 })} />
      {[0.35, 0.78, 1.21, 1.64].map((y, s) => (
        <group key={s} position={[0, y, 0.06]}>
          {Array.from({ length: 5 }).map((_, i) => (
            <mesh key={i} position={[-0.26 + i * 0.13, 0.13, 0]} geometry={sharedBox(0.1, 0.26 - (i % 3) * 0.03, 0.26)} material={sharedStandard({ color: BOOKS[(s + i) % BOOKS.length], roughness: 0.7 })} />
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
      <mesh position={[0, 0.4, 0]} geometry={sharedRounded(w - 0.1, 0.8, C - 0.1, 4, 0.03)} material={sharedStandard({ color: p.desk, roughness: 0.6 })} />
      {[-w / 4, w / 4].map((x, i) => (
        <mesh key={i} position={[x, 0.4, C / 2 - 0.04]} geometry={sharedBox(w / 2 - 0.12, 0.7, 0.03)} material={sharedStandard({ color: p.deskDark, roughness: 0.5 })} />
      ))}
      {[-0.06, 0.06].map((x, i) => (
        <mesh key={i} position={[x + (i ? w / 4 : -w / 4), 0.4, C / 2 - 0.01]} geometry={sharedSphere(0.03, 8, 8)} material={sharedStandard({ color: p.metal, metalness: 0.6 })} />
      ))}
    </group>
  );
}

function Lockers({ p }: { p: RoomPalette }) {
  return (
    <group>
      {[-0.2, 0.2].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[0, 0.85, 0]} geometry={sharedRounded(0.38, 1.7, 0.5, 4, 0.02)} material={sharedStandard({ color: i ? "#3f6f9c" : "#4b7aa6", roughness: 0.5, metalness: 0.2 })} />
          <mesh position={[0.12, 1.0, 0.26]} geometry={sharedBox(0.02, 0.1, 0.02)} material={sharedStandard({ color: p.metalDark, metalness: 0.6 })} />
          {[0.6, 1.2].map((y, j) => <mesh key={j} position={[0, y, 0.255]} geometry={sharedPlane(0.3, 0.02)} material={sharedStandard({ color: p.metalDark })} />)}
        </group>
      ))}
    </group>
  );
}

function PlantTall({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} geometry={sharedCylinder(0.18, 0.22, 0.5, 12)} material={sharedStandard({ color: p.pot, roughness: 0.8 })} />
      <mesh position={[0, 0.95, 0]} geometry={sharedCone(0.34, 1.0, 10)} material={sharedStandard({ color: p.plant, roughness: 0.85 })} />
      <mesh position={[0, 1.35, 0]} geometry={sharedCone(0.24, 0.7, 10)} material={sharedStandard({ color: p.plant, roughness: 0.85 })} />
    </group>
  );
}

function PlantPot({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]} geometry={sharedCylinder(0.18, 0.14, 0.32, 12)} material={sharedStandard({ color: p.pot, roughness: 0.8 })} />
      <mesh position={[0, 0.46, 0]} geometry={sharedSphere(0.28, 14, 14)} material={sharedStandard({ color: p.plant, roughness: 0.85 })} />
    </group>
  );
}

function Rug({ color }: { color: string }) {
  const w = 3 * C, d = 2 * C;
  return (
    <group position={[0, 0.02, 0]}>
      <mesh rotation-x={-Math.PI / 2} geometry={sharedPlane(w - 0.1, d - 0.1)} material={sharedStandard({ color, roughness: 0.95 })} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]} geometry={sharedPlane(w - 0.4, d - 0.4)} material={sharedStandard({ color: FABRIC_2, roughness: 0.95 })} />
    </group>
  );
}

function RugRound({ color }: { color: string }) {
  const r = C;
  return (
    <group position={[0, 0.02, 0]}>
      <mesh rotation-x={-Math.PI / 2} geometry={sharedCircle(r - 0.06, 36)} material={sharedStandard({ color, roughness: 0.95 })} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]} geometry={sharedCircle(r - 0.22, 36)} material={sharedStandard({ color: FABRIC, roughness: 0.95 })} />
    </group>
  );
}

function FloorLamp({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} geometry={sharedCylinder(0.16, 0.18, 0.06, 16)} material={sharedStandard({ color: p.metalDark, metalness: 0.5 })} />
      <mesh position={[0, 0.8, 0]} geometry={sharedCylinder(0.02, 0.02, 1.6, 8)} material={sharedStandard({ color: p.metalDark, metalness: 0.5 })} />
      <mesh position={[0, 1.62, 0]} geometry={sharedCone(0.22, 0.26, 18, 1, true)} material={sharedStandard({ color: p.lamp, emissive: p.lamp, emissiveIntensity: 0.5, side: 2 })} />
      <mesh position={[0, 1.55, 0]} geometry={sharedSphere(0.08, 10, 10)} material={sharedStandard({ color: "#fff2cc", emissive: "#fff2cc", emissiveIntensity: 1.4, toneMapped: false })} />
    </group>
  );
}

function TvStand({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <mesh position={[0, 0.2, 0]} geometry={sharedRounded(w - 0.1, 0.4, C - 0.2, 4, 0.03)} material={sharedStandard({ color: p.deskDark, roughness: 0.6 })} />
      <mesh position={[0, 0.85, -0.05]} geometry={sharedBox(w - 0.3, 0.74, 0.05)} material={sharedStandard({ color: "#0a0d13", metalness: 0.4, roughness: 0.4 })} />
      <mesh position={[0, 0.85, -0.02]} geometry={sharedPlane(w - 0.4, 0.64)} material={sharedStandard({ color: p.screen, emissive: p.screen, emissiveIntensity: 0.9, toneMapped: false })} />
    </group>
  );
}

function Easel({ p }: { p: RoomPalette }) {
  return (
    <group>
      {[[-0.28, 0.18], [0.28, 0.18], [0, -0.26]].map((l, i) => (
        <mesh key={i} position={[l[0], 0.5, l[1]]} rotation-x={l[1] < 0 ? 0.16 : -0.1} geometry={sharedCylinder(0.025, 0.025, 1.1, 8)} material={sharedStandard({ color: p.deskDark })} />
      ))}
      <group position={[0, 1.0, 0.05]} rotation-x={-0.38}>
        <mesh position={[0, 0, 0]} geometry={sharedRounded(0.8, 0.62, 0.04, 4, 0.02)} material={sharedStandard({ color: p.metal, metalness: 0.3 })} />
        <mesh position={[0, 0, 0.025]} geometry={sharedPlane(0.72, 0.54)} material={sharedStandard({ color: p.board })} />
        <mesh position={[-0.05, 0.08, 0.03]} geometry={sharedPlane(0.5, 0.01)} material={sharedBasic({ color: "#3b82f6" })} />
        <mesh position={[0.1, -0.08, 0.03]} rotation-z={0.1} geometry={sharedPlane(0.4, 0.01)} material={sharedBasic({ color: "#1eb877" })} />
      </group>
    </group>
  );
}

function Arcade({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.75, 0]} geometry={sharedRounded(0.5, 1.5, 0.5, 4, 0.04)} material={sharedStandard({ color: "#5b2bd0", roughness: 0.5 })} />
      <mesh position={[0, 1.12, 0.22]} rotation-x={-0.25} geometry={sharedPlane(0.4, 0.34)} material={sharedStandard({ color: p.screen, emissive: p.screen, emissiveIntensity: 1.2, toneMapped: false })} />
      <mesh position={[0, 0.82, 0.26]} rotation-x={0.5} geometry={sharedBox(0.42, 0.18, 0.04)} material={sharedStandard({ color: "#2a1d40" })} />
      <mesh position={[-0.1, 0.86, 0.27]} geometry={sharedSphere(0.03, 8, 8)} material={sharedStandard({ color: "#ef4444", emissive: "#ef4444", emissiveIntensity: 0.8, toneMapped: false })} />
      <mesh position={[0.08, 0.86, 0.27]} geometry={sharedSphere(0.03, 8, 8)} material={sharedStandard({ color: "#f59e0b", emissive: "#f59e0b", emissiveIntensity: 0.8, toneMapped: false })} />
      <mesh position={[0, 1.46, 0]} geometry={sharedBox(0.5, 0.12, 0.5)} material={sharedStandard({ color: p.screen, emissive: p.screen, emissiveIntensity: 0.5 })} />
    </group>
  );
}

function PingPong({ p }: { p: RoomPalette }) {
  const w = 3 * C, d = 2 * C;
  return (
    <group>
      <mesh position={[0, 0.74, 0]} geometry={sharedRounded(w - 0.3, 0.05, d - 0.4, 4, 0.01)} material={sharedStandard({ color: "#1c6b4a", roughness: 0.7 })} />
      <mesh position={[0, 0.77, 0]} geometry={sharedBox(w - 0.3, 0.005, 0.01)} material={sharedBasic({ color: "#ffffff" })} />
      <mesh position={[0, 0.86, 0]} geometry={sharedBox(0.02, 0.18, d - 0.4)} material={sharedStandard({ color: "#ffffff", transparent: true, opacity: 0.7 })} />
      {([[-w / 2 + 0.2, -d / 2 + 0.2], [w / 2 - 0.2, -d / 2 + 0.2], [-w / 2 + 0.2, d / 2 - 0.2], [w / 2 - 0.2, d / 2 - 0.2]] as const).map((l, i) => (
        <mesh key={i} position={[l[0], 0.37, l[1]]} geometry={sharedBox(0.06, 0.74, 0.06)} material={sharedStandard({ color: p.metalDark })} />
      ))}
    </group>
  );
}

function WaterCooler(_: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} geometry={sharedRounded(0.4, 0.9, 0.4, 4, 0.03)} material={sharedStandard({ color: "#e9edf2", roughness: 0.4 })} />
      <mesh position={[0, 1.12, 0]} geometry={sharedCylinder(0.16, 0.18, 0.4, 14)} material={sharedStandard({ color: "#7fb6f0", transparent: true, opacity: 0.5, roughness: 0.1 })} />
      <mesh position={[0, 0.55, 0.21]} geometry={sharedBox(0.12, 0.08, 0.04)} material={sharedStandard({ color: "#3b82f6" })} />
      <mesh position={[0, 0.62, 0.21]} geometry={sharedBox(0.12, 0.05, 0.04)} material={sharedStandard({ color: "#ef4444" })} />
    </group>
  );
}

function ServerRack({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.85, 0]} geometry={sharedRounded(0.5, 1.7, 0.55, 4, 0.02)} material={sharedStandard({ color: "#1a1d23", roughness: 0.5, metalness: 0.3 })} />
      {Array.from({ length: 7 }).map((_, i) => (
        <group key={i} position={[0, 0.3 + i * 0.2, 0.28]}>
          <mesh geometry={sharedBox(0.42, 0.16, 0.02)} material={sharedStandard({ color: "#2a2f37" })} />
          <mesh position={[-0.15, 0, 0.02]} geometry={sharedSphere(0.018, 6, 6)} material={sharedStandard({ color: i % 2 ? "#10b981" : p.screen, emissive: i % 2 ? "#10b981" : p.screen, emissiveIntensity: 1.1, toneMapped: false })} />
          <mesh position={[-0.1, 0, 0.02]} geometry={sharedSphere(0.018, 6, 6)} material={sharedStandard({ color: "#f59e0b", emissive: "#f59e0b", emissiveIntensity: 0.9, toneMapped: false })} />
        </group>
      ))}
    </group>
  );
}

function Printer({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.3, 0]} geometry={sharedRounded(0.55, 0.55, 0.55, 4, 0.03)} material={sharedStandard({ color: p.metalDark, roughness: 0.5, metalness: 0.2 })} />
      <mesh position={[0, 0.62, 0]} geometry={sharedBox(0.5, 0.05, 0.5)} material={sharedStandard({ color: p.screen, emissive: p.screen, emissiveIntensity: 0.7, toneMapped: false })} />
      <mesh position={[0, 0.32, 0.28]} geometry={sharedPlane(0.16, 0.1)} material={sharedStandard({ color: p.screen, emissive: p.screen, emissiveIntensity: 1.0, toneMapped: false })} />
    </group>
  );
}

// ---------------- Modern office + garage additions ----------------
function StandingDesk({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <mesh position={[0, 1.02, 0]} geometry={sharedRounded(w - 0.12, 0.06, C - 0.12, 4, 0.02)} material={sharedStandard({ color: p.desk, roughness: 0.6 })} />
      {[-w / 2 + 0.2, w / 2 - 0.2].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[0, 0.51, 0]} geometry={sharedBox(0.1, 1.0, 0.1)} material={sharedStandard({ color: p.metalDark, metalness: 0.4 })} />
          <mesh position={[0, 0.03, 0]} geometry={sharedBox(0.5, 0.06, 0.5)} material={sharedStandard({ color: p.metalDark, metalness: 0.4 })} />
        </group>
      ))}
      <group position={[0.1, 1.06, -0.18]}>
        <Monitor p={p} w={0.6} h={0.36} y={0.34} />
      </group>
    </group>
  );
}

function DualDesk({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <mesh position={[0, 0.74, 0]} geometry={sharedRounded(w - 0.12, 0.06, C - 0.12, 4, 0.02)} material={sharedStandard({ color: p.desk, roughness: 0.6 })} />
      {([[-w / 2 + 0.18, -C / 2 + 0.16], [w / 2 - 0.18, -C / 2 + 0.16], [-w / 2 + 0.18, C / 2 - 0.16], [w / 2 - 0.18, C / 2 - 0.16]] as const).map((l, i) => (
        <mesh key={i} position={[l[0], 0.37, l[1]]} geometry={sharedBox(0.07, 0.74, 0.07)} material={sharedStandard({ color: p.deskDark })} />
      ))}
      {/* a paired setup, each panel toed in toward the seat like a real two-monitor rig */}
      {[-0.34, 0.34].map((x, i) => (
        <group key={i} position={[x, 0.78, -0.2]} rotation-y={i ? -0.16 : 0.16}>
          <Monitor p={p} w={0.54} h={0.32} y={0.3} pool={i === 0} />
        </group>
      ))}
      <mesh position={[0, 0.79, 0.16]} geometry={sharedBox(0.5, 0.02, 0.16)} material={sharedStandard({ color: "#15181d" })} />
    </group>
  );
}

function Reception({ p }: { p: RoomPalette }) {
  const w = 3 * C;
  return (
    <group>
      <mesh position={[0, 0.45, -0.1]} geometry={sharedRounded(w - 0.1, 0.9, C - 0.2, 4, 0.05)} material={sharedStandard({ color: p.desk, roughness: 0.6 })} />
      <mesh position={[0, 1.0, C / 2 - 0.16]} geometry={sharedRounded(w + 0.1, 0.24, 0.18, 4, 0.06)} material={sharedStandard({ color: p.deskDark, roughness: 0.5 })} />
      <mesh position={[0, 0.5, C / 2 - 0.02]} geometry={sharedPlane(w - 0.4, 0.6)} material={sharedStandard({ color: p.screen, emissive: p.screen, emissiveIntensity: 0.25, roughness: 0.4 })} />
    </group>
  );
}

function Stool({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.74, 0]} geometry={sharedCylinder(0.18, 0.18, 0.07, 16)} material={sharedStandard({ color: FABRIC_2, roughness: 0.7 })} />
      <mesh position={[0, 0.37, 0]} geometry={sharedCylinder(0.04, 0.04, 0.74, 8)} material={sharedStandard({ color: p.metal, metalness: 0.6 })} />
      <mesh position={[0, 0.28, 0]} geometry={sharedTorus(0.16, 0.02, 6, 18)} material={sharedStandard({ color: p.metalDark, metalness: 0.5 })} />
      <mesh position={[0, 0.02, 0]} geometry={sharedCylinder(0.22, 0.24, 0.04, 16)} material={sharedStandard({ color: p.metalDark, metalness: 0.5 })} />
    </group>
  );
}

function Beanbag({ hue = "#e0843c" }: { hue?: string }) {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} scale={[1, 0.55, 1]} geometry={sharedSphere(0.4, 18, 16)} material={sharedStandard({ color: hue, roughness: 0.9 })} />
      <mesh position={[0, 0.34, -0.12]} scale={[0.8, 0.5, 0.6]} geometry={sharedSphere(0.32, 16, 14)} material={sharedStandard({ color: hue, roughness: 0.9 })} />
    </group>
  );
}

function GamingChair({ p }: { p: RoomPalette }) {
  const hue = "#e23b3b";
  return (
    <group>
      <mesh position={[0, 0.5, 0]} geometry={sharedRounded(0.5, 0.12, 0.5, 4, 0.06)} material={sharedStandard({ color: "#15181d", roughness: 0.6 })} />
      <mesh position={[0, 0.92, -0.22]} geometry={sharedRounded(0.5, 0.74, 0.12, 4, 0.08)} material={sharedStandard({ color: "#15181d", roughness: 0.6 })} />
      {[-0.2, 0.2].map((x, i) => <mesh key={i} position={[x, 0.92, -0.18]} geometry={sharedRounded(0.1, 0.62, 0.14, 4, 0.05)} material={sharedStandard({ color: hue, roughness: 0.6 })} />)}
      {[-0.26, 0.26].map((x, i) => <mesh key={i} position={[x, 0.62, 0]} geometry={sharedRounded(0.08, 0.16, 0.34, 4, 0.03)} material={sharedStandard({ color: "#15181d" })} />)}
      <mesh position={[0, 0.28, 0]} geometry={sharedCylinder(0.05, 0.05, 0.4, 8)} material={sharedStandard({ color: p.metalDark, metalness: 0.6 })} />
      <mesh position={[0, 0.06, 0]} geometry={sharedCylinder(0.26, 0.28, 0.04, 5)} material={sharedStandard({ color: p.metalDark, metalness: 0.6 })} />
    </group>
  );
}

function Bench({ hue = FABRIC }: { hue?: string }) {
  const w = 2 * C;
  return (
    <group>
      <mesh position={[0, 0.44, 0]} geometry={sharedRounded(w - 0.1, 0.16, C - 0.3, 4, 0.05)} material={sharedStandard({ color: hue, roughness: 0.85 })} />
      {[-w / 2 + 0.18, w / 2 - 0.18].map((x, i) => <mesh key={i} position={[x, 0.18, 0]} geometry={sharedBox(0.08, 0.36, C - 0.34)} material={sharedStandard({ color: "#3a3f48", metalness: 0.3 })} />)}
    </group>
  );
}

function RoundTable({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.74, 0]} geometry={sharedCylinder(C - 0.16, C - 0.16, 0.06, 36)} material={sharedStandard({ color: p.desk, roughness: 0.5 })} />
      <mesh position={[0, 0.37, 0]} geometry={sharedCylinder(0.07, 0.07, 0.72, 12)} material={sharedStandard({ color: p.deskDark })} />
      <mesh position={[0, 0.03, 0]} geometry={sharedCylinder(0.34, 0.36, 0.05, 24)} material={sharedStandard({ color: p.deskDark })} />
    </group>
  );
}

function SideTable({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} geometry={sharedRounded(0.5, 0.05, 0.5, 4, 0.03)} material={sharedStandard({ color: p.desk, roughness: 0.5 })} />
      {([[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]] as const).map((l, i) => <mesh key={i} position={[l[0], 0.25, l[1]]} geometry={sharedBox(0.04, 0.5, 0.04)} material={sharedStandard({ color: p.deskDark })} />)}
      <mesh position={[0, 0.58, 0]} geometry={sharedCylinder(0.06, 0.07, 0.16, 10)} material={sharedStandard({ color: p.plant })} />
    </group>
  );
}

function FilingCabinet({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} geometry={sharedRounded(0.5, 1.0, 0.55, 4, 0.02)} material={sharedStandard({ color: p.metal, metalness: 0.3, roughness: 0.5 })} />
      {[0.24, 0.5, 0.76].map((y, i) => (
        <group key={i} position={[0, y, 0.28]}>
          <mesh geometry={sharedBox(0.44, 0.22, 0.02)} material={sharedStandard({ color: p.metalDark, roughness: 0.5 })} />
          <mesh position={[0, 0, 0.02]} geometry={sharedBox(0.14, 0.03, 0.02)} material={sharedStandard({ color: p.metalDark, metalness: 0.6 })} />
        </group>
      ))}
    </group>
  );
}

function ShelfUnit({ p }: { p: RoomPalette }) {
  return (
    <group>
      {[-0.24, 0.24].map((x, i) => <mesh key={i} position={[x, 0.85, -0.2]} geometry={sharedBox(0.05, 1.7, 0.05)} material={sharedStandard({ color: p.deskDark })} />)}
      {[-0.24, 0.24].map((x, i) => <mesh key={`f${i}`} position={[x, 0.85, 0.2]} geometry={sharedBox(0.05, 1.7, 0.05)} material={sharedStandard({ color: p.deskDark })} />)}
      {[0.2, 0.7, 1.2, 1.65].map((y, s) => (
        <group key={s}>
          <mesh position={[0, y, 0]} geometry={sharedBox(0.56, 0.04, 0.5)} material={sharedStandard({ color: p.desk, roughness: 0.6 })} />
          {s < 3 && <mesh position={[-0.1 + (s % 2) * 0.2, y + 0.16, 0]} geometry={sharedBox(0.2, 0.26, 0.3)} material={sharedStandard({ color: BOOKS[(s + 1) % BOOKS.length], roughness: 0.7 })} />}
        </group>
      ))}
    </group>
  );
}

function Crates({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.23, 0]} geometry={sharedRounded(0.5, 0.46, 0.5, 4, 0.02)} material={sharedStandard({ color: p.box, roughness: 0.85 })} />
      <mesh position={[0.05, 0.66, -0.04]} rotation-y={0.3} geometry={sharedRounded(0.42, 0.4, 0.42, 4, 0.02)} material={sharedStandard({ color: WOOD, roughness: 0.85 })} />
      <mesh position={[0, 0.23, 0.255]} geometry={sharedBox(0.5, 0.05, 0.01)} material={sharedStandard({ color: WOOD })} />
    </group>
  );
}

function Cactus({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]} geometry={sharedCylinder(0.16, 0.13, 0.32, 12)} material={sharedStandard({ color: "#d98a4a", roughness: 0.8 })} />
      <mesh position={[0, 0.6, 0]} geometry={sharedCapsule(0.1, 0.5, 4, 10)} material={sharedStandard({ color: p.plant, roughness: 0.8 })} />
      <mesh position={[0.13, 0.66, 0]} rotation-z={-0.5} geometry={sharedCapsule(0.05, 0.22, 4, 8)} material={sharedStandard({ color: p.plant, roughness: 0.8 })} />
      <mesh position={[-0.13, 0.74, 0]} rotation-z={0.5} geometry={sharedCapsule(0.05, 0.2, 4, 8)} material={sharedStandard({ color: p.plant, roughness: 0.8 })} />
    </group>
  );
}

function PlanterBox({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <mesh position={[0, 0.15, 0]} geometry={sharedRounded(w - 0.2, 0.3, C - 0.3, 4, 0.03)} material={sharedStandard({ color: p.pot, roughness: 0.8 })} />
      {[-w / 3, 0, w / 3].map((x, i) => <mesh key={i} position={[x, 0.5, 0]} geometry={sharedSphere(0.22, 12, 12)} material={sharedStandard({ color: p.plant, roughness: 0.85 })} />)}
    </group>
  );
}

function NeonSign({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.6, 0]} geometry={sharedCylinder(0.03, 0.03, 1.2, 8)} material={sharedStandard({ color: p.metalDark })} />
      <mesh position={[0, 0.03, 0]} geometry={sharedCylinder(0.16, 0.18, 0.06, 12)} material={sharedStandard({ color: p.metalDark })} />
      <mesh position={[0, 1.2, 0]} geometry={sharedTorus(0.26, 0.04, 10, 28)} material={sharedStandard({ color: "#ff4fd8", emissive: "#ff4fd8", emissiveIntensity: 1.6, toneMapped: false })} />
      <mesh position={[0, 1.2, 0.01]} geometry={sharedBox(0.04, 0.34, 0.04)} material={sharedStandard({ color: "#54e0ff", emissive: "#54e0ff", emissiveIntensity: 1.6, toneMapped: false })} />
    </group>
  );
}

function ArtStand(_: { p: RoomPalette }) {
  return (
    <group>
      {[[-0.2, 0.14], [0.2, 0.14], [0, -0.2]].map((l, i) => <mesh key={i} position={[l[0], 0.5, l[1]]} rotation-x={l[1] < 0 ? 0.14 : -0.1} geometry={sharedCylinder(0.022, 0.022, 1.0, 8)} material={sharedStandard({ color: WOOD })} />)}
      <group position={[0, 0.92, 0.04]} rotation-x={-0.32}>
        <mesh position={[0, 0, 0]} geometry={sharedRounded(0.66, 0.5, 0.04, 4, 0.01)} material={sharedStandard({ color: "#2a2623" })} />
        <mesh position={[0, 0, 0.025]} geometry={sharedPlane(0.58, 0.42)} material={sharedStandard({ color: "#e8e2d6" })} />
        <mesh position={[-0.1, 0.05, 0.03]} geometry={sharedPlane(0.2, 0.2)} material={sharedBasic({ color: "#f59e0b" })} />
        <mesh position={[0.12, -0.06, 0.03]} geometry={sharedCircle(0.1, 16)} material={sharedBasic({ color: "#3b82f6" })} />
      </group>
    </group>
  );
}

function Globe({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]} geometry={sharedCylinder(0.04, 0.16, 0.32, 4)} material={sharedStandard({ color: WOOD })} />
      <mesh position={[0, 0.62, 0]} rotation-z={0.4} geometry={sharedTorus(0.26, 0.018, 8, 28)} material={sharedStandard({ color: p.metal, metalness: 0.6 })} />
      <mesh position={[0, 0.62, 0]} rotation-z={0.4} geometry={sharedSphere(0.24, 20, 16)} material={sharedStandard({ color: "#2f6f9e", roughness: 0.6 })} />
    </group>
  );
}

function FloorClock({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.85, 0]} geometry={sharedRounded(0.4, 1.7, 0.28, 4, 0.03)} material={sharedStandard({ color: WOOD, roughness: 0.6 })} />
      <mesh position={[0, 1.45, 0.15]} rotation-x={Math.PI / 2} geometry={sharedCylinder(0.15, 0.15, 0.03, 24)} material={sharedStandard({ color: "#f4efe6" })} />
      <mesh position={[0, 1.49, 0.18]} geometry={sharedBox(0.015, 0.08, 0.01)} material={sharedStandard({ color: "#1a1d23" })} />
      <mesh position={[0.04, 1.45, 0.18]} geometry={sharedBox(0.06, 0.015, 0.01)} material={sharedStandard({ color: "#1a1d23" })} />
      <mesh position={[0, 0.9, 0.16]} geometry={sharedSphere(0.05, 12, 12)} material={sharedStandard({ color: p.lamp, emissive: p.lamp, emissiveIntensity: 0.5 })} />
    </group>
  );
}

function Sculpture({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} geometry={sharedCylinder(0.2, 0.22, 0.2, 16)} material={sharedStandard({ color: p.metalDark, roughness: 0.4 })} />
      <mesh position={[0, 0.5, 0]} rotation-x={0.5} rotation-z={0.4} geometry={sharedTorus(0.22, 0.07, 12, 28)} material={sharedStandard({ color: "#d4af37", metalness: 0.7, roughness: 0.3 })} />
      <mesh position={[0, 0.85, 0]} geometry={sharedCone(0.12, 0.3, 4)} material={sharedStandard({ color: "#c0c5cc", metalness: 0.6, roughness: 0.3 })} />
    </group>
  );
}

function Divider({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      {[-1, 0, 1].map((s, i) => (
        <group key={i} position={[s * (w / 3.2), 0, s * 0.12]} rotation-y={s * 0.3}>
          <mesh position={[0, 0.78, 0]} geometry={sharedRounded(w / 3, 1.5, 0.05, 4, 0.02)} material={sharedStandard({ color: i % 2 ? p.deskDark : p.desk, roughness: 0.7 })} />
        </group>
      ))}
    </group>
  );
}

function ArcLamp({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} geometry={sharedCylinder(0.2, 0.22, 0.06, 20)} material={sharedStandard({ color: p.metalDark, metalness: 0.5 })} />
      <mesh position={[0, 1.0, -0.1]} geometry={sharedCylinder(0.025, 0.025, 1.9, 8)} material={sharedStandard({ color: p.metalDark, metalness: 0.5 })} />
      <mesh position={[0.18, 1.9, 0.1]} rotation-z={-0.9} geometry={sharedCylinder(0.025, 0.025, 0.7, 8)} material={sharedStandard({ color: p.metalDark, metalness: 0.5 })} />
      <mesh position={[0.42, 1.78, 0.18]} geometry={sharedSphere(0.12, 14, 12)} material={sharedStandard({ color: "#fff2cc", emissive: "#fff2cc", emissiveIntensity: 1.5, toneMapped: false })} />
    </group>
  );
}

function Lantern({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} geometry={sharedCylinder(0.02, 0.02, 1.0, 6)} material={sharedStandard({ color: p.metalDark })} />
      <mesh position={[0, 0.03, 0]} geometry={sharedCylinder(0.14, 0.16, 0.05, 12)} material={sharedStandard({ color: p.metalDark })} />
      <mesh position={[0, 1.1, 0]} geometry={sharedSphere(0.22, 16, 14)} material={sharedStandard({ color: "#ffd98a", emissive: "#ffcf72", emissiveIntensity: 1.1, toneMapped: false, transparent: true, opacity: 0.92 })} />
    </group>
  );
}

function Foosball({ p }: { p: RoomPalette }) {
  const w = 3 * C, d = 2 * C;
  return (
    <group>
      <mesh position={[0, 0.74, 0]} geometry={sharedRounded(w - 0.3, 0.18, d - 0.4, 4, 0.03)} material={sharedStandard({ color: "#1c6b4a", roughness: 0.7 })} />
      <mesh position={[0, 0.84, -d / 2 + 0.18]} geometry={sharedRounded(w - 0.2, 0.2, 0.12, 4, 0.03)} material={sharedStandard({ color: p.deskDark })} />
      <mesh position={[0, 0.84, d / 2 - 0.18]} geometry={sharedRounded(w - 0.2, 0.2, 0.12, 4, 0.03)} material={sharedStandard({ color: p.deskDark })} />
      {[-0.7, -0.2, 0.3, 0.8].map((x, i) => <mesh key={i} position={[x, 0.95, 0]} rotation-x={Math.PI / 2} geometry={sharedCylinder(0.025, 0.025, d + 0.2, 8)} material={sharedStandard({ color: i % 2 ? "#e23b3b" : "#3b82f6", metalness: 0.4 })} />)}
      {([[-0.78, -0.2], [0.88, 0.2]] as const).map((l, i) => <mesh key={i} position={[l[0], 0.74, l[1]]} geometry={sharedBox(0.1, 0.74, 0.1)} material={sharedStandard({ color: p.metalDark })} />)}
    </group>
  );
}

function Vending({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.85, 0]} geometry={sharedRounded(0.56, 1.7, 0.5, 4, 0.03)} material={sharedStandard({ color: "#b83232", roughness: 0.5 })} />
      <mesh position={[0.08, 1.05, 0.255]} geometry={sharedBox(0.34, 0.9, 0.02)} material={sharedStandard({ color: "#0a0d13" })} />
      <mesh position={[0.08, 1.05, 0.27]} geometry={sharedPlane(0.3, 0.86)} material={sharedStandard({ color: p.screen, emissive: p.screen, emissiveIntensity: 0.5 })} />
      {[0, 1, 2].map((r) => [0, 1].map((c) => <mesh key={`${r}-${c}`} position={[-0.02 + c * 0.12, 0.78 + r * 0.24, 0.275]} geometry={sharedBox(0.07, 0.12, 0.02)} material={sharedStandard({ color: BOOKS[(r + c) % BOOKS.length], emissive: BOOKS[(r + c) % BOOKS.length], emissiveIntensity: 0.3 })} />))}
      <mesh position={[-0.16, 0.45, 0.255]} geometry={sharedBox(0.18, 0.16, 0.04)} material={sharedStandard({ color: "#15181d" })} />
    </group>
  );
}

function PoolTable(_: { p: RoomPalette }) {
  const w = 3 * C, d = 2 * C;
  return (
    <group>
      <mesh position={[0, 0.66, 0]} geometry={sharedRounded(w - 0.2, 0.16, d - 0.2, 4, 0.04)} material={sharedStandard({ color: "#7a3b1e", roughness: 0.6 })} />
      <mesh position={[0, 0.75, 0]} geometry={sharedBox(w - 0.5, 0.04, d - 0.5)} material={sharedStandard({ color: "#1c6b4a", roughness: 0.8 })} />
      {([[-w / 2 + 0.25, -d / 2 + 0.25], [0, -d / 2 + 0.22], [w / 2 - 0.25, -d / 2 + 0.25], [-w / 2 + 0.25, d / 2 - 0.25], [0, d / 2 - 0.22], [w / 2 - 0.25, d / 2 - 0.25]] as const).map((l, i) => <mesh key={i} position={[l[0], 0.78, l[1]]} geometry={sharedCylinder(0.06, 0.06, 0.04, 12)} material={sharedStandard({ color: "#0a0d13" })} />)}
      {[["#f59e0b", -0.3], ["#ef4444", -0.15], ["#3b82f6", 0], ["#ffffff", 0.4]].map((b, i) => <mesh key={i} position={[b[1] as number, 0.81, 0]} geometry={sharedSphere(0.05, 12, 12)} material={sharedStandard({ color: b[0] as string, roughness: 0.3 })} />)}
      {([[-w / 2 + 0.2, -d / 2 + 0.2], [w / 2 - 0.2, -d / 2 + 0.2], [-w / 2 + 0.2, d / 2 - 0.2], [w / 2 - 0.2, d / 2 - 0.2]] as const).map((l, i) => <mesh key={`leg${i}`} position={[l[0], 0.33, l[1]]} geometry={sharedBox(0.12, 0.66, 0.12)} material={sharedStandard({ color: "#5a2c16" })} />)}
    </group>
  );
}

function Treadmill({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <mesh position={[0, 0.18, 0.06]} geometry={sharedRounded(w - 0.3, 0.12, C - 0.2, 4, 0.03)} material={sharedStandard({ color: "#15181d", roughness: 0.7 })} />
      <mesh position={[0, 0.25, 0.06]} geometry={sharedBox(w - 0.5, 0.02, C - 0.36)} material={sharedStandard({ color: "#2a2f37", roughness: 0.85 })} />
      {[-w / 2 + 0.18, w / 2 - 0.18].map((x, i) => <mesh key={i} position={[x, 0.7, -C / 2 + 0.2]} geometry={sharedBox(0.06, 1.0, 0.06)} material={sharedStandard({ color: p.metal, metalness: 0.5 })} />)}
      <mesh position={[0, 1.2, -C / 2 + 0.22]} geometry={sharedBox(w - 0.4, 0.3, 0.06)} material={sharedStandard({ color: "#1a1d23" })} />
      <mesh position={[0, 1.2, -C / 2 + 0.26]} geometry={sharedPlane(0.3, 0.2)} material={sharedStandard({ color: p.screen, emissive: p.screen, emissiveIntensity: 0.9, toneMapped: false })} />
    </group>
  );
}

function Guitar({ p }: { p: RoomPalette }) {
  return (
    <group rotation-z={0.12}>
      <mesh position={[0, 0.3, 0]} scale={[1, 1, 0.4]} geometry={sharedSphere(0.18, 16, 14)} material={sharedStandard({ color: "#c0392b", roughness: 0.4 })} />
      <mesh position={[0, 0.85, 0]} geometry={sharedBox(0.07, 0.9, 0.04)} material={sharedStandard({ color: WOOD, roughness: 0.5 })} />
      <mesh position={[0, 1.34, 0]} geometry={sharedBox(0.1, 0.16, 0.05)} material={sharedStandard({ color: "#1a1d23" })} />
      <mesh position={[0.16, 0.28, 0.08]} rotation-z={-0.4} geometry={sharedCylinder(0.02, 0.02, 0.7, 6)} material={sharedStandard({ color: p.metalDark })} />
    </group>
  );
}

function RobotArm({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} geometry={sharedCylinder(0.18, 0.22, 0.2, 16)} material={sharedStandard({ color: "#f97316", roughness: 0.4, metalness: 0.2 })} />
      <mesh position={[0, 0.42, 0]} geometry={sharedCylinder(0.1, 0.12, 0.4, 12)} material={sharedStandard({ color: p.metal, metalness: 0.5 })} />
      <mesh position={[0.0, 0.72, 0.16]} rotation-x={0.7} geometry={sharedBox(0.08, 0.5, 0.08)} material={sharedStandard({ color: "#f97316", metalness: 0.3 })} />
      <mesh position={[0.0, 0.95, 0.42]} rotation-x={-0.5} geometry={sharedBox(0.07, 0.36, 0.07)} material={sharedStandard({ color: p.metal, metalness: 0.5 })} />
      <mesh position={[0, 0.86, 0.56]} geometry={sharedSphere(0.06, 10, 10)} material={sharedStandard({ color: "#10b981", emissive: "#10b981", emissiveIntensity: 0.8, toneMapped: false })} />
    </group>
  );
}

function TowerPC({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[-0.18, 0.35, 0]} geometry={sharedRounded(0.3, 0.7, 0.55, 4, 0.02)} material={sharedStandard({ color: "#15181d", roughness: 0.4, metalness: 0.2 })} />
      <mesh position={[-0.04, 0.45, 0]} geometry={sharedBox(0.01, 0.5, 0.4)} material={sharedStandard({ color: p.screen, emissive: p.screen, emissiveIntensity: 0.9, toneMapped: false })} />
      <group position={[0.2, 0, 0]}>
        <mesh position={[0, 0.55, 0]} geometry={sharedBox(0.5, 0.32, 0.04)} material={sharedStandard({ color: "#0a0d13" })} />
        <mesh position={[0, 0.55, 0.022]} geometry={sharedPlane(0.44, 0.26)} material={sharedStandard({ color: p.screen, emissive: p.screen, emissiveIntensity: 1.1, toneMapped: false })} />
        <mesh position={[0, 0.2, 0]} geometry={sharedBox(0.04, 0.36, 0.04)} material={sharedStandard({ color: p.metalDark })} />
        <mesh position={[0, 0.02, 0]} geometry={sharedCylinder(0.12, 0.14, 0.03, 16)} material={sharedStandard({ color: p.metalDark })} />
      </group>
    </group>
  );
}

function Workbench({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <mesh position={[0, 0.86, 0]} geometry={sharedRounded(w - 0.1, 0.1, C - 0.1, 4, 0.02)} material={sharedStandard({ color: WOOD, roughness: 0.7 })} />
      {([[-w / 2 + 0.16, -C / 2 + 0.16], [w / 2 - 0.16, -C / 2 + 0.16], [-w / 2 + 0.16, C / 2 - 0.16], [w / 2 - 0.16, C / 2 - 0.16]] as const).map((l, i) => <mesh key={i} position={[l[0], 0.43, l[1]]} geometry={sharedBox(0.1, 0.86, 0.1)} material={sharedStandard({ color: "#3a3026" })} />)}
      {/* pegboard back with tools */}
      <mesh position={[0, 1.4, -C / 2 + 0.06]} geometry={sharedBox(w - 0.2, 0.9, 0.04)} material={sharedStandard({ color: "#caa15a", roughness: 0.8 })} />
      <mesh position={[-0.3, 1.4, -C / 2 + 0.1]} geometry={sharedBox(0.04, 0.4, 0.06)} material={sharedStandard({ color: p.metalDark, metalness: 0.5 })} />
      <mesh position={[0.0, 1.3, -C / 2 + 0.1]} rotation-z={0.3} geometry={sharedCylinder(0.03, 0.03, 0.4, 8)} material={sharedStandard({ color: p.metal, metalness: 0.5 })} />
      {/* vise */}
      <mesh position={[w / 2 - 0.3, 0.96, 0.1]} geometry={sharedBox(0.18, 0.14, 0.16)} material={sharedStandard({ color: "#4b7aa6", metalness: 0.4 })} />
    </group>
  );
}

function ToolCabinet({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.55, 0]} geometry={sharedRounded(0.6, 1.0, 0.5, 4, 0.03)} material={sharedStandard({ color: "#c0392b", roughness: 0.4, metalness: 0.2 })} />
      {[0.3, 0.55, 0.8].map((y, i) => (
        <group key={i} position={[0, y, 0.26]}>
          <mesh geometry={sharedBox(0.52, 0.2, 0.02)} material={sharedStandard({ color: "#a52f24" })} />
          <mesh position={[0, 0, 0.02]} geometry={sharedBox(0.3, 0.03, 0.02)} material={sharedStandard({ color: p.metalDark, metalness: 0.6 })} />
        </group>
      ))}
      {[-0.22, 0.22].map((x, i) => <mesh key={i} position={[x, 0.06, 0]} rotation-x={Math.PI / 2} geometry={sharedCylinder(0.07, 0.07, 0.06, 14)} material={sharedStandard({ color: "#15181d" })} />)}
    </group>
  );
}

function TireStack({ p }: { p: RoomPalette }) {
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[(i % 2) * 0.04, 0.14 + i * 0.22, 0]} rotation-x={Math.PI / 2} geometry={sharedTorus(0.26, 0.12, 12, 24)} material={sharedStandard({ color: "#1a1d23", roughness: 0.85 })} />
      ))}
      <mesh position={[0.04, 0.58, 0]} rotation-x={Math.PI / 2} geometry={sharedCylinder(0.16, 0.16, 0.06, 18)} material={sharedStandard({ color: p.metal, metalness: 0.5 })} />
    </group>
  );
}

function Ladder({ p }: { p: RoomPalette }) {
  return (
    <group>
      {[-0.18, 0.18].map((x, i) => (
        <group key={i}>
          <mesh position={[x, 0.55, -0.18]} rotation-x={-0.18} geometry={sharedBox(0.05, 1.15, 0.05)} material={sharedStandard({ color: "#d8a23a", metalness: 0.3 })} />
          <mesh position={[x, 0.55, 0.18]} rotation-x={0.18} geometry={sharedBox(0.05, 1.15, 0.05)} material={sharedStandard({ color: "#d8a23a", metalness: 0.3 })} />
        </group>
      ))}
      {[0.28, 0.56, 0.84].map((y, i) => <mesh key={i} position={[0, y, -0.18 + (y - 0.28) * 0.32]} geometry={sharedBox(0.42, 0.04, 0.12)} material={sharedStandard({ color: "#b9842a", metalness: 0.3 })} />)}
      <mesh position={[0, 1.06, 0]} geometry={sharedBox(0.46, 0.06, 0.3)} material={sharedStandard({ color: p.metalDark, metalness: 0.3 })} />
    </group>
  );
}

function OilDrum() {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} geometry={sharedCylinder(0.26, 0.26, 0.9, 24)} material={sharedStandard({ color: "#2f6f4f", roughness: 0.5, metalness: 0.3 })} />
      {[0.25, 0.65].map((y, i) => <mesh key={i} position={[0, y, 0]} rotation-x={Math.PI / 2} geometry={sharedTorus(0.265, 0.02, 8, 24)} material={sharedStandard({ color: "#244f3a", metalness: 0.3 })} />)}
      <mesh position={[0.1, 0.9, 0.1]} geometry={sharedCylinder(0.04, 0.04, 0.04, 10)} material={sharedStandard({ color: "#1a1d23" })} />
    </group>
  );
}

// ---------------- Premium catalog expansion ----------------
function ExecutiveDesk({ p }: { p: RoomPalette }) {
  const w = 3 * C, d = 2 * C;
  return (
    <group>
      <mesh position={[0, 0.76, 0]} geometry={sharedRounded(w - 0.2, 0.08, d - 0.4, 3, 0.04)} material={sharedStandard({ color: WOOD, roughness: 0.4 })} />
      {/* solid plinth bases instead of legs — reads premium */}
      {[-w / 2 + 0.4, w / 2 - 0.4].map((x, i) => (
        <mesh key={i} position={[x, 0.38, 0]} geometry={sharedRounded(0.3, 0.72, d - 0.7, 4, 0.04)} material={sharedStandard({ color: p.deskDark, roughness: 0.5 })} />
      ))}
      <mesh position={[0, 0.805, -0.25]} geometry={sharedBox(0.62, 0.02, 0.4)} material={sharedStandard({ color: "#15181d" })} />
      <group position={[0.55, 0.81, -0.35]}>
        <Monitor p={p} w={0.62} h={0.36} y={0.34} />
      </group>
    </group>
  );
}

function LoungeChair({ hue = FABRIC_2 }: { hue?: string }) {
  return (
    <group>
      <mesh position={[0, 0.32, 0.04]} geometry={sharedRounded(0.62, 0.22, 0.6, 4, 0.1)} material={sharedStandard({ color: hue, roughness: 0.85 })} />
      <mesh position={[0, 0.55, -0.24]} rotation-x={-0.18} geometry={sharedRounded(0.62, 0.5, 0.16, 4, 0.12)} material={sharedStandard({ color: hue, roughness: 0.85 })} />
      {[-0.32, 0.32].map((x, i) => <mesh key={i} position={[x, 0.42, 0.04]} geometry={sharedRounded(0.1, 0.26, 0.5, 4, 0.05)} material={sharedStandard({ color: hue, roughness: 0.85 })} />)}
      {/* splayed wooden legs */}
      {([[-0.24, -0.22], [0.24, -0.22], [-0.24, 0.24], [0.24, 0.24]] as const).map((l, i) => <mesh key={i} position={[l[0], 0.1, l[1]]} rotation-z={l[0] < 0 ? 0.12 : -0.12} geometry={sharedCylinder(0.03, 0.025, 0.24, 8)} material={sharedStandard({ color: WOOD })} />)}
    </group>
  );
}

function SofaL({ hue = FABRIC }: { hue?: string }) {
  const a = 2 * C;
  return (
    <group>
      {/* main run */}
      <mesh position={[0, 0.26, C / 2 - 0.02]} geometry={sharedRounded(a - 0.1, 0.26, C - 0.06, 4, 0.08)} material={sharedStandard({ color: hue, roughness: 0.85 })} />
      <mesh position={[0, 0.48, C - 0.06]} geometry={sharedRounded(a - 0.1, 0.44, 0.16, 4, 0.08)} material={sharedStandard({ color: hue, roughness: 0.85 })} />
      {/* return leg (forms the L) */}
      <mesh position={[-a / 2 + C / 2, 0.26, -0.1]} geometry={sharedRounded(C - 0.06, 0.26, a - 0.5, 4, 0.08)} material={sharedStandard({ color: hue, roughness: 0.85 })} />
      <mesh position={[-a / 2 + 0.08, 0.48, -0.1]} geometry={sharedRounded(0.16, 0.44, a - 0.5, 4, 0.08)} material={sharedStandard({ color: hue, roughness: 0.85 })} />
      {/* seat cushions */}
      {[-a / 4, a / 4].map((x, i) => <mesh key={i} position={[x, 0.42, C / 2 - 0.02]} geometry={sharedRounded(a / 2 - 0.2, 0.12, C - 0.2, 4, 0.05)} material={sharedStandard({ color: FABRIC_2, roughness: 0.8 })} />)}
    </group>
  );
}

function BarTable({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 1.04, 0]} geometry={sharedCylinder(0.28, 0.28, 0.05, 28)} material={sharedStandard({ color: p.desk, roughness: 0.4 })} />
      <mesh position={[0, 0.52, 0]} geometry={sharedCylinder(0.04, 0.04, 1.0, 12)} material={sharedStandard({ color: p.metalDark, metalness: 0.6, roughness: 0.3 })} />
      <mesh position={[0, 0.03, 0]} geometry={sharedCylinder(0.26, 0.28, 0.05, 24)} material={sharedStandard({ color: p.metalDark, metalness: 0.6 })} />
    </group>
  );
}

function Wardrobe({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.95, 0]} geometry={sharedRounded(0.6, 1.9, 0.55, 4, 0.03)} material={sharedStandard({ color: p.desk, roughness: 0.6 })} />
      <mesh position={[-0.001, 0.95, 0.28]} geometry={sharedBox(0.02, 1.8, 0.02)} material={sharedStandard({ color: p.deskDark })} />
      {[-0.15, 0.15].map((x, i) => <mesh key={i} position={[x, 0.95, 0.29]} geometry={sharedBox(0.02, 0.3, 0.02)} material={sharedStandard({ color: p.metal, metalness: 0.6 })} />)}
    </group>
  );
}

function Monstera({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} geometry={sharedCylinder(0.17, 0.14, 0.4, 14)} material={sharedStandard({ color: "#e8e2d6", roughness: 0.7 })} />
      {[[0.18, 0.7, 0.3], [-0.16, 0.85, -0.2], [0.05, 1.05, 0.1], [-0.2, 1.0, 0.25], [0.22, 1.15, -0.15]].map((l, i) => (
        <mesh key={i} position={[l[0], l[1], l[2]]} rotation-z={l[0] * 0.8} rotation-x={l[2] * 0.6} scale={[1, 1, 0.4]} geometry={sharedSphere(0.22, 10, 10)} material={sharedStandard({ color: p.plant, roughness: 0.85 })} />
      ))}
    </group>
  );
}

function Bonsai({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]} geometry={sharedRounded(0.4, 0.16, 0.28, 4, 0.03)} material={sharedStandard({ color: p.pot, roughness: 0.8 })} />
      <mesh position={[0.02, 0.4, 0]} rotation-z={-0.2} geometry={sharedCylinder(0.03, 0.05, 0.4, 8)} material={sharedStandard({ color: WOOD, roughness: 0.8 })} />
      {[[-0.12, 0.6], [0.14, 0.58], [0.02, 0.7]].map((l, i) => <mesh key={i} position={[l[0], l[1], 0]} scale={[1.4, 0.6, 1.4]} geometry={sharedSphere(0.14, 10, 10)} material={sharedStandard({ color: p.plant, roughness: 0.85 })} />)}
    </group>
  );
}

function FloorVase({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.4, 0]} geometry={sharedCylinder(0.12, 0.18, 0.8, 18)} material={sharedStandard({ color: "#c08a5a", roughness: 0.35, metalness: 0.1 })} />
      <mesh position={[0, 0.82, 0]} geometry={sharedCylinder(0.1, 0.12, 0.12, 18)} material={sharedStandard({ color: "#b07a48", roughness: 0.4 })} />
      {[[-0.05, 1.1], [0.06, 1.15], [0, 1.05]].map((l, i) => <mesh key={i} position={[l[0], l[1], 0]} rotation-z={l[0] * 3} geometry={sharedCylinder(0.01, 0.01, 0.5, 5)} material={sharedStandard({ color: p.plant, roughness: 0.8 })} />)}
    </group>
  );
}

function CubeLamp({ p }: { p: RoomPalette }) {
  return (
    <group>
      <mesh position={[0, 0.28, 0]} geometry={sharedBox(0.34, 0.56, 0.34)} material={sharedStandard({ color: "#fff2cc", emissive: "#ffe9b0", emissiveIntensity: 0.9, toneMapped: false, transparent: true, opacity: 0.92 })} />
      <mesh position={[0, 0.01, 0]} geometry={sharedBox(0.36, 0.04, 0.36)} material={sharedStandard({ color: p.metalDark, metalness: 0.5 })} />
    </group>
  );
}

function CoffeeBar({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      <mesh position={[0, 0.46, 0]} geometry={sharedRounded(w - 0.1, 0.92, C - 0.2, 4, 0.04)} material={sharedStandard({ color: p.deskDark, roughness: 0.6 })} />
      <mesh position={[0, 0.95, 0]} geometry={sharedRounded(w, 0.06, C - 0.12, 4, 0.02)} material={sharedStandard({ color: p.desk, roughness: 0.4 })} />
      {/* espresso machine */}
      <mesh position={[-w / 4, 1.18, -0.04]} geometry={sharedRounded(0.42, 0.4, 0.34, 4, 0.05)} material={sharedStandard({ color: p.metal, metalness: 0.6, roughness: 0.3 })} />
      <mesh position={[-w / 4, 1.0, 0.16]} geometry={sharedCylinder(0.04, 0.05, 0.1, 12)} material={sharedStandard({ color: p.metalDark, metalness: 0.7 })} />
      <mesh position={[-w / 4 + 0.16, 1.26, 0.12]} geometry={sharedSphere(0.022, 8, 8)} material={sharedStandard({ color: "#10b981", emissive: "#10b981", emissiveIntensity: 1.2, toneMapped: false })} />
      {/* cups + a mug */}
      {[0.1, 0.24, 0.38].map((x, i) => <mesh key={i} position={[x, 1.04, -0.08]} geometry={sharedCylinder(0.05, 0.045, 0.1, 12)} material={sharedStandard({ color: "#efeae0", roughness: 0.5 })} />)}
      <mesh position={[w / 4, 1.04, 0.16]} geometry={sharedCylinder(0.055, 0.05, 0.11, 14)} material={sharedStandard({ color: "#d98a4a", roughness: 0.5 })} />
    </group>
  );
}

// ---------------- Furniture catalog expansion (premium office + tech) ----------------
function Aquarium() {
  const w = 3 * C;
  return (
    <group>
      {/* dark-wood cabinet */}
      <mesh position={[0, 0.36, 0]} geometry={sharedRounded(w - 0.1, 0.72, C - 0.1, 4, 0.03)} material={sharedStandard({ color: "#2e2016", roughness: 0.6 })} />
      {/* faint blue emissive backlight */}
      <mesh position={[0, 1.02, -C / 2 + 0.07]} geometry={sharedPlane(w - 0.24, 0.5)} material={sharedStandard({ color: "#2a6fae", emissive: "#2f7fd0", emissiveIntensity: 0.6, toneMapped: false })} />
      {/* water body — transparent bluish glass */}
      <mesh position={[0, 1.02, 0]} geometry={sharedBox(w - 0.22, 0.5, C - 0.24)} material={sharedPhysical({ color: "#7fc4e8", transparent: true, opacity: 0.32, roughness: 0.08, transmission: 0.6, thickness: 0.4 })} />
      {/* glass tank shell */}
      <mesh position={[0, 1.02, 0]} geometry={sharedBox(w - 0.2, 0.52, C - 0.22)} material={sharedStandard({ color: "#9fb4c4", transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.3 })} />
      {/* emissive coral cones */}
      {([[-0.9, "#ff7043"], [-0.2, "#ffb74d"], [0.7, "#ef5a8a"]] as const).map((c, i) => (
        <mesh key={i} position={[c[0], 0.86, 0.05]} geometry={sharedCone(0.06, 0.28, 8)} material={sharedStandard({ color: c[1], emissive: c[1], emissiveIntensity: 0.5, roughness: 0.6 })} />
      ))}
      {/* tiny fish */}
      {([[-0.5, 1.12, 0.18], [0.3, 1.0, -0.14], [0.9, 1.15, 0.1]] as const).map((f, i) => (
        <mesh key={`f${i}`} position={[f[0], f[1], f[2]]} rotation-y={i * 0.6} geometry={sharedBox(0.09, 0.05, 0.03)} material={sharedStandard({ color: i % 2 ? "#ffd54f" : "#ff8a65", emissive: i % 2 ? "#ffd54f" : "#ff8a65", emissiveIntensity: 0.3 })} />
      ))}
    </group>
  );
}

function SuperCluster() {
  return (
    <group>
      {[-0.42, 0.42].map((x, r) => (
        <group key={r} position={[x, 0, 0]}>
          <mesh position={[0, 0.9, 0]} geometry={sharedRounded(0.72, 1.8, 0.6, 4, 0.02)} material={sharedStandard({ color: "#0e1116", roughness: 0.5, metalness: 0.35 })} />
          {/* glass front */}
          <mesh position={[0, 0.9, 0.31]} geometry={sharedPlane(0.6, 1.6)} material={sharedPhysical({ color: "#0a0d13", transparent: true, opacity: 0.35, roughness: 0.05, transmission: 0.4, metalness: 0.2 })} />
          {/* dense status LEDs */}
          {Array.from({ length: 8 }).map((_, i) => [-0.18, -0.06, 0.06, 0.18].map((lx, j) => (
            <mesh key={`${i}-${j}`} position={[lx, 0.28 + i * 0.18, 0.315]} geometry={sharedSphere(0.014, 6, 6)} material={sharedStandard({ color: (i + j) % 3 ? "#10b981" : "#f59e0b", emissive: (i + j) % 3 ? "#10b981" : "#f59e0b", emissiveIntensity: 1.2, toneMapped: false })} />
          )))}
        </group>
      ))}
      {/* cable bundles on top */}
      {[-0.3, 0, 0.3].map((x, i) => (
        <mesh key={i} position={[x, 1.84, -0.1]} rotation-x={Math.PI / 2} geometry={sharedTorus(0.1, 0.03, 8, 16, Math.PI)} material={sharedStandard({ color: i % 2 ? "#3a3f48" : "#c0392b", roughness: 0.7 })} />
      ))}
    </group>
  );
}

function HoloGlobe() {
  const R = 0.34;
  return (
    <group>
      {/* dark metal ring base */}
      <mesh position={[0, 0.06, 0]} geometry={sharedCylinder(0.24, 0.26, 0.06, 24)} material={sharedStandard({ color: "#1a1d23", roughness: 0.4, metalness: 0.5 })} />
      <mesh position={[0, 0.12, 0]} rotation-x={Math.PI / 2} geometry={sharedTorus(0.22, 0.03, 12, 32)} material={sharedStandard({ color: "#2a2f37", metalness: 0.6, roughness: 0.3 })} />
      {/* floating cyan wireframe sphere */}
      <mesh position={[0, 0.78, 0]} geometry={sharedSphere(R, 16, 12)} material={sharedBasic({ color: "#38e6ff", wireframe: true, transparent: true, opacity: 0.55, toneMapped: false })} />
      <mesh position={[0, 0.78, 0]} geometry={sharedSphere(R - 0.01, 20, 16)} material={sharedStandard({ color: "#0aa0c0", emissive: "#22cfe6", emissiveIntensity: 0.5, transparent: true, opacity: 0.12, toneMapped: false })} />
      {/* thin latitude rings */}
      {[-0.18, 0, 0.18].map((yo, i) => {
        const rr = Math.sqrt(Math.max(0, R * R - yo * yo));
        return <mesh key={i} position={[0, 0.78 + yo, 0]} rotation-x={Math.PI / 2} geometry={sharedTorus(rr, 0.006, 6, 32)} material={sharedBasic({ color: "#38e6ff", transparent: true, opacity: 0.7, toneMapped: false })} />;
      })}
    </group>
  );
}

function QuantumRig() {
  const plates = [[1.15, 0.32], [0.95, 0.27], [0.75, 0.22], [0.55, 0.17], [0.35, 0.12]] as const;
  return (
    <group>
      {/* dark pedestal */}
      <mesh position={[0, 0.15, 0]} geometry={sharedRounded(0.5, 0.3, 0.5, 4, 0.03)} material={sharedStandard({ color: "#15181d", roughness: 0.5, metalness: 0.3 })} />
      {/* faint cyan base glow */}
      <mesh position={[0, 0.32, 0]} rotation-x={-Math.PI / 2} geometry={sharedCircle(0.3, 24)} material={sharedBasic({ color: "#22cfe6", transparent: true, opacity: 0.35, toneMapped: false })} />
      {/* thin rods */}
      {([[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]] as const).map((l, i) => (
        <mesh key={i} position={[l[0], 0.75, l[1]]} geometry={sharedCylinder(0.012, 0.012, 0.9, 8)} material={sharedStandard({ color: "#c9a24a", metalness: 0.7, roughness: 0.3 })} />
      ))}
      {/* stacked descending gold torus plates */}
      {plates.map((pl, i) => (
        <mesh key={i} position={[0, pl[0], 0]} rotation-x={Math.PI / 2} geometry={sharedTorus(pl[1], 0.03, 10, 32)} material={sharedStandard({ color: "#d4af37", metalness: 0.8, roughness: 0.25 })} />
      ))}
    </group>
  );
}

function EspressoRobot() {
  return (
    <group>
      {/* chrome cylinder body */}
      <mesh position={[0, 0.5, 0]} geometry={sharedCylinder(0.22, 0.24, 1.0, 24)} material={sharedStandard({ color: "#c7ccd4", metalness: 0.85, roughness: 0.18 })} />
      <mesh position={[0, 1.0, 0]} geometry={sharedCylinder(0.2, 0.22, 0.12, 24)} material={sharedStandard({ color: "#9aa1ab", metalness: 0.7, roughness: 0.3 })} />
      {/* green status LED */}
      <mesh position={[0, 0.72, 0.23]} geometry={sharedSphere(0.03, 10, 10)} material={sharedStandard({ color: "#10b981", emissive: "#10b981", emissiveIntensity: 1.3, toneMapped: false })} />
      {/* articulated arm holding a cup */}
      <mesh position={[0.18, 0.62, 0.16]} rotation-z={-0.5} geometry={sharedBox(0.28, 0.05, 0.05)} material={sharedStandard({ color: "#8a9099", metalness: 0.6 })} />
      <mesh position={[0.32, 0.5, 0.26]} geometry={sharedCylinder(0.03, 0.03, 0.16, 10)} material={sharedStandard({ color: "#8a9099", metalness: 0.6 })} />
      <mesh position={[0.32, 0.4, 0.26]} geometry={sharedCylinder(0.05, 0.04, 0.09, 14)} material={sharedStandard({ color: "#efeae0", roughness: 0.5 })} />
      {/* drip tray */}
      <mesh position={[0.32, 0.33, 0.26]} geometry={sharedBox(0.16, 0.03, 0.16)} material={sharedStandard({ color: "#4a505a", metalness: 0.5 })} />
      {/* steam wand */}
      <mesh position={[-0.16, 0.7, 0.18]} rotation-z={0.4} geometry={sharedCylinder(0.012, 0.012, 0.24, 8)} material={sharedStandard({ color: "#9aa1ab", metalness: 0.7 })} />
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
      <mesh position={[0, 0.03, 0]} rotation-y={Math.PI / 6} geometry={sharedCylinder(0.8, 0.8, 0.06, 6)} material={sharedStandard({ color: "#2a2f37", roughness: 0.7 })} />
      {/* emissive-yellow perimeter */}
      <mesh position={[0, 0.065, 0]} rotation-x={-Math.PI / 2} rotation-z={Math.PI / 6} geometry={sharedRing(0.66, 0.74, 6)} material={sharedBasic({ color: "#f5c542", transparent: true, opacity: 0.9, toneMapped: false, side: 2 })} />
      {/* painted "H" */}
      <group position={[0, 0.062, 0]} rotation-x={-Math.PI / 2}>
        {[-0.14, 0.14].map((x, i) => <mesh key={i} position={[x, 0, 0]} geometry={sharedPlane(0.06, 0.4)} material={sharedBasic({ color: "#e8ecf2" })} />)}
        <mesh geometry={sharedPlane(0.28, 0.06)} material={sharedBasic({ color: "#e8ecf2" })} />
      </group>
      {/* hovering quadcopter */}
      <group ref={drone} position={[0, 0.85, 0]}>
        <mesh position={[0, 0, 0]} geometry={sharedRounded(0.22, 0.1, 0.22, 4, 0.03)} material={sharedStandard({ color: "#1a1d23", roughness: 0.5, metalness: 0.3 })} />
        <mesh position={[0, -0.03, 0]} geometry={sharedSphere(0.05, 10, 10)} material={sharedStandard({ color: "#22cfe6", emissive: "#22cfe6", emissiveIntensity: 0.9, toneMapped: false })} />
        {/* crossed arms */}
        {[Math.PI / 4, -Math.PI / 4].map((a, i) => (
          <mesh key={i} rotation-y={a} geometry={sharedBox(0.56, 0.02, 0.02)} material={sharedStandard({ color: "#3a3f48", metalness: 0.4 })} />
        ))}
        {/* rotor discs */}
        {([[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] as const).map((l, i) => (
          <mesh key={`rot${i}`} position={[l[0], 0.03, l[1]]} geometry={sharedCylinder(0.1, 0.1, 0.008, 16)} material={sharedStandard({ color: "#5b9dff", transparent: true, opacity: 0.35 })} />
        ))}
      </group>
    </group>
  );
}

function ZenFountain() {
  return (
    <group>
      {/* circular stone basin */}
      <mesh position={[0, 0.1, 0]} geometry={sharedCylinder(0.62, 0.66, 0.2, 32)} material={sharedStandard({ color: "#8a8f96", roughness: 0.85 })} />
      <mesh position={[0, 0.19, 0]} geometry={sharedCylinder(0.56, 0.56, 0.04, 32)} material={sharedStandard({ color: "#5a9db8", transparent: true, opacity: 0.5, roughness: 0.1, metalness: 0.2 })} />
      {/* stacked slate discs */}
      <mesh position={[0, 0.3, 0]} geometry={sharedCylinder(0.34, 0.38, 0.14, 24)} material={sharedStandard({ color: "#4a5058", roughness: 0.7 })} />
      <mesh position={[0, 0.44, 0]} geometry={sharedCylinder(0.22, 0.26, 0.12, 24)} material={sharedStandard({ color: "#565c64", roughness: 0.7 })} />
      {/* thin transparent emissive-blue water column */}
      <mesh position={[0, 0.55, 0]} geometry={sharedCylinder(0.03, 0.04, 0.5, 12)} material={sharedStandard({ color: "#7fd4f0", emissive: "#4fbfe8", emissiveIntensity: 0.7, transparent: true, opacity: 0.6, toneMapped: false })} />
      {/* ring of pebbles */}
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <mesh key={i} position={[Math.cos(a) * 0.5, 0.22, Math.sin(a) * 0.5]} geometry={sharedSphere(0.05, 8, 8)} material={sharedStandard({ color: i % 2 ? "#6b7078" : "#565c64", roughness: 0.8 })} />;
      })}
    </group>
  );
}

function TrophyCase({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  return (
    <group>
      {/* cabinet body */}
      <mesh position={[0, 0.9, 0]} geometry={sharedRounded(w - 0.1, 1.8, 0.4, 4, 0.03)} material={sharedStandard({ color: p.deskDark, roughness: 0.6 })} />
      {/* warm backlit interior */}
      <mesh position={[0, 0.9, -0.16]} geometry={sharedPlane(w - 0.24, 1.6)} material={sharedStandard({ color: "#ffdca0", emissive: "#ffcf86", emissiveIntensity: 0.5, toneMapped: false })} />
      {/* glass front */}
      <mesh position={[0, 0.9, 0.2]} geometry={sharedPlane(w - 0.18, 1.66)} material={sharedPhysical({ color: "#cfe0ee", transparent: true, opacity: 0.14, roughness: 0.05, transmission: 0.6 })} />
      {/* shelves with gold trophies + medals */}
      {[0.45, 0.95, 1.45].map((y, s) => (
        <group key={s} position={[0, y, 0]}>
          <mesh position={[0, -0.02, 0]} geometry={sharedBox(w - 0.16, 0.03, 0.34)} material={sharedStandard({ color: p.desk, roughness: 0.6 })} />
          {/* trophy cup: base + stem + bowl */}
          <mesh position={[-0.2, 0.04, 0]} geometry={sharedCylinder(0.05, 0.06, 0.03, 12)} material={sharedStandard({ color: "#d4af37", metalness: 0.8, roughness: 0.3 })} />
          <mesh position={[-0.2, 0.09, 0]} geometry={sharedCylinder(0.012, 0.012, 0.07, 8)} material={sharedStandard({ color: "#d4af37", metalness: 0.8, roughness: 0.3 })} />
          <mesh position={[-0.2, 0.15, 0]} geometry={sharedSphere(0.055, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)} material={sharedStandard({ color: "#e6c34a", metalness: 0.8, roughness: 0.3, side: 2 })} />
          {/* medal disc */}
          <mesh position={[0.18, 0.08, 0.02]} rotation-x={Math.PI / 2} geometry={sharedCylinder(0.06, 0.06, 0.015, 20)} material={sharedStandard({ color: s % 2 ? "#c0c5cc" : "#d4af37", metalness: 0.7, roughness: 0.3 })} />
        </group>
      ))}
    </group>
  );
}

function NapPod() {
  return (
    <group>
      {/* egg-shaped shell, opening facing +z */}
      <mesh position={[0, 0.55, -0.1]} scale={[1, 1.15, 1]} geometry={sharedSphere(0.6, 24, 20)} material={sharedStandard({ color: "#dfe3e8", roughness: 0.5, metalness: 0.1 })} />
      {/* interior recess */}
      <mesh position={[0, 0.5, 0.05]} scale={[0.8, 0.95, 0.8]} geometry={sharedSphere(0.5, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.7)} material={sharedStandard({ color: "#2f353d", roughness: 0.8, side: 2 })} />
      {/* privacy hood lip */}
      <mesh position={[0, 0.95, 0.12]} rotation-x={-0.5} geometry={sharedTorus(0.42, 0.05, 12, 24, Math.PI)} material={sharedStandard({ color: "#c5cad0", roughness: 0.5 })} />
      {/* soft cushion + back pillow */}
      <mesh position={[0, 0.28, 0.12]} geometry={sharedRounded(0.7, 0.16, 0.5, 4, 0.07)} material={sharedStandard({ color: FABRIC_2, roughness: 0.85 })} />
      <mesh position={[0, 0.45, -0.22]} geometry={sharedRounded(0.6, 0.3, 0.14, 4, 0.06)} material={sharedStandard({ color: FABRIC, roughness: 0.85 })} />
      {/* subtle interior LED */}
      <mesh position={[0, 0.9, -0.3]} geometry={sharedSphere(0.03, 8, 8)} material={sharedStandard({ color: "#8ecbff", emissive: "#8ecbff", emissiveIntensity: 0.8, toneMapped: false })} />
    </group>
  );
}

function MicroKitchen({ p }: { p: RoomPalette }) {
  const w = 3 * C;
  return (
    <group>
      {/* lower counter run */}
      <mesh position={[0, 0.45, 0]} geometry={sharedRounded(w - 0.1, 0.9, C - 0.15, 4, 0.03)} material={sharedStandard({ color: p.desk, roughness: 0.6 })} />
      <mesh position={[0, 0.93, 0]} geometry={sharedRounded(w, 0.06, C - 0.08, 4, 0.02)} material={sharedStandard({ color: "#d9dde4", roughness: 0.4, metalness: 0.1 })} />
      {/* upper cabinets */}
      <mesh position={[-0.35, 1.7, -C / 2 + 0.18]} geometry={sharedRounded(w - 1.0, 0.5, 0.28, 4, 0.03)} material={sharedStandard({ color: p.deskDark, roughness: 0.6 })} />
      {/* sink basin + faucet */}
      <mesh position={[-w / 4, 0.92, 0.02]} geometry={sharedBox(0.3, 0.06, 0.34)} material={sharedStandard({ color: "#8a9099", metalness: 0.6, roughness: 0.3 })} />
      <mesh position={[-w / 4, 1.02, -0.14]} rotation-x={0.3} geometry={sharedCylinder(0.015, 0.015, 0.14, 8)} material={sharedStandard({ color: "#9aa1ab", metalness: 0.7 })} />
      {/* colored mini-fridge */}
      <mesh position={[w / 2 - 0.3, 0.45, 0]} geometry={sharedRounded(0.5, 0.86, C - 0.2, 4, 0.03)} material={sharedStandard({ color: "#3f7fbf", roughness: 0.5, metalness: 0.15 })} />
      <mesh position={[w / 2 - 0.48, 0.55, 0.28]} geometry={sharedBox(0.03, 0.2, 0.02)} material={sharedStandard({ color: "#c0c5cc", metalness: 0.5 })} />
      {/* fruit bowl */}
      <mesh position={[0.2, 0.99, 0]} geometry={sharedCylinder(0.11, 0.08, 0.06, 16)} material={sharedStandard({ color: "#c98b5a", roughness: 0.5 })} />
      {([["#e2452f", -0.05, -0.03], ["#f0a63a", 0.05, -0.03], ["#7cb342", 0, 0.04]] as const).map((f, i) => (
        <mesh key={i} position={[0.2 + f[1], 1.06, f[2]]} geometry={sharedSphere(0.045, 10, 10)} material={sharedStandard({ color: f[0], roughness: 0.6 })} />
      ))}
      {/* coffee carafe */}
      <mesh position={[-0.1, 1.02, 0.02]} geometry={sharedCylinder(0.05, 0.055, 0.14, 14)} material={sharedStandard({ color: "#2a2f37", roughness: 0.4 })} />
    </group>
  );
}

function FocusPod({ p }: { p: RoomPalette }) {
  return (
    <group>
      {/* corner frame */}
      {([[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]] as const).map((l, i) => (
        <mesh key={i} position={[l[0], 1.0, l[1]]} geometry={sharedBox(0.04, 2.0, 0.04)} material={sharedStandard({ color: p.metalDark, metalness: 0.5 })} />
      ))}
      {/* frosted glass walls */}
      {([[0, -0.4, 0.8, 0], [0, 0.4, 0.8, 0], [-0.4, 0, 0.8, Math.PI / 2], [0.4, 0, 0.8, Math.PI / 2]] as const).map((wl, i) => (
        <mesh key={`g${i}`} position={[wl[0], 1.0, wl[1]]} rotation-y={wl[3]} geometry={sharedPlane(wl[2], 1.9)} material={sharedPhysical({ color: "#e6ecf2", transparent: true, opacity: 0.22, roughness: 0.4, transmission: 0.5, side: 2 })} />
      ))}
      {/* roof */}
      <mesh position={[0, 2.0, 0]} geometry={sharedRounded(0.86, 0.06, 0.86, 4, 0.02)} material={sharedStandard({ color: p.deskDark, roughness: 0.6 })} />
      {/* door seam */}
      <mesh position={[0.0, 1.0, 0.41]} geometry={sharedBox(0.015, 1.8, 0.01)} material={sharedStandard({ color: p.metalDark, metalness: 0.4 })} />
      {/* interior stool */}
      <mesh position={[0, 0.5, 0.05]} geometry={sharedCylinder(0.14, 0.14, 0.06, 16)} material={sharedStandard({ color: FABRIC_2, roughness: 0.7 })} />
      <mesh position={[0, 0.25, 0.05]} geometry={sharedCylinder(0.03, 0.03, 0.5, 8)} material={sharedStandard({ color: p.metal, metalness: 0.6 })} />
      {/* tiny screen glow */}
      <mesh position={[0, 1.0, -0.36]} geometry={sharedPlane(0.3, 0.2)} material={sharedStandard({ color: p.screen, emissive: p.screen, emissiveIntensity: 0.8, toneMapped: false })} />
    </group>
  );
}

function IdeaWall({ p }: { p: RoomPalette }) {
  const w = 2 * C;
  const notes = ["#f6c945", "#4e9d6b", "#5b9dff", "#e2452f", "#c77dff", "#f0883a"];
  return (
    <group>
      {/* stand legs + foot */}
      {[-w / 2 + 0.2, w / 2 - 0.2].map((x, i) => <mesh key={i} position={[x, 0.55, 0.06]} geometry={sharedBox(0.05, 1.1, 0.05)} material={sharedStandard({ color: p.metalDark, metalness: 0.4 })} />)}
      <mesh position={[0, 0.06, 0.06]} geometry={sharedBox(w - 0.3, 0.04, 0.4)} material={sharedStandard({ color: p.metalDark })} />
      {/* whiteboard */}
      <mesh position={[0, 1.15, 0]} geometry={sharedRounded(w - 0.1, 0.9, 0.05, 4, 0.02)} material={sharedStandard({ color: p.board, roughness: 0.5 })} />
      {/* colorful sticky notes */}
      {notes.map((c, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        return <mesh key={i} position={[-0.4 + col * 0.4, 1.32 - row * 0.34, 0.03]} rotation-z={(i % 2 ? 1 : -1) * 0.08} geometry={sharedPlane(0.16, 0.16)} material={sharedStandard({ color: c, roughness: 0.7 })} />;
      })}
      {/* marker scribble */}
      <mesh position={[0.44, 1.0, 0.03]} rotation-z={0.2} geometry={sharedPlane(0.28, 0.012)} material={sharedBasic({ color: "#e2452f" })} />
      <mesh position={[0.4, 0.92, 0.03]} rotation-z={-0.15} geometry={sharedPlane(0.22, 0.012)} material={sharedBasic({ color: "#5b9dff" })} />
    </group>
  );
}

function IndoorTree({ p }: { p: RoomPalette }) {
  return (
    <group>
      {/* planter */}
      <mesh position={[0, 0.25, 0]} geometry={sharedCylinder(0.32, 0.26, 0.5, 20)} material={sharedStandard({ color: p.pot, roughness: 0.8 })} />
      <mesh position={[0, 0.5, 0]} geometry={sharedCylinder(0.32, 0.32, 0.04, 20)} material={sharedStandard({ color: "#3a2a1c", roughness: 0.9 })} />
      {/* thick trunk */}
      <mesh position={[0, 0.95, 0]} geometry={sharedCylinder(0.09, 0.13, 0.9, 12)} material={sharedStandard({ color: WOOD, roughness: 0.85 })} />
      {/* broad multi-sphere canopy */}
      {([[0, 1.6, 0, 0.5], [-0.32, 1.45, 0.1, 0.34], [0.3, 1.5, -0.1, 0.36], [0.05, 1.35, 0.3, 0.3], [-0.15, 1.75, -0.15, 0.3]] as const).map((s, i) => (
        <mesh key={i} position={[s[0], s[1], s[2]]} geometry={sharedSphere(s[3], 14, 14)} material={sharedStandard({ color: i % 2 ? p.plant : "#3c7e54", roughness: 0.85 })} />
      ))}
    </group>
  );
}

function KombuchaTap() {
  return (
    <group>
      {/* stainless keg body */}
      <mesh position={[0, 0.55, 0]} geometry={sharedRounded(0.5, 1.1, 0.44, 4, 0.04)} material={sharedStandard({ color: "#b8bec7", metalness: 0.7, roughness: 0.25 })} />
      {/* chalkboard label */}
      <mesh position={[0, 0.78, 0.225]} geometry={sharedPlane(0.38, 0.28)} material={sharedStandard({ color: "#1e2228", roughness: 0.8 })} />
      <mesh position={[0, 0.82, 0.23]} geometry={sharedPlane(0.24, 0.03)} material={sharedBasic({ color: "#e8ecf2" })} />
      <mesh position={[0, 0.74, 0.23]} geometry={sharedPlane(0.16, 0.02)} material={sharedBasic({ color: "#8ecbff" })} />
      {/* tap handles */}
      {[-0.13, 0, 0.13].map((x, i) => (
        <group key={i} position={[x, 0.42, 0.22]}>
          <mesh position={[0, 0, 0.04]} geometry={sharedBox(0.03, 0.08, 0.08)} material={sharedStandard({ color: "#4a505a", metalness: 0.6 })} />
          <mesh position={[0, 0.08, 0.02]} geometry={sharedCylinder(0.015, 0.015, 0.12, 8)} material={sharedStandard({ color: i % 2 ? "#c0392b" : "#2f6f4f", roughness: 0.5 })} />
        </group>
      ))}
      {/* drip tray */}
      <mesh position={[0, 0.32, 0.24]} geometry={sharedBox(0.42, 0.03, 0.12)} material={sharedStandard({ color: "#6b7178", metalness: 0.5 })} />
    </group>
  );
}

function RocketModel({ p }: { p: RoomPalette }) {
  return (
    <group>
      {/* stand ring + legs */}
      <mesh position={[0, 0.14, 0]} rotation-x={Math.PI / 2} geometry={sharedTorus(0.16, 0.02, 10, 24)} material={sharedStandard({ color: p.metalDark, metalness: 0.6 })} />
      {([[0.13, -0.13], [0.13, 0.13], [-0.15, 0]] as const).map((l, i) => <mesh key={i} position={[l[0], 0.08, l[1]]} geometry={sharedCylinder(0.012, 0.012, 0.16, 6)} material={sharedStandard({ color: p.metalDark, metalness: 0.6 })} />)}
      {/* white body */}
      <mesh position={[0, 0.7, 0]} geometry={sharedCylinder(0.11, 0.11, 0.9, 20)} material={sharedStandard({ color: "#eef1f5", roughness: 0.4, metalness: 0.1 })} />
      {/* cone nose */}
      <mesh position={[0, 1.28, 0]} geometry={sharedCone(0.11, 0.32, 20)} material={sharedStandard({ color: "#d05a51", roughness: 0.4 })} />
      {/* window */}
      <mesh position={[0, 0.95, 0.11]} geometry={sharedCircle(0.03, 12)} material={sharedStandard({ color: p.screen, emissive: p.screen, emissiveIntensity: 0.5, toneMapped: false })} />
      {/* dark engine bell */}
      <mesh position={[0, 0.2, 0]} geometry={sharedCylinder(0.12, 0.08, 0.14, 16)} material={sharedStandard({ color: "#2a2f37", metalness: 0.6, roughness: 0.4 })} />
      {/* 4 fins */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.13, 0.34, Math.sin(a) * 0.13]} rotation-y={-a} geometry={sharedBox(0.02, 0.24, 0.14)} material={sharedStandard({ color: "#c0c5cc", metalness: 0.3 })} />
      ))}
    </group>
  );
}

function TreeLamp({ p }: { p: RoomPalette }) {
  const arms = [[1.5, 0.35, 0.2], [1.1, -0.3, -0.25], [0.8, 0.25, 0.3]] as const;
  return (
    <group>
      <mesh position={[0, 0.03, 0]} geometry={sharedCylinder(0.14, 0.16, 0.06, 18)} material={sharedStandard({ color: p.metalDark, metalness: 0.5 })} />
      <mesh position={[0, 0.85, 0]} geometry={sharedCylinder(0.02, 0.02, 1.7, 8)} material={sharedStandard({ color: p.metalDark, metalness: 0.5 })} />
      {arms.map((a, i) => (
        <group key={i}>
          {/* horizontal arm from pole to globe */}
          <mesh position={[a[1] * 0.5, a[0], a[2] * 0.5]} rotation-y={Math.atan2(a[2], a[1])} geometry={sharedBox(Math.hypot(a[1], a[2]), 0.02, 0.02)} material={sharedStandard({ color: p.metalDark, metalness: 0.5 })} />
          {/* warm emissive glass globe */}
          <mesh position={[a[1], a[0], a[2]]} geometry={sharedSphere(0.08, 14, 12)} material={sharedStandard({ color: "#fff2cc", emissive: "#ffcf86", emissiveIntensity: 1.3, toneMapped: false, transparent: true, opacity: 0.92 })} />
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
      <mesh position={[0, 0.6, -0.2]} geometry={sharedRounded(0.7, 1.2, 0.05, 4, 0.02)} material={sharedStandard({ color: p.deskDark, roughness: 0.7 })} />
      {/* colored wash on the panel */}
      <mesh position={[0, 0.6, -0.17]} geometry={sharedPlane(0.6, 1.1)} material={sharedBasic({ color: hue, transparent: true, opacity: 0.4, toneMapped: false })} />
      {/* low floor bar */}
      <mesh position={[0, 0.05, -0.1]} geometry={sharedRounded(0.66, 0.08, 0.14, 4, 0.03)} material={sharedStandard({ color: "#1a1d23", roughness: 0.5 })} />
      {/* emissive strip */}
      <mesh position={[0, 0.1, -0.05]} rotation-x={-0.5} geometry={sharedPlane(0.56, 0.05)} material={sharedStandard({ color: hue, emissive: hue, emissiveIntensity: 1.6, toneMapped: false })} />
    </group>
  );
}

function PizzaStack() {
  const boxes = [[0.06, 0.04], [0.18, -0.05], [0.3, 0.03], [0.42, -0.02]] as const;
  return (
    <group>
      {boxes.map((b, i) => (
        <mesh key={i} position={[0, b[0] + 0.03, 0]} rotation-y={b[1]} geometry={sharedRounded(0.44, 0.06, 0.44, 4, 0.015)} material={sharedStandard({ color: i % 2 ? "#c9a274" : "#b08a52", roughness: 0.8 })} />
      ))}
      {/* top box lid ajar */}
      <mesh position={[0, 0.5, -0.16]} rotation-x={-0.5} geometry={sharedBox(0.44, 0.02, 0.44)} material={sharedStandard({ color: "#c9a274", roughness: 0.8 })} />
      {/* grease-spot label */}
      <mesh position={[0, 0.46, 0.221]} geometry={sharedPlane(0.14, 0.08)} material={sharedBasic({ color: "#c0392b" })} />
    </group>
  );
}

function CableSpool() {
  const R = 0.3;
  return (
    <group position={[0, R, 0]} rotation-z={Math.PI / 2}>
      {/* two disc ends */}
      {[-0.22, 0.22].map((y, i) => <mesh key={i} position={[0, y, 0]} geometry={sharedCylinder(R, R, 0.04, 24)} material={sharedStandard({ color: WOOD, roughness: 0.8 })} />)}
      {/* central drum */}
      <mesh position={[0, 0, 0]} geometry={sharedCylinder(0.16, 0.16, 0.42, 20)} material={sharedStandard({ color: "#6b5236", roughness: 0.85 })} />
      {/* coiled cable */}
      {[-0.08, 0, 0.08].map((y, i) => <mesh key={`c${i}`} position={[0, y, 0]} geometry={sharedCylinder(0.2, 0.2, 0.06, 20)} material={sharedStandard({ color: "#2a2f37", roughness: 0.7 })} />)}
      {/* hub holes */}
      {[-0.24, 0.24].map((y, i) => <mesh key={`h${i}`} position={[0, y, 0]} geometry={sharedCylinder(0.05, 0.05, 0.06, 12)} material={sharedStandard({ color: "#3a3026" })} />)}
    </group>
  );
}

function MascotStandee({ p }: { p: RoomPalette }) {
  const hue = "#4f7bd8";
  return (
    <group>
      {/* easel foot */}
      {[-0.16, 0.16].map((x, i) => <mesh key={i} position={[x, 0.32, 0.14]} rotation-x={0.3} geometry={sharedBox(0.04, 0.64, 0.04)} material={sharedStandard({ color: p.metalDark, metalness: 0.4 })} />)}
      <mesh position={[0, 0.06, 0.16]} geometry={sharedBox(0.42, 0.04, 0.3)} material={sharedStandard({ color: p.metalDark })} />
      {/* flat robot-mascot cutout — colored silhouette planes */}
      <group position={[0, 0, -0.02]}>
        <mesh position={[0, 0.62, 0]} geometry={sharedBox(0.5, 0.5, 0.03)} material={sharedStandard({ color: hue, roughness: 0.6 })} />
        <mesh position={[0, 1.0, 0]} geometry={sharedBox(0.42, 0.34, 0.03)} material={sharedStandard({ color: hue, roughness: 0.6 })} />
        {/* antenna */}
        <mesh position={[0, 1.24, 0]} geometry={sharedCylinder(0.012, 0.012, 0.12, 6)} material={sharedStandard({ color: p.metalDark })} />
        <mesh position={[0, 1.32, 0]} geometry={sharedSphere(0.03, 8, 8)} material={sharedStandard({ color: "#f5c542", emissive: "#f5c542", emissiveIntensity: 0.6, toneMapped: false })} />
        {/* eyes + smile */}
        {[-0.1, 0.1].map((x, i) => <mesh key={i} position={[x, 1.02, 0.02]} geometry={sharedCircle(0.05, 14)} material={sharedBasic({ color: "#eef1f5" })} />)}
        {[-0.1, 0.1].map((x, i) => <mesh key={`p${i}`} position={[x, 1.02, 0.025]} geometry={sharedCircle(0.02, 10)} material={sharedBasic({ color: "#1a1d23" })} />)}
        <mesh position={[0, 0.66, 0.02]} geometry={sharedBox(0.24, 0.05, 0.01)} material={sharedBasic({ color: "#eef1f5" })} />
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
  const desk = def?.category === "desks";
  return (
    <ModelBoundary fallback={parametric}>
      <Suspense fallback={parametric}>
        <LazyGltf
          asset={model}
          footprintW={(def?.w ?? 1) * C}
          footprintD={(def?.d ?? 1) * C}
        >
          {/* the modelled desks ship bare — give them the computer they're supposed to have */}
          {desk && <DeskTopKit p={p} w={def?.w ?? 2} />}
        </LazyGltf>
      </Suspense>
    </ModelBoundary>
  );
});
