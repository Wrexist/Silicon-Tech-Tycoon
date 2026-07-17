// Unified Goals ledger — ONE normalized read of everything the player is currently chasing, folded
// from the three separate goal systems that otherwise each get their own scattered surface:
//   • the objectives ladder (the guided "next move" spine)   — engine/objectives.ts
//   • the rolling contract board (2–3 live directed goals)    — engine/contracts.ts
//   • the post-IPO board mandate (the quarterly directive)    — engine/endgame.ts
// The audit's finding: these are "competing 'what do I chase next' surfaces". This collapses them into
// a single consistent row shape so one screen can show them all with the same grammar.
//
// PURE + read-only: it only reads state the engine already tracks and calls the systems' own pure
// evaluators. It never mutates anything, so determinism is untouched (nothing new enters the sim).
import { currentObjective } from "../engine/objectives.ts";
import { contractProgress, rewardSummary as contractRewardSummary } from "../engine/contracts.ts";
import { mandateProgress, mandateComplete, mandateRewardSummary } from "../engine/endgame.ts";
import { sideOrderPayout } from "../engine/sideOrders.ts";
import { format } from "../engine/money.ts";
import { contractFacts, mandateFacts, type GameState } from "./gameState.ts";

export type GoalSource = "objective" | "contract" | "mandate" | "sideOrder" | "award";

/** The awards ceremony runs every this-many weeks (mirrors the tick's `week % 52` gate). */
const AWARDS_CYCLE_WEEKS = 52;

export interface GoalRow {
  /** Stable key for React lists. */
  key: string;
  source: GoalSource;
  /** Human label for where this goal comes from ("Next move" / "Contract" / "Board mandate"). */
  sourceLabel: string;
  title: string;
  detail?: string;
  /** 0..1 progress, or null when the goal is qualitative (a next-move step with no metric bar). */
  frac: number | null;
  /** Short progress caption, e.g. "Step 3 of 12" — optional. */
  progressText?: string;
  /** Human reward summary, when the goal pays out on completion. */
  reward?: string;
  /** Weeks remaining before it expires, when time-boxed (contracts / mandates). */
  weeksLeft?: number;
  done: boolean;
  /** A completed contract sitting on the board, waiting for the player to claim its reward. */
  claimable?: boolean;
  /** Contract id — present only for claimable contract rows, so the UI can wire the Claim action. */
  contractId?: string;
  /** Lucide icon name for objective rows (resolved to a component in the UI). */
  icon?: string;
}

/** Fold all active goals into one ordered ledger. Order: the guided next-move first (what a new player
 *  should do now), then the directed contracts, then the standing board mandate. */
export function collectGoals(state: GameState): GoalRow[] {
  const rows: GoalRow[] = [];
  const week = state.week;

  // 1) The current guided objective (the single "next move"), if the ladder isn't finished.
  const obj = currentObjective(state);
  if (obj) {
    rows.push({
      key: `objective:${obj.objective.id}`,
      source: "objective",
      sourceLabel: "Next move",
      title: obj.objective.label,
      detail: obj.objective.detail,
      frac: obj.total > 0 ? obj.step / obj.total : null,
      progressText: `Step ${obj.step} of ${obj.total}`,
      done: false,
      icon: obj.objective.icon,
    });
  }

  // 2) The rolling contract board.
  const cf = contractFacts(state);
  for (const c of state.contracts ?? []) {
    const p = contractProgress(c, cf);
    rows.push({
      key: `contract:${c.id}`,
      source: "contract",
      sourceLabel: "Contract",
      title: c.title,
      detail: c.blurb,
      frac: p.frac,
      reward: contractRewardSummary(c.reward),
      weeksLeft: Math.max(0, c.expiresWeek - week),
      done: p.done,
      claimable: p.done,
      contractId: c.id,
    });
  }

  // 3) The standing board mandate (post-IPO only).
  const m = state.boardMandate ?? null;
  if (m) {
    const mf = mandateFacts(state);
    rows.push({
      key: `mandate:${m.id}`,
      source: "mandate",
      sourceLabel: "Board mandate",
      title: m.title,
      frac: mandateProgress(m, mf),
      reward: mandateRewardSummary(m),
      weeksLeft: Math.max(0, m.dueWeek - week),
      done: mandateComplete(m, mf),
    });
  }

  // 4) A running side order (a client commission on the line). A real progress bar — weeks on the line
  //    vs the fixed run — paying out on delivery. (The pending OFFER stays its own accept/decline
  //    decision; only an accepted, in-production order is something you're actively "chasing".)
  const so = state.activeSideOrder ?? null;
  if (so) {
    const elapsed = week - so.startedWeek;
    const dueWeek = so.startedWeek + so.weeksNeeded;
    rows.push({
      key: `sideOrder:${so.id}`,
      source: "sideOrder",
      sourceLabel: "Side order",
      title: `${so.clientName} · ${so.units.toLocaleString()} units`,
      detail: so.blurb,
      frac: so.weeksNeeded > 0 ? Math.max(0, Math.min(1, elapsed / so.weeksNeeded)) : 1,
      reward: `${format(sideOrderPayout(so))} on delivery`,
      weeksLeft: Math.max(0, dueWeek - week),
      done: elapsed >= so.weeksNeeded,
    });
  }

  // 5) The annual Silicon Awards — a standing seasonal chase, once you've shipped something to be judged.
  //    Ceremonies land every 52 weeks; the "progress" is how far through the current awards year you are,
  //    and the detail is how many of your launches are eligible so far (recurring, so never "done").
  if (state.launched.length >= 1) {
    const lastCeremony = Math.floor(week / AWARDS_CYCLE_WEEKS) * AWARDS_CYCLE_WEEKS;
    const nextCeremony = lastCeremony + AWARDS_CYCLE_WEEKS;
    const eligible = state.launched.filter((lp) => lp.launchedWeek > lastCeremony).length;
    rows.push({
      key: `award:y${nextCeremony}`,
      source: "award",
      sourceLabel: "Silicon Awards",
      title: "The annual Silicon Awards",
      detail: eligible > 0
        ? `${eligible} of your launches this year are in the running.`
        : "Ship a device this year to enter the running.",
      frac: Math.max(0, Math.min(1, (week - lastCeremony) / AWARDS_CYCLE_WEEKS)),
      reward: "Reputation & fans",
      weeksLeft: Math.max(0, nextCeremony - week),
      done: false,
    });
  }

  return rows;
}

/** How many goals are actionable right now (a claimable contract) — for a small nav/badge count. */
export function claimableGoalCount(state: GameState): number {
  return collectGoals(state).filter((g) => g.claimable).length;
}
