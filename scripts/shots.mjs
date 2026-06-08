// App Store screenshot generator — stages a rich late-game save, captures the five hero screens,
// and composes each into a branded, finished marketing frame (headline + screenshot + wordmark).
// Output: app-store-screenshots/<size>/NN-screen.png at the exact App Store pixel dimensions.
//
//   npm run dev                 # serve the app (default http://localhost:5173)
//   node scripts/shots.mjs      # writes app-store-screenshots/6.7/*.png
//
// One-time: `npm i -D playwright && npx playwright install chromium`.
// Override the URL with: SHOTS_URL=http://localhost:5199 node scripts/shots.mjs
import { mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.env.SHOTS_URL || "http://localhost:5173";
const KEY = "silicon.save.v1";

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { console.error("Playwright not found:\n  npm i -D playwright && npx playwright install chromium"); process.exit(1); }

// Target device: logical points × DPR = required App Store pixels. 6.7\" = 1290×2796.
const SIZE = { name: "6.7", w: 1290, h: 2796 };
const rawDir = resolve(root, ".shots-raw");
const outDir = resolve(root, "app-store-screenshots", SIZE.name);
await mkdir(rawDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const FRAMES = [
  { raw: "design",   head: 'Design every <span class="ac">detail</span>',     sub: "Pick the chip, display, camera, finish & colour — rendered live." },
  { raw: "launch",   head: 'Time the <span class="ac">market</span>',          sub: "Read demand, price it right, and land the hit." },
  { raw: "market",   head: 'Race rivals to <span class="ac">#1</span>',        sub: "Climb past every competitor to the top of the industry." },
  { raw: "hq",       head: 'Garage to <span class="ac">global empire</span>',  sub: "Watch your studio grow in real-time 3D." },
  { raw: "research", head: 'Own the <span class="ac">frontier</span>',         sub: "Research the tech that powers your next breakthrough." },
];

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });

// ---------- 1. Harvest a valid save, then stage a rich late-game state ----------
const a = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pa = await a.newPage();
await pa.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await pa.waitForTimeout(1500);
const found = await pa.$('button:has-text("Found Silicon")');
if (found) { await found.click(); await pa.waitForTimeout(2200); }
for (let i = 0; i < 10; i++) { const sk = await pa.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await pa.waitForTimeout(300); }
await pa.waitForTimeout(6000);
const save = await pa.evaluate((k) => localStorage.getItem(k), KEY);
await a.close();
if (!save) { console.error("Could not harvest a save — is the dev server running?"); process.exit(1); }

const s = JSON.parse(save);
Object.assign(s, {
  companyName: "Silicon", era: 3, reputation: 80, fans: 320000,
  cumulativeRevenue: 66_000_000_000, cash: 9_000_000_000, week: 88,
  researched: { chip: 5, display: 5, battery: 5, materials: 4, software: 4, camera: 4 },
});
const staged = JSON.stringify(s);

// ---------- 2. Capture the five hero screens ----------
const b = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await b.addInitScript((v) => localStorage.setItem("silicon.save.v1", v), staged);
const p = await b.newPage();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(2600);
await p.click('button[aria-label="Pause"]', { timeout: 5000 }).catch(() => {}); // freeze state

const tab = async (n) => { await p.click(`button:has-text("${n}")`, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(1200); };
const subtab = async (n) => { await p.click(`button[role="tab"]:has-text("${n}")`, { timeout: 6000 }).catch(() => {}); await p.waitForTimeout(600); };
const top = async () => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300); };
const toCard = async (sel) => { await p.evaluate((q) => { const el = document.querySelector(q); if (el) el.scrollIntoView({ block: "start" }); window.scrollBy(0, -96); }, sel).catch(() => {}); await p.waitForTimeout(500); };
const shot = async (n) => { await p.screenshot({ path: resolve(rawDir, `${n}.png`) }); };

