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
} from "../src/state/gameState.ts";
import { priceGuidance } from "../src/engine/market.ts";
import { CATEGORIES } from "../src/engine/catalogs.ts";
import { toDollars } from "../src/engine/money.ts";

const SLOTS = CATEGORIES.phone.slots;
const CHANNELS = ["none", "social", "search", "billboards", "influencer", "tv", "event"];
const CHANNEL_COST = { none: 0, social: 4000, search: 9000, billboards: 15000, influencer: 20000, tv: 30000, event: 45000 };

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

function simulate(seed, maxWeeks = 520) {
  let s = newGame(seed);
  const runwayWeek0 = toDollars(s.cash) / Math.max(1, weeklyBurnApprox(s));
  const verdicts = { hit: 0, solid: 0, steady: 0, flop: 0 };
  const eraWeek = {};
  let minCashEarly = Infinity; // closest brush with bankruptcy in the first 60 weeks
  let countedLaunches = new Set();
  let trough = Infinity;
  const effScoresByEra = { 1: [], 2: [], 3: [], 4: [] }; // effectiveScore = launchScore × compFactor

  for (let w = 0; w < maxWeeks; w++) {
    if (s.bankrupt) break;
    if (!eraWeek[s.era]) eraWeek[s.era] = s.week;

    // advance era as soon as eligible
    if (canAdvance(s)) s = advanceEraAction(s);

    // research: push the weakest-researched slot up a tier when RP allows
    let weakest = SLOTS[0];
    for (const slot of SLOTS) if (researchedTier(s, slot) < researchedTier(s, weakest)) weakest = slot;
    s = researchNext(s, weakest);

    // train the founder occasionally once there's a war chest (now that training actually works)
    const founder = s.staff[0];
    if (founder && founder.skill < 8 && toDollars(s.cash) > 60000 && w % 6 === 0) s = trainStaff(s, founder.id);

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

    // record newly-resolved launch verdicts
    for (const lp of s.launched) {
      if (!countedLaunches.has(lp.product.id) && lp.verdict) {
        countedLaunches.add(lp.product.id);
        verdicts[lp.verdict] = (verdicts[lp.verdict] ?? 0) + 1;
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
    finalNetWorth: toDollars(netWorth(s)),
    listed: s.listed,
    reputation: s.reputation,
    effScoresByEra,
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
console.log(`\nFinal net worth:     median ${money(median(agg((r) => r.finalNetWorth)))}  p10 ${money(pct(agg((r) => r.finalNetWorth), 0.1))}  p90 ${money(pct(agg((r) => r.finalNetWorth), 0.9))}`);
console.log(`Reached IPO/listed:  ${runs.filter((r) => r.listed).length}/${runs.length}`);
console.log(`Final reputation:    median ${median(agg((r) => r.reputation)).toFixed(0)}`);

// effectiveScore landscape vs the verdict bands, per era — the precise retune diagnostic.
const BANDS = {
  1: { flop: 10, solid: 45, hit: 70 }, 2: { flop: 21, solid: 56, hit: 80 },
  3: { flop: 27, solid: 98, hit: 116 }, 4: { flop: 35, solid: 115, hit: 128 },
};
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
