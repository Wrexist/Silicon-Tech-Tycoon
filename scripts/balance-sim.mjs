// Fast-forward BALANCE HARNESS. Drives the real (pure, deterministic) engine with a "competent but
// not optimal" auto-player across many seeds, then reports the actual balance curve — so tuning is
// MEASURED, not guessed (the project has repeatedly asked for exactly this). No DOM, no React.
//
//   npm run sim            # bundles via esbuild + runs, prints a report
//
// Imports TypeScript engine modules, so it's bundled with esbuild before running (see package.json).
import {
  newGame, advanceOneWeek, planProduction, startBuild, launchReady, recommendedRun, // eslint-disable-line
  productStats, researchedTier, researchNext, canAdvance, advanceEraAction, netWorth, trainStaff,
  startRecruitment, hireCandidate, placeFurniture, upgradeFacility, deskCapacity,
  canList, listCompany, canIPO, goPublic, resolveChoice, resolvePoach,
  unlockRegion, unlockPlatform, canFoundPlatform, platformFoundingCost,
} from "../src/state/gameState.ts";
import { priceGuidance } from "../src/engine/market.ts";
import { CATEGORIES } from "../src/engine/catalogs.ts";
import { toDollars } from "../src/engine/money.ts";
import { BALANCE } from "../src/engine/balance.ts";
import { canPlace, gridN } from "../src/engine/furniture.ts";
import { regionById } from "../src/engine/regions.ts";
import { INTERRUPT_ORDER } from "../src/design/interruptPriority.ts";

const SLOTS = CATEGORIES.phone.slots;
/** Markets to open, cheapest unlock first — the order a cost-conscious player would expand in. */
const REGION_ORDER = ["north_america", "europe", "emerging", "asia"];
const regionUnlockCost = (id) => regionById(id)?.unlockCost ?? 0;
const CHANNELS = ["none", "social", "search", "billboards", "influencer", "tv", "event"];
const CHANNEL_COST = { none: 0, social: 4000, search: 9000, billboards: 15000, influencer: 20000, tv: 30000, event: 45000 };

// Every opportunistic/scheduled interrupt, and the state field that carries its pending card. The
// census below counts how many of these a player on this policy would actually be shown across the
// cohort — the number that says whether a whole system is live content or dead weight.
const PENDING_FIELD = {
  strike: "pendingStrike", awards: "pendingAwards", rivalry: "pendingRivalry",
  eureka: "pendingEureka", communityAsk: "pendingCommunityAsk", earnings: "pendingEarnings",
  staffMoment: "pendingStaffMoment", regionalEvent: "pendingRegionalEvent",
  licenseOffer: "pendingLicenseOffer", staffEvent: "pendingStaffEvent",
  postLaunch: "pendingPostLaunch", secretReveal: "pendingSecretReveal",
};

