# Review & Improvement Plan — Retention/DLC work (v20–v23.2)

A senior-review pass over everything added this session (scenarios, result cards, choice-event
variety, build tuning, daily/weekly challenges, OS/Platform DLC A+B+C, device museum, founder perks,
AI-era content). Bugs found are fixed; everything else is a prioritized, checkable plan. All work
respects the LOCKED constraints (premium $8.99, offline, no backend, no dark patterns, zero hero assets).

---

## ✅ Fixed in this review pass
- [x] **Scenario deadlines were soft** — a player could miss the deadline then grind the goal for late
      star credit. New pure `canEarnStars(scenario, week)`; recording is gated on it and the tracker
      shows the settled/recorded result past the deadline. (+test)
- [x] **`platformUnlocked` reset on restart / New Game+ / scenario / challenge** — the DLC entitlement
      now carries across new companies (it already survived reloads via the save).
- [x] **Challenge score-lock parity** — the background-resume catch-up path now locks + records a
      challenge that finished while away (matched the boot + tick paths).
- [x] **Backup is now complete (P1 done)** — export/import carries the game save AND profile
      progression (legacy, scenario stars, challenge bests, museum) in a `{ save, profile }` wrapper;
      import merges them keeping the best (never a downgrade) and stays back-compatible with bare
      pre-profile export strings. Round-trip + back-compat + garbage-tolerance tests added.

---

## P1 — Correctness / data integrity
- [x] **Backup completeness (DONE).** Export/import now bundles the profile stores; see "Fixed" above.
- [x] **Achievements now persist across companies (DONE).** New profile-level union
      (`state/achievementsProfile.ts`, native-mirrored + in the backup) accumulates every milestone
      ever earned; the game save's per-run `unlockedAchievements` still drives live celebration. The
      Company wall + count show the lifetime union. Merged on unlock, boot, resume, and before every
      company reset (restart/prestige) so nothing is lost. Unlocked **mode achievements**: Goal
      Oriented (win a scenario), Daily Grind (complete a challenge), Platform Owner (release an OS
      version) — +facts, +catalog, +coverage tests.

## P2 — Behaviour decisions (need a call, then a small change)
- [ ] **Challenge has no one-attempt-per-day lock** — a date's challenge can be replayed for a better
      score. Low-stakes offline (no leaderboard to protect), but if "daily" should mean one shot, store
      an "attempted" flag per `${kind}:${dateKey}` and gate restart. Recommend: leave replayable, but
      record the FIRST result as the canonical daily and best separately. Confirm intent.
- [ ] **Era-start scenarios begin under-provisioned** (Head Start = era 2, Empire = era 3) — research
      tiers start at T1 and rivals at era-1 strength, so early competition is soft and component
      research is grindy relative to the era. *Fix (balance pass):* seed `researched` to the era's
      tier band and scale initial rival strength to the start era in `newScenarioGame`. Needs a playtest.

## P3 — Minor / edge
- [ ] **Museum key collision on fixed-seed replays** — replaying the same daily/challenge (same seed)
      and shipping the same product id at the same week overwrites the prior museum entry. Add a
      monotonic launch counter to the key if duplicate enshrinements are wanted.
- [ ] **Onboarding "Or take on a scenario"** ignores the typed company name (scenarios use "Silicon").
      Pass the entered name into `newScenarioGame`.

---

## Optimizations (smoothness / cleanliness)
- [ ] **Per-render localStorage parses.** `ChallengeTracker`/`ScenarioTracker` (HQ, re-renders every
      tick) call `bestScore`/`bestStars` each render; `Company` calls `getMuseum`/`getScenarioStars`
      each render. Cheap individually, but parse-per-tick on the hot path. *Fix:* a tiny in-memory
      cache in each profile-store module, invalidated on write (the stores are the only writers).
- [ ] **`scenarioResultFor` / `challengeViewFor` recompute `netWorth`** (portfolio + stake) every tick
      via `deriveScenarioFacts`. Memoize per (week, relevant inputs) or compute lazily only when a
      tracker is mounted.
- [ ] **Recurring no-op writes**: `syncChallengeBest` calls `recordChallengeBest` every week after the
      score locks (idempotent, but a parse+compare each time). Skip once `challengeScore` is already the
      recorded best.

---

## Polish — premium, intelligent, professional
- [ ] **Balance playtest pass (the big one).** Every new knob is unverified on a device — tune from a
      real playthrough: scenario targets + Underdog's wk-78 deadline; challenge score windows (52/104
      wk) + mutator magnitudes; OS release reward (4 rep / 2k+capped fans); license fee
      (`$1.5k + rep×tier×$40`, cap `$250k`) + uplift (+8); build `tuningShift` (7); perk magnitudes.
- [ ] **Make trade-offs legible (pillar #5).** Platform licensing should state the competitiveness
      cost numerically ("makes {rival} ~+8 stronger in shared markets"), and the build Tuning picker
      should show the live ± on the device's stat bars so the swap is visible, not abstract.
- [ ] **Dedicated audio cues** for scenario-star and challenge-complete (they reuse generic toasts);
      a distinct "mastery" chord would feel more premium (extend `design/sound.ts`).
- [ ] **Result card depth + real share.** Put the scenario stars / challenge score on the card; replace
      the text-only `navigator.share` with a rendered-PNG export (a tested `html-to-image`-style path)
      so the card itself is shareable — revisit the earlier fragility concern with a real lib + a fallback.
- [ ] **Confirm dialogs**: the scenario/challenge "replace your company" confirm should show what's at
      stake (current company's week + net worth) so it's an informed choice; give `scn__confirm` a focus
      trap (the shared `Sheet` has one; these inline overlays don't).
- [ ] **Museum**: filter/sort (category / era / verdict), tap a device → its launch stats + "why it
      won/flopped" (reuse the product-detail insight); a "lineage" view of one product line across eras.
- [ ] **Empty/first-run states** for the new sheets are present; verify the Platform "no installed base
      yet" and Museum empty states read well, and that the Challenges sheet explains scoring at a glance.

## Features around the new systems (post-ship content cadence)
- [ ] **Real StoreKit/IAP** for the Platform DLC (currently a Settings preview toggle) — mirror the
      sandbox entitlement (purchase + restore + `iapAvailable()` gating), so it can ship as paid content.
- [x] **Local challenge history (DONE)** — the Challenges sheet now lists every past daily/weekly
      result (date, re-derived goal, your best), newest-first, from the existing `challengeProgress`
      store via a pure `challengeHistory()` helper. The offline leaderboard substitute. (A consecutive-
      day streak is a possible later cosmetic.)
- [ ] **Custom/shareable scenario codes** — encode a start + objectives into a short string players can
      paste (offline, no server) — the "new thinking" community hook.
- [x] **Mode-tied achievements (DONE)** — win a scenario / complete a challenge / release an OS
      version (now that achievements persist profile-level). Still open: 3★-a-scenario, enshrine-N-
      devices (need profile-store reads in the evaluator, which deriveFacts deliberately avoids).
- [ ] **Era-distinct mechanics** (the deferred large item) — each era should *play* differently
      (e.g. AI-era model-training as a resource), not just scale numbers. Biggest design bet; do it
      behind tests + a playtest, after ship.

---

## The standing recommendation (unchanged)
Nothing here outranks **shipping v1.0** (owner-side: Apple account, Xcode, the 3 CI secrets) and a
**balance playtest** of the new modes. Build it on a device, tune the flagged knobs from real data,
then work this list. Implement P1 (complete backup) before any wider release — it's the one item with
real data-loss risk.
