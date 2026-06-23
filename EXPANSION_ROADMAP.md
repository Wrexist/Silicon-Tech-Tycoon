# Silicon: Tech Tycoon — Expansion & Differentiation Roadmap

**Owner:** Wrexist · **Created:** 2026-06-22 · **Horizon:** the *next* game, not the next bug-fix.

This is the **long-horizon, research-driven** roadmap: where the game goes once it's live, what
depth to add, and where to beat the genre. It is built on a fresh 2024–2026 competitor research
pass (three sweeps: PC/desktop tycoons, mobile/premium sims, "design-is-the-toy" + premium-polish
benchmarks — sourced below).

### How this relates to the other roadmap docs (read this first)

- **`ROADMAP.md`** is the **near-term execution sequence** (Phase 0 ship → Phase 7 content cadence).
  It still wins for *what to do next week*.
- **`RETENTION_ROADMAP.md`** drove the retention backbone — **and most of it already shipped**
  (scenarios, daily/weekly challenges, share cards, museum, OS/Platform DLC, NG+/perks). Treat it
  as history, not a to-do list.
- **This file** is the **forward thesis**: the big depth bets and the polish moat that take the game
  from "feature-complete premium sim" to "the one everyone copies." It deliberately goes deeper than
  `ROADMAP.md`'s Phase 7+ one-liners (which name "rival CEO," "new era," "era-distinct mechanics" but
  don't spec them).

> **The one rule that still orders everything:** *nothing here matters until the game is purchasable.*
> Phase 0 in `ROADMAP.md` (ship v1.0) is the only thing on the critical path. Every epic below is
> goodwill, depth, or revenue — all gated behind being live and having real player data.

---

## 0. Where the game actually is (verified against source, 2026-06-22)

| Signal | State |
|---|---|
| Version | `1.0.0` |
| Engine | pure TS, `src/engine/*` ~7,000 LOC, **deterministic** (pinned) |
| Tests | ~384 across **35** vitest files ✅ |
| Build | `vite build` + PWA green ✅ |
| iOS | Capacitor shell + TestFlight CI, reached a real device (build 11) ✅ |
| Shipped depth | device renderer (parametric SVG + 3D HQ), market sim, stocks/IPO, staff identities + office builder, scenarios, daily/weekly challenges, museum, achievements, OS/Platform DLC, NG+/founder perks |
| **Submission** | **NOT live on the App Store** ⛔ (owner-side; blocks all of this) |

**Honest headline:** the retention *backbone* is done. The two biggest **unbuilt depth levers** are
**(1) market segmentation** and **(2) living, reactive rivals** — both are abstractions today
(`market.ts` runs a single global trend vector; `competitors.ts` rivals are on-rails strength
emitters where only the lead reacts). The biggest **moat** is the one the design doc already names —
**readable simulation** — and it is under-cashed-in. This roadmap is about those three things.

---

## 1. The competitive thesis (what the research proved)

Three independent research sweeps converged on the **same** conclusions. They are unusually
actionable because the genre's universal weaknesses are precisely what our locked pillars defend
against — our differentiation is already written into `CLAUDE.md`; the job is to *spend* it.

### 1.1 The genre's universal failure modes — design AGAINST these

| Failure mode | Evidence | Our defense (pillar) |
|---|---|---|
| **Black-box scoring with hidden randomness** — "did everything right, got a random low score" | Game Dev Tycoon's hidden *self-competition* score + literal random factor (GDT wiki/forums); Mad Games Tycoon 2 "main mechanic is not explained"; Automation "doesn't tell you why cars aren't selling" (40 blind sliders); Motorsport Manager feedback window "too vague to ever close" | **Pillar #5 — readable simulation.** This is our headline wedge. |
| **Solved endgame / "just make more"** — replays die once the recipe is cracked | GDT forum "Endgame – Everything is Flawed"; MGT2 "won't need anyone above 70 skill"; Kairosoft "same formula" fatigue | **Pillar #3 — meaningful failable bets.** Already two tuning mandates in `balance.ts`. |
| **Late-game micromanagement death** — depth doesn't scale, becomes a chore | Startup Company "grindy, not enough automation"; Computer Tycoon "too much manual counting"; Industry Giant 2 "a lot of clicking, played paused" | **Epic E (delegation)** — *unbuilt*. |
| **Dead rivals** — "nothing more than a color on the map" | Computer Tycoon (top complaint) | **Epic B (living rivals)** — *the gap*. |
| **The toy outpaces the sim** — visual design doesn't affect outcomes | Automation: "looks do NOT affect sales" — self-inflicted, since the toy is visual | **Epic G** — make form a demand lever. |
| **Progress loss / ad & IAP nagging** | Smartphone Tycoon: no cloud save ("hours gone"), "ad every 2–3 minutes" | **Locked monetization** — our entire brand wedge. |
| **Thin content at a premium price → "rip-off" 1-stars** | documented even against Monument Valley; the "premium tax" | depth + readable *why* = the antidote. |
| **Desktop-density menus on touch** | Two Point Hospital mobile "awkward menus off-PC" | **RULE #1** + touch-first design. |

