// Visual audit of the Design screen — opens the Design tab on a rich save and captures each of its
// sub-tabs (Components, Style, Camera/Specs, Launch) plus the header, in light + dark.
//   node scripts/shoot-design.mjs   (writes .newfeat-shots/d-<tab>-<theme>.png)
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const PORT = Number(process.env.SHOTS_PORT || 5233);
const EXE = process.env.SHOTS_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SAVE = process.env.SHOTS_SAVE || "/tmp/silicon-awards.json"; // rich era-3 save from stage-glass-popups
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
    res.writeHead(200, { "content-type": MIME[extname(file)] || "text/html" }); res.end(body);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(PORT, r));
const URL = `http://localhost:${PORT}`;
const raw = JSON.parse((await readFile(SAVE)).toString());
raw.lastActive = Date.now();
raw.pendingAwards = null; raw.pendingStrike = null; raw.pendingRivalry = null; raw.pendingEureka = null;
const staged = JSON.stringify(raw);

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme });
  await ctx.addInitScript(([v, t]) => {
    localStorage.setItem("silicon.save.v1", v);
    localStorage.setItem("silicon.settings", JSON.stringify({ theme: t, sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
  }, [staged, theme]);
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.addStyleTag({ content: ".hq__camhint{display:none!important}" }).catch(() => {});
  // dismiss any interrupt + coach
  for (let i = 0; i < 6; i++) { const b = await p.$('.cele button, .rvd button, .eur__card--result button, .awd button, .ds-sheet button:has-text("Continue")'); if (!b) break; await b.click().catch(() => {}); await p.waitForTimeout(300); }
  for (let i = 0; i < 6; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(150); }
  await p.click('button[aria-label="Pause"]', { timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(300);

  // Open the Design tab from the bottom nav.
  await p.evaluate(() => { const b = [...document.querySelectorAll(".bnav__item")].find((el) => el.querySelector(".bnav__label")?.textContent?.trim() === "Design"); b?.click(); });
  await p.waitForTimeout(1400);
  const blur = async () => { await p.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur()); await p.waitForTimeout(120); };
  const shot = async (n) => { await blur(); await p.screenshot({ path: resolve(outDir, `d-${n}-${theme}.png`) }); console.log("shot", `d-${n}-${theme}`); };

  await shot("01-header"); // header + first (components) tab, scrolled top

  // Walk each sub-tab by its label text.
  const tabs = ["Components", "Style", "Camera", "Specs", "Launch"];
  for (const label of tabs) {
    const clicked = await p.evaluate((lab) => {
      const t = [...document.querySelectorAll(".lab__tab")].find((x) => x.textContent?.trim() === lab);
      if (t) { t.click(); return true; } return false;
    }, label);
    if (!clicked) continue;
    await p.waitForTimeout(700);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(200);
    await shot(label.toLowerCase());
    // also grab a scrolled-down view for the longer panes
    await p.evaluate(() => window.scrollTo(0, 600));
    await p.waitForTimeout(300);
    await shot(`${label.toLowerCase()}-scroll`);
  }
  await ctx.close();
}
await browser.close(); server.close();
console.log("done");
