// Screenshots of the remaining shipped features that live inside normal screens (not interrupts):
// the brand-awareness meter + region-standing tags (Market) and the research doctrines (Research).
//   npm run shots:stage && node scripts/shoot-extras.mjs
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const PORT = Number(process.env.SHOTS_PORT || 5261);
const EXE = process.env.SHOTS_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const outDir = resolve(root, ".newfeat-shots");
await mkdir(outDir, { recursive: true });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon" };
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

const save = JSON.parse((await readFile("/tmp/silicon-stage.json")).toString());
save.unlockedRegions = ["home", "asia", "europe"];
save.regionLoyalty = { asia: 62, europe: -34 };
save.brandAwareness = 58;
save.researchPoints = 240;
for (const k of ["pendingStrike", "pendingRivalry", "pendingEureka", "pendingCommunityAsk", "pendingEarnings", "pendingAwards", "pendingPoach", "pendingChoice", "pendingStaffMoment", "pendingRegionalEvent"]) save[k] = null;
save.ready = [];
save.lastActive = Date.now();
const staged = JSON.stringify(save);

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((v) => {
  localStorage.setItem("silicon.save.v1", v);
  localStorage.setItem("silicon.settings", JSON.stringify({ theme: "light", sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
}, staged);
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(2600);
for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(150); }
await p.click('button[aria-label="Pause"]', { timeout: 4000 }).catch(() => {});

const goNav = async (label) => { await p.evaluate((l) => { const b = [...document.querySelectorAll(".bnav__item")].find((el) => el.querySelector(".bnav__label")?.textContent?.trim() === l); b?.click(); }, label); await p.waitForTimeout(1000); };
const scrollToText = async (re) => { await p.evaluate((rs) => { const rx = new RegExp(rs, "i"); const el = [...document.querySelectorAll("h2,h3,.ds-section__title,.rd__fork-tag,.mkt__region-tag--up")].find((e) => rx.test(e.textContent || "")); el?.scrollIntoView({ block: "center" }); }, re.source); await p.waitForTimeout(500); };
const shot = async (n) => { await p.screenshot({ path: resolve(outDir, `${n}.png`) }); console.log("shot", n); };

// 1) Brand awareness meter (Market → Standing, default).
await goNav("Market");
await scrollToText(/Brand awareness/);
await shot("50-brand-meter");

// 2) Region standing tags (Market → Demand → global markets list).
await p.evaluate(() => { const b = [...document.querySelectorAll(".mkt__subtab")].find((x) => /demand/i.test(x.textContent || "")); b?.click(); });
await p.waitForTimeout(800);
await p.evaluate(() => { const el = [...document.querySelectorAll(".mkt__region--open")].find((e) => /asia/i.test(e.textContent || "")) || document.querySelector(".mkt__region-list"); el?.scrollIntoView({ block: "center" }); });
await p.waitForTimeout(500);
await shot("51-region-standing");

// 3) Research doctrines (Research tab → a fork "Pick one" group).
await goNav("Research");
await p.evaluate(() => { const el = document.querySelector(".rd__project--fork"); el?.scrollIntoView({ block: "center" }); });
await p.waitForTimeout(600);
await shot("52-doctrines");

await browser.close();
server.close();
console.log("done");