### 1.2 The winning differentiators — LEAN INTO these

1. **Readable simulation is a moat, not a nicety.** Every config-sim that failed, failed on
   legibility; every premium benchmark (Two Point's "powerful visualizations one click away,"
   tooltips everywhere) won on it. We already have a `LaunchInsight` "why it won/flopped" layer —
   **make it first-class and pre-launch** (Epic C).
2. **The live parametric device render is unique.** Every competitor is pixel-art or generic. No one
   has a premium in-code vector device that updates as you design. **This is the App Store hero shot
   and the featuring hook.** (cross-comp gap)
3. **"Be the premium Smartphone Tycoon."** The audience for *designing phones* exists and is **openly
   begging** for "a premium version with the ads and purchases removed" (Smartphone Tycoon 2 reviews).
   That is verbatim our pitch. This is the single sharpest positioning wedge we have.
4. **Premium-through-restraint is a proven sales strategy**, not just taste — Mini Motorways (96%
   positive, 15.7k), Pocket City (dev: "premium works, exceeded expectations"), Mini Metro ("respects
   the player's intelligence"). Validates RULE #1.
5. **Component-combo discovery is the dopamine core** — Kairosoft's genre×type, Startup Company's
   components→modules→features, Capitalism Lab's raw→product chains. Our parts→device is the same
   loop; **surface the "aha"** (Epic G — component synergy is in the engine but barely visible).
6. **Per-segment value weighting** (Capitalism Lab: brand matters for clothes, price/quality for
   bread) is the **single best depth-without-bloat idea in the research** — and it makes the verdict
   layer richer for free (Epic A).
7. **Delegation scales depth** (Capitalism Lab directors) where its absence kills rivals' late games.

---

## 2. Fresh competitor matrix (2024–2026 pass)

| Game | $ model | What retains it | What kills it | Our move |
|---|---|---|---|---|
| **Game Dev Tycoon** (~2.3M sold, $9.99) | premium | combo discovery, era arc | hidden/random score; solved endgame | readable verdict; failable late bets |
| **Software Inc** (~94% +) | premium | free-form office building; HR depth; **delegation to leads** | micromanagement spam; steep onboarding | steal delegation (Epic E) |
| **Mad Games Tycoon 2** (93%) | premium | rooms; **IP/franchise + fanbase**; sandbox tuning | black-box sliders; endgame snowball | fanbase deepening; failable scaling |
| **Startup Company** (80%) | premium | components→modules→features chain | doesn't scale; grindy late | automation before the grind hits |
| **Computer Tycoon** (84%) | premium | hardware era ambition | bad balance; jank; **dead rivals** | living rivals (Epic B); our polish bar |
| **Capitalism Lab** ($19.99 + DLC) | premium + DLC | **per-product value weighting**; supply chains; **director delegation** | brutal learning curve; accounting tedium | segments (Epic A) + delegation, *minus* the tedium |
| **Kairosoft** (Steam 90%) | premium → F2P ports | combo discovery; **NG+ that carries *some* progress**; fixed arc + score | "same formula"; F2P ports nag | already have NG+/score; keep it clean |
| **Smartphone Tycoon 1/2** (DIRECT) | F2P + ads | "design your phone" fantasy | ad spam; **save-loss**; crashes; "make it premium!" | **be its premium replacement** |
| **Mini Metro / Motorways** (96%) | premium | tight core + **daily/weekly challenges**; reactive audio | (little) | already have challenges; steal the audio |
| **Pocket City** | premium (no IAP) | proves premium mobile works | engagement tapers after days | depth + content cadence |
| **Two Point Hospital (mobile)** | premium | deep, polished, readable UI | repetitive; menu density awkward on touch | readability yes, density no |

*Full sourcing in §6. Two honesty flags: "Mobile Inc." (Pixelbizarre) could not be verified from
current sources (TouchArcade shut down 2024) — excluded rather than fabricated. Some App Store / Pocket
Gamer pages 403'd direct fetch; those rows lean on indexed excerpts + corroborating wikis/Steam.*

---

## 3. The expansion epics (the meat)

Each epic is **engine-first** (pure, tested `engine/` logic before any UI — CLAUDE.md golden rule),
checked against the locked constraints, and tagged with effort and the research that justifies it.
They are ordered by **leverage**, not by ship order (§4 sequences them into horizons).

Several of these elaborate one-liners already in `ROADMAP.md` Phase 7+; that is intentional — this
turns "rival CEO" / "era mechanics" from a bullet into a buildable spec. Where an epic touches
**PROTECTED** code (`engine/`, persistence schema, `render/DeviceRenderer.tsx`) it is flagged and
**needs an explicit go-ahead** per CLAUDE.md.

---

### EPIC A — Market Segments (the demand-model overhaul) ✅ SHIPPED (v24, 2026-06-22)

> **Status:** COMPLETE end-to-end (engine `segments.ts` + integration via additive `scoreLaunch`
> overrides + wizard "Who it's for" + post-launch "Audience" verdict). Balance preserved (balanced
> products average back to the old demand; lopsided diverge). Live economic feel for lopsided builds
> still wants a playtest. Original spec below.


**Research basis:** Capitalism Lab's per-product value weighting [STEAL]; Automation's "looks don't
affect sales" disconnect [AVOID]; the genre-wide legibility win [DIFFERENTIATE].

**The problem it fixes:** today `market.ts` scores every launch against **one** global trend vector
(`ConsumerTrends.weights`) blended with a static `category.statEmphasis`. There is one "what
consumers want" for the whole world. That makes pricing and positioning a single-axis optimization —
the seed of the "solved recipe" failure.

**What it is:** the market is split into **buyer segments**, each with its own value weighting,
price sensitivity, and size — e.g. *Budget* (price-led, low spec tolerance), *Mainstream*
(balanced), *Pro/Power* (performance + quality, price-insensitive), *Trend/Style* (design + brand),
*Enterprise/Ecosystem* (ecosystem + reliability). A product now **wins a *share of each segment*,
summed** — so "who is this for?" becomes the core strategic question and the same specs play
differently across segments. A flagship aimed at Pro can still mop up Mainstream; a value phone owns
Budget and is invisible to Pro.

**Why it's the top bet:** it (a) adds genuine strategic depth with *zero* new busywork (you still
design one product), (b) makes the verdict layer dramatically richer ("you won Pro, lost Budget on
price") — feeding Epic C, (c) directly attacks the solved-endgame failure (no single recipe wins
every segment), and (d) is a clean, testable, pure-engine change.

