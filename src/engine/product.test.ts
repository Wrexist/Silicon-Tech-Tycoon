// Dedicated characterization tests for engine/product.ts — the core product-stat math.
// These pin what the code demonstrably does today (boundaries, defaults, NaN defenses),
// complementing the broader integration coverage in engine.test.ts.
import { describe, it, expect } from "vitest";
import { dollars, toDollars, ZERO } from "./money.ts";
import { BALANCE } from "./balance.ts";
import { CATEGORIES, maxTier, tierDef } from "./catalogs.ts";
import {
  maxRefreshRate,
  effectiveRefreshRate,
  maxStorage,
  effectiveStorage,
  computeStats,
  tuningCostMultiplier,
  buildCost,
  missingSlots,
  overallScore,
  componentSynergy,
  SYNERGY_ARCHETYPES,
  activeArchetypes,
  archetypeBonus,
} from "./product.ts";
import { STAT_KEYS, type Product, type Stats, type ComponentKind } from "./types.ts";

function phone(opts: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Test",
    category: "phone",
    tiers: { chip: 3, display: 3, battery: 3, materials: 3, software: 2, camera: 2 },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(600),
    designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
    ...opts,
  };
}

describe("maxRefreshRate / effectiveRefreshRate boundaries", () => {
  const caps = BALANCE.design.refreshRate.maxByDisplayTier;

  it("indexes the per-display-tier cap table, clamped at both ends", () => {
    expect(maxRefreshRate(1)).toBe(caps[0]);
    expect(maxRefreshRate(caps.length)).toBe(caps[caps.length - 1]);
    // out-of-range tiers clamp instead of reading past the array
    expect(maxRefreshRate(0)).toBe(caps[0]);
    expect(maxRefreshRate(-5)).toBe(caps[0]);
    expect(maxRefreshRate(caps.length + 10)).toBe(caps[caps.length - 1]);
  });

  it("defaults a missing refreshRate to 60 and a missing display tier to tier 1", () => {
    const p = phone({ refreshRate: undefined, tiers: { chip: 1 } }); // no display tier chosen
    expect(effectiveRefreshRate(p)).toBe(60);
  });

  it("caps the chosen rate by the display tier, then snaps DOWN to a real option", () => {
    const hiPanel = phone({ refreshRate: 144, tiers: { ...phone().tiers, display: 7 } });
    expect(effectiveRefreshRate(hiPanel)).toBe(144);
    const loPanel = phone({ refreshRate: 144, tiers: { ...phone().tiers, display: 1 } });
    expect(effectiveRefreshRate(loPanel)).toBe(60);
    // 100Hz isn't an option — snaps down to 90, never silently to the 60 baseline
    const odd = phone({ refreshRate: 100, tiers: { ...phone().tiers, display: 7 } });
    expect(effectiveRefreshRate(odd)).toBe(90);
    // below the lowest option, the reducer falls back to the first option
    const tiny = phone({ refreshRate: 30, tiers: { ...phone().tiers, display: 7 } });
    expect(effectiveRefreshRate(tiny)).toBe(BALANCE.design.refreshRate.options[0]);
  });
});

describe("maxStorage / effectiveStorage boundaries", () => {
  const caps = BALANCE.design.storage.maxBySoftwareTier;

  it("indexes the per-software-tier cap table, clamped at both ends", () => {
    expect(maxStorage(1)).toBe(caps[0]);
    expect(maxStorage(caps.length)).toBe(caps[caps.length - 1]);
    expect(maxStorage(0)).toBe(caps[0]);
    expect(maxStorage(caps.length + 3)).toBe(caps[caps.length - 1]);
  });

  it("defaults missing storage to 128 and snaps odd values down to a supported option", () => {
    expect(effectiveStorage(phone({ storage: undefined }))).toBe(128);
    // 300GB (legacy/odd) snaps down to 256, given an OS tier that allows it
    const odd = phone({ storage: 300, tiers: { ...phone().tiers, software: 3 } });
    expect(effectiveStorage(odd)).toBe(256);
    // a terabyte on a tier-1 OS is capped to that tier's max
    const capped = phone({ storage: 1024, tiers: { ...phone().tiers, software: 1 } });
    expect(effectiveStorage(capped)).toBe(caps[0]);
  });
});

