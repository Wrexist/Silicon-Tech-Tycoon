// Research capstones + prerequisites (item 4.2): the branching-tree layer. A capstone is gated behind
// its prerequisite projects (buy refused until they're done), the tree is acyclic + fully reachable,
// and each capstone stamps its compound bonus. Everything opt-in via buyProject → the sim (which never
// buys projects) is byte-identical.
import { describe, expect, it } from "vitest";
import { newGame, buyProject, productStats, effectiveUnitCost, hypeBonus, type GameState } from "./gameState.ts";
import { RESEARCH_PROJECTS, prereqsMissing, projectUnlocked, projectById, type ProjectId } from "../engine/research.ts";
import { dollars } from "../engine/money.ts";
import type { Product } from "../engine/types.ts";

const rich = (era = 4): GameState => ({ ...newGame(5), era, researchPoints: 100_000 });
const phone = (): Product => ({
  id: "p", name: "P", category: "phone",
  tiers: { chip: 2, display: 2, battery: 2, materials: 2, software: 2, camera: 2 },
  finish: "aluminium", colorIndex: 0, price: dollars(699), designTier: 2,
  camera: { count: 1, layout: "vertical", position: "topLeft", module: "squircle", flash: true }, notch: "punch",
});

describe("research prerequisites (item 4.2)", () => {
  it("a capstone is refused until every prerequisite is completed", () => {
    let s = rich();
    const cap = projectById("singularityLab");
    expect(cap.requires).toEqual(["aiCopilot", "neuralMarketing"]);
    // Buying the capstone directly is a no-op while prereqs are missing.
    expect(prereqsMissing(s.completedProjects, "singularityLab")).toHaveLength(2);
    s = buyProject(s, "singularityLab");
    expect(s.completedProjects).not.toContain("singularityLab");
    // Complete the prereqs, then it unlocks and buys.
    s = buyProject(s, "aiCopilot");
    s = buyProject(s, "neuralMarketing");
    expect(projectUnlocked(s.completedProjects, "singularityLab")).toBe(true);
    s = buyProject(s, "singularityLab");
    expect(s.completedProjects).toContain("singularityLab");
  });

  it("capstones stamp their compound bonus", () => {
    const base = rich();
    // Singularity Lab: +3 Ecosystem + hype.
    let s = buyProject(buyProject(buyProject(rich(), "aiCopilot"), "neuralMarketing"), "singularityLab");
    expect(productStats(s, phone()).ecosystem).toBeGreaterThan(productStats(base, phone()).ecosystem);
    expect(hypeBonus(s)).toBeGreaterThan(hypeBonus(base));
    // Platform Dominance: cheaper units.
    let p = buyProject(buyProject(buyProject(rich(3), "globalDistribution"), "verticalIntegration"), "platformDominance");
    expect(effectiveUnitCost(p, phone())).toBeLessThan(effectiveUnitCost(rich(3), phone()));
  });
});

describe("research tree reachability (item 4.2)", () => {
  it("every prerequisite references a real project (no dangling ids)", () => {
    const ids = new Set(RESEARCH_PROJECTS.map((p) => p.id));
    for (const p of RESEARCH_PROJECTS) for (const r of p.requires ?? []) expect(ids.has(r)).toBe(true);
  });

  it("the prerequisite graph is acyclic and every project is reachable", () => {
    // Topological reachability: repeatedly mark projects whose prereqs are all already reachable.
    const reachable = new Set<ProjectId>();
    let grew = true;
    while (grew) {
      grew = false;
      for (const p of RESEARCH_PROJECTS) {
        if (reachable.has(p.id)) continue;
        if ((p.requires ?? []).every((r) => reachable.has(r))) { reachable.add(p.id); grew = true; }
      }
    }
    // If anything is unreachable, its prereqs form a cycle (or an unreachable chain) — fail loudly.
    for (const p of RESEARCH_PROJECTS) expect(reachable.has(p.id)).toBe(true);
  });

  it("a prerequisite always sits at an era ≤ the project that needs it", () => {
    for (const p of RESEARCH_PROJECTS) for (const r of p.requires ?? []) {
      expect(projectById(r).era).toBeLessThanOrEqual(p.era);
    }
  });
});
