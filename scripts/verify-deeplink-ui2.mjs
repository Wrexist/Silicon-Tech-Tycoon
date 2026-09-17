// Prove the routing invariant WITHOUT the screenshot harness's boot-dismissal Escape, which
// pops a deep-linked page before the frame is taken: boot straight at each URL with the flag on and
// assert the rail highlight, the shell header title and the back chevron all agree with the URL.
// A TABLE of routes so every declared page is exercised; an empty table falls back to the original
// single Market/Settings case.
//   npm run build && npm run verify:deeplink
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

// Every declared page, so a route that blanks the main area (or drops its title/back) fails here.
const ROUTES = [
  { url: "#/market/settings", rail: "Market", title: "Settings", ownTitle: ".set__title" },
  { url: "#/company/platform/licensing", rail: "Company", title: "Platform" },
  { url: "#/company/museum", rail: "Company", title: "Device Museum" },
  { url: "#/hq/goals", rail: "Office", title: "Goals" },
];
// The original single-route behaviour, kept for when the table is deliberately emptied.
const DEFAULT_ROUTES = [
  { url: "#/market/settings", rail: "Market", title: "Settings", ownTitle: ".set__title" },
];
const routes = ROUTES.length > 0 ? ROUTES : DEFAULT_ROUTES;

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
// A SAVE, so the app boots into the game rather than onboarding.
const staged = await readFile(resolve(process.env.SHOTS_SAVE || resolve("/tmp", "silicon-stage.json")), "utf8").catch(() => null);
if (staged) await ctx.addInitScript((v) => localStorage.setItem("silicon.save.v1", v), staged);

// One fresh page per route: a first mount is what adopts the deep-linked root as the active tab, so
// reusing a page (a hash change only raises popstate) would not exercise the boot path.
const problems = [];
const checked = [];
for (const route of routes) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(`http://localhost:${port}/${route.url}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3500);
  // Deliberately NO Escape / dismissal pass: that is what hid the page in the harness capture.

  const observed = await page.evaluate((ownTitle) => {
    const active = document.querySelector(".railnav__item--active .railnav__label")?.textContent?.trim() ?? null;
    const title = document.querySelector(".ds-pghead__title")?.textContent?.trim() ?? null;
    const back = !!document.querySelector(".ds-pghead__back");
    const own = ownTitle ? document.querySelector(ownTitle) : null;
    const ownVisible = own ? getComputedStyle(own).display !== "none" : false;
    return { active, title, back, hash: location.hash, ownVisible };
  }, route.ownTitle ?? null);
  await page.close();

  const routeProblems = [];
  if (observed.hash !== route.url) routeProblems.push(`hash is ${JSON.stringify(observed.hash)} (expected ${JSON.stringify(route.url)})`);
  if (observed.active !== route.rail) routeProblems.push(`rail highlight is ${JSON.stringify(observed.active)} (expected ${JSON.stringify(route.rail)})`);
  if (observed.title !== route.title) routeProblems.push(`header title is ${JSON.stringify(observed.title)} (expected ${JSON.stringify(route.title)})`);
  if (!observed.back) routeProblems.push("no back chevron in the shell header");
  if (observed.ownVisible) routeProblems.push(`${route.ownTitle} is still visible (two titles)`);
  if (errors.length) routeProblems.push(`errors: ${errors.join(" | ")}`);

  if (routeProblems.length) problems.push(`${route.url} — ${routeProblems.join("; ")}`);
  else checked.push(`${route.url} (rail="${route.rail}", title="${route.title}")`);
}

await browser.close();
server.close();

if (problems.length) {
  console.error("FAIL: deep link did not restore the route:\n - " + problems.join("\n - "));
  process.exit(1);
}
console.log(`PASS: ${checked.length}/${routes.length} routes restored — ${checked.join("; ")}.`);

