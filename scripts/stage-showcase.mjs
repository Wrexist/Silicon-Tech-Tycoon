// Stage a rich late-game save PLUS the new-feature overlay payloads, for the "new features" App
// Store screenshots (factory, awards, rival strike, side order). Built through the real engine so
// every screen reads as a thriving company; the transient overlays are synthesised from real
// products/rivals so the duel + ceremony render with live device art. Bundled with esbuild:
//   npm run shots:stage:showcase   → /tmp/silicon-showcase.json + /tmp/silicon-showcase-overlays.json
import { writeFileSync } from "node:fs";
import {
  newGame, placeFurniture, hireStaff, assignStaff, startBuild, launchReady,
  advanceOneWeek, buildWeeksFor, upgradeFacility, recommendedRun, productStats,
} from "../src/state/gameState.ts";
import { demoFloor, machineCells } from "../src/engine/factoryFloor.ts";
import { canPlaceProp, propCells } from "../src/engine/factoryProps.ts";
import { generateSideOrder } from "../src/engine/sideOrders.ts";
import { priceGuidance } from "../src/engine/market.ts";
import { overallScore } from "../src/engine/product.ts";
import { dollars, toDollars } from "../src/engine/money.ts";

let s = newGame(7);
s = { ...s, onboarded: true, tutorialDone: true, factoryFloor: demoFloor(), companyName: "Silicon", cash: dollars(80_000_000), era: 2,
  reputation: 78, researched: { chip: 5, display: 5, battery: 4, materials: 4, software: 4, camera: 4 } };
for (let i = 0; i < 3; i++) { const n = upgradeFacility(s); if (n !== s) s = n; }

// Office: two tidy rows of desks + warm decor so the HQ still reads as a scaled studio.
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
  ["marketer", 5, "Cole"], ["engineer", 4, "Priya"], ["designer", 4, "Theo"],
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
  tiers: { chip: 5, display: 5, battery: 4, materials: 4, software: 4, camera: 4 },
  finish: "titanium", colorIndex, price: dollars(699), designTier,
  camera: { count: 3, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
  notch: "island",
});
const catalog = [
  mkPhone("Aurora Pro", "prod-aurora-pro", 3, 3),
  mkPhone("Aurora Ultra", "prod-aurora-ultra", 1, 3),
  mkPhone("Nova S", "prod-nova-s", 4, 2),
  mkPhone("Aurora Pro II", "prod-aurora-pro-ii", 0, 3),
];
for (const base of catalog) {
  const fair = Math.round(toDollars(priceGuidance(productStats(s, base), "phone").fair) / 10) * 10;
  const prod = { ...base, price: dollars(Math.max(199, fair)) };
  const run = recommendedRun(s, prod, "influencer");
  const r = startBuild(s, prod, run, "influencer");
  if (!r.ok) { console.error("build failed:", prod.name, r.reason); continue; }
  s = r.state;
  for (let w = 0; w < buildWeeksFor(s) + 1; w++) s = advanceOneWeek(s);
  const ready = s.ready[s.ready.length - 1];
  if (ready) { const lr = launchReady(s, ready.id); if (lr.ok) s = lr.state; else console.error("launch failed:", lr.reason); }
  for (let w = 0; w < 5; w++) s = advanceOneWeek(s);
}

// Leave ONE build in progress so the 3D factory line is alive (belts roll, machines work) in the
// screenshot — the render loop animates whenever a build or side-order is active, even while paused.
{
  const base = mkPhone("Aurora Air", "prod-aurora-air", 2, 3);
  const fair = Math.round(toDollars(priceGuidance(productStats(s, base), "phone").fair) / 10) * 10;
  const prod = { ...base, price: dollars(Math.max(199, fair)) };
  const run = recommendedRun(s, prod, "influencer");
  const r = startBuild(s, prod, run, "influencer");
  // Leave it freshly started (weeksElapsed 0) — do NOT advance, or a fast era-2 line finishes it in
  // one week and it lands on the `ready` shelf, which suppresses the awards/strike overlays (their
  // higherUp/readyUp gate). An un-advanced build keeps `building` non-empty (line animates, belts
  // roll) while `ready` stays empty so the injected ceremony/duel own the screen.
  if (r.ok) s = r.state;
  else console.error("in-progress build failed:", r.reason);
}

