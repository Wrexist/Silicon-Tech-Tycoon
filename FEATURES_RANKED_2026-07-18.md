# Top 10 Features — ranked, with pros & cons (2026-07-18)

> **Status update (same day):** all ten features below were subsequently implemented on this branch
> in the suggested build order (7 → 10 → 3 → 1 → 6 → 4 → 5 → 8 → 9 → 2), each gated on optional
> state fields with replay-twice integration tests. This document is preserved as the design
> rationale and ranking record.

Synthesized from the four audits in `AUDIT_2026-07-18.md`. Ranking weighs: how much it improves
moment-to-moment feel, how strong a long-term "grind toward it" pull it creates, how well it fits
existing systems, and architectural cost/risk under the determinism rules. Effort: S / M / L.
Fresh derived-hash salts available: 277, 281, 283, 293, 307, 311, 313…

Anti-scope (per existing docs, unchanged): no multiplayer/leaderboards, no F2P mechanics, no
spreadsheet logistics.

---

## 1. Design Budget — a per-project BOM/complexity cap (M)

An era-scaled budget of "engineering points" (or cost cap) per project, so you cannot buy the top
tier in every slot; raising the cap becomes a research/upgrade reward. Gated on an optional
`designBudget` field — absent = unlimited = byte-identical saves.

- **Pros:** Un-solves the biggest identified flaw ("maxing is rarely wrong"); makes the excellent
  synergy/archetype system load-bearing instead of decorative; every launch becomes a real puzzle;
  budget increases are a new, meaningful grind reward line; cheap state footprint.
- **Cons:** Touches the core balance surface — needs careful tuning against `balanceGuards`
  (no-universal-recipe, power-still-matters); can frustrate veterans mid-run if applied to existing
  saves (must default off for old saves); interacts with franchise "re-ship the winner" incentives
  and needs messaging so it reads as a puzzle, not a nerf.

## 2. Live Sell-Window Ops board (M–L)

A persistent (non-modal, budget-exempt) HQ card active while a product is live: a decaying momentum
meter you can spend into — weekly channel pushes, price-cut timing, restock sizing, harvest-vs-
sustain at peak. Builds on existing `buzz.ts` + living-product levers (currently 3-use one-shots).