// ---- a realistic player ---------------------------------------------------------------------
// The harness used to drive ONE policy: best researched tier every time, fair price every time,
// costliest affordable campaign every time, acting every single week without fail. That player does
// not exist, and its consistency is an artefact — it made every run land in the same place and made
// "the late game is solved" impossible to distinguish from "the bot is a metronome".
//
// So the player is now a set of ARCHETYPES, each a plausible way a human actually plays, plus the
// imperfection every human has: weeks where they don't look at the game, launches they mis-price,
// campaigns they forget to book. That turns the cohort into a real question — do these players end
// up in different places? — which is the question "is the late game solved?" was always asking.
//
// Every imperfection is drawn from a hash of (seed, week, salt), never the sim RNG and never
// Math.random, so a given (seed, archetype) run is byte-reproducible like everything else here.
function h01(seed, week, salt) {
  let x = (Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul(week + 1, salt) ^ Math.imul(salt, 0x85ebca6b)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

const ARCHETYPES = {
  // The original policy, kept as the baseline so every number in this report stays comparable.
  optimizer: {
    label: "optimizer", blurb: "acts every week, best tier, fair price, richest campaign",
    tierDrop: 0, priceSkew: 0, channelBudget: 0.12, idleChance: 0, skipCampaign: 0,
    hireRunway: 40, maxStaff: 10, expandShare: 0.2, runSkew: 0,
  },
  // Protects the balance sheet. Ships a notch below the frontier, buys cheap ads, hires late.
  cautious: {
    label: "cautious", blurb: "hoards cash, ships a tier below the frontier, cheap ads",
    tierDrop: 1, priceSkew: -0.08, channelBudget: 0.04, idleChance: 0.1, skipCampaign: 0.15,
    hireRunway: 90, maxStaff: 6, expandShare: 0.08, runSkew: -0.2,
  },
  // Spends into growth. Over-produces, buys the biggest campaign it can, hires flat out.
  aggressive: {
    label: "aggressive", blurb: "spends into growth, over-produces, hires flat out",
    tierDrop: 0, priceSkew: 0.12, channelBudget: 0.3, idleChance: 0.05, skipCampaign: 0,
    hireRunway: 12, maxStaff: 16, expandShare: 0.45, runSkew: 0.35,
  },
  // Plays in bursts, forgets things, guesses at prices. The most human of the four.
  casual: {
    label: "casual", blurb: "plays in bursts, forgets campaigns, guesses at prices",
    tierDrop: 1, priceSkew: 0, channelBudget: 0.08, idleChance: 0.35, skipCampaign: 0.4,
    hireRunway: 60, maxStaff: 8, expandShare: 0.15, runSkew: 0,
  },
};

let nameSeq = 0;
/** The product this player builds: their tier discipline, and their aim at the guidance price. */
function designProduct(s, a, week) {
  const tiers = {};
  for (const slot of SLOTS) tiers[slot] = Math.max(1, researchedTier(s, slot) - a.tierDrop);
  const product = {
    id: `p${nameSeq}`,
    name: `Aurora ${++nameSeq}`,
    category: "phone",
    tiers,
    finish: "aluminium",
    colorIndex: 0,
    price: 0,
    designTier: Math.max(1, s.era - a.tierDrop), // design effort grows with the company (1..4)
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
  };
  const fair = priceGuidance(productStats(s, product), "phone").fair;
  // Nobody prices to the penny. A steady bias (this player runs cheap, or believes in their brand)
  // plus a wobble per launch — so pricing is a skill the run can be good or bad at, not a constant.
  const wobble = (h01(s.seed, week, 9001) - 0.5) * 0.2;
  product.price = Math.max(1, Math.round(fair * (1 + a.priceSkew + wobble)));
  return product;
}

/** The campaign this player books — sometimes none at all, because they forgot. */
function pickChannel(s, a, week) {
  if (a.skipCampaign > 0 && h01(s.seed, week, 9007) < a.skipCampaign) return "none";
  const budget = toDollars(s.cash) * a.channelBudget;
  let best = "none";
  for (const c of CHANNELS) if (CHANNEL_COST[c] <= budget) best = c;
  return best;
}

/** Is the player even looking at the game this week? A human plays in bursts; the optimizer's
 *  never-miss-a-week cadence is itself an unrealistic advantage. */
function idle(s, a, week) {
  return a.idleChance > 0 && h01(s.seed, week, 9013) < a.idleChance;
}

// ---- growing the company ------------------------------------------------------------------------
// The bot used to play all 520 weeks with the founder alone and never list. That made whole systems
// UNREACHABLE rather than merely rare — staffMoment and staffEvent both gate on `staff.length >= 2`,
// and the earnings call needs a listed company — so the census could not tell "tuned too rare" from
// "impossible". Hiring, seating, upgrading and listing are the four things a real player does that
// the bot did not; without them the harness is blind to about half the game.

/** Headcount ceiling of the office the company is in right now. */
function facilityStaffCap(s) {
  return BALANCE.facilities[s.facilityTier - 1]?.staffCapacity ?? 4;
}

/** Put a desk at the first cell that legally takes one, so a hire has somewhere to sit.
 *  hireCandidate refuses when `staff.length >= deskCapacity`, so seats gate headcount. */
function buyDesk(s) {
  const n = gridN(s.facilityTier);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!canPlace(s.layout, "desk", c, r, 0, undefined, s.facilityTier)) continue;
      const next = placeFurniture(s, "desk", c, r, 0);
      if (next !== s) return next;
      return s; // a legal cell we can't afford — nothing cheaper will fit either
    }
  }
  return s;
}

