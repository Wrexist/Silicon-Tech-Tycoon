// Self-contained review-screenshot runner: serves ./dist from an in-process http server (no separate
// vite/preview process to compete for memory) and drives Playwright over it. One Node process, one
// Chromium. Usage: SHOTS_SAVE=/tmp/x.json SHOTS_SCRIPT=regions node scripts/shoot-standalone.mjs
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const PORT = Number(process.env.SHOTS_PORT || 5219);
const EXE = process.env.SHOTS_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SAVE = process.env.SHOTS_SAVE || "/tmp/silicon-regions.json";
const outDir = resolve(root, ".newfeat-shots");
await mkdir(outDir, { recursive: true });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon" };
const indexFile = resolve(distDir, "index.html");
const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    const candidate = p === "/" ? indexFile : resolve(distDir, "." + normalize(p));
    if (!candidate.startsWith(distDir)) { res.writeHead(403); return res.end(); }
    let file = candidate;
    let body;
    try { body = await readFile(candidate); }
    catch { file = indexFile; body = await readFile(indexFile); } // SPA fallback
    res.writeHead(200, { "content-type": MIME[extname(file)] || "text/html" });
    res.end(body);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(PORT, r));
const URL = `http://localhost:${PORT}`;
console.log("serving dist at", URL);

let staged = (await readFile(SAVE)).toString();
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

await scrollTo(".mkt__reach");
await shot("10-regions");
await scrollTo(".mkt__region:last-child");
await shot("11-regions-licence");
await p.evaluate(() => { const btn = [...document.querySelectorAll(".mkt__region-foot button")].find((x) => /buy licence/i.test(x.textContent || "")); btn?.click(); });
await p.waitForTimeout(900);
await shot("12-regions-celebration");

await browser.close();
server.close();
console.log("done");
