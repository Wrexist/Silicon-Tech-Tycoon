// Post-IPO shareholder loop — once the company is listed, the street sets a quarterly revenue
// EXPECTATION and reacts to whether you beat or miss it: a beat pops the share price, a miss sinks it
// (the reaction moves the valuation-momentum overlay = the displayed price). You can BUY BACK shares
// to steady the price and reconsolidate ownership — a real late-game cash sink. PURE + deterministic.
//
// Sim-safe by construction: everything here is gated on `listed` by the caller, and the pinned solo
// auto-player never IPOs → none of this runs → byte-identical.
import { BALANCE } from "./balance.ts";
import { type Money, scale, toDollars } from "./money.ts";

export interface EarningsReport {
  /** 1-based quarter since listing. */
  quarter: number;
  week: number;
  /** Revenue booked this quarter. */
  revenue: Money;
  /** What the street expected this quarter. */
  expectation: Money;
  /** (revenue − expectation) / expectation — the surprise (>0 beat, <0 miss). */
  surprisePct: number;
  beat: boolean;
  /** The share-price (valuation-momentum) delta this result triggered, as a fraction (±). */
  priceMovePct: number;
}

/** The street's expectation for the NEXT quarter, from the one just delivered — it wants continued
 *  growth, floored so a tiny quarter still leaves a bar to clear. */
export function nextExpectation(deliveredRevenue: Money): Money {
  const s = BALANCE.ipo.shareholders;
  const grown = scale(deliveredRevenue, 1 + s.expectedGrowth);
  return Math.max(grown, s.minExpectation) as Money;
}

/** Judge a delivered quarter against expectation → beat/miss + the share-price move it triggers
 *  (proportional to the surprise, clamped). Pure. */
export function judgeQuarter(quarter: number, week: number, revenue: Money, expectation: Money): EarningsReport {
  const s = BALANCE.ipo.shareholders;
  const exp = Math.max(1, expectation);
  const surprise = (revenue - exp) / exp;
  const beat = revenue >= expectation;
  const move = Math.max(-s.maxPriceMove, Math.min(s.maxPriceMove, surprise * s.priceSensitivity));
  return { quarter, week, revenue, expectation, surprisePct: surprise, beat, priceMovePct: move };
}

/** Ownership fraction gained by spending `amount` on a buyback at the current valuation. */
export function buybackOwnershipGain(amount: Money, valuation: Money): number {
  if (toDollars(valuation) <= 0) return 0;
  return toDollars(amount) / toDollars(valuation);
}

/** The momentum bump a buyback of `ownershipGain` (a fraction, e.g. 0.02 = 2%) signals to the market. */
export function buybackMomentumBump(ownershipGain: number): number {
  return Math.max(0, ownershipGain) * 100 * BALANCE.ipo.shareholders.buybackBumpPerPct;
}
