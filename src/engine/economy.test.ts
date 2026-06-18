import { describe, it, expect } from "vitest";
import { weeklyPayroll, weeklyBurn, runwayWeeks, isBankrupt, canAfford } from "./economy.ts";
import { dollars, ZERO } from "./money.ts";
import type { Staff } from "./types.ts";

// economy.ts only reads `.salary` off staff for payroll, so a minimal stub is enough here.
const staffWith = (...salaries: number[]): Staff[] =>
  salaries.map((s) => ({ salary: dollars(s) }) as unknown as Staff);

describe("economy — payroll & burn", () => {
  it("payroll is ZERO with no staff, and sums salaries otherwise", () => {
    expect(weeklyPayroll([])).toBe(ZERO);
    expect(weeklyPayroll(staffWith(1000, 2000, 500))).toBe(dollars(3500));
  });

  it("burn with no staff is just the rent", () => {
    expect(weeklyBurn([], dollars(800))).toBe(dollars(800));
    expect(weeklyBurn(staffWith(1200), dollars(800))).toBe(dollars(2000));
  });
});

describe("economy — runway (the fail-state math)", () => {
  it("is Infinity when not losing money (zero burn, or revenue ≥ burn)", () => {
    expect(runwayWeeks(dollars(10_000), ZERO)).toBe(Infinity); // no burn
    expect(runwayWeeks(dollars(10_000), dollars(1_000), dollars(1_000))).toBe(Infinity); // break-even
    expect(runwayWeeks(dollars(10_000), dollars(1_000), dollars(5_000))).toBe(Infinity); // profitable
  });

  it("is the floored weeks of cash at net burn", () => {
    expect(runwayWeeks(dollars(10_000), dollars(1_000))).toBe(10);
    expect(runwayWeeks(dollars(9_999), dollars(1_000))).toBe(9); // floors, never rounds up
    expect(runwayWeeks(dollars(10_000), dollars(3_000), dollars(1_000))).toBe(5); // net burn = 2k
  });

  it("is 0 (never negative) when broke or already underwater", () => {
    expect(runwayWeeks(ZERO, dollars(1_000))).toBe(0);
    expect(runwayWeeks(dollars(-5_000), dollars(1_000))).toBe(0);
  });

  it("stays finite and non-negative for huge cash / tiny burn (no overflow or NaN)", () => {
    const r = runwayWeeks(dollars(1_000_000_000), dollars(1));
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThan(0);
  });
});

describe("economy — bankruptcy & affordability boundaries", () => {
  it("bankruptcy triggers strictly below zero (zero cash is still solvent)", () => {
    expect(isBankrupt(dollars(-1))).toBe(true);
    expect(isBankrupt(ZERO)).toBe(false);
    expect(isBankrupt(dollars(1))).toBe(false);
  });

  it("canAfford is inclusive at exactly the cost and false above it", () => {
    expect(canAfford(dollars(100), dollars(100))).toBe(true);
    expect(canAfford(dollars(100), dollars(99))).toBe(true);
    expect(canAfford(dollars(100), dollars(101))).toBe(false);
  });
});
