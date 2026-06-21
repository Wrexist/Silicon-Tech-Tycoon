// App Store screenshot generator — injects a rich late-game save, captures the six hero screens
// (Design · Launch · Market · HQ · Decorate · Research) in the app's DARK theme, and composes
// each into a branded marketing frame: headline + the capture inside a realistic titanium iPhone
// frame (status bar, dynamic island, side buttons, floor glow) + wordmark, on the dark/blue brand.
// Output: app-store-screenshots/<size>/NN-screen.png at the exact App Store pixel dimensions.
//
//   npm run build && npm run preview -- --port 5199   # serve the production build
//   npm run shots:stage                               # build the rich save → /tmp/silicon-stage.json
//   SHOTS_SAVE=/tmp/silicon-stage.json SHOTS_URL=http://localhost:5199 node scripts/shots.mjs
//
// Without SHOTS_SAVE it falls back to harvesting a fresh save + a thin field override.
// One-time browser: `npm i -D playwright && npx playwright install chromium` (or set SHOTS_CHROME
// to a pre-installed Chromium binary). Override the URL with SHOTS_URL.
import { mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.env.SHOTS_URL || "http://localhost:5173";
const KEY = "silicon.save.v1";

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { console.error("Playwright not found:\n  npm i -D playwright && npx playwright install chromium"); process.exit(1); }

// Resolve a Chromium binary. Prefer Playwright's own managed download; fall back to a
// pre-installed build (e.g. /opt/pw-browsers/chromium-*/chrome-linux/chrome in CI sandboxes that
// can't reach the Playwright CDN). Override with SHOTS_CHROME=/path/to/chrome.
async function resolveChrome() {
  if (process.env.SHOTS_CHROME) return process.env.SHOTS_CHROME;
  const { existsSync, readdirSync } = await import("node:fs");
  const base = "/opt/pw-browsers";
  if (existsSync(base)) {
    const dir = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
    const exe = dir && resolve(base, dir, "chrome-linux/chrome");
    if (exe && existsSync(exe)) return exe;
  }
  return undefined; // let Playwright use its managed browser
}
const executablePath = await resolveChrome();

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
  { raw: "decorate", head: 'Make it <span class="ac">yours</span>',            sub: "Design your studio — drag in 60+ pieces of furniture." },
  { raw: "research", head: 'Own the <span class="ac">frontier</span>',         sub: "Research the tech that powers your next breakthrough." },
];

const browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });

// ---------- 1. Stage a rich late-game state ----------
// Preferred: a pre-built, internally-consistent save (scripts/stage-save.mjs → SHOTS_SAVE),
// so the office, leaderboard, performance + research all read as a thriving company. Falls back
// to harvesting a fresh save + a thin field override if no staged file is supplied.
let staged;
if (process.env.SHOTS_SAVE) {
  staged = (await readFile(process.env.SHOTS_SAVE)).toString();
} else {
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
  staged = JSON.stringify(s);
}

// Stamp lastActive to "now" so the load doesn't trigger the offline "While you were away" sheet
// (which would overlay the hero screens and block tab navigation).
{ const sv = JSON.parse(staged); sv.lastActive = Date.now(); staged = JSON.stringify(sv); }

// ---------- 2. Capture the five hero screens ----------
const b = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await b.addInitScript((v) => {
  localStorage.setItem("silicon.save.v1", v);
  // Dark theme: the app's near-black/blue palette matches the marketing frame, so the whole
  // screenshot reads as one cohesive premium piece (no bright rectangle on a dark page).
  // 3D on; suppress the first-run Decorate coach so the editor frame is clean.
  localStorage.setItem("silicon.settings", JSON.stringify({ theme: "dark", sound: true, haptics: true, garage3d: true, decorateTutorialSeen: true }));
}, staged);
const p = await b.newPage();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(2600);
// The "WASD to look around" hint is a keyboard-only affordance gated to fine pointers; a headless
// browser reports a fine pointer, so hide it (it never appears on the touch/iOS target anyway).
await p.addStyleTag({ content: ".hq__camhint{display:none!important}" }).catch(() => {});
// Belt-and-suspenders: dismiss the offline recap sheet if it ever appears.
await p.click('.ds-sheet button:has-text("Continue")', { timeout: 2500 }).catch(() => {});
await p.waitForTimeout(300);
await p.click('button[aria-label="Pause"]', { timeout: 5000 }).catch(() => {}); // freeze state

