// Perf probe for the office + factory 3D scenes: counts live WebGL canvases and measures the page's
// sustained frame rate in each state. Read-only — it drives the real UI, changes no code.
//   npm run build && npm run shots:stage && node scripts/probe-scenes.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const PORT = Number(process.env.SHOTS_PORT || 5241);
const EXE = process.env.SHOTS_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon" };
const indexFile = resolve(distDir, "index.html");
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
await new Promise((r) => server.listen(PORT, r));
const URL = `http://localhost:${PORT}`;

const save = JSON.parse((await readFile("/tmp/silicon-stage.json")).toString());
save.lastActive = Date.now();
// Clear every interrupt card and quiet the cadence: a modal popping mid-probe blocks the taps and
// skews the sample. We are measuring scene cost, not the interrupt streams.
for (const k of Object.keys(save)) if (/^pending/.test(k)) save[k] = null;
save.interruptPace = "calm";
save.lastInterruptWeek = save.week;
// PROBE_IDLE=1 empties the production queue: measures what a completely STATIC factory costs.
if (process.env.PROBE_IDLE === "1") { save.building = []; save.activeSideOrder = null; }
const staged = JSON.stringify(save);

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  // Hardware-independent scene-cost probe: count draw calls and live WebGL contexts.
  const w = window;
  w.__probe = { draws: 0, contexts: 0, byCanvas: {} };
  const origGet = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    const gl = origGet.call(this, kind, ...rest);
    if (gl && /webgl/i.test(String(kind)) && !gl.__hooked) {
      gl.__hooked = true;
      const id = `ctx${++w.__probe.contexts}`;
      gl.__probeId = id;
      const canvas = this;
      w.__probe.byCanvas[id] = 0;
      for (const fn of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
        const orig = gl[fn];
        if (typeof orig === "function") gl[fn] = function (...a) {
          w.__probe.draws++;
          w.__probe.byCanvas[id]++;
          w.__probe.size = w.__probe.size || {};
          w.__probe.size[id] = `${canvas.width}x${canvas.height}`;
          return orig.apply(this, a);
        };
      }
    }
    return gl;
  };
});
await ctx.addInitScript((v) => {
  localStorage.setItem("silicon.save.v1", v);
  localStorage.setItem("silicon.settings", JSON.stringify({ theme: "light", sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
  localStorage.setItem("silicon.factory.camhint", "1");
}, staged);
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(3200);
for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(200); }
for (let i = 0; i < 4; i++) { const s = await p.$(".rst__scrim, .cele__card button, .dinbox__dismiss"); if (!s) break; await s.click().catch(() => {}); await p.waitForTimeout(500); }

// Pause the sim so no new interrupt card interrupts the probe.
for (const sel of ['[aria-label="Pause"]', '.speeddial button', '.hud__pause']) {
  const b = await p.$(sel);
  if (b) { await b.click().catch(() => {}); break; }
}
await p.waitForTimeout(400);

/** Draw calls issued over `ms`, plus live canvases/contexts — all hardware-independent. */
const sample = async (label, ms = 3000) => {
  const out = await p.evaluate(async (dur) => {
    const before = window.__probe.draws;
    const beforeBy = { ...window.__probe.byCanvas };
    const t0 = performance.now();
    let frames = 0;
    await new Promise((done) => {
      const tick = () => { frames++; performance.now() - t0 < dur ? requestAnimationFrame(tick) : done(); };
      requestAnimationFrame(tick);
    });
    const elapsed = performance.now() - t0;
    const draws = window.__probe.draws - before;
    const per = {};
    for (const [id, n] of Object.entries(window.__probe.byCanvas)) {
      const d = n - (beforeBy[id] ?? 0);
      if (d > 0) per[`${id} ${window.__probe.size?.[id] ?? "?"}`] = frames ? Math.round(d / frames) : d;
    }
    return { draws, frames, perFrame: frames ? Math.round(draws / frames) : 0, secs: +(elapsed / 1000).toFixed(2), per, contexts: window.__probe.contexts };
  }, ms);
  const parts = Object.entries(out.per).map(([k, v]) => `${k}: ${v}/f`);
  console.log(`${label.padEnd(34)} total ~${out.perFrame} draws/frame  |  ${parts.join("  |  ") || "idle"}`);
  return out;
};

const dbg = async (t) => console.log("   [dbg]", t, await p.evaluate(() => ({
  worldTabs: document.querySelectorAll(".worldtabs__tab").length,
  navItems: [...document.querySelectorAll(".bnav__item")].map((n) => n.textContent?.trim()),
  canvases: document.querySelectorAll("canvas").length,
  fcard: !!document.querySelector(".fcard"),
  fmode: !!document.querySelector(".fmode"),
})));
await dbg("initial");
await sample("office world, HQ tab");

// Switch HQ's world to the factory card.
await p.screenshot({ path: "/tmp/probe-before.png" });
try {
  await p.locator(".worldtabs__tab", { hasText: "Factory" }).click({ timeout: 5000 });
} catch (e) { console.log("   [dbg] world click failed:", String(e).split("\n")[0]); }
await p.waitForTimeout(1800);
await dbg("after world switch");
await sample("factory card, HQ tab");
if (process.env.PROBE_SHOT === "1") { await p.screenshot({ path: "/tmp/card-after.png" }); }

// Leave HQ for another tab — HQ stays mounted (hidden). Does the factory canvas keep rendering?
const marketTab = await p.$('.bnav__item:has-text("Market")');
if (marketTab) { await marketTab.click().catch(() => {}); await p.waitForTimeout(1800); }
await sample("factory card, Market tab (hidden)");

// Back to HQ, then open fullscreen Factory Mode — is the card's canvas still alive behind it?
const hqTab = await p.$('.bnav__item:has-text("Office")');
if (hqTab) { await hqTab.click().catch(() => {}); await p.waitForTimeout(1200); }
const openFactory = await p.$('[aria-label="Open factory mode"]');
if (openFactory) { await openFactory.click().catch(() => {}); await p.waitForTimeout(2600); }
await dbg("fullscreen");
await sample("factory FULLSCREEN open");

await browser.close();
server.close();
