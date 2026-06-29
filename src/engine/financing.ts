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

/** How much MORE the player can borrow (cents): a flat floor so even a garage can raise a little,
 *  plus a multiple of recent weekly revenue, capped, minus what they already owe. */
export function creditLimit(weeklyRevenueCents: number, loans: readonly Loan[]): number {
  const f = BALANCE.financing;
  const headroom = f.creditFloor + Math.max(0, weeklyRevenueCents) * f.creditRevenueWeeks;
  const cap = Math.min(headroom, f.maxCredit);
  return Math.max(0, Math.round(cap - totalDebt(loans)));
}

/** The weekly interest rate offered right now: cheaper as reputation rises above the midpoint,
 *  pricier as the player approaches their credit ceiling (leverage premium). Floored so it's never
 *  free money. */
export function loanRate(reputation: number, weeklyRevenueCents: number, loans: readonly Loan[]): number {
  const f = BALANCE.financing;
  const cap = Math.min(f.creditFloor + Math.max(0, weeklyRevenueCents) * f.creditRevenueWeeks, f.maxCredit);
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
export function makeLoan(id: string, principalCents: number, reputation: number, weeklyRevenueCents: number, loans: readonly Loan[], week: number): Loan {
  const f = BALANCE.financing;
  const rate = loanRate(reputation, weeklyRevenueCents, loans);
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
    const interest = l.balance * l.ratePerWeek * rate;
    const due = l.weeklyPayment * rate;
    const pay = Math.min(due, l.balance + interest); // never overpay the final stub
    const balance = l.balance + interest - pay;
    payment += pay;
    if (balance > 1) next.push({ ...l, balance });
  }
  return { loans: next, payment: Math.round(payment) };
}