**Engine-first plan:**
- `engine/segments.ts` (NEW, pure): `Segment` = `{ id, name, weights: Stats, priceSensitivity,
  size }`; `segmentDemand(stats, price, segment, category)`; `segmentBreakdown(...)` returning
  per-segment captured share. Trends drift *per segment* (reuse the `advanceTrends` easing model).
- `engine/market.ts` (**PROTECTED — go-ahead required**): `scoreLaunch` sums segment shares instead
  of one `demandScore`. Keep the old single-vector path behind the data so existing tests/bounds
  hold; segments are additive.
- `engine/balance.ts`: segment table + caps. `types.ts`: `LaunchInsight` gains `perSegment[]`.
- Tests: segment-sum determinism; "no universal recipe" property test (extends
  `balanceGuards.test.ts`); price-sensitivity monotonicity.

**Constraints check:** offline ✅, pure/tested ✅, no monetization change ✅. **Touches PROTECTED
`market.ts` + the launch math — needs a balance pass and an explicit go-ahead.**

**Risk:** highest of any epic — it reshapes the tuned economy. Mitigation: ship segments *parallel*
to the current model first (compute both, show segments as read-only insight), then flip scoring once
playtested. Effort: **L**.

---

### EPIC B — Living Rivals ("Rival CEO") ✅ SHIPPED (v24–v25)

> **Status:** COMPLETE. **B1** rivals ship real, renderable products (`engine/rivalAI.ts`, Market
> "Rival releases" card). **B2** per-rival doctrines (defender/trendChaser/undercutter/generalist)
> drive reactive, distinct behaviour — variety not raw difficulty, strength ceiling preserved. **B3**
> outright acquisitions (`acquireRival`) + a regenerating field of new entrants (`CHALLENGER_POOL`).
> Original spec below.


