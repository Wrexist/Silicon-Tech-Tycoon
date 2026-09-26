// Reproducible store media from the current production build, using isolated staged saves.
// npm run build && npm run shots:stage:showcase && node scripts/store-media-1.4.mjs
// MEDIA_ONLY=office,factory MEDIA_DEVICES=iphone MEDIA_VIDEO=1 are optional.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const root = resolve('.'), dist = join(root, 'dist');
const out = join(root, 'appstore', 'release-1.4.0');
await mkdir(out, { recursive: true });
const mime = { '.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.json':'application/json', '.glb':'model/gltf-binary', '.webp':'image/webp', '.png':'image/png', '.svg':'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const path = resolve(dist, '.' + decodeURIComponent((req.url || '/').split('?')[0]));
    if (path !== dist && !path.startsWith(dist + '/'.replace('/', process.platform === 'win32' ? '\\' : '/'))) { res.writeHead(403); res.end(); return; }
    let file = path, data;
    try { data = await readFile(file); } catch { file = join(dist, 'index.html'); data = await readFile(file); }
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' }); res.end(data);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}`;
const exe = process.env.SHOTS_CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', chromium.executablePath()].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'] });
const source = JSON.parse(await readFile('/tmp/silicon-showcase.json', 'utf8'));
const videoOnly=process.env.MEDIA_VIDEO_ONLY==='1';
const report = videoOnly ? JSON.parse(await readFile(join(out,'capture-report.json'),'utf8')) : { source: 'dist/', stagedSave: '/tmp/silicon-showcase.json', captures: [], errors: [] };
const frames = [
  { id:'office', title:['Build your', 'dream studio.'], sub:'A living team. A company that is yours.', accent:'#83e6db', tab:'Office' },
  { id:'factory', title:['Make it.', 'Watch it move.'], sub:'Build the line behind your next big launch.', accent:'#ffc77c', tab:'Office' },
  { id:'design', title:['Your next', 'breakthrough.'], sub:'Shape every detail of your next device.', accent:'#8cb5ff', tab:'Design' },
  { id:'research', title:['One idea.', 'A new era.'], sub:'Research the technology that changes your company.', accent:'#c4a8ff', tab:'Research' },
  { id:'market', title:['Small startup.', 'Serious rival.'], sub:'Read the market. Find your moment.', accent:'#9ee3b9', tab:'Market' },
  { id:'company', title:['Build a team.', 'Grow an empire.'], sub:'People, products and decisions that matter.', accent:'#ffb4a2', tab:'Company' },
];
const devices = [
  { id:'iphone', width:440, height:956, dpr:3, w:1320, h:2868 },
  { id:'ipad', width:1032, height:1376, dpr:2, w:2064, h:2752 },
].filter(d => !process.env.MEDIA_DEVICES || process.env.MEDIA_DEVICES.split(',').includes(d.id));
const selected = frames.filter(f => !process.env.MEDIA_ONLY || process.env.MEDIA_ONLY.split(',').includes(f.id));
const esc = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;');

