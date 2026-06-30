// Debt financing (Track C): credit limits, rate, amortization, and payoff. Amounts in CENTS.
import { describe, expect, it } from "vitest";
import {
  accrueLoans, creditLimit, loanRate, makeLoan, totalDebt, weeklyDebtService, weeklyPaymentFor, type Loan,
} from "./financing.ts";
import { BALANCE } from "./balance.ts";

const f = BALANCE.financing;

describe("financing — credit + rate", () => {
  it("a garage with no revenue can still borrow the credit floor", () => {
    expect(creditLimit(0, [])).toBe(f.creditFloor);
  });

  it("recent revenue raises the credit limit, up to the hard cap", () => {
    const withRev = creditLimit(50_000 * 100, []);
    expect(withRev).toBeGreaterThan(f.creditFloor);
    expect(creditLimit(10_000_000 * 100, [])).toBe(f.maxCredit); // capped
  });

  it("existing debt reduces remaining credit", () => {
    const loan = makeLoan("l1", 50_000 * 100, 50, 0, [], 1);
    expect(creditLimit(0, [loan])).toBe(Math.max(0, f.creditFloor - loan.balance));
  });

  it("higher reputation earns a cheaper rate; leverage makes it pricier", () => {
    const lowRep = loanRate(40, 0, []);
    const highRep = loanRate(90, 0, []);
    expect(highRep).toBeLessThan(lowRep);
    // near the ceiling the leverage premium kicks in
    const maxedLoan = makeLoan("l", f.creditFloor, 50, 0, [], 1);
    expect(loanRate(50, 0, [maxedLoan])).toBeGreaterThan(loanRate(50, 0, []));
  });

  it("the rate never drops below the floor", () => {
    expect(loanRate(100, 0, [])).toBeGreaterThanOrEqual(f.minRatePerWeek);
  });
});

describe("financing — amortization", () => {
  it("a positive-rate loan's payment covers interest and chips at principal", () => {
    const loan = makeLoan("l", 100_000 * 100, 50, 0, [], 1);
    expect(loan.weeklyPayment).toBeGreaterThan((100_000 * 100) / loan.termWeeks); // > straight split (carries interest)
    const { loans, payment } = accrueLoans([loan]);
    expect(payment).toBe(loan.weeklyPayment);
    expect(loans[0].balance).toBeLessThan(loan.balance); // principal went down
  });

  it("a loan fully amortizes to zero within its term and then stops costing", () => {
    let loans: Loan[] = [makeLoan("l", 80_000 * 100, 60, 0, [], 1)];
    let weeks = 0;
    while (loans.length && weeks < f.termWeeks + 4) { loans = accrueLoans(loans).loans; weeks++; }
    expect(loans.length).toBe(0);               // paid off
    expect(weeks).toBeLessThanOrEqual(f.termWeeks + 1);
    expect(weeklyDebtService(loans)).toBe(0);   // no more service
  });

  it("a zero-rate payment is a straight split of principal", () => {
    expect(weeklyPaymentFor(52_000, 0, 52)).toBe(1_000);
  });

  it("totalDebt sums outstanding balances", () => {
    const a = makeLoan("a", 30_000 * 100, 50, 0, [], 1);
    const b = makeLoan("b", 20_000 * 100, 50, 0, [a], 1);
    expect(totalDebt([a, b])).toBe(a.balance + b.balance);
  });
});
