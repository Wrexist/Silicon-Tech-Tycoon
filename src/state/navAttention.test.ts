import { describe, it, expect } from "vitest";
import { newGame, navAttention, type GameState } from "./gameState.ts";
import { REGIONS } from "../engine/regions.ts";
import { dollars } from "../engine/money.ts";

describe("bottom-nav attention dots", () => {
  it("a brand-new game has no design nudge (nothing shipped yet)", () => {
    const a = navAttention(newGame(1));
    expect(a.design).toBe(false); // no idle-pipeline nudge before the first ship
  });

  it("flags Company when a licensing contract is on the table", () => {
    const base = newGame(1);
    const offer = { id: "lo-1", rivalId: "pomelo", rivalName: "Pomelo", category: "phone" as const, exclusive: false, signingBonus: dollars(50_000), royaltyPerWeek: dollars(2_000), termWeeks: 40, expiresWeek: 10, week: 7 };
    expect(navAttention(base).company).toBe(false);
    expect(navAttention({ ...base, platformUnlocked: true, pendingLicenseOffer: offer } as GameState).company).toBe(true);
  });

  it("flags Market when a region is affordable, and Office on a pending decision", () => {
    const base = newGame(1);
    const region = REGIONS.find((r) => (r.unlockCost as number) > 0)!;
    const rich = { ...base, cash: dollars(9_999_999_999), unlockedRegions: ["home"] } as GameState;
    expect(navAttention(rich).market).toBe(true);
    expect(region).toBeTruthy();

    const withChoice = { ...base, pendingChoice: { event: { id: "e", title: "t", body: "b", options: [] }, week: 1 } } as unknown as GameState;
    expect(navAttention(withChoice).hq).toBe(true);
  });

  it("flags Office for HQ-surfaced systems: a pending side order, and post-IPO Legacy actions", () => {
    const base = newGame(1);
    // A client commission on offer → HQ dot.
    const withOrder = { ...base, pendingSideOrder: { id: "so", clientName: "X", blurb: "y", units: 100, feePerUnit: dollars(10), weeksNeeded: 3, requiredKinds: [], expiresWeek: 20, week: 18 } } as unknown as GameState;
    expect(navAttention(withOrder).hq).toBe(true);

    // Post-IPO with an affordable megaproject → HQ dot.
    const richIPO = { ...base, wentPublic: true, cash: dollars(9_999_999_999), researchPoints: 100_000 } as GameState;
    expect(navAttention(richIPO).hq).toBe(true);

    // Post-IPO with a spendable Legacy Point → HQ dot (even if broke on cash for a megaproject).
    const withPoints = { ...base, wentPublic: true, cash: dollars(0), legacyPoints: 10 } as GameState;
    expect(navAttention(withPoints).hq).toBe(true);

    // Legacy actions never light the dot before going public.
    const preIPO = { ...base, legacyPoints: 10 } as GameState;
    expect(navAttention(preIPO).hq).toBe(false);
  });
});
