// Shared robot look. The team are friendly mascot robots — never humans — so the roster portrait
// (Avatar) and the office figures (IsoScene) derive the SAME palette + head style from a staff
// member's stored Appearance. We reinterpret the human-era appearance fields as robot traits so
// existing saves keep a stable, distinct look per character (no migration needed):
//   shirt     -> chassis colour (vivid, theme-stable)
//   hair      -> crest / antenna style (0..5)
//   hairColor -> antenna-tip accent when idle
//   skin      -> visor tint variant
//   accessory -> bolt-on module (visor goggles, audio cans, top plate, dome, stud bolts)
import { DEFAULT_APPEARANCE } from "../engine/staff.ts";
import type { Accessory, Appearance } from "../engine/types.ts";

// Vivid chassis colours, theme-stable. Indexed by appearance.shirt (0..7) for per-robot variety.
export const ROBOT_BODY = [
  "#4a9af5", "#ff7a35", "#40c870", "#9060e8", "#f5c840", "#16c0c0", "#ec5aa0", "#7d8aa0",
];

// Antenna-tip / trim accents, indexed by appearance.hairColor.
export const ROBOT_TRIM = [
  "#cfeaff", "#ffd9a8", "#bff0cf", "#e0cffb", "#fff0b8", "#b8f0f0", "#ffd0e6", "#dde3ec",
];

/** Lighten (amt>0, toward white) or darken (amt<0, toward black) a #rrggbb hex. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export interface RobotLook {
  body: string; // main chassis colour
  belly: string; // lighter front / face panel
  dark: string; // visor + shadow
  metal: string; // neck ring / antenna stalk
  trim: string; // antenna-tip accent
  headStyle: number; // 0..5 — crest / antenna variant
  accessory: Accessory;
}

const METAL = "#c7cdd6";

export function robotLook(appearance: Appearance | undefined): RobotLook {
  const ap = appearance ?? DEFAULT_APPEARANCE;
  const body = ROBOT_BODY[ap.shirt % ROBOT_BODY.length];
  return {
    body,
    belly: shade(body, 0.34),
    dark: shade(body, -0.52),
    metal: METAL,
    trim: ROBOT_TRIM[ap.hairColor % ROBOT_TRIM.length],
    headStyle: ap.hair % 6,
    accessory: ap.accessory,
  };
}

/** Mood -> glowing-eye shape on the visor. Returns a small descriptor the renderers share so the
 *  portrait and the office figure express the same feeling. */
export type EyeShape = "wide" | "happy" | "neutral" | "tired" | "off";
export function eyeShapeFor(band: string): EyeShape {
  if (band === "thriving") return "wide";
  if (band === "happy") return "happy";
  if (band === "neutral") return "neutral";
  if (band === "tired") return "tired";
  return "off"; // burned out — dim, narrowed
}
