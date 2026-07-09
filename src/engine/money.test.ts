import { describe, it, expect } from "vitest";
import {
  dollars,
  cents,
  add,
  sub,
  scale,
  sum,
  format,
  formatShortDollars,
  formatCount,
  toDollars,
  type Money,
} from "./money.ts";

describe("formatCount (shared count formatter for fans/units)", () => {
  it("shows exact integers below 1,000 with separators", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(250)).toBe("250");
    expect(formatCount(999)).toBe("999");
  });
  it("compacts thousands with a lowercase k", () => {
    expect(formatCount(1_000)).toBe("1k");
    expect(formatCount(12_500)).toBe("12.5k");
    expect(formatCount(48_000)).toBe("48k");
  });
  it("ROLLS OVER past a million (the bug it replaces rendered 2M fans as '2000.0k')", () => {
    expect(formatCount(2_000_000)).toBe("2M");
    expect(formatCount(2_300_000)).toBe("2.3M");
    expect(formatCount(1_200_000_000)).toBe("1.2B");
  });
  it("promotes a boundary that rounds up instead of showing '1000.0k'", () => {
    expect(formatCount(999_950)).toBe("1M");
    expect(formatCount(999_400)).toBe("999.4k");
  });
  it("handles negatives", () => {
    expect(formatCount(-4200)).toBe("-4.2k");
  });
});

describe("formatShortDollars (shared compact formatter)", () => {
  it("agrees on rounding across the magnitude bands", () => {
    expect(formatShortDollars(3_200_000)).toBe("$3.2M");
    expect(formatShortDollars(3_000_000)).toBe("$3.0M"); // never "$3M" on one screen, "$3.2M" on another
    expect(formatShortDollars(45_000)).toBe("$45k");
    expect(formatShortDollars(320)).toBe("$320");
    expect(formatShortDollars(0)).toBe("$0");
  });
  it("is finite-safe and signed", () => {
    expect(formatShortDollars(-1_500_000)).toBe("-$1.5M");
    expect(formatShortDollars(NaN)).toBe("$0");
    expect(formatShortDollars(Infinity)).toBe("$0");
  });
});

describe("money construction & arithmetic", () => {
  it("stores dollars as integer cents", () => {
    expect(dollars(1.23)).toBe(123);
    expect(dollars(0.1) + dollars(0.2)).toBe(30); // no float drift: 10 + 20 cents
  });
  it("rounds to the nearest cent", () => {
    expect(dollars(1.236)).toBe(124); // rounds up
    expect(dollars(1.234)).toBe(123); // rounds down
  });
  it("adds and subtracts exactly", () => {
    expect(add(dollars(10), dollars(2.5))).toBe(1250);
    expect(sub(dollars(10), dollars(12))).toBe(-200);
  });
  it("scales by a unit-less factor and rounds", () => {
    expect(scale(dollars(10), 1.5)).toBe(1500);
    expect(scale(cents(101), 0.5)).toBe(51); // 50.5 -> 51
  });
  it("sums a list exactly", () => {
    expect(sum([dollars(1), dollars(2), dollars(3)] as Money[])).toBe(600);
  });
  it("round-trips to dollars", () => {
    expect(toDollars(dollars(42.5))).toBe(42.5);
  });
});

describe("money formatting thresholds", () => {
  it("formats sub-thousand exactly", () => {
    expect(format(dollars(0))).toBe("$0");
    expect(format(dollars(42))).toBe("$42");
    expect(format(dollars(42.5))).toBe("$42.50");
    expect(format(dollars(999))).toBe("$999");
  });
  it("formats thousands with separators below 10K, then compacts", () => {
    expect(format(dollars(1234))).toBe("$1,234");
    expect(format(dollars(12_340))).toBe("$12.34K");
  });
  it("compacts millions, billions, trillions", () => {
    expect(format(dollars(1_230_000))).toBe("$1.23M");
    expect(format(dollars(7_890_000_000))).toBe("$7.89B");
    expect(format(dollars(1_200_000_000_000))).toBe("$1.2T");
  });
  it("handles negatives and explicit positive sign", () => {
    expect(format(dollars(-1_230_000))).toBe("-$1.23M");
    expect(format(dollars(1_230_000), { sign: true })).toBe("+$1.23M");
  });
});
