// State-layer arch-rival: the nemesis dissolves on buyout, the reveal clears, and topCat drives the
// launch edge. The tick-level formation is covered by the pure nemesis engine tests + the 160-week
// determinism pin (a do-nothing run never clashes → never forms one → byte-identical).
import { describe, it, expect } from "vitest";
import {
  newGame,
  acquireRival,
  canAcquire,
  dismissRivalry,
  playerTopCategory,
  nemesisRival,
  isNemesis,
  resolveStrike,
  advanceOneWeek,
  type GameState,
  type RivalStrike,
} from "./gameState.ts";
import { dollars } from "../engine/money.ts";
import { BALANCE } from "../engine/balance.ts";
import type { Nemesis } from "../engine/nemesis.ts";

function nem(rivalId: string): Nemesis {
  return { rivalId, sinceWeek: 5, heat: 60, peakHeat: 70, playerWins: 3, rivalWins: 1, lastClashWeek: 40 };
}

describe("nemesis selectors", () => {
  it("nemesisRival + isNemesis resolve the arch-rival's live state", () => {
    const base = newGame(7);
    const rid = base.competitors[0].id;
    const g = { ...base, nemesis: nem(rid) } as GameState;
    expect(isNemesis(g, rid)).toBe(true);
    expect(isNemesis(g, "nobody")).toBe(false);
    expect(nemesisRival(g)?.id).toBe(rid);
    expect(nemesisRival(base)).toBeNull(); // no nemesis → null
  });
});

describe("feud strikes (feature #7 — a strike is a beat of the nemesis rivalry)", () => {
  function strike(rivalId: string, over: Partial<RivalStrike> = {}): RivalStrike {
    return {
      week: 10, rivalId, rivalName: "Rival Co", rivalProductName: "Their Phone", rivalOverall: 50,
      category: "phone", productId: "p-mine", productName: "My Phone", playerOverall: 60,
      fromNemesis: true, heat: 60, ...over,
    };
  }

  it("standing your ground and out-classing the nemesis banks a win and raises heat", () => {
    const base = newGame(1);
    const rid = base.competitors[0].id;
    const g = { ...base, week: 12, nemesis: nem(rid), pendingStrike: strike(rid) } as GameState;
    const res = resolveStrike(g, "hold"); // playerOverall 60 >= rivalOverall 50 → repelled
    expect(res.ok).toBe(true);
    expect(res.state.pendingStrike).toBeNull();
    expect(res.state.nemesis!.playerWins).toBe(g.nemesis!.playerWins + 1);
    expect(res.state.nemesis!.rivalWins).toBe(g.nemesis!.rivalWins);
    expect(res.state.nemesis!.heat).toBeGreaterThan(g.nemesis!.heat);
    expect(res.state.nemesis!.lastClashWeek).toBe(12);
  });

  it("getting caught out by the nemesis banks a win for THEM", () => {
    const base = newGame(1);
    const rid = base.competitors[0].id;
    const g = { ...base, week: 12, nemesis: nem(rid), pendingStrike: strike(rid, { playerOverall: 40, rivalOverall: 55 }) } as GameState;
    const res = resolveStrike(g, "hold"); // outclassed → they land it
    expect(res.state.nemesis!.rivalWins).toBe(g.nemesis!.rivalWins + 1);
    expect(res.state.nemesis!.playerWins).toBe(g.nemesis!.playerWins);
  });

  it("an ordinary (non-nemesis) strike never touches the rivalry", () => {
    const base = newGame(1);
    const rid = base.competitors[0].id;
    const other = base.competitors[1].id;
    // A strike from a DIFFERENT rival, not flagged as the nemesis — the feud is untouched.
    const g = { ...base, week: 12, nemesis: nem(rid), pendingStrike: strike(other, { fromNemesis: false, heat: undefined }) } as GameState;
    const res = resolveStrike(g, "hold");
    expect(res.state.nemesis).toEqual(g.nemesis);
  });
});

describe("dismissRivalry", () => {
  it("clears the pending reveal, no-op when there's nothing to show", () => {
    const base = newGame(1);
    expect(dismissRivalry(base)).toBe(base);
    const g = { ...base, pendingRivalry: { rivalId: "x", rivalName: "X", doctrine: "generalist" } } as GameState;
    expect(dismissRivalry(g).pendingRivalry).toBeNull();
  });
});

describe("playerTopCategory", () => {
  it("returns the category the player has sold the most units in (defaults phone)", () => {
    expect(playerTopCategory(newGame(1))).toBe("phone"); // no launches → default
    const g = {
      ...newGame(1),
      launched: [
        { product: { category: "phone" }, unitsSold: 1000 },
        { product: { category: "tablet" }, unitsSold: 5000 },
        { product: { category: "laptop" }, unitsSold: 200 },
      ],
    } as unknown as GameState;
    expect(playerTopCategory(g)).toBe("tablet");
  });
});

describe("acquireRival settles the score", () => {
  it("buying out your arch-rival dissolves the nemesis with a climactic feed beat", () => {
    const base = {
      ...newGame(7),
      cash: dollars(50_000_000_000),
      cumulativeRevenue: dollars(200_000_000_000),
    } as GameState;
    const rid = base.competitors[0].id;
    const g = { ...base, nemesis: nem(rid) } as GameState;
    expect(canAcquire(g, rid)).toBe(true);
    const after = acquireRival(g, rid);
    expect(after.competitors.some((c) => c.id === rid)).toBe(false); // rival gone
    expect(after.nemesis).toBeNull();                                // rivalry over
    expect(after.feed.some((f) => /arch-rival/i.test(f.text) && /won/i.test(f.text))).toBe(true);
  });

  it("acquiring a NON-nemesis rival leaves an existing nemesis intact", () => {
    const base = {
      ...newGame(7),
      cash: dollars(50_000_000_000),
      cumulativeRevenue: dollars(200_000_000_000),
    } as GameState;
    const [a, b] = base.competitors;
    const g = { ...base, nemesis: nem(b.id) } as GameState; // nemesis is B; acquire A
    const after = acquireRival(g, a.id);
    expect(after.nemesis?.rivalId).toBe(b.id);
  });
});

describe("determinism safety", () => {
  it("a locked (no-clash) tick never forms a nemesis", () => {
    // A boosted solo run that ships nothing never clashes → no nemesis, matching the pinned sim.
    let s = { ...newGame(7777), cash: dollars(5_000_000) } as GameState;
    for (let w = 0; w < 60; w++) s = advanceOneWeek(s);
    expect(s.nemesis ?? null).toBeNull();
    expect(s.pendingRivalry ?? null).toBeNull();
    expect(BALANCE.competitors.nemesis.formHeat).toBeGreaterThan(0); // sanity: config present
  });
});
