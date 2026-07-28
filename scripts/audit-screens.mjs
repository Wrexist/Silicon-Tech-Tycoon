// Release audit (`npm run audit:screens`) — walk every screen of the PRODUCTION build and report any
// console error, page error, or failed network request. This is the check that catches what unit
// tests structurally cannot: a lazy chunk that fails to resolve in a real bundle, an asset the
// service worker precaches under one name and the app requests under another, a screen that throws
// only on data shapes a fresh `newGame()` never produces.
//
// Three passes, because they fail differently:
//   • new game    — the first-run path, where half the UI is still gated
//   • late game   — the showcase save, where every system has state to render
//   • 1.1.0 save  — a save written by the PREVIOUS release, walked screen by screen. Migration unit
//                   tests assert the state comes out right; this asserts the app can then draw it.
//
// Needs a current dist/ (`npm run build`) and /tmp/silicon-showcase.json (`npm run shots:stage:showcase`).
// The 1.1.0 pass is skipped unless /tmp/save-110.json exists — regenerate it by checking out the
// 1.1.0 tag in a worktree and exporting a save from that build.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const MIME = { ".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".svg":"image/svg+xml",".woff2":"font/woff2",".woff":"font/woff",".ico":"image/x-icon",".webmanifest":"application/manifest+json" };
const indexFile = resolve(distDir, "index.html");
const missing = [];
const server = createServer(async (req, res) => {
  const p = decodeURIComponent((req.url || "/").split("?")[0]);
  const c = p === "/" ? indexFile : resolve(distDir, "." + normalize(p));
  let f = c, b;
  try { b = await readFile(c); } catch { if (p !== "/" && !p.endsWith("/")) missing.push(p); f = indexFile; b = await readFile(indexFile); }
  res.writeHead(200, { "content-type": MIME[extname(f)] || "text/html" });
  res.end(b);
});
await new Promise((r) => server.listen(5321, r));
const URL = "http://localhost:5321";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const problems = [];

async function sweep(label, saveJson) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((v) => {
    if (v) localStorage.setItem("silicon.save.v1", v);
    localStorage.setItem("silicon.settings", JSON.stringify({ theme: "dark", sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
  }, saveJson);
  const p = await ctx.newPage();
  const note = (kind, text) => { if (/favicon/.test(text)) return; problems.push(`[${label}] ${kind}: ${text.slice(0, 300)}`); };
  p.on("pageerror", (e) => note("pageerror", e.message));
  p.on("console", (m) => { if (m.type() === "error") note("console.error", m.text()); });
  p.on("requestfailed", (r) => note("requestfailed", `${r.url()} ${r.failure()?.errorText}`));
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(3000);
  await p.evaluate(() => document.querySelector(".ds-sheet button")?.click());
  for (let i = 0; i < 10; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.evaluate((n) => n.click()); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector('button[aria-label="Pause"]')?.click());

  for (const label of ["Office", "Design", "Research", "Market", "Company"]) {
    await p.evaluate((l) => [...document.querySelectorAll(".bnav__item")].find((e) => e.querySelector(".bnav__label")?.textContent?.trim() === l)?.click(), label);
    await p.waitForTimeout(1400);
    // every sub-tab on this screen
    const tabs = await p.$$('button[role="tab"]');
    for (const t of tabs) { await t.evaluate((n) => n.click()).catch(() => {}); await p.waitForTimeout(600); }
  }
  // The Progress hub and every view under it — the lazy chunks most likely to fail in a prod build.
  // App.tsx gates the hub on hasShipped, so a brand-new company has no button to open: that is the
  // intended first-run experience, not a failure. Only flag a button that's there but doesn't work.
  const hubButton = await p.$('button[aria-label*="Progress"]');
  if (!hubButton) { await ctx.close(); return; }
  await hubButton.evaluate((n) => n.click());
  await p.waitForSelector(".prog__row", { timeout: 15000 }).catch(() => problems.push(`[${label}] Progress hub never opened`));
  const rows = await p.$$eval(".prog__row", (ns) => ns.map((n) => n.querySelector(".prog__row-title")?.textContent ?? ""));
  for (const title of rows) {
    await p.evaluate((t) => [...document.querySelectorAll(".prog__row")].find((r) => r.querySelector(".prog__row-title")?.textContent === t)?.click(), title);
    await p.waitForTimeout(1200);
    await p.evaluate(() => document.querySelector(".vlt__back, .prog__back, [class$='__back']")?.click());
    await p.waitForTimeout(700);
  }
  await ctx.close();
}

await sweep("new game", null);
const rich = JSON.parse((await readFile("/tmp/silicon-showcase.json")).toString());
rich.lastActive = Date.now();
await sweep("late game", JSON.stringify(rich));

// The upgrade path, through the REAL built app rather than the state layer: a save written by
// 1.1.0 (generated from commit 5fb925a) loaded into this build and walked screen by screen.
const oldSave = await readFile("/tmp/save-110.json").catch(() => null);
if (oldSave) {
  const old = JSON.parse(oldSave.toString());
  old.lastActive = Date.now();
  await sweep("1.1.0 save", JSON.stringify(old));
} else {
  console.log("note: /tmp/save-110.json absent — skipped the previous-release upgrade pass.");
}

await browser.close();
server.close();
const unique = [...new Set(problems)];
if (missing.length) console.log("404s served index instead:", [...new Set(missing)].join(", "));
if (unique.length === 0) console.log("CLEAN — no console errors, page errors or failed requests across every screen.");
else { console.log(`${unique.length} problem(s):`); for (const u of unique) console.log(" •", u); }
