# Silicon Tech Tycoon — Game Audit & Feature Roadmap

_Generated 2026-07-16. Five parallel code audits (opus 4.8 agents) orchestrated + synthesized (fable 5 agent) into one prioritized plan._

> **Method.** Five specialist agents each read the actual engine/state/screen code (not just the prior audit docs) across a distinct dimension — noise/interrupts, clarity/onboarding, moment-to-moment depth, late-game progression, and systems bloat/overlap. A sixth agent synthesized their findings into the executive summary, the noise-reduction plan, and the ranked feature list below.

---

## Executive summary

The five audits converge on one diagnosis: Silicon Tech Tycoon is not content-poor — it is content-misallocated. Decision density is crammed into two places: the (excellent) pre-launch Design Lab, and a barrage of 10+ full-screen interrupt streams plus 6 overlapping goal trackers that fire cold, bypass or saturate the shared budget, and bury the two things that actually matter on a 15-20-card HQ. Meanwhile the parts of the game where a player actually spends time are empty: the 16-week sell window is fully pre-baked at launch (the intended play is literally fast-forwarding), successor design collapses to "bump tiers and rename," research and staff are engineered to remove decisions, and the endgame has a hard cliff — 4 eras, a 12-perk fully-buyable Legacy Tree, rubber-stamp board mandates, and a prestige loop that wipes everything the richest phase built. The player perceives this as "noisy AND shallow" because both are true simultaneously: interruptions where nothing is at stake, silence where gameplay should be.

The strategy is three sequenced moves. (1) CALM: fold the off-budget decision streams into the existing governor, demote low-stakes interrupts from modals to an inbox/feed, restructure HQ around a priority zone, and add first-time framing + a global help/glossary — almost all presentation-layer, near-zero determinism risk. (2) REDISTRIBUTE: move gameplay into the dead time — a non-modal live-ops loop during the sell window, design constraints that make maxing wrong, ongoing marketing, recurring staff and research choices — all gated on optional fields that default to no-ops so the pin stays green. (3) COMPOUND: make the endgame accumulate — cross-run Legacy Stars, an endless Frontier Tech ladder, living board mandates, and a Founder Legend rank — so the grind the player asked for has a horizon that never closes. The unified interrupt framework (feature #2) is the keystone: it simultaneously deletes the noisiest duplication AND makes every subsequent content feature cheap to ship through one proven, determinism-safe channel.

---

## Part 1 — Make it less noisy & confusing

Ranked most-impactful first. Effort S/M/L; risk is against the deterministic-engine reproducibility pin.

| # | Change | Effort | Risk |
|---|--------|:---:|:---:|
| 1 | Fold the three off-budget decision streams — rival poaching (gameState.ts:2356), market choice events (2738-2760), and event chains (2732) — into the shared interrupt governor: add interruptQuiet && noPendingInterrupt(base) to their guards and stamp base.lastInterruptWeek when they fire. Critically, gate BEFORE any main-rng draw so draw order is unchanged when quiet. | S | low |
| 2 | Demote the low-stakes interrupt streams (staff moment, community ask, regional event, post-launch nudge) from full-screen sim-suspending overlays to inline HQ banners / a tappable Decision Inbox opened on the player's schedule. Keep every pending* field and reducer — change only the App.tsx presentation layer. Reserve full-screen for strike, earnings, license, awards, launch, IPO/era. | M | low |
| 3 | Raise BALANCE.interrupts.minGapWeeksLate from 2 to 4+ and add a two-tier priority so low-stakes streams can never consume the slot a strike/earnings/license beat needs (or coalesce them into one periodic digest card). | S | low |
| 4 | Add a calm-mode setting (busy / balanced / calm) in settings.ts that multiplies the minGapWeeks read at gameState.ts:1920 and demotes low-stakes streams to feed-only in calm. Default = current behavior. | S | low |
| 5 | Restructure HQ into a fixed priority zone (pending decisions + single NextMove, always on top) with the remaining ~15 cards collapsed into an expandable company digest / tabbed accordion (trackers share one surface; status cards share another). | M | low |
| 6 | Fix the HQ nav badge (gameState.ts:4292-4306): light it only for time-sensitive/decidable items (pendingChoice, pendingPoach, pendingSideOrder, claimableContract, canAdvance/canIPO); demote affordableMegaproject and spendableLegacyPoint to a subtle non-pulsing indicator. | S | low |
| 7 | Export one shared higherPriorityPending(state, self) helper (built on noPendingInterrupt at gameState.ts:966) and replace every overlay's hand-maintained sibling-pending list (PostLaunchEvent checks 11, RegionalEvent 7, CommunityAsk 4). | S | low |
| 8 | Milestone-gate the cold interrupts and add first-time framing: each stream fires only once its host system is reachable (RegionalEvent after a 2nd region, EarningsCall post-IPO, CommunityAsk after a fan threshold; suppress all until tutorialDone && launched.length >= 2), with a one-line 'what this is' eyebrow on first appearance via per-stream seen-flags backfilled to true on existing saves. | M | low |
| 9 | Add a global help entry (HUD or Settings): replay the core Coach, open a consolidated glossary merging STAT_INFO + TERM_INFO, and link the Decorate/Factory tutorials. Make skipping the Coach a two-tap confirm. Additionally surface TERM_INFO definitions at point of use (nemesis glyph on HQ, Megaproject/Legacy Points on LegacyEraCard) following the proven Research.tsx:510 inline-note pattern. | M | low |
| 10 | De-duplicate confirmations: suppress feed lines and toasts that restate a modal currently on screen (each interrupt today fires a modal AND a feed.push), audit the 132 showToast sites for card-duplicating toasts, and consolidate the launch celebration fan-out (confetti + celebrate + office cheer + sfx + toast) into one coordinated moment. | M | low |
| 11 | Sync the skipInterrupt stop-list (gameState.ts:4899-4917) with the intended contract: after low-stakes streams are demoted, add the remaining true-decision pendings (earnings, license offer, rivalry) and deliberately exclude inbox-tier items. | S | low |
| 12 | Clarify the Design Lab's three scores (Fit /100, Overall, projected verdict) with a one-line definition each and a 'Fit + track record → Verdict' tap-to-reveal; apply Company.tsx's hasShipped progressive-disclosure pattern to Research (era roadmap, doctrine forks) and Market (rank board) pre-first-ship; show concrete consequences on the over-capacity picker ('Accept defects — quality -8, permanent on this device'). | M | low |

### Rationale detail

**1. (S / low risk)** Fold the three off-budget decision streams — rival poaching (gameState.ts:2356), market choice events (2738-2760), and event chains (2732) — into the shared interrupt governor: add interruptQuiet && noPendingInterrupt(base) to their guards and stamp base.lastInterruptWeek when they fire. Critically, gate BEFORE any main-rng draw so draw order is unchanged when quiet.

> These are the two most frequent decision prompts in the game and they currently land in the same week as full-screen modals, breaking the single-governor promise. They already retry on later ticks, so gating defers rather than drops them. The pinned run keeps lastInterruptWeek=-999, so the added gates are no-ops there.

**2. (M / low risk)** Demote the low-stakes interrupt streams (staff moment, community ask, regional event, post-launch nudge) from full-screen sim-suspending overlays to inline HQ banners / a tappable Decision Inbox opened on the player's schedule. Keep every pending* field and reducer — change only the App.tsx presentation layer. Reserve full-screen for strike, earnings, license, awards, launch, IPO/era.

> Six of the mounted overlays carry rival-strike weight for RP/mood/fan pocket change. This is the single largest driver of 'the game keeps stopping me for nothing,' and it is engine-untouched.

**3. (S / low risk)** Raise BALANCE.interrupts.minGapWeeksLate from 2 to 4+ and add a two-tier priority so low-stakes streams can never consume the slot a strike/earnings/license beat needs (or coalesce them into one periodic digest card).

> With 8+ chronically-refilling streams, the min gap IS the cadence: ~26 takeovers/year in the late eras, exactly when builds are longest. The 'more should happen late' rationale is backwards for a noise complaint. Balance-constant change; the pinned solo run raises no interrupts so it is unaffected.

**4. (S / low risk)** Add a calm-mode setting (busy | balanced | calm) in settings.ts that multiplies the minGapWeeks read at gameState.ts:1920 and demotes low-stakes streams to feed-only in calm. Default = current behavior.

> The player's only current way to reduce modals is to avoid triggering systems they can't see. A UI-read setting cannot touch determinism and is the highest-leverage 'calmer without deleting content' lever.

**5. (M / low risk)** Restructure HQ into a fixed priority zone (pending decisions + single NextMove, always on top) with the remaining ~15 cards collapsed into an expandable company digest / tabbed accordion (trackers share one surface; status cards share another).

> HQ is a 15-20-card wall where the two actionable items are buried in ambient chrome — the persistent-noise twin of the modal problem. Pure presentation.

**6. (S / low risk)** Fix the HQ nav badge (gameState.ts:4292-4306): light it only for time-sensitive/decidable items (pendingChoice, pendingPoach, pendingSideOrder, claimableContract, canAdvance/canIPO); demote affordableMegaproject and spendableLegacyPoint to a subtle non-pulsing indicator.

> Two always-affordable spend conditions keep the dot chronically lit late-game, training the player to ignore the one lightweight signal that could replace full-screen interrupts.

**7. (S / low risk)** Export one shared higherPriorityPending(state, self) helper (built on noPendingInterrupt at gameState.ts:966) and replace every overlay's hand-maintained sibling-pending list (PostLaunchEvent checks 11, RegionalEvent 7, CommunityAsk 4).

> The divergent lists are a latent modal-stacking bug that rots every time an interrupt is added. One-file fix closes the bug class and is a prerequisite for the interrupt-framework feature.

**8. (M / low risk)** Milestone-gate the cold interrupts and add first-time framing: each stream fires only once its host system is reachable (RegionalEvent after a 2nd region, EarningsCall post-IPO, CommunityAsk after a fan threshold; suppress all until tutorialDone && launched.length >= 2), with a one-line 'what this is' eyebrow on first appearance via per-stream seen-flags backfilled to true on existing saves.

> A dozen overlays currently introduce entire subsystems cold as decisions. Gating + one line of framing turns the 'alive world' layer from confusing to anticipated. Backfilled flags preserve determinism.

**9. (M / low risk)** Add a global help entry (HUD or Settings): replay the core Coach, open a consolidated glossary merging STAT_INFO + TERM_INFO, and link the Decorate/Factory tutorials. Make skipping the Coach a two-tap confirm. Additionally surface TERM_INFO definitions at point of use (nemesis glyph on HQ, Megaproject/Legacy Points on LegacyEraCard) following the proven Research.tsx:510 inline-note pattern.

> Onboarding is single-shot and deletable with one mistap, and the depth vocabulary is defined only inside the Bank. This is the cheapest fix for 'confusing' that also unblocks every depth feature below.

**10. (M / low risk)** De-duplicate confirmations: suppress feed lines and toasts that restate a modal currently on screen (each interrupt today fires a modal AND a feed.push), audit the 132 showToast sites for card-duplicating toasts, and consolidate the launch celebration fan-out (confetti + celebrate + office cheer + sfx + toast) into one coordinated moment.

> Redundant multi-channel surfacing inflates perceived noise even outside the interrupt system. Presentation-only.

**11. (S / low risk)** Sync the skipInterrupt stop-list (gameState.ts:4899-4917) with the intended contract: after low-stakes streams are demoted, add the remaining true-decision pendings (earnings, license offer, rivalry) and deliberately exclude inbox-tier items.

> The list has drifted like the pre-noPendingInterrupt chains did; fixing it turns skip into a genuine quiet fast-forward that itself reduces perceived noise.

**12. (M / low risk)** Clarify the Design Lab's three scores (Fit /100, Overall, projected verdict) with a one-line definition each and a 'Fit + track record → Verdict' tap-to-reveal; apply Company.tsx's hasShipped progressive-disclosure pattern to Research (era roadmap, doctrine forks) and Market (rank board) pre-first-ship; show concrete consequences on the over-capacity picker ('Accept defects — quality -8, permanent on this device').

> Three unexplained meta-scores on the game's most important screen, plus day-one aspirational surface on Research/Market, is where new-player confusion concentrates. All copy/visibility changes.

---

## Shipped in this pass — Calm Mode (noise reduction #4)

The single highest-leverage, lowest-risk noise fix from Part 1 is **implemented and tested** in this branch: a player-facing **Calm Mode** control (Settings → *Interruptions*: Standard / Relaxed / Calm).

- **What it does.** Scales the shared interrupt quiet-gap: Relaxed ≈ half as many opportunistic full-screen moments, Calm ≈ a third. No content is deleted — moments just land rarer and carry more weight.
- **How it's built (determinism-safe).** New optional `interruptPace` field on `GameState` read at the single interrupt gate in `advanceOneWeek` via `interruptPaceMultiplier()`. `undefined`/`"standard"` → multiplier 1, so old saves and the pinned solo sim are byte-identical. The choice persists across companies in the settings store and is seeded into each run at the UI seam (`withInterruptPace`), keeping the pure engine untouched.
- **Why this one first.** It directly answers "make the game less noisy" by handing the player control, it breaks no existing test, and it reverses none of the game's deliberate design decisions (two other audit noise-recommendations — demoting the HQ nav badge and *raising* the late-era gap — conflict with intentionally-encoded tests, so they're design pivots to discuss, not safe cleanups).
- **Tests.** +3 cases in `interruptBudget.integration.test.ts` (multiplier mapping; Calm defers the earnings call 3× longer; undefined behaves exactly like Standard). Full suite: **1112 pass**, determinism pin green.

