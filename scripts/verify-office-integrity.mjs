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
const reviewWidth=Number(process.argv.find(x=>x.startsWith('--width='))?.split('=')[1]||320);
const ctx=await browser.newContext({viewport:{width:reviewWidth,height:reviewWidth>=1032?1376:reviewWidth>=768?1024:740},deviceScaleFactor:2});
await ctx.addInitScript(raw=>{
 if(!localStorage.getItem('__factorySeeded')){localStorage.setItem('silicon.save.v1',JSON.stringify(raw));localStorage.setItem('silicon.settings',JSON.stringify({theme:raw.__reviewTheme,sound:false,haptics:false,factoryTutorialSeen:true,decorateTutorialSeen:true,notifPrompted:true}));localStorage.setItem('__factorySeeded','1');}

},raw);
if(process.argv.includes('--fallback'))await ctx.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /webgl/i.test(kind)?null:get.call(this,kind,...args);};});
const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
const read=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('silicon.save.v1')));
await p.goto(URL);if(process.argv.includes("--text-scale"))await p.addStyleTag({content:"html{font-size:125%}"});await p.waitForTimeout(2000);
for(let i=0;i<8;i++){const b=p.locator('.coach__skip');if(!await b.count())break;await b.click();}
for(let i=0;i<6;i++){if(!await p.locator('[role=dialog]').count())break;await p.keyboard.press('Escape');await p.waitForTimeout(100);}
const control=p.locator('.speeddial__btn--primary');if(await control.getAttribute('aria-label')==='Pause'){await control.click();await control.click();}

const theme=(process.argv[2]||'dark')+(process.argv.includes('--denied')?'-denied':'')+(process.argv.includes('--fallback')?'-fallback':'')+(process.argv.includes('--context-loss')?'-context-loss':'')+(reviewWidth!==320?`-${reviewWidth}`:'')+(process.argv.includes('--text-scale')?'-large-text':'');
await mkdir('artifacts/office-factory-followup',{recursive:true});
await p.waitForTimeout(1200);
const before=await read();
await p.screenshot({path:`artifacts/office-factory-followup/office-${theme}-idle.png`});
const hasRail=await p.locator('.railnav').count()>0;
await p.locator('.hq__decorate').click();
if(hasRail)await p.locator('.railnav').waitFor({state:'hidden',timeout:5000});
if(process.argv.includes('--context-loss')) {
 await p.locator('.hq__scene canvas').evaluate(c=>{const gl=c.getContext('webgl2');const ext=gl?.getExtension('WEBGL_lose_context');if(!ext)throw Error('Context loss extension unavailable');ext.loseContext();});
}
if(process.argv.includes('--fallback')||process.argv.includes('--context-loss')) {
 await p.locator('.office-map--build').waitFor();
 if(await p.locator('[data-office-item]').count()!==before.layout.length)throw Error('Fallback omitted owned furniture');
 const rack=before.layout.find(x=>x.type==='serverRack'), occupied=before.layout.find(x=>x.type==='desk');
 await p.getByLabel('Select office furniture',{exact:true}).selectOption(rack.iid);
 await p.getByLabel('Move to column',{exact:true}).selectOption({value:String(occupied.c)});
 await p.getByLabel('Move to row',{exact:true}).selectOption({value:String(occupied.r)});
 await p.getByRole('button',{name:'Move',exact:true}).click();
 await p.getByText('Not enough space here. Your furniture stayed in place.',{exact:true}).waitFor();
 if(!(await p.getByRole('button',{name:'Undo',exact:true}).isDisabled()))throw Error('Rejected fallback move added history');
 await p.getByLabel('Move to column',{exact:true}).selectOption({value:'9'});
 await p.getByLabel('Move to row',{exact:true}).selectOption({value:'9'});
 await p.getByRole('button',{name:'Move',exact:true}).click();
 await p.waitForTimeout(1500);
 console.log('move diagnostic', await p.getByLabel('Move to column',{exact:true}).inputValue(),await p.getByLabel('Move to row',{exact:true}).inputValue(),(await read()).layout.find(x=>x.iid===rack.iid));
 await p.screenshot({path:`artifacts/office-factory-followup/office-${theme}-move-attempt.png`});
 await p.waitForFunction(id=>{const item=JSON.parse(localStorage.getItem('silicon.save.v1')).layout.find(x=>x.iid===id);return item.c===9&&item.r===9;},rack.iid);
 await p.screenshot({path:`artifacts/office-factory-followup/office-${theme}-move.png`});
 await p.getByRole('button',{name:'Undo',exact:true}).click();
}

