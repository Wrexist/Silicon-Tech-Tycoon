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
    // Derive the band from the configured chance so a legitimate balance retune doesn't fail this.
    const n = 400;
    const expected = n * BALANCE.events.chainChance;
    const tolerance = Math.ceil(5 * Math.sqrt(n * BALANCE.events.chainChance * (1 - BALANCE.events.chainChance)));
    expect(fired).toBeGreaterThanOrEqual(Math.floor(expected - tolerance));
    expect(fired).toBeLessThanOrEqual(Math.ceil(expected + tolerance));
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

  it("a newly-added chain (counterfeit-surge) fires its fan bump then hands off its choice", () => {
    const before: GameState = { ...newGame(9), onboarded: true, era: 2, week: 25, cash: dollars(5_000_000), nextEventWeek: 999,
      eventChain: { id: "counterfeit-surge", step: 1, nextWeek: 25 } };
    const mid = advanceOneWeek(before);
    expect(mid.fans).toBeGreaterThan(before.fans); // step 1 = fansBonus
    expect(mid.eventChain?.step).toBe(2);
    const atChoiceInput: GameState = { ...newGame(9), onboarded: true, era: 2, week: 27, cash: dollars(5_000_000), nextEventWeek: 999,
      eventChain: { id: "counterfeit-surge", step: 2, nextWeek: 27 } };
    const after = advanceOneWeek(atChoiceInput);
    expect(after.eventChain ?? null).toBeNull();
    expect(after.pendingChoice?.event.id).toBe("chain-counterfeit-fight");
  });

  it("a chain never bankrupts: its supply-crunch beat is capped to a share of cash", () => {
    const before: GameState = { ...newGame(7), onboarded: true, era: 2, week: 12, cash: dollars(20_000), nextEventWeek: 999,
      eventChain: { id: "recall-ripple", step: 1, nextWeek: 12 } };
    // The chain's extra cash drop (vs. an identical week with no chain) must not exceed the configured
    // crunch cap, AND it must stay solvent. `nextEventWeek: 999` holds ordinary events constant.
    const control = advanceOneWeek({ ...before, eventChain: null });
    const after = advanceOneWeek(before);
    const extraDrop = toDollars(control.cash) - toDollars(after.cash);
    expect(extraDrop).toBeLessThanOrEqual(toDollars(before.cash) * BALANCE.events.crunchMaxCashShare + 1);
    expect(toDollars(after.cash)).toBeGreaterThan(0);
  });
});
