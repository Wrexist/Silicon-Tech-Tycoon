// Capture the three popups whose gray containers became liquid-glass wells — Awards, Rival Strike,
// and the offline "While you were away" sheet — in BOTH light and dark, from the staged saves.
//   node scripts/shoot-glass-popups.mjs   (writes .newfeat-shots/gp-<name>-<theme>.png)
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
    res.writeHead(200, { "content-type": MIME[extname(file)] || "text/html" }); res.end(body);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(PORT, r));
const URL = `http://localhost:${PORT}`;

const SAVES = [
  { name: "awards", file: "/tmp/silicon-awards.json", preserve: false, sel: ".awd__card" },
  { name: "strike", file: "/tmp/silicon-strike.json", preserve: false, sel: ".rst__card" },
  { name: "offline", file: "/tmp/silicon-offline.json", preserve: true, sel: ".ds-sheet" },
];

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
for (const theme of ["light", "dark"]) {
  for (const sv of SAVES) {
    const raw = JSON.parse((await readFile(sv.file)).toString());
    if (!sv.preserve) raw.lastActive = Date.now();
    const staged = JSON.stringify(raw);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme });
    await ctx.addInitScript(([v, t]) => {
      localStorage.setItem("silicon.save.v1", v);
      localStorage.setItem("silicon.settings", JSON.stringify({ theme: t, sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
    }, [staged, theme]);
    const p = await ctx.newPage();
    await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await p.waitForTimeout(2600);
    await p.addStyleTag({ content: ".hq__camhint{display:none!important}" }).catch(() => {});
    for (let i = 0; i < 6; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(180); }
    const shown = await p.$(sv.sel);
    if (!shown) console.log("!! not shown:", sv.name, theme);
    await p.waitForTimeout(700);
    await p.screenshot({ path: resolve(outDir, `gp-${sv.name}-${theme}.png`) });
    console.log("shot", `gp-${sv.name}-${theme}`, shown ? "ok" : "MISSING");
    await ctx.close();
  }
}
await browser.close(); server.close();
console.log("done");
