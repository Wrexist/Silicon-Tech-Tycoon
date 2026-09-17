# UI Redesign — Wave 1a (Chrome swap) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Silicon 2.0 shell coherent — the side rail *replaces* the bottom nav on wide screens, and the page title moves into shared chrome — without touching a single pixel of the shipped game.

**Architecture:** Wave 0 added the rail additively (both navs render). Wave 1a makes the two presentations exclusive and introduces the `PageHeader` primitive so the title can live in the shell instead of inside every screen. All of it stays behind the `silicon.ui2` flag; with the flag off nothing changes.

**Tech Stack:** TypeScript · React 19 · Vite · Vitest (Node env, no DOM/Testing-Library) · plain CSS with design tokens · the Playwright screenshot harness.

**Spec:** `docs/superpowers/specs/2026-09-16-premium-ui-redesign-design.md`
**Predecessor:** `docs/superpowers/plans/2026-09-16-ui-redesign-wave-0-foundation.md` (see its "Wave 0 outcome" for the deferred minors this wave inherits).

## Global Constraints

- **Principle 0:** with the flag off, the build must be unchanged. Every selector added here is scoped under `.app--next`.
- **No engine changes.** Determinism pin untouched.
- **Design tokens only** — no hardcoded colours, spacing or radii. `.app--next` is the only new gate class.
- **Repo conventions:** explicit import extensions, 8pt spacing scale, Lucide icons only, `--fs-*` type tokens.
- Tests run in the Node environment (no jsdom); UI is verified by the screenshot harness plus source-invariant tests. No new dependencies.
- Gate: `tsc` 0 errors · full suite green · `npm run build` · `npm run verify:ui2` PASS · flag-off frames unchanged · flag-on frames show one nav and one title.

---

### Task 1: The rail replaces the bottom nav on wide

**Files:**
- Modify: `src/App.css` (append to the existing `@media (min-width: 800px)` block added in the Wave 0 fix)

**Interfaces:**
- Consumes: `.app--next` and `.bnav` (both already exist).
- Produces: nothing other tasks rely on.

- [x] **Step 1: Apply the rule**

Inside the existing `@media (min-width: 800px)` block in `src/App.css`, add:

```css
  /* Wave 1a: on wide screens the side rail IS the navigation — the bottom tab bar stands down so
     there is exactly one primary nav. Scoped to .app--next: the shipped game keeps its tab bar. */
  .app--next .bnav { display: none; }
```

- [x] **Step 2: Verify the build and the guards**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npx vitest run src/design/tokenRefs.test.ts`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "feat(ui2): the side rail replaces the bottom nav on wide screens"
```

---

### Task 2: The `PageHeader` primitive

**Files:**
- Modify: `src/design/primitives.tsx` (add the component beside the other primitives)
- Modify: `src/design/primitives.css` (append the block)

**Interfaces:**
- Consumes: `type ReactNode` (already imported) and `ChevronLeft`, which must be added to the existing lucide import — the file currently imports only `Sparkles`:
  ```ts
  import { ChevronLeft, Sparkles } from "lucide-react";
  ```
- Produces: `PageHeader({ title, subtitle?, onBack?, actions? })` — consumed by `App.tsx` in Task 3, and by every migrated screen in Wave 1b.

- [x] **Step 1: Add the component**

Append to `src/design/primitives.tsx`:

```tsx
/** The shared page header for the Silicon 2.0 shell: an optional back chevron, the page title, an
 *  optional subtitle and a right-hand action slot. Screens stop drawing their own `.app__title`
 *  when the new shell is on, so there is exactly one, correctly-positioned title per page. */
export function PageHeader({
  title,
  subtitle,
  onBack,
  actions,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
}) {
  return (
    <header className="pghead">
      {onBack && (
        <button type="button" className="pghead__back" onClick={onBack} aria-label="Back">
          <ChevronLeft size={20} aria-hidden />
        </button>
      )}
      <div className="pghead__text">
        <h1 className="pghead__title">{title}</h1>
        {subtitle ? <p className="pghead__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="pghead__actions">{actions}</div> : null}
    </header>
  );
}
```

- [x] **Step 2: Add the stylesheet block**

Append to `src/design/primitives.css`:

