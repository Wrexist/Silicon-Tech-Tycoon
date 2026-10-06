// Renders compose.html to Apple's exact creative-asset canvases, then flattens to opaque RGB
// (App Store Connect rejects alpha). Usage: node appstore/creative-assets/render.mjs
// Needs Playwright (global `playwright` or the repo's playwright-core) and ImageMagick.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = { header: [3840, 1646], search: [3840, 2560] };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
for (const [name, [w, h]] of Object.entries(ASSETS)) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(dir, 'compose.html')).href + '?asset=' + name);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  const tmp = path.join(dir, `.${name}.png`);
  await page.locator('#c').screenshot({ path: tmp });
  const out = path.join(dir, `${name}-${w}x${h}.png`);
  execFileSync('convert', [tmp, '-background', '#0f1115', '-alpha', 'remove', '-alpha', 'off', '-type', 'TrueColor', '-strip', out]);
  execFileSync('rm', [tmp]);
  console.log('wrote', out);
}
await browser.close();