**Research basis:** Computer Tycoon's "rivals are just a color on the map" [AVOID, top complaint];
MGT2 IP/fanbase [STEAL]; the player needs a legible "why I lost this quarter" [DIFFERENTIATE].

**The problem it fixes:** `competitors.ts` rivals are abstract `strengthByCategory` emitters with a
share price. Only the lead (Pomelo) reacts to player hits. They don't hold product portfolios, don't
*price*, don't run R&D, can't be acquired, can't fail. They are scenery with a stock ticker.

**What it is (staged):**
- **B1 — Rivals ship real products.** Each rival designs an actual `Product` (specs + price) from
  its archetype + era, visible in a "Rival Releases" feed and in the Museum-style timeline. The
  player can *see and learn from* what beat them. (Replaces the opaque strength number with a thing.)
- **B2 — Rivals react.** Generalize the Pomelo-only reactivity: rivals undercut your price, chase
  trends you've proven, and defend home-turf categories. Each has a readable "doctrine" (premium /
  value / fast-follower).
- **B3 — M&A and mortality.** Weak rivals can be **acquired by you** (cash/stock — ties into the
  existing stock layer) or fail and exit; a new scrappy entrant can appear. Makes the leaderboard a
  living thing, not six fixed names.

**Engine-first plan:** extend `competitors.ts` (**PROTECTED — go-ahead required**) with a
`rivalProduct` generator (reuse `product.ts` `computeStats`) and a doctrine-driven `react()`; new
`engine/rivalAI.ts` for the decision policy (pure, seeded). State: `competitorState` gains a current
product + portfolio history. **This is the paid-DLC candidate already named in `ROADMAP.md` ("Rival
CEO expansion").**

**Constraints check:** offline ✅ (no server AI — deterministic seeded policy), pure/tested ✅.
**Touches PROTECTED `competitors.ts` — go-ahead + balance pass required.** Effort: **L** (B1 alone is
**M** and ships value).

**Risk:** rival pricing/portfolio can destabilize the tuned competition term. Mitigation: B1 first
(visibility only, same strength math), then B2/B3.

---

### EPIC C — The Verdict Layer (cash in the readability moat) 🟢 C1 + C2 SHIPPED (v26)

> **Status:** C1 (`engine/postmortem.ts` — ranked decisive factors + synthesized verdict headline in
> the post-launch detail) and C2 (`engine/forecast.ts` — the pre-launch demand band tightens with
> market knowledge AND scales the realized variance, so it's honest) are SHIPPED. **C3** (plain-
> language "what it does / who wants it" explainers for every stat/component/segment) remains.
> Original spec below.


**Research basis:** the genre's #1 failure is illegibility (GDT/Automation/Motorsport Manager
[AVOID]); Two Point's readability is "the best part of the game" [STEAL]; converging feedback that
*narrows* with investment [STEAL]; never hide the model you're judged by [AVOID].

**The problem it fixes:** we *have* a post-launch "why it won/flopped" detail (`LaunchInsight`), but
the research says the moat is bigger than we're using. The decision happens *before* launch, and the
feedback should *tighten* as you invest in knowing your market.

**What it is:**
- **C1 — First-class Post-Mortem screen.** Promote the launch insight to a dedicated, screenshot-
  worthy verdict: ranked cause→effect ("priced 12% over the segment's budget," "beat Pomelo on
  camera, lost on battery," "launched into a saturated quarter"), 2–3 *dominant* factors (Besiege's
  "tiny tasty morsels," not a fog of 40). Pairs with Epic A's per-segment breakdown.
- **C2 — Converging pre-launch forecast.** The build wizard already shows a demand *range*. Make the
  range **tighten as you invest** in market knowledge (a focus-test spend / analytics research /
  marketer skill) — Motorsport Manager's loop done *right* (it narrows). Rewards iteration; teaches
  the model honestly.
- **C3 — The model is never hidden.** Every stat/component/segment gets a plain-language "what it
  does and who wants it" explainer (Two Point's "almost nothing is confusing").

**Engine-first plan:** mostly UI + a pure `engine/forecast.ts` confidence model; `LaunchInsight`
already carries most of the data. **Lowest risk of any epic — little/no PROTECTED change.** Effort: **M.**