```css
/* Page header — the shell's title row. Deliberately mirrors the type scale the per-screen
   `.app__title` used, so migrating a screen does not resize its heading. */
.pghead {
  display: flex;
  align-items: center;
  gap: var(--sp-8);
  margin: var(--sp-4) 0 var(--sp-12);
}
.pghead__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-left: calc(var(--sp-8) * -1);
  border-radius: var(--r-pill);
  color: var(--ink-2);
  transition: background var(--spring-snappy), color var(--spring-snappy);
}
.pghead__back:active {
  background: var(--surface-2);
}
.pghead__text {
  min-width: 0;
  flex: 1;
}
.pghead__title {
  font-size: var(--fs-title);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.15;
}
.pghead__subtitle {
  margin-top: var(--sp-4);
  font-size: var(--fs-caption);
  color: var(--ink-2);
}
.pghead__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-8);
  flex-shrink: 0;
}
```

- [x] **Step 3: Verify**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npx vitest run src/design/tokenRefs.test.ts`
Expected: PASS (every `var(--x)` above resolves).

Run: `npm run build`
Expected: green.

- [x] **Step 4: Commit**

```bash
git add src/design/primitives.tsx src/design/primitives.css
git commit -m "feat(ui2): add the PageHeader primitive"
```

---

### Task 3: The shell renders the page title

**Files:**
- Modify: `src/App.tsx` (import; the render tree; the `showRail` area)
- Modify: `src/App.css` (suppress the in-screen title when the flag is on)

**Interfaces:**
- Consumes: `PageHeader` from Task 2; `TAB_TITLE` (already defined in `App.tsx`) and `state.companyName` (already in scope).
- Produces: nothing later tasks rely on.

The HQ tab's title is the *company name*, not the tab label — read it exactly as the HQ screen does: `state.companyName || TAB_TITLE.hq`.

- [x] **Step 1: Import the primitive**

Add to the existing `./design/primitives.tsx` import in `src/App.tsx`:

```ts
import { Button, Card, PageHeader } from "./design/primitives.tsx";
```

- [x] **Step 2: Render the header in the new shell**

In `src/App.tsx`, immediately after the `{showRail && (…)}` block and before `<main className="app__main">`, add:

```tsx
      {/* Wave 1a: the new shell owns the page title. When the flag is off this renders nothing and
          each screen keeps drawing its own .app__title exactly as before. */}
      {uiVersion === "next" && (
        <PageHeader title={tab === "hq" ? state.companyName || TAB_TITLE.hq : TAB_TITLE[tab]} />
      )}
```

- [x] **Step 3: Suppress the in-screen title when the flag is on**

Append to `src/App.css` (outside any media query — the title moves into the shell at every width):

```css
/* Wave 1a: the shell renders the page title when the new UI is on, so the per-screen heading
   stands down. Flag-off is untouched: `.app--next` never matches. */
.app--next .app__title { display: none; }
```

- [x] **Step 4: Verify**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npm test`
Expected: 1,948 tests across 179 files — this task adds no tests and must not change the count.

Run: `npm run build`
Expected: green.

- [x] **Step 5: Verify visually, both flags**

Run:

```bash
$env:SHOTS_CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run shots:diff -- wave1a-off
$env:SHOTS_UI2="1"; $env:SHOTS_VIEWPORT="1024x768"; npm run shots:diff -- wave1a-wide
```

Expected and required, read with the Read tool:
- `wave1a-off/01-office-top.png` and `wave1a-off/08-company.png` — visually identical to `.shots/wave0-baseline/` (no title change, tab bar present). This is the flag-off guarantee.
- `wave1a-wide/01-office-top.png` — the rail on the left, **no bottom tab bar**, and exactly one title (the company name). Confirm the title appears once, not twice.
- `wave1a-wide/08-company.png` — one "Company" title, rail present, no tab bar.

If the title appears twice, `.app--next .app__title { display: none }` is not applying — stop and fix before committing.

