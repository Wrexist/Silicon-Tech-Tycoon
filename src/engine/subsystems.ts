// Category subsystems (Track D): some categories have a signature spec that others don't — a laptop
// or desktop lives or dies on its COOLING, a wearable on its SENSORS. Each is a customizable, tiered
// upgrade (like refresh rate / storage, but gated by CATEGORY) that lifts a stat for a per-unit cost,
// so designing across categories isn't the same five sliders every time. PURE.
import { dollars, type Money } from "./money.ts";
import type { CategoryId, Stats } from "./types.ts";

export interface Subsystem {
  /** Categories that HAVE this subsystem (others never show it). */
  categories: readonly CategoryId[];
  /** Player-facing name of the spec ("Cooling", "Sensors"). */
  name: string;
  /** Labels for each step, index 0 = the free baseline ("Passive"), then each paid upgrade step. */
  optionLabels: readonly string[];
  /** Stat lift PER step above the baseline. */
  perStep: Partial<Stats>;
  /** Per-unit build cost PER step above the baseline. */
  unitCost: Money;
}

/** The catalog. A category has at most ONE subsystem; phones deliberately have none, so the core phone
 *  loop and the phone-only balance sim are untouched. */
export const SUBSYSTEMS: readonly Subsystem[] = [
  {
    categories: ["laptop", "desktop", "console"],
    name: "Cooling",
    optionLabels: ["Passive", "Active Cooling", "Vapor Chamber"],
    perStep: { performance: 8 },
    unitCost: dollars(6),
  },
  {
    categories: ["wearable"],
    name: "Sensors",
    optionLabels: ["Basic", "Health Suite", "Clinical Array"],
    perStep: { ecosystem: 7, quality: 4 },
    unitCost: dollars(5),
  },
];

/** The subsystem available to a category, or null if it has none. */
export function subsystemFor(category: CategoryId): Subsystem | null {
  return SUBSYSTEMS.find((s) => s.categories.includes(category)) ?? null;
}

/** The max upgrade step for a category's subsystem (0 if none). */
export function maxSubsystemStep(category: CategoryId): number {
  const sub = subsystemFor(category);
  return sub ? sub.optionLabels.length - 1 : 0;
}

/** A product's effective subsystem step: its chosen value (default 0), clamped to [0, maxStep]. Zero
 *  for a category with no subsystem, so an unset/old product is a no-op. */
export function effectiveSubsystemStep(category: CategoryId, step: number | undefined): number {
  const max = maxSubsystemStep(category);
  const s = Number.isFinite(step) ? Math.floor(step as number) : 0;
  return Math.max(0, Math.min(max, s));
}

/** The subsystem stat bonus for a product (empty when no subsystem or at the baseline step). */
export function subsystemStatBonus(category: CategoryId, step: number | undefined): Partial<Stats> {
  const sub = subsystemFor(category);
  const steps = effectiveSubsystemStep(category, step);
  if (!sub || steps <= 0) return {};
  const out: Partial<Stats> = {};
  for (const k of Object.keys(sub.perStep) as (keyof Stats)[]) out[k] = (sub.perStep[k] ?? 0) * steps;
  return out;
}

/** The number of paid per-unit cost steps for a product's subsystem (0 when none / baseline). */
export function subsystemCostSteps(category: CategoryId, step: number | undefined): number {
  return effectiveSubsystemStep(category, step);
}
