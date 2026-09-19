# UI Redesign — Wave 2a (Routing model) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the navigation model the shape the sub-apps need — `{ root, page, params }` — so a reload restores *which tab* a page was opened from, and a page can carry a parameter (the section it should open on).

**Architecture:** Wave 1b built a page stack of bare page ids and a hash that named only the page, so reloading `#/settings` always dropped the player on Office. This wave makes each stack frame carry its root tab and its params, parses/encodes a full route (`#/<root>[/<page>[/<section>]]`), and settles the header-ownership question the final review raised: **the shell owns the page header**, and a page that needs sub-navigation renders its own section rail inside the page body. No screen content is migrated here — that is Wave 2b onward.

**Tech Stack:** TypeScript · React 19 · Vite · Vitest (Node env, no DOM) · plain CSS with tokens.

**Spec:** `docs/superpowers/specs/2026-09-16-premium-ui-redesign-design.md` (sections 5 and 8.2)
**Predecessor:** `docs/superpowers/plans/2026-09-16-ui-redesign-wave-1b-page-stack.md` — read its "Wave 2 entry decision" note.

## Global Constraints

- **Principle 0:** with `silicon.ui2` off (the default), the build is unchanged. The routing model stays inert: `page`/`root` gated in the hook, no history writes, Settings still opens as the sheet.
- **No engine changes.** Determinism pin untouched.
- **Pure logic is unit-tested; UI is verified by the capture harness.** No jsdom, no Testing-Library, no new dependencies.
- Design tokens only; explicit import extensions; Lucide icons only.
- Gate: `tsc` 0 · suite green · `npm run build` · `npm run verify:ui2` PASS · flag-off frames unchanged.
- `RootId` becomes the single source of truth for the tab ids: `BottomNav` re-exports it as `Tab` so every existing `import { type Tab }` keeps working.

---

### Task 1: Route-aware frames in the pure model

**Files:**
- Modify: `src/state/pageStack.ts`
- Modify: `src/state/pageStack.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type RootId`; `type RouteParams`; `interface PageFrame { id; root; params }`; `type PageStack = readonly PageFrame[]`; `PAGE_TITLES` (unchanged); `WIRED_PAGES` (unchanged); `pushPage(stack, frame)`; `popPage(stack)`; `topPage(stack): PageFrame | null`; `routeFromHash(hash, fallbackRoot)`; `hashForRoute(root, frame)`; `sameFrame(a, b)`. Consumed by Tasks 2–4.

- [ ] **Step 1: Rewrite the tests to the new contract**

Replace `src/state/pageStack.test.ts` with:

```ts
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
    // Uses the WIRED `settings` page: a `platform` section test cannot resolve while
    // WIRED_PAGES is `["settings"]` (it would drop to the root), so the exercise uses `settings`.
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/state/pageStack.test.ts`
Expected: FAIL — `routeFromHash` / `hashForRoute` / `sameFrame` are not exported.

- [ ] **Step 3: Rewrite the model**

