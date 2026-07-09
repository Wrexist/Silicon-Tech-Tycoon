// Refreshed App Store screenshot set (v1.1.0) — self-contained: serves ./dist in-process (no vite
// preview needed), stages the LAVISH showcase save, captures the hero factory + office and the key
// features, and composes each into the premium tilted-titanium marketing frame (dark gradient,
// two-tone headline, iPhone frame, wordmark). Output: .newfeat-shots/store/NN-*.png at 1284×2778.
//   npm run build && npm run shots:stage:showcase && node scripts/shots-refresh.mjs
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const PORT = Number(process.env.SHOTS_PORT || 5311);
const EXE = process.env.SHOTS_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SIZE = { w: 1284, h: 2778 };
const rawDir = resolve(root, ".newfeat-shots", "store-raw");
const outDir = resolve(root, ".newfeat-shots", "store");
await mkdir(rawDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
const indexFile = resolve(distDir, "index.html");
const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    const candidate = p === "/" ? indexFile : resolve(distDir, "." + normalize(p));
    if (!candidate.startsWith(distDir)) { res.writeHead(403); return res.end(); }
    let file = candidate, body;
    try { body = await readFile(candidate); } catch { file = indexFile; body = await readFile(indexFile); }
    res.writeHead(200, { "content-type": MIME[extname(file)] || "text/html" });
    res.end(body);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(PORT, r));
const URL = `http://localhost:${PORT}`;

const baseSave = JSON.parse((await readFile("/tmp/silicon-showcase.json")).toString());
const overlays = JSON.parse((await readFile("/tmp/silicon-showcase-overlays.json")).toString());
const withMut = (mut) => { const s = structuredClone(baseSave); s.lastActive = Date.now(); mut?.(s); return JSON.stringify(s); };
const PENDINGS = ["pendingAwards", "pendingChoice", "pendingCommunityAsk", "pendingEarnings", "pendingEureka", "pendingLicenseOffer", "pendingPoach", "pendingRegionalEvent", "pendingRivalry", "pendingSideOrder", "pendingStaffMoment", "pendingStrike"];
// Quiet a save for a clean SCREEN shot. The base keeps "Aurora Air" mid-build (an animated line) and
// the sim ticks a week or two during the load window before it's paused — so on a plain screen the
// build finishes and the "Ready to launch" popup pops, OR a fresh opportunistic card (rival strike,
// eureka, …) fires over the screen. calm() clears the build shelf, drops every queued interrupt, and
// pushes lastInterruptWeek far ahead so the interrupt BUDGET (week − lastInterruptWeek ≥ minGap)
// suppresses any new card those load-window ticks would raise. Frames that want a specific overlay
// re-set it AFTER calling calm().
const calm = (s) => { s.building = []; s.ready = []; s.lastInterruptWeek = (s.week ?? 0) + 500; for (const k of PENDINGS) if (k in s) s[k] = null; };
// Factory mode is a full-screen takeover, so it keeps its live build (the order card + rolling belts)
// but still suppresses stray interrupts that would otherwise queue behind it.
const quiet = (s) => { s.lastInterruptWeek = (s.week ?? 0) + 500; for (const k of PENDINGS) if (k in s) s[k] = null; };
// Dismiss the Ready-to-launch popup if one is showing (belt-and-suspenders; the sim is paused by now).
const dismissLaunch = async (p) => { for (const sel of [".rtl__later", ".rtl__scrim", ".rtl__close"]) { await p.click(sel, { timeout: 700 }).catch(() => {}); } await p.waitForTimeout(150); };

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });

