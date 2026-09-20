// Procedural soft-glow decals (no image assets). One small radial-gradient canvas shared by every
// additive light pool and halo in the office — the falloff is drawn once and tinted per use, so
// lighting the room this way costs a texture bind and a transparent quad instead of a dynamic light.
import * as THREE from "three";

let cached: THREE.CanvasTexture | null = null;

/** White-to-transparent radial falloff. Callers tint it via material colour + opacity. */
export function glowTexture(): THREE.CanvasTexture {
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.45, "rgba(255,255,255,0.42)");
    g.addColorStop(0.78, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  cached = new THREE.CanvasTexture(c);
  return cached;
}