await p.locator('.hqb__search-input').fill('Plant');
await p.locator('.hqb__item:not(.hqb__item--poor)').first().click();
await p.waitForFunction(n=>JSON.parse(localStorage.getItem('silicon.save.v1')).layout.length===n,before.layout.length+1);
const purchased=await read();
if(!(purchased.cash<before.cash))throw Error('Purchase was not charged');
if(process.argv.includes('--denied')) {
 await p.locator('.hqb__tool').filter({hasText:'Duplicate'}).click();
 await p.getByText('Not enough cash to duplicate this item.',{exact:true}).waitFor();
 await p.screenshot({path:`artifacts/office-factory-followup/office-${theme}-feedback.png`});
 await p.getByRole('button',{name:'Undo',exact:true}).click();
 await p.waitForFunction(n=>JSON.parse(localStorage.getItem('silicon.save.v1')).layout.length===n,before.layout.length);
 if(!(await p.getByRole('button',{name:'Undo',exact:true}).isDisabled()))throw Error('Rejected duplicate consumed Undo history');
 if((await read()).cash!==before.cash)throw Error('Rejected duplicate altered wallet');
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS: actual unaffordable Duplicate explains failure; one Undo reverses the purchase, leaves no history and restores exact cash.');
 await browser.close();server.close();process.exit(0);
}

await p.locator('.hqb__tool').filter({hasText:'Rotate'}).click();
await p.screenshot({path:`artifacts/office-factory-followup/office-${theme}-decorate.png`});
await p.locator('.hqb__tool').filter({hasText:'Sell'}).click();
await p.getByRole('button',{name:'Undo',exact:true}).click();
await p.getByRole('button',{name:'Undo',exact:true}).click();
await p.getByRole('button',{name:'Undo',exact:true}).click();
await p.locator('.hqb__top-actions button').filter({hasText:'Done'}).click();
if(hasRail){
 await p.locator('.railnav').waitFor({state:'visible',timeout:5000});
 await p.locator('.railnav__item').filter({hasText:'Company'}).click();
 await p.locator('.co').waitFor();
 await p.locator('.railnav__item').filter({hasText:'Office'}).click();
}

await p.waitForFunction(n=>JSON.parse(localStorage.getItem('silicon.save.v1')).layout.length===n,before.layout.length);
const after=await read();
if(after.cash!==before.cash)throw Error('Office Undo wallet mismatch');
if(JSON.stringify(after.layout)!==JSON.stringify(before.layout))throw Error('Office furniture changed');
if(JSON.stringify(after.factoryFloor)!==JSON.stringify(before.factoryFloor))throw Error('Factory furniture changed');
await p.reload();await p.waitForTimeout(1500);
const reloaded=await read();
if(JSON.stringify(reloaded.layout)!==JSON.stringify(before.layout)||reloaded.cash!==before.cash)throw Error('Reload mismatch');
if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow');
if(errors.length)throw Error(errors.join('\n'));
console.log(`PASS ${theme}: ${reviewWidth} CSS px DPR2 office purchase, Rotate, Undo, Sell, Undo, exit/reload, exact wallet and owned furniture, no page errors or horizontal overflow.`);
await browser.close();server.close();
