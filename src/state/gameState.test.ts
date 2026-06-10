import { describe, it, expect } from "vitest";
import { dollars } from "../engine/money.ts";
import { BALANCE } from "../engine/balance.ts";
import type { Product } from "../engine/types.ts";
import {
  advanceOneWeek,
  burn,
  buildWeeksFor,
  buildSafetyReserve,
  startBuild,
  launchReady,
  catchUpOffline,
  newGame,
  planProduction,
  recommendedRun,
  researchNext,
  researchedTier,
  hireStaff,
  rdRpCostFor,
  startRecruitment,
  hireCandidate,
  type GameState,
} from "./gameState.ts";
import { toDollars } from "../engine/money.ts";

function goodPhone(): Product {
  return {
    id: "x",
    name: "Aurora One",
    category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(140),
    designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
  };
}

describe("recruitment", () => {
  it("runs a search, produces candidates, and signing adds exactly one employee", () => {
    let s = newGame(42);
    const cost = BALANCE.recruitment.tiers.board.cost;
    const before = s.cash;
    s = startRecruitment(s, "board");
    expect(s.recruitment).not.toBeNull();
    expect(s.cash).toBe(before - cost);
    // candidates arrive after the search duration
    for (let i = 0; i < BALANCE.recruitment.tiers.board.weeks; i++) s = advanceOneWeek(s);
    expect(s.recruitment).toBeNull();
    expect(s.candidates.length).toBe(BALANCE.recruitment.candidates);
    // every candidate has a 0..100 profile and a derived 1..10 level
    for (const c of s.candidates) {
      expect(c.skill).toBeGreaterThanOrEqual(1);
      expect(c.skill).toBeLessThanOrEqual(10);
      for (const d of ["engineering", "design", "marketing"] as const) {
        expect(c.skills[d]).toBeGreaterThanOrEqual(0);
        expect(c.skills[d]).toBeLessThanOrEqual(100);
      }
    }
    const teamBefore = s.staff.length;
    // signing is desk-gated: without a free desk the hire is refused...
    const noDesk = hireCandidate({ ...s, cash: dollars(999_999) }, s.candidates[0].id);
    expect(noDesk.staff.length).toBe(teamBefore);
    // ...and goes through once a desk is bought
    s = hireCandidate(
      {
        ...s,
        cash: dollars(999_999),
        layout: [...s.layout, { iid: `f${s.furnitureCounter}`, type: "desk", c: 5, r: 2, rot: 0 }],
        furnitureCounter: s.furnitureCounter + 1,
      },
      s.candidates[0].id,
    );
    expect(s.staff.length).toBe(teamBefore + 1);
    expect(s.candidates.length).toBe(0); // shortlist clears after a signing
  });

  it("cannot start a second search while one is running", () => {
    let s = startRecruitment(newGame(7), "board");
    const running = s.recruitment;
    s = startRecruitment(s, "headhunter");
    expect(s.recruitment).toBe(running);
  });

  it("the headhunter channel returns stronger candidates than the job board", () => {
    const avg = (tier: "board" | "headhunter") => {
      let s = newGame(99);
      s = startRecruitment(s, tier);
      for (let i = 0; i < BALANCE.recruitment.tiers[tier].weeks; i++) s = advanceOneWeek(s);
      return s.candidates.reduce((a, c) => a + c.skill, 0) / s.candidates.length;
    };
    expect(avg("headhunter")).toBeGreaterThan(avg("board"));
  });

  it("an unsigned shortlist expires after the window", () => {
    let s = startRecruitment(newGame(3), "board");
    for (let i = 0; i < BALANCE.recruitment.tiers.board.weeks; i++) s = advanceOneWeek(s);
    expect(s.candidates.length).toBeGreaterThan(0);
    for (let i = 0; i < BALANCE.recruitment.expireWeeks; i++) s = advanceOneWeek(s);
    expect(s.candidates.length).toBe(0);
  });

  it("respects the garage capacity of 4", () => {
    expect(BALANCE.facilities[0].staffCapacity).toBe(4);
  });
});

