// TEMP diagnostic (not committed): pass-separated draw-call / scene-cost measurement for the office.
// Read-only — hooks WebGL from an init script and reads the THREE scene via the devtools observe hook.
//   npm run build && node scripts/tmp-drawdiag.mjs
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const indexFile = resolve(distDir, "index.html");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon", ".glb": "model/gltf-binary" };
const server = createServer(async (req, res) => {
  try {
    const p0 = decodeURIComponent((req.url || "/").split("?")[0]);
    const c = p0 === "/" ? indexFile : resolve(distDir, "." + normalize(p0));
    let f = c, b;
    try { b = await readFile(c); } catch { f = indexFile; b = await readFile(indexFile); }
    res.writeHead(200, { "content-type": MIME[extname(f)] || "text/html" });
    res.end(b);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(0, r));
const URL = `http://localhost:${server.address().port}`;
const save = JSON.parse((await readFile(process.env.SHOTS_SAVE || "artifacts/office-finish/review-save.json")).toString());
save.lastActive = Date.now();
for (const k of Object.keys(save)) if (/^pending/.test(k)) save[k] = null;
save.interruptPace = "calm";
save.lastInterruptWeek = save.week;
const staged = JSON.stringify(save);
const theme = process.argv[2] || "dark";
console.log(`theme: ${theme}`);
const exe = [process.env["ProgramFiles"] + "\\Google\\Chrome\\Application\\chrome.exe", process.env["LOCALAPPDATA"] + "\\Google\\Chrome\\Application\\chrome.exe", process.env["ProgramFiles"] + "\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(({ v, th }) => {
  const w = window;
  w.__probe = { main: 0, off: 0, trisMain: 0, trisOff: 0, frames: [], fbo: null, fboSizes: {}, scenes: [], renderers: [], buckets: [], last: {main:0,off:0,trisMain:0,trisOff:0}, ctxs: 0, canvasSize: null };
  const raf = w.requestAnimationFrame.bind(w);
  const tick = (t) => { const q=w.__probe;
    q.buckets.push({t, main:q.main-q.last.main, off:q.off-q.last.off, trisMain:q.trisMain-q.last.trisMain, trisOff:q.trisOff-q.last.trisOff});
    q.last={main:q.main,off:q.off,trisMain:q.trisMain,trisOff:q.trisOff};
    w.__probe.frames.push(t); if (w.__probe.frames.length > 4000) w.__probe.frames.shift(); raf(tick); };
  raf(tick);
  w.__THREE_DEVTOOLS__ = { dispatchEvent(e) { const d = e && e.detail; if (d && d.isScene) w.__probe.scenes.push(d); if(d && d.isWebGLRenderer) {w.__probe.renderers.push(d);const render=d.render;d.render=function(scene,camera){if(camera.isPerspectiveCamera)w.__probe.camera=camera;return render.call(this,scene,camera);};} } };
  const origGet = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    const gl = origGet.call(this, kind, ...rest);
    if (gl && /webgl/i.test(String(kind)) && !gl.__hooked) {
      gl.__hooked = true;
      w.__probe.ctxs++;
      const canvas = this;
      const ext=gl.getExtension('WEBGL_debug_renderer_info');
      w.__probe.backend={version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
      const origBind = gl.bindFramebuffer && gl.bindFramebuffer.bind(gl);
      if (origBind) gl.bindFramebuffer = (target, fb) => {
        if(target===gl.FRAMEBUFFER || target===gl.DRAW_FRAMEBUFFER) w.__probe.fbo = fb;
        if (fb && fb.width) w.__probe.fboSizes[`${fb.width}x${fb.height}`] = 1;
        return origBind(target, fb);
      };
      const origViewport = gl.viewport && gl.viewport.bind(gl);
      if (origViewport) gl.viewport = (x, y, wd, ht) => { w.__probe.vp = `${wd}x${ht}`; return origViewport(x, y, wd, ht); };
      const wrap = (fn, triFn) => {
        const orig = gl[fn];
        if (typeof orig !== "function") return;
        gl[fn] = function (...a) {
          const tris = triFn ? triFn(a) : 0;
          const off = !!w.__probe.fbo;
          if (off) {
            w.__probe.off++; w.__probe.trisOff += tris;
            const k = (w.__probe.vp || "?") + (w.__probe.fbo && w.__probe.fbo.width ? ` rt=${w.__probe.fbo.width}x${w.__probe.fbo.height}` : "");
            w.__probe.fboCounts = w.__probe.fboCounts || {};
            w.__probe.fboCounts[k] = (w.__probe.fboCounts[k] || 0) + 1;
          } else { w.__probe.main++; w.__probe.trisMain += tris; }
          if (!w.__probe.canvasSize) w.__probe.canvasSize = `${canvas.width}x${canvas.height}`;
          return orig.apply(this, a);
        };
      };
      const triangles=(mode,count)=>mode===gl.TRIANGLES?Math.floor(count/3):(mode===gl.TRIANGLE_STRIP||mode===gl.TRIANGLE_FAN)?Math.max(0,count-2):0;
      wrap("drawElements", a=>triangles(a[0],a[1]));
      wrap("drawArrays", a=>triangles(a[0],a[2]));
      wrap("drawElementsInstanced", a=>triangles(a[0],a[1])*a[4]);
      wrap("drawArraysInstanced", a=>triangles(a[0],a[2])*a[3]);
    }
    return gl;
  };
  localStorage.setItem("silicon.save.v1", v);
  localStorage.setItem("silicon.settings", JSON.stringify({ theme: th, sound: false, haptics: false, decorateTutorialSeen: true, factoryTutorialSeen: true, notifPrompted: true }));
}, { v: staged, th: theme });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });

