# UI Redesign — Wave 1b (Page stack + Settings page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the hybrid navigation model — a small page stack over the tab roots — and prove it end to end by promoting **Settings** from a bottom sheet to a real pushed page with a working back chevron, Escape and browser-history back.

**Architecture:** The five tabs stay the roots. A page stack sits above them: when a page is pushed, the shell renders that page in place of the tab content and the shell header shows the page title plus a back chevron. The stack is a pure, unit-testable reducer plus a thin history-syncing hook. Settings is the first consumer; the sheet path remains for the flag-off build and for every other sheet.

**Tech Stack:** TypeScript · React 19 · Vite · Vitest (Node env, no DOM) · plain CSS with tokens.

**Spec:** `docs/superpowers/specs/2026-09-16-premium-ui-redesign-design.md` (sections 5 and 8.2)
**Predecessor:** `docs/superpowers/plans/2026-09-16-ui-redesign-wave-1a-chrome.md` — read its "Wave 1a outcome" for the geometry and the deferred minors this wave inherits.

## Global Constraints

- **Principle 0:** with `silicon.ui2` off (the default), the build is unchanged — the Settings sheet must still open exactly as it does today.
- **No engine changes.** Determinism pin untouched.
- **Pure logic is unit-tested; UI is verified by the screenshot harness.** There is no jsdom and no Testing-Library in this repo — do not add them.
- Design tokens only; explicit import extensions; Lucide icons only; no new dependencies.
- Gate per task: `tsc` 0 errors · suite green · `npm run build` · `npm run verify:ui2` PASS · flag-off frames unchanged.

---

### Task 1: The pure page stack

**Files:**
- Create: `src/state/pageStack.ts`
- Test: `src/state/pageStack.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type PageId`; `type PageStack`; `pushPage(stack, page)`; `popPage(stack)`; `topPage(stack)`; `pageFromHash(hash)`; `hashForPage(page)`; `PAGE_TITLES: Record<PageId, string>`. Consumed by Tasks 2–4.

- [ ] **Step 1: Write the failing test**

Create `src/state/pageStack.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/state/pageStack.test.ts`
Expected: FAIL — cannot resolve `./pageStack.ts`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/state/pageStack.ts`:

```ts
// The page stack: the navigation model ABOVE the five tab roots. Pushing a page shows it in place of
// the tab content; popping returns to the root. It is a plain array so the rules are pure and
// testable, and the hook that owns the live instance (usePageNav) is the only stateful part.
//
// Deliberately NOT a general router: there are no nested stacks, no params yet, and no page that is
// reachable only via another page. Adding those is a change to this file's contract, not a tweak.

export type PageId = "settings" | "platform" | "museum" | "goals";

export type PageStack = readonly PageId[];

/** Hosted-page titles, so the shell header and the hash encoder agree on what a page is called. */
export const PAGE_TITLES: Record<PageId, string> = {
  settings: "Settings",
  platform: "Platform",
  museum: "Device Museum",
  goals: "Goals",
};

const KNOWN: readonly PageId[] = ["settings", "platform", "museum", "goals"];

function isPageId(v: string): v is PageId {
  return (KNOWN as readonly string[]).includes(v);
}

/** Push a page. Pushing the page that is already on top is a no-op, so a double-tap cannot deepen
 *  the stack, and the caller can rely on identity to skip a re-render. */
export function pushPage(stack: PageStack, page: PageId): PageStack {
  if (topPage(stack) === page) return stack;
  return [...stack, page];
}

/** Pop the top page. Popping an empty stack is a no-op, so an Escape or back press on a root is safe. */
export function popPage(stack: PageStack): PageStack {
  if (stack.length === 0) return stack;
  return stack.slice(0, -1);
}

export function topPage(stack: PageStack): PageId | null {
  return stack.length ? stack[stack.length - 1] : null;
}

/** `#/settings` -> "settings". Anything unrecognised — including a bare `#`, an empty string, or a
 *  typo a player might paste — resolves to null (the root), never to a guessed page. */
