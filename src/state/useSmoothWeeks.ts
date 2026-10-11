// Wall-clock-smoothed progress for anything the sim advances in whole-week ticks (a build run, the
// active research). The sim only moves progress when a week ticks over, so a ring would jump
// 0% → 50% → 100% on a 2-week job. This follows the sim's OWN clock (simClock.ts), the one source of
// where the live tick loop is inside the current week: a ring opened mid-week starts at the right
// place, every ring shows the same position, pause and every other stop freeze it, Fast speeds it up,
// and it stops just short of the next tick (CAP), so the sim's tick always lands ahead of the
// estimate — the ring counts up continuously and never claims progress the sim hasn't made.
//
// Presentation only: it reads the clock, never writes the game, and nothing in `engine/` can see it.
import { useEffect, useState } from "react";
import { simWeekPhase } from "./simClock.ts";

/** The estimate never passes this share of the coming week, so it can't overtake the real tick. */
export const SMOOTH_CAP = 0.97;

/** The share of the coming week to show for a sim-clock phase: the phase itself, capped. */
export function smoothSub(phase: number): number {
  return Math.min(SMOOTH_CAP, Math.max(0, Number.isFinite(phase) ? phase : 0));
}

/** The smoothed value: committed progress plus the estimated share of the next tick's step. The
 *  step is clipped to what's left, so even a crunch that will finish the job next tick stays short
 *  of 100% until the sim actually completes it. If the player lowers the next step mid-week (turns
 *  crunch off), the estimate drops with it — the honest value, since the next tick really adds less. */
export function smoothedValue(committed: number, sub: number, perWeek: number, total: number): number {
  if (committed >= total) return total;
  const step = Math.min(Math.max(0, perWeek), total - committed);
  return committed + step * smoothSub(sub);
}

/** A progress percentage that only reads 100 once the job is really done: the smoothed value sits
 *  just under each tick, and rounding would otherwise show "100%" a tick early. */
export function progressPct(value: number, total: number): number {
  if (!(total > 0)) return 0;
  const frac = Math.min(1, Math.max(0, value / total));
  // the epsilon keeps float error (1.4 / 5 → 27.999…) from flooring a whole percent low
  return frac >= 1 ? 100 : Math.min(99, Math.floor(frac * 100 + 1e-9));
}

/**
 * `committed` progress-weeks (whole weeks, or fractional when a crunch adds surge weeks) out of
 * `total`, smoothed between ticks. `perWeek` is how much the NEXT tick will add (1 normally; a
 * crunching research lab adds more). `id` names the job, so the next job in a queue never inherits
 * the last one's estimate even when both sit at the same committed value. Pass `total` 0 when there
 * is nothing to show (no timer runs). Reduce Motion keeps the honest steps.
 */
export function useSmoothWeeks(committed: number, total: number, perWeek = 1, id = ""): number {
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const read = () => smoothSub(simWeekPhase()?.phase ?? 0);
  // Keyed to the job + committed value it was read for — once the sim has moved past it the old share
  // reads as 0, so there's never a frame where last week's fraction rides on the new week.
  const [est, setEst] = useState(() => ({ id, at: committed, sub: read() }));
  const sub = est.id === id && est.at === committed ? est.sub : 0;
  useEffect(() => {
    if (reduced || !(total > 0) || committed >= total) return;
    const step = () => {
      const next = read();
      // Returning the SAME object when nothing changed skips the re-render (a paused game, a capped
      // week) — otherwise every 120ms step would re-render the ring for no visual delta.
      setEst((prev) => (prev.id === id && prev.at === committed && prev.sub === next ? prev : { id, at: committed, sub: next }));
    };
    step();
    const timer = setInterval(step, 120); // ~8fps — the ring's CSS transition smooths the rest
    return () => clearInterval(timer);
  }, [reduced, committed, total, id]);
  if (!(total > 0)) return 0;
  return reduced ? Math.min(total, committed) : smoothedValue(committed, sub, perWeek, total);
}
