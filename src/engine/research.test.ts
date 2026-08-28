// Dedicated characterization tests for engine/research.ts — the research-project catalog's
// structural invariants (forks, prerequisites, capstones) and the RP economy helpers.
import { describe, it, expect } from "vitest";
import { dollars } from "./money.ts";
import { BALANCE } from "./balance.ts";
import {
  RESEARCH_PROJECTS,
  forkLockedBy,
  projectById,
  prereqsMissing,
  projectUnlocked,
  doctrineSummary,
  completableProjectCount,
  weeklyRp,
  rpSources,
  techRpCost,
  hasProject,
  type ProjectId,
} from "./research.ts";
import type { Staff } from "./types.ts";

function staffer(over: Partial<Staff> & { id: string }): Staff {
  return {
    role: "engineer",
    name: over.id,
    skill: 8,
    salary: dollars(1_000),
    skills: { engineering: 80, design: 40, marketing: 30 },
    assignment: "rnd",
    xp: 0,
    specialty: "performance",
    trait: "veteran",
    mood: 70,
    appearance: { skin: 1, hair: 0, hairColor: 0, shirt: 0, accessory: "none" },
    ...over,
  } as Staff;
}

describe("RESEARCH_PROJECTS catalog integrity", () => {
  it("ids are unique and every project has a positive finite RP cost and a valid era", () => {
    const ids = RESEARCH_PROJECTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const maxEra = BALANCE.eras.length;
    for (const p of RESEARCH_PROJECTS) {
      expect(Number.isFinite(p.rpCost)).toBe(true);
      expect(p.rpCost).toBeGreaterThan(0);
      expect(Number.isInteger(p.era)).toBe(true);
      expect(p.era).toBeGreaterThanOrEqual(1);
      expect(p.era).toBeLessThanOrEqual(maxEra);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.blurb.length).toBeGreaterThan(0);
    }
  });

  it("every prerequisite resolves, never self-references, and is available no later than its dependent", () => {
    const byId = new Map(RESEARCH_PROJECTS.map((p) => [p.id, p]));
    for (const p of RESEARCH_PROJECTS) {
      for (const req of p.requires ?? []) {
        const dep = byId.get(req);
        expect(dep, `${p.id} requires unknown project ${req}`).toBeDefined();
        expect(req).not.toBe(p.id);
        expect(dep!.era).toBeLessThanOrEqual(p.era);
      }
    }
  });

  it("no project requires two siblings of the same fork (which would be unresearchable)", () => {
    const forkOf = new Map(RESEARCH_PROJECTS.filter((p) => p.fork).map((p) => [p.id, p.fork!]));
    for (const p of RESEARCH_PROJECTS) {
      const forks = (p.requires ?? []).map((r) => forkOf.get(r)).filter(Boolean);
      expect(new Set(forks).size).toBe(forks.length);
    }
  });

  it("every capstone sits behind at least one prerequisite; each fork group has ≥2 siblings", () => {
    for (const p of RESEARCH_PROJECTS.filter((x) => x.capstone)) {
      expect((p.requires ?? []).length).toBeGreaterThan(0);
    }
    const groups = new Map<string, number>();
    for (const p of RESEARCH_PROJECTS) if (p.fork) groups.set(p.fork, (groups.get(p.fork) ?? 0) + 1);
    for (const [fork, n] of groups) expect(n, `fork ${fork}`).toBeGreaterThanOrEqual(2);
  });
});

