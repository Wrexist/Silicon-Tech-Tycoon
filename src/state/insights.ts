// The advisory "hints" engine behind HQ's Next-move card — the ranked, ordered list of concrete
// suggestions the game makes when it notices something the player could act on (idle staff, an
// affordable project, a product about to fall off the shelf).
//
// This used to live inline in screens/HQ.tsx as a 280-line render function, which meant the game's
// entire coaching voice was untestable and invisible next to the objective ladder it competed with.
// Extracted here as PURE data + predicates, mirroring engine/objectives.ts: Lucide icons are carried
// as NAMES and resolved to components in the UI layer, so this module stays free of React/DOM.
//
// It lives in state/ rather than engine/ because the predicates read derived helpers that live on the
// state layer (runway, desk capacity, upgrade pricing) — engine/ must never import state/ for values.
import { BALANCE } from "../engine/balance.ts";
import { CATEGORY_LIST } from "../engine/catalogs.ts";
import { runwayWeeks } from "../engine/economy.ts";
import { STAT_INFO } from "../engine/glossary.ts";
import { format } from "../engine/money.ts";
import type { ObjectiveTab } from "../engine/objectives.ts";
import { REGIONS } from "../engine/regions.ts";
import { RESEARCH_PROJECTS, forkLockedBy, type ProjectId } from "../engine/research.ts";
import { STAT_KEYS, type CategoryId } from "../engine/types.ts";
import { UPGRADE_LINES } from "../engine/upgrades.ts";
import { deskCapacity, nextWeekRevenue, upgradeCost, weeklyOutflow, type GameState } from "./gameState.ts";

/** A Lucide icon NAME, resolved to a component by the UI (same contract as ObjectiveIconName). */
export type InsightIconName =
  | "Users" | "FlaskConical" | "Megaphone" | "TrendingUp" | "TrendingDown" | "Rocket"
  | "Clock" | "ArrowUp" | "Shapes" | "Target" | "Sparkles";

/** One advisory hint. `id` is stable so the Next-move card can drop hints the active objective
 *  already states (see `OBJECTIVE_SUBSUMES`) — before the merge, HQ showed a "Next move" card and a
 *  separate "Strategic insights" card that could tell the player the same thing twice, in two
 *  different voices, ten cards apart. */
export interface Insight {
  id: string;
  icon: InsightIconName;
  text: string;
  tab?: ObjectiveTab;
}

/** How many hints to COLLECT. The card shows fewer (`INSIGHT_SHOWN`); the spare covers the case where
 *  the top hint is deduped away against the objective, so the card doesn't shrink for it. */
const INSIGHT_POOL = 4;
/** How many hints to SHOW beneath the objective. Two, deliberately: the primary objective is already
 *  a directive, and three more turned the home screen into four competing instructions. */
export const INSIGHT_SHOWN = 2;

/** Hints an active objective already covers, so the merged card never says the same thing twice. */
export const OBJECTIVE_SUBSUMES: Record<string, readonly string[]> = {
  "first-launch": ["drought", "ending-soon", "decline", "untapped-category", "trend"],
  "hire-first": ["hire", "idle-staff", "marketer"],
  "second-launch": ["drought", "ending-soon", "decline"],
  "first-research": ["research-ready", "doctrine"],
  "first-hit": ["breakout-tier", "breakout-hype", "breakout-trend", "trend"],
  "first-upgrade": ["upgrade"],
  "spend-legacy-point": ["legacy-points"],
};

// Full stat labels derive from the single source (glossary STAT_INFO) so they can't drift.
const INSIGHT_STAT_LABEL: Record<string, string> = Object.fromEntries(STAT_KEYS.map((k) => [k, STAT_INFO[k].label]));

