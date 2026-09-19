# UI Redesign — Wave 0 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the flag-gated, responsive foundation for the Silicon 2.0 redesign without changing a single pixel of the shipped game.

**Architecture:** Wave 0 is purely additive. It adds a UI-version flag (defaulting to the shipped game), a pure layout-mode resolver, layout tokens, a vertical `RailNav`, and mounts the rail *alongside* the existing chrome only when the flag is on. The existing HUD, bottom nav, screens, sheets and engine are untouched. No screen is migrated in this wave — that is Wave 1.

**Tech Stack:** TypeScript · React 19 · Vite · Vitest (node env, no DOM/Testing-Library) · plain CSS with design tokens · Playwright screenshot harness.

**Spec:** `docs/superpowers/specs/2026-09-16-premium-ui-redesign-design.md`

## Global Constraints

- **Principle 0:** `main` is the released game; this work must be additive and revertable.
- **Flag default is `classic`.** With the flag off, DOM-only screens must be **byte-identical** to today's build; frames containing the animated 3D office scene are compared with `npm run shots:pixel` and any difference must be proven animation-only by reading the frame.
- **No engine changes.** Nothing in `src/engine/` may be touched in this wave. Determinism pin must stay byte-identical.
- **Design tokens only.** No hardcoded colours, spacing, or radii. 8pt spacing scale.
- **Tests run in the Node environment** — there is no jsdom or Testing-Library in this repo. Logic gets Vitest tests; visuals are verified with the screenshot harness.
- **`tsc` must exit 0**, the full suite must stay green (1,937 tests today), and `npm run build` must succeed after every task.
- Repo import style uses explicit extensions (`./settings.ts`, `./BottomNav.tsx`).
- Do not commit unless the owner asks; the commit steps below are the intended checkpoints for whoever executes the plan.

---

### Task 0: Capture the golden baseline

**Files:** none (produces review artifacts only — `.shots/` is gitignored).

**Why this is first:** the whole wave rests on "flag off is byte-identical on DOM-only screens" (the animated 3D frames are compared with `npm run shots:pixel`), and `.shots/` is not committed, so there is no baseline in a fresh checkout. It must be captured from the **unmodified** tree, before Task 1.

- [ ] **Step 1: Build and capture the current game**

Run:

```bash
npm run build
$env:SHOTS_CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"; npm run shots:diff -- wave0-baseline
```

Expected: ten frames in `.shots/wave0-baseline/` — this is the golden baseline every later comparison uses.

- [ ] **Step 2: Confirm the tree is clean**

Run: `git status --short`
Expected: only the two approved heredoc-free edits from earlier work, or nothing. If the tree already contains uncommitted UI changes, capture the baseline on a clean checkout instead — a baseline from a dirty tree proves nothing.

---

### Task 1: UI-version flag

**Files:**
- Create: `src/state/uiVersion.ts`
- Test: `src/state/uiVersion.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type UiVersion = "classic" | "next"`; `resolveUiVersion(urlParam: string | null, stored: string | null): UiVersion`; `initUiVersion(): void`; `getUiVersion(): UiVersion`; `uiNextEnabled(): boolean`; `setUiVersion(v: UiVersion): void`; `useUiVersion(): UiVersion`.

- [ ] **Step 1: Write the failing test**

Create `src/state/uiVersion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveUiVersion } from "./uiVersion.ts";

// The flag resolves from a URL param -> stored value -> the shipped game. "classic" is the default
// and the safe answer for anything unrecognised: a typo must never strand a player in a half-built UI.
describe("resolveUiVersion", () => {
  it("defaults to the shipped game when nothing is set", () => {
    expect(resolveUiVersion(null, null)).toBe("classic");
  });

  it("lets the URL param win over storage", () => {
    expect(resolveUiVersion("next", "classic")).toBe("next");
    expect(resolveUiVersion("classic", "next")).toBe("classic");
  });

  it("falls back to storage when the param is absent", () => {
    expect(resolveUiVersion(null, "next")).toBe("next");
    expect(resolveUiVersion(null, "classic")).toBe("classic");
  });

  it("accepts the friendly aliases", () => {
    for (const v of ["next", "1", "true", "2", " NEXT "]) expect(resolveUiVersion(v, null)).toBe("next");
    for (const v of ["classic", "0", "false", "Classic"]) expect(resolveUiVersion(v, null)).toBe("classic");
  });

  it("treats an unrecognised value as unset instead of trusting it", () => {
    expect(resolveUiVersion("banana", null)).toBe("classic");
    expect(resolveUiVersion("banana", "next")).toBe("next");
    expect(resolveUiVersion("", "")).toBe("classic");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/state/uiVersion.test.ts`
