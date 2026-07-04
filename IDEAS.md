# Silicon: Tech Tycoon — Game Design & UX Review

Senior game-designer + UX-reviewer pass over the shipped repo (v1.0.2 era, post-v56 +
DEPTH_PLAN Tracks A–D). Grounded in a full read of DEV.md / TASK.md / LEARNINGS.md and a
code-level sweep of `src/engine/`, `src/state/`, `src/screens/`, `src/components/`.
Everything is ranked by impact/effort. No code was changed; this document is the deliverable.

**Honest headline first:** the simulation depth and the "readable sim" layer are genuinely
best-in-class for mobile tycoon — the verdict/postmortem/forecast stack, the balance-sim
harness discipline, and the parametric device toy are real moats. The weaknesses are not in
the systems; they are in the *seams*: the first 15 minutes front-load too much, the game
never tells a lapsed player to come back, several rich systems are mechanically inert or
invisible, and a handful of core actions still resolve silently. Those seams are exactly
where first-session conversion and day-7 retention leak.

---

## 1. FRICTION AUDIT — the player journey

### Minute 0–5: first launch → first design

| # | Friction | Where | Severity |
|---|----------|-------|----------|
| F1 | **Onboarding promises "Read the market" and never delivers.** The 3-step explainer (Design / Read the market / Reinvest) is the player's mental contract, but the Coach teaches only design→build→launch. The Market tab is never mentioned by any guidance. The second pillar of the pitch is untaught. | `App.tsx:398`, `Coach.tsx:52-95` | High |
| F2 | **The player is dropped into the deepest screen first.** `found()` jumps straight to the Design Lab: 4 tabs, unset component steppers (build blocked until every slot is picked), tuning axes, refresh/storage/camera specs — *and supply-chain controls (supplier, dual-source, contracts, factory) sitting inside the Components tab*, which silently move unit cost and are never flagged as optional-advanced. Progressive disclosure (v42) gated the meta layer well but never reached inside the Design Lab itself. | `DesignLab.tsx:159-164, 813-905` | High |
| F3 | **The wizard Review step is a wall of ~15 stat rows** (demand fit, price fit, competition, balance, cannibalization, fatigue, sourcing, factory, …) shown on the very first build, before any of these terms have been taught. The glossary exists but is elsewhere. First-build Review should be a progressive subset. | `DesignLab.tsx:1868-1922` | High |
| F4 | **Two price vocabularies one screen apart.** The Launch tab prices with `priceGuidance` zones (Underpriced / Good value / Fair / Premium / Overpriced); the wizard Review re-derives price fit from a *different* ratio with *different* labels ("Overpriced −X% / On the money / Value buy"). Same concept, two models, adjacent steps — the exact "wait, which is right?" moment a readability-first game can't afford. | `DesignLab.tsx:287` vs `:1707-1712` | Medium |
| F5 | **Shipped layout bug on the flagship screen:** `.lab__hero-grid` is declared twice in `designLab.css` (layout grid ~L121 AND absolute dot-texture backdrop ~L138); the absolute leaks onto the layout grid so at the app's 540px max width (iPad / web / wide phones) the Design Lab hero overlaps the Category selector. Known and logged in TASK.md's backlog since the screenshot pass — only worked around in the capture scripts, never fixed in source. | `screens/designLab.css` | High |

### Minute 5–30: first build → first launch → first verdict

