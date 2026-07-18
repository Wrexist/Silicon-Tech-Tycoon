import { describe, it, expect } from "vitest";
import type { LaunchedProduct, CategoryId } from "./types.ts";
import {
  franchiseMastery,
  franchiseMasteryForName,
  franchiseBoonForName,
  closestUnqualifiedLine,
  dominantCategory,
  boonIdForCategory,
  FRANCHISE_BOONS,
  FRANCHISE_MASTERY_MIN_ENTRIES,
  ZERO_FRANCHISE_BOON,
} from "./franchiseMastery.ts";
import { CATEGORY_LIST } from "./catalogs.ts";

// A minimal launch record — only the fields franchise mastery reads (name → stem, category, verdict).
function launch(name: string, category: CategoryId, verdict?: LaunchedProduct["verdict"]): LaunchedProduct {
  return { product: { name, category }, verdict } as unknown as LaunchedProduct;
}

/** N hit entries in one line (same stem, given category). 5 hits → Iconic (equity clamps to 1). */
function line(stem: string, n: number, category: CategoryId, verdict: LaunchedProduct["verdict"] = "hit"): LaunchedProduct[] {
  return Array.from({ length: n }, (_, i) => launch(`${stem} ${i + 1}`, category, verdict));
}

describe("franchiseMastery — qualification (≥5 entries AND Iconic)", () => {
  it("5 hit entries in a line qualifies", () => {
    const l = franchiseMasteryForName(line("Nova", 5, "phone"), "Nova 6");
    expect(l).not.toBeNull();
    expect(l!.entries).toBe(5);
    expect(l!.iconic).toBe(true);
    expect(l!.qualified).toBe(true);
  });

  it("4 entries does NOT qualify (depth gate), even if Iconic-strength", () => {
    const l = franchiseMasteryForName(line("Nova", 4, "phone"), "Nova 5");
    expect(l!.entries).toBe(4);
    expect(l!.qualified).toBe(false);
    expect(l!.remaining).toBe(1);
  });

  it("5 flop entries does NOT qualify (quality gate — never reaches Iconic)", () => {
    const l = franchiseMasteryForName(line("Dud", 5, "phone", "flop"), "Dud 6");
    expect(l!.entries).toBe(5);
    expect(l!.iconic).toBe(false);
    expect(l!.qualified).toBe(false);
  });

  it("remaining counts entries to the depth gate and floors at 0", () => {
    expect(franchiseMasteryForName(line("A", 1, "phone"), "A 2")!.remaining).toBe(FRANCHISE_MASTERY_MIN_ENTRIES - 1);
    expect(franchiseMasteryForName(line("A", 5, "phone"), "A 6")!.remaining).toBe(0);
    expect(franchiseMasteryForName(line("A", 8, "phone"), "A 9")!.remaining).toBe(0);
  });

  it("a blank / stem-less name has no line", () => {
    expect(franchiseMasteryForName([], "")).toBeNull();
    expect(franchiseMasteryForName(line("Nova", 5, "phone"), "")).toBeNull();
  });

  it("ignores malformed records without throwing", () => {
    const bad = [{ verdict: "hit" }, { product: {} }, null, undefined] as unknown as LaunchedProduct[];
    expect(() => franchiseMastery(bad)).not.toThrow();
    expect(franchiseMastery(bad)).toEqual([]);
  });
});

