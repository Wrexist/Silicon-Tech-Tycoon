// Launch-moment toast copy — shared by HQ and the Design Lab so both launch surfaces speak with
// one voice. Phase 2 (items 6/8/9): weak launches are framed constructively instead of harshly
// (especially a brand-new founder's debut), and the first hit gets its own beat. We change the
// FRAMING, never the outcome — the verdict and score are untouched (pillar #5: readable sim).
export interface LaunchFeedback {
  text: string;
  tone: "neutral" | "positive" | "negative";
}

/**
 * @param score      the launch score (0..100-ish) returned by launchReady
 * @param firstEver  true if this is the company's very first launch
 * @param firstHit   true if this launch is a hit AND no prior product was a hit
 */
export function launchFeedback(score: number, firstEver: boolean, firstHit: boolean): LaunchFeedback {
  if (score >= 76) {
    return { text: firstHit ? "Your first hit — the market loves it!" : "Launched — it's a hit!", tone: "positive" };
  }
  if (score >= 45) return { text: "Launched — solid performance.", tone: "positive" };
  if (score <= 22) {
    // Constructive, not deflating — and never red for a debut. Point the player at the Market
    // post-mortem so a slow start reads as "here's how to improve", not "you failed".
    return firstEver
      ? { text: "Launched! A modest debut — open Market to see how to level up.", tone: "neutral" }
      : { text: "Launched — slow start. Open Market to see why.", tone: "neutral" };
  }
  return { text: "Launched into the market.", tone: "neutral" };
}
