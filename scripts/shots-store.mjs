// Immersive App Store screenshots (10): each live screen captured from a staged save and composed
// into a premium, 3D-perspective marketing frame (tilted titanium device, depth glow, headline).
// Showcases the signature features incl. the new depth systems (finance, people, living market,
// doctrines). Output: app-store-screenshots/store/NN-*.png at 1284×2778 (6.7" App Store slot).
//
//   npm run build && npm run preview -- --port 5199 &
//   npm run shots:stage
//   node scripts/shots-store.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.env.SHOTS_URL || "http://localhost:5199";
const EXE = process.env.SHOTS_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SIZE = { w: 1284, h: 2778 };
const rawDir = resolve(root, ".store-raw");
const outDir = resolve(root, "app-store-screenshots", "store");
await mkdir(rawDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const stagePath = "/tmp/silicon-stage.json";
let baseSave;
try {
  baseSave = JSON.parse((await readFile(stagePath)).toString());
} catch {
  console.error(`Staging save not found at ${stagePath}. Run: npm run shots:stage`);
  process.exit(1);
}
const withMut = (mut) => { const s = structuredClone(baseSave); s.lastActive = Date.now(); mut?.(s); return JSON.stringify(s); };

// A loan to show the financing card's debt state + slider; a doctrine already chosen; a wearable.
const addLoan = (s) => { s.loans = [{ id: "loan-1", principal: 25_000_000, balance: 24_000_000, weeklyPayment: 513_000, ratePerWeek: 0.0025, termWeeks: 52, takenWeek: 20 }]; };
const setPoach = (s) => {
  const v = (s.staff || []).find((m) => m.id !== "s0");
  if (v) s.pendingPoach = { staffId: v.id, staffName: v.name, rivalId: "pomelo", rivalName: "Pomelo", retainCost: 3_600_000, week: s.week };
};
const pickDoctrine = (s) => { s.completedProjects = [...new Set([...(s.completedProjects || []), "perfHouse"])]; };

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });

