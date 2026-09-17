# UI Redesign — Wave 2b (Platform sub-app + section rail) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Realise the mockup's first sub-app: promote the Platform division from a sheet inside the Company tab to a routed **page** whose six sections are navigated by a **section rail** (a vertical rail on wide screens, a horizontal strip on phones).

**Architecture:** Wave 2a gave the router `{ root, page, params }`. This wave uses `params.section` to select a section, adds the `SectionRail` primitive, widens `WIRED_PAGES` to include `platform`, and converts `PlatformSheet` into an in-page panel (`PlatformPanel`) whose existing `SectionHeader` blocks become the rail's six sections. **No simulation changes** — every number already exists; this is re-presentation plus navigation.

**Tech Stack:** TypeScript · React 19 · Vite · Vitest (Node env, no DOM) · plain CSS with tokens.

**Spec:** `docs/superpowers/specs/2026-09-16-premium-ui-redesign-design.md` (§6 pattern library, §8.2 Platform)
**Predecessor:** `docs/superpowers/plans/2026-09-16-ui-redesign-wave-2a-routing.md` — its "Decisions this wave makes" settles that the **shell owns the header** and a page renders its own rail in the body; and its outcome lists the minors this wave inherits.

## Global Constraints

- **Principle 0:** with `silicon.ui2` off, the build is unchanged. The Company tab's Platform sub-tab keeps rendering the existing `PlatformSheet` exactly as today.
- **No engine changes.** Determinism pin untouched. Every figure on the page already exists in state.
- **Pure logic is unit-tested; UI is verified by `npm run verify:ui2` + `npm run verify:deeplink` + the release audit.** No jsdom, no Testing-Library, no new dependencies.
- Design tokens only; explicit import extensions; Lucide icons only; 8pt spacing.
- Gate: `tsc` 0 · suite green · `npm run build` · `verify:ui2` PASS · `verify:deeplink` PASS · `audit:screens` CLEAN · flag-off frames unchanged.

---

### Task 1: Which section is showing — a pure resolver

**Files:**
- Create: `src/state/platformSections.ts`
- Test: `src/state/platformSections.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type PlatformSection = "overview" | "services" | "ecosystem" | "licensing" | "developers" | "distribution"`; `PLATFORM_SECTIONS: readonly PlatformSection[]`; `SECTION_LABELS: Record<PlatformSection, string>`; `resolvePlatformSection(raw: string | undefined): PlatformSection`. Consumed by Tasks 2–3.

- [ ] **Step 1: Write the failing test**

Create `src/state/platformSections.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PLATFORM_SECTIONS, resolvePlatformSection, SECTION_LABELS } from "./platformSections.ts";

// The rail's contract: a section in the URL is honoured, anything else falls back to the first
// section rather than rendering a blank panel. Pure, so it is testable without a DOM.
describe("resolvePlatformSection", () => {
  it("returns the first section when nothing is named", () => {
    expect(resolvePlatformSection(undefined)).toBe("overview");
    expect(resolvePlatformSection("")).toBe("overview");
  });

  it("honours every declared section", () => {
    for (const s of PLATFORM_SECTIONS) expect(resolvePlatformSection(s)).toBe(s);
  });

  it("falls back rather than blanking on an unknown section", () => {
    expect(resolvePlatformSection("nonsense")).toBe("overview");
    expect(resolvePlatformSection("../etc")).toBe("overview");
  });

  it("ignores case", () => {
    expect(resolvePlatformSection("Licensing")).toBe("licensing");
  });

  it("has a label for every section and no duplicates", () => {
    for (const s of PLATFORM_SECTIONS) expect(SECTION_LABELS[s]).toBeTruthy();
    expect(new Set(PLATFORM_SECTIONS).size).toBe(PLATFORM_SECTIONS.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/state/platformSections.test.ts`
