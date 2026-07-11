// Debt financing (Track C): the player can borrow cash to extend runway or fund a big bet, at the
// cost of weekly debt service. Good reputation earns cheaper credit; leverage makes it pricier. If
// the bet doesn't pay off, the added burn pushes bankruptcy closer — so runway becomes a real bet,
// not a read-only timer. PURE: all amounts are integer CENTS (the state layer converts to Money at
// the cash boundary); rates are plain weekly fractions.
import { BALANCE } from "./balance.ts";

export interface Loan {
  id: string;
  principal: number;     // original amount borrowed (cents)
  balance: number;       // outstanding principal (cents)
  weeklyPayment: number; // fixed weekly payment (cents)
  ratePerWeek: number;   // weekly interest rate locked at drawdown
  termWeeks: number;     // original amortization term
  takenWeek: number;
}

/** Total outstanding debt across all loans (cents). */
export function totalDebt(loans: readonly Loan[]): number {
  return loans.reduce((a, l) => a + Math.max(0, l.balance), 0);
}

/** Total weekly debt service the player owes right now (cents) — the sum of every loan's payment. */
export function weeklyDebtService(loans: readonly Loan[]): number {
  return loans.reduce((a, l) => a + l.weeklyPayment, 0);
}

/** The total credit CEILING (cents) a company can carry — the size of the business, not what's still
 *  available. Scales with the three signals a lender actually underwrites: recent weekly revenue,
 *  the company's NET WORTH (a big, valuable company can carry far more debt), and its weekly
 *  PROFITABILITY (cash flow that services the debt). The hard cap itself grows with net worth, so
 *  financing stays relevant for a $100M company instead of freezing at a tiny flat ceiling.
 *  netWorthCents / weeklyProfitCents default to 0 → the pre-scaling revenue-only behaviour. */
export function creditCeiling(weeklyRevenueCents: number, netWorthCents = 0, weeklyProfitCents = 0): number {
  const f = BALANCE.financing;
  const headroom =
    f.creditFloor +
    Math.max(0, weeklyRevenueCents) * f.creditRevenueWeeks +
    Math.max(0, netWorthCents) * f.creditNetWorthFrac +
    Math.max(0, weeklyProfitCents) * f.creditProfitWeeks;
  // The ceiling grows with net worth so a large, valuable company isn't stuck at the flat floor.
  const ceiling = Math.max(f.maxCredit, Math.max(0, netWorthCents) * f.maxCreditNetWorthFrac);
  return Math.min(headroom, ceiling);
}

/** How much MORE the player can borrow (cents): the credit ceiling minus what they already owe. */
export function creditLimit(weeklyRevenueCents: number, loans: readonly Loan[], netWorthCents = 0, weeklyProfitCents = 0): number {
  const cap = creditCeiling(weeklyRevenueCents, netWorthCents, weeklyProfitCents);
  return Math.max(0, Math.round(cap - totalDebt(loans)));
}

/** The weekly interest rate offered right now: cheaper as reputation rises above the midpoint,
 *  pricier as the player approaches their credit ceiling (leverage premium). Floored so it's never
 *  free money. Net worth + profitability lift the ceiling, so the same loan reads as lower leverage
 *  (cheaper) for a bigger, more profitable company. */
export function loanRate(reputation: number, weeklyRevenueCents: number, loans: readonly Loan[], netWorthCents = 0, weeklyProfitCents = 0): number {
  const f = BALANCE.financing;
  const cap = creditCeiling(weeklyRevenueCents, netWorthCents, weeklyProfitCents);
  const leverage = cap > 0 ? Math.min(1, totalDebt(loans) / cap) : 1;
  let r = f.baseRatePerWeek;
  r -= Math.max(0, reputation - 50) * f.rateRepDiscount;
  r += leverage * f.rateLeveragePremium;
  return Math.max(f.minRatePerWeek, r);
}

/** Standard amortized weekly payment for a principal at a weekly rate over n weeks (cents). At a
 *  zero rate it's a straight split. */
export function weeklyPaymentFor(principalCents: number, ratePerWeek: number, termWeeks: number): number {
  const n = Math.max(1, termWeeks);
  if (ratePerWeek <= 0) return Math.ceil(principalCents / n);
  const factor = (ratePerWeek * Math.pow(1 + ratePerWeek, n)) / (Math.pow(1 + ratePerWeek, n) - 1);
  return Math.ceil(principalCents * factor);
}

/** Build a fresh loan at the rate/term offered now. */
export function makeLoan(id: string, principalCents: number, reputation: number, weeklyRevenueCents: number, loans: readonly Loan[], week: number, netWorthCents = 0, weeklyProfitCents = 0): Loan {
  const f = BALANCE.financing;
  const rate = loanRate(reputation, weeklyRevenueCents, loans, netWorthCents, weeklyProfitCents);
  const weeklyPayment = weeklyPaymentFor(principalCents, rate, f.termWeeks);
  return { id, principal: principalCents, balance: principalCents, weeklyPayment, ratePerWeek: rate, termWeeks: f.termWeeks, takenWeek: week };
}

/** Advance loans one week: accrue interest, take each payment (interest first, then principal), and
 *  drop any loan paid to zero. `rate` weights a partial offline catch-up tick (matches burn). Returns
 *  the updated loans + the total cash payment to deduct (cents). */
export function accrueLoans(loans: readonly Loan[], rate = 1): { loans: Loan[]; payment: number } {
  let payment = 0;
  const next: Loan[] = [];
  for (const l of loans) {
    // Keep every amount in whole cents (the module's contract) so Loan.balance, totalDebt() and
    // creditLimit() never accumulate fractional money or persist non-integer state.
    const interest = Math.round(l.balance * l.ratePerWeek * rate);
    const due = Math.round(l.weeklyPayment * rate);
    const pay = Math.min(due, l.balance + interest); // never overpay the final stub
    const balance = l.balance + interest - pay;
    payment += pay;
    if (balance > 0) next.push({ ...l, balance });
  }
  return { loans: next, payment };
}
