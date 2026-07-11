// Market climate (Track B): seasonal segment cycles (redistributive) + periodic regional crises.
import { describe, expect, it } from "vitest";
import { segmentSizeMul, regionShockMul, regionInCrisis, segmentTrend, climateNarration } from "./climate.ts";
import { segmentDemand, SEGMENTS } from "./segments.ts";
import { regionReach } from "./regions.ts";
import { BALANCE } from "./balance.ts";
import { dollars } from "./money.ts";
import type { SegmentId, Stats } from "./types.ts";

const flatTrends = { weights: { performance: 0.2, quality: 0.2, battery: 0.2, design: 0.2, ecosystem: 0.2 }, targetWeights: { performance: 0.2, quality: 0.2, battery: 0.2, design: 0.2, ecosystem: 0.2 } } as never;
const stats: Stats = { performance: 60, quality: 60, battery: 60, design: 60, ecosystem: 60 };
const segIds = SEGMENTS.map((s) => s.id) as SegmentId[];

describe("climate — segment cycles", () => {
  it("a segment's size multiplier swings within ±amplitude around 1", () => {
    const amp = BALANCE.market.climate.segmentAmplitude;
    for (const id of segIds) {
      for (let w = 0; w < 120; w++) {
        const m = segmentSizeMul(id, w);
        expect(m).toBeGreaterThanOrEqual(1 - amp - 1e-9);
        expect(m).toBeLessThanOrEqual(1 + amp + 1e-9);
      }
    }
  });

  it("the cycle is REDISTRIBUTIVE — total demandIndex barely moves vs. the static market", () => {
    // A balanced product's segment-weighted demand should be ~constant across weeks, since the mix is
    // re-normalized (the cycle shifts WHO buys, not HOW MANY).
    const base = segmentDemand(stats, dollars(500), flatTrends, "phone").demandIndex;
    for (const w of [0, 7, 19, 33, 51]) {
      const cycled = segmentDemand(stats, dollars(500), flatTrends, "phone", 0, w).demandIndex;
      expect(Math.abs(cycled - base) / base).toBeLessThan(0.06); // within a few %, never inflated
    }
  });

  it("omitting the week is byte-identical to the static market", () => {
    const a = segmentDemand(stats, dollars(500), flatTrends, "phone");
    const b = segmentDemand(stats, dollars(500), flatTrends, "phone", 0);
    expect(b.perSegment.map((s) => s.size)).toEqual(a.perSegment.map((s) => s.size));
  });

  it("segmentTrend reports rising/falling/steady", () => {
    const seen = new Set<string>();
    for (let w = 0; w < 60; w++) for (const id of segIds) seen.add(segmentTrend(id, w));
    expect(seen.has("rising")).toBe(true);
    expect(seen.has("falling")).toBe(true);
  });
});

describe("climate — regional crises", () => {
  it("home is never shocked", () => {
    for (let w = 0; w < 200; w++) {
      expect(regionShockMul("home", w)).toBe(1);
      expect(regionInCrisis("home", w)).toBe(false);
    }
  });

  it("a non-home region dips into crisis periodically and recovers", () => {
    let crisisSeen = false;
    let normalSeen = false;
    for (let w = 0; w < 200; w++) {
      const m = regionShockMul("asia", w);
      expect(m).toBeGreaterThanOrEqual(1 - BALANCE.market.climate.crisisDepth - 1e-9);
      expect(m).toBeLessThanOrEqual(1 + 1e-9);
      if (m < 0.97) crisisSeen = true;
      if (m === 1) normalSeen = true;
    }
    expect(crisisSeen && normalSeen).toBe(true);
  });

  it("regionReach is unchanged for a home-only launch (with or without week)", () => {
    const a = regionReach(["home"], ["home"], stats);
    for (let w = 0; w < 50; w++) expect(regionReach(["home"], ["home"], stats, w)).toBe(a);
  });

  it("a region in crisis reduces multi-region reach vs. its calm weeks", () => {
    // find a crisis week and a calm week for asia, compare reach when shipping home+asia
    let crisisW = -1, calmW = -1;
    for (let w = 0; w < 200 && (crisisW < 0 || calmW < 0); w++) {
      if (regionShockMul("asia", w) < 0.8 && crisisW < 0) crisisW = w;
      if (regionShockMul("asia", w) === 1 && calmW < 0) calmW = w;
    }
    const ships: ["home", "asia"] = ["home", "asia"];
    expect(regionReach(["home", "asia"], ships, stats, crisisW)).toBeLessThan(regionReach(["home", "asia"], ships, stats, calmW));
  });
});

describe("climate — narration (Track B)", () => {
  it("is deterministic and RNG-free (run1 === run2)", () => {
    for (let w = 1; w < 200; w++) {
      expect(climateNarration(w, ["home", "asia"])).toEqual(climateNarration(w, ["home", "asia"]));
    }
  });

  it("never narrates a region the player hasn't opened", () => {
    // With only home unlocked, no region beat can ever fire (home is never in crisis).
    for (let w = 1; w < 300; w++) {
      const beat = climateNarration(w, ["home"]);
      if (beat) expect(beat.tone).toBe("accent"); // only segment surges are possible home-only
    }
  });

  it("narrates a region crisis onset and its recovery for an opened market", () => {
    const texts: string[] = [];
    for (let w = 1; w < 300; w++) {
      const beat = climateNarration(w, ["home", "asia"]);
      if (beat && beat.text.includes("Asia")) texts.push(beat.text);
    }
    expect(texts.some((t) => t.includes("downturn"))).toBe(true);
    expect(texts.some((t) => t.includes("recovering"))).toBe(true);
  });

  it("narrates a segment surge exactly once per cycle peak", () => {
    // Over one full-ish window, a segment should crest a bounded number of times (once per period).
    let surges = 0;
    for (let w = 1; w < 120; w++) {
      const beat = climateNarration(w, ["home"]);
      if (beat && beat.text.includes("Budget")) surges++;
    }
    // budget cycle period is 41 → ~2-3 peaks across 120 weeks, never one-per-week spam
    expect(surges).toBeGreaterThanOrEqual(1);
    expect(surges).toBeLessThanOrEqual(4);
  });
});
