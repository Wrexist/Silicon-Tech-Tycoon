// Focused regression check for the toast / simulation-control overlay collision (`npm run verify:overlay`).
//
// The bug: `.ds-toast-host` reserved 96px from the viewport bottom, but the floating SpeedDial owns the
// band from 72px to 132px (44px collapsed / 60px expanded) — so a toast (bottom 96) overlapped the top
// of the speed controls, and the toast button sat in front of them (z 60 vs 27). Fix: one shared token
// family (`--bottom-chrome*` in design/tokens.css) reserves the persistent-control band, toasts stack
// ABOVE it, and the scroll spacer keeps using the same band. This script proves the RELATIONSHIP in the
// real built app, with the real toast and the real controls:
//
//   1. layout     — with a real toast visible, the toast box never intersects the speed dial
//   2. input      — pause / fast-forward / skip / Shop still respond with the toast up
//   3. pointer    — elementFromPoint at each control (and the 3D canvas) hits the control/canvas,
//                   never an invisible overlay; camera drag on the canvas still receives events
//   4. dismissal  — tapping the toast dismisses it; an untouched toast times out
//   5. stress     — a long, wrapped toast keeps the same no-collision guarantee
//
// Usage:
//   npm run build && npm run shots:stage && npm run verify:overlay
//   node scripts/verify-overlay.mjs --shots before [--viewport 390x844] [--theme dark] [--text 130]
// Env: SHOTS_SAVE=<json> overrides the staged save.
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const indexFile = resolve(distDir, "index.html");

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const shotLabel = arg("shots");
const [vpW, vpH] = (arg("viewport", "390x844")).split("x").map((n) => Number(n) || 0);
const viewport = { width: vpW || 390, height: vpH || 844 };
const theme = arg("theme", "dark");
const achievement = process.argv.includes("--achievement");
const legacy = process.argv.includes("--legacy");
const safeArea = Number(arg("safe", "0"));
const textScale = Number(arg("text", "100")) || 100;

if (!existsSync(indexFile)) {
  console.error("dist/index.html not found. Run `npm run build` first.");
  process.exit(1);
}

// ---- save fixture: the populated review save unless SHOTS_SAVE / --save says otherwise -------------
const savePath = arg("save") || process.env.SHOTS_SAVE || "/tmp/silicon-stage.json";
if (!existsSync(savePath)) {
  console.error(`staged save not found at ${savePath}. Run \`npm run shots:stage\` or pass --save <json>.`);
  process.exit(1);
}
const save = JSON.parse((await readFile(savePath)).toString());
save.lastActive = Date.now();
if(achievement) { save.unlockedAchievements=(save.unlockedAchievements||[]).filter(id=>id!=="rev-1m"); save.cumulativeRevenue=99999900; }
// Quiet the interrupt cadence: a modal popping mid-check covers the controls and measures the wrong
// thing. This is a layout/input check, not an interrupt test.
for (const k of Object.keys(save)) if (/^pending/.test(k)) save[k] = null;
save.interruptPace = "calm";
save.lastInterruptWeek = save.week;
const staged = JSON.stringify(save);

// ---- serve dist/ ------------------------------------------------------------------------------------
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon", ".glb": "model/gltf-binary" };
const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    const candidate = p === "/" ? indexFile : resolve(distDir, "." + normalize(p));
    if (!candidate.startsWith(distDir)) { res.writeHead(403); return res.end(); }
    let file = candidate, body;
    try { body = await readFile(candidate); } catch { file = indexFile; body = await readFile(indexFile); }
    res.writeHead(200, { "content-type": MIME[extname(file)] || "text/html" });
    res.end(body);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(0, r));
const URL = `http://localhost:${server.address().port}`;

