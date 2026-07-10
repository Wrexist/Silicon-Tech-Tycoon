import { describe, it, expect } from "vitest";
import { dollars } from "../engine/money.ts";
import { BALANCE } from "../engine/balance.ts";
import { CONTRACT_BOARD_SIZE, type Contract } from "../engine/contracts.ts";
import type { Product } from "../engine/types.ts";
import {
  advanceOneWeek,
  burn,
  buildWeeksFor,
  buildSafetyReserve,
  startBuild,
  skipInterrupt,
  rushBuild,
  launchReady,
  newGame,
  planProduction,
  recommendedRun,
  researchNext,
  researchedTier,
  hireStaff,
  rdRpCostFor,
  startRecruitment,
  hireCandidate,
  unlockLens,
  lensUnlockCost,
  unlockFinish,
  finishUnlockCost,
  productStats,
  marketingPush,
  marketingPushQuote,
  restockQuote,
  restockProduct,
  claimContract,
  buyUpgrade,
  upgradeGate,
  restStaff,
  restCost,
  trainStaff,
  rndSkill,
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

  it("the 160-week do-nothing run matches its frozen golden snapshot (criterion-b guard)", () => {
    // GOLDEN MASTER companion to the self-consistency pin above. That test runs the same code twice,
    // so it structurally CANNOT catch a criterion-(b) regression — a newly-added system that fires in
    // a do-nothing run shifts both runs identically and they still agree. This pins the actual
    // week-160 outcome of seed 7777 (cash-boosted, zero player actions) to frozen values, so an
    // un-gated new system, a re-salted derived-hash stream, or any drift in the base sim fails HERE.
    // Every value is an integer → robust across platforms (no float-representation risk): rngState is
    // the main-RNG draw fingerprint; feed length + the economy + the interrupt-cadence stamp catch
    // side-channel (derived-hash) drift that never touches the main RNG. If you changed the sim on
    // purpose, re-derive these from the run and update them in the SAME commit — that is the point.
    let s = { ...newGame(7777), cash: dollars(5_000_000) };
    for (let w = 0; w < 160; w++) s = advanceOneWeek(s);
    expect(s.week).toBe(160);
    expect(s.rngState).toBe(1_964_288_166);
    expect(toDollars(s.cash)).toBe(4_975_300);
    expect(toDollars(s.cumulativeRevenue)).toBe(0);
    expect(s.fans).toBe(304);
    expect(s.reputation).toBe(8);
    expect(s.era).toBe(1);
    expect(s.researchPoints).toBe(555);
    expect(s.competitors.length).toBe(12);
    expect(s.feed.length).toBe(60);
    expect(s.nextEventWeek).toBe(174);
    expect(s.lastInterruptWeek).toBe(156);
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

  it("a 'solid' launch grants reputation (so quality alone can climb the era gates)", () => {
    // Search designTier × price for the first launch that lands a 'solid' verdict, then assert it
    // moved reputation by exactly gainPerSolid. Fresh game → 0 fans (no milestone rep bonus) and a
    // 'none' campaign (channel reputation 0), so the solid branch is the only rep contribution.
    let found = false;
    outer: for (let designTier = 1; designTier <= 3 && !found; designTier++) {
      for (const price of [140, 220, 320, 460, 640, 900]) {
        let s = { ...newGame(42), cash: dollars(2_000_000) };
        const product: Product = {
          ...goodPhone(),
          tiers: { chip: 3, display: 3, battery: 3, materials: 3, software: 3, camera: 3 },
          designTier,
          price: dollars(price),
        };
        const build = startBuild(s, product, 1500, "none");
        if (!build.ok) continue;
        s = build.state;
        for (let i = 0; i < buildWeeksFor(s) + 1; i++) s = advanceOneWeek(s);
        if (s.ready.length === 0) continue;
        const repBefore = s.reputation;
        s = launchReady(s, s.ready[0].id).state;
        if (s.launched[0]?.verdict === "solid") {
          expect(s.reputation - repBefore).toBeCloseTo(BALANCE.reputation.gainPerSolid, 5);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true); // the search must actually exercise a 'solid' launch
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

// Offline catch-up was removed — the sim only advances while the app is open. `advanceOneWeek`'s
// `offline` flag is retained but dormant; the staff-quit case below still exercises its `!offline`
// guard directly, and the run-clamp test is unrelated to time.
describe("live-play guards & run clamping", () => {
  it("clamps a production run to BALANCE.build.maxRun", () => {
    const s = { ...newGame(3), cash: dollars(50_000_000_000), sandboxUnlocked: true };
    const res = startBuild(s, goodPhone(), BALANCE.build.maxRun * 3, "none");
    expect(res.ok).toBe(true);
    expect(res.state.building[0].plannedUnits).toBeLessThanOrEqual(BALANCE.build.maxRun);
  });

  it("never lets staff quit while offline, though the same at-risk roster can quit while playing", () => {
    // A maximally at-risk, badly-underpaid non-founder employee, cloned from the founder so every
    // field is valid. High cash keeps the company solvent across the run so churn evaluates weekly.
    function atRisk(seed: number): GameState {
      const base = { ...newGame(seed), cash: dollars(10_000_000) };
      const risky = { ...base.staff[0], id: "risky", name: "Risky", salary: dollars(1), mood: 0, moodLowWeeks: 50 };
      return { ...base, staff: [...base.staff, risky] };
    }
    const present = (s: GameState) => s.staff.some((m) => m.id === "risky");

    // Offline can NEVER drop the at-risk member — for any seed.
    for (let seed = 0; seed < 20; seed++) {
      let off = atRisk(seed);
      for (let i = 0; i < 30; i++) off = advanceOneWeek(off, 1, true);
      expect(present(off)).toBe(true);
    }
    // ...and the setup is genuinely at-risk: at least one seed loses the member while PLAYING,
    // proving the offline result above isn't vacuous.
    let quitWhilePlaying = false;
    for (let seed = 0; seed < 20 && !quitWhilePlaying; seed++) {
      let on = atRisk(seed);
      for (let i = 0; i < 30; i++) on = advanceOneWeek(on, 1, false);
      if (!present(on)) quitWhilePlaying = true;
    }
    expect(quitWhilePlaying).toBe(true);
  });
});

describe("camera lens unlocks (RP-gated design feature)", () => {
  it("unlocks 3 then 4 lenses for RP, then has nothing left to sell", () => {
    let s = { ...newGame(11), researchPoints: 100 };
    expect(s.lensLimit).toBe(2);
    expect(lensUnlockCost(s)).toBe(BALANCE.design.lensUnlockCosts[3]);

    s = unlockLens(s);
    expect(s.lensLimit).toBe(3);
    expect(s.researchPoints).toBe(100 - BALANCE.design.lensUnlockCosts[3]);
    expect(s.feed.some((f) => f.text.includes("triple-lens"))).toBe(true);

    s = unlockLens(s);
    expect(s.lensLimit).toBe(4);
    expect(lensUnlockCost(s)).toBeNull();

    const maxed = unlockLens(s);
    expect(maxed).toBe(s); // no-op at the cap
  });

  it("refuses when RP is short (state untouched)", () => {
    const s = { ...newGame(12), researchPoints: BALANCE.design.lensUnlockCosts[3] - 1 };
    expect(unlockLens(s)).toBe(s);
  });
});

describe("research-gated upgrades", () => {
  it("locks the advanced tier until the prerequisite project is researched", () => {
    let s: GameState = { ...newGame(5), cash: dollars(5_000_000), upgrades: { marketing: 3 } };
    // Brand Agency (tier 4) is gated behind the Brand Studio research project.
    expect(upgradeGate(s, "marketing")).toBe("brandStudio");
    s = buyUpgrade(s, "marketing");
    expect(s.upgrades.marketing).toBe(3); // refused while locked

    s = { ...s, completedProjects: ["brandStudio"] };
    expect(upgradeGate(s, "marketing")).toBeNull();
    s = buyUpgrade(s, "marketing");
    expect(s.upgrades.marketing).toBe(4); // unlocked
  });

  it("never gates the early tiers", () => {
    const s: GameState = { ...newGame(6), cash: dollars(5_000_000), upgrades: { marketing: 0 } };
    expect(upgradeGate(s, "marketing")).toBeNull();
    expect(buyUpgrade(s, "marketing").upgrades.marketing).toBe(1);
  });
});

describe("Rest — paid morale recovery", () => {
  // A salaried hire (not the unpaid founder s0, whose week-of-salary cost would be $0).
  const salaried = (over: Partial<import("../engine/types.ts").Staff>) => {
    const base = newGame(8);
    return { ...base.staff[0], id: "h1", salary: dollars(2_000), ...over } as typeof base.staff[0];
  };

  it("boosts mood, clears the burnout counter, and costs a week's salary", () => {
    const base = newGame(8);
    const tired = salaried({ mood: 25, moodLowWeeks: 4 });
    const s0: GameState = { ...base, cash: dollars(100_000), staff: [tired] };
    const s1 = restStaff(s0, tired.id);
    expect(s1.staff[0].mood).toBe(25 + BALANCE.churn.restMoodBoost);
    expect(s1.staff[0].moodLowWeeks).toBe(0);
    expect(s0.cash - s1.cash).toBe(restCost(tired)); // exactly one week's salary
  });

  it("caps mood at 100 and refuses when broke", () => {
    const base = newGame(9);
    const m = salaried({ mood: 90 });
    const broke: GameState = { ...base, cash: dollars(0), staff: [m] };
    expect(restStaff(broke, m.id)).toBe(broke); // can't afford → no-op

    const rich: GameState = { ...base, cash: dollars(100_000), staff: [m] };
    expect(restStaff(rich, m.id).staff[0].mood).toBe(100); // 90 + 30 capped
  });

  it("is never free — the unpaid founder still pays the floor (no infinite morale)", () => {
    const base = newGame(10);
    const founder = base.staff.find((s) => s.id === "s0")!;
    expect(founder.salary).toBe(0);
    expect(restCost(founder)).toBe(dollars(BALANCE.churn.restMinCost)); // floor, not $0

    const tiredFounder = { ...founder, mood: 30 };
    const broke: GameState = { ...base, cash: dollars(0), staff: [tiredFounder] };
    expect(restStaff(broke, "s0")).toBe(broke); // can't rest for free anymore

    const rich: GameState = { ...base, cash: dollars(100_000), staff: [tiredFounder] };
    const after = restStaff(rich, "s0");
    expect(rich.cash - after.cash).toBe(dollars(BALANCE.churn.restMinCost));
  });
});

describe("premium finish unlocks (RP-gated, with a Design bonus)", () => {
  it("unlocks titanium then gold for RP and adds a Design-appeal bonus", () => {
    let s = { ...newGame(21), researchPoints: 100 };
    expect(s.finishLimit).toBe(BALANCE.design.freeFinishes - 1); // plastic+aluminium free
    expect(finishUnlockCost(s)).toBe(BALANCE.design.finishUnlockCosts.titanium);

    s = unlockFinish(s);
    expect(s.finishLimit).toBe(2); // titanium
    expect(s.feed.some((f) => f.text.toLowerCase().includes("titanium"))).toBe(true);

    s = unlockFinish(s);
    expect(s.finishLimit).toBe(3); // gold
    expect(finishUnlockCost(s)).toBeNull();
    expect(unlockFinish(s)).toBe(s); // nothing left to unlock

    // The Design bonus flows through productStats (state layer, not the protected engine).
    const gold = { ...goodPhone(), finish: "gold" as const };
    const plastic = { ...goodPhone(), finish: "plastic" as const };
    expect(productStats(s, gold).design).toBeGreaterThan(productStats(s, plastic).design);
  });

  it("refuses when RP is short", () => {
    const s = { ...newGame(22), researchPoints: BALANCE.design.finishUnlockCosts.titanium - 1 };
    expect(unlockFinish(s)).toBe(s);
  });
});

describe("marketing push (mid-life, margin-preserving)", () => {
  // A launched product with surplus inventory: built 1000, curve only forecasts ~600, so there's
  // room for a push to lift remaining demand toward the production cap.
  const surplusLaunch = (over: Partial<import("../engine/types.ts").LaunchedProduct> = {}) => {
    const p = { ...goodPhone(), price: dollars(600) };
    return {
      product: p,
      stats: { performance: 60, quality: 60, battery: 60, design: 60, ecosystem: 40 },
      unitCost: dollars(200),
      launchScore: 100,
      launchedWeek: 1,
      totalUnits: 510, // = sum(weeklyUnits)
      weeklyUnits: [100, 100, 100, 80, 60, 40, 20, 10, 0, 0],
      unitsSold: 300,
      weeksElapsed: 3,
      revenueToDate: dollars(180_000),
      plannedUnits: 1000,
      ...over,
    } as import("../engine/types.ts").LaunchedProduct;
  };

  it("quotes extra units + a cash cost, then lifts remaining demand at full price", () => {
    const lp = surplusLaunch();
    const quote = marketingPushQuote(lp)!;
    expect(quote.addedUnits).toBeGreaterThan(0);
    expect(quote.cost).toBeGreaterThan(0);

    const s: GameState = { ...newGame(31), cash: dollars(1_000_000), launched: [lp] };
    const after = marketingPush(s, lp.product.id);
    expect(after.ok).toBe(true);
    const out = after.state.launched[0];
    expect(out.product.price).toBe(lp.product.price); // price unchanged — margin preserved
    expect(out.totalUnits).toBeGreaterThan(lp.totalUnits); // more units in the pipeline
    expect(out.marketingPushes).toBe(1);
    expect(s.cash - after.state.cash).toBe(quote.cost); // charged the quoted amount
  });

  it("allows repeat pushes but with diminishing returns", () => {
    const lp = surplusLaunch();
    const q1 = marketingPushQuote(lp)!;
    const s: GameState = { ...newGame(34), cash: dollars(2_000_000), launched: [lp] };
    const after1 = marketingPush(s, lp.product.id);
    expect(after1.ok).toBe(true);
    const lp1 = after1.state.launched[0];
    expect(lp1.marketingPushes).toBe(1);
    // A second push is still allowed (under the cap) but adds fewer units than the first.
    const q2 = marketingPushQuote(lp1);
    if (q2) expect(q2.addedUnits).toBeLessThan(q1.addedUnits);
  });

  it("refuses a maxed-out, broke, or sold-out (no surplus) push", () => {
    const lp = surplusLaunch();
    const broke: GameState = { ...newGame(32), cash: dollars(0), launched: [lp] };
    expect(marketingPush(broke, lp.product.id).ok).toBe(false); // can't afford

    const already = surplusLaunch({ marketingPushes: BALANCE.marketingPush.maxPerProduct });
    const rich: GameState = { ...newGame(33), cash: dollars(1_000_000), launched: [already] };
    expect(marketingPush(rich, already.product.id).ok).toBe(false); // capped per product

    // No surplus: the curve already sums to the production run, so nothing to clear.
    const soldOut = surplusLaunch({ plannedUnits: 510 });
    expect(marketingPushQuote(soldOut)).toBeNull();
  });

  it("never books revenue for units beyond the production run when the demand curve overshoots it", () => {
    // The exact post-boost state a price cut / marketing push can create: they inflate the REMAINING
    // weeklyUnits but cap only totalUnits, so the curve's remaining weeks can sum ABOVE the run. The
    // tick must sell — and bank revenue for — at most `totalUnits`, never the inflated curve.
    const lp = surplusLaunch({
      weeklyUnits: [100, 100, 100, 200, 200, 200, 0, 0, 0, 0], // sold 0..2; weeks 3..5 want 600 more
      unitsSold: 300,
      weeksElapsed: 3,
      totalUnits: 450, // the run only allows 150 more units than already sold
      plannedUnits: 450,
      revenueToDate: dollars(180_000), // 300 × $600
    });
    // Sanity: the remaining curve genuinely overshoots the production run.
    const remaining = lp.weeklyUnits.slice(lp.weeksElapsed).reduce((a, b) => a + b, 0);
    expect(lp.unitsSold + remaining).toBeGreaterThan(lp.totalUnits);

    const base = newGame(37);
    let cur: GameState = {
      ...base,
      cash: dollars(1_000_000),
      launched: [lp],
      nextEventWeek: 9_999,
      competitors: base.competitors.map((c) => ({ ...c, nextLaunchWeek: 9_999 })), // no rival-entry haircut
    };
    for (let i = 0; i < 10 && cur.launched[0].weeksElapsed < cur.launched[0].weeklyUnits.length; i++) {
      cur = advanceOneWeek(cur);
    }
    const done = cur.launched[0];
    // Units sold can never exceed the run that was actually built...
    expect(done.unitsSold).toBe(450);
    // ...and revenue only ever reflects real, built units (150 more × $600 = $90k), NOT the 600-unit
    // curve (which pre-fix booked 600 × $600 = $360k of phantom revenue into cash/cumulativeRevenue).
    const revSince = toDollars(done.revenueToDate) - toDollars(lp.revenueToDate);
    expect(revSince).toBeCloseTo(600 * (done.unitsSold - lp.unitsSold), 2);
    expect(revSince).toBeCloseTo(90_000, 2);
  });
});

describe("restock (mid-life reorder, demand-capped)", () => {
  // A sold-out product: supply (plannedUnits) == forecast (totalUnits), so there may be unmet demand.
  const soldOut = (over: Partial<import("../engine/types.ts").LaunchedProduct> = {}) => ({
    // A strong, sensibly-priced phone that sold out a small run — the market wants far more than 120.
    product: { ...goodPhone(), tiers: { chip: 5, display: 5, battery: 4, materials: 4, software: 4, camera: 4 }, price: dollars(500) },
    stats: { performance: 60, quality: 60, battery: 60, design: 60, ecosystem: 40 },
    unitCost: dollars(200),
    launchScore: 100,
    launchedWeek: 1,
    totalUnits: 120,
    weeklyUnits: [40, 40, 30, 10, 0, 0, 0, 0],
    unitsSold: 80,
    weeksElapsed: 2,
    revenueToDate: dollars(48_000),
    plannedUnits: 120,
    ...over,
  } as import("../engine/types.ts").LaunchedProduct);

  it("quotes unmet demand and funds more units (no new tooling)", () => {
    const lp = soldOut();
    const s: GameState = { ...newGame(41), era: 3, cash: dollars(5_000_000), fans: 30_000, launched: [lp] };
    const quote = restockQuote(s, lp);
    expect(quote).not.toBeNull();
    expect(quote!.maxUnits).toBeGreaterThanOrEqual(BALANCE.build.minRun);
    const res = restockProduct(s, lp.product.id, quote!.maxUnits);
    expect(res.ok).toBe(true);
    const after = res.state.launched[0];
    expect(after.totalUnits).toBeGreaterThan(lp.totalUnits);
    expect(after.plannedUnits!).toBeGreaterThan(lp.plannedUnits!);
    expect(after.restocks).toBe(1);
    expect(s.cash - res.state.cash).toBeGreaterThan(0); // paid production
  });

  it("never restocks beyond the market's appetite", () => {
    const lp = soldOut();
    const s: GameState = { ...newGame(42), era: 3, cash: dollars(50_000_000), fans: 30_000, launched: [lp] };
    const quote = restockQuote(s, lp)!;
    const res = restockProduct(s, lp.product.id, quote.maxUnits * 1000); // ask for absurdly more
    expect(res.ok).toBe(true);
    const added = res.state.launched[0].totalUnits - lp.totalUnits;
    expect(added).toBeLessThanOrEqual(quote.maxUnits);
  });

  it("refuses when the market is satisfied or the reorder cap is hit", () => {
    const satisfied = soldOut({ totalUnits: 50_000_000, plannedUnits: 50_000_000 });
    const s: GameState = { ...newGame(43), era: 3, cash: dollars(50_000_000), fans: 30_000, launched: [satisfied] };
    expect(restockQuote(s, satisfied)).toBeNull();
    const maxed = soldOut({ restocks: BALANCE.restock.maxPerProduct });
    const s2: GameState = { ...newGame(44), era: 3, cash: dollars(50_000_000), fans: 30_000, launched: [maxed] };
    expect(restockQuote(s2, maxed)).toBeNull();
  });
});

describe("contract board (state)", () => {
  it("no board before shipping; fills after the first ship; claiming pays + frees a slot", () => {
    // Fresh game, no products → no contracts even after ticking (the pinned sim relies on this).
    const empty = advanceOneWeek({ ...newGame(3), cash: dollars(2_000_000) });
    expect((empty.contracts ?? []).length).toBe(0);

    // Ship a product, then tick → the board fills to the configured size.
    let s: GameState = { ...newGame(3), cash: dollars(2_000_000) };
    s = startBuild(s, goodPhone(), 300, "none").state;
    for (let i = 0; i < buildWeeksFor(s) + 1; i++) s = advanceOneWeek(s);
    s = launchReady(s, s.ready[0].id).state;
    s = advanceOneWeek(s);
    expect(s.contracts!.length).toBe(CONTRACT_BOARD_SIZE);

    // A fresh contract isn't claimable yet.
    expect(claimContract(s, s.contracts![0].id).ok).toBe(false);

    // Inject a trivially-complete contract and claim it: reward lands, the slot frees, the counter ticks.
    const done: Contract = { id: "ct-test", metric: "fans", title: "Test", blurb: "", baseline: 0, target: 1,
      reward: { cash: dollars(50_000), rep: 3, fans: 1_000 }, startedWeek: s.week, expiresWeek: s.week + 40 };
    const withDone: GameState = { ...s, contracts: [done, ...s.contracts!.slice(1)] };
    const res = claimContract(withDone, "ct-test");
    expect(res.ok).toBe(true);
    expect(toDollars(res.state.cash)).toBeCloseTo(toDollars(withDone.cash) + 50_000, 0);
    expect(res.state.reputation).toBeGreaterThan(withDone.reputation);
    expect(res.state.fans).toBe(withDone.fans + 1_000);
    expect(res.state.contracts!.find((c) => c.id === "ct-test")).toBeUndefined();
    expect(res.state.contractsCompleted).toBe(1);
  });
});

describe("trainStaff — paid training must actually improve output", () => {
  it("raises the trained discipline's skills score (not just the headline level), so output rises", () => {
    let s: GameState = { ...newGame(123), cash: dollars(1_000_000) };
    const before = rndSkill(s); // founder is an engineer assigned to R&D
    const founderBefore = s.staff.find((m) => m.id === "s0")!;
    // Train several levels so the synced discipline clears any starting roll (skills[primary] ≤ 40
    // at skill 3), making the assertion seed-independent.
    for (let i = 0; i < 3; i++) s = trainStaff(s, "s0");
    const founderAfter = s.staff.find((m) => m.id === "s0")!;
    expect(founderAfter.skill).toBe(founderBefore.skill + 3);
    // The regression guard: skills[primary] must track the headline skill, or disciplineOutput
    // (and thus rndSkill / designerSkill / marketerSkill) ignores the training entirely.
    expect(founderAfter.skills.engineering).toBeGreaterThanOrEqual(founderAfter.skill * 10);
    expect(rndSkill(s)).toBeGreaterThan(before);
  });

  it("is a no-op at max skill or when broke (no cash spent)", () => {
    const broke: GameState = { ...newGame(7), cash: dollars(0) };
    expect(trainStaff(broke, "s0")).toBe(broke); // can't afford → unchanged reference

    const maxed: GameState = {
      ...broke,
      cash: dollars(1_000_000),
      staff: broke.staff.map((m) => (m.id === "s0" ? { ...m, skill: BALANCE.staff.maxSkill } : m)),
    };
    expect(trainStaff(maxed, "s0")).toBe(maxed); // already maxed → unchanged reference, no cash spent
  });
});

describe("determinism — rngState of exactly 0 must not re-seed from state.seed", () => {
  it("two states differing only in seed but both at rngState 0 advance identically", () => {
    // mulberry32's internal state can legitimately be 0; the old `rngState || seed` treated that
    // as falsy and silently re-seeded from `seed`, breaking the deterministic stream. With `??`,
    // both states draw from rng(0) regardless of seed, so a tick leaves them at the same rngState.
    const a: GameState = { ...newGame(111), rngState: 0, seed: 111 };
    const b: GameState = { ...newGame(111), rngState: 0, seed: 999 };
    const a1 = advanceOneWeek(a);
    const b1 = advanceOneWeek(b);
    expect(a1.rngState).toBe(b1.rngState);
  });
});

describe("reputation maintenance — defend your empire in the final era", () => {
  const rich = (over: Partial<GameState>): GameState => ({ ...newGame(5), cash: dollars(20_000_000), nextEventWeek: 999_999, ...over });

  it("erodes a top reputation toward the floor when coasting in the final era", () => {
    let s = rich({ era: 4, reputation: 100 });
    for (let i = 0; i < 10; i++) s = advanceOneWeek(s);
    expect(s.reputation).toBeLessThan(100);
    expect(s.reputation).toBeGreaterThanOrEqual(BALANCE.reputation.decayFloor);
  });

  it("a coasting top brand slips below the rep-85 IPO-win gate (Phase 2 teeth)", () => {
    let s = rich({ era: 4, reputation: 100 });
    for (let i = 0; i < 20; i++) s = advanceOneWeek(s); // ~20wk of not shipping
    expect(s.reputation).toBeLessThan(85); // win-eligibility actually lost until they perform again
  });

  it("does NOT decay before the final era — no progression-gate interference", () => {
    let s = rich({ era: 2, reputation: 100 });
    for (let i = 0; i < 10; i++) s = advanceOneWeek(s);
    expect(s.reputation).toBe(100);
  });

  it("never falls below the maintenance floor", () => {
    let s = rich({ era: 4, reputation: BALANCE.reputation.decayFloor });
    for (let i = 0; i < 30; i++) s = advanceOneWeek(s);
    expect(s.reputation).toBe(BALANCE.reputation.decayFloor);
  });
});

describe("first-build smoothing — the debut product builds fast", () => {
  it("the very first product of a brand-new company builds in minWeeks", () => {
    const fresh = { ...newGame(11), cash: dollars(500_000) }; // legacy 0, nothing in flight
    expect(buildWeeksFor(fresh)).toBe(BALANCE.build.minWeeks);
    const s = startBuild(fresh, goodPhone(), 400, "none").state;
    expect(s.building[0].totalWeeks).toBe(BALANCE.build.minWeeks);
  });

  it("does NOT apply to a prestige veteran (legacy > 0 keeps normal build time)", () => {
    const veteran = { ...newGame(11), cash: dollars(500_000), legacy: 1 };
    expect(buildWeeksFor(veteran)).toBeGreaterThan(BALANCE.build.minWeeks);
  });
});

describe("skipInterrupt — skip-to-next-decision stop conditions", () => {
  it("null when nothing decision-worthy changed", () => {
    const s = newGame(21);
    expect(skipInterrupt(s, s)).toBeNull();
  });

  it("stops when a build lands on the ready shelf", () => {
    const s = newGame(21);
    const next = { ...s, ready: [goodPhone()] };
    expect(skipInterrupt(s, next)).toMatch(/ready to launch/i);
  });

  it("stops when a choice event appears", () => {
    const s = newGame(21);
    const next = { ...s, pendingChoice: { event: { id: "x", title: "t", body: "b", minEra: 1, tone: "neutral", options: [] } as unknown as import("../engine/events.ts").ChoiceEvent, week: s.week } };
    expect(skipInterrupt(s, next)).toMatch(/event/i);
  });
});

describe("rushBuild — the Factory Mode BOOST (pay a premium, finish a week sooner)", () => {
  function withBuild() {
    const s = { ...newGame(31), cash: dollars(1_000_000) };
    return startBuild(s, goodPhone(), 400, "none").state;
  }

  it("completes one week of work for a cash premium", () => {
    const s = withBuild();
    const before = s.building[0].weeksElapsed;
    const res = rushBuild(s, s.building[0].product.id);
    expect(res.ok).toBe(true);
    expect(res.state.building[0].weeksElapsed).toBe(before + 1);
    expect(res.state.cash).toBeLessThan(s.cash);
  });

  it("refuses once the run is already finishing (no free skip past the end)", () => {
    let s = withBuild();
    const id = s.building[0].product.id;
    for (let i = 0; i < 50 && s.building[0].totalWeeks - s.building[0].weeksElapsed > 0; i++) {
      const r = rushBuild(s, id);
      if (!r.ok) break;
      s = r.state;
    }
    expect(rushBuild(s, id).ok).toBe(false);
  });

  it("refuses when cash can't cover the premium", () => {
    const s = { ...withBuild(), cash: dollars(1) };
    expect(rushBuild(s, s.building[0].product.id).ok).toBe(false);
  });
});
