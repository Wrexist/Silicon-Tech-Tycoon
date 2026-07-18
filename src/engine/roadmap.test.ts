import { describe, expect, it } from "vitest";
import { eraRoadmap, eraEntryGate } from "./roadmap.ts";
import { BALANCE } from "./balance.ts";
import { CATEGORY_LIST } from "./catalogs.ts";
import { RESEARCH_PROJECTS } from "./research.ts";

describe("eraEntryGate", () => {
  it("era 1 is the start — no gate", () => {
    expect(eraEntryGate(1)).toBeNull();
  });

  it("era 2 is an either/or reputation-or-revenue milestone read from balance", () => {
    // Advancing FROM era 1 uses era-1's bars (35 rep / $500K), either/or.
    expect(eraEntryGate(2)).toBe("Reputation 35 or $500K revenue");
  });

  it("era 3 and 4 require BOTH bars, read from the previous era", () => {
    expect(eraEntryGate(3)).toBe("Reputation 60 and $8M revenue");
    expect(eraEntryGate(4)).toBe("Reputation 80 and $80M revenue");
  });

  it("the Autonomy Era states its going-public + Frontier-Tech gate, never rep/rev", () => {
    const gate = eraEntryGate(BALANCE.autonomyEra.era);
    expect(gate).toMatch(/public/i);
    expect(gate).toContain(`tier ${BALANCE.autonomyEra.tierToAdvance}`);
  });
});

describe("eraRoadmap", () => {
  const rows = eraRoadmap();

  it("has one row per era in balance, in order", () => {
    expect(rows.map((r) => r.era)).toEqual(BALANCE.eras.map((e) => e.era));
  });

  it("surfaces the garage's starter categories with a null gate", () => {
    const era1 = rows.find((r) => r.era === 1)!;
    expect(era1.gate).toBeNull();
    expect(era1.newCategories).toContain("Phone");
    expect(era1.newCategories).toContain("Tablet");
  });

  it("lists categories AT each era (not carried forward from earlier eras)", () => {
    for (const r of rows) {
      const expected = CATEGORY_LIST.filter((c) => c.unlockEra === r.era).map((c) => c.displayName);
      expect(r.newCategories).toEqual(expected);
    }
    // Later-era frontier categories appear only at their own era, never leaked into an earlier row.
    const era1 = rows.find((r) => r.era === 1)!;
    expect(era1.newCategories).not.toContain("Home Robot");
    expect(rows.find((r) => r.era === 5)!.newCategories).toEqual(
      expect.arrayContaining(["Neural Band", "Home Robot"]),
    );
  });

  it("names each era's capstone research (and only its own)", () => {
    const era4 = rows.find((r) => r.era === 4)!;
    const capstoneNames = RESEARCH_PROJECTS.filter((p) => p.capstone && p.era === 4).map((p) => p.name);
    expect(era4.notableResearch).toEqual(capstoneNames);
    expect(era4.notableResearch).toContain("Singularity Lab");
    // Era 1 has no capstone.
    expect(rows.find((r) => r.era === 1)!.notableResearch).toEqual([]);
  });

  it("attaches the major systems each era opens (Platform / IPO / Frontier)", () => {
    expect(rows.find((r) => r.era === 3)!.majorSystems).toContain("Platform / OS division");
    expect(rows.find((r) => r.era === 4)!.majorSystems.join(" ")).toMatch(/IPO/i);
    expect(rows.find((r) => r.era === 5)!.majorSystems.join(" ")).toMatch(/Frontier/i);
  });

  it("every row carries an authored tagline", () => {
    for (const r of rows) expect(r.tagline.length).toBeGreaterThan(0);
  });
});
