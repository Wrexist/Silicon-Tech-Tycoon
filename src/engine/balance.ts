// BalanceConfig — ALL tunable constants in ONE place. Logic reads from here so the
// balancing pass never touches behaviour. First-pass values; tuned in P6.
import { dollars, type Money } from "./money.ts";

export const BALANCE = {
  // --- Company start ---
  // Tighter early economy: a leaner runway + real manufacturing investment per product, so a
  // flop actually costs you (see build.toolingUnits + sales.floorUnits).
  startingCash: dollars(20_000) as Money,
  startingReputation: 8, // 0..100

  // --- Time ---
  // The sim advances one week per tick. Base pace is deliberately slow so each decision
  // (design → production run → launch) has weight; the Fast button divides the interval.
  secondsPerTick: 8,
  fastMultiplier: 8, // Fast mode → 8/8 = 1s per week for catching up
  weeksPerTick: 1,
  quartersWeeks: 13,

  // --- Stats ---
  statMax: 100,

  // --- Device design ---
  design: {
    // multiplier on the camera component's stat contribution by lens count (index = count-1)
    cameraCountFactor: [0.7, 1.0, 1.22, 1.42],
    extraLensCost: dollars(12), // per lens beyond the first
    // RP cost to unlock designing with the 3rd / 4th lens (counts 1–2 are free from the start).
    // Keyed by the lens count being unlocked. Tuned vs early component research (4–8 RP/tier):
    // the triple module is an early-mid goal, the quad array a real era-2 investment.
    lensUnlockCosts: { 3: 14, 4: 30 } as Record<number, number>,
    maxLenses: 4,
    // Premium finishes are RP-unlocked (plastic + aluminium are the free basics) and lend a small
    // Design-appeal bonus — a titanium/gold chassis simply reads as more premium. Applied in the
    // STATE layer (productStats), so it never retroactively changes already-launched products.
    freeFinishes: 2, // first N entries of FINISH_ORDER are available from the start
    finishUnlockCosts: { titanium: 12, gold: 26 } as Record<string, number>,
    finishDesignBonus: { plastic: 0, aluminium: 0, titanium: 2, gold: 4 } as Record<string, number>,
    // Per-product performance/efficiency tuning (state-layer, gameState.productStats). A trade-off,
    // not free stats: "performance" shifts points from battery → performance, "efficiency" the
    // reverse, "balanced" is neutral. Modest so it's a tie-breaker toward what the market wants,
    // never a dominant lever. Applied AFTER computeStats, clamped 0..statMax.
    tuningShift: 7,
    // Value/premium margin axis (the second, mutually-exclusive tuning trade). "value" shaves build
    // cost but dims quality+design appeal; "premium" lifts both appeal stats at a higher build cost.
    // marginShift is the appeal points moved (state-layer, clamped); tuningCostMult scales build +
    // tooling + unit cost (pure engine, tuningCostMultiplier). Magnitudes need a playtest (⚠️).
    marginShift: 6,
    tuningCostMult: { value: 0.85, premium: 1.18 } as Record<string, number>,
    // Screen refresh rate (Hz) — a customizable display spec. Higher Hz adds a small appeal bump
    // and a per-unit cost, but is GATED by the display tier (a budget panel can't drive 144Hz), so
    // it ties into component balance. The effective value is capped on read (effectiveRefreshRate).
    refreshRate: {
      options: [60, 90, 120, 144] as number[],
      maxByDisplayTier: [60, 90, 120, 120, 144, 144] as number[], // index = displayTier − 1 (6 tiers)
      appealPerStep: 3,     // stat appeal per step above 60 (full to performance, half to design)
      unitCost: dollars(5), // extra per-unit cost per step above 60
    },
    // On-board storage (GB) — a customizable spec gated by the software/OS tier (a basic OS can't
    // manage a terabyte). More storage lifts ecosystem + quality appeal and adds per-unit cost.
    storage: {
      options: [128, 256, 512, 1024] as number[],
      maxBySoftwareTier: [256, 512, 512, 1024, 1024] as number[], // index = software tier − 1 (5 tiers)
      appeal: { ecosystem: 3, quality: 1 },
      unitCost: dollars(8), // per-unit cost per step above the 128GB baseline
    },
  },

  // --- Market ---
  market: {
    // demandScore is Σ weight*stat (0..100). Converted to base units via this scale.
    baseUnitsAtScore: 1200, // units of volume per demandScore point at marketSize 1.0
    // Era-scaled market volume: the Garage era is a tiny market you slowly grow into; each later
    // era opens it up. Multiplies demand (→ recommended run size → revenue) by era, so the early
    // game is deliberately slow + hand-built while the end-game still scales. Index = era - 1.
    eraVolumeScale: [0.40, 0.66, 0.92, 1.15],
    // B9 — launch demand variance. The wizard's forecast is a deterministic point estimate; real
    // demand at launch is a BET, so the actual realized volume is jittered by up to ±this fraction
    // (seeded, NOT Math.random — reproducible per save). Turns run-sizing/pricing from solved
    // arithmetic into a genuine over/under-production risk. The wizard surfaces the band ("±12%").
    demandVariance: 0.12,
    hype: {
      reputationWeight: 0.012, // per reputation point
      marketerWeight: 0.05, // per effective marketer skill point
      base: 0.9,
      max: 2.4,
    },
    price: {
      // priceFit peaks when price ≈ perceivedValue*idealMargin; falls off both sides.
      idealMarkup: 2.2, // price ≈ unitCost * markup feels "fair" at mid value
      valueToPrice: dollars(7.5), // each perceived-value point ~ this much fair price (tightened from 9 — margins were too fat, early game too easy)
      tolerance: 0.55, // how forgiving the price curve is
      overpriceHarshness: 1.45, // deviation above fair is penalised this much harder than below
      // B5 — the lab shows a price RANGE (where fit stays ≥ this floor), never the exact peak,
      // so pricing is a margin-vs-volume decision instead of a one-click answer.
      guidanceFitFloor: 0.9,
      minFit: 0.15, // floor for UNDERpricing only — overpricing is allowed to crater to ~0 (elastic demand)
      maxFit: 1.35,
    },
    // Component-combination synergy: a build is judged on its WEAKEST link, not just the sum of
    // parts. A coherent build keeps factor ≈ 1; a flagship dragged down by one budget component is
    // penalised; a balanced, high-end build earns a small flagship bonus. Bounded so it nudges,
    // never dominates — makes "which combination of components" a real design decision.
    synergy: {
      bottleneckPenalty: 0.35, // factor lost per unit of (mean level − weakest level)
      flagshipBonus: 0.06,     // coherent + high-end build bonus
      flagshipMeanFloor: 0.7,  // mean component level needed to qualify for the bonus
      flagshipMaxGap: 0.15,    // max weakest-link gap still counted as "coherent"
      weakestThreshold: 0.18,  // surface a "weak link" callout above this gap
      minFactor: 0.8,
      maxFactor: 1.06,
    },
    competition: {
      // Competition is a *share multiplier* (never erases a viable product):
      // factor = 1 / (1 + competitorStrength * factorK).
      factorK: 0.025,
      // Production planner splits the market by how many rivals match/beat your product.
      // Raised from 0.25/0.60 so rivals actually sting — a single better rival cuts demand by ~42%.
      matchPenalty: 0.32, // a rival roughly as good as you
      beatPenalty: 0.72, // a rival clearly better than you
      beatMargin: 12, // rival strength must exceed your overall by this to "beat" you
      // Your OWN products still selling in the category split the same buyers (self-
      // cannibalization). Below matchPenalty — sequels share a fanbase — but real enough that
      // back-to-back relaunches of one proven design stop being a free demand-pool reset.
      selfPenalty: 0.22,
      // When a rival launches into a category where the player has an ACTIVE product, the
      // remaining weeks of that product's sales curve take this haircut (the feed already
      // announced "faces new competition" — now it's mechanically true, and the mid-life
      // price cut has a real job answering it).
      rivalEntrySalesHaircut: 0.10,
      // Era-scaled competitive pressure. The Garage Era is a protected learning sandbox: rivals
      // barely contest you, so a new player's first products land as steady sellers and they climb
      // toward their first hit instead of drowning in flops. Pressure ramps to full force in the
      // Growth Era, then OVER-full in the Platform/AI eras: late-game rivals press harder, so a
      // contested launch only lands "solid" while an uncontested, maxed product still triumphs —
      // keeping the endgame a contest rather than a guaranteed-hit victory lap. Index = era - 1.
      eraPressure: [0.25, 1.0, 1.2, 1.45] as const,
    },
    trendDrift: {
      easing: 0.06, // how fast current weights ease toward target each week
      retargetEveryWeeks: 14,
      retargetJitter: 6,
    },
  },

  // --- Sales curve (ramp -> peak -> decline) ---
  sales: {
    totalWeeks: 16,
    peakWeek: 4,
    rampPow: 1.6,
    declinePow: 1.25,
    // map launchScore (0..~250) to lifetime unit multiplier
    scoreToVolume: 36,
    // even a weak product that ships should sell *something* (× marketSize), but small enough
    // that a flop can't recoup its tooling — so launch quality genuinely matters.
    floorUnits: 18,
  },

  // --- Mid-lifecycle marketing push (the margin-preserving sibling of a price cut) ---
  // Spend cash to lift a still-selling product's REMAINING weekly demand (capped at the
  // production run, so it only clears genuine surplus). Cost scales with the extra units it'll
  // move, so it's priced fairly: you pay a slice of the revenue you're unlocking, keep full price.
  marketingPush: {
    boost: 0.3,    // +30% to each remaining week's units (then capped at plannedUnits)
    costPct: 0.35, // cash cost = 35% of the extra revenue the push unlocks
    maxPerProduct: 1,
  },

  // --- Fans / loyal customer base ---
  // Fans are guaranteed buyers: they pre-order in proportion to how well your product fits
  // current demand. Hits grow your fanbase; it slowly decays as attention fades.
  fans: {
    starting: 250,
    preOrderConversion: 0.62, // fraction of fans who pre-order a well-fitting product
    gainPerHitUnitsK: 90, // fans gained per 1,000 units of a hit sold
    gainOnHitFlat: 120, // flat fan bump for any hit launch
    // A well-received product BUILDS an audience — not just a viral hit. Without this, fans only
    // ever decayed between hits, so a company shipping steady/solid sellers slowly bled its whole
    // fanbase (hype → score → verdict all stuck low: an early-game stall with no way out). A solid
    // performer wins a real bump; even a steady seller earns enough new fans to outpace the weekly
    // decay, so consistent shipping compounds into reach. The decay caps it (self-limiting).
    gainOnSolidFlat: 70, // flat fan bump for a "solid" launch (+ half the hit's per-unit growth)
    gainOnSteadyFlat: 55, // flat fan bump for a "steady" launch — beats decay so reach slowly grows
    lossPerFlop: 140, // fans lost on a flop
    decayPerWeek: 0.992, // gentle weekly erosion of attention
    selloutFanBonus: 0.04, // extra fan growth when a run sells out (demand > supply)
    // B4 — tame the "deliberately under-produce → guaranteed sellout → free fan farming" exploit
    // WITHOUT killing the real over/under-production bet:
    //  (a) preOrderCap bounds how much of demand fans alone can supply, so a giant fanbase can't
    //      self-fulfil a token run and guarantee a sellout forever; AND
    //  (b) the sellout fan-bonus only fires if the run actually met a meaningful share of demand
    //      (selloutMinDemandShare) — a token run that ignores most of the market no longer farms
    //      fans; instead chronic severe undersupply costs you fans ("couldn't meet demand").
    preOrderCap: 0.6, // pre-orders can satisfy at most this fraction of total demand
    selloutMinDemandShare: 0.5, // run must cover ≥ this share of demand to earn the sellout buzz
    undersupplyFanPenalty: 0.05, // fans lost when a sellout met < selloutMinDemandShare of demand
  },

  // --- Reputation dynamics ---
  // T1 phone scores ~19 uncontested — above flopThreshold (17) but any competition pushes it below.
  // This means: launch early/uncontested and survive; launch late/outclassed and lose reputation.
  reputation: {
    hitThreshold: 70, // era-1 base (see hitThresholdByEra for the scaled bar)
    flopThreshold: 10, // era-1 base
    // Era-scaled expectations: as the company grows, the bar for a "hit" / "solid" rises and the
    // floor for a "flop" lifts. A maxed, well-timed, uncontested product still triumphs late-game,
    // but a lazy or heavily-contested launch only lands "solid" — so the AI Era stays a contest,
    // not a guaranteed-hit victory lap. The player reaches the win-reputation in eras 2-3 under the
    // gentler early bars, so scaling the late bars keeps tension without blocking the endgame.
    // Index = era - 1. effectiveScore = launchScore × competitionFactor is compared to these.
    // ERA-1 FLOP FLOOR (10): a brand-new company's hype is tiny, so even a competently-built,
    // well-priced tier-1 product can only score ~13–17 (measured). A 17 floor made the *maiden
    // launch a guaranteed flop* — punishing reputation for a product the player built correctly.
    // At 10, a sensible first product lands "steady" (neutral: no rep/fan loss) and only a genuinely
    // bad bet (badly overpriced, eff ≤10) still flops. Later eras keep the rising floor for tension.
    hitThresholdByEra: [70, 88, 112, 145],
    solidThresholdByEra: [45, 56, 72, 92],
    flopThresholdByEra: [10, 21, 27, 35],
    gainPerHit: 8,
    // A "solid" launch earns a little reputation too, so a player who optimizes specs + price but
    // never runs marketing campaigns can still climb past the era rep gates on consistent quality
    // alone (without it, only hits/flops moved rep, and a campaign-free run could soft-stall at the
    // era-2 rep wall). Small enough that hits remain the real reputation driver.
    gainPerSolid: 2,
    lossPerFlop: 5,
    overpricePenalty: 2,
    max: 100,
    min: 0,
  },

  // --- Research Points (RP): the tech currency ---
  research: {
    rpPerEngineerSkill: 0.5, // weekly RP per point of engineer skill (assigned to R&D)
    rpPerAssignedResearcher: 0.5, // bonus weekly RP per skill point of any staff assigned to R&D
    rpFounderBase: 1.2, // the founder always trickles a little RP
    eraMultiplier: [1, 1.4, 1.9, 2.6], // RP scales up by era (index = era-1)
    // tech unlocks now cost RP (a fraction of the old cash R&D cost, converted)
    rdCashToRp: 1 / 1400, // dollars of old rdCost -> RP cost
    minTechRp: 4,
    // Research excitement: a strong launch funds your next breakthrough — hits/solids award RP, so
    // the tree advances through PLAY, not just idle ticks. Tuned vs project costs (20–140 RP).
    launchRpHit: 16,
    launchRpSolid: 7,
  },

  // --- Employees: XP & leveling ---
  staff: {
    baseSalary: { engineer: dollars(900), designer: dollars(850), marketer: dollars(800) },
    salaryPerSkill: dollars(140),
    engineerRdSpeedPerSkill: 0.06,
    designerCeilingPerSkill: 1.6,
    marketerHypePerSkill: 1.0,
    // XP: staff gain XP weekly from their assignment; level (=skill) up at thresholds.
    xpPerWeekOnTask: 1.0, // base weekly XP when assigned to a matching task
    xpPerWeekIdle: 0.25,
    xpToLevel: 12, // XP needed per skill level-up (scales with current skill)
    xpLevelScaling: 1.35, // each level costs this much more
    maxSkill: 10,
    // Paid training: instant +1 skill.
    trainCostPerSkill: dollars(1800),
  },

  // --- Recruitment: pay to run a search; after `weeks` it returns `candidates` applicants with
  // varied 0..100 discipline skills + a trait. Two tiers trade cost/time for candidate quality.
  // The shortlist lapses after `expireWeeks` if you don't sign anyone.
  recruitment: {
    candidates: 3, // applicants produced per search
    expireWeeks: 4, // weeks a shortlist stays available before it moves on
    tiers: {
      board: { label: "Job Board", cost: dollars(1_500), weeks: 2, minLevel: 2, maxLevel: 5, starChance: 0.08 },
      headhunter: { label: "Headhunter", cost: dollars(6_500), weeks: 3, minLevel: 5, maxLevel: 8, starChance: 0.3 },
    },
  },

  // --- Build / manufacturing ---
  build: {
    baseWeeks: 3, // weeks to manufacture a product before it can launch
    minWeeks: 1,
    // assembly speedup from the "Assembly Line" project + engineer skill
    weeksPerEngineerSkill: 0.05,
    // Upfront tooling = unit cost × this (a fixed first-run setup), floored at minTooling.
    toolingUnits: 40,
    minTooling: dollars(4_000) as Money,
    // Production-run planning: bounds for the "how many to manufacture" decision.
    minRun: 50,
    maxRun: 5_000_000,
    // Typical/ceiling hint used as a probe size when forecasting demand. NOT shown as the
    // wizard's opening run — the wizard always opens on the affordable `recommendedRun`, which
    // can never bankrupt the player during the build (see safetyReserveMarginUnits below).
    defaultRun: 600,
    // B1 — the recommended/affordable run must leave the player solvent through the build.
    // recommendedRun reserves (buildWeeks × weeklyBurn) + this flat margin before spending cash
    // on units, so a fresh save can't accidentally brick itself manufacturing its first product.
    // Lowered 5,000 → 2,500: at $20k start, a $5k reserve choked early runs so hard (~150 units vs
    // ~200 demand) that thin margins couldn't clear burn and every early cycle ran at a loss. A
    // $2.5k reserve still protects the build-through window but lets early runs reach a profitable
    // scale (a measured first cycle moves from a ~$3k loss to break-even).
    safetyReserveMargin: dollars(2_500) as Money,
  },

  // --- Facilities ---
  facilities: [
    // Garage rent lowered 200 → 120/wk: a pre-revenue garage carrying $200/wk of fixed burn turned
    // thin-margin early cycles net-negative. A leaner garage overhead keeps the bootstrap survivable.
    { tier: 1, name: "Garage", staffCapacity: 4, weeklyRent: dollars(120), upgradeCost: dollars(0) },
    { tier: 2, name: "Studio", staffCapacity: 7, weeklyRent: dollars(1_200), upgradeCost: dollars(120_000) },
    { tier: 3, name: "Campus", staffCapacity: 16, weeklyRent: dollars(6_000), upgradeCost: dollars(1_500_000) },
  ],

  // --- Garage desktops: standalone computer workstations the player buys to populate the office.
  // Cosmetic flair (a fuller, more alive room), capped so the garage never looks cluttered. Each
  // successive desktop costs a little more. `cost[i]` is the price of the (i+1)-th desktop. ---
  desktops: {
    max: 4,
    cost: [dollars(18_000), dollars(32_000), dollars(52_000), dollars(80_000)] as Money[],
  },

  // --- Office shop: furniture costs money and buffs the office. Buffs are summed across the room
  // and capped, so a fully-decorated office is a meaningful COMPLEMENT to the HQ upgrades, never a
  // replacement. K = buff per attribute point; cap = the most furniture can contribute. Anchored
  // against the upgrades: amenities = +5 mood/tier (max +20), workstations = +15% research/tier.
  // Starting values — tunable, pinned by the shop balance test. ---
  shop: {
    resaleRate: 0.5, // refund fraction when selling a placed item
    comfortK: 0.5, // mood-target points per comfort point
    comfortCap: 15, // max mood target from furniture
    focusK: 0.01, // +research multiplier per focus point
    focusCap: 0.15, // max +15% research from furniture
    inspK: 0.5, // Design-stat points per inspiration point
    inspCap: 5, // max +5 Design from furniture
  },

  // --- Tech eras: thresholds to advance (reputation OR cumulative revenue) ---
  eras: [
    { era: 1, name: "Garage Era", repToAdvance: 35, revToAdvance: dollars(500_000) },
    { era: 2, name: "Growth Era", repToAdvance: 60, revToAdvance: dollars(8_000_000) },
    { era: 3, name: "Platform Era", repToAdvance: 80, revToAdvance: dollars(80_000_000) },
    { era: 4, name: "AI Era", repToAdvance: Infinity, revToAdvance: Infinity },
  ],

  // --- Competitors ---
  // B9 — rivals are now SPECIALIZED + REACTIVE, so "which category and price to contest" is a real
  // decision instead of noise. Each rival has a posture (set per-rival in competitors.ts RIVALS):
  //  • preferred categories it contests far more often + with bonus strength (its identity);
  //  • a strength bias (premium = fewer, stronger launches; value = frequent, weaker volume).
  // The strongest rival also REACTS to the player: when the player has recent hits in a category,
  // it bumps the strength of (and shortens its cadence into) that hot category. All bounded so the
  // game stays winnable — see reactivity caps below.
  competitors: {
    launchEveryWeeks: 7,  // rivals are more consistently present (was 9)
    launchJitter: 3,      // less dead-air between competitor launches (was 5)
    strengthDecayPerWeek: 0.88, // rivals persist ~25% longer — competition isn't instantly stale (was 0.85)
    baseStrength: 28,
    // Specialization: a launch in a rival's PREFERRED category is this much likelier to be chosen,
    // and lands with this flat strength bonus (its home turf is genuinely tougher to contest).
    preferredCategoryWeight: 3, // weighting vs. 1 for a non-preferred category when picking
    preferredStrengthBonus: 10, // extra strength when shipping in a preferred category
    // Reactivity: the lead rival defends a category the player is winning. Bounded so it presses
    // but never snowballs into an unbeatable wall.
    reactHitWindowWeeks: 10, // a player hit counts as "recent" for this many weeks
    reactStrengthBonus: 14, // extra strength the reacting rival brings to the player's hot category
    reactMaxStrength: 95, // hard ceiling on any single rival launch strength (keeps it winnable)
    reactCadenceCut: 3, // weeks shaved off the reacting rival's next launch (faster counter-punch)
  },

  // --- IPO / prestige ---
  ipo: {
    minReputation: 85, // plus reaching the final era — the "win" / New Game+ trigger
    // Valuation = baseValuation + cumulativeRevenue × valuationPerRevenueDollar + a CUBIC reputation
    // term (repValuationMax × (rep/100)³). The cubic is deliberate: a garage brand (rep ~8) adds
    // almost nothing (~$4K), so early net worth ≈ your cash and the company genuinely "grows from
    // the garage", while a dominant reputation (rep 85+) compounds into millions of enterprise value.
    valuationPerRevenueDollar: 3,
    repValuationMax: dollars(8_000_000) as Money, // reputation's contribution at a perfect rep 100
    // Going public to RAISE CAPITAL (separate from the endgame win): available once established.
    minRevenueToList: dollars(750_000) as Money,
    baseValuation: dollars(8_000) as Money, // nominal worth of the garage + tools before any traction
    defaultStake: 0.2, // 20% sold by default at IPO
    maxStakePerSale: 0.49, // never sell majority control in one go
    valuationGrowthPerWeek: 0.004, // company value drifts up with momentum
  },

  // --- Stock market (rival equities the player can trade) ---
  stocks: {
    tradeFeePct: 0.008, // 0.8% brokerage on buys + sells
    dividendYieldPerWeek: 0.0011, // weekly dividend ≈ 0.11% of share price for profitable rivals
    // Mean-reverting prices (B6 fix): there is NO free baseline drift, and reputation no longer
    // adds a weekly return (a rival's quality is priced into its fair LEVEL, not a perpetual
    // climb). Every week the price closes meanReversion of its log-gap to fairSharePrice, so
    // launch pops and noise dips DECAY (half-life ≈ ln2/meanReversion ≈ 12wk) instead of
    // compounding. Long-run EV of buy-and-hold ≈ the dividend yield minus brokerage; trading
    // profit comes from timing the swings, not from parking cash.
    meanReversion: 0.06, // weekly fraction of the log-gap to fair value that closes
    repFairWeight: 0.8, // how strongly reputation above/below the rival's calibrated start lifts fair value
    volatility: 0.05, // weekly random swing (±)
    launchPop: 0.06, // share bump when a rival ships a strong product
    historyLength: 24,
  },
  // Prestige legacy bonuses for New Game+. The resource bonuses ESCALATE (each prestige is worth
  // more than the last — triangular growth) so founding empire #4 feels meaningfully mightier than
  // empire #2, giving a real reason to go again. Reputation stays linear (it's powerful early, so a
  // gentler curve keeps the garage era a climb, not a free pass). See legacyBonus() in gameState.
  legacy: {
    cashPerLevel: dollars(20_000),
    repPerLevel: 3,
    rpPerLevel: 14,
    fansPerLevel: 400,
  },

  // --- Ecosystem services: high-ecosystem products generate recurring income from their installed
  // base (apps, cloud, subscriptions). Incentivises building ecosystem-focused products.
  // Revenue = unitsSold × ecosystemStat × weeklyServiceRate cents per week.
  ecosystem: {
    // Was 0.0008 — at that rate a 50k-unit, eco-70 hit earned $28/wk (pure noise), so the
    // ecosystem stat + the Unified OS line + the Ecosystem Architect specialty fed a dead
    // mechanic. At 0.05 the same product pays ~$1,750/wk — a real annuity worth designing
    // toward, still far below per-launch revenue so it complements launches, not replaces them.
    weeklyServiceRate: 0.05,   // cents per unit sold per ecosystem-stat point per week
    minEcosystemStat: 20,      // ecosystem below this threshold earns nothing — the platform is too weak
  },

  // --- Platform / OS division (DLC #1). The recurring licensing revenue is just the ecosystem
  // services above, reframed. These constants size only the one-time OS-version-release MOMENT —
  // a bounded rep/fan bump, never a recurring rate change, so the tuned economy is undisturbed.
  platform: {
    releaseRepBonus: 4,          // one-time reputation lift per OS version release
    releaseFanBaseBonus: 2_000,  // base fans gained on release
    releaseFanPerKInstalled: 5,  // + fans per 1,000 devices in the installed base
    releaseFanCap: 60_000,       // hard cap (no free faucet)
    // Phase C — licensing your OS to rivals: a recurring fee, but it strengthens that rival.
    licenseFeeBase: 1_500,       // $/wk base a licensee pays
    licenseFeePerRepTier: 40,    // + $/wk per (rival reputation point × your OS tier)
    licenseFeeCap: 250_000,      // $/wk hard cap per licensee
    licenseStrengthUplift: 8,    // strength points a licensee rival gains in shared categories (the teeth)
  },

  // --- Staff churn: underpaid or burnt-out staff eventually quit ---
  churn: {
    moodQuitThreshold: 22,    // mood below this counts as "danger zone"
    weeksUntilQuitRisk: 5,    // consecutive danger-zone weeks before churn is possible
    quitChancePerWeek: 0.15,  // per-week probability of quitting once at risk
    underpaidMoodPenalty: 10, // extra target reduction each week when salary lags skill level
    raiseMoodBoost: 15,       // mood bump when player gives a raise
    restMoodBoost: 30,        // mood bump when player sends someone on paid time off (Rest)
    restMinCost: 1000,        // floor on a Rest's cost so it's never free (the unpaid founder pays this)
  },

  // --- Market events ---
  events: {
    firstWeek: 8,
    everyWeeks: 11,
    jitter: 6,
    // RNG cost events (supply crunches) must sting, never kill: each hit is capped to this
    // share of cash on hand, so a random feed item can't bankrupt a by-the-book player mid-build.
    crunchMaxCashShare: 0.35,
  },

  // --- Offline catch-up ---
  offline: {
    maxCatchUpWeeks: 8, // cap how much offline time is simulated
    rate: 0.5, // at reduced effectiveness
  },
} as const;

export type Balance = typeof BALANCE;
