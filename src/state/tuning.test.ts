// Build tuning — the performance/efficiency trade-off applied in the state layer (productStats),
// not the protected computeStats. Defaults "balanced" (no ripple); shifts points between
// performance and battery otherwise.
import { describe, it, expect } from "vitest";
import { newGame, productStats } from "./gameState.ts";
import { computeStats } from "../engine/product.ts";
import { BALANCE } from "../engine/balance.ts";
import type { Product, ProductTuning } from "../engine/types.ts";

function draft(tuning: ProductTuning): Product {
  return {
    id: "d", name: "Test", category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium", colorIndex: 0, price: 49900 as never, designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch", refreshRate: 60, storage: 128, tuning,
  };
}

describe("build tuning (state-layer)", () => {
  const s = newGame(1);

  it("balanced is neutral on the perf/battery axis vs an untuned draft", () => {
    const balanced = productStats(s, draft("balanced"));
    const untuned = productStats(s, { ...draft("balanced"), tuning: undefined });
    expect(balanced.performance).toBe(untuned.performance);
    expect(balanced.battery).toBe(untuned.battery);
  });

  it("performance trades battery → performance; efficiency trades the other way", () => {
    const bal = productStats(s, draft("balanced"));
    const perf = productStats(s, draft("performance"));
    const eff = productStats(s, draft("efficiency"));

    // Directional (clamp-safe): performance never lowers perf / raises battery, and vice-versa.
    expect(perf.performance).toBeGreaterThanOrEqual(bal.performance);
    expect(perf.battery).toBeLessThanOrEqual(bal.battery);
    expect(eff.battery).toBeGreaterThanOrEqual(bal.battery);
    expect(eff.performance).toBeLessThanOrEqual(bal.performance);

    // And the effect is actually present (not a no-op) on at least one axis each.
    expect(perf.performance > bal.performance || perf.battery < bal.battery).toBe(true);
    expect(eff.battery > bal.battery || eff.performance < bal.performance).toBe(true);

    // Tuning never touches the other stats.
    expect(perf.design).toBe(bal.design);
    expect(eff.quality).toBe(bal.quality);
  });

  it("stays within 0..100 (clamped both ends)", () => {
    for (const t of ["balanced", "performance", "efficiency"] as ProductTuning[]) {
      const st = productStats(s, draft(t));
      for (const v of Object.values(st)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(BALANCE.statMax);
      }
    }
  });

  it("does not affect a launched product's snapshot (computeStats is untuned)", () => {
    // computeStats (protected) ignores tuning — proves zero retroactive ripple on launched stats.
    expect(computeStats(draft("performance"))).toEqual(computeStats(draft("efficiency")));
  });
});
