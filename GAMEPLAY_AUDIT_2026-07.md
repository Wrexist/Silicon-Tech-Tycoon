# Gameplay Audit & Improvement Plan — 2026-07

A fresh full-app audit (three parallel domain sweeps: engine correctness/dead-code, gameplay
depth/content, screens/UX immersion) cross-checked against a first-hand read of the tick loop,
market/economy/sales engines, catalogs, balance, the design/subsystem/synergy system, and the
full action surface. Baseline at start: `tsc -b` 0 errors, **815 tests** green, `vite build` ok.

Legend: 🐛 bug · ✨ improvement · 💎 premium-polish · ♿ a11y · 🎮 depth · 🧹 dead-code

---

## STATUS — all 7 phases shipped (final: `tsc -b` 0 · **824 tests** green · `vite build` ok)
- **P1 Correctness** — launch silent-failure, factory a11y strand, `--danger` token, name cap, chart
  guard, deep-link tab, HQ keyboard activation. ✅
- **P2 Mandate + formatting** — removed the 3D-office emoji (→ Lucide emotes); `formatCount()` with
  M/B rollover (killed "2000.0k fans"); dead CSS. ✅
- **P3 Feedback/a11y** — nested-confirm Escape isolation, dismiss-shortlist confirm, specialist-hire
  feedback, factory aria-labels, two tap-target floors. (Remaining tap-target/disabled-reason micro-
  items need on-device visual verification — logged, not changed blind.) ✅
- **P4 Dead code** — removed `discountedRd`, `newlyUnlocked`, `playerSharePrice` (+ orphaned const)
  and their tests. ✅
- **P5 Balance** — People Lead scales down (no longer zeroes) burnout churn. Ecosystem annuity +
  deeper morale stakes DEFERRED (need balance-harness retune + playtest). ✅
- **P6 Content** — signature subsystems for tablet/monitor/AR (phones untouched → sim-safe). Synergy
  archetypes intentionally skipped (would perturb the phone sim). ✅
