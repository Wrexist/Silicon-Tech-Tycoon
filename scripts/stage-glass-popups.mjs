// Stage saves that SURFACE the popups whose gray containers just became liquid-glass wells, for
// before/after review: the Silicon Awards ceremony (pendingAwards → .awd__row tiles), a Rival Strike
// (pendingStrike → .rst__act rows + .rst__ghost), and the offline "While you were away" sheet
// (backdated lastActive → .app__offline-card tiles on the glass .ds-sheet).
//   esbuild scripts/stage-glass-popups.mjs --bundle --platform=node --format=cjs --outfile=scripts/.glasspop.cjs && node scripts/.glasspop.cjs
import { writeFileSync } from "node:fs";
import {
  newGame, placeFurniture, hireStaff, startBuild, launchReady,
  advanceOneWeek, buildWeeksFor, upgradeFacility, recommendedRun, productStats,
} from "../src/state/gameState.ts";
import { demoFloor } from "../src/engine/factoryFloor.ts";
import { priceGuidance } from "../src/engine/market.ts";
import { dollars, toDollars } from "../src/engine/money.ts";

let s = newGame(7);
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
s = { ...s, reputation: Math.max(s.reputation, 84), fans: Math.max(s.fans, 260_000),
  pendingStrike: null, pendingChoice: null, pendingPoach: null, pendingAwards: null, pendingRivalry: null,
  pendingLicenseOffer: null, pendingSideOrder: null, eventChain: null, ready: [], building: [],
  nextEventWeek: s.week + 99 };

const myProduct = s.launched[s.launched.length - 1];
const foe = s.competitors[1] ?? s.competitors[0];
const foe2 = s.competitors[2] ?? s.competitors[0];
const clean = (extra) => ({ ...s, ...extra, lastActive: Date.now() });

// 1) AWARDS — player takes Device of the Year + Value Champion; a rival takes Design of the Year.
const awards = clean({ pendingAwards: {
  year: 3, week: s.week, playerWins: 2, fieldSize: 11,
  winners: [
    { categoryId: "device", title: "Device of the Year", productName: myProduct?.name ?? "Aurora Ultra", companyName: "Silicon", byPlayer: true, score: 94, category: "phone" },
    { categoryId: "design", title: "Design of the Year", productName: "Halo X", companyName: foe.name, byPlayer: false, score: 91, category: "phone" },
    { categoryId: "value", title: "Value Champion", productName: myProduct?.name ?? "Aurora Pro", companyName: "Silicon", byPlayer: true, score: 88, category: "phone" },
  ],
} });
writeFileSync("/tmp/silicon-awards.json", JSON.stringify(awards));
console.error(`wrote /tmp/silicon-awards.json (Device+Value to player, Design to ${foe.name})`);

// 2) RIVAL STRIKE — a rival lands a device that edges out your newest phone.
const strike = clean({ pendingStrike: {
  week: s.week, rivalId: foe2.id, rivalName: foe2.name, rivalProductName: "Vega Pro", rivalOverall: 91,
  category: "phone", productId: myProduct?.id ?? "prod-Aurora Ultra", productName: myProduct?.name ?? "Aurora Ultra", playerOverall: 88,
}, lastStrikeWeek: s.week });
writeFileSync("/tmp/silicon-strike.json", JSON.stringify(strike));
console.error(`wrote /tmp/silicon-strike.json (${foe2.name} Vega Pro 91 vs ${myProduct?.name ?? "Aurora Ultra"} 88)`);

// 3) OFFLINE — backdate lastActive ~5 weeks so the boot catch-up shows the "While you were away" sheet.
const fiveWeeksMs = 5 * 7 * 24 * 3600 * 1000;
const offline = { ...s, pendingAwards: null, pendingStrike: null, lastActive: Date.now() - fiveWeeksMs };
writeFileSync("/tmp/silicon-offline.json", JSON.stringify(offline));
console.error(`wrote /tmp/silicon-offline.json (lastActive backdated 5 weeks; ${s.launched.length} launched products)`);
