// Stage a save that SURFACES the reworked Global markets UI (Market → Demand) for review screenshots:
//   • the empire "world reach" meter at a mid value (3 of 5 markets licensed)
//   • open regions showing their live weekly-revenue contribution
//   • locked regions showing world-share %, buyer taste chips, a fit read + the "Buy licence" button
//   esbuild scripts/stage-regions.mjs --bundle --platform=node --format=cjs --outfile=scripts/.regions.cjs && node scripts/.regions.cjs
import { writeFileSync } from "node:fs";
import {
  newGame, placeFurniture, hireStaff, startBuild, launchReady,
  advanceOneWeek, buildWeeksFor, upgradeFacility, recommendedRun, productStats,
} from "../src/state/gameState.ts";
import { demoFloor } from "../src/engine/factoryFloor.ts";
import { priceGuidance } from "../src/engine/market.ts";
import { dollars, toDollars } from "../src/engine/money.ts";

let s = { ...newGame(7), designBudgetEnabled: false }; // screenshot harness: raw builds, not the design-budget cap (feature #1)
s = { ...s, onboarded: true, tutorialDone: true, factoryFloor: demoFloor(), companyName: "Silicon", cash: dollars(120_000_000), era: 2,
  reputation: 80, researched: { chip: 5, display: 5, battery: 4, materials: 4, software: 4, camera: 4 },
  // Three of five markets already licensed → the reach meter reads ~mid, with Asia + Emerging still to buy.
  unlockedRegions: ["home", "north_america", "europe"] };
for (let i = 0; i < 3; i++) { const n = upgradeFacility(s); if (n !== s) s = n; }
for (const [type, c, r] of [["desk", 0, 0], ["desk", 3, 0], ["desk", 6, 0], ["desk", 0, 2], ["plantTall", 8, 0], ["serverRack", 8, 7]]) {
  const n = placeFurniture(s, type, c, r, 0); if (n !== s) s = n;
}
for (const [role, skill, name] of [["engineer", 6, "Mara"], ["designer", 6, "Lena"], ["marketer", 5, "Cole"]]) {
  const n = hireStaff(s, role, skill, name); if (n !== s) s = n;
}

const mkPhone = (name, colorIndex, designTier) => ({
  id: `prod-${name}`, name, category: "phone",
  tiers: { chip: 5, display: 5, battery: 4, materials: 4, software: 4, camera: 4 },
  finish: "titanium", colorIndex, price: dollars(799), designTier,
  camera: { count: 3, layout: "square", position: "topLeft", module: "squircle", flash: true }, notch: "island",
  // Ship to every licensed market so each open region shows a live revenue contribution.
  regions: ["home", "north_america", "europe"],
});
for (const base of [mkPhone("Aurora Pro", 3, 3), mkPhone("Aurora Ultra", 1, 3)]) {
  const fair = Math.round(toDollars(priceGuidance(productStats(s, base), "phone").fair) / 10) * 10;
  const prod = { ...base, price: dollars(Math.max(199, fair)) };
  const r = startBuild(s, prod, recommendedRun(s, prod, "influencer"), "influencer");
  if (!r.ok) { console.error("build failed:", prod.name, r.reason); continue; }
  s = r.state;
  for (let w = 0; w < buildWeeksFor(s) + 1; w++) s = advanceOneWeek(s);
  const ready = s.ready[s.ready.length - 1];
  if (ready) { const lr = launchReady(s, ready.id); if (lr.ok) s = lr.state; }
  for (let w = 0; w < 4; w++) s = advanceOneWeek(s);
}

s = { ...s, reputation: Math.max(s.reputation, 82), fans: Math.max(s.fans, 240_000),
  cash: dollars(120_000_000), cumulativeRevenue: Math.max(s.cumulativeRevenue, 90_000_000_000),
  pendingStrike: null, pendingChoice: null, pendingPoach: null, pendingAwards: null,
  pendingLicenseOffer: null, pendingSideOrder: null, eventChain: null, ready: [], building: [],
  lastStrikeWeek: s.week, nextEventWeek: s.week + 99, lastActive: Date.now() };

console.error(`staged regions: unlocked ${JSON.stringify(s.unlockedRegions)}, launched ${s.launched.length}, cash ${toDollars(s.cash)}`);
writeFileSync("/tmp/silicon-regions.json", JSON.stringify(s));
console.error("wrote /tmp/silicon-regions.json");