**Why do it early:** it's the differentiation the App Store reviews will *quote*, it's defensive
(turns flops into fair lessons → kills "rip-off" 1-stars), and it amplifies every other epic.

---

### EPIC D — Era-distinct mechanics (each era *plays* differently) 🟠

**Research basis:** GDT/Computer Tycoon era progression keeps the puzzle fresh [STEAL]; the deferred
"era-distinct mechanics" item flagged across v9/v23.2; reaching a new era should be a "new toy" moment.

**The problem it fixes:** `eras.ts` only gates categories + component tiers. Eras scale numbers; they
don't change *rules*. A run's 4th era plays like its 1st with bigger figures — the "solved" risk.

**What it is:** each era introduces one **rule shift**, not just a catalog: e.g. Era 1 garage =
word-of-mouth only (marketing weak); Era 2 = retail channels + supply constraints matter; Era 3 =
ecosystem lock-in / platform effects dominate; Era 4 (AI) = a new stat axis or a hype-volatility
regime. The economy *texture* changes, so mastery transfers but the optimal play doesn't.

**Engine-first plan:** an `eraModifiers` table in `balance.ts` consumed by the existing selectors
(hype weight, channel effectiveness, ecosystem rate). Start with **one** rule shift per era, tested.
**Deliberately deferred large item** — it reshapes the per-era economy and *needs a full playtest*.
Effort: **L**. Do it *after* Epics A/C exist (segments + readability make era shifts legible).

---

### EPIC E — Delegation & Ops (scale without micromanagement) ✅ SHIPPED (v29)

> **Status:** COMPLETE (first slice). Pure gated policies (autoAssignIdle + autoClaimResearch) applied
> at the top of the tick; capability-gated on a senior lead; OFF by default (determinism preserved).
> Company "Delegation" card with two toggles. Future: auto-reorder production, a design-lead spec
> drafter (both bigger — they touch cash/launch decisions). Original spec below.


**Research basis:** Capitalism Lab directors [STEAL]; Software Inc team leads [STEAL]; the late-game
micromanagement death of Startup Company / Computer Tycoon [AVOID]; Two Point mobile "menu density
awkward on touch" [AVOID].

**The problem it fixes:** as the roster and product count grow, the player does more taps for the
same decisions. On a phone this is fatal. We have no delegation/automation today.

**What it is:** promote a senior staffer to **auto-run** a function (auto-assign R&D, auto-reorder a
production run at a set size, a "design lead" that drafts a recommended spec you approve). The player
moves from *operator* to *decider* as the company scales — exactly the premium, touch-first answer.

**Engine-first plan:** pure policies in `engine/ops.ts` (deterministic, seeded) that produce
*proposed* actions the state layer applies; gated by staff skill/seniority. No new economy — it
automates existing actions. Effort: **M.** Low risk (it can only do what the player already can).

---

### EPIC F — Premium feel: reactive audio + microinteractions + accessibility 🟢 a11y SHIPPED (v28)

> **Status:** the ACCESSIBILITY slice shipped (high-contrast mode toggle in tokens.css/settings, on
> top of the existing AA tokens + reduced-motion + focus rings). **Reactive audio + microinteraction
> polish DEFERRED to an on-device session** — they can't be heard/felt headless, and RULE #1 forbids
> shipping polish rough. Original spec below.


**Research basis:** Mini Metro's reactive/generative audio (sound *is* feedback) [STEAL]; PCBS2's
tactile component-snap sounds "make everything satisfying" [STEAL]; Mini Motorways colorblind/dark
modes as table stakes [STEAL]; smoothly animated transitions as a baseline premium signal [STEAL].

**What it is:** we have a synthesized Web Audio system + haptics. Level it up: a **restrained,
layered audio palette** that responds to game state (a sales-week soundscape, a launch-day swell), a
crisp tactile cue + haptic on *every* meaningful action (component snap, price-set, build-confirm),
and **accessibility as baseline** — colorblind-safe accents + a high-contrast mode baked into the
DesignSystem, not a buried late setting.

**Engine-first plan:** mostly `design/` (sound.ts, tokens) + `render/` — no engine change. Effort:
**M.** Pure polish; it's how a $8.99 sim *earns* the price and dodges "rip-off" reviews. Pairs with
the on-device polish debt in `ROADMAP.md` Phase 1.

---

