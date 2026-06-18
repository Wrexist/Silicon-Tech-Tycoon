import { describe, it, expect } from "vitest";
import { launchFeedback, launchOutcome } from "./launchFeedback.ts";

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

describe("launchOutcome (shared by Design Lab + HQ)", () => {
  it("flags a hit and the first-hit when no prior hit exists", () => {
    const r = launchOutcome({ verdict: "hit" }, []);
    expect(r.isHit).toBe(true);
    expect(r.feedback.text).toMatch(/first hit/i);
  });

  it("a hit after a prior hit is still a hit, but not the first", () => {
    const r = launchOutcome({ verdict: "hit" }, [{ verdict: "hit" }]);
    expect(r.isHit).toBe(true);
    expect(r.feedback.text).not.toMatch(/first hit/i);
  });

  it("defaults a missing verdict to steady (no hit celebration)", () => {
    const r = launchOutcome({}, []);
    expect(r.isHit).toBe(false);
    expect(r.feedback.text).toMatch(/Launched/);
  });
});
