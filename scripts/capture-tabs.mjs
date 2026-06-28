// Raw tab screenshots for review (NOT marketing frames). Loads a staged save into an iPhone-sized
// viewport, walks every primary tab + Settings, and writes a clean full-screen PNG per screen.
//   npm run build && npm run preview -- --port 5199 &
//   SHOTS_SAVE=/tmp/silicon-stage.json node scripts/capture-tabs.mjs
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.env.SHOTS_URL || "http://localhost:5199";
const EXE = process.env.SHOTS_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const outDir = resolve(root, ".tab-shots");
await mkdir(outDir, { recursive: true });

let staged = (await readFile(process.env.SHOTS_SAVE)).toString();
{ const sv = JSON.parse(staged); sv.lastActive = Date.now(); staged = JSON.stringify(sv); }

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((v) => {
  localStorage.setItem("silicon.save.v1", v);
  localStorage.setItem("silicon.settings", JSON.stringify({ theme: "light", sound: true, haptics: true, garage3d: true, decorateTutorialSeen: true }));
}, staged);
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(2800);
await p.addStyleTag({ content: ".hq__camhint{display:none!important}" }).catch(() => {});
await p.click('.ds-sheet button:has-text("Continue")', { timeout: 2500 }).catch(() => {});
for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(250); }
await p.click('button[aria-label="Pause"]', { timeout: 5000 }).catch(() => {});
await p.waitForTimeout(400);

const tab = async (label) => {
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.evaluate((l) => {
    const btn = [...document.querySelectorAll(".bnav__item")].find((el) => el.querySelector(".bnav__label")?.textContent?.trim() === l);
    btn?.click();
  }, label);
  await p.waitForTimeout(1500);
};
const shot = async (n) => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300); await p.screenshot({ path: resolve(outDir, `${n}.png`) }); console.log("shot", n); };

await tab("Office"); await shot("1-office");
await tab("Design"); await shot("2-design");
await tab("Research"); await shot("3-research");
await tab("Market"); await shot("4-market");
await tab("Finance"); await shot("5-finance");

// Settings (gear in the HUD)
await p.click('button[aria-label="Settings"], button[aria-label="Open settings"]', { timeout: 4000 }).catch(async () => {
  await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /settings/i.test(x.getAttribute("aria-label") || "")); b?.click(); });
});
await p.waitForTimeout(900); await shot("6-settings");

// Close settings, then open the Progress hub from the HUD trophy.
await p.click('.ds-sheet-scrim', { timeout: 3000 }).catch(() => {});
await p.keyboard.press("Escape").catch(() => {});
await p.waitForTimeout(600);
await p.click('button[aria-label="Progress, achievements and challenges"]', { timeout: 4000 }).catch(() => {});
await p.waitForTimeout(900); await shot("7-progress");

// Drill into a sub-sheet from the hub (verifies sheet-on-sheet works).
await p.click('button[aria-label="View achievements"]', { timeout: 4000 }).catch(() => {});
await p.waitForTimeout(900); await shot("8-achievements");

await browser.close();
console.log("done");
