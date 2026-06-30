// Rival poaching outcome (Track C): the counter-offer decision applied to game state.
import { describe, expect, it } from "vitest";
import { newGame, resolvePoach, type GameState } from "./gameState.ts";
import { dollars, toDollars } from "../engine/money.ts";
import { BALANCE } from "../engine/balance.ts";
import type { Staff } from "../engine/types.ts";

function withTeam(cash: number): GameState {
  const ace: Staff = {
    id: "ace", role: "engineer", name: "Ada", skill: 8, salary: dollars(1_000),
    skills: { engineering: 80, design: 40, marketing: 30 }, assignment: "rnd", xp: 0,
    specialty: "performance", trait: "veteran", mood: 70,
    appearance: { skin: 1, hair: 0, hairColor: 0, shirt: 0, accessory: "none" },
  };
  const mate: Staff = { ...ace, id: "mate", name: "Ben", mood: 70 };
  return {
    ...newGame(5), onboarded: true, week: 40, cash: dollars(cash), staff: [ace, mate],
    pendingPoach: { staffId: "ace", staffName: "Ada", rivalId: "pomelo", rivalName: "Pomelo", retainCost: dollars(8_000), week: 40 },
  };
}

describe("resolvePoach", () => {
  it("matching the offer keeps the employee, pays the bonus, and sets a re-poach cooldown", () => {
    const s = resolvePoach(withTeam(100_000), true);
    expect(s.pendingPoach ?? null).toBeNull();
    expect(s.staff.find((m) => m.id === "ace")).toBeTruthy(); // kept
    expect(toDollars(s.cash)).toBe(100_000 - 8_000);          // bonus paid
    const ace = s.staff.find((m) => m.id === "ace")!;
    expect(ace.poachCooldownUntil).toBe(40 + BALANCE.poaching.cooldownWeeks);
    expect(ace.mood).toBeGreaterThan(70);                     // morale lift
  });

  it("letting them go removes the employee and dents the rest of the team", () => {
    const s = resolvePoach(withTeam(100_000), false);
    expect(s.pendingPoach ?? null).toBeNull();
    expect(s.staff.find((m) => m.id === "ace")).toBeFalsy();  // gone
    expect(toDollars(s.cash)).toBe(100_000);                  // no spend
    const mate = s.staff.find((m) => m.id === "mate")!;
    expect(mate.mood).toBe(70 - BALANCE.poaching.declineTeamMoodHit);
  });

  it("accepting without the cash to cover it is treated as letting them go", () => {
    const s = resolvePoach(withTeam(2_000), true);            // retainCost 8000 > cash
    expect(s.staff.find((m) => m.id === "ace")).toBeFalsy();
    expect(toDollars(s.cash)).toBe(2_000);                    // never went negative
  });

  it("no-ops cleanly when there is no pending poach", () => {
    const base = { ...newGame(5), pendingPoach: null };
    expect(resolvePoach(base, true)).toBe(base);
  });
});
