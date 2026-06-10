import { describe, expect, it } from "vitest";
import {
  addItem,
  canPlace,
  cellAt,
  defaultLayout,
  deskItems,
  footprint,
  furnitureDef,
  GRID,
  moveItem,
  removeItem,
  rotateItem,
  worldOf,
  type PlacedItem,
} from "./furniture.ts";

describe("furniture grid model", () => {
  it("rotating an item swaps its footprint", () => {
    const def = furnitureDef("desk"); // 2x1
    expect(footprint(def, 0)).toEqual({ w: 2, d: 1 });
    expect(footprint(def, 1)).toEqual({ w: 1, d: 2 });
    expect(footprint(def, 2)).toEqual({ w: 2, d: 1 });
  });

  it("rejects placements that leave the grid", () => {
    expect(canPlace([], "meetingTable", GRID.n - 1, 0, 0)).toBe(false); // 3 wide off-edge
    expect(canPlace([], "meetingTable", 0, 0, 0)).toBe(true);
  });

  it("blocks overlap of solid items but lets rugs underlap", () => {
    let layout: PlacedItem[] = [];
    layout = addItem(layout, "a", "sofa", 2, 2, 0);
    expect(layout).toHaveLength(1);
    // overlapping solid → rejected (array unchanged)
    expect(addItem(layout, "b", "armchair", 2, 2, 0)).toHaveLength(1);
    // a rug under the sofa → allowed
    expect(addItem(layout, "rug1", "rug", 1, 1, 0)).toHaveLength(2);
  });

  it("moves and rotates only when valid, and removes", () => {
    let layout = addItem([], "a", "desk", 0, 0, 0);
    layout = addItem(layout, "b", "cabinet", 0, 2, 0);
    layout = moveItem(layout, "a", 3, 3); // free → moves
    expect(layout.find((x) => x.iid === "a")).toMatchObject({ c: 3, r: 3 });
    layout = rotateItem(layout, "a");
    expect(layout.find((x) => x.iid === "a")!.rot).toBe(1);
    layout = removeItem(layout, "b");
    expect(layout.find((x) => x.iid === "b")).toBeUndefined();
  });

  it("cellAt centres a footprint and clamps to the grid", () => {
    const c0 = cellAt(0, 0, 2, 1); // near centre
    expect(c0.c).toBeGreaterThanOrEqual(0);
    expect(c0.c + 2).toBeLessThanOrEqual(GRID.n);
    const w = worldOf({ iid: "x", type: "desk", c: c0.c, r: c0.r, rot: 0 });
    expect(Math.abs(w.x)).toBeLessThan(GRID.n * GRID.cell);
  });

  it("default layout is internally valid (no overlaps, all in bounds)", () => {
    const layout = defaultLayout();
    // rebuild it through addItem; every solid item should be accepted
    let acc: PlacedItem[] = [];
    let solids = 0;
    for (const it of layout) {
      const before = acc.length;
      acc = addItem(acc, it.iid, it.type, it.c, it.r, it.rot);
      if (!furnitureDef(it.type).flat) {
        solids++;
        expect(acc.length).toBe(before + 1); // accepted
      }
    }
    expect(solids).toBeGreaterThan(0);
  });

  it("default layout seats the founder (≥1 desk) and deskItems keeps a stable placement order", () => {
    expect(deskItems(defaultLayout()).length).toBeGreaterThanOrEqual(1);
    // seats stay in placement order regardless of array order, so nobody swaps desks on re-render
    const a: PlacedItem = { iid: "f2", type: "desk", c: 0, r: 0, rot: 0 };
    const b: PlacedItem = { iid: "f10", type: "standingDesk", c: 4, r: 0, rot: 0 };
    expect(deskItems([b, a]).map((d) => d.iid)).toEqual(["f2", "f10"]);
    // non-desk furniture never counts as a seat
    expect(deskItems([{ iid: "f3", type: "sofa", c: 0, r: 4, rot: 0 }])).toHaveLength(0);
  });
});
