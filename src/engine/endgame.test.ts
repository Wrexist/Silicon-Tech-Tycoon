// Legacy Era (item 4.1): moonshot megaprojects + escalating board mandates. Pure engine tests plus
// the reducers (fund a megaproject; a mandate auto-resolves and pays). Everything gated on wentPublic.
import { describe, it, expect } from "vitest";
import {
  MEGAPROJECTS, megaprojectById, availableMegaprojects, canFundMegaproject,
  generateBoardMandate, mandateComplete, mandateProgress, type MandateFacts,
  BOARD_TIERS, boardTier, nextBoardTier, mandateStreakBonus, mandatePayoutMult, effectiveMandateReward,
} from "./endgame.ts";
import { dollars, toDollars } from "./money.ts";

describe("megaprojects — engine", () => {
  it("are ordered by escalating cost, each with a payoff", () => {
    for (let i = 1; i < MEGAPROJECTS.length; i++) {
      expect(MEGAPROJECTS[i].cashCost).toBeGreaterThan(MEGAPROJECTS[i - 1].cashCost);
      expect(MEGAPROJECTS[i].rpCost).toBeGreaterThan(MEGAPROJECTS[i - 1].rpCost);
    }
    for (const mp of MEGAPROJECTS) expect(mp.reward.blurb.length).toBeGreaterThan(0);
  });

  it("availableMegaprojects hides funded ones; affordability needs cash AND rp", () => {
    const first = MEGAPROJECTS[0];
    expect(availableMegaprojects([]).length).toBe(MEGAPROJECTS.length);
    expect(availableMegaprojects([first.id]).some((m) => m.id === first.id)).toBe(false);
    expect(canFundMegaproject(first, first.cashCost, first.rpCost)).toBe(true);
    expect(canFundMegaproject(first, dollars(0), first.rpCost)).toBe(false); // no cash
    expect(canFundMegaproject(first, first.cashCost, 0)).toBe(false);        // no rp
    expect(megaprojectById(first.id)).toBe(first);
  });

  it("the slate never empties — a repeatable Moonshot Program follows the authored slate", async () => {
    const { repeatableMegaproject } = await import("./endgame.ts");
    const allAuthored = MEGAPROJECTS.map((m) => m.id);
    // With every authored moonshot funded, exactly one repeatable is offered (id moonshot-<count>).
    const slate = availableMegaprojects(allAuthored);
    expect(slate).toHaveLength(1);
    expect(slate[0].id).toBe(`moonshot-${MEGAPROJECTS.length}`);
    expect(megaprojectById(slate[0].id)).toEqual(slate[0]); // resolvable by id
    // Funding it offers the NEXT one (always something to chase).
    const next = availableMegaprojects([...allAuthored, slate[0].id]);
    expect(next[0].id).toBe(`moonshot-${MEGAPROJECTS.length + 1}`);
    // Each tier costs more and pays more Legacy Points than the last.
    const t1 = repeatableMegaproject(MEGAPROJECTS.length);
    const t2 = repeatableMegaproject(MEGAPROJECTS.length + 1);
    expect(Number(t2.cashCost)).toBeGreaterThan(Number(t1.cashCost));
    expect(t2.rpCost).toBeGreaterThan(t1.rpCost);
    expect(t2.reward.legacyPoints!).toBeGreaterThan(t1.reward.legacyPoints!);
    // A stray/invalid id doesn't resolve.
    expect(megaprojectById("moonshot-0")).toBeUndefined();
    expect(megaprojectById("nope")).toBeUndefined();
  });

  it("repeatable moonshots have distinct authored names (feature #10 — no 'Program 7')", async () => {
    const { repeatableMegaproject } = await import("./endgame.ts");
    const base = MEGAPROJECTS.length;
    const names = Array.from({ length: 10 }, (_, i) => repeatableMegaproject(base + i).name);
    // The first lap through the pool is all distinct and NOT the old "Moonshot Program N" scheme.
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((n) => !/Moonshot Program/.test(n))).toBe(true);
    // A second lap re-uses the pool with a roman-numeral suffix (deterministic). The pool holds 10
    // names, so index (base + 10) wraps back to the first name on its second cycle.
    const lap2 = repeatableMegaproject(base + names.length).name; // names.length == pool size (10)
    expect(lap2).toBe(`${names[0]} II`);
    // Names are deterministic — the same index always yields the same name.
    expect(repeatableMegaproject(base + 3).name).toBe(repeatableMegaproject(base + 3).name);
  });
});

