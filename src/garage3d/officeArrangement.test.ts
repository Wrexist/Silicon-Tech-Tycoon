// Contract tests for the office arranger and the derived orientation rules. Pure functions only —
// node environment, no DOM, no three. These pin the invariants a captured frame cannot: the room
// never overlaps, never leaves the grid, re-flows by tier, and renders as its owner placed it
// except where an unambiguous relationship says otherwise.
import { describe, expect, it } from "vitest";
import { footprint, furnitureDef, gridN, type FurnitureId, type PlacedItem, type Rot } from "../engine/furniture.ts";
import { arrangeOffice, circulationLane, derivedYawFor, dressingAnchors, dressingCap, dressingTotalCap, fixtureObstacles } from "./officeArrangement.ts";

const item = (iid: string, type: FurnitureId, c: number, r: number, rot: Rot = 0): PlacedItem => ({ iid, type, c, r, rot });

const cellsOf = (it: PlacedItem): string[] => {
  const { w, d } = footprint(furnitureDef(it.type), it.rot);
  const out: string[] = [];
  for (let dc = 0; dc < w; dc++) for (let dr = 0; dr < d; dr++) out.push(`${it.c + dc},${it.r + dr}`);
  return out;
};

describe("officeArrangement — placement invariants", () => {
  const TIERS = [1, 2, 3];
  const HEADS = [0, 1, 3, 6, 9, 12, 16];
  // The light room with no upgrades: the shell fixtures that are always drawn (vault, printer,
  // shell plant) and none of the conditional ones, so the arrangeable space is as large as possible.
  const BARE = { dark: false, amenities: 0, designSuite: false, testLab: false };
  // A player room with a desk + plant (no zone-ownership trigger), so the dressing still places.
  const OCCUPIED: PlacedItem[] = [item("f1", "dualDesk", 5, 4), item("f2", "plantPot", 8, 2)];

  it("never overlaps itself, the player's furniture, or the room's fixed fixtures", () => {
    for (const facilityTier of TIERS) {
      for (const headcount of HEADS) {
        for (const occupied of [[], OCCUPIED]) {
          const arrangement = arrangeOffice({ facilityTier, headcount, occupied });
          // The given inputs may overlap each other (a player CAN place a plant on a fixture cell);
          // the invariant is that nothing the ARRANGER placed overlaps anything at all.
          const given = new Set([...occupied, ...fixtureObstacles(facilityTier)].map((it) => it.iid));
          const room = [...occupied, ...fixtureObstacles(facilityTier), ...arrangement.pieces];
          for (let i = 0; i < room.length; i++) {
            if (furnitureDef(room[i].type).flat) continue; // rugs underlap by design
            for (let j = i + 1; j < room.length; j++) {
              if (furnitureDef(room[j].type).flat) continue;
              if (given.has(room[i].iid) && given.has(room[j].iid)) continue;
              const a = new Set(cellsOf(room[i]));
              expect(cellsOf(room[j]).some((c) => a.has(c)), `tier ${facilityTier}, head ${headcount}: ${room[i].iid} vs ${room[j].iid}`).toBe(false);
            }
          }
        }
      }
    }
  });

  it("never leaves the grid", () => {
    for (const facilityTier of TIERS) {
      for (const headcount of HEADS) {
        const n = gridN(facilityTier);
        const arrangement = arrangeOffice({ facilityTier, headcount, ...BARE });
        for (const p of arrangement.pieces) {
          const { w, d } = footprint(furnitureDef(p.type), p.rot);
          expect(p.c).toBeGreaterThanOrEqual(0);
          expect(p.r).toBeGreaterThanOrEqual(0);
          expect(p.c + w).toBeLessThanOrEqual(n);
          expect(p.r + d).toBeLessThanOrEqual(n);
        }
      }
    }
  });

  it("never writes the player's layout — moved, added to, or removed from", () => {
    const occupied = [item("f1", "dualDesk", 5, 4), item("f2", "sofa", 1, 8)];
    const before = JSON.parse(JSON.stringify(occupied));
    arrangeOffice({ facilityTier: 3, headcount: 6, occupied });
    expect(occupied).toEqual(before);
  });

  it("is stable for the same inputs", () => {
    const input = { facilityTier: 3, headcount: 9, occupied: OCCUPIED, era: 2, seed: 7, week: 104 };
    expect(arrangeOffice(input)).toEqual(arrangeOffice(input));
  });

  it("re-flows by tier — a bigger room seats at least as many, and unsticks the overflow", () => {
    const small = arrangeOffice({ facilityTier: 1, headcount: 12, ...BARE });
    const large = arrangeOffice({ facilityTier: 3, headcount: 12, ...BARE });
    expect(large.seats).toBeGreaterThanOrEqual(small.seats);
    expect(large.seats).toBeGreaterThan(small.seats); // a 9×9 grid runs out of desk anchors first
    expect(large.seats).toBe(12);
    // Seven of the 9×9's nine anchors survive the shell's vault / printer / corner plant.
    expect(small.seats).toBe(7);
  });

  it("places exactly the headcount when it can, and never more", () => {
    for (const headcount of HEADS) {
      const arrangement = arrangeOffice({ facilityTier: 3, headcount, ...BARE });
      expect(arrangement.seats).toBeLessThanOrEqual(headcount);
      if (headcount <= 12) expect(arrangement.seats).toBe(headcount);
    }
  });

  it("shifts the storage run around the dark theme's tool chest and the lane instead of erasing it", () => {
    const light = arrangeOffice({ facilityTier: 3, headcount: 6, ...BARE });
    const dark = arrangeOffice({ facilityTier: 3, headcount: 6, ...BARE, dark: true });
    const lightRows = light.dressing.filter((p) => p.zone === "storage").map((p) => p.r);
    const darkRows = dark.dressing.filter((p) => p.zone === "storage").map((p) => p.r);
    expect(lightRows).toEqual([0, 1, 2]);
    expect(darkRows).toEqual([3, 4, 6]); // rows 0–2 are the tool chest; row 5 is the lane
  });

  it("keeps the central circulation lane completely empty", () => {
    for (const facilityTier of TIERS) {
      const lane = circulationLane(facilityTier);
      expect(lane.length, `tier ${facilityTier} lane spans the room`).toBe(gridN(facilityTier));
      // The lane is one full row, and never a desk row or a chair band.
      expect(new Set(lane.map((s) => s.r)).size).toBe(1);
      const row = lane[0].r;
      expect((row - 1) % 3).not.toBe(0); // not a desk row
      expect(row % 3).not.toBe(0); // not the chair band behind one
      const laneCells = new Set(lane.map(({ c, r }) => `${c},${r}`));
      for (const headcount of HEADS) {
        const arrangement = arrangeOffice({ facilityTier, headcount, ...BARE });
        for (const p of arrangement.pieces) {
          for (const cell of cellsOf(p)) {
            expect(laneCells.has(cell), `tier ${facilityTier}, head ${headcount}: ${p.type}@${p.c},${p.r} sits in the lane`).toBe(false);
          }
        }
      }
    }
  });

  it("never exceeds the per-zone or total dressing caps for its tier", () => {
    for (const facilityTier of TIERS) {
      for (const headcount of HEADS) {
        const arrangement = arrangeOffice({ facilityTier, headcount, ...BARE });
        const counts = { lounge: 0, storage: 0, culture: 0 };
        for (const p of arrangement.dressing) counts[p.zone as keyof typeof counts]++;
        for (const zone of ["lounge", "storage", "culture"] as const) {
          expect(counts[zone], `tier ${facilityTier}: ${zone} over cap`).toBeLessThanOrEqual(dressingCap(zone, facilityTier));
        }
        expect(arrangement.dressing.length, `tier ${facilityTier}: total dressing over cap`).toBeLessThanOrEqual(dressingTotalCap(facilityTier));
      }
    }
    // The authored clusters actually use the budget: a Studio lounge is four pieces, not one.
    const studio = arrangeOffice({ facilityTier: 2, headcount: 6, ...BARE });
    expect(studio.dressing.filter((p) => p.zone === "lounge").length).toBe(4);
  });

  it("keeps every dressing piece inside its zone's anchor region", () => {
    for (const facilityTier of [2, 3]) {
      const anchors = dressingAnchors(facilityTier);
      const arrangement = arrangeOffice({ facilityTier, headcount: 9, ...BARE });
      expect(arrangement.dressing.length).toBeGreaterThan(0);
      for (const p of arrangement.dressing) {
        if (p.zone === "work") continue;
        const { w, d } = footprint(furnitureDef(p.type), p.rot);
        const region = anchors[p.zone];
        expect(p.c, `${p.type}@${p.c},${p.r} c`).toBeGreaterThanOrEqual(region.c0);
        expect(p.r, `${p.type}@${p.c},${p.r} r`).toBeGreaterThanOrEqual(region.r0);
        expect(p.c + w, `${p.type}@${p.c},${p.r} c+w`).toBeLessThanOrEqual(region.c1 + 1);
        expect(p.r + d, `${p.type}@${p.c},${p.r} r+d`).toBeLessThanOrEqual(region.r1 + 1);
      }
    }
  });

  it("keeps every solid dressing piece out of the work banks' chair rows", () => {
    for (const facilityTier of [2, 3]) {
      const arrangement = arrangeOffice({ facilityTier, headcount: 12, ...BARE });
      const bands = new Set<string>();
      for (const dk of arrangement.pieces) {
        if (dk.zone !== "work") continue;
        for (let i = 0; i < 2; i++) bands.add(`${dk.c + i},${dk.r - 1}`); // rot-0 desks seat behind
      }
      for (const p of arrangement.dressing) {
        if (furnitureDef(p.type).flat) continue;
        for (const cell of cellsOf(p)) expect(bands.has(cell), `${p.type}@${p.c},${p.r}`).toBe(false);
      }
    }
  });

  it("composes every work desk as a workstation module unit", () => {
    for (const facilityTier of TIERS) {
      const arrangement = arrangeOffice({ facilityTier, headcount: 9, monitors: 2, ...BARE });
      const work = arrangement.pieces.filter((p) => p.zone === "work");
      expect(work.length).toBe(arrangement.seats);
      for (const p of work) {
        expect(p.module, `${p.iid} has no module`).toBeDefined();
        expect([1, 2]).toContain(p.module!.screens);
        expect(["papers", "plant", "books"]).toContain(p.module!.prop);
      }
      // The unit adds no grid cells beyond the desk itself: the lane and density tests above stay
      // true because the chair is the engine's derived seat, not a placed piece.
      expect(new Set(work.map((p) => p.iid)).size).toBe(work.length);
    }
  });

  it("keeps every work desk on a reserved desk row", () => {
    for (const facilityTier of [1, 2, 3]) {
      const n = gridN(facilityTier);
      for (const p of arrangeOffice({ facilityTier, headcount: 12, ...BARE }).pieces) {
        if (p.zone !== "work") continue;
        expect(p.rot).toBe(0);
        expect((p.r - 1) % 3).toBe(0);
        expect(p.r).toBeGreaterThanOrEqual(0);
        expect(p.r).toBeLessThan(n - 1);
      }
    }
  });

  it("leaves a zone the player has already furnished alone", () => {
    const owned = (type: FurnitureId) => {
      const arrangement = arrangeOffice({ facilityTier: 3, headcount: 6, occupied: [item("f1", type, 0, 6)], ...BARE });
      return arrangement.dressing.map((p) => p.zone);
    };
    expect(owned("sofa")).not.toContain("lounge");
    expect(owned("serverRack")).not.toContain("storage");
    expect(owned("arcade")).not.toContain("culture");
  });

  it("varies the culture accent by week, deterministically", () => {
    const rows = new Set<number>();
    for (let week = 1; week <= 40; week++) {
      const a = arrangeOffice({ facilityTier: 3, headcount: 6, seed: 7, week, ...BARE });
      const b = arrangeOffice({ facilityTier: 3, headcount: 6, seed: 7, week, ...BARE });
      expect(a).toEqual(b);
      const arcade = a.dressing.find((p) => p.type === "arcade");
      if (arcade) rows.add(arcade.r);
    }
    expect(rows.size).toBeGreaterThan(1);
  });
});