// ---- Dress the factory floor: upgrade a few machines (tier pips) + place decor props + paint. ----
const floor = demoFloor();
const bump = { "st-mill": 3, "st-press": 2, "st-screen": 2, "st-arm": 3, "st-qa": 2 };
floor.machines = floor.machines.map((m) => (bump[m.id] ? { ...m, level: bump[m.id] } : m));
// Props in the open aisles — each validated against the live floor so nothing overlaps a
// machine, a belt, or another prop (invalid candidates are simply skipped).
let props = [];
const propWishlist = [
  ["rack", 6, 4], ["rack", 9, 4], ["bench", 2, 4], ["plant", 14, 1], ["plant", 14, 8],
  ["crates", 0, 4], ["crates", 14, 4], ["pallet", 14, 6], ["barrel", 2, 8], ["barrel", 13, 8],
  ["cone", 4, 5], ["cone", 11, 5], ["sign", 0, 8], ["plant", 8, 5],
];
for (const [kind, c, r] of propWishlist) {
  if (canPlaceProp(floor, props, kind, c, r, 16)) props.push({ id: `fp-show-${props.length}`, kind, c, r });
}
s = {
  ...s,
  factoryFloor: floor,
  factoryProps: props,
  factoryDecor: { wall: 1, floor: 1 }, // Ocean walls, Warm floor
  factoryPieceCounter: 200,
  reputation: Math.max(s.reputation, 80),
  fans: Math.max(s.fans, 240_000),
  cumulativeRevenue: Math.max(s.cumulativeRevenue, 90_000_000_000),
  cash: dollars(6_400_000), // healthy but human — the factory HUD reads a real wallet, not $80M
  pendingStrike: null, pendingAwards: null, pendingSideOrder: null,
  lastActive: Date.now(),
};

// ---- Overlay payloads (kept OUT of the base save; the capture script injects one per frame). ----
// A clean-sweep Silicon Awards ceremony — the most celebratory state (gold rim + confetti).
const swept = s.launched.slice(-3);
const pick = (i, fb) => swept[i]?.product?.name ?? fb;
const awards = {
  year: 2, week: 104,
  winners: [
    { categoryId: "device", title: "Device of the Year", productName: pick(2, "Aurora Pro II"), companyName: "Silicon", byPlayer: true, score: 93, category: "phone" },
    { categoryId: "design", title: "Design of the Year", productName: pick(1, "Aurora Ultra"), companyName: "Silicon", byPlayer: true, score: 90, category: "phone" },
    { categoryId: "value", title: "Value Champion", productName: pick(0, "Nova S"), companyName: "Silicon", byPlayer: true, score: 88, category: "phone" },
  ],
  playerWins: 3,
  fieldSize: 14,
};

// A rival strike duel — synthesise a rival release (renderable) attacking a real player launch.
const target = s.launched[s.launched.length - 1];
const rivalProduct = mkPhone("Pomelo Zenith", "rival-pomelo-zenith", 2, 3);
const playerOverall = overallScore(target.stats, "phone");
const rivalOverall = Math.max(60, playerOverall - 4); // player's device clearly outclasses → "Hold" bonus reads
const rivalRelease = {
  rivalId: "pomelo", rivalName: "Pomelo", week: s.week, category: "phone",
  product: rivalProduct, overall: rivalOverall, strength: 1.1, tone: "premium",
  tagline: "The seam between hardware and soul.", contested: true,
};
const strike = {
  week: s.week, rivalId: "pomelo", rivalName: "Pomelo",
  rivalProductName: "Pomelo Zenith", rivalOverall, category: "phone",
  productId: target.product.id, productName: target.product.name,
  playerOverall,
};

// A side-order commission offer, generated by the real derived stream for the staged seed/week.
const sideOrder = generateSideOrder(s.seed, s.week, s.era);

writeFileSync("/tmp/silicon-showcase.json", JSON.stringify(s));
writeFileSync("/tmp/silicon-showcase-overlays.json", JSON.stringify({ awards, strike, rivalRelease, sideOrder }));
const tally = s.launched.reduce((m, lp) => ((m[lp.verdict ?? "?"] = (m[lp.verdict ?? "?"] || 0) + 1), m), {});
console.error(`staged showcase: era ${s.era}, rep ${Math.round(s.reputation)}, launched ${s.launched.length} ${JSON.stringify(tally)}, props ${props.length}, week ${s.week}`);
console.error(`overlays: awards sweep=${awards.playerWins}/3, strike ${strike.playerOverall} vs ${strike.rivalOverall}, sideOrder ${sideOrder.clientName} (${sideOrder.units} units, needs ${sideOrder.requiredKinds.join("+")})`);
