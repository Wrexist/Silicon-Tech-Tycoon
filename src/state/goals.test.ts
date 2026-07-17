import { describe, it, expect } from "vitest";
import { newGame, type GameState } from "./gameState.ts";
import { collectGoals, claimableGoalCount } from "./goals.ts";
import { dollars } from "../engine/money.ts";
import type { Contract } from "../engine/contracts.ts";
import type { BoardMandate } from "../engine/endgame.ts";

function contract(over: Partial<Contract> = {}): Contract {
  return {
    id: "c1",
    metric: "revenue",
    title: "Earn $5M in revenue",
    blurb: "A sales sprint.",
    baseline: 0,
    target: 100,
    reward: { cash: dollars(10_000), rep: 2, fans: 500 },
    startedWeek: 1,
    expiresWeek: 40,
    ...over,
  };
}

function mandate(over: Partial<BoardMandate> = {}): BoardMandate {
  return {
    id: "mandate-q1",
    quarter: 1,
    metric: "fans",
    target: 5000,
    title: "Grow the fanbase to 5,000",
    reward: { cash: dollars(1_000_000), rep: 5 },
    issuedWeek: 10,
    dueWeek: 30,
    ...over,
  };
}

describe("unified goals ledger", () => {
  it("a fresh game shows exactly the one guided next-move", () => {
    const rows = collectGoals(newGame(1));
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("objective");
    expect(rows[0].sourceLabel).toBe("Next move");
    expect(rows[0].progressText).toMatch(/^Step \d+ of \d+$/);
    expect(rows[0].frac).toBeGreaterThan(0);
  });

  it("folds contracts in after the objective, with progress + reward + deadline", () => {
    const s = { ...newGame(1), week: 5, contracts: [contract({ target: 1_000_000 })] } as GameState;
    const rows = collectGoals(s);
    expect(rows.map((r) => r.source)).toEqual(["objective", "contract"]);
    const c = rows[1];
    expect(c.title).toBe("Earn $5M in revenue");
    expect(c.frac).toBeGreaterThanOrEqual(0);
    expect(c.frac).toBeLessThan(1); // not done — revenue is 0
    expect(c.reward).toBeTruthy();
    expect(c.weeksLeft).toBe(35); // 40 - 5
    expect(c.done).toBe(false);
    expect(c.claimable).toBeFalsy();
  });

  it("marks a met contract claimable and counts it", () => {
    // revenue metric: facts.revenue = toDollars(cumulativeRevenue). target 100 dollars → met at $200.
    const s = { ...newGame(1), cumulativeRevenue: dollars(200), contracts: [contract({ target: 100 })] } as GameState;
    const rows = collectGoals(s);
    const c = rows.find((r) => r.source === "contract")!;
    expect(c.done).toBe(true);
    expect(c.claimable).toBe(true);
    expect(c.contractId).toBe("c1");
    expect(c.frac).toBe(1);
    expect(claimableGoalCount(s)).toBe(1);
  });

  it("includes the standing board mandate last", () => {
    const s = { ...newGame(1), week: 12, wentPublic: true, boardMandate: mandate(), contracts: [contract()] } as GameState;
    const rows = collectGoals(s);
    expect(rows.map((r) => r.source)).toEqual(["objective", "contract", "mandate"]);
    const m = rows[2];
    expect(m.sourceLabel).toBe("Board mandate");
    expect(m.title).toBe("Grow the fanbase to 5,000");
    expect(m.weeksLeft).toBe(18); // 30 - 12
    expect(m.reward).toBeTruthy();
  });

  it("never mutates the state it reads", () => {
    const s = { ...newGame(1), contracts: [contract()], boardMandate: mandate() } as GameState;
    const snapshot = JSON.stringify(s);
    collectGoals(s);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it("folds a running side order in as a row with progress, payout and a deadline", () => {
    const s = {
      ...newGame(1), week: 20,
      activeSideOrder: {
        id: "so1", clientName: "Zenith Labs", blurb: "sensor boards", units: 1000,
        feePerUnit: dollars(50), weeksNeeded: 4, requiredKinds: [], week: 18, startedWeek: 18,
      },
    } as GameState;
    const row = collectGoals(s).find((r) => r.source === "sideOrder")!;
    expect(row).toBeTruthy();
    expect(row.sourceLabel).toBe("Side order");
    expect(row.title).toContain("Zenith Labs");
    expect(row.frac).toBeCloseTo(0.5, 5); // 2 of 4 weeks elapsed
    expect(row.weeksLeft).toBe(2); // 18 + 4 - 20
    expect(row.reward).toContain("on delivery");
    expect(row.done).toBe(false);
  });

  it("shows the annual awards as a standing seasonal row once something has shipped", () => {
    // A launch this awards-year (week 60 → year window opened at week 52).
    const s = {
      ...newGame(1), week: 60,
      launched: [{ launchedWeek: 55 } as GameState["launched"][number]],
    } as GameState;
    const row = collectGoals(s).find((r) => r.source === "award")!;
    expect(row).toBeTruthy();
    expect(row.sourceLabel).toBe("Silicon Awards");
    expect(row.weeksLeft).toBe(44); // next ceremony week 104 - 60
    expect(row.detail).toContain("1 of your launches");
    expect(row.done).toBe(false);
    // A garage with nothing shipped has no awards row.
    expect(collectGoals(newGame(1)).some((r) => r.source === "award")).toBe(false);
  });
});
