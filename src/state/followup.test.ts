import { describe, expect, it } from "vitest";
import { decodeDraft, draftKey, loadDraft, saveDraft, validDraftProduct, type DraftRecord } from "./designDraft.ts";
import { researchEraView } from "./researchView.ts";
import { priceAssessment, designAdvice } from "./designAdvice.ts";
import { dollars } from "../engine/money.ts";
import { defaultCameraDesign, type Product } from "../engine/types.ts";

const product: Product = { id: "draft", name: "Saved phone", category: "phone", tiers: { chip: 1 }, finish: "plastic", colorIndex: 0, price: dollars(400), designTier: 1, camera: defaultCameraDesign(), notch: "punch" };
const record: DraftRecord = { version: 1, run: "123:0", week: 8, step: "style", product };
const memory = () => { const data = new Map<string, string>(); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } }; };
describe("draft safety", () => {
  it("restores an incomplete design and active step, without filling missing choices", () => {
    const store = memory(); expect(saveDraft(store, record)).toBe(true);
    expect(loadDraft(store, record.run, 9).record).toEqual(record);
    expect(loadDraft(store, record.run, 9).record?.product.tiers.display).toBeUndefined();
  });
  it("isolates runs and rejects a future timeline or schema", () => {
    const raw = JSON.stringify(record);
    expect(decodeDraft(raw, "other", 8)).toBeNull();
    expect(decodeDraft(raw, record.run, 7)).toBeNull();
    expect(decodeDraft(JSON.stringify({ ...record, version: 99 }), record.run, 8)).toBeNull();
  });
  it("recovers a previous valid draft after the newest copy is corrupted", () => {
    const store = memory(); saveDraft(store, record);
    saveDraft(store, { ...record, product: { ...product, name: "Second" } });
    store.setItem(draftKey(record.run), "{broken");
    expect(loadDraft(store, record.run, 8)).toEqual({ record, status: "recovered" });
  });
  it("rejects invalid renderer input and unsafe numeric values", () => {
    for (const bad of [{ ...product, category: "unknown" }, { ...product, camera: null }, { ...product, tiers: { chip: 999 } }, { ...product, price: Infinity }, { ...product, regions: ["unknown"] }, { ...product, factoryId: "unknown" }]) expect(validDraftProduct(bad)).toBe(false);
  });
  it("reports unavailable storage instead of claiming success", () => {
    const store = { getItem: () => { throw Error("denied"); }, setItem: () => { throw Error("quota"); } };
    expect(loadDraft(store, record.run, 8).status).toBe("unavailable");
    expect(saveDraft(store, record)).toBe(false);
  });
});
describe("management readouts", () => {
  it("keeps completed and queued projects in the era denominator", () => {
    const before = researchEraView(1, [], new Set());
    const after = researchEraView(1, ["assemblyLine"], new Set(["leanSupply"]));
    expect(after.completed).toBe(1); expect(after.total).toBe(before.total);
    expect(after.visible).toHaveLength(before.total - 2);
  });
  it("does not raise price warnings inside the fair band", () => {
    expect(priceAssessment(1.25).label).toBe("Fair");
    const advice = designAdvice({ missing: [], priceRatio: 1.25, weak: null, fit: 85, trend: null });
    expect(advice.tone).toBe("positive");
  });
  it("flags missing parts before pricing and directs overpriced devices to Launch", () => {
    expect(designAdvice({ missing: ["Chip"], priceRatio: 2, weak: null, fit: 20, trend: null }).step).toBe("components");
    expect(designAdvice({ missing: [], priceRatio: 2, weak: null, fit: 85, trend: null }).step).toBe("launch");
  });
});
