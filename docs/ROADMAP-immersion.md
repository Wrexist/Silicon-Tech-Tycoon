# Immersion & Depth Roadmap

A phased plan to make Silicon Tech Tycoon more immersive, reactive, and replayable. Born from a
five-part design audit (core loop, factory, people/office, living world, meta-progression).

**Diagnosis in one line:** the game isn't missing systems — it's missing *connections* between them.
Rich subsystems run as parallel silos, a few prominent decisions are obvious rather than strategic,
some stretches are passive, and the endgame is thin. The work below is mostly **connective** (make
existing systems reinforce each other), **reactive** (make the world and team respond), and a
**real endgame**.

---

## Engineering guardrails (apply to EVERY item)

These are the house rules from `CLAUDE.md` — non-negotiable:

- **Determinism is sacred.** The engine (`src/engine/*`) is pure. The pinned 160-week reproducibility
  test runs a seed twice and compares. New systems gate on **optional/backfilled** state fields and
  default to **no-ops**, so a do-nothing run stays byte-identical.
- **Side-channel randomness** uses a DERIVED hash of `(seed, week, salt)` — never the main sim RNG.
  Reserve a **fresh salt** per new derived-hash stream. Salts already in use: 11, 23, 37, 53, 71, 83,
  91, 97, 101, 113, 127, 131, 137, 149, 151, 157, 163, 211, 223, 227, 229.
  **Reserved by this roadmap:** 233 (staff life events), 239 (rival-vs-rival), 241 (nemesis beats),
  251 (trend arcs), 257 (post-launch reactive events), 263 (board mandates), 269 (region flavor).
- **Opportunistic full-screen interrupts share a budget** — gate new cards on `interruptQuiet`
  (`≥ BALANCE.interrupts.minGapWeeks` since `lastInterruptWeek`) AND the full `!base.pendingX` chain,
  and stamp `base.lastInterruptWeek = week` when they fire.
- **Money is integer cents** via the `Money` branded type.
- **Design tokens + Lucide icons only**; popups follow the liquid-glass standard in `CLAUDE.md`.
- **Every item ships with tests** and a green `npm test` (incl. the determinism pin) before commit.
- **Balance changes** are validated with `npm run sim` (verdict mix, hit-rate, era pacing) where they
  touch the economy.

Each item below is scoped so it can land as its own PR/commit.

---

## Phase 1 — Connective & Alive (Tier 1) ✅ START HERE

Low-risk, high-immersion, mostly self-contained. Each removes a "dead" or disconnected feeling from a
system players touch constantly.

### 1.1 Word-of-mouth sales curves
**Problem:** every product uses the identical ramp→peak→decline shape (`salesCurve.ts`), scaled by
score. A flop and a mega-hit have the same silhouette. Post-launch is passive watching.
**Change:** shape the curve by the launch's **verdict + quality**. Hits get a faster ramp and a long
tail (a small word-of-mouth re-lift); flops spike then collapse; steady sits neutral.
**Steps:**
1. Add `BALANCE.sales.wordOfMouth` (per-verdict ramp/decline/tail-lift modifiers).
2. Parametrize `curveWeights`/`distributeOverCurve`/`forecast` in `salesCurve.ts` with an optional
   `shape?: { rampPow, declinePow, tailLift }` — omitted → today's exact curve (byte-identical).
3. Derive the shape from `outcome`/quality in `launchReady` (`gameState.ts:2737`) and pass it in.
4. Optional: a high-quality hit adds a late re-lift week (buzz).
**Files:** `engine/salesCurve.ts`, `engine/balance.ts`, `state/gameState.ts`.
**Tests:** hit tail > steady tail > flop tail (area under the back half); default (no shape) equals
current output; totals still sum exactly. **Risk:** low (opt-in shape).

