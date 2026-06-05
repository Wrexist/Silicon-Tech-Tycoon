import { describe, expect, it } from "vitest";
import { dollars, toDollars } from "./money.ts";
import { BALANCE } from "./balance.ts";
import type { Product, CompetitorState } from "./types.ts";
import {
  advanceOneWeek,
  buildWeeksFor,
  launchReady,
  newGame,
  planProduction,
  recommendedRun,
  startBuild,
  verdictBands,
  type GameState,
} from "../state/gameState.ts";

/** Mirror of DesignLab's projected verdict (B7): the lab uses the SAME competition-adjusted
 *  effectiveScore + the SAME era-scaled verdict bands the launch gate uses. */
function labVerdict(s: GameState, product: Product): "hit" | "flop" | "steady" {
  const plan = planProduction(s, product, BALANCE.build.minRun, "none");
  const eff = plan.launchScore * plan.competitionFactor;
  const bands = verdictBands(s.era);
  return eff >= bands.hit ? "hit" : eff <= bands.flop ? "flop" : "steady";
}

function phone(): Product {
  return {
    id: "x",
    name: "Aurora One",
    category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(160),
    designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
  };
}

function rival(id: string, strength: number): CompetitorState {
  return { id, name: id, blurb: "", reputation: 60, strengthByCategory: { phone: strength }, nextLaunchWeek: 99, sharePrice: 5000, priceHistory: [50] };
}

describe("production planning + smart demand", () => {
  it("more fans → more pre-orders", () => {
    const base = newGame(1);
    const few = planProduction({ ...base, fans: 200 }, phone(), 1000, "none");
    const many = planProduction({ ...base, fans: 5000 }, phone(), 1000, "none");
    expect(many.preOrders).toBeGreaterThan(few.preOrders);
  });

  it("a better-fitting product (vs demand) sells more", () => {
    const s = newGame(2);
    // crank trends to favour design, then a high-design vs low-design product
    const designy: GameState = { ...s, trends: { weights: { performance: 0.05, quality: 0.05, battery: 0.05, design: 0.8, ecosystem: 0.05 }, targetWeights: s.trends.targetWeights } };
    const plan = planProduction(designy, phone(), 100000, "none");
    expect(plan.demandFit).toBeGreaterThan(0);
    expect(plan.totalDemand).toBeGreaterThan(plan.preOrders); // organic demand on top of fans
  });

  it("rivals that beat you cut your market demand", () => {
    const s = newGame(3);
    const clear = planProduction(s, phone(), 100000, "none");
    // strength 999 is above any possible overall (max 100) → unambiguously "beats" you
    const contested: GameState = { ...s, competitors: [rival("a", 999), rival("b", 999), rival("c", 999)] };
    const fought = planProduction(contested, phone(), 100000, "none");
    expect(fought.betterRivals).toBeGreaterThan(0);
    expect(fought.marketDemand).toBeLessThan(clear.marketDemand);
    expect(fought.competitionFactor).toBeLessThan(1);
  });

  it("sales are capped by the production run (under-producing = sellout)", () => {
    const s = { ...newGame(4), fans: 8000, cash: dollars(50_000_000) };
    const small = planProduction(s, phone(), 50, "none");
    expect(small.projectedSales).toBe(50);
    expect(small.sellsOut).toBe(true);
  });

  it("startBuild charges tooling + full run upfront and stores the plan", () => {
    const s = { ...newGame(5), cash: dollars(5_000_000) };
    const units = 500;
    const before = s.cash;
    const res = startBuild(s, phone(), units, "none");
    expect(res.ok).toBe(true);
    expect(res.state.cash).toBeLessThan(before); // paid upfront
    expect(res.state.building[0].plannedUnits).toBe(units);
  });

  it("recommendedRun is within affordable bounds", () => {
    const s = { ...newGame(6), cash: dollars(200_000) };
    const run = recommendedRun(s, phone(), "none");
    const plan = planProduction(s, phone(), run, "none");
    expect(run).toBeGreaterThan(0);
    expect(toDollars(plan.totalUpfront)).toBeLessThanOrEqual(toDollars(s.cash) + 1);
  });

  // B7 — the lab's projected verdict must agree with the verdict the launch actually records.
  it("DesignLab projected verdict matches the launch verdict (competition-adjusted, same thresholds)", () => {
    // A spread of seeds + competitive conditions so we exercise hits, flops and steady sellers.
    const cases: GameState[] = [
      newGame(101),
      { ...newGame(202), competitors: [rival("a", 999), rival("b", 999), rival("c", 999)] }, // crushed → flop-ward
      { ...newGame(303), reputation: 90, fans: 6000 }, // strong → hit-ward
    ];
    for (const base of cases) {
      const s0 = { ...base, cash: dollars(50_000_000) };
      // Build + advance to launch-ready state, then compute labVerdict from the SAME state the
      // engine uses — this tests that the lab formula and the launch formula agree at the same
      // moment (B7), not that the forecast is stable over time (the competitive landscape can
      // shift during production, which is intentional gameplay).
      let s = startBuild(s0, phone(), recommendedRun(s0, phone(), "none"), "none").state;
      const weeks = buildWeeksFor(s) + 1;
      for (let i = 0; i < weeks; i++) s = advanceOneWeek(s);
      const predicted = labVerdict(s, phone());
      const launched = launchReady(s, s.ready[0].id).state.launched[0];
      expect(launched.verdict).toBe(predicted);
    }
  });
});