// Navigate via the bottom nav by invoking the button's handler in the DOM — the Design Lab's
// fixed wizard footer can overlay the nav and intercept a normal Playwright click.
const tab = async (label) => {
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(150);
  await p.evaluate((l) => {
    const btn = [...document.querySelectorAll(".bnav__item")].find(
      (el) => el.querySelector(".bnav__label")?.textContent?.trim() === l,
    );
    btn?.click();
  }, label);
  await p.waitForTimeout(1300);
};
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

// Launch — price the maxed device at the MIDPOINT of the "Buyers expect" band so the frame shows
// a healthy positive margin in the "Fair/Good value" zone (maxing tiers raises cost, so the low
// initial fair price would otherwise read as a heavy loss).
await subtab("Launch");
await p.waitForTimeout(400);
const band = await p.evaluate(() => {
  const meta = document.querySelector(".lab__price-meta");
  const m = meta && meta.textContent.match(/Buyers expect\s*\$?([\d,]+)\D+\$?([\d,]+)/);
  if (!m) return null;
  return [Number(m[1].replace(/,/g, "")), Number(m[2].replace(/,/g, ""))];
});
if (band) {
  const target = Math.round(((band[0] + band[1]) / 2) / 10) * 10;
  await p.$eval('input[aria-label="Price"]', (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, target);
  await p.waitForTimeout(500);
}
await toCard(".lab__pane"); await shot("launch");

// Market — the industry leaderboard
await tab("Market"); await toCard(".mkt__board"); await shot("market");
// HQ — the real-time 3D office
await tab("HQ"); await p.waitForTimeout(800); await top(); await shot("hq");
// R&D — the era roadmap
await tab("R&D"); await top(); await shot("research");
// Decorate — the full-screen studio editor (the parametric furniture shop)
await tab("HQ"); await p.waitForTimeout(700); await top();
await p.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((e) => /Decorate/.test(e.textContent || ""));
  b?.click();
});
await p.waitForTimeout(2200); // let the full-screen editor mount + the 3D settle
await shot("decorate");
await b.close();

