// Fast-forward BALANCE HARNESS. Drives the real (pure, deterministic) engine with a "competent but
// not optimal" auto-player across many seeds, then reports the actual balance curve — so tuning is
// MEASURED, not guessed (the project has repeatedly asked for exactly this). No DOM, no React.
//
//   npm run sim            # bundles via esbuild + runs, prints a report
//
// Imports TypeScript engine modules, so it's bundled with esbuild before running (see package.json).
import {
  newGame, advanceOneWeek, planProduction, startBuild, launchReady, recommendedRun, // eslint-disable-line
  productStats, researchedTier, researchNext, canAdvance, advanceEraAction, netWorth, trainStaff, buyProject,
} from "../src/state/gameState.ts";
import { priceGuidance } from "../src/engine/market.ts";
import { CATEGORIES } from "../src/engine/catalogs.ts";
import { toDollars } from "../src/engine/money.ts";
import { BALANCE } from "../src/engine/balance.ts";

const SLOTS = CATEGORIES.phone.slots;
const CHANNELS = ["none", "social", "search", "billboards", "influencer", "tv", "event"];
const CHANNEL_COST = { none: 0, social: 4000, search: 9000, billboards: 15000, influencer: 20000, tv: 30000, event: 45000 };

// L5: strategy PROFILES. The old harness drove ONE fixed strategy (balanced maxer, fair price), so
// its net-worth CV measured only RNG noise of a single playstyle, not strategic divergence. These
// profiles each lean on a different depth axis (D1 coherence, D2 channel affinity, D3 brand band,
// D5 doctrine counters), so the cross-profile spread MEASURES whether strategy actually matters
// (the real "is the late game solved?" question). tierBias shapes the build; priceMult positions vs
// fair value; channel picks the campaign.
const PROFILES = {
  balanced:   { tierBias: "even",      priceMult: 1.00, channel: "priciest" },
  premium:    { tierBias: "even",      priceMult: 1.28, channel: "event" },      // strong brand overprices (D3), enterprise/style reach (D2)
  value:      { tierBias: "cheap",     priceMult: 0.88, channel: "social" },     // undercut defenders (D5), budget reach (D2)
  specialist: { tierBias: "chipHeavy", priceMult: 1.14, channel: "billboards", doctrine: "perfHouse" }, // lopsided Pro build (D1 Pro-tolerance), Performance house teeth (D6), premium vs undercutters (D5), pro reach (D2)
};

let nameSeq = 0;
/** The product this profile builds now: researched tiers shaped by the profile's tierBias, priced by
 *  its priceMult against fair value. */
function designProduct(s, profile = PROFILES.balanced) {
  const tiers = {};
  for (const slot of SLOTS) {
    const top = Math.max(1, researchedTier(s, slot));
    if (profile.tierBias === "cheap") tiers[slot] = Math.max(1, top - 1);
    else if (profile.tierBias === "chipHeavy") tiers[slot] = (slot === "chip" || slot === "display") ? top : Math.max(1, top - 2);
    else tiers[slot] = top;
  }
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
  product.price = Math.round(priceGuidance(productStats(s, product), "phone").fair * profile.priceMult);
  return product;
}

/** Pick the costliest marketing channel we can comfortably afford (≤ ~12% of cash). */
function pickChannel(s) {
  const budget = toDollars(s.cash) * 0.12;
  let best = "none";
  for (const c of CHANNELS) if (CHANNEL_COST[c] <= budget) best = c;
  return best;
}

/** The channel this profile wants: "priciest" = the old costliest-affordable pick; otherwise the
 *  profile's named channel if affordable (≤ ~12% of cash), stepping down to a cheaper one if not. */
function pickChannelFor(s, profile) {
  if (profile.channel === "priciest") return pickChannel(s);
  const budget = toDollars(s.cash) * 0.12;
  const order = ["event", "tv", "influencer", "billboards", "search", "social", "none"];
  const wantIdx = order.indexOf(profile.channel);
  for (let i = wantIdx; i < order.length; i++) if (CHANNEL_COST[order[i]] <= budget) return order[i];
  return "none";
}

function simulate(seed, profile = PROFILES.balanced, maxWeeks = 520) {
  let s = newGame(seed);
  const runwayWeek0 = toDollars(s.cash) / Math.max(1, weeklyBurnApprox(s));
  const verdicts = { hit: 0, solid: 0, steady: 0, flop: 0 };
  const eraWeek = {};
  let minCashEarly = Infinity; // closest brush with bankruptcy in the first 60 weeks
  let countedLaunches = new Set();
  let trough = Infinity;
  let repMinLate = Infinity; // lowest reputation observed once past the protected Garage era (adversity?)
  let winWeek = null; // first week the IPO "win" is available (era 4 + reputation >= 85)
  const effScoresByEra = { 1: [], 2: [], 3: [], 4: [] }; // effectiveScore = launchScore × compFactor

  for (let w = 0; w < maxWeeks; w++) {
    if (s.bankrupt) break;
    if (!eraWeek[s.era]) eraWeek[s.era] = s.week;
    if (s.era >= 2) repMinLate = Math.min(repMinLate, s.reputation);
    if (winWeek === null && s.era >= 4 && s.reputation >= 85) winWeek = s.week;

    // advance era as soon as eligible
    if (canAdvance(s)) s = advanceEraAction(s);

    // D6: a profile committed to an engineering doctrine buys it once affordable (it's an era-2 fork).
    if (profile.doctrine && !s.completedProjects.includes(profile.doctrine)) s = buyProject(s, profile.doctrine);

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
      const product = designProduct(s, profile);
      const channel = pickChannelFor(s, profile);
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
    winWeek,
    repMinLate: repMinLate === Infinity ? s.reputation : repMinLate,
    hitRate: countedLaunches.size ? verdicts.hit / countedLaunches.size : 0,
    effScoresByEra,
  };
}

