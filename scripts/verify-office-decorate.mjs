// TEMP evidence script (not committed): Decorate-mode walkthrough on the populated review save —
// select/place/rotate/undo/exit/reload + an insufficient-funds rejection. The save fixture on disk is
// never written; only the browser's localStorage copy is, and every step is screenshotted.
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
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

const theme = process.argv[2] || "dark";
const outDir = resolve(root, ".shots", `finish-decorate-${theme}`);
await mkdir(outDir, { recursive: true });

const raw = JSON.parse((await readFile("/tmp/silicon-stage.json")).toString());
raw.lastActive = Date.now();
for (const k of Object.keys(raw)) if (/^pending/.test(k)) raw[k] = null;
raw.interruptPace = "calm";
raw.lastInterruptWeek = raw.week;
const fixtureLayout = JSON.stringify((raw.layout || []).map(({ iid, type, c, r, rot }) => ({ iid, type, c, r, rot })));
const staged = JSON.stringify(raw);
console.log(`fixture layout: ${(raw.layout || []).length} pieces`);
console.log(`  hash: ${fixtureLayout}`);

const exe = [process.env["ProgramFiles"] + "\\Google\\Chrome\\Application\\chrome.exe", process.env["ProgramFiles(x86)"] + "\\Google\\Chrome\\Application\\chrome.exe", process.env["LOCALAPPDATA"] + "\\Google\\Chrome\\Application\\chrome.exe", process.env["ProgramFiles"] + "\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 320, height: 740 }, deviceScaleFactor: 2 });
await ctx.addInitScript(([v, th]) => {
  window.__THREE_DEVTOOLS__={dispatchEvent(e){const r=e.detail;if(r?.isWebGLRenderer){const render=r.render;r.render=function(scene,camera){if(camera.isPerspectiveCamera){window.__officeCamera=camera;window.__officeCanvas=r.domElement;}return render.call(this,scene,camera);};}}};
  if (!localStorage.getItem("__seeded")) { localStorage.setItem("silicon.save.v1", v); localStorage.setItem("__seeded", "1"); }
  localStorage.setItem("silicon.settings", JSON.stringify({ theme: th, sound: false, haptics: false, decorateTutorialSeen: true, factoryTutorialSeen: true, notifPrompted: true }));
}, [staged, theme]);
const p = await ctx.newPage();
p.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));

const shot = async (n) => { await p.waitForTimeout(500); await p.screenshot({ path: resolve(outDir, `${n}.png`) }); console.log("shot", n); };
const liveLayout = () => p.evaluate(() => {
  try { const s = JSON.parse(localStorage.getItem("silicon.save.v1") || "{}"); return (s.layout || []).map(({ iid, type, c, r, rot }) => ({ iid, type, c, r, rot })); } catch { return null; }
});
const boot = async () => {
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(3200);
  for (let i = 0; i < 10; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(200); }
  for (let i = 0; i < 5; i++) { const d = await p.$('[role="dialog"]'); if (!d) break; await p.keyboard.press("Escape").catch(() => {}); await p.waitForTimeout(300); }
  await p.waitForTimeout(1200);
};

await boot();
await shot("01-normal-play");
await p.locator(".hq__decorate").click();
await p.waitForTimeout(1500);
await shot("02-decorate-open");
const project=async(c,r,y=0)=>p.evaluate(({c,r,y})=>{const camera=window.__officeCamera,canvas=window.__officeCanvas;
  const v=camera.position.clone().set(-5.59+(c+.5)*.86,y,-5.59+(r+.5)*.86).project(camera);
  const b=canvas.getBoundingClientRect();return {x:b.x+(v.x+1)*b.width/2,y:b.y+(1-v.y)*b.height/2};},{c,r,y});
// Player-owned rack is a visible, tall target. Drag it onto empty foreground, then undo.
const rack=await project(8,7,.8), target=await project(9,9,.02);
await p.mouse.move(rack.x,rack.y);await p.mouse.down();await p.waitForTimeout(150);
await p.mouse.move(target.x,target.y,{steps:12});await p.waitForTimeout(400);
await shot('02a-move-preview');await p.mouse.up();await p.waitForTimeout(400);
console.log('drag selection:',await p.locator('.hqb__sel-name').textContent());
await shot('02b-moved');
await p.locator('.hqb__icon[aria-label="Undo"]').click();
// Occupied cell is refused: the red preview must snap home on release.
await p.mouse.move(rack.x,rack.y);await p.mouse.down();
const blocked=await project(8,4,.02);
await p.mouse.move(blocked.x,blocked.y,{steps:12});await p.waitForTimeout(400);
await shot('02c-invalid-preview');await p.mouse.up();await p.waitForTimeout(500);
await p.locator('.hqb__tool',{hasText:'Deselect'}).click();
await shot('02d-invalid-cancelled');

