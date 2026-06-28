// Component suppliers — the "where your parts come from" decision. Picking a supplier for a product
// trades three deterministic axes against each other:
//   • cost    — a per-unit component-cost multiplier (cheap parts ↔ premium parts)
//   • quality — a flat delta to the product's `quality` stat (better parts build a better device)
//   • lead    — extra manufacturing weeks (cheap, far-flung sourcing is slower to the line)
// PURE. No React/DOM. The chosen supplier id lives on the Product (product.supplierId); everything
// here resolves an id (or undefined, for older saves / fresh drafts) to its effect. The `standard`
// supplier is deliberately neutral (1.0 / 0 / 0) so an unset supplier behaves exactly as before.
import type { Product, SupplierId } from "./types.ts";

export type { SupplierId };

export type SupplierTrait = "value" | "standard" | "premium" | "elite";

export interface Supplier {
  id: SupplierId;
  name: string;
  era: number; // first era it becomes available
  costMult: number; // per-unit component cost multiplier (1.0 = catalog price)
  qualityDelta: number; // added to the product's `quality` stat (can be negative)
  leadWeeks: number; // extra manufacturing weeks of sourcing lead time
  trait: SupplierTrait;
  blurb: string; // one-line UI description
}

/** Unset / older-save products resolve to this — the neutral mainstream supplier. */
export const DEFAULT_SUPPLIER_ID: SupplierId = "standard";

export const SUPPLIERS: Record<SupplierId, Supplier> = {
  bargain: {
    id: "bargain",
    name: "BargainBin Sourcing",
    era: 1,
    costMult: 0.82,
    qualityDelta: -5,
    leadWeeks: 1,
    trait: "value",
    blurb: "Cheapest parts — thinner specs and a slower boat.",
  },
  standard: {
    id: "standard",
    name: "Everline Standard",
    era: 1,
    costMult: 1.0,
    qualityDelta: 0,
    leadWeeks: 0,
    trait: "standard",
    blurb: "Reliable mainstream sourcing. No surprises.",
  },
  lumen: {
    id: "lumen",
    name: "Lumen Select",
    era: 1,
    costMult: 1.1,
    qualityDelta: 3,
    leadWeeks: 0,
    trait: "premium",
    blurb: "Better panels and cells for a modest premium.",
  },
  novacore: {
    id: "novacore",
    name: "NovaCore Components",
    era: 2,
    costMult: 1.22,
    qualityDelta: 6,
    leadWeeks: 0,
    trait: "premium",
    blurb: "Premium components — a real lift to build quality.",
  },
  atlas: {
    id: "atlas",
    name: "Atlas Foundry Direct",
    era: 3,
    costMult: 1.3,
    qualityDelta: 8,
    leadWeeks: 0,
    trait: "elite",
    blurb: "Bleeding-edge parts, sourced direct from the foundry.",
  },
  vertex: {
    id: "vertex",
    name: "Vertex Prime",
    era: 4,
    costMult: 1.4,
    qualityDelta: 10,
    leadWeeks: 0,
    trait: "elite",
    blurb: "The finest components money can buy. Flagship-grade.",
  },
};

export const SUPPLIER_LIST: Supplier[] = Object.values(SUPPLIERS);

/** Resolve a (possibly missing/invalid) supplier id to its definition; defaults to standard. */
export function supplierFor(id?: SupplierId): Supplier {
  return (id && SUPPLIERS[id]) || SUPPLIERS[DEFAULT_SUPPLIER_ID];
}

/** Suppliers available to a company at the given tech era. */
export function unlockedSuppliers(era: number): Supplier[] {
  return SUPPLIER_LIST.filter((s) => s.era <= era);
}

export function isSupplierUnlocked(id: SupplierId, era: number): boolean {
  return supplierFor(id).era <= era;
}

// --- Per-product effect accessors (read product.supplierId) ----------------------------------
export const supplierCostMult = (p: Product): number => supplierFor(p.supplierId).costMult;
export const supplierQualityDelta = (p: Product): number => supplierFor(p.supplierId).qualityDelta;
export const supplierLeadWeeks = (p: Product): number => supplierFor(p.supplierId).leadWeeks;