describe("officeArrangement — derived orientation", () => {
  const T = Math.PI / 2;

  it("turns a chair on any edge of a meeting table to face it", () => {
    const table = item("t1", "meetingTable", 7, 9);
    const layout = [table, item("c1", "chair", 7, 11), item("c2", "chair", 6, 9), item("c3", "chair", 10, 9), item("c4", "chair", 8, 8)];
    expect(derivedYawFor(layout[1], layout)).toBeCloseTo(2 * T);
    expect(derivedYawFor(layout[2], layout)).toBeCloseTo(T);
    expect(derivedYawFor(layout[3], layout)).toBeCloseTo(3 * T);
    expect(derivedYawFor(layout[4], layout)).toBeCloseTo(0);
  });

  it("turns a lounge seat toward its rug / coffee table", () => {
    const layout = [item("r1", "rug", 2, 9), item("s1", "sofaL", 2, 10, 0)];
    expect(derivedYawFor(layout[1], layout)).toBeCloseTo(2 * T);
  });

  it("lays a wall-backed piece flat to the wall it touches", () => {
    const n = gridN(3);
    const layout = [item("b1", "bookshelf", 4, 0), item("b2", "bookshelf", 0, 4), item("b3", "bookshelf", n - 1, 4)];
    expect(derivedYawFor(layout[0], layout, 3)).toBeCloseTo(0);      // back wall → +z
    expect(derivedYawFor(layout[1], layout, 3)).toBeCloseTo(T);      // left wall → +x
    expect(derivedYawFor(layout[2], layout, 3)).toBeCloseTo(3 * T);  // right wall → −x
  });

  it("leaves a corner piece at the rotation its owner chose (two walls = ambiguous)", () => {
    const corner = item("b1", "bookshelf", 0, 0, 1);
    expect(derivedYawFor(corner, [corner])).toBeCloseTo(T);
  });

  it("keeps a piece's own rotation when no relationship applies", () => {
    const solo = item("c1", "chair", 5, 5, 3);
    expect(derivedYawFor(solo, [solo])).toBeCloseTo(3 * T);
    const lone = item("s1", "sofa", 5, 5, 0);
    expect(derivedYawFor(lone, [lone])).toBeCloseTo(0);
  });

  it("never derives a turn that changes a non-square footprint", () => {
    // The seat reads the table to its +z, but a 2×1 sofa at rot 1 may only take the 90°/270° family.
    const layout = [item("s1", "sofa", 2, 5, 1), item("t1", "coffeeTable", 2, 6)];
    const yaw = derivedYawFor(layout[0], layout);
    expect([T, 3 * T]).toContain(yaw);
  });

  it("leaves radial pieces alone", () => {
    const stool = item("s1", "stool", 5, 5, 2);
    expect(derivedYawFor(stool, [stool, item("t1", "coffeeTable", 5, 6)])).toBeCloseTo(2 * T);
  });
});
