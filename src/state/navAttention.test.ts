import { describe, it, expect } from "vitest";
import { newGame, navAttention, type GameState } from "./gameState.ts";
import { REGIONS } from "../engine/regions.ts";
import { dollars } from "../engine/money.ts";

// The dots carry a WEIGHT, not a boolean: "act" means someone is waiting on an answer that expires,
// "opportunity" means something nice is available whenever you like, null means nothing. The split is
// the whole point — one identical dot for ~8 unrelated Office systems was always lit by mid-game.
describe("bottom-nav attention dots", () => {
  it("a brand-new game has no design nudge (nothing shipped yet)", () => {
    const a = navAttention(newGame(1));
    expect(a.design).toBeNull(); // no idle-pipeline nudge before the first ship
  });

  it("flags Company to ACT on a licensing offer (it expires), and not at all otherwise", () => {
    const base = newGame(1);
    const offer = { id: "lo-1", rivalId: "pomelo", rivalName: "Pomelo", category: "phone" as const, exclusive: false, signingBonus: dollars(50_000), royaltyPerWeek: dollars(2_000), termWeeks: 40, expiresWeek: 10, week: 7 };
    expect(navAttention(base).company).toBeNull();
    expect(navAttention({ ...base, platformUnlocked: true, pendingLicenseOffer: offer } as GameState).company).toBe("act");
  });

  it("an affordable region is an OPPORTUNITY; a pending event choice is an ACT", () => {
    const base = newGame(1);
    const region = REGIONS.find((r) => (r.unlockCost as number) > 0)!;
    const rich = { ...base, cash: dollars(9_999_999_999), unlockedRegions: ["home"] } as GameState;
    expect(navAttention(rich).market).toBe("opportunity");
    expect(region).toBeTruthy();

    const withChoice = { ...base, pendingChoice: { event: { id: "e", title: "t", body: "b", options: [] }, week: 1 } } as unknown as GameState;
    expect(navAttention(withChoice).hq).toBe("act");
  });

  it("separates Office's answer-me systems from its take-it-when-you-like ones", () => {
    const base = newGame(1);
    // A client commission on offer expires → the loud dot.
    const withOrder = { ...base, pendingSideOrder: { id: "so", clientName: "X", blurb: "y", units: 100, feePerUnit: dollars(10), weeksNeeded: 3, requiredKinds: [], expiresWeek: 20, week: 18 } } as unknown as GameState;
    expect(navAttention(withOrder).hq).toBe("act");

    // Post-IPO with an affordable megaproject → present, but it can wait.
    const richIPO = { ...base, wentPublic: true, cash: dollars(9_999_999_999), researchPoints: 100_000 } as GameState;
    expect(navAttention(richIPO).hq).toBe("opportunity");

    // Post-IPO with a spendable Legacy Point → likewise (even if broke on cash for a megaproject).
    const withPoints = { ...base, wentPublic: true, cash: dollars(0), legacyPoints: 10 } as GameState;
    expect(navAttention(withPoints).hq).toBe("opportunity");

    // Legacy actions never light the dot before going public.
    const preIPO = { ...base, legacyPoints: 10 } as GameState;
    expect(navAttention(preIPO).hq).toBeNull();
  });

  it("an answer owed outranks an opportunity on the same tab", () => {
    const base = newGame(1);
    // Post-IPO (opportunity: spendable Legacy Points) AND a poach attempt (act) → the loud one wins,
    // so a genuine decision can never be disguised as a standing nicety.
    const both = {
      ...base,
      wentPublic: true,
      legacyPoints: 10,
      pendingPoach: { staffId: "s1", staffName: "Ada", rivalId: "r", rivalName: "Pomelo", retainCost: dollars(1_000), week: 3 },
    } as unknown as GameState;
    expect(navAttention(both).hq).toBe("act");
  });
});
