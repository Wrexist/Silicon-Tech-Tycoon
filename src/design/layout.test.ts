import { describe, expect, it } from "vitest";
import { LAYOUT_BREAKPOINTS, layoutModeForWidth, railShown } from "./layout.ts";

// Thresholds are unit-tested here and mirrored by the CSS media queries in tokens/railNav CSS.
// The boundary belongs to the WIDER mode: 700 is tablet, 1100 is wide.
describe("layoutModeForWidth", () => {
  it("maps the phone range", () => {
    for (const w of [320, 390, 540, 699]) expect(layoutModeForWidth(w)).toBe("phone");
  });

  it("maps the tablet range, inclusive of the boundary", () => {
    for (const w of [700, 820, 1099]) expect(layoutModeForWidth(w)).toBe("tablet");
  });

  it("maps the wide range, inclusive of the boundary", () => {
    for (const w of [1100, 1440, 2560]) expect(layoutModeForWidth(w)).toBe("wide");
  });

  it("never returns tablet or wide for a nonsense width", () => {
    for (const w of [Number.NaN, Number.POSITIVE_INFINITY, -100]) expect(layoutModeForWidth(w)).toBe("phone");
  });

  it("keeps the breakpoints ordered", () => {
    expect(LAYOUT_BREAKPOINTS.tablet).toBeLessThan(LAYOUT_BREAKPOINTS.wide);
  });
});

describe("railShown", () => {
  it("shows the rail everywhere but phone", () => {
    expect(railShown("phone")).toBe(false);
    expect(railShown("tablet")).toBe(true);
    expect(railShown("wide")).toBe(true);
  });
});