Replace the body of `src/state/pageStack.ts` (keep the header comment's intent, updated to the new contract):

```ts
// The page stack: the navigation model ABOVE the five tab roots. Each frame carries the ROOT tab it
// was opened from and its own params, so a reload restores both — a bare page id would drop the
// player back on Office. The rules are pure and testable; usePageNav owns the live instance.

/** The five tab roots. `BottomNav` re-exports this as `Tab`, so there is ONE source of truth for the
 *  root ids — a second hand-written union is how the nav and the router would drift apart. */
export type RootId = "hq" | "design" | "research" | "market" | "company";

export type PageId = "settings" | "platform" | "museum" | "goals";

export type RouteParams = Readonly<Record<string, string>>;

export interface PageFrame {
  readonly id: PageId;
  /** The tab that was active when this page was opened; encoded so a reload can restore it. */
  readonly root: RootId;
  readonly params: RouteParams;
}

export type PageStack = readonly PageFrame[];

/** Hosted-page titles. Replaced by richer per-page descriptors when a page needs its own actions. */
export const PAGE_TITLES: Record<PageId, string> = {
  settings: "Settings",
  platform: "Platform",
  museum: "Device Museum",
  goals: "Goals",
};

/** Pages that have a render block in the shell TODAY. `PageId` is deliberately wider than this set:
 *  the type names the pages the model will carry, this names the ones that can actually be shown. */
export const WIRED_PAGES: readonly PageId[] = ["settings"];

const ROOTS: readonly RootId[] = ["hq", "design", "research", "market", "company"];

function isRootId(v: string): v is RootId {
  return (ROOTS as readonly string[]).includes(v);
}

function isWiredPage(v: string): v is PageId {
  return (WIRED_PAGES as readonly string[]).includes(v);
}

/** Frames are compared by VALUE: `push` must be a no-op for the same page at the same params, but a
 *  different section is a genuinely different frame and must deepen the stack. */
export function sameFrame(a: PageFrame, b: PageFrame): boolean {
  if (a.id !== b.id || a.root !== b.root) return false;
  const ak = Object.keys(a.params);
  const bk = Object.keys(b.params);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => a.params[k] === b.params[k]);
}

/** Push a frame. An identical top frame is a no-op, so a double-tap cannot deepen the stack. */
export function pushPage(stack: PageStack, frame: PageFrame): PageStack {
  const top = topPage(stack);
  if (top && sameFrame(top, frame)) return stack;
  return [...stack, frame];
}

/** Pop the top frame. Popping an empty stack is a no-op, so Escape on a root is safe. */
export function popPage(stack: PageStack): PageStack {
  if (stack.length === 0) return stack;
  return stack.slice(0, -1);
}

export function topPage(stack: PageStack): PageFrame | null {
  return stack.length ? stack[stack.length - 1] : null;
}

/** `#/company/platform/services` -> { root: "company", frame: { id: "platform", params: { section:
 *  "services" } } }. An unrecognised root, or any absent value, yields the fallback root with no
 *  frame — never a guessed root, and never a page whose screen does not exist. */
