// Shared "ship a built product" action. The Office "Ready to launch" card and the global
// ready-to-launch popup both call this so the launch payoff (haptics, sound, the keynote reveal,
// hit-streak escalation, the first-launch review prompt) is identical wherever you release from.
import { useCallback } from "react";
import { createElement } from "react";
import { Star, Crown } from "lucide-react";
import { useGame } from "./useGame.tsx";
import { BALANCE } from "../engine/balance.ts";
import { insightFromPlan, planProduction, productStats } from "./gameState.ts";
import { buildLaunchReveal, emitLaunchReveal } from "../design/launchReveal.ts";
import { launchOutcome, currentHitStreak } from "../design/launchFeedback.ts";
import { maybePromptFirstLaunchReview } from "./review.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { showToast } from "../design/toast.tsx";
import { CATEGORIES } from "../engine/catalogs.ts";
import {
  categoryPoints,
  levelForPoints,
  pointsForLaunch,
  MASTERY_MAX_LEVEL,
  CATEGORY_SIGNATURES,
} from "../engine/mastery.ts";
import { franchiseMasteryForName } from "../engine/franchiseMastery.ts";
import { emitCelebrate } from "../design/celebrateFx.ts";
import type { ChannelId } from "../engine/marketing.ts";
import type { LaunchedProduct } from "../engine/types.ts";

/** Returns `launch(productId)` — ships a product from the `ready` shelf and fires the full launch
 *  celebration. Returns whether the launch went through (false if the id wasn't launchable). */
export function useLaunchProduct() {
  const { state, launchReady } = useGame();
  return useCallback(
    (id: string): boolean => {
      const launchedBefore = state.launched; // before launchReady records this product
      const product = state.ready.find((p) => p.id === id);
      // Pre-launch plan + stats feed the deterministic critic reviews shown in the reveal.
      const plan = product
        ? planProduction(state, product, product.plannedUnits ?? BALANCE.build.minRun, (product.channelId as ChannelId) ?? "none")
        : null;
      const res = launchReady(id);
      if (!res.ok) return false;
      haptic.success();
      // Keys the celebration off the recorded (competition-adjusted) verdict so the launch moment
      // can never contradict what Market/feed record.
      const { isHit } = launchOutcome(res, launchedBefore);
      sfx("launch");
      if (isHit) setTimeout(() => sfx("hit"), 380);
      // Debut peak — the first product ever ships: a heavier thump + a triumphant chime.
      if (launchedBefore.length === 0) {
        haptic.heavy();
        if (!isHit) setTimeout(() => sfx("hit"), 420);
      }
      // Hit-streak dopamine: a run of consecutive hits escalates the celebration.
      const streak = isHit ? currentHitStreak(launchedBefore) + 1 : 0;
      if (streak >= 3) setTimeout(() => haptic.heavy(), 200);
      if (product && plan) {
        emitLaunchReveal(buildLaunchReveal({
          product,
          stats: productStats(state, product),
          verdict: res.verdict ?? "steady",
          demandFit: plan.demandFit,
          priceFit: plan.priceFit,
          betterRivals: plan.betterRivals,
          units: plan.projectedSales,
          isHit,
          firstLaunch: launchedBefore.length === 0,
          streak,
          insight: insightFromPlan(plan),
        }));
        // First product ever shipped — a real high point. Ask for an App Store review (once).
        if (launchedBefore.length === 0) maybePromptFirstLaunchReview();
      }
      // Category Mastery (feature #3) level-up moment — a toast + confetti, NO new interrupt stream.
      // Only for fresh runs (masteryEnabled) where the bonuses actually apply. Derived purely from the
      // launch history + this launch's verdict, so it can never disagree with the Mastery view.
      if (product && state.masteryEnabled) {
        const cat = product.category;
        const before = categoryPoints(launchedBefore, cat);
        const beforeLvl = levelForPoints(before);
        const afterLvl = levelForPoints(before + pointsForLaunch(res.verdict));
        if (afterLvl > beforeLvl) {
          const name = CATEGORIES[cat]?.displayName ?? cat;
          emitCelebrate();
          sfx("levelup");
          haptic.success();
          const message = afterLvl >= MASTERY_MAX_LEVEL
            ? `${name} Mastery maxed — ${CATEGORY_SIGNATURES[cat]?.edition ?? "Special"} signature unlocked!`
            : `${name} Mastery reached level ${afterLvl}`;
          showToast(message, {
            tone: "positive",
            glyph: createElement(Star, { size: 15 }),
          });
        }
      }
      // Franchise Mastery (feature #8) unlock moment — a line crosses into ≥5 entries + Iconic with THIS
      // launch: a toast + confetti, NO modal / new interrupt stream. Derived purely from the prior line
      // plus this entry (name + verdict), so it can never disagree with the Market franchises card.
      if (product && state.franchiseMasteryEnabled) {
        const before = franchiseMasteryForName(launchedBefore, product.name);
        // Project the freshly-shipped entry with EVERY field the brand-equity calc reads — including
        // launchedWeek (the current week at launch) — so the projection can't leave launchedWeek undefined
        // and NaN-poison the equity math, which could suppress or misfire the Iconic-unlock toast.
        const afterEntry = { product, verdict: res.verdict ?? "steady", launchedWeek: state.week } as unknown as LaunchedProduct;
        const after = franchiseMasteryForName([afterEntry, ...launchedBefore], product.name);
        if (after?.qualified && !before?.qualified) {
          emitCelebrate();
          sfx("levelup");
          haptic.success();
          showToast(`${after.name} line is now Iconic — ${after.boon.name} unlocked!`, {
            tone: "positive",
            glyph: createElement(Crown, { size: 15 }),
          });
        }
      }
      return true;
    },
    [state, launchReady],
  );
}
