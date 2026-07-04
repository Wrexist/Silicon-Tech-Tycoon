// Immersive iPad App Store screenshots (10): the same live screens as the iPhone `store/` set,
// captured from a staged save and composed into a premium, 3D-perspective marketing frame — a
// tilted aluminium iPad (uniform slim bezels, depth glow, floor glow, headline). Output:
// app-store-screenshots/ipad/NN-*.png at 2064×2752 (13" iPad portrait — the largest required iPad
// slot; App Store Connect scales it to the 12.9"/11" slots).
//
// The app is a phone-width UI (hard-capped at 540px, viewport-fixed chrome). Capturing at a wide
// iPad viewport would letterbox that column with dark gutters and detach the nav to the screen
// edges. So we capture at a 540×720 viewport — the app's *designed maximum* width, where the column
// fills edge-to-edge (no gutters, chrome aligned) at a clean 3:4 aspect — then scale that into the
// iPad's 3:4 screen full-bleed.
//
//   npm run build && npm run preview -- --port 5199 &
//   npm run shots:stage
//   node scripts/shots-ipad.mjs
import { mkdir, readFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.env.SHOTS_URL || "http://localhost:5199";
// Resolve a Chromium binary revision-agnostically: SHOTS_CHROME override → the newest
// /opt/pw-browsers/chromium-<rev>/chrome-linux/chrome → a clear error (playwright-core has no
// managed browser to fall back to). Hard-coding a revision breaks the moment Playwright bumps it.
function resolveChrome() {
  if (process.env.SHOTS_CHROME) return process.env.SHOTS_CHROME;
  const base = "/opt/pw-browsers";
  if (existsSync(base)) {
    const dir = readdirSync(base)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(a.slice(9)) - Number(b.slice(9)))
      .pop();
    const exe = dir && resolve(base, dir, "chrome-linux/chrome");
    if (exe && existsSync(exe)) return exe;
  }
  throw new Error("No Chromium found under /opt/pw-browsers — set SHOTS_CHROME=/path/to/chrome");
}
const EXE = resolveChrome();
const SIZE = { w: 2064, h: 2752 };            // 13" iPad portrait (App Store "iPad 13-inch" slot)
const CAP = { w: 540, h: 720 };               // capture viewport — app's max width, 3:4 aspect
const rawDir = resolve(root, ".ipad-raw");
const outDir = resolve(root, "app-store-screenshots", "ipad");
await mkdir(rawDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const stagePath = process.env.SHOTS_SAVE || "/tmp/silicon-stage.json";
let baseSave;
try {
  baseSave = JSON.parse((await readFile(stagePath)).toString());
} catch {
  console.error(`Staging save not found at ${stagePath}. Run: npm run shots:stage`);
  process.exit(1);
}
const withMut = (mut) => { const s = structuredClone(baseSave); s.lastActive = Date.now(); mut?.(s); return JSON.stringify(s); };

// Depth props identical to the iPhone `store/` set so the two carousels read as one campaign.
const addLoan = (s) => { s.loans = [{ id: "loan-1", principal: 25_000_000, balance: 24_000_000, weeklyPayment: 513_000, ratePerWeek: 0.0025, termWeeks: 52, takenWeek: 20 }]; };
const setPoach = (s) => {
  const v = (s.staff || []).find((m) => m.id !== "s0");
  if (v) s.pendingPoach = { staffId: v.id, staffName: v.name, rivalId: "pomelo", rivalName: "Pomelo", retainCost: 3_600_000, week: s.week };
};

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });

async function page(saveJson) {
  const ctx = await browser.newContext({ viewport: { width: CAP.w, height: CAP.h }, deviceScaleFactor: 3 });
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
  // Neutralize CSS animations/transitions so a capture can never land on a mid-flight step
  // cross-fade or card-stagger (which at 540px width overlapped two wizard steps). This mirrors
  // the app's own prefers-reduced-motion end-state — but injected as a plain <style> so it does
  // NOT trip matchMedia("prefers-reduced-motion"), leaving the WebGL 3D garage rendering normally.
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

// The 10 frames — same screens, headlines and hues as the iPhone `store/` set.
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
    shoot: async (p) => { await tab(p, "Office"); await p.waitForTimeout(500); await top(p); await p.evaluate(() => { const el = document.querySelector(".hq__decorate"); if (!(el instanceof HTMLElement)) throw new Error("Missing .hq__decorate — cannot open the studio editor"); el.click(); }); await p.waitForTimeout(2400); } },
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

// SHOTS_ONLY="decorate,hq" captures just those frames (into their real NN-*.png slot); SHOTS_LIMIT=N
// captures the first N. Both are for fast iteration; unset captures the full set.
const onlyNames = process.env.SHOTS_ONLY ? process.env.SHOTS_ONLY.split(",").map((s) => s.trim()) : null;
const limit = process.env.SHOTS_LIMIT ? Number(process.env.SHOTS_LIMIT) : FRAMES.length;
const frames = FRAMES.map((fr, idx) => ({ fr, n: idx + 1 })).filter(({ fr }, idx) => (onlyNames ? onlyNames.includes(fr.raw) : idx < limit));

