# Monetization contract — what is free, what is Pro, and where each is enforced

The authoritative free ⇄ Pro table. **Every advertised Pro benefit below traces to a real
enforcement call site, real entitlement behaviour, and a test.** Every meaningful free feature is
recorded here as free, so "is this gated?" is answered by reading one file rather than by grepping.

Companion docs: `MONETIZATION.md` (the model and why), `src/state/proGates.ts` (the table in code),
`appstore/SUBSCRIPTION_GUIDE.md` (store setup).

**How to use it:** if you add, remove or move a gate, this table changes in the same commit. The
gate table itself is pinned from two sides — `src/state/proGates.test.ts` (behaviour) and
`src/state/proGates.enforcement.test.ts` (source invariant: every `ProFeature` must have a real
enforcement call site and its own paywall copy, and no orphan copy may survive a removed feature).

Line numbers are accurate as of this revision; the file names are the durable part.

---

## Free tier values (the numbers that define "free")

| Value | Setting | Where |
|---|---|---|
| Highest era a free company may advance INTO | `maxEra: 2` (Garage + Growth, start to finish) | `src/state/proGates.ts:55` |
| Free scenarios | `first-light`, `bootstrapped` | `src/state/proGates.ts:57` |
| Daily challenge | `dailyChallenge: true` — free, every day, forever | `src/state/proGates.ts:58` |
| Weekly challenge | Free — same screen, no gate | `src/screens/Challenges.tsx:201` |
| **Challenge archive (cross-run history, personal bests, share codes)** | **FREE — deliberately ungated** | `src/screens/Challenges.tsx:224-243` |
| Legacy paid-era owners | Grandfathered to full Pro (`FIRST_FREE_BUILD`) | `src/state/pro.ts` |

---

## Pro features — every one enforced, every one covered

| Feature | Free | Pro | Enforcement (file:line) | Paywall claim | Test |
|---|---|---|---|---|---|
| `eraAdvance` | Eras 1–2 (Garage, Growth) in full | Eras 3–5 (Platform, AI, Autonomy) → the arc to IPO | `src/screens/HQ.tsx:141` (`eraAdvanceLocked`), `:303` (`openPaywall`); predicate at `src/state/proGates.ts:98` | "The next era is Pro… Pro unlocks both, plus everything else below." | `proGates.test.ts` "the era wall"; `proGates.enforcement.test.ts` |
| `scenario` | 2 of 6 hand-built scenarios | The other 4 | `src/screens/Scenarios.tsx:50` (`scenarioLocked`), `:127` (`openPaywall`); predicate at `proGates.ts:104` | "Two are free; Pro opens the rest." | `proGates.test.ts` "scenarios" (incl. that the free ids exist and are the gentlest) |
| `newGamePlus` | Play a run to its end; the IPO overlay is reachable | Start New Game+ (inherited capital/rep/fans/research + founder perk) | `src/App.tsx:684` | "Pro unlocks the prestige loop." | `proGates.test.ts`; `proGates.enforcement.test.ts` |
| `ascension` | Heat 0 (a normal New Game+) | Every Heat level above 0 | `src/App.tsx:653` | "Pro unlocks every Heat level." | `proGates.test.ts`; `ascension.integration.test.ts` |
| `creativeMode` | — | Sandbox: cash floor + research-point floor (`BALANCE.creative`) | `src/screens/Settings.tsx:613` | "An unlimited cash floor and unlimited research… Included with Pro." | `proGates.test.ts`; `proGates.enforcement.test.ts` |
| `platformDivision` | — | Found an OS, licence it, take a cut of the ecosystem | `src/screens/Company.tsx:125` (`isLocked`), `:466` (`openPaywall`) | "Own the stack… Included with Pro." | `proGates.test.ts`; `proGates.enforcement.test.ts` |
| `vault` | Dossiers still accumulate during play (engine-side) | Opening the Vault screen and reading them | `src/screens/Progress.tsx:155` + `:52` | "Pro opens the Vault." | `proGates.test.ts`; `secrets.integration.test.ts` |
| `museum` | Devices are still recorded to the museum store on every launch (`useGame.tsx:989`, capped at the 60 most recent) | Opening the gallery | `src/screens/Progress.tsx:208` + `:52` | "Every run keeps adding to it; Pro opens the gallery." | `proGates.test.ts`; `proGates.enforcement.test.ts` |
| `mastery` | Mastery levels **and their small category-scoped perks apply in every run** (`src/engine/mastery.ts`) — Pro is never an in-run advantage | Opening the Category Mastery board | `src/screens/Progress.tsx:135` + `:52` | "The tracks level in every run — Pro opens the board." | `proGates.test.ts`; `mastery.integration.test.ts` |
| `founderLegend` | The lifetime record keeps accruing (`src/state/founderLegend.ts`) | Opening the record and seeing the ranks | `src/screens/Progress.tsx:171` + `:52` | "It keeps accruing whether or not you subscribe; Pro opens the record and the ranks." | `proGates.test.ts`; `founderLegend.test.ts` |
| `timeMachine` | No snapshots are taken | Quarterly snapshot (every 4 weeks), last 5 kept, rewind. **Campaign only** — never a scenario, never a challenge | `src/screens/Settings.tsx:480`, `:501`; entitlement check `src/state/timeMachine.ts:103`; scored-mode fence `:88`/`:106`; called from `useGame.tsx:929` | "Pro quietly snapshots your company every quarter and keeps the last five… Campaign only." | `timeMachine.test.ts` (incl. the scored-mode fence); `proGates.enforcement.test.ts` |