async function compose(raw, target, device, frame, index) {
  const {w,h} = device, ipad = device.id === 'ipad';
  const margin = ipad ? 170 : 110, top = ipad ? 350 : 400;
  const width = w - margin*2, height = Math.round(width*device.height/device.width);
  const shot = await sharp(raw).resize(width, height).png().toBuffer();
  const radius = 36;
  const mask = Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" rx="${radius}" fill="white"/></svg>`);
  const rounded = await sharp(shot).composite([{input:mask,blend:'dest-in'}]).toBuffer();
  const font = ipad ? 98 : 100, start = ipad ? 142 : 150;
  const backdrop = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="glow"><stop stop-color="${frame.accent}" stop-opacity=".15"/><stop offset="1" stop-color="#0b1320" stop-opacity="0"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="#0b1320"/><ellipse cx="${w*.85}" cy="${h*.45}" rx="${w}" ry="${h*.6}" fill="url(#glow)"/>
    <g font-family="Segoe UI,Arial,sans-serif"><text x="${margin}" y="62" font-size="24" font-weight="600" letter-spacing="5" fill="#a7b6ca">SILICON / TECH TYCOON</text>
    <text x="${margin}" y="${start}" font-size="${font}" font-weight="800" letter-spacing="-4" fill="#f7f9fd">${esc(frame.title[0])}</text>
    <text x="${margin}" y="${start+font*1.03}" font-size="${font}" font-weight="800" letter-spacing="-4" fill="${frame.accent}">${esc(frame.title[1])}</text>
    <text x="${margin}" y="${start+font*1.03+66}" font-size="${ipad?38:32}" fill="#bcc9da">${esc(frame.sub)}</text>
    <rect x="${margin-3}" y="${top-3}" width="${width+6}" height="${height+6}" rx="${radius+3}" fill="#697d94" fill-opacity=".4"/>
    <text x="${w-margin}" y="${h-24}" text-anchor="end" font-size="22" letter-spacing="3" fill="#8ca0b8">${String(index+1).padStart(2,'0')} / 06</text></g></svg>`);
  if (top+height > h-45) throw Error(`Composition clips ${device.id}: ${top+height}/${h}`);
  await sharp(backdrop).composite([{input:rounded,left:margin,top}]).flatten({background:'#0b1320'}).png().toFile(target);
}

try {
  for (const device of devices) for (const frame of selected) {
    const dir = join(out,device.id), rawDir=join(dir,'raw'); await mkdir(rawDir,{recursive:true});
    const save = structuredClone(source);
    for(const k of Object.keys(save)) if(k.startsWith('pending')) save[k]=Array.isArray(save[k])?[]:null;
    save.ready=[]; save.lastActive=Date.now(); save.lastInterruptWeek=save.week+500;
    if(frame.id!=='factory') save.building=[];
    else for(const build of save.building) {build.totalWeeks=Math.max(build.totalWeeks,12);build.weeksElapsed=3;}
    const context=await browser.newContext({viewport:{width:device.width,height:device.height},deviceScaleFactor:videoOnly?2:device.dpr,hasTouch:true});
    await context.addInitScript(save=>{
      if(localStorage.getItem('__storeStaged')) return;
      localStorage.setItem('__storeStaged','1'); localStorage.setItem('silicon.save.v1',JSON.stringify(save));
      localStorage.setItem('silicon.settings',JSON.stringify({theme:'dark',sound:false,haptics:false,garage3d:true,decorateTutorialSeen:true,factoryTutorialSeen:true,notifPrompted:true}));
      localStorage.setItem('silicon.factory.camhint','1'); localStorage.setItem('silicon.hint.tapteam','1');
    },save);
    const page=await context.newPage(); page.setDefaultTimeout(120000);
    const cdp=await context.newCDPSession(page);
    const screenshot=async path=>{
      const {data}=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      await writeFile(path,Buffer.from(data,'base64'));
    };
    if(process.env.MEDIA_VIDEO==='1') await page.clock.install();
    page.on('pageerror',e=>report.errors.push(`${device.id}/${frame.id}: ${e.message}`));
    await page.goto(url,{waitUntil:'networkidle'});
    await page.locator('.bnav__item:visible, .railnav__item:visible').first().waitFor();
    for(let n=0;n<8 && await page.locator('.coach__skip').count();n++) await page.locator('.coach__skip').click();
    const pause=page.getByRole('button',{name:'Pause',exact:true}); if(await pause.count()) await pause.click();
    await page.locator('.bnav__item:visible, .railnav__item:visible').filter({hasText:frame.tab}).click();
    if(frame.id==='factory') {
      await page.getByRole('button',{name:'Factory',exact:true}).click();
      await page.getByRole('button',{name:'Open factory mode',exact:true}).click();
      await page.locator('.fmode canvas').waitFor();
      // A small player-controlled zoom gives the working line more space in the store frame.
      await page.locator('.fmode canvas').hover();
      for(let i=0;i<3;i++) await page.mouse.wheel(0,-100);
    } else if(frame.id==='design') {
      await page.getByRole('tab',{name:'Style',exact:true}).click();
      const back=page.getByRole('button',{name:'View back',exact:true}); if(await back.count()) await back.click();
      // Scroll to the actual device card, avoiding the saved-design administration above it.
      await page.locator('.lab__hero').scrollIntoViewIfNeeded();
    }
    await page.waitForTimeout(5000); // allow genuine transient notifications to finish
    await page.evaluate(()=>document.activeElement instanceof HTMLElement && document.activeElement.blur());
    const raw=join(rawDir,`${frame.id}.png`), name=`${String(frames.indexOf(frame)+1).padStart(2,'0')}-${frame.id}.png`;
    if(!videoOnly) {
      await screenshot(raw);
      await compose(raw,join(dir,name),device,frame,frames.indexOf(frame));
      report.captures.push({device:device.id,frame:frame.id,path:join(dir,name),width:device.w,height:device.h});
      console.log('CAPTURE',device.id,frame.id);
    }
    if(process.env.MEDIA_VIDEO==='1' && device.id==='iphone' && ['office','factory','design','research','company'].includes(frame.id)) {
      const videoDir=join(out,'preview-frames',frame.id);await mkdir(videoDir,{recursive:true});
      if(!videoOnly) await cdp.send('Emulation.setDeviceMetricsOverride',{width:device.width,height:device.height,deviceScaleFactor:2,mobile:false});
      // Advance the browser clock one video frame at a time: rendering speed cannot drop frames.
      const resume=page.getByRole('button',{name:frame.id==='factory'?'Resume game':'Resume',exact:true});
      if(await resume.count()) await resume.dispatchEvent('click');
      await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
      for(let i=0;i<120;i++) {
        await page.clock.runFor(1000/30);
        await screenshot(join(videoDir,`${String(i).padStart(4,'0')}.png`));
        if(i%30===29) console.log('VIDEO',frame.id,i+1,'/120');
      }
    }
    await context.close();
    await writeFile(join(out,'capture-report.json'),JSON.stringify(report,null,2));
  }
  if(report.errors.length) throw Error(report.errors.join('\n'));
} finally { await browser.close(); server.close(); }
