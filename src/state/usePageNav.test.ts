import { describe, expect, it } from "vitest";
import { nextStackForPopstate } from "./usePageNav.ts";

// A browser Back press must land on the page the URL now names, NOT merely pop one frame — the two
// differ when history went forward, or when two entries were pushed quickly. This is the rule that
// keeps the UI and the address bar from disagreeing.
describe("nextStackForPopstate", () => {
  it("returns the root when the hash names no page", () => {
    expect(nextStackForPopstate(["settings", "platform"], "#/")).toEqual([]);
  });

  it("truncates the stack to the page the hash names", () => {
    expect(nextStackForPopstate(["settings", "platform"], "#/settings")).toEqual(["settings"]);
  });

  it("rebuilds a single-frame stack from the root for a page the stack never held", () => {
    expect(nextStackForPopstate([], "#/museum")).toEqual(["museum"]);
  });

  it("is a no-op when the hash already matches the top", () => {
    const stack = ["settings"] as const;
    expect(nextStackForPopstate(stack, "#/settings")).toEqual(["settings"]);
  });

  it("ignores an unknown hash instead of inventing a page", () => {
    expect(nextStackForPopstate(["settings"], "#/nonsense")).toEqual([]);
  });
});
