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
// The previous-release pass uses scripts/fixtures/save-1.1.0.json, a save WRITTEN BY THE 1.1.0-era
// build itself (commit b90edc1) and committed so this check is reproducible. /tmp/save-110.json
// still wins if present, for testing against a different old build. Older note:
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
// Port 0 → the OS picks a free one, so a stray local service or a concurrent audit can't collide.
await new Promise((r) => server.listen(0, r));
const URL = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const problems = [];

// `pro` seeds a lifetime Silicon Pro record. Without it the four Pro-gated Progress rows (Category
// Mastery, The Vault, Founder Legend, Device Museum) open the PAYWALL instead of a view, so this
// sweep never render-checks those screens at all — they were the audit's blind spot, not a bug.
// Seeding is a local entitlement only: no store call, no purchase, and it re-syncs on a real device.
async function sweep(label, saveJson, pro = false) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(([v, seedPro]) => {
    if (v) localStorage.setItem("silicon.save.v1", v);
    localStorage.setItem("silicon.settings", JSON.stringify({ theme: "dark", sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
    if (seedPro) {
      localStorage.setItem("silicon.pro.v1", JSON.stringify({
        tier: "lifetime", productId: "com.wrexist.silicon.pro.lifetime", expiresAt: null,
        grantedAt: new Date().toISOString(), isTrial: false, willRenew: false, inGracePeriod: false,
      }));
    }
  }, [saveJson, pro]);
  const p = await ctx.newPage();
  const note = (kind, text) => { if (/favicon/.test(text)) return; problems.push(`[${label}] ${kind}: ${text.slice(0, 300)}`); };
  p.on("pageerror", (e) => note("pageerror", e.message));
  p.on("console", (m) => { if (m.type() === "error") note("console.error", m.text()); });
  p.on("requestfailed", (r) => note("requestfailed", `${r.url()} ${r.failure()?.errorText}`));
  // requestfailed only covers TRANSPORT failures. A 404 or 500 is a perfectly successful request as
  // far as Playwright is concerned, so it needs its own listener or the audit never sees one.
  p.on("response", (r) => { if (r.status() >= 400) note("http", `${r.status()} ${r.url()}`); });
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(3000);
  await p.evaluate(() => document.querySelector(".ds-sheet button")?.click());
  for (let i = 0; i < 10; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.evaluate((n) => n.click()); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector('button[aria-label="Pause"]')?.click());

  // A save that fails to load doesn't error — it drops you on the onboarding screen, which has no
  // nav and no HUD, so a permissive traversal walks nothing and reports clean. This is exactly how
  // the 1.1.0 upgrade pass silently measured nothing (the fixture carried onboarded: false, which a
  // real player save never does). Fail loudly instead.
  if (await p.$(".onboard")) {
    if (saveJson) {
      // A save that fails to load doesn't error — it drops you on onboarding, which has no nav and
      // no HUD, so a permissive traversal walks nothing and reports clean.
      note("save", "a save was seeded but the app rendered ONBOARDING — the save did not load");
      await ctx.close();
      return;
    }
    // No save: onboarding IS the first-run path. Complete it so the rest of the sweep has a game.
    // It is MULTI-STEP (found -> motivation -> the Pro offer), and it grows: hard-coding one click
    // is how this pass silently stopped walking anything. Step through generically instead, always
    // taking the decline/skip option so the sweep never enters a purchase flow, and stop as soon as
    // the bottom nav appears.
    let started = false;
    for (let step = 0; step < 8 && !started; step++) {
      started = await p.$(".bnav__item").then((n) => !!n);
      if (started) break;
      const clicked = await p.evaluate(() => {
        // NOT scoped to .onboard: the Pro offer step is the shared <Paywall/> overlay, mounted
        // outside the onboarding subtree. Scoping here is why this pass found no button and bailed.
        const vis = [...document.querySelectorAll("button")].filter((b) => b.offsetParent !== null);
        if (!vis.length) return null;
        // Prefer the non-committal path: skip / not now / decline, then a plain advance.
        const decline = vis.find((b) => /not now|maybe later|skip|^found /i.test((b.textContent || "").trim()));
        const target = decline || vis[vis.length - 1];
        target.click();
        return (target.textContent || "").trim().slice(0, 40);
      });
      if (!clicked) break;
      await p.waitForTimeout(900);
    }
    if (!started) started = await p.waitForSelector(".bnav__item", { timeout: 15000 }).then(() => true).catch(() => false);
    if (!started) { note("nav", "onboarding never handed off to the game"); await ctx.close(); return; }
    await p.waitForTimeout(1500);
    for (let i = 0; i < 10; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.evaluate((n) => n.click()); await p.waitForTimeout(200); }
    await p.evaluate(() => document.querySelector('button[aria-label="Pause"]')?.click());
  }

  // Every bottom-nav screen that is CURRENTLY REVEALED, and every sub-tab on it. App.tsx reveals the
  // nav progressively (Office + Design first, the rest as the company grows), so the audit walks what
  // the build actually renders rather than a fixed list — but every tab it finds must open, because
  // silently skipping one is how an audit reports CLEAN on a build where a screen is broken.
  const SCREEN_MARKUP = { Office: ".hq", Design: ".lab", Research: "[class^='rd__']", Market: "[class^='mkt__']", Company: "[class^='co__']" };
  const navLabels = await p.$$eval(".bnav__item", (ns) =>
    ns.map((n) => n.querySelector(".bnav__label")?.textContent?.trim() ?? "").filter(Boolean));
  if (navLabels.length === 0) note("nav", "the bottom nav rendered no items at all");
  for (const screen of navLabels) {
    await p.evaluate((l) => {
      [...document.querySelectorAll(".bnav__item")]
        .find((e) => e.querySelector(".bnav__label")?.textContent?.trim() === l)?.click();
    }, screen);
    const marker = SCREEN_MARKUP[screen];
    if (marker) {
      await p.waitForSelector(marker, { timeout: 15000 })
        .catch(() => note("nav", `"${screen}" never rendered ${marker}`));
    } else {
      note("nav", `unknown bottom-nav screen "${screen}" — add it to SCREEN_MARKUP so it gets checked`);
      await p.waitForTimeout(1400);
    }
    // Sub-tabs by INDEX, re-queried each time: clicking one re-renders the panel, which detaches any
    // handles captured up front.
    const tabCount = await p.$$eval('button[role="tab"]', (ns) => ns.length);
    for (let i = 0; i < tabCount; i++) {
      await p.evaluate((idx) => document.querySelectorAll('button[role="tab"]')[idx]?.click(), i);
      await p.waitForTimeout(600);
    }
  }

  // The Progress hub and every view under it — the lazy chunks most likely to fail in a prod build.
  // App.tsx gates the hub on hasShipped, so a brand-new company has no button to open: that is the
  // intended first run. For every OTHER pass the company has shipped, so a missing button is a bug.
  const openHub = async () => {
    const button = await p.$('button[aria-label*="Progress"]');
    if (!button) return false;
    await button.evaluate((n) => n.click());
    return await p.waitForSelector(".prog__row", { timeout: 15000 }).then(() => true).catch(() => false);
  };
  if (!(await p.$('button[aria-label*="Progress"]'))) {
    // Read "has shipped" off the SAVE, not the label. The hub is progressively revealed, so a
    // young fixture legitimately has no hub button and the old label-based guess reported a
    // false failure against it.
    let hasShipped = false;
    if (saveJson) { try { hasShipped = (JSON.parse(saveJson).launched || []).length > 0; } catch { /* unreadable fixture */ } }
    if (hasShipped) note("nav", "Progress hub button missing on a company that has shipped");
    await ctx.close();
    return;
  }
  if (!(await openHub())) { note("nav", "Progress hub never opened"); await ctx.close(); return; }

  // Rows by INDEX, not by title: two rows can share a title, and opening one re-renders the hub so
  // any element handle taken beforehand is stale. Between rows the hub is REOPENED from the HUD
  // rather than backed out of — the sub-views don't share one close affordance (some have a chevron,
  // some a "Done" button), and what this audit is actually checking is that each view opens and
  // renders, not how each one is dismissed.
  const rowCount = await p.$$eval(".prog__row", (ns) => ns.length);
  for (let i = 0; i < rowCount; i++) {
    const title = await p.evaluate((idx) => {
      const row = document.querySelectorAll(".prog__row")[idx];
      row?.click();
      return row?.querySelector(".prog__row-title")?.textContent?.trim() ?? `row ${idx}`;
    }, i);
    await p.waitForTimeout(1200);
    const left = await p.evaluate(() => !document.querySelector(".prog__row"));
    if (!left) note("nav", `the "${title}" row did not open a view`);
    // Dismiss whatever is open, then reopen the hub from the HUD for the next row.
    await p.evaluate(() => {
      // A `*__back` chevron when the view has one (the Vault, Mastery, the Museum), otherwise the
      // "Done" button these sheets close with. Searched LAST-first: the sheet's own close control is
      // at the bottom of the document, and scanning forwards picks up the game's chrome behind it.
      const chevron = document.querySelector("[class$='__back']");
      if (chevron) return chevron.click();
      const buttons = [...document.querySelectorAll("button")].reverse();
      const done = buttons.find((b) => /^(done|back|close)$/i.test((b.textContent || "").trim()));
      if (done) return done.click();
      document.querySelector(".prog__close")?.click();
    });
    await p.waitForTimeout(600);
    if (i + 1 < rowCount && !(await p.$(".prog__row")) && !(await openHub())) {
      note("nav", `could not get back to the hub after "${title}" — remaining rows unchecked`);
      break;
    }
  }
  await ctx.close();
}

await sweep("new game", null);
const rich = JSON.parse((await readFile("/tmp/silicon-showcase.json")).toString());
rich.lastActive = Date.now();
await sweep("late game", JSON.stringify(rich), true);

// The upgrade path, through the REAL built app rather than the state layer: a save written by
// 1.1.0 (generated from commit 5fb925a) loaded into this build and walked screen by screen.
const oldSave = await readFile("/tmp/save-110.json").catch(() => null)
  ?? await readFile(resolve(root, "scripts/fixtures/save-1.1.0.json")).catch(() => null);
if (oldSave) {
  const old = JSON.parse(oldSave.toString());
  old.lastActive = Date.now();
  await sweep("1.1.0 save", JSON.stringify(old), true);
} else if (process.env.AUDIT_SKIP_UPGRADE === "1") {
  console.log("note: AUDIT_SKIP_UPGRADE=1 — the previous-release upgrade pass was deliberately skipped.");
} else {
  // Not a note: the upgrade pass is the whole reason this audit exists at release time, and a
  // silently-skipped check reads exactly like a passing one.
  problems.push("[1.1.0 save] no previous-release fixture (scripts/fixtures/save-1.1.0.json) — the upgrade pass did NOT run. "
    + "Regenerate it from a 1.1.0 build, or set AUDIT_SKIP_UPGRADE=1 to acknowledge the gap.");
}

await browser.close();
server.close();
// The dev server answers a missing path with index.html and a 200 — that is what the real SPA
// fallback does, but it means a genuinely absent asset never surfaces as an HTTP error. Fold those
// into the failures rather than printing them beside a "CLEAN" verdict.
const unique = [...new Set([
  ...problems,
  ...new Set(missing.map((p) => `missing asset (served index.html instead): ${p}`)),
])];
if (unique.length === 0) {
  console.log("CLEAN — no console errors, page errors or failed requests across every screen.");
} else {
  console.log(`${unique.length} problem(s):`);
  for (const u of unique) console.log(" •", u);
  process.exitCode = 1;   // an audit that cannot fail is not an audit
}
