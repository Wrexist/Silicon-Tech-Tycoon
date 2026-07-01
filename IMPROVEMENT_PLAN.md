# Silicon: Tech Tycoon: Audit-Driven Improvement Plan

A complete, ordered implementation plan for the bug fixes and improvements found in the
four-audit sweep (game-breaking bugs, balance/systems, gameplay/UX, onboarding/progression/depth).
This is the execution doc: each item has the problem, where it lives, a concrete plan, tests, risks,
and verification. The master `ROADMAP.md` stays the owner-side ship sequence; this file is the
tactical backlog for in-game quality and depth.

Item IDs match the menu shared with the owner: `B*` bugs, `L*` balance, `D*` depth/decisions,
`C*` clarity/feedback, `Q*` quality-of-life, `O*` onboarding.

---

## 0. Working constraints (read before touching anything)

These are non-negotiable and several have already cost a regression this project, so honor them.

1. **Engine purity.** `src/engine/*` imports nothing from React/DOM and uses no `Math.random` /
   `Date.now` / argless `new Date()`. All randomness goes through the seeded `rng`. New mechanics land
   as pure, unit-tested engine logic first; new content lands as data in `catalogs.ts`.
2. **Golden invariant.** New state fields are OPTIONAL and default to a neutral value, so old saves
   load byte-identical and the sim output is unchanged when the feature is unused. Persistence
   migration in `state/persistence.ts` must be idempotent (decide each backfill on its own field's
   presence). Pinned by tests; do not break it.
3. **Protected (no refactor without explicit instruction):** `engine/` (additive changes are fine),
   the persistence schema + migrations in `state/`, and `render/DeviceRenderer.tsx` + category shapes.
   Touching these is allowed when the task IS the change, but be surgical and additive.