/** Grow the team at this player's appetite for risk: how much runway they insist on keeping, and
 *  how big a team they want at all. A cautious player banks the money; an aggressive one hires into
 *  a thinner cushion and finds out whether the game punishes that. */
function growTeam(s, a) {
  const cash = toDollars(s.cash);
  const payroll = toDollars(s.staff.reduce((acc, m) => acc + m.salary, 0));
  const runwayWeeks = cash / Math.max(1, payroll + 120);
  if (runwayWeeks < a.hireRunway) return s; // not comfortable enough for THIS player

  // Sign whoever is on the shortlist (best headline skill), if there's a seat.
  if (s.candidates.length > 0) {
    if (s.staff.length >= deskCapacity(s)) s = buyDesk(s);
    if (s.staff.length < deskCapacity(s)) {
      const best = [...s.candidates].sort((x, y) => y.skill - x.skill)[0];
      const next = hireCandidate(s, best.id);
      if (next !== s) return next;
    }
    return s;
  }

  // Otherwise open a search we can comfortably afford, biggest tier first.
  if (!s.recruitment && s.staff.length < a.maxStaff) {
    for (const tier of ["headhunter", "board"]) {
      const t = BALANCE.recruitment.tiers[tier];
      if (!t || toDollars(t.cost) > cash * 0.15) continue;
      const next = startRecruitment(s, tier);
      if (next !== s) return next;
    }
  }
  return s;
}

/** Everything that happens AFTER a tick, whether or not the player acted this week: answer the cards
 *  the week raised, and record what it produced.
 *
 *  Answering is not bookkeeping. `noPendingInterrupt` — which every opportunistic stream consults —
 *  also covers pendingChoice and pendingPoach, so leaving ONE choice card unanswered silently blocks
 *  every other stream for the rest of the run. That is what once made five systems read "never
 *  fires" here while being perfectly reachable in the real game, where the player cannot advance
 *  without answering. An idle week is a week the player didn't ACT, not one they slept through. */
function settleWeek(s, interrupts, verdicts, verdictsByEra, countedLaunches) {
  if (s.pendingChoice) {
    const opts = s.pendingChoice.event.options ?? [];
    if (opts.length) s = resolveChoice(s, opts[0].id);
    else s = { ...s, pendingChoice: null };
  }
  if (s.pendingPoach) s = resolvePoach(s, true); // match the offer and keep the person
  const cleared = {};
  for (const key of INTERRUPT_ORDER) {
    const field = PENDING_FIELD[key];
    if (s[field] != null) { interrupts[key]++; cleared[field] = null; }
  }
  if (Object.keys(cleared).length) s = { ...s, ...cleared };

  // record newly-resolved launch verdicts
  for (const lp of s.launched) {
    if (!countedLaunches.has(lp.product.id) && lp.verdict) {
      countedLaunches.add(lp.product.id);
      verdicts[lp.verdict] = (verdicts[lp.verdict] ?? 0) + 1;
      // …and again PER ERA. The aggregate mix is an average of four different games and hides a
      // flat one inside a varied one: every era-1 launch in the cohort returned the same verdict
      // while the headline number looked reasonable.
      (verdictsByEra[s.era] ??= {})[lp.verdict] = ((verdictsByEra[s.era] ?? {})[lp.verdict] ?? 0) + 1;
    }
  }
  return s;
}

