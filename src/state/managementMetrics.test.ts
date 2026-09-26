import { describe, expect, it } from "vitest";
import { newGame, takeLoan, burn, lateEraDrag } from "./gameState.ts";
import { weeklyFinancials } from "./managementMetrics.ts";
import { weeklyDebtService } from "../engine/financing.ts";
import { dollars } from "../engine/money.ts";

describe("management forecast cost basis", () => {
  it("includes loan repayments instead of overstating the available weekly surplus", () => {
    const state = takeLoan({ ...newGame(41), onboarded: true, week: 30, cash: dollars(40000) }, 5000000);
    expect(state.loans).toHaveLength(1);
    const values = weeklyFinancials(state);
    expect(values.costs).toBe(burn(state) + weeklyDebtService(state.loans ?? []));
    expect(values.profit).toBe(values.revenue - values.costs);
    expect(values.profit).toBeLessThan(values.revenue - burn(state));
  });
  it("includes late-era overhead on the same weekly basis", () => {
    const state = { ...newGame(42), era: 5, cumulativeRevenue: dollars(10000000) };
    expect(lateEraDrag(state)).toBeGreaterThan(0);
    const values = weeklyFinancials(state);
    expect(values.costs).toBe(burn(state) + lateEraDrag(state));
    expect(values.profit + values.costs).toBe(values.revenue);
  });
});
