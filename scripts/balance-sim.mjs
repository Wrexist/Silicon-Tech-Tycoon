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

let nameSeq = 0;
/** Best product the player can currently build: best researched tier per slot, fair price. */
function designProduct(s) {
  const tiers = {};
  for (const slot of SLOTS) tiers[slot] = Math.max(1, researchedTier(s, slot));
  const product = {
    id: `p${nameSeq}`,
    name: `Aurora ${++nameSeq}`,
    category: "phone",
    tiers,
    finish: "aluminium",
    colorIndex: 0,
    price: 0,
    designTier: s.era, // design effort grows with the company (1..4)
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
  };
  product.price = priceGuidance(productStats(s, product), "phone").fair;
  return product;
}

/** Pick the costliest marketing channel we can comfortably afford (≤ ~12% of cash). */
function pickChannel(s) {
  const budget = toDollars(s.cash) * 0.12;
  let best = "none";
  for (const c of CHANNELS) if (CHANNEL_COST[c] <= budget) best = c;
  return best;
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

/** Grow the team when there's comfortable runway: seat first, then search, then sign the best
 *  applicant. Deliberately unhurried — a bot that hires flat out would measure a payroll stress
 *  test rather than an ordinary game. */
function growTeam(s) {
  const cash = toDollars(s.cash);
  const payroll = toDollars(s.staff.reduce((a, m) => a + m.salary, 0));
  const runwayWeeks = cash / Math.max(1, payroll + 120);
  if (runwayWeeks < 40) return s; // not comfortable — bank the money instead

  // Sign whoever is on the shortlist (best headline skill), if there's a seat.
  if (s.candidates.length > 0) {
    if (s.staff.length >= deskCapacity(s)) s = buyDesk(s);
    if (s.staff.length < deskCapacity(s)) {
      const best = [...s.candidates].sort((a, b) => b.skill - a.skill)[0];
      const next = hireCandidate(s, best.id);
      if (next !== s) return next;
    }
    return s;
  }

  // Otherwise open a search we can comfortably afford, biggest tier first.
  if (!s.recruitment && s.staff.length < 10) {
    for (const tier of ["headhunter", "board"]) {
      const t = BALANCE.recruitment.tiers[tier];
      if (!t || toDollars(t.cost) > cash * 0.15) continue;
      const next = startRecruitment(s, tier);
      if (next !== s) return next;
    }
  }
  return s;
}

function simulate(seed, maxWeeks = 520) {
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
    s = growTeam(s);

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
      if (toDollars(regionUnlockCost(id)) > toDollars(s.cash) * 0.2) break; // cheapest first: if this
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
      const product = designProduct(s);
      const channel = pickChannel(s);
      const run = recommendedRun(s, product, channel);
      if (run > 0) {
        const res = startBuild(s, product, run, channel);
        if (res.ok) s = res.state;
      }
    }

    s = advanceOneWeek(s);
    simWeeks++;
    peakStaff = Math.max(peakStaff, s.staff.length);

    // Answer everything the tick raised. This is not bookkeeping — `noPendingInterrupt` (which every
    // opportunistic stream consults) also covers pendingChoice and pendingPoach, so a bot that lets
    // ONE choice card sit unanswered silently blocks every other stream for the remaining ~500 weeks
    // of the run. That is exactly what made five systems read "never fires" here while being perfectly
    // reachable in the real game, where the player cannot advance without answering.
    if (s.pendingChoice) {
      const opts = s.pendingChoice.event.options ?? [];
      if (opts.length) s = resolveChoice(s, opts[0].id);
      else s = { ...s, pendingChoice: null };
    }
    if (s.pendingPoach) s = resolvePoach(s, true); // match the offer and keep the person
    {
      const cleared = {};
      for (const key of INTERRUPT_ORDER) {
        const field = PENDING_FIELD[key];
        if (s[field] != null) { interrupts[key]++; cleared[field] = null; }
      }
      if (Object.keys(cleared).length) s = { ...s, ...cleared };
    }

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
    const cash = toDollars(s.cash);
    if (w < 60) minCashEarly = Math.min(minCashEarly, cash);
    trough = Math.min(trough, cash);
  }

  return {
    seed,
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
const runs = SEEDS.map((seed) => simulate(seed));

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
