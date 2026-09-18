import { describe, expect, it } from "vitest";
import {
  growthDeltaDollars,
  growthDeltaPct,
  recordFinancialWeek,
  type FinancialWeek,
} from "./financials.ts";

const wk = (week: number, revenue: number, expenses: number): FinancialWeek =>
  ({ week, revenue, expenses, profit: revenue - expenses });

describe("financial history", () => {
  it("appends a week and reports the profit it derives", () => {
    const h = recordFinancialWeek([], { week: 3, revenue: 120, expenses: 20 });
    expect(h).toHaveLength(1);
    expect(h[0]).toEqual({ week: 3, revenue: 120, expenses: 20, profit: 100 });
  });

  it("caps the history so an old save cannot grow without bound", () => {
    let h: FinancialWeek[] = [];
    for (let w = 0; w < 500; w++) h = recordFinancialWeek(h, { week: w, revenue: w, expenses: 0 });
    expect(h.length).toBeLessThanOrEqual(260);
    expect(h[h.length - 1].week).toBe(499);
  });

  it("returns zero deltas when there is nothing to compare", () => {
    expect(growthDeltaDollars([], 8)).toEqual({ revenue: 0, expenses: 0, profit: 0 });
    expect(growthDeltaDollars([wk(1, 10, 5)], 8)).toEqual({ revenue: 0, expenses: 0, profit: 0 });
  });

  it("compares the latest week against the one N weeks back", () => {
    const h = [wk(1, 100, 40), wk(2, 110, 45), wk(3, 150, 50)];
    const d = growthDeltaDollars(h, 2);
    expect(d.revenue).toBe(50);
    expect(d.expenses).toBe(10);
    expect(d.profit).toBe(40);
  });
});

describe("growth deltas — units are explicit in the name", () => {
  const h = [wk(1, 100, 40), wk(2, 110, 45), wk(3, 150, 50)];

  it("reports absolute dollars", () => {
    expect(growthDeltaDollars(h, 2).revenue).toBe(50);
    expect(growthDeltaDollars(h, 2).expenses).toBe(10);
  });

  it("reports whole percent", () => {
    expect(growthDeltaPct(h, 2).revenue).toBe(50);
    expect(growthDeltaPct(h, 2).expenses).toBe(25);
  });

  it("never divides by zero when the past week was empty", () => {
    const zero = [wk(1, 0, 0), wk(2, 0, 0), wk(3, 200, 30)];
    expect(growthDeltaPct(zero, 2).revenue).toBe(0); // no fabricated percentage from a zero base
    expect(growthDeltaPct(zero, 2).expenses).toBe(0);
  });
});