function simulate(seed, archetype = "optimizer", maxWeeks = 520) {
  const a = ARCHETYPES[archetype];
  // This harness measures the RAW balance landscape (max-tier builds across eras), not the design
  // budget (feature #1). Opt out of the per-project EP cap so it keeps building max products to probe.
  let s = { ...newGame(seed), designBudgetEnabled: false };
  const runwayWeek0 = toDollars(s.cash) / Math.max(1, weeklyBurnApprox(s));
  const verdicts = { hit: 0, solid: 0, steady: 0, flop: 0 };
  const verdictsByEra = {};
  const eraWeek = {};
  let minCashEarly = Infinity; // closest brush with bankruptcy in the first 60 weeks
  let countedLaunches = new Set();
  let trough = Infinity;
  // Reputation DRAWDOWN — the deepest fall from a running peak, once past the protected Garage era.
  // The old metric was the minimum reputation seen at or after era 2, which is dominated by the
  // still-climbing first weeks of era 2 and reported "0" for a run whose reputation only ever went
  // up. Drawdown answers the question actually being asked: does a established company ever lose
  // ground it had already won?
  let repPeak = -Infinity;
  let repDrawdown = 0;
  let winWeek = null; // first week the IPO "win" is available (era 4 + reputation >= 85)
  const effScoresByEra = { 1: [], 2: [], 3: [], 4: [] }; // effectiveScore = launchScore × compFactor
  const interrupts = {}; // key → how many cards this run raised
  for (const k of INTERRUPT_ORDER) interrupts[k] = 0;
  let simWeeks = 0;
  let peakStaff = s.staff.length;

  for (let w = 0; w < maxWeeks; w++) {
    if (s.bankrupt) break;
    if (!eraWeek[s.era]) eraWeek[s.era] = s.week;
    if (s.era >= 2) {
      repPeak = Math.max(repPeak, s.reputation);
      repDrawdown = Math.max(repDrawdown, repPeak - s.reputation);
    }
    if (winWeek === null && s.era >= 4 && s.reputation >= 85) winWeek = s.week;

    // A week this player simply didn't open the game. The tick still runs; they just don't act.
    if (idle(s, a, w)) {
      s = advanceOneWeek(s);
      simWeeks++;
      s = settleWeek(s, interrupts, verdicts, verdictsByEra, countedLaunches);
      const c0 = toDollars(s.cash);
      if (w < 60) minCashEarly = Math.min(minCashEarly, c0);
      trough = Math.min(trough, c0);
      continue;
    }

    // advance era as soon as eligible
    if (canAdvance(s)) s = advanceEraAction(s);

    // research: push the weakest-researched slot up a tier when RP allows
    let weakest = SLOTS[0];
    for (const slot of SLOTS) if (researchedTier(s, slot) < researchedTier(s, weakest)) weakest = slot;
    s = researchNext(s, weakest);

    // train the weakest teammate occasionally once there's a war chest
    const trainee = [...s.staff].sort((a, b) => a.skill - b.skill)[0];
    if (trainee && trainee.skill < 8 && toDollars(s.cash) > 60000 && w % 6 === 0) s = trainStaff(s, trainee.id);

    // grow the company: a bigger office when the current one is full, then the team itself
    if (s.staff.length >= facilityStaffCap(s) - 1) s = upgradeFacility(s);
    s = growTeam(s, a);

    // take the company public when it qualifies — the gateway to the whole post-IPO layer
    // (shareholders, buybacks, quarterly earnings calls), which the founder-only bot never saw.
    if (canIPO(s) && !s.wentPublic) s = goPublic(s);
    if (canList(s) && !s.listed) s = listCompany(s, BALANCE.ipo.maxStakePerSale);

    // Expand abroad and found the Platform division. Both are gates on whole content streams —
    // regional events need a market past Home, licensing offers need `platformUnlocked` — so a bot
    // that stays home-only and hardware-only can never observe either.
    // Expand out of at most ~a fifth of the war chest — `unlockRegion` itself only checks that the
    // cash is there, so an eager bot will happily buy four markets and bankrupt itself.
    for (const id of REGION_ORDER) {
      if (s.unlockedRegions.includes(id)) continue;
      if (toDollars(regionUnlockCost(id)) > toDollars(s.cash) * a.expandShare) break; // cheapest first: if this
      const next = unlockRegion(s, id);                                     // one is too dear, so is
      if (next !== s) { s = next; break; }                                  // every later one
    }
    if (canFoundPlatform(s) && toDollars(s.cash) > toDollars(platformFoundingCost()) * 2) {
      s = unlockPlatform(s, true);
    }

    // launch anything ready (recompute the plan to capture the effectiveScore that drives the verdict)
    if (s.ready.length > 0) {
      const ready = s.ready[0];
      const ch = ready.channelId ?? "none";
      const plan = planProduction(s, ready, ready.plannedUnits ?? 0, ch);
      const eff = plan.launchScore * plan.competitionFactor;
      const res = launchReady(s, ready.id);
      if (res.ok) { s = res.state; (effScoresByEra[s.era] ??= []).push(eff); }
    }

    // start a build if the line is idle
    if (s.building.length === 0 && s.ready.length === 0) {
      const product = designProduct(s, a, w);
      const channel = pickChannel(s, a, w);
      // Production sizing is a judgement call, not a readout. This player systematically over- or
      // under-builds against the recommendation, which is where inventory risk actually comes from.
      const run = Math.max(1, Math.round(recommendedRun(s, product, channel) * (1 + a.runSkew)));
      if (run > 0) {
        const res = startBuild(s, product, run, channel);
        if (res.ok) s = res.state;
      }
    }

    s = advanceOneWeek(s);
    simWeeks++;
    peakStaff = Math.max(peakStaff, s.staff.length);

    s = settleWeek(s, interrupts, verdicts, verdictsByEra, countedLaunches);

    const cash = toDollars(s.cash);
    if (w < 60) minCashEarly = Math.min(minCashEarly, cash);
    trough = Math.min(trough, cash);
  }

  return {
    seed,
    archetype,
    bankrupt: s.bankrupt,
    finalWeek: s.week,
    runwayWeek0,
    minCashEarly,
    trough,
    eraWeek,
    finalEra: s.era,
    launches: countedLaunches.size,
    verdicts,
    verdictsByEra,
    finalNetWorth: toDollars(netWorth(s)),
    listed: s.listed,
    reputation: s.reputation,
    winWeek,
    repDrawdown,
    hitRate: countedLaunches.size ? verdicts.hit / countedLaunches.size : 0,
    effScoresByEra,
    interrupts,
    simWeeks,
    peakStaff,
    wentPublic: s.wentPublic,
  };
}