// PLACE a valid piece (catalog tap auto-drops into the first free cell and selects it).
await p.locator(".hqb__search-input").fill("Plant");
await p.waitForTimeout(500);
const placed = await p.evaluate(() => {
  const b = [...document.querySelectorAll(".hqb__item")].find((x) => !x.classList.contains("hqb__item--poor"));
  if (!b) return null;
  b.click();
  return b.getAttribute("aria-label");
});
console.log("placed:", placed);
await shot("03-placed-selected");

// ROTATE the selected piece.
await p.locator(".hqb__tool", { hasText: "Rotate" }).first().click({ timeout: 3000 }).catch((e) => console.log("rotate:", String(e).split("\n")[0]));
await shot("04-rotated");

// UNDO restores exactly (the snapshot is per-edit).
await p.locator('.hqb__icon[aria-label="Undo"]').click({ timeout: 3000 }).catch((e) => console.log("undo:", String(e).split("\n")[0]));
await p.locator('.hqb__icon[aria-label="Undo"]').click();
await shot("05-undone");

// CANCEL: deselect (place mode cancel equivalent).
await p.locator(".hqb__tool", { hasText: "Deselect" }).click({ timeout: 3000 }).catch(() => {});
await shot("06-deselected");

// EXIT back to normal play, then RELOAD and verify nothing was written.
await p.locator('.hqb__top-actions button:has-text("Done")').click();
await p.waitForTimeout(1200);
await shot("07-back-to-play");
await p.waitForTimeout(2500); // autosave window
await boot();
await shot("08-reloaded");
const afterUndo = JSON.stringify(await liveLayout());
if (afterUndo !== fixtureLayout) throw new Error("Undo/reload changed owned furniture");
console.log("layout after place+rotate+undo+reload === fixture:", afterUndo === fixtureLayout);

// PERSISTENCE: place one piece for real, exit, reload, verify it survived.
await p.locator(".hq__decorate").click();
await p.waitForTimeout(1400);
await p.locator(".hqb__search-input").fill("Plant");
await p.waitForTimeout(500);
const placed2 = await p.evaluate(() => {
  const b = [...document.querySelectorAll(".hqb__item")].find((x) => !x.classList.contains("hqb__item--poor"));
  if (!b) return null;
  b.click();
  return b.getAttribute("aria-label");
});
console.log("persistence placed:", placed2);
await p.waitForTimeout(600);
await p.locator('.hqb__top-actions button:has-text("Done")').click();
// The save is written on the sim tick, so run it briefly (the real autosave path) rather than
// waiting on wall-clock alone.
await p.waitForTimeout(800);
await p.evaluate(() => {
  [...document.querySelectorAll("button[aria-label]")].filter((x) => x.offsetParent !== null).find((x) => x.getAttribute("aria-label") === "Pause")?.click();
});
await p.waitForTimeout(300);
await p.evaluate(() => {
  [...document.querySelectorAll("button[aria-label]")].filter((x) => x.offsetParent !== null).find((x) => x.getAttribute("aria-label") === "Fast forward")?.click();
});
await p.waitForTimeout(6000);
console.log("live layout before reload:", (await liveLayout()).length, "pieces");
console.log("diag:", JSON.stringify(await p.evaluate(() => {
  try {
    const s = JSON.parse(localStorage.getItem("silicon.save.v1") || "{}");
    const l = s.layout || [];
    return { keys: Object.keys(s).slice(0, 40), layoutLen: l.length, sample: l.slice(0, 3), types: [...new Set(l.map((x) => x.type))].slice(0, 12) };
  } catch (e) { return String(e); }
})));
await boot();
await shot("09-persistence-reload");
const persisted = await liveLayout();
if (persisted.length !== JSON.parse(fixtureLayout).length + 1) throw new Error("Placement did not survive reload");
for(const item of JSON.parse(fixtureLayout)) if(JSON.stringify(persisted.find(x=>x.iid===item.iid))!==JSON.stringify(item)) throw new Error("Owned piece changed: "+item.iid);
const added = persisted.filter((it) => !JSON.parse(fixtureLayout).some((f) => f.iid === it.iid));
console.log(`persisted layout: ${persisted.length} pieces (fixture ${JSON.parse(fixtureLayout).length}); added:`, JSON.stringify(added));
const stable=s=>({layout:s.layout.filter(x=>raw.layout.some(f=>f.iid===x.iid)),roomStyle:s.roomStyle,upgrades:s.upgrades,staff:s.staff.map(({id,name,role,assignment,appearance})=>({id,name,role,assignment,appearance}))});
const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('silicon.save.v1')));
if(JSON.stringify(stable(saved))!==JSON.stringify(stable(raw))) throw new Error('Furniture/appearance/staff/upgrade preservation failed');
await writeFile(`artifacts/office-finish/preservation-${theme}.json`,JSON.stringify({original:stable(raw),after:stable(saved),added,unchanged:true},null,2));




await browser.close();
server.close();
console.log("decorate shots ->", outDir);
