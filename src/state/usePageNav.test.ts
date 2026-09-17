import { describe, expect, it } from "vitest";
import { nextStackForPopstate } from "./usePageNav.ts";
import type { PageFrame, PageStack, RootId } from "./pageStack.ts";

const frame = (id: PageFrame["id"], root: RootId = "company", params: Record<string, string> = {}): PageFrame =>
  ({ id, root, params });

// A browser Back press must land on the ROUTE the URL now names, not merely pop one frame — the two
// differ when history went forward, or when two pushes landed between events.
describe("nextStackForPopstate", () => {
  it("returns the roots when the hash names no page", () => {
    expect(nextStackForPopstate([frame("settings"), frame("platform")], "#/company", "hq")).toEqual([]);
  });

  it("truncates the stack to the frame the hash names", () => {
    expect(nextStackForPopstate([frame("settings"), frame("platform")], "#/company/settings", "hq")).toEqual([
      frame("settings"),
    ]);
  });

  it("rebuilds a single-frame stack for a page the stack never held", () => {
    expect(nextStackForPopstate([], "#/market/settings", "hq")).toEqual([frame("settings", "market")]);
  });

  it("is a no-op when the hash already names the top", () => {
    const stack: PageStack = [frame("settings")];
    expect(nextStackForPopstate(stack, "#/company/settings", "hq")).toEqual([frame("settings")]);
  });

  it("ignores an unknown hash instead of inventing a page", () => {
    expect(nextStackForPopstate([frame("settings")], "#/company/nonsense", "hq")).toEqual([]);
  });
});