### 1.2 The 3D office is your actual team
**Problem:** seated office robots are generic colored shells keyed by index; the customizable
`Staff.appearance` (skin/hair/shirt/accessory) is used ONLY by the 2D roster avatar. The worker you
see isn't the person on the card. Seating is `staff[i]` (unstable identity).
**Change:** drive each robot's shell/props from that employee's `appearance`; seat **specific**
staffers by id; add a small billboarded name+role tag on the existing tap target.
**Steps:**
1. Thread `staff.appearance` (+ role tint) into `OfficeRobot`/`RobotCharacter` → shell color, a
   hat/glasses/headphones prop from `accessory`.
2. Seat by stable id (sort/assign deterministically), not array index.
3. Name+role label reusing the existing `Html` tap target in `Workstation`/`DesktopPod`.
**Files:** `garage3d/Garage3D.tsx` (only). **Tests:** N/A (visual) — verify build + a screenshot
harness. **Risk:** very low (cosmetic).

### 1.3 Marketing gets targeting (not just volume)
**Problem:** `MARKETING_CHANNELS` is a strictly-dominant "more money = more hype" ladder — the only
choice is "buy the biggest you can afford."
**Change:** each channel over-indexes on a **segment** (and/or region): Social → Style/Mainstream,
Search → Pro/Enterprise intent, Billboards → broad, Influencer → Style/youth, etc. Campaign hype
becomes a per-segment lift, not a flat multiplier.
**Steps:**
1. Add `segmentBias?: Partial<Record<SegmentId, number>>` to `MarketingChannel` (`marketing.ts`);
   default undefined → flat (byte-identical).
2. In `planProduction` (`gameState.ts` ~1258) apply the channel's per-segment multiplier to each
   `segment.captured` instead of only the flat `campaignHype`.
3. Surface "+demand where it lands" in the wizard marketing step (`DesignLab.tsx cur==="marketing"`).
**Files:** `engine/marketing.ts`, `state/gameState.ts`, `screens/DesignLab.tsx`.
**Tests:** a Pro-heavy product gets more from Search than Social; totals bounded; no-bias channel
unchanged. **Risk:** medium (touches demand) — validate with `npm run sim`.

