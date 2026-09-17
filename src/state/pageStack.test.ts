import { describe, expect, it } from "vitest";
import {
  hashForRoute,
  popPage,
  pushPage,
  replacesTop,
  routeFromHash,
  sameFrame,
  topPage,
  WIRED_PAGES,
  type PageFrame,
  type PageId,
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

  it("replaces the top frame when the id matches and replaceTop is set", () => {
    const s = pushPage([], frame("platform", "company", { section: "overview" }));
    const next = pushPage(s, frame("platform", "company", { section: "services" }), true);
    expect(next).toHaveLength(1);
    expect(topPage(next)?.params.section).toBe("services");
  });

  it("keeps the frames below when it replaces the top", () => {
    let s = pushPage([], frame("settings"));
    s = pushPage(s, frame("platform", "company", { section: "overview" }));
    const next = pushPage(s, frame("platform", "company", { section: "ecosystem" }), true);
    expect(next).toHaveLength(2);
    expect(topPage(next)?.params.section).toBe("ecosystem");
    expect(next[0].id).toBe("settings");
  });

  it("appends rather than replaces when the id differs, even with replaceTop set", () => {
    const s = pushPage([], frame("settings"));
    expect(pushPage(s, frame("platform"), true)).toHaveLength(2);
  });

  it("is still an identical-frame no-op with replaceTop set", () => {
    const s = pushPage([], frame("platform", "company", { section: "overview" }));
    expect(pushPage(s, frame("platform", "company", { section: "overview" }), true)).toBe(s);
  });

  it("reports when a push would replace the top", () => {
    const s = pushPage([], frame("platform", "company", { section: "overview" }));
    expect(replacesTop(s, frame("platform", "company", { section: "services" }))).toBe(true);
    expect(replacesTop(s, frame("settings"))).toBe(false);
    expect(replacesTop([], frame("platform"))).toBe(false);
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
    expect(routeFromHash("#/company/platform", "hq")).toEqual({
      root: "company",
      frame: frame("platform", "company"),
    });
  });

  it("reads a trailing section into params", () => {
    expect(routeFromHash("#/company/settings/services", "hq")).toEqual({
      root: "company",
      frame: frame("settings", "company", { section: "services" }),
    });
  });

  it("wires every declared page — a PageId with no screen would blank the main area", () => {
    const declared: PageId[] = ["settings", "platform", "museum", "goals"];
    expect([...WIRED_PAGES].sort()).toEqual([...declared].sort());
  });

  it("ignores case and stray slashes", () => {
    expect(routeFromHash("#/COMPANY/Settings/", "hq")).toEqual({
      root: "company",
      frame: frame("settings", "company"),
    });
  });

  it("survives a malformed percent-escape instead of throwing", () => {
    expect(() => routeFromHash("#/company/settings/%", "hq")).not.toThrow();
    expect(routeFromHash("#/company/settings/%", "hq")).toEqual({
      root: "company",
      frame: frame("settings", "company", { section: "%" }),
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

  it("round-trips a section through encode and parse", () => {
    const withSection = frame("settings", "company", { section: "notifications" });
    expect(routeFromHash(hashForRoute("company", withSection), "hq")).toEqual({
      root: "company",
      frame: withSection,
    });
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