### EPIC G — Deepen the design toy (the centerpiece) 🟢 G1 + G2 SHIPPED (v27)

> **Status:** G1 (`engine/aesthetics.ts` — form/design-language lifts the Style segment; the render is
> now a demand lever) and G2 (two-sided component-synergy readout in the live design view — flagship
> bonus + named weak link) are SHIPPED. **G3** (new categories/era as content drops) remains.
> Original spec below.


**Research basis:** "the product IS the toy" (Pillar #2); Automation "looks don't affect sales"
[AVOID, fix it]; Besiege/TerraTech "each change has immediate visible consequence" [STEAL]; Kairosoft
combo discovery [STEAL]; CMS "tedious after a dozen" → escalate constraints [AVOID].

**What it is:**
- **G1 — Form affects demand.** Tie *visual/aesthetic* choices (the parametric render the player is
  already sculpting — finish, profile, camera form) to the **Style/Trend segment's** desirability
  (needs Epic A). Closes Automation's self-inflicted disconnect; makes the unique render a *lever*.
- **G2 — Surface component synergy.** The engine already computes a `synergy` multiplier (bottleneck
  penalty / flagship bonus) — it's nearly invisible. Make combo discovery legible and rewarding (the
  Kairosoft "aha"): show why a balanced flagship or a bottlenecked budget build scores as it does.
- **G3 — New categories as the engine already renders them.** Renderer supports laptop / desktop /
  monitor / console / wearable / AR silhouettes; gameplay-gates most. Each unlock is a "new toy"
  content drop that's cheap because the render exists. A *new era past AI* is the paid-DLC version.

**Engine-first plan:** G2 is mostly UI over existing math (low risk). G1 depends on Epic A. G3 is
data in `catalogs.ts`. Effort: **M** (G3 per-category is **S** each).

---

## 4. Sequencing — three horizons

Mapped onto `ROADMAP.md`'s phases so they don't drift. **Horizon 1 is free updates** (goodwill +
word-of-mouth + reviewer depth); **Horizon 2 mixes free depth with paid DLC** (the revenue axis);
**Horizon 3 is the ambitious bets** to sequence *by live player data*.

| Horizon | Epics | Type | Gate / rationale |
|---|---|---|---|
| **0 — Ship** (ROADMAP Phase 0–1) | — | owner-side + on-device debt | **blocks everything**; get real data first |
| **H1 — "Make it legible & alive"** | **C** (verdict layer), **F** (feel/a11y), **G2** (synergy) | free 1.x | cheapest, lowest-risk, biggest review impact; cashes in the moat |
| **H2 — "Make it deep"** | **A** (segments) → **G1** (form→demand), **E** (delegation) | free + the first paid DLC | the headline depth bet; A unlocks G1 and enriches C |
| **H3 — "Make it a living world"** | **B** (living rivals / Rival CEO DLC), **D** (era mechanics), **G3** (new category/era DLC) | paid DLC | the ambitious, balance-heavy bets; sequence by what H1/H2 data says players want |

**Why this order, bluntly:**
- **C and F before A and B.** Readability + feel are cheap, low-risk, almost-no-PROTECTED-code, and
  they're what the App Store reviews quote. They also make the risky depth bets (A/B) *legible* when
  they land — shipping segments without the verdict layer would reproduce Automation's exact failure.
- **A before B.** Segments reshape demand; living rivals must compete *within* that model. Building
  reactive rivals against the single-vector market would mean reworking them again after A.
- **D last.** Era-distinct mechanics are the highest-playtest-cost, lowest-marginal-clarity item
  until segments + readability exist to express the era shifts.

---

## 5. Locked constraints — every epic is filtered through these (do not violate)

1. **$8.99 premium, complete & winnable, ZERO dark-pattern monetization.** IAP = creative/sandbox +
   content DLC only. No login streaks, FOMO timers, currency, boosts, loot boxes, or ads. **Ever.**
   *(The research makes this a competitive weapon, not a sacrifice — it's our wedge vs. Smartphone
   Tycoon and the F2P field.)*
2. **No backend. Fully offline.** Rival AI is deterministic seeded policy, not a server. No accounts,
   cloud leaderboards, or live events. Social surface = share cards + museum + personal-best history.
   *(Open exception worth pricing later: iCloud **save sync** — Smartphone Tycoon's save-loss is its
   most damning complaint, and sync is data durability, not a dark pattern.)*
