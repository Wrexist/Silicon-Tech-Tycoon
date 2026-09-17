# Silicon 2.0 — Premium UI Redesign (Design Spec)

**Date:** 2026-09-16
**Status:** Draft for review
**Author:** OpenCode (with owner)
**Reference:** the six-panel mockup supplied by the owner (Platform, Device Museum, Company Overview, Goals, Design Lab, Settings)
**Baseline:** `main` @ the released 1.3.0 game

---

## Principle 0 — the current game is the baseline

The shipped game is treated as flawless and load-bearing. Nothing here may break it.

1. `main` stays the released game. All redesign work lives on a long-lived branch.
2. The new shell ships **behind a flag**, off by default until a slice is verified. Both UIs run side by side.
3. The **golden baseline** is the tree *after* the owner-approved quick wins: 173 captured frames + the `shots:diff` harness. Wave 0's own changes are additive on top of that baseline, and a slice ships only if it **matches or beats** the screen it replaces.
4. **No rebalancing.** The redesign re-presents existing systems; it does not change their numbers.
5. Every new state field is **optional + backfilled**, defaults to a no-op, and old saves must load and render.
6. **Per-slice gate (no exceptions):** `tsc` · full test suite · `build` · `audit:screens` · shots-diff vs baseline · determinism pin byte-identical.
7. Protected paths are untouched without explicit instruction: `engine/` purity, `render/DeviceRenderer.tsx`, persistence migrations. Sheets keep the liquid-glass popup standard.
8. Every slice is independently revertable.

---

## 1. Goals

- Make the interface read like the reference mockup: a premium, professional, information-dense product.
- Bring structure the game lacks: persistent side rails, page stacks, stat tiles, real charts, card grids, badge rows, segmented controls.
- Work at every size: phone (primary), tablet, landscape, desktop.
- Preserve the simulation's quality, determinism, save compatibility and shippability.

## 2. Non-goals

