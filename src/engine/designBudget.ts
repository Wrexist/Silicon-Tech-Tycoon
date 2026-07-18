// Design Budget (FEATURES_RANKED #1) — a per-project ENGINEERING-POINTS (EP) cap on a product's
// component complexity, so "max every slot" stops being the default answer. Each applicable component
// slot's chosen tier costs its own tier number in EP (T1 = 1 EP … T7 = 7 EP); the sum can't exceed the
// project's budget, which is an era-scaled base plus permanent raises earned from a few engineering
// research projects. Early on the budget is tight enough that maxing is impossible (2-3 real
// sacrifices); by the late era a fully-invested player can nearly max — so budget raises are a new
// reward line and every launch is a trade-off puzzle.
//
// PURE. No GameState, no RNG. Design-tier / refresh / storage / camera-count are deliberately OUT of
// scope: it's the component TIER ladder that drives the auto-pilot, and keeping the meter to the six
// component lines keeps "used / total EP" legible in the Lab. Enforcement lives at the build-commit
// action (state/gameState.startBuild), gated on state.designBudgetEnabled — never in product math — so
// engine tests constructing arbitrary products, the rival generator, and old saves are all untouched.
import { BALANCE } from "./balance.ts";
import { CATEGORIES } from "./catalogs.ts";
import { hasProject, type ProjectId } from "./research.ts";
import type { Product } from "./types.ts";

/** EP a single chosen tier spends — the tier number itself (T1 = 1 … T7 = 7). A non-finite / unset /
 *  sub-1 tier costs 0 (an incomplete draft simply spends less; the missing-slot gate blocks the build). */
export function slotEp(tier: number | undefined): number {
  if (tier == null || !Number.isFinite(tier) || tier < 1) return 0;
  return Math.floor(tier);
}

/** Total EP a product's component selection spends — summed over its CATEGORY's applicable slots only
 *  (so a 3-slot desktop naturally spends fewer EP than a 6-slot phone, and is less constrained by design). */
export function productEp(product: Product): number {
  const slots = CATEGORIES[product.category]?.slots ?? [];
  let ep = 0;
  for (const kind of slots) ep += slotEp(product.tiers[kind]);
  return ep;
}

/** Research projects that PERMANENTLY raise the per-project EP budget, and by how much. All are
 *  engineering-flavoured — a prototype bench, tighter component standards, an integrated/dominant supply
 *  chain, a research singularity — so the budget line grows as the company's engineering matures. Total
 *  = +12 EP fully invested, which lets a late-era, fully-invested player nearly max every slot. */
export const EP_BUDGET_RAISES: readonly { project: ProjectId; ep: number }[] = [
  { project: "prototypeBench", ep: 2 },      // era 1 — deeper prototyping bandwidth
  { project: "componentStandards", ep: 2 },  // era 1 — standardised parts integrate for less overhead
  { project: "verticalIntegration", ep: 2 }, // era 3 — owning the stack frees engineering headroom
  { project: "platformDominance", ep: 3 },   // era 3 capstone — a mature platform carries more complexity
  { project: "singularityLab", ep: 3 },      // era 4 capstone — AI-assisted design lifts the ceiling
];

/** Sum of EP raises the completed projects have earned (0 for a fresh company). */
export function epRaisesEarned(completed: readonly ProjectId[]): number {
  let ep = 0;
  for (const r of EP_BUDGET_RAISES) if (hasProject(completed, r.project)) ep += r.ep;
  return ep;
}

/** The era-scaled base EP budget (before raises), clamped to the table's range. Index = era − 1. */
export function epBudgetBase(era: number): number {
  const t = BALANCE.designBudget.baseByEra;
  return t[Math.max(1, Math.min(era, t.length)) - 1] ?? t[t.length - 1];
}

/** The full per-project EP budget for a company: era base + earned raises. */
export function epBudget(era: number, completed: readonly ProjectId[]): number {
  return epBudgetBase(era) + epRaisesEarned(completed);
}

/** Whether a product's component selection fits the company's current EP budget. */
export function epFits(product: Product, era: number, completed: readonly ProjectId[]): boolean {
  return productEp(product) <= epBudget(era, completed);
}