describe("board mandates — engine", () => {
  const facts = (o: Partial<MandateFacts> = {}): MandateFacts => ({ quarterRevenue: 0, quarterHits: 0, fans: 0, rank: 5, ...o });

  it("generation is deterministic and the bar escalates each quarter", () => {
    expect(generateBoardMandate(7, 3, 100, 1000)).toEqual(generateBoardMandate(7, 3, 100, 1000));
    // Later quarters raise the reward (escalation) for a revenue mandate — find one of each kind.
    let low = -1, high = -1;
    for (let q = 0; q < 40; q++) {
      const m = generateBoardMandate(7, q, 100, 1000);
      if (m.metric === "revenue") { if (low < 0) low = q; else high = q; }
    }
    if (low >= 0 && high > low) {
      expect(generateBoardMandate(7, high, 100, 1000).reward.cash).toBeGreaterThan(generateBoardMandate(7, low, 100, 1000).reward.cash);
    }
  });

  it("a revenue mandate scales off the company's trailing quarter (no more rubber-stamp)", () => {
    // Find a (seed, quarter) that yields a revenue mandate at a plateaued late quarter.
    const findRev = (): { seed: number; q: number } | null => {
      for (let s = 0; s < 400; s++) {
        const m = generateBoardMandate(s, 20, 0, 1000);
        if (m.metric === "revenue") return { seed: s, q: 20 };
      }
      return null;
    };
    const hit = findRev();
    expect(hit).not.toBeNull();
    const { seed, q } = hit!;
    const floorOnly = generateBoardMandate(seed, q, 100, 1000, 0);       // no history → the floor
    const bigTrailing = 5_000_000_000;                                   // a giant $5B quarter
    const scaled = generateBoardMandate(seed, q, 100, 1000, bigTrailing);
    // The giant company's bar is a genuine stretch above its last quarter, far past the capped floor.
    expect(scaled.target).toBeGreaterThan(floorOnly.target);
    expect(scaled.target).toBeGreaterThanOrEqual(bigTrailing); // >= last quarter (a real climb)
    // And the reward scales with the (bigger) target — chasing it is worth it, not the capped pittance.
    expect(scaled.reward.cash).toBeGreaterThan(floorOnly.reward.cash);
    // A trailing quarter BELOW the floor leaves the floor untouched (early companies keep the ramp).
    const smallTrailing = generateBoardMandate(seed, q, 100, 1000, 1_000_000);
    expect(smallTrailing.target).toBe(floorOnly.target);
  });

  it("the bar plateaus past the escalation cap (stays reachable, never runs away)", async () => {
    const { BALANCE } = await import("./balance.ts");
    const cap = BALANCE.legacyEra.mandate.escalationCapQuarters;
    // A revenue mandate at the cap and far past it must have the SAME target/reward (plateau).
    const revAt = (q: number) => { for (let s = 0; s < 200; s++) { const m = generateBoardMandate(s, q, 0, 1000); if (m.metric === "revenue") return m; } return null; };
    // Compare the capped quarter to one well beyond it, at a seed that yields a revenue mandate at both.
    for (let s = 0; s < 400; s++) {
      const a = generateBoardMandate(s, cap, 0, 1000);
      const b = generateBoardMandate(s, cap + 20, 0, 1000);
      if (a.metric === "revenue" && b.metric === "revenue") {
        expect(b.target).toBe(a.target);       // plateaued, not runaway
        expect(b.reward.cash).toBe(a.reward.cash);
        break;
      }
    }
    expect(revAt(cap)).not.toBeNull();
    // The hits bar is capped too.
    for (let s = 0; s < 400; s++) {
      const m = generateBoardMandate(s, cap + 50, 0, 1000);
      if (m.metric === "hits") { expect(m.target).toBeLessThanOrEqual(BALANCE.legacyEra.mandate.maxHits); break; }
    }
  });

  it("completion + progress read the right facts per metric", () => {
    // Find a revenue mandate to test the numeric path.
    let rev = null;
    for (let q = 0; q < 40 && !rev; q++) { const m = generateBoardMandate(1, q, 0, 500); if (m.metric === "revenue") rev = m; }
    expect(rev).not.toBeNull();
    expect(mandateComplete(rev!, facts({ quarterRevenue: rev!.target }))).toBe(true);
    expect(mandateComplete(rev!, facts({ quarterRevenue: rev!.target - 1 }))).toBe(false);
    expect(mandateProgress(rev!, facts({ quarterRevenue: rev!.target / 2 }))).toBeCloseTo(0.5, 1);
  });
});