- No balance changes.
- No in-app localisation (the mockup's Language control is dropped, not faked).
- No cloud backend (Cloud Save means local export/import).
- No new game content beyond what the mockup's screens imply.
- No replacement of the liquid-glass material.

## 3. Locked decisions (owner-approved)

| # | Decision | Choice |
|---|---|---|
| 1 | Layout direction | **Responsive** — side rail on wide, bottom nav on phone |
| 2 | Content scope | **Full mockup**, including implied new features |
| 3 | Navigation model | **Hybrid** — pages for sub-apps, sheets for popups |
| 4 | Mechanic depth | **Real mechanics, engine-first, determinism-safe** |
| 5 | Hero imagery | **Render everything in-engine, zero image assets** |
| 6 | Visual material | **Blend** — mockup structure on the existing glass system |
| 7 | Approach | **Foundation, then vertical slices** |

---

## 4. Responsive shell

Replaces the single `max-width: 540px` column (`src/index.css:41`) with three layout modes. Layout is CSS-driven (media queries); JS resolves behaviour only, never layout.

| Mode | Width | Navigation | Content |
|---|---|---|---|
| Phone | `< 700px` | Bottom tab bar (today's) | Single column, 540 max |
| Tablet / landscape | `700–1100px` | Left rail | Single column, wider gutters |
| Desktop / wide | `> 1100px` | Left rail + top bar | Multi-column, ~1100–1280 max |

- `#root`'s max-width becomes mode-dependent; `.app__main` becomes a grid.
- New layout tokens: `--rail-w`, `--topbar-h`, `--content-max`, breakpoints.
- A single `<AppShell>` owns the top bar, the rail/bottom nav and the page router. Screens stop drawing their own headers.

### Top bar (all screens)

Back chevron (pages only) · page title · Cash / RP / Rep chips · `Wk N · Y N Q N` · settings gear. Mirrors the mockup and reuses today's HUD data.

---

## 5. Navigation architecture (hybrid)

- **Roots:** the five tabs (Office, Design, Research, Market, Company), rendered as bottom nav on phone and rail on wide — one component, two presentations.
- **Pages:** a small route stack for drill-ins — Platform sub-app, Settings, Device Museum, Goals (and the remaining promoted Progress views). State is `{ root, page, params }`.
- **History integration:** `pushState`/`popstate`, so the back chevron, Escape, iOS swipe-back, Android back and deep links (`#/company/platform/services`) all behave.
- **Sheets remain** for transient moments: launches, celebrations, interrupts, confirms, paywall, Bank, Coach, Factory Mode.
- `useDialogFocus` and the existing `Sheet` primitive are unchanged for sheets; pages use `PageHeader`.

---

## 6. Pattern library (new primitives in `src/design/`)

The vocabulary that makes screens consistent. All built on existing tokens and the glass material. **Zero new dependencies.**

| # | Primitive | Purpose |
|---|---|---|
| 1 | `PageHeader` | Back chevron, title, subtitle, right actions |
| 2 | `StatTile` / `StatRow` | Label, big value, optional delta chip; 2-up phone, 4-up wide |
| 3 | `DataChart` | Multi-series chart (legend, range selector, axis, tooltip) — extends `components/charts.tsx`, no charting library |
| 4 | `CardGrid` | Gallery grid with locked / undiscovered states |
| 5 | `RailNav` / `SegmentedControl` / `TabBar` | Navigation controls in both form factors |
| 6 | `MetricPanel` | Design Lab score dial + stat bars + CTA |
| 7 | `Badge` / `RewardChip` / `ProgressBar` | Rich goal and status rows |
| 8 | `KeyStatsPanel` | Icon + label + value list |
| 9 | `EmptyState` (upgrade) | Museum / Platform empty states |
| 10 | `HeroFrame` | Mounts the in-engine hero (3D scene or `DeviceRenderer`) with mockup framing and gradient chrome |

---

## 7. Design tokens & material

- Keep the existing token contract (`src/design/tokens.css`); no hardcoded values.
- Add layout tokens (above) plus a denser spacing/type step the mockup requires, and elevation/radius entries for flat panels and heroes.
- Material stays the house liquid glass; the mockup's structure is imported on top of it, not a replacement.
- Light **and** dark parity is required. The mockup's dark is one theme, not the only one.

---

## 8. Screen-by-screen information architecture

### 8.1 Page templates

| Template | Used by | Phone | Wide |
|---|---|---|---|
| Dashboard | Office/HQ | Hero + tile row + card stream | Hero + tiles full-width, cards 2-col |
| Workspace | Design Lab | Hero → metric panel → stage stepper | Hero left, panel right, stepper full-width |
| Sub-app | Platform, Settings | Header + horizontal segment strip | Header + persistent left rail |
| Gallery | Device Museum | 2-up grid | 3–4-up grid |
| List+Detail | Goals, Market, Research, Company | Segments + stacked cards | 2-col: list left, detail right |

### 8.2 Screens

**Office/HQ → Dashboard.** In-engine 3D hero, tile row (Cash · Net worth · Weekly net · Runway), action-owed priority zone, Next-move guidance card with progress bar, then the existing **Your company / Operations / Records** groups as labelled card sections (preserves the noise-audit zone structure).

**Design Lab → Workspace.** Segmented **Overview · Design · Components · Testing · Variants** + **New Project**.
- Overview: device hero, MetricPanel (score dial, potential label, Performance/Battery/Camera/Design/Durability/Market-Fit bars, **Market Insights**), **Development Stage** stepper, Est. Time to Launch.
- Design: today's Style + Camera controls.
- Components: today's tier pickers + supply chain.
- Testing: **new** — Test Prototype.
- Variants: **new** — saved design variants.

**Research → List+Detail.** RP/Insight hero meter, tiles (RP/wk · unlocks ready · era), project cards, RP-income chart, queue.

**Market → List+Detail.** Net-worth header becomes tiles; segmented **Standing · Products · Demand**; leaderboard table; product cards with sparkline; region cards with progress.

**Company → segmented Overview · Team · Platform.**
- Overview: in-engine hero, tiles (Cash · Weekly Income · Weekly Burn · Revenue/Employee with ± deltas), **Company Growth** chart (Revenue/Expenses/Profit + range), **Key Stats** (Products Shipped · Global Reach · Customer Rating).
- Team: output tiles, morale, roster table.
- Platform: sub-app.

**Platform (new page) → Sub-app** with rail **Overview · Services · Ecosystem · Licensing · Developers · Distribution**.
- Overview: Silicon OS card (version, blurb, **Start Development**), "Why a platform?" checklist, Requirements (cost · RP · time), Pro tip.

**Goals (new page).** Segmented **Active · Completed · All**; rows with badge (Main Goal / Business / Product / Community), title, description, progress + fraction, reward chips (cash / RP / title), chevron. Other Progress views (Roadmap, Mastery, Vault, Founder Legend, Achievements, Scenarios, Challenges, Museum) become pages with the same language.

**Device Museum (new page).** Header (N/50 Collected, search), category chips **All · Phones · Tablets · Laptops · Wearables · Concepts**, grid of in-engine device renders + name + year/quarter + tagline, locked/undiscovered tiles, "Complete collections" footer.

**Settings (new page) → Sub-app** with rail **General · Notifications · Graphics · Audio · Gameplay · Cloud Save · Account · Help**.
- General: Currency Format, Theme (Auto/Light/Dark cards), Auto Save, Hints & Tutorials, Confirm Actions, Show Realtime Values, Reset to Defaults, About.
- Remaining sections remap today's toggles (Text size, High contrast, Haptics, Sound, Interrupt pace).
- **Cloud Save** = local export/import only. **Account** → **Silicon Pro / Purchase & Restore**. **Language** omitted (no i18n).

### 8.3 Sheets (unchanged category)

Launches, LaunchReveal, awards, rival strike, rivalry, eureka, community ask, earnings call, ready-to-launch, decorate tutorial, paywall, bankruptcy/era/IPO takeovers, confirms, Decision Inbox, Coach, Bank, Factory Mode. Restyled to the language; **liquid-glass popup standard preserved.**

---

## 9. Engine & state

### 9.1 Presentation-only (no engine work)

Platform's six sections map onto systems that already exist:

| Mockup element | Backed by |
|---|---|
| Platform → Services | `osServicesMultiplier`, `philosophyServicesMult` |
| Platform → Ecosystem | `appsPublishedPerWeek`, `storeCommission`, `featuredApps`, `OS_SYNERGIES` |
| Platform → Licensing | `rivalLicenseFee`, `licenseeStrengthUplift`, `licenseeMood` |
| Platform → Developers / Distribution | `installedBase`, `regions.worldCoverage`, `regionReach` |
| Design → MetricPanel / Market Insights | `overallScore`, `productStats`, `forecast` |
| Company → Global Reach | `worldCoverage` |
| Company → Customer Rating | derived from `reviews.criticReviews` |
| Goals segments, Museum concepts | existing goals + museum data |

### 9.2 New state (optional, backfilled, no balance impact)

| Field | Purpose | Default |
|---|---|---|
| `financialHistory: {week, revenue, expenses, profit}[]` | Growth chart + delta chips | empty, capped like `cashHistory` (260) |
| `designVariants[]` | Saved Design Lab variants | empty |
| `draftStage` | Development Stage lens | derived from existing draft state |
| `showRealtimeValues` / `confirmActions` / `currencyFormat` | Settings prefs | today's behaviour |

### 9.3 New mechanics

**Test Prototype** (Design → Testing) — the only new balance-touching mechanic:
- Spend cash + 1 week on the active draft → returns a validated forecast (tighter `forecastBand`) and may surface one flaw to fix.
- **Optional, never mandatory.** Declining changes nothing, so existing pacing and math are untouched.
- Pure engine function, gated on the draft having a stage, fresh **salt 317** (307 / 311 are taken), unit-tested.
- Acceptance: determinism pin **byte-identical** on a do-nothing run; `npm run sim` curve unchanged.

**Development Stage** is a **lens, not a gate**: Concept → Design → Components → Testing → Finalize(Build) → Launch maps onto the existing flow. Making Testing mandatory would change pacing, so it stays a choice.

---

## 10. Accessibility & performance

- Density lives in tokens; nothing below 44px; focus rings preserved; Dynamic Type checked on the densest screens.
- Contrast at AA in both themes.
- Wide layout must not force the 3D scene on low-end devices: keep lazy boundaries and quality tiers.
- Charts are SVG drawn in code — no library, no image payload.

---

## 11. Delivery waves

| Wave | Contents | Exit criteria |
|---|---|---|
| 0 · Safety net | Branch, `ui2` flag, pure breakpoints, layout tokens, `RailNav` mounted **additively** | Flag off is pixel-identical to today; flag on shows the rail at tablet/wide; determinism pin untouched |
| 1 · Chrome + roots | Chrome swap (AppShell, top bar, page stack/router), `PageHeader` + `StatTile` primitives, then Office, Research, Market, Company, Design Lab | Each screen beats its baseline frame; back/deep-link work |
| 2 · Sub-apps | Platform, Settings, Museum, Goals; hub dissolves; remaining primitives built as their screen needs them | Each beats its baseline page |
| 3 · Mechanics | Test Prototype, Development Stage lens, `financialHistory`, Customer Rating | Pin byte-identical; sim curve unchanged |
| 4 · Sheets & polish | Interrupt restyle, wide/iPad verification, a11y, perf | Full gate green |

> **Ordering note (owner-approved refinement).** The pattern library is built **just-in-time**, not upfront: each primitive is a task in the wave whose screen first consumes it. Wave 0 keeps the existing chrome and only *adds* the rail, which is the lowest-risk way to prove the flag and the responsive plumbing before anything is replaced. The chrome swap and the router are Wave 1's first tasks, verified against a migrated screen.

## 12. Verification gate

Every slice: `tsc` → full test suite → `build` → `audit:screens` → shots-diff vs golden baseline → determinism pin byte-identical.

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Design Lab is 2,413 lines | Lens over existing logic; never rewrite the logic |
| Density hurts accessibility | Tokenised density + explicit a11y pass + Dynamic Type check |
| Wide-layout 3D cost | Lazy boundaries, quality tiers, device verification |
| Two UIs drift | Flag retires only when every screen is migrated and green |
| App Store risk | `main` untouched; screenshots regenerate only once stable |
| Scope creep | Every wave independently shippable |

## 14. Out of scope

In-app i18n · real cloud backend · balance changes · new content beyond the mockup's screens.

## 15. Open questions

None blocking. Flagged for the owner: none.
