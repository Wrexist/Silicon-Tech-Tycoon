// Captures the raw clips for the App Store preview: directed 3D camera moves through the real Office
// and Factory, plus live UI clips, each a PNG sequence stepped on a fake clock (no dropped frames).
//   npx vite --port 5191 --strictPort --host 127.0.0.1   (the dev server)
//   npm run shots:stage:showcase && node scripts/trailer/capture.mjs [clipId ...]
// Output: $TRAILER_OUT/clips/<id>/0000.png… (default C:/tmp/cine). compose.mjs turns them into the film.
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { launch, boot, installCamera, fullBleed, ease, mix3, orbit, OUT, APP } from './lib.mjs';

export const FPS = 30;
const VIEW = { width: 443, height: 960, dpr: 2 }; // 886 × 1920, Apple's 6.9" preview size

/** A camera move between two orbit poses, eased; yaw / radius / height all interpolate. */
const move = (a, b, fov = 30) => t => {
  const k = ease(t), target = mix3(a.target, b.target, k);
  const p = orbit(target, a.r + (b.r - a.r) * k, a.yaw + (b.yaw - a.yaw) * k, a.y + (b.y - a.y) * k);
  return { ...p, fov };
};

const factoryPrep = s => { for (const b of s.building) { b.totalWeeks = Math.max(b.totalWeeks, 12); b.weeksElapsed = 3; } };
async function openFactory(page) {
  await page.locator('.bnav__item:visible, .railnav__item:visible').filter({ hasText: 'Office' }).click();
  await page.getByRole('button', { name: 'Factory', exact: true }).click();
  await page.getByRole('button', { name: 'Open factory mode', exact: true }).click();
  await page.locator('.fmode canvas').waitFor();
  await page.clock.runFor(1500);
  const resume = page.getByRole('button', { name: 'Resume game', exact: true }); if (await resume.count()) await resume.click();
}
async function openOffice(page) {
  await page.locator('.bnav__item:visible, .railnav__item:visible').filter({ hasText: 'Office' }).click();
  await page.locator('.hq__scene canvas').waitFor();
  await page.clock.runFor(1500);
}

export const CLIPS = {
  // Wide over the team, gliding down to desk level.
  office: { frames: 165, prep: s => { s.building = []; }, open: openOffice, canvas: '.hq__scene canvas',
    cam: move({ target: [0, 1.2, 0], r: 25, yaw: .95, y: 13 }, { target: [.6, 1.15, .6], r: 11, yaw: .25, y: 4.2 }, 30) },
  // A crane move: from the whole floor plan down into the line.
  factory: { frames: 195, prep: factoryPrep, open: openFactory, canvas: 'canvas',
    cam: move({ target: [0, 0, 2], r: 46, yaw: -.2, y: 34 }, { target: [-1.5, .7, -1], r: 15, yaw: .8, y: 5.5 }, 38) },
  // The finale: the office pulls back to a wide hero view.
  finale: { frames: 150, prep: s => { s.building = []; }, open: openOffice, canvas: '.hq__scene canvas',
    cam: move({ target: [0, 1.3, 0], r: 13, yaw: -.45, y: 5 }, { target: [0, 1, .5], r: 31, yaw: .55, y: 17 }, 30) },
  design: { frames: 120, ui: true, prep: s => { s.building = []; }, open: async page => {
    await page.locator('.bnav__item:visible, .railnav__item:visible').filter({ hasText: 'Design' }).click();
    await page.getByRole('tab', { name: 'Style', exact: true }).click();
    const back = page.getByRole('button', { name: 'View back', exact: true }); if (await back.count()) await back.click();
    await page.locator('.lab__hero').scrollIntoViewIfNeeded();
  }, at: { 45: async page => page.getByRole('button', { name: 'View front', exact: true }).dispatchEvent('click') } },
  research: { frames: 120, ui: true, prep: s => { s.building = []; }, open: async page => {
    await page.locator('.bnav__item:visible, .railnav__item:visible').filter({ hasText: 'Research' }).click();
    const resume = page.getByRole('button', { name: 'Resume', exact: true }); if (await resume.count()) await resume.click();
  } },
  market: { frames: 110, ui: true, prep: s => { s.building = []; }, open: async page => {
    await page.locator('.bnav__item:visible, .railnav__item:visible').filter({ hasText: 'Market' }).click();
  }, scroll: 260 },
};

async function capture(browser, id) {
  const clip = CLIPS[id], dir = join(OUT, 'clips', id);
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const { ctx, page } = await boot(browser, { ...VIEW, prep: clip.prep });
  await clip.open(page);
  if (clip.cam) {
    await installCamera(page);
    await fullBleed(page, clip.canvas);
    await page.evaluate(p => { window.__cine = p; }, clip.cam(0));
    await page.clock.runFor(1200); // settle the resize + first frames at the opening pose
  } else {
    await page.clock.runFor(1200);
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  }
  const scroller = clip.scroll ? await page.evaluateHandle(() => [...document.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)) || document.scrollingElement) : null;
  const cdp = await ctx.newCDPSession(page);
  for (let i = 0; i < clip.frames; i++) {
    const t = i / (clip.frames - 1);
    if (clip.cam) await page.evaluate(p => { window.__cine = p; }, clip.cam(t));
    if (clip.at?.[i]) await clip.at[i](page);
    if (scroller) await scroller.evaluate((el, y) => { el.scrollTop = y; }, Math.round(ease(t) * clip.scroll));
    await page.clock.runFor(1000 / FPS);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(dir, `${String(i).padStart(4, '0')}.png`), Buffer.from(data, 'base64'));
  }
  console.log('CLIP', id, clip.frames, 'frames');
  await ctx.close();
}

const browser = await launch();
try {
  // Warm Vite's dependency optimizer first: its first load can re-optimize and reload the page.
  { const warm = await browser.newPage(); await warm.goto(APP); await warm.waitForTimeout(8000); await warm.close(); }
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS);
  for (const id of ids) await capture(browser, id);
} finally { await browser.close(); }
