import { describe, it, expect } from "vitest";
import {
  newGame,
  placeFurniture,
  removeFurniture,
  applyLayoutSnapshot,
  officeComfortMoodBonus,
  officeFocusMult,
  officeInspoBonus,
  canAffordFurniture,
} from "./gameState.ts";
import { dollars, toDollars } from "../engine/money.ts";
import { BALANCE } from "../engine/balance.ts";
import { furnitureCost } from "../engine/furniture.ts";
import type { FurnitureId, PlacedItem } from "../engine/furniture.ts";

const rich = () => ({ ...newGame(42), cash: dollars(1_000_000) });

describe("office shop — economics", () => {
  it("placing charges the item's cost and adds it to the room", () => {
    const s0 = rich();
    const s1 = placeFurniture(s0, "sofa", 0, 0, 0);
    expect(toDollars(s0.cash) - toDollars(s1.cash)).toBe(furnitureCost("sofa"));
    expect(s1.layout.length).toBe(s0.layout.length + 1);
  });

  it("rejects a purchase you can't afford — no item, no charge", () => {
    const broke = { ...newGame(42), cash: dollars(0) };
    expect(canAffordFurniture(broke, "sofa")).toBe(false);
    expect(placeFurniture(broke, "sofa", 0, 0, 0)).toBe(broke); // unchanged reference
  });

  it("selling refunds 50% (resaleRate) and removes the item", () => {
    let s = placeFurniture(rich(), "poolTable", 0, 0, 0);
    const iid = s.layout[s.layout.length - 1].iid;
    const before = toDollars(s.cash);
    s = removeFurniture(s, iid);
    expect(toDollars(s.cash) - before).toBe(Math.round(furnitureCost("poolTable") * BALANCE.shop.resaleRate));
    expect(s.layout.find((x) => x.iid === iid)).toBeUndefined();
  });

  it("undo snapshot restores cash AND layout in full (a true reversal, not a 50% sell)", () => {
    const s0 = rich();
    const snap = { layout: s0.layout, cash: s0.cash };
    const s1 = placeFurniture(s0, "arcade", 0, 0, 0);
    expect(s1.cash).not.toBe(s0.cash);
    const restored = applyLayoutSnapshot(s1, snap);
    expect(restored.cash).toBe(s0.cash);
    expect(restored.layout).toBe(s0.layout);
  });

  it("a broke player can recover by selling furniture back", () => {
    let s = placeFurniture(rich(), "executiveDesk", 0, 0, 0);
    const iid = s.layout[s.layout.length - 1].iid;
    s = { ...s, cash: dollars(0) }; // went broke after buying
    s = removeFurniture(s, iid);
    expect(toDollars(s.cash)).toBeGreaterThan(0); // sold it back for cash
  });
});

describe("office shop — capped buffs", () => {
  const many = (type: FurnitureId, n: number): PlacedItem[] =>
    Array.from({ length: n }, (_, i) => ({ iid: `x${type}${i}`, type, c: 0, r: 0, rot: 0 as const }));

  it("comfort / focus / inspiration each cap at the BALANCE.shop ceiling", () => {
    const layout = [...many("poolTable", 20), ...many("serverRack", 20), ...many("sculpture", 20)];
    const s = { ...newGame(42), layout };
    expect(officeComfortMoodBonus(s)).toBe(BALANCE.shop.comfortCap);
    expect(officeFocusMult(s)).toBeCloseTo(1 + BALANCE.shop.focusCap);
    expect(officeInspoBonus(s)).toBe(BALANCE.shop.inspCap);
  });

  it("a lightly-furnished office gives a small, uncapped bonus", () => {
    const s = { ...newGame(42), layout: [{ iid: "a", type: "plantPot" as FurnitureId, c: 0, r: 0, rot: 0 as const }] };
    expect(officeComfortMoodBonus(s)).toBeCloseTo(2 * BALANCE.shop.comfortK); // plantPot comfort = 2
    expect(officeFocusMult(s)).toBe(1); // no focus furniture
  });
});
