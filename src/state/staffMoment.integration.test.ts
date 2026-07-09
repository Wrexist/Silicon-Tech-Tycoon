// Staff growth moments: a tenured, senior non-founder occasionally earns a permanent character
// upgrade the player chooses (second specialty / bonus trait / team mentor). Determinism-safe: the
// founder is never a target and a solo run raises none, matching the pinned sim.
import { describe, it, expect } from "vitest";
import { newGame, resolveStaffMoment, advanceOneWeek, type GameState } from "./gameState.ts";
import { pickGrowthTarget, generateStaffMoment, growthEligible, mentorTeamXpMult, fullyGrown } from "../engine/staffMoment.ts";
import { designSpecialtyBonus, staffXpMult } from "../engine/staff.ts";
import { BALANCE } from "../engine/balance.ts";
import { dollars } from "../engine/money.ts";
import type { Staff } from "../engine/types.ts";

const G = BALANCE.staff.growth;

function member(over: Partial<Staff> = {}): Staff {
  return {
    id: "s1", role: "designer", name: "Lena", skill: 7,
    skills: { engineering: 30, design: 80, marketing: 40 },
    salary: dollars(2000), assignment: "design", xp: 0,
    specialty: "design", trait: "perfectionist", mood: 70, hiredWeek: 0,
    appearance: { skin: 0, hair: 0, hairColor: 0, shirt: 0, accessory: "none" },
    ...over,
  };
}

describe("growth eligibility + target", () => {
  it("needs a senior, tenured, non-founder", () => {
    expect(growthEligible(member({ id: "s0" }), 100)).toBe(false); // founder never
    expect(growthEligible(member({ skill: G.minSkill - 1 }), 100)).toBe(false); // too junior
    expect(growthEligible(member({ hiredWeek: 95 }), 100)).toBe(false); // too new
    expect(growthEligible(member(), 100)).toBe(true);
  });

  it("fully-grown staff are no longer targets", () => {
    const grown = member({ secondSpecialty: "battery", bonusTrait: "visionary", isMentor: true });
    expect(fullyGrown(grown)).toBe(true);
    expect(growthEligible(grown, 100)).toBe(false);
  });

  it("pickGrowthTarget deterministically prefers the most senior eligible one", () => {
    const staff = [member({ id: "s0", skill: 10 }), member({ id: "s1", skill: 7 }), member({ id: "s2", skill: 9 })];
    expect(pickGrowthTarget(staff, 100)?.id).toBe("s2"); // s0 is the founder → excluded
    expect(pickGrowthTarget([member({ id: "s0", skill: 10 })], 100)).toBeNull();
  });
});

describe("generate + resolve", () => {
  it("offers only the upgrades the target hasn't earned", () => {
    const withSpec = member({ secondSpecialty: "battery" });
    const m = generateStaffMoment(withSpec, 5, 60);
    expect(m.options.some((o) => o.kind === "specialty")).toBe(false);
    expect(m.options.some((o) => o.kind === "trait")).toBe(true);
    expect(m.options.some((o) => o.kind === "mentor")).toBe(true);
  });

  it("resolving applies the chosen upgrade and clears the moment", () => {
    const s = member();
    const g = { ...newGame(3), staff: [{ ...s, id: "s0" }, s] } as GameState;
    const moment = generateStaffMoment(s, g.seed, g.week);
    const withMoment = { ...g, pendingStaffMoment: moment } as GameState;
    const mentorIdx = moment.options.findIndex((o) => o.kind === "mentor");
    const r = resolveStaffMoment(withMoment, mentorIdx);
    expect(r.result.ok).toBe(true);
    expect(r.state.pendingStaffMoment).toBeNull();
    expect(r.state.staff.find((x) => x.id === "s1")?.isMentor).toBe(true);
  });
});

describe("upgrade effects", () => {
  it("a second specialty adds a second design-stat bonus", () => {
    const before = designSpecialtyBonus([member()]);
    const after = designSpecialtyBonus([member({ secondSpecialty: "battery" })]);
    expect(before.battery ?? 0).toBe(0);
    expect(after.battery ?? 0).toBeGreaterThan(0);
  });

  it("a bonus fastLearner trait stacks the XP multiplier", () => {
    expect(staffXpMult(member({ trait: "perfectionist" }))).toBe(1);
    expect(staffXpMult(member({ trait: "perfectionist", bonusTrait: "fastLearner" }))).toBeCloseTo(1.5, 3);
  });

  it("a mentor lifts every OTHER staffer's XP but not their own", () => {
    const mentor = member({ id: "s1", isMentor: true });
    const other = member({ id: "s2" });
    const staff = [mentor, other];
    expect(mentorTeamXpMult(staff, other)).toBeGreaterThan(1);
    expect(mentorTeamXpMult(staff, mentor)).toBe(1);
  });
});

describe("determinism safety", () => {
  it("a solo run raises no growth moment and keeps the founder ungrown", () => {
    let s = { ...newGame(321), cash: dollars(5_000_000) } as GameState;
    for (let w = 0; w < 160; w++) s = advanceOneWeek(s);
    expect(s.pendingStaffMoment ?? null).toBeNull();
    const founder = s.staff.find((x) => x.id === "s0")!;
    expect(founder.secondSpecialty).toBeUndefined();
    expect(founder.bonusTrait).toBeUndefined();
    expect(founder.isMentor).toBeUndefined();
  });
});
