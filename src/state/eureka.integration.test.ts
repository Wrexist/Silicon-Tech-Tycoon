// State-layer eureka: the bank/chase reducer, the insight selector, and determinism safety (a
// do-nothing run — no researchers — never fires a breakthrough, matching the pinned sim).
import { describe, it, expect } from "vitest";
import { newGame, resolveEureka, eurekaInsight, rndStaffCount, advanceOneWeek, type GameState } from "./gameState.ts";
import { generateEureka, resolveEurekaChase } from "../engine/eureka.ts";
import { BALANCE } from "../engine/balance.ts";
import { dollars } from "../engine/money.ts";

const E = BALANCE.research.eureka;

describe("resolveEureka", () => {
  it("bank takes the guaranteed RP and clears the moment", () => {
    const moment = generateEureka(7, 30, 3);
    const g = { ...newGame(7), week: 30, era: 3, researchPoints: 100, pendingEureka: moment } as GameState;
    const { state, result } = resolveEureka(g, "bank");
    expect(result.ok).toBe(true);
    expect(result.jackpot).toBe(false);
    expect(state.researchPoints).toBe(100 + moment.bankRp);
    expect(state.pendingEureka).toBeNull();
  });

  it("chase pays the rolled outcome; a jackpot also lifts rep + fans", () => {
    const moment = generateEureka(7, 30, 3);
    const rolled = resolveEurekaChase(7, moment); // same seed as the game → same outcome
    const g = { ...newGame(7), week: 30, era: 3, researchPoints: 100, reputation: 50, fans: 1000, pendingEureka: moment } as GameState;
    const { state, result } = resolveEureka(g, "chase");
    expect(result.ok).toBe(true);
    expect(result.jackpot).toBe(rolled.jackpot);
    expect(state.researchPoints).toBe(100 + rolled.rp);
    expect(state.pendingEureka).toBeNull();
    if (rolled.jackpot) {
      expect(state.reputation).toBe(50 + E.jackpotRepBonus);
      expect(state.fans).toBe(1000 + E.jackpotFanBonus);
    } else {
      expect(state.reputation).toBe(50); // a fizzle changes nothing but RP
    }
  });

  it("is a no-op with nothing pending", () => {
    const g = newGame(1);
    const { state, result } = resolveEureka(g, "bank");
    expect(result.ok).toBe(false);
    expect(state).toBe(g);
  });
});

describe("insight selectors", () => {
  it("eurekaInsight starts empty; rndStaffCount counts R&D-assigned staff", () => {
    expect(eurekaInsight(newGame(1))).toBe(0);
    const g = newGame(1);
    expect(rndStaffCount(g)).toBe(g.staff.filter((s) => s.assignment === "rnd").length);
  });
});

describe("determinism safety", () => {
  it("a solo run with no researchers never fires a breakthrough", () => {
    let s = { ...newGame(7777), cash: dollars(5_000_000) } as GameState;
    for (let w = 0; w < 120; w++) s = advanceOneWeek(s);
    expect(s.pendingEureka ?? null).toBeNull();
  });
});
