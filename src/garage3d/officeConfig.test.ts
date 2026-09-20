// Office configuration seam tests — the tier-driven presentation rules that used to be scattered
// inline. Pure values only; no DOM and no three.
import { describe, expect, it } from "vitest";
import { officeConfigFor, roomScaleFor, seamOpacity, zonePaintOpacity } from "./officeConfig.ts";

describe("officeConfig — tier-driven presentation", () => {
  it("fades the garage workshop floor as the facility grows, never re-enabling it", () => {
    const tiers = [0, 1, 1.7, 2, 3, 4, 9];
    const paint = tiers.map(zonePaintOpacity);
    const seams = tiers.map(seamOpacity);
    for (let i = 1; i < tiers.length; i++) {
      expect(paint[i], `paint at tier ${tiers[i]}`).toBeLessThanOrEqual(paint[i - 1]);
      expect(seams[i], `seams at tier ${tiers[i]}`).toBeLessThanOrEqual(seams[i - 1]);
    }
    expect(zonePaintOpacity(1)).toBe(0.5); // the garage keeps its painted work zone
    expect(zonePaintOpacity(3)).toBeLessThanOrEqual(0.15); // a Campus is not a workshop
    expect(seamOpacity(1)).toBe(1);
    expect(seamOpacity(3)).toBeLessThan(seamOpacity(2));
  });

  it("scales the room by tier and reads the player's finishes straight through", () => {
    expect(roomScaleFor(1)).toBe(1);
    expect(roomScaleFor(3)).toBeGreaterThan(1);
    const cfg = officeConfigFor({
      facilityTier: 3,
      upgrades: { computers: 2, amenities: 1, testLab: 1 },
      roomStyle: { floor: 4, wall: 2 },
      desktops: 3,
    });
    expect(cfg.monitors).toBe(2);
    expect(cfg.amenityTier).toBe(1);
    expect(cfg.showTestChamber).toBe(true);
    expect(cfg.showEasel).toBe(false);
    expect(cfg.podCount).toBe(3);
    expect(cfg.finish.id).toBe("polished");
    expect(cfg.wall.kind).toBe("paint");
  });
});
