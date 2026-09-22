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



await mkdir('artifacts/release-prep',{recursive:true});
const raw=JSON.parse(await readFile('scripts/fixtures/save-release-review.json','utf8'));
raw.lastActive=Date.now();for(const k of Object.keys(raw))if(k.startsWith('pending'))raw[k]=null;raw.interruptPace='calm';raw.lastInterruptWeek=raw.week;
const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
await ctx.addInitScript(raw=>{
 if(!localStorage.getItem('__factorySeeded')){localStorage.setItem('silicon.save.v1',JSON.stringify(raw));localStorage.setItem('silicon.save.v1.bak','original unreadable bytes');localStorage.setItem('silicon.settings',JSON.stringify({theme:'light',sound:false,haptics:false,factoryTutorialSeen:true,decorateTutorialSeen:true,notifPrompted:true}));localStorage.setItem('__factorySeeded','1');}
 const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...rest){return /webgl/i.test(kind)?null:get.call(this,kind,...rest);};
},raw);
const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
const read=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('silicon.save.v1')));
await p.goto(URL);await p.waitForTimeout(2000);
for(let i=0;i<8;i++){const b=p.locator('.coach__skip');if(!await b.count())break;await b.click();}
for(let i=0;i<6;i++){if(!await p.locator('[role=dialog]').count())break;await p.keyboard.press('Escape');await p.waitForTimeout(100);}

const before = await read();
await p.evaluate(() => {
 window.__realSet = Storage.prototype.setItem;
 Storage.prototype.setItem = function(k,v) { if(k==='silicon.save.v1') throw new DOMException('denied','SecurityError'); return window.__realSet.call(this,k,v); };
});
await p.getByRole('button',{name:'Save recovery',exact:true}).waitFor({timeout:15000});
// Freeze simulation through the real control while writes are failing.
for(let i=0;i<3;i++){
 const dial=p.locator('.speeddial__btn--primary');
 if(await dial.getAttribute('aria-label')==='Resume')break;
 await dial.click();
}
if(await p.locator('.speeddial__btn--primary').getAttribute('aria-label')!=='Resume')throw Error('Could not pause simulation');
await p.getByRole('button',{name:'Save recovery',exact:true}).click();
await p.getByRole('button',{name:'Export recovery copy',exact:true}).waitFor();
const downloadPromise=p.waitForEvent('download');
await p.getByRole('button',{name:'Export recovery copy',exact:true}).click();
const download=await downloadPromise;await download.saveAs('artifacts/release-prep/recovery-export.txt');
const exported=await readFile('artifacts/release-prep/recovery-export.txt','utf8');
if(Buffer.from(exported.slice('SILICON1:'.length),'base64').toString()!=='original unreadable bytes')throw Error('Recovery bytes changed');
await p.getByRole('button',{name:'Try restoring',exact:true}).click();
await p.getByRole('button',{name:'Restore recovery copy',exact:true}).click();
if((await read()).seed!==before.seed)throw Error('Invalid recovery changed company');
await p.getByText('This version cannot read that copy. It has been kept.',{exact:true}).waitFor();
await p.waitForTimeout(5000);
await p.getByRole('button',{name:'Export recovery copy',exact:true}).scrollIntoViewIfNeeded();
await p.screenshot({path:'artifacts/release-prep/recovery-phone.png'});
await p.evaluate(() => { Storage.prototype.setItem=window.__realSet; });
// No manual retry or gameplay change: the safety autosave must retry unchanged state.
await p.waitForFunction(()=>!document.querySelector('.app__save-notice'),null,{timeout:15000});
if(await p.evaluate(()=>localStorage.getItem('silicon.save.v1.bak'))!=='original unreadable bytes')throw Error('Recovery lost');
// Seed after pagehide's legitimate final save, immediately before the next app boot.
await p.addInitScript(() => localStorage.setItem('silicon.save.v1','second unreadable company'));
await p.reload({waitUntil:'domcontentloaded'});
await p.getByRole('button',{name:'Export recovery copy',exact:true}).nth(1).waitFor();
await p.getByRole('button',{name:'Retry saving',exact:true}).click();
if(await p.evaluate(()=>localStorage.getItem('silicon.save.v1'))!=='second unreadable company')throw Error('Protected primary overwritten');
if(await p.evaluate(()=>localStorage.getItem('silicon.save.v1.bak'))!=='original unreadable bytes')throw Error('First recovery copy overwritten');
await p.evaluate(()=>window.scrollTo(0,0));
await p.screenshot({path:'artifacts/release-prep/recovery-startup-phone.png'});
if(errors.length)throw Error(errors.join('\n'));
console.log('PASS: storage-denied notice, Settings recovery, exact downloaded bytes, invalid restore preserves current company, automatic retry clears write failure while paused; unreadable startup exposes both preserved copies before onboarding.');
await browser.close();server.close();
