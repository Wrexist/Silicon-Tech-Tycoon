// Self-contained review screenshots of The Vault (classified dossiers) — serves ./dist in-process.
//   npm run build && npm run shots:stage && node scripts/shoot-vault.mjs
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
save.lastActive = Date.now();
const staged = JSON.stringify(save);
const theme = process.env.SHOTS_THEME || "light";

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(([v, th]) => {
  localStorage.setItem("silicon.save.v1", v);
  localStorage.setItem("silicon.settings", JSON.stringify({ theme: th, sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
}, [staged, theme]);
const p = await ctx.newPage();
p.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
p.on("console", (m) => { if (m.type() === "error") console.error("CONSOLE:", m.text()); });
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(2800);
for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(200); }

const shot = async (n) => { await p.waitForTimeout(400); await p.screenshot({ path: resolve(outDir, `${n}.png`) }); console.log("shot", n); };

// Clear whatever decision card the staged save is holding, so the ceremony (which yields to them)
// can take the screen.
for (let i = 0; i < 4; i++) {
  const scrim = await p.$(".rst__scrim, .dinbox__dismiss");
  if (!scrim) break;
  await scrim.click().catch(() => {});
  await p.waitForTimeout(600);
}

// The reveal ceremony, if the staged save (or the first tick) opened a file.
const cele = await p.$(".cele");
if (cele) {
  await shot(`vault-reveal-${theme}`);
  await p.click(".cele__card button");
  await p.waitForTimeout(700);
}

// HUD trophy → Progress hub → The Vault.
await p.click('button[aria-label*="Progress"]');
await p.waitForTimeout(600);
await shot(`vault-hub-${theme}`);
const rows = await p.$$(".prog__row");
for (const r of rows) {
  const t = await r.$eval(".prog__row-title", (n) => n.textContent).catch(() => "");
  if (t && t.includes("Vault")) { await r.click(); break; }
}
await p.waitForTimeout(700);
await shot(`vault-top-${theme}`);
await p.evaluate(() => document.querySelector(".vlt__list")?.scrollIntoView({ block: "end" }));
await p.waitForTimeout(500);
await shot(`vault-mid-${theme}`);
await p.evaluate(() => { const l = document.querySelectorAll(".vlt__row"); l[l.length - 1]?.scrollIntoView({ block: "center" }); });
await p.waitForTimeout(500);
await shot(`vault-bottom-${theme}`);

await browser.close();
server.close();
console.log("done →", outDir);
