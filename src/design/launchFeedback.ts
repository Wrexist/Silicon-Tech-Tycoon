// Launch-moment toast copy — shared by HQ and the Design Lab so both launch surfaces speak with
// one voice. Phase 2 (items 6/8/9): weak launches are framed constructively instead of harshly
// (especially a brand-new founder's debut), and the first hit gets its own beat. We change the
// FRAMING, never the outcome — the verdict and score are untouched (pillar #5: readable sim).
export interface LaunchFeedback {
  text: string;
  tone: "neutral" | "positive" | "negative";
}

/** The four recorded launch verdicts (competition-adjusted, era-scaled). */
export type LaunchVerdict = "hit" | "solid" | "flop" | "steady";

/**
 * @param verdict    the verdict the launch ACTUALLY recorded (so the toast can never contradict
 *                   what Market shows — a raw-score "hit" that flopped under competition is a flop)
 * @param firstEver  true if this is the company's very first launch
 * @param firstHit   true if this launch is a hit AND no prior product was a hit
 */
export function launchFeedback(verdict: LaunchVerdict, firstEver: boolean, firstHit: boolean): LaunchFeedback {
  if (verdict === "hit") {
    return { text: firstHit ? "Your first hit, the market loves it!" : "Launched, it's a hit!", tone: "positive" };
  }
  if (verdict === "solid") return { text: "Launched, solid performance.", tone: "positive" };
  if (verdict === "flop") {
    // Constructive, not deflating — and never red for a debut. Point the player at the Market
    // post-mortem so a slow start reads as "here's how to improve", not "you failed".
    return firstEver
      ? { text: "Launched! A modest debut, open Market to see how to level up.", tone: "neutral" }
      : { text: "Launched, slow start. Open Market to see why.", tone: "neutral" };
  }
  return { text: "Launched into the market.", tone: "neutral" };
}

/** Consecutive "hit" verdicts from the most recent launch backward — the live hit streak. The
 *  `launched` array is NEWEST-FIRST (`[lp, ...prev]`), so iterate from index 0 (matches the achievement
 *  deriveFacts hitStreak). Pass the array as it is BEFORE the new launch; the caller adds 1 for a hit. */
export function currentHitStreak(launched: readonly { verdict?: string }[]): number {
  let n = 0;
  for (const lp of launched) {
    if (lp.verdict === "hit") n++;
    else break;
  }
  return n;
}

export interface LaunchOutcome {
  /** Whether to fire the celebratory beat (confetti + hit SFX). */
  isHit: boolean;
  feedback: LaunchFeedback;
}

/**
 * The shared launch-result derivation used by BOTH launch surfaces (Design Lab + HQ) so they can
 * never drift apart. Pass the result of `launchReady` and the `launched` array as it was BEFORE
 * this launch was recorded (the pre-launch snapshot the screen already holds).
 */
export function launchOutcome(
  res: { verdict?: LaunchVerdict },
  launchedBefore: readonly { verdict?: string }[],
): LaunchOutcome {
  const firstEver = launchedBefore.length === 0;
  const hadHit = launchedBefore.some((lp) => lp.verdict === "hit");
  const verdict = res.verdict ?? "steady";
  const isHit = verdict === "hit";
  return { isHit, feedback: launchFeedback(verdict, firstEver, isHit && !hadHit) };
}
