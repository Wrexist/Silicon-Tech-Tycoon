// Renders the raw 3D plates for the App Store Header / Search Results art: each world full-bleed at
// the asset's exact aspect, from a directed camera. PROBE=1 renders a contact sheet of candidate poses.
//   node scripts/trailer/stills.mjs            → $TRAILER_OUT/plates/<asset>-<world>.png
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { launch, boot, installCamera, fullBleed, orbit } from './lib.mjs';

const OUT = process.env.TRAILER_OUT || 'C:/tmp/cine';
const PROBE = process.env.PROBE === '1';
export const ASSETS = { header: [1920, 823], search: [1920, 1280], universal: [2622, 1475] };
const WORLDS = {
  office: { prep: s => { s.building = []; }, canvas: '.hq__scene canvas', open: async page => {
    await page.locator('.bnav__item:visible, .railnav__item:visible').filter({ hasText: 'Office' }).click();
    await page.locator('.hq__scene canvas').waitFor();
  } },
  factory: { prep: s => { for (const b of s.building) { b.totalWeeks = Math.max(b.totalWeeks, 12); b.weeksElapsed = 3; } }, canvas: 'canvas', open: async page => {
    await page.locator('.bnav__item:visible, .railnav__item:visible').filter({ hasText: 'Office' }).click();
    await page.getByRole('button', { name: 'Factory', exact: true }).click();
    await page.getByRole('button', { name: 'Open factory mode', exact: true }).click();
    await page.locator('.fmode canvas').waitFor();
    await page.clock.runFor(1500);
    const resume = page.getByRole('button', { name: 'Resume game', exact: true }); if (await resume.count()) await resume.click();
  } },
};
// Final poses per world (shared by every asset; the composer places each world on its side).
export const POSES = {
  office: { ...orbit([2, 1.3, 1], 12, .15, 3.6), fov: 30 },
  factory: { ...orbit([-3, 1, -3], 12.5, 1.3, 4.2), fov: 34 },
};
const CANDIDATES = {
  office: [orbit([1.5, 1.4, .5], 16, .55, 5.5), orbit([0, 1.2, 0], 20, .9, 9), orbit([2, 1.3, 1], 12, .15, 3.6), orbit([0, 1.3, -1], 24, -.6, 10)],
  factory: [orbit([-2, .6, -1], 17, .95, 6.5), orbit([0, .5, 2], 26, .5, 12), orbit([-3, 1, -3], 11, 1.3, 3.6), orbit([1, .5, 3], 22, -.5, 8)],
};

const browser = await launch();
await mkdir(join(OUT, 'plates'), { recursive: true });
try {
  for (const [asset, [w, h]] of Object.entries(PROBE ? { header: ASSETS.header } : ASSETS)) for (const [id, world] of Object.entries(WORLDS)) {
    const { ctx, page } = await boot(browser, { width: w, height: h, dpr: PROBE ? 1 : 2, prep: world.prep });
    await world.open(page);
    await page.clock.runFor(1500);
    await installCamera(page);
    await fullBleed(page, world.canvas);
    const poses = PROBE ? CANDIDATES[id].map(p => ({ ...p, fov: id === 'office' ? 30 : 34 })) : [POSES[id]];
    for (const [i, pose] of poses.entries()) {
      await page.evaluate(p => { window.__cine = p; }, pose);
      await page.clock.runFor(1500);
      await page.screenshot({ path: join(OUT, 'plates', PROBE ? `probe-${id}-${i}.png` : `${asset}-${id}.png`) });
    }
    console.log('PLATE', asset, id);
    await ctx.close();
  }
} finally { await browser.close(); }