export function pageFromHash(hash: string): PageId | null {
  const raw = hash.replace(/^#\/?/, "").trim().toLowerCase();
  return raw && isPageId(raw) ? raw : null;
}

/** The inverse, so the address bar always names the page that is actually showing. */
export function hashForPage(page: PageId | null): string {
  return page ? `#/${page}` : "#/";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/state/pageStack.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/pageStack.ts src/state/pageStack.test.ts
git commit -m "feat(ui2): add the pure page stack for the hybrid navigation model"
```

---

### Task 2: The live stack, synced to history

**Files:**
- Create: `src/state/usePageNav.ts`
- Test: `src/state/usePageNav.test.ts`

**Interfaces:**
- Consumes: everything from Task 1.
- Produces: `usePageNav(): { page: PageId | null; push(p: PageId): void; pop(): void }`; and the pure helper `nextStackForPopstate(stack, hash)` used by the hook. Consumed by Tasks 3–4.

- [ ] **Step 1: Write the failing test**

Create `src/state/usePageNav.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/state/usePageNav.test.ts`
Expected: FAIL — cannot resolve `./usePageNav.ts`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/state/usePageNav.ts`:

```ts
// The live page stack: React state plus the browser history it must agree with.
import { useCallback, useEffect, useState } from "react";
import { hashForPage, pageFromHash, popPage, pushPage, topPage, type PageId, type PageStack } from "./pageStack.ts";

/** A popstate event names a URL; the stack must become whatever that URL implies. Popping a single
 *  frame would be wrong when history moved forward, or when two pushes happened between events. */
export function nextStackForPopstate(stack: PageStack, hash: string): PageStack {
  const target = pageFromHash(hash);
  if (!target) return [];
  // Keep the frames below the target when they still lead to it, so a deep stack survives a Back
  // to a page that is still open beneath the top.
  const at = stack.lastIndexOf(target);
  return at >= 0 ? stack.slice(0, at + 1) : [target];
}

export function usePageNav(): { page: PageId | null; push: (p: PageId) => void; pop: () => void } {
  const [stack, setStack] = useState<PageStack>(() => {
    const fromHash = pageFromHash(typeof window === "undefined" ? "" : window.location.hash);
    return fromHash ? [fromHash] : [];
  });

  const push = useCallback((p: PageId) => {
    setStack((s) => {
      const next = pushPage(s, p);
      if (next !== s && typeof window !== "undefined") {
        window.history.pushState({ page: p }, "", hashForPage(p));
      }
      return next;
    });
  }, []);

  const pop = useCallback(() => {
    setStack((s) => {
      if (s.length === 0) return s;
      const next = s.slice(0, -1);
      if (typeof window !== "undefined") {
        // Back is only correct when this entry is one WE pushed (it carries our state). A page opened
        // by deep-link is the FIRST history entry, where history.back() would leave the site — so in
        // that case rewrite the hash to the parent instead.
        if (window.history.state?.page) window.history.back();
        else window.history.replaceState({}, "", hashForPage(topPage(next)));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onPop = () => setStack((s) => nextStackForPopstate(s, window.location.hash));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return { page: topPage(stack), push, pop };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/state/usePageNav.test.ts`
Expected: PASS (5 tests).

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/state/usePageNav.ts src/state/usePageNav.test.ts
git commit -m "feat(ui2): add the history-synced page nav hook"
```

---

### Task 3: The shell renders a pushed page

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `usePageNav` (Task 2), `PAGE_TITLES` (Task 1), `PageHeader`'s existing `onBack`/`tint` props.
- Produces: `page` and `pop` in scope for Task 4.

- [ ] **Step 1: Wire the nav in**

Add to `src/App.tsx`:

```ts
import { PAGE_TITLES } from "./state/pageStack.ts";
import { usePageNav } from "./state/usePageNav.ts";
```

In `AppShell`, beside the existing `uiVersion` / `layoutMode` reads (above the onboarding early return, because both are hooks):

```tsx
  const { page, pop } = usePageNav();
```

- [ ] **Step 2: Make the header page-aware**

Change the shell `PageHeader` render (inside `<main>`) so a pushed page wins the title and gets a back chevron:

```tsx
        {uiVersion === "next" && (
          <PageHeader
            title={page ? PAGE_TITLES[page] : tab === "hq" ? state.companyName || TAB_TITLE.hq : TAB_TITLE[tab]}
            tint={page ? undefined : TAB_TINT[tab]}
            onBack={page ? pop : undefined}
          />
        )}
```

- [ ] **Step 3: Render the page instead of the tab content**

In `src/App.tsx`, inside `<main className="app__main">`, hide the roots while a page is open — **hide, do not unmount**, because the HQ block's whole reason for existing is that its WebGL office stays mounted across navigation. Change the hq block's guard from `hidden={tab !== "hq"}` to:

```tsx
        <div className="app__screen" hidden={page != null || tab !== "hq"}>
```

and add `!page` to the other-tabs condition: `{!page && tab !== "hq" && (…)}` (those screens are already keyed remounts, so unmounting them costs nothing).

Then append the page itself after both blocks:

```tsx
        {/* A pushed page replaces the tab content. The HQ block stays MOUNTED (just hidden) so its
            WebGL office keeps its context, exactly as it does across tab switches. */}
        {page === "settings" && (
          <ErrorBoundary fallback={<ScreenError onHome={pop} />}>
            <Suspense fallback={<ScreenLoading title={PAGE_TITLES.settings} />}>
              <Settings onClose={pop} />
            </Suspense>
          </ErrorBoundary>
        )}
```

- [ ] **Step 4: Escape pops the page**

Add, beside the other shell effects in `AppShell`:

```tsx
  // Escape closes a pushed page, matching every popup in the app. The sheets own their own Escape
  // handling, so this only fires while a page is open and no sheet is up.
  useEffect(() => {
    if (!page) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && pop();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, pop]);
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck` → exit 0
Run: `npm test` → 1,960 tests (1,948 + the 7 in Task 1 + the 5 in Task 2)
Run: `npm run build` → green

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui2): the shell renders a pushed page with a back chevron and Escape"
```

---

### Task 4: Settings opens as a page when the flag is on

**Files:**
- Modify: `src/App.tsx` (the HUD's `onSettings` handler)

**Interfaces:**
- Consumes: `push` from Task 2.
- Produces: nothing later tasks rely on.

- [ ] **Step 1: Route the gear by flag**

Destructure `push` from the hook added in Task 3, then change the HUD handler:

```tsx
  const { page, push, pop } = usePageNav();
```

```tsx
      <Hud
        onSettings={() => (uiVersion === "next" ? push("settings") : setSettingsOpen(true))}
```

The existing `<Sheet open={settingsOpen} …>` stays exactly as it is — it now only ever opens on the flag-off path, which is the point: the shipped game keeps its sheet.

- [ ] **Step 2: Verify visually, all three paths**

Run:

```bash
$env:SHOTS_CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run shots:diff -- wave1b-off
$env:SHOTS_UI2="1"; npm run shots:diff -- wave1b-phone
$env:SHOTS_UI2="1"; $env:SHOTS_VIEWPORT="1024x768"; npm run shots:diff -- wave1b-wide
```

Then, from the phone flag-on capture directory, confirm the sheet still renders (09-settings.png shows the Settings **sheet**, since the harness never taps the gear — that is expected and is the flag-off parity check for `wave1b-off`).

Then prove the page path with a real deep-link. `scripts/shots-diff.mjs` navigates to `SHOTS_URL` when it is set, and it still starts its own preview server on 5199, so pointing it at the hash exercises exactly the deep-link branch:

```bash
$env:SHOTS_CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
$env:SHOTS_UI2="1"; $env:SHOTS_VIEWPORT="1024x768"
$env:SHOTS_URL="http://localhost:5199/#/settings"
npm run shots:diff -- wave1b-deeplink
```

Read `.shots/wave1b-deeplink/01-office-top.png` and confirm: the header reads **Settings** with a visible back chevron, and the Settings content is rendered in place of the Company/tab content. If `SHOTS_URL` does not take effect (the frames look like the normal Office screen), say so plainly in the report and confirm the wiring by reading the code path instead — do not claim a visual proof you did not obtain.

- [ ] **Step 3: Run the release audit**

Run: `npm run shots:stage:showcase; npm run audit:screens`
Expected: `CLEAN`.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui2): open Settings as a pushed page behind the flag"
```

---

## Wave 1b exit criteria

- [ ] Flag off → Settings still opens as the sheet; frames unchanged from the Wave 0 baseline.
- [ ] Flag on → the gear pushes a Settings page with a back chevron; Escape and browser Back both return to the root.
- [ ] The pure stack and the popstate rule are unit-tested (12 new tests).
- [ ] `tsc` 0 · 1,960 tests · build green · `verify:ui2` PASS · `audit:screens` CLEAN.
- [ ] No engine file touched.

## Deliberate scope notes

- **No params and no nested stacks yet.** `platform`, `museum` and `goals` are declared so the hash encoder round-trips them, but no screen is migrated to a page in this wave — that is Wave 2, and each gets its own plan.
- **The top bar is still `Hud`.** Restructuring it into the mockup's single row remains a separate, higher-risk task.
- **Sheet-hosted Settings is intentionally retained** for the flag-off path; the two paths must not both render the same screen at once, which the `uiVersion` branch guarantees.
