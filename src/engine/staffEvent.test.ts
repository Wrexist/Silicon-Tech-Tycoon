// Staff life events (item 2.2): eligibility, deterministic cadence/target, event generation, and the
// reducer's effect application (mood / cash / loyalty), incl. rejecting an unaffordable option.
import { describe, expect, it } from "vitest";
import { lifeEventEligible, staffEventDue, pickLifeEventTarget, generateStaffEvent } from "./staffEvent.ts";
import { BALANCE } from "./balance.ts";
import type { Staff } from "./types.ts";

const base: Staff = {
  id: "s1", role: "engineer", name: "Priya Chen", skill: 6,
  skills: { engineering: 70, design: 30, marketing: 20 },
  salary: 100000 as Staff["salary"], assignment: "rnd", xp: 0, hiredWeek: 0,
  specialty: "performance", trait: "hustler", mood: 60, appearance: { skin: 1, hair: 0, hairColor: 0, shirt: 0, accessory: "none" },
};

describe("staff life events — engine", () => {
  it("the founder is never a target; others need some tenure", () => {
    expect(lifeEventEligible({ ...base, id: "s0" }, 100)).toBe(false);
    expect(lifeEventEligible({ ...base, hiredWeek: 95 }, 100)).toBe(false); // too new
    expect(lifeEventEligible({ ...base, hiredWeek: 0 }, 100)).toBe(true);
  });

  it("the cadence is deterministic and RNG-free", () => {
    expect(staffEventDue(12345, 40)).toBe(staffEventDue(12345, 40));
  });

  it("surfaces the LOW-MOOD teammate first (morale gets attention)", () => {
    const happy = { ...base, id: "a", mood: 80 };
    const struggling = { ...base, id: "b", mood: 20 };
    expect(pickLifeEventTarget([happy, struggling], 100)!.id).toBe("b");
  });

  it("a burnt-out teammate gets a retention-flavoured event with real options", () => {
    const ev = generateStaffEvent({ ...base, mood: 18 }, 999, 60);
    expect(ev.title.toLowerCase()).toContain("empty");
    expect(ev.options.length).toBeGreaterThanOrEqual(2);
    // at least one option repairs mood and buys loyalty
    expect(ev.options.some((o) => (o.effect.mood ?? 0) > 0 && (o.effect.retainWeeks ?? 0) > 0)).toBe(true);
  });

  it("a content teammate gets a lighter, non-punishing beat", () => {
    const ev = generateStaffEvent({ ...base, mood: 70, hiredWeek: 0 }, 3, 30);
    expect(ev.options.length).toBeGreaterThanOrEqual(2);
    // no option should tank mood hard — these are positive beats
    expect(Math.min(...ev.options.map((o) => o.effect.mood ?? 0))).toBeGreaterThanOrEqual(-8);
  });
});

describe("staff life events — reducer", () => {
  it("applies mood + charges cash, and rejects an unaffordable cash option", async () => {
    const { newGame, resolveStaffEvent } = await import("../state/gameState.ts");
    const g0 = newGame(7);
    const teammate: Staff = { ...base, id: "s1", mood: 20 };
    const withPending = {
      ...g0,
      staff: [...g0.staff, teammate],
      cash: 100 as typeof g0.cash, // broke
      pendingStaffEvent: generateStaffEvent(teammate, g0.seed, g0.week),
    };
    // The paid retention raise is unaffordable → rejected, card stays up.
    const raiseIdx = withPending.pendingStaffEvent!.options.findIndex((o) => (o.effect.cashCost ?? 0) > 0);
    const rej = resolveStaffEvent(withPending, raiseIdx);
    expect(rej.result.ok).toBe(false);
    expect(rej.state.pendingStaffEvent).not.toBeNull();
    // The free sabbatical works: mood recovers, loyalty extends, card clears.
    const freeIdx = withPending.pendingStaffEvent!.options.findIndex((o) => !(o.effect.cashCost ?? 0) && (o.effect.mood ?? 0) > 0);
    const ok = resolveStaffEvent(withPending, freeIdx);
    expect(ok.result.ok).toBe(true);
    expect(ok.state.pendingStaffEvent).toBeNull();
    const after = ok.state.staff.find((s) => s.id === "s1")!;
    expect(after.mood).toBeGreaterThan(teammate.mood);
    expect(after.poachCooldownUntil ?? 0).toBeGreaterThan(g0.week);
  });
});
