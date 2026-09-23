// TEMP evidence script (not committed): captures Fixture B — a fresh-start/default office produced
// through the REAL onboarding flow — and the fresh Decorate grid. Deleted after the report.
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
raw.lastActive=Date.now();for(const key of Object.keys(raw))if(key.startsWith("pending"))raw[key]=null;raw.interruptPace="calm";raw.lastInterruptWeek=raw.week;
await mkdir('artifacts/office-finish/images',{recursive:true});
for(const mode of ['reduce-motion','no-webgl']) {
 const context=await browser.newContext({viewport:{width:320,height:740},deviceScaleFactor:2,reducedMotion:mode==='reduce-motion'?'reduce':'no-preference'});
 await context.addInitScript(({save,mode})=>{
 localStorage.setItem('silicon.save.v1',JSON.stringify(save));localStorage.setItem('silicon.settings',JSON.stringify({theme:'dark',sound:false,haptics:false,decorateTutorialSeen:true,notifPrompted:true}));
 if(mode==='no-webgl'){const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:get.call(this,type,...args);};}
 },{save:raw,mode});
 const page=await context.newPage();await page.goto(URL);await page.waitForTimeout(3000);
 for(let i=0;i<8;i++){const skip=page.locator('.coach__skip');if(!await skip.count())break;await skip.click();}
 for(let i=0;i<6;i++){if(!await page.locator('[role=dialog]').count())break;await page.keyboard.press('Escape');await page.waitForTimeout(250);}
 if(await page.locator('.speeddial__btn--primary').getAttribute('aria-label')==='Pause'){await page.locator('.speeddial__btn--primary').click();await page.locator('.speeddial__btn--primary').click();}
 if(mode==='no-webgl'){await page.locator('.office-map').waitFor({state:'visible'});console.log(mode,'saved furniture map visible');}else{await page.locator('canvas').first().waitFor({state:'visible'});if(!await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches))throw new Error('Reduce Motion not active');console.log(mode,'3D office remains visible with Reduce Motion active');}
 await page.screenshot({path:`artifacts/office-finish/images/${mode}.png`});
 if(mode==='reduce-motion'){await page.locator('.hq__decorate').click();await page.locator('.hqb__top-actions').waitFor({state:'visible'});console.log(mode,'Shop opens');}else{if(!await page.locator('.hq__decorate').count())throw new Error('Fallback Shop unavailable');if(await page.locator('[data-office-item]').count()!==raw.layout.length)throw new Error('Fallback omitted furniture');const layout=await page.evaluate(()=>JSON.parse(localStorage.getItem('silicon.save.v1')).layout);if(JSON.stringify(layout)!==JSON.stringify(raw.layout))throw new Error('Fallback changed owned layout');console.log(mode,'saved-layout fallback, Shop available, every owned piece retained');}
 await context.close();
}
await browser.close();server.close();