const measurements=[];
const sample = async (label, ms) => {
  const out = await p.evaluate(async (dur) => {
    const q = window.__probe;
    const t0 = performance.now();
    const b0=q.buckets.length;
    const m0 = q.main, o0 = q.off, tm0 = q.trisMain, to0 = q.trisOff, f0 = q.frames.length;
    await new Promise((r) => setTimeout(r, dur));
    const t1 = performance.now();
    const frames = q.frames.length - f0;
    const deltas = q.frames.slice(f0 + 1).map((t, i) => t - q.frames[f0 + i]);
    deltas.sort((a, b) => a - b);
    const pct = (x) => (deltas.length ? +deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * x))].toFixed(1) : 0);
    const scene=q.scenes.slice().sort((a,b)=>{let an=0,bn=0;a.traverse(()=>an++);b.traverse(()=>bn++);return bn-an;})[0];
    let meshes=0; const materials=new Set(), geometries=new Set(), textures=new Set(), repeats={};
    scene?.traverse(o=>{if(!o.isMesh)return;meshes++;geometries.add(o.geometry.uuid);
      for(const m of(Array.isArray(o.material)?o.material:[o.material])){materials.add(m.uuid);for(const v of Object.values(m))if(v?.isTexture)textures.add(v.uuid);
      const key=`${o.geometry.type}/${m.type}/${m.color?.getHexString()}/${m.transparent?'transparent':'opaque'}`;repeats[key]=(repeats[key]||0)+1;}});
    return {
      inventory:{meshes,materials:materials.size,geometries:geometries.size,textures:textures.size,repeats:Object.entries(repeats).sort((a,b)=>b[1]-a[1]).slice(0,12),renderer:q.renderers.map(r=>({memory:{...r.info.memory},info:{...r.info.render},autoReset:r.info.autoReset,canvas:[r.domElement.width,r.domElement.height],dpr:r.getPixelRatio()}))},
      buckets:q.buckets.slice(b0+1),
      startCounters:{main:m0,off:o0,trisMain:tm0,trisOff:to0},
      camera:q.camera?{position:q.camera.position.toArray(),quaternion:q.camera.quaternion.toArray(),fov:q.camera.fov,aspect:q.camera.aspect}:null,
      simControl:document.querySelector('.speeddial__btn--primary')?.getAttribute('aria-label'),
      secs: +((t1 - t0) / 1000).toFixed(2), frames,
      main: q.main - m0, off: q.off - o0,
      trisMain: q.trisMain - tm0, trisOff: q.trisOff - to0,
      fps: +((q.frames.length - f0) / ((t1 - t0) / 1000)).toFixed(1),
      p50: pct(0.5), p95: pct(0.95), max: Math.round(deltas.at(-1) || 0),
      size: q.canvasSize,
    };
  }, ms);
  const per = (n) => (out.frames ? (n / out.frames).toFixed(1) : "-");
  console.log(`${label.padEnd(30)} frames=${out.frames} ${out.secs}s fps=${out.fps} | draws/f: main=${per(out.main)} off=${per(out.off)} total=${per(out.main + out.off)} | tris/f: main=${per(out.trisMain)} off=${per(out.trisOff)} | frame ms p50=${out.p50} p95=${out.p95} max=${out.max} | canvas=${out.size}`);
  measurements.push({label,...out});
  return out;
};
const fbos = async () => p.evaluate(() => window.__probe.fboCounts || {});

