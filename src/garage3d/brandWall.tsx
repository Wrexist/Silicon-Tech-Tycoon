// The brand wall: a physical, warm-lit installation that identifies the office — a dark timber
// slat backing with a cove-lit wordmark and mark, mounted on the room's focal wall. Asset-free (the
// mark is drawn to a canvas, like the marketing screen's poster) and presentation-only.
import { useEffect, useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { glowTexture } from "./glow.ts";
import { sharedStandard } from "./sharedGpu.ts";
import type { RoomPalette } from "./palette.ts";

const SIGN_W = 1024;
const SIGN_H = 224;

/** The mark + wordmark drawn as lit ink on a transparent field. Shrinks the type until the name
 *  fits the panel: a 14-character company name must not run off the end of the wall. */
function signTexture(name: string, ink: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = SIGN_W;
  c.height = SIGN_H;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(c);
  ctx.clearRect(0, 0, SIGN_W, SIGN_H);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  // Wordmark first (shrunk until the name fits), then the mark is placed so the lockup — mark +
  // gap + wordmark — sits centred on the panel instead of leaving a dead strip at one end.
  const label = name.toUpperCase().slice(0, 14);
  const avail = SIGN_W - 250 - 24;
  let size = 122;
  ctx.font = `bold ${size}px -apple-system, 'Segoe UI', system-ui, sans-serif`;
  while (size > 46 && ctx.measureText(label).width > avail) {
    size -= 4;
    ctx.font = `bold ${size}px -apple-system, 'Segoe UI', system-ui, sans-serif`;
  }
  const textW = ctx.measureText(label).width;
  const markW = 132;
  const gap = 44;
  // The lockup is centred in the panel with one spacing rule: the mark's diamond spans MID ± 68,
  // the wordmark keeps a fixed 44px gap after the mark, and both are vertically centred on the
  // same axis (MID) so the name never sits a few pixels low against the mark.
  const MID = SIGN_H / 2;
  const startX = Math.max(20, (SIGN_W - (markW + gap + textW)) / 2);
  // Diamond mark + core dot, matching the marketing screen's brand lockup.
  const cx = startX + markW / 2;
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.moveTo(cx, MID - 68);
  ctx.lineTo(cx + 66, MID);
  ctx.lineTo(cx, MID + 68);
  ctx.lineTo(cx - 66, MID);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, MID, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, startX + markW + gap, MID);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

/** Mount point: over the garage door (enclosed dark room) or on the low back wall (open light
 *  diorama). Both are wall A, facing the camera. */
export type BrandWallMode = "overDoor" | "lowWall";

export function BrandWall({ name, p, mode }: { name: string; p: RoomPalette; mode: BrandWallMode }) {
  const overDoor = mode === "overDoor";
  const w = overDoor ? 4.9 : 2.9;
  const h = overDoor ? 1.02 : 0.76;
  const slatN = overDoor ? 17 : 10;
  const slatW = 0.19;
  const backing = sharedStandard({ color: p.slatEdge, roughness: 0.72, metalness: 0.05 });
  const slat = sharedStandard({ color: p.slat, roughness: 0.58, metalness: 0.08 });
  const tex = useMemo(() => signTexture(name, p.signInk), [name, p.signInk]);
  useEffect(() => () => tex.dispose(), [tex]);
  const slats = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = slats.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    const pitch = (w - 0.16) / slatN;
    for (let i = 0; i < slatN; i++) {
      d.position.set(-w / 2 + 0.08 + pitch * (i + 0.5), 0, 0.045);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [w, slatN]);
  return (
    <group position={overDoor ? [0, 4.44, -4.0] : [1.5, 1.62, -3.86]}>
      <RoundedBox args={[w, h, 0.09]} radius={0.012} smoothness={2} material={backing} />
      <instancedMesh ref={slats} args={[undefined, undefined, slatN]} material={slat}>
        <boxGeometry args={[slatW, h - 0.1, 0.06]} />
      </instancedMesh>
      {/* Cove light: the warm strip sits BEHIND the panel and spills onto the wall, top and bottom,
          so the installation reads as lit architecture instead of wearing two neon tubes. Additive
          gradient quads only — same pooled texture as every pool in the room, no extra light. */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, s * (h / 2 + 0.12), 0.03]}>
          <planeGeometry args={[w + 0.45, 0.95]} />
          <meshBasicMaterial map={glowTexture()} color={p.signGlow} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {/* a low, tight warm bloom right behind the mark so the ink sits in its own light */}
      <mesh position={[0, 0, 0.079]}>
        <planeGeometry args={[w - 0.2, h * 1.3]} />
        <meshBasicMaterial map={glowTexture()} color={p.signGlow} transparent opacity={0.24} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.082]} renderOrder={1}>
        <planeGeometry args={[w - 0.4, h - 0.22]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