- **Pros:** Fills the single most-cited dead zone (the ~16-week post-launch window with nothing to
  do); the most-requested idea across every prior roadmap doc (proposed 3–4×) — build it once,
  deliberately; adds play without adding popups (it's a card you visit, not an interrupt).
- **Cons:** Largest effort on this list; touches the sales curve, so determinism/integration tests
  are non-trivial (engine changes must be gated on optional fields with no-op defaults); risks
  becoming a chore if the optimal play is "tap every week" — needs bounded, chunky decisions;
  competes for HQ screen space that the clarity work is trying to reduce.

## 3. Category Mastery tracks (M)

Per-category XP from shipping/hitting in that category; visible bars that level into a small
category-specific bonus plus that category's signature archetype/cosmetic finish. Derivable from
the existing `launched[]` history.

- **Pros:** Ten visible grind bars that directly counter the "iterate one winner forever"
  auto-pilot; rewards breadth, which the game's 10 categories were built for; mostly pure/derived
  state (tiny footprint); synergizes with the new Roadmap codex ("what's left to master").
- **Cons:** Bonuses touch sim outcomes, so it needs its own replay-twice integration test (the
  do-nothing pin won't cover it); risks bonus-stacking creep on top of perks/legacy/frontier
  (keep bonuses small or cosmetic-leaning); retroactive XP from old saves needs a fairness decision.

## 4. Pre-launch Keynote gamble (M)

Opt-in: announce a product N weeks before ship for a hype multiplier that decays (and reputation
stings) if you slip the date or under-deliver the promised headline stat. Press reaction via a
fresh derived-hash salt; standard pendingX overlay pattern.

- **Pros:** Adds a genuinely new decision (commit vs. flexibility) to the quiet pre-launch weeks;
  high fantasy fit — keynotes are THE tech-tycoon moment; risk/reward feel with a big payoff
  ceremony; clean fit with the established interrupt architecture.
- **Cons:** One more interrupt stream competing for an already-contended budget (make the reveal
  part of the existing launch ceremony, not a new modal); punishing failure states can feel bad if
  slips are caused by events outside player control; needs anti-cheese tuning (announce-everything
  spam) — likely a per-year cap.

## 5. Moonshot R&D gambles (M)

A high-cost experimental research track (era 3+) with a visible success probability: success grants
a unique component tier or archetype, failure burns the RP (with a small pity refund). Outcome from
a derived hash — never the sim RNG.

- **Pros:** Answers "the tech tree is fully solvable/deterministic"; gives late-game RP a sink in
  the identified research-exhaustion limbo; visible-odds gambles are exciting and honest; unique
  rewards (not +%) add the "new verbs" the endgame audit asked for.
- **Cons:** Failable spends in a deterministic game must be clearly telegraphed or they read as
  unfair; balance risk if moonshot rewards outclass doctrine forks (should complement, not replace);
  needs save-gating so old saves default to "no moonshots attempted."

## 6. Era Mandate draft — pick 1-of-3 run modifiers at each era-up (M)

At each era advance, draft one run-long modifier (e.g. "Cult Following: +fans, −enterprise") from
choices rolled on a fresh salt. Empty selection = no-op for old saves.

- **Pros:** Directly attacks two audit findings at once — "eras 1→2 feel identical" (era-up becomes
  a real moment) and the solved macro game (runs get distinct shapes); big replayability per unit of
  content; the era modal already exists as the natural home.
- **Cons:** Modifier balance is combinatorial (needs the balance-guard tests extended); risks
  overwhelming new players at their very first era-up (gate behind first prestige or offer a "no
  mandate" option); permanent run-long choices punish uninformed picks — needs excellent preview
  copy.

## 7. Nemesis Boss ladder (S–M)

Promote the existing nemesis system into a visible multi-week duel: a "beat them" objective
(out-sell/out-rank over a window) with a trophy + unique reward on victory and a stronger successor
after. Reuses the live `nemesis.ts` heat/taunt stream.

- **Pros:** Cheapest big-feel item on the list — the substrate (nemesis, rival arcs, clashes) is
  already built and just needs framing + a visible goal card; gives rivals emotional stakes; endless
  ladder = durable late-game chase; no new interrupt stream needed.
- **Cons:** Duel targets must scale fairly across ascension levels or they're trivial/impossible;
  risks nagging if the duel card over-alerts (keep it a passive card + Goals Ledger row); successor
  escalation needs a cap or it becomes background noise players ignore.

## 8. Franchise Mastery perks (M)

A franchise line that reaches Iconic status and 5+ entries unlocks a permanent named boon for that
line (hype floor, +design ceiling for its launches), previewed in advance ("2 more Iconic entries
to unlock…").

- **Pros:** Turns brand equity from a passive nudge into an aim-able long goal with a countdown;
  deepens the already-shipped franchise system rather than adding a new one; pure read of
  `launched[]`; pairs naturally with Category Mastery (breadth vs. depth as competing pulls).
- **Cons:** Reinforces the "re-ship the winner" incentive that Design Budget (#1) is trying to
  temper — ship after #1 or keep boons flavor-forward; another +% source funneling through
  `PerkBonus` (the audit's "numeric, not new verbs" complaint) unless boons are distinctive;
  long-line UI needs care in the Market franchise panel.

## 9. Strategic Stakes — make the stock market a verb (M)

Holding ≥X% of a rival grants intel (see their pipeline/next launch) and, at higher stakes, a board
seat with a once-per-N-weeks nudge (delay their launch, license their patent). Uses existing
`holdings` state; effects through existing rival-arc hooks.

- **Pros:** Converts an audited "dead weight" system into strategy without new UI surface; deepens
  the rival fantasy alongside #7; intel is a knowledge reward — exactly the "new verbs, not new
  numbers" the endgame needs; late-game cash finally has a strategic sink.
- **Cons:** Rival manipulation can undermine the fair-competition feel the balance guards protect
  (effects must be small and cooldown-gated); interacts with rival AI determinism — needs its own
  integration test; board-seat powers risk being either overpowered or forgettable; moderate reducer
  wiring across stocks + competitors.

## 10. Challenge Seasons — cosmetic reward track (S)

Daily/weekly challenge completions feed a visible seasonal track (date-derived, offline-friendly):
complete N to unlock cosmetic finishes, HQ decor, badges. Pure profile store like `founderLegend`,
entirely outside the sim.

- **Pros:** Cheapest item on the list; zero determinism surface (profile store only); gives the
  already-shipped daily/weekly challenges a reason beyond personal bests; steady "come back
  tomorrow" pull with no F2P mechanics — rewards are cosmetic only.
- **Cons:** Weakest impact on core gameplay of the ten (retention polish, not depth); cosmetic
  rewards must be genuinely desirable (leans on renderer finish/decor variety); seasonal framing
  implies ongoing content authoring — keep tracks generated from existing catalogs to avoid a
  content treadmill; date-based progress needs care offline (derive from the challenge dates
  themselves, not wall-clock randomness).

---

## Suggested build order

Quick wins first, then the two big rocks:
**#7 Nemesis ladder → #10 Challenge Seasons → #3 Category Mastery → #1 Design Budget → #6 Era
Mandates → #2 Sell-Window Ops**, with #4/#5/#8/#9 slotted between as M-sized fillers. #1 before #8
(so franchise boons don't harden the auto-pilot #1 is fixing). Every engine-touching feature ships
gated on optional fields (no-op default) + a replay-twice integration test, per CLAUDE.md.

Already shipped on this branch (not counted in the ten): the **Company Roadmap codex** +
"Coming up" objectives preview — the visibility layer that makes the features above worth grinding
toward, and the de-noise/clarity pass from the audits.