describe("computeStats", () => {
  it("skips unset and out-of-range component tiers identically", () => {
    // tier 99 has no tierDef → the slot contributes nothing, same as leaving it unset
    const missing = computeStats(phone({ tiers: { chip: undefined, display: 3, battery: 3, materials: 3, software: 2, camera: 2 } }));
    const outOfRange = computeStats(phone({ tiers: { chip: 99, display: 3, battery: 3, materials: 3, software: 2, camera: 2 } }));
    expect(outOfRange).toEqual(missing);
    expect(tierDef("chip", 99)).toBeUndefined();
  });

  it("scales the camera contribution by lens count (clamped to 1..4)", () => {
    const mk = (count: number) =>
      computeStats(phone({ camera: { ...phone().camera, count } }));
    const one = mk(1);
    const four = mk(4);
    expect(four.quality).toBeGreaterThan(one.quality);
    // out-of-range counts clamp to the table's ends
    expect(mk(0)).toEqual(mk(1));
    expect(mk(9)).toEqual(mk(4));
    // an unset camera object path: count defaults to 2
    expect(mk(2)).toEqual(computeStats(phone()));
  });

  it("bakes the manufacturing defect penalty into quality", () => {
    const clean = computeStats(phone());
    const defective = computeStats(phone({ defectPenalty: 10 }));
    expect(defective.quality).toBe(Math.max(0, clean.quality - 10));
  });

  it("supplier quality delta lifts or drags quality (standard/unset is neutral)", () => {
    // use a mid build whose quality sits well inside 0..100, so the delta is visible past the clamp
    const tiers = { chip: 2, display: 2, battery: 2, materials: 2, software: 2, camera: 1 };
    const neutral = computeStats(phone({ tiers }));
    expect(computeStats(phone({ tiers, supplierId: "standard" }))).toEqual(neutral);
    expect(computeStats(phone({ tiers, supplierId: "bargain" })).quality).toBe(neutral.quality - 5);
    expect(computeStats(phone({ tiers, supplierId: "novacore" })).quality).toBe(neutral.quality + 6);
  });

  it("phones have no subsystem, so the subsystem field is a no-op there", () => {
    expect(computeStats(phone({ subsystem: 2 }))).toEqual(computeStats(phone()));
  });

  it("returns rounded integers clamped to 0..statMax on every stat", () => {
    const s = computeStats(phone({ tiers: { chip: 7, display: 7, battery: 7, materials: 6, software: 6, camera: 6 }, designTier: 20 }));
    for (const k of STAT_KEYS) {
      expect(Number.isInteger(s[k])).toBe(true);
      expect(s[k]).toBeGreaterThanOrEqual(0);
      expect(s[k]).toBeLessThanOrEqual(BALANCE.statMax);
    }
  });

  it("an empty build (no tiers) still yields all-finite, in-range stats", () => {
    const s = computeStats(phone({ tiers: {} }));
    for (const k of STAT_KEYS) {
      expect(Number.isFinite(s[k])).toBe(true);
      expect(s[k]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("tuningCostMultiplier", () => {
  it("maps value/premium to the balance table and everything else to exactly 1", () => {
    expect(tuningCostMultiplier("value")).toBe(BALANCE.design.tuningCostMult.value);
    expect(tuningCostMultiplier("premium")).toBe(BALANCE.design.tuningCostMult.premium);
    expect(tuningCostMultiplier("balanced")).toBe(1);
    expect(tuningCostMultiplier("performance")).toBe(1);
    expect(tuningCostMultiplier("efficiency")).toBe(1);
    expect(tuningCostMultiplier(undefined)).toBe(1);
  });
});

describe("buildCost", () => {
  it("adds extra-lens cost per lens beyond the first (camera categories only)", () => {
    const base = buildCost(phone({ camera: { ...phone().camera, count: 1 } }));
    const quad = buildCost(phone({ camera: { ...phone().camera, count: 4 } }));
    expect(quad - base).toBe(3 * BALANCE.design.extraLensCost);
    // desktop has no camera slot → lens count is irrelevant
    const desk = (count: number) =>
      buildCost(phone({ category: "desktop", tiers: { chip: 2, materials: 2, software: 2 }, camera: { ...phone().camera, count } }));
    expect(desk(4)).toBe(desk(1));
  });

  it("charges the default 2-lens camera's extra lens even with zero components selected (characterized)", () => {
    // With no tiers chosen the component sum is ZERO, but the camera slot exists on a phone and the
    // default lens count is 2 → exactly one extraLensCost is still charged. Documented as-is.
    const empty = buildCost(phone({ tiers: {} }));
    expect(empty).toBe(BALANCE.design.extraLensCost);
    // a categoryless-camera build with count 1 genuinely costs zero
    expect(buildCost(phone({ tiers: {}, camera: { ...phone().camera, count: 1 } }))).toBe(ZERO);
  });

  it("applies the supplier cost multiplier to the whole component sum", () => {
    const std = buildCost(phone());
    const bargain = buildCost(phone({ supplierId: "bargain" }));
    const vertex = buildCost(phone({ supplierId: "vertex" }));
    expect(toDollars(bargain)).toBeLessThan(toDollars(std));
    expect(toDollars(vertex)).toBeGreaterThan(toDollars(std));
    expect(bargain).toBe(Math.round(std * 0.82));
  });

  it("dual-sourcing adds the resilience premium on top of the supplier price", () => {
    const single = buildCost(phone());
    const dual = buildCost(phone({ dualSource: true }));
    expect(dual).toBe(Math.round(single * (1 + BALANCE.supply.dualSource.costPremium)));
  });

  it("refresh + storage steps each add their per-unit cost", () => {
    const base = phone({ tiers: { chip: 3, display: 7, battery: 3, materials: 3, software: 6, camera: 2 } });
    const specced = phone({
      tiers: base.tiers,
      refreshRate: 144, // 3 steps above 60
      storage: 2048,    // 4 steps above 128
    });
    const delta = buildCost(specced) - buildCost(base);
    expect(delta).toBe(3 * BALANCE.design.refreshRate.unitCost + 4 * BALANCE.design.storage.unitCost);
  });
});

describe("missingSlots / overallScore", () => {
  it("missingSlots lists exactly the category slots without a chosen tier", () => {
    expect(missingSlots(phone())).toEqual([]);
    expect(missingSlots(phone({ tiers: {} }))).toEqual(CATEGORIES.phone.slots);
    expect(missingSlots(phone({ tiers: { chip: 1, software: 2 } }))).toEqual(
      CATEGORIES.phone.slots.filter((k) => k !== "chip" && k !== "software"),
    );
  });

  it("overallScore of a uniform stat profile equals that value for every category", () => {
    const uniform = (v: number): Stats =>
      ({ performance: v, quality: v, battery: v, design: v, ecosystem: v });
    for (const cat of Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]) {
      expect(overallScore(uniform(50), cat)).toBe(50);
      expect(overallScore(uniform(0), cat)).toBe(0);
      expect(overallScore(uniform(100), cat)).toBe(100);
    }
  });
});

describe("componentSynergy — NaN defense (product.ts lines ~204-207)", () => {
  it("treats a non-finite tier as 0 — identical to leaving the slot unset", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const withBad = componentSynergy(phone({ tiers: { chip: bad as number, display: 3, battery: 3, materials: 3, software: 2, camera: 2 } }));
      const withUnset = componentSynergy(phone({ tiers: { chip: undefined, display: 3, battery: 3, materials: 3, software: 2, camera: 2 } }));
      expect(withBad).toEqual(withUnset);
      expect(Number.isFinite(withBad.factor)).toBe(true);
    }
  });

  it("a NaN tier becomes the weakest link when the rest of the build is strong", () => {
    const r = componentSynergy(phone({ tiers: { chip: NaN as number, display: 6, battery: 6, materials: 5, software: 5, camera: 5 } }));
    expect(r.weakest).toBe("chip");
    expect(r.factor).toBe(BALANCE.market.synergy.minFactor); // a zeroed slot vs a near-max build bottoms out
  });

  it("negative tiers clamp to 0 rather than pushing the level below the range", () => {
    const neg = componentSynergy(phone({ tiers: { chip: -3, display: 3, battery: 3, materials: 3, software: 2, camera: 2 } }));
    const zero = componentSynergy(phone({ tiers: { chip: 0 as number, display: 3, battery: 3, materials: 3, software: 2, camera: 2 } }));
    expect(neg).toEqual(zero);
  });
});

describe("synergy archetypes", () => {
  it("catalog integrity: unique ids, valid kinds/categories, positive bonuses", () => {
    const ids = SYNERGY_ARCHETYPES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const validKinds = new Set<ComponentKind>(["chip", "display", "battery", "materials", "software", "camera"]);
    for (const a of SYNERGY_ARCHETYPES) {
      expect(a.kinds.length).toBeGreaterThanOrEqual(2);
      for (const k of a.kinds) expect(validKinds.has(k)).toBe(true);
      for (const v of Object.values(a.bonus)) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v!).toBeGreaterThan(0);
      }
      // a category-restricted archetype must be buildable in every category it names
      for (const cat of a.categories ?? []) {
        expect(CATEGORIES[cat]).toBeDefined();
        for (const k of a.kinds) expect(CATEGORIES[cat].slots).toContain(k);
      }
    }
  });

  it("unlock requires EVERY kind at a high tier; a category-signature archetype never fires elsewhere", () => {
    const maxed = phone({ tiers: { chip: 7, display: 7, battery: 7, materials: 6, software: 6, camera: 6 } });
    const active = activeArchetypes(maxed).map((a) => a.id);
    // all five universal archetypes unlock on a fully-maxed phone…
    for (const id of ["flagship", "imaging", "endurance", "crafted", "unified"]) expect(active).toContain(id);
    // …but no category-restricted one does (workstation is laptop/desktop-only, etc.)
    for (const a of SYNERGY_ARCHETYPES.filter((x) => x.categories)) expect(active).not.toContain(a.id);
    // one budget component in a pairing kills that archetype
    const weakChip = phone({ tiers: { chip: 1, display: 7, battery: 7, materials: 6, software: 6, camera: 6 } });
    expect(activeArchetypes(weakChip).map((a) => a.id)).not.toContain("flagship");
  });

  it("a NaN tier never reads as high-tier", () => {
    const p = phone({ tiers: { chip: NaN as number, display: 7, battery: 7, materials: 6, software: 6, camera: 6 } });
    const ids = activeArchetypes(p).map((a) => a.id);
    expect(ids).not.toContain("flagship"); // needs chip high
    expect(ids).toContain("crafted"); // materials+display are unaffected
  });

  it("archetypeBonus caps the summed bonus at maxTotalBonus", () => {
    const maxed = phone({ tiers: { chip: 7, display: 7, battery: 7, materials: 6, software: 6, camera: 6 } });
    const bonus = archetypeBonus(maxed);
    const total = Object.values(bonus).reduce((a, b) => a + (b ?? 0), 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(BALANCE.design.archetype.maxTotalBonus);
    // and a build with no unlocked archetypes contributes nothing
    expect(archetypeBonus(phone({ tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 } }))).toEqual({});
  });

  it("high-tier threshold is era-robust: ceil(maxTier × highTierFrac) per line", () => {
    const frac = BALANCE.design.archetype.highTierFrac;
    const chipBar = Math.ceil(maxTier("chip") * frac);
    // exactly at the bar unlocks; one below does not (display held at max so only chip gates flagship)
    const at = phone({ tiers: { chip: chipBar, display: 7, battery: 1, materials: 1, software: 1, camera: 1 } });
    const below = phone({ tiers: { chip: chipBar - 1, display: 7, battery: 1, materials: 1, software: 1, camera: 1 } });
    expect(activeArchetypes(at).map((a) => a.id)).toContain("flagship");
    expect(activeArchetypes(below).map((a) => a.id)).not.toContain("flagship");
  });
});
