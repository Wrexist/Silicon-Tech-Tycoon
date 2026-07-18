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
import { demoFloor, floorWidth } from "../src/engine/factoryFloor.ts";
import { canPlaceProp, propCells } from "../src/engine/factoryProps.ts";
import { generateSideOrder } from "../src/engine/sideOrders.ts";
import { priceGuidance } from "../src/engine/market.ts";
import { overallScore } from "../src/engine/product.ts";
import { dollars, toDollars } from "../src/engine/money.ts";

let s = { ...newGame(7), designBudgetEnabled: false }; // screenshot harness: raw builds, not the design-budget cap (feature #1)
s = { ...s, onboarded: true, tutorialDone: true, factoryFloor: demoFloor(), companyName: "Silicon", cash: dollars(80_000_000), era: 2,
  reputation: 78, researched: { chip: 5, display: 5, battery: 4, materials: 4, software: 4, camera: 4 } };
for (let i = 0; i < 3; i++) { const n = upgradeFacility(s); if (n !== s) s = n; }

// Office: a LAVISH Campus — the facility is tier 3, so the office grid is a roomy 13×13. Lay the
// team out as an OPEN-PLAN floor (three tidy desk bands across the back half) with distinct front
// zones — a sectional lounge, a meeting corner, a games/amenities nook and greenery along the walls —
// leaving real open floor between them so it reads as a spacious studio, never a cramped huddle.
// A fresh layout (not the starter desk) gives full control; placeFurniture no-ops on collision/OOB.
s = { ...s, layout: [] };
// Deliberately SPARE — a clean, real office is desks + open floor, not a pile of furniture. A single
// tidy lounge, one meeting table, a couple of plants along the walls; everything else stays open.
const layout = [
  // ── Engineering: three desk bands, one seat per employee. Off the back wall (rows 1/4/7) so every
  //    employee faces the camera. This is the ROOM — desks in clean rows with walkways between. ──
  ["executiveDesk", 0, 1], ["dualDesk", 5, 1], ["dualDesk", 9, 1],
  ["deskL", 0, 4], ["dualDesk", 4, 4], ["dualDesk", 8, 4], ["desk", 11, 4],
  ["dualDesk", 1, 7], ["dualDesk", 5, 7], ["desk", 9, 7],
  // ── One tidy lounge in the front-left corner: a sectional on a rug + a coffee table beside it. ──
  ["rugRound", 0, 10], ["sofaL", 0, 10], ["coffeeTable", 2, 10],
  // ── One meeting table, centre-front, with open floor all around it. ──
  ["meetingTable", 6, 10],
  // ── Restraint: just the brand sign on the back wall + a few tall plants in the corners / by the
  //    windows. No fridge / vending / benches / shelves cluttering the floor. ──
  ["neonSign", 6, 0],
  ["plantTall", 12, 2], ["plantTall", 12, 11], ["plantTall", 10, 12], ["plantTall", 0, 8],
];
let placed = 0;
for (const [type, c, r] of layout) { const n = placeFurniture(s, type, c, r, 0); if (n !== s) { s = n; placed++; } }
s = { ...s, desktops: 0 }; // no standalone pods — every employee has a real desk in the open plan

