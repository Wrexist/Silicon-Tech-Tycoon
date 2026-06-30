// Debt financing applied to game state (Track C): take a loan, service it weekly, pay it off.
import { describe, expect, it } from "vitest";
import { newGame, advanceOneWeek, takeLoan, repayLoan, loanCreditAvailable, type GameState } from "./gameState.ts";
import { dollars, toDollars } from "../engine/money.ts";
import { totalDebt, weeklyDebtService } from "../engine/financing.ts";
import { BALANCE } from "../engine/balance.ts";

function game(): GameState {
  return { ...newGame(5), onboarded: true, week: 30, cash: dollars(40_000) };
}

describe("takeLoan / repayLoan", () => {
  it("borrowing adds cash (less the origination fee) and records the debt", () => {
    const principal = 50_000 * 100; // $50K in cents (within the no-revenue credit floor)
    const s = takeLoan(game(), principal);
    expect(s.loans?.length).toBe(1);
    // proceeds = principal × (1 - fee)
    const expectedProceeds = Math.round(principal * (1 - BALANCE.financing.originationFee)) / 100;
    expect(toDollars(s.cash)).toBe(40_000 + expectedProceeds);
    expect(totalDebt(s.loans!)).toBe(principal);
  });

  it("rejects a loan beyond the credit limit or below the minimum", () => {
    const s = game();
    const overLimit = toDollars(loanCreditAvailable(s)) * 100 + 1_000_000;
    expect(takeLoan(s, overLimit)).toBe(s);                       // too big → no-op
    expect(takeLoan(s, BALANCE.financing.minLoan - 1).loans?.length ?? 0).toBe(0); // too small → no-op
  });

  it("the weekly tick services the debt (cash leaves, balance falls)", () => {
    const s = takeLoan(game(), 50_000 * 100);
    const before = totalDebt(s.loans!);
    const after = advanceOneWeek(s);
    expect(after.loans![0].balance).toBeLessThan(before); // principal paid down
    expect(weeklyDebtService(after.loans!)).toBeGreaterThan(0);
  });

  it("paying off early clears the loan and its weekly service", () => {
    let s = takeLoan({ ...game(), cash: dollars(500_000) }, 50_000 * 100);
    const id = s.loans![0].id;
    s = repayLoan(s, id);
    expect(s.loans?.length).toBe(0);
    expect(weeklyDebtService(s.loans ?? [])).toBe(0);
  });

  it("can't pay off a loan you can't cover", () => {
    const s = takeLoan({ ...game(), cash: dollars(99_000) }, 50_000 * 100); // proceeds bring cash up, then drain
    const drained = { ...s, cash: dollars(10) };
    expect(repayLoan(drained, s.loans![0].id)).toBe(drained); // no-op
  });

  it("a never-borrows game keeps loans empty (harness/golden-invariant safe)", () => {
    const s = advanceOneWeek(game());
    expect(s.loans).toEqual([]);
  });
});
