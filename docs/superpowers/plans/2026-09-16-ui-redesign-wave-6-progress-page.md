# UI Redesign — Wave 6 (The Progress hub becomes a page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dissolve the Progress sheet. The hub becomes a routed page the HUD trophy pushes, its rows navigate as pages where a page already exists, and the remaining views render inside the page instead of a bottom sheet.

**Architecture:** The hub is currently one `Sheet` (App mounts `ProgressSheet` inside a single `<Sheet>`) whose rows swap its inner content. Waves 2b/2c already turned Platform, Museum and Goals into routed pages, so the hub is now the last sheet that is really a navigation surface. This wave promotes it to a page, makes the rows that have pages *push* them, keeps the rows that do not as in-page views, and retires the sheet on the flag-on path. **The classic path keeps the sheet entirely.**

**Tech Stack:** TypeScript · React 19 · Vite · Vitest (Node env, no DOM) · design tokens.

**Spec:** `docs/superpowers/specs/2026-09-16-premium-ui-redesign-design.md` (§5, §8.2)
**Predecessors:** Wave 2a (routing), 2b/2c (the sheet→panel precedent and `WIRED_PAGES`), Wave 4 (the flag-gating rule).

## Global Constraints

- **Principle 0, with Wave 4's ruling:** the flag gates screen content. With `silicon.ui2` off, the Progress **sheet** opens exactly as it does today.
- **No engine changes.** This is navigation and presentation only; the determinism pin must stay green.
- **Nothing dropped.** Every hub row must remain reachable on the flag-on path, and every view it opens must render the same content as the sheet does today.
- **No new dependencies;** explicit import extensions; design tokens only; Lucide icons only.
- **`PAGE_IDS` is canonical.** Adding a page means adding it there, to `WIRED_PAGES`, to `PAGE_TITLES`, and to the every-declared-page test's coverage - the test exists to catch exactly this.
- Gate: `tsc` 0 · suite green · `npm run build` · `verify:ui2` PASS · `verify:deeplink` PASS · `audit:screens` CLEAN · pin green.

---

### Task 1: `progress` becomes a page

