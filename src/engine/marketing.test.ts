import { describe, it, expect } from "vitest";
import { channelsForEra, channelById, MARKETING_CHANNELS } from "./marketing.ts";

describe("marketing channels", () => {
  it("era-gates the bigger channels (era 1 offers only the always-on ones)", () => {
    const era1 = channelsForEra(1).map((c) => c.id);
    expect(era1).toEqual(["none", "social", "search", "billboards"]);
    for (const gated of ["influencer", "tv", "event", "global"]) {
      expect(era1).not.toContain(gated);
    }
    // The bigger channels open progressively; by era 4 the whole catalog is offered.
    expect(channelsForEra(2).map((c) => c.id)).toContain("tv");
    expect(channelsForEra(2).map((c) => c.id)).not.toContain("event"); // event is era 3
    expect(channelsForEra(4).length).toBe(MARKETING_CHANNELS.length);
  });

  it("resolves a stored channel by id, falling back to 'none' for an unknown/legacy id", () => {
    expect(channelById("global").id).toBe("global");
    // @ts-expect-error deliberately passing an id outside the union (a corrupt/legacy save value)
    expect(channelById("bogus").id).toBe("none");
  });
});