describe("Legacy Era — reducers", () => {
  it("fundMegaproject charges cash + RP and banks the reward, gated on wentPublic", async () => {
    const { newGame, fundMegaproject } = await import("../state/gameState.ts");
    const g0 = newGame(4);
    const mp = MEGAPROJECTS[0];

    // Not public yet → refused.
    expect(fundMegaproject({ ...g0, cash: mp.cashCost, researchPoints: mp.rpCost }, mp.id).ok).toBe(false);

    // Public + funded → cash/RP spent, reputation + legacy points banked, project marked done.
    const rich = { ...g0, wentPublic: true, cash: mp.cashCost, researchPoints: mp.rpCost, fans: 1000 };
    const res = fundMegaproject(rich, mp.id);
    expect(res.ok).toBe(true);
    expect(res.state.megaprojectsFunded).toContain(mp.id);
    expect(res.state.legacyPoints).toBe(mp.reward.legacyPoints ?? 0);
    expect(res.state.reputation).toBeGreaterThanOrEqual(g0.reputation);
    expect(Number(res.state.cash)).toBeLessThan(Number(rich.cash));
    // Double-funding is refused.
    expect(fundMegaproject(res.state, mp.id).ok).toBe(false);
  });

  it("a board mandate is issued after IPO and auto-resolves at its due week", async () => {
    const { newGame, advanceOneWeek } = await import("../state/gameState.ts");
    const g0 = { ...newGame(4), wentPublic: true };
    // First public tick issues a mandate.
    const t1 = advanceOneWeek(g0);
    expect(t1.boardMandate).not.toBeNull();
    const due = t1.boardMandate!.dueWeek;
    // Advance to the due week — the mandate resolves and a fresh one is issued (never left empty).
    let cur = t1;
    for (let i = 0; i < 20 && cur.week < due; i++) cur = advanceOneWeek(cur);
    expect(cur.boardMandate).not.toBeNull();
    expect(cur.mandateQuarter).toBeGreaterThanOrEqual(2); // at least the 2nd mandate issued
  });
});

describe("board confidence & directive tiers (feature #5)", () => {
  it("tiers are strictly ascending in both confidence and payout multiplier", () => {
    for (let i = 1; i < BOARD_TIERS.length; i++) {
      expect(BOARD_TIERS[i].minConfidence).toBeGreaterThan(BOARD_TIERS[i - 1].minConfidence);
      expect(BOARD_TIERS[i].rewardMult).toBeGreaterThan(BOARD_TIERS[i - 1].rewardMult);
    }
  });

  it("the neutral start (50) sits in the ×1.0 tier — so an existing save keeps today's payout", async () => {
    const { BALANCE } = await import("./balance.ts");
    expect(boardTier(BALANCE.legacyEra.boardConfidence.start).rewardMult).toBe(1);
  });

  it("resolves confidence to the right tier, clamped at both ends", () => {
    expect(boardTier(-50).name).toBe("Doubtful Board");
    expect(boardTier(0).rewardMult).toBe(0.8);
    expect(boardTier(100).rewardMult).toBe(2.0);
    expect(boardTier(9999).name).toBe("Visionary Board");
    expect(nextBoardTier(100)).toBeNull(); // no rung above the top
    expect(nextBoardTier(0)!.minConfidence).toBe(20);
  });

  it("streak bonus compounds and caps", async () => {
    const { BALANCE } = await import("./balance.ts");
    const n = BALANCE.legacyEra.boardConfidence;
    expect(mandateStreakBonus(0)).toBe(0);
    expect(mandateStreakBonus(2)).toBeCloseTo(2 * n.streakBonusPerLevel, 5);
    expect(mandateStreakBonus(9999)).toBe(n.maxStreakBonus); // capped
    // payout mult folds tier × (1 + streak)
    expect(mandatePayoutMult(50, 0)).toBe(1);
    expect(mandatePayoutMult(100, 1)).toBeCloseTo(2 * (1 + n.streakBonusPerLevel), 5);
  });

  it("effective reward scales cash + rep by the payout multiplier", () => {
    const base = { cash: dollars(10_000_000), rep: 4 };
    const eff = effectiveMandateReward(base, 100, 0); // Visionary ×2.0
    expect(toDollars(eff.cash)).toBe(20_000_000);
    expect(eff.rep).toBe(8);
    expect(eff.mult).toBe(2);
  });
});

