import { describe, it, expect } from "vitest";
import {
  RESEARCH_PROJECTS,
  projectById,
  completableProjectCount,
  techRpCost,
  launchRpReward,
  hasProject,
  type ProjectId,
} from "./research.ts";
import { BALANCE } from "./balance.ts";

describe("research catalog invariants", () => {
  it("has unique project ids", () => {
    const ids = RESEARCH_PROJECTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every project has a positive RP cost and a valid era", () => {
    for (const p of RESEARCH_PROJECTS) {
      expect(p.rpCost).toBeGreaterThan(0);
      expect(Number.isInteger(p.era)).toBe(true);
      expect(p.era).toBeGreaterThanOrEqual(1);
    }
  });

  it("the engineering-doctrine fork has exactly three mutually-exclusive members", () => {
    const doctrine = RESEARCH_PROJECTS.filter((p) => p.fork === "engDoctrine").map((p) => p.id);
    expect(doctrine.sort()).toEqual(["effHouse", "perfHouse", "qualityHouse"]);
  });
});

describe("projectById", () => {
  it("returns the matching project", () => {
    expect(projectById("assemblyLine").name).toBe("Assembly Line");
  });

  it("returns a safe placeholder for an unknown id instead of throwing", () => {
    const p = projectById("ghostProject" as ProjectId);
    expect(p.id).toBe("ghostProject");
    expect(p.name).toBe("ghostProject");
    expect(p.rpCost).toBe(0);
  });
});

describe("completableProjectCount", () => {
  it("counts every non-forked project plus one per fork group", () => {
    const forks = new Set(RESEARCH_PROJECTS.filter((p) => p.fork).map((p) => p.fork));
    const nonForked = RESEARCH_PROJECTS.filter((p) => !p.fork).length;
    expect(completableProjectCount()).toBe(nonForked + forks.size);
    // Strictly fewer than the raw list once a fork exists (siblings lock out).
    expect(completableProjectCount()).toBeLessThan(RESEARCH_PROJECTS.length);
  });
});

describe("techRpCost", () => {
  it("scales the cash R&D cost and never drops below the floor", () => {
    expect(techRpCost(0)).toBe(BALANCE.research.minTechRp);
    const big = techRpCost(100_000);
    expect(big).toBe(Math.round(100_000 * BALANCE.research.rdCashToRp));
    expect(big).toBeGreaterThanOrEqual(BALANCE.research.minTechRp);
  });
});

describe("launchRpReward", () => {
  it("only hits and solids fund research; flops and steady sellers award nothing", () => {
    expect(launchRpReward("hit")).toBe(BALANCE.research.launchRpHit);
    expect(launchRpReward("solid")).toBe(BALANCE.research.launchRpSolid);
    expect(launchRpReward("flop")).toBe(0);
    expect(launchRpReward("steady")).toBe(0);
    expect(launchRpReward("hit")).toBeGreaterThanOrEqual(launchRpReward("solid"));
  });
});

describe("hasProject", () => {
  it("reports membership in the completed list", () => {
    expect(hasProject(["qaLab"], "qaLab")).toBe(true);
    expect(hasProject(["qaLab"], "brandStudio")).toBe(false);
    expect(hasProject([], "qaLab")).toBe(false);
  });
});