describe("fork + prerequisite gating", () => {
  it("forkLockedBy: null for non-forked ids, null before a sibling is chosen, the sibling after", () => {
    expect(forkLockedBy([], "assemblyLine")).toBeNull();
    expect(forkLockedBy([], "perfHouse")).toBeNull();
    expect(forkLockedBy(["effHouse"], "perfHouse")).toBe("effHouse");
    expect(forkLockedBy(["effHouse"], "qualityHouse")).toBe("effHouse");
    // completing a fork project never locks ITSELF (the c === id skip)
    expect(forkLockedBy(["perfHouse"], "perfHouse")).toBeNull();
    // a different fork group doesn't cross-lock
    expect(forkLockedBy(["gtmHype"], "perfHouse")).toBeNull();
  });

  it("prereqsMissing lists only the unmet prerequisites, in catalog order", () => {
    expect(prereqsMissing([], "assemblyLine")).toEqual([]);
    expect(prereqsMissing([], "growthEngine")).toEqual(["brandStudio", "loyaltyProgram"]);
    expect(prereqsMissing(["brandStudio"], "growthEngine")).toEqual(["loyaltyProgram"]);
    expect(prereqsMissing(["brandStudio", "loyaltyProgram"], "growthEngine")).toEqual([]);
  });

  it("projectUnlocked: needs not-done + no fork lock + all prerequisites", () => {
    expect(projectUnlocked([], "assemblyLine")).toBe(true);
    expect(projectUnlocked(["assemblyLine"], "assemblyLine")).toBe(false); // already done
    expect(projectUnlocked([], "overclockLab")).toBe(false); // requires perfHouse
    expect(projectUnlocked(["perfHouse"], "overclockLab")).toBe(true);
    expect(projectUnlocked(["effHouse"], "perfHouse")).toBe(false); // fork sibling chosen
    // choosing a house makes the OTHER houses' tier-2 projects permanently unreachable
    expect(projectUnlocked(["effHouse"], "overclockLab")).toBe(false);
  });

  it("every non-forked project is reachable through some completion order", () => {
    // Greedy closure: repeatedly research anything unlocked. Everything without a fork (or with a
    // satisfiable fork route) must eventually complete except fork siblings we didn't choose.
    const completed: ProjectId[] = [];
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const p of RESEARCH_PROJECTS) {
        if (projectUnlocked(completed, p.id)) {
          completed.push(p.id);
          progressed = true;
        }
      }
    }
    // FIXED (was a characterized bug): completableProjectCount() used to count ALL doctrine tier-2
    // projects (overclockLab / enduranceCells / zeroDefectLine are non-forked), but each requires a
    // mutually-exclusive House, so only ONE is ever reachable per run. The count now equals the true
    // per-run maximum — exactly what a legal greedy completion achieves (the doctrine trio is
    // symmetric, so any House choice reaches the same total).
    expect(completed.length).toBe(completableProjectCount());
    for (const p of RESEARCH_PROJECTS.filter((x) => !x.fork && !x.requires)) {
      expect(completed).toContain(p.id);
    }
    // exactly one doctrine tier-2 project completes (the chosen House's)
    const tier2 = ["overclockLab", "enduranceCells", "zeroDefectLine"] as const;
    expect(tier2.filter((id) => completed.includes(id)).length).toBe(1);
  });

  it("completableProjectCount = true per-run maximum: one per fork group AND only the chosen House's tier-2", () => {
    const forks = new Set(RESEARCH_PROJECTS.filter((p) => p.fork).map((p) => p.fork!));
    const nonForked = RESEARCH_PROJECTS.filter((p) => !p.fork).length;
    // In the current catalog exactly 2 of the 3 doctrine tier-2 projects are locked out per run,
    // so the count sits 2 below the naive "non-forked + one per fork" figure.
    expect(completableProjectCount()).toBe(nonForked + forks.size - 2);
    expect(completableProjectCount()).toBeLessThan(RESEARCH_PROJECTS.length);
  });

  it("the Full R&D target is achievable by a legal completion set (greedy closure per House choice)", () => {
    // For EVERY engineering-House choice, a run that picks that House and then greedily researches
    // everything unlockable must land exactly on completableProjectCount() — the achievement is
    // earnable regardless of which doctrine the player commits to.
    for (const house of ["perfHouse", "effHouse", "qualityHouse"] as const) {
      const completed: ProjectId[] = [house];
      let progressed = true;
      while (progressed) {
        progressed = false;
        for (const p of RESEARCH_PROJECTS) {
          if (projectUnlocked(completed, p.id)) {
            completed.push(p.id);
            progressed = true;
          }
        }
      }
      expect(completed.length, `house ${house}`).toBe(completableProjectCount());
    }
  });

  it("projectById and hasProject resolve", () => {
    expect(projectById("qaLab").name).toBe("QA Lab");
    expect(hasProject(["qaLab"], "qaLab")).toBe(true);
    expect(hasProject(["qaLab"], "leanSupply")).toBe(false);
  });
});

