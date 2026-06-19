# Silicon: Tech Tycoon — Retention & Post-Launch Roadmap

**Purpose:** answer "what's the next update / DLC / remake, and how do we retain players while making
the game better?" — grounded in competitor research and the project's LOCKED constraints.

**Read this first — the three hard constraints that shape everything below (CLAUDE.md / LEARNINGS.md):**
1. **$8.99 premium, complete & winnable, ZERO purchases.** v1 IAP = Sandbox/Creative unlock only.
   No login streaks, FOMO timers, currency, boosts, loot boxes, or ads. **Ever.**
2. **No backend. Fully offline.** No accounts, no cloud saves, no global leaderboards, no live events.
3. **Zero image assets for hero content** — devices/UI are parametric SVG drawn in code.

Every idea here is filtered through those three. Anything that needs a server is explicitly cut or
stubbed, not hand-waved.

---

## 0. The honest headline (read before planning anything)

- **Don't do a "remake."** The game is feature-complete and heavily polished (TASK.md v1→v19.7: device
  renderer, 3D HQ, market sim, stocks/IPO, staff identities, achievements, NG+, office builder). A
  remake discards shipped value. The correct move is **extend**.
- **Ship first. This is the nearest-to-market work.** Per TASK.md v15.2/v17, repo-side is done but the
  App Store submission is owner-side and OPEN. For an unshipped premium title, the single biggest
  retention lever is *being live so players can be retained at all*. Building a scenario engine before
  v1.0 is on the store is a side quest. **Wave 0 below is the only thing that matters until it's done.**
- **Why our retention ceiling is structurally fine to be "lower."** Premium + offline means we can't run
  F2P retention machinery (and shouldn't — it's the dark-pattern stuff we banned). Premium retention is
  driven by *quality, mastery, and content cadence*, not psychological nudges. We compensate for "no
  social layer" with deep mastery content + shareable cards (our only real community surface).
- **The genre's #1 documented failure is our biggest risk to design against:** Game Dev Tycoon's
  endgame collapses into "just make more games" once cash snowballs and the optimal recipe is solved.
  Two guards (both are *tuning mandates*, already half-handled in `balance.ts`): (a) keep bets failable
  at every scale; (b) keep the winning product recipe non-deterministic via shifting trends/rivals.

---

## 1. Competitor research — findings that drive the roadmap

Condensed from a sourced research pass. Each row: the mechanic, why it works, and offline-fit.

| Game | Mechanic that retains | Why it works | Offline-fit |
|---|---|---|---|
| **Game Dev Tycoon** | (anti-pattern) solved endgame, deterministic recipe | Replays become pointless once the combo table is known | N/A — *avoid this*. Tuning mandate. |
| **Startup Company** | 4 modes: Sandbox / Campaign / Scenarios / Normal | Same engine, repackaged into goal-driven shapes | ✅ structural template |
| **Mad Games Tycoon 2** | Granular difficulty + toggleable sandbox options; post-launch *patching* of shipped products | "No two runs the same" via config; products stay live levers | ✅ cheap, high replay-per-$ |
| **Two Point Hospital/Campus** | **1–3 star rating per level** (beat at 1★, master at 3★); heavy **free** content updates | Mastery, not time-gates: 3-starring ~15 levels ≈ 100h | ✅ star rating is pure local logic — highest value |
| **Mini Motorways / Mini Metro** | **Daily challenge** (1 map, 1 attempt, no replay); **weekly = mutators** ("one bridge only") | Fresh constraint forces new strategy; "today only" urgency w/o FOMO punishment | ✅ *date-seeded* daily works offline; ❌ global leaderboard needs server |
| **Kingdom Two Crowns** | Challenge Islands (themed constrained scenarios) + new biomes/campaigns as DLC | Constrained scenarios + new content as the paid axis | ✅ content + scenarios |
| **RollerCoaster Tycoon** | **Scenarios with explicit win conditions** are the spine; sandbox is a *separate* audience | Structured goals create the "did I beat it?" hook; sandbox alone does NOT carry retention | ✅ scenarios are the backbone |

