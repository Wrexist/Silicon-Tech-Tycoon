// Renders compose.html to Apple's exact creative-asset canvases, flattened to opaque RGB PNG
// (App Store Connect rejects alpha). The 3D plates come from scripts/trailer/stills.mjs.
//   node scripts/trailer/stills.mjs && node appstore/creative-assets/render.mjs
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { OUT, CHROME } from '../../scripts/trailer/lib.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(OUT);
const ASSETS = { header: [3840, 1646], search: [3840, 2560], universal: [5244, 2950] };
const browser = await chromium.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files'] });
for (const [name, [w, h]] of Object.entries(ASSETS)) {
  const page = await browser.newPage({ viewport: { width: w / 2, height: h / 2 }, deviceScaleFactor: 2 });
  await page.goto(`${pathToFileURL(path.join(dir, 'compose.html')).href}?asset=${name}&root=${encodeURIComponent(pathToFileURL(root).href)}`);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
  const png = await page.locator('#c').screenshot();
  const out = path.join(dir, `${name}-${w}x${h}.png`);
  const meta = await sharp(png).metadata();
  if (meta.width !== w || meta.height !== h) throw Error(`${name}: rendered ${meta.width}x${meta.height}, expected ${w}x${h}`);
  await sharp(png).flatten({ background: '#0b1018' }).removeAlpha().png({ compressionLevel: 9 }).toFile(out);
  console.log('wrote', out);
  await page.close();
}
await browser.close();
