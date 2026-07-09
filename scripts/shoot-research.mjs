// Screenshots of the timed-research progress ring on the Research screen (light + dark). Stages the
// base save with an in-progress research, navigates to Research, and captures the hero ring.
//   npm run shots:stage && node scripts/shoot-research.mjs
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const PORT = Number(process.env.SHOTS_PORT || 5271);
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

const base = JSON.parse((await readFile("/tmp/silicon-stage.json")).toString());
base.activeResearch = {
  kind: "project", ref: "brandStudio", name: "Brand Studio",
  blurb: "Every launch gets more hype.", rpCost: 66,
  startWeek: base.week - 2, totalWeeks: 4, // → 50%, 2 wk left, "Testing"
};
base.researchQueue = [
  { kind: "tier", ref: "chip", tierLevel: 3, name: "QuantumCore Q1", blurb: "A stronger chip tier.", rpCost: 48, totalWeeks: 2 },
  { kind: "project", ref: "loyaltyProgram", name: "Loyalty Program", blurb: "Fan base decays 50% more slowly.", rpCost: 80, totalWeeks: 3 },
];
base.researchPoints = 180;
for (const k of ["pendingStrike", "pendingRivalry", "pendingEureka", "pendingCommunityAsk", "pendingEarnings", "pendingAwards", "pendingPoach", "pendingChoice", "pendingStaffMoment", "pendingRegionalEvent"]) base[k] = null;
base.ready = [];
base.lastActive = Date.now();

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
async function shoot(theme, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((v) => { localStorage.setItem("silicon.save.v1", v); }, JSON.stringify(base));
  await ctx.addInitScript((t) => {
    localStorage.setItem("silicon.settings", JSON.stringify({ theme: t, sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
  }, theme);
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(150); }
  await p.click('button[aria-label="Pause"]', { timeout: 4000 }).catch(() => {});
  await p.evaluate(() => { const b = [...document.querySelectorAll(".bnav__item")].find((el) => el.querySelector(".bnav__label")?.textContent?.trim() === "Research"); b?.click(); });
  await p.waitForTimeout(1000);
  await p.evaluate(() => document.querySelector(".rd__active")?.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(700);
  await p.screenshot({ path: resolve(outDir, `${tag}.png`) });
  console.log("shot", tag);
  await ctx.close();
}
await shoot("light", "60-research-ring-light");
await shoot("dark", "61-research-ring-dark");
await browser.close();
server.close();
console.log("done");
