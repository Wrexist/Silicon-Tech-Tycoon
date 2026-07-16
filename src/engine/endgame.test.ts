// Legacy Era (item 4.1): moonshot megaprojects + escalating board mandates. Pure engine tests plus
// the reducers (fund a megaproject; a mandate auto-resolves and pays). Everything gated on wentPublic.
import { describe, it, expect } from "vitest";
import {
  MEGAPROJECTS, megaprojectById, availableMegaprojects, canFundMegaproject,
  generateBoardMandate, mandateComplete, mandateProgress, type MandateFacts,
} from "./endgame.ts";
import { dollars } from "./money.ts";

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
