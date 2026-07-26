import { describe, expect, it } from "vitest";
import {
  addItem,
  canPlace,
  cellAt,
  defaultLayout,
  deskItems,
  deskZones,
  footprint,
  furnitureCost,
  furnitureDef,
  FURNITURE,
  GRID,
  gridN,
  gridOrigin,
  moveItem,
  officeAttrs,
  officeZoneBonus,
  removeItem,
  rotateItem,
  tidyLayout,
  tidyMoveCount,
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

  it("the starter garage is exactly the founder's desk + a plant (one seat for the founder)", () => {
    const l = defaultLayout();
    expect(l.map((i) => i.type).sort()).toEqual(["dualDesk", "plantPot"]);
    // the one desk-category item is the founder's seat
    expect(deskItems(l)).toHaveLength(1);
    expect(deskItems(l)[0].type).toBe("dualDesk");
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

  it("office zones (item 5.5): a desk beside an amenity earns a bonus; the default office earns none", () => {
    // The default office (lone desk + a plant placed far apart) earns nothing — the sim-safe anchor.
    expect(officeZoneBonus(defaultLayout())).toEqual({ comfort: 0, focus: 0, inspiration: 0 });
    expect(officeZoneBonus([])).toEqual({ comfort: 0, focus: 0, inspiration: 0 });
    // A desk with a plant placed immediately beside it forms a zone → a positive bonus.
    const adjacent: PlacedItem[] = [
      { iid: "d", type: "dualDesk", c: 3, r: 3, rot: 0 },
      { iid: "p", type: "plantPot", c: 4, r: 3, rot: 0 }, // one cell east of the desk anchor
    ];
    const bonus = officeZoneBonus(adjacent);
    expect(bonus.comfort).toBeGreaterThan(0);
    expect(bonus.focus).toBeCloseTo(bonus.comfort * 0.5, 5);
    // Moving the plant far away removes the zone.
    const apart: PlacedItem[] = [
      { iid: "d", type: "dualDesk", c: 3, r: 3, rot: 0 },
      { iid: "p", type: "plantPot", c: 9, r: 9, rot: 0 },
    ];
    expect(officeZoneBonus(apart)).toEqual({ comfort: 0, focus: 0, inspiration: 0 });
  });
});

describe("catalog integrity", () => {
  it("every furniture id is unique", () => {
    const ids = FURNITURE.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every item has a footprint of at least 1×1 cell", () => {
    for (const f of FURNITURE) {
      expect(f.w).toBeGreaterThanOrEqual(1);
      expect(f.d).toBeGreaterThanOrEqual(1);
    }
  });

  it("attrs are non-negative wherever present (cosmetics may omit them)", () => {
    for (const f of FURNITURE) {
      if (!f.attrs) continue;
      expect(f.attrs.comfort ?? 0).toBeGreaterThanOrEqual(0);
      expect(f.attrs.focus ?? 0).toBeGreaterThanOrEqual(0);
      expect(f.attrs.inspiration ?? 0).toBeGreaterThanOrEqual(0);
    }
  });

  it("the 20 catalog-expansion items exist with their expected categories", () => {
    const expected: Record<string, string> = {
      aquarium: "decor", superCluster: "tech", holoGlobe: "tech", quantumRig: "tech",
      espressoRobot: "fun", dronePad: "tech", zenFountain: "decor", trophyCase: "storage",
      napPod: "seating", microKitchen: "fun", focusPod: "decor", ideaWall: "decor",
      indoorTree: "plants", kombuchaTap: "fun", rocketModel: "decor", treeLamp: "lighting",
      uplight: "lighting", pizzaStack: "garage", cableSpool: "garage", mascotStandee: "decor",
    };
    for (const [id, category] of Object.entries(expected)) {
      const def = FURNITURE.find((f) => f.id === id);
      expect(def, `missing catalog item: ${id}`).toBeDefined();
      expect(def!.category).toBe(category);
      expect(def!.cost).toBeGreaterThan(0); // pinned by the shop's positive-price rule
    }
  });
});

describe("office grid grows with the facility tier", () => {
  it("gridN: Garage stays 9, Studio 11, Campus 13; unknown/base defaults to 9", () => {
    expect(gridN(1)).toBe(9);   // Garage — unchanged, so existing garages never shift
    expect(gridN(2)).toBe(11);  // Studio
    expect(gridN(3)).toBe(13);  // Campus
    expect(gridN()).toBe(9);    // default (back-compat for untyped callers)
    expect(gridN(0)).toBe(9);   // pre-tier fallback
  });

  it("gridOrigin re-centres the larger grid (−half its span)", () => {
    expect(gridOrigin(1)).toBeCloseTo(-(9 * GRID.cell) / 2, 6);
    expect(gridOrigin(3)).toBeCloseTo(-(13 * GRID.cell) / 2, 6);
    // a bigger grid pushes the min edge further out
    expect(gridOrigin(3)).toBeLessThan(gridOrigin(1));
  });

  it("bounds open up at higher tiers: a cell valid on Campus is out of bounds in the Garage", () => {
    // c=11 (a 2-wide desk → cols 11-12) fits a 13-wide Campus grid but not the 9-wide Garage.
    expect(canPlace([], "desk", 11, 0, 0, undefined, 3)).toBe(true);
    expect(canPlace([], "desk", 11, 0, 0, undefined, 1)).toBe(false);
    // addItem honours the tier: the same placement is accepted on Campus, rejected in the Garage.
    expect(addItem([], "f1", "desk", 11, 0, 0, 3)).toHaveLength(1);
    expect(addItem([], "f1", "desk", 11, 0, 0, 1)).toHaveLength(0);
  });

  it("worldOf stays centred: the same cell maps symmetrically about the origin at each tier", () => {
    const item: PlacedItem = { iid: "f1", type: "desk", c: 0, r: 0, rot: 0 };
    // cell 0 sits at the grid's min edge (+ half the 2×1 footprint) — further out on a bigger grid.
    const garage = worldOf(item, 1);
    const campus = worldOf(item, 3);
    expect(campus.x).toBeLessThan(garage.x); // Campus min edge is further from centre
    // a centre-ish cell on Campus lands near world origin (the grid is centred on the room)
    const mid = worldOf({ iid: "f2", type: "desk", c: 6, r: 6, rot: 0 }, 3);
    expect(Math.abs(mid.x)).toBeLessThan(GRID.cell); // within one cell of centre
  });
});

describe("deskZones — the same fold as the bonus, reported per desk", () => {
  it("reports nothing for the default office (its desk and plant sit apart)", () => {
    const z = deskZones(defaultLayout());
    expect(z.zoned).toEqual([]);
    expect(z.pairing).toEqual([]);
    expect(z.pairs).toBe(0);
    // …which is exactly why officeZoneBonus is 0 there.
    expect(officeZoneBonus(defaultLayout())).toEqual({ comfort: 0, focus: 0, inspiration: 0 });
  });

  it("names the desk AND the amenity that are pairing", () => {
    const layout: PlacedItem[] = [
      { iid: "d1", type: "desk", c: 2, r: 2, rot: 0 },
      { iid: "p1", type: "plantPot", c: 3, r: 2, rot: 0 },
      { iid: "d2", type: "desk", c: 7, r: 7, rot: 0 }, // alone in the far corner
    ];
    const z = deskZones(layout);
    expect(z.zoned).toEqual(["d1"]);
    expect(z.pairing).toEqual(["p1"]);
    expect(z.desks).toBe(2);
    expect(z.pairs).toBe(1);
    // A highlighted set is never empty when the bonus is non-zero — the pads and the payout agree.
    expect(officeZoneBonus(layout).comfort).toBeGreaterThan(0);
  });

  it("caps what one desk can earn, and reports the headroom left", () => {
    const crowded: PlacedItem[] = [
      { iid: "d1", type: "desk", c: 2, r: 2, rot: 0 },
      { iid: "a1", type: "plantPot", c: 3, r: 2, rot: 0 },
      { iid: "a2", type: "plantPot", c: 1, r: 2, rot: 0 },
      { iid: "a3", type: "plantPot", c: 2, r: 3, rot: 0 },
    ];
    const z = deskZones(crowded);
    expect(z.pairs).toBe(2);           // capped per desk
    expect(z.pairing).toHaveLength(2); // only the amenities actually paying get highlighted
    expect(z.headroom).toBe(0);        // this desk is full
    // One bare desk has both slots open.
    expect(deskZones([{ iid: "d9", type: "desk", c: 5, r: 5, rot: 0 }]).headroom).toBe(2);
  });
});

describe("tidyLayout — auto-arrange that buys and sells nothing", () => {
  /** A messy but legal room: desks scattered, amenities nowhere near them. */
  function messyRoom(): PlacedItem[] {
    return [
      { iid: "f1", type: "desk", c: 0, r: 0, rot: 0 },
      { iid: "f2", type: "desk", c: 7, r: 8, rot: 1 },
      { iid: "f3", type: "desk", c: 0, r: 6, rot: 0 },
      { iid: "f4", type: "plantPot", c: 8, r: 0, rot: 0 },
      { iid: "f5", type: "plantTall", c: 8, r: 4, rot: 0 },
      { iid: "f6", type: "bookshelf", c: 4, r: 4, rot: 0 },
    ];
  }

  it("keeps every piece the player owns — same ids, same types, nothing bought or sold", () => {
    const before = messyRoom();
    const after = tidyLayout(before);
    expect(after).toHaveLength(before.length);
    expect(after.map((it) => it.iid).sort()).toEqual(before.map((it) => it.iid).sort());
    for (const it of before) {
      expect(after.find((x) => x.iid === it.iid)!.type).toBe(it.type);
    }
  });

  it("produces a LEGAL room — nothing overlapping, nothing off the grid", () => {
    const after = tidyLayout(messyRoom());
    // Re-validate by replaying every placement against the others.
    for (const it of after) {
      const others = after.filter((x) => x.iid !== it.iid);
      expect(canPlace(others, it.type, it.c, it.r, it.rot, it.iid)).toBe(true);
    }
  });

  it("pairs desks with amenities — the zone bonus the room was silently paying for", () => {
    const before = messyRoom();
    expect(deskZones(before).zoned).toEqual([]);            // nothing paired to start
    expect(officeZoneBonus(before).comfort).toBe(0);
    const after = tidyLayout(before);
    const zones = deskZones(after);
    expect(zones.zoned.length).toBeGreaterThan(0);
    expect(officeZoneBonus(after).comfort).toBeGreaterThan(0);
  });

  it("is idempotent and deterministic — tidying a tidy room changes nothing", () => {
    const once = tidyLayout(messyRoom());
    const twice = tidyLayout(once);
    expect(twice).toEqual(once);
    expect(tidyMoveCount(once)).toBe(0);
    // Same input → same output, every time (no RNG anywhere).
    expect(tidyLayout(messyRoom())).toEqual(once);
  });

  it("reports how many pieces it would move, and no-ops on an empty room", () => {
    expect(tidyMoveCount(messyRoom())).toBeGreaterThan(0);
    expect(tidyLayout([])).toEqual([]);
    expect(tidyMoveCount([])).toBe(0);
  });

  it("respects a bigger facility's grid (a Campus room stays inside its own bounds)", () => {
    const layout: PlacedItem[] = Array.from({ length: 8 }, (_, i) => ({
      iid: `f${i}`, type: "desk" as const, c: 0, r: 0, rot: 0 as const,
    })).map((it, i) => ({ ...it, c: i % 4 * 2, r: Math.floor(i / 4) * 2 }));
    const after = tidyLayout(layout, 3);
    const n = gridN(3);
    for (const it of after) {
      const fp = footprint(furnitureDef(it.type), it.rot);
      expect(it.c).toBeGreaterThanOrEqual(0);
      expect(it.r).toBeGreaterThanOrEqual(0);
      expect(it.c + fp.w).toBeLessThanOrEqual(n);
      expect(it.r + fp.d).toBeLessThanOrEqual(n);
    }
  });
});