describe("game state reducers", () => {
  it("is deterministic from a seed", () => {
    const a = advanceOneWeek(advanceOneWeek(newGame(1234)));
    const b = advanceOneWeek(advanceOneWeek(newGame(1234)));
    expect(a.cash).toBe(b.cash);
    expect(a.week).toBe(b.week);
    expect(a.rngState).toBe(b.rngState);
  });

  it("a 160-week run is fully reproducible from the same start (AUDIT 1.10 — RNG isolation)", () => {
    // Cash-boosted so the company survives the whole horizon and the run exercises events,
    // rival launches, trend retargets and share-price evolution — not just early burn.
    const start = { ...newGame(7777), cash: dollars(5_000_000) };
    const clone = structuredClone(start); // identical incl. lastActive (two newGame calls differ)
    const run = (s0: typeof start) => {
      let s = s0;
      for (let w = 0; w < 160; w++) s = advanceOneWeek(s);
      return s;
    };
    const a = run(start);
    const b = run(clone);
    // feed ids embed the module-level feedSeq counter (F4), which keeps counting across the two
    // in-process runs — normalize ids away and compare EVERYTHING else bit-for-bit.
    const norm = (s: typeof start) => ({ ...s, feed: s.feed.map((f) => ({ week: f.week, text: f.text, tone: f.tone })) });
    expect(norm(b)).toEqual(norm(a));
    // the horizon actually exercised the sim, and ids stayed unique within a run (F4 invariant)
    expect(a.week).toBe(160);
    expect(a.feed.length).toBeGreaterThan(0);
    expect(new Set(a.feed.map((f) => f.id)).size).toBe(a.feed.length);
  });

  it("builds then launches a product, accruing revenue over weeks", () => {
    // Production + tooling are paid upfront now, so seed enough cash to fund a real run + runway.
    let s = { ...newGame(42), cash: dollars(500_000) };
    const res = startBuild(s, goodPhone(), 800, "none");
    expect(res.ok).toBe(true);
    s = res.state;
    expect(s.building).toHaveLength(1);
    // advance until it finishes building and lands on the ready shelf
    const weeks = buildWeeksFor(s) + 1;
    for (let i = 0; i < weeks; i++) s = advanceOneWeek(s);
    expect(s.ready.length).toBeGreaterThan(0);
    const launchRes = launchReady(s, s.ready[0].id);
    expect(launchRes.ok).toBe(true);
    s = launchRes.state;
    expect(s.launched).toHaveLength(1);
    for (let i = 0; i < 16; i++) s = advanceOneWeek(s);
    const lp = s.launched[0];
    expect(lp.unitsSold).toBeGreaterThan(0);
    expect(lp.revenueToDate).toBeGreaterThan(0);
  });

  it("records a launch-insight snapshot of the drivers behind the outcome", () => {
    let s = { ...newGame(42), cash: dollars(500_000) };
    s = startBuild(s, goodPhone(), 800, "none").state;
    const weeks = buildWeeksFor(s) + 1;
    for (let i = 0; i < weeks; i++) s = advanceOneWeek(s);
    s = launchReady(s, s.ready[0].id).state;
    const ins = s.launched[0].insight;
    expect(ins).toBeDefined();
    // demand fit is a 0..100 read; competition factor is a 0..1 retained-share multiplier.
    expect(ins!.demandFit).toBeGreaterThanOrEqual(0);
    expect(ins!.demandFit).toBeLessThanOrEqual(100);
    expect(ins!.competitionFactor).toBeGreaterThan(0);
    expect(ins!.competitionFactor).toBeLessThanOrEqual(1);
    expect(ins!.priceFit).toBeGreaterThan(0);
    expect(ins!.hype).toBeGreaterThan(0);
    expect(ins!.matchingRivals).toBeGreaterThanOrEqual(0);
    expect(ins!.betterRivals).toBeGreaterThanOrEqual(0);
  });

  it("rejects building an incomplete product", () => {
    const s = newGame(1);
    const bad = { ...goodPhone(), tiers: { chip: 1 } };
    const res = startBuild(s, bad);
    expect(res.ok).toBe(false);
  });

  it("research deducts RP and raises the tier", () => {
    let s = newGame(7);
    for (let i = 0; i < 8; i++) s = advanceOneWeek(s); // accumulate RP
    const cost = rdRpCostFor(s, "chip")!;
    expect(s.researchPoints).toBeGreaterThanOrEqual(cost);
    const after = researchNext(s, "chip");
    expect(researchedTier(after, "chip")).toBe(2);
    expect(after.researchPoints).toBeCloseTo(s.researchPoints - cost, 5);
  });

  it("hiring is desk-gated: blocked at full desks, works once a desk is bought", () => {
    const s = newGame(9); // 1 founder, 1 desk (the default room) → every seat taken
    const blocked = hireStaff(s, "engineer", 4, "Dev");
    expect(blocked.staff.length).toBe(s.staff.length); // no free desk → no hire, no charge
    expect(blocked.cash).toBe(s.cash);
    const withDesk: GameState = {
      ...s,
      layout: [...s.layout, { iid: `f${s.furnitureCounter}`, type: "desk", c: 5, r: 2, rot: 0 }],
      furnitureCounter: s.furnitureCounter + 1,
    };
    const before = burn(withDesk);
    const after = hireStaff(withDesk, "engineer", 4, "Dev");
    expect(after.staff.length).toBe(withDesk.staff.length + 1);
    expect(burn(after)).toBeGreaterThan(before);
  });

  it("weekly burn is deducted even with no products", () => {
    const base = newGame(3);
    const withDesk: GameState = {
      ...base,
      layout: [...base.layout, { iid: `f${base.furnitureCounter}`, type: "desk", c: 5, r: 2, rot: 0 }],
      furnitureCounter: base.furnitureCounter + 1,
    };
    const s = hireStaff(withDesk, "marketer", 5, "Mkt");
    const after = advanceOneWeek(s);
    expect(after.cash).toBeLessThan(s.cash);
  });
});

