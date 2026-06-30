// Org structure / mentorship (Track C): discipline leads + the junior XP boost.
import { describe, expect, it } from "vitest";
import { disciplineLead, mentorshipXpMult, isDisciplineLead } from "./org.ts";
import { gainWeeklyXp } from "./economy.ts";
import { BALANCE } from "./balance.ts";
import type { Assignment, Skills, Staff } from "./types.ts";

function dev(id: string, assignment: Assignment, skills: Partial<Skills>, skill = 5): Staff {
  return {
    id, role: "engineer", name: id, skill, salary: 0 as never, xp: 0,
    skills: { engineering: 0, design: 0, marketing: 0, ...skills }, assignment,
    specialty: "performance", trait: "veteran", mood: 70,
    appearance: { skin: 1, hair: 0, hairColor: 0, shirt: 0, accessory: "none" },
  } as Staff;
}

const o = BALANCE.org;

describe("org — discipline lead", () => {
  it("the strongest ACTIVE person in a discipline is its lead", () => {
    const team = [
      dev("snr", "rnd", { engineering: 90 }),
      dev("jnr", "rnd", { engineering: 30 }),
      dev("idle", "idle", { engineering: 99 }), // idle people don't lead
    ];
    expect(disciplineLead(team, "engineering")?.id).toBe("snr");
    expect(isDisciplineLead(team[0], team)).toBe(true);
    expect(isDisciplineLead(team[1], team)).toBe(false);
  });

  it("a discipline with nobody assigned has no lead", () => {
    expect(disciplineLead([dev("a", "rnd", { engineering: 50 })], "design")).toBeNull();
  });
});

describe("org — mentorship multiplier", () => {
  it("a junior under a much stronger lead learns faster, capped", () => {
    const lead = dev("lead", "rnd", { engineering: 95 });
    const junior = dev("jnr", "rnd", { engineering: 20 });
    const mult = mentorshipXpMult(junior, [lead, junior]);
    expect(mult).toBeGreaterThan(1);
    expect(mult).toBeLessThanOrEqual(1 + o.mentorMaxBonus);
  });

  it("the lead themselves gets no boost", () => {
    const lead = dev("lead", "rnd", { engineering: 95 });
    const junior = dev("jnr", "rnd", { engineering: 20 });
    expect(mentorshipXpMult(lead, [lead, junior])).toBe(1);
  });

  it("a gap below the threshold earns no boost", () => {
    const a = dev("a", "rnd", { engineering: 60 });
    const b = dev("b", "rnd", { engineering: 60 - (o.minMentorGap - 1) });
    expect(mentorshipXpMult(b, [a, b])).toBe(1);
  });

  it("an idle member or a solo worker is never mentored", () => {
    const solo = dev("solo", "rnd", { engineering: 40 });
    expect(mentorshipXpMult(solo, [solo])).toBe(1);
    expect(mentorshipXpMult(dev("i", "idle", { engineering: 10 }), [dev("lead", "rnd", { engineering: 99 })])).toBe(1);
  });

  it("mentorship actually accelerates XP gain through gainWeeklyXp", () => {
    const junior = dev("jnr", "rnd", { engineering: 20 }, 2);
    const lead = dev("lead", "rnd", { engineering: 95 }, 9);
    const solo = gainWeeklyXp(junior, 1).staff.xp;
    const mentored = gainWeeklyXp(junior, mentorshipXpMult(junior, [lead, junior])).staff.xp;
    expect(mentored).toBeGreaterThan(solo);
  });

  it("default call (no mentor) is unchanged — solo-founder sim safe", () => {
    const founder = dev("s0", "rnd", { engineering: 50 }, 5);
    expect(gainWeeklyXp(founder)).toEqual(gainWeeklyXp(founder, 1));
  });
});