function findChrome() {
  if (process.env.SHOTS_CHROME) return process.env.SHOTS_CHROME;
  const candidates = process.platform === "win32"
    ? [
        `${process.env["ProgramFiles"]}\\Google\\Chrome\\Application\\chrome.exe`,
        `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
        `${process.env["LOCALAPPDATA"]}\\Google\\Chrome\\Application\\chrome.exe`,
        `${process.env["ProgramFiles"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
        `${process.env["ProgramFiles(x86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
      ]
    : process.platform === "darwin"
      ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
      : ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return candidates.find((c) => c && existsSync(c));
}
const exe = findChrome();
if (!exe) { console.error("No Chrome/Edge found. Set SHOTS_CHROME."); server.close(); process.exit(1); }

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
await ctx.addInitScript((v) => {
  // Hold only toast expiry during multi-step input assertions on slow software rendering.
  // Timeout behavior is exercised separately with this diagnostic clock hold disabled.
  window.__THREE_DEVTOOLS__={dispatchEvent(e){const r=e.detail;if(r?.isWebGLRenderer){window.__renderer=r;const render=r.render;r.render=function(scene,camera){if(camera.isPerspectiveCamera)window.__camera=camera;return render.call(this,scene,camera);};}}};
  window.__holdToast = true;
  window.__toastExpiry = [];
  const timeout = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms, ...args) => {
    if(ms === 2600 && window.__holdToast) { window.__toastExpiry.push(()=>fn(...args)); return 0; }
    return timeout(fn, ms, ...args);
  };
  localStorage.setItem("silicon.save.v1", v.staged);
  localStorage.setItem("silicon.settings", JSON.stringify({
    theme: v.theme, sound: false, haptics: false, highContrast: false,
    decorateTutorialSeen: true, factoryTutorialSeen: true, notifPrompted: true,
    ...(v.scale === 100 ? {} : { textScale: v.scale }),
  }));
}, { staged, theme, scale: textScale });
const p = await ctx.newPage();
const pageErrors = [];
p.on("pageerror", (e) => pageErrors.push(e.message));

const problems = [];
const note = (m) => { problems.push(m); console.log("  FAIL  " + m); };
const ok = (m) => console.log("  ok    " + m);
const sleep = (ms) => p.waitForTimeout(ms);

const visible = (sel) => p.locator(sel).filter({ visible: true }).first();

async function dismissBoot() {
  await p.click('.ds-sheet button:has-text("Continue")', { timeout: 5000 }).catch(() => {});
  for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await sleep(200); }
  for (let i = 0; i < 6; i++) {
    const dialog = (await p.$('[role="dialog"]')) ?? (await p.$(".ds-sheet"));
    if (!dialog) break;
    await p.keyboard.press("Escape").catch(() => {});
    await sleep(300);
  }
}

/** Is the SpeedDial's collapsed primary labeled Pause (sim running) or Resume (paused)? */
async function dialLabel() {
  return p.locator(".speeddial__btn--primary").getAttribute("aria-label").catch(() => null);
}

/** Pause through the REAL control path: the collapsed primary discloses, the expanded one commits. */
async function pauseViaDial() {
  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await dialLabel()) === "Resume") return true;
    await p.locator(".speeddial__btn--primary").click({ timeout: 2000 }).catch(() => {});
    await sleep(200);
    await p.locator(".speeddial__btn--primary").click({ timeout: 2000 }).catch(() => {});
    await sleep(300);
  }
  return (await dialLabel()) === "Resume";
}

async function openDial() {
  if (await p.locator(".speeddial--open").count()) return;
  await p.locator(".speeddial__btn--primary").click({ timeout: 2000 }).catch(() => {});
  await sleep(200);
}

/** The real Settings → Export save flow: a genuine positive toast from the app's own UI. Closing the
 *  sheet without touching the dial matters — Escape would also collapse the dial (its own handler). */
async function toastViaExport() {
  if (!(await p.locator('.ds-sheet button:has-text("Export save")').count())) {
    await p.locator('button[aria-label="Settings"]').click({timeout:10000});
  }
  await p.locator('.ds-sheet button:has-text("Export save")').first().click({timeout:10000});
  await p.locator('.ds-sheet button:has-text("Done")').first().click({timeout:10000});
  await p.locator('.ds-sheet button:has-text("Export save")').waitFor({state:'hidden',timeout:10000});
  return (await p.locator('.ds-toast').count()) > 0;
}

/** Fallback real toast: let the sim tick — the milestone/event diff streams fire their own toast. */
async function toastViaTick() {
  await openDial();
  const label = await dialLabel();
  if (label === "Resume") await p.locator(".speeddial__btn--primary").click({ timeout: 2000 }).catch(() => {});
  await sleep(150);
  const appeared = await p.locator(".ds-toast").first().waitFor({ state: "visible", timeout: 7000 }).then(() => true).catch(() => false);
  return appeared;
}

/** Ensure at least one real toast is on screen; returns the trigger that worked. */
let achievementTriggered=false;
async function ensureToast() {
  if(achievement && await p.locator('.ds-toast').filter({hasText:'Achievement unlocked, First Million'}).count()) achievementTriggered=true;
  if(achievement && !achievementTriggered && !(await p.locator('.ds-toast').count())) {
    await openDial();
    if((await dialLabel())==='Resume') await p.locator('.speeddial__btn--primary').click();
    await p.locator('.ds-toast').filter({hasText:'Achievement unlocked, First Million'}).waitFor({state:'visible',timeout:15000});
    await pauseViaDial();
    achievementTriggered=true;
    return 'achievement-first-million';
  }
  if (await p.locator(".ds-toast").count()) return "already";
  if (await toastViaExport()) return "settings-export";
  if (await toastViaTick()) return "sim-tick";
  return null;
}

async function rects() {
  return p.evaluate(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
    const toast = document.querySelector(".ds-toast");
    const dial = document.querySelector(".speeddial");
    return {
      toast: toast ? { ...box(toast), text: toast.textContent } : null,
      dial: dial ? { ...box(dial), open: dial.classList.contains("speeddial--open") } : null,
      btns: [...document.querySelectorAll(".speeddial__btn")].filter((b) => b.offsetParent !== null).map((b) => ({ label: b.getAttribute("aria-label"), pressed: b.getAttribute("aria-pressed"), ...box(b) })),
    };
  });
}

const intersects = (a, b) => a && b && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;

async function layoutCheck(tag) {
  const r = await rects();
  if (!r.toast) { note(`${tag}: no toast on screen at measure time`); return false; }
  if (!r.dial) { note(`${tag}: no .speeddial on screen to compare against`); return false; }
  const hit = intersects(r.toast, r.dial);
  const fmt = (b) => `[${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)}]`;
  if (hit) note(`${tag}: toast ${fmt(r.toast)} INTERSECTS the speed dial ${fmt(r.dial)} (${r.dial.open ? "expanded" : "collapsed"})`);
  else ok(`${tag}: toast ${fmt(r.toast)} clears dial ${fmt(r.dial)} (${r.dial.open ? "expanded" : "collapsed"})`);
  // The toast must stay inside the viewport even when its text wraps.
  if (r.toast.x < 0 || r.toast.right > (await p.evaluate(() => innerWidth)) + 0.5) note(`${tag}: toast overflows the viewport horizontally (${fmt(r.toast)})`);
  return !hit;
}

async function pointerCheck(tag) {
  const r = await rects();
  if (!r.dial) { note(`${tag}: no dial for pointer check`); return; }
  // Every visible speed control's centre must hit that control, not an invisible overlay.
  const results = await p.evaluate(() => [...document.querySelectorAll(".speeddial__btn")]
    .filter((b) => b.offsetParent !== null)
    .map((b) => {
      const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { label: b.getAttribute("aria-label"), hit: !!el && (el === b || b.contains(el)), got: el ? `${el.tagName}.${el.className}` : "null" };
    }));
  for (const res of results) {
    if (!res.hit) note(`${tag}: elementFromPoint over "${res.label}" returns ${res.got} — an overlay is intercepting`);
    else ok(`${tag}: "${res.label}" centre hits itself`);
  }
  // The camera canvas must not be covered by the (pointer-events:none) toast host. A VISIBLE toast
  // covering part of the scene is normal transient UI — the check is that a clear canvas point is
  // actually the canvas (no invisible full-screen layer), not that toasts avoid the 3D view.
  const canvasHit = await p.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const toast = document.querySelector(".ds-toast")?.getBoundingClientRect();
    const covers = (x, y) => toast && x >= toast.x && x <= toast.right && y >= toast.y && y <= toast.bottom;
    // Prefer the canvas centre, but fall back to points above/below a visible toast.
    const candidates = [[r.x + r.width / 2, r.y + r.height / 2], [r.x + r.width / 2, r.y + r.height * 0.25], [r.x + r.width / 2, r.y + r.height * 0.75]];
    for (const [x, y] of candidates) {
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight || covers(x, y)) continue;
      const el = document.elementFromPoint(x, y);
      return { hit: !!el && (el === c || c.contains(el) || el.tagName === "CANVAS"), got: el ? `${el.tagName}.${el.className}`.slice(0, 50) : "null", x: Math.round(x), y: Math.round(y), centreCovered: covers(candidates[0][0], candidates[0][1]) };
    }
    return { hit: false, got: "every probe point covered", x: 0, y: 0, centreCovered: true };
  });
  if (canvasHit && !canvasHit.hit) note(`${tag}: no clear canvas point — canvas is covered by ${canvasHit.got}`);
  else if (canvasHit) ok(`${tag}: canvas clear at (${canvasHit.x},${canvasHit.y})${canvasHit.centreCovered ? " — the visible toast covers the exact centre (transient, tap-to-dismiss)" : ""}`);
  if(canvasHit?.hit) {
    await p.evaluate(()=>{window.__canvasMoves=0;document.querySelector('canvas').addEventListener('pointermove',()=>window.__canvasMoves++);});
    await p.mouse.move(canvasHit.x,canvasHit.y);
    await p.mouse.move(canvasHit.x+5,canvasHit.y+5);
    const before=await p.evaluate(()=>window.__camera?.position.toArray());
    await p.keyboard.down('a');await sleep(450);await p.keyboard.up('a');await sleep(400);
    const result=await p.evaluate(()=>({moves:window.__canvasMoves,camera:window.__camera?.position.toArray()}));
    if(!result.moves) note('camera: canvas received no pointer moves');
    else ok('camera: real pointer movement reaches canvas');
    if(!before || !result.camera || !before.some((n,i)=>Math.abs(n-result.camera[i])>.001)) note('camera: A input did not move camera');
    else ok('camera: A input moved the camera with the toast visible');
  }
  return results;
}

async function inputCheck(trigger) {
  // Keep a toast on screen through the whole interaction sequence; re-trigger if it times out.
  let fired = (await ensureToast()) ?? null;
  if (!fired) { note("input: could not raise a real toast"); return; }
  const withToast = async (name, fn) => {
    if (!(await p.locator(".ds-toast").count())) fired = (await ensureToast()) ?? fired;
    const had = await p.locator(".ds-toast").count();
    if (!had) { note(`${name}: no real toast could be kept on screen — check not exercised`); return; }
    await fn();
  };

  // Explicit interception probe: with a fresh toast up, does the toast cover any control centre?
  await withToast("interception", async () => {
    const covered = await p.evaluate(() => {
      const toast = document.querySelector(".ds-toast");
      if (!toast) return null;
      const tr = toast.getBoundingClientRect();
      return {
        toast: `[${Math.round(tr.x)},${Math.round(tr.y)} ${Math.round(tr.width)}x${Math.round(tr.height)}]`,
        controls: [...document.querySelectorAll(".speeddial__btn")]
          .filter((b) => b.offsetParent !== null)
          .map((b) => {
            const r = b.getBoundingClientRect();
            const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
            const insideToast = cx >= tr.x && cx <= tr.right && cy >= tr.y && cy <= tr.bottom;
            const el = document.elementFromPoint(cx, cy);
            return { label: b.getAttribute("aria-label"), cx: Math.round(cx), cy: Math.round(cy), insideToast, hitsSelf: !!el && (el === b || b.contains(el)), got: el ? `${el.tagName}.${el.className}`.slice(0, 50) : "null" };
          }),
      };
    });
    if (!covered) { note("interception: no toast at probe time"); return; }
    for (const c of covered.controls) {
      const where = `centre (${c.cx},${c.cy}) inside toast ${covered.toast}`;
      if (c.insideToast || !c.hitsSelf) note(`interception: "${c.label}" ${where} -> elementFromPoint ${c.got} — BLOCKED`);
      else ok(`interception: "${c.label}" centre is clear of the toast`);
    }
  });

  await withToast("pause", async () => {
    await openDial();
    const before = await dialLabel();
    await p.locator(".speeddial__btn--primary").click({ timeout: 5000 }).catch((e) => note(`pause: click blocked — ${String(e).split("\n")[0]}`));
    await sleep(250);
    const after = await dialLabel();
    if (after !== before && ["Resume", "Pause"].includes(after)) ok("pause: pause committed while a toast was up");
    else note(`pause: state did not flip (${before} -> ${after})`);
  });

  await withToast("resume", async () => {
    await openDial();
    const before = await dialLabel();
    await p.locator(".speeddial__btn--primary").click({ timeout: 5000 }).catch((e) => note(`resume: click blocked — ${String(e).split("\n")[0]}`));
    await sleep(250);
    const after = await dialLabel();
    if (after !== before && ["Resume", "Pause"].includes(after)) ok("resume: sim restarted while a toast was up");
    else note(`resume: state did not flip (label ${after})`);
  });

  // Choosing a control collapses the dial (by design), so re-open it before reading the new state.
  // "Responded" is read from whichever control the app actually left lit: fast-forward flips to
  // Normal speed, skip flips to Stop skipping, and either can auto-pause at the next decision —
  // all three are the app acknowledging the tap.
  for (const [name, label, onLabel] of [["fast-forward", "Fast forward", "Normal speed"], ["skip", "Skip to next event", "Stop skipping"]]) {
    await withToast(name, async () => {
      await openDial();
      const btn = p.locator(`.speeddial__btn[aria-label="${label}"]`);
      if (!(await btn.count())) { note(`${name}: control missing from the expanded dial`); return; }
      await btn.click({ timeout: 5000 }).catch((e) => note(`${name}: click blocked — ${String(e).split("\n")[0]}`));
      await sleep(250);
      await openDial();
      const on = await p.locator(`.speeddial__btn[aria-label="${onLabel}"]`).count();
      const autoPaused = (await dialLabel()) === "Resume";
      if (on || autoPaused) ok(`${name}: acknowledged while a toast was up${on ? "" : " (auto-paused at a decision)"}`);
      else note(`${name}: no state change and no auto-pause — the tap did nothing`);
      // toggle back off so the next check starts clean (choosing again collapses the dial)
      const off = p.locator(`.speeddial__btn[aria-label="${onLabel}"]`);
      if (await off.count()) { await off.click({ timeout: 5000 }).catch(() => {}); await sleep(200); }
    });
  }
  await pauseViaDial();

  await withToast("shop", async () => {
    // The Shop button rides the office card, so on a short screen it can start below the fold —
    // bring it into view the way a player would (centre it), then probe it.
    await p.evaluate(() => document.querySelector(".hq__decorate")?.scrollIntoView({ block: "center" }));
    await sleep(350);
    const hit = await p.evaluate(() => {
      const b = document.querySelector(".hq__decorate");
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { hit: !!el && (el === b || b.contains(el)), got: el ? `${el.tagName}.${el.className}` : "null" };
    });
    if (!hit) { note("shop: Shop button missing"); return; }
    if (!hit.hit) { note(`shop: elementFromPoint over Shop returns ${hit.got}`); return; }
    await p.locator(".hq__decorate").click({ timeout: 5000 }).catch((e) => note(`shop: click blocked — ${String(e).split("\n")[0]}`));
    await sleep(500);
    const opened = await p.evaluate(() => document.body.classList.contains("hq-deco-open"));
    if (opened) ok("shop: Decorate opened while a toast was up");
    else note("shop: Decorate did not open");
    await p.locator('.hqb__top-actions button:has-text("Done")').click({ timeout: 5000 }).catch(() => {});
    await sleep(500);
  });

  await withToast("toast-dismiss", async () => {
    const dismissedLabel=await p.locator(".ds-toast").first().getAttribute("aria-label");
    await p.locator(".ds-toast").first().click({ timeout: 5000 }).catch((e) => note(`toast-dismiss: click blocked — ${String(e).split("\n")[0]}`));
    await sleep(250);
    if (!(await p.getByRole("button",{name:dismissedLabel,exact:true}).count())) ok("toast-dismiss: tapping the toast dismissed it");
    else note("toast-dismiss: toast still on screen after a tap");
  });

  // Release held expiry callbacks, then test an untouched real 2600 ms timeout.
  await p.evaluate(()=>{window.__holdToast=false;window.__toastExpiry.splice(0).forEach(fn=>fn());});
  // Timeout path: raise one more and leave it alone.
  if (!(await p.locator(".ds-toast").count())) fired = (await ensureToast()) ?? fired;
  if (await p.locator(".ds-toast").count()) {
    await sleep(3400);
    if ((await p.locator(".ds-toast").count()) === 0) ok("toast-timeout: untouched toast retired on its own");
    else note("toast-timeout: toast outlived its 2.6s window");
  }
  return fired;
}

async function longTextCheck() {
  await p.evaluate(()=>{window.__holdToast=true;});
  const fired = (await ensureToast()) ?? null;
  if (!fired) { note("wrapped-text: no real toast available to stress"); return; }
  await p.evaluate(() => {
    const t = document.querySelector(".ds-toast span:last-child");
    if (t) t.textContent = "Revenue milestone, $100B earned lifetime — your brand is growing across every region!";
  });
  await sleep(120);
  await layoutCheck("wrapped-text");
  const r = await rects();
  if (r.toast && r.toast.h < 34) note(`wrapped-text: toast did not actually wrap (height ${Math.round(r.toast.h)}) — stress inconclusive`);
  else if (r.toast) ok(`wrapped-text: ${Math.round(r.toast.h)}px tall toast still clears the dial`);
}

// ---- run --------------------------------------------------------------------------------------------
try {
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(3200);
  if(safeArea) await p.addStyleTag({content: `:root {--finish-safe:${safeArea}px} .speeddial {bottom:calc(var(--bottom-chrome-bottom) + var(--finish-safe))} .ds-toast-host {bottom:calc(var(--bottom-chrome) + var(--finish-safe))}`});
  await dismissBoot();
  if(legacy) await p.addStyleTag({content:".ds-toast-host{bottom:calc(96px + env(safe-area-inset-bottom))}"});
  if (!(await pauseViaDial())) note("boot: could not pause the sim through the SpeedDial");

  if (shotLabel && !achievement) {
    const outDir = resolve(root, ".shots", shotLabel);
    await mkdir(outDir, { recursive: true });
    await p.evaluate(()=>window.__toastExpiry.splice(0).forEach(fn=>fn()));
    await sleep(2600); // let boot toasts clear → idle presentation
    await p.screenshot({ path: resolve(outDir, `idle-${viewport.width}x${viewport.height}-${theme}.png`) });
    console.log(`  shot  idle -> .shots/${shotLabel}/idle-${viewport.width}x${viewport.height}-${theme}.png`);
  }

  console.log(`\nverify:overlay  ${viewport.width}x${viewport.height} dpr=2 theme=${theme} text=${textScale}%  ${exe.split("\\").pop()}`);
  console.log('environment',JSON.stringify(await p.evaluate(()=>({viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,canvases:[...document.querySelectorAll('canvas')].map(c=>[c.width,c.height]),overflow:document.documentElement.scrollWidth>innerWidth,backend:(()=>{const gl=window.__renderer?.getContext();if(!gl)return null;const ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);})(),camera:window.__camera?{position:window.__camera.position.toArray(),fov:window.__camera.fov}:null}))));
  const r0 = await rects();
  console.log(`  state dialLabel=${await dialLabel()} toast=${r0.toast ? "up" : "none"}`);

  // 1) The reproduced collision, with the dial in BOTH states.
  const fired = await ensureToast();
  if (!fired) note("layout: no real toast could be raised (settings-export and sim-tick both failed)");
  else console.log(`  real toast raised via: ${fired}`);
  await openDial();
  await layoutCheck("layout/expanded");
  const collapsedClean = await p.evaluate(() => !!document.querySelector(".speeddial"));
  // Collapse via the primary (commits pause) — then measure again with a fresh toast.
  if (collapsedClean) {
    const open = await p.locator(".speeddial--open").count();
    if (open) {
      await p.locator(".speeddial__btn--primary").click({ timeout: 5000 }).catch(() => {});
      await sleep(220);
    }
    if (!(await p.locator(".ds-toast").count())) await ensureToast();
    await layoutCheck("layout/collapsed");
  }

  if (shotLabel) {
    // Shoot the transient state: expand the dial first, then raise a fresh toast and capture it
    // immediately — the toast lives 2.6s, and opening/closing Settings eats about half of that.
    await openDial();
    await mkdir(resolve(root,".shots",shotLabel),{recursive:true});
    const raised = achievement ? !!(await p.locator(".ds-toast").count()) : await toastViaExport();
    if (!raised) { await ensureToast(); }
    await openDial();
    await p.screenshot({ path: resolve(root, ".shots", shotLabel, `toast-${viewport.width}x${viewport.height}-${theme}.png`) });
    console.log(`  shot  toast -> .shots/${shotLabel}/toast-${viewport.width}x${viewport.height}-${theme}.png`);
  }

  // 2/3/4) Real input + pointer + dismissal, all with a toast up.
  await pointerCheck("pointer");
  await inputCheck(fired);

  // 5) Long/wrapped text keeps the same guarantee.
  await longTextCheck();

  if (pageErrors.length) for (const e of pageErrors.slice(0, 3)) note(`pageerror: ${e}`);
} catch (e) {
  note(`harness crashed: ${String(e)}`);
} finally {
  await ctx.close();
  await browser.close();
  server.close();
}

console.log(`\n${problems.length === 0 ? "PASS" : `${problems.length} problem(s)`} — overlay collision check @ ${viewport.width}x${viewport.height} ${theme}`);
for (const pr of problems) console.log("  • " + pr);
process.exitCode = problems.length ? 1 : 0;
