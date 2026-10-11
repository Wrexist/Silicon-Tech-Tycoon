import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FURNITURE_MODELS_VERSION, MODEL_ASSETS, modelFetchPath, modelFor, surfaceAnchorY } from "./furnitureModels.ts";

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

// An installed PWA serves the models CacheFirst from a year-long runtime cache (vite.config.ts), so a
// replaced set must arrive under NEW urls or players keep the old furniture after updating.
describe("furniture model set versioning", () => {
  it("every registered model is fetched with the set version and still hits the runtime-cache route", () => {
    for (const [id, asset] of Object.entries(MODEL_ASSETS)) {
      const fetched = new URL(modelFetchPath(asset!.url), "https://app.invalid/");
      expect(fetched.searchParams.get("v"), id).toBe(String(FURNITURE_MODELS_VERSION));
      // vite.config.ts matches on the PATHNAME, which the version query leaves alone
      expect(fetched.pathname.includes("/furniture/") && fetched.pathname.endsWith(".glb"), id).toBe(true);
    }
  });

  it("keeps the registry url as the identity the finish and seat rules key on", () => {
    expect(MODEL_ASSETS.sofa?.url).toBe("furniture/sofa.glb");
  });

  it("pins the shipped GLBs to the set version (changed files => bump the version, then this pin)", () => {
    const dir = "public/furniture";
    const hash = createHash("sha256");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".glb")).sort()) {
      hash.update(file);
      hash.update(readFileSync(`${dir}/${file}`));
    }
    const pinned: Record<number, string> = { 2: "b66ed7d1ac8bc81f1c3585b64ae2b8c8d7b6a103b5f324dd6cc34a734cfc2d94" };
    expect(hash.digest("hex"), "public/furniture/*.glb changed: bump FURNITURE_MODELS_VERSION and pin the new hash").toBe(pinned[FURNITURE_MODELS_VERSION]);
  });
});
