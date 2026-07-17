import { describe, it, expect, beforeEach } from "vitest";
import { newGame, launchBars, type GameState } from "./gameState.ts";
import { recordFounder, getFounderRecord } from "./founderLegend.ts";
import { toDollars } from "../engine/money.ts";

// vitest runs in the `node` env here (no DOM), so stub localStorage for the founder-record store.
class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.get(k) ?? null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
  clear(): void { this.map.clear(); }
}

beforeEach(() => {
  // @ts-expect-error assigning a stub to the global for the node test env
  globalThis.localStorage = new MemStorage();
});

/** Force a big launch expectation so launchBars is exercising the same branch at every Heat. */
function withExpectation(state: GameState, exp: number): GameState {
  return { ...state, launchExpectation: exp };
}

describe("ascension / Heat integration", () => {
  it("raises every verdict bar as Heat climbs (harder to hit, easier to flop)", () => {
    const cold = withExpectation(newGame(1), 400);
    const hot = withExpectation({ ...newGame(1), ascensionLevel: 5 }, 400);
    const c = launchBars(cold);
    const h = launchBars(hot);
    expect(h.hit).toBeGreaterThan(c.hit);
    expect(h.solid).toBeGreaterThan(c.solid);
    expect(h.flop).toBeGreaterThan(c.flop);
  });

  it("cuts the legacy head-start at higher Heat (cash / rep / fans / RP all shrink)", () => {
    const easy = newGame(7, 4, 0); // legacy 4, no Heat — full head-start
    const hard = newGame(7, 4, 5); // same legacy, Heat 5 — head-start cut
    expect(toDollars(hard.cash)).toBeLessThan(toDollars(easy.cash));
    expect(hard.reputation).toBeLessThanOrEqual(easy.reputation);
    expect(hard.fans).toBeLessThanOrEqual(easy.fans);
    expect(hard.researchPoints).toBeLessThanOrEqual(easy.researchPoints);
    // And the run is stamped with the level it was started at.
    expect(hard.ascensionLevel).toBe(5);
  });

  it("Heat 0 and an unset level are byte-identical (determinism no-op)", () => {
    const implicit = newGame(42, 3); // ascension defaults to 0
    const explicit = newGame(42, 3, 0);
    // lastActive is a wall-clock stamp and feed ids embed a module-level counter that keeps ticking
    // across the two calls — normalize both away; everything else must match bit-for-bit.
    const norm = (s: GameState) => ({
      ...s,
      lastActive: 0,
      feed: s.feed.map((f) => ({ week: f.week, text: f.text, tone: f.tone })),
    });
    expect(norm(explicit)).toEqual(norm(implicit));
    // A no-Heat run never carries the field at all, so an old save round-trips unchanged.
    expect(implicit.ascensionLevel).toBeUndefined();
    expect(launchBars(withExpectation(implicit, 300))).toEqual(launchBars(withExpectation(explicit, 300)));
  });

  it("records the best Heat level ever cleared in the founder profile", () => {
    recordFounder({ ipo: true, hitsInRun: 3, valuationDollars: 1_000_000, rank: 5, ascension: 4 });
    expect(getFounderRecord().bestAscension).toBe(4);
    // A later, easier clear never lowers the recorded best.
    recordFounder({ prestige: true, hitsInRun: 1, valuationDollars: 500_000, rank: 8, ascension: 1 });
    expect(getFounderRecord().bestAscension).toBe(4);
    // A hotter clear raises it.
    recordFounder({ prestige: true, hitsInRun: 5, valuationDollars: 9_000_000, rank: 2, ascension: 7 });
    expect(getFounderRecord().bestAscension).toBe(7);
  });
});
