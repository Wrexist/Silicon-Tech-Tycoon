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
| 5 | **"Latest product" reads the oldest** (`launched` is newest-first): the buzz ticker kept announcing your very first product forever; the supply-crunch exposure used your first-ever product's supplier. | `BuzzTicker.tsx`, `gameState.ts` | ✅ both (determinism pin green) |
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
| 34 | Reveal showed the pre-variance projection, not the recorded forecast — and fan/rep deltas only went to the feed. | ✅ recorded units + "+N fans · +M rep" row |

## P3 — Tedium & comparisons

| # | Issue | Status |
|---|---|---|
| 35 | Compare-products table labels rows with raw keys ("performance") and doesn't mark the winner. | ✅ |
| 36 | Market product list: no filter late-game (dozens of rows). | ✅ All · Live · Hits · Flops chips |
| 37 | Price slider $0–$5,000 → the useful band is ~10% of the track on a phone. | ✅ adaptive max |
| 38 | Lifecycle labels (rising/peak/fading) on Market disagree with Live Ops after a boost. | ✅ `productMomentum` |
| 39 | Post-mortem profit / phase revenue use the post-cut price. | ✅ realized revenue |
| 40 | One-tap "upgrade to researched tiers" in the Lab; live "+3 fit" delta chip. | ✅ (the design-budget meter still gates the build) |

## P4 — Code health

| # | Issue | Status |
|---|---|---|
| 41 | ~800 lines of dead CSS (`researchProgress.css`, `.speeddial*` — whose test guarded nothing —, `.mkts*`, `.rd__bank*`, `.pd__pricecut*`, `.co__ach-*`, …). | ✅ removed; bottom-chrome test re-pointed |
| 42 | Dead code: `HeroFrame.tsx` (never rendered). | ✅ removed · the `uiVersion` setters are kept deliberately (a dev/QA toggle surface) |
| 43 | WebGL probe leaks a live WebGL2 context. | ✅ `loseContext()` |
| 44 | Draft/library localStorage grows forever across New Game+ runs. | ✅ prune stale run keys |
| 45 | Seasons read (`localStorage` + JSON.parse) on every tick from the office scene. | ✅ raw-string cache |
| 46 | Confetti timers never pruned; Settings "copied" timer not cleared; drag handlers ignore `pointercancel`. | ✅ |
| 47 | Hidden screens (Office, Design Lab) re-rendered on every sim tick. | ✅ `useGameWhile(active)` freezes a hidden screen's snapshot; `useLaunchProduct` reads state at tap time; HQ/Lab memoized — **54 → 18 ms script per sim week** (measured, headless Chromium, fast speed) |
| 48 | z-index: magic numbers across the overlay stack. | ✅ `--z-dock … --z-celebrate` tokens own every full-screen layer (in-screen stacking contexts keep local numbers) |
| 49 | Off-grid spacing, literal `999px`, `transition: all` ×10, white/black colour literals, literal font sizes. | ✅ 3/7/9/11px snapped and 398 spacing values tokenised (pixel-diff reviewed: 1–2px shifts only); 119 sheen/shade literals → `--sheen`/`--shade` (DOM screens byte-identical); nano/micro font sizes tokenised |

## Second pass (after the first report)

