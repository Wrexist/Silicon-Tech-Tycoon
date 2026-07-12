// Device-crop step for the marketing kit. Takes the finished App Store screenshots in
// app-store-screenshots/store/ and crops each to the device band (dropping the baked-in headline
// and wordmark), writing marketing/assets/_device/<feature>.png. Those crops are the hero images
// the ad compositor (marketing/asset-studio.html) places under fresh headlines + logo.
//
//   node scripts/crop-device-shots.mjs   # then: node scripts/export-marketing.mjs
//
// Chromium is resolved like scripts/shots.mjs (canvas crop needs a browser, not a native lib).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "marketing/assets/_device");

// feature key → source screenshot. Sources are the 1284×2778 store frames.
const SHOTS = {
  design:   "app-store-screenshots/store/03-design.png",
  factory:  "app-store-screenshots/store/01-factory.png",
  office:   "app-store-screenshots/store/02-office.png",
  market:   "app-store-screenshots/store/04-market.png",
  research: "app-store-screenshots/store/05-research.png",
  awards:   "app-store-screenshots/store/06-awards.png",
};
// device band within the 1284×2778 frame: drop headline (top) + wordmark (bottom)
const SY = 455, SH = 2130, SW = 1284;

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
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: await resolveChrome() });
const page = await browser.newPage();
await page.setContent("<body></body>");

for (const [name, rel] of Object.entries(SHOTS)) {
  const src = "data:image/png;base64," + (await readFile(resolve(root, rel))).toString("base64");
  const out = await page.evaluate(async ({ src, SY, SW, SH }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej("load fail"); img.src = src; });
    const c = document.createElement("canvas"); c.width = SW; c.height = SH;
    c.getContext("2d").drawImage(img, 0, SY, SW, SH, 0, 0, SW, SH);
    return c.toDataURL("image/png");
  }, { src, SY, SW, SH });
  await writeFile(resolve(outDir, `${name}.png`), Buffer.from(out.split(",")[1], "base64"));
  process.stdout.write(name + " ");
}
await browser.close();
console.log("\nCropped device shots → marketing/assets/_device/");
