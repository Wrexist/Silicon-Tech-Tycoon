// Stage a promo save: a thriving late-game studio with ONE very strong phone sitting on the
// `ready` shelf, so clicking Launch in the recording yields a guaranteed "It's a hit!" reveal
// (confetti) and the office cheers on Continue. Decorated office + factory for the b-roll.
//   node scripts/.vstage-promo.mjs  → /tmp/silicon-promo.json
import { writeFileSync } from "node:fs";
import {
  newGame, placeFurniture, hireStaff, assignStaff, startBuild, launchReady,
  advanceOneWeek, buildWeeksFor, upgradeFacility, recommendedRun, productStats,
  foundPlatform,
} from "../src/state/gameState.ts";
import { demoFloor } from "../src/engine/factoryFloor.ts";
import { canPlaceProp } from "../src/engine/factoryProps.ts";
import { priceGuidance } from "../src/engine/market.ts";
import { dollars, toDollars } from "../src/engine/money.ts";

let s = newGame(7);
s = { ...s, onboarded: true, tutorialDone: true, factoryFloor: demoFloor(), companyName: "Silicon", cash: dollars(80_000_000), era: 2,
  reputation: 82, researched: { chip: 5, display: 5, battery: 5, materials: 5, software: 5, camera: 5 } };
for (let i = 0; i < 3; i++) { const n = upgradeFacility(s); if (n !== s) s = n; }

const layout = [
  ["desk", 0, 0], ["desk", 3, 0], ["desk", 6, 0],
  ["desk", 0, 2], ["desk", 3, 2], ["desk", 6, 2],
  ["plantTall", 8, 0], ["bookshelf", 8, 2], ["arcade", 8, 4],
  ["rug", 2, 5], ["sofa", 0, 5], ["coffeeTable", 0, 7],
  ["meetingTable", 5, 5], ["plantPot", 8, 6], ["serverRack", 8, 7],
];
for (const [type, c, r] of layout) { const n = placeFurniture(s, type, c, r, 0); if (n !== s) s = n; }

const hires = [
  ["engineer", 6, "Mara"], ["engineer", 5, "Devin"], ["designer", 6, "Lena"],
  ["marketer", 6, "Cole"], ["engineer", 4, "Priya"], ["designer", 4, "Theo"],
];
for (const [role, skill, name] of hires) { const n = hireStaff(s, role, skill, name); if (n !== s) s = n; }
const a = s.staff;
if (a[1]) s = assignStaff(s, a[1].id, "rnd");
if (a[2]) s = assignStaff(s, a[2].id, "design");
if (a[3]) s = assignStaff(s, a[3].id, "marketing");
if (a[4]) s = assignStaff(s, a[4].id, "rnd");
if (a[5]) s = assignStaff(s, a[5].id, "design");

const mkPhone = (name, id, colorIndex, designTier) => ({
  id, name, category: "phone",
  tiers: { chip: 5, display: 5, battery: 5, materials: 5, software: 5, camera: 5 },
  finish: "titanium", colorIndex, price: dollars(999), designTier,
  camera: { count: 3, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
  notch: "island",
});

// Build a few devices to establish a hit streak + revenue history, then LAUNCH them.
const priorCatalog = [
  mkPhone("Aurora Pro", "prod-aurora-pro", 3, 3),
  mkPhone("Aurora Ultra", "prod-aurora-ultra", 1, 3),
  mkPhone("Nova S", "prod-nova-s", 4, 3),
];
for (const base of priorCatalog) {
  const fair = Math.round(toDollars(priceGuidance(productStats(s, base), "phone").fair) / 10) * 10;
  const prod = { ...base, price: dollars(Math.max(199, fair)) };
  const run = recommendedRun(s, prod, "influencer");
  const r = startBuild(s, prod, run, "influencer");
  if (!r.ok) { console.error("build failed:", prod.name, r.reason); continue; }
  s = r.state;
  for (let w = 0; w < buildWeeksFor(s) + 1; w++) s = advanceOneWeek(s);
  const ready = s.ready[s.ready.length - 1];
  if (ready) { const lr = launchReady(s, ready.id); if (lr.ok) s = lr.state; else console.error("launch failed:", lr.reason); }
  for (let w = 0; w < 4; w++) s = advanceOneWeek(s);
}

// Found the Platform division so the OS/company depth reads as a real business.
{ const n = foundPlatform(s); if (n !== s) s = n; else console.error("foundPlatform: no-op"); }

// The HERO device: build it to completion and LEAVE IT ON THE READY SHELF (do not launch).
{
  const base = mkPhone("Aurora Halo", "prod-aurora-halo", 2, 3);
  const fair = Math.round(toDollars(priceGuidance(productStats(s, base), "phone").fair) / 10) * 10;
  const prod = { ...base, price: dollars(Math.max(199, fair)) };
  const run = recommendedRun(s, prod, "influencer");
  const r = startBuild(s, prod, run, "influencer");
  if (!r.ok) { console.error("hero build failed:", r.reason); }
  else { s = r.state; for (let w = 0; w < buildWeeksFor(s) + 1; w++) s = advanceOneWeek(s); }
}

// Leave ONE build in progress so the factory line is alive (belts roll, machines work) during the
// factory b-roll — the render loop animates whenever a build is active, even while the sim is paused.
{
  const base = mkPhone("Aurora Air", "prod-aurora-air", 4, 3);
  const fair = Math.round(toDollars(priceGuidance(productStats(s, base), "phone").fair) / 10) * 10;
  const prod = { ...base, price: dollars(Math.max(199, fair)) };
  const run = recommendedRun(s, prod, "influencer");
  const r = startBuild(s, prod, run, "influencer");
  if (r.ok) s = r.state; else console.error("in-progress build failed:", r.reason);
}

// Dress the factory floor: upgraded machines + decor props + paint.
const floor = demoFloor();
const bump = { "st-mill": 3, "st-press": 3, "st-screen": 2, "st-arm": 3, "st-qa": 2 };
floor.machines = floor.machines.map((m) => (bump[m.id] ? { ...m, level: bump[m.id] } : m));
let props = [];
const propWishlist = [
  ["rack", 6, 4], ["rack", 9, 4], ["bench", 2, 4], ["plant", 14, 1], ["plant", 14, 8],
  ["crates", 0, 4], ["crates", 14, 4], ["pallet", 14, 6], ["barrel", 2, 8], ["barrel", 13, 8],
  ["cone", 4, 5], ["cone", 11, 5], ["sign", 0, 8], ["plant", 8, 5],
];
for (const [kind, c, r] of propWishlist) {
  if (canPlaceProp(floor, props, kind, c, r, 16)) props.push({ id: `fp-promo-${props.length}`, kind, c, r });
}

s = {
  ...s,
  factoryFloor: floor,
  factoryProps: props,
  factoryDecor: { wall: 1, floor: 1 },
  factoryPieceCounter: 200,
  reputation: Math.max(s.reputation, 85),
  fans: Math.max(s.fans, 320_000),
  cumulativeRevenue: Math.max(s.cumulativeRevenue, 120_000_000_000),
  cash: dollars(9_200_000),
  pendingStrike: null, pendingAwards: null, pendingSideOrder: null,
  lastActive: Date.now(),
};

const readyNames = s.ready.map((p) => p.name);
writeFileSync("/tmp/silicon-promo.json", JSON.stringify(s));
console.error(`staged promo: era ${s.era}, rep ${Math.round(s.reputation)}, launched ${s.launched.length}, ready [${readyNames.join(", ")}], props ${props.length}, week ${s.week}, platform=${!!s.platformUnlocked}`);
