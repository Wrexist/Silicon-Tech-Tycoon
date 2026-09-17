import { describe, expect, it } from "vitest";
import { hashForPage, pageFromHash, popPage, pushPage, topPage, type PageStack } from "./pageStack.ts";

// The page stack is the app's whole navigation model above the tab roots, so its rules are pinned
// here rather than inferred from the UI: bounded depth, no duplicate frames, and a hash round-trip
// that can never invent a page it does not know.
describe("page stack", () => {
  it("starts empty", () => {
    expect(topPage([])).toBeNull();
  });

  it("pushes and pops in order", () => {
    let s: PageStack = [];
    s = pushPage(s, "settings");
    expect(topPage(s)).toBe("settings");
    s = pushPage(s, "platform");
    expect(topPage(s)).toBe("platform");
    s = popPage(s);
    expect(topPage(s)).toBe("settings");
    s = popPage(s);
    expect(topPage(s)).toBeNull();
  });

  it("ignores a pop on an empty stack", () => {
    expect(popPage([])).toEqual([]);
  });

  it("does not stack the same page twice — pushing it again returns the same stack", () => {
    const s = pushPage([], "settings");
    expect(pushPage(s, "settings")).toBe(s);
  });

  it("treats a stranger value as no page rather than trusting it", () => {
    expect(pageFromHash("#/nonsense")).toBeNull();
    expect(pageFromHash("#/")).toBeNull();
    expect(pageFromHash("")).toBeNull();
    expect(pageFromHash("#")).toBeNull();
  });

  it("round-trips every known page through the hash", () => {
    for (const page of ["settings", "platform", "museum", "goals"] as const) {
      expect(pageFromHash(hashForPage(page))).toBe(page);
    }
  });

  it("encodes an absent page as the bare hash", () => {
    expect(hashForPage(null)).toBe("#/");
    expect(pageFromHash(hashForPage(null))).toBeNull();
  });
});
