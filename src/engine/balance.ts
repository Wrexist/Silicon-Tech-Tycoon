// BalanceConfig — ALL tunable constants in ONE place. Logic reads from here so the
// balancing pass never touches behaviour. First-pass values; tuned in P6.
import { dollars, type Money } from "./money.ts";

export const BALANCE = {
  // --- Company start ---
  // Enough capital for a real first act: 2-3 honest product cycles (tooling + run + marketing)
  // with room to absorb one flop before the garage rent bites. Playtesting at $20K showed the
  // early game was a coin-flip — one mispriced run put the company under before the loop clicked.
  startingCash: dollars(100_000) as Money,
  startingReputation: 8, // 0..100

  // --- Ascension / Heat (opt-in New Game+ difficulty ladder) ---
  // Every prestige normally makes the next run EASIER (the legacy head-start). Ascension is the
  // opt-in inverse: choose a Heat level at prestige and the next run gets harder — the verdict bars
  // rise (products flop more, hits are rarer) and the legacy head-start is cut. It's the roguelite
  // spine that turns "one more run" into a real chase. All modifiers key off an optional
  // ascensionLevel state field defaulting to 0, so a normal run + the pinned sim are byte-identical.
  ascension: {
    maxLevel: 10,               // rungs 0..10
    barsPerLevel: 0.06,         // verdict bars (hit/solid/flop) × (1 + level·0.06): harder to succeed
    headStartCutPerLevel: 0.2,  // legacy head-start × (1 − level·0.2), floored at 0: less free power
    legendPerLevel: 60,         // Founder Legend score per best-Heat-cleared level (the reward)
  },

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
    // Named synergy archetypes (Track D, engine/product.ts SYNERGY_ARCHETYPES) — high-end component
    // pairings unlock a themed stat bonus. highTierFrac sets how close to a line's max counts as
    // "high"; maxTotalBonus caps the summed bonus so even a fully-maxed flagship can't stack past a
    // sane ceiling (keeps the late game contestable). Applied in the state layer (productStats).
    archetype: { highTierFrac: 0.8, maxTotalBonus: 3 },
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
      // A launch campaign's hype is added ON TOP of the (clamped) passive hype and bounded by this on
      // its own — so each campaign tier stays distinct even for a maxed-out company. Sized to fit the
      // biggest channel (Global Launch, hype 1.2) after era amplification with headroom to spare.
      campaignMax: 2.4,
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
      segmentLift: 0.07, // guidance nudges fair this far from the all-round value toward the best-fit segment
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
      // Rival Strike — the respond-or-hold interrupt raised by a contested rival launch. The BASE
      // haircut above still lands immediately and unchanged, so the pinned sim (whose auto-player
      // never answers) stays byte-identical; every response below is a player-opt-in recovery.
      strike: {
        cooldownWeeks: 20,    // at most one interrupt per ~5 months — a rare event, not a nag
        priceCutFrac: 0.10,   // the "Cut price" answer drops the contested product's price 10%
        campaignDiscount: 0.20, // the "Counter-campaign" answer runs marketingPush 20% off
        holdRepBonus: 1,      // "Hold the line" pays +1 rep IF your product outclasses theirs
      },
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
    // --- Market segments (Epic A) ---
    // The market is split into buyer segments (engine/segments.ts SEGMENTS), each weighting the five
    // stats + price differently, so "who is this product for?" becomes a real positioning decision
    // instead of a single global "what consumers want". A launch wins a SHARE OF EACH SEGMENT, summed.
    segments: {
      // How strongly the drifting global trend tilts each segment's taste (0 = pure segment identity,
      // 1 = trend dominates). Keeps the existing trend-drift mechanic meaningful WITHIN segmentation:
      // a segment still leans its way, but a hot trend shifts every segment toward it.
      trendInfluence: 0.4,
      // Floor on a segment's price tolerance after the priceSensitivity divide, so a very
      // price-sensitive segment still has a usable (if narrow) pricing band, never a knife-edge.
      minPriceTolerance: 0.18,
    },
    // --- Market climate (engine/climate.ts, Track B) — the living market ---
    // Segment sizes swell/fade on slow seasonal cycles (REDISTRIBUTIVE: the mix is re-normalized, so
    // the total market is unchanged — only WHO is buying shifts, a timing lever). Regions hit periodic
    // crises that temporarily shrink their demand (home is never shocked, so a domestic launch and the
    // solo-founder sim are unaffected). Amplitudes are modest so this adds texture, not chaos.
    climate: {
      segmentAmplitude: 0.18, // a segment's size swings ±18% of its base over its cycle
      crisisWeeks: 6,         // length of a regional crisis window
      crisisDepth: 0.3,       // a region's demand dips up to 30% at the crisis trough
      risingBand: 0.004,      // week-over-week size delta above which a segment reads as "rising" (UI)
    },
    // --- Global expansion (engine/regions.ts) ---
    // How a region's taste turns into a market-size multiplier for a launch. tasteSpread amplifies how
    // far a product's stat mix can swing its fit above/below 1.0; fitMin/fitMax clamp it so a region is
    // always worth SOMETHING (never zero) but a great match is a real edge. Home is pinned to 1.0.
    regions: {
      tasteSpread: 1.0, // 0 = taste ignored (pure size), higher = positioning matters more
      fitMin: 0.6,
      fitMax: 1.2,
      // Per-region LOYALTY — a standing (signed) meter for each expansion market, moved by regional
      // EVENTS (engine/regionalEvents.ts) and folded into that region's reach. Home is never stored
      // (always neutral), and a home-only company (the pinned solo sim) has an empty map → every
      // multiplier is exactly 1.0 → byte-identical.
      loyalty: {
        cap: 100,            // |loyalty| is clamped to this
        maxSwing: 0.15,      // at full loyalty, that region's reach swings ±this
        decayPerWeek: 0.98,  // loyalty eases back toward neutral without reinforcement
      },
      // Regional EVENTS — a periodic respond-or-ignore interrupt for an expansion market (a boom to
      // ride, a tariff to answer, a rival surge to defend). Player-claimed, gated behind having
      // expanded past Home, and budget-paced; the solo sim never expands → never fires one.
      events: {
        cadenceWeeks: 30,      // avg weeks between regional events (≈1/N chance per eligible week)
        cooldownWeeks: 18,     // hard minimum between them
        minEra: 2,             // expansion is a growth-era-and-beyond concern
        costBase: dollars(45_000),  // era-1 cost to respond…
        costPerEra: 0.6,            // …+60% per era past 1 (bigger markets, bigger stakes)
        boomLoyaltyRespond: 34, boomLoyaltyIgnore: 8,   // a boom rewards riding it; ignoring still trickles up
        tariffLoyaltyRespond: 6, tariffLoyaltyIgnore: -26, // answer a tariff to hold standing, or take the hit
        surgeLoyaltyRespond: 14, surgeLoyaltyIgnore: -20,  // defend against a rival surge, or cede ground
      },
    },
    // --- Forecast confidence (Epic C2 — the converging pre-launch forecast) ---
    // The wizard shows a demand RANGE; its width — and how far the real launch can land from the
    // point estimate — TIGHTENS as the player invests in knowing their market (marketer skill =
    // intuition; the Demand Sensing project = analytics). Confidence sets the displayed band AND
    // scales the realized launch variance, so a tighter forecast is an HONEST promise, not a lie.
    // baseBand mirrors demandVariance, so a no-knowledge forecast is the old ±12% behaviour.
    forecast: {
      baseBand: 0.12,                // ± band with zero market knowledge (matches demandVariance)
      minBand: 0.05,                 // tightest achievable band at max confidence
      skillConfidencePerPoint: 0.04, // confidence gained per effective marketer-skill point
      demandSensingConfidence: 0.3,  // confidence from the Demand Sensing research project
      maxConfidence: 0.85,           // hard cap — a forecast is never a certainty
    },
    // --- Aesthetics → demand (Epic G1: "form affects demand") ---
    // The parametric render's purely-cosmetic choices (notch, camera module/layout, flash) carried
    // ZERO weight before — Automation's self-inflicted "looks don't affect sales" bug, on the very
    // toy we centre the game on. These now feed a bounded STYLE APPEAL that lifts the Style segment's
    // fit ONLY (engine/aesthetics.ts → segments.ts), so a striking design wins design-led buyers
    // without touching the global economy. A fully-considered design exactly reaches maxStyleAppeal.
    aesthetics: {
      maxStyleAppeal: 10,            // cap on form-driven fit points (a striking design is a real lever)
      notch: { island: 3, punch: 2, none: 1, notch: 0 } as Record<string, number>, // modern screen treatment
      module: { squircle: 2, pill: 2, circle: 1 } as Record<string, number>,        // camera module shape
      coherentLayoutBonus: 2,        // a camera layout that suits the lens count reads intentional
      // More lenses read as ambition on the spec sheet (indexed by count-1: 1→0, 2→+1, 3→+2, 4→+2, a
      // diminishing return). Only counted when the layout SUITS the count (gated in aesthetics.ts), so a
      // cluttered strip of lenses earns nothing — form still has to be coherent.
      lensCountAppeal: [0, 1, 2, 2],
      flashBonus: 1,                 // a complete camera system
      // Form is a BROAD sales lever, not a Style-only niche: a striking design lifts every buyer segment
      // in proportion to how much it values design (its `design` weight ÷ styleDesignWeight × broadenShare),
      // with the design-led Style segment always getting the full lift.
      styleDesignWeight: 1.6,        // the Style segment's design weight — the reference for the scaling
      broadenShare: 0.55,            // share of the design lift the non-Style segments receive
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
    // Word-of-mouth curve shaping (item 1.1) — the SAME lifetime total is redistributed over weeks by
    // verdict, so a loved product *feels* loved (fast ramp, long tail, a mid-tail second wind) and a
    // panned one spikes then collapses. Does NOT change totalUnits (revenue-neutral in aggregate for a
    // given score) — only WHEN the units land. "steady" reproduces the legacy curve exactly, so
    // ordinary launches are unchanged. rampPow ↓ = quicker to peak; declinePow ↓ = longer tail.
    wordOfMouth: {
      hit: { rampPow: 1.35, declinePow: 0.9, tailLift: 0.32 },
      solid: { rampPow: 1.5, declinePow: 1.12, tailLift: 0.1 },
      steady: { rampPow: 1.6, declinePow: 1.25, tailLift: 0 }, // == legacy default
      flop: { rampPow: 1.95, declinePow: 1.75, tailLift: 0 },
    } as Record<"hit" | "solid" | "steady" | "flop", { rampPow: number; declinePow: number; tailLift: number }>,
  },

  // --- Mid-lifecycle marketing push (the margin-preserving sibling of a price cut) ---
  // Spend cash to lift a still-selling product's REMAINING weekly demand (capped at the
  // production run, so it only clears genuine surplus). Cost scales with the extra units it'll
  // move, so it's priced fairly: you pay a slice of the revenue you're unlocking, keep full price.
  marketingPush: {
    boost: 0.3,    // +30% to each remaining week's units (then capped at plannedUnits)
    costPct: 0.35, // cash cost = 35% of the extra revenue the push unlocks
    // A launched product is no longer a frozen annuity — you can keep promoting it through its life,
    // but with DIMINISHING RETURNS so it's a real decision, not a spam button: each push's boost is
    // pushFalloff× the previous one's (0.30 → 0.165 → 0.09…). Still capped at plannedUnits (only ever
    // clears real surplus inventory), so an over-pushed product with no surplus simply quotes nothing.
    maxPerProduct: 3,
    pushFalloff: 0.55,
  },
  // Brand awareness — a company-wide meter you invest cash into BETWEEN launches. It decays weekly, so
  // it's a standing commitment (not a one-off), and it contributes a bounded, permanent lift to launch
  // hype for as long as you keep it up. Gated behind spending: at 0 it's a no-op → the pinned sim
  // (which never invests) is byte-identical.
  brand: {
    cap: 100,               // meter runs 0..this
    hypeMax: 0.22,          // at a full meter, the extra launch-hype contribution (bounded by HYPE_BONUS_MAX)
    decayPerWeek: 0.94,     // awareness fades ~6%/week without reinvestment
    costPerPoint: dollars(2_400), // era-1 cost to raise the meter by 1 point (scaled by era below)
    costPerPointPerEra: 0.9,      // +90% cost per era past 1 (bigger company, pricier campaigns)
    maxStep: 25,            // one investment raises the meter by at most this many points
  },
  // --- Interrupt budget (UX pacing) — one global governor over the OPPORTUNISTIC full-screen cards
  // (rival strike, eureka, community ask, earnings call, rivalry reveal, regional event, staff moment).
  // Each has its own cadence/cooldown, but without a shared floor they can still cluster across
  // consecutive weeks and turn the game into a wall of modals. A single `lastInterruptWeek` stamp +
  // this minimum gap guarantees quiet weeks between any two opportunistic interrupts, so each one
  // lands as a moment instead of a nag. Scheduled ceremonies (the year-52 awards) are EXEMPT from the
  // gate — they must fire on their week — but still stamp, so nothing piles on right after them.
  interrupts: {
    minGapWeeks: 3,     // quiet weeks between opportunistic interrupts in the early eras (1–2)
    minGapWeeksLate: 2, // …tightened in eras 3–4 so the longer, weightier late builds have more to do
    lateEra: 3,         // the first era that uses the tighter gap
  },
  // Mid-lifecycle price cuts, now repeatable (a fading product can be marked down more than once).
  // Each cut must still be below the current price and above unit cost, so the price naturally floors
  // out after a few cuts — the diminishing return is built into the mechanic, no extra falloff needed.
  priceCut: {
    maxPerProduct: 3,
  },
  // Restock / reorder — the headline "living product" lever. A launched product used to be a frozen
  // 16-week annuity: if it sold out, you could do nothing. Now you can fund another production run to
  // meet demand you under-supplied. It is DEMAND-CAPPED (you can never order more than the current
  // market still wants — planProduction.totalDemand minus what's already scheduled to sell), so it
  // captures unmet demand rather than printing money, and each reorder shrinks the remaining headroom.
  // No new tooling (the line is already set up) — you pay pure per-unit production. Bounded per product.
  restock: {
    maxPerProduct: 3,
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
    // Living fan COMMUNITY — fans are a community with a mood, not a lone decaying number. Sentiment
    // (−1..+1) evolves from how you treat them (hits/solids delight, flops sour, neglect cools it) and
    // modulates retention (a beloved community churns slower). Superfans are the loyal core that
    // sentiment creates — they pre-order harder. All gated behind having SHIPPED: the pinned auto-player
    // never launches, so sentiment stays 0 → every effect is a no-op → byte-identical.
    community: {
      windowWeeks: 14,          // recent verdicts within this window shape the mood
      inertia: 0.85,            // sentiment moves (1-inertia) toward its target each week
      hitTarget: 0.28,          // a recent hit pulls the mood up by this (a solid = half)…
      flopTarget: 0.5,          // …a recent flop pulls it down by this (flops sting more)
      freshBonus: 0.18,         // a launch within freshWeeks keeps the community engaged (+)…
      freshWeeks: 8,
      staleWeeks: 30,           // …going this long with no launch sours the mood (−)
      stalePenalty: 0.22,
      retentionSwing: 0.45,     // at |sentiment|=1, weekly fan loss is scaled ±this vs neutral
      superfanShareAtMax: 0.16, // at sentiment=+1, this fraction of fans are superfans
      superfanPreorderMult: 1.8,// superfans pre-order this × harder than an ordinary fan
      // Community ASKS — periodic fan requests (an AMA, a public beta, a merch drop, a meetup) you can
      // ANSWER for cash to grow + delight the base, or PASS. Player-claimed via an opt-in reducer and
      // gated behind having launched, so the pinned solo sim never raises one → byte-identical.
      asks: {
        cadenceWeeks: 22,          // ~one derived-hash chance per this window
        cooldownWeeks: 14,         // minimum weeks between asks
        minWeeksSinceLaunch: 3,    // let a launch's dust settle before the fans ask for more
        costBase: dollars(60_000), // floor cost to answer…
        costPerFanCents: 700,      // …+ this per current fan (a bigger base → a bigger event)
        costMax: dollars(40_000_000),
        fanGainShare: 0.07,        // answering grows the base by this fraction (one-time)…
        fanGainMin: 250,           // …or at least this many
        sentimentGain: 0.16,       // …and lifts the mood (then decays via the normal EMA)
        passSentiment: -0.05,      // passing lets the fans down a little
      },
    },
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
    // Recalibrated to the MEASURED effectiveScore landscape (scripts/balance-sim.mjs): a maxed
    // competent product scores ~16–21 (E1), ~26–80 (E2), ~91–122 (E3), ~112–130 (E4). The old E3/E4
    // hit bars (112/145) sat at/above the achievable ceiling → every late launch collapsed onto
    // "solid" (83% of all launches, ~0 hits/flops). These bands sit INSIDE each era's real range so
    // a great launch can hit, a middling one only steadies, and outcomes spread instead of flatlining.
    // Era-3/4 bars RE-RAISED for the Living Late Game landscape: fewer, weightier late launches
    // (eraModifiers.toolingMult/leadWeeks) are each built by a more-developed company, so the
    // measured effectiveScore landscape shifted UP (~E3 p50 106→153, E4 p50 124→189). The old
    // 116/128 hit bars then sat far below achievable → ~70% of late launches collapsed onto "hit"
    // (the same single-verdict failure v52 fixed, mirror-imaged). These bars sit back INSIDE the new
    // per-era range (harness-measured) so a great late launch hits, a middling one steadies, and the
    // verdict layer stays a real contest. Eras 1–2 are untouched.
    hitThresholdByEra: [70, 80, 156, 192],
    solidThresholdByEra: [45, 56, 135, 175],
    // FLOP FLOOR raised from era 2 on so a phoned-in launch actually FLOPS instead of coasting to a
    // safe "steady". Era 1 stays low (10) to protect the maiden launch — a brand-new company's hype is
    // tiny, so an early product only scores ~13–17 and a higher floor would flunk the first ship. From
    // the Growth era on, a mediocre or heavily-contested device lands in the red, so success is earned.
    // Kept below solidThresholdByEra at every index (flop < solid) and non-decreasing across eras.
    flopThresholdByEra: [10, 34, 52, 68],
    // Dynamic "expectations" (Track D — the anti-"every device is a hit" system). The static bars
    // above anchor a young company (and the very first launch), but as you rack up strong launches a
    // ROLLING baseline of your recent competition-adjusted scores raises the bar: a HIT must beat your
    // own recent track record, not just clear a fixed line. So maxing every component + the right price
    // slides from a guaranteed "hit" to a merely "solid" release once you're the establishment — hits
    // now demand a genuine step up (fresh tech/category, on-trend timing, a bigger campaign, a product
    // that tops your last), which is the whole point of the design. Self-balancing across all eras.
    expectation: {
      alpha: 0.5,        // how fast the rolling baseline tracks each new launch (EMA weight)
      hitMargin: 1.14,   // a hit must beat the rolling baseline by this (top your recent best)
      solidMargin: 0.6,  // at/above this fraction of the baseline is a solid, competent release
      flopMargin: 0.55,  // below this (relative to what you'd been shipping) it disappoints → flop.
                         // Raised 0.4 → 0.55: re-shipping something meaningfully weaker than your recent
                         // average now flops, so a proven studio can't coast on mediocre follow-ups.
    },
    // Late-game reputation MAINTENANCE ("defend your empire"). In the final era, reputation above a
    // maintenance floor erodes a little each week, so a top brand must be SUSTAINED by continued
    // hits rather than banked once and coasted on. A hit is +8 rep, so an active shipper (a launch
    // every ~2 weeks) easily outpaces a 0.5/wk drip; a player who STOPS shipping slowly slips and
    // loses IPO-win eligibility (rep >= 85) until they perform again — turning the post-era-4 stretch
    // from a victory-lap into an ongoing contest. Gated to the FINAL era only, so no progression
    // gate and none of the early climb is ever touched. ⚠️ magnitudes want a device playtest.
    // Phase 2 (Living Late Game) gave this teeth. Still FINAL-ERA ONLY (era 4 repToAdvance = Infinity,
    // so decay can never softlock progression) — but the floor drops well below the rep-85 IPO-win
    // gate and the slope steepens, so a top brand that coasts (stops shipping, or strings together
    // middling launches) actually SLIPS below win-eligibility and must perform again to reclaim it.
    // Tuned against the post-Phase-1 launch cadence (~1 launch / 3–4 wk): a competent constant-shipper
    // earns ~0.9 rep/wk, so 0.9/wk decay means hits hold the line with visible dips between them while
    // a slower or sloppier run erodes toward the floor — reputation becomes defended, not banked.
    decayFromEra: 4,
    decayPerWeekLate: 0.9,
    decayFloor: 62,
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
    // Timed research — a started tier/project no longer completes on the click; the lab develops it
    // over WEEKS (a progress-ring timer, like a production run), and only ONE runs at a time, so
    // "what do we research next?" becomes a real focus decision instead of a spend-all-RP dump. The
    // RP is paid up front (economy + balance unchanged); the weeks scale with the project's RP cost
    // (a bigger breakthrough takes longer), clamped to a sane band. Player-only: the pinned solo sim
    // never starts research → activeResearch stays null → byte-identical.
    timer: {
      rpPerWeek: 24, // ~RP of cost developed per week → weeks = round(rpCost / this)
      minWeeks: 1,
      maxWeeks: 6,
      maxQueue: 4,   // researches you can line up behind the active one (each paid up front)
    },
    // Research excitement: a strong launch funds your next breakthrough — hits/solids award RP, so
    // the tree advances through PLAY, not just idle ticks. Tuned vs project costs (20–140 RP).
    launchRpHit: 16,
    launchRpSolid: 7,
    // EUREKA breakthroughs — an active, funded lab occasionally has a flash of insight (a staged
    // moment + a real bet: bank a guaranteed RP windfall, or CHASE a prototype for a jackpot-or-fizzle
    // gamble). Cadence is a derived hash (never the sim RNG); the payoff is player-CLAIMED, so a
    // do-nothing pinned run — no researchers, no resolve — never fires one and stays byte-identical.
    eureka: {
      minEra: 2,            // the garage era is a protected sandbox
      minRnDStaff: 1,       // needs an active lab (≥1 staffer assigned to R&D)
      cadenceWeeks: 20,     // avg weeks between insights (≈1/N chance per eligible week)
      cooldownWeeks: 12,    // hard minimum between breakthroughs (so it's a treat, not a nag)
      bankRpBase: 18,       // guaranteed RP if you bank the insight…
      bankRpPerEra: 9,      // …+ this per era (scales with the game)
      jackpotMult: 2.6,     // CHASE jackpot = bank × this
      fizzleMult: 0.25,     // CHASE fizzle  = bank × this
      jackpotChance: 0.5,   // odds the chase pays off
      jackpotRepBonus: 1,   // a little reputation when a prototype lands (word gets out)
      jackpotFanBonus: 300, // …and a few fans
    },
  },

  // --- Employees: XP & leveling ---
  staff: {
    baseSalary: { engineer: dollars(900), designer: dollars(850), marketer: dollars(800), hr: dollars(950), researcher: dollars(1_000) },
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
    // Staff GROWTH MOMENTS (engine/staffMoment.ts) — a tenured, senior staffer periodically earns a
    // permanent character upgrade the player CHOOSES: a second design specialty, a second (stacking)
    // trait, or becoming a team mentor. Surfaced as an opt-in interrupt that respects the global
    // interrupt budget. Gated on era + a real, established team; the founder is never a target and the
    // pinned solo sim (founder only) never raises one → optional fields stay unset → byte-identical.
    growth: {
      minEra: 2,             // the garage era is a protected sandbox
      minSkill: 6,           // a senior contributor, not a fresh hire
      minTenureWeeks: 18,    // has been with the company a while
      cadenceWeeks: 34,      // avg weeks between growth moments (≈1/N chance per eligible week)
      cooldownWeeks: 20,     // hard minimum between moments (a treat, not a nag)
      mentorXpBonus: 0.12,   // each mentor adds this to EVERY other staffer's weekly XP…
      mentorXpCap: 0.3,      // …capped, so a room full of mentors can't runaway-train the team
      secondSpecialtyWeight: 0.8, // the second specialty's design bonus vs the primary's (1.0)
    },
    // Staff LIFE events (item 2.2) — periodic human turning points (burnout, an outside offer, a
    // milestone) the player answers with a small choice. Cadence/cooldown keep them a texture, not a
    // nag; a struggling teammate is surfaced first so morale becomes an ongoing, personal decision.
    lifeEvents: {
      minEra: 2,             // the garage era stays a protected sandbox
      minTenureWeeks: 10,    // been around long enough to have a "story"
      cadenceWeeks: 26,      // avg weeks between life events
      cooldownWeeks: 14,     // hard minimum between them
      restlessTenureWeeks: 40, // a "wants a bigger challenge" beat needs real tenure…
      restlessSkill: 6,      // …and seniority
      retainWeeks: 24,       // loyalty earned: weeks of poach-immunity a good answer buys
      raiseCost: dollars(6000),   // a retention raise
      courseCost: dollars(9000),  // funding a course (levels them up)
      partyCost: dollars(4000),   // a team party
      protoCost: dollars(5000),   // funding a side prototype
    },
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

  // --- Delegation & ops (Epic E) ---
  // Late-game scale shouldn't mean more taps for the same decisions (the micromanagement death of
  // Startup Company / Computer Tycoon; touch density is fatal on a phone). Automation only does what
  // the player already can, and is EARNED: each toggle is gated on a premium research division
  // (engine/research.ts: peopleOps / researchDivision) plus a recruited specialist whose salary is
  // the standing weekly cost (see DELEGATION_REQ + canAutoAssign/canAutoResearch in state/gameState).

  // --- Build / manufacturing ---
  // --- Market fatigue / novelty ---
  // The market won't reward shipping the SAME product again with only cosmetic changes shortly after
  // the last one — real buyers want a genuine step up, not a rerun. A new release is compared to your
  // recent same-category launches; if it's too SIMILAR (component tiers barely changed) and too RECENT,
  // organic market demand is cut. Meaningful spec upgrades OR enough elapsed time clear it. Fans still
  // pre-order (this only dampens *organic* demand) — your loyal base buys the sequel, the broad market
  // shrugs at a rehash. Mirrors the anti-spam intent of competition.selfPenalty, on the time axis.
  novelty: {
    fatigueWeeks: 30,     // how long a recent launch keeps fatiguing similar follow-ups (linear fade to 0)
    maxPenalty: 0.55,     // organic-demand cut for an IDENTICAL launch the same week (→ keep 45%)
    similarityFloor: 0.78, // below this spec-similarity a product reads as "new enough" → no penalty
    tierSpan: 4,          // per-component tier distance that counts as "completely different" for that slot
  },

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
    // Lowered 5,000 → 2,500 back in the $20k-start era, when a $5k reserve choked early runs so
    // hard that every early cycle ran at a loss. At the current $100k start the reserve barely
    // binds early — it stays as the late-game guard so a cash-poor company can't brick itself
    // manufacturing through a downturn.
    safetyReserveMargin: dollars(2_500) as Money,
    // Factory Mode BOOST — rush the active run: each press finishes ONE week sooner for a
    // premium of this fraction of the run's total production cost (unitCost × plannedUnits).
    // A real overtime-style lever, not a purchased multiplier. ⚠ Needs a playtest.
    rushCostPct: 0.08,
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

  // --- Era-distinct mechanics (Epic D) ---
  // Eras shouldn't merely scale numbers — each should change the TEXTURE of play. These modifiers
  // route through EXISTING selectors (no new systems) and are 1.0 through the Garage + Growth eras,
  // so the tuned early game is byte-identical; the late eras gain a distinct rule shift:
  //   • Platform era — ecosystem LOCK-IN dominates: services revenue + marketing reach amplified.
  //   • AI era — a hype-driven, VOLATILE market: marketing pops harder and realized demand swings more
  //     (over/under-production is a bigger bet), on top of the strongest ecosystem economy.
  // A new player learns the baseline; a veteran must re-strategize per era. Index = era − 1.
  // ⚠️ MAGNITUDES NEED A PLAYTEST — they reshape the late-game economy (the levers, not the wiring).
  // toolingMult / leadWeeks (Living Late Game): late eras make a product a BIGGER, SLOWER bet — more
  // upfront tooling and more weeks on the line — so the endgame is fewer, weightier launches instead
  // of a ~2-week relaunch conveyor (the measured cause of the "solved" macro outcome: ~75% of all
  // launches land in Era 4 and average each other's variance away). Eras 1–2 are neutral (1.0 / 0) so
  // the early game is byte-identical. ⚠️ magnitudes are harness-tuned (scripts/balance-sim.mjs), not
  // hand-guessed — see the per-era launch-count + net-worth-CV readout.
  eraModifiers: [
    { marketingHype: 1.0, ecosystemRate: 1.0, demandVariance: 1.0, toolingMult: 1.0, leadWeeks: 0 },  // 1 Garage — baseline
    { marketingHype: 1.0, ecosystemRate: 1.0, demandVariance: 1.0, toolingMult: 1.0, leadWeeks: 0 },  // 2 Growth — baseline
    { marketingHype: 1.2, ecosystemRate: 1.5, demandVariance: 1.0, toolingMult: 1.7, leadWeeks: 2 },  // 3 Platform — ecosystem lock-in; bigger bets
    { marketingHype: 1.35, ecosystemRate: 1.7, demandVariance: 1.4, toolingMult: 2.6, leadWeeks: 3 }, // 4 AI — hype-driven + volatile; flagship-scale bets
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
    // Strength persistence, era-scaled (Living Late Game P3 — durable competition). A rival's presence
    // in a category fades each week by this factor; HIGHER = it holds longer. Eras 1–2 keep the tuned
    // 0.88 (byte-identical early game); the late eras decay slower so a rival that lands strongly in
    // your category ENTRENCHES instead of evaporating in a week — sustained, not blip, pressure. The
    // category a rival contests is seeded-random, so runs where rivals crowd your flagship category
    // diverge from runs where they spread out — the between-run variance a perfect player can't smooth.
    strengthDecayByEra: [0.88, 0.88, 0.90, 0.93] as const,
    baseStrength: 28,
    // Specialization: a launch in a rival's PREFERRED category is this much likelier to be chosen,
    // and lands with this flat strength bonus (its home turf is genuinely tougher to contest).
    preferredCategoryWeight: 3, // weighting vs. 1 for a non-preferred category when picking
    preferredStrengthBonus: 10, // extra strength when shipping in a preferred category
    // Reactivity: the lead rival defends a category the player is winning. Bounded so it presses
    // but never snowballs into an unbeatable wall.
    reactHitWindowWeeks: 10, // a player hit counts as "recent" for this many weeks
    reactStrengthBonus: 14, // extra strength the reacting rival brings to the player's hot category
    // Winnability ceiling on any single rival launch strength, era-scaled (Living Late Game P3). The
    // OLD flat 95 was the reason late competition was cosmetic: a maxed late-game player's `overall`
    // outgrew 95 + beatMargin, so NO rival could ever match/beat them → competitionFactor pinned at 1
    // (measured: the count model registered ~0 contestants in Era 4). Eras 1–2 keep 95 (winnable early
    // game preserved); the late ceilings rise so a strong rival can genuinely contest — even beat — a
    // top player in a category, making demand a contested resource again. Still a hard cap, so it
    // presses without snowballing into an unbeatable wall (the era-pressure term governs the bite).
    reactMaxStrengthByEra: [95, 95, 105, 118] as const,
    // Era-scaled strength bump (Living Late Game P3). The launch-strength FORMULA naturally tops out
    // ~92 (base + rep×0.4 + bonuses), BELOW the old flat-95 cap — which is why raising the cap alone
    // was inert and late competition stayed cosmetic. This additive bump lifts late-era rivals into
    // genuine contesting range (and lets a few BEAT a maxed player), so demand becomes a contested
    // resource in Eras 3–4. Eras 1–2 add 0 (early game byte-identical). Bounded by reactMaxStrengthByEra.
    lateStrengthByEra: [0, 0, 8, 18] as const,
    reactCadenceCut: 3, // weeks shaved off the reacting rival's next launch (faster counter-punch)
    // B2 — rival DOCTRINES (per-rival behavioural posture; see competitors.ts RivalDoctrine). Tuned
    // to add VARIETY + presence, NOT raw difficulty: only the `defender` raises launch strength (the
    // old lead-rival counter-punch, numbers unchanged), so the contested-launch ceiling + winnability
    // are exactly preserved. The other doctrines change WHERE a rival shows up and HOW it prices —
    // visible personality, governed by the existing match-count + era-pressure, never new strength.
    doctrineTargetWeight: 3, // extra category-selection weight a trend-chaser piles onto the player's hot cats
    undercutCadenceCut: 2,   // weeks shaved off an undercutter's next launch when it contests a hot category
    undercutPriceMult: 0.78, // visible price multiplier on an undercutter's contesting product (it ships cheap)
    // Rival STORY ARCS (Track B): each rival drifts through a lifecycle instead of sitting at a fixed
    // stature. The phase nudges its reputation a little each week WITHIN a bounded envelope around the
    // rival's calibrated base (repBand) — and reputation already drives stock fair value, launch
    // strength, and market cap (→ acquisition cost). So a rising rival's stock climbs and it contests
    // harder + costs more to buy; a faltering one slides and goes cheap. The band makes the drift
    // mean-reverting by construction, so the stock market stays ~zero-EV long-run (pinned by tests).
    arc: {
      driftPerWeek: { ascending: 0.55, peaking: 0.18, declining: -0.62, stable: 0 } as Record<string, number>,
      repBand: 16,        // max reputation deviation (±) from the rival's calibrated base
      repFloor: 8,        // hard floor/ceiling so a drift can never reach the 0/100 extremes
      repCeil: 96,
      phaseWeeksMin: 16,  // a phase lasts this..max weeks before it re-rolls (long → the feed isn't spammy)
      phaseWeeksMax: 34,
      // Transition weights from each phase → the next. The dominant ascending→peaking→declining cycle
      // balances up-drift against down-drift, keeping the long-run reputation mean ≈ base.
      transitions: {
        stable:    { ascending: 0.42, declining: 0.32, stable: 0.26 },
        ascending: { peaking: 0.62, stable: 0.38 },
        peaking:   { declining: 0.55, stable: 0.45 },
        declining: { stable: 0.6, ascending: 0.4 },
      } as Record<string, Record<string, number>>,
    },
    // Rival-vs-rival dynamics (item 2.4) — the field lives WITHOUT the player: occasional clashes
    // between two rivals (a price war that bruises both, or a power play where a stronger one poaches
    // a weaker one's team) shift the leaderboard on their own. Small, bounded reputation nudges +
    // a feed beat, driven by a DERIVED hash (salt 239) — never the sim RNG — and only when a `seed`
    // is supplied, so callers that omit it (and the pinned solo sim's direct competitor tests) are
    // byte-identical.
    rivalClash: {
      chancePerWeek: 0.06, // ~one clash every ~16 weeks
      priceWarRepDip: 2,   // both rivals lose this much reputation in a price war
      powerPlayWinRep: 2,  // the aggressor gains…
      powerPlayLoseRep: 3, // …at the target's expense
      minField: 3,         // never clash below this many rivals
    },
    // The ARCH-RIVAL / NEMESIS — one rival becomes YOUR villain. A living "heat" meter + a head-to-head
    // record that escalates on every clash (you overtake them, they strike you, an awards duel) and cools
    // in quiet weeks; a hot nemesis fights back with a launch edge on your turf. All gated behind the
    // nemesis FORMING, which needs a player clash — the pinned auto-player never clashes, so it's byte-
    // identical. Deliberately restrained: the launch edge stays under the existing winnability ceiling.
    nemesis: {
      formHeat: 30,             // heat a freshly-declared rivalry starts at
      decayPerWeek: 2,          // heat ebbs this much on a quiet week (no clash with the nemesis)
      heat: {                   // heat added per clash kind
        overtake: 12, dethroned: 24, struck: 16, awardWin: 12, awardLoss: 16,
      } as Record<string, number>,
      turfCategoryWeight: 3,    // extra launch-category weight the nemesis piles onto your top category
      turfStrengthBonusAtMaxHeat: 8, // extra launch strength at heat 100 (scaled by heat/100; pre-cap)
    },
  },

  // --- Product franchises / brand equity (the "IP & fanbase" lever) ---
  // A product LINE (sequels sharing a name, e.g. the "Aurora" series) builds brand equity from its
  // track record: a run of hits makes the next launch land with loyal pre-orders + anticipation; a
  // flop tarnishes it; lapsing lets it fade. Bounded so a strong line is an edge, never an auto-win.
  // First-in-line products have no history → zero equity → zero bonus (purely additive). ⚠️ magnitudes
  // want a playtest — they're a launch-economy lever, isolated here.
  franchise: {
    // Equity each prior launch in the line contributes, by its verdict (a flop actively tarnishes).
    verdictEquity: { hit: 0.34, solid: 0.18, steady: 0.06, flop: -0.22 } as Record<string, number>,
    recencyDecay: 0.82,    // older launches in the line count less (× per position back from newest)
    maxEntries: 5,         // only the most recent N launches in the line shape equity
    preorderBonusMax: 0.4, // a beloved line lifts pre-orders by up to this fraction
    hypeBonusMax: 0.15,    // …and adds up to this much launch hype (anticipation for the next entry)
  },

  // --- Mergers & acquisitions (Epic B3) ---
  // The late-game power move: buy out a rival you've been beating. You pay a control PREMIUM over its
  // market cap (minus any shares you already hold), remove it from competition, and absorb its brand
  // (reputation) + customer base (fans). Gated so it's an established-company play, with a field floor
  // so the market never empties — and the field REFILLS as fresh challengers rise (entryChancePerWeek),
  // keeping the industry alive instead of letting the player mute it permanently.
  mergers: {
    acquisitionPremium: 1.35, // pay this multiple of the rival's market cap to take control
    minActiveRivals: 2,       // acquisitions can never drop the field below this many rivals
    repBonus: 6,              // one-time reputation lift from absorbing a known brand
    fansPerRepPoint: 220,     // fans absorbed per point of the acquired rival's reputation
    fansCap: 80_000,          // hard cap on absorbed fans (no free faucet)
    entryChancePerWeek: 0.06, // weekly chance a new challenger refills a thinned field (~16wk mean)
    // Acquiring a rival used to only DELETE it for a rep + fans bump — you inherited none of its
    // productive assets, so M&A was near-cosmetic. You now also absorb:
    //  • their R&D pipeline / patents → a one-time RP windfall (scaled by the rival's reputation);
    //  • their installed base → a permanent services annuity (their customers now pay YOU each week).
    // Both scale with the rival's reputation and are bounded by how many rivals you can acquire
    // (minActiveRivals floor + the escalating market-cap cost), so it's a real late-game power move,
    // not a faucet. Opt-in (the pinned sim never acquires), so the tuned baseline is untouched.
    rpPerRepPoint: 2,          // one-time RP absorbed per point of the acquired rival's reputation
    installedBasePerRep: 800,  // "installed base" (customers) absorbed per rival reputation point
    absorbedServiceRate: 1.0,  // cents/week each absorbed customer pays in services (recurring annuity)
    // Controlling-stake TAKEOVERS — a slower, cheaper alternative to a straight cash buyout. Accumulate
    // a rival's shares on the open market and two things unlock, turning the stock game into a takeover
    // runway rather than a side annuity:
    //  • boardSeatFrac of the float → a BOARD SEAT: insider intel on that rival (its hidden arc phase /
    //    momentum), so you can trade it — and time a takeover — with information nobody else has;
    //  • controlFrac of the float → a CONTROLLING STAKE: you already hold effective control, so a buyout
    //    pays only hostilePremium instead of the full acquisitionPremium (the ~35% control premium
    //    collapses to ~8%). Since shares are bought near fair value, the accumulate-then-pounce path
    //    costs ~20% less than a cold buyout — the reward for patience, capital lockup, and price risk.
    // All three are player-driven (buy shares / acquire); the pinned sim never trades, so it's untouched.
    takeover: {
      boardSeatFrac: 0.10,  // own this fraction of a rival's shares → board-seat intel
      controlFrac: 0.5,     // own this → a controlling stake (hostile buyout at the reduced premium)
      hostilePremium: 1.08, // control premium on a controlled (hostile) takeover, vs acquisitionPremium
    },
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
    // --- Post-IPO shareholder loop ---
    // Once listed, the street sets a quarterly revenue expectation and reacts to whether you beat or
    // miss it (moving the valuation-momentum overlay = the share price). You can buy back shares to
    // steady the price + reconsolidate ownership — a real late-game cash sink. All gated on `listed`,
    // so the pinned solo sim (never IPOs) is byte-identical.
    shareholders: {
      quarterWeeks: 13,          // an earnings call every fiscal quarter
      expectedGrowth: 0.06,      // the street wants +6% revenue quarter-over-quarter
      minExpectation: dollars(50_000) as Money, // a floor so a tiny quarter still has a bar to clear
      priceSensitivity: 0.5,     // share-price move = surprise% × this…
      maxPriceMove: 0.06,        // …clamped to ±6% momentum per quarter (the overlay caps at ±15%)
      defendBuybackPct: 0.03,    // a defensive buyback on a miss spends up to this fraction of valuation
      buybackBumpPerPct: 0.004,  // buying back 1% of the company nudges momentum up by this
      maxOwnership: 0.98,        // buybacks can't fully re-privatize the company
    },
  },

  // --- Performance-reactive company value (Track B) ---
  // A bounded, mean-reverting MOMENTUM overlay on the company's fundamental valuation, so net worth
  // and the leaderboard visibly REACT to what you ship: a hit pops the value, a flop dents it, and
  // sitting at #1 holds a small standing premium. The overlay decays back toward the fundamental, so
  // a transient pop can never compound. Cash (bankruptcy) and reputation (the win gate) are NOT
  // affected — this only colours the displayed value. Eras/old saves: momentum defaults to 0.
  valuationMomentum: {
    cap: 0.15,                // max +/- swing on the fundamental value (±15%)
    decayPerWeek: 0.82,       // mean-reversion toward 0 each week (half-life ~3.5 wk)
    popOnHit: 0.10,           // a hit launch pops the value
    popOnSolid: 0.04,
    dipOnFlop: 0.08,          // a flop dents it (applied negative)
    rankOnePremiumFloor: 0.03, // while #1 in the industry, momentum holds at least this (a premium)
    historyLength: 26,        // weeks of valuation history kept for the sparkline
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
    // Founding the division is a MAJOR late-game reinvestment you save up for over many quarters — an
    // empire milestone, not a quick mid-game unlock. 90× the starting bankroll: shipping enough product
    // to bank this is the whole point, and once founded the OS is a grind you WORK (land contracts), not
    // a passive faucet. Creative/Sandbox mode keeps cash topped up, so free experimentation is unaffected.
    foundingCost: dollars(9_000_000),
    // …AND an earned reputation: a respected, proven hardware company launches a platform, not a nobody.
    // (Gates canFoundPlatform alongside the cash cost — see gameState. Kept < the era-3/win reputation so
    // it's reachable mid-game, but a real "you've made a name" bar, not free the moment you can afford it.)
    foundingMinReputation: 20, // 0..100 — an established brand
    foundingMinShipped: 4,     // a proven hardware track record before you build the platform under it
    releaseRepBonus: 3,          // one-time reputation lift per OS version release (leaner)
    releaseFanBaseBonus: 1_000,  // base fans gained on release
    releaseFanPerKInstalled: 2,  // + fans per 1,000 devices in the installed base
    releaseFanCap: 25_000,       // hard cap (no free faucet)
    // Phase C — licensing your OS: a MODEST recurring royalty. The real money is landing the inbound
    // CONTRACTS (signing bonuses), not passively banking fees — the passive faucet is deliberately
    // small so the OS division is a grind you work, not free income ("make it harder to gain").
    licenseFeeBase: 500,         // $/wk base a licensee pays
    licenseFeePerRepTier: 15,    // + $/wk per (rival reputation point × your OS tier)
    licenseFeeCap: 60_000,       // $/wk hard cap per licensee
    licenseStrengthUplift: 8,    // strength points a licensee rival gains in shared categories (the teeth)
    // Inbound licensing contracts — companies approach YOU to ship your OS on their devices. The
    // signing bonus (upfront) is the real payoff, scaling with the suitor's reputation × your OS
    // tier; an EXCLUSIVE deal pays a premium bonus and a richer weekly royalty.
    contract: {
      offerCooldownWeeks: 18,    // avg weeks between inbound offers — deliberately RARE (a landmark event, not a treadmill); ~1/N chance per eligible week (probabilistic cadence, not a hard minimum)
      minOsTier: 2,              // suitors only come once your OS is credible (tier ≥ 2)
      lifeWeeks: 3,              // how long an offer stays on the table
      signBonusBase: 30_000,     // upfront $ base
      signBonusPerRepTier: 900,  // + upfront $ per (suitor reputation × OS tier)
      signBonusCap: 900_000,     // upfront $ hard cap
      exclusiveBonusMult: 1.9,   // exclusive deals pay this × the signing bonus…
      exclusiveRoyaltyMult: 1.4, // …and a slightly richer weekly royalty
      // Negotiation — the player can PUSH an offer for a bigger signing bonus once. A deterministic
      // gamble (derived hash, salt 163): the suitor either sweetens the bonus, holds firm (original
      // terms stay), or WALKS (offer lost). A suitor's temper (from reputation + exclusivity) sets the
      // odds — eager brands fold, proud/exclusive ones play hardball. Honest: the shown temper reflects
      // these bands. `bonusMult` lifts the signing bonus on a win (still capped by signBonusCap).
      negotiate: {
        bonusMult: 1.35,                          // a won negotiation lifts the signing bonus ×this
        eager:    { walk: 0.10, improve: 0.68 },  // keen suitors: rarely walk, usually sweeten
        measured: { walk: 0.24, improve: 0.46 },  // fair-minded suitors: a real coin-flip
        hardball: { walk: 0.40, improve: 0.26 },  // proud/exclusive suitors: push at your peril
      },
    },
    // OS feature modules (engine/platform.ts OS_FEATURES) — capability customization. Each module is
    // researched (RP) and gated behind an OS version; together they make the OS a real lever:
    // a strong OS lifts the ecosystem stat of every device you launch AND multiplies recurring
    // services income. These are the global rails; per-module effects live in the OS_FEATURES catalog
    // (content, alongside the segments table). All gated behind platformUnlocked → 0 in the base game.
    features: {
      // 8 modules sum to +25 ecosystem; cap sits just above so a FULL build pays in full (the
      // completion reward) while still bounding any future additions. A partial build never nears it.
      ecoBonusCap: 26,          // max ecosystem-stat points the OS adds to a launched device (safety rail)
      servicesMultCap: 1.75,    // hard cap on the recurring-services multiplier (leaner — no runaway)
      versionServicesStep: 0.025,// + services multiplier per OS version released above v1
    },
    // Licensee relationships: a rival licensing your OS grows resentful if you dominate them too
    // hard — they're paying YOU while you crush them in shared markets. Satisfaction (0..100) decays
    // with your reputation lead and, once low, they may unilaterally drop the license (churn). The
    // trade-off: stay licensed-rich by not steamrolling, or dominate and lose the fees.
    licenseeChurn: {
      startHealth: 100,        // a fresh licensee starts content
      recoverPerWeek: 5,       // satisfaction drifts back up when you're NOT dominating them
      dominanceFreeGap: 12,    // reputation lead a licensee tolerates before resentment sets in
      decayPerGapPoint: 0.7,   // satisfaction lost/wk per reputation point beyond the tolerated gap
      churnThreshold: 28,      // at/below this satisfaction, the licensee may walk
      churnChancePerWeek: 0.14,// per-week probability they drop the license once unhappy
    },
    // App Store — a LIVING marketplace on your OS. It stays dormant (a trickle of apps) until you
    // research the App Marketplace module (OS_FEATURES.appMarket); after that developers flock in as
    // your installed base and OS version grow, and you take a weekly commission on the catalogue. A
    // flavourful, BOUNDED revenue line (the real money is still services + licensing). All gated
    // behind platformUnlocked → 0 in the base game (determinism preserved).
    appStore: {
      dormantAppsPerWeek: 1,        // a bare store before the Marketplace module — barely alive
      baseAppsPerWeek: 4,           // indie devs shipping once the Marketplace opens
      appsPerMillionInstalled: 55,  // + apps/wk per million devices in the field (devs follow users)
      appsPerVersion: 14,           // + apps/wk per OS version released above v1 (a better SDK)
      storeCutPerAppWeek: 1.2,      // $/wk store commission per published app
      storeCutCapDollars: 60_000,   // hard cap on weekly store-cut (no runaway faucet)
    },
    // Security — a tug-of-war the player actively works. THREAT creeps up every live week (a bigger
    // platform is a bigger target); SECURITY (hardening) is what you build by shipping patches. When
    // net exposure (threat − security) runs high, reputation bleeds — so you keep the OS patched.
    // Shipping a patch is the "update button": an immediate, satisfying threat-clear + hardening jump.
    // A full OS version release is an even bigger security event. All gated behind platformUnlocked.
    security: {
      threatRiseBase: 1.5,          // threat added each live week (the world probes your OS)
      threatRisePerMillion: 0.6,    // + per million devices in the field (bigger target)
      threatRiseCap: 6,             // max threat added in a single week
      privacySuiteMitigation: 0.5,  // the Privacy Suite module halves incoming threat
      securityDecayPerWeek: 0.6,    // hardening erodes as new exploits appear
      patchCooldownWeeks: 5,        // weeks between shippable security patches (the update button)
      patchThreatClear: 0.7,        // a patch clears this fraction of current threat
      patchSecurityGain: 12,        // + hardening rating per patch
      patchRepBonus: 1,             // small goodwill for staying responsive
      patchFanBonus: 400,           // a few fans notice the diligence
      releaseThreatClear: 1.0,      // a full OS version release wipes threat…
      releaseSecurityGain: 20,      // …and hardens more than a single patch
      exposureRepThreshold: 55,     // net exposure above this drags reputation
      exposureRepDragPerWeek: 0.3,  // reputation lost per live week while over-exposed
    },
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

  // --- People Operations (the People Lead / hr role) ---
  // A People Lead actively keeps the team happy: lifts everyone's mood TARGET (steady-state
  // happiness), nudges mood up a little every week, cushions the underpaid penalty, and (the headline)
  // while one is on staff, sustained burnout never forces a quit. The STRONGEST People Lead drives it;
  // extra leads don't stack (bounded). Gated on employing one, so no People Lead = byte-identical
  // mood/churn. This is what justifies the People Lead's seat + salary beyond unlocking Auto-assign.
  hr: {
    moodTargetBase: 8,      // flat lift to every teammate's mood target while a People Lead is employed
    perSkillTarget: 1.4,    // + target lift per skill point of the strongest People Lead
    maxTargetLift: 24,      // cap on the combined target lift (a fully-leveled lead, no runaway)
    weeklyMoodLift: 2.5,    // steady weekly mood nudge for the whole team (people ops in action)
    underpaidRelief: 0.6,   // fraction of the underpaid mood penalty a People Lead absorbs
    // A People Lead no longer makes sustained burnout CONSEQUENCE-FREE (which, with the 0.82 output
    // floor, removed all downside to running the team at mood 0). They now SCALE DOWN the weekly
    // quit chance — skill-scaled retention — but never to zero, so morale keeps its teeth. In
    // practice their mood lifts keep the team out of the danger zone anyway; this only bites when the
    // player actively neglects the team. No lead → the full base chance (byte-identical, incl. sim).
    quitChanceReliefPerSkill: 0.07, // each People-Lead skill point cuts the quit chance by this fraction
    minQuitChanceMult: 0.25,        // …floored here — even a maxed lead can't fully immunize burnout
  },

  // --- Rival poaching (Track C) — a rival on the rise tries to HIRE AWAY one of your best, surfaced
  // as a counter-offer DECISION (not a silent stat drop). Distinct from burnout churn above: this
  // targets CONTENT, skilled people, so it's a real "fight to keep them" moment, not a consequence of
  // neglect. Rare by design; the roll uses a DERIVED rng so it never perturbs the tuned economy sim.
  poaching: {
    chancePerWeek: 0.014,     // per ONLINE week, a rising rival makes a run at someone (~1 attempt / 70wk)
    minSkill: 6,              // only your genuinely strong people (1..10 headline level) get poached
    minMood: 45,              // a content employee — burnout exits are the churn path, not this one
    minTeam: 3,               // never poach from a skeleton crew (keeps the early game stable)
    retainWeeksSalary: 8,     // counter-offer signing bonus = this many weeks of their MARKET salary
    retainMoodBoost: 14,      // being fought for is a real morale lift
    declineTeamMoodHit: 4,    // the rest of the team dips a little when a colleague leaves for a rival
    cooldownWeeks: 26,        // a retained employee can't be targeted again for this long
  },

  // --- Debt financing (Track C) — borrow cash now, owe weekly service. Reputation earns cheaper
  // credit (a new place rep matters); leverage makes the next loan pricier. Tuned so a loan is a
  // genuine BET: it can buy the runway to land a launch, or sink you faster if the bet misses.
  // Amounts in CENTS to match the engine/financing.ts pure layer.
  financing: {
    baseRatePerWeek: 0.0035,      // ~20%/yr base before adjustments
    minRatePerWeek: 0.0012,       // floor — credit is never free money
    rateRepDiscount: 0.00003,     // weekly-rate cut per reputation point above 50 (good rep = cheap credit)
    rateLeveragePremium: 0.0025,  // added to the rate at the credit ceiling (linear with leverage)
    termWeeks: 52,                // 1-year amortization
    minLoan: 25_000 * 100,        // smallest drawdown ($25K)
    creditFloor: 75_000 * 100,    // a garage can borrow at least this (before subtracting existing debt)
    creditRevenueWeeks: 16,       // + this many weeks of recent revenue as borrowing headroom
    creditNetWorthFrac: 0.18,     // + this fraction of NET WORTH — financing scales with how big/valuable
                                  //   the company is (a $100M business can raise ~$18M, not a flat pittance)
    creditProfitWeeks: 26,        // + this many weeks of weekly PROFIT — cash flow that services the debt
    maxCredit: 8_000_000 * 100,   // FLAT floor of the hard ceiling ($8M) for a small company…
    maxCreditNetWorthFrac: 0.45,  // …but the ceiling grows to this fraction of net worth for a big one
    originationFee: 0.01,         // 1% taken off the top on drawdown (you receive principal × 0.99)
  },

  // --- Team morale spend (Track C) — a PROACTIVE, company-wide lever to invest in the whole team's
  // mood (vs. the reactive per-person Rest / raise, and vs. just pocketing the cash). Two tiers: a
  // quick bonus or a bigger offsite. Cost scales with payroll (a bigger team costs more to delight)
  // and a shared cooldown makes it a periodic decision, not a spammable mood button.
  morale: {
    bonusMoodLift: 12,     // a cash bonus pool lifts every teammate's mood by this
    bonusCostWeeks: 1.5,   // …and costs this many weeks of total payroll
    offsiteMoodLift: 24,   // a company offsite lifts more
    offsiteCostWeeks: 3.5, // …for a steeper cost
    minCost: 4_000,        // floor so an unpaid-founder garage still pays something real
    cooldownWeeks: 12,     // weeks before another company-wide morale spend is available
  },

  // --- Org structure / mentorship (Track C) — a discipline LEAD (the strongest person working a
  // discipline) speeds up the juniors working alongside them: a big skill gap means a strong mentor,
  // so building a team around a senior anchor pays off and high-skill veterans gain a second purpose
  // beyond raw output. Bounded so it accelerates growth, never trivializes it.
  org: {
    minMentorGap: 15,        // the lead must be at least this many discipline points stronger to mentor
    mentorPerGapPoint: 0.012, // bonus XP rate per point of gap beyond the threshold
    mentorMaxBonus: 0.5,     // cap — a junior under a far-stronger lead learns up to 50% faster
  },

  // --- Market events ---
  events: {
    firstWeek: 8,
    everyWeeks: 11,
    jitter: 6,
    // RNG cost events (supply crunches) must sting, never kill: each hit is capped to this
    // share of cash on hand, so a random feed item can't bankrupt a by-the-book player mid-build.
    crunchMaxCashShare: 0.35,
    // Cascading events (Track B): chance, in an event window with no chain already running, that a
    // multi-beat CHAIN starts instead of a single one-shot event. Each chain plays out over a few
    // weeks and ends in a player choice. Bounded by the same crunch cap, so it can't bankrupt.
    chainChance: 0.16,
  },

  // --- Supply chain (engine/suppliers.ts) ---
  supply: {
    // Dual-sourcing: a backup supplier costs a unit-cost premium for a fraction of the crunch risk.
    dualSource: { costPremium: 0.06, riskMult: 0.5 },
    // Contracts: lock a discounted, crunch-proof price with a supplier for a term. The upfront sign
    // fee scales with the term length and the tech era; reputation adds up to repDiscountMax off.
    contract: {
      signFeeBase: dollars(9_000) as Money, // fee for a 13-week deal at era 1, scaled from there
      repDiscountMax: 0.04, // extra discount at reputation 100 (your negotiating leverage)
    },
  },

  // --- Factory manufacturing (engine/factories.ts) ---
  // Over-capacity units cost the per-unit price PLUS this surcharge — the price of pushing a budget
  // line past its weekly throughput on a big run.
  factory: {
    overtimeSurcharge: 0.6, // +60% on each over-capacity unit ("overtime" strategy)
    defectMaxPenalty: 18, // max quality-stat hit when running fully over capacity ("defects" strategy)
  },

  // --- Late-era operating drag (item C3): the endgame is no longer a free ratchet ---
  // Running a frontier-scale company costs more the bigger you get. A small weekly cash cost that
  // scales with lifetime revenue (a proxy for scale/complexity), starting in the AI era, so the late
  // game has a real headwind that eats into growth and rewards keeping a cash cushion — without being
  // able to bankrupt a solvent company (capped, and 0 before the drag era so the early game and the
  // pinned sim's first three eras are byte-identical).
  lateEra: {
    dragEra: 4,                       // the drag begins in the AI era
    dragFracPerWeek: 0.0012,          // weekly cost = this × lifetime revenue
    dragCap: dollars(10_000_000),     // never more than this per week
  },

  // --- Legacy Era (item 4.1): the post-IPO endgame — board mandates + moonshot megaprojects ---
  // Everything here is gated behind wentPublic, which the pinned solo sim never reaches → byte-identical.
  legacyEra: {
    mandate: {
      windowWeeks: 13,            // a fiscal quarter to hit the board's directive
      escalationPerQuarter: 0.35, // the bar (and reward) rises each quarter…
      escalationCapQuarters: 12,  // …but plateaus here (~3 years post-IPO) for the BASE floor target
      maxHits: 4,                 // the "land N hits this quarter" bar never exceeds this
      baseRevenue: 40_000_000,    // dollars — quarter-1 revenue target (the floor before scaling)
      // A revenue mandate scales off the company's OWN trailing quarter so it never becomes a
      // rubber-stamp: the target is the greater of the escalating floor and last quarter's revenue
      // grown by this much. A giant late-game company gets a giant (but fair) bar; an early one still
      // gets the gentle escalating floor. Zero trailing (the very first mandate) → just the floor.
      revenueStretch: 0.15,       // target = max(floor, trailingQuarterRevenue × 1.15)
      rewardRevenueFrac: 0.10,    // a scaled revenue mandate pays ≥10% of its target in cash
      fansGrowthTarget: 0.15,     // "grow fans by ~15%" mandate
      fansFloor: 5_000,
      baseReward: 20_000_000,     // dollars — quarter-1 cash reward (the floor before scaling)
      repReward: 2,
    },
    // Board confidence (feature #5) — a memory on the mandate loop. Meeting a mandate raises the
    // board's confidence and your met-streak; a lapse drops confidence and resets the streak. The
    // confidence TIER multiplies mandate payouts (a doubtful board underpays; a visionary one pays
    // double) and the streak compounds a bonus on top. Neutral start (50) sits in the ×1.0 tier, so
    // an existing post-IPO save keeps today's payout until confidence actually moves. Gated on
    // wentPublic (the pinned solo sim never IPOs → byte-identical); no RNG.
    boardConfidence: {
      start: 50,                 // neutral — lands in the ×1.0 "Steady Board" tier
      max: 100,
      min: 0,
      gainOnMet: 12,             // confidence gained when a mandate is met
      lossOnLapse: 14,           // confidence lost when a mandate lapses (a touch gentler than a win-streak climb)
      streakBonusPerLevel: 0.12, // +12% payout per consecutive mandate met…
      maxStreakBonus: 0.6,       // …capped at +60%
    },
  },

  // --- Team Focus / Crunch (feature #4): concentrate the team to RUSH the active research or the
  // current build, shaving weeks off the timer at the cost of morale + overtime cash. One opt-in
  // toggle (teamFocus); OFF (undefined) is today's behavior, so the pinned solo sim is byte-identical.
  // Offline catch-up ignores crunch entirely (an irreversible morale hit the player couldn't react to).
  teamFocus: {
    minTeam: 2,                 // a solo founder can't "concentrate the team" — need a real roster
    researchSurgePerTick: 0.5,  // extra research progress-weeks per focused week (≈ finishes 6wk in ~4)
    buildSurgePerTick: 0.4,     // extra build progress-weeks per focused week
    crunchMoodDrain: 6,         // pulls each teammate's weekly mood TARGET down while crunching (burnout risk)
    overtimeCostPerHead: 6_000, // dollars — weekly overtime burn per teammate while crunching
  },

  // --- Side-order pipeline (item 3.5): floor-quality + client-loyalty bonuses on client commissions ---
  // All applied at COMPLETION of an accepted order (opt-in), so the pinned sim never triggers them.
  sideOrders: {
    qualityBonusPct: 0.2,     // max on-delivery bonus from a tidy, capable line (× lineEfficiency, 3.1/3.2)
    loyaltyBonusPct: 0.05,    // extra bonus per PRIOR completed order with the same client
    loyaltyBonusMaxPct: 0.25, // cap on the loyalty premium
  },

  // --- Post-launch reactive events (item 3.6): mid-lifecycle moments on a product already selling ---
  // Opportunistic interrupt sharing the global budget; opt-in resolution → the pinned sim raises none.
  postLaunch: {
    minEra: 2,               // the Garage era stays a protected learning sandbox
    cadenceWeeks: 30,        // ~one per this window (derived hash, salt 257)
    cooldownWeeks: 16,       // min gap between post-launch events
    minWeeksLive: 2,         // a product must have been out this long to draw one
    minWeeksLeft: 2,         // …and still have this much selling window left to matter
    momentumSellThrough: 0.8, // ≥ this sell-through → the "flying off shelves" beat
    stallSellThrough: 0.3,   // ≤ this sell-through → the "stalling" beat
    pushCost: dollars(8_000), pushFans: 600, pushRep: 3,   // hype push on a hot seller
    clearanceGain: dollars(12_000), clearanceRepDip: 2,    // clearance markdown on a slow mover
    supplyCost: dollars(10_000), supplyRepDip: 3,          // secure-supply vs. take-the-hit
  },

  // --- Design briefs (item 3.3): commit a product to a target buyer segment for a launch bonus ---
  // Opt-in only (product.targetSegment). Nailing the target's stat FIT at launch earns bonus rep +
  // fans; missing it forgoes the bonus but never penalises — so the commitment is a gamble the player
  // chooses, not a tax. A near-perfect fit scales the bonus up to its full value.
  briefs: {
    fitThreshold: 66,   // the target segment's fit (0..100) must clear this to "hit the brief"
    fitFull: 88,        // …and the bonus reaches full strength at this fit (linearly between the two)
    repBonus: 4,        // reputation added on a fully-hit brief
    fanBonus: 500,      // fans added on a fully-hit brief
  },

  // --- Creative / Sandbox mode: design without limits ---
  // Both are TOP-UP floors (never lower what you've legitimately earned). The cash floor is set high
  // enough that any purchase — acquisitions, mega production runs, founding the OS — is trivially
  // affordable, and the RP floor frees every research tier + OS module to experiment with. Applied
  // each tick AND the moment Creative mode is enabled, so it feels unlimited immediately.
  creative: {
    cashFloor: dollars(1_000_000_000), // effectively unlimited money
    rpFloor: 100_000,                  // effectively unlimited research points
  },
} as const;

export type Balance = typeof BALANCE;