// Design — max the device, vivid blue polymer, triple camera, viewed from the back
await tab("Design");
for (let r = 0; r < 5; r++) { const ups = await p.$$('button[aria-label="Higher tier"]'); for (const u of ups) await u.click({ timeout: 2500 }).catch(() => {}); await p.waitForTimeout(40); }
await subtab("Style");
await p.click('button:has-text("Polymer")', { timeout: 4000 }).catch(() => {}); await p.waitForTimeout(300);
const sw = await p.$$(".lab__swatch"); if (sw[3]) await sw[3].click().catch(() => {}); await p.waitForTimeout(300);
await subtab("Camera");
await p.click('button[aria-label="More lenses"]', { timeout: 4000 }).catch(() => {}); await p.waitForTimeout(250);
await subtab("Style");
await p.click('button:has-text("View back")', { timeout: 4000 }).catch(() => {}); await p.waitForTimeout(500);
await top(); await shot("design");

// Launch — set a sensible price, then frame the stats + verdict pane
await subtab("Launch");
await p.click('button:has-text("Suggest")', { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(2400);
await toCard(".lab__pane"); await shot("launch");

// Market — the industry leaderboard
await tab("Market"); await toCard(".mkt__board"); await shot("market");
// HQ — the real-time 3D office
await tab("HQ"); await p.waitForTimeout(800); await top(); await shot("hq");
// R&D — the era roadmap
await tab("R&D"); await top(); await shot("research");
await b.close();

// ---------- 3. Compose each capture into a branded App Store frame ----------
const icon = (await readFile(resolve(root, "resources/icon.png"))).toString("base64");
const html = (shot, head, sub) => `<!doctype html><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}html,body{width:${SIZE.w}px;height:${SIZE.h}px}
body{font-family:"Liberation Sans","DejaVu Sans",Arial,sans-serif;color:#fff;position:relative;overflow:hidden;
 background:radial-gradient(95% 55% at 50% -6%,rgba(96,165,250,.30),rgba(96,165,250,0) 58%),
  radial-gradient(80% 50% at 50% 118%,rgba(99,102,241,.20),transparent 62%),
  linear-gradient(180deg,#0c0e13 0%,#0f1115 58%,#090b0f 100%)}
.wrap{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;padding:175px 90px 0}
.head{font-size:106px;font-weight:800;letter-spacing:-.035em;line-height:1;text-align:center}.head .ac{color:#60a5fa}
.sub{margin-top:40px;font-size:43px;font-weight:500;color:rgba(255,255,255,.56);text-align:center;letter-spacing:-.012em;line-height:1.25;max-width:1000px}
.shot{margin-top:104px;width:892px;border-radius:56px;overflow:hidden;border:1.5px solid rgba(255,255,255,.10);
 box-shadow:0 70px 150px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.04),0 0 120px rgba(59,130,246,.10)}
.shot img{display:block;width:100%}
.foot{position:absolute;bottom:92px;left:0;right:0;display:flex;gap:26px;align-items:center;justify-content:center}
.foot img{width:62px;height:62px;border-radius:15px;box-shadow:0 6px 20px rgba(0,0,0,.5)}
.foot span{font-size:39px;font-weight:700;letter-spacing:-.01em;color:rgba(255,255,255,.82)}
</style><div class="wrap"><div class="head">${head}</div><div class="sub">${sub}</div>
<div class="shot"><img src="data:image/png;base64,${shot}"/></div>
<div class="foot"><img src="data:image/png;base64,${icon}"/><span>Silicon: Tech Tycoon</span></div></div>`;

const c = await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h }, deviceScaleFactor: 1 });
const fp = await c.newPage();
let i = 1;
for (const fr of FRAMES) {
  const shotB64 = (await readFile(resolve(rawDir, `${fr.raw}.png`))).toString("base64");
  await fp.setContent(html(shotB64, fr.head, fr.sub), { waitUntil: "networkidle" });
  await fp.waitForTimeout(250);
  const out = resolve(outDir, `${String(i).padStart(2, "0")}-${fr.raw}.png`);
  await fp.screenshot({ path: out });
  console.log("wrote", `app-store-screenshots/${SIZE.name}/${String(i).padStart(2, "0")}-${fr.raw}.png`);
  i++;
}
await browser.close();
await rm(rawDir, { recursive: true, force: true });
console.log(`done — ${FRAMES.length} frames at ${SIZE.w}×${SIZE.h}.`);
