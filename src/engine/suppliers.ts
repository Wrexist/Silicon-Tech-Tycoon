// Component suppliers — the "where your parts come from" decision. Picking a supplier for a product
// trades three deterministic axes against each other:
//   • cost    — a per-unit component-cost multiplier (cheap parts ↔ premium parts)
//   • quality — a flat delta to the product's `quality` stat (better parts build a better device)
//   • lead    — extra manufacturing weeks (cheap, far-flung sourcing is slower to the line)
// PURE. No React/DOM. The chosen supplier id lives on the Product (product.supplierId); everything
// here resolves an id (or undefined, for older saves / fresh drafts) to its effect. The `standard`
// supplier is deliberately neutral (1.0 / 0 / 0) so an unset supplier behaves exactly as before.
import { BALANCE } from "./balance.ts";
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
  // Supply-chain resilience: multiplies the cash hit of a `supplyCrunch` event. >1 = exposed
  // (cheap sourcing amplifies a shock), <1 = insured (premium sourcing weathers it). standard = 1.
  crunchMult: number;
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
    crunchMult: 1.5,
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
    crunchMult: 1.0,
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
    crunchMult: 0.85,
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
    crunchMult: 0.7,
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
    crunchMult: 0.55,
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
    crunchMult: 0.45,
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

// --- Relationships: repeat business with a supplier earns a standing unit-cost discount ----------
export interface LoyaltyTier {
  name: string;
  minBuilds: number; // builds run through this supplier to reach the tier
  discount: number; // unit-cost discount at this tier (0..1)
}

/** Loyalty ladder, low→high. The active tier is the highest one your build count clears. */
export const SUPPLIER_LOYALTY_TIERS: LoyaltyTier[] = [
  { name: "New", minBuilds: 0, discount: 0 },
  { name: "Trusted", minBuilds: 3, discount: 0.03 },
  { name: "Partner", minBuilds: 7, discount: 0.06 },
  { name: "Preferred", minBuilds: 15, discount: 0.1 },
];

export function supplierLoyaltyTier(builds: number): LoyaltyTier {
  let tier = SUPPLIER_LOYALTY_TIERS[0];
  for (const cand of SUPPLIER_LOYALTY_TIERS) if (builds >= cand.minBuilds) tier = cand;
  return tier;
}

export const supplierLoyaltyDiscount = (builds: number): number => supplierLoyaltyTier(builds).discount;

/** Builds remaining until the next loyalty tier (null at the top tier) — for a progress readout. */
export function buildsToNextTier(builds: number): number | null {
  const next = SUPPLIER_LOYALTY_TIERS.find((t) => t.minBuilds > builds);
  return next ? next.minBuilds - builds : null;
}

export function isSupplierUnlocked(id: SupplierId, era: number): boolean {
  return supplierFor(id).era <= era;
}

// --- Per-product effect accessors (read product.supplierId) ----------------------------------
export const supplierCostMult = (p: Product): number => supplierFor(p.supplierId).costMult;
export const supplierQualityDelta = (p: Product): number => supplierFor(p.supplierId).qualityDelta;
export const supplierLeadWeeks = (p: Product): number => supplierFor(p.supplierId).leadWeeks;
/** A product's crunch exposure multiplier: its supplier's resilience, halved if it's dual-sourced. */
export const supplierCrunchMult = (p: Product): number =>
  supplierFor(p.supplierId).crunchMult * (p.dualSource ? BALANCE.supply.dualSource.riskMult : 1);

/** A company's exposure to a supply-crunch shock, derived from the parts it's actually sourcing:
 *  the average resilience of in-production builds; if nothing is building, the most recent shipped
 *  product's sourcing posture; otherwise neutral (1). Premium sourcing on active orders softens a
 *  crunch; bargain sourcing amplifies it. Pure — takes just the products it should weigh. */
export function sourcingExposure(building: Product[], lastShipped?: Product): number {
  const sources = building.length ? building : lastShipped ? [lastShipped] : [];
  if (!sources.length) return 1;
  return sources.reduce((sum, p) => sum + supplierCrunchMult(p), 0) / sources.length;
}