async function page(saveJson) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await ctx.addInitScript((v) => {
    localStorage.setItem("silicon.save.v1", v);
    localStorage.setItem("silicon.settings", JSON.stringify({ theme: "dark", sound: true, haptics: true, garage3d: true, decorateTutorialSeen: true }));
  }, saveJson);
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.addStyleTag({ content: ".hq__camhint{display:none!important}" }).catch(() => {});
  await p.click('.ds-sheet button:has-text("Continue")', { timeout: 2200 }).catch(() => {});
  for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(220); }
  await p.click('button[aria-label="Pause"]', { timeout: 4000 }).catch(() => {});
  // Both style injections below are load-bearing for capture correctness (not best-effort like the
  // dismissals above) — let them throw so a broken injection fails the run instead of silently
  // shipping an overlapping or mid-transition asset.
  await p.addStyleTag({ content: "*,*::before,*::after{animation-duration:1ms!important;animation-delay:-1ms!important;transition-duration:1ms!important;transition-delay:0ms!important}" });
  await p.waitForTimeout(300);
  return { ctx, p };
}
const tab = async (p, label) => {
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.evaluate((l) => { [...document.querySelectorAll(".bnav__item")].find((e) => e.querySelector(".bnav__label")?.textContent?.trim() === l)?.click(); }, label);
  await p.waitForTimeout(1200);
};
const subtab = async (p, n) => { await p.click(`button[role="tab"]:has-text("${n}")`, { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(700); };
const top = async (p) => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(250); };

// ---- the 10 frames: capture each raw screen ----
const FRAMES = [
  { raw: "design", head: 'Design every <span class="ac">detail</span>', sub: "Pick the chip, display, camera, finish and colour, rendered live in 3D.", hue: 212,
    shoot: async (p) => { await tab(p, "Design"); for (let r = 0; r < 5; r++) { const u = await p.$$('button[aria-label="Higher tier"]'); for (const b of u) await b.click({ timeout: 1500 }).catch(() => {}); } await subtab(p, "Style"); await p.click('button:has-text("Polymer")', { timeout: 3000 }).catch(() => {}); const sw = await p.$$(".lab__swatch"); if (sw[3]) await sw[3].click().catch(() => {}); await subtab(p, "Camera"); await p.click('button[aria-label="More lenses"]', { timeout: 3000 }).catch(() => {}); await subtab(p, "Style"); await p.click('button:has-text("View back")', { timeout: 3000 }).catch(() => {}); await top(p); } },
  { raw: "market", head: 'Read the <span class="ac">market</span>', sub: "Every category wants something different. Position for the buyer you can win.", hue: 256,
    shoot: async (p) => { await tab(p, "Design"); for (let r = 0; r < 5; r++) { const u = await p.$$('button[aria-label="Higher tier"]'); for (const b of u) await b.click({ timeout: 1200 }).catch(() => {}); } await subtab(p, "Launch"); await p.evaluate(() => { const el = document.querySelector(".wiz__segs, .lab__pane"); el?.scrollIntoView({ block: "start" }); window.scrollBy(0, -80); }).catch(() => {}); await p.waitForTimeout(400); } },
  { raw: "leaderboard", head: 'Race rivals to <span class="ac">#1</span>', sub: "Ten rival companies with real strategies. Climb past every one.", hue: 280,
    shoot: async (p) => { await tab(p, "Market"); await p.evaluate(() => document.querySelector(".mkt__board")?.scrollIntoView({ block: "start" })).catch(() => {}); await p.waitForTimeout(300); } },
  { raw: "hq", head: 'Garage to <span class="ac">global empire</span>', sub: "Watch your studio grow in real-time 3D as you scale.", hue: 200,
    shoot: async (p) => { await tab(p, "Office"); await p.waitForTimeout(700); await top(p); } },
  { raw: "decorate", head: 'Make it <span class="ac">yours</span>', sub: "Design your studio. Drag in 60+ pieces of parametric furniture.", hue: 168,
    shoot: async (p) => { await tab(p, "Office"); await p.waitForTimeout(500); await top(p); await p.evaluate(() => { const el = document.querySelector(".hq__decorate"); if (!(el instanceof HTMLElement)) throw new Error("Missing .hq__decorate — cannot open the studio editor"); el.click(); }); await p.waitForTimeout(2200); } },
  { raw: "research", head: 'Choose your <span class="ac">doctrine</span>', sub: "Mutually-exclusive research forks shape a company that plays like no other.", hue: 188,
    shoot: async (p) => { await tab(p, "Research"); await p.evaluate(() => [...document.querySelectorAll(".ds-card")].find((c) => /Performance House|Reliability House/.test(c.textContent || ""))?.scrollIntoView({ block: "center" })).catch(() => {}); await p.waitForTimeout(400); } },
  { raw: "finance", head: 'Master your <span class="ac">finances</span>', sub: "Borrow to fund a bet, invest in morale. Runway is a decision, not a timer.", hue: 150, mut: addLoan,
    shoot: async (p) => { await tab(p, "Finance"); await p.evaluate(() => document.querySelector(".co__borrow, .co__loan-list")?.closest(".ds-card")?.scrollIntoView({ block: "center" })).catch(() => {}); await p.waitForTimeout(400); } },
  { raw: "people", head: 'Keep your <span class="ac">best people</span>', sub: "Rivals poach your talent. Match the offer, or watch them walk.", hue: 16, mut: setPoach,
    shoot: async (p) => { await tab(p, "Office"); await p.evaluate(() => document.querySelector(".hq__choice")?.scrollIntoView({ block: "center" })).catch(() => {}); await p.waitForTimeout(400); } },
  { raw: "team", head: 'Grow a <span class="ac">real team</span>', sub: "Hire, mentor and lead. A senior anchor levels up the juniors beside them.", hue: 130,
    shoot: async (p) => { await tab(p, "Finance"); await p.evaluate(() => [...document.querySelectorAll(".ds-card")].find((c) => /Team morale/.test(c.textContent || ""))?.scrollIntoView({ block: "start" })).catch(() => {}); await p.waitForTimeout(400); } },
  { raw: "premium", head: 'Premium. <span class="ac">Complete.</span> Yours.', sub: "$8.99 once. No ads, no loot boxes, no nags. A whole company in your pocket.", hue: 222,
    shoot: async (p) => { await tab(p, "Office"); await p.waitForTimeout(700); await top(p); } },
];

for (const fr of FRAMES) {
  const { ctx, p } = await page(withMut(fr.mut));
  try {
    await fr.shoot(p);
    await p.waitForTimeout(450); // let the final state fully settle before capturing
    await p.screenshot({ path: resolve(rawDir, `${fr.raw}.png`), clip: { x: 0, y: 0, width: 390, height: 844 } });
    console.log("captured", fr.raw);
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ---- compose each into the 3D marketing frame ----
const icon = (await readFile(resolve(root, "resources/icon.png"))).toString("base64");
const frameHtml = (shot, head, sub, hue) => `<!doctype html><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}html,body{width:${SIZE.w}px;height:${SIZE.h}px}
body{font-family:"Liberation Sans","DejaVu Sans",Arial,sans-serif;color:#fff;position:relative;overflow:hidden;
 background:
  radial-gradient(130% 70% at 50% -10%,hsla(${hue},85%,62%,.38),hsla(${hue},85%,62%,0) 62%),
  radial-gradient(100% 60% at 50% 120%,hsla(${(hue+40)%360},80%,55%,.26),transparent 64%),
  radial-gradient(150% 110% at 50% 50%,transparent 52%,rgba(0,0,0,.6) 100%),
  linear-gradient(180deg,#0a0c11 0%,#0e1117 56%,#06080c 100%)}
.wrap{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;padding:172px 92px 0;perspective:2400px}
.head{font-size:112px;font-weight:800;letter-spacing:-.04em;line-height:.96;text-align:center;text-shadow:0 6px 50px rgba(0,0,0,.55)}
.head .ac{color:hsl(${hue},90%,68%)}
.sub{margin-top:40px;font-size:42px;font-weight:500;color:rgba(255,255,255,.62);text-align:center;letter-spacing:-.012em;line-height:1.26;max-width:1020px}
.stage{position:relative;margin-top:104px;display:flex;justify-content:center;transform-style:preserve-3d}
.stage::after{content:"";position:absolute;left:50%;bottom:-54px;transform:translateX(-50%);width:820px;height:170px;border-radius:50%;
 background:radial-gradient(50% 50% at 50% 50%,hsla(${hue},85%,60%,.32),hsla(${hue},85%,60%,0) 70%);filter:blur(10px)}
.device{position:relative;width:860px;border-radius:132px;padding:16px;transform:rotateY(-9deg) rotateX(2.5deg);transform-style:preserve-3d;
 background:linear-gradient(150deg,#565a62 0%,#24272d 16%,#16181d 42%,#1c1f26 64%,#0d0e12 100%);
 box-shadow:-30px 60px 150px rgba(0,0,0,.7),0 26px 70px rgba(0,0,0,.55),0 0 170px hsla(${hue},85%,55%,.16),
  inset 0 0 0 2px rgba(255,255,255,.05),inset 0 3px 4px rgba(255,255,255,.22),inset 0 -3px 5px rgba(0,0,0,.5)}
.device::after{content:"";position:absolute;right:-6px;top:540px;width:7px;height:150px;border-radius:6px;background:linear-gradient(270deg,#2a2d33,#0b0c0f)}
.screen{position:relative;border-radius:118px;overflow:hidden;background:#0f1115;box-shadow:inset 0 0 0 3px rgba(0,0,0,.85)}
.statusbar{position:relative;height:96px;background:#0f1115}
.statusbar .time{position:absolute;left:78px;top:32px;font-size:32px;font-weight:600;color:#fff}
.statusbar .glyphs{position:absolute;right:74px;top:36px;display:flex;align-items:center;gap:12px}
.statusbar .bars{display:flex;align-items:flex-end;gap:5px;height:26px}.statusbar .bars i{width:7px;background:#fff;border-radius:2px}
.statusbar .bars i:nth-child(1){height:9px}.statusbar .bars i:nth-child(2){height:15px}.statusbar .bars i:nth-child(3){height:21px}.statusbar .bars i:nth-child(4){height:26px}
.statusbar .batt{width:50px;height:26px;border:3px solid rgba(255,255,255,.85);border-radius:7px;padding:3px}.statusbar .batt i{display:block;height:100%;width:80%;background:#fff;border-radius:3px}
.island{position:absolute;top:28px;left:50%;transform:translateX(-50%);width:244px;height:52px;background:#000;border-radius:28px;z-index:4}
.screen img{display:block;width:100%}
.foot{position:absolute;bottom:92px;left:0;right:0;display:flex;gap:28px;align-items:center;justify-content:center}
.foot img{width:66px;height:66px;border-radius:17px;box-shadow:0 6px 22px rgba(0,0,0,.5)}
.foot span{font-size:42px;font-weight:700;color:rgba(255,255,255,.9)}
</style><div class="wrap"><div class="head">${head}</div><div class="sub">${sub}</div>
<div class="stage"><div class="device"><div class="screen">
 <div class="statusbar"><span class="time">9:41</span><div class="island"></div>
  <div class="glyphs"><div class="bars"><i></i><i></i><i></i><i></i></div><div class="batt"><i></i></div></div></div>
 <img src="data:image/png;base64,${shot}"/>
</div></div></div>
<div class="foot"><img src="data:image/png;base64,${icon}"/><span>Silicon: Tech Tycoon</span></div></div>`;

const c = await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h }, deviceScaleFactor: 1 });
const fp = await c.newPage();
let i = 1;
for (const fr of FRAMES) {
  const b64 = (await readFile(resolve(rawDir, `${fr.raw}.png`))).toString("base64");
  await fp.setContent(frameHtml(b64, fr.head, fr.sub, fr.hue), { waitUntil: "networkidle" });
  await fp.waitForTimeout(200);
  const out = resolve(outDir, `${String(i).padStart(2, "0")}-${fr.raw}.png`);
  await fp.screenshot({ path: out });
  console.log("wrote", `app-store-screenshots/store/${String(i).padStart(2, "0")}-${fr.raw}.png`);
  i++;
}
await browser.close();
console.log(`done. ${FRAMES.length} frames at ${SIZE.w}×${SIZE.h}.`);