describe("B1 — recommended run can't bankrupt a fresh save during the build", () => {
  it("leaves at least the build-through safety reserve after paying the run upfront", () => {
    // A default new game (tight starting cash, garage rent) is the soft-lock case.
    const s = newGame(1234);
    const run = recommendedRun(s, goodPhone(), "none");
    const plan = planProduction(s, goodPhone(), run, "none");
    const reserve = buildSafetyReserve(s);
    const cashAfter = toDollars(s.cash) - toDollars(plan.totalUpfront);
    // Survive the build: cash left ≥ the reserve (= buildWeeks × burn + margin), within $1 rounding.
    expect(cashAfter + 1).toBeGreaterThanOrEqual(toDollars(reserve) - 1);
  });

  it("the recommended run survives the whole build without going bankrupt", () => {
    let s = newGame(77);
    const run = recommendedRun(s, goodPhone(), "none");
    s = startBuild(s, goodPhone(), run, "none").state;
    expect(s.bankrupt).toBe(false);
    // Tick through the entire build; the company must still be solvent when it lands ready.
    const weeks = buildWeeksFor(s) + 1;
    for (let i = 0; i < weeks; i++) s = advanceOneWeek(s);
    expect(s.bankrupt).toBe(false);
    expect(toDollars(s.cash)).toBeGreaterThanOrEqual(0);
  });
});

