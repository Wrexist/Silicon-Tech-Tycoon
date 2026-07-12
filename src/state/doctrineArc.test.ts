// Doctrines across the arc (item 4.4): a tier-2 doctrine project unlocks ONLY once the matching House
// is chosen (via 4.2 prerequisites), stamps a deeper stat bump, and the epilogue names the doctrine.
import { describe, expect, it } from "vitest";
import { newGame, buyProject, productStats, type GameState } from "./gameState.ts";
import { prereqsMissing, doctrineSummary } from "../engine/research.ts";
import { campaignEpilogue } from "../engine/epilogue.ts";
import { dollars } from "../engine/money.ts";
import type { Product } from "../engine/types.ts";

const rich = (): GameState => ({ ...newGame(6), era: 3, researchPoints: 2000 });
const phone = (): Product => ({
  id: "p", name: "P", category: "phone",
  tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
  finish: "aluminium", colorIndex: 0, price: dollars(699), designTier: 1,
  camera: { count: 1, layout: "vertical", position: "topLeft", module: "squircle", flash: true }, notch: "punch",
});

describe("doctrine tier-2 projects (item 4.4)", () => {
  it("a tier-2 doctrine unlocks only after its House is chosen", () => {
    let s = rich();
    // Overclock Lab requires the Performance House.
    expect(prereqsMissing(s.completedProjects, "overclockLab")).toEqual(["perfHouse"]);
    s = buyProject(s, "overclockLab"); // refused — no house yet
    expect(s.completedProjects).not.toContain("overclockLab");
    s = buyProject(rich(), "perfHouse");
    expect(prereqsMissing(s.completedProjects, "overclockLab")).toEqual([]);
    s = buyProject(s, "overclockLab");
    expect(s.completedProjects).toContain("overclockLab");
  });

  it("choosing a rival House leaves the other doctrines' tier-2 locked (fork exclusivity)", () => {
    const s = buyProject(rich(), "effHouse"); // committed to Efficiency
    // Endurance Cells (its own tier-2) is unlocked; the Performance/Reliability ones are not.
    expect(prereqsMissing(s.completedProjects, "enduranceCells")).toEqual([]);
    expect(prereqsMissing(s.completedProjects, "overclockLab")).toEqual(["perfHouse"]);
    expect(buyProject(s, "overclockLab").completedProjects).not.toContain("overclockLab");
  });

  it("the tier-2 doctrine stamps a deeper stat bump on every product", () => {
    const house = buyProject(rich(), "perfHouse");
    const deeper = buyProject(house, "overclockLab");
    expect(productStats(deeper, phone()).performance).toBeGreaterThan(productStats(house, phone()).performance);
  });
});

describe("doctrine epilogue clause (item 4.4)", () => {
  it("names the committed Houses, and is silent for an unforked run", () => {
    expect(doctrineSummary([])).toBe("");
    expect(doctrineSummary(["perfHouse"])).toContain("Performance");
    const both = doctrineSummary(["perfHouse", "gtmDesign"]);
    expect(both).toContain("Performance");
    expect(both).toContain("Design");
  });

  it("the clause appears in the epilogue only when a doctrine was chosen", () => {
    const base = { companyName: "Nova", reputation: 90, rank: 1, valuationDollars: 6e9, products: 12, fans: 5000, legacy: 0 };
    const plain = campaignEpilogue(base);
    const withDoctrine = campaignEpilogue({ ...base, doctrine: doctrineSummary(["qualityHouse"]) });
    expect(withDoctrine.length).toBeGreaterThan(plain.length);
    expect(withDoctrine).toContain("Reliability");
    expect(plain).not.toContain("Reliability");
  });
});
