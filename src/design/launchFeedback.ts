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
    return { text: firstHit ? "Your first hit — the market loves it!" : "Launched — it's a hit!", tone: "positive" };
  }
  if (verdict === "solid") return { text: "Launched — solid performance.", tone: "positive" };
  if (verdict === "flop") {
    // Constructive, not deflating — and never red for a debut. Point the player at the Market
    // post-mortem so a slow start reads as "here's how to improve", not "you failed".
    return firstEver
      ? { text: "Launched! A modest debut — open Market to see how to level up.", tone: "neutral" }
      : { text: "Launched — slow start. Open Market to see why.", tone: "neutral" };
  }
  return { text: "Launched into the market.", tone: "neutral" };
}
