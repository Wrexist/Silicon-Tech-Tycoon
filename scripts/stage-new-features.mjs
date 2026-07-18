// Stage a save that SURFACES the features added this session, for review screenshots:
//   • the rolling Contract board on HQ (incl. one completed → claimable)
//   • a sold-out, still-live product with unmet demand (→ the Restock action in Market)
//   • an established, cash-rich company with acquirable rivals (→ the merger asset-inheritance preview)
//   • era 2 so the Design Lab exposes the new Monitor "Colour Accuracy" subsystem
// Built through the real engine so every screen is internally consistent. Bundled with esbuild:
//   esbuild scripts/stage-new-features.mjs --bundle --platform=node --format=cjs --outfile=scripts/.newfeat.cjs && node scripts/.newfeat.cjs
import { writeFileSync } from "node:fs";
import {
  newGame, placeFurniture, hireStaff, assignStaff, startBuild, launchReady,
  advanceOneWeek, buildWeeksFor, upgradeFacility, recommendedRun, productStats, restockQuote,
  canAcquire, acquisitionCost,
} from "../src/state/gameState.ts";
import { demoFloor } from "../src/engine/factoryFloor.ts";
import { priceGuidance } from "../src/engine/market.ts";
import { dollars, toDollars } from "../src/engine/money.ts";

let s = { ...newGame(7), designBudgetEnabled: false }; // screenshot harness: raw builds, not the design-budget cap (feature #1)
s = { ...s, onboarded: true, tutorialDone: true, factoryFloor: demoFloor(), companyName: "Silicon", cash: dollars(80_000_000), era: 2,
  reputation: 78, researched: { chip: 5, display: 5, battery: 4, materials: 4, software: 4, camera: 4 } };
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
  ["marketer", 5, "Cole"], ["engineer", 4, "Priya"], ["designer", 4, "Theo"],
];
for (const [role, skill, name] of hires) { const n = hireStaff(s, role, skill, name); if (n !== s) s = n; }
const a = s.staff;
if (a[1]) s = assignStaff(s, a[1].id, "rnd");
if (a[2]) s = assignStaff(s, a[2].id, "design");
if (a[3]) s = assignStaff(s, a[3].id, "marketing");

const mkPhone = (name, colorIndex, designTier) => ({
  id: `prod-${name}`, name, category: "phone",
  tiers: { chip: 5, display: 5, battery: 4, materials: 4, software: 4, camera: 4 },
  finish: "titanium", colorIndex, price: dollars(699), designTier,
  camera: { count: 3, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
  notch: "island",
});
// Back-catalogue (big runs) so revenue/fans/leaderboard read as a thriving company.
for (const base of [mkPhone("Aurora Pro", 3, 3), mkPhone("Aurora Ultra", 1, 3), mkPhone("Nova S", 4, 2)]) {
  const fair = Math.round(toDollars(priceGuidance(productStats(s, base), "phone").fair) / 10) * 10;
  const prod = { ...base, price: dollars(Math.max(199, fair)) };
  const r = startBuild(s, prod, recommendedRun(s, prod, "influencer"), "influencer");
  if (!r.ok) { console.error("build failed:", prod.name, r.reason); continue; }
  s = r.state;
  for (let w = 0; w < buildWeeksFor(s) + 1; w++) s = advanceOneWeek(s);
  const ready = s.ready[s.ready.length - 1];
  if (ready) { const lr = launchReady(s, ready.id); if (lr.ok) s = lr.state; }
  for (let w = 0; w < 5; w++) s = advanceOneWeek(s);
}

// The RESTOCK demo: a TABLET (no self-competition with the phone catalogue) shipped with a
// DELIBERATELY SMALL run while the market is hungry, launched recently so it's still live → the
// Market detail sheet shows "Restock · N units of demand unmet". Boost fans first so demand is strong.
s = { ...s, fans: Math.max(s.fans, 200_000) };
{
  const base = {
    id: "prod-Slate-Mini", name: "Slate Mini", category: "tablet",
    tiers: { chip: 5, display: 5, battery: 4, materials: 4, software: 4, camera: 3 },
    finish: "aluminium", colorIndex: 2, price: dollars(449), designTier: 3,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true }, notch: "punch",
  };
  const r = startBuild(s, base, 600, "influencer"); // small run vs. the era-2 tablet demand → sells out
  if (r.ok) {
    s = r.state;
    for (let w = 0; w < buildWeeksFor(s) + 1; w++) s = advanceOneWeek(s);
    const ready = s.ready[s.ready.length - 1];
    if (ready) { const lr = launchReady(s, ready.id); if (lr.ok) s = lr.state; }
    for (let w = 0; w < 3; w++) s = advanceOneWeek(s); // still early in its 16-week curve
  } else console.error("restock-demo build failed:", r.reason);
}

// Marketing-polish floors (never below the sim's own history). A huge war chest so EVERY visible
// rival is acquirable → whichever rival card the capture clicks shows the merger inheritance preview.
s = { ...s, reputation: Math.max(s.reputation, 80), fans: Math.max(s.fans, 240_000),
  cash: dollars(5_000_000_000), cumulativeRevenue: Math.max(s.cumulativeRevenue, 90_000_000_000) };

// Prepend a COMPLETED contract so the board shows a Claim button (the tick already filled the rest).
const doneContract = { id: "ct-demo", metric: "fans", title: "Win 20,000 new fans", blurb: "Grow the audience.",
  baseline: 0, target: 1, reward: { cash: dollars(120_000), rep: 3, fans: 5_000 }, startedWeek: s.week, expiresWeek: s.week + 40 };
// Clear every pending INTERRUPT so screenshots land on the actual screens, not a modal (rival strike,
// choice, poach, awards, license offer, side-order, ready-to-launch popup).
s = { ...s,
  contracts: [doneContract, ...(s.contracts ?? []).slice(0, 2)],
  pendingStrike: null, pendingChoice: null, pendingPoach: null, pendingAwards: null,
  pendingLicenseOffer: null, pendingSideOrder: null, eventChain: null, ready: [], building: [],
  lastStrikeWeek: s.week, nextEventWeek: s.week + 99, lastActive: Date.now(),
};

const acq = s.competitors.map((c) => canAcquire(s, c.id) ? `${c.name}(${acquisitionCost(s, c.id)})` : null).filter(Boolean);
console.error(`acquirable rivals: [${acq.join(", ")}]`);

const restockable = s.launched.filter((lp) => restockQuote(s, lp)).map((lp) => `${lp.product.name}(+${restockQuote(s, lp).maxUnits})`);
console.error(`staged: era ${s.era}, rep ${Math.round(s.reputation)}, fans ${s.fans}, launched ${s.launched.length}, contracts ${(s.contracts || []).length}, restockable [${restockable.join(", ")}]`);
writeFileSync("/tmp/silicon-newfeat.json", JSON.stringify(s));
console.error("wrote /tmp/silicon-newfeat.json");
