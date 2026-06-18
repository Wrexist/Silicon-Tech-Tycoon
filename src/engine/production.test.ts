import { describe, expect, it } from "vitest";
import { dollars, toDollars } from "./money.ts";
import { BALANCE } from "./balance.ts";
import type { Product, CompetitorState, LaunchedProduct } from "./types.ts";
import {
  advanceOneWeek,
  applyEventEffect,
  buildWeeksFor,
  burn,
  launchReady,
  newGame,
  planProduction,
  recommendedRun,
  startBuild,
  effectiveUnitCost,
  verdictBands,
  type GameState,
} from "../state/gameState.ts";

/** Build a product to launch-ready, then return the recorded verdict. */
function buildAndLaunch(s0: GameState, product: Product): string | undefined {
  let s = startBuild(s0, product, recommendedRun(s0, product, "none"), "none").state;
  const weeks = buildWeeksFor(s) + 1;
  for (let i = 0; i < weeks; i++) s = advanceOneWeek(s);
  return launchReady(s, s.ready[0].id).state.launched[0].verdict;
}

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

describe("early-game fairness — the maiden launch must not punish a competent player", () => {
  // A fresh company's hype is tiny, so even a well-built, well-priced tier-1 product can only score
  // ~13–17. Before the era-1 flop floor was lowered to 10, that made the FIRST launch a guaranteed
  // flop (−reputation, −fans) for a product the player built correctly — a demoralizing opener.
  it("a sensibly-priced tier-1 first product lands 'steady', never 'flop'", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = newGame(seed);
      const unit = toDollars(effectiveUnitCost(s, phone()));
      const product: Product = { ...phone(), price: dollars(Math.max(120, Math.round(unit * 1.8))) };
      expect(buildAndLaunch(s, product)).not.toBe("flop");
    }
  });

  // Stakes are preserved: a genuinely bad bet (badly overpriced) still flops.
  it("a badly overpriced first product still flops — the floor isn't a free pass", () => {
    const s = newGame(1);
    const unit = toDollars(effectiveUnitCost(s, phone()));
    const gouged: Product = { ...phone(), price: dollars(unit * 6) };
    expect(buildAndLaunch(s, gouged)).toBe("flop");
  });

  // The positive feedback loop: shipping decent products must GROW your audience. Fans decay
  // every week, and before this only viral "hits" added any — so a company shipping steady
  // sellers slowly bled its whole fanbase (hype → score → verdict all stuck low: a dead-end
  // stall). A steady launch now wins fans on the spot, outpacing the decay.
  it("a steady seller grows the fanbase on launch (not just hits)", () => {
    const s0 = newGame(1);
    const unit = toDollars(effectiveUnitCost(s0, phone()));
    const product: Product = { ...phone(), price: dollars(Math.max(120, Math.round(unit * 1.8))) };
    let s = startBuild(s0, product, recommendedRun(s0, product, "none"), "none").state;
    const weeks = buildWeeksFor(s) + 1;
    for (let i = 0; i < weeks; i++) s = advanceOneWeek(s);
    const fansBefore = s.fans;
    const launched = launchReady(s, s.ready[0].id).state;
    expect(launched.launched[0].verdict).toBe("steady"); // precondition: this is the steady path
    expect(launched.fans).toBeGreaterThan(fansBefore); // …and it added fans rather than losing them
  });
});

/** An actively-selling launched product (flat 100-unit weeks) for cannibalization/haircut tests. */
function activeLaunched(p: Product, weeks = 4): LaunchedProduct {
  return {
    product: p,
    stats: { performance: 30, quality: 30, battery: 30, design: 30, ecosystem: 70 },
    unitCost: dollars(67),
    launchScore: 60,
    launchedWeek: 0,
    totalUnits: 100 * weeks,
    weeklyUnits: Array(weeks).fill(100),
    unitsSold: 0,
    weeksElapsed: 0,
    revenueToDate: dollars(0),
    plannedUnits: 100 * weeks,
    verdict: "steady",
  };
}

