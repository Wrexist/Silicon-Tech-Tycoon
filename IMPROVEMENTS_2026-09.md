# Improvement Pass — 2026-09-27

Four sweeps against `main` @ 9d3e5db: a screenshot walk of every primary screen (`npm run shots:diff`),
plus three code audits (UI/CSS standard, gameplay feedback & fun, code bugs). Baseline 210 files /
2,173 tests green, typecheck clean. Every item below was verified against the code before listing.

Status: ✅ shipped on `claude/app-improvements-polish-l205rk` · ⏭️ deliberately deferred (reason given).

Nothing here touches the engine's simulation path — the determinism pin is untouched.

---

## P0 — Bugs players hit today

| # | Issue | Where | Status |
|---|---|---|---|
| 1 | **Mojibake in ~20 toasts**: "Commission delivered â€” payment banked", "3â˜… earned", "units Â· $4M". The file had been round-tripped through latin-1. | `state/useGame.tsx` (99 lines) | ✅ re-decoded + `design/encoding.test.ts` guard scans all of `src/` |
| 2 | **One Escape closed every stacked overlay.** Over IPO + Heat paywall it also dismissed the IPO (→ `ipoSeen`, New Game+ unreachable for the run); over an era-mandate draft + strike card it silently declined the mandate. `overlayGuard` was a counter, not a stack. | `design/overlayGuard.ts`, 13 overlays | ✅ `useEscapeLayer()` — a real stack; only the frontmost layer answers Escape |
| 3 | **Paywall opens *behind* the IPO overlay** (z 62 vs 80): "Raise Heat" / "Start New Game+" looked dead for free players — on the main conversion moment. | `paywall.css`, `App.css` | ✅ z-index tokens; paywall above takeovers |
| 4 | **Era modal, IPO overlay and paywall don't hold the sim** — weeks (and rent) pass while you read a mandate draft or the paywall, and interrupts stack on top. | `App.tsx`, `Paywall.tsx` | ✅ `useHoldSim(true)` |
| 5 | **"Latest product" reads the oldest** (`launched` is newest-first): the buzz ticker kept announcing your very first product forever. | `BuzzTicker.tsx` | ✅ (the matching engine read in `sourcingExposureWithContracts` is ⏭️ — it changes sim output, needs a gated migration) |
| 6 | **A crash on HQ / Design Lab is permanent until reload** — ErrorBoundary had no reset; "Back to Office" was a no-op on the Office. | `ErrorBoundary.tsx` | ✅ `resetKeys` + retry |
| 7 | **Era goal card broken in the AI Era**: "Both thresholds are required" with no bars (thresholds are ∞ at era 4; IPO branch gated on `maxEra()` which is 5 now). | `HQ.tsx` `EraGoalCard` | ✅ IPO → Frontier goal |
| 8 | **Research roadmap copy wrong**: future eras said "X rep **or** $Y" (only 1→2 is either/or), progress used `max` (overstates), era 4 rendered "72 / null rep". | `Research.tsx` `EraRoadmap` | ✅ |
| 9 | **Design Lab launch skipped Mastery / Franchise-Iconic celebrations** — a hand-copied, stale `onLaunch`. | `DesignLab.tsx` | ✅ uses shared `useLaunchProduct` |
| 10 | **Office mood colours missed band changes** (memo bucket `mood/12` straddles the 20/40/60/80 bands). | `HQ.tsx` | ✅ keyed on `moodBand` |
| 11 | **HUD RP count-up jumps backwards / freezes** when a new value lands mid-tween. | `AnimatedNumber.tsx` | ✅ tween from the displayed value |
| 12 | **Design Lab tab "Components" clipped** against the pill; Launch check-badge overlapped its label. | `redesign.css` | ✅ content-sized tabs |
| 13 | **Charts read "$2790.0M"** — `formatShortDollars` had no B/T tier. | `engine/money.ts` | ✅ + tests |
| 14 | "1 weeks" on research rows; "Available & locked projects / evolve the company" header wrapped in 3 lines. | `Research.tsx` | ✅ |
| 15 | Literal "?" in the office-layout title and empty-team morale. | `OfficeFloorMap.tsx`, `HQ.tsx` | ✅ |

## P1 — Popup standard & legibility

