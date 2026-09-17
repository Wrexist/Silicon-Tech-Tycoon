# UI Redesign — Wave 2c (Museum + Goals pages, Platform entry) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the Device Museum and the Goals Ledger from Progress-hub sub-views to routed pages, and give the Platform page a real in-app entry point — finishing the navigation story the mockup's sub-apps need.

**Architecture:** Wave 2b established the pattern with `PlatformSheet` → `PlatformPanel` + a routed page block. This wave applies that same pattern to `MuseumSheet` and `GoalsLedgerSheet`, widens `WIRED_PAGES`, wires the Company tab's Platform button to push the page, and machine-asserts every route. **No simulation changes** — all three surfaces already render real state.

**Tech Stack:** TypeScript · React 19 · Vite · Vitest (Node env, no DOM) · plain CSS with tokens.

**Spec:** `docs/superpowers/specs/2026-09-16-premium-ui-redesign-design.md` (§8.2)
**Precedents to copy verbatim in shape:**
- `docs/superpowers/plans/2026-09-16-ui-redesign-wave-2b-platform.md` — the sheet→panel→page pattern.
- `src/screens/Platform.tsx` — how the panel was split so the classic sheet delegates and the two can never drift.
- `scripts/verify-deeplink-ui2.mjs` — the route assertion pattern.

## Global Constraints

- **Principle 0:** with `silicon.ui2` off, the build is unchanged — the Progress hub still opens Museum and Goals as sub-views, and the Company Platform sub-tab still opens the sheet.
- **No engine changes.** Determinism pin untouched.
- No new dependencies; explicit import extensions; design tokens only; Lucide icons only.
- Node test environment; no jsdom. Pure logic is unit-tested; UI is verified by `verify:ui2`, `verify:deeplink` and the release audit.
- **After any edit to `package.json`, re-run `npm run build`** — a BOM shipped in Wave 2a broke the build and was missed.
- Gate: `tsc` 0 · suite green · `npm run build` · `verify:ui2` PASS · `verify:deeplink` PASS · `audit:screens` CLEAN · flag-off frames unchanged.

---

### Task 1: Museum becomes a routed page

**Files:**
- Modify: `src/screens/Museum.tsx`
- Modify: `src/state/pageStack.ts` (`WIRED_PAGES`)
- Modify: `src/state/pageStack.test.ts` (the "no screen yet" case)
- Modify: `src/App.tsx` (the page render block)

**Interfaces:**
- Consumes: the Wave 2b pattern; `PageId` already includes `"museum"`; `PAGE_TITLES.museum` already exists.
- Produces: `MuseumPanel()` — the sheet's body without sheet chrome. Consumed by Task 3's verification.

- [ ] **Step 1: Split the sheet exactly as Platform did**

In `src/screens/Museum.tsx`, move the existing body of `MuseumSheet` into a new exported `MuseumPanel` (no props — the Museum has no sections yet), and reduce `MuseumSheet` to sheet chrome around `<MuseumPanel />`. The category filter already lives in the body; leave its behaviour untouched.

Name the new export exactly `MuseumPanel`. Keep every computation, className and string as they are — this is a move, not a rewrite. There must be no duplicated markup between the two paths.

- [ ] **Step 2: Wire the route**

In `src/state/pageStack.ts`:

```ts
export const WIRED_PAGES: readonly PageId[] = ["settings", "platform", "museum"];
```

In `src/state/pageStack.test.ts`, the "refuses a page that exists in the model but has no screen yet" test currently asserts `#/platform` and `#/museum` resolve to null. Move both into the wired set's coverage: keep only `#/goals` as the unwired example (Goals is Task 2 — update this line again there), and keep the round-trip test driven from `WIRED_PAGES`.

In `src/App.tsx`, beside the `page === "platform"` block:

```tsx
        {page === "museum" && (
          <ErrorBoundary fallback={<ScreenError onHome={pop} />}>
            <Suspense fallback={<ScreenLoading title={PAGE_TITLES.museum} />}>
              <MuseumPanel />
            </Suspense>
          </ErrorBoundary>
        )}
```

Import `MuseumPanel` from `./screens/Museum.tsx` (keep it lazy if `Museum.tsx` is already lazily loaded; if it is currently imported eagerly by Progress, add a `lazy()` import for the page rather than making the hub chunk eager).

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck` → exit 0
Run: `npm test` → **1,981 unchanged** (moving `#/museum` out of the unwired-page test adds and removes nothing)
Run: `npm run build` → green

```bash
git add src/screens/Museum.tsx src/state/pageStack.ts src/state/pageStack.test.ts src/App.tsx
git commit -m "feat(ui2): the Device Museum becomes a routed page"
```

---

### Task 2: Goals becomes a routed page

**Files:**
- Modify: `src/screens/GoalsLedger.tsx`
- Modify: `src/state/pageStack.ts` (`WIRED_PAGES` → add `"goals"`)
- Modify: `src/state/pageStack.test.ts` (now EVERY declared page is wired — delete the "no screen yet" test and say so in the report rather than leaving a vacuous one)
- Modify: `src/App.tsx` (the page render block)

**Interfaces:**
- Consumes: `PAGE_TITLES.goals` (exists); `GoalsLedgerSheet` (exists).
- Produces: `GoalsPanel()`.

- [ ] **Step 1: Split the sheet**

Apply the same move as Task 1: `GoalsLedgerSheet`'s body becomes an exported `GoalsPanel`, and the sheet becomes chrome around it. No duplicated markup.

