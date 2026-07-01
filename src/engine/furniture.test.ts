import { describe, expect, it } from "vitest";
import {
  addItem,
  canPlace,
  cellAt,
  defaultLayout,
  deskItems,
  footprint,
  furnitureCost,
  furnitureDef,
  FURNITURE,
  GRID,
  moveItem,
  officeAttrs,
  removeItem,
  rotateItem,
  reseatBackRowDesks,
  MIN_DESK_ROW,
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
    let layout = addItem([], "a", "desk", 0, 1, 0); // desks start at row 1 (back row reserved)
    layout = addItem(layout, "b", "cabinet", 0, 3, 0);
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

  it("desks cannot be placed in the reserved back row (would seat a robot in the wall)", () => {
    expect(canPlace([], "desk", 0, 0, 0)).toBe(false);
    expect(canPlace([], "executiveDesk", 0, MIN_DESK_ROW - 1, 0)).toBe(false);
    expect(canPlace([], "desk", 0, MIN_DESK_ROW, 0)).toBe(true);
    // non-desk furniture may still sit against the back wall
    expect(canPlace([], "plantPot", 0, 0, 0)).toBe(true);
    // addItem enforces it too (the editor path)
    expect(addItem([], "a", "desk", 2, 0, 0)).toHaveLength(0);
  });

  it("reseatBackRowDesks moves back-row desks forward, keeps iids, leaves others put", () => {
    const layout: PlacedItem[] = [
      { iid: "d1", type: "desk", c: 0, r: 0, rot: 0 },
      { iid: "d2", type: "desk", c: 3, r: 0, rot: 0 },
      { iid: "d3", type: "desk", c: 0, r: 3, rot: 0 }, // already legal
      { iid: "p1", type: "plantPot", c: 6, r: 0, rot: 0 }, // non-desk, may stay in back row
    ];
    const healed = reseatBackRowDesks(layout);
    for (const d of healed.filter((it) => it.type === "desk")) {
      expect(d.r).toBeGreaterThanOrEqual(MIN_DESK_ROW);
    }
    // iids are preserved (employees keep their seat)
    expect(new Set(healed.map((h) => h.iid))).toEqual(new Set(["d1", "d2", "d3", "p1"]));
    // the already-legal desk is untouched; the plant stays against the wall
    expect(healed.find((h) => h.iid === "d3")).toMatchObject({ r: 3 });
    expect(healed.find((h) => h.iid === "p1")).toMatchObject({ r: 0 });
    // healed layout is internally valid
    for (const it of healed) {
      expect(canPlace(healed, it.type, it.c, it.r, it.rot, it.iid)).toBe(true);
    }
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

  it("the starter garage is exactly a desk + a plant (one seat for the founder)", () => {
    const l = defaultLayout();
    expect(l.map((i) => i.type).sort()).toEqual(["desk", "plantPot"]);
    expect(deskItems(l)).toHaveLength(1);
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

describe("office shop catalog", () => {
  it("every item has a positive price", () => {
    for (const f of FURNITURE) expect(f.cost).toBeGreaterThan(0);
    expect(furnitureCost("sofa")).toBe(furnitureDef("sofa").cost);
  });

  it("officeAttrs sums every placed item's attributes (cosmetics contribute nothing)", () => {
    const layout: PlacedItem[] = [
      { iid: "a", type: "sofa", c: 0, r: 0, rot: 0 },       // comfort 5
      { iid: "b", type: "serverRack", c: 4, r: 0, rot: 0 }, // focus 6
      { iid: "c", type: "sculpture", c: 6, r: 0, rot: 0 },  // inspiration 6
      { iid: "d", type: "crates", c: 8, r: 0, rot: 0 },     // no attrs
    ];
    expect(officeAttrs(layout)).toEqual({ comfort: 5, focus: 6, inspiration: 6 });
    expect(officeAttrs([])).toEqual({ comfort: 0, focus: 0, inspiration: 0 });
  });
});
