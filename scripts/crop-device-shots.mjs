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

// output name → { source screenshot, crop band } — crop drops the baked-in headline (top) and
// wordmark (bottom), leaving just the device. iPhone frames are 1284×2778; iPad frames 2064×2752.
const PHONE = { sy: 455, sh: 2130, sw: 1284 };
const IPAD  = { sy: 400, sh: 2160, sw: 2064 };
const SHOTS = {
  design:      { rel: "app-store-screenshots/store/03-design.png", ...PHONE },
  factory:     { rel: "app-store-screenshots/store/01-factory.png", ...PHONE },
  office:      { rel: "app-store-screenshots/store/02-office.png", ...PHONE },
  market:      { rel: "app-store-screenshots/store/04-market.png", ...PHONE },
  research:    { rel: "app-store-screenshots/store/05-research.png", ...PHONE },
  awards:      { rel: "app-store-screenshots/store/06-awards.png", ...PHONE },
  "ipad-hq":     { rel: "app-store-screenshots/ipad/04-hq.png", ...IPAD },
  "ipad-design": { rel: "app-store-screenshots/ipad/01-design.png", ...IPAD },
  "ipad-market": { rel: "app-store-screenshots/ipad/03-leaderboard.png", ...IPAD },
};

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

for (const [name, { rel, sy, sh, sw }] of Object.entries(SHOTS)) {
  const src = "data:image/png;base64," + (await readFile(resolve(root, rel))).toString("base64");
  const out = await page.evaluate(async ({ src, sy, sw, sh }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej("load fail"); img.src = src; });
    const c = document.createElement("canvas"); c.width = sw; c.height = sh;
    c.getContext("2d").drawImage(img, 0, sy, sw, sh, 0, 0, sw, sh);
    return c.toDataURL("image/png");
  }, { src, sy, sw, sh });
  await writeFile(resolve(outDir, `${name}.png`), Buffer.from(out.split(",")[1], "base64"));
  process.stdout.write(name + " ");
}
await browser.close();
console.log("\nCropped device shots → marketing/assets/_device/");
