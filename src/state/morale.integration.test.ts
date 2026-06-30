// Company-wide morale spend (Track C): the proactive offsite/bonus lever.
import { describe, expect, it } from "vitest";
import { newGame, boostMorale, moraleCost, canBoostMorale, dominantMoodDriver, type GameState } from "./gameState.ts";
import { dollars, toDollars } from "../engine/money.ts";
import { BALANCE } from "../engine/balance.ts";
import type { Staff } from "../engine/types.ts";

function team(): GameState {
  const mk = (id: string, mood: number): Staff => ({
    id, role: "engineer", name: id, skill: 6, salary: dollars(2_000),
    skills: { engineering: 60, design: 30, marketing: 30 }, assignment: "rnd", xp: 0,
    specialty: "performance", trait: "veteran", mood, moodLowWeeks: mood < 22 ? 4 : 0,
    appearance: { skin: 1, hair: 0, hairColor: 0, shirt: 0, accessory: "none" },
  });
  return { ...newGame(5), week: 40, cash: dollars(500_000), staff: [mk("a", 50), mk("b", 18)] };
}

describe("boostMorale", () => {
  it("a bonus lifts every teammate's mood, clears burnout counters, and costs cash + sets a cooldown", () => {
    const s0 = team();
    const cost = moraleCost(s0, "bonus");
    const s = boostMorale(s0, "bonus");
    expect(s.staff[0].mood).toBe(50 + BALANCE.morale.bonusMoodLift);
    expect(s.staff[1].mood).toBe(18 + BALANCE.morale.bonusMoodLift);
    expect(s.staff[1].moodLowWeeks).toBe(0); // burnout danger cleared
    expect(toDollars(s.cash)).toBe(500_000 - toDollars(cost));
    expect(s.moraleCooldownUntil).toBe(40 + BALANCE.morale.cooldownWeeks);
  });

  it("an offsite lifts more and costs more than a bonus", () => {
    expect(BALANCE.morale.offsiteMoodLift).toBeGreaterThan(BALANCE.morale.bonusMoodLift);
    const s = team();
    expect(toDollars(moraleCost(s, "offsite"))).toBeGreaterThan(toDollars(moraleCost(s, "bonus")));
  });

  it("mood lift is clamped at 100", () => {
    const s0 = { ...team(), staff: team().staff.map((m) => ({ ...m, mood: 95 })) };
    const s = boostMorale(s0, "offsite");
    expect(s.staff.every((m) => m.mood <= 100)).toBe(true);
  });

  it("is on cooldown until the timer elapses", () => {
    const s = { ...team(), moraleCooldownUntil: 50 };
    expect(canBoostMorale(s, "bonus")).toBe(false);
    expect(boostMorale(s, "bonus")).toBe(s); // no-op
    expect(canBoostMorale({ ...s, week: 50 }, "bonus")).toBe(true);
  });

  it("can't run a morale spend you can't afford", () => {
    const s = { ...team(), cash: dollars(10) };
    expect(canBoostMorale(s, "offsite")).toBe(false);
    expect(boostMorale(s, "offsite")).toBe(s);
  });
});

describe("C5: dominant mood driver", () => {
  // A clean base: cash RISING (no cash driver), no flops, so a single driver can be isolated.
  function base(): GameState {
    const g = team();
    return { ...g, cashHistory: [{ week: 38, cash: 100 }, { week: 39, cash: 200 }], launched: [] };
  }
  const wellPaid = (g: GameState, i: number): Staff => ({ ...g.staff[i], id: `p${i}`, salary: dollars(999_999) });

  it("flags underpay when salary lags the market (over the cramped-office baseline)", () => {
    const g = base();
    const underpaid: Staff = { ...g.staff[0], id: "u", salary: dollars(1) };
    expect(dominantMoodDriver(g, underpaid)?.key).toBe("underpaid");
  });

  it("flags a recent flop for a well-paid teammate", () => {
    const g = base();
    const lp = { ...sampleLaunched(), verdict: "flop" as const, launchedWeek: g.week - 1 };
    const withFlop = { ...g, launched: [lp] };
    expect(dominantMoodDriver(withFlop, wellPaid(g, 0))?.key).toBe("flop");
  });

  it("flags falling cash when the recent history drops", () => {
    const g = { ...base(), cashHistory: [{ week: 38, cash: 500 }, { week: 39, cash: 200 }] };
    expect(dominantMoodDriver(g, wellPaid(g, 0))?.key).toBe("cash");
  });

  it("flags the hustler trait when nothing more urgent applies", () => {
    const g = base();
    const hustler: Staff = { ...wellPaid(g, 0), trait: "hustler" };
    // cramped office (weight 8) is outranked by the hustler trait (weight 12)
    expect(dominantMoodDriver(g, hustler)?.key).toBe("hustler");
  });

  it("returns the cramped office only when nothing else weighs in", () => {
    const g = base();
    expect(dominantMoodDriver(g, wellPaid(g, 0))?.key).toBe("comfort");
  });

  it("never blames the founder for underpay", () => {
    const g = base();
    const founder: Staff = { ...g.staff[0], id: "s0", salary: dollars(1) };
    // s0 is exempt from underpay; with a comfy office + no other cause this is null
    const comfy = { ...g, layout: [] }; // bare garage still cramped, so expect comfort, never underpaid
    expect(dominantMoodDriver(comfy, founder)?.key).not.toBe("underpaid");
  });
});

/** A minimal launched product for the flop-driver case. */
function sampleLaunched() {
  return {
    product: { id: "x", name: "X", category: "phone" as const, tiers: {}, finish: "aluminium" as const, colorIndex: 0, price: dollars(100), designTier: 1, camera: { count: 1, layout: "vertical" as const, position: "topLeft" as const, module: "squircle" as const, flash: true }, notch: "punch" as const },
    stats: { performance: 30, quality: 30, battery: 30, design: 30, ecosystem: 30 },
    unitCost: dollars(50), launchScore: 10, launchedWeek: 0, totalUnits: 100, weeklyUnits: [10, 10], unitsSold: 20, weeksElapsed: 2, revenueToDate: dollars(2000),
  };
}
