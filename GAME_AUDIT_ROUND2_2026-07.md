# Silicon Tech Tycoon — Audit & Feature Roadmap (Round 2)

_Generated 2026-07-16. A SECOND orchestrated audit (opus 4.8 agents + fable 5 synthesis) of the CURRENT code, after Round 1 shipped 8 features + the flops/OS-cost/robot-head fixes. Agents were told what already exists, so this ranked-10 is new work — not repeats._

> **Already shipped (not re-recommended here):** Calm Mode · unified interrupt priority · first-time framing · Decision Inbox · Goals Ledger · Founder Legend · Frontier Tech · board-mandate scaling · products-can-flop difficulty · earned OS-founding gate.

---

## Executive summary

Round 1 worked: the interrupt layer is genuinely tamed (Calm Mode, unified priority, first-time framing, Decision Inbox), and the endgame now has a numeric floor (Frontier, Founder Legend, scaled mandates). What remains falls into three clear gaps. (1) NOISE has migrated from interrupts to persistent surfaces: the 12-15-card HQ stack, four overlapping "what to do next" cards, duplicate toast+feed milestone announcements, an always-lit post-IPO nav dot, and six overlays that still seize the full screen — none of which Calm Mode touches. (2) DEPTH dies after each decision: post-launch sales are a frozen precomputed curve with three fire-once levers, restock is instant so supplier lead-time never matters after the first build, staff/research/regions are all set-and-forget — which is why "skip to next decision" is the dominant way to play the middle of the game. (3) THE LATE GAME is a monotone-easier treadmill: every New Game+ starts stronger, Frontier is a decision-free scalar buy, mandates are memoryless, eras hard-stop at 4, and nothing ever asks the player to earn something under pressure. Strategy for the next wave: FIRST ship the cheap persistent-surface calm fixes (toast gating, nav-dot debounce, inbox re-triage, guidance-card merge — all listed under noise reduction, no new systems); THEN spend the feature budget on two spines: an Ascension/Heat difficulty ladder that finally makes repeat runs harder-for-more (the single biggest retention lever), and a weekly-operations layer (product ops + team deployment) that gives the auto-ticking weeks something to manage. Hold a hard moratorium on new interrupt streams — every feature below either reuses an existing pending* stream, lives on a persistent screen, or MERGES streams. All ten fit the established gated-optional-state pattern, so the 160-week determinism pin stays green.

---

## Part 1 — Remaining noise & clarity fixes

| # | Change | Effort | Risk |
|---|--------|:---:|:---:|
| 1 | Calm-Mode-aware toast gate: in Relaxed suppress fan/revenue-milestone and staff-level toasts (they already live in the feed); in Calm suppress all purely-informational toasts, keeping only action confirmations (src/state/useGame.tsx:212-315). | S | low |
| 2 | Debounce navAttention.hq post-IPO: fire spendableLegacyPoint/affordableMegaproject only when they NEWLY become true (lastSeen watermark), keeping the dot for genuine one-shot events (src/state/gameState.ts:4325-4334). | S | low |
| 3 | Re-triage the takeover tier: move eureka and earnings (and rivalry-declared) into INBOX_INTERRUPTS, leaving full-screen for real branching choices (strike, licenseOffer) and the awards ceremony (src/design/interruptPriority.ts:78-86). | S | low |
| 4 | Tier the celebration bus: reserve office-cheer + confetti for genuine peaks (hit launch, era, IPO); routine completions (research done, milestone crossed) get sound + feed line only (src/App.tsx:139, useGame.tsx:258-266). | S | low |
| 5 | One-line first-time framing on the new persistent meta surfaces: Legacy Era card (Legacy Points / mandate / megaproject, copy pulled from TERM_INFO), Founder Legend header, and the Frontier row (src/screens/HQ.tsx:1095-1136, FounderLegend.tsx). | S | low |
| 6 | Two-tap confirm on the Coach skip X, and keep a compact 'resume tutorial' pill until first launch (src/components/Coach.tsx:30). | S | low |
| 7 | Merge staffMoment + staffEvent into one 'Team moment' stream: keep both engine generators, route through a single pendingTeamMoment, one inbox label, one intro note (src/engine/staffMoment.ts, staffEvent.ts, interruptPriority.ts:24-28). | M | low |
| 8 | Fold BuzzTicker into FeedCard as its headline row (or demote FeedCard to the Progress hub), so HQ has one ambient-news surface (src/screens/HQ.tsx:214,357). | M | low |
| 9 | Merge the four guidance cards (NextMoveCard, EraGoalCard, StrategicInsightsCard, DailyChallengeCard teaser) into ONE 'Next move' card driven by a priority function, with the rest under a 'more suggestions' disclosure (src/screens/HQ.tsx:220,307,317,356). | M | medium |
| 10 | Extend Calm Mode to HQ density: in Relaxed/Calm, collapse secondary cards (Community, Contracts, Performance, Feed, Buzz) into a remembered-state 'Company brief' section, leaving the priority zone + stat pills + one guidance card expanded (src/screens/HQ.tsx:125-360). | L | medium |
| 11 | Consolidate the trophy trio: fold achievements + collections into the Founder Legend surface as one 'Legacy' wall (title on top, badge grid beneath), dropping the Progress hub from 6 rows to 4 (src/screens/Progress.tsx:79-126). | M | medium |
| 12 | Single shared verdict computation behind postmortem + reviews so the two post-hoc launch reads can never disagree in tone (src/engine/postmortem.ts, reviews.ts). | M | medium |

### Rationale

**1. (S / low risk)** Calm-Mode-aware toast gate: in Relaxed suppress fan/revenue-milestone and staff-level toasts (they already live in the feed); in Calm suppress all purely-informational toasts, keeping only action confirmations (src/state/useGame.tsx:212-315).

> The milestone toast fire-hose is the loudest surviving noise, it ignores state.interruptPace entirely, and feedSalience already classifies the same lines as 'milestone spam' — dropping the toast removes pure duplication, not information.

**2. (S / low risk)** Debounce navAttention.hq post-IPO: fire spendableLegacyPoint/affordableMegaproject only when they NEWLY become true (lastSeen watermark), keeping the dot for genuine one-shot events (src/state/gameState.ts:4325-4334).

> An always-lit badge trains players to ignore the whole attention system; the function's own doc comment says it must not nag. Watermark fields are UI-side state, zero sim impact.

**3. (S / low risk)** Re-triage the takeover tier: move eureka and earnings (and rivalry-declared) into INBOX_INTERRUPTS, leaving full-screen for real branching choices (strike, licenseOffer) and the awards ceremony (src/design/interruptPriority.ts:78-86).

> Eureka is a freebie with no decision and earnings is informational; demoting them reuses the shipped Decision Inbox machinery verbatim and roughly halves remaining takeovers with no new plumbing.

**4. (S / low risk)** Tier the celebration bus: reserve office-cheer + confetti for genuine peaks (hit launch, era, IPO); routine completions (research done, milestone crossed) get sound + feed line only (src/App.tsx:139, useGame.tsx:258-266).

> Every research completion currently fires launch-grade fanfare, flattening the reward curve and adding constant motion. A severity parameter on emitCelebrate is a small, purely presentational change.

**5. (S / low risk)** One-line first-time framing on the new persistent meta surfaces: Legacy Era card (Legacy Points / mandate / megaproject, copy pulled from TERM_INFO), Founder Legend header, and the Frontier row (src/screens/HQ.tsx:1095-1136, FounderLegend.tsx).

> The FirstTimeNote system was built only for interrupts, so the game's newest depth is its least-explained. Static subtitle lines reusing existing TERM_INFO copy — trivial and immediately fixes the coldest onboarding moment (IPO).

**6. (S / low risk)** Two-tap confirm on the Coach skip X, and keep a compact 'resume tutorial' pill until first launch (src/components/Coach.tsx:30).

> One stray tap currently ends all onboarding forever with no recovery path. Pure UI guard, no state-model change.

**7. (M / low risk)** Merge staffMoment + staffEvent into one 'Team moment' stream: keep both engine generators, route through a single pendingTeamMoment, one inbox label, one intro note (src/engine/staffMoment.ts, staffEvent.ts, interruptPriority.ts:24-28).

> Two adjacent inbox rows the player cannot tell apart ('ready to grow' vs 'turning point') cost two interrupt slots and two framing intros for one experience. Merging frees a slot under the stream moratorium with zero content loss.

**8. (M / low risk)** Fold BuzzTicker into FeedCard as its headline row (or demote FeedCard to the Progress hub), so HQ has one ambient-news surface (src/screens/HQ.tsx:214,357).

> Two rotating news widgets narrate the same rank/launch/rival facts on one screen — redundant motion and vertical space. Presentational only.

**9. (M / medium risk)** Merge the four guidance cards (NextMoveCard, EraGoalCard, StrategicInsightsCard, DailyChallengeCard teaser) into ONE 'Next move' card driven by a priority function, with the rest under a 'more suggestions' disclosure (src/screens/HQ.tsx:220,307,317,356).

