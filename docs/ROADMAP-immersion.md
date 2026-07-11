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
New `engine/trends.ts`: seeded multi-week trend arcs toward a stat/segment/category (rise→peak→fade),
forecastable. Emit feed + `buzz` beats when a segment/region crosses a rising/falling band. Redeem
dead cosmetics with a rotating **"hot look"** (finish + color family) that lifts the Style/Mainstream
segments for matching designs.
**Files:** new `engine/trends.ts`, `engine/climate.ts`, `engine/aesthetics.ts`, `engine/segments.ts`,
`engine/buzz.ts`, `state/gameState.ts`, `screens/DesignLab.tsx`.

### 2.6 Reviews feed the world
Persist per-outlet stance across launches; a landmark award spikes fan sentiment and provokes the
nemesis; a repeat scathing outlet becomes a running thread. Wire review score into the early curve
(pairs with 1.1). **Files:** `engine/reviews.ts`, `engine/community.ts`, `engine/nemesis.ts`,
`state/gameState.ts`.

---

## Phase 3 — Depth of Core Decisions

Turn obvious levers into strategic ones; tie the factory to real economics.

### 3.1 Factory floor drives capacity + unit cost
The floor currently only shaves build *weeks* (often 1, once). Add `lineCapacity(floor)` (feeds
`factoryCapacityPerWeek` → the overtime decision) and `lineUnitMult(floor)` (clamped ≤1, feeds
`effectiveUnitCost`). Both pure-upside so baseline is untouched.
**Files:** `engine/factoryFloor.ts`, `state/gameState.ts`, `components/FactoryMode.tsx` (Stats).

### 3.2 Reward layout quality
`lineEfficiency(floor)` scoring recipe-order adjacency + path straightness (reuse `beltChain`/
`formMarks`), fed into the line multipliers, with a 0–100% meter. Makes hand-laying a real puzzle.
**Files:** `engine/factoryFloor.ts`, `components/FactoryMode.tsx`.

### 3.3 Committed target-segment "design brief"
Add `Product.targetSegment?`; score `perSegment[target].captured` against a threshold for bonus
rep/fans at launch. Periodic market briefs grant cash/RP on completion. Converts segmentation from a
readout into the decision. **Files:** `types.ts`, `DesignLab.tsx`, `state/gameState.ts`, events.

### 3.4 Segment-textured tuning & regions
Tuning (`Performance`/`Value`/…) nudges the fit of the segment that cares; regions carry a
segment-mix override (like `CATEGORY_MIX`) instead of a single scalar. Removes obvious global levers.
**Files:** `engine/segments.ts`, `engine/regions.ts`, `screens/DesignLab.tsx`.

### 3.5 Side-orders → contract pipeline
A rotating slate of 2–3 offers with client reputation and floor-quality-gated bonuses (better line →
bigger, better-paying contracts + on-time bonus tied to 3.1/3.2). Widen frequency.
**Files:** `engine/sideOrders.ts`, `state/gameState.ts`, `components/FactoryMode.tsx`.

### 3.6 Post-launch reactive events (salt 257)
Generalize the Rival Strike interrupt into 2–3 mid-lifecycle events on a launched product (sellout →
hype opportunity; slow weeks → clearance; supply shock). Makes the sell phase active.
**Files:** `state/gameState.ts`, `engine/balance.ts`, interrupt UI.

---

## Phase 4 — Meta-progression & Endgame

The biggest retention gap: the richest phase (era 4 / post-IPO) is nearly empty.

### 4.1 Post-IPO "Legacy Era" endgame (salt 263)
A 5th escalating phase behind `state.wentPublic`: quarterly **board mandates** + moonshot
**megaprojects** (big RP+cash sinks with prestige-tier payoffs) instead of an instant reset. Defer the
reset offer. **Files:** `engine/eras.ts`, `engine/balance.ts`, new `engine/endgame.ts`,
`state/gameState.ts` (`canIPO`/`goPublic`), `App.tsx` (`IpoOverlay`), new HQ card.

### 4.2 Research → branching tree
Add `ResearchProject.requires?`, more mutually-exclusive forks, and era **capstones**; deeper era-4 RP
sinks. Turns the "buy everything" checklist into route-planning. Property-test reachability.
**Files:** `engine/research.ts`, `screens/Research.tsx`, `engine/balance.ts`.

### 4.3 Prestige meta-tree
Replace the fixed 10-perk drip with a spend-tree: earn Legacy Points, pick 2 of 4 perks per tier,
weight the resource bonus. Every prestige becomes a distinct build. **Files:** `engine/perks.ts`,
`state/legacy.ts`, `state/gameState.ts`, `App.tsx`.

### 4.4 Doctrines across the whole arc
A tier-2 project per doctrine (researchable only if you chose that House), doctrine-flavored events,
and a doctrine clause in the epilogue. **Files:** `engine/research.ts`, `engine/events.ts`,
`engine/epilogue.ts`.

---

## Phase 5 — Retention & Collection

Long-tail goals and daily hooks.

### 5.1 Scenario campaign — unlock chain + star rewards (`scenarios.ts`, `scenarioProgress.ts`, `Scenarios.tsx`)
### 5.2 Museum & Franchise collection goals with rewards (new `engine/collections.ts`, `Museum.tsx`)
### 5.3 Live industry-rank ladder with named rival "bosses" (`objectives.ts`, `competitors.ts`, `HQ.tsx`)
### 5.4 Challenge sim-mutators (no-marketing / fixed-price / recession) + weekly ladder (`challenges.ts`)
### 5.5 Office zones / per-desk proximity bonuses (salt-free, derived) (`furniture.ts`, `Garage3D.tsx`)
### 5.6 Delegation specialists "report in" with named recommendations (`gameState.ts`, feed)
### 5.7 Region-specific event flavor tied to taste + the actual surging rival (salt 269) (`regionalEvents.ts`)
### 5.8 Factory decor soft effects + era/research-gated machine palette (`factoryProps.ts`, `factoryFloor.ts`)
### 5.9 Choice-event consequence flags/callbacks (`events.ts`, `eventChains.ts`, `state`)

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
- [ ] 2.5 Narrate climate + trend system (salt 251)
- [ ] 2.6 Reviews feed the world

**Phases 3–5:** not started (see sections above).

> Note on remaining sequencing: items that mutate the live sim/economy (2.4 rival-vs-rival, 2.5 trends,
> 3.x factory economics + segment-textured demand, 4.x endgame/research/prestige) each want their own
> focused pass with `npm run sim` re-validation, so they land as reviewable, individually-verified
> changes rather than one large balance-shifting diff.