describe("franchiseMastery — boon assignment is stable + category-keyed", () => {
  it("every category maps to exactly one boon, and the lookup is total", () => {
    for (const c of CATEGORY_LIST) {
      const id = boonIdForCategory(c.id);
      expect(FRANCHISE_BOONS[id]).toBeDefined();
    }
  });

  it("the same line always earns the same boon (dominant category is stable)", () => {
    const a = franchiseMasteryForName(line("Nova", 5, "phone"), "Nova 6")!.boon;
    const b = franchiseMasteryForName(line("Nova", 5, "phone"), "Nova 6")!.boon;
    expect(a.id).toBe(b.id);
    // phone → Heritage Halo per the fixed mapping.
    expect(a.id).toBe("heritageHalo");
  });

  it("boon follows the DOMINANT category of the line", () => {
    // 3 laptops + 2 phones → laptop dominates → Trusted Name.
    const mixed = [...line("Mix", 3, "laptop"), ...line("Mix", 2, "phone").map((lp) => ({ ...lp, product: { ...lp.product, name: "Mix x" } }))];
    // Rename so all share the "mix" stem.
    const entries = mixed.map((lp, i) => launch("Mix " + (i + 1), lp.product.category as CategoryId, "hit"));
    expect(dominantCategory(entries)).toBe("laptop");
    expect(franchiseMasteryForName(entries, "Mix 6")!.boon.id).toBe("trustedName");
  });

  it("each boon touches exactly ONE axis (distinctive, not a +% grab-bag)", () => {
    for (const b of Object.values(FRANCHISE_BOONS)) {
      const nonZero = [b.hype, b.preorder, b.design].filter((v) => v !== 0).length;
      expect(nonZero).toBe(1);
    }
  });
});

describe("franchiseMastery — magnitude caps (modest, at/below mastery + mandate)", () => {
  it("hype ≤ 6%, preorder ≤ 4%, design ≤ 1 — all bounded", () => {
    expect(FRANCHISE_BOONS.heritageHalo.hype).toBeLessThanOrEqual(0.06);
    expect(FRANCHISE_BOONS.trustedName.preorder).toBeLessThanOrEqual(0.04);
    expect(FRANCHISE_BOONS.signatureCraft.design).toBeLessThanOrEqual(1);
    // Below the mandate ceilings (hype up to +0.09, designCeiling +1) — an edge, never an auto-win.
    expect(FRANCHISE_BOONS.heritageHalo.hype).toBeLessThan(0.09);
    // Far below the equity pre-order cap (0.4).
    expect(FRANCHISE_BOONS.trustedName.preorder).toBeLessThan(0.4);
  });
});

describe("franchiseMastery — the boon selector", () => {
  it("returns the earned boon only for a qualified line's next entry", () => {
    const qualified = line("Nova", 5, "phone");
    expect(franchiseBoonForName(qualified, "Nova 6").id).toBe("heritageHalo");
    expect(franchiseBoonForName(qualified, "Nova 6").hype).toBe(0.06);
  });

  it("returns the ZERO boon for an unqualified line", () => {
    expect(franchiseBoonForName(line("Nova", 4, "phone"), "Nova 5")).toBe(ZERO_FRANCHISE_BOON);
    expect(franchiseBoonForName([], "First launch")).toBe(ZERO_FRANCHISE_BOON);
    expect(ZERO_FRANCHISE_BOON.hype).toBe(0);
    expect(ZERO_FRANCHISE_BOON.preorder).toBe(0);
    expect(ZERO_FRANCHISE_BOON.design).toBe(0);
  });

  it("a first-in-line launch never earns a boon (no prior entries)", () => {
    // Only the SAME stem's history counts; a brand-new name has an empty line.
    expect(franchiseBoonForName(line("Nova", 5, "phone"), "Aurora 1")).toBe(ZERO_FRANCHISE_BOON);
  });
});

describe("franchiseMastery — closest unqualified line (Goals Ledger candidate)", () => {
  it("returns the nearest line with ≥ minEntries that hasn't qualified", () => {
    const launched = [
      ...line("Deep", 4, "phone"),   // 4 entries, iconic → 1 away
      ...line("Shallow", 3, "tablet", "flop"), // 3 entries, not iconic
    ];
    const closest = closestUnqualifiedLine(launched, 3);
    expect(closest).not.toBeNull();
    expect(closest!.stem).toBe("deep"); // fewer entries remaining wins
  });

  it("excludes lines below minEntries and already-qualified lines", () => {
    const launched = [
      ...line("Big", 5, "phone"),   // qualified → excluded
      ...line("Tiny", 2, "tablet"), // below minEntries(3) → excluded
    ];
    expect(closestUnqualifiedLine(launched, 3)).toBeNull();
  });
});