async function setPaused(paused) {
  const control=p.locator('.speeddial__btn--primary');
  if((await control.getAttribute('aria-label'))===(paused?'Resume':'Pause')) return;
  if(!(await p.locator('.speeddial--open').count())) await control.click();
  await control.click();
  if((await control.getAttribute('aria-label'))!==(paused?'Resume':'Pause')) throw new Error('Wrong simulation state');
}
// Phase 0: the load/initial window (includes lazy chunks + first shadow builds).
await p.waitForTimeout(300);
await sample("boot/first-render window", 2500);
await p.waitForTimeout(2500);
for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(150); }
await setPaused(true);
await p.waitForTimeout(3000);
// Phase 1: steady state, paused sim, settled camera.
await sample("steady (paused, settled)", 4000);
console.log("  steady FBOs:", JSON.stringify(await fbos()));
// Phase 1b: live animation
await setPaused(false);
await p.waitForTimeout(1200);
await sample("sim running", 4000);
await setPaused(true);
await p.waitForTimeout(1500);
// Phase 2: camera movement — orbit with A.
await p.evaluate(() => document.querySelector("canvas")?.focus());
await p.keyboard.down("a");
await sample("camera orbit (A held)", 2500);
await p.keyboard.up("a");
console.log("  orbit FBOs:", JSON.stringify(await fbos()));
await p.waitForTimeout(1500);
// Phase 3: Decorate open (editor camera + grid).
await p.locator(".hq__decorate").click();
await p.waitForTimeout(2000);
await sample("Decorate open", 3500);
// Phase 3b: a furniture change → ContactShadows re-keys and re-bakes once.
await p.evaluate(() => {
  const el = document.querySelector(".hqb__search-input");
  if (el) { el.value = "Plant"; el.dispatchEvent(new Event("input", { bubbles: true })); }
});
await p.waitForTimeout(500);
await p.evaluate(() => { [...document.querySelectorAll(".hqb__item")].find((x) => !x.classList.contains("hqb__item--poor"))?.click(); });
await sample("furniture placed (rebake)", 2500);
console.log("  after-place FBOs:", JSON.stringify(await fbos()));
await p.waitForTimeout(2500);
await sample("post-place steady", 2500);
await p.locator('.hqb__top-actions button:has-text("Done")').click();
await p.waitForTimeout(1500);

// Scene inventory via the LARGEST observed THREE scene (the devtools hook sees every scene created,
// and the first one observed may be a tiny helper scene).
const inv = await p.evaluate(() => {
  const all = window.__probe.scenes || [];
  const count = (s) => { let n = 0; s.traverse(() => n++); return n; };
  const s = all.slice().sort((a, b) => count(b) - count(a))[0];
  if (!s) return { scenes: all.length };
  let meshes = 0, shadowCasters = 0, transparent = 0, instanced = 0, points = 0, lines = 0, sprites = 0, lights = 0, dirShadow = null;
  const geos = new Map(), mats = new Map(), matTypes = {}, textures=new Set();
  s.traverse((o) => {
    if (o.isLight) { lights++; if (o.isDirectionalLight && o.castShadow) dirShadow = { map: o.shadow.mapSize.x + "x" + o.shadow.mapSize.y, cam: o.shadow.camera.right - o.shadow.camera.left }; }
    if (o.isMesh) {
      meshes++;
      if (o.castShadow) shadowCasters++;
      if (o.isInstancedMesh) instanced++;
      if (o.geometry) geos.set(o.geometry.uuid, (geos.get(o.geometry.uuid) || 0) + 1);
      const m = o.material;
      for(const mat of (Array.isArray(m)?m:[m])) if(mat) for(const value of Object.values(mat)) if(value?.isTexture) textures.add(value.uuid);
      if (m) { mats.set(m.uuid, (mats.get(m.uuid) || 0) + 1); const t = m.type || "?"; matTypes[t] = (matTypes[t] || 0) + 1; if (m.transparent) transparent++; }
    }
    if (o.isPoints) points++;
    if (o.isLine) lines++;
    if (o.isSprite) sprites++;
  });
  const top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return {
    scenesSeen: all.length, meshes, shadowCasters, instanced, transparent, points, lines, sprites, lights, dirShadow,
    geometries: geos.size, materials: mats.size, materialTextures:textures.size, matTypes,
    backend: window.__probe.backend,
    renderers: window.__probe.renderers.map(r=>({memory:{...r.info.memory},render:{...r.info.render},autoReset:r.info.autoReset,canvas:[r.domElement.width,r.domElement.height],pixelRatio:r.getPixelRatio()})),
    sharedGeometryTop: top(geos, 6), sharedMaterialTop: top(mats, 6),
  };
});
console.log("\nscene inventory:", JSON.stringify(inv, null, 1));

await writeFile(`artifacts/office-finish/render-${theme}.json`, JSON.stringify({measurements,inventory:inv,buckets:await p.evaluate(()=>window.__probe.buckets)},null,2));
await browser.close();
server.close();
