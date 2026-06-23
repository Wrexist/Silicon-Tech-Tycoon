import { describe, it, expect } from "vitest";
import { franchiseStem, brandEquity, equityPreorderBonus, equityHypeBonus, brandEquityLabel, playerFranchises, rivalLines } from "./franchise.ts";
import { dollars } from "./money.ts";
import type { LaunchedProduct, Product } from "./types.ts";

function product(name: string): Product {
  return {
    id: name, name, category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium", colorIndex: 0, price: dollars(300), designTier: 1,
    camera: { count: 2, layout: "vertical", module: "squircle", flash: true, position: "topLeft" },
    notch: "punch",
  };
}

function launched(name: string, verdict: LaunchedProduct["verdict"]): LaunchedProduct {
  return {
    product: product(name), stats: { performance: 40, quality: 40, battery: 40, design: 40, ecosystem: 40 },
    unitCost: dollars(60), launchScore: 60, launchedWeek: 0, totalUnits: 1000, weeklyUnits: [1000],
    unitsSold: 1000, weeksElapsed: 1, revenueToDate: dollars(0), plannedUnits: 1000, verdict,
  };
}

function launched2(name: string, verdict: LaunchedProduct["verdict"], week: number): LaunchedProduct {
  return { ...launched(name, verdict), launchedWeek: week };
}

describe("franchiseStem — grouping a product line", () => {
  it("strips the series token (digits, number-word, Roman numeral)", () => {
    expect(franchiseStem("Aurora One")).toBe("aurora");
    expect(franchiseStem("Aurora 2")).toBe("aurora");
    expect(franchiseStem("Aurora II")).toBe("aurora");
    expect(franchiseStem("Mark IV")).toBe("mark");
    expect(franchiseStem("Nova")).toBe("nova"); // no series → its own line
    expect(franchiseStem("")).toBe("");
  });

  it("groups a whole series under one stem", () => {
    const names = ["Aurora One", "Aurora Two", "Aurora 3", "Aurora IV"];
    const stems = new Set(names.map(franchiseStem));
    expect(stems.size).toBe(1);
    expect([...stems][0]).toBe("aurora");
  });
});

describe("brandEquity — a line's track record", () => {
  it("is zero for a brand-new line (no prior launches)", () => {
    const b = brandEquity([], "aurora");
    expect(b.equity).toBe(0);
    expect(b.entries).toBe(0);
    expect(brandEquityLabel(b)).toBe("New line");
  });

  it("a record of hits builds strong, positive equity; more hits build more", () => {
    const one = brandEquity([launched("Aurora One", "hit")], "aurora");
    const three = brandEquity(
      [launched("Aurora Three", "hit"), launched("Aurora Two", "hit"), launched("Aurora One", "hit")],
      "aurora",
    );
    expect(one.equity).toBeGreaterThan(0);
    expect(three.equity).toBeGreaterThan(one.equity); // a longer hit streak is a stronger brand
    expect(brandEquityLabel(three)).toMatch(/Established|Iconic/);
  });

  it("a recent flop tarnishes the line more than an old one (recency-weighted)", () => {
    const freshFlop = brandEquity([launched("Aurora Two", "flop"), launched("Aurora One", "hit")], "aurora");
    const oldFlop = brandEquity([launched("Aurora Two", "hit"), launched("Aurora One", "flop")], "aurora");
    expect(freshFlop.equity).toBeLessThan(oldFlop.equity);
  });

  it("only counts launches in the SAME line", () => {
    const mixed = [launched("Aurora One", "hit"), launched("Nova One", "hit")];
    expect(brandEquity(mixed, "aurora").entries).toBe(1);
    expect(brandEquity(mixed, "nova").entries).toBe(1);
  });

  it("playerFranchises groups launches into lines with equity, deepest first", () => {
    const launched = [
      launched2("Aurora Three", "hit", 30),
      launched2("Aurora Two", "solid", 20),
      launched2("Aurora One", "hit", 10),
      launched2("Zephyr One", "steady", 25),
    ];
    const lines = playerFranchises(launched);
    expect(lines).toHaveLength(2);
    expect(lines[0].stem).toBe("aurora"); // 3 entries → first
    expect(lines[0].entries).toBe(3);
    expect(lines[0].equity).toBeGreaterThan(0);
    expect(lines[0].latestName).toBe("Aurora Three"); // newest by week
    expect(lines[0].unitsSold).toBe(3000);
    expect(lines.find((l) => l.stem === "zephyr")!.entries).toBe(1);
  });

  it("rivalLines groups a rival's releases (no verdicts → quality proxy)", () => {
    const lines = rivalLines([
      { name: "Lumen One", week: 40, overall: 80, category: "phone" },
      { name: "Lumen Two", week: 50, overall: 84, category: "phone" },
      { name: "Vertex One", week: 45, overall: 60, category: "tablet" },
    ]);
    const lumen = lines.find((l) => l.stem === "lumen")!;
    expect(lumen.entries).toBe(2);
    expect(lumen.latestName).toBe("Lumen Two");
    expect(lumen.avgOverall).toBe(82);
  });

  it("bonuses are bounded and never negative", () => {
    const iconic = brandEquity([launched("Aurora Three", "hit"), launched("Aurora Two", "hit"), launched("Aurora One", "hit")], "aurora");
    expect(equityPreorderBonus(iconic.equity)).toBeGreaterThan(0);
    expect(equityPreorderBonus(iconic.equity)).toBeLessThanOrEqual(0.4);
    expect(equityHypeBonus(iconic.equity)).toBeLessThanOrEqual(0.15);
    // a tarnished line yields no positive bonus
    const tarnished = brandEquity([launched("Flopco Two", "flop"), launched("Flopco One", "flop")], "flopco");
    expect(equityPreorderBonus(tarnished.equity)).toBe(0);
    expect(equityHypeBonus(tarnished.equity)).toBe(0);
  });
});