### 1.4 Name real rivals in events
**Problem:** ~50 market/regional events say "a rival" / "a competitor" — never a name, never your
nemesis, never a real product/region. The liveliest systems never appear in the most frequent speech.
**Change:** bind the event layer to the concrete roster. Interpolate a real, doctrine-appropriate
competitor (prefer `state.nemesis`) into event text, and apply the mechanical effect to *that* rival
so text and sim agree (e.g. `rivalScandal` haircuts that rival's strength/stock).
**Steps:**
1. Add optional `{rival}`/`{product}`/`{region}` slots + a `rivalSlot?` hint to `MARKET_EVENTS` /
   `regionalEvents` entries that reference rivals.
2. At fire time (`gameState.ts` event-application block) pick the rival, interpolate, and route the
   effect to it.
**Files:** `engine/events.ts`, `engine/regionalEvents.ts`, `state/gameState.ts`.
**Tests:** an event with a rival slot names a real competitor and applies to it; events without slots
unchanged. **Risk:** low–medium.

---

## Phase 2 — Personality & World Reactivity

Make the team and the world feel alive and full of stakes.

### 2.1 Real employee characters ✅
Full **first+last names** (drop the 16-name modulo reuse) + a one-line generated **bio/quirk** keyed
to role/trait/specialty. Purely cosmetic → sim-safe.
**Files:** `engine/staff.ts` (name tables, `makeIdentity`), `engine/types.ts` (`Staff.bio`),
`state/gameState.ts` (hire paths), `screens/Company.tsx` (cards). **Depends on:** pairs well with 1.2.

### 2.2 Per-employee morale/life events (salt 233) ✅
A `pendingStaffEvent` interrupt (mirrors `staffMoment.ts`/`poaching.ts`): "Ari's thinking of leaving —
sabbatical / raise / wish them well," keyed to a named person's trait/mood/tenure, with 2–3 choices
that move mood/loyalty/skill. Converts fire-and-forget morale into personal micro-decisions.
**Files:** new `engine/staffEvent.ts`, `state/gameState.ts`, new `components/StaffEvent.tsx`, App
overlay stack. **Guardrails:** derived-hash, interrupt budget.

### 2.3 Nemesis storyline (salt 241) ✅
Multi-beat authored arc (first blood → rematch → all-out war → showdown), taunts that **name the
product** that beat you, and record milestones ("you've bested them 5 times"). Deepens the game's best
personality hook.
**Files:** `engine/nemesis.ts`, `state/gameState.ts` (nemesis fold ~2353).

### 2.4 Rival-vs-rival dynamics (salt 239) ✅
Low-probability inter-rival events in `advanceCompetitors`: a declining small rival absorbed by a
giant; two undercutters in one category trigger a mutual dip. The leaderboard moves while you sit
still. Surface via `buzz.ts` + feed.
**Files:** `engine/competitors.ts`, `engine/buzz.ts`, `state/gameState.ts`.

### 2.5 Narrate the climate + a real trend system (salt 251)
**Shipped (narration scope):** the existing (already-forecastable) trend + climate cycles now
*speak*. On a trend retarget, a feed beat names the rising stat ("The market is warming to build
quality…"); each week `climateNarration(week, unlockedRegions)` (pure, RNG-free) can surface a
segment cresting the top of its slow cycle or an opened region tipping into / out of a downturn —
one calm beat at most, region crises prioritised. All feed-text only, so the determinism pin
(run1 === run2) and the balance sim are untouched.
**Deferred follow-up:** the balance-touching **"hot look"** cosmetic redemption (a rotating
finish+color family that lifts Style/Mainstream for matching designs) — held back so 2.5 stays
non-economic; revisit alongside 1.3's segment targeting.
**Files (done):** `engine/climate.ts` (`climateNarration`), `state/gameState.ts` (trend beat +
weekly climate beat), `engine/climate.test.ts`.

### 2.6 Reviews feed the world
**Shipped (running-thread scope):** critic reviews now PERSIST. `foldOutletThreads` folds each
launch's (already-deterministic) outlet scores into a per-outlet warm/cold streak on
`state.reviewThreads`; when an outlet crosses a repeat pan (or repeat rave), a feed beat surfaces
the running thread ("Teardown Weekly pans you too — that's 2 cold takes running"). Harshest outlet
wins the single beat; a middling score breaks a streak. Feed-text only, its own hashed RNG → the
determinism pin and balance sim stay byte-identical. Backfilled to `{}` on old saves.
**Deferred follow-ups:** the landmark-award → fan-sentiment/nemesis provocation, and wiring the
review aggregate into the early sales curve (balance-touching; pairs with 1.1) — held back so 2.6
stays non-economic.
**Files (done):** `engine/reviews.ts` (`foldOutletThreads`), `state/gameState.ts` (launch fold +
`reviewThreads` field), `state/persistence.ts` (backfill), `engine/reviews.test.ts`.

---

## Phase 3 — Depth of Core Decisions

Turn obvious levers into strategic ones; tie the factory to real economics.

### 3.1 Factory floor drives capacity + unit cost — SHIPPED
Two new pure line functions: `lineCapacityMult(floor)` (≥1, widens the factory's weekly ceiling so a
capacity-limited line overtimes later — Arms/QA/upgrades grow it to ×2.0) and `lineUnitMult(floor)`
(≤1, trims per-unit cost via automation down to ×0.85). Both anchored to exactly ×1 for an
unwired/bare floor, so the baseline economy + pinned sim stay byte-identical. Wired via
`effectiveCapacityPerWeek` (capacityPlan + planProduction) and a `scale()` in `effectiveUnitCost`;
surfaced as "Line capacity" + "Line unit cost" rows in the Factory stats sheet.
**Files (done):** `engine/factoryFloor.ts`, `state/gameState.ts`, `components/FactoryMode.tsx`,
`engine/factoryFloor.test.ts`.

### 3.2 Reward layout quality — SHIPPED
`lineEfficiency(floor)` (0..1) scores recipe-order adjacency (present processing machines must
advance in mill→…→qa order along the belt path) + straightness (long lanes beat staircases), reusing
`beltChain`/`beltPath` geometry. A `layoutBonusScale` (∈[0.6, 1]) folds it into all three line
multipliers (speed/capacity/unit) — a complete line always keeps ≥60% of its bonus (never a trap),
tidy work earns the full 100%. A fresh auto-route scores ~1.0 (so 3.1's pins are unchanged); the sim
uses the unwired starter so it stays byte-identical. Surfaced as a "Layout quality" 0–100% row.
**Files (done):** `engine/factoryFloor.ts`, `components/FactoryMode.tsx`, `engine/factoryFloor.test.ts`.

### 3.3 Committed target-segment "design brief" — SHIPPED (core)
`Product.targetSegment?` lets the player COMMIT a product to a buyer segment in the Design Lab (a new
"Design brief" chip row). At launch, if the target segment's stat `fit` clears `briefs.fitThreshold`
(66), a bonus scaling to full at `fitFull` (88) adds reputation + fans and a "brief nailed" feed
beat; missing it forgoes the bonus with a "brief missed" note — never a penalty. Opt-in (unset =
byte-identical baseline; the pinned sim never sets a target). Converts segmentation from a readout
into a real decision.
**Deferred:** periodic market briefs granting cash/RP on completion (a contract-like slate) — noted
for a later pass alongside 3.5's side-order pipeline.
**Files (done):** `engine/types.ts`, `engine/balance.ts` (`briefs`), `state/gameState.ts` (launch
bonus), `screens/DesignLab.tsx` (picker), `state/designBrief.test.ts`.

### 3.4 Segment-textured tuning & regions — SHIPPED (tuning)
Build tuning now shifts WHO the device is for, not just its stats: `tuningSegmentBias(tuning)` gives a
small additive per-segment fit nudge (Performance→Pro, Efficiency/Value→Budget/Mainstream,
Premium→Style/Pro/Enterprise), threaded into `segmentDemand` via a new optional `tuningBias` param and
shown as a "leans …" hint in the Design Lab. "balanced"/undefined returns `{}` → a pure no-op, and the
sim's auto-player always builds balanced, so the pinned sim stays byte-identical (verified).
**Deferred:** per-region segment-mix overrides (the sim is home-only, so this is sim-safe but a
deeper regions integration) — noted for a later pass.
**Files (done):** `engine/segments.ts` (`tuningSegmentBias` + `tuningBias` param), `state/gameState.ts`,
`screens/DesignLab.tsx`, `engine/segments.test.ts`.

### 3.5 Side-orders → contract pipeline — SHIPPED (bonuses + loyalty)
Client commissions now pay a COMPLETION bonus on top of the base payout, tying the pipeline to the
floor: a `qualityBonusPct` scaled by `lineEfficiency` (3.1/3.2 — a tidy, capable line delivers
cleaner) plus a returning-client loyalty premium (`sideOrderClients` tracks completed orders per
client, capped). All applied at completion of an accepted order → opt-in, so the pinned sim never
triggers them (byte-identical). The completion feed narrates the bonus.
**Deferred:** the rotating 2–3-offer slate (single-offer flow kept) and wider offer frequency —
noted for a later UI pass so this increment stays sim-safe and reviewable.
**Files (done):** `engine/balance.ts` (`sideOrders`), `state/gameState.ts` (completion bonus +
`sideOrderClients`), `state/persistence.ts` (backfill), `state/sideOrders.test.ts`.

### 3.6 Post-launch reactive events (salt 257) — SHIPPED
New `engine/postLaunchEvent.ts` generalises the Rival Strike interrupt into three mid-lifecycle beats
on a product ALREADY selling, keyed to its sell-through: momentum (hot seller → paid hype push),
stall (slow mover → clearance markdown for cash + a small rep dip), and supply (a parts pinch →
secure supply vs. take the hit). Derived-hash cadence (salt 257), fired LAST among the opportunistic
interrupts (shares the global budget, past the garage era, on a live product with runway); resolved
via an opt-in `resolvePostLaunch` reducer (cash/rep/fans) with a `PostLaunchEvent` liquid-glass card.
Opt-in → the pinned solo sim raises none → byte-identical.
**Files (done):** `engine/postLaunchEvent.ts`, `engine/balance.ts` (`postLaunch`), `state/gameState.ts`
(fire + `resolvePostLaunch`), `state/useGame.tsx`, `components/PostLaunchEvent.tsx`, `App.tsx`,
`engine/postLaunchEvent.test.ts`.

---

## Phase 4 — Meta-progression & Endgame

The biggest retention gap: the richest phase (era 4 / post-IPO) is nearly empty.

### 4.1 Post-IPO "Legacy Era" endgame (salt 263) — SHIPPED
New `engine/endgame.ts` gives the post-IPO phase real content instead of only the reset offer (which
stays as "Keep building"). Two systems, both gated on `wentPublic`: (1) escalating quarterly **board
mandates** — a derived-hash directive (revenue / hits / fans / #1-rank) that auto-resolves at its due
week, pays cash + reputation if met, then reissues a harder bar; (2) a slate of moonshot
**megaprojects** (Quantum Fab → Fusion Campus) that sink huge cash + RP for permanent payoffs
(reputation, a kept fan multiplier, and **Legacy Points** — a prestige currency 4.3 will spend). Both
surfaced in a new HQ "Legacy Era" card with a live mandate progress meter. Everything is behind
`wentPublic`, which the pinned solo sim never reaches → byte-identical.
**Files (done):** `engine/endgame.ts`, `engine/balance.ts` (`legacyEra`), `state/gameState.ts`
(mandate tick + `fundMegaproject`/`mandateFacts`), `state/useGame.tsx`, `state/persistence.ts`,
`screens/HQ.tsx` (`LegacyEraCard`), `engine/endgame.test.ts`.

### 4.2 Research → branching tree — SHIPPED
Added `ResearchProject.requires?` (prerequisites) + a `capstone` flag, and three era **capstones** —
Growth Engine (E2, req brandStudio+loyaltyProgram), Platform Dominance (E3, req globalDistribution+
verticalIntegration), Singularity Lab (E4, req aiCopilot+neuralMarketing) — each a deep RP sink behind
a real route with a compound payoff (hype / reach / unit-cost / ecosystem / fan-decay). Prereq gate is
enforced in `buyProject`, `startResearchProject`, and both auto-research filters; the Research screen
shows a "Requires …" lock + a "Capstone" tag. Property tests prove the graph is acyclic, every project
reachable, and prereqs sit at an era ≤ their dependant. The sim never buys projects → byte-identical.
**Files (done):** `engine/research.ts` (`requires`/`capstone`, `prereqsMissing`, `projectUnlocked`),
`state/gameState.ts` (gates + capstone effects), `screens/Research.tsx`, `state/researchCapstone.test.ts`.

### 4.3 Prestige meta-tree — SHIPPED (in-run Legacy tree)
New `engine/legacyTree.ts`: a tiered spend-tree (3 tiers × 4 routes — power/marketing/research/margin)
the player buys with the **Legacy Points** earned from 4.1's megaprojects. Higher tiers gate on how
many perks you already own, so each Legacy Era commits to a route and plays as a distinct build. The
boons reuse the `PerkBonus` shape and fold through a new `prestigeBonuses(s)` (founder-perk drip +
Legacy tree) that every hype/RP/design/cost selector now reads — so both sources apply everywhere at
once. Surfaced in the HQ Legacy Era card. Empty selection + legacy 0 = the neutral bonus → the pinned
sim is byte-identical.
**Deferred:** making Legacy Points PERSIST across prestige (a cross-run profile tree) — the current
tree is per-run to avoid a save-layer/`legacy.ts` redesign; noted for a follow-up.
**Files (done):** `engine/legacyTree.ts`, `state/gameState.ts` (`prestigeBonuses` + `buyLegacyPerk` +
`legacyPerks`), `state/useGame.tsx`, `state/persistence.ts`, `screens/HQ.tsx`, `state/legacyTree.test.ts`.

### 4.4 Doctrines across the whole arc — SHIPPED (tier-2 + epilogue)
A tier-2 project per engineering House — Overclock Lab / Endurance Cells / Zero-Defect Line — each
`requires` the matching House (4.2), so it's reachable only once you've committed to that doctrine (and
fork-exclusivity means at most one is ever available). Each stamps a further +4 to the House's stat, so
the doctrine keeps paying off deeper into the tree. The campaign epilogue now names the Houses the
company committed to via a new `doctrineSummary` (engineering + GTM), silent for an unforked run.
**Deferred:** doctrine-flavored mid-game events — noted for a later events pass.
**Files (done):** `engine/research.ts` (3 doctrine projects + `doctrineSummary`), `state/gameState.ts`
(stat bumps), `engine/epilogue.ts` (doctrine clause), `App.tsx`, `state/doctrineArc.test.ts`.

---

## Phase 5 — Retention & Collection

Long-tail goals and daily hooks.

### 5.1 Scenario campaign — unlock chain + star rewards — SHIPPED
The flat scenario menu is now a CAMPAIGN CHAIN: each scenario unlocks only once you've banked enough
total stars across the ones already beaten (`scenarioUnlockStars` — intro 0, standard 2, hard 5, expert
9, overridable per-scenario via `unlockAtStars`). `scenarioUnlocked(scenario, totalStars)` gates the
Scenarios picker (locked cards show "N★ to unlock", the play button disables) and is re-checked in
`startScenario` so a stale UI can't bypass it. A property test proves the chain is completable and every
gate is reachable from earlier scenarios alone (you never need a locked scenario to unlock another). All
profile/UI — scenarios are opt-in, so the sim is untouched.
**Files (done):** `engine/scenarios.ts` (`unlockAtStars`/`scenarioUnlocked`/`scenarioUnlockStars`),
`screens/Scenarios.tsx`, `screens/scenarios.css`, `state/useGame.tsx`, `engine/scenarioCampaign.test.ts`.
### 5.2 Museum & Franchise collection goals — SHIPPED
New pure `engine/collections.ts`: six long-tail "collect them all" goals evaluated against the
cross-run device museum — The Polymath (every category), Hitmaker (10 hits), Across the Ages (all four
eras), Every Era a Hit, Dynasty (a 5-deep franchise), Prolific (25 devices). `collectionFacts` folds
the museum once; each collection reports capped progress + done. Surfaced as a "Collections" section
(N/M collected, progress bars, done badges) atop the Museum sheet. Pure/museum-only — no game-state or
sim touch. Targets read from the live category/era tables so they can't drift.
**Files (done):** `engine/collections.ts`, `screens/Museum.tsx`, `screens/museum.css`,
`engine/collections.test.ts`.
### 5.3 Live industry-rank ladder with named rival "bosses" — SHIPPED
New pure `nextRankRival(state)` returns the named rival directly above the player on the
valuation-sorted leaderboard — the current "boss" to overtake — plus the exact gap and their rank
(null at #1). The Market leaderboard's overtake nudge now shares this helper (DRY), and the HQ home
screen shows a compact ladder line ("#4 · $X to overtake Rival for #3", arch-rival flagged with the
Swords icon) so the climb is a forward chase from the main view. The overtake-by-name celebration in
the tick already existed. Pure read — no tick change → sim byte-identical.
**Files (done):** `state/gameState.ts` (`nextRankRival`), `screens/Market.tsx`, `screens/HQ.tsx`,
`screens/hq.css`, `state/rankLadder.test.ts`.
### 5.4 Challenge sim-mutators — SHIPPED (recession + marketing blackout)
The challenge system gained its first ONGOING sim-rule mutators (the module previously only had
start-condition twists): Recession / Slow Market (`demandMult` contracts the whole addressable market)
and Marketing Blackout (`noMarketing` collapses launch hype + campaign to a floor — win on the product
alone). A new `challengeRules(state)` re-derives the active rules from `activeChallenge` and folds them
into `marketSize` and `effectiveHypeBonus`; neutral outside a challenge (demandMult 1, no blackout), so
a normal run and the pinned sim are byte-identical. The weekly stack can now roll a genuine
mid-run constraint, not just a starting hand.
**Deferred:** the fixed-price mutator (needs price-lock plumbing at launch) and a live weekly ladder —
noted for a follow-up; the `challengeRules` plumbing unblocks both.
**Files (done):** `engine/challenges.ts` (sim-rule mutators), `state/gameState.ts` (`challengeRules` +
`effectiveHypeBonus` + demand hook), `state/challengeMutators.test.ts`.
### 5.5 Office zones / per-desk proximity bonuses (salt-free, derived) (`furniture.ts`, `Garage3D.tsx`)
### 5.6 Delegation specialists "report in" — SHIPPED
`applyWeeklyAutomation` now narrates the delegation Leads by name when they actually act: the People
Lead posts when they reassign idle staff ("Jordan Blake put 2 idle teammates back on task"), and the
Lead Researcher posts a forward recommendation after a claim ("Dr. Okafor recommends Lean Supply as
our next breakthrough" — distinct from buyProject's completion line). Only fires when delegation is ON
and the Lead is employed + an action happened, so a delegation-OFF save (the pinned sim) is a pure
no-op returning the same state object → byte-identical.
**Files (done):** `state/gameState.ts` (`applyWeeklyAutomation`), `state/delegationReport.test.ts`.
### 5.7 Region-specific event flavor tied to taste + the actual surging rival (salt 269) — SHIPPED
Regional events are no longer faceless. A `rivalSurge` now names the ACTUAL surging rival, picked from
the live competitor field via a derived hash (salt 269), and every event carries the region's buying
TASTE (`regionTasteLabel` — "design-led", "performance-hungry", …, derived from the same weights that
size regional reach, so it can't drift). The feed line and the interrupt card both interpolate the
rival name + taste ("Pomelo is gaining ground in this design-led market…"). Both params are optional
so older callers/tests are unaffected, and the sim is home-only (never fires a regional event) →
byte-identical.
**Files (done):** `engine/regionalEvents.ts` (rival + taste), `engine/regions.ts` (`regionTasteLabel`),
`state/gameState.ts`, `components/RegionalEvent.tsx`, `state/regionalEvents.integration.test.ts`.
### 5.8 Factory decor soft effects — SHIPPED (utility equipment bonus)
UTILITY props (bench, rack, tool wall, QC station, gantry, compressor, work light) stopped being pure
dressing: `factoryDecorSpeedMult` shaves −0.8% build time per DISTINCT utility kind on the floor, down
to a −4% floor, so kitting the floor out with a VARIED set (not spamming one cheap prop) earns a small
edge. Folded into `buildWeeksFor` alongside the wired-line bonus; an undecorated floor (and the pinned
sim, which never places a prop) is exactly ×1.0 → byte-identical. Surfaced as a "Floor equipment" stat
row. Purely-decorative props (plant/cone/…) grant nothing.
**Deferred:** the era/research-gated machine palette — noted for a later Factory-Mode UI pass.
**Files (done):** `engine/factoryProps.ts` (`factoryDecorSpeedMult`/`utilityDecorKinds`),
`state/gameState.ts`, `components/FactoryMode.tsx`, `engine/factoryProps.test.ts`.
### 5.9 Choice-event consequence flags/callbacks — SHIPPED
Choices now ECHO. A `ChoiceOption` can raise a named `setsFlag`, and a `ChoiceEvent` can gate itself on
a prior `requiresFlag` — so a decision comes home to roost later. `resolveChoice` records the option's
flag plus a generic `eventId:optionId` record on new `state.choiceFlags`; `pickChoiceEvent` takes the
flags and excludes any `requiresFlag` event until its flag is present. First callback pair shipped: the
"Flagship Store" dilemma's *build* option raises `flagshipOpen`, and a later "The Flagship Comes of Age"
event only ever appears if you actually opened it. With no flags (and the pinned sim never resolves a
choice) every callback event is excluded, so the reachable pool is exactly as before → byte-identical.
**Files (done):** `engine/events.ts` (`setsFlag`/`requiresFlag`/flag-filtered `pickChoiceEvent` + the
callback pair), `state/gameState.ts` (`choiceFlags` + `resolveChoice`), `state/persistence.ts`,
`state/choiceFlags.test.ts`.

---

## Sequencing & rationale

1. **Phase 1** first — highest immersion-per-risk, self-contained, touches what players see constantly.
2. **Phase 2** builds on 1 (2.1 pairs with 1.2; 2.5's "hot look" pairs with 1.3; 2.6 pairs with 1.1).
3. **Phase 3** deepens core decisions once the surface feels alive.
4. **Phase 4** adds the long arc/endgame — larger lifts, best done after the loop is polished.
5. **Phase 5** is the retention long-tail; items are independent and can slot in opportunistically.

Each item is independently shippable. Progress is tracked by checking items off here as they land.

## Status

**Phase 1 — Connective & Alive: COMPLETE ✅**
- [x] 1.1 Word-of-mouth sales curves
- [x] 1.2 Office = your team
- [x] 1.3 Marketing targeting
- [x] 1.4 Rivals named in events

**Phase 2 — Personality & World Reactivity: in progress**
- [x] 2.1 Real employee characters (full names + bios)
- [x] 2.2 Per-employee morale/life events (salt 233)
- [x] 2.3 Nemesis storyline (turf taunts + milestone beats)
- [x] 2.4 Rival-vs-rival dynamics (salt 239)
- [x] 2.5 Narrate climate + trend system — narration scope shipped; "hot look" cosmetic redemption deferred
- [x] 2.6 Reviews feed the world — outlet running-threads shipped; award-provocation + review→curve deferred

**Phase 2 complete** (narration/thread scope; the two balance-touching follow-ups noted above ride with Phase 3).

**Phase 3 — Depth of Core Decisions: complete** (2 balance-deep follow-ups deferred: periodic cash/RP briefs, region segment-mix, offer slate)
- [x] 3.1 Factory floor drives capacity + unit cost (pure-upside; sim byte-identical)
- [x] 3.2 Reward layout quality (lineEfficiency meter feeds all three line mults)
- [x] 3.3 Committed target-segment "design brief" — core shipped; periodic cash/RP briefs deferred
- [x] 3.4 Segment-textured tuning & regions — tuning positioning shipped; region segment-mix deferred
- [x] 3.5 Side-orders → contract pipeline — floor-quality + loyalty completion bonuses; slate deferred
- [x] 3.6 Post-launch reactive events (salt 257) — momentum / stall / supply, opt-in reducer

**Phase 4 — Meta-progression & Endgame: in progress**
- [x] 4.1 Post-IPO "Legacy Era" endgame (salt 263) — board mandates + megaprojects + Legacy Points
- [x] 4.2 Research → branching tree — prerequisites + 3 era capstones, reachability property-tested
- [x] 4.3 Prestige meta-tree — in-run Legacy Points spend-tree; cross-prestige persistence deferred
- [x] 4.4 Doctrines across the whole arc — tier-2 House projects + epilogue clause; flavored events deferred

**Phase 4 complete** (core scope; deferred: cross-prestige Legacy persistence, doctrine-flavored events).

**Phase 5:** not started (see sections above).

> Note on remaining sequencing: items that mutate the live sim/economy (2.4 rival-vs-rival, 2.5 trends,
> 3.x factory economics + segment-textured demand, 4.x endgame/research/prestige) each want their own
> focused pass with `npm run sim` re-validation, so they land as reviewable, individually-verified
> changes rather than one large balance-shifting diff.
