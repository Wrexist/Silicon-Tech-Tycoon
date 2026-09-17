import { describe, expect, it } from "vitest";
import { growthDeltas, recordFinancialWeek, type FinancialWeek } from "./financials.ts";

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
    expect(growthDeltas([], 8)).toEqual({ revenue: 0, expenses: 0, profit: 0 });
    expect(growthDeltas([wk(1, 10, 5)], 8)).toEqual({ revenue: 0, expenses: 0, profit: 0 });
  });

  it("compares the latest week against the one N weeks back", () => {
    const h = [wk(1, 100, 40), wk(2, 110, 45), wk(3, 150, 50)];
    const d = growthDeltas(h, 2);
    expect(d.revenue).toBe(50);
    expect(d.expenses).toBe(10);
    expect(d.profit).toBe(40);
  });
});
