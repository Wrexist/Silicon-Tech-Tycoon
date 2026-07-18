// Stage a save that SURFACES the eureka breakthrough for review screenshots:
//   • a pending breakthrough (pendingEureka) → the bank-or-chase decision overlay on load
//   • a mid-filled Insight meter on the Research banner (lastEurekaWeek 15 weeks back)
//   esbuild scripts/stage-eureka.mjs --bundle --platform=node --format=cjs --outfile=scripts/.eureka.cjs && node scripts/.eureka.cjs
import { writeFileSync } from "node:fs";
import {
  newGame, placeFurniture, hireStaff, assignStaff, startBuild, launchReady,
  advanceOneWeek, buildWeeksFor, upgradeFacility, recommendedRun, productStats,
} from "../src/state/gameState.ts";
import { demoFloor } from "../src/engine/factoryFloor.ts";
import { generateEureka } from "../src/engine/eureka.ts";
import { priceGuidance } from "../src/engine/market.ts";
import { dollars, toDollars } from "../src/engine/money.ts";

let s = { ...newGame(5), designBudgetEnabled: false }; // screenshot harness: raw builds, not the design-budget cap (feature #1)
s = { ...s, onboarded: true, tutorialDone: true, factoryFloor: demoFloor(), companyName: "Silicon", cash: dollars(400_000_000), era: 3,
  reputation: 82, researched: { chip: 6, display: 6, battery: 5, materials: 5, software: 4, camera: 5 }, researchPoints: 240 };
for (let i = 0; i < 3; i++) { const n = upgradeFacility(s); if (n !== s) s = n; }
for (const [type, c, r] of [["desk", 0, 0], ["desk", 3, 0], ["desk", 6, 0], ["serverRack", 8, 7], ["bookshelf", 8, 2]]) {
  const n = placeFurniture(s, type, c, r, 0); if (n !== s) s = n;
}
for (const [role, skill, name] of [["engineer", 7, "Mara"], ["engineer", 6, "Devin"], ["designer", 6, "Lena"], ["marketer", 5, "Cole"]]) {
  const n = hireStaff(s, role, skill, name); if (n !== s) s = n;
}
// Assign two engineers to R&D so the lab is active (the Insight meter needs RP output).
if (s.staff[1]) s = assignStaff(s, s.staff[1].id, "rnd");
if (s.staff[2]) s = assignStaff(s, s.staff[2].id, "rnd");

const mkPhone = (name, colorIndex) => ({
  id: `prod-${name}`, name, category: "phone",
  tiers: { chip: 6, display: 6, battery: 5, materials: 5, software: 4, camera: 5 },
  finish: "titanium", colorIndex, price: dollars(999), designTier: 3,
  camera: { count: 3, layout: "square", position: "topLeft", module: "squircle", flash: true }, notch: "island",
});
for (const base of [mkPhone("Aurora Pro", 3), mkPhone("Aurora Ultra", 1)]) {
  const fair = Math.round(toDollars(priceGuidance(productStats(s, base), "phone").fair) / 10) * 10;
  const r = startBuild(s, { ...base, price: dollars(Math.max(199, fair)) }, recommendedRun(s, base, "influencer"), "influencer");
  if (!r.ok) { console.error("build failed:", base.name, r.reason); continue; }
  s = r.state;
  for (let w = 0; w < buildWeeksFor(s) + 1; w++) s = advanceOneWeek(s);
  const ready = s.ready[s.ready.length - 1];
  if (ready) { const lr = launchReady(s, ready.id); if (lr.ok) s = lr.state; }
  for (let w = 0; w < 3; w++) s = advanceOneWeek(s);
}

// The breakthrough on the table + an Insight meter primed ~75% (last fired 15 weeks ago).
const moment = generateEureka(s.seed, s.week, s.era);
s = { ...s,
  researchPoints: Math.max(s.researchPoints, 240),
  pendingEureka: moment, lastEurekaWeek: s.week - 15,
  reputation: Math.max(s.reputation, 82), fans: Math.max(s.fans, 200_000),
  pendingStrike: null, pendingChoice: null, pendingPoach: null, pendingAwards: null, pendingRivalry: null,
  pendingLicenseOffer: null, pendingSideOrder: null, eventChain: null, ready: [], building: [],
  lastStrikeWeek: s.week, nextEventWeek: s.week + 99, lastActive: Date.now(),
};

console.error(`staged eureka: line=${moment.componentKind}, bank ${moment.bankRp}, chase ${moment.jackpotRp}/${moment.fizzleRp}, week ${s.week}, lastEureka ${s.lastEurekaWeek}`);
writeFileSync("/tmp/silicon-eureka.json", JSON.stringify(s));
console.error("wrote /tmp/silicon-eureka.json");