The rest of Part 1 and all of Part 2 remain as the planned roadmap below.

---

## Recommended build order

The synthesis argues for three sequenced moves — **Calm → Redistribute → Compound**:

1. **Calm (mostly done / cheap).** Calm Mode ✅. Then the remaining presentation-layer wins: milestone-gate the cold interrupts (#8), HQ priority zone (#5), de-dup confirmations (#10), global help/glossary (#9). Discuss the two test-conflicting items (nav badge, late-era gap) before touching them.
2. **Redistribute (fill the dead time).** Feature #1 *Live Ops: the managed sell window* is the keystone for depth — it puts gameplay in the empty weeks **without** spending the interrupt budget. Build #2 *Unified Interrupt Framework* alongside it: it deletes the noisiest duplication and makes every later feature cheap to ship through one proven channel.
3. **Compound (never-closing horizon).** #3 Legacy Stars → #4 Frontier Tech → #5 Goals Ledger → #9 Founder Legend ladder give the long-term grind a currency, an endless ladder, a live goal loop, and a title that always climbs.

---

## Part 2 — More gameplay & late-game to grind toward: the ranked 10

Ranked best-first (rank 1 = build first). Each is buildable under the repo pattern: **pure engine gated on optional/backfilled state fields (default no-op) → derived-hash interrupt → opt-in reducer → staged overlay**, so the reproducibility pin stays byte-identical.

| Rank | Feature | Category | Effort |
|:---:|---------|:---:|:---:|
| 1 | Live Ops: the managed sell window | depth | L |
| 2 | Unified Interrupt Framework + Decision Inbox | clarity | L |
| 3 | Legacy Stars: compounding prestige | progression | M |
| 4 | Frontier Tech: the endless post-IPO tech ladder | late-game | L |
| 5 | Goals Ledger with living board mandates | clarity | M |
| 6 | Design constraints: make maxing wrong | depth | M |
| 7 | Share-of-voice marketing campaigns | depth | M |
| 8 | Staff arcs: specializations and project teams | depth | M |
| 9 | Founder Legend ladder + rank bosses | social | S |
| 10 | Competing research initiatives + repeatable labs | late-game | M |

### 1. Live Ops: the managed sell window

**Category:** depth · **Effort:** L

Turn the dead 16-week sell curve into managed weeks: occasional supply shocks to answer (pay to expedite vs. accept a stockout), a week-4 'sustain vs. harvest' call trading tail length for margin, and demand-signal windows that let you re-weight regions mid-run — all surfaced as inline ops cards on Market/HQ, never as modals, with the existing price-cut/push/restock levers folded into the same ops loop.

**Pros**

- Directly fixes the single largest passivity source — the entire commercial life of every product currently auto-resolves with zero input
- Non-modal by design: adds gameplay to most weeks WITHOUT consuming the interrupt budget, serving calm and depth at once
- Reuses existing machinery (the 3-use levers, segment breakdown, regions) rather than adding a parallel system
- Converts 'Skip to next decision' from the intended play pattern into an occasional convenience

**Cons**

- Largest engine surface of any feature here — touches sales bookkeeping, so determinism testing must be rigorous
- If ops cards fire too often it re-creates the noise problem in a new channel; frequency needs a hard cadence cap
- Ignoring ops must stay viable (idle players exist), which constrains how impactful each decision can feel

**Fits determinism:** The baked weeklyUnits array stays the untouched baseline; interventions live on a new optional lp.opsState field defaulting absent (do-nothing run = byte-identical, pin green). Shock timing/type comes from a derived hash of (seed, week, salt) with a fresh salt (e.g. 277), never the main sim RNG. Player choices apply as pure deltas over the baked curve in the weekly tick.

**Why this rank:** Ranked 1 because it is the consensus top finding of the depth audit, it fills the game's biggest empty space (the time between launches), and its non-modal channel is the structural answer to the noise complaint — the rare feature that maximally serves both of the owner's goals at once.

### 2. Unified Interrupt Framework + Decision Inbox

**Category:** clarity · **Effort:** L

Collapse the 7+ parallel choice-card systems into one InterruptCard type ({eyebrow, glyph, title, body, options[{label, blurb, effect}]}), one pendingInterrupt field, one resolveInterrupt reducer, and one overlay — plus a Decision Inbox where low-stakes cards land for resolution on the player's schedule instead of taking over the screen.

**Pros**

- Deletes ~6 overlay components, ~6 reducers, ~6 pending fields, ~6 CSS blocks and permanently closes the divergent-guard modal-stacking bug class
- Every future content feature (ranks 1, 6, 8, 10) ships through this one proven channel — it is a force multiplier for the whole roadmap
- Players learn one card grammar instead of ten visually distinct modal types; the inbox is the permanent home for the demoted low-stakes streams
- Merges StaffMoment/StaffEvent (already sharing .stfm CSS) as a free first migration

**Cons**

- Big refactor across 7 systems with save-shape migration for in-flight pending* fields — must be backfill-safe
- Player-invisible on day one; the payoff is downstream velocity, which requires discipline to justify
- A too-generic card type risks flattening the distinct flavor of eureka vs. strike vs. community — generators must keep their identity

**Fits determinism:** Per-system generators keep their existing derived-hash salts and gating unchanged — only the emitted shape and the presentation consolidate. Pending-field migration backfills old saves; the pinned run raises no interrupts so the framework is a no-op there.

**Why this rank:** Ranked 2 because it is the keystone: it delivers the bloat audit's top two findings, makes the noise-reduction demotions permanent rather than ad hoc, and cuts the cost of every feature below it. It sits behind Live Ops only because that feature is player-visible value on day one.

### 3. Legacy Stars: compounding prestige

**Category:** progression · **Effort:** M

Persist lifetime Legacy Points and funded-megaproject count into the profile as Legacy Stars, spendable on a small permanent cross-run perk tree; unspent per-run Legacy Points convert to Stars at prestige instead of evaporating.

**Pros**

- Fixes the late-game audit's #1 finding: the richest phase currently leaves zero trace, so New Game+ feels like starting over instead of ascending
- Cheap for its impact — it reads counters the engine already tracks and extends the existing legacy.ts persistence pattern
- Gives board mandates, megaprojects, and the Frontier ladder (rank 4) a shared currency to feed, unifying the endgame economy
- Directly answers the owner's 'things to grind towards' in the most literal way possible

**Cons**

- Permanent cross-run buffs risk trivializing the early game after many prestiges — needs a diminishing-returns curve and mostly-lateral perks
- Another currency and tree to explain (mitigated by the global glossary and Goals Ledger work)
- Retroactive fairness question for existing prestiged players who already lost their Legacy Eras

**Fits determinism:** Stars live in cross-run profile storage alongside the existing legacy int — entirely outside the sim. Their in-run effects apply once at newGame() setup (like legacyBonus today), so each run remains a pure function of (seed, profile). The pinned test uses a fresh profile and is untouched.

**Why this rank:** Ranked 3 because it is the highest value-per-effort item on the grind axis: an M-effort change that converts the endgame from a disposable loop into true meta-progression, and it is the economic foundation ranks 4, 5, and 9 build on.

### 4. Frontier Tech: the endless post-IPO tech ladder

**Category:** late-game · **Effort:** L

After era 4, a Frontier track keeps generating deterministic prestige-tier component tiers and frontier research projects, gated on Legacy Points — reusing the tier/catalog machinery and the repeatableMegaproject scaling pattern so 'unlock better tech' never permanently ends.

**Pros**

- Removes the game's hardest content cliff: the core tycoon fantasy (next tier of tech) currently dies at era 4 with nothing replacing it
- Gives Legacy Points a permanent sink so the currency never dead-ends once the 12-perk tree is bought out
- Feeds the design loop with genuinely new components, so late-game launches stay interesting rather than repeats
- Repeatable moonshots can unlock frontier tiers as tangible rewards, fixing the 'Moonshot Program N reused-blurb' finding for free

**Cons**

- Procedurally-extended tiers risk feeling samey without authored names/flavor per band — needs a curated naming table
- Score/price escalation must be tamed or late-game numbers run away from the mandate/valuation economy
- Scope creep risk if it tries to also scale rivals/segments — v1 should be tiers + costs only

**Fits determinism:** Gated on wentPublic plus an optional frontierTier state field defaulting absent (no-op for the pin and all existing saves). Tier stats/costs are pure deterministic functions of tier index; any offer rotation uses a fresh derived-hash salt (e.g. 281). Reuses existing catalog/research plumbing rather than new systems.

**Why this rank:** Ranked 4 because it restores the game's central progression fantasy for the long tail; it follows Legacy Stars because Stars define the currency and prestige frame the Frontier spends against.

### 5. Goals Ledger with living board mandates

**Category:** clarity · **Effort:** M

One goal surface with a single evaluator interface (metric, target, reward, source) that folds the objectives ladder, rolling contracts, and post-IPO board mandates into a unified ledger — and rebuilds mandates to scale off trailing quarterly revenue/valuation with Legacy-Star rewards instead of capped fixed dollars.

**Pros**

- Collapses four competing 'what do I chase next' surfaces into one, directly serving the less-noisy goal
- Fixes the rubber-stamp mandate finding: targets tied to live company scale keep the endgame's quarterly heartbeat tense forever
- Mandate rewards paying prestige currency wire the recurring loop into the meta-progression (rank 3) instead of rounding-error cash
- contracts.ts's own header admits it patched a gap between siblings — this is the consolidation it was asking for

**Cons**

- Three reward pipelines to migrate carefully; regression surface across objectives, contracts, and mandates
- Percentage-of-trailing-revenue targets need guardrails or a windfall quarter makes the next bar impossible
- Over-unification could flatten what makes contracts vs. mandates feel different — keep source flavor in the ledger rows

**Fits determinism:** Evaluators are pure reads of state the engine already tracks; mandate scaling is a pure function of recorded trailing revenue, replacing constants in generateBoardMandate. Contract generation keeps its existing salts. The surface unification is presentation-only; changed mandate math is gated behind an optional field so old saves finish their issued mandates unchanged.

**Why this rank:** Ranked 5 because it is the rare M-effort item that scores on all three owner goals simultaneously: fewer competing surfaces (calmer), a meaningful recurring endgame loop (grind), and one obvious place to look (clearer).

### 6. Design constraints: make maxing wrong

**Category:** depth · **Effort:** M

Per-project BOM/design budget that grows with company scale, era-limited supply of the hottest component tier (you choose which product gets it), and novelty.ts finally surfaced in the launch breakdown so shipping the same maxed build visibly decays appeal — restoring real per-generation tradeoffs to the Design Lab.

**Pros**

- Fixes the mid-game collapse where successor design degrades to 'bump tiers, rename, launch' on the game's richest screen
- Novelty already exists as a hidden deterministic modifier — surfacing it is nearly free and fixes the 'invisible mechanic' bloat finding simultaneously
- Creates a natural flagship-vs-value product-line strategy, adding depth without any new screens
- Seeding successor drafts with a deliberate gap (don't copy tuning/brief) is an S-size quick win inside this feature

**Cons**

- Constraining freedom can read as punitive if tuned tight — budgets must feel like puzzles, not taxes
- Changes optimal-play math, so synergy/archetype scoring needs a rebalance pass and the determinism-pinned expectations reviewed
- Scarcity requires clear UI ('2 QuantumCore allocations left this era') or it becomes new confusion

**Fits determinism:** Budget ceiling and tier-supply counters live on optional state fields defaulting to unlimited — a do-nothing or legacy run is byte-identical and the pin stays green. Novelty surfacing is pure UI over already-deterministic sim state. No new randomness anywhere.

**Why this rank:** Ranked 6 because mid-game design is the loop players repeat most, and this is the cheapest way to keep it a decision — but it lands best after the clarity work (ranks 2, 5) gives its new concepts a place to be explained.

### 7. Share-of-voice marketing campaigns

**Category:** depth · **Effort:** M

Replace the one-shot pre-launch hype ladder with a running campaign per live product: a weekly spend you dial up or down against a decaying buzz meter (buzz.ts) that responds to rival launches, with segment targeting retargetable mid-run — folding the capped 'push' lever into the same system.

**Pros**

- Gives the sell window a second ongoing lever that composes with Live Ops (rank 1) — managing share-of-voice during rival launches is real gameplay
- Reuses buzz.ts, which currently only feeds the ticker, so an existing system earns its keep instead of a new one being added
- Makes rival launches interactive events you respond to rather than feed lines you read

**Cons**

- Another weekly dial risks cognitive load — needs a sensible set-and-forget default so idle players aren't punished
- Marketing-spend-to-revenue tuning is fiddly and can dominate or trivialize the economy if wrong
- Overlaps the existing push lever and campaignHype; must replace them cleanly, not stack a third marketing concept on top

**Fits determinism:** Campaign state is an optional per-product field defaulting off — absent, launch-time campaignHype applies exactly as today and the pin is untouched. Weekly buzz effects are pure functions of spend, decay, and rival-launch events already in deterministic state; no new RNG or salt needed.

**Why this rank:** Ranked 7 because it deepens the same dead window as rank 1 and should ship after it — the ops loop defines the in-flight decision surface this plugs into. High fit, moderate effort, but additive rather than foundational.

### 8. Staff arcs: specializations and project teams

**Category:** depth · **Effort:** M

On level-up, a staffer offers a specialization pick (deepen a discipline branch); star staff can be assigned to a specific in-progress build for a product bonus at the cost of their weekly output; delegation research automates these with a small efficiency haircut instead of full autopilot.

**Pros**

- Gives staff a recurring decision that survives delegation — today the system is engineered to trend toward zero interaction
- Project-team assignment finally connects 'my people' to 'my products,' a fantasy payoff the game gestures at but never delivers
- Level-up picks flow through the unified interrupt inbox (rank 2) as low-stakes cards — zero new modals, zero new budget pressure

**Cons**

- Risks reintroducing exactly the chores idle-leaning players researched delegation to escape — hands-off must remain viable, just slightly less optimal
- Interacts with the morale/churn/People-Lead balance, so the auto-resolve tick needs careful regression
- Specialization branches are authored content — a thin tree feels worse than none

**Fits determinism:** Specialization is an optional per-staff field defaulting none (no-op; pin unaffected). Level-up offers are player decisions raised as inbox cards — timing derives from existing deterministic XP thresholds, so no new randomness; if flavor variation is wanted, a fresh derived-hash salt (e.g. 283) for the offer text only.

**Why this rank:** Ranked 8 because it converts a set-and-forget system into a light ongoing one, but it depends on the inbox (rank 2) to avoid becoming interrupt noise, and its player value is narrower than the product-facing features above it.

### 9. Founder Legend ladder + rank bosses

**Category:** social · **Effort:** S

An endless cross-run title ladder (Garage Founder → ... → Industry Legend) that advances on lifetime profile counters (total hits shipped, lifetime Legacy Points, cumulative peak valuation), displayed on the Company screen — and in prestige runs, hitting leaderboard #1 spawns a stronger named challenger above you using the existing nextRankRival machinery.

**Pros**

- The cheapest feature on the list that gives the engaged-player tail a number that never stops climbing — fills the mastery-ladder gap at S effort
- Makes leaderboard #1 a rung instead of a ceiling, reusing rank-ladder machinery that already exists and is tested
- Compounds the motivation loop of Legacy Stars (rank 3): every run advances something visible even when the run itself fails

**Cons**

- Purely numeric prestige can feel hollow unless a few rungs carry small cosmetic/museum rewards
- Boss-rival stat scaling needs a real curve or challengers become unbeatable walls or trivial speed bumps
- One more surfaced number — must live inside existing Company/profile UI, not a new badge or screen

**Fits determinism:** The ladder reads cross-run profile counters entirely outside the sim. The boss rival is generated deterministically at newGame() from (seed, legacy level) via the established pattern; no mid-run randomness, no new state on the pinned path (fresh profile = base ladder, no boss).

**Why this rank:** Ranked 9 because it is pure upside at S effort but is a garnish, not a meal — it amplifies the grind systems above it (3, 4, 5) rather than standing alone, so it ships after they exist to have something worth titling.

### 10. Competing research initiatives + repeatable labs

**Category:** late-game · **Effort:** M

From era 2 on, research offers 2-3 competing initiatives per cycle with only one active at a time (real opportunity cost replacing 'accrue RP, auto-buy everything'), plus repeatable rising-cost lab levels as a late-game RP sink before and alongside Frontier Tech.

**Pros**

- Restores a live decision to a system that goes inert mid-game — the researchReady badge already admits tier buys aren't decisions
- Repeatable labs give RP a permanent home so the resource never becomes dead currency in long runs
- Self-contained: touches only the research module and one screen, making it a low-risk depth add

**Cons**

- Slows the tech pace — players accustomed to buying everything may chafe, so exclusivity windows need generous cycling
- Initiative slates need enough authored variety or every campaign converges on the same picks, recreating the problem
- Overlaps Frontier Tech (rank 4) at the endgame boundary — must be sequenced as the mid-game complement, not a duplicate sink

**Fits determinism:** Gated on an optional researchInitiatives state field defaulting to today's open-list behavior — the pin and all existing saves are byte-identical no-ops. Initiative slates draw from a derived hash of (seed, cycleIndex, fresh salt e.g. 293), never the main sim RNG, following the established gated-optional-state pattern exactly.

**Why this rank:** Ranked 10 because it is a solid, well-fitting depth fix but the narrowest in impact: research inertness bothers players less than the dead sell window or the endgame cliff, and Frontier Tech already carries the late-game research load — this rounds out the mid-game after everything above lands.

---

## Appendix — Full audit findings by dimension

### Noise & interruption overload

The ~10 full-screen cadence interrupts genuinely share one governor: interruptQuiet is read from a tick-start lastInterruptWeek const, and each firing writes base.lastInterruptWeek + sets a pending* that noPendingInterrupt() (gameState.ts:965) blocks the rest of the tick on — so within a week only one full-screen modal fires, and minGapWeeks paces them across weeks. That machinery is sound. The problems are around its edges. First, three decision streams — market choice events (2738-2760), rival poaching (2356), and event chains (2732) — run on their OWN cadences and never gate on interruptQuiet or stamp lastInterruptWeek, so an HQ "Decision required" card can land the same week as any full-screen modal. Second, the "budget" is only a minimum spacing, not a cap: with 8+ streams chronically refilling, minGapWeeksLate=2 becomes the actual late-game cadence (a modal as often as every ~2 weeks). Third, there is no player-facing way to mute or slow any of this, the HQ screen stacks 15-20 persistent cards, and the HQ nav badge is lit by 8 OR-conditions so it stops meaning anything. The highest-impact, lowest-risk fixes fold the off-budget decision streams into the shared governor and add a calm-mode/digest, all backfill-safe against the determinism pin (which stays at lastInterruptWeek=-999 and raises no interrupts, so the added gates are no-ops there).

- **[high · noise] Market choice events and rival poaching bypass the shared interrupt budget entirely**  
  *Where:* `src/state/gameState.ts:2356 (poach), src/state/gameState.ts:2738-2760 (choice events), src/state/gameState.ts:965-968 (noPendingInterrupt)`  
  *Problem:* The full-screen interrupt governor only covers the cadence-driven overlays. Rival poaching (line 2356) gates ONLY on `!base.pendingPoach && !base.pendingChoice` — no interruptQuiet, no lastInterruptWeek stamp — and it runs mid-tick AFTER strike (1924) and awards (1959), which may already have set base.pendingStrike/base.pendingAwards this same tick. Market choice events (2738) fire on a totally separate cadence (BALANCE.events.everyWeeks=11 ± jitter 6, balance.ts:1129) gating only on `!base.pendingPoach` and `!state.pendingChoice`, and it is a `return` at the end of the tick so it commits on top of whatever full-screen pending was already set. Net effect: in one week a player can face a full-screen RivalStrike/Eureka/Earnings/etc modal AND an HQ 'Decision required' choice/poach card. The docs claim a single governor, but the two most frequent decision prompts sit outside it.  
  *Fix:* Add `interruptQuiet && noPendingInterrupt(base)` to the poach guard (2356) and the choice/chain guard (2738/2732), and stamp base.lastInterruptWeek = week when they raise a pending. They already retry on later ticks (poach is a per-week chance; choice re-checks nextEventWeek), so gating just defers them to a quiet week rather than dropping them. Determinism-safe: the pinned solo run keeps lastInterruptWeek=-999 so interruptQuiet is always true and behavior is byte-identical there. Caution: choice-event scheduling consumes the main sim rng (rng.int for nextEventWeek) — gate on interruptQuiet BEFORE drawing so the rng draw order is unchanged when quiet, preserving the pin.
- **[high · bloat] The 'budget' is a minimum gap, not a cap — 8+ refilling streams make ~1 modal every 2 weeks the steady-state late game**  
  *Where:* `src/engine/balance.ts:313-317, src/state/gameState.ts:1920-1921`  
  *Problem:* minGapWeeks=3 (eras 1-2) / minGapWeeksLate=2 (eras 3+) is the ONLY global throttle. Each opportunistic stream (eureka, community, staff moment, staff life event, regional event, post-launch, license offer, rivalry, plus per-quarter earnings every 13wk) refills on its own cadence window + cooldown. When several are chronically 'due', the min-gap stops being a floor and becomes the actual cadence: the game will emit a full-screen takeover as often as every 2 weeks in the late eras (~26/year) — precisely when builds are longest and the player most wants uninterrupted planning. There is no rolling per-N-weeks aggregate cap and no priority tiering, so a low-stakes staff-mood moment consumes the same slot a rival strike would.  
  *Fix:* Two low-risk levers: (a) raise minGapWeeksLate (2 -> 4+) so late-game breathes; the comment's rationale ('longer builds -> more should happen') is backwards for a player complaining about noise. (b) Introduce a priority tier: high-stakes streams (strike, earnings, license, awards) fire on the gap; low-stakes streams (staff moment, regional event, community ask) coalesce into a single weekly/періodic digest card instead of each claiming a full-screen slot. Both are gated on optional fields and no-op in the pinned run.
- **[medium · noise] No player control to mute or slow interrupt streams — Settings has sound/haptics but no 'calm mode'**  
  *Where:* `src/screens/Settings.tsx:79-131, src/state/settings.ts:7`  
  *Problem:* Settings exposes reduce-motion/high-contrast/3D/sound/haptics/daily-reminder/platform/sandbox toggles, but nothing that lets a player who finds the game noisy dial back the interrupt cadence or silence specific streams. The only way to reduce modals is to not trigger the systems that raise them, which the player can't see or control.  
  *Fix:* Add a backfilled optional setting (e.g. settings.calmInterrupts or a small enum busy|balanced|calm) that (1) multiplies BALANCE.interrupts.minGapWeeks read at gameState.ts:1920 and/or (2) demotes the opt-in low-stakes streams to feed-only. Because it reads a UI setting (not sim state) it can't touch determinism; default to current behavior so the pin is unaffected. This is the single highest-leverage 'calmer without deleting content' lever.
- **[medium · clarity] HQ is a 15-20 card vertical wall — every system renders a persistent card competing for attention at once**  
  *Where:* `src/screens/HQ.tsx:155-358`  
  *Problem:* The HQ body unconditionally-or-conditionally stacks: pendingChoice card, pendingPoach card, BuzzTicker, ScenarioTracker, ChallengeTracker, DailyChallengeCard, ipoReady, advanceReady, stat pills, fin pills, rank ladder, EraGoalCard, UnlockCard, NextMoveCard, ContractsCard, LegacyEraCard, CommunityCard, in-production, Upgrades, PerformanceCard, StrategicInsightsCard, FeedCard. Mid/late game a dozen-plus of these are live simultaneously with no hierarchy, so the two that are actually actionable (a pending decision, the next move) are buried in ambient chrome. This is the persistent-noise counterpart to the modal-noise problem.  
  *Fix:* Establish a priority zone (pending decisions + single NextMove) that's always at top, and collapse the rest into a coalesced 'company digest' / expandable sections. Trackers (Scenario/Challenge/DailyChallenge) and status cards (Community/Contracts/Legacy) can share one tabbed or accordion surface. Pure presentation change — no engine/determinism impact.
- **[medium · noise] HQ nav badge is lit by 8 OR-conditions so it is near-permanently on and stops signaling**  
  *Where:* `src/state/gameState.ts:4292-4306 (hq: line 4295-4296)`  
  *Problem:* navAttention.hq = canAdvance || canIPO || pendingChoice || pendingPoach || claimableContract || pendingSideOrder || affordableMegaproject || spendableLegacyPoint. In the post-IPO/late game, affordableMegaproject and spendableLegacyPoint are frequently true for long stretches, so the HQ dot is chronically lit regardless of whether anything time-sensitive happened. A badge that's always on is indistinguishable from no badge — it trains the player to ignore it, undermining the one lightweight signal that could REPLACE full-screen interrupts.  
  *Fix:* Reserve the dot for genuinely time-sensitive/decidable items (pendingChoice, pendingPoach, pendingSideOrder, claimableContract, canAdvance/canIPO). Drop or demote the always-affordable spend conditions (affordableMegaproject/spendableLegacyPoint) to a subtler, non-pulsing indicator, so the badge means 'act now' again.
- **[medium · noise] Low-stakes moments use the same full-screen sim-suspending takeover as high-stakes ones**  
  *Where:* `src/App.tsx:229-235 (EurekaMoment, CommunityAsk, StaffMoment, StaffEvent, PostLaunchEvent, RegionalEvent)`  
  *Problem:* Six of the mounted overlays — eureka, community ask, staff moment, staff life event, post-launch nudge, regional event — are full-screen modals that suspend the sim (useHoldSim), identical in weight to a rival strike or earnings call. Their outcomes are minor (a small RP/mood/fan swing or a flavor choice), but the interruption cost to the player is maximal. This is the core of 'noisy and confusing': the game keeps stopping everything for things that don't warrant a hard stop.  
  *Fix:* Demote the lowest-stakes streams (staff moment, community ask, regional event) from full-screen overlays to inline HQ banners or an 'inbox' the player opens on their schedule; keep full-screen only for high-stakes/urgent decisions (strike, earnings, license offer, awards, IPO/era). The pending* fields and reducers stay; only the presentation layer in App.tsx changes, so the engine and determinism pin are untouched.
- **[low · confusion] skipInterrupt stop-list is out of sync with the interrupt set**  
  *Where:* `src/state/gameState.ts:4899-4917`  
  *Problem:* 'Skip to next decision' stops for ready-to-launch, choice, poach, strike, side order, awards, recruiter shortlist, era goal, product-finished, low-runway — but NOT for eureka, community ask, staff moment, staff event, regional event, post-launch, earnings, license offer, or rivalry. Those newer modals still pop (their overlays suspend the sim when they mount), but the skip feature never names them as the reason it stopped, and conceptually skip 'blows past' them. The list has drifted the same way the pre-noPendingInterrupt pending chains did.  
  *Fix:* Decide the intended contract and make the list match it. If skip should stop for every full-screen decision, add the missing pendings. If low-stakes streams are demoted to banners (see above), deliberately EXCLUDE them so skip only halts for true decisions — turning skip into a natural 'quiet fast-forward' that itself reduces perceived noise.
- **[low · noise] Heavy per-action confirmation stacking (toasts + confetti + celebrate + haptic + sfx) with 132 toast sites**  
  *Where:* `src/App.tsx:223-240, src/components/ReadyToLaunch.tsx, src/components/LaunchReveal.tsx, src/screens/HQ.tsx (multiple showToast)`  
  *Problem:* There are 132 showToast call sites across the app, and celebratory events fan out to several channels at once (GainFX, Confetti, onCelebrate->office cheer, SoundFX, toast). A single launch chains ReadyToLaunch -> LaunchReveal -> confetti -> celebrate -> office reaction, and many actions additionally fire a toast that restates what a card/modal already shows. The redundancy contributes to the 'noisy' feel even outside the interrupt system.  
  *Fix:* Audit toast density and suppress toasts that merely duplicate a card or modal already on screen (e.g. the launch reveal already communicates the launch — a concurrent toast is noise). Consolidate the per-celebration fan-out so a win fires ONE coordinated moment rather than five parallel effects. Presentation-only; no engine impact.

### Confusion, Clarity & Onboarding

The core design→build→launch loop is taught well: a progress-driven Coach (Coach.tsx) walks the first launch, an ordered "Next Move" objective ladder (objectives.ts) takes over, a persistent UnlockCard announces the first-ship meta unlocks, and point-of-use explainers are strong in several places (Research doctrine/capstone notes at Research.tsx:505-511, price zones and "Who it's for" segment readouts in DesignLab, inline supplier-loyalty tiers). The failure mode is the SECOND layer of the game: roughly a dozen full-screen "alive" interrupt overlays (community, regional event, eureka, earnings, contract offer, rivalry, staff moment, post-launch) fire cold on their own cadence with zero first-time framing, and the depth vocabulary that gates them (segment fit, nemesis, board mandate, megaproject, legacy points, doctrine) is defined only in one collapsible buried inside the Bank, far from every screen that uses those words. Onboarding is also single-shot and non-replayable — once tutorialDone is set (by skipping OR by first launch) the Coach never returns and there is no global help/glossary entry point anywhere in the HUD, nav, or Settings. Finally the Design Lab stacks three different overlapping "score" concepts (Overall, Fit /100, projected verdict) on screen at once with no explanation of how they relate.

- **[high · confusion] A dozen full-screen interrupt overlays introduce entire systems cold, with no first-time framing**  
  *Where:* `src/App.tsx:225-238 (mounted overlays); src/components/CommunityAsk.tsx, RegionalEvent.tsx, EurekaMoment.tsx, EarningsCall.tsx, ContractOffer.tsx, RivalryDeclared.tsx, StaffMoment.tsx, PostLaunchEvent.tsx`  
  *Problem:* Right after the first launch (which is all the Coach teaches), the opportunistic interrupt budget begins firing full-screen takeovers on a derived-hash cadence: Community Ask, Regional Event, Eureka Moment, Earnings Call, Contract Offer, Rivalry Declared, Staff Moment/Event, Post-Launch Event. Each is the player's FIRST contact with a whole subsystem (regions, community mood, staff morale, licensing, nemesis rivalries), yet it arrives as a modal demanding a decision with no prior concept introduction. The interrupt-budget gate (BALANCE.interrupts.minGapWeeks) spaces them out but never scaffolds them. A new player who just learned 'design a phone' is suddenly asked to adjudicate a regional loyalty event or an earnings call they've never seen mentioned.  
  *Fix:* Gate each opportunistic interrupt behind a milestone so it can't fire until its host system is reachable (e.g. RegionalEvent only after a second region is open; EarningsCall only post-IPO; CommunityAsk only after fans exceed a threshold), and give each overlay a one-line 'what this is' eyebrow on its FIRST appearance (a per-stream seen-flag on state, backfilled to true on existing saves to preserve determinism). Sequencing these to the objectives.ts ladder (or at minimum suppressing all of them until tutorialDone AND launched.length>=2) would let the player learn the core loop before the alive-world layer opens.
- **[high · clarity] Onboarding is single-shot and non-replayable; there is no global help or glossary anywhere**  
  *Where:* `src/components/Coach.tsx:22; src/state/useGame.tsx:1167 (dismissTutorial); src/components/Hud.tsx:100-108; src/screens/Settings.tsx (no help entry)`  
  *Problem:* The core-loop Coach returns null forever once state.tutorialDone is true, and dismissTutorial simply sets tutorialDone — so tapping the X on step 1 permanently deletes all core guidance, and even a player who completes it can never re-read it. Unlike the Decorate and Factory tutorials (which have replay '?' buttons), the main Coach has no replay path. Worse, there is no global help, 'how to play', or glossary button in the HUD, BottomNav, or Settings. The two real glossaries (StatGlossary for the 5 stats, TERM_INFO for economy terms) are only reachable inline on Design Lab, Market, and inside the Bank sheet — a player who wants to look up a term must already know which screen buried it.  
  *Fix:* Add a persistent help affordance in the HUD or Settings that (a) replays the core Coach, (b) opens a single consolidated glossary combining STAT_INFO + TERM_INFO, and (c) links the Decorate/Factory tutorials. Make skipping the Coach a two-tap confirm, or keep a compact 'resume tutorial' pill until the first launch actually happens.
- **[medium · clarity] Advanced-vocabulary glossary (TERM_INFO) is buried in the Bank, far from where the words appear**  
  *Where:* `src/engine/glossary.ts:56-67; src/components/Bank.tsx:91 (only surface); terms used on HQ.tsx (Nemesis, Board mandate, Megaproject, Legacy Points), Market (Region standing), Company/Platform`  
  *Problem:* TERM_INFO defines the depth-gating vocabulary — Segment fit, Design brief, Doctrine, Capstone, Supplier loyalty, Region standing, Nemesis, Board mandate, Megaproject, Legacy Points — but the ONLY place these definitions render is a collapsible 'What these terms mean' inside the Bank overlay (Bank.tsx:91). Several of these words appear as first-class UI on completely different screens (the HQ rank ladder shows a crossed-swords nemesis glyph at HQ.tsx:302; LegacyEraCard surfaces Megaprojects and Legacy Points; Board mandates appear post-IPO) with no definition within reach. Doctrine/Capstone and Supplier loyalty are the exceptions — those DO have good inline notes (Research.tsx:510-511) — which highlights how the others don't.  
  *Fix:* Move each definition to its point of use as an inline info affordance (a tappable term chip or a first-appearance note), following the pattern already proven at Research.tsx:510. At minimum, expose the same TERM_INFO/StatGlossary from the global help entry point recommended above so the vocabulary is lookup-able from anywhere, not only from the Bank.
- **[medium · clarity] Three overlapping design 'score' numbers shown at once with no explanation of how they relate**  
  *Where:* `src/screens/DesignLab.tsx:662-666 (Fit /100), :793 & :798-801 ('Overall' in category compare), :559-561 & :414-418 (projected verdict badge)`  
  *Problem:* The Design Lab simultaneously presents three distinct 0-100/verdict concepts that a new player cannot disentangle: the hero 'Fit 62 / 100' bar, the category card's 'Overall 71' (used to compare against the last device in the category), and the header verdict badge 'Projected hit / Steady seller / Likely flop'. Fit is demand fit, Overall is raw spec quality, and the verdict is effectiveScore vs rising era bands — three different formulas — but nothing on screen says so. The StatGlossary (DesignLab.tsx:1370) explains the 5 component stats, not these meta-scores. The result: a player sees 'Fit 62' next to 'Projected hit' and can't tell why, or why raising components moves Overall but not Fit. There is a competition-drag note (:716-722) that helps in one narrow case, but no general explainer.  
  *Fix:* Add a one-line definition next to each score (e.g. Fit = 'how well this matches what buyers want right now'; Overall = 'raw build quality vs your last device'; Verdict = 'projected launch result after rivals'), or fold them into a single tap-to-reveal explainer alongside StatGlossary. Even a short helper sentence tying 'Fit + your track record → Verdict' would remove most of the confusion.
- **[low · confusion] Over-capacity 'Accept defects / Stretch / Pay overtime' choice appears abruptly with terse labels**  
  *Where:* `src/screens/DesignLab.tsx:2112-2120 (BuildWizard capacity strategy); :1969 default 'overtime'`  
  *Problem:* When a planned run exceeds the factory's weekly capacity, the build wizard surfaces a three-way 'Over-capacity strategy' picker (Pay overtime / Stretch / Accept defects) that a first-timer has never encountered. 'Accept defects' silently bakes a run-size-dependent quality penalty onto the shipped product (confirmBuild at :466-469), which can quietly turn a would-be hit into a flop, but the label conveys neither the magnitude nor that it rides permanently on that device. Because it only appears conditionally on large runs, it is easy to hit unexpectedly the first time a player plans an ambitious launch.  
  *Fix:* Show the concrete consequence inline on each option (e.g. 'Accept defects — quality -8, cheapest'), and consider hiding the whole picker until the player owns/chose a capacity-limited factory, or defaulting new players to 'Pay overtime' with a note that a bigger factory removes the choice.
- **[low · progression] All five nav tabs live from week one, with Research and Market fronting mostly aspirational/locked content pre-first-ship**  
  *Where:* `src/components/BottomNav.tsx:7-13 (no gating); src/screens/Research.tsx:40-120 (full era roadmap + doctrines day one); src/screens/Market.tsx (region board + rank ladder); contrast src/screens/Company.tsx:129,284,330,338 (hasShipped gating done well)`  
  *Problem:* The Company screen does exemplary progressive disclosure (financing, morale, platform, near-milestones all gated on hasShipped or roster size). Research and Market do not to the same degree: on day one, before a single product ships, Research already presents the full four-era roadmap, doctrine forks ('Pick one — permanently stamps every product'), and capstones, and Market presents the regional board and rank ladder. That is a lot of forward-looking, mostly-inert surface for a player still learning to build one phone, and it competes for attention with the Coach's single 'go to the Design Lab' instruction.  
  *Fix:* Apply the Company screen's hasShipped pattern to Research and Market: keep the immediately-relevant slice visible (component tiers to research, first region to open) and collapse the era roadmap / doctrine forks / rank board behind a 'once you've shipped' reveal or a lightweight expander, so the first session's cognitive load matches the one action the Coach is asking for.

### Moment-to-moment gameplay depth & pacing

The core loop is front-loaded: DesignLab is a rich, decision-dense screen (category, component tiers, sourcing, factory, finish, tuning, design brief, camera, refresh/storage, then a build wizard for units/channel/regions/strategy/price), but everything AFTER the launch click is passive. scoreLaunch runs once (market.ts:142) and salesCurve.ts bakes a fixed 16-week unit curve (balance.ts:258) that the weekly tick just plays back (gameState.ts:1740-1775). The game is real-time (8s/week) with a literal "Skip to next decision" button (Hud.tsx:137), and an interrupt BUDGET deliberately spaces the only reactive content 2-3 weeks apart (balance.ts:313) — so between launches the intended play is to fast-forward through empty weeks. Mid-game sags because successor designs pre-fill every field (DesignLab.tsx:215) and maxing coherent tiers is a dominant strategy (product.ts synergy/archetypes), the research tree is finite with one-time forks, and the "depth" systems (staff, factory, regions, delegation) are one-time set-ups that the engine then auto-resolves — several are literally automated by research (research.ts:119). The player wants "more gameplay"; the loop needs recurring in-flight decisions during the 16-week sell window and per-product tradeoffs that make maxing wrong.

- **[high · depth] The 16-week sell phase is fully pre-baked at launch — nothing to do while a product sells**  
  *Where:* `src/engine/salesCurve.ts:72-106; src/engine/market.ts:142-187; src/state/gameState.ts:1740-1775`  
  *Problem:* scoreLaunch() computes a single launchScore at launch, forecast()/distributeOverCurve() bake a fixed 16-week weeklyUnits array (balance.ts totalWeeks:258), and the weekly tick (gameState.ts:1740) just reads lp.weeklyUnits[weeksElapsed] back and books revenue. A product's entire commercial life auto-resolves with zero required input. The only in-flight levers are price cut, marketing push, and restock (Market.tsx:1337-1477), each hard-capped at 3 uses and explicitly diminishing (balance.ts maxPerProduct:291/322/331). So after each launch the player fast-forwards ~16 weeks (2 min real time) doing essentially nothing. This is the single largest source of passivity in the loop.  
  *Fix:* Add recurring in-flight decisions tied to the live sell curve, gated on optional state like the existing systems: e.g. a mid-run supply shock the player answers (pay to expedite vs. accept a stockout that caps units), a demand-signal window where reading the segment breakdown lets you re-target a region rollout, or a 'sustain vs. harvest' choice at the peak (week 4) that trades tail length for margin. Make the 3-use levers into a small ongoing operations mini-loop rather than one-shot buttons. This turns the dead 16 weeks into managed weeks without touching the deterministic baseline (gate on new optional fields, default no-op).
- **[high · late-game] 'Skip to next decision' + budget-gated interrupts cap decision density low by design**  
  *Where:* `src/components/Hud.tsx:137-146; src/state/useGame.tsx:638-657; src/state/gameState.ts:4899-4917; src/engine/balance.ts:313-316`  
  *Problem:* The intended cadence is: make a decision, then fast-forward until the sim forces the next one. skipInterrupt() (gameState.ts:4899) enumerates the only things that stop time — a build finishing, a pending event/poach/strike/side-order/awards, a shortlist, an era goal, low runway. Everything else is skippable. Meanwhile ALL opportunistic full-screen cards share one budget: interruptQuiet requires minGapWeeks (3 early, 2 late; balance.ts:313) since lastInterruptWeek, so at most one reactive moment fires every 2-3 weeks. The pacing system is explicitly built to keep weeks quiet. Combined with finding #1, the actual density of player agency is a handful of clicks per product cycle; the rest is watching.  
  *Fix:* The interrupt budget solves modal-clustering but also throttles the game's only reactive gameplay. Introduce a second, NON-modal decision channel that doesn't consume the budget — lightweight in-line choices surfaced on HQ/Market (a weekly 'ops board' of 0-2 small optional calls: reallocate a marketer, approve an expedite, pick this week's region push) so there is something worth doing on most weeks without a full-screen takeover. Keep the modal budget for the big beats; add a quieter steady-state decision stream.
- **[high · progression] Successor design collapses to 'bump tiers, rename, launch' — the richest screen loses its decisions**  
  *Where:* `src/screens/DesignLab.tsx:215-229; src/engine/product.ts:198-288`  
  *Problem:* successorDraft() copies every design field (components, finish, camera, tuning, supplier, price) from the previous product, so re-designing a follow-up is pre-filled. And the scoring rewards a single dominant strategy: componentSynergy() penalizes the weakest link and pays a flagshipBonus for coherent high builds, and activeArchetypes()/archetypeBonus() hand out named bonuses for maxing high-tier pairs. There is no per-product budget, component scarcity, or differentiation pressure that would make maxing wrong. So once RP unlocks the top tiers, the optimal move each generation is 'max every slot coherently' — the meatiest screen in the game degrades to incrementing numbers.  
  *Fix:* Add a real per-product tradeoff so 'max everything' stops being correct: a design budget / BOM ceiling per project, component supply constraints (a hot chip tier is capacity-limited so you choose who gets it), or an anti-cannibalization/novelty pressure where shipping the same maxed build repeatedly decays appeal (novelty.ts already exists — wire it into the design decision). Also seed successor drafts with a deliberate gap (e.g. don't copy tuning/brief) so each generation forces at least one fresh call.
- **[medium · depth] Depth systems are engineered to REMOVE decisions, not create them (staff, delegation, morale)**  
  *Where:* `src/engine/research.ts:119-120; src/state/gameState.ts:4592 (applyWeeklyAutomation), 2034-2096 (auto churn/mood); src/engine/staff.ts:257-304`  
  *Problem:* Staff is assign-once: each hire maps to a discipline (ASSIGNMENT_DISCIPLINE, staff.ts:257) and then contributes passively. Mood, XP, leveling, and churn all auto-resolve in the tick (gameState.ts:2034), a People Lead auto-manages morale and suppresses quits, and the peopleOps/researchDivision research projects literally unlock 'Auto-assign' and 'Auto-research' delegation (research.ts:119, applyWeeklyAutomation gameState.ts:4592). The progression fantasy is 'buy your way out of managing the team.' That's a legitimate idle-game arc, but it means the staff system is never an ongoing decision surface — it's a set-up cost that trends toward zero interaction.  
  *Fix:* Give staff a recurring decision hook that survives delegation: e.g. periodic specialization/skill-tree picks on level-up (which discipline to deepen), project-team assignment per product (a designer boost that must be allocated to THIS build, trading against RP generation), or scarce star-talent whose focus you re-point each era. Delegation should trade player time for a modest efficiency penalty, not full auto-pilot, so keeping hands-on stays a viable, rewarded choice.
- **[medium · late-game] Research tree goes inert mid/late game — finite list, one-time forks, tiers auto-affordable**  
  *Where:* `src/engine/research.ts:69-133; src/state/gameState.ts:4919-4928`  
  *Problem:* RESEARCH_PROJECTS is a fixed ~50-item list; doctrine forks (engDoctrine/gtmDoctrine/opsDoctrine) are one-time exclusive picks, and capstones are the end of a short prerequisite chain. Once a company has cleared its era's projects and committed its forks, research becomes 'accrue RP, auto-buy the next tier.' The researchReady badge deliberately excludes component tiers because they are 'near-continuously affordable mid-game' (comment at gameState.ts:4919) — i.e., tier buys aren't a real decision, they're a formality. There's no late-game RP sink that poses an ongoing choice.  
  *Fix:* Add a repeatable/scaling late-game research track so RP stays a live decision: e.g. tiered 'labs' you can keep leveling with rising cost, competing research initiatives that must be prioritized (only one active project at a time with real opportunity cost), or randomized breakthrough options each era so the tree isn't the same optimal path every campaign. Even making tier unlocks queue one-at-a-time (opportunity cost) would restore a decision where there's currently none.
- **[medium · depth] Regions and the factory floor are one-time investments, not recurring management**  
  *Where:* `src/engine/regions.ts:1-45; src/engine/factoryFloor.ts:1-40; src/screens/DesignLab.tsx (build wizard regions/factory pickers)`  
  *Problem:* Regions expand by paying a one-time unlockCost, after which choosing a region is a checkbox in the build wizard; the region taste weights add a bounded fit modifier but no ongoing decision (regions.ts). The factory floor is a build-once machine layout with occasional per-machine upgrades (factoryFloor.ts MACHINE_MAX_LEVEL:3) — a cash sink, not a weekly decision. Both are marketed as strategic depth but resolve to set-up-then-forget, contributing to the mid-game feeling that there's nothing to actively DO.  
  *Fix:* Make geography and manufacturing recurring: region demand/regulation/rivalry that shifts era-to-era so you re-prioritize where to ship (regionalEvents already exists — let it demand a distribution re-allocation, not just a modal), and factory capacity/throughput pressure that interacts with run size so line layout is re-evaluated as volumes grow. The goal is to convert one-time purchases into levers the player re-pulls across the campaign.
- **[medium · depth] Marketing is a one-shot pre-launch hype ladder, not an ongoing campaign**  
  *Where:* `src/engine/marketing.ts:29-54; src/screens/Market.tsx:1403-1434; src/engine/market.ts:180-181`  
  *Problem:* MARKETING_CHANNELS is a linear pay-more-for-more-hype ladder chosen ONCE at build time (segmentBias adds a positioning nuance, but the dominant axis is cost→hype→reputation). campaignHype is applied a single time in scoreLaunch (market.ts:180). The only post-launch marketing is the mid-life 'push' capped at 3 diminishing uses (Market.tsx:1403). There's no sustained brand campaign to manage week-to-week, no competitive ad response, no budget pacing — so marketing, like the rest of the sell phase, is a pre-launch setting rather than gameplay.  
  *Fix:* Turn marketing into a light ongoing system: a running campaign with a weekly spend you can dial up/down against a live buzz meter (buzz.ts already exists) that decays and responds to rival launches, so you're managing share-of-voice during the sell window instead of buying one hype number at launch. Tie the segmentBias to an in-flight targeting choice so 'who is this for' is revisited as the curve plays out.

### Late-game content &amp; long-term progression

The game does have a post-IPO "Legacy Era" (endgame.ts: board mandates + megaprojects + a Legacy-Point spend tree) plus prestige New Game+, a museum, collections, achievements, and an industry leaderboard — a real spread of endgame scaffolding. But the long-horizon grind breaks down in three structural ways. First, the prestige meta-layer does not compound: on New Game+ everything the player built in the Legacy Era (Legacy Points, the Legacy Tree, funded megaprojects) is wiped, and the only thing that carries across runs is a single integer that grants a flat resource head-start — so the richest phase leaves no permanent trace. Second, the core "grind toward better tech" loop hard-caps at 4 eras and ~6 component tiers with no era 5+; once the AI era's top tier and doctrine capstones are researched, the tech tree is simply finished. Third, the recurring post-IPO loops flatten: board mandates plateau into trivially-met rubber-stamps, the Legacy Tree is fully buyable (only 12 perks) so scarcity evaporates, and megaprojects degrade into an infinite "Moonshot Program N" that is just an escalating number with one reused blurb. The completionist hooks (6 collections, 60-device museum, a fixed 7-entry leaderboard) all cap early with no ascending mastery ladder to chase across runs. Net: a player who reaches IPO has maybe one satisfying Legacy Era, then runs out of genuinely new things to unlock.

- **[high · progression] Prestige meta-layer does not compound — the entire Legacy Era grind is wiped on New Game+**  
  *Where:* `src/state/useGame.tsx:1116-1127; src/state/legacy.ts:9-25; src/state/gameState.ts:668-781 (legacyPoints:0), 4972-5022 (fundMegaproject/buyLegacyPerk write per-run fields)`  
  *Problem:* The post-IPO Legacy Era is framed as the prestige meta layer (legacyTree.ts header: 'the prestige meta layer for the post-IPO endgame'). The player banks Legacy Points from megaprojects and spends them on a tiered permanent-boon tree. But prestige() (useGame.tsx:1123) rebuilds state from newGame(), carrying forward ONLY the integer `legacy` level (plus platformUnlocked/seenChoices/profile achievements). legacyPoints resets to 0 (gameState.ts:781), and legacyPerks / megaprojectsFunded are per-run optional fields that default back to empty. legacy.ts persists just a single int. So a player who grinds a full Legacy Era — funding billion-dollar moonshots, building a Legacy Tree route — loses ALL of it the moment they start New Game+. The only cross-run reward is legacyBonus(level): a flat triangular resource head-start (gameState.ts:657-666). This directly defeats the player's stated wish for things to 'grind towards' — the biggest grind in the game leaves no lasting trace, and prestige runs feel like starting over rather than ascending.  
  *Fix:* Make prestige actually accumulate. Persist a cross-run prestige currency (e.g. carry banked Legacy Points, or convert unspent points + funded-megaproject count into permanent 'Legacy Stars') into the profile alongside the legacy int, and let a subset of Legacy Tree perks become PERMANENT unlocks that stack across empires. Even a small persistent skill tree keyed off total lifetime Legacy Points would convert the endgame from a disposable loop into a true meta-progression the player builds over 10+ hours.
- **[high · late-game] Tech/era tree hard-caps at 4 eras and ~6 component tiers — the core 'unlock better tech' grind has a firm content cliff**  
  *Where:* `src/engine/eras.ts:84-86 (maxEra = BALANCE.eras.length = 4); src/engine/catalogs.ts:40-81 (component tiers top out at era 4); src/engine/research.ts:104-131 (doctrine forks + 2 capstones)`  
  *Problem:* maxEra() returns 4 and canAdvanceEra returns false at the final era (eras.ts:74). Every component tops out at an era-4 tier (chip QuantumCore Q2, display MicroLED Infinity, etc.) and the research tree ends at a handful of doctrine capstones. Once a player reaches the AI era, researches the top tier of each component, and takes their doctrine capstone, the single most motivating tycoon grind — unlocking the next tier of technology — is permanently over. The Legacy Era adds cash mandates and reputation moonshots but introduces ZERO new categories, components, eras, or tech to research. So the game's central progression fantasy exhausts itself well before the endgame systems are meant to take over, and the endgame offers no replacement 'ladder of stuff to unlock.'  
  *Fix:* Add an endless post-IPO tech frontier: either an 'Era 5+' that scales procedurally (like repeatableMegaproject already does for moonshots) unlocking prestige-tier component tiers, or a research 'frontier' track that keeps generating deeper deterministic tiers gated on Legacy Points. This reuses the existing tier/catalog machinery and the derived-hash pattern, stays sim-safe (gated on wentPublic), and gives the endgame the unlock ladder it currently lacks.
- **[medium · late-game] Board mandates plateau into trivially-met background noise relative to endgame company scale**  
  *Where:* `src/engine/balance.ts:1174-1185 (baseRevenue $40M, baseReward $20M, escalationCapQuarters:12, escalationPerQuarter:0.35); src/engine/endgame.ts:151-183 (generateBoardMandate)`  
  *Problem:* The recurring quarterly mandate is the heartbeat of the Legacy Era loop (gameState.ts:2525-2558, auto-reissued forever). But its bar plateaus at 12 quarters (~3 years post-IPO) and its reward never scales with company size: quarter-1 revenue target $40M rising to a ceiling near $180M, reward $20M cash rising to ~$100M. A company that has IPO'd is worth billions (ipoValuation compounds cubically on reputation), routinely posting quarterly revenue far above the capped target. So within a few quarters the mandate becomes a rubber-stamp — always met with no effort, its cash reward a rounding error. The loop meant to 'always have a target' (endgame.ts comment) instead becomes ignorable, removing tension from the one recurring endgame activity.  
  *Fix:* Scale mandate targets AND rewards off live company facts (a fraction of trailing quarterly revenue / current valuation) rather than fixed dollar constants, and don't cap escalation so hard — keep the bar a genuine stretch. Alternatively add escalating mandate tiers with prestige-currency rewards so meeting them feeds the (recommended) persistent meta rather than trivial cash.
- **[medium · depth] Endgame sinks bottom out — Legacy Tree is fully buyable and megaprojects degrade into an infinite reused-blurb number**  
  *Where:* `src/engine/legacyTree.ts:24-49 (12 perks, tier gate = 'own N perks'); src/engine/endgame.ts:33-89 (4 authored megaprojects, then repeatableMegaproject with one shared blurb)`  
  *Problem:* Two coupled problems drain the endgame's sense of pursuit. (1) The Legacy Tree is only 12 perks (~60 Legacy Points to buy everything) and its tier gate is just 'own N perks total' (legacyTree.ts:47-49), not a route commitment — so there is no lasting opportunity cost. With infinite Moonshot Programs banking ever-more Legacy Points (endgame.ts:80, legacyPoints rises every tier), the player eventually owns the entire tree and Legacy Points become a dead currency with nothing to spend on. (2) After the 4 authored megaprojects, availableMegaprojects only ever offers repeatableMegaproject, whose name is 'Moonshot Program N' and whose blurb is a single hardcoded string reused forever (endgame.ts:84). So the endgame's flagship activity becomes 'watch a cost number climb' with no new content, narrative, or unlock behind it.  
  *Fix:* Give Legacy Points a permanent sink so they never dead-end: add higher tree tiers, or route surplus points into the cross-run prestige currency from Finding 1. For megaprojects, either author a larger rotating slate with distinct rewards/flavor, or have repeatable moonshots unlock tangible things (a new category, a frontier tech tier, a named landmark in the Museum) instead of only reputation/points.
- **[medium · progression] No ascending mastery ladder or endless ranking — completionist hooks cap early and the leaderboard ceiling is a fixed #1 of 7**  
  *Where:* `src/engine/collections.ts:61-68 (6 collections); src/state/museum.ts:11 (CAP=60); src/state/gameState.ts:5045-5058 (leaderboard = player + 6 rivals); src/engine/achievements.ts:607-637 (mastery tier)`  
  *Problem:* The long-tail completionist content tops out quickly and has no infinite/ascending dimension. Collections are just 6 fixed goals (ship 25 devices, 5-deep franchise, 10 hits, all categories/eras); once done they are static trophies with nothing beyond. The museum hard-caps at 60 devices. The industry leaderboard is only ever 7 entries and #1 is an absolute ceiling — there is no prestige-scaled ranking, no 'legendary founder' title ladder, no leaderboard that keeps giving the player something above them after they hit #1. Achievements include a mastery tier but it too is a finite checklist. So a dedicated player exhausts every collectible/ranking hook and then has no numeric horizon to chase.  
  *Fix:* Add at least one endless, cross-run mastery ladder: e.g. a founder-legend rank/title that advances with lifetime prestige (total Legacy Points banked, total hits shipped across all companies, cumulative valuation), displayed prominently. Optionally make the leaderboard keep spawning a stronger 'next boss' above #1 in prestige runs (the nextRankRival machinery already exists, rankLadder.test.ts). This gives the engaged-player tail a number that never stops climbing, fitting determinism since it reads existing profile counters.

### Systems Inventory & Bloat/Overlap

Silicon Tech Tycoon runs ~80 engine modules that group into ~9 families; the sim core (market/segments/salesCurve/reviews/competitors/product/research) and the factory family (factoryFloor/assemblyLine/suppliers/furniture) are genuinely load-bearing. The bloat is concentrated in two families with heavy internal overlap. First, SEVEN-plus parallel "choice-card interrupt" systems (events+eventChains, postLaunchEvent, staffEvent, staffMoment, regionalEvents, community, eureka, contractOffer, licenseOffers) each ship their own engine module, pending* field, reducer, full-screen overlay component and CSS — yet all reduce to the same shape (title + body + 2-3 options -> apply an effect), all share ONE interrupt budget, and all also write to ONE feed. Second, at least six overlapping goal/quest trackers (objectives ladder, rolling contracts, daily challenges, side-orders, post-IPO board mandates, scenarios, plus passive awards/achievements) compete for the same "what do I chase next" slot — contracts.ts's own header admits it exists to fill a gap the others leave. The duplication has already produced a concrete latent bug: each overlay hand-maintains its own inconsistent "is another modal pending?" guard list. Consolidating the interrupt shape behind one framework and unifying the goal surface would make the game both calmer (fewer redundant modals/badges) and clearer (one place to look).

- **[high · bloat] Seven+ parallel choice-card interrupt systems duplicate one shape**  
  *Where:* `src/engine/events.ts, src/engine/eventChains.ts, src/engine/postLaunchEvent.ts:24-41, src/engine/staffEvent.ts:15-41, src/engine/staffMoment.ts:14-28, src/engine/regionalEvents.ts:43, src/engine/community.ts:117, src/engine/eureka.ts, src/engine/licenseOffers.ts; overlays in src/components/{PostLaunchEvent,StaffEvent,StaffMoment,RegionalEvent,CommunityAsk,EurekaMoment,ContractOffer}.tsx; firing block src/state/gameState.ts:2368-2705`  
  *Problem:* Almost every opportunistic interrupt is the same primitive: a titled card with a body line and 2-3 options, each option carrying an effect (cash/rep/fans/mood/etc.) that a reducer applies. postLaunchEvent, staffEvent, community, regionalEvents, eureka, licenseOffers and the events/eventChains choice system each independently define that interface (PostLaunchOption/StaffEventOption/StaffGrowthOption/ChoiceOption...), a dedicated pending* field (gameState.ts:372-535), a dedicated resolveX reducer (useGame.tsx:432-443), a near-identical overlay component, and its own CSS — StaffEvent and PostLaunchEvent literally render into the same `.stfm` classes with copy-pasted JSX (options.map -> numbered button). This is ~7 implementations of one idea. It multiplies the code a designer must touch to change interrupt behavior and multiplies the modal types a player must learn, even though they behave identically.  
  *Fix:* Introduce ONE interrupt/event framework: a single `InterruptCard` type ({id, eyebrow, glyph, title, body, options:[{label, blurb, effect}]}), a single `pendingInterrupt` field, one `resolveInterrupt(optionIndex)` reducer that applies a typed effect union, and one generic overlay component + CSS. Keep the per-system GENERATORS (they hold the distinct flavor/gating) but have each emit the common card type instead of its own bespoke pending field + overlay. This removes ~6 components, ~6 CSS blocks, ~6 reducers and ~6 pending fields without changing what the player sees.
- **[high · confusion] Each overlay hand-maintains an inconsistent 'other modal pending' guard — a latent bug**  
  *Where:* `src/components/PostLaunchEvent.tsx:27-30, src/components/StaffEvent.tsx:25-28, src/components/RegionalEvent.tsx:29-31, src/components/CommunityAsk.tsx:34-35; canonical helper already exists at src/state/gameState.ts:966-968 (noPendingInterrupt)`  
  *Problem:* Every interrupt overlay independently open-codes a boolean listing its sibling pending fields to avoid stacking two modals — and the lists are inconsistent. PostLaunchEvent checks ~11 siblings; RegionalEvent (29-31) checks only 7 and omits pendingStaffEvent/pendingPostLaunch/pendingLicenseOffer/pendingChoice/pendingPoach; CommunityAsk (34-35) checks only 4 (pendingStrike/pendingAwards/pendingRivalry/pendingEureka). The engine already guarantees near-mutual-exclusion via noPendingInterrupt at fire time, so these render-side lists are redundant belt-and-suspenders that will silently rot: add a new interrupt and you must remember to edit N overlay files, and any miss lets two modals fight for the same z-layer. gameState.ts:966 already defines the single source of truth.  
  *Fix:* Export one shared `higherPriorityPending(state, self)` (or reuse noPendingInterrupt with a priority order) and have every overlay call it instead of re-listing siblings. This deletes the divergent lists, closes the stacking bug class, and makes render-order priority explicit in one place. It is a prerequisite / natural companion to the framework consolidation above.
- **[medium · bloat] Six overlapping goal/quest trackers compete for the same 'what next' slot**  
  *Where:* `src/engine/objectives.ts:1-13, src/engine/contracts.ts:1-12 (header explicitly enumerates the overlap), src/engine/challenges.ts:1-12, src/engine/sideOrders.ts:1-8, src/engine/scenarios.ts, board mandates in src/state/gameState.ts:2525-2558, plus passive src/engine/awards.ts and src/engine/achievements.ts`  
  *Problem:* The game has at least six systems that each answer 'here is a directed goal with a reward': the objectives onboarding ladder, the rolling contract board, daily/weekly challenges, factory side-orders, post-IPO board mandates, and scenario campaigns — on top of passive awards and achievements. contracts.ts's own header (lines 2-5) admits it was added because 'the objectives ladder is a finite onboarding spine that ends... the awards are passive; the side-orders are factory work' — i.e. it was patching a perceived gap left by three sibling systems rather than extending one. For the player this is many separate progress surfaces (HQ next-move, ChallengeTracker, ScenarioTracker, contract board, side-order offers, board mandate feed line) that all mean roughly 'do X, get cash/rep/fans', spreading attention thin.  
  *Fix:* Keep the distinct mechanics but unify the PRESENTATION and, where possible, the model: fold objectives + contracts + board mandates into one 'Goals' ledger with a single evaluator interface (metric, target, reward, source), since all three read state the engine already tracks and pay a cash/rep/fans reward. Treat daily challenges and scenarios as explicit alternate run-modes (already separate entry points), and leave awards/achievements as the passive tier. One goal surface instead of four calmer-and-clearer.
- **[medium · bloat] StaffMoment and StaffEvent are two staff-interrupt systems sharing one card**  
  *Where:* `src/engine/staffMoment.ts:14-125, src/engine/staffEvent.ts:15-110, fired back-to-back at src/state/gameState.ts:2411-2455, overlays src/components/StaffMoment.tsx and StaffEvent.tsx (both render `.stfm`)`  
  *Problem:* There are two separate 'a teammate needs a decision' interrupts: staffMoment (a growth upgrade the player picks) and staffEvent (a life event the player answers). They have separate modules, separate pending fields (pendingStaffMoment / pendingStaffEvent, gameState.ts:404/410), separate reducers, separate derived-hash salts, separate cooldowns, and two overlay components — but both target a tenured staffer, both gate on era>=X && staff.length>=2, and both render into the identical `.stfm` card CSS. To the player they are indistinguishable 'team' modals. This is two systems where one parameterized 'staff moment' (with a growth vs life-event kind) would do.  
  *Fix:* Merge into a single staff-interrupt generator with a `kind: 'growth' | 'life'` discriminator emitting the common card type from finding #1. Collapses two pending fields, two reducers, two overlays and two salts into one, and removes the duplicated era/team gating in gameState.ts:2411-2455.
- **[medium · noise] Every interrupt double-notifies: a full-screen modal AND a feed line**  
  *Where:* `src/state/gameState.ts:86 feed.push sites total; interrupt firings each push a feed line beside raising the modal, e.g. eureka 2385, community 2407, regional 2493, earnings 2518, licensing 2670; feed surfaced via src/components/BuzzTicker.tsx`  
  *Problem:* The feed is already the game's unified notification substrate (86 feed.push sites in gameState.ts, rendered by BuzzTicker). Yet nearly every opportunistic interrupt BOTH raises a blocking full-screen modal AND writes a feed line describing the same event (see the paired feed.push next to each pendingX assignment). Lower-stakes interrupts (community ask, regional event, post-launch nudge, staff moment) thus interrupt play modally and then repeat themselves in the ticker — redundant surfacing that inflates perceived noise.  
  *Fix:* Tier the interrupts explicitly: reserve full-screen modals for high-stakes, irreversible or identity-defining beats (rival strike, nemesis declared, earnings, licensing contract, launch reveal) and downgrade the softer ones (community ask, regional event, post-launch nudge, staff moment) to a feed entry or a tappable toast/inbox that opens the choice on demand. The feed framework already exists; this reuses it instead of adding a tenth modal, cutting interruptions without cutting content.
- **[low · bloat] Several engine mechanics carry cognitive/code weight with thin or invisible payoff**  
  *Where:* `src/engine/novelty.ts (no .tsx importer — pure hidden sim modifier), src/engine/subsystems.ts (only DesignLab), src/engine/deviceLegacy.ts + src/engine/collections.ts (only Museum), src/engine/franchise.ts, src/engine/epilogue.ts, src/engine/buzz.ts (only BuzzTicker)`  
  *Problem:* A tail of modules each add a concept the player must (or never gets to) understand for limited return: novelty.ts is a hidden multiplier with zero UI surface (no .tsx importer), so its effect is unattributable to the player; deviceLegacy + collections exist only inside the Museum screen; subsystems only in DesignLab; franchise is a thin spread across two screens. Individually cheap, collectively they widen the concept surface (each is another stat/term/screen-section to learn) without each earning its slot, which compounds the noise the interrupt and goal families create.  
  *Fix:* Audit this tail against playtest telemetry / your own play: either surface novelty's effect where the player can see and act on it (a line in the launch breakdown) or fold it into an existing stat; consider merging deviceLegacy + collections into a single Museum 'legacy' concept. Do this AFTER the interrupt/goal consolidations (findings 1-4) which have far higher player-impact-per-unit-effort; list here for completeness of the inventory, not as a first move.