describe("B4 — sellout fan-gain is bounded (no free fan-grind)", () => {
  /** Build the given run, tick through the build, launch, and return fans before/after launch.
   *  Demand is re-evaluated at launch time, so we read the actual metShare the engine used. */
  function launchWithRun(seed: number, fans: number, run: number) {
    let s = { ...newGame(seed), fans, cash: dollars(50_000_000) };
    s = startBuild(s, goodPhone(), run, "none").state;
    for (let i = 0; i < buildWeeksFor(s) + 1; i++) s = advanceOneWeek(s);
    const before = s.fans;
    s = launchReady(s, s.ready[0].id).state;
    return { before, after: s.fans, lp: s.launched[0] };
  }

  it("a token under-supplied run that sells out is NOT rewarded with fan growth", () => {
    // Huge fanbase + minimum run → sells out while ignoring most of the market. Old behaviour
    // multiplied fans up for free; now a token run earns no buzz (and chronic undersupply costs a bit).
    const { before, after } = launchWithRun(5, 50_000, 50);
    expect(after).toBeLessThanOrEqual(before);
  });

  it("the sellout fan-bonus is bounded by selloutFanBonus (can't farm unbounded fans)", () => {
    // Worst case for the exploit: a huge fanbase that sells out. Whatever the verdict, the fan
    // change from a single launch can never exceed the legitimate maximum: the flat hit bump +
    // per-unit hit gain, then at most a selloutFanBonus multiplier. A token sellout that fails the
    // metShare gate is penalised instead — so the realised gain is strictly ≤ this analytic cap.
    const fb = BALANCE.fans;
    const fans = 50_000;
    const { before, after, lp } = launchWithRun(5, fans, 50);
    const maxHitFans = before + fb.gainOnHitFlat + (lp.totalUnits / 1000) * fb.gainPerHitUnitsK;
    const analyticCap = Math.round(maxHitFans * (1 + fb.selloutFanBonus));
    expect(after).toBeLessThanOrEqual(analyticCap);
  });

  it("fan pre-orders can't supply the entire market (cap forces some open-market demand)", () => {
    const s = { ...newGame(11), fans: 1_000_000, cash: dollars(50_000_000) };
    const plan = planProduction(s, goodPhone(), 1_000_000, "none");
    // Pre-orders are capped to a share of total demand, so market demand is always a real slice,
    // and pre-orders never equal total demand (the exploit's precondition).
    expect(plan.marketDemand).toBeGreaterThan(0);
    expect(plan.preOrders).toBeLessThan(plan.totalDemand);
    // Cap holds: pre-orders ≤ preOrderCap × total demand (+1 for integer rounding).
    expect(plan.preOrders).toBeLessThanOrEqual(BALANCE.fans.preOrderCap * plan.totalDemand + 1);
  });
});

describe("offline catch-up", () => {
  function launched(seed: number): GameState {
    let s = { ...newGame(seed), cash: dollars(500_000) };
    s = startBuild(s, goodPhone(), 800, "none").state;
    for (let i = 0; i < buildWeeksFor(s) + 1; i++) s = advanceOneWeek(s);
    s = launchReady(s, s.ready[0].id).state;
    // Freeze rivals so no mid-life rival-entry haircut perturbs the sales curve — this isolates
    // the offline mechanic (the two timelines below would otherwise evolve rivals differently).
    return { ...s, competitors: [] };
  }

  it("never skips a product's sales — offline catch-up sells through the same as active play", () => {
    // Reference: a run played straight through actively reaches some final sell-through.
    let active = launched(42);
    const curveLen = active.launched[0].weeklyUnits.length;
    for (let i = 0; i < curveLen + 2; i++) active = advanceOneWeek(active);
    const activeSold = active.launched[0].unitsSold;
    expect(activeSold).toBeGreaterThan(0);

    // Offline path: away for the max catch-up window, then finish actively. The old fractional
    // path advanced the curve a full week per offline tick while banking only half the units, so
    // the skipped half was lost forever and final unitsSold ended BELOW the active run. The
    // half-speed-time fix must make the two paths reach an identical total.
    let off = launched(42);
    off = { ...off, lastActive: Date.now() - BALANCE.offline.maxCatchUpWeeks * BALANCE.secondsPerTick * 1000 };
    off = catchUpOffline(off).state;
    for (let i = 0; i < curveLen + 2; i++) off = advanceOneWeek(off);
    expect(off.launched[0].unitsSold).toBe(activeSold);
  });

  it("clamps a production run to BALANCE.build.maxRun", () => {
    const s = { ...newGame(3), cash: dollars(50_000_000_000), sandboxUnlocked: true };
    const res = startBuild(s, goodPhone(), BALANCE.build.maxRun * 3, "none");
    expect(res.ok).toBe(true);
    expect(res.state.building[0].plannedUnits).toBeLessThanOrEqual(BALANCE.build.maxRun);
  });
});
