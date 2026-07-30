// One-off: capture a real screenshot of the actual Silicon Pro paywall (as reviewers will see it),
// for App Store Connect's per-subscription "App Review Screenshot" field. Fresh install, no save —
// skips the founder-intent brief to land straight on the paywall, offer=yearly (default toggle).
//   node scripts/shoot-paywall-for-asc.mjs
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const PORT = Number(process.env.SHOTS_PORT || 5233);
const EXE = process.env.SHOTS_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const outDir = resolve(root, ".asc-shots");
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

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
// iPhone 6.7" class viewport (matches the App Store marketing shots elsewhere in this repo).
const ctx = await browser.newContext({ viewport: { width: 428, height: 926 }, deviceScaleFactor: 3, colorScheme: "dark" });
await ctx.addInitScript(() => {
  // Completely fresh device: no save, no settings, no "seen this before" flags.
  localStorage.clear();
});
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(1500);

// Name screen -> Found. Leave the name field untouched (defaults to "Silicon").
const foundBtn = await p.waitForSelector("button:has-text('Found')", { timeout: 15000 });
await foundBtn.click();
await p.waitForTimeout(600);

// Founder-intent brief -> skip straight through, same as any player who taps "just let me play".
const skipLink = await p.$(".onboard__scenario-link");
if (skipLink) { await skipLink.click(); await p.waitForTimeout(900); }

// Paywall should now be open.
const card = await p.waitForSelector(".pwl__card", { timeout: 15000 });
await p.waitForTimeout(500);
await card.screenshot({ path: resolve(outDir, "paywall-card.png") });
await p.screenshot({ path: resolve(outDir, "paywall-full.png") });
console.log("captured paywall-card.png and paywall-full.png in", outDir);

// Second variant: Monthly plan selected, for the Monthly subscription's own review screenshot.
const monthlyRadio = await p.$$('.pwl__plan[role="radio"]');
for (const el of monthlyRadio) {
  const text = await el.innerText();
  if (text.includes("Pro Monthly")) { await el.click(); break; }
}
await p.waitForTimeout(400);
await card.screenshot({ path: resolve(outDir, "paywall-monthly-card.png") });
await p.screenshot({ path: resolve(outDir, "paywall-monthly-full.png") });
console.log("captured paywall-monthly-card.png and paywall-monthly-full.png in", outDir);

// Third variant: Lifetime plan selected, for the non-consumable's own review screenshot.
const lifetimeRadios = await p.$$('.pwl__plan[role="radio"]');
for (const el of lifetimeRadios) {
  const text = await el.innerText();
  if (text.includes("Pro Lifetime")) { await el.click(); break; }
}
await p.waitForTimeout(400);
await card.screenshot({ path: resolve(outDir, "paywall-lifetime-card.png") });
await p.screenshot({ path: resolve(outDir, "paywall-lifetime-full.png") });
console.log("captured paywall-lifetime-card.png and paywall-lifetime-full.png in", outDir);

await ctx.close();
await browser.close();
server.close();