Expected: FAIL — cannot resolve `./uiVersion.ts`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/state/uiVersion.ts`:

```ts
// UI version — which chrome the app renders. "classic" is the shipped game and the default;
// "next" opts into the Silicon 2.0 shell. Its own store (like settings) so it survives restarts,
// and resolvable from a URL param so the screenshot harness can flip it without touching storage.
import { useSyncExternalStore } from "react";

export type UiVersion = "classic" | "next";

const KEY = "silicon.ui2";

function normalise(v: string | null): UiVersion | null {
  if (v === null) return null;
  const s = v.trim().toLowerCase();
  if (s === "next" || s === "1" || s === "true" || s === "2") return "next";
  if (s === "classic" || s === "0" || s === "false") return "classic";
  return null;
}

/** Pure: URL param wins over storage, storage wins over the default. Every absent or unrecognised
 *  value resolves to "classic" — the shipped game is always the safe answer. */
export function resolveUiVersion(urlParam: string | null, stored: string | null): UiVersion {
  return normalise(urlParam) ?? normalise(stored) ?? "classic";
}

function readParam(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("ui");
  } catch {
    return null;
  }
}

function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let current: UiVersion = "classic";
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function initUiVersion(): void {
  current = resolveUiVersion(readParam(), readStored());
  emit();
}

export function getUiVersion(): UiVersion {
  return current;
}

export function uiNextEnabled(): boolean {
  return current === "next";
}

export function setUiVersion(v: UiVersion): void {
  current = v;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* storage unavailable — the in-memory value still applies for this session */
  }
  emit();
}

