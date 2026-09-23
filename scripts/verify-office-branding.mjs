// Factory audit evidence: existing populated review fixture, actual phone UI; does not modify source or user save.
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
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
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    const c = p === "/" ? indexFile : resolve(distDir, "." + normalize(p));
    let f = c, b;
    try { b = await readFile(c); } catch { f = indexFile; b = await readFile(indexFile); }
    res.writeHead(200, { "content-type": MIME[extname(f)] || "text/html" });
    res.end(b);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(0, r));
const URL = `http://localhost:${server.address().port}`;

const exe = [process.env.SHOTS_CHROME, process.env["ProgramFiles"] + "\\Google\\Chrome\\Application\\chrome.exe", process.env["ProgramFiles(x86)"] + "\\Google\\Chrome\\Application\\chrome.exe", process.env["LOCALAPPDATA"] + "\\Google\\Chrome\\Application\\chrome.exe", process.env["ProgramFiles"] + "\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });



await mkdir('artifacts/factory-fixes/images',{recursive:true});
const raw=JSON.parse(await readFile('scripts/fixtures/save-release-review.json','utf8'));
if(process.argv.includes('--denied'))raw.cash=70000;raw.__reviewTheme=process.argv[2]||'dark';raw.lastActive=Date.now();for(const k of Object.keys(raw))if(k.startsWith('pending'))raw[k]=null;raw.interruptPace='calm';raw.lastInterruptWeek=raw.week;
const ctx=await browser.newContext({viewport:{width:320,height:740},deviceScaleFactor:2});
await ctx.addInitScript(raw=>{
 if(!localStorage.getItem('__factorySeeded')){localStorage.setItem('silicon.save.v1',JSON.stringify(raw));localStorage.setItem('silicon.settings',JSON.stringify({theme:raw.__reviewTheme,sound:false,haptics:false,factoryTutorialSeen:true,decorateTutorialSeen:true,notifPrompted:true}));localStorage.setItem('__factorySeeded','1');}

},raw);
if(process.argv.includes('--fallback'))await ctx.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /webgl/i.test(kind)?null:get.call(this,kind,...args);};});
await ctx.addInitScript(()=>{
 window.__THREE_DEVTOOLS__={dispatchEvent(event){const renderer=event.detail;if(!renderer?.isWebGLRenderer)return;
 const render=renderer.render;renderer.render=function(scene,camera){
  const result=render.call(this,scene,camera), wordmark=scene.getObjectByName('office-brand-wordmark');
  if(camera.isPerspectiveCamera&&wordmark){
   const positions=wordmark.geometry.attributes.position, corners=[];
   for(let i=0;i<positions.count;i++) { const v=camera.position.clone().fromBufferAttribute(positions,i);wordmark.localToWorld(v);v.project(camera);corners.push({x:v.x,y:v.y,z:v.z}); }
   const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
   window.__brandDiagnostic={corners,buffer:[renderer.domElement.width,renderer.domElement.height],renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),camera:camera.position.toArray()};
  }return result;
 };}};
});
const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
const read=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('silicon.save.v1')));
await p.goto(URL);await p.waitForTimeout(2000);
for(let i=0;i<8;i++){const b=p.locator('.coach__skip');if(!await b.count())break;await b.click();}
for(let i=0;i<6;i++){if(!await p.locator('[role=dialog]').count())break;await p.keyboard.press('Escape');await p.waitForTimeout(100);}
const control=p.locator('.speeddial__btn--primary');if(await control.getAttribute('aria-label')==='Pause'){await control.click();await control.click();}


await p.waitForFunction(()=>window.__brandDiagnostic);
await p.waitForTimeout(1500);
const diagnostic=await p.evaluate(()=>window.__brandDiagnostic);
const theme=process.argv[2]||'dark';
await mkdir('artifacts/release-final',{recursive:true});
await p.screenshot({path:`artifacts/release-final/brand-${theme}.png`});
console.log(JSON.stringify(diagnostic));
if(diagnostic.corners.some(v=>Math.abs(v.x)>1||Math.abs(v.y)>1||Math.abs(v.z)>1))throw Error('Wordmark is outside the canvas');
if(errors.length)throw Error(errors.join('\n'));
console.log(`PASS ${theme}: complete wordmark lies inside the real 320x740 portrait canvas.`);
await browser.close();server.close();
