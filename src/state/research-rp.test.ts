// RP income breakdown (Research "income" card). The selector must always reconcile with the totals
// the rest of the sim uses, so the breakdown can never lie about where Research Points come from.
import { describe, it, expect } from "vitest";
import { newGame, weeklyRpSources, weeklyRpGen, assignStaff } from "./gameState.ts";
import { rpSources, weeklyRp } from "../engine/research.ts";

describe("rpSources (engine) reconciles with weeklyRp", () => {
  it("the itemized sources sum to the total, across eras", () => {
    const g = newGame(11);
    for (const era of [1, 2, 3, 4]) {
      const sum = rpSources(g.staff, era).reduce((a, s) => a + s.rp, 0);
      expect(sum).toBeCloseTo(weeklyRp(g.staff, era), 9);
    }
  });
  it("always includes a founder trickle line", () => {
    expect(rpSources(newGame(1).staff, 1).some((s) => s.id === "founder")).toBe(true);
  });
});

describe("weeklyRpSources (state) reconciles with weeklyRpGen", () => {
  it("the displayed sources sum to the headline +/wk (global multipliers folded in)", () => {
    const g = newGame(7); // founder defaults to the R&D assignment
    const sum = weeklyRpSources(g).reduce((a, s) => a + s.rp, 0);
    expect(sum).toBeCloseTo(weeklyRpGen(g), 6);
    expect(weeklyRpSources(g)[0].rp).toBeGreaterThanOrEqual(weeklyRpSources(g).at(-1)!.rp); // sorted desc
  });
  it("only R&D-assigned staff contribute beyond the founder trickle", () => {
    const g = newGame(7);
    const off = assignStaff(g, "s0", "design"); // pull the founder off R&D
    const sources = weeklyRpSources(off);
    // Just the founder trickle remains (no staffer contribution lines).
    expect(sources.filter((s) => s.id !== "founder")).toHaveLength(0);
    expect(weeklyRpSources(off).reduce((a, s) => a + s.rp, 0)).toBeCloseTo(weeklyRpGen(off), 6);
  });
});

describe("Era 4 research projects — the AI Era arrives with real breakthroughs", () => {
  const probe = {
    id: "p", name: "Probe", category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium", colorIndex: 0, price: 14000, designTier: 1,
    camera: { count: 1, layout: "vertical", position: "topLeft", module: "squircle", flash: false },
    notch: "punch",
  } as unknown as import("../engine/types.ts").Product;

  it("ships exactly four era-4 breakthroughs (plus the era-4 capstone)", async () => {
    const { RESEARCH_PROJECTS } = await import("../engine/research.ts");
    const era4 = RESEARCH_PROJECTS.filter((p) => p.era === 4);
    // The four core breakthroughs (item 4.2 adds the prerequisite-gated Singularity Lab capstone).
    expect(era4.filter((p) => !p.capstone).map((p) => p.id).sort()).toEqual(["aiCopilot", "lightsOut", "neuralMarketing", "predictiveSupply"]);
    expect(era4.filter((p) => p.capstone).map((p) => p.id)).toEqual(["singularityLab"]);
    for (const p of era4) expect(p.rpCost).toBeGreaterThan(140); // above era 3's ceiling — endgame sinks
  });

  it("every effect is actually wired: stat, build weeks, unit cost, hype", async () => {
    const { buyProject, productStats, buildWeeksFor, hypeBonus, effectiveUnitCost } = await import("./gameState.ts");
    // era 4, deep RP, and legacy>0 so the first-build fast path doesn't mask the weeks effect.
    const g = { ...newGame(21), era: 4, researchPoints: 10_000, legacy: 1 };

    const withCopilot = buyProject(g, "aiCopilot");
    expect(productStats(withCopilot, probe).ecosystem - productStats(g, probe).ecosystem).toBe(4);

    const withLights = buyProject(g, "lightsOut");
    expect(buildWeeksFor(withLights)).toBe(buildWeeksFor(g) - 1);

    const withSupply = buyProject(g, "predictiveSupply");
    expect(effectiveUnitCost(withSupply, probe)).toBe(Math.round(effectiveUnitCost(g, probe) * 0.9));

    const withHype = buyProject(g, "neuralMarketing");
    expect(hypeBonus(withHype) - hypeBonus(g)).toBeCloseTo(0.25, 9);
  });
});

describe("developer keynote — the late-game repeatable RP sink", () => {
  it("spends RP for fans + reputation, caps rep at 100, repeats, and no-ops when short", async () => {
    const { hostKeynote, KEYNOTE_RP_COST, KEYNOTE_FANS } = await import("./gameState.ts");
    const g = { ...newGame(9), researchPoints: KEYNOTE_RP_COST * 2, reputation: 99.5 };
    const once = hostKeynote(g);
    expect(once.researchPoints).toBe(g.researchPoints - KEYNOTE_RP_COST);
    expect(once.fans).toBe(g.fans + KEYNOTE_FANS);
    expect(once.reputation).toBe(100); // capped
    const twice = hostKeynote(once); // repeatable while RP lasts
    expect(twice.fans).toBe(once.fans + KEYNOTE_FANS);
    expect(twice.researchPoints).toBe(0);
    const broke = { ...g, researchPoints: KEYNOTE_RP_COST - 1 };
    expect(hostKeynote(broke)).toBe(broke); // unaffordable → untouched reference
  });
});
