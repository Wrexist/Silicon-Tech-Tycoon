import { describe, it, expect } from "vitest";
import { launchFeedback } from "./launchFeedback.ts";

describe("launchFeedback", () => {
  it("celebrates a hit, and gives the first hit its own line", () => {
    expect(launchFeedback(90, false, true).text).toMatch(/first hit/i);
    expect(launchFeedback(90, false, false).text).toMatch(/hit/i);
    expect(launchFeedback(90, false, true).tone).toBe("positive");
  });

  it("never uses a harsh (negative) tone — weak launches read constructively", () => {
    for (const score of [0, 10, 22, 30, 45, 60, 80]) {
      expect(launchFeedback(score, false, false).tone).not.toBe("negative");
    }
  });

  it("frames a debut's slow start as encouraging, not a failure", () => {
    const debut = launchFeedback(10, true, false);
    expect(debut.tone).toBe("neutral");
    expect(debut.text).toMatch(/debut|level up/i);
    // A later weak launch still coaches toward Market, just without the first-timer warmth.
    const later = launchFeedback(10, false, false);
    expect(later.text).toMatch(/Market/i);
  });

  it("solid and steady scores get plain positive/neutral framing", () => {
    expect(launchFeedback(50, false, false).tone).toBe("positive");
    expect(launchFeedback(35, false, false).text).toMatch(/Launched/);
  });
});