- **P7 Living products** *(the #1 gameplay hole)* — restock/reorder (demand-capped, no money printer)
  + repeatable diminishing-returns marketing push & price cut, wired into the Market detail sheet. ✅
- **P6b Category-signature archetypes** — added a `categories` scope to synergy archetypes + five
  category-only pairings (laptop/desktop/console/wearable/tablet/AR), phones sim-safe by construction. ✅
- **P8 Content — event chains** — the thinnest content area (2 → **5** chains): added supply-shock
  (E1), counterfeit-surge (E2), standards-war (E3), each a 3-beat narrative ending in a real choice,
  reusing proven effect kinds. Determinism preserved (run-to-run test); +1 end-to-end chain test. ✅
- **P9 Mergers absorb assets** *(audit #3)* — acquiring a rival used to just delete it for a rep/fans
  bump. It now also inherits their **R&D pipeline** (a one-time RP windfall) and their **installed
  base** (a permanent weekly services annuity — the rivals' customers now pay you), both scaled by the
  rival's reputation and bounded by the field floor + escalating cost. New `absorbedBase` state field
  (migrate-defaulted), `absorbedServicesRevenue` wired into the tick + revenue preview, an inherited-
  assets preview in the rival profile, +2 tests. Opt-in → the pinned sim is byte-identical. ✅

Ordered by risk/impact: correctness first → mandate/formatting → immersion consistency →
dead-code → balance hardening → content depth → living products. Every change keeps the suite
green (or updates tests intentionally) and preserves the pinned phone-only balance sim +
determinism (engine changes are additive / gated on optional fields).

---

## PHASE 1 — Correctness & silent-failure fixes 🐛
- [ ] 1.1 **Launch button silently no-ops on failure.** `DesignLab.onLaunch` (`:504`), `ReadyToLaunch`
      (`:103`), `DesignCompleteCard.launchNow` (`:1717`) do `if(!res.ok) return;` with no haptic/toast
      and close the sheet before confirming success. Mirror `confirmBuild`: `haptic.error()` +
      `showToast(res.reason)`, don't close before success.
- [ ] 1.2 **Factory "Fix in Build" strands reduced-motion / no-WebGL users.** `FactoryMode.tsx:447`
      enters build mode bypassing the `!use3d` guard the rail button has → dead toolbar over the 2D
      minimap. Add the same guard + toast.
- [ ] 1.3 **Factory "Accept order" discards its `ActionResult`.** `FactoryMode.tsx:507` ignores `res.ok`
      → silent no-op on an expired offer. Check + feedback. Same for Pass feedback.
- [ ] 1.4 **`--danger` token is undefined** (0 defs in src) → the hardcoded `#e5484d` fallback paints.
      `factoryMode.css:300` → `var(--negative)`.
- [ ] 1.5 **"Continue a line" name can exceed the 22-char cap.** `DesignLab.tsx:1479` omits the
      `.slice(0,22)` every other setter uses. Add it.
- [ ] 1.6 **`SalesCurveChart` unguarded empty-data path** (`charts.tsx:118` → `barW=width/0`). The
      detail-sheet call site (`Market.tsx:1091`) doesn't guard like the list site does. Guard in-component.
- [ ] 1.7 **"See breakdown" deep-link lands on the wrong sub-tab.** `Market.tsx:115` opens the
      post-mortem but leaves `mktTab="standing"`. Set `"products"` in the focus effect.
- [ ] 1.8 **HQ owned-upgrade card is `role=button`+`tabIndex=0` with no `onKeyDown`** (`HQ.tsx:796`):
      focusable but not keyboard-activatable. Add Enter/Space handler (or drop the role).

## PHASE 2 — Premium mandate & unified number formatting 💎
- [ ] 2.1 **Live emoji in the 3D office** (`Garage3D.tsx:1024` `CHEER_EMOJI`/`SLUMP_EMOJI`) — the only
      shipped colorful emoji, firing at the launch win/flop beat. Direct "Lucide-only, never emoji"
      violation. Replace with Lucide-glyph emotes in the existing pill/burst aesthetic (tinted
      positive/negative), reduced-motion respected.
- [ ] 2.2 **Fans render "2000.0k" past 1M** (`Market.tsx:180`, `HQ.tsx:196`: `(fans/1000).toFixed(1)k`,
      no M rollover) + units formatted 4 ways (`toLocaleString` vs `fmtCompact` vs uppercase-K
      `fmtCount`). Add one shared `formatCount()` to `engine/money.ts` (K/M/B rollover, lowercase k)
      and route fans/units through it.
- [ ] 2.3 **Dead CSS** 🧹: `market.css` `.mkt__compmap-fill--positive/accent/negative` (`:1390`) +
      `.mkt__intel-icon` font rules (`:147`, inert since SVG icons); `factoryMode.css .fmode__tool--soon`
      (`:177`). Remove.

## PHASE 3 — Feedback & immersion consistency ✨♿
- [ ] 3.1 **Disabled buttons don't say why.** Company Morale/Recruit (`:573`,`:1442`), Market Region
      Unlock (`:329`), DesignLab Camera Layout <2 lenses (`:1191`), Factory BOOST (`:982`). Render a
      one-line reason (the app already does this well elsewhere).
- [ ] 3.2 **Missing haptics/feedback on real actions.** 3D office is the least tactile surface: tapping
      a staff robot / bank vault fires no haptic; recruiter-search tiers no haptic; specialist-hire
      adds a teammate silently (no toast/sfx). Add to match sibling actions.
- [ ] 3.3 **Tap targets below the primitive floor** (25–32px, hand-rolled buttons bypassing `Button`):
      `hqb__cat/tool`, `trade__preset` (0 horizontal padding), `lab__toggle/swatch/suggest`,
      `co__assign-opt`/raise/rest, `coach__cta`. Route through `.ds-btn--sm` or add `min-height`.
- [ ] 3.4 **"Dismiss shortlist" wipes paid-for candidates with no confirm/feedback** (`Company.tsx:1422`).
      Add an inline confirm (mirror the fire flow).
- [ ] 3.5 **Nested confirm dialogs not modally isolated** (Scenarios `:118`, Challenges `:162`): Escape
      closes confirm AND parent Sheet; no focus-trap/scroll-lock. `stopPropagation` + focus-trap.
- [ ] 3.6 **ARIA**: Research/Company sub-navs use `role=tab` with 0 `role=tabpanel`; Factory icon buttons
      use `title` but no `aria-label`. Add tabpanel wiring + aria-labels.
- [ ] 3.7 **Lab "In production" bar jumps in whole-week steps** (`DesignLab.tsx:582`) beside the smooth
      `BuildProgress`. Interpolate.

## PHASE 4 — Dead-code removal 🧹 (grep-verified test-only)
- [ ] 4.1 Remove abandoned mechanics: `discountedRd` (cash R&D discount, superseded by RP economy),
      `newlyUnlocked` (parallel unused achievements API), `playerSharePrice` (never surfaced) — and
      their tests.
- [ ] 4.2 Remove/relocate test-only exports leaking into prod modules where clean: `demoFloor`
      (`factoryFloor.ts`), and the redundant tiny utilities (`isBankrupt`/`canAfford`/
      `isSupplierUnlocked`/`segmentById`/`mutatorById`/`OBJECTIVE_COUNT`) where removal is clean.

## PHASE 5 — Balance hardening (compounding feedback loops) 🎮 (test-gated, sim-preserving)
- [x] 5.2 **One People Lead (even skill 1) zeroed ALL burnout churn** (`gameState.ts` `&& !hasPeopleLead`).
      FIXED — a People Lead now *scales down* the weekly quit chance (skill-scaled, floored at 0.25×),
      never to zero, so burnout keeps its teeth. The no-People-Lead path draws rng identically, so the
      determinism pin (a solo founder) is byte-identical (824 tests green). Conservative by design: the
      lead's mood lifts already keep a well-run team out of the danger zone, so this only bites active
      neglect — the honest hardening, not a blind rebalance.
- [~] 5.1 **Ecosystem annuity compounds over a never-pruned `launched[]`** — DEFERRED. It's a *designed*
      annuity and the tick's O(n)/save growth is bounded in practice (a game ships dozens of products,
      and New Game+ resets `launched`). A recency-decay would change the tuned services economy the
      OS/Platform division depends on (and 4 ecosystem tests); doing it safely needs the balance harness
      (`scripts/balance-sim.mjs`) + a playtest, not a blind decay. Logged, not changed.
- [~] Deeper morale stakes — DEFERRED. The real reason a People Lead makes burnout painless is the
      *mood lifts* keeping everyone above the danger threshold, plus the 0.82 output floor. Restoring
      real stakes means retuning those magnitudes — a playtest-gated balance change, not a code fix.

## PHASE 6 — Content depth: subsystems & synergies 🎮 (data-only, additive)
- [ ] 6.1 Only 2 of 8 categories have a signature subsystem, so cross-category design is "the same 5
      sliders." Add subsystems for tablet (Stylus/Digitizer), monitor (Color Accuracy), AR/experimental
      (Optics/FOV). **Phones stay subsystem-free** (protects the phone-only balance sim). Rendered
      generically by DesignLab already.
- [ ] 6.2 Add a few more `SYNERGY_ARCHETYPES` (`product.ts`) so new component pairings stay discoverable.

## PHASE 7 — Living products (the #1 gameplay hole) 🎮
A launched product is a frozen 16-week annuity: the tick just decrements `weeklyUnits[]`, and the
only levers (`cutProductPrice`, `marketingPush`) are one-shot and capped at the original run. The
mid-game between launches is the emptiest zone (the ship already has a "skip to next decision"
fast-forward — a tell). Make a launched product an *actable* asset:
- [ ] 7.1 Make `marketingPush` / `cutProductPrice` **repeatable with diminishing returns** (track uses,
      scale the boost down each time) instead of hard `maxPerProduct:1`.
- [ ] 7.2 Add a **restock/reorder** reducer: fund a fresh production run on a still-selling or
      sold-out product, appending new sales weeks (reuse `planProduction`/`forecast`/`priceFit`).
- [ ] 7.3 Wire both into the Market **Product Detail** sheet with clear costs + feedback.
- [ ] 7.4 Tests: restock appends bounded weeks, respects cash/build, diminishing returns converge.

---

## Notes / guardrails
- Engine (`engine/`), persistence schema, and `DeviceRenderer` are protected — changes are additive
  and gated on optional fields so old saves + the pinned determinism/balance sim stay byte-identical.
- No new image assets (parametric SVG / Lucide only). No emoji. No IP names. No dark patterns.
- After each phase: `npm run typecheck` + `npm test` must be green; commit per phase.
