// Self-contained review screenshots of the arch-rival / nemesis system (serves ./dist in-process, no
// separate preview server). Captures the "Rivalry declared" reveal, the leaderboard Swords marker, and
// the rivalry banner in the rival profile.  node scripts/shoot-nemesis.mjs
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const PORT = Number(process.env.SHOTS_PORT || 5221);
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

const save = JSON.parse((await readFile("/tmp/silicon-nemesis.json")).toString());
const foeName = (save.competitors.find((c) => c.id === save.nemesis?.rivalId) || {}).name || "";
save.lastActive = Date.now();
const staged = JSON.stringify(save);
console.log("nemesis foe:", foeName);

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

// 1) The "Rivalry declared" reveal (pendingRivalry shows it on load).
await p.waitForSelector(".rvd", { timeout: 6000 }).catch(() => console.log("!! rivalry overlay not found"));
await shot("13-rivalry-declared");
await p.click('.rvd button', { timeout: 3000 }).catch(() => p.keyboard.press("Escape").catch(() => {}));
await p.waitForTimeout(700);
await p.click('button[aria-label="Pause"]', { timeout: 4000 }).catch(() => {});

// 2) Market → Standing: the leaderboard with the Swords marker on the arch-rival.
await p.evaluate(() => { const b = [...document.querySelectorAll(".bnav__item")].find((el) => el.querySelector(".bnav__label")?.textContent?.trim() === "Market"); b?.click(); });
await p.waitForTimeout(1200);
await p.evaluate(() => { const b = [...document.querySelectorAll(".mkt__subtab")].find((x) => /standing/i.test(x.textContent || "")); b?.click(); });
await p.waitForTimeout(900);
await scrollTo(".mkt__board-nemesis");
await shot("14-nemesis-leaderboard");

// 3) Market → Demand: open the arch-rival's profile → the rivalry banner (heat + head-to-head).
await p.evaluate(() => { const b = [...document.querySelectorAll(".mkt__subtab")].find((x) => /demand/i.test(x.textContent || "")); b?.click(); });
await p.waitForTimeout(900);
{
  const cards = await p.$$(".mkt__rival--btn");
  let done = false;
  for (const card of cards) {
    const txt = (await card.innerText()).trim();
    if (foeName && txt.includes(foeName)) {
      await card.click().catch(() => {});
      await p.waitForTimeout(800);
      if (await p.$(".rprof__rivalry")) { await scrollTo(".rprof__rivalry"); await shot("15-nemesis-profile"); done = true; }
      break;
    }
  }
  if (!done) {
    // Fallback: click the first rival card and hope it's the nemesis (staging makes it competitors[1]).
    if (cards[0]) { await cards[0].click().catch(() => {}); await p.waitForTimeout(800); if (await p.$(".rprof__rivalry")) { await scrollTo(".rprof__rivalry"); await shot("15-nemesis-profile"); done = true; } }
    if (!done) console.log("!! nemesis profile banner not found");
  }
}

await browser.close();
server.close();
console.log("done");
