import { describe, expect, it } from "vitest";
import { FLOOR, EXPAND_STEP } from "../engine/factoryFloor.ts";
import { FACTORY_DOCK } from "./factoryDock.ts";
import { yardLayout } from "./factoryYard.ts";

// The building (walls included) and everything the yard must stay out of, in world units.
const SHELL_HALF_D = 5.3 + 0.3;
const inBuilding = (x: number, z: number, floorW: number, bay: number) =>
  x > -FLOOR.w / 2 - 0.4 && x < -FLOOR.w / 2 + floorW + bay + 0.4 && Math.abs(z) < SHELL_HALF_D;
// the dock apron + truck (x -13.4..-8.2, z 1..4) and the AGV lanes (x -12.6..-9.0, z -2.2..3.9)
const inDock = (x: number, z: number) =>
  (x > -13.5 && x < -8.1 && z > 0.9 && z < 4.1) || (x > -12.7 && x < -8.9 && z > -2.3 && z < 3.9);

describe("factory yard (F7)", () => {
  for (const floorW of [FLOOR.w, FLOOR.w + EXPAND_STEP, FLOOR.w + 3 * EXPAND_STEP]) {
    it(`keeps every piece out of the building, its next bay, the dock and the AGV lanes (floor ${floorW})`, () => {
      const y = yardLayout(floorW);
      const points: [number, number][] = [...y.posts, ...y.lamps, ...y.parking, ...y.trees.map((t) => [t.x, t.z] as [number, number])];
      for (const [x, z] of points) {
        expect(inBuilding(x, z, floorW, EXPAND_STEP), `(${x.toFixed(2)}, ${z.toFixed(2)}) inside the building`).toBe(false);
        expect(inDock(x, z), `(${x.toFixed(2)}, ${z.toFixed(2)}) on the dock or a delivery lane`).toBe(false);
      }
    });
  }

  it("leaves the gate open where the truck's road runs out of the yard", () => {
    const y = yardLayout(FLOOR.w);
    const [, , truckZ] = FACTORY_DOCK.truck;
    const fenceX = Math.min(...y.posts.map(([x]) => x));
    for (const [, z] of y.posts.filter(([x]) => x === fenceX)) expect(Math.abs(z - truckZ) > 1.6).toBe(true);
    for (const r of y.rails) expect(r.len).toBeLessThan(1.5); // no rail spans the gate
  });

  it("stays inside the camera fit's west edge, so nothing is cut off in portrait", () => {
    const y = yardLayout(FLOOR.w);
    const xs = [...y.posts.map(([x]) => x), ...y.lamps.map(([x]) => x), ...y.parking.map(([x]) => x), ...y.trees.map((t) => t.x)];
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-14.2); // factoryFraming.ts WEST
  });

  it("is the same every time and the tree row follows the building east", () => {
    expect(yardLayout(FLOOR.w)).toEqual(yardLayout(FLOOR.w));
    const small = Math.max(...yardLayout(FLOOR.w).trees.map((t) => t.x));
    const big = Math.max(...yardLayout(FLOOR.w + 3 * EXPAND_STEP).trees.map((t) => t.x));
    expect(big).toBeGreaterThan(small + 6);
  });
});
