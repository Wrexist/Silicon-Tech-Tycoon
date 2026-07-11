// Collection goals (item 5.2): facts aggregation + per-collection progress/completion over the museum.
import { describe, expect, it } from "vitest";
import { COLLECTIONS, collectionFacts, collectionProgress, completedCollectionCount, type DeviceRecord } from "./collections.ts";
import { CATEGORIES } from "./catalogs.ts";
import type { CategoryId } from "./types.ts";

const dev = (o: Partial<DeviceRecord> = {}): DeviceRecord => ({ category: "phone", era: 1, verdict: "solid", name: "Nova", ...o });
const ALL_CATS = Object.keys(CATEGORIES) as CategoryId[];

describe("collection facts", () => {
  it("aggregates categories, hits, eras, and the deepest franchise", () => {
    const f = collectionFacts([
      dev({ name: "Nova", verdict: "hit", era: 1 }),
      dev({ name: "Nova 2", verdict: "solid", era: 2 }),
      dev({ name: "Nova 3", verdict: "hit", era: 2, category: "tablet" }),
    ]);
    expect(f.total).toBe(3);
    expect(f.categories.size).toBe(2); // phone + tablet
    expect(f.hitCount).toBe(2);
    expect(f.erasShipped.size).toBe(2);
    expect(f.hitEras).toEqual(new Set([1, 2]));
    expect(f.maxFranchiseDepth).toBe(3); // Nova / Nova 2 / Nova 3 share a stem
  });

  it("an empty museum yields zeroed facts (no collection complete)", () => {
    const f = collectionFacts([]);
    expect(completedCollectionCount(f)).toBe(0);
    for (const c of COLLECTIONS) expect(collectionProgress(c, f).done).toBe(false);
  });
});

describe("collection progress", () => {
  it("The Polymath completes when every category has shipped", () => {
    const poly = COLLECTIONS.find((c) => c.id === "polymath")!;
    const partial = collectionFacts(ALL_CATS.slice(0, -1).map((c) => dev({ category: c })));
    expect(collectionProgress(poly, partial).done).toBe(false);
    const full = collectionFacts(ALL_CATS.map((c) => dev({ category: c })));
    const p = collectionProgress(poly, full);
    expect(p.done).toBe(true);
    expect(p.current).toBe(p.target);
    expect(p.frac).toBe(1);
  });

  it("Hitmaker needs 10 hits; progress caps at the target", () => {
    const hit = COLLECTIONS.find((c) => c.id === "hitmaker")!;
    const many = collectionFacts(Array.from({ length: 15 }, (_, i) => dev({ name: `H${i}`, verdict: "hit" })));
    const p = collectionProgress(hit, many);
    expect(p.done).toBe(true);
    expect(p.current).toBe(10); // clamped to target, never 15
  });

  it("Dynasty needs a five-deep franchise line", () => {
    const dyn = COLLECTIONS.find((c) => c.id === "dynasty")!;
    const four = collectionFacts(Array.from({ length: 4 }, (_, i) => dev({ name: `Nova ${i + 1}` })));
    expect(collectionProgress(dyn, four).done).toBe(false);
    const five = collectionFacts(Array.from({ length: 5 }, (_, i) => dev({ name: `Nova ${i + 1}` })));
    expect(collectionProgress(dyn, five).done).toBe(true);
  });
});
