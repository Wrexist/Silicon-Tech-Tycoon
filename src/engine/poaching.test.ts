// Rival poaching (Track C): pure target-selection rules + the counter-offer outcome.
import { describe, expect, it } from "vitest";
import { pickPoachTarget } from "./poaching.ts";
import { makeRng } from "./rng.ts";
import { BALANCE } from "./balance.ts";
import type { CompetitorState, Staff } from "./types.ts";

function staff(over: Partial<Staff> & { id: string }): Staff {
  return {
    role: "engineer", name: over.id, skill: 8, salary: 0 as never,
    skills: { engineering: 80, design: 40, marketing: 30 }, assignment: "rnd", xp: 0,
    specialty: "performance", trait: "veteran", mood: 70,
    appearance: { skin: 1, hair: 0, hairColor: 0, shirt: 0, accessory: "none" }, ...over,
  } as Staff;
}
function rival(id: string, arcPhase?: CompetitorState["arcPhase"]): CompetitorState {
  return { id, name: id, blurb: "", reputation: 60, strengthByCategory: {}, nextLaunchWeek: 1, sharePrice: 10000, priceHistory: [100], arcPhase };
}

describe("rival poaching — target selection", () => {
  const rng = () => makeRng(5);

  it("never targets the founder, the unskilled, the unhappy, or someone on cooldown", () => {
    const team = [
      staff({ id: "s0", skill: 10 }),                              // founder — exempt
      staff({ id: "lowskill", skill: BALANCE.poaching.minSkill - 1 }),
      staff({ id: "unhappy", mood: BALANCE.poaching.minMood - 1 }),
      staff({ id: "cooldown", poachCooldownUntil: 100 }),
    ];
    const t = pickPoachTarget(team, [rival("pomelo")], 20, rng());
    expect(t).toBeNull(); // nobody qualifies
  });

  it("targets an eligible, skilled, content employee", () => {
    const team = [staff({ id: "s0", skill: 10 }), staff({ id: "ace", skill: 9, mood: 80 })];
    const t = pickPoachTarget(team, [rival("pomelo")], 20, rng());
    expect(t?.staff.id).toBe("ace");
  });

  it("a retained employee is eligible again once the cooldown elapses", () => {
    const team = [staff({ id: "ace", poachCooldownUntil: 30 })];
    expect(pickPoachTarget(team, [rival("p")], 20, rng())).toBeNull(); // still on cooldown
    expect(pickPoachTarget(team, [rival("p")], 31, rng())?.staff.id).toBe("ace"); // cooldown passed
  });

  it("prefers a rival ON THE RISE as the poacher when one exists", () => {
    const team = [staff({ id: "ace", skill: 9 })];
    const comps = [rival("steady", "stable"), rival("rising", "ascending"), rival("flat", "declining")];
    for (let seed = 0; seed < 20; seed++) {
      const t = pickPoachTarget(team, comps, 20, makeRng(seed));
      expect(t?.rival.id).toBe("rising"); // only the ascending/peaking rival ever poaches
    }
  });

  it("is deterministic for a given rng sequence", () => {
    const team = [staff({ id: "a", skill: 9 }), staff({ id: "b", skill: 8 }), staff({ id: "c", skill: 7 })];
    const comps = [rival("x", "peaking"), rival("y", "ascending")];
    const a = pickPoachTarget(team, comps, 20, makeRng(42));
    const b = pickPoachTarget(team, comps, 20, makeRng(42));
    expect(a?.staff.id).toBe(b?.staff.id);
    expect(a?.rival.id).toBe(b?.rival.id);
  });
});