3. **Zero image assets for hero content** — devices/UI/icons are parametric SVG/vector drawn in code.
   *(This is the unique featuring hook — protect and flaunt it.)*
4. **Engine-first discipline** — every mechanic lands as pure, unit-tested `engine/` logic before any
   UI; new content ships as data in `catalogs.ts`/`balance.ts`.
5. **RULE #1 — premium through restraint.** Tokens, 8pt grid, no cramped/blank screens, touch-first
   (never ported desktop density). A smaller game that looks impeccable beats a bigger one that's cheap.
6. **PROTECTED (no refactor without explicit instruction):** `engine/`, persistence schema +
   migrations in `state/`, `render/DeviceRenderer.tsx` + category shapes. **Epics A, B, D touch these
   and need a go-ahead + a balance pass.**

---

## 6. What we deliberately will NOT build (anti-scope)

Saying no is how the premium-restraint pillar survives contact with a long roadmap:

- **Online/global leaderboards, multiplayer, live-ops events** — need a backend; violate constraint #2.
- **Any F2P mechanic** — energy, timers, gacha, ad gates, currency packs. The brand wedge dies the
  moment one appears.
- **Spreadsheet logistics / freight micromanagement** (Industry Giant 2, Capitalism Lab's tedium) —
  depth that is *counting*, not *deciding*. We add segments and rivals (decisions), not bookkeeping.
- **A "remake."** The game is feature-complete; a remake discards shipped value. We **extend**.
- **40-slider config bloat** (Automation's "less fun with too many variables"). Each epic must add a
  *decision*, not a knob. If it can't be made legible, it doesn't ship (Pillar #5 + RULE #1).

---

## 7. The through-line (definition of "a worthwhile expansion")

A returning player always has **(a)** a new goal (scenario star / today's challenge — *shipped*),
**(b)** a reason the next run differs (segments to chase, rivals that moved, an era that plays
differently — *Epics A/B/D*), and **(c)** something to show for it (share card / museum — *shipped*)
— **and at every moment understands *why* a product won or flopped** (*Epic C*, the moat). All
offline, all free of dark patterns. **Revenue grows via content (paid DLC), never via nags.**

---

## Sources (2024–2026 research pass)

PC/desktop sweep: Greenheart forum "Endgame – Everything is Flawed"; GDT wiki (review/sales
algorithm) + Steam "Review seems Random" threads; Gamalytic/SteamSpy (GDT ~2.3M units, $9.99);
CNN/Greenheart 2013 (self-piracy stunt); Software Inc Steam (~94%) + Coredumping devlogs; Mad Games
Tycoon 2 Steam/Fandom (93%; rooms/IP/fans; endgame snowball); Startup Company Steam (80%) +
Indie Ranger; Computer Tycoon Steam/Metacritic (84%; balance/UI/"color on the map" rivals);
Capitalism Lab official site + reviews ($19.99 + DLC; per-product value; director delegation);
Industry Giant 2 GameSpot/DigitallyDownloaded.

Mobile/premium sweep: maxutmost + Kairosoft Wiki (Game Dev Story loop/NG+/endgame) + Steam (90%,
1,367); App Store + Google Play + Metacritic (Smartphone Tycoon 1/2 — ads, save-loss, "make it
premium"); Pocket City (TouchArcade 2018, blog.pocketcitygame.com — "premium works"); Mini Metro /
Mini Motorways (Metacritic, Wikipedia, Steam 96%/15.7k); Two Point Hospital mobile (Metacritic,
CGMagazine); Apple "Pay once & play" editorial lane; ASO/custom-product-page notes.

Design-toy + polish sweep: Automation Steam/forums/Wikipedia ("doesn't tell you why," "looks don't
affect sales"); Motorsport Manager Steam/ToucharcadeAde (vague feedback window); PC Building Simulator
2 (GameSpew/HowToGeek/eTeknix — tactile sound, in-game tablet); Car Mechanic Simulator 2021
(GameSpot/Metacritic — legibility ramp, repetition); Besiege/TerraTech (PC Gamer — immediate visible
consequence); Two Point Hospital/Campus (DualShockers/TheSixthAxis/Stevivor — readability, tooltips,
restraint); Mini Metro/Motorways (Game Developer dev-blogs on reactive audio — indexed abstracts, 403
on direct fetch, corroborated by reviews); Reigns (OpenCritic; IxDF microinteractions).

_Append new ideas as one-liners to the relevant epic; don't act mid-session (CLAUDE.md discipline)._
