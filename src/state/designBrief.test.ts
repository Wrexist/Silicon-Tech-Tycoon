// Design briefs (item 3.3): committing a product to a target buyer segment. Nailing the target's
// stat fit at launch earns bonus reputation + fans; missing it forgoes the bonus (never a penalty);
// no target is byte-identical to the pre-brief launch.
import { describe, it, expect } from "vitest";
import { newGame, launchReady, productStats, type GameState } from "./gameState.ts";
import { segmentDemand } from "../engine/segments.ts";
import { styleAppeal } from "../engine/aesthetics.ts";
import { BALANCE } from "../engine/balance.ts";
import type { Product, SegmentId } from "../engine/types.ts";

function product(over: Partial<Product> = {}): Product {
  return {
    id: "p1", name: "Aim Test", category: "phone",
    tiers: { chip: 3, display: 3, battery: 3, materials: 3, software: 3, camera: 3 },
    finish: "aluminium", colorIndex: 0, price: 79900 as Product["price"], designTier: 3,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch", refreshRate: 120, storage: 256, tuning: "balanced",
    ...over,
  };
}

/** The segment this exact product fits best/worst on stats, via the same path the launch uses. */
function fitRanked(s: GameState, p: Product): { best: SegmentId; worst: SegmentId; fits: Record<string, number> } {
  const stats = productStats(s, p);
  const seg = segmentDemand(stats, p.price, s.trends, p.category, styleAppeal(p), s.week);
  const fits: Record<string, number> = {};
  for (const r of seg.perSegment) fits[r.id] = r.fit;
  const sorted = [...seg.perSegment].sort((a, b) => b.fit - a.fit);
  return { best: sorted[0].id, worst: sorted[sorted.length - 1].id, fits };
}

const withReady = (g: GameState, p: Product): GameState => ({ ...g, ready: [p] });

describe("design briefs (item 3.3)", () => {
  it("no target is a pure no-op — same reputation, fans, and no brief beat", () => {
    const g = newGame(11);
    const p = product();
    const noTarget = launchReady(withReady(g, p), "p1");
    const explicitNone = launchReady(withReady(g, { ...p, targetSegment: undefined }), "p1");
    expect(noTarget.state.reputation).toBe(explicitNone.state.reputation);
    expect(noTarget.state.fans).toBe(explicitNone.state.fans);
    expect(noTarget.state.feed.some((f) => f.text.includes("Design brief"))).toBe(false);
  });

  it("nailing the target segment earns bonus reputation + fans over the same untargeted launch", () => {
    const g = newGame(11);
    const p = product();
    const target = fitRanked(g, p).best; // a segment this product genuinely fits well
    expect(fitRanked(g, p).fits[target]).toBeGreaterThanOrEqual(BALANCE.briefs.fitThreshold);
    const base = launchReady(withReady(g, p), "p1");
    const brief = launchReady(withReady(g, { ...p, targetSegment: target }), "p1");
    expect(brief.state.reputation).toBeGreaterThan(base.state.reputation);
    expect(brief.state.fans).toBeGreaterThan(base.state.fans);
    expect(brief.state.feed.some((f) => f.text.includes("Design brief nailed"))).toBe(true);
  });

  it("missing the target forgoes the bonus but never penalises (rep/fans equal to untargeted)", () => {
    const g = newGame(11);
    // A deliberately weak product barely fits its best segment; aim it at its WORST-fit buyer.
    const weak = product({ tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 }, designTier: 1, price: 89900 as Product["price"] });
    const { worst, fits } = fitRanked(g, weak);
    expect(fits[worst]).toBeLessThan(BALANCE.briefs.fitThreshold); // genuinely a miss
    const base = launchReady(withReady(g, weak), "p1");
    const missed = launchReady(withReady(g, { ...weak, targetSegment: worst }), "p1");
    expect(missed.state.reputation).toBe(base.state.reputation); // no penalty
    expect(missed.state.fans).toBe(base.state.fans);
    expect(missed.state.feed.some((f) => f.text.includes("Design brief missed"))).toBe(true);
  });
});
