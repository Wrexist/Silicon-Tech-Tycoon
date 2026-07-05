import { describe, it, expect } from "vitest";
import {
  FLOOR, MACHINE_DEFS, beltPath, canPlaceBelt, canPlaceMachine, formMarks,
  machineCells, placeBelt, placeMachine, removeAt, starterFloor, worldOf,
} from "./factoryFloor.ts";

const empty = { machines: [], belts: [] };

describe("factory floor grid (F2)", () => {
  it("worldOf centres the grid on the origin", () => {
    const [x0, z0] = worldOf(0, 0);
    const [x1, z1] = worldOf(FLOOR.w - 1, FLOOR.h - 1);
    expect(x0).toBe(-x1);
    expect(z0).toBe(-z1);
  });

  it("machines respect bounds and overlap (machines AND belts)", () => {
    expect(canPlaceMachine(empty, "press", 14, 0)).toBe(false); // 3-wide off the east edge
    const f1 = placeMachine(empty, "arm", 3, 3, "a")!;
    expect(f1).not.toBeNull();
    expect(canPlaceMachine(f1, "qa", 4, 4)).toBe(false); // overlaps the arm's 2×2
    const f2 = placeBelt(f1, 8, 8, "e")!;
    expect(canPlaceMachine(f2, "qa", 8, 8)).toBe(false); // machine can't sit on a belt
  });

  it("belts can't sit on machines; re-placing a belt re-aims it", () => {
    const f1 = placeMachine(empty, "arm", 3, 3, "a")!;
    expect(canPlaceBelt(f1, 4, 4)).toBe(false);
    const f2 = placeBelt(f1, 0, 0, "e")!;
    const f3 = placeBelt(f2, 0, 0, "s")!;
    expect(f3.belts).toHaveLength(1);
    expect(f3.belts[0].dir).toBe("s");
  });

  it("removeAt clears a machine by ANY of its cells, or a single belt tile", () => {
    const f1 = placeBelt(placeMachine(empty, "press", 2, 2, "p")!, 9, 9, "n")!;
    const f2 = removeAt(f1, 4, 3); // press covers c2-4, r2-3
    expect(f2.machines).toHaveLength(0);
    expect(f2.belts).toHaveLength(1);
    expect(removeAt(f2, 9, 9).belts).toHaveLength(0);
  });

  it("beltPath chains directed tiles from the unfed start and runs off the end", () => {
    const belts = [
      { c: 2, r: 2, dir: "e" as const },
      { c: 3, r: 2, dir: "e" as const },
      { c: 4, r: 2, dir: "s" as const },
      { c: 4, r: 3, dir: "s" as const },
    ];
    const path = beltPath(belts);
    expect(path).toHaveLength(5); // 4 tiles + the run-off point
    expect(path[0]).toEqual(worldOf(2, 2));
    const [ex, ez] = worldOf(4, 4); // run-off continues south past the last tile
    expect(path[4]).toEqual([ex, ez]);
  });

  it("the starter floor is valid, fully chained, and covers every machine kind", () => {
    const f = starterFloor();
    for (const m of f.machines) {
      const others = { ...f, machines: f.machines.filter((x) => x.id !== m.id) };
      expect(canPlaceMachine(others, m.kind, m.c, m.r)).toBe(true);
    }
    const path = beltPath(f.belts);
    expect(path.length).toBe(f.belts.length + 1); // one unbroken chain
    const kinds = new Set(f.machines.map((m) => m.kind));
    expect(kinds.size).toBe(Object.keys(MACHINE_DEFS).length);
    const [a, b, c] = formMarks(f, path);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(c).toBeLessThan(1);
  });

  it("machineCells matches the def footprint", () => {
    expect(machineCells({ kind: "press", c: 1, r: 1 })).toHaveLength(MACHINE_DEFS.press.w * MACHINE_DEFS.press.d);
  });
});

describe("F3 — line completeness + demolition refund", () => {
  it("the starter line is complete (intake feeds the head, packer catches the tail)", async () => {
    const { lineComplete } = await import("./factoryFloor.ts");
    expect(lineComplete(starterFloor())).toBe(true);
  });

  it("breaking the chain mid-line makes it incomplete; repairing restores it", async () => {
    const { lineComplete } = await import("./factoryFloor.ts");
    const f = starterFloor();
    const broken = removeAt(f, 7, 6); // a middle tile of the bottom lane
    expect(lineComplete(broken)).toBe(false);
    const repaired = placeBelt(broken, 7, 6, "w")!;
    expect(lineComplete(repaired)).toBe(true);
  });

  it("demolition refunds half the occupant's cost, zero for empty cells", async () => {
    const { demolitionRefund, BELT_COST, MACHINE_DEFS } = await import("./factoryFloor.ts");
    const f = starterFloor();
    expect(demolitionRefund(f, 5, 0)).toBe(Math.round(MACHINE_DEFS.press.cost / 2)); // press cell
    expect(demolitionRefund(f, 5, 2)).toBe(Math.round(BELT_COST / 2)); // belt tile
    expect(demolitionRefund(f, 9, 9)).toBe(0); // empty
  });
});