describe("v16 balance guards (audit fixes)", () => {
  it("your own active product in the category cannibalizes a relaunch's demand", () => {
    const s = newGame(7);
    const clear = planProduction(s, phone(), 100000, "none");
    expect(clear.selfCompeting).toBe(0);
    const crowded: GameState = { ...s, launched: [activeLaunched(phone())] };
    const split = planProduction(crowded, phone(), 100000, "none");
    expect(split.selfCompeting).toBe(1);
    expect(split.totalDemand).toBeLessThan(clear.totalDemand);
    expect(split.competitionFactor).toBeLessThan(clear.competitionFactor);
    // a lifecycle-complete product no longer cannibalizes
    const finished: GameState = {
      ...s,
      launched: [{ ...activeLaunched(phone()), weeksElapsed: 4 }],
    };
    expect(planProduction(finished, phone(), 100000, "none").selfCompeting).toBe(0);
  });

  it("supply-crunch events are capped to a share of cash — RNG can never bankrupt", () => {
    const s: GameState = { ...newGame(8), cash: dollars(6_000) };
    const share = BALANCE.events.crunchMaxCashShare;
    const hit = applyEventEffect(s, { kind: "supplyCrunch", cash: 8_000 }, 10, "crunch", "negative");
    expect(toDollars(hit.cash)).toBeCloseTo(6_000 - 6_000 * share, 0);
    expect(toDollars(hit.cash)).toBeGreaterThan(0);
    const broke = applyEventEffect({ ...s, cash: dollars(0) }, { kind: "supplyCrunch", cash: 8_000 }, 10, "crunch", "negative");
    expect(toDollars(broke.cash)).toBe(0);
  });

  it("ecosystem services pay a meaningful weekly annuity from the installed base", () => {
    // Lifecycle-complete product (no sales revenue) with a big installed base: cash delta over
    // one tick must be ecosystem income minus burn, and the income must be real money, not noise.
    const installed: LaunchedProduct = { ...activeLaunched(phone()), weeksElapsed: 4, unitsSold: 50_000 };
    const s: GameState = { ...newGame(9), cash: dollars(100_000), launched: [installed], nextEventWeek: 9_999 };
    const expectedEcoDollars = Math.round(50_000 * 70 * BALANCE.ecosystem.weeklyServiceRate) / 100;
    expect(expectedEcoDollars).toBeGreaterThan(500); // the old 0.0008 rate paid ~$28 — dead mechanic
    const next = advanceOneWeek(s);
    const delta = toDollars(next.cash) - toDollars(s.cash);
    expect(delta).toBeCloseTo(expectedEcoDollars - toDollars(burn(s)), 0);
  });

  it("a rival entering your active category dents the remaining sales curve (and only that one)", () => {
    const s0 = newGame(10);
    const tablet: Product = { ...phone(), id: "t", name: "Slate One", category: "tablet" };
    // Active in BOTH era-1 categories so whichever category the due rival picks is contested.
    const s: GameState = {
      ...s0,
      cash: dollars(500_000),
      nextEventWeek: 9_999,
      launched: [activeLaunched(phone()), activeLaunched(tablet)],
      competitors: s0.competitors.map((c, i) => ({ ...c, nextLaunchWeek: i === 0 ? 0 : 999 })),
    };
    const next = advanceOneWeek(s);
    const haircut = 1 - BALANCE.market.competition.rivalEntrySalesHaircut;
    const dented = next.launched.filter((lp) => lp.weeklyUnits[1] === Math.round(100 * haircut));
    const untouched = next.launched.filter((lp) => lp.weeklyUnits[1] === 100);
    expect(dented.length).toBe(1);
    expect(untouched.length).toBe(1);
    // the already-sold week is never rewritten, and the forecast total stays honest
    for (const lp of next.launched) expect(lp.weeklyUnits[0]).toBe(100);
    const d = dented[0];
    expect(d.totalUnits).toBe(d.unitsSold + d.weeklyUnits.slice(d.weeksElapsed).reduce((a, b) => a + b, 0));
  });
});