**Three load-bearing conclusions:**
1. **Scenarios with tiered win conditions + a star rating are the proven retention backbone** of tycoon
   games — more than sandbox. Lead the post-launch roadmap with this, not sandbox.
2. **Daily/weekly challenges are the cheapest high-replay feature** we can build: reuse the entire
   engine, just override constants (mutators). Deterministically seed from the *date* → every offline
   player gets the same challenge that day with zero server.
3. **Online leaderboards & collaborative/global events are the only things we genuinely can't do.**
   Substitute: **personal-best history + local achievements + shareable parametric result cards.**

**Genre-norm flag to decide consciously:** Two Point and RCT3 both shipped **Sandbox for free**. We
monetize it as the sole IAP. Defensible for a small premium title *only if the $8.99 base already feels
whole* (it does) and sandbox reads as a creative bonus, not a withheld feature. Per RCT/Two Point,
sandbox is **not** the retention driver anyway — scenarios are — so this doesn't cost us retention.

Sources: Greenheart/Steam/Metacritic GDT endgame threads; Startup Company & Mad Games Tycoon 2 store
pages; TheSixthAxis/GameFAQs Two Point updates; Mini Motorways wiki + Dino Polo Club; Kingdom Two
Crowns patch notes; RCT Fandom scenario/sandbox wikis; Solsten/arXiv 1702.08005 on premium-vs-F2P
retention. (Full URLs in the research brief.)

---

## 2. The plan — waves, in priority order

