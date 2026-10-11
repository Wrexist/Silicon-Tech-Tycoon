import { describe, expect, it } from "vitest";
import { QUALITY_PROFILES, resolveQuality } from "./quality.ts";

describe("3D quality setting (O6)", () => {
  it("an explicit choice always wins", () => {
    expect(resolveQuality("low", { cores: 16, memoryGb: 16 })).toBe("low");
    expect(resolveQuality("high", { cores: 2, memoryGb: 1 })).toBe("high");
  });

  it("auto picks Low only on a clearly weak device, High everywhere else", () => {
    expect(resolveQuality("auto", { cores: 2 })).toBe("low");
    expect(resolveQuality("auto", { cores: 8, memoryGb: 2 })).toBe("low");
    expect(resolveQuality("auto", { cores: 6 })).toBe("high");
    expect(resolveQuality("auto", { cores: 4, memoryGb: 4 })).toBe("high");
    // a browser that reports nothing (or 0) is not treated as weak
    expect(resolveQuality("auto", {})).toBe("high");
    expect(resolveQuality("auto", { cores: 0, memoryGb: 0 })).toBe("high");
  });

  it("Low is cheaper than High on every axis", () => {
    const { low, high } = QUALITY_PROFILES;
    expect(low.dpr[1]).toBeLessThan(high.dpr[1]);
    expect(low.shadows).toBe(false);
    expect(high.shadows).toBe(true);
    expect(low.contactShadowScale).toBeLessThan(high.contactShadowScale);
    expect(low.dust).toBe(false);
  });

  it("High is today's look: the DPR cap the worlds already shipped with (Wave 7 rule: never raise it)", () => {
    expect(QUALITY_PROFILES.high.dpr).toEqual([1, 1.75]);
    expect(QUALITY_PROFILES.high.contactShadowScale).toBe(1);
  });
});