| # | Issue | Status |
|---|---|---|
| 16 | `redesign.css` flattens the glass CTAs inside every in-app interrupt (same specificity, loads later) — two CTA styles across popups. | ✅ scoped out of popups |
| 17 | Newer popups (`.cma .ern .stfm .rge .rev .cof .scn__confirm`) missing from the glass-button / focus-halo lists. | ✅ |
| 18 | Scrims not on the standard (`rgba(10,12,16,.3)`, `#0a0c10`, 45%). | ✅ `color-mix(var(--bg) 30%)` |
| 19 | Coach / Decision Inbox / Pro nudge banners pinned to old nav heights → half-hidden under the new dock. | ✅ `var(--dock-height)` |
| 20 | Dark-mode positive toast (#fff on #10b981 ≈ 2.5:1) and rivalry chip (#fff on amber ≈ 2.1:1) fail WCAG AA. | ✅ dark ink |
| 21 | Auto-renew disclosure shrinks to 9px on short screens (App Store 3.1.2 risk); other 9px labels. | ✅ floor at `--fs-nano` |
| 22 | High-contrast mode's 3px focus ring overridden by a hardcoded 2px rule. | ✅ `var(--focus-width)` |
| 23 | Touch targets < 44px: paywall close (30), IPO Heat ± (30, text glyphs), scenario share (30), chart range (28), Lab suggest/max (32), Market "all" (32), assign/swatch (38). | ✅ 44px hit areas; Lucide ± |
| 24 | Reduced motion still honoured the per-card stagger `animation-delay`. | ✅ |
| 25 | `#fff` text literals on coloured fills; dead `var(--gold, #d9a824)`-style fallbacks (~40). | ✅ tokens |

## P2 — Launch-moment feedback (the core loop's payoff)

| # | Issue | Status |
|---|---|---|
| 26 | Reveal never compares against your previous product — add "▲ +8 vs Aurora 2" and a **New personal best** badge. | ✅ |
| 27 | After a flop the reveal gives no next step — add **Design the next version**. | ✅ |
| 28 | Overtaking a rival in the ranking is only a feed line (in a collapsed group) — toast "You overtook X — now #N", celebration at #1. | ✅ |
| 29 | Claiming a contract: haptic + sound only, and its card lives in a collapsed group while the HQ dot points at it. | ✅ reward toast; group auto-opens when a reward is ready |
| 30 | Reputation in the HUD jumps while cash and RP animate. | ✅ |
| 31 | Weekly recap has no "vs last week". | ✅ |
| 32 | Design advice says "No major issue" while rivals drag the forecast to a flop; the verdict badge is hidden by CSS. | ✅ forecast line + competition warning |
| 33 | "Design a successor" nudge on Market never goes away once you've had a hit. | ✅ ignores lines you've already continued |
| 34 | Reveal shows forecast units, not realized — and fan/rep/RP deltas only go to the feed. | ⏭️ needs `launchReady` result plumbing through three call-sites; next pass |

## P3 — Tedium & comparisons

| # | Issue | Status |
|---|---|---|
| 35 | Compare-products table labels rows with raw keys ("performance") and doesn't mark the winner. | ✅ |
| 36 | Market product list: no filter late-game (dozens of rows). | ✅ All · Live · Hits · Flops chips |
| 37 | Price slider $0–$5,000 → the useful band is ~10% of the track on a phone. | ✅ adaptive max |
| 38 | Lifecycle labels (rising/peak/fading) on Market disagree with Live Ops after a boost. | ✅ `productMomentum` |
| 39 | Post-mortem profit / phase revenue use the post-cut price. | ✅ realized revenue |
| 40 | One-tap "upgrade to researched tiers" in the Lab; live "+3 fit" delta chip. | ⏭️ touches design-budget interplay; next pass |

## P4 — Code health

| # | Issue | Status |
|---|---|---|
| 41 | ~600 lines of dead CSS (`researchProgress.css`, `.speeddial*` — whose test guarded nothing —, `.mkts*`, `.rd__bank*`, `.pd__pricecut*`, `.co__ach-*`, …). | ✅ removed; bottom-chrome test re-pointed |
| 42 | Dead code: `HeroFrame.tsx`, `uiVersion` getters. | ✅ |
| 43 | WebGL probe leaks a live WebGL2 context. | ✅ `loseContext()` |
| 44 | Draft/library localStorage grows forever across New Game+ runs. | ✅ prune stale run keys |
| 45 | Seasons read (`localStorage` + JSON.parse) on every tick from the office scene. | ✅ raw-string cache |
| 46 | Confetti timers never pruned; Settings "copied" timer not cleared; drag handlers ignore `pointercancel`. | ✅ |
| 47 | `AppShell` re-renders the whole app every tick (`useGameSelector` has zero consumers). | ⏭️ large refactor with regression risk; tracked |
| 48 | z-index: ~35 magic numbers across 30 files. | ✅ layer tokens for the overlay stack (dock → sheet → interrupt → takeover → paywall → toast → celebrate) |
| 49 | 164 off-grid spacing values, literal `999px`, `transition: all` ×10. | partial ✅ (`transition: all`, `999px`); spacing snap ⏭️ (pixel-shifts every screen — needs a dedicated visual review) |
