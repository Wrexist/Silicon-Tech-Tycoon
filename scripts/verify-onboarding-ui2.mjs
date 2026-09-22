// Verify a clean installation defaults to the new shell, without URL or saved UI overrides.
//   npm run build && node scripts/verify-onboarding-ui2.mjs
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
const URL = `http://localhost:${server.address().port}/`;

const CHROME_ARGS = ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"];
const PINNED = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const chromePath = process.env.SHOTS_CHROME || (existsSync(PINNED) ? PINNED : undefined);
const browser = await chromium.launch({ ...(chromePath ? { executablePath: chromePath } : {}), args: CHROME_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem("silicon.settings", JSON.stringify({ theme: "dark", sound: false, haptics: false, decorateTutorialSeen: true, factoryTutorialSeen: true, notifPrompted: true }));
});
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(3000);

// Same generic walk `audit:screens` uses: always take the decline/skip path, stop at the nav.
let reached = await p.$(".bnav__item").then(Boolean);
for (let step = 0; step < 8 && !reached; step++) {
  const clicked = await p.evaluate(() => {
    const vis = [...document.querySelectorAll("button")].filter((b) => b.offsetParent !== null);
    if (!vis.length) return null;
    const decline = vis.find((b) => /not now|maybe later|skip|^found /i.test((b.textContent || "").trim()));
    const target = decline || vis[vis.length - 1];
    target.click();
    return (target.textContent || "").trim().slice(0, 40);
  });
  if (!clicked) break;
  await p.waitForTimeout(900);
  reached = await p.$(".bnav__item").then(Boolean);
}
if (!reached) reached = await p.waitForSelector(".bnav__item", { timeout: 15000 }).then(() => true).catch(() => false);

const rail = await p.$(".railnav").then(Boolean);
// Wave 1a invariant: the shell presents exactly ONE page title and exactly ONE primary nav. At
// 1024x768 with the flag on that is one `.ds-pghead__title` and one visible `.railnav` (the `.bnav`
// is hidden by CSS). `offsetParent` is null for position:fixed, so test geometry + computed style.
const counts = await p.evaluate(() => {
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const titles = [...document.querySelectorAll(".ds-pghead__title")].filter(visible).length
    || [...document.querySelectorAll(".app__title")].filter(visible).length;
  const navs = [...document.querySelectorAll(".railnav")].filter(visible).length
    + [...document.querySelectorAll(".bnav")].filter(visible).length;
  return { titles, navs };
});
await browser.close();
server.close();

if (!reached) { console.error("FAIL: onboarding never reached the game."); process.exit(1); }
if (errors.some((e) => /hook|minified react error #(310|321)/i.test(e))) { console.error("FAIL: hook error during first run:", errors); process.exit(1); }
if (errors.length) { console.error("FAIL: console/page errors during first run:\n" + errors.join("\n")); process.exit(1); }
if (!rail) { console.error("FAIL: flag on at 1024x768 but the rail never rendered."); process.exit(1); }
if (counts.titles !== 1) { console.error(`FAIL: expected exactly one visible page title, found ${counts.titles}.`); process.exit(1); }
if (counts.navs !== 1) { console.error(`FAIL: expected exactly one visible primary nav, found ${counts.navs}.`); process.exit(1); }
console.log("PASS: clean installation defaults to the new interface; onboarding completed, no hook/console errors, rail rendered.");
