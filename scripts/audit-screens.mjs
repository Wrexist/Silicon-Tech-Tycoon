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
// GREEN MUST MEAN COVERAGE. The absence of console errors is only half of what this script asserts;
// the other half is that it actually WALKED something. Onboarding once grew a step, the traversal
// bailed early, the new-game pass measured ZERO screens — and the audit printed CLEAN. So every pass
// now counts what it visited and is checked against a floor (COVERAGE_FLOORS below, measured from
// what the passes genuinely reach today), asserts onboarding completed, asserts the seeded fixture
// actually loaded and migrated, and distinguishes "the gated screen rendered its real view" from
// "a paywall appeared". A pass that walks nothing now FAILS instead of reporting clean.
//
// Needs a current dist/ (`npm run build`) and /tmp/silicon-showcase.json (`npm run shots:stage:showcase`).
//
// THE COMMITTED FIXTURE — scripts/fixtures/save-1.1.0.json
//   Provenance: written by the 1.1.0-era build itself, at commit b90edc1, and committed so this
//   check is reproducible without checking out an old tree. It is a real exported save, not a
//   hand-written one: `version: 1` (SAVE_VERSION has been 1 since 1.1.0 — the compatibility work is
//   in `migrate()`'s field BACKFILLS, not in a version bump), seed 1551791227, company "Silicon",
//   week 3, era 1, zero launches. Because it has shipped nothing, App.tsx correctly hides the
//   Progress hub for it — that pass covers the nav screens and the migration, and the gated-screen
//   assertions ride on the late-game pass (see UPGRADE_HUB_REASON).
//   To regenerate: check out 1.1.0 (`git worktree add ../silicon-110 v1.1.0`), build and run it,
//   play a few weeks, use Company → Settings → Export save, and drop the JSON in here. Then re-run
//   this script and re-measure the floors below — a fixture with launches under its belt would reach
//   the hub, and the floors should rise to match rather than stay at today's numbers.
// /tmp/save-110.json still wins if present, for testing against a different old build.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
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

// Browser resolution, in order: SHOTS_CHROME (the convention the shoot-* scripts already use), the
// CI/container-pinned build if it happens to exist, else playwright-core's own resolution. The path
// used to be hard-coded to this container, which meant the one release check that catches lazy-chunk
// and old-save render failures could not be run by the owner or in CI at all — a check nobody can
// run is no better than one that lies.
const CHROME_ARGS = ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"];
const PINNED_CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const chromePath = process.env.SHOTS_CHROME || (existsSync(PINNED_CHROME) ? PINNED_CHROME : undefined);
const browser = await chromium.launch({ ...(chromePath ? { executablePath: chromePath } : {}), args: CHROME_ARGS })
  .catch((err) => {
    console.error(
      "\naudit:screens could not start Chromium.\n" +
      (chromePath ? `  tried: ${chromePath}\n` : "  tried: playwright-core's default browser\n") +
      "  fix: install one (`npx playwright install chromium`) or point SHOTS_CHROME at a Chrome/Chromium binary.\n" +
      `  underlying error: ${err.message}\n`,
    );
    process.exit(2);
  });
const problems = [];
/** One coverage record per pass, printed as the summary and checked against COVERAGE_FLOORS. */
const coverage = [];

