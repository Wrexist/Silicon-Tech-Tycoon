// Shared harness for the cinematic store media (trailer + header art). It boots the REAL game on a
// Vite dev server with the staged showcase save, then lets a script direct the in-game camera:
// every frame the main perspective camera is posed from window.__cine just before three.js draws,
// so moves are exact and frame-locked (the game's own rigs still run, they just don't get the last
// word). Nothing here ships: it is tooling, and the game code is untouched.
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

export const APP = process.env.TRAILER_URL || 'http://127.0.0.1:5191';
export const SAVE = process.env.TRAILER_SAVE || '/tmp/silicon-showcase.json';
export const OUT = process.env.TRAILER_OUT || (process.platform === 'win32' ? 'C:/tmp/cine' : '/tmp/cine');
/** Local Chrome when present (real GPU), else Playwright's Chromium (CI). */
export const CHROME = process.env.SHOTS_CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync) || chromium.executablePath();

export async function launch() {
  // A real GPU gives proper antialiasing and speed; SwiftShader is the CI fallback.
  const gpu = process.env.TRAILER_SWIFTSHADER !== '1' && process.platform === 'win32';
  return chromium.launch({
    executablePath: CHROME,
    args: gpu ? ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'],
  });
}

/** Boot the app with the staged save. `clock` installs Playwright's fake clock so frames step exactly. */
export async function boot(browser, { width, height, dpr = 2, clock = true, prep } = {}) {
  const save = JSON.parse(await readFile(SAVE, 'utf8'));
  for (const k of Object.keys(save)) if (k.startsWith('pending')) save[k] = Array.isArray(save[k]) ? [] : null;
  save.ready = []; save.lastActive = Date.now(); save.lastInterruptWeek = save.week + 500;
  prep?.(save);
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true });
  await ctx.addInitScript(save => {
    if (!localStorage.getItem('__cineSeeded')) {
      localStorage.setItem('__cineSeeded', '1');
      localStorage.setItem('silicon.save.v1', JSON.stringify(save));
      localStorage.setItem('silicon.settings', JSON.stringify({ theme: 'dark', sound: false, haptics: false, garage3d: true, graphics: 'high', decorateTutorialSeen: true, factoryTutorialSeen: true, notifPrompted: true }));
      localStorage.setItem('silicon.factory.camhint', '1'); localStorage.setItem('silicon.hint.tapteam', '1');
    }
  }, save);
  const page = await ctx.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  if (clock) await page.clock.install();
  await page.goto(APP);
  if (clock) await page.clock.runFor(2000);
  await page.locator('.bnav__item:visible, .railnav__item:visible').first().waitFor();
  for (let n = 0; n < 8 && await page.locator('.coach__skip').count(); n++) await page.locator('.coach__skip').click();
  const pause = page.getByRole('button', { name: 'Pause', exact: true }); if (await pause.count()) await pause.click();
  return { ctx, page };
}

/** Patch the live renderer of the biggest canvas so a pose in window.__cine wins for the main
 *  camera, just before each draw. Returns once the R3F root is registered. */
export async function installCamera(page) {
  await page.waitForFunction(async url => {
    const roots = (await import(url))._roots;
    const canvas = [...document.querySelectorAll('canvas')].sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
    const root = canvas && roots.get(canvas);
    if (!root) return false;
    const st = root.store.getState(), gl = st.gl;
    window.__cineStore = root.store;
    if (gl.__cine) return true;
    const render = gl.render.bind(gl);
    gl.__cine = true;
    gl.render = (scene, camera) => {
      const c = window.__cine;
      if (c && camera === root.store.getState().camera) {
        camera.position.set(...c.pos); camera.up.set(0, 1, 0); camera.lookAt(...c.target);
        if (c.fov && camera.fov !== c.fov) { camera.fov = c.fov; camera.updateProjectionMatrix(); }
        camera.updateMatrixWorld(true);
      }
      return render(scene, camera);
    };
    return true;
  }, depUrl('@react-three/fiber'), { polling: 100 });
}

/** The app's own copy of an optimized dependency: Vite serves it with a ?v= hash, and a bare
 *  import would load a second, unrelated module instance. */
export function depUrl(name) {
  const meta = JSON.parse(readFileSync('node_modules/.vite/deps/_metadata.json', 'utf8'));
  return `/node_modules/.vite/deps/${meta.optimized[name].file}?v=${meta.browserHash}`;
}

/** Make the 3D canvas under `selector` fill the viewport alone: its R3F host moves to <body> (out of
 *  every transformed / blurred ancestor) and the app UI is hidden underneath. Capture-only. */
export async function fullBleed(page, selector) {
  await page.evaluate(sel => {
    // the biggest match is the live scene (a held card canvas can still be in the DOM)
    const canvas = [...document.querySelectorAll(sel)].sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
    const host = canvas.parentElement.parentElement;
    host.setAttribute('data-cine', '1');
    document.body.appendChild(host);
    const style = document.createElement('style');
    style.textContent = `body>*:not([data-cine]){visibility:hidden!important}
      [data-cine]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:2147483646!important;border-radius:0!important;margin:0!important;transform:none!important;visibility:visible!important}
      body{overflow:hidden!important;background:#0b1320!important}`;
    document.head.appendChild(style);
    window.dispatchEvent(new Event('resize'));
  }, selector);
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const mix3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
/** A pose orbiting `target` at radius r, yaw (rad, 0 = +z), height y above the target. */
export const orbit = (target, r, yaw, y) => ({ target, pos: [target[0] + Math.sin(yaw) * r, target[1] + y, target[2] + Math.cos(yaw) * r] });