// Rough weekly burn for the week-0 runway read (payroll is ~0 with a free founder; rent dominates).
function weeklyBurnApprox(s) {
  return toDollars(s.staff.reduce((a, m) => a + m.salary, 0)) + 120;
}

// ---- run the cohort ----
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 101 + 7);
// The headline report stays on the optimizer, so every number in it remains comparable with the
// previous tuning passes. The archetype panel at the bottom runs the other three on a smaller
// cohort — it is answering a different question (does HOW you play change WHERE you end up?) and
// does not need the same resolution.
const runs = SEEDS.map((seed) => simulate(seed, "optimizer"));
const PANEL_SEEDS = SEEDS.slice(0, 20);
const panel = Object.keys(ARCHETYPES).map((key) => ({
  key,
  a: ARCHETYPES[key],
  runs: key === "optimizer" ? runs.slice(0, PANEL_SEEDS.length) : PANEL_SEEDS.map((seed) => simulate(seed, key)),
}));

const agg = (f) => runs.map(f);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs) => { const a = [...xs].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const pct = (xs, p) => { const a = [...xs].sort((x, y) => x - y); return a[Math.floor((a.length - 1) * p)]; };
const money = (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}k` : `$${n.toFixed(0)}`);

const totalV = runs.reduce((acc, r) => {
  for (const k of ["hit", "solid", "steady", "flop"]) acc[k] += r.verdicts[k];
  return acc;
}, { hit: 0, solid: 0, steady: 0, flop: 0 });
const totalLaunches = totalV.hit + totalV.solid + totalV.steady + totalV.flop;
const eraArrival = (era) => {
  const xs = runs.map((r) => r.eraWeek[era]).filter((x) => x != null);
  return xs.length ? `wk ${median(xs)} (${xs.length}/${runs.length} reached)` : "—";
};

console.log(`\n=== BALANCE HARNESS — ${runs.length} seeds, competent auto-player, ${runs[0].finalWeek}-wk cap ===\n`);
console.log(`Bankruptcies:        ${runs.filter((r) => r.bankrupt).length}/${runs.length}`);
console.log(`Week-0 runway:       median ${median(agg((r) => r.runwayWeek0)).toFixed(0)} wk  (no failure pressure if huge)`);
console.log(`Early trough (wk<60):median ${money(median(agg((r) => r.minCashEarly)))}  min ${money(Math.min(...agg((r) => r.minCashEarly)))}`);
console.log(`Lifetime cash trough:median ${money(median(agg((r) => r.trough)))}  (closest brush with $0)`);
console.log(`\nEra arrival (median week):`);
console.log(`  Era 2 (Growth):    ${eraArrival(2)}`);
console.log(`  Era 3 (Platform):  ${eraArrival(3)}`);
console.log(`  Era 4 (AI):        ${eraArrival(4)}`);
console.log(`\nLaunches/run:        median ${median(agg((r) => r.launches))}`);
console.log(`Verdict mix (all launches, n=${totalLaunches}):`);
for (const k of ["hit", "solid", "steady", "flop"]) {
  const p = totalLaunches ? (100 * totalV[k] / totalLaunches).toFixed(1) : "0";
  console.log(`  ${k.padEnd(7)} ${String(totalV[k]).padStart(4)}  ${p}%`);
}
console.log(`Verdict mix PER ERA (a flat era is invisible in the aggregate above):`);
for (const era of [1, 2, 3, 4, 5]) {
  const tot = { hit: 0, solid: 0, steady: 0, flop: 0 };
  for (const r of runs) for (const k of Object.keys(tot)) tot[k] += r.verdictsByEra[era]?.[k] ?? 0;
  const n = tot.hit + tot.solid + tot.steady + tot.flop;
  if (!n) continue;
  const p = (k) => `${((100 * tot[k]) / n).toFixed(0)}%`.padStart(4);
  console.log(`  era ${era}  n=${String(n).padStart(4)}   hit ${p("hit")}  solid ${p("solid")}  steady ${p("steady")}  flop ${p("flop")}`);
}
console.log(`\nFinal net worth:     median ${money(median(agg((r) => r.finalNetWorth)))}  p10 ${money(pct(agg((r) => r.finalNetWorth), 0.1))}  p90 ${money(pct(agg((r) => r.finalNetWorth), 0.9))}`);
const winWeeks = runs.map((r) => r.winWeek).filter((w) => w != null);
console.log(`\nIPO "win" available: median wk ${winWeeks.length ? median(winWeeks) : "—"} (${winWeeks.length}/${runs.length} reached era4+rep85)`);
if (winWeeks.length) {
  const w = median(winWeeks);
  console.log(`  → real time to win: base ${(w * 8 / 60).toFixed(0)} min of ticks · Fast ${(w * 1 / 60).toFixed(1)} min of ticks (plus design/management time)`);
}
console.log(`Reached IPO/listed:  ${runs.filter((r) => r.listed).length}/${runs.length}  (went public ${runs.filter((r) => r.wentPublic).length}/${runs.length})`);
console.log(`Peak headcount:      median ${median(agg((r) => r.peakStaff))}  max ${Math.max(...agg((r) => r.peakStaff))}`);
console.log(`Final reputation:    median ${median(agg((r) => r.reputation)).toFixed(0)}`);

// --- interrupt census: is each "alive" system actually live content, or dead weight? ---
// Every stream below costs engine code, a reducer, an overlay and a slice of the shared interrupt
// budget. A stream reading 0 across the whole cohort is content nobody will ever see; one reading
// "1 per 5000 wk" is content nobody will see TWICE. Both are tuning bugs, and neither is visible
// from unit tests, which construct the exact state each system needs and then assert it fires.
const censusWeeks = runs.reduce((a, r) => a + r.simWeeks, 0);
console.log(`\n--- interrupt census (cards a player on this policy is actually shown) ---`);
let censusTotal = 0;
for (const key of INTERRUPT_ORDER) {
  const n = runs.reduce((a, r) => a + r.interrupts[key], 0);
  censusTotal += n;
  const rate = n === 0 ? "NEVER FIRES — unreachable or mistuned" : `1 per ${(censusWeeks / n).toFixed(0).padStart(5)} wk`;
  console.log(`  ${key.padEnd(14)} ${String(n).padStart(5)}   ${rate}`);
}
console.log(`  ${"TOTAL".padEnd(14)} ${String(censusTotal).padStart(5)}   1 per ${(censusWeeks / Math.max(1, censusTotal)).toFixed(1)} wk over ${censusWeeks} sim-weeks`);
console.log(`  budget allows          one card per ${BALANCE.interrupts.minGapWeeks} wk (${BALANCE.interrupts.minGapWeeksLate} late) — the gap between these two numbers is unused content`);

// --- "solved outcome" diagnostics: how much do runs actually DIVERGE? ---
const nw = agg((r) => r.finalNetWorth);
const nwMean = mean(nw);
const nwCV = Math.sqrt(mean(nw.map((x) => (x - nwMean) ** 2))) / nwMean;
const hitRates = agg((r) => r.hitRate);
console.log(`\n--- outcome variance (is the late game "solved"?) ---`);
console.log(`Net-worth CV:        ${(nwCV * 100).toFixed(1)}%  (low = every run ends the same)`);
console.log(`Net-worth spread:    p90/p10 = ${(pct(nw, 0.9) / pct(nw, 0.1)).toFixed(2)}×`);
console.log(`Per-run hit-rate:    p10 ${(pct(hitRates, 0.1) * 100).toFixed(0)}%  p50 ${(median(hitRates) * 100).toFixed(0)}%  p90 ${(pct(hitRates, 0.9) * 100).toFixed(0)}%`);
const dd = agg((r) => r.repDrawdown);
console.log(`Reputation drawdown: median ${median(dd).toFixed(0)} pts  p90 ${pct(dd, 0.9).toFixed(0)}  (deepest fall from a peak past era 2; ~0 = nothing is ever lost)`);

// effectiveScore landscape vs the verdict bands, per era — the precise retune diagnostic.
// Derived from the live engine tuning so the diagnostic can never drift from balance.ts.
const { hitThresholdByEra, solidThresholdByEra, flopThresholdByEra } = BALANCE.reputation;
const BANDS = Object.fromEntries(
  hitThresholdByEra.map((hit, i) => [i + 1, { flop: flopThresholdByEra[i], solid: solidThresholdByEra[i], hit }]),
);
console.log(`\neffectiveScore landscape (launchScore × competitionFactor), per era:`);
console.log(`  era   n     p10    p50    p90     | bands flop/solid/hit`);
for (const era of [1, 2, 3, 4]) {
  const xs = runs.flatMap((r) => r.effScoresByEra[era] ?? []);
  const b = BANDS[era];
  if (!xs.length) { console.log(`  ${era}     0     —`); continue; }
  console.log(
    `  ${era}   ${String(xs.length).padStart(4)}  ${pct(xs, 0.1).toFixed(0).padStart(5)}  ${median(xs).toFixed(0).padStart(5)}  ${pct(xs, 0.9).toFixed(0).padStart(5)}    | ${b.flop} / ${b.solid} / ${b.hit}`,
  );
}
console.log("");

// --- DOES HOW YOU PLAY CHANGE WHERE YOU END UP? ---------------------------------------------------
// The single-policy harness could not ask this. It drove one metronomic player — best tier, fair
// price, richest campaign, acting every single week — so every run landed in the same place, and
// "the late game is solved" was indistinguishable from "the bot is a metronome". These are four
// plausible humans on the SAME seeds. If the game rewards playing well, they should not converge.
console.log(`\n--- player archetypes (${panel[0].runs.length} shared seeds each) ---`);
console.log(`  ${"who".padEnd(11)} ${"net worth".padStart(11)} ${"era4".padStart(6)} ${"launches".padStart(9)} ${"hit%".padStart(5)} ${"flop%".padStart(6)} ${"bankrupt".padStart(9)}   how they play`);
for (const p of panel) {
  const nw = p.runs.map((r) => r.finalNetWorth);
  const e4 = p.runs.map((r) => r.eraWeek[4]).filter((x) => x != null);
  const v = p.runs.reduce((acc, r) => {
    for (const k of ["hit", "solid", "steady", "flop"]) acc[k] += r.verdicts[k];
    return acc;
  }, { hit: 0, solid: 0, steady: 0, flop: 0 });
  const n = v.hit + v.solid + v.steady + v.flop;
  const share = (k) => (n ? `${((100 * v[k]) / n).toFixed(0)}%` : "—");
  console.log(
    `  ${p.key.padEnd(11)} ${money(median(nw)).padStart(11)} ${(e4.length ? `wk${median(e4)}` : "never").padStart(6)}` +
    ` ${String(median(p.runs.map((r) => r.launches))).padStart(9)} ${share("hit").padStart(5)} ${share("flop").padStart(6)}` +
    ` ${`${p.runs.filter((r) => r.bankrupt).length}/${p.runs.length}`.padStart(9)}   ${p.a.blurb}`,
  );
}
{
  const meds = panel.map((p) => median(p.runs.map((r) => r.finalNetWorth)));
  const spread = Math.max(...meds) / Math.max(1, Math.min(...meds));
  const totalRuns = panel.reduce((n, p) => n + p.runs.length, 0);
  const died = panel.reduce((n, p) => n + p.runs.filter((r) => r.bankrupt).length, 0);
  const deadRate = died / totalRuns;
  console.log(`\n  best archetype ends ${spread.toFixed(1)}x the worst; ${died}/${totalRuns} runs went under.`);
  // Read the two numbers TOGETHER. A huge spread produced by everyone-but-one going bankrupt is not
  // "strategy matters", it is a game with one viable line — the opposite diagnosis, from the same
  // headline figure. Bankruptcy rate has to be checked first or the spread reads backwards.
  if (deadRate > 0.4) {
    console.log(`  → ${(100 * deadRate).toFixed(0)}% of these players go bankrupt. The spread is survivorship, not strategy:`);
    console.log(`    the game has one viable line and everything else is a loss. Check the cliff probes below.`);
  } else if (spread < 1.5) {
    console.log(`  → under 1.5x with most runs surviving: how you play barely matters.`);
    console.log(`    The outcome is the schedule, not the decisions.`);
  } else {
    console.log(`  → most players survive and still land in materially different places.`);
    console.log(`    That is what makes the decisions worth making.`);
  }
}
console.log("");

// --- CLIFF PROBES -------------------------------------------------------------------------------
// Vary ONE dial at a time from the optimizer baseline. Archetypes answer "do different players end
// up in different places"; this answers the sharper question underneath — WHICH single mistake is
// fatal. Both cliffs below were invisible until it was run: most dials are slack (a player can skip
// half their weeks, or spend nothing on ads, and still finish rich), and then two of them fall off
// a table. A dial that goes from 0/N to most-of-N inside one step is a trap, not a difficulty
// curve: the player gets no gradient to learn from.
const CLIFF_SEEDS = SEEDS.slice(0, 12);
function cliff(label, over) {
  const rs = CLIFF_SEEDS.map((seed) => {
    ARCHETYPES.__probe = { ...ARCHETYPES.optimizer, label: "__probe", blurb: "", ...over };
    return simulate(seed, "__probe");
  });
  const dead = rs.filter((r) => r.bankrupt).length;
  const mark = dead > CLIFF_SEEDS.length / 2 ? "  <-- CLIFF" : "";
  console.log(
    `  ${label.padEnd(30)} bankrupt ${String(dead).padStart(2)}/${CLIFF_SEEDS.length}` +
    `  net ${money(median(rs.map((r) => r.finalNetWorth))).padStart(7)}` +
    `  launches ${String(median(rs.map((r) => r.launches))).padStart(3)}${mark}`,
  );
}
console.log(`--- cliff probes: one dial at a time, ${CLIFF_SEEDS.length} seeds ---`);
cliff("baseline (optimizer)", {});
console.log("  ship below the best researched tier:");
for (const d of [1, 2]) cliff(`  components -${d}`, { tierDrop: d });
console.log("  build more than recommended:");
for (const r of [0.1, 0.2, 0.25, 0.35]) cliff(`  +${(r * 100).toFixed(0)}% units`, { runSkew: r });
console.log("  …and the dials that turn out NOT to matter much:");
cliff("  no ad spend at all", { channelBudget: 0 });
cliff("  ignores the game half the time", { idleChance: 0.5 });
cliff("  builds 30% under recommended", { runSkew: -0.3 });
console.log("");
