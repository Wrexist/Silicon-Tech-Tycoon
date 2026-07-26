// Review screenshots for the office + factory improvements (serves ./dist in-process).
//   npm run build && npm run shots:stage && node scripts/shoot-office-factory.mjs
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

const save = JSON.parse((await readFile("/tmp/silicon-stage.json")).toString());
save.lastActive = Date.now();
for (const k of Object.keys(save)) if (/^pending/.test(k)) save[k] = null;
save.interruptPace = "calm";
save.lastInterruptWeek = save.week;
const staged = JSON.stringify(save);
const theme = process.env.SHOTS_THEME || "light";

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(([v, th]) => {
  localStorage.setItem("silicon.save.v1", v);
  localStorage.setItem("silicon.settings", JSON.stringify({ theme: th, sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
  localStorage.setItem("silicon.factory.camhint", "1");
  localStorage.setItem("silicon.hint.tapteam", "1");
}, [staged, theme]);
const p = await ctx.newPage();
p.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(3200);
for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(200); }
for (const sel of ['[aria-label="Pause"]', ".hud__pause"]) { const b = await p.$(sel); if (b) { await b.click().catch(() => {}); break; } }
await p.waitForTimeout(400);

const shot = async (n) => { await p.waitForTimeout(450); await p.screenshot({ path: resolve(outDir, `${n}-${theme}.png`) }); console.log("shot", n); };

// --- OFFICE: the plain view first, with the team actually seated at their desks ---
{
  const cv = await p.$("canvas");
  const box = cv && await cv.boundingBox();
  if (box) await p.screenshot({ path: resolve(outDir, `office-staffed-${theme}.png`), clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 330) } });
  console.log("shot office-staffed");
}

// --- OFFICE: Decorate, showing the zones readout + Tidy button ---
const shopBtn = await p.$(".hq__decorate");
if (shopBtn) { await shopBtn.click(); await p.waitForTimeout(1600); }
await shot("office-zones-before");
// CLOSEUP: just the 3D scene region, at native pixels — the only way to judge desk-scale detail.
{
  const cv = await p.$("canvas");
  const box = cv && await cv.boundingBox();
  if (box) await p.screenshot({ path: resolve(outDir, `office-closeup-${theme}.png`), clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 330) } });
  // Tight crop on the desk row itself — at deviceScaleFactor 2 this is a true 2x zoom.
  if (box) await p.screenshot({ path: resolve(outDir, `office-desks-${theme}.png`), clip: { x: box.x + box.width * 0.22, y: box.y + 60, width: box.width * 0.55, height: 150 } });
  // Very tight crop on a single workstation — chair-scale detail needs a true 4x look.
  if (box) await p.screenshot({ path: resolve(outDir, `office-chair-${theme}.png`), clip: { x: box.x + box.width * 0.30, y: box.y + 62, width: box.width * 0.30, height: 105 } });
  console.log("shot office-closeup + office-desks + office-chair");
}
// Drive the in-game camera in with WASD so chair-scale detail is judged at real size, not a crop.
{
  const cv = await p.$("canvas");
  if (cv) {
    await cv.click({ position: { x: 200, y: 120 } }).catch(() => {});
    await p.keyboard.down("w");
    await p.waitForTimeout(1700);
    await p.keyboard.up("w");
    await p.waitForTimeout(700);
    const box = await cv.boundingBox();
    if (box) await p.screenshot({ path: resolve(outDir, `office-zoom-${theme}.png`), clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 360) } });
    console.log("shot office-zoom");
  }
}

// Tidy up (the wand) — free rearrange that pairs desks with amenities.
const tidyBtn = await p.$('.hqb__icon[aria-label^="Tidy up"]');
if (tidyBtn) { await tidyBtn.click().catch(() => {}); await p.waitForTimeout(1500); }
await shot("office-zones-after");

// --- FACTORY: stats panel with the layout drivers, then the build strip with Undo ---
const doneBtn = await p.$(".hqb__top-actions button:last-child");
if (doneBtn) { await doneBtn.click().catch(() => {}); await p.waitForTimeout(900); }
try { await p.locator(".worldtabs__tab", { hasText: "Factory" }).click({ timeout: 5000 }); } catch { /* already there */ }
await p.waitForTimeout(1600);
const openFactory = await p.$('[aria-label="Open factory mode"]');
if (openFactory) { await openFactory.click(); await p.waitForTimeout(2600); }
for (const label of ["Stats", "Factory stats"]) {
  const b = await p.$(`.fmode__tool[aria-label*="${label}"], .fmode__tool:has-text("${label}")`);
  if (b) { await b.click().catch(() => {}); break; }
}
await p.waitForTimeout(1200);
await shot("factory-layout-drivers");

// --- FACTORY: the build strip's new Undo (appears only once there IS something to reverse) ---
// Close the stats sheet by tapping its scrim — Escape would dismiss the whole fullscreen factory.
for (const sel of [".ds-sheet__grab", ".ds-sheet-scrim"]) {
  const b = await p.$(sel);
  if (b) { await b.click({ force: true }).catch(() => {}); break; }
}
await p.waitForTimeout(900);
console.log("still fullscreen after closing stats:", (await p.$(".fmode")) ? "yes" : "NO");
const buildBtn = await p.$('.fmode__tool:has-text("Build")');
console.log("build button found:", !!buildBtn, "| sheet still up:", !!(await p.$(".ds-sheet-scrim")));
if (buildBtn) { await buildBtn.click({ force: true }).catch((e) => console.log("build click:", String(e).split("\n")[0])); await p.waitForTimeout(1000); }
console.log("build strip open:", !!(await p.$(".fmode__palette")));
console.log("undo before any edit:", (await p.$(".fmode__build-undo")) ? "VISIBLE (bug)" : "hidden (correct)");
// Arm the belt tool and lay one tile, then look again.
const beltTile = await p.$('.fmode__ptile:has-text("Belt")');
console.log("belt tile found:", !!beltTile);
if (beltTile) { await beltTile.click({ force: true }).catch(() => {}); await p.waitForTimeout(700); }
// Drive a DOM-only edit (Auto route: arm → confirm) rather than fighting 3D hit-testing in a harness.
const autoTile = await p.$('.fmode__ptile:has-text("Auto")');
if (autoTile) { await autoTile.click({ force: true }).catch(() => {}); await p.waitForTimeout(700); }
const confirmAuto = await p.$(".fmode__autoquote-go");
console.log("auto confirm found:", !!confirmAuto);
if (confirmAuto) { await confirmAuto.click({ force: true }).catch(() => {}); await p.waitForTimeout(1100); }
console.log("undo after an edit:  ", (await p.$(".fmode__build-undo")) ? "VISIBLE (correct)" : "hidden (bug)");
await shot("factory-build-undo");

await browser.close();
server.close();
console.log("done →", outDir);
