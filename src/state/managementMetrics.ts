import { nextWeekRevenue, weeklyOutflow, type GameState } from "./gameState.ts";
import { sub } from "../engine/money.ts";

/** One period and one cost basis across Office, Market and Company. Upfront capex is separate. */
export function weeklyFinancials(state: GameState) {
  const revenue = nextWeekRevenue(state);
  const costs = weeklyOutflow(state);
  return { revenue, costs, profit: sub(revenue, costs) };
}
