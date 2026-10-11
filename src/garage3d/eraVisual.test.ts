import { describe, expect, it } from "vitest";
import { maxEra } from "../engine/eras.ts";
import { roomPalette } from "./palette.ts";
import { eraVisual, withEraFinish } from "./eraVisual.ts";

describe("era visuals (O5)", () => {
  it("every era looks different from the one before it", () => {
    for (let era = 2; era <= maxEra(); era++) {
      const a = eraVisual(era - 1), b = eraVisual(era);
      const sameBrand = JSON.stringify(a.brand) === JSON.stringify(b.brand);
      const sameKey = a.key.day === b.key.day && a.key.night === b.key.night;
      expect(sameBrand && sameKey, `era ${era} must change the brand wall or the light`).toBe(false);
      expect(b.brand, `era ${era} must restyle the brand wall`).not.toBeNull();
    }
  });

  it("keeps the factory's era accents exactly (blue, blue, cyan, violet, gold)", () => {
    expect([1, 2, 3, 4, 5].map((e) => eraVisual(e).accent)).toEqual(["#3b82f6", "#3b82f6", "#22d3ee", "#a78bfa", "#f5b53d"]);
  });

  it("clamps out-of-range eras and leaves the Garage on the room's own finish", () => {
    expect(eraVisual(0)).toBe(eraVisual(1));
    expect(eraVisual(99)).toBe(eraVisual(maxEra()));
    for (const dark of [false, true]) {
      const p = roomPalette(dark);
      expect(withEraFinish(p, 1)).toBe(p);
      const later = withEraFinish(p, 3);
      expect(later.signGlow).toBe(eraVisual(3).brand!.signGlow);
      expect(later.floor).toBe(p.floor); // only the brand wall changes, never the player's room
    }
  });
});
