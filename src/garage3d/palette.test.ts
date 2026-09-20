/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Color } from "three";
import { CATALOG, desaturatedColor, SATURATED_ALLOWED } from "./palette.ts";

// Item 2's source invariant: the room is neutral, and colour is a signal.
//
//   • Architecture + furniture: graphite / charcoal / warm grey / dark wood only.
//   • Technology: near-black + metal.
//   • Plants: one muted green.   • Lighting: warm white.
//   • Saturated colour is reserved for EMPLOYEES (robotModels.ts ROBOT_COLORS — deliberately out of
//     scope here, they are supposed to pop) and for objects doing a job: display glow, status LEDs
//     and self-lit fixtures, each with a purpose in SATURATED_ALLOWED.
//
// The catalog (furniture3d.tsx) is the shared renderer for player-placed furniture too, so this
// rule is what keeps a full save's room from collapsing back into a colour-by-numbers showroom.
// A new saturated literal must either become a CATALOG neutral or earn an allowlist entry.
//
// Scoped exactly where the brief scopes it: the furniture/palette colour DEFINITIONS. Game-owned
// props in Garage3D/room.tsx are recoloured by the same discipline but not swept here — their pale
// window glass and celebration greens are light/signal, not pigments.

const SRC = dirname(fileURLToPath(import.meta.url));
const HEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
/** HSL saturation above this (with mid lightness, see below) reads as a hue, not a neutral. The
 *  warm wood/tan neutrals sit at 0.28–0.48; lights and near-blacks are excluded by lightness so a
 *  warm white or an ink shell is not mistaken for a pigment. */
const SAT_MAX = 0.5;
const L_MIN = 0.12;
const L_MAX = 0.92;

export function hexSaturation(hex: string): { s: number; l: number } {
  const n = hex.length === 4 ? "#" + [...hex.slice(1)].map((c) => c + c).join("") : hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

function isSaturatedHue(hex: string): boolean {
  const { s, l } = hexSaturation(hex);
  return s > SAT_MAX && l > L_MIN && l < L_MAX;
}

function hexLiterals(file: string): string[] {
  const text = readFileSync(join(SRC, file), "utf8");
  return [...text.matchAll(HEX)].map((m) => m[0].toLowerCase());
}

function offendersIn(file: string, allow: ReadonlySet<string>): string[] {
  const text = readFileSync(join(SRC, file), "utf8");
  const out: string[] = [];
  for (const m of text.matchAll(HEX)) {
    const hex = m[0].toLowerCase();
    if (!isSaturatedHue(hex) || allow.has(hex)) continue;
    const line = text.slice(0, m.index).split("\n").length;
    out.push(`${file}:${line}  ${hex} (S=${hexSaturation(hex).s.toFixed(2)})`);
  }
  return out;
}

describe("office palette discipline", () => {
  it("classifies neutrals and hues the way the rule describes", () => {
    expect(isSaturatedHue(CATALOG.graphite)).toBe(false); // graphite
    expect(isSaturatedHue(CATALOG.wood)).toBe(false); // dark wood family
    expect(isSaturatedHue(CATALOG.warmGrey)).toBe(false);
    expect(isSaturatedHue(CATALOG.ink)).toBe(false);
    expect(isSaturatedHue("#f59e0b")).toBe(true); // raw amber
    expect(isSaturatedHue("#3b82f6")).toBe(true); // interaction blue as a paint
    expect(isSaturatedHue("#ff4fd8")).toBe(true); // neon pink
  });

  it("the catalog (furniture3d.tsx) carries no saturated pigment at all — only CATALOG neutrals and purpose colours", () => {
    const offenders = offendersIn("furniture3d.tsx", new Set(Object.values(CATALOG)));
    expect(
      offenders,
      "pick a neutral from palette.ts CATALOG, or move the colour into CATALOG with a purpose in SATURATED_ALLOWED:\n" + offenders.join("\n"),
    ).toEqual([]);
  });

  it("every saturated literal in palette.ts is allowlisted with its purpose", () => {
    const allow = new Set(Object.keys(SATURATED_ALLOWED).map((h) => h.toLowerCase()));
    const offenders = offendersIn("palette.ts", allow);
    expect(
      offenders,
      "add the hex to SATURATED_ALLOWED in palette.ts with the job it does (display glow / status / plant / light), or replace it with a CATALOG neutral:\n" + offenders.join("\n"),
    ).toEqual([]);
  });

  it("desaturates fitted asset paint in place, keeping hue and value", () => {
    const paint = new Color("#e23b3b");
    const before = { h: 0, s: 0, l: 0 };
    paint.getHSL(before);
    expect(desaturatedColor(paint)).toBe(paint); // in place — no new material/colour allocated
    const after = { h: 0, s: 0, l: 0 };
    paint.getHSL(after);
    expect(after.h).toBeCloseTo(before.h, 5);
    expect(after.l).toBeCloseTo(before.l, 5);
    expect(after.s).toBeLessThan(before.s * 0.3);
    expect(after.s).toBeGreaterThan(0);
    // A neutral stays neutral (idempotent in effect).
    const grey = new Color(CATALOG.graphite);
    const g0 = { h: 0, s: 0, l: 0 };
    grey.getHSL(g0);
    desaturatedColor(grey);
    const g1 = { h: 0, s: 0, l: 0 };
    grey.getHSL(g1);
    expect(g1.s).toBeLessThanOrEqual(g0.s + 1e-6);
  });

  it("the allowlist stays small, documented and non-empty", () => {
    const entries = Object.entries(SATURATED_ALLOWED);
    expect(entries.length).toBeGreaterThanOrEqual(8);
    for (const [hex, purpose] of entries) {
      expect(hex, `${hex} is not a hex literal`).toMatch(/^#[0-9a-f]{6}$/);
      expect(purpose.length, `${hex} needs a real purpose sentence`).toBeGreaterThan(10);
    }
    // The entry set is the palette's own purpose colours plus the RoomPalette's screens, plants,
    // lights and pools — no employee colours and no interactive-blue paints sneak in here.
    expect(hexLiterals("palette.ts").length).toBeGreaterThan(20);
    expect(Object.values(CATALOG)).toContain(CATALOG.ledOk);
  });
});
