// Controlled factory draw/pass diagnostic; isolated review-save browser context.
// Hooks WebGL from an init script; production rendering code is unchanged.
// npm run build && node scripts/measure-factory-fixes.mjs
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
  w.__THREE_DEVTOOLS__ = { dispatchEvent(e) { const d = e && e.detail; if (d && d.isScene) w.__probe.scenes.push(d); if(d && d.isWebGLRenderer) {w.__probe.renderers.push(d);const render=d.render;d.render=function(scene,camera){if(camera.isPerspectiveCamera && this.domElement.closest(".fmode")){w.__probe.camera=camera;w.__probe.factoryScene=scene;}return render.call(this,scene,camera);};} } };
  const origGet = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    const gl = origGet.call(this, kind, ...rest);
    if (gl && /webgl/i.test(String(kind)) && !gl.__hooked) {
      gl.__hooked = true;
      w.__probe.ctxs++;
      const canvas = this; let framebuffer = null; let viewport = "";
      const ext=gl.getExtension('WEBGL_debug_renderer_info');
      w.__probe.backend={version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
      const origBind = gl.bindFramebuffer && gl.bindFramebuffer.bind(gl);
      if (origBind) gl.bindFramebuffer = (target, fb) => {
        if(target===gl.FRAMEBUFFER || target===gl.DRAW_FRAMEBUFFER) framebuffer = fb;
        if (fb && fb.width) w.__probe.fboSizes[`${fb.width}x${fb.height}`] = 1;
        return origBind(target, fb);
      };
      const origViewport = gl.viewport && gl.viewport.bind(gl);
      if (origViewport) gl.viewport = (x, y, wd, ht) => { viewport = `${wd}x${ht}`; return origViewport(x, y, wd, ht); };
      const wrap = (fn, triFn) => {
        const orig = gl[fn];
        if (typeof orig !== "function") return;
        gl[fn] = function (...a) {
          if (!canvas.closest(".fmode")) return orig.apply(this,a);
          const tris = triFn ? triFn(a) : 0;
          const off = !!framebuffer;
          if (off) {
            w.__probe.off++; w.__probe.trisOff += tris;
            const k = (viewport || "?") + (framebuffer && framebuffer.width ? ` rt=${framebuffer.width}x${framebuffer.height}` : "");
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
    const scene=q.factoryScene;
    let meshes=0; const materials=new Set(), geometries=new Set(), textures=new Set(), repeats={};
    scene?.traverse(o=>{if(!o.isMesh)return;meshes++;geometries.add(o.geometry.uuid);
      for(const m of(Array.isArray(o.material)?o.material:[o.material])){materials.add(m.uuid);for(const v of Object.values(m))if(v?.isTexture)textures.add(v.uuid);
      const key=`${o.geometry.type}/${m.type}/${m.color?.getHexString()}/${m.transparent?'transparent':'opaque'}`;repeats[key]=(repeats[key]||0)+1;}});
    return {
      inventory:{meshes,materials:materials.size,geometries:geometries.size,textures:textures.size,repeats:Object.entries(repeats).sort((a,b)=>b[1]-a[1]).slice(0,12),renderer:q.renderers.filter(r=>r.domElement.closest(".fmode")).map(r=>({memory:{...r.info.memory},info:{...r.info.render},autoReset:r.info.autoReset,canvas:[r.domElement.width,r.domElement.height],dpr:r.getPixelRatio()}))},
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

await p.waitForTimeout(2500);
for(let i=0;i<8;i++){const skip=p.locator('.coach__skip');if(!await skip.count())break;await skip.click();}
for(let i=0;i<6;i++){if(!await p.locator('[role=dialog]').count())break;await p.keyboard.press('Escape');await p.waitForTimeout(200);}
await setPaused(true);
await p.getByRole('button',{name:'Factory',exact:true}).click();await p.waitForTimeout(1500);
await p.getByRole('button',{name:'Open factory mode',exact:true}).click();
await sample('initial-shadow-window',5000);
// Allow the finite 60-frame contact-shadow budget to settle even in software rendering.
await p.waitForFunction(()=>window.__probe.buckets.filter(b=>b.main>0).length>90,{},{timeout:60000});
await sample('steady-idle',5000);
const sampling=sample('camera-orbit',5000);
await p.mouse.move(175,420);await p.mouse.down();await p.mouse.move(240,460,{steps:25});await p.mouse.up();await sampling;
await p.getByRole('button',{name:'Build',exact:true}).click();
await p.getByRole('button',{name:/^Auto/}).click();
await p.getByRole('button',{name:/^Confirm/}).click();
await sample('edit-shadow-rebake',5000);
await p.waitForTimeout(12000);
await sample('post-edit-steady',5000);
await writeFile('artifacts/factory-fixes/render-measurements.json',JSON.stringify({measurements,backend:await p.evaluate(()=>window.__probe.backend),browser:browser.version(),method:'Intercept WebGL draw calls on fullscreen factory canvas only, segregate default vs nondefault framebuffer. Counter differences over RAF sampling windows; no production-loop changes. Intervals are RAF, not GPU duration.'},null,2));
await browser.close();server.close();
