// Visual-change capture - screenshots every primary screen of the running app so a UI change can
// be REVIEWED, not just typechecked. One command per snapshot; a compare page is regenerated each
// run so before/after sit side by side in one file.
//
//   npm run build                      # dist must be fresher than your edits
//   npm run shots:diff -- before       # capture the BASELINE (pre-change build)
//   ...make your changes... npm run build
//   npm run shots:diff -- after        # capture the CHANGED build
//   start .shots/compare.html          # open the side-by-side review page
//
// Also usable mid-session with an explicit label: `node scripts/shots-diff.mjs my-label`.
// Env: SHOTS_SAVE=<json> stage a specific save instead of regenerating the rich staging save;
//      SHOTS_CHROME=<exe> pick the browser executable explicitly.
//
// Windows-safe by design: the staging save's "/tmp/..." path is resolved through Node (C:\\tmp on
// this platform, created on demand), and the browser is auto-discovered (Chrome, then Edge).
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright-core";
import { build as esbuildBuild } from "esbuild";
import { preview as vitePreview } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5199;
const URL = process.env.SHOTS_URL || `http://localhost:${PORT}`;
const outRoot = resolve(root, ".shots");
const label = (process.argv[2] || process.env.SHOTS_LABEL || "after").replace(/[^a-z0-9_-]/gi, "-");
const outDir = resolve(outRoot, label);
await mkdir(outDir, { recursive: true });

// ---- 1. A fresh production build is the caller's job - refuse to shoot stale code silently. ----
if (!existsSync(resolve(root, "dist", "index.html"))) {
  console.error("dist/index.html not found. Run `npm run build` first.");
  process.exit(1);
}

// ---- 2. Stage a rich, internally-consistent save through the REAL engine (same as shots:stage),
//         so screens read as a thriving company instead of a fresh game. ----
let staged;
if (process.env.SHOTS_SAVE) {
  staged = (await readFile(process.env.SHOTS_SAVE)).toString();
} else {
  const stageSrc = resolve(root, "scripts", "stage-save.mjs");
  await esbuildBuild({
    entryPoints: [stageSrc],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: resolve(outRoot, ".stage.cjs"),
    logLevel: "error",
  });
  // stage-save.mjs writes to "/tmp/silicon-stage.json" - resolve it the way Node will on this
  // platform (drive-rooted on Windows) and make sure the directory exists first.
  const stageOut = resolve("/tmp/silicon-stage.json");
  await mkdir(dirname(stageOut), { recursive: true });
  const r = spawnSync(process.execPath, [resolve(outRoot, ".stage.cjs")], { stdio: "inherit" });
  if (r.status !== 0 || !existsSync(stageOut)) {
    console.error("staging failed - could not produce the demo save.");
    process.exit(1);
  }
  staged = (await readFile(stageOut)).toString();
}
{ const sv = JSON.parse(staged); sv.lastActive = Date.now(); staged = JSON.stringify(sv); }

// ---- 3. Serve dist/ in-process (no second terminal needed). ----
const server = await vitePreview({ root, preview: { port: PORT, strictPort: true } });
const shutDown = async () => { try { server.httpServer.close(); } catch { /* already gone */ } };

