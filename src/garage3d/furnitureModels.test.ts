import { describe, expect, it } from "vitest";
import { MODEL_ASSETS, modelFor, surfaceAnchorY } from "./furnitureModels.ts";

// The desktop-surface anchor. The standalone modelled desk gets its computer as `children` of the
// GLB, anchored at the declared surface height — NOT the model's bounding-box top, which a taller
// part (a screen, rail or shelf on the same model) would push too high, floating the keyboard and
// monitor above the desk. These pin both halves of that rule.
describe("fitted-model desktop surface anchor", () => {
  it("uses the declared surface, not a taller measured top", () => {
    // A desk whose model also carries a screen: bbox top is 1.1m, the desktop is 0.74m.
    const withScreen = { surfaceHeight: 0.74 };
    expect(surfaceAnchorY(withScreen, 1.1)).toBe(0.74);
  });

  it("falls back to the measured top only when no surface is declared", () => {
    expect(surfaceAnchorY({}, 0.42)).toBe(0.42);
    expect(surfaceAnchorY({ surfaceHeight: undefined }, 0.42)).toBe(0.42);
  });

  it("every deck-receiving desk declares a surface no higher than its own height", () => {
    for (const id of ["desk", "deskL"] as const) {
      const asset = modelFor(id);
      expect(asset, `${id} should be a modelled asset`).toBeDefined();
      expect(asset?.surfaceHeight, `${id} must declare its desktop surface`).toBeGreaterThan(0);
      expect(asset!.surfaceHeight!).toBeLessThanOrEqual(asset!.realHeight ?? asset!.surfaceHeight!);
    }
  });

  it("shipped desks keep the measured top equal to the declared surface (no taller parts today)", () => {
    // The Kenney desk/deskL GLBs are bare boards (no monitor), so bbox top == desktop. This is the
    // regression guard for the day a taller part is added to the model: the anchor must not move.
    for (const id of ["desk", "deskL"] as const) {
      const asset = modelFor(id)!;
      expect(surfaceAnchorY(asset, asset.realHeight!)).toBe(asset.surfaceHeight);
    }
  });

  it("does not smuggle a surface onto bare pieces (shelves keep the measured height)", () => {
    const shelf = MODEL_ASSETS.bookshelf;
    expect(shelf?.surfaceHeight).toBeUndefined();
  });
});
