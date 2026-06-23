import { describe, it, expect } from "vitest";
import { styleAppeal, styleAppealLabel } from "./aesthetics.ts";
import { BALANCE } from "./balance.ts";
import { dollars } from "./money.ts";
import { defaultCameraDesign, type Product } from "./types.ts";

const A = BALANCE.market.aesthetics;

function phone(p: Partial<Product> = {}): Product {
  return {
    id: "x",
    name: "Test",
    category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(500),
    designTier: 1,
    camera: { ...defaultCameraDesign(), count: 3, layout: "square", module: "squircle", flash: true },
    notch: "island",
    ...p,
  };
}

describe("styleAppeal (Epic G1)", () => {
  it("a fully-considered design reaches the cap; a dated one scores near zero", () => {
    const striking = styleAppeal(phone({ notch: "island", camera: { ...defaultCameraDesign(), count: 3, layout: "square", module: "squircle", flash: true } }));
    expect(striking).toBe(A.maxStyleAppeal);
    const dated = styleAppeal(phone({ notch: "notch", camera: { ...defaultCameraDesign(), count: 4, layout: "vertical", module: "circle", flash: false } }));
    expect(dated).toBeLessThan(striking);
    expect(dated).toBeLessThanOrEqual(A.module.circle); // only the module cue, cluttered layout
  });

  it("is always bounded to [0, maxStyleAppeal]", () => {
    for (const notch of ["none", "punch", "notch", "island"] as const) {
      for (const module of ["squircle", "circle", "pill"] as const) {
        for (const layout of ["vertical", "horizontal", "square", "triangle"] as const) {
          for (const count of [1, 2, 3, 4]) {
            const s = styleAppeal(phone({ notch, camera: { ...defaultCameraDesign(), count, layout, module, flash: true } }));
            expect(s).toBeGreaterThanOrEqual(0);
            expect(s).toBeLessThanOrEqual(A.maxStyleAppeal);
          }
        }
      }
    }
  });

  it("rewards a layout that suits the lens count (intentional, not a cluttered strip)", () => {
    const coherent = styleAppeal(phone({ camera: { ...defaultCameraDesign(), count: 3, layout: "triangle", module: "squircle", flash: false } }));
    const cluttered = styleAppeal(phone({ camera: { ...defaultCameraDesign(), count: 3, layout: "vertical", module: "squircle", flash: false } }));
    expect(coherent).toBeGreaterThan(cluttered);
  });

  it("ignores camera cues for a category without a camera (e.g. monitor)", () => {
    const mon = styleAppeal({ ...phone(), category: "monitor", tiers: { panel: 1 } as Product["tiers"] });
    // monitor has no camera slot — only the notch/screen cue can contribute
    expect(mon).toBeLessThanOrEqual(A.notch.island);
  });

  it("labels the design language by appeal", () => {
    expect(styleAppealLabel(0)).toBe("Dated");
    expect(styleAppealLabel(A.maxStyleAppeal)).toBe("Striking");
    expect(styleAppealLabel(A.maxStyleAppeal * 0.4)).toBe("Clean");
  });
});