Each wave is a shippable unit. Free updates build goodwill + word-of-mouth; paid DLC is the revenue
axis. **Engine-first discipline applies** (CLAUDE.md): every new mechanic lands as pure, unit-tested
logic in `engine/` before any UI. New content lives in data tables (`catalogs.ts` is the "official mod
channel" — we ship content as data in updates).

---

### Wave 0 — SHIP v1.0 (owner-side, blocks everything) 🔴

Nothing post-launch matters until the game is purchasable. From WHAT_YOU_NEED_TO_DO.md / TASK.md v17:

- [ ] Apple Developer account + App Store Connect app record live
- [ ] Add the 3 CI secrets (`APP_STORE_CONNECT_KEY_ID`, `_ISSUER_ID`, `_API_KEY_BASE64`) — team ID
      `S3U8B8HH96` already wired
- [ ] Mac/Xcode: `npx cap add ios`, portrait-only + iPhone-only, on-device smoke (Preferences mirror,
      status bar, haptics)
- [ ] Decide: ship the Sandbox/Creative IAP in v1, or hide it (the `iapAvailable()` seam already lets
      v1 submit either way). **Recommendation: hide IAP in v1.0**, ship it in the 1.1 free-update wave
      once StoreKit is wired and tested — removes a 2.1-rejection risk on day one.
- [ ] Submit. Get the first real retention/crash data from live players.

---

### Wave 1 — Free update 1.1 "Goals & Bragging Rights" (the retention backbone) 🟢

The proven backbone (scenarios + star ratings + share cards), plus the replay-variety fixes that close
the GDT "solved game" hole. **This is the most important post-ship work.** All offline, all free — it's
the goodwill + word-of-mouth engine and it makes the base game visibly deeper for reviewers.

**1.1a — Scenario mode (the headline)**
- [ ] `engine/scenarios.ts` (PURE): a `Scenario` = hand-authored start state (era, cash, rivals, market
      trend, optional roster) + **tiered objectives** + a 1–3★ rating. Reuses `newGame` seeding.
- [ ] Objective primitives (composable, all readable off existing state): reach $X cumulative revenue;
      ship N products rated ≥ Q; hit reputation R; dominate a category's share by year Y; survive a
      recession; reach final era by week W.
- [ ] Star tiers: 1★ = base win condition, 2★/3★ = harder stretch targets (Two Point model).
- [ ] 6–8 launch scenarios across the difficulty curve ("Bootstrapped" / "Saturated Market" / "One
      Category Only" / "Recession Start" / "Underdog vs. a dominant rival" / "Race to the AI Era").
- [ ] State: a scenario run is a normal game with a `scenario` tag + objective tracker; win/lose check
      runs in the tick. Persisted star ratings per scenario (local).
- [ ] UI: a Scenarios picker (cards w/ ★ earned), in-run objective tracker (reuse the era-goal card
      pattern), win/lose summary sheet.
- [ ] Tests: objective evaluation, star-tier thresholds, scenario seeding determinism (pin like v15.2).
- **Risk:** authoring balance per scenario needs playtesting. Mitigation: objectives read existing,
      already-tuned state; ship 6 tight ones over 12 loose ones.

**1.1b — Shareable result cards (our only community surface, no server)**
- [ ] Render a **parametric SVG** "company summary" / "device showcase" / "scenario 3★" card → export
      as image to share/screenshot. Leans directly into the zero-image-assets + "product is the toy"
      pillars. This substitutes for the leaderboards/global events we can't host.
- [ ] Trigger points: IPO win, NG+ prestige, scenario star earned, a 10/10 product launch.
- [ ] Tests: card data assembly is pure; SVG render is a component.

**1.1c — Replay-variety fixes (kill the "solved game" failure mode)**
- [ ] **Choice events replay verbatim in NG+** (flagged v16/v17). Add more events + a "don't repeat
      until pool exhausted" picker; consider era-4-only dilemmas. `engine/events.ts`.
- [ ] **Component sidegrades** (flagged: always-top-tier is dominant). Give some tiers trade-offs
      (cheaper-but-lower-quality, battery-vs-performance) so the optimal recipe isn't a fixed ladder —
      directly attacks GDT determinism. `engine/catalogs.ts` + `product.ts`. **Touches PROTECTED
      engine — needs explicit go-ahead and a balance pass.**
- [ ] **Verify trend variance** is enough that no single product recipe always wins (tuning check on
      `market.ts` trendDrift, not necessarily a code change).

---

### Wave 2 — Free update 1.2 "Daily & Weekly Challenges" 🟢

The cheapest high-replay feature — reuses the whole engine via constant overrides. Built on Wave 1's
scenario/objective infra.

- [ ] `engine/challenges.ts` (PURE): **date-seeded** daily — `hash(YYYY-MM-DD) → engine config +
      mutator set`. Every offline player gets the identical challenge that day, zero server.
- [ ] **Mutators** (the near-free replay multiplier — pure `balance.ts` overrides): "no marketing
      budget," "one category only," "recession active," "rival starts 3× cash," "fixed price," "half
      runway." Author ~12; daily/weekly composes 1–3.
- [ ] **Weekly = harder mutator stack** (Mini Motorways model), Monday-seeded.
- [ ] **One attempt, result locked locally** (what makes a daily *matter*). Accept that clock-changing
      can defeat it — single-player, no leaderboard to protect, no incentive to cheat yourself.
- [ ] **Personal-best history** instead of online leaderboards: "beat your past dailies," streak as a
      cosmetic achievement only (never a punishing FOMO loop).
- [ ] UI: a "Today's Challenge" entry, mutator readout, locked-result + personal-best view.
- [ ] Tests: date→seed determinism (same date = same challenge), mutator application, one-attempt lock.
- **Risk:** none structural — it's config over a tested engine. Mutator balance is per-mutator tuning.

---

### Wave 3 — Paid DLC #1 "The OS / Platform Division" 💵

Already fully spec'd in **DLC_OS_PLATFORM.md** — don't re-design it, build it. The OS economy already
runs invisibly in the engine (`software` component line, `ecosystem` stat, weekly service revenue); the
DLC surfaces it as a visible division. Lowest-risk-per-delight paid content because the money model
exists; this is mostly a *visibility + framing* layer plus two new levers.

- [ ] Phase A (MVP, shippable alone): Platform screen — name your OS, installed-base headline, surface
      the recurring licensing revenue that's currently folded silently into weekly cash.
- [ ] Phase B: OS version releases (installed-base-wide uplift = a "launch day" for software).
- [ ] Phase C: License your OS to rivals (new revenue line **vs.** sharpening a competitor — real bet).
- [ ] `engine/platform.ts` (PURE) + tests incl. the "no free faucet" cap; gate behind `platformUnlocked`
      (mirrors `sandboxUnlocked`); migration-safe new fields.
- **Why this is the right first DLC:** owning the platform is the tech-tycoon endgame fantasy; it fixes
  the post-IPO "what now?" beat; it pairs with NG+. See DLC_OS_PLATFORM.md §1–8.

---

### Wave 4+ — content cadence & deeper mastery (free + paid mix)

The sustaining layer. Our data-driven `catalogs.ts` makes most of this cheap.

- [ ] **NG+ / mastery beyond bigger numbers** (flagged thin in v16): prestige modifiers, harder-mode
      mutators carried into replays, scenario-only unlocks. Closes the engaged-player tail.
- [ ] **Free content drops**: new component tiers, new device categories (the renderer already supports
      laptop/desktop/monitor/console/wearable/AR silhouettes), device-renderer cosmetics/finishes as
      research unlocks (the v18/v19.2 lens/finish seam generalizes).
- [ ] **Act during the sales curve** (Mad Games Tycoon pattern, partially built): the price-cut and
      Marketing Push levers exist (v19.3/v19.4) — consider product "patches/refreshes" as a further
      mid-life lever so post-launch isn't watch-the-curve-decay.
- [ ] **Paid DLC #2 candidates**: a new era past the AI Era; a category-themed expansion (e.g.
      automotive/robotics) with its own components + scenarios; a "rival CEO" expansion making
      competitors reactive (flagged in v9 backlog).
- [ ] **Achievements expansion** tied to scenarios/challenges (mastery-tier: "3★ every scenario,"
      "win a daily with a self-imposed constraint").
- [ ] **Creative/Sandbox depth** so the IAP is worth $2.99 (flagged thin): scenario editor lite,
      unlimited-everything toggles, cosmetic-only extras.

---

## 3. New thinking (beyond copying competitors)

Original ideas that fit the constraints and the pillars — flagged as ideas, not committed scope:

- [ ] **The device gallery as the meta-progression.** Because devices are parametric SVG and "the
      product is the toy," every product you ever shipped can live in a permanent, browsable **museum**
      that persists across NG+. Retention via *collection*, not engagement-farming — you come back to
      complete the lineage. Pure local, zero assets, on-brand.
- [ ] **Deterministic "this week in tech" headlines** seeded from your run state — turns the market-event
      feed into a readable narrative of *your* company's history, reinforcing pillar #5 (readable sim).
- [ ] **Scenario authoring from a finished run**: "save this run's start conditions as a custom
      challenge" → personal share-card challenge codes (a string the friend pastes — works offline, no
      server, our substitute for sharing leaderboard runs).
