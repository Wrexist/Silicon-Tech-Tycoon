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

## Track A: Narrative & Voice  COMPLETE (v57, 2026-06-28). Pure text/data, no balance/PROTECTED math.
- [x] **Era world-context** (`eras.ts` ERA_CONTEXT + EraRoadmap): tagline per era + story on the active one.
- [x] **Rival biographies + doctrine explainer** (`competitors.ts` bio + DOCTRINE_EXPLAINER, Market profile).
- [x] **Authored launch verdicts** (`postmortem.ts` `narrative`, shown in the product detail).
- [x] **Campaign epilogue** (`engine/epilogue.ts`, "Five years later" in the IPO win overlay).
- [x] **Device Museum legacy notes** (`engine/deviceLegacy.ts`, one line per device in the Museum).
- [ ] *Deferred:* head-to-head rival memory ("you've beaten Oqular 3×") + founder-archetype voice
  through objectives (both want a small state field; left for a focused follow-up).
- NOTE: scrubbed pre-existing em dashes from every player-facing area touched (verdict panel, IPO
  overlay, perk descriptions, museum copy). Many remain elsewhere; a dedicated player-copy scrub
  pass would finish it.

## Track B: A world that remembers & reacts  (medium risk; some PROTECTED)
- [ ] **Cascading events**: events gain prerequisites and chain (rival recall → industry supply
  crunch → "poach their engineers?"). `events.ts` + state.
- [ ] **Rival story arcs**: ascent/peak/decline trajectories with feed beats + acquire-at-peak
  decision; ties into durable competition. `competitors.ts` (PROTECTED).
- [ ] **Segment macro-cycles & regional shocks**: segments grow/shrink on cycles; regions get
  4-week crises. `segments.ts`/`regions.ts`/`market.ts` (PROTECTED) + balance pass.
- [x] **Performance-reactive company value** (v58): bounded, mean-reverting momentum overlay on
  valuation; hit pops it, flop dents it, #1 holds a premium; sparkline on the Market company card.
  Does NOT touch cash/reputation, so bankruptcy + win gate are safe (harness-verified). `gameState.ts`.

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