// ---- 4. Find a browser: explicit env, then the usual Windows/macOS/Linux installs. ----
function findChrome() {
  if (process.env.SHOTS_CHROME) return process.env.SHOTS_CHROME;
  const candidates = process.platform === "win32"
    ? [
        `${process.env["ProgramFiles"]}\\Google\\Chrome\\Application\\chrome.exe`,
        `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
        `${process.env["LOCALAPPDATA"]}\\Google\\Chrome\\Application\\chrome.exe`,
        `${process.env["ProgramFiles"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
        `${process.env["ProgramFiles(x86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
      ]
    : process.platform === "darwin"
      ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
      : ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return candidates.find((c) => c && existsSync(c));
}
const exe = findChrome();
if (!exe) {
  console.error("No Chrome/Edge found. Set SHOTS_CHROME to a browser executable.");
  await shutDown();
  process.exit(1);
}

// SwiftShader keeps WebGL (the 3D office) alive in headless capture.
const browser = await chromium.launch({
  executablePath: exe,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});

try {
  // SHOTS_TEXT_SCALE=<percent> shoots at an accessibility text scale (85/115/130) for a11y review.
  const textScale = Number(process.env.SHOTS_TEXT_SCALE || 100);
  // SHOTS_VIEWPORT=WxH shoots a different device class (e.g. 820x1180 for iPad) — wide-screen
  // chrome (centered column, fixed-element clamping) is verified, not assumed.
  const [vpW, vpH] = (process.env.SHOTS_VIEWPORT || "390x844").split("x").map((n) => Number(n) || 0);
  const viewport = { width: vpW || 390, height: vpH || 844 };
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await ctx.addInitScript((v) => {
    const t = Number(v.scale) === 100 ? {} : { textScale: Number(v.scale) };
    localStorage.setItem("silicon.save.v1", v.staged);
    // Dark + tutorials pre-seen: the app's signature look, no first-run popups in frame.
    localStorage.setItem("silicon.settings", JSON.stringify({ theme: "dark", sound: false, haptics: false, highContrast: false, decorateTutorialSeen: true, factoryTutorialSeen: true, dailyReminder: false, notifPrompted: true, ...t }));
  }, { staged, scale: textScale });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(3000); // boot + lazy chunks + 3D scene warm-up
  await p.addStyleTag({ content: ".hq__camhint{display:none!important}" }).catch(() => {});
  // Dismiss any residual popup layers defensively (decorate tutorial / coach steps).
  await p.click('.ds-sheet button:has-text("Continue")', { timeout: 2000 }).catch(() => {});
  for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(220); }
  // Dismiss any full-screen interrupt the staged save raised on boot (Vault reveal, awards, …):
  // Escape first (every house card handles it), then the card's primary button as a fallback.
  for (let i = 0; i < 6; i++) {
    const dialog = await p.$('[role="dialog"]');
    if (!dialog) break;
    await p.keyboard.press("Escape").catch(() => {});
    await p.waitForTimeout(350);
    if (await p.$('[role="dialog"]')) {
      await dialog.locator("button").first().click({ timeout: 1200 }).catch(() => {});
      await p.waitForTimeout(450);
    }
  }
  // Freeze the sim so every frame of the session shows the same week.
  await p.click('button[aria-label="Pause"]', { timeout: 4000 }).catch(() => {});
  // Let transient toasts/GainFX fade so frames show steady state, not mid-flight celebration.
  await p.waitForTimeout(2600);

  const tab = async (name) => {
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.evaluate((n) => {
      [...document.querySelectorAll(".bnav__item")].find((e) => e.querySelector(".bnav__label")?.textContent?.trim() === n)?.click();
    }, name);
    await p.waitForTimeout(1400);
  };
  const shot = async (name, fullPage = false) => {
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(350);
    await p.screenshot({ path: resolve(outDir, `${name}.png`), fullPage });
    console.log(`[${label}] ${name}.png`);
  };

  // Office: above the fold (3D scene + vital signs), the full card stream, and scrolled depth.
  await tab("Office");
  await shot("01-office-top");
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(600);
  await shot("02-office-end");
  await shot("03-office-full", true);

  await tab("Design");  await shot("04-design");
  await tab("Research"); await shot("05-research");
  await tab("Market");
  await shot("06-market");
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(500);
  await shot("07-market-end");

  await tab("Company"); await shot("08-company");

  // Settings sheet (gear in the HUD).
  await tab("Office");
  await p.evaluate(() => { [...document.querySelectorAll("button")].find((x) => /settings/i.test(x.getAttribute("aria-label") || ""))?.click(); });
  await p.waitForTimeout(900);
  await shot("09-settings");
  await p.keyboard.press("Escape").catch(() => {});
  await p.waitForTimeout(500);

  // Progress hub from the HUD trophy.
  await p.evaluate(() => { [...document.querySelectorAll("button")].find((x) => /progress/i.test(x.getAttribute("aria-label") || ""))?.click(); });
  await p.waitForTimeout(900);
  await shot("10-progress");

  await ctx.close();
} finally {
  await browser.close();
  await shutDown();
}

// ---- 5. Regenerate the side-by-side compare page across every captured label. ----
const SCREENS = [
  ["01-office-top", "Office · top"],
  ["02-office-end", "Office · end"],
  ["03-office-full", "Office · full stream"],
  ["04-design", "Design Lab"],
  ["05-research", "Research"],
  ["06-market", "Market"],
  ["07-market-end", "Market · end"],
  ["08-company", "Company"],
  ["09-settings", "Settings"],
  ["10-progress", "Progress hub"],
];
const entries = (await readdir(outRoot, { withFileTypes: true }))
  .filter((e) => e.isDirectory() && !e.name.startsWith("."))
  .map((e) => e.name)
  .sort();
const cols = entries.map((name) => ({
  name,
  has: new Map(SCREENS.map(([id]) => [id, existsSync(resolve(outRoot, name, `${id}.png`))])),
}));

const head = cols.map((c) => `<th>${c.name}</th>`).join("");
const rows = SCREENS.map(([id, title]) => {
  const cells = cols.map((c) => {
    const has = c.has.get(id);
    return has
      ? `<td><a href="${c.name}/${id}.png" target="_blank"><img loading="lazy" src="${c.name}/${id}.png"></a></td>`
      : `<td class="missing">-</td>`;
  }).join("");
  return `<tr><th>${title}</th>${cells}</tr>`;
}).join("");

await writeFile(
  resolve(outRoot, "compare.html"),
  `<!doctype html><meta charset="utf-8"><title>Silicon - visual diff</title><style>
body{margin:0;background:#0b0d12;color:#e8eaf0;font:14px/1.5 system-ui,sans-serif;padding:24px}
h1{font-size:18px;margin:0 0 4px}p.sub{color:#8a91a3;margin:0 0 20px;font-size:12px}
table{border-collapse:separate;border-spacing:8px}
th{font-weight:600;text-align:left;padding:4px 6px;color:#aab1c4;position:sticky;top:0;background:#0b0d12}
td{background:#12151d;border-radius:10px;padding:6px}
td img{width:250px;display:block;border-radius:6px}
td.missing{color:#4a5065;text-align:center;width:250px}
tr:first-child th{top:0}
</style><h1>Silicon - visual change review</h1>
<p class="sub">Columns are captures (oldest -> newest). Click any frame for the full-resolution PNG.</p>
<table><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>`,
  "utf8",
);
console.log(`\ncompare page -> .shots/compare.html  (open it in a browser)`);
