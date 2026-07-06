import { describe, it, expect } from "vitest";
import { PROP_DEFS, canPlaceProp, placeProp, removePropAt, propRefund, type PropKind } from "./factoryProps.ts";
import { demoFloor } from "./factoryFloor.ts";

describe("factory props", () => {
  it("places a prop on an empty cell but not on a machine or belt", () => {
    const floor = demoFloor();
    // (8,4) is an empty interior cell in the starter horseshoe.
    expect(canPlaceProp(floor, [], "crates", 8, 4)).toBe(true);
    // a belt cell (top lane r=2) is blocked.
    expect(canPlaceProp(floor, [], "crates", 5, 2)).toBe(false);
    // an intake cell (0,1) is blocked.
    expect(canPlaceProp(floor, [], "crates", 0, 1)).toBe(false);
  });

  it("blocks overlapping props and honours footprints/bounds", () => {
    const floor = demoFloor();
    const props = placeProp(floor, [], "bench", 8, 4, "p1")!; // 2×1
    expect(props).not.toBeNull();
    expect(canPlaceProp(floor, props, "crates", 8, 4)).toBe(false); // overlaps the bench
    expect(canPlaceProp(floor, props, "crates", 9, 4)).toBe(false); // bench spans 8..9
    expect(canPlaceProp(floor, props, "crates", 10, 4)).toBe(true);
    expect(canPlaceProp(floor, [], "rack", 15, 4)).toBe(false); // 2-wide off the east edge
  });

  it("removes and refunds half", () => {
    const floor = demoFloor();
    const props = placeProp(floor, [], "plant", 8, 4, "p1")!;
    expect(propRefund(props, 8, 4)).toBe(Math.round(PROP_DEFS.plant.cost / 2));
    expect(propRefund(props, 1, 5)).toBe(0);
    expect(removePropAt(props, 8, 4)).toHaveLength(0);
  });

  it("moveProp relocates in place, rejects collisions, ignores its own footprint", async () => {
    const { moveProp } = await import("./factoryProps.ts");
    const floor = demoFloor();
    let props = placeProp(floor, [], "plant", 8, 4, "p1")!;
    props = placeProp(floor, props, "crates", 9, 4, "p2")!;
    const moved = moveProp(floor, props, "p1", 8, 5);
    expect(moved).not.toBeNull();
    expect(moved!.find((p) => p.id === "p1")).toMatchObject({ kind: "plant", c: 8, r: 5 });
    expect(moved!).toHaveLength(2); // moved, not duplicated
    // Onto the other prop → refused; onto a machine → refused; unknown id → refused.
    expect(moveProp(floor, props, "p1", 9, 4)).toBeNull();
    expect(moveProp(floor, props, "p1", 0, 1)).toBeNull();
    expect(moveProp(floor, props, "nope", 8, 5)).toBeNull();
    // "Moving" to its own current cell is a no-op that still succeeds (self-footprint ignored).
    expect(moveProp(floor, props, "p1", 8, 4)).not.toBeNull();
  });

  it("every prop kind has a name, cost and footprint", () => {
    for (const k of Object.keys(PROP_DEFS) as PropKind[]) {
      const d = PROP_DEFS[k];
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.cost).toBeGreaterThan(0);
      expect(d.w).toBeGreaterThanOrEqual(1);
      expect(d.d).toBeGreaterThanOrEqual(1);
    }
  });
});
