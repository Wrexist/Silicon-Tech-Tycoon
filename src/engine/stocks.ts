// Stock market — pure trading math for rival equities + the player's own listed company.
// Holdings map a rival id → number of shares owned. Share prices live on CompetitorState (cents).
import { BALANCE } from "./balance.ts";
import { cents, type Money } from "./money.ts";
import type { CompetitorState } from "./types.ts";

export type Holdings = Partial<Record<string, number>>;

/** A fixed float for the player's company so a valuation maps to a clean per-share price. */
export const PLAYER_TOTAL_SHARES = 1_000_000;

/** Coerce a share quantity to a finite, non-negative integer. */
function safeQty(qty: number): number {
  if (!Number.isFinite(qty)) return 0;
  return Math.max(0, Math.floor(qty));
}

/** Cash needed to buy `qty` shares at `priceCents` each, including brokerage. */
export function buyCost(priceCents: number, qty: number): Money {
  const q = safeQty(qty);
  return cents(Math.round(priceCents * q * (1 + BALANCE.stocks.tradeFeePct)));
}

/** Cash received from selling `qty` shares at `priceCents` each, after brokerage. */
export function sellProceeds(priceCents: number, qty: number): Money {
  const q = safeQty(qty);
  return cents(Math.round(priceCents * q * (1 - BALANCE.stocks.tradeFeePct)));
}

/** Total market value of the player's rival holdings. */
export function holdingsValue(holdings: Holdings, comps: readonly CompetitorState[]): Money {
  let acc = 0;
  for (const c of comps) acc += Math.max(0, holdings[c.id] ?? 0) * c.sharePrice;
  return cents(acc);
}

/** Weekly dividend income from holdings (profitable rivals pay a small yield). */
export function weeklyDividends(holdings: Holdings, comps: readonly CompetitorState[]): Money {
  let acc = 0;
  for (const c of comps)
    acc += Math.max(0, holdings[c.id] ?? 0) * c.sharePrice * BALANCE.stocks.dividendYieldPerWeek;
  return cents(Math.round(acc));
}

/** Player company's per-share price (cents) given its current valuation. */
export function playerSharePrice(valuationCents: number): number {
  return Math.max(1, Math.round(valuationCents / PLAYER_TOTAL_SHARES));
}
