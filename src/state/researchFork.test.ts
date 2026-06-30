// Research-tree forks (Track D): mutually-exclusive doctrines + their permanent stat identity.
import { describe, expect, it } from "vitest";
import { newGame, buyProject, productStats, type GameState } from "./gameState.ts";
import { forkLockedBy } from "../engine/research.ts";
import { dollars } from "../engine/money.ts";
import type { Product } from "../engine/types.ts";

function game(): GameState {
  return { ...newGame(5), era: 2, researchPoints: 500 };
}
const phone = (): Product => ({
  id: "p", name: "P", category: "phone",
  // Low tiers so stats sit well below the 100 cap — the +5 doctrine bonus must be visible.
  tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
  finish: "aluminium", colorIndex: 0, price: dollars(699), designTier: 1,
  camera: { count: 1, layout: "vertical", position: "topLeft", module: "squircle", flash: true }, notch: "punch",
});

describe("research fork — Engineering Doctrine", () => {
  it("choosing a doctrine locks out its siblings", () => {
    let s = game();
    expect(forkLockedBy(s.completedProjects, "effHouse")).toBeNull();
    s = buyProject(s, "perfHouse");
    expect(s.completedProjects).toContain("perfHouse");
    // siblings are now locked
    expect(forkLockedBy(s.completedProjects, "effHouse")).toBe("perfHouse");
    expect(forkLockedBy(s.completedProjects, "qualityHouse")).toBe("perfHouse");
    // and buying a sibling is a no-op
    const after = buyProject(s, "effHouse");
    expect(after.completedProjects).not.toContain("effHouse");
  });

  it("a non-forked project is never fork-locked", () => {
    const s = buyProject(game(), "perfHouse");
    expect(forkLockedBy(s.completedProjects, "brandStudio")).toBeNull();
  });

  it("each doctrine stamps its stat identity on every product", () => {
    const baseStats = productStats(game(), phone());
    const perf = productStats(buyProject(game(), "perfHouse"), phone());
    const eff = productStats(buyProject(game(), "effHouse"), phone());
    const qual = productStats(buyProject(game(), "qualityHouse"), phone());
    expect(perf.performance).toBeGreaterThan(baseStats.performance);
    expect(eff.battery).toBeGreaterThan(baseStats.battery);
    expect(qual.quality).toBeGreaterThan(baseStats.quality);
  });

  it("the doctrine is a real fork — you can't hold two houses at once", () => {
    let s = buyProject(game(), "qualityHouse");
    s = buyProject(s, "perfHouse"); // rejected
    const houses = s.completedProjects.filter((id) => id === "perfHouse" || id === "effHouse" || id === "qualityHouse");
    expect(houses).toHaveLength(1);
  });
});
