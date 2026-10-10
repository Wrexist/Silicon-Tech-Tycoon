// World shots - captures the two 3D worlds (Office + Factory) in both themes so a visual change to
// either can be REVIEWED against the target, not just typechecked. Companion to shots-diff.mjs
// (which covers the 2D screens and never opens the factory). See docs/WORLDS_3D_HANDOFF.md.
//
//   npm run build
//   npm run shots:worlds -- before          # baseline from the pre-change build
//   ...change... && npm run build
//   npm run shots:worlds -- after
//   open .world-shots/compare.html          # columns: reference (if any) + every label
//
// Frames per theme (light + dark): office-card, office-decorate, factory-card, factory-full,
// factory-full-close (a pinch-in on the line). Reference images dropped into
// .world-shots/reference/<theme>-<frame>.png show up as the first column (never commit them if
// they are someone else's work; .world-shots/ is gitignored).
//
// Env: SHOTS_SAVE=<json> shoot a specific save (default: stage the rich demo save via the engine);
//      SHOTS_CHROME=<exe> browser; SHOTS_THEMES=light,dark; SHOTS_PORT (default 5261).
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright-core";
import { build as esbuildBuild } from "esbuild";
import { preview as vitePreview } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.SHOTS_PORT || 5261);
const URL = `http://localhost:${PORT}`;
const outRoot = resolve(root, ".world-shots");
const label = (process.argv[2] || "after").replace(/[^a-z0-9_-]/gi, "-");
const outDir = resolve(outRoot, label);
const THEMES = (process.env.SHOTS_THEMES || "light,dark").split(",").map((t) => t.trim()).filter(Boolean);
await mkdir(outDir, { recursive: true });

if (!existsSync(resolve(root, "dist", "index.html"))) {
  console.error("dist/index.html not found. Run `npm run build` first.");
  process.exit(1);
}

// ---- Save: the same engine-staged mid-game company shots-diff uses (Campus office, demo factory floor).
let staged;
if (process.env.SHOTS_SAVE) {
  staged = (await readFile(process.env.SHOTS_SAVE)).toString();
} else {
  await esbuildBuild({ entryPoints: [resolve(root, "scripts", "stage-save.mjs")], bundle: true, platform: "node",
    format: "cjs", outfile: resolve(outRoot, ".stage.cjs"), logLevel: "error" });
  const stageOut = resolve("/tmp/silicon-stage.json");
  await mkdir(dirname(stageOut), { recursive: true });
  const r = spawnSync(process.execPath, [resolve(outRoot, ".stage.cjs")], { stdio: "inherit" });
  if (r.status !== 0 || !existsSync(stageOut)) { console.error("staging failed"); process.exit(1); }
  staged = (await readFile(stageOut)).toString();
}
{
  const s = JSON.parse(staged);
  s.lastActive = Date.now();
  for (const k of Object.keys(s)) if (/^pending/.test(k)) s[k] = null;
  s.interruptPace = "calm";
  s.lastInterruptWeek = (s.week ?? 0) + 500;
  staged = JSON.stringify(s);
}

