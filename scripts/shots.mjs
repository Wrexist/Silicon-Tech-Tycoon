// Marketing screenshot helper — drives a headless browser against the running dev server and
// captures App Store-sized screenshots of the key screens. Run:
//   npm run dev            # serve the app (default http://localhost:5173)
//   node scripts/shots.mjs # writes store-shots/<size>/<screen>.png
//
// Needs Playwright once: `npm i -D playwright && npx playwright install chromium`.
// Override the URL with SHOTS_URL=http://localhost:5199 node scripts/shots.mjs
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.env.SHOTS_URL || "http://localhost:5173";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright not found. Install it once:\n  npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

// App Store portrait sizes: logical points × deviceScaleFactor = required pixels.
//   6.7" → 1290×2796   |   6.5" → 1242×2688
const SIZES = [
  { name: "6.7", width: 430, height: 932, dpr: 3 },
  { name: "6.5", width: 414, height: 896, dpr: 3 },
];
const TABS = [
  { label: "HQ", file: "1-hq" },
  { label: "Design", file: "2-design" },
  { label: "Market", file: "3-market" },
  { label: "Company", file: "4-company" },
];

const browser = await chromium.launch({
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});

for (const size of SIZES) {
  const dir = resolve(root, "store-shots", size.name);
  await mkdir(dir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.dpr,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1200);

  const found = await page.$('button:has-text("Found Silicon")');
  if (found) { await found.click(); await page.waitForTimeout(2200); }
  for (let i = 0; i < 10; i++) {
    const skip = await page.$(".coach__skip");
    if (!skip) break;
    await skip.click().catch(() => {});
    await page.waitForTimeout(400);
  }

  for (const t of TABS) {
    const btn = await page.$(`button:has-text("${t.label}")`);
    if (!btn) continue;
    await btn.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: resolve(dir, `${t.file}.png`) });
    console.log("wrote", `store-shots/${size.name}/${t.file}.png`);
  }
  await ctx.close();
}

await browser.close();
console.log("done — stage a richer game (some launches/hits) for the best marketing shots.");
