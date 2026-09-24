// Isolated release audit. Run the engine audit first, then start Vite on AUDIT_URL.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
const out = resolve('artifacts/pre-testflight-audit');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.SHOTS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'] });
const url = process.env.AUDIT_URL || 'http://127.0.0.1:5181';
const report = { checks: [], observations: [], errors: [] };
let ctx, p;
const assert = (value, message) => { if (!value) throw Error(message); };
const read = () => p.evaluate(() => JSON.parse(localStorage.getItem('silicon.save.v1')));
const shot = name => p.screenshot({ path: resolve(out, `${name}.png`) });
async function check(name, fn) {
  try { await fn(); report.checks.push({ name, passed: true }); console.log('PASS', name); }
  catch (e) { report.checks.push({ name, passed: false, error: String(e), stack: e.stack }); console.log('FAIL', name, String(e)); await shot(`failure-${report.checks.length}`).catch(() => {}); const cdp = await ctx.newCDPSession(p); await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }).catch(() => {}); await p.mouse.up().catch(() => {}); }
  await writeFile(resolve(out, 'browser.json'), JSON.stringify(report, null, 2));
}
async function boot(file, width = 390, height = 844, textScale = 100, theme = 'light') {
  if (ctx) await ctx.close();
  const save = JSON.parse(await readFile(file, 'utf8'));
  for (const key of Object.keys(save)) if (key.startsWith('pending')) save[key] = Array.isArray(save[key]) ? [] : null;
  save.lastActive = Date.now(); save.valuationHistory = [];
  ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript(({ save, textScale, theme }) => {
    // Keep UI stress tests on one week. Production test explicitly releases this gate.
    window.__holdAuditClock = true;
    const interval = window.setInterval;
    window.setInterval = (fn, ms, ...args) => interval(ms === 8000 ? (...values) => { if (!window.__holdAuditClock) fn(...values); } : fn, ms, ...args);
    if (localStorage.getItem('__auditSeeded')) return;
    localStorage.setItem('__auditSeeded', '1');
    localStorage.setItem('silicon.save.v1', JSON.stringify(save));
    localStorage.setItem('silicon.settings', JSON.stringify({ theme, textScale, sound: false, haptics: false, factoryTutorialSeen: true, decorateTutorialSeen: true, notifPrompted: true }));
    localStorage.setItem('silicon.factory.camhint', '1');
    localStorage.setItem('silicon.founderIntent', 'craft');
  }, { save, textScale, theme });
  p = await ctx.newPage(); p.setDefaultTimeout(30000);
  p.on('pageerror', e => report.errors.push(e.message));
  await p.goto(url); await p.locator('.bnav__item').first().waitFor();
  await pause();
  for (let i = 0; i < 6 && await p.locator('.coach__skip').count(); i++) await p.locator('.coach__skip').click();
  await open();
}
async function pause() {
  for (let i = 0; i < 3; i++) {
    const button = p.getByRole('button', { name: 'Pause', exact: true });
    if (!await button.count()) break;
    await button.click(); await p.waitForTimeout(80);
  }
}
async function open() {
  await p.getByRole('button', { name: 'Factory', exact: true }).click();
  await p.getByRole('button', { name: 'Open factory mode', exact: true }).click();
  await p.locator('.fmode canvas').waitFor();
  await p.waitForTimeout(900);
  await p.evaluate(async () => { const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js'); window.__auditStore = _roots.get(document.querySelector('.fmode canvas')).store; });
}
async function project(c, r, height = .12) {
  return p.evaluate(async ({ c, r, height }) => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const s = window.__auditStore.getState();
    const truck = s.scene.getObjectByName('factory-delivery-truck');
    const point = truck.parent.localToWorld(new THREE.Vector3(c - 7.5, height, r - 4.5)).project(s.camera);
    const b = document.querySelector('.fmode canvas').getBoundingClientRect();
    return { x: b.x + (point.x + 1) * b.width / 2, y: b.y + (1 - point.y) * b.height / 2 };
  }, { c, r, height });
}
async function stateSample() {
  return p.evaluate(() => {
    const s = window.__auditStore.getState(), truck = s.scene.getObjectByName('factory-delivery-truck');
    return { truck: truck.position.toArray(), camera: s.camera.position.toArray(), calls: s.gl.info.render.calls, triangles: s.gl.info.render.triangles, geometries: s.gl.info.memory.geometries, textures: s.gl.info.memory.textures };
  });
}
try {
  await boot('artifacts/pre-testflight-audit/active-save.json');
  await check('Repeated pinch, orbit and camera reset do not edit or spend', async () => {
    const before = await read(), cdp = await ctx.newCDPSession(p);
    for (let i = 0; i < 3; i++) {
      const b = await p.locator('.fmode__stage').boundingBox();
      const point = (id, dx) => ({ id, x: b.x + b.width / 2 + dx, y: b.y + b.height / 2 });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(1, -16), point(2, 16)] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(1, -35), point(2, 35)] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await p.mouse.move(b.x + b.width / 2 + 35, b.y + b.height / 2 + 20, { steps: 8 }); await p.mouse.up();
      await p.getByRole('button', { name: 'Recenter view', exact: true }).click();
    }
    await p.waitForTimeout(250); const after = await read();
    assert(JSON.stringify(before.factoryFloor) === JSON.stringify(after.factoryFloor) && before.cash === after.cash, 'Gesture edited save');
  });
  await check('Recenter settles immediately after orbit', async () => {
    const samples = [];
    for (let i = 0; i < 5; i++) { samples.push(await stateSample()); await p.waitForTimeout(250); }
    report.observations.push({ recenterSamples: samples });
    const distance = Math.hypot(...samples.at(-1).camera.map((v, i) => v - samples[0].camera[i]));
    assert(distance < .001, `Camera drifted ${distance.toFixed(3)} world units after recenter`);
  });
  // Isolate editing from the separately reported camera-reset defect.
  await boot('artifacts/pre-testflight-audit/active-save.json');
  await check('Hold, move, drop and persist a machine', async () => {
    const target = await p.evaluate(async () => {
      const THREE = await import('/node_modules/.vite/deps/three.js'); const s = window.__auditStore.getState();
      const save = JSON.parse(localStorage.getItem('silicon.save.v1')), m = save.factoryFloor.machines.find(m => m.kind === 'intake');
      const meshes = []; s.scene.getObjectByName('factory-machine:' + m.id).traverse(o => { if (o.isMesh) meshes.push(o); });
      const solid = meshes.find(m => m.geometry?.type === 'BoxGeometry') || meshes[0];
      const point = new THREE.Box3().setFromObject(solid).getCenter(new THREE.Vector3()).project(s.camera), b = document.querySelector('.fmode canvas').getBoundingClientRect();
      return { x: b.x + (point.x + 1) * b.width / 2, y: b.y + (1 - point.y) * b.height / 2 };
    });
    const before = await read(), cdp = await ctx.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, ...target }] });
    await p.waitForFunction(() => !window.__auditStore.getState().controls.enabled);
    const dest = await project(14.5, 8.5);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, ...dest }] });
    await p.waitForTimeout(180); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('silicon.save.v1')).factoryFloor.machines.some(m => m.kind === 'intake' && m.c === 14 && m.r === 8));
    assert((await read()).cash === before.cash, 'Moving charged cash');
  });
  await check('Paint a belt run then Undo restores exact ownership and cash', async () => {
    const before = await read(); await p.getByRole('button', { name: 'Build', exact: true }).click(); await p.waitForTimeout(350);
    const cdp = await ctx.newCDPSession(p), start = await project(0, 9);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, ...start }] });
    for (let c = 1; c <= 5; c++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, ...await project(c, 9) }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForFunction(n => JSON.parse(localStorage.getItem('silicon.save.v1')).factoryFloor.belts.length > n, before.factoryFloor.belts.length);
    const painted = await read();
    assert(painted.cash === before.cash - (painted.factoryFloor.belts.length - before.factoryFloor.belts.length) * 40000, 'Paint charged incorrectly');
    await p.getByRole('button', { name: 'Undo the last build action', exact: true }).click();
    await p.waitForFunction(cash => JSON.parse(localStorage.getItem('silicon.save.v1')).cash === cash, before.cash);
    assert(JSON.stringify((await read()).factoryFloor) === JSON.stringify(before.factoryFloor), 'Paint Undo changed floor');
    await p.getByRole('button', { name: 'Done', exact: true }).click();
  });
  await check('Named layout and active production survive pagehide and reload', async () => {
    if (await p.getByRole('button', { name: 'Done', exact: true }).count()) await p.getByRole('button', { name: 'Done', exact: true }).click();
    await p.getByRole('button', { name: 'Style', exact: true }).click();
    await p.getByRole('textbox', { name: 'Layout name' }).fill('Audit saved layout');
    await p.getByRole('button', { name: 'Save current', exact: true }).click();
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('silicon.save.v1')).factoryLayouts.some(l => l.name === 'Audit saved layout'));
    report.observations.push({ layoutControls: await p.locator('.fmode__layout-apply,.fmode__layout-del,.fmode__layout-savebtn').evaluateAll(items => items.map(e => ({ label: e.textContent || e.getAttribute('aria-label'), width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }))) });
    await p.locator('.fmode__layout-apply').first().click();
    report.observations.push({ layoutConfirmation: await p.locator('.fmode__layout--armed').innerText() });
    await shot('layout-confirmation');
    await p.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const before = await read(); assert(before.factoryLayouts.some(l => l.name === 'Audit saved layout'), 'Layout not saved');
    await p.reload(); await p.locator('.bnav__item').first().waitFor(); await pause();
    const after = await read();
    for (const key of ['factoryFloor', 'factoryProps', 'factoryLayouts', 'building', 'ready', 'cash']) assert(JSON.stringify(after[key]) === JSON.stringify(before[key]), `${key} changed on reload`);
    await open();
  });
  await check('Background visibility pauses weeks; foreground resumes production', async () => {
    await p.getByRole('button', { name: 'Resume game', exact: true }).click();
    const before = await read();
    await p.evaluate(() => {
      window.__holdAuditClock = false;
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await p.waitForTimeout(9500); assert((await read()).week === before.week, 'Hidden page advanced time');
    await p.evaluate(() => { delete document.visibilityState; delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await p.waitForFunction(week => JSON.parse(localStorage.getItem('silicon.save.v1')).week > week, before.week, { timeout: 30000 });
    await p.evaluate(() => { window.__holdAuditClock = true; });
    const after = await read(); report.observations.push({ productionAfterForeground: { before: before.week, after: after.week, building: after.building.length, ready: after.ready.length }, body: (await p.locator('body').innerText()).slice(-2200) });
    await shot('production-ready');
  });
  await check('Launch completed production from Factory and persist exactly one launch', async () => {
    const before = await read(), id = before.ready[0]?.id; assert(id, 'No completed job');
    await p.locator('.rtl__card').getByRole('button', { name: 'Launch now', exact: true }).click();
    await p.waitForFunction(id => !JSON.parse(localStorage.getItem('silicon.save.v1')).ready.some(p => p.id === id), id);
    const after = await read(); assert(after.launched.filter(l => l.product.id === id).length === 1, 'Duplicate or missing launch');
    await shot('launch-result');
    await p.reload(); await p.locator('.bnav__item').first().waitFor();
    assert((await read()).launched.filter(l => l.product.id === id).length === 1, 'Launch lost after reload');
  });
  await boot('artifacts/pre-testflight-audit/crowded.json', 390, 844, 130, 'dark');
  await check('Expanded crowded floor at phone, iPad portrait and landscape', async () => {
    for (const [width, height] of [[390, 844], [820, 1180], [1180, 820], [844, 390]]) {
      await p.setViewportSize({ width, height }); await p.getByRole('button', { name: 'Recenter view', exact: true }).click(); await p.waitForTimeout(350);
      const bounds = await p.evaluate(() => ({ width: innerWidth, height: innerHeight, root: document.querySelector('.fmode').getBoundingClientRect().toJSON(), stage: document.querySelector('.fmode__stage').getBoundingClientRect().toJSON(), blocked: [...document.querySelectorAll('.fmode__top button,.fmode__rail button')].filter(b => { const r = b.getBoundingClientRect(); return !b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }).map(b => b.getAttribute('aria-label') || b.textContent) }));
      report.observations.push({ viewport: [width, height], bounds, renderer: await stateSample() });
      await shot(`crowded-${width}`); assert(!bounds.blocked.length, `Controls offscreen or covered: ${bounds.blocked}`);
    }
  });
  await check('Reduced motion stays still and WebGL loss offers working fallback', async () => {
    await p.setViewportSize({ width: 390, height: 844 }); await p.emulateMedia({ reducedMotion: 'reduce' });
    const sample = () => p.evaluate(() => { const out = []; window.__auditStore.getState().scene.traverse(o => { if (!o.isCamera) out.push([o.name, ...o.position.toArray(), ...o.rotation.toArray()]); }); return JSON.stringify(out); });
    await p.waitForTimeout(400); const a = await sample(); await p.waitForTimeout(500); assert(a === await sample(), 'Reduced motion moved scene');
    await p.locator('.fmode canvas').evaluate(c => c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await p.locator('.fmode .fmini').waitFor(); await p.getByRole('button', { name: 'Build', exact: true }).click();
    assert(await p.getByRole('button', { name: /^Column 1, row 1/ }).count() > 0, 'Fallback has no accessible grid'); await shot('context-loss-fallback');
  });
  await boot('artifacts/pre-testflight-audit/blocked-auto.json', 390, 844);
  await check('Crowded Auto refusal explains actual constraint', async () => {
    await p.getByRole('button', { name: 'Build', exact: true }).click();
    await p.getByRole('button', { name: 'Auto-lay a long conveyor track from the Intake to the Packer', exact: true }).click();
    const toast = await p.locator('.ds-toast').last().innerText();
    report.observations.push({ autoRefusal: toast, ownedKinds: (await read()).factoryFloor.machines.map(m => m.kind) });
    await shot('blocked-auto'); assert(!toast.includes('Place an Intake'), 'Auto incorrectly asks for Intake/Packer already owned');
  });
  await boot('artifacts/pre-testflight-audit/shared-belt.json', 390, 844);
  await check('Capture legal shared-belt head placement', async () => { await shot('shared-belt-heads'); report.observations.push({ sharedBelt: await stateSample() }); });
} finally {
  await writeFile(resolve(out, 'browser.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report.checks, null, 2));
if (report.checks.some(c => !c.passed) || report.errors.length) process.exitCode = 1;
