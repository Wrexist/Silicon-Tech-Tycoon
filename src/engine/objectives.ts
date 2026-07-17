// "Next Move" objective spine — PURE data + a pure evaluator. No React/DOM, fully unit-tested.
//
// Why this exists: the game is deep, and the first-build Coach hands off at the first launch
// (tutorialDone). After that a new player can fall off a cliff — they understand the loop but not
// what to chase next. This is a single, ORDERED ladder of concrete next steps that walks the player
// through the systems (hire → research → era → upgrades → Platform → IPO), showing exactly ONE goal
// at a time on HQ. It is guidance, not a chore: dismissible by simply doing the thing, never a nag,
// and it gates nothing (the systems gate themselves elsewhere).
//
// Mirrors engine/achievements.ts: a pure catalog + predicates that read ONLY state the engine
// already tracks, plus a "newly satisfied" diff the state layer announces. Completion is latched by
// the caller (state.completedObjectives) so a transient dip can never resurrect a finished goal.
import type { GameState } from "../state/gameState.ts";
import { MEGAPROJECTS } from "./endgame.ts";

/** Deep-link nav targets — structurally identical to the UI's `Tab` union, declared here so the
 *  engine stays free of any React-component import (golden rule: engine/ imports no React/DOM). */
export type ObjectiveTab = "hq" | "design" | "research" | "market" | "company";

/** A Lucide icon NAME (resolved to a component in the UI layer — the engine stays DOM-free). */
export type ObjectiveIconName =
  | "Rocket"
  | "UserPlus"
  | "Repeat"
  | "FlaskConical"
  | "Sparkles"
  | "TrendingUp"
  | "Wrench"
  | "Layers"
  | "Building2"
  | "Trophy"
  | "Crown"
  | "Cpu";

export interface Objective {
  id: string;
  /** The imperative one-liner — the "Next move". */
  label: string;
  /** One short line on WHY it matters / how to do it. */
  detail: string;
  /** Deep-link target so tapping the card takes the player straight to the right screen. */
  tab: ObjectiveTab;
  /** Button text for the deep-link. */
  cta: string;
  icon: ObjectiveIconName;
  /** Satisfied? Reads only already-tracked state. */
  done: (s: GameState) => boolean;
}

const ownsAnyUpgrade = (s: GameState): boolean =>
  Object.values(s.upgrades).some((tier) => (tier ?? 0) > 0);

/** The ladder — single source of truth, ordered from garage to global. The player is always shown
 *  the FIRST entry they haven't finished, so this list IS the intended progression sequence. */
