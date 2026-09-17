import { describe, expect, it } from "vitest";
import {
  hashForRoute,
  popPage,
  pushPage,
  routeFromHash,
  sameFrame,
  topPage,
  WIRED_PAGES,
  type PageFrame,
  type PageStack,
  type RootId,
} from "./pageStack.ts";

const frame = (id: PageFrame["id"], root: RootId = "company", params: Record<string, string> = {}): PageFrame =>
  ({ id, root, params });

describe("page stack", () => {
  it("starts empty", () => {
    expect(topPage([])).toBeNull();
  });

  it("pushes and pops in order", () => {
    let s: PageStack = [];
    s = pushPage(s, frame("settings"));
    expect(topPage(s)?.id).toBe("settings");
    s = pushPage(s, frame("platform"));
    expect(topPage(s)?.id).toBe("platform");
    s = popPage(s);
    expect(topPage(s)?.id).toBe("settings");
    s = popPage(s);
    expect(topPage(s)).toBeNull();
  });

  it("ignores a pop on an empty stack", () => {
    const empty: PageStack = [];
    expect(popPage(empty)).toBe(empty);
  });

  it("does not stack an identical frame twice", () => {
    const s = pushPage([], frame("settings"));
    expect(pushPage(s, frame("settings"))).toBe(s);
  });

  it("DOES stack the same page when it carries different params", () => {
    const s = pushPage([], frame("platform", "company", { section: "services" }));
    const next = pushPage(s, frame("platform", "company", { section: "licensing" }));
    expect(next).toHaveLength(2);
    expect(topPage(next)?.params.section).toBe("licensing");
  });

  it("compares frames by value, not identity", () => {
    expect(sameFrame(frame("settings"), frame("settings"))).toBe(true);
    expect(sameFrame(frame("settings"), frame("settings", "hq"))).toBe(false);
    expect(sameFrame(frame("settings"), frame("settings", "company", { a: "1" }))).toBe(false);
  });
});

describe("routeFromHash", () => {
  it("falls back to the given root when the hash names nothing", () => {
    for (const hash of ["", "#", "#/", "#/nonsense"]) {
      expect(routeFromHash(hash, "hq")).toEqual({ root: "hq", frame: null });
    }
  });

  it("honours a valid page under the fallback root when the root segment is a typo", () => {
    // A mistyped root must not cost the player the page they linked to.
    expect(routeFromHash("#/nonsense/settings", "hq")).toEqual({
      root: "hq",
      frame: frame("settings", "hq"),
    });
  });

  it("reads a bare root", () => {
    expect(routeFromHash("#/market", "hq")).toEqual({ root: "market", frame: null });
  });

  it("reads a root plus a wired page", () => {
    expect(routeFromHash("#/company/settings", "hq")).toEqual({
      root: "company",
      frame: frame("settings", "company"),
    });
  });

  it("reads a trailing section into params", () => {
    expect(routeFromHash("#/company/settings/services", "hq")).toEqual({
      root: "company",
      frame: frame("settings", "company", { section: "services" }),
    });
  });

  it("keeps the root but drops a page that has no screen yet", () => {
    // A committed-but-unwired page must not hide every root and render an empty main.
    expect(routeFromHash("#/company/museum", "hq")).toEqual({ root: "company", frame: null });
  });

  it("ignores case and stray slashes", () => {
    expect(routeFromHash("#/COMPANY/Settings/", "hq")).toEqual({
      root: "company",
      frame: frame("settings", "company"),
    });
  });
});

describe("hashForRoute", () => {
  it("encodes a bare root", () => {
    expect(hashForRoute("market", null)).toBe("#/market");
  });

  it("encodes a root, a page and a section", () => {
    expect(hashForRoute("company", frame("platform", "company", { section: "services" }))).toBe(
      "#/company/platform/services",
    );
  });

  it("round-trips every wired page under every root", () => {
    const roots: RootId[] = ["hq", "design", "research", "market", "company"];
    for (const root of roots) {
      for (const id of WIRED_PAGES) {
        const encoded = hashForRoute(root, frame(id, root));
        expect(routeFromHash(encoded, "hq")).toEqual({ root, frame: frame(id, root) });
      }
    }
  });
});
