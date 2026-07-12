// Marketing asset exporter — rasterises the ad creatives defined in marketing/asset-studio.html
// (real in-game screenshots + logo + feature headline overlays) into
// marketing/assets/<id>-<w>x<h>.png at 2× the labelled size. The App Store icon is exported at
// exactly 1024×1024. Chromium is resolved like scripts/shots.mjs: prefer /opt/pw-browsers, else
// Playwright's managed browser. Override with SHOTS_CHROME=/path/to/chrome.
//
//   node scripts/export-marketing.mjs
import { mkdir } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const studio = pathToFileURL(resolve(root, "marketing/asset-studio.html")).href;
const outDir = resolve(root, "marketing/assets");

let chromium;
try { ({ chromium } = await import("playwright")); }
catch {
  try { ({ chromium } = await import("playwright-core")); }
  catch { console.error("Playwright not found:\n  npm i -D playwright && npx playwright install chromium"); process.exit(1); }
}
async function resolveChrome() {
  if (process.env.SHOTS_CHROME) return process.env.SHOTS_CHROME;
  const base = "/opt/pw-browsers";
  if (existsSync(base)) {
    const dir = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
    const exe = dir && resolve(base, dir, "chrome-linux/chrome");
    if (exe && existsSync(exe)) return exe;
  }
  return undefined;
}
const executablePath = await resolveChrome();
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath });

async function exportAt(dsf, ids) {
  const page = await browser.newPage({ deviceScaleFactor: dsf });
  await page.goto(studio, { waitUntil: "networkidle" });
  for (const { id } of ids) {
    const dim = await page.evaluate((id) => mountForExport(id), id);
    // wait for the screenshot <img> (if any) to finish decoding
    await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll("#export img")];
      await Promise.all(imgs.map((im) => (im.complete && im.naturalWidth ? Promise.resolve()
        : new Promise((r) => { im.onload = im.onerror = r; }))));
    });
    await page.waitForTimeout(120);
    const node = await page.$("#export > .creative");
    await node.screenshot({ path: resolve(outDir, `${id}-${dim.w}x${dim.h}.png`) });
    process.stdout.write(".");
  }
  await page.close();
}

// gather ids + which need DSF 1 (icon → exactly 1024) vs DSF 2 (retina)
const all = await (await browser.newPage()).evaluate(() => 0).catch(() => 0); // warm
const page0 = await browser.newPage();
await page0.goto(studio, { waitUntil: "networkidle" });
const items = await page0.evaluate(() => ASSETS.flatMap((s) => s.items.map((a) => ({ id: a.id, kind: a.kind || "" }))));
await page0.close();

const iconIds = items.filter((i) => i.kind === "icon");
const retinaIds = items.filter((i) => i.kind !== "icon");

await exportAt(2, retinaIds);
await exportAt(1, iconIds);

await browser.close();
console.log(`\nExported ${items.length} creatives → marketing/assets/`);