| # | Friction | Where | Severity |
|---|----------|-------|----------|
| F6 | **Flop attribution is off-screen at the moment it matters most.** The LaunchReveal shows score, verdict, and units — but not *why*. The excellent ranked-driver postmortem lives behind Market → tap product → sheet, a path no guidance ever surfaces. A first-timer who flops gets a sad animation and no lesson; the game's single best teaching asset is hidden at its peak-relevance moment. | `LaunchReveal.tsx`, `Market.tsx:1190-1216` | High |
| F7 | **Dead waiting between decisions.** 8s/week base tick means a 3-week first build is ~24 seconds of watching, and mid-game "wait for the sales curve" stretches are worse. Fast (1s/week) exists but the player must babysit it — hold Fast, watch for the next thing needing input, react. Pillar 3 says "a sim, not a clicker," yet the moment-to-moment loop between decisions is *watching a clock*. | `balance.ts:15-16`, `useGame.tsx:533` | High |
| F8 | **Silent core actions.** `giveRaise` spends cash with no spend-FX (hire/train/rest all emit); `sellShares`, `sellOwnStake`, `takeLoan`, `cutProductPrice` — large deliberate financial moves — land with no sound/haptic/toast; `assign` and `fire` (core loop actions) give zero feedback of any kind. The feedback system is excellent where it's wired, which makes the unwired paths feel like bugs. | `useGame.tsx:752, 798, 916, 925, 926, 941, 951` | Medium |
| F9 | **The Coach hands off to a cliff of un-taught systems.** After "Got it," guidance becomes the NextMove ladder + insights — good spine, but Research, hiring, staff assignment, the price band, and the Market tab were never introduced. The ladder says *what* to chase, not *how the underlying system works*. (v43's audit called this "falls off a cliff"; the ladder softened it but didn't teach.) | `Coach.tsx`, `HQ.tsx:865` | Medium |
| F10 | **Tab label mismatch:** the fifth tab is labelled **Finance** but contains Team, Recruitment, Delegation, Manufacturing, Milestones, Platform founding — the operations hub. A new player looking for "where do I hire?" has no scent trail to "Finance." | `BottomNav.tsx:7-13`, `Company.tsx` | Medium |

### Day 2–7: return, retention, and the mid-game

