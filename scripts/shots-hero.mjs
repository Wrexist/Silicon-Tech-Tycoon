// Premium App Store screenshots with a 2.5D / 3D hero treatment: the capture sits inside a titanium
// iPhone tilted in real perspective, on an ambient-lit stage with floating glass "live" chips that
// pop forward of the device (parallax depth), a reflective floor and glow orbs — so each frame reads
// as immersive and alive, not a flat mockup. Output: app-store-screenshots/<size>/NN-screen.png.
//
//   npm run build && npm run shots:stage          # → /tmp/silicon-stage.json
//   SHOTS_SAVE=/tmp/silicon-stage.json node scripts/shots-hero.mjs
import { mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.env.SHOTS_URL || "http://localhost:5199";
const EXE = process.env.SHOTS_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SIZE = { name: "6.7", w: 1284, h: 2778 };
const rawDir = resolve(root, ".shots-raw");
const outDir = resolve(root, "app-store-screenshots", SIZE.name);
await mkdir(rawDir, { recursive: true });
await mkdir(outDir, { recursive: true });

// Inline SVG glyphs (no emoji — LOCKED rule; lucide isn't available in the compose context).
const I = {
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4ZM5 4H3v2a3 3 0 0 0 3 3M19 4h2v2a3 3 0 0 1-3 3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3 6.6 7.2.8-5.3 4.9 1.4 7L12 18.6 5.7 21.3l1.4-7L1.8 9.4 9 8.6Z"/></svg>',
  cpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>',
};

// raw = which screen to capture · head/sub = marketing copy (no real brand names) · tilt = perspective
// direction · chips = floating "live" glass chips (the 2.5D pop). accent tints the glow per frame.
// Chip slots straddle the device's left/right edges (the "breaking the bezel" look): an upper chip
// over the header band and a lower chip over mid-content — both kept WELL above the bottom nav.
const UP_L = { x: -372, y: -360, z: 95 }, UP_R = { x: 372, y: -360, z: 95 };
const LO_L = { x: -372, y: 250, z: 80 }, LO_R = { x: 372, y: 250, z: 80 };
const FRAMES = [
  { raw: "design", tilt: -1, accent: "#34d399",
    head: 'Design the <span class="ac">future</span>', sub: "Craft every chip, screen and camera — rendered live as you build.",
    chips: [ { ...UP_L, tone: "g", icon: I.check, big: "94", small: "/100 fit" }, { ...LO_R, tone: "d", icon: I.cpu, big: "Striking", small: "design language" } ] },
  { raw: "launch", tilt: 1, accent: "#60a5fa",
    head: 'Time the <span class="ac">market</span>', sub: "Read demand, nail the price, and land the hit.",
    chips: [ { ...UP_R, tone: "b", icon: I.star, big: "It's a hit!", small: "critics agree" }, { ...LO_L, tone: "g", icon: I.up, big: "+$2.4M", small: "week one" } ] },
  { raw: "hq", tilt: -1, accent: "#818cf8",
    head: 'Garage to <span class="ac">empire</span>', sub: "Watch your studio grow — a living 3D headquarters.",
    chips: [ { ...UP_L, tone: "i", icon: I.spark, big: "Growth Era", small: "unlocked" }, { ...LO_R, tone: "b", icon: I.up, big: "Team of 7", small: "and hiring" } ] },
  { raw: "market", tilt: 1, accent: "#60a5fa",
    head: 'Race to <span class="ac">#1</span>', sub: "Climb past every rival to the top of the industry.",
    chips: [ { ...UP_R, tone: "b", icon: I.trophy, big: "#1 of 7", small: "in the industry" }, { ...LO_L, tone: "g", icon: I.up, big: "$2.7B", small: "valuation" } ] },
  { raw: "research", tilt: -1, accent: "#fb923c",
    head: 'Own the <span class="ac">frontier</span>', sub: "Research the tech that powers your next breakthrough.",
    chips: [ { ...UP_L, tone: "o", icon: I.spark, big: "13 unlocks", small: "ready now" } ] },
];

let staged = (await readFile(process.env.SHOTS_SAVE || "/tmp/silicon-stage.json")).toString();
{ const s = JSON.parse(staged); s.lastActive = Date.now(); staged = JSON.stringify(s); }

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });

// ---------- 1. Capture the raw hero screens (dark theme, hi-DPI) ----------
const b = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await b.addInitScript((v) => {
  localStorage.setItem("silicon.save.v1", v);
  localStorage.setItem("silicon.settings", JSON.stringify({ theme: "dark", sound: true, haptics: true, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
}, staged);
const p = await b.newPage();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(2800);
await p.addStyleTag({ content: ".hq__camhint{display:none!important}" }).catch(() => {});
await p.click('.ds-sheet button:has-text("Continue")', { timeout: 2500 }).catch(() => {});
for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(220); }
await p.click('button[aria-label="Pause"]', { timeout: 5000 }).catch(() => {});
await p.waitForTimeout(400);

const tab = async (label) => {
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.evaluate((l) => { [...document.querySelectorAll(".bnav__item")].find((el) => el.querySelector(".bnav__label")?.textContent?.trim() === l)?.click(); }, label);
  await p.waitForTimeout(1500);
};
const shot = async (n) => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300); await p.screenshot({ path: resolve(rawDir, `${n}.png`) }); };

await tab("Design");
// Max the device + premium finish so the hero render reads flagship.
for (let r = 0; r < 5; r++) { const ups = await p.$$('button[aria-label="Higher tier"]'); for (const u of ups) await u.click({ timeout: 1500 }).catch(() => {}); await p.waitForTimeout(30); }
await shot("design");
// Launch step — the pricing decision ("time the market, nail the price"). DOM-click the tab, then
// scroll the price slider + "Buyers expect" band into view so the frame shows the actual decision.
await p.evaluate(() => { [...document.querySelectorAll('.lab__tab, [role="tab"]')].find((e) => /launch/i.test(e.textContent || ""))?.click(); });
await p.waitForTimeout(900);
// Price into the MIDDLE of the "Buyers expect" band so the frame shows a healthy positive margin
// (maxed tiers raise unit cost, so the low default price would otherwise read as a heavy loss).
const band = await p.evaluate(() => {
  const meta = document.querySelector(".lab__price-meta");
  const m = meta && meta.textContent.match(/Buyers expect\s*\$?([\d,]+)\D+\$?([\d,]+)/);
  return m ? [Number(m[1].replace(/,/g, "")), Number(m[2].replace(/,/g, ""))] : null;
});
if (band) {
  const target = Math.round(((band[0] + band[1]) / 2) / 10) * 10;
  await p.$eval('input[aria-label="Price"]', (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, target).catch(() => {});
  await p.waitForTimeout(400);
}
await p.evaluate(() => { const el = document.querySelector(".lab__price-display") || document.querySelector(".lab__price-meta"); if (el) el.scrollIntoView({ block: "center" }); window.scrollBy(0, -40); });
await p.waitForTimeout(500); await p.screenshot({ path: resolve(rawDir, "launch.png") });
await tab("Office"); await p.waitForTimeout(900); await shot("hq");
await tab("Market"); await p.waitForTimeout(500); await shot("market");
await tab("Research"); await p.waitForTimeout(500); await shot("research");
await b.close();

// ---------- 2. Compose each capture into the 2.5D hero frame ----------
const icon = (await readFile(resolve(root, "resources/icon.png"))).toString("base64");
const TONE = { g: "#34d399", b: "#60a5fa", i: "#818cf8", d: "#34d399", o: "#fb923c" };

const html = (shotB64, fr) => {
  const ry = 16 * fr.tilt;
  const chips = fr.chips.map((c) => {
    const col = TONE[c.tone] || "#60a5fa";
    return `<div class="chip" style="transform:translate3d(${c.x}px,${c.y}px,${c.z}px)">
      <span class="chip__ic" style="color:${col}">${c.icon}</span>
      <span class="chip__tx"><b>${c.big}</b><i>${c.small}</i></span>
    </div>`;
  }).join("");
  return `<!doctype html><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}html,body{width:${SIZE.w}px;height:${SIZE.h}px}
body{font-family:"Liberation Sans","DejaVu Sans",Arial,sans-serif;color:#fff;position:relative;overflow:hidden;
 background:
  radial-gradient(60% 32% at ${fr.tilt < 0 ? 28 : 72}% 30%, ${fr.accent}33, transparent 70%),
  radial-gradient(120% 60% at 50% -8%, rgba(96,165,250,.30), transparent 60%),
  radial-gradient(90% 50% at 50% 118%, rgba(99,102,241,.20), transparent 64%),
  radial-gradient(140% 100% at 50% 50%, transparent 52%, rgba(0,0,0,.6) 100%),
  linear-gradient(180deg,#0b0d12 0%,#0f1218 56%,#06080d 100%)}
/* ambient floating glow orbs (life behind the device) */
.orb{position:absolute;border-radius:50%;filter:blur(80px);opacity:.5}
.orb.a{width:560px;height:560px;left:-120px;top:520px;background:${fr.accent}}
.orb.b{width:480px;height:480px;right:-130px;top:1500px;background:#6366f1}
.orb.c{width:360px;height:360px;left:42%;top:2050px;background:#3b82f6;opacity:.35}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:78px 78px;mask:radial-gradient(80% 55% at 50% 46%,#000,transparent 78%);opacity:.5}
.wrap{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;padding:150px 80px 0;z-index:2}
.head{font-size:112px;font-weight:800;letter-spacing:-.04em;line-height:.95;text-align:center;text-shadow:0 6px 50px rgba(0,0,0,.55)}
.head .ac{background:linear-gradient(180deg,#fff, ${fr.accent});-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{margin-top:36px;font-size:42px;font-weight:500;color:rgba(255,255,255,.62);text-align:center;letter-spacing:-.014em;line-height:1.22;max-width:980px}

.scene{position:relative;margin-top:90px;width:100%;display:flex;justify-content:center;perspective:2600px;perspective-origin:50% 38%}
.tilt{position:relative;transform-style:preserve-3d;transform:rotateX(5deg) rotateY(${ry}deg)}
/* soft elliptical glow the device stands on */
.tilt::after{content:"";position:absolute;left:50%;bottom:-70px;transform:translateX(-50%) translateZ(-60px);
 width:720px;height:150px;border-radius:50%;background:radial-gradient(50% 50% at 50% 50%, ${fr.accent}44, transparent 70%);filter:blur(10px)}

.device{position:relative;width:800px;border-radius:122px;padding:14px;transform-style:preserve-3d;
 background:linear-gradient(150deg,#54585f 0%,#23262c 16%,#16181d 42%,#1c1f25 64%,#0d0e12 100%);
 box-shadow:
  ${-ry * 4}px 110px 180px rgba(0,0,0,.7),
  0 30px 70px rgba(0,0,0,.55),
  0 0 170px ${fr.accent}22,
  inset 0 0 0 2px rgba(255,255,255,.05),
  inset 0 3px 4px rgba(255,255,255,.22),
  inset 0 -3px 5px rgba(0,0,0,.5)}
.device::after{content:"";position:absolute;right:-6px;top:500px;width:7px;height:138px;border-radius:6px;background:linear-gradient(270deg,#2a2d33,#0b0c0f)}
.vol{position:absolute;left:-6px;width:7px;border-radius:6px;background:linear-gradient(90deg,#2a2d33,#0b0c0f)}
.vol.a{top:290px;height:62px}.vol.b{top:388px;height:112px}.vol.c{top:520px;height:112px}
.screen{position:relative;border-radius:108px;overflow:hidden;background:#0f1115;box-shadow:inset 0 0 0 3px rgba(0,0,0,.85),inset 0 0 22px rgba(0,0,0,.45)}
.statusbar{position:relative;height:90px;background:#0f1115}
.statusbar .time{position:absolute;left:72px;top:29px;font-size:30px;font-weight:600;color:#fff}
.statusbar .glyphs{position:absolute;right:68px;top:33px;display:flex;align-items:center;gap:12px}
.bars{display:flex;align-items:flex-end;gap:5px;height:26px}.bars i{width:7px;background:#fff;border-radius:2px}
.bars i:nth-child(1){height:9px}.bars i:nth-child(2){height:15px}.bars i:nth-child(3){height:21px}.bars i:nth-child(4){height:26px}
.batt{width:47px;height:25px;border:3px solid rgba(255,255,255,.85);border-radius:7px;padding:3px}.batt i{display:block;height:100%;width:78%;background:#fff;border-radius:3px}
.island{position:absolute;top:25px;left:50%;transform:translateX(-50%);width:232px;height:49px;background:#000;border-radius:26px;z-index:4}
.island .cam{position:absolute;right:30px;top:50%;transform:translateY(-50%);width:19px;height:19px;border-radius:50%;background:radial-gradient(40% 40% at 38% 34%,#26405f,#05070b 70%)}
.screen img{display:block;width:100%}
/* sheen sweep across the glass */
.sheen{position:absolute;inset:0;border-radius:108px;background:linear-gradient(${fr.tilt < 0 ? 115 : 65}deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,0) 26%, rgba(255,255,255,0) 72%, rgba(255,255,255,.05) 100%);pointer-events:none;z-index:5}

/* floating glass "live" chips — popped forward of the device (the 2.5D parallax) */
.chip{position:absolute;top:42%;left:50%;margin-left:-150px;display:flex;align-items:center;gap:18px;
 padding:22px 30px;border-radius:30px;background:rgba(20,24,33,.62);
 border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(14px);
 box-shadow:0 40px 80px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.04),inset 0 1px 0 rgba(255,255,255,.12)}
.chip__ic{width:46px;height:46px;flex-shrink:0;display:inline-flex}.chip__ic svg{width:100%;height:100%}
.chip__tx{display:flex;flex-direction:column;line-height:1.05}
.chip__tx b{font-size:42px;font-weight:800;letter-spacing:-.02em}
.chip__tx i{font-size:27px;font-style:normal;font-weight:600;color:rgba(255,255,255,.55);margin-top:4px}

.foot{position:absolute;bottom:86px;left:0;right:0;display:flex;gap:26px;align-items:center;justify-content:center;z-index:3}
.foot img{width:66px;height:66px;border-radius:17px;box-shadow:0 6px 20px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.06)}
.foot span{font-size:40px;font-weight:700;letter-spacing:-.01em;color:rgba(255,255,255,.88)}
</style>
<i class="orb a"></i><i class="orb b"></i><i class="orb c"></i><div class="grid"></div>
<div class="wrap"><div class="head">${fr.head}</div><div class="sub">${fr.sub}</div>
 <div class="scene"><div class="tilt">
  <div class="device"><i class="vol a"></i><i class="vol b"></i><i class="vol c"></i>
   <div class="screen">
    <div class="statusbar"><span class="time">9:41</span><div class="island"><span class="cam"></span></div>
     <div class="glyphs"><div class="bars"><i></i><i></i><i></i><i></i></div><div class="batt"><i></i></div></div></div>
    <img src="data:image/png;base64,${shotB64}"/>
    <div class="sheen"></div>
   </div>
  </div>
  ${chips}
 </div></div>
</div>
<div class="foot"><img src="data:image/png;base64,${icon}"/><span>Silicon: Tech Tycoon</span></div>`;
};

const c = await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h }, deviceScaleFactor: 1 });
const fp = await c.newPage();
let i = 1;
for (const fr of FRAMES) {
  const shotB64 = (await readFile(resolve(rawDir, `${fr.raw}.png`))).toString("base64");
  await fp.setContent(html(shotB64, fr), { waitUntil: "networkidle" });
  await fp.waitForTimeout(300);
  const name = `${String(i).padStart(2, "0")}-${fr.raw}.png`;
  await fp.screenshot({ path: resolve(outDir, name) });
  console.log("wrote", `app-store-screenshots/${SIZE.name}/${name}`);
  i++;
}
await browser.close();
await rm(rawDir, { recursive: true, force: true });
console.log(`done — ${FRAMES.length} hero frames at ${SIZE.w}×${SIZE.h}.`);