- [ ] **Step 2: Wire the route**

```ts
export const WIRED_PAGES: readonly PageId[] = ["settings", "platform", "museum", "goals"];
```

Add the `page === "goals"` block to `src/App.tsx` in the same shape as the others (`PAGE_TITLES.goals`, `GoalsPanel`).

Because every declared `PageId` is now wired, the "refuses a page that exists in the model but has no screen yet" test has nothing left to assert. **Delete it** and add, in its place, a test that the wired set covers every declared page:

```ts
  it("wires every declared page — a PageId with no screen would blank the main area", () => {
    const declared: PageId[] = ["settings", "platform", "museum", "goals"];
    expect([...WIRED_PAGES].sort()).toEqual([...declared].sort());
  });
```

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck` → exit 0
Run: `npm test` → **1,981 unchanged** (one test is deleted and replaced by one)
Run: `npm run build` → green

```bash
git add src/screens/GoalsLedger.tsx src/state/pageStack.ts src/state/pageStack.test.ts src/App.tsx
git commit -m "feat(ui2): the Goals Ledger becomes a routed page"
```

---

### Task 3: The Platform entry point, and every route asserted

**Files:**
- Modify: `src/screens/Company.tsx` (the Platform sub-tab's action)
- Modify: `src/App.tsx` (pass the push down, if the sub-tab lives outside `AppShell`)
- Modify: `scripts/verify-deeplink-ui2.mjs`

**Interfaces:**
- Consumes: `push` from `usePageNav` (already in `AppShell`); `Company`'s existing `platformProLocked` / `foundPlatform` flow.
- Produces: a machine-asserted route table.

- [ ] **Step 1: Find the entry point**

`Company.tsx` renders the Platform sub-tab (`coTab === "platform"`) which currently opens `PlatformSheet`. Read how that sheet is opened today (a local `useState` in `Company`), then thread the router's `push` from `AppShell` into `Company` and have the sub-tab's primary action call `push("platform")` **when the flag is on**, falling back to the existing sheet when it is off.

If threading `push` through `Company`'s props is invasive, an acceptable alternative is a module-level navigation seam: `export function openPlatformPage()` in `src/state/pageNav.ts` that `AppShell` registers its `push` with on mount, and `Company` calls. Choose whichever is smaller, and say which you chose.

The rule that matters: **with the flag off, the sheet must open exactly as today.**

- [ ] **Step 2: Assert every route**

Extend `scripts/verify-deeplink-ui2.mjs` so it checks a TABLE of routes rather than one hardcoded case. For each entry it should boot that URL and assert the rail highlight, the shell title, and the presence of a back chevron:

| URL | rail highlight | title |
|---|---|---|
| `#/market/settings` | Market | Settings |
| `#/company/platform/licensing` | Company | Platform |
| `#/company/museum` | Company | Device Museum |
| `#/hq/goals` | Office | Goals |

Keep the existing single-route behaviour working if the table is empty (i.e. default to the current Market/Settings case), and print a PASS line naming every route checked. A route that fails must exit 1.

- [ ] **Step 3: Verify and commit**

Run: `npm run build` then `npm run verify:deeplink` → PASS, naming all four routes
Run: `npm run typecheck` → exit 0
Run: `npm test` → green

```bash
git add src/screens/Company.tsx src/App.tsx scripts/verify-deeplink-ui2.mjs
git commit -m "feat(ui2): open Platform from the Company tab and assert every route"
```

---

### Task 4: Verification

**Files:** none (evidence only).

- [ ] **Step 1: Flag-off parity**

```bash
$env:SHOTS_CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
Remove-Item Env:\SHOTS_UI2, Env:\SHOTS_URL, Env:\SHOTS_VIEWPORT -ErrorAction SilentlyContinue
npm run shots:diff -- wave2c-off
```

Expected: the Progress hub still opens Museum and Goals as sub-views; the Company Platform sub-tab still opens the sheet.

- [ ] **Step 2: Full gate**

Run: `npm run verify:ui2` → PASS
Run: `npm run verify:deeplink` → PASS, four routes named
Run: `npm run shots:stage:showcase; npm run audit:screens` → CLEAN

- [ ] **Step 3: Record the outcome**

Append a "Wave 2c outcome" section to this plan: status, commit range, exact gate output, deferred minors.

---

## Wave 2c exit criteria

- [ ] Flag off → Museum/Goals still open from the Progress hub; Platform still sheets from Company.
- [ ] Flag on → `#/company/museum`, `#/hq/goals` and `#/company/platform/licensing` all open their page with the right rail highlight, one title, one back chevron — asserted by `npm run verify:deeplink`.
- [ ] The Company Platform sub-tab opens the Platform **page** with the flag on and the **sheet** with it off.
- [ ] No block added, removed or reworded on any of the three surfaces.
- [ ] `tsc` 0 · suite green · build green · `verify:ui2` PASS · `verify:deeplink` PASS · `audit:screens` CLEAN.
- [ ] No engine file touched.

## Deliberate scope notes

- **The Progress hub is NOT dissolved.** Its rows still exist and still open their sub-views when the flag is off. Deciding how the hub retires (rows become links to pages, or the hub becomes a page) is its own wave — it touches `Progress.tsx`, `App.tsx` and every row, and it should not be smuggled into this one.
- **No sections on Museum or Goals.** The mockup shows category chips on the Museum, which already exist in its body; the six-section rail pattern stays Platform's until a surface needs it.
- **The Company sub-tab layout is untouched**; only its Platform action changes, and only behind the flag.