export function routeFromHash(hash: string, fallbackRoot: RootId): { root: RootId; frame: PageFrame | null } {
  const parts = hash
    .replace(/^#\/?/, "")
    .split("/")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const root = parts[0] && isRootId(parts[0]) ? parts[0] : fallbackRoot;
  const id = parts[1];
  if (!id || !isWiredPage(id)) return { root, frame: null };
  const section = parts[2];
  return { root, frame: { id, root, params: section ? { section } : {} } };
}

/** The inverse, so the address bar always names the root and the page that are actually showing.
 *  Only `section` is URL-encoded today; a params key that must survive a reload has to be added
 *  here as well as in `routeFromHash`, or it will silently vanish from the link. */
export function hashForRoute(root: RootId, frame: PageFrame | null): string {
  if (!frame) return `#/${root}`;
  const section = frame.params.section ? `/${frame.params.section}` : "";
  return `#/${root}/${frame.id}${section}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/state/pageStack.test.ts`
Expected: PASS (16 tests). The section case uses the wired `settings` page — a `platform` section
test cannot resolve while `WIRED_PAGES` is `["settings"]`.

- [ ] **Step 5: Commit**

```bash
git add src/state/pageStack.ts src/state/pageStack.test.ts
git commit -m "feat(ui2): carry the root tab and params on each page frame"
```

---

### Task 2: The hook speaks routes

**Files:**
- Modify: `src/state/usePageNav.ts`
- Modify: `src/state/usePageNav.test.ts`

**Interfaces:**
- Consumes: everything from Task 1.
- Produces: `nextStackForPopstate(stack, hash, fallbackRoot)`; `usePageNav(): { root, page, params, push(id, params?), pop, clear }`. Consumed by Tasks 3–4.

- [ ] **Step 1: Rewrite the test to the new signature**

Replace `src/state/usePageNav.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/state/usePageNav.test.ts`
Expected: FAIL — the helper takes two arguments, not three.

- [ ] **Step 3: Update the hook**

Replace `src/state/usePageNav.ts` with:

```ts
// The live page stack: React state plus the browser history it must agree with.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  hashForRoute,
  popPage,
  pushPage,
  routeFromHash,
  sameFrame,
  topPage,
  type PageId,
  type PageStack,
  type RootId,
  type RouteParams,
} from "./pageStack.ts";
import { useUiVersion } from "./uiVersion.ts";

/** A popstate event names a URL; the stack must become whatever that URL implies. */
export function nextStackForPopstate(stack: PageStack, hash: string, fallbackRoot: RootId): PageStack {
  const { frame } = routeFromHash(hash, fallbackRoot);
  if (!frame) return [];
  // Keep the frames below the target when they still lead to it, so a deep stack survives a Back to
  // a page that is still open beneath the top.
  const at = stack.findIndex((f) => sameFrame(f, frame));
  return at >= 0 ? stack.slice(0, at + 1) : [frame];
}

export function usePageNav(
  currentRoot: RootId,
): { root: RootId; page: PageId | null; params: RouteParams; push: (p: PageId, params?: RouteParams) => void; pop: () => void; clear: () => void } {
  // Inert unless the flag is on. Gating HERE — the single source — keeps a stale hash from ever
  // making the CLASSIC build render a page, so every shell guard stays simple.
  const enabled = useUiVersion() === "next";
  const [stack, setStack] = useState<PageStack>(() => {
    const { frame } = routeFromHash(typeof window === "undefined" ? "" : window.location.hash, currentRoot);
    return frame ? [frame] : [];
  });
  // The live stack, mirrored in a ref so push/pop read it and perform their history side effect
  // OUTSIDE the state updater (React may invoke an updater more than once).
  const ref = useRef<PageStack>(stack);
  const commit = useCallback((next: PageStack) => {
    ref.current = next;
    setStack(next);
  }, []);

  const push = useCallback((p: PageId, params: RouteParams = {}) => {
    if (!enabled) return;
    const next = pushPage(ref.current, { id: p, root: currentRoot, params });
    if (next === ref.current) return;
    commit(next);
    if (typeof window !== "undefined") {
      window.history.pushState({ page: p }, "", hashForRoute(currentRoot, topPage(next)));
    }
  }, [commit, enabled, currentRoot]);

  const pop = useCallback(() => {
    if (!enabled) return;
    const current = ref.current;
    if (current.length === 0) return;
    const next = popPage(current);
    commit(next);
    if (typeof window === "undefined") return;
    // Back is only correct when this entry is one WE pushed (it carries our state). A deep-linked
    // page is the FIRST history entry, where history.back() would leave the site.
    if (window.history.state?.page) window.history.back();
    else window.history.replaceState({}, "", hashForRoute(currentRoot, topPage(next)));
  }, [commit, enabled, currentRoot]);

  // With the flag off there is no page to sync, so don't subscribe at all.
  useEffect(() => {
    if (!enabled) return;
    const onPop = () => {
      const next = nextStackForPopstate(ref.current, window.location.hash, currentRoot);
      ref.current = next;
      setStack(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [enabled, currentRoot]);

  /** Drop every page and return to the root. A no-op when nothing is open (so it is safe on a tab
   *  change), and it rewrites the hash whenever a page WAS open, so a stale deep link cannot leave
   *  the URL naming a page the player has closed. */
  const clear = useCallback(() => {
    if (ref.current.length === 0) return;
    ref.current = [];
    setStack([]);
    if (typeof window !== "undefined") window.history.replaceState({}, "", hashForRoute(currentRoot, null));
  }, [currentRoot]);

  const top = enabled ? topPage(stack) : null;
  return { root: top?.root ?? currentRoot, page: top?.id ?? null, params: top?.params ?? {}, push, pop, clear };
}
```

- [ ] **Step 4: Keep the call site compiling, then verify**

The hook's signature changed, so `src/App.tsx` must pass a root or `tsc` fails. Make the minimal call-site update now (Task 3 adds the route adoption proper):

```tsx
  const { page, push, pop, clear } = usePageNav(tab);
```

Run: `npx vitest run src/state/usePageNav.test.ts` → PASS (5 tests)
Run: `npm run typecheck` → exit 0
Run: `npm run build` → green

- [ ] **Step 5: Commit**

```bash
git add src/state/usePageNav.ts src/state/usePageNav.test.ts src/App.tsx
git commit -m "feat(ui2): the page nav speaks root+page+params routes"
```

---

### Task 3: The shell walks the route

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/BottomNav.tsx`

**Interfaces:**
- Consumes: `usePageNav(currentRoot)` from Task 2; `RootId` from Task 1.
- Produces: nothing later tasks rely on beyond the working route.

- [ ] **Step 1: Make `Tab` an alias of `RootId`**

In `src/components/BottomNav.tsx`, replace the local union with a re-export so there is one source of truth:

```tsx
import type { RootId } from "../state/pageStack.ts";
/** The root tab ids. Aliased from the router's `RootId` so the nav and the URL can never disagree. */
export type Tab = RootId;
```

Delete the old `export type Tab = "hq" | …` line. Every existing `import { type Tab } from "./BottomNav.tsx"` keeps working.

- [ ] **Step 2: Adopt the route's root on reload**

In `src/App.tsx`, the hook call already passes `tab` (Task 2). Destructure the route root and add an effect that adopts it once, so a reload of `#/market/settings` highlights Market:

```tsx
  const { page, push, pop, clear, root: routeRoot } = usePageNav(tab);
  // A deep link names the tab it was opened from; adopt it on FIRST mount so the nav highlight and
  // the URL agree. Runs once — after that the player's own tab taps own the state.
  const adoptedRoot = useRef(false);
  useEffect(() => {
    if (adoptedRoot.current) return;
    adoptedRoot.current = true;
    if (page && routeRoot !== tab) setTab(routeRoot);
    // Deliberately first-mount only: re-running would fight a tab tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 3: Keep the existing gates working**

Nothing else changes: `changeTab` still calls `clear()` then `setTab`; the header still renders `PAGE_TITLES[page]`; the hq block is still hidden (never unmounted) while `page != null`; the page block is still `{uiVersion === "next" && page === "settings" && (…)}`.

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck` → exit 0
Run: `npm test` → the suite from Tasks 1–2 plus the unchanged rest. Expected total: **1,948 + 16 + 5 = 1,969 tests**. If it is lower, a suite was skipped.
Run: `npm run build` → green

```bash
git add src/state/usePageNav.ts src/state/usePageNav.test.ts src/App.tsx src/components/BottomNav.tsx
git commit -m "feat(ui2): the shell walks a root+page+params route"
```

---

### Task 4: Verification

**Files:** none (evidence only).

- [ ] **Step 1: Flag-off parity**

Run:

```bash
$env:SHOTS_CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
Remove-Item Env:\SHOTS_UI2 -ErrorAction SilentlyContinue; Remove-Item Env:\SHOTS_URL -ErrorAction SilentlyContinue
npm run shots:diff -- wave2a-off
```

Expected: `09-settings.png` is the Settings **sheet**; no frame shows a page header. Compare with `.shots/wave0-baseline/`.

- [ ] **Step 2: Deep-link restores the root**

Run:

```bash
$env:SHOTS_UI2="1"; $env:SHOTS_VIEWPORT="1024x768"
$env:SHOTS_URL="http://localhost:5199/#/market/settings"
npm run shots:diff -- wave2a-deeplink
```

Read `.shots/wave2a-deeplink/01-office-top.png` and confirm: the **Market** rail item is highlighted, the header reads "Settings" with a back chevron, and the Settings content is showing — i.e. the root was restored from the URL, not defaulted to Office. If `SHOTS_URL` does not take effect, say so plainly instead of claiming a proof you did not obtain.

- [ ] **Step 3: First-run guard and release audit**

Run: `npm run verify:ui2`
Expected: `PASS`.

Run: `npm run shots:stage:showcase; npm run audit:screens`
Expected: `CLEAN`.

- [ ] **Step 4: Record the outcome**

Append a short "Wave 2a outcome" section to this plan: status, commit range, the exact gate output, and any deferred minors. Do not commit `.shots/`.

---

## Wave 2a exit criteria

- [ ] Flag off → Settings still opens as the sheet; frames unchanged from the baseline.
- [ ] Flag on → `#/market/settings` reloads with **Market** highlighted and the Settings page open.
- [ ] The route round-trips every wired page under every root (unit-tested).
- [ ] `tsc` 0 · 1,969 tests · build green · `verify:ui2` PASS · `audit:screens` CLEAN.
- [ ] No engine file touched.

## Decisions this wave makes (so Wave 2b does not re-litigate them)

1. **Header ownership: the shell owns it.** A page does not compose its own `PageHeader`; the shell renders title + back from the route. A page that needs sub-navigation (Platform's six sections, Settings' eight) renders its own **section rail inside the page body**, below the shell header. This keeps one title per page and avoids the double-title class of bug Wave 1b hit.
2. **Params are the URL's job, not React state's.** Section selection travels in the hash (`#/company/platform/services`) so it is linkable and survives a reload; a page reads its section from the `params` it is given rather than holding it locally.
3. **The model stays a stack of frames**, even though only one page exists today, because Back must be able to walk a page chain once Platform links to a sub-page.

## Deliberate scope notes

- **No screen content changes.** Settings keeps its current body; Platform, Museum and Goals still have no render block and their hashes still resolve to "root only".
- **`WIRED_PAGES` is still `["settings"]`.** Wave 2b adds `platform` and its render block in the same change, so the two can never disagree.
- **`PAGE_TITLES` is not yet a descriptor.** When a page needs a right-hand action or a subtitle, promote it to a `PAGE_DEFS` record in that page's own plan rather than growing this one speculatively.

---

## Wave 2a outcome (completed 2026-09-16)

**Status: COMPLETE.** Three batched tasks plus two fix rounds, each independently reviewed.

**Verification on the final HEAD:**

- 
pm run typecheck - 0 errors
- 
pm test - 1,971 passed / 181 files (1,948 + 18 new route tests + 5 hook tests)
- 
pm run build - green
- 
pm run verify:ui2 - PASS
- 
pm run audit:screens - CLEAN
- Flag off -  9-settings is still the Settings sheet; no frame shows a page header
- **Deep link** - #/market/settings boots with **Market** highlighted, the Settings page open, a back chevron, and exactly one title (
pm run verify:deeplink now asserts this)
- No engine file touched

**Why a new script exists:** the screenshot harness presses Escape during boot to dismiss interrupts, and Escape pops a deep-linked page — so its frame showed Office and could not prove the invariant. scripts/verify-deeplink-ui2.mjs boots at the hash and asserts the rail highlight, the header title, the back chevron and that Settings' own .set__title is suppressed, without dismissing anything. Run it with 
pm run verify:deeplink (after 
pm run build).

**Fix rounds:**

1. A tab change from an open page wrote the OLD root into the URL (clear() ran before setTab), so the address bar named the tab being left and a reload landed wrong. clear now takes the destination root.
2. URL-encoding the section introduced a throw: decodeURIComponent on a malformed hash (#/company/settings/%) raised URIError at boot. A safeDecode makes the parser total again, pinned by a test.

**Two plan defects the implementer caught:** the section-parsing test used platform, which is deliberately unwired and so can never resolve — retargeted to the wired settings page with the intent preserved; and the plan's arithmetic was off, 16 tests in the model not 15, so the suite is 1,971. The plan text was corrected in the same commit.

**Deferred minors (carry into Wave 2b):**

- Section case is not preserved on round-trip (the parser lowercases before decoding); only matters if a case-sensitive param is ever added.
- A second tab tap while no page is open can still leave the URL naming the previous root (the Wave 1b early-return rule, outside this wave's scope).
- hashForRoute calls encodeURIComponent, which throws on a lone surrogate; no in-repo caller can supply one.
- Commit 305c4ea alone does not typecheck (the batch is linear by design); a bisect would want the tasks squashed.
- Legacy single-segment links (#/settings) now mean "root, no page" rather than the Settings page.

**Wave 2b entry:** the section rail. A page renders its own rail in the body (the shell owns the header, settled here), and WIRED_PAGES gains platform in the same change that adds its render block, so the two can never disagree.