export const OBJECTIVES: readonly Objective[] = [
  {
    id: "first-launch",
    label: "Launch your first product",
    detail: "Design a device, plan its production run, and ship it to market.",
    tab: "design",
    cta: "Open the Design Lab",
    icon: "Rocket",
    done: (s) => s.launched.length >= 1,
  },
  {
    id: "hire-first",
    label: "Hire your first teammate",
    detail: "Extra hands build faster and bank Research Points each week.",
    tab: "company",
    cta: "Go to Company",
    icon: "UserPlus",
    done: (s) => s.staff.length >= 2,
  },
  {
    id: "second-launch",
    label: "Ship a second product",
    detail: "Reinvest your earnings into the next device, momentum compounds.",
    tab: "design",
    cta: "Open the Design Lab",
    icon: "Repeat",
    done: (s) => s.launched.length >= 2,
  },
  {
    id: "first-research",
    label: "Complete a research project",
    detail: "Spend Research Points on a project for a permanent, company-wide boost.",
    tab: "research",
    cta: "Open R&D",
    icon: "FlaskConical",
    done: (s) => s.completedProjects.length >= 1,
  },
  {
    id: "first-hit",
    label: "Land a hit product",
    detail: "Match the market's wants and price it right to score a hit.",
    tab: "design",
    cta: "Open the Design Lab",
    icon: "Sparkles",
    done: (s) => s.launched.some((lp) => lp.verdict === "hit"),
  },
  {
    id: "reach-era2",
    label: "Reach the Growth Era",
    detail: "Build reputation and revenue to graduate out of the garage.",
    tab: "research",
    cta: "View the roadmap",
    icon: "TrendingUp",
    done: (s) => s.era >= 2,
  },
  {
    id: "first-upgrade",
    label: "Buy an office upgrade",
    detail: "Upgrades permanently lift your team, research, design, quality, or hype.",
    tab: "hq",
    cta: "Open Office upgrades",
    icon: "Wrench",
    done: ownsAnyUpgrade,
  },
  {
    id: "reach-era3",
    label: "Reach the Platform Era",
    detail: "Keep shipping and building reputation to graduate into Era 3.",
    tab: "research",
    cta: "View the roadmap",
    icon: "Layers",
    done: (s) => s.era >= 3,
  },
  {
    id: "found-platform",
    label: "Found the Platform division",
    detail: "Turn your OS into a business of its own, recurring services and licensing.",
    tab: "company",
    cta: "Go to Company",
    icon: "Layers",
    done: (s) => s.platformUnlocked,
  },
  {
    id: "reach-era4",
    label: "Reach the AI Era",
    detail: "The AI Era — the commercial pinnacle, where the biggest launches and the IPO await (a post-IPO Autonomy Era lies beyond).",
    tab: "research",
    cta: "View the roadmap",
    icon: "Cpu",
    done: (s) => s.era >= 4,
  },
  {
    id: "go-public",
    label: "Take the company public",
    detail: "IPO on the exchange for a major cash infusion once you're established.",
    tab: "market",
    cta: "Open the Market",
    icon: "Building2",
    done: (s) => s.listed,
  },
  {
    id: "reach-pinnacle",
    label: "Reach the industry pinnacle",
    detail: "Go public and cement your legacy at the top of the industry.",
    tab: "market",
    cta: "Open the Market",
    icon: "Trophy",
    done: (s) => s.wentPublic,
  },
  // --- Post-IPO: the Legacy Era spine, so the longest stretch of the game stays directed ---
  {
    id: "fund-megaproject",
    label: "Fund a moonshot megaproject",
    detail: "Sink cash + research into a Legacy-Era megaproject for a permanent payoff and Legacy Points.",
    tab: "hq",
    cta: "Open the Office",
    icon: "Rocket",
    done: (s) => (s.megaprojectsFunded?.length ?? 0) >= 1,
  },
  {
    id: "spend-legacy-point",
    label: "Invest a Legacy Point",
    detail: "Spend the Legacy Points your megaprojects bank on a permanent boon in the Legacy tree.",
    tab: "hq",
    cta: "Open the Office",
    icon: "Sparkles",
    done: (s) => (s.legacyPerks?.length ?? 0) >= 1,
  },
  {
    id: "reach-number-one",
    label: "Become the #1 company",
    detail: "Overtake every rival to claim the top of the industry leaderboard.",
    tab: "market",
    cta: "Open the Market",
    icon: "Crown",
    done: (s) => (s.bestIndustryRank ?? 99) <= 1,
  },
  {
    id: "fund-all-megaprojects",
    label: "Fund every megaproject",
    detail: "Complete the full moonshot slate — a legacy without equal.",
    tab: "hq",
    cta: "Open the Office",
    icon: "Building2",
    done: (s) => (s.megaprojectsFunded?.length ?? 0) >= MEGAPROJECTS.length,
  },
];

export const OBJECTIVE_COUNT = OBJECTIVES.length;

const OBJECTIVE_BY_ID: Map<string, Objective> = new Map(OBJECTIVES.map((o) => [o.id, o]));

export function objectiveById(id: string): Objective | undefined {
  return OBJECTIVE_BY_ID.get(id);
}

export interface ObjectiveProgress {
  objective: Objective;
  /** 1-based position of this objective in the ladder (for "Step N of M"). */
  step: number;
  total: number;
}

/**
 * The player's current next move: the first objective that is neither latched-complete nor already
 * satisfied by the live state. Returns null when the whole ladder is done (free play). Pure.
 *
 * Skipping on `done(s)` as well as the latched set means the card advances INSTANTLY after an action
 * (e.g. founding the Platform) even before the state layer writes the completion latch.
 */
export function currentObjective(s: GameState, completed: readonly string[] = s.completedObjectives ?? []): ObjectiveProgress | null {
  const done = new Set(completed);
  for (let i = 0; i < OBJECTIVES.length; i++) {
    const o = OBJECTIVES[i];
    if (done.has(o.id) || o.done(s)) continue;
    return { objective: o, step: i + 1, total: OBJECTIVES.length };
  }
  return null;
}

/** All objective ids currently satisfied by the state. Pure. */
export function satisfiedObjectiveIds(s: GameState): string[] {
  return OBJECTIVES.filter((o) => o.done(s)).map((o) => o.id);
}

/** Ids satisfied now AND not in the previously-completed set — the ones the state layer should
 *  celebrate this evaluation. Order follows the ladder. Pure. */
export function newlyCompletedObjectives(previous: readonly string[], s: GameState): string[] {
  const had = new Set(previous);
  return OBJECTIVES.filter((o) => !had.has(o.id) && o.done(s)).map((o) => o.id);
}
