// Weekly financial history: revenue, expenses and the profit they imply, one row per simulated week.
// Recorded unconditionally (it is save data, not UI), so a later flag-on build can chart a run that
// started before the redesign. Pure — the tick supplies the numbers.
import { BALANCE } from "./balance.ts";

export interface FinancialWeek {
  week: number;
  revenue: number;
  expenses: number;
  profit: number;
}

/** Append one week, deriving `profit` from its parts so the two can never disagree, and capping the
 *  list the way cashHistory is capped — an unbounded array in a save is a slow leak. */
export function recordFinancialWeek(
  history: readonly FinancialWeek[],
  week: { week: number; revenue: number; expenses: number },
): FinancialWeek[] {
  const next = [...history, { ...week, profit: week.revenue - week.expenses }];
  return next.length > BALANCE.financials.historyCap ? next.slice(next.length - BALANCE.financials.historyCap) : next;
}

/** Change from N weeks back to the latest week, per series, in whole dollars (the same units the
 *  history stores). Zero when there is not enough history — never a fabricated number. */
export function growthDeltas(
  history: readonly FinancialWeek[],
  weeks: number,
): { revenue: number; expenses: number; profit: number } {
  const last = history[history.length - 1];
  const past = history[history.length - 1 - weeks];
  if (!last || !past) return { revenue: 0, expenses: 0, profit: 0 };
  return {
    revenue: last.revenue - past.revenue,
    expenses: last.expenses - past.expenses,
    profit: last.profit - past.profit,
  };
}
