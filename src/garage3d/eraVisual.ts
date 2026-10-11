// Era visuals (handoff gap O5): the company's era is visible in both 3D worlds. Presentation-only —
// a pure lookup from the era number, never read by `engine/`, no randomness.
//
//   - accent: the working-machine glow on the factory floor and the office marketing screen's brand
//     colour, so the two worlds advance together (blue → cyan → violet → gold).
//   - brand: the office's focal brand wall changes finish — the garage's dark timber and amber cove,
//     then light oak, brushed aluminium in cyan light, graphite with a lit violet wordmark, and
//     finally the robots' satin white in gold light.
//   - key: the key light cools from the garage's warm sun toward a studio daylight, then warms to a
//     gold dawn for the Autonomy Era.
//
// The player's own choices (wall/floor style, furniture) are never overridden. Every saturated hex
// here is allowlisted with its purpose in palette.ts SATURATED_ALLOWED (palette.test.ts scans this
// file too).
import { CATALOG, type RoomPalette } from "./palette.ts";

export interface BrandFinish { slat: string; slatEdge: string; signInk: string; signGlow: string }

export interface EraVisual {
  accent: string;
  key: { day: string; night: string };
  /** Null = the room palette's own finish (the Garage Era's timber + amber cove). */
  brand: BrandFinish | null;
}

const ERA_VISUALS: readonly EraVisual[] = [
  // 1 · Garage Era
  { accent: "#3b82f6", key: { day: "#fff4e4", night: "#ffdfae" }, brand: null },
  // 2 · Growth Era
  {
    accent: "#3b82f6",
    key: { day: "#fff7ec", night: "#ffe4bd" },
    brand: { slat: CATALOG.woodMid, slatEdge: CATALOG.woodDark, signInk: CATALOG.charcoal, signGlow: "#ffd98a" },
  },
  // 3 · Platform Era
  {
    accent: "#22d3ee",
    key: { day: "#f6f8ff", night: "#e8eeff" },
    brand: { slat: CATALOG.aluminium, slatEdge: CATALOG.silver, signInk: CATALOG.ink, signGlow: "#22cfe6" },
  },
  // 4 · AI Era
  {
    accent: "#a78bfa",
    key: { day: "#f1f5ff", night: "#e2e9ff" },
    brand: { slat: CATALOG.graphite, slatEdge: CATALOG.ink, signInk: "#a78bfa", signGlow: "#a78bfa" },
  },
  // 5 · Autonomy Era
  {
    accent: "#f5b53d",
    key: { day: "#fff9ee", night: "#ffeccc" },
    brand: { slat: CATALOG.chalk, slatEdge: CATALOG.silver, signInk: CATALOG.charcoal, signGlow: "#f5b53d" },
  },
];

/** The visual set for an era (clamped: anything below 1 is the Garage, anything past the table is
 *  its last entry). */
export function eraVisual(era: number): EraVisual {
  const i = Math.min(ERA_VISUALS.length - 1, Math.max(0, Math.floor(era) - 1));
  return ERA_VISUALS[i];
}

/** The office palette with the era's brand-wall finish applied (the cove light that washes the wall
 *  follows `signGlow`, so the wall's own light changes too). */
export function withEraFinish(p: RoomPalette, era: number): RoomPalette {
  const brand = eraVisual(era).brand;
  return brand ? { ...p, ...brand } : p;
}
