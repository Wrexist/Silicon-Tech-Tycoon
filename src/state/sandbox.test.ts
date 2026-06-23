// Creative / Sandbox mode must feel genuinely unlimited: money AND research are topped up to high
// floors (never lowering what you legitimately earned), immediately on enable and every tick.
import { describe, it, expect } from "vitest";
import { newGame, advanceOneWeek, setSandbox, type GameState } from "./gameState.ts";
import { BALANCE } from "../engine/balance.ts";
import { dollars } from "../engine/money.ts";

describe("Creative / Sandbox mode — unlimited money & research", () => {
  it("enabling tops cash + research up to the Creative floors immediately", () => {
    const g = setSandbox({ ...newGame(1), cash: dollars(5_000), researchPoints: 3 } as GameState, true);
    expect(g.sandboxUnlocked).toBe(true);
    expect(g.cash).toBe(BALANCE.creative.cashFloor);
    expect(g.researchPoints).toBe(BALANCE.creative.rpFloor);
  });

  it("never lowers what you've legitimately earned above the floor", () => {
    const high = setSandbox({ ...newGame(1), cash: dollars(50_000_000_000), researchPoints: 999_999 } as GameState, true);
    expect(high.cash).toBe(dollars(50_000_000_000));
    expect(high.researchPoints).toBe(999_999);
  });

  it("a tick keeps cash + research floored, and never goes bankrupt", () => {
    let g = setSandbox(newGame(2), true);
    g = { ...g, cash: dollars(100), researchPoints: 0 }; // simulate spending it all down
    const after = advanceOneWeek(g);
    expect(after.cash).toBeGreaterThanOrEqual(BALANCE.creative.cashFloor);
    expect(after.researchPoints).toBeGreaterThanOrEqual(BALANCE.creative.rpFloor);
    expect(after.bankrupt).toBe(false);
  });

  it("the floor is huge enough to afford founding the OS many times over", () => {
    expect(BALANCE.creative.cashFloor).toBeGreaterThan(BALANCE.platform.foundingCost * 100);
  });

  it("disabling stops the top-up (normal economy resumes)", () => {
    const off = setSandbox({ ...newGame(1), cash: dollars(5_000) } as GameState, false);
    expect(off.sandboxUnlocked).toBe(false);
    expect(off.cash).toBe(dollars(5_000)); // untouched
  });
});