for (const { fr } of frames) {
  const { ctx, p } = await page(withMut(fr.mut));
  try {
    await fr.shoot(p);
    await p.waitForTimeout(450); // let the final state fully settle before capturing
    await p.screenshot({ path: resolve(rawDir, `${fr.raw}.png`), clip: { x: 0, y: 0, width: CAP.w, height: CAP.h } });
    console.log("captured", fr.raw);
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ---- compose each into the tilted-iPad marketing frame ----
const icon = (await readFile(resolve(root, "resources/icon.png"))).toString("base64");
// Premium dark brand field → headline → the capture inside a 3D-tilted aluminium iPad (uniform slim
// bezels, front camera, depth + floor glow) → wordmark footer. The screen is 3:4 and the capture is
// 3:4, so it fills the display full-bleed with no distortion.
const frameHtml = (shot, head, sub, hue) => `<!doctype html><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}html,body{width:${SIZE.w}px;height:${SIZE.h}px}
body{font-family:"Liberation Sans","DejaVu Sans",Arial,sans-serif;color:#fff;position:relative;overflow:hidden;
 background:
  radial-gradient(120% 62% at 50% -8%,hsla(${hue},85%,62%,.36),hsla(${hue},85%,62%,0) 60%),
  radial-gradient(90% 52% at 50% 118%,hsla(${(hue + 40) % 360},80%,55%,.24),transparent 62%),
  radial-gradient(150% 108% at 50% 48%,transparent 54%,rgba(0,0,0,.6) 100%),
  linear-gradient(180deg,#0a0c11 0%,#0e1117 56%,#06080c 100%)}
.wrap{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;padding:158px 150px 0;perspective:2800px}
.head{font-size:120px;font-weight:800;letter-spacing:-.04em;line-height:.96;text-align:center;text-shadow:0 6px 54px rgba(0,0,0,.55)}
.head .ac{color:hsl(${hue},90%,68%)}
.sub{margin-top:40px;font-size:47px;font-weight:500;color:rgba(255,255,255,.62);text-align:center;letter-spacing:-.012em;line-height:1.26;max-width:1500px}
.stage{position:relative;margin-top:118px;display:flex;justify-content:center;transform-style:preserve-3d}
/* soft elliptical glow the iPad "stands" on */
.stage::after{content:"";position:absolute;left:50%;bottom:-60px;transform:translateX(-50%);width:1180px;height:210px;border-radius:50%;
 background:radial-gradient(50% 50% at 50% 50%,hsla(${hue},85%,60%,.30),hsla(${hue},85%,60%,0) 70%);filter:blur(12px)}
/* aluminium iPad body — uniform slim bezels, gentle 3D tilt */
.device{position:relative;width:1392px;border-radius:98px;padding:26px;transform:rotateY(-7deg) rotateX(2deg);transform-style:preserve-3d;
 background:linear-gradient(148deg,#5a5e66 0%,#2a2d33 15%,#191c21 42%,#20232a 64%,#0e0f13 100%);
 box-shadow:
  -46px 74px 168px rgba(0,0,0,.7),
  0 30px 84px rgba(0,0,0,.56),
  0 0 190px hsla(${hue},85%,55%,.16),
  inset 0 0 0 2px rgba(255,255,255,.05),
  inset 0 3px 5px rgba(255,255,255,.24),
  inset 0 -4px 6px rgba(0,0,0,.5)}
/* power + volume buttons on the top/side edges (subtle) */
.device::before{content:"";position:absolute;top:-6px;right:250px;width:150px;height:7px;border-radius:6px;background:linear-gradient(0deg,#2a2d33,#0b0c0f)}
.device::after{content:"";position:absolute;right:-6px;top:150px;width:7px;height:210px;border-radius:6px;background:linear-gradient(270deg,#2a2d33,#0b0c0f)}
.screen{position:relative;aspect-ratio:3/4;border-radius:64px;overflow:hidden;background:#0f1115;box-shadow:inset 0 0 0 3px rgba(0,0,0,.85),inset 0 0 30px rgba(0,0,0,.4)}
/* front camera — centred on the top bezel */
.cam{position:absolute;top:-19px;left:50%;transform:translateX(-50%);width:15px;height:15px;border-radius:50%;z-index:4;
 background:radial-gradient(42% 42% at 38% 34%,#26405f,#05070b 72%);box-shadow:0 0 4px rgba(59,130,246,.5)}
.screen img{display:block;width:100%;height:100%;object-fit:cover}
/* faint diagonal screen sheen for glass realism — kept low so content stays legible */
.screen::after{content:"";position:absolute;inset:0;pointer-events:none;
 background:linear-gradient(128deg,rgba(255,255,255,.09) 0%,rgba(255,255,255,0) 26%,rgba(255,255,255,0) 82%,rgba(255,255,255,.05) 100%)}
.foot{position:absolute;bottom:104px;left:0;right:0;display:flex;gap:30px;align-items:center;justify-content:center}
.foot img{width:74px;height:74px;border-radius:19px;box-shadow:0 6px 24px rgba(0,0,0,.5)}
.foot span{font-size:46px;font-weight:700;color:rgba(255,255,255,.9)}
</style><div class="wrap"><div class="head">${head}</div><div class="sub">${sub}</div>
<div class="stage"><div class="device"><i class="cam"></i><div class="screen">
 <img src="data:image/png;base64,${shot}"/>
</div></div></div>
<div class="foot"><img src="data:image/png;base64,${icon}"/><span>Silicon: Tech Tycoon</span></div></div>`;

const c = await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h }, deviceScaleFactor: 1 });
const fp = await c.newPage();
for (const { fr, n } of frames) {
  const nn = String(n).padStart(2, "0");
  const b64 = (await readFile(resolve(rawDir, `${fr.raw}.png`))).toString("base64");
  await fp.setContent(frameHtml(b64, fr.head, fr.sub, fr.hue), { waitUntil: "networkidle" });
  await fp.waitForTimeout(200);
  await fp.screenshot({ path: resolve(outDir, `${nn}-${fr.raw}.png`) });
  console.log("wrote", `app-store-screenshots/ipad/${nn}-${fr.raw}.png`);
}
await browser.close();
console.log(`done. ${frames.length} frames at ${SIZE.w}×${SIZE.h}.`);