4. **Premium through restraint (RULE #1).** DesignSystem tokens only, 8pt grid, never hardcode
   colors/spacing/fonts, never a cramped or blank screen. A smaller polished change beats a big rough one.
5. **Em-dash ban (CRITICAL).** Never use the long dash character in code, copy, comments, commits, or
   docs. Use commas, colons, periods, or parentheses. Scan every diff before committing:
   `git diff | grep '^+' | grep '[the long dash char]'` must come back clean.
6. **Render visual changes in their REAL page context, not in isolation.** The Design Lab hero
   layout-collision bug (a duplicate class name) shipped because the hero was render-verified alone,
   and "my mock would not render" was waved off instead of investigated. Treat a mock that will not
   render as a signal to dig. Always mock the surrounding cards/sections too.
7. **Balance changes are verified by the sim, not by eye.** Run `npm run sim` before and after any
   `balance.ts` change and compare bankruptcies, verdict mix, net-worth CV, per-era launch counts,
   and the effectiveScore landscape. The harness auto-player is phone-only and never hires, so it is
   authoritative for the core launch loop and BLIND to staff/financing/M&A (see L5).
8. **Per-commit hygiene.** One logical change per commit. Every commit ends with the two trailers
   (`Co-Authored-By` + `Claude-Session`). Branch from the latest `main` (PR #42 merged; the working
   branch was restarted from main).

### Standard verification gate (run for every item before committing)

- `npm run typecheck` clean.
- `npm test` green (add/update tests for the item).
- `npm run sim` for any balance/engine economy change (compare to baseline below).
- `npm run build` green.
- For visual items: render with real tokens in full page context (headless Chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`), light AND dark.
- Em-dash scan clean.

### Baseline sim snapshot (current `main`, for regression comparison)

```
verdict mix:   hit 20.5% · solid 26.4% · steady 52.0% · flop 1.0%
bankruptcies:  0/40
net worth:     median ~$1.77B · CV 5.3% · p90/p10 1.15x
eras reached:  40/40 reach era 4 + IPO; era arrivals wk67 / wk117 / wk225
era-1 score:   p10 16 · p50 18 · p90 21   (bands flop 10 / solid 45 / hit 70)
```

---

## Phase A: Bug hardening (do first, all small, derisks everything)

No confirmed run-ending bugs exist (the codebase is well guarded). These are the real edge cases.

### B1: Quota-fallback save keeps the WRONG products and warns no one  `[data-loss · S · HIGH]`
- **Problem:** When an autosave hits `QuotaExceededError`, the only fallback writes a trimmed state
  to the LIVE save key, trimming `launched` to `slice(0, 12)`, which keeps the 12 OLDEST products and
  drops the recent ones that are still selling (and their ongoing sales/ecosystem revenue). A
  successful trimmed write fires no warning, and there is no backup of the pre-trim state. On a long
  late-game run under storage pressure (most likely iOS WKWebView), this is silent progression loss.
- **Where:** `src/state/persistence.ts`, the `trimState` helper and the quota-retry path (approx
  L70-77 for the retry, plus the `trimState` definition).
- **Plan:**
  1. Change the `launched` trim to keep the MOST RECENT and still-selling products, not the oldest:
     prefer products where `weeksElapsed < weeklyUnits.length` (live), then most-recent by
     `launchedWeek`, capped at the same count. Keep the count generous (e.g. 24) since the trim is
     about bytes, and the launched array's heavy field is `weeklyUnits`; consider trimming
     `weeklyUnits` history on FINISHED products instead of dropping whole products.
  2. Surface a one-time, non-spammy warning toast/feed line when a trimmed write succeeds ("Storage
     is full; older finished products were summarized to keep your save").
  3. Optional: before the destructive trim, attempt a single compaction pass (drop `cashHistory` to
     1 entry and `feed` to 20, which the code already does) WITHOUT dropping products, and only drop
     products if that still fails.
- **Tests:** extend `persistence.test.ts` (the existing quota-fallback test): assert the kept set is
  the most-recent/live products, and that finished-product trimming preserves `unitsSold`/`revenueToDate`.
- **Risks:** persistence is protected; keep the change additive and pin behavior with the test. Do not
  alter the happy-path save.
- **Depends:** none.

### B2: Harden the missing-`stats` backfill to prevent latent NaN  `[crash-latent · S · LOW]`
- **Problem:** A migrated launched product missing `stats` is backfilled to `{}`. Today both readers
  survive it (ecosystem tick is gated by `eco > minStat`; price-cut `priceFit({})` is saved by an
  `oldFit > 0 ? : 1` guard), but any future read of `lp.stats.<key>` without a guard pushes NaN into
  demand/cash.
- **Where:** `src/state/persistence.ts` (approx L487, the `stats` backfill).
- **Plan:** backfill to a zeroed full `Stats` object (every `StatKey` set to 0) instead of `{}`. Use
  the `STAT_KEYS` list from `engine/types.ts`.
- **Tests:** add a migration test that a product missing `stats` loads with a full zeroed Stats and
  that `priceFit`/ecosystem reads stay finite.
- **Risks:** trivial; additive.
- **Depends:** none.

### B3: `projectById` should not hard-crash on an unknown id  `[crash-latent · S · LOW]`
- **Problem:** `RESEARCH_PROJECTS.find(...)!` throws if an id is ever absent (a future content/gate
  pointing at a non-existent project). The Research screen error boundary contains it, but it is a
  sharp edge.
- **Where:** `src/engine/research.ts` (approx L95).
- **Plan:** return a safe fallback or make callers handle `undefined`. Prefer changing the signature
  to `ResearchProject | undefined` and fixing the few call sites to guard, OR keep the assertion but
  add a dev-only `console.warn`-free invariant. Simplest safe move: `?? RESEARCH_PROJECTS[0]` is wrong
  (masks bugs); instead return `undefined` and guard the ~3 callers.
- **Tests:** unit test `projectById("bogus")` does not throw.
- **Risks:** touching engine; keep additive and update callers.
- **Depends:** none.

### B4: Two corrupted-save-only render landmines in DesignLab  `[crash-latent · S · LOW]`
- **Problem:** `DesignLab.tsx` renders `NaN%` if `totalWeeks === 0` (cosmetic; only via hand-edited
  save), and `FINISHES[finishLimit + 1]` would throw if `finishLimit > 3`. Both are gated today but
  unguarded in the render.
- **Where:** `src/screens/DesignLab.tsx` (approx L516 for the percent, L971-983 for the finish index).
- **Plan:** clamp the percent denominator (`Math.max(1, totalWeeks)`) and bound the finish index
  (`FINISHES[Math.min(finishLimit + 1, FINISHES.length - 1)]` with a null check).
- **Tests:** none required (defensive); a quick render assertion is optional.
- **Risks:** none.
- **Depends:** none.

**Phase A commit plan:** one commit (all four are tiny hardening), or B1 alone + B2-B4 together.

---

## Phase B: Instrumentation (unblocks the balance phase)

### L5: Add a hiring/scaling auto-player profile to the sim harness  `[investigation · S-M · MED]`
- **Problem:** The harness auto-player builds only phones and never hires, trains, takes loans, runs
  HR/morale/poaching, acquires rivals, or lists. So the entire staff/financing/M&A surface (a large
  fraction of `balance.ts` and the screens) is UNMEASURED. We cannot responsibly tune L3 (failure
  pressure) or judge whether those subsystems are dead without this.
- **Where:** `scripts/balance-sim.mjs`.
- **Plan:**
  1. Add a second auto-player profile ("scaler") that hires up to facility capacity, assigns staff to
     disciplines, trains toward leads, optionally takes one loan when runway is short, and uses the
     delegation automations once unlocked. Keep the existing "founder" profile as the baseline.
  2. Report both profiles side by side: bankruptcies, net-worth distribution, runway trough, payroll
     vs income, and whether the scaler OUTPERFORMS the founder (if not, staff scaling is not
     load-bearing, which is itself the finding).
  3. Add a per-subsystem "did it ever matter" readout where cheap (e.g. did any loan change the
     outcome; did HR prevent a quit that would have happened).
- **Tests:** the sim is a script, not unit-tested; just ensure `npm run sim` still runs and prints
  both profiles deterministically.
- **Risks:** none to the game (script only). Keep it deterministic (seeded), no `Math.random`.
- **Depends:** none. **Blocks:** L3, and informs L4/D6 and the "dead subsystem" question.

---

## Phase C: Make launches actually win and lose (balance core)

Do these together and re-run the sim after each; they interact. Tune `balance.ts` only.

### L1: Era-1 launches can only ever be "steady"  `[balance · S · HIGH]`
- **Problem:** Era-1 achievable effectiveScore is p10 16 / p50 18 / p90 21, but the bands are flop 10
  / solid 45 / hit 70. The whole achievable range sits in the dead zone, so all 777 era-1 launches in
  the sim are "steady". A new player's first ~67 weeks get zero verdict feedback.
- **Where:** `src/engine/balance.ts`, `reputation.solidThresholdByEra[0]` (and sanity-check
  `hitThresholdByEra[0]`).
- **Plan:** lower `solidThresholdByEra[0]` from 45 toward ~20-22 so a genuinely good first product can
  land "solid", while a mediocre one stays "steady" and a bad bet can still flop (the flop floor of 10
  is correctly tuned). Optionally nudge `hitThresholdByEra[0]` down a touch so a near-perfect early
  product can rarely hit, but keep era-1 hits rare.
- **Tuning/verify:** after the change, the sim era-1 band should show a spread across flop/steady/solid
  (target rough mix like flop ~3-5% / steady ~55-65% / solid ~30-40% / hit ~0-3%), not 100% steady.
- **Tests:** there may be a `lateGame`/`tuning` test asserting band ordering; update expected era-1
  bands if pinned. Add a test that an above-average era-1 product scores into "solid".
- **Risks:** over-lowering makes every first product "solid" (removes the climb). Tune to the measured
  p50/p90, not to taste.
- **Depends:** none (but pairs with L2).

### L2: Flops are ~1% of all launches (the downside half of the bet barely exists)  `[balance · S-M · HIGH]`
- **Problem:** flop rate is 1.0% across all eras; flop floors `[10, 21, 27, 35]` sit far below each
  era's achievable p10 (16 / 26 / 111 / 132). A competent player essentially cannot fail a launch,
  which removes the "real bets that can fail" pillar.
- **Where:** `src/engine/balance.ts`, `reputation.flopThresholdByEra`.
- **Plan:** raise each era's flop floor toward (but below) that era's measured p10, so a poorly
  positioned, overpriced, or heavily contested launch can actually flop, while a competent one does
  not. Move incrementally and re-sim; target a flop rate in the ~5-10% range overall, concentrated on
  genuinely bad bets, not random good ones.
- **Tuning/verify:** re-sim; watch that bankruptcies stay near 0 for competent play (we are adding
  downside to BAD launches, not bankrupting good players), and that the verdict mix gains a real flop
  slice without flipping steady/solid.
- **Tests:** update the verdict-band tests; add a test that an overpriced/contested product flops in
  era 2+.
- **Risks:** raising too far punishes normal play and spikes bankruptcies. Do it alongside L1 and with
  the sim open.
- **Depends:** pairs with L1; re-sim after both.

### L3: No failure pressure anywhere (0/40 bankruptcies, 167-week starting runway)  `[balance · M · HIGH]`
- **Problem:** a solo founder carries ~$120/wk burn against $20k start and never goes negative; the
  "tighter early economy" comments are aspirational. The game cannot be lost.
- **Where:** `src/engine/balance.ts`: `startingCash`, `facilities[0].weeklyRent`, `build.toolingUnits`,
  `build.safetyReserveMargin`, `sales.floorUnits`.
- **Plan:** ONLY after L5 lands (so the scaler profile shows the effect on a hiring company). Then
  tighten the early economy modestly: slightly lower starting runway and/or raise per-product tooling
  so a flop actually stings, such that an early bad bet can threaten the run without making the
  intended first product a guaranteed loss. Move one lever at a time and re-sim.
- **Tuning/verify:** target a non-zero but small early-bankruptcy rate for RECKLESS play (e.g. a few %
  of seeds when over-producing a weak product), with competent play still surviving. Keep 40/40
  reaching the win for competent play.
- **Tests:** the early-economy is pinned by `tuning`/`lateGame` tests; update expectations carefully.
- **Risks:** highest-risk balance item; an over-tighten makes the early game feel punishing (the exact
  thing prior tuning fixed). Conservative, sim-driven, reversible steps only.
- **Depends:** L5 (instrumentation), and best done after L1/L2 so verdicts already carry stakes.

---

## Phase D: Readable simulation (surface the "why" the engine already computes)

These are mostly presentation: the reasoning data already exists; show it where the player decides or
feels the outcome. Low engine risk. Group by surface; each is independently shippable.

### C1: News-feed events show their magnitude  `[clarity · S · HIGH]`
- **Problem:** a supply crunch deducts $8k-$90k, a windfall adds $200k, press adds reputation, but the
  feed line is pure flavor, so the player sees cash jump and cannot attribute it.
- **Where:** `src/state/gameState.ts` `applyEventEffect` (the realized `scaledCash`/`eff.cash`/
  `eff.fans`/`eff.rep` deltas are in scope, approx L1672); rendered in `HQ.tsx` FeedCard (approx L1203).
- **Plan:** append the realized delta to the feed text (formatted money/rep/fans), e.g. "Supply crunch:
  -$42,500". Keep the engine pure: compute the string in the engine where the delta is known, or pass
  the delta on the feed item and format in the UI. Prefer storing a structured delta on the feed item
  (optional field, golden-invariant safe) and formatting in the UI.
- **Tests:** engine test that an event feed item carries the correct signed delta.
- **Risks:** golden invariant: the feed item gains an OPTIONAL field; old saves unaffected.
- **Depends:** none.

### C2: Launch reveal shows the postmortem "why"  `[clarity · S-M · HIGH]`
- **Problem:** `postmortem.ts` computes a headline + decisive factors, but the keynote `LaunchReveal`
  (the emotional peak) shows only units/score/verdict; the "because" is buried in the Market detail
  sheet most players never open.
- **Where:** `components/LaunchReveal.tsx` (VERDICT_COPY approx L16, verdict block approx L125);
  data from `engine/postmortem.ts`. The launch path that builds `LaunchRevealData`.
- **Plan:** pass the postmortem headline (and maybe the top 1-2 drivers) into `LaunchRevealData` and
  render a single line under the verdict ("Won on Design + price; hurt by 1 stronger rival"). Keep it
  one tasteful line; do not crowd the reveal.
- **Tests:** the postmortem is pure and tested; add a test that the reveal data carries the headline.
- **Risks:** visual; render-verify the reveal in context (it animates). Keep copy short.
- **Depends:** none.

### C3: Quit message stops always blaming "burnout"  `[clarity · S · MED]`
- **Problem:** mood can be low purely from underpay, yet the feed always says "sustained burnout
  pushed them to leave", contradicting the "Wants raise" tag the player saw.
- **Where:** `src/state/gameState.ts`, the churn/quit feed line (approx L1442); the `isUnderpaid` flag
  is computed two lines above.
- **Plan:** branch the message on `isUnderpaid` (and/or the dominant negative mood driver): "left for
  better pay" vs "left from burnout". Pure engine copy change.
- **Tests:** engine test: an underpaid quitter yields the pay message, a burned-out one the burnout
  message.
- **Risks:** none.
- **Depends:** pairs naturally with C5 (mood driver computation).

### C5: Per-staff mood shows its dominant cause  `[clarity · M · MED-HIGH]`
- **Problem:** the mood bar shows the level, never the cause (underpay, cash drop, office comfort,
  recent flop, trait), so the player cannot tell which fix (Raise vs Rest vs office vs ship a hit) applies.
- **Where:** `src/screens/Company.tsx` `Member` (approx L1173); the mood-target inputs are computed in
  the weekly tick in `gameState.ts`.
- **Plan:**
  1. In the engine, expose a small pure helper that returns the dominant negative mood driver for a
     staff member given current state (underpaid / cash-dropping / low office comfort / recent flop /
     hustler trait). Reuse the same inputs the tick uses so it cannot drift.
  2. Render a one-line reason under the mood bar ("Underpaid vs market" / "Morale dip after a flop").
- **Tests:** engine test for the dominant-driver helper across cases.
- **Risks:** keep the helper pure and consistent with the tick; if the tick logic changes later, the
  helper must track it (consider deriving both from one shared function).
- **Depends:** shares logic with C3.

### C4: Tag "Selling now" rows with their lifecycle/pressure state  `[clarity · M · HIGH]`
- **Problem:** a hit melting shows only $/wk + an arrow, with no "Peaking / Declining / Rival
  pressure". `rivalEntrySalesHaircut` and the decay curve drive it invisibly.
- **Where:** `src/screens/Company.tsx` "Selling now" (approx L254); `engine/salesCurve.ts` for the
  slope; the rival-entry haircut flag on the launched product.
- **Plan:** derive a one-word state from the curve slope at `weeksElapsed` (Ramping / Peak / Declining)
  and whether a rival-entry haircut recently applied (Contested). Show it as a small tag on each row.
  Add a pure helper in `salesCurve.ts` for the phase.
- **Tests:** engine test mapping `(weeklyUnits, weeksElapsed)` to a phase.
- **Risks:** if the rival haircut is not currently recorded on the product, store it as an optional
  field at launch/haircut time (golden-invariant safe).
- **Depends:** none.

### C6: Reconcile forecast vs actual on the result  `[clarity · M · MED-HIGH]`
- **Problem:** the wizard promises a demand range; the result shows the actual in isolation, never
  "within forecast" / "below, competition was stiffer", so the player cannot tell if their read was good.
- **Where:** the wizard review in `DesignLab.tsx` (range from `engine/forecast.ts`) to
  `components/LaunchReveal.tsx` / Market result. The `BuildJob`/`LaunchedProduct` types in
  `engine/types.ts`.
- **Plan:**
  1. Stash the forecast band (low/high/confidence) on the `BuildJob` at build time and carry it onto
     the `LaunchedProduct` (optional fields, golden-invariant safe).
  2. On the launch reveal/result, compare actual first-week (or projected total) vs the band and show
     "Within forecast" / "Above" / "Below: contested" using the existing competition flags.
- **Tests:** persistence/migration safe (optional fields); engine test for the comparison helper.
- **Risks:** touches the launched-product schema additively; keep optional.
- **Depends:** relates to Q5 (same band data on the ReadyToLaunch popup).

### C7 + C9: Show segment + competition read WHILE designing (not just post-commit)  `[clarity · M · HIGH]`
- **Problem (C9/O1, the highest-leverage clarity item):** the segment "who is it for" breakdown +
  competition readout only appear in the wizard REVIEW step, after the design is locked. The player
  tweaks a chip tier or price and sees no "this just lost the Style segment / priced out Budget /
  2 rivals now beat your tier" until they have committed.
- **Where:** `src/screens/DesignLab.tsx` `SegmentBreakdown` (approx L76-128, currently only in the
  wizard review approx L1921); the Components/Style/Camera/Launch tabs show only a summary card.
  `segmentDemand` (pure) and the match/beat counts in `planProduction` (`gameState.ts` approx L986-1011).
- **Plan:**
  1. Surface a compact, live-recomputed preview in the Launch tab (and ideally a tiny inline hint when
     a tier/price change flips a segment): top segment, weakest segment, the single biggest win/lose
     reason, and "Rivals matching your tier: N, beating you: M".
  2. Recompute on every design change using the existing pure selectors. Throttle/memoize so it does
     not recompute on every render frame.
- **Tests:** the selectors are pure and tested; add a component-level smoke if practical.
- **Risks:** performance (recompute on slider drag): memoize on the design inputs. Keep the panel
  compact (RULE #1, do not crowd the tab).
- **Depends:** none; this is the backbone clarity change and makes D1/D2/D3 legible.

### C8: Trend-direction arrows per category  `[clarity · M · HIGH]`
- **Problem:** onboarding + coach stress "launch before the trend shifts", but designing shows only a
  current snapshot, so the timing game has no instrument.
- **Where:** the trend model in `engine/market.ts` (trend drift); surface in `DesignLab.tsx` category
  picker and `Market.tsx`.
- **Plan:** expose a pure "trend direction" per category (rising / flat / cooling) from the drift
  model (compare current weight vs target, or recent delta). Render a small arrow next to each
  category in the picker and on the Market tab.
- **Tests:** engine test for the direction helper.
- **Risks:** the direction must be honest (match the model that actually drives demand), else it
  teaches the wrong read.
- **Depends:** none.

**Phase D notes:** C1, C3 are pure-engine + copy (smallest). C2, C4, C7/C9, C8 are the highest player
value. Each is its own commit.

---

## Phase E: Real decisions (depth: convert "max everything" into choices)

The root cause both depth audits found: no choice locks out another, so optimal play is "buy the
highest tier you can afford and ship every proven winner." These add genuine tradeoffs. Engine-first.

### D1: Tradeoff component tiers (the single highest depth-per-effort change)  `[depth · S-M · HIGH]`
- **Problem:** every component line is a strict power ladder (more stats, more cost, no downside), so
  the core design loop is "max everything", not a decision. `componentSynergy` only penalizes mismatch;
  it never makes a lower tier the right pick.
- **Where:** `src/engine/catalogs.ts` (component tier definitions); `src/engine/product.ts`
  `componentSynergy` (approx L197-218); the segment model in `engine/segments.ts` already rewards
  different stat mixes per segment.
- **Plan (pick one, prefer the first):**
  - **Option A (sidegrades):** add 1-2 sidegrade tiers per key line that spend one stat for another at
    similar cost (chip: +performance/-battery; battery: +battery/-design; display: +quality/-cost).
    The multi-stat `contributes` already supports negative contributions. This makes "which tier fits
    my target segment" a real question rather than "the highest I can afford".
  - **Option B (mismatch multipliers):** a small `TIER_SYNERGY` table so a maxed chip paired with a
    budget display wins Pro buyers but loses Style/Budget harder, so a balanced mid-tier build can beat
    a lopsided flagship for the right segment.
- **Tuning/verify:** add a sim harness variant (or extend L5) that sets a non-trivial tier mix and
  confirm no single tier dominates across segments. The existing `balanceGuards`/`tuning` tests pin the
  "no universal recipe" property; extend them.
- **Tests:** engine tests that a sidegrade changes the winning segment; that the optimal build differs
  by target segment.
- **Risks:** could unbalance the launch economy; sim-verify. Keep magnitudes modest (tie-breaker
  strength), per the existing tuning philosophy.
- **Depends:** reads best with C7/C9 (so the player SEES the segment tradeoff while choosing).

### D2: Segment-affinity marketing channels  `[depth · S-M · MED-HIGH]`
- **Problem:** seven channels are a linear cost-to-hype ladder, so you buy the most expensive
  affordable one. No "read your audience" decision.
- **Where:** `src/engine/marketing.ts` (channel defs + effect); `engine/segments.ts`.
- **Plan:** give 2-3 channels a segment affinity (Influencer to Youth, TV to Mainstream, Billboards to
  Premium) so a channel amplifies hype/reach for its segment and is weaker elsewhere. The launch then
  rewards matching the channel to the product's target segment.
- **Tuning/verify:** sim variant that picks a channel matched vs mismatched to the build; confirm
  matched beats mismatched but neither dominates universally.
- **Tests:** engine test for channel affinity effect by segment.
- **Risks:** keep bounded so a mismatched channel is suboptimal, not useless.
- **Depends:** synergizes with C7/C9 (segment legibility) and D1.

### D3: Brand widens the acceptable price band  `[depth · M · MED-HIGH]`
- **Problem:** pricing is cost-plus with a shown band, so the optimal move is "price near the top";
  reputation/fans do not pay off at pricing time.
- **Where:** `src/engine/market.ts` `priceFit`; tunables in `balance.ts`.
- **Plan:** let reputation and/or fan ratio widen the price tolerance so a strong brand can sustainably
  overprice (a real premium-brand strategy), while a weak brand gets punished for the same price. Add a
  bounded brand term to the price-fit tolerance.
- **Tuning/verify:** sim with high vs low rep; confirm a strong brand can price higher for more
  margin without breaking demand, bounded so it is never a free money printer.
- **Tests:** engine test that priceFit tolerance scales with reputation/fans within bounds.
- **Risks:** late-game rep is ~97 in the sim (see L4/L1), so an uncapped brand term compounds the
  "solved" problem. Cap it and re-sim.
- **Depends:** interacts with L4 (late-game convergence) and L1 (rep dynamics).

### D5 (O8): Rival-doctrine counters (make the rich rival AI actionable)  `[depth · M · MED]`
- **Problem:** rivals have doctrines (defender / trend-chaser / undercutter / generalist), arcs, and
  reactive strength, but their strength is capped below a maxed player's score, so late-game they are a
  tax, not a threat, and their doctrine never changes how YOU build. All doctrines get the same counter
  (max specs).
- **Where:** `src/engine/competitors.ts` (advance/arcs); the match/beat count in `planProduction`
  (`gameState.ts` approx L986-1011); caps in `balance.ts` (`reactMaxStrengthByEra`, `lateStrengthByEra`).
- **Plan:** add doctrine-specific counter-bonuses to the PLAYER's launch when they position against a
  rival's doctrine (undercut a defender with a cheaper build; go premium against an undercutter;
  out-time a trend-chaser). Wire into the existing match/beat computation. Surface the rival doctrine
  in the design/market UI (ties to C7/C9) so the read is actionable.
- **Tuning/verify:** sim variant that reacts to rival doctrine; confirm the counter is a real edge,
  not mandatory, and does not break winnability.
- **Tests:** engine test for the counter-bonus by doctrine/positioning.
- **Risks:** prefer counter-bonuses over relaxing the strength cap (raising the cap risks winnability).
- **Depends:** C7/C9 (so the player can read the doctrine).

### D6 (O6/O7): Turn linear upgrade/research ladders into identity forks  `[depth · M · MED]`
- **Problem:** office upgrades (`upgrades.ts`, 6 monotonic lines) and most research (`research.ts`, ~20
  independently-bought projects + 3 too-weak engineering doctrines) are "buy everything eventually";
  endgame = all maxed = solved.
- **Where:** `src/engine/upgrades.ts` (lines + gates); `src/engine/research.ts` (projects + the
  `engDoctrine` fork).
- **Plan (two independent sub-items):**
  - **Upgrades:** add an office-identity constraint or synergy, e.g. only N lines may exceed tier 3
    (forcing a "Research+Marketing" vs "Quality+Speed" shop), OR a pairwise synergy so specializing
    2-3 lines beats spreading evenly. Makes early prioritization permanently matter.
  - **Research doctrine teeth:** give the chosen engineering doctrine a cascading effect (a hype/segment
    multiplier when a product's component mix aligns with the doctrine), converting a static +5 into a
    company-identity decision.
- **Tuning/verify:** sim with different specializations; confirm a specialized build path is
  competitive with (not strictly worse/better than) spreading.
- **Tests:** engine tests for the cap/synergy and the doctrine cascade.
- **Risks:** the identity cap is a player-facing constraint; make it legible (the UI must explain why a
  line is capped). Keep doctrine teeth bounded.
- **Depends:** none hard; benefits from L5 (to measure).

**Phase E notes:** D1 first (it makes everything downstream matter), then D2/D5 (decisions that read
off segments/rivals), then D3/D6. Each is engine-first with a sim check.

---

## Phase F: Quality of life (reduce friction, teach the game)

### Q1: "Repeat last plan" / seed the build wizard from the previous build  `[qol · S-M · HIGH]`
- **Problem:** the most-repeated workflow re-asks run size + marketing channel for every product, even
  a proven sequel. `successorDraft` deliberately clears `channelId`/`plannedUnits`.
- **Where:** `src/screens/DesignLab.tsx` `BuildWizard` (approx L1636), `successorDraft` (approx L207).
- **Plan:** seed `channelId` and `plannedUnits` from the previous build of the same line/category
  (regions already seed this way), and add a "Repeat last plan, Build" shortcut button that skips
  straight to confirm. Keep the wizard available for when they want to change it.
- **Tests:** component/state test that a successor seeds the prior plan.
- **Risks:** none; keep it a default the player can override.
- **Depends:** none.

### Q2: Always-available one-tap "assign idle to best-fit"  `[qol · M · HIGH]`
- **Problem:** per-staff assignment does not scale; by era 3-4 with 8-10 staff every new hire is
  hand-assigned, and the full automation is gated behind a research project + specialist hire.
- **Where:** `src/screens/Company.tsx` roster header / `Member` (approx L1130); `bestFitAssign` math
  already exists (the delegation `autoAssignIdle` / discipline logic).
- **Plan:** add an always-available header button that assigns all idle staff to their best-fit
  discipline once (a single manual action, distinct from the gated continuous automation). Reuse the
  existing best-fit selector.
- **Tests:** state test that the action assigns idle staff and is a no-op when none are idle.
- **Risks:** keep it a one-shot manual action so it does not undercut the premium gated automation
  (which is continuous + free of taps).
- **Depends:** none.

### Q3 (O2/O3): First-design literacy + archetype/segment hint  `[onboarding · M · HIGH]`
- **Problem:** the first design is a blind guess; the coach describes the flow, not the stakes, and the
  player is never told what makes a good spec.
- **Where:** `src/screens/DesignLab.tsx`, `components/Coach.tsx`; `engine/archetype.ts` +
  `engine/segments.ts` already compute the archetype/segment fit.
- **Plan (small, layered):**
  1. One-line subhead above the tab strip ("Pick parts, refine the look, configure camera, forecast
     and build").
  2. First-visit-only hint on Components ("Higher tiers boost stats and cost more, balance against
     your price").
  3. On the FIRST design only, surface one archetype + segment hint ("Reads as a balanced mid-ranger;
     Mainstream buyers want this"). Do not duplicate the post-tutorial NextMoveCard ladder.
  4. One line on the Launch tab explaining ecosystem ("Ecosystem drives recurring services income from
     devices in the field; build it via the Software tier and the Platform division").
- **Tests:** none required (copy/first-visit gating); keep the first-visit flag in state optional.
- **Risks:** do not nag (first-visit only); keep copy tight.
- **Depends:** reads better after C7/C9 (live segment preview).

### Q4: Give the speed control one persistent home  `[qol · M · MED]`
- **Problem:** Pause/Fast live in the top HUD during the tutorial, then move to a floating bottom-right
  SpeedDial, and vanish on the Design tab. A player who learned "speed is top-right" loses it.
- **Where:** `components/Hud.tsx`, `App.tsx` (approx L128), the `SpeedDial`.
- **Plan:** pick one persistent home (the thumb-reachable dial is the better mobile choice) and keep it
  present on every screen including Design. Remove the relocation.
- **Tests:** none (layout); render-verify on each screen in context.
- **Risks:** ensure it does not collide with the bottom nav / other floating controls; render-verify.
- **Depends:** none.

### Q5: ReadyToLaunch one-tap popup shows the demand range + confidence  `[qol · S-M · MED]`
- **Problem:** the one-tap launch popup shows point estimates, losing the demand range + confidence
  label the wizard showed, so "Est. sales 40,000" reads as a promise variance will break.
- **Where:** `components/ReadyToLaunch.tsx` (approx L120); the plan/forecast band is already computed.
- **Plan:** reuse `forecastBand` + confidence label here (show "~36k-44k, high confidence" not a single
  number). Ties to C6 (same band data).
- **Tests:** none required; the band is computed.
- **Risks:** keep the popup compact.
- **Depends:** shares band plumbing with C6.

### Q6: Surface Platform/ecosystem install-base + licensing revenue in the main Finance view  `[qol · M · MED-HIGH]`
- **Problem:** the Platform division (a $250k investment with real annuity revenue) is a sub-sheet
  inside the Finance tab, and the ecosystem stat barely visibly drives anything, so the best latent
  system is buried.
- **Where:** `engine/platform.ts`, `screens/Platform.tsx`, `screens/Company.tsx` (Finance view).
- **Plan:** surface the install base + weekly licensing/services revenue as a growing number in the
  main Finance view (not hidden in a sub-sheet), to pull players toward the system. Pure presentation
  of existing computed values.
- **Tests:** none required.
- **Risks:** do not crowd the Finance view; one clear line/stat.
- **Depends:** benefits from O3's ecosystem hint (Q3).

---

## Phase G: Bigger bets (do last, each is a project with a playtest)

### L4: Late game is "solved" (every run ends within ~15% of the same net worth)  `[balance · L · HIGH]`
- **L5 FINDINGS (now instrumented, do NOT re-diagnose from the single-profile CV):** the harness runs
  five strategy profiles. The old ~5% CV was RNG noise of ONE playstyle; the real picture across
  strategies (post D1/D2/D3/D5/D6):
  - `balanced` (max tiers, fair price): 40/40 win, ~$1.87B, 24% hits; the dominant recipe.
  - `premium` (overprice ~1.28x, event): 40/40 win, ~$1.16B, ALREADY a viable, divergent alternative.
  - `value` (cheaper build + undercut): 40/40 BANKRUPT, non-viable (lower stats AND thin margin).
  - `specialist` (lopsided Pro + Performance house): 0/40 win, ~$0.23B, survives, never competitive.
  - `reckless` (over-produce 1.9x): 40/40 BANKRUPT, confirms real failure pressure (see L3).
- **Reframed problem:** it is NOT "every run ends the same", it is "broad-market VOLUME (balanced
  maxing) dominates; niche/margin strategies can't offset lost breadth." `premium` already diverges
  and wins; the open work is making `value` + `specialist` winnable-but-different.
- **Direction (playtest-gated, next dedicated pass):** a compounding economy axis, NOT another
  per-launch bolt-on. Best candidates from the data: (a) per-category demand SATURATION so a broad
  maxer hits diminishing returns and diversification/specialization pays; (b) price-insensitive niches
  (Pro/Enterprise) carrying materially higher per-unit value so dominating 15% at high margin ~
  competing broadly. Prototype in the harness FIRST; ship only if `value`+`specialist` reach the win
  while `balanced` stays 40/40 and the L1+L2 verdict spread holds.

- **Problem:** net-worth CV 5.3%, p90/p10 1.15x. The verdict-layer divergence landed (eras 3/4 have
  real per-launch spread), but the MACRO outcome still converges: ~119 launches/run average each
  other's variance away and competition recovers identically every seed.
- **Where:** systemic: `balance.ts` (`eraModifiers`), `competitors.ts`, the growth curve in the launch
  economy. Likely needs a NEW divergent, COMPOUNDING strategic axis (category specialization that
  changes the growth curve, or a fork that alters the rate of growth, not just per-launch stats).
- **Plan:** design a compounding divergence (candidates: per-category demand saturation that rewards
  diversification differently per seed; a specialization fork that changes the growth curve; an
  ecosystem/platform path that compounds installed base). Prototype in the sim FIRST; only ship if CV
  meaningfully rises while keeping 40/40 winnable.
- **Tests:** sim-measured CV increase; engine tests for the new axis.
- **Risks:** large; can destabilize the whole economy. Sim-driven, behind the L5 harness, last.
- **Depends:** L5; informed by D1/D6 (the divergence may come from the depth items compounding).

### D4 (O9): Per-era distinct mechanic (each era plays differently, not just bigger)  `[depth · L · MED]`
- **Problem:** eras shift pacing/economics but not the decision loop; era 4 is the era 1 loop with
  bigger numbers.
- **Where:** `engine/eras.ts` `eraModifiers`/`eraRuleSummary`; the launch path.
- **Plan:** add one era-gated investment fork that introduces a new recurring verb (e.g. an era-3
  "ecosystem suite" bonus for shipping 2+ aligned categories, or an era-4 RP-gated capability products
  are penalized for lacking unless deliberately positioned). Forces a per-era strategy pivot.
- **Tests:** engine tests for the era-gated mechanic; sim for balance.
- **Risks:** reshapes the per-era economy; full playtest needed. Largest depth item; do after the
  Phase E forks prove out.
- **Depends:** L4 direction (they may be the same axis).

---

## Suggested execution order (impact-per-effort, dependency-aware)

1. **Phase A** (B1, B2, B3, B4): one or two small commits, derisks the save path.
2. **L5**: instrument the sim (unblocks balance).
3. **L1 + L2**: make verdicts carry stakes (small, high value, re-sim together).
4. **C1, C3**: pure-engine clarity (feed magnitudes, quit reason).
5. **C7/C9**: live segment + competition preview (the clarity backbone that makes depth legible).
6. **C2, C4, C8**: launch-reveal "why", selling-now state, trend arrows.
7. **D1**: tradeoff component tiers (the depth keystone).
8. **Q1, Q2, Q3**: kill the top friction + teach the game.
9. **D2, D5**: channel affinity + rival counters (decisions that read off C7/C9).
10. **C5, C6, Q5, Q6, Q4**: remaining clarity + QoL.
11. **D3, D6**: brand price band + upgrade/research forks.
12. **L3**: failure pressure (after L5, after verdicts carry stakes).
13. **Phase G** (L4, D4/O9): the bigger bets, sim-prototyped first.

The "owner recommended starter batch" (a tight, high-impact slice): **B1, L1, L2, D1, C1, C2, C7/C9,
Q1**. That fixes the one real data-loss path, makes launches win/lose, turns the design loop into a
real choice, and makes the game tell you why, while killing the most-repeated friction.

---

## Notes on what NOT to do (verified non-issues, do not "fix")

- The early game is not stalled (start cash $20k, garage rent $120/wk, era-1 flop floor 10 are tuned
  so a competent first product lands "steady", not "flop").
- Relaunch-spam and under-produce-to-farm-fans are already closed (`selfPenalty`, novelty fatigue,
  `preOrderCap`, `selloutMinDemandShare`). Do not regress these when touching the launch economy.
- The ecosystem rate is already fixed (0.05, a real annuity); the issue is legibility (Q6), not the rate.
- The post-tutorial NextMoveCard objective ladder already answers "what do I do next"; do not rebuild it.
- Company week labels, Platform progress width, and the furniture-counter selection were audited and
  are correct; do not "fix" them.
