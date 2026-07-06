import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
let staged = (await readFile("/tmp/silicon-stage.json")).toString();
{ const sv = JSON.parse(staged); sv.lastActive = Date.now(); staged = JSON.stringify(sv); }
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox","--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((v) => { localStorage.setItem("silicon.save.v1", v); localStorage.setItem("silicon.settings", JSON.stringify({ theme:"light", sound:true, haptics:true, garage3d:true, decorateTutorialSeen:true, factoryTutorialSeen:true })); }, staged);
const p = await ctx.newPage();
await p.goto("http://localhost:5199", { waitUntil:"domcontentloaded" });
await p.waitForTimeout(2400);
await p.click('.ds-sheet button:has-text("Continue")', { timeout:1500 }).catch(()=>{});
for (let i=0;i<8;i++){ const sk=await p.$(".coach__skip"); if(!sk)break; await sk.click().catch(()=>{}); await p.waitForTimeout(150); }
await p.evaluate(()=>{ const b=[...document.querySelectorAll(".bnav__item")].find(el=>el.querySelector(".bnav__label")?.textContent?.trim()==="Office"); b?.click(); });
await p.waitForTimeout(700);
await p.evaluate(()=>{ const b=[...document.querySelectorAll("button")].find(x=>(x.textContent||"").trim()==="Factory" && !x.closest(".bnav")); b?.click(); });
await p.waitForTimeout(700);
await p.click('button[aria-label="Open factory mode"]', { timeout:6000 }).catch(()=>{});
await p.waitForTimeout(1500);
// Match the user's situation: arm the Build tool first.
await p.evaluate(()=>{ const b=[...document.querySelectorAll(".fmode__tool")].find(x=>/Build/.test(x.textContent||"")); b?.click(); });
await p.waitForTimeout(500);
// Tap Style → full-page screenshot (honest occlusion test).
await p.evaluate(()=>{ const b=[...document.querySelectorAll(".fmode__tool")].find(x=>/Style/.test(x.textContent||"")); b?.click(); });
await p.waitForTimeout(800);
await p.screenshot({ path: "/home/user/Silicon-Tech-Tycoon/.tab-shots/sheet-style.png" });
// What's actually on top at the sheet's location?
const probe = await p.evaluate(() => {
  const el = document.elementFromPoint(195, 700);
  return { topEl: `${el?.tagName}.${el?.className?.toString?.().slice(0,40)}`, sheetInDom: !!document.querySelector(".fmode__sheet") };
});
console.log("style probe:", JSON.stringify(probe));
// Close, tap Stats.
await p.keyboard.press("Escape"); await p.waitForTimeout(600);
await p.evaluate(()=>{ const b=[...document.querySelectorAll(".fmode__tool")].find(x=>/Stats/.test(x.textContent||"")); b?.click(); });
await p.waitForTimeout(800);
await p.screenshot({ path: "/home/user/Silicon-Tech-Tycoon/.tab-shots/sheet-stats.png" });
console.log("done");
await browser.close();
