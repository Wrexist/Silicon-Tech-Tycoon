// Category subsystems (Track D): cooling / sensors as category-specific, tiered specs.
import { describe, expect, it } from "vitest";
import { subsystemFor, maxSubsystemStep, effectiveSubsystemStep, subsystemStatBonus, SUBSYSTEMS } from "./subsystems.ts";
import { computeStats, buildCost } from "./product.ts";
import { toDollars } from "./money.ts";
import { dollars } from "./money.ts";
import type { CategoryId, Product } from "./types.ts";

function make(category: CategoryId, subsystem?: number): Product {
  return {
    id: "p", name: "P", category,
    tiers: { chip: 3, display: 3, battery: 3, materials: 3, software: 3 },
    finish: "aluminium", colorIndex: 0, price: dollars(999), designTier: 2,
    camera: { count: 1, layout: "vertical", position: "topLeft", module: "squircle", flash: true }, notch: "none",
    subsystem,
  } as Product;
}

describe("category subsystems", () => {
  it("laptops/desktops/consoles have Cooling; wearables have Sensors; phones have none", () => {
    expect(subsystemFor("laptop")?.name).toBe("Cooling");
    expect(subsystemFor("desktop")?.name).toBe("Cooling");
    expect(subsystemFor("wearable")?.name).toBe("Sensors");
    expect(subsystemFor("phone")).toBeNull();
    expect(maxSubsystemStep("phone")).toBe(0);
  });

  it("tablets/monitors/AR glasses have signature subsystems; phones stay bare (sim-safe)", () => {
    expect(subsystemFor("tablet")?.name).toBe("Stylus");
    expect(subsystemFor("monitor")?.name).toBe("Colour Accuracy");
    expect(subsystemFor("experimental")?.name).toBe("Optics");
    expect(subsystemFor("phone")).toBeNull(); // the phone-only balance sim must stay byte-identical
  });

  it("the new subsystems lift their category's headline stats", () => {
    expect(computeStats(make("tablet", 2)).design).toBeGreaterThan(computeStats(make("tablet", 0)).design);
    expect(computeStats(make("monitor", 2)).quality).toBeGreaterThan(computeStats(make("monitor", 0)).quality);
    expect(computeStats(make("experimental", 2)).performance).toBeGreaterThan(computeStats(make("experimental", 0)).performance);
  });

  it("the step clamps to the subsystem's range", () => {
    expect(effectiveSubsystemStep("laptop", 99)).toBe(maxSubsystemStep("laptop"));
    expect(effectiveSubsystemStep("laptop", -3)).toBe(0);
    expect(effectiveSubsystemStep("phone", 2)).toBe(0); // no subsystem → always 0
  });

  it("upgrading a subsystem lifts the right stat", () => {
    const cold = computeStats(make("laptop", 0));
    const hot = computeStats(make("laptop", 2));
    expect(hot.performance).toBeGreaterThan(cold.performance); // cooling → performance
    const basic = computeStats(make("wearable", 0));
    const clinical = computeStats(make("wearable", 2));
    expect(clinical.ecosystem).toBeGreaterThan(basic.ecosystem); // sensors → ecosystem
  });

  it("a phone ignores any subsystem value (no stat change, sim-safe)", () => {
    expect(computeStats(make("phone", 0))).toEqual(computeStats(make("phone", 2)));
  });

  it("each subsystem step adds a real per-unit build cost", () => {
    expect(toDollars(buildCost(make("laptop", 2)))).toBeGreaterThan(toDollars(buildCost(make("laptop", 0))));
  });

  it("subsystemStatBonus is empty at the baseline and for categories without one", () => {
    expect(subsystemStatBonus("laptop", 0)).toEqual({});
    expect(subsystemStatBonus("phone", 2)).toEqual({});
    expect(Object.keys(subsystemStatBonus("laptop", 1)).length).toBeGreaterThan(0);
  });

  it("every subsystem names a category that exists and a non-empty bonus", () => {
    for (const s of SUBSYSTEMS) {
      expect(s.categories.length).toBeGreaterThan(0);
      expect(s.optionLabels.length).toBeGreaterThanOrEqual(2);
      expect(Object.keys(s.perStep).length).toBeGreaterThan(0);
    }
  });
});