> The cards openly hand off to each other while all staying on screen; there is no canonical 'do this now'. Removes 2-3 cards from the stack without losing guidance. Medium risk only because the priority function needs tuning to not bury the right hint.

**10. (L / medium risk)** Extend Calm Mode to HQ density: in Relaxed/Calm, collapse secondary cards (Community, Contracts, Performance, Feed, Buzz) into a remembered-state 'Company brief' section, leaving the priority zone + stat pills + one guidance card expanded (src/screens/HQ.tsx:125-360).

> The 12-15-card stack is now the single largest steady-state noise source and Calm Mode has zero effect on it. Do this after the guidance-card merge so you collapse the already-consolidated stack; medium risk because default-collapsed can hide things new players need.

**11. (M / medium risk)** Consolidate the trophy trio: fold achievements + collections into the Founder Legend surface as one 'Legacy' wall (title on top, badge grid beneath), dropping the Progress hub from 6 rows to 4 (src/screens/Progress.tsx:79-126).

> Three independent 'permanent badges across runs' systems with three hub rows is pure schema load; players cannot say why a collection differs from an achievement. Pairs with feature #10's escalating tiers so the merged wall is also a deeper chase.

**12. (M / medium risk)** Single shared verdict computation behind postmortem + reviews so the two post-hoc launch reads can never disagree in tone (src/engine/postmortem.ts, reviews.ts).

> Both are presentation-only reads of the same LaunchInsight data; a shared verdict input keeps both voices (analytical headline vs press quotes) while removing contradictions. Touches derived output only, but needs care to keep recorded history stable.

---

## Part 2 — The ranked 10 (new features)

| Rank | Feature | Category | Effort |
|:---:|---------|:---:|:---:|
| 1 | Ascension Ladder (opt-in Heat for New Game+) | late-game | M |
| 2 | Live Product Ops (inventory rate + restock lead time) | depth | L |
| 3 | Frontier Era (Era 5) — new late-game product content | late-game | XL |
| 4 | Team Deployment & Research Surge | depth | M |
| 5 | Board Confidence & Directive Tiers | late-game | M |
| 6 | Frontier Lanes & Band Unlocks | late-game | M |
| 7 | Unified Nemesis Rivalry (fold rival strikes into the nemesis arc) | meta | M |
| 8 | Help Hub & Score Explainers | clarity | S |
| 9 | Goals Ledger Completion (awards + side orders as rows) | clarity | S |
| 10 | The Gauntlet & Trophy Tiers (endless chase pack) | progression | S |

### 1. Ascension Ladder (opt-in Heat for New Game+)

**Category:** late-game · **Effort:** M

A stacking, one-rung-at-a-time difficulty ladder chosen at prestige: colder demand, faster rival ramp, higher flop thresholds, reduced/no legacy head-start. Each run's Founder Legend contribution is multiplied by the ascension level, the top numbered Legend rungs require minimum ascension, and best-ascension-cleared is recorded on the profile.

**Pros**

- Fixes the single biggest retention gap: legacyBonus makes every NG+ strictly easier, so repeat prestige is a victory lap — this is the proven roguelite spine (Hades Heat, StS Ascension) that turns 3 hours into 30
- Retroactively gives three shipped systems a purpose: Founder Legend titles become earned under pressure, the raised flop thresholds get a dial, and Frontier/legacy power finally has something to push against
- Adds zero noise: one settings choice at run start, no new interrupts, no new HQ cards; modifiers ride the existing BALANCE-override plumbing the challenge mutators already use (challenges.ts:46-48)

**Cons**

- Needs real balance passes per rung — a badly tuned rung 3 that walls players is worse than no ladder, and the deterministic sim means you must playtest seeds per rung
- Only serves players who prestige at least once; does nothing for a first 5-hour run
- Interacts with legacyBonus scaling — deciding whether heat suppresses or coexists with the head-start is a design decision with no obviously right answer

**Fits determinism:** Excellent — a new optional ascensionLevel field on state defaulting to 0 reproduces today's behavior byte-identically; modifiers are pure BALANCE multipliers applied in newGame/tick, no new randomness, no new salt needed. The pinned 160-week test never sets the field.

**Why this rank:** Highest ceiling of any feature for goal (2): it manufactures an endless, self-selected grind out of content that already exists, at medium effort, with zero noise cost and a trivially safe determinism story.

### 2. Live Product Ops (inventory rate + restock lead time)

**Category:** depth · **Effort:** L

Each active product gets a weekly ops state: inventory-on-hand vs live demand with a player-set replenish RATE instead of three fire-once buttons. Restocks arrive after supplierLeadWeeks (mitigated by dual-sourcing), so a sell-out becomes a timed 'reorder now and hope the wave hasn't passed' bet; overproduction creates markdown risk.

**Pros**

- Directly attacks the core pacing flaw: post-launch weeks are a frozen weeklyUnits[] curve the player watches passively — this gives every auto-tick something to read and adjust
- Makes the dormant supplier axis (leadWeeks, dual-sourcing) matter for a product's whole life instead of only the first build, deepening Sourcing for free
- Reuses the existing restock/price/push machinery and demand caps — it converts spent-once buttons into a recurring knob rather than inventing a new economy

**Cons**

