// Targeted animation diagnostic against the current application in Vite. Uses isolated browser
// storage and a clearly labelled activity fixture, never edits the saved review fixture.
import {createServer} from 'vite';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
const server=await createServer({server:{host:'127.0.0.1',port:5187},logLevel:'error'});
await server.listen();const URL='http://127.0.0.1:5187';
const exe = [process.env.SHOTS_CHROME, process.env["ProgramFiles"] + "\\Google\\Chrome\\Application\\chrome.exe", process.env["ProgramFiles(x86)"] + "\\Google\\Chrome\\Application\\chrome.exe", process.env["LOCALAPPDATA"] + "\\Google\\Chrome\\Application\\chrome.exe", process.env["ProgramFiles"] + "\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });




const theme=process.argv[2]||'dark';
const output=process.env.SHOTS_OUTPUT || 'artifacts/office-activities';
const raw=JSON.parse(await readFile('scripts/fixtures/save-release-review.json','utf8'));
const original=JSON.stringify(raw.layout);
raw.lastActive=Date.now();for(const k of Object.keys(raw))if(k.startsWith('pending'))raw[k]=null;
raw.interruptPace='calm';raw.lastInterruptWeek=raw.week;
const record=process.argv.includes('--motion');
await mkdir('artifacts/office-motion',{recursive:true});
const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,...(record?{recordVideo:{dir:'artifacts/office-motion/video',size:{width:390,height:844}}}:{})});
await ctx.addInitScript(({raw,theme})=>{
 localStorage.setItem('silicon.save.v1',JSON.stringify(raw));
 localStorage.setItem('silicon.settings',JSON.stringify({theme,sound:false,haptics:false,decorateTutorialSeen:true,notifPrompted:true}));
 window.__THREE_DEVTOOLS__={dispatchEvent(e){const r=e.detail;if(!r?.isWebGLRenderer)return;const render=r.render;
 r.render=function(scene,camera){const result=render.call(this,scene,camera);if(camera.isPerspectiveCamera){window.__officeScene=scene;window.__officeRenderer=r;}return result;};}};
},{raw,theme});
const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto(URL);await p.waitForSelector('.speeddial__btn--primary');
 for(let i=0;i<8;i++){const b=p.locator('.coach__skip');if(!await b.count())break;await b.click();}
 for(let i=0;i<6;i++){if(!await p.locator('[role=dialog]').count())break;await p.keyboard.press('Escape');await p.waitForTimeout(100);}
 const control=p.locator('.speeddial__btn--primary');if(await control.getAttribute('aria-label')==='Pause'){await control.click();await control.click();}
 await p.waitForFunction(()=>window.__officeScene?.getObjectByName('employee-s0'));
 await mkdir(output,{recursive:true});
 // Select cosmetic weeks via the existing scheduler; the saved simulation is paused, unchanged.
 const plans=await p.evaluate(async raw=>{
  const c=await import('/src/garage3d/employeeController.ts'),f=await import('/src/engine/furniture.ts');
  const sides=f.planSeats(raw.layout,raw.facilityTier).flipped,seats=f.deskItems(raw.layout);
  const agents=raw.staff.slice(0,seats.length).map((s,i)=>{const w=f.worldOf(seats[i],raw.facilityTier),off=sides[seats[i].iid]?0.86:-0.86;return {key:s.id,seed:i*2.1,colorIdx:s.appearance.shirt%5,x:w.x+Math.sin(w.rotY)*off,z:w.z+Math.cos(w.rotY)*off,face:w.rotY+(off>0?Math.PI:0)};});
  const dests=c.officeDestinations({amenityTier:0,showWhiteboard:false,dark:true,layout:raw.layout,facilityTier:raw.facilityTier,roomScale:f.gridN(raw.facilityTier)/9});
  const out={};for(let week=1;week<250;week++){const plan=c.awayPlanFor(agents,raw.seed,week,dests);for(const [id,spot] of plan)if(!out[spot.kind])out[spot.kind]={week,id,spot};}
  return out;
 },raw);
 console.log(JSON.stringify({plans}));
 const results=[];
 for(const kind of ['relaxing','watering']){
  if(!plans[kind])throw Error('No scheduled '+kind);
  // Reload resets presentation clocks and previous reservations; same owned layout each scenario.
  await p.reload();await p.waitForSelector('.speeddial__btn--primary');
  for(let i=0;i<8;i++){const b=p.locator('.coach__skip');if(!await b.count())break;await b.click();}
  for(let i=0;i<6;i++){if(!await p.locator('[role=dialog]').count())break;await p.keyboard.press('Escape');await p.waitForTimeout(100);}
  const control=p.locator('.speeddial__btn--primary');if(await control.getAttribute('aria-label')==='Pause'){await control.click();await control.click();}
  await p.waitForFunction(()=>window.__officeScene?.getObjectByName('employee-s0'));
  await p.evaluate(async ({seed,week})=>{(await import('/src/garage3d/officeLive.ts')).setOfficeLiveContext(seed,week);},{seed:raw.seed,week:plans[kind].week});
  await p.waitForFunction(kind=>{let found=false;window.__officeScene.traverse(o=>{if(o.name.startsWith('employee-')&&o.userData.activity===kind)found=true;});return found;},kind,{timeout:90000});
  await p.waitForTimeout(1000);
  const actors=await p.evaluate(()=>{const actors=[];window.__officeScene.traverse(o=>{if(o.name.startsWith('employee-'))actors.push({id:o.name,position:o.position.toArray(),...o.userData});});return actors;});
  await p.screenshot({path:`${output}/${theme}-${kind}.png`});
  console.log(JSON.stringify({kind,actors}));results.push({kind,actors});
  await p.waitForFunction(()=>{let active=false;window.__officeScene.traverse(o=>{if(o.name.startsWith('employee-')&&o.userData.activity!=='seated')active=true;});return !active;},undefined,{timeout:90000});
 }
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('silicon.save.v1')));
 if(JSON.stringify(saved.layout)!==original)throw Error('Owned furniture changed');
 if(errors.length)throw Error(errors.join('\n'));
 const rendering=await p.evaluate(()=>{const r=window.__officeRenderer,g=r.getContext(),e=g.getExtension('WEBGL_debug_renderer_info');return {buffer:[r.domElement.width,r.domElement.height],backend:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)};});
 await writeFile(`${output}/${theme}.json`,JSON.stringify({rendering,viewport:{width:390,height:844},dpr:2,environment:'Windows Chromium, Vite diagnostic; cosmetic week selected, unchanged populated review layout',results},null,2));
 console.log('PASS: sofa and plant activities reached, returned to desks, owned furniture unchanged.');
}finally{await ctx.close();if(record&&p.video())await p.video().saveAs(`artifacts/office-motion/${theme}-activities.webm`);await browser.close();await server.close();}