const hires = [
  ["engineer", 6, "Mara"], ["engineer", 5, "Devin"], ["designer", 6, "Lena"],
  ["marketer", 5, "Cole"], ["engineer", 4, "Priya"], ["designer", 4, "Theo"],
  ["engineer", 5, "Kai"], ["marketer", 4, "Nadia"], ["designer", 5, "Bo"],
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

// ---- Dress the factory floor LAVISHLY: a compact but PACKED floor — three full production rows
// wall-to-wall, conveyor aisles between them, a frontmost row of decor, every machine at its top
// tier, and a premium marble/ocean finish. Deliberately a MODEST expansion (not max): the floor is
// 16-wide × 10-deep, so widening to the full 28 goes wide-and-shallow and the 3D camera zooms out
// to fit it, leaving an empty foreground. 20 wide stays near-square and fills the portrait view. ----
const EXP = 1;                        // 20-wide floor: room for a fuller line, still frame-filling
const maxW = floorWidth(EXP);         // = 20 cells wide
const floor = demoFloor();            // keep the known-good animated line (belts on row 2)
// Every original machine upgraded to level 3 — the priciest, most detailed models (tier pips lit).
floor.machines = floor.machines.map((m) => ({ ...m, level: 3 }));
// Densify: a full MIDDLE production row (demoFloor leaves rows 3-5 bare) plus an east extension of
// the back and front rows into the new bays. Machines are 2×2 on a 3-col pitch so nothing overlaps;
// row 5 stays clear as a return aisle. All top tier.
const extraMachines = [
  ["mill", 2, 3], ["press", 5, 3], ["arm", 8, 3], ["qa", 11, 3], ["packer", 14, 3], ["intake", 17, 3], // mid row
  ["mill", 13, 0], ["screen", 16, 0],   // back row → east bays
  ["press", 13, 6], ["arm", 16, 6],      // front row → east bays
];
extraMachines.forEach(([kind, c, r], i) => floor.machines.push({ id: `st-x${i}`, kind, c, r, level: 3 }));
// A west→east return belt on the free row-5 aisle, spanning the width beneath the middle row.
for (let c = 1; c <= 18; c++) floor.belts.push({ c, r: 5, dir: "w" });
// Decorate the frontmost row (row 9 is entirely clear) + the aisle ends; each candidate is validated
// against the live floor (skips anything overlapping a machine, belt, or another prop).
let props = [];
const propWishlist = [
  ["plant", 0, 9], ["crates", 2, 9], ["barrel", 4, 9], ["rack", 6, 9], ["sign", 8, 9],
  ["pallet", 10, 9], ["cone", 12, 9], ["plant", 14, 9], ["crates", 16, 9], ["barrel", 18, 9],
  ["plant", 0, 2], ["rack", 19, 2], ["plant", 0, 5], ["rack", 19, 5], ["plant", 19, 8], ["cone", 0, 8],
];
for (const [kind, c, r] of propWishlist) {
  if (c < maxW && canPlaceProp(floor, props, kind, c, r, maxW)) props.push({ id: `fp-show-${props.length}`, kind, c, r });
}
s = {
  ...s,
  factoryFloor: floor,
  factoryProps: props,
  factoryExpansion: EXP,
  factoryDecor: { wall: 8, floor: 7 }, // Ocean walls + Marble floor — a premium, high-tech finish
  factoryPieceCounter: 400,
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

// ---- Seed the newest systems so their frames read as live: a research developing on the ring with
// a queue behind it, a standing brand-awareness meter, and per-region loyalty from regional events. ----
s = {
  ...s,
  activeResearch: { kind: "project", ref: "brandStudio", name: "Brand Studio", blurb: "Every launch gets more hype.", rpCost: 66, startWeek: s.week - 2, totalWeeks: 4 },
  researchQueue: [
    { kind: "tier", ref: "chip", tierLevel: 6, name: "QuantumCore Q2", blurb: "A stronger chip tier.", rpCost: 60, totalWeeks: 3 },
    { kind: "project", ref: "loyaltyProgram", name: "Loyalty Program", blurb: "Fan base decays 50% more slowly.", rpCost: 80, totalWeeks: 3 },
  ],
  researchPoints: 240,
  brandAwareness: 64,
  unlockedRegions: ["home", "north_america", "europe", "asia"],
  regionLoyalty: { asia: 62, europe: -28, north_america: 40 },
};

writeFileSync("/tmp/silicon-showcase.json", JSON.stringify(s));
writeFileSync("/tmp/silicon-showcase-overlays.json", JSON.stringify({ awards, strike, rivalRelease, sideOrder }));
const tally = s.launched.reduce((m, lp) => ((m[lp.verdict ?? "?"] = (m[lp.verdict ?? "?"] || 0) + 1), m), {});
console.error(`staged showcase: era ${s.era}, rep ${Math.round(s.reputation)}, launched ${s.launched.length} ${JSON.stringify(tally)}, props ${props.length}, week ${s.week}`);
console.error(`overlays: awards sweep=${awards.playerWins}/3, strike ${strike.playerOverall} vs ${strike.rivalOverall}, sideOrder ${sideOrder.clientName} (${sideOrder.units} units, needs ${sideOrder.requiredKinds.join("+")})`);