// Rough weekly burn for the week-0 runway read (payroll is ~0 with a free founder; rent dominates).
function weeklyBurnApprox(s) {
  return toDollars(s.staff.reduce((a, m) => a + m.salary, 0)) + 120;
}

// ---- run the cohort ----
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 101 + 7);
// L5: every profile across every seed, so we can measure strategic divergence, not just RNG noise.
const profileRuns = Object.fromEntries(
  Object.entries(PROFILES).map(([name, p]) => [name, SEEDS.map((seed) => simulate(seed, p))]),
);
// The default report stays on the "balanced" profile so historical baselines remain comparable.
const runs = profileRuns.balanced;

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
const winWeeks = runs.map((r) => r.winWeek).filter((w) => w != null);
console.log(`\nIPO "win" available: median wk ${winWeeks.length ? median(winWeeks) : "—"} (${winWeeks.length}/${runs.length} reached era4+rep85)`);
if (winWeeks.length) {
  const w = median(winWeeks);
  console.log(`  → real time to win: base ${(w * 8 / 60).toFixed(0)} min of ticks · Fast ${(w * 1 / 60).toFixed(1)} min of ticks (plus design/management time)`);
}
console.log(`Reached IPO/listed:  ${runs.filter((r) => r.listed).length}/${runs.length}`);
console.log(`Final reputation:    median ${median(agg((r) => r.reputation)).toFixed(0)}`);

// --- "solved outcome" diagnostics: how much do runs actually DIVERGE? ---
const nw = agg((r) => r.finalNetWorth);
const nwMean = mean(nw);
const nwCV = Math.sqrt(mean(nw.map((x) => (x - nwMean) ** 2))) / nwMean;
const hitRates = agg((r) => r.hitRate);
console.log(`\n--- outcome variance (is the late game "solved"?) ---`);
console.log(`Net-worth CV:        ${(nwCV * 100).toFixed(1)}%  (low = every run ends the same)`);
console.log(`Net-worth spread:    p90/p10 = ${(pct(nw, 0.9) / pct(nw, 0.1)).toFixed(2)}×`);
console.log(`Per-run hit-rate:    p10 ${(pct(hitRates, 0.1) * 100).toFixed(0)}%  p50 ${(median(hitRates) * 100).toFixed(0)}%  p90 ${(pct(hitRates, 0.9) * 100).toFixed(0)}%`);
console.log(`Reputation low (≥E2):median ${median(agg((r) => r.repMinLate)).toFixed(0)}  min ${Math.min(...agg((r) => r.repMinLate)).toFixed(0)}  (never dips = no adversity)`);

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

// --- L5/L4: strategic divergence: do DIFFERENT strategies reach DIFFERENT outcomes? The single-
// profile CV above measures RNG noise of one playstyle; THIS measures whether the choice of strategy
// matters. Per-profile medians + the WITHIN-SEED spread across profiles (for the same seed/RNG, how
// far apart do the four strategies land) are the real "is the late game solved?" signal.
console.log(`\n--- strategic divergence (L4/L5): does the strategy you pick matter? ---`);
console.log(`  profile      bankrupt   win     net worth p50     hit%`);
for (const name of Object.keys(PROFILES)) {
  const rs = profileRuns[name];
  const nwv = rs.map((r) => r.finalNetWorth);
  const wins = rs.filter((r) => r.winWeek != null).length;
  const bk = rs.filter((r) => r.bankrupt).length;
  const hr = 100 * mean(rs.map((r) => r.hitRate));
  console.log(`  ${name.padEnd(11)}  ${String(bk).padStart(2)}/${rs.length}      ${String(wins).padStart(2)}/${rs.length}   ${money(median(nwv)).padStart(9)}         ${hr.toFixed(0)}%`);
}
// Within-seed cross-profile spread: for each seed, max/min of the four profiles' net worth.
const perSeedSpread = SEEDS.map((_, i) => {
  const vals = Object.keys(PROFILES).map((name) => profileRuns[name][i].finalNetWorth).filter((v) => v > 0);
  if (vals.length < 2) return 1;
  return Math.max(...vals) / Math.min(...vals);
});
const profileMedians = Object.keys(PROFILES).map((name) => median(profileRuns[name].map((r) => r.finalNetWorth)));
const crossMean = mean(profileMedians);
const crossCV = Math.sqrt(mean(profileMedians.map((x) => (x - crossMean) ** 2))) / crossMean;
console.log(`\n  Cross-profile net-worth CV: ${(crossCV * 100).toFixed(1)}%  (spread BETWEEN strategies, high = strategy matters)`);
console.log(`  Within-seed spread:         median ${median(perSeedSpread).toFixed(2)}×  best ${Math.max(...perSeedSpread).toFixed(2)}×  (same RNG; best vs worst strategy)`);
console.log("");