export function strategicInsights(state: GameState): Insight[] {
  const insights: Insight[] = [];

  // 1. Idle staff — most immediately actionable
  const idleCount = state.staff.filter((s) => s.assignment === "idle").length;
  if (idleCount > 0) {
    insights.push({
      id: "idle-staff",
      icon: "Users",
      text: `${idleCount} staff member${idleCount > 1 ? "s are" : " is"} unassigned, assign them to R&D or Marketing to compound output.`,
      tab: "company",
    });
  }

  // 2. Affordable research project — same eligibility Research itself applies, INCLUDING the
  // doctrine fork: never nudge toward a project the player's chosen fork has padlocked.
  const rp = Math.floor(state.researchPoints);
  const nextProject = RESEARCH_PROJECTS
    .filter((p) => !state.completedProjects.includes(p.id) && p.era <= state.era && p.rpCost <= rp && !forkLockedBy(state.completedProjects, p.id))
    .sort((a, b) => a.rpCost - b.rpCost)[0];
  if (nextProject) {
    insights.push({
      id: "research-ready",
      icon: "FlaskConical",
      text: `You have ${rp} RP, enough to unlock "${nextProject.name}". Head to Research to claim it.`,
      tab: "research",
    });
  }

  // 3. Product drought — no active products and nothing in the pipeline
  const active = state.launched.filter((lp) => lp.weeksElapsed < lp.weeklyUnits.length);
  const inPipeline = state.building.length > 0 || state.ready.length > 0;

  // 2b. Breakout coaching — the recent launches keep landing "steady" and never break out. Read the
  // latest launch's recorded drivers and name the ONE biggest lever, so a stuck player gets a
  // specific, proactive nudge toward their first "solid"/hit instead of grinding identical sellers.
  if (insights.length < INSIGHT_POOL && state.launched.length >= 2) {
    const recent = state.launched.slice(0, 3); // newest first (prepended on launch)
    const brokeOut = recent.some((lp) => lp.verdict === "hit" || lp.verdict === "solid");
    const ins = state.launched.find((lp) => lp.insight)?.insight;
    if (!brokeOut && ins) {
      const hasMarketer = state.staff.some((s) => s.assignment === "marketing");
      if (ins.betterRivals >= 1) {
        insights.push({
          id: "breakout-tier",
          icon: "FlaskConical",
          text: 'Your launches keep landing "steady" because rivals outclass them, raise component tiers in R&D to break out with a "solid" or a hit.',
          tab: "research",
        });
      } else if (ins.hype < 1.15) {
        insights.push(
          hasMarketer
            ? { id: "breakout-hype", icon: "Megaphone", text: 'Your products sell steadily but lack buzz, add a launch campaign to push the next one past "steady".', tab: "market" }
            : { id: "breakout-hype", icon: "Megaphone", text: 'Your products sell steadily but lack buzz, put someone on Marketing to lift launch hype and break past "steady".', tab: "company" },
        );
      } else if (ins.demandFit < 45) {
        insights.push({
          id: "breakout-trend",
          icon: "TrendingUp",
          text: 'Your launches keep just missing the trend, check Market demand before your next design to land a "solid".',
          tab: "market",
        });
      }
    }
  }

  if (insights.length < INSIGHT_POOL) {
    if (active.length === 0 && !inPipeline) {
      insights.push({
        id: "drought",
        icon: "Rocket",
        text: "All products have finished their run, design and launch a new one to keep revenue flowing.",
        tab: "design",
      });
    }
  }

  // 3b. Products ending soon — warn the player to start designing a successor
  if (insights.length < INSIGHT_POOL && !inPipeline) {
    const endingSoon = active.filter((lp) => (lp.weeklyUnits.length - lp.weeksElapsed) <= 4);
    if (endingSoon.length > 0) {
      const name = endingSoon.length === 1 ? endingSoon[0].product.name : `${endingSoon.length} products`;
      insights.push({
        id: "ending-soon",
        icon: "Clock",
        text: `${name} ${endingSoon.length === 1 ? "finishes" : "finish"} selling in ≤4 weeks, start a successor now to keep revenue continuous.`,
        tab: "design",
      });
    }
  }

  // 3c. Low staff morale
  if (insights.length < INSIGHT_POOL && state.staff.length > 0) {
    const unhappy = state.staff.filter((s) => s.mood < 28);
    if (unhappy.length > 0) {
      insights.push({
        id: "morale",
        icon: "Users",
        text: `${unhappy[0].name} has very low morale (${Math.round(unhappy[0].mood)}%), upgrade Amenities or reduce workload to prevent an output slump.`,
        tab: "company",
      });
    }
  }

  // 3d. Affordable HQ upgrade
  if (insights.length < INSIGHT_POOL) {
    const affordableUpgrade = UPGRADE_LINES.find((line) => {
      const cur = state.upgrades[line.id] ?? 0;
      if (cur >= line.maxTier) return false;
      const cost = upgradeCost(state, line.id);
      return cost !== null && state.cash >= cost;
    });
    if (affordableUpgrade) {
      const cur = state.upgrades[affordableUpgrade.id] ?? 0;
      const cost = upgradeCost(state, affordableUpgrade.id)!;
      insights.push({
        id: "upgrade",
        icon: "ArrowUp",
        text: `Your ${affordableUpgrade.name} can be upgraded to "${affordableUpgrade.tierNames[cur]}" for ${format(cost)}, unlocks ${affordableUpgrade.effectAt(cur + 1)}.`,
      });
    }
  }

  // 4. Rising market trend worth exploiting
  if (insights.length < INSIGHT_POOL) {
    const top = [...STAT_KEYS].sort((a, b) => {
      const da = (state.trends.targetWeights[a] ?? 0) - (state.trends.weights[a] ?? 0);
      const db = (state.trends.targetWeights[b] ?? 0) - (state.trends.weights[b] ?? 0);
      return db - da;
    })[0];
    const topDelta = top ? (state.trends.targetWeights[top] ?? 0) - (state.trends.weights[top] ?? 0) : 0;
    if (top && topDelta > 0.025) {
      insights.push({
        id: "trend",
        icon: "TrendingUp",
        text: `${INSIGHT_STAT_LABEL[top]} demand is climbing, your next product should prioritize it to ride the wave.`,
        tab: "design",
      });
    }
  }

  // 5. Untapped category (blue-ocean opportunity)
  if (insights.length < INSIGHT_POOL) {
    const shippedCats = new Set(state.launched.map((lp) => lp.product.category));
    const unshipped = CATEGORY_LIST.filter((c) => c.unlockEra <= state.era && !shippedCats.has(c.id));
    if (unshipped.length > 0) {
      insights.push({
        id: "untapped-category",
        icon: "Shapes",
        text: `You haven't shipped a ${unshipped[0].displayName} yet, an open market segment with no competition from you.`,
        tab: "design",
      });
    }
  }

  // 6. Rival gaining strength in a category you're actively selling in
  if (insights.length < INSIGHT_POOL) {
    let threatComp: (typeof state.competitors)[0] | null = null;
    let threatCat: CategoryId | null = null;
    for (const comp of state.competitors) {
      for (const [cat, str] of Object.entries(comp.strengthByCategory)) {
        if (active.some((lp) => lp.product.category === cat) && (str ?? 0) >= 45) {
          threatComp = comp;
          threatCat = cat as CategoryId;
          break;
        }
      }
      if (threatComp) break;
    }
    if (threatComp && threatCat) {
      const catDef = CATEGORY_LIST.find((c) => c.id === threatCat);
      const strength = Math.round(threatComp.strengthByCategory[threatCat] ?? 0);
      insights.push({
        id: "rival-threat",
        icon: "TrendingDown",
        text: `${threatComp.name} (strength ${strength}) is a strong rival in ${catDef?.displayName ?? threatCat}s, spec up your next launch to stay ahead.`,
        tab: "market",
      });
    }
  }

  // 7. Open desks + healthy runway = good time to hire
  if (insights.length < INSIGHT_POOL && state.staff.length >= 1) {
    // Hiring is gated by PLACED desks, not raw facility headcount, so count actual open seats
    // (deskCapacity) — otherwise this could claim desks that haven't been placed yet.
    const openDesks = deskCapacity(state) - state.staff.length;
    const wkRevH = nextWeekRevenue(state);
    const runwayH = runwayWeeks(state.cash, weeklyOutflow(state), wkRevH);
    if (openDesks >= 1 && runwayH > 30) {
      insights.push({
        id: "hire",
        icon: "Users",
        text: `${openDesks} desk${openDesks > 1 ? "s" : ""} open and ${runwayH === Infinity ? "you are profitable" : `${runwayH}+ weeks of runway`}, a strong time to recruit.`,
        tab: "company",
      });
    }
  }

  // 8. No marketer on team while launching products — missing hype boost
  if (insights.length < INSIGHT_POOL && state.staff.length >= 2) {
    const hasAnyMarketer = state.staff.some((s) => s.assignment === "marketing");
    const hasLaunched = state.launched.length > 0;
    if (!hasAnyMarketer && hasLaunched) {
      insights.push({
        id: "marketer",
        icon: "Megaphone",
        text: "No one is assigned to Marketing, each launch is missing a hype bonus that boosts sales velocity. Assign a team member or hire a marketer.",
        tab: "company",
      });
    }
  }

  // 9. All launched products are in decline — prompt a new launch
  if (insights.length < INSIGHT_POOL && active.length > 0 && !inPipeline) {
    const peakWk = BALANCE.sales.peakWeek;
    const allDecline = active.every((lp) => lp.weeksElapsed > peakWk);
    if (allDecline) {
      insights.push({
        id: "decline",
        icon: "Rocket",
        text: `All ${active.length === 1 ? "your active product has" : `${active.length} active products have`} passed their sales peak, launch something new now to capture fresh demand before revenue fades.`,
        tab: "design",
      });
    }
  }

  // 10. Depth-system nudges — once the core-loop hints are satisfied, point the player at the strategic
  // systems they may never have discovered (design briefs, doctrines, expansion, the Legacy tree).
  // 10a. Never committed a Design Brief — targeting a segment earns bonus rep + fans.
  if (insights.length < INSIGHT_POOL && state.launched.length >= 3 && !state.launched.some((lp) => lp.product.targetSegment)) {
    insights.push({
      id: "design-brief",
      icon: "Target",
      text: "You've never set a Design Brief — commit a product to a target segment in the Design Lab for bonus reputation and fans when you nail it.",
      tab: "design",
    });
  }
  // 10b. Past the garage with no engineering doctrine chosen — a permanent company identity is waiting.
  if (insights.length < INSIGHT_POOL && state.era >= 2 && !(["perfHouse", "effHouse", "qualityHouse"] as ProjectId[]).some((id) => state.completedProjects.includes(id))) {
    insights.push({
      id: "doctrine",
      icon: "FlaskConical",
      text: "Pick an engineering doctrine in R&D — a permanent identity (+performance, battery, or quality) stamped on every product you ship.",
      tab: "research",
    });
  }
  // 10c. Still home-only with room to expand — open the first overseas market.
  if (insights.length < INSIGHT_POOL && state.unlockedRegions.length === 1 && state.launched.length >= 2) {
    const firstRegion = REGIONS.find((r) => !state.unlockedRegions.includes(r.id) && state.cash >= r.unlockCost);
    if (firstRegion) {
      insights.push({
        id: "expand",
        icon: "TrendingUp",
        text: `Open ${firstRegion.name} to grow your addressable market — global reach lifts every launch's volume.`,
        tab: "market",
      });
    }
  }
  // 10d. Post-IPO with Legacy Points burning a hole — route them in the Legacy tree.
  if (insights.length < INSIGHT_POOL && state.wentPublic && (state.legacyPoints ?? 0) > 0) {
    insights.push({
      id: "legacy-points",
      icon: "Sparkles",
      text: `You have ${state.legacyPoints} Legacy Point${(state.legacyPoints ?? 0) > 1 ? "s" : ""} to spend — invest them in the Legacy tree for a permanent, build-defining boon.`,
      tab: "hq",
    });
  }

  return insights;
}

/** The hints to show alongside an objective: the ranked list minus anything that objective already
 *  says. The result is deliberately NOT capped — the caller slices it, because how many it can show
 *  depends on whether it also promoted the first hint into the primary slot (which the Next-move card
 *  does once the objective ladder is complete). `objectiveId` is null in exactly that case, and then
 *  nothing is subsumed. Pure. */
export function guidanceHints(state: GameState, objectiveId: string | null): Insight[] {
  const subsumed = new Set(objectiveId ? OBJECTIVE_SUBSUMES[objectiveId] ?? [] : []);
  return strategicInsights(state).filter((h) => !subsumed.has(h.id));
}
