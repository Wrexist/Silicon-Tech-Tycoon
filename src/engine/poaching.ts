// Rival poaching (Track C: people & company as humans). A rival occasionally tries to HIRE AWAY one
// of your best people, surfaced to the player as a counter-offer decision instead of a silent loss.
// This module is the PURE selection: who gets targeted, and by whom. The state layer turns the result
// into a pending decision (with a retention cost) and applies the outcome.
import { BALANCE } from "./balance.ts";
import type { Rng } from "./rng.ts";
import type { CompetitorState, Staff } from "./types.ts";

export interface PoachTarget {
  staff: Staff;
  rival: CompetitorState;
}

/** Pick a poach target + the rival doing the poaching, or null when no one qualifies. Eligible staff
 *  are non-founder, genuinely skilled, currently CONTENT (a burnout exit is the other, existing path),
 *  and not inside a recent-retention cooldown. The poacher is preferentially a rival ON THE RISE
 *  (ascending/peaking story arc) — a hot company hires — falling back to the whole field. Pure and
 *  deterministic: draws rng ONLY when it has a candidate (rival pick, then target pick). */
export function pickPoachTarget(
  staff: readonly Staff[],
  competitors: readonly CompetitorState[],
  week: number,
  rng: Rng,
): PoachTarget | null {
  const p = BALANCE.poaching;
  const eligible = staff.filter(
    (s) =>
      s.id !== "s0" &&
      (Number.isFinite(s.skill) ? s.skill : 0) >= p.minSkill &&
      s.mood >= p.minMood &&
      (s.poachCooldownUntil ?? 0) <= week,
  );
  if (!eligible.length || !competitors.length) return null;

  // Poacher: a rival on the rise hires; if none are rising, the strongest by reputation does.
  const rising = competitors.filter((c) => c.arcPhase === "ascending" || c.arcPhase === "peaking");
  const pool = rising.length ? rising : competitors;
  const rival = pool[rng.int(pool.length)];

  // Target: a rival wants your BEST, so weight toward the most skilled — but keep a little spread so
  // it isn't always the single top person (pick among the top few).
  const sorted = [...eligible].sort((a, b) => (b.skill ?? 0) - (a.skill ?? 0));
  const topK = sorted.slice(0, Math.min(3, sorted.length));
  const target = topK[rng.int(topK.length)];
  return { staff: target, rival };
}