- The riskiest feature here for calm: a badly-surfaced ops panel is a new chore and a new noise source — it must be glanceable and optional (sane default rate = today's behavior)
- Touches the hottest path in the engine (the tick's sales booking) — the highest regression surface of anything on this list, and the determinism pin must be re-verified carefully
- Multi-product late game could multiply micromanagement; needs a 'set and forget' auto-rate so Calm players can opt out

**Fits determinism:** Good with care — an optional opsState per launched product, backfilled as undefined = exact legacy curve behavior. Replenish arrivals are pure functions of (order week + leadWeeks); no randomness required. The no-op path must be proven byte-identical before shipping.

**Why this rank:** Second because it fixes the reason 'skip to next decision' exists — the moment-to-moment audit's #1 and #2 findings in one mechanic — but its effort and calm-risk are real, so it sits below the cheaper, safer Ascension win.

### 3. Frontier Era (Era 5) — new late-game product content

**Category:** late-game · **Effort:** XL

A post-IPO fifth era gated on wentPublic + a Frontier Tech tier threshold, unlocking 1-2 genuinely experimental product categories and a new component tier. The numeric Frontier grind finally buys new THINGS TO BUILD, not just multipliers.

**Pros**

- Fixes the deepest content cliff: eras hard-stop at 4, so 10-hour players ship the same categories with the same components they had at IPO — this restores the unlock cadence that made the early game compelling
- Ties the scalar Frontier sink to concrete payoffs, giving the endless Legacy-Point grind a destination and multiplying the value of features 1 and 6
- Reuses the entire existing era/category/component pipeline (unlockEra gating in catalogs.ts) — it is content authoring, not new systems

**Cons**

- Largest content-authoring bill on the list: new categories need recipes, segment weights, art, balance, and factory requiredKinds coverage — XL if scoped generously
- Risks devaluing pre-IPO categories if the new tier strictly dominates; needs sidegrade-style design
- One-time content, not an endless loop — it delays the content cliff rather than removing it (Ascension and feature 6 carry the endless side)

**Fits determinism:** Excellent — pure data plus an unlock gate on wentPublic + frontier tier; the pinned solo sim never goes public so it never reaches era 5. No new randomness.

**Why this rank:** The most requested-shaped answer to 'more late-game to look forward to' — real new gameplay, not numbers — but its XL cost and one-shot nature place it below the two systemic spines above it.

### 4. Team Deployment & Research Surge

**Category:** depth · **Effort:** M

Bind the active design draft and active research project to staffing: concentrate engineers/designers to RUSH the thing you need now (shaving weeks off activeResearch/build timers, diminishing returns, capped) at the cost of burn and morale, or let it bake. One compact allocation panel, revisited weekly.

**Pros**

- Gives the between-launch weeks a real allocation loop — staff stop being a set-once global bucket and the deep per-discipline skill model (staff.ts:176-190) becomes something you exploit weekly
- Answers the research audit finding directly: a player-initiated lever during the multi-week timer, complementing the random eureka instead of competing with it
- Synergizes with Live Product Ops to form one 'this week' operations surface, making skip an optional convenience instead of the default

**Cons**

- Morale/burn interaction needs tuning or rushing becomes strictly optimal and the choice evaporates
- Another panel on an already-crowded HQ — must land inside the consolidated ops surface, not as a new card, or it works against goal (1)
- Overlaps conceptually with the existing boostMorale button; that should be folded in or it becomes a fifth staff-adjacent control

**Fits determinism:** Excellent — an optional allocation field defaulting to today's even-spread behavior; speed effects are pure functions of assignment. No new salt; no RNG.

**Why this rank:** The cheaper half of the 'make waiting playable' pair — medium effort, pure-function mechanics, and it activates an existing deep system (per-discipline staff skills) that currently pays out passively.

### 5. Board Confidence & Directive Tiers

**Category:** late-game · **Effort:** M

A board-confidence meter that rises with met mandates and falls with lapses; met-streaks compound payouts, and confidence thresholds unlock escalating directive tiers with richer rewards and occasional governance perks. Missing a mandate finally costs something a player can see.

**Pros**

- Gives the one always-live post-IPO loop a memory and a ladder — today mandates are a memoryless quarterly checkbox with no penalty for lapses
- Builds directly on this round's mandate-scaling work and the Goals Ledger row that already displays mandates — no new surface needed
- Cheap, contained, and additive: one meter, one streak counter, a tier table in endgame.ts

**Cons**

- A punitive confidence spiral could feel bad in an otherwise cozy game — the floor needs to be gentle (reduced rewards, not death spirals)
- Still a scalar loop at heart; without features 1/3 it deepens the treadmill rather than replacing it
- Adds one more number to the Legacy Era card, which the clarity audit already flags as arriving cold — must ship with its first-time framing line

**Fits determinism:** Excellent — an optional boardConfidence field backfilled to neutral = exact current auto-resolve behavior; all transitions are deterministic functions of mandate outcomes already in state.

**Why this rank:** Best effort-to-impact ratio in the endgame cluster: it converts an existing infinite loop from decoration into progression for roughly a week of work.

### 6. Frontier Lanes & Band Unlocks

**Category:** late-game · **Effort:** M

Restructure Frontier Tech from one linear +5%/+2%/+1% buy into pick-a-lane specializations per band (mirroring the Legacy Tree's power/marketing/research/margin routes), with a real one-time unlock at each band boundary (tier 5/10/15/20): a capability, a cosmetic, an authored moonshot slot. frontierBandName stops being pure text.

**Pros**

- Turns the richest phase's only sink from a decision-free 'buy next tier' click into a build-defining route choice — restoring agency to the endless grind
- Band unlocks give the infinite ladder discrete 'you earned something' beats, the exact punctuation the audit says is missing
- Folds through the same PerkBonus/prestigeBonuses plumbing that already exists — mechanically small

**Cons**

- Migration question for existing saves with generic tiers already bought (need a backfill rule mapping owned tiers to a default lane)
- Lane balance is hard in an endless system — one dominant lane recreates the no-decision problem with extra steps
- Partially redundant with Frontier Era (rank 3) as a Legacy-Point destination; if both ship, band unlocks should feed era-5 gating rather than compete with it

**Fits determinism:** Excellent — pure data restructuring of frontier.ts bonuses plus an optional chosenLane field; no randomness, no tick changes. Backfill existing tiers deterministically.

**Why this rank:** Directly converts an audited 'flat scalar treadmill' into decisions and beats at medium effort, but ranks below Board Confidence because Frontier is opt-in endgame while mandates reach every post-IPO player.

### 7. Unified Nemesis Rivalry (fold rival strikes into the nemesis arc)

**Category:** meta · **Effort:** M

Make rivalStrike a beat OF the nemesis relationship: with a nemesis, a strike is 'your nemesis hit you' (adds heat, routed through the rivalry stream); with none, a strike becomes the clash that FORMS one. Two full-screen rival interrupts collapse into one escalating personal feud with heat, taunts, strikes, and a payoff arc.

**Pros**

- Serves both goals at once: frees an interrupt slot under the stream moratorium AND gives strikes narrative weight instead of context-free 'a rival did a thing' popups
- The five rival systems (nemesis, strike, clashes, arcs, rivalAI) start reading as one story — the biggest confusion cluster in the systems audit
- Opens cheap future depth: heat thresholds can trigger authored feud beats (sabotage, talent raids, showdown launches) inside the existing stream instead of new salts

**Cons**

- Touches two live interrupt streams and their priority slots — the riskiest refactor here for save compatibility and the determinism pin (existing pendingStrike states must migrate cleanly)
- Removing pendingStrike as a top-priority stream changes felt pacing for existing players; some liked the ambush
- Merging without a nemesis present needs new 'clash formation' logic — the one place a fresh derived-hash decision may be needed

**Fits determinism:** Good with care — routing is deterministic given existing state; if a new formation draw is needed, use a fresh salt (e.g. 277, unused per the CLAUDE.md registry) rather than touching salts 239/271. Backfill: an in-flight pendingStrike resolves under legacy rules.

**Why this rank:** The highest-value MERGE available: it is the systems audit's recommended pattern (new beats inside existing streams, not new streams) applied to the loudest overlap, and it upgrades flavor into an arc players can grind heat against.

### 8. Help Hub & Score Explainers

**Category:** clarity · **Effort:** S

One persistent help entry (a Progress-hub tab or Settings row) that consolidates STAT_INFO + TERM_INFO + new SCORE_INFO entries defining Fit, Overall, and the Projected verdict ('Fit + your track record − rivals → Verdict'), and can replay the build Coach. Plus one-line definitions beside the three Design Lab hero scores via the existing Glossary component.

**Pros**

- Closes the two top clarity findings in one stroke: the game's three most-stared-at numbers are currently defined nowhere, and there is no lookup-from-anywhere surface once the Coach vanishes
- Almost pure copy + composition: StatGlossary, TERM_INFO, and the Coach all exist — this is wiring, not invention, and copy stays single-sourced so it cannot drift
- Makes every future system cheaper to ship (its glossary entry has a home) and rescues players who mis-tapped the Coach's X

**Cons**

- Zero gameplay depth — it buys comprehension, not content, so it cannot carry the wave alone
- A consolidated glossary can rot if not maintained as systems change; needs a convention that new TERM_INFO entries are mandatory for new mechanics
- The Fit/Overall/Verdict copy must be genuinely causal, not restating labels — bad explainer copy is worse than none

**Fits determinism:** Trivial — read-only UI over existing data; no state, no sim contact whatsoever.

**Why this rank:** The best clarity-per-hour purchase available. It ranks mid-list only because it adds no gameplay; it should probably ship FIRST chronologically despite rank 8 by ambition.

### 9. Goals Ledger Completion (awards + side orders as rows)

**Category:** clarity · **Effort:** S

Extend the GoalRow grammar with 'award' and 'sideOrder' sources: side orders (fee + deadline + payout) and the annual awards chase (next ceremony date + eligible launches) become rows in the one ledger, so a player checking 'everything I'm chasing' looks in exactly one place.

**Pros**

- Finishes the consolidation the Ledger was built for — contracts.ts's own header comment admits these systems duplicate the same 'what do I chase' job, and 4 of 7 are still scattered
- Both candidates are near-perfect fits for the existing row shape (deadline/frac + reward summary) — mostly adapter code over shipped machinery
- Enables demoting the pendingSideOrder interrupt to a ledger-row + inbox ping later, another step toward the stream cap

**Cons**

- Awards are a ceremony-with-a-date, not a checkbox — modeling 'be eligible by week 52' as a GoalRow needs honest progress semantics or the row is noise
- A longer ledger has its own density cost; needs grouping/sorting so 8+ rows stay scannable
- Collections and challenges remain outside, so 'the ONE surface' claim is still asymptotic (they are covered by the trophy-wall consolidation instead)

**Fits determinism:** Trivial — collectGoals is a pure read-model over existing state; no sim fields touched.

**Why this rank:** Cheap, shovel-ready, and it compounds a shipped win — but it is bookkeeping, not new gameplay, so it sits below the depth and endgame spines.

### 10. The Gauntlet & Trophy Tiers (endless chase pack)

**Category:** progression · **Effort:** S

Two additive data drops: escalating tiers on the finite trophies (Prolific II/III at 50/100 devices, Hitmaker II/III at 25/50 hits, concurrent dynasty collections; mastery past 'Grand Master') plus one procedural 'Gauntlet' scenario whose targets scale with total earned stars — so the scenario picker and trophy walls never empty. Rounded out with a cycled pool of 8-12 authored moonshot names/blurbs so repeatable megaprojects stop reading 'Program 7, Program 8'.

**Pros**

- Removes every terminal dead-end the late-game audit found in the discrete-goal surfaces (scenarios, collections, achievements, moonshot tail) in one cheap pass
- Pure additive data — the safest feature on the list, shippable in days, and it feeds the merged Legacy trophy wall from the noise-reduction track
- Gauntlet scaling gives completionists an ascension-adjacent chase even before they touch prestige

**Cons**

- Numeric tier escalation (50! 100!) is the weakest form of 'more to do' — it extends the chase without changing what you do, and grind-averse players will smell it
- A procedural scenario needs careful target math or it generates impossible or trivial rungs at the extremes
- Moonshot name cycling is cosmetic; it treats the audit's symptom (copy-paste blurbs) more than the cause (no unlock punctuation — that lives in feature 6)

**Fits determinism:** Excellent — collections/achievements/scenarios are pure data tables evaluated from existing stats; Gauntlet targets derive deterministically from earned stars. No new state fields beyond optional tier bookkeeping in the cross-run profile, which the sim pin never reads.

**Why this rank:** Deliberately last: the cheapest honest way to keep every ladder infinite, valuable as glue for features 1 and 6, but it extends chases rather than deepening play — exactly what rank 10 should be.

---

## Appendix — Full audit findings by dimension

### Remaining noise & interruption overload

Calm Mode, unified interrupt priority, first-time framing, and the Decision Inbox have genuinely tamed the *interrupt* layer — but they all operate on opportunistic full-screen overlays. The noise that survives is almost entirely in the PERSISTENT surfaces those features never touched: the HQ card stack (screens/HQ.tsx renders ~10-15 stacked cards at once in mid/late game), a cluster of overlapping "what to do next" guidance cards, two parallel news streams (BuzzTicker + FeedCard), a milestone toast fire-hose in useGame.tsx that Calm Mode does not scale and that duplicates the feed, and a navAttention.hq dot (gameState.ts:4330) that becomes an always-on nag post-IPO. On the interrupt side, six overlays still seize the whole screen (strike/awards/rivalry/eureka/earnings/licenseOffer), several of which are informational or a positive freebie and are demotable to the inbox tier that already exists. The next calm wins are consolidation and Calm-Mode-awareness of these persistent surfaces, not more interrupt plumbing.

- **[high · bloat] HQ persistent card stack is 10-15 cards tall and Calm Mode never touches it**  
  *Where:* `src/screens/HQ.tsx:125-360`  
  *Problem:* The HQ render can mount, simultaneously, in a mid/late-game free-play state: BuzzTicker, ScenarioTracker, ChallengeTracker, DailyChallengeCard, the IPO/Advance banner, a 4-pill stat row, a 2-pill finance row, the rank-ladder line, EraGoalCard, UnlockCard, NextMoveCard, ContractsCard, LegacyEraCard (post-IPO), CommunityCard, In-production, Upgrades, PerformanceCard, StrategicInsightsCard, and FeedCard. That is a wall of ~12-15 always-visible cards the player scrolls past every session. Calm Mode (state.interruptPace) only scales the interrupt quiet-gap; it has zero effect on this stack, which is the single largest source of steady-state visual noise now that the interrupts are calmed.  
  *Fix:* Introduce a persistent-surface density control (or fold it into Calm Mode): in Relaxed/Calm, collapse the secondary informational cards (Community, Contracts, Performance, Feed, Buzz) into a single collapsible 'Company brief' section or into the existing Progress hub, leaving only the priority zone (Ready/Choice/Poach), the stat pills, and ONE guidance card expanded by default. Give each non-priority card a remembered collapsed/expanded state so the home screen defaults to calm and expands on demand.
- **[high · confusion] Four+ overlapping "what to do next" guidance cards can render at once**  
  *Where:* `src/screens/HQ.tsx:307,317,356,220`  
  *Problem:* NextMoveCard (line 317), EraGoalCard (307), StrategicInsightsCard (356), DailyChallengeCard (220), and the rank-ladder line (295-306) are all forms of 'here is your next best move,' and mid-game several are visible together. NextMoveCard's own completed state even admits the overlap: it tells the player 'the Insights below flag your best next move' (HQ.tsx:1002) — i.e. two cards openly hand off to each other while both remain on screen. The player gets a next-era bar, a next-objective bar, a bulleted insights list, and a daily-challenge teaser stacked, with no single canonical 'do this now.'  
  *Fix:* Merge into one 'Next move' card with a clear hierarchy: show the single highest-priority directive (objective rung OR era goal OR top strategic insight, chosen by a priority function), with the others available under a 'more suggestions' disclosure. EraGoalCard's progress bar can live inside it as the 'why.' This removes 2-3 cards from the stack without losing any guidance.
- **[medium · noise] Milestone toasts are a fire-hose, unscaled by Calm Mode, and duplicate the feed**  
  *Where:* `src/state/useGame.tsx:212-315`  
  *Problem:* Every tick can fire withFanToasts, withRevToasts, withStaffLevelToasts, withProductFinishToasts, announceAchievements, and announceObjectives — a steady stream of celebratory toasts. These are non-actionable and fire regardless of interruptPace, so a player who picked Calm still gets the full toast volume. Worse, the same events are ALSO written to the feed: feedSalience (HQ.tsx:1576-1582) explicitly classifies 'revenue milestone' and 'N fans' lines as 'low / milestone spam' and hides them from the collapsed News card — proof the team already recognizes these as noise, yet they still fire as toasts too. So a fan/revenue milestone is announced twice (toast + feed).  
  *Fix:* Route celebratory (non-actionable) toasts through a Calm-Mode-aware gate: in Relaxed suppress fan/revenue-milestone and staff-level toasts (they already live in the feed), in Calm suppress all purely-informational toasts and keep only action-confirmation toasts. Since the feed already carries these milestones, dropping the toast removes pure duplication rather than information.
- **[medium · noise] navAttention.hq becomes an always-on nag in the Legacy Era**  
  *Where:* `src/state/gameState.ts:4325-4334`  
  *Problem:* The hq attention dot ORs eight conditions, two of which are effectively permanent post-IPO: affordableMegaproject and spendableLegacyPoint. In the Legacy Era the player almost always has a legacy point to spend or a megaproject/frontier tier they can afford, so the HQ nav dot stays lit indefinitely — exactly the 'always-on nag' the function's own doc comment (gameState.ts:4314-4316) says it must not be. An always-lit badge trains the player to ignore it, defeating the whole point of the attention system. The design dot (line 4336) has a milder version: it lights whenever the build pipeline is idle, which for a between-products player is most of the time.  
  *Fix:* Make the persistent post-IPO signals passive: drop spendableLegacyPoint/affordableMegaproject from the dot (they are a standing resource, not a fresh event) OR debounce them so the dot only lights when points/affordability NEWLY become available (compare against a lastSeenLegacyPoints watermark), then stays dark until the next increment. Keep the dot for genuine one-shot events (canAdvance, canIPO, pendingChoice, pendingPoach, claimableContract, pendingSideOrder).
- **[medium · late-game] Six interrupts still seize the full screen; eureka/earnings/rivalry are demotable to the existing inbox**  
  *Where:* `src/design/interruptPriority.ts:78-86`  
  *Problem:* The Decision Inbox demoted five low-stakes streams, but strike, awards, rivalry, eureka, earnings, and licenseOffer still take over the whole screen. Of these, eureka is a positive freebie (a discovery bonus you just accept — no real decision), earnings is largely informational, and rivalry-declared is a flavor announcement. They interrupt exactly like a genuine yes/no (strike, licenseOffer) even though the player has nothing to weigh. This is the same over-weighting the inbox was built to fix, just one tier up.  
  *Fix:* Re-triage the takeover tier: move eureka and earnings (and arguably rivalry) into INBOX_INTERRUPTS so they wait in the calm banner instead of stopping play, leaving the full-screen tier for interrupts with a real branching choice (strike, licenseOffer) and the scheduled ceremony (awards). This reuses the shipped Decision Inbox machinery — no new plumbing — and roughly halves the remaining takeovers.
- **[low · bloat] Two parallel news streams (BuzzTicker + FeedCard) narrate the same world on one screen**  
  *Where:* `src/screens/HQ.tsx:214,357`  
  *Problem:* BuzzTicker (a rotating 'industry wire' of authored headlines about rank/launches/rivals, HQ.tsx:214) and FeedCard (the 'News' log, HQ.tsx:357) are both persistent 'what's happening in your world' surfaces on the same HQ scroll, drawing from overlapping facts (latest launch, rivals, rank, platform). The player reads the buzz line about their rank at the top and the feed entries about the same events at the bottom.  
  *Fix:* Pick one home for ambient news: either fold the authored buzz lines in as the top 'headline' row of the News/FeedCard (one news surface), or keep the slim BuzzTicker and demote FeedCard to the Progress hub / a 'View history' disclosure. Two separate rotating news widgets on one screen is redundant motion and vertical space.
- **[low · noise] Every celebration triggers a full office cheer, so minor events fire the launch-grade fanfare**  
  *Where:* `src/App.tsx:139, src/state/useGame.tsx:258-266`  
  *Problem:* App.tsx:139 bridges EVERY onCelebrate() into an office-wide cheer animation (emitHqReaction('cheer'), a 2.6s reaction). onCelebrate/emitCelebrate is fired by many small events including each timed-research completion (useGame.tsx:261), which also stacks a confetti burst + sound + toast + feed line for a single research finishing. The result is that low-stakes recurring events get the same celebratory weight (confetti + whole-office cheer + sound + toast) as a hit launch, flattening the reward curve and adding steady motion noise.  
  *Fix:* Tier the celebration bus: reserve the office-cheer + confetti bridge for genuine peaks (hit launch, era, IPO, achievement) and give routine completions (research done, milestone crossed) a lighter cue (sound + the feed line only). Optionally gate the office-cheer bridge on Calm Mode so Calm players get the feed entry without the 2.6s animation.

### Remaining Confusion, Clarity & Onboarding

The clarity work that shipped this round (FirstTimeNote for the 8 interrupt systems, Goals Ledger, OS-founding requirement chips, the point-of-use StatGlossary/TERM_INFO) is real, but it's applied unevenly and leaves the game's most-looked-at numbers and its late-game meta systems unexplained. The three headline scores in the Design Lab — Fit, Overall, and the Projected verdict — are the single biggest gap: they dominate the build screen yet nothing defines them, and the only glossary there explains the five component stats instead. There is still no lookup-from-anywhere help surface: the core build Coach is a one-shot that vanishes after first launch (and dies to a single stray tap on its X), while the vocabulary glossary lives buried in the Bank popup. Newer persistent systems (Legacy Era / Legacy Points, Frontier, Founder Legend) arrive cold with no first-time framing, because that framing was built only for interrupts. The good inline-note precedent already exists on Research (Doctrine/Capstone) and just needs to be extended.

- **[high · confusion] Fit, Overall and the Projected verdict — the three biggest numbers in the Design Lab — are never defined**  
  *Where:* `src/screens/DesignLab.tsx:662-666 (Fit /100), :1361 (Overall N), :559-561 & :414-418 (verdict badge), :1370 (StatGlossary)`  
  *Problem:* The hero card leads with a big 'Fit 62 / 100' bar, the header carries a 'Projected hit / Steady seller' verdict badge, and the Launch tab shows 'Overall 74' — these are the numbers a player stares at while designing. Yet none of them is explained anywhere. The one explainer on the screen (StatGlossary at :1370) defines only the five component stats (performance/quality/battery/design/ecosystem), not Fit, not Overall, not the verdict. Players cannot tell that Fit = how well this matches what buyers want right now, Overall = raw build strength vs your last device, and Verdict = the projected launch result AFTER rivals drag it — three different things that move independently. The verdict can even flip while Fit is unchanged (competitionDrag, :421), which looks random without the definition. 'Fit' is also used pervasively in Market (demandFit/priceFit/fit at Market.tsx:1031,1056,1068) with the same silence.  
  *Fix:* Add a one-line definition beside each of the three scores, or a single tap-to-reveal explainer next to StatGlossary that names all three and the causal chain: 'Fit + your track record − rivals → Verdict.' Reuse the existing Glossary component (StatGlossary.tsx:15) with a small SCORE_INFO entry list so copy stays single-sourced.
- **[high · clarity] No lookup-from-anywhere help: the core Coach is one-shot and the glossaries are stranded at their point of use**  
  *Where:* `src/components/Coach.tsx:57-66 (hides once launched.length>0); src/components/Hud.tsx:100-107 (only Progress + Settings buttons); src/screens/Settings.tsx (no help/glossary row); src/components/Bank.tsx:91 & src/engine/glossary.ts:48-67 (TERM_INFO only in Bank)`  
  *Problem:* Once the player launches their first product the build Coach disappears forever with no way to summon it back, and the two glossaries only exist inline where they were placed: StatGlossary on the Design Lab Launch tab + Market, and the whole advanced-vocabulary TERM_INFO (Segment fit, Doctrine, Capstone, Nemesis, Board mandate, Megaproject, Legacy Points, Supplier loyalty, Region standing) exclusively inside the Bank popup. A player who forgets what 'Runway' or 'Nemesis' means three eras later has no consolidated place to look it up. The only replay affordance that exists (HQ.tsx:610 HelpCircle) is scoped to the Shop/Decorate tutorial. This was flagged in the roadmap (item 9) and remains unbuilt.  
  *Fix:* Add one persistent help entry — most naturally a tab/section in the existing Progress hub, or a row in Settings — that (a) opens a single consolidated glossary merging STAT_INFO + the new score defs + TERM_INFO, and (b) replays the core build Coach. This makes the whole vocabulary lookup-able from anywhere instead of only where it was first shown.
- **[medium · confusion] The Legacy Era card appears cold at IPO with Legacy Points / Board mandate / Megaproject unexplained**  
  *Where:* `src/screens/HQ.tsx:1095-1136 (LegacyEraCard header + megaproject slate), :1102 ('· N Legacy Points')`  
  *Problem:* Going public unlocks a whole new economy — Board mandates, Megaprojects, a Legacy Points spend-tree, and Frontier Tech — that all land at once in one card with no framing. The header just reads 'Board mandates & moonshots · 3 Legacy Points'; nothing says what a mandate is, what Legacy Points are for, or what funding a megaproject does at the moment they first appear. The FirstTimeNote system that would solve this (interruptIntros.ts) was built only for the 8 opportunistic interrupt systems, so this major persistent screen gets none of it. The copy already exists in TERM_INFO (glossary.ts:64-66) but is stranded in the Bank.  
  *Fix:* Show a one-time 'what this is' line at the top of the Legacy Era card on first appearance (a FirstTimeNote-style note, or reuse the Research inline-note pattern at Research.tsx:510), defining Legacy Points + mandate + megaproject in a sentence. Pull the copy from TERM_INFO so it can't drift.
- **[medium · clarity] Advanced-vocabulary coverage is inconsistent: Doctrine/Capstone got inline notes, Nemesis / Segment fit / Region standing / Supplier loyalty did not**  
  *Where:* `src/engine/glossary.ts:48-67 (TERM_INFO, Bank-only); src/screens/Research.tsx:510-511 (the good precedent)`  
  *Problem:* The point-of-use inline-note pattern proven on Research for Doctrine and Capstone (Research.tsx:510-511) was never extended to the other TERM_INFO concepts. Nemesis (surfaced as an HQ glyph), Segment fit (the whole 'Who it's for' breakdown in the Design Lab), Supplier loyalty (the loyalty bars in Sourcing), and Region standing (Market) all appear on screen with the mechanic visible but the definition only reachable by going to the Bank popup. So some concepts are explained where they live and equally-central ones are not, which reads as arbitrary.  
  *Fix:* Extend the Research.tsx:510 inline-note pattern to the remaining high-traffic terms at their point of use, sourcing each definition from TERM_INFO. Prioritize Segment fit (Design Lab 'Who it's for'), Nemesis (HQ glyph), and Region standing (Market) since those are seen most. A shared help hub (see the global-help finding) covers the long tail.
- **[medium · clarity] Skipping the core Coach is a single unconfirmed tap that permanently ends onboarding**  
  *Where:* `src/components/Coach.tsx:30 (skip X → dismissTutorial, no confirm)`  
  *Problem:* The Coach's skip button calls dismissTutorial directly on one tap, and because there's no way to replay the Coach (see the global-help finding), a stray tap on the small X in the corner ends the tutorial forever with no undo. A brand-new player who mis-taps loses all first-build guidance and can never get it back.  
  *Fix:* Make the skip a two-tap confirm ('Skip the tutorial?'), and/or keep a compact 'resume tutorial' pill available until the first launch actually happens. Pairs with adding a Coach-replay entry to the help hub so a skip is recoverable either way.
- **[low · progression] New meta systems shipped this round (Founder Legend, Frontier Tech, Goals Ledger, Decision Inbox) arrive with no first-time framing**  
  *Where:* `src/screens/FounderLegend.tsx (no intro/explainer copy); src/screens/HQ.tsx:1163-1177 (Frontier); src/state/interruptIntros.ts:15-24 (INTRO_COPY covers only the 8 interrupts)`  
  *Problem:* The FirstTimeNote / INTRO_COPY framing built this round deliberately covers only opportunistic interrupts, so the equally-new persistent meta systems get nothing. Founder Legend has no 'what this is' line explaining that it's an endless cross-run prestige TITLE ladder from lifetime stats (a search for intro/explain copy in FounderLegend.tsx returns nothing). Frontier Tech gets a single summary line in the Legacy card but no framing that it's the endless sink PAST the finite Legacy tree — a distinction a player won't infer. The result is that the game's newest depth is the least explained.  
  *Fix:* Add a one-line eyebrow/intro to each new meta surface (Founder Legend header, Frontier row, and the Goals Ledger / Decision Inbox first opens) saying what it is and how it differs from the nearby finite system it extends. These are static screens, so a plain subtitle line suffices — no need for the localStorage 'seen' machinery unless you want it to fade after first view.

### Moment-to-moment gameplay depth & pacing

The core loop is design → research → launch → sell → earnings, with time auto-advancing one week per timer tick (useGame.tsx:667-717) and a "skip to next decision" button (gameState.ts:4938) that is an explicit admission of dead weeks. The PRE-launch decision is genuinely deep (planProduction folds segments, price-fit, competition, novelty, brand equity, capacity — gameState.ts:1382-1563). The problem is everything AFTER a decision plays out passively over many auto-ticks. Post-launch sales run off a frozen precomputed weeklyUnits curve (salesCurve.ts); the three mid-life levers (cutProductPrice, marketingPush, restockProduct) are each capped at 3 fire-once redistributions, after which a product is 100% passive for the rest of its ~15-week life. Staff assignment, regions, factory-floor layout, and research are all "decide once, then wait" — the auto-advancing weeks between launches have almost nothing to look at or tune.

- **[high · depth] Post-launch sell phase is a frozen curve with only capped, fire-once levers**  
  *Where:* `src/engine/salesCurve.ts:52-70; src/state/gameState.ts:1764-1799 (tick reads lp.weeklyUnits[weeksElapsed]); cutProductPrice:3531, marketingPush:3596, restockProduct:3674; balance.ts:291/322/331 (maxPerProduct:3)`  
  *Problem:* At launch the entire lifecycle is baked into a weeklyUnits[] array; every subsequent week the tick just reads the next cell and books price×units. The only in-life interactions are price cut, marketing push and restock — each a one-shot demand REDISTRIBUTION capped at 3 per product. A 'steady' seller, or any product whose 3 levers are spent, is fully passive for the remaining ~15 weeks. There is no continuous operation to run while the auto-timer ticks, which is exactly why 'skip to next decision' exists.  
  *Fix:* Turn the sell phase into a light continuous loop instead of three capped one-offs. Give each active product a weekly ops state — inventory-on-hand vs. live demand with a player-set build/replenish RATE — so overproduction creates markdown risk and underproduction creates a visible stockout you fix week to week. This reuses the existing restock/price/push machinery but makes it a recurring knob rather than a spent-once button, giving auto-advancing weeks something to manage.
- **[high · depth] Restock is instant and free of lead-time, so supplier choice and sell-outs carry no timing tension**  
  *Where:* `src/state/gameState.ts:3674-3700 (restockProduct appends a wave from lp.weeksElapsed immediately, 'no new tooling'); supplier leadWeeks only used at initial build (suppliers.ts:199, gameState buildWeeksFor)`  
  *Problem:* A hit that sold out is answered by an instant restock that materializes new units the same week with zero lead time and no tooling cost. supplierLeadWeeks (the whole cheap-but-slow sourcing tradeoff) only ever affects the FIRST build — after launch, sourcing posture is irrelevant. So a sell-out is a costless click, not a supply-chain bet, and the interesting supplier axis goes dead the moment you ship.  
  *Fix:* Make restock arrive after the product's supplierLeadWeeks (and dual-source status), so reacting to a sell-out becomes a real 'reorder now and hope the wave hasn't passed' gamble. This makes the supplier lead-time choice matter across the product's whole life, converts a costless click into a timed decision, and gives the wait weeks stakes. Keep the demand cap so it still can't print money.
- **[high · depth] Staff are a global set-and-forget bucket with no project staffing or pipeline allocation**  
  *Where:* `src/engine/staff.ts:257-273 (ASSIGNMENT_DISCIPLINE rnd/design/marketing); src/engine/research.ts:197-212 (weeklyRp sums all rnd-assigned); boostMorale is the only recurring staff action (gameState.ts:4738, cooldown-gated cash button)`  
  *Problem:* You assign each hire to one of three global buckets once; they then accrue XP and contribute passively forever. Nothing ever forces reassignment — there is no 'staff THIS product's design' or 'put N engineers on this research to finish it sooner.' Between launches the team is inert. The only recurring staff interaction is a cooldown-gated morale cash button, so people are numbers that drift rather than a roster you actively deploy.  
  *Fix:* Bind the active design draft and the active research project to staffing with a visible progress bar (already have activeResearch.totalWeeks and disciplineOutput). Let the player concentrate designers/engineers to RUSH the thing they need now vs. let it bake, trading burn/morale against speed. This gives the between-launch weeks a real allocation loop and makes the deep per-discipline skill model (staff.ts:176-190) something you exploit weekly, not once.
- **[medium · depth] Regions are a one-time unlock; regionLoyalty only moves via random interrupts, never player action**  
  *Where:* `src/engine/regions.ts:33-74 (unlockCost, unlock-once), regionLoyaltyMul:171-176 driven by loyalty that only regionalEvents mutate; gameState.ts unlockRegion:1187`  
  *Problem:* Expanding is a single cash purchase that opens a region forever; thereafter regions are just checkboxes toggled into a launch's product.regions. Regional loyalty — the one dynamic regional quantity — moves ONLY through random regionalEvents interrupts, so the player has no agency over their standing in a market. The 'garage → global empire' map is a static shopping list, not a live board.  
  *Fix:* Add a lightweight per-region posture the player revisits: a distribution/marketing budget allocated across open regions that steers regionLoyalty over time (giving the player the lever that today only drifts randomly), or per-region price tiers played against each region's taste weights. Keeps the map an ongoing strategic surface without duplicating the launch positioning already in segments.
- **[medium · depth] Factory-floor depth is laid out once and detached from the weekly loop and product mix**  
  *Where:* `src/engine/factoryFloor.ts:569-664 (lineEfficiency, lineSpeedMult, topology via requiredKinds, lineUnitMult) — a company-wide build-time modifier set once in Factory Mode`  
  *Problem:* The floor system is genuinely deep (topology coverage of a recipe's machines, layout tidiness, per-machine upgrades) but you build it once and never return; its bonus applies company-wide regardless of what you're currently manufacturing. It contributes nothing to moment-to-moment play after the initial setup, and the requiredKinds topology matching never bites because one floor silently covers everything.  
  *Fix:* Tie the floor to the evolving product mix: switching product CATEGORY should require the floor to cover that recipe's requiredKinds (partial coverage → reduced lineSpeedMult until you retool), or add machine wear/maintenance that decays lineEfficiency over runs. Either makes the floor a recurring decision as your catalog shifts, cashing in the topology machinery that currently lies dormant.
- **[medium · other] Research is queue-and-wait with no live lever during the multi-week timer**  
  *Where:* `src/state/gameState.ts:2358-2375 (activeResearch completes when week-startWeek >= totalWeeks), startResearch:4117; research.ts launchRpReward:243`  
  *Problem:* You queue a project and the weeks tick until totalWeeks elapses — there is no in-flight interaction. RP accrues passively, the timer counts down passively. The only research 'moment' is the eureka interrupt, which is random and not player-initiated, so a player who wants to accelerate a breakthrough during a dead stretch has no move.  
  *Fix:* Add a 'surge' on the active project: spend cash or temporarily concentrate engineers to shave weeks off the remaining timer (diminishing returns, capped). This gives research a real-time knob to pull during the wait, complements the random eureka, and pairs naturally with the project-staffing loop in the staff finding.
- **[low · other] The auto-timer plus 'skip to next decision' treats the wait as filler by design**  
  *Where:* `src/state/useGame.tsx:667-717 (setInterval one week/tick), 681-688 (skipping → skipInterrupt → auto-pause); gameState.ts:4938 skipInterrupt`  
  *Problem:* Time advances on a fixed timer and the intended way to play through empty stretches is to press skip, which fast-forwards until skipInterrupt finds something needing input. That the fastest path through most weeks is to skip them is direct evidence the wait carries no per-tick content — a pacing symptom of the depth gaps above.  
  *Fix:* Once findings 1/3/5 add always-available weekly knobs (product ops, region posture, research surge), surface them in one compact 'this week' operations panel so any tick has something to read and adjust. The goal is to make 'skip' an optional convenience rather than the default way to experience the middle of the game.

### Late-game content &amp; long-term grind

The shipped meta-systems (Founder Legend, Frontier Tech, mandate scaling, Legacy Tree, megaprojects, rival acquisitions) give the post-IPO game a numeric floor, but every one of them is a monotone-easier or monotone-flat treadmill: nothing in the codebase ever makes a run HARDER for a bigger reward. legacyBonus (gameState.ts:677) only escalates the head-start each prestige, so New Game+ is a victory lap, not a challenge — the single biggest 10+ hour retention gap. The finite ladders (6 scenarios, 6 collections, ~65 achievements) all terminate in capstones, and the endless ones (Frontier tiers, Moonshot Programs, board mandates) are decision-free scalar buys with one repeated blurb. Eras hard-stop at 4, so long-term players only ever see bigger numbers, never new product content. The Founder Legend title climbs endlessly but unlocks nothing mechanical.

- **[high · progression] No ascension/heat difficulty — every New Game+ is strictly easier, so repeated prestige is a victory lap**  
  *Where:* `src/state/gameState.ts:677-686 (legacyBonus), :688 (newGame legacy arg); src/state/founderLegend.ts:128-136 (legendScore)`  
  *Problem:* legacyBonus escalates starting cash/rep/fans/RP triangularly forever (level 2 = x3, level 3 = x6...), so each prestige run starts MORE powerful than the last and finishes faster with less friction. There is no opt-in difficulty layer anywhere in the engine that makes a run harder in exchange for a bigger payoff. Founder Legend awards a flat +90 legendScore per prestige (founderLegend.ts:131) regardless of how the empire was built, so the endless prestige loop degenerates into 're-IPO on rails as fast as possible.' This is the classic missing roguelite-style ascension/heat spine — the exact mechanic (Hades Heat, Slay the Spire Ascension, Balatro stakes) that turns a 3-hour game into a 30-hour one — and it is completely absent.  
  *Fix:* Add an opt-in 'Ascension' (or 'Heat') ladder for New Game+: a set of stacking negative modifiers (colder demand, faster rival ramp, higher flop thresholds, no legacy head-start, tighter starting cash) that the player unlocks and enables one rung at a time. Multiply the run's Founder Legend contribution by the ascension level, gate the top numbered 'Founding Legend' rungs (founderLegend.ts:214) behind minimum ascension, and record best-ascension-cleared to the profile. This is sim-safe: a new optional ascensionLevel state field defaulting to 0 = today's exact behavior, and the modifiers ride the same BALANCE-override plumbing the challenge mutators already use (challenges.ts:46-48).
- **[high · late-game] Frontier Tech is a flat scalar treadmill with cosmetic-only milestones**  
  *Where:* `src/engine/frontier.ts:33-52 (frontierBonuses, frontierBandName)`  
  *Problem:* The endless post-IPO sink is one linear buy repeated forever: every tier is the same +5% RP / +2% hype / +1% build with a designCeiling bump every 10. frontierBandName (:44-52) upgrades the label ('Deep Frontier', 'Quantum Frontier'...) every 5 tiers but changes NOTHING mechanically — it is pure text. Unlike the finite Legacy Tree (legacyTree.ts) which at least forces a route choice (power/marketing/research/margin), Frontier has zero decisions and zero payoff events: after the tree is bought out, the richest phase of the game becomes clicking 'buy next tier' with a rising Legacy-Point price and no reason to care which tier you're on.  
  *Fix:* Give Frontier branch specializations (the player picks a lane per band, mirroring the Legacy Tree routes) OR attach a real one-time unlock at each band boundary (tier 5/10/15/20) — a new capability, a permanent event, an achievement, a company-cosmetic — so the endless grind delivers a discrete 'you unlocked something' beat, not just a bigger multiplier. Keep it folded through the same PerkBonus/prestigeBonuses plumbing so determinism holds.
- **[medium · late-game] Megaproject endless tail is one copy-pasted blurb**  
  *Where:* `src/engine/endgame.ts:68-89 (repeatableMegaproject)`  
  *Problem:* The four authored megaprojects (Quantum Fab -> Fusion Campus) are evocative set-pieces, but every moonshot past #4 is 'Moonshot Program N' with the identical name pattern and the identical blurb 'An open-ended research frontier — pour resources in, push the whole industry forward.' The single grandest recurring post-IPO ceremony collapses into a copy-paste cash+RP sink the moment the authored slate is exhausted, which for an engaged player is early in the endgame.  
  *Fix:* Cycle a pool of ~8-12 authored moonshot names/blurbs by index (orbital, biotech, deep-sea datacenter, AI-lab, space-elevator themes) so the endless tail reads as a rotating frontier program instead of Program 7, Program 8. Optionally make every Nth repeatable moonshot grant a small permanent unlock (a Frontier band, a legend point) so the sink has punctuation.
- **[medium · late-game] Board mandates are an infinite but memoryless quarterly checkbox**  
  *Where:* `src/engine/endgame.ts:157-195 (generateBoardMandate); src/state/gameState.ts:2556-2575 (auto-resolve loop)`  
  *Problem:* The one always-live post-IPO loop rotates 4 metrics (revenue/hits/fans/rank), auto-resolves at dueWeek, pays a flat cash+rep, and reissues. There is no state carried between mandates: no streak bonus for a run of met directives, no board-confidence/relationship track, no escalating directive tier you climb into, no penalty stack for lapses. So the recurring endgame directive has no progression spine — it is the same quarterly yes/no forever, and missing one costs nothing but a feed line.  
  *Fix:* Add a board-confidence meter (optional state field, defaults neutral = no-op) that rises with met mandates and falls with lapses; at confidence thresholds the board unlocks escalating directive tiers with richer rewards (or a governance perk), and a met-mandate streak compounds the payout. Gives the infinite loop a memory and a ladder to climb, sim-safe via a backfilled optional field.
- **[medium · late-game] Scenarios, Collections, and Achievements are all finite one-time ladders with terminal capstones**  
  *Where:* `src/engine/scenarios.ts:183-314 (6 scenarios, campaign caps at expert/9 stars); src/engine/collections.ts:61-68 (6 collections); src/engine/achievements.ts:607-647 (mastery tier ends at 'Grand Master')`  
  *Problem:* Every discrete-goal meta-surface dead-ends. SCENARIOS has 6 entries and the campaign chain tops out at the expert tier (9 stars to unlock, 18 total to 3-star everything); COLLECTIONS has 6 targets all reachable in a single moderate career (ship every category, 10 hits, 25 devices, franchise depth 5); ACHIEVEMENTS terminates at 'scenarios-all-3star' / 'Grand Master.' Once completed, none of these ever give the player another thing to chase — there is no escalating tier (50/100 devices, 25/50 hits, a 2nd franchise dynasty) and no procedural scenario that keeps scaling.  
  *Fix:* Add escalating collection tiers to collections.ts (Prolific II at 50, III at 100 devices; Hitmaker II/III at 25/50 hits; multiple concurrent dynasties) and a single procedural 'Gauntlet' scenario whose targets scale with the player's total earned stars, so the scenario picker never empties. Both are pure additive data, no sim change.
- **[medium · depth] Tech eras hard-stop at 4 — long-term players only get bigger numbers, never new product content**  
  *Where:* `src/engine/eras.ts:26-48 (ERA_CONTEXT capped at 4), :84-86 (maxEra); category unlockEra gating in catalogs.ts`  
  *Problem:* maxEra() is the AI Era (4), and all post-IPO content is a 'Legacy Era' bolt-on layered on top of the same era-4 category/component set. So a player 10 hours into the endgame is shipping the exact same product categories with the exact same component tiers they had at IPO — every late-game system (Frontier, mandates, megaprojects) adds scalar power but zero new *things to build*. The content that made the early game engaging (unlocking a new category, a new component tier) stops entirely at the pinnacle.  
  *Fix:* Add a post-IPO 'Frontier Era' (era 5) that unlocks one or two genuinely new experimental product categories/component tiers, gated on Frontier Tech tiers — this ties the numeric grind (Finding 2) to actual new product content and gives the endgame a fresh design/build loop, not just a bigger multiplier. Sim-safe: gate on wentPublic + a frontier threshold so the pinned solo sim never reaches it.
- **[low · progression] Founder Legend titles are cosmetic — the endless prestige identity unlocks nothing**  
  *Where:* `src/state/founderLegend.ts:155-167 (LEGEND_TIERS), :195-229 (legendStanding)`  
  *Problem:* The Founder Legend ladder is a well-built endless title spine, but reaching 'Market Maker' / 'Tech Titan' / 'Silicon Icon' grants only a name shown in the Progress hub and IPO overlay. Nothing in-game is tethered to it — no cosmetic, no starting-condition toggle, no ascension rung, no company-name theme. So the one truly endless cross-run progression has no mechanical hook; a player has no in-run reason to care about their title beyond the label.  
  *Fix:* Tether title tiers to unlocks: new company-name/office-decor themes at named rungs, an ascension rung gate (ties into Finding 1), or an optional starting-boon toggle unlocked at 'Empire Builder'+. Even purely cosmetic unlocks (museum frames, factory props) would give the legend ladder a reason to climb beyond the number.

### Systems inventory & bloat/overlap

The engine (67 non-test files) and state layer (18) are impressively non-vestigial — nearly every module is wired to the reducer and surfaced somewhere, so the bloat is NOT dead code; it is too many parallel LIVE systems competing for the same slice of the player's attention and mental model. Three overlap clusters dominate: (1) directed-goal/reward systems — the Goals Ledger folded only 3 of ~7 (objectives/contracts/mandate) while awards, sideOrders, collections, challenges, and franchise brand-equity each keep their own reward grammar (contracts.ts:1-6 openly documents this overlap); (2) permanent cross-run "trophy" surfaces — achievements.ts, collections.ts, and founderLegend.ts are three separate lifetime-prestige systems, each with its own Progress-hub row; (3) rival "alive" streams — nemesis/pendingRivalry, rivalStrike/pendingStrike, rival-vs-rival clashes, rivalArcs, and rivalAI are five systems all expressing "a rival is doing something," including TWO distinct full-screen rival interrupts. Separately, four systems (LaunchInsight, postmortem, reviews, forecast) all answer "why did/will this launch do what it does." The single highest-leverage next consolidation is to extend the Goals Ledger's row grammar to swallow awards + sideOrders, and to collapse the trophy trio into one Legacy surface.

- **[high · bloat] Goals Ledger folded only 3 of ~7 directed-reward systems**  
  *Where:* `src/state/goals.ts:1-14, src/engine/contracts.ts:1-9, src/engine/sideOrders.ts:1-6, src/engine/awards.ts:1-6`  
  *Problem:* collectGoals unified objectives + contracts + board-mandate into one row shape (goals.ts:16-101), but four MORE directed 'chase this, get a reward' systems still live as separate surfaces with their own grammar: awards (annual ceremony, cash/rep reward), sideOrders (factory commissions with a fee + deadline + pendingSideOrder interrupt), collections (museum collect-them-all), and challenges. contracts.ts:1-9 itself documents that it exists to fill the same 'what do I chase next' gap as objectives/awards/sideOrders — three of those four are still NOT in the ledger. A player chasing goals must consult the Goals Ledger, the Museum (collections), the awards overlay, the factory (side orders), and Challenges to see everything they're working toward. That is exactly the fragmentation the Ledger was meant to end, only partially delivered.  
  *Fix:* Extend the GoalRow grammar to include awards and sideOrders (both are 'directed goal -> reward on completion' with a deadline/frac and a reward summary — a near-perfect fit for the existing row shape). sideOrders already has sideOrderPayout + a deadline; awards has a next-ceremony date + eligible launches. Add sources 'award' and 'sideOrder' to GoalSource so the one ledger becomes the true single 'everything you're chasing' surface, and side orders/awards become rows there rather than separate interrupt+screen surfaces.
- **[high · progression] Three separate permanent cross-run trophy systems, three Progress rows**  
  *Where:* `src/engine/achievements.ts:1-10, src/engine/collections.ts:1-6, src/state/founderLegend.ts, src/screens/Progress.tsx:79-126`  
  *Problem:* achievements.ts (milestones a player discovers by playing well), collections.ts (museum 'collect them all' cross-run trophies), and founderLegend.ts (lifetime-stat TITLE ladder) are three independent permanent-prestige systems that all read lifetime/profile stats and hand out non-consumable trophies. The Progress hub gives each its own row — 'Founder Legend', 'Achievements', 'Device Museum' (collections) — so the hub is 6 rows (Progress.tsx:79-125) where 3 of them are the same conceptual thing ('permanent badges you accrue across runs'). This is cognitive load with no gameplay distinction: the player can't tell why a collection is different from an achievement is different from a legend tier.  
  *Fix:* This is the next consolidation after Goals Ledger. Fold achievements + collections into the Founder Legend surface as one 'Legacy' trophy wall (legend TITLE at the top, achievements + collection badges as the grid beneath), leaving the Museum screen purely as the device gallery. That drops the Progress hub from 6 rows to 4 (Goals / Legacy / Scenarios+Challenges / Museum) and gives the player ONE place for 'what have I permanently earned'.
- **[medium · confusion] Rival 'alive' theme is five overlapping systems with two full-screen interrupts**  
  *Where:* `src/engine/nemesis.ts:1-8, src/state/gameState.ts:1950-1965 (pendingStrike), src/state/gameState.ts:2657 (pendingRivalry), src/engine/competitors.ts:349-380 (rival-vs-rival), src/engine/rivalAI.ts:1-6`  
  *Problem:* Five systems all express 'a rival is doing something': nemesis (1:1 arch-rival with a heat meter + taunts + launch edge, raising pendingRivalry), rivalStrike (pendingStrike — a rival attacks one of your products), rival-vs-rival clashes (competitors.ts salt 239, leaderboard shifts on their own), rivalArcs (arcPhase lifecycle on each competitor), and rivalAI (renders a rival launch as a real product). From the player's seat, pendingStrike and pendingRivalry are TWO different full-screen rival takeovers that both mean 'your rival made a move against you', with no clear line between them — and they occupy two separate slots in INTERRUPT_ORDER (interruptPriority.ts:19-30). The nemesis relationship is the natural home for 'this rival struck you', but strike fires as its own top-priority stream independent of whether a nemesis even exists.  
  *Fix:* Make rivalStrike a beat OF the nemesis relationship rather than a parallel interrupt: when a nemesis exists, a strike is 'your nemesis hit you' (adds heat, routed through the rivalry stream); with no nemesis, a strike is a candidate CLASH that forms one. That collapses two full-screen rival interrupt slots into one coherent escalating rivalry, and gives the strike narrative weight instead of being a context-free 'a rival did a thing' popup.
- **[medium · noise] Two staff interrupt streams that read identically to the player**  
  *Where:* `src/design/interruptPriority.ts:24-28,83-84,104-105, src/engine/staffEvent.ts:1-6, src/engine/staffMoment.ts:1-8`  
  *Problem:* staffMoment (a tenured senior earns a permanent character upgrade the player picks) and staffEvent (a teammate hits a personal turning point — burnout, outside offer, milestone) are two separate derived-hash interrupt streams (salts differ), two adjacent slots in INTERRUPT_ORDER, both demoted to the Decision Inbox, both labeled with the 'Team' eyebrow, and near-indistinguishable in the inbox: 'A teammate is ready to grow' vs 'A teammate hit a turning point' (interruptPriority.ts:104-105). They consume two of the game's finite interrupt slots and each needs its own first-time framing intro, yet the player experiences both as 'open the inbox, make a small choice about a person'.  
  *Fix:* Merge into one 'Team moment' stream: keep both engine generators but route them through a single pendingTeamMoment / one inbox label / one first-time note, choosing which underlying beat to raise by tenure+context. Halves the staff-interrupt surface and the framing copy the player must learn, with zero loss of content.
- **[medium · clarity] Four overlapping launch-explanation systems**  
  *Where:* `src/engine/types.ts:169-186 (LaunchInsight), src/engine/postmortem.ts:1-8, src/engine/reviews.ts:1-6, src/engine/forecast.ts:1-9`  
  *Problem:* Four systems answer overlapping versions of 'why did/will this launch do what it does': LaunchInsight snapshots the launch-moment drivers, forecast.ts narrows a pre-launch confidence band, postmortem.ts scores the 2-3 decisive factors and writes a headline verdict, and reviews.ts turns the same recorded metrics into fictional press reviews. postmortem and reviews especially overlap — both are post-hoc, presentation-only reads of the same LaunchInsight/stats producing a qualitative verdict, differing mainly in voice (analytical headline vs press pull-quotes). A player looking at a launched product sees a postmortem verdict AND a reviews aggregate that can disagree in tone, both derived from identical data.  
  *Fix:* Merge the two post-hoc layers (postmortem + reviews) into one launch verdict surface: postmortem supplies the decisive-factor scoring/headline, reviews supplies the flavor voice, but they draw from one shared verdict computation so they can never disagree. Keep forecast (pre-launch) and LaunchInsight (the data record) distinct — those play genuinely different roles.
- **[low · confusion] Five parallel 'how the world regards you' meters**  
  *Where:* `src/state/gameState.ts:2249-2255,3632 (fans/brandAwareness), src/engine/community.ts:1-4, src/engine/franchise.ts:1-9, src/screens/Market.tsx`  
  *Problem:* The game tracks five distinct reputation-like quantities: reputation, fans, community sentiment (-1..+1, community.ts), brandAwareness (a decaying awareness pool, gameState.ts:2255,3632), and per-line franchise brand-equity (franchise.ts). They interact subtly (community modulates fan retention, franchise gives a launch edge) but to the player they are five overlapping 'is my brand strong' numbers, and brandAwareness is only surfaced on the Market screen with no cross-references, so its relationship to reputation/fans is opaque.  
  *Fix:* Not an urgent merge, but the next time this cluster is touched, consider folding brandAwareness into community/reputation rather than as a fifth standalone meter, or add a single 'Brand' readout that composes the five into one legible strength indicator with a breakdown — so the player reasons about one brand health, not five.
- **[low · noise] Interrupt-stream count itself is the ceiling — moratorium, not more salts**  
  *Where:* `src/design/interruptPriority.ts:18-47, CLAUDE.md salt registry (25+ derived-hash streams)`  
  *Problem:* INTERRUPT_ORDER already carries 11 opportunistic full-screen streams, plus pendingChoice/pendingPoach/pendingSideOrder outside it, and the CLAUDE.md salt registry lists 25+ derived-hash side channels. The budget gate + Decision Inbox manage FREQUENCY well, but every new stream still costs a priority slot, a first-time-framing intro (interruptIntros.ts), an inbox label, and a slice of the player's 'what kind of thing is this' schema. The marginal cost of stream #12 is schema load, which pacing controls can't reduce.  
  *Fix:* Treat the current 11 streams as a cap. Before adding any new interrupt stream, require it to REPLACE or merge into an existing one (e.g. the rival-strike-into-nemesis and staffEvent-into-staffMoment merges above free two slots). Prefer expressing new 'alive' content as new beats within an existing stream rather than a new pending* field + salt.

