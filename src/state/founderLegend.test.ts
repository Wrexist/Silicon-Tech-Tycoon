import { describe, it, expect, beforeEach } from "vitest";
import {
  getFounderRecord,
  recordFounder,
  mergeFounderRecord,
  legendScore,
  legendStanding,
  liveLegendScore,
  LEGEND_TIERS,
  type FounderRecord,
} from "./founderLegend.ts";

// vitest runs in the `node` env here (no DOM), so stub localStorage on globalThis like the other
// profile-store tests (see persistence.test.ts).
class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
  clear(): void { this.map.clear(); }
}

beforeEach(() => {
  // @ts-expect-error assigning a stub to the global for the node test env
  globalThis.localStorage = new MemStorage();
});

describe("founder record store", () => {
  it("starts empty and at the bottom of the ladder", () => {
    const rec = getFounderRecord();
    expect(rec).toEqual({ prestiges: 0, ipos: 0, bestHitsInRun: 0, peakValuationDollars: 0, bestRank: 9999, bestAscension: 0 });
    expect(legendScore(rec)).toBe(0);
    expect(legendStanding(legendScore(rec)).title).toBe("Garage Founder");
  });

  it("counts prestiges/ipos and keeps maxima for hits/valuation/rank", () => {
    recordFounder({ ipo: true, hitsInRun: 4, valuationDollars: 2_000_000, rank: 3 });
    recordFounder({ prestige: true, hitsInRun: 2, valuationDollars: 500_000, rank: 5 });
    const rec = getFounderRecord();
    expect(rec.ipos).toBe(1);
    expect(rec.prestiges).toBe(1);
    expect(rec.bestHitsInRun).toBe(4); // max, not the latest
    expect(rec.peakValuationDollars).toBe(2_000_000); // max, not the latest
    expect(rec.bestRank).toBe(3); // best (lowest)
  });

  it("maxima recording is idempotent — replaying the same run never inflates the record", () => {
    const run = { valuationDollars: 5_000_000, hitsInRun: 6, rank: 2 } as const;
    recordFounder({ ipo: true, ...run });
    const once = getFounderRecord();
    // Re-record the SAME peaks (no new prestige/ipo): maxima unchanged; only explicit counts move.
    recordFounder({ ...run });
    const twice = getFounderRecord();
    expect(twice.bestHitsInRun).toBe(once.bestHitsInRun);
    expect(twice.peakValuationDollars).toBe(once.peakValuationDollars);
    expect(twice.bestRank).toBe(once.bestRank);
    expect(twice.ipos).toBe(once.ipos); // no ipo flag on the replay → unchanged
  });

  it("merge keeps the better of each field (restore never downgrades)", () => {
    recordFounder({ prestige: true, hitsInRun: 3, valuationDollars: 1_000_000, rank: 4 });
    mergeFounderRecord({ prestiges: 0, ipos: 5, bestHitsInRun: 1, peakValuationDollars: 9_000_000, bestRank: 1 } as FounderRecord);
    const rec = getFounderRecord();
    expect(rec.prestiges).toBe(1); // kept the higher local count
    expect(rec.ipos).toBe(5); // took the higher incoming count
    expect(rec.bestHitsInRun).toBe(3); // kept higher local
    expect(rec.peakValuationDollars).toBe(9_000_000); // took higher incoming
    expect(rec.bestRank).toBe(1); // took better incoming rank
  });

  it("sanitizes corrupt stored data back to a safe empty record", () => {
    localStorage.setItem("silicon.founder.v1", "{not json");
    expect(getFounderRecord().prestiges).toBe(0);
    localStorage.setItem("silicon.founder.v1", JSON.stringify({ prestiges: -5, bestRank: -1, ipos: "x" }));
    const rec = getFounderRecord();
    expect(rec.prestiges).toBe(0);
    expect(rec.ipos).toBe(0);
    expect(rec.bestRank).toBe(9999);
  });
});

describe("legend ladder", () => {
  it("score rises monotonically with achievement", () => {
    const a = legendScore({ prestiges: 0, ipos: 1, bestHitsInRun: 2, peakValuationDollars: 1_000_000, bestRank: 5, bestAscension: 0 });
    const b = legendScore({ prestiges: 2, ipos: 3, bestHitsInRun: 8, peakValuationDollars: 1_000_000_000, bestRank: 1, bestAscension: 0 });
    expect(b).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(0);
  });

  it("tiers are strictly ascending and start at Garage Founder", () => {
    expect(LEGEND_TIERS[0].name).toBe("Garage Founder");
    for (let i = 1; i < LEGEND_TIERS.length; i++) {
      expect(LEGEND_TIERS[i].minScore).toBeGreaterThan(LEGEND_TIERS[i - 1].minScore);
    }
  });

  it("resolves a score to the right named tier with a clean next-rung bar", () => {
    const st = legendStanding(120);
    expect(st.title).toBe("Breakout Founder"); // 95 <= 120 < 165
    expect(st.tierMin).toBe(95);
    expect(st.nextMin).toBe(165);
    expect(st.nextTitle).toBe("Serial Founder");
    expect(st.progress).toBeGreaterThan(0);
    expect(st.progress).toBeLessThan(1);
  });

  it("continues endlessly past the last named tier as numbered Legends", () => {
    const top = LEGEND_TIERS[LEGEND_TIERS.length - 1];
    expect(legendStanding(top.minScore).title).toBe("Founding Legend");
    const deep = legendStanding(top.minScore + 400); // one step past
    expect(deep.title).toBe("Founding Legend II");
    expect(deep.nextTitle).toBe("Founding Legend III");
    // Always a higher rung to chase.
    const veryDeep = legendStanding(top.minScore + 400 * 12);
    expect(veryDeep.nextMin).toBeGreaterThan(veryDeep.score);
  });

  it("live score folds the current run so the title can climb during play", () => {
    const rec = getFounderRecord(); // empty
    const cold = legendScore(rec);
    const warm = liveLegendScore(rec, { hitsInRun: 5, valuationDollars: 500_000_000, rank: 2 });
    expect(warm).toBeGreaterThan(cold);
    // Folding never LOWERS a stored peak.
    const strong: FounderRecord = { prestiges: 1, ipos: 1, bestHitsInRun: 9, peakValuationDollars: 9_000_000_000, bestRank: 1, bestAscension: 0 };
    expect(liveLegendScore(strong, { hitsInRun: 0, valuationDollars: 0, rank: 8 })).toBe(legendScore(strong));
  });
});
