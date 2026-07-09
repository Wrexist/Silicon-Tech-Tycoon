// Self-contained review screenshots of the regional-event interrupt. Serves ./dist in-process, stages
// the base save (/tmp/silicon-stage.json) expanded into Asia with a pending event, and captures both a
// positive (boom) and a negative (tariff) card so the tone treatment is visible.
//   npm run shots:stage && node scripts/shoot-regional.mjs
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const PORT = Number(process.env.SHOTS_PORT || 5251);
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

const baseSave = JSON.parse((await readFile("/tmp/silicon-stage.json")).toString());
const EVENT = (kind) => ({ week: baseSave.week, regionId: "asia", kind, cost: 7_200_000, loyaltyRespond: kind === "boom" ? 34 : 6, loyaltyIgnore: kind === "boom" ? 8 : -26 });

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
async function shoot(kind, tag) {
  const save = JSON.parse(JSON.stringify(baseSave));
  save.unlockedRegions = ["home", "asia"];
  save.pendingRegionalEvent = EVENT(kind);
  save.regionLoyalty = { asia: kind === "boom" ? 22 : -14 };
  for (const k of ["pendingStrike", "pendingRivalry", "pendingEureka", "pendingCommunityAsk", "pendingEarnings", "pendingAwards", "pendingPoach", "pendingChoice", "pendingStaffMoment"]) save[k] = null;
  save.ready = [];
  save.lastActive = Date.now();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((v) => {
    localStorage.setItem("silicon.save.v1", v);
    localStorage.setItem("silicon.settings", JSON.stringify({ theme: "light", sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
  }, JSON.stringify(save));
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(150); }
  await p.waitForSelector(".rge__card", { timeout: 6000 }).catch(() => console.log("!! regional card not found:", kind));
  await p.waitForTimeout(400);
  await p.screenshot({ path: resolve(outDir, `${tag}.png`) });
  console.log("shot", tag);
  await ctx.close();
}
await shoot("boom", "40-regional-boom");
await shoot("tariff", "41-regional-tariff");
await browser.close();
server.close();
console.log("done");
