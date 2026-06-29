// Company-wide morale spend (Track C): the proactive offsite/bonus lever.
import { describe, expect, it } from "vitest";
import { newGame, boostMorale, moraleCost, canBoostMorale, type GameState } from "./gameState.ts";
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