// ---------- 3. Compose each capture into a branded App Store frame ----------
const icon = (await readFile(resolve(root, "resources/icon.png"))).toString("base64");
// Compose: premium dark gradient backdrop → headline → the capture inside a realistic titanium
// iPhone frame (status bar + dynamic island + side buttons + floor glow) → wordmark footer.
const html = (shot, head, sub) => `<!doctype html><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}html,body{width:${SIZE.w}px;height:${SIZE.h}px}
body{font-family:"Liberation Sans","DejaVu Sans",Arial,sans-serif;color:#fff;position:relative;overflow:hidden;
 background:
  radial-gradient(120% 60% at 50% -8%,rgba(96,165,250,.34),rgba(96,165,250,0) 60%),
  radial-gradient(90% 50% at 50% 120%,rgba(99,102,241,.22),transparent 64%),
  radial-gradient(140% 100% at 50% 50%,transparent 55%,rgba(0,0,0,.55) 100%),
  linear-gradient(180deg,#0b0d12 0%,#0f1218 56%,#070a0f 100%)}
.wrap{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;padding:168px 90px 0}
.head{font-size:108px;font-weight:800;letter-spacing:-.038em;line-height:.98;text-align:center;
 text-shadow:0 4px 40px rgba(0,0,0,.5)}.head .ac{color:#60a5fa}
.sub{margin-top:38px;font-size:43px;font-weight:500;color:rgba(255,255,255,.58);text-align:center;letter-spacing:-.014em;line-height:1.24;max-width:1000px}

/* soft elliptical glow the device "stands" on */
.stage{position:relative;margin-top:96px;display:flex;justify-content:center}
.stage::after{content:"";position:absolute;left:50%;bottom:-46px;transform:translateX(-50%);
 width:760px;height:150px;border-radius:50%;
 background:radial-gradient(50% 50% at 50% 50%,rgba(59,130,246,.28),rgba(59,130,246,0) 70%);filter:blur(8px)}

/* titanium iPhone body */
.device{position:relative;width:838px;border-radius:128px;padding:15px;
 background:linear-gradient(150deg,#52565e 0%,#23262c 16%,#16181d 42%,#1c1f25 64%,#0d0e12 100%);
 box-shadow:
  0 90px 170px rgba(0,0,0,.66),
  0 24px 60px rgba(0,0,0,.5),
  0 0 150px rgba(59,130,246,.12),
  inset 0 0 0 2px rgba(255,255,255,.05),
  inset 0 3px 4px rgba(255,255,255,.22),
  inset 0 -3px 5px rgba(0,0,0,.5)}
/* side buttons — left: action + volume up/down · right: power */
.device::after{content:"";position:absolute;right:-6px;top:520px;width:7px;height:140px;border-radius:6px;
 background:linear-gradient(270deg,#2a2d33,#0b0c0f);box-shadow:2px 0 6px rgba(0,0,0,.4)}
.vol{position:absolute;left:-6px;width:7px;border-radius:6px;background:linear-gradient(90deg,#2a2d33,#0b0c0f);box-shadow:-2px 0 6px rgba(0,0,0,.4)}
.vol.a{top:300px;height:64px}.vol.b{top:402px;height:116px}.vol.c{top:540px;height:116px}

.screen{position:relative;border-radius:114px;overflow:hidden;background:#0f1115;
 box-shadow:inset 0 0 0 3px rgba(0,0,0,.85),inset 0 0 22px rgba(0,0,0,.45)}
.statusbar{position:relative;height:92px;background:#0f1115}
.statusbar .time{position:absolute;left:74px;top:30px;font-size:31px;font-weight:600;letter-spacing:.01em;color:#fff}
.statusbar .glyphs{position:absolute;right:70px;top:34px;display:flex;align-items:center;gap:12px}
.statusbar .bars{display:flex;align-items:flex-end;gap:5px;height:26px}
.statusbar .bars i{width:7px;background:#fff;border-radius:2px}
.statusbar .bars i:nth-child(1){height:9px}.statusbar .bars i:nth-child(2){height:15px}
.statusbar .bars i:nth-child(3){height:21px}.statusbar .bars i:nth-child(4){height:26px}
.statusbar .batt{width:48px;height:25px;border:3px solid rgba(255,255,255,.85);border-radius:7px;position:relative;padding:3px}
.statusbar .batt::after{content:"";position:absolute;right:-7px;top:50%;transform:translateY(-50%);width:4px;height:11px;border-radius:0 3px 3px 0;background:rgba(255,255,255,.85)}
.statusbar .batt i{display:block;height:100%;width:78%;background:#fff;border-radius:3px}
.island{position:absolute;top:26px;left:50%;transform:translateX(-50%);width:236px;height:50px;background:#000;border-radius:26px;z-index:4;
 box-shadow:inset 0 0 0 1px rgba(255,255,255,.04)}
.island .cam{position:absolute;right:30px;top:50%;transform:translateY(-50%);width:20px;height:20px;border-radius:50%;
 background:radial-gradient(40% 40% at 38% 34%,#26405f,#05070b 70%);box-shadow:0 0 4px rgba(59,130,246,.5)}
.screen img{display:block;width:100%}

.foot{position:absolute;bottom:88px;left:0;right:0;display:flex;gap:26px;align-items:center;justify-content:center}
.foot img{width:64px;height:64px;border-radius:16px;box-shadow:0 6px 20px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.06)}
.foot span{font-size:40px;font-weight:700;letter-spacing:-.01em;color:rgba(255,255,255,.86)}
</style><div class="wrap"><div class="head">${head}</div><div class="sub">${sub}</div>
<div class="stage"><div class="device">
 <i class="vol a"></i><i class="vol b"></i><i class="vol c"></i>
 <div class="screen">
  <div class="statusbar">
   <span class="time">9:41</span>
   <div class="island"><span class="cam"></span></div>
   <div class="glyphs"><div class="bars"><i></i><i></i><i></i><i></i></div><div class="batt"><i></i></div></div>
  </div>
  <img src="data:image/png;base64,${shot}"/>
 </div>
</div></div>
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