// Every bottom-nav screen that is CURRENTLY REVEALED, and the marker each one must draw.
const SCREEN_MARKUP = { Office: ".hq", Design: ".lab", Research: "[class^='rd__']", Market: "[class^='mkt__']", Company: "[class^='co__']" };
// Every Progress-hub row, and the root class of the view it must open. A row whose view does not
// draw its marker is a broken screen, not a slow one — the old check ("the hub went away") passed
// for anything that merely unmounted the hub, including the paywall.
const ROW_MARKUP = {
  "Goals": ".gl",
  "Company Roadmap": ".rm",
  "Category Mastery": ".mst",
  "The Vault": ".vlt",
  "Founder Legend": ".fl",
  "Achievements": ".ach",
  "Scenarios": ".scn",
  "Challenges": ".scn",
  "Device Museum": ".mus",
  "Help & Guide": ".help",
};
// The four Silicon Pro rows. Without an entitlement these open the PAYWALL instead of a view, which
// is correct product behaviour and USELESS as coverage — it renders none of the four screens. The
// pro-seeded passes must therefore show the real view for each, and a paywall on any of them is a
// failure, never a visited screen.
const GATED_ROWS = ["Category Mastery", "The Vault", "Founder Legend", "Device Museum"];
const PAYWALL = ".pwl";   // the one purchase surface — never a visited screen

// Floors, MEASURED from what these passes genuinely reach against today's build and fixtures (see
// the coverage summary this script prints). They are not aspirations — they are "what walked last
// time it was known good", and any pass that walks less than this has lost coverage and fails.
// `hub: false` means the save legitimately cannot reach the Progress hub, and the reason is checked
// against the save itself rather than taken on trust.
const COVERAGE_FLOORS = {
  // The new-game company is young, so the nav is still partly hidden and the Progress hub does not
  // exist yet — 4 screens and 9 sub-tabs is what the first-run path genuinely reaches.
  "new game":   { screens: 4, subTabs: 9,  rows: 0,  hub: false, gated: 0, migration: false },
  // The showcase save has everything: all five nav screens, every Progress view, and — with the
  // entitlement seeded — all four Pro screens drawing their REAL view.
  "late game":  { screens: 5, subTabs: 12, rows: 10, hub: true,  gated: 4, migration: false },
  // The 1.1.0 fixture has shipped nothing, so it reaches the same surface as a young company; what
  // it uniquely proves is that a PREVIOUS-RELEASE save loads, migrates, and then draws.
  "1.1.0 save": { screens: 4, subTabs: 9,  rows: 0,  hub: false, gated: 0, migration: true },
};
// The ONLY acceptable reason for a pass to skip the Progress hub: the company has shipped nothing,
// so App.tsx does not render the hub button (`state.launched.length >= 1 || state.legacy > 0`).
const UPGRADE_HUB_REASON = "the save has shipped nothing, so App.tsx hides the Progress hub";

