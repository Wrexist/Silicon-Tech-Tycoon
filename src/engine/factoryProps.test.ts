import { describe, it, expect } from "vitest";
import { PROP_DEFS, canPlaceProp, placeProp, propCellSet, removePropAt, propRefund, type PropKind } from "./factoryProps.ts";
import { demoFloor, FLOOR } from "./factoryFloor.ts";

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

  it("propCellSet covers every footprint cell of every prop", () => {
    const floor = demoFloor();
    let props = placeProp(floor, [], "bench", 8, 4, "p1")!; // 2×1 → (8,4) + (9,4)
    props = placeProp(floor, props, "cone", 10, 5, "p2")!;
    expect(propCellSet(props)).toEqual(new Set(["8,4", "9,4", "10,5"]));
    expect(propCellSet([]).size).toBe(0);
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

  it("catalog is well-formed: def.kind matches its key, ids unique, footprints within the floor", () => {
    const seen = new Set<string>();
    for (const k of Object.keys(PROP_DEFS) as PropKind[]) {
      const d = PROP_DEFS[k];
      expect(d.kind).toBe(k);          // the key is the canonical id
      expect(seen.has(d.kind)).toBe(false);
      seen.add(d.kind);
      // A prop's footprint must be placeable somewhere on the grid.
      expect(d.w).toBeLessThanOrEqual(FLOOR.w);
      expect(d.d).toBeLessThanOrEqual(FLOOR.h);
    }
  });

  it("includes the FACTORY-WORLD decor additions with their expected footprints", () => {
    const added: Record<string, [number, number]> = {
      hazardStripe: [1, 1], extinguisher: [1, 1], bollards: [1, 1], fan: [1, 1], workLight: [1, 1],
      tote: [1, 1], compressor: [1, 1], toolWall: [2, 1], qcStation: [2, 1], gantry: [3, 1],
    };
    for (const [kind, [w, d]] of Object.entries(added)) {
      const def = PROP_DEFS[kind as PropKind];
      expect(def).toBeDefined();
      expect(def.cost).toBeGreaterThan(0);
      expect([def.w, def.d]).toEqual([w, d]);
    }
    // The widest addition (gantry, 3×1) still places within bounds on an empty floor.
    expect(canPlaceProp(demoFloor(), [], "gantry", 12, 8)).toBe(true);
  });
});

describe("decor soft effect — utility equipment (item 5.8)", () => {
  it("an undecorated floor is exactly neutral (sim byte-identical)", async () => {
    const { factoryDecorSpeedMult, utilityDecorKinds } = await import("./factoryProps.ts");
    expect(factoryDecorSpeedMult([])).toBe(1);
    expect(utilityDecorKinds([])).toBe(0);
  });

  it("DISTINCT utility kinds shave build time; pure decor doesn't; bounded to the floor", async () => {
    const { factoryDecorSpeedMult, utilityDecorKinds } = await import("./factoryProps.ts");
    const prop = (kind: PropKind, id: string) => ({ id, kind, c: 0, r: 0 });
    // Pure-decoration props (plant/cone) grant nothing.
    expect(factoryDecorSpeedMult([prop("plant", "a"), prop("cone", "b")])).toBe(1);
    // Two DISTINCT utility kinds beat one; duplicates of one kind don't stack.
    const one = factoryDecorSpeedMult([prop("bench", "a")]);
    const two = factoryDecorSpeedMult([prop("bench", "a"), prop("rack", "b")]);
    const dup = factoryDecorSpeedMult([prop("bench", "a"), prop("bench", "b")]);
    expect(one).toBeLessThan(1);
    expect(two).toBeLessThan(one);
    expect(dup).toBe(one); // same KIND twice = one kind's worth
    expect(utilityDecorKinds([prop("bench", "a"), prop("bench", "b")])).toBe(1);
    // Bounded: every utility kind at once never drops below the 0.96 floor.
    const all = (["bench", "rack", "toolWall", "qcStation", "gantry", "compressor", "workLight"] as PropKind[]).map((k, i) => prop(k, `p${i}`));
    expect(factoryDecorSpeedMult(all)).toBeGreaterThanOrEqual(0.96);
  });
});
