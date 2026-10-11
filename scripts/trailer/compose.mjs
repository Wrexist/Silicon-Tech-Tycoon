// Edits the clips from capture.mjs into the App Store preview: renders compose.html frame by frame,
// then encodes Apple's 6.9" preview spec (886 × 1920, 30 fps, H.264 High, stereo AAC).
//   node scripts/trailer/compose.mjs          (SHOTS_FFMPEG=<path to ffmpeg> if it is not on PATH)
import { mkdir, rm, writeFile, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { OUT, CHROME } from './lib.mjs';

const ffmpeg = process.env.SHOTS_FFMPEG || 'ffmpeg';
const film = join(OUT, 'film');
await rm(film, { recursive: true, force: true }); await mkdir(film, { recursive: true });
await copyFile('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', join(OUT, 'icon.png'));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 886, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(`${pathToFileURL(resolve('scripts/trailer/compose.html')).href}?root=${encodeURIComponent(pathToFileURL(resolve(OUT)).href)}`);
await page.evaluate(() => document.fonts.ready);
const total = await page.evaluate(() => window.TOTAL);
const cdp = await page.context().newCDPSession(page);
for (let n = 0; n < total; n++) {
  await page.evaluate(n => window.renderFrame(n), n);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(film, `${String(n).padStart(4, '0')}.png`), Buffer.from(data, 'base64'));
  if (n % 90 === 0) console.log('FRAME', n, '/', total);
}
await browser.close();

const target = join(OUT, 'Silicon-1.4.0-iPhone.mp4');
const run = args => { const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' }); if (r.status !== 0) throw Error(`ffmpeg failed (${r.status})`); };
run(['-framerate', '30', '-i', join(film, '%04d.png'), '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
  '-frames:v', String(total), '-r', '30', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.0', '-preset', 'slow',
  '-b:v', '10M', '-minrate', '10M', '-maxrate', '10M', '-bufsize', '20M', '-x264-params', 'nal-hrd=cbr:force-cfr=1',
  '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', target]);
run(['-ss', '3', '-i', target, '-frames:v', '1', join(OUT, 'poster.png')]);
console.log('PREVIEW', target, `${(total / 30).toFixed(1)}s, 886x1920, 30fps`);