**Files:**
- Modify: `src/state/pageStack.ts` (`PAGE_IDS`, `WIRED_PAGES`, `PAGE_TITLES`)
- Modify: `src/state/pageStack.test.ts`
- Modify: `src/App.tsx` (the HUD trophy's handler; a page render block)
- Modify: `src/screens/Progress.tsx`

**Interfaces:**
- Consumes: the page-stack pattern from Waves 1b/2a.
- Produces: `ProgressPanel({ onOpen, initialView })` — the hub's content without sheet chrome.

- [ ] **Step 1: Add the page to the model**

```ts
export const PAGE_IDS = ["settings", "platform", "museum", "goals", "progress"] as const;
```

Add `"progress"` to `WIRED_PAGES` and `PAGE_TITLES` (`progress: "Progress"`). The every-declared-page test derives from `PAGE_IDS`, so it covers the new entry automatically - confirm it does.

- [ ] **Step 2: Split the sheet like Platform was split**

In `src/screens/Progress.tsx`, move the sheet's body into an exported `ProgressPanel`, leaving `ProgressSheet` as chrome around it - the same one-body/two-chromes move Wave 2b used for Platform. Keep the internal `view` state and every row exactly as they are.

- [ ] **Step 3: Route it**

In `src/App.tsx`, the HUD trophy currently calls `openProgress()`, which opens the sheet. When `uiVersion === "next"` it must `push("progress")` instead, and the sheet must not open. Add a `page === "progress"` render block in the same shape as the others (`ErrorBoundary` → `Suspense` → `ProgressPanel`).

The `initialView` prop exists because HQ's daily-challenge card deep-links to `challenges`. Preserve that: pushing the page should carry the view as a **param** (`push("progress", { section: "challenges" })`) rather than a separate state hook, since Wave 2a established that section-like state belongs in the URL.

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck` → exit 0
Run: `npm test` → green (the page-model tests may shift; report the count)
Run: `npm run build` → green
Run: `npm run verify:ui2` → PASS
Run: `npx vitest run src/state/activeRun.determinism.test.ts` → PASS

```bash
git add src/state/pageStack.ts src/state/pageStack.test.ts src/screens/Progress.tsx src/App.tsx
git commit -m "feat(ui2): the Progress hub becomes a routed page"
```

---

### Task 2: Rows that have pages push them

**Files:**
- Modify: `src/screens/Progress.tsx`

**Interfaces:**
- Consumes: the existing `goals` and `museum` pages.
- Produces: nothing new.

- [ ] **Step 1: Route the two existing rows**

The **Goals** and **Device Museum** rows currently set the hub's internal `view`. When the flag is on they must `push("goals")` / `push("museum")` instead, so the hub is a real index rather than a nested viewer. With the flag off they keep switching the internal view.

Thread the router's `push` in the same way Wave 2c threaded it into `Company` (`onOpenPlatform`). Choose the smaller of that prop or a registered seam, and say which you chose.

- [ ] **Step 2: The remaining rows stay in-page**

Vault, Mastery, Founder Legend, Achievements, Scenarios, Challenges, Roadmap and Help keep rendering inside the hub page for now. **This is deliberate** - each is a candidate for its own page in a later wave, one at a time, and converting eight at once is how a dropped view happens. Do not convert them here and do not remove any.

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck` → exit 0
Run: `npm test` → green
Run: `npm run build` → green
Capture and **read** a frame at 1024×768 with the flag on, with the Progress page open, and confirm the rows render and the Goals row is a link (not an in-page swap). Report what you saw.

```bash
git add src/screens/Progress.tsx
git commit -m "feat(ui2): the hub's Goals and Museum rows open their pages"
```

---

### Task 3: Retire the sheet on the flag-on path

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Make the sheet classic-only**

The `<Sheet open={progressOpen} …>` wrapper must open only when `uiVersion === "classic"`. On the flag-on path the page is the only surface. Confirm by code inspection that `progressOpen` is never set true when the flag is on - the trophy handler is the only writer.

- [ ] **Step 2: Verify the classic path is untouched**

Run `npm run shots:diff -- wave6-off` with the flag off and read `10-progress.png`: it must show the **sheet**, exactly as the baseline does.

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck` → exit 0
Run: `npm test` → green
Run: `npm run build` → green

```bash
git add src/App.tsx
git commit -m "feat(ui2): the Progress sheet is classic-only"
```

---

### Task 4: Verification

**Files:** none (evidence only).

- [ ] **Step 1: Every route, including the new one**

Extend the route table in `scripts/verify-deeplink-ui2.mjs` with the Progress page (`#/company/progress`, rail highlight Company, title Progress) and the deep-linked view (`#/company/progress?section=challenges` if that is how the param encodes - match whatever Task 1 chose). Run `npm run build` then `npm run verify:deeplink` and confirm it names every route and exits 0.

- [ ] **Step 2: Row coverage**

List every hub row and, for each, how it is reachable on the flag-on path (a pushed page, or an in-page view). **A row with no answer is a dropped feature.** Put the table in the outcome.

- [ ] **Step 3: The full gate**

Run: `npm run typecheck` → exit 0 · `npm test` → green · `npx vitest run src/state/activeRun.determinism.test.ts` → PASS · `npm run build` → green · `npm run verify:ui2` → PASS · `npm run verify:deeplink` → PASS · `npm run shots:stage:showcase; npm run audit:screens` → CLEAN

- [ ] **Step 4: Record the outcome**

Append a "Wave 6 outcome" section: status, commit range, gate output, the row-coverage table, deferred minors.

---

## Wave 6 exit criteria

- [ ] Flag off → the Progress **sheet** opens exactly as today; `10-progress.png` matches the baseline.
- [ ] Flag on → the trophy pushes a Progress **page**; Goals and Museum rows push their pages; the other eight rows render in-page.
- [ ] HQ's daily-challenge deep-link still lands on the Challenges view.
- [ ] Every hub row is reachable and every view renders the same content as before.
- [ ] No engine file touched; determinism pin green.
- [ ] `tsc` 0 · suite green · build green · `verify:ui2` PASS · `verify:deeplink` PASS · `audit:screens` CLEAN.

## Deliberate scope notes

- **Eight views stay in-page.** Converting them one per wave is the point: a single dropped view is a silent feature loss, and this session's consistent failure mode has been the plan, not the implementer.
- **The hub does not gain a section rail.** It is an index; a rail would duplicate Platform's pattern for no benefit. Revisit only if the row list grows.
- **No visual redesign of the rows here.** They keep their current markup; this wave is navigation only.
