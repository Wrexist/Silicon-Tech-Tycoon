import { describe, it, expect } from "vitest";
import { MARKETING_CHANNELS, channelById } from "./marketing.ts";
import { toDollars } from "./money.ts";
import { SEGMENTS } from "./segments.ts";

describe("marketing channels catalog", () => {
  it("channelById returns the matching channel", () => {
    expect(channelById("event").id).toBe("event");
    expect(channelById("social").name).toBe("Social Media");
  });

  it("channelById falls back to the no-campaign channel for an unknown id", () => {
    // @ts-expect-error deliberately passing an id outside the union to exercise the fallback
    expect(channelById("nope").id).toBe("none");
  });

  it("has unique channel ids", () => {
    const ids = MARKETING_CHANNELS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the no-campaign channel is free with zero hype and reputation", () => {
    const none = channelById("none");
    expect(toDollars(none.cost)).toBe(0);
    expect(none.hype).toBe(0);
    expect(none.reputation).toBe(0);
  });

  it("paid channels cost more and buy more hype (monotonic value ladder)", () => {
    const paid = MARKETING_CHANNELS.filter((c) => c.id !== "none").sort((a, b) => toDollars(a.cost) - toDollars(b.cost));
    for (let i = 1; i < paid.length; i++) {
      expect(toDollars(paid[i].cost)).toBeGreaterThan(toDollars(paid[i - 1].cost));
      // more expensive channels never buy LESS hype than a cheaper one
      expect(paid[i].hype).toBeGreaterThanOrEqual(paid[i - 1].hype);
    }
  });

  it("every declared affinity points at a real segment (D2 wiring)", () => {
    const segIds = new Set(SEGMENTS.map((s) => s.id));
    for (const c of MARKETING_CHANNELS) {
      if (c.affinity) expect(segIds.has(c.affinity)).toBe(true);
    }
  });

  it("costs and hype are all non-negative and finite", () => {
    for (const c of MARKETING_CHANNELS) {
      expect(toDollars(c.cost)).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(c.hype)).toBe(true);
      expect(c.hype).toBeGreaterThanOrEqual(0);
      expect(c.reputation).toBeGreaterThanOrEqual(0);
    }
  });
});
