import { describe, it, expect } from "vitest";
import { generateRivalProduct, rivalTone } from "./rivalAI.ts";
import { makeRng } from "./rng.ts";
import { CATEGORIES, tierDef } from "./catalogs.ts";
import { toDollars } from "./money.ts";
import type { CategoryId } from "./types.ts";

function gen(opts: Partial<Parameters<typeof generateRivalProduct>[0]> = {}) {
  return generateRivalProduct({
    rivalId: "pomelo",
    rivalName: "Pomelo",
    category: "phone",
    era: 2,
    strength: 50,
    week: 10,
    rng: makeRng(123),
    ...opts,
  });
}

describe("rivalAI — deterministic, valid products", () => {
  it("same seed → identical product", () => {
    const a = generateRivalProduct({ rivalId: "tristar", rivalName: "Tristar", category: "phone", era: 2, strength: 44, week: 7, rng: makeRng(999) });
    const b = generateRivalProduct({ rivalId: "tristar", rivalName: "Tristar", category: "phone", era: 2, strength: 44, week: 7, rng: makeRng(999) });
    expect(a).toEqual(b);
  });

  it("fills every component slot the category needs, with in-range tiers and a positive price", () => {
    const r = gen();
    const slots = CATEGORIES["phone"].slots;
    for (const kind of slots) {
      const t = r.product.tiers[kind];
      expect(t).toBeDefined();
      expect(tierDef(kind, t!)).toBeDefined(); // tier exists in the line
    }
    expect(toDollars(r.product.price)).toBeGreaterThan(0);
    expect(r.overall).toBeGreaterThanOrEqual(0);
    expect(r.overall).toBeLessThanOrEqual(100);
    expect(r.product.name.length).toBeGreaterThan(0);
  });

  it("never ships components from a future era", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = generateRivalProduct({ rivalId: "novaplus", rivalName: "NovaPlus", category: "phone", era: 1, strength: 40, week: 5, rng: makeRng(seed) });
      for (const kind of CATEGORIES["phone"].slots) {
        const t = r.product.tiers[kind]!;
        expect(tierDef(kind, t)!.era).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("rivalAI — strength and tone shape the product", () => {
  it("stronger launches produce higher-quality products (averaged over seeds)", () => {
    const avg = (strength: number) => {
      let acc = 0;
      for (let seed = 0; seed < 30; seed++) acc += gen({ strength, rng: makeRng(seed) }).overall;
      return acc / 30;
    };
    expect(avg(80)).toBeGreaterThan(avg(30));
  });

  it("a premium house designs prettier devices than a value house at the same strength", () => {
    const tone = (id: string) => rivalTone(id);
    expect(tone("pomelo")).toBe("premium");
    expect(tone("pandacore")).toBe("value");
    const meanDesign = (id: string, name: string) => {
      let acc = 0;
      for (let seed = 0; seed < 40; seed++) {
        const r = generateRivalProduct({ rivalId: id, rivalName: name, category: "phone", era: 3, strength: 55, week: 12, rng: makeRng(seed) });
        // compare the design-driving materials tier as a proxy for "prettier"
        acc += r.product.tiers.materials ?? 0;
      }
      return acc / 40;
    };
    expect(meanDesign("pomelo", "Pomelo")).toBeGreaterThan(meanDesign("pandacore", "Pandacore"));
  });

  it("a value house prices below a premium house for comparable quality", () => {
    const meanPrice = (id: string, name: string) => {
      let acc = 0;
      for (let seed = 0; seed < 40; seed++) {
        const r = generateRivalProduct({ rivalId: id, rivalName: name, category: "phone", era: 3, strength: 55, week: 12, rng: makeRng(seed) });
        acc += toDollars(r.product.price);
      }
      return acc / 40;
    };
    expect(meanPrice("pandacore", "Pandacore")).toBeLessThan(meanPrice("pomelo", "Pomelo"));
  });
});

describe("rivalAI — works for every unlocked category", () => {
  it("generates a valid renderable product per category", () => {
    const cats: CategoryId[] = ["phone", "tablet", "laptop", "desktop", "monitor", "console", "wearable", "experimental"];
    for (const category of cats) {
      const r = gen({ category, era: 4, rng: makeRng(7) });
      for (const kind of CATEGORIES[category].slots) {
        expect(r.product.tiers[kind]).toBeDefined();
      }
      expect(toDollars(r.product.price)).toBeGreaterThan(0);
    }
  });
});
