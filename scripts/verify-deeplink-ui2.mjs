// Prove the routing invariant WITHOUT the screenshot harness's boot-dismissal Escape, which
// pops a deep-linked page before the frame is taken: boot straight at #/market/settings with the flag
// on and assert the rail highlight and the shell header agree with the URL.
//   npm run build && SHOTS_CHROME=<chrome> node .superpowers/sdd/<plan>/verify-deeplink.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
const indexFile = resolve(distDir, "index.html");
if (!existsSync(indexFile)) { console.error("dist/index.html missing - run `npm run build` first."); process.exit(1); }

const server = createServer(async (req, res) => {
  const p = decodeURIComponent((req.url || "/").split("?")[0]);
  const c = p === "/" ? indexFile : resolve(distDir, "." + normalize(p));
  let f = c, b;
  try { b = await readFile(c); } catch { f = indexFile; b = await readFile(indexFile); }
  res.writeHead(200, { "content-type": MIME[extname(f)] || "text/html" });
  res.end(b);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const CHROME_ARGS = ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"];
const PINNED = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const chromePath = process.env.SHOTS_CHROME || (existsSync(PINNED) ? PINNED : undefined);
const browser = await chromium.launch({ ...(chromePath ? { executablePath: chromePath } : {}), args: CHROME_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem("silicon.settings", JSON.stringify({ theme: "dark", sound: false, haptics: false, decorateTutorialSeen: true, factoryTutorialSeen: true, notifPrompted: true }));
  localStorage.setItem("silicon.ui2", "next");
});
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

// A SAVE, so the app boots into the game rather than onboarding.
const staged = await readFile(resolve(process.env.SHOTS_SAVE || resolve("/tmp", "silicon-stage.json")), "utf8").catch(() => null);
if (staged) await ctx.addInitScript((v) => localStorage.setItem("silicon.save.v1", v), staged);

await p.goto(`http://localhost:${port}/#/market/settings`, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(3500);
// Deliberately NO Escape / dismissal pass: that is what hid the page in the harness capture.

const observed = await p.evaluate(() => {
  const active = document.querySelector(".railnav__item--active .railnav__label")?.textContent?.trim() ?? null;
  const tabActive = document.querySelector(".bnav__item--active .bnav__label")?.textContent?.trim() ?? null;
  const title = document.querySelector(".ds-pghead__title")?.textContent?.trim() ?? null;
  const back = !!document.querySelector(".ds-pghead__back");
  const setTitle = document.querySelector(".set__title");
  const setVisible = setTitle ? getComputedStyle(setTitle).display !== "none" : false;
  return { active, tabActive, title, back, hash: location.hash, setVisible };
});

await browser.close();
server.close();

const problems = [];
if (observed.hash !== "#/market/settings") problems.push(`hash is ${JSON.stringify(observed.hash)}`);
if (observed.active !== "Market") problems.push(`rail highlight is ${JSON.stringify(observed.active)} (expected "Market")`);
if (observed.title !== "Settings") problems.push(`header title is ${JSON.stringify(observed.title)} (expected "Settings")`);
if (!observed.back) problems.push("no back chevron in the shell header");
if (observed.setVisible) problems.push("Settings' own .set__title is still visible (two titles)");
if (errors.length) problems.push(`errors: ${errors.join(" | ")}`);

if (problems.length) {
  console.error("FAIL: deep link did not restore the route:\n - " + problems.join("\n - "));
  process.exit(1);
}
console.log(`PASS: #/market/settings restored Market + the Settings page (rail="${observed.active}", title="${observed.title}", back=${observed.back}, one title=${!observed.setVisible}).`);