- [ ] **A "post-mortem" share card on bankruptcy** — failure made shareable/funny lowers the sting and
      is inherently viral, respecting the player (pillar #6) instead of punishing them.
- [ ] **Era-distinct mechanics** (flagged v9): each era should *play* differently, not just scale
      numbers — gives long runs texture and makes reaching a new era a genuine "new toy" moment.

---

## 4. Sequencing summary (the check-through list)

- [ ] **Wave 0 — SHIP v1.0** (owner-side). Blocks all else. *Highest priority, do not skip to Wave 1.*
- [ ] **Wave 1 — Free 1.1**: Scenario mode + star ratings + share cards + replay-variety fixes.
- [ ] **Wave 2 — Free 1.2**: Daily/weekly challenges + mutators (built on Wave 1).
- [ ] **Wave 3 — Paid DLC #1**: OS/Platform division (already spec'd).
- [ ] **Wave 4+**: NG+/mastery, content cadence, DLC #2, sandbox depth, "new thinking" items.

**Definition of done for "retention":** a returning player always has (a) a new goal to chase
(scenario star / today's challenge), (b) a reason the next run differs (sidegrades, varied events,
mutators), and (c) something to show for it (share card / museum) — all offline, all free of dark
patterns. Revenue grows via *content* (paid DLC), never via nags.

---

_Append new ideas as one-liners; don't act mid-session (per CLAUDE.md quality discipline)._