Expected: FAIL — cannot resolve `./platformSections.ts`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/state/platformSections.ts`:

```ts
// The Platform sub-app's six sections. A section travels in the route's `params.section` (so it is
// linkable and survives a reload), and this module is the single place that decides what a given
// param value means — an unknown value must never render an empty panel.

export type PlatformSection = "overview" | "services" | "ecosystem" | "licensing" | "developers" | "distribution";

/** Rail order. `overview` is first because it is the fallback the resolver returns. */
export const PLATFORM_SECTIONS: readonly PlatformSection[] = [
  "overview",
  "services",
  "ecosystem",
  "licensing",
  "developers",
  "distribution",
];

export const SECTION_LABELS: Record<PlatformSection, string> = {
  overview: "Overview",
  services: "Services",
  ecosystem: "Ecosystem",
  licensing: "Licensing",
  developers: "Developers",
  distribution: "Distribution",
};

export function resolvePlatformSection(raw: string | undefined): PlatformSection {
  const v = (raw ?? "").trim().toLowerCase();
  return (PLATFORM_SECTIONS as readonly string[]).includes(v) ? (v as PlatformSection) : PLATFORM_SECTIONS[0];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/state/platformSections.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/platformSections.ts src/state/platformSections.test.ts
git commit -m "feat(ui2): resolve the Platform sub-app's sections"
```

---

### Task 2: The `SectionRail` primitive

**Files:**
- Modify: `src/design/primitives.tsx` (add the component)
- Modify: `src/design/primitives.css` (append the block)

**Interfaces:**
- Consumes: `type ReactNode` (already imported).
- Produces: `SectionRail({ items, active, onChange, ariaLabel })` where `items: readonly { id: string; label: string; icon?: ReactNode }[]`. Consumed by Task 3.

- [ ] **Step 1: Add the component**

Append to `src/design/primitives.tsx`:

```tsx
/** Sub-navigation INSIDE a page. Below 800px it is a horizontally scrollable strip; at 800px and up
 *  it is a vertical rail beside the content. The shell owns the page HEADER, so a page that needs
 *  sections renders this in its body — one title, one back affordance, no double-title bugs. */
export function SectionRail({
  items,
  active,
  onChange,
  ariaLabel,
}: {
  items: readonly { id: string; label: string; icon?: ReactNode }[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <nav className={`ds-rail`} aria-label={ariaLabel}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={`ds-rail__item${it.id === active ? " ds-rail__item--active" : ""}`}
          aria-current={it.id === active ? "true" : undefined}
          onClick={() => onChange(it.id)}
        >
          {it.icon ? <span className="ds-rail__glyph" aria-hidden>{it.icon}</span> : null}
          <span className="ds-rail__label">{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Add the stylesheet**

Append to `src/design/primitives.css`:

```css
/* Section rail — a page's own sub-navigation. Phone: a horizontal strip that scrolls. Wide
   (>= 800px, the same breakpoint the shell uses): a vertical rail beside the section body. */
.ds-rail {
  display: flex;
  gap: var(--sp-4);
  overflow-x: auto;
  margin-bottom: var(--sp-16);
  padding-bottom: var(--sp-4);
  scrollbar-width: none;
}
.ds-rail::-webkit-scrollbar { display: none; }
.ds-rail__item {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-8);
  flex: 0 0 auto;
  min-height: 44px;
  padding: 0 var(--sp-16);
  border-radius: var(--r-pill);
  background: var(--surface-2);
  border: 1px solid var(--hairline);
  color: var(--ink-2);
  font-size: var(--fs-caption);
  font-weight: 600;
  white-space: nowrap;
  transition: color var(--spring-snappy), background var(--spring-snappy);
}
.ds-rail__item--active {
  background: var(--accent-soft);
  border-color: transparent;
  color: var(--accent);
}
.ds-rail__glyph { display: inline-flex; }
@media (min-width: 800px) {
  .ds-panel {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    gap: var(--sp-24);
    align-items: start;
  }
  .ds-rail {
    flex-direction: column;
    overflow-x: visible;
    margin-bottom: 0;
    padding-bottom: 0;
    position: sticky;
    top: var(--sp-16);
  }
  .ds-rail__item {
    width: 100%;
    border-radius: var(--r-button);
    justify-content: flex-start;
  }
  .ds-rail__item--active { background: var(--accent-soft); }
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck` → exit 0
Run: `npx vitest run src/design/tokenRefs.test.ts` → PASS (every `var(--x)` resolves)
Run: `npm run build` → green

- [ ] **Step 4: Commit**

```bash
git add src/design/primitives.tsx src/design/primitives.css
git commit -m "feat(ui2): add the SectionRail primitive"
```

---

### Task 3: Platform becomes a routed page with a rail

**Files:**
- Modify: `src/screens/Platform.tsx` (export a `PlatformPanel` alongside the existing sheet)
- Modify: `src/state/pageStack.ts` (`WIRED_PAGES`)
- Modify: `src/App.tsx` (the page render block)

**Interfaces:**
- Consumes: `PLATFORM_SECTIONS`, `SECTION_LABELS`, `resolvePlatformSection` (Task 1); `SectionRail` (Task 2); `params` from `usePageNav`.
- Produces: `PlatformPanel({ section, onSection }: { section: PlatformSection; onSection: (s: string) => void })` and `PAGE_TITLES.platform` already existing.

- [ ] **Step 1: Add `platform` to the router's wired set**

In `src/state/pageStack.ts`:

```ts
export const WIRED_PAGES: readonly PageId[] = ["settings", "platform"];
```

and extend the plan's own test (`src/state/pageStack.test.ts`) so the "refuses a page that has no screen yet" case no longer asserts `#/platform` resolves to null — keep `#/museum` and `#/goals` there, since those still have no render block.

- [ ] **Step 2: Split the sheet into a panel**

In `src/screens/Platform.tsx`, the exported `PlatformSheet` currently renders the sheet chrome (its own `<h2 className="plat__title">Platform</h2>`, close button, scroll container). Add a second export that renders the SAME body without that chrome, and make the sheet delegate to it so there is one implementation.

**Before editing, enumerate the body:** read the whole file and list every top-level block it renders (each `SectionHeader` plus any block that stands alone). Put that list in your report. The grouping below is the contract — every listed block must land in exactly one section, and a block you cannot place goes in **Overview**. Do not add, remove, or reword a block.

```tsx
/** The division's content, without any sheet chrome — used by the routed Platform page (Silicon 2.0)
 *  and by the classic sheet below, so the two can never drift. A `section` narrows the body to one
 *  rail section; omitted, the whole division renders in its original order. */
export function PlatformPanel({
  section,
  onSection,
}: {
  section?: PlatformSection;
  onSection?: (s: string) => void;
}) {
  if (section && onSection) {
    return (
      <div className="ds-panel">
        <SectionRail
          ariaLabel="Platform sections"
          active={section}
          onChange={onSection}
          items={PLATFORM_SECTIONS.map((s) => ({ id: s, label: SECTION_LABELS[s] }))}
        />
        <div className="ds-panel__body">
          {/* The blocks grouped to `section`, in their original relative order. */}
        </div>
      </div>
    );
  }
  return (
    <>
      {/* ALL blocks, in their original relative order — the flag-off path, unchanged. */}
    </>
  );
}
```

Keep `PlatformSheet` as a thin wrapper: sheet chrome around `<PlatformPanel />`, so the classic path is byte-identical in content.

**Section mapping (the contract for grouping the blocks you enumerated):**

| Rail section | Blocks |
|---|---|
| Overview | `OS philosophy`, `OS version` |
| Services | the recurring-income headline block, `OS reach` |
| Ecosystem | `OS features`, `App Store` |
| Licensing | the rival-licensing / licensee-relations block |
| Developers | the apps-published / store-commission detail |
| Distribution | the installed-base reach detail |

- [ ] **Step 3: Render the page**

In `src/App.tsx`, beside the `page === "settings"` block:

```tsx
        {page === "platform" && (
          <ErrorBoundary fallback={<ScreenError onHome={pop} />}>
            <Suspense fallback={<ScreenLoading title={PAGE_TITLES.platform} />}>
              <PlatformPanel
                section={resolvePlatformSection(params.section)}
                onSection={(s) => push("platform", { section: s })}
              />
            </Suspense>
          </ErrorBoundary>
        )}
```

Import `PlatformPanel` from `./screens/Platform.tsx` and `resolvePlatformSection` from `./state/platformSections.ts`. Note `push("platform", { section: s })` on every rail tap: the current frame already has the same id, so the params differ and the stack deepens — that is correct for Back (Back walks the sections you visited), but confirm it does not grow unboundedly during a quick tap-through. If it does, prefer `replace`-style navigation: add an optional third argument to `push` that replaces the top frame when it shares the id. Decide from the observed behaviour and say which you chose in the report.

- [ ] **Step 4: Verify**

Run: `npm run typecheck` → exit 0
Run: `npm test` → 1,971 + 5 (Task 1) = **1,976 tests / 182 files**
Run: `npm run build` → green

- [ ] **Step 5: Commit**

```bash
git add src/screens/Platform.tsx src/state/pageStack.ts src/state/pageStack.test.ts src/App.tsx
git commit -m "feat(ui2): Platform becomes a routed page with a section rail"
```

---

### Task 4: Verification

**Files:** none (evidence only).

- [ ] **Step 1: Flag-off parity**

```bash
$env:SHOTS_CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
Remove-Item Env:\SHOTS_UI2, Env:\SHOTS_URL, Env:\SHOTS_VIEWPORT -ErrorAction SilentlyContinue
npm run shots:diff -- wave2b-off
```

Expected: the Company tab's Platform sub-tab still shows the classic sheet chrome (`09-settings` still the Settings sheet). Compare against `.shots/wave0-baseline/`.

- [ ] **Step 2: The rail and the section route**

```bash
$env:SHOTS_UI2="1"; $env:SHOTS_VIEWPORT="1024x768"
npm run build
$env:SHOTS_URL="http://localhost:5199/#/company/platform/licensing"
npm run shots:diff -- wave2b-licensing
```

Then extend `scripts/verify-deeplink-ui2.mjs` with a second route assertion (or add a sibling script) that boots at `#/company/platform/licensing` and asserts: the rail's active item is "Licensing", the shell title is "Platform", and a back chevron is present. Read the captured frame too and report what you saw.

- [ ] **Step 3: Full gate**

Run: `npm run verify:ui2` → PASS
Run: `npm run verify:deeplink` → PASS
Run: `npm run shots:stage:showcase; npm run audit:screens` → CLEAN

- [ ] **Step 4: Record the outcome**

Append a "Wave 2b outcome" section to this plan: status, commit range, exact gate output, and any deferred minors.

---

## Wave 2b exit criteria

- [ ] Flag off → the Company tab's Platform sub-tab is unchanged; Settings still sheets.
- [ ] Flag on → `#/company/platform/licensing` opens the Platform page with **Licensing** active in the rail, one title, one back chevron.
- [ ] Every block that rendered before still renders, in exactly one section.
- [ ] `tsc` 0 · 1,976 tests · build green · `verify:ui2` PASS · `verify:deeplink` PASS · `audit:screens` CLEAN.
- [ ] No engine file touched.

## Deliberate scope notes

- **No simulation changes.** The division's numbers, gates and Pro entitlement are untouched; this wave only re-presents them.
- **The classic sheet is kept** and delegates to the same panel body, so the flag-off path cannot drift from the new one.
- **Section content is grouped, not rewritten.** No block is added, removed, or reworded; a block that fits no rail section stays in Overview.
- **The other three sub-apps** (Museum, Goals, and the Progress-hub dissolve) are Wave 2c/2d, each with its own plan.
