# Silicon: Tech Tycoon: Depth & Context Plan

**Created 2026-06-28.** A four-track plan for making the game more context-rich and in-depth,
from a parallel audit of every subsystem (content, world, people, meta/narrative). Companion to
`ROADMAP.md` (near-term sequence) and `EXPANSION_ROADMAP.md` (long-horizon thesis).

## The finding all four audits converge on
The game is **mechanically deep and broad, but thin on context**, in three ways:
1. **No voice/narrative**: rivals, eras, products, events are mechanically valid but voiceless;
   nothing is *remembered* or *told*.
2. **Choices are linear, not trade-offs**: you pick the best tier you can afford; breadth (more
   categories/tiers/eras) substitutes for depth-within-a-choice.
3. **The world doesn't react or remember**: events are one-shot toasts; segments/regions are
   static multipliers; staff are stat-bags.

Already shipped (do NOT re-propose): supply-chain suppliers/factories/loyalty/contracts/ethics;
market fatigue / novelty; Living Late Game (reputation maintenance, durable competition, fewer/
bigger late bets); rival doctrines + blurb ARE already surfaced in the Market rival profile.

---

## Track A: Narrative & Voice  (highest leverage, lowest risk, ~zero PROTECTED math)
Pure text/data; no balance risk; amplifies every existing mechanic; what reviews quote.
- [~] **Era world-context**: each era gets an authored "what the world looks like now" passage
  (today `eraRuleSummary` is mechanics-only). `eras.ts` + EraRoadmap. *(slice 1, in progress)*
- [ ] **Rival biographies + doctrine explainer + head-to-head memory**: bios beyond the one-line
  blurb; "Defender: counter-punches when you win their categories"; "you've beaten Oqular 3×".
  `competitors.ts` (additive data) + Market rival profile + a head-to-head state field.
- [ ] **Authored launch verdicts**: promote `postmortem.ts` from templated phrases to authored
  micro-stories keyed on category/era/rival/fit. Pure.
- [ ] **Campaign epilogue**: "Five Years Later" branched on size/reputation/archetype/rivalries
  when the pinnacle (`wentPublic`) is reached (today a silent flag). New component.
- [ ] **Device Museum legacy notes + founder-archetype voice** through objectives. `museum.ts`/
  new `deviceLegacy.ts`, `objectives.ts`.

## Track B: A world that remembers & reacts  (medium risk; some PROTECTED)
- [ ] **Cascading events**: events gain prerequisites and chain (rival recall → industry supply
  crunch → "poach their engineers?"). `events.ts` + state.
- [ ] **Rival story arcs**: ascent/peak/decline trajectories with feed beats + acquire-at-peak
  decision; ties into durable competition. `competitors.ts` (PROTECTED).
- [ ] **Segment macro-cycles & regional shocks**: segments grow/shrink on cycles; regions get
  4-week crises. `segments.ts`/`regions.ts`/`market.ts` (PROTECTED) + balance pass.
- [ ] **Performance-reactive player stock**: launches pop it, scandals dent it, #1 sustains it
  (today a static formula). `stocks.ts`.

## Track C: People & company as humans  (medium risk; mostly state)
- [ ] **Org structure**: departments + team leads + mentorship (a veteran lead speeds juniors).
  `staff.ts`, state schema.
- [ ] **Named departures + rival poaching** with a one-time counter-offer; churn stops being a
  silent stat drop. `events.ts`/`staff.ts`.
- [ ] **Morale as a decision**: offsites/bonuses/retention spend vs. cutting costs. `balance.ts`.
- [ ] **Financing decisions**: loans/investors so runway is a bet, not a read-only timer.
  `economy.ts`, state. *(Supplier "satisfaction"/negotiation is the new layer atop shipped loyalty.)*

## Track D: Decisions with trade-offs  (deepest; PROTECTED engine + measured balance pass)
- [ ] **Component variants** (same tier, perf-vs-efficiency) + **synergy archetypes** (Chip6+
  Display6 = "Flagship Integration") → component choice becomes 2D. `catalogs.ts`/`product.ts`.
- [ ] **Category-specific buyer mixes**: a wearable is 35% Style, a desktop 35% Pro; the same
  recipe shouldn't win everywhere. `segments.ts`.
- [ ] **Category subsystems** (laptop cooling, wearable sensors) + **research-tree forks**
  (mutually-exclusive paths → distinct playstyles). `catalogs.ts`/`research.ts`.

---

## Recommended sequence
**A first** (cheapest, no balance risk, biggest review impact, amplifies everything), then **B**
and **C** (pair naturally with A: rivalry headlines need rival arcs; named departures need the
people layer), then **D** last and gated behind an explicit go-ahead + a `npm run sim` balance pass
(it reshapes the tuned economy).

Constraints every item is filtered through (unchanged): $8.99 premium, fully offline, zero
dark patterns, RULE #1 (premium through restraint), engine-first + tested, PROTECTED code
(`engine/`, persistence schema in `state/`, `render/DeviceRenderer.tsx`) only with a go-ahead.
