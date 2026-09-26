import { CATEGORIES, COMPONENT_LINES } from "../engine/catalogs.ts";
import { FINISH_ORDER, type Product } from "../engine/types.ts";
import { SUPPLIERS } from "../engine/suppliers.ts";
import { FACTORIES } from "../engine/factories.ts";

export const DESIGN_STEPS = ["components", "style", "camera", "launch"] as const;
export type DesignStep = typeof DESIGN_STEPS[number];
export interface DraftRecord { version: 1; run: string; week: number; step: DesignStep; product: Product }
type Store = Pick<Storage, "getItem" | "setItem">;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const int = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isSafeInteger(v) && v >= lo && v <= hi;
const member = (v: unknown, values: readonly unknown[]) => values.includes(v);
export const draftKey = (run: string) => `silicon.design-draft.v1:${run}`;

/** Strict independent boundary: malformed drafts never reach the renderer or the game save. */
export function validDraftProduct(v: unknown): v is Product {
  if (!object(v) || typeof v.name !== "string" || v.name.length > 22 || typeof v.id !== "string") return false;
  if (!member(v.category, Object.keys(CATEGORIES)) || !member(v.finish, FINISH_ORDER) || !object(v.tiers) || !object(v.camera)) return false;
  if (!int(v.price, 0, 1e14) || !int(v.colorIndex, 0, 100) || !int(v.designTier, 1, 100)) return false;
  for (const [kind, tier] of Object.entries(v.tiers)) {
    const line = COMPONENT_LINES[kind as keyof typeof COMPONENT_LINES];
    if (!line || !int(tier, 0, line.tiers.length)) return false;
  }
  const c = v.camera;
  if (!int(c.count, 1, 4) || !member(c.layout, ["vertical", "horizontal", "square", "triangle"]) || !member(c.position, ["topLeft", "topCenter", "center"]) || !member(c.module, ["squircle", "circle", "pill"]) || typeof c.flash !== "boolean") return false;
  if (!member(v.notch, ["none", "punch", "notch", "island"])) return false;
  const enums: Record<string, readonly unknown[]> = {
    tuning: ["balanced", "performance", "efficiency", "value", "premium"],
    supplierId: Object.keys(SUPPLIERS), factoryId: Object.keys(FACTORIES),
    capacityStrategy: ["overtime", "stretch", "defects"], targetSegment: ["budget", "mainstream", "pro", "style", "enterprise"],
    refreshRate: [60, 90, 120, 144], storage: [128, 256, 512, 1024],
  };
  for (const [key, choices] of Object.entries(enums)) if (v[key] !== undefined && !member(v[key], choices)) return false;
  for (const key of ["subsystem", "plannedUnits"]) if (v[key] !== undefined && !int(v[key], 0, 1e9)) return false;
  if (v.defectPenalty !== undefined && (typeof v.defectPenalty !== "number" || !Number.isFinite(v.defectPenalty) || v.defectPenalty < 0 || v.defectPenalty > 100)) return false;
  if (v.dualSource !== undefined && typeof v.dualSource !== "boolean") return false;
  if (v.channelId !== undefined && typeof v.channelId !== "string") return false;
  if (v.regions !== undefined && (!Array.isArray(v.regions) || !v.regions.every(r => member(r, ["home", "north_america", "europe", "asia", "emerging"])))) return false;
  return true;
}

export function decodeDraft(raw: string | null, run: string, week: number): DraftRecord | null {
  try {
    const v: unknown = JSON.parse(raw ?? "null");
    if (!object(v) || v.version !== 1 || v.run !== run || !int(v.week, 0, week) || !member(v.step, DESIGN_STEPS) || !validDraftProduct(v.product)) return null;
    return v as unknown as DraftRecord;
  } catch { return null; }
}

export function loadDraft(store: Store, run: string, week: number) {
  try {
    const key = draftKey(run), raw = store.getItem(key);
    const primary = decodeDraft(raw, run, week);
    if (primary) return { record: primary, status: "restored" as const };
    const backup = decodeDraft(store.getItem(`${key}:backup`), run, week);
    return { record: backup, status: backup ? "recovered" as const : raw ? "invalid" as const : "new" as const };
  } catch { return { record: null, status: "unavailable" as const }; }
}

export function saveDraft(store: Store, record: DraftRecord): boolean {
  try {
    if (!decodeDraft(JSON.stringify(record), record.run, record.week)) return false;
    const key = draftKey(record.run), old = store.getItem(key);
    if (decodeDraft(old, record.run, record.week)) store.setItem(`${key}:backup`, old!);
    else if (old) store.setItem(`${key}:unreadable`, old);
    store.setItem(key, JSON.stringify(record));
    return true;
  } catch { return false; }
}