describe("board confidence — reducer", () => {
  const fansMandate = (week: number, target: number) => ({
    id: "mandate-q0", quarter: 0, metric: "fans" as const, target,
    title: `Grow the fanbase to ${target}`, reward: { cash: dollars(1_000_000), rep: 2 },
    issuedWeek: week, dueWeek: week + 1,
  });

  it("meeting a mandate raises confidence + streak; the reward is paid at the confidence you'd built", async () => {
    const { newGame, advanceOneWeek } = await import("../state/gameState.ts");
    const g0 = { ...newGame(4), wentPublic: true, fans: 50_000 };
    const met = {
      ...g0, boardMandate: fansMandate(g0.week, 100), mandateStartRevenue: g0.cumulativeRevenue,
      mandateQuarter: 1, boardConfidence: 50, mandateStreak: 0,
    };
    const t1 = advanceOneWeek(met);
    expect(t1.boardConfidence).toBe(62); // 50 + gainOnMet(12)
    expect(t1.mandateStreak).toBe(1);
    expect(t1.boardMandate).not.toBeNull(); // a fresh mandate is reissued

    // A higher confidence pays strictly more cash for the SAME met mandate.
    const cashDelta = (confidence: number) => {
      const s = { ...met, boardConfidence: confidence };
      return toDollars(advanceOneWeek(s).cash) - toDollars(s.cash);
    };
    expect(cashDelta(100)).toBeGreaterThan(cashDelta(0)); // Visionary ×2.0 > Doubtful ×0.8
  });

  it("a lapsed mandate drops confidence and resets the streak", async () => {
    const { newGame, advanceOneWeek } = await import("../state/gameState.ts");
    const g0 = { ...newGame(4), wentPublic: true, fans: 1_000 };
    const lapsing = {
      ...g0, boardMandate: fansMandate(g0.week, 1_000_000_000), mandateStartRevenue: g0.cumulativeRevenue,
      mandateQuarter: 1, boardConfidence: 50, mandateStreak: 3,
    };
    const t1 = advanceOneWeek(lapsing);
    expect(t1.boardConfidence).toBe(36); // 50 - lossOnLapse(14)
    expect(t1.mandateStreak).toBe(0);
  });

  it("the field is backfilled — a post-IPO save with no confidence set behaves as the neutral start", async () => {
    const { newGame, advanceOneWeek } = await import("../state/gameState.ts");
    const { BALANCE } = await import("./balance.ts");
    const g0 = { ...newGame(4), wentPublic: true, fans: 50_000 };
    // No boardConfidence / mandateStreak on the incoming state (old save).
    const met = { ...g0, boardMandate: fansMandate(g0.week, 100), mandateStartRevenue: g0.cumulativeRevenue, mandateQuarter: 1 };
    const t1 = advanceOneWeek(met);
    expect(t1.boardConfidence).toBe(BALANCE.legacyEra.boardConfidence.start + BALANCE.legacyEra.boardConfidence.gainOnMet);
  });
});
