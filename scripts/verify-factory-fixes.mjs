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

const exe = [process.env["ProgramFiles"] + "\\Google\\Chrome\\Application\\chrome.exe", process.env["ProgramFiles(x86)"] + "\\Google\\Chrome\\Application\\chrome.exe", process.env["LOCALAPPDATA"] + "\\Google\\Chrome\\Application\\chrome.exe", process.env["ProgramFiles"] + "\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });


const raw=JSON.parse(await readFile('artifacts/office-finish/review-save.json','utf8'));
raw.lastActive=Date.now();for(const k of Object.keys(raw))if(k.startsWith('pending'))raw[k]=null;raw.interruptPace='calm';raw.lastInterruptWeek=raw.week;
await mkdir('artifacts/factory-fixes/images',{recursive:true});
const results=[];
for(const theme of ['dark','light']){
 const ctx=await browser.newContext({viewport:{width:320,height:740},deviceScaleFactor:2,reducedMotion:'reduce'});
 await ctx.addInitScript(({raw,theme})=>{window.__THREE_DEVTOOLS__={dispatchEvent(e){const r=e.detail;if(r?.isWebGLRenderer){const render=r.render;r.render=function(scene,camera){if(this.domElement.closest('.fmode'))window.__factoryScene=scene;return render.call(this,scene,camera);};}}};localStorage.setItem('silicon.save.v1',JSON.stringify(raw));localStorage.setItem('silicon.settings',JSON.stringify({theme,sound:false,haptics:false,decorateTutorialSeen:true,factoryTutorialSeen:true,notifPrompted:true}));},{raw,theme});
 const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(URL);await p.waitForTimeout(2500);
 for(let i=0;i<8;i++){const sk=p.locator('.coach__skip');if(!await sk.count())break;await sk.click();}
 for(let i=0;i<6;i++){if(!await p.locator('[role=dialog]').count())break;await p.keyboard.press('Escape');await p.waitForTimeout(150);}
 const speed=p.locator('.speeddial__btn--primary');if(await speed.getAttribute('aria-label')==='Pause'){await speed.click();await speed.click();}
 await p.getByRole('button',{name:'Factory',exact:true}).click();await p.waitForTimeout(1200);await p.getByRole('button',{name:'Open factory mode',exact:true}).click();await p.waitForTimeout(2500);
 await p.screenshot({path:`artifacts/factory-fixes/images/${theme}-320.png`});
 const data=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,text:document.querySelector('.fmode')?.textContent,buttons:[...document.querySelectorAll('.fmode button')].map(x=>({text:x.textContent,label:x.getAttribute('aria-label')})),canvases:[...document.querySelectorAll('canvas')].map(c=>{const gl=c.getContext('webgl2')||c.getContext('webgl');const ext=gl?.getExtension('WEBGL_debug_renderer_info');return {width:c.width,height:c.height,css:c.getBoundingClientRect().toJSON(),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};})}));

 const placement=await p.evaluate(()=>{
  const saved=JSON.parse(localStorage.getItem('silicon.save.v1')).factoryFloor.machines;
  const rendered=[];window.__factoryScene?.traverse(o=>{if(o.name?.startsWith('factory-machine:'))rendered.push(o);});
  return saved.filter(m=>{const g=rendered.find(o=>o.name===`factory-machine:${m.id}`)?.children[0];const width=m.kind==='press'?3:2;return !g||Math.abs(g.position.x-(m.c-7.5+(width-1)/2))>0.001||Math.abs(g.position.z-(m.r-4.5+0.5))>0.001;}).map(m=>m.id);
 });
 if(placement.length)throw Error(`Render/placement mismatch: ${placement.join(', ')}`);
 const transforms=()=>p.evaluate(()=>{const out=[];window.__factoryScene?.traverse(o=>{if(!o.isCamera)out.push([o.type,...o.position.toArray(),...o.rotation.toArray(),...o.scale.toArray()]);});return JSON.stringify(out);});
 const stillA=await transforms();await p.waitForTimeout(400);const stillB=await transforms();
 if(stillA!==stillB){const a=JSON.parse(stillA),b=JSON.parse(stillB);console.log('Motion diffs',a.filter((x,i)=>JSON.stringify(x)!==JSON.stringify(b[i])).slice(0,8),b.filter((x,i)=>JSON.stringify(x)!==JSON.stringify(a[i])).slice(0,8));throw Error('Decorative transforms moved with Reduced Motion');}
 await p.emulateMedia({reducedMotion:'no-preference'});await p.waitForTimeout(400);const movingA=await transforms();await p.waitForTimeout(400);const movingB=await transforms();
 if(movingA===movingB)throw Error('Factory animation unexpectedly frozen');
 await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(400);
 const sheets={};
 for(const name of ['Stats','Style','Build']) {
  await p.getByRole('button',{name,exact:true}).click();await p.waitForTimeout(350);
  await p.screenshot({path:`artifacts/factory-fixes/images/${theme}-${name.toLowerCase()}-320.png`});
  sheets[name]=await p.locator('.fmode').innerText();
  await p.keyboard.press('Escape');await p.waitForTimeout(150);
 }
 await p.getByRole('button',{name:'Close factory',exact:true}).click();
 await p.getByRole('button',{name:'Open factory mode',exact:true}).click();
 await p.getByRole('button',{name:'Recenter view',exact:true}).click();
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(700);
 await p.screenshot({path:`artifacts/factory-fixes/images/${theme}-390.png`});
 const layouts=[];
 for(const [width,height,scale] of [[320,740,1.25],[768,1024,1],[1280,800,1]]) {
  await p.setViewportSize({width,height});await p.evaluate(scale=>document.documentElement.style.fontSize=`${scale*100}%`,scale);await p.waitForTimeout(300);
  await p.getByRole('button',{name:'Recenter view',exact:true}).click();
  const checks=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,blocked:[...document.querySelectorAll('.fmode__top button,.fmode__rail button')].filter(b=>{const r=b.getBoundingClientRect();return !b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}).map(b=>b.getAttribute('aria-label')||b.textContent)}));
  if(checks.overflow||checks.blocked.length)throw Error(JSON.stringify({theme,width,scale,...checks}));
  await p.screenshot({path:`artifacts/factory-fixes/images/${theme}-${width}-${scale}.png`});layouts.push({width,height,scale,...checks});
 }
 if(errors.length)throw Error(errors.join('\n'));
 results.push({theme,errors,...data,sheets,reopen:true,layouts,reducedMotionTransformsStable:true,normalMotionTransformsChanged:true});await ctx.close();
}
await import('node:fs/promises').then(fs=>fs.writeFile('artifacts/factory-fixes/browser.json',JSON.stringify(results,null,2)));
console.log('PASS: both themes, 320/390/tablet/desktop, 125% text scale, accessible HUD centers, Reduced Motion transforms and live animation, sheets/reopen/recenter; no page errors.');
await browser.close();server.close();
