// Capture the Silicon Pro paywall as it actually renders, for design review / sharing.
// Companion to shoot-paywall-for-asc.mjs (which shoots the three plan states for App Store
// Connect); this one adds the states that script doesn't cover: the fine print at the bottom of
// the scroll, and a gated-reason variant where the headline answers the wall the player just hit.
//   npm run build && node scripts/shoot-paywall-design.mjs
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const PORT = Number(process.env.SHOTS_PORT || 5234);
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
const ctx = await browser.newContext({ viewport: { width: 428, height: 926 }, deviceScaleFactor: 3, colorScheme: "dark" });
await ctx.addInitScript(() => localStorage.clear());
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(1500);

const shot = async (name) => { await p.screenshot({ path: resolve(outDir, `${name}.png`) }); console.log("captured", name); };

// Name screen -> Found, then skip the founder-intent brief to land on the onboarding paywall.
await (await p.waitForSelector("button:has-text('Found')", { timeout: 15000 })).click();
await p.waitForTimeout(600);
const skipLink = await p.$(".onboard__scenario-link");
if (skipLink) { await skipLink.click(); await p.waitForTimeout(900); }
await p.waitForSelector(".pwl__card", { timeout: 15000 });
await p.waitForTimeout(500);

// The bottom of the scroll: the plan rows in full plus the auto-renew disclosure Apple reads.
await p.$eval(".pwl__scroll", (el) => { el.scrollTop = el.scrollHeight; });
await p.waitForTimeout(500);
await shot("paywall-fineprint");

// A gated variant: dismiss onboarding, then hit a locked feature so the headline changes to answer
// the wall the player just walked into. Settings → the Time Machine row is the shortest route.
await p.click(".pwl__skip");
await p.waitForTimeout(1200);
const gear = await p.$("button[aria-label='Settings'], .hud__settings, button:has-text('Settings')");
if (gear) {
  await gear.click();
  await p.waitForTimeout(900);
  const tm = await p.$("button:has-text('Unlock with Pro')");
  if (tm) {
    await tm.scrollIntoViewIfNeeded();
    await tm.click();
    await p.waitForSelector(".pwl__card", { timeout: 10000 });
    await p.waitForTimeout(700);
    await shot("paywall-gated-timemachine");
  } else console.log("skipped gated variant: no Time Machine button found");
} else console.log("skipped gated variant: no settings entry point found");

await ctx.close();
await browser.close();
server.close();
