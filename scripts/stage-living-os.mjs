// Stage a save that SURFACES the Living OS (App Store + Security + immersive update button) for
// review screenshots. Built through the real engine so the Platform sheet reads as a thriving OS:
//   • Platform division founded, a big installed base, several OS modules built (store OPEN)
//   • a populated App Store (thousands of apps + a featured strip + commission)
//   • a security console mid-drama: real threat, some hardening, a patch READY to ship
//   • research ahead of the released version → the "Release OS x.0" update button is live
//   esbuild scripts/stage-living-os.mjs --bundle --platform=node --format=cjs --outfile=scripts/.livingos.cjs && node scripts/.livingos.cjs
import { writeFileSync } from "node:fs";
import {
  newGame, placeFurniture, hireStaff, startBuild, launchReady,
  advanceOneWeek, buildWeeksFor, upgradeFacility, recommendedRun, productStats,
  unlockPlatform, installOsFeature, setOsPhilosophy, setOsName,
} from "../src/state/gameState.ts";
import { demoFloor } from "../src/engine/factoryFloor.ts";
import { priceGuidance } from "../src/engine/market.ts";
import { dollars, toDollars } from "../src/engine/money.ts";

let s = { ...newGame(7), designBudgetEnabled: false }; // screenshot harness: raw builds, not the design-budget cap (feature #1)
s = { ...s, onboarded: true, tutorialDone: true, factoryFloor: demoFloor(), companyName: "Silicon", cash: dollars(400_000_000), era: 3,
  reputation: 82, researched: { chip: 6, display: 6, battery: 5, materials: 5, software: 4, camera: 5 } };
for (let i = 0; i < 3; i++) { const n = upgradeFacility(s); if (n !== s) s = n; }

const layout = [
  ["desk", 0, 0], ["desk", 3, 0], ["desk", 6, 0], ["desk", 0, 2], ["desk", 3, 2], ["desk", 6, 2],
  ["plantTall", 8, 0], ["bookshelf", 8, 2], ["arcade", 8, 4], ["serverRack", 8, 7],
];
for (const [type, c, r] of layout) { const n = placeFurniture(s, type, c, r, 0); if (n !== s) s = n; }
for (const [role, skill, name] of [["engineer", 6, "Mara"], ["engineer", 5, "Devin"], ["designer", 6, "Lena"], ["marketer", 5, "Cole"]]) {
  const n = hireStaff(s, role, skill, name); if (n !== s) s = n;
}

// A back-catalogue with big runs → a large installed base (drives app growth + threat + services).
const mkPhone = (name, colorIndex, designTier) => ({
  id: `prod-${name}`, name, category: "phone",
  tiers: { chip: 6, display: 6, battery: 5, materials: 5, software: 4, camera: 5 },
  finish: "titanium", colorIndex, price: dollars(999), designTier,
  camera: { count: 3, layout: "vertical", position: "topLeft", module: "squircle", flash: true }, notch: "island",
});
for (const base of [mkPhone("Aurora Pro", 3, 3), mkPhone("Aurora Ultra", 1, 3), mkPhone("Nova S", 4, 2)]) {
  const fair = Math.round(toDollars(priceGuidance(productStats(s, base), "phone").fair) / 10) * 10;
  const prod = { ...base, price: dollars(Math.max(199, fair)) };
  const r = startBuild(s, prod, recommendedRun(s, prod, "influencer"), "influencer");
  if (!r.ok) { console.error("build failed:", prod.name, r.reason); continue; }
  s = r.state;
  for (let w = 0; w < buildWeeksFor(s) + 1; w++) s = advanceOneWeek(s);
  const ready = s.ready[s.ready.length - 1];
  if (ready) { const lr = launchReady(s, ready.id); if (lr.ok) s = lr.state; }
  for (let w = 0; w < 6; w++) s = advanceOneWeek(s);
}

// Found the OS division and build it out. osVersion is deliberately BEHIND the software research
// tier (v2 vs. tier 4) so the "Release OS 4.0" update button is live.
s = unlockPlatform(s, true);
s = setOsName(s, "Nucleus");
s = { ...s, osVersion: 2, researchPoints: 9999, researched: { ...s.researched, software: 4 } };
for (const id of ["appMarket", "cloudSync", "assistant", "privacy", "wallet"]) {
  const n = installOsFeature(s, id); if (n !== s) s = n; else console.error("module not installed:", id);
}
s = setOsPhilosophy(s, "curated");

// A populated store + a security console mid-drama: real threat, modest hardening, patch READY.
s = { ...s,
  osApps: 12_840,             // → "12.8k apps"
  osThreat: 78,               // high…
  osSecurity: 15,             // …vs. thin hardening → net exposure ~63 → "Exposed" + the red warning
  lastPatchWeek: s.week - 10, // cooldown (5) elapsed → "Install security update" is live
  reputation: Math.max(s.reputation, 82), fans: Math.max(s.fans, 260_000),
  cumulativeRevenue: Math.max(s.cumulativeRevenue, 120_000_000_000),
  // Clear every pending interrupt so the capture lands on the Platform sheet, not a modal.
  pendingStrike: null, pendingChoice: null, pendingPoach: null, pendingAwards: null,
  pendingLicenseOffer: null, pendingSideOrder: null, eventChain: null, ready: [], building: [],
  lastStrikeWeek: s.week, nextEventWeek: s.week + 99, lastActive: Date.now(),
};

console.error(`staged Living OS: era ${s.era}, base installedBase via launched ${s.launched.length}, osApps ${s.osApps}, threat ${s.osThreat}, security ${s.osSecurity}, osVersion ${s.osVersion}, softwareTier ${s.researched.software}, modules ${s.osFeatures.length}`);
writeFileSync("/tmp/silicon-livingos.json", JSON.stringify(s));
console.error("wrote /tmp/silicon-livingos.json");