describe("doctrineSummary", () => {
  it("is empty with no doctrine, names one, and joins several with 'and'", () => {
    expect(doctrineSummary([])).toBe("");
    expect(doctrineSummary(["assemblyLine", "qaLab"])).toBe(""); // non-doctrine projects don't count
    expect(doctrineSummary(["perfHouse"])).toBe("It was built as a Performance house.");
    expect(doctrineSummary(["perfHouse", "gtmDesign"])).toBe(
      "It was built as a Performance house and a Design-led brand.",
    );
    expect(doctrineSummary(["perfHouse", "gtmDesign", "opsSpeed"])).toBe(
      "It was built as a Performance house, a Design-led brand and a Speed operation.",
    );
  });
});

describe("weekly RP economy", () => {
  const r = BALANCE.research;

  it("a solo founder trickles rpFounderBase × the era multiplier", () => {
    expect(weeklyRp([], 1)).toBeCloseTo(r.rpFounderBase * r.eraMultiplier[0], 10);
    expect(weeklyRp([], 3)).toBeCloseTo(r.rpFounderBase * r.eraMultiplier[2], 10);
  });

  it("clamps the era into the multiplier table at both ends", () => {
    const team = [staffer({ id: "a" })];
    expect(weeklyRp(team, 0)).toBe(weeklyRp(team, 1));
    expect(weeklyRp(team, -3)).toBe(weeklyRp(team, 1));
    expect(weeklyRp(team, 99)).toBe(weeklyRp(team, r.eraMultiplier.length));
  });

  it("only staff assigned to R&D contribute; RP scales linearly with the era multiplier", () => {
    const rnd = [staffer({ id: "a", assignment: "rnd" })];
    const idle = [staffer({ id: "a", assignment: "idle" })];
    expect(weeklyRp(rnd, 1)).toBeGreaterThan(weeklyRp([], 1));
    expect(weeklyRp(idle, 1)).toBeCloseTo(weeklyRp([], 1), 10);
    // the whole weekly total is × eraMultiplier, so the era ratio holds for any team
    expect(weeklyRp(rnd, 4) / weeklyRp(rnd, 1)).toBeCloseTo(r.eraMultiplier[3] / r.eraMultiplier[0], 8);
  });

  it("rpSources itemization sums exactly to weeklyRp and always leads with the founder", () => {
    const team = [
      staffer({ id: "a", assignment: "rnd" }),
      staffer({ id: "b", assignment: "rnd", role: "designer", skills: { engineering: 35, design: 80, marketing: 40 } }),
      staffer({ id: "c", assignment: "marketing" }),
    ];
    for (const era of [1, 2, 5]) {
      const sources = rpSources(team, era);
      expect(sources[0].id).toBe("founder");
      const total = sources.reduce((a, s) => a + s.rp, 0);
      expect(total).toBeCloseTo(weeklyRp(team, era), 8);
      // the marketing-assigned staffer is not a source
      expect(sources.map((s) => s.id)).toEqual(["founder", "a", "b"]);
    }
  });

  it("techRpCost converts cash R&D to RP with a hard floor", () => {
    expect(techRpCost(0)).toBe(r.minTechRp);
    expect(techRpCost(1_000)).toBe(r.minTechRp); // 1000/1400 rounds to 1 → floored
    expect(techRpCost(1_400_000)).toBe(Math.round(1_400_000 * r.rdCashToRp)); // 1000 RP
    expect(techRpCost(1_400_000)).toBeGreaterThan(r.minTechRp);
  });
});
