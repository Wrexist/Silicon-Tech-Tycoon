import { describe, it, expect } from "vitest";
import { EVENT_CHAINS, chainById, pickChain } from "./eventChains.ts";
import { makeRng } from "./rng.ts";
import { BALANCE } from "./balance.ts";
import { dollars, toDollars } from "./money.ts";
import { newGame, advanceOneWeek, type GameState } from "../state/gameState.ts";

describe("event chains (Track B)", () => {
  it("every chain opens with an effect beat and ends in a player choice", () => {
    for (const c of EVENT_CHAINS) {
      expect(c.steps.length).toBeGreaterThanOrEqual(2);
      expect(c.steps[0].kind).toBe("effect");
      expect(c.steps[c.steps.length - 1].kind).toBe("choice");
    }
  });

  it("pickChain respects the era floor and fires at roughly the configured chance", () => {
    const rng = makeRng(123);
    let fired = 0;
    for (let i = 0; i < 400; i++) {
      const c = pickChain(rng, 1); // era 1 — only chains with minEra <= 1 are eligible
      if (c) { fired++; expect(c.minEra).toBeLessThanOrEqual(1); }
    }
    // ~16% of 400 ≈ 64; allow a wide band so the test isn't flaky.
    expect(fired).toBeGreaterThan(30);
    expect(fired).toBeLessThan(110);
  });

  it("a due chain beat fires through the tick and advances the chain", () => {
    const before: GameState = { ...newGame(5), onboarded: true, era: 2, week: 20, cash: dollars(5_000_000),
      eventChain: { id: "recall-ripple", step: 1, nextWeek: 20 } };
    const after = advanceOneWeek(before);
    // step 1 of recall-ripple is a supply crunch: cash drops, and the chain advances to the choice beat.
    expect(toDollars(after.cash)).toBeLessThan(toDollars(before.cash));
    expect(after.eventChain?.step).toBe(2);
  });

  it("the terminal beat hands off to the choice system and ends the chain", () => {
    const before: GameState = { ...newGame(6), onboarded: true, era: 2, week: 30, cash: dollars(5_000_000),
      eventChain: { id: "recall-ripple", step: 2, nextWeek: 30 } };
    const after = advanceOneWeek(before);
    expect(after.eventChain ?? null).toBeNull();
    expect(after.pendingChoice?.event.id).toBe(chainById("recall-ripple")!.steps[2].kind === "choice"
      ? "chain-recall-talent" : "");
  });

  it("a chain never bankrupts: its supply-crunch beat is capped to a share of cash", () => {
    const before: GameState = { ...newGame(7), onboarded: true, era: 2, week: 12, cash: dollars(20_000),
      eventChain: { id: "recall-ripple", step: 1, nextWeek: 12 } };
    const after = advanceOneWeek(before);
    expect(toDollars(after.cash)).toBeGreaterThan(0); // the crunch cap (BALANCE.events.crunchMaxCashShare) protects solvency
    expect(BALANCE.events.chainChance).toBeGreaterThan(0);
  });
});