| Item | Status |
|---|---|
| Edge-reflection rim scrolled away on tall popup cards (12 cards). | ✅ the overlay scrolls, not the card — one shared rule; verified at 375×480 |
| Hidden screens re-rendering every tick (#47). | ✅ see #47 — ~3× less main-thread script per sim week |
| Spacing / colour / font-size token cleanup (#49). | ✅ see #49 |
| "Ready to launch" rows gave no forecast. | ✅ shared `launchForecast` + a forecast chip on the HQ and Lab rows |
| "Design complete" had no comparison. | ✅ Overall shows ±N vs the product it follows |

## Round 3 — first-run, Factory, copy & accessibility

Three more audits (first-run + secondary screens, Factory mode + 3D office, copy + accessibility) plus
light-theme, 130% text and iPad screenshot passes. ~75 verified findings.

| Area | Shipped |
|---|---|
| **Large text** | Section tab strips keep whole words and scroll sideways at XL (the earlier fix broke "Component/s"). |
| **Factory perf** | No light-count shader recompiles (hot-machine lights stay mounted; work lights paint a pool instead of adding real lights); `useMotionFrame` reuses one object per subscriber instead of allocating per frame; floor revision / shadow key memoised; camera reset string built per render, not per frame; Boost reuses the parent's data. |
| **Factory bugs & UX** | Tap flash no longer freezes under the on-demand frameloop; belt paint truncates when a drag doubles back (no looping tail); Erase/Upgrade taps hit the piece, not the floor behind it; ghost centred on the finger for 3D taps (the 2D grid keeps exact cells); full floor explains itself; Upgrade shows its price; partial belt runs say "out of cash"; floor expansion needs a Confirm tap; per-tool rule text; `aria-pressed` on the palette; "an Assembly Arm". |
| **Decorate** | Escape exits; no "Furniture moved" echo toast. |
| **First run** | "New company" mid-scenario names the parked company it deletes and offers "Return to X"; the founding-screen scenario confirm no longer promises to keep a company that doesn't exist; Help & Guide reachable from Settings at week 0; the post-launch Coach card retires itself after 4 weeks (the next-move card and contracts were hidden behind "Got it"); "Replay coach" only offered when it can teach; Coach points at the real controls; the unlock card opens the Progress hub. |
| **Secondary screens** | Played challenges say "Played · new one tomorrow" (the game refuses replays); Roadmap separates "List on the exchange" from "Reach the pinnacle"; Platform revoke needs a confirm, licensee rows include the exclusive multiplier, revoke clears the exclusivity flag; Progress sub-views step back to the hub (back arrow and Escape); Time Machine copy says "every 4 weeks" and shows the real next snapshot; Retry saving only when there's a problem; Vault "Decrypt"; rival-strike first-time explainer. |
| **Accessibility** | Toast live region always mounted and readable; toast time scales with length (2.6–7s); `SectionHeader` is an `h3`; HUD chips and status dots/stars get `role="img"`; material chips named; disabled buttons show *why* in visible text; `.sr-only` utility. |
| **Copy & numbers** | One money formatter family (capital K), one count formatter (seven hand-rolled ones removed), billions roll over (no "$5750M"); Lucide stars instead of ★; US spelling; "research points"/"RP"; "Office" not "HQ"; "Outflow" (Bank runway now matches the HUD); EP explained in the glossary; "App Marketplace" (no real brand); rival feed "enters the phone market"; "Paused: <reason>" keeps casing; consistent toast separators; fan toasts reuse feed wording; "wk" everywhere. |

Considered and left as-is: the office canvas under Reduce Motion stays on the continuous frameloop — by
design only the viewport drift stops, and the camera tracks pointer/keys every frame; the Factory's 2D
no-WebGL fallback map (footprint ghost, belt arrows, roving tabindex) is a medium-size rework for a rare
path; first-time scenario players still skip the Coach (`newScenarioGame` sets `tutorialDone` in the engine).

## Verification

- `npx tsc -b --noEmit` clean; `npx vitest run` → 214 files / 2,184 tests green (determinism pin included).
- New guards: `design/encoding.test.ts` (mojibake), `design/overlayGuard.test.ts` (overlay stack),
  `design/launchReveal.test.ts` (history comparison), draft-storage eviction, forecast-aware design advice,
  and a rewritten `bottomChrome.test.ts` that pins the real dock relationships.
- Before/after screenshots of every primary screen via `npm run shots:diff` (`.shots/compare.html`).

### CI follow-up (PR #86)

- The release audit deliberately tests **hold-to-move outside Build mode**; restricting it to Build mode
  (round 3) broke that gate, so it's reverted — pressing and holding a machine moves it in plain view again.
- `verify-save-recovery`, `verify-factory-integrity` and `verify-office-integrity` looked for the retired
  SpeedDial (`.speeddial__btn--primary`) and have been failing on `main` too — silently, because their
  steps pipe into `tee` without `pipefail`. They now drive `.time-controls__play` and pass; the factory
  integrity script taps the new expansion Confirm.

