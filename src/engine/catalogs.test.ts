// Dedicated integrity tests for engine/catalogs.ts — the content source of truth. These are
// structural invariants (ids resolve, orderings hold, cross-references exist), NOT value pins,
// so tuning a cost or adding a tier stays painless.
import { describe, it, expect } from "vitest";
import { BALANCE } from "./balance.ts";
import { COMPONENT_LINES, CATEGORIES, CATEGORY_LIST, maxTier, tierDef } from "./catalogs.ts";
import { STAT_KEYS, type ComponentKind, type StatKey } from "./types.ts";

const KINDS = Object.keys(COMPONENT_LINES) as ComponentKind[];
const MAX_ERA = BALANCE.eras.length;

describe("COMPONENT_LINES", () => {
  it("record key matches each line's kind; tier numbers are contiguous 1-based", () => {
    for (const kind of KINDS) {
      const line = COMPONENT_LINES[kind];
      expect(line.kind).toBe(kind);
      expect(line.tiers.length).toBeGreaterThan(0);
      line.tiers.forEach((t, i) => expect(t.tier).toBe(i + 1));
    }
  });

  it("tier names are unique within a line and non-empty", () => {
    for (const kind of KINDS) {
      const names = COMPONENT_LINES[kind].tiers.map((t) => t.name);
      expect(new Set(names).size).toBe(names.length);
      for (const n of names) expect(n.length).toBeGreaterThan(0);
    }
  });

  it("costs are finite, non-negative and non-decreasing up each line; tier 1 is free to research", () => {
    for (const kind of KINDS) {
      const tiers = COMPONENT_LINES[kind].tiers;
      expect(tiers[0].rdCost).toBe(0); // every line has a free entry tier
      for (let i = 0; i < tiers.length; i++) {
        expect(Number.isFinite(tiers[i].rdCost)).toBe(true);
        expect(Number.isFinite(tiers[i].unitCost)).toBe(true);
        expect(tiers[i].rdCost).toBeGreaterThanOrEqual(0);
        expect(tiers[i].unitCost).toBeGreaterThanOrEqual(0);
        if (i > 0) {
          expect(tiers[i].rdCost).toBeGreaterThanOrEqual(tiers[i - 1].rdCost);
          expect(tiers[i].unitCost).toBeGreaterThanOrEqual(tiers[i - 1].unitCost);
        }
      }
    }
  });

  it("eras are valid, non-decreasing up each line, and every line starts in era 1", () => {
    for (const kind of KINDS) {
      const tiers = COMPONENT_LINES[kind].tiers;
      expect(tiers[0].era).toBe(1);
      for (let i = 0; i < tiers.length; i++) {
        expect(Number.isInteger(tiers[i].era)).toBe(true);
        expect(tiers[i].era).toBeGreaterThanOrEqual(1);
        expect(tiers[i].era).toBeLessThanOrEqual(MAX_ERA);
        if (i > 0) expect(tiers[i].era).toBeGreaterThanOrEqual(tiers[i - 1].era);
      }
    }
  });

  it("stat contributions use valid stat keys with values in (0, statMax]", () => {
    for (const kind of KINDS) {
      for (const t of COMPONENT_LINES[kind].tiers) {
        const entries = Object.entries(t.contributes) as [StatKey, number][];
        expect(entries.length).toBeGreaterThan(0);
        for (const [k, v] of entries) {
          expect(STAT_KEYS).toContain(k);
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThan(0);
          expect(v).toBeLessThanOrEqual(BALANCE.statMax);
        }
      }
    }
  });

  it("higher tiers never contribute less on a line's signature stat", () => {
    // A line's signature stat = the biggest contributor of its tier-1 entry.
    for (const kind of KINDS) {
      const tiers = COMPONENT_LINES[kind].tiers;
      const sig = (Object.entries(tiers[0].contributes) as [StatKey, number][])
        .sort((a, b) => b[1] - a[1])[0][0];
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].contributes[sig] ?? 0).toBeGreaterThanOrEqual(tiers[i - 1].contributes[sig] ?? 0);
      }
    }
  });

  it("software is the only global line", () => {
    for (const kind of KINDS) {
      expect(COMPONENT_LINES[kind].global).toBe(kind === "software");
    }
  });
});

