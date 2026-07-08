// Review screenshots of the reworked Global markets UI (Market → Demand).
//   npx vite preview --port 5199 &
//   node scripts/.regions.cjs                 # writes /tmp/silicon-regions.json
//   node scripts/shots-regions.mjs
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.env.SHOTS_URL || "http://localhost:5199";
const EXE = process.env.SHOTS_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const outDir = resolve(root, ".newfeat-shots");
await mkdir(outDir, { recursive: true });

let staged = (await readFile("/tmp/silicon-regions.json")).toString();
{ const sv = JSON.parse(staged); sv.lastActive = Date.now(); staged = JSON.stringify(sv); }

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((v) => {
  localStorage.setItem("silicon.save.v1", v);
  localStorage.setItem("silicon.settings", JSON.stringify({ theme: "light", sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
}, staged);
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(2800);
await p.addStyleTag({ content: ".hq__camhint{display:none!important}" }).catch(() => {});
await p.click('.ds-sheet button:has-text("Continue")', { timeout: 2500 }).catch(() => {});
for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(200); }
await p.click('button[aria-label="Pause"]', { timeout: 5000 }).catch(() => {});
await p.waitForTimeout(400);

const shot = async (n) => { await p.waitForTimeout(350); await p.screenshot({ path: resolve(outDir, `${n}.png`) }); console.log("shot", n); };
const scrollTo = async (sel) => { await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), sel).catch(() => {}); await p.waitForTimeout(450); };

// Market → Demand sub-tab.
await p.evaluate(() => { const b = [...document.querySelectorAll(".bnav__item")].find((el) => el.querySelector(".bnav__label")?.textContent?.trim() === "Market"); b?.click(); });
await p.waitForTimeout(1200);
await p.evaluate(() => { const b = [...document.querySelectorAll(".mkt__subtab")].find((x) => /demand/i.test(x.textContent || "")); b?.click(); });
await p.waitForTimeout(1000);

// 1) The reach meter + top of the region list.
await scrollTo(".mkt__reach");
await shot("10-regions");

// 2) The locked-region cards (taste chips, fit read, Buy licence).
await scrollTo(".mkt__region:last-child");
await shot("11-regions-licence");

// 3) Buy a licence → the "flag planted" celebration.
await p.evaluate(() => {
  const btn = [...document.querySelectorAll(".mkt__region-foot button")].find((x) => /buy licence/i.test(x.textContent || ""));
  btn?.click();
});
await p.waitForTimeout(900);
await shot("12-regions-celebration");

await browser.close();
console.log("done");