async function page(saveJson) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await ctx.addInitScript((v) => {
    localStorage.setItem("silicon.save.v1", v);
    localStorage.setItem("silicon.settings", JSON.stringify({ theme: "dark", sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
  }, saveJson);
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2800);
  await p.addStyleTag({ content: ".hq__camhint{display:none!important}" }).catch(() => {});
  await p.click('.ds-sheet button:has-text("Continue")', { timeout: 2000 }).catch(() => {});
  for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.click('button[aria-label="Pause"]', { timeout: 4000 }).catch(() => {});
  return { ctx, p };
}
const tab = async (p, label) => {
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.evaluate((l) => { [...document.querySelectorAll(".bnav__item")].find((e) => e.querySelector(".bnav__label")?.textContent?.trim() === l)?.click(); }, label);
  await p.waitForTimeout(1100);
};
const subtab = async (p, n) => { await p.click(`button[role="tab"]:has-text("${n}")`, { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(700); };
const openFactory = async (p) => {
  await tab(p, "Office");
  await p.evaluate(() => { [...document.querySelectorAll(".worldtabs__tab")].find((b) => /Factory/.test(b.textContent || ""))?.click(); });
  await p.waitForTimeout(900);
  await p.click('button[aria-label="Open factory mode"]', { timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(900);
  for (let i = 0; i < 5; i++) { const b = await p.$(".dtut__btn--primary"); if (!b) break; await b.click().catch(() => {}); await p.waitForTimeout(300); }
  await p.waitForTimeout(3600); // let the 3D line spin up + items travel
};

const FRAMES = [
  { raw: "factory", head: 'Build the <span class="ac">line</span>', hue: 28,
    sub: "Lay conveyor, place and upgrade machines, and watch a real 3D production floor run your builds.",
    mut: quiet,
    shoot: async (p) => { await openFactory(p); await p.evaluate(() => window.scrollTo(0, 0)); } },
  { raw: "office", head: 'Garage to <span class="ac">global empire</span>', hue: 200,
    sub: "Grow your studio in real-time 3D and deck it out with premium desks, a lounge and greenery.",
    mut: calm,
    shoot: async (p) => { await tab(p, "Office"); await p.waitForTimeout(2600); await p.evaluate(() => window.scrollTo(0, 0)); } },
  { raw: "design", head: 'Design every <span class="ac">detail</span>', hue: 212,
    sub: "Pick the chip, display, camera, finish and colour — rendered live in 3D as you build.",
    mut: calm,
    shoot: async (p) => { await tab(p, "Design"); await dismissLaunch(p); for (let r = 0; r < 5; r++) { const u = await p.$$('button[aria-label="Higher tier"]'); for (const b of u) await b.click({ timeout: 1200 }).catch(() => {}); } await subtab(p, "Style"); await p.click('button:has-text("View back")', { timeout: 3000 }).catch(() => {}); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400); } },
  { raw: "market", head: 'Race rivals to <span class="ac">#1</span>', hue: 280,
    sub: "A dozen rival companies with real strategies. Climb the live leaderboard past every one.",
    mut: calm,
    shoot: async (p) => { await tab(p, "Market"); await dismissLaunch(p); await p.evaluate(() => document.querySelector(".mkt__board")?.scrollIntoView({ block: "center" })).catch(() => {}); await p.waitForTimeout(400); } },
  { raw: "research", head: 'Research on your <span class="ac">terms</span>', hue: 190,
    sub: "Breakthroughs develop over time on a live ring — queue your next projects and let it run.",
    mut: calm,
    shoot: async (p) => { await tab(p, "Research"); await p.evaluate(() => document.querySelector(".rd__active")?.scrollIntoView({ block: "center" })).catch(() => {}); await p.waitForTimeout(500); } },
  { raw: "awards", head: 'Win the <span class="ac">industry</span>', hue: 44,
    sub: "Every year the Silicon Awards judge every launch. Sweep Device, Design and Value.",
    mut: (s) => { calm(s); s.pendingAwards = overlays.awards; },
    shoot: async (p) => { await p.waitForTimeout(1600); } },
  { raw: "strike", head: 'Answer every <span class="ac">rival</span>', hue: 344,
    sub: "When a rival attacks your category, duel their device and choose your counter.",
    mut: (s) => { calm(s); s.pendingStrike = overlays.strike; s.rivalReleases = [...(s.rivalReleases || []), overlays.rivalRelease]; },
    shoot: async (p) => { await p.waitForTimeout(1600); } },
  { raw: "global", head: 'Take it <span class="ac">global</span>', hue: 168,
    sub: "License new regions, each with its own taste — then hold your standing through regional events.",
    mut: calm,
    shoot: async (p) => { await tab(p, "Market"); await subtab(p, "Demand"); await p.evaluate(() => document.querySelector(".mkt__region-list")?.scrollIntoView({ block: "center" })).catch(() => {}); await p.waitForTimeout(400); } },
  { raw: "premium", head: 'Premium. <span class="ac">Complete.</span> Yours.', hue: 222,
    sub: "$8.99 once. No ads, no loot boxes, no nags. A whole tech empire in your pocket — offline.",
    mut: calm,
    shoot: async (p) => { await tab(p, "Office"); await p.waitForTimeout(2400); await p.evaluate(() => window.scrollTo(0, 0)); } },
];

for (const fr of FRAMES) {
  const { ctx, p } = await page(withMut(fr.mut));
  try {
    await fr.shoot(p);
    await p.addStyleTag({ content: "*,*::before,*::after{animation-duration:1ms!important;animation-delay:-1ms!important;transition-duration:1ms!important;transition-delay:0ms!important}" }).catch(() => {});
    await p.waitForTimeout(450);
    await p.screenshot({ path: resolve(rawDir, `${fr.raw}.png`), clip: { x: 0, y: 0, width: 390, height: 844 } });
    console.log("captured", fr.raw);
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ---- compose into the marketing frame (identical to shots-store.mjs) ----
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
  console.log("wrote", `.newfeat-shots/store/${String(i).padStart(2, "0")}-${fr.raw}.png`);
  i++;
}
await browser.close();
server.close();
console.log(`done. ${FRAMES.length} frames at ${SIZE.w}×${SIZE.h}.`);
