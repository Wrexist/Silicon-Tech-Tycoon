import { describe, expect, it } from "vitest";
import { CATALOG, SATURATED_ALLOWED } from "./palette.ts";
import { FACTORY_PALETTE } from "./factoryPalette.ts";

// One studio, two worlds: the factory's materials come from the office's families. Every factory
// colour is either a CATALOG neutral (the same graphite / steel / ink the office is built from) or a
// purpose colour with its job written down in SATURATED_ALLOWED — never an ad-hoc hex.
describe("factory palette shares the office's families", () => {
  const catalog = new Set<string>(Object.values(CATALOG).map((c) => c.toLowerCase()));
  const allowed = new Set(Object.keys(SATURATED_ALLOWED).map((c) => c.toLowerCase()));

  it("every factory colour is a CATALOG colour or an allowlisted purpose colour", () => {
    const offenders = Object.entries(FACTORY_PALETTE)
      .filter(([, hex]) => !catalog.has(hex.toLowerCase()) && !allowed.has(hex.toLowerCase()))
      .map(([key, hex]) => `${key}: ${hex}`);
    expect(offenders, "use a CATALOG colour, or allowlist the hex with its purpose:\n" + offenders.join("\n")).toEqual([]);
  });

  it("mostly neutrals: purpose colours stay the exception", () => {
    const purpose = Object.values(FACTORY_PALETTE).filter((hex) => !catalog.has(hex.toLowerCase()));
    expect(purpose.length).toBeLessThanOrEqual(3);
  });
});
