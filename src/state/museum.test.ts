import { describe, it, expect, beforeEach } from "vitest";
import { getMuseum, addMuseumEntry, type MuseumEntry } from "./museum.ts";
import type { Product } from "../engine/types.ts";

class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
}
beforeEach(() => {
  // @ts-expect-error node test stub
  globalThis.localStorage = new MemStorage();
});

const product: Product = {
  id: "p1", name: "Aurora One", category: "phone", tiers: { chip: 1 },
  finish: "aluminium", colorIndex: 0, price: 49900 as never, designTier: 1,
  camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
  notch: "punch",
};

function entry(key: string, name = "Aurora One"): MuseumEntry {
  return { key, product: { ...product, name }, name, category: "phone", era: 1, companyName: "Silicon", week: 5 };
}

describe("device museum store", () => {
  it("starts empty and tolerates a corrupt store", () => {
    expect(getMuseum()).toEqual([]);
    localStorage.setItem("silicon.museum.v1", "{not array");
    expect(getMuseum()).toEqual([]);
  });

  it("prepends newest-first and de-dupes by key", () => {
    addMuseumEntry(entry("a", "First"));
    addMuseumEntry(entry("b", "Second"));
    expect(getMuseum().map((e) => e.name)).toEqual(["Second", "First"]);
    addMuseumEntry(entry("a", "First-again")); // same key → moves to front, no dup
    const names = getMuseum().map((e) => e.name);
    expect(names).toEqual(["First-again", "Second"]);
  });

  it("caps at 60 most-recent entries", () => {
    for (let i = 0; i < 70; i++) addMuseumEntry(entry(`k${i}`, `D${i}`));
    const list = getMuseum();
    expect(list).toHaveLength(60);
    expect(list[0].name).toBe("D69"); // newest kept
    expect(list.some((e) => e.name === "D9")).toBe(false); // oldest dropped
  });

  it("filters out unrenderable entries (missing product/category)", () => {
    localStorage.setItem("silicon.museum.v1", JSON.stringify([
      entry("ok"),
      { key: "bad", name: "X" }, // no product/category
    ]));
    expect(getMuseum().map((e) => e.key)).toEqual(["ok"]);
  });
});
