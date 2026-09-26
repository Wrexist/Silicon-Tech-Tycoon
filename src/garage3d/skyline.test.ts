import { describe, expect, it } from "vitest";
import { BALANCE } from "../engine/balance.ts";
import { roomScaleFor } from "./officeConfig.ts";
import { ROOM_HALF_BASE, SKYLINE_HALF_DEPTH, skylinePlacement, type SkylinePiece } from "./skyline.ts";

// Regression for the skyline-renders-inside-the-room bug. The exterior rows live in the room's x/z
// space, so their POSITIONS scale with `roomScaleFor(tier)` while their GEOMETRY does not. The
// assertion is on the transformed bounds relative to the room's scaled footprint — not merely that
// the helper returns a number — so dropping the `roomK` factor fails it at the larger tiers.

const TIERS = BALANCE.facilities.map((f) => f.tier);
const EPS = 1e-6;

/** Distance from the room's scaled half-extent to the box's nearest face along `axis` (0 = x, 2 = z). */
function clearanceOut(piece: SkylinePiece, axis: 0 | 2, roomHalf: number): number {
  return Math.abs(piece.position[axis]) - piece.size[axis] / 2 - roomHalf;
}

describe("exterior skyline clears the room footprint at every facility tier", () => {
  it("covers the full supported facility range", () => {
    expect(TIERS).toEqual([1, 2, 3]);
  });

  for (const tier of TIERS) {
    it(`tier ${tier}: both exterior rows stay outside the scaled walls`, () => {
      const roomK = roomScaleFor(tier);
      const roomHalf = ROOM_HALF_BASE * roomK;
      const { wallB, wallA } = skylinePlacement(roomK);

      expect(wallB.length).toBeGreaterThan(0);
      expect(wallA.length).toBeGreaterThan(0);
      for (const b of wallB) {
        expect(clearanceOut(b, 0, roomHalf), `wall-B ${b.key} at tier ${tier} intrudes into the room`).toBeGreaterThanOrEqual(EPS);
      }
      for (const b of wallA) {
        expect(clearanceOut(b, 2, roomHalf), `wall-A ${b.key} at tier ${tier} intrudes into the room`).toBeGreaterThanOrEqual(EPS);
      }
    });
  }

  it("scales positions but never geometry, so removing the roomK factor is caught", () => {
    const top = TIERS[TIERS.length - 1];
    const roomK = roomScaleFor(top);
    const scaled = skylinePlacement(roomK);
    const base = skylinePlacement(1);
    const roomHalf = ROOM_HALF_BASE * roomK;

    // Geometry is identical at every tier — a distant building must not grow with the facility.
    expect(scaled.wallB[0].size).toEqual(base.wallB[0].size);
    expect(scaled.wallA[0].size).toEqual(base.wallA[0].size);
    // Positions DO scale, and this is what keeps the clearance positive.
    expect(Math.abs(scaled.wallB[0].position[0])).toBeGreaterThan(Math.abs(base.wallB[0].position[0]));
    expect(Math.abs(scaled.wallA[0].position[2])).toBeGreaterThan(Math.abs(base.wallA[0].position[2]));

    // Load-bearing proof: the UNSCALED positions violate clearance at the largest tier — the exact
    // bug this test pins — while the scaled ones clear it by SKYLINE_HALF_DEPTH + the wall gap.
    expect(clearanceOut(base.wallB[0], 0, roomHalf)).toBeLessThan(0);
    expect(clearanceOut(base.wallA[0], 2, roomHalf)).toBeLessThan(0);
    expect(clearanceOut(scaled.wallB[0], 0, roomHalf)).toBeCloseTo(1.1 * roomK - SKYLINE_HALF_DEPTH, 6);
    expect(clearanceOut(scaled.wallA[0], 2, roomHalf)).toBeCloseTo(1.1 * roomK - SKYLINE_HALF_DEPTH, 6);
  });
});
