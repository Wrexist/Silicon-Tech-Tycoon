// Named synergy archetypes (Track D): high-end component pairings unlock themed, capped stat bonuses.
import { describe, expect, it } from "vitest";
import { activeArchetypes, archetypeBonus, SYNERGY_ARCHETYPES } from "./product.ts";
import { maxTier } from "./catalogs.ts";
import { BALANCE } from "./balance.ts";
import type { Product, ComponentKind } from "./types.ts";

function phone(tiers: Partial<Record<ComponentKind, number>>): Product {
  return {
    id: "p", name: "P", category: "phone", tiers, finish: "aluminium", colorIndex: 0,
    price: 0 as never, designTier: 1, camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true }, notch: "punch",
  } as Product;
}
const top = (k: ComponentKind) => maxTier(k);

describe("synergy archetypes", () => {
  it("a low-tier build unlocks nothing", () => {
    expect(activeArchetypes(phone({ chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 }))).toHaveLength(0);
    expect(archetypeBonus(phone({ chip: 1, display: 1 }))).toEqual({});
  });

  it("a top chip + top display unlocks Flagship Integration", () => {
    const a = activeArchetypes(phone({ chip: top("chip"), display: top("display") }));
    expect(a.map((x) => x.id)).toContain("flagship");
  });

  it("an archetype only fires when ALL its component kinds are high tier", () => {
    const a = activeArchetypes(phone({ chip: top("chip"), display: 1 })); // display too low
    expect(a.map((x) => x.id)).not.toContain("flagship");
  });

  it("skips archetypes whose components aren't slots of the category", () => {
    // a desktop has no camera slot, so the camera-based Imaging Pipeline can never unlock there
    const desktop: Product = { ...phone({ chip: top("chip"), materials: top("materials"), software: top("software") }), category: "desktop" };
    expect(activeArchetypes(desktop).map((x) => x.id)).not.toContain("imaging");
  });

  it("a fully-maxed flagship unlocks several archetypes, but the bonus is capped", () => {
    const maxed = phone({ chip: top("chip"), display: top("display"), battery: top("battery"), materials: top("materials"), software: top("software"), camera: top("camera") });
    expect(activeArchetypes(maxed).length).toBeGreaterThanOrEqual(3);
    const bonus = archetypeBonus(maxed);
    const total = Object.values(bonus).reduce((a, b) => a + (b ?? 0), 0);
    expect(total).toBeLessThanOrEqual(BALANCE.design.archetype.maxTotalBonus + 1); // rounding slack
  });

  it("category-scoped archetypes fire only for their categories — phones untouched (sim-safe)", () => {
    // Workstation Class is laptop/desktop-only: it unlocks on a maxed laptop…
    const laptop: Product = { ...phone({ chip: top("chip"), materials: top("materials") }), category: "laptop" };
    expect(activeArchetypes(laptop).map((x) => x.id)).toContain("workstation");
    // …but NEVER on a phone, even fully maxed — so the phone-only balance sim stays byte-identical.
    const maxedPhone = phone({ chip: top("chip"), display: top("display"), battery: top("battery"), materials: top("materials"), software: top("software"), camera: top("camera") });
    const phoneIds = activeArchetypes(maxedPhone).map((x) => x.id);
    for (const scoped of ["workstation", "arcade", "companion", "canvas", "spatial"]) {
      expect(phoneIds).not.toContain(scoped);
    }
  });

  it("every archetype's components are a plausible high-end pairing (2 kinds, named)", () => {
    for (const a of SYNERGY_ARCHETYPES) {
      expect(a.kinds.length).toBeGreaterThanOrEqual(2);
      expect(a.name.length).toBeGreaterThan(3);
      expect(Object.keys(a.bonus).length).toBeGreaterThan(0);
    }
  });
});
