// Self-contained review screenshots of controlling-stake takeovers. Serves ./dist in-process, stages
// the rich base save (/tmp/silicon-stage.json from `npm run shots:stage`) with two rival holdings —
// a CONTROLLING stake in Pomelo and a BOARD SEAT in Quantyx — then captures the rival profile
// (badges + board intel) and the trade sheet (stake runway + hostile-takeover button).
//   npm run shots:stage && node scripts/shoot-takeover.mjs
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const PORT = Number(process.env.SHOTS_PORT || 5231);
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
// Pomelo float 13M → 7.2M ≈ 55% = controlling; Quantyx float 4.1M → 0.6M ≈ 14.6% = board seat only.
save.holdings = { ...(save.holdings || {}), pomelo: 7_200_000, quantyx: 600_000 };
// Clear any staged full-screen interrupt so the trade sheet is what we capture.
for (const k of ["pendingStrike", "pendingRivalry", "pendingEureka", "pendingCommunityAsk", "pendingEarnings", "pendingAwards", "pendingPoach", "pendingChoice", "pendingSideOrder", "pendingLicenseOffer"]) save[k] = null;
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

const shot = async (n) => { await p.waitForTimeout(350); await p.screenshot({ path: resolve(outDir, `${n}.png`) }); console.log("shot", n); };
const scrollTo = async (sel) => { await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), sel).catch(() => {}); await p.waitForTimeout(400); };

// Market → Standing (holds the stock exchange, which lists every rival with a Trade button).
await p.evaluate(() => { const b = [...document.querySelectorAll(".bnav__item")].find((el) => el.querySelector(".bnav__label")?.textContent?.trim() === "Market"); b?.click(); });
await p.waitForTimeout(1000);
await p.evaluate(() => { const b = [...document.querySelectorAll(".mkt__subtab")].find((x) => /standing/i.test(x.textContent || "")); b?.click(); });
await p.waitForTimeout(800);

async function openTrade(name, tag) {
  const ok = await p.evaluate((n) => {
    const btn = [...document.querySelectorAll(".mkt__stock-btn")].find((b) => (b.getAttribute("aria-label") || "").includes(n));
    if (!btn) return false;
    btn.scrollIntoView({ block: "center" }); btn.click(); return true;
  }, name);
  if (!ok) { console.log("!! trade button not found:", name); return false; }
  await p.waitForTimeout(700);
  await scrollTo(".trade__stake");
  await shot(`${tag}-trade`);
  await p.keyboard.press("Escape").catch(() => {});
  await p.waitForTimeout(500);
  return true;
}

await openTrade("Pomelo", "20-control");
await openTrade("Quantyx", "21-boardseat");

await browser.close();
server.close();
console.log("done");
