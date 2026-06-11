// HQ office upgrades — tiered equipment bought with cash that scale the whole company.
// PURE catalog + effect helpers; state holds the per-line tier.
import { dollars, type Money } from "./money.ts";
import type { ProjectId } from "./research.ts";

export type UpgradeId =
  | "computers"
  | "designSuite"
  | "testLab"
  | "marketing"
  | "amenities"
  | "assembly";

export interface UpgradeLine {
  id: UpgradeId;
  name: string;
  blurb: string;
  icon: string; // lucide icon name (resolved in the UI)
  maxTier: number;
  tierNames: string[]; // index 0 = tier 1
  baseCost: number; // dollars for tier 1
  growth: number; // cost multiplier per tier
  effectAt: (tier: number) => string; // human-readable effect at a given tier
  /** Tiers at/above `fromTier` stay LOCKED (masked grey in the UI) until your team finishes the
   *  research `project` — the most advanced equipment must be earned through R&D, not just cash. */
  requires?: { project: ProjectId; fromTier: number };
}

export const UPGRADE_LINES: UpgradeLine[] = [
  {
    id: "computers",
    name: "Workstations",
    blurb: "Faster machines speed up research for the whole team.",
    icon: "Cpu",
    maxTier: 5,
    tierNames: ["Office PCs", "Workstations", "Pro Rigs", "Render Farm", "Quantum Cluster"],
    baseCost: 9_000,
    growth: 2.3,
    effectAt: (t) => `+${t * 15}% research`,
  },
  {
    id: "designSuite",
    name: "Design Suite",
    blurb: "Pro design tools raise quality and the design ceiling.",
    icon: "PencilRuler",
    maxTier: 5,
    tierNames: ["Sketchpads", "CAD Suite", "3D Studio", "Generative Tools", "AI Design Lab"],
    baseCost: 11_000,
    growth: 2.3,
    effectAt: (t) => `+${t} design ceiling, +${t * 2} Design`,
  },
  {
    id: "testLab",
    name: "Test Lab",
    blurb: "QA catches flaws, lifting every product's quality.",
    icon: "FlaskConical",
    maxTier: 5,
    tierNames: ["Bench Test", "QA Lab", "Climate Chamber", "Reliability Lab", "Certification Center"],
    baseCost: 14_000,
    growth: 2.4,
    effectAt: (t) => `+${t * 2} Quality`,
  },
  {
    id: "marketing",
    name: "Marketing Suite",
    blurb: "Amplify the hype behind every launch.",
    icon: "Megaphone",
    maxTier: 5,
    tierNames: ["Social Desk", "PR Team", "Ad Studio", "Brand Agency", "Global Campaign"],
    baseCost: 13_000,
    growth: 2.4,
    effectAt: (t) => `+${t * 8}% launch hype`,
    requires: { project: "brandStudio", fromTier: 4 },
  },
  {
    id: "amenities",
    name: "Amenities",
    blurb: "A happier team does better work.",
    icon: "Coffee",
    maxTier: 5,
    tierNames: ["Coffee Bar", "Lounge", "Game Room", "Gym", "Wellness Suite"],
    baseCost: 7_000,
    growth: 2.2,
    effectAt: (t) => `+${t * 5} team mood`,
  },
  {
    id: "assembly",
    name: "Assembly",
    blurb: "Build products faster and cheaper.",
    icon: "Factory",
    maxTier: 5,
    tierNames: ["Hand Assembly", "Workcell", "Conveyor", "Robotic Line", "Lights-Out Factory"],
    baseCost: 16_000,
    growth: 2.5,
    effectAt: (t) => `−${(t * 0.5).toFixed(1)} build wk, −${t * 5}% cost`,
    requires: { project: "verticalIntegration", fromTier: 4 },
  },
];

/** The research project (if any) BLOCKING the given next tier of a line — null when the tier is
 *  buyable. `completed` is the player's finished project ids. Pure; used by the UI to grey-mask
 *  a locked upgrade and by buyUpgrade to refuse the purchase. */
export function upgradeLockedBy(id: UpgradeId, nextTier: number, completed: readonly ProjectId[]): ProjectId | null {
  const req = upgradeLine(id).requires;
  if (!req || nextTier < req.fromTier || completed.includes(req.project)) return null;
  return req.project;
}

export function upgradeLine(id: UpgradeId): UpgradeLine {
  return UPGRADE_LINES.find((l) => l.id === id)!;
}

/** Cash cost to go from the current tier to the next (null if maxed). */
export function nextUpgradeCost(id: UpgradeId, currentTier: number): Money | null {
  const line = upgradeLine(id);
  if (currentTier >= line.maxTier) return null;
  return dollars(Math.round(line.baseCost * Math.pow(line.growth, currentTier)));
}

// ---- Effect helpers (take the per-line tier; default 0) ----
type Tiers = Partial<Record<UpgradeId, number>>;
const tier = (u: Tiers, id: UpgradeId) => u[id] ?? 0;

export const rpMultiplier = (u: Tiers) => 1 + tier(u, "computers") * 0.15;
export const designCeilingBonus = (u: Tiers) => tier(u, "designSuite");
export const designStatBonus = (u: Tiers) => tier(u, "designSuite") * 2;
export const qualityStatBonus = (u: Tiers) => tier(u, "testLab") * 2;
export const marketingHype = (u: Tiers) => tier(u, "marketing") * 0.08;
export const moodBonus = (u: Tiers) => tier(u, "amenities") * 5;
export const buildWeekReduction = (u: Tiers) => tier(u, "assembly") * 0.5;
export const buildCostMult = (u: Tiers) => 1 - tier(u, "assembly") * 0.05;
