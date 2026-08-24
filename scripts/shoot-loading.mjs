// Capture a lazy screen's Suspense FALLBACK by holding its chunk on the wire, so the loading
// state is a steady frame instead of something you have to catch by luck.
//
// Why this needs to exist: a loading state is a real screen a player sees (first open, cold cache,
// slow connection) but it is invisible to every other harness here — shots-diff waits for content,
// and once the PWA service worker has precached the chunk the request never touches the network
// again. So this blocks the SW *and* stalls the chunk, which is the only combination that
// reproduces what a first-time player actually sees.
//
//   npm run build && node scripts/shoot-loading.mjs        # -> .shots/loading/settings-loading.png
//   OUT_DIR=.shots/loading-before node scripts/shoot-loading.mjs
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = "/home/user/Silicon-Tech-Tycoon";
const distDir = resolve(root, "dist");
const PORT = 5233;
const EXE = process.env.SHOTS_CHROME || "/opt/pw-browsers/chromium";
const outDir = process.env.OUT_DIR || "/home/user/Silicon-Tech-Tycoon/.shots/loading";
await mkdir(outDir, { recursive: true });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const indexFile = resolve(distDir, "index.html");
const server = createServer(async (req, res) => {
  const p = decodeURIComponent((req.url || "/").split("?")[0]);
  const candidate = p === "/" ? indexFile : resolve(distDir, "." + normalize(p));
  if (!candidate.startsWith(distDir)) { res.writeHead(403); return res.end(); }
  let file = candidate, body;
  try { body = await readFile(candidate); } catch { file = indexFile; body = await readFile(indexFile); }
  res.writeHead(200, { "content-type": MIME[extname(file)] || "text/html" }); res.end(body);
});
await new Promise((r) => server.listen(PORT, r));

const save = JSON.parse((await readFile("/tmp/silicon-stage.json")).toString());
save.lastActive = Date.now();
const staged = JSON.stringify(save);

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
// serviceWorkers: "block" — the PWA precaches every chunk, so a returning player never hits the
// network for Settings. A FIRST load (no SW yet) does, which is the case this frame is about.
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark", serviceWorkers: "block" });
await ctx.addInitScript((v) => {
  localStorage.setItem("silicon.save.v1", v);
  localStorage.setItem("silicon.settings.v1", JSON.stringify({ theme: "dark", sound: false, haptics: false }));
  localStorage.setItem("silicon.tutorial.seen", "1");
}, staged);

// Hold the Settings/Progress chunks well past the screenshot so their fallback is what's on
// screen. Logged, because a silent no-match would mean shooting the LOADED screen and calling it
// the loading state.
const HOLD_MS = 30_000;
await ctx.route("**/*", async (route) => {
  const url = route.request().url();
  if (/Settings|Progress/i.test(url)) {
    console.log("holding", url.split("/").pop());
    await new Promise((r) => setTimeout(r, HOLD_MS));
  }
  await route.continue();
});

const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
for (let i = 0; i < 6; i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(250); }
// Pause the sim so nothing else moves.
const pause = page.locator('button[aria-label*="ause"]').first();
if (await pause.count()) { await pause.click().catch(() => {}); }
await page.waitForTimeout(400);

const gear = page.locator('button[aria-label*="ettings"], button[title*="ettings"]').first();
await gear.click();
await page.waitForTimeout(1200); // fallback is on screen; chunk still held
await page.screenshot({ path: `${outDir}/settings-loading.png` });
console.log("wrote settings-loading.png");

await browser.close();
server.close();
