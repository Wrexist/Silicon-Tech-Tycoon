// Self-contained review screenshots of the eureka breakthrough (serves ./dist in-process).
//   node scripts/shoot-eureka.mjs
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const PORT = Number(process.env.SHOTS_PORT || 5223);
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

const save = JSON.parse((await readFile("/tmp/silicon-eureka.json")).toString());
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
await p.waitForTimeout(2800);
await p.addStyleTag({ content: ".hq__camhint{display:none!important}" }).catch(() => {});
for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(200); }

const shot = async (n) => { await p.waitForTimeout(350); await p.screenshot({ path: resolve(outDir, `${n}.png`) }); console.log("shot", n); };
const scrollTo = async (sel) => { await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), sel).catch(() => {}); await p.waitForTimeout(450); };

// 1) The bank-or-chase decision overlay (pendingEureka shows it on load).
await p.waitForSelector(".eur__card", { timeout: 6000 }).catch(() => console.log("!! eureka overlay not found"));
await shot("16-eureka-decision");

// 2) Chase it → the outcome reveal.
await p.click('.eur__choice--risk', { timeout: 3000 }).catch(() => {});
await p.waitForTimeout(700);
await shot("17-eureka-result");
await p.click('.eur__card--result button', { timeout: 3000 }).catch(() => p.keyboard.press("Escape").catch(() => {}));
await p.waitForTimeout(600);
await p.click('button[aria-label="Pause"]', { timeout: 4000 }).catch(() => {});

// 3) Research tab → the Insight meter on the RP banner.
await p.evaluate(() => { const b = [...document.querySelectorAll(".bnav__item")].find((el) => el.querySelector(".bnav__label")?.textContent?.trim() === "Research"); b?.click(); });
await p.waitForTimeout(1200);
await scrollTo(".rd__insight");
await shot("18-research-insight");

await browser.close();
server.close();
console.log("done");
