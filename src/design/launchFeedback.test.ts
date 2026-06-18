import { describe, it, expect } from "vitest";
import { launchFeedback } from "./launchFeedback.ts";

describe("launchFeedback", () => {
  it("celebrates a hit, and gives the first hit its own line", () => {
    expect(launchFeedback("hit", false, true).text).toMatch(/first hit/i);
    expect(launchFeedback("hit", false, false).text).toMatch(/hit/i);
    expect(launchFeedback("hit", false, true).tone).toBe("positive");
  });

  it("never uses a harsh (negative) tone — weak launches read constructively", () => {
    for (const v of ["hit", "solid", "steady", "flop"] as const) {
      expect(launchFeedback(v, false, false).tone).not.toBe("negative");
    }
  });

  it("frames a debut's flop as encouraging, not a failure", () => {
    const debut = launchFeedback("flop", true, false);
    expect(debut.tone).toBe("neutral");
    expect(debut.text).toMatch(/debut|level up/i);
    // A later flop still coaches toward Market, just without the first-timer warmth.
    const later = launchFeedback("flop", false, false);
    expect(later.text).toMatch(/Market/i);
  });

  it("solid is positive; steady is plain neutral framing", () => {
    expect(launchFeedback("solid", false, false).tone).toBe("positive");
    expect(launchFeedback("steady", false, false).text).toMatch(/Launched/);
    expect(launchFeedback("steady", false, false).tone).toBe("neutral");
  });
});
