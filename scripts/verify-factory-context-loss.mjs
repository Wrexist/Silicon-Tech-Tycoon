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
const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
await ctx.addInitScript(raw=>{
 if(!localStorage.getItem('__factorySeeded')){localStorage.setItem('silicon.save.v1',JSON.stringify(raw));localStorage.setItem('silicon.settings',JSON.stringify({theme:'light',sound:false,haptics:false,factoryTutorialSeen:true,decorateTutorialSeen:true,notifPrompted:true}));localStorage.setItem('__factorySeeded','1');}

},raw);
const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
const read=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('silicon.save.v1')));
await p.goto(URL);await p.waitForTimeout(2000);
for(let i=0;i<8;i++){const b=p.locator('.coach__skip');if(!await b.count())break;await b.click();}
for(let i=0;i<6;i++){if(!await p.locator('[role=dialog]').count())break;await p.keyboard.press('Escape');await p.waitForTimeout(100);}
const control=p.locator('.speeddial__btn--primary');if(await control.getAttribute('aria-label')==='Pause'){await control.click();await control.click();}
await p.getByRole('button',{name:'Factory',exact:true}).click();await p.getByRole('button',{name:'Open factory mode',exact:true}).click();await p.waitForTimeout(1000);
const before=await read();
await p.getByRole('button',{name:'Build',exact:true}).click();
await p.getByRole('button',{name:/^Intake/}).click();
await p.locator('.fmode canvas').evaluate(c=>{const gl=c.getContext('webgl2');const ext=gl?.getExtension('WEBGL_lose_context');if(!ext)throw Error('No context loss extension');ext.loseContext();});
await p.locator('.fmode .fmini').waitFor();
await p.getByRole('button',{name:'Column 15, row 9',exact:true}).click();
await p.getByRole('button',{name:/^Place/}).click();
await p.waitForFunction(n=>JSON.parse(localStorage.getItem('silicon.save.v1')).factoryFloor.machines.length===n,before.factoryFloor.machines.length+1);
await p.getByRole('button',{name:'Cancel placement',exact:true}).click();
await p.getByRole('button',{name:'Style',exact:true}).click();
await p.locator('.fmode__buy').filter({hasText:'$50K'}).click();
await p.keyboard.press('Escape');
await p.getByRole('button',{name:'Build',exact:true}).click();
await p.getByRole('button',{name:'Undo the last build action',exact:true}).click();
await p.waitForFunction(n=>JSON.parse(localStorage.getItem('silicon.save.v1')).factoryFloor.machines.length===n,before.factoryFloor.machines.length);
const after=await read();
if(after.cash!==before.cash-5000000)throw Error(`Undo cash mismatch ${before.cash} -> ${after.cash}`);
if(after.factoryExpansion!==before.factoryExpansion+1)throw Error('Expansion lost');
if(JSON.stringify(after.factoryFloor)!==JSON.stringify(before.factoryFloor))throw Error('Owned factory changed');
if(JSON.stringify(after.layout)!==JSON.stringify(raw.layout))throw Error('Office furniture changed');
await p.screenshot({path:'artifacts/factory-fixes/images/context-loss-undo.png'});
await p.reload();await p.waitForTimeout(1000);const reloaded=await read();
if(JSON.stringify(reloaded.factoryFloor)!==JSON.stringify(after.factoryFloor)||reloaded.cash!==after.cash)throw Error('Reload mismatch');
if(errors.length)throw Error(errors.join('\n'));
console.log('PASS: forced WebGL loss during pending placement, fallback grid purchase, separate expansion, Undo, exact wallet/ownership, office preservation, reload; no page errors.');
await browser.close();server.close();
