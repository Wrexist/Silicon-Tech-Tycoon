// Stage a save that SURFACES the arch-rival / nemesis system for review screenshots:
//   • a standing nemesis (heat "bitter", a 4–2 head-to-head record) → the rivalry banner in the
//     rival profile + the Swords marker on the leaderboard / stock rows
//   • a just-declared rivalry (pendingRivalry) → the full-screen "Rivalry declared" reveal on load
//   esbuild scripts/stage-nemesis.mjs --bundle --platform=node --format=cjs --outfile=scripts/.nemesis.cjs && node scripts/.nemesis.cjs
import { writeFileSync } from "node:fs";
import {
  newGame, placeFurniture, hireStaff, startBuild, launchReady,
  advanceOneWeek, buildWeeksFor, upgradeFacility, recommendedRun, productStats,
} from "../src/state/gameState.ts";
import { demoFloor } from "../src/engine/factoryFloor.ts";
import { rivalDoctrine } from "../src/engine/competitors.ts";
import { priceGuidance } from "../src/engine/market.ts";
import { dollars, toDollars } from "../src/engine/money.ts";

let s = { ...newGame(7), designBudgetEnabled: false }; // screenshot harness: raw builds, not the design-budget cap (feature #1)
s = { ...s, onboarded: true, tutorialDone: true, factoryFloor: demoFloor(), companyName: "Silicon", cash: dollars(6_000_000_000), era: 3,
  reputation: 84, researched: { chip: 6, display: 6, battery: 5, materials: 5, software: 4, camera: 5 },
  cumulativeRevenue: dollars(140_000_000_000) };
for (let i = 0; i < 3; i++) { const n = upgradeFacility(s); if (n !== s) s = n; }
for (const [type, c, r] of [["desk", 0, 0], ["desk", 3, 0], ["desk", 6, 0], ["plantTall", 8, 0], ["serverRack", 8, 7]]) {
  const n = placeFurniture(s, type, c, r, 0); if (n !== s) s = n;
}
for (const [role, skill, name] of [["engineer", 6, "Mara"], ["designer", 6, "Lena"], ["marketer", 5, "Cole"]]) {
  const n = hireStaff(s, role, skill, name); if (n !== s) s = n;
}
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
  for (let w = 0; w < 4; w++) s = advanceOneWeek(s);
}

// The arch-rival: elevate a well-known rival with a bitter, in-progress feud + a just-declared reveal.
const foe = s.competitors[1] ?? s.competitors[0];
const doctrine = rivalDoctrine(foe.id);
s = { ...s,
  reputation: Math.max(s.reputation, 84), fans: Math.max(s.fans, 260_000),
  nemesis: { rivalId: foe.id, sinceWeek: Math.max(1, s.week - 60), heat: 68, peakHeat: 74, playerWins: 4, rivalWins: 2, lastClashWeek: s.week - 1 },
  pendingRivalry: { rivalId: foe.id, rivalName: foe.name, doctrine },
  pendingStrike: null, pendingChoice: null, pendingPoach: null, pendingAwards: null,
  pendingLicenseOffer: null, pendingSideOrder: null, eventChain: null, ready: [], building: [],
  lastStrikeWeek: s.week, nextEventWeek: s.week + 99, lastActive: Date.now(),
};

console.error(`staged nemesis: foe=${foe.name} (${doctrine}), heat 68, record 4-2, competitors ${s.competitors.length}`);
writeFileSync("/tmp/silicon-nemesis.json", JSON.stringify(s));
console.error("wrote /tmp/silicon-nemesis.json");