// `pro` seeds a lifetime Silicon Pro record. Without it the four Pro-gated Progress rows (Category
// Mastery, The Vault, Founder Legend, Device Museum) open the PAYWALL instead of a view, so this
// sweep never render-checks those screens at all — they were the audit's blind spot, not a bug.
// Seeding is a local entitlement only: no store call, no purchase, and it re-syncs on a real device.
async function sweep(label, saveJson, pro = false) {
  const cov = {
    label,
    onboarding: saveJson ? "n/a (save seeded)" : "not reached",
    fixtureLoaded: saveJson ? false : "n/a",
    migratedKeys: saveJson ? 0 : "n/a",
    screens: [],
    subTabs: 0,
    hubOpened: false,
    hubSkipReason: null,
    rows: [],
    gated: {},
    paywalls: 0,
  };
  coverage.push(cov);
  const seeded = saveJson ? JSON.parse(saveJson) : null;
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
      note("save", "a save was seeded but the app rendered ONBOARDING — the save did not load");
      await ctx.close();
      return cov;
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
    if (!started) { note("nav", "onboarding never handed off to the game"); await ctx.close(); return cov; }
    // Onboarding is the ONE part of this pass with no screen of its own to count, and the one that
    // silently swallowed the whole sweep last time. Record that it completed, and assert it below.
    cov.onboarding = "completed";
    await p.waitForTimeout(1500);
    for (let i = 0; i < 10; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.evaluate((n) => n.click()); await p.waitForTimeout(200); }
    await p.evaluate(() => document.querySelector('button[aria-label="Pause"]')?.click());
  } else if (!saveJson) {
    // No save AND no onboarding: the first-run path was skipped entirely, so this pass is not
    // testing what it claims to test.
    note("onboard", "the new-game pass never saw the onboarding screen — the first-run path was not walked");
  }

  // THE SEEDED SAVE ACTUALLY LOADED — not "the app didn't error", and not "we're past onboarding".
  // The app writes its state back to localStorage, so compare what is there now against what was
  // seeded: same seed and same company means THIS save is in play rather than a fresh game, and the
  // fields present now that the fixture never carried are `migrate()`'s backfills, i.e. proof that
  // migration ran rather than the loader waving an already-current save through.
  if (seeded) {
    const readLive = () => p.evaluate(() => { try { return localStorage.getItem("silicon.save.v1"); } catch { return null; } });
    // Toggle the sim by the CONTROL THE PLAYER SEES: the pause button lives in two places (the top
    // HUD during the tutorial, the floating SpeedDial after it) and only one is mounted at a time,
    // so pick the visible one rather than the first in the document.
    const setRunning = (want) => p.evaluate((w) => {
      const btn = [...document.querySelectorAll("button[aria-label]")]
        .find((b) => b.offsetParent !== null && b.getAttribute("aria-label") === (w ? "Resume" : "Pause"));
      btn?.click();
      return !!btn;
    }, want);
    let liveRaw = await readLive();
    // Still the exact bytes this script seeded: the app has not persisted since boot, so reading
    // them back proves NOTHING (that was the first version of this check — it compared the seed
    // against itself and would have passed even if the app had ignored the save entirely). Let the
    // sim run a couple of weeks so the debounced autosave writes the LOADED, MIGRATED state back
    // over it, then compare THAT.
    // A week takes a few seconds of wall clock and the autosave is debounced behind it, so be
    // patient rather than clever: resume, kick the sim into fast-forward, and give it several
    // windows to produce one committed change.
    for (let attempt = 0; attempt < 6 && liveRaw === saveJson; attempt++) {
      await setRunning(true);
      if (attempt === 0) await p.evaluate(() => {
        [...document.querySelectorAll("button[aria-label]")]
          .find((b) => b.offsetParent !== null && b.getAttribute("aria-label") === "Fast forward")?.click();
      });
      await p.waitForTimeout(2500);
      liveRaw = await readLive();
    }
    await p.evaluate(() => {
      [...document.querySelectorAll("button[aria-label]")]
        .find((b) => b.offsetParent !== null && b.getAttribute("aria-label") === "Normal speed")?.click();
    });
    await setRunning(false);   // back to a paused game for the traversal
    await p.waitForTimeout(400);
    if (liveRaw === saveJson) {
      note("save", "the app never wrote the save back, so the audit cannot prove the seeded fixture "
        + "was loaded rather than ignored");
    }
    let live = null;
    try { live = liveRaw ? JSON.parse(liveRaw) : null; } catch { live = null; }
    if (!live) {
      note("save", "no save in localStorage after boot — cannot prove the seeded fixture loaded");
    } else if (live.seed !== seeded.seed || live.companyName !== seeded.companyName) {
      note("save", `the running game is NOT the seeded save (seed ${live.seed} vs ${seeded.seed}, `
        + `company "${live.companyName}" vs "${seeded.companyName}") — the app fell back to a fresh game`);
    } else {
      cov.fixtureLoaded = true;
      const backfilled = Object.keys(live).filter((k) => !(k in seeded));
      cov.migratedKeys = backfilled.length;
      cov.migratedSample = backfilled.slice(0, 6);
    }
  }

  // Every bottom-nav screen that is CURRENTLY REVEALED, and every sub-tab on it. App.tsx reveals the
  // nav progressively (Office + Design first, the rest as the company grows), so the audit walks what
  // the build actually renders rather than a fixed list — but every tab it finds must open, because
  // silently skipping one is how an audit reports CLEAN on a build where a screen is broken.
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
      const drew = await p.waitForSelector(marker, { timeout: 15000 }).then(() => true).catch(() => false);
      if (drew) cov.screens.push(screen);   // counted only once it has DRAWN, never on the click
      else note("nav", `"${screen}" never rendered ${marker}`);
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
    cov.subTabs += tabCount;
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
    // false failure against it. Record WHY the hub was skipped so the summary can't hide it.
    let hasShipped = false;
    if (seeded) hasShipped = (seeded.launched || []).length > 0 || (seeded.legacy ?? 0) > 0;
    if (hasShipped) note("nav", "Progress hub button missing on a company that has shipped");
    cov.hubSkipReason = hasShipped ? "hub button missing on a company that HAS shipped" : UPGRADE_HUB_REASON;
    await ctx.close();
    return cov;
  }
  if (!(await openHub())) { note("nav", "Progress hub never opened"); await ctx.close(); return cov; }
  cov.hubOpened = true;

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
    // What actually came up: the row's own view, the PAYWALL, or nothing. A paywall is never a
    // visited screen — on a Pro-seeded pass it means the entitlement did not take and the four Pro
    // screens went unrendered, which is exactly the blind spot this audit exists to close.
    const marker = ROW_MARKUP[title] ?? null;
    const shown = await p.evaluate(([m, pw]) => ({
      paywall: !!document.querySelector(pw),
      view: m ? !!document.querySelector(m) : false,
      leftHub: !document.querySelector(".prog__row"),
    }), [marker, PAYWALL]);
    if (!marker) {
      note("nav", `unknown Progress row "${title}" — add it to ROW_MARKUP so its view gets checked`);
    } else if (shown.paywall) {
      cov.paywalls += 1;
      if (GATED_ROWS.includes(title)) cov.gated[title] = "PAYWALL";
      note("gate", `the "${title}" row opened the PAYWALL, not its view — that screen was NOT rendered`);
    } else if (!shown.view) {
      note("nav", `the "${title}" row did not render ${marker}`);
    } else {
      cov.rows.push(title);
      if (GATED_ROWS.includes(title)) cov.gated[title] = "rendered";
    }
    if (!shown.paywall && !shown.view && !shown.leftHub) note("nav", `the "${title}" row did not open a view`);
    // Dismiss whatever is open, then reopen the hub from the HUD for the next row.
    await p.evaluate(() => {
      // A paywall closes on its own control and nothing else — leaving it up would swallow the
      // remaining rows.
      const pw = document.querySelector(".pwl__close");
      if (pw) return pw.click();
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
  return cov;
}

await sweep("new game", null);
const rich = JSON.parse((await readFile("/tmp/silicon-showcase.json")).toString());
rich.lastActive = Date.now();
await sweep("late game", JSON.stringify(rich), true);

// The upgrade path, through the REAL built app rather than the state layer: a save written by the
// 1.1.0-era build (commit b90edc1) loaded into this build and walked screen by screen.
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

// ── Coverage assertions ───────────────────────────────────────────────────────────────────────
// Everything above reports what BROKE. This reports what was never looked at, which is the failure
// mode that actually shipped: a pass that walks nothing raises no console error at all.
for (const [label, floor] of Object.entries(COVERAGE_FLOORS)) {
  const cov = coverage.find((c) => c.label === label);
  if (!cov) {
    if (label === "1.1.0 save" && process.env.AUDIT_SKIP_UPGRADE === "1") continue;
    problems.push(`[${label}] coverage: this pass never ran at all`);
    continue;
  }
  const short = (what, got, want) =>
    problems.push(`[${label}] coverage: ${what} ${got} < floor ${want} — this pass walked less than it used to`);
  if (cov.screens.length < floor.screens) short("bottom-nav screens rendered", cov.screens.length, floor.screens);
  if (cov.subTabs < floor.subTabs) short("sub-tabs opened", cov.subTabs, floor.subTabs);
  if (cov.rows.length < floor.rows) short("Progress views rendered", cov.rows.length, floor.rows);
  const gatedRendered = GATED_ROWS.filter((g) => cov.gated[g] === "rendered");
  if (gatedRendered.length < floor.gated) {
    const missingGates = GATED_ROWS.filter((g) => cov.gated[g] !== "rendered")
      .map((g) => `${g} (${cov.gated[g] ?? "never opened"})`);
    problems.push(`[${label}] coverage: only ${gatedRendered.length}/${floor.gated} Pro-gated screens rendered their real view — ${missingGates.join(", ")}`);
  }
  if (floor.hub && !cov.hubOpened) problems.push(`[${label}] coverage: the Progress hub never opened`);
  if (!floor.hub && cov.hubSkipReason && cov.hubSkipReason !== UPGRADE_HUB_REASON) {
    problems.push(`[${label}] coverage: the Progress hub was skipped for an unexpected reason — ${cov.hubSkipReason}`);
  }
  // Onboarding is a step, not a screen: the new-game pass MUST have walked it through to the game.
  if (label === "new game" && cov.onboarding !== "completed") {
    problems.push(`[new game] coverage: onboarding did not complete (${cov.onboarding}) — the first-run path was not walked to the game`);
  }
  // A seeded pass that did not prove its fixture loaded is measuring a fresh game, not an upgrade.
  if (cov.fixtureLoaded !== "n/a") {
    if (cov.fixtureLoaded !== true) problems.push(`[${label}] coverage: the seeded save was never confirmed loaded`);
    else if (floor.migration && cov.migratedKeys === 0) {
      problems.push(`[${label}] coverage: migration back-filled NOTHING — either migrate() no longer runs on load, or this fixture is not actually an older save`);
    }
  }
}

// The dev server answers a missing path with index.html and a 200 — that is what the real SPA
// fallback does, but it means a genuinely absent asset never surfaces as an HTTP error. Fold those
// into the failures rather than printing them beside a "CLEAN" verdict.
const unique = [...new Set([
  ...problems,
  ...new Set(missing.map((p) => `missing asset (served index.html instead): ${p}`)),
])];

// The coverage summary prints on every run, pass or fail: "CLEAN" is only meaningful next to the
// numbers behind it, and a human reading CI output should be able to see the sweep walked screens.
console.log("\nCoverage");
for (const c of coverage) {
  const floor = COVERAGE_FLOORS[c.label] ?? {};
  const gated = GATED_ROWS.map((g) => `${g}: ${c.gated[g] ?? "—"}`).join(", ");
  console.log(`  ${c.label}`);
  console.log(`    onboarding      ${c.onboarding}`);
  console.log(`    fixture loaded  ${c.fixtureLoaded === true ? `yes (migrate backfilled ${c.migratedKeys} field(s)${c.migratedSample?.length ? `: ${c.migratedSample.join(", ")}` : ""})` : c.fixtureLoaded}`);
  console.log(`    nav screens     ${c.screens.length}/${floor.screens ?? "?"} — ${c.screens.join(", ") || "none"}`);
  console.log(`    sub-tabs        ${c.subTabs}/${floor.subTabs ?? "?"}`);
  console.log(`    Progress hub    ${c.hubOpened ? "opened" : `not opened — ${c.hubSkipReason ?? "unknown"}`}`);
  console.log(`    Progress views  ${c.rows.length}/${floor.rows ?? "?"} — ${c.rows.join(", ") || "none"}`);
  console.log(`    Pro-gated       ${gated}${c.paywalls ? `  (paywalls raised: ${c.paywalls})` : ""}`);
}

if (unique.length === 0) {
  console.log("\nCLEAN — every pass met its coverage floor, and no console errors, page errors or failed requests across every screen.");
} else {
  console.log(`\n${unique.length} problem(s):`);
  for (const u of unique) console.log(" •", u);
  process.exitCode = 1;   // an audit that cannot fail is not an audit
}
