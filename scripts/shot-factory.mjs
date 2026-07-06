// Scratch: capture the 3D Factory floor from a staged save (verifies the per-era machine accent).
//   npm run build && npm run preview -- --port 5199 &
//   SHOTS_SAVE=/tmp/silicon-stage-e4.json node scripts/shot-factory.mjs
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.env.SHOTS_URL || "http://localhost:5199";
const EXE = process.env.SHOTS_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const outDir = resolve(root, ".tab-shots");
await mkdir(outDir, { recursive: true });

let staged = (await readFile(process.env.SHOTS_SAVE || "/tmp/silicon-stage-e4.json")).toString();
{ const sv = JSON.parse(staged); sv.lastActive = Date.now(); staged = JSON.stringify(sv); }

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((v) => {
  localStorage.setItem("silicon.save.v1", v);
  localStorage.setItem("silicon.settings", JSON.stringify({ theme: "light", sound: true, haptics: true, garage3d: true, decorateTutorialSeen: true }));
}, staged);
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(2600);
await p.click('.ds-sheet button:has-text("Continue")', { timeout: 2500 }).catch(() => {});
for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(250); }

// Office tab → open factory mode.
await p.evaluate(() => {
  const btn = [...document.querySelectorAll(".bnav__item")].find((el) => el.querySelector(".bnav__label")?.textContent?.trim() === "Office");
  btn?.click();
});
await p.waitForTimeout(1200);
// The HQ has a segmented Office / Factory / Shop control — open the Factory view, then its floor.
await p.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").trim() === "Factory" && !x.closest(".bnav"));
  b?.click();
});
await p.waitForTimeout(1000);
await p.click('button[aria-label="Open factory mode"]', { timeout: 6000 }).catch(() => {});
await p.waitForTimeout(3500); // let the 3D line spin up + items travel
await p.screenshot({ path: resolve(outDir, "factory-era4.png") });
console.log("shot factory-era4");
await browser.close();
console.log("done");