- [x] **Step 6: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat(ui2): the shell owns the page title and one primary nav"
```

---

### Task 4: Verification and the wave gate

**Files:** none (produces evidence only).

- [x] **Step 1: Claim the flag-on phone layout**

Run:

```bash
$env:SHOTS_CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
$env:SHOTS_UI2="1"; npm run shots:diff -- wave1a-phone
```

Expected: at 390px the bottom tab bar is present, the rail is absent, and there is exactly one title. Read `01-office-top.png`.

- [x] **Step 2: First-run guard**

Run: `npm run verify:ui2`
Expected: `PASS: onboarding completed with the flag on, no hook/console errors, rail rendered.`

- [x] **Step 3: Release audit**

Run: `npm run shots:stage:showcase; npm run audit:screens`
Expected: `CLEAN`, every pass meeting its coverage floor.

- [x] **Step 4: Record the outcome**

Append a short "Wave 1a outcome" section to this plan: status, the commit range, the exact gate output, and any deferred minors. Do not commit the `.shots/` artifacts (gitignored).

---

## Wave 1a exit criteria

- [x] Flag off → visually unchanged from `.shots/wave0-baseline/`.
- [x] Flag on, 390px → bottom tab bar, no rail, exactly one title.
- [x] Flag on, 1024px → rail, **no** tab bar, exactly one title.
- [x] `tsc` 0 · 1,948 tests · build green · `verify:ui2` PASS · `audit:screens` CLEAN.
- [x] No engine file touched.

## Deliberate scope notes

- **The page stack/router is deferred to Wave 1b.** A router with no page to push is speculative; it lands with its first real consumer (the Settings page), exactly as the primitives were deferred in Wave 0.
- **Screens are not migrated here.** They keep their contents and only lose their in-screen title. Office → Dashboard, and the other four, are Wave 1b.
- **The top bar is not yet restructured into the mockup's single row.** That is a `Hud` restructure with real regression risk to the always-visible cash/runway signal; it gets its own task once the shell is proven.

---

## Wave 1a outcome (completed 2026-09-16)

**Status: COMPLETE.** Three batched implementation tasks plus one fix round, each independently reviewed.

**Verification on the final HEAD:**

- npm run typecheck - 0 errors
- npm test - 1,948 passed / 179 files (this wave adds no tests by design)
- npm run build - green
- npm run verify:ui2 - PASS
- npm run audit:screens - CLEAN
- Flag off - .shots/wave1a-off/08-company.png is SHA256 byte-identical to the Wave 0 baseline
- Flag on, 390px - bottom tab bar present, rail absent, exactly one title
- Flag on, 1024px - rail present, no tab bar, exactly one title
- No engine file touched

**Fix round 1:** the task review found the new shell title sat ~20px left of the content column (.ds-pghead had no horizontal inset while .app__main uses var(--edge)). Fixed with padding-inline: var(--edge); re-measured at ~1 CSS px. Scoped re-review: addressed, no new breakage.

**Deferred minors (carry into Wave 1b):**

- .ds-pghead* selectors are not scoped under .app--next. No flag-off element can carry the class, so there is no leakage, but this is a letter-of-the-constraint variance from the brief.
- PageHeader's subtitle/onBack/actions are unreachable from the current shell wiring. Wave 1b must decide whether the shell extends per-tab or screens compose their own header.
- The HQ world-tabs row (.app__titlerow) now left-aligns, because its sibling .app__title is hidden and the row uses space-between.
- The back-button optic (margin-left: calc(var(--sp-8) * -1)) now pulls the chevron 8px inside the column edge rather than outside; inert until Wave 1b passes onBack.
- A future screen nesting PageHeader inside an already-inset container would inset twice.
- The phone capture shows "Silicon", which is both TAB_TITLE.hq and the save's company name, so it does not distinguish the state.companyName || ... branch.

**Not done in this wave (by design):** the page stack/router and the top-bar restructure (no consumer yet), and every screen migration. Those are Wave 1b.

**Fix wave 2 (from the final review, commit 15d37c4):**

- **Important:** useLayoutMode read window.innerWidth (includes the desktop scrollbar) while the CSS media queries exclude it, so in a scrollbar-wide band the rail could mount while the tab bar was still visible and the gutter inactive. The hook now derives the mode from the same matchMedia queries the CSS uses; layoutModeForWidth and its tests remain the pure contract.
- **Important:** the primitive's classes were renamed from pghead* to ds-pghead*, matching every other primitive in the file.
- **Minor:** PageHeader gained an optional 	int, and the shell passes TAB_TINT[tab], restoring the per-tab accent the classic title had.
- **Minor:** erify:ui2 now asserts exactly one visible page title and exactly one visible primary nav, so Wave 1b has a regression net beyond screenshots.
- **Minor:** the mangled escape artifacts in this document were repaired and the completed checkboxes ticked.

This plan's Task 2 code snippets still show the old .pghead* names (doc-only, superseded by the rename).