describe("CATEGORIES", () => {
  const catIds = Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[];

  it("record key matches each category's id; display names are unique", () => {
    for (const id of catIds) expect(CATEGORIES[id].id).toBe(id);
    const names = catIds.map((id) => CATEGORIES[id].displayName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every slot resolves to a component line, with no duplicates", () => {
    for (const id of catIds) {
      const slots = CATEGORIES[id].slots;
      expect(slots.length).toBeGreaterThan(0);
      expect(new Set(slots).size).toBe(slots.length);
      for (const s of slots) expect(COMPONENT_LINES[s]).toBeDefined();
    }
  });

  it("statEmphasis uses valid stat keys with positive finite weights", () => {
    for (const id of catIds) {
      for (const [k, v] of Object.entries(CATEGORIES[id].statEmphasis) as [StatKey, number][]) {
        expect(STAT_KEYS).toContain(k);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThan(0);
      }
    }
  });

  it("unlockEra is a valid era, marketSize is positive, and every category is buildable at unlock", () => {
    for (const id of catIds) {
      const cat = CATEGORIES[id];
      expect(Number.isInteger(cat.unlockEra)).toBe(true);
      expect(cat.unlockEra).toBeGreaterThanOrEqual(1);
      expect(cat.unlockEra).toBeLessThanOrEqual(MAX_ERA);
      expect(cat.marketSize).toBeGreaterThan(0);
      expect(cat.marketSize).toBeLessThanOrEqual(1);
      // every slot line has at least one tier available by the category's unlock era
      for (const s of cat.slots) {
        expect(COMPONENT_LINES[s].tiers.some((t) => t.era <= cat.unlockEra)).toBe(true);
      }
    }
  });

  it("exactly one starter category, unlocked in era 1", () => {
    const starters = CATEGORY_LIST.filter((c) => c.starter);
    expect(starters).toHaveLength(1);
    expect(starters[0].unlockEra).toBe(1);
  });

  it("CATEGORY_LIST mirrors the CATEGORIES record", () => {
    expect(CATEGORY_LIST).toEqual(Object.values(CATEGORIES));
  });
});

describe("maxTier / tierDef boundaries", () => {
  it("maxTier reports the line length; tierDef is defined exactly on 1..maxTier", () => {
    for (const kind of KINDS) {
      const max = maxTier(kind);
      expect(max).toBe(COMPONENT_LINES[kind].tiers.length);
      expect(tierDef(kind, 0)).toBeUndefined();
      expect(tierDef(kind, 1)).toBeDefined();
      expect(tierDef(kind, max)).toBeDefined();
      expect(tierDef(kind, max + 1)).toBeUndefined();
      expect(tierDef(kind, 1)!.tier).toBe(1);
    }
  });
});

describe("cross-references with BALANCE.design (spec tables sized to the catalog)", () => {
  it("refreshRate caps cover every display tier and only use real options", () => {
    const rr = BALANCE.design.refreshRate;
    expect(rr.maxByDisplayTier.length).toBe(maxTier("display"));
    for (const cap of rr.maxByDisplayTier) expect(rr.options).toContain(cap);
    for (let i = 1; i < rr.maxByDisplayTier.length; i++) {
      expect(rr.maxByDisplayTier[i]).toBeGreaterThanOrEqual(rr.maxByDisplayTier[i - 1]);
    }
  });

  it("storage caps cover every software tier and only use real options", () => {
    const st = BALANCE.design.storage;
    expect(st.maxBySoftwareTier.length).toBe(maxTier("software"));
    for (const cap of st.maxBySoftwareTier) expect(st.options).toContain(cap);
    for (let i = 1; i < st.maxBySoftwareTier.length; i++) {
      expect(st.maxBySoftwareTier[i]).toBeGreaterThanOrEqual(st.maxBySoftwareTier[i - 1]);
    }
  });

  it("camera tables cover every lens count up to maxLenses", () => {
    const d = BALANCE.design;
    expect(d.cameraCountFactor.length).toBe(d.maxLenses);
    expect(BALANCE.market.aesthetics.lensCountAppeal.length).toBe(d.maxLenses);
    // lens unlock costs exist for every count above the free two
    for (let n = 3; n <= d.maxLenses; n++) {
      expect(d.lensUnlockCosts[n]).toBeGreaterThan(0);
    }
  });
});