Non-feature paywall reasons: `onboarding` (`src/App.tsx:824`, once per device, always skippable) and
`upgradeYearly` (`src/screens/Settings.tsx:445`, offered only to an existing monthly subscriber).
Both are covered by the copy assertions in `proGates.test.ts` and by the orphan-copy check in
`proGates.enforcement.test.ts`.

---

## Recorded as FREE

Everything here is deliberately outside the paywall and must stay that way unless the decision is
revisited explicitly.

| Free feature | Notes |
|---|---|
| **The Challenge Archive — cross-run history, per-challenge personal bests, and share codes** | **Deliberate product decision (see below).** `src/screens/Challenges.tsx:224` renders it unconditionally |
| Daily challenge, every day, forever | The retention loop and the notification payload |
| Weekly challenge | Same screen, same absence of a gate |
| Seasonal cosmetic reward track | `Challenges.tsx` `SeasonTrack` — rendered for everyone |
| Play-a-shared-code | `Challenges.tsx:204` |
| The whole core loop: design → launch → read the market → reinvest, unlimited products, no timer | Eras 1–2 |
| Two scenarios (`first-light`, `bootstrapped`) | The on-ramps |
| Goals, Achievements, the Company Roadmap, Help & Guide, the glossary | `Progress.tsx` rows with no `ProChip` |
| The 3D office, decorating, the factory floor | — |
| Mastery perks, franchise perks, Vault accrual, Museum accrual, Founder Legend accrual | The *records* are gated, never the in-run effect — this is what keeps Pro free of pay-to-win (Guideline 3.1.1) |
| No ads, no timers, no energy, no premium currency, no loot boxes | Free and Pro alike |

### Why the Challenge Archive is free (and stays free)

It is a product decision, not an oversight:

- **Replayability and engagement.** The archive is what makes the daily worth returning to — your
  best score on each past challenge, and a code you can hand to someone else. Gating it taxes the
  retention loop instead of selling content, and it is the retention loop that produces the
  sessions in which Pro is eventually bought.
- **Pro sells depth, not the daily.** Everything in the Pro column above is content or a mode. The
  daily challenge is free "every day, forever"; an archive of free things is a strange thing to
  charge for, and a player who hits that wall reads it as a bait-and-switch.
- **Adding a gate later is not free.** It would add StoreKit surface (a new reason, a new purchase
  entry point), restore surface (a returning subscriber's archive would have to re-appear
  correctly), and App Review surface — a new purchase claim that a reviewer will tap and that must
  be honoured exactly as written under Guideline 3.1.2.

This is the resolution of a real contradiction that existed until this revision: `challengeArchive`
was a declared `ProFeature` with paywall copy selling "the full archive — past dailies, the weekly,
and your personal best on each one", and **zero enforcement anywhere in `src/`**. The archive was
always free in practice. The feature, its copy, its benefit-ordering entry and its test entry have
been removed so the code and the claim agree, and
`src/state/proGates.enforcement.test.ts` now fails the build if any feature is ever advertised
without being enforced again.

---

## Invariants this contract depends on

1. **No gate reaches `engine/`** — free and Pro runs are byte-identical; the pinned 160-week
   determinism test can never see monetization.
2. **Pro sells content and modes, never an in-run advantage** (Guideline 3.1.1).
3. **One purchase surface** — `openPaywall({ reason, onUnlocked })` → `src/components/Paywall.tsx`.
4. **A Pro convenience never reaches a scored mode** — the Time Machine skips scenarios and
   challenges.
5. **Prices come from StoreKit** — never typed into the UI, a screenshot, or release notes.
