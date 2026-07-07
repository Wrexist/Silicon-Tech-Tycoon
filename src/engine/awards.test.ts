// The Silicon Awards — pure judging over player + rival launches. Determinism and tie rules are
// the contract: same field, same winners, every time; ties go to the player, then by name.
import { describe, it, expect } from "vitest";
import { dollars } from "./money.ts";
import { judgeAwards } from "./awards.ts";
import { overallScore } from "./product.ts";
import type { LaunchedProduct, Product, Stats } from "./types.ts";
import type { RivalRelease } from "./rivalAI.ts";

function product(over: Partial<Product> = {}): Product {
  return {
    id: "p",
    name: "Aurora",
    category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(140),
    designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
    ...over,
  };
}

function launchedAt(week: number, stats: Partial<Stats> = {}, over: Partial<Product> = {}): LaunchedProduct {
  const s: Stats = { performance: 50, quality: 50, battery: 50, design: 50, ecosystem: 50, ...stats };
  return {
    product: product(over),
    stats: s,
    unitCost: dollars(67),
    launchScore: 60,
    launchedWeek: week,
    totalUnits: 400,
    weeklyUnits: [100, 100, 100, 100],
    unitsSold: 400,
    weeksElapsed: 4,
    revenueToDate: dollars(56_000),
    plannedUnits: 400,
    verdict: "solid",
  };
}

function rivalAt(week: number, overall: number, name = "Lumen 3", price = 180): RivalRelease {
  return {
    rivalId: "pomelo",
    rivalName: "Pomelo",
    week,
    category: "phone",
    product: product({ id: `r-${name}`, name, price: dollars(price) }),
    overall,
    strength: 40,
    tone: "premium" as RivalRelease["tone"],
    tagline: "shiny",
    contested: false,
  };
}

describe("judgeAwards", () => {
  it("returns null when nobody launched in the window", () => {
    expect(judgeAwards(52, [], [], "Silicon")).toBeNull();
    // A launch OUTSIDE the 52-week window doesn't count.
    expect(judgeAwards(104, [launchedAt(10)], [], "Silicon")).toBeNull();
  });

  it("judges player vs rival on real numbers, deterministically", () => {
    const strong = launchedAt(30, { performance: 90, quality: 90, battery: 90, design: 90, ecosystem: 90 }, { name: "Aurora Max" });
    const weakRival = rivalAt(20, 35);
    const a = judgeAwards(52, [strong], [weakRival], "Silicon")!;
    expect(a).toBeTruthy();
    expect(a.year).toBe(1);
    expect(a.fieldSize).toBe(2);
    const device = a.winners.find((w) => w.categoryId === "device")!;
    expect(device.byPlayer).toBe(true);
    expect(device.productName).toBe("Aurora Max");
    expect(device.score).toBe(overallScore(strong.stats, "phone"));
    // Same input → identical result (pure).
    expect(judgeAwards(52, [strong], [weakRival], "Silicon")).toEqual(a);
  });

  it("a dominant rival takes Device of the Year — losing on stage is real", () => {
    const meh = launchedAt(30, { performance: 20, quality: 20, battery: 20, design: 20, ecosystem: 20 });
    const beast = rivalAt(40, 95, "Lumen Ultra");
    const a = judgeAwards(52, [meh], [beast], "Silicon")!;
    const device = a.winners.find((w) => w.categoryId === "device")!;
    expect(device.byPlayer).toBe(false);
    expect(device.companyName).toBe("Pomelo");
    expect(a.playerWins).toBeLessThan(a.winners.length);
  });

  it("value champion rewards quality per dollar (cheap + decent beats pricey + great)", () => {
    // Rival: overall 80 at $400 → 20 value index. Player: overall ~50 at $100 → ~50.
    const cheap = launchedAt(30, {}, { name: "Aurora Lite", price: dollars(100) });
    const pricey = rivalAt(40, 80, "Lumen Pro", 400);
    const a = judgeAwards(52, [cheap], [pricey], "Silicon")!;
    const value = a.winners.find((w) => w.categoryId === "value")!;
    expect(value.byPlayer).toBe(true);
    expect(value.productName).toBe("Aurora Lite");
  });
});
