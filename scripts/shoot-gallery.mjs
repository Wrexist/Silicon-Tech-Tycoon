// Popup QA gallery — serves ./dist in-process and captures a battery of modal/sheet popups so their
// clear-glass treatment can be reviewed. Theme via SHOTS_THEME=light|dark, save via SHOTS_SAVE.
//   SHOTS_THEME=dark node scripts/shoot-gallery.mjs
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const PORT = Number(process.env.SHOTS_PORT || 5227);
const EXE = process.env.SHOTS_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const THEME = process.env.SHOTS_THEME || "light";
const SAVE = process.env.SHOTS_SAVE || "/tmp/silicon-regions.json";
const TAG = process.env.SHOTS_TAG || THEME;
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
const save = JSON.parse((await readFile(SAVE)).toString());
save.lastActive = Date.now();
const staged = JSON.stringify(save);

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: THEME });
await ctx.addInitScript(([v, theme]) => {
  localStorage.setItem("silicon.save.v1", v);
  localStorage.setItem("silicon.settings", JSON.stringify({ theme, sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
}, [staged, THEME]);
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(2800);
await p.addStyleTag({ content: ".hq__camhint{display:none!important}" }).catch(() => {});
// Dismiss any interrupt overlay (offline modal, rivalry, eureka, celebration, awards, strike) so the
// sheet captures are clean. These fire organically on a live save during load.
const dismissAll = async () => {
  for (let i = 0; i < 8; i++) {
    const btn = await p.$('.cele button, .rvd button, .eur__card--result button, .awd button, .rst__card button:has-text("Hold"), .ds-sheet button:has-text("Continue"), button:has-text("Continue"), button:has-text("Bring it on")');
    if (btn) { await btn.click().catch(() => {}); await p.waitForTimeout(400); continue; }
    await p.keyboard.press("Escape").catch(() => {});
    await p.waitForTimeout(250);
    if (!(await p.$('.cele, .rvd, .eur, .awd, .rst, .ds-sheet-scrim'))) break;
  }
};
await dismissAll();
for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(200); }
await p.click('button[aria-label="Pause"]', { timeout: 4000 }).catch(() => {});
await p.waitForTimeout(400);
await dismissAll();

const shot = async (n) => { await p.waitForTimeout(400); await p.screenshot({ path: resolve(outDir, `g-${n}-${TAG}.png`) }); console.log("shot", `g-${n}-${TAG}`); };
const esc = async () => { await p.keyboard.press("Escape").catch(() => {}); await p.waitForTimeout(500); };

// 1) Settings sheet (gear).
await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /settings/i.test(x.getAttribute("aria-label") || "")); b?.click(); });
await p.waitForTimeout(900); await shot("settings"); await esc();

// 2) Progress hub (trophy).
await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /progress/i.test(x.getAttribute("aria-label") || "")); b?.click(); });
await p.waitForTimeout(900); await shot("progress"); await esc();

// 3) A Celebration in clear glass — Market → Demand → Buy licence on a locked region.
await p.evaluate(() => { const b = [...document.querySelectorAll(".bnav__item")].find((el) => el.querySelector(".bnav__label")?.textContent?.trim() === "Market"); b?.click(); });
await p.waitForTimeout(1000);
await p.evaluate(() => { const b = [...document.querySelectorAll(".mkt__subtab")].find((x) => /demand/i.test(x.textContent || "")); b?.click(); });
await p.waitForTimeout(800);
await p.evaluate(() => { const btn = [...document.querySelectorAll(".mkt__region-foot button")].find((x) => /buy licence/i.test(x.textContent || "")); btn?.click(); });
await p.waitForTimeout(900);
if (await p.$(".cele")) await shot("celebration"); else console.log("!! celebration not shown");

await browser.close(); server.close();
console.log("done", TAG);
