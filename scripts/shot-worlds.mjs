// Capture the 3D office + factory from the staged save, for
// before/after comparison of the immersion pass. Adapted from scripts/shot-factory.mjs.
//   node scripts/shot-worlds.mjs <outdir> <tag>            (THEME=dark for the dark look)
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const outDir = process.argv[2] || ".world-shots";
const tag = process.argv[3] || "before";
const theme = process.env.THEME === "dark" ? "dark" : "light";
const URL = "http://127.0.0.1:5199";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
await mkdir(outDir, { recursive: true });

let staged = (await readFile("/tmp/silicon-stage.json")).toString();
{
  const sv = JSON.parse(staged);
  sv.lastActive = Date.now();
  // Clear any pending interrupt popups and push events far out so the capture shows the WORLD.
  for (const k of Object.keys(sv)) if (k.startsWith("pending")) sv[k] = null;
  sv.nextEventWeek = 9999;
  // Stamp the shared interrupt budget so no opportunistic card (strike/eureka/…) fires during the
  // few weeks that may tick before the capture pauses the sim.
  sv.lastInterruptWeek = sv.week;
  sv.lastStrikeWeek = sv.week;
  staged = JSON.stringify(sv);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(({ v, theme }) => {
  localStorage.setItem("silicon.save.v1", v);
  localStorage.setItem("silicon.settings", JSON.stringify({ theme, sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
}, { v: staged, theme });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(2600);
await p.click('.ds-sheet button:has-text("Continue")', { timeout: 2500 }).catch(() => {});
// Pause the sim FIRST so no interrupt fires mid-capture, then clear coach marks.
await p.click('button[aria-label="Pause"]', { timeout: 3000 }).catch(() => {});
for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(250); }

/** Defensively dismiss any full-screen interrupt card that slipped through before a shot. */
async function dismissInterrupts() {
  for (const label of ["Hold the line", "Bank it", "Not now", "Skip", "Dismiss", "Later", "Decline"]) {
    const b = await p.$(`button:has-text("${label}")`);
    if (b) { await b.click().catch(() => {}); await p.waitForTimeout(400); }
  }
}

// Office tab → 3D office scene.
await p.evaluate(() => {
  const btn = [...document.querySelectorAll(".bnav__item")].find((el) => el.querySelector(".bnav__label")?.textContent?.trim() === "Office");
  btn?.click();
});
await p.waitForTimeout(4500); // let the lazy Garage3D chunk load + settle
await dismissInterrupts();
await p.screenshot({ path: resolve(outDir, `office-${tag}.png`) });
console.log(`shot office-${tag}`);

// Factory view → open the 3D floor.
await p.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").trim() === "Factory" && !x.closest(".bnav"));
  b?.click();
});
await p.waitForTimeout(1200);
await p.click('button[aria-label="Open factory mode"]', { timeout: 6000 }).catch(() => {});
for (let i = 0; i < 5; i++) {
  const btn = await p.$(".dtut__btn--primary");
  if (!btn) break;
  await btn.click().catch(() => {});
  await p.waitForTimeout(300);
}
await p.waitForTimeout(3500); // let the line spin up + items travel
await dismissInterrupts();
await p.screenshot({ path: resolve(outDir, `factory-${tag}.png`) });
console.log(`shot factory-${tag}`);

await browser.close();
console.log("ERRORS " + JSON.stringify(errors));
