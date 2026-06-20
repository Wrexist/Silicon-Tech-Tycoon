import { describe, expect, it } from "vitest";
import { format, dollars } from "./money.ts";
import { canAdvanceEra, maxEra } from "./eras.ts";
import { pickEvent } from "./events.ts";
import { makeRng } from "./rng.ts";
import { forecast } from "./salesCurve.ts";
import { furnitureDef } from "./furniture.ts";
import type { FurnitureId } from "./furniture.ts";

describe("engine robustness (audit hardening)", () => {
  it("money.format never throws on extreme values", () => {
    expect(() => format(dollars(9e15))).not.toThrow();
    expect(format(dollars(0))).toBe("$0");
    expect(format(Infinity as unknown as ReturnType<typeof dollars>)).toBe("$0");
  });

  it("canAdvanceEra returns false at the final era (no advancing past max)", () => {
    expect(canAdvanceEra(maxEra(), 100, dollars(1e12))).toBe(false);
    // an early era with huge reputation can advance
    expect(canAdvanceEra(1, 100, dollars(0))).toBe(true);
  });

  it("pickEvent never returns undefined, even for an out-of-range era", () => {
    const rng = makeRng(123);
    for (let era = 0; era <= 6; era++) {
      const ev = pickEvent(rng, era);
      expect(ev).toBeTruthy();
      expect(ev.effect).toBeTruthy();
    }
  });

  it("forecast is finite at score 0 and tiny market size", () => {
    const f0 = forecast(0, 1);
    expect(f0.totalUnits).toBe(0);
    expect(f0.weeklyUnits.every((u) => Number.isFinite(u))).toBe(true);
    const f1 = forecast(120, 0);
    expect(f1.weeklyUnits.reduce((a, b) => a + b, 0)).toBe(f1.totalUnits);
  });

  it("forecast sanitises non-finite inputs instead of propagating NaN/Infinity", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const f = forecast(120, bad, 1);
      expect(Number.isFinite(f.totalUnits)).toBe(true);
      expect(f.weeklyUnits.every((u) => Number.isFinite(u))).toBe(true);
      const g = forecast(120, 1, bad);
      expect(Number.isFinite(g.totalUnits)).toBe(true);
      expect(g.weeklyUnits.every((u) => Number.isFinite(u))).toBe(true);
      const h = forecast(bad, 1, 1);
      expect(Number.isFinite(h.totalUnits)).toBe(true);
      expect(h.weeklyUnits.every((u) => Number.isFinite(u))).toBe(true);
    }
  });

  it("furnitureDef falls back instead of returning undefined for a bad id", () => {
    expect(furnitureDef("not-a-real-id" as FurnitureId)).toBeTruthy();
    expect(furnitureDef("sofa").id).toBe("sofa");
  });
});