| # | Friction | Where | Severity |
|---|----------|-------|----------|
| F11 | **Nothing ever brings the player back.** No local notifications of any kind — not "your build finished," not "a new daily challenge is live," nothing. Re-engagement is 100% "reward on return" (the offline recap). For a premium offline game this is the single largest structural retention hole, and it's fixable within the no-dark-patterns rule (opt-in, event-driven, no streak guilt). | no `LocalNotifications` usage anywhere | High |
| F12 | **The daily/weekly challenge — the designed daily hook — is buried.** It sits behind HUD trophy → Progress hub → Challenges row, gated on first ship, with zero surfacing on HQ. The retention backbone (RETENTION_ROADMAP Wave 2) was built and then hidden three taps deep. | `Progress.tsx`, `App.tsx:146` | High |
| F13 | **Early game has no stakes.** ~$20k start, free founder, $120/wk rent ≈ 166-week runway; the harness measures 0/40 bankruptcies even for a mediocre auto-player. The first session teaches "you pay upfront, builds are a bet" — and then nothing can actually hurt you for a real-time hour+. Tension deferred is tension lost; day-2 players quit from boredom, not difficulty. (Flagged repeatedly in v51/v52 and deliberately deferred — it's still the right call to fix, with a playtest.) | `balance.ts` starting economy | Medium |
| F14 | **Eras 1–2 are mechanically identical.** `eraModifiers` are 1.0 baselines until Platform era; the first half of the game — the half every player sees — is "same rules, bigger numbers." The era *fiction* (Track A world-context) landed; the era *rules* didn't reach the early game. | `balance.ts:470` | Medium |
| F15 | **The stock market is a fully-built UI whose optimal play is to ignore it.** v15 deliberately made it ~zero-EV (mean-reverting, no drift, ~5.9%/yr dividends minus fees). Correct as an anti-money-printer fix, but the result is dead weight: a trading sheet, sparklines, presets, and a "Max" button for a system whose expected value tells a busy player *don't bother*. Either give it strategic (non-cash) payoffs or demote its screen real estate. | `stocks.ts`, `Market.tsx` | Medium |
| F16 | **Choice events are flavor-rich, mechanically inert.** ~30 well-written dilemmas, every one resolving to a bounded one-shot stat nudge. No choice opens a lasting branch, policy, or identity. Players learn within 3 events that choices don't matter beyond ±cash/rep — and start tapping through the best writing in the game. Only 2 cascading chains exist (system built, barely populated). | `events.ts:118`, `eventChains.ts` | Medium |
| F17 | **Invisible depth: climate & franchises.** Seasonal segment cycles (±18% redistribution) are imperceptible as a lever — cost without perceived value. Brand-equity/franchise bonuses apply quietly with minimal UI explanation. Systems the player can't perceive can't inform decisions, which is the only reason to have them. | `climate.ts`, `franchise.ts` | Low |
| F18 | **Solved macro-outcome late game.** After the impressive v52–v55 measured passes, journey variance is healthy but every run still ends a multi-billion empire within ±~5% (CV 4.6–5.6%). No failable bet exists at scale; reputation decay is the only late threat and a competent shipper never feels it. The v52.1 analysis was right: this is a design decision, not a knob. | TASK.md v52.1–v55, `balance.ts` | Medium |

**Verdict on the current design, stated plainly:** the *simulation* is over-delivered and the
*game-feel of time* is under-delivered. The team has spent enormous effort making outcomes
explainable (right call) while the two things that most determine mobile retention — what the
first 10 minutes feel like, and what makes tomorrow's session happen — got structural gaps:
an untaught market layer, a hidden daily hook, zero notifications, and dead clock-watching
between decisions.

---

## 2. FEATURE IDEAS — max 10, ranked by impact/effort

All ideas change player behavior or decisions (per brief), respect the LOCKED constraints
(premium, offline, no dark patterns, zero image assets), and build on shipped systems.

| # | Idea | Effort |
|---|------|--------|
| 1 | Opt-in local notifications | S–M |
| 2 | "Today in Silicon" HQ card (surface the daily hook) | S |
| 3 | "Skip to next decision" time control | M |
| 4 | Contract manufacturing offers | M |
| 5 | Era mandates (pick 1 of 3 at each era advance) | M |
| 6 | Policy dilemmas (choices that stick) | M |
| 7 | Pre-announce keynote (hype gamble) | M |
| 8 | Rival counter-move decisions | M |
| 9 | Strategic stakes (stock market rework) | M |
| 10 | Moonshot bets (failable late-game R&D) | M–L |

### 1. Opt-in local notifications — S–M
**Pitch:** One-time opt-in sheet after the first launch: "Tell me when a build finishes or a new challenge drops" → Capacitor LocalNotifications for build-complete, product sold out / run finished, and the daily-challenge reset.
**Why it retains:** It is the *only* mechanism that can create a day-2 session for a lapsed player in a fully offline game. Event-driven ("your Aurora X shipped") is informative, not naggy — fully within the no-dark-patterns rule. Directly attacks F11, the biggest retention hole.
**Builds on:** build jobs + `challenges.ts` date-seeding + the existing Capacitor shell (`@capacitor/local-notifications` is the only new dependency).
**Behavior change:** players plan around build timers ("start the build, come back tonight") instead of grinding Fast — which also relieves F7.

### 2. "Today in Silicon" HQ card — S
**Pitch:** A single card high on HQ (post-first-ship): today's daily-challenge mutators + your best, this week's weekly, and one tap to play.
**Why it retains:** The daily challenge is the designed retention backbone and is currently three taps deep behind a trophy icon (F12). Surfacing it on the screen every session starts on converts a built feature into an actual habit loop. Cheapest retention win in the codebase.
**Builds on:** `challenges.ts`, `ChallengeTracker`, the HQ card system — pure re-surfacing, no new logic.
**Behavior change:** session starts become "check today's twist" instead of "resume the grind"; short bounded runs increase sessions/week.

### 3. "Skip to next decision" time control — M
**Pitch:** A third speed button: time compresses (or elides entirely with a week-count spinner) until something needs input — build done, event fired, product run ended, era gate reached, cash threshold crossed — then auto-pauses with a one-line "what happened" digest.
**Why it retains:** This converts the core loop from *watching a clock* to *a sequence of decisions* — pillar 3 delivered mechanically. Session length stops being gated by patience; mid/late game (where launches are deliberately 5+ weeks) stops feeling like a drag. Every tycoon that ages well (RCT scenarios, Football Manager "continue") has exactly this control.
**Builds on:** the tick already knows every interrupt condition (ReadyToLaunch auto-pause proves the pattern); Fast mode's catch-up path; the offline-recap digest for the summary.
**Behavior change:** players make more decisions per session and consciously choose *when* to stop time, instead of alt-tabbing through Fast. Biggest single change to how the game feels to play.

### 4. Contract manufacturing offers — M
**Pitch:** Periodically a rival or enterprise buyer offers a contract: "Build 4,000 units to ≥ spec X by week W for $Y flat." Accepting consumes factory capacity that competes with your own launches.
**Why it retains:** Adds a genuinely new decision *type* (guaranteed margin vs. opportunity cost of your own launch window) using the capacity system that currently only matters when you over-produce. Gives the early game reliable-but-capped income with real trade-offs — a better fix for F13 than raising rent, because it adds decisions rather than pressure alone. Mid-run sessions get a recurring "offer on the table" hook.
**Builds on:** factories/capacity, `segments.ts` (who's buying), rival identities, the choice-event delivery pipeline.
**Behavior change:** capacity becomes a portfolio allocation decision; players time launches around contract commitments.

### 5. Era mandates — pick 1 of 3 at each era advance — M
**Pitch:** Advancing an era presents a board mandate choice: three bounded run-long modifiers (e.g. Growth era: "Retail push" +organic demand −margin / "Lean ops" −burn −hype / "Talent magnet" +XP +salary), one must be chosen.
**Why it retains:** Fixes F14 (eras 1–2 identical) with the cheapest possible mechanism — the `eraModifiers` table already exists; this makes it *player-authored* per run. Run identity ("my lean-ops run") is what makes NG+/scenarios/challenges replayable, multiplying every existing meta feature.
**Builds on:** `eraModifiers`, the era-advance celebration moment (already juiced in v50), the Founder Perks pattern for bounded modifiers.
**Behavior change:** the era-advance moment becomes a strategic fork; subsequent decisions (pricing, hiring, run sizes) shift to exploit the chosen mandate.

### 6. Policy dilemmas — choices that stick — M
**Pitch:** Upgrade ~6 of the 30 choice events into persistent policies with an ongoing trade-off and a visible badge (e.g. Repairability pledge: +rep/wk, −2 design ceiling; Data-minimal OS: +Enterprise fit, −ecosystem revenue). Revocable later at a reputation cost.
**Why it retains:** Directly fixes F16 — the moment one choice visibly *stays*, every future dilemma commands attention again, and the excellent Track-A writing stops being tap-through. Persistent policies also differentiate runs (compounds with #5 and NG+).
**Builds on:** `events.ts` choice pipeline, `seenChoices` lifetime set, the balance-modifier plumbing from perks/mandates.
**Behavior change:** players read dilemmas again and build around their policy identity; some will replay runs to try the other branch.

### 7. Pre-announce keynote — the hype gamble — M
**Pitch:** When starting a build, optionally announce it publicly: immediate fan growth + launch-hype bonus that *decays if the ship date slips or the product underdelivers* vs. the teased spec — and rivals may respond (trend-chasers target your category).
**Why it retains:** Creates a timing/commitment decision at the moment that is currently pure arithmetic (the wizard). Risk-reward on the game's most emotional beat (the launch), and it makes the doctrine AI legible by giving it something visible to react to. Mirrors the real industry fantasy the game sells.
**Builds on:** hype system, fans/pre-orders, rival doctrines (`trendChaser` targeting already exists), the LaunchReveal for payoff/comeuppance.
**Behavior change:** players choose between quiet safe launches and announced high-stakes ones; slipping a date becomes a felt cost.

### 8. Rival counter-move decisions — M
**Pitch:** When a rival undercuts or beats your live product (both already detected), surface a 48-hour-style response card: price-match (margin hit), counter-campaign (cash), or hold the line (rep risk) — each a real, bounded lever on the remaining sales curve.
**Why it retains:** The Living Rivals epic made rivals visible; this makes them *interactive*. Mid-run sessions gain reactive decisions (currently all decisions are launch-time), and the price-cut/marketing-push levers that exist but are rarely discovered (buried in the product detail sheet) get delivered to the player at their moment of relevance.
**Builds on:** `rivalEntrySalesHaircut`, undercutter doctrine + `contested` flag, existing `cutProductPrice` / `marketingPush` actions, the poach-decision card pattern on HQ.
**Behavior change:** players defend live products instead of fire-and-forgetting them; session checks gain a "did anyone attack me?" motive.

### 9. Strategic stakes — make the stock market mean something — M
**Pitch:** Keep trading ~zero-EV (the v15 fix was correct), but ownership thresholds now grant *strategic* payoffs: 10% = rival intel (see their next category/launch window in the profile), 25% = board seat (dampen one doctrine behavior), plus the existing acquisition discount made visible as a progress bar toward buyout.
**Why it retains:** Fixes F15 by paying the player in *information and influence* instead of EV — which can't inflate the economy and makes the Market tab's biggest UI investment worth touching. Deepens the M&A endgame chase.
**Builds on:** `stocks.ts` holdings, rival doctrines/arcs (the intel already exists in state — it's exposure, not simulation), `acquireRival` (stake discount already computed).
**Behavior change:** buying shares becomes a targeting decision ("I'm building toward Pandacore's board"), not a dead yield calculation.

### 10. Moonshot bets — failable late-game R&D — M–L
**Pitch:** Era 3–4 unlock 2–3 moonshot projects (foldable line, on-device AGI assistant, satellite modem): huge RP+cash cost over N weeks with a *visible success probability*; success = a new category/flagship component, failure = sunk cost + rep dip.
**Why it retains:** The measured v52–v55 arc proved no knob can break late-game determinism (F18) — only a genuinely failable bet at scale can. This is variance option (d): bounded, opt-in, thematic. It gives the post-IPO stretch (currently a victory lap) a reason to keep playing, and NG+ a new axis.
**Builds on:** research projects pipeline, RP economy's flagged surplus (RP outpaces sinks), the era-4 content push, category/catalog extensibility (G3 groundwork).
**Behavior change:** late-game cash/RP hoards become stakes; the player chooses between safe compounding and betting the quarter.

---

## 3. QUICK WINS — top 3 under 2 hours each

### QW1 — Fix the `.lab__hero-grid` CSS collision (≈30 min, highest impact-per-minute in the repo)
The Design Lab hero overlaps the Category selector at the app's 540px max width (iPad /
web / wide phones) — on the game's flagship screen (F5). Rename the dot-texture backdrop class
(e.g. `.lab__hero-dots`) in `designLab.css` + `DesignLab.tsx`. Already root-caused in
TASK.md's backlog; it's been worked around in the screenshot scripts instead of fixed in
source. Nothing else on this list matters if the first screen renders broken.

### QW2 — Put the "why" in the LaunchReveal (≈2 h)
Add one line to the reveal — the postmortem's #1 ranked driver ("Biggest factor: priced
above what Mainstream buyers pay") — plus a "See full breakdown" button deep-linking to the
Market postmortem sheet. `postmortem.ts` already computes everything at launch; this is
surfacing, not simulation. Closes F6: the flop moment becomes the game's best teacher
instead of its most confusing beat, and it finally routes players to the Market tab (F1).

### QW3 — Feedback batch for silent actions (≈1.5 h)
Wire the existing buses to the unwired paths: `emitSpend` on `giveRaise`; success
haptic + `cash` sound on `sellShares` / `sellOwnStake` / `takeLoan`; confirm
haptic + toast on `cutProductPrice`; light haptic on `assign`; warning haptic + toast on
`fire`. All patterns exist (hire/train/rest are the template) — this is copying five wired
call sites onto seven unwired ones (F8). The polish bar elsewhere makes these silences read
as bugs; closing them is pure premium-feel per minute.

**Runner-ups (just over the 2h bar):** unify the wizard Review's price-fit labels onto
`priceGuidance`'s zone vocabulary (F4); rename the "Finance" tab to "Company" (F10 — one
string, but do it with the icon/copy pass it deserves).

---

## Priority synthesis (if only three things get built)

1. **QW1–QW3 immediately** — broken flagship layout, the missing "why," silent actions.
2. **Ideas #1 + #2 (notifications + daily surfacing)** — the entire day-7 story currently
   rests on the player spontaneously remembering the game exists.
3. **Idea #3 (skip to next decision)** — the deepest fix to how the game *feels*: it turns
   the sim's honesty about time into respect for the player's time.
