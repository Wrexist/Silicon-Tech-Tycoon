import { describe, it, expect } from "vitest";
import { layoutApplyCost, MAX_LAYOUTS } from "./factoryLayout.ts";
import { MACHINE_DEFS, BELT_COST, type FactoryFloor } from "./factoryFloor.ts";
import { PROP_DEFS, type PlacedProp } from "./factoryProps.ts";

const empty: FactoryFloor = { machines: [], belts: [] };
const noProps: PlacedProp[] = [];
const half = (c: number) => Math.round(c / 2);

describe("factory layout apply cost (fair diff)", () => {
  it("charges full catalog price for a machine the target adds", () => {
    const target: FactoryFloor = { machines: [{ id: "a", kind: "arm", c: 3, r: 3 }], belts: [] };
    expect(layoutApplyCost(empty, noProps, target, noProps)).toBe(MACHINE_DEFS.arm.cost);
  });

  it("an identical floor costs nothing to apply", () => {
    const f: FactoryFloor = { machines: [{ id: "a", kind: "arm", c: 3, r: 3 }], belts: [{ c: 0, r: 0, dir: "e" }] };
    // Different ids on the target must NOT matter — identity is cell + kind, not id.
    const same: FactoryFloor = { machines: [{ id: "z", kind: "arm", c: 3, r: 3 }], belts: [{ c: 0, r: 0, dir: "e" }] };
    expect(layoutApplyCost(f, noProps, same, noProps)).toBe(0);
  });

  it("refunds half for a machine the target drops", () => {
    const cur: FactoryFloor = { machines: [{ id: "a", kind: "qa", c: 5, r: 5 }], belts: [] };
    expect(layoutApplyCost(cur, noProps, empty, noProps)).toBe(-half(MACHINE_DEFS.qa.cost));
  });

  it("re-aiming a belt (same cell, new direction) is free; a new belt tile costs full", () => {
    const cur: FactoryFloor = { machines: [], belts: [{ c: 0, r: 0, dir: "e" }] };
    const reaimed: FactoryFloor = { machines: [], belts: [{ c: 0, r: 0, dir: "s" }] };
    expect(layoutApplyCost(cur, noProps, reaimed, noProps)).toBe(0);
    const added: FactoryFloor = { machines: [], belts: [{ c: 0, r: 0, dir: "e" }, { c: 1, r: 0, dir: "e" }] };
    expect(layoutApplyCost(cur, noProps, added, noProps)).toBe(BELT_COST);
  });

  it("prices props like machines (add full, drop half)", () => {
    const crates: PlacedProp[] = [{ id: "p", kind: "crates", c: 5, r: 5 }];
    expect(layoutApplyCost(empty, noProps, empty, crates)).toBe(PROP_DEFS.crates.cost);
    expect(layoutApplyCost(empty, crates, empty, noProps)).toBe(-half(PROP_DEFS.crates.cost));
  });

  it("is exploit-free: a round trip (tear down → rebuild) never nets a profit", () => {
    const a: FactoryFloor = { machines: [{ id: "a", kind: "arm", c: 3, r: 3 }, { id: "b", kind: "press", c: 6, r: 0 }], belts: [{ c: 0, r: 0, dir: "e" }] };
    const teardown = layoutApplyCost(a, noProps, empty, noProps); // apply the empty layout → 50% refund (negative)
    const rebuild = layoutApplyCost(empty, noProps, a, noProps);   // apply A again → full price (positive)
    expect(teardown).toBeLessThan(0);
    expect(rebuild).toBeGreaterThan(0);
    expect(teardown + rebuild).toBeGreaterThan(0); // you always end up out of pocket, never ahead
  });

  it("keeps a sane cap on saved layouts", () => {
    expect(MAX_LAYOUTS).toBeGreaterThanOrEqual(3);
    expect(MAX_LAYOUTS).toBeLessThanOrEqual(12);
  });
});