export function useUiVersion(): UiVersion {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current,
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/state/uiVersion.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/uiVersion.ts src/state/uiVersion.test.ts
git commit -m "feat(ui2): add the UI-version flag, defaulting to the shipped game"
```

---

### Task 2: Layout modes

**Files:**
- Create: `src/design/layout.ts`
- Test: `src/design/layout.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `LAYOUT_BREAKPOINTS = { tablet: 700, wide: 1100 }`; `type LayoutMode = "phone" | "tablet" | "wide"`; `layoutModeForWidth(width: number): LayoutMode`; `railShown(mode: LayoutMode): boolean`; `useLayoutMode(): LayoutMode`.

- [ ] **Step 1: Write the failing test**

Create `src/design/layout.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/design/layout.test.ts`
Expected: FAIL — cannot resolve `./layout.ts`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/design/layout.ts`:

```ts
// Layout modes for the responsive shell. These breakpoints are the single source of truth: the CSS
// media queries are written to match these numbers. The resolver is pure so the thresholds are
// testable without a DOM.
import { useEffect, useState } from "react";

export const LAYOUT_BREAKPOINTS = { tablet: 700, wide: 1100 } as const;

export type LayoutMode = "phone" | "tablet" | "wide";

/** Pure: width -> mode. The boundary belongs to the wider mode. A non-finite width is phone, the
 *  conservative answer, so a bad measurement can never force the desktop chrome onto a phone. */
export function layoutModeForWidth(width: number): LayoutMode {
  if (!Number.isFinite(width) || width < LAYOUT_BREAKPOINTS.tablet) return "phone";
  if (width >= LAYOUT_BREAKPOINTS.wide) return "wide";
  return "tablet";
}

/** The side rail replaces the bottom tab bar on tablet and wide. */
export function railShown(mode: LayoutMode): boolean {
  return mode !== "phone";
}

/** Live layout mode. Both queries only fire on a boundary crossing, so this is cheap. */
export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(() =>
    layoutModeForWidth(typeof window === "undefined" ? 0 : window.innerWidth),
  );
  useEffect(() => {
    const update = () => setMode(layoutModeForWidth(window.innerWidth));
    update();
    const tablet = window.matchMedia(`(min-width: ${LAYOUT_BREAKPOINTS.tablet}px)`);
    const wide = window.matchMedia(`(min-width: ${LAYOUT_BREAKPOINTS.wide}px)`);
    tablet.addEventListener("change", update);
    wide.addEventListener("change", update);
    return () => {
      tablet.removeEventListener("change", update);
      wide.removeEventListener("change", update);
    };
  }, []);
  return mode;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/design/layout.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/design/layout.ts src/design/layout.test.ts
git commit -m "feat(ui2): add pure layout-mode resolution for the responsive shell"
```

---

### Task 3: Layout tokens

**Files:**
- Modify: `src/design/tokens.css` (add to the `:root` block, after `--edge` on line ~105)

**Interfaces:**
- Consumes: nothing.
- Produces: the custom properties `--rail-w`, `--rail-w-compact`, `--topbar-h`, `--content-max`, `--content-max-tablet`, `--content-max-wide`.

- [ ] **Step 1: Add the tokens**

In `src/design/tokens.css`, directly after the `--edge: 20px;` line, add:

```css
  /* Layout — responsive shell. design/layout.ts holds the matching JS breakpoints; keep the two
     in sync by hand (there is a test asserting the JS side is ordered, and tokenRefs.test.ts
     guarantees every reference below resolves). */
  --rail-w: 208px;
  --rail-w-compact: 76px;
  --topbar-h: 52px;
  --content-max: 540px;         /* the phone column, matching #root today */
  --content-max-tablet: 760px;
  --content-max-wide: 1200px;
```

- [ ] **Step 2: Verify the token guard passes**

Run: `npx vitest run src/design/tokenRefs.test.ts`
Expected: PASS. (This suite fails the build if any `var(--x)` references a token that is never defined.)

- [ ] **Step 3: Commit**

```bash
git add src/design/tokens.css
git commit -m "feat(ui2): add responsive layout tokens"
```

---

### Task 4: Share the tab definitions

**Files:**
- Modify: `src/components/BottomNav.tsx:8`

**Interfaces:**
- Consumes: nothing.
- Produces: `export const TABS` (was module-private) — the single source of tab truth, consumed by `RailNav` in Task 5.

- [ ] **Step 1: Export `TABS`**

In `src/components/BottomNav.tsx`, change:

```tsx
const TABS: { id: Tab; label: string; Icon: LucideIcon; color: string }[] = [
```

to:

```tsx
/** The five root tabs. Exported so RailNav (the wide-layout twin) reads the same list — a second
 *  hand-written copy is how the bottom nav and the rail would silently drift apart. */
export const TABS: { id: Tab; label: string; Icon: LucideIcon; color: string }[] = [
```

- [ ] **Step 2: Verify typecheck and the existing bottom-nav behaviour**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npx vitest run src/state/navAttention.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/BottomNav.tsx
git commit -m "refactor(nav): export the shared tab list for the upcoming rail"
```

---

### Task 5: `RailNav`

**Files:**
- Create: `src/components/RailNav.tsx`
- Create: `src/components/railNav.css`

**Interfaces:**
- Consumes: `TABS`, `type Tab` from `./BottomNav.tsx`; `Attention` from `../state/gameState.ts`; `haptic` from `../design/haptics.ts`.
- Produces: `RailNav({ active, onChange, badge, visible })` — same prop contract as `BottomNav`.

- [ ] **Step 1: Create the component**

Create `src/components/RailNav.tsx`:

```tsx
import { haptic } from "../design/haptics.ts";
import type { Attention } from "../state/gameState.ts";
import { TABS, type Tab } from "./BottomNav.tsx";
import "./railNav.css";

/** The vertical side rail that replaces the bottom tab bar on tablet and wide layouts. It reads the
 *  same TABS list as BottomNav, so the two presentations can never disagree about the roots. */
export function RailNav({
  active,
  onChange,
  badge,
  visible,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  /** Per-tab attention weight — identical contract to BottomNav. */
  badge?: Partial<Record<Tab, Attention>>;
  /** Progressive onboarding; omitted → every tab shows. */
  visible?: Partial<Record<Tab, boolean>>;
}) {
  const shown = TABS.filter((t) => visible == null || visible[t.id] || t.id === active);
  return (
    <nav className="railnav" aria-label="Primary">
      {shown.map((t) => (
        <button
          key={t.id}
          className={`railnav__item${active === t.id ? " railnav__item--active" : ""}`}
          style={active === t.id ? { color: t.color } : undefined}
          onClick={() => {
            if (active !== t.id) haptic.light();
            onChange(t.id);
          }}
          aria-current={active === t.id ? "page" : undefined}
        >
          <span className="railnav__glyph" aria-hidden>
            <t.Icon size={20} strokeWidth={active === t.id ? 2.4 : 2} />
            {badge?.[t.id] && active !== t.id && (
              <span className={`railnav__badge railnav__badge--${badge[t.id]}`} />
            )}
          </span>
          <span className="railnav__label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Create the stylesheet**

Create `src/components/railNav.css`:

```css
/* The wide-layout side rail. Fixed like the bottom nav, but clamped to the content column so it
   never drifts to the viewport edge on a 13" iPad. Only mounts at tablet/wide (App gates it). */
.railnav {
  position: fixed;
  left: max(var(--edge), calc(50% - var(--content-max-tablet) / 2));
  top: calc(var(--topbar-h) + var(--sp-16));
  z-index: 28;
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  width: var(--rail-w);
  padding: var(--sp-8);
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: var(--r-card);
  box-shadow: var(--shadow-card);
}
.railnav__item {
  display: flex;
  align-items: center;
  gap: var(--sp-12);
  min-height: 44px;
  padding: 0 var(--sp-12);
  border-radius: var(--r-button);
  color: var(--ink-3);
  transition: color var(--spring-snappy), background var(--spring-snappy);
}
.railnav__item--active {
  background: var(--accent-soft);
}
.railnav__item:active {
  transform: scale(0.98);
}
.railnav__glyph {
  position: relative;
  display: inline-flex;
}
/* Same two attention weights as the bottom nav — act (urgent, expiring) vs opportunity. */
.railnav__badge {
  position: absolute;
  top: -2px;
  right: -5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1.5px solid var(--surface);
  background: var(--negative);
}
.railnav__badge--opportunity {
  top: -1px;
  right: -4px;
  width: 5px;
  height: 5px;
  background: var(--accent);
  opacity: 0.75;
}
.railnav__label {
  font-size: var(--fs-caption);
  font-weight: 600;
}
```

- [ ] **Step 3: Verify typecheck, tokens and the build**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npx vitest run src/design/tokenRefs.test.ts`
Expected: PASS (every `var(--x)` in `railNav.css` resolves).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/RailNav.tsx src/components/railNav.css
git commit -m "feat(ui2): add the RailNav side rail for wide layouts"
```

---

### Task 6: Mount the rail behind the flag

**Files:**
- Modify: `src/App.tsx` (imports; the `.app` root div at line ~179; after `<Hud …/>` which ends at line ~185)
- Modify: `src/main.tsx` (the `initSettings()` call at line 24)

**Interfaces:**
- Consumes: `useUiVersion` from `./state/uiVersion.ts`; `useLayoutMode`, `railShown` from `./design/layout.ts`; `RailNav` from `./components/RailNav.tsx`.
- Produces: nothing new for later tasks; this is the wiring step.

- [ ] **Step 1: Initialise the flag at boot**

In `src/main.tsx`, add the import beside the settings import:

```ts
import { initUiVersion } from "./state/uiVersion.ts";
```

and call it immediately after `initSettings();`:

```ts
  initSettings();
  // Which chrome the app renders. Must run before React mounts so the first paint is already
  // on the correct version — flipping after mount would flash the classic shell first.
  initUiVersion();
```

- [ ] **Step 2: Read the flag and mode in App**

In `src/App.tsx`, add the imports:

```ts
import { RailNav } from "./components/RailNav.tsx";
import { railShown, useLayoutMode } from "./design/layout.ts";
import { useUiVersion } from "./state/uiVersion.ts";
```

Then, in the component body — directly after the `showWorldTabs` line (~line 176) and before `return (` — add:

```tsx
  // Silicon 2.0 foundation. With the flag off this component renders exactly what it did before:
  // the rail is the ONLY addition, and it only mounts when both the flag is on and the viewport is
  // wide enough. Nothing below is otherwise touched, which is what keeps the flag-off build
  // pixel-identical to the shipped game.
  const uiVersion = useUiVersion();
  const layoutMode = useLayoutMode();
  const showRail = uiVersion === "next" && railShown(layoutMode);
```

- [ ] **Step 3: Add the mode class and mount the rail**

Change the root div (line ~179) from:

```tsx
    <div className="app">
```

to:

```tsx
    <div className={`app${uiVersion === "next" ? " app--next" : ""}`}>
```

Then, immediately after the closing `/>` of `<Hud …>` (line ~185) and before `<main className="app__main">`, add:

```tsx
      {showRail && (
        <RailNav active={tab} onChange={setTab} badge={navAttention(state)} visible={tabVisible} />
      )}
```

- [ ] **Step 4: Verify everything still passes**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npm test`
Expected: 1,948 tests pass across 179 files — the same tests as before plus Wave 0's two new files (1,937 baseline + 5 in `uiVersion.test.ts` + 6 in `layout.test.ts`). No existing behaviour changes, so no existing test may fail. If the count is lower, a suite was skipped.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/main.tsx
git commit -m "feat(ui2): mount the side rail behind the UI-version flag"
```

---

### Task 7: Flag-off regression and flag-on verification

**Files:**
- Modify: `scripts/shots-diff.mjs` (the `ctx.addInitScript` block, lines ~109-114)
- Create: `scripts/verify-onboarding-ui2.mjs`

**Interfaces:**
- Consumes: the `silicon.ui2` storage key from Task 1, and the `?ui=` URL param it also accepts.
- Produces: `SHOTS_UI2=1` support in the screenshot harness (used again in every later wave), plus a first-run regression check that survives into later waves.

> **Plan defect found in Task 6 and ruled on by the controller.** The brief originally placed Task 6's two hooks *after* `App.tsx`'s onboarding early return, which violates React's rules of hooks and crashes every new player the moment onboarding completes. The hooks were moved above the return. Step 5 below was added because Task 7's screenshot passes never exercise the first-run path, which is exactly the path that defect was on.

- [ ] **Step 1: Teach the harness about the flag**

In `scripts/shots-diff.mjs`, change the init script payload:

```js
  await ctx.addInitScript((v) => {
    const t = Number(v.scale) === 100 ? {} : { textScale: Number(v.scale) };
    localStorage.setItem("silicon.save.v1", v.staged);
    // Dark + tutorials pre-seen: the app's signature look, no first-run popups in frame.
    localStorage.setItem("silicon.settings", JSON.stringify({ theme: "dark", sound: false, haptics: false, highContrast: false, decorateTutorialSeen: true, factoryTutorialSeen: true, dailyReminder: false, notifPrompted: true, ...t }));
    // SHOTS_UI2=1 captures the Silicon 2.0 shell instead of the shipped one.
    if (v.ui2) localStorage.setItem("silicon.ui2", "next");
  }, { staged, scale: textScale, ui2: process.env.SHOTS_UI2 === "1" });
```

- [ ] **Step 2: Capture the flag-off build and prove it is unchanged**

Run:

```bash
npm run build
$env:SHOTS_CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"; npm run shots:diff -- wave0-classic
```

Expected: ten frames written to `.shots/wave0-classic/`. Compare each against the same frame in `.shots/wave0-baseline/` (captured in Task 0 from the pre-flag tree). **DOM-only frames must be byte-identical.** Frames containing the animated 3D office scene are never pixel-stable, so compare them with `npm run shots:pixel -- .shots/wave0-baseline .shots/wave0-classic` and accept a non-zero diff only after reading the frame to prove it is animation, not layout. Confirm by reading at least `01-office-top.png` and `08-company.png` with the Read tool. Any layout difference means the flag-off path is not additive and must be fixed before proceeding.

- [ ] **Step 3: Capture the flag-on build**

Run:

```bash
$env:SHOTS_CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"; $env:SHOTS_UI2="1"; npm run shots:diff -- wave0-next
```

Expected: frames written to `.shots/wave0-next/`, captured at the harness's 390×844 phone viewport. Because 390px is below the 700px tablet breakpoint, **the rail is correctly absent** — this run proves the flag-on path does not disturb the phone layout.

- [ ] **Step 4: Prove the rail at a wide viewport**

Run:

```bash
$env:SHOTS_CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"; $env:SHOTS_UI2="1"; $env:SHOTS_VIEWPORT="1024x768"; npm run shots:diff -- wave0-next-wide
```

Expected: frames in `.shots/wave0-next-wide/` show the vertical rail on the left with all five tabs, the bottom tab bar also present, and the game rendering normally. Read `01-office-top.png` to confirm the rail is visible, clamped to the content column, and not covering the office scene.

- [ ] **Step 5: Prove the first-run path does not crash (flag on)**

The screenshot passes all start from a seeded save, so none of them walks onboarding — the exact path the Task 6 hook-order defect lived on. Create `scripts/verify-onboarding-ui2.mjs`:

```js
// Verify the Silicon 2.0 shell does not break FIRST RUN: complete onboarding with the flag on and
// confirm React never throws a hook-order error. The flag is forced by the URL param, so no storage
// seeding is needed and the run also proves the param path works.
//   npm run build && node scripts/verify-onboarding-ui2.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
const indexFile = resolve(distDir, "index.html");
if (!existsSync(indexFile)) { console.error("dist/index.html missing - run `npm run build` first."); process.exit(1); }

const server = createServer(async (req, res) => {
  const p = decodeURIComponent((req.url || "/").split("?")[0]);
  const c = p === "/" ? indexFile : resolve(distDir, "." + normalize(p));
  let f = c, b;
  try { b = await readFile(c); } catch { f = indexFile; b = await readFile(indexFile); }
  res.writeHead(200, { "content-type": MIME[extname(f)] || "text/html" });
  res.end(b);
});
await new Promise((r) => server.listen(0, r));
const URL = `http://localhost:${server.address().port}/?ui=next`;

const CHROME_ARGS = ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"];
const PINNED = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const chromePath = process.env.SHOTS_CHROME || (existsSync(PINNED) ? PINNED : undefined);
const browser = await chromium.launch({ ...(chromePath ? { executablePath: chromePath } : {}), args: CHROME_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem("silicon.settings", JSON.stringify({ theme: "dark", sound: false, haptics: false, decorateTutorialSeen: true, factoryTutorialSeen: true, notifPrompted: true }));
});
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(3000);

// Same generic walk `audit:screens` uses: always take the decline/skip path, stop at the nav.
let reached = await p.$(".bnav__item").then(Boolean);
for (let step = 0; step < 8 && !reached; step++) {
  const clicked = await p.evaluate(() => {
    const vis = [...document.querySelectorAll("button")].filter((b) => b.offsetParent !== null);
    if (!vis.length) return null;
    const decline = vis.find((b) => /not now|maybe later|skip|^found /i.test((b.textContent || "").trim()));
    const target = decline || vis[vis.length - 1];
    target.click();
    return (target.textContent || "").trim().slice(0, 40);
  });
  if (!clicked) break;
  await p.waitForTimeout(900);
  reached = await p.$(".bnav__item").then(Boolean);
}
if (!reached) reached = await p.waitForSelector(".bnav__item", { timeout: 15000 }).then(() => true).catch(() => false);

const rail = await p.$(".railnav").then(Boolean);
await browser.close();
server.close();

if (!reached) { console.error("FAIL: onboarding never reached the game."); process.exit(1); }
if (errors.some((e) => /hook/i.test(e))) { console.error("FAIL: hook error during first run:\n" + errors.join("\n")); process.exit(1); }
if (errors.length) { console.error("FAIL: console/page errors during first run:\n" + errors.join("\n")); process.exit(1); }
if (!rail) { console.error("FAIL: flag on at 1024x768 but the rail never rendered."); process.exit(1); }
console.log("PASS: onboarding completed with the flag on, no hook/console errors, rail rendered.");
```

Run: `npm run build; node scripts/verify-onboarding-ui2.mjs`
Expected: `PASS: onboarding completed with the flag on, no hook/console errors, rail rendered.` A hook-order regression exits 1 with the React error text.

- [ ] **Step 6: Run the release audit**

Run: `npm run build; npm run shots:stage:showcase; npm run audit:screens`
Expected: `CLEAN` — every pass meets its coverage floor, no console/page/request errors on any screen.

- [ ] **Step 7: Commit**

```bash
git add scripts/shots-diff.mjs scripts/verify-onboarding-ui2.mjs
git commit -m "test(ui2): capture the flag-off regression set, the wide rail, and the first-run path"
```

---

## Wave 0 exit criteria

- [ ] Flag off → DOM-only frames byte-identical to the shipped build; 3D frames proven animation-only with `npm run shots:pixel` (Task 7 Step 2).
- [ ] Flag on at 390px → no change to the phone layout (Task 7 Step 3).
- [ ] Flag on at 1024px → the rail renders, uses the shared `TABS`, and respects the progressive `visible` gate (Task 7 Step 4).
- [ ] `tsc` 0 errors · 1,947 tests pass · `build` green · `audit:screens` CLEAN.
- [ ] Determinism pin untouched (no engine file changed).

## Deliberate scope notes

- **Wave 0 does not swap the chrome.** The rail is additive; the classic HUD and bottom nav stay. Ripping out the chrome is Wave 1's first task, where it can be verified against a migrated screen.
- **The pattern library is built just-in-time, not in Wave 0.** The spec lists ten primitives, but building them before a screen needs them would be speculative work. Each primitive gets its own task in the wave whose screen first consumes it — `PageHeader` and `StatTile` in Wave 1, `DataChart` and `KeyStatsPanel` with the Company screen, `CardGrid` and `EmptyState` with the Museum, and so on. This is the YAGNI ordering, and it keeps every task's deliverable genuinely testable.
- **No engine work exists in this wave**, so there is nothing to gate, backfill, or salt.

---

## Wave 0 outcome (completed 2026-09-16)

**Status: COMPLETE.** All 7 tasks plus one fix wave ran subagent-driven; every task passed an independent spec + quality review, and the whole branch passed a final review.

**Flag:** silicon.ui2, default classic. URL override for QA: ?ui=next / ?ui=classic.

**Verification on the final HEAD:**

- 
pm run typecheck - 0 errors
- 
pm test - 1,948 passed / 179 files
- 
pm run build - green
- 
ode scripts/verify-onboarding-ui2.mjs - PASS (first run, flag on, no hook or console errors, rail rendered)
- 
pm run audit:screens - CLEAN (5/5 nav screens, 12/12 sub-tabs, 10/10 Progress views, 4/4 Pro-gated, 1.1.0 save migrates)
- No engine file touched; the determinism pin is untouched
- Flag-off frames: 4/10 byte-identical, 6/10 animation-only or sub-threshold noise, no layout difference

**Rulings made during execution:**

1. Task 0 (baseline capture) ran in the controller session, not a subagent - it produces no diff or commit.
2. ash is unavailable on this Windows host, so the workflow's helper scripts were replicated in PowerShell.
3. The harness exposes no per-subagent model selection; every dispatch used the general subagent, and each brief carried complete code.
4. Commits are local to eat/ui2-wave-0 only - no push, no PR, no merge.
5. **Plan defect:** Task 6's hooks were specified *after* App.tsx's onboarding early return, a Rules-of-Hooks violation that would crash every new player. The implementer moved them above the return; ruled correct; the plan was amended and Task 7 gained a first-run guard.
6. **Final review finding 1:** the rail overlapped content at tablet/wide (breakpoint 700 was too low and no gutter was reserved). Fixed: tablet breakpoint to 800, --shell-max plus a reserved gutter, rail clamped to the shell.
7. **Final review finding 2:** the golden baseline was captured after the owner-approved quick wins, so "flag off = unchanged" is relative to that baseline. Ruled intentional and owner-approved; the spec wording was corrected and nothing was reverted.
8. **Final review finding 3:** Wave 1's acceptance gate had no committed tool. Fixed: scripts/shots-pixel-diff.mjs, shots:pixel, erify:ui2, and the wording corrected to byte-identical for DOM frames with an animation tolerance for 3D.

**Deferred minors to carry into Wave 1:**

- Stale references: this plan's Task 2/3/5 text still says 700 and --content-max-tablet, and the spec's 700-1100 table, all now contradicted by the code (800).
- This plan's embedded erify-onboarding-ui2.mjs snippet still shows /hook/i; the live script uses the broader regex.
- src/App.tsx comment still says "pixel-identical".
- This plan's exit criteria says 1,947 tests; the actual count is 1,948.
- useLayoutMode's effect dereferences window unguarded while its initializer guards it.
- RailNav's press transform is not in its transition; glyph 20px / --fs-caption versus BottomNav's 21px / --fs-nano.
- useUiVersion's subscribe cleanup returns a boolean from listeners.delete (matches settings.ts).
- scripts/shots-pixel-diff.mjs iterates baseline frames only and would pass on an empty baseline directory.
- Duplicate ria-label="Primary" landmark while both navs render (flag on, tablet); Wave 1 hides one.
- --rail-w-compact, --content-max, --content-max-wide, .app--next, setUiVersion/getUiVersion/uiNextEnabled have no consumer yet; Wave 1 wires them, and #root should consume --content-max.

**Wave 1 entry points:** the chrome swap (AppShell, top bar, page stack/router), then the PageHeader and StatTile primitives, then the screens. See the ordering note above.
