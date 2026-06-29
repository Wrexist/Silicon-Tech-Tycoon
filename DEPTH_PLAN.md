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
- [x] **Cascading events** (v59): events chain over weeks instead of firing one-shot. A chain opens
  with a consequence now, schedules later beats, and ends in a player CHOICE so the world reacts and
  remembers. Two chains: recall-ripple (rival recall → industry supply crunch → poach-or-promote) and
  viral-spiral (clip blows up → support backlog → ride-or-steady). `engine/eventChains.ts` (pure
  catalog + gated selection) + `gameState.ts` (startChain/resolveChainStep, wired into the tick).
  Supply-crunch beat is capped to a share of cash, so a chain can sting but never bankrupt
  (harness-verified: 0/40 bankruptcies, 40/40 win, CV 5.1%).
- [x] **Rival story arcs** (v60): rivals are no longer static stat-bags. Each drifts through a
  lifecycle (ascending → peaking → declining → stable) that nudges its reputation within a bounded,
  mean-reverting envelope (±16 around its calibrated base). Reputation already drives stock fair
  value, launch strength, and market cap, so a rising rival's stock climbs + it contests harder +
  costs more to acquire, while a faltering one slides and goes cheap — that IS the acquire-at-peak vs
  acquire-in-decline timing decision (the buyout mechanic already exists). Feed beats fire at the
  turns ("on a tear" / "at the height of its powers" / "faltering"). `competitors.ts` (PROTECTED:
  advanceArc, ArcBeat) + `balance.competitors.arc` + `types.ts` (optional arcPhase/arcUntil) +
  `gameState.ts` (beats → feed). Golden invariant kept: initCompetitors untouched, arc bootstraps
  silently on the first tick, no migration. Harness: 0/40 bankruptcies, 40/40 win, CV 5.0%; the drift
  shifts hit-rate 19.0%→17.8% and era-4 arrival +3wk (slightly tougher late competition, as intended).
- [ ] **Segment macro-cycles & regional shocks**: segments grow/shrink on cycles; regions get
  4-week crises. `segments.ts`/`regions.ts`/`market.ts` (PROTECTED) + balance pass.
- [x] **Performance-reactive company value** (v58): bounded, mean-reverting momentum overlay on
  valuation; hit pops it, flop dents it, #1 holds a premium; sparkline on the Market company card.
  Does NOT touch cash/reputation, so bankruptcy + win gate are safe (harness-verified). `gameState.ts`.

## Track C: People & company as humans  (medium risk; mostly state)
- [ ] **Org structure**: departments + team leads + mentorship (a veteran lead speeds juniors).
  `staff.ts`, state schema.
- [x] **Named departures + rival poaching** (v61): losing your best is now a DECISION, not a silent
  stat drop. A rival ON THE RISE (ties into the story arcs) occasionally makes a run at one of your
  content, high-skill people; you match the offer (signing bonus + market pay + a re-poach cooldown)
  or let them walk (the team feels the loss). New pure `engine/poaching.ts` (target selection) +
  `balance.poaching` + `gameState.ts` (pendingPoach field, derived-rng tick roll, resolvePoach) +
  HQ counter-offer card. Golden invariant kept: optional fields, no migration. The roll uses a DERIVED
  rng, so the economy harness is byte-identical (0/40 bankruptcies, 40/40 win, CV 5.0%, all unchanged).
- [ ] **Morale as a decision**: offsites/bonuses/retention spend vs. cutting costs. `balance.ts`.
- [x] **Financing decisions** (v62): debt financing (loans) makes runway a BET, not a read-only timer.
  Borrow cash now (less a 1% origination fee), owe fixed weekly service amortized over a year; good
  reputation earns a cheaper rate (a new place rep matters), leverage makes the next loan pricier, and
  the credit limit scales with recent revenue off a garage-friendly floor. New pure `engine/financing.ts`
  (credit/rate/amortization) + `balance.financing` + `gameState.ts` (loans field, weekly debt service in
  the tick, takeLoan/repayLoan) + a Financing card on the Company screen (outstanding loans + borrow
  presets + pay-off). Equity financing already exists (IPO/stake sale), so this adds the missing debt
  lever. Golden invariant kept (optional `loans`, no migration); the harness never borrows, so the
  economy is byte-identical (0/40 bankruptcies, 40/40 win, CV 5.0%). *(Supplier negotiation is a
  separate shipped layer.)*

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