function findChrome() {
  if (process.env.SHOTS_CHROME) return process.env.SHOTS_CHROME;
  const c = process.platform === "win32"
    ? [`${process.env["ProgramFiles"]}\\Google\\Chrome\\Application\\chrome.exe`,
       `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
       `${process.env["LOCALAPPDATA"]}\\Google\\Chrome\\Application\\chrome.exe`,
       `${process.env["ProgramFiles"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
       `${process.env["ProgramFiles(x86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`]
    : process.platform === "darwin"
      ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
      : ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return c.find((p) => p && existsSync(p));
}
const exe = findChrome();
if (!exe) { console.error("No Chrome/Edge found - set SHOTS_CHROME"); process.exit(1); }

const server = await vitePreview({ root, preview: { port: PORT, strictPort: true } });
const browser = await chromium.launch({ executablePath: exe,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });

const frames = [];
const save = async (p, name, el) => {
  const path = resolve(outDir, `${name}.png`);
  if (el) await el.screenshot({ path }); else await p.screenshot({ path });
  frames.push(`${name}.png`);
  console.log("shot", name);
};
const domClick = (p, sel) => p.evaluate((s) => document.querySelector(s)?.click(), sel);

try {
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await ctx.addInitScript(([v, th]) => {
      localStorage.setItem("silicon.save.v1", v);
      localStorage.setItem("silicon.settings", JSON.stringify({ theme: th, sound: false, haptics: false,
        decorateTutorialSeen: true, factoryTutorialSeen: true }));
      localStorage.setItem("silicon.factory.camhint", "1");
      localStorage.setItem("silicon.hint.tapteam", "1");
    }, [staged, theme]);
    const p = await ctx.newPage();
    p.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
    await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await p.waitForTimeout(3000);
    await p.addStyleTag({ content: ".hq__camhint{display:none!important}" }).catch(() => {});
    await p.click('.ds-sheet button:has-text("Continue")', { timeout: 1500 }).catch(() => {});
    for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(200); }
    await domClick(p, 'button[aria-label="Pause"]');
    for (const sel of [".rtl__later", ".rtl__close"]) await domClick(p, sel);
    await p.waitForTimeout(2500); // GLB furniture + contact shadows settle

    // Office card (the everyday view).
    const world = await p.$(".hq__world");
    await save(p, `${theme}-office-card`, world ?? undefined);

    // Office decorate (overhead build framing, full screen).
    await domClick(p, ".hq__decorate");
    await p.waitForTimeout(2200);
    await save(p, `${theme}-office-decorate`);
    await p.keyboard.press("Escape").catch(() => {});
    await p.click('button:has-text("Done")', { timeout: 1500 }).catch(() => {});
    await p.waitForTimeout(900);

    // Factory card (Office tab -> Factory world).
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.evaluate(() => { [...document.querySelectorAll(".worldtabs__tab")].find((b) => /Factory/.test(b.textContent || ""))?.click(); });
    await p.waitForTimeout(3000);
    const card = await p.$(".fcard__scene") ?? await p.$(".fcard");
    await save(p, `${theme}-factory-card`, card ?? undefined);

    // Factory fullscreen.
    await domClick(p, 'button[aria-label="Open factory mode"]');
    await p.waitForTimeout(900);
    for (let i = 0; i < 5; i++) { const b = await p.$(".dtut__btn--primary"); if (!b) break; await b.click().catch(() => {}); await p.waitForTimeout(300); }
    await p.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
    await p.waitForTimeout(3500);
    const open = await p.$(".fmode");
    if (!open) console.warn(`[${theme}] factory fullscreen did not open - check the selectors in this script`);
    await save(p, `${theme}-factory-full`);

    // Close-up on the line: wheel-zoom the orbit camera towards the centre.
    const canvas = await p.$(".fmode canvas");
    if (canvas) {
      const b = await canvas.boundingBox();
      if (b) {
        await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -240); await p.waitForTimeout(120); }
        await p.waitForTimeout(1500);
      }
    }
    await save(p, `${theme}-factory-full-close`);
    await ctx.close();
  }
} finally {
  await browser.close();
  try { server.httpServer.close(); } catch { /* gone */ }
}

// ---- compare.html: rows = frames, columns = reference (if present) + every label, oldest first.
const labels = (await readdir(outRoot, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && d.name !== "reference" && !d.name.startsWith("."))
  .map((d) => d.name);
const ordered = labels.sort((a, b) => (a === label) - (b === label));
const cols = (existsSync(resolve(outRoot, "reference")) ? ["reference"] : []).concat(ordered);
const rows = [...new Set(frames)];
const cell = (c, f) => existsSync(resolve(outRoot, c, f))
  ? `<td><a href="${c}/${f}"><img src="${c}/${f}" loading="lazy"></a></td>` : "<td class=x>-</td>";
const html = `<!doctype html><meta charset=utf-8><title>World shots</title>
<style>body{font:13px system-ui;margin:16px;background:#111;color:#ddd}table{border-collapse:collapse}
td,th{padding:6px;vertical-align:top;border:1px solid #333}img{width:300px;display:block}.x{color:#666}</style>
<h1>Office + Factory - ${cols.join(" / ")}</h1><table><tr><th></th>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>
${rows.map((f) => `<tr><th>${f.replace(".png", "")}</th>${cols.map((c) => cell(c, f)).join("")}</tr>`).join("\n")}</table>`;
await writeFile(resolve(outRoot, "compare.html"), html);
console.log(`done -> ${outDir}\ncompare -> ${resolve(outRoot, "compare.html")}`);
