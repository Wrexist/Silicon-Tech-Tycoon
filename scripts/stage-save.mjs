// Stage a rich, INTERNALLY-CONSISTENT late-game save for App Store screenshots, built entirely
// through the real engine (pure functions) so every screen — HQ office, Market leaderboard,
// Performance, Research — reads as a thriving company instead of a fresh game.
//
// This imports TypeScript engine modules, so it's bundled with esbuild before running:
//   npm run shots:stage        # → writes /tmp/silicon-stage.json
// Then feed it to the capture pass:
//   SHOTS_SAVE=/tmp/silicon-stage.json node scripts/shots.mjs
import { writeFileSync } from "node:fs";
import {
  newGame, placeFurniture, hireStaff, assignStaff, startBuild, launchReady,
  advanceOneWeek, buildWeeksFor, upgradeFacility, recommendedRun, productStats,
} from "../src/state/gameState.ts";
import { priceGuidance } from "../src/engine/market.ts";
import { dollars, toDollars } from "../src/engine/money.ts";

let s = newGame(7);
// Found the company + deep war chest so every staging action clears its cash gate. Strong
// reputation BEFORE the launches so they carry real hype (→ hits, not flops); Growth Era keeps
// the verdict bar reachable for a clean, aspirational performance record.
s = { ...s, onboarded: true, tutorialDone: true, companyName: "Silicon", cash: dollars(80_000_000), era: 2,
  reputation: 78, researched: { chip: 5, display: 5, battery: 4, materials: 4, software: 4, camera: 4 } };

// Roomier HQ so the office reads "scaled company": upgrade the facility for headcount capacity.
for (let i = 0; i < 3; i++) { const n = upgradeFacility(s); if (n !== s) s = n; }

// A full, tidy office: two rows of desks (each desk = one seat) + warm decor. Coords are grid
// cells (c,r); desk footprint is 2×1 so columns step by 3 to avoid collisions.
const layout = [
  ["desk", 0, 1], ["desk", 3, 1], ["desk", 6, 1],
  ["desk", 0, 3], ["desk", 3, 3], ["desk", 6, 3],
  ["plantTall", 8, 0], ["bookshelf", 8, 2], ["arcade", 8, 4],
  ["rug", 2, 5], ["sofa", 0, 5], ["coffeeTable", 0, 7],
  ["meetingTable", 5, 5], ["plantPot", 8, 6], ["serverRack", 8, 7],
];
for (const [type, c, r] of layout) { const n = placeFurniture(s, type, c, r, 0); if (n !== s) s = n; }

// A team across all three disciplines (seats now exist).
const hires = [
  ["engineer", 6, "Mara"], ["engineer", 5, "Devin"], ["designer", 6, "Lena"],
  ["marketer", 5, "Cole"], ["engineer", 4, "Priya"], ["designer", 4, "Theo"],
];
for (const [role, skill, name] of hires) { const n = hireStaff(s, role, skill, name); if (n !== s) s = n; }
// Spread assignments so R&D / Design / Marketing all show output.
const a = s.staff;
if (a[1]) s = assignStaff(s, a[1].id, "rnd");
if (a[2]) s = assignStaff(s, a[2].id, "design");
if (a[3]) s = assignStaff(s, a[3].id, "marketing");
if (a[4]) s = assignStaff(s, a[4].id, "rnd");
if (a[5]) s = assignStaff(s, a[5].id, "design");

// Ship a back-catalog of strong products so launched[]/fans/reputation/revenue + the leaderboard
// all fill in. Each: design → build → wait out the build → launch → let it sell a while.
const mkPhone = (name, colorIndex, designTier) => ({
  id: `prod-${name}`, name, category: "phone",
  tiers: { chip: 5, display: 5, battery: 4, materials: 4, software: 4, camera: 4 },
  finish: "titanium", colorIndex, price: dollars(699), designTier,
  camera: { count: 3, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
  notch: "island",
});
const catalog = [
  mkPhone("Aurora Pro", 3, 3),
  mkPhone("Aurora Ultra", 1, 3),
  mkPhone("Nova S", 4, 2),
  mkPhone("Aurora Pro II", 0, 3),
];
for (const base of catalog) {
  // Price each at fair market value (healthy priceFit → strong launch score). Recompute against
  // the live state so research/era shifts are reflected.
  const fair = Math.round(toDollars(priceGuidance(productStats(s, base), "phone").fair) / 10) * 10;
  const prod = { ...base, price: dollars(Math.max(199, fair)) };
  const run = recommendedRun(s, prod, "influencer");
  const r = startBuild(s, prod, run, "influencer");
  if (!r.ok) { console.error("build failed:", prod.name, r.reason); continue; }
  s = r.state;
  for (let w = 0; w < buildWeeksFor(s) + 1; w++) s = advanceOneWeek(s);
  const ready = s.ready[s.ready.length - 1];
  if (ready) { const lr = launchReady(s, ready.id); if (lr.ok) s = lr.state; else console.error("launch failed:", lr.reason); }
  for (let w = 0; w < 5; w++) s = advanceOneWeek(s); // let it sell before the next launch
}

// Marketing-polish floors (kept ABOVE whatever the sim produced, never below) so the hero numbers
// read aspirational without contradicting the simulated history.
s = {
  ...s,
  reputation: Math.max(s.reputation, 80),
  fans: Math.max(s.fans, 240_000),
  // Company valuation (→ industry-leaderboard rank) scales with lifetime revenue; floor it so a
  // young 4-product studio still reads as a top-tier contender racing for #1 rather than last place.
  cumulativeRevenue: Math.max(s.cumulativeRevenue, 90_000_000_000),
  lastActive: Date.now(),
};

const tally = s.launched.reduce((m, lp) => ((m[lp.verdict ?? "?"] = (m[lp.verdict ?? "?"] || 0) + 1), m), {});
console.error(`staged: era ${s.era}, rep ${Math.round(s.reputation)}, fans ${s.fans}, launched ${s.launched.length} ${JSON.stringify(tally)}, staff ${s.staff.length}, week ${s.week}, cash ${s.cash}`);
writeFileSync("/tmp/silicon-stage.json", JSON.stringify(s));
console.error("wrote /tmp/silicon-stage.json");
